# 08 — Activación, Contingente y afectación de Línea Global

## Objetivo
Implementar un único servicio común para Automática y Selectiva.

## Servicio conceptual
`ActivarSublinea()`

## Transacción
Ejecutar en una sola transacción:

1. Revalidar Línea Global = ACTIVA
2. Revalidar Producto permitido
3. Recalcular/validar Monto Garantizado
4. Revalidar Disponible actual
5. Validar no sobregiro
6. Crear/actualizar Monto Contingente
7. Disminuir Disponible de Línea Global
8. Cambiar SubLínea a ACTIVA
9. Generar cargos aplicables
10. Disparar evento contable aplicable

Si cualquier paso falla:
`ROLLBACK`

## Regla principal
`MontoGarantizado <= DisponibleLineaGlobalActual`

## Afectación
`MontoContingenteSublinea = MontoGarantizado`

`DisponibleLineaGlobalNuevo = DisponibleLineaGlobalActual - MontoGarantizado`

## Ejemplo
Línea Global:
- Autorizado = 400 MM
- Disponible = 300 MM

Carta:
- Monto Carta = 20 MM
- Cobertura = 50%
- Monto Garantizado = 10 MM

Después:
- Contingente vigente = +10 MM
- Disponible = 290 MM

## Historial de Disposiciones
Conservar columnas actuales y agregar, si el layout lo permite:
- % Cobertura
- Monto Garantizado

## Estados
Automática:
`BORRADOR → ACTIVA` o `BORRADOR → RECHAZADA`

Selectiva:
`BORRADOR → EN_ORIGINACION → AUTORIZADA → ACTIVA`
