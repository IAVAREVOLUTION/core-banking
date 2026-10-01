# 10 — Pago de Garantía, Recuperación y Cierre

## Pago de Garantía
Cuando una Reclamación sea PROCEDENTE registrar:
- Monto Reclamado
- Monto Procedente
- Monto Pagado
- Fecha Pago

## Flujo financiero
`NAFIN → Intermediario Financiero`

No pagar directamente al Beneficiario comercial de la Carta.

## Cuentas Beneficiarias
Reutilizar:
`Persona/Cliente → Cuentas Bancarias`
y
`Originación/Operación → Cuentas Beneficiarias`

Usarlas únicamente cuando exista flujo real de efectivo, como Pago de Garantía.

No usarlas para Activación de SubLínea.

## Recuperación
Después de pagar:
`PAGADA → EN_RECUPERACION`

Registrar:
- Fecha Recuperación
- Monto Recuperado
- Origen
- Monto correspondiente NAFIN
- Monto correspondiente IF
- Saldo pendiente

La regla de distribución debe ser parametrizable.
No asumir 50/50.

## Cierre
Registrar:
- Monto Garantizado
- Monto Reclamado
- Monto Pagado
- Monto Recuperado
- Monto Castigado
- Saldo Pendiente

Si ya no existe saldo pendiente:
`Estatus = CERRADA`

## Pérdida
No crear automáticamente una CxC contra el Intermediario por una garantía legítimamente pagada y no recuperada.
