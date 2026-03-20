Objetivo
Garantizar que al agregar, editar o cargar una Persona Relacionada, el sistema:

Guarde correctamente todos los datos del cliente relacionado.

Cargue correctamente todos los datos guardados.

Use correctamente la tabla J_CLIENTES para obtener los datos.

Actualice correctamente el JSON data.personasRelacionadas[].

No guarde relaciones vacías.

No guarde solo el ID.

No pierda datos al editar.

1. Flujo institucional correcto del subtab
Flujo actual (incorrecto)
El modal lista clientes → OK

Seleccionas uno → OK

Guardas → ❌

Guarda algo incompleto o vacío

Al cargar → ❌

No muestra nombre, RFC, personalidad, etc.

Flujo que debe implementarse
Modal lista clientes desde J_CLIENTES

Usuario selecciona un cliente

Sistema obtiene TODOS los datos del cliente seleccionado

Sistema construye un objeto JSON completo

Sistema lo agrega a data.personasRelacionadas[]

Sistema hace MERGE JSON

Al cargar, el subtab lee ese array y muestra todo

2. Consulta institucional para llenar el modal “Nuevo”
El modal debe obtener la lista de clientes desde la misma tabla:

sql
SELECT 
  id,
  data->>'idCliente' AS claveCliente,
  data->>'nombre' AS nombre,
  data->>'apellidoPaterno' AS apellidoPaterno,
  data->>'apellidoMaterno' AS apellidoMaterno,
  data->>'rfc' AS rfc,
  data->>'tipo' AS personalidad
FROM "EFINANCIANET_DB"."J_CLIENTES"
ORDER BY data->>'nombre';
3. Al seleccionar un cliente en el modal
El sistema debe obtener todos los datos necesarios:

sql
SELECT 
  id,
  data->>'idCliente' AS claveCliente,
  data->>'nombre' AS nombre,
  data->>'apellidoPaterno' AS apellidoPaterno,
  data->>'apellidoMaterno' AS apellidoMaterno,
  data->>'rfc' AS rfc,
  data->>'curp' AS curp,
  data->>'tipo' AS personalidad,
  data->>'estatusCliente' AS estatusCliente
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_RELACIONADO>';
4. JSON institucional que DEBE guardarse
Cuando el usuario presione Guardar, el sistema debe construir un objeto completo:

json
{
  "id": "<ID_RELACIONADO>",
  "claveCliente": "<CLAVE_CLIENTE>",
  "nombreCompleto": "<NOMBRE> <AP_PATERNO> <AP_MATERNO>",
  "rfc": "<RFC>",
  "curp": "<CURP>",
  "personalidad": "<PERSONALIDAD>",
  "estatusCliente": "<ESTATUS_CLIENTE>",
  "tipoRelacion": "<TIPO_RELACION>",
  "fechaRegistro": "<FECHA_HORA>"
}
Regla institucional:  
NO se debe guardar solo el ID.
NO se debe guardar un objeto vacío.
NO se debe guardar un objeto sin nombre.

5. Guardado institucional en la tabla J_CLIENTES
5.1 Leer JSON actual
sql
SELECT data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
5.2 Agregar la nueva persona relacionada al array
sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET data = jsonb_set(
      data,
      '{personasRelacionadas}',
      COALESCE(data->'personasRelacionadas', '[]'::jsonb) || '<OBJETO_PERSONA_RELACIONADA>'::jsonb
    )
WHERE id = '<ID_CLIENTE>';
6. Carga institucional del subtab
Cuando el usuario abra el subtab:

sql
SELECT data->'personasRelacionadas'
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
Reglas:
Si el array existe → mostrarlo completo

Si no existe → inicializar como []

No reconstruir el array

No borrar elementos

7. Validaciones obligatorias
No permitir relacionar un cliente consigo mismo

No permitir duplicados (mismo ID)

No permitir guardar objetos vacíos

No permitir guardar sin nombre, RFC o personalidad

No permitir guardar si no se seleccionó un cliente

8. Resultado esperado
Después de aplicar este prompt:

El modal “Nuevo” seguirá mostrando la lista de clientes correctamente.

Al guardar, se guardará un objeto JSON completo con todos los datos.

El subtab cargará correctamente la información.

Ya no aparecerán registros vacíos o incompletos.

Ya no aparecerán relaciones sin nombre, sin RFC o sin personalidad.

El módulo quedará funcional y consistente.