# Carga de datos reales de julio 2026 y validación de inventario — Diseño

Fecha: 2026-08-05

## Contexto y problema

El usuario tiene datos reales de ventas e inventario del restaurante para julio 2026 completo
(`E:\Proyectos ZFood GyP\PRUEBA\Ventas_Inventario_Julio2026.xlsx`, hojas `Ventas` y `Inventario`) y
quiere hacer una prueba completa del sistema ZFood GyP en producción (`https://donde-el-gordo.vercel.app/`):
cargar ese mes real, ejercitar los flujos de Domicilio y Venta Rápida, y poder sacar el reporte de
inventario para confirmar que todo funciona y que los números cuadran contra lo que él ya sabe que
pasó ese mes.

## Hallazgo técnico clave (cambia el enfoque original)

El backend del Menú Digital (`crearPedido` en el Apps Script, acción `crear_pedido`, usada por
Domicilio/Venta Rápida/Mesa) graba siempre `Fecha = new Date()` — **no acepta una fecha histórica**.
`listarPedidosCaja`, `liberarMesa`, `estadoMesa` también filtran estrictamente por "hoy". Por lo
tanto, no es técnicamente posible repartir el volumen real de julio entre mesa/domicilio/mostrador
pasando por `crear_pedido`: esos pedidos quedarían fechados hoy (5 de agosto de 2026), mezclados con
la operación real del día.

En cambio, el backend del Inventario (`Code.gs`, proyecto separado, `SHEET_ID =
1BpzdVNZtBnzbqqPq9aiPrDKtNo386b8H33v0LaJyJYA`) sí acepta fecha arbitraria en sus acciones de
guardado (`guardar_ventas`, `guardar_ingreso`, `guardar_inventario_completo`) y en la lectura del
reporte (`generarReporteInsumos(fecha)`). Esta vía es además la misma que ya usa la pantalla
"Tirilla de Ventas" — pensada exactamente para cargar cantidad agregada por producto y día, sin
importar el canal de venta.

**Consecuencia para el diseño:** se separa el trabajo en dos entregables independientes.

## Entregable 1 — Carga histórica de julio + validación de inventario

### Alcance

Cargar los 31 días de julio (Ventas, Ingresos, Conteo físico de cierre, Gastos_JC) al Sheet real de
Inventario vía las acciones de su Apps Script, y comparar el reporte que calcula el sistema
(`generarReporteInsumos`) contra los valores de referencia del archivo del usuario, día por día.

### Verificado antes de diseñar

- El Sheet productivo de Inventario está vacío para julio hoy (`reporte_insumos` para 2026-07-01
  devuelve todo en cero / `SIN CONTEO`) — sin riesgo de duplicar o pisar datos existentes.
- Los códigos de producto de la hoja `Ventas` del archivo calzan exactamente contra el catálogo
  `Productos` del Sheet de Inventario (verificado por código, no por nombre — cruce robusto).
- 1457 pares día/insumo de "Existe real → Había ayer del día siguiente" se revisaron en el propio
  archivo del usuario: 18 no coinciden exactamente (redondeos/correcciones de conteo físico manual,
  normal). Se reportan aparte, no se tratan como error del sistema.

### Mapeo de datos (confirmado con el usuario)

- `QUESO` (archivo) → insumo existente `QUESO PIZZA`.
- `COLA Y POLA 330` (archivo) → insumo existente `COLA Y POLA LATA`.
- `PIZZAS` (archivo) → **se excluye de la carga**. Es un cálculo de control propio del usuario
  (cuántas porciones de pizza se hicieron, para cruzar contra masas hechas), no un insumo del
  sistema.
- El resto de insumos y productos cruzan 1:1 por nombre/código sin ajuste.

### Cambio de backend necesario — corrección tras releer el `Code.gs` real

**Actualización 2026-08-05, antes de planear la ejecución:** al releer el archivo real
`E:\Descargas\MENU\DONDE EL GORDO\Code.gs` (que ya incorpora el Módulo 11 — Cuadre de Caja,
desplegado después de que se armó el espejo de referencia usado para diseñar esto) se confirmó que
**no hace falta agregar ninguna acción nueva**. Ya existe `registrar_dano(fecha, nombre, cantidad,
registradoPor, motivo, tipo)`, que escribe directo en `Gastos_JC` (mismas 6 columnas que necesitamos:
`Fecha, Producto, Cantidad, Autorizado_Por, Motivo, Tipo`) y que `generarReporteInsumos` ya sabe leer:
con `tipo='Insumo'` resta la cantidad directo del insumo indicado (por nombre, resuelto igual que el
resto del cruce), sin pasar por receta — que es exactamente el caso de los 105 registros de `J/C` del
archivo, ya que en la hoja `Inventario` del archivo cada valor de J/C está asociado a un **insumo**
(columna INSUMO), no a un producto del menú.

