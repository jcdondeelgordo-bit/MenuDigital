# Asesor de Ventas (pantalla de Meseros) — Diseño

Fecha: 2026-07-31

## Contexto y problema

Hoy un mesero toma pedidos en `menu.html` escribiendo a mano el número de mesa y su nombre en
un panel manual. Funciona, pero no da ninguna vista general: el mesero no puede ver de un
vistazo qué mesas están libres u ocupadas, tiene que saber o preguntar el número de mesa antes
de empezar, y no hay ningún punto de entrada dedicado para "soy mesero, voy a atender".

Al cerrar el rediseño de Caja/Cocina (2026-07-31, ver
`2026-07-30-caja-cocina-rediseno-design.md`), el usuario pidió una pantalla equivalente para
meseros: un grid de mesas como el que ya existe en `caja.html`, donde el mesero vea ocupado vs.
libre de un vistazo, toque una mesa y entre directo a tomar el pedido — incluyendo el caso de
que otro mesero cubra una ronda si el que abrió la mesa no puede atenderla.

Esta pantalla se apoya por completo en piezas que ya existen y están verificadas en vivo: el
grid de 20 mesas por color de `caja.html`, y la protección de atribución de venta al mesero
original en `buscarMeseroMesaAbierta` (Apps Script, fix del 2026-07-31) — nada de esto se
reconstruye aquí, solo se reutiliza.

## Alcance

Incluye:
- `asesorventas.html` (nueva): login por selección de nombre (catálogo `Empleados`) + grid de
  20 mesas, mismos 3 colores que `caja.html` (negro=libre, rojo=pendiente de pago,
  ámbar=pagado sin liberar), misma fuente de datos (`listar_pedidos_caja`, filtrado a
  `tipo=local`).
- Botón nuevo "Asesor de Ventas" en `index.html`, junto a Caja/Cocina/Inventario.
- `menu.html`: soporte para `?mesa=N&mesero=Nombre` en la URL — entra directo al catálogo sin
  el panel manual de mesa/mesero, conservando el aviso ya existente ("Ya la atiende X") si la
  mesa sigue abierta con otro mesero.
- Captura opcional de datos de fidelización (teléfono/nombre/cumpleaños) al abrir una mesa
  **nueva** (primera ronda), reutilizando `buscar_cliente`/`registrar_cliente`/
  `actualizar_cliente` — mismo mecanismo que ya usa `bienvenida.html`/Domicilio. Nunca bloquea
  el pedido: el mesero puede omitir este paso.

No incluye (fuera de alcance, explícitamente descartado en el brainstorming):
- Cupos de domicilio en este grid — domicilio lo sigue pidiendo el cliente por su cuenta desde
  `menu.html`, sin pasar por un mesero.
- Reasignar una mesa a otro mesero explícitamente — se mantiene el comportamiento ya existente
  (la venta siempre se acredita al mesero que abrió la mesa, hasta que se libere).
- PIN o clave individual por mesero — el login es solo selección de nombre. Cualquier control
  de acceso más fuerte para esta pantalla se aborda junto con el resto de "seguridades del
  programa" que ya quedaron anotadas como pendiente transversal en `ESTADO.md`.
- Botón "Venta rápida" en Caja (clientes de mostrador sin mesa) — idea distinta que surgió en
  la misma conversación, anotada aparte en `ESTADO.md` para diseñarse después, no es parte de
  este proyecto.

## `asesorventas.html` — login y grid

Al entrar, si no hay un mesero guardado en `localStorage` (clave `asesorMesero`), se muestra un
selector con los nombres de `Empleados` (misma llamada `listar_empleados` que ya usa
`menu.html`, con el mismo *fallback* a un campo de texto libre si el catálogo no carga — no se
duplica esa lógica, se reutiliza tal cual). Al confirmar, el nombre queda guardado y ya no se
vuelve a pedir; un link pequeño "Cambiar mesero" lo borra y regresa al selector.

El grid reutiliza la misma lógica de color que ya tiene `caja.html` para sus 20 mesas
(`listar_pedidos_caja`, agrupado por `mesa`, mismas reglas de color) — no es una acción de
backend nueva, es la misma llamada, la misma agrupación. Se actualiza con el mismo patrón de
*polling* que ya usan `caja.html`/`cocina.html`.

Tocar cualquier mesa (libre u ocupada) navega a:

```
menu.html?mesa=<N>&mesero=<nombre codificado>
```

## `menu.html` — entrada directa sin panel manual

Hoy `?mesa=N` sin `mesero` activa el modo autoservicio por QR (nadie pide el nombre del
mesero). Se agrega un camino nuevo: si la URL trae **ambos** `mesa` y `mesero`, la pantalla
entra directo al catálogo con esos dos valores ya resueltos — no se muestra el panel
"Mesa y Mesero" que hoy hay que llenar a mano.

Si al consultar `estado_mesa` la mesa ya está abierta con un mesero distinto al de la URL, se
sigue mostrando el aviso que ya existe hoy ("📍 Esta mesa ya la está atendiendo Carlos. Los
productos nuevos quedan a su nombre") — automático, sin que el mesero tenga que interactuar con
ningún campo para verlo. El envío a `crear_pedido` sigue mandando el `mesero` de la URL como
siempre; el backend (`buscarMeseroMesaAbierta`, ya corregido) es quien decide en silencio si lo
respeta o lo sobreescribe con el mesero original — sin cambios ahí, es el mismo comportamiento
que ya protege las ventas hoy.

## Captura de fidelización (opcional, solo primera ronda)

Al confirmar un pedido "en el local" cuando la mesa **no** estaba abierta todavía (primera
ronda), aparece un paso corto antes de enviar el pedido: campo de teléfono, con los mismos dos
caminos que ya tiene Domicilio — si el teléfono corresponde a un cliente existente
(`buscar_cliente`), se reconoce y solo se actualiza (`actualizar_cliente`); si no, pide nombre y
cumpleaños y lo registra (`registrar_cliente`). Dos botones: "Guardar y confirmar" u "Omitir y
confirmar" — cualquiera de los dos envía el pedido; omitir simplemente no llama a las acciones
de `Clientes`. Si la llamada de guardado falla por red o el Sheet no responde, no se le muestra
error al mesero ni se bloquea el pedido — mismo patrón silencioso que ya usa
`registrarClienteDesdeMenu()` en Domicilio.

Rondas siguientes de la misma mesa (ya abierta) no vuelven a mostrar este paso.

## Riesgos / notas de proceso

- Ningún cambio de Apps Script en este proyecto — toda la lógica de servidor que se necesita
  (`listar_pedidos_caja`, `crear_pedido`, `estado_mesa`, `buscar_cliente`/`registrar_cliente`/
  `actualizar_cliente`) ya existe y ya está verificada en vivo. Esto reduce el riesgo de este
  proyecto casi por completo al frontend.
- Si `listar_pedidos_caja` falla al cargar el grid, debe mostrarse un estado de error con
  reintento — nunca asumir "todo libre" por defecto, porque eso arriesgaría que un mesero abra
  una mesa que en realidad ya está ocupada.
- Ningún navegador/Playwright disponible en el entorno de construcción (mismo caso que el
  rediseño de Caja/Cocina) — la verificación será por lectura completa, `node --check`/trazas
  manuales, y una prueba real con clics por parte del usuario en el sitio publicado antes de
  darlo por cerrado.
