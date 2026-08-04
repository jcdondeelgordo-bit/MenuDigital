// api/session.js — usado por las paginas protegidas para saber que rol
// tiene la sesion actual (por ejemplo, para ocultar botones de Admin).
export const config = { runtime: 'edge' };

import { getSessionFromRequest } from './_lib/session.js';

export default async function handler(request) {
  const session = await getSessionFromRequest(request);
  return new Response(JSON.stringify({ ok: true, rol: session ? session.rol : null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
