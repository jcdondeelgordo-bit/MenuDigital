# Identidad Visual Dorada + Reorden de Categorías — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar las 10 pantallas HTML de ZFood GyP bajo una sola paleta cálida oscura
(fondo degradado + dorado + tipografía Poppins/Inter) y reordenar las categorías del menú
digital de cliente (Platos, Picadas, Hamburguesas, Pizzas primero).

**Architecture:** Cambio puramente visual (CSS) + un cambio de orden de datos (JS) en
`menu.html`. Cada uno de los 10 archivos HTML es independiente (sin build step, CSS/JS
inline) — cada tarea toca un solo archivo y es verificable por separado abriendo el archivo
en el navegador. No hay lógica de negocio, backend ni estructura DOM que cambie.

**Tech Stack:** HTML/CSS/JS vanilla, sin frameworks ni bundler. Fuentes vía Google Fonts CDN
(el sistema ya depende de red para `fetch()` a Google Apps Script, así que cargar fuentes
por CDN no agrega una dependencia nueva).

**Spec:** `docs/superpowers/specs/2026-08-03-identidad-visual-dorada-design.md`

## Global Constraints

- No modificar ninguna función JS de negocio (cálculo de totales, WhatsApp, Apps Script,
  fidelización, verificación de mesa, impresión de recibos, etc.).
- No modificar `Code.gs` / `Code.js`.
- No modificar ids ni atributos `onclick` existentes — el HTML/DOM se preserva intacto,
  solo cambian valores dentro de `<style>` (y, en `menu.html`, dos funciones JS puntuales
  para el orden/color de categorías).
- Preservar todos los colores **funcionales/semánticos** que no son de marca: rojo de
  urgente/pendiente/error (`#e05050`, `#a8291c`, `rgba(224,80,80,*)`, `#ef4444`,
  `rgba(239,68,68,*)`, `#ff4b5c`/`#d32f2f` en botones de acción destructiva), verde de
  pagado/éxito (`#5fd489`, `rgba(70,180,100,*)`, `#155c3f`, `#2a9968`, `#10b981` una vez
  retinado — ver Tarea 11), azul de "listo" (`#7db2f0`, `rgba(90,140,220,*)`), y gris neutro
  de "mesa libre" (`#1c1c1c`, `rgba(255,255,255,0.15)`). Ninguno de estos se toca.
- Los fondos translúcidos blancos (`rgba(255,255,255,0.03-0.1)`) usados como overlay de
  tarjetas/inputs se conservan tal cual — siguen funcionando igual de bien sobre el fondo
  nuevo, más oscuro y cálido.

### Receta de sustitución de tokens de marca (aplica a Tareas 3-9 y 2)

Reemplazos exactos, por string literal (no regex), en este orden:

1. `linear-gradient(135deg,#c8941a,#e8c832)` → `#e0a53f` (variante dorada de "mesa pagada")
2. `#c8841a` → `#caa153` (replace_all)
3. `#e8a832` → `#e0a53f` (replace_all)
4. `#e8c87a` → `#e6d3ac` (replace_all)
5. `#f0e0b0` → `#f3e6d0` (replace_all)
6. `rgba(200,132,26,` → `rgba(202,161,83,` (replace_all — preserva el alpha que sigue)
7. `rgba(240,224,176,` → `rgba(201,184,154,` (replace_all — preserva el alpha que sigue)
8. `linear-gradient(135deg,#caa153,#e0a53f)` → `#e0a53f` (aplana el gradiente de marca a
   sólido — este string solo existe después de los pasos 2-3, por eso va al final)
9. `#241000` → `#241408` y `#2a1500` → `#241408` (solo en los archivos donde existan)
10. Todo `#1a0a00` que quede en el archivo después del paso especial del fondo del `body`
    (ver cada tarea) es texto sobre botón dorado → replace_all `#1a0a00` → `#1a0f07`
11. `'Segoe UI',sans-serif` en la regla `body` → `'Inter',sans-serif`
12. Insertar en `<head>`, justo antes de `<style>`:
    ```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@700;800&display=swap" rel="stylesheet">
    ```
