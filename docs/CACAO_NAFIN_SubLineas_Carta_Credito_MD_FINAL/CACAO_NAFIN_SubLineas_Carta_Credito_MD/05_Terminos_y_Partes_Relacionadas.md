# 05 — Términos y Condiciones + Partes Relacionadas

## Objetivo
Usar las pantallas existentes como núcleo de captura para ambos productos.

# Términos y Condiciones

## Bloque A — Línea Global (consulta)
- No. Línea Global
- Intermediario Financiero
- Producto Línea Global
- Monto Autorizado
- Monto Disponible
- Fecha Inicio
- Fecha Vencimiento

## Bloque B — Carta de Crédito
- Tipo Carta: Comercial / Standby
- No. Carta / Referencia
- Monto Carta
- Moneda
- Fecha Inicio
- Fecha Vencimiento
- Objeto / Descripción

Nota:
En Selectiva, el No. Carta puede ser provisional hasta Instrumentación.

## Bloque C — Garantía NAFIN
- Monto Elegible
- % Cobertura
- Monto Garantizado
- Monto Contingente
- Comisión
- Modalidad (consulta, derivada del Producto)

## Fórmula
`MontoGarantizado = MIN(MontoElegible × PorcentajeCobertura, MontoMaximoSublinea, DisponibleLineaGlobal)`

## Validaciones comunes
- Línea Global = ACTIVA
- Producto permitido
- Monto dentro del rango
- Cobertura dentro del rango
- Plazo permitido
- Moneda permitida
- Tipo de Carta permitido
- Fecha Vencimiento SubLínea <= Fecha Vencimiento Línea Global, cuando así lo exija la configuración
- No sobregiro

# Partes Relacionadas

Reutilizar:
`Persona/Cliente → Personas Relacionadas → Originación → Partes Relacionadas`

## Roles sugeridos
- Ordenante / Acreditado Final
- Beneficiario Carta
- Representante Legal
- Obligado Solidario
- Aval
- Banco Confirmador
- Banco Avisador
- Otro

## Reglas demo
Debe existir como mínimo:
- 1 Ordenante / Acreditado Final
- 1 Beneficiario Carta

No crear una subpestaña adicional de Beneficiarios.
