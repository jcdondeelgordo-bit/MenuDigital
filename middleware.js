// middleware.js — corre antes de servir cualquiera de las 7 paginas internas.
// Si no hay sesion valida (cajero o admin), redirige a login.html en vez de
// entregar el HTML. inventario.html/empleados.html/cuadre.html quedan aqui
// tambien (decision del usuario: solo proteccion de pagina, sin proxear su
// backend JSONP/iframe — ver docs/superpowers/specs/2026-08-04-seguridad-sistema-design.md).
import { next } from '@vercel/functions';
import { getSessionFromRequest } from './api/_lib/session.js';

// El matcher usa rutas literales explicitas (con y sin .html) en vez de un
// fragmento de regex libre o la sintaxis de grupo opcional `{.html}?`: se
// probo ambas contra path-to-regexp@6.3.0 (la version que usa el matcher de
// Vercel/Next.js) y las dos fallan a compilar ("Unexpected MODIFIER").
// Las 14 rutas literales de abajo son la variante que sabemos que compila.
export const config = {
  matcher: [
    '/caja.html',
    '/caja',
    '/cuadre.html',
    '/cuadre',
    '/cocina.html',
    '/cocina',
    '/inventario.html',
    '/inventario',
    '/asesorventas.html',
    '/asesorventas',
    '/empleados.html',
    '/empleados',
    '/comisiones.html',
    '/comisiones'
  ]
};

const SOLO_ADMIN = new Set(['/comisiones']);

export default async function middleware(request) {
  const url = new URL(request.url);
  const base = url.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  const session = await getSessionFromRequest(request);
  if (!session) {
    const destino = `/login.html?volver=${encodeURIComponent(url.pathname)}`;
    return new Response(null, { status: 302, headers: { Location: destino } });
  }
  if (SOLO_ADMIN.has(base) && session.rol !== 'admin') {
    return new Response(null, { status: 302, headers: { Location: '/index.html' } });
  }
  return next();
}
