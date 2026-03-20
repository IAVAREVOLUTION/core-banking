Analiza el módulo SOLICITUDES y determina si cumple exactamente con todas las funcionalidades, reglas de negocio, mapeos, estructuras, restricciones y comportamientos descritos a continuación.
La validación debe ser determinista, exhaustiva, campo‑por‑campo y acordeón‑por‑acordeón.
No incluyas ni evalúes nada relacionado con Banca Móvil.

1. Validación de creación de Solicitudes desde Cotización
Evalúa si el sistema cumple:

Existe un botón “Crear Solicitud” en el detalle de la Cotización.

El botón está deshabilitado cuando COTIZACION.ESTATUS = "Aceptada".

El botón está habilitado en cualquier otro estatus.

Al activarlo, se crea una Solicitud nueva correctamente.

La Solicitud se crea con todos los campos mapeados desde la Cotización.

No se generan datos automáticos adicionales no especificados.

2. Validación de creación de Solicitudes desde el módulo Solicitudes
Evalúa si:

El usuario puede crear una Solicitud sin cotización previa.

Los campos inician vacíos excepto los automáticos.

No se generan registros automáticos en subtabs.

La persistencia en DB es correcta.

3. Validación del HEADER (mapeo obligatorio Cotización → Solicitud)
Verifica que cada campo se mapea correctamente:

SOLICITUD.ID = automático

SOLICITUD.NO_SOL = automático con formato BAN-DIGITAL-AAAAMMDD-999999

SOLICITUD.COTIZACION_ID = COTIZACION.COTIZACION_ID

SOLICITUD.LINEA_PRODUCTO = COTIZACION.LINEA_PRODUCTO

SOLICITUD.TIPO_PRODUCTO = COTIZACION.TIPO_PRODUCTO

SOLICITUD.TIPO_PERSONA = COTIZACION.TIPO_PERSONA

SOLICITUD.NOMBRE_PERSONA = COTIZACION.NOMBRE_PERSONA

SOLICITUD.APELLIDO_PATERNO_PERSONA = COTIZACION.APELLIDO_PATERNO_PERSONA

SOLICITUD.APELLIDO_MATERNO_PERSONA = COTIZACION.APELLIDO_MATERNO_PERSONA

SOLICITUD.PRODUCTO_ID = COTIZACION.PRODUCTO_ID

SOLICITUD.NOMBRE_PRODUCTO = COTIZACION.NOMBRE_PRODUCTO

SOLICITUD.FECHA_SOLICITUD = fecha actual con formato del sistema

SOLICITUD.DESCRIPCION = textarea 1024 caracteres

SOLICITUD.FASE_ID = mínimo FASE_ID del subtab Requisitos del producto

SOLICITUD.DESCRIPCION_FASE = descripción de la fase correspondiente

COTIZACION.ESTATUS = “Aceptada”

Valida:

Exactitud del mapeo

Ausencia de campos faltantes

Ausencia de campos extra

Persistencia real en DB

4. Validación del acordeón “Términos y Condiciones”
Evalúa si:

El contenido cambia dinámicamente según SOLICITUD.TIPO_PRODUCTO.

Se mapean correctamente los datos de simulación para:

Crédito

Captación

Línea de Crédito

Los campos coinciden con los usados en Cotizaciones:

Monto solicitado

Fecha primer pago

Fecha primera aportación

Plazo

Frecuencia

Tasa

No existen campos adicionales no configurados.

5. Validación del acordeón “Simulación”
Evalúa si:

Se muestra la tabla correcta según el tipo de producto:

Pagos (Crédito)

Aportaciones (Captación)

Amortización (Línea de Crédito)

Los cálculos coinciden con los parámetros de Términos y Condiciones.

No hay discrepancias entre simulación y datos mapeados.

6. Validación del acordeón “Expediente Electrónico”
Sección 1 — Requisitos del Producto
Evalúa si:

Se muestran todos los requisitos del subtab PRODUCTO → REQUISITOS.

Se respetan: área, fase, obligatoriedad, descripción, PROMPT_IA.

No se muestran requisitos de otros productos.

Sección 2 — Documentos cargados
Evalúa si:

Solo se muestran documentos de la Solicitud actual.

Los campos son correctos:

Fecha

Usuario

Tipo de documento

Archivo adjunto

Tipo de archivo

Nota

Área

Fase

No se muestran documentos de otros usuarios o solicitudes.

Reglas de negocio
Regla 1: Validación por IA del archivo según PROMPT_IA.

Regla 2: El botón “Validar Requisitos / Enviar Solicitud” solo permite avanzar si todos los documentos requeridos para la fase actual están cargados y validados.

7. Validación del acordeón “Garantías”
Evalúa si:

Se pueden agregar y eliminar garantías.

Las garantías provienen del subtab CLIENTE → GARANTÍAS.

El monto total cubre el monto calculado en Términos y Condiciones.

No se muestran garantías de otros clientes o solicitudes.

No se generan garantías automáticas.

8. Validación del acordeón “Comisiones”
Evalúa si:

Las comisiones se calculan automáticamente según PRODUCTO → COMISIONES.

Los valores coinciden con la configuración del producto.

No se generan comisiones no configuradas.

9. Validación del acordeón “Autorizaciones”
Evalúa si:

Se muestran los usuarios del puesto/rol configurado en PRODUCTO → AUTORIZACIÓN.

La selección depende de:

SOLICITUD.PRODUCTO_ID

SOLICITUD.MONTO_SOLICITADO

Los usuarios se obtienen de CONFIGURACIÓN → PUESTOS DE TRABAJO.

No se muestran usuarios incorrectos.

10. Validación del acordeón “Notas”
Evalúa si:

Se pueden crear y eliminar notas.

Los campos son correctos: fecha, usuario, puesto, nota, archivo adjunto.

No se muestran notas de otras solicitudes.

No se generan notas automáticas.

11. Validación de persistencia en base de datos
Evalúa si:

Cada subtab tiene su tabla o relación correspondiente.

Todos los campos se guardan correctamente.

No se generan registros automáticos.

Al reabrir la Solicitud, los datos provienen solo de la DB.

No hay subtabs que guarden parcialmente o no guarden nada.

12. Validación de consistencia general
Evalúa si:

El diseño es idéntico al CORE Bancario.

El header siempre está visible.

Los acordeones funcionan correctamente.

No hay datos mezclados entre productos, usuarios o solicitudes.

No existen valores por defecto no autorizados.

