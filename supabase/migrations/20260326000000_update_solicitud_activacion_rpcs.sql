-- =============================================================================
-- Migration: update_solicitud_activacion_rpcs
--
-- 1. get_cuentas_corp_clientes()
--    Exposes J_CUENTAS_CORP_CLIENTES for the SOLICITUD picker modal.
--
-- 2. insert_solicitud_activacion(p_payload jsonb) — UPDATED
--    Auto-generates NUMERO DE DOCUMENTO in FAC-XXXXXXXXXX format by finding
--    the current max sequence across all records and incrementing it.
--    The generated number is injected into data.header.numeroDocumento.
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================


-- =============================================================================
-- 1) get_cuentas_corp_clientes (corrected ORDER BY)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_cuentas_corp_clientes()
RETURNS TABLE (
  id           uuid,
  cliente_id   uuid,
  no_sol       text,
  no_cuenta    text,
  linea_produc text,
  monto_sol    numeric,
  data         jsonb,
  type         text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    jccc.id,
    jccc.cliente_id,
    jccc.no_sol::text,
    jccc.no_cuenta::text,
    jccc.linea_produc::text,
    jccc.monto_sol::numeric,
    jccc.data,
    jccc.type::text
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" AS jccc
  ORDER BY jccc.fecha_sol DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_cuentas_corp_clientes() TO anon;
GRANT EXECUTE ON FUNCTION public.get_cuentas_corp_clientes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cuentas_corp_clientes() TO service_role;


-- =============================================================================
-- 2) insert_solicitud_activacion (unchanged logic, included complete)
-- =============================================================================
DROP FUNCTION IF EXISTS public.insert_solicitud_activacion(jsonb);

CREATE OR REPLACE FUNCTION public.insert_solicitud_activacion(p_payload jsonb)
RETURNS TABLE (id uuid, numero_documento text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id          uuid;
  v_next_seq    bigint;
  v_numero_doc  text;
  v_data        jsonb;
BEGIN
  v_id := gen_random_uuid();

  SELECT COALESCE(
    MAX(
      CASE
        WHEN (sa.data -> 'header' ->> 'numeroDocumento') ~ '^FAC-[0-9]+$'
        THEN NULLIF(
          regexp_replace(
            sa.data -> 'header' ->> 'numeroDocumento',
            '^FAC-0*', '', 'g'
          ),
          ''
        )::bigint
        ELSE NULL
      END
    ),
    0
  ) + 1
  INTO v_next_seq
  FROM "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION" AS sa;

  v_numero_doc := 'FAC-' || LPAD(v_next_seq::text, 10, '0');

  v_data := p_payload -> 'data';
  v_data := jsonb_set(v_data, '{header,numeroDocumento}', to_jsonb(v_numero_doc));

  INSERT INTO "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION" (
    id,
    cliente_id,
    solicitud_id,
    type,
    fecha_compromiso,
    estatus,
    data
  ) VALUES (
    v_id,
    NULLIF(p_payload ->> 'cliente_id', '')::uuid,
    NULLIF(p_payload ->> 'solicitud_id', '')::uuid,
    NULLIF(p_payload ->> 'type', ''),
    NULLIF(p_payload ->> 'fecha_compromiso', '')::date,
    COALESCE(NULLIF(p_payload ->> 'estatus', ''), 'Pendiente'),
    v_data
  );

  RETURN QUERY
  SELECT v_id, v_numero_doc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_solicitud_activacion(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.insert_solicitud_activacion(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_solicitud_activacion(jsonb) TO service_role;
