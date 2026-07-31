# Rediseño de Caja (grid de mesas) y Cocina (botones) — Diseño

Fecha: 2026-07-30

## Contexto y problema

`caja.html` hoy es una lista de tarjetas de pedido con pestañas (En el local/Domicilio ×
Pendientes/Pagados). No hay forma de ver de un vistazo qué mesas están ocupadas, cuáles ya
pagaron y cuáles siguen libres — el usuario tiene que entrar a la pestaña correcta y leer
tarjeta por tarjeta. El usuario trajo un mockup (`mesas.jpeg`) de cómo debería verse: un
grid de 20 mesas + 5 cupos de domicilio, coloreados por estado.

`cocina.html` muestra todos los pedidos activos siempre expandidos en tarjetas — funciona,
pero el usuario pide algo más simple: un botón por pedido (con la hora), que al tocarlo
abre el detalle y con un botón para regresar, y que desaparece solo cuando el pedido ya
salió completo.

Durante el mismo reporte, el usuario notó que **los pedidos a domicilio no estaban
activando cocina**. Investigado y confirmado en vivo (comparando `listar_pedidos_caja` vs
`listar_pedidos_cocina` con curl: había domicilios pagados hoy que caja veía y cocina no):
`crearPedido()` solo activaba `Estado_Cocina` para `tipo === 'local'`, y
`listarPedidosCocina()` excluía explícitamente todo lo que no fuera `'local'` — una decisión
de diseño de cuando se construyó el Módulo 3, que ya no aplica (los domicilios también se
cocinan). **Este bug ya se corrigió** en los archivos de referencia y en `cocina.html`
(ver `Gestion_Proyecto/01-modulos/modulo-1-apps-script-nuevo.gs.txt` y
`modulo-3-apps-script-comanda-cocina.gs.txt`); falta pegarlo en el editor de Apps Script en
vivo y verificar con curl — es un paso operativo, no parte del diseño de este documento.

Al discutir cómo combinar varias rondas de pedido de una misma mesa en un solo panel, el
usuario reveló un problema más serio, ya existente hoy: `buscarMeseroMesaAbierta()`
considera una mesa "cerrada" apenas su `Estado` pasa a `'Pagado'`. Si un mesero cobra la
mesa 7 pero los clientes siguen sentados y piden algo más, el sistema ya no reconoce que la
mesa sigue siendo de ese mesero — cualquiera que tome ese segundo pedido podría quedar
acreditado como el mesero de esa venta. El usuario fue explícito: esto es plata real que se
pierde por robo de ventas entre meseros, y la regla debe ser absoluta ("NO SE PUEDE"). Este
rediseño corrige eso de raíz introduciendo un estado `Liberado` explícito: una mesa sigue
siendo del mesero que la abrió hasta que alguien la libera a propósito, no hasta que se paga.

## Alcance

Incluye:
- Bug de domicilio en cocina (ya corregido, ver arriba) — pendiente solo el pegado en vivo.
- `caja.html`: nueva pantalla de inicio tipo grid (20 mesas + 5 cupos de domicilio),
  coloreada por estado, reemplazando las pestañas actuales como punto de entrada.
- Cuenta combinada por mesa: todas las rondas de pedido de hoy para una mesa se ven y se
  cobran juntas, con un solo total pendiente.
- Estado nuevo `Liberado` en la columna `Estado` de `Ventas` (reutilizada, sin columnas
  nuevas) + dos acciones nuevas: `liberar_mesa` y `liberar_pedido`.
- Corrección de `buscarMeseroMesaAbierta()`: una mesa cuenta como abierta (mesero
  protegido) hasta que se libera, no hasta que se paga. Cierra el hueco de robo de ventas.
- Cupos de domicilio 1-5 autoasignados por orden de llegada, con cola de espera si los 5
  están ocupados. Persistidos en `localStorage` del dispositivo de caja (se confirmó que
  caja se usa desde un solo dispositivo).
- Acceso a "Historial de hoy" dentro de Caja, para reimprimir recibos o consultar ventas ya
  liberadas (antes vivía en la pestaña "Pagados", que desaparece como pantalla de entrada).
