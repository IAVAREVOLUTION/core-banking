# Fase 3 — Aprobación

## Pantallas a reutilizar
- Votación CPC
- Resolución Final CIC

No crear módulos nuevos.

## Parametrización recomendada
Evitar hardcodear los nombres CPC / CIC cuando sea posible. Manejar conceptualmente Instancia Evaluadora e Instancia Autorizadora desde configuración.

## Votación — datos NAFIN
- Intermediario
- Producto
- Monto Solicitado
- Monto Recomendado
- Modalidad
- Calificación
- Dictamen de Riesgo

Reutilizar miembros, votos, resultado y comentarios.

## Resolución Final — datos mínimos
- Monto Solicitado
- Monto Recomendado
- Monto Autorizado
- Moneda
- Fecha Inicio
- Fecha Vencimiento
- Vigencia
- Modalidad
- Cobertura Máxima
- Monto Máximo por Sublínea
- Revolvente
- Resolución
- Condiciones

## Autorización de Fase
Reutilizar el motor existente de validación, autorización y generación automática de cargos.
