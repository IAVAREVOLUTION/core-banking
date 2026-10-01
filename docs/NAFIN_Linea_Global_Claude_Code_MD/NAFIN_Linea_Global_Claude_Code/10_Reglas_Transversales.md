# Reglas Transversales — Línea Global NAFIN

## 1. Identificación del producto
Antes de modificar código, identificar entidad Producto, campo/entidad que alimenta `Tipo` en Taller de Producto, Clave o Id estable y relaciones hacia Solicitud y Línea.

No usar comparaciones literales distribuidas por el código. Centralizar en una función equivalente a `EsLineaGlobalNafinCartaCredito(producto)`.

## 2. No regresión
El producto actual `Garantía Financiera 2º Piso` BANOBRAS debe mantener pantallas, reglas, requisitos, prompts IA, cargos, autorizaciones, liberación e históricos.

## 3. Fases
Reutilizar el motor actual de requisitos, pantallas obligatorias, autorización y auditoría.

## 4. Cargos
Al autorizar una fase:
1. validar requisitos;
2. validar pantallas;
3. autorizar;
4. consultar cargos en Taller de Producto;
5. crear cargos en Solicitud de Línea.

No duplicar el motor.

## 5. Requisitos
No hardcodear documentos o requisitos. Resolver `Producto → Fase → Requisitos configurados`.

## 6. UI condicional
Los campos NAFIN se muestran y validan sólo cuando aplica el producto; no deben afectar otros productos.

## 7. Componentes
Preferir `Componente Base + Configuración por Producto` sobre duplicar pantallas completas.

## 8. Auditoría
Mantener usuario, fecha/hora, fase, estatus anterior/nuevo, observaciones y resultado de validaciones.

## 9. Migración
No modificar registros históricos.

## 10. Criterios generales de aceptación
- BANOBRAS funciona igual antes y después.
- NAFIN muestra sus campos y reglas.
- Requisitos y cargos se resuelven por configuración.
- Liberación NAFIN crea Línea Global activa.
- No se crean entidades o servicios paralelos innecesarios.
