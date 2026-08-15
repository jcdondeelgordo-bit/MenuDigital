# Calculadora de devuelta en Efectivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En los 4 lugares de `caja.html` donde se puede cobrar en Efectivo, mostrar un panel obligatorio que calcula la devuelta antes de confirmar el cobro, y guardar recibido/devuelta en el Sheet y en el recibo impreso.

**Architecture:** Un panel único (`overlay-efectivo`) y 3 variables de estado (`efectivoTotal`/`efectivoValor`/`efectivoCallback`) reemplazan el confirmar directo del botón "💵 Efectivo" en los 3 modales existentes (`overlay-cobrar`, `overlay-cobrar-parcial`, `overlay-cobrar-vr`). Las 4 funciones de confirmación (`confirmarCobro`, `confirmarCobroMesa`, `confirmarCobroParcial`, `confirmarCobroVentaRapida`) ganan 2 parámetros opcionales que viajan hasta el backend y el recibo.

**Tech Stack:** HTML/JS plano, Google Apps Script, Vercel edge function como proxy transparente (sin cambios).

## Global Constraints

- Spec: [2026-08-15-calculadora-devuelta-efectivo-design.md](../specs/2026-08-15-calculadora-devuelta-efectivo-design.md).
- Nequi/Tarjeta no cambian — solo Efectivo pasa por el panel nuevo.
- El botón "Confirmar" del panel queda deshabilitado mientras el valor escrito sea menor al total — no se puede registrar un cobro incompleto.
- El Apps Script real no se edita por API — los 2 archivos de referencia (Módulo 9 y Módulo 4) se actualizan en el repo, y el usuario los pega/publica a mano en sus respectivos editores reales.
- El cobro (Estado=Pagado) nunca depende de que el registro de recibido/devuelta tenga éxito.

---

### Task 1: Backend — `marcarPedidoPagado` guarda recibido/devuelta

**Files:**
- Modify: `Gestion_Proyecto/01-modulos/modulo-9-apps-script-caja.gs.txt:102-134`

**Interfaces:**
- Produces: `marcarPedidoPagado(e)` acepta `e.parameter.efectivo_recibido`/`e.parameter.efectivo_devuelta` (opcionales).

- [ ] **Step 1: Reemplazar la función completa**

Reemplazar el bloque actual (líneas 102-134):

```js
function marcarPedidoPagado(e) {
  const idPedido = e.parameter.id_pedido || '';
  const metodoPago = e.parameter.metodo_pago || '';

  if (!idPedido || ['Efectivo', 'Nequi', 'Tarjeta'].indexOf(metodoPago) === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Falta id_pedido o metodo_pago inválido' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const hoja = SpreadsheetApp.getActive().getSheetByName('Ventas');
  const datos = hoja.getDataRange().getValues();
  const encabezados = datos[0];
  const idxIdPedido = encabezados.indexOf('ID_Pedido');
  const idxEstado = encabezados.indexOf('Estado');
  const idxMetodoPago = encabezados.indexOf('Metodo_Pago');

  let encontrado = false;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idxIdPedido] === idPedido) {
      hoja.getRange(i + 1, idxEstado + 1).setValue('Pagado');
      hoja.getRange(i + 1, idxMetodoPago + 1).setValue(metodoPago);
      encontrado = true;
    }
  }

  if (!encontrado) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se encontró ese pedido' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

por:

```js
function marcarPedidoPagado(e) {
  const idPedido = e.parameter.id_pedido || '';
  const metodoPago = e.parameter.metodo_pago || '';
  const efectivoRecibido = e.parameter.efectivo_recibido || '';
  const efectivoDevuelta = e.parameter.efectivo_devuelta || '';

  if (!idPedido || ['Efectivo', 'Nequi', 'Tarjeta'].indexOf(metodoPago) === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Falta id_pedido o metodo_pago inválido' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const hoja = SpreadsheetApp.getActive().getSheetByName('Ventas');
  const datos = hoja.getDataRange().getValues();
  const encabezados = datos[0];
  const idxIdPedido = encabezados.indexOf('ID_Pedido');
  const idxEstado = encabezados.indexOf('Estado');
  const idxMetodoPago = encabezados.indexOf('Metodo_Pago');
  const idxEfectivoRecibido = encabezados.indexOf('Efectivo_Recibido');
  const idxEfectivoDevuelta = encabezados.indexOf('Efectivo_Devuelta');

  let encontrado = false;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idxIdPedido] === idPedido) {
      hoja.getRange(i + 1, idxEstado + 1).setValue('Pagado');
      hoja.getRange(i + 1, idxMetodoPago + 1).setValue(metodoPago);
      // Columnas nuevas -- si el Sheet todavía no las tiene (indexOf da -1), se
      // omite la escritura puntual sin romper el resto del cobro.
      if (metodoPago === 'Efectivo' && efectivoRecibido && idxEfectivoRecibido !== -1) {
        hoja.getRange(i + 1, idxEfectivoRecibido + 1).setValue(Number(efectivoRecibido));
      }
      if (metodoPago === 'Efectivo' && efectivoDevuelta && idxEfectivoDevuelta !== -1) {
        hoja.getRange(i + 1, idxEfectivoDevuelta + 1).setValue(Number(efectivoDevuelta));
      }
      encontrado = true;
    }
  }

  if (!encontrado) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se encontró ese pedido' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 2: Verificar sintaxis y que no quedó duplicada**

