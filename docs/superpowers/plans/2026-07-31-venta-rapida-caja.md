# Venta Rápida en Caja Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a `caja.html` la capacidad de registrar y cobrar clientes de mostrador (sin mesa ni mesero) directamente desde Caja, con dos caminos — "Cobrar y entregar" (se lo lleva ya) y "Cobrar y dejar para recoger" (pagado, esperando que el cliente vuelva) — y hacer que esos pedidos se vean correctamente en el resto del sistema (grid de Caja, Historial, Cocina).

**Architecture:** Todo el trabajo es frontend. Se reutilizan 100% las acciones de Apps Script ya desplegadas (`listar_productos`, `crear_pedido`, `marcar_pedido_pagado`, `liberar_pedido`, `listar_pedidos_caja`) con un tercer valor de `Tipo_Pedido`: `'mostrador'`. La columna `Mesa` (vacía hoy para pedidos que no son de mesa) guarda el nombre del cliente como texto libre para este tipo; `Mesero` se deja vacío a propósito para no afectar comisiones.

**Tech Stack:** HTML/CSS/JS vanilla, sin build step, mismo patrón que el resto del sitio. Verificación sin navegador disponible: `node --check` sobre el `<script>` extraído + trazas manuales explícitas.

## Global Constraints

- Cero cambios de Apps Script / backend — todas las acciones ya existen y ya están verificadas en vivo.
- Para `tipo='mostrador'`: `Mesa` = nombre del cliente (texto libre), `Mesero` = siempre vacío (no debe contar para comisiones de ningún mesero).
- La captura de nombre es obligatoria solo para "Cobrar y dejar para recoger" — nunca bloquea "Cobrar y entregar".
- "Para recoger" es una lista (no cupos fijos como Domicilio) — sin límite de cuántos pedidos puede haber esperando a la vez.
- Todo pedido `mostrador` activa `Estado_Cocina='Pendiente'` igual que cualquier otro pedido local — sin distinción de qué productos "necesitan" cocina.
- Si el cajero cancela el selector de método de pago después de que `crear_pedido` ya se disparó, o si `marcar_pedido_pagado` falla: el pedido queda `Pendiente de pago` tipo `mostrador`, visible y cobrable desde el Historial existente — nunca se pierde silenciosamente.
- `SCRIPT_URL` debe ser el mismo valor exacto ya usado en el resto del sitio: `https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec`.
- Sin navegador/Playwright disponible durante la construcción — la prueba con clics queda para el usuario en el sitio publicado, después de mergear.

---

### Task 1: Venta Rápida — catálogo, carrito y cobro (crear pedido + pagar + liberar opcional)

**Files:**
- Modify: `caja.html` (agrega estilos, HTML de dos modales nuevos, botón en el encabezado, y las funciones de JS del carrito/cobro; corrige `imprimirRecibo` para el tercer tipo)

**Interfaces:**
- Consumes: `listar_productos` (misma acción que ya usa `menu.html`, `{ok, productos:[{categoria, producto, descripcion, precio, ...}]}`), `crear_pedido`, `marcar_pedido_pagado`, `liberar_pedido` — todas ya existentes en el backend, sin cambios de firma.
- Produces: pedidos con `Tipo_Pedido='mostrador'` en la hoja `Ventas`, con `Mesa`=nombre del cliente y `Mesero=''`. Task 2 depende de este contrato de datos para mostrar/filtrar estos pedidos en el grid, Historial y `cocina.html`.

- [ ] **Step 1: Agregar los estilos nuevos al `<style>` de `caja.html`**

Busca esta línea existente (el final del bloque de estilos de "Dividir cuenta", justo antes del bloque `#overlay-cobrar{z-index:65;}`):

```css
.parte-igual-card{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;border:1px solid rgba(200,132,26,0.25);border-radius:10px;}

#overlay-cobrar{z-index:65;}
#overlay-cobrar-parcial{z-index:70;}
```

Reemplázala por (agrega los estilos de Venta Rápida entre las dos líneas existentes, todo lo demás igual):

```css
.parte-igual-card{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;border:1px solid rgba(200,132,26,0.25);border-radius:10px;}

.overlay-vr{position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;z-index:60;padding:24px 12px;}
.overlay-vr.oculto{display:none;}
.panel-vr{background:#2a1500;border:1px solid rgba(200,132,26,0.4);border-radius:16px;padding:20px;width:100%;max-width:560px;display:flex;flex-direction:column;gap:14px;}
.panel-vr h3{color:#e8a832;font-size:1.15rem;}
.vr-categorias{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;}
.vr-cat-pill{flex:none;padding:8px 16px;border-radius:20px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,132,26,0.3);color:#f0e0b0;font-size:0.85rem;white-space:nowrap;cursor:pointer;}
.vr-cat-pill.activa{background:linear-gradient(135deg,#c8841a,#e8a832);color:#1a0a00;font-weight:700;border-color:transparent;}
.vr-producto-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,0.06);font-size:0.88rem;}
.vr-carrito-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid rgba(255,255,255,0.06);font-size:0.88rem;}
.vr-vacio{font-size:0.8rem;color:rgba(240,224,176,0.5);padding:6px 0;}

#overlay-cobrar{z-index:65;}
#overlay-cobrar-parcial{z-index:70;}
#overlay-cobrar-vr{z-index:68;}
```

- [ ] **Step 2: Agregar el botón "Venta Rápida" al encabezado**

Busca:

