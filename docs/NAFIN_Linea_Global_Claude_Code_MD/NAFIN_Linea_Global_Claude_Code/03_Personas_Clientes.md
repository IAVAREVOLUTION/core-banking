# Módulo Personas / Clientes — Ajustes Línea Global NAFIN

## Objetivo
Clasificar al Cliente como Intermediario Financiero y mantener su expediente institucional.

## Pantallas existentes a conservar
- Header Persona / Cliente
- Personas Relacionadas

## Campos a agregar o habilitar
- Clasificación = Intermediario Financiero
- Tipo de Intermediario
- No. Intermediario NAFIN
- Estatus NAFIN
- Fecha de Incorporación NAFIN

## Regla
La información del Intermediario debe poder ser consultada desde la Solicitud de Línea Global sin duplicar el maestro de Persona/Cliente.

## Criterios de aceptación
- La Solicitud obtiene el Intermediario desde Persona/Cliente.
- No se crea una entidad paralela de cliente exclusivamente para NAFIN.