```bash
node --check "Gestion_Proyecto/01-modulos/modulo-9-apps-script-caja.gs.txt"
grep -c "function marcarPedidoPagado" "Gestion_Proyecto/01-modulos/modulo-9-apps-script-caja.gs.txt"
```
Expected: sin errores de sintaxis; el grep devuelve `1`.

- [ ] **Step 3: Commit**

```bash
git add "Gestion_Proyecto/01-modulos/modulo-9-apps-script-caja.gs.txt"
git commit -m "feat: marcarPedidoPagado guarda efectivo recibido y devuelta"
```

---

### Task 2: Backend — `registrarPagoParcial` guarda recibido/devuelta

**Files:**
- Modify: `Gestion_Proyecto/01-modulos/modulo-4-apps-script-division.gs.txt:39-92`

**Interfaces:**
- Produces: `registrarPagoParcial(e)` acepta `e.parameter.efectivo_recibido`/`e.parameter.efectivo_devuelta` (opcionales).

- [ ] **Step 1: Agregar la lectura de los 2 parámetros nuevos**

Reemplazar:
```js
function registrarPagoParcial(e) {
  const idPedido = e.parameter.id_pedido || '';
  const persona = e.parameter.persona || '';
  const monto = Number(e.parameter.monto);
  const metodoPago = e.parameter.metodo_pago || '';
  const detalle = e.parameter.detalle || '';
```
por:
```js
function registrarPagoParcial(e) {
  const idPedido = e.parameter.id_pedido || '';
  const persona = e.parameter.persona || '';
  const monto = Number(e.parameter.monto);
  const metodoPago = e.parameter.metodo_pago || '';
  const detalle = e.parameter.detalle || '';
  const efectivoRecibido = e.parameter.efectivo_recibido || '';
  const efectivoDevuelta = e.parameter.efectivo_devuelta || '';
```

- [ ] **Step 2: Agregar los 2 valores a la fila que se guarda en `Pagos_Divididos`**

Reemplazar:
```js
  const ahora = new Date();
  hojaPagos.appendRow([idPedido, ahora, ahora, persona, monto, metodoPago, detalle]);
```
por:
```js
  const ahora = new Date();
  hojaPagos.appendRow([idPedido, ahora, ahora, persona, monto, metodoPago, detalle, efectivoRecibido, efectivoDevuelta]);
```

**Importante (a diferencia de Task 1):** `appendRow` escribe por posición, no por nombre de columna — a diferencia de `marcarPedidoPagado` (que usa `indexOf`+`getRange` y tolera columnas faltantes), aquí las columnas `Efectivo_Recibido`/`Efectivo_Devuelta` DEBEN existir ya en `Pagos_Divididos`, como columnas 8 y 9 (justo después de `Detalle`), antes de publicar este cambio — si no, los valores quedan en las columnas equivocadas o crean columnas nuevas sin encabezado.

- [ ] **Step 3: Verificar sintaxis y que no quedó duplicada**

```bash
node --check "Gestion_Proyecto/01-modulos/modulo-4-apps-script-division.gs.txt"
grep -c "function registrarPagoParcial" "Gestion_Proyecto/01-modulos/modulo-4-apps-script-division.gs.txt"
```
Expected: sin errores; el grep devuelve `1`.

- [ ] **Step 4: Commit**

