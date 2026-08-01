# Carrito flotante + nombre nativo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el campo de nombre roto de Venta Rápida por un `prompt()` nativo, y unificar el
carrito de `caja.html` (Venta Rápida) y `menu.html` en un único ícono flotante pequeño y fijo
(abajo-izquierda) que no se mueve con el scroll, en todos los tamaños de pantalla.

**Architecture:** Cambios puramente de frontend (HTML/CSS/JS embebido) en dos archivos estáticos ya
existentes. Cero cambios de backend/Apps Script. Se reutiliza el contenido/lógica de los paneles de
carrito que ya existen hoy (`#vr-carrito` en Venta Rápida, `#panel-carrito-body` en menu.html) — solo
cambia qué los muestra/oculta y desde dónde se disparan.

**Tech Stack:** HTML/CSS/JS vanilla embebido en archivo único (sin build step, sin framework, sin
test runner). No hay suite de pruebas automatizadas en este repo — la verificación establecida en
este proyecto es `node --check` sobre el JS embebido + revisión de código + `grep` para confirmar que
no queden referencias muertas a IDs/clases eliminados. La prueba real de UX (teclado, aspecto visual)
la hace el usuario en su dispositivo al final — no hay navegador interactivo disponible en esta sesión.

## Global Constraints

- No tocar el backend/Apps Script — ninguna acción nueva, ninguna hoja nueva.
- No tocar `#input-nombre-persona` / la vista "Dividir cuenta" en `caja.html` — ya funciona.
- El contenido del panel de detalle del carrito (lista de items, +/-, observaciones, total, botón(es)
  de checkout) no se rediseña — solo cambia el disparador que lo abre/cierra.
- Cada tarea termina con `node --check` limpio sobre el JS del archivo tocado.
- Cada tarea es su propio commit.

---

### Task 1: `caja.html` — campo de nombre de Venta Rápida → `prompt()` nativo

**Files:**
- Modify: `caja.html` (HTML ~línea 204, JS ~líneas 636-651 y ~734-738)

**Interfaces:**
- Produces: `iniciarCobroVentaRapida(entregarYa)` sigue teniendo la misma firma y sigue dejando
  `nombreVentaRapida` listo para que `confirmarCobroVentaRapida` lo use exactamente igual que hoy —
  ningún otro archivo/tarea depende de cómo se obtiene `nombre` internamente.

- [ ] **Step 1: Confirmar el estado actual antes de tocar nada**

Run: `grep -n "vr-nombre" caja.html`
Expected (estado actual, antes del cambio):
```
204:    <input type="text" class="input-nombre" id="vr-nombre" placeholder="Nombre del cliente (obligatorio si va a recoger después)">
650:  document.getElementById('vr-nombre').value = '';
734:  const nombre = document.getElementById('vr-nombre').value.trim();
```

- [ ] **Step 2: Quitar el `<input>` del HTML**

En el bloque `<div class="overlay-vr oculto" id="overlay-vr">` (dentro de `.panel-vr`), borrar la línea:
```html
    <input type="text" class="input-nombre" id="vr-nombre" placeholder="Nombre del cliente (obligatorio si va a recoger después)">
```
El `<h3>🧾 Venta Rápida</h3>` pasa a preceder directamente a `<div class="vr-categorias" id="vr-categorias"></div>`.

- [ ] **Step 3: Quitar la limpieza del input en `cerrarVentaRapida()`**

Cambiar:
```javascript
function cerrarVentaRapida() {
  document.getElementById('overlay-vr').classList.add('oculto');
  carritoVentaRapida = [];
  itemsVentaRapidaSnapshot = [];
  idPedidoVentaRapida = null;
  document.getElementById('vr-nombre').value = '';
}
```
por:
```javascript
function cerrarVentaRapida() {
  document.getElementById('overlay-vr').classList.add('oculto');
  carritoVentaRapida = [];
  itemsVentaRapidaSnapshot = [];
  idPedidoVentaRapida = null;
}
```

- [ ] **Step 4: Reemplazar la lectura del input por `prompt()` en `iniciarCobroVentaRapida`**

Cambiar:
```javascript
  if (carritoVentaRapida.length === 0) { alert('Agrega al menos un producto al carrito.'); return; }
  const nombre = document.getElementById('vr-nombre').value.trim();
  if (!entregarYa && !nombre) {
    alert('Escribe el nombre del cliente para dejar el pedido pendiente de recoger.');
    document.getElementById('vr-nombre').focus();
    return;
  }
```
por:
```javascript
  if (carritoVentaRapida.length === 0) { alert('Agrega al menos un producto al carrito.'); return; }

  let nombre = '';
  if (!entregarYa) {
    nombre = (prompt('Nombre del cliente para recoger su pedido:') || '').trim();
    if (!nombre) return;
  }
```

