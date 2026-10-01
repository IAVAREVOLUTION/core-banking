# CACAO Banking — Línea Global de Garantías NAFIN

## Objetivo
Configurar en CACAO Banking el producto **Línea Global de Garantías NAFIN** reutilizando el flujo existente de **Garantía Financiera 2º Piso BANOBRAS**, sin crear un workflow paralelo.

## Principio de diseño
- Mantener intacto el comportamiento actual de BANOBRAS.
- Aplicar los ajustes NAFIN únicamente cuando el producto configurado corresponda a **Línea Global de Garantías NAFIN / Carta de Crédito**.
- No hardcodear nombres visibles del producto; resolver el producto por su entidad, Id o Clave configurada en **Taller de Producto**.
- Reutilizar los motores existentes de fases, requisitos, validación de pantallas, cargos, autorización, liberación de línea y auditoría.

## Flujo END TO END
Prospecto → Oportunidad → Persona/Cliente → Solicitud → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Liberación de Línea.

## Archivos de especificación
1. `01_Prospectos.md`
2. `02_Oportunidades.md`
3. `03_Personas_Clientes.md`
4. `04_Solicitud_Linea_Global.md`
5. `05_Fase_1_Promocion_Integracion.md`
6. `06_Fase_2_Evaluacion.md`
7. `07_Fase_3_Aprobacion.md`
8. `08_Fase_4_Instrumentacion.md`
9. `09_Liberacion_Linea.md`
10. `10_Reglas_Transversales.md`

## Fuera de alcance
No implementar todavía las Sublíneas por Carta de Crédito ni la lógica de reclamación/recuperación. La Línea Global sólo deberá quedar preparada para relacionarlas posteriormente.
