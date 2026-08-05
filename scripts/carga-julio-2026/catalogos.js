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
