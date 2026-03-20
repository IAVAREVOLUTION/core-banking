-- ═══════════════════════════════════════════════════════════════════
-- HOTFIX: insert_jgarantia — FIX INSERT que no genera registros
-- Ejecutar en Supabase SQL Editor (base: IAVaRevolutions)
--
-- PROBLEMAS CORREGIDOS:
--   1. gen_random_uuid() explícito en VALUES falla con search_path=''
--      → FIX: Omitir columna uuid, dejar que DEFAULT la genere
--   2. FK en cliente_id puede rechazar INSERT si el cliente es local
--      → FIX: DROP FK constraint (cliente_id sigue siendo UUID)
--
-- INSTRUCCIONES:
--   1. Abrir Supabase → SQL Editor
--   2. Pegar TODO este archivo
--   3. Ejecutar (Run)
--   4. Probar crear una garantía desde la app
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- PASO 1: DROP FK constraint en cliente_id (si existe)
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Intenta eliminar cualquier FK que referencie J_CLIENTES
  ALTER TABLE "EFINANCIANET_DB"."J_GARANTIAS"
    DROP CONSTRAINT IF EXISTS "J_GARANTIAS_cliente_id_fkey";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK constraint no encontrada o ya eliminada: %', SQLERRM;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- PASO 2: Recrear insert_jgarantia SIN gen_random_uuid() explícito
-- Mismo patrón que insert_jcotizacion (que SÍ funciona)
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.insert_jgarantia(VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, NUMERIC, TIMESTAMP, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.insert_jgarantia(
  p_garantia       VARCHAR(50),
  p_tipo           VARCHAR(30),
  p_subtipo        VARCHAR(30),
  p_descripcion    TEXT          DEFAULT NULL,
  p_ubicacion      TEXT          DEFAULT NULL,
  p_valor_nominal  NUMERIC       DEFAULT NULL,
  p_fecha_registro TIMESTAMP     DEFAULT now(),
  p_cliente_id     UUID          DEFAULT NULL,
  p_data           JSONB         DEFAULT '{}'::JSONB
)
RETURNS SETOF "EFINANCIANET_DB"."J_GARANTIAS"
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO "EFINANCIANET_DB"."J_GARANTIAS"
    (garantia, tipo, subtipo, descripcion,
     ubicacion, valor_nominal, fecha_registro, cliente_id, data)
  VALUES
    (p_garantia, p_tipo, p_subtipo, p_descripcion,
     p_ubicacion, p_valor_nominal, p_fecha_registro, p_cliente_id, p_data)
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.insert_jgarantia(VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, NUMERIC, TIMESTAMP, UUID, JSONB)
  TO anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — Ejecutar manualmente para confirmar
-- ═══════════════════════════════════════════════════════════════════

-- Test 1: Ver que la función existe
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name = 'insert_jgarantia';

-- Test 2: Insertar una garantía de prueba (sin cliente_id para evitar FK)
-- SELECT * FROM public.insert_jgarantia(
--   'TEST-001', 'Hipotecaria', 'Inmueble', 'Prueba hotfix', 'CDMX',
--   100000, now(), NULL, '{"default":{"test":true}}'::jsonb
-- );

-- Test 3: Verificar que se insertó
-- SELECT * FROM public.get_all_jgarantias();