```html
  <div class="header-tabs">
    <button class="btn-tab" id="btn-vista-historial" onclick="cambiarVistaPrincipal(vistaPrincipal === 'grid' ? 'historial' : 'grid')">🕒 Historial de hoy</button>
    <a class="btn-tab" href="index.html" style="text-decoration:none;display:inline-flex;align-items:center;">← MENU</a>
  </div>
```

Reemplázalo por (agrega el botón de Venta Rápida antes del de Historial, todo lo demás igual):

```html
  <div class="header-tabs">
    <button class="btn-tab" onclick="abrirVentaRapida()">🧾 Venta Rápida</button>
    <button class="btn-tab" id="btn-vista-historial" onclick="cambiarVistaPrincipal(vistaPrincipal === 'grid' ? 'historial' : 'grid')">🕒 Historial de hoy</button>
    <a class="btn-tab" href="index.html" style="text-decoration:none;display:inline-flex;align-items:center;">← MENU</a>
  </div>
```

- [ ] **Step 3: Agregar los dos modales nuevos al HTML**

Busca (el cierre del modal de cobro parcial, justo antes de `<div id="recibo-imprimir"></div>`):

```html
<div class="overlay oculto" id="overlay-cobrar-parcial">
  <div class="modal-cobrar">
    <h3>¿Cómo pagó esta parte?</h3>
    <button class="btn-metodo" onclick="confirmarCobroParcial('Efectivo')">💵 Efectivo</button>
    <button class="btn-metodo" onclick="confirmarCobroParcial('Nequi')">📱 Nequi</button>
    <button class="btn-metodo" onclick="confirmarCobroParcial('Tarjeta')">💳 Tarjeta</button>
    <button class="btn-cancelar" onclick="cerrarModalCobrarParcial()">Cancelar</button>
  </div>
</div>

<div id="recibo-imprimir"></div>
```

Reemplázalo por (agrega los dos modales de Venta Rápida entre el modal de cobro parcial y el div del recibo, todo lo demás igual):

```html
<div class="overlay oculto" id="overlay-cobrar-parcial">
  <div class="modal-cobrar">
    <h3>¿Cómo pagó esta parte?</h3>
    <button class="btn-metodo" onclick="confirmarCobroParcial('Efectivo')">💵 Efectivo</button>
    <button class="btn-metodo" onclick="confirmarCobroParcial('Nequi')">📱 Nequi</button>
    <button class="btn-metodo" onclick="confirmarCobroParcial('Tarjeta')">💳 Tarjeta</button>
    <button class="btn-cancelar" onclick="cerrarModalCobrarParcial()">Cancelar</button>
  </div>
</div>

<div class="overlay-vr oculto" id="overlay-vr">
  <div class="panel-vr">
    <h3>🧾 Venta Rápida</h3>
    <input type="text" class="input-nombre" id="vr-nombre" placeholder="Nombre del cliente (obligatorio si va a recoger después)">
    <div class="vr-categorias" id="vr-categorias"></div>
    <div id="vr-productos"></div>
    <div class="division-seccion">
      <h4>Carrito</h4>
      <div id="vr-carrito"></div>
      <div class="division-subtotal">
        <span>Total</span>
        <span id="vr-total">$0</span>
      </div>
    </div>
    <button class="btn-cobrar" onclick="iniciarCobroVentaRapida(true)">Cobrar y entregar</button>
    <button class="btn-cobrar" onclick="iniciarCobroVentaRapida(false)">Cobrar y dejar para recoger</button>
    <button class="btn-cancelar" onclick="cerrarVentaRapida()">Cancelar</button>
  </div>
</div>

<div class="overlay oculto" id="overlay-cobrar-vr">
  <div class="modal-cobrar">
    <h3>¿Cómo pagó el cliente?</h3>
    <button class="btn-metodo" onclick="confirmarCobroVentaRapida('Efectivo')">💵 Efectivo</button>
    <button class="btn-metodo" onclick="confirmarCobroVentaRapida('Nequi')">📱 Nequi</button>
    <button class="btn-metodo" onclick="confirmarCobroVentaRapida('Tarjeta')">💳 Tarjeta</button>
    <button class="btn-cancelar" onclick="cerrarModalCobrarVR()">Cancelar</button>
  </div>
</div>

<div id="recibo-imprimir"></div>
```

- [ ] **Step 4: Corregir `imprimirRecibo` para el tercer tipo**

Busca:

```javascript
    <div class="recibo-linea">${pedido.tipo === 'local' ? 'Mesa ' + (pedido.mesa || '—') : 'Domicilio'}</div>
```

Reemplázala por:

```javascript
    <div class="recibo-linea">${pedido.tipo === 'local' ? 'Mesa ' + (pedido.mesa || '—') : (pedido.tipo === 'mostrador' ? 'Mostrador' + (pedido.mesa ? ': ' + pedido.mesa : '') : 'Domicilio')}</div>
```

- [ ] **Step 5: Agregar el estado y las funciones de Venta Rápida**

Busca (el final de la función `formatoCOP`, justo antes de `function imprimirRecibo`):

```javascript
function formatoCOP(v) { return '$' + Math.round(v).toLocaleString('es-CO'); }

function imprimirRecibo(pedido) {
```

Reemplázala por (agrega todo el bloque de Venta Rápida entre `formatoCOP` e `imprimirRecibo`, todo lo demás igual):

