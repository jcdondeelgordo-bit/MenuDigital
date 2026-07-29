# Módulo 10 — Ficha de Empleados

> **Construido vía brainstorming → plan → subagentes con revisión de código (2026-07-29)** (`docs/superpowers/plans/2026-07-29-ficha-empleados.md`, 5 tasks de implementación + Task 6 de cierre/documentación). **Código completo y revisado, pero NO desplegado en vivo todavía** — ver "Qué falta" para la lista exacta de pasos manuales pendientes antes de poder usarlo en producción.

## Objetivo

Reemplazar el texto libre de "nombre del mesero" (Módulo 2), "responsable del conteo" (Módulo 5/Inventario) y "quién trae/quién recibe" (Ingresos) por un catálogo único de empleados (`Empleados`), evitando inconsistencias de nombre (ej. "Juan" vs "Juan P.") que ya se habían identificado como riesgo aceptado en el Módulo 8 (comisiones) y en la decisión de arquitectura de identificación de mesa del Módulo 2.

## Funcionalidades

- **Catálogo `Empleados`** con 4 columnas fijas: `Nombre`, `Celular`, `Fecha_Ingreso`, `Activo`. Vive en el Sheet de Inventario, ya creado por el usuario antes de este módulo.
- **`empleados.html`** — pantalla de administración nueva y standalone (mismo patrón que `comisiones.html`: gate de contraseña de admin, tabla con Nombre/Celular/Fecha ingreso/Estado, formulario para agregar, botón Desactivar/Reactivar por fila).
- **`menu.html`** — el campo "Su nombre" del mesero (Módulo 2) pasa de `<input type="text">` a un `<select>` poblado con los empleados activos del catálogo, con **fallback automático a texto libre** si el catálogo no está disponible (nunca bloquea el flujo de pedido).
- **`inventario.html`** — dos usos nuevos del catálogo:
  - Selector **"Responsable del conteo"** en la tarjeta de metadatos de la pantalla de inicio (Fecha/Turno), persistido en el draft local igual que `fecha`/`turno`.
  - Selectores **"Quién trae"** / **"Quién recibe"** en la pantalla de Ingresos — a diferencia del mesero (que puede quedar vacío en autoservicio), estos dos campos son **obligatorios** para poder enviar un Ingreso (el objetivo explícito de esta parte del módulo era cerrar el vacío de "nadie registra quién trajo/recibió").

## Qué ya existe

- **Backend en el Apps Script de Inventario** (`E:\Descargas\MENU\DONDE EL GORDO\Code.gs`, mirror legible en `Gestion_Proyecto/01-modulos/modulo-10-apps-script-empleados-inventario.gs.txt`):
  - `GET ?action=verificar_admin&clave=...` → `{ok:true, valido:boolean}` (no existía antes en este proyecto de Apps Script, solo en el del menú).
  - `GET ?action=listar_empleados` → `{ok:true, empleados:[{nombre}]}`, solo activos, sin autenticación, sin exponer celular (endpoint público, consumido también por el menú vía lectura cruzada — ver abajo).
  - `GET ?action=listar_empleados_admin&clave=...` → todos los empleados con los 4 campos, requiere clave.
  - `POST {action:"guardar_empleado", clave, nombre, celular, fechaIngreso, activo, idEnvio}` → upsert por `nombre` exacto; crea con `Activo="Si"` si `activo` se omite.
  - `guardar_inventario_completo` ahora escribe también `Responsable` (columna nueva, al final de `Inventario`).
  - `guardar_ingreso` ahora escribe también `Quien_Trae` y `Quien_Recibe` (2 columnas nuevas, al final de `Ingresos`).
