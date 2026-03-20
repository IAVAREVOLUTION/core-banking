Introducción
El sistema debe permitir la creación de Solicitudes de Cuentas Financieras (Crédito, Captación y Líneas de Crédito) desde dos orígenes dentro del CORE:

Desde una Cotización existente.

Desde el módulo Solicitudes.

El objetivo es evitar recaptura de información y continuar el proceso de originación con datos consistentes.

1. Creación de Solicitudes desde una Cotización (CORE)
El módulo de Cotizaciones debe permitir generar una Solicitud mediante un botón “Crear Solicitud” ubicado en:

El detalle de la Cotización.

La lista de Cotizaciones recientes (si aplica).

Regla R1
El botón “Crear Solicitud” debe estar:

Deshabilitado cuando la Cotización tenga estatus “Aceptada”.

Habilitado en cualquier otro estatus.

2. Creación de Solicitudes desde el módulo Solicitudes (CORE)
El usuario puede crear una Solicitud directamente desde el módulo Solicitudes, sin depender de una Cotización previa.

3. Reglas de Negocio — Mapeo Cotización → Solicitud
Cuando la Solicitud se origine desde una Cotización:

El sistema debe mapear automáticamente todos los campos de la entidad COTIZACIONES hacia la entidad SOLICITUDES.

La Solicitud debe quedar prellenada con la información de la Cotización.

El usuario no debe recapturar información ya existente.

La vista de Solicitudes debe ser idéntica al diseño del CORE Bancario, con:

Header siempre visible.

Secciones en acordeón desplegable.

Estructura, nombres y comportamiento homologados.

4. Mapeo obligatorio de campos (HEADER)
(Aquí mantengo exactamente tu lista, sin modificar nada, solo ordenada y limpia)

SOLICITUD.ID = Automático (PK)

SOLICITUD.NO_SOL = Automático con formato:
BAN-DIGITAL-AAAAMMDD-999999

SOLICITUD.COTIZACION_ID = COTIZACION.COTIZACION_ID

SOLICITUD.LINEA_PRODUCTO = COTIZACION.LINEA_PRODUCTO

SOLICITUD.TIPO_PRODUCTO = COTIZACION.TIPO_PRODUCTO

SOLICITUD.TIPO_PERSONA = COTIZACION.TIPO_PERSONA

SOLICITUD.NOMBRE_PERSONA = COTIZACION.NOMBRE_PERSONA

SOLICITUD.APELLIDO_PATERNO_PERSONA = COTIZACION.APELLIDO_PATERNO_PERSONA

SOLICITUD.APELLIDO_MATERNO_PERSONA = COTIZACION.APELLIDO_MATERNO_PERSONA

SOLICITUD.PRODUCTO_ID = COTIZACION.PRODUCTO_ID

SOLICITUD.NOMBRE_PRODUCTO = COTIZACION.NOMBRE_PRODUCTO

SOLICITUD.FECHA_SOLICITUD = TODAY() (formato del sistema)

SOLICITUD.DESCRIPCION = Textarea (1024 caracteres)

SOLICITUD.FASE_ID = mínimo FASE_ID del subtab Requisitos del producto

SOLICITUD.DESCRIPCION_FASE = descripción de la fase correspondiente

COTIZACION.ESTATUS = “Aceptada”

5. Acordeón “Términos y Condiciones”
Debe mapear dinámicamente los datos necesarios para simular según el tipo de producto:

Crédito

Captación

Línea de Crédito

Incluye campos como:

Monto solicitado

Fecha primer pago

Fecha primera aportación

Plazo

Frecuencia

Tasa

Etc.

6. Acordeón “Simulación”
Debe mostrar:

Tabla de pagos (Crédito)

Tabla de aportaciones (Captación)

Tabla de amortización (Línea de Crédito)

Según SOLICITUD.TIPO_PRODUCTO.

7. Acordeón “Expediente Electrónico”
Pantalla dividida en dos secciones:

Sección 1
Lista de requisitos del subtab Producto → Requisitos.

Sección 2
Carga de documentos con los campos:

Fecha

Usuario

Tipo de documento

Archivo adjunto

Tipo (PDF, DOC, XLSX, PNG)

Nota

Área

Fase

Reglas de negocio
Regla 1 — Validación por IA  
El archivo debe coincidir con el tipo esperado según PROMPT_IA.

Regla 2 — Validar Requisitos / Enviar Solicitud  
Todos los documentos requeridos para la fase actual deben estar cargados y validados.

8. Acordeón “Garantías”
Agregar/eliminar garantías del cliente.

Deben provenir de Cliente → Garantías.

El monto total debe cubrir el monto calculado en Términos y Condiciones.

9. Acordeón “Comisiones”
Calcular automáticamente las comisiones según Producto → Comisiones.

10. Acordeón “Autorizaciones”
Mostrar usuarios del puesto/rol requerido según:

Producto → Autorización

SOLICITUD.PRODUCTO_ID

SOLICITUD.MONTO_SOLICITADO

Los usuarios se obtienen de Configuración → Puestos de Trabajo.

11. Acordeón “Notas”
Crear y eliminar notas.

Campos: Fecha, Usuario, Puesto, Nota, Archivo adjunto.