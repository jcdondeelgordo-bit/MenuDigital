# Resumen de mesa abierta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al reabrir una mesa ocupada (por QR, por Asesor de Ventas, o escribiendo el número a mano), mostrar en `menu.html` lo que ya se pidió hoy en esa mesa (items + total), sin cambiar cómo se crean o cobran los pedidos.

**Architecture:** La acción `estado_mesa` del Apps Script del Menú pasa de devolver solo `{ok, abierta, mesero}` a devolver también `items`/`total`, agregados por producto sobre todas las filas activas de `Ventas` de esa mesa hoy. `menu.html` consume ese dato nuevo en 2 lugares: un fetch nuevo al cargar la página (cubre QR y Asesor, que siempre traen `mesa` en la URL) y el fetch que ya existe en `verificarMesa()` (cubre el flujo 100% manual).

**Tech Stack:** HTML/JS plano (sin build step), Google Apps Script (backend), Vercel edge function como proxy transparente (sin cambios — ver `api/proxy-menu.js`, ya permite `estado_mesa` como acción pública y reenvía la respuesta tal cual).

## Global Constraints

- No se modifica `cocina.html`, `caja.html`, ni las acciones `crear_pedido`/`marcar_pedido_pagado` — spec: [2026-08-15-resumen-mesa-abierta-design.md](../specs/2026-08-15-resumen-mesa-abierta-design.md).
- El banner nunca bloquea el pedido: si `estado_mesa` falla o la mesa no está abierta, simplemente no aparece.
- El Apps Script real no se puede editar por API — el archivo de referencia (`Gestion_Proyecto/01-modulos/modulo-1-apps-script-nuevo.gs.txt`) se actualiza en el repo, y el usuario debe pegarlo/publicarlo a mano en el editor real de Apps Script antes de que el cambio de backend quede en vivo (mismo proceso que todos los módulos anteriores).

---

### Task 1: Backend — `estado_mesa` devuelve items + total

**Files:**
- Modify: `Gestion_Proyecto/01-modulos/modulo-1-apps-script-nuevo.gs.txt:91-131`

**Interfaces:**
- Produces: `estadoMesa(e)` ahora responde `{ ok: true, abierta: boolean, mesero: string, items: [{producto, cantidad, total}], total: number }` — `items`/`total` vacíos/0 si la mesa no está abierta.

- [ ] **Step 1: Agregar `obtenerResumenMesaAbierta_` justo después de `buscarMeseroMesaAbierta`**

Ubicar el final de `buscarMeseroMesaAbierta` (línea 110, `return null;` seguido de `}`) y agregar esta función nueva justo después, antes del comentario de `estado_mesa`:

```js
/**
 * Agrega, por nombre de producto, todas las filas activas de "Ventas" de HOY
 * para una mesa (mismo filtro que buscarMeseroMesaAbierta: excluye
 * Estado='Liberado', solo fecha de hoy) -- junta todas las rondas en una
 * sola lista para que se vea "2x Hamburguesa" en vez de repetido por ronda.
 */
function obtenerResumenMesaAbierta_(hoja, mesa) {
  const datos = hoja.getDataRange().getValues();
  const encabezados = datos[0];
  const idxFecha = encabezados.indexOf('Fecha');
  const idxEstado = encabezados.indexOf('Estado');
  const idxMesa = encabezados.indexOf('Mesa');
  const idxProducto = encabezados.indexOf('Producto');
  const idxCantidad = encabezados.indexOf('Cantidad');
  const idxTotal = encabezados.indexOf('Total');
  const tz = Session.getScriptTimeZone();
  const hoy = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const itemsPorProducto = {};
  let total = 0;

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    if (String(fila[idxMesa]) !== String(mesa)) continue;
    if (fila[idxEstado] === 'Liberado') continue;
    const fecha = Utilities.formatDate(new Date(fila[idxFecha]), tz, 'yyyy-MM-dd');
    if (fecha !== hoy) continue;

    const producto = fila[idxProducto];
    if (!itemsPorProducto[producto]) {
      itemsPorProducto[producto] = { producto: producto, cantidad: 0, total: 0 };
    }
    itemsPorProducto[producto].cantidad += Number(fila[idxCantidad]);
    itemsPorProducto[producto].total += Number(fila[idxTotal]);
    total += Number(fila[idxTotal]);
  }

  return {
    items: Object.keys(itemsPorProducto).map(function (k) { return itemsPorProducto[k]; }),
    total: total
  };
}
```

