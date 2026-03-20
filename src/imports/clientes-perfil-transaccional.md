Módulo: CLIENTES → Editar → Perfil Transaccional
Igual funcionalidad que: PROSPECTOS → Editar → Perfil Transaccional
Tabla real: EFINANCIANET_DB."J_PRODUCTOS"
Campo donde se guarda: data (jsonb) dentro de J_CLIENTES
1. Problema real detectado
En el modal “Nuevo Perfil Transaccional”:

El catálogo de productos solo muestra productos de línea CAPTACIÓN.

No aparecen productos de tipo ProductoLineaCredito ni Credito.

El diseño debe ser igual al de Prospecto, pero no lo es.

El formulario no está cargando correctamente el catálogo completo.

Esto significa que:

La consulta actual está filtrando incorrectamente por type = 'CAPTACION',

O está leyendo un catálogo hardcodeado,

O no está leyendo el campo type de J_PRODUCTOS.

2. Reglas institucionales para cargar el catálogo de productos
El catálogo del modal “Nuevo Perfil Transaccional” debe cargar TODOS los productos registrados en:

Código
EFINANCIANET_DB."J_PRODUCTOS"
sin filtrar por línea de producto, excepto cuando el usuario seleccione un filtro.

Consulta institucional correcta:
sql
SELECT 
  id,
  type,
  data->>'nombreProducto' AS nombreProducto,
  data->>'lineaProducto' AS lineaProducto,
  data->>'tipoProducto' AS tipoProducto,
  data->>'claveProducto' AS claveProducto
FROM "EFINANCIANET_DB"."J_PRODUCTOS"
ORDER BY data->>'nombreProducto';
Reglas:
NO filtrar por CAPTACIÓN.

NO filtrar por tipo a menos que el usuario lo pida.

NO hardcodear líneas de producto.

Debe mostrar:

CAPTACIÓN

ProductoLineaCredito

Crédito

Cualquier otro que exista en la tabla

3. Estructura JSON que debe guardarse en el Perfil Transaccional
Cuando el usuario guarde un nuevo perfil, el sistema debe construir un objeto JSON completo:

json
{
  "id": "<TIMESTAMP>",
  "productoId": "<ID_PRODUCTO>",
  "nombreProducto": "<NOMBRE_PRODUCTO>",
  "lineaProducto": "<LINEA_PRODUCTO>",
  "tipoProducto": "<TIPO_PRODUCTO>",
  "claveProducto": "<CLAVE_PRODUCTO>",
  "montoMaximo": "<MONTO_MAXIMO>",
  "frecuencia": "<FRECUENCIA>",
  "canal": "<CANAL>",
  "usuarioRegistro": "<USUARIO_LOGUEADO>",
  "fechaRegistro": "<FECHA_HORA>"
}
Reglas:
NO guardar solo el ID.

NO guardar un objeto vacío.

NO guardar sin línea de producto.

NO guardar sin tipo de producto.

NO guardar sin clave de producto.

NO guardar sin usuario ni fecha.

4. Guardado institucional en J_CLIENTES
4.1 Leer JSON actual
sql
SELECT data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
4.2 Agregar el nuevo perfil al array
sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET data = jsonb_set(
      data,
      '{perfilTransaccional}',
      COALESCE(data->'perfilTransaccional', '[]'::jsonb) || '<OBJETO_PERFIL>'::jsonb
    )
WHERE id = '<ID_CLIENTE>';
5. Carga institucional del subtab
sql
SELECT data->'perfilTransaccional'
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
Reglas:
Si existe → mostrarlo completo

Si no existe → inicializar como []

No borrar ni reconstruir

6. Igualar funcionalidad con Prospectos
El subtab Perfil Transaccional en Clientes debe funcionar exactamente igual que:

PROSPECTOS → Editar → Perfil Transaccional

Esto incluye:

Mismo diseño

Mismo catálogo

Mismo guardado

Mismo MERGE JSON

Mismo comportamiento del modal

Mismo renderizado de la tabla

7. Resultado esperado
Después de aplicar este prompt:

El modal “Nuevo Perfil Transaccional” mostrará todos los productos:

CAPTACIÓN

ProductoLineaCredito

Crédito

Cualquier otro que exista

El subtab guardará correctamente el perfil transaccional.

El subtab cargará correctamente los perfiles guardados.

El módulo Clientes quedará alineado con Prospectos.

El catálogo dejará de estar limitado a CAPTACIÓN.