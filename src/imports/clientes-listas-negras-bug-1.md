Módulo: CLIENTES → Editar → Listas Negras
Igual funcionalidad que: PROSPECTOS → Editar → Listas Negras
Tabla real: EFINANCIANET_DB."J_CLIENTES"
Campo donde DEBE guardarse: data (jsonb)
1. Problema real detectado
En el subtab Listas Negras del módulo Clientes:

El modal “Nueva Lista Negra” sí abre.

El diseño es correcto.

Pero NO carga ni guarda correctamente los campos:

Usuario que registró

Resultado

Observaciones

Tipo Lista

Nombre Lista

Fecha y hora

Esto significa que:

El sistema no está construyendo el objeto JSON completo, o

no está guardando en data.listasNegras[], o

está guardando un objeto vacío, o

no está replicando el comportamiento del módulo Prospecto.

2. Reglas institucionales del subtab Listas Negras
2.1 Listas Negras SE DEBEN GUARDAR EN data.listasNegras[]
No existe otra tabla.
No existe otro lugar.
Debe guardarse en:

Código
data.listasNegras[]
2.2 Si el array no existe → inicializarlo como []
2.3 Cada registro debe guardarse como un objeto JSON COMPLETO
3. JSON institucional que DEBE guardarse (igual que Prospecto)
Cuando el usuario presione Guardar en el modal “Nueva Lista Negra”, el sistema debe construir este objeto:

json
{
  "id": "<TIMESTAMP>",
  "nombreLista": "<NOMBRE_LISTA>",
  "tipoLista": "<TIPO_LISTA>",
  "estatus": "<ESTATUS>",
  "resultado": "<RESULTADO>",
  "observaciones": "<OBSERVACIONES>",
  "usuarioRegistro": "<USUARIO_LOGUEADO>",
  "fechaHoraRegistro": "<FECHA_HORA>"
}
Reglas obligatorias:
NO guardar solo el ID

NO guardar un objeto vacío

NO guardar sin usuario

NO guardar sin fecha/hora

NO guardar sin nombre de lista

NO guardar sin tipo de lista

NO guardar sin estatus

NO guardar sin resultado

NO guardar sin observaciones

4. Guardado institucional en la tabla J_CLIENTES
4.1 Leer JSON actual
sql
SELECT data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
4.2 Agregar el registro al array
sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET data = jsonb_set(
      data,
      '{listasNegras}',
      COALESCE(data->'listasNegras', '[]'::jsonb) || '<OBJETO_LISTA_NEGRA>'::jsonb
    )
WHERE id = '<ID_CLIENTE>';
ESTO ES LO QUE HOY NO ESTÁ HACIENDO EL DESARROLLADOR.

5. Carga institucional del subtab
Cuando el usuario abra el subtab:

sql
SELECT data->'listasNegras'
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
Reglas:
Si existe → mostrarlo completo

Si no existe → mostrar []

No reconstruir

No borrar

6. Reglas institucionales para edición
6.1 Cargar array completo
sql
SELECT data->'listasNegras'
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
6.2 Reemplazar solo el elemento editado
Identificar por id

Reemplazar solo ese nodo

Mantener los demás intactos

7. Reglas institucionales para eliminación
7.1 Eliminar solo el elemento cuyo id coincida
7.2 No borrar el array completo
8. Igualar funcionalidad con Prospectos
El subtab Listas Negras en Clientes debe funcionar exactamente igual que:

PROSPECTOS → Editar → Listas Negras

Esto significa:

Misma estructura JSON

Mismo flujo

Mismo guardado

Mismo MERGE

Mismo comportamiento del modal

Mismo renderizado de la tabla

9. Resultado esperado
Después de aplicar este prompt:

Listas Negras guardará correctamente Usuario, Resultado, Observaciones, Tipo Lista, Nombre Lista, Estatus y Fecha/Hora.

Listas Negras cargará correctamente todos los campos.

Ya no aparecerán registros incompletos.

El subtab será consistente con Prospectos.

El módulo Clientes quedará estable y funcional.