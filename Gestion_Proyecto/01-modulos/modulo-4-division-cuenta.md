# Módulo 4 — División de cuenta

## Objetivo
Permitir dividir la cuenta de una mesa de forma flexible — función de alto valor, poco común en otros sistemas.

## Funcionalidades (del plan original)
Ejemplo dado en el plan (Mesa 8): Juan pide hamburguesa + gaseosa, Ana pide pizza personal, Carlos pide salchipapa + jugo. El sistema debe permitir:
- Cobrar a cada persona por separado.
- Dividir la cuenta en partes iguales.
- Combinar algunas cuentas (ej. Juan y Ana pagan juntos, Carlos aparte).

## Qué ya existe
- Nada todavía. Depende de que los pedidos por mesa (Módulo 2) registren qué ítem pidió cada persona, no solo la mesa en general.

## Qué falta
- Modelo de datos que asocie cada ítem del pedido a una persona dentro de la mesa (no solo a la mesa como unidad).
- Pantalla/flujo de caja para: ver el desglose por persona, agrupar/combinar personas, calcular división en partes iguales.
- Registrar la propina asociada al mesero que atendió (ver regla abajo).

## Regla de la propina (confirmada por el usuario, 2026-07-14)
La propina **no** entra al bono grupal del Módulo 8 — se le otorga **directamente al mesero individual** que atendió esa mesa/venta, porque fue su labor la que llevó a que se diera la propina. Consecuencia para el diseño: la propina debe registrarse por venta con el mesero asociado (mismo registro de `Ventas` que ya lleva la columna `Mesero`, ver Módulo 8), separada del monto de la venta en sí, para poder liquidarla individualmente sin mezclarla con el reparto grupal por ranking.

## Dependencias
- Depende del Módulo 2 (estructura del pedido debe soportar "quién pidió qué" dentro de la mesa).
- Depende del Módulo 8 (la propina se asocia al mismo mesero registrado en la venta).
- Alimenta al Módulo 7 (panel administrativo) con el detalle de ventas cerradas.
- Alimenta al Módulo 9 (Caja y Facturación) — la cuenta dividida es lo que el cajero cobra e imprime.
