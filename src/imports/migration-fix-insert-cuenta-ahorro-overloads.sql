-- =====================================================================
-- FIX: Eliminar TODAS las sobrecargas de insert_cuenta_ahorro
-- y recrear UNA SOLA versión con tipos correctos (DATE, MONEY)
--
-- PROBLEMA: PostgREST no puede resolver cuál de las 3 versiones usar:
--   - insert_cuenta_ahorro(...TIMESTAMPTZ...)  ← versión vieja
--   - insert_cuenta_ahorro(...DATE...)          ← versión nueva
--   - insert_cuenta_ahorro(...TEXT...)           ← versión fantasma
--
-- SOLUCIÓN: DROP de todas las sobrecargas y CREATE de una sola.
--
-- INSTRUCCIONES:
--   1. Abrir Supabase → SQL Editor
--   2. Pegar TODO este archivo
--   3. Ejecutar (Run)
-- =====================================================================


-- ═══════════════════════════════════════════════════════
-- PASO 1: DROP de TODAS las sobrecargas conocidas
-- ═══════════════════════════════════════════════════════

-- Versión con TIMESTAMPTZ (vieja)
DROP FUNCTION IF EXISTS public.insert_cuenta_ahorro(
  TEXT, TEXT, TEXT,
  TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TIMESTAMPTZ,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  NUMERIC, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, JSONB
);

-- Versión con DATE (nueva)
DROP FUNCTION IF EXISTS public.insert_cuenta_ahorro(
  TEXT, TEXT, TEXT,
  DATE, DATE, DATE, DATE,
  DATE, DATE,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  NUMERIC, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, JSONB
);

-- Versión sin linea_produc/tipo_produc (muy vieja, 19 params)
DROP FUNCTION IF EXISTS public.insert_cuenta_ahorro(
  TEXT, TEXT, TEXT,
  TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TIMESTAMPTZ,
  TEXT, TEXT, TEXT, TEXT, TEXT,
  NUMERIC, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, JSONB
);

-- Catch-all: cualquier otra versión con nombre insert_cuenta_ahorro
-- (PostgreSQL permite DROP sin firma si es única, pero con sobrecargas no)
-- Si las anteriores no cubrieron todas, este DO block las limpia
DO $$
DECLARE
  func_oid OID;
