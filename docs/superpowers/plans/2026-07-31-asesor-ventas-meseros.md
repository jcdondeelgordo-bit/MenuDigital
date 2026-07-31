# Asesor de Ventas (pantalla de Meseros) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a los meseros de Donde el Gordo una pantalla de entrada (`asesorventas.html`) con un grid de 20 mesas por color, desde la que tocan una mesa y entran directo al catálogo de `menu.html` para tomar el pedido, incluyendo la captura opcional de datos de fidelización en la primera ronda.

**Architecture:** Dos piezas frontend independientes que se comunican solo por parámetros de URL — `asesorventas.html` (nueva, login + grid) navega a `menu.html?mesa=N&mesero=Nombre`; `menu.html` (modificado) reconoce esos dos parámetros juntos y salta el panel manual de mesa/mesero. Cero cambios de backend: todo reutiliza acciones de Apps Script ya existentes y verificadas en vivo (`listar_empleados`, `listar_pedidos_caja`, `estado_mesa`, `crear_pedido`, `buscar_cliente`/`registrar_cliente`/`actualizar_cliente`).

**Tech Stack:** HTML/CSS/JS vanilla en archivos `.html` autocontenidos (mismo patrón que el resto del proyecto — sin build step, sin framework, sin dependencias). Verificación sin navegador disponible: `node --check` sobre el `<script>` extraído + un arnés mínimo de Node para la única función de lógica pura nueva, más trazas manuales explícitas.

## Global Constraints

- Sin cambios de Apps Script / backend en este plan — todas las acciones usadas ya existen y ya están verificadas en vivo (ver spec, sección "Riesgos").
- El grid de Asesor de Ventas muestra únicamente las 20 mesas (sin cupos de domicilio).
- La captura de fidelización es **siempre opcional** — nunca debe poder bloquear el envío de un pedido.
- Sin PIN/clave individual por mesero, sin botón de "reasignar mesa" — la venta se acredita siempre al mesero que abrió la mesa (comportamiento ya existente, sin tocar).
- `SCRIPT_URL` debe ser el mismo valor exacto ya usado en `menu.html`/`caja.html`: `https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec`.
- Sin navegador/Playwright disponible durante la construcción — la prueba con clics queda para que el usuario la haga en el sitio publicado, después de mergear.

---

### Task 1: Crear `asesorventas.html` (login + grid) y el botón en `index.html`

**Files:**
- Create: `asesorventas.html`
- Modify: `index.html:46` (agrega una tarjeta nueva antes de la de Caja)

**Interfaces:**
- Consumes: `SCRIPT_URL` (constante propia, mismo valor que `menu.html`/`caja.html`); acciones de Apps Script `listar_empleados` (`{ok, empleados:[{nombre}]}`) y `listar_pedidos_caja` (`{ok, pedidos:[{id_pedido, tipo, mesa, estado, ...}]}`), ambas ya desplegadas y verificadas en vivo.
- Produces: al tocar una mesa, navega a `menu.html?mesa=<N>&mesero=<mesero codificado con encodeURIComponent>` — Task 2 implementa el lado que recibe exactamente esos dos parámetros con esos nombres.

