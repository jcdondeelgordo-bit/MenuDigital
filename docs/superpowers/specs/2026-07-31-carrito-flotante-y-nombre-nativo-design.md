# Carrito flotante + campo de nombre nativo — diseño

## Contexto

En la primera prueba real con clics de "Venta Rápida" (`caja.html`), el usuario encontró que el
campo de texto para el nombre del cliente en "Cobrar y dejar para recoger" nunca activa el teclado
en su dispositivo (Android Chrome). Dos intentos de arreglo fallaron:

1. `user-select:text` en inputs (commit `cfbe27c`) — no resolvió nada.
2. `.focus()` después del `alert()` de validación (commit `d592740`) — tampoco resolvió nada.

El usuario pidió no seguir parchando a ciegas: reescribir esa parte del flujo. De paso, pidió que
el carrito de Venta Rápida deje de moverse con el scroll del catálogo y se convierta en un ícono
pequeño y fijo tipo "carrito de supermercado" en el lado izquierdo — y que el mismo tratamiento se
aplique también al carrito de `menu.html` (la app que usan los clientes en la mesa), reemplazando
tanto la barra fija de abajo (celular) como el panel lateral fijo (pantallas anchas) que ya existen
ahí hoy.

## Alcance

Dos cambios independientes, ambos dentro de pantallas ya existentes. Cero cambios de backend/Apps
Script — ninguna de las dos partes toca `crear_pedido` ni ninguna otra acción ya desplegada.

- **A. Campo de nombre en Venta Rápida (`caja.html`)** — reemplazar el `<input>` propio por el
  cuadro de texto nativo del navegador (`prompt()`).
- **B. Carrito flotante consistente** — en `caja.html` (Venta Rápida) y en `menu.html` (los tres
  tamaños de pantalla), reemplazar el carrito actual por un botón circular pequeño y fijo (ícono
  🛒 + contador + total) abajo a la izquierda, que no se mueve con el scroll.

**Fuera de alcance, explícitamente:** el campo `#input-nombre-persona` de "Dividir cuenta" en
`caja.html` no se toca — ya funciona bien en el dispositivo del usuario hoy, y tocar algo que
funciona no tiene beneficio claro aquí.

## A. Campo de nombre — Venta Rápida

- Se elimina el `<input type="text" id="vr-nombre">` del `.panel-vr` y la línea que lo limpia en
  `cerrarVentaRapida()`.
- `iniciarCobroVentaRapida(entregarYa)`:
  - Si `entregarYa` es `true` ("Cobrar y entregar"): sin cambios de comportamiento, el nombre sigue
    siendo `''` (nunca lo necesitó).
  - Si `entregarYa` es `false` ("Cobrar y dejar para recoger"): se llama
    `const nombre = (prompt('Nombre del cliente para recoger su pedido:') || '').trim();`. Si el
    cajero cancela el diálogo (`prompt` devuelve `null`) o deja el nombre vacío/solo espacios, la
    función retorna sin crear el pedido — el carrito no se pierde, el cajero puede volver a tocar el
    botón para reintentar. No hace falta un `alert()` adicional: el propio flujo de `prompt()` ya
    cubre el caso de "no escribiste nada".
- El resto de `iniciarCobroVentaRapida`/`confirmarCobroVentaRapida` (crear pedido, guardar
  `mesa: nombre`, modal de método de pago, snapshot para el recibo) queda igual — solo cambia el
  origen del valor `nombre`.

**Por qué este enfoque y no otro parche de CSS/JS:** dos intentos dirigidos al `<input>` personalizado
ya fallaron. `prompt()` es el cuadro de diálogo nativo del propio navegador — el mismo mecanismo que
usa el navegador para sus propios diálogos — así que el teclado depende del navegador, no de nuestro
CSS/JS. Elimina la causa raíz de raíz en vez de seguir adivinando qué la está bloqueando.

## B. Carrito flotante