- [ ] **Step 5: Verificar que no queden referencias muertas**

Run: `grep -n "vr-nombre" caja.html`
Expected: sin resultados (0 coincidencias).

- [ ] **Step 6: Verificar sintaxis del JS**

Run (desde la raíz del repo, con Node en PATH):
```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('caja.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
fs.writeFileSync('/tmp/check.js', scripts.join('\n'));
"
node --check /tmp/check.js
```
Expected: sin salida (sale limpio, exit code 0). En Windows con Git Bash, si `/tmp` no resuelve, usar
una ruta absoluta de Windows en su lugar (ej. `C:/Users/<usuario>/AppData/Local/Temp/check.js`).

- [ ] **Step 7: Commit**

```bash
git add caja.html
git commit -m "fix: replace broken name input in Venta Rapida with native prompt()"
```

---

### Task 2: `caja.html` — carrito de Venta Rápida como ícono flotante

**Files:**
- Modify: `caja.html` (CSS ~líneas 57-70, HTML ~líneas 201-219, JS ~líneas 636-651, 712-727, 781-826)

**Interfaces:**
- Consumes: `carritoVentaRapida` (array ya existente), `formatoCOP()` (ya existente).
- Produces: `abrirCarritoPanelVR()` / `cerrarCarritoPanelVR()` — nuevas funciones, sin consumidores
  fuera de este archivo. `renderCarritoVR()` mantiene su nombre y se sigue llamando desde los mismos
  puntos de hoy (`abrirVentaRapida`, `agregarAlCarritoVR`, `cambiarCantidadVR`) — su firma no cambia.

- [ ] **Step 1: Confirmar el estado actual del bloque de carrito en el HTML**

Run: `grep -n "vr-carrito\|vr-total\|division-seccion" caja.html`
Debe mostrar el bloque actual dentro de `.panel-vr` con `<h4>Carrito</h4>`, `#vr-carrito`,
`.division-subtotal` y `#vr-total`, seguido de los dos botones `onclick="iniciarCobroVentaRapida(...)"`.

- [ ] **Step 2: Sacar el bloque de carrito y los botones de cobro de `.panel-vr`, moverlos a un nuevo panel**

Dentro de `<div class="overlay-vr oculto" id="overlay-vr">`, el contenido de `.panel-vr` queda así
(solo catálogo + cancelar):
```html
<div class="overlay-vr oculto" id="overlay-vr">
  <div class="panel-vr">
    <h3>🧾 Venta Rápida</h3>
    <div class="vr-categorias" id="vr-categorias"></div>
    <div id="vr-productos"></div>
    <button class="btn-cancelar" onclick="cerrarVentaRapida()">Cancelar</button>
  </div>
</div>
```

Justo después de cerrar ese `</div>` (el que cierra `#overlay-vr`), agregar el botón flotante y el
nuevo panel de carrito, antes del bloque existente `<div class="overlay oculto" id="overlay-cobrar-vr">`:
```html
<button class="vr-carrito-flotante oculto" id="vr-carrito-flotante" onclick="abrirCarritoPanelVR()">
  🛒 <span id="vr-flotante-badge">0</span> · <span id="vr-flotante-total">$0</span>
</button>

<div class="overlay-vr oculto" id="overlay-vr-carrito">
  <div class="panel-vr">
    <h3>🛒 Carrito</h3>
    <div id="vr-carrito"></div>
    <div class="division-subtotal">
      <span>Total</span>
      <span id="vr-total">$0</span>
    </div>
    <button class="btn-cobrar" onclick="iniciarCobroVentaRapida(true)">Cobrar y entregar</button>
    <button class="btn-cobrar" onclick="iniciarCobroVentaRapida(false)">Cobrar y dejar para recoger</button>
    <button class="btn-cancelar" onclick="cerrarCarritoPanelVR()">Cerrar</button>
  </div>
</div>
```

- [ ] **Step 3: Agregar el CSS del botón flotante y el z-index del panel nuevo**

