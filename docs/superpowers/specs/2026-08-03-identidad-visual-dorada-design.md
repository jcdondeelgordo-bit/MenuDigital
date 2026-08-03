# Identidad visual "Donde el Gordo" (dorado cálido) + reorden de categorías del menú

**Fecha:** 2026-08-03
**Referencia visual:** `Donde el Gordo - UI (standalone).html` (mockup del primo, exportado como artifact — no es código reutilizable directamente, solo referencia de paleta/tipografía/estructura).

## Objetivo

Unificar la identidad visual de las 10 pantallas HTML del sistema ZFood GyP bajo una
paleta cálida oscura y tipografía Poppins+Inter, y reordenar las categorías del menú
digital de cliente para que Platos, Picadas, Hamburguesas y Pizzas aparezcan primero.

Es un cambio puramente visual + de orden de datos. Ninguna lógica de negocio (carrito,
WhatsApp, backend Apps Script, puntos de fidelidad, flujo de caja/cocina) se modifica.

## 1. Orden de categorías (menu.html)

Orden fijo, sin importar el orden en que lleguen los datos del backend o del mock local:

```
Platos, Picadas, Hamburguesas, Pizzas, Perros, Papas, Especiales, Adicionales, Bebidas
```

Implementación: constante `ORDEN_CATEGORIAS` (array de strings) + `renderCategorias()`
construye la lista de categorías presentes en `PRODUCTOS`, las ordena según su índice en
`ORDEN_CATEGORIAS` (cualquier categoría no listada cae al final, en el orden en que
aparezca) en vez de usar el orden de inserción del `Set`. Esto evita depender de reordenar
`MOCK_PRODUCTOS` (frágil) y sigue funcionando si el backend real devuelve otro orden.

## 2. Tokens de diseño compartidos

Sustituyen los valores actuales en las 10 pantallas:

| Token | Antes | Ahora |
|---|---|---|
| Fondo | `#1a0a00` plano | `radial-gradient(1200px 800px at 20% -10%, #241407 0%, #170d06 55%, #120a04 100%)` fijo (`background-attachment` no aplica en degradado con posición absoluta; se define en `body`) |
| Dorado principal (precios, CTA, activo) | `#e8a832` / gradiente `#c8841a→#e8a832` | `#e0a53f` sólido |
| Dorado secundario (bordes, acentos) | `#c8841a` | `#caa153` |
| Texto principal | `#fff` | `#f3e6d0` |
| Texto apagado | `rgba(240,224,176,0.7)` / `rgba(240,224,176,0.5)` | `#c9b89a` (secundario) / `#b6a180` (terciario) |
| Texto sobre dorado (botones sólidos) | `#1a0a00` | `#1a0f07` |
| Tarjeta/panel de fondo | `rgba(255,255,255,0.05)` / `#241000` | `#2a1a0f` (impar) / `#20140b` (par, para listas tipo zebra) o `#241408` (paneles sólidos) |
| Borde de tarjeta | `rgba(200,132,26,0.2-0.4)` | `#3a2612` (sutil) / `#caa153` (marcado, 1.5px) |
| Ícono cuadrado de producto | fondo `rgba(200,132,26,0.15)` | fondo `#3a2415`, borde `1px solid #caa153` |
| Botón circular "+" | gradiente `#c8841a→#e8a832` | sólido `#e0a53f`, texto `#1a0f07` |
| Tipografía | `'Segoe UI', sans-serif` | `'Inter', sans-serif` (cuerpo) + `'Poppins', sans-serif` (títulos, pesos 700-800), cargadas desde Google Fonts en el `<head>` |

Estos tokens se documentan una sola vez (comentario o bloque `:root` con custom properties
CSS al inicio de cada archivo) para que cada pantalla los aplique de forma consistente sin
tener que redescubrirlos.

## 3. Píldoras de categoría con color propio (solo menu.html)

Cada una de las 9 categorías tiene su propio tono, asignado así:

| Categoría | Color de fondo (píldora) | Borde |
|---|---|---|
| Platos | `#a9642f` (terracota) | `#c8813f` |
| Picadas | `#8a2a48` (ciruela) | `#a94263` |
| Hamburguesas | `#caa153` (dorado — protagonista) | `#e6c07a` |
| Pizzas | `#7a5323` (bronce) | `#96703c` |
| Perros | `#8a5a2b` (marrón) | `#a97142` |
| Papas | `#6b1530` (vino) | `#8a2a48` |
| Especiales | `#5c3a1e` (cacao) | `#7a5323` |
| Adicionales | `#6b4a2a` (tostado) | `#87613a` |
| Bebidas | `#4a3319` (marrón oscuro) | `#6b4a2a` |

Texto sobre cada píldora: `#f3e6d0` (inactiva) / `#1a0f07` sobre fondo dorado cuando
Hamburguesas está activa (es la única lo bastante clara para requerir texto oscuro; el
resto conserva `#f3e6d0` incluso activa). La píldora activa se resalta además con
`box-shadow: 0 0 14px rgba(202,161,83,0.35)`.

## 4. Alcance por archivo

- **menu.html** — restyle completo (fondo, tipografía, tarjetas, píldoras multicolor,
  paneles, carrito, checkout) + reorden de categorías (sección 1).
- **caja.html, cocina.html, comisiones.html, asesorventas.html, cuadre.html, index.html,
  bienvenida.html** — ya comparten la base `#1a0a00`/`#c8841a`/Segoe UI. Se actualizan los
  tokens de color y la fuente a la tabla de la sección 2, sin tocar estructura HTML ni JS.
- **inventario.html** — hoy usa 'Plus Jakarta Sans' y no comparte paleta. Se lleva a los
  tokens de la sección 2 (fondo, tarjetas, tipografía), conservando su estructura y lógica
  actuales.
- **empleados.html** — hoy usa grises genéricos (`#111/#1c1c1c/#222/#333`) y naranja
  `#e0552b`, sin relación con la marca. Mismo tratamiento que inventario.html.

## 5. Fuera de alcance

- No se modifica ninguna función JS de negocio (cálculo de totales, WhatsApp, Apps Script,
  fidelización, verificación de mesa, etc.).
- No se modifica la estructura HTML/DOM más allá de lo necesario para aplicar clases o
  estilos (ids y `onclick` existentes se preservan intactos).
- No se tocan `Code.gs` / `Code.js` (backend).
- No se decide en este spec la tabla final color-por-categoría pieza por pieza; se fija
  durante la implementación siguiendo la gama de la sección 3.

## 6. Verificación

Al no haber build ni test automatizado (son HTML estáticos con CSS/JS inline), la
verificación es visual: abrir cada archivo modificado en navegador (viewport móvil y
desktop, ya que `menu.html` tiene layout responsive con breakpoint en 900px) y confirmar
que:
- Los textos siguen siendo legibles (contraste suficiente sobre el nuevo fondo).
- Categorías del menú aparecen en el orden de la sección 1.
- Ningún botón/flujo dejó de funcionar (agregar al carrito, checkout, admin, etc.).
