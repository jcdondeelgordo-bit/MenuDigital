# Módulo 2 — Pedidos desde la mesa

## Objetivo
Que el pedido llegue a cocina sin que el cliente tenga que buscar un mesero, o que el mesero lo tome directamente.

## Funcionalidades (del plan original)
- Opcional: cada mesa tiene un QR único. El cliente escanea y el sistema identifica la mesa automáticamente. El pedido llega sin buscar mesero.
- Alternativa: el mesero ofrece y toma el pedido, tomando el número de mesa o el QR de la mesa.
- En cualquiera de las dos formas, se capturan datos del cliente: **nombre, celular y fecha de nacimiento (mm/aaaa)**.

## Qué ya existe
- Captura de nombre + WhatsApp ya funciona en `bienvenida.html` vía Apps Script (`buscar_cliente`/`actualizar_cliente`).
- Hoja `Clientes` en `BD_ZFood_GyP_DondeElGordo.xlsx` ya existe como destino de estos datos.
- Hoja `Pedidos` existe hoy en `BD_ZFood_GyP_DondeElGordo.xlsx`, pero **queda descartada como destino final** — ver decisión de unificación abajo.

## Decisión: el pedido se registra en `Hoja Ventas`, no en una `Hoja Pedidos` separada (confirmado por el usuario, 2026-07-14)
El pedido de una mesa **es** la venta del día — no son dos conceptos distintos. Por lo tanto el pedido no se guarda en una hoja `Pedidos` aparte: se registra directamente en la **hoja `Ventas`** (hoy en `INVENTARIO DONDE EL GORDO.xlsx`), con una columna de **estado** (Pendiente/En preparación/Listo/Entregado, ver Módulo 3) que se actualiza a medida que avanza. Ver la nota de unificación en `00-PLAN-MAESTRO.md`.

## Corrección (2026-07-14)
Al revisar el código completo de `bienvenida.html` durante la construcción del Módulo 1, se confirmó que la **captura de fecha de nacimiento ya existe** (`input-cumple`, tipo `date`, enviado como `cumpleanos` a la acción `registrar_cliente`). La nota anterior de este documento decía que faltaba — estaba equivocada, se corrige aquí.

## Hallazgo: Domicilio vs. En el local (detectado durante la construcción del Módulo 1, 2026-07-14)
Al construir el checkout del menú digital, el usuario confirmó que el pedido no es un solo camino — debe distinguir:
- **Domicilio:** no pasa por cocina/caja del sistema todavía; se resuelve por WhatsApp (recargo variable por zona, Nequi y tiempo de espera los confirma el negocio manualmente).
- **En el local:** sí debe pasar a cocina y quedar pendiente de pago en caja.

Como parte del Módulo 1 ya se construyó una primera versión de la acción `crear_pedido` (ver `modulo-1-apps-script-nuevo.gs.txt`) que cubre el camino "En el local": escribe una fila por ítem en `Hoja Ventas` con estado `Pendiente de pago` y un `ID_Pedido` compartido para agrupar los ítems de un mismo pedido. Todavía falta que este módulo (Módulo 2) cubra a fondo: identificación de mesa, asociación mesero (Módulo 8), y el flujo completo de "mesero toma el pedido" — lo construido en el Módulo 1 es la base, no el módulo completo.

## Qué falta
- Identificación de mesa por QR (parámetro `?mesa=N` en la URL) o selección manual por el mesero.
- Pantalla/flujo para que el mesero tome el pedido en nombre del cliente.
- Asociar mesero (Módulo 8) y mesa a cada fila que `crear_pedido` escribe en `Ventas` — hoy el endpoint ya existe pero sin esos dos campos.

## Dependencias
- Depende del catálogo y carrito del Módulo 1 (ya construidos).
- Alimenta directamente al Módulo 3 (comanda de cocina) y a la hoja `Clientes` que usará el Módulo 6 (fidelización).
- **Nota de seguridad:** aquí se capturan datos personales sensibles (celular, fecha de nacimiento) — ver nota de seguridad transversal en `00-PLAN-MAESTRO.md`.
