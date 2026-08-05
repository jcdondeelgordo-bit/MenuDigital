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
