# 02 — Configuración: SubLínea Carta de Crédito Automática

## Objetivo
Configurar un producto hijo de disposición que se resuelva sin fases de Originación.

## Configuración esperada
### Default
- Nombre: SubLínea Carta de Crédito Automática
- Tipo de Operación: Carta de Crédito
- Modalidad: Automática
- Naturaleza: Contingente
- Producto Padre Requerido: Sí
- Requiere Línea Global Activa: Sí
- Consume Disponible al Activar: Sí
- Permite Sobregiro: No

### Cobertura y Comisiones
Configurar:
- Monto mínimo
- Monto máximo
- Plazo mínimo
- Plazo máximo
- Cobertura mínima
- Cobertura default
- Cobertura máxima
- Monedas permitidas
- Comisión mínima/default/máxima

### Fases
No configurar fases activas.

### Requisitos
Para la primera demo, los requisitos pueden resolverse por validaciones automáticas y Partes Relacionadas.
Si se configuran requisitos generales, no deben obligar a usar un workflow de fases.

### Cargos Permitidos
Configurables por producto.

### Motor Contable
Configurable por evento.

## Regla funcional
Al no existir fases, la Solicitud debe seguir existiendo por trazabilidad, pero la decisión se ejecuta mediante validación automática.

## Resultado
- Si cumple todas las reglas: `ACTIVA`
- Si no cumple: `RECHAZADA / NO ELEGIBLE PARA AUTOMÁTICA`

No convertir automáticamente a Selectiva.
