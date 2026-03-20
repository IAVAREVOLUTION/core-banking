Problema institucional detectado
Al editar o guardar un CLIENTE en el módulo Clientes:

El formulario no carga todos los campos.

El formulario no guarda todos los campos.

Algunos campos aparecen en el listado pero no aparecen en Editar.

Al guardar, se pierden datos del JSON.

Arrays como direcciones, SIC, listas negras o expedientes no se guardan o se borran.

El registro activado desde Prospectos no carga completo en Clientes.

Esto ocurre porque el módulo Cliente no está leyendo ni guardando correctamente el JSON data de la tabla:

Código
EFINANCIANET_DB."J_CLIENTES"
1. Carga institucional del formulario (Editar Cliente)
Cuando el usuario abra:

Clientes → Editar

el sistema debe ejecutar:

sql
SELECT id, type, subtipo, estatus, data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = <ID_CLIENTE>;
Reglas obligatorias:
TODOS los campos del formulario deben mapearse desde data.

No se debe leer información desde otro lado.

No se debe asumir otra estructura.

No se deben omitir nodos del JSON.

2. Mapeo obligatorio del JSON al formulario
2.1 Datos personales
data.nombre

data.apellidoPaterno

data.apellidoMaterno

data.fechaNacimiento

data.sexo

data.rfc

data.curp

data.tipo

2.2 Contacto
data.telefono

data.correoElectronico

data.direccion

data.entidadFederativa

data.sucursal

2.3 Prospecto / Cliente
data.estatusProspecto

data.estatusCliente

data.fechaOriginacion

data.fechaActivacion

2.4 Arrays (subtabs)
data.direcciones[]

data.sic[]

data.listasNegras[]

data.expedientesElectronicos[]

2.5 Reglas críticas
Si un array existe → cargarlo completo.

Si no existe → inicializar como [].

Nunca borrar arrays al cargar.

3. Guardado institucional (Editar Cliente)
Cuando el usuario presione Guardar, el sistema debe:

3.1 Leer el JSON actual desde BD
sql
SELECT data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = <ID_CLIENTE>;
3.2 Construir un JSON PARCIAL con solo los campos modificados
Ejemplo:

json
{
  "nombre": "Nuevo Nombre",
  "apellidoPaterno": "Nuevo Paterno",
  "telefono": "55555555",
  "direcciones": [...],
  "sic": [...],
  "listasNegras": [...],
  "expedientesElectronicos": [...]
}
3.3 MERGE JSON institucional
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

4. Reglas institucionales para arrays (direcciones, SIC, listas negras, expedientes)
4.1 Al cargar
Mostrar todos los elementos del array.

No filtrar ni modificar.

4.2 Al guardar
Si el usuario edita un elemento → reemplazar solo ese elemento.

Si el usuario agrega uno nuevo → agregar al array.

Si el usuario elimina uno → eliminar solo ese elemento.

4.3 Estructura obligatoria de cada array
Direcciones
json
{
  "id": <timestamp>,
  "pais": "",
  "estado": "",
  "municipio": "",
  "ciudad": "",
  "colonia": "",
  "calle": "",
  "numeroExterior": "",
  "numeroInterior": "",
  "piso": "",
  "codigoPostal": "",
  "principal": true
}
SIC
json
{
  "id": <timestamp>,
  "estatus": "",
  "usuario": "",
  "fechaHora": "",
  "tipoConsulta": "",
  "xmlResultado": ""
}
Listas Negras
json
{
  "id": <timestamp>,
  "estatus": "",
  "usuario": "",
  "fechaHora": "",
  "tipoLista": "",
  "nombreLista": ""
}
Expedientes Electrónicos
json
{
  "id": <timestamp>,
  "nombre": "",
  "mime": "",
  "tamanoKB": "",
  "fechaCarga": "",
  "storagePath": "",
  "tipoDocumento": ""
}
5. Revisión obligatoria del formulario Cliente
El desarrollador debe revisar:

5.1 Carga del formulario
¿Está leyendo data completo?

¿Está mapeando cada campo desde data?

¿Está ignorando nodos del JSON?

¿Está usando nombres de campos incorrectos?

5.2 Guardado del formulario
¿Está enviando JSON parcial?

¿Está haciendo MERGE o está reemplazando todo el JSON?

¿Está borrando arrays?

¿Está enviando campos vacíos que borran datos?

5.3 Compatibilidad con Prospectos
¿El módulo Clientes está usando la misma estructura que Prospectos?

¿El nombre completo se arma igual?

¿Los arrays se respetan?

6. Resultado esperado
Después de aplicar este prompt:

El formulario de Clientes → Editar cargará TODOS los datos.

Los cambios se guardarán correctamente en la BD.

Los arrays se cargarán y guardarán sin perder información.

Los datos heredados de Prospectos se respetarán.

La activación de prospecto actualizará correctamente el registro.

No se perderá información del JSON.

No aparecerán campos vacíos en Editar que sí estaban en el listado.