```bash
git add "Gestion_Proyecto/01-modulos/modulo-4-apps-script-division.gs.txt"
git commit -m "feat: registrarPagoParcial guarda efectivo recibido y devuelta"
```

---

### Task 3: Frontend — panel `overlay-efectivo` (HTML + CSS + estado)

**Files:**
- Modify: `caja.html` (HTML nuevo cerca de `overlay-cobrar`, línea 188-196; CSS nuevo cerca de `.modal-cobrar`, línea 106-107; JS nuevo)

**Interfaces:**
- Produces: `abrirCalculadoraEfectivo(total, callback)`, donde `callback` es `(recibido: number, devuelta: number) => void`. Usada por las Tasks 4, 5 y 6.

- [ ] **Step 1: Agregar el HTML del panel, justo después de `overlay-cobrar` (después de la línea 196, `</div>` que cierra ese overlay)**

```html
<div class="overlay oculto" id="overlay-efectivo">
  <div class="modal-cobrar">
    <h3>💵 Pago en efectivo</h3>
    <div class="efectivo-total-row"><span>Total a pagar</span><span id="efectivo-total">$0</span></div>
    <label class="efectivo-label">Paga con</label>
    <input type="number" id="efectivo-input" class="efectivo-input" placeholder="0" oninput="actualizarValorEfectivoDesdeInput()">
    <div class="efectivo-billetes">
      <button type="button" onclick="agregarBilleteEfectivo(2000)">$2mil</button>
      <button type="button" onclick="agregarBilleteEfectivo(5000)">$5mil</button>
      <button type="button" onclick="agregarBilleteEfectivo(10000)">$10mil</button>
      <button type="button" onclick="agregarBilleteEfectivo(20000)">$20mil</button>
      <button type="button" onclick="agregarBilleteEfectivo(50000)">$50mil</button>
      <button type="button" onclick="agregarBilleteEfectivo(100000)">$100mil</button>
    </div>
    <button type="button" class="btn-cancelar" onclick="borrarEfectivo()">Borrar</button>
    <div class="efectivo-devuelta-row"><span>Devuelta</span><span id="efectivo-devuelta" class="efectivo-devuelta-valor negativo">Falta $0</span></div>
    <button class="btn-cobrar" id="btn-confirmar-efectivo" onclick="confirmarCalculadoraEfectivo()" disabled>Confirmar</button>
    <button class="btn-cancelar" onclick="cerrarCalculadoraEfectivo()">Cancelar</button>
  </div>
</div>
```

- [ ] **Step 2: Agregar el CSS, junto a `.modal-cobrar h3` (línea 107)**

```css
.efectivo-total-row,.efectivo-devuelta-row{display:flex;justify-content:space-between;align-items:center;font-size:1rem;}
.efectivo-total-row span:last-child{font-size:1.3rem;font-weight:800;color:#f3e6d0;}
.efectivo-label{font-size:0.8rem;color:rgba(201,184,154,0.8);margin-top:4px;}
.efectivo-input{width:100%;padding:12px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(202,161,83,0.35);color:#fff;font-size:1.4rem;text-align:center;font-weight:700;}
.efectivo-billetes{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
.efectivo-billetes button{padding:10px 4px;border-radius:8px;border:1px solid rgba(202,161,83,0.35);background:rgba(255,255,255,0.05);color:#f3e6d0;font-size:0.8rem;font-weight:700;cursor:pointer;}
.efectivo-devuelta-row span:last-child{font-size:1.6rem;font-weight:800;}
.efectivo-devuelta-valor.negativo{color:#e05050;}
.efectivo-devuelta-valor.positivo{color:#4caf50;}
#btn-confirmar-efectivo:disabled{opacity:0.4;cursor:not-allowed;}
```

- [ ] **Step 3: Agregar el estado y las funciones del panel (en el `<script>`, cerca de las otras variables de cobro como `montoParaCobrarParcial`)**

