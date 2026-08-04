// api/login.js
export const config = { runtime: 'edge' };

import { signSession, cookieAttrs, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from './_lib/session.js';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'metodo no permitido' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'cuerpo invalido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const rol = body && body.rol;
  const clave = body && body.clave;
  if (rol !== 'cajero' && rol !== 'admin') {
    return new Response(JSON.stringify({ ok: false, error: 'rol invalido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const claveEsperada = rol === 'cajero' ? process.env.CAJERO_PASSWORD : process.env.ADMIN_PASSWORD;
  if (!claveEsperada || clave !== claveEsperada) {
    return new Response(JSON.stringify({ ok: false, error: 'clave incorrecta' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const token = await signSession(rol);
  const cookie = `${SESSION_COOKIE_NAME}=${token}; ${cookieAttrs(request, SESSION_MAX_AGE_SECONDS)}`;
  return new Response(JSON.stringify({ ok: true, rol }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie }
  });
}
