// api/proxy-menu.js — unico punto que conoce el SCRIPT_URL real del backend
// de Menu. Todos los archivos que hoy llaman a ese Apps Script directo
// (menu, caja, cocina, asesorventas, comisiones, bienvenida) van a apuntar
// aqui en vez de a la URL real (Task 5) — el SCRIPT_URL deja de estar
// visible en el codigo fuente que ve el navegador.
export const config = { runtime: 'edge' };

import { getSessionFromRequest } from './_lib/session.js';

const SCRIPT_URL = process.env.SCRIPT_URL_MENU;

// Rol requerido por cada accion. 'publica' = cualquiera, sin login.
// 'cajero_o_admin' = cualquiera de las 2 sesiones. 'cajero'/'admin' = solo esa.
const PERMISOS = {
  listar_productos: 'publica',
  crear_pedido: 'publica',
  estado_mesa: 'publica',
  buscar_cliente: 'publica',
  registrar_cliente: 'publica',
  actualizar_cliente: 'publica',
  listar_empleados: 'publica',
  verificar_admin: 'publica',
  listar_pedidos_cocina: 'cajero_o_admin',
  listar_pedidos_caja: 'cajero_o_admin',
  listar_pagos_divididos: 'cajero_o_admin',
  actualizar_estado_item: 'cajero_o_admin',
  marcar_pedido_completo: 'cajero_o_admin',
  marcar_pedido_pagado: 'cajero',
  liberar_mesa: 'cajero',
  liberar_pedido: 'cajero',
  registrar_pago_parcial: 'cajero',
  actualizar_precio: 'admin',
  calcular_comisiones: 'admin',
  guardar_configuracion_bono: 'admin'
};

function tienePermiso(requerido, rolSesion) {
  if (requerido === 'publica') return true;
  if (!rolSesion) return false;
  if (requerido === 'cajero_o_admin') return rolSesion === 'cajero' || rolSesion === 'admin';
  return rolSesion === requerido;
}

export default async function handler(request) {
  if (!SCRIPT_URL) {
    return new Response(JSON.stringify({ ok: false, error: 'SCRIPT_URL_MENU no configurado en el servidor' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  const url = new URL(request.url);
  const accion = url.searchParams.get('accion');
  const requerido = PERMISOS[accion];
  if (!requerido) {
    return new Response(JSON.stringify({ ok: false, error: 'accion desconocida' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const session = await getSessionFromRequest(request);
  if (!tienePermiso(requerido, session ? session.rol : null)) {
    return new Response(JSON.stringify({ ok: false, error: 'no autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  let upstream;
  let cuerpo;
  try {
    upstream = await fetch(SCRIPT_URL + '?' + url.searchParams.toString());
    cuerpo = await upstream.text();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'no se pudo conectar con el backend' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(cuerpo, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
}
