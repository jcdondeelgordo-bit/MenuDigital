# Módulo 11 — Cuadre de Caja: Plan de Implementación

> **Para quien ejecute este plan:** usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans, tarea por tarea. Los pasos usan checkboxes (`- [ ]`) para llevar seguimiento.

**Objetivo:** Construir el backend (Apps Script de **Inventario**) y `cuadre.html` para que el cajero pueda abrir caja (confirmar la base del día), registrar gastos/pagos a empleados/recogidas/daños uno por uno durante el día, y cerrar caja calculando automáticamente la nueva base esperada y el faltante/sobrante contra el efectivo contado.

**Arquitectura:** Todo el backend nuevo vive en el proyecto de Apps Script de **Inventario** (no en el del Menú digital) — reutiliza `Gastos_JC` y `Empleados`, que ya viven ahí, y solo *lee* (nunca escribe) las ventas del Menú vía `MENU_SHEET_ID`, mecanismo que `generarReporteInsumos` ya usa hoy. Archivo estático nuevo `cuadre.html` (mismo patrón sin login que `inventario.html`/`caja.html`), usando el mismo mecanismo ya probado de esta app para hablar con Apps Script: JSONP (`<script src="...&callback=...">`) para lecturas, y formulario oculto + iframe + `verificar_envio` en polling para escrituras (evita el límite de CORS en `doPost`). Ver el diseño completo en `modulo-11-cuadre-caja.md`.

**Tech Stack:** HTML + JavaScript vanilla (sin frameworks, sin build step), Google Apps Script (V8 runtime), Google Sheets como base de datos.

## Global Constraints

- **Este módulo vive en el proyecto de Apps Script de INVENTARIO, NO en el del Menú digital.** Antes de pegar cualquier código, confirmar que se está en el editor de Apps Script correcto (Extensiones → Apps Script del Sheet de Inventario) — el 2026-07-29 un pegado manual en el proyecto equivocado borró temporalmente todo el `doGet` del Menú (ver `ESTADO.md`). Si hay cualquier duda de cuál proyecto es cuál, parar y preguntar al usuario antes de pegar.
- **SCRIPT_URL de Inventario** (el mismo que ya usa `inventario.html`): `https://script.google.com/macros/s/AKfycbzo45isSgsJoCJxyvBl81Eb9fMAMwsB3GS5IRwV9QxTgk7NLfj8BiE8j5CgeP6dWgb6/exec`
- **El mirror local del backend de Inventario es** `E:\Descargas\MENU\DONDE EL GORDO\Code.gs` — este archivo NO está en ningún repo git (es solo la copia de referencia en el computador del usuario). El repo git de este plan (`E:\Proyectos ZFood GyP`) solo contiene el frontend (`cuadre.html`) y la documentación.
- **`Cuadre de Caja` no lleva autenticación** — mismo criterio que `inventario.html`/`caja.html` (sin login), no como `comisiones.html`/modo admin del menú.
- **No hay framework de pruebas automatizadas.** La verificación de backend se hace con `curl` real contra el `SCRIPT_URL` desplegado (usar siempre `curl -s -L --ssl-no-revoke` en este entorno Windows). La verificación de frontend es manual: abrir `cuadre.html` en el navegador (servido por HTTP, no doble clic, para que el `fetch`/JSONP real funcione) y comprobar visualmente.
- **Todo dato de prueba creado durante la verificación debe llevar el prefijo `PRUEBA-CLAUDE-CUADRE-`** en los campos de texto libre (concepto, quién, motivo) para poder identificarlo y borrarlo de los Sheets reales al final de cada tarea.
- **Cuidado al pegar código en el editor de Apps Script online:** después de pegar, verificar con Ctrl+F que cada función nueva (`calcularResumenCaja_`, `listarRegistrosDiaCaja_`, `filtrarPorFecha_`, `round2_`) aparece **una sola vez** antes de publicar — ya ha pasado antes que una función quedara duplicada y el cambio no tomara efecto en silencio (ver bitácora de Módulo 8 y Módulo 9 en `ESTADO.md`).
- **La hoja `Ventas` del Menú (Sheet `1WIltJ3wSxGu9VQDGmnj5Lx9uXqUfWjA7Q9aKcZK32ak`) ya tiene 16 columnas**, incluyendo `Estado` (columna I) y `Metodo_Pago` (columna P, `Efectivo`/`Nequi`/`Tarjeta`/vacía) — este plan solo LEE esa hoja, no la modifica.
- **`Gastos_JC` ya existe en vivo con datos reales** (columnas actuales: Fecha, Producto, Cantidad, Autorizado_Por, Motivo) — este plan le agrega una 6ª columna, `Tipo`, mediante un paso manual en el Sheet real (no se puede retro-agregar por código sin arriesgar la data existente). Las filas viejas sin `Tipo` se siguen tratando como `Tipo=Producto` (comportamiento actual, sin romper nada).
- **`Empleados` (Nombre, Celular, Fecha_Ingreso, Activo) ya existe en el Sheet de Inventario** (Módulo 10) — se reutiliza tal cual para el selector de "Pago a empleado", sin modificarla.
- **Redondeo de dinero:** todos los cálculos de dinero usan `Math.round(n * 100) / 100` (función `round2_`) para evitar arrastrar errores de coma flotante — mismo criterio que ya usa `generarReporteInsumos`.

---

### Task 1: Backend Apps Script (Inventario) — hojas, acciones y ajuste del reporte de insumos

**Files:**
- Modify: `E:\Descargas\MENU\DONDE EL GORDO\Code.gs` (mirror local)
- Modify (manual, por el usuario, en el editor online de Apps Script del proyecto de **Inventario**): pegar todo el contenido actualizado de `Code.gs` y publicar nueva versión
- Modify (manual, por el usuario, en el Google Sheet de Inventario, hoja `Gastos_JC`): agregar el encabezado `Tipo` en la celda F1

**Interfaces:**
- Produces: `action=listar_insumos` → `{ok:true, insumos:[{codigo, nombre, unidad}]}`
- Produces: `action=resumen_dia_caja&fecha=YYYY-MM-DD` → `{ok:true, resumen:{ventaTotal, nequi, tarjeta, totalGastos, totalPagosEmpleados, totalRecogidas, baseApertura, nuevaBaseEsperada}}`
- Produces: `action=sugerir_base_apertura&fecha=YYYY-MM-DD` → `{ok:true, baseSugerida:<numero>}`
- Produces: `action=listar_registros_dia_caja&fecha=YYYY-MM-DD` → `{ok:true, registros:{gastos:[...], pagos:[...], recogidas:[...], danos:[...]}}`
- Produces (POST, `doPost` con `payload` = JSON con `action` + `idEnvio` + campos): `registrar_gasto_caja`, `registrar_pago_empleado_caja`, `registrar_recogida_caja`, `registrar_dano`, `abrir_caja`, `cerrar_caja` → todas responden `{ok:true}` (`cerrar_caja` además responde `{ok:true, faltanteSobrante, nuevaBaseEsperada}`), confirmables luego vía `action=verificar_envio&id=<idEnvio>` (acción ya existente, sin cambios).

- [ ] **Step 1: Agregar el mapa `codigoPorNombreInsumo` dentro de `generarReporteInsumos`**

En `E:\Descargas\MENU\DONDE EL GORDO\Code.gs`, buscar:
```javascript
  const insumos = []; // { codigo, nombre, unidad }
  for (let i = 1; i < insumosData.length; i++) {
    const row = insumosData[i];
    if (!row[0]) continue;
    insumos.push({ codigo: row[0].toString().trim(), nombre: row[1].toString().trim(), unidad: row[2] ? row[2].toString().trim() : '' });
  }

  // --- Qué insumos SÍ se cuentan físicamente (catálogo de conteo, "Hoja 1") ---
```
Reemplazar por:
```javascript
  const insumos = []; // { codigo, nombre, unidad }
  for (let i = 1; i < insumosData.length; i++) {
    const row = insumosData[i];
    if (!row[0]) continue;
    insumos.push({ codigo: row[0].toString().trim(), nombre: row[1].toString().trim(), unidad: row[2] ? row[2].toString().trim() : '' });
  }

  // --- Módulo 11 (Cuadre de Caja): resolver nombre de insumo -> código, para los
  // daños de insumo CRUDO (ej. "carne quemada") que se restan directo, sin receta ---
  const codigoPorNombreInsumo = {};
  insumos.forEach(function (ins) { codigoPorNombreInsumo[normalizeName(ins.nombre)] = ins.codigo; });

  // --- Qué insumos SÍ se cuentan físicamente (catálogo de conteo, "Hoja 1") ---
```

