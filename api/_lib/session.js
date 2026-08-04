// api/_lib/session.js
// Cookie de sesion firmada con HMAC-SHA256 via Web Crypto API (crypto.subtle),
// funciona igual en runtime Edge (middleware) y en las funciones /api.
// Sin base de datos: el "rol" (cajero|admin) viaja firmado dentro de la
// cookie misma; SESSION_SECRET (variable de entorno de Vercel) es lo unico
// que hace falta para verificarla o para falsificarla, por eso nunca va en
// el codigo.

const SESSION_COOKIE_NAME = 'deg_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 ano, sesion indefinida por decision del dueno

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Falta la variable de entorno SESSION_SECRET');
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signSession(rol) {
  const payload = JSON.stringify({ rol, iat: Date.now() });
  const payloadB64 = toBase64Url(encoder.encode(payload));
  const key = await getKey();
  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64)));
  return `${payloadB64}.${toBase64Url(sigBytes)}`;
}

async function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  let key;
  try {
    key = await getKey();
  } catch (e) {
    return null;
  }
  let valid;
  try {
    valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(sigB64), encoder.encode(payloadB64));
  } catch (e) {
    return null;
  }
  if (!valid) return null;
  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadB64)));
    if (payload.rol !== 'cajero' && payload.rol !== 'admin') return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const out = {};
  (cookieHeader || '').split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

async function getSessionFromRequest(request) {
  const cookies = parseCookies(request.headers.get('cookie'));
  return verifySession(cookies[SESSION_COOKIE_NAME]);
}

function cookieAttrs(request, maxAgeSeconds) {
  const isHttps = new URL(request.url).protocol === 'https:';
  return [
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
    isHttps ? 'Secure' : '' // Secure se omite en desarrollo local (http) para que la cookie si se guarde
  ].filter(Boolean).join('; ');
}

export {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession,
  parseCookies,
  getSessionFromRequest,
  cookieAttrs
};
