# Módulo 4 — División de Cuenta: Plan de Implementación

> **Para quien ejecute este plan:** usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans, tarea por tarea. Los pasos usan checkboxes (`- [ ]`) para llevar seguimiento.

**Objetivo:** Permitir que el cajero divida la cuenta de un pedido "En el local" entre varias personas — por ítem (cada quien recuerda lo que consumió) o en partes iguales — cobrando cada parte por separado, con su propio método de pago, e imprimiendo el recibo de esa persona de inmediato al cobrarla.

**Arquitectura:** Una hoja nueva `Pagos_Divididos` en el Sheet del menú + 2 acciones nuevas (`registrar_pago_parcial`, `listar_pagos_divididos`) pegadas al mismo proyecto de Apps Script que ya tiene Módulos 1/2/3/8/9. Toda la lógica de "armar la caja virtual de cada persona" vive en memoria del navegador dentro de `caja.html` — nunca se toca ninguna fila de `Ventas`. Cuando la suma de partes cobradas alcanza el total del pedido, el backend marca automáticamente todo el pedido como `Pagado` en `Ventas`, igual que ya hace `marcarPedidoPagado` del Módulo 9. Ver el diseño completo en `modulo-4-division-cuenta.md` (sección "Diseño v1").

**Tech Stack:** HTML + JavaScript vanilla (sin frameworks, sin build step), Google Apps Script (V8 runtime), Google Sheets como base de datos.

## Global Constraints

- **SCRIPT_URL** (mismo backend que `menu.html`/`cocina.html`/`comisiones.html`/`caja.html`): `https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec`
- **`E:\Proyectos ZFood GyP` SÍ es un repositorio git** (a diferencia de cuando se escribió el plan de Módulo 9) — cada tarea de este plan termina con un `git commit` de los archivos locales que haya tocado. Los cambios manuales del usuario en Apps Script/Sheets no se commitean (no existen como archivo versionado más allá de la copia `.gs.txt` de referencia).
- **No hay framework de pruebas automatizadas** en este proyecto. La verificación de backend se hace con `curl` real contra el `SCRIPT_URL` desplegado — en este entorno Windows usar siempre `curl -s -L --ssl-no-revoke` (sin `--ssl-no-revoke` falla por revocación de certificado de schannel). La verificación de frontend es manual: abrir `caja.html` en el navegador, servido por HTTP (no con doble clic — el `fetch` real no corre desde `file://`). Para servir localmente durante la verificación: `python -m http.server 8000` desde `E:\Proyectos ZFood GyP` y abrir `http://localhost:8000/caja.html`.
- **Todo dato de prueba debe llevar el prefijo `PRUEBA-CLAUDE-DIVISION-`** en mesero/persona para poder identificarlo y borrarlo al final — mismo criterio que Módulos 3/8/9. Esta vez hay que limpiar en **dos** hojas: `Ventas` y la nueva `Pagos_Divididos`.
- **Cuidado al pegar código en el editor de Apps Script online:** verificar con Ctrl+F que cada función nueva aparece **una sola vez** antes de publicar. **Importante y específico de este plan:** el proyecto ya tiene declarada `const METODOS_PAGO_CAJA = ['Efectivo', 'Nequi', 'Tarjeta'];` desde Módulo 9 — el código de este plan **reutiliza esa constante existente y no la vuelve a declarar**. Si al pegar aparece duplicada, hay que borrar la copia repetida antes de publicar (una `const` duplicada rompe con `SyntaxError` **todo** el proyecto de Apps Script, no solo Caja).
- **La hoja `Ventas` no se modifica en absoluto por este módulo** — ni sus columnas ni sus filas. Todo lo nuevo vive en la hoja `Pagos_Divididos`.
- **Los datos ficticios de `DATOS_LOCAL` en `caja.html`** (razón social/NIT/dirección) siguen pendientes de que el usuario traiga los datos reales — no es parte de este plan, no se toca.

---

### Task 1: Backend Apps Script — hoja `Pagos_Divididos` y acciones de división

**Files:**
- Create: `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-4-apps-script-division.gs.txt`
- Modify (manual, por el usuario, en el Google Sheet del menú): crear la hoja `Pagos_Divididos`
- Modify (manual, por el usuario, en el editor online de Apps Script — mismo proyecto de siempre): pegar las funciones nuevas + agregar 2 ramas a `doGet(e)`

**Interfaces:**
- Produces: `accion=registrar_pago_parcial&id_pedido=...&persona=...&monto=...&metodo_pago=...&detalle=<json opcional>` → `{ok:true, completado:true|false, restante:<number>}` o `{ok:false, error:"..."}`
- Produces: `accion=listar_pagos_divididos&id_pedido=...` → `{ok:true, partes:[{persona, monto, metodo_pago, detalle}]}`

- [ ] **Step 1: Verificar que las acciones todavía no existen (confirmar el punto de partida)**

Run:
```bash
SCRIPT_URL="https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec"
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "accion=listar_pagos_divididos" --data-urlencode "id_pedido=no-existe"
```
Expected: algo distinto de `{"ok":true,"partes":[...]}` (error, página HTML, o JSON de acción no reconocida) — confirma que la acción todavía no existe.

- [ ] **Step 2: Escribir el archivo local con las 2 funciones nuevas**

Crear `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-4-apps-script-division.gs.txt` con este contenido exacto:

```javascript
// ============================================================================
// MÓDULO 4 — DIVISIÓN DE CUENTA: nuevas acciones de Apps Script
// ============================================================================
// Instrucciones:
// 1. En el Sheet del menú, crea una hoja nueva llamada exactamente "Pagos_Divididos"
//    con esta fila de encabezados en A1:G1 (en este orden):
//    ID_Pedido | Fecha | Hora | Persona | Monto | Metodo_Pago | Detalle
// 2. Pega las 2 funciones de abajo (registrarPagoParcial, listarPagosDivididos) en
//    el MISMO proyecto de Apps Script que ya tiene las acciones de los
//    Módulos 1, 2, 3, 8 y 9.
// 3. Agrega estas 2 ramas nuevas a tu doGet(e):
//        else if (accion === 'registrar_pago_parcial') { return registrarPagoParcial(e); }
//        else if (accion === 'listar_pagos_divididos') { return listarPagosDivididos(e); }
// 4. Publica de nuevo la implementación web (Implementar > Administrar
//    implementaciones > Editar > Nueva versión > Implementar).
// 5. IMPORTANTE: antes de publicar, busca con Ctrl+F "function registrarPagoParcial"
//    y "function listarPagosDivididos" y confirma que cada una aparece una sola vez.
// 6. MUY IMPORTANTE: este archivo NO declara `METODOS_PAGO_CAJA` — esa constante ya
//    existe desde el Módulo 9 (Caja). Si al pegar aparece duplicada, borra la copia
//    repetida antes de publicar (una `const` duplicada rompe con SyntaxError TODO
//    el proyecto de Apps Script, no solo esta función).
//
// División de cuenta NUNCA toca la hoja "Ventas" ni sus filas/cantidades — solo lee
// su columna "Total" para saber cuánto falta por cobrar de un pedido. Todo el detalle
// de "quién pagó qué" queda en "Pagos_Divididos". Cuando la suma de partes cobradas
// alcanza el total del pedido, se marca TODO el pedido como Pagado en Ventas (mismo
// mecanismo que ya usa marcarPedidoPagado del Módulo 9), y se deja Metodo_Pago en
// Ventas como 'Dividido' — el desglose real por método vive en Pagos_Divididos.
// ============================================================================

/**
 * accion=registrar_pago_parcial&id_pedido=...&persona=...&monto=...&metodo_pago=...&detalle=<json opcional>
 * Registra el cobro de una "caja virtual" (una persona o un grupo) dentro de un pedido
 * que se está dividiendo. Rechaza si el monto supera lo que falta por cobrar. Si la
 * suma de partes ya cobradas alcanza el total del pedido, marca todo el pedido como
 * Pagado en Ventas.
 */
function registrarPagoParcial(e) {
  const idPedido = e.parameter.id_pedido || '';
  const persona = e.parameter.persona || '';
  const monto = Number(e.parameter.monto);
  const metodoPago = e.parameter.metodo_pago || '';
  const detalle = e.parameter.detalle || '';

  if (!idPedido || !persona || !monto || monto <= 0 || METODOS_PAGO_CAJA.indexOf(metodoPago) === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Datos inválidos para registrar el pago parcial' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const hojaVentas = SpreadsheetApp.getActive().getSheetByName('Ventas');
  const datosVentas = hojaVentas.getDataRange().getValues();
  const encabezadosVentas = datosVentas[0];
  const idxIdPedido = encabezadosVentas.indexOf('ID_Pedido');
  const idxTotal = encabezadosVentas.indexOf('Total');
  const idxEstado = encabezadosVentas.indexOf('Estado');
  const idxMetodoPago = encabezadosVentas.indexOf('Metodo_Pago');

  let totalPedido = 0;
  const filasPedido = [];
  for (let i = 1; i < datosVentas.length; i++) {
    if (datosVentas[i][idxIdPedido] === idPedido) {
      totalPedido += Number(datosVentas[i][idxTotal]);
      filasPedido.push(i);
    }
  }

  if (!filasPedido.length) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se encontró ese pedido' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const hojaPagos = SpreadsheetApp.getActive().getSheetByName('Pagos_Divididos');
  const datosPagos = hojaPagos.getDataRange().getValues();
  const encabezadosPagos = datosPagos[0];
  const idxIdPedidoPagos = encabezadosPagos.indexOf('ID_Pedido');
  const idxMontoPagos = encabezadosPagos.indexOf('Monto');

  let totalYaPagado = 0;
  for (let i = 1; i < datosPagos.length; i++) {
    if (datosPagos[i][idxIdPedidoPagos] === idPedido) {
      totalYaPagado += Number(datosPagos[i][idxMontoPagos]);
    }
  }

  if (totalYaPagado + monto > totalPedido + 0.01) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Ese monto supera lo que falta por cobrar de este pedido' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const ahora = new Date();
  hojaPagos.appendRow([idPedido, ahora, ahora, persona, monto, metodoPago, detalle]);

  const nuevoTotalPagado = totalYaPagado + monto;
  const completado = nuevoTotalPagado >= totalPedido - 0.01;

  if (completado) {
    filasPedido.forEach(function (i) {
      hojaVentas.getRange(i + 1, idxEstado + 1).setValue('Pagado');
      hojaVentas.getRange(i + 1, idxMetodoPago + 1).setValue('Dividido');
    });
  }

  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    completado: completado,
    restante: Math.max(0, totalPedido - nuevoTotalPagado)
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * accion=listar_pagos_divididos&id_pedido=...
 * Devuelve las cajas virtuales ya cobradas de un pedido en división (persona, monto,
 * método y detalle de cada una), para poder recuperar el progreso si el cajero recarga
 * la pantalla a mitad de una división.
 */
function listarPagosDivididos(e) {
  const idPedido = e.parameter.id_pedido || '';
  const hoja = SpreadsheetApp.getActive().getSheetByName('Pagos_Divididos');
  const datos = hoja.getDataRange().getValues();
  const encabezados = datos[0];
  const idx = {
    idPedido: encabezados.indexOf('ID_Pedido'),
    persona: encabezados.indexOf('Persona'),
    monto: encabezados.indexOf('Monto'),
    metodoPago: encabezados.indexOf('Metodo_Pago'),
    detalle: encabezados.indexOf('Detalle')
  };

  const partes = [];
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][idx.idPedido] === idPedido) {
      partes.push({
        persona: datos[i][idx.persona],
        monto: Number(datos[i][idx.monto]),
        metodo_pago: datos[i][idx.metodoPago],
        detalle: datos[i][idx.detalle] || ''
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true, partes: partes }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 3: Pedirle al usuario que aplique los cambios manuales**

Decirle al usuario, en estos términos:
1. Abrir el Sheet del menú → crear una hoja nueva con el nombre exacto `Pagos_Divididos` → en la fila 1, escribir estos 7 encabezados en A1:G1: `ID_Pedido`, `Fecha`, `Hora`, `Persona`, `Monto`, `Metodo_Pago`, `Detalle`.
2. Abrir el proyecto de Apps Script de siempre (Extensiones → Apps Script) → pegar las 2 funciones de arriba en cualquier parte del archivo.
3. Buscar `doGet(e)` y agregar, junto a las ramas `else if` existentes, estas 2 líneas:
```javascript
else if (accion === 'registrar_pago_parcial') { return registrarPagoParcial(e); }
else if (accion === 'listar_pagos_divididos') { return listarPagosDivididos(e); }
```
4. Con Ctrl+F, confirmar que `function registrarPagoParcial` y `function listarPagosDivididos` aparecen **una sola vez** cada una, y que `METODOS_PAGO_CAJA` sigue apareciendo **una sola vez** en todo el proyecto (no se debió pegar una segunda declaración).
5. Guardar (Ctrl+S) y publicar nueva versión: Implementar → Administrar implementaciones → editar (lápiz) → Nueva versión → Implementar.
6. Avisar cuando esté listo.

- [ ] **Step 4: Commit del archivo local**

```bash
git add "Gestion_Proyecto/01-modulos/modulo-4-apps-script-division.gs.txt"
git commit -m "feat: agregar acciones de Apps Script para división de cuenta (Módulo 4)"
```

- [ ] **Step 5: Esperar confirmación del usuario antes de continuar a Task 2**

No avanzar hasta que el usuario confirme que creó la hoja `Pagos_Divididos` y publicó la nueva versión del Apps Script.

---

### Task 2: Verificación en vivo del backend de división

**Files:** ninguno (solo llamadas `curl` contra el backend real)

**Interfaces:**
- Consumes: `registrar_pago_parcial`, `listar_pagos_divididos` (Task 1)

- [ ] **Step 1: Crear un pedido de prueba con un ítem de cantidad > 1**

```bash
SCRIPT_URL="https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec"

curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" \
  --data-urlencode "accion=crear_pedido" \
  --data-urlencode "tipo=local" \
  --data-urlencode "mesa=971" \
  --data-urlencode "mesero=PRUEBA-CLAUDE-DIVISION" \
  --data-urlencode 'items=[{"producto":"PRUEBA-CLAUDE-DIVISION-Churrasco","cantidad":1,"precio":28000},{"producto":"PRUEBA-CLAUDE-DIVISION-Papas","cantidad":3,"precio":6000},{"producto":"PRUEBA-CLAUDE-DIVISION-Cerveza","cantidad":1,"precio":8000}]'
```
Expected: `{"ok":true,"id_pedido":"<uuid>"}`. El total de este pedido es 28000 + 3×6000 + 8000 = **54.000**. Guardar el `id_pedido` para los siguientes pasos.

- [ ] **Step 2: Cobrar la primera caja virtual (Persona A: Churrasco + 1 Papas)**

```bash
ID_PEDIDO="<pegar aquí el id_pedido del Step 1>"
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" \
  --data-urlencode "accion=registrar_pago_parcial" \
  --data-urlencode "id_pedido=$ID_PEDIDO" \
  --data-urlencode "persona=PRUEBA-CLAUDE-DIVISION-A" \
  --data-urlencode "monto=34000" \
  --data-urlencode "metodo_pago=Efectivo" \
  --data-urlencode 'detalle=[{"producto":"PRUEBA-CLAUDE-DIVISION-Churrasco","cantidad":1},{"producto":"PRUEBA-CLAUDE-DIVISION-Papas","cantidad":1}]'
```
Expected: `{"ok":true,"completado":false,"restante":20000}` (54000 − 34000 = 20000).

- [ ] **Step 3: Confirmar que el pedido sigue "Pendiente de pago" en `listar_pedidos_caja`**

```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "accion=listar_pedidos_caja"
```
Expected: el pedido de prueba (mesa 971) todavía tiene `estado:"Pendiente de pago"` — cobrar una parte no cierra el pedido completo.

- [ ] **Step 4: Intentar cobrar de más (debe rechazarse)**

```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" \
  --data-urlencode "accion=registrar_pago_parcial" \
  --data-urlencode "id_pedido=$ID_PEDIDO" \
  --data-urlencode "persona=PRUEBA-CLAUDE-DIVISION-B" \
  --data-urlencode "monto=25000" \
  --data-urlencode "metodo_pago=Nequi" \
  --data-urlencode 'detalle=[{"producto":"PRUEBA-CLAUDE-DIVISION-Papas","cantidad":2},{"producto":"PRUEBA-CLAUDE-DIVISION-Cerveza","cantidad":1}]'
```
Expected: `{"ok":false,"error":"Ese monto supera lo que falta por cobrar de este pedido"}` (pedía 25.000 pero solo faltan 20.000).

- [ ] **Step 5: Cobrar la segunda caja virtual con el monto correcto (debe completar el pedido)**

```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" \
  --data-urlencode "accion=registrar_pago_parcial" \
  --data-urlencode "id_pedido=$ID_PEDIDO" \
  --data-urlencode "persona=PRUEBA-CLAUDE-DIVISION-B" \
  --data-urlencode "monto=20000" \
  --data-urlencode "metodo_pago=Nequi" \
  --data-urlencode 'detalle=[{"producto":"PRUEBA-CLAUDE-DIVISION-Papas","cantidad":2},{"producto":"PRUEBA-CLAUDE-DIVISION-Cerveza","cantidad":1}]'
