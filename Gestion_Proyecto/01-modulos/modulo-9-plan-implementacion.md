# Módulo 9 — Caja y Facturación: Plan de Implementación

> **Para quien ejecute este plan:** usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans, tarea por tarea. Los pasos usan checkboxes (`- [ ]`) para llevar seguimiento.

**Objetivo:** Construir `caja.html` (pantalla de caja) + las acciones nuevas de Apps Script (`listar_pedidos_caja`, `marcar_pedido_pagado`) para que el cajero pueda ver los pedidos pendientes de pago (En el local y Domicilio), cobrarlos registrando el método de pago, e imprimir el recibo de 80mm.

**Arquitectura:** Archivo estático nuevo `caja.html` (mismo patrón que `cocina.html`), más 2 acciones nuevas pegadas al mismo proyecto de Apps Script que ya tiene los Módulos 1/2/3/8. Impresión vía `window.print()` con una plantilla oculta a 80mm — sin software adicional. Ver el diseño completo en `modulo-9-caja-facturacion.md` (sección "Diseño v1").

**Tech Stack:** HTML + JavaScript vanilla (sin frameworks, sin build step), Google Apps Script (V8 runtime), Google Sheets como base de datos.

## Global Constraints

- **SCRIPT_URL** (mismo backend que `menu.html`/`cocina.html`/`comisiones.html`): `https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec`
- **Caja no lleva autenticación** — mismo criterio que `cocina.html` (sin login), no como `comisiones.html`/modo admin de `menu.html`.
- **No hay repositorio git en este proyecto** (`E:\Proyectos ZFood GyP` no es un repo) — ningún paso de este plan hace `git commit`. Los archivos se editan directamente.
- **No hay framework de pruebas automatizadas** en este proyecto (ni Apps Script ni el HTML estático lo tienen). La verificación de backend se hace con `curl` real contra el `SCRIPT_URL` desplegado (usar siempre `curl -s -L --ssl-no-revoke` en este entorno Windows — sin `--ssl-no-revoke` falla con error de revocación de certificado de schannel). La verificación de frontend es manual: abrir `caja.html` en el navegador y comprobar visualmente.
- **Todo dato de prueba creado durante la verificación debe llevar el prefijo `PRUEBA-CLAUDE-CAJA-`** en mesero/observación para poder identificarlo y borrarlo del Sheet real al final de cada tarea — mismo criterio ya usado en Módulos 3 y 8.
- **Cuidado al pegar código en el editor de Apps Script online:** verificar con Ctrl+F que cada función nueva aparece **una sola vez** antes de publicar — ya pasó que una función quedó duplicada (ambas copias con la versión vieja) y el arreglo no tomó efecto silenciosamente (ver bitácora de Módulo 8 en `ESTADO.md`, 2026-07-27).
- **La hoja `Ventas` actual tiene 15 columnas** (Fecha, Hora, Código_Producto, Producto, Cantidad, Precio_Unitario, Total, Registrado_Por, Estado, Tipo_Pedido, ID_Pedido, Observacion, Mesa, Mesero, Estado_Cocina). Este plan agrega la columna 16: `Metodo_Pago`.
- **Datos ficticios del local para el recibo** (razón social, NIT, dirección) quedan marcados `[FICTICIO — actualizar]` en el código — el usuario dijo que trae los datos reales el mismo día de esta sesión (2026-07-27). Teléfono real confirmado: `3167027833`.

---

### Task 1: Backend Apps Script — listar y cobrar pedidos de Caja

**Files:**
- Create: `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-9-apps-script-caja.gs.txt`
- Modify (manual, por el usuario, en el editor online de Apps Script — mismo proyecto que Módulos 1/2/3/8): pegar las funciones nuevas + agregar 2 ramas a `doGet(e)`
- Modify (manual, por el usuario, en el Google Sheet del menú): agregar columna `Metodo_Pago` a la hoja `Ventas`

**Interfaces:**
- Produces: `accion=listar_pedidos_caja` → `{ok:true, pedidos:[{id_pedido, hora, tipo, mesa, mesero, estado, metodo_pago, items:[{producto,cantidad,total}], total}]}`
- Produces: `accion=marcar_pedido_pagado&id_pedido=<uuid>&metodo_pago=<Efectivo|Nequi|Tarjeta>` → `{ok:true}` o `{ok:false, error:"..."}`

- [ ] **Step 1: Verificar que las acciones todavía no existen (confirmar el punto de partida)**

Run:
```bash
SCRIPT_URL="https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec"
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "accion=listar_pedidos_caja"
```
Expected: algo distinto de `{"ok":true,"pedidos":[...]}` (por ejemplo un error, una página HTML, o un JSON de error de acción no reconocida) — confirma que la acción todavía no existe en el backend.

- [ ] **Step 2: Escribir el archivo local con las 2 funciones nuevas**

Crear `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-9-apps-script-caja.gs.txt` con este contenido exacto:

