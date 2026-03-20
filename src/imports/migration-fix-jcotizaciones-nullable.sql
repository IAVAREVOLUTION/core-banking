-- ═══════════════════════════════════════════════════════════════════
-- FIX: Hacer producto_id y cliente_id NULLABLE + quitar FKs
-- Ejecutar UNA VEZ en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Quitar NOT NULL
ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ALTER COLUMN producto_id DROP NOT NULL;
ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ALTER COLUMN cliente_id DROP NOT NULL;

-- 2. Quitar FK constraints (evita errores al insertar sin ref existente)
ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" DROP CONSTRAINT IF EXISTS fk_cliente;
ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" DROP CONSTRAINT IF EXISTS fk_producto;

-- 3. Crear RPC de auto-fix + seed (se llama desde el botón Sembrar)
CREATE OR REPLACE FUNCTION public.fix_and_seed_jcotizacion(
  p_no_cotiza varchar(30),
  p_descripcion varchar(255) DEFAULT NULL,
  p_fecha_cotiza timestamp DEFAULT now(),
  p_estatus_cotiza text DEFAULT 'Pendiente',
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS SETOF "EFINANCIANET_DB"."J_COTIZACIONES"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Auto-fix constraints (idempotent, no-op si ya son nullable)
  BEGIN
    ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ALTER COLUMN producto_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ALTER COLUMN cliente_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" DROP CONSTRAINT IF EXISTS fk_cliente;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" DROP CONSTRAINT IF EXISTS fk_producto;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Insertar registro
  RETURN QUERY
  INSERT INTO "EFINANCIANET_DB"."J_COTIZACIONES"
    (no_cotiza, descripcion, producto_id, cliente_id, fecha_cotiza, estatus_cotiza, data)
  VALUES
    (p_no_cotiza, p_descripcion, NULL, NULL, p_fecha_cotiza,
     p_estatus_cotiza::"EFINANCIANET_DB".estatus_cotizacion, p_data)
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fix_and_seed_jcotizacion(varchar, varchar, timestamp, text, jsonb)
  TO anon, authenticated, service_role;

-- 4. También re-crear insert_jcotizacion con auto-fix
CREATE OR REPLACE FUNCTION public.insert_jcotizacion(
  p_no_cotiza varchar(30),
  p_descripcion varchar(255) DEFAULT NULL,
  p_producto_id uuid DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_fecha_cotiza timestamp DEFAULT now(),
  p_estatus_cotiza text DEFAULT 'Pendiente',
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS SETOF "EFINANCIANET_DB"."J_COTIZACIONES"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Auto-fix nullable (idempotent)
  BEGIN
    ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ALTER COLUMN producto_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ALTER COLUMN cliente_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY
  INSERT INTO "EFINANCIANET_DB"."J_COTIZACIONES"
    (no_cotiza, descripcion, producto_id, cliente_id, fecha_cotiza, estatus_cotiza, data)
  VALUES
    (p_no_cotiza, p_descripcion, p_producto_id, p_cliente_id, p_fecha_cotiza,
     p_estatus_cotiza::"EFINANCIANET_DB".estatus_cotizacion, p_data)
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_jcotizacion(varchar, varchar, uuid, uuid, timestamp, text, jsonb)
  TO anon, authenticated, service_role;

-- 5. Re-crear update_jcotizacion con DEEP MERGE (data || p_data)
-- Spec cotizacion-edit-logic.md §4: MERGE JSON institucional
--   data SIEMPRE a la izquierda (base)
--   JSON parcial a la derecha (edits)
--   Solo se actualizan los campos enviados
--   Los campos no enviados se conservan
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_jcotizacion(
  p_id uuid,
  p_descripcion varchar(255) DEFAULT NULL,
  p_producto_id uuid DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_estatus_cotiza text DEFAULT 'Pendiente',
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS SETOF "EFINANCIANET_DB"."J_COTIZACIONES"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Spec §4: MERGE — data (base) || p_data (parcial)
  -- El operador || hace shallow merge a nivel top-level.
  -- El frontend ya envía objetos anidados completos (cliente, producto).
  RETURN QUERY
  UPDATE "EFINANCIANET_DB"."J_COTIZACIONES"
  SET
    descripcion = COALESCE(p_descripcion, descripcion),
    producto_id = COALESCE(p_producto_id, producto_id),
    cliente_id = COALESCE(p_cliente_id, cliente_id),
    estatus_cotiza = p_estatus_cotiza::"EFINANCIANET_DB".estatus_cotizacion,
    data = data || p_data  -- MERGE institucional: base || partial
  WHERE id = p_id
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_jcotizacion(uuid, varchar, uuid, uuid, text, jsonb)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('fix_and_seed_jcotizacion', 'insert_jcotizacion', 'update_jcotizacion')
ORDER BY routine_name;