```
Expected: `{"ok":true,"completado":true,"restante":0}`.

- [ ] **Step 6: Confirmar que el pedido ya quedó Pagado en `Ventas`**

```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "accion=listar_pedidos_caja"
```
Expected: el pedido de prueba (mesa 971) ahora tiene `estado:"Pagado"` y `metodo_pago:"Dividido"`.

- [ ] **Step 7: Confirmar que `listar_pagos_divididos` trae las 2 partes**

```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "accion=listar_pagos_divididos" --data-urlencode "id_pedido=$ID_PEDIDO"
```
Expected: `{"ok":true,"partes":[...]}` con 2 elementos — Persona A ($34.000, Efectivo) y Persona B ($20.000, Nequi) — cada uno con su `detalle` en JSON.

- [ ] **Step 8: Avisar al usuario que borre las filas de prueba**

Decirle al usuario que borre en `Ventas` las filas con mesero `PRUEBA-CLAUDE-DIVISION` (mesa 971), y en `Pagos_Divididos` las 2 filas con persona `PRUEBA-CLAUDE-DIVISION-A` y `PRUEBA-CLAUDE-DIVISION-B`. No continuar a Task 3 hasta que confirme.

---

### Task 3: Frontend — vista "Dividir cuenta" y modo "por ítem"

**Files:**
- Modify: `E:\Proyectos ZFood GyP\caja.html`

**Interfaces:**
- Consumes: `registrar_pago_parcial`, `listar_pagos_divididos` (Task 1); `pedidos`, `render()`, `cargarPedidos()`, `formatoCOP()`, `imprimirRecibo(pedido)` (ya existentes en `caja.html`)
- Produces: `abrirDivision(idPedido)`, `cerrarDivision()`, `division` (variable global), `renderDivision()`, `ajustarUnidad(producto, delta)`, `subtotalCajaActual()`, `iniciarCobroCajaItem()`, `confirmarCobroParcial(metodo)` — usadas por Task 4.

- [ ] **Step 1: Agregar el CSS de la vista de división**

En `caja.html`, dentro de `<style>`, justo antes de `#recibo-imprimir{display:none;}`, agregar:

```css
.overlay-division{position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;z-index:60;padding:24px 12px;}
.overlay-division.oculto{display:none;}
.panel-division{background:#2a1500;border:1px solid rgba(200,132,26,0.4);border-radius:16px;padding:20px;width:100%;max-width:520px;display:flex;flex-direction:column;gap:16px;}
.panel-division h3{color:#e8a832;font-size:1.15rem;}
.division-modos{display:flex;gap:8px;}
.btn-modo{flex:1;padding:10px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,132,26,0.35);color:#f0e0b0;font-size:0.85rem;font-weight:700;cursor:pointer;}
.btn-modo.activo{background:linear-gradient(135deg,#c8841a,#e8a832);color:#1a0a00;border-color:transparent;}
.division-seccion{display:flex;flex-direction:column;gap:8px;}
.division-seccion h4{color:#e8c87a;font-size:0.8rem;letter-spacing:1px;text-transform:uppercase;}
.parte-cobrada{display:flex;justify-content:space-between;font-size:0.85rem;color:rgba(240,224,176,0.8);padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);}
.producto-stepper{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.88rem;}
.producto-stepper .info{display:flex;flex-direction:column;}
.producto-stepper .disponible{font-size:0.72rem;color:rgba(240,224,176,0.5);}
.stepper-controles{display:flex;align-items:center;gap:10px;}
.btn-stepper{width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(200,132,26,0.35);color:#f0e0b0;font-size:1.1rem;font-weight:700;cursor:pointer;}
.input-nombre{padding:10px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,132,26,0.35);color:#fff;font-size:0.9rem;}
.division-subtotal{display:flex;justify-content:space-between;font-weight:800;color:#e8a832;font-size:1rem;padding-top:8px;border-top:1px solid rgba(200,132,26,0.3);}
```

- [ ] **Step 2: Incluir la vista de división en la regla de impresión existente**

Buscar:
```css
@media print{
  header, main, .overlay{display:none;}
```
Reemplazar por:
```css
@media print{
  header, main, .overlay, .overlay-division{display:none;}
```

- [ ] **Step 3: Agregar el botón "Dividir cuenta" a las tarjetas de pedidos locales pendientes**

Buscar:
```javascript
      <div class="pedido-footer">
        ${p.tipo === 'domicilio' ? `<button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="imprimirReciboPorId('${p.id_pedido}')">🖨️ ${p.estado === 'Pagado' ? 'Reimprimir' : 'Imprimir'} recibo</button>` : ''}
        ${p.estado === 'Pagado'
          ? (p.tipo === 'local' ? `<button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="imprimirReciboPorId('${p.id_pedido}')">🖨️ Reimprimir recibo</button>` : '')
          : `<button class="btn-cobrar" onclick="abrirModalCobrar('${p.id_pedido}')">Cobrar</button>`}
      </div>
```
Reemplazar por:
```javascript
      <div class="pedido-footer">
        ${p.tipo === 'domicilio' ? `<button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="imprimirReciboPorId('${p.id_pedido}')">🖨️ ${p.estado === 'Pagado' ? 'Reimprimir' : 'Imprimir'} recibo</button>` : ''}
        ${p.tipo === 'local' && p.estado !== 'Pagado' ? `<button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="abrirDivision('${p.id_pedido}')">➗ Dividir cuenta</button>` : ''}
        ${p.estado === 'Pagado'
          ? (p.tipo === 'local' ? `<button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="imprimirReciboPorId('${p.id_pedido}')">🖨️ Reimprimir recibo</button>` : '')
          : `<button class="btn-cobrar" onclick="abrirModalCobrar('${p.id_pedido}')">Cobrar</button>`}
      </div>
```

- [ ] **Step 4: Agregar el HTML de la vista de división y su modal de cobro parcial**

