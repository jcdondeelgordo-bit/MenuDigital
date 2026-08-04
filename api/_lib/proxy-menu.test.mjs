// api/_lib/proxy-menu.test.mjs — Test harness for proxy-menu.js
// Tests the permission logic and backend integration directly via Node's
// Request/Response API, without requiring vercel dev.

// ⚠️ IMPORTANT: Set environment BEFORE imports, since the handler module reads them at load time
process.env.SESSION_SECRET = 'test-secret-key-for-testing-only-12345';
process.env.SCRIPT_URL_MENU = 'https://script.google.com/macros/s/AKfycbxlYXsASFJpzw9arECb79_CLb3l5w-4cithWANH57ydFHbC2-788aFJddvWIxOjOyEr/exec';

// Verify environment is set
console.log('Environment check:');
console.log(`  SESSION_SECRET set: ${!!process.env.SESSION_SECRET}`);
console.log(`  SCRIPT_URL_MENU set: ${!!process.env.SCRIPT_URL_MENU}`);
console.log(`  SCRIPT_URL_MENU value: ${process.env.SCRIPT_URL_MENU}\n`);

import assert from 'node:assert/strict';
import { signSession } from './session.js';

// Dynamically import the handler AFTER environment is set
const { default: handler } = await import('../proxy-menu.js');

console.log('Handler imported successfully\n');

const baseUrl = 'http://localhost/api/proxy-menu';

// Helper to create a Request object
function createRequest(url, options = {}) {
  return new Request(url, options);
}

// Helper to create a Request with a cookie
async function createRequestWithCookie(url, rol) {
  const token = await signSession(rol);
  return new Request(url, {
    headers: { Cookie: `deg_session=${token}` }
  });
}

// Test results tracking
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (err) {
    results.push({ name, status: 'FAIL', error: err.message });
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

// Run all tests
async function runTests() {
  console.log('Starting proxy-menu.js tests...\n');

  // Test 1: Public action without cookie should return 200 with real data
  await test('Test 1a: listar_productos without cookie → 200 with real data', async () => {
    const request = createRequest(`${baseUrl}?accion=listar_productos`);
    const response = await handler(request);

    assert.equal(response.status, 200, `Expected 200, got ${response.status}`);

    const body = await response.json();
    assert.equal(body.ok, true, `Expected ok:true, got ok:${body.ok}`);
    // Backend returns 'productos' field for listar_productos action
    assert(Array.isArray(body.productos), 'Expected productos to be an array');
    assert(body.productos.length > 0, 'Expected product data to be non-empty');
  });

  // Test 1b: marcar_pedido_pagado without cookie should return 403
  await test('Test 1b: marcar_pedido_pagado without cookie → 403 unauthorized', async () => {
    const request = createRequest(`${baseUrl}?accion=marcar_pedido_pagado&id_pedido=x&metodo_pago=Efectivo`);
    const response = await handler(request);

    assert.equal(response.status, 403, `Expected 403, got ${response.status}`);

    const body = await response.json();
    assert.equal(body.ok, false, 'Expected ok:false');
    assert.equal(body.error, 'no autorizado', `Expected error 'no autorizado', got '${body.error}'`);
  });

  // Test 1c: marcar_pedido_pagado with cajero cookie should pass through to backend
  await test('Test 1c: marcar_pedido_pagado with cajero cookie → NOT 403', async () => {
    const request = await createRequestWithCookie(`${baseUrl}?accion=marcar_pedido_pagado&id_pedido=x&metodo_pago=Efectivo`, 'cajero');
    const response = await handler(request);

    assert.notEqual(response.status, 403, `Expected NOT 403, got ${response.status}`);
    // The backend may return 200, 400, 500, or other status — we just verify it's not a permission rejection
  });

  // Test 1d: actualizar_precio with cajero cookie (wrong role) should return 403
  await test('Test 1d: actualizar_precio with cajero cookie (wrong role) → 403', async () => {
    const request = await createRequestWithCookie(`${baseUrl}?accion=actualizar_precio&producto=Sencilla&precio=15000`, 'cajero');
    const response = await handler(request);

    assert.equal(response.status, 403, `Expected 403, got ${response.status}`);

    const body = await response.json();
    assert.equal(body.ok, false, 'Expected ok:false');
    assert.equal(body.error, 'no autorizado', `Expected error 'no autorizado', got '${body.error}'`);
  });

  // Test 1e: actualizar_precio with admin cookie should pass through to backend
  await test('Test 1e: actualizar_precio with admin cookie → NOT 403', async () => {
    const request = await createRequestWithCookie(`${baseUrl}?accion=actualizar_precio&producto=Sencilla&precio=15000`, 'admin');
    const response = await handler(request);

    assert.notEqual(response.status, 403, `Expected NOT 403, got ${response.status}`);
    // The backend may return 200, 400, 500, or other status — we just verify it's not a permission rejection
  });

  // Test 1f: Unknown action should return 400
  await test('Test 1f: unknown action → 400 accion desconocida', async () => {
    const request = createRequest(`${baseUrl}?accion=algo_que_no_existe`);
    const response = await handler(request);

    assert.equal(response.status, 400, `Expected 400, got ${response.status}`);

    const body = await response.json();
    assert.equal(body.ok, false, 'Expected ok:false');
    assert.equal(body.error, 'accion desconocida', `Expected error 'accion desconocida', got '${body.error}'`);
  });

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✓' : '✗';
    console.log(`${icon} ${r.name}`);
    if (r.error) {
      console.log(`  Error: ${r.error}`);
    }
  });

  console.log(`\n${passed}/${results.length} assertions passing`);

  if (failed > 0) {
    console.log(`\nFAILED: ${failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log('\nSUCCESS: All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
