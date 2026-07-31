# Rediseño de Caja (grid de mesas) y Cocina (botones) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la pantalla de entrada de `caja.html` (hoy pestañas + lista) por un grid de 20 mesas + 5 cupos de domicilio coloreados por estado, con cuenta combinada por mesa y un botón de liberar que cierra el hueco de atribución de mesero; y reemplazar `cocina.html` (hoy tarjetas siempre abiertas) por una lista de botones con detalle y regreso — según el diseño aprobado en `docs/superpowers/specs/2026-07-30-caja-cocina-rediseno-design.md`.

**Architecture:** Todo el estado sigue viviendo en la hoja `Ventas` (Google Sheets) vía Apps Script, sin columnas nuevas — se reutiliza la columna `Estado` agregando el valor `Liberado`. `caja.html` y `cocina.html` siguen siendo HTML/CSS/JS sin build step, consumiendo el mismo `SCRIPT_URL` que ya usan. El grid de mesas y el panel de detalle combinado se calculan en el navegador a partir del mismo array plano que ya devuelve `listar_pedidos_caja` (agrupando por `mesa` en vez de por pestaña). Los cupos de domicilio se asignan y persisten en `localStorage` del dispositivo de caja (decidido: un solo dispositivo, sin necesidad de sincronizar en el Sheet).

**Tech Stack:** Google Apps Script (server) + vanilla HTML/CSS/JS (client), sin build ni bundler. Sin test runner local — el método de verificación de este proyecto (usado en todos los módulos anteriores) es: (1) pegar el código actualizado en el editor de Apps Script real y publicar una nueva versión del deployment, (2) verificar con `curl` contra el `SCRIPT_URL` real, (3) cuando haya navegador disponible en la sesión de ejecución, recorrer las páginas HTML con Playwright para una prueba de clics real, (4) borrar cualquier fila de prueba creada durante la verificación. Cada tarea de abajo sigue esa forma en vez de un test estilo pytest/jest — el paso de curl/Playwright es el "test" de la tarea.

## Global Constraints

- No se agregan columnas nuevas a `Ventas` — el estado `Liberado` reutiliza la columna `Estado` que ya existe.
- Toda acción nueva de Apps Script debe devolver `{ok:true}` o `{ok:false, error:"..."}`, mismo patrón que las acciones existentes (`marcar_pedido_pagado`, `crear_pedido`, etc.) — nunca lanzar una excepción sin capturar.
- `liberar_mesa`/`liberar_pedido` deben rechazar la liberación (con `ok:false` y un mensaje claro) si todavía queda algo en `Pendiente de pago` — no se puede liberar una mesa/domicilio que debe.
- "Dividir cuenta" (Módulo 4) sigue operando sobre un único `id_pedido`, sin cambios de backend — en el panel de mesa combinado, el botón "Dividir cuenta" solo aparece cuando la mesa tiene exactamente una ronda pendiente (mismo caso que ya soporta hoy). Combinar la división entre varias rondas queda fuera de este plan.
- Antes de decirle al usuario que un pegado está listo para publicar: recordarle Ctrl+F sobre el nombre de cada función nueva/modificada en TODO el editor, para confirmar que no quedó duplicada (ha roto código en silencio dos veces ya en este proyecto).
- Después de publicar cualquier cambio en vivo: verificar con curl no solo la acción nueva, sino también una acción vieja no relacionada (p. ej. `listar_productos` o `estado_mesa`), para detectar de inmediato si algo más se rompió.

---

### Task 1: Backend — `liberar_mesa`, `liberar_pedido` y corrección de `buscarMeseroMesaAbierta`

**Files:**
- Modify: `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-1-apps-script-nuevo.gs.txt` (función `buscarMeseroMesaAbierta`, línea 91-110)
- Modify: `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-9-apps-script-caja.gs.txt` (agrega 2 funciones nuevas al final)

