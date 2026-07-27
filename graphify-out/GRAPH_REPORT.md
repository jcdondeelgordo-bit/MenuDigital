# Graph Report - E:/Proyectos ZFood GyP  (2026-07-16)

## Corpus Check
- 10 files · ~34,117 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 165 nodes · 148 edges · 42 communities (14 shown, 28 thin omitted)
- Extraction: 87% EXTRACTED · 11% INFERRED · 1% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.82)
- Token cost: 171,941 input · 0 output

## Community Hubs (Navigation)
- Índice de Módulos del Plan
- Motor de Estado de Cocina (Estado vs Estado_Cocina)
- Identificación de Mesa/Mesero y Estado del Proyecto
- Referencia de Diseño del Menú (Cluvi)
- Integración Inventario y Menú Digital
- Investigación de Referencia y Arquitectura Base
- Captura de Datos del Cliente
- Inventario: Pantallas y Funciones Base
- Configuración de Bonificación (Comisiones)
- Inventario: Motor de Reporte y Catálogo
- Catálogo de Productos y Datos de Muestra
- Validación de Modo Administrador
- Regla de Mesa Abierta
- Cocina en Tablet vs. Recibo Impreso
- Botón Llamar Mesero
- Hallazgo: Enlace Roto a Menú
- Marcar Pedido Completo
- Hoja/Catálogo de Productos
- Edición de Precios
- Domicilio Ahora Registra Venta
- Estados de Pedido: Cocina vs. Caja
- Estructura de Recetas Confirmada
- Turno Cierre (Regla Operativa)
- Empates en el Ranking de Comisiones
- Número de WhatsApp Temporal
- Carrito y Oferta de Papas
- Foto Personal (no relacionada)
- Carrito de Compras (plan)
- Construcción v1 del Módulo 1
- Edición de Precios (doc)
- Modo Admin (menú digital)
- Sección de Recomendados
- Hallazgo: Domicilio vs. En el Local
- Identificación de Mesa por QR
- Premio: Ruleta (Fidelización)
- Tarjeta de Puntos (doc)
- Botones Rápidos (Panel Admin)
- Hoja Reporte (Panel Admin)
- Cálculo de Bonificación
- Hoja Meseros Sugerida
- Regla: Asignación Mesa→Mesero
- Módulo 5 en el Plan Original

## God Nodes (most connected - your core abstractions)
1. `Módulo 2 — Pedidos desde la mesa` - 9 edges
2. `crearPedido(e)` - 9 edges
3. `generarReporteInsumos(fecha)` - 9 edges
4. `Módulo 7 — Panel administrativo` - 7 edges
5. `Módulo 4 — División de cuenta` - 6 edges
6. `Módulo 8 — Meseros y Comisiones` - 6 edges
7. `Módulo 9 — Caja y Facturación` - 6 edges
8. `doPost(e)` - 6 edges
9. `Módulo 3 — Comanda de cocina` - 5 edges
10. `Módulo 6 — Fidelización` - 5 edges

## Surprising Connections (you probably didn't know these)
- `avanzarEstado(fila, estadoActual)` --semantically_similar_to--> `registrarVentaEnSheet(tipo, total)`  [INFERRED] [semantically similar]
  cocina.html → menu.html
- `pedidosMock() datos de muestra` --semantically_similar_to--> `resultadoMock() datos de muestra`  [INFERRED] [semantically similar]
  cocina.html → comisiones.html
- `cargarProductos()` --semantically_similar_to--> `pedidosMock() datos de muestra`  [INFERRED] [semantically similar]
  menu.html → cocina.html
- `Módulo 2. Pedidos desde la mesa (plan original)` --references--> `Módulo 2 — Pedidos desde la mesa`  [EXTRACTED]
  PLAN ZFOOD GyP.txt → Gestion_Proyecto/01-modulos/modulo-2-pedidos-mesa.md
- `Módulo 3. Comanda de cocina (plan original)` --references--> `Módulo 3 — Comanda de cocina`  [EXTRACTED]
  PLAN ZFOOD GyP.txt → Gestion_Proyecto/01-modulos/modulo-3-comanda-cocina.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Flujo: venta digital (menú) escribe en Ventas y el motor de inventario descuenta insumos** — menu_registrarventaensheet, gestion_proyecto_01_modulos_modulo_1_apps_script_nuevo_crearpedido, gestion_proyecto_01_modulos_modulo_5_inventario_code_generarreporteinsumos [INFERRED 0.85]
