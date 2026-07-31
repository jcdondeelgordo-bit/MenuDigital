# Venta Rápida en Caja — Diseño

Fecha: 2026-07-31

## Contexto y problema

`caja.html` hoy solo puede cobrar pedidos que ya llegaron desde `menu.html` (autoservicio/mesero) o
`asesorventas.html` (mesero) — no hay ninguna forma de registrar un pedido directamente desde Caja.
El usuario describió un caso real y frecuente: clientes que se acercan directo al mostrador sin pasar
por mesa ni mesero, en dos variantes: (1) piden y pagan de una vez, se lo llevan ya; (2) dejan el pago
primero y vuelven más tarde a recogerlo. Esta idea ya había quedado anotada como pendiente futura en
`ESTADO.md` al brainstormear Asesor de Ventas (2026-07-31), sin diseñar todavía.

Explorando el backend existente se confirmó que esto se puede construir **sin ninguna acción nueva de
Apps Script** — `crear_pedido`, `marcar_pedido_pagado` y `liberar_pedido` (todas ya desplegadas y
verificadas en vivo) cubren el flujo completo.

## Alcance

Incluye:
- Botón nuevo "🧾 Venta Rápida" en el encabezado de `caja.html`, junto a "🕒 Historial de hoy".
- Modal con catálogo completo por categorías (misma fuente que `menu.html`, `listar_productos`),
  carrito en memoria (no `localStorage` — dispositivo compartido de caja), campo de nombre del cliente.
- Dos cierres de flujo: **"Cobrar y entregar"** (pagado y llevado ya, sin nada que rastrear después) y
  **"Cobrar y dejar para recoger"** (pagado, queda pendiente hasta que el cliente vuelva).
- Nueva sección "Para recoger" en el grid principal de `caja.html`, debajo de mesas/domicilio: lista
  (no cupos fijos, a diferencia de Domicilio) de pedidos `mostrador` pagados esperando recogida.
- Ajuste en `cocina.html`: etiqueta correcta para pedidos tipo `mostrador` (hoy caería por defecto en
  la etiqueta de "Mesa").

No incluye (fuera de alcance, explícitamente descartado en el brainstorming):
- Edición de precios desde este catálogo — solo lectura/selección, igual que el resto de catálogos de
  cliente. La edición de precios sigue siendo exclusiva de `menu.html` en modo admin.
- Cupos fijos para "Para recoger" — se descartó el patrón de Domicilio (5 cupos) porque no hay un
  límite físico natural de cuántos pedidos de mostrador pueden estar esperando recogida a la vez.
- Filtrar qué productos van o no a cocina según si "necesitan preparación" — toda Venta Rápida activa
  `Estado_Cocina='Pendiente'` igual que cualquier otro pedido local; si un producto no necesita
  preparación (ej. una gaseosa embotellada), el cocinero simplemente lo marca "Entregado" de inmediato.
  No existe hoy ningún campo en `Productos` que distinga esto, y agregarlo sería trabajo extra sin
  necesidad real confirmada.
- Captura obligatoria de teléfono/fidelización — el nombre es obligatorio solo para "dejar para
  recoger" (para poder identificar el pedido en la lista); no se pide teléfono ni cumpleaños en este
  flujo (a diferencia de Asesor de Ventas, este es un cliente de paso, no alguien que se sienta a
  comer — capturar más datos aquí se sintió como fricción innecesaria para una transacción rápida de
  mostrador).

## Modelo de datos: reutilizando columnas existentes, sin cambios de esquema

Se introduce un tercer valor de `Tipo_Pedido`: `'mostrador'` (junto a los ya existentes `'local'` y
`'domicilio'`). Ninguna columna nueva:

- **`Mesa`** (hoy solo se usa para número de mesa en pedidos `local`, vacía en `domicilio`): para
  `tipo='mostrador'` guarda el **nombre del cliente** como texto libre. Es seguro porque el grid de
  mesas de `caja.html`/`asesorventas.html` ya filtra explícitamente `p.tipo === 'local'` antes de
  comparar `Mesa` contra un número — un pedido `mostrador` con "Carlos" en `Mesa` nunca entra en esa
  comparación.
- **`Mesero`**: se deja **vacío a propósito** en pedidos `mostrador` — nadie los atendió, así que no
  deben contar para la comisión de ningún mesero (Módulo 8 agrupa por el texto exacto de `Mesero`).
- **`Observacion`**: sigue siendo la nota libre por ítem (ej. "sin cebolla"), sin cambios de uso.

## Flujo de backend (reutiliza 100% de lo existente)

