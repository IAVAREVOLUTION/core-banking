# 06 — Flujo END TO END: SubLínea Carta de Crédito Automática

## Flujo
Línea Global Activa
→ Disposiciones
→ + Nuevo
→ seleccionar Producto Automático
→ crear Solicitud
→ Términos y Condiciones
→ Partes Relacionadas
→ ejecutar validaciones automáticas
→ Activar o Rechazar

## Reglas mínimas para demo
1. Línea Global ACTIVA
2. Producto relacionado como Producto Disposición
3. Monto dentro del máximo
4. Disponible suficiente
5. Cobertura permitida
6. Plazo permitido
7. Moneda permitida
8. Tipo Carta permitido
9. Ordenante registrado
10. Beneficiario Carta registrado

Los valores deben obtenerse del producto.

## Resultado de validación
Mostrar:
- reglas cumplidas,
- reglas incumplidas,
- mensaje de rechazo si aplica.

## Si cumple
Ejecutar servicio común `ActivarSublinea()`.

## Si no cumple
Estatus:
`RECHAZADA` o `NO ELEGIBLE PARA AUTOMÁTICA`

No convertir automáticamente a Selectiva.

## Cargos
Como no existen fases, usar el evento de Activación para invocar el servicio existente de generación de cargos configurados para el producto/evento.

No crear un motor paralelo de cargos.
