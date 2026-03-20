-- =====================================================================
-- RPC: public.insert_cuenta_ahorro()
-- Base de datos: IAVaRevolutions
-- Schema: EFINANCIANET_DB
-- Tabla: J_CUENTAS_CORP_CLIENTES
--
-- OBJETIVO:
--   Inserta una nueva cuenta de ahorro en J_CUENTAS_CORP_CLIENTES.
--   Recibe todos los campos relevantes como parametros y retorna
--   la fila insertada completa (incluyendo el id generado).
--
-- IMPORTANTE:
--   - linea_produc y tipo_produc se incluyen como parametros para
--     que la RPC get_cuentas_ahorro (que filtra por estos campos)
--     pueda devolver la cuenta recien creada.
--   - p_cliente_id se recibe como TEXT y se castea a UUID internamente.
--   - p_producto_id se recibe como TEXT y se castea a UUID internamente.
--   - p_cta_eje_chec se recibe como BOOLEAN (la columna es BOOLEAN).
--   - Tipos correctos: DATE (no TIMESTAMPTZ), MONEY (no NUMERIC)
--   - J_PRODUCTOS solo tiene: id, type, data (jsonb) — no tiene columna descripcion
--
-- INSTRUCCIONES:
--   1. Abrir Supabase -> SQL Editor
--   2. Pegar TODO este archivo
--   3. Ejecutar (Run)
--   4. Verificar con la query de VERIFICACION al final
-- =====================================================================


-- =====================================================================
-- PASO 1: DROP de funcion previa (evita conflictos de firma)
-- =====================================================================
DROP FUNCTION IF EXISTS public.insert_cuenta_ahorro(
  TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB
);


