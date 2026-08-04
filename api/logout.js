// api/logout.js
export const config = { runtime: 'edge' };

import { SESSION_COOKIE_NAME, cookieAttrs } from './_lib/session.js';

export default async function handler(request) {
  const cookie = `${SESSION_COOKIE_NAME}=; ${cookieAttrs(request, 0)}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie }
  });
}