```javascript
// ============================================================================
// MÓDULO 9 — CAJA Y FACTURACIÓN: nuevas acciones de Apps Script
// ============================================================================
// Instrucciones:
// 1. Pega las 2 funciones de abajo (listarPedidosCaja, marcarPedidoPagado) en
//    el MISMO proyecto de Apps Script que ya tiene las acciones de los
//    Módulos 1, 2, 3 y 8 — reutilizan la hoja "Ventas".
// 2. Agrega estas 2 ramas nuevas a tu doGet(e):
//        else if (accion === 'listar_pedidos_caja') { return listarPedidosCaja(); }
//        else if (accion === 'marcar_pedido_pagado') { return marcarPedidoPagado(e); }
// 3. En la hoja "Ventas", agrega una columna nueva después de "Estado_Cocina"
//    (sería la columna 16 / P): "Metodo_Pago". Queda vacía hasta que se cobra
//    un pedido; luego se llena con "Efectivo", "Nequi" o "Tarjeta".
// 4. Publica de nuevo la implementación web (Implementar > Administrar
//    implementaciones > Editar > Nueva versión > Implementar).
// 5. IMPORTANTE: antes de publicar, busca con Ctrl+F "function listarPedidosCaja"
//    y "function marcarPedidoPagado" en TODO el editor y confirma que cada una
//    aparece una sola vez — pegar por accidente una función duplicada anula el
//    cambio en silencio (ya pasó una vez con el Módulo 8, ver ESTADO.md).
//
// A diferencia de Cocina (Módulo 3), Caja incluye TANTO pedidos "local" como
// "domicilio" — el cajero necesita cerrar (marcar pagado) los dos tipos para
// que el reporte de ventas/caja cuadre completo. El estado de pago (Estado:
// "Pendiente de pago"/"Pagado") es independiente del estado de cocina
// (Estado_Cocina) — un pedido puede estar Pagado en caja y seguir
// "En preparación" en cocina, o viceversa (decisión de negocio 2026-07-14).
// ============================================================================

/**
 * accion=listar_pedidos_caja
 * Devuelve los pedidos de HOY desde "Ventas", agrupados por ID_Pedido,
 * incluyendo tipo "local" y "domicilio", con su estado de pago y método
 * (si ya se cobró).
 */
function listarPedidosCaja() {
  const hoja = SpreadsheetApp.getActive().getSheetByName('Ventas');
  const datos = hoja.getDataRange().getValues();
  const encabezados = datos[0];
  const idx = {
    fecha: encabezados.indexOf('Fecha'),
    hora: encabezados.indexOf('Hora'),
    producto: encabezados.indexOf('Producto'),
    cantidad: encabezados.indexOf('Cantidad'),
    total: encabezados.indexOf('Total'),
    estado: encabezados.indexOf('Estado'),
    tipoPedido: encabezados.indexOf('Tipo_Pedido'),
    idPedido: encabezados.indexOf('ID_Pedido'),
    mesa: encabezados.indexOf('Mesa'),
    mesero: encabezados.indexOf('Mesero'),
    metodoPago: encabezados.indexOf('Metodo_Pago')
  };

  const tz = Session.getScriptTimeZone();
  const hoy = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const pedidosPorId = {};

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const fecha = Utilities.formatDate(new Date(fila[idx.fecha]), tz, 'yyyy-MM-dd');
    if (fecha !== hoy) continue;

    const idPedido = fila[idx.idPedido];
    if (!pedidosPorId[idPedido]) {
      pedidosPorId[idPedido] = {
        id_pedido: idPedido,
        hora: Utilities.formatDate(new Date(fila[idx.hora]), tz, 'HH:mm'),
        tipo: fila[idx.tipoPedido],
        mesa: fila[idx.mesa] || '',
        mesero: fila[idx.mesero] || '',
        estado: fila[idx.estado],
        metodo_pago: fila[idx.metodoPago] || '',
        items: [],
        total: 0
      };
    }
    pedidosPorId[idPedido].items.push({
      producto: fila[idx.producto],
      cantidad: fila[idx.cantidad],
      total: Number(fila[idx.total])
    });
    pedidosPorId[idPedido].total += Number(fila[idx.total]);
  }

  const pedidos = Object.keys(pedidosPorId).map(function (id) { return pedidosPorId[id]; });
  return ContentService.createTextOutput(JSON.stringify({ ok: true, pedidos: pedidos }))
    .setMimeType(ContentService.MimeType.JSON);
}

const METODOS_PAGO_CAJA = ['Efectivo', 'Nequi', 'Tarjeta'];

/**
 * accion=marcar_pedido_pagado&id_pedido=<uuid>&metodo_pago=<Efectivo|Nequi|Tarjeta>
 * Marca TODAS las filas de ese ID_Pedido como Estado='Pagado' y guarda el
 * método de pago. Independiente del Estado_Cocina de esas mismas filas.
 */
function marcarPedidoPagado(e) {
  const idPedido = e.parameter.id_pedido || '';
  const metodoPago = e.parameter.metodo_pago || '';

  if (!idPedido || METODOS_PAGO_CAJA.indexOf(metodoPago) === -1) {
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

- [ ] **Step 3: Pedirle al usuario que aplique los 3 cambios manuales**

Decirle al usuario, en estos términos:
1. Abrir el Sheet del menú (`1WIltJ3wSxGu9VQDGmnj5Lx9uXqUfWjA7Q9aKcZK32ak`) → hoja `Ventas` → agregar el encabezado `Metodo_Pago` en la celda P1 (columna 16, justo después de `Estado_Cocina`).
2. Abrir el mismo proyecto de Apps Script de siempre (Extensiones → Apps Script) → pegar las 2 funciones de arriba (`listarPedidosCaja`, `marcarPedidoPagado`) en cualquier parte del archivo.
3. Buscar la función `doGet(e)` y agregar, junto a las ramas `else if` que ya existen, estas 2 líneas:
```javascript
else if (accion === 'listar_pedidos_caja') { return listarPedidosCaja(); }
else if (accion === 'marcar_pedido_pagado') { return marcarPedidoPagado(e); }
```
4. Con Ctrl+F, confirmar que `function listarPedidosCaja` y `function marcarPedidoPagado` aparecen **una sola vez** cada una.
5. Guardar (Ctrl+S) y publicar nueva versión: Implementar → Administrar implementaciones → editar (lápiz) → Nueva versión → Implementar.
6. Avisar cuando esté listo.

- [ ] **Step 4: Esperar confirmación del usuario antes de continuar a Task 2**

No avanzar a la verificación (Task 2) hasta que el usuario confirme que publicó la nueva versión.

---

### Task 2: Verificación en vivo del backend de Caja

**Files:** ninguno (solo llamadas `curl` contra el backend real, sin tocar archivos)

**Interfaces:**
- Consumes: `listar_pedidos_caja`, `marcar_pedido_pagado` (definidas en Task 1)

- [ ] **Step 1: Crear 2 pedidos de prueba — uno "local" y uno "domicilio"**

```bash
SCRIPT_URL="https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec"

curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" \
  --data-urlencode "accion=crear_pedido" \
  --data-urlencode "tipo=local" \
  --data-urlencode "mesa=981" \
  --data-urlencode "mesero=PRUEBA-CLAUDE-CAJA-LOCAL" \
  --data-urlencode 'items=[{"producto":"PRUEBA-CLAUDE-CAJA","cantidad":1,"precio":30000}]'
echo

curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" \
  --data-urlencode "accion=crear_pedido" \
  --data-urlencode "tipo=domicilio" \
  --data-urlencode 'items=[{"producto":"PRUEBA-CLAUDE-CAJA","cantidad":1,"precio":20000,"observacion":"PRUEBA-CLAUDE-CAJA-DOMICILIO"}]'
echo
```
Expected: dos respuestas `{"ok":true,"id_pedido":"<uuid>"}`. Guardar los 2 `id_pedido` devueltos para los siguientes pasos.

- [ ] **Step 2: Confirmar que `listar_pedidos_caja` los trae correctamente**

```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "accion=listar_pedidos_caja"
```
Expected: `{"ok":true,"pedidos":[...]}` con los 2 pedidos de prueba, cada uno con `estado:"Pendiente de pago"`, `metodo_pago:""`, `tipo` correcto (`"local"` y `"domicilio"`), y el pedido local con `mesa:"981"`, `mesero:"PRUEBA-CLAUDE-CAJA-LOCAL"`.

- [ ] **Step 3: Cobrar el pedido local y verificar**

```bash
ID_LOCAL="<pegar aquí el id_pedido del pedido local del Step 1>"
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" \
  --data-urlencode "accion=marcar_pedido_pagado" \
  --data-urlencode "id_pedido=$ID_LOCAL" \
  --data-urlencode "metodo_pago=Efectivo"
echo
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "accion=listar_pedidos_caja"
```
Expected: primera respuesta `{"ok":true}`; en la segunda, el pedido local ahora tiene `estado:"Pagado"` y `metodo_pago:"Efectivo"`.

- [ ] **Step 4: Cobrar el pedido de domicilio con un método distinto y verificar**

```bash
ID_DOMICILIO="<pegar aquí el id_pedido del pedido de domicilio del Step 1>"
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" \
  --data-urlencode "accion=marcar_pedido_pagado" \
  --data-urlencode "id_pedido=$ID_DOMICILIO" \
  --data-urlencode "metodo_pago=Nequi"
echo
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "accion=listar_pedidos_caja"
```
Expected: el pedido de domicilio queda con `estado:"Pagado"` y `metodo_pago:"Nequi"`.

- [ ] **Step 5: Probar el caso de error (id_pedido inexistente)**

```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" \
  --data-urlencode "accion=marcar_pedido_pagado" \
  --data-urlencode "id_pedido=no-existe-123" \
  --data-urlencode "metodo_pago=Efectivo"
