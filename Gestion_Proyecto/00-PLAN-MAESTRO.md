# Plan Maestro — ZFood GyP / Donde El Gordo

## Objetivo de negocio

Convertir el menú digital de "Donde El Gordo" en un sistema operativo completo: el cliente pide desde la mesa por QR, la cocina recibe la comanda en tiempo real, la cuenta se puede dividir fácilmente, el inventario se descuenta solo, el cliente frecuente acumula puntos, y el administrador ve todo desde un panel.

## Estado de partida (lo que ya existe hoy)

| Pieza | Archivo | Estado |
|---|---|---|
| Pantalla de bienvenida / captura de cliente | `bienvenida.html` | Funcional. Pide WhatsApp, busca/registra cliente contra Apps Script. |
| Backend | Google Apps Script (`SCRIPT_URL`, línea 129 de `bienvenida.html`) | Funcional para `buscar_cliente` y `actualizar_cliente`. |
| Base de datos comercial | `BD_ZFood_GyP_DondeElGordo.xlsx` → Google Sheet | Hojas: `Productos`, `Clientes`, `Pedidos`. |
| Inventario | `INVENTARIO DONDE EL GORDO.xlsx` | Hojas: `AREAS`, `Gastos_JC`, `Inventario`, `Ingresos`, `Log_Envios`, `Reporte`, `Ventas`, `Recetas`, `Insumos`, `Productos`, `Inventario_Insumos`. Ya tiene recetas e insumos — clave para el Módulo 5. |
| Referencia visual | `menu diseño.jpeg` | Estilo de otra marca (Cluvi), no es el diseño final propio. |

## Arquitectura elegida

- **Base de datos:** Google Sheets (ya en uso). Sin migración a base de datos propia por ahora — decisión tomada por costo cero y porque el equipo ya sabe editar hojas de cálculo.
- **API:** Google Apps Script Web App, extendiendo el `SCRIPT_URL` ya desplegado con nuevas acciones (`accion=...`) por módulo.
- **Frontend:** páginas estáticas HTML/JS (como `bienvenida.html`), una por pantalla/rol (cliente, mesero, cocina, caja, admin), todas contra el mismo Apps Script.
- **Identificación de mesa:** QR único por mesa con parámetro en la URL (ej. `?mesa=5`).

Si el negocio crece mucho (muchas sedes, alta concurrencia en cocina en tiempo real), revisar más adelante un backend con base de datos real — no es necesario para el arranque.

## Google Sheet real del menú (corregido 2026-07-14)

