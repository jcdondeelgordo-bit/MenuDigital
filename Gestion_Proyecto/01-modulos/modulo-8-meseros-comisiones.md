# Módulo 8 — Meseros y Comisiones

> Identificado durante la sesión de mapeo con Graphify (2026-07-14) — no estaba en el plan original en 7 módulos. Se agrega como gap detectado al analizar por qué el Módulo 2 conecta con casi todo el sistema.

## Objetivo
Registrar qué mesero atendió cada venta para poder calcular su bonificación, ya que a los meseros se les paga una bonificación por ventas.

## Funcionalidades (definidas por el usuario)
Cada venta atendida por un mesero debe quedar registrada con:
- **Fecha**
- **Nombre del mesero**
- **Mesa**
- **Valor** (valor de la venta)

Sobre esos datos se calcula la bonificación del mesero.

## Qué ya existe
- Nada todavía. Hoy `bienvenida.html` / Apps Script capturan datos del **cliente** (nombre, WhatsApp), pero no capturan qué mesero atendió la mesa.
- **Resuelto (2026-07-14):** el pedido de mesa y la venta son el mismo registro (ver decisión en `00-PLAN-MAESTRO.md`) — la columna `Mesero` va en la **hoja `Ventas`**, no en una hoja `Pedidos` separada.

## Regla de negocio confirmada por el usuario (2026-07-14)

**Asignación de mesa → mesero:** no es fija ni exclusiva. Los meseros atienden las mesas según vayan llegando y según quién esté libre en ese momento. Por lo tanto **una misma mesa puede ser atendida por varios meseros distintos a lo largo del día** (diferentes horas, diferentes clientes/turnos en esa mesa). Consecuencia directa para el modelo de datos: el mesero se registra **por pedido/venta individual**, nunca como "dueño" fijo de una mesa.

**Cálculo de la bonificación — reparto escalonado por ranking de ventas (regla completa, cerrada 2026-07-14):** es un **bono grupal 100% configurable por el administrador, quincena a quincena** — ni el monto total ni los porcentajes están fijos en el sistema:

- **Periodo de corte: quincenal.**
- **Monto total del bono:** varía según las ventas de la quincena. **Piso mínimo: $500.000 COP** (nunca menos). Puede subir por encima de ese piso según el desempeño de ventas del periodo, y sube especialmente en **festividades o eventos especiales**.
- **Porcentajes por posición del ranking (top 1, top 2, ...):** tampoco son fijos — cambian según las ventas de cada quincena (el administrador los ajusta cada periodo, no hay un 20%/15% hardcodeado; esos números eran solo ejemplo).
- **Ranking:** se ordena a los meseros por ventas totales de la quincena. Las posiciones premiadas (top N) reciben el porcentaje que el administrador les asigne ese periodo.
- **"El resto" del bono** (lo que queda después del top N): se reparte entre los demás meseros **proporcional a la venta individual de cada uno** (no en partes iguales).
- **Empate en ventas para una posición del ranking:** los meseros empatados se reparten **el mismo porcentaje** de esa posición (en partes iguales entre ellos).

En resumen, el sistema necesita un **panel de configuración de bonificación por quincena** donde el administrador ingrese, cada periodo: el monto total del bono, cuántas posiciones del ranking llevan porcentaje fijo, y qué porcentaje le da a cada una — el sistema calcula el ranking, aplica esos porcentajes, reparte el remanente proporcional a ventas entre el resto, y resuelve empates repartiendo en partes iguales.

## Qué falta
- Registrar el mesero en cada pedido/venta individual (no por mesa) — la columna `Mesero` va en la hoja `Ventas` (fusión de pedido y venta, ver decisión en `00-PLAN-MAESTRO.md`) a nivel de fila de venta, no en un catálogo de "mesa asignada".
- Construir la **pantalla de configuración de bonificación**, editable por el administrador cada quincena: monto total del bono (con piso de $500.000), número de posiciones premiadas del ranking, y porcentaje de cada una.
- Lógica de cálculo quincenal: sumar ventas por mesero en la quincena → ordenar (ranking, con regla de empate a partes iguales) → aplicar los porcentajes configurados a las posiciones premiadas → repartir el remanente entre el resto proporcional a su venta individual.
- Vista/reporte de comisiones por mesero y por quincena (incluyendo el ranking final), que se apoya en el Panel administrativo (Módulo 7).
- Hoja nueva sugerida: `Meseros` (catálogo de meseros activos) y `Comisiones` o `Configuracion_Bonificacion` (quincena, monto total del periodo, tabla de porcentajes por posición, ranking calculado, reparto final por mesero) — separada de `Ventas` para no mezclar la configuración con el detalle transaccional.

## Dependencias
- Depende de que el Módulo 2 (Pedidos desde la mesa) capture el mesero en cada pedido individual, no una sola vez por mesa.
- Depende del Módulo 4 (División de cuenta) si la venta se cierra dividida — el valor de venta atribuido a cada mesero debe calcularse sobre lo que efectivamente facturó, no sobre el total de la mesa si varias personas pagaron por separado.
- Alimenta al Módulo 7 (Panel administrativo): reporte de comisiones y el panel de configuración de bonificación son vistas del dashboard administrativo.

## Dónde entra en el orden de fases
Se recomienda construirlo junto con el **Módulo 2** (mismo momento de captura de datos: mesero por pedido) pero su reporte/reparto de comisiones se activa cuando el **Módulo 7** ya esté en marcha. Ver `00-PLAN-MAESTRO.md` para el orden actualizado.

## Preguntas resueltas (2026-07-14)
Todas las preguntas abiertas sobre la regla de bonificación quedaron cerradas:
1. Monto del bono: variable, piso $500.000, sube según ventas de la quincena y en festividades/eventos.
2. Porcentajes por posición: variables, los define el administrador cada quincena.
3. Reparto del remanente ("el resto"): proporcional a la venta individual de cada mesero.
4. Empate en el ranking: se reparte en partes iguales entre los meseros empatados.

## Pregunta abierta para el usuario
- ¿Quién y dónde actualiza estos valores cada quincena — directamente en el Panel administrativo (Módulo 7), o en la hoja de Google Sheets `Configuracion_Bonificacion`? (probablemente ambas, con el panel escribiendo a la hoja — a confirmar cuando se diseñe el Módulo 7 a detalle).