```
Expected: `{"ok":false,"error":"No se encontró ese pedido"}`.

- [ ] **Step 6: Avisar al usuario que borre las 2 filas de prueba**

Decirle al usuario que borre en `Ventas` las filas con mesero `PRUEBA-CLAUDE-CAJA-LOCAL` y observación `PRUEBA-CLAUDE-CAJA-DOMICILIO`. No continuar a Task 3 hasta que confirme.

---

### Task 3: Frontend — estructura y listado de `caja.html`

**Files:**
- Create: `E:\Proyectos ZFood GyP\caja.html`

**Interfaces:**
- Consumes: `accion=listar_pedidos_caja` (Task 1) → `{ok, pedidos:[{id_pedido, hora, tipo, mesa, mesero, estado, metodo_pago, items, total}]}`
- Produces: funciones globales `cargarPedidos()`, `render()`, `cambiarVistaTipo(t)`, `cambiarVistaEstado(v)`, variables globales `pedidos`, `vistaTipo`, `vistaEstado` — usadas por Task 4 y Task 5.

- [ ] **Step 1: Crear `caja.html` con este contenido completo**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Donde el Gordo - Caja</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;}
body{font-family:'Segoe UI',sans-serif;background:#1a0a00;color:#fff;min-height:100vh;}

header{position:sticky;top:0;z-index:20;background:#1a0a00;border-bottom:1px solid rgba(200,132,26,0.3);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}
.header-titulo{font-size:1.2rem;font-weight:800;color:#c8841a;letter-spacing:1px;}
.header-sub{font-size:0.72rem;color:#e8c87a;letter-spacing:2px;}
.header-tabs{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
.grupo-tabs{display:flex;gap:8px;}
.btn-tab{padding:10px 16px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,132,26,0.35);color:#f0e0b0;font-size:0.85rem;font-weight:600;cursor:pointer;}
.btn-tab.activa{background:linear-gradient(135deg,#c8841a,#e8a832);color:#1a0a00;border-color:transparent;}

main{padding:18px;max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;}
.vacio-msg{grid-column:1/-1;text-align:center;color:rgba(240,224,176,0.5);padding:60px 0;font-size:1rem;}

.pedido-card{background:rgba(255,255,255,0.05);border:1px solid rgba(200,132,26,0.25);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;}
.pedido-header{display:flex;justify-content:space-between;align-items:flex-start;}
.pedido-titulo{font-weight:800;font-size:1.05rem;color:#c8841a;}
.pedido-sub{font-size:0.8rem;color:rgba(240,224,176,0.75);margin-top:2px;}
.pedido-hora{font-size:0.78rem;color:rgba(240,224,176,0.6);text-align:right;}
.badge-estado{padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;display:inline-block;margin-top:6px;}
.badge-estado.pendiente{background:rgba(224,80,80,0.2);color:#e8a0a0;}
.badge-estado.pagado{background:rgba(70,180,100,0.25);color:#5fd489;}

.item-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid rgba(255,255,255,0.06);font-size:0.88rem;}
.pedido-total-row{display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(200,132,26,0.3);font-weight:800;color:#e8a832;}
</style>
</head>
<body>

<header>
  <div>
    <div class="header-titulo">DONDE EL GORDO</div>
    <div class="header-sub">CAJA</div>
  </div>
  <div class="header-tabs">
    <div class="grupo-tabs">
      <button class="btn-tab activa" id="btn-tipo-local" onclick="cambiarVistaTipo('local')">En el local</button>
      <button class="btn-tab" id="btn-tipo-domicilio" onclick="cambiarVistaTipo('domicilio')">Domicilio</button>
    </div>
    <div class="grupo-tabs">
      <button class="btn-tab activa" id="btn-estado-pendientes" onclick="cambiarVistaEstado('pendientes')">Pendientes</button>
      <button class="btn-tab" id="btn-estado-pagados" onclick="cambiarVistaEstado('pagados')">Pagados</button>
    </div>
  </div>
</header>

<main id="lista-pedidos"></main>

<script>
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec';
const INTERVALO_POLLING_MS = 12000;

// Datos de muestra para poder ver y probar la pantalla mientras el backend
// (modulo-9-apps-script-caja.gs.txt) no esté desplegado todavía.
function pedidosMock() {
  const ahora = new Date();
  const haceMin = m => {
    const d = new Date(ahora.getTime() - m * 60000);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  };
  return [
    { id_pedido: 'mock-1', hora: haceMin(10), tipo: 'local', mesa: '4', mesero: 'Carlos', estado: 'Pendiente de pago', metodo_pago: '',
      items: [{ producto: 'Churrasco', cantidad: 1, total: 28000 }, { producto: 'Gaseosa 350 ml', cantidad: 2, total: 8000 }], total: 36000 },
    { id_pedido: 'mock-2', hora: haceMin(30), tipo: 'domicilio', mesa: '', mesero: '', estado: 'Pendiente de pago', metodo_pago: '',
      items: [{ producto: 'Sencilla', cantidad: 1, total: 14000 }], total: 14000 },
    { id_pedido: 'mock-3', hora: haceMin(60), tipo: 'local', mesa: '2', mesero: 'Ana', estado: 'Pagado', metodo_pago: 'Efectivo',
      items: [{ producto: 'Pizza Hawaiana', cantidad: 2, total: 60000 }], total: 60000 }
  ];
}

let pedidos = [];
let vistaTipo = 'local';
let vistaEstado = 'pendientes';

function formatoCOP(v) { return '$' + Math.round(v).toLocaleString('es-CO'); }

async function cargarPedidos() {
  try {
    const res = await fetch(SCRIPT_URL + '?accion=listar_pedidos_caja');
    const data = await res.json();
    pedidos = (data.ok && Array.isArray(data.pedidos)) ? data.pedidos : pedidosMock();
  } catch (e) {
    pedidos = pedidosMock();
  }
  render();
}

function cambiarVistaTipo(t) {
  vistaTipo = t;
  document.getElementById('btn-tipo-local').classList.toggle('activa', t === 'local');
  document.getElementById('btn-tipo-domicilio').classList.toggle('activa', t === 'domicilio');
  render();
}

function cambiarVistaEstado(v) {
  vistaEstado = v;
  document.getElementById('btn-estado-pendientes').classList.toggle('activa', v === 'pendientes');
  document.getElementById('btn-estado-pagados').classList.toggle('activa', v === 'pagados');
  render();
}

function render() {
  const lista = pedidos.filter(p =>
    p.tipo === vistaTipo &&
    (vistaEstado === 'pendientes' ? p.estado !== 'Pagado' : p.estado === 'Pagado')
  );
  const cont = document.getElementById('lista-pedidos');

  if (lista.length === 0) {
    cont.innerHTML = `<div class="vacio-msg">No hay pedidos ${vistaEstado === 'pendientes' ? 'pendientes de pago' : 'pagados'} en ${vistaTipo === 'local' ? 'el local' : 'domicilio'} hoy.</div>`;
    return;
  }

  cont.innerHTML = lista.map(p => `
    <div class="pedido-card">
      <div class="pedido-header">
        <div>
          <div class="pedido-titulo">${p.tipo === 'local' ? '🍽️ Mesa ' + (p.mesa || '—') : '🛵 Domicilio'}</div>
          <div class="pedido-sub">${p.mesero ? '👤 ' + p.mesero : ''}</div>
          <div class="badge-estado ${p.estado === 'Pagado' ? 'pagado' : 'pendiente'}">${p.estado === 'Pagado' ? '✅ Pagado (' + p.metodo_pago + ')' : '⏳ Pendiente de pago'}</div>
        </div>
        <div class="pedido-hora">${p.hora}</div>
      </div>
      ${p.items.map(it => `
        <div class="item-row">
          <span>${it.cantidad}x ${it.producto}</span>
          <span>${formatoCOP(it.total)}</span>
        </div>
      `).join('')}
      <div class="pedido-total-row">
        <span>TOTAL</span>
        <span>${formatoCOP(p.total)}</span>
      </div>
    </div>
  `).join('');
}

setInterval(() => cargarPedidos(), INTERVALO_POLLING_MS);
cargarPedidos();
</script>
</body>
</html>
```

