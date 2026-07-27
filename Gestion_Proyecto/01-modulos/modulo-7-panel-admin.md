# Módulo 7 — Panel administrativo

## Objetivo
Vista consolidada del negocio para el dueño/administrador.

## Funcionalidades (del plan original)
- Ventas por día.
- Productos más vendidos (diferenciando pizzas y desechables, según nota del usuario).
- Horas de mayor movimiento.
- Clientes frecuentes.
- Productos agotados.
- Idea diferenciadora: botón "Llamar al mesero" desde el menú del cliente — al pulsarlo, en la pantalla del administrador aparece "Mesa 5 solicita atención".
- Botones rápidos adicionales desde el menú del cliente:
  - 🧾 Pedir la cuenta.
  - 🥤 Solicitar otra bebida.
  - 🍅 Pedir más salsa.
  - 🙋 Llamar al mesero.

## Qué ya existe
- `INVENTARIO DONDE EL GORDO.xlsx` ya tiene una hoja `Reporte` — revisar si ya cubre parte de estas métricas (ventas, horas, productos más vendidos) antes de construir algo nuevo.

## Qué falta
- Dashboard web que consuma Apps Script y muestre las métricas listadas arriba, cruzando datos de `Pedidos`, `Ventas`, `Clientes`, `Inventario_Insumos`.
- Sistema de "botones rápidos" en la pantalla del cliente (mesa) que generen una notificación en el panel del administrador — requiere un canal casi-tiempo-real (polling) similar al del Módulo 3.
- Vista de clientes frecuentes cruzando `Clientes` con historial de compras (Módulo 6).
- Vista de productos agotados cruzando con `Inventario_Insumos` (Módulo 5).

## Dependencias
- Es el módulo que más depende de los demás: necesita que Módulos 2, 3, 4, 5 y 6 ya estén generando datos para tener algo que mostrar. Por eso va último en el orden de fases.
