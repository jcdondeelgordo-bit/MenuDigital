# Módulo 1 — Menú Digital

> **Estado: construido (v1) — 2026-07-14.** Ver sección "Construcción v1" al final para el detalle de lo entregado, lo probado y lo pendiente antes de publicar en producción.

## Objetivo
Que el cliente vea el menú desde su celular por QR, sin imprimir nada, y pueda armar un pedido.

## Funcionalidades (del plan original)
- Menú por QR.
- Fotos optimizadas para carga rápida (buscadas y livianas).
- Observaciones por producto.
- Productos recomendados.
- Carrito de compras.

## Qué ya existe
- `bienvenida.html`: pantalla de entrada que captura WhatsApp/nombre y llama a Apps Script (`buscar_cliente`, `actualizar_cliente`). Es el punto de entrada del flujo, pero **no** contiene todavía el catálogo de productos, fotos, carrito ni recomendados.
- `BD_ZFood_GyP_DondeElGordo.xlsx` → hoja `Productos`: fuente de datos para el catálogo (falta confirmar columnas exactas: nombre, precio, foto, categoría, descripción).

## Qué falta
- Pantalla de catálogo (categorías, tarjetas de producto con foto, precio, descripción, observaciones).
- Optimización de imágenes (comprimidas/livianas para carga rápida en 4G).
- Lógica de "recomendados" (marcar productos en la hoja `Productos` o calcular por más vendidos).
- Carrito de compras (estado en el navegador, envío del pedido al backend).
- Generación del QR que apunte a esta pantalla.

## Decisión: `Hoja Productos` se mantiene liviana y separada de `Ventas` (confirmado por el usuario, 2026-07-14)
A diferencia de `Pedidos`/`Ventas` (que sí se unificaron — ver `00-PLAN-MAESTRO.md`), la hoja `Productos` **no** se fusiona con nada: es una hoja de referencia de catálogo (productos, precios, códigos) de la que el menú digital **lee** los datos a mostrar. No necesita el mismo nivel de integración transaccional que `Ventas`, así que se mantiene simple y liviana.

## Edición de precios (nuevo requisito, 2026-07-14)
Dos caminos para actualizar precios del catálogo, según el volumen del cambio:
- **Cambio puntual (uno o pocos productos):** el administrador lo hace **desde el propio menú digital**, entrando a un modo administrador protegido por **contraseña**. Edita el precio ahí mismo, sin tocar el Google Sheet.
- **Cambios masivos (varios productos a la vez):** el administrador edita **directamente en la `Hoja Productos`** del Google Sheet — más rápido que hacerlo uno por uno desde la app.

**Implicación de seguridad:** el modo administrador del menú necesita autenticación por contraseña — esto es un requisito de acceso adicional al ya identificado para proteger datos de cliente (ver nota de seguridad transversal en `00-PLAN-MAESTRO.md`), pero de naturaleza distinta: aquí se protege una **acción de escritura** (cambiar precios), no solo lectura de datos personales.

## Dependencias
- Depende de la hoja `Productos` (Google Sheet) como fuente de verdad del catálogo — de solo lectura para el menú, editable por el administrador (in-app o directo en Sheets).
- Es la base de la que depende el Módulo 2 (Pedidos desde la mesa).

## Construcción v1 (2026-07-14)

**Hallazgo importante antes de construir:** el botón "Ver el Menú Completo" de `bienvenida.html` apuntaba a `https://jcdondeelgordo-bit.github.io/PizzeriaDondeelgordo/`, un sitio y repositorio de GitHub **inexistentes (404)**. El usuario confirmó que ese intento nunca se completó. Se construyó de cero.

**Archivos entregados:**
- **`E:\Proyectos ZFood GyP\menu.html`** (nuevo) — catálogo completo con los **80 productos reales** extraídos de la hoja `Productos` (9 categorías: Hamburguesas, Perros, Papas, Pizzas, Platos, Picadas, Especiales, Adicionales, Bebidas), carrito con cantidad/observación por ítem, sección "Recomendados" (oculta automáticamente si no hay ninguna columna `Recomendado` marcada — no bloquea el lanzamiento), selector de tipo de pedido, y modo administrador con edición de precios.
- **`E:\Proyectos ZFood GyP\Gestion_Proyecto\01-modulos\modulo-1-apps-script-nuevo.gs.txt`** (nuevo) — código de las 4 acciones de Apps Script que faltan (`listar_productos`, `crear_pedido`, `verificar_admin`, `actualizar_precio`), con instrucciones de dónde pegarlo y qué columnas nuevas agregar a la hoja `Ventas`. **No pude desplegarlo yo mismo** — vive en la cuenta de Google del usuario.
- **`bienvenida.html`** — se corrigió el enlace roto para que ahora apunte a `menu.html`.

**Decisiones tomadas durante la construcción:**
- **Sin fotos en v1** — íconos/emoji por categoría (🍔🌭🍟🍕🍽️🍢✨➕🥤). El código ya soporta una columna opcional `Imagen` en la hoja si se agrega más adelante.
- **Checkout con dos caminos, confirmado por el usuario:**
  - **Domicilio** → abre WhatsApp (`wa.me/573167027833`) con el pedido, nombre y dirección; el recargo va como "a confirmar según zona" porque varía y el negocio lo resuelve manualmente (junto con el dato de Nequi y el tiempo de espera).
  - **En el local** → llama a la acción `crear_pedido`, que escribe una fila por ítem en `Hoja Ventas` con estado `Pendiente de pago` (adelanta una porción mínima del Módulo 2).
- Se probó localmente con Playwright sobre Microsoft Edge headless (servidor estático de prueba, no producción): catálogo, cambio de categoría, carrito, ambos caminos de checkout y el modo admin funcionan correctamente. Como las 4 acciones nuevas de Apps Script todavía no están desplegadas, tanto "En el local" como el modo admin muestran un mensaje de aviso en vez de fallar en silencio — comportamiento esperado, no un error.

**Pendiente antes de producción:**
1. El usuario debe pegar el código de `modulo-1-apps-script-nuevo.gs.txt` en su proyecto de Apps Script, definir una contraseña real en `ADMIN_PASSWORD`, agregar las columnas nuevas a `Ventas` (Estado, Tipo_Pedido, ID_Pedido, Observacion), y volver a publicar la implementación web.
2. Publicar `menu.html` en algún hosting (GitHub Pages u otro) para que el QR real funcione — **decisión pendiente, fuera de alcance de esta construcción** (se acordó construir y probar local primero).
3. Generar el QR que apunte a la URL pública una vez esté publicado.