- **Ciclo de vida del estado de preparación por ítem (crear pedido -> listar en cocina -> avanzar estado)** — gestion_proyecto_01_modulos_modulo_1_apps_script_nuevo_crearpedido, gestion_proyecto_01_modulos_modulo_3_apps_script_comanda_cocina_listarpedidoscocina, gestion_proyecto_01_modulos_modulo_3_apps_script_comanda_cocina_actualizarestadoitem, cocina_avanzarestado [EXTRACTED 1.00]
- **Cálculo de comisiones por mesero a partir de las ventas registradas en Ventas** — gestion_proyecto_01_modulos_modulo_1_apps_script_nuevo_crearpedido, gestion_proyecto_01_modulos_modulo_8_apps_script_comisiones_calcularcomisiones, comisiones_calcularcomisiones [EXTRACTED 1.00]
- **Unificación Pedidos+Ventas como flujo compartido entre módulos** — gestion_proyecto_00_plan_maestro_unificacion_pedidos_ventas, gestion_proyecto_01_modulos_modulo_2_pedidos_mesa_decision_pedido_es_venta, gestion_proyecto_01_modulos_modulo_3_comanda_cocina_comanda_cocina, gestion_proyecto_01_modulos_modulo_8_meseros_comisiones_meseros_comisiones, gestion_proyecto_01_modulos_modulo_9_caja_facturacion_caja_facturacion [INFERRED 0.85]
- **Cocina y Caja leen la misma hoja Ventas con estados independientes** — gestion_proyecto_01_modulos_modulo_3_comanda_cocina_comanda_cocina, gestion_proyecto_01_modulos_modulo_9_caja_facturacion_caja_facturacion, gestion_proyecto_00_plan_maestro_hoja_ventas [EXTRACTED 1.00]

## Communities (42 total, 28 thin omitted)

### Community 0 - "Índice de Módulos del Plan"
Cohesion: 0.13
Nodes (23): Pantalla de introducción / captura de cliente, Hoja Pedidos (descartada como destino final), Hoja Ventas (Google Sheet), Gap detectado con Graphify: falta Módulo 8, Gap detectado en revisión: falta rol de cajero (Módulo 9), Orden de fases recomendado, Decisión: unificar Hoja Pedidos y Hoja Ventas, Módulo 1 — Menú Digital (+15 more)

### Community 1 - "Motor de Estado de Cocina (Estado vs Estado_Cocina)"
Cohesion: 0.12
Nodes (16): avanzarEstado(fila, estadoActual), cargarPedidos(esPolling), detectarNuevos()/beep() aviso sonoro de pedido nuevo, Vista Activos/Historial, Columnas nuevas de la hoja Ventas (Estado, Tipo_Pedido, ID_Pedido, Observacion, Mesa, Mesero, Estado_Cocina), actualizarEstadoItem(e), Estado (pago) vs Estado_Cocina (preparación) son columnas separadas, ESTADOS_COCINA (Pendiente/En preparación/Listo/Entregado) (+8 more)

### Community 2 - "Identificación de Mesa/Mesero y Estado del Proyecto"
Cohesion: 0.12
Nodes (15): calcularComisiones() (frontend), buscarMeseroMesaAbierta(hoja, mesa), crearPedido(e), estadoMesa(e), calcularComisiones(e), Estado Módulo 1 — Menú Digital (2026-07-16), Estado Módulo 2 — Pedidos desde la mesa (2026-07-16), Estado Módulo 8 — Meseros y Comisiones (2026-07-16) (+7 more)

### Community 3 - "Referencia de Diseño del Menú (Cluvi)"
Cohesion: 0.21
Nodes (13): Phone mockup: 'NUESTRO MENÚ' digital menu app UI (dark theme, gold accents), Category tabs: Recomendados, Entradas, Platos fuertes, Postres, Bebidas, Cluvi Menú Digital - Marketing/Design Reference, CTA banner: 'Más control. Más ventas. Mejores decisiones. Un menú digital es una herramienta de crecimiento.', Feature: Tomar decisiones con datos de consumo de clientes, Feature: Destacar platos con imágenes que venden, Feature: Actualizar precios y platos al instante, Feature: Aumentar ticket promedio con menús diseñados para vender (+5 more)

### Community 4 - "Integración Inventario y Menú Digital"
Cohesion: 0.22
Nodes (11): generarReporteInsumos(fecha), Integración: lee Ventas del menú digital vía MENU_SHEET_ID para descontar insumos, normalizeName(s), Hoja Gastos_JC (consumo/retiro autorizado manual), Decisión: Inventario y Menú Digital quedaron integrados (2026-07-16), Objetivo del Módulo 5 (descuento automático de ingredientes por venta), Riesgo: doble conteo si la misma venta se registra por menú y por tirilla, Decisión de arquitectura: Inventario y Menú integrados, la venta se registra sola (+3 more)

