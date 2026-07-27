# Módulo 5 — Inventario

## Objetivo
Que cada venta descuente automáticamente los ingredientes según las recetas, enlazado con el inventario, y que sirva para cualquier tipo de comida rápida (no solo el menú actual).

## Funcionalidades (del plan original)
- Descuento automático de ingredientes por venta, según receta.
- Enlazar con el inventario existente.
- Debe servir de forma genérica para cualquier tipo de comida rápida.

## Qué ya existe
Este es el módulo con **más base ya construida**: `INVENTARIO DONDE EL GORDO.xlsx` ya tiene:
- `Recetas` — probablemente ya relaciona productos con insumos.
- `Insumos` — catálogo de insumos base.
- `Inventario` / `Inventario_Insumos` — existencias.
- `Ventas`, `Ingresos`, `Gastos_JC`, `Log_Envios`, `Reporte`, `AREAS`, `Productos` — el resto del sistema de inventario/finanzas ya en uso operativo, separado hoy del menú digital.

## Revisado a fondo el 2026-07-16 — ya está construido como app separada
`inventario.html` (frontend) + `Code.gs` (backend, en `E:\Descargas\MENU\DONDE EL GORDO\Code.gs`) son una aplicación completa y funcional, probada con Playwright:
- Conteo físico por área (Pizzero, Cocina, Parrilla, Neveras), con conversión automática paquete/gramaje/unidades según el tipo de producto.
- Pantalla de Ingresos de mercancía y pantalla de Tirilla de Ventas (registro manual desde el recibo de caja).
- **Reporte de Faltantes/Sobrantes**: motor de cruce en `generarReporteInsumos(fecha)` — Había ayer (cierre de ayer) + Ingreso − Gasto (por receta × ventas del día) − Gasto J/C (consumo autorizado manual) = Debe haber, comparado contra Existe real (cierre de hoy) → FALTO / SOBRÓ / BIEN / SIN CONTEO por insumo. Escribe además una bitácora diaria en `Inventario_Insumos` y una pestaña `Reporte` con resumen y gráfico.
- Código revisado línea por línea: no se encontraron bugs. No se reescribió nada — no hacía falta.

**Estructura de `Recetas` confirmada:** columnas A=Código_Producto, B=(descriptivo, no usado por el cálculo), C=Código_Insumo, D=Cantidad.

## Campos y hojas — qué es automático y qué le corresponde al usuario crear/llenar a mano
Hojas que el script YA CREA solas si faltan (`Inventario`, `Ingresos`, `Ventas` propia de este Sheet, `Log_Envios`, `Inventario_Insumos`) — no requieren trabajo manual de estructura, solo empezar a usarlas desde las pantallas de la app. La pestaña `Reporte` también la administra el script por completo, salvo la celda **Q6 ("Sobra/Falta")**, dejada a propósito en blanco para que el dueño la anote a mano tras revisar.

Hojas que deben existir y estar llenas de antemano (catálogo base, no las crea el script):
- **`Insumos`**: A=Código, B=Nombre, C=Unidad.
- **`Hoja 1`** (catálogo de conteo físico, el que ya alimenta las 4 áreas de `inventario.html`): columnas A–D = marca de área (hasta 4), E=Producto, F=Presentación, G=Gramaje (ej. "500 GM"), H=Unidades (ej. "10 UNIDADES" o "UNIDAD").
- **`Recetas`**: A=Código_Producto, B=(libre/descriptivo), C=Código_Insumo, D=Cantidad.
- **`Productos`**: A=Código, B=Nombre, C=Categoría, D=Precio.
- **`Gastos_JC`**: A=Fecha, B=Producto (nombre), C=Cantidad, D=Autorizado_Por, E=Motivo — **100% manual**, no tiene pantalla en la app; Jaime/Clemencia la llenan directo en el Sheet cada vez que se retira o consume algo fuera de una venta normal (mermas, comida del personal, etc.).

Recordatorio operativo importante: el cruce "había ayer vs. existe real" solo funciona si el conteo de cierre del día se envía con **Turno = Cierre** (no Apertura ni Mediodía) desde la pantalla "Revisar y Enviar Inventario". Si nunca se usa ese turno, el reporte queda en ceros.

## Resuelto (2026-07-16): Inventario y Menú Digital quedaron integrados, la venta se registra sola
El usuario confirmó que quiere automatizar esto — toda venta (Domicilio o En el local) debe registrarse sola, sin depender de que alguien re-digite la tirilla, aunque la tirilla se deja como alternativa manual (mencionó resistencia al cambio en el equipo). Cambios hechos:
- `menu.html`: Domicilio ahora también llama `crear_pedido` (antes solo mandaba WhatsApp y no tocaba el sistema). "En el local" ya lo hacía desde el Módulo 2.
- `Code.gs` (`SHEET_ID` = `1BpzdVNZtBnzbqqPq9aiPrDKtNo386b8H33v0LaJyJYA`) ahora lee Ventas de **dos** Sheets: el suyo propio (tirilla) y el del menú digital (`MENU_SHEET_ID` = `1WIltJ3wSxGu9VQDGmnj5Lx9uXqUfWjA7Q9aKcZK32ak`, ver `00-PLAN-MAESTRO.md`), resolviendo el producto por nombre para las ventas del menú (que no traen código) contra la propia hoja `Productos` de este Sheet — mismo mecanismo que ya usaban los Gastos J/C.
- **Riesgo a vigilar:** si la misma venta se registra por los dos caminos el mismo día, se cuenta doble — la tirilla debe usarse solo para ventas que no pasaron por el menú digital. Y si los nombres de producto no coinciden exactamente entre los dos catálogos `Productos`, esa venta puntual no descuenta insumos (falla en silencio) — revisar la primera vez que se corra con ventas reales del menú.

## Qué falta
- Alertas de insumos agotados o bajo mínimo (mencionado indirectamente en Módulo 7 como "Productos agotados").

## Dependencias
- Depende de que el Módulo 2 registre ventas/pedidos confirmados.
- Alimenta al Módulo 7 (reportes de productos agotados, costos).
