Módulo: CLIENTES → Editar → Personas Relacionadas
Tabla real: EFINANCIANET_DB."J_CLIENTES"
Campo donde DEBE guardarse: data (jsonb)
1. Problema real detectado
En el subtab Personas Relacionadas:

El modal “Nuevo” sí lista clientes (OK).

Pero al guardar:

NO guarda nada en data.personasRelacionadas[]

NO guarda Clave Cliente

NO guarda RFC

NO guarda Nombre

NO guarda Personalidad

NO guarda Fecha Nac.

NO guarda Estatus

NO guarda Tipo Relación

NO guarda Participación

El registro aparece como:

“Sin nombre”

Esto significa que el sistema está guardando un objeto vacío o no está guardando nada.

2. Reglas institucionales obligatorias
2.1 Personas Relacionadas SE DEBEN GUARDAR EN data
No existe otra tabla.
No existe otra relación.
No existe otro lugar.

Debe guardarse en:

Código
data.personasRelacionadas[]
2.2 Si el array no existe → inicializarlo como []
2.3 Cada persona relacionada debe guardarse como un objeto JSON COMPLETO
3. Consulta obligatoria al seleccionar un cliente en el modal
Cuando el usuario seleccione un cliente relacionado, el sistema debe obtener todos los datos necesarios:

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
4. JSON que DEBE guardarse (obligatorio)
El sistema debe construir este objeto:

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
Reglas:
NO guardar solo el ID

NO guardar un objeto vacío

NO guardar sin nombre

NO guardar sin RFC

NO guardar sin personalidad

NO guardar sin tipo de relación

NO guardar sin participación

5. Guardado institucional en la tabla J_CLIENTES
5.1 Leer JSON actual
sql
SELECT data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
5.2 Agregar la persona relacionada al array
sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET data = jsonb_set(
      data,
      '{personasRelacionadas}',
      COALESCE(data->'personasRelacionadas', '[]'::jsonb) || '<OBJETO_PERSONA_RELACIONADA>'::jsonb
    )
WHERE id = '<ID_CLIENTE>';
ESTO ES LO QUE HOY NO ESTÁ HACIENDO EL DESARROLLADOR.

6. Carga institucional del subtab
Cuando el usuario abra el subtab:

sql
SELECT data->'personasRelacionadas'
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
Reglas:
Si existe → mostrarlo completo

Si no existe → mostrar []

No reconstruir

No borrar

7. Validaciones obligatorias
No permitir relacionar un cliente consigo mismo

No permitir duplicados (mismo ID)

No permitir guardar objetos vacíos

No permitir guardar sin tipo de relación

No permitir guardar sin participación

8. Resultado esperado
Después de aplicar este prompt:

El subtab guardará correctamente Clave Cliente, RFC, Nombre, Personalidad, Fecha Nac., Estatus, Tipo Relación y Participación.

El subtab cargará correctamente los datos guardados.

Ya no aparecerán registros vacíos (“Sin nombre”).

El módulo quedará funcional y estable.