# 07 — Flujo END TO END: SubLínea Carta de Crédito Selectiva

## Flujo
Línea Global Activa
→ Disposiciones
→ + Nuevo
→ seleccionar Producto Selectivo
→ crear Solicitud
→ Originación F1-F5
→ Activación

# Fase 1 — Integración de Expediente
## Pantallas obligatorias
- Términos y Condiciones
- Partes Relacionadas

## Requisitos
1. Solicitud / Información Carta de Crédito
2. Información Acreditado Final

# Fase 2 — Evaluación
Evaluar:
- Acreditado Final
- operación
- monto
- exposición
- riesgo

## Datos mínimos
- Monto Carta
- Monto Elegible
- Cobertura Solicitada
- Monto Garantizado Solicitado
- Exposición actual Acreditado
- Nivel de Riesgo

## Resultado
- Monto Solicitado
- Monto Recomendado
- Cobertura Solicitada
- Cobertura Recomendada
- Monto Garantizado Recomendado
- Dictamen

## Requisitos
1. Información Financiera del Acreditado Final
2. Dictamen de Riesgo

# Fase 3 — Aprobación
Reutilizar Votación y Resolución Final.

## Requisitos
1. Resolución de Autorización
2. Condiciones Autorizadas

## Resolución mínima
- Monto Carta Autorizado
- Cobertura Autorizada
- Monto Garantizado
- Vigencia
- Condiciones
- Resultado

# Fase 4 — Instrumentación
## Requisitos
1. Carta de Crédito Definitiva
2. Documento / Convenio de Formalización

## Datos definitivos
- No. Carta
- Fecha emisión
- Fecha vencimiento
- Monto
- Beneficiario

Resultado:
`LISTA PARA ACTIVACIÓN`

# Fase 5 — Activación
No reevaluar crédito.

## Requisitos
1. Condiciones precedentes cumplidas
2. Disponible suficiente en Línea Global

Al autorizar:
ejecutar servicio común `ActivarSublinea()`.

## Cargos
Reutilizar la lógica existente por fase.