1. Al tocar "Cobrar y entregar" o "Cobrar y dejar para recoger": `crear_pedido` con
   `tipo=mostrador&mesa=<nombre o vacío>&mesero=` — igual que cualquier otro pedido local, activa
   `Estado_Cocina='Pendiente'` automáticamente (fix ya desplegado del 2026-07-31).
2. Se abre el mismo selector de método de pago (Efectivo/Nequi/Tarjeta) que ya usa el cobro de
   mesa/domicilio → `marcar_pedido_pagado` → recibo de 80mm, mismo mecanismo ya existente.
3. Si se eligió "Cobrar y entregar": inmediatamente después se llama `liberar_pedido` con ese
   `id_pedido` — el pedido nunca aparece en "Para recoger", queda cerrado de una vez.
4. Si se eligió "Cobrar y dejar para recoger": no se llama `liberar_pedido` todavía — el pedido queda
   `Pagado` y aparece en la lista "Para recoger" (cualquier pedido `tipo='mostrador'` con
   `estado='Pagado'` en el día). Cuando el cliente vuelve, se toca el pedido en la lista y
   "✅ Marcar recogido" llama `liberar_pedido` — el pedido desaparece de la lista.

## Pantalla — modal Venta Rápida

Mismo patrón visual que el modal de "Dividir cuenta" ya existente (overlay + panel centrado). Campo
de nombre arriba (obligatorio solo si se va a usar "dejar para recoger" — si está vacío y se toca ese
botón, se pide antes de continuar). Categorías en pills + lista de productos con botón `+` (igual a
`menu.html`), carrito con cantidad/quitar y total corriendo. Dos botones de cierre al final, cada uno
mostrando el total: "Cobrar y entregar $X" / "Cobrar y dejar para recoger $X".

## Pantalla — sección "Para recoger" en el grid

Tarjetas simples (nombre + hora + total), ordenadas por hora, debajo del grid de mesas/domicilio —
solo aparece si hay al menos un pedido esperando (mismo criterio que la franja "en espera de cupo" de
Domicilio, que tampoco se muestra si está vacía). Tocar una tarjeta abre el detalle (mismos ítems,
botón "✅ Marcar recogido" y "🖨️ Reimprimir recibo" — reutilizando `imprimirReciboPorId`).

## `cocina.html` — ajuste de etiqueta

Hoy la etiqueta del pedido es `p.tipo === 'domicilio' ? '🛵 Domicilio' : '🍽️ Mesa ' + (p.mesa || '—')`
— cualquier tipo que no sea `domicilio` cae en la rama de "Mesa", así que un pedido `mostrador`
mostraría erróneamente "🍽️ Mesa Carlos". Se agrega una rama explícita para `mostrador`:
"🛎️ Mostrador: Carlos" (usando el mismo campo `p.mesa`, que para este tipo guarda el nombre).

## Manejo de errores

- `crear_pedido` falla (sin conexión): se avisa al cajero, el carrito armado en el modal no se pierde
  — puede reintentar sin rearmar el pedido.
- `marcar_pedido_pagado` falla después de crear el pedido, **o el cajero cancela el selector de método
  de pago** (el `crear_pedido` ya se disparó al tocar "Cobrar y entregar"/"Cobrar y dejar para
  recoger", antes de que se abra ese selector — a diferencia del cobro de mesa/domicilio hoy, donde el
  pedido ya existía de antes): en ambos casos el pedido queda `Pendiente de pago` tipo `mostrador` — no
  aparece en "Para recoger" (que solo muestra `Pagado`), pero tampoco se pierde: sigue visible y
  cobrable desde la pestaña Historial existente, que ya lista todo por tipo/estado sin cambios.
- Si el cajero cierra el modal antes de cobrar: el carrito en memoria se descarta sin aviso — no hay
  nada que recuperar porque el pedido nunca se creó en el backend.

## Riesgos / notas de proceso

- Ningún cambio de Apps Script en este proyecto — mismo perfil de riesgo bajo que Asesor de Ventas
  (todo el riesgo es de frontend, reutilizando acciones ya verificadas en vivo).
- El catálogo del modal reutiliza `listar_productos`, la misma llamada que ya usa `menu.html` — sin
  necesidad de que `caja.html` mantenga su propia copia de productos de respaldo (`MOCK_PRODUCTOS`);
  si el backend no responde, se sigue el mismo patrón de aviso que el resto de `caja.html` ya usa
  cuando `listar_pedidos_caja` falla (banner de "sin conexión", no bloquear silenciosamente).
- Ningún navegador/Playwright disponible en el entorno de construcción — la verificación se apoya en
  `node --check`, trazas manuales, y una prueba real con clics por parte del usuario en el sitio
  publicado antes de darlo por cerrado (mismo patrón ya establecido en este proyecto).
