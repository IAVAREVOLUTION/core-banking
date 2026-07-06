# Contexto General — Sistema de Banca Productos eFinanciaN@t
**Desarrollado por:** IAVA Revolution  
**Plataforma:** eFinanciaN@t  
**Fecha:** Junio 2026

---

## Descripción General

eFinanciaN@t es una plataforma integral de banca digital orientada a instituciones financieras, cooperativas, fondos de ahorro y organismos gubernamentales. Gestiona el ciclo completo de productos financieros: créditos, captación, inversiones, cobranza, cumplimiento normativo y administración institucional. Incorpora Inteligencia Artificial en los flujos de validación documental y fases de productos.

---

## Módulos del Sistema

### 1. Configuración (Administración y Seguridad)
Gestiona la estructura organizacional completa: parámetros generales, institución, sucursales, estructura organizacional (instituciones financieras, puestos de trabajo, empleados), catálogos, reportes regulatorios y catálogos contables. Define jerarquías, roles y accesos por puesto.

### 2. Productos
Administra los productos financieros de la institución en cuatro categorías:
- **Productos Crédito** — configuración de líneas de crédito, sublíneas y productos específicos
- **Productos Captación** — productos de ahorro e inversión con tasas, plazos, fases con Prompt IA
- **Productos Línea de Crédito** — matriz de tasas fija/variable, comisiones, jerarquías, periodicidad
- **Productos Seguros** — seguros vinculados a productos financieros

### 3. Garantías (Custodio y Garantías)
Registro y control centralizado de garantías vinculadas a créditos: inmuebles, muebles, automóviles, pagarés, avales. Incluye tipo, subtipo, valor nominal, monto a cubrir, % de aforo, ubicación y estatus.

### 4. Prospectos
Gestión de candidatos a clientes: dashboard, lista, formulario y seguimiento de contactos previos a la apertura formal.

### 5. Clientes — Visión 360° del Partícipe
Expediente digital completo del cliente con las siguientes pestañas:
- Datos generales, personas relacionadas, direcciones
- Expedientes electrónicos, SIC, Listas Negras
- KYC, Garantías, Perfil Transaccional
- Cotizaciones, Cuentas de Ahorro, Solicitudes de Crédito
- Créditos, Inversiones, Movimientos, Avisos
- Auditoría, Convenios, Cobranza

Incluye estatus SIC, lista negra, tarjeta de débito, cuenta eje, institución de gobierno vinculada.

### 6. Cotizaciones
Generación de cotizaciones de crédito y captación para prospectos y clientes antes de formalizar una solicitud.

### 7. Cuentas Ahorro
Gestión de cuentas de ahorro/captación: dashboard, expedientes electrónicos, movimientos, selector de cliente y producto.

### 8. Solicitudes de Crédito
Flujo completo de solicitud con pestañas: fases, partes relacionadas, términos y condiciones, simulación, comisiones, expedientes electrónicos, garantías, autorización, notas, cargos. Dashboard con KPIs y lista filtrable.

### 9. Sol. Activación
Módulo de solicitudes de activación de cuentas, previo a la originación.

### 10. Originación
Flujo de trabajo para la originación de créditos: validación de fases, reglas de negocio y aprobación operativa.

### 11. Créditos (Cartera de Crédito)
Administración de la cartera crediticia activa:
- **Dashboard** — KPIs: total créditos, activos, pendientes, monto autorizado. Gráficas por estatus y producto
- **Lista** — búsqueda, filtros por estatus, exportación CSV/Excel/PDF
- **Detalle** — pestañas: Default, Montos/Plazos, Tasas, Amortizaciones, Expedientes Electrónicos, Autorización, Garantías, Cargos, Avisos, Sol. Extraordinarias
- **Scoring Crediticio** — score Buró de Crédito, factores de calificación, capacidad de pago
- **Garantías** — registro de garantías reales y personales vinculadas al crédito

Tipos de crédito soportados: Hipotecario, Quirografario, Personal, Empleado, Agronegocios, Factoraje, entre otros.

### 12. Inversiones
Gestión de productos de inversión/captación: dashboard, lista, formulario, bloqueos, documentos de valor, movimientos y solicitudes extraordinarias.

### 13. PLD (Prevención al Lavado de Dinero)
Módulo de cumplimiento normativo con:
- KYC (Conocimiento del Cliente)
- Perfil Transaccional
- Calificación de Riesgo
- Alertas Internas y Alertas PLD
- Parámetros y Catálogos
- Reportes CNBV
- Dashboard de cumplimiento

