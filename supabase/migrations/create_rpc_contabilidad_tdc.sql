-- =============================================================================
-- RPC: contabilizar_evento_tdc / reclasificar_saldo_cxc — ESPECIFICACIÓN 5
--
-- Persiste en UNA SOLA TRANSACCIÓN (§58, §59, §86) la póliza que armó el motor
-- (src/app/lib/motorContableTDC.ts) y marca el documento origen como
-- contabilizado — en ese orden, nunca al revés (§93.20).
--
-- LAS PÓLIZAS VAN AL MÓDULO QUE YA EXISTE (§78, §93.4)
--   Se escriben en J_GL_JOURNAL_ENCABEZADO / J_GL_JOURNAL_DETALLE, las mismas
--   tablas que lee Pólizas Contables. No se crea un segundo visor.
--
-- NINGUNA CUENTA CONTABLE APARECE EN ESTE ARCHIVO (§3)
--   Las cuentas llegan resueltas dentro de p_partidas. Esta función no sabe ni
--   puede saber qué cuenta corresponde a qué componente: eso es del Motor
--   Contable del producto.
--
-- ORDEN DE DESPLIEGUE
--   1. create_rpc_movimiento_tdc.sql
--   2. create_rpc_cierre_corte_tdc.sql
--   3. create_rpc_aplicacion_pagos_tdc.sql
--   4. este archivo
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'EFINANCIANET_DB' AND table_name = 'J_APLICACIONES_PAGO_DETALLE'
  ) THEN
    RAISE EXCEPTION
      'Falta ejecutar primero create_rpc_aplicacion_pagos_tdc.sql (ESPECIFICACIÓN 4). Córralo y vuelva a ejecutar este script.';
  END IF;
END $$;

-- =============================================================================
-- §52, §53, §76 — El histórico contable: la fuente real de idempotencia
--
-- §52 pide explícitamente NO depender sólo de un booleano `bContabilizado`.
-- Esta tabla es la relación (DocumentoOrigen + Evento + DetalleOrigen) → Póliza,
-- y su índice único es lo que impide la doble contabilización aun ante
-- reintentos o concurrencia (§74, §75).
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CONTABILIZACIONES" (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_evento        text NOT NULL,
  tipo_documento      text NOT NULL,
  id_documento_origen text NOT NULL,
  -- Para eventos de detalle (APLICACIÓN_PAGOS) forma parte de la llave (§76).
  id_detalle_origen   text NOT NULL DEFAULT '',
  clave_idempotencia  text NOT NULL,
  poliza_id           uuid,
  numero_poliza       text,
  producto_id         text,
  cliente_id          text,
  linea_id            text,
  cxc_id              uuid,
  fecha_contable      date NOT NULL,
  monto_contabilizado numeric NOT NULL DEFAULT 0,
  total_debe          numeric NOT NULL DEFAULT 0,
  total_haber         numeric NOT NULL DEFAULT 0,
  estatus             text NOT NULL DEFAULT 'Contabilizado'
                      CHECK (estatus IN ('Contabilizado','Cancelada','Reversada','Error')),
  fecha_hora_proceso  timestamptz NOT NULL DEFAULT now(),
  usuario             text,
  correlation_id      text,
  resultado           text NOT NULL DEFAULT 'OK',
  mensaje_error       text
);

-- §53 — una misma clave lógica no produce dos pólizas VIGENTES. Las canceladas
-- y reversadas quedan fuera del índice para permitir recontabilizar tras una
-- reversa (§54).
CREATE UNIQUE INDEX IF NOT EXISTS ux_contab_clave_vigente
  ON "EFINANCIANET_DB"."J_CONTABILIZACIONES" (clave_idempotencia)
  WHERE estatus = 'Contabilizado';

CREATE INDEX IF NOT EXISTS idx_contab_documento
  ON "EFINANCIANET_DB"."J_CONTABILIZACIONES" (tipo_documento, id_documento_origen, clave_evento);
CREATE INDEX IF NOT EXISTS idx_contab_poliza
  ON "EFINANCIANET_DB"."J_CONTABILIZACIONES" (poliza_id);