-- =====================================================================
-- PASO 2: CREATE — Inserta una cuenta de ahorro
-- =====================================================================
CREATE OR REPLACE FUNCTION public.insert_cuenta_ahorro(
  p_no_sol          TEXT,
  p_no_cuenta       TEXT,
  p_no_referenc1    TEXT        DEFAULT NULL,
  p_fecha_sol       TIMESTAMPTZ DEFAULT NOW(),
  p_fecha_autori    TIMESTAMPTZ DEFAULT NULL,
  p_fecha_disper    TIMESTAMPTZ DEFAULT NULL,
  p_fecha_cancel    TIMESTAMPTZ DEFAULT NULL,
  p_fecha_inicio    TIMESTAMPTZ DEFAULT NULL,
  p_fecha_fin_cu    TIMESTAMPTZ DEFAULT NULL,
  p_descripcion     TEXT        DEFAULT NULL,
  p_linea_produc    TEXT        DEFAULT 'CAPTACION',
  p_tipo_produc     TEXT        DEFAULT 'Ahorro',
  p_producto_id     TEXT        DEFAULT NULL,
  p_producto_eje    TEXT        DEFAULT NULL,
  p_cliente_id      TEXT        DEFAULT NULL,
  p_monto_sol       NUMERIC     DEFAULT 0,
  p_monto_aut       NUMERIC     DEFAULT 0,
  p_monto_disp      NUMERIC     DEFAULT 0,
  p_cta_eje_chec    BOOLEAN     DEFAULT FALSE,
  p_fases           TEXT        DEFAULT NULL,
  p_data            JSONB       DEFAULT '{}'::JSONB
)
RETURNS TABLE (
  id              UUID,
  type            TEXT,
  no_sol          TEXT,
  no_cuenta       TEXT,
  no_referenc1    TEXT,
  fecha_sol       TIMESTAMPTZ,
  fecha_autori    TIMESTAMPTZ,
  fecha_disper    TIMESTAMPTZ,
  fecha_cancel    TIMESTAMPTZ,
  fecha_inicio    TIMESTAMPTZ,
  fecha_fin_cu    TIMESTAMPTZ,
  descripcion     TEXT,
  linea_produc    TEXT,
  tipo_produc     TEXT,
  producto_id     UUID,
  producto_eje    TEXT,
  cliente_id      UUID,
  saldo_actual    NUMERIC,
  monto_sol       NUMERIC,
  monto_aut       NUMERIC,
  monto_disp      NUMERIC,
  estatus_disp    TEXT,
  estatus_sol     TEXT,
  estatus_cart    TEXT,
  estatus_cuen    TEXT,
  cta_eje_chec    BOOLEAN,
  fases           TEXT,
  data            JSONB,
  cliente_nombre  TEXT,
  producto_nombre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_id UUID;
  v_producto_id UUID := NULL;
  v_cliente_id  UUID := NULL;
BEGIN
  -- Castear TEXT a UUID (si se proporcionan)
  IF p_producto_id IS NOT NULL AND p_producto_id <> '' THEN
    v_producto_id := p_producto_id::UUID;
  END IF;
  IF p_cliente_id IS NOT NULL AND p_cliente_id <> '' THEN
    v_cliente_id := p_cliente_id::UUID;
  END IF;

  -- INSERT
  INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
    type,
    no_sol,
    no_cuenta,
    no_referenc1,
    fecha_sol,
    fecha_autori,
    fecha_disper,
    fecha_cancel,
    fecha_inicio,
    fecha_fin_cu,
    descripcion,
    linea_produc,
    tipo_produc,
    producto_id,
    producto_eje,
    cliente_id,
    saldo_actual,
    monto_sol,
    monto_aut,
    monto_disp,
    estatus_disp,
    estatus_sol,
    estatus_cart,
    estatus_cuen,
    cta_eje_chec,
    fases,
    data
  ) VALUES (
    'CAPTACION',
    p_no_sol,
    p_no_cuenta,
    p_no_referenc1,
    p_fecha_sol,
    p_fecha_autori,
    p_fecha_disper,
    p_fecha_cancel,
    p_fecha_inicio,
    p_fecha_fin_cu,
    p_descripcion,
    COALESCE(p_linea_produc, 'CAPTACION'),
    COALESCE(p_tipo_produc, 'Ahorro'),
    v_producto_id,
    p_producto_eje,
    v_cliente_id,
    0,
    p_monto_sol,
    p_monto_aut,
    p_monto_disp,
    'Pendiente',
    CASE WHEN p_cta_eje_chec THEN 'Aprobada' ELSE 'Pendiente' END,
    CASE WHEN p_cta_eje_chec THEN 'Vigente'  ELSE 'Activa'    END,
    'Activa',
    p_cta_eje_chec,
    p_fases,
    p_data
  )
  RETURNING "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES".id INTO v_new_id;

  -- Retornar la fila insertada con JOINs resueltos
  RETURN QUERY
  SELECT
    c.id,
    c.type,
    c.no_sol,
    c.no_cuenta,
    c.no_referenc1,
    c.fecha_sol,
    c.fecha_autori,
    c.fecha_disper,
    c.fecha_cancel,
    c.fecha_inicio,
    c.fecha_fin_cu,
    c.descripcion,
    c.linea_produc,
    c.tipo_produc,
    c.producto_id,
    c.producto_eje,
    c.cliente_id,
    c.saldo_actual,
    c.monto_sol,
    c.monto_aut,
    c.monto_disp,
    c.estatus_disp,
    c.estatus_sol,
    c.estatus_cart,
    c.estatus_cuen,
    c.cta_eje_chec,
    c.fases,
    c.data,
    -- Resolver nombre del cliente
    COALESCE(
      NULLIF(
        TRIM(
          COALESCE(cl.data->>'nombre', '') || ' ' ||
          COALESCE(cl.data->>'apellidoPaterno', '') || ' ' ||
          COALESCE(cl.data->>'apellidoMaterno', '')
        ),
        ''
      ),
      cl.data->>'razonSocial',
      c.cliente_id::TEXT
    ) AS cliente_nombre,
    -- Resolver nombre del producto
    COALESCE(
      pr.data->>'nombre',
      pr.data->>'nombreProducto',
      c.producto_id::TEXT
    ) AS producto_nombre
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
  LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES" cl
    ON cl.id = c.cliente_id
  LEFT JOIN "EFINANCIANET_DB"."J_PRODUCTOS" pr
    ON pr.id = c.producto_id
  WHERE c.id = v_new_id;
END;
$$;


-- =====================================================================
-- PASO 3: GRANTS
-- =====================================================================
GRANT EXECUTE ON FUNCTION public.insert_cuenta_ahorro(
  TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB
) TO anon, authenticated, service_role;


-- =====================================================================
-- VERIFICACION
-- =====================================================================
-- SELECT * FROM public.insert_cuenta_ahorro(
--   p_no_sol       := 'TEST-SOL-001',
--   p_no_cuenta    := '0126123456',
--   p_cta_eje_chec := true,
--   p_cliente_id   := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- );
-- =====================================================================