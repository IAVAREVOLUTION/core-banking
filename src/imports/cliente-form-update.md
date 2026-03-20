1. Objetivo
Corregir el módulo Clientes → Nuevo / Editar para que:

Todos los campos del formulario se carguen correctamente desde la BD.

Todos los campos se guarden correctamente en la BD.

El JSON data se actualice sin perder información.

Se agreguen nuevos campos al JSON cuando el formulario los requiera.

No se borren arrays ni nodos existentes.

Sea compatible con Prospectos y con Clientes Activos.

2. Consulta institucional para cargar el formulario
Cuando el usuario abra Clientes → Nuevo o Clientes → Editar, ejecutar:

sql
SELECT 
  id,
  type,
  subtipo,
  estatus,
  data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = <ID_CLIENTE>;
Regla institucional:  
El formulario debe mapear todos los campos desde data, no desde otras fuentes.

3. Mapeo obligatorio del formulario → JSON data
Cada campo del formulario debe tener un nodo correspondiente en data.
Si el nodo no existe, debe crearse automáticamente.

3.1 Información Principal
Campo UI	JSON destino
ID CLIENTE	data.idCliente
PERSONALIDAD	data.tipo
CLASIFICACIÓN DEL CLIENTE	data.clasificacionCliente
NOMBRE	data.nombre
APELLIDO PATERNO	data.apellidoPaterno
APELLIDO MATERNO	data.apellidoMaterno
FECHA DE NACIMIENTO	data.fechaNacimiento
EDAD	data.edad
SEXO	data.sexo
ESTADO CIVIL	data.estadoCivil
NACIONALIDAD	data.nacionalidad
RFC	data.rfc
CURP	data.curp
ENTIDAD FEDERATIVA DE NACIMIENTO	data.entidadFederativaNacimiento
ENTIDAD DONDE VIVE	data.entidadFederativa
NIVEL DE ESTUDIOS	data.nivelEstudios
LENGUAJE	data.lenguaje
MONEDA	data.moneda
SUCURSAL	data.sucursal
FECHA CUENTA EJE	data.fechaCuentaEje
FECHA DE ALTA	data.fechaAlta
ESTATUS SIC	data.estatusSIC
ESTATUS LISTA NEGRA	data.estatusListaNegra
ESTATUS DEL CLIENTE	data.estatusCliente
CALIFICACIÓN DEL CLIENTE	data.calificacionCliente
INSTITUCIÓN GOBIERNO	data.institucionGobierno
Regla:  
Si el campo existe en el formulario, debe existir en el JSON.

4. Reglas institucionales para GUARDAR (Nuevo / Editar Cliente)
Cuando el usuario presione Guardar, el sistema debe:

4.1 Leer el JSON actual desde BD
sql
SELECT data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = <ID_CLIENTE>;
4.2 Construir un JSON PARCIAL con solo los campos modificados
Ejemplo:

json
{
  "nombre": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "López",
  "estadoCivil": "Casado",
  "nivelEstudios": "Licenciatura",
  "clasificacionCliente": "Preferente",
  "institucionGobierno": "IMSS"
}
4.3 MERGE JSON institucional
sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET 
  type = '<type>',
  subtipo = '<subtipo>',
  estatus = '<estatus>',
  data = data || '<JSON_PARCIAL>'::jsonb
WHERE id = '<ID_CLIENTE>';
Reglas del MERGE:
data SIEMPRE va a la izquierda.

El JSON parcial va a la derecha.

No se borra nada que no se mande.

No se reconstruye el JSON completo.

No se eliminan arrays existentes.

No se reemplazan arrays completos a menos que el usuario los edite.

5. Reglas institucionales para arrays (si el formulario los usa)
Si el formulario incluye subtabs como:

Direcciones

SIC

Listas Negras

Expedientes

entonces:

5.1 Al cargar
Mostrar todos los elementos del array.

No filtrar ni modificar.

5.2 Al guardar
Reemplazar solo el elemento editado.

Agregar solo el elemento nuevo.

Eliminar solo el elemento borrado.

5.3 Nunca reemplazar el array completo a menos que el usuario lo edite.
6. Validación institucional del formulario
El desarrollador debe revisar:

6.1 Carga del formulario
¿Cada campo está leyendo desde data?

¿Algún campo está leyendo desde otro lado?

¿Algún campo no se está mapeando?

6.2 Guardado del formulario
¿Se está construyendo JSON parcial?

¿Se está haciendo MERGE JSON?

¿Se está borrando información previa?

¿Se están perdiendo arrays?

¿Se están enviando campos vacíos que borran datos?

6.3 Compatibilidad con Prospectos
¿El módulo Clientes respeta la estructura JSON heredada?

¿Los nuevos campos se agregan sin romper el JSON?

7. Resultado esperado
Después de aplicar este prompt:

El formulario de Clientes cargará todos los campos.

El formulario de Clientes guardará todos los campos.

El JSON data quedará completo y actualizado.

No se perderá información heredada de Prospectos.

No se borrarán arrays ni nodos.

Nuevos campos se integrarán correctamente.

