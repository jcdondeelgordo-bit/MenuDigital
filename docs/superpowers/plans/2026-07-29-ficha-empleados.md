# Ficha de Empleados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared employee catalog (`Empleados`) and wire it into `menu.html` (mesero) and `inventario.html` (conteo/ingresos), replacing free-text name entry, per the approved design at `docs/superpowers/specs/2026-07-29-ficha-empleados-design.md`.

**Architecture:** `Empleados` (Nombre/Celular/Fecha_Ingreso/Activo) lives in the Inventario Google Sheet and is served by its own Apps Script project (`Code.gs`, local mirror at `E:\Descargas\MENU\DONDE EL GORDO\Code.gs`). The Menú Apps Script project (bound to the menú Sheet, serves `menu.html`/`comisiones.html`) reads it via a new cross-Sheet constant, the same pattern `Code.gs` already uses in reverse to read the menú's `Ventas`. A new standalone page `empleados.html` administers the catalog.

**Tech Stack:** Google Apps Script (server) + vanilla HTML/CSS/JS (client), no build step, no bundler. There is no local test runner for either half of this stack — this project's established verification method (used for every prior module) is: (1) paste the updated `.gs` code into the real Apps Script editor and publish a new deployment version, (2) verify with `curl` against the live `SCRIPT_URL`, (3) when a browser is available in the execution session, drive the HTML pages with Playwright for a real click-through test, (4) delete any test rows created during verification. Every task below follows that shape instead of a pytest/jest-style unit test — treat the curl step as the task's test.

## Global Constraints

- Never break the existing "Activo=No never deletes a row" rule — `guardar_empleado` only ever appends a new row or overwrites an existing row's 4 cells in place, never `deleteRow`.
- `Empleados` columns and order are fixed (already created by the user): `Nombre`, `Celular`, `Fecha_Ingreso`, `Activo`. Do not reorder or rename them.
- New columns added to existing sheets (`Inventario`, `Ingresos`) must be appended **after** the current last column, never inserted in the middle — historical rows must not shift.
- Every new write action must reuse the existing `ADMIN_PASSWORD` check pattern already used in this codebase (`clave !== ADMIN_PASSWORD` → `{ok:false, error:'Clave inválida'}`), never trust the client.
- If a cross-Sheet read of `Empleados` fails (permissions, wrong ID, Sheet unavailable), the caller must degrade to a free-text input / empty list — it must never block the surrounding form (pedido, conteo, ingreso) from being submitted.
- Follow this project's established Apps Script hygiene: before telling the user a paste is ready to publish, Ctrl+F the pasted code to confirm no function/const was duplicated (this has silently broken 2 prior modules in this project).

---

### Task 1: Backend — Empleados catalog + accountability columns in Code.gs (Inventario)

