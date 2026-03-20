1. Contexto de la tabla y JSON
Tabla real:

sql
CREATE TABLE "EFINANCIANET_DB"."J_CLIENTES" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type varchar NULL,
  subtipo varchar NULL,
  estatus varchar NULL,
  data jsonb NOT NULL,
  par_cliente_id uuid NULL,
  CONSTRAINT J_CLIENTES_pkey PRIMARY KEY (id),
  CONSTRAINT J_CLIENTES_par_cliente_id_fkey FOREIGN KEY (par_cliente_id)
    REFERENCES "EFINANCIANET_DB"."J_CLIENTES"(id)
);
Ejemplo real de data (Prospecto):

json
{
  "rfc": "SOEC",
  "curp": "1-17160648",
  "sexo": "Masculino",
  "tipo": "Persona Fisica",
  "nombre": "Test Prueba Test Docs",
  "apellidoPaterno": "Test",
  "apellidoMaterno": "Docs",
  "estatus": "Pendiente",
  "estatusProspecto": "Prospecto",
  "estatusCliente": "Prospecto",
  "idProspecto": "PROS-016",
  "sucursal": "CDMX",
  "telefono": "12121212",
  "direccion": "SOEC",
  "correoElectronico": "j@j.j",
  "fechaNacimiento": "1993-12-31",
  "fechaOriginacion": "2026-02-28",
  "entidadFederativa": "CDMX",
  "estatusSIC": "NEGATIVO",
  "estatusListaNegra": "NEGATIVO",
  "institucionGobierno": "Colegio Nacional de Educación Profesional Técnica",
  "constanciaResidencia": "residencia/constancia_1772122018073_lc0wy8wh.pdf",
  "denominacionRazonSocial": "Social",
  "direcciones": [...],
  "sic": [...],
  "listasNegras": [...],
  "expedientesElectronicos": [...]
}
2. Problema 1: En el listado se ve el nombre completo, pero en Editar no
Regla institucional:

El listado de Prospectos y el formulario de Editar deben usar las mismas fuentes de datos para el nombre.

Regla de mapeo:

Nombre completo en listado =
data.nombre + ' ' + data.apellidoPaterno + ' ' + data.apellidoMaterno

En el formulario de Editar, los campos deben mapearse así:

Campo “Nombre” → data.nombre

Campo “Apellido Paterno” → data.apellidoPaterno

Campo “Apellido Materno” → data.apellidoMaterno

Obligatorio:

El formulario de Editar NO debe inventar otra estructura ni leer de otro lado.

Debe leer SIEMPRE del JSON data que está en la tabla J_CLIENTES.

3. Problema 2: Al activar prospecto, los datos no aparecen en Clientes (parece que no se guardan)
Regla institucional de activación:

Cuando se presione “Activar Prospecto” sobre un registro de PROSPECTO:

NO se debe crear otro registro en otra tabla:
se trabaja sobre el MISMO registro en J_CLIENTES.

Se debe actualizar:

sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET 
  type   = 'Clientes',
  estatus = 'Activo',
  data = data || '{
    "estatusCliente": "Cliente",
    "estatusProspecto": "Convertido",
    "fechaActivacion": "<FECHA_ACTUAL>"
  }'::jsonb
WHERE id = <ID_CLIENTE>;
El módulo Clientes debe leer exactamente el mismo registro de J_CLIENTES filtrando por:

sql
WHERE type = 'Clientes'
El módulo Prospectos debe filtrar por:

sql
WHERE type = 'Prospectos' OR data->>'estatusProspecto' = 'Prospecto'
Punto clave:  
No se está “pasando” a otra tabla: es el mismo registro, con type y estatus cambiados, y con data enriquecido.

4. Problema 3: El formulario de Editar no carga lo que sí está en el JSON
Regla institucional para el formulario de Editar PROSPECTO:

Al abrir Editar:

Ejecutar:

sql
SELECT id, type, subtipo, estatus, data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = <ID_CLIENTE>;
Mapear campos del form SIEMPRE desde data:

RFC → data.rfc

CURP → data.curp

Nombre → data.nombre

Apellido Paterno → data.apellidoPaterno

Apellido Materno → data.apellidoMaterno

Fecha Nacimiento → data.fechaNacimiento

Teléfono → data.telefono

Correo → data.correoElectronico

Sucursal → data.sucursal

Entidad Federativa → data.entidadFederativa

Estatus SIC → data.estatusSIC

Estatus Lista Negra → data.estatusListaNegra

etc.

Prohibido:

Leer nombre desde otro lado que no sea data.

Reconstruir el JSON en memoria y no usar el que está en BD.

5. Problema 4: Al guardar cambios en PROSPECTO, se pierde o no se actualiza bien el JSON
Regla institucional de guardado (Editar Prospecto):

Leer el JSON actual desde BD:

sql
SELECT data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = <ID_CLIENTE>;
Construir un JSON parcial solo con los campos modificados, por ejemplo:

json
{
  "nombre": "Nuevo Nombre",
  "apellidoPaterno": "Nuevo Paterno",
  "apellidoMaterno": "Nuevo Materno",
  "telefono": "55555555",
  "correoElectronico": "nuevo@correo.com"
}
Hacer MERGE:

sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET data = data || '<JSON_PARCIAL>'::jsonb
WHERE id = <ID_CLIENTE>;
Reglas:

data SIEMPRE va a la izquierda.

El JSON parcial va a la derecha.

No se borra nada que no se mande.

No se reconstruye el JSON completo desde cero.

6. Reglas institucionales para que Clientes vea bien lo que viene de Prospectos
Cuando el registro ya está como Cliente (type = 'Clientes' y estatus = 'Activo'):

El módulo Clientes debe usar el MISMO mapeo que Prospectos:

Nombre completo = data.nombre + data.apellidoPaterno + data.apellidoMaterno

RFC = data.rfc

CURP = data.curp

Teléfono = data.telefono

Correo = data.correoElectronico

etc.

No debe inventar otra estructura ni asumir que el nombre está en otro lado.

7. Resultado esperado
Con este prompt aplicado:

El listado de Prospectos y el formulario de Editar muestran el mismo nombre, porque leen del mismo lugar (data).

Al activar prospecto, el registro en J_CLIENTES se actualiza (type, estatus, data) y Clientes lo ve.

No se pierden datos del JSON.

No se crean registros fantasmas.

El flujo Prospecto → Cliente es trazable, auditable y consistente.