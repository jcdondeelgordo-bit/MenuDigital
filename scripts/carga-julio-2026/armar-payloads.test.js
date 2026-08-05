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
