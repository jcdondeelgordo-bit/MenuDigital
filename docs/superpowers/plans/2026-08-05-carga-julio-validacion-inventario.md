# Carga de Julio 2026 y Validación de Inventario — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cargar los 31 días reales de julio 2026 (Ventas, Ingresos, Conteo de cierre, Gastos J/C) al
Sheet productivo de Inventario vía su Apps Script, validar que `reporte_insumos` calcula lo mismo que
el archivo de referencia del usuario, y hacer una prueba en vivo mínima de Domicilio/Venta Rápida hoy.

**Architecture:** Scripts Node.js de un solo uso, fuera de la app (no tocan `api/` ni el frontend),
que hablan por HTTP con los Apps Script ya desplegados (Inventario directo, Menú Digital vía
`/api/proxy-menu` en producción). Sin cambios de backend: se reutilizan `guardar_ventas`,
`guardar_ingreso`, `guardar_inventario_completo`, `registrar_dano` y `reporte_insumos`, todos ya en
producción.

**Tech Stack:** Node.js 24 (fetch y ESM nativos), paquete `xlsx` (SheetJS) para leer el archivo de
referencia. Sin framework de test — assertions con `node:assert`.

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-05-carga-julio-validacion-inventario-design.md`
  (ya actualizado con las 2 correcciones encontradas al planear — sin cambios de backend en ningún
  entregable).
- SCRIPT_URL de Inventario (backend real, acepta fecha arbitraria):
  `https://script.google.com/macros/s/AKfycbzo45isSgsJoCJxyvBl81Eb9fMAMwsB3GS5IRwV9QxTgk7NLfj8BiE8j5CgeP6dWgb6/exec`
- Base de producción del Menú Digital (Entregable 2, solo acciones públicas):
  `https://donde-el-gordo.vercel.app/api/proxy-menu` — parámetro de acción es `accion` (español), no
  `action`.
- Archivo de referencia: `E:\Proyectos ZFood GyP\PRUEBA\Ventas_Inventario_Julio2026.xlsx`, hojas
  `Ventas` (1499 filas, encabezados `FECHA,CODIGO,PRODUCTO,CANTIDAD`) e `Inventario` (1829 filas,
  encabezados `FECHA,INSUMO,GASTOS DEL DIA,HABIA AYER,INGRESO,J/C,DEBE HABER,EXISTE REAL`). Fechas
  como número de serie de Excel (época 1899-12-30).
- Mapeo de nombres de insumo (confirmado con el usuario): `QUESO` → `QUESO PIZZA`,
  `COLA Y POLA 330` → `COLA Y POLA LATA`, `PIZZAS` se excluye por completo (cálculo propio del
  usuario, no es un insumo del sistema).
- Todo texto "quién registró" que escriban los scripts usa literalmente `Carga histórica Julio 2026
  (script)`, para poder identificar estas filas en el Sheet más adelante.
- Se escribe directo en el Sheet productivo — no hay ambiente de pruebas separado. Por eso el dry-run
  (Tarea 5) es obligatorio antes de la carga real (Tarea 6).
- Idempotencia: `guardar_ventas` ya borra-y-reescribe por fecha (se puede reenviar sin duplicar).
  `guardar_ingreso`, `guardar_inventario_completo` y `registrar_dano` son de solo-append — se protegen
  con la acción ya existente `verificar_envio` (por `idEnvio` determinístico) antes de cada envío, no
  hace falta agregar nada nuevo al backend.
- Esta carga cierra dejando la pestaña `Reporte` del Sheet mostrando el 31 de julio — decisión ya
  tomada por el usuario, no se regenera para hoy al terminar.

---

## Entregable 1 — Carga histórica de julio + validación de inventario

### Task 1: Entorno del script de carga

**Files:**
- Create: `scripts/carga-julio-2026/package.json`
- Create: `scripts/carga-julio-2026/config.js`

**Interfaces:**
- Produces: `SCRIPT_URL`, `MARCA_CARGA`, `MOTIVO_JC` (constantes exportadas desde `config.js`),
  usadas por todas las tareas siguientes.

- [ ] **Step 1: Crear `package.json` propio (aislado del `package.json` raíz del proyecto Vercel)**

```json
{
  "name": "carga-julio-2026",
  "private": true,
  "type": "module",
  "dependencies": {
    "xlsx": "^0.18.5"
  }
}
```

- [ ] **Step 2: Instalar dependencias**

Run: `cd "E:/Proyectos ZFood GyP/scripts/carga-julio-2026" && npm install`
Expected: se crea `node_modules/` dentro de esa carpeta (ya cubierto por el `.gitignore` raíz,
que ignora `node_modules/` en cualquier nivel).

- [ ] **Step 3: Crear `config.js`**

```js
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzo45isSgsJoCJxyvBl81Eb9fMAMwsB3GS5IRwV9QxTgk7NLfj8BiE8j5CgeP6dWgb6/exec';
export const MARCA_CARGA = 'Carga histórica Julio 2026 (script)';
export const MOTIVO_JC = 'Carga histórica desde archivo Excel (J/C julio 2026)';

export function normalizar(s) {
  return (s || '').toString().toUpperCase().trim().replace(/\s+/g, ' ');
}
```

