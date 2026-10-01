# 09 — Vencimiento, Liberación y Reclamación

## Vencimiento sin Reclamo
Si la SubLínea vence sin reclamación:
`ACTIVA → LIBERADA`

Restituir:
`DisponibleLineaGlobal += SaldoGarantizadoLiberable`

No exceder el Monto Autorizado de la Línea Global.

## Reclamación
Agregar capacidad/subpestaña operativa `Reclamaciones` sobre la SubLínea activa.

## Campos mínimos
- No. Reclamación
- Fecha
- Monto Incumplido
- Saldo Elegible
- % Cobertura
- Monto Reclamado
- Monto Máximo Reclamable
- Estatus
- Documentación

## Fórmula
`MontoMaximoReclamable = MIN(SaldoElegible × %Cobertura, SaldoGarantizado)`

## Estados
`ACTIVA → RECLAMADA → EN_ANALISIS`

Resultado:
- RECHAZADA
- PROCEDENTE

## Regla
Una reclamación sólo puede registrarse sobre una SubLínea vigente/elegible conforme a las reglas configuradas.
