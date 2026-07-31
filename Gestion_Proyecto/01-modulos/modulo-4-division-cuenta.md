# Módulo 4 — División de cuenta

> **Plan de implementación (`modulo-4-plan-implementacion.md`) ejecutado y verificado en vivo — 2026-07-28.**

> **Diseño cerrado el 2026-07-28** (ver sección "Diseño v1" más abajo).

## Objetivo
Permitir dividir la cuenta de una mesa de forma flexible — función de alto valor, poco común en otros sistemas.

## Funcionalidades (del plan original)
Ejemplo dado en el plan (Mesa 8): Juan pide hamburguesa + gaseosa, Ana pide pizza personal, Carlos pide salchipapa + jugo. El sistema debe permitir:
- Cobrar a cada persona por separado.
- Dividir la cuenta en partes iguales.
- Combinar algunas cuentas (ej. Juan y Ana pagan juntos, Carlos aparte) — cubierto de forma natural
  por el modo "por ítem" del diseño v1: basta con asignar los ítems de Juan y de Ana a la misma
  caja virtual en vez de a dos separadas.

## Nota sobre la propina
La versión anterior de este documento (2026-07-14) traía una regla sobre registrar la propina junto
a la venta. Quedó **superada** por la decisión ya tomada al construir Módulo 9 (Caja): el recibo de
80mm no lleva propina y esta se maneja completamente por fuera del sistema, directo entre cliente y
mesero (ver `modulo-9-caja-facturacion.md`). El diseño v1 de este módulo no reintroduce propina.

## Dependencias
- Depende del Módulo 9 (Caja) — la división ocurre dentro de `caja.html`, sobre pedidos que ya
  vinieron del flujo normal de Módulo 2 sin ningún cambio en cómo se registran.
- Alimenta al Módulo 7 (panel administrativo) con el detalle de pagos divididos, si se quiere
  mostrar ese desglose ahí más adelante.

## Diseño v1 (cerrado 2026-07-28, brainstorming con el usuario)