- **`empleados.html`** (`E:\Proyectos ZFood GyP\empleados.html`): pantalla completa, mismo patrón JSONP (GET) + form oculto con iframe (POST) que ya usa `inventario.html`.
- **Acción cruzada en el Apps Script del menú digital** (mirror en `Gestion_Proyecto/01-modulos/modulo-10-apps-script-empleados-menu.gs.txt`): nueva constante `INVENTARIO_SHEET_ID` + función `listarEmpleadosMenu()`, expuesta como `accion=listar_empleados` en el `doGet` existente del menú. Lee la hoja `Empleados` del Sheet de Inventario por lectura cruzada — **nunca devuelve `ok:false`**: si el Sheet cruzado no está disponible (permisos, ID cambiado), responde `{ok:true, empleados:[]}` para que `menu.html` caiga a su fallback de texto libre en vez de romper el flujo de pedido.
- **`menu.html`**: `<select id="mesa-mesero">` poblado por `cargarEmpleados()`/`renderMeseroOptions()`, llamado en `init()` justo después de `cargarProductos()`. Si el catálogo llega vacío, `renderMeseroOptions()` reemplaza el `<select>` por un `<input type="text">` con el mismo `id`, preservando el resto del flujo (`verificarMesa()`, `confirmarMesaMesero()`, `elegirTipo()` no cambiaron — todos acceden solo a `.value`/`.disabled`, que funcionan igual en ambos tipos de elemento).
- **`inventario.html`**: `fetchEmpleados()` (mismo patrón JSONP que `fetchProductosCatalog()`), `renderResponsableSelect()`/`renderIngresoSelects()`/`empleadosOptionsHtml()`. El selector de Responsable persiste en el draft local (`updateMetaDraft()`/`submitInventory()`); los de Ingresos son de una sola vez por envío (no persisten entre sesiones, no tiene sentido que lo hagan).
- **Las 2 direcciones de lectura cruzada entre Sheets ya en uso en el proyecto**:
  1. `Code.gs` (Inventario) → `MENU_SHEET_ID` para leer `Ventas` del menú digital (ya existía desde la integración Inventario+Menú del 2026-07-16, Módulo 5).
  2. Apps Script del menú → `INVENTARIO_SHEET_ID` para leer `Empleados` de Inventario (nueva, de este módulo). Mismo Sheet ID que el `SHEET_ID` que usa `Code.gs` internamente — confirmado byte-idéntico entre Task 1 y Task 3.
- **La regla "Activo=No nunca borra una fila" se respeta en todo el flujo**: `guardar_empleado` solo hace `appendRow` (empleado nuevo) o sobrescribe las 4 celdas de una fila existente encontrada por nombre exacto (`setValues` sobre el rango de esa fila) — nunca `deleteRow`. Desactivar a alguien desde `empleados.html` es reversible ("Reactivar") y conserva el historial de esa persona en el catálogo.
- **Cierra transitivamente el riesgo de inconsistencia de nombres del Módulo 8**: el cálculo de comisiones (`calcular_comisiones`) sigue agrupando por el texto exacto del campo `Mesero` en `Ventas`, sin ningún cambio propio en este módulo — pero ahora que `menu.html` alimenta ese campo desde un catálogo controlado (un nombre = una fila = un empleado) en vez de texto libre, el riesgo de que "Juan" y "Juan P." se cuenten como personas distintas en el ranking de comisiones deja de poder ocurrir en la práctica, sin que Módulo 8 haya necesitado tocarse.

## Decisiones

- **`Empleados` vive en el Sheet de Inventario, no en el del menú** — decisión de diseño previa (ver `docs/superpowers/specs/2026-07-29-ficha-empleados-design.md`), consistente con que Inventario ya es la fuente de otros catálogos de referencia (`Productos`, `Recetas`).
- **Endpoint `listar_empleados` es público (sin clave) en ambos Apps Script** — solo expone el nombre, nunca el celular; es el mismo patrón de exposición mínima que `listar_productos`. `listar_empleados_admin` sí requiere clave y expone los 4 campos.
- **La lectura cruzada nunca puede bloquear el flujo del negocio**: si `INVENTARIO_SHEET_ID` no es alcanzable desde el Apps Script del menú (permisos, Sheet movido/borrado), `listarEmpleadosMenu()` responde `{ok:true, empleados:[]}` en vez de un error — `menu.html` interpreta lista vacía como "usa texto libre", igual que ya hacía antes de este módulo.
- **Responsable (conteo) es opcional; Quién trae/Quién recibe (Ingresos) son obligatorios** — decisión explícita del plan: el conteo ya funcionaba sin ese dato, pero el objetivo puntual de agregar Quién trae/recibe era cerrar un vacío de trazabilidad real en Ingresos, así que ahí sí se bloquea el envío si falta cualquiera de los dos.
- **Un bug de persistencia encontrado y corregido en revisión de código (Task 5)**: el selector de Responsable se recargaba a vacío en cada `window.onload` porque `initMetaDate()` intentaba restaurar el valor guardado *antes* de que el catálogo de empleados terminara de cargar (el `<select>` todavía no tenía más opción que el placeholder), y `updateMetaDraft()` guardaba ese vacío de vuelta al draft, borrando el valor real. Corregido: `updateMetaDraft()` ahora solo deja que el DOM sobrescriba `draft.responsable` una vez `EMPLEADOS.length > 0` (catálogo ya cargado); antes de eso, el valor persistido queda intacto hasta que `renderResponsableSelect()` lo restaura contra la lista real. Ver `task-5-report.md` para la traza completa del arreglo.