Buscar:
```html
<div id="recibo-imprimir"></div>
```
Reemplazar por:
```html
<div class="overlay-division oculto" id="overlay-division">
  <div class="panel-division">
    <h3>Dividir cuenta</h3>
    <div id="division-restante" style="font-size:0.85rem;color:rgba(240,224,176,0.8);"></div>

    <div class="division-seccion">
      <h4>Ya cobrado</h4>
      <div id="division-partes-cobradas"></div>
    </div>

    <div class="division-modos">
      <button class="btn-modo activo" id="btn-modo-item" onclick="cambiarModoDivision('item')">Por ítem</button>
      <button class="btn-modo" id="btn-modo-igual" onclick="cambiarModoDivision('igual')">Partes iguales</button>
    </div>

    <div class="division-seccion" id="division-modo-item" style="display:flex;">
      <h4>¿Quién paga ahora?</h4>
      <input type="text" class="input-nombre" id="input-nombre-persona" placeholder="Nombre de la persona">
      <div id="division-productos"></div>
      <div class="division-subtotal">
        <span>Subtotal de esta caja</span>
        <span id="division-subtotal-caja">$0</span>
      </div>
      <button class="btn-cobrar" onclick="iniciarCobroCajaItem()">Cobrar a esta persona</button>
    </div>

    <div class="division-seccion" id="division-modo-igual" style="display:none;">
      <h4>Dividir entre</h4>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="number" class="input-n-partes" id="input-n-partes" min="2" value="2" style="width:60px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,132,26,0.35);color:#fff;font-size:0.9rem;text-align:center;">
        <button class="btn-modo" onclick="generarPartesIguales()">Generar</button>
      </div>
      <div id="division-partes-iguales-lista"></div>
    </div>

    <button class="btn-cancelar" onclick="cerrarDivision()">Cerrar</button>
  </div>
</div>

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

- [ ] **Step 5: Agregar el estado global y las funciones de división en el JS**

Buscar:
```javascript
let pedidos = [];
let vistaTipo = 'local';
let vistaEstado = 'pendientes';
let pedidoIdParaCobrar = null;
let usandoDatosMuestra = false;
const pedidosPagoPendiente = new Set();
```
Reemplazar por:
```javascript
let pedidos = [];
let vistaTipo = 'local';
let vistaEstado = 'pendientes';
let pedidoIdParaCobrar = null;
let usandoDatosMuestra = false;
const pedidosPagoPendiente = new Set();

// Estado de la vista "Dividir cuenta" (Módulo 4). Todo esto vive solo en memoria
// del navegador — nunca se guarda en Ventas. Lo único que se persiste es el
// resultado de cada caja ya cobrada, vía registrar_pago_parcial.
let division = null;
let idPedidoParaCobrarParcial = null;
let personaParaCobrarParcial = '';
let montoParaCobrarParcial = 0;
let detalleParaCobrarParcial = '';

async function abrirDivision(idPedido) {
  const pedido = pedidos.find(p => p.id_pedido === idPedido);
  if (!pedido) return;

  let partesCobradas = [];
  try {
    const params = new URLSearchParams({ accion: 'listar_pagos_divididos', id_pedido: idPedido });
    const res = await fetch(SCRIPT_URL + '?' + params.toString());
    const data = await res.json();
    if (data.ok && Array.isArray(data.partes)) partesCobradas = data.partes;
  } catch (e) {
    // Sin conexión: se continúa con lo que haya en pantalla; el cajero puede
    // reintentar más tarde si esto deja de responder.
  }

  const disponibles = pedido.items.map(it => ({
    producto: it.producto,
    precioUnitario: it.total / it.cantidad,
    cantidadLibre: it.cantidad
  }));

  partesCobradas.forEach(parte => {
    let detalle = [];
    try { detalle = JSON.parse(parte.detalle || '[]'); } catch (e) { detalle = []; }
    detalle.forEach(d => {
      const linea = disponibles.find(x => x.producto === d.producto);
      if (linea) linea.cantidadLibre = Math.max(0, linea.cantidadLibre - d.cantidad);
    });
  });

  division = {
    idPedido: idPedido,
    pedido: pedido,
    disponibles: disponibles,
    partesCobradas: partesCobradas,
    modo: 'item',
    cajaActual: { seleccion: {} },
    nPartesIguales: 2
  };

  document.getElementById('overlay-division').classList.remove('oculto');
  renderDivision();
}

function cerrarDivision() {
  division = null;
  document.getElementById('overlay-division').classList.add('oculto');
}

function cambiarModoDivision(modo) {
  if (!division) return;
  division.modo = modo;
  renderDivision();
}

function ajustarUnidad(producto, delta) {
  const linea = division.disponibles.find(x => x.producto === producto);
  if (!linea) return;
  const actual = division.cajaActual.seleccion[producto] || 0;
  const nuevo = actual + delta;
  if (nuevo < 0 || nuevo > actual + linea.cantidadLibre) return;
  division.cajaActual.seleccion[producto] = nuevo;
  linea.cantidadLibre -= delta;
  renderDivision();
}

function subtotalCajaActual() {
  let subtotal = 0;
  Object.keys(division.cajaActual.seleccion).forEach(producto => {
    const cant = division.cajaActual.seleccion[producto];
    const linea = division.disponibles.find(x => x.producto === producto);
    if (linea && cant > 0) subtotal += cant * linea.precioUnitario;
  });
  return subtotal;
}

function iniciarCobroCajaItem() {
  const persona = document.getElementById('input-nombre-persona').value.trim();
  const subtotal = subtotalCajaActual();
  if (!persona) { alert('Escribe el nombre de la persona.'); return; }
  if (subtotal <= 0) { alert('Selecciona al menos un ítem para esta caja.'); return; }

  const detalle = Object.keys(division.cajaActual.seleccion)
    .filter(p => division.cajaActual.seleccion[p] > 0)
    .map(p => ({ producto: p, cantidad: division.cajaActual.seleccion[p] }));

  idPedidoParaCobrarParcial = division.idPedido;
  personaParaCobrarParcial = persona;
  montoParaCobrarParcial = subtotal;
  detalleParaCobrarParcial = JSON.stringify(detalle);
  document.getElementById('overlay-cobrar-parcial').classList.remove('oculto');
}

function cerrarModalCobrarParcial() {
  document.getElementById('overlay-cobrar-parcial').classList.add('oculto');
}

async function confirmarCobroParcial(metodo) {
  cerrarModalCobrarParcial();
  const idPedido = idPedidoParaCobrarParcial;
  const persona = personaParaCobrarParcial;
  const monto = montoParaCobrarParcial;
  const detalle = detalleParaCobrarParcial;
  if (!idPedido || !persona || !monto) return;

  try {
    const params = new URLSearchParams({
      accion: 'registrar_pago_parcial',
      id_pedido: idPedido,
      persona: persona,
      monto: monto,
      metodo_pago: metodo,
      detalle: detalle
    });
    const res = await fetch(SCRIPT_URL + '?' + params.toString());
    const data = await res.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');

    let itemsDetalle = [];
    try { itemsDetalle = JSON.parse(detalle || '[]'); } catch (e) { itemsDetalle = []; }
    const itemsRecibo = itemsDetalle.map(d => {
      const linea = division.disponibles.find(x => x.producto === d.producto);
      const precioUnitario = linea ? linea.precioUnitario : (monto / d.cantidad);
      return { producto: d.producto, cantidad: d.cantidad, total: precioUnitario * d.cantidad };
    });

    imprimirRecibo({
      tipo: division.pedido.tipo,
      mesa: division.pedido.mesa,
      items: itemsRecibo,
      total: monto,
      metodo_pago: metodo + ' — ' + persona
    });

    division.partesCobradas.push({ persona: persona, monto: monto, metodo_pago: metodo, detalle: detalle });
    division.cajaActual = { seleccion: {} };
    document.getElementById('input-nombre-persona').value = '';

    if (data.completado) {
      cerrarDivision();
      cargarPedidos();
    } else {
      renderDivision();
    }
  } catch (e) {
    alert('No se pudo registrar el cobro de esa parte: ' + e.message);
  }
}