La URL que traía el TXT original (`1BpzdVNZtBnzbqqPq9aiPrDKtNo386b8H33v0LaJyJYA`) **no es la hoja de este proyecto** — pertenece al proyecto separado de automatización de inventario (`E:\Descargas\MENU\DONDE EL GORDO\`, repo `jcdondeelgordo-bit/INVENTARIO`), no al menú digital.

La hoja real del menú (Productos/Clientes/Pedidos, la misma que lee `bienvenida.html` vía `SCRIPT_URL`), confirmada por el usuario: `https://docs.google.com/spreadsheets/d/1WIltJ3wSxGu9VQDGmnj5Lx9uXqUfWjA7Q9aKcZK32ak/edit` — pestañas verificadas: `Productos` (Categoría, Producto, Descripción, Precio (COP), Desechable), `Clientes`, `Pedidos`, coincide exactamente con `BD_ZFood_GyP_DondeElGordo.xlsx`.

## Orden de fases recomendado

1. **Módulo 1 — Menú Digital**: ya hay base (`bienvenida.html`); falta catálogo con fotos, carrito, recomendados, y el modo admin de edición de precios.
2. **Módulo 2 — Pedidos desde la mesa** + **Módulo 8 — Meseros y Comisiones**: la captura de cliente ya existe; falta QR por mesa, flujo de pedido, y capturar **qué mesero atendió** (se construyen juntos porque el mesero se identifica en el mismo momento en que se toma el pedido).
3. **Módulo 5 — Inventario**: enlazar `Recetas`/`Insumos` del Excel de inventario con las ventas para descuento automático.
4. **Módulo 3 — Comanda de cocina** + **Módulo 9 — Caja y Facturación**: se construyen juntos porque ambos leen los mismos pedidos de `Ventas` y actualizan su estado (cocina marca "completo", caja marca "pagado" e imprime el recibo de 80mm).
5. **Módulo 4 — División de cuenta**: caja (Módulo 9) necesita la cuenta ya dividida antes de poder cobrar.
6. **Módulo 6 — Fidelización**: depende de datos de cliente (ya capturados) + historial de ventas. La mecánica de premio (ruleta) es un mini-proyecto aparte, más adelante.
7. **Módulo 7 — Panel administrativo**: agrega datos de todos los módulos anteriores, incluyendo el reporte de comisiones por mesero (Módulo 8) y ventas cerradas por caja (Módulo 9).

Razón del orden: cada módulo depende de datos que produce el anterior (catálogo → pedido/mesero → inventario → cocina/caja → cuenta → fidelización → reportes). Es una recomendación, ajustable según la operación real del restaurante.

## Módulo 9 — otro gap detectado en revisión con el usuario

Al revisar el diseño de la comanda de cocina (Módulo 3), el usuario recordó que faltaba por completo el rol de **cajero**: recibe el pedido igual que cocina, pero lo suyo es cobrar (no preparar), debe llevar el pedido como "pendiente de pago", e imprimir el recibo en una impresora térmica de 80mm al cerrar la cuenta. Se agregó como **Módulo 9 — Caja y Facturación** (ver `01-modulos/modulo-9-caja-facturacion.md`).

## Módulo 8 — gap detectado con Graphify

Al mapear el plan con Graphify, el sistema identificó que el Módulo 2 (Pedidos desde la mesa) es el nodo más conectado de todo el proyecto — pasa por inventario, ventas, comanda y menú. Al revisarlo con el usuario, surgió un dato que faltaba en el plan original: **no se estaba registrando qué mesero atendió cada venta**, dato necesario porque los meseros reciben una bonificación por ventas (fecha, mesero, mesa, valor). Se agregó como **Módulo 8 — Meseros y Comisiones** (ver `01-modulos/modulo-8-meseros-comisiones.md`).

## Decisión: unificar `Hoja Pedidos` y `Hoja Ventas` (confirmado por el usuario, 2026-07-14)

Graphify marcó como **AMBIGUA** la relación entre `Hoja Pedidos` (hoy en `BD_ZFood_GyP_DondeElGordo.xlsx`) y `Hoja Ventas` (hoy en `INVENTARIO DONDE EL GORDO.xlsx`) porque son dos hojas en dos archivos Excel distintos que aparentemente registran lo mismo. El usuario lo confirmó: **el pedido de una mesa ES la venta del día** — no son dos conceptos distintos, deben vivir en **una sola hoja** (`Ventas`), no en dos hojas separadas en dos libros distintos.

**Consecuencia para el diseño:**
- No se debe construir una hoja `Pedidos` separada como destino de los pedidos del Módulo 2. Los pedidos deben escribirse directamente en la hoja `Ventas` (o su reemplazo unificado).
- Esto resuelve además, en parte, la tarea pendiente del Módulo 5 de "unificar los dos Excels": al menos `Pedidos` y `Ventas` deben quedar en el mismo libro/hoja.
- **Resuelto (2026-07-14):** `Hoja Productos` (y `Clientes`) **no** se unifican con `Ventas`/inventario — se mantienen livianas y separadas, porque son datos de referencia (catálogo, precios, códigos) que el menú digital solo **lee**, sin la carga transaccional de `Ventas`. La unificación se limita a `Pedidos`+`Ventas`, que sí eran el mismo evento de negocio. Ver Módulo 1 para el detalle de cómo se edita `Productos`.
- Si un pedido tiene estados (Pendiente/En preparación/Listo/Entregado — Módulo 3) antes de cerrarse como venta pagada, la hoja `Ventas` necesita una columna de **estado**, en vez de tratar "pedido" y "venta" como dos registros distintos en dos hojas distintas.
- Módulos afectados que deben actualizarse con esta decisión: Módulo 2 (escribe en `Ventas`, no en `Pedidos`), Módulo 3 (lee/actualiza estado en `Ventas`), Módulo 5 (descuento de inventario dispara sobre filas de `Ventas`), Módulo 8 (columna `Mesero` va en `Ventas`).

## ⚠️ Nota de seguridad crítica (pendiente de resolver)

El TXT original (línea 70) pide explícitamente seguridad porque se guardan datos personales (celular, fecha de nacimiento). Hoy `SCRIPT_URL` acepta `accion=buscar_cliente&telefono=...` por **GET sin autenticación**: cualquiera que tenga la URL puede consultar datos de cualquier cliente cambiando el número de teléfono. Antes de escalar el sistema (más módulos, más tráfico) hay que:
- Agregar un token/clave de autenticación a las llamadas del Apps Script.
- No devolver PII completa en respuestas GET abiertas.
- Restringir el despliegue del Web App (quién puede ejecutar, orígenes permitidos).

Esta tarea es transversal — no pertenece a un solo módulo, aplica a todos los que toquen datos de cliente.

## Referencia de mercado

Ver `02-investigacion/referencia-menululo.md`.

## Seguimiento

Ver `03-seguimiento/ESTADO.md` para el estado módulo a módulo.