```javascript
function formatoCOP(v) { return '$' + Math.round(v).toLocaleString('es-CO'); }

// Venta Rápida: cliente de mostrador sin mesa ni mesero. El carrito vive solo en
// memoria (a diferencia de menu.html, que lo guarda en localStorage) porque este
// es un dispositivo compartido de caja, no el teléfono de un cliente.
let productosVentaRapida = [];
let productosVentaRapidaError = false;
let categoriaActivaVR = null;
let carritoVentaRapida = [];
let entregaInmediataVR = true; // true = "Cobrar y entregar", false = "Cobrar y dejar para recoger"
let nombreVentaRapida = '';
let idPedidoVentaRapida = null; // id_pedido ya creado (Pendiente de pago), esperando método de pago

function abrirVentaRapida() {
  if (productosVentaRapida.length === 0 && !productosVentaRapidaError) cargarProductosVentaRapida();
  document.getElementById('overlay-vr').classList.remove('oculto');
  renderCarritoVR();
}

function cerrarVentaRapida() {
  document.getElementById('overlay-vr').classList.add('oculto');
  carritoVentaRapida = [];
  document.getElementById('vr-nombre').value = '';
}

async function cargarProductosVentaRapida() {
  try {
    const res = await fetch(SCRIPT_URL + '?accion=listar_productos');
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.productos) || data.productos.length === 0) throw new Error('respuesta vacía');
    productosVentaRapida = data.productos;
    productosVentaRapidaError = false;
    categoriaActivaVR = productosVentaRapida[0].categoria;
    renderCategoriasVR();
    renderProductosVR();
  } catch (e) {
    productosVentaRapidaError = true;
    document.getElementById('vr-productos').innerHTML = '<div class="vr-vacio">⚠️ No se pudo cargar el catálogo. <button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);display:inline;" onclick="cargarProductosVentaRapida()">Reintentar</button></div>';
  }
}

function renderCategoriasVR() {
  const categorias = [...new Set(productosVentaRapida.map(p => p.categoria))];
  document.getElementById('vr-categorias').innerHTML = categorias.map(c =>
    `<div class="vr-cat-pill${c === categoriaActivaVR ? ' activa' : ''}" onclick="seleccionarCategoriaVR('${c.replace(/'/g, "\\'")}')">${c}</div>`
  ).join('');
}

function seleccionarCategoriaVR(cat) {
  categoriaActivaVR = cat;
  renderCategoriasVR();
  renderProductosVR();
}

function renderProductosVR() {
  const lista = productosVentaRapida.filter(p => p.categoria === categoriaActivaVR);
  document.getElementById('vr-productos').innerHTML = lista.map(p => {
    const idx = productosVentaRapida.indexOf(p);
    return `<div class="vr-producto-row">
      <span>${p.producto} — ${formatoCOP(p.precio)}</span>
      <button class="btn-stepper" onclick="agregarAlCarritoVR(${idx})">+</button>
    </div>`;
  }).join('');
}

function agregarAlCarritoVR(idx) {
  const p = productosVentaRapida[idx];
  const existente = carritoVentaRapida.find(i => i.producto === p.producto && i.categoria === p.categoria);
  if (existente) { existente.cantidad++; }
  else { carritoVentaRapida.push({ producto: p.producto, categoria: p.categoria, precio: p.precio, cantidad: 1 }); }
  renderCarritoVR();
}

function cambiarCantidadVR(i, delta) {
  carritoVentaRapida[i].cantidad += delta;
  if (carritoVentaRapida[i].cantidad <= 0) carritoVentaRapida.splice(i, 1);
  renderCarritoVR();
}

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

async function iniciarCobroVentaRapida(entregarYa) {
  if (carritoVentaRapida.length === 0) { alert('Agrega al menos un producto al carrito.'); return; }
  const nombre = document.getElementById('vr-nombre').value.trim();
  if (!entregarYa && !nombre) { alert('Escribe el nombre del cliente para dejar el pedido pendiente de recoger.'); return; }

  entregaInmediataVR = entregarYa;
  nombreVentaRapida = nombre;
  const total = carritoVentaRapida.reduce((s, i) => s + i.cantidad * i.precio, 0);

  try {
    const params = new URLSearchParams({
      accion: 'crear_pedido',
      items: JSON.stringify(carritoVentaRapida),
      total: String(total),
      tipo: 'mostrador',
      mesa: nombre,
      mesero: ''
    });
    const res = await fetch(SCRIPT_URL + '?' + params.toString());
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');
    idPedidoVentaRapida = data.id_pedido;
    document.getElementById('overlay-cobrar-vr').classList.remove('oculto');
  } catch (e) {
    alert('No se pudo registrar el pedido (' + e.message + '). El carrito no se perdió -- intenta de nuevo.');
  }
}

function cerrarModalCobrarVR() {
  document.getElementById('overlay-cobrar-vr').classList.add('oculto');
  idPedidoVentaRapida = null;
}

