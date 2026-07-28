# Módulo 9 — Caja y Facturación

> Identificado por el usuario el 2026-07-14 como algo que "se había olvidado" del plan original. No estaba en los 7 módulos iniciales ni en el Módulo 8 (Meseros y Comisiones), aunque está relacionado.
>
> **Diseño cerrado el 2026-07-27** (ver sección "Diseño v1" más abajo). Listo para pasar a plan de implementación.
>
> **Plan de implementación ejecutado el 2026-07-27** (`modulo-9-plan-implementacion.md`, 6 tasks vía subagentes con revisión de código después de cada una). `caja.html` construido según el diseño v1 de abajo y las 2 acciones nuevas de backend verificadas en vivo contra el Sheet real (backend, no pantalla — ver "Qué falta" para lo que sigue pendiente).

## Objetivo
Que el cajero tenga su propia vista de pedidos (igual que cocina), pueda llevar el control de qué está pendiente de pago, y al cobrar imprima el recibo del cliente.

## Funcionalidades (definidas por el usuario)
- El cajero **recibe el pedido igual que cocina** (misma fuente de datos: `Ventas`), no es una copia manual.
- El cajero necesita su propia **lista/tabla de pedidos**, similar en espíritu a la de cocina (Módulo 3), pero orientada a pago, no a preparación.
- Cada pedido queda en estado **"Pendiente de pago"** hasta que el cliente cancela (paga).
- Al pagarse (cancelar), el sistema debe **imprimir el recibo** en una **impresora térmica de 80 milímetros**, con los datos del local (nombre, NIT/dirección/teléfono según lo que use el negocio).

## Regla de negocio cerrada (2026-07-14)

**1. Datos del recibo (80mm):** el ticket debe llevar **hora y fecha**, **nombre del local o representante legal**, **NIT**, **dirección** y **teléfono**. Los valores exactos (el NIT real, la dirección, etc.) quedan **pendientes de definir cuando se construya el ticket** — pero los campos ya están confirmados.

**2. El cajero puede cobrar en cualquier momento, no depende de que cocina marque el pedido completo.** Casos reales que lo obligan:
- Clientes que piden, se van, y regresan después por el pedido.
- Pedidos para llevar que aún no están listos.
- Pagos directos en caja (el cliente paga antes de que el pedido termine de prepararse).

Consecuencia de diseño: el estado "Pendiente de pago → Pagado" en Caja (Módulo 9) es **independiente** del estado "Pendiente → En preparación → Listo → Entregado" en Cocina (Módulo 3). No hay que esperar la señal de "salió completo" para poder cobrar.

**3. El recibo NO muestra mesero ni propina.** La propina se maneja por fuera del sistema, directo entre cliente y mesero:
- Si es en efectivo, se entrega directo al mesero.
- Si el pago es por Nequi, el cliente le indica al cajero cuánto de más es para el mesero (a veces no es dinero, sino algo que el mesero pida, ej. una hamburguesa) — pero esto es infrecuente/casi nunca ocurre en la operación real del usuario, así que no se construye como un flujo formal del sistema por ahora.

## Diseño v1 (cerrado 2026-07-27, brainstorming con el usuario)

### Hardware confirmado
- Puesto de caja: **PC Windows 11 con registradora física**, ya listo. Impresora térmica de 80mm ya la tiene, **conexión USB**. Sesión de diseño se hizo desde un portátil Dell del usuario, pero el puesto real de caja es el PC de Windows 11 — la prueba de impresión física queda pendiente para cuando el usuario tenga ese PC con la impresora conectada y avise.
- **Un solo puesto fijo** (no varios dispositivos) — decisión del usuario, más simple y es como opera el negocio.

### Alcance v1 — qué NO incluye
- **División de cuenta por persona** (Módulo 4): decisión del usuario de avanzar sin esto — se cobra el pedido **completo** tal como está en `Ventas`. División de cuenta queda como mejora aparte, futura, su propio mini-proyecto.
- **Impresión automática sin diálogo**: decisión del usuario de usar el diálogo de impresión normal del navegador (ver abajo) en vez de instalar software adicional (tipo QZ Tray) para impresión silenciosa.

