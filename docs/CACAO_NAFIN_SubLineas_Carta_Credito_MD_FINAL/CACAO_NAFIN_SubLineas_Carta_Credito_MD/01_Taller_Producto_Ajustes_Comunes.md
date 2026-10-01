# 01 — Taller de Producto: Ajustes comunes para SubLíneas de Carta de Crédito

## Objetivo
Asegurar que Taller de Producto pueda parametrizar ambos productos hijo sin hardcodear lógica específica.

## Reutilizar subpestañas existentes
- Default
- Cobertura y Comisiones 2º Piso
- Fases
- Requisitos
- Cargos Permitidos
- Motor Contable
- Productos Disposición

## Ajustes propuestos en Default
Agregar o habilitar, si no existen equivalentes:

- Naturaleza Financiera: `Contingente`
- Tipo de Operación: `Carta de Crédito`
- Tipo de Carta Permitida:
  - Comercial
  - Standby
  - Ambas
- Modalidad de Resolución:
  - Automática
  - Selectiva
- Producto Padre Requerido: Sí/No
- Requiere Línea Global Activa: Sí/No
- Consume Disponible al Activar: Sí/No
- Permite Sobregiro: Sí/No

### Valores recomendados para ambos productos
- Naturaleza Financiera = Contingente
- Producto Padre Requerido = Sí
- Requiere Línea Global Activa = Sí
- Consume Disponible al Activar = Sí
- Permite Sobregiro = No

## Ajustes propuestos en Cobertura y Comisiones 2º Piso
Reutilizar la pantalla existente y agregar, si aún no existen equivalentes:

- Monto mínimo de SubLínea
- Monto máximo de SubLínea
- Plazo mínimo
- Plazo máximo
- Cobertura mínima
- Cobertura default
- Cobertura máxima
- Monedas permitidas

No hardcodear porcentajes.

## Productos Disposición
La Línea Global debe relacionar recursivamente únicamente productos hijo previamente configurados.

Regla:
`ProductoSeleccionado ∈ LineaGlobal.ProductosDisposicion`

Si no:
> El producto seleccionado no se encuentra configurado como Producto de Disposición de la Línea Global.

## No crear
No crear una nueva subpestaña de Reglas de SubLínea salvo que Claude determine que los campos anteriores no pueden almacenarse limpiamente en la estructura existente.

Prioridad:
1. reutilizar campos existentes;
2. extender Default/Cobertura y Comisiones;
3. sólo en último caso crear nueva subpestaña.
