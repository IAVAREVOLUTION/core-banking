-- =============================================================================
-- SEED: Plantilla de Carta Oferta para la Línea Global de Garantías NAFIN
--
-- COPIA la plantilla `carta-oferta` que ya tiene el producto de Garantía
-- Financiera 2o Piso (BANOBRAS) y la registra en `LG-NAFIN-001`.
--
-- Se copia en vez de construirse desde cero porque el contenido real del
-- documento vive en `archivoData` (data URL base64 del HTML/PDF que se subió
-- desde el subtab Plantillas). Reescribirlo a mano perdería el formato
-- institucional; copiarlo lo conserva carácter por carácter.
--
-- Qué busca `buscarPlantillaCartaOferta()` (cartaOfertaPDF.ts):
--     tipoPlantilla = 'carta-oferta'  AND  estatus = 'Activo'  AND  archivoData
--
-- NO TOCA el producto de BANOBRAS: sólo lee de él.
--
-- IDEMPOTENTE: quita cualquier `carta-oferta` previa del producto NAFIN antes
-- de insertar, y conserva las plantillas de otros tipos que pudiera tener.
--
-- ⚠️ El TEXTO del documento seguirá siendo el de BANOBRAS: hablará de emisión
--    bursátil, bonos y obra. Es lo que pediste. Para adaptarlo hay dos caminos:
--      · editar el archivo desde Productos → Línea de Crédito → Plantillas, o
--      · usar los placeholders nuevos de Línea Global, ya disponibles:
--        {{PROGRAMA}} {{MODALIDAD_LINEA}} {{TIPO_LINEA_GLOBAL}}
--        {{OPERACIONES_ELEGIBLES}} {{MONTO_MAXIMO_SUBLINEA}}
--        {{NUMERO_INTERMEDIARIO_NAFIN}} {{TIPO_INTERMEDIARIO}}
--        {{ESTATUS_INTERMEDIARIO_NAFIN}} {{FECHA_INCORPORACION_NAFIN}}
--      Recuerde que {{MONTO_EMISION}} es ahora el Monto de Línea Global y
--      {{PORCENTAJE_COBERTURA_GPO}} la Cobertura Máxima.
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

-- ── 0. Diagnóstico: ¿de dónde se va a copiar? ───────────────────────────────
-- Si esto no devuelve filas, el producto BANOBRAS no tiene la plantilla y el
-- UPDATE de abajo no hará nada.
SELECT p.data->>'claveProducto'   AS producto_origen,
       p.data->>'nombreProducto'  AS nombre,
       pl.value->>'nombre'        AS plantilla,
       pl.value->>'tipoPlantilla' AS tipo,
       pl.value->>'estatus'       AS estatus,
       CASE WHEN COALESCE(pl.value->>'archivoData','') = ''
            THEN 'SIN ARCHIVO' ELSE 'con archivo' END AS archivo
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.data->'plantillas','[]'::jsonb)) AS pl(value)
 WHERE p.type = 'ProductoLineaCredito'
   AND pl.value->>'tipoPlantilla' = 'carta-oferta';


-- ── 1. Copiar la plantilla al producto NAFIN ────────────────────────────────
WITH origen AS (
  SELECT pl.value AS plantilla
    FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.data->'plantillas','[]'::jsonb)) AS pl(value)
   WHERE p.type = 'ProductoLineaCredito'
     AND pl.value->>'tipoPlantilla' = 'carta-oferta'
     AND p.data->>'claveProducto' <> 'LG-NAFIN-001'
   -- Preferir la que trae archivo y la del producto de Garantía Financiera;
   -- si hubiera varias, gana la más completa.
   ORDER BY (COALESCE(pl.value->>'archivoData','') <> '') DESC,
            (p.data->>'nombreProducto' ILIKE '%Garant%') DESC,
            (pl.value->>'estatus' = 'Activo') DESC
   LIMIT 1
),
-- Plantillas que YA tiene el producto NAFIN, menos las de carta-oferta
-- (para que volver a correr esto no acumule duplicados).
conservadas AS (
  SELECT COALESCE(jsonb_agg(pl.value), '[]'::jsonb) AS v
    FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.data->'plantillas','[]'::jsonb)) AS pl(value)
   WHERE p.type = 'ProductoLineaCredito'
     AND p.data->>'claveProducto' = 'LG-NAFIN-001'
     AND pl.value->>'tipoPlantilla' <> 'carta-oferta'
),
nueva AS (
  SELECT jsonb_build_object(
           'id',                1,
           'productId',         9001,
           'nombre',            'Carta Oferta Línea Global NAFIN',
           'tipoPlantilla',     'carta-oferta',
           'archivoBase',       COALESCE(plantilla->>'archivoBase', 'carta-oferta-nafin.html'),
           'archivoData',       COALESCE(plantilla->>'archivoData', ''),
           'version',           '1.0',
           'estatus',           'Activo',
           'fechaCreacion',     to_char(now(), 'YYYY-MM-DD'),
           'fechaModificacion', to_char(now(), 'YYYY-MM-DD')
         ) AS v
    FROM origen
)
UPDATE "EFINANCIANET_DB"."J_PRODUCTOS" p
   SET data = p.data || jsonb_build_object(
         'plantillas',
         (SELECT v FROM conservadas) || jsonb_build_array((SELECT v FROM nueva))
       )
 WHERE p.type = 'ProductoLineaCredito'
   AND p.data->>'claveProducto' = 'LG-NAFIN-001'
   AND EXISTS (SELECT 1 FROM nueva);   -- si no hubo origen, no se toca nada


-- ── 2. Verificación ─────────────────────────────────────────────────────────
SELECT p.data->>'claveProducto'   AS producto,
       pl.value->>'nombre'        AS plantilla,
       pl.value->>'tipoPlantilla' AS tipo,
       pl.value->>'estatus'       AS estatus,
       pl.value->>'version'       AS version,
       CASE WHEN COALESCE(pl.value->>'archivoData','') = ''
            THEN '⚠ SIN ARCHIVO — la Carta Oferta fallará'
            ELSE 'con archivo (' || length(pl.value->>'archivoData') || ' bytes)' END AS archivo
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.data->'plantillas','[]'::jsonb)) AS pl(value)
 WHERE p.type = 'ProductoLineaCredito'
   AND p.data->>'claveProducto' = 'LG-NAFIN-001';
