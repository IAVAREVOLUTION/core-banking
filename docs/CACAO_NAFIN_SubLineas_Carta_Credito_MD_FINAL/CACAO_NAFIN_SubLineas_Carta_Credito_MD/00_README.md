# CACAO Banking — SubLíneas de Carta de Crédito NAFIN
## Especificación final para Claude Code

## Objetivo
Implementar en CACAO Banking dos productos de disposición derivados de una Línea Global NAFIN previamente autorizada y activa:

1. **SubLínea Carta de Crédito Automática**
2. **SubLínea Carta de Crédito Selectiva**

La implementación debe reutilizar la arquitectura existente de CACAO:
- Taller de Producto
- Productos Disposición
- Banca 2º Piso
- Disposiciones
- Solicitudes / Originación
- Términos y Condiciones
- Partes Relacionadas
- Fases
- Requisitos
- Cargos
- Cuentas Bancarias
- Cuentas Beneficiarias
- Motor Contable
- Pólizas Contables

## Principio arquitectónico
No crear un mecanismo paralelo de SubLíneas.

La relación debe ser:

`Línea Global NAFIN → Productos Disposición → Disposición → Solicitud → Originación según producto → Activación → Contingente`

## Productos de disposición
La Línea Global NAFIN tendrá relacionados en `Taller de Producto → Productos Disposición`:

- SubLínea Carta de Crédito Automática
- SubLínea Carta de Crédito Selectiva

## Diferencia fundamental
- **Automática:** no tiene fases. Se autoriza por reglas automáticas configuradas en el producto.
- **Selectiva:** usa 5 fases de Originación:
  1. Integración de Expediente
  2. Evaluación
  3. Aprobación
  4. Instrumentación
  5. Activación

## Regla financiera principal
La Disposición se solicita por el **Monto de la Carta de Crédito**, pero la Línea Global se consume únicamente por el **Monto Garantizado NAFIN**.

`MontoGarantizado = MIN(MontoElegible × %Cobertura, MontoMaximoSublinea, DisponibleLineaGlobal)`

## Fuera de alcance de la configuración manual
Claude Code NO debe crear automáticamente los productos.
El usuario administrador los dará de alta y parametrizará en Taller de Producto después de implementar las capacidades requeridas.
