# Fase 1 — Promoción e Integración de Expediente

## Pantallas a reutilizar
1. Términos y Condiciones
2. Estructura Operativa 2º Piso
3. Expediente Electrónico

## 1. Términos y Condiciones
Campos:
- Monto Solicitado
- Moneda
- Plazo
- Fecha Inicio
- Fecha Vencimiento
- Tipo de Línea = Revolvente / No Revolvente
- Modalidad = Automática / Selectiva
- Destino = Carta de Crédito
- Cobertura Máxima %
- Monto Máximo por Sublínea
- Permite Carta Comercial = Sí / No
- Permite Standby = Sí / No
- Permite Sobregiro = Sí / No

Regla inicial: `PermiteSobregiro = NO`.

## 2. Estructura Operativa de la Línea Global
Reutilizar la pantalla actual `Estructura Operativa 2º Piso` y cambiar su presentación sólo para NAFIN.

### Bloque A — Intermediario
- Intermediario Financiero
- No. Intermediario NAFIN
- Tipo de Intermediario
- Programa
- Modalidad

### Bloque B — Estructura de Línea
- Monto Solicitado
- Monto Máximo por Sublínea
- Cobertura Máxima
- Revolvente
- Sobregiro

### Bloque C — Operaciones permitidas
- Carta de Crédito Comercial
- Carta de Crédito Standby

### No capturar en esta fase
- Beneficiario de Carta
- Número de Carta
- Monto específico de Carta
- Reclamación
- Recuperación

## 3. Expediente Electrónico
Reutilizar el motor actual de requisitos. El catálogo debe provenir de Taller de Producto. No hardcodear documentos.

Ejemplos configurables:
- Solicitud de Línea Global
- Constancia / validación de incorporación del IF
- Acta Constitutiva
- Poderes de Representantes
- Estados Financieros Dictaminados
- Estados Financieros recientes
- Calificación de Riesgo
- Información de Cartera
- Políticas de Crédito
- Información de Capitalización

## Autorización de Fase
Antes de autorizar validar requisitos y pantallas obligatorias. Si todo está completo, autorizar Fase 1 y ejecutar la generación automática de cargos existente.
