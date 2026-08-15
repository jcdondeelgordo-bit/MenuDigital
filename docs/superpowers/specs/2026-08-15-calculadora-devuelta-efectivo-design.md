# Calculadora de devuelta en Efectivo — caja.html

**Fecha:** 2026-08-15
**Estado:** Diseño aprobado, pendiente de implementación

## Problema

Hoy, cuando el cajero toca "💵 Efectivo" en cualquiera de los 4 lugares donde se cobra en `caja.html`, el cobro se confirma de inmediato — no hay ningún paso que calcule cuánto devolverle al cliente. El cajero hace esa cuenta de cabeza, sin ayuda de la pantalla y sin que quede ningún rastro de cuánto recibió ni cuánto devolvió. El dueño pidió que el sistema siempre calcule y muestre la devuelta, en grande y bien clara, para reducir errores al dar cambio.

## Decisiones confirmadas con el usuario

- **Paso obligatorio**: no se puede confirmar un cobro en Efectivo sin antes escribir cuánto pagó el cliente — no hay atajo de "pago exacto".
- **Bloquea si el valor es insuficiente**: el botón de confirmar queda deshabilitado mientras "Paga con" sea menor al total; no se puede registrar un cobro incompleto como pagado.
- **Se guarda en el Sheet**: el valor recibido y la devuelta quedan como columnas nuevas, no solo como un cálculo que desaparece de pantalla — sirve de rastro para el cuadre de caja y Corte X.
- **Aplica a los 4 lugares donde hoy se cobra en efectivo**: cobro individual, cobro de mesa completa, pago dividido (cada parte por separado), y Venta Rápida.
- **Entrada con botones de billetes + campo editable**: botones de denominaciones comunes en COP (2mil/5mil/10mil/20mil/50mil/100mil) que suman al tocarlos, más un campo editable directo, más un botón "Borrar" que limpia el valor acumulado para volver a empezar si el cajero se equivoca.
- **También se imprime en el recibo**: cuando el pago fue Efectivo, el recibo de 80mm agrega las líneas "Recibió" / "Devuelta".

## Arquitectura

Un solo panel nuevo (`overlay-efectivo`) reemplaza el confirmar directo de "💵 Efectivo" en los 3 modales de método de pago existentes (`overlay-cobrar`, `overlay-cobrar-parcial`, `overlay-cobrar-vr`). Nequi y Tarjeta no cambian — siguen confirmando directo, sin vuelto físico que calcular.

```
Cajero toca "💵 Efectivo"
  en cualquiera de los 4 flujos
        │
        ▼
abrirCalculadoraEfectivo(total, onConfirmar)
  guarda { efectivoTotal, efectivoCallback }
        │
        ▼
Panel: Total (grande) / Paga con (input + botones de billete + Borrar) / Devuelta (grande, en vivo)
        │
        ▼ (Confirmar, solo habilitado si recibido >= total)
efectivoCallback(recibido, devuelta)
        │
        ▼
confirmarCobro / confirmarCobroMesa / confirmarCobroParcial / confirmarCobroVentaRapida
  (ahora reciben recibido/devuelta, los mandan al backend y al recibo)
```

### Estado global nuevo (mismo patrón que `cobroModo`/`montoParaCobrarParcial`)

```js
let efectivoTotal = 0;
let efectivoValor = 0;      // acumulado por botones de billete + campo editable
let efectivoCallback = null; // (recibido, devuelta) => void, específico de cada uno de los 4 flujos
```

### Panel `overlay-efectivo` (HTML nuevo, mismo estilo `.modal-cobrar` que los otros overlays de cobro)

- **Total a pagar** — texto grande, fijo, viene de `efectivoTotal`.
- **Paga con** — `<input type="number">` editable a mano, sincronizado con `efectivoValor`; fila de botones `[2mil][5mil][10mil][20mil][50mil][100mil]` que suman al valor actual al tocarlos; botón "Borrar" que pone `efectivoValor = 0`.
- **Devuelta** — texto grande, se recalcula en cada cambio (`efectivoValor - efectivoTotal`): rojo con el faltante mientras sea negativo, verde con el vuelto cuando sea ≥ 0.
- **Confirmar** — `disabled` mientras `efectivoValor < efectivoTotal`.
- **Cancelar** — cierra el panel sin llamar `efectivoCallback`, sin tocar el cobro.

### Wiring de los 4 puntos de entrada

Cada uno de los 3 modales de método de pago cambia su botón "💵 Efectivo" de una llamada directa a `confirmarCobro('Efectivo')` (o equivalente) a abrir la calculadora con el total correcto y un callback que llama a la función de confirmación original, ahora con 2 argumentos nuevos:

| Flujo | Botón hoy | Total a pasar | Callback |
|---|---|---|---|
| Cobro individual (`overlay-cobrar`, modo `individual`) | `confirmarCobro('Efectivo')` | `pedidos.find(p => p.id_pedido === pedidoIdParaCobrar).total` | `(r, d) => confirmarCobro('Efectivo', r, d)` |
| Cobro de mesa completa (`overlay-cobrar`, modo `mesa`) | `confirmarCobro('Efectivo')` | suma de `.total` de `idsParaCobrarMesa` sobre `pedidos` | `(r, d) => confirmarCobro('Efectivo', r, d)` (mismo botón — `confirmarCobro` ya bifurca a `confirmarCobroMesa` según `cobroModo`) |
| Pago dividido (`overlay-cobrar-parcial`) | `confirmarCobroParcial('Efectivo')` | `montoParaCobrarParcial` (ya calculado al abrir) | `(r, d) => confirmarCobroParcial('Efectivo', r, d)` |
| Venta Rápida (`overlay-cobrar-vr`) | `confirmarCobroVentaRapida('Efectivo')` | suma de `precio * cantidad` de `itemsVentaRapidaSnapshot`/`carritoVentaRapida` (mismo cálculo que ya hace `confirmarCobroVentaRapida`) | `(r, d) => confirmarCobroVentaRapida('Efectivo', r, d)` |

Los botones de Nequi/Tarjeta en los 3 modales no cambian.

### Cambios en las 4 funciones de confirmación

Cada una gana 2 parámetros opcionales `recibido`/`devuelta` (`undefined` para Nequi/Tarjeta):

- Se agregan a los `URLSearchParams` de la llamada a `marcar_pedido_pagado` / `registrar_pago_parcial` solo si vienen definidos (`efectivo_recibido`, `efectivo_devuelta`).
- Se adjuntan al objeto `pedido`/literal que se le pasa a `imprimirRecibo(...)` (`efectivoRecibido`, `efectivoDevuelta`), para que el recibo los pueda mostrar.

`confirmarCobroMesa` (llamada desde `confirmarCobro` cuando `cobroModo === 'mesa'`) manda el mismo `recibido`/`devuelta` a cada `marcar_pedido_pagado` de los ids de esa mesa — es un solo cobro en efectivo para toda la mesa, no una devuelta por ronda.

### Backend — Apps Script del Menú

**`marcarPedidoPagado` (Módulo 9, `modulo-9-apps-script-caja.gs.txt`)**: acepta `e.parameter.efectivo_recibido` / `e.parameter.efectivo_devuelta` (opcionales). Si vienen y `metodoPago === 'Efectivo'`, escribe esos 2 valores en las columnas nuevas `Efectivo_Recibido`/`Efectivo_Devuelta` de `Ventas`, en las mismas filas donde ya escribe `Estado`/`Metodo_Pago` (todas las filas de ese `ID_Pedido`).

**`registrarPagoParcial` (Módulo 4, `modulo-4-apps-script-division.gs.txt`)**: mismo tratamiento, pero escribiendo en la fila nueva que agrega a `Pagos_Divididos` (no en `Ventas` — ahí solo se sigue marcando `Metodo_Pago = 'Dividido'` cuando se completa el pedido, sin cambios).

### Sheet — columnas nuevas (el usuario las agrega a mano, mismo patrón que módulos anteriores)

- `Ventas`: `Efectivo_Recibido`, `Efectivo_Devuelta` (vacías si el método no fue Efectivo).
- `Pagos_Divididos`: `Efectivo_Recibido`, `Efectivo_Devuelta` (vacías si esa parte no se pagó en Efectivo).

### Recibo (`imprimirRecibo`, `caja.html`)

Después de la línea `Pago: ${pedido.metodo_pago}`, si `pedido.metodo_pago === 'Efectivo'` y `pedido.efectivoRecibido` viene definido, se agregan 2 líneas:

```
Recibió: $50.000
Devuelta: $8.000
```

## Manejo de errores

- Si `abrirCalculadoraEfectivo` no logra determinar el total (caso raro, ej. pedido ya no está en `pedidos`), no abre el panel y deja el flujo como estaba — mismo criterio defensivo que ya usa el resto de `caja.html`.
- Si falla la escritura de las columnas nuevas en el backend (ej. porque el usuario todavía no las agregó al Sheet), `marcarPedidoPagado`/`registrarPagoParcial` no deben romperse — si el índice de columna no existe (`indexOf` devuelve -1), simplemente se omite esa escritura puntual, el resto del cobro (Estado/Metodo_Pago) sigue funcionando igual que hoy.
- El cobro en sí (Estado=Pagado) nunca depende de que el registro de recibido/devuelta tenga éxito — es información complementaria, no bloqueante.

## Fuera de alcance (deliberado)

- No valida denominaciones reales entregadas físicamente (ej. si el cajero dice que recibió un billete de 50mil pero en realidad el cliente entregó otra cosa) — es una calculadora de ayuda, no un lector de billetes.
- No agrega un modo "pago exacto" de un solo toque — siempre hay que llegar al total, aunque sea con los botones de billete.
- No cambia el comportamiento de Nequi/Tarjeta.
- No genera ningún reporte nuevo con estos datos — Corte X y Cuadre de Caja podrían sumarlos más adelante, pero eso es trabajo aparte, no de este build.

## Pendiente operativo del usuario (no bloquea el build)

- Agregar las columnas `Efectivo_Recibido`/`Efectivo_Devuelta` a `Ventas` y a `Pagos_Divididos` en el Sheet real, y volver a pegar/publicar los 2 archivos de Apps Script actualizados (Módulo 9 y Módulo 4).
