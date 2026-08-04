# Seguridad real del sistema — login por rol + proxy que esconde el backend

**Fecha:** 2026-08-04
**Estado:** Diseño aprobado, pendiente de implementación

## Problema

Tres huecos de seguridad reales, anotados en `ESTADO.md` desde antes de esta sesión:

1. **`caja.html` es una URL pública sin ninguna clave.** Cualquiera con el link puede cobrar pedidos, liberar mesas o ver ventas. Riesgo confirmado por el dueño: alguien podría pedir algo directo al cocinero sin pasar por caja y manipular el registro.
2. **El endpoint de Apps Script (`SCRIPT_URL`) queda expuesto en el código fuente de cada página** — cualquiera que vea el código fuente puede copiar esa URL y llamarla directamente desde fuera de la app, sin pasar por ninguna pantalla, incluyendo acciones que exponen datos de cliente (`buscar_cliente`, etc.).
3. **El modo administrador del menú (editar precios) y otras pantallas internas** (`comisiones.html`, `cuadre.html`) usan una clave simple comparada del lado del cliente, o no tienen ninguna protección (`cocina.html`, `inventario.html`, `empleados.html`, `asesorventas.html`).

Hoy el sitio son 10 archivos HTML/JS estáticos publicados en GitHub Pages, que llaman directo a dos backends de Google Apps Script (uno para Menú, otro para Inventario) vía `fetch` desde el navegador del cliente. No hay ningún servidor propio — por eso no hay dónde esconder nada ni validar nada del lado del servidor hoy.

## Objetivo

Cerrar los 3 huecos con un solo sistema de login (2 roles: Cajero y Admin, clave compartida por rol) construido sobre Vercel, sin reescribir la lógica de negocio ya construida y probada en vivo en los 10 archivos HTML.

## Arquitectura

**Vercel sirve todo**: las páginas HTML tal como están hoy (sin migrar a React/Next.js) más una carpeta `/api` con funciones serverless de Node.js, más un `middleware.js` de Edge que corre antes de servir cualquier página protegida.

```
Navegador
   │
   ├─ GET /caja.html ────────► middleware.js revisa cookie de sesión
   │                            │
   │                            ├─ sin cookie válida → redirige a /login.html?volver=/caja.html
   │                            └─ cookie válida → sirve caja.html normal
   │
   └─ fetch('/api/backend?accion=marcar_pedido_pagado&...')
                                 │
                                 ├─ revisa cookie de sesión OTRA VEZ (independiente del middleware)
                                 ├─ busca 'marcar_pedido_pagado' en la tabla de permisos
                                 │    → requiere rol 'cajero', ¿la cookie tiene ese rol? si no, 403
                                 └─ si pasa: reenvía la petición al SCRIPT_URL real (variable de entorno,
                                    nunca en el código) y devuelve la respuesta tal cual
```

Se descartó migrar a Next.js/React completo (semanas de riesgo de regresión para un problema que no lo pide) y se descartó dejar las páginas en GitHub Pages con Vercel solo como capa de login aparte (dos dominios coordinándose, más frágil).

## Login y sesión

- **`POST /api/login`** recibe `{rol: 'cajero'|'admin', clave}`. Compara contra `CAJERO_PASSWORD` / `ADMIN_PASSWORD` (variables de entorno de Vercel). Si coincide, responde con una cookie `httpOnly`, `Secure`, firmada con HMAC (`SESSION_SECRET`, variable de entorno) que guarda `{rol, emitida}`. Sin base de datos — nada que mantener.
- **Duración**: cookie de larga vida (~1 año). Queda logueado indefinidamente hasta cerrar sesión a mano — decisión explícita del dueño (dispositivos fijos/personales, prioriza cero fricción en el día a día sobre expirar solo).
- **`POST /api/logout`**: borra la cookie. Botón "Cerrar sesión" nuevo en cada pantalla protegida.
- **`login.html`** (nueva): selector Cajero/Admin + campo de clave, mismo estilo visual dorado del resto del sitio. Si la clave es incorrecta, `401` y mensaje genérico "Clave incorrecta" (no distingue cuál campo falló).
- **Doble candado, ninguno depende solo del otro**: el `middleware.js` bloquea el HTML de páginas protegidas sin cookie válida (nadie ve la pantalla). Cada función `/api/*` vuelve a validar la cookie y el rol antes de tocar el Sheet — así una llamada directa por `curl` a una función, saltándose la pantalla por completo, también se rechaza.

## Matriz de acceso por pantalla

