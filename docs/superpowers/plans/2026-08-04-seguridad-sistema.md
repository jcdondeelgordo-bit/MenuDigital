# Seguridad real del sistema — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login por rol (Cajero/Admin) + proxy que esconde el `SCRIPT_URL` del Menú, desplegado en Vercel, cerrando los 3 huecos de seguridad de `caja.html` abierta, el endpoint expuesto, y el modo admin sin protección real — sin reescribir la lógica de negocio ya construida.

**Architecture:** Vercel sirve los 10 HTML tal cual están hoy + una carpeta `/api` con funciones serverless Edge + un `middleware.js` de Routing Middleware que redirige a `/login.html` cualquier request a una página protegida sin cookie de sesión válida. Un solo proxy (`/api/proxy-menu`) reenvía las llamadas de los 6 archivos que usan el backend de Menú (`menu.html`, `caja.html`, `cocina.html`, `asesorventas.html`, `comisiones.html`, `bienvenida.html`), validando cada `accion` contra una tabla de permisos antes de reenviarla al Apps Script real. Los 3 archivos del backend de Inventario (`inventario.html`, `empleados.html`, `cuadre.html`) usan JSONP + iframe-POST — por decisión explícita del usuario, **no se proxean**, solo quedan detrás del mismo login a nivel de página.

**Tech Stack:** Vercel Routing Middleware + Vercel Functions, runtime Edge, JavaScript ESM puro (sin build step, sin framework). Única dependencia npm: `@vercel/functions` (helper `next()` del middleware). Cookies de sesión firmadas con HMAC-SHA256 vía Web Crypto API (`crypto.subtle`, funciona igual en Edge y en Node — cero dependencias de firma).

## Global Constraints

- Ningún archivo HTML existente cambia su lógica de negocio — solo se toca la línea `const SCRIPT_URL = '...'` (6 archivos) y se agregan botón/CSS de sesión (7 archivos protegidos). Nada más se edita.
- Nunca hardcodear `CAJERO_PASSWORD`, `ADMIN_PASSWORD` ni `SESSION_SECRET` en ningún archivo — solo variables de entorno de Vercel.
- Sesión de larga duración (1 año), sin expiración automática — decisión explícita del dueño.
- Todo el código nuevo es ESM (`import`/`export`), `package.json` con `"type": "module"`.
- `inventario.html`, `empleados.html`, `cuadre.html`: solo protección a nivel de página (middleware). Sus llamadas internas a Apps Script (JSONP, iframe-POST) no se tocan.
- Verificación real contra el backend en vivo (`vercel dev` + `curl`, y al final Playwright) en cada tarea que lo permita — no dar nada por bueno solo por lectura de código, seguiendo la cultura de este proyecto (ver `ESTADO.md`).

---

### Task 1: Base del proyecto + librería de sesión (firma/verificación de cookie)

**Files:**
- Create: `package.json`
- Create: `api/_lib/session.js`
- Create: `api/_lib/session.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces (usado por todas las tareas siguientes): desde `api/_lib/session.js` — `SESSION_COOKIE_NAME` (string `'deg_session'`), `SESSION_MAX_AGE_SECONDS` (number, 31536000), `async signSession(rol: 'cajero'|'admin'): Promise<string>`, `async verifySession(token: string): Promise<{rol, iat}|null>`, `parseCookies(cookieHeader: string|null): Record<string,string>`, `async getSessionFromRequest(request: Request): Promise<{rol,iat}|null>`, `cookieAttrs(request: Request, maxAgeSeconds: number): string`.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "donde-el-gordo-seguridad",
  "private": true,
  "type": "module",
  "dependencies": {
    "@vercel/functions": "^1.5.0"
  }
}
```

- [ ] **Step 2: Agregar entradas al `.gitignore`**

Abrir `.gitignore` (ya existe, tiene `.claude/worktrees/` y `.superpowers/`) y agregar al final:

```
node_modules/
.vercel
.env.local
.env*.local
```

- [ ] **Step 3: Crear `api/_lib/session.js`**

```js
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
    'SameSite=Lax',
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
```

- [ ] **Step 4: Crear `api/_lib/session.test.mjs`**

