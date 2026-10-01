# Módulo Prospectos — Ajustes Línea Global NAFIN

## Objetivo
Reutilizar el módulo actual de Prospectos y habilitar atributos mínimos para identificar que el prospecto es un Intermediario Financiero elegible para Línea Global NAFIN.

## Pantallas existentes a conservar
- Datos Complementarios
- Consulta Buró de Crédito
- Verificación PLD / Listas de Negocio

## Ajustes
Agregar o habilitar en Datos Complementarios:
- Tipo de Cliente = Intermediario Financiero
- Tipo de Intermediario: Banco / SOFOM / SOFIPO / Unión de Crédito / Otro
- No. Intermediario NAFIN
- Estatus Intermediario NAFIN: Vigente / Suspendido / En incorporación
- Fecha de Incorporación NAFIN

## Regla funcional
Para poder generar una Solicitud de Línea Global:
`EstatusIntermediarioNAFIN = VIGENTE`

## Mensaje de bloqueo
> No es posible solicitar una Línea Global. El Intermediario Financiero no se encuentra vigente en NAFIN.

## Criterios de aceptación
- Un prospecto NAFIN con estatus Vigente puede continuar.
- Un prospecto NAFIN con estatus diferente a Vigente no puede generar la solicitud.
- Un prospecto de otro producto conserva el comportamiento actual.