| Pantalla | Público | Cajero | Admin |
|---|---|---|---|
| `index.html`, `bienvenida.html` | ✅ | ✅ | ✅ |
| `menu.html` (catálogo/pedido cliente) | ✅ | ✅ | ✅ |
| `menu.html` (modo editar precios) | ❌ | ❌ | ✅ |
| `caja.html` | ❌ | ✅ completo | ✅ solo lectura |
| `cuadre.html` | ❌ | ✅ completo | ✅ solo lectura |
| `cocina.html` | ❌ | ✅ | ✅ |
| `inventario.html` | ❌ | ✅ | ✅ |
| `asesorventas.html` | ❌ | ✅ | ✅ |
| `empleados.html` | ❌ | ✅ completo | ✅ completo |
| `comisiones.html` | ❌ | ❌ | ✅ |

"Solo lectura" para Admin en `caja.html`/`cuadre.html`: puede ver todo desde su celular, pero no mover plata a distancia (reduce el riesgo si el celular se pierde o alguien más lo usa).

## Tabla de permisos por acción (el candado real)

Fuente de verdad: la función `/api/backend` rechaza cualquier acción no listada aquí (whitelist explícita, no whitelist implícita por pantalla).

**Backend Menú** (`SCRIPT_URL_MENU`):
| Acción | Rol requerido |
|---|---|
| `listar_productos`, `crear_pedido`, `estado_mesa` | pública |
| `buscar_cliente`, `registrar_cliente`, `actualizar_cliente` | pública (el cliente gestiona sus propios datos al pedir) |
| `listar_empleados` | pública (nombre para elegir mesero, ya es así hoy) |
| `verificar_admin` | pública (solo confirma clave; tras el proxy ya no expone nada nuevo) |
| `actualizar_precio` | admin |
| `listar_pedidos_caja`, `listar_pagos_divididos` | cajero o admin (lectura) |
| `marcar_pedido_pagado`, `liberar_mesa`, `liberar_pedido`, `registrar_pago_parcial` | cajero |
| `actualizar_estado_item`, `marcar_pedido_completo` | cajero o admin |
| `calcular_comisiones`, `guardar_configuracion_bono` | admin |

**Backend Inventario** (`SCRIPT_URL_INVENTARIO`):
| Acción | Rol requerido |
|---|---|
| `get_productos`, `listar_empleados`, `verificar_envio` | pública |
| `get_data`, `reporte_insumos`, `listar_insumos`, `resumen_dia_caja`, `listar_registros_dia_caja`, `sugerir_base_apertura` | cajero o admin (lectura) |
| `guardar_ingreso`, `guardar_inventario_completo`, `guardar_ventas` | cajero o admin |
| `guardar_empleado`, `listar_empleados_admin` | cajero o admin |
| `verificar_admin` | pública |
| `abrir_caja`, `cerrar_caja`, `registrar_gasto_caja`, `registrar_pago_empleado_caja`, `registrar_recogida_caja`, `registrar_dano` | cajero (admin = solo lectura vía `resumen_dia_caja`/`listar_registros_dia_caja`) |

## Manejo de errores y casos borde

- **Clave equivocada**: `401`, mensaje genérico, sin indicar qué campo falló.
- **Cookie vencida/ausente/manipulada en página protegida**: `middleware.js` redirige a `login.html?volver=<ruta original>`; tras loguearse, vuelve directo ahí.
- **Función `/api/*` golpeada sin cookie o con rol insuficiente**: `403` con `{ok:false, error:'no autorizado'}` — mismo formato de respuesta que ya usa Apps Script hoy, las pantallas existentes no necesitan cambios para interpretarlo.
- **Apps Script no responde/tarda**: el proxy reenvía el error tal cual; el comportamiento de "sin conexión → datos mock" que ya tienen algunas pantallas no cambia.
- **Doble submit del login**: botón deshabilitado mientras espera respuesta, mismo patrón anti doble-toque que ya usa el resto del sitio.

## Despliegue

- **Dominio**: uno gratuito de Vercel (`*.vercel.app`), sin costo, sin dominio propio por ahora.
- **Variables de entorno en Vercel** (nunca en el código ni en GitHub): `SCRIPT_URL_MENU`, `SCRIPT_URL_INVENTARIO`, `CAJERO_PASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET`.
- **GitHub Pages actual**: se deja apagado o redirigiendo al nuevo dominio una vez probado — no se borra de inmediato, sirve de marcha atrás si algo falla.
- **Sin QR físicos que migrar** (confirmado con el dueño — todavía no se han impreso), así que no hay presión de mantener la URL vieja.

## Fuera de alcance (explícito)

- No se migra la app a React/Next.js.
- No se crean cuentas individuales por empleado (queda 1 clave compartida por rol, como ya usa el proyecto en otros lados).
- No se toca la lógica de negocio de ninguna pantalla (cobro, mesas, inventario, comisiones) — solo se le agrega la verificación de sesión encima.
- Facturación electrónica DIAN sigue fuera de este trabajo (pendiente de que el dueño hable con su contador).