```js
let efectivoTotal = 0;
let efectivoValor = 0;
let efectivoCallback = null;

function abrirCalculadoraEfectivo(total, callback) {
  efectivoTotal = total;
  efectivoValor = 0;
  efectivoCallback = callback;
  document.getElementById('efectivo-input').value = '';
  actualizarPantallaEfectivo();
  document.getElementById('overlay-efectivo').classList.remove('oculto');
}

function agregarBilleteEfectivo(valor) {
  efectivoValor += valor;
  document.getElementById('efectivo-input').value = efectivoValor;
  actualizarPantallaEfectivo();
}

function actualizarValorEfectivoDesdeInput() {
  const v = parseInt(document.getElementById('efectivo-input').value, 10);
  efectivoValor = isNaN(v) ? 0 : v;
  actualizarPantallaEfectivo();
}

function borrarEfectivo() {
  efectivoValor = 0;
  document.getElementById('efectivo-input').value = '';
  actualizarPantallaEfectivo();
}

function actualizarPantallaEfectivo() {
  document.getElementById('efectivo-total').textContent = formatoCOP(efectivoTotal);
  const devuelta = efectivoValor - efectivoTotal;
  const elDevuelta = document.getElementById('efectivo-devuelta');
  const btnConfirmar = document.getElementById('btn-confirmar-efectivo');
  if (devuelta < 0) {
    elDevuelta.textContent = 'Falta ' + formatoCOP(-devuelta);
    elDevuelta.className = 'efectivo-devuelta-valor negativo';
    btnConfirmar.disabled = true;
  } else {
    elDevuelta.textContent = formatoCOP(devuelta);
    elDevuelta.className = 'efectivo-devuelta-valor positivo';
    btnConfirmar.disabled = false;
  }
}

function cerrarCalculadoraEfectivo() {
  document.getElementById('overlay-efectivo').classList.add('oculto');
  efectivoCallback = null;
}

function confirmarCalculadoraEfectivo() {
  if (efectivoValor < efectivoTotal) return; // guard extra -- el botón ya queda disabled
  const recibido = efectivoValor;
  const devuelta = efectivoValor - efectivoTotal;
  const cb = efectivoCallback;
  cerrarCalculadoraEfectivo();
  if (cb) cb(recibido, devuelta);
}
```

- [ ] **Step 4: Verificar sintaxis**

```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('caja.html','utf8'); const m=h.match(/<script>([\s\S]*?)<\/script>/); fs.writeFileSync('/tmp/_caja_check.js', m[1]);"
node --check /tmp/_caja_check.js
```
Expected: sin errores. (Nota: `caja.html` puede tener más de un `<script>` según el archivo real — si el regex no captura el bloque principal, ajustar a `/<script>([\s\S]*?)<\/script>/g` y concatenar todos los bloques antes de escribir el archivo temporal.)

- [ ] **Step 5: Prueba manual en navegador**

Con `zfood-static` corriendo, abrir `http://localhost:8791/caja.html`, y desde la consola:
```js
abrirCalculadoraEfectivo(45000, (r, d) => console.log('confirmado', r, d));
```
Expected: el panel se abre, "Total a pagar" muestra $45.000, "Confirmar" está deshabilitado. Tocar `$50mil` → el campo muestra 50000, la devuelta muestra $5.000 en verde, "Confirmar" se habilita. Tocar "Borrar" → todo vuelve a $0 y a "Falta $45.000" en rojo, "Confirmar" deshabilitado de nuevo. Tocar "Confirmar" con $50.000 puestos → la consola imprime `confirmado 50000 5000`. Confirmar con un screenshot.

- [ ] **Step 6: Commit**

```bash
git add caja.html
git commit -m "feat: agrega el panel de calculadora de devuelta en efectivo a caja.html"
```

---

### Task 4: Wiring — cobro individual y de mesa completa

**Files:**
- Modify: `caja.html:191` (botón), `caja.html:1260-1297` (`confirmarCobro`), `caja.html:1299-1338` (`confirmarCobroMesa`), `caja.html:948-969` (`imprimirRecibo`)

**Interfaces:**
- Consumes: `abrirCalculadoraEfectivo` (Task 3), `pedidos`/`pedidoIdParaCobrar`/`cobroModo`/`idsParaCobrarMesa` (variables ya existentes).

- [ ] **Step 1: Cambiar el botón Efectivo del modal principal**

Reemplazar:
```html
    <button class="btn-metodo" onclick="confirmarCobro('Efectivo')">💵 Efectivo</button>
```
por:
```html
    <button class="btn-metodo" onclick="abrirCalculadoraEfectivoCobro()">💵 Efectivo</button>
```

- [ ] **Step 2: Agregar la función `abrirCalculadoraEfectivoCobro`, cerca de `confirmarCobro`**

