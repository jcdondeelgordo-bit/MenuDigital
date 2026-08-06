import { readFileSync, writeFileSync } from 'node:fs';
import { SCRIPT_URL, normalizar } from './config.js';

function esperar(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function conReintentos(fn, intentos = 6) {
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimoError = e;
      if (i < intentos - 1) await esperar(2000 * (i + 1));
    }
  }
  throw ultimoError;
}

async function reporte(fecha) {
  return conReintentos(async () => {
    const u = new URL(SCRIPT_URL);
    u.searchParams.set('action', 'reporte_insumos');
    u.searchParams.set('fecha', fecha);
    const r = await fetch(u);
    const texto = await r.text();
    const json = JSON.parse(texto);
    if (!json.ok) throw new Error(`reporte_insumos ${fecha} falló: ${json.error}`);
    return json.data;
  });
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
        ['habiaAyer', ref.habiaAyer, s.habiaAyer],
        ['ingreso', ref.ingreso, s.ingreso],
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
    await esperar(700);
  }

  writeFileSync(new URL('./resultado-validacion.json', import.meta.url), JSON.stringify(resultados, null, 2));

  const porCampo = {};
  resultados.forEach(r => { porCampo[r.campo] = (porCampo[r.campo] || 0) + 1; });
  console.log(`\nComparación completa sobre ${fechas.length} días.`);
  console.log(`${resultados.length} diferencias encontradas. Resumen por campo:`, porCampo);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
