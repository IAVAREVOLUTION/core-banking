Introducción
El sistema debe permitir la creación de Solicitudes de Cuentas Financieras para los productos:

Crédito

Captación

Líneas de Crédito

Estas solicitudes pueden originarse:

A partir del módulo de Cotizaciones.

Directamente desde el módulo de Solicitudes.

El objetivo es evitar recaptura de información y permitir continuar el proceso de originación con datos consistentes.

1. Creación de Solicitudes a partir de una Cotización
1.1 Desde el WIZARD de Cotizaciones (Paso 3: “Cotización”)
En el último paso debe existir un botón/ícono “Crear Solicitud”.

Regla R1:  
El botón debe estar deshabilitado cuando la cotización tenga estatus “Aceptada”.
En cualquier otro estatus, debe estar habilitado.

1.2 Desde el detalle de una Cotización (Últimas 5 Cotizaciones)
Al entrar al detalle de una cotización ya creada, debe mostrarse el mismo botón “Crear Solicitud”.

Regla R1 (misma lógica):  
Deshabilitado si la cotización está Aceptada.
Habilitado en cualquier otro estatus.

1.3 Desde el módulo de Solicitudes
El usuario puede crear una solicitud directamente desde el módulo Solicitudes, sin depender de una cotización previa.

2. Reglas de Negocio
R1. Mapeo completo Cotización → Solicitud
Al crear una Solicitud desde una Cotización, el sistema debe mapear automáticamente todos los campos de la entidad COTIZACIONES hacia la entidad SOLICITUDES.

El objetivo es:

Evitar recaptura.

Mantener consistencia.

Permitir continuar el proceso de validación y originación.

La vista de Solicitudes debe ser idéntica al diseño del CORE Bancario, con:

Header siempre visible.

Secciones en acordeón desplegable.

Estructura, nombres y comportamiento homologados.

3. Mapeo obligatorio de campos
SECCIÓN HEADER (siempre visible)
SOLICITUD.ID = Automático (PK).

SOLICITUD.NO_SOL = Automático con formato:
BAN-DIGITAL-AAAAMMDD-999999

BAN-DIGITAL = canal

AAAAMMDD = fecha de creación

999999 = consecutivo diario

SOLICITUD.COTIZACION_ID = COTIZACION.COTIZACION_ID

SOLICITUD.LINEA_PRODUCTO = COTIZACION.LINEA_PRODUCTO

SOLICITUD.TIPO_PRODUCTO = COTIZACION.TIPO_PRODUCTO

SOLICITUD.TIPO_PERSONA = COTIZACION.TIPO_PERSONA

SOLICITUD.NOMBRE_PERSONA = COTIZACION.NOMBRE_PERSONA

SOLICITUD.APELLIDO_PATERNO_PERSONA = COTIZACION.APELLIDO_PATERNO_PERSONA

SOLICITUD.APELLIDO_MATERNO_PERSONA = COTIZACION.APELLIDO_MATERNO_PERSONA

SOLICITUD.PRODUCTO_ID = COTIZACION.PRODUCTO_ID

SOLICITUD.NOMBRE_PRODUCTO = COTIZACION.NOMBRE_PRODUCTO

SOLICITUD.FECHA_SOLICITUD = TODAY() con formato del sistema (preferencia DD/MM/AAAA HH:MM:SS)

SOLICITUD.DESCRIPCION = Textarea (1024 caracteres)

SOLICITUD.FASE_ID = Mínimo FASE_ID del subtab Requisitos del producto

SOLICITUD.DESCRIPCION_FASE = Descripción de la fase correspondiente

COTIZACION.ESTATUS = “Aceptada”

4. Acordeón “Términos y Condiciones”
Debe ser dinámico según SOLICITUD.TIPO_PRODUCTO.

Mapeo obligatorio:

Crédito → Datos para simular

Captación → Datos para simular

Línea de Crédito → Datos para simular

Debe incluir todos los campos modificables usados en la simulación de Cotizaciones, como:

Monto solicitado

Fecha primer pago

Fecha primera aportación

Plazo

Frecuencia

Tasa

Etc.

5. Acordeón “Simulación”
Debe mostrar:

Tabla de pagos (Crédito)

Tabla de aportaciones (Captación)

Tabla de amortización (Línea de Crédito)

Dependiendo del SOLICITUD.TIPO_PRODUCTO.

6. Acordeón “Expediente Electrónico”
La pantalla se divide en dos secciones:

Sección 1 — Lista de requisitos
Proviene del subtab Producto → Requisitos del producto seleccionado.

Sección 2 — Carga de documentos
Campos obligatorios:

Fecha (automática)

Usuario (automático)

Tipo de documento (solo de la lista de la Sección 1)

Archivo adjunto

Tipo (PDF, DOC, XLSX, PNG)

Nota (campo abierto)

Área (proviene del requisito)

Fase (proviene del requisito)

Reglas de negocio
Regla 1 — Validación por IA:  
El archivo adjunto debe coincidir con la descripción del campo PROMPT_IA del requisito (ej. INE, comprobante, etc.).

Regla 2 — Validar Requisitos / Enviar Solicitud:  
Todos los documentos requeridos para la FASE actual (SOLICITUD.FASE_ID) deben estar:

Cargados

Validados por IA

Antes de permitir avanzar a la siguiente fase.

7. Acordeón “Garantías”
Debe permitir:

Agregar garantías del cliente (tomadas de Cliente → Garantías)

Eliminar garantías

El monto total de garantías debe cubrir el monto calculado en Términos y Condiciones.

8. Acordeón “Comisiones”
Las comisiones deben calcularse automáticamente según:

SOLICITUD.PRODUCTO_ID

Configuración del subtab Producto → Comisiones

9. Acordeón “Autorizaciones”
Debe mostrar la lista de usuarios que pertenecen al Puesto/Rol requerido según:

Producto → Autorización

SOLICITUD.PRODUCTO_ID

SOLICITUD.MONTO_SOLICITADO

Los usuarios deben obtenerse de:

Configuración → Puestos de Trabajo

10. Acordeón “Notas”
Debe permitir:

Crear notas

Eliminar notas

Campos:

Fecha (automática)

Usuario (automático)

Puesto (automático)

Nota (campo abierto)

Archivo adjunto (opcional)