- [ ] **Step 2: Ajustar el bloque de `Gastos_JC` para distinguir `Tipo=Producto` vs `Tipo=Insumo`**

Buscar (bloque completo, exacto):
```javascript
  // --- Gastos J/C del día (consumo o retiro autorizado por Jaime/Clemencia) -> Gasto J/C de insumos ---
  // Esta pestaña la llenan a mano directamente en el Sheet, por nombre de producto (no código).
  const gastosJCSheet = getOrCreateSheet(ss, 'Gastos_JC', ['Fecha', 'Producto', 'Cantidad', 'Autorizado_Por', 'Motivo']);
  const gastosJCData = gastosJCSheet.getDataRange().getValues();
  const gastoJC = {}; // codigoInsumo -> cantidad
  for (let i = 1; i < gastosJCData.length; i++) {
    const row = gastosJCData[i];
    if (toDateStr(row[0]) !== fecha) continue;
    const codigoProducto = codigoPorNombreProducto[normalizeName(row[1])];
    const cantidad = parseFloat(row[2]) || 0;
    const receta = codigoProducto ? recetasPorProducto[codigoProducto] : null;
    if (!receta || !cantidad) continue;
    receta.forEach(function (r) {
      gastoJC[r.codigoInsumo] = (gastoJC[r.codigoInsumo] || 0) + cantidad * r.cantidad;
    });
  }
```
Reemplazar por:
```javascript
  // --- Gastos J/C del día (consumo/retiro autorizado, y desde el Módulo 11 también daños
  // registrados desde Cuadre de Caja) -> Gasto J/C de insumos ---
  // Esta pestaña la llenan a mano (o vía Cuadre de Caja) por nombre, no por código.
  // Columna Tipo (F, agregada por el Módulo 11): 'Producto' (default si está vacía, para no
  // romper las filas viejas) resuelve por receta; 'Insumo' resta directo, sin receta, porque
  // es un insumo crudo dañado antes de convertirse en un producto vendible.
  const gastosJCSheet = getOrCreateSheet(ss, 'Gastos_JC', ['Fecha', 'Producto', 'Cantidad', 'Autorizado_Por', 'Motivo', 'Tipo']);
  const gastosJCData = gastosJCSheet.getDataRange().getValues();
  const gastoJC = {}; // codigoInsumo -> cantidad
  for (let i = 1; i < gastosJCData.length; i++) {
    const row = gastosJCData[i];
    if (toDateStr(row[0]) !== fecha) continue;
    const cantidad = parseFloat(row[2]) || 0;
    if (!cantidad) continue;
    const tipo = (row[5] || 'Producto').toString().trim();
    if (tipo === 'Insumo') {
      const codigoInsumo = codigoPorNombreInsumo[normalizeName(row[1])];
      if (!codigoInsumo) continue;
      gastoJC[codigoInsumo] = (gastoJC[codigoInsumo] || 0) + cantidad;
    } else {
      const codigoProducto = codigoPorNombreProducto[normalizeName(row[1])];
      const receta = codigoProducto ? recetasPorProducto[codigoProducto] : null;
      if (!receta) continue;
      receta.forEach(function (r) {
        gastoJC[r.codigoInsumo] = (gastoJC[r.codigoInsumo] || 0) + cantidad * r.cantidad;
      });
    }
  }
```

- [ ] **Step 3: Agregar los helpers `round2_`, `calcularResumenCaja_`, `filtrarPorFecha_` y `listarRegistrosDiaCaja_`**

Buscar:
```javascript
function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```
Reemplazar por:
```javascript
function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// MÓDULO 11 — CUADRE DE CAJA: helpers compartidos
// ============================================================================

function round2_(n) { return Math.round(n * 100) / 100; }

// Trae Venta_Total/Nequi/Tarjeta leyendo cruzado el Sheet del Menú (Ventas, Estado=Pagado
// del día), suma lo ya registrado en Gastos_Caja/Pagos_Empleados_Caja/Recogidas_Caja, trae
// la Base_Apertura ya guardada en Cuadre_Caja, y calcula la Nueva_Base_Esperada:
//   Venta_Total + Base_Apertura - Gastos - Pagos_Empleados - Recogidas - Nequi - Tarjeta
function calcularResumenCaja_(ss, fecha) {
  let ventaTotal = 0, nequi = 0, tarjeta = 0;
  try {
    const menuSs = SpreadsheetApp.openById(MENU_SHEET_ID);
    const ventasSheet = menuSs.getSheetByName('Ventas');
    const ventasData = ventasSheet ? ventasSheet.getDataRange().getValues() : [];
    const enc = ventasData[0] || [];
    const idxFecha = enc.indexOf('Fecha');
    const idxTotal = enc.indexOf('Total');
    const idxEstado = enc.indexOf('Estado');
    const idxMetodoPago = enc.indexOf('Metodo_Pago');
    for (let i = 1; i < ventasData.length; i++) {
      const row = ventasData[i];
      if (toDateStr(row[idxFecha]) !== fecha) continue;
      if (row[idxEstado] !== 'Pagado') continue;
      const total = parseFloat(row[idxTotal]) || 0;
      ventaTotal += total;
      const metodo = (row[idxMetodoPago] || '').toString().trim();
      if (metodo === 'Nequi') nequi += total;
      else if (metodo === 'Tarjeta') tarjeta += total;
    }
  } catch (errMenu) {
    // Si el Sheet del menú no está disponible, el resumen sigue con los demás totales en 0
    // en vez de romperse — mismo criterio que generarReporteInsumos con MENU_SHEET_ID.
  }

  const sumarColumnaC = function (nombreHoja) {
    const sheet = ss.getSheetByName(nombreHoja);
    const datos = sheet ? sheet.getDataRange().getValues() : [];
    let total = 0;
    for (let i = 1; i < datos.length; i++) {
      if (toDateStr(datos[i][0]) === fecha) total += parseFloat(datos[i][2]) || 0;
    }
    return total;
  };
  const totalGastos = sumarColumnaC('Gastos_Caja');
  const totalPagosEmpleados = sumarColumnaC('Pagos_Empleados_Caja');
  const totalRecogidas = sumarColumnaC('Recogidas_Caja');

  const cuadreSheet = ss.getSheetByName('Cuadre_Caja');
  const cuadreData = cuadreSheet ? cuadreSheet.getDataRange().getValues() : [];
  let baseApertura = 0;
  for (let i = 1; i < cuadreData.length; i++) {
    if (toDateStr(cuadreData[i][0]) === fecha) { baseApertura = parseFloat(cuadreData[i][1]) || 0; break; }
  }

  const nuevaBaseEsperada = round2_(ventaTotal + baseApertura - totalGastos - totalPagosEmpleados - totalRecogidas - nequi - tarjeta);

  return {
    ventaTotal: round2_(ventaTotal),
    nequi: round2_(nequi),
    tarjeta: round2_(tarjeta),
    totalGastos: round2_(totalGastos),
    totalPagosEmpleados: round2_(totalPagosEmpleados),
    totalRecogidas: round2_(totalRecogidas),
    baseApertura: round2_(baseApertura),
    nuevaBaseEsperada: nuevaBaseEsperada
  };
}

function filtrarPorFecha_(sheet, fecha) {
  const datos = sheet ? sheet.getDataRange().getValues() : [];
  const filas = [];
  for (let i = 1; i < datos.length; i++) {
    if (toDateStr(datos[i][0]) === fecha) filas.push(datos[i]);
  }
  return filas;
}

// Para la pestaña "Durante el día" de cuadre.html: todo lo ya registrado hoy, en un solo viaje.
function listarRegistrosDiaCaja_(ss, fecha) {
  const gastos = filtrarPorFecha_(ss.getSheetByName('Gastos_Caja'), fecha)
    .map(function (r) { return { concepto: r[1] || '', monto: Number(r[2]) || 0, registradoPor: r[3] || '' }; });
  const pagos = filtrarPorFecha_(ss.getSheetByName('Pagos_Empleados_Caja'), fecha)
    .map(function (r) { return { empleado: r[1] || '', monto: Number(r[2]) || 0, registradoPor: r[3] || '' }; });
  const recogidas = filtrarPorFecha_(ss.getSheetByName('Recogidas_Caja'), fecha)
    .map(function (r) { return { quien: r[1] || '', monto: Number(r[2]) || 0, registradoPor: r[3] || '' }; });
  const danos = filtrarPorFecha_(ss.getSheetByName('Gastos_JC'), fecha)
    .map(function (r) { return { nombre: r[1] || '', cantidad: Number(r[2]) || 0, registradoPor: r[3] || '', motivo: r[4] || '', tipo: (r[5] || 'Producto') }; });
  return { gastos: gastos, pagos: pagos, recogidas: recogidas, danos: danos };
}
```