Este proyecto no usa ningun framework de test (ver `ESTADO.md`: se verifica con `curl`/Playwright/`node --check`) — este es un script de verificacion manual con `node:assert`, no un archivo que Vercel vaya a desplegar (todo lo que empieza con `_` dentro de `/api` queda excluido del enrutamiento).

```js
// api/_lib/session.test.mjs
// Ejecutar con: node api/_lib/session.test.mjs
import assert from 'node:assert/strict';
import { signSession, verifySession } from './session.js';

process.env.SESSION_SECRET = 'clave-de-prueba-no-usar-en-produccion';

const token = await signSession('cajero');
const verificado = await verifySession(token);
assert.equal(verificado.rol, 'cajero', 'debe verificar un token recien firmado');

const alterado = token.slice(0, -2) + 'xx';
const verificadoAlterado = await verifySession(alterado);
assert.equal(verificadoAlterado, null, 'un token alterado debe rechazarse');

const vacio = await verifySession('');
assert.equal(vacio, null, 'un token vacio debe rechazarse');

const tokenRolInvalido = await signSession('super-admin');
const verificadoRolInvalido = await verifySession(tokenRolInvalido);
assert.equal(verificadoRolInvalido, null, 'un rol fuera de cajero/admin debe rechazarse aunque la firma sea valida');

console.log('OK: session.js pasa las 4 verificaciones');
```

- [ ] **Step 5: Ejecutar la verificación**

Run: `node api/_lib/session.test.mjs`
Expected: `OK: session.js pasa las 4 verificaciones` (sin errores de `assert`)

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore api/_lib/session.js api/_lib/session.test.mjs
git commit -m "feat: libreria de sesion firmada (HMAC via Web Crypto) para el sistema de login"
```

---

### Task 2: Login, logout, chequeo de sesión y página de login

**Files:**
- Create: `api/login.js`
- Create: `api/logout.js`
- Create: `api/session.js`
- Create: `login.html`
- Create: `.env.local` (no se commitea — ver `.gitignore` de Task 1)

**Interfaces:**
- Consumes: de Task 1 — `signSession`, `cookieAttrs`, `getSessionFromRequest`, `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE_SECONDS` (importados desde `./_lib/session.js`).
- Produces: endpoints `POST /api/login`, `POST /api/logout`, `GET /api/session`, página `/login.html`.

- [ ] **Step 1: Crear `api/login.js`**

```js
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
```

- [ ] **Step 2: Crear `api/logout.js`**

```js
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
```

- [ ] **Step 3: Crear `api/session.js`**

```js
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
```

- [ ] **Step 4: Crear `login.html`**

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ingresar — Donde el Gordo</title>
<style>
  body{font-family:'Inter',sans-serif;background:radial-gradient(1200px 800px at 20% -10%,#241407 0%,#170d06 55%,#120a04 100%);color:#f3e6d0;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;}
  .panel{background:#170d06;border:1px solid rgba(202,161,83,0.3);border-radius:16px;padding:32px;width:100%;max-width:340px;box-sizing:border-box;}
  h1{font-size:1.1rem;color:#caa153;margin:0 0 20px;text-align:center;letter-spacing:1px;}
  .rol-tabs{display:flex;gap:8px;margin-bottom:16px;}
  .rol-tab{flex:1;padding:10px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(202,161,83,0.3);color:#f3e6d0;font-weight:600;cursor:pointer;text-align:center;user-select:none;}
  .rol-tab.activa{background:#e0a53f;color:#1a0f07;border-color:transparent;}
  input{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid rgba(202,161,83,0.3);background:rgba(255,255,255,0.05);color:#f3e6d0;font-size:1rem;margin-bottom:12px;}
  button.entrar{width:100%;padding:12px;border-radius:10px;background:#e0a53f;border:none;color:#1a0f07;font-weight:800;font-size:1rem;cursor:pointer;}
  button.entrar:disabled{opacity:0.6;cursor:default;}
  .msg{font-size:0.85rem;color:#e8a0a0;margin-top:10px;text-align:center;min-height:1.2em;}
</style>
</head>
<body>
<div class="panel">
  <h1>DONDE EL GORDO</h1>
  <div class="rol-tabs">
    <div class="rol-tab activa" id="tab-cajero">Cajero</div>
    <div class="rol-tab" id="tab-admin">Admin</div>
  </div>
  <input type="password" id="clave" placeholder="Clave" autocomplete="current-password">
  <button class="entrar" id="btn-entrar">Entrar</button>
  <div class="msg" id="msg"></div>
</div>
<script>
let rolElegido = 'cajero';
function elegirRol(r) {
  rolElegido = r;
  document.getElementById('tab-cajero').classList.toggle('activa', r === 'cajero');
  document.getElementById('tab-admin').classList.toggle('activa', r === 'admin');
}
document.getElementById('tab-cajero').addEventListener('click', () => elegirRol('cajero'));
document.getElementById('tab-admin').addEventListener('click', () => elegirRol('admin'));

async function entrar() {
  const btn = document.getElementById('btn-entrar');
  const msg = document.getElementById('msg');
  const clave = document.getElementById('clave').value;
  if (!clave) { msg.textContent = 'Escribe la clave.'; return; }
  btn.disabled = true;
  msg.textContent = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rol: rolElegido, clave })
    });
    const data = await res.json();
    if (data.ok) {
      const volver = new URLSearchParams(window.location.search).get('volver');
      window.location.href = volver || '/index.html';
    } else {
      msg.textContent = 'Clave incorrecta.';
      btn.disabled = false;
    }
  } catch (e) {
    msg.textContent = 'No se pudo conectar. Intenta de nuevo.';
    btn.disabled = false;
  }
}
document.getElementById('btn-entrar').addEventListener('click', entrar);
document.getElementById('clave').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
</script>
</body>
</html>
```

