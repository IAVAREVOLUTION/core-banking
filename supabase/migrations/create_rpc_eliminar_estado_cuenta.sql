-- =============================================================================
-- Eliminar un Estado de Cuenta — la salida que §16 deja abierta
--
-- §16 prohíbe generar dos documentos para la misma (Línea, Fecha Estado) y
-- deja la regeneración como "una acción explícita y separada". Esto es esa
-- acción: borrar el documento equivocado para poder volver a emitirlo.
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
-- El candado que hace que esto sea seguro
--
-- Si el Estado de Cuenta ya disparó la reclasificación de ESPECIFICACIÓN 9,
-- borrarlo dejaría Avisos cerrados como 'Pagado x Reclasificación' y cargos de
-- Saldo Anterior en la Línea SIN el documento que los justifica. Por eso en
-- ese caso se rechaza y se explica qué hay que revertir primero: es una
-- decisión que debe tomar una persona, no un borrado en cascada.
--
-- La columna `estado_cuenta_id` de J_CXC_LINEA la crea
-- create_rpc_reclasificacion_tdc.sql. Si esa migración no se ha corrido, no
-- hay reclasificaciones que proteger y la verificación se omite.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.eliminar_estado_cuenta(
  p_estado_id uuid,
  p_usuario   text DEFAULT NULL
)
RETURNS TABLE (
  ok boolean, mensaje text, documento_pdf text, renglones integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
DECLARE
  v_estado   record;
  v_reclas   integer := 0;
  v_ren      integer := 0;
  v_hay_col  boolean;
BEGIN
  IF p_estado_id IS NULL THEN
    RAISE EXCEPTION 'No se recibió el Estado de Cuenta a eliminar.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT e.id, e.linea_id, e.cliente_id, e.fecha_estado, e.id_documento_pdf, e.estatus
    INTO v_estado
    FROM "EFINANCIANET_DB"."J_ESTADOS_CUENTA" e
   WHERE e.id = p_estado_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'El Estado de Cuenta ya no existe.'::text, NULL::text, 0;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'EFINANCIANET_DB'
       AND table_name   = 'J_CXC_LINEA'
       AND column_name  = 'estado_cuenta_id'
  ) INTO v_hay_col;

  IF v_hay_col THEN
    EXECUTE 'SELECT COUNT(*) FROM "EFINANCIANET_DB"."J_CXC_LINEA" WHERE estado_cuenta_id = $1'
      INTO v_reclas USING p_estado_id;
  END IF;

  IF v_reclas > 0 THEN
    RETURN QUERY SELECT false,
      format(
        'No se puede eliminar: este Estado de Cuenta reclasificó %s aviso(s). '
        || 'Primero regrese esos avisos a "Parcial" y elimine los movimientos de '
        || 'Saldo Anterior, Interés e IVA que generó, o el saldo quedaría cobrado dos veces.',
        v_reclas)::text,
      NULL::text, 0;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_ren
    FROM "EFINANCIANET_DB"."J_ESTADOS_CUENTA_DETALLE" d
   WHERE d.estado_cuenta_id = p_estado_id;

  -- §19 — la eliminación también se audita. Va ANTES del DELETE porque
  -- después ya no habría de dónde leer los datos del documento.
  INSERT INTO "EFINANCIANET_DB"."J_AUDITORIA_ESTADO_CUENTA" (
    linea_id, cliente_id, estado_cuenta_id, fecha_estado, usuario,
    resultado, mensaje_error
  ) VALUES (
    v_estado.linea_id, v_estado.cliente_id, p_estado_id, v_estado.fecha_estado,
    p_usuario, 'ELIMINADO',
    format('Documento %s eliminado para permitir la regeneración.',
           COALESCE(v_estado.id_documento_pdf, 'sin PDF'))
  );

  -- El detalle se va en cascada por su FK.
  DELETE FROM "EFINANCIANET_DB"."J_ESTADOS_CUENTA" WHERE id = p_estado_id;

  RETURN QUERY SELECT true,
    format('Estado de Cuenta del %s eliminado.', to_char(v_estado.fecha_estado, 'DD/MM/YYYY'))::text,
    v_estado.id_documento_pdf, v_ren;
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_estado_cuenta(uuid, text)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- NOTAS
--
-- 1. El PDF en Storage NO se borra aquí: la función sólo devuelve su ruta en
--    `documento_pdf` para que el cliente lo elimine. Un PDF huérfano en el
--    bucket es inofensivo; una fila sin PDF, no (§22).
--
-- 2. La bitácora en J_AUDITORIA_ESTADO_CUENTA sobrevive al borrado a
--    propósito: no tiene llave foránea contra J_ESTADOS_CUENTA, así que el
--    rastro de quién generó y quién eliminó el documento permanece.
--
-- 3. Reversa manual de una reclasificación, cuando haya que eliminar un
--    Estado que sí reclasificó:
--
--      UPDATE "EFINANCIANET_DB"."J_CXC_LINEA"
--         SET estatus = 'Parcial', reclasificado_en = NULL, reclasificado_por = NULL,
--             estado_cuenta_id = NULL, saldo_reclasificado = NULL
--       WHERE estado_cuenta_id = '<id del estado>';
--
--    Y eliminar los movimientos que generó, que llevan el correlation_id
--    'reclas|<id del estado>|...':
--
--      SELECT id, clave, monto, correlation_id
--        FROM "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA"
--       WHERE correlation_id LIKE 'reclas|<id del estado>|%';
-- =============================================================================