-- =============================================================================
-- §25, §26, §51, §80 — estado contable en los documentos origen
-- =============================================================================
ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA"
  ADD COLUMN IF NOT EXISTS contabilizado        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poliza_id            uuid,
  ADD COLUMN IF NOT EXISTS fecha_contabilizacion date,
  -- §49 — datos que la CxC reclasificada debe conservar para auditoría
  ADD COLUMN IF NOT EXISTS saldo_reclasificado  numeric,
  ADD COLUMN IF NOT EXISTS fecha_reclasificacion date,
  ADD COLUMN IF NOT EXISTS cargo_saldo_ant_id   uuid,
  ADD COLUMN IF NOT EXISTS poliza_reclasif_id   uuid;

ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE"
  ADD COLUMN IF NOT EXISTS contabilizado        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poliza_id            uuid,
  ADD COLUMN IF NOT EXISTS fecha_contabilizacion date;

ALTER TABLE "EFINANCIANET_DB"."J_APLICACIONES_PAGO_DETALLE"
  ADD COLUMN IF NOT EXISTS contabilizado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poliza_id     uuid;

ALTER TABLE "EFINANCIANET_DB"."J_SALDOS_LINEA"
  ADD COLUMN IF NOT EXISTS contabilizado_activacion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poliza_activacion_id     uuid;

-- §38, §49 — la CxC reclasificada NO se marca Pagada: estado propio.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cxc_linea_estatus') THEN
    ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA" DROP CONSTRAINT chk_cxc_linea_estatus;
  END IF;
  ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA"
    ADD CONSTRAINT chk_cxc_linea_estatus
    CHECK (estatus IN ('Pendiente','Parcial','Pagada','Pagado','Facturada','Cancelada','Reclasificada'));
END $$;

-- =============================================================================
-- §41, §47 — Composición del Saldo Anterior
--
-- §40 prohíbe guardar sólo el total: hay que poder saber después cuánto de un
-- "Saldo Anterior" era capital, interés o IVA. Cada renglón apunta a la línea
-- de la CxC original de la que proviene.
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CARGO_SALDO_ANTERIOR_DETALLE" (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id               uuid NOT NULL,
  cxc_origen_id          uuid NOT NULL,
  cxc_detalle_origen_id  uuid NOT NULL,
  clave_concepto_origen  text NOT NULL,
  nombre_concepto_origen text,
  monto_original         numeric NOT NULL,
  monto_pagado           numeric NOT NULL DEFAULT 0,
  saldo_reclasificado    numeric NOT NULL CHECK (saldo_reclasificado > 0),
  orden_prelacion_origen integer,
  poliza_origen_id       uuid,
  correlation_id         text,
  creado_en              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saldo_ant_cargo ON "EFINANCIANET_DB"."J_CARGO_SALDO_ANTERIOR_DETALLE" (cargo_id);
CREATE INDEX IF NOT EXISTS idx_saldo_ant_cxc   ON "EFINANCIANET_DB"."J_CARGO_SALDO_ANTERIOR_DETALLE" (cxc_origen_id);

-- §71 — una CxC no puede reclasificarse dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS ux_saldo_ant_cxc_origen
  ON "EFINANCIANET_DB"."J_CARGO_SALDO_ANTERIOR_DETALLE" (cxc_detalle_origen_id);