```js
function abrirCalculadoraEfectivoCobro() {
  let total = 0;
  if (cobroModo === 'mesa') {
    total = idsParaCobrarMesa.reduce((s, id) => {
      const p = pedidos.find(x => x.id_pedido === id);
      return s + (p ? p.total : 0);
    }, 0);
  } else {
    const p = pedidos.find(x => x.id_pedido === pedidoIdParaCobrar);
    total = p ? p.total : 0;
  }
  document.getElementById('overlay-cobrar').classList.add('oculto');
  abrirCalculadoraEfectivo(total, function (recibido, devuelta) {
    confirmarCobro('Efectivo', recibido, devuelta);
  });
}
```

Nota: se oculta `overlay-cobrar` directo con `classList.add('oculto')` (NO se llama `cerrarModalCobrar()`, que resetea `pedidoIdParaCobrar`/`cobroModo`/`idsParaCobrarMesa` — esas variables las necesita `confirmarCobro` cuando corra el callback).

- [ ] **Step 3: Modificar `confirmarCobro` para aceptar y usar `recibido`/`devuelta`**

Reemplazar:
```js
async function confirmarCobro(metodo) {
  const idPedido = pedidoIdParaCobrar;
  const modo = cobroModo;
  const numMesaCobrar = mesaParaCobrar;
  const idsCobrar = idsParaCobrarMesa.slice();
  cerrarModalCobrar();
  if (modo === 'mesa') { await confirmarCobroMesa(numMesaCobrar, idsCobrar, metodo); return; }

  if (!idPedido) return;

  pedidosPagoPendiente.add(idPedido);
  const pedido = pedidos.find(p => p.id_pedido === idPedido);
  const estadoAnterior = pedido ? pedido.estado : null;
  const metodoPagoAnterior = pedido ? pedido.metodo_pago : '';
  if (pedido) { pedido.estado = 'Pagado'; pedido.metodo_pago = metodo; }
  renderPrincipal();

  try {
    const params = new URLSearchParams({ accion: 'marcar_pedido_pagado', id_pedido: idPedido, metodo_pago: metodo });
    const res = await fetch(SCRIPT_URL + '?' + params.toString());
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');
    if (pedido && pedido.tipo === 'local') imprimirRecibo(pedido);
  } catch (e) {
    if (pedido) { pedido.estado = estadoAnterior; pedido.metodo_pago = metodoPagoAnterior; }
    renderPrincipal();
    alert('No se pudo registrar el cobro. Intenta de nuevo.');
  } finally {
    pedidosPagoPendiente.delete(idPedido);
  }
}
```
por:
```js
async function confirmarCobro(metodo, recibido, devuelta) {
  const idPedido = pedidoIdParaCobrar;
  const modo = cobroModo;
  const numMesaCobrar = mesaParaCobrar;
  const idsCobrar = idsParaCobrarMesa.slice();
  cerrarModalCobrar();
  if (modo === 'mesa') { await confirmarCobroMesa(numMesaCobrar, idsCobrar, metodo, recibido, devuelta); return; }

  if (!idPedido) return;

  pedidosPagoPendiente.add(idPedido);
  const pedido = pedidos.find(p => p.id_pedido === idPedido);
  const estadoAnterior = pedido ? pedido.estado : null;
  const metodoPagoAnterior = pedido ? pedido.metodo_pago : '';
  if (pedido) { pedido.estado = 'Pagado'; pedido.metodo_pago = metodo; }
  renderPrincipal();

  try {
    const params = { accion: 'marcar_pedido_pagado', id_pedido: idPedido, metodo_pago: metodo };
    if (recibido !== undefined) { params.efectivo_recibido = String(recibido); params.efectivo_devuelta = String(devuelta); }
    const res = await fetch(SCRIPT_URL + '?' + new URLSearchParams(params).toString());
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');
    if (pedido && pedido.tipo === 'local') {
      if (recibido !== undefined) { pedido.efectivoRecibido = recibido; pedido.efectivoDevuelta = devuelta; }
      imprimirRecibo(pedido);
    }
  } catch (e) {
    if (pedido) { pedido.estado = estadoAnterior; pedido.metodo_pago = metodoPagoAnterior; }
    renderPrincipal();
    alert('No se pudo registrar el cobro. Intenta de nuevo.');
  } finally {
    pedidosPagoPendiente.delete(idPedido);
  }
}
```

- [ ] **Step 4: Modificar `confirmarCobroMesa` para aceptar y propagar `recibido`/`devuelta`**

