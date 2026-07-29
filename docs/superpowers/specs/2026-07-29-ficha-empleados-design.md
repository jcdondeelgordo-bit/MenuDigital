# Ficha de Empleados — Diseño

Fecha: 2026-07-29

## Contexto y problema

Hoy varias pantallas del sistema piden un nombre de persona en texto libre, sin ningún
catálogo detrás:

- `menu.html`: el mesero escribe su nombre a mano al abrir una mesa (usado luego por
  `comisiones.html` para el ranking de ventas — riesgo ya conocido de que "Juan" y
  "Juan P." se cuenten como personas distintas).
- `inventario.html`: el conteo físico por área no guarda ningún nombre de quién lo hizo,
  y el formulario de Ingresos tampoco registra quién trajo la mercancía ni quién la
  recibió.

Esto último se volvió un problema concreto: cuando se trasladan productos de la bodega
externa (hamburguesas artesanales, pan hamburguesa, etc.) al negocio, quien transporta no
registra nada y deja la responsabilidad a quien recibe; si quien recibe está ocupado,
cuenta "cuando tiene tiempo" o directamente adivina la cantidad. No queda ningún rastro de
quién hizo qué.

Se decidió construir un catálogo de empleados de uso general para el negocio, y conectarlo
a las pantallas relevantes de una vez (Inventario, Meseros, y transitivamente Comisiones),
en vez de resolverlo por partes.

## Alcance

Incluye:
- Hoja `Empleados` (catálogo) y pantalla de administración `empleados.html`.
- Selector de empleados activos en `menu.html` (nombre del mesero).
- Selector de responsable en `inventario.html` (conteo por área e Ingresos).

No incluye (fuera de alcance, explícitamente):
- Control de asistencia diaria / inasistencias — `Activo` es solo para cuando alguien deja
  de trabajar en el negocio (renuncia o despido), no para marcar ausencias del día a día.
- Registro formal de traslados bodega → negocio (qué se sacó, cuánto, en qué transporte) —
  eso es un problema de proceso más grande que este catálogo no resuelve por sí solo; lo
  único que se ataca aquí es dejar constancia de **quién** trajo y **quién** recibió,
  usando el mismo formulario de Ingresos que ya existe.
- Cambios a `comisiones.html`, `cocina.html` o `caja.html` — se benefician automáticamente
  de nombres consistentes porque leen el campo Mesero de `Ventas`, que ya no se retipea.
- Campo de Cargo/Rol o Cédula — se decidió no agregarlos por ahora.

## Dónde vive el catálogo

La hoja `Empleados` ya fue creada por el usuario en el **Sheet de Inventario**
(`INVENTARIO DONDE EL GORDO`, `SHEET_ID` en `Code.gs`), con columnas:

| Nombre | Celular | Fecha_Ingreso | Activo |
|---|---|---|---|

`Activo` es texto `"Si"` / `"No"`.

- `Code.gs` (Inventario) lee/escribe `Empleados` directo, mismo Sheet.
- El Apps Script del menú (bound a `MENU_SHEET_ID`, usado por `menu.html` y
  `comisiones.html`) necesita una conexión cruzada **nueva** hacia el Sheet de Inventario
  para leer `Empleados` — se agrega una constante `INVENTARIO_SHEET_ID` (mismo valor que
  `SHEET_ID` en `Code.gs`) y se envuelve en try/catch, siguiendo el mismo patrón que ya usa
  `Code.gs` para leer `Ventas` cruzado desde `MENU_SHEET_ID`.

## Backend — acciones nuevas

En **ambos** proyectos de Apps Script (Inventario y Menú) se agregan:

- `listar_empleados` → devuelve solo filas con `Activo = "Si"` (para poblar selectores).
  Cada proyecto la implementa leyendo `Empleados` de la fuente que le corresponda (directo
  en Inventario, cruzado en Menú).
- `listar_empleados_admin` → devuelve todas las filas (activas e inactivas), para la
  pantalla de administración. Solo necesaria en el Apps Script de Inventario, ya que
  `empleados.html` administra la hoja donde vive el catálogo.
- `guardar_empleado` → crea una fila nueva o edita una existente (por nombre exacto);
  nunca borra filas — desactivar es poner `Activo = "No"`. Solo en el Apps Script de
  Inventario.

`guardar_empleado` y `listar_empleados_admin` requieren `verificar_admin` (reutiliza la
misma contraseña de administrador que ya existe). `guardar_empleado` identifica una edición
por nombre exacto (no hay un código/ID separado) — si dos empleados llegaran a tener el
mismo nombre, se pisarían entre sí; riesgo aceptado, mismo criterio que ya se usa hoy para
el nombre de mesero en el Módulo 2.

## `empleados.html` — pantalla de administración

Nueva página, mismo patrón que `comisiones.html`: pide la contraseña de admin antes de
mostrar nada. Una vez dentro:

- Lista de empleados (nombre, celular, fecha de ingreso, estado activo/inactivo).
- Formulario para agregar uno nuevo (Nombre, Celular, Fecha_Ingreso; Activo queda "Si" por
  defecto).
- Botón para desactivar (Activo → "No") — nunca un botón de borrar fila.

## Integración en pantallas existentes

**`menu.html`** (línea ~212): el `<input type="text" id="mesa-mesero">` se reemplaza por un
`<select>` poblado con `listar_empleados`. Si la mesa ya está abierta con un mesero
asignado, el selector queda deshabilitado y preseleccionado en ese nombre — mismo
comportamiento que hoy, solo cambia el tipo de control.

**`inventario.html`**:
- Al enviar el conteo de un área (`guardar_inventario_completo`), se agrega un selector de
  "Responsable" (hoy ese envío no guarda ningún nombre) — nueva columna en la hoja
  `Inventario`.
- En el formulario de Ingresos (`guardar_ingreso`), se agregan dos selectores: "Quién
  trae" y "Quién recibe" — dos columnas nuevas en la hoja `Ingresos`.

## Manejo de errores

Si la llamada a `listar_empleados` falla (Sheet cruzado no disponible, permisos, etc.), el
selector correspondiente cae a un campo de texto libre en vez de bloquear el flujo —
mismo criterio que ya usa el proyecto cuando una lectura cruzada de Sheet falla (el reporte
de insumos sigue funcionando con lo que sí pudo leer). Ningún formulario (pedido, conteo,
ingreso) debe quedar imposibilitado de enviarse por esto.

## Pruebas

Mismo enfoque ya usado en este proyecto para verificar Apps Script sin depender de un
navegador disponible:
- Verificación vía curl contra el `SCRIPT_URL` real de ambos proyectos: crear un empleado
  de prueba, confirmar que aparece en `listar_empleados`, marcarlo `Activo = "No"` y
  confirmar que desaparece de esa lista pero sigue en `listar_empleados_admin`.
- Si hay navegador disponible en la sesión de implementación: prueba de extremo a extremo
  real con Playwright en `menu.html` (elegir mesero del selector, confirmar pedido) e
  `inventario.html` (enviar un conteo y un ingreso con responsable seleccionado).
- Limpiar cualquier fila de prueba (`Empleados`, `Ventas`, `Inventario`, `Ingresos`) al
  terminar, como se ha hecho en cada módulo anterior de este proyecto.
