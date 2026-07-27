# Módulo 3 — Comanda de cocina

## Objetivo
Pantalla exclusiva para cocina que muestre los pedidos entrantes y su estado.

## Funcionalidades (del plan original)
- Dos formas posibles de mandar la comanda: impresora de tickets o tablets — se debe elegir la mejor opción.
- Pedidos ordenados por hora.
- Estado del pedido: Pendiente / En preparación / Listo / Entregado.
- Aviso visual y auditivo (pitido) cuando entra un nuevo pedido.

## Qué ya existe
- Nada específico todavía. Depende de que los pedidos ya se estén guardando en la hoja `Pedidos` (Módulo 2).

## Decisión: pantalla tipo tablet (confirmada por el usuario, 2026-07-14)
Se descarta la impresora de tickets para cocina — la comanda se maneja en una **pantalla/tablet interactiva** (lista con checks, no un ticket de papel). La impresora térmica sí se usa, pero en Caja (ver Módulo 9), para el recibo de pago del cliente — son necesidades distintas.

## Diseño detallado de la pantalla (basado en un sistema que el usuario ya usó antes, 2026-07-14)
- **Lista de pedidos con hora**: cada pedido/ítem muestra la hora en que se tomó.
- **Visto bueno por ítem**: cada ítem del pedido tiene un check para marcar que ya se pasó/entregó a cocina o se despachó.
- **Hora que se actualiza**: el tiempo transcurrido se refresca en pantalla (para ver qué pedido lleva más tiempo esperando).
- **Marca de "salió completo"**: indicador de que todo el pedido ya fue despachado.
- **Poder "devolverse" a revisar el historial**: navegar hacia atrás en la lista para ver qué se despachó de pedidos anteriores y qué falta — esto es clave porque **los tiempos de preparación varían mucho por producto**:
  - Pizza: rápida, ya está lista, solo se calienta y se pasa.
  - Hamburguesa: 4 a 7 minutos, según qué tan llena esté la plancha.
  - Churrasco: 20 a 28 minutos, también según carga de la plancha.

  Como los ítems de un mismo pedido pueden salir en momentos distintos (la pizza sale antes que el churrasco aunque se hayan pedido juntos), el check y el "devolverse a revisar" deben ser **por ítem dentro del pedido**, no solo por pedido completo.

## Qué falta
- Pantalla web de cocina (tablet) con: lista ordenada por hora, check por ítem, indicador de tiempo transcurrido, marca de pedido completo, y navegación hacia atrás en el historial reciente.
- Endpoint Apps Script para leer pedidos pendientes/en preparación y actualizar su estado (a nivel de ítem) en la hoja `Ventas` (ver decisión Pedido=Venta en `00-PLAN-MAESTRO.md`).
- Mecanismo de actualización en tiempo real o casi real (polling periódico, dado que se mantiene Google Sheets/Apps Script — no hay websockets nativos).
- Aviso sonoro/visual al entrar un pedido nuevo (se puede lograr en el navegador con audio + polling).

## Dependencias
- Depende de que el Módulo 2 esté generando pedidos/ventas en la hoja `Ventas`.
- El estado que se marque aquí ("Listo", "Entregado", por ítem) es insumo para el Módulo 7 (panel administrativo) y para el Módulo 9 (Caja), que necesita saber cuándo el pedido está completo para poder cobrar.
