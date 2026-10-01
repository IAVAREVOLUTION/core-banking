# Solicitud de Línea Global — Ajustes NAFIN

## Objetivo
Reutilizar la Solicitud de Línea existente como objeto maestro del proceso de Originación.

## Datos principales
- Intermediario Financiero
- Producto = Línea Global de Garantías NAFIN
- Tipo de Línea = Global
- Programa = Garantía Carta de Crédito
- Monto Solicitado
- Moneda
- Plazo
- Fecha Inicio
- Fecha Vencimiento
- Modalidad = Automática / Selectiva

## Subpestaña Cargos
Reutilizar la funcionalidad existente.

Al autorizar una fase:
1. Validar requisitos obligatorios.
2. Validar pantallas obligatorias.
3. Autorizar la fase.
4. Consultar en Taller de Producto los cargos configurados para Producto + Fase.
5. Si existen cargos, crearlos automáticamente en `Solicitud de Línea → Cargos`.

No crear un segundo motor de cargos.

## Regla de identificación del producto
No comparar contra el nombre visible en texto. Claude Code debe identificar la entidad de Producto, el campo que alimenta Tipo y una Clave o Id estable, centralizando la detección en una función reutilizable.

## Criterios de aceptación
- La Solicitud NAFIN usa el mismo motor de fases actual.
- La subpestaña Cargos funciona sin cambios estructurales.
- Las solicitudes BANOBRAS permanecen intactas.