Junto a las reglas existentes `#overlay-cobrar{z-index:65;}` / `#overlay-cobrar-parcial{z-index:70;}`
/ `#overlay-cobrar-vr{z-index:68;}`, agregar:
```css
#overlay-vr-carrito{z-index:63;}
.vr-carrito-flotante{position:fixed;bottom:16px;left:16px;z-index:61;background:linear-gradient(135deg,#c8841a,#e8a832);color:#1a0a00;border:none;border-radius:24px;padding:10px 16px;font-weight:800;font-size:0.85rem;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.4);display:flex;align-items:center;gap:6px;}
.vr-carrito-flotante.oculto{display:none;}
```
Nota sobre el orden de capas (de menor a mayor): `header`(20) < `.overlay`(50) < `#overlay-vr`(60) <
`.vr-carrito-flotante`(61) < `#overlay-vr-carrito`(63) < `#overlay-cobrar-vr`(68) <
`#overlay-cobrar-parcial`(70). El botón flotante y su panel quedan por encima del catálogo
(`#overlay-vr`, que es donde viven) pero por debajo del modal de método de pago.

- [ ] **Step 4: Agregar las funciones para abrir/cerrar el panel de carrito**

Cerca de `abrirVentaRapida()`/`cerrarVentaRapida()`, agregar:
```javascript
function abrirCarritoPanelVR() {
  document.getElementById('overlay-vr-carrito').classList.remove('oculto');
}
function cerrarCarritoPanelVR() {
  document.getElementById('overlay-vr-carrito').classList.add('oculto');
}
```

- [ ] **Step 5: Actualizar `renderCarritoVR()` para que también controle el botón flotante**

Cambiar:
```javascript
function renderCarritoVR() {
  const cont = document.getElementById('vr-carrito');
  cont.innerHTML = carritoVentaRapida.length === 0
    ? '<div class="vr-vacio">Carrito vacío</div>'
    : carritoVentaRapida.map((item, i) => `
      <div class="vr-carrito-item">
        <span>${item.cantidad}x ${item.producto}</span>
        <div class="stepper-controles">
          <button class="btn-stepper" onclick="cambiarCantidadVR(${i}, -1)">−</button>
          <span>${formatoCOP(item.precio * item.cantidad)}</span>
        </div>
      </div>
    `).join('');
  const total = carritoVentaRapida.reduce((s, i) => s + i.cantidad * i.precio, 0);
  document.getElementById('vr-total').textContent = formatoCOP(total);
}
```
por:
```javascript
function renderCarritoVR() {
  const cont = document.getElementById('vr-carrito');
  cont.innerHTML = carritoVentaRapida.length === 0
    ? '<div class="vr-vacio">Carrito vacío</div>'
    : carritoVentaRapida.map((item, i) => `
      <div class="vr-carrito-item">
        <span>${item.cantidad}x ${item.producto}</span>
        <div class="stepper-controles">
          <button class="btn-stepper" onclick="cambiarCantidadVR(${i}, -1)">−</button>
          <span>${formatoCOP(item.precio * item.cantidad)}</span>
        </div>
      </div>
    `).join('');
  const totalItems = carritoVentaRapida.reduce((s, i) => s + i.cantidad, 0);
  const total = carritoVentaRapida.reduce((s, i) => s + i.cantidad * i.precio, 0);
  document.getElementById('vr-total').textContent = formatoCOP(total);

  const flot = document.getElementById('vr-carrito-flotante');
  if (totalItems === 0) {
    flot.classList.add('oculto');
    cerrarCarritoPanelVR();
  } else {
    flot.classList.remove('oculto');
  }
  document.getElementById('vr-flotante-badge').textContent = totalItems;
  document.getElementById('vr-flotante-total').textContent = formatoCOP(total);
}
```
(Si el carrito queda en cero -- ej. el cajero quita el último producto -- el panel de carrito se
cierra solo, ya que no tendría nada útil que mostrar.)

- [ ] **Step 6: Ocultar el botón flotante y cerrar su panel al cerrar Venta Rápida por completo**

Cambiar (de Task 1, ya sin la línea de `vr-nombre`):
```javascript
function cerrarVentaRapida() {
  document.getElementById('overlay-vr').classList.add('oculto');
  carritoVentaRapida = [];
  itemsVentaRapidaSnapshot = [];
  idPedidoVentaRapida = null;
}
```
por:
```javascript
function cerrarVentaRapida() {
  document.getElementById('overlay-vr').classList.add('oculto');
  document.getElementById('overlay-vr-carrito').classList.add('oculto');
  document.getElementById('vr-carrito-flotante').classList.add('oculto');
  carritoVentaRapida = [];
  itemsVentaRapidaSnapshot = [];
  idPedidoVentaRapida = null;
}
```

- [ ] **Step 7: Verificar que no quede el bloque viejo duplicado**

Run: `grep -n "division-seccion\|vr-carrito\|vr-total\b" caja.html`
Expected: un solo `<h4>Carrito</h4>` ya no existe (se quitó), `#vr-carrito`/`#vr-total` aparecen
exactamente una vez cada uno en el HTML (dentro de `#overlay-vr-carrito`), no dos.