- [ ] **Step 5: Crear `.env.local` para pruebas locales (NO se commitea)**

```
CAJERO_PASSWORD=prueba-cajero-2026
ADMIN_PASSWORD=prueba-admin-2026
SESSION_SECRET=un-secreto-largo-cualquiera-solo-para-pruebas-locales
SCRIPT_URL_MENU=https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec
```

(El valor real de `SCRIPT_URL_MENU` es el mismo que hoy está en la línea `const SCRIPT_URL = '...'` de `caja.html` — confirmarlo con `grep "const SCRIPT_URL" caja.html` antes de copiarlo.)

- [ ] **Step 6: Instalar la CLI de Vercel y correr el servidor local**

Run: `npm install` (instala `@vercel/functions`), luego `npx vercel dev`
La primera vez pedirá loguearse con la cuenta de Vercel del usuario y vincular el proyecto (aceptar las opciones por defecto). Dejarlo corriendo en `http://localhost:3000`.

- [ ] **Step 7: Probar login con clave incorrecta**

Run: `curl -i -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d "{\"rol\":\"cajero\",\"clave\":\"mala\"}"`
Expected: `HTTP/1.1 401`, cuerpo `{"ok":false,"error":"clave incorrecta"}`

- [ ] **Step 8: Probar login correcto y capturar la cookie**

Run: `curl -i -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d "{\"rol\":\"cajero\",\"clave\":\"prueba-cajero-2026\"}"`
Expected: `HTTP/1.1 200`, header `Set-Cookie: deg_session=...; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`, cuerpo `{"ok":true,"rol":"cajero"}`

- [ ] **Step 9: Probar `/api/session` con y sin cookie**

Run: `curl -s http://localhost:3000/api/session` (sin cookie)
Expected: `{"ok":true,"rol":null}`

Run: `curl -s http://localhost:3000/api/session -H "Cookie: deg_session=<el token del Step 8>"`
Expected: `{"ok":true,"rol":"cajero"}`

- [ ] **Step 10: Probar logout**

Run: `curl -i -X POST http://localhost:3000/api/logout`
Expected: `HTTP/1.1 200`, header `Set-Cookie: deg_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`

- [ ] **Step 11: Commit**

```bash
git add api/login.js api/logout.js api/session.js login.html
git commit -m "feat: endpoints de login/logout/sesion + pagina de login"
```

(`.env.local` no se agrega — ya está en `.gitignore`.)

---

### Task 3: Middleware — proteger las 7 páginas internas a nivel de página

**Files:**
- Create: `middleware.js`