Reemplazar la firma y el bloque de `Promise.all` + `imprimirRecibo`:
```js
async function confirmarCobroMesa(numMesa, idsCobrar, metodo) {
```
por:
```js
async function confirmarCobroMesa(numMesa, idsCobrar, metodo, recibido, devuelta) {
```

Reemplazar:
```js
    const resultados = await Promise.all(idsAfectados.map(id => {
      const params = new URLSearchParams({ accion: 'marcar_pedido_pagado', id_pedido: id, metodo_pago: metodo });
      return fetch(SCRIPT_URL + '?' + params.toString()).then(r => r.json());
    }));
    if (resultados.some(d => !d || d.ok !== true)) throw new Error('El servidor rechazó al menos uno de los cobros de esta mesa');

    const itemsCombinados = [];
    pendientes.forEach(p => p.items.forEach(it => itemsCombinados.push(it)));
    const totalCombinado = pendientes.reduce((s, p) => s + p.total, 0);
    imprimirRecibo({ tipo: 'local', mesa: numMesa, items: itemsCombinados, total: totalCombinado, metodo_pago: metodo });
```
por:
```js
    const resultados = await Promise.all(idsAfectados.map(id => {
      const params = { accion: 'marcar_pedido_pagado', id_pedido: id, metodo_pago: metodo };
      if (recibido !== undefined) { params.efectivo_recibido = String(recibido); params.efectivo_devuelta = String(devuelta); }
      return fetch(SCRIPT_URL + '?' + new URLSearchParams(params).toString()).then(r => r.json());
    }));
    if (resultados.some(d => !d || d.ok !== true)) throw new Error('El servidor rechazó al menos uno de los cobros de esta mesa');

    const itemsCombinados = [];
    pendientes.forEach(p => p.items.forEach(it => itemsCombinados.push(it)));
    const totalCombinado = pendientes.reduce((s, p) => s + p.total, 0);
    imprimirRecibo({ tipo: 'local', mesa: numMesa, items: itemsCombinados, total: totalCombinado, metodo_pago: metodo, efectivoRecibido: recibido, efectivoDevuelta: devuelta });
```

- [ ] **Step 5: Modificar `imprimirRecibo` para agregar las 2 líneas cuando hay recibido**

Reemplazar:
```js
    <div class="recibo-item recibo-negrita"><span>TOTAL</span><span>${formatoCOP(pedido.total)}</span></div>
    <div class="recibo-linea">Pago: ${pedido.metodo_pago}</div>
    <div class="recibo-separador"></div>
```
por:
```js
    <div class="recibo-item recibo-negrita"><span>TOTAL</span><span>${formatoCOP(pedido.total)}</span></div>
    <div class="recibo-linea">Pago: ${pedido.metodo_pago}</div>
    ${pedido.efectivoRecibido !== undefined ? `
    <div class="recibo-linea">Recibió: ${formatoCOP(pedido.efectivoRecibido)}</div>
    <div class="recibo-linea">Devuelta: ${formatoCOP(pedido.efectivoDevuelta)}</div>` : ''}
    <div class="recibo-separador"></div>
```

(Se usa `pedido.efectivoRecibido !== undefined` en vez de comparar `metodo_pago === 'Efectivo'`, porque en el flujo de pago dividido — Task 5 — `metodo_pago` termina siendo un texto compuesto como `"Efectivo — Juan"`, no el string exacto `"Efectivo"`.)

- [ ] **Step 6: Verificar sintaxis**

```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('caja.html','utf8'); const m=h.match(/<script>([\s\S]*?)<\/script>/); fs.writeFileSync('/tmp/_caja_check.js', m[1]);"
node --check /tmp/_caja_check.js
```

- [ ] **Step 7: Commit**

```bash
git add caja.html
git commit -m "feat: cobro individual y de mesa completa usan la calculadora de devuelta"
```

---

### Task 5: Wiring — pago dividido

**Files:**
- Modify: `caja.html:244` (botón), `caja.html:527-598ish` (`confirmarCobroParcial`)

**Interfaces:**
- Consumes: `abrirCalculadoraEfectivo` (Task 3), `montoParaCobrarParcial` (variable ya existente).

- [ ] **Step 1: Cambiar el botón Efectivo del modal de pago parcial**

Reemplazar:
```html
    <button class="btn-metodo" onclick="confirmarCobroParcial('Efectivo')">💵 Efectivo</button>
```
por:
```html
    <button class="btn-metodo" onclick="abrirCalculadoraEfectivoParcial()">💵 Efectivo</button>
```