- [ ] **Step 4: Agregar las 4 acciones nuevas de LECTURA en `doGet`**

Buscar (bloque exacto, es el final de la cadena `else if` de `doGet`):
```javascript
        result = { ok: true, empleados: empleados };
      } catch (err) {
        result = { ok: false, error: err.toString() };
      }
    }
  } else {
    // Si se accede sin parámetros, se muestra la página Index
    return HtmlService.createHtmlOutputFromFile('Index')
```
Reemplazar por:
```javascript
        result = { ok: true, empleados: empleados };
      } catch (err) {
        result = { ok: false, error: err.toString() };
      }
    }
  } else if (action === 'listar_insumos') {
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName('Insumos');
      const datos = sheet ? sheet.getDataRange().getValues() : [];
      const insumos = [];
      for (let i = 1; i < datos.length; i++) {
        const row = datos[i];
        if (!row[0]) continue;
        insumos.push({ codigo: row[0].toString().trim(), nombre: row[1] ? row[1].toString().trim() : '', unidad: row[2] ? row[2].toString().trim() : '' });
      }
      result = { ok: true, insumos: insumos };
    } catch (err) {
      result = { ok: false, error: err.toString() };
    }
  } else if (action === 'resumen_dia_caja') {
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      result = { ok: true, resumen: calcularResumenCaja_(ss, e.parameter.fecha) };
    } catch (err) {
      result = { ok: false, error: err.toString() };
    }
  } else if (action === 'sugerir_base_apertura') {
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const fechaAyer = addDaysToDateStr(e.parameter.fecha, -1);
      const cuadreSheet = ss.getSheetByName('Cuadre_Caja');
      const cuadreData = cuadreSheet ? cuadreSheet.getDataRange().getValues() : [];
      let sugerida = 0;
      for (let i = 1; i < cuadreData.length; i++) {
        if (toDateStr(cuadreData[i][0]) === fechaAyer) { sugerida = parseFloat(cuadreData[i][9]) || 0; break; }
      }
      result = { ok: true, baseSugerida: sugerida };
    } catch (err) {
      result = { ok: false, error: err.toString() };
    }
  } else if (action === 'listar_registros_dia_caja') {
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      result = { ok: true, registros: listarRegistrosDiaCaja_(ss, e.parameter.fecha) };
    } catch (err) {
      result = { ok: false, error: err.toString() };
    }
  } else {
    // Si se accede sin parámetros, se muestra la página Index
    return HtmlService.createHtmlOutputFromFile('Index')
```

- [ ] **Step 5: Agregar las 6 acciones nuevas de ESCRITURA en `doPost`**

Buscar (bloque exacto, es el final de la cadena `else if` de `doPost`):
```javascript
      registrarEnvio(ss, data.idEnvio, 'empleado', timestamp);
      return respond({ ok: true });

    } else {
      return respond({ ok: false, error: 'Acción no reconocida' });
    }
```
Reemplazar por:
```javascript
      registrarEnvio(ss, data.idEnvio, 'empleado', timestamp);
      return respond({ ok: true });

    } else if (data.action === 'registrar_gasto_caja') {
      const sheet = getOrCreateSheet(ss, 'Gastos_Caja', ['Fecha', 'Concepto', 'Monto', 'Registrado_Por']);
      sheet.appendRow([data.fecha, data.concepto || '', parseFloat(data.monto) || 0, data.registradoPor || '']);
      registrarEnvio(ss, data.idEnvio, 'gasto_caja', timestamp);
      return respond({ ok: true });

    } else if (data.action === 'registrar_pago_empleado_caja') {
      const sheet = getOrCreateSheet(ss, 'Pagos_Empleados_Caja', ['Fecha', 'Empleado', 'Monto', 'Registrado_Por']);
      sheet.appendRow([data.fecha, data.empleado || '', parseFloat(data.monto) || 0, data.registradoPor || '']);
      registrarEnvio(ss, data.idEnvio, 'pago_empleado_caja', timestamp);
      return respond({ ok: true });

    } else if (data.action === 'registrar_recogida_caja') {
      const sheet = getOrCreateSheet(ss, 'Recogidas_Caja', ['Fecha', 'Quien', 'Monto', 'Registrado_Por']);
      sheet.appendRow([data.fecha, data.quien || '', parseFloat(data.monto) || 0, data.registradoPor || '']);
      registrarEnvio(ss, data.idEnvio, 'recogida_caja', timestamp);
      return respond({ ok: true });

    } else if (data.action === 'registrar_dano') {
      const sheet = getOrCreateSheet(ss, 'Gastos_JC', ['Fecha', 'Producto', 'Cantidad', 'Autorizado_Por', 'Motivo', 'Tipo']);
      const tipo = data.tipo === 'Insumo' ? 'Insumo' : 'Producto';
      sheet.appendRow([data.fecha, data.nombre || '', parseFloat(data.cantidad) || 0, data.registradoPor || '', data.motivo || '', tipo]);
      registrarEnvio(ss, data.idEnvio, 'dano', timestamp);
      return respond({ ok: true });

    } else if (data.action === 'abrir_caja') {
      const sheet = getOrCreateSheet(ss, 'Cuadre_Caja', ['Fecha', 'Base_Apertura', 'Venta_Total', 'Nequi', 'Tarjeta', 'Total_Gastos', 'Total_Pagos_Empleados', 'Total_Recogidas', 'Nueva_Base_Esperada', 'Efectivo_Contado', 'Faltante_Sobrante', 'Abierto_Por', 'Cerrado_Por', 'Hora_Apertura', 'Hora_Cierre']);
      const datosCuadre = sheet.getDataRange().getValues();
      let filaFecha = -1;
      for (let i = 1; i < datosCuadre.length; i++) {
        if (toDateStr(datosCuadre[i][0]) === data.fecha) { filaFecha = i + 1; break; }
      }
      if (filaFecha > 0) {
        sheet.getRange(filaFecha, 2).setValue(parseFloat(data.baseApertura) || 0);
        sheet.getRange(filaFecha, 12).setValue(data.abiertoPor || '');
        sheet.getRange(filaFecha, 14).setValue(timestamp);
      } else {
        const fila = new Array(15).fill('');
        fila[0] = data.fecha;
        fila[1] = parseFloat(data.baseApertura) || 0;
        fila[11] = data.abiertoPor || '';
        fila[13] = timestamp;
        sheet.appendRow(fila);
      }
      registrarEnvio(ss, data.idEnvio, 'abrir_caja', timestamp);
      return respond({ ok: true });

    } else if (data.action === 'cerrar_caja') {
      const sheet = getOrCreateSheet(ss, 'Cuadre_Caja', ['Fecha', 'Base_Apertura', 'Venta_Total', 'Nequi', 'Tarjeta', 'Total_Gastos', 'Total_Pagos_Empleados', 'Total_Recogidas', 'Nueva_Base_Esperada', 'Efectivo_Contado', 'Faltante_Sobrante', 'Abierto_Por', 'Cerrado_Por', 'Hora_Apertura', 'Hora_Cierre']);
      const datosCuadre = sheet.getDataRange().getValues();
      let filaFecha = -1;
      for (let i = 1; i < datosCuadre.length; i++) {
        if (toDateStr(datosCuadre[i][0]) === data.fecha) { filaFecha = i + 1; break; }
      }
      if (filaFecha < 0) {
        return respond({ ok: false, error: 'No se ha abierto la caja de ese día todavía' });
      }
      const resumen = calcularResumenCaja_(ss, data.fecha);
      const efectivoContado = parseFloat(data.efectivoContado) || 0;
      const faltanteSobrante = round2_(efectivoContado - resumen.nuevaBaseEsperada);
      sheet.getRange(filaFecha, 3, 1, 8).setValues([[
        resumen.ventaTotal, resumen.nequi, resumen.tarjeta, resumen.totalGastos,
        resumen.totalPagosEmpleados, resumen.totalRecogidas, resumen.nuevaBaseEsperada, efectivoContado
      ]]);
      sheet.getRange(filaFecha, 11).setValue(faltanteSobrante);
      sheet.getRange(filaFecha, 13).setValue(data.cerradoPor || '');
      sheet.getRange(filaFecha, 15).setValue(timestamp);
      registrarEnvio(ss, data.idEnvio, 'cerrar_caja', timestamp);
      return respond({ ok: true, faltanteSobrante: faltanteSobrante, nuevaBaseEsperada: resumen.nuevaBaseEsperada });

    } else {
      return respond({ ok: false, error: 'Acción no reconocida' });
    }
```