- [ ] **Step 2: Verificación manual — abrir el archivo en el navegador**

Pedirle al usuario (o hacerlo si hay acceso a navegador en la sesión) que abra `E:\Proyectos ZFood GyP\caja.html` haciendo doble clic, y confirme:
- Se ven 3 tarjetas de pedidos de muestra (datos mock, porque el fetch real solo funciona si se sirve por HTTP, no con doble clic en el archivo — esto es normal y esperado, igual que pasa con `cocina.html`).
- Las pestañas "En el local"/"Domicilio" y "Pendientes"/"Pagados" cambian lo que se muestra al hacer clic.
- El pedido mock-3 (Pagado, $60.000) solo aparece en "En el local" + "Pagados".

Expected: las 4 combinaciones de pestañas muestran el subconjunto correcto de las 3 tarjetas mock.

---

### Task 4: Frontend — flujo de cobro (modal de método de pago)

**Files:**
- Modify: `E:\Proyectos ZFood GyP\caja.html` (creado en Task 3)

**Interfaces:**
- Consumes: `accion=marcar_pedido_pagado` (Task 1), variables/funciones de Task 3 (`pedidos`, `render()`, `cargarPedidos()`)
- Produces: `abrirModalCobrar(idPedido)`, `cerrarModalCobrar()`, `confirmarCobro(metodo)` — usadas por Task 5 para el auto-print.

- [ ] **Step 1: Agregar el CSS del modal y del botón Cobrar**

En `caja.html`, dentro de `<style>`, después de la regla `.pedido-total-row{...}`, agregar:

```css
.pedido-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:4px;}
.btn-cobrar{padding:10px 16px;border-radius:10px;background:linear-gradient(135deg,#c8841a,#e8a832);border:none;color:#1a0a00;font-weight:700;font-size:0.85rem;cursor:pointer;}

.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:50;}
.overlay.oculto{display:none;}
.modal-cobrar{background:#2a1500;border:1px solid rgba(200,132,26,0.4);border-radius:16px;padding:24px;width:90%;max-width:340px;display:flex;flex-direction:column;gap:12px;}
.modal-cobrar h3{color:#e8a832;font-size:1.1rem;}
.btn-metodo{padding:14px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,132,26,0.35);color:#f0e0b0;font-size:0.95rem;font-weight:700;cursor:pointer;}
.btn-cancelar{padding:12px;border-radius:10px;background:transparent;border:none;color:rgba(240,224,176,0.6);font-size:0.85rem;cursor:pointer;}
```

- [ ] **Step 2: Agregar el modal en el HTML**

Buscar:
```html
<main id="lista-pedidos"></main>
```
Reemplazar por:
```html
<main id="lista-pedidos"></main>

<div class="overlay oculto" id="overlay-cobrar">
  <div class="modal-cobrar">
    <h3>¿Cómo pagó el cliente?</h3>
    <button class="btn-metodo" onclick="confirmarCobro('Efectivo')">💵 Efectivo</button>
    <button class="btn-metodo" onclick="confirmarCobro('Nequi')">📱 Nequi</button>
    <button class="btn-metodo" onclick="confirmarCobro('Tarjeta')">💳 Tarjeta</button>
    <button class="btn-cancelar" onclick="cerrarModalCobrar()">Cancelar</button>
  </div>
</div>
```

