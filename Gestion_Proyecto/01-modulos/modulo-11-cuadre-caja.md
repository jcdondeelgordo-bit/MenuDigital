# Módulo 11 — Cuadre de Caja

> Identificado por el usuario el 2026-07-30 (`guardian-proyecto`, área "módulos faltantes"): llevan este cuadre a mano en un libro físico, dividido en 4 secciones (compras, pago a empleados, recogida parcial de Jaime/Clemencia, y Nequi), y no existía todavía como pieza del sistema.
>
> **Diseño cerrado el 2026-07-30** (brainstorming con el usuario). Listo para pasar a plan de implementación.
>
> **Plan ejecutado el 2026-07-30**: 4 tasks + revisión final. `cuadre.html` con 3 pestañas (Abrir caja / Durante el día / Cerrar caja), 10 acciones en Apps Script (Inventario), integración de daños en `Gastos_JC`, y verificación de backend con curl de punta a punta.

## Objetivo

Reemplazar el cuadre de caja físico (libro en papel) por una versión digital que calcule solo la base del día siguiente, muestre si faltó o sobró efectivo, y de paso deje registrados los daños/sobrantes del día para que se reflejen automáticamente en el reporte de inventario (Módulo 5).

## Funcionalidades (definidas por el usuario)

- **Compras del día** (gastos en efectivo, en varios locales) — se llevan discriminadas, no en un solo total.
- **Pago a empleados** (se paga diario, en efectivo) — discriminado por empleado.
- **Recogida parcial** de dinero de caja (la hacen Jaime o Clemencia) — puede pasar más de una vez al día.
- **Nequi** — las ventas por Nequi no quedan como efectivo físico en caja.
- **Fórmula del cuadre**: `Venta total + Base del día anterior − Gastos − Pagos a empleados − Recogidas − Nequi − Tarjeta = Nueva base esperada`. Se compara contra el efectivo realmente contado; la diferencia es el **faltante o sobrante** del día.
- **Daños/sobrantes** del día (ej. carne quemada, panes quemados, porciones de pizza sobrantes) se registran junto con el cuadre y **se descuentan automáticamente del inventario** (Módulo 5), no solo quedan anotados.

## Reglas de negocio cerradas (2026-07-30, brainstorming)

**1. Un cuadre por día**, no por turno.

**2. Venta total, Nequi y Tarjeta se calculan solos**, leyendo las ventas ya cobradas en Caja (Módulo 9, columna `Metodo_Pago` de `Ventas`) — no se digitan a mano. Tarjeta se incluye en la fórmula aunque hoy casi no se use, porque este cuadre es la base que probablemente reutilicen otros locales/clientes que sí cobran con tarjeta.

**3. Gastos y pagos a empleados se registran uno por uno, durante el día**, a medida que ocurren — no todos juntos al cerrar. El cierre solo suma lo que ya quedó registrado.

**4. Recogidas parciales pueden ser varias en el mismo día** — se registra cada una (monto y quién la hizo), no un solo campo.

**5. Hay dos tipos de daño, y se tratan distinto:**
   - **Producto terminado sobrante** (ej. "2 porciones Hawaiana, 1 Perro" que sobraron) → se resta **vía receta**, igual que ya hace el sistema con `Gastos_JC` hoy (Producto → Receta → Insumos).
   - **Insumo crudo dañado antes de convertirse en producto** (ej. "1 carne de hamburguesa quemada", "3 panes quemados") → se resta **directo del insumo**, sin pasar por receta, porque nunca llegó a ser un producto vendible.

**6. La base del día siguiente es el efectivo REALMENTE contado** al cerrar (no el valor teóricamente esperado por la fórmula) — así el cuadre de mañana arranca con la realidad, no arrastra un error. Pero esa base **se vuelve a escribir/confirmar al abrir** el día siguiente (no se hereda en silencio), porque a veces toman plata de esa base antes de empezar a operar (para comprar algo puntual) — ese retiro se registra como un Gasto más, con la fecha de hoy.

## Diseño v1

### Dónde vive

**En el proyecto de Apps Script de Inventario** (no en el del Menú digital), decisión explícita del usuario dado el incidente del 2026-07-29 (pegado manual que borró el `doGet` del Menú por confundir los dos proyectos — ver `project_donde_el_gordo` en memoria). Razones:
- `Gastos_JC` (para daños) y `Empleados` (catálogo para pagos) ya viven en el Sheet de Inventario — usarlos ahí evita escribir cruzado hacia otro proyecto.
- Inventario **ya lee** las ventas del Menú (`MENU_SHEET_ID`, usado hoy por `generarReporteInsumos`) — el Cuadre de Caja solo necesita ese mismo tipo de lectura cruzada para traer Venta total/Nequi/Tarjeta, nunca escribir en el Sheet del Menú.
- Menos superficie de riesgo: un solo proyecto de Apps Script recibe pegados de código para este módulo, no dos.

### Modelo de datos (Sheet de Inventario)

4 hojas nuevas:

| Hoja | Columnas |
|---|---|
| `Gastos_Caja` | Fecha, Concepto, Monto, Registrado_Por |
| `Pagos_Empleados_Caja` | Fecha, Empleado, Monto, Registrado_Por |
| `Recogidas_Caja` | Fecha, Quien, Monto, Registrado_Por |
| `Cuadre_Caja` | Fecha, Base_Apertura, Venta_Total, Nequi, Tarjeta, Total_Gastos, Total_Pagos_Empleados, Total_Recogidas, Nueva_Base_Esperada, Efectivo_Contado, Faltante_Sobrante, Abierto_Por, Cerrado_Por, Hora_Apertura, Hora_Cierre |