**Nota:** `abrir_caja` y `cerrar_caja` actualizan la fila existente de ese día si ya existe (en vez de crear una duplicada) — esto resuelve de paso la pregunta abierta del diseño ("¿se puede corregir un cuadre ya cerrado el mismo día?"): sí, se puede, volviendo a llamar `cerrar_caja` con el efectivo contado correcto, y la fila se sobrescribe con los valores nuevos.

- [ ] **Step 6: Pedirle al usuario que aplique los 2 cambios manuales**

Decirle al usuario, en estos términos:
1. Abrir el Sheet de **Inventario** → hoja `Gastos_JC` → agregar el encabezado `Tipo` en la celda **F1**.
2. Abrir el proyecto de Apps Script de **Inventario** (Extensiones → Apps Script) — **confirmar que es el de Inventario, no el del Menú** — seleccionar todo el contenido del archivo `Code.gs` online y reemplazarlo por el contenido completo del archivo local actualizado (`E:\Descargas\MENU\DONDE EL GORDO\Code.gs`).
3. Con Ctrl+F, confirmar que `function calcularResumenCaja_`, `function listarRegistrosDiaCaja_`, `function filtrarPorFecha_` y `function round2_` aparecen **una sola vez** cada una.
4. Guardar (Ctrl+S) y publicar nueva versión: Implementar → Administrar implementaciones → editar (lápiz) → Nueva versión → Implementar.
5. Avisar cuando esté listo.

- [ ] **Step 7: Esperar confirmación del usuario antes de continuar a la verificación**

No avanzar al Step 8 hasta que el usuario confirme que publicó la nueva versión y agregó el encabezado `Tipo`.

- [ ] **Step 8: Verificación en vivo de las 4 acciones de lectura**

```bash
SCRIPT_URL="https://script.google.com/macros/s/AKfycbzo45isSgsJoCJxyvBl81Eb9fMAMwsB3GS5IRwV9QxTgk7NLfj8BiE8j5CgeP6dWgb6/exec"
FECHA=$(date +%F)

curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "action=listar_insumos"
echo
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "action=resumen_dia_caja" --data-urlencode "fecha=$FECHA"
echo
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "action=sugerir_base_apertura" --data-urlencode "fecha=$FECHA"
echo
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "action=listar_registros_dia_caja" --data-urlencode "fecha=$FECHA"
```
Expected: las 4 respuestas son `{"ok":true, ...}` (no un error de "acción no reconocida"). `resumen_dia_caja` y `listar_registros_dia_caja` pueden traer todo en cero/vacío si todavía no hay datos de hoy — es correcto.

- [ ] **Step 9: Verificación en vivo de apertura, registro y cierre, de punta a punta**

```bash
curl -s -L --ssl-no-revoke "$SCRIPT_URL" --data-urlencode "payload={\"action\":\"abrir_caja\",\"idEnvio\":\"env_test_apertura_1\",\"fecha\":\"$FECHA\",\"baseApertura\":100000,\"abiertoPor\":\"PRUEBA-CLAUDE-CUADRE-APERTURA\"}"
echo
sleep 2
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "action=verificar_envio" --data-urlencode "id=env_test_apertura_1"
```
Expected: la segunda respuesta trae `{"ok":true,"confirmado":true}` — confirma que `doPost` sí escribió (el primer `curl` a un webapp de Apps Script vía POST normalmente da un HTML de redirección, no JSON; por eso se verifica con `verificar_envio`, igual que hace `cuadre.html`/`inventario.html`).

```bash
curl -s -L --ssl-no-revoke "$SCRIPT_URL" --data-urlencode "payload={\"action\":\"registrar_gasto_caja\",\"idEnvio\":\"env_test_gasto_1\",\"fecha\":\"$FECHA\",\"concepto\":\"PRUEBA-CLAUDE-CUADRE-gasto\",\"monto\":15000,\"registradoPor\":\"PRUEBA-CLAUDE-CUADRE\"}"
echo
curl -s -L --ssl-no-revoke "$SCRIPT_URL" --data-urlencode "payload={\"action\":\"registrar_pago_empleado_caja\",\"idEnvio\":\"env_test_pago_1\",\"fecha\":\"$FECHA\",\"empleado\":\"PRUEBA-CLAUDE-CUADRE-empleado\",\"monto\":30000,\"registradoPor\":\"PRUEBA-CLAUDE-CUADRE\"}"
echo
curl -s -L --ssl-no-revoke "$SCRIPT_URL" --data-urlencode "payload={\"action\":\"registrar_recogida_caja\",\"idEnvio\":\"env_test_recogida_1\",\"fecha\":\"$FECHA\",\"quien\":\"PRUEBA-CLAUDE-CUADRE-Jaime\",\"monto\":50000,\"registradoPor\":\"PRUEBA-CLAUDE-CUADRE\"}"
echo
curl -s -L --ssl-no-revoke "$SCRIPT_URL" --data-urlencode "payload={\"action\":\"registrar_dano\",\"idEnvio\":\"env_test_dano_1\",\"fecha\":\"$FECHA\",\"tipo\":\"Insumo\",\"nombre\":\"PRUEBA-CLAUDE-CUADRE-insumo\",\"cantidad\":2,\"motivo\":\"prueba\",\"registradoPor\":\"PRUEBA-CLAUDE-CUADRE\"}"
echo
sleep 3
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "action=listar_registros_dia_caja" --data-urlencode "fecha=$FECHA"
```
Expected: la última respuesta trae, dentro de `registros`, los 4 elementos de prueba recién creados (`gastos`, `pagos`, `recogidas`, `danos`) con los valores exactos enviados.

```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "action=resumen_dia_caja" --data-urlencode "fecha=$FECHA"
```
Expected: `totalGastos:15000`, `totalPagosEmpleados:30000`, `totalRecogidas:50000`, `baseApertura:100000`, y `nuevaBaseEsperada` = `ventaTotal + 100000 - 15000 - 30000 - 50000 - nequi - tarjeta` (con `ventaTotal`/`nequi`/`tarjeta` de las ventas reales del día, que pueden ser 0 si no se ha vendido nada todavía hoy).

```bash
curl -s -L --ssl-no-revoke "$SCRIPT_URL" --data-urlencode "payload={\"action\":\"cerrar_caja\",\"idEnvio\":\"env_test_cierre_1\",\"fecha\":\"$FECHA\",\"efectivoContado\":100000,\"cerradoPor\":\"PRUEBA-CLAUDE-CUADRE-cierre\"}"
echo
sleep 2
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "action=verificar_envio" --data-urlencode "id=env_test_cierre_1"
```
Expected: `{"ok":true,"confirmado":true}`. Abrir el Sheet de Inventario, hoja `Cuadre_Caja`, y confirmar a mano que la fila de hoy tiene `Faltante_Sobrante` = `100000 - nuevaBaseEsperada` (un número negativo si faltó, positivo si sobró).

