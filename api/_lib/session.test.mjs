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
