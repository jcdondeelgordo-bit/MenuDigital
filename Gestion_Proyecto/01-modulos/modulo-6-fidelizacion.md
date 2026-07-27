# Módulo 6 — Fidelización

## Objetivo
Premiar al cliente frecuente e incentivar el ticket promedio.

## Funcionalidades (del plan original)
- Historial de compras.
- Cumpleaños.
- Puntos.
- Promociones automáticas.
- Tarjeta de puntos: 12 puntos, que deben incrementarse automáticamente por cada compra mayor a $50.000 COP.

## Qué ya existe
- Captura de nombre + WhatsApp ya funciona (`bienvenida.html`).
- Hoja `Clientes` ya existe en `BD_ZFood_GyP_DondeElGordo.xlsx`.

## Qué falta
- Campo de fecha de nacimiento (mm/aaaa) — depende de que el Módulo 2 lo agregue a la captura de cliente.
- Columna/lógica de puntos en la hoja `Clientes` (o una hoja nueva `Puntos`): incrementar automáticamente cuando una compra registrada en `Ventas` supera $50.000.
- Lógica de cumpleaños: aviso o promoción automática en el mes de nacimiento.
- Historial de compras visible para el cliente o el administrador.

## Premio de la tarjeta de 12 puntos: se resuelve con un juego aparte (decidido 2026-07-14)
El usuario confirmó que el premio **no** es un valor fijo — al completar la tarjeta se juega una **ruleta de premios**, con opciones como: porción de pizza, gaseosa 1.5L, hamburguesa, perro caliente, "vuelva a intentar" (sin premio), entre otras.

**Esto se construye aparte, más adelante — fuera de alcance de esta fase del Módulo 6.** Por ahora solo queda anotado como su propio mini-proyecto futuro (mecánica de ruleta + catálogo de premios configurable + lógica de qué pasa al ganar cada premio, ej. descuento en el siguiente pedido). Cuando se aborde, tendrá su propio documento de módulo.

## Dependencias
- Depende de los datos de cliente capturados en el Módulo 2.
- Depende del historial de ventas (Módulo 4 / ventas cerradas) para calcular puntos.
- Su historial y puntos son visibles desde el Módulo 7 (panel administrativo).
