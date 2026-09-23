-- =============================================================================
-- ESPECIFICACIÓN 9 — Reclasificación al cerrar el Estado de Cuenta
--
-- Al terminar la generación del Estado de Cuenta, los Avisos que quedaron en
-- 'Parcial' se cierran como 'Pagado x Reclasificación': su saldo ya no se
-- cobra contra ese documento, porque se reinyectó a la Línea como el cargo
-- "Saldo Anterior" del periodo siguiente. Cobrarlo en los dos lugares sería
-- cobrarlo dos veces, y por eso dejan de ser pagables.
--
-- ORDEN DE DESPLIEGUE: después de create_rpc_estado_cuenta_tdc.sql.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'EFINANCIANET_DB' AND table_name = 'J_ESTADOS_CUENTA'
  ) THEN
    RAISE EXCEPTION
      'Falta ejecutar create_rpc_estado_cuenta_tdc.sql (ESPECIFICACIÓN 6). Córralo y vuelva a ejecutar este script.';
  END IF;
END $$;

-- =============================================================================
-- El estatus nuevo tiene que caber en el CHECK antes de poder escribirlo.
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cxc_linea_estatus') THEN
    ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA" DROP CONSTRAINT chk_cxc_linea_estatus;
  END IF;

  ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA"
    ADD CONSTRAINT chk_cxc_linea_estatus
    CHECK (estatus IN ('Pendiente','Parcial','Pagada','Pagado',
                       'Pagado x Reclasificación','Facturada','Cancelada'));
END $$;

-- Trazabilidad: sin esto no se puede saber cuándo ni por qué documento se
-- reclasificó un Aviso, y el cambio de estatus queda sin explicación.
ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA"
  ADD COLUMN IF NOT EXISTS reclasificado_en       timestamptz,
  ADD COLUMN IF NOT EXISTS reclasificado_por      text,
  ADD COLUMN IF NOT EXISTS estado_cuenta_id       uuid,
  ADD COLUMN IF NOT EXISTS saldo_reclasificado    numeric;

-- =============================================================================
-- El índice de CxC pagables tiene que excluir el estatus nuevo, o seguiría
-- ofreciendo para pago documentos ya reclasificados.
-- =============================================================================
DROP INDEX IF EXISTS "EFINANCIANET_DB".idx_cxc_linea_por_pagar;
CREATE INDEX IF NOT EXISTS idx_cxc_linea_por_pagar
  ON "EFINANCIANET_DB"."J_CXC_LINEA" (cliente_id, fecha_vencimiento)
  WHERE estatus NOT IN ('Pagada','Pagado','Pagado x Reclasificación','Cancelada');

