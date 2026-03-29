-- =============================================================================
-- RPC: activar_cuenta_financiera
--
-- Updates J_CUENTAS_CORP_CLIENTES for the given record id:
--   estatus_sol   → 'Formalizado'
--   estatus_cart  → 'Activo'
--   estatus_cuen  → 'Activo'
--   estatus_dip   → 'Autorizado'
--   monto_disp    → p_monto
--   monto_aut     → p_monto
--
-- Returns the number of rows affected (should be 1 on success).
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

CREATE OR REPLACE FUNCTION public.activar_cuenta_financiera(
  p_solicitud_id uuid,
  p_monto        numeric
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
  SET
    estatus_sol   = 'Formalizado',
    estatus_cart  = 'Activo',
    estatus_cuen  = 'Activo',
    estatus_disp  = 'Autorizado',
    monto_disp    = p_monto,
    monto_aut     = p_monto
  WHERE id = p_solicitud_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activar_cuenta_financiera(uuid, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.activar_cuenta_financiera(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activar_cuenta_financiera(uuid, numeric) TO service_role;