### Community 5 - "Investigación de Referencia y Arquitectura Base"
Cohesion: 0.25
Nodes (8): API: Google Apps Script Web App, Arquitectura: Google Sheets como base de datos, Identificación de mesa por QR (parámetro ?mesa=N), Comparación: Donde El Gordo vs. menululo, menululo.com (referencia de mercado), POS mesa→cocina→caja (menululo), Planes de precio de menululo (Gratis a Imperio), Referencia a menululo.com (plan original)

### Community 6 - "Captura de Datos del Cliente"
Cohesion: 0.29
Nodes (7): buscarCliente(tel), registrarCliente() (nombre, cumpleaños, teléfono), SCRIPT_URL (endpoint Apps Script), Hoja Clientes, Nota de seguridad crítica (PII sin autenticación), Captura de datos de cliente (nombre, celular, fecha nacimiento), Pedido de seguridad para datos personales (plan original)

### Community 7 - "Inventario: Pantallas y Funciones Base"
Cohesion: 0.29
Nodes (7): borrarFilasPorFecha(sheet, fecha, colIndex), doPost(e), getOrCreateSheet(ss, name, headers), registrarEnvio(ss, idEnvio, tipo, timestamp), Conteo físico por área (Pizzero/Cocina/Parrilla/Neveras), Pantalla Ingresos de Mercancía, Pantalla Tirilla de Ventas

### Community 8 - "Configuración de Bonificación (Comisiones)"
Cohesion: 0.40
Nodes (4): guardarConfiguracion(), Configuración de posiciones premiadas del ranking (UI), Hoja Configuracion_Bonificacion, guardarConfiguracionBono(e)

### Community 9 - "Inventario: Motor de Reporte y Catálogo"
Cohesion: 0.40
Nodes (5): doGet(e), escribirPestanaReporte(fecha, cruce), escribirResumenReporte(...), getProductType()/calcProductAreaTotal() motor de conversión paquete/gramaje/unidades, SCRIPT_URL de inventario.html (endpoint Apps Script propio, distinto del menú)

### Community 10 - "Catálogo de Productos y Datos de Muestra"
Cohesion: 0.50
Nodes (3): pedidosMock() datos de muestra, resultadoMock() datos de muestra, cargarProductos()

### Community 12 - "Regla de Mesa Abierta"
Cohesion: 0.67
Nodes (3): Regla: mesero original de una mesa abierta queda protegido, No se creó hoja Meseros: se agrupa por texto exacto del nombre, Decisión: mesa abierta puede seguir recibiendo pedidos, mesero original protegido

### Community 13 - "Cocina en Tablet vs. Recibo Impreso"
Cohesion: 0.67
Nodes (3): Decisión: pantalla tipo tablet, no impresora de tickets, Diseño de pantalla de cocina (check por ítem, historial), Plantilla de recibo térmico de 80mm

### Community 14 - "Botón Llamar Mesero"
Cohesion: 0.67
Nodes (3): Botón "Llamar al mesero", Botón de llamado al mesero (menululo), Idea: botón "Llamar al mesero" (plan original)

## Ambiguous Edges - Review These
- `Hoja Ventas (Google Sheet)` → `Hoja Pedidos (descartada como destino final)`  [AMBIGUOUS]
  Gestion_Proyecto/00-PLAN-MAESTRO.md · relation: shares_data_with
- `Cluvi Menú Digital - Marketing/Design Reference` → `Producto: Rib Eye al Grill - $79.000 (Recomendado)`  [AMBIGUOUS]
  menu diseño.jpeg · relation: semantically_similar_to

## Knowledge Gaps
- **67 isolated node(s):** `Identificación de mesa por QR (parámetro ?mesa=N)`, `Hoja Productos (catálogo, solo lectura)`, `Hoja Clientes`, `Catálogo de productos (menú digital)`, `Carrito de compras (planeado)` (+62 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Hoja Ventas (Google Sheet)` and `Hoja Pedidos (descartada como destino final)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Cluvi Menú Digital - Marketing/Design Reference` and `Producto: Rib Eye al Grill - $79.000 (Recomendado)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `crearPedido(e)` connect `Identificación de Mesa/Mesero y Estado del Proyecto` to `Motor de Estado de Cocina (Estado vs Estado_Cocina)`, `Integración Inventario y Menú Digital`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `generarReporteInsumos(fecha)` connect `Integración Inventario y Menú Digital` to `Motor de Estado de Cocina (Estado vs Estado_Cocina)`, `Identificación de Mesa/Mesero y Estado del Proyecto`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `Identificación de mesa por QR (parámetro ?mesa=N)`, `Hoja Productos (catálogo, solo lectura)`, `Hoja Clientes` to the rest of the system?**
  _67 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Índice de Módulos del Plan` be split into smaller, more focused modules?**
  _Cohesion score 0.13438735177865613 - nodes in this community are weakly interconnected._
- **Should `Motor de Estado de Cocina (Estado vs Estado_Cocina)` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._