### Contexto real de uso
Caso poco frecuente pero real: grupos de empresa (ej. petrolera) con viáticos, sentados juntos en
una mesa. Al momento de pagar, cada quien recuerda en voz alta lo que consumió ("yo la hamburguesa
sencilla con gaseosa 350 y papas", "yo el churrasco y una cerveza"...) y quiere pagar exactamente
eso — nunca un peso de más, aunque el dinero sea de viáticos que les reembolsan. Hoy esto se hace
a mano, registrando uno por uno. El objetivo es dar al cajero una calculadora de "cajas virtuales"
por persona para este momento, sin cambiar cómo se registró el pedido original.

### Cuándo se asigna "quién pidió qué"
**Al momento de cobrar, no al pedir.** El pedido se registra igual que hoy (Módulo 2, un solo
pedido por mesa vía `menu.html`/mesero). La división ocurre enteramente en `caja.html`, cuando el
cajero ya tiene el pedido completo delante y la mesa empieza a repartirse la cuenta.

### Dos modos de división, mismo backend
1. **Por ítem** (el caso real de arriba): el cajero arma una "caja virtual" por persona tocando
   las unidades que esa persona consumió.
2. **Partes iguales**: el cajero indica "dividir entre N" y el sistema calcula `total / N` por
   caja, sin tocar ítems — para grupos que solo quieren repartir parejo.

Ambos modos terminan llamando la misma acción de backend (`registrar_pago_parcial`); solo cambia
cómo se calculó el monto de cada caja en la pantalla.

### División por unidad, no por fila completa
Los ítems compartidos por la mesa suelen quedar en `Ventas` como **una sola fila con cantidad > 1**
(ej. "Papas x3" para toda la mesa, no una fila por persona). Por eso la asignación en modo "por
ítem" debe operar **a nivel de unidad**, no de fila completa: el cajero puede tomar 1 de las 3
papas para la caja de Juan, otra para la de Ana, otra para la de Carlos. La interfaz bloquea volver
a asignar una unidad que ya quedó en otra caja.

### Nada de esto se guarda en `Ventas` ni cambia sus filas
La asignación de qué unidad fue a qué persona **vive solo en memoria del navegador**, mientras el
cajero arma las cajas — nunca se escribe al Sheet, y las filas/cantidades originales de `Ventas` no
se tocan ni se dividen. Motivo: `cocina.html` y `comisiones.html` ya leen esa hoja por número de
fila y por cantidad; partir o insertar filas a mitad de servicio arriesga romper algo que ya
funciona. Lo único que queda persistido es el resultado de cada caja ya cobrada — no el detalle de
qué ítems la compusieron (excepto en el recibo impreso de esa persona, que sí puede mostrar el
detalle usando la info que todavía está en memoria del navegador en ese momento).

### Modelo de datos: hoja nueva `Pagos_Divididos`
Hoja nueva en el Sheet del menú (no se toca `Ventas`):

| Columna | Contenido |
|---|---|
| `ID_Pedido` | El pedido que se está dividiendo |
| `Fecha` / `Hora` | Momento en que se cobró esa parte |
| `Persona` | Nombre libre que escribe el cajero (ej. "Juan") |
| `Monto` | Lo que le correspondió a esa caja virtual |
| `Metodo_Pago` | Efectivo / Nequi / Tarjeta — propio de esa parte, puede ser distinto por persona |
| `Detalle` | JSON con las unidades asignadas a esa caja (ej. `[{"producto":"Papas","cantidad":1}]`), o `""` en modo "partes iguales" |

**Nota (agregada durante la planificación de implementación):** `Detalle` no existía en la primera
versión de este diseño. Se agregó porque, sin ella, "recuperar el progreso" al reabrir la división
a medias (ver sección de flujo) no era posible: `listar_pagos_divididos` necesita devolver no solo
cuánto se cobró, sino qué unidades ya se entregaron, para que el frontend sepa cuáles siguen
libres. Sigue sin tocar `Ventas` ni su estructura de filas — es una columna nueva únicamente en
`Pagos_Divididos`.

Cuando la suma de `Monto` de todas las filas de un `ID_Pedido` en `Pagos_Divididos` alcanza el
total de ese pedido en `Ventas`, el backend marca automáticamente **todas** las filas de ese pedido
en `Ventas` como `Pagado` (reutilizando la misma lógica que ya usa `marcarPedidoPagado` de Módulo
9), dejando el desglose real por método en `Pagos_Divididos` para que el cuadre de caja sea exacto
aunque la mesa haya pagado con métodos mixtos.

### Acciones nuevas de Apps Script
- **`registrar_pago_parcial`** (`id_pedido`, `persona`, `monto`, `metodo_pago`, `detalle` — este
  último un JSON opcional, `""` en modo partes iguales): agrega una fila a `Pagos_Divididos`.
  Recalcula la suma de partes ya pagadas para ese `id_pedido` y, si alcanza el total del pedido
  (leído de `Ventas`), marca todas sus filas como `Pagado`. Responde
  `{ok: true, completado: true|false, restante: <monto que aún falta por cobrar>}`.
  - Rechaza (`ok:false`) si `monto` o `metodo_pago` son inválidos, o si `monto` sumado a lo ya
    pagado **superara** el total del pedido (nunca se puede cobrar de más).
- **`listar_pagos_divididos`** (`id_pedido`): devuelve las partes ya cobradas de ese pedido —
  `persona`, `monto`, `metodo_pago` y `detalle` de cada una — para recuperar el progreso si el
  cajero recarga `caja.html` a mitad de una división (qué unidades ya se entregaron, para no
  ofrecerlas de nuevo).

No hace falta ninguna acción para "iniciar" una división — `listar_pedidos_caja` (Módulo 9) ya
trae el pedido completo con su desglose de ítems; el resto es enteramente frontend.

### Flujo en `caja.html`
- Botón nuevo **"Dividir cuenta"** en cada tarjeta de pedido "En el local" pendiente de pago.
- Vista de división: lista de ítems del pedido con su cantidad **sin asignar todavía** (ej.
  "Papas — 3 sin asignar"); campo de texto para el nombre de la persona actual; al tocar una
  unidad, se suma al subtotal de esa caja en pantalla.
- Botón **"Cobrar a <nombre>"** → mismo modal de método de pago que ya existe en Módulo 9
  (Efectivo/Nequi/Tarjeta) → llama `registrar_pago_parcial` → si responde `ok:true`, **imprime de
  inmediato el recibo de esa persona** (usando los ítems que el navegador tenía en memoria para esa
  caja) y limpia la caja para la siguiente persona.
- Modo **"Partes iguales"**: mismo flujo de cobro, pero en vez de tocar ítems el cajero escribe
  cuántas personas (N) y el sistema arma N cajas de `total / N` (ajustando la última caja para que
  la suma cuadre exacto si el total no es divisible exacto entre N).
- Cuando `registrar_pago_parcial` responde `completado: true` (última parte cobrada), la tarjeta
  del pedido pasa sola a "Pagados" en la pantalla principal de Caja — no hay un botón separado de
  "cerrar cuenta".
- Si el cajero cierra `caja.html` y vuelve a entrar a media división, "Dividir cuenta" llama
  `listar_pagos_divididos` primero para mostrar qué ya se cobró y qué unidades siguen sueltas.

### Manejo de errores y casos borde
- Si `registrar_pago_parcial` falla (sin conexión, respuesta inválida), no se imprime nada y esa
  caja sigue "pendiente" en pantalla — mismo patrón defensivo que el resto de `caja.html`.
- La interfaz impide asignar una unidad que ya quedó en otra caja, y el backend impide cobrar más
  del total restante del pedido — no se puede cobrar de más por error de cálculo del cajero.
- Redondeo en "partes iguales": la última caja absorbe el residuo para que la suma final cuadre
  exacto contra el total real del pedido (nunca se cobra de más ni de menos).

### Fuera de alcance para v1
- Ítems compartidos que se dividan en fracciones no enteras (ej. media pizza para dos personas) —
  la unidad mínima asignable es una unidad completa del ítem. Si el negocio necesita esto en el
  futuro, es una extensión aparte.
- Cambiar cómo se calcula la comisión de meseros cuando una venta se cobra dividida — el Módulo 8
  sigue contando la venta completa por mesero tal como ya lo hace hoy; no se ajusta por división de
  cuenta en esta v1.

### Plan de verificación
Mismo patrón que Módulo 9: crear un pedido de prueba real vía `crear_pedido` con varios ítems
(incluyendo alguno con cantidad > 1), dividirlo en 2-3 cajas virtuales con métodos de pago
distintos, confirmar que `Pagos_Divididos` registra cada parte con su monto/método, que el pedido
pasa a `Pagado` en `Ventas` únicamente al completar la última parte (nunca antes), que un intento
de cobrar de más es rechazado, y que cerrar/reabrir la división recupera el progreso ya cobrado.
Limpieza de filas de prueba al final.

## Qué falta (actualizado 2026-07-28 — plan ejecutado, revisión final aplicada, y verificado en vivo)
- **Nada del alcance de este plan queda pendiente**: la hoja `Pagos_Divididos`, el backend (`registrar_pago_parcial`/`listar_pagos_divididos`), los dos modos de `caja.html` (por ítem y partes iguales) y la verificación en vivo (backend por curl, frontend con navegador real, recuperación de progreso tras cerrar/reabrir, y partes iguales de punta a punta) quedaron completos — ver `ESTADO.md` para el detalle de lo verificado. Una revisión final de toda la rama encontró 1 hallazgo Crítico y 3 Importantes de integración entre módulos (riesgo de doble cobro si se usaba el botón "Cobrar" normal sobre un pedido con pagos parciales; unidades atrapadas al cambiar de modo sin cobrar; una condición de carrera en el cobro parcial; y una pantalla que mentía "nadie ha pagado" si fallaba la consulta de progreso) — los 4 se corrigieron y se re-verificaron en vivo. Todos los datos de prueba (`PRUEBA-CLAUDE-DIVISION*`) ya fueron borrados por el usuario.
- **Publicar `caja.html` en el hosting real** — mismo pendiente ya anotado en Módulo 9; la vista "Dividir cuenta" vive en el mismo archivo, así que hereda esa misma pendiente.
- **Prueba de impresión física en la térmica de 80mm real** para el recibo individual de cada caja virtual — la impresión ya funciona en pantalla (mismo diálogo de impresión del navegador que usa Módulo 9), pero la prueba contra la impresora física del puesto de caja sigue sin hacerse (mismo pendiente ya anotado en Módulo 9).