- [ ] **Step 4: Verificar que el módulo carga sin errores**

Run: `cd "E:/Proyectos ZFood GyP/scripts/carga-julio-2026" && node -e "import('./config.js').then(m => console.log(m.SCRIPT_URL, m.normalizar('  hola   Mundo ')))"`
Expected: imprime la URL y `HOLA MUNDO`.

- [ ] **Step 5: Commit**

```bash
git add scripts/carga-julio-2026/package.json scripts/carga-julio-2026/config.js scripts/carga-julio-2026/package-lock.json
git commit -m "chore: scaffolding del script de carga de julio 2026"
```

---

### Task 2: Parser del archivo Excel de referencia

**Files:**
- Create: `scripts/carga-julio-2026/leer-excel.js`

**Interfaces:**
- Consumes: ninguno (lee directo el `.xlsx`).
- Produces: archivo `scripts/carga-julio-2026/datos-julio.json` con forma
  `{ [fecha: 'YYYY-MM-DD']: { ventas: [{codigo, producto, cantidad}], inventario: [{insumo,
  gastosDelDia, habiaAyer, ingreso, jc, debeHaber, existeReal}] } }`, usado por las Tareas 3, 5 y 7.

- [ ] **Step 1: Escribir `leer-excel.js`**

```js
import xlsx from 'xlsx';
import { writeFileSync } from 'node:fs';

const RUTA_EXCEL = 'E:/Proyectos ZFood GyP/PRUEBA/Ventas_Inventario_Julio2026.xlsx';

const MAPEO_INSUMOS = {
  'QUESO': 'QUESO PIZZA',
  'COLA Y POLA 330': 'COLA Y POLA LATA'
};
const INSUMOS_EXCLUIDOS = new Set(['PIZZAS']);

function excelSerialToISO(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return d.toISOString().substring(0, 10);
}

function leerHoja(wb, nombre) {
  const ws = wb.Sheets[nombre];
  if (!ws) throw new Error(`No existe la hoja "${nombre}"`);
  const filas = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });
  const encabezados = filas[0].map(h => (h || '').toString().trim().toUpperCase());
  return filas.slice(1)
    .filter(f => f.length && f[0] != null)
    .map(fila => {
      const obj = {};
      encabezados.forEach((h, i) => { obj[h] = fila[i]; });
      return obj;
    });
}

function assertEqual(actual, esperado, etiqueta) {
  if (actual !== esperado) throw new Error(`${etiqueta}: esperado ${esperado}, obtenido ${actual}`);
  console.log(`OK — ${etiqueta}: ${actual}`);
}

function main() {
  const wb = xlsx.readFile(RUTA_EXCEL);
  const ventasFilas = leerHoja(wb, 'Ventas');
  const inventarioFilas = leerHoja(wb, 'Inventario');

  const fechasVentas = [...new Set(ventasFilas.map(f => excelSerialToISO(f['FECHA'])))].sort();
  const fechasInventario = [...new Set(inventarioFilas.map(f => excelSerialToISO(f['FECHA'])))].sort();

  assertEqual(ventasFilas.length, 1499, 'Total de filas de Ventas');
  assertEqual(inventarioFilas.length, 1829, 'Total de filas de Inventario');
  assertEqual(fechasVentas.length, 31, 'Días distintos en Ventas');
  assertEqual(fechasInventario.length, 31, 'Días distintos en Inventario');
  assertEqual(fechasVentas[0], '2026-07-01', 'Primer día de Ventas');
  assertEqual(fechasVentas[30], '2026-07-31', 'Último día de Ventas');

  const dias = {};
  fechasVentas.forEach(fecha => { dias[fecha] = { ventas: [], inventario: [] }; });

  ventasFilas.forEach(f => {
    const fecha = excelSerialToISO(f['FECHA']);
    dias[fecha].ventas.push({
      codigo: String(f['CODIGO']).trim(),
      producto: (f['PRODUCTO'] || '').toString().trim(),
      cantidad: Number(f['CANTIDAD']) || 0
    });
  });

  let excluidos = 0;
  let remapeados = 0;
  inventarioFilas.forEach(f => {
    const fecha = excelSerialToISO(f['FECHA']);
    let insumo = (f['INSUMO'] || '').toString().trim();
    if (INSUMOS_EXCLUIDOS.has(insumo)) { excluidos++; return; }
    if (MAPEO_INSUMOS[insumo]) { insumo = MAPEO_INSUMOS[insumo]; remapeados++; }
    if (!dias[fecha]) throw new Error(`Fecha de Inventario fuera de julio: ${fecha}`);
    dias[fecha].inventario.push({
      insumo,
      gastosDelDia: Number(f['GASTOS DEL DIA']) || 0,
      habiaAyer: Number(f['HABIA AYER']) || 0,
      ingreso: Number(f['INGRESO']) || 0,
      jc: Number(f['J/C']) || 0,
      debeHaber: Number(f['DEBE HABER']) || 0,
      existeReal: Number(f['EXISTE REAL']) || 0
    });
  });

  assertEqual(excluidos, 1, 'Filas excluidas (PIZZAS, es 1 fila por día = 31, revisar si difiere)') ;
  console.log(`Insumos remapeados (QUESO/COLA Y POLA 330): ${remapeados} filas`);

  writeFileSync(new URL('./datos-julio.json', import.meta.url), JSON.stringify(dias, null, 2));
  console.log('Escrito datos-julio.json con', fechasVentas.length, 'días.');
}

main();
```

  Nota sobre el Step de abajo: la assertion de `excluidos` asume 1 fila de PIZZAS por día (31 en
  total, un valor por día). Si el conteo real difiere, el mensaje de error lo dirá exacto — ajustar el
  número esperado en el código a lo que se observe y seguir (no es un error del script, es calibrar la
  assertion al dato real).