**Interfaces:**
- Consumes: de Task 1 — `getSessionFromRequest` (desde `./api/_lib/session.js`); de la dependencia `@vercel/functions` — `next()`.

- [ ] **Step 1: Crear `middleware.js`**

```js
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
```

- [ ] **Step 2: Probar sin sesión — debe redirigir**

Con `vercel dev` corriendo (Task 2, Step 6):
Run: `curl -i http://localhost:3000/caja.html`
Expected: `HTTP/1.1 302`, header `Location: /login.html?volver=%2Fcaja.html`

- [ ] **Step 3: Probar página pública — no debe redirigir**

Run: `curl -i http://localhost:3000/menu.html`
Expected: `HTTP/1.1 200` (el HTML real de `menu.html`, sin redirección)

- [ ] **Step 4: Probar con sesión válida — debe dejar pasar**

Reusar la cookie del login de Task 2 Step 8:
Run: `curl -i http://localhost:3000/caja.html -H "Cookie: deg_session=<token>"`
Expected: `HTTP/1.1 200` (el HTML real de `caja.html`)

- [ ] **Step 5: Probar las otras 6 páginas protegidas sin sesión**

Run (repetir para cada una): `curl -i http://localhost:3000/cuadre.html`, `.../cocina.html`, `.../inventario.html`, `.../asesorventas.html`, `.../empleados.html`, `.../comisiones.html`
Expected: las 6 responden `302` hacia su propio `login.html?volver=...`

- [ ] **Step 6: Commit**

```bash
git add middleware.js
git commit -m "feat: middleware que exige sesion para las 7 paginas internas"
```

---

### Task 4: Proxy del backend de Menú con permisos por acción

**Files:**
- Create: `api/proxy-menu.js`

**Interfaces:**
- Consumes: de Task 1 — `getSessionFromRequest` (desde `./_lib/session.js`).
- Produces: endpoint `GET /api/proxy-menu?accion=...` — mismo formato de respuesta `{ok:true/false,...}` que ya devuelve Apps Script hoy, así que ningún archivo HTML necesita cambios de lógica para interpretarlo.

- [ ] **Step 1: Crear `api/proxy-menu.js`**

```js
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
  const upstream = await fetch(SCRIPT_URL + '?' + url.searchParams.toString());
  const cuerpo = await upstream.text();
  return new Response(cuerpo, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: Probar una acción pública sin cookie**

Run: `curl -s "http://localhost:3000/api/proxy-menu?accion=listar_productos"`
Expected: `{"ok":true,"data":[...]}` — el catálogo real (mismo resultado que pegar la URL de Apps Script directo)

- [ ] **Step 3: Probar una acción de cajero sin cookie — debe rechazar**

Run: `curl -i "http://localhost:3000/api/proxy-menu?accion=marcar_pedido_pagado&id_pedido=x&metodo_pago=Efectivo"`
Expected: `HTTP/1.1 403`, `{"ok":false,"error":"no autorizado"}`

- [ ] **Step 4: Probar una acción de cajero con cookie de cajero — debe pasar el candado (aunque Apps Script luego responda "pedido no encontrado", lo que importa es que no sea 403)**

Run: `curl -s "http://localhost:3000/api/proxy-menu?accion=marcar_pedido_pagado&id_pedido=x&metodo_pago=Efectivo" -H "Cookie: deg_session=<token de cajero>"`
Expected: respuesta de Apps Script (no `{"ok":false,"error":"no autorizado"}`) — por ejemplo `{"ok":false,"error":"Pedido no encontrado"}` o similar, confirmando que sí llegó al backend real.

- [ ] **Step 5: Probar una acción de admin con cookie de cajero — debe rechazar (cruce de roles)**

Run: `curl -i "http://localhost:3000/api/proxy-menu?accion=actualizar_precio&producto=Sencilla&precio=15000" -H "Cookie: deg_session=<token de cajero>"`
Expected: `HTTP/1.1 403`, `{"ok":false,"error":"no autorizado"}`

- [ ] **Step 6: Probar una acción desconocida**

Run: `curl -i "http://localhost:3000/api/proxy-menu?accion=algo_que_no_existe"`
Expected: `HTTP/1.1 400`, `{"ok":false,"error":"accion desconocida"}`

- [ ] **Step 7: Commit**

```bash
git add api/proxy-menu.js
git commit -m "feat: proxy del backend de Menu con tabla de permisos por accion"
```

---

### Task 5: Apuntar los 6 archivos del backend de Menú al proxy

**Files:**
- Modify: `menu.html` (constante `SCRIPT_URL`)
- Modify: `caja.html` (constante `SCRIPT_URL`)
- Modify: `cocina.html` (constante `SCRIPT_URL`)
- Modify: `asesorventas.html` (constante `SCRIPT_URL`)
- Modify: `comisiones.html` (constante `SCRIPT_URL`)
- Modify: `bienvenida.html` (constante `SCRIPT_URL`)

**Interfaces:**
- Consumes: `/api/proxy-menu` (Task 4) como si fuera el `SCRIPT_URL` real — mismo patrón `fetch(SCRIPT_URL + '?' + params)` que ya usa cada archivo, sin tocar ninguna otra línea.

Los 6 archivos comparten exactamente el mismo valor hoy (confirmado): `const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec';`. Es la ÚNICA línea que cambia en cada archivo.

