-- =====================================================================
-- RPCs para J_PRODUCTOS — basado en la estructura REAL:
--   Columnas fisicas: id (uuid), type (varchar), data (jsonb)
--
-- Captación: type = 'Captación' (con acento!)
--   data->>'nombreProducto'  = nombre
--   data->>'claveProducto'   = clave
--   data->>'tipoProducto'    = 'Ahorro'
--   data->>'lineaProducto'   = 'Captacion' (sin acento en data)
--
-- Credito:  type = 'Credito'
--   data->>'nombre'           = nombre
--   data->>'idProducto'       = clave
--   data->>'lineaProducto'    = 'Crédito'
-- =====================================================================


-- 1) get_all_jproductos: retorna TODO
DROP FUNCTION IF EXISTS public.get_all_jproductos();
CREATE OR REPLACE FUNCTION public.get_all_jproductos()
RETURNS TABLE (id uuid, type text, data jsonb)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT p.id, p.type::text, p.data
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  ORDER BY COALESCE(p.data->>'nombreProducto', p.data->>'nombre', '') ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_all_jproductos() TO anon, authenticated, service_role;


-- 2) get_productos_captacion: solo type ILIKE '%Captaci%'
DROP FUNCTION IF EXISTS public.get_productos_captacion();
CREATE OR REPLACE FUNCTION public.get_productos_captacion()
RETURNS TABLE (id uuid, type text, data jsonb)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT p.id, p.type::text, p.data
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  WHERE p.type ILIKE '%Captaci%'
  ORDER BY COALESCE(p.data->>'nombreProducto', p.data->>'nombre', '') ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_productos_captacion() TO anon, authenticated, service_role;


-- 3) get_productos_ahorro: Captación + tipoProducto = 'Ahorro'
DROP FUNCTION IF EXISTS public.get_productos_ahorro();
CREATE OR REPLACE FUNCTION public.get_productos_ahorro()
RETURNS TABLE (id uuid, type text, data jsonb)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT p.id, p.type::text, p.data
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  WHERE p.type ILIKE '%Captaci%'
    AND UPPER(COALESCE(p.data->>'tipoProducto', '')) = 'AHORRO'
  ORDER BY COALESCE(p.data->>'nombreProducto', p.data->>'nombre', '') ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_productos_ahorro() TO anon, authenticated, service_role;


-- 4) get_producto_by_id(p_id TEXT): un producto por UUID
DROP FUNCTION IF EXISTS public.get_producto_by_id(text);
CREATE OR REPLACE FUNCTION public.get_producto_by_id(p_id text)
RETURNS TABLE (id uuid, type text, data jsonb)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT p.id, p.type::text, p.data
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  WHERE p.id = p_id::uuid;
$$;
GRANT EXECUTE ON FUNCTION public.get_producto_by_id(text) TO anon, authenticated, service_role;


-- =====================================================================
-- VERIFICACION
-- =====================================================================
SELECT 'get_all_jproductos' AS rpc, count(*) FROM public.get_all_jproductos();
SELECT 'get_productos_captacion' AS rpc, count(*) FROM public.get_productos_captacion();
SELECT 'get_productos_ahorro' AS rpc, count(*) FROM public.get_productos_ahorro();
SELECT * FROM public.get_productos_captacion();