function renderDivision() {
  if (!division) return;
  const totalPedido = division.pedido.total;
  const totalCobrado = division.partesCobradas.reduce((s, p) => s + Number(p.monto), 0);
  const restante = totalPedido - totalCobrado;

  const contPartes = document.getElementById('division-partes-cobradas');
  contPartes.innerHTML = division.partesCobradas.length === 0
    ? '<div style="font-size:0.8rem;color:rgba(240,224,176,0.5);">Nadie ha pagado todavía.</div>'
    : division.partesCobradas.map(p => `
        <div class="parte-cobrada">
          <span>✅ ${p.persona}</span>
          <span>${formatoCOP(p.monto)} (${p.metodo_pago})</span>
        </div>
      `).join('');

  document.getElementById('division-restante').textContent = 'Falta por cobrar: ' + formatoCOP(restante);

  document.getElementById('btn-modo-item').classList.toggle('activo', division.modo === 'item');
  document.getElementById('btn-modo-igual').classList.toggle('activo', division.modo === 'igual');
  document.getElementById('division-modo-item').style.display = division.modo === 'item' ? 'flex' : 'none';
  document.getElementById('division-modo-igual').style.display = division.modo === 'igual' ? 'flex' : 'none';

  if (division.modo === 'item') {
    const contProductos = document.getElementById('division-productos');
    contProductos.innerHTML = division.disponibles.map(linea => `
      <div class="producto-stepper">
        <div class="info">
          <span>${linea.producto}</span>
          <span class="disponible">${linea.cantidadLibre} sin asignar</span>
        </div>
        <div class="stepper-controles">
          <button class="btn-stepper" onclick="ajustarUnidad('${linea.producto}', -1)">−</button>
          <span>${division.cajaActual.seleccion[linea.producto] || 0}</span>
          <button class="btn-stepper" onclick="ajustarUnidad('${linea.producto}', 1)" ${linea.cantidadLibre <= 0 ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `).join('');
    document.getElementById('division-subtotal-caja').textContent = formatoCOP(subtotalCajaActual());
  }
}
```

- [ ] **Step 6: Verificación manual con datos reales**

1. Crear un pedido de prueba (mismo comando que Task 2 Step 1, cambiando mesa a `972` y mesero a `PRUEBA-CLAUDE-DIVISION-FRONT`).
2. Servir `caja.html` por HTTP (`python -m http.server 8000` desde `E:\Proyectos ZFood GyP`, abrir `http://localhost:8000/caja.html`).
3. Confirmar que el pedido de prueba aparece en "En el local" → "Pendientes" con el botón "➗ Dividir cuenta" visible (y que los pedidos de Domicilio NO lo muestran).
4. Clic en "Dividir cuenta" → confirmar que aparecen los 3 productos con su cantidad disponible, y que "Papas" muestra "3 sin asignar".
5. Escribir "Ana" en el nombre, tocar `+` en Churrasco (1) y en Papas (una vez) → confirmar que el subtotal muestra $34.000 y que "Papas" ahora dice "2 sin asignar".
6. Clic en "Cobrar a esta persona" → elegir "Efectivo" → confirmar que se abre el diálogo de impresión (Ctrl+P) con el recibo de Ana (Churrasco + 1 Papas, total $34.000, "Efectivo — Ana"), y que al cancelar el diálogo la sección "Ya cobrado" muestra "✅ Ana — $34.000 (Efectivo)" y "Falta por cobrar: $20.000".
7. Verificar contra el backend real:
```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "accion=listar_pagos_divididos" --data-urlencode "id_pedido=<id_pedido de este pedido>"
```
Expected: aparece la parte de Ana con su detalle.
8. Pedirle al usuario que borre la fila de prueba en `Ventas` (mesero `PRUEBA-CLAUDE-DIVISION-FRONT`) y la fila en `Pagos_Divididos` (persona `Ana`) — dejar anotado que esta vez la persona de prueba no llevó el prefijo `PRUEBA-CLAUDE-DIVISION-` porque el campo lo escribe libremente el cajero; identificarla por el `ID_Pedido` de este pedido de prueba.

---

### Task 4: Frontend — modo "Partes iguales"

**Files:**
- Modify: `E:\Proyectos ZFood GyP\caja.html` (de Task 3)

**Interfaces:**
- Consumes: `division`, `renderDivision()`, `formatoCOP()`, `overlay-cobrar-parcial` (Task 3)
- Produces: `generarPartesIguales()`, `renderPartesIguales()`, `cobrarParteIgual(numeroParte, monto)`

- [ ] **Step 1: Agregar el CSS de las tarjetas de partes iguales**

Buscar:
```css
.division-subtotal{display:flex;justify-content:space-between;font-weight:800;color:#e8a832;font-size:1rem;padding-top:8px;border-top:1px solid rgba(200,132,26,0.3);}
```
Reemplazar por:
```css
.division-subtotal{display:flex;justify-content:space-between;font-weight:800;color:#e8a832;font-size:1rem;padding-top:8px;border-top:1px solid rgba(200,132,26,0.3);}
.parte-igual-card{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;border:1px solid rgba(200,132,26,0.25);border-radius:10px;}
```

- [ ] **Step 2: Agregar la lógica de partes iguales en el JS**