- [ ] **Step 10: Verificar que el reporte de insumos sigue funcionando y ahora resta el daño de prueba**

```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "action=reporte_insumos" --data-urlencode "fecha=$FECHA"
```
Expected: `{"ok":true,"data":[...]}` sin errores (confirma que el ajuste del Step 2 no rompió `generarReporteInsumos`). Si `PRUEBA-CLAUDE-CUADRE-insumo` no existe en el catálogo real de `Insumos`, la fila de daño de prueba se ignora en silencio (mismo comportamiento ya documentado para nombres que no calzan) — esto es esperado y no es un error del código.

- [ ] **Step 11: Avisar al usuario que borre los datos de prueba**

Decirle al usuario que borre, en el Sheet de Inventario: la fila de hoy en `Cuadre_Caja` (o sus valores, si prefiere dejar la fila para el cuadre real del día), y las filas con `PRUEBA-CLAUDE-CUADRE...` en `Gastos_Caja`, `Pagos_Empleados_Caja`, `Recogidas_Caja` y `Gastos_JC`. No continuar a Task 2 hasta que confirme.

---

### Task 2: Frontend — esqueleto de `cuadre.html` y pestaña "Abrir caja"

**Files:**
- Create: `E:\Proyectos ZFood GyP\cuadre.html`

**Interfaces:**
- Consumes: `action=sugerir_base_apertura` (Task 1), `payload.action=abrir_caja` (Task 1)
- Produces: funciones globales `cambiarPestana(nombre)`, `mostrarToast(msg, tipo)`, `postToGoogleSheets(payload, onSuccess)`, `verifyTransactionReceipt(idEnvio, attempt, onOk, onFail)`, `fechaHoy()` — reutilizadas por Task 3 y Task 4.

