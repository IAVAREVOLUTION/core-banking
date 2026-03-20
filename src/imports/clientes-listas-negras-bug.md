Módulo: CLIENTES → Editar → Listas Negras
Igual funcionalidad que: PROSPECTOS → Editar → Listas Negras
Tabla real: EFINANCIANET_DB."J_CLIENTES"
Campo donde DEBE guardarse: data (jsonb)
1. Problema real detectado
En el subtab Listas Negras del módulo Clientes:

El modal “Nuevo” sí abre.

Pero NO carga correctamente:

Usuario que registró

Resultado

Observaciones

Y NO guarda correctamente:

Usuario

Resultado

Observaciones

Fecha/Hora

Tipo de lista

Nombre de la lista

Esto significa que:

El sistema no está construyendo el objeto JSON completo, o

no está haciendo MERGE JSON, o

está guardando un objeto vacío, o

no está leyendo el JSON existente, o

no está replicando el comportamiento de Prospectos.

2. Reglas institucionales del subtab Listas Negras
2.1 Listas Negras SE DEBEN GUARDAR EN data.listasNegras[]
No existe otra tabla.
No existe otra relación.
No existe otro lugar.

2.2 Si el array no existe → inicializarlo como []
2.3 Cada registro debe guardarse como un objeto JSON COMPLETO
3. JSON institucional que DEBE guardarse
Cuando el usuario presione Guardar en Listas Negras, el sistema debe construir este objeto:

json
{
  "id": "<TIMESTAMP>",
  "tipoLista": "<TIPO_LISTA>",
  "nombreLista": "<NOMBRE_LISTA>",
  "resultado": "<RESULTADO>",
  "observaciones": "<OBSERVACIONES>",
  "usuario": "<USUARIO_LOGUEADO>",
  "fechaHora": "<FECHA_HORA>"
}
Reglas obligatorias:
NO guardar solo el ID

NO guardar un objeto vacío

NO guardar sin resultado

NO guardar sin usuario

NO guardar sin fecha/hora

NO guardar sin tipo de lista

NO guardar sin nombre de lista

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
8. Validaciones obligatorias
No permitir guardar objetos vacíos

No permitir guardar sin usuario

No permitir guardar sin resultado

No permitir guardar sin observaciones

No permitir guardar sin tipo de lista

No permitir guardar sin nombre de lista

No permitir duplicados (mismo ID)

9. Igualar funcionalidad con Prospectos
El subtab Listas Negras en Clientes debe funcionar exactamente igual que:

PROSPECTOS → Editar → Listas Negras

Esto significa:

Misma estructura JSON

Mismo flujo

Mismo guardado

Mismo MERGE

Mismo comportamiento del modal

Mismo renderizado de la tabla

10. Resultado esperado
Después de aplicar este prompt:

Listas Negras guardará correctamente Usuario, Resultado, Observaciones, Tipo de Lista, Nombre de Lista, Fecha/Hora.

Listas Negras cargará correctamente todos los campos.

Ya no aparecerán registros incompletos.

El subtab será consistente con Prospectos.

El módulo Clientes quedará estable y funcional.