// middleware.js — corre antes de servir cualquiera de las 7 paginas internas.
// Si no hay sesion valida (cajero o admin), redirige a login.html en vez de
// entregar el HTML. inventario.html/empleados.html/cuadre.html quedan aqui
// tambien (decision del usuario: solo proteccion de pagina, sin proxear su
// backend JSONP/iframe — ver docs/superpowers/specs/2026-08-04-seguridad-sistema-design.md).
import { next } from '@vercel/functions';
import { getSessionFromRequest } from './api/_lib/session.js';

export const config = {
  matcher: [
    '/caja.html',
    '/cuadre.html',
    '/cocina.html',
    '/inventario.html',
    '/asesorventas.html',
    '/empleados.html',
    '/comisiones.html'
  ]
};

export default async function middleware(request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    const url = new URL(request.url);
    const destino = `/login.html?volver=${encodeURIComponent(url.pathname)}`;
    return Response.redirect(new URL(destino, request.url), 302);
  }
  return next();
}
