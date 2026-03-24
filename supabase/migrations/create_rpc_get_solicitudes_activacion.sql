-- =============================================================================
-- RPC: get_solicitudes_activacion
-- Reads all rows from EFINANCIANET_DB.J_SOLICITUDES_ACTIVACION
-- with LEFT JOINs to J_CLIENTES (via cliente_id) and
-- J_CUENTAS_CORP_CLIENTES (via solicitud_id).
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_solicitudes_activacion()
RETURNS TABLE (
  -- J_SOLICITUDES_ACTIVACION base columns
  id                                  text,
  cliente_id                          text,
  solicitud_id                        text,
  type                                text,
  created_at                          text,   -- actual column name (no fecha_solicitud column)
  fecha_compromiso                    text,
  estatus                             text,
  data                                jsonb,
  -- J_CLIENTES join columns (extracted from data jsonb)
  cliente_nombre                      text,
  cliente_ap_paterno                  text,
  cliente_ap_materno                  text,
  cliente_curp                        text,
  -- J_CUENTAS_CORP_CLIENTES join columns
  solicitud_type                      text,
  solicitud_no_cuenta                 text,
  solicitud_producto_id               text,
  solicitud_fecha_primera_aportacion  text,
  solicitud_monto                     text,
  solicitud_moneda                    text,
  solicitud_tasa_interes              text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    sa.id::text,
    sa.cliente_id::text,
    sa.solicitud_id::text,
    sa.type::text,
    sa.created_at::text,
    CAST(sa.fecha_compromiso AS text),
    sa.estatus::text,
    sa.data,

    COALESCE(
      NULLIF(c.data->>'nombre',                    ''),
      NULLIF(c.data->'default'->>'nombre',          '')
    ) AS cliente_nombre,
    COALESCE(
      NULLIF(c.data->>'apellidoPaterno',            ''),
      NULLIF(c.data->'default'->>'apellidoPaterno', '')
    ) AS cliente_ap_paterno,
    COALESCE(
      NULLIF(c.data->>'apellidoMaterno',            ''),
      NULLIF(c.data->'default'->>'apellidoMaterno', '')
    ) AS cliente_ap_materno,
    COALESCE(
      NULLIF(c.data->>'curp',                       ''),
      NULLIF(c.data->'default'->>'curp',            '')
    ) AS cliente_curp,

    jccc.type::text                              AS solicitud_type,
    jccc.no_cuenta::text                         AS solicitud_no_cuenta,
    jccc.producto_id::text                       AS solicitud_producto_id,
    jccc.fecha_inicio::text                      AS solicitud_fecha_primera_aportacion,
    (jccc.monto_sol::numeric)::text              AS solicitud_monto,
    COALESCE(jccc.data->>'moneda',      '')      AS solicitud_moneda,
    COALESCE(jccc.data->>'tasa_interes','')      AS solicitud_tasa_interes

  FROM "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION" sa
  LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES" c
    ON c.id = sa.cliente_id
  LEFT JOIN "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" jccc
    ON jccc.id = sa.solicitud_id

  ORDER BY sa.created_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_solicitudes_activacion() TO anon;
GRANT EXECUTE ON FUNCTION public.get_solicitudes_activacion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_solicitudes_activacion() TO service_role;

-- =============================================================================
-- RPC: insert_solicitud_activacion
-- =============================================================================

CREATE OR REPLACE FUNCTION public.insert_solicitud_activacion(p_payload jsonb)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := gen_random_uuid();

  INSERT INTO "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION" (
    id,
    cliente_id,
    solicitud_id,
    type,
    fecha_compromiso,
    estatus,
    data
    -- created_at is auto-set by the DB; there is no fecha_solicitud column
  ) VALUES (
    v_id,
    NULLIF(p_payload->>'cliente_id',       '')::uuid,
    NULLIF(p_payload->>'solicitud_id',     '')::uuid,
    NULLIF(p_payload->>'type',             ''),
    NULLIF(p_payload->>'fecha_compromiso', '')::date,
    COALESCE(NULLIF(p_payload->>'estatus', ''), 'Pendiente'),
    p_payload->'data'
  );

  RETURN QUERY SELECT v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_solicitud_activacion(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.insert_solicitud_activacion(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_solicitud_activacion(jsonb) TO service_role;

-- =============================================================================
-- RPC: update_solicitud_activacion
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_solicitud_activacion(p_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"
  SET
    -- created_at is immutable; fecha_solicitud column does not exist
    cliente_id       = COALESCE(NULLIF(p_payload->>'cliente_id',       '')::uuid, cliente_id),
    solicitud_id     = COALESCE(NULLIF(p_payload->>'solicitud_id',     '')::uuid, solicitud_id),
    type             = COALESCE(NULLIF(p_payload->>'type',             ''),       type),
    fecha_compromiso = COALESCE(NULLIF(p_payload->>'fecha_compromiso', '')::date, fecha_compromiso),
    estatus          = COALESCE(NULLIF(p_payload->>'estatus',          ''),       estatus),
    data             = COALESCE(p_payload->'data',                                data)
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_solicitud_activacion(uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.update_solicitud_activacion(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_solicitud_activacion(uuid, jsonb) TO service_role;
