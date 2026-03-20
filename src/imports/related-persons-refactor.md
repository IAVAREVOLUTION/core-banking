1. Objetivo
Corregir el subtab Personas Relacionadas dentro del módulo Clientes, para que:

Cargue correctamente las personas relacionadas del cliente actual.

Guarde correctamente nuevas relaciones.

Edite y elimine relaciones sin perder información.

El modal “Nuevo” liste los clientes existentes (autoconsulta).

Se respete la estructura JSON y la relación par_cliente_id.

No se pierdan datos al guardar.

2. Estructura institucional de la relación
La tabla real:

sql
EFINANCIANET_DB."J_CLIENTES"
incluye:

sql
par_cliente_id uuid NULL REFERENCES J_CLIENTES(id)
Esto significa:

Cada cliente puede tener una persona relacionada principal (relación 1–1).

Si necesitas múltiples relaciones, deben guardarse en el JSON data.personasRelacionadas[].

Regla institucional:  
El subtab debe manejar ambas cosas:

Relación física → par_cliente_id

Relación lógica → data.personasRelacionadas[]

3. Carga institucional del subtab
Cuando el usuario abra:

Clientes → Editar → Personas Relacionadas

el sistema debe ejecutar:

3.1 Cargar relación física
sql
SELECT par_cliente_id
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = <ID_CLIENTE>;
3.2 Cargar relación lógica (JSON)
sql
SELECT data->'personasRelacionadas' AS personasRelacionadas
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = <ID_CLIENTE>;
3.3 Reglas
Si personasRelacionadas es NULL → inicializar como [].

Si par_cliente_id existe → mostrarlo como relación principal.

El subtab debe mostrar ambas fuentes.

4. Modal “Nueva Persona Relacionada”
El modal debe mostrar una lista de clientes existentes.

4.1 Consulta institucional
sql
SELECT 
  id,
  data->>'nombre' AS nombre,
  data->>'apellidoPaterno' AS apellidoPaterno,
  data->>'apellidoMaterno' AS apellidoMaterno,
  data->>'rfc' AS rfc,
  data->>'curp' AS curp
FROM "EFINANCIANET_DB"."J_CLIENTES"
ORDER BY data->>'nombre';
4.2 Reglas
El modal debe autollamarse a sí mismo (consulta a la misma tabla).

No debe filtrar por tipo (Clientes/Prospectos) a menos que tú lo pidas.

Debe permitir seleccionar cualquier cliente como persona relacionada.

5. Guardado institucional de una nueva relación
Cuando el usuario presione Guardar en el modal:

5.1 Actualizar relación física (si aplica)
sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET par_cliente_id = '<ID_RELACIONADO>'
WHERE id = '<ID_CLIENTE>';
5.2 Actualizar relación lógica (JSON)
Leer JSON actual:

sql
SELECT data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = <ID_CLIENTE>;
Construir JSON parcial:

json
{
  "personasRelacionadas": [
    {
      "id": "<ID_RELACIONADO>",
      "nombre": "<NOMBRE>",
      "apellidoPaterno": "<AP_PATERNO>",
      "apellidoMaterno": "<AP_MATERNO>",
      "tipoRelacion": "<TIPO_RELACION>",
      "fechaRegistro": "<FECHA>"
    }
  ]
}
MERGE JSON:

sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET data = data || '<JSON_PARCIAL>'::jsonb
WHERE id = '<ID_CLIENTE>';
Reglas del MERGE
No borrar nodos existentes.

No reemplazar arrays completos.

Agregar solo el nuevo elemento.

6. Edición de una persona relacionada
6.1 Cargar array completo
sql
SELECT data->'personasRelacionadas'
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = <ID_CLIENTE>;
6.2 Reemplazar solo el elemento editado
Identificar por id.

Reemplazar solo ese nodo.

Mantener los demás intactos.

7. Eliminación de una persona relacionada
7.1 Eliminar del array JSON
Quitar solo el elemento cuyo id coincida.

No borrar el array completo.

7.2 Si era la relación física
sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET par_cliente_id = NULL
WHERE id = '<ID_CLIENTE>';
8. Validaciones institucionales
No permitir relacionar un cliente consigo mismo.

No permitir duplicados en personasRelacionadas[].

No permitir ciclos (A → B y B → A) si no lo deseas.

No permitir relaciones con clientes eliminados.

9. Resultado esperado
Después de aplicar este prompt:

El subtab cargará correctamente todas las personas relacionadas.

El modal “Nuevo” mostrará la lista de clientes desde la misma tabla.

Las relaciones se guardarán correctamente en par_cliente_id y en data.personasRelacionadas[].

Las ediciones y eliminaciones funcionarán sin perder datos.

El módulo quedará consistente, estable y funcional.