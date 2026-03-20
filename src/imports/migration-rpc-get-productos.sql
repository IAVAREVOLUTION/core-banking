-- =====================================================================
-- Migration: Create RPC functions for J_PRODUCTOS access via PostgREST
-- Date: 2026-02-28
-- DB: IAVaRevolutions  |  Schema: EFINANCIANET_DB
--
-- ┌─────────────────────────────────────────────────────────────────┐
-- │ J_PRODUCTOS tiene SOLO 3 columnas fisicas:                     │
-- │   id   (uuid, NOT NULL)                                        │
-- │   type (varchar, NOT NULL)                                     │
-- │   data (jsonb, NULLABLE)                                       │
-- │                                                                │
-- │ Todo lo demas esta en el JSONB "data":                         │
-- │   data->>'nombre', data->>'claveProducto',                     │
-- │   data->>'lineaProducto', data->>'tipoProducto',               │
-- │   data->>'tasa', data->>'montoMinimo', etc.                    │
-- └─────────────────────────────────────────────────────────────────┘
--
-- INSTRUCCIONES:
--   1. Abrir Supabase -> SQL Editor
--   2. Pegar TODO este archivo
--   3. Ejecutar (Run)
--   4. Verificar con las queries al final
-- =====================================================================


-- =====================================================================
-- RPC 1: get_all_jproductos()
-- Retorna TODOS los productos sin filtro
-- =====================================================================
DROP FUNCTION IF EXISTS public.get_all_jproductos();

CREATE OR REPLACE FUNCTION public.get_all_jproductos()
RETURNS TABLE (
  id    uuid,
  type  text,
  data  jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.type::text,
    p.data
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  ORDER BY p.data->>'nombre' NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_jproductos() TO anon;
GRANT EXECUTE ON FUNCTION public.get_all_jproductos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_jproductos() TO service_role;


-- =====================================================================
-- RPC 2: get_productos_captacion()
-- Retorna productos donde data->>'lineaProducto' = 'CAPTACION'
-- (o data->>'linea_produc' como variante de clave)
-- Si el JSONB no tiene esa clave, incluye el registro (fallback seguro)
-- =====================================================================
DROP FUNCTION IF EXISTS public.get_productos_captacion();

CREATE OR REPLACE FUNCTION public.get_productos_captacion()
RETURNS TABLE (
  id    uuid,
  type  text,
  data  jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.type::text,
    p.data
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  WHERE UPPER(COALESCE(p.data->>'lineaProducto', p.data->>'linea_produc', '')) = 'CAPTACION'
     OR NOT (p.data ? 'lineaProducto' OR p.data ? 'linea_produc')
  ORDER BY p.data->>'nombre' NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_productos_captacion() TO anon;
GRANT EXECUTE ON FUNCTION public.get_productos_captacion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_productos_captacion() TO service_role;


-- =====================================================================
-- RPC 3: get_productos_ahorro()
-- Retorna productos de Captacion + Ahorro
-- Filtra por JSONB keys; si no existen, incluye (fallback seguro)
-- =====================================================================
DROP FUNCTION IF EXISTS public.get_productos_ahorro();

CREATE OR REPLACE FUNCTION public.get_productos_ahorro()
RETURNS TABLE (
  id    uuid,
  type  text,
  data  jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.type::text,
    p.data
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  WHERE (
    UPPER(COALESCE(p.data->>'lineaProducto', p.data->>'linea_produc', '')) = 'CAPTACION'
    OR NOT (p.data ? 'lineaProducto' OR p.data ? 'linea_produc')
  )
  AND (
    UPPER(COALESCE(p.data->>'tipoProducto', p.data->>'tipo_produc', '')) = 'AHORRO'
    OR NOT (p.data ? 'tipoProducto' OR p.data ? 'tipo_produc')
  )
  ORDER BY p.data->>'nombre' NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_productos_ahorro() TO anon;
GRANT EXECUTE ON FUNCTION public.get_productos_ahorro() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_productos_ahorro() TO service_role;


-- =====================================================================
-- VERIFICACION
-- =====================================================================
-- SELECT * FROM public.get_all_jproductos() LIMIT 10;
-- SELECT * FROM public.get_productos_captacion() LIMIT 10;
-- SELECT * FROM public.get_productos_ahorro() LIMIT 10;
--
-- Para ver las claves JSONB de cada producto:
-- SELECT id, jsonb_object_keys(data) AS key
-- FROM "EFINANCIANET_DB"."J_PRODUCTOS" LIMIT 20;
--
-- Si J_PRODUCTOS esta vacia, inserte productos de prueba:
--
-- INSERT INTO "EFINANCIANET_DB"."J_PRODUCTOS" (type, data) VALUES
--   ('PRODUCTO', '{"nombre":"Ahorro Basico","claveProducto":"AH-001","lineaProducto":"CAPTACION","tipoProducto":"Ahorro","tasa":3.5,"montoMinimo":500,"estatus":"Activo"}'::jsonb),
--   ('PRODUCTO', '{"nombre":"Ahorro Plus","claveProducto":"AH-002","lineaProducto":"CAPTACION","tipoProducto":"Ahorro","tasa":5.0,"montoMinimo":5000,"estatus":"Activo"}'::jsonb),
--   ('PRODUCTO', '{"nombre":"Ahorro Empresarial","claveProducto":"AH-003","lineaProducto":"CAPTACION","tipoProducto":"Ahorro","tasa":6.5,"montoMinimo":25000,"estatus":"Activo"}'::jsonb),
--   ('PRODUCTO', '{"nombre":"Ahorro Infantil","claveProducto":"AH-004","lineaProducto":"CAPTACION","tipoProducto":"Ahorro","tasa":4.0,"montoMinimo":100,"estatus":"Activo"}'::jsonb),
--   ('PRODUCTO', '{"nombre":"Cuenta Ahorro Negocio","claveProducto":"AH-005","lineaProducto":"CAPTACION","tipoProducto":"Ahorro","tasa":4.5,"montoMinimo":1000,"estatus":"Activo"}'::jsonb);
-- =====================================================================