async function confirmarCobroVentaRapida(metodo) {
  const idPedido = idPedidoVentaRapida;
  const entregar = entregaInmediataVR;
  const nombre = nombreVentaRapida;
  const itemsRecibo = carritoVentaRapida.map(i => ({ producto: i.producto, cantidad: i.cantidad, total: i.precio * i.cantidad }));
  const total = itemsRecibo.reduce((s, i) => s + i.total, 0);
  document.getElementById('overlay-cobrar-vr').classList.add('oculto');
  idPedidoVentaRapida = null;
  if (!idPedido) return;

  try {
    const params = new URLSearchParams({ accion: 'marcar_pedido_pagado', id_pedido: idPedido, metodo_pago: metodo });
    const res = await fetch(SCRIPT_URL + '?' + params.toString());
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');

    if (entregar) {
      // Si el cobro ya quedó registrado pero esta llamada falla, el pedido queda
      // Pagado tipo mostrador y aparece en "Para recoger" en vez de perderse --
      // se puede marcar recogido manualmente desde ahí (Task 2), no es bloqueante.
      const paramsLib = new URLSearchParams({ accion: 'liberar_pedido', id_pedido: idPedido });
      await fetch(SCRIPT_URL + '?' + paramsLib.toString());
    }

    imprimirRecibo({ tipo: 'mostrador', mesa: nombre, items: itemsRecibo, total: total, metodo_pago: metodo });
    carritoVentaRapida = [];
    cerrarVentaRapida();
    await cargarPedidos();
  } catch (e) {
    alert('No se pudo confirmar el cobro (' + e.message + '). El pedido queda pendiente de pago -- lo puedes cobrar desde el Historial (pestaña Mostrador).');
  }
}

