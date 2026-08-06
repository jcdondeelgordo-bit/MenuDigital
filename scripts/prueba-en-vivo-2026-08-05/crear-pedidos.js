const BASE = 'https://donde-el-gordo.vercel.app/api/proxy-menu';

async function crearPedido({ items, tipo, mesa, mesero }) {
  const params = new URLSearchParams({
    accion: 'crear_pedido',
    items: JSON.stringify(items),
    total: String(items.reduce((s, it) => s + it.precio * it.cantidad, 0)),
    tipo,
    mesa: mesa || '',
    mesero: mesero || ''
  });
  const r = await fetch(BASE + '?' + params.toString());
  const json = await r.json();
  console.log(tipo, '->', json);
  return json;
}

async function main() {
  await crearPedido({
    tipo: 'domicilio',
    items: [
      { producto: 'Sencilla', categoria: 'Hamburguesas', precio: 14000, cantidad: 1, observacion: 'PRUEBA carga julio 2026 - domicilio' }
    ]
  });

  await crearPedido({
    tipo: 'mostrador',
    mesa: 'PRUEBA Venta Rápida',
    items: [
      { producto: 'Pollo', categoria: 'Hamburguesas', precio: 18000, cantidad: 1, observacion: 'PRUEBA carga julio 2026 - venta rapida' }
    ]
  });
}

main().catch(e => console.error('ERROR:', e.message));