- [ ] **Step 2: Modificar `estadoMesa(e)` para incluir el resumen**

Reemplazar el cuerpo actual de `estadoMesa`:

```js
function estadoMesa(e) {
  const mesa = e.parameter.mesa || '';
  const hoja = SpreadsheetApp.getActive().getSheetByName('Ventas');
  const meseroExistente = mesa ? buscarMeseroMesaAbierta(hoja, mesa) : null;
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    abierta: meseroExistente !== null,
    mesero: meseroExistente || ''
  })).setMimeType(ContentService.MimeType.JSON);
}
```

por:

```js
function estadoMesa(e) {
  const mesa = e.parameter.mesa || '';
  const hoja = SpreadsheetApp.getActive().getSheetByName('Ventas');
  const meseroExistente = mesa ? buscarMeseroMesaAbierta(hoja, mesa) : null;
  const abierta = meseroExistente !== null;
  const resumen = abierta ? obtenerResumenMesaAbierta_(hoja, mesa) : { items: [], total: 0 };
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    abierta: abierta,
    mesero: meseroExistente || '',
    items: resumen.items,
    total: resumen.total
  })).setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 3: Verificar sintaxis del archivo completo**

Run: `node --check "Gestion_Proyecto/01-modulos/modulo-1-apps-script-nuevo.gs.txt"`
Expected: sin salida (sintaxis válida) — este archivo es JS plano aunque use globals de Google Apps Script (`SpreadsheetApp`, etc.), así que `node --check` solo valida sintaxis, no lo ejecuta.

- [ ] **Step 4: Confirmar que no quedó ninguna función duplicada**

Run (desde la raíz del repo, PowerShell o Bash):
```bash
grep -c "function obtenerResumenMesaAbierta_" "Gestion_Proyecto/01-modulos/modulo-1-apps-script-nuevo.gs.txt"
grep -c "function estadoMesa" "Gestion_Proyecto/01-modulos/modulo-1-apps-script-nuevo.gs.txt"
```
Expected: ambos devuelven `1`.

- [ ] **Step 5: Commit**

```bash
git add "Gestion_Proyecto/01-modulos/modulo-1-apps-script-nuevo.gs.txt"
git commit -m "feat: estado_mesa devuelve items y total de la mesa abierta"
```

---

### Task 2: Frontend — banner HTML/CSS del resumen de mesa

**Files:**
- Modify: `menu.html:26-27` (CSS), `menu.html:138` (HTML)

**Interfaces:**
- Produces: elemento `#resumen-mesa-actual` en el DOM, oculto por defecto (`display:none`), listo para que Task 3 lo llene.

- [ ] **Step 1: Agregar CSS del banner junto a `.mesa-nota`**

En `menu.html`, después de la línea (actual línea 27):
```css
.mesa-nota{font-size:0.78rem;color:rgba(201,184,154,0.7);margin-top:6px;line-height:1.4;}
```
agregar:
```css
.resumen-mesa{background:rgba(202,161,83,0.08);border:1px solid rgba(202,161,83,0.3);border-radius:14px;padding:14px;margin-bottom:16px;}
.resumen-mesa-titulo{font-family:'Poppins',sans-serif;font-size:0.92rem;font-weight:700;color:#caa153;margin-bottom:8px;}
.resumen-mesa-item{display:flex;justify-content:space-between;font-size:0.85rem;color:rgba(243,230,208,0.85);padding:3px 0;}
.resumen-mesa-total{display:flex;justify-content:space-between;font-weight:700;font-size:0.92rem;color:#f3e6d0;border-top:1px solid rgba(202,161,83,0.25);margin-top:6px;padding-top:6px;}
```

- [ ] **Step 2: Agregar el contenedor en el HTML**

En `menu.html`, dentro de `<main>` (actual línea 138), justo antes de `<div id="seccion-recomendados">`:

```html
<main>
  <div id="resumen-mesa-actual" style="display:none;"></div>
  <div id="seccion-recomendados">
```

- [ ] **Step 3: Verificar que el archivo sigue siendo HTML válido**

