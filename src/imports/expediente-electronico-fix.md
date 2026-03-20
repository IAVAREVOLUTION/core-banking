1. Problema real detectado
En el subtab Expedientes Electrónicos, tanto en:

Módulo Prospecto → Editar → Expedientes Electrónicos

Módulo Clientes → Editar → Expedientes Electrónicos

se presentan los mismos fallos:

❌ Fallo 1 — El sistema web busca archivos en rutas incorrectas
Ejemplo de ruta que usa el frontend:

Código
residencia/constancia_1772496994099_qz29h592.png
❌ Fallo 2 — Esa ruta NO existe en Supabase Storage
Los archivos reales se suben desde la app móvil a:

Código
bucket="make-7e2d13d9-expedientes-electronicos-prospectos"
path="expedientes-electronicos/prospectos/<UUID>/<ARCHIVO>"
❌ Fallo 3 — El frontend ignora el bucket y path reales guardados en la BD
Por eso aparece:

“Verifique que el archivo exista en los buckets de Supabase Storage.”

❌ Fallo 4 — El diseño y comportamiento NO coinciden entre Prospectos y Clientes
El subtab debe ser idéntico en ambos módulos.

2. Regla institucional obligatoria
El sistema web debe usar EXACTAMENTE el bucket y path que vienen desde la BD.

No debe:

Inventar rutas

Anteponer carpetas como /residencia/

Cambiar carpetas

Cambiar el bucket

Reemplazar el path

Asumir rutas fijas

3. JSON institucional correcto que DEBE guardarse en la BD
Cada expediente debe guardarse así en:

Código
data.expedientesElectronicos[]
json
{
  "id": "<TIMESTAMP>",
  "nombre": "<NOMBRE_ARCHIVO>",
  "mime": "<MIME_TYPE>",
  "tamanoKB": "<TAMANO>",
  "fechaCarga": "<FECHA>",
  "storageBucket": "make-7e2d13d9-expedientes-electronicos-prospectos",
  "storagePath": "expedientes-electronicos/prospectos/<UUID>/<ARCHIVO>",
  "tipoDocumento": "<TIPO_DOCUMENTO>"
}
Reglas:
storageBucket debe venir desde la app móvil o backend.

storagePath debe ser EXACTAMENTE el path real en Supabase.

El frontend NO debe modificarlo.

4. Cómo debe construir el sistema web la URL final
Supabase usa este formato:

Código
https://<PROJECT>.supabase.co/storage/v1/object/public/<BUCKET>/<PATH>
El sistema web debe hacer:

Código
url = SUPABASE_URL + "/storage/v1/object/public/" + storageBucket + "/" + storagePath
Ejemplo real:

Código
https://<PROJECT>.supabase.co/storage/v1/object/public/make-7e2d13d9-expedientes-electronicos-prospectos/expedientes-electronicos/prospectos/a7a310fd-9216-4ec7-bee8-bf496948b08d/1772497193103_EN-ESTE-ORDEN-ESTUDIARIA-SI-EMPEZARA-HOY-DESDE-0.pdf
5. Corrección institucional del frontend (Prospectos + Clientes)
❌ Hoy el frontend hace algo así:
Código
/residencia/<archivo>
✔ Debe hacer esto:
Código
const url = `${SUPABASE_URL}/storage/v1/object/public/${storageBucket}/${storagePath}`;
✔ Y debe leerlo desde el JSON:
Código
storageBucket = expediente.storageBucket
storagePath   = expediente.storagePath
6. Guardado institucional en la tabla J_CLIENTES
6.1 Leer JSON actual
sql
SELECT data
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
6.2 Agregar el expediente al array
sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET data = jsonb_set(
      data,
      '{expedientesElectronicos}',
      COALESCE(data->'expedientesElectronicos', '[]'::jsonb) || '<OBJETO_EXPEDIENTE>'::jsonb
    )
WHERE id = '<ID_CLIENTE>';
7. Carga institucional del subtab
sql
SELECT data->'expedientesElectronicos'
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = '<ID_CLIENTE>';
Reglas:
Si existe → mostrarlo completo

Si no existe → inicializar como []

No reconstruir

No borrar

8. Igualar funcionalidad entre Prospectos y Clientes
El subtab Expedientes Electrónicos debe ser idéntico en:

Diseño

Campos

Modal

Validaciones

Guardado

Carga

Visualización

Construcción de URL

Manejo de bucket y path

9. Resultado esperado
Después de aplicar este prompt:

Los expedientes electrónicos se mostrarán correctamente en Prospectos y Clientes.

El sistema web dejará de buscar rutas inexistentes.

Los archivos subidos desde la app móvil se visualizarán sin errores.

El subtab será consistente en ambos módulos.

El módulo quedará alineado con Supabase Storage.