- [ ] **Step 2: Ejecutar y corregir la assertion de PIZZAS si hace falta**

Run: `cd "E:/Proyectos ZFood GyP/scripts/carga-julio-2026" && node leer-excel.js`
Expected: todas las líneas `OK — ...` se imprimen sin lanzar excepción, termina con
`Escrito datos-julio.json con 31 días.` Si la assertion de "Filas excluidas" falla, cambiar el `1` por
el número real que muestre el mensaje de error y volver a correr.

- [ ] **Step 3: Revisar a ojo el JSON generado**

Run: `node -e "const d = JSON.parse(require('fs').readFileSync('scripts/carga-julio-2026/datos-julio.json')); console.log(Object.keys(d).length, 'días'); console.log(d['2026-07-01'].ventas.length, 'ventas el 1 de julio'); console.log(d['2026-07-01'].inventario.length, 'insumos el 1 de julio'); console.log(d['2026-07-01'].inventario.find(i => i.insumo === 'QUESO PIZZA'));"`
Expected: 31 días, conteos de ventas/inventario razonables (decenas de ventas, ~57-58 insumos por día
tras excluir PIZZAS), y el insumo `QUESO PIZZA` sí aparece (confirma que el remapeo de `QUESO`
funcionó).

- [ ] **Step 4: Commit**

```bash
git add scripts/carga-julio-2026/leer-excel.js
git commit -m "feat: parser del Excel de referencia de julio 2026"
```

(No se commitea `datos-julio.json` ni `node_modules/` — son artefactos generados/instalados,
reproducibles corriendo el script; conviene añadir `scripts/carga-julio-2026/*.json` menos
`package*.json` al `.gitignore` si se quiere evitar que `git status` los muestre como untracked.)

- [ ] **Step 5: Agregar los artefactos generados al `.gitignore` raíz**

En `E:\Proyectos ZFood GyP\.gitignore`, agregar al final:

```
scripts/carga-julio-2026/node_modules/
scripts/carga-julio-2026/datos-julio.json
scripts/carga-julio-2026/catalogos.json
scripts/carga-julio-2026/resultado-validacion.json
```

Run: `git add .gitignore && git commit -m "chore: ignorar artefactos generados del script de carga de julio"`

---

### Task 3: Catálogos en vivo y cruce de nombres

**Files:**
- Create: `scripts/carga-julio-2026/catalogos.js`

**Interfaces:**
- Consumes: `datos-julio.json` (Task 2), `SCRIPT_URL` (Task 1).
- Produces: `scripts/carga-julio-2026/catalogos.json` con forma
  `{ precioPorCodigo: {codigo: precio}, insumos: [{codigo, nombre, unidad}] }`, usado por las
  Tareas 5 y 6.

- [ ] **Step 1: Escribir `catalogos.js`**

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { SCRIPT_URL, normalizar } from './config.js';

