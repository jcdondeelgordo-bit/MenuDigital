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

  console.log(`Insumos excluidos (PIZZAS): ${excluidos} filas`);
  console.log(`Insumos remapeados (QUESO/COLA Y POLA 330): ${remapeados} filas`);

  writeFileSync(new URL('./datos-julio.json', import.meta.url), JSON.stringify(dias, null, 2));
  console.log('Escrito datos-julio.json con', fechasVentas.length, 'días.');
}

main();