-- ────────────────────────────────────────────────────────────────────────
-- La función vive en `public` porque PostgREST sólo expone ese esquema.
-- SECURITY DEFINER + GRANT dan acceso al rol anon sin permisos directos sobre
-- las tablas. Mismo patrón que public.aplicar_movimiento_tdc.
-- ────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- §8 — MOTOR GENÉRICO: los cuatro eventos usan ESTA función.
--
-- p_partidas: arreglo del motor —
--   { orden, cuentaContableId, cuentaContableGl, cuentaContableNombre,
--     debe, haber, claveComponente, componenteId, concepto,
--     idDetalleOrigen, referencia, idGuia }
-- =============================================================================
DROP FUNCTION IF EXISTS public.contabilizar_evento_tdc(
  text, text, text, text, date, jsonb, numeric, numeric, numeric,
  text, text, text, uuid, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.contabilizar_evento_tdc(
  p_clave_evento        text,
  p_tipo_documento      text,
  p_id_documento_origen text,
  p_clave_idempotencia  text,
  p_fecha_contable      date,
  p_partidas            jsonb,
  p_total_debe          numeric,
  p_total_haber         numeric,
  p_monto_contabilizado numeric,
  p_producto_id         text,
  p_cliente_id          text,
  p_linea_id            text,
  p_cxc_id              uuid,
  p_cuenta_id           text,
  p_usuario             text,
  p_correlation_id      text,
  -- Ids de detalle a marcar como contabilizados (CxCDetail o AplicacionPagoDetail)
  p_detalles_origen     jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  ok boolean, mensaje text, poliza_id uuid, numero_poliza text,
  total_debe numeric, total_haber numeric, partidas integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
DECLARE
  v_poliza_id  uuid;
  v_folio      text;
  v_ren        jsonb;
  v_n          integer := 0;
  v_suma_d     numeric := 0;
  v_suma_h     numeric := 0;
  v_existente  uuid;
  v_contab_id  uuid;
  v_det        text;
BEGIN
  -- ── §53, §74 — idempotencia: la clave lógica manda ──
  SELECT k.poliza_id INTO v_existente
    FROM "EFINANCIANET_DB"."J_CONTABILIZACIONES" k
   WHERE k.clave_idempotencia = p_clave_idempotencia AND k.estatus = 'Contabilizado';

  IF v_existente IS NOT NULL THEN
    RETURN QUERY
      SELECT true, 'El evento ya estaba contabilizado (idempotente)'::text,
             k.poliza_id, k.numero_poliza, k.total_debe, k.total_haber, 0
        FROM "EFINANCIANET_DB"."J_CONTABILIZACIONES" k
       WHERE k.clave_idempotencia = p_clave_idempotencia AND k.estatus = 'Contabilizado';
    RETURN;
  END IF;

  IF p_partidas IS NULL OR jsonb_array_length(p_partidas) = 0 THEN
    RAISE EXCEPTION 'El evento % no trae partidas contables.', p_clave_evento
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── §10, §60 — el cuadre se verifica AQUÍ, sobre lo que se va a escribir ──
  SELECT COALESCE(SUM((e->>'debe')::numeric), 0), COALESCE(SUM((e->>'haber')::numeric), 0)
    INTO v_suma_d, v_suma_h
    FROM jsonb_array_elements(p_partidas) e;

  IF round(v_suma_d, 2) <> round(v_suma_h, 2) THEN
    RAISE EXCEPTION
      'La póliza correspondiente al evento "%" no se encuentra cuadrada. Total Debe: %. Total Haber: %. La operación contable fue cancelada.',
      p_clave_evento, round(v_suma_d, 2), round(v_suma_h, 2)
      USING ERRCODE = 'check_violation';
  END IF;

  -- El plan y lo escrito deben coincidir: si no, el cliente mandó totales que
  -- no corresponden a sus partidas.
  IF round(v_suma_d, 2) <> round(p_total_debe, 2) THEN
    RAISE EXCEPTION
      'Los totales enviados (%) no corresponden a la suma de las partidas (%).',
      round(p_total_debe, 2), round(v_suma_d, 2) USING ERRCODE = 'check_violation';
  END IF;

  -- ── §55 — encabezado de la póliza, en la tabla que ya existe ──
  v_folio := 'PC-' || to_char(p_fecha_contable, 'YYYYMMDD') || '-' ||
             lpad((floor(random() * 100000))::int::text, 5, '0');

  INSERT INTO "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO" (
    journal_date, producto_id, event_code, account_id, currency,
    total_debit, total_credit, status, created_at, data
  ) VALUES (
    p_fecha_contable,
    NULLIF(p_producto_id, '')::uuid,
    p_clave_evento,
    NULLIF(p_cuenta_id, '')::uuid,
    'MXN',
    round(v_suma_d, 2), round(v_suma_h, 2),
    'creada',
    now(),
    jsonb_build_object(
      'evento',              p_clave_evento,
      'folio_display',       v_folio,
      'tipo_documento',      p_tipo_documento,
      'id_documento_origen', p_id_documento_origen,
      'cliente_id',          p_cliente_id,
      'linea_id',            p_linea_id,
      'cxc_id',              p_cxc_id,
      'correlation_id',      p_correlation_id,
      'usuario',             p_usuario,
      'monto_contabilizado', p_monto_contabilizado,
      -- El módulo Pólizas Contables lee el detalle de aquí (§78).
      'Detalle', (
        SELECT jsonb_agg(jsonb_build_object(
                 'cuenta_contable_id',     e->>'cuentaContableId',
                 'cuenta_contable_gl',     e->>'cuentaContableGl',
                 'cuenta_contable_nombre', e->>'cuentaContableNombre',
                 'debito',  CASE WHEN (e->>'debe')::numeric  > 0 THEN to_char((e->>'debe')::numeric,  'FM999999990.00') ELSE '' END,
                 'credito', CASE WHEN (e->>'haber')::numeric > 0 THEN to_char((e->>'haber')::numeric, 'FM999999990.00') ELSE '' END,
                 'componente_id',     e->>'componenteId',
                 'componente_codigo',  e->>'claveComponente',
                 'componente_nombre',  e->>'concepto',
                 'id_detalle_origen',  e->>'idDetalleOrigen',
                 'id_guia',            e->>'idGuia')
               ORDER BY (e->>'orden')::int)
          FROM jsonb_array_elements(p_partidas) e)
    )
  ) RETURNING id INTO v_poliza_id;

  -- ── §56 — renglones contables ──
  FOR v_ren IN SELECT * FROM jsonb_array_elements(p_partidas) ORDER BY (value->>'orden')::int
  LOOP
    INSERT INTO "EFINANCIANET_DB"."J_GL_JOURNAL_DETALLE" (
      journal_id, gl_account, debit_amount, credit_amount, currency,
      customer_id, account_id, product_id, descripcion
    ) VALUES (
      v_poliza_id,
      v_ren->>'cuentaContableGl',
      COALESCE((v_ren->>'debe')::numeric, 0),
      COALESCE((v_ren->>'haber')::numeric, 0),
      'MXN',
      NULLIF(p_cliente_id, '')::uuid,
      NULLIF(p_cuenta_id, '')::uuid,
      NULLIF(p_producto_id, '')::uuid,
      CASE WHEN COALESCE((v_ren->>'debe')::numeric, 0) > 0 THEN 'DÉBITO | ' ELSE 'CRÉDITO | ' END
        || COALESCE(v_ren->>'claveComponente', '') || ' | ' || COALESCE(v_ren->>'concepto', '')
    );
    v_n := v_n + 1;
  END LOOP;

  -- ── §52 — el histórico contable, ANTES de marcar nada ──
  -- Si dos procesos llegan a la vez, el índice único hace fallar al segundo y
  -- toda su transacción se revierte (§75).
  INSERT INTO "EFINANCIANET_DB"."J_CONTABILIZACIONES" (
    clave_evento, tipo_documento, id_documento_origen, id_detalle_origen,
    clave_idempotencia, poliza_id, numero_poliza, producto_id, cliente_id,
    linea_id, cxc_id, fecha_contable, monto_contabilizado,
    total_debe, total_haber, usuario, correlation_id
  ) VALUES (
    p_clave_evento, p_tipo_documento, p_id_documento_origen, '',
    p_clave_idempotencia, v_poliza_id, v_folio, p_producto_id, p_cliente_id,
    p_linea_id, p_cxc_id, p_fecha_contable, p_monto_contabilizado,
    round(v_suma_d, 2), round(v_suma_h, 2), p_usuario, p_correlation_id
  ) RETURNING id INTO v_contab_id;

  -- ── §25, §26, §93.20 — marcar el origen DESPUÉS de la póliza cuadrada ──
  IF p_clave_evento = 'CORTE_PERIODO' AND p_cxc_id IS NOT NULL THEN
    UPDATE "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" d
       SET contabilizado = true, poliza_id = v_poliza_id, fecha_contabilizacion = p_fecha_contable
     WHERE d.cxc_id = p_cxc_id;

    -- §26 — la CxC sólo después de que TODOS sus detalles quedaron marcados.
    IF EXISTS (SELECT 1 FROM "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" d
                WHERE d.cxc_id = p_cxc_id AND d.contabilizado = false) THEN
      RAISE EXCEPTION 'Quedaron conceptos de la CxC % sin contabilizar. La operación fue cancelada.', p_cxc_id
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE "EFINANCIANET_DB"."J_CXC_LINEA" x
       SET contabilizado = true, poliza_id = v_poliza_id, fecha_contabilizacion = p_fecha_contable
     WHERE x.id = p_cxc_id;
  END IF;

  IF p_clave_evento = 'APLICACION_PAGOS' THEN
    -- §32 — cada AplicacionPagoDetail se contabiliza una sola vez.
    FOR v_det IN SELECT jsonb_array_elements_text(COALESCE(p_detalles_origen, '[]'::jsonb))
    LOOP
      UPDATE "EFINANCIANET_DB"."J_APLICACIONES_PAGO_DETALLE" a
         SET contabilizado = true, poliza_id = v_poliza_id
       WHERE a.id = v_det::uuid AND a.contabilizado = false;

      IF NOT FOUND THEN
        RAISE EXCEPTION
          'La aplicación de pago % ya estaba contabilizada o no existe. La operación fue cancelada.', v_det
          USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;

  IF p_clave_evento = 'ACTIVACION_LINEA' AND p_linea_id IS NOT NULL THEN
    UPDATE "EFINANCIANET_DB"."J_SALDOS_LINEA" sl
       SET contabilizado_activacion = true, poliza_activacion_id = v_poliza_id
     WHERE sl.linea_id = p_linea_id;
  END IF;

  RETURN QUERY SELECT true, 'Evento contabilizado correctamente'::text,
                      v_poliza_id, v_folio, round(v_suma_d, 2), round(v_suma_h, 2), v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.contabilizar_evento_tdc(
  text, text, text, text, date, jsonb, numeric, numeric, numeric,
  text, text, text, uuid, text, text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.contabilizar_evento_tdc(
  text, text, text, text, date, jsonb, numeric, numeric, numeric,
  text, text, text, uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contabilizar_evento_tdc(
  text, text, text, text, date, jsonb, numeric, numeric, numeric,
  text, text, text, uuid, text, text, text, jsonb) TO service_role;

-- =============================================================================
-- §70, §85 — RECLASIFICACIÓN_SALDO: los diez pasos, indivisibles
--
-- Póliza + cierre de la CxC anterior + Cargo Saldo Anterior + composición son
-- una sola unidad. §71: nunca puede existir una CxC Reclasificada sin su Cargo
-- válido, ni un Cargo sin la CxC cerrada.
-- =============================================================================
DROP FUNCTION IF EXISTS public.reclasificar_saldo_cxc(
  uuid, text, text, text, date, text, text, jsonb, jsonb, numeric, numeric, text, text);

CREATE OR REPLACE FUNCTION public.reclasificar_saldo_cxc(
  p_cxc_id            uuid,
  p_linea_id          text,
  p_cliente_id        text,
  p_producto_id       text,
  p_fecha_contable    date,
  p_clave_saldo_ant   text,      -- §42: la clave configurada, NO '010' fija
  p_nombre_saldo_ant  text,
  p_partidas          jsonb,     -- póliza de reclasificación (del motor)
  p_composicion       jsonb,     -- §41: de qué está hecho el saldo
  p_saldo_total       numeric,
  p_monto_poliza      numeric,
  p_usuario           text,
  p_correlation_id    text
)
RETURNS TABLE (
  ok boolean, mensaje text, poliza_id uuid, cargo_id uuid,
  saldo_reclasificado numeric, conceptos integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
DECLARE
  v_saldo_cxc  numeric;
  v_estatus    text;
  v_suma_comp  numeric;
  v_poliza     uuid;
  v_folio      text;
  v_cargo_id   uuid;
  v_ren        jsonb;
  v_n          integer := 0;
  v_clave      text;
  v_res        record;
BEGIN
  -- ── 1. Validar la CxC, bloqueándola (§75) ──
  SELECT round(COALESCE(x.saldo_pendiente, x.monto_total_pagar - COALESCE(x.pago_total, 0)), 2), x.estatus
    INTO v_saldo_cxc, v_estatus
    FROM "EFINANCIANET_DB"."J_CXC_LINEA" x
   WHERE x.id = p_cxc_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la CxC %.', p_cxc_id USING ERRCODE = 'no_data_found';
  END IF;

  -- §71/§74 — una CxC ya reclasificada no se vuelve a reclasificar.
  IF v_estatus = 'Reclasificada' THEN
    RAISE EXCEPTION 'La CxC % ya fue reclasificada.', p_cxc_id USING ERRCODE = 'check_violation';
  END IF;
  IF v_estatus IN ('Pagada', 'Pagado', 'Cancelada') THEN
    RAISE EXCEPTION 'La CxC % está en estado "%" y no tiene saldo que reclasificar.', p_cxc_id, v_estatus
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── 2-3. El saldo calculado debe cuadrar con el del documento (§39, §72) ──
  SELECT COALESCE(SUM((e->>'saldoReclasificado')::numeric), 0) INTO v_suma_comp
    FROM jsonb_array_elements(COALESCE(p_composicion, '[]'::jsonb)) e;

  IF round(v_suma_comp, 2) <> round(p_saldo_total, 2)
     OR round(v_suma_comp, 2) <> v_saldo_cxc THEN
    RAISE EXCEPTION
      '§72: la composición (%) no coincide con el saldo enviado (%) ni con el Saldo Pendiente de la CxC (%). La reclasificación fue cancelada.',
      round(v_suma_comp, 2), round(p_saldo_total, 2), v_saldo_cxc
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_suma_comp <= 0 THEN
    RAISE EXCEPTION 'La CxC % no tiene saldo pendiente que reclasificar.', p_cxc_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── 4-5. Póliza de reclasificación, cuadrada (§10) ──
  SELECT * INTO v_res FROM public.contabilizar_evento_tdc(
    'RECLASIFICACION_SALDO', 'CXC', p_cxc_id::text,
    'RECLASIFICACION_SALDO|' || p_cxc_id::text || '|',
    p_fecha_contable, p_partidas, p_monto_poliza, p_monto_poliza, p_monto_poliza,
    p_producto_id, p_cliente_id, p_linea_id, p_cxc_id, NULL::text,
    p_usuario, p_correlation_id, '[]'::jsonb);

  v_poliza := v_res.poliza_id;
  v_folio  := v_res.numero_poliza;

  -- ── 6. El nuevo Cargo a la Línea (§42) ──
  -- La clave llega parametrizada: §42 dice explícitamente que '010' es sólo el
  -- ejemplo y que hay que usar la configurada en el catálogo.
  v_clave := COALESCE(NULLIF(p_clave_saldo_ant, ''), '010');

  INSERT INTO "EFINANCIANET_DB"."J_CARGOS_LINEA" (
    linea_id, movimiento_id, clave, nombre, naturaleza, monto, fecha,
    b_factura, estatus, b_cargo
  ) VALUES (
    p_linea_id, NULL, v_clave,
    COALESCE(NULLIF(p_nombre_saldo_ant, ''), 'Saldo Anterior'),
    'Cargo', round(v_suma_comp, 2), p_fecha_contable,
    'S', 'Pendiente', 'S'
  ) RETURNING id INTO v_cargo_id;

  -- ── 7-8. La composición, ligada al Cargo y a la CxC origen (§41, §47) ──
  FOR v_ren IN SELECT * FROM jsonb_array_elements(COALESCE(p_composicion, '[]'::jsonb))
  LOOP
    INSERT INTO "EFINANCIANET_DB"."J_CARGO_SALDO_ANTERIOR_DETALLE" (
      cargo_id, cxc_origen_id, cxc_detalle_origen_id, clave_concepto_origen,
      nombre_concepto_origen, monto_original, monto_pagado, saldo_reclasificado,
      orden_prelacion_origen, poliza_origen_id, correlation_id
    ) VALUES (
      v_cargo_id, p_cxc_id, (v_ren->>'idCxCDetalleOrigen')::uuid,
      v_ren->>'claveConceptoOrigen', v_ren->>'nombreConceptoOrigen',
      (v_ren->>'montoOriginal')::numeric,
      COALESCE((v_ren->>'montoPagado')::numeric, 0),
      (v_ren->>'saldoReclasificado')::numeric,
      NULLIF(v_ren->>'ordenPrelacionOrigen','')::int,
      v_poliza, p_correlation_id
    );
    v_n := v_n + 1;
  END LOOP;

  IF v_n = 0 THEN
    RAISE EXCEPTION '§71: no se puede reclasificar sin composición del saldo.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── 9. Cerrar la CxC anterior (§38, §49) ──
  -- NO se marca Pagada: el cliente no pagó. Estado propio, y se conserva todo
  -- lo que §49 pide para auditoría. §50: no se borra nada.
  UPDATE "EFINANCIANET_DB"."J_CXC_LINEA" x
     SET estatus               = 'Reclasificada',
         saldo_reclasificado   = round(v_suma_comp, 2),
         fecha_reclasificacion = p_fecha_contable,
         cargo_saldo_ant_id    = v_cargo_id,
         poliza_reclasif_id    = v_poliza
   WHERE x.id = p_cxc_id;

  RETURN QUERY SELECT true,
    'Saldo reclasificado correctamente. Póliza ' || v_folio || '.',
    v_poliza, v_cargo_id, round(v_suma_comp, 2), v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reclasificar_saldo_cxc(
  uuid, text, text, text, date, text, text, jsonb, jsonb, numeric, numeric, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.reclasificar_saldo_cxc(
  uuid, text, text, text, date, text, text, jsonb, jsonb, numeric, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reclasificar_saldo_cxc(
  uuid, text, text, text, date, text, text, jsonb, jsonb, numeric, numeric, text, text) TO service_role;

-- =============================================================================
-- §79, §80 — Consultar el estado contable de un documento
-- =============================================================================
CREATE OR REPLACE FUNCTION public.obtener_contabilizaciones(
  p_tipo_documento text,
  p_id_documento   text
)
RETURNS TABLE (
  id uuid, clave_evento text, poliza_id uuid, numero_poliza text,
  fecha_contable date, monto_contabilizado numeric,
  total_debe numeric, total_haber numeric, estatus text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
  SELECT k.id, k.clave_evento, k.poliza_id, k.numero_poliza,
         k.fecha_contable, k.monto_contabilizado,
         k.total_debe, k.total_haber, k.estatus
    FROM "EFINANCIANET_DB"."J_CONTABILIZACIONES" k
   WHERE k.tipo_documento = p_tipo_documento
     AND k.id_documento_origen = p_id_documento
   ORDER BY k.fecha_hora_proceso DESC;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_contabilizaciones(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.obtener_contabilizaciones(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_contabilizaciones(text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICACIONES DE §93.25 — las cuatro deben devolver CERO filas
--
-- 1) Póliza descuadrada:
--    SELECT id, total_debit, total_credit FROM "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO"
--     WHERE round(total_debit,2) <> round(total_credit,2);
--
-- 2) Documento contabilizado sin póliza:
--    SELECT id FROM "EFINANCIANET_DB"."J_CXC_LINEA"
--     WHERE contabilizado = true AND poliza_id IS NULL;
--
-- 3) CxC reclasificada sin Cargo Saldo Anterior, o Cargo sin composición:
--    SELECT x.id FROM "EFINANCIANET_DB"."J_CXC_LINEA" x
--     WHERE x.estatus = 'Reclasificada'
--       AND (x.cargo_saldo_ant_id IS NULL
--         OR NOT EXISTS (SELECT 1 FROM "EFINANCIANET_DB"."J_CARGO_SALDO_ANTERIOR_DETALLE" c
--                         WHERE c.cargo_id = x.cargo_saldo_ant_id));
--
-- 4) Aplicación de pago contabilizada dos veces — imposible por
--    ux_contab_clave_vigente, pero se verifica así:
--    SELECT clave_idempotencia, COUNT(*) FROM "EFINANCIANET_DB"."J_CONTABILIZACIONES"
--     WHERE estatus = 'Contabilizado' GROUP BY 1 HAVING COUNT(*) > 1;
--
-- 5) Cargo Saldo Anterior cuyo importe no cuadra con su composición (§72):
--    SELECT c.cargo_id, SUM(c.saldo_reclasificado), g.monto
--      FROM "EFINANCIANET_DB"."J_CARGO_SALDO_ANTERIOR_DETALLE" c
--      JOIN "EFINANCIANET_DB"."J_CARGOS_LINEA" g ON g.id = c.cargo_id
--     GROUP BY c.cargo_id, g.monto
--    HAVING round(SUM(c.saldo_reclasificado),2) <> round(g.monto,2);
-- =============================================================================
