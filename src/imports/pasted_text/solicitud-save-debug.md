Quiero que analices por qué el sistema NO está guardando correctamente los datos de la Solicitud en la tabla:

Código
EFINANCIANET_DB.J_CUENTAS_CORP_CLIENTES
y por qué el JSON dentro del campo:

Código
data jsonb
NO coincide con la estructura requerida.

Evalúa lo siguiente:

1. Validación del usuario que guarda los registros
Determina si:

El sistema está guardando SIEMPRE el usuario “Miguel Pérez García”, aunque el usuario real sea otro.

El backend está hardcodeando ese nombre.

El frontend está enviando ese usuario en el payload.

El middleware está sobrescribiendo el usuario real.

La tabla tiene un default incorrecto.

El valor no proviene de la sesión actual.

Debes identificar dónde ocurre el error.

2. Validación del consecutivo NO_SOL
El campo:

Código
no_sol character varying(30)
DEBE generarse con el formato:

Código
BAN-DIGITAL-AAAAMMDD-000001
BAN-DIGITAL-AAAAMMDD-000002
BAN-DIGITAL-AAAAMMDD-000003
...
Evalúa si:

El consecutivo no incrementa.

El consecutivo se reinicia incorrectamente.

El consecutivo no consulta la última solicitud del día.

El consecutivo se concatena mal.

El consecutivo no está formateado a 6 dígitos.

El consecutivo se genera en frontend (incorrecto).

El consecutivo se está duplicando o repitiendo.

Debes identificar qué parte del código genera el error.

3. Validación del guardado en la tabla J_CUENTAS_CORP_CLIENTES
Verifica que los siguientes campos se estén guardando correctamente:

type

no_sol

no_cuenta

fecha_sol

descripcion

linea_produc

tipo_produc

producto_id

cliente_id

monto_sol

monto_aut

estatus_sol

fases

data

Evalúa si:

Alguno se guarda vacío.

Alguno se guarda con valores inventados.

Alguno se guarda con valores de otra solicitud.

Alguno se guarda con valores por defecto no autorizados.

Alguno NO se está guardando aunque el usuario lo capturó.

4. Validación del JSON data
El campo:

Código
data jsonb
DEBE guardar EXACTAMENTE la siguiente estructura:

Código
{
  "solicitud": {
    "header": {
      "id": ...,
      "no_sol": ...,
      "cotizacion_id": ...,
      "linea_producto": ...,
      "tipo_producto": ...,
      "tipo_persona": ...,
      "nombre_persona": ...,
      "apellido_paterno_persona": ...,
      "apellido_materno_persona": ...,
      "producto_id": ...,
      "nombre_producto": ...,
      "fecha_solicitud": ...,
      "descripcion": ...,
      "fase_id": ...,
      "descripcion_fase": ...,
      "estatus": ...
    },

    "terminos_condiciones": {
      "tipo_producto": ...,
      "parametros_simulacion": {
        "monto_solicitado": ...,
        "plazo": ...,
        "tasa_interes": ...,
        "periodicidad": ...,
        "fecha_primer_pago": ...,
        "fecha_primera_aportacion": ...
      }
    },

    "simulacion": {
      "tipo_tabla": ...,
      "resultado_simulacion": [...]
    },

    "expediente_electronico": {
      "documentos": [...]
    },

    "garantias": [...],
    "comisiones": [...],
    "autorizaciones": [...],
    "notas": [...]
  }
}
Evalúa si:

El JSON se guarda incompleto.

El JSON se guarda vacío.

El JSON se guarda con campos nulos incorrectos.

El JSON se guarda con estructura distinta.

El JSON se guarda con nombres de campos incorrectos.

El JSON se guarda con datos inventados.

El JSON se guarda con datos de otra solicitud.

El JSON se guarda con datos de otro usuario.

5. Validación del mapeo desde el formulario
Evalúa si los siguientes campos del formulario se están guardando correctamente en la tabla y en el JSON:

HEADER
Línea de Producto

Tipo de Producto

Tipo de Persona

Nombre(s)

Apellido Paterno

Apellido Materno

Producto

Nombre Producto

Fecha Solicitud

Estatus Solicitud

Monto Solicitado

Monto Autorizado

Fase

Descripción Fase

Descripción

TÉRMINOS Y CONDICIONES
Monto Solicitado

Fecha Primer Pago

Plazo

Frecuencia

Tasa

Tipo de Tasa

Tipo de Cálculo

Moneda

Monto Garantía

Seguro Financiado

ACORDEONES
Simulación

Expediente Electrónico

Garantías

Comisiones

Autorizaciones

Notas

Evalúa si:

Los valores del formulario NO coinciden con lo guardado.

Se están guardando valores por defecto.

Se están guardando valores de otra solicitud.

Se están guardando valores de otro usuario.

Se están guardando valores inventados.

6. Resultado esperado
Quiero un diagnóstico técnico, preciso y verificable, que indique:

Por qué se guarda el usuario “Miguel Pérez García”.

Por qué NO incrementa el consecutivo NO_SOL.

Qué campos NO se están guardando correctamente.

Qué parte del backend está fallando.

Qué corrección técnica se requiere.