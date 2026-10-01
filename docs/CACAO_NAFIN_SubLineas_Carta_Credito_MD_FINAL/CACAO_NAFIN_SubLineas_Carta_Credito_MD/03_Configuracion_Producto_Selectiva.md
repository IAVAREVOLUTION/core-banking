# 03 — Configuración: SubLínea Carta de Crédito Selectiva

## Objetivo
Configurar un producto hijo de disposición que use Originación individual.

## Default
- Nombre: SubLínea Carta de Crédito Selectiva
- Tipo de Operación: Carta de Crédito
- Modalidad: Selectiva
- Naturaleza: Contingente
- Producto Padre Requerido: Sí
- Requiere Línea Global Activa: Sí
- Consume Disponible al Activar: Sí
- Permite Sobregiro: No

## Cobertura y Comisiones
Configurar:
- Monto mínimo/máximo
- Plazo mínimo/máximo
- Cobertura mínima/default/máxima
- Monedas permitidas
- Comisión mínima/default/máxima

## Fases
Configurar exactamente:
1. Integración de Expediente
2. Evaluación
3. Aprobación
4. Instrumentación
5. Activación

## Requisitos
Máximo 2 requisitos por fase para la demo:

### Fase 1 — Integración de Expediente
1. Solicitud / Información de Carta de Crédito
2. Información del Acreditado Final

### Fase 2 — Evaluación
1. Información Financiera del Acreditado Final
2. Dictamen de Riesgo

### Fase 3 — Aprobación
1. Resolución de Autorización
2. Condiciones Autorizadas

### Fase 4 — Instrumentación
1. Carta de Crédito Definitiva
2. Documento / Convenio de Formalización

### Fase 5 — Activación
1. Condiciones Precedentes Cumplidas
2. Disponible Suficiente en Línea Global

## Cargos
Usar el mecanismo actual:
`Autorizar Fase → consultar cargos configurados → generar cargos en Solicitud`.

## Motor Contable
Configurable por evento.