- [ ] **Step 2: Agregar la función `abrirCalculadoraEfectivoParcial`, cerca de `confirmarCobroParcial`**

```js
function abrirCalculadoraEfectivoParcial() {
  document.getElementById('overlay-cobrar-parcial').classList.add('oculto');
  abrirCalculadoraEfectivo(montoParaCobrarParcial, function (recibido, devuelta) {
    confirmarCobroParcial('Efectivo', recibido, devuelta);
  });
}
```

- [ ] **Step 3: Modificar `confirmarCobroParcial` para aceptar y usar `recibido`/`devuelta`**

Reemplazar la firma:
```js
async function confirmarCobroParcial(metodo) {
```
por:
```js
async function confirmarCobroParcial(metodo, recibido, devuelta) {
```

Reemplazar:
```js
    const params = new URLSearchParams({
      accion: 'registrar_pago_parcial',
      id_pedido: idPedido,
      persona: persona,
      monto: monto,
      metodo_pago: metodo,
      detalle: detalle
    });
    const res = await fetch(SCRIPT_URL + '?' + params.toString());
```
por:
```js
    const paramsObj = {
      accion: 'registrar_pago_parcial',
      id_pedido: idPedido,
      persona: persona,
      monto: monto,
      metodo_pago: metodo,
      detalle: detalle
    };
    if (recibido !== undefined) { paramsObj.efectivo_recibido = String(recibido); paramsObj.efectivo_devuelta = String(devuelta); }
    const res = await fetch(SCRIPT_URL + '?' + new URLSearchParams(paramsObj).toString());
```

Reemplazar:
```js
    imprimirRecibo({
      tipo: pedidoTipo,
      mesa: pedidoMesa,
      items: itemsRecibo,
      total: monto,
      metodo_pago: metodo + ' — ' + persona + (data.completado ? '' : ' · PAGO PARCIAL, falta ' + formatoCOP(data.restante))
    });
```
por:
```js
    imprimirRecibo({
      tipo: pedidoTipo,
      mesa: pedidoMesa,
      items: itemsRecibo,
      total: monto,
      metodo_pago: metodo + ' — ' + persona + (data.completado ? '' : ' · PAGO PARCIAL, falta ' + formatoCOP(data.restante)),
      efectivoRecibido: recibido,
      efectivoDevuelta: devuelta
    });
```

- [ ] **Step 4: Verificar sintaxis**

```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('caja.html','utf8'); const m=h.match(/<script>([\s\S]*?)<\/script>/); fs.writeFileSync('/tmp/_caja_check.js', m[1]);"
node --check /tmp/_caja_check.js
```

- [ ] **Step 5: Commit**

```bash
git add caja.html
git commit -m "feat: pago dividido usa la calculadora de devuelta en efectivo"
```

---

### Task 6: Wiring — Venta Rápida

**Files:**
- Modify: `caja.html:286` (botón), `caja.html:901-945ish` (`confirmarCobroVentaRapida`)

**Interfaces:**
- Consumes: `abrirCalculadoraEfectivo` (Task 3), `itemsVentaRapidaSnapshot` (variable ya existente, poblada antes de abrir este modal).

- [ ] **Step 1: Cambiar el botón Efectivo del modal de Venta Rápida**

Reemplazar:
```html
    <button class="btn-metodo" onclick="confirmarCobroVentaRapida('Efectivo')">💵 Efectivo</button>
```
por:
```html
    <button class="btn-metodo" onclick="abrirCalculadoraEfectivoVR()">💵 Efectivo</button>
```

- [ ] **Step 2: Agregar la función `abrirCalculadoraEfectivoVR`, cerca de `confirmarCobroVentaRapida`**

```js
function abrirCalculadoraEfectivoVR() {
  const total = itemsVentaRapidaSnapshot.reduce((s, i) => s + i.precio * i.cantidad, 0);
  document.getElementById('overlay-cobrar-vr').classList.add('oculto');
  abrirCalculadoraEfectivo(total, function (recibido, devuelta) {
    confirmarCobroVentaRapida('Efectivo', recibido, devuelta);
  });
}
```

- [ ] **Step 3: Modificar `confirmarCobroVentaRapida` para aceptar y usar `recibido`/`devuelta`**

Reemplazar la firma:
```js
async function confirmarCobroVentaRapida(metodo) {
```
por:
```js
async function confirmarCobroVentaRapida(metodo, recibido, devuelta) {
```

