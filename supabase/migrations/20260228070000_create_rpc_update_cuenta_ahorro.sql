-- =====================================================================
-- RPC: update_cuenta_ahorro
-- Actualiza un registro en EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES"
-- UUIDs recibidos como TEXT, casteados internamente con ::UUID
-- cta_eje_chec es BOOLEAN nativo
-- data se hace JSON MERGE (preserva claves existentes)
-- =====================================================================

DROP FUNCTION IF EXISTS public.update_cuenta_ahorro(
  text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, numeric, numeric, numeric, numeric,
  text, text, text, text, boolean, text, jsonb
);

CREATE OR REPLACE FUNCTION public.update_cuenta_ahorro(
  p_id             text,
  p_no_sol         text        DEFAULT NULL,
  p_no_cuenta      text        DEFAULT NULL,
  p_no_referenc1   text        DEFAULT NULL,
  p_fecha_sol      text        DEFAULT NULL,
  p_fecha_autori   text        DEFAULT NULL,
  p_fecha_disper   text        DEFAULT NULL,
  p_fecha_cancel   text        DEFAULT NULL,
  p_fecha_inicio   text        DEFAULT NULL,
  p_fecha_fin_cu   text        DEFAULT NULL,
  p_descripcion    text        DEFAULT NULL,
  p_producto_id    text        DEFAULT NULL,
  p_producto_eje   text        DEFAULT NULL,
  p_cliente_id     text        DEFAULT NULL,
  p_saldo_actual   numeric     DEFAULT NULL,
  p_monto_sol      numeric     DEFAULT NULL,
  p_monto_aut      numeric     DEFAULT NULL,
  p_monto_disp     numeric     DEFAULT NULL,
  p_estatus_disp   text        DEFAULT NULL,
  p_estatus_sol    text        DEFAULT NULL,
  p_estatus_cart   text        DEFAULT NULL,
  p_estatus_cuen   text        DEFAULT NULL,
  p_cta_eje_chec   boolean     DEFAULT NULL,
  p_fases          text        DEFAULT NULL,
  p_data_partial   jsonb       DEFAULT NULL
)
RETURNS SETOF "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
  SET
    no_sol         = COALESCE(p_no_sol,         no_sol),
    no_cuenta      = COALESCE(p_no_cuenta,      no_cuenta),
    no_referenc1   = COALESCE(p_no_referenc1,   no_referenc1),
    fecha_sol      = COALESCE(p_fecha_sol::date, fecha_sol),
    fecha_autori   = CASE WHEN p_fecha_autori IS NOT NULL THEN p_fecha_autori::date ELSE fecha_autori END,
    fecha_disper   = CASE WHEN p_fecha_disper IS NOT NULL THEN p_fecha_disper::date ELSE fecha_disper END,
    fecha_cancel   = CASE WHEN p_fecha_cancel IS NOT NULL THEN p_fecha_cancel::date ELSE fecha_cancel END,
    fecha_inicio   = CASE WHEN p_fecha_inicio IS NOT NULL THEN p_fecha_inicio::date ELSE fecha_inicio END,
    fecha_fin_cu   = CASE WHEN p_fecha_fin_cu IS NOT NULL THEN p_fecha_fin_cu::date ELSE fecha_fin_cu END,
    descripcion    = COALESCE(p_descripcion,    descripcion),
    producto_id    = CASE WHEN p_producto_id IS NOT NULL THEN p_producto_id::uuid ELSE producto_id END,
    producto_eje   = CASE WHEN p_producto_eje IS NOT NULL THEN p_producto_eje::uuid ELSE producto_eje END,
    cliente_id     = CASE WHEN p_cliente_id   IS NOT NULL THEN p_cliente_id::uuid   ELSE cliente_id   END,
    saldo_actual   = CASE WHEN p_saldo_actual IS NOT NULL THEN p_saldo_actual::money ELSE saldo_actual END,
    monto_sol      = CASE WHEN p_monto_sol    IS NOT NULL THEN p_monto_sol::money    ELSE monto_sol    END,
    monto_aut      = CASE WHEN p_monto_aut    IS NOT NULL THEN p_monto_aut::money    ELSE monto_aut    END,
    monto_disp     = CASE WHEN p_monto_disp   IS NOT NULL THEN p_monto_disp::money   ELSE monto_disp   END,
    estatus_disp   = COALESCE(p_estatus_disp,   estatus_disp),
    estatus_sol    = COALESCE(p_estatus_sol,    estatus_sol),
    estatus_cart   = COALESCE(p_estatus_cart,   estatus_cart),
    estatus_cuen   = COALESCE(p_estatus_cuen,   estatus_cuen),
    cta_eje_chec   = COALESCE(p_cta_eje_chec,  cta_eje_chec),
    fases          = COALESCE(p_fases,          fases),
    -- JSON MERGE: preserva claves existentes, sobreescribe las que vienen en p_data_partial
    data           = CASE
                       WHEN p_data_partial IS NOT NULL THEN COALESCE(data, '{}'::jsonb) || p_data_partial
                       ELSE data
                     END
  WHERE id = p_id::uuid;

  RETURN QUERY
    SELECT *
    FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
    WHERE id = p_id::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_cuenta_ahorro(
  text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, numeric, numeric, numeric, numeric,
  text, text, text, text, boolean, text, jsonb
) TO anon, authenticated, service_role;
