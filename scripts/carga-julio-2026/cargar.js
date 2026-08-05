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