- `cocina.html`: lista de botones (hora + Mesa/Domicilio) en vez de tarjetas siempre
  abiertas; detalle con botón "← Regresar"; el botón se pone urgente (rojo) igual que hoy
  la tarjeta lo hace a los 15 min; desaparece de pendientes al completarse.

No incluye (fuera de alcance, explícitamente):
- Pantalla de Meseros para agregar pedidos a una mesa ya abierta — el usuario la pidió en
  esta misma conversación, pero es una pantalla distinta con su propio flujo (para agregar,
  no para cobrar). Queda como el siguiente sub-proyecto, con su propio brainstorm/spec.
- División de cuenta (Módulo 4): sin cambios de UX ni de lógica de división en sí — sigue
  viviendo dentro del panel de mesa combinado. Sí requiere que se le entreguen los ítems
  agregados de todas las rondas pendientes de esa mesa (hoy solo recibe los de un
  `id_pedido`), para poder dividir correctamente cuando hay más de una ronda abierta.
- Sincronizar los cupos de domicilio entre 2+ dispositivos de caja al tiempo — decidido que
  no aplica (un solo dispositivo). Si eso cambia en el futuro, los cupos tendrían que
  moverse al Sheet en vez de `localStorage`.
- Fusionar en un solo botón de cocina las distintas rondas de una misma mesa — se mantienen
  como botones separados por ronda (id_pedido), igual que hoy separa las tarjetas.
- Indicador de progreso ("3/5 ítems listos") en el botón de cocina antes de abrirlo —
  posible mejora futura, no necesaria para esta iteración.
- Liberación automática por tiempo — se descartó a favor de un botón manual.

## Modelo de datos: columna `Estado` en `Ventas`

Se reutiliza la columna que ya existe (sin agregar columnas nuevas):

| Estado | Significado | Color en el grid |
|---|---|---|
| `Pendiente de pago` | Ya existe. Hay saldo por cobrar. | Rojo |
| `Pagado` | Ya existe. Se cobró, pero la mesa/domicilio sigue ocupado(a). | Amarillo |
| `Liberado` (nuevo) | El cliente ya se fue / el domicilio ya salió. Ya no ocupa la mesa/cupo. | — (vuelve a Libre) |

Una mesa/domicilio sin ninguna fila de hoy en `Pendiente de pago` o `Pagado` (es decir,
todo lo de hoy ya está en `Liberado`, o no hay nada) se considera **Libre**.

Dos acciones nuevas en Apps Script:
- `liberar_mesa&mesa=<num>`: pone en `Liberado` todas las filas de hoy de esa mesa cuyo
  `Estado` sea `Pagado`. Si queda alguna en `Pendiente de pago`, responde `ok:false` con un
  error claro ("todavía hay saldo pendiente") — no se puede liberar una mesa que debe.
- `liberar_pedido&id_pedido=<uuid>`: pone en `Liberado` las filas de un `id_pedido`
  puntual (usado para domicilio, que no tiene número de mesa). Misma validación.

## Corrección de `buscarMeseroMesaAbierta()`

Cambia la condición que decide si una mesa sigue "abierta" (y por tanto protegida para su
mesero): en vez de saltar filas con `Estado === 'Pagado'`, salta solo filas con
`Estado === 'Liberado'`. Efecto: mientras la mesa no se libere explícitamente, cualquier
pedido nuevo que llegue para esa mesa se sigue acreditando al mesero original — sin importar
cuántas rondas, ni si ya se cobró alguna, ni quién esté ahora mismo en el turno.

## Caja — pantalla de mesas (nueva entrada)

Layout según el mockup del usuario: logo pequeño a la izquierda, "Donde el Gordo" como
título grande a la derecha, "CAJA" como subtítulo centrado debajo, línea divisoria. Grid de
20 botones (MESA 1 a MESA 20, 4 filas × 5 columnas). Línea divisoria. Fila de 5 botones de
Domicilio. Si hay más de 5 domicilios activos, una franja "En espera de cupo" debajo,
listando los que aún no tienen número — se les asigna automáticamente en cuanto se libera
un cupo. Al final, "← MENU" (vuelve a `index.html`) y un botón más pequeño "Historial de
hoy" (abre la vista de lista/pestañas de siempre, de solo consulta y reimpresión).

