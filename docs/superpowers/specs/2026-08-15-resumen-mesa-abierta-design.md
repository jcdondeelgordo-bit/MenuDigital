# Resumen de lo ya pedido al reabrir una mesa ocupada — menu.html

**Fecha:** 2026-08-15
**Estado:** Diseño aprobado, pendiente de implementación

## Problema

Cuando un mesero abre una mesa que ya está siendo atendida (por él mismo o por otro mesero, vía QR o vía "Asesor de Ventas"), `menu.html` siempre arranca con un carrito vacío — no muestra nada de lo que ya se pidió hoy en esa mesa. El mesero queda "a ciegas": no sabe si está a punto de duplicar un producto ya pedido, y el dueño teme que eso confunda al cajero al momento de cobrar (no cobrar todo, o creer que hay un pedido doble).

Al revisar el código se confirmó que **el cobro en sí ya está bien resuelto**: `renderDetalleMesa()` en `caja.html` combina automáticamente todas las rondas de una mesa en un solo total y un solo botón "Cobrar" (línea 1029-1060), así que no existe hoy riesgo real de "no cobrar todo". El hueco real es de visibilidad del lado del mesero al momento de pedir, no del cajero al momento de cobrar.

## Decisión de arquitectura confirmada con el usuario

**No se fusionan las rondas en un solo pedido.** Se evaluaron 2 opciones:

- **Fusionar todo en un solo `ID_Pedido` que crece con cada ronda** — descartada. `cocina.html` muestra un ticket por pedido, con su propio reloj de urgencia y su propio botón "Marcar completo". Si una ronda ya se marcó completa/entregada y luego se le agregan productos al mismo ID_Pedido, ese ticket "revive" en cocina mezclando lo viejo servido con lo nuevo — la cocina pierde de vista qué ya se sirvió.
- **Cada ronda sigue siendo su propio pedido (elegida)** — `cocina.html`, `caja.html` y el backend (`crearPedido`, `marcarPedidoPagado`) no cambian en nada. Lo único que se agrega es que, al abrir una mesa ocupada, se vea claramente lo que ya se pidió hoy, para que se sienta como una sola cuenta continua aunque técnicamente sigan siendo rondas separadas por debajo.

## Arquitectura

```
menu.html (mesaQR presente, mesa abierta)
        │
        ▼
GET estado_mesa&mesa=N  (misma acción que ya existe, ahora devuelve más datos)
        │
        ▼
{ ok, abierta, mesero, items: [{producto, cantidad, total}, ...], total }
        │
        ▼
Banner fijo "🍽️ Ya llevas pedido en esta mesa" con la lista y el total,
visible mientras se navega el catálogo y se agrega más — antes y
durante, no solo como aviso de último momento al confirmar.
```

### Backend — `estadoMesa` (Módulo 1, `modulo-1-apps-script-nuevo.gs.txt`)

Se agrega una función nueva `obtenerResumenMesaAbierta_(hoja, mesa)` que recorre las filas de `Ventas` de HOY para esa mesa (mismo filtro que ya usa `buscarMeseroMesaAbierta`: excluye `Estado='Liberado'`), agrupando por nombre de `Producto` (sumando `Cantidad` y `Total` de todas las rondas juntas, para que se vea "2x Hamburguesa" en una sola línea en vez de repetida por cada ronda) y acumulando el total general.

`estadoMesa(e)` pasa de devolver `{ok, abierta, mesero}` a devolver también `items` y `total` (vacíos/0 si la mesa no está abierta). Es un agregado retrocompatible — nada que ya lea `abierta`/`mesero` se rompe.

### Frontend — `menu.html`

- **Banner nuevo** (`#resumen-mesa-actual`), justo debajo de `mesa-badge` (línea 134): título "🍽️ Ya llevas pedido en esta mesa", lista de items agregados y una línea de total en negrita. Oculto por defecto; solo se muestra si `abierta === true` y hay al menos un item.
- **Se carga una vez al iniciar la página**, dentro de `init()`, cuando `mesaQR !== null` (cubre tanto el flujo de QR solo como el de Asesor de Ventas, que siempre trae `mesa` en la URL) — así el mesero lo ve desde que entra al catálogo, no solo al llegar al checkout. Es una llamada nueva a `estado_mesa`, independiente de las que ya hacen `verificarMesa()`/`abrirFlujoLocalAsesor()` para su propia validación al confirmar — no se tocan esas funciones para no arriesgar el fix de mesero-por-QR de hoy.
- **Flujo 100% manual** (mesero escribe el número de mesa a mano, sin QR): `verificarMesa()` ya hace este mismo fetch cuando el cajero/mesero escribe el número; se extiende el texto de `mesa-nota` para incluir el resumen de items/total cuando `data.abierta`, reusando los mismos campos nuevos del backend — mismo dato, sin una segunda llamada nueva.

## Manejo de errores

- Si `estado_mesa` falla (sin conexión) o la mesa no está abierta, el banner simplemente no se muestra — nunca bloquea el pedido, mismo criterio que el resto de `menu.html`.
- Si el backend todavía no tiene el campo `items`/`total` (Apps Script viejo sin actualizar), el frontend trata su ausencia como lista vacía — no revienta.

## Fuera de alcance (deliberado)

- No cambia `cocina.html`, `caja.html`, ni el backend de `crearPedido`/`marcarPedidoPagado` — las rondas se siguen creando y cobrando exactamente igual que hoy.
- No permite editar ni cancelar lo ya pedido desde este banner — es informativo, de solo lectura.
- No agrega esta vista a `caja.html` (ya la tiene, combinada, en `renderDetalleMesa()`).