- [ ] **Step 8: Verificar sintaxis del JS**

Mismo procedimiento del Step 6 de Task 1 (extraer `<script>` y correr `node --check`).
Expected: sale limpio, exit code 0.

- [ ] **Step 9: Commit**

```bash
git add caja.html
git commit -m "feat: replace inline Venta Rapida cart with a fixed floating cart icon"
```

---

### Task 3: `menu.html` — unificar el carrito en el mismo ícono flotante (los 3 tamaños de pantalla)

**Files:**
- Modify: `menu.html` (CSS ~líneas 42-45, 106-120; HTML ~líneas 148-164; JS ~líneas 651-659, 693-731)

**Interfaces:**
- Produces: `actualizarCarritoFlotante()`, `renderCarrito()`, `renderAvisoPuntos()`,
  `renderTarjetaPuntos()`, `abrirCarrito()`, `cerrarCarrito()` mantienen sus firmas exactas — ningún
  llamador (`agregarAlCarrito`, `cambiarCantidad`, `quitarDelCarrito`, etc.) cambia.

- [ ] **Step 1: Confirmar el estado actual de las referencias a sidebar**

Run: `grep -n "sidebar" menu.html`
Debe mostrar las 13 líneas actuales: la regla CSS `.carrito-sidebar` y sus variantes (líneas
~106-119), el `<aside>` completo (líneas ~148-158), y las 4 referencias en JS (`renderCarrito`,
`renderAvisoPuntos`, `renderTarjetaPuntos`).

- [ ] **Step 2: Quitar el `<aside class="carrito-sidebar">` del HTML**

Borrar por completo:
```html
  <!-- Carrito real: visible siempre como sidebar en pantallas anchas (escritorio) -->
  <aside class="carrito-sidebar" id="carrito-sidebar">
    <div class="carrito-sidebar-header"><h3>🛒 Tu pedido</h3></div>
    <div class="carrito-sidebar-body" id="carrito-sidebar-body"></div>
    <div class="carrito-sidebar-footer">
      <div class="puntos-aviso" id="puntos-aviso-sidebar"></div>
      <div class="tarjeta-puntos" id="tarjeta-puntos-sidebar"></div>
      <div class="total-row"><span>Total</span><span id="carrito-sidebar-total">$0</span></div>
      <button class="btn-principal" onclick="irACheckout()">Hacer pedido</button>
    </div>
  </aside>
```
`<div class="layout">` pasa a contener solo `<div class="contenido">...</div>`.

- [ ] **Step 3: Simplificar el CSS de `.layout`/`.contenido` y quitar las reglas de sidebar**

Cambiar:
```css
/* Carrito real: franja + panel deslizable en móvil (por defecto), sidebar fijo en escritorio */
.layout{display:block;}
.contenido{max-width:640px;margin:0 auto;}
.carrito-sidebar{display:none;}
@media (min-width:900px){
  .layout{display:flex;align-items:flex-start;justify-content:center;gap:24px;max-width:1120px;margin:0 auto;padding:16px 16px 40px;}
  .contenido{flex:1 1 640px;max-width:640px;margin:0;}
  header{position:sticky;}
  .carrito-flotante{display:none !important;}
  .carrito-sidebar{display:flex;flex-direction:column;position:sticky;top:16px;flex:0 0 340px;max-height:calc(100vh - 32px);background:#241000;border:1px solid rgba(200,132,26,0.25);border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.35);}
  .carrito-sidebar-header{padding:16px 18px;border-bottom:1px solid rgba(200,132,26,0.25);}
  .carrito-sidebar-header h3{color:#c8841a;font-size:1.05rem;}
  .carrito-sidebar-body{padding:16px 18px;overflow-y:auto;flex:1;}
  .carrito-sidebar-footer{padding:14px 18px 18px;border-top:1px solid rgba(200,132,26,0.25);}
}
```
por:
```css
/* Carrito real: ícono flotante + panel deslizable, mismo comportamiento en todos los tamaños de pantalla */
.layout{display:block;}
.contenido{max-width:640px;margin:0 auto;}
@media (min-width:900px){
  .layout{display:flex;align-items:flex-start;justify-content:center;max-width:1120px;margin:0 auto;padding:16px 16px 40px;}
  .contenido{max-width:640px;margin:0;}
  header{position:sticky;}
}
```

- [ ] **Step 4: Achicar el carrito flotante (de barra ancha a ícono pequeño)**