Colores de mesa: Libre = fondo negro, número blanco. Alguna ronda de hoy en
`Pendiente de pago` = rojo. Todo lo de hoy en `Pagado` (nada pendiente, nada liberado) =
amarillo.

Colores de domicilio (mismo criterio, paleta distinta porque el mockup ya los diferencia
con azul-verdoso): Libre/sin asignar = verde. Pendiente de pago = rojo. Pagado, pendiente
de salir = amarillo.

Tocar una mesa Libre no hace nada. Tocar una mesa ocupada abre el panel de detalle
existente (mismo diseño de tarjeta que usa `caja.html` hoy): todas las rondas de hoy para
esa mesa, cada una con su hora, agrupadas visualmente pero sumadas en un solo total
pendiente. Botón "Cobrar" (cobra todo lo pendiente de una vez, como ya funciona). Botón
"Dividir cuenta" (Módulo 4, sin cambios de UX, ver nota de alcance sobre ítems agregados).
Botón "Liberar mesa" — visible solo cuando no queda nada en `Pendiente de pago`. El recibo
que se imprime al Cobrar incluye todos los ítems de todas las rondas que se están pagando
en ese cobro, como un solo recibo — no uno por ronda.

Tocar un cupo de domicilio ocupado abre el mismo tipo de panel para ese único pedido:
Cobrar, y tras pagar, "Marcar entregado" (llama `liberar_pedido`).

## Cupos de domicilio (cálculo en el navegador)

`caja.html` mantiene un mapa `id_pedido → número de cupo (1-5)` en `localStorage`. En cada
actualización: los pedidos de domicilio que ya tenían cupo lo conservan (no se renumeran
aunque otro cupo se libere antes — así el cajero no pierde la cuenta). Los pedidos nuevos
sin cupo reciben el primero disponible; si no hay ninguno libre, quedan en la franja de
espera hasta que se libere uno. Cuando un pedido pasa a `Liberado`, su entrada se borra del
mapa, dejando el cupo libre para el siguiente. Si `localStorage` está vacío (primera carga,
o se limpió el navegador), se reconstruye de cero asignando por orden de hora — puede
renumerar una sola vez en ese caso excepcional, no en el uso normal.

## Cocina — vista de botones

`cocina.html` pasa de mostrar todas las tarjetas siempre abiertas a una lista de botones,
uno por pedido activo (mismo agrupamiento por `id_pedido` que ya existe — una ronda de una
mesa, o un domicilio, es un botón). Cada botón muestra la hora y la etiqueta ("Mesa X" o
"🛵 Domicilio"), y se pone en rojo/parpadeante pasados los 15 minutos, igual que hoy lo hace
la tarjeta completa — así un cocinero ve la urgencia sin tener que abrir cada uno. Tocar un
botón abre el detalle (la tarjeta que ya existe, con los botones de estado por ítem) con un
botón "← Regresar" arriba que vuelve a la lista. Cuando el pedido queda completo (todos los
ítems Entregado, o se toca "Marcar pedido completo"), su botón desaparece de "Activos" —
sigue disponible, como detalle, en "Historial". Gracias al fix de domicilio, estos pedidos
ahora sí aparecen en esta lista.

## Riesgos / notas de proceso

Esto implica pegar en el editor de Apps Script en vivo: `crearPedido` y
`listarPedidosCocina` (ya corregidos, ver Contexto), `buscarMeseroMesaAbierta` (corrección
de esta spec), y las dos acciones nuevas `liberar_mesa`/`liberar_pedido`. Historial del
proyecto muestra que el pegado manual en el editor ha causado errores reales más de una vez
(función duplicada, `const` duplicada, un archivo completo pegado encima de otro). Antes de
publicar cada cambio: confirmar con Ctrl+F que cada función aparece una sola vez. Después de
publicar: verificar con curl no solo la acción nueva, sino también una acción vieja no
relacionada (p. ej. `listar_productos`), para detectar de inmediato si algo más se rompió.