Reemplazar:
```js
  try {
    const params = new URLSearchParams({ accion: 'marcar_pedido_pagado', id_pedido: idPedido, metodo_pago: metodo });
    const res = await fetch(SCRIPT_URL + '?' + params.toString());
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');

    if (entregar) {
      const paramsLib = new URLSearchParams({ accion: 'liberar_pedido', id_pedido: idPedido });
      await fetch(SCRIPT_URL + '?' + paramsLib.toString());
    }

    imprimirRecibo({ tipo: 'mostrador', mesa: nombre, items: itemsRecibo, total: total, metodo_pago: metodo });
```
por:
```js
  try {
    const params = { accion: 'marcar_pedido_pagado', id_pedido: idPedido, metodo_pago: metodo };
    if (recibido !== undefined) { params.efectivo_recibido = String(recibido); params.efectivo_devuelta = String(devuelta); }
    const res = await fetch(SCRIPT_URL + '?' + new URLSearchParams(params).toString());
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');

    if (entregar) {
      const paramsLib = new URLSearchParams({ accion: 'liberar_pedido', id_pedido: idPedido });
      await fetch(SCRIPT_URL + '?' + paramsLib.toString());
    }

    imprimirRecibo({ tipo: 'mostrador', mesa: nombre, items: itemsRecibo, total: total, metodo_pago: metodo, efectivoRecibido: recibido, efectivoDevuelta: devuelta });
```

- [ ] **Step 4: Verificar sintaxis**

```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('caja.html','utf8'); const m=h.match(/<script>([\s\S]*?)<\/script>/); fs.writeFileSync('/tmp/_caja_check.js', m[1]);"
node --check /tmp/_caja_check.js
```

- [ ] **Step 5: Prueba manual completa en navegador (servidor local, sin backend real)**

Con `zfood-static` corriendo, abrir `http://localhost:8791/caja.html`. Simular los 4 flujos desde la consola sobreescribiendo temporalmente `confirmarCobro`/`confirmarCobroParcial`/`confirmarCobroVentaRapida` con stubs que solo registren los argumentos recibidos (mismo patrón ya usado para verificar el fix de mesero-por-QR), para confirmar que cada `abrirCalculadoraEfectivo*` calcula el total correcto y que el callback llega con `recibido`/`devuelta` numéricos. Tomar un screenshot del panel abierto con billetes tocados.

- [ ] **Step 6: Commit**

```bash
git add caja.html
git commit -m "feat: Venta Rapida usa la calculadora de devuelta en efectivo"
```

---

### Task 7: Publicar el backend real y verificar

**Files:** ninguno

- [ ] **Step 1: El usuario agrega las columnas `Efectivo_Recibido`/`Efectivo_Devuelta`** al final de `Ventas` y como columnas 8/9 (justo después de `Detalle`) en `Pagos_Divididos`, en el Sheet real.

- [ ] **Step 2: El usuario pega y publica los 2 archivos de Apps Script actualizados** (Módulo 9 en el proyecto de Menú, Módulo 4 también en el proyecto de Menú — confirmar con Ctrl+F que `marcarPedidoPagado` y `registrarPagoParcial` aparecen una sola vez cada una en sus editores reales antes de publicar).

- [ ] **Step 3: Verificación con un pedido de prueba real, claramente marcado, y limpieza después**

Esta acción SÍ escribe en el Sheet real (a diferencia del resumen de mesa, que es de solo lectura) — usar un producto/nombre de prueba obvio, nunca uno del catálogo real, y borrar la fila después. Ejemplo con `curl` contra producción:
```bash
curl -s "https://donde-el-gordo.vercel.app/api/proxy-menu?accion=marcar_pedido_pagado&id_pedido=<UUID_DE_PRUEBA_YA_CREADO>&metodo_pago=Efectivo&efectivo_recibido=50000&efectivo_devuelta=5000"
```
(requiere sesión de Cajero -- más simple probarlo con clics reales desde `caja.html` ya logueado, cobrando un pedido de prueba y confirmando que las columnas nuevas del Sheet quedan con los valores correctos y que el recibo impreso muestra "Recibió"/"Devuelta"). Borrar la fila de prueba del Sheet al terminar.

- [ ] **Step 4: Push a `master`**

Confirmar con el usuario antes de este paso. Si confirma:
```bash
git push origin master
```
Verificar con `gh run watch` que el deploy termina en verde.