Buscar:
```javascript
  if (division.modo === 'item') {
    const contProductos = document.getElementById('division-productos');
    contProductos.innerHTML = division.disponibles.map(linea => `
      <div class="producto-stepper">
        <div class="info">
          <span>${linea.producto}</span>
          <span class="disponible">${linea.cantidadLibre} sin asignar</span>
        </div>
        <div class="stepper-controles">
          <button class="btn-stepper" onclick="ajustarUnidad('${linea.producto}', -1)">−</button>
          <span>${division.cajaActual.seleccion[linea.producto] || 0}</span>
          <button class="btn-stepper" onclick="ajustarUnidad('${linea.producto}', 1)" ${linea.cantidadLibre <= 0 ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `).join('');
    document.getElementById('division-subtotal-caja').textContent = formatoCOP(subtotalCajaActual());
  }
}
```
Reemplazar por:
```javascript
  if (division.modo === 'item') {
    const contProductos = document.getElementById('division-productos');
    contProductos.innerHTML = division.disponibles.map(linea => `
      <div class="producto-stepper">
        <div class="info">
          <span>${linea.producto}</span>
          <span class="disponible">${linea.cantidadLibre} sin asignar</span>
        </div>
        <div class="stepper-controles">
          <button class="btn-stepper" onclick="ajustarUnidad('${linea.producto}', -1)">−</button>
          <span>${division.cajaActual.seleccion[linea.producto] || 0}</span>
          <button class="btn-stepper" onclick="ajustarUnidad('${linea.producto}', 1)" ${linea.cantidadLibre <= 0 ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `).join('');
    document.getElementById('division-subtotal-caja').textContent = formatoCOP(subtotalCajaActual());
  } else {
    renderPartesIguales();
  }
}

function generarPartesIguales() {
  const n = parseInt(document.getElementById('input-n-partes').value, 10);
  if (!n || n < 2) { alert('Escribe un número de personas de 2 o más.'); return; }
  division.nPartesIguales = n;
  renderPartesIguales();
}

function renderPartesIguales() {
  const totalPedido = division.pedido.total;
  const totalCobrado = division.partesCobradas.reduce((s, p) => s + Number(p.monto), 0);
  const restante = totalPedido - totalCobrado;
  const n = division.nPartesIguales;
  const yaGeneradas = division.partesCobradas.length;
  const partesFaltantes = Math.max(0, n - yaGeneradas);

  const cont = document.getElementById('division-partes-iguales-lista');
  if (partesFaltantes === 0) {
    cont.innerHTML = '<div style="font-size:0.8rem;color:rgba(240,224,176,0.5);">Ya se generaron todas las partes para este número de personas.</div>';
    return;
  }

  const base = Math.floor(restante / partesFaltantes);
  const html = [];
  for (let i = 0; i < partesFaltantes; i++) {
    const esUltima = i === partesFaltantes - 1;
    const monto = esUltima ? (restante - base * (partesFaltantes - 1)) : base;
    const numeroParte = yaGeneradas + i + 1;
    html.push(`
      <div class="parte-igual-card">
        <span>Parte ${numeroParte} de ${n}</span>
        <span>${formatoCOP(monto)}</span>
        <button class="btn-cobrar" onclick="cobrarParteIgual(${numeroParte}, ${monto})">Cobrar</button>
      </div>
    `);
  }
  cont.innerHTML = html.join('');
}

function cobrarParteIgual(numeroParte, monto) {
  idPedidoParaCobrarParcial = division.idPedido;
  personaParaCobrarParcial = 'Parte ' + numeroParte + ' de ' + division.nPartesIguales;
  montoParaCobrarParcial = monto;
  detalleParaCobrarParcial = '';
  document.getElementById('overlay-cobrar-parcial').classList.remove('oculto');
}
```

- [ ] **Step 3: Verificación manual con datos reales**

1. Crear un pedido de prueba de $60.000 (por ejemplo un solo ítem `PRUEBA-CLAUDE-DIVISION-Mixto` cantidad 1 precio 60000, mesa `973`, mesero `PRUEBA-CLAUDE-DIVISION-IGUAL`).
2. Servir `caja.html` por HTTP, abrir "Dividir cuenta" para ese pedido, clic en pestaña "Partes iguales".
3. Escribir `3` en el campo y clic en "Generar" → confirmar que aparecen 3 tarjetas de $20.000 cada una.
4. Cobrar "Parte 1 de 3" con Efectivo → confirmar que imprime su recibo (total $20.000, sin ítems detallados) y que "Falta por cobrar" baja a $40.000.
5. Cobrar "Parte 2 de 3" con Nequi → confirmar recibo y que faltan $20.000.
6. Cobrar "Parte 3 de 3" con Tarjeta → confirmar que el pedido se cierra solo (la vista de división se cierra y el pedido pasa a "Pagados" en la pantalla principal).
7. Verificar contra el backend real que las 3 partes quedaron en `Pagos_Divididos` con sus 3 métodos distintos, y que el pedido quedó `Pagado`/`Dividido` en `Ventas`.
8. Pedirle al usuario que borre la fila de prueba en `Ventas` (mesero `PRUEBA-CLAUDE-DIVISION-IGUAL`) y las 3 filas en `Pagos_Divididos` (identificarlas por el `ID_Pedido` de este pedido).

---

### Task 5: Recuperar progreso al reabrir una división a medias

**Files:**
- Ninguno nuevo — esta tarea es de **verificación**, no de código: `abrirDivision()` (Task 3) ya llama `listar_pagos_divididos` y resta las unidades ya entregadas antes de mostrar la pantalla, así que la recuperación de progreso ya quedó implementada como parte de Task 3. Esta tarea confirma que funciona de verdad, con un cierre/reapertura real del navegador.

**Interfaces:**
- Consumes: `abrirDivision(idPedido)`, `listar_pagos_divididos` (Task 1 y Task 3)

- [ ] **Step 1: Crear un pedido de prueba con 2 ítems de cantidad > 1**

```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" \
  --data-urlencode "accion=crear_pedido" \
  --data-urlencode "tipo=local" \
  --data-urlencode "mesa=974" \
  --data-urlencode "mesero=PRUEBA-CLAUDE-DIVISION-RECUP" \
  --data-urlencode 'items=[{"producto":"PRUEBA-CLAUDE-DIVISION-Gaseosa","cantidad":4,"precio":4000},{"producto":"PRUEBA-CLAUDE-DIVISION-Papas","cantidad":2,"precio":6000}]'
```
Total: 4×4000 + 2×6000 = **28.000**. Guardar el `id_pedido`.

- [ ] **Step 2: Dividir y cobrar solo la primera caja, con el navegador**

1. Servir `caja.html` por HTTP, abrir "Dividir cuenta" para el pedido de la mesa 974.
2. Asignar 2 Gaseosas a "Carlos" (subtotal $8.000) y cobrarlas con Efectivo.
3. Confirmar que "Gaseosa" ahora muestra "2 sin asignar" y "Papas" sigue en "2 sin asignar".
4. **Cerrar por completo la pestaña/ventana del navegador** (no solo el modal) para simular que el cajero salió de la pantalla a medias.

- [ ] **Step 3: Reabrir y confirmar que el progreso se recuperó**

1. Volver a abrir `http://localhost:8000/caja.html`.
2. Ir a "En el local" → "Pendientes", buscar la mesa 974, clic en "Dividir cuenta".
3. Expected: la sección "Ya cobrado" muestra "✅ Carlos — $8.000 (Efectivo)" sin haberlo vuelto a cobrar, "Gaseosa" muestra "2 sin asignar" (no 4), "Papas" sigue en "2 sin asignar", y "Falta por cobrar" muestra $20.000.
4. Terminar de cobrar el resto (por ejemplo todo a "Ana") y confirmar que el pedido se cierra correctamente.

- [ ] **Step 4: Limpieza**

Pedirle al usuario que borre la fila de prueba en `Ventas` (mesero `PRUEBA-CLAUDE-DIVISION-RECUP`) y las filas correspondientes en `Pagos_Divididos` (Carlos y Ana, identificadas por este `ID_Pedido`).

---

### Task 6: Actualizar documentación del proyecto

**Files:**
- Modify: `E:\Proyectos ZFood GyP\Gestion_Proyecto\03-seguimiento\ESTADO.md`
- Modify: `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-4-division-cuenta.md`

- [ ] **Step 1: Actualizar la fila del Módulo 4 en la tabla de `ESTADO.md`**

Buscar:
```
| 4. División de cuenta | Pendiente | Definir modelo de datos "quién pidió qué" dentro de una mesa. Propina: confirmado que va directo al mesero individual, no al bono grupal. |
```
Reemplazar por (usando la fecha real en que se complete este plan en vez de `<FECHA>`):
```
| 4. División de cuenta | **Construido y verificado en vivo — <FECHA>** | `caja.html`: botón "Dividir cuenta" en pedidos "En el local" pendientes, con dos modos — por ítem (stepper por unidad, recupera progreso si se reabre a medias) y partes iguales (N partes, la última absorbe el redondeo). Cada caja virtual se cobra con su propio método de pago y su recibo se imprime de inmediato. Backend nuevo (`registrar_pago_parcial`/`listar_pagos_divididos` + hoja `Pagos_Divididos`) verificado en vivo, incluyendo el rechazo de un cobro que supera lo pendiente. `Ventas` no se modifica en su estructura — al completarse la división, el pedido se marca `Pagado`/`Dividido` igual que cualquier otro. |
```

- [ ] **Step 2: Agregar una entrada a la sección de pruebas en vivo con el resultado de Tasks 2, 3, 4 y 5**

Agregar al final de la sección de pruebas en vivo de `ESTADO.md` un párrafo describiendo lo verificado (mismo formato que las entradas de Módulos 8/9): qué se probó (backend por curl, frontend con navegador real, recuperación de progreso tras cerrar y reabrir), con qué datos de prueba, y confirmación de que se limpiaron en `Ventas` y `Pagos_Divididos`.

- [ ] **Step 3: Marcar el plan como ejecutado en `modulo-4-division-cuenta.md`**

Agregar una línea al principio del archivo (después del encabezado existente) indicando que el plan de `modulo-4-plan-implementacion.md` fue ejecutado y en qué fecha, y actualizar la sección "Qué falta" para reflejar solo lo que realmente sigue pendiente (si algo queda).

- [ ] **Step 4: Commit de la documentación**

```bash
git add "Gestion_Proyecto/03-seguimiento/ESTADO.md" "Gestion_Proyecto/01-modulos/modulo-4-division-cuenta.md"
git commit -m "docs: cerrar Módulo 4 (División de cuenta) — construido y verificado en vivo"
```

---

## Self-Review (completado durante la escritura de este plan)

- **Cobertura del spec**: asignación al cobrar, no al pedir (Task 3 — `abrirDivision` parte del pedido ya existente, sin tocar Módulo 2); dos modos por el mismo backend (Task 3 modo ítem, Task 4 modo igual, ambos llaman `registrar_pago_parcial`); división por unidad, no por fila (stepper en Task 3 con `cantidadLibre` por producto); `Ventas` nunca se toca en su estructura (Task 1, comentario explícito en el `.gs.txt`); recibo individual por parte (Task 3 `confirmarCobroParcial` llama `imprimirRecibo` de inmediato); recuperar progreso (columna `Detalle` en Task 1 + `abrirDivision` en Task 3 + verificación dedicada en Task 5); rechazo de cobro de más (Task 1 `registrarPagoParcial`, verificado en Task 2 Step 4) — todo cubierto.
- **Placeholders**: ninguno — todo el código de cada step es completo y ejecutable tal cual.
- **Consistencia de tipos/nombres**: `division.disponibles[].producto`/`precioUnitario`/`cantidadLibre` se usan igual en Task 3 y Task 4; `detalle` siempre es un string JSON (nunca un objeto) tanto al armarlo en `iniciarCobroCajaItem`/`cobrarParteIgual` como al parsearlo en `confirmarCobroParcial`/`abrirDivision`; `persona`/`monto`/`metodo_pago` en el mismo orden y nombre en frontend y backend; `registrarPagoParcial`/`listarPagosDivididos` (backend, camelCase) vs. `registrar_pago_parcial`/`listar_pagos_divididos` (parámetro `accion`, snake_case) — mismo patrón ya usado en Módulo 9, no es una inconsistencia sino la convención existente del proyecto.