13. Agregar `font-family:'Poppins',sans-serif;` al inicio de la declaración de cada
    selector de título listado en la tarea (distinto por archivo).

El fondo del `body` NO sigue la receta genérica: se reemplaza explícitamente por el
degradado de marca (ver el paso 0 de cada tarea, con el string exacto de cada archivo).
El fondo del `header`/paneles sticky se reemplaza por el tono sólido `#170d06` (no el
degradado completo, para evitar que se vea repetido/cortado en una barra angosta).

---

### Task 1: menu.html — orden fijo de categorías

**Files:**
- Modify: `menu.html:438-441` (agrega `ORDEN_CATEGORIAS` y `COLORES_CATEGORIA` junto a `ICONOS_CATEGORIA`)
- Modify: `menu.html:526-541` (`renderCategorias()` y `seleccionarCategoria()`)

**Interfaces:**
- Consumes: `PRODUCTOS` (array global ya poblado por `cargarProductos()`), `ICONOS_CATEGORIA`
  (objeto ya existente).
- Produces: `ORDEN_CATEGORIAS` (array de strings, usado también por Tarea 2 si hiciera falta
  referenciar el orden), `COLORES_CATEGORIA` (objeto `{ [categoria]: {bg, border} }`, usado
  únicamente dentro de `renderCategorias()`).

- [ ] **Step 1: Agregar las constantes de orden y color**

Justo después de la línea 441 (cierre de `ICONOS_CATEGORIA`), agregar:

```javascript
const ORDEN_CATEGORIAS = ['Platos','Picadas','Hamburguesas','Pizzas','Perros','Papas','Especiales','Adicionales','Bebidas'];

const COLORES_CATEGORIA = {
  'Platos':       { bg: '#a9642f', border: '#c8813f' },
  'Picadas':      { bg: '#8a2a48', border: '#a94263' },
  'Hamburguesas': { bg: '#caa153', border: '#e6c07a' },
  'Pizzas':       { bg: '#7a5323', border: '#96703c' },
  'Perros':       { bg: '#8a5a2b', border: '#a97142' },
  'Papas':        { bg: '#6b1530', border: '#8a2a48' },
  'Especiales':   { bg: '#5c3a1e', border: '#7a5323' },
  'Adicionales':  { bg: '#6b4a2a', border: '#87613a' },
  'Bebidas':      { bg: '#4a3319', border: '#6b4a2a' }
};
```

- [ ] **Step 2: Reescribir `renderCategorias()` y `seleccionarCategoria()`**

Reemplazar el bloque completo (líneas 526-541 del archivo original):

```javascript
function renderCategorias() {
  const categorias = [...new Set(PRODUCTOS.map(p => p.categoria))];
  categoriaActiva = categorias[0];
  const cont = document.getElementById('categorias');
  cont.innerHTML = categorias.map(c =>
    `<div class="cat-pill${c === categoriaActiva ? ' activa' : ''}" data-cat="${c}" onclick="seleccionarCategoria('${c.replace(/'/g,"\\'")}')">${ICONOS_CATEGORIA[c] || '🍴'} ${c}</div>`
  ).join('');
}