- [ ] **Step 1: Crear `asesorventas.html` con el contenido completo**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Donde el Gordo - Asesor de Ventas</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;}
body{font-family:'Segoe UI',sans-serif;background:#1a0a00;color:#fff;min-height:100vh;}

header{position:sticky;top:0;z-index:20;background:#1a0a00;border-bottom:1px solid rgba(200,132,26,0.3);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}
.header-marca{display:flex;align-items:center;gap:10px;}
.logo-header{width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none;}
.header-titulo{font-size:1.2rem;font-weight:800;color:#c8841a;letter-spacing:1px;}
.header-sub{font-size:0.72rem;color:#e8c87a;letter-spacing:2px;}
.header-derecha{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
.mesero-activo{font-size:0.85rem;color:#f0e0b0;}
.btn-cambiar{background:transparent;border:none;color:rgba(255,255,255,0.4);font-size:0.78rem;cursor:pointer;text-decoration:underline;}
.btn-tab{padding:10px 16px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,132,26,0.35);color:#f0e0b0;font-size:0.85rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;}

main{padding:18px;max-width:640px;margin:0 auto;}
.vacio-msg{text-align:center;color:rgba(240,224,176,0.5);padding:40px 0;font-size:1rem;}
.banner-mock{background:#1a0a00;border:1px solid #e05050;color:#e8a0a0;border-radius:10px;padding:12px 16px;font-size:0.85rem;font-weight:700;text-align:center;margin-bottom:14px;}

.grid-mesas{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;}
.btn-mesa{aspect-ratio:1;border-radius:14px;border:none;font-weight:800;font-size:0.68rem;letter-spacing:0.5px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#fff;background:#1c1c1c;}
.btn-mesa-num{font-size:1.35rem;line-height:1;}
.btn-mesa.estado-libre{background:#1c1c1c;color:#fff;border:1px solid rgba(255,255,255,0.15);}
.btn-mesa.estado-ocupada-pendiente{background:linear-gradient(135deg,#a8291c,#e05050);color:#fff;}
.btn-mesa.estado-ocupada-pagada{background:linear-gradient(135deg,#c8941a,#e8c832);color:#1a0a00;}

.pantalla-login{max-width:400px;margin:60px auto;padding:0 20px;display:flex;flex-direction:column;gap:16px;}
.pantalla-login h2{color:#c8841a;font-size:1.2rem;text-align:center;}
.campo-grupo label{display:block;font-size:0.8rem;color:#c8841a;margin-bottom:5px;}
.campo-grupo input,.campo-grupo select{width:100%;padding:11px 13px;background:rgba(255,255,255,0.07);border:1px solid rgba(200,132,26,0.4);border-radius:10px;color:#fff;font-size:0.93rem;outline:none;}
.btn-principal{width:100%;padding:15px;background:linear-gradient(135deg,#c8841a,#e8a832);border:none;border-radius:12px;color:#1a0a00;font-size:1.02rem;font-weight:700;letter-spacing:1px;cursor:pointer;margin-top:10px;}
</style>
</head>
<body>

<header>
  <div class="header-marca">
    <img class="logo-header" src="logo.png" alt="Donde el Gordo">
    <div>
      <div class="header-titulo">DONDE EL GORDO</div>
      <div class="header-sub">ASESOR DE VENTAS</div>
    </div>
  </div>
  <div class="header-derecha" id="header-derecha" style="display:none;">
    <span class="mesero-activo" id="mesero-activo-txt"></span>
    <button class="btn-cambiar" onclick="cambiarMesero()">Cambiar mesero</button>
    <a class="btn-tab" href="index.html">← MENU</a>
  </div>
</header>

<div class="pantalla-login" id="pantalla-login">
  <h2>¿Quién eres?</h2>
  <div class="campo-grupo">
    <label>Tu nombre</label>
    <select id="login-mesero">
      <option value="">-- Selecciona tu nombre --</option>
    </select>
  </div>
  <button class="btn-principal" onclick="confirmarLogin()">Entrar</button>
</div>

<main id="pantalla-grid" style="display:none;">
  <div id="grid-contenido"></div>
</main>

<script>
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec';
const INTERVALO_POLLING_MS = 12000;

let EMPLEADOS = [];
let mesero = null;
let pedidos = [];
let pedidosCargados = false;
let errorCarga = false;
let pollingIniciado = false;

async function cargarEmpleados() {
  try {
    const res = await fetch(SCRIPT_URL + '?accion=listar_empleados');
    const data = await res.json();
    if (data.ok && Array.isArray(data.empleados)) {
      EMPLEADOS = data.empleados;
    }
  } catch (e) {
    // Backend no disponible -- renderLoginOptions() cae a texto libre.
  }
  renderLoginOptions();
}

function renderLoginOptions() {
  const el = document.getElementById('login-mesero');
  if (EMPLEADOS.length === 0) {
    // Sin catálogo disponible: no bloqueamos el flujo, volvemos a campo de texto libre.
    if (el.tagName === 'SELECT') {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'login-mesero';
      input.placeholder = 'Tu nombre';
      el.replaceWith(input);
    }
    return;
  }
  if (el.tagName !== 'SELECT') return; // ya se reemplazó por texto libre, no hay nada que poblar
  el.innerHTML = '<option value="">-- Selecciona tu nombre --</option>' +
    EMPLEADOS.map(emp => `<option value="${emp.nombre.replace(/"/g, '&quot;')}">${emp.nombre}</option>`).join('');
}

function confirmarLogin() {
  const el = document.getElementById('login-mesero');
  const nombre = el.value.trim();
  if (!nombre) { alert('Selecciona o escribe tu nombre.'); return; }
  mesero = nombre;
  try { localStorage.setItem('asesorMesero', nombre); } catch (e) {}
  mostrarGrid();
}

function cambiarMesero() {
  try { localStorage.removeItem('asesorMesero'); } catch (e) {}
  mesero = null;
  mostrarLogin();
}

function mostrarLogin() {
  document.getElementById('pantalla-login').style.display = 'flex';
  document.getElementById('pantalla-grid').style.display = 'none';
  document.getElementById('header-derecha').style.display = 'none';
}

function mostrarGrid() {
  document.getElementById('pantalla-login').style.display = 'none';
  document.getElementById('pantalla-grid').style.display = 'block';
  document.getElementById('header-derecha').style.display = 'flex';
  document.getElementById('mesero-activo-txt').textContent = '👤 ' + mesero;
  cargarPedidos();
  if (!pollingIniciado) {
    pollingIniciado = true;
    setInterval(cargarPedidos, INTERVALO_POLLING_MS);
  }
}

// Misma regla que caja.html (estadoMesaColor): una mesa con alguna ronda de hoy
// en Pendiente de pago se ve roja; si todo lo de hoy está Pagado (nada
// pendiente, nada liberado) se ve ámbar; sin ninguna fila activa hoy, libre.
function estadoMesaColor(numMesa) {
  const activos = pedidos.filter(p => p.tipo === 'local' && String(p.mesa) === String(numMesa) && p.estado !== 'Liberado');
  if (activos.length === 0) return 'libre';
  if (activos.some(p => p.estado === 'Pendiente de pago')) return 'ocupada-pendiente';
  return 'ocupada-pagada';
}

async function cargarPedidos() {
  try {
    const res = await fetch(SCRIPT_URL + '?accion=listar_pedidos_caja');
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.pedidos)) throw new Error('respuesta no ok');
    pedidos = data.pedidos;
    pedidosCargados = true;
    errorCarga = false;
  } catch (e) {
    errorCarga = true;
  }
  if (mesero) renderGrid();
}

function abrirMesa(numMesa) {
  const url = 'menu.html?mesa=' + numMesa + '&mesero=' + encodeURIComponent(mesero);
  window.location.href = url;
}

function renderGrid() {
  const cont = document.getElementById('grid-contenido');

  // Nunca se asume "todo libre" si la primera carga falló -- se muestra un
  // estado de error explícito con reintento en vez de arriesgar que un mesero
  // abra una mesa que en realidad ya está ocupada.
  if (errorCarga && !pedidosCargados) {
    cont.innerHTML = '<div class="vacio-msg">⚠️ No se pudo cargar el estado de las mesas.</div>' +
      '<button class="btn-principal" onclick="cargarPedidos()">Reintentar</button>';
    return;
  }

  const banner = errorCarga
    ? '<div class="banner-mock">⚠️ Sin conexión — mostrando el último estado conocido, puede no estar actualizado</div>'
    : '';

  const mesasHtml = [];
  for (let n = 1; n <= 20; n++) {
    const estado = estadoMesaColor(n);
    mesasHtml.push(`<button class="btn-mesa estado-${estado}" onclick="abrirMesa(${n})">MESA<span class="btn-mesa-num">${n}</span></button>`);
  }

  cont.innerHTML = banner + `<div class="grid-mesas">${mesasHtml.join('')}</div>`;
}

(async function init() {
  await cargarEmpleados();
  try {
    const guardado = localStorage.getItem('asesorMesero');
    if (guardado) { mesero = guardado; }
  } catch (e) {}
  if (mesero) mostrarGrid(); else mostrarLogin();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Agregar el botón "Asesor de Ventas" en `index.html`**

En `index.html`, el bloque `.herramientas` actual es (línea 45-52):

```html
  <div class="herramientas">
    <a class="tool-card" href="caja.html"><span class="tool-icon">💰</span>Caja</a>
    <a class="tool-card" href="cuadre.html"><span class="tool-icon">🧾</span>Cuadre de Caja</a>
    <a class="tool-card" href="cocina.html"><span class="tool-icon">🍳</span>Cocina</a>
    <a class="tool-card" href="inventario.html"><span class="tool-icon">📦</span>Inventario</a>
    <a class="tool-card" href="comisiones.html"><span class="tool-icon">📊</span>Comisiones</a>
    <a class="tool-card" href="empleados.html"><span class="tool-icon">👥</span>Empleados</a>
  </div>
```

Reemplázalo por (agrega una tarjeta nueva antes de Caja, todo lo demás igual):

```html
  <div class="herramientas">
    <a class="tool-card" href="asesorventas.html"><span class="tool-icon">🛎️</span>Asesor de Ventas</a>
    <a class="tool-card" href="caja.html"><span class="tool-icon">💰</span>Caja</a>
    <a class="tool-card" href="cuadre.html"><span class="tool-icon">🧾</span>Cuadre de Caja</a>
    <a class="tool-card" href="cocina.html"><span class="tool-icon">🍳</span>Cocina</a>
    <a class="tool-card" href="inventario.html"><span class="tool-icon">📦</span>Inventario</a>
    <a class="tool-card" href="comisiones.html"><span class="tool-icon">📊</span>Comisiones</a>
    <a class="tool-card" href="empleados.html"><span class="tool-icon">👥</span>Empleados</a>
  </div>
```

- [ ] **Step 3: Verificar sintaxis con `node --check`**

Run (desde la raíz del repo, `E:\Proyectos ZFood GyP`):

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('asesorventas.html', 'utf8');
const match = html.match(/<script>([\s\S]*)<\/script>/);
fs.writeFileSync('asesorventas_check.js', match[1]);
"
node --check asesorventas_check.js
rm asesorventas_check.js
```

Expected: sin salida (éxito silencioso). Si hay un `SyntaxError`, corrígelo antes de seguir.

- [ ] **Step 4: Arnés mínimo de Node para `estadoMesaColor` (única función de lógica pura nueva)**

```bash
node -e "
const assert = require('assert');
let pedidos = [
  { tipo: 'local', mesa: '5', estado: 'Pendiente de pago' },
  { tipo: 'local', mesa: '6', estado: 'Pagado' },
  { tipo: 'local', mesa: '7', estado: 'Liberado' },
  { tipo: 'domicilio', mesa: '', estado: 'Pendiente de pago' }
];
function estadoMesaColor(numMesa) {
  const activos = pedidos.filter(p => p.tipo === 'local' && String(p.mesa) === String(numMesa) && p.estado !== 'Liberado');
  if (activos.length === 0) return 'libre';
  if (activos.some(p => p.estado === 'Pendiente de pago')) return 'ocupada-pendiente';
  return 'ocupada-pagada';
}
assert.strictEqual(estadoMesaColor(5), 'ocupada-pendiente', 'mesa 5 con Pendiente de pago debe ser roja');
assert.strictEqual(estadoMesaColor(6), 'ocupada-pagada', 'mesa 6 con Pagado (sin nada pendiente) debe ser ámbar');
assert.strictEqual(estadoMesaColor(7), 'libre', 'mesa 7 con su única fila Liberada debe verse libre');
assert.strictEqual(estadoMesaColor(1), 'libre', 'mesa sin ninguna fila hoy debe verse libre');
console.log('OK: estadoMesaColor pasa los 4 casos');
"
```

Expected: `OK: estadoMesaColor pasa los 4 casos`. Esta función es una copia literal de `caja.html:278-283` (`estadoMesaColor`) — si este arnés falla, compara carácter a carácter contra el original antes de asumir un bug nuevo.

- [ ] **Step 5: Commit**

```bash
git add asesorventas.html index.html
git commit -m "$(cat <<'EOF'
feat: add Asesor de Ventas screen (waiter table grid + login)

New asesorventas.html: mesero picks their name from Empleados (or
free text if the catalog is unavailable), then sees the same 20-table
color grid caja.html already uses (reusing listar_pedidos_caja and the
same estadoMesaColor logic). Tapping any table navigates to
menu.html?mesa=N&mesero=Name — menu.html's handling of that URL shape
is a separate task. No backend changes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `menu.html` — entrada directa con `?mesa=N&mesero=Nombre` + captura de fidelización

**Files:**
- Modify: `menu.html:198-221` (agrega panel nuevo cerca del panel de Mesa/Mesero), `menu.html:245-290` (agrega panel nuevo después del panel de Domicilio), `menu.html:426` (nueva variable `meseroQR`), `menu.html:710-732` (función `elegirTipo`), `menu.html:803-806` (agrega funciones nuevas después de `cerrarDomicilio`)

**Interfaces:**
- Consumes: URL con parámetros `mesa` y `mesero` (ambos presentes), exactamente como los produce `abrirMesa()` de `asesorventas.html` en la Task 1 (`menu.html?mesa=<N>&mesero=<encodeURIComponent(nombre)>`). También sigue consumiendo `estado_mesa` y `crear_pedido`, ya usadas por el resto del archivo, y `registrarClienteDesdeMenu` (`menu.html:898`, ya existente, sin cambios en su firma).
- Produces: ningún archivo nuevo depende de esta task; es la pieza final del flujo iniciado en Task 1.

- [ ] **Step 1: Insertar el panel de fidelización en el HTML**

El bloque actual (fin del panel de Domicilio, `menu.html`) es:

```html
  <div class="panel-footer">
    <button class="btn-principal" onclick="enviarDomicilio()">Enviar por WhatsApp</button>
  </div>
</div>

<!-- PANEL CONFIRMACION LOCAL -->
```

Reemplázalo por (agrega el panel de fidelización entre Domicilio y Confirmación, todo lo demás igual):

```html
  <div class="panel-footer">
    <button class="btn-principal" onclick="enviarDomicilio()">Enviar por WhatsApp</button>
  </div>
</div>

<!-- PANEL FIDELIZACION (solo Asesor de Ventas, primera ronda de una mesa nueva) -->
<div class="overlay" id="overlay-fidelizacion" onclick="cerrarFidelizacion()"></div>
<div class="panel" id="panel-fidelizacion">
  <div class="panel-header">
    <h3>🎖️ Datos del cliente (opcional)</h3>
    <button class="panel-cerrar" onclick="cerrarFidelizacion()">×</button>
  </div>
  <div class="panel-body">
    <div class="campo-grupo">
      <label>Celular</label>
      <input type="tel" id="fid-celular" placeholder="Ej: 3001234567">
    </div>
    <div class="campo-grupo">
      <label>Nombre</label>
      <input type="text" id="fid-nombre" placeholder="Nombre del cliente">
    </div>
    <div class="campo-grupo">
      <label>Fecha de nacimiento</label>
      <div class="campo-fila">
        <input type="number" id="fid-dia-nac" placeholder="Día" min="1" max="31">
        <select id="fid-mes-nac">
          <option value="">Mes</option>
          <option value="1">Enero</option>
          <option value="2">Febrero</option>
          <option value="3">Marzo</option>
          <option value="4">Abril</option>
          <option value="5">Mayo</option>
          <option value="6">Junio</option>
          <option value="7">Julio</option>
          <option value="8">Agosto</option>
          <option value="9">Septiembre</option>
          <option value="10">Octubre</option>
          <option value="11">Noviembre</option>
          <option value="12">Diciembre</option>
        </select>
        <input type="number" id="fid-anio-nac" placeholder="Año (ej: 1990)" min="1930" max="2026">
      </div>
    </div>
  </div>
  <div class="panel-footer">
    <button class="btn-principal" onclick="confirmarFidelizacionYPedido(true)">Guardar y confirmar</button>
    <button class="btn-secundario" onclick="confirmarFidelizacionYPedido(false)">Omitir y confirmar</button>
  </div>
</div>

<!-- PANEL CONFIRMACION LOCAL -->
```

- [ ] **Step 2: Agregar `meseroQR` junto a `mesaQR`**

El bloque actual es:

```javascript
let mesaQR = new URLSearchParams(window.location.search).get('mesa');
```

Reemplázalo por:

```javascript
let mesaQR = new URLSearchParams(window.location.search).get('mesa');
let meseroQR = new URLSearchParams(window.location.search).get('mesero');
```

- [ ] **Step 3: Agregar la rama nueva en `elegirTipo`**

La función actual (`menu.html:710-732`) es:

```javascript
function elegirTipo(tipo) {
  tipoPedidoSeleccionado = tipo;
  cerrarCheckout();
  if (tipo === 'domicilio') {
    precargarDatosDomicilio();
    document.getElementById('overlay-domicilio').classList.add('visible');
    document.getElementById('panel-domicilio').classList.add('visible');
  } else if (mesaQR !== null) {
    // Mesa ya identificada por QR: autoservicio. Si un mesero ya la había
    // reclamado en una vuelta anterior, el backend le acredita el pedido igual.
    confirmarPedidoLocal(mesaQR, '');
  } else {
    mesaAbiertaInfo = null;
    ultimaMesaVerificada = null;
    document.getElementById('mesa-numero').value = '';
    document.getElementById('mesa-mesero').value = '';
    document.getElementById('mesa-mesero').disabled = false;
    document.getElementById('mesa-mesero-label').textContent = 'Nombre del mesero';
    document.getElementById('mesa-nota').style.display = 'none';
    document.getElementById('overlay-mesa').classList.add('visible');
    document.getElementById('panel-mesa').classList.add('visible');
  }
}
```

Reemplázala por (agrega la rama `mesaQR !== null && meseroQR` ANTES de la rama de autoservicio; el resto queda igual):

```javascript
function elegirTipo(tipo) {
  tipoPedidoSeleccionado = tipo;
  cerrarCheckout();
  if (tipo === 'domicilio') {
    precargarDatosDomicilio();
    document.getElementById('overlay-domicilio').classList.add('visible');
    document.getElementById('panel-domicilio').classList.add('visible');
  } else if (mesaQR !== null && meseroQR) {
    // Mesa Y mesero llegaron por URL (desde asesorventas.html): el mesero ya se
    // identificó en el grid, no hace falta pedirle nada más aquí -- solo revisar
    // si es la primera ronda de la mesa para ofrecer la captura de fidelización.
    abrirFlujoLocalAsesor();
  } else if (mesaQR !== null) {
    // Mesa ya identificada por QR: autoservicio. Si un mesero ya la había
    // reclamado en una vuelta anterior, el backend le acredita el pedido igual.
    confirmarPedidoLocal(mesaQR, '');
  } else {
    mesaAbiertaInfo = null;
    ultimaMesaVerificada = null;
    document.getElementById('mesa-numero').value = '';
    document.getElementById('mesa-mesero').value = '';
    document.getElementById('mesa-mesero').disabled = false;
    document.getElementById('mesa-mesero-label').textContent = 'Nombre del mesero';
    document.getElementById('mesa-nota').style.display = 'none';
    document.getElementById('overlay-mesa').classList.add('visible');
    document.getElementById('panel-mesa').classList.add('visible');
  }
}
```

- [ ] **Step 4: Agregar las funciones nuevas después de `cerrarDomicilio()`**

El bloque actual es:

```javascript
function cerrarDomicilio() {
  document.getElementById('overlay-domicilio').classList.remove('visible');
  document.getElementById('panel-domicilio').classList.remove('visible');
}
```

Reemplázalo por (mismo contenido + 4 funciones nuevas a continuación):

```javascript
function cerrarDomicilio() {
  document.getElementById('overlay-domicilio').classList.remove('visible');
  document.getElementById('panel-domicilio').classList.remove('visible');
}

/**
 * Flujo de "en el local" cuando mesa Y mesero llegan por URL (asesorventas.html).
 * Solo se pide fidelización si la mesa todavía no estaba abierta -- rondas
 * siguientes de la misma mesa van directo a confirmar, sin volver a preguntar.
 * Si no se puede verificar (sin conexión), se asume mesa nueva y se pide de
 * todas formas -- "Omitir" sigue disponible, así que nunca bloquea el pedido.
 */
async function abrirFlujoLocalAsesor() {
  let abierta = false;
  let meseroExistente = '';
  try {
    const res = await fetch(SCRIPT_URL + '?accion=estado_mesa&mesa=' + encodeURIComponent(mesaQR));
    const data = await res.json();
    if (data.ok) { abierta = data.abierta; meseroExistente = data.mesero || ''; }
  } catch (e) {
    // Sin conexión para verificar -- se sigue con el flujo de fidelización igual.
  }
  if (abierta) {
    // Mismo aviso que ya existe en el panel manual (mesa-nota) cuando otro
    // mesero atiende la mesa -- aquí se muestra automático, sin que nadie
    // tenga que escribir ni tocar ningún campo para verlo.
    if (meseroExistente && meseroExistente !== meseroQR) {
      alert('📍 Esta mesa ya la está atendiendo ' + meseroExistente + '. Los productos nuevos quedan a su nombre.');
    }
    confirmarPedidoLocal(mesaQR, meseroQR);
  } else {
    abrirFidelizacion();
  }
}

function abrirFidelizacion() {
  document.getElementById('fid-celular').value = '';
  document.getElementById('fid-nombre').value = '';
  document.getElementById('fid-dia-nac').value = '';
  document.getElementById('fid-mes-nac').value = '';
  document.getElementById('fid-anio-nac').value = '';
  document.getElementById('overlay-fidelizacion').classList.add('visible');
  document.getElementById('panel-fidelizacion').classList.add('visible');
}

function cerrarFidelizacion() {
  document.getElementById('overlay-fidelizacion').classList.remove('visible');
  document.getElementById('panel-fidelizacion').classList.remove('visible');
}

/**
 * guardar=true guarda los datos en Clientes (reusando registrarClienteDesdeMenu,
 * sin dirección -- no aplica a mesa) antes de confirmar; guardar=false (Omitir)
 * confirma el pedido directamente. Cualquiera de los dos caminos siempre termina
 * en confirmarPedidoLocal -- nunca se bloquea el pedido por esto.
 */
function confirmarFidelizacionYPedido(guardar) {
  const celular = document.getElementById('fid-celular').value.trim();
  const nombre = document.getElementById('fid-nombre').value.trim();
  const diaNac = document.getElementById('fid-dia-nac').value.trim();
  const mesNac = document.getElementById('fid-mes-nac').value;
  const anioNac = document.getElementById('fid-anio-nac').value.trim();
  cerrarFidelizacion();
  if (guardar && celular) {
    const cumpleISO = (diaNac && mesNac && anioNac)
      ? `${anioNac}-${String(mesNac).padStart(2, '0')}-${String(diaNac).padStart(2, '0')}`
      : '';
    registrarClienteDesdeMenu(nombre, celular, cumpleISO, '');
  }
  confirmarPedidoLocal(mesaQR, meseroQR);
}
```

- [ ] **Step 5: Verificar sintaxis con `node --check`**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('menu.html', 'utf8');
const match = html.match(/<script>([\s\S]*)<\/script>/);
fs.writeFileSync('menu_check.js', match[1]);
"
node --check menu_check.js
rm menu_check.js
```

Expected: sin salida (éxito silencioso).

- [ ] **Step 6: Ctrl+F de duplicados**

Busca en `menu.html` cada uno de estos nombres y confirma que aparece **una sola vez** como declaración de función (`function nombre(` o `async function nombre(`):
`abrirFlujoLocalAsesor`, `abrirFidelizacion`, `cerrarFidelizacion`, `confirmarFidelizacionYPedido`, `meseroQR`.

- [ ] **Step 7: Traza manual de los 4 escenarios de `elegirTipo` (sin navegador disponible)**

Lee el código de `elegirTipo` y `abrirFlujoLocalAsesor` y confirma a mano que cada escenario ejecuta la rama esperada:

1. **URL `menu.html?mesa=5&mesero=Carlos`, mesa 5 sin abrir todavía** (`estado_mesa` devolvería `{ok:true, abierta:false}`): al tocar "En el local" → `elegirTipo('local')` → como `mesaQR='5'` y `meseroQR='Carlos'` (ambos verdaderos) → entra a `abrirFlujoLocalAsesor()` → `abierta` queda `false` → llama `abrirFidelizacion()` (NO llama `confirmarPedidoLocal` todavía). Tocar "Omitir y confirmar" → `confirmarFidelizacionYPedido(false)` → `guardar` es `false`, no llama `registrarClienteDesdeMenu` → llama `confirmarPedidoLocal('5', 'Carlos')`.
2. **Misma URL, mesa 5 ya abierta por el mismo Carlos** (`estado_mesa` devolvería `{ok:true, abierta:true, mesero:'Carlos'}`): `abrirFlujoLocalAsesor()` → `abierta` queda `true`, `meseroExistente` queda `'Carlos'` → como `meseroExistente === meseroQR` NO se muestra el `alert` → llama `confirmarPedidoLocal('5', 'Carlos')` directo, sin fidelización y sin aviso.
2b. **URL `menu.html?mesa=5&mesero=Ana`, mesa 5 ya abierta por Carlos** (`estado_mesa` devolvería `{ok:true, abierta:true, mesero:'Carlos'}`): `meseroExistente` ('Carlos') es distinto de `meseroQR` ('Ana') → se muestra `alert('📍 Esta mesa ya la está atendiendo Carlos...')` → al cerrar el alert, llama `confirmarPedidoLocal('5', 'Ana')` (el backend igual acredita la venta a Carlos, sin cambios ahí).
3. **URL `menu.html?mesa=5`** (sin `mesero`, como los QR físicos de mesa hoy): `meseroQR` es `null` → la condición `mesaQR !== null && meseroQR` es falsa (porque `meseroQR` es `null`) → cae a la rama existente `else if (mesaQR !== null)` → `confirmarPedidoLocal('5', '')`, exactamente el comportamiento de hoy, sin cambios.
4. **URL `menu.html`** (sin ningún parámetro): `mesaQR` es `null` → cae al `else` final → abre el panel manual de mesa/mesero, exactamente el comportamiento de hoy, sin cambios.

Si alguno de estos 4 no coincide al leer el código, corrige antes de continuar — no se puede verificar con clics en este entorno, así que esta traza es la única red de seguridad hasta que el usuario pruebe en el sitio publicado.

- [ ] **Step 8: Commit**

```bash
git add menu.html
git commit -m "$(cat <<'EOF'
feat: accept ?mesa=N&mesero=Name deep link from Asesor de Ventas

menu.html now recognizes mesa+mesero together in the URL (as sent by
asesorventas.html) and skips the manual mesa/mesero panel, going
straight to the catalog. Adds an optional fidelización capture step
(phone/name/birthday, reusing the existing registrarClienteDesdeMenu)
shown only on a table's first round -- never blocks order submission.
The existing QR-only (?mesa=N, no mesero) and fully-manual flows are
unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Al terminar ambas tareas

Después del merge a `master`, antes de darlo por cerrado:
1. Pushear a GitHub (mismo proceso que el rediseño de Caja/Cocina).
2. Pedirle al usuario que pruebe con clics reales en el sitio publicado: entrar a Asesor de Ventas, elegir su nombre, tocar una mesa libre, confirmar que abre `menu.html` directo al catálogo (sin panel manual), armar un pedido de prueba, ver el paso de fidelización (probar tanto "Guardar" como "Omitir"), confirmar que el pedido llega a Caja y Cocina, y que una segunda ronda a la misma mesa ya no vuelve a pedir fidelización.
3. Borrar cualquier dato de prueba que quede en el Sheet real (`Ventas`/`Clientes`) después de esa prueba.