Cambiar:
```css
.carrito-flotante{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:608px;background:linear-gradient(135deg,#c8841a,#e8a832);border-radius:16px;padding:14px 18px;display:none;align-items:center;justify-content:space-between;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,0.4);z-index:30;}
.carrito-flotante.visible{display:flex;}
.carrito-flotante-info{color:#1a0a00;font-weight:700;}
.carrito-flotante-total{color:#1a0a00;font-weight:800;font-size:1.05rem;}
```
por:
```css
.carrito-flotante{position:fixed;bottom:16px;left:16px;background:linear-gradient(135deg,#c8841a,#e8a832);color:#1a0a00;border:none;border-radius:24px;padding:10px 16px;display:none;align-items:center;gap:6px;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,0.4);z-index:30;font-weight:800;font-size:0.85rem;}
.carrito-flotante.visible{display:flex;}
```

- [ ] **Step 5: Actualizar el HTML del botón flotante al formato compacto (ícono + número + total)**

Cambiar:
```html
<div class="carrito-flotante" id="carrito-flotante" onclick="abrirCarrito()">
  <div class="carrito-flotante-info" id="carrito-flotante-info">0 productos</div>
  <div class="carrito-flotante-total" id="carrito-flotante-total">$0</div>
</div>
```
por:
```html
<div class="carrito-flotante" id="carrito-flotante" onclick="abrirCarrito()">
  🛒 <span id="carrito-flotante-info">0</span> · <span id="carrito-flotante-total">$0</span>
</div>
```

- [ ] **Step 6: Actualizar `actualizarCarritoFlotante()` al texto compacto**

Cambiar:
```javascript
  document.getElementById('carrito-flotante-info').textContent = totalItems + (totalItems === 1 ? ' producto' : ' productos');
```
por:
```javascript
  document.getElementById('carrito-flotante-info').textContent = totalItems;
```

- [ ] **Step 7: Quitar las referencias a IDs de sidebar en las 3 funciones de render**

En `renderCarrito()`, cambiar:
```javascript
  ['panel-carrito-body', 'carrito-sidebar-body'].forEach(id => {
```
por:
```javascript
  ['panel-carrito-body'].forEach(id => {
```
y:
```javascript
  ['carrito-total', 'carrito-sidebar-total'].forEach(id => {
```
por:
```javascript
  ['carrito-total'].forEach(id => {
```

En `renderAvisoPuntos()`, cambiar:
```javascript
  ['puntos-aviso-panel', 'puntos-aviso-sidebar'].forEach(id => {
```
por:
```javascript
  ['puntos-aviso-panel'].forEach(id => {
```

En `renderTarjetaPuntos()`, cambiar:
```javascript
  ['tarjeta-puntos-panel', 'tarjeta-puntos-sidebar'].forEach(id => {
```
por:
```javascript
  ['tarjeta-puntos-panel'].forEach(id => {
```

- [ ] **Step 8: Verificar que no quede ninguna referencia a sidebar**

Run: `grep -n "sidebar" menu.html`
Expected: sin resultados (0 coincidencias).

- [ ] **Step 9: Verificar sintaxis del JS**

Mismo procedimiento que en Task 1/2 (extraer `<script>` y correr `node --check`) mediante:
```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('menu.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
fs.writeFileSync('C:/Users/Usuario/AppData/Local/Temp/menu_check.js', scripts.join('\n'));
"
node --check "C:/Users/Usuario/AppData/Local/Temp/menu_check.js"
```
Expected: sale limpio, exit code 0.

- [ ] **Step 10: Commit**

```bash
git add menu.html
git commit -m "feat: unify menu.html cart into the same fixed floating icon at all screen sizes"
```

---

## Verificación final (después de las 3 tareas)

- [ ] `node --check` limpio sobre `caja.html` y `menu.html` (ya cubierto por cada tarea).
- [ ] `grep -n "vr-nombre\|carrito-sidebar" caja.html menu.html` no devuelve nada.
- [ ] Push a GitHub (`git push origin master`) para que el usuario pueda probar en su dispositivo real.
- [ ] `WebFetch` de `https://jcdondeelgordo-bit.github.io/MenuDigital/caja.html` y
      `https://jcdondeelgordo-bit.github.io/MenuDigital/menu.html` tras el push, para confirmar que el
      HTML servido ya no contiene `vr-nombre` ni `carrito-sidebar` (descarta caché vieja de GitHub
      Pages antes de que el usuario pruebe).
- [ ] El usuario confirma en su tablet/celular: (a) el diálogo nativo aparece y el teclado funciona al
      escribir el nombre en "Cobrar y dejar para recoger"; (b) el ícono de carrito en Venta Rápida y en
      `menu.html` se ve bien, no se mueve al hacer scroll, y abre/cierra correctamente su panel.
