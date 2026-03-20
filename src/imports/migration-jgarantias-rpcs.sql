-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN COMPLETA: Tabla + RPCs para J_GARANTIAS
-- Ejecutar en Supabase SQL Editor (base: IAVaRevolutions)
-- Schema: EFINANCIANET_DB
--
-- INSTRUCCIONES:
--   1. Abrir Supabase → SQL Editor
--   2. Pegar TODO este archivo
--   3. Ejecutar (Run)
--   4. Verificar con la query de VERIFICACIÓN al final
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- PASO 0: Crear la tabla si no existe
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_GARANTIAS" (
  uuid            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garantia        VARCHAR(50),
  tipo            VARCHAR(30),
  subtipo         VARCHAR(30),
  descripcion     TEXT,
  ubicacion       TEXT,
  valor_nominal   NUMERIC(14,2),
  fecha_registro  TIMESTAMP DEFAULT now(),
  cliente_id      UUID REFERENCES "EFINANCIANET_DB"."J_CLIENTES"(id) ON DELETE SET NULL,
  data            JSONB DEFAULT '{}'::JSONB
);


-- ═══════════════════════════════════════════════════════════════════
-- PASO 1: DROP de funciones previas (evita conflictos de firma)
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_all_jgarantias();
DROP FUNCTION IF EXISTS public.insert_jgarantia(VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, NUMERIC, DATE, UUID, JSONB);
DROP FUNCTION IF EXISTS public.insert_jgarantia(VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, NUMERIC, TIMESTAMP, UUID, JSONB);
DROP FUNCTION IF EXISTS public.update_jgarantia(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, NUMERIC, UUID, JSONB);
DROP FUNCTION IF EXISTS public.update_jgarantia(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, NUMERIC, UUID, JSONB);
DROP FUNCTION IF EXISTS public.delete_jgarantia(UUID);


-- ═══════════════════════════════════════════════════════════════════
-- PASO 2: SELECT ALL — Retorna todas las garantías
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_all_jgarantias()
RETURNS SETOF "EFINANCIANET_DB"."J_GARANTIAS"
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM "EFINANCIANET_DB"."J_GARANTIAS"
  ORDER BY fecha_registro DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_jgarantias()
  TO anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════
-- PASO 3: INSERT — Inserta una garantía y retorna el registro
-- Usa LANGUAGE sql (mismo patrón que insert_jcotizacion)
-- Tipos TEXT para descripcion/ubicacion (compatibles con lo que
-- envía el JS client via PostgREST)
-- ═══════════════════════════════════════════════════════════════════
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
RETURNS "EFINANCIANET_DB"."J_GARANTIAS"
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO "EFINANCIANET_DB"."J_GARANTIAS"
    (uuid, garantia, tipo, subtipo, descripcion,
     ubicacion, valor_nominal, fecha_registro, cliente_id, data)
  VALUES
    (gen_random_uuid(), p_garantia, p_tipo, p_subtipo, p_descripcion,
     p_ubicacion, p_valor_nominal, p_fecha_registro, p_cliente_id, p_data)
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.insert_jgarantia(VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, NUMERIC, TIMESTAMP, UUID, JSONB)
  TO anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════
-- PASO 4: UPDATE — Actualiza una garantía por UUID
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_jgarantia(
  p_uuid           UUID,
  p_garantia       VARCHAR(50)   DEFAULT NULL,
  p_tipo           VARCHAR(30)   DEFAULT NULL,
  p_subtipo        VARCHAR(30)   DEFAULT NULL,
  p_descripcion    TEXT          DEFAULT NULL,
  p_ubicacion      TEXT          DEFAULT NULL,
  p_valor_nominal  NUMERIC       DEFAULT NULL,
  p_cliente_id     UUID          DEFAULT NULL,
  p_data           JSONB         DEFAULT NULL
)
RETURNS "EFINANCIANET_DB"."J_GARANTIAS"
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE "EFINANCIANET_DB"."J_GARANTIAS"
  SET
    garantia      = COALESCE(p_garantia,      garantia),
    tipo          = COALESCE(p_tipo,          tipo),
    subtipo       = COALESCE(p_subtipo,       subtipo),
    descripcion   = COALESCE(p_descripcion,   descripcion),
    ubicacion     = COALESCE(p_ubicacion,     ubicacion),
    valor_nominal = COALESCE(p_valor_nominal, valor_nominal),
    cliente_id    = COALESCE(p_cliente_id,    cliente_id),
    data          = COALESCE(p_data,          data)
  WHERE uuid = p_uuid
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.update_jgarantia(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, NUMERIC, UUID, JSONB)
  TO anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════
-- PASO 5: DELETE — Elimina una garantía por UUID
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_jgarantia(p_uuid UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM "EFINANCIANET_DB"."J_GARANTIAS"
  WHERE uuid = p_uuid
  RETURNING uuid;
$$;

GRANT EXECUTE ON FUNCTION public.delete_jgarantia(UUID)
  TO anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — Ejecutar después para confirmar que todo existe
-- ═══════════════════════════════════════════════════════════════════

-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('get_all_jgarantias', 'insert_jgarantia', 'update_jgarantia', 'delete_jgarantia');
-- Debe retornar 4 filas.

-- SELECT * FROM public.get_all_jgarantias();
-- Debe retornar 0 filas (tabla vacía) o las garantías existentes.