### 14. Pagos Referenciados
Recibe información del core bancario e identifica automáticamente el destino del pago (crédito, cuenta de aportación o cliente) mediante la referencia única de cada transacción. Elimina asignación manual.

### 15. Casos de Cobranza
Registro y seguimiento de casos abiertos por área legal en proceso extrajudicial o judicial.

### 16. Cobranza (Ciclo Completo)
Tres etapas escalonadas de recuperación:
- **Preventiva** — avisos anticipados de aportaciones y amortizaciones por calendario
- **Extrajudicial** — cartera >120 días, turno al área legal interna
- **Judicial** — cartera >180 días con negativa de pago, turno a despacho legal externo ante juzgado

### 17. Avisos de Vencimiento
Gestión de avisos generados para créditos y cuentas de captación: consulta por documento, cliente, referencia, institución de gobierno, monto, fecha compromiso y estatus. Exportación CSV.

### 18. Recaudaciones
Generación automática de avisos de aportación y vencimiento para partícipes. Produce y exporta archivo **CSV** que se envía al Ministerio de Educación de Ecuador, quien lo remite al Ministerio de Finanzas para ejecutar el descuento con base en la fecha de vencimiento.

### 19. Cartera Crédito / Cartera Inversión / Cartera Ahorro
Vistas de cartera por tipo de producto para seguimiento y gestión operativa de cada segmento.

### 20. Reportes Regulatorios
Generación de reportes para organismos reguladores (CNBV, CONDUSEF, etc.).

### 21. Pólizas Contables
Generación automática de pólizas contables asociadas a operaciones del sistema.

### 22. Gestión de Riesgos
Dashboard en tiempo real con indicadores: MDR (Morosidad), Cobertura Cartera Vencida, CAP (Capitalización), LCR (Liquidez), Concentración Hipotecaria, Razón de Apalancamiento. Alertas clasificadas por nivel: Alto, Medio, Bajo. Integración API externa.

### 23. UNE (Unidad Especializada — Quejas y Reclamos)
Gestión del ciclo completo de consultas, quejas y reclamaciones (CONDUSEF): registro vinculado al expediente del cliente, clasificación, seguimiento por fases con plazos legales, resolución y reportes regulatorios.

### 24. Gestión Documental (Expedientes Electrónicos)
Módulo transversal integrado en clientes, solicitudes, créditos e inversiones. Usa **Inteligencia Artificial** para validar automáticamente documentos: autenticidad, vigencia, legibilidad y conformidad por tipo de documento. Emite resultado en tiempo real por fase.

---

## Portal Web — eFinanciaN@t (Canal Digital)
Aplicación web para autoservicio del partícipe:
- Panel con total en ahorros, deuda activa, rendimiento de inversiones
- Accesos rápidos: Cuentas, Créditos, Solicitudes, Inversiones, Documentos
- Notificaciones financieras en tiempo real
- Cotizaciones y transferencias en línea
- Disponible 24/7

---

## Inteligencia Artificial en el Sistema
La IA se incorpora en dos áreas principales:
1. **Validación Documental** — análisis automático de documentos en expedientes electrónicos: verifica autenticidad, vigencia y completitud por fase y tipo de documento
2. **Fases de Productos** — cada fase de un producto (captación, crédito) tiene un **Prompt IA configurable** que guía y valida el proceso de forma automática por área responsable (Integración, Jurídico, Liberación, etc.)

---

## Módulos Especiales por País/Cliente

| Módulo | Detalle |
|---|---|
| Recaudaciones | Flujo CSV → Ministerio Educación → Ministerio Finanzas (Ecuador) |
| Cobranza Judicial | Integración con despachos legales externos |
| Reportes CNBV | Cumplimiento regulatorio México |
| UNE/CONDUSEF | Atención al usuario financiero México |
| Scoring Crediticio | Buró de Crédito México |

---

## Stack Tecnológico (visible desde código)
- **Frontend:** React + TypeScript
- **Estado:** Zustand (stores por módulo)
- **Backend/DB:** Supabase
- **Funciones serverless:** Supabase Edge Functions
- **Estilos:** Tailwind CSS

---

## Usuarios del Sistema
- Administradores de sistema
- Analistas de crédito (tradicional, agronegocios)
- Analistas de cumplimiento / Oficiales PLD
- Área legal / Cobranza
- Cajeros / Operativos
- Gerentes y Directores (aprobadores)
- Partícipes (portal web)