- [ ] **Step 3: Agregar el estado y las funciones de cobro en el JS**

Buscar:
```javascript
let pedidos = [];
let vistaTipo = 'local';
let vistaEstado = 'pendientes';
```
Reemplazar por:
```javascript
let pedidos = [];
let vistaTipo = 'local';
let vistaEstado = 'pendientes';
let pedidoIdParaCobrar = null;
const pedidosPagoPendiente = new Set();
```

Buscar:
```javascript
    pedidos = (data.ok && Array.isArray(data.pedidos)) ? data.pedidos : pedidosMock();
  } catch (e) {
    pedidos = pedidosMock();
  }
  render();
}
```
Reemplazar por:
```javascript
    pedidos = (data.ok && Array.isArray(data.pedidos)) ? data.pedidos : pedidosMock();
  } catch (e) {
    pedidos = pedidosMock();
  }
  aplicarPendientes(pedidos);
  render();
}

// Cambios optimistas todavía no confirmados por el servidor. Sin esto, el
// polling automático (cada INTERVALO_POLLING_MS) podría pisar un cobro recién
// hecho si llega antes de que termine de guardarse en el Sheet — mismo
// patrón ya usado en cocina.html (ver ESTADO.md, hallazgo 2026-07-22).
function aplicarPendientes(lista) {
  lista.forEach(p => {
    if (pedidosPagoPendiente.has(p.id_pedido)) p.estado = 'Pagado';
  });
}

function abrirModalCobrar(idPedido) {
  pedidoIdParaCobrar = idPedido;
  document.getElementById('overlay-cobrar').classList.remove('oculto');
}

function cerrarModalCobrar() {
  pedidoIdParaCobrar = null;
  document.getElementById('overlay-cobrar').classList.add('oculto');
}

async function confirmarCobro(metodo) {
  const idPedido = pedidoIdParaCobrar;
  cerrarModalCobrar();
  if (!idPedido) return;

  pedidosPagoPendiente.add(idPedido);
  const pedido = pedidos.find(p => p.id_pedido === idPedido);
  if (pedido) { pedido.estado = 'Pagado'; pedido.metodo_pago = metodo; }
  render();

  try {
    const params = new URLSearchParams({ accion: 'marcar_pedido_pagado', id_pedido: idPedido, metodo_pago: metodo });
    await fetch(SCRIPT_URL + '?' + params.toString());
  } catch (e) {
    // Backend no disponible - el cambio queda solo en pantalla (modo mock).
  } finally {
    pedidosPagoPendiente.delete(idPedido);
  }
}
```

- [ ] **Step 4: Agregar el botón "Cobrar" a las tarjetas pendientes**

Buscar:
```javascript
      <div class="pedido-total-row">
        <span>TOTAL</span>
        <span>${formatoCOP(p.total)}</span>
      </div>
    </div>
  `).join('');
```
Reemplazar por:
```javascript
      <div class="pedido-total-row">
        <span>TOTAL</span>
        <span>${formatoCOP(p.total)}</span>
      </div>
      ${p.estado !== 'Pagado' ? `<div class="pedido-footer"><button class="btn-cobrar" onclick="abrirModalCobrar('${p.id_pedido}')">Cobrar</button></div>` : ''}
    </div>
  `).join('');
```

- [ ] **Step 5: Verificación manual con datos reales**

1. Crear un pedido de prueba (mismo comando que Task 2 Step 1, solo el "local", con mesa `982` y mesero `PRUEBA-CLAUDE-CAJA-COBRO`).
2. Abrir `caja.html` servido por HTTP (no doble clic — necesita HTTP para que el `fetch` real funcione; puede ser el mismo hosting/GitHub Pages que usan `menu.html`/`cocina.html`, o un servidor local).
3. Confirmar que el pedido de prueba aparece en "En el local" → "Pendientes".
4. Hacer clic en "Cobrar" → elegir "Efectivo" → confirmar que la tarjeta desaparece de "Pendientes" y aparece en "Pagados" con la etiqueta "✅ Pagado (Efectivo)".
5. Verificar contra el backend real:
```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "accion=listar_pedidos_caja"
```
Expected: el pedido de prueba tiene `estado:"Pagado"` y `metodo_pago:"Efectivo"` en el Sheet real, no solo en pantalla.
6. Pedirle al usuario que borre la fila de prueba (mesero `PRUEBA-CLAUDE-CAJA-COBRO`) del Sheet.

---

### Task 5: Frontend — plantilla de recibo de 80mm e impresión

**Files:**
- Modify: `E:\Proyectos ZFood GyP\caja.html` (de Tasks 3 y 4)

**Interfaces:**
- Consumes: `pedido` object tal como lo produce `listar_pedidos_caja` (Task 1) / `pedidosMock()` (Task 3)
- Produces: `imprimirRecibo(pedido)`, `imprimirReciboPorId(idPedido)`

- [ ] **Step 1: Agregar el CSS de impresión y los datos del local**

En `caja.html`, dentro de `<style>`, al final, agregar:

```css
#recibo-imprimir{display:none;}
@media print{
  body *{visibility:hidden;}
  #recibo-imprimir, #recibo-imprimir *{visibility:visible;}
  #recibo-imprimir{display:block;position:absolute;top:0;left:0;width:80mm;padding:4mm;font-family:'Courier New',monospace;font-size:11px;color:#000;background:#fff;}
  .recibo-linea{margin:2px 0;}
  .recibo-centro{text-align:center;}
  .recibo-negrita{font-weight:700;}
  .recibo-separador{border-top:1px dashed #000;margin:6px 0;}
  .recibo-item{display:flex;justify-content:space-between;}
}
```

Buscar:
```css
.pedido-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:4px;}
```
Dejar tal cual (ya tiene `gap:8px`, no requiere cambio — solo referencia para ubicarte en el archivo).

- [ ] **Step 2: Agregar el contenedor del recibo en el HTML**

Buscar:
```html
    <button class="btn-cancelar" onclick="cerrarModalCobrar()">Cancelar</button>
  </div>
</div>
```
Reemplazar por:
```html
    <button class="btn-cancelar" onclick="cerrarModalCobrar()">Cancelar</button>
  </div>
</div>

<div id="recibo-imprimir"></div>
```

- [ ] **Step 3: Agregar la constante `DATOS_LOCAL`**

Buscar:
```javascript
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec';
const INTERVALO_POLLING_MS = 12000;
```
Reemplazar por:
```javascript
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec';
const INTERVALO_POLLING_MS = 12000;

// Datos del local para el recibo de 80mm. Pendiente: el usuario dijo que trae
// la razón social y el NIT reales el 2026-07-27 — actualizar aquí en cuanto
// los tenga. Teléfono real ya confirmado.
const DATOS_LOCAL = {
  nombreComercial: 'Donde el Gordo',
  razonSocial: '[FICTICIO — actualizar con el dato real]',
  nit: '[FICTICIO — actualizar]',
  direccion: '[FICTICIO — actualizar]',
  telefono: '3167027833',
  mensajePie: '¡Gracias por su visita!'
};
```

- [ ] **Step 4: Agregar las funciones de impresión**

Buscar:
```javascript
function formatoCOP(v) { return '$' + Math.round(v).toLocaleString('es-CO'); }
```
Reemplazar por:
```javascript
function formatoCOP(v) { return '$' + Math.round(v).toLocaleString('es-CO'); }

function imprimirRecibo(pedido) {
  const ahora = new Date();
  const cont = document.getElementById('recibo-imprimir');
  cont.innerHTML = `
    <div class="recibo-linea recibo-centro recibo-negrita">${DATOS_LOCAL.nombreComercial}</div>
    <div class="recibo-linea recibo-centro">${DATOS_LOCAL.razonSocial}</div>
    <div class="recibo-linea recibo-centro">NIT ${DATOS_LOCAL.nit}</div>
    <div class="recibo-linea recibo-centro">${DATOS_LOCAL.direccion}</div>
    <div class="recibo-linea recibo-centro">Tel: ${DATOS_LOCAL.telefono}</div>
    <div class="recibo-separador"></div>
    <div class="recibo-linea">${ahora.toLocaleDateString('es-CO')}  ${ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
    <div class="recibo-linea">${pedido.tipo === 'local' ? 'Mesa ' + (pedido.mesa || '—') : 'Domicilio'}</div>
    <div class="recibo-separador"></div>
    ${pedido.items.map(it => `<div class="recibo-item"><span>${it.cantidad}x ${it.producto}</span><span>${formatoCOP(it.total)}</span></div>`).join('')}
    <div class="recibo-separador"></div>
    <div class="recibo-item recibo-negrita"><span>TOTAL</span><span>${formatoCOP(pedido.total)}</span></div>
    <div class="recibo-linea">Pago: ${pedido.metodo_pago}</div>
    <div class="recibo-separador"></div>
    <div class="recibo-linea recibo-centro">${DATOS_LOCAL.mensajePie}</div>
  `;
  window.print();
}

function imprimirReciboPorId(idPedido) {
  const pedido = pedidos.find(p => p.id_pedido === idPedido);
  if (pedido) imprimirRecibo(pedido);
}
```

- [ ] **Step 5: Disparar la impresión automática al cobrar pedidos "En el local"**

Buscar:
```javascript
  try {
    const params = new URLSearchParams({ accion: 'marcar_pedido_pagado', id_pedido: idPedido, metodo_pago: metodo });
    await fetch(SCRIPT_URL + '?' + params.toString());
  } catch (e) {
    // Backend no disponible - el cambio queda solo en pantalla (modo mock).
  } finally {
    pedidosPagoPendiente.delete(idPedido);
  }
```
Reemplazar por:
```javascript
  try {
    const params = new URLSearchParams({ accion: 'marcar_pedido_pagado', id_pedido: idPedido, metodo_pago: metodo });
    await fetch(SCRIPT_URL + '?' + params.toString());
    if (pedido && pedido.tipo === 'local') imprimirRecibo(pedido);
  } catch (e) {
    // Backend no disponible - el cambio queda solo en pantalla (modo mock).
  } finally {
    pedidosPagoPendiente.delete(idPedido);
  }
```

- [ ] **Step 6: Agregar el botón de recibo (opcional en domicilio, reimprimir en pagados)**

Buscar:
```javascript
      ${p.estado !== 'Pagado' ? `<div class="pedido-footer"><button class="btn-cobrar" onclick="abrirModalCobrar('${p.id_pedido}')">Cobrar</button></div>` : ''}
    </div>
  `).join('');