### Arquitectura
Un archivo nuevo `caja.html`, mismo patrón que `cocina.html`/`inventario.html` (HTML+JS estático, sin login, GitHub Pages), más 2 acciones nuevas en el mismo proyecto de Apps Script que ya tiene Módulos 1/2/3/8 (bound al Sheet del menú, `1WIltJ3wSxGu9VQDGmnj5Lx9uXqUfWjA7Q9aKcZK32ak`):

- **`listar_pedidos_caja`** — trae los pedidos del día desde `Ventas`, agrupados por `ID_Pedido` (mismo patrón de agrupación que `listarPedidosCocina` en `modulo-3-apps-script-comanda-cocina.gs.txt`, pero **sin filtrar por `tipo === 'local'`** — incluye tanto "local" como "domicilio"). Cada pedido devuelve: id_pedido, hora, tipo, mesa/mesero (vacíos si es domicilio), items (producto/cantidad/precio), total, estado, metodo_pago.
- **`marcar_pedido_pagado`** — parámetros `id_pedido` + `metodo_pago` (`Efectivo`/`Nequi`/`Tarjeta`). Recorre todas las filas de `Ventas` con ese `ID_Pedido` y les pone `Estado = 'Pagado'` y `Metodo_Pago` = el valor recibido. Mismo patrón de "recorrer filas por id_pedido" que ya usa `marcarPedidoCompleto`.

`caja.html` hace polling cada 12s igual que `cocina.html`, reutilizando el mismo patrón de "guardia de cambios pendientes" (`estadoPedidoPendiente`) para que el auto-refresco no pise un cobro recién hecho antes de que el fetch termine.

### Modelo de datos
Columna nueva en `Ventas` (columna 16, después de `Estado_Cocina`): **`Metodo_Pago`** — vacía hasta que se cobra, luego `Efectivo` / `Nequi` / `Tarjeta`. No se modifica ninguna columna existente.

Datos del local para el recibo, como constantes al inicio de `caja.html` (mismo patrón que `WHATSAPP_NEGOCIO` en `menu.html` — fáciles de ubicar y editar):

```javascript
const DATOS_LOCAL = {
  nombreComercial: 'Donde el Gordo',
  razonSocial: '[FICTICIO — actualizar cuando el usuario traiga el dato real]',
  nit: '[FICTICIO — actualizar]',
  direccion: '[FICTICIO — actualizar]',
  telefono: '3167027833', // confirmado por el usuario 2026-07-27, mismo número real del negocio
  mensajePie: '¡Gracias por su visita!'
};
```
**Pendiente del usuario**: razón social real y NIT real — dijo que los recoge el mismo día 2026-07-27, actualizar estas constantes en cuanto los tenga.

### Flujo de uso (pantalla de Caja)
- Tarjetas por pedido: hora, mesa/mesero (si "En el local") o solo ítems+total (si "Domicilio"), lista de ítems, total.
- Dos pestañas: **"En el local"** / **"Domicilio"**, y dentro de cada una, **Pendientes de pago** / **Pagados** (historial del día) — mismo espíritu que Activos/Historial en cocina.
- Botón **"Cobrar"** en cada tarjeta pendiente → selector rápido de método de pago (Efectivo/Nequi/Tarjeta) → confirma → llama `marcar_pedido_pagado`.
  - Si es **"En el local"**: al confirmar el cobro, se dispara automáticamente la vista de impresión del recibo.
  - Si es **"Domicilio"**: no imprime automático (no hay cliente físico en el mostrador), pero queda un botón **"Imprimir recibo"** opcional por si el repartidor necesita comprobante físico.
- El pago se registra en el sistema **independientemente** de si la impresión sale bien o el cajero cierra el diálogo sin imprimir — queda un botón "Reimprimir recibo" en la pestaña Pagados para esos casos.

