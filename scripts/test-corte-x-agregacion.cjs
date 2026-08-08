// Prueba aislada de la función pura de agregación del Corte X. Duplica
// agruparVentasParaCorteX_ y round2_ de Code.gs a propósito (los .gs no son
// módulos de Node) — si se edita la función en Code.gs, actualizar aquí también.

function round2_(n) { return Math.round(n * 100) / 100; }

function agruparVentasParaCorteX_(filas, idx) {
  const porProducto = {};
  const porMetodo = { Efectivo: 0, Nequi: 0, Tarjeta: 0 };
  const porCanal = {};
  let totalVenta = 0;
  filas.forEach(function (row) {
    const producto = (row[idx.producto] || '').toString().trim();
    if (!producto) return;
    const cantidad = parseFloat(row[idx.cantidad]) || 0;
    const total = parseFloat(row[idx.total]) || 0;
    if (!porProducto[producto]) porProducto[producto] = { cantidad: 0, total: 0 };
    porProducto[producto].cantidad += cantidad;
    porProducto[producto].total += total;
    totalVenta += total;
    const metodo = (row[idx.metodoPago] || '').toString().trim();
    if (metodo === 'Nequi') porMetodo.Nequi += total;
    else if (metodo === 'Tarjeta') porMetodo.Tarjeta += total;
    else porMetodo.Efectivo += total;
    const canal = (row[idx.tipoPedido] || '').toString().trim() || 'sin_canal';
    porCanal[canal] = (porCanal[canal] || 0) + total;
  });
  Object.keys(porProducto).forEach(function (k) {
    porProducto[k].cantidad = round2_(porProducto[k].cantidad);
    porProducto[k].total = round2_(porProducto[k].total);
  });
  Object.keys(porMetodo).forEach(function (k) { porMetodo[k] = round2_(porMetodo[k]); });
  Object.keys(porCanal).forEach(function (k) { porCanal[k] = round2_(porCanal[k]); });
  return { porProducto: porProducto, porMetodo: porMetodo, porCanal: porCanal, totalVenta: round2_(totalVenta) };
}

// --- Pruebas ---
const assert = require('assert');

const IDX = { producto: 3, cantidad: 4, total: 6, tipoPedido: 9, metodoPago: 15 };

function filaVenta(producto, cantidad, total, tipoPedido, metodoPago) {
  const row = new Array(16).fill('');
  row[IDX.producto] = producto;
  row[IDX.cantidad] = cantidad;
  row[IDX.total] = total;
  row[IDX.tipoPedido] = tipoPedido;
  row[IDX.metodoPago] = metodoPago;
  return row;
}

// Test 1: agrupa dos ventas del mismo producto y suma cantidad/total
(function testAgrupaMismoProducto() {
  const filas = [
    filaVenta('GASEOSA 500', 1, 4500, 'local', 'Efectivo'),
    filaVenta('GASEOSA 500', 2, 9000, 'local', 'Efectivo')
  ];
  const r = agruparVentasParaCorteX_(filas, IDX);
  assert.deepStrictEqual(r.porProducto['GASEOSA 500'], { cantidad: 3, total: 13500 });
  assert.strictEqual(r.totalVenta, 13500);
  console.log('OK: testAgrupaMismoProducto');
})();

// Test 2: separa totales por método de pago, y todo lo que no sea Nequi/Tarjeta cae en Efectivo
(function testPorMetodoPago() {
  const filas = [
    filaVenta('PIZZA PERRO', 1, 9000, 'local', 'Nequi'),
    filaVenta('PIZZA PERRO', 1, 9000, 'local', 'Tarjeta'),
    filaVenta('PIZZA PERRO', 1, 9000, 'local', 'Efectivo'),
    filaVenta('PIZZA PERRO', 1, 9000, 'local', '')
  ];
  const r = agruparVentasParaCorteX_(filas, IDX);
  assert.deepStrictEqual(r.porMetodo, { Efectivo: 18000, Nequi: 9000, Tarjeta: 9000 });
  console.log('OK: testPorMetodoPago');
})();

// Test 3: separa totales por canal (Tipo_Pedido), usando 'sin_canal' si viene vacío
(function testPorCanal() {
  const filas = [
    filaVenta('SALCHIPAPA', 1, 18000, 'domicilio', 'Efectivo'),
    filaVenta('SALCHIPAPA', 1, 18000, 'mostrador', 'Efectivo'),
    filaVenta('SALCHIPAPA', 1, 18000, '', 'Efectivo')
  ];
  const r = agruparVentasParaCorteX_(filas, IDX);
  assert.deepStrictEqual(r.porCanal, { domicilio: 18000, mostrador: 18000, sin_canal: 18000 });
  console.log('OK: testPorCanal');
})();

// Test 4: una fila sin nombre de producto se ignora por completo (fila corrupta/vacía)
(function testIgnoraFilaSinProducto() {
  const filas = [filaVenta('', 5, 50000, 'local', 'Efectivo')];
  const r = agruparVentasParaCorteX_(filas, IDX);
  assert.deepStrictEqual(r.porProducto, {});
  assert.strictEqual(r.totalVenta, 0);
  console.log('OK: testIgnoraFilaSinProducto');
})();

// Test 5: sin filas (día sin ventas todavía) devuelve todo en cero, no un error
(function testSinFilas() {
  const r = agruparVentasParaCorteX_([], IDX);
  assert.deepStrictEqual(r.porProducto, {});
  assert.deepStrictEqual(r.porMetodo, { Efectivo: 0, Nequi: 0, Tarjeta: 0 });
  assert.deepStrictEqual(r.porCanal, {});
  assert.strictEqual(r.totalVenta, 0);
  console.log('OK: testSinFilas');
})();

console.log('Todas las pruebas de agruparVentasParaCorteX_ pasaron.');