Run:
```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('menu.html','utf8'); if((h.match(/<main>/g)||[]).length !== (h.match(/<\/main>/g)||[]).length) throw new Error('main sin cerrar'); console.log('OK');"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add menu.html
git commit -m "feat: agrega el contenedor del resumen de mesa abierta a menu.html"
```

---

### Task 3: Frontend — cargar y mostrar el resumen (flujo QR / Asesor)

**Files:**
- Modify: `menu.html` (agregar funciones nuevas cerca de `renderMesaBadge`, línea 564-572; modificar `init()`, línea 1340-1366)

**Interfaces:**
- Consumes: `SCRIPT_URL` (const ya definida, línea 355), `mesaQR` (let global, línea 561), `formatoCOP()` (línea 574).
- Produces: `renderResumenMesaActual(items, total)` y `cargarResumenMesaActual()`, reutilizadas por Task 4.

- [ ] **Step 1: Agregar las 2 funciones nuevas después de `renderMesaBadge`**

En `menu.html`, después del cierre de `renderMesaBadge()` (línea 572, la `}` que cierra esa función), agregar:

```js
function renderResumenMesaActual(items, total) {
  const cont = document.getElementById('resumen-mesa-actual');
  if (!items || items.length === 0) {
    cont.style.display = 'none';
    cont.innerHTML = '';
    return;
  }
  cont.innerHTML = `
    <div class="resumen-mesa-titulo">🍽️ Ya llevas pedido en esta mesa</div>
    ${items.map(it => `<div class="resumen-mesa-item"><span>${it.cantidad}x ${it.producto}</span><span>${formatoCOP(it.total)}</span></div>`).join('')}
    <div class="resumen-mesa-total"><span>Total</span><span>${formatoCOP(total)}</span></div>
  `;
  cont.style.display = 'block';
}

async function cargarResumenMesaActual() {
  if (mesaQR === null) return;
  try {
    const res = await fetch(SCRIPT_URL + '?accion=estado_mesa&mesa=' + encodeURIComponent(mesaQR));
    const data = await res.json();
    if (data.ok && data.abierta) {
      renderResumenMesaActual(data.items || [], data.total || 0);
    }
  } catch (e) {
    // Sin conexión -- el banner simplemente no aparece, no bloquea el pedido.
  }
}
```

Nota: envolvemos `.resumen-mesa` — hay que agregar esa clase al contenedor para que tome el CSS de Task 2. Ajustar `renderResumenMesaActual` para que también controle la clase:

```js
function renderResumenMesaActual(items, total) {
  const cont = document.getElementById('resumen-mesa-actual');
  if (!items || items.length === 0) {
    cont.style.display = 'none';
    cont.className = '';
    cont.innerHTML = '';
    return;
  }
  cont.className = 'resumen-mesa';
  cont.innerHTML = `
    <div class="resumen-mesa-titulo">🍽️ Ya llevas pedido en esta mesa</div>
    ${items.map(it => `<div class="resumen-mesa-item"><span>${it.cantidad}x ${it.producto}</span><span>${formatoCOP(it.total)}</span></div>`).join('')}
    <div class="resumen-mesa-total"><span>Total</span><span>${formatoCOP(total)}</span></div>
  `;
  cont.style.display = 'block';
}
```

(Esta segunda versión reemplaza a la del párrafo anterior — es la definitiva.)

- [ ] **Step 2: Llamar `cargarResumenMesaActual()` desde `init()`**

En `menu.html`, dentro de `init()` (línea ~1357), después de `renderMesaBadge();`:

```js
  renderMesaBadge();
  cargarResumenMesaActual(); // no se espera (await) -- es informativo, no debe retrasar el catálogo
  await cargarProductos();
```

- [ ] **Step 3: Verificar sintaxis del script inline**

Run:
```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('menu.html','utf8'); const m=h.match(/<script>([\s\S]*?)<\/script>/); fs.writeFileSync('/tmp/_menu_check.js', m[1]);"
node --check /tmp/_menu_check.js
```
Expected: sin errores.

- [ ] **Step 4: Prueba manual en navegador (servidor local, sin tocar el Sheet real)**

Con el servidor `zfood-static` (`.claude/launch.json`, puerto 8791) corriendo, abrir `http://localhost:8791/menu.html?mesa=99` y, desde la consola del navegador, simular una respuesta de `estado_mesa` para confirmar el render sin depender del backend real:

```js
renderResumenMesaActual(
  [{producto: 'Hamburguesa Clásica', cantidad: 2, total: 30000}, {producto: 'Gaseosa', cantidad: 1, total: 5000}],
  35000
);
```
Expected: aparece el banner arriba del catálogo con las 2 líneas y el total $35.000; confirmar visualmente con un screenshot.

- [ ] **Step 5: Commit**

```bash
git add menu.html
git commit -m "feat: menu.html muestra lo ya pedido al abrir una mesa por QR o Asesor de Ventas"
```

---

### Task 4: Frontend — mismo resumen en el flujo 100% manual

**Files:**
- Modify: `menu.html:936-983` (`verificarMesa`)

**Interfaces:**
- Consumes: `renderResumenMesaActual(items, total)` (Task 3).

- [ ] **Step 1: Limpiar el resumen al resetear el panel**

En `verificarMesa()`, después de la línea:
```js
  nota.style.display = 'none';
```
agregar:
```js
  renderResumenMesaActual([], 0);
```

- [ ] **Step 2: Mostrar el resumen cuando la mesa está abierta**

Reemplazar:
```js
    if (data.abierta && data.mesero) {
```
por:
```js
    if (data.abierta) renderResumenMesaActual(data.items || [], data.total || 0);

    if (data.abierta && data.mesero) {
```

(El resumen se muestra en los 2 casos de mesa abierta — con mesero asignado o en autoservicio — antes de la bifurcación que ya existe para el resto del comportamiento del panel.)

- [ ] **Step 3: Verificar sintaxis**

Run:
```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('menu.html','utf8'); const m=h.match(/<script>([\s\S]*?)<\/script>/); fs.writeFileSync('/tmp/_menu_check.js', m[1]);"
node --check /tmp/_menu_check.js
```
Expected: sin errores.

- [ ] **Step 4: Prueba manual en navegador (servidor local, con `confirmarCobro`/`confirmarPedidoLocal` real deshabilitados para no tocar el Sheet)**

Con `zfood-static` corriendo, abrir `http://localhost:8791/menu.html` (sin `?mesa=`), agregar un producto al carrito, ir a "Hacer pedido" → "En el local", escribir un número de mesa que SÍ esté abierto hoy en el Sheet real (o, si no hay ninguno a mano, verificar solo que `renderResumenMesaActual([], 0)` se llama al escribir un número sin pedidos — el banner debe seguir oculto). Confirmar con `read_console_messages` que no hay errores JS y con un screenshot que el panel se ve bien con y sin resumen.

- [ ] **Step 5: Commit**

```bash
git add menu.html
git commit -m "feat: el flujo manual de mesa tambien muestra lo ya pedido"
```

---

### Task 5: Publicar el backend real y verificar en vivo

**Files:** ninguno (operativo, no hay archivo que editar en el repo además de lo ya hecho)

- [ ] **Step 1: El usuario pega `Gestion_Proyecto/01-modulos/modulo-1-apps-script-nuevo.gs.txt` actualizado en el editor real de Apps Script del Menú y publica una nueva versión** (Implementar > Administrar implementaciones > Editar > Nueva versión > Implementar). Antes de publicar, buscar con Ctrl+F `function estadoMesa` y `function obtenerResumenMesaAbierta_` y confirmar que cada una aparece una sola vez en el editor real (no solo en el archivo de referencia).

- [ ] **Step 2: Verificación de solo lectura contra producción**

Run (reemplazar `N` por un número de mesa que hoy tenga algún pedido activo, o `99` si ninguna está abierta — ambos casos son válidos de probar):
```bash
curl -s "https://donde-el-gordo.vercel.app/api/proxy-menu?accion=estado_mesa&mesa=N"
```
Expected: JSON con `"ok":true`, y si la mesa está abierta, ahora incluye `"items":[...]` y `"total":...` además de `"abierta"`/`"mesero"`. Es una lectura (`estado_mesa` es de solo lectura, no escribe nada en el Sheet) — segura de correr contra producción real, sin datos de prueba que limpiar después.

- [ ] **Step 3: Push a `master`**

Confirmar con el usuario antes de este paso (visible/desplegable a producción). Si confirma:
```bash
git push origin master
```
El GitHub Action despliega automáticamente — verificar con `gh run watch` que el deploy termina en verde.