### Impresión del recibo (80mm)
**Decisión del usuario**: usar el diálogo de impresión normal del navegador (`window.print()`), NO impresión silenciosa. Esto significa:
- Una plantilla oculta en `caja.html`, con reglas `@media print` a 80mm de ancho, que se llena con los datos del pedido + `DATOS_LOCAL` justo antes de llamar `window.print()`.
- Contenido del recibo: fecha, hora, nombre comercial + razón social, NIT, dirección, teléfono, ítems (cantidad/precio/subtotal), total. **Sin mesero ni propina** (regla de negocio ya cerrada arriba).
- Recomendación operativa para el usuario: dejar la impresora térmica como **predeterminada de Windows** en el PC de caja, para que el diálogo de impresión ya la traiga seleccionada y el cajero solo confirme.
- Sin software adicional que instalar/mantener — mismo enfoque que el resto del proyecto (todo HTML+JS estático + Apps Script, sin backend propio).

### Manejo de errores
- Si `marcar_pedido_pagado` falla (sin conexión, etc.), se muestra error y el pedido **no** se mueve a "Pagados" ni dispara impresión — el cajero puede reintentar. Mismo patrón defensivo que `cocina.html`.
- El pago se marca por **pedido completo**, no por ítem — no aplica el mismo riesgo de "cambio pendiente por ítem individual" que tiene cocina.

### Plan de verificación
1. Probar `listar_pedidos_caja` y `marcar_pedido_pagado` contra el backend real con pedidos de prueba (mismo mecanismo usado para Módulos 3 y 8: crear pedidos de prueba vía `crear_pedido`, verificar, limpiar al final).
2. La prueba de impresión física en la térmica queda **pendiente** para cuando el usuario tenga el PC de caja con la impresora USB conectada — avisa cuando esté listo para hacerla.

## Qué falta (actualizado 2026-07-27 — plan ejecutado)
- **Datos reales del local en el recibo**: `DATOS_LOCAL` en `caja.html` todavía tiene `'[FICTICIO — actualizar]'` en `razonSocial`, `nit` y `direccion`. El teléfono ya es el real y confirmado (3167027833).
- **Prueba de impresión física en la térmica de 80mm real**, en el PC de Windows 11 del puesto de caja (USB) — nunca se hizo; esta ronda de trabajo solo tuvo verificación de *datos* contra el backend real (vía curl, sin navegador disponible en esta sesión), no hubo prueba visual/de pantalla ni física.
- **Publicar `caja.html` en el hosting real del proyecto** (mismo hosting que `menu.html`/`cocina.html`) — por ahora el archivo solo existe en este worktree/branch (`worktree-modulo-9-caja`), no está publicado.
- **⚠️ 5 filas de datos de prueba sin borrar en el `Ventas` real** — a diferencia de rondas anteriores, esta limpieza quedó pendiente de que el usuario la confirme: mesero `PRUEBA-CLAUDE-CAJA-LOCAL` (2 filas: una Pendiente que quedó sin pagar del primer intento de verificación de Task 2, bloqueado porque el deployment del backend todavía no tenía las funciones nuevas, y otra Pagada/Efectivo del segundo intento, ya exitoso, sobre un pedido nuevo del mismo mesero), observación `PRUEBA-CLAUDE-CAJA-DOMICILIO` (2 filas, mismo split y mismo origen: una Pendiente del intento bloqueado, otra Pagada del intento exitoso), y mesero `PRUEBA-CLAUDE-CAJA-T4` (1 fila, Pagada/Efectivo, de una prueba aparte y posterior en Task 4 para verificar los parámetros del frontend — sin relación con el bloqueo anterior).
- **División de cuenta por persona (Módulo 4)**: fuera de alcance a propósito para esta v1 (decisión ya aprobada, ver "Alcance v1" arriba) — queda como su propio mini-proyecto futuro.

## Dependencias
- Depende del Módulo 2 (la venta debe existir en `Ventas`).
- **Ya no depende del Módulo 4** para la v1 — se cobra el pedido completo; división de cuenta queda como mejora futura aparte.
- **Ya no depende del Módulo 3** para poder cobrar — son estados independientes (aunque ambos leen la misma `Ventas`).
- Alimenta al Módulo 7 (panel administrativo): ventas cerradas/pagadas por día, y ahora también desglose por método de pago (útil para cuadre de caja).

## Dónde entra en el orden de fases
Construido de forma independiente del Módulo 4 (división de cuenta) — esa dependencia se rompió a propósito en el diseño v1 para poder avanzar ahora. Ver `00-PLAN-MAESTRO.md` para el orden general actualizado si se revisa después.