- [ ] **Step 1: `menu.html`**

Reemplazar:
```js
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec';
```
por:
```js
const SCRIPT_URL = '/api/proxy-menu';
```

- [ ] **Step 2: Repetir el mismo reemplazo en `caja.html`, `cocina.html`, `asesorventas.html`, `comisiones.html`, `bienvenida.html`**

Buscar la misma línea exacta (`const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxl.../exec';`) en cada uno de los 5 archivos restantes y reemplazarla por `const SCRIPT_URL = '/api/proxy-menu';`.

- [ ] **Step 3: Verificar que no queda ninguna URL real de Apps Script visible en estos 6 archivos**

Run: `grep -l "script.google.com" menu.html caja.html cocina.html asesorventas.html comisiones.html bienvenida.html`
Expected: sin salida (ningún archivo la contiene ya)

- [ ] **Step 4: Prueba en vivo — repetir los 3 flujos ya validados en la sesión anterior (Domicilio, Mesas, Venta Rápida), ahora contra `vercel dev` en vez del `file://` directo**

Con `vercel dev` corriendo y logueado como cajero en el navegador (visitar `http://localhost:3000/login.html`, entrar con la clave de `.env.local`):
1. Abrir `http://localhost:3000/menu.html`, agregar un producto, hacer un pedido de prueba a Domicilio con datos etiquetados `PRUEBA-CLAUDE-PROXY-DOM`.
2. Verificar con `curl "http://localhost:3000/api/proxy-menu?accion=listar_pedidos_cocina"` que el pedido aparece.
3. Abrir `http://localhost:3000/caja.html` (ya logueado), verificar que carga el catálogo de Venta Rápida y el grid de mesas sin errores de consola.
4. Abrir `http://localhost:3000/cocina.html`, verificar que el pedido de prueba aparece en la lista.

Expected: los 3 flujos funcionan igual que cuando se probaron directo contra Apps Script — el proxy es transparente para la lógica ya construida.

- [ ] **Step 5: Commit**

```bash
git add menu.html caja.html cocina.html asesorventas.html comisiones.html bienvenida.html
git commit -m "fix: apuntar los 6 archivos del backend de Menu al proxy, ya no exponen el SCRIPT_URL real"
```

---

### Task 6: Botón de cerrar sesión (7 páginas) + restricción visual de solo-lectura para Admin (caja.html, cuadre.html)

**Files:**
- Modify: `caja.html` (botón cerrar sesión + CSS de solo-lectura para admin)
- Modify: `cuadre.html` (botón cerrar sesión + CSS de solo-lectura para admin)
- Modify: `cocina.html` (botón cerrar sesión)
- Modify: `inventario.html` (botón cerrar sesión)
- Modify: `empleados.html` (botón cerrar sesión)
- Modify: `asesorventas.html` (botón cerrar sesión)
- Modify: `comisiones.html` (botón cerrar sesión)

**Interfaces:**
- Consumes: `GET /api/session` (Task 2) para saber el rol actual; `POST /api/logout` (Task 2) para cerrar sesión.

