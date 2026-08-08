# Corte X — snapshot registrado de ventas para validar contra inventario físico

**Fecha:** 2026-08-08
**Estado:** Diseño aprobado, pendiente de implementación

## Problema

El equipo (Jaime y los demás cajeros) ya hace un cruce manual varias veces al día: sacan una "X" (reporte de todo lo vendido hasta el momento) desde el punto de venta físico, restan contra el inventario del día anterior, y comparan contra lo que cuentan físicamente. Cuando algo no cuadra en cantidad pero sobra plata, hoy simplemente lo registran como cuadrado sin dejar rastro de la diferencia real — el dueño no está de acuerdo con esa práctica ("se nos olvidó registrar" no es una explicación verificable), pero no hay ninguna forma de saber, después del hecho, qué se comparó, cuándo, y quién estaba a cargo.

El sistema ya tiene toda la lógica para calcular "cuánto se debería haber vendido" (`generarReporteInsumos`), pero está pensada para el cierre diario completo (Módulo 5/11), no para una consulta rápida y repetible durante el turno.

## Objetivo

Darle al cajero un botón para generar, en cualquier momento del día, un corte impreso/PDF de lo vendido hasta ese instante — acumulado desde el inicio del día, como una caja registradora real — quedando registrado oficialmente quién lo generó y a qué hora. El conteo físico y la comparación siguen siendo manuales (fuera de alcance de esta primera versión), pero ya no hay forma de negar qué decía el sistema en ese momento exacto.

## Decisiones confirmadas con el usuario

- **Formal, no solo papel**: cada corte queda registrado en el Sheet (no es un cálculo efímero en pantalla que se pierde).
- **Bajo demanda, cuantas veces quieran** en el día — no una hora fija.
- **Acumulado desde el inicio del día** en cada corte (no "desde el corte anterior") — para que sea comparable 1:1 contra el inventario del día anterior, igual que ya hacen a mano.
- **No pide conteo físico ni calcula falta/sobra automático** — el corte solo muestra "lo que el sistema dice que se vendió"; la comparación contra lo contado sigue siendo manual, como hoy.
- **Cualquier cajero puede generarlo** en su propio turno (no solo Admin) — la responsabilidad se rastrea por quién lo generó, no por restringir quién puede.
- **El cajero se identifica eligiendo su nombre del catálogo Empleados** (mismo patrón ya usado en `asesorventas.html` para meseros) — hoy el login de Cajero/Admin es de clave compartida, así que sin esto no hay forma de saber si fue Jaime o Clemencia quien generó un corte específico.
- **Vive en `cuadre.html`**, junto a Abrir/Cerrar caja — es la pantalla de reconciliación que ya habla con el backend de Inventario.
- **"PDF" = imprimir con el navegador** (como ya hacen los recibos de `caja.html`) y desde ahí "Guardar como PDF" — no se agrega ninguna librería de generación de PDF.

## Arquitectura

```
cuadre.html                     Apps Script de Inventario           Sheet de Inventario
─────────────                   ────────────────────────           ────────────────────
"Generar Corte X" ────GET──────► generar_corte_x(fecha, horaCorte,   lee Ventas (propio Sheet
                                  generadoPor)                       + Sheet del Menú, mismo
                                     │                                cross-read que ya usa
                                     ├─ suma por producto            generarReporteInsumos)
                                     ├─ totales por método de pago
                                     ├─ totales por canal
                                     └─ agrega fila a Cortes_X ──────► hoja nueva Cortes_X
                                  ◄── responde JSON con el detalle
Muestra en pantalla + botón
"Imprimir" (window.print())
```

### Backend — nueva acción `generar_corte_x`

- **Parámetros**: `fecha` (por defecto hoy), `horaCorte` (timestamp del momento en que se genera — por defecto "ahora"), `generadoPor` (nombre elegido de Empleados, o texto libre si el catálogo falla).
- **Filtro clave para que el corte sea reproducible después**: solo filas de `Ventas` con `Fecha = fecha`, `Estado = Pagado`, y `Hora <= horaCorte`. Esto es lo que hace que un corte generado a las 2pm siga mostrando exactamente lo mismo si se vuelve a consultar más tarde, aunque para entonces ya haya más ventas del día — es un instante congelado, no un cálculo que cambia con el tiempo.
- **Fuente de datos**: mismo patrón de lectura cruzada que `generarReporteInsumos` — Ventas del Sheet propio de Inventario (tirilla) + Ventas del Sheet del Menú (`MENU_SHEET_ID`), agrupando por nombre de producto. Si el Sheet del Menú no responde, el corte sigue con lo que sí pudo leer (mismo criterio de tolerancia a fallos ya usado en el resto del proyecto) y lo indica en la respuesta.
- **Agrupaciones devueltas**:
  - Por producto: cantidad vendida y $ total.
  - Por método de pago: Efectivo / Nequi / Tarjeta (de `Metodo_Pago`, columna ya existente desde el Módulo 9).
  - Por canal: Mesa / Domicilio / Mostrador (de `Tipo_Pedido`, columna ya existente).
- **Registro**: agrega una fila a la hoja nueva `Cortes_X` (`Fecha`, `Hora`, `Generado_Por`, `Total_Venta`) — creada con `getOrCreateSheet` si no existe, mismo patrón que `Gastos_JC`/`Cuadre_Caja`. Solo guarda el resumen (no el detalle producto por producto) porque el detalle siempre se puede reconstruir llamando la misma acción con la misma `fecha`+`horaCorte` — evita duplicar datos que ya están en `Ventas`.

### Frontend — `cuadre.html`

- Botón nuevo "📋 Generar Corte X" en la pantalla principal, junto a Abrir/Cerrar caja.
- Si no hay un nombre de cajero ya elegido en la sesión (`localStorage`, mismo patrón que otras pantallas), pide seleccionar de la lista de `listar_empleados` antes de continuar. Si el catálogo está vacío o falla, cae a un campo de texto libre (no bloquea la operación) — igual que ya hacen `menu.html`/`inventario.html` con Responsable/Quién trae/Quién recibe.
- Muestra el resultado: lista de productos con cantidad y $, totales por método de pago, totales por canal, hora exacta del corte y quién lo generó.
- Botón "Imprimir" con una regla `@media print` dedicada (mismo mecanismo que el recibo de 80mm de `caja.html`) — desde el diálogo de impresión del navegador el cajero puede elegir impresora física o "Guardar como PDF".

## Manejo de errores

- Sheet del Menú no responde → el corte se genera igual con lo que sí pudo leer, con un aviso visible de qué parte pudo faltar (no se rompe la pantalla).
- Catálogo de Empleados vacío o falla → cae a texto libre para el nombre del cajero, con aviso de que conviene poblarlo (hoy solo tiene a "Jaime Garzon" registrado — pendiente operativo del usuario, no de este build).
- Sin ventas pagadas todavía ese día → el corte se genera igual, mostrando todo en cero, no un error.

## Fuera de alcance (deliberado)

- No pide ni guarda el conteo físico, ni calcula falta/sobra automático — sigue siendo comparación manual, tal como se confirmó con el usuario.
- No genera un archivo PDF real — usa impresión del navegador.
- No cambia el login compartido de Cajero/Admin ni crea cuentas individuales — la identificación es solo por nombre elegido al momento de generar el corte, no un login nuevo.
- No envía el corte por WhatsApp ni ningún canal automático.

## Pendiente operativo del usuario (no bloquea el build)

- Poblar el catálogo de Empleados (`empleados.html`) con el personal real de caja (Clemencia y los demás) — hoy solo tiene un registro.