function seleccionarCategoria(cat) {
  categoriaActiva = cat;
  document.querySelectorAll('.cat-pill').forEach(el => {
    el.classList.toggle('activa', el.dataset.cat === cat);
  });
  renderProductos();
}
```

por:

```javascript
function renderCategorias() {
  const presentes = [...new Set(PRODUCTOS.map(p => p.categoria))];
  const categorias = presentes.slice().sort((a, b) => {
    const ia = ORDEN_CATEGORIAS.indexOf(a);
    const ib = ORDEN_CATEGORIAS.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  if (!categoriaActiva || !categorias.includes(categoriaActiva)) {
    categoriaActiva = categorias[0];
  }
  const cont = document.getElementById('categorias');
  cont.innerHTML = categorias.map(c => {
    const col = COLORES_CATEGORIA[c] || { bg: '#caa153', border: '#e6c07a' };
    const activa = c === categoriaActiva;
    const texto = (c === 'Hamburguesas' && activa) ? '#1a0f07' : '#f3e6d0';
    return `<div class="cat-pill${activa ? ' activa' : ''}" data-cat="${c}" style="background:${col.bg};border-color:${col.border};color:${texto};" onclick="seleccionarCategoria('${c.replace(/'/g,"\\'")}')">${ICONOS_CATEGORIA[c] || '🍴'} ${c}</div>`;
  }).join('');
}

function seleccionarCategoria(cat) {
  categoriaActiva = cat;
  renderCategorias();
  renderProductos();
}
```

- [ ] **Step 3: Verificar manualmente**

Abrir `menu.html` en el navegador (doble clic o `start menu.html` en la terminal). Confirmar:
- Las píldoras de categoría aparecen en este orden: Platos, Picadas, Hamburguesas, Pizzas,
  Perros, Papas, Especiales, Adicionales, Bebidas.
- Tocar cada píldora cambia la categoría activa y la lista de productos de abajo, sin
  recargar la página ni perder el carrito.
- Con el carrito ya con productos (agrega alguno), cambiar de categoría no debe vaciar el
  carrito ni el badge flotante.

- [ ] **Step 4: Commit**

```bash
git add menu.html
git commit -m "feat: orden fijo de categorias en el menu (platos, picadas, hamburguesas, pizzas primero)"
```

---

### Task 2: menu.html — restyle visual completo

**Files:**
- Modify: `menu.html:1-112` (bloque `<style>`)
- Modify: `menu.html:6` (agregar `<link>` de Google Fonts antes de `<style>`)

**Interfaces:**
- Consumes: ninguna (solo CSS). Depende de que Task 1 ya haya reemplazado
  `.cat-pill.activa` por el manejo de color inline — si Task 1 no se ha aplicado todavía,
  aplicar igual el Step 2 de esta tarea (es un cambio de CSS puro, no rompe nada si se hace
  antes).
- Produces: nada que otras tareas consuman.

- [ ] **Step 1: Insertar el link de Google Fonts**

Insertar inmediatamente antes de la línea 7 (`<style>`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@700;800&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Fondo del `body` y del `header`**

Reemplazar (línea 9):
```css
body{font-family:'Segoe UI',sans-serif;background:#1a0a00;color:#fff;min-height:100vh;padding-bottom:90px;}
```
por:
```css
body{font-family:'Inter',sans-serif;background:radial-gradient(1200px 800px at 20% -10%,#241407 0%,#170d06 55%,#120a04 100%);color:#f3e6d0;min-height:100vh;padding-bottom:90px;}
```

Reemplazar (línea 11):
```css
header{position:sticky;top:0;z-index:20;background:#1a0a00;border-bottom:1px solid rgba(200,132,26,0.3);padding:14px 16px 0;}
```
por:
```css
header{position:sticky;top:0;z-index:20;background:#170d06;border-bottom:1px solid rgba(200,132,26,0.3);padding:14px 16px 0;}
```

- [ ] **Step 3: Limpiar `.cat-pill.activa`**

Reemplazar (línea 21):
```css
.cat-pill.activa{background:linear-gradient(135deg,#c8841a,#e8a832);color:#1a0a00;font-weight:700;border-color:transparent;}
```
por:
```css
.cat-pill.activa{font-weight:700;box-shadow:0 0 14px rgba(202,161,83,0.35);}
```
(el color/fondo/borde de cada píldora, activa o no, ya lo pone Task 1 vía `style=""` inline
por categoría — esta regla solo agrega el resalte del estado activo.)

- [ ] **Step 4: Aplicar la Receta de sustitución de tokens**

Aplicar, en este orden, los pasos 2-3-4-5-6-7-8-10 de la "Receta de sustitución de tokens de
marca" de Global Constraints sobre el resto del bloque `<style>` (líneas 12-112). Después de
este paso no debe quedar ningún `#c8841a`, `#e8a832`, `#e8c87a`, `#f0e0b0`,
`rgba(200,132,26,`, `rgba(240,224,176,` ni `#1a0a00` en el archivo (confirmar con Step 6).

- [ ] **Step 5: Agregar `'Poppins'` a los títulos**

Agregar `font-family:'Poppins',sans-serif;` al inicio de la declaración de estos selectores
(ya existentes, solo se les agrega la propiedad):
- `.header-titulo` (línea 13)
- `.seccion-titulo` (línea 28)
- `.panel-header h3` (línea 50)
- `.confirmacion h3` (línea 83)
- `.tarjeta-puntos-titulo` (línea 90)
- `.tipo-pedido-btn strong` (línea 72)

- [ ] **Step 6: Verificar con grep que no quedan tokens viejos**

```bash
grep -c "#c8841a\|#e8a832\|#e8c87a\|#f0e0b0\|rgba(200,132,26\|rgba(240,224,176\|#1a0a00" menu.html
```
Expected: `0`

- [ ] **Step 7: Verificar visualmente**

Abrir `menu.html` en el navegador en dos anchos (móvil ~380px y desktop >900px, el layout
tiene un breakpoint en 900px). Confirmar:
- Fondo degradado cálido oscuro visible, sin bandas de color duras.
- Textos legibles (crema sobre fondo oscuro, dorado sobre fondo oscuro).
- Botón "+" circular y "Hacer pedido" en dorado sólido `#e0a53f` con texto oscuro legible.
- Las píldoras de categoría muestran colores distintos entre sí (no todas doradas).
- Abrir el carrito, el panel de checkout y el panel de admin — deben verse con la misma
  paleta, sin fondos negros puros sueltos.

- [ ] **Step 8: Commit**

```bash
git add menu.html
git commit -m "feat: aplicar identidad visual dorada calida (fondo degradado, Poppins/Inter, pildoras multicolor) a menu.html"
```

---

### Task 3: caja.html — actualizar tokens de marca

**Files:**
- Modify: `caja.html:1-120` (bloque `<style>`)

**Interfaces:** Ninguna (solo CSS).

- [ ] **Step 1: Google Fonts + fondo body/header**

Insertar el `<link>` de Google Fonts (paso 12 de la Receta) antes de la línea 7.

Reemplazar (línea 10):
```css
body{font-family:'Segoe UI',sans-serif;background:#1a0a00;color:#fff;min-height:100vh;}
```
por:
```css
body{font-family:'Inter',sans-serif;background:radial-gradient(1200px 800px at 20% -10%,#241407 0%,#170d06 55%,#120a04 100%);color:#f3e6d0;min-height:100vh;}
```

Reemplazar (línea 12), solo el `background:#1a0a00;` por `background:#170d06;` (el resto de
la línea del `header` queda igual).

Reemplazar (línea 22), solo el `background:#1a0a00;` de `.banner-mock` por `background:#170d06;`
(el resto de la línea, incluido el borde rojo `#e05050`, queda igual — es un aviso de datos
mock, su borde rojo es intencional y no se toca).

- [ ] **Step 2: Aplicar la Receta de sustitución completa (pasos 1-10)** sobre el resto del
  archivo.

- [ ] **Step 3: Poppins en títulos**

Agregar `font-family:'Poppins',sans-serif;` a:
- `.header-titulo` (línea 13)
- `.pedido-titulo` (línea 26)
- `.panel-division h3` (línea 41)
- `.panel-vr h3` (línea 60)
- `.modal-cobrar h3` (línea 90)
- `.modal-detalle h3` (línea 113)

- [ ] **Step 4: Verificar**

```bash
grep -c "#c8841a\|#e8a832\|#e8c87a\|#f0e0b0\|rgba(200,132,26\|rgba(240,224,176\|#1a0a00\|#2a1500" caja.html
```
Expected: `0`. Luego abrir `caja.html` en el navegador: confirmar que el grid de mesas
(verde=libre... no, gris=libre, rojo=ocupada-pendiente, dorado=ocupada-pagada) sigue
distinguiéndose bien, que el panel de cobrar y el de recibo (impresión) se ven correctos.

- [ ] **Step 5: Commit**

```bash
git add caja.html
git commit -m "style: aplicar tokens de identidad visual dorada a caja.html"
```

---

### Task 4: cocina.html — actualizar tokens de marca

**Files:**
- Modify: `cocina.html:1-64`

- [ ] **Step 1:** Google Fonts + fondo body/header igual que Task 3 (línea 9 body, línea 11 header).

- [ ] **Step 2:** Aplicar la Receta de sustitución completa (pasos 1-10). Nota: NO tocar
  `.pedido-card.urgente{border-color:#e05050;...}`, `.item-estado-btn.est-listo{...#7db2f0}`,
  `.pedido-transcurrido.urgente{color:#e05050}`, `.pedido-completo-msg{color:#5fd489}` — son
  colores de estado funcional (urgente/listo/completo), no de marca.

- [ ] **Step 3:** Poppins en `.header-titulo` (línea 12) y `.pedido-mesa` (línea 30).

- [ ] **Step 4: Verificar**

```bash
grep -c "#c8841a\|#e8a832\|#e8c87a\|#f0e0b0\|rgba(200,132,26\|rgba(240,224,176\|#1a0a00" cocina.html
```
Expected: `0`. Abrir en navegador: confirmar que las tarjetas de pedido urgente siguen en
rojo y las de "listo"/"entregado" en su color propio, sin confundirse con el dorado nuevo.

- [ ] **Step 5: Commit**

```bash
git add cocina.html
git commit -m "style: aplicar tokens de identidad visual dorada a cocina.html"
```

---

### Task 5: comisiones.html — actualizar tokens de marca

**Files:**
- Modify: `comisiones.html:1-55`

- [ ] **Step 1:** Google Fonts + fondo body (línea 9, incluye `padding-bottom:60px;` al
  final — conservar ese fragmento) + header (línea 11).

- [ ] **Step 2:** Aplicar la Receta completa (pasos 1-10), incluyendo el paso 9
  (`#241000` → `#241408`, usado en `.login-box` línea 53).

- [ ] **Step 3:** Poppins en `.header-titulo` (línea 12), `.seccion h2` (línea 18),
  `.login-box h3` (línea 54).

- [ ] **Step 4: Verificar**

```bash
grep -c "#c8841a\|#e8a832\|#e8c87a\|#f0e0b0\|rgba(200,132,26\|rgba(240,224,176\|#1a0a00\|#241000" comisiones.html
```
Expected: `0`. Abrir en navegador: la tabla de ranking, el badge de posición y el mensaje de
error/ok deben conservar rojo/verde funcionales sin cambios.

- [ ] **Step 5: Commit**

```bash
git add comisiones.html
git commit -m "style: aplicar tokens de identidad visual dorada a comisiones.html"
```

---

### Task 6: asesorventas.html — actualizar tokens de marca

**Files:**
- Modify: `asesorventas.html:1-38`

- [ ] **Step 1:** Google Fonts + fondo body (línea 10) + header (línea 12).

- [ ] **Step 2:** Aplicar la Receta completa (pasos 1-10). No tocar `.banner-mock` más allá
  del fondo (`background:#1a0a00` → `#170d06`, el borde `#e05050` se conserva), ni
  `.btn-mesa.estado-ocupada-pendiente` (rojo funcional).

- [ ] **Step 3:** Poppins en `.header-titulo` (línea 15) y `.pantalla-login h2` (línea 34).

- [ ] **Step 4: Verificar**

```bash
grep -c "#c8841a\|#e8a832\|#e8c87a\|#f0e0b0\|rgba(200,132,26\|rgba(240,224,176\|#1a0a00" asesorventas.html
```
Expected: `0`. Abrir en navegador: el grid de mesas conserva sus 3 estados (libre/pendiente/pagada)
distinguibles.

- [ ] **Step 5: Commit**

```bash
git add asesorventas.html
git commit -m "style: aplicar tokens de identidad visual dorada a asesorventas.html"
```

---

### Task 7: cuadre.html — actualizar tokens de marca

**Files:**
- Modify: `cuadre.html:1-35`

- [ ] **Step 1:** Google Fonts + fondo body (línea 9) + header (línea 11).

- [ ] **Step 2:** Aplicar la Receta completa (pasos 1-10). No tocar `.toast.ok`
  (`rgba(70,180,100,0.9)`) ni `.toast.error` (`rgba(224,80,80,0.9)`).

- [ ] **Step 3:** Poppins en `.header-titulo` (línea 12) y `.card h3` (línea 25).

- [ ] **Step 4: Verificar**

```bash
grep -c "#c8841a\|#e8a832\|#e8c87a\|#f0e0b0\|rgba(200,132,26\|rgba(240,224,176\|#1a0a00" cuadre.html
```
Expected: `0`. Abrir en navegador y revisar las 3 vistas de tabs (`.vista.activa`).

- [ ] **Step 5: Commit**

```bash
git add cuadre.html
git commit -m "style: aplicar tokens de identidad visual dorada a cuadre.html"
```

---

### Task 8: index.html — actualizar tokens de marca

**Files:**
- Modify: `index.html:1-29`

- [ ] **Step 1:** Google Fonts + fondo body (línea 9 — sin `header` en este archivo, no hay
  paso de header).

- [ ] **Step 2:** Aplicar la Receta completa (pasos 1-10).

- [ ] **Step 3:** Poppins en `.marca-titulo` (línea 16).

- [ ] **Step 4: Verificar**

```bash
grep -c "#c8841a\|#e8a832\|#e8c87a\|#f0e0b0\|rgba(200,132,26\|rgba(240,224,176\|#1a0a00" index.html
```
Expected: `0`. Abrir en navegador: el logo, el botón "Ver el Menú" y las tarjetas de
herramientas deben verse con la paleta nueva.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "style: aplicar tokens de identidad visual dorada a index.html"
```

---

### Task 9: bienvenida.html — actualizar tokens de marca

**Files:**
- Modify: `bienvenida.html:1-56` (⚠️ el archivo pesa 4.3MB por videos/imágenes en base64
  incrustados **después** de la línea 56 — nunca leer ni editar más allá del bloque
  `<style>`, que termina en la línea 56. Usar `Read` con `limit` o `Grep`/`Edit` con strings
  cortos, jamás leer el archivo completo.)

- [ ] **Step 1:** Google Fonts + fondo body (línea 9, incluye `overflow-x:hidden;` al
  final — conservarlo). El archivo además tiene un segundo fondo radial propio en
  `#pantalla-intro` (línea 11: `radial-gradient(ellipse at center,#2d1200 0%,#1a0a00 70%)`)
  y en `#pantalla-sugerencias` (línea 42, mismo patrón) — reemplazar el `#1a0a00` final de
  esos dos degradados radiales por `#120a04` (mantener la forma `ellipse at center`/`at top`,
  solo cambiar ese color final) y `#2d1200` por `#241407`.

- [ ] **Step 2:** Aplicar la Receta completa (pasos 1-10) sobre el resto del bloque
  `<style>` (líneas 8-56).

- [ ] **Step 3:** Poppins en `.titulo` (línea 20), `.sug-header h2` (línea 44),
  `.video-info h3` (línea 51).

- [ ] **Step 4: Verificar**

```bash
grep -c "#c8841a\|#e8a832\|#e8c87a\|#f0e0b0\|rgba(200,132,26\|rgba(240,224,176\|#1a0a00\|#2d1200" bienvenida.html
```
Expected: `0`. Abrir en navegador (puede tardar en cargar por los videos incrustados):
confirmar que el aro giratorio del logo, la pantalla de saludo y la grilla de videos
sugeridos se ven con la paleta nueva.

- [ ] **Step 5: Commit**

```bash
git add bienvenida.html
git commit -m "style: aplicar tokens de identidad visual dorada a bienvenida.html"
```

---

### Task 10: empleados.html — restyle completo (hoy fuera de marca)

**Files:**
- Modify: `empleados.html:7-19` (bloque `<style>` completo — reemplazo total, es corto)

**Interfaces:** Ninguna (solo CSS, cero cambios de JS/HTML).

- [ ] **Step 1: Insertar Google Fonts**

Insertar antes de la línea 7 (paso 12 de la Receta).

- [ ] **Step 2: Reemplazar todo el bloque `<style>`**

Reemplazar el contenido completo entre `<style>` y `</style>` (líneas 8-18) por:

```css
body { font-family:'Inter',sans-serif; background:radial-gradient(1200px 800px at 20% -10%,#241407 0%,#170d06 55%,#120a04 100%); color:#f3e6d0; margin:0; padding:24px; }
h1 { font-family:'Poppins',sans-serif; font-size: 1.4rem; color:#caa153; }
h2 { font-family:'Poppins',sans-serif; color:#caa153; }
.panel { max-width: 480px; margin: 60px auto; background:#241408; border:1px solid rgba(202,161,83,0.25); padding:24px; border-radius:12px; }
input, button { font-size:1rem; padding:10px; border-radius:8px; border:1px solid rgba(202,161,83,0.35); background:rgba(255,255,255,0.06); color:#f3e6d0; width:100%; box-sizing:border-box; margin-bottom:10px; }
button { background:#e0a53f; color:#1a0f07; border:none; cursor:pointer; font-weight:bold; }
button:disabled { opacity:0.5; cursor:not-allowed; }
table { width:100%; border-collapse: collapse; margin-top:16px; }
td, th { padding:8px; border-bottom:1px solid rgba(255,255,255,0.08); text-align:left; font-size:0.9rem; }
.estado-si { color:#5fd489; font-weight:bold; }
.estado-no { color:#b6a180; }
.toast { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#241408; border:1px solid rgba(202,161,83,0.3); color:#f3e6d0; padding:10px 20px; border-radius:8px; display:none; }
```

(`.estado-si`/`.estado-no` pasan de verde/gris genérico a verde-marca/marrón-crema — siguen
siendo semánticamente "activo/inactivo", solo con la paleta nueva en vez de gris puro.)

- [ ] **Step 3: Verificar**

```bash
grep -c "#111\|#1c1c1c\|#222\|#333\|#e0552b\|#444\|#eee\|#4caf50\|#888" empleados.html
```
Expected: `0`. Abrir en navegador: pantalla de clave, tabla de empleados y toast deben verse
con la paleta dorada, consistentes con el resto del sistema.

- [ ] **Step 4: Commit**

```bash
git add empleados.html
git commit -m "style: llevar empleados.html a la identidad visual dorada compartida (antes usaba grises genericos)"
```

---

### Task 11: inventario.html — restyle vía variables CSS (hoy fuera de marca)

**Files:**
- Modify: `inventario.html:15-48` (bloque `:root` + regla `body`)
- Modify: `inventario.html:105` (`.brand-header h1`, gradiente de texto hardcodeado)

**Interfaces:** Ninguna (solo CSS). El resto del archivo (2371 líneas) consume estas
variables (`var(--bg)`, `var(--text)`, `var(--primary)`, `var(--pizza)`, `var(--cocina)`,
`var(--parrilla)`, `var(--nevera)`, `var(--ingresos)`, `var(--ventas)`, `var(--reporte)`,
`var(--card-bg)`, `var(--card-border)`, `var(--card-border-focus)`, `var(--text-muted)`,
`var(--primary-glow)`) — al cambiar solo su definición en `:root`, el resto de las ~600
líneas de CSS se actualiza sin tocarlas.

- [ ] **Step 1: Insertar Google Fonts**

Insertar antes de la línea 14 (`<style>`).

- [ ] **Step 2: Reemplazar el bloque `:root`**

Reemplazar (líneas 15-36):

```css
    :root {
      --bg: #090a0f;
      --card-bg: rgba(255, 255, 255, 0.03);
      --card-border: rgba(255, 255, 255, 0.06);
      --card-border-focus: rgba(255, 255, 255, 0.15);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #ff4b5c;
      --primary-glow: rgba(255, 75, 92, 0.15);

      /* Colors per Area */
      --pizza: #ff4b5c;
      --cocina: #ffa000;
      --parrilla: #ff7600;
      --nevera: #00d2ff;
      --ingresos: #10b981;
      --ventas: #a855f7;
      --reporte: #f59e0b;

      --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
      --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
```

por:

```css
    :root {
      --bg: radial-gradient(1200px 800px at 20% -10%, #241407 0%, #170d06 55%, #120a04 100%);
      --card-bg: rgba(255, 255, 255, 0.04);
      --card-border: rgba(202, 161, 83, 0.18);
      --card-border-focus: rgba(202, 161, 83, 0.4);
      --text: #f3e6d0;
      --text-muted: #b6a180;
      --primary: #e0a53f;
      --primary-glow: rgba(224, 165, 63, 0.18);

      /* Colors per Area */
      --pizza: #7a5323;
      --cocina: #a9642f;
      --parrilla: #5c3a1e;
      --nevera: #4a3319;
      --ingresos: #caa153;
      --ventas: #6b4a2a;
      --reporte: #8a2a48;

      --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
      --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
```

- [ ] **Step 3: Ajustar la regla `body` para aceptar un gradiente**

Reemplazar (línea 46-51):
```css
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
      padding-bottom: 90px; /* space for bottom nav */
    }
```
por:
```css
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
      padding-bottom: 90px; /* space for bottom nav */
    }
```
(`background-color` no acepta un degradado — por eso cambia a `background`.)

Nota: la línea 248 (`.screen-header { ... background: var(--bg); ... }`, header sticky
interno) queda usando la misma variable `--bg`, ahora con el degradado — esto es aceptable
porque `.screen-header` es ancho completo (no una barra angosta), se ve bien igual que en
`menu.html`. Si al verificar visualmente (Step 6) se ve mal recortado, cambiar esa única
línea a `background: #170d06;` en su lugar.

- [ ] **Step 4: Arreglar el encabezado con gradiente de texto hardcodeado**

Reemplazar (línea 105):
```css
      background: linear-gradient(135deg, #fff 30%, #ff4b5c 100%);
```
por:
```css
      font-family: 'Poppins', sans-serif;
      background: linear-gradient(135deg, #f3e6d0 30%, #e0a53f 100%);
```
(agregar la línea de `font-family` dentro de la misma regla `.brand-header h1`, junto a la
del `background`.)

- [ ] **Step 5: Preservar colores funcionales — NO tocar**

Dejar sin cambios: `.btn-primary` (línea 224-227, gradiente rojo `#ff4b5c,#d32f2f` — es un
botón de acción destructiva/confirmación, no de marca), `.toast-success`
(`rgba(16,185,129,*)`), `.toast-error` (`rgba(239,68,68,*)`), y cualquier otro uso de esos
mismos rojos/verdes en el archivo.

- [ ] **Step 6: Verificar**

```bash
grep -c "#090a0f\|#f3f4f6\|#9ca3af\|#ff4b5c\|#ffa000\|#ff7600\|#00d2ff\|#10b981\|#a855f7\|#f59e0b\|Plus Jakarta" inventario.html
```
Expected: la única coincidencia aceptable es `#ff4b5c` y sus pares dentro de `.btn-primary`
y donde ya estaba antes (línea ~225) — todo lo demás debe ser `0`. Abrir `inventario.html`
en el navegador: recorrer las pantallas Home, Pizza/Cocina/Parrilla/Nevera, Ingresos,
Ventas, Reporte — cada una debe mostrar su color de área dentro de la gama cálida (ya no
rojo/cian/púrpura), con textos legibles.

- [ ] **Step 7: Commit**

```bash
git add inventario.html
git commit -m "style: llevar inventario.html a la identidad visual dorada via variables CSS (antes usaba paleta fria propia)"
```

---

## Self-Review Notes

- **Cobertura del spec:** Sección 1 → Task 1. Sección 2 (tokens compartidos) → Tasks 2-11
  (Receta de sustitución). Sección 3 (colores por categoría) → Task 1
  (`COLORES_CATEGORIA`). Sección 4 (alcance por archivo) → una tarea por archivo, con Tasks
  10-11 marcadas como "restyle profundo" según lo acordado. Sección 5 (fuera de alcance) →
  reforzado en Global Constraints. Sección 6 (verificación) → Step de verificación visual +
  grep en cada tarea.
- **Consistencia de nombres:** `ORDEN_CATEGORIAS` y `COLORES_CATEGORIA` se definen y se usan
  una sola vez, dentro de la misma tarea (Task 1) — no hay otra tarea que dependa de esos
  nombres.
- Cada tarea es independiente y de un solo archivo — se pueden ejecutar en cualquier orden
  o en paralelo; Task 1 y Task 2 comparten archivo (`menu.html`) y por eso están
  secuenciadas una después de la otra.