### Estructura común (mismo patrón visual en ambos archivos)

- Botón fijo: `position:fixed; bottom:16px; left:16px;`. `z-index:30` en ambos archivos — mismo
  valor que ya usa `.carrito-flotante` en `menu.html` hoy, por encima del `header` (z-index 20) pero
  por debajo de cualquier overlay/modal (z-index 40 en adelante en ambos archivos).
- Contenido del botón: ícono 🛒, una insignia con la cantidad de items, y el total ($) — mismo dato
  que hoy muestran `#vr-total`/`#carrito-flotante-total`, solo reposicionado.
- Oculto cuando el carrito está vacío (mismo criterio que el `.carrito-flotante` actual de
  `menu.html`, que ya hace esto — se reutiliza, no se reinventa).
- Al tocarlo: abre el mismo panel/overlay de detalle que ya existe hoy en cada pantalla (lista de
  items con sus controles +/-, total, botón(es) de checkout). El contenido de ese panel no cambia —
  solo cambia el disparador que lo abre.

### `caja.html` (Venta Rápida)

- El bloque de carrito (`#vr-carrito`, `#vr-total`, botones "Cobrar y entregar"/"Cobrar y dejar
  para recoger") deja de vivir en el flujo de scroll de `.panel-vr` junto al catálogo. Pasa a vivir
  dentro del panel que despliega el nuevo ícono flotante.
- El catálogo de productos (categorías + lista) ocupa el modal principal; el ícono flotante vive
  fuera de ese scroll, siempre visible y en la misma posición.

### `menu.html` (las tres versiones de pantalla)

- Se elimina la distinción actual entre `.carrito-flotante` (barra fija abajo, solo celular) y
  `.carrito-sidebar` (panel fijo a la derecha, solo pantallas anchas vía media query). Se reemplazan
  ambas por el mismo ícono flotante pequeño en todos los tamaños de pantalla — un solo camino de
  código en vez de dos versiones paralelas.
- El panel que se abre al tocar el ícono reutiliza el contenido/lógica ya existente de
  `panel-carrito`/`carrito-sidebar-body` (lista de items, observaciones, total, checkout de
  Domicilio/En el local) — no se rediseña ese contenido.

## Manejo de errores / casos borde

- **`prompt()` cancelado o vacío**: aborta el cobro sin crear pedido; carrito intacto.
- **Carrito vacío**: ícono flotante oculto; validaciones existentes ("Agrega al menos un producto")
  se mantienen como red de seguridad.
- **`menu.html` pantalla ancha**: al quitar el sidebar fijo, el catálogo pasa a ocupar todo el ancho
  disponible — verificar que no queden huecos en blanco donde vivía el sidebar viejo.
- **Recibo impreso**: sin cambios — sigue generándose igual; solo cambia de dónde sale el nombre y
  cómo se ve el carrito antes de cobrar.

## Plan de verificación

- `node --check` sobre el JS embebido de `caja.html` y `menu.html` tras cada cambio.
- Revisión de código enfocada en: que el ícono flotante no se solape con otros elementos fijos
  (header, modales), que el conteo/total se actualicen en los mismos puntos donde hoy se actualiza
  el carrito, y que no quede código muerto del sidebar/input viejo.
- `WebFetch` de las páginas ya publicadas tras el deploy, para confirmar que el HTML/JS servido es
  el esperado (descarta problemas de caché/deploy, no reemplaza la prueba real).
- **Limitación explícita de esta sesión**: no hay navegador interactivo disponible (sin Playwright ni
  MCP de navegador) para hacer clic/escribir en la página en vivo. Aunque lo hubiera, el teclado
  virtual de Android es una función del sistema operativo del dispositivo, no algo que un navegador
  automatizado en una computadora pueda mostrar de verdad. La prueba que confirma el fix del teclado
  y el aspecto visual del ícono flotante la hace el usuario en su dispositivo real, al final.