**Files:**
- Modify: `E:\Descargas\MENU\DONDE EL GORDO\Code.gs` (live-mirrored local copy; this is the actual file the user copies into the Apps Script online editor)
- Create: `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-10-apps-script-empleados-inventario.gs.txt` (readable local backup of just the new/changed functions, matching this project's convention of keeping a `.gs.txt` mirror per module)

**Interfaces:**
- Produces (consumed by Task 2's `empleados.html`, and read cross-Sheet by Task 3):
  - `GET ?action=listar_empleados` → `{ok:true, empleados:[{nombre:string}, ...]}` (only rows where `Activo` normalizes to `"SI"`; no `celular`/`fechaIngreso` exposed here — this endpoint is unauthenticated).
  - `GET ?action=listar_empleados_admin&clave=...` → `{ok:true, empleados:[{nombre, celular, fechaIngreso, activo:"Si"|"No"}, ...]}` (all rows) or `{ok:false, error:"Clave inválida"}`.
  - `GET ?action=verificar_admin&clave=...` → `{ok:true, valido:boolean}` (Code.gs did not have this action before this task — it existed only in the menú's Apps Script).
  - `POST payload={action:"guardar_empleado", clave, nombre, celular, fechaIngreso, activo, idEnvio}` → `{ok:true}` or `{ok:false, error}`. Upserts by exact `nombre` match; creates with `Activo="Si"` if `activo` is omitted.
  - `POST payload={action:"guardar_inventario_completo", ..., responsable}` → same success shape as today, `Inventario` sheet gains a `Responsable` column (last column).
  - `POST payload={action:"guardar_ingreso", ..., quienTrae, quienRecibe}` → same success shape as today, `Ingresos` sheet gains `Quien_Trae` and `Quien_Recibe` columns (last two columns).

- [ ] **Step 1: Add `ADMIN_PASSWORD` and `verificarAdmin`/`listarEmpleadosActivos_`/`normalizarActivo_` helpers**

  In `E:\Descargas\MENU\DONDE EL GORDO\Code.gs`, add near the top (right after the existing `normalizeName` function):

  ```javascript
  const ADMIN_PASSWORD = 'CAMBIAR_ESTA_CLAVE'; // TODO: usar la MISMA clave real que ya está
  // configurada en el Apps Script del menú digital (ADMIN_PASSWORD), para que sea una sola
  // clave desde el punto de vista del usuario, aunque técnicamente sea una constante
  // separada en este otro proyecto de Apps Script.

  function normalizarActivo_(valor) {
    return (valor || '').toString().trim().toUpperCase() === 'SI';
  }

  // Filas de "Empleados" (Nombre, Celular, Fecha_Ingreso, Activo) cuyo Activo normaliza a "SI".
  // Solo devuelve el nombre -- este endpoint no requiere clave y no debe exponer celular.
  function listarEmpleadosActivos_(sheetEmpleados) {
    const datos = sheetEmpleados ? sheetEmpleados.getDataRange().getValues() : [];
    const empleados = [];
    for (let i = 1; i < datos.length; i++) {
      const row = datos[i];
      if (!row[0]) continue;
      if (!normalizarActivo_(row[3])) continue;
      empleados.push({ nombre: row[0].toString().trim() });
    }
    return empleados;
  }

  function verificarAdmin(e) {
    const clave = e.parameter.clave || '';
    return { ok: true, valido: clave === ADMIN_PASSWORD };
  }
  ```

- [ ] **Step 2: Add the 3 new `doGet` branches**

  In `doGet(e)`, add these `else if` branches right before the final `else { // Si se accede sin parámetros... }`:

  ```javascript
  } else if (action === 'verificar_admin') {
    result = verificarAdmin(e);
  } else if (action === 'listar_empleados') {
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName('Empleados');
      result = { ok: true, empleados: listarEmpleadosActivos_(sheet) };
    } catch (err) {
      result = { ok: false, error: err.toString() };
    }
  } else if (action === 'listar_empleados_admin') {
    const clave = e.parameter.clave || '';
    if (clave !== ADMIN_PASSWORD) {
      result = { ok: false, error: 'Clave inválida' };
    } else {
      try {
        const ss = SpreadsheetApp.openById(SHEET_ID);
        const sheet = ss.getSheetByName('Empleados');
        const datos = sheet ? sheet.getDataRange().getValues() : [];
        const empleados = [];
        for (let i = 1; i < datos.length; i++) {
          const row = datos[i];
          if (!row[0]) continue;
          empleados.push({
            nombre: row[0].toString().trim(),
            celular: row[1] ? row[1].toString().trim() : '',
            fechaIngreso: row[2] ? toDateStr(row[2]) : '',
            activo: normalizarActivo_(row[3]) ? 'Si' : 'No'
          });
        }
        result = { ok: true, empleados: empleados };
      } catch (err) {
        result = { ok: false, error: err.toString() };
      }
    }
  ```

  (This goes into the existing `if (action === 'get_productos') {...} else if (action === 'reporte_insumos') {...} else if (action === 'get_data') {...} else if (action === 'verificar_envio') {...}` chain — insert the new branches after `verificar_envio` and before the final `else`.)

- [ ] **Step 3: Add `guardar_empleado` to `doPost`**

  In `doPost(e)`, add this `else if` branch right before the final `} else { return respond({ ok: false, error: 'Acción no reconocida' }); }`:

  ```javascript
  } else if (data.action === 'guardar_empleado') {
    if (data.clave !== ADMIN_PASSWORD) {
      return respond({ ok: false, error: 'Clave inválida' });
    }
    const nombreBuscado = (data.nombre || '').toString().trim();
    if (!nombreBuscado) {
      return respond({ ok: false, error: 'Falta el nombre' });
    }
    const sheet = getOrCreateSheet(ss, 'Empleados', ['Nombre', 'Celular', 'Fecha_Ingreso', 'Activo']);
    const datos = sheet.getDataRange().getValues();
    let filaEncontrada = -1;
    for (let i = 1; i < datos.length; i++) {
      if ((datos[i][0] || '').toString().trim() === nombreBuscado) {
        filaEncontrada = i + 1; // 1-indexed sheet row
        break;
      }
    }
    const activo = data.activo === 'No' ? 'No' : 'Si';
    if (filaEncontrada > 0) {
      sheet.getRange(filaEncontrada, 1, 1, 4).setValues([[nombreBuscado, data.celular || '', data.fechaIngreso || '', activo]]);
    } else {
      sheet.appendRow([nombreBuscado, data.celular || '', data.fechaIngreso || '', activo]);
    }
    registrarEnvio(ss, data.idEnvio, 'empleado', timestamp);
    return respond({ ok: true });
  ```

- [ ] **Step 4: Add `Responsable` to `guardar_inventario_completo` and `Quien_Trae`/`Quien_Recibe` to `guardar_ingreso`**

  Replace the existing `guardar_inventario_completo` branch body:

  ```javascript
  } else if (data.action === 'guardar_inventario_completo') {
    const sheet = getOrCreateSheet(ss, 'Inventario', ['Fecha', 'Turno', 'Área', 'Producto', 'Total', 'Registrado', 'Responsable']);
    data.items.forEach(function(it) {
      sheet.appendRow([data.fecha, data.turno, it.areas, it.nombre, it.total, timestamp, data.responsable || '']);
    });
    registrarEnvio(ss, data.idEnvio, 'inventario', timestamp);
    return respond({ ok: true });
  ```

  Replace the existing `guardar_ingreso` branch body:

  ```javascript
  } else if (data.action === 'guardar_ingreso') {
    const sheet = getOrCreateSheet(ss, 'Ingresos', ['Fecha', 'Producto', 'Cantidad', 'Unidad', 'Registrado', 'Quien_Trae', 'Quien_Recibe']);
    data.items.forEach(function(it) {
      sheet.appendRow([data.fecha, it.nombre, it.total, it.unit, timestamp, data.quienTrae || '', data.quienRecibe || '']);
    });
    registrarEnvio(ss, data.idEnvio, 'ingreso', timestamp);
    return respond({ ok: true });
  ```

  Because `getOrCreateSheet` only writes headers when the sheet doesn't exist yet, this does **not** retroactively add the new column header to the live `Inventario`/`Ingresos` sheets (they already have rows). This is expected — flagged for the user in Step 6.

- [ ] **Step 5: Copy the new/changed functions into the local `.gs.txt` mirror**

  Write `Gestion_Proyecto\01-modulos\modulo-10-apps-script-empleados-inventario.gs.txt` containing: a short header comment (mirroring the style of `modulo-1-apps-script-nuevo.gs.txt`) explaining what to paste where, followed by the exact code from Steps 1-4 (the 3 new helper functions, the `doGet` branches to insert, the `doPost` branch to insert, and the 2 modified branches). This is the human-facing paste instructions file — the actual authoritative copy is `E:\Descargas\MENU\DONDE EL GORDO\Code.gs` from Steps 1-4.

- [ ] **Step 6: Tell the user the manual steps required before this can be verified**

  Message to relay to the user (do not proceed to Step 7 until confirmed done):
  1. In the live Google Sheet ("INVENTARIO DONDE EL GORDO"), add column header `Responsable` in the first empty column to the right of `Inventario`'s current last column, and `Quien_Trae` / `Quien_Recibe` in the two empty columns to the right of `Ingresos`'s current last column.
  2. Open the Apps Script project bound to this Sheet, paste the full updated `Code.gs`, set `ADMIN_PASSWORD` to the real value (same one used in the menú's Apps Script, if they want "one password" from their point of view).
  3. Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar, so `SCRIPT_URL` serves the new code.
  4. Confirm the real `SCRIPT_URL` (should be unchanged) and the real `ADMIN_PASSWORD` value back, so Step 7's curl commands can use them.

- [ ] **Step 7: Verify live via curl**

  Using the real `SCRIPT_URL` and `ADMIN_PASSWORD` the user confirms:

  ```bash
  # 1. Crear un empleado de prueba (reemplazar CLAVE_REAL por la clave real)
  curl -s -X POST "$SCRIPT_URL" \
    --data-urlencode 'payload={"action":"guardar_empleado","clave":"CLAVE_REAL","nombre":"PRUEBA-CLAUDE-EMP","celular":"3000000000","fechaIngreso":"2026-07-29","idEnvio":"test-emp-1"}'
  # Expected: {"ok":true}

  # 2. Confirmar que aparece en el listado público (activo por defecto)
  curl -s "$SCRIPT_URL?action=listar_empleados"
  # Expected: la lista incluye {"nombre":"PRUEBA-CLAUDE-EMP"}

  # 3. Desactivarlo
  curl -s -X POST "$SCRIPT_URL" \
    --data-urlencode 'payload={"action":"guardar_empleado","clave":"CLAVE_REAL","nombre":"PRUEBA-CLAUDE-EMP","celular":"3000000000","fechaIngreso":"2026-07-29","activo":"No","idEnvio":"test-emp-2"}'
  # Expected: {"ok":true}

  # 4. Confirmar que desaparece del listado público pero sigue en el admin
  curl -s "$SCRIPT_URL?action=listar_empleados"
  # Expected: la lista YA NO incluye PRUEBA-CLAUDE-EMP
  curl -s "$SCRIPT_URL?action=listar_empleados_admin&clave=CLAVE_REAL"
  # Expected: la lista SÍ incluye {"nombre":"PRUEBA-CLAUDE-EMP", ..., "activo":"No"}

  # 5. Clave inválida debe rechazarse
  curl -s "$SCRIPT_URL?action=listar_empleados_admin&clave=CLAVE_MALA"
  # Expected: {"ok":false,"error":"Clave inválida"}
  ```

  If any of these doesn't match, do not proceed — debug against the pasted `Code.gs`, most likely cause is a duplicated function from the paste (Ctrl+F check) or a header row mismatch on `Empleados`.

- [ ] **Step 8: Ask the user to delete the `PRUEBA-CLAUDE-EMP` row from the live `Empleados` sheet, then commit**

  ```bash
  git add "Gestion_Proyecto/01-modulos/modulo-10-apps-script-empleados-inventario.gs.txt"
  git commit -m "feat: add Empleados catalog + accountability columns to Inventario backend"
  ```

  (`E:\Descargas\MENU\DONDE EL GORDO\Code.gs` lives outside this git repo's working directory — it is not committed here, same as every prior module.)

---

### Task 2: `empleados.html` — admin screen

**Files:**
- Create: `E:\Proyectos ZFood GyP\empleados.html`

**Interfaces:**
- Consumes: Task 1's `verificar_admin`, `listar_empleados_admin`, `guardar_empleado` (same `SCRIPT_URL` as `inventario.html`, since `Empleados` lives in that Apps Script project).
- Produces: nothing consumed by other tasks (this is a leaf admin page), but must not regress `inventario.html`'s conventions since Task 5 copies its GET/POST helpers from here (or vice versa — write these helpers here first since this task has no other dependency).

- [ ] **Step 1: Scaffold the page with password gate + list + add-form, using the same JSONP GET / hidden-iframe POST pattern as `inventario.html`**

  Create `E:\Proyectos ZFood GyP\empleados.html`:

  ```html
  <!DOCTYPE html>
  <html lang="es">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Empleados - Donde el Gordo</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#111; color:#eee; margin:0; padding:24px; }
    h1 { font-size: 1.4rem; }
    .panel { max-width: 480px; margin: 60px auto; background:#1c1c1c; padding:24px; border-radius:12px; }
    input, button { font-size:1rem; padding:10px; border-radius:8px; border:1px solid #444; background:#222; color:#eee; width:100%; box-sizing:border-box; margin-bottom:10px; }
    button { background:#e0552b; border:none; cursor:pointer; font-weight:bold; }
    button:disabled { opacity:0.5; cursor:not-allowed; }
    table { width:100%; border-collapse: collapse; margin-top:16px; }
    td, th { padding:8px; border-bottom:1px solid #333; text-align:left; font-size:0.9rem; }
    .estado-si { color:#4caf50; font-weight:bold; }
    .estado-no { color:#888; }
    .toast { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:10px 20px; border-radius:8px; display:none; }
  </style>
  </head>
  <body>

  <div class="panel" id="panelClave">
    <h1>🔒 Empleados — Donde el Gordo</h1>
    <input type="password" id="inputClave" placeholder="Clave de administrador">
    <button onclick="verificarClave()">Entrar</button>
  </div>

  <div id="panelPrincipal" style="display:none; max-width:700px; margin:0 auto;">
    <h1>👥 Empleados</h1>

    <div class="panel" style="max-width:none;">
      <h2 style="font-size:1.1rem;">Agregar empleado</h2>
      <input type="text" id="nuevoNombre" placeholder="Nombre completo">
      <input type="text" id="nuevoCelular" placeholder="Celular">
      <input type="date" id="nuevaFechaIngreso">
      <button onclick="agregarEmpleado()">Guardar</button>
    </div>

    <table id="tablaEmpleados">
      <thead><tr><th>Nombre</th><th>Celular</th><th>Fecha ingreso</th><th>Estado</th><th></th></tr></thead>
      <tbody></tbody>
    </table>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzo45isSgsJoCJxyvBl81Eb9fMAMwsB3GS5IRwV9QxTgk7NLfj8BiE8j5CgeP6dWgb6/exec';
    let CLAVE_ADMIN = '';
    let EMPLEADOS_ADMIN = [];

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 3000);
    }

    function jsonp(url) {
      return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        window[callbackName] = function (data) {
          delete window[callbackName];
          script.remove();
          resolve(data);
        };
        const script = document.createElement('script');
        script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
        script.onerror = () => { delete window[callbackName]; script.remove(); reject(new Error('jsonp failed')); };
        document.body.appendChild(script);
      });
    }

    function postForm(payload) {
      return new Promise((resolve) => {
        const idEnvio = 'env_' + Date.now();
        payload.idEnvio = idEnvio;
        const iframeName = 'iframe_' + Date.now();
        const iframe = document.createElement('iframe');
        iframe.name = iframeName;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = SCRIPT_URL;
        form.target = iframeName;
        form.style.display = 'none';
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'payload';
        input.value = JSON.stringify(payload);
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        setTimeout(async () => {
          try {
            const data = await jsonp(SCRIPT_URL + '?action=verificar_envio&id=' + encodeURIComponent(idEnvio));
            document.body.removeChild(iframe);
            resolve(!!(data && data.ok && data.confirmado));
          } catch (e) {
            document.body.removeChild(iframe);
            resolve(false);
          }
        }, 1500);
      });
    }

    async function verificarClave() {
      const clave = document.getElementById('inputClave').value;
      try {
        const data = await jsonp(SCRIPT_URL + '?action=verificar_admin&clave=' + encodeURIComponent(clave));
        if (data && data.ok && data.valido) {
          CLAVE_ADMIN = clave;
          document.getElementById('panelClave').style.display = 'none';
          document.getElementById('panelPrincipal').style.display = 'block';
          cargarEmpleados();
        } else {
          showToast('Clave incorrecta');
        }
      } catch (e) {
        showToast('No se pudo conectar con el servidor');
      }
    }

    async function cargarEmpleados() {
      try {
        const data = await jsonp(SCRIPT_URL + '?action=listar_empleados_admin&clave=' + encodeURIComponent(CLAVE_ADMIN));
        if (data && data.ok) {
          EMPLEADOS_ADMIN = data.empleados;
          renderTabla();
        } else {
          showToast('Error al cargar empleados');
        }
      } catch (e) {
        showToast('No se pudo conectar con el servidor');
      }
    }

    function renderTabla() {
      const tbody = document.querySelector('#tablaEmpleados tbody');
      tbody.innerHTML = EMPLEADOS_ADMIN.map(emp => `
        <tr>
          <td>${emp.nombre}</td>
          <td>${emp.celular}</td>
          <td>${emp.fechaIngreso}</td>
          <td class="${emp.activo === 'Si' ? 'estado-si' : 'estado-no'}">${emp.activo === 'Si' ? 'Activo' : 'Inactivo'}</td>
          <td><button onclick="cambiarEstado('${emp.nombre.replace(/'/g, "\\'")}', '${emp.activo}')">${emp.activo === 'Si' ? 'Desactivar' : 'Reactivar'}</button></td>
        </tr>
      `).join('');
    }

    async function cambiarEstado(nombre, activoActual) {
      const emp = EMPLEADOS_ADMIN.find(e => e.nombre === nombre);
      if (!emp) return;
      const ok = await postForm({
        action: 'guardar_empleado',
        clave: CLAVE_ADMIN,
        nombre: emp.nombre,
        celular: emp.celular,
        fechaIngreso: emp.fechaIngreso,
        activo: activoActual === 'Si' ? 'No' : 'Si'
      });
      if (ok) {
        showToast('Actualizado');
        cargarEmpleados();
      } else {
        showToast('Error al actualizar');
      }
    }

    async function agregarEmpleado() {
      const nombre = document.getElementById('nuevoNombre').value.trim();
      const celular = document.getElementById('nuevoCelular').value.trim();
      const fechaIngreso = document.getElementById('nuevaFechaIngreso').value;
      if (!nombre) { showToast('Falta el nombre'); return; }
      const ok = await postForm({ action: 'guardar_empleado', clave: CLAVE_ADMIN, nombre, celular, fechaIngreso, activo: 'Si' });
      if (ok) {
        showToast('Empleado guardado');
        document.getElementById('nuevoNombre').value = '';
        document.getElementById('nuevoCelular').value = '';
        document.getElementById('nuevaFechaIngreso').value = '';
        cargarEmpleados();
      } else {
        showToast('Error al guardar');
      }
    }
  </script>
  </body>
  </html>
  ```

- [ ] **Step 2: Manual verification (requires Task 1 already published live)**

  Open `empleados.html` locally in a browser (or via Playwright if available in the execution session): enter the wrong password (expect "Clave incorrecta"), enter the real password (expect the table to load), add a test employee `PRUEBA-CLAUDE-EMP-UI`, confirm it appears in the table as Activo, click "Desactivar", confirm the row now shows Inactivo without a page reload glitch. Delete the test row from the live `Empleados` sheet afterward.

- [ ] **Step 3: Commit**

  ```bash
  git add empleados.html
  git commit -m "feat: add empleados.html admin screen for the Empleados catalog"
  ```

---

### Task 3: Backend — cross-Sheet `listar_empleados` in the Menú Apps Script

**Files:**
- Create: `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-10-apps-script-empleados-menu.gs.txt`

**Interfaces:**
- Produces (consumed by Task 4's `menu.html`): `GET ?accion=listar_empleados` → `{ok:true, empleados:[{nombre:string}, ...]}`, or `{ok:true, empleados:[]}` if the cross-Sheet read fails (never `{ok:false}` for this action — the frontend must always get a usable, possibly-empty array).

- [ ] **Step 1: Write the new action, following this project's existing `accion=` (Spanish) routing convention for the menú's Apps Script**

  ```javascript
  // ============================================================================
  // Ficha de Empleados — nueva acción de solo lectura para el Apps Script del
  // menú digital (el mismo proyecto que sirve listar_productos, crear_pedido,
  // estado_mesa, etc. via accion=... en su doGet).
  // ============================================================================
  // Instrucciones:
  // 1. Pega la constante y la función de abajo en el editor de Apps Script del
  //    menú digital.
  // 2. Busca tu doGet(e) existente y agrega esta rama nueva junto a las demás
  //    (mismo patrón: if/else if sobre e.parameter.accion):
  //        else if (accion === 'listar_empleados') { return listarEmpleadosMenu(); }
  // 3. Publica de nuevo la implementación web (Implementar > Administrar
  //    implementaciones > Editar > Nueva versión).
  // ============================================================================

  // Mismo Sheet ID que SHEET_ID en el Code.gs de Inventario — ahí vive la hoja
  // "Empleados". Lectura cruzada, mismo patrón que Code.gs ya usa (en sentido
  // contrario) para leer las Ventas del menú desde MENU_SHEET_ID.
  const INVENTARIO_SHEET_ID = '1BpzdVNZtBnzbqqPq9aiPrDKtNo386b8H33v0LaJyJYA';

  /**
   * accion=listar_empleados
   * Lee la hoja "Empleados" del Sheet de Inventario y devuelve solo los activos.
   * Nunca falla con ok:false -- si el Sheet cruzado no está disponible (permisos,
   * ID cambiado, etc.), devuelve una lista vacía para que menu.html caiga a un
   * campo de texto libre en vez de bloquear el flujo de pedido.
   */
  function listarEmpleadosMenu() {
    let empleados = [];
    try {
      const ss = SpreadsheetApp.openById(INVENTARIO_SHEET_ID);
      const sheet = ss.getSheetByName('Empleados');
      const datos = sheet ? sheet.getDataRange().getValues() : [];
      for (let i = 1; i < datos.length; i++) {
        const row = datos[i];
        if (!row[0]) continue;
        const activo = (row[3] || '').toString().trim().toUpperCase() === 'SI';
        if (!activo) continue;
        empleados.push({ nombre: row[0].toString().trim() });
      }
    } catch (err) {
      // Sheet cruzado no disponible: seguimos con lista vacía, no rompemos el menú.
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true, empleados: empleados }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  ```

- [ ] **Step 2: Tell the user the manual steps required before this can be verified**

  Message to relay to the user (do not proceed to Step 3 until confirmed done):
  1. Paste the constant + function from Step 1 into the menú's Apps Script editor.
  2. Add the `listar_empleados` branch to the menú's existing `doGet(e)`.
  3. Ctrl+F to confirm `INVENTARIO_SHEET_ID` and `listarEmpleadosMenu` each appear exactly once (this project has twice shipped a silent bug from a duplicated paste).
  4. Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar.

- [ ] **Step 3: Verify live via curl**

  ```bash
  curl -s "$MENU_SCRIPT_URL?accion=listar_empleados"
  # Expected: {"ok":true,"empleados":[...]} listing the currently-active employees
  # from the Inventario Sheet (should match Task 1's live listar_empleados output).
  ```

  If this returns `{"ok":true,"empleados":[]}` but Task 1's `listar_empleados` returned a non-empty list, the cross-Sheet read is failing silently — check that the menú's Apps Script has been granted access to open the Inventario Sheet (first cross-Sheet open of a new Sheet ID from a script sometimes prompts for an additional Google authorization, same note as the existing `MENU_SHEET_ID` cross-read in `Code.gs`).

- [ ] **Step 4: Commit**

  ```bash
  git add "Gestion_Proyecto/01-modulos/modulo-10-apps-script-empleados-menu.gs.txt"
  git commit -m "feat: add cross-Sheet listar_empleados to the menu Apps Script"
  ```

---

### Task 4: `menu.html` — mesero selector

**Files:**
- Modify: `E:\Proyectos ZFood GyP\menu.html:212` (input), `:961-970` (init), plus 2 new functions

**Interfaces:**
- Consumes: Task 3's `GET ?accion=listar_empleados`.
- Produces: none (leaf UI change) — `confirmarMesaMesero()`, `verificarMesa()`, `elegirTipo()` (lines 674-755) are unchanged; they all read `.value`/`.disabled` off `#mesa-mesero`, which keeps working whether that element is a `<select>` or falls back to an `<input>`.

- [ ] **Step 1: Replace the free-text input with a select**

  At `menu.html:212`, replace:
  ```html
      <input type="text" id="mesa-mesero" placeholder="Su nombre">
  ```
  with:
  ```html
      <select id="mesa-mesero">
        <option value="">-- Selecciona tu nombre --</option>
      </select>
  ```

- [ ] **Step 2: Add `cargarEmpleados()` + `renderMeseroOptions()`, with fallback to free text on failure**

  Add near `cargarProductos()` (after its closing brace, around line 456):

  ```javascript
  let EMPLEADOS = [];

  async function cargarEmpleados() {
    try {
      const res = await fetch(SCRIPT_URL + '?accion=listar_empleados');
      const data = await res.json();
      if (data.ok && Array.isArray(data.empleados)) {
        EMPLEADOS = data.empleados;
      }
    } catch (e) {
      // Backend no disponible -- renderMeseroOptions() cae a texto libre.
    }
    renderMeseroOptions();
  }

  function renderMeseroOptions() {
    const el = document.getElementById('mesa-mesero');
    if (!el) return;
    if (EMPLEADOS.length === 0) {
      // Sin catálogo disponible: no bloqueamos el flujo, volvemos a campo de texto libre.
      if (el.tagName === 'SELECT') {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'mesa-mesero';
        input.placeholder = 'Su nombre';
        el.replaceWith(input);
      }
      return;
    }
    if (el.tagName !== 'SELECT') return; // ya se reemplazó por texto libre, no hay nada que poblar
    el.innerHTML = '<option value="">-- Selecciona tu nombre --</option>' +
      EMPLEADOS.map(emp => `<option value="${emp.nombre.replace(/"/g, '&quot;')}">${emp.nombre}</option>`).join('');
  }
  ```

- [ ] **Step 3: Call `cargarEmpleados()` during init**

  At `menu.html:961-970`, change:
  ```javascript
  (async function init() {
    renderMesaBadge();
    await cargarProductos();
    renderCategorias();
  ```
  to:
  ```javascript
  (async function init() {
    renderMesaBadge();
    await cargarProductos();
    await cargarEmpleados();
    renderCategorias();
  ```

- [ ] **Step 4: Manual verification**

  Requires Task 3 already published live. Open `menu.html` (or via Playwright if available), open a table without a QR mesa param, click into "¿Qué mesa atiendes?", confirm the mesero field is now a dropdown listing real active employees (not the `PRUEBA-CLAUDE-EMP` test rows, which should already be cleaned up by Task 1/3). Confirm selecting a name and submitting a local order still writes the same `Mesero` value to `Ventas` as before (spot-check via curl against `estado_mesa` for that mesa).

  Also verify the fallback: temporarily point `SCRIPT_URL` (in a scratch copy, not committed) at an invalid URL, reload, confirm the mesero field becomes a text input instead of an empty broken dropdown.

- [ ] **Step 5: Commit**

  ```bash
  git add menu.html
  git commit -m "feat: replace free-text mesero name with Empleados-backed selector in menu.html"
  ```

---

### Task 5: `inventario.html` — Responsable (conteo) + Quién trae / Quién recibe (ingresos)

**Files:**
- Modify: `E:\Proyectos ZFood GyP\inventario.html` (home screen meta-card ~line 728-741, ingresos screen ~line 834-844, `window.onload` ~line 1007-1013, `updateMetaDraft()` ~line 1261-1266, `submitInventory()` ~line 1692-1730, `submitIngresos()` ~line 1859-1912)

**Interfaces:**
- Consumes: Task 1's `GET ?action=listar_empleados` (same `SCRIPT_URL` this file already uses).
- Produces: none (leaf UI change).

- [ ] **Step 1: Add `EMPLEADOS` state + JSONP loader, following this file's existing catalog-fetch pattern**

  Add near `loadSavedProductosCatalog()`/`fetchProductosCatalog()` (around line 1917-1931):

  ```javascript
  let EMPLEADOS = [];

  function fetchEmpleados() {
    const script = document.createElement('script');
    script.src = `${SCRIPT_URL}?action=listar_empleados&callback=onEmpleadosLoaded`;
    script.onerror = () => { EMPLEADOS = []; renderResponsableSelect(); renderIngresoSelects(); };
    document.body.appendChild(script);
  }

  window.onEmpleadosLoaded = function (response) {
    EMPLEADOS = (response && response.ok && Array.isArray(response.empleados)) ? response.empleados : [];
    renderResponsableSelect();
    renderIngresoSelects();
  };

  function empleadosOptionsHtml(selected) {
    const opciones = ['<option value="">-- Selecciona --</option>']
      .concat(EMPLEADOS.map(emp => `<option value="${emp.nombre.replace(/"/g, '&quot;')}"${emp.nombre === selected ? ' selected' : ''}>${emp.nombre}</option>`));
    return opciones.join('');
  }

  function renderResponsableSelect() {
    const el = document.getElementById('selectResponsable');
    if (!el) return;
    const draft = loadDraft();
    el.innerHTML = empleadosOptionsHtml(draft.responsable || '');
  }

  function renderIngresoSelects() {
    const trae = document.getElementById('selectQuienTrae');
    const recibe = document.getElementById('selectQuienRecibe');
    if (trae) trae.innerHTML = empleadosOptionsHtml('');
    if (recibe) recibe.innerHTML = empleadosOptionsHtml('');
  }
  ```

- [ ] **Step 2: Call `fetchEmpleados()` on load**

  At `window.onload` (line 1007-1013), change:
  ```javascript
  window.onload = function() {
    initMetaDate();
    loadSavedCatalog();
    loadSavedProductosCatalog();
    fetchOnlineCatalog();
    updateDashboardCounters();
  };
  ```
  to:
  ```javascript
  window.onload = function() {
    initMetaDate();
    loadSavedCatalog();
    loadSavedProductosCatalog();
    fetchOnlineCatalog();
    fetchEmpleados();
    updateDashboardCounters();
  };
  ```

- [ ] **Step 3: Add the Responsable selector to the home screen meta-card**

  At line 733-740, change:
  ```html
        <div class="meta-input-group">
          <label for="selectTurno">Turno</label>
          <select id="selectTurno" onchange="updateMetaDraft()">
            <option value="APERTURA">🌅 Apertura</option>
            <option value="CIERRE">🌙 Cierre</option>
            <option value="MEDIODIA">☀️ Mediodía</option>
          </select>
        </div>
  ```
  to:
  ```html
        <div class="meta-input-group">
          <label for="selectTurno">Turno</label>
          <select id="selectTurno" onchange="updateMetaDraft()">
            <option value="APERTURA">🌅 Apertura</option>
            <option value="CIERRE">🌙 Cierre</option>
            <option value="MEDIODIA">☀️ Mediodía</option>
          </select>
        </div>
        <div class="meta-input-group">
          <label for="selectResponsable">Responsable del conteo</label>
          <select id="selectResponsable" onchange="updateMetaDraft()">
            <option value="">-- Selecciona --</option>
          </select>
        </div>
  ```

- [ ] **Step 4: Persist `responsable` in the draft and send it on submit**

  At `updateMetaDraft()` (line 1261-1266), change:
  ```javascript
  function updateMetaDraft() {
    const draft = loadDraft();
    draft.fecha = document.getElementById('inputFecha').value;
    draft.turno = document.getElementById('selectTurno').value;
    saveDraft(draft);
  }
  ```
  to:
  ```javascript
  function updateMetaDraft() {
    const draft = loadDraft();
    draft.fecha = document.getElementById('inputFecha').value;
    draft.turno = document.getElementById('selectTurno').value;
    const responsableEl = document.getElementById('selectResponsable');
    if (responsableEl) draft.responsable = responsableEl.value;
    saveDraft(draft);
  }
  ```

  At `initMetaDate()` (line 1016-1033), after the existing `document.getElementById('selectTurno').value = draft.turno || 'APERTURA';` line, add:
  ```javascript
      if (document.getElementById('selectResponsable')) {
        document.getElementById('selectResponsable').value = draft.responsable || '';
      }
  ```

  In `submitInventory()` (line 1692-1730), inside the `payload` object, add the field:
  ```javascript
      const payload = {
        action: 'guardar_inventario_completo',
        idEnvio: idEnvio,
        fecha: draft.fecha,
        turno: draft.turno,
        responsable: draft.responsable || '',
        items: items.map(it => ({
          nombre: it.producto,
          total: it.total,
          areas: it.areas,
          unit: it.unit
        }))
      };
  ```

- [ ] **Step 5: Add "Quién trae" / "Quién recibe" to the Ingresos screen**

  At line 840-843, change:
  ```html
      <div class="search-container">
        <input type="text" id="ingresosSearchInput" class="search-input" placeholder="Buscar en Ingresos..." oninput="filterIngresosProducts()">
      </div>
  ```
  to:
  ```html
      <div class="meta-card glass">
        <div class="meta-input-group">
          <label for="selectQuienTrae">Quién trae</label>
          <select id="selectQuienTrae">
            <option value="">-- Selecciona --</option>
          </select>
        </div>
        <div class="meta-input-group">
          <label for="selectQuienRecibe">Quién recibe</label>
          <select id="selectQuienRecibe">
            <option value="">-- Selecciona --</option>
          </select>
        </div>
      </div>

      <div class="search-container">
        <input type="text" id="ingresosSearchInput" class="search-input" placeholder="Buscar en Ingresos..." oninput="filterIngresosProducts()">
      </div>
  ```

  In `submitIngresos()` (line 1859-1912), before the existing `if (items.length === 0)` check, add:
  ```javascript
    const quienTrae = document.getElementById('selectQuienTrae').value;
    const quienRecibe = document.getElementById('selectQuienRecibe').value;
    if (!quienTrae || !quienRecibe) {
      showToast("Selecciona quién trae y quién recibe.", "error");
      return;
    }
  ```
  and add both fields to the `payload` object:
  ```javascript
    const payload = {
      action: 'guardar_ingreso',
      idEnvio: idEnvio,
      fecha: parentDraft.fecha,
      quienTrae: quienTrae,
      quienRecibe: quienRecibe,
      items: items
    };
  ```

  This is a deliberate stricter rule than `menu.html`'s mesero field (which stays optional for autoservicio) — the whole point of this task was closing the "nadie registra quién trajo/recibió" gap, so these two fields are **required** to submit an Ingreso.

- [ ] **Step 6: Manual verification**

  Requires Task 1 already published live (with the `Responsable`/`Quien_Trae`/`Quien_Recibe` header cells added per Task 1 Step 6). Open `inventario.html` (or via Playwright if available): confirm the "Responsable del conteo" selector on the home screen populates with real active employees; submit a test conteo and confirm the new `Responsable` column has the selected name in the live `Inventario` sheet. Go to "Registrar Ingresos del Día", confirm both new selectors populate, try submitting with one left blank (expect the toast error and no submission), then fill both and submit a test ingreso, confirm `Quien_Trae`/`Quien_Recibe` land correctly in the live `Ingresos` sheet. Delete both test rows afterward.

- [ ] **Step 7: Commit**

  ```bash
  git add inventario.html
  git commit -m "feat: add Responsable and Quien_Trae/Quien_Recibe selectors to inventario.html"
  ```

---

### Task 6: End-to-end wrap-up

**Files:**
- Modify: `E:\Proyectos ZFood GyP\Gestion_Proyecto\03-seguimiento\ESTADO.md`
- Create: `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-10-ficha-empleados.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Full live smoke test across both Apps Script projects together**

  With Tasks 1-5 all published live: create one real (or clearly-marked test) employee via `empleados.html`, then in a single sitting: open a mesa in `menu.html` and confirm the new employee appears and can be selected as mesero; submit a conteo in `inventario.html` with that employee as Responsable; submit an Ingreso with that employee as Quién trae/Quién recibe. Confirm all 3 writes landed correctly by reading the live Sheets (curl or direct Sheet view). Delete all test rows afterward (`Empleados`, `Ventas`, `Inventario`, `Ingresos`).

- [ ] **Step 2: Write `modulo-10-ficha-empleados.md`**

  Following the format of the other `modulo-N-*.md` files in `Gestion_Proyecto/01-modulos/` (Objetivo, Funcionalidades, Qué ya existe, Decisiones, Qué falta, Dependencias): document the `Empleados` sheet location, the 2 cross-Sheet directions now in play (`Code.gs` → `MENU_SHEET_ID` for Ventas, menú Apps Script → `INVENTARIO_SHEET_ID` for Empleados), the "Activo=No never deletes" rule, and that this closes the Módulo 8 mesero-name-inconsistency risk transitively.

- [ ] **Step 3: Update `ESTADO.md`**

  Add a row to the módulos table for "10. Ficha de Empleados" with status and next steps (real razón social/NIT-style leftover items, if any remain — most likely none, this module should ship complete). Update the "▶️ Para continuar" section to reflect this module is done and what, if anything, is still pending (e.g. reminding the user that `menu.html`'s mesero field now requires the catálogo to be populated with real staff before launch, or autoservicio-only tables will show an empty dropdown).

- [ ] **Step 4: Commit**

  ```bash
  git add "Gestion_Proyecto/03-seguimiento/ESTADO.md" "Gestion_Proyecto/01-modulos/modulo-10-ficha-empleados.md"
  git commit -m "docs: track Ficha de Empleados module in ESTADO.md"
  ```
