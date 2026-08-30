-- =============================================================================
-- RPC: J_CORP_FIN — Solicitudes de financiamiento corporativo de una Oportunidad
--
-- El esquema "EFINANCIANET_DB" no está expuesto a PostgREST con GRANT directo
-- (J_CLIENTES, J_SOLICITUDES_ACTIVACION, etc. responden 42501). El acceso va
-- por funciones SECURITY DEFINER en public, igual que el resto del Core.
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

-- =============================================================================
-- RPC: get_corp_fin
-- Devuelve las solicitudes corporativas. Si p_cotizacion_id viene NULL,
-- devuelve todas; si viene con valor, filtra por esa Oportunidad.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_corp_fin(p_cotizacion_id uuid DEFAULT NULL)
RETURNS TABLE (
  id              text,
  cotizacion_id   text,
  cliente_id      text,
  folio           text,
  type            text,
  estatus         text,
  monto           text,
  moneda          text,
  fecha_solicitud text,
  created_at      text,
  updated_at      text,
  data            jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    cf.id::text,
    cf.cotizacion_id::text,
    cf.cliente_id::text,
    cf.folio::text,
    cf.type::text,
    cf.estatus::text,
    (cf.monto::numeric)::text,
    cf.moneda::text,
    CAST(cf.fecha_solicitud AS text),
    cf.created_at::text,
    cf.updated_at::text,
    cf.data
  FROM "EFINANCIANET_DB"."J_CORP_FIN" cf
  WHERE p_cotizacion_id IS NULL
     OR cf.cotizacion_id = p_cotizacion_id
  ORDER BY cf.created_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_corp_fin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_corp_fin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_corp_fin(uuid) TO service_role;


-- =============================================================================
-- RPC: insert_corp_fin
-- Si no viene folio, lo genera consecutivo con formato CF-000001.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.insert_corp_fin(p_payload jsonb)
RETURNS TABLE (id uuid, folio text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id    uuid;
  v_folio text;
BEGIN
  v_id := gen_random_uuid();

  v_folio := NULLIF(p_payload->>'folio', '');

  IF v_folio IS NULL THEN
    -- Consecutivo sobre los folios con formato CF-XXXXXX ya existentes.
    SELECT 'CF-' || LPAD(
             (COALESCE(MAX(NULLIF(regexp_replace(cf.folio, '\D', '', 'g'), ''))::bigint, 0) + 1)::text,
             6, '0')
      INTO v_folio
      FROM "EFINANCIANET_DB"."J_CORP_FIN" cf
     WHERE cf.folio ~ '^CF-[0-9]+$';

    v_folio := COALESCE(v_folio, 'CF-000001');
  END IF;

  INSERT INTO "EFINANCIANET_DB"."J_CORP_FIN" (
    id, cotizacion_id, cliente_id, folio, type,
    estatus, monto, moneda, fecha_solicitud, data
  ) VALUES (
    v_id,
    NULLIF(p_payload->>'cotizacion_id', '')::uuid,
    NULLIF(p_payload->>'cliente_id',    '')::uuid,
    v_folio,
    NULLIF(p_payload->>'type',          ''),
    COALESCE(NULLIF(p_payload->>'estatus', ''), 'Pendiente'),
    COALESCE(NULLIF(p_payload->>'monto', '')::numeric, 0),
    COALESCE(NULLIF(p_payload->>'moneda', ''), 'MXN'),
    COALESCE(NULLIF(p_payload->>'fecha_solicitud', '')::date, CURRENT_DATE),
    COALESCE(p_payload->'data', '{}'::jsonb)
  );

  RETURN QUERY SELECT v_id, v_folio;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_corp_fin(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.insert_corp_fin(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_corp_fin(jsonb) TO service_role;


-- =============================================================================
-- RPC: update_corp_fin
-- Merge parcial: lo que no venga en el payload conserva su valor actual.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_corp_fin(p_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE "EFINANCIANET_DB"."J_CORP_FIN"
  SET
    cotizacion_id   = COALESCE(NULLIF(p_payload->>'cotizacion_id',   '')::uuid,    cotizacion_id),
    cliente_id      = COALESCE(NULLIF(p_payload->>'cliente_id',      '')::uuid,    cliente_id),
    folio           = COALESCE(NULLIF(p_payload->>'folio',           ''),          folio),
    type            = COALESCE(NULLIF(p_payload->>'type',            ''),          type),
    estatus         = COALESCE(NULLIF(p_payload->>'estatus',         ''),          estatus),
    monto           = COALESCE(NULLIF(p_payload->>'monto',           '')::numeric, monto),
    moneda          = COALESCE(NULLIF(p_payload->>'moneda',          ''),          moneda),
    fecha_solicitud = COALESCE(NULLIF(p_payload->>'fecha_solicitud', '')::date,    fecha_solicitud),
    data            = COALESCE(p_payload->'data',                                  data)
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_corp_fin(uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.update_corp_fin(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_corp_fin(uuid, jsonb) TO service_role;


-- =============================================================================
-- RPC: delete_corp_fin
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_corp_fin(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM "EFINANCIANET_DB"."J_CORP_FIN" WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_corp_fin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.delete_corp_fin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_corp_fin(uuid) TO service_role;