BEGIN
  FOR func_oid IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'insert_cuenta_ahorro'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.insert_cuenta_ahorro(' ||
      pg_get_function_identity_arguments(func_oid) || ')';
    RAISE NOTICE 'Dropped overload: %', pg_get_function_identity_arguments(func_oid);
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════
-- PASO 2: CREATE — Una sola versión con tipos correctos
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.insert_cuenta_ahorro(
  p_no_sol          TEXT,
  p_no_cuenta       TEXT,
  p_no_referenc1    TEXT     DEFAULT NULL,
  p_fecha_sol       TEXT     DEFAULT NULL,
  p_fecha_autori    TEXT     DEFAULT NULL,
  p_fecha_disper    TEXT     DEFAULT NULL,
  p_fecha_cancel    TEXT     DEFAULT NULL,
  p_fecha_inicio    TEXT     DEFAULT NULL,
  p_fecha_fin_cu    TEXT     DEFAULT NULL,
  p_descripcion     TEXT     DEFAULT NULL,
  p_linea_produc    TEXT     DEFAULT 'CAPTACION',
  p_tipo_produc     TEXT     DEFAULT 'Ahorro',
  p_producto_id     TEXT     DEFAULT NULL,
  p_producto_eje    TEXT     DEFAULT NULL,
  p_cliente_id      TEXT     DEFAULT NULL,
  p_monto_sol       NUMERIC  DEFAULT 0,
  p_monto_aut       NUMERIC  DEFAULT 0,
  p_monto_disp      NUMERIC  DEFAULT 0,
  p_cta_eje_chec    BOOLEAN  DEFAULT FALSE,
  p_fases           TEXT     DEFAULT NULL,
  p_data            JSONB    DEFAULT '{}'::JSONB
)
RETURNS TABLE (
  id UUID, type VARCHAR, no_sol VARCHAR, no_cuenta VARCHAR,
  no_referenc1 VARCHAR, fecha_sol DATE, fecha_autori DATE,
  fecha_disper DATE, fecha_cancel DATE, fecha_inicio DATE,
  fecha_fin_cu DATE, descripcion VARCHAR, linea_produc VARCHAR,
  tipo_produc VARCHAR, producto_id UUID, producto_eje UUID,
  cliente_id UUID, saldo_actual MONEY, monto_sol MONEY,
  monto_aut MONEY, monto_disp MONEY, estatus_disp VARCHAR,
  estatus_sol VARCHAR, estatus_cart VARCHAR, estatus_cuen VARCHAR,
  cta_eje_chec BOOLEAN, fases VARCHAR, data JSONB,
  cliente_nombre TEXT, producto_nombre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_id      UUID;
  v_producto_id UUID := NULL;
  v_producto_eje UUID := NULL;
  v_cliente_id  UUID := NULL;
  v_fecha_sol   DATE := CURRENT_DATE;
  v_fecha_autori DATE := NULL;
  v_fecha_disper DATE := NULL;
  v_fecha_cancel DATE := NULL;
  v_fecha_inicio DATE := NULL;
  v_fecha_fin_cu DATE := NULL;
BEGIN
  -- Castear TEXT a UUID (si se proporcionan)
  IF p_producto_id IS NOT NULL AND p_producto_id <> '' THEN
    v_producto_id := p_producto_id::UUID;
  END IF;
  IF p_producto_eje IS NOT NULL AND p_producto_eje <> '' THEN
    v_producto_eje := p_producto_eje::UUID;
  END IF;
  IF p_cliente_id IS NOT NULL AND p_cliente_id <> '' THEN
    v_cliente_id := p_cliente_id::UUID;
  END IF;

  -- Castear TEXT a DATE (acepta ISO strings o YYYY-MM-DD)
  IF p_fecha_sol IS NOT NULL AND p_fecha_sol <> '' THEN
    v_fecha_sol := p_fecha_sol::DATE;
  END IF;
  IF p_fecha_autori IS NOT NULL AND p_fecha_autori <> '' THEN
    v_fecha_autori := p_fecha_autori::DATE;
  END IF;
  IF p_fecha_disper IS NOT NULL AND p_fecha_disper <> '' THEN
    v_fecha_disper := p_fecha_disper::DATE;
  END IF;
  IF p_fecha_cancel IS NOT NULL AND p_fecha_cancel <> '' THEN
    v_fecha_cancel := p_fecha_cancel::DATE;
  END IF;
  IF p_fecha_inicio IS NOT NULL AND p_fecha_inicio <> '' THEN
    v_fecha_inicio := p_fecha_inicio::DATE;
  END IF;
  IF p_fecha_fin_cu IS NOT NULL AND p_fecha_fin_cu <> '' THEN
    v_fecha_fin_cu := p_fecha_fin_cu::DATE;
  END IF;

  INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
    type, no_sol, no_cuenta, no_referenc1,
    fecha_sol, fecha_autori, fecha_disper, fecha_cancel,
    fecha_inicio, fecha_fin_cu, descripcion,
    linea_produc, tipo_produc,
    producto_id, producto_eje, cliente_id,
    saldo_actual, monto_sol, monto_aut, monto_disp,
    estatus_disp, estatus_sol, estatus_cart, estatus_cuen,
    cta_eje_chec, fases, data
  ) VALUES (
    'CAPTACION', p_no_sol, p_no_cuenta, p_no_referenc1,
    v_fecha_sol, v_fecha_autori, v_fecha_disper, v_fecha_cancel,
    v_fecha_inicio, v_fecha_fin_cu, p_descripcion,
    COALESCE(p_linea_produc, 'CAPTACION'),
    COALESCE(p_tipo_produc, 'Ahorro'),
    v_producto_id, v_producto_eje, v_cliente_id,
    0::MONEY, p_monto_sol::MONEY, p_monto_aut::MONEY, p_monto_disp::MONEY,
    'Pendiente',
    CASE WHEN p_cta_eje_chec THEN 'Autorizado' ELSE 'Pendiente' END,
    'Activa',
    'Activa',
    p_cta_eje_chec, p_fases, p_data
  )
  RETURNING "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES".id INTO v_new_id;

  RETURN QUERY
  SELECT c.id, c.type, c.no_sol, c.no_cuenta, c.no_referenc1,
    c.fecha_sol, c.fecha_autori, c.fecha_disper, c.fecha_cancel,
    c.fecha_inicio, c.fecha_fin_cu, c.descripcion,
    c.linea_produc, c.tipo_produc,
    c.producto_id, c.producto_eje, c.cliente_id,
    c.saldo_actual, c.monto_sol, c.monto_aut, c.monto_disp,
    c.estatus_disp, c.estatus_sol, c.estatus_cart, c.estatus_cuen,
    c.cta_eje_chec, c.fases, c.data,
    COALESCE(
      NULLIF(TRIM(
        COALESCE(cl.data->>'nombre', '') || ' ' ||
        COALESCE(cl.data->>'apellidoPaterno', '') || ' ' ||
        COALESCE(cl.data->>'apellidoMaterno', '')
      ), ''),
      cl.data->>'razonSocial',
      c.cliente_id::TEXT
    )::TEXT,
    COALESCE(
      pr.data->>'nombreProducto',
      pr.data->>'nombre',
      c.producto_id::TEXT
    )::TEXT
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
  LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES" cl ON cl.id = c.cliente_id
  LEFT JOIN "EFINANCIANET_DB"."J_PRODUCTOS" pr ON pr.id = c.producto_id
  WHERE c.id = v_new_id;
END;
$$;


-- ═══════════════════════════════════════════════════════
-- PASO 3: GRANTS
-- ═══════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.insert_cuenta_ahorro(
  TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  NUMERIC, NUMERIC, NUMERIC,
  BOOLEAN, TEXT, JSONB
) TO anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════
-- VERIFICACIÓN: debería haber exactamente 1 función
-- ═══════════════════════════════════════════════════════
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'insert_cuenta_ahorro';
-- Resultado esperado: exactamente 1 fila
