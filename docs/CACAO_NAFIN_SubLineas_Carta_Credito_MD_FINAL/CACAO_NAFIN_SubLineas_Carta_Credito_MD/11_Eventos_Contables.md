# 11 — Eventos Contables de SubLíneas

## Objetivo
Preparar los eventos contables para utilizar la arquitectura existente de CACAO.

## Fuente de cuentas
Siempre:
`Taller de Producto → Motor Contable`

No hardcodear cuentas.

## Destino
Generar y visualizar en:
`Pólizas Contables`

## Eventos
1. `ACTIVACION_SUBLINEA`
   - reconocer contingente

2. `LIBERACION_SUBLINEA`
   - cancelar/liberar contingente

3. `RECLAMACION_GARANTIA`
   - registrar evento de reclamación según política contable

4. `PAGO_GARANTIA`
   - registrar el pago real y la reclasificación correspondiente

5. `RECUPERACION_GARANTIA`
   - registrar recuperación

6. `CASTIGO_GARANTIA`
   - registrar pérdida/castigo cuando corresponda

## Nota
La definición exacta de pólizas, cuentas y naturaleza contable debe parametrizarse posteriormente en Motor Contable.
