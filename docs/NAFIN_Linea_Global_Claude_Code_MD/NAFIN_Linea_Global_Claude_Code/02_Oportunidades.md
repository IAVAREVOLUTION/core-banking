# Módulo Oportunidades — Ajustes Línea Global NAFIN

## Objetivo
Reutilizar Oportunidades para registrar la intención comercial de otorgar una Línea Global al Intermediario Financiero.

## Pantallas existentes a conservar
- Default
- Archivos Adjuntos
- Cierre Comercial
- Solicitudes

## Datos NAFIN
Cuando el producto corresponda a Línea Global NAFIN mostrar:
- Producto = Línea Global de Garantías NAFIN
- Programa = Garantía para Carta de Crédito
- Monto estimado
- Moneda
- Modalidad = Automática / Selectiva
- Operaciones elegibles = Carta de Crédito Comercial / Carta de Crédito Standby

## Regla
Al generar la Solicitud, trasladar los datos comerciales aplicables al encabezado de la Solicitud de Línea.

## Criterios de aceptación
- La oportunidad NAFIN permite seleccionar modalidad y tipos de Carta de Crédito.
- La Solicitud hereda los datos configurados.
- Otros productos conservan su layout y reglas actuales.