Este es un candado **visual**, no el candado real (ese ya está en el proxy de Task 4 para `caja.html`/`comisiones.html`/`menu.html`). Para `cuadre.html` específicamente, este es el único límite entre Cajero y Admin que existe hoy (ver la nota de trade-off en el spec) — Admin es personal de confianza que ya pasó el login, así que ocultar los botones alcanza para el objetivo real (evitar que alguien lo haga por error o de pasada desde el celular).

- [ ] **Step 1: Snippet común — agregar a las 7 páginas, justo después de la etiqueta `<body>` (o al inicio del primer `<script>`, lo que exista primero en cada archivo)**

```html
<button id="btn-cerrar-sesion" onclick="cerrarSesionDeg()" style="position:fixed;top:8px;right:8px;z-index:999;padding:6px 12px;border-radius:20px;background:rgba(0,0,0,0.4);border:1px solid rgba(202,161,83,0.4);color:#f3e6d0;font-size:0.72rem;cursor:pointer;">Cerrar sesión</button>
<script>
  let ROL_SESION_DEG = null;
  async function cargarSesionDeg() {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      ROL_SESION_DEG = data.rol;
      if (ROL_SESION_DEG === 'admin') document.body.classList.add('deg-rol-admin');
    } catch (e) {}
  }
  async function cerrarSesionDeg() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  }
  cargarSesionDeg();
</script>
```

Aplicar este mismo bloque, sin cambios, en `cocina.html`, `inventario.html`, `empleados.html`, `asesorventas.html`, `comisiones.html` (5 archivos — solo el botón + cerrar sesión, sin restricción visual adicional porque esas 5 pantallas no distinguen Cajero de Admin en la matriz de acceso).

- [ ] **Step 2: En `caja.html`, agregar el mismo snippet del Step 1 MÁS la regla CSS de solo-lectura**

Agregar dentro del `<style>` existente de `caja.html`:
```css
body.deg-rol-admin .btn-cobrar,
body.deg-rol-admin .btn-liberar,
body.deg-rol-admin .btn-metodo,
body.deg-rol-admin #btn-venta-rapida { display: none !important; }
```

Y agregar el `id="btn-venta-rapida"` al botón de Venta Rápida (línea con `onclick="abrirVentaRapida()"`):
```html
<button class="btn-tab" id="btn-venta-rapida" onclick="abrirVentaRapida()">Venta Rápida</button>
```

- [ ] **Step 3: En `cuadre.html`, agregar el mismo snippet del Step 1 MÁS la regla CSS de solo-lectura**

Agregar dentro del `<style>` existente de `cuadre.html`:
```css
body.deg-rol-admin .btn-primario { display: none !important; }
```

(Los 6 usos de `.btn-primario` en este archivo son exactamente los botones de escritura: Confirmar apertura, Registrar gasto, Registrar pago, Registrar recogida, Registrar daño, Cerrar caja — confirmado, no hay ningún otro uso de esa clase en el archivo.)

- [ ] **Step 4: Prueba en vivo — rol Cajero ve todo, rol Admin ve solo lectura**

Con `vercel dev` corriendo:
1. Loguearse como `cajero` en `/login.html`, abrir `http://localhost:3000/caja.html` — el botón "Venta Rápida" y los botones "Cobrar"/"Liberar mesa" deben verse normales.
2. Cerrar sesión, loguearse como `admin`, abrir `http://localhost:3000/caja.html` — el botón "Venta Rápida" no debe aparecer, y al abrir el detalle de una mesa con pendientes no debe aparecer el botón "Cobrar".
3. Repetir el mismo contraste (cajero ve botones, admin no) en `http://localhost:3000/cuadre.html`.
4. En cualquiera de las 7 páginas, click en "Cerrar sesión" — debe redirigir a `/login.html` y una recarga de la página protegida debe volver a pedir login.

Expected: los 3 comportamientos se cumplen, sin errores de consola.

- [ ] **Step 5: Commit**

```bash
git add caja.html cuadre.html cocina.html inventario.html empleados.html asesorventas.html comisiones.html
git commit -m "feat: boton de cerrar sesion en las 7 paginas protegidas + vista de solo lectura para Admin en caja/cuadre"
```

---

