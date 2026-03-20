-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN ADICIONAL: RPCs de ESCRITURA para J_COTIZACIONES
-- Necesarias porque PostgREST NO expone el schema EFINANCIANET_DB
-- (error PGRST106: "Only public, graphql_public are exposed")
--
-- Ejecutar en Supabase SQL Editor DESPUÉS de migration-jcotizaciones.sql
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- 1. INSERT — Inserta una cotización y retorna el registro completo
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.insert_jcotizacion(
  p_no_cotiza varchar(30),
  p_descripcion varchar(255) DEFAULT NULL,
  p_producto_id uuid DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_fecha_cotiza timestamp DEFAULT now(),
  p_estatus_cotiza text DEFAULT 'Pendiente',
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS "EFINANCIANET_DB"."J_COTIZACIONES"
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO "EFINANCIANET_DB"."J_COTIZACIONES"
    (no_cotiza, descripcion, producto_id, cliente_id, fecha_cotiza, estatus_cotiza, data)
  VALUES
    (p_no_cotiza, p_descripcion, p_producto_id, p_cliente_id, p_fecha_cotiza,
     p_estatus_cotiza::"EFINANCIANET_DB".estatus_cotizacion, p_data)
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.insert_jcotizacion(varchar, varchar, uuid, uuid, timestamp, text, jsonb)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 2. UPDATE — Actualiza una cotización por ID, retorna el registro
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_jcotizacion(
  p_id uuid,
  p_descripcion varchar(255) DEFAULT NULL,
  p_producto_id uuid DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_estatus_cotiza text DEFAULT 'Pendiente',
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS "EFINANCIANET_DB"."J_COTIZACIONES"
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE "EFINANCIANET_DB"."J_COTIZACIONES"
  SET descripcion = p_descripcion,
      producto_id = p_producto_id,
      cliente_id = p_cliente_id,
      estatus_cotiza = p_estatus_cotiza::"EFINANCIANET_DB".estatus_cotizacion,
      data = p_data
  WHERE id = p_id
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.update_jcotizacion(uuid, varchar, uuid, uuid, text, jsonb)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 3. DELETE — Elimina una cotización por ID, retorna el UUID
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_jcotizacion(p_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM "EFINANCIANET_DB"."J_COTIZACIONES"
  WHERE id = p_id
  RETURNING id;
$$;

GRANT EXECUTE ON FUNCTION public.delete_jcotizacion(uuid)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════
-- Ejecutar después de crear las RPCs:

-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('get_all_jcotizaciones', 'insert_jcotizacion', 'update_jcotizacion', 'delete_jcotizacion');
-- Debe retornar 4 filas.
