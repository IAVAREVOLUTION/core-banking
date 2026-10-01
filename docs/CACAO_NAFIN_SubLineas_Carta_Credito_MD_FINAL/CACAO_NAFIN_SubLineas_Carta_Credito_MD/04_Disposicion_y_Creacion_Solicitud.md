# 04 — Disposición desde Línea Global y creación de Solicitud

## Objetivo
Reutilizar `Banca 2º Piso → Línea Global → Disposiciones → + Nuevo`.

## Producto
El combo Producto debe mostrar exclusivamente productos configurados en:
`Taller de Producto → Línea Global → Productos Disposición`

Para esta solución:
- SubLínea Carta de Crédito Automática
- SubLínea Carta de Crédito Selectiva

## Campos existentes a reutilizar
- Fecha Solicitud
- Producto
- Cliente
- Tipo Persona
- Monto Solicitado
- Línea / Sublínea
- Descripción

## Reglas
### Cliente
Debe heredarse de la Línea Global y no ser editable.

### Monto Solicitado
Para Carta de Crédito:
`MontoSolicitado = Monto total de la Carta`

No usar el Monto Garantizado en esta etapa.

### Saldo / Disponible
Mostrar el Disponible actual de la Línea Global como consulta.

### Guardar
Al guardar:
1. validar que Línea Global esté activa;
2. validar que Producto sea un Producto Disposición permitido;
3. crear Disposición;
4. crear Solicitud asociada;
5. registrar en Historial de Disposiciones;
6. redirigir/permitir continuar desde Originación.

## No consumir disponible
La creación de la Solicitud NO debe disminuir el Disponible de la Línea Global.

El consumo ocurre únicamente al activar la SubLínea.
