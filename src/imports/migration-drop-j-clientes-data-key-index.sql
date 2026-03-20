-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: DROP J_CLIENTES_data_key index
-- Base de datos: IAVaRevolutions
-- Schema: EFINANCIANET_DB
--
-- PROBLEMA:
--   El indice BTREE "J_CLIENTES_data_key" en la columna JSONB "data"
--   tiene un limite de ~2704 bytes por fila. Cuando el JSON crece
--   (por deep merge de subtabs, campos de formulario, etc.), Postgres
--   rechaza el UPDATE con:
--
--     "index row size 2808 exceeds btree version 4 maximum 2704
--      for index J_CLIENTES_data_key"
--
-- SOLUCION:
--   Eliminar el indice BTREE en la columna JSONB "data".
--   Un indice BTREE en una columna JSONB no tiene sentido operativo:
--   - Los BTREE solo sirven para comparaciones de igualdad/orden en
--     valores escalares, NO para busquedas dentro de un JSON.
--   - Para indexar JSONB se usa GIN (jsonb_ops o jsonb_path_ops).
--   - La tabla J_CLIENTES ya tiene id (uuid PK) para lookups.
--
-- INSTRUCCIONES:
--   1. Abrir Supabase Dashboard → SQL Editor
--   2. Pegar este script completo
--   3. Ejecutar (Run)
--   4. Verificar que ya no aparece el error en la activacion
--
-- IMPACTO: Ninguno. Las queries existentes buscan por id (PK),
-- type, estatus o fields dentro de data via operadores ->> y #>>.
-- Ninguna query hace WHERE data = '...' (que es lo unico que
-- el BTREE index soportaria).
-- ═══════════════════════════════════════════════════════════════════


-- PASO 1: Verificar que el indice existe
-- (descomenta para ver antes de borrar)
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'EFINANCIANET_DB'
--   AND tablename = 'J_CLIENTES'
--   AND indexname ILIKE '%data%';


-- PASO 2: DROP del indice problematico
DROP INDEX IF EXISTS "EFINANCIANET_DB"."J_CLIENTES_data_key";


-- PASO 3: Verificacion post-drop
-- Confirmar que ya no existe:
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'EFINANCIANET_DB'
  AND tablename = 'J_CLIENTES';


-- PASO 4 (OPCIONAL): Si se necesita indexar campos especificos del JSONB,
-- usar GIN o indices parciales. Ejemplo:
--
-- CREATE INDEX IF NOT EXISTS idx_j_clientes_data_gin
--   ON "EFINANCIANET_DB"."J_CLIENTES" USING GIN (data jsonb_path_ops);
--
-- O indices parciales para campos frecuentes:
--
-- CREATE INDEX IF NOT EXISTS idx_j_clientes_nombre
--   ON "EFINANCIANET_DB"."J_CLIENTES" ((data->>'nombre'));
--
-- CREATE INDEX IF NOT EXISTS idx_j_clientes_rfc
--   ON "EFINANCIANET_DB"."J_CLIENTES" ((data->>'rfc'));
