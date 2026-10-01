# Liberación / Activación de Línea Global NAFIN

## Objetivo
Reutilizar el proceso actual de Liberación de Línea 2º Piso para crear la Línea Global operativa.

## Datos al liberar
- No. Línea
- Producto
- Intermediario Financiero
- Monto Autorizado
- Monto Utilizado = 0
- Monto Contingente = 0
- Monto Disponible = Monto Autorizado
- Monto Reclamado = 0
- Monto Pagado = 0
- Moneda
- Modalidad
- Revolvente
- Fecha Inicio
- Fecha Vencimiento
- Estatus = ACTIVA

## Regla inicial
`MontoDisponible = MontoAutorizado`

## Preparación para Sublíneas
La Línea debe quedar preparada para relacionar posteriormente Sublíneas CC-001, CC-002, CC-003, etc. Cada futura Sublínea consumirá el disponible por su `MontoGarantizado`.

## Fuera de alcance
No implementar todavía creación de Sublínea, consumo de disponible, reclamos, pagos de garantía ni recuperaciones.

## Criterios de aceptación
- La liberación crea una Línea Global activa.
- El disponible inicial es igual al autorizado.
- No se afecta el proceso de liberación BANOBRAS.