```
Reemplazar por:
```javascript
      <div class="pedido-footer">
        ${p.tipo === 'domicilio' ? `<button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="imprimirReciboPorId('${p.id_pedido}')">🖨️ ${p.estado === 'Pagado' ? 'Reimprimir' : 'Imprimir'} recibo</button>` : ''}
        ${p.estado === 'Pagado'
          ? (p.tipo === 'local' ? `<button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="imprimirReciboPorId('${p.id_pedido}')">🖨️ Reimprimir recibo</button>` : '')
          : `<button class="btn-cobrar" onclick="abrirModalCobrar('${p.id_pedido}')">Cobrar</button>`}
      </div>
    </div>
  `).join('');
```

- [ ] **Step 7: Verificación manual — vista previa de impresión**

1. Abrir `caja.html` (servido por HTTP) con datos mock o reales.
2. En una tarjeta "En el local" → "Pendientes", clic en "Cobrar" → "Efectivo".
3. Confirmar que se abre el diálogo de impresión del navegador (Ctrl+P) automáticamente.
4. En la vista previa, confirmar: ancho angosto tipo ticket (no una hoja carta completa), aparecen nombre comercial + razón social ficticia + NIT ficticio + dirección ficticia + teléfono `3167027833`, fecha/hora, ítems con cantidad/precio, total, método de pago, mensaje de pie — y que **no** aparece mesero ni propina en ningún lado.
5. Cancelar el diálogo de impresión (no hace falta imprimir de verdad todavía — la impresora física se prueba después, cuando el usuario tenga el PC de caja con la térmica USB conectada).

**Nota para el usuario:** la prueba de impresión física real (papel saliendo de la térmica de 80mm) queda pendiente hasta que confirme que el PC de caja con la impresora conectada está listo — avisar en ese momento para hacerla.

---

### Task 6: Actualizar documentación del proyecto

**Files:**
- Modify: `E:\Proyectos ZFood GyP\Gestion_Proyecto\03-seguimiento\ESTADO.md`
- Modify: `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-9-caja-facturacion.md`

- [ ] **Step 1: Actualizar la fila del Módulo 9 en la tabla de `ESTADO.md`**

Cambiar la fila:
```
| 9. Caja y Facturación | Regla de negocio cerrada (2026-07-14) | Construir pantalla de caja (pendiente de pago → pagado, independiente del estado de cocina) y plantilla de recibo de 80mm (fecha, hora, local, NIT, dirección, teléfono — sin mesero ni propina). |
```
por:
```
| 9. Caja y Facturación | **Backend verificado en vivo — <FECHA>** | `caja.html`: pestañas En el local/Domicilio × Pendientes/Pagados, cobro con selector de método de pago (Efectivo/Nequi/Tarjeta), recibo de 80mm vía diálogo de impresión del navegador (auto para "En el local", opcional para Domicilio). `listar_pedidos_caja`/`marcar_pedido_pagado` verificados contra el backend real. Falta: datos reales del local en el recibo (razón social/NIT — el usuario los trae aparte), prueba de impresión física en la térmica del PC de caja, publicar `caja.html` en el hosting real, y división de cuenta por persona (Módulo 4, queda para después). |
```
(reemplazar `<FECHA>` por la fecha real en que se complete este plan)

- [ ] **Step 2: Agregar una entrada a la sección de pruebas en vivo con el resultado de Task 2 y Task 4 Step 5**

Agregar al final de la sección "Pruebas en vivo..." de `ESTADO.md` un párrafo describiendo lo verificado (mismo formato que las entradas existentes de Módulos 3 y 8): qué se probó, con qué datos de prueba, y confirmación de que se limpiaron.

- [ ] **Step 3: Marcar el plan como ejecutado en `modulo-9-caja-facturacion.md`**

Agregar una línea al principio del archivo (después del encabezado existente) indicando que el plan de `modulo-9-plan-implementacion.md` fue ejecutado y en qué fecha, y actualizar la sección "Qué falta" para reflejar solo lo que realmente sigue pendiente (datos reales del local, prueba de impresión física, publicar en hosting, Módulo 4).

---

## Self-Review (completado durante la escritura de este plan)

- **Cobertura del spec**: hardware confirmado (Task 1 nota de contexto), alcance v1 sin división de cuenta (ningún task la incluye), modelo de datos `Metodo_Pago` (Task 1), flujo de cobro con selector de método (Task 4), impresión vía diálogo del navegador sin software adicional (Task 5), manejo de errores (Task 2 Step 5, Task 4 Step 5), datos ficticios marcados y con nota de seguimiento (Task 5 Step 3, Task 6) — todo cubierto.
- **Placeholders**: los únicos `[FICTICIO — actualizar]` son intencionales (datos reales del negocio que el usuario aporta aparte, ya señalados como pendientes en el spec) — no son placeholders de plan sin resolver.
- **Consistencia de tipos/nombres**: `pedido.metodo_pago` (snake_case, viene del backend) se usa igual en Task 3/4/5; `p.id_pedido` consistente en todo el render; `imprimirRecibo(pedido)` (objeto completo) vs. `imprimirReciboPorId(idPedido)` (string) — nombres distintos a propósito para no confundir las dos firmas.