-- =============================================================================
-- §2 — Reclasificar los Avisos Parciales de una Línea
--
-- Se acota a 'Parcial' a propósito: un Aviso 'Pendiente' sin un solo peso
-- pagado no se reclasifica, se sigue cobrando tal cual. La especificación
-- habla de los parciales, que son los que dejan un remanente huérfano.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reclasificar_avisos_parciales(
  p_linea_id         text,
  p_estado_cuenta_id uuid DEFAULT NULL,
  p_usuario          text DEFAULT NULL,
  p_correlation_id   text DEFAULT NULL
)
RETURNS TABLE (
  ok boolean, mensaje text, avisos integer, saldo_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
DECLARE
  v_avisos integer := 0;
  v_saldo  numeric := 0;
BEGIN
  IF p_linea_id IS NULL OR btrim(p_linea_id) = '' THEN
    RAISE EXCEPTION 'No se recibió la Línea de Crédito.' USING ERRCODE = 'check_violation';
  END IF;

  WITH afectados AS (
    UPDATE "EFINANCIANET_DB"."J_CXC_LINEA" x
       SET estatus             = 'Pagado x Reclasificación',
           reclasificado_en    = now(),
           reclasificado_por   = p_usuario,
           estado_cuenta_id    = p_estado_cuenta_id,
           saldo_reclasificado = COALESCE(x.saldo_pendiente,
                                          x.monto_total_pagar - COALESCE(x.pago_total, 0))
     WHERE x.linea_id = p_linea_id
       AND x.estatus = 'Parcial'
    RETURNING COALESCE(x.saldo_reclasificado, 0) AS saldo
  )
  SELECT COUNT(*), COALESCE(SUM(saldo), 0) INTO v_avisos, v_saldo FROM afectados;

  RETURN QUERY SELECT true,
    format('%s aviso(s) reclasificado(s) por %s.', v_avisos, to_char(COALESCE(v_saldo,0), 'FM999,999,999.00'))::text,
    v_avisos, v_saldo;
END;
$$;

-- =============================================================================
-- §2 — El lector de CxC pagables deja de ofrecer los reclasificados
--
-- Se redefine aquí, con la MISMA forma que en create_rpc_aplicacion_pagos_tdc,
-- cambiando sólo el filtro. Es el candado de "ya no se toman en cuenta para
-- cuando se apliquen nuevos pagos": sin esto el motor los seguiría viendo.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.obtener_cxc_pagables(p_cliente_id text)
RETURNS TABLE (
  id uuid, folio text, contrato_id text, fecha_vencimiento date,
  fecha_documento date, monto_total_pagar numeric, pago_total numeric,
  estatus text, detalle jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
  SELECT x.id, x.folio, x.linea_id, x.fecha_vencimiento,
         x.fecha_documento, x.monto_total_pagar, COALESCE(x.pago_total, 0),
         x.estatus,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'id',             d.id,
                    'claveConcepto',  d.clave_concepto,
                    'nombreConcepto', d.nombre_concepto,
                    'monto',          d.monto,
                    'pagoTotal',      COALESCE(d.pago_total, 0),
                    'ordenPrelacion', d.orden_prelacion,
                    'estatusPago',    COALESCE(d.estatus_pago, 'Pendiente'))
                  ORDER BY d.orden_prelacion, d.id)
             FROM "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" d
            WHERE d.cxc_id = x.id
         ), '[]'::jsonb)
    FROM "EFINANCIANET_DB"."J_CXC_LINEA" x
   WHERE x.cliente_id = p_cliente_id
     AND x.estatus NOT IN ('Pagada', 'Pagado', 'Pagado x Reclasificación', 'Cancelada')
   ORDER BY x.fecha_vencimiento, x.fecha_documento, x.id;
$$;

GRANT EXECUTE ON FUNCTION public.reclasificar_avisos_parciales(text, uuid, text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obtener_cxc_pagables(text)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- NOTAS DE DESPLIEGUE
--
-- 1. `obtener_avisos_tdc` NO se tocó: la consulta de Avisos debe seguir
--    mostrando los reclasificados, con su estatus nuevo. Lo que cambia es que
--    ya no son PAGABLES, y de eso se encarga `obtener_cxc_pagables`.
--
-- 2. Prueba de humo — ningún Aviso reclasificado debe aparecer como pagable:
--
--      SELECT x.id, x.folio, x.estatus
--        FROM "EFINANCIANET_DB"."J_CXC_LINEA" x
--       WHERE x.estatus = 'Pagado x Reclasificación'
--         AND x.id IN (SELECT id FROM public.obtener_cxc_pagables(x.cliente_id));
--
--    Debe devolver CERO filas.
--
-- 3. Reversa manual de una reclasificación equivocada:
--
--      UPDATE "EFINANCIANET_DB"."J_CXC_LINEA"
--         SET estatus = 'Parcial', reclasificado_en = NULL, reclasificado_por = NULL,
--             estado_cuenta_id = NULL, saldo_reclasificado = NULL
--       WHERE id = '<id de la CxC>';
--
--    Ojo: eso NO borra los movimientos de Saldo Anterior, Interés e IVA que la
--    reclasificación generó en la Línea. Hay que eliminarlos aparte, o el saldo
--    quedaría cobrado dos veces.
-- =============================================================================