## Qué falta

Este módulo está **completo en código y revisado**, pero **nada de esto está en producción todavía**. Pasos manuales pendientes, en orden:

1. **Agregar los encabezados de columna en el Sheet real de Inventario** ("INVENTARIO DONDE EL GORDO"): `Responsable` a la derecha de la última columna actual de `Inventario`, y `Quien_Trae` / `Quien_Recibe` a la derecha de la última columna actual de `Ingresos`. (`getOrCreateSheet()` solo escribe encabezados al crear una hoja nueva — no los agrega retroactivamente a hojas que ya tienen filas.)
2. **Pegar el `Code.gs` actualizado** (`E:\Descargas\MENU\DONDE EL GORDO\Code.gs`) en el Apps Script de Inventario, y **fijar el valor real de `ADMIN_PASSWORD`** ahí (hoy es el placeholder `'CAMBIAR_ESTA_CLAVE'`) — usar la misma clave real que ya está configurada en el Apps Script del menú digital, para que sea una sola clave desde el punto de vista del usuario. Publicar nueva versión de esa implementación.
3. **Pegar la constante `INVENTARIO_SHEET_ID` + función `listarEmpleadosMenu()`** (`Gestion_Proyecto/01-modulos/modulo-10-apps-script-empleados-menu.gs.txt`) en el Apps Script del menú digital, agregar la rama `accion === 'listar_empleados'` a su `doGet` existente, Ctrl+F para confirmar que no quedó duplicado, y publicar nueva versión.
4. **Publicar ambos deployments** (Inventario y Menú) para que sus respectivos `SCRIPT_URL` sirvan el código nuevo.
5. **Poblar el catálogo con el personal real** vía `empleados.html` antes de lanzar — si el catálogo queda vacío, `menu.html` cae a texto libre (sin romperse), pero el punto del módulo es dejar de depender de eso.
6. **Hacer una prueba real de punta a punta** (el Paso 1 del Task 6 original, no ejecutado en este entorno porque no hay ningún Apps Script publicado desde aquí): crear un empleado real (o claramente marcado como prueba) vía `empleados.html`; en una sola sesión, abrir una mesa en `menu.html` y confirmar que aparece y se puede elegir como mesero; enviar un conteo en `inventario.html` con ese empleado como Responsable; enviar un Ingreso con ese empleado como Quién trae/Quién recibe; confirmar las 3 escrituras contra los Sheets reales (curl o vista directa). Borrar las filas de prueba al final (`Empleados`, `Ventas`, `Inventario`, `Ingresos`).

**Nada de lo anterior se intentó en este entorno de trabajo** — no hay ningún Apps Script real accesible desde aquí para ninguno de los dos proyectos. Lo que sí quedó hecho: código completo, revisión de código pasada en las 5 tasks (un hallazgo encontrado y corregido en Task 5, ver "Decisiones" arriba), verificación estática (`node --check` sobre el JS extraído de cada archivo, trazas manuales de control de flujo) — no verificación en vivo ni visual/de pantalla.

## Dependencias

- Depende de que el usuario ya haya creado la hoja `Empleados` en el Sheet de Inventario con las 4 columnas en el orden fijo (`Nombre`, `Celular`, `Fecha_Ingreso`, `Activo`) — precondición del diseño, no construida por este módulo.
- Depende del Módulo 5 (Inventario) para las hojas `Inventario`/`Ingresos` que reciben las columnas nuevas.
- Depende del Módulo 2 (Pedidos desde la mesa) para el campo mesero en `menu.html` que este módulo reemplaza.
- Alimenta transitivamente al Módulo 8 (Meseros y Comisiones): mejora la calidad del dato `Mesero` en `Ventas` sin que Módulo 8 haya necesitado cambios propios (ver "Qué ya existe" arriba).
- No depende de ni bloquea los Módulos 4 (División de cuenta) o 9 (Caja) — son líneas de trabajo independientes sobre el mismo Sheet del menú.