### Task 7: Desplegar en Vercel, configurar variables de entorno, verificación final en vivo

**Files:**
- No se crean archivos nuevos — esta tarea es configuración en el dashboard de Vercel + verificación.

- [ ] **Step 1: Conectar el repo a Vercel (si `vercel dev` de Task 2 no lo dejó ya vinculado)**

Run: `npx vercel link` (elegir la cuenta/proyecto de Vercel del usuario, framework preset: "Other")

- [ ] **Step 2: Configurar las variables de entorno reales en el dashboard de Vercel (Project Settings → Environment Variables), para el entorno Production**

| Variable | Valor |
|---|---|
| `CAJERO_PASSWORD` | clave real que el dueño elija para el rol Cajero |
| `ADMIN_PASSWORD` | clave real que el dueño elija para el rol Admin (distinta a la de Cajero) |
| `SESSION_SECRET` | una cadena larga y aleatoria (por ejemplo generarla con `openssl rand -hex 32` en una terminal, o cualquier frase larga difícil de adivinar) |
| `SCRIPT_URL_MENU` | el mismo valor usado en `.env.local` de Task 2 — el `SCRIPT_URL` real que hoy está en `caja.html` |

Estas 4 claves NUNCA se agregan a ningún archivo del repo — solo viven en el dashboard de Vercel.

- [ ] **Step 3: Desplegar a producción**

Run: `npx vercel --prod`
Expected: la CLI muestra una URL de producción tipo `https://<nombre-proyecto>.vercel.app`

- [ ] **Step 4: Verificación en vivo contra el dominio real de Vercel (no localhost) — repetir las pruebas clave de las Tasks 2-6**

1. `curl -i https://<dominio-vercel>/caja.html` → debe dar `302` a `/login.html` (sin sesión).
2. `curl -s https://<dominio-vercel>/menu.html | head -c 200` → debe dar `200` con HTML real (página pública).
3. Login real desde el navegador en `https://<dominio-vercel>/login.html` con la clave real de Cajero recién configurada — confirmar que entra y que la cookie tiene el atributo `Secure` (Vercel producción es HTTPS, así que `cookieAttrs` ya lo agrega solo).
4. Con sesión de Cajero, hacer un pedido de prueba de Domicilio (`PRUEBA-CLAUDE-VERCEL-PROD`) desde `https://<dominio-vercel>/menu.html`, confirmar que aparece en `https://<dominio-vercel>/cocina.html`.
5. Con sesión de Admin, confirmar en `https://<dominio-vercel>/caja.html` que no aparecen los botones de cobro (Step 4 de Task 6, ahora en producción real).
6. `curl -i "https://<dominio-vercel>/api/proxy-menu?accion=marcar_pedido_pagado"` sin cookie → debe dar `403`, confirmando que el candado real del proxy también funciona en producción, no solo en local.

- [ ] **Step 5: Apagar/redirigir GitHub Pages**

En la configuración de GitHub Pages del repo (`jcdondeelgordo-bit/MenuDigital`), desactivar el Pages actual o dejar un único `index.html` de redirección a la URL de Vercel — no borrar el repo ni el historial, solo dejar de servir desde ahí. (Sin QR físicos impresos que migrar, confirmado con el usuario — sin presión de fecha aquí.)

- [ ] **Step 6: Limpieza de datos de prueba**

Borrar del Sheet real las filas etiquetadas `PRUEBA-CLAUDE-PROXY-DOM` (Task 5) y `PRUEBA-CLAUDE-VERCEL-PROD` (este Task, Step 4) en `Ventas`/`Clientes`.

- [ ] **Step 7: Actualizar `ESTADO.md`**

Agregar una entrada nueva en `Gestion_Proyecto/03-seguimiento/ESTADO.md` (sección "Para continuar") documentando: sistema de login por rol construido y desplegado en Vercel, dominio real, qué quedó protegido y qué no (inventario/empleados/cuadre solo a nivel de página), y que GitHub Pages quedó apagado/redirigido.

- [ ] **Step 8: Commit final**

```bash
git add Gestion_Proyecto/03-seguimiento/ESTADO.md
git commit -m "docs: registrar sistema de seguridad desplegado en Vercel en ESTADO.md"
```
