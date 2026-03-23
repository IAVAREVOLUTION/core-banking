-- ============================================================
-- RPC: update_fase_solicitud
-- Actualiza SOLO los campos de fase usando JSONB merge operator (||)
-- NO sobreescribe el resto del JSONB data — solo hace patch del header.
--
-- Entidad: Fin_Corp_Accnt → J_CUENTAS_CORP_CLIENTES
-- Campos actualizados:
--   - fases         (NoFaseActual — columna top-level varchar)
--   - estatus_sol   (EstatusSolicitud — si se proporciona)
--   - data->solicitud->header->fase_id
--   - data->solicitud->header->descripcion_fase  (FaseActual)
--   - data->solicitud->header->area_actual       (AreaActual)
-- ============================================================

CREATE OR REPLACE FUNCTION update_fase_solicitud(
  p_id              uuid,
  p_fase_id         text,
  p_descripcion_fase text,
  p_area_actual     text    DEFAULT NULL,
  p_estatus_sol     text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = EFINANCIANET_DB, public
AS $$
BEGIN
  UPDATE "J_CUENTAS_CORP_CLIENTES"
  SET
    -- NoFaseActual como columna plana
    fases       = p_fase_id,
    -- EstatusSolicitud — solo si se proporciona
    estatus_sol = COALESCE(p_estatus_sol, estatus_sol),
    -- JSONB merge: solo actualiza los tres campos del header, preserva el resto
    data = data ||
      jsonb_build_object(
        'solicitud',
        COALESCE(data -> 'solicitud', '{}'::jsonb) ||
        jsonb_build_object(
          'header',
          COALESCE(data -> 'solicitud' -> 'header', '{}'::jsonb) ||
          jsonb_build_object(
            'fase_id',          p_fase_id,
            'descripcion_fase', p_descripcion_fase,
            'area_actual',      COALESCE(p_area_actual, '')
          )
        )
      )
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_fase_solicitud TO anon;
GRANT EXECUTE ON FUNCTION update_fase_solicitud TO authenticated;
GRANT EXECUTE ON FUNCTION update_fase_solicitud TO service_role;


-- ============================================================
-- RPC: get_notas_solicitud
-- Devuelve las notas de una solicitud para validar "Regresar de Fase"
-- (nota creada en los últimos 30 minutos)
-- ============================================================

CREATE OR REPLACE FUNCTION get_notas_solicitud(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = EFINANCIANET_DB, public
AS $$
DECLARE
  v_notas jsonb;
BEGIN
  SELECT COALESCE(data -> 'solicitud' -> 'notas', '[]'::jsonb)
  INTO v_notas
  FROM "J_CUENTAS_CORP_CLIENTES"
  WHERE id = p_id;

  RETURN COALESCE(v_notas, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_notas_solicitud TO anon;
GRANT EXECUTE ON FUNCTION get_notas_solicitud TO authenticated;
GRANT EXECUTE ON FUNCTION get_notas_solicitud TO service_role;