Se descarta entonces el plan original de agregar `guardar_gastos_jc` al `Code.gs` — la carga de
Gastos_JC se hace con la acción `registrar_dano` ya desplegada, una llamada por cada fila (fecha,
insumo) con valor J/C distinto de cero, con `tipo='Insumo'`. **Cero cambios de backend para el
Entregable 1** — se elimina el riesgo de editar/republicar el Apps Script en producción antes de
cargar.

### Secuencia de carga (por día, 1 al 31 de julio)

1. Traer una vez el catálogo `Productos` (`get_productos`) para resolver precio unitario por código,
   y el catálogo de insumos (`reporte_insumos` de cualquier fecha ya trae código/nombre/unidad) para
   resolver unidad por nombre.
2. Por cada día:
   - `guardar_ventas`: items desde la hoja `Ventas` del archivo (código, nombre, cantidad, precio
     unitario resuelto del catálogo). Acción ya es "borra y reescribe" esa fecha — se puede reintentar
     sin duplicar.
   - `guardar_ingreso`: items desde la columna INGRESO > 0 de la hoja `Inventario` del archivo. Esta
     acción **suma** en vez de reemplazar — se envía cada día una sola vez.
   - `guardar_inventario_completo` con `turno=CIERRE`: items desde la columna EXISTE REAL de la hoja
     `Inventario` del archivo, fechado ese mismo día.
   - `registrar_dano` (ya existente, `tipo='Insumo'`): una llamada por cada fila de la columna J/C
     de la hoja `Inventario` del archivo con valor distinto de cero.
3. Antes del día 1 de julio, se envía un `guardar_inventario_completo` adicional fechado 30 de junio
   con `turno=CIERRE`, usando los valores de HABIA AYER del 1 de julio del archivo — así el primer
   día del mes tiene de dónde arrastrar su "había ayer" sin depender de datos que no existen.

### Validación

Para cada uno de los 31 días, tras cargar sus datos se llama `reporte_insumos` (la misma acción que
usa la app) y se compara contra el archivo de referencia, insumo por insumo:
- **Gasto** (calculado por receta × ventas — el corazón del motor) y **Debe Haber** (resultado final)
  son los campos que realmente prueban que el cálculo funciona bien.
- Se produce un reporte final: cuántos coinciden exactamente, cuáles no y por qué (ej. receta
  faltante, insumo sin conteo), y las 18 inconsistencias ya detectadas en el archivo original,
  señaladas aparte.

### Riesgos / advertencias

- Se escribe directo en el Sheet productivo de Inventario (no hay ambiente de pruebas separado).
- La pestaña `Reporte` del Sheet se sobrescribe en cada `reporte_insumos` — al terminar, quedará
  mostrando el 31 de julio. **Decisión del usuario: se deja así**, no se regenera para hoy.
- `guardar_ingreso` sin cuidado podría duplicar cantidades si se reenvía el mismo día dos veces — el
  script de carga controla esto enviando cada día una sola vez y registrando qué días ya se cargaron.

## Entregable 2 — Prueba en vivo de Domicilio y Venta Rápida (hoy)

### Alcance

Como estos flujos son inherentemente "de hoy" (ver hallazgo técnico), se prueban con pedidos reales
o de prueba fechados hoy (5 de agosto de 2026), no con el volumen histórico de julio.

### Cómo se ejecuta

No hay navegador disponible en este entorno (confirmado, mismo patrón que el resto del proyecto).

**Actualización 2026-08-05:** al revisar `api/proxy-menu.js` (único camino de producción hacia el
Apps Script del Menú Digital desde que se blindó el `SCRIPT_URL`, ver `PERMISOS` en ese archivo) se
confirmó que `crear_pedido` es público, pero `marcar_pedido_pagado` y `liberar_pedido` exigen una
sesión de cajero (clave real, guardada como variable de entorno en Vercel) — no es información que
deba pedirse por chat. Se ajusta el reparto de trabajo: se crean los pedidos de prueba (uno
Domicilio, uno Venta Rápida) por curl contra `https://donde-el-gordo.vercel.app/api/proxy-menu`
(acción pública, fechados hoy), y el usuario entra a `caja.html` con su clave real para cobrar y
liberar/entregar cada uno. Al final, se confirma junto con el usuario que los pedidos aparecen
correctamente (sección Domicilio, sección "Para recoger", comanda de cocina con la etiqueta
correcta).

## Fuera de alcance

- No se modifica el comportamiento de `crear_pedido` para aceptar fecha histórica — no hay necesidad
  real de backdatear pedidos operativos, y hacerlo abriría riesgo de contaminar las pantallas de
  operación del día si algo sale mal.
- No se automatiza `Gastos_JC` con una pantalla propia — la acción nueva de Apps Script es solo para
  esta carga; seguirá siendo de captura manual en el Sheet como hoy, salvo que el usuario pida una
  pantalla dedicada más adelante.