async function get(params) {
  const u = new URL(SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  const json = await r.json();
  if (!json.ok) throw new Error(`Fallo ${params.action}: ${json.error}`);
  return json;
}

async function main() {
  const productos = (await get({ action: 'get_productos' })).data;
  const insumos = (await get({ action: 'listar_insumos' })).insumos;

  const precioPorCodigo = {};
  productos.forEach(p => { precioPorCodigo[String(p.codigo).trim()] = p.precio; });

  const insumoPorNombre = {};
  insumos.forEach(i => { insumoPorNombre[normalizar(i.nombre)] = i; });

  const dias = JSON.parse(readFileSync(new URL('./datos-julio.json', import.meta.url)));

  const codigosFaltantes = new Set();
  const insumosFaltantes = new Set();
  Object.values(dias).forEach(d => {
    d.ventas.forEach(v => { if (!(v.codigo in precioPorCodigo)) codigosFaltantes.add(v.codigo); });
    d.inventario.forEach(i => { if (!insumoPorNombre[normalizar(i.insumo)]) insumosFaltantes.add(i.insumo); });
  });

  if (codigosFaltantes.size > 0) {
    throw new Error('Códigos de producto del archivo sin precio en el catálogo en vivo: ' + [...codigosFaltantes].join(', '));
  }
  if (insumosFaltantes.size > 0) {
    throw new Error('Insumos del archivo sin match en el catálogo Insumos en vivo: ' + [...insumosFaltantes].join(', '));
  }

  console.log('OK — todos los códigos de producto y nombres de insumo del archivo calzan contra el catálogo en vivo.');
  writeFileSync(new URL('./catalogos.json', import.meta.url), JSON.stringify({ precioPorCodigo, insumos }, null, 2));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
```

- [ ] **Step 2: Ejecutar contra el sistema en vivo**

Run: `cd "E:/Proyectos ZFood GyP/scripts/carga-julio-2026" && node catalogos.js`
Expected: `OK — todos los códigos...` y se crea `catalogos.json`. Si lanza error de códigos o insumos
faltantes, son datos reales sin resolver — parar y decidir con el usuario cómo mapearlos (mismo
proceso que ya se hizo para QUESO/COLA Y POLA/PIZZAS), no adivinar.

- [ ] **Step 3: Commit**

```bash
git add scripts/carga-julio-2026/catalogos.js
git commit -m "feat: resolucion de catalogos en vivo (productos e insumos) contra el archivo de julio"
```

---

### Task 4: Constructor de payloads (funciones puras)

**Files:**
- Create: `scripts/carga-julio-2026/armar-payloads.js`
- Test: `scripts/carga-julio-2026/armar-payloads.test.js`

**Interfaces:**
- Consumes: nada externo — funciones puras sobre los datos ya en memoria.
- Produces: `construirVentas(fecha, itemsVentas, precioPorCodigo)`,
  `construirIngreso(fecha, itemsInventario, insumoPorNombre)`,
  `construirCierre(fecha, itemsInventario, campo)`, `construirDanos(fecha, itemsInventario)` — usadas
  por la Tarea 5 (dry-run) y Tarea 6 (carga real).

- [ ] **Step 1: Escribir la prueba primero, con datos de ejemplo fijos**

```js
import assert from 'node:assert/strict';
import { construirVentas, construirIngreso, construirCierre, construirDanos } from './armar-payloads.js';

const itemsVentas = [{ codigo: '2', producto: 'PIZZA HAWAIANA', cantidad: 78 }];
const precioPorCodigo = { '2': 25000 };

const ventas = construirVentas('2026-07-01', itemsVentas, precioPorCodigo);
assert.equal(ventas.action, 'guardar_ventas');
assert.equal(ventas.items[0].precioUnitario, 25000);
assert.equal(ventas.idEnvio, 'ventas-2026-07-01');

const itemsInventario = [
  { insumo: 'QUESO PIZZA', gastosDelDia: 100, habiaAyer: 50, ingreso: 20, jc: -2, debeHaber: -32, existeReal: 40 },
  { insumo: 'JAMON', gastosDelDia: 10, habiaAyer: 5, ingreso: 0, jc: 0, debeHaber: -5, existeReal: 5 }
];
const insumoPorNombre = { 'QUESO PIZZA': { unidad: 'GR' }, 'JAMON': { unidad: 'GR' } };

const ingreso = construirIngreso('2026-07-01', itemsInventario, insumoPorNombre);
assert.equal(ingreso.items.length, 1, 'solo QUESO PIZZA tiene ingreso > 0');
assert.equal(ingreso.items[0].unit, 'GR');

const sinIngreso = construirIngreso('2026-07-02', [itemsInventario[1]], insumoPorNombre);
assert.equal(sinIngreso, null, 'si nadie tuvo ingreso ese día, no hay nada que enviar');

const cierre = construirCierre('2026-07-01', itemsInventario, 'existeReal');
assert.equal(cierre.action, 'guardar_inventario_completo');
assert.equal(cierre.turno, 'CIERRE');
assert.equal(cierre.items[0].total, 40);

const semilla = construirCierre('2026-06-30', itemsInventario, 'habiaAyer');
assert.equal(semilla.items[0].total, 50);

const danos = construirDanos('2026-07-01', itemsInventario);
assert.equal(danos.length, 1, 'solo QUESO PIZZA tiene J/C distinto de cero');
assert.equal(danos[0].action, 'registrar_dano');
assert.equal(danos[0].tipo, 'Insumo');
assert.equal(danos[0].cantidad, -2, 'se preserva el signo negativo (ajuste/devolucion)');
assert.equal(danos[0].idEnvio, 'dano-2026-07-01-QUESO_PIZZA');

console.log('OK — todas las assertions de armar-payloads pasaron.');
```

- [ ] **Step 2: Correr la prueba y confirmar que falla (el archivo real todavía no existe)**

Run: `cd "E:/Proyectos ZFood GyP/scripts/carga-julio-2026" && node armar-payloads.test.js`
Expected: `Error: Cannot find module './armar-payloads.js'`.

- [ ] **Step 3: Escribir `armar-payloads.js`**

```js
import { MARCA_CARGA, MOTIVO_JC, normalizar } from './config.js';

export function construirVentas(fecha, itemsVentas, precioPorCodigo) {
  const items = itemsVentas.map(v => ({
    codigo: v.codigo,
    nombre: v.producto,
    cantidad: v.cantidad,
    precioUnitario: precioPorCodigo[v.codigo] || 0
  }));
  return { action: 'guardar_ventas', fecha, items, registradoPor: MARCA_CARGA, idEnvio: `ventas-${fecha}` };
}

export function construirIngreso(fecha, itemsInventario, insumoPorNombre) {
  const items = itemsInventario
    .filter(i => i.ingreso > 0)
    .map(i => ({ nombre: i.insumo, total: i.ingreso, unit: (insumoPorNombre[normalizar(i.insumo)] || {}).unidad || '' }));
  if (items.length === 0) return null;
  return { action: 'guardar_ingreso', fecha, items, idEnvio: `ingreso-${fecha}` };
}

export function construirCierre(fecha, itemsInventario, campo) {
  const items = itemsInventario.map(i => ({ areas: 'CIERRE', nombre: i.insumo, total: i[campo] }));
  return { action: 'guardar_inventario_completo', fecha, turno: 'CIERRE', items, responsable: MARCA_CARGA, idEnvio: `inv-cierre-${fecha}` };
}

function slug(s) { return normalizar(s).replace(/[^A-Z0-9]+/g, '_'); }

export function construirDanos(fecha, itemsInventario) {
  return itemsInventario
    .filter(i => i.jc !== 0)
    .map(i => ({
      action: 'registrar_dano',
      fecha,
      nombre: i.insumo,
      cantidad: i.jc,
      registradoPor: MARCA_CARGA,
      motivo: MOTIVO_JC,
      tipo: 'Insumo',
      idEnvio: `dano-${fecha}-${slug(i.insumo)}`
    }));
}
```

- [ ] **Step 4: Correr la prueba y confirmar que pasa**

Run: `node armar-payloads.test.js`
Expected: `OK — todas las assertions de armar-payloads pasaron.`

- [ ] **Step 5: Commit**

```bash
git add scripts/carga-julio-2026/armar-payloads.js scripts/carga-julio-2026/armar-payloads.test.js
git commit -m "feat: constructor de payloads para la carga de julio, con pruebas"
```

---

### Task 5: Carga en seco (dry-run) — revisión obligatoria antes de escribir en producción

**Files:**
- Create: `scripts/carga-julio-2026/cargar.js` (con soporte `--dry-run` y `--solo=<fecha>`)

**Interfaces:**
- Consumes: `datos-julio.json` (Task 2), `catalogos.json` (Task 3), las 4 funciones de
  `armar-payloads.js` (Task 4).
- Produces: al terminar esta tarea, el modo `--dry-run` queda listo para usarse también como
  herramienta de diagnóstico en la Tarea 6 si algo sale mal a mitad de carga.

- [ ] **Step 1: Escribir `cargar.js` completo (dry-run y envío real en el mismo script)**

```js
import { readFileSync } from 'node:fs';
import { SCRIPT_URL, normalizar } from './config.js';
import { construirVentas, construirIngreso, construirCierre, construirDanos } from './armar-payloads.js';

const DRY_RUN = process.argv.includes('--dry-run');
const soloArg = process.argv.find(a => a.startsWith('--solo='));
const SOLO_FECHA = soloArg ? soloArg.split('=')[1] : null;

async function llamarGet(params) {
  const u = new URL(SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  return r.json();
}

async function llamarPost(payload) {
  const body = new URLSearchParams({ payload: JSON.stringify(payload) });
  const r = await fetch(SCRIPT_URL, { method: 'POST', body });
  return r.json();
}

async function yaEnviado(idEnvio) {
  const r = await llamarGet({ action: 'verificar_envio', id: idEnvio });
  return r.ok && r.confirmado;
}

async function enviar(payload, { idempotente } = {}) {
  if (DRY_RUN) {
    console.log('[DRY-RUN]', payload.action, payload.fecha, '->', JSON.stringify(payload));
    return;
  }
  if (idempotente && payload.idEnvio && await yaEnviado(payload.idEnvio)) {
    console.log('  ya enviado antes, se salta:', payload.idEnvio);
    return;
  }
  const resp = await llamarPost(payload);
  if (!resp.ok) throw new Error(`${payload.action} (${payload.fecha}) falló: ${resp.error}`);
  console.log('  OK:', payload.action, payload.fecha, payload.idEnvio || '');
}

function indexarInsumos(insumos) {
  const m = {};
  insumos.forEach(i => { m[normalizar(i.nombre)] = i; });
  return m;
}

async function cargarDia(fecha, datosDia, catalogos) {
  console.log(`--- ${fecha} ---`);
  await enviar(construirVentas(fecha, datosDia.ventas, catalogos.precioPorCodigo));

  const ingreso = construirIngreso(fecha, datosDia.inventario, indexarInsumos(catalogos.insumos));
  if (ingreso) await enviar(ingreso, { idempotente: true });

  await enviar(construirCierre(fecha, datosDia.inventario, 'existeReal'), { idempotente: true });

  for (const dano of construirDanos(fecha, datosDia.inventario)) {
    await enviar(dano, { idempotente: true });
  }
}

async function main() {
  const dias = JSON.parse(readFileSync(new URL('./datos-julio.json', import.meta.url)));
  const catalogos = JSON.parse(readFileSync(new URL('./catalogos.json', import.meta.url)));
  const fechas = Object.keys(dias).sort();

  if (SOLO_FECHA === '2026-06-30') {
    await enviar(construirCierre('2026-06-30', dias['2026-07-01'].inventario, 'habiaAyer'), { idempotente: true });
    return;
  }
  if (SOLO_FECHA) {
    await cargarDia(SOLO_FECHA, dias[SOLO_FECHA], catalogos);
    return;
  }

  console.log('--- 2026-06-30 (semilla de "había ayer" para el 1 de julio) ---');
  await enviar(construirCierre('2026-06-30', dias['2026-07-01'].inventario, 'habiaAyer'), { idempotente: true });

  for (const fecha of fechas) {
    await cargarDia(fecha, dias[fecha], catalogos);
  }
  console.log('Carga completa:', fechas.length, 'días + semilla del 30 de junio.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
```

- [ ] **Step 2: Correr en seco solo el 30 de junio y el 1 de julio**

Run: `cd "E:/Proyectos ZFood GyP/scripts/carga-julio-2026" && node cargar.js --dry-run --solo=2026-06-30 && node cargar.js --dry-run --solo=2026-07-01`
Expected: se imprimen los payloads completos (`guardar_inventario_completo` para el 30/06, y
`guardar_ventas`/`guardar_ingreso`/`guardar_inventario_completo`/`registrar_dano` para el 01/07) sin
que nada se escriba todavía en el Sheet.

- [ ] **Step 3: Revisión manual de esos dos días impresos**

Confirmar a ojo (comparando contra `datos-julio.json` y, si hace falta, contra el archivo Excel
original): que el total de insumos en el `guardar_inventario_completo` del 01/07 coincide con el
conteo de insumos de ese día, que los ítems de `guardar_ventas` tienen precio unitario > 0, y que los
`registrar_dano` impresos tienen `tipo: 'Insumo'` y el nombre ya corregido (ej. `QUESO PIZZA`, no
`QUESO`). Si el usuario quiere revisar esto también, mostrarle la salida de este comando antes de
seguir — es el único punto de control antes de tocar producción.

- [ ] **Step 4: Commit**

```bash
git add scripts/carga-julio-2026/cargar.js
git commit -m "feat: script de carga con modo dry-run para revisar antes de escribir en produccion"
```

---

### Task 6: Carga real de los 31 días

**Files:**
- Modify: ninguno (se reusa `cargar.js` de la Task 5, sin `--dry-run`).

**Interfaces:**
- Consumes: todo lo de las Tareas 2-5.
- Produces: datos reales en el Sheet productivo de Inventario (hojas `Ventas`, `Ingresos`,
  `Inventario`, `Gastos_JC`, `Log_Envios`), listos para la Tarea 7.

- [ ] **Step 1: Cargar la semilla del 30 de junio**

Run: `cd "E:/Proyectos ZFood GyP/scripts/carga-julio-2026" && node cargar.js --solo=2026-06-30`
Expected: `OK: guardar_inventario_completo 2026-06-30 inv-cierre-2026-06-30`.

- [ ] **Step 2: Cargar un solo día real de prueba (1 de julio) antes de lanzar los 31**

Run: `node cargar.js --solo=2026-07-01`
Expected: 4 líneas `OK:` (ventas, ingreso, inventario, y tantos `registrar_dano` como insumos con J/C
ese día). Si algo falla, el mensaje de error indica cuál acción y por qué — no continuar hasta
resolverlo (probable causa: algún código o nombre no resuelto que la Task 3 no detectó).

- [ ] **Step 3: Verificar el día 1 contra `reporte_insumos` antes de seguir**

Run: `node -e "fetch('https://script.google.com/macros/s/AKfycbzo45isSgsJoCJxyvBl81Eb9fMAMwsB3GS5IRwV9QxTgk7NLfj8BiE8j5CgeP6dWgb6/exec?action=reporte_insumos&fecha=2026-07-01').then(r=>r.json()).then(j=>console.log(j.data.filter(r=>r.existeReal||r.gasto||r.ingreso).length, 'insumos con algun movimiento'))"`
Expected: un número mayor a 0 (antes de la carga daba 0 — confirma que sí quedó escrito).

- [ ] **Step 4: Cargar el resto del mes (2 al 31 de julio)**

Run: `node cargar.js` (vuelve a intentar el 30/06 y el 01/07 primero, pero como ya están guardados con
`idEnvio` conocido, el `guardar_ventas` del 01/07 se reescribe sin duplicar y los demás se saltan por
`verificar_envio` — es seguro correrlo completo de nuevo en vez de editarlo para saltarse días)
Expected: 31 bloques `--- YYYY-MM-DD ---` con sus `OK:` (o `ya enviado antes` para 30/06 y 01/07),
terminando en `Carga completa: 31 días + semilla del 30 de junio.`

- [ ] **Step 5: Si el proceso se corta a mitad de camino (caída de red, etc.)**

Simplemente volver a correr `node cargar.js` sin argumentos — todo lo ya enviado se detecta por
`verificar_envio` y se salta; solo se reintenta lo que faltó. No hace falta llevar un registro aparte.

No hay commit en esta tarea — es ejecución contra producción, no cambio de código.

---

### Task 7: Validación contra el archivo de referencia

**Files:**
- Create: `scripts/carga-julio-2026/validar.js`

**Interfaces:**
- Consumes: `datos-julio.json` (Task 2), `reporte_insumos` en vivo (ya cargado por Task 6).
- Produces: `scripts/carga-julio-2026/resultado-validacion.json` y un resumen en consola — el
  entregable final que se comparte con el usuario.

- [ ] **Step 1: Escribir `validar.js`**

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { SCRIPT_URL, normalizar } from './config.js';

async function reporte(fecha) {
  const u = new URL(SCRIPT_URL);
  u.searchParams.set('action', 'reporte_insumos');
  u.searchParams.set('fecha', fecha);
  const r = await fetch(u);
  const json = await r.json();
  if (!json.ok) throw new Error(`reporte_insumos ${fecha} falló: ${json.error}`);
  return json.data;
}

async function main() {
  const dias = JSON.parse(readFileSync(new URL('./datos-julio.json', import.meta.url)));
  const fechas = Object.keys(dias).sort();
  const resultados = [];

  for (const fecha of fechas) {
    const sistema = await reporte(fecha);
    const sistemaPorNombre = {};
    sistema.forEach(r => { sistemaPorNombre[normalizar(r.insumo)] = r; });

    dias[fecha].inventario.forEach(ref => {
      const s = sistemaPorNombre[normalizar(ref.insumo)];
      if (!s) {
        resultados.push({ fecha, insumo: ref.insumo, campo: 'catalogo', esperado: 'existe', obtenido: 'no está en Insumos del sistema' });
        return;
      }
      const campos = [
        ['gasto', ref.gastosDelDia, s.gasto],
        ['gastoJC', ref.jc, s.gastoJC],
        ['debeHaber', ref.debeHaber, s.debeHaber],
        ['existeReal', ref.existeReal, s.existeReal]
      ];
      campos.forEach(([campo, esperado, obtenido]) => {
        if (Math.abs((esperado || 0) - (obtenido || 0)) >= 0.01) {
          resultados.push({ fecha, insumo: ref.insumo, campo, esperado, obtenido });
        }
      });
    });
    console.log(`${fecha}: comparado (${dias[fecha].inventario.length} insumos)`);
  }

  writeFileSync(new URL('./resultado-validacion.json', import.meta.url), JSON.stringify(resultados, null, 2));

  const porCampo = {};
  resultados.forEach(r => { porCampo[r.campo] = (porCampo[r.campo] || 0) + 1; });
  console.log(`\nComparación completa sobre ${fechas.length} días.`);
  console.log(`${resultados.length} diferencias encontradas. Resumen por campo:`, porCampo);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
```

- [ ] **Step 2: Ejecutar la validación**

Run: `cd "E:/Proyectos ZFood GyP/scripts/carga-julio-2026" && node validar.js`
Expected: 31 líneas `YYYY-MM-DD: comparado (...)`, terminando con el conteo total de diferencias y el
resumen por campo.

- [ ] **Step 3: Interpretar el resultado con el usuario, no asumir que toda diferencia es un bug**

Leer `resultado-validacion.json`. Separar en dos grupos antes de reportar:
1. Diferencias en `gasto` — comparan el consumo por receta (código de venta × Recetas) que calcula el
   sistema contra `GASTOS DEL DIA` del archivo, que es un número que el usuario ya traía calculado a
   mano. Si difieren sistemáticamente para un insumo/producto en particular, lo más probable es una
   receta faltante o mal cargada en el Sheet `Recetas` — mencionarlo puntualmente.
2. Diferencias en `debeHaber` o `existeReal` — como `existeReal` se cargó tal cual del archivo, no
   debería diferir nunca; si aparece, es señal de un problema real en `generarReporteInsumos` (revisar
   con prioridad). `debeHaber` hereda cualquier diferencia de `gasto`, así que conviene explicarlo
   junto con el punto 1, no como un hallazgo aparte.

No hay commit de código en esta tarea (ya se commiteó `validar.js` en el Step siguiente).

- [ ] **Step 4: Commit**

```bash
git add scripts/carga-julio-2026/validar.js
git commit -m "feat: script de validacion del reporte de inventario contra el archivo de julio"
```

---

## Entregable 2 — Prueba en vivo de Domicilio y Venta Rápida (hoy)

### Task 8: Crear los pedidos de prueba por curl (Domicilio y Venta Rápida)

**Files:**
- Create: `scripts/prueba-en-vivo-2026-08-05/crear-pedidos.js`

**Interfaces:**
- Consumes: `https://donde-el-gordo.vercel.app/api/proxy-menu` (acción pública `crear_pedido`, ya en
  producción — confirmado que responde con `listar_productos`).
- Produces: dos pedidos reales, fechados hoy, en la hoja `Ventas` del Menú Digital — el usuario los
  cobra y libera manualmente desde `caja.html` (acuerdo con el usuario: `marcar_pedido_pagado` y
  `liberar_pedido` exigen sesión de cajero con clave real, que el script no debe tener).

- [ ] **Step 1: Escribir `crear-pedidos.js`**

```js
const BASE = 'https://donde-el-gordo.vercel.app/api/proxy-menu';

async function crearPedido({ items, tipo, mesa, mesero }) {
  const params = new URLSearchParams({
    accion: 'crear_pedido',
    items: JSON.stringify(items),
    total: String(items.reduce((s, it) => s + it.precio * it.cantidad, 0)),
    tipo,
    mesa: mesa || '',
    mesero: mesero || ''
  });
  const r = await fetch(BASE + '?' + params.toString());
  const json = await r.json();
  console.log(tipo, '->', json);
  return json;
}

async function main() {
  await crearPedido({
    tipo: 'domicilio',
    items: [
      { producto: 'Sencilla', categoria: 'Hamburguesas', precio: 14000, cantidad: 1, observacion: 'PRUEBA carga julio 2026 - domicilio' }
    ]
  });

  await crearPedido({
    tipo: 'mostrador',
    mesa: 'PRUEBA Venta Rápida',
    items: [
      { producto: 'Pollo', categoria: 'Hamburguesas', precio: 18000, cantidad: 1, observacion: 'PRUEBA carga julio 2026 - venta rapida' }
    ]
  });
}

main().catch(e => console.error('ERROR:', e.message));
```

- [ ] **Step 2: Ejecutar contra producción**

Run: `cd "E:/Proyectos ZFood GyP/scripts/prueba-en-vivo-2026-08-05" && node crear-pedidos.js`
Expected: dos líneas, `domicilio -> { ok: true, ... }` y `mostrador -> { ok: true, ... }` (revisar el
shape exacto de la respuesta de `crear_pedido` en `modulo-1-apps-script-nuevo.gs.txt` si `ok` no viene
como se espera).

- [ ] **Step 3: Avisar al usuario y esperar su confirmación manual**

Decirle al usuario: "Ya creé un pedido de prueba de Domicilio (Sencilla, con la nota 'PRUEBA carga
julio 2026 - domicilio') y uno de Venta Rápida a nombre de 'PRUEBA Venta Rápida' (Pollo). Entra a
`caja.html`, cóbralos con tu clave de cajero — el de Domicilio como cualquier domicilio normal, y el
de Venta Rápida probando tanto 'Cobrar y entregar' como, si quieres repetir la prueba,
'Cobrar y dejar para recoger' — y de paso revisa que `cocina.html` les ponga la etiqueta correcta
(🛵 Domicilio / 🛎️ Mostrador: PRUEBA Venta Rápida)."

- [ ] **Step 4: Commit**

```bash
git add scripts/prueba-en-vivo-2026-08-05/crear-pedidos.js
git commit -m "feat: script para crear pedidos de prueba de domicilio y venta rapida"
```

---

## Self-Review (hecho al escribir este plan)

- **Cobertura del spec:** las 3 secciones del spec (carga histórica, validación, prueba en vivo)
  tienen tarea. Las 2 correcciones encontradas al planear (sin acción nueva de backend para Gastos_JC;
  auth de cajero en el proxy del Menú) ya están reflejadas tanto en el spec actualizado como en las
  Tareas 6 y 8.
- **Placeholders:** ninguno — cada Step tiene comando y código real, verificados contra el sistema en
  vivo mientras se escribía este plan (conteos de filas, headers exactos del Excel, respuesta real de
  `listar_insumos`/`get_productos`/`listar_productos`, comportamiento de redirect 302 con POST).
- **Consistencia de tipos:** `datos-julio.json` tiene la misma forma en las Tareas 2, 3, 5, 6 y 7
  (`{insumo, gastosDelDia, habiaAyer, ingreso, jc, debeHaber, existeReal}` para Inventario;
  `{codigo, producto, cantidad}` para Ventas). Los nombres de función de `armar-payloads.js`
  (`construirVentas`, `construirIngreso`, `construirCierre`, `construirDanos`) son los mismos en la
  Task 4 que los importados en la Task 5.
