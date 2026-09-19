-- =============================================================================
-- RPC: sincronizar_cargos_linea — persistir los Cargos de una Línea TDC
--
-- El subtab "Cargos" de Cartera TDC edita sobre el espejo de sesión. Este RPC
-- es el botón "Guardar": deja J_CARGOS_LINEA igual a lo que el usuario dejó en
-- pantalla, en UNA transacción.
--
-- QUÉ PUEDE Y QUÉ NO
--   Sólo toca cargos en estatus 'Pendiente'. Un cargo 'Procesado' ya forma
--   parte de una CxC emitida y de su póliza: borrarlo dejaría la CxC sin
--   respaldo y descuadraría la contabilidad. Por eso se ignoran, y si el
--   usuario intentó eliminar uno, la función lo dice en vez de callarlo.
--
-- ORDEN DE DESPLIEGUE: después de create_rpc_movimiento_tdc.sql.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'EFINANCIANET_DB' AND table_name = 'J_CARGOS_LINEA'
  ) THEN
    RAISE EXCEPTION
      'Falta ejecutar primero create_rpc_movimiento_tdc.sql, que crea J_CARGOS_LINEA.';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.sincronizar_cargos_linea(text, jsonb, text);

CREATE OR REPLACE FUNCTION public.sincronizar_cargos_linea(
  p_linea_id text,
  -- Los cargos que deben quedar. Cada uno:
  --   { id, clave, nombre, naturaleza, monto, fecha, bFactura, bCargo, estatus }
  -- `id` es el uuid de J_CARGOS_LINEA cuando el cargo ya existe; vacío si es nuevo.
  p_cargos   jsonb,
  p_usuario  text DEFAULT NULL
)
RETURNS TABLE (
  ok boolean, mensaje text,
  conservados integer, eliminados integer, creados integer, protegidos integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
DECLARE
  v_ren         jsonb;
  v_ids_ui      uuid[] := ARRAY[]::uuid[];
  v_eliminados  integer := 0;
  v_creados     integer := 0;
  v_protegidos  integer := 0;
  v_conservados integer := 0;
  v_id          uuid;
BEGIN
  IF p_linea_id IS NULL OR p_linea_id = '' THEN
    RAISE EXCEPTION 'No se recibió la Línea de Crédito.' USING ERRCODE = 'no_data_found';
  END IF;

  -- ── 1. Los ids que el usuario conserva en pantalla ──
  FOR v_ren IN SELECT * FROM jsonb_array_elements(COALESCE(p_cargos, '[]'::jsonb))
  LOOP
    v_id := NULLIF(v_ren->>'id', '')::uuid;
    IF v_id IS NOT NULL THEN
      v_ids_ui := array_append(v_ids_ui, v_id);
    END IF;
  END LOOP;

  -- ── 2. Cuántos Procesados se intentaron quitar ──
  -- Se cuentan ANTES de borrar: es lo que se le reporta al usuario.
  SELECT COUNT(*) INTO v_protegidos
    FROM "EFINANCIANET_DB"."J_CARGOS_LINEA" c
   WHERE c.linea_id = p_linea_id
     AND c.estatus <> 'Pendiente'
     AND NOT (c.id = ANY(v_ids_ui));

  -- ── 3. Borrar los Pendientes que ya no están en pantalla ──
  DELETE FROM "EFINANCIANET_DB"."J_CARGOS_LINEA" c
   WHERE c.linea_id = p_linea_id
     AND c.estatus = 'Pendiente'
     AND c.cxc_id IS NULL          -- nunca uno ya ligado a una CxC
     AND NOT (c.id = ANY(v_ids_ui));
  GET DIAGNOSTICS v_eliminados = ROW_COUNT;

  -- ── 4. Actualizar los que siguen, y crear los que no tenían id ──
  FOR v_ren IN SELECT * FROM jsonb_array_elements(COALESCE(p_cargos, '[]'::jsonb))
  LOOP
    v_id := NULLIF(v_ren->>'id', '')::uuid;

    IF v_id IS NULL THEN
      INSERT INTO "EFINANCIANET_DB"."J_CARGOS_LINEA" (
        linea_id, movimiento_id, clave, nombre, naturaleza, monto, fecha,
        b_factura, estatus, b_cargo
      ) VALUES (
        p_linea_id, NULL,
        COALESCE(v_ren->>'clave', ''), v_ren->>'nombre',
        CASE WHEN v_ren->>'naturaleza' = 'Abono' THEN 'Abono' ELSE 'Cargo' END,
        COALESCE((v_ren->>'monto')::numeric, 0),
        COALESCE((v_ren->>'fecha')::date, CURRENT_DATE),
        CASE WHEN v_ren->>'bFactura' = 'S' THEN 'S' ELSE 'N' END,
        'Pendiente',
        CASE WHEN v_ren->>'bCargo' = 'N' THEN 'N' ELSE 'S' END
      );
      v_creados := v_creados + 1;
    ELSE
      -- Sólo los Pendientes son editables: un Procesado se deja como está.
      UPDATE "EFINANCIANET_DB"."J_CARGOS_LINEA" c
         SET nombre     = COALESCE(v_ren->>'nombre', c.nombre),
             monto      = COALESCE((v_ren->>'monto')::numeric, c.monto),
             fecha      = COALESCE((v_ren->>'fecha')::date, c.fecha),
             b_factura  = CASE WHEN v_ren->>'bFactura' = 'S' THEN 'S' ELSE 'N' END
       WHERE c.id = v_id AND c.linea_id = p_linea_id AND c.estatus = 'Pendiente';
      v_conservados := v_conservados + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    true,
    CASE
      WHEN v_protegidos > 0 THEN
        format('Cargos guardados. %s cargo(s) ya facturados no se pudieron eliminar: pertenecen a una CxC emitida.', v_protegidos)
      ELSE 'Cargos guardados.'
    END,
    v_conservados, v_eliminados, v_creados, v_protegidos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_cargos_linea(text, jsonb, text) TO anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_cargos_linea(text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_cargos_linea(text, jsonb, text) TO service_role;

NOTIFY pgrst, 'reload schema';