**Interfaces:**
- Produces (consumido por Task 2's `caja.html`):
  - `GET ?accion=liberar_mesa&mesa=<num>` → `{ok:true}` o `{ok:false, error:string}`. Pone `Estado='Liberado'` en todas las filas de HOY de esa mesa (`Tipo_Pedido='local'`) cuyo `Estado` sea `'Pagado'`. Si alguna fila de esa mesa sigue en `'Pendiente de pago'`, no cambia nada y devuelve `{ok:false, error:'Todavía hay saldo pendiente en esa mesa'}`.
  - `GET ?accion=liberar_pedido&id_pedido=<uuid>` → misma forma de respuesta. Pone `Estado='Liberado'` en todas las filas de ese `id_pedido` (usado para domicilio). Si sigue `Pendiente de pago`, devuelve `{ok:false, error:'Ese pedido todavía está pendiente de pago'}`. Si no encuentra el `id_pedido`, `{ok:false, error:'No se encontró ese pedido'}`.
- Modifies existing behavior: `buscarMeseroMesaAbierta` (usada por `crearPedido`/`estadoMesa`, ya consumida por `menu.html`) ahora considera una mesa "abierta" (mesero protegido) mientras no esté `'Liberado'`, en vez de mientras no esté `'Pagado'`.

- [ ] **Step 1: Corregir `buscarMeseroMesaAbierta` en `modulo-1-apps-script-nuevo.gs.txt`**

  Reemplazar (línea 104):
  ```javascript
    if (fila[idxEstado] === 'Pagado') continue; // esa mesa ya se cerró, no cuenta
  ```
  con:
  ```javascript
    if (fila[idxEstado] === 'Liberado') continue; // esa mesa ya se liberó, no cuenta
  ```

  También actualizar el comentario de la función (líneas 112-116) para que ya no diga "hasta que se cobra". Reemplazar:
  ```javascript
  /**
   * accion=estado_mesa&mesa=<num>
   * Le dice al menú si esa mesa ya tiene un pedido abierto hoy y quién la atiende,
   * para no pedirle de nuevo el nombre a otro mesero ni dejar que se lo cambien
   * por error a una mesa que ya tiene dueño.
  ```
  con:
  ```javascript
  /**
   * accion=estado_mesa&mesa=<num>
   * Le dice al menú si esa mesa ya tiene un pedido abierto hoy y quién la atiende,
   * para no pedirle de nuevo el nombre a otro mesero ni dejar que se lo cambien
   * por error a una mesa que ya tiene dueño. "Abierta" significa que no se ha
   * liberado (accion=liberar_mesa) -- sigue siendo del mismo mesero aunque ya se
   * haya cobrado una o más rondas, hasta que alguien libere la mesa a propósito.
   * Corregido 2026-07-30: antes se consideraba "cerrada" apenas se pagaba, lo que
   * permitía que un pedido nuevo en esa mesa quedara acreditado a otro mesero.
  ```

- [ ] **Step 2: Agregar `liberarMesa` y `liberarPedido` al final de `modulo-9-apps-script-caja.gs.txt`**

  Agregar después de la función `marcarPedidoPagado` existente:
  ```javascript

  /**
   * accion=liberar_mesa&mesa=<num>
   * Pone en 'Liberado' todas las filas de HOY de esa mesa cuyo Estado sea 'Pagado'.
   * Si queda alguna en 'Pendiente de pago', no libera nada -- no se puede liberar
   * una mesa que todavía debe. Requiere que la mesa tenga al menos una fila hoy.
   */
  function liberarMesa(e) {
    const mesa = e.parameter.mesa || '';
    if (!mesa) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Falta mesa' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const hoja = SpreadsheetApp.getActive().getSheetByName('Ventas');
    const datos = hoja.getDataRange().getValues();
    const encabezados = datos[0];
    const idxFecha = encabezados.indexOf('Fecha');
    const idxEstado = encabezados.indexOf('Estado');
    const idxTipo = encabezados.indexOf('Tipo_Pedido');
    const idxMesa = encabezados.indexOf('Mesa');
    const tz = Session.getScriptTimeZone();
    const hoy = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

    const filasAfectar = [];
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];
      if (fila[idxTipo] !== 'local') continue;
      if (String(fila[idxMesa]) !== String(mesa)) continue;
      const fecha = Utilities.formatDate(new Date(fila[idxFecha]), tz, 'yyyy-MM-dd');
      if (fecha !== hoy) continue;
      if (fila[idxEstado] === 'Pendiente de pago') {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Todavía hay saldo pendiente en esa mesa' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      if (fila[idxEstado] === 'Pagado') filasAfectar.push(i + 1);
    }

    filasAfectar.forEach(function (fila) {
      hoja.getRange(fila, idxEstado + 1).setValue('Liberado');
    });

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  /**
   * accion=liberar_pedido&id_pedido=<uuid>
   * Pone en 'Liberado' las filas de un pedido puntual (usado para domicilio, que
   * no tiene número de mesa). Misma validación que liberar_mesa: no libera si
   * sigue pendiente de pago.
   */
  function liberarPedido(e) {
    const idPedido = e.parameter.id_pedido || '';
    if (!idPedido) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Falta id_pedido' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const hoja = SpreadsheetApp.getActive().getSheetByName('Ventas');
    const datos = hoja.getDataRange().getValues();
    const encabezados = datos[0];
    const idxIdPedido = encabezados.indexOf('ID_Pedido');
    const idxEstado = encabezados.indexOf('Estado');

    const filasAfectar = [];
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][idxIdPedido] !== idPedido) continue;
      if (datos[i][idxEstado] === 'Pendiente de pago') {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Ese pedido todavía está pendiente de pago' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      filasAfectar.push(i + 1);
    }

    if (filasAfectar.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se encontró ese pedido' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    filasAfectar.forEach(function (fila) {
      hoja.getRange(fila, idxEstado + 1).setValue('Liberado');
    });

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  ```

- [ ] **Step 3: Actualizar el comentario de instrucciones al inicio de `modulo-9-apps-script-caja.gs.txt`**

  Reemplazar las líneas 8-10:
  ```javascript
  // 2. Agrega estas 2 ramas nuevas a tu doGet(e):
  //        else if (accion === 'listar_pedidos_caja') { return listarPedidosCaja(); }
  //        else if (accion === 'marcar_pedido_pagado') { return marcarPedidoPagado(e); }
  ```
  con:
  ```javascript
  // 2. Agrega estas 4 ramas nuevas a tu doGet(e):
  //        else if (accion === 'listar_pedidos_caja') { return listarPedidosCaja(); }
  //        else if (accion === 'marcar_pedido_pagado') { return marcarPedidoPagado(e); }
  //        else if (accion === 'liberar_mesa') { return liberarMesa(e); }
  //        else if (accion === 'liberar_pedido') { return liberarPedido(e); }
  ```

  Y el punto 5 (Ctrl+F) para que mencione las 4 funciones en vez de 2:
  ```javascript
  // 5. IMPORTANTE: antes de publicar, busca con Ctrl+F "function listarPedidosCaja",
  //    "function marcarPedidoPagado", "function liberarMesa" y "function liberarPedido"
  //    en TODO el editor y confirma que cada una aparece una sola vez.
  ```

- [ ] **Step 4: Tell the user the manual steps required before this can be verified**

  Mensaje para el usuario (no seguir al Step 5 hasta que confirme hecho):
  1. Pegar en el editor de Apps Script en vivo (mismo proyecto que ya tiene Módulos 1/2/3/8/9): la corrección de `buscarMeseroMesaAbierta` (Step 1) y las 2 funciones nuevas `liberarMesa`/`liberarPedido` (Step 2).
  2. Agregar las 2 ramas nuevas al `doGet(e)` existente (`liberar_mesa`, `liberar_pedido` — ver Step 3).
  3. Ctrl+F: confirmar que `buscarMeseroMesaAbierta`, `liberarMesa` y `liberarPedido` aparecen una sola vez cada una en todo el editor.
  4. Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar.
  5. Confirmar de vuelta que el `SCRIPT_URL` sigue siendo el mismo (no debería cambiar).

- [ ] **Step 5: Verificar en vivo con curl (requiere una mesa de prueba ya Pagada)**

  ```bash
  SCRIPT_URL='https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec'

  # 1. Confirmar que una acción vieja no relacionada sigue funcionando (detecta si algo más se rompió)
  curl -s "$SCRIPT_URL?accion=listar_pedidos_caja" | head -c 500

  # 2. Intentar liberar una mesa que NO existe hoy -- no debe romper nada
  curl -s "$SCRIPT_URL?accion=liberar_mesa&mesa=999"
  # Expected: {"ok":true}  (no hay filas que afectar, pero tampoco error -- 0 filas encontradas no es lo mismo que "pendiente de pago")

  # 3. Liberar un id_pedido inexistente
  curl -s "$SCRIPT_URL?accion=liberar_pedido&id_pedido=no-existe-123"
  # Expected: {"ok":false,"error":"No se encontró ese pedido"}
  ```

  Para probar el caso real completo (mesa con una fila `Pagado` que sí se libera, y el rechazo cuando sigue `Pendiente de pago`), coordinar con el usuario un pedido de prueba real en `menu.html` (tipo local, mesa de prueba), cobrarlo desde `caja.html` actual, y solo entonces:
  ```bash
  curl -s "$SCRIPT_URL?accion=liberar_mesa&mesa=<MESA_DE_PRUEBA>"
  # Expected: {"ok":true}, y esa fila en Ventas debe pasar a Estado=Liberado (confirmar leyendo el Sheet o con listar_pedidos_caja)
  ```
  Borrar la fila de prueba del Sheet al terminar.

- [ ] **Step 6: Commit**

  ```bash
  git add "Gestion_Proyecto/01-modulos/modulo-1-apps-script-nuevo.gs.txt" "Gestion_Proyecto/01-modulos/modulo-9-apps-script-caja.gs.txt"
  git commit -m "feat: add liberar_mesa/liberar_pedido and fix buscarMeseroMesaAbierta to use Liberado"
  ```

---

### Task 2: `caja.html` — pantalla de grid (mesas + domicilios) con panel de detalle combinado

**Files:**
- Modify: `E:\Proyectos ZFood GyP\caja.html` (todo el archivo — CSS aditivo, header, nuevo overlay, y varias funciones JS nuevas/modificadas)

**Interfaces:**
- Consumes: Task 1's `accion=liberar_mesa`, `accion=liberar_pedido`. También el `Estado='Liberado'` que ahora puede venir en la respuesta de `listar_pedidos_caja` (ya soportada sin cambios por ese endpoint, que no filtra por `Estado`).
- Produces: ninguna interfaz nueva consumida por otras tareas (Task 3 es un archivo separado).

- [ ] **Step 1: Agregar la imagen del logo al proyecto (ya existe en el repo)**

  Confirmar que `E:\Proyectos ZFood GyP\logo gordo.png` existe (ya está en el repo, agregado el 2026-07-30 junto con el mockup). No requiere ninguna acción — solo se referenciará por ruta relativa `logo gordo.png` desde `caja.html`.

- [ ] **Step 2: Agregar el CSS nuevo, justo antes de `</style>` (línea 74 del archivo original)**

  Insertar antes de la línea `</style>`:
  ```css

  /* Pantalla de grid (mesas + domicilios) -- rediseño 2026-07-30 */
  .header-marca{display:flex;align-items:center;gap:10px;}
  .logo-caja{width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none;}
  .pantalla-grid{display:flex;flex-direction:column;gap:14px;max-width:640px;margin:0 auto;}
  .grid-mesas,.grid-domicilios{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;}
  .btn-mesa,.btn-domicilio{aspect-ratio:1;border-radius:14px;border:none;font-weight:800;font-size:0.68rem;letter-spacing:0.5px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#fff;background:#1c1c1c;}
  .btn-mesa-num{font-size:1.35rem;line-height:1;}
  .btn-mesa.estado-libre{background:#1c1c1c;color:#fff;border:1px solid rgba(255,255,255,0.15);}
  .btn-mesa.estado-ocupada-pendiente{background:linear-gradient(135deg,#a8291c,#e05050);color:#fff;}
  .btn-mesa.estado-ocupada-pagada{background:linear-gradient(135deg,#c8941a,#e8c832);color:#1a0a00;}
  .btn-domicilio.estado-dom-libre{background:linear-gradient(135deg,#155c3f,#2a9968);color:#fff;}
  .btn-domicilio.estado-dom-ocupada-pendiente{background:linear-gradient(135deg,#a8291c,#e05050);color:#fff;}
  .btn-domicilio.estado-dom-ocupada-pagada{background:linear-gradient(135deg,#c8941a,#e8c832);color:#1a0a00;}
  .btn-domicilio[disabled]{opacity:0.45;cursor:default;}
  .linea-divisoria{height:1px;background:rgba(200,132,26,0.3);margin:2px 0;}
  .franja-espera{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px;border:1px dashed rgba(200,132,26,0.4);border-radius:12px;}
  .franja-espera-titulo{font-size:0.78rem;color:#e8c87a;font-weight:700;width:100%;}
  .btn-espera{padding:8px 14px;border-radius:10px;background:rgba(224,80,80,0.25);color:#e8a0a0;border:1px solid rgba(224,80,80,0.4);font-weight:700;cursor:pointer;font-size:0.8rem;}
  .modal-detalle{background:#2a1500;border:1px solid rgba(200,132,26,0.4);border-radius:16px;padding:20px;width:92%;max-width:420px;max-height:85vh;overflow-y:auto;display:flex;flex-direction:column;gap:14px;}
  .modal-detalle h3{color:#e8a832;font-size:1.1rem;}
  .ronda-bloque{display:flex;flex-direction:column;gap:2px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);}
  .ronda-header{display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;color:rgba(240,224,176,0.65);margin-bottom:4px;}
  .btn-liberar{padding:10px 16px;border-radius:10px;background:transparent;border:1px solid rgba(224,80,80,0.5);color:#e8a0a0;font-size:0.85rem;font-weight:700;cursor:pointer;}
  .historial-filtros{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:6px;}
  ```

- [ ] **Step 3: Reemplazar el `<header>` (líneas 78-93 del archivo original)**

  Reemplazar:
  ```html
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
  ```
  con:
  ```html
  <header>
    <div class="header-marca">
      <img class="logo-caja" src="logo gordo.png" alt="Donde el Gordo">
      <div>
        <div class="header-titulo">DONDE EL GORDO</div>
        <div class="header-sub">CAJA</div>
      </div>
    </div>
    <div class="header-tabs">
      <button class="btn-tab" id="btn-vista-historial" onclick="cambiarVistaPrincipal(vistaPrincipal === 'grid' ? 'historial' : 'grid')">🕒 Historial de hoy</button>
      <a class="btn-tab" href="index.html" style="text-decoration:none;display:inline-flex;align-items:center;">← MENU</a>
    </div>
  </header>
  ```

  Nota: las pestañas "En el local/Domicilio" y "Pendientes/Pagados" no desaparecen -- se mueven al contenido de la vista Historial (Step 6), en vez de vivir fijas en el header.

- [ ] **Step 4: Agregar el overlay de detalle combinado, después del overlay `overlay-cobrar` (después de la línea 105 del archivo original) y antes de `overlay-division`**

  Insertar:
  ```html

  <div class="overlay oculto" id="overlay-detalle">
    <div class="modal-detalle" id="detalle-contenido"></div>
  </div>
  ```

- [ ] **Step 5: Agregar el estado nuevo, justo después de las variables de estado existentes (después de `const pedidosPagoPendiente = new Set();`, línea 197 del archivo original)**

  Insertar:
  ```javascript

  // Pantalla de grid (mesas + domicilios) -- rediseño 2026-07-30.
  let vistaPrincipal = 'grid'; // 'grid' | 'historial'
  let mesaAbierta = null;      // número de mesa mostrado en el panel de detalle, o null
  let domicilioAbierto = null; // id_pedido de domicilio mostrado en el panel de detalle, o null
  let cobroModo = 'individual'; // 'individual' (domicilio) | 'mesa' (varias rondas combinadas)
  let mesaParaCobrar = null;
  let domicilioCupos = {}; // id_pedido -> número de cupo (1-5), persistido en localStorage

  function cargarCuposDomicilio() {
    try { domicilioCupos = JSON.parse(localStorage.getItem('degCajaCuposDomicilio') || '{}'); }
    catch (e) { domicilioCupos = {}; }
  }

  function guardarCuposDomicilio() {
    try { localStorage.setItem('degCajaCuposDomicilio', JSON.stringify(domicilioCupos)); } catch (e) {}
  }

  // Cupos "pegajosos": un pedido que ya tenía cupo lo conserva aunque otro se
  // libere antes (no se renumeran). Los nuevos reciben el primer cupo libre;
  // si no hay ninguno, quedan en la franja de espera hasta que se libere uno.
  function actualizarCuposDomicilio() {
    const activos = pedidos.filter(p => p.tipo === 'domicilio' && p.estado !== 'Liberado');
    const idsActivos = new Set(activos.map(p => p.id_pedido));

    Object.keys(domicilioCupos).forEach(id => {
      if (!idsActivos.has(id)) delete domicilioCupos[id];
    });

    const ocupados = new Set(Object.values(domicilioCupos));
    activos.slice().sort((a, b) => a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0).forEach(p => {
      if (domicilioCupos[p.id_pedido]) return;
      for (let slot = 1; slot <= 5; slot++) {
        if (!ocupados.has(slot)) { domicilioCupos[p.id_pedido] = slot; ocupados.add(slot); break; }
      }
    });

    guardarCuposDomicilio();
  }

  function estadoMesaColor(numMesa) {
    const activos = pedidos.filter(p => p.tipo === 'local' && String(p.mesa) === String(numMesa) && p.estado !== 'Liberado');
    if (activos.length === 0) return 'libre';
    if (activos.some(p => p.estado === 'Pendiente de pago')) return 'ocupada-pendiente';
    return 'ocupada-pagada';
  }
  ```

- [ ] **Step 6: Reemplazar `render()` por un dispatcher + `renderGrid()` + `renderHistorial()`**

  Reemplazar la función `render()` completa (líneas 561-605 del archivo original: desde `function render() {` hasta su `}` de cierre) con:
  ```javascript
  function renderPrincipal() {
    if (vistaPrincipal === 'grid') renderGrid(); else renderHistorial();
  }

  function cambiarVistaPrincipal(v) {
    vistaPrincipal = v;
    document.getElementById('btn-vista-historial').textContent = v === 'grid' ? '🕒 Historial de hoy' : '🏠 Mesas';
    renderPrincipal();
  }

  function renderGrid() {
    const cont = document.getElementById('lista-pedidos');
    const banner = usandoDatosMuestra
      ? '<div class="banner-mock">⚠️ SIN CONEXIÓN — mostrando datos de muestra, no se puede cobrar de verdad</div>'
      : '';

    const mesasHtml = [];
    for (let n = 1; n <= 20; n++) {
      const estado = estadoMesaColor(n);
      mesasHtml.push(`<button class="btn-mesa estado-${estado}" onclick="abrirDetalleMesa(${n})">MESA<span class="btn-mesa-num">${n}</span></button>`);
    }

    const activosDom = pedidos.filter(p => p.tipo === 'domicilio' && p.estado !== 'Liberado');
    const cuposHtml = [];
    for (let slot = 1; slot <= 5; slot++) {
      const idConEseCupo = Object.keys(domicilioCupos).find(id => domicilioCupos[id] === slot);
      const pedido = idConEseCupo ? activosDom.find(p => p.id_pedido === idConEseCupo) : null;
      const estado = !pedido ? 'libre' : (pedido.estado === 'Pendiente de pago' ? 'ocupada-pendiente' : 'ocupada-pagada');
      const onclick = pedido ? `onclick="abrirDetalleDomicilio('${pedido.id_pedido}')"` : '';
      cuposHtml.push(`<button class="btn-domicilio estado-dom-${estado}" ${onclick} ${pedido ? '' : 'disabled'}>DOMIC.<span class="btn-mesa-num">${slot}</span></button>`);
    }

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

  function renderHistorial() {
    const cont = document.getElementById('lista-pedidos');
    const banner = usandoDatosMuestra
      ? '<div class="banner-mock">⚠️ SIN CONEXIÓN — mostrando datos de muestra, no se puede cobrar de verdad</div>'
      : '';

    const filtrosHtml = `
      <div class="historial-filtros">
        <div class="grupo-tabs">
          <button class="btn-tab ${vistaTipo === 'local' ? 'activa' : ''}" onclick="cambiarVistaTipo('local')">En el local</button>
          <button class="btn-tab ${vistaTipo === 'domicilio' ? 'activa' : ''}" onclick="cambiarVistaTipo('domicilio')">Domicilio</button>
        </div>
        <div class="grupo-tabs">
          <button class="btn-tab ${vistaEstado === 'pendientes' ? 'activa' : ''}" onclick="cambiarVistaEstado('pendientes')">Pendientes</button>
          <button class="btn-tab ${vistaEstado === 'pagados' ? 'activa' : ''}" onclick="cambiarVistaEstado('pagados')">Pagados</button>
        </div>
      </div>`;

    const lista = pedidos.filter(p =>
      p.tipo === vistaTipo &&
      (vistaEstado === 'pendientes' ? p.estado === 'Pendiente de pago' : (p.estado === 'Pagado' || p.estado === 'Liberado'))
    );

    if (lista.length === 0) {
      cont.innerHTML = banner + filtrosHtml + `<div class="vacio-msg">No hay pedidos ${vistaEstado === 'pendientes' ? 'pendientes de pago' : 'pagados'} en ${vistaTipo === 'local' ? 'el local' : 'domicilio'} hoy.</div>`;
      return;
    }

    cont.innerHTML = banner + filtrosHtml + lista.map(p => `
      <div class="pedido-card">
        <div class="pedido-header">
          <div>
            <div class="pedido-titulo">${p.tipo === 'local' ? '🍽️ Mesa ' + (p.mesa || '—') : '🛵 Domicilio'}</div>
            <div class="pedido-sub">${p.mesero ? '👤 ' + p.mesero : ''}</div>
            <div class="badge-estado ${p.estado === 'Pendiente de pago' ? 'pendiente' : 'pagado'}">${p.estado === 'Pendiente de pago' ? '⏳ Pendiente de pago' : (p.estado === 'Liberado' ? '✅ Pagado (liberado)' : '✅ Pagado (' + p.metodo_pago + ')')}</div>
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
        <div class="pedido-footer">
          <button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="imprimirReciboPorId('${p.id_pedido}')">🖨️ ${p.estado === 'Pendiente de pago' ? 'Imprimir' : 'Reimprimir'} recibo</button>
        </div>
      </div>
    `).join('');
  }
  ```

  Nota: esta versión de la lista de Historial es solo de consulta/reimpresión (no tiene botón Cobrar ni Dividir cuenta) -- esas acciones ahora viven en el panel de detalle de mesa/domicilio del grid (Steps 7-8). Esto es un cambio deliberado respecto al `render()` original.

- [ ] **Step 7: Agregar las funciones del panel de detalle de mesa (después de `renderHistorial`, antes de `function abrirModalCobrar`)**

  Insertar:
  ```javascript

  function cerrarDetalle() {
    mesaAbierta = null;
    domicilioAbierto = null;
    document.getElementById('overlay-detalle').classList.add('oculto');
  }

  function abrirDetalleMesa(numMesa) {
    const rondas = pedidos.filter(p => p.tipo === 'local' && String(p.mesa) === String(numMesa) && p.estado !== 'Liberado');
    if (rondas.length === 0) return; // mesa libre, no hace nada

    domicilioAbierto = null;
    mesaAbierta = numMesa;
    renderDetalleMesa();
    document.getElementById('overlay-detalle').classList.remove('oculto');
  }

  function renderDetalleMesa() {
    const rondas = pedidos.filter(p => p.tipo === 'local' && String(p.mesa) === String(mesaAbierta) && p.estado !== 'Liberado')
      .sort((a, b) => a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0);
    if (rondas.length === 0) { cerrarDetalle(); return; }

    const pendientes = rondas.filter(p => p.estado === 'Pendiente de pago');
    const totalPendiente = pendientes.reduce((s, p) => s + p.total, 0);
    const meseroRonda = rondas.find(p => p.mesero);
    const mesero = meseroRonda ? meseroRonda.mesero : '';

    const rondasHtml = rondas.map(r => `
      <div class="ronda-bloque">
        <div class="ronda-header">
          <span>${r.hora}</span>
          <span class="badge-estado ${r.estado === 'Pendiente de pago' ? 'pendiente' : 'pagado'}">${r.estado === 'Pendiente de pago' ? '⏳ Pendiente' : '✅ Pagado'}</span>
        </div>
        ${r.items.map(it => `<div class="item-row"><span>${it.cantidad}x ${it.producto}</span><span>${formatoCOP(it.total)}</span></div>`).join('')}
      </div>
    `).join('');

    document.getElementById('detalle-contenido').innerHTML = `
      <h3>🍽️ Mesa ${mesaAbierta}${mesero ? ' — 👤 ' + mesero : ''}</h3>
      ${rondasHtml}
      <div class="pedido-total-row"><span>TOTAL PENDIENTE</span><span>${formatoCOP(totalPendiente)}</span></div>
      <div class="pedido-footer" style="flex-wrap:wrap;gap:8px;">
        ${pendientes.length > 0 ? `<button class="btn-cobrar" onclick="abrirModalCobrarMesa(${mesaAbierta})">Cobrar ${formatoCOP(totalPendiente)}</button>` : ''}
        ${rondas.length === 1 && pendientes.length === 1 ? `<button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="abrirDivision('${rondas[0].id_pedido}')">➗ Dividir cuenta</button>` : ''}
        ${pendientes.length === 0 ? `<button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="reimprimirReciboMesa(${mesaAbierta})">🖨️ Reimprimir recibo</button>` : ''}
        ${pendientes.length === 0 ? `<button class="btn-liberar" onclick="liberarMesa(${mesaAbierta})">🚪 Liberar mesa</button>` : ''}
      </div>
      <button class="btn-cancelar" onclick="cerrarDetalle()">Cerrar</button>
    `;
  }

  // A diferencia de imprimirReciboPorId (que reimprime un solo id_pedido), esto
  // combina TODAS las rondas ya pagadas de la mesa en un solo recibo -- si hubo
  // más de una ronda y se cobraron por separado, un solo id_pedido dejaría por
  // fuera las demás. Si los métodos de pago de cada ronda fueron distintos, se
  // muestra "Varios" en vez de elegir uno arbitrariamente.
  function reimprimirReciboMesa(numMesa) {
    const rondas = pedidos.filter(p => p.tipo === 'local' && String(p.mesa) === String(numMesa) && p.estado === 'Pagado');
    if (rondas.length === 0) return;
    const items = [];
    rondas.forEach(r => r.items.forEach(it => items.push(it)));
    const total = rondas.reduce((s, r) => s + r.total, 0);
    const metodos = [...new Set(rondas.map(r => r.metodo_pago))];
    const metodoTexto = metodos.length === 1 ? metodos[0] : 'Varios';
    imprimirRecibo({ tipo: 'local', mesa: numMesa, items: items, total: total, metodo_pago: metodoTexto });
  }

  async function liberarMesa(numMesa) {
    if (!confirm('¿Liberar la mesa ' + numMesa + '? Ya no se verá como ocupada.')) return;
    const activos = pedidos.filter(p => p.tipo === 'local' && String(p.mesa) === String(numMesa) && p.estado !== 'Liberado');
    if (activos.length === 0) return;

    const estadosAnteriores = activos.map(p => p.estado);
    activos.forEach(p => { p.estado = 'Liberado'; });
    renderPrincipal();
    cerrarDetalle();

    try {
      const params = new URLSearchParams({ accion: 'liberar_mesa', mesa: String(numMesa) });
      const res = await fetch(SCRIPT_URL + '?' + params.toString());
      const data = await res.json();
      if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'Respuesta inválida del servidor');
    } catch (e) {
      activos.forEach((p, i) => { p.estado = estadosAnteriores[i]; });
      renderPrincipal();
      alert('No se pudo liberar la mesa: ' + e.message);
    }
  }
  ```

- [ ] **Step 8: Agregar las funciones del panel de detalle de domicilio (justo después de las del Step 7)**

  Insertar:
  ```javascript

  function abrirDetalleDomicilio(idPedido) {
    const pedido = pedidos.find(p => p.id_pedido === idPedido && p.tipo === 'domicilio');
    if (!pedido) return;

    mesaAbierta = null;
    domicilioAbierto = idPedido;
    renderDetalleDomicilio();
    document.getElementById('overlay-detalle').classList.remove('oculto');
  }

  function renderDetalleDomicilio() {
    const pedido = pedidos.find(p => p.id_pedido === domicilioAbierto);
    if (!pedido || pedido.estado === 'Liberado') { cerrarDetalle(); return; }
    const cupo = domicilioCupos[pedido.id_pedido];

    document.getElementById('detalle-contenido').innerHTML = `
      <h3>🛵 Domicilio${cupo ? ' — cupo ' + cupo : ' (en espera de cupo)'}</h3>
      <div class="pedido-hora">${pedido.hora}</div>
      ${pedido.items.map(it => `<div class="item-row"><span>${it.cantidad}x ${it.producto}</span><span>${formatoCOP(it.total)}</span></div>`).join('')}
      <div class="pedido-total-row"><span>TOTAL</span><span>${formatoCOP(pedido.total)}</span></div>
      <div class="pedido-footer" style="flex-wrap:wrap;gap:8px;">
        ${pedido.estado === 'Pendiente de pago' ? `<button class="btn-cobrar" onclick="abrirModalCobrar('${pedido.id_pedido}')">Cobrar</button>` : ''}
        ${pedido.estado === 'Pagado' ? `<button class="btn-cancelar" style="border:1px solid rgba(200,132,26,0.35);" onclick="imprimirReciboPorId('${pedido.id_pedido}')">🖨️ Reimprimir recibo</button>` : ''}
        ${pedido.estado === 'Pagado' ? `<button class="btn-liberar" onclick="liberarPedidoDomicilio('${pedido.id_pedido}')">🛵 Marcar entregado</button>` : ''}
      </div>
      <button class="btn-cancelar" onclick="cerrarDetalle()">Cerrar</button>
    `;
  }

  async function liberarPedidoDomicilio(idPedido) {
    if (!confirm('¿Marcar este domicilio como entregado? Se libera el cupo.')) return;
    const pedido = pedidos.find(p => p.id_pedido === idPedido);
    if (!pedido) return;

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
    }
  }
  ```

- [ ] **Step 9: Extender el cobro para soportar el modo "mesa" (varias rondas combinadas)**

  Reemplazar la función `abrirModalCobrar` existente (línea 506-509 del archivo original):
  ```javascript
  function abrirModalCobrar(idPedido) {
    pedidoIdParaCobrar = idPedido;
    document.getElementById('overlay-cobrar').classList.remove('oculto');
  }
  ```
  con:
  ```javascript
  function abrirModalCobrar(idPedido) {
    cobroModo = 'individual';
    pedidoIdParaCobrar = idPedido;
    document.getElementById('overlay-cobrar').classList.remove('oculto');
  }

  function abrirModalCobrarMesa(numMesa) {
    cobroModo = 'mesa';
    mesaParaCobrar = numMesa;
    document.getElementById('overlay-cobrar').classList.remove('oculto');
  }
  ```

  Reemplazar el inicio de `confirmarCobro` (línea 516-519 del archivo original):
  ```javascript
  async function confirmarCobro(metodo) {
    const idPedido = pedidoIdParaCobrar;
    cerrarModalCobrar();
    if (!idPedido) return;
  ```
  con:
  ```javascript
  async function confirmarCobro(metodo) {
    cerrarModalCobrar();
    if (cobroModo === 'mesa') { await confirmarCobroMesa(metodo); return; }

    const idPedido = pedidoIdParaCobrar;
    if (!idPedido) return;
  ```

  (El resto del cuerpo de `confirmarCobro` — desde `pedidosPagoPendiente.add(idPedido);` hasta el `finally` — se deja exactamente igual, solo cambia la parte de arriba.)

  Agregar `confirmarCobroMesa` justo después del cierre de `confirmarCobro` (después de la línea 545 del archivo original, `}`):
  ```javascript

  async function confirmarCobroMesa(metodo) {
    const numMesa = mesaParaCobrar;
    if (!numMesa) return;
    const pendientes = pedidos.filter(p => p.tipo === 'local' && String(p.mesa) === String(numMesa) && p.estado === 'Pendiente de pago');
    if (pendientes.length === 0) return;

    const idsAfectados = pendientes.map(p => p.id_pedido);
    idsAfectados.forEach(id => pedidosPagoPendiente.add(id));
    const estadosAnteriores = pendientes.map(p => ({ id: p.id_pedido, estado: p.estado, metodo: p.metodo_pago }));
    pendientes.forEach(p => { p.estado = 'Pagado'; p.metodo_pago = metodo; });
    renderPrincipal();
    if (mesaAbierta === numMesa) renderDetalleMesa();

    try {
      const resultados = await Promise.all(idsAfectados.map(id => {
        const params = new URLSearchParams({ accion: 'marcar_pedido_pagado', id_pedido: id, metodo_pago: metodo });
        return fetch(SCRIPT_URL + '?' + params.toString()).then(r => r.json());
      }));
      if (resultados.some(d => !d || d.ok !== true)) throw new Error('El servidor rechazó al menos uno de los cobros de esta mesa');

      const itemsCombinados = [];
      pendientes.forEach(p => p.items.forEach(it => itemsCombinados.push(it)));
      const totalCombinado = pendientes.reduce((s, p) => s + p.total, 0);
      imprimirRecibo({ tipo: 'local', mesa: numMesa, items: itemsCombinados, total: totalCombinado, metodo_pago: metodo });
    } catch (e) {
      estadosAnteriores.forEach(prev => {
        const p = pedidos.find(x => x.id_pedido === prev.id);
        if (p) { p.estado = prev.estado; p.metodo_pago = prev.metodo; }
      });
      renderPrincipal();
      if (mesaAbierta === numMesa) renderDetalleMesa();
      alert('No se pudo registrar el cobro de la mesa. Intenta de nuevo.');
    } finally {
      idsAfectados.forEach(id => pedidosPagoPendiente.delete(id));
    }
  }
  ```

- [ ] **Step 10: Refrescar el panel de detalle abierto en cada `cargarPedidos()` y llamar a `actualizarCuposDomicilio()`**

  Reemplazar el final de `cargarPedidos()` (líneas 492-494 del archivo original):
  ```javascript
    aplicarPendientes(pedidos);
    render();
  }
  ```
  con:
  ```javascript
    aplicarPendientes(pedidos);
    actualizarCuposDomicilio();
    renderPrincipal();
    if (mesaAbierta !== null) renderDetalleMesa();
    if (domicilioAbierto !== null) renderDetalleDomicilio();
  }
  ```

- [ ] **Step 11: Reemplazar todas las demás llamadas a `render()` por `renderPrincipal()`**

  El archivo original llama a `render()` en 4 lugares además de `cargarPedidos()` y la propia definición: dentro de `confirmarCobro` (dos veces, éxito y revert) y dentro de `cambiarVistaTipo`/`cambiarVistaEstado`. Reemplazar cada una de esas llamadas sueltas `render();` por `renderPrincipal();` (búsqueda simple, deben quedar 0 llamadas a `render()` en todo el archivo tras este paso, ya que la función se renombró a `renderPrincipal`/`renderGrid`/`renderHistorial` en el Step 6).

- [ ] **Step 12: Inicializar los cupos de domicilio antes del primer `cargarPedidos()`**

  Reemplazar la última línea del script (línea 608 del archivo original):
  ```javascript
  setInterval(() => cargarPedidos(), INTERVALO_POLLING_MS);
  cargarPedidos();
  ```
  con:
  ```javascript
  cargarCuposDomicilio();
  setInterval(() => cargarPedidos(), INTERVALO_POLLING_MS);
  cargarPedidos();
  ```

- [ ] **Step 13: Verificación manual (funciona incluso sin backend, con los datos de muestra)**

  Abrir `caja.html` en un navegador (o con Playwright si hay uno disponible en la sesión de ejecución). Sin backend real, cae a `pedidosMock()` (ya trae una mesa 4 pendiente, un domicilio pendiente y una mesa 2 pagada — ver `pedidosMock()` sin cambios en este plan). Confirmar:
  - El grid se ve por defecto (20 mesas + 5 domicilios), con el logo y "DONDE EL GORDO / CAJA" en el header.
  - La mesa 4 aparece roja, la mesa 2 amarilla, el resto negras.
  - El domicilio mock aparece rojo en el cupo 1 (único domicilio activo).
  - Tocar la mesa 4 abre el panel con el pedido, botón Cobrar visible.
  - Tocar una mesa negra (p. ej. mesa 1) no hace nada.
  - Tocar "🕒 Historial de hoy" cambia a la vista de lista con las pestañas de siempre; tocar de nuevo vuelve al grid (ahora dice "🏠 Mesas").
  - "← MENU" navega a `index.html`.

  Con el backend real ya publicado (Task 1 completado): repetir el flujo con datos reales -- abrir una mesa con saldo pendiente, cobrarla, confirmar que pasa a amarilla y aparece "Liberar mesa"; liberarla y confirmar que vuelve a negra. Mismo flujo para un domicilio (cobrar → amarillo → "Marcar entregado" → cupo libre / verde). Confirmar que un segundo domicilio de prueba, creado mientras el primero sigue activo, toma el cupo 2 sin mover al primero.

- [ ] **Step 14: Commit**

  ```bash
  git add caja.html
  git commit -m "feat: replace caja.html tab list with mesa/domicilio grid and combined table panel"
  ```

---

### Task 3: `cocina.html` — vista de botones con detalle y regreso

**Files:**
- Modify: `E:\Proyectos ZFood GyP\cocina.html` (CSS aditivo + reescritura de `render()` en 2 funciones + ajustes menores)

**Interfaces:**
- Consumes: nada nuevo (sigue usando `listar_pedidos_cocina`, ya corregido para incluir domicilio antes de este plan).
- Produces: ninguna (archivo hoja, no consumido por otras tareas de este plan).

- [ ] **Step 1: Agregar el CSS nuevo, antes de `</style>` (línea 51 del archivo actual)**

  Insertar antes de la línea `</style>`:
  ```css

  /* Vista de botones -- rediseño 2026-07-30 */
  .lista-botones{display:flex;flex-direction:column;gap:10px;max-width:480px;margin:0 auto;}
  .btn-pedido{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(200,132,26,0.25);color:#f0e0b0;font-size:0.95rem;font-weight:700;cursor:pointer;text-align:left;width:100%;}
  .btn-pedido.completo{opacity:0.55;}
  .btn-pedido.urgente{border-color:#e05050;background:rgba(224,80,80,0.15);animation:pulso-urgente 1.5s ease-in-out infinite;}
  @keyframes pulso-urgente{0%,100%{box-shadow:0 0 0 0 rgba(224,80,80,0.4);}50%{box-shadow:0 0 0 6px rgba(224,80,80,0);}}
  .btn-pedido-hora{color:rgba(240,224,176,0.6);font-size:0.8rem;flex:none;}
  .btn-pedido-etiqueta{flex:1;color:#c8841a;}
  .btn-pedido-min{font-weight:800;flex:none;}
  .btn-pedido-min.ok{color:#e8a832;}
  .btn-pedido-min.urgente{color:#e05050;}
  .btn-regresar{align-self:flex-start;padding:10px 16px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,132,26,0.35);color:#f0e0b0;font-size:0.9rem;font-weight:700;cursor:pointer;margin-bottom:12px;}
  ```

- [ ] **Step 2: Cambiar `main` a un solo bloque centrado en vez de grid de varias columnas**

  Reemplazar (línea 19 del archivo actual):
  ```css
  main{padding:18px;max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;}
  ```
  con:
  ```css
  main{padding:18px;max-width:480px;margin:0 auto;}
  ```

  (Ya no se necesitan varias columnas: la lista de botones y el detalle son de una sola columna. `.vacio-msg` pierde su `grid-column:1/-1`, que ya no aplica -- déjalo tal cual, es inofensivo sin grid.)

- [ ] **Step 3: Agregar el estado de navegación, después de `let audioCtx = null;` (línea 105 del archivo actual)**

  Insertar:
  ```javascript

  let pedidoAbierto = null; // id_pedido mostrado en el detalle, o null = mostrando la lista de botones
  ```

- [ ] **Step 4: Reemplazar `render()` por el dispatcher lista/detalle**

  Reemplazar la función `render()` completa (líneas 190-234 del archivo actual: desde `function render() {` hasta su `}` de cierre) con:
  ```javascript
  function render() {
    const activos = pedidos.filter(p => !p.completo);
    document.getElementById('contador-activos').textContent = activos.length + (activos.length === 1 ? ' activo' : ' activos');

    if (pedidoAbierto) { renderDetalle(); return; }

    const lista = vista === 'activos' ? activos : pedidos.filter(p => p.completo);
    const cont = document.getElementById('lista-pedidos');

    if (lista.length === 0) {
      cont.innerHTML = `<div class="vacio-msg">${vista === 'activos' ? 'No hay pedidos activos ahora mismo.' : 'Todavía no hay pedidos completos hoy.'}</div>`;
      return;
    }

    cont.innerHTML = '<div class="lista-botones">' + lista.map(p => {
      const min = minutosTranscurridos(p.hora);
      const urgente = !p.completo && min >= MINUTOS_URGENTE;
      const etiqueta = p.tipo === 'domicilio' ? '🛵 Domicilio' : '🍽️ Mesa ' + (p.mesa || '—');
      return `
        <button class="btn-pedido${urgente ? ' urgente' : ''}${p.completo ? ' completo' : ''}" onclick="abrirDetallePedido('${p.id_pedido}')">
          <span class="btn-pedido-hora">${p.hora}</span>
          <span class="btn-pedido-etiqueta">${etiqueta}</span>
          <span class="btn-pedido-min ${urgente ? 'urgente' : 'ok'}">${min} min</span>
        </button>
      `;
    }).join('') + '</div>';
  }

  function abrirDetallePedido(idPedido) {
    pedidoAbierto = idPedido;
    render();
  }

  function cerrarDetallePedido() {
    pedidoAbierto = null;
    render();
  }

  function renderDetalle() {
    const p = pedidos.find(x => x.id_pedido === pedidoAbierto);
    const cont = document.getElementById('lista-pedidos');
    if (!p) { pedidoAbierto = null; render(); return; }

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
          <div class="pedido-tiempo">
            <div class="pedido-hora">${p.hora}</div>
            <div class="pedido-transcurrido ${urgente ? 'urgente' : 'ok'}">${min} min</div>
          </div>
        </div>
        ${p.items.map(it => `
          <div class="item-row">
            <div class="item-info">
              <div class="item-nombre">${it.cantidad}x ${it.producto}</div>
              ${it.observacion ? `<div class="item-obs">${it.observacion}</div>` : ''}
            </div>
            <button class="item-estado-btn ${claseEstado(it.estado)}" onclick="avanzarEstado(${it.fila}, '${it.estado}')">${it.estado}</button>
          </div>
        `).join('')}
        <div class="pedido-footer">
          ${p.completo
            ? '<span class="pedido-completo-msg">✅ Pedido completo</span>'
            : `<button class="btn-completo" onclick="marcarCompleto('${p.id_pedido}')">Marcar pedido completo</button>`}
        </div>
      </div>
    `;
  }
  ```

- [ ] **Step 5: Volver a la lista automáticamente al completar un pedido**

  Reemplazar `marcarCompleto` (líneas 256-274 del archivo actual):
  ```javascript
  async function marcarCompleto(idPedido) {
    pedidosCompletoPendiente.add(idPedido);
    pedidos.forEach(p => {
      if (p.id_pedido === idPedido) {
        p.items.forEach(it => it.estado = 'Entregado');
        p.completo = true;
      }
    });
    render();

    try {
      const params = new URLSearchParams({ accion: 'marcar_pedido_completo', id_pedido: idPedido });
      await fetch(SCRIPT_URL + '?' + params.toString());
    } catch (e) {
      // Backend no disponible todavía (modo mock).
    } finally {
      pedidosCompletoPendiente.delete(idPedido);
    }
  }
  ```
  con:
  ```javascript
  async function marcarCompleto(idPedido) {
    pedidosCompletoPendiente.add(idPedido);
    pedidos.forEach(p => {
      if (p.id_pedido === idPedido) {
        p.items.forEach(it => it.estado = 'Entregado');
        p.completo = true;
      }
    });
    cerrarDetallePedido(); // vuelve a la lista de pendientes: el botón de este pedido ya no aparece ahí

    try {
      const params = new URLSearchParams({ accion: 'marcar_pedido_completo', id_pedido: idPedido });
      await fetch(SCRIPT_URL + '?' + params.toString());
    } catch (e) {
      // Backend no disponible todavía (modo mock).
    } finally {
      pedidosCompletoPendiente.delete(idPedido);
    }
  }
  ```

- [ ] **Step 6: Cerrar el detalle al cambiar entre Activos/Historial**

  Reemplazar `cambiarVista` (líneas 183-188 del archivo actual):
  ```javascript
  function cambiarVista(v) {
    vista = v;
    document.getElementById('btn-vista-activos').classList.toggle('activa', v === 'activos');
    document.getElementById('btn-vista-historial').classList.toggle('activa', v === 'historial');
    render();
  }
  ```
  con:
  ```javascript
  function cambiarVista(v) {
    vista = v;
    pedidoAbierto = null;
    document.getElementById('btn-vista-activos').classList.toggle('activa', v === 'activos');
    document.getElementById('btn-vista-historial').classList.toggle('activa', v === 'historial');
    render();
  }
  ```

- [ ] **Step 7: Verificación manual (funciona con los datos de muestra, sin backend)**

  Abrir `cocina.html` en un navegador (o con Playwright si hay uno disponible en la sesión). Sin backend real cae a `pedidosMock()` (ya trae 2 mesas activas, 1 domicilio activo, 1 mesa completa en Historial). Confirmar:
  - Por defecto se ve la lista de botones (no las tarjetas siempre abiertas), un botón por pedido activo con hora + etiqueta + minutos.
  - El botón del pedido de hace 22 minutos (mock-1, sobre el umbral de 15 min) se ve en rojo/parpadeante.
  - El botón del domicilio dice "🛵 Domicilio" (no "Mesa —").
  - Tocar un botón abre el detalle con "← Regresar" arriba; tocar Regresar vuelve a la lista.
  - Avanzar el estado de un ítem y tocar "Marcar pedido completo" hace que, al instante, se vuelva a la lista y ese botón ya no aparezca en "Activos" (sí en "Historial").
  - Cambiar a "Historial" y de vuelta a "Activos" no deja ningún detalle abierto por accidente.

  Con backend real ya publicado (fix de domicilio en cocina, aplicado antes de este plan): confirmar el flujo completo con un pedido real.

- [ ] **Step 8: Commit**

  ```bash
  git add cocina.html
  git commit -m "feat: replace cocina.html always-open cards with button list + detail/back navigation"
  ```

---

### Task 4: Verificación end-to-end y documentación

**Files:**
- Modify: `E:\Proyectos ZFood GyP\Gestion_Proyecto\03-seguimiento\ESTADO.md`

**Interfaces:** ninguna (solo documentación y verificación).

- [ ] **Step 1: Prueba en vivo de extremo a extremo, con Tasks 1-3 ya publicadas/pegadas**

  Con el usuario, en una sola sesión: abrir una mesa de prueba en `menu.html` (tipo local), confirmar que aparece roja en el grid de `caja.html` y como botón en `cocina.html`. Cobrarla desde el panel de detalle de la mesa — confirmar que pasa a amarilla en el grid, que el botón "Liberar mesa" aparece, y que en `cocina.html` el pedido sigue visible hasta marcarse completo por separado (el estado de pago y el de cocina son independientes, como ya documenta el Módulo 9). Agregar una segunda ronda a la misma mesa antes de liberar — confirmar que el panel combinado muestra ambas rondas y un solo total pendiente, y que el mesero registrado en la segunda ronda es el mismo de la primera (verifica la corrección de `buscarMeseroMesaAbierta` de Task 1). Liberar la mesa y confirmar que vuelve a negra.

  Repetir con un pedido de domicilio: confirmar que activa cocina (fix ya aplicado antes de este plan), que aparece en el cupo 1 del grid de caja, que cobrarlo lo pone amarillo, y que "Marcar entregado" lo libera y deja el cupo verde/libre.

  Borrar todas las filas de prueba (`Ventas`) creadas durante esta verificación.

- [ ] **Step 2: Actualizar `ESTADO.md`**

  Agregar una entrada describiendo: el fix de domicilio-no-activa-cocina (ya en producción antes de este plan), el rediseño de `caja.html` (grid de mesas/domicilios, cuenta combinada, estado Liberado, fix de atribución de mesero) y de `cocina.html` (vista de botones), y la limitación documentada de "Dividir cuenta" (solo con una ronda pendiente). Anotar como pendiente explícito el siguiente sub-proyecto acordado con el usuario: pantalla de Meseros para agregar pedidos a una mesa ya abierta (brainstorm propio, no incluido en este plan).

- [ ] **Step 3: Commit**

  ```bash
  git add "Gestion_Proyecto/03-seguimiento/ESTADO.md"
  git commit -m "docs: track caja/cocina redesign completion in ESTADO.md"
  ```
