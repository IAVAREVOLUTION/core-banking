# Fase 2 — Evaluación Financiera y de Riesgo

## Objetivo
Reutilizar la pantalla actual `Modelo y Viabilidad Financiera`, pero para Línea Global NAFIN cambiar su finalidad a evaluación financiera y de riesgo del Intermediario Financiero.

## Nombre visible NAFIN
`Evaluación Financiera y de Riesgo`

## Datos mínimos
- Capital Contable
- Cartera Total
- Cartera Vencida
- Índice de Morosidad
- Capitalización
- Liquidez
- Cobertura de Reservas
- ROE
- Exposición actual con NAFIN

## Dictamen
- Calificación
- Nivel de Riesgo
- Monto Solicitado
- Monto Recomendado
- Dictamen = Favorable / Favorable con Condiciones / No Favorable
- Observaciones
- Condiciones / Mitigantes

## Reglas
- No hardcodear parámetros financieros.
- Cuando exista configuración de parámetros en Taller de Producto, utilizarla.
- Las reglas BANOBRAS específicas de proyecto no deben aplicar al producto NAFIN.

## Lógica BANOBRAS que debe permanecer intacta
- DSCR
- Flujos de proyecto
- Viabilidad del proyecto
- Estructura fiduciaria específica

## Autorización de Fase
Reutilizar validación de requisitos, validación de pantalla, autorización y generación automática de cargos desde Taller de Producto.
