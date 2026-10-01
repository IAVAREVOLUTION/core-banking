# 12 — Reglas Transversales y No Regresión

## 1. Reutilización
No duplicar:
- Producto Disposición
- Disposición
- Solicitud
- Originación
- Fases
- Requisitos
- Cargos
- Partes Relacionadas
- Cuentas Beneficiarias
- Motor Contable
- Pólizas Contables

## 2. Identificación por Producto
No hardcodear nombres visibles.

Resolver por:
- Id
- Clave
- relaciones reales del modelo

## 3. Producto controla workflow
- Producto Automático = sin fases
- Producto Selectivo = 5 fases

No usar un único producto con un switch manual de modalidad si la arquitectura ya permite dos productos hijo.

## 4. Línea Global
Toda SubLínea debe:
- pertenecer a una Línea Global activa;
- usar un Producto Disposición permitido;
- consumir únicamente al activarse;
- consumir por Monto Garantizado, no por Monto Carta.

## 5. Personas
Reutilizar:
`Personas Relacionadas → Partes Relacionadas`

## 6. Cuentas
Reutilizar:
`Cuentas Bancarias → Cuentas Beneficiarias`

Sólo para eventos con dispersión real.

## 7. Auditoría
Registrar:
- usuario
- fecha/hora
- solicitud
- línea global
- producto
- fase/evento
- estatus anterior
- estatus nuevo
- validaciones
- observaciones

## 8. Transaccionalidad
Activación, liberación, pago y recuperación deben proteger integridad de saldos con transacciones y rollback.

## 9. No Regresión
No afectar:
- Garantía Financiera 2º Piso BANOBRAS
- Línea Global NAFIN
- otros Productos Disposición existentes
- historiales previos
