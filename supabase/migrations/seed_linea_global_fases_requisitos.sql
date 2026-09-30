-- =============================================================================
-- SEED: Fases y Requisitos de la LÍNEA GLOBAL DE GARANTÍAS NAFIN
--
-- Sólo toca el producto padre (`LG-NAFIN-001`). Las dos SubLíneas quedan como
-- están: la Automática sin fases y la Selectiva con las suyas.
--
-- Agrega:
--   · 5 fases — Integración de Expediente, Evaluación, Autorización,
--     Instrumentación, Liberación
--   · 1 requisito por fase, TOMADO DEL CATÁLOGO REAL (`J_CATALOGOS`
--     type='Documento', activos). No se inventan documentos: se leen de la BD y
--     se copia su `clave`, su `nombre` y su `promptIA`, que es lo que la
--     validación con IA del Expediente necesita para funcionar.
--
-- CÓMO ELIGE LOS DOCUMENTOS
--   Toma los 5 primeros documentos activos ordenados por clave, uno por fase.
--   Es una asignación posicional: determinista y sin repetidos, pero ARBITRARIA
--   en cuanto al contenido. La idea es dejar el flujo operable; si quiere un
--   documento concreto en cada fase, reasígnelo desde el subtab "Requisitos OK"
--   del producto — ahí el combo ya sale de este mismo catálogo.
--
--   Si el catálogo tiene menos de 5 documentos activos, se generan sólo las
--   fases que alcanzaron requisito; el SELECT final lo muestra.
--
-- IDEMPOTENTE: reemplaza por completo `fases` y `expedientes` del producto, así
-- que se puede volver a correr sin acumular renglones.
--
-- REQUISITO PREVIO: haber corrido `seed_productos_nafin_sublineas.sql`.
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

WITH cat AS (
  -- Documentos activos del catálogo, en orden estable.
  SELECT
    COALESCE(data->>'clave', '')  AS clave,
    COALESCE(data->>'nombre', '') AS nombre,
    -- `promptIA` puede venir como texto plano o como objeto anidado; se toma
    -- el texto cuando lo es y se deja vacío cuando no, igual que extractPromptIA().
    CASE WHEN jsonb_typeof(data->'promptIA') = 'string'
         THEN data->>'promptIA' ELSE '' END AS prompt_ia,
    ROW_NUMBER() OVER (ORDER BY data->>'clave') AS rn
  FROM "EFINANCIANET_DB"."J_CATALOGOS"
  WHERE type = 'Documento'
    AND COALESCE(data->>'activo', 'true') <> 'false'
    AND COALESCE(data->>'nombre', '') <> ''
),
fases(seq, fase, area) AS (
  VALUES
    (1, 'Integración de Expediente', 'Promoción'),
    (2, 'Evaluación',                'Riesgos'),
    (3, 'Autorización',              'Comité'),
    (4, 'Instrumentación',           'Jurídico'),
    (5, 'Liberación',                'Operaciones')
),
asignado AS (
  -- Un documento por fase, por posición. INNER JOIN a propósito: una fase sin
  -- documento disponible no genera un requisito vacío.
  SELECT f.seq, f.fase, f.area, c.clave, c.nombre, c.prompt_ia
  FROM fases f
  JOIN cat c ON c.rn = f.seq
),
nuevas_fases AS (
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id',         seq,
             'fase',       fase,
             'numeroFase', seq,
             'seq',        seq,
             'posicion',   seq::text,
             'area',       area
           ) ORDER BY seq), '[]'::jsonb) AS v
  FROM fases
),
nuevos_requisitos AS (
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id',             seq,
             'tipo',           'Documento',
             'claveDocumento', clave,
             'descripcion',    nombre,
             'obligatorio',    true,
             'persona',        'Ambas',
             'fase',           fase,
             'formato',        'PDF',
             'area',           area,
             'promptIA',       prompt_ia
           ) ORDER BY seq), '[]'::jsonb) AS v
  FROM asignado
)
UPDATE "EFINANCIANET_DB"."J_PRODUCTOS" p
   SET data = p.data
            || jsonb_build_object('fases',       (SELECT v FROM nuevas_fases))
            || jsonb_build_object('expedientes', (SELECT v FROM nuevos_requisitos))
 WHERE p.type = 'ProductoLineaCredito'
   AND p.data->>'claveProducto' = 'LG-NAFIN-001';


-- ── Verificación: qué fases y qué documento quedó en cada una ────────────────
SELECT
  e.value->>'fase'           AS fase,
  e.value->>'claveDocumento' AS clave_doc,
  e.value->>'descripcion'    AS documento,
  CASE WHEN COALESCE(e.value->>'promptIA','') = '' THEN 'sin prompt' ELSE 'con prompt IA' END AS ia
FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
CROSS JOIN LATERAL jsonb_array_elements(p.data->'expedientes') AS e(value)
WHERE p.type = 'ProductoLineaCredito'
  AND p.data->>'claveProducto' = 'LG-NAFIN-001'
ORDER BY (e.value->>'id')::int;

-- Resumen de los tres productos.
SELECT data->>'claveProducto' AS clave,
       data->>'nombreProducto' AS nombre,
       jsonb_array_length(COALESCE(data->'fases','[]'::jsonb))       AS fases,
       jsonb_array_length(COALESCE(data->'expedientes','[]'::jsonb)) AS requisitos,
       jsonb_array_length(COALESCE(data->'paquetes','[]'::jsonb))    AS prods_disposicion
  FROM "EFINANCIANET_DB"."J_PRODUCTOS"
 WHERE data->>'claveProducto' IN ('LG-NAFIN-001','SUBLC-AUT','SUBLC-SEL')
 ORDER BY clave;