`Empleados` (dropdown en Pagos_Empleados_Caja) reutiliza el catálogo del Módulo 10, ya en este mismo Sheet — sin duplicar.

**`Gastos_JC` existente se extiende con una columna `Tipo`** (`Producto` / `Insumo`). Filas viejas sin este dato se tratan como `Producto` (comportamiento actual, sin romper nada). Una fila `Insumo` guarda directamente el nombre/código del insumo en la columna que hoy es `Producto`, y `generarReporteInsumos` la resta directo del insumo en vez de resolverla por receta.

### Backend (Apps Script de Inventario) — acciones nuevas

- `abrir_caja(fecha, base_apertura, abierto_por)` — guarda/confirma la base del día.
- `registrar_gasto_caja(fecha, concepto, monto, registrado_por)`
- `registrar_pago_empleado_caja(fecha, empleado, monto, registrado_por)`
- `registrar_recogida_caja(fecha, quien, monto, registrado_por)`
- `registrar_dano(fecha, tipo, nombre, cantidad, motivo, registrado_por)` — internamente hace `appendRow` en `Gastos_JC` con el `Tipo` correspondiente (Producto o Insumo).
- `resumen_dia_caja(fecha)` — trae Venta_Total/Nequi/Tarjeta leyendo cruzado `Ventas` del Menú (`Estado='Pagado'`, agrupado por `Metodo_Pago`), suma lo ya registrado en `Gastos_Caja`/`Pagos_Empleados_Caja`/`Recogidas_Caja` del día, y calcula `Nueva_Base_Esperada` con la fórmula.
- `cerrar_caja(fecha, efectivo_contado, cerrado_por)` — recalcula el resumen, guarda la fila definitiva en `Cuadre_Caja` con `Faltante_Sobrante = efectivo_contado − nueva_base_esperada`.

`generarReporteInsumos` se ajusta para leer también las filas `Tipo=Insumo` de `Gastos_JC` y restarlas directo del insumo correspondiente (sin receta), además de lo que ya hace con `Tipo=Producto`.

### Frontend — `cuadre.html` (mismo patrón estático que `inventario.html`/`empleados.html`)

Tres momentos, un solo archivo:

1. **Abrir caja**: muestra la base sugerida (el `Efectivo_Contado` del `Cuadre_Caja` de ayer), el cajero la confirma o la ajusta, se guarda con `abrir_caja`.
2. **Registrar durante el día**: 4 formularios rápidos (Gasto / Pago a empleado — selector del catálogo `Empleados` / Recogida / Daño — con selector Producto o Insumo).
3. **Cerrar caja**: pantalla de resumen (todo automático + lo ya registrado), campo para el efectivo contado, muestra el faltante/sobrante calculado, botón para confirmar el cierre (`cerrar_caja`).

### Manejo de errores

- Si se intenta cerrar sin haber abierto ese día, se avisa y se pide abrir primero (no se asume nada en silencio).
- Igual que el resto del proyecto: cada acción de guardado espera confirmación `ok:true` del backend antes de actualizar la pantalla; si falla, se muestra el error y no se pierde lo digitado.

## Dependencias

- Depende de Módulo 9 (Caja) para `Metodo_Pago` en `Ventas` — ya existe y está desplegado.
- Depende de Módulo 10 (Ficha de Empleados) para el selector de Pagos a empleados — Módulo 10 está construido pero **todavía no desplegado en vivo** (ver `ESTADO.md`); si no está disponible, el selector cae a texto libre (mismo patrón de degradación que ya usa `menu.html`/`inventario.html` con Empleados).
- Alimenta al Módulo 5 (Inventario): los daños quedan reflejados en el reporte de faltantes/sobrantes sin margen de tolerancia (decisión ya confirmada en esa sesión — un daño explica un faltante puntual, no lo esconde).
- Alimenta al Módulo 7 (Panel administrativo, pendiente): el histórico de `Cuadre_Caja` es una fuente natural para reportes de caja día a día.

## Qué falta

- **Publicar `cuadre.html` en el hosting real** — está construido y verificado en backend, pero no disponible en URL pública todavía.
- **Uso real de prueba con el cajero durante unos días** — confirmar que el faltante/sobrante calculado coincide con lo que el equipo ya sabe del libro físico, y que el flujo de registrar gastos/pagos/recogidas/daños durante el día es cómodo de usar.
- **Corrección de un cierre ya hecho el mismo día**: resuelto en el diseño. `cerrar_caja` sobrescribe la fila de `Cuadre_Caja` correspondiente a esa fecha (no append) — si se dan cuenta de un error después de cerrar y llaman `cerrar_caja` de nuevo con el `efectivo_contado` corregido, la fila se actualiza con los nuevos cálculos.
- **Hallazgo menor (code review, no es defecto funcional):** cuando el catálogo de `Empleados` está vacío, `cuadre.html` muestra un `<select>` con solo placeholder (no permite texto libre), a diferencia de otros campos de empleado en el proyecto (`menu.html`, `inventario.html`) que sí caen a texto libre si no hay empleados. Esto es cosmético — el usuario debe poblar `Empleados` antes de poder usarlo.
- **Hallazgo cosmético (code review):** en `listarRegistrosDiaCaja_`, el campo `tipo` de un daño Insumo se obtiene directo de la celda sin `.trim()`, así que si hay espacios antes/después quedan visibles. No afecta cálculos, solo la apariencia en pantalla — se puede corregir cuando se redeploye por otra razón.