- [ ] **Step 1: Crear `cuadre.html` con el esqueleto, estilos y la pestaña "Abrir caja"**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Donde el Gordo - Cuadre de Caja</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{font-family:'Segoe UI',sans-serif;background:#1a0a00;color:#fff;min-height:100vh;}

header{position:sticky;top:0;z-index:20;background:#1a0a00;border-bottom:1px solid rgba(200,132,26,0.3);padding:14px 18px;}
.header-titulo{font-size:1.2rem;font-weight:800;color:#c8841a;letter-spacing:1px;}
.header-sub{font-size:0.72rem;color:#e8c87a;letter-spacing:2px;}
.header-fecha{font-size:0.78rem;color:rgba(240,224,176,0.7);margin-top:4px;}

.tabs{display:flex;gap:8px;padding:14px 18px 0;flex-wrap:wrap;}
.btn-tab{padding:10px 16px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,132,26,0.35);color:#f0e0b0;font-size:0.85rem;font-weight:600;cursor:pointer;}
.btn-tab.activa{background:linear-gradient(135deg,#c8841a,#e8a832);color:#1a0a00;border-color:transparent;}

main{padding:18px;max-width:560px;margin:0 auto;}
.vista{display:none;flex-direction:column;gap:14px;}
.vista.activa{display:flex;}

.card{background:rgba(255,255,255,0.05);border:1px solid rgba(200,132,26,0.25);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px;}
.card h3{color:#c8841a;font-size:1rem;}
label{font-size:0.82rem;color:rgba(240,224,176,0.85);display:block;margin-bottom:4px;}
input,select{width:100%;padding:12px;border-radius:10px;border:1px solid rgba(200,132,26,0.35);background:rgba(255,255,255,0.06);color:#fff;font-size:0.95rem;}
.btn-primario{padding:14px;border-radius:10px;background:linear-gradient(135deg,#c8841a,#e8a832);border:none;color:#1a0a00;font-weight:800;font-size:0.95rem;cursor:pointer;}
.fila-dato{display:flex;justify-content:space-between;font-size:0.9rem;padding:6px 0;border-top:1px solid rgba(255,255,255,0.06);}
.fila-dato.total{font-weight:800;color:#e8a832;border-top:1px solid rgba(200,132,26,0.3);padding-top:10px;}

.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:10px;font-size:0.85rem;font-weight:600;z-index:100;display:none;}
.toast.ok{background:rgba(70,180,100,0.9);color:#fff;}
.toast.error{background:rgba(224,80,80,0.9);color:#fff;}
</style>
</head>
<body>

<header>
  <div class="header-titulo">DONDE EL GORDO</div>
  <div class="header-sub">CUADRE DE CAJA</div>
  <div class="header-fecha" id="header-fecha"></div>
</header>

<div class="tabs">
  <button class="btn-tab activa" id="btn-pestana-apertura" onclick="cambiarPestana('apertura')">Abrir caja</button>
  <button class="btn-tab" id="btn-pestana-dia" onclick="cambiarPestana('dia')">Durante el día</button>
  <button class="btn-tab" id="btn-pestana-cierre" onclick="cambiarPestana('cierre')">Cerrar caja</button>
</div>

<main>
  <div class="vista activa" id="vista-apertura">
    <div class="card">
      <h3>Base con la que arranca hoy</h3>
      <div id="apertura-sugerida" class="fila-dato">Cargando base sugerida...</div>
      <div>
        <label for="input-base-apertura">Confirmar o ajustar el valor</label>
        <input type="number" id="input-base-apertura" placeholder="0">
      </div>
      <button class="btn-primario" onclick="confirmarApertura()">Confirmar apertura</button>
    </div>
  </div>

  <div class="vista" id="vista-dia"></div>
  <div class="vista" id="vista-cierre"></div>
</main>

<div class="toast" id="toast"></div>

<script>
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzo45isSgsJoCJxyvBl81Eb9fMAMwsB3GS5IRwV9QxTgk7NLfj8BiE8j5CgeP6dWgb6/exec';

function fechaHoy() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatoCOP(v) { return '$' + Math.round(v).toLocaleString('es-CO'); }

document.getElementById('header-fecha').textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

function mostrarToast(msg, tipo) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + tipo;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function cambiarPestana(nombre) {
  ['apertura', 'dia', 'cierre'].forEach(n => {
    document.getElementById('vista-' + n).classList.toggle('activa', n === nombre);
    document.getElementById('btn-pestana-' + n).classList.toggle('activa', n === nombre);
  });
  if (nombre === 'dia') cargarRegistrosDia();
  if (nombre === 'cierre') cargarResumenCierre();
}

// --- Lectura: JSONP (mismo mecanismo ya usado por inventario.html) ---
function jsonpGet(accionYParams, callbackFn) {
  const callbackName = 'jsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  window[callbackName] = function (response) {
    delete window[callbackName];
    const scriptNode = document.getElementById(callbackName);
    if (scriptNode) scriptNode.remove();
    callbackFn(response);
  };
  const script = document.createElement('script');
  script.id = callbackName;
  script.src = SCRIPT_URL + '?' + accionYParams + '&callback=' + callbackName;
  script.onerror = () => { delete window[callbackName]; script.remove(); callbackFn(null); };
  document.body.appendChild(script);
}

// --- Escritura: formulario oculto + iframe + verificación por JSONP (mismo mecanismo
// ya usado por inventario.html para evitar el límite de CORS en doPost) ---
function postToGoogleSheets(payload, onSuccess, onFail) {
  const idEnvio = payload.idEnvio;
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = SCRIPT_URL;
  const iframeName = 'iframe_' + Date.now();
  const iframe = document.createElement('iframe');
  iframe.name = iframeName;
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
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

  setTimeout(() => {
    verifyTransactionReceipt(idEnvio, 0, () => {
      document.body.removeChild(iframe);
      onSuccess();
    }, () => {
      document.body.removeChild(iframe);
      if (onFail) onFail(); else mostrarToast('Error de conexión. Inténtalo de nuevo.', 'error');
    });
  }, 1500);
}

function verifyTransactionReceipt(idEnvio, attempt, onOk, onFail) {
  const callbackName = 'jsonpVerify_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  window[callbackName] = function (response) {
    delete window[callbackName];
    const scriptNode = document.getElementById(callbackName);
    if (scriptNode) scriptNode.remove();
    if (response && response.ok && response.confirmado) {
      onOk();
    } else if (attempt >= 6) {
      onFail();
    } else {
      setTimeout(() => verifyTransactionReceipt(idEnvio, attempt + 1, onOk, onFail), 1500);
    }
  };
  const script = document.createElement('script');
  script.id = callbackName;
  script.src = SCRIPT_URL + '?action=verificar_envio&id=' + encodeURIComponent(idEnvio) + '&callback=' + callbackName;
  script.onerror = () => {
    delete window[callbackName];
    script.remove();
    if (attempt >= 6) onFail(); else setTimeout(() => verifyTransactionReceipt(idEnvio, attempt + 1, onOk, onFail), 2000);
  };
  document.body.appendChild(script);
}

// --- Pestaña "Abrir caja" ---
function cargarBaseSugerida() {
  jsonpGet('action=sugerir_base_apertura&fecha=' + fechaHoy(), function (res) {
    const sugerida = (res && res.ok) ? res.baseSugerida : 0;
    document.getElementById('apertura-sugerida').textContent = 'Sugerida (efectivo contado ayer): ' + formatoCOP(sugerida);
    document.getElementById('input-base-apertura').value = sugerida;
  });
}

function confirmarApertura() {
  const base = parseFloat(document.getElementById('input-base-apertura').value) || 0;
  const idEnvio = 'env_' + Date.now();
  postToGoogleSheets({ action: 'abrir_caja', idEnvio: idEnvio, fecha: fechaHoy(), baseApertura: base, abiertoPor: '' }, function () {
    mostrarToast('Caja abierta con base ' + formatoCOP(base), 'ok');
  });
}

cargarBaseSugerida();
</script>
</body>
</html>
```

- [ ] **Step 2: Verificación manual — apertura contra el backend real**

1. Servir `cuadre.html` por HTTP (mismo hosting/servidor local que se use para `caja.html`/`inventario.html` — no doble clic, JSONP y el iframe-POST necesitan HTTP).
2. Abrir en el navegador, confirmar que la pestaña "Abrir caja" muestra "Sugerida (efectivo contado ayer): $0" si nunca se ha cerrado caja antes (o el valor real si ya existe una fila de ayer en `Cuadre_Caja`).
3. Cambiar el valor a `120000` y hacer clic en "Confirmar apertura".
4. Confirmar que aparece el toast verde "Caja abierta con base $120.000".
5. Verificar contra el Sheet real: en `Cuadre_Caja`, debe existir una fila con la fecha de hoy y `Base_Apertura = 120000`.
6. Avisar al usuario que borre/ajuste esa fila de prueba si no corresponde a una apertura real del día.

---

### Task 3: Frontend — pestaña "Durante el día" (gasto / pago a empleado / recogida / daño)

**Files:**
- Modify: `E:\Proyectos ZFood GyP\cuadre.html` (de Task 2)

**Interfaces:**
- Consumes: `action=listar_empleados`, `action=listar_insumos`, `action=get_productos`, `action=listar_registros_dia_caja` (Task 1); `postToGoogleSheets`, `jsonpGet`, `fechaHoy`, `formatoCOP`, `mostrarToast` (Task 2)
- Produces: `cargarRegistrosDia()` (invocada por `cambiarPestana('dia')` en Task 2), `registrarGasto()`, `registrarPagoEmpleado()`, `registrarRecogida()`, `registrarDano()`

- [ ] **Step 1: Agregar el HTML de los 4 formularios dentro de `vista-dia`**

Buscar:
```html
  <div class="vista" id="vista-dia"></div>
```
Reemplazar por:
```html
  <div class="vista" id="vista-dia">
    <div class="card">
      <h3>Gasto (compra)</h3>
      <div>
        <label for="input-gasto-concepto">¿Qué se compró / dónde?</label>
        <input type="text" id="input-gasto-concepto" placeholder="Ej: Verduras - Plaza de mercado">
      </div>
      <div>
        <label for="input-gasto-monto">Valor</label>
        <input type="number" id="input-gasto-monto" placeholder="0">
      </div>
      <button class="btn-primario" onclick="registrarGasto()">Registrar gasto</button>
    </div>

    <div class="card">
      <h3>Pago a empleado</h3>
      <div>
        <label for="select-pago-empleado">Empleado</label>
        <select id="select-pago-empleado"><option value="">Cargando...</option></select>
      </div>
      <div>
        <label for="input-pago-monto">Valor</label>
        <input type="number" id="input-pago-monto" placeholder="0">
      </div>
      <button class="btn-primario" onclick="registrarPagoEmpleado()">Registrar pago</button>
    </div>

    <div class="card">
      <h3>Recogida parcial</h3>
      <div>
        <label for="input-recogida-quien">¿Quién recogió?</label>
        <input type="text" id="input-recogida-quien" placeholder="Ej: Jaime">
      </div>
      <div>
        <label for="input-recogida-monto">Valor</label>
        <input type="number" id="input-recogida-monto" placeholder="0">
      </div>
      <button class="btn-primario" onclick="registrarRecogida()">Registrar recogida</button>
    </div>

    <div class="card">
      <h3>Daño / sobrante</h3>
      <div>
        <label for="select-dano-tipo">Tipo</label>
        <select id="select-dano-tipo" onchange="cambiarTipoDano()">
          <option value="Producto">Producto terminado (ej. porción de pizza sobrante)</option>
          <option value="Insumo">Insumo crudo (ej. carne, pan)</option>
        </select>
      </div>
      <div>
        <label for="select-dano-nombre">Nombre</label>
        <select id="select-dano-nombre"><option value="">Cargando...</option></select>
      </div>
      <div>
        <label for="input-dano-cantidad">Cantidad</label>
        <input type="number" id="input-dano-cantidad" placeholder="0">
      </div>
      <div>
        <label for="input-dano-motivo">Motivo</label>
        <input type="text" id="input-dano-motivo" placeholder="Ej: Se quemó / Sobró al cierre">
      </div>
      <button class="btn-primario" onclick="registrarDano()">Registrar daño</button>
    </div>

    <div class="card">
      <h3>Ya registrado hoy</h3>
      <div id="lista-registros-dia">Cargando...</div>
    </div>
  </div>
```

- [ ] **Step 2: Agregar el JS de carga de catálogos (empleados, productos, insumos) y de los 4 registros**

Buscar:
```javascript
cargarBaseSugerida();
```
Reemplazar por:
```javascript
let CATALOGO_PRODUCTOS = [];
let CATALOGO_INSUMOS = [];

function cargarEmpleadosSelect() {
  jsonpGet('action=listar_empleados', function (res) {
    const empleados = (res && res.ok && Array.isArray(res.empleados)) ? res.empleados : [];
    const el = document.getElementById('select-pago-empleado');
    el.innerHTML = empleados.length
      ? empleados.map(e => `<option value="${e.nombre.replace(/"/g, '&quot;')}">${e.nombre}</option>`).join('')
      : '<option value="">-- Sin catálogo, escribir a mano --</option>';
  });
}

function cargarCatalogosDano() {
  jsonpGet('action=get_productos', function (res) {
    CATALOGO_PRODUCTOS = (res && res.ok && Array.isArray(res.data)) ? res.data : [];
    if (document.getElementById('select-dano-tipo').value === 'Producto') renderOpcionesDano();
  });
  jsonpGet('action=listar_insumos', function (res) {
    CATALOGO_INSUMOS = (res && res.ok && Array.isArray(res.insumos)) ? res.insumos : [];
    if (document.getElementById('select-dano-tipo').value === 'Insumo') renderOpcionesDano();
  });
}

function renderOpcionesDano() {
  const tipo = document.getElementById('select-dano-tipo').value;
  const lista = tipo === 'Insumo' ? CATALOGO_INSUMOS : CATALOGO_PRODUCTOS;
  const el = document.getElementById('select-dano-nombre');
  el.innerHTML = lista.map(item => `<option value="${item.nombre.replace(/"/g, '&quot;')}">${item.nombre}</option>`).join('') || '<option value="">-- Sin catálogo --</option>';
}

function cambiarTipoDano() { renderOpcionesDano(); }

function registrarGasto() {
  const concepto = document.getElementById('input-gasto-concepto').value.trim();
  const monto = parseFloat(document.getElementById('input-gasto-monto').value) || 0;
  if (!concepto || !monto) { mostrarToast('Falta el concepto o el valor', 'error'); return; }
  postToGoogleSheets({ action: 'registrar_gasto_caja', idEnvio: 'env_' + Date.now(), fecha: fechaHoy(), concepto: concepto, monto: monto, registradoPor: '' }, function () {
    mostrarToast('Gasto registrado: ' + formatoCOP(monto), 'ok');
    document.getElementById('input-gasto-concepto').value = '';
    document.getElementById('input-gasto-monto').value = '';
    cargarRegistrosDia();
  });
}

function registrarPagoEmpleado() {
  const empleado = document.getElementById('select-pago-empleado').value;
  const monto = parseFloat(document.getElementById('input-pago-monto').value) || 0;
  if (!empleado || !monto) { mostrarToast('Falta el empleado o el valor', 'error'); return; }
  postToGoogleSheets({ action: 'registrar_pago_empleado_caja', idEnvio: 'env_' + Date.now(), fecha: fechaHoy(), empleado: empleado, monto: monto, registradoPor: '' }, function () {
    mostrarToast('Pago registrado: ' + formatoCOP(monto), 'ok');
    document.getElementById('input-pago-monto').value = '';
    cargarRegistrosDia();
  });
}

function registrarRecogida() {
  const quien = document.getElementById('input-recogida-quien').value.trim();
  const monto = parseFloat(document.getElementById('input-recogida-monto').value) || 0;
  if (!quien || !monto) { mostrarToast('Falta quién recogió o el valor', 'error'); return; }
  postToGoogleSheets({ action: 'registrar_recogida_caja', idEnvio: 'env_' + Date.now(), fecha: fechaHoy(), quien: quien, monto: monto, registradoPor: '' }, function () {
    mostrarToast('Recogida registrada: ' + formatoCOP(monto), 'ok');
    document.getElementById('input-recogida-quien').value = '';
    document.getElementById('input-recogida-monto').value = '';
    cargarRegistrosDia();
  });
}

function registrarDano() {
  const tipo = document.getElementById('select-dano-tipo').value;
  const nombre = document.getElementById('select-dano-nombre').value;
  const cantidad = parseFloat(document.getElementById('input-dano-cantidad').value) || 0;
  const motivo = document.getElementById('input-dano-motivo').value.trim();
  if (!nombre || !cantidad) { mostrarToast('Falta el nombre o la cantidad', 'error'); return; }
  postToGoogleSheets({ action: 'registrar_dano', idEnvio: 'env_' + Date.now(), fecha: fechaHoy(), tipo: tipo, nombre: nombre, cantidad: cantidad, motivo: motivo, registradoPor: '' }, function () {
    mostrarToast('Daño registrado: ' + cantidad + ' x ' + nombre, 'ok');
    document.getElementById('input-dano-cantidad').value = '';
    document.getElementById('input-dano-motivo').value = '';
    cargarRegistrosDia();
  });
}

function cargarRegistrosDia() {
  jsonpGet('action=listar_registros_dia_caja&fecha=' + fechaHoy(), function (res) {
    const el = document.getElementById('lista-registros-dia');
    if (!res || !res.ok) { el.textContent = 'No se pudo cargar.'; return; }
    const r = res.registros;
    const filas = []
      .concat(r.gastos.map(g => `Gasto: ${g.concepto} — ${formatoCOP(g.monto)}`))
      .concat(r.pagos.map(p => `Pago: ${p.empleado} — ${formatoCOP(p.monto)}`))
      .concat(r.recogidas.map(c => `Recogida: ${c.quien} — ${formatoCOP(c.monto)}`))
      .concat(r.danos.map(d => `Daño (${d.tipo}): ${d.cantidad} x ${d.nombre}${d.motivo ? ' — ' + d.motivo : ''}`));
    el.innerHTML = filas.length ? filas.map(f => `<div class="fila-dato">${f}</div>`).join('') : 'Nada registrado todavía hoy.';
  });
}

cargarEmpleadosSelect();
cargarCatalogosDano();
renderOpcionesDano();
cargarBaseSugerida();
```

- [ ] **Step 2: Verificación manual con datos reales**

1. Abrir `cuadre.html` por HTTP, ir a la pestaña "Durante el día".
2. Confirmar que el selector de empleado carga el catálogo real (o cae a "-- Sin catálogo --" si el Módulo 10 todavía no está desplegado — no debe romper la pantalla).
3. Registrar un gasto de prueba (`PRUEBA-CLAUDE-CUADRE-gasto2`, $9.000) y confirmar que aparece de inmediato en "Ya registrado hoy".
4. Cambiar el tipo de daño a "Insumo", confirmar que el selector de nombre cambia al catálogo de insumos; registrar un daño de prueba.
5. Verificar contra el backend real:
```bash
curl -s -L --ssl-no-revoke -G "$SCRIPT_URL" --data-urlencode "action=listar_registros_dia_caja" --data-urlencode "fecha=$(date +%F)"
```
Expected: el gasto y el daño de prueba aparecen con los valores exactos.
6. Avisar al usuario que borre las filas de prueba (`Gastos_Caja`, `Gastos_JC`) al terminar.

---

### Task 4: Frontend — pestaña "Cerrar caja"

**Files:**
- Modify: `E:\Proyectos ZFood GyP\cuadre.html` (de Tasks 2 y 3)

**Interfaces:**
- Consumes: `action=resumen_dia_caja` (Task 1), `postToGoogleSheets`/`jsonpGet`/`fechaHoy`/`formatoCOP`/`mostrarToast` (Task 2)
- Produces: `cargarResumenCierre()` (invocada por `cambiarPestana('cierre')` en Task 2), `confirmarCierre()`

- [ ] **Step 1: Agregar el HTML de la pestaña "Cerrar caja"**

Buscar:
```html
  <div class="vista" id="vista-cierre"></div>
```
Reemplazar por:
```html
  <div class="vista" id="vista-cierre">
    <div class="card">
      <h3>Resumen del día</h3>
      <div id="resumen-cierre">Cargando...</div>
      <div>
        <label for="input-efectivo-contado">Efectivo contado físicamente</label>
        <input type="number" id="input-efectivo-contado" placeholder="0">
      </div>
      <div id="resultado-cuadre"></div>
      <button class="btn-primario" onclick="confirmarCierre()">Cerrar caja</button>
    </div>
  </div>
```

- [ ] **Step 2: Agregar el JS del resumen y del cierre**

Buscar:
```javascript
cargarEmpleadosSelect();
cargarCatalogosDano();
renderOpcionesDano();
cargarBaseSugerida();
```
Reemplazar por:
```javascript
cargarEmpleadosSelect();
cargarCatalogosDano();
renderOpcionesDano();
cargarBaseSugerida();

let ULTIMO_RESUMEN = null;

function cargarResumenCierre() {
  jsonpGet('action=resumen_dia_caja&fecha=' + fechaHoy(), function (res) {
    const el = document.getElementById('resumen-cierre');
    if (!res || !res.ok) { el.textContent = 'No se pudo cargar el resumen.'; return; }
    ULTIMO_RESUMEN = res.resumen;
    const r = ULTIMO_RESUMEN;
    el.innerHTML = `
      <div class="fila-dato"><span>Venta total</span><span>${formatoCOP(r.ventaTotal)}</span></div>
      <div class="fila-dato"><span>Base de apertura</span><span>${formatoCOP(r.baseApertura)}</span></div>
      <div class="fila-dato"><span>- Gastos</span><span>${formatoCOP(r.totalGastos)}</span></div>
      <div class="fila-dato"><span>- Pagos a empleados</span><span>${formatoCOP(r.totalPagosEmpleados)}</span></div>
      <div class="fila-dato"><span>- Recogidas</span><span>${formatoCOP(r.totalRecogidas)}</span></div>
      <div class="fila-dato"><span>- Nequi</span><span>${formatoCOP(r.nequi)}</span></div>
      <div class="fila-dato"><span>- Tarjeta</span><span>${formatoCOP(r.tarjeta)}</span></div>
      <div class="fila-dato total"><span>Nueva base esperada</span><span>${formatoCOP(r.nuevaBaseEsperada)}</span></div>
    `;
    calcularFaltanteSobrante();
  });
}

function calcularFaltanteSobrante() {
  if (!ULTIMO_RESUMEN) return;
  const contado = parseFloat(document.getElementById('input-efectivo-contado').value) || 0;
  const diferencia = Math.round((contado - ULTIMO_RESUMEN.nuevaBaseEsperada) * 100) / 100;
  const el = document.getElementById('resultado-cuadre');
  if (!document.getElementById('input-efectivo-contado').value) { el.innerHTML = ''; return; }
  const etiqueta = diferencia === 0 ? 'CUADRA EXACTO' : (diferencia > 0 ? 'SOBRÓ ' + formatoCOP(diferencia) : 'FALTÓ ' + formatoCOP(Math.abs(diferencia)));
  el.innerHTML = `<div class="fila-dato total"><span>${etiqueta}</span></div>`;
}

document.getElementById('input-efectivo-contado').addEventListener('input', calcularFaltanteSobrante);

function confirmarCierre() {
  const contado = parseFloat(document.getElementById('input-efectivo-contado').value) || 0;
  postToGoogleSheets({ action: 'cerrar_caja', idEnvio: 'env_' + Date.now(), fecha: fechaHoy(), efectivoContado: contado, cerradoPor: '' }, function () {
    mostrarToast('Caja cerrada. Efectivo contado: ' + formatoCOP(contado), 'ok');
    cargarResumenCierre();
  });
}
```

- [ ] **Step 3: Verificación manual de punta a punta**

1. Con el gasto/pago/recogida/daño de prueba de la Task 3 todavía en el Sheet (o crear nuevos: gasto $10.000, pago $20.000, recogida $30.000), ir a la pestaña "Cerrar caja".
2. Confirmar que el resumen muestra los mismos montos ya registrados y una "Nueva base esperada" coherente con la fórmula.
3. Escribir un efectivo contado que sea exactamente igual a la nueva base esperada → confirmar que aparece "CUADRA EXACTO".
4. Cambiar el efectivo contado a un valor $5.000 menor → confirmar que aparece "FALTÓ $5.000".
5. Hacer clic en "Cerrar caja" y confirmar el toast de éxito.
6. Verificar contra el Sheet real: la fila de hoy en `Cuadre_Caja` tiene todos los campos llenos y `Faltante_Sobrante = -5000`.
7. Avisar al usuario que borre/ajuste todos los datos de prueba de esta ronda (`Gastos_Caja`, `Pagos_Empleados_Caja`, `Recogidas_Caja`, `Gastos_JC`, la fila de `Cuadre_Caja` de hoy) antes de usar la pantalla en producción.

---

### Task 5: Documentación del proyecto

**Files:**
- Modify: `E:\Proyectos ZFood GyP\Gestion_Proyecto\03-seguimiento\ESTADO.md`
- Modify: `E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-11-cuadre-caja.md`

- [ ] **Step 1: Actualizar la fila del Módulo 11 en la tabla de `ESTADO.md`**

Cambiar la fila:
```
| 11. Cuadre de Caja | **Diseño cerrado — 2026-07-30** | Reemplaza el cuadre físico en libro: gastos/pagos a empleados/recogidas parciales registrados uno por uno durante el día, Venta total/Nequi/Tarjeta calculados solos desde `Ventas`, fórmula de cuadre con base del día anterior, y faltante/sobrante contra el efectivo contado. Los daños/sobrantes (producto vía receta, o insumo crudo directo) se descuentan automáticamente del reporte de inventario (Módulo 5). Vive en el proyecto de Apps Script de Inventario (no en el del Menú). Ver `modulo-11-cuadre-caja.md`. Próximo paso: plan de implementación. |
```
por:
```
| 11. Cuadre de Caja | **Construido y verificado en vivo — <FECHA>** | `cuadre.html`: pestañas Abrir caja / Durante el día / Cerrar caja. Backend en el proyecto de Apps Script de Inventario (`listar_insumos`, `resumen_dia_caja`, `sugerir_base_apertura`, `listar_registros_dia_caja`, `registrar_gasto_caja`, `registrar_pago_empleado_caja`, `registrar_recogida_caja`, `registrar_dano`, `abrir_caja`, `cerrar_caja`), verificado con curl de punta a punta. `Gastos_JC` ahora distingue daño de Producto (vía receta) vs. Insumo crudo (directo), reflejado en el reporte de inventario (Módulo 5). Falta: publicar `cuadre.html` en el hosting real, uso real por el cajero durante unos días para confirmar que el faltante/sobrante calculado coincide con lo que el equipo ya sabe por el libro físico. |
```
(reemplazar `<FECHA>` por la fecha real en que se complete este plan)

- [ ] **Step 2: Agregar una entrada a `ESTADO.md` con el resultado de la verificación en vivo**

Agregar, en la sección de pruebas en vivo (mismo formato que las entradas existentes de otros módulos), un párrafo describiendo: qué acciones se probaron por curl (Task 1 Steps 8-10), qué se probó a mano en el navegador (Tasks 2-4), y confirmación de que los datos de prueba (`PRUEBA-CLAUDE-CUADRE-...`) se limpiaron.

- [ ] **Step 3: Marcar el diseño como implementado en `modulo-11-cuadre-caja.md`**

Agregar una línea al principio del archivo (después del encabezado existente) indicando que el plan de `modulo-11-plan-implementacion.md` fue ejecutado y en qué fecha, y actualizar la sección "Qué falta" para reflejar que la pregunta sobre corregir un cierre ya hecho quedó resuelta (`cerrar_caja` sobrescribe la fila del día si se vuelve a llamar), dejando solo lo que realmente sigue pendiente (publicar en hosting, uso real de prueba).

- [ ] **Step 4: Commit**

```bash
cd "E:\Proyectos ZFood GyP"
git add cuadre.html Gestion_Proyecto/03-seguimiento/ESTADO.md Gestion_Proyecto/01-modulos/modulo-11-cuadre-caja.md
git commit -m "Construir Módulo 11 (Cuadre de Caja): cuadre.html + backend en Apps Script de Inventario"
```

---

## Self-Review (completado durante la escritura de este plan)

- **Cobertura del spec**: las 6 reglas de negocio del diseño están cubiertas — un cuadre por día (`Cuadre_Caja` una fila por fecha, Task 1), Venta total/Nequi/Tarjeta automáticos (`calcularResumenCaja_`, Task 1), gastos/pagos registrados uno por uno (Task 3), recogidas múltiples por día (suma por fecha, no un solo campo, Task 1+3), los dos tipos de daño con receta vs. directo (Step 2 de Task 1, formulario con selector de tipo en Task 3), y base del día siguiente = efectivo contado real pero confirmable/ajustable al abrir (`sugerir_base_apertura` + campo editable en Task 2).
- **Placeholders**: ninguno — todo el código de cada paso es el contenido real a pegar/reemplazar, sin "TODO" ni "implementar después". El único `<FECHA>` (Task 5) es intencional, a rellenar por quien ejecute el plan, igual que en `modulo-9-plan-implementacion.md`.
- **Consistencia de tipos/nombres**: `resumen.nuevaBaseEsperada` (backend, camelCase en JSON) se usa igual en Task 2/3/4; `registros.gastos/pagos/recogidas/danos` consistente entre `listarRegistrosDiaCaja_` (Task 1) y `cargarRegistrosDia()` (Task 3); `tipo: 'Producto'|'Insumo'` consistente entre el formulario de daño (Task 3), `registrar_dano` (Task 1) y la columna `Tipo` de `Gastos_JC` leída por `generarReporteInsumos` (Task 1 Step 2) — mismos dos valores literales en los 3 lugares.