function imprimirRecibo(pedido) {
```

- [ ] **Step 6: Verificar sintaxis con `node --check`**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('caja.html', 'utf8');
const match = html.match(/<script>([\s\S]*)<\/script>/);
fs.writeFileSync('caja_check.js', match[1]);
"
node --check caja_check.js
rm caja_check.js
```

Expected: sin salida (éxito silencioso).

- [ ] **Step 7: Ctrl+F de duplicados**

Confirma que cada uno de estos nombres aparece **una sola vez** como declaración en `caja.html`: `abrirVentaRapida`, `cerrarVentaRapida`, `cargarProductosVentaRapida`, `renderCategoriasVR`, `seleccionarCategoriaVR`, `renderProductosVR`, `agregarAlCarritoVR`, `cambiarCantidadVR`, `renderCarritoVR`, `iniciarCobroVentaRapida`, `cerrarModalCobrarVR`, `confirmarCobroVentaRapida`.

- [ ] **Step 8: Traza manual de los 4 escenarios (sin navegador disponible)**

Lee el código final y confirma a mano:

1. **Carrito vacío, toca "Cobrar y entregar"**: `iniciarCobroVentaRapida(true)` → `carritoVentaRapida.length === 0` → `alert('Agrega al menos un producto...')`, retorna sin llamar `crear_pedido`. **Correcto.**
2. **Carrito con productos, sin nombre, toca "Cobrar y dejar para recoger"**: `iniciarCobroVentaRapida(false)` → carrito no vacío → `nombre` vacío y `entregarYa` es `false` → `alert('Escribe el nombre...')`, retorna sin llamar `crear_pedido`. **Correcto** — pero la misma situación con "Cobrar y entregar" (`entregarYa=true`) NO debe pedir nombre — confirma que la condición es `!entregarYa && !nombre`, no solo `!nombre`.
3. **Flujo completo "Cobrar y entregar"**: `iniciarCobroVentaRapida(true)` → `crear_pedido` exitoso → `idPedidoVentaRapida` queda con el id devuelto, se abre `#overlay-cobrar-vr` → cajero toca "Efectivo" → `confirmarCobroVentaRapida('Efectivo')` → `marcar_pedido_pagado` exitoso → como `entregar` es `true`, también llama `liberar_pedido` → imprime recibo con `tipo:'mostrador'` → limpia carrito y cierra modal → `cargarPedidos()` refresca. El pedido nunca debe aparecer en "Para recoger" porque ya quedó `Liberado`.
4. **Cajero cancela el selector de pago tras crear el pedido**: `iniciarCobroVentaRapida` ya llamó `crear_pedido` (pedido existe como `Pendiente de pago` en el backend) → cajero toca "Cancelar" en `#overlay-cobrar-vr` → `cerrarModalCobrarVR()` → solo oculta el modal y resetea `idPedidoVentaRapida` a `null` — **no** llama a ningún endpoint que revierta o borre el pedido. El pedido queda `Pendiente de pago` tipo `mostrador` en el Sheet real, tal como exige el Global Constraint — confírmalo leyendo `cerrarModalCobrarVR` línea por línea, no asumas.

- [ ] **Step 9: Commit**

```bash
git add caja.html
git commit -m "$(cat <<'EOF'
feat: add Venta Rápida flow to caja.html (counter sales, no table/waiter)

New modal lets the cashier browse the catalog (reusing listar_productos),
build a cart in memory, and close it two ways: "Cobrar y entregar" (paid
and taken immediately) or "Cobrar y dejar para recoger" (paid, waits in
a pickup list). Both call crear_pedido(tipo='mostrador', mesa=<customer
name>, mesero='') then the existing payment-method flow; "entregar" also
calls liberar_pedido right away. No backend changes -- reuses
crear_pedido/marcar_pedido_pagado/liberar_pedido/listar_productos as-is.
Fixes imprimirRecibo to label the new order type instead of defaulting
to "Domicilio".

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: "Para recoger" en el grid, pestaña Mostrador en Historial, y etiqueta correcta en Cocina

**Files:**
- Modify: `caja.html` (nueva sección en el grid, nuevo detalle, nueva pestaña de Historial)
- Modify: `cocina.html` (etiqueta de pedidos `mostrador` en lista y detalle)

**Interfaces:**
- Consumes: pedidos con `Tipo_Pedido='mostrador'` tal como los produce Task 1 (`Mesa`=nombre del cliente, `Mesero=''`), leídos vía `listar_pedidos_caja` (para `caja.html`) y `listar_pedidos_cocina` (para `cocina.html`) — ambas acciones ya devuelven estos pedidos sin cambios, porque ninguna filtra por `tipo`.
- Produces: nada que otra task consuma — es la pieza final del flujo.

- [ ] **Step 1: Agregar el estado y la nueva sección "Para recoger" en `renderGrid`**

Busca (el bloque de estado de la pantalla de grid):

```javascript
// Pantalla de grid (mesas + domicilios) -- rediseño 2026-07-30.
let vistaPrincipal = 'grid'; // 'grid' | 'historial'
let mesaAbierta = null;      // número de mesa mostrado en el panel de detalle, o null
let domicilioAbierto = null; // id_pedido de domicilio mostrado en el panel de detalle, o null
```

Reemplázalo por:

```javascript
// Pantalla de grid (mesas + domicilios) -- rediseño 2026-07-30.
let vistaPrincipal = 'grid'; // 'grid' | 'historial'
let mesaAbierta = null;      // número de mesa mostrado en el panel de detalle, o null
let domicilioAbierto = null; // id_pedido de domicilio mostrado en el panel de detalle, o null
let mostradorAbierto = null; // id_pedido de mostrador (Venta Rápida) mostrado en el panel de detalle, o null
```

Busca (la función `cerrarDetalle`):

```javascript
function cerrarDetalle() {
  mesaAbierta = null;
  domicilioAbierto = null;
  document.getElementById('overlay-detalle').classList.add('oculto');
}
```

Reemplázala por:

```javascript
function cerrarDetalle() {
  mesaAbierta = null;
  domicilioAbierto = null;
  mostradorAbierto = null;
  document.getElementById('overlay-detalle').classList.add('oculto');
}
```

**Importante:** `abrirDetalleMesa` y `abrirDetalleDomicilio` (código existente, sin tocar hasta ahora) solo se
resetean entre sí (`domicilioAbierto`/`mesaAbierta`) — si no se les agrega también `mostradorAbierto = null`,
podría quedar un detalle de mostrador "abierto" en memoria mientras se abre un detalle de mesa/domicilio, y
`cargarPedidos()` llamaría a dos funciones de render distintas sobre el mismo `#detalle-contenido` en el
siguiente refresco. Corrígelo ahora:

Busca:

```javascript
function abrirDetalleMesa(numMesa) {
  const rondas = pedidos.filter(p => p.tipo === 'local' && String(p.mesa) === String(numMesa) && p.estado !== 'Liberado');
  if (rondas.length === 0) return; // mesa libre, no hace nada

  domicilioAbierto = null;
  mesaAbierta = numMesa;
  renderDetalleMesa();
  document.getElementById('overlay-detalle').classList.remove('oculto');
}
```

Reemplázala por:

```javascript
function abrirDetalleMesa(numMesa) {
  const rondas = pedidos.filter(p => p.tipo === 'local' && String(p.mesa) === String(numMesa) && p.estado !== 'Liberado');
  if (rondas.length === 0) return; // mesa libre, no hace nada

  domicilioAbierto = null;
  mostradorAbierto = null;
  mesaAbierta = numMesa;
  renderDetalleMesa();
  document.getElementById('overlay-detalle').classList.remove('oculto');
}
```

Busca:

```javascript
function abrirDetalleDomicilio(idPedido) {
  const pedido = pedidos.find(p => p.id_pedido === idPedido && p.tipo === 'domicilio');
  if (!pedido) return;

  mesaAbierta = null;
  domicilioAbierto = idPedido;
  renderDetalleDomicilio();
  document.getElementById('overlay-detalle').classList.remove('oculto');
}
```

Reemplázala por:

```javascript
function abrirDetalleDomicilio(idPedido) {
  const pedido = pedidos.find(p => p.id_pedido === idPedido && p.tipo === 'domicilio');
  if (!pedido) return;

  mesaAbierta = null;
  mostradorAbierto = null;
  domicilioAbierto = idPedido;
  renderDetalleDomicilio();
  document.getElementById('overlay-detalle').classList.remove('oculto');
}
```

Busca (el final de `cargarPedidos`):

```javascript
  aplicarPendientes(pedidos);
  actualizarCuposDomicilio();
  renderPrincipal();
  if (mesaAbierta !== null) renderDetalleMesa();
  if (domicilioAbierto !== null) renderDetalleDomicilio();
}
```

Reemplázalo por:

```javascript
  aplicarPendientes(pedidos);
  actualizarCuposDomicilio();
  renderPrincipal();
  if (mesaAbierta !== null) renderDetalleMesa();
  if (domicilioAbierto !== null) renderDetalleDomicilio();
  if (mostradorAbierto !== null) renderDetalleMostrador();
}
```

- [ ] **Step 2: Agregar la sección "Para recoger" al final de `renderGrid`**

Busca:

```javascript
  const enEspera = activosDom.filter(p => !domicilioCupos[p.id_pedido]);
  const esperaHtml = enEspera.length === 0 ? '' : `
    <div class="franja-espera">
      <div class="franja-espera-titulo">En espera de cupo (${enEspera.length})</div>
      ${enEspera.map(p => `<button class="btn-espera" onclick="abrirDetalleDomicilio('${p.id_pedido}')">${p.hora}</button>`).join('')}
    </div>`;

  cont.innerHTML = banner + `
    <div class="pantalla-grid">
      <div class="grid-mesas">${mesasHtml.join('')}</div>
      <div class="linea-divisoria"></div>
      <div class="grid-domicilios">${cuposHtml.join('')}</div>
      ${esperaHtml}
    </div>`;
}
```

Reemplázalo por (agrega el cálculo y el HTML de "Para recoger", todo lo demás igual):

```javascript
  const enEspera = activosDom.filter(p => !domicilioCupos[p.id_pedido]);
  const esperaHtml = enEspera.length === 0 ? '' : `
    <div class="franja-espera">
      <div class="franja-espera-titulo">En espera de cupo (${enEspera.length})</div>
      ${enEspera.map(p => `<button class="btn-espera" onclick="abrirDetalleDomicilio('${p.id_pedido}')">${p.hora}</button>`).join('')}
    </div>`;

  const activosMostrador = pedidos.filter(p => p.tipo === 'mostrador' && p.estado === 'Pagado')
    .sort((a, b) => a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0);
  const recogerHtml = activosMostrador.length === 0 ? '' : `
    <div class="linea-divisoria"></div>
    <div class="seccion-recoger">
      <div class="franja-espera-titulo">Para recoger (${activosMostrador.length})</div>
      ${activosMostrador.map(p => `<button class="btn-recoger" onclick="abrirDetalleMostrador('${p.id_pedido}')"><span>${p.mesa || 'Sin nombre'}</span><span>${p.hora}</span><span>${formatoCOP(p.total)}</span></button>`).join('')}
    </div>`;

  cont.innerHTML = banner + `
    <div class="pantalla-grid">
      <div class="grid-mesas">${mesasHtml.join('')}</div>
      <div class="linea-divisoria"></div>
      <div class="grid-domicilios">${cuposHtml.join('')}</div>
      ${esperaHtml}
      ${recogerHtml}
    </div>`;
}
```

- [ ] **Step 3: Agregar el CSS de la sección "Para recoger"**

Busca (el final del bloque de estilos del grid, justo antes del cierre `</style>`):

```css
.historial-filtros{grid-column:1/-1;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:6px;}
</style>
```

Reemplázalo por:

```css
.historial-filtros{grid-column:1/-1;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:6px;}
.seccion-recoger{display:flex;flex-direction:column;gap:8px;}
.btn-recoger{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-radius:12px;background:rgba(200,132,26,0.1);border:1px solid rgba(200,132,26,0.35);color:#f0e0b0;font-size:0.88rem;font-weight:700;cursor:pointer;text-align:left;width:100%;}
</style>
```

- [ ] **Step 4: Agregar `abrirDetalleMostrador`, `renderDetalleMostrador` y `marcarMostradorRecogido`**

Busca (el final de `liberarPedidoDomicilio`, justo antes de `async function abrirModalCobrar`):

```javascript
async function liberarPedidoDomicilio(idPedido) {
  if (!confirm('¿Marcar este domicilio como entregado? Se libera el cupo.')) return;
  const pedido = pedidos.find(p => p.id_pedido === idPedido);
  if (!pedido) return;

  pedidosLiberacionPendiente.add(idPedido);
  const estadoAnterior = pedido.estado;
  pedido.estado = 'Liberado';
  renderPrincipal();
  cerrarDetalle();

  try {
    const params = new URLSearchParams({ accion: 'liberar_pedido', id_pedido: idPedido });
    const res = await fetch(SCRIPT_URL + '?' + params.toString());
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');
  } catch (e) {
    pedido.estado = estadoAnterior;
    renderPrincipal();
    alert('No se pudo liberar el pedido: ' + e.message);
  } finally {
    pedidosLiberacionPendiente.delete(idPedido);
  }
}

async function abrirModalCobrar(idPedido) {
```

Reemplázalo por (agrega las 3 funciones nuevas entre `liberarPedidoDomicilio` y `abrirModalCobrar`, todo lo demás igual):

```javascript
async function liberarPedidoDomicilio(idPedido) {
  if (!confirm('¿Marcar este domicilio como entregado? Se libera el cupo.')) return;
  const pedido = pedidos.find(p => p.id_pedido === idPedido);
  if (!pedido) return;

  pedidosLiberacionPendiente.add(idPedido);
  const estadoAnterior = pedido.estado;
  pedido.estado = 'Liberado';
  renderPrincipal();
  cerrarDetalle();

  try {
    const params = new URLSearchParams({ accion: 'liberar_pedido', id_pedido: idPedido });
    const res = await fetch(SCRIPT_URL + '?' + params.toString());
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');
  } catch (e) {
    pedido.estado = estadoAnterior;
    renderPrincipal();
    alert('No se pudo liberar el pedido: ' + e.message);
  } finally {
    pedidosLiberacionPendiente.delete(idPedido);
  }
}

function abrirDetalleMostrador(idPedido) {
  const pedido = pedidos.find(p => p.id_pedido === idPedido && p.tipo === 'mostrador');
  if (!pedido) return;

  mesaAbierta = null;
  domicilioAbierto = null;
  mostradorAbierto = idPedido;
  renderDetalleMostrador();
  document.getElementById('overlay-detalle').classList.remove('oculto');
}

function renderDetalleMostrador() {
  const pedido = pedidos.find(p => p.id_pedido === mostradorAbierto);
  if (!pedido || pedido.estado === 'Liberado') { cerrarDetalle(); return; }

  document.getElementById('detalle-contenido').innerHTML = `
    <h3>🧾 ${pedido.mesa || 'Sin nombre'}</h3>
    <div class="pedido-hora">${pedido.hora}</div>
    ${pedido.items.map(it => `<div class="item-row"><span>${it.cantidad}x ${it.producto}</span><span>${formatoCOP(it.total)}</span></div>`).join('')}
    <div class="pedido-total-row"><span>TOTAL</span><span>${formatoCOP(pedido.total)}</span></div>
    <div class="pedido-footer" style="flex-wrap:wrap;gap:8px;">
      <button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="imprimirReciboPorId('${pedido.id_pedido}')">🖨️ Reimprimir recibo</button>
      <button class="btn-liberar" onclick="marcarMostradorRecogido('${pedido.id_pedido}')">✅ Marcar recogido</button>
    </div>
    <button class="btn-cancelar" onclick="cerrarDetalle()">Cerrar</button>
  `;
}

async function marcarMostradorRecogido(idPedido) {
  if (!confirm('¿Marcar este pedido como recogido?')) return;
  const pedido = pedidos.find(p => p.id_pedido === idPedido);
  if (!pedido) return;

  pedidosLiberacionPendiente.add(idPedido);
  const estadoAnterior = pedido.estado;
  pedido.estado = 'Liberado';
  renderPrincipal();
  cerrarDetalle();

  try {
    const params = new URLSearchParams({ accion: 'liberar_pedido', id_pedido: idPedido });
    const res = await fetch(SCRIPT_URL + '?' + params.toString());
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');
  } catch (e) {
    pedido.estado = estadoAnterior;
    renderPrincipal();
    alert('No se pudo marcar el pedido como recogido: ' + e.message);
  } finally {
    pedidosLiberacionPendiente.delete(idPedido);
  }
}

async function abrirModalCobrar(idPedido) {
```

- [ ] **Step 5: Agregar la pestaña "Mostrador" al Historial**

Busca:

```javascript
      <div class="grupo-tabs">
        <button class="btn-tab ${vistaTipo === 'local' ? 'activa' : ''}" onclick="cambiarVistaTipo('local')">En el local</button>
        <button class="btn-tab ${vistaTipo === 'domicilio' ? 'activa' : ''}" onclick="cambiarVistaTipo('domicilio')">Domicilio</button>
      </div>
```

Reemplázala por:

```javascript
      <div class="grupo-tabs">
        <button class="btn-tab ${vistaTipo === 'local' ? 'activa' : ''}" onclick="cambiarVistaTipo('local')">En el local</button>
        <button class="btn-tab ${vistaTipo === 'domicilio' ? 'activa' : ''}" onclick="cambiarVistaTipo('domicilio')">Domicilio</button>
        <button class="btn-tab ${vistaTipo === 'mostrador' ? 'activa' : ''}" onclick="cambiarVistaTipo('mostrador')">Mostrador</button>
      </div>
```

Busca:

```javascript
  if (lista.length === 0) {
    cont.innerHTML = banner + filtrosHtml + `<div class="vacio-msg">No hay pedidos ${vistaEstado === 'pendientes' ? 'pendientes de pago' : 'pagados'} en ${vistaTipo === 'local' ? 'el local' : 'domicilio'} hoy.</div>`;
    return;
  }
```

Reemplázala por:

```javascript
  if (lista.length === 0) {
    const etiquetaVacio = vistaTipo === 'local' ? 'el local' : (vistaTipo === 'domicilio' ? 'domicilio' : 'mostrador');
    cont.innerHTML = banner + filtrosHtml + `<div class="vacio-msg">No hay pedidos ${vistaEstado === 'pendientes' ? 'pendientes de pago' : 'pagados'} en ${etiquetaVacio} hoy.</div>`;
    return;
  }
```

Busca:

```javascript
          <div class="pedido-titulo">${p.tipo === 'local' ? '🍽️ Mesa ' + (p.mesa || '—') : '🛵 Domicilio'}</div>
```

Reemplázala por:

```javascript
          <div class="pedido-titulo">${p.tipo === 'local' ? '🍽️ Mesa ' + (p.mesa || '—') : (p.tipo === 'mostrador' ? '🧾 ' + (p.mesa || 'Mostrador') : '🛵 Domicilio')}</div>
```

- [ ] **Step 6: Verificar sintaxis con `node --check` (caja.html)**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('caja.html', 'utf8');
const match = html.match(/<script>([\s\S]*)<\/script>/);
fs.writeFileSync('caja_check.js', match[1]);
"
node --check caja_check.js
rm caja_check.js
```

Expected: sin salida (éxito silencioso).

- [ ] **Step 7: Corregir la etiqueta de pedidos `mostrador` en `cocina.html` (lista + detalle + mesero)**

Busca (dentro de `render()`):

```javascript
    const etiqueta = p.tipo === 'domicilio' ? '🛵 Domicilio' : '🍽️ Mesa ' + (p.mesa || '—');
    return `
      <button class="btn-pedido${urgente ? ' urgente' : ''}${p.completo ? ' completo' : ''}" onclick="abrirDetallePedido('${p.id_pedido}')">
```

Reemplázala por:

```javascript
    const etiqueta = p.tipo === 'domicilio' ? '🛵 Domicilio' : (p.tipo === 'mostrador' ? '🧾 Mostrador: ' + (p.mesa || '—') : '🍽️ Mesa ' + (p.mesa || '—'));
    return `
      <button class="btn-pedido${urgente ? ' urgente' : ''}${p.completo ? ' completo' : ''}" onclick="abrirDetallePedido('${p.id_pedido}')">
```

Busca (dentro de `renderDetalle()`):

```javascript
  const min = minutosTranscurridos(p.hora);
  const urgente = !p.completo && min >= MINUTOS_URGENTE;
  const etiqueta = p.tipo === 'domicilio' ? '🛵 Domicilio' : '🍽️ Mesa ' + (p.mesa || '—');

  cont.innerHTML = `
    <button class="btn-regresar" onclick="cerrarDetallePedido()">← Regresar</button>
    <div class="pedido-card${urgente ? ' urgente' : ''}${p.completo ? ' completo' : ''}">
      <div class="pedido-header">
        <div>
          <div class="pedido-mesa">${etiqueta}</div>
          <div class="pedido-mesero">${p.tipo === 'domicilio' ? '' : (p.mesero ? '👤 ' + p.mesero : '📱 Autoservicio')}</div>
        </div>
```

Reemplázala por:

```javascript
  const min = minutosTranscurridos(p.hora);
  const urgente = !p.completo && min >= MINUTOS_URGENTE;
  const etiqueta = p.tipo === 'domicilio' ? '🛵 Domicilio' : (p.tipo === 'mostrador' ? '🧾 Mostrador: ' + (p.mesa || '—') : '🍽️ Mesa ' + (p.mesa || '—'));

  cont.innerHTML = `
    <button class="btn-regresar" onclick="cerrarDetallePedido()">← Regresar</button>
    <div class="pedido-card${urgente ? ' urgente' : ''}${p.completo ? ' completo' : ''}">
      <div class="pedido-header">
        <div>
          <div class="pedido-mesa">${etiqueta}</div>
          <div class="pedido-mesero">${p.tipo === 'domicilio' || p.tipo === 'mostrador' ? '' : (p.mesero ? '👤 ' + p.mesero : '📱 Autoservicio')}</div>
        </div>
```

- [ ] **Step 8: Verificar sintaxis con `node --check` (cocina.html)**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('cocina.html', 'utf8');
const match = html.match(/<script>([\s\S]*)<\/script>/);
fs.writeFileSync('cocina_check.js', match[1]);
"
node --check cocina_check.js
rm cocina_check.js
```

Expected: sin salida (éxito silencioso).

- [ ] **Step 9: Ctrl+F de duplicados**

Confirma que cada uno de estos nombres aparece **una sola vez** como declaración en `caja.html`: `abrirDetalleMostrador`, `renderDetalleMostrador`, `marcarMostradorRecogido`, `mostradorAbierto`.

- [ ] **Step 10: Traza manual de los 3 escenarios (sin navegador disponible)**

1. **Grid con un pedido `mostrador` `Pagado`**: `renderGrid()` calcula `activosMostrador` filtrando `p.tipo === 'mostrador' && p.estado === 'Pagado'` → `recogerHtml` no queda vacío → aparece la sección "Para recoger" con ese pedido. Un pedido `mostrador` que sigue `Pendiente de pago` (cancelado o fallido en Task 1) **no** debe aparecer aquí — confirma que el filtro exige `estado === 'Pagado'` exactamente.
2. **Historial, pestaña Mostrador**: `cambiarVistaTipo('mostrador')` → `vistaTipo = 'mostrador'` → `renderHistorial()` filtra `p.tipo === vistaTipo` → solo pedidos `mostrador` aparecen, con el botón "Cobrar" visible si `estado === 'Pendiente de pago'` (reutilizando `abrirModalCobrar`, sin cambios ahí) — así es como un pedido cancelado/fallido de Task 1 se recupera y cobra manualmente.
3. **`cocina.html` con un pedido `mostrador`**: en la lista, `etiqueta` da `'🧾 Mostrador: <nombre>'`; al abrir el detalle, la misma etiqueta se repite y `pedido-mesero` queda vacío (no debe decir "📱 Autoservicio", que sería confuso para un pedido de mostrador) — confirma que la condición del `pedido-mesero` incluye `p.tipo === 'mostrador'` en la rama que devuelve `''`.
4. **Exclusividad de detalle abierto**: abre el detalle de un pedido de mostrador (`mostradorAbierto` queda con un id) y, sin cerrarlo, abre el detalle de una mesa ocupada (`abrirDetalleMesa`) — confirma leyendo el código que `abrirDetalleMesa` deja `mostradorAbierto = null` (y viceversa con `abrirDetalleDomicilio`), para que `cargarPedidos()` nunca llame a dos funciones `renderDetalle*` distintas sobre el mismo `#detalle-contenido` en el siguiente refresco automático.

- [ ] **Step 11: Commit**

```bash
git add caja.html cocina.html
git commit -m "$(cat <<'EOF'
feat: show Venta Rápida orders in caja.html grid/Historial and cocina.html

Adds a "Para recoger" list to the caja.html grid (mostrador orders that
are paid but not yet picked up), a matching detail view with "Marcar
recogido" (reuses liberar_pedido), and a "Mostrador" tab in Historial so
a mostrador order left Pendiente de pago (cancelled/failed payment in
the previous task) stays findable and cobrable. Fixes cocina.html's
label logic, which defaulted any non-domicilio order to "Mesa X" and
would have mislabeled mostrador orders.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Al terminar ambas tareas

Después del merge a `master`, antes de darlo por cerrado:
1. Pushear a GitHub.
2. Pedirle al usuario que pruebe con clics reales en el sitio publicado: abrir Venta Rápida, armar un pedido, probar "Cobrar y entregar" (confirmar que no aparece en "Para recoger"), probar "Cobrar y dejar para recoger" con un nombre (confirmar que aparece en la lista, y que "Marcar recogido" lo quita), confirmar que ambos aparecen correctamente en `cocina.html`, y confirmar que un pedido `mostrador` no cuenta para ningún mesero en `comisiones.html`.
3. Borrar cualquier dato de prueba que quede en el Sheet real (`Ventas`) después de esa prueba.
