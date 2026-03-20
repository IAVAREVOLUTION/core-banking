. Contexto del problema
En el módulo:

CLIENTES → Editar → Personas Relacionadas

ocurre lo siguiente:

El modal “Nuevo” sí muestra la lista de clientes.

Pero al guardar, NO se guarda la información completa del cliente seleccionado.

En la tabla aparece un registro vacío (“Sin nombre”).

No carga Clave Cliente, RFC, Nombre, Personalidad, Fecha Nac., Estatus, Tipo Relación, Participación.

Esto indica que:

El sistema solo está guardando el ID, o

Está guardando un objeto vacío, o

No está consultando la tabla J_CLIENTES para obtener los datos completos, o

No está haciendo MERGE JSON correctamente.

2. Reglas institucionales del subtab Personas Relacionadas
2.1 El modal “Nuevo” debe listar clientes desde la misma tabla
Consulta obligatoria:

sql
SELECT 
  id,
  data->>'idCliente' AS claveCliente,
  data->>'nombre' AS nombre,
  data->>'apellidoPaterno' AS apellidoPaterno,
  data->>'apellidoMaterno' AS apellidoMaterno,
  data->>'rfc' AS rfc,
  data->>'tipo' AS personalidad,
  data->>'fechaNacimiento' AS fechaNacimiento,
  data->>'estatusCliente' AS estatusCliente
FROM "EFINANCIANET_DB"."J_CLIENTES"
ORDER BY data->>'nombre';
3. Al seleccionar un cliente en el modal
El sistema debe obtener TODOS los datos necesarios del cliente relacionado:

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
  data->>'fechaNacimiento' AS fechaNacimiento,
  data->>'estatusCliente' AS estatusCliente
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_RELACIONADO>';
4. JSON institucional que DEBE guardarse
Cuando el usuario presione Guardar, el sistema debe construir un objeto completo:

json
{
  "id": "<ID_RELACIONADO>",
  "claveCliente": "<CLAVE_CLIENTE>",
  "rfc": "<RFC>",
  "nombreCompleto": "<NOMBRE> <AP_PATERNO> <AP_MATERNO>",
  "personalidad": "<PERSONALIDAD>",
  "fechaNacimiento": "<FECHA_NACIMIENTO>",
  "estatusCliente": "<ESTATUS_CLIENTE>",
  "tipoRelacion": "<TIPO_RELACION>",
  "participacion": "<PORCENTAJE>",
  "fechaRegistro": "<FECHA_HORA>"
}
Reglas obligatorias:
NO guardar solo el ID.

NO guardar un objeto vacío.

NO guardar un objeto sin nombre.

NO guardar un objeto sin RFC.

NO guardar un objeto sin personalidad.

NO guardar un objeto sin tipo de relación.

NO guardar un objeto sin participación.

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
Si el array existe → mostrarlo completo.

Si no existe → inicializar como [].

No reconstruir el array.

No borrar elementos.

7. Validaciones obligatorias
No permitir relacionar un cliente consigo mismo.

No permitir duplicados (mismo ID).

No permitir guardar objetos vacíos.

No permitir guardar sin nombre, RFC, personalidad, tipo relación o participación.

No permitir guardar si no se seleccionó un cliente.

8. Resultado esperado
Después de aplicar este prompt:

El subtab guardará correctamente la persona relacionada.

El subtab cargará correctamente Clave Cliente, RFC, Nombre, Personalidad, Fecha Nac., Estatus, Tipo Relación y Participación.

Ya no aparecerán registros vacíos (“Sin nombre”).

El modal seguirá funcionando correctamente.

El módulo quedará estable y funcional.