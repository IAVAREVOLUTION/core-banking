-- =============================================================================
-- RPC: aplicar_pago_referenciado — ESPECIFICACIÓN 4 (Aplicación de Pagos)
--
-- Aplica en UNA SOLA TRANSACCIÓN (§50, §51, §52) todo lo que el motor
-- (src/app/lib/motorAplicacionPagosTDC.ts) decidió para un pago:
--   Abono en Cuenta EJE → aplicaciones a CxC y su Detalle → Cargo
--   "Aplicación Cobranza" en la EJE → Abonos por Contrato → estado del Pago.
--
-- EL MOTOR DECIDE QUÉ, ESTA FUNCIÓN DECIDE CÓMO
--   La prelación de dos niveles, el MIN() por línea y el reparto por contrato
--   NO se reimplementan aquí. El cliente manda el plan ya resuelto y esta
--   función lo persiste verificando que cuadre (§48, §49). Duplicar las reglas
--   en SQL garantizaría que las dos copias se separen con el tiempo.
--
-- ORDEN DE DESPLIEGUE
--   1. create_rpc_movimiento_tdc.sql
--   2. create_rpc_cierre_corte_tdc.sql
--   3. este archivo
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'EFINANCIANET_DB' AND table_name = 'J_CXC_LINEA'
  ) THEN
    RAISE EXCEPTION
      'Falta ejecutar primero create_rpc_cierre_corte_tdc.sql (ESPECIFICACIÓN 3), que crea J_CXC_LINEA y J_CXC_LINEA_DETALLE. Córralo y vuelva a ejecutar este script.';
  END IF;
END $$;

-- =============================================================================
-- §11, §12, §17, §19, §20, §21 — el documento y su detalle necesitan acumulados
--
-- `pago_total` es un acumulado operativo; la trazabilidad histórica vive en las
-- tablas de aplicaciones (§16). `saldo_pendiente` se deriva, pero se almacena
-- para poder indexar y consultar sin recalcular.
-- =============================================================================
ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA"
  ADD COLUMN IF NOT EXISTS pago_total       numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_pendiente  numeric,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_pago date;

ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE"
  ADD COLUMN IF NOT EXISTS pago_total        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_pendiente   numeric,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_pago date,
  ADD COLUMN IF NOT EXISTS estatus_pago      text NOT NULL DEFAULT 'Pendiente';

-- Sembrar el saldo de lo ya emitido: sin esto las CxC anteriores a esta
-- migración quedarían con saldo NULL y no participarían en la aplicación.
UPDATE "EFINANCIANET_DB"."J_CXC_LINEA"
   SET saldo_pendiente = monto_total_pagar - COALESCE(pago_total, 0)
 WHERE saldo_pendiente IS NULL;

UPDATE "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE"
   SET saldo_pendiente = monto - COALESCE(pago_total, 0)
 WHERE saldo_pendiente IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cxc_det_estatus_pago') THEN
    ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE"
      ADD CONSTRAINT chk_cxc_det_estatus_pago
      CHECK (estatus_pago IN ('Pendiente','Parcial','Pagado'));
  END IF;
END $$;

-- §19 — el header ya tenía un CHECK sin 'Parcial'. Se amplía.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'J_CXC_LINEA_estatus_check') THEN
    ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA" DROP CONSTRAINT "J_CXC_LINEA_estatus_check";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cxc_linea_estatus') THEN
    ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA"
      ADD CONSTRAINT chk_cxc_linea_estatus
      CHECK (estatus IN ('Pendiente','Parcial','Pagada','Pagado','Facturada','Cancelada'));
  END IF;
END $$;

-- §12/§19 — el acumulado nunca puede rebasar el importe original.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cxc_det_no_sobrepago') THEN
    ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE"
      ADD CONSTRAINT chk_cxc_det_no_sobrepago CHECK (pago_total <= monto + 0.005);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cxc_linea_por_pagar
  ON "EFINANCIANET_DB"."J_CXC_LINEA" (cliente_id, fecha_vencimiento)
  WHERE estatus NOT IN ('Pagada','Pagado','Cancelada');

-- =============================================================================
-- §45 — Proceso de aplicación: la unidad de idempotencia
--
-- Un mismo IdPagoReferenciado no puede generar dos veces el abono ni duplicar
-- las aplicaciones. El índice único sobre pago_referenciado_id es lo que lo
-- garantiza de verdad, aun con dos procesos simultáneos (§46).
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO" (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_referenciado_id   text NOT NULL,
  referencia_pago        text,
  cliente_id             text,
  cuenta_eje_id          uuid,
  monto_pago             numeric NOT NULL CHECK (monto_pago > 0),
  monto_total_aplicado   numeric NOT NULL DEFAULT 0,
  saldo_eje_anterior     numeric,
  saldo_eje_posterior    numeric,
  cxc_afectadas          integer NOT NULL DEFAULT 0,
  lineas_afectadas       integer NOT NULL DEFAULT 0,
  contratos_afectados    integer NOT NULL DEFAULT 0,
  estatus_pago_ref       text,
  fecha_pago             date,
  fecha_aplicacion       timestamptz NOT NULL DEFAULT now(),
  usuario                text,
  correlation_id         text,
  resultado              text NOT NULL DEFAULT 'OK',
  mensaje                text
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_proc_aplic_pago_ref
  ON "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO" (pago_referenciado_id)
  WHERE resultado = 'OK';

-- =============================================================================
-- §22 — Aplicaciones a nivel documento
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_APLICACIONES_PAGO_CXC" (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_id           uuid NOT NULL REFERENCES "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO"(id) ON DELETE CASCADE,
  cxc_id               uuid NOT NULL REFERENCES "EFINANCIANET_DB"."J_CXC_LINEA"(id) ON DELETE CASCADE,
  pago_referenciado_id text,
  contrato_id          text,
  monto_aplicado       numeric NOT NULL CHECK (monto_aplicado > 0),
  saldo_anterior       numeric,
  saldo_posterior      numeric,
  fecha_aplicacion     date NOT NULL,
  creado_en            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aplic_cxc_cxc     ON "EFINANCIANET_DB"."J_APLICACIONES_PAGO_CXC" (cxc_id);
CREATE INDEX IF NOT EXISTS idx_aplic_cxc_proceso ON "EFINANCIANET_DB"."J_APLICACIONES_PAGO_CXC" (proceso_id);

-- =============================================================================
-- §15, §16 — Aplicaciones a nivel línea: la relación 1:N que exige §58.8
--
-- Cada pago parcial sobre una misma línea deja su propio renglón. `pago_total`
-- en el detalle es el acumulado; el histórico completo está aquí.
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_APLICACIONES_PAGO_DETALLE" (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_id           uuid NOT NULL REFERENCES "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO"(id) ON DELETE CASCADE,
  cxc_detalle_id       uuid NOT NULL REFERENCES "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE"(id) ON DELETE CASCADE,
  cxc_id               uuid,
  pago_referenciado_id text,
  cuenta_eje_id        uuid,
  contrato_id          text,
  clave_concepto       text,
  orden_prelacion      integer,
  monto_aplicado       numeric NOT NULL CHECK (monto_aplicado > 0),
  saldo_anterior       numeric,
  saldo_posterior      numeric,
  fecha_aplicacion     date NOT NULL,
  correlation_id       text,
  usuario              text,
  creado_en            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aplic_det_detalle ON "EFINANCIANET_DB"."J_APLICACIONES_PAGO_DETALLE" (cxc_detalle_id);
CREATE INDEX IF NOT EXISTS idx_aplic_det_proceso ON "EFINANCIANET_DB"."J_APLICACIONES_PAGO_DETALLE" (proceso_id);

-- =============================================================================
-- §37, §40 — Abonos por contrato
--
-- Para una Línea de Crédito el abono se registra en J_MOVIMIENTOS_LINEA, que ya
-- existe desde la ESPECIFICACIÓN 2; esta tabla guarda la distribución del pago
-- por contrato (§36) y liga cada abono con el movimiento que lo materializó.
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_ABONOS_CONTRATO" (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_id           uuid NOT NULL REFERENCES "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO"(id) ON DELETE CASCADE,
  contrato_id          text NOT NULL,
  pago_referenciado_id text,
  monto                numeric NOT NULL CHECK (monto > 0),
  movimiento_id        uuid,
  fecha_aplicacion     date NOT NULL,
  creado_en            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abonos_contrato ON "EFINANCIANET_DB"."J_ABONOS_CONTRATO" (contrato_id);

-- ────────────────────────────────────────────────────────────────────────
-- La función vive en `public` porque PostgREST sólo expone ese esquema; las
-- tablas siguen en "EFINANCIANET_DB". SECURITY DEFINER + GRANT dan acceso al
-- rol anon sin permisos directos sobre las tablas. Mismo patrón que
-- public.reservar_cupo_gpo y public.aplicar_movimiento_tdc.
-- ────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.aplicar_pago_referenciado(
  text, text, text, uuid, numeric, date, jsonb, jsonb, jsonb, text, text, text);

CREATE OR REPLACE FUNCTION public.aplicar_pago_referenciado(
  p_pago_referenciado_id text,
  p_referencia_pago      text,
  p_cliente_id           text,
  p_cuenta_eje_id        uuid,
  p_monto_pago           numeric,
  p_fecha_pago           date,
  -- Plan del motor. Cada arreglo llega ya resuelto:
  --   p_aplic_detalle: { idCxC, idDetalle, claveConcepto, ordenPrelacion,
  --                      montoAplicado, saldoAnterior, saldoPosterior,
  --                      pagoTotalNuevo, estatusPagoNuevo }
  --   p_aplic_cxc:     { idCxC, idContrato, montoAplicado, saldoAnterior,
  --                      saldoPosterior, pagoTotalNuevo, estatusNuevo }
  --   p_abonos:        { idContrato, monto, montoLibera }
  --                    `montoLibera` es la parte que restituye linea disponible
  --                    segun "LIBERA LINEA CUANDO SE PAGA" del producto.
  p_aplic_detalle        jsonb,
  p_aplic_cxc            jsonb,
  p_abonos               jsonb,
  p_clave_cargo_eje      text,
  p_usuario              text,
  p_correlation_id       text
)
RETURNS TABLE (
  ok boolean, mensaje text, proceso_id uuid,
  monto_total_aplicado numeric, saldo_eje_posterior numeric,
  cxc_afectadas integer, lineas_afectadas integer, contratos_afectados integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
DECLARE
  v_proc_id     uuid;
  v_saldo_ant   numeric;
  v_saldo_post  numeric;
  v_data_eje    jsonb;
  v_total_det   numeric := 0;
  v_total_cxc   numeric := 0;
  v_total_abo   numeric := 0;
  v_ren         jsonb;
  v_filas       integer;
  v_cxc_count   integer := 0;
  v_det_count   integer := 0;
  v_abo_count   integer := 0;
  v_mov_id      uuid;
  v_estatus_ref text;
  v_existente   uuid;
  v_libera      numeric;
BEGIN
  -- ── §47 — validaciones de entrada ──
  IF p_monto_pago IS NULL OR p_monto_pago <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a cero.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_cuenta_eje_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró una Cuenta EJE válida para el Cliente % asociado al Pago Referenciado %.',
      p_cliente_id, p_pago_referenciado_id USING ERRCODE = 'no_data_found';
  END IF;

  -- ── §45 — idempotencia: el mismo pago no se aplica dos veces ──
  SELECT pr.id INTO v_existente
    FROM "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO" pr
   WHERE pr.pago_referenciado_id = p_pago_referenciado_id AND pr.resultado = 'OK';

  IF v_existente IS NOT NULL THEN
    RETURN QUERY
      SELECT true, 'El pago ya había sido aplicado (idempotente)'::text, pr.id,
             pr.monto_total_aplicado, pr.saldo_eje_posterior,
             pr.cxc_afectadas, pr.lineas_afectadas, pr.contratos_afectados
        FROM "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO" pr
       WHERE pr.id = v_existente;
    RETURN;
  END IF;

  -- ── Totales del plan, para verificar que cuadre (§48, §49) ──
  SELECT COALESCE(SUM((e->>'montoAplicado')::numeric), 0) INTO v_total_det
    FROM jsonb_array_elements(COALESCE(p_aplic_detalle, '[]'::jsonb)) e;
  SELECT COALESCE(SUM((e->>'montoAplicado')::numeric), 0) INTO v_total_cxc
    FROM jsonb_array_elements(COALESCE(p_aplic_cxc, '[]'::jsonb)) e;
  SELECT COALESCE(SUM((e->>'monto')::numeric), 0) INTO v_total_abo
    FROM jsonb_array_elements(COALESCE(p_abonos, '[]'::jsonb)) e;

  IF round(v_total_det, 2) <> round(v_total_cxc, 2)
     OR round(v_total_det, 2) <> round(v_total_abo, 2) THEN
    RAISE EXCEPTION
      '§49: el plan no cuadra — detalle %, CxC %, contratos %. No se aplicó nada.',
      v_total_det, v_total_cxc, v_total_abo USING ERRCODE = 'check_violation';
  END IF;

  -- ── §3/§4/§5 — la Cuenta EJE se bloquea y recibe el abono del pago ──
  -- FOR UPDATE serializa dos aplicaciones sobre el mismo cliente (§46).
  -- Igual que en aplicar_movimiento_tdc: `data` puede ser un string JSON.
  -- `saldo_actual` es de tipo `money`. El cast entero->money es de ASIGNACION,
  -- no implicito, asi que COALESCE(money, 0) no resuelve un tipo comun y falla
  -- con "could not convert type integer to money". Se normaliza a numeric al
  -- leer; al escribir, numeric->money si es cast de asignacion y funciona.
  SELECT COALESCE(c.saldo_actual::numeric, 0), public.jsonb_objeto(c.data)
    INTO v_saldo_ant, v_data_eje
    FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
   WHERE c.id = p_cuenta_eje_id AND c.cta_eje_chec = true
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró una Cuenta EJE válida para el Cliente % asociado al Pago Referenciado %.',
      p_cliente_id, p_pago_referenciado_id USING ERRCODE = 'no_data_found';
  END IF;

  -- §29 — no se puede aplicar más de lo que hay tras el abono.
  IF round(v_total_det, 2) > round(v_saldo_ant + p_monto_pago, 2) THEN
    RAISE EXCEPTION '§29: se intentó aplicar % con sólo % disponible.',
      v_total_det, v_saldo_ant + p_monto_pago USING ERRCODE = 'check_violation';
  END IF;

  -- §32/§33 — el saldo sube por el pago y baja por lo efectivamente aplicado.
  v_saldo_post := round(v_saldo_ant + p_monto_pago - v_total_det, 2);

  -- ── El proceso: se crea antes para que todo cuelgue de él (§23, §54) ──
  INSERT INTO "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO" (
    pago_referenciado_id, referencia_pago, cliente_id, cuenta_eje_id,
    monto_pago, monto_total_aplicado, saldo_eje_anterior, saldo_eje_posterior,
    fecha_pago, usuario, correlation_id
  ) VALUES (
    p_pago_referenciado_id, p_referencia_pago, p_cliente_id, p_cuenta_eje_id,
    p_monto_pago, v_total_det, v_saldo_ant, v_saldo_post,
    p_fecha_pago, p_usuario, p_correlation_id
  ) RETURNING id INTO v_proc_id;

  -- ── §9 … §18 — aplicaciones línea por línea ──
  FOR v_ren IN SELECT * FROM jsonb_array_elements(COALESCE(p_aplic_detalle, '[]'::jsonb))
  LOOP
    -- §46 — el WHERE con el saldo esperado es el candado optimista: si otro
    -- proceso movió la línea entre el cálculo y la escritura, no hay fila y
    -- toda la transacción aborta.
    UPDATE "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" d
       SET pago_total        = (v_ren->>'pagoTotalNuevo')::numeric,
           saldo_pendiente   = (v_ren->>'saldoPosterior')::numeric,
           estatus_pago      = v_ren->>'estatusPagoNuevo',
           -- §17 — sólo se mueve cuando hubo un monto aplicado
           fecha_ultimo_pago = p_fecha_pago
     WHERE d.id = (v_ren->>'idDetalle')::uuid
       AND round(COALESCE(d.monto - COALESCE(d.pago_total, 0), 0), 2)
           = round((v_ren->>'saldoAnterior')::numeric, 2);

    GET DIAGNOSTICS v_filas = ROW_COUNT;
    IF v_filas = 0 THEN
      RAISE EXCEPTION
        'El concepto % de la CxC % cambió de saldo durante el proceso. No se aplicó nada; vuelva a intentarlo.',
        v_ren->>'claveConcepto', v_ren->>'idCxC' USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO "EFINANCIANET_DB"."J_APLICACIONES_PAGO_DETALLE" (
      proceso_id, cxc_detalle_id, cxc_id, pago_referenciado_id, cuenta_eje_id,
      contrato_id, clave_concepto, orden_prelacion, monto_aplicado,
      saldo_anterior, saldo_posterior, fecha_aplicacion, correlation_id, usuario
    ) VALUES (
      v_proc_id, (v_ren->>'idDetalle')::uuid, (v_ren->>'idCxC')::uuid,
      p_pago_referenciado_id, p_cuenta_eje_id,
      v_ren->>'idContrato', v_ren->>'claveConcepto',
      NULLIF(v_ren->>'ordenPrelacion','')::int,
      (v_ren->>'montoAplicado')::numeric,
      (v_ren->>'saldoAnterior')::numeric, (v_ren->>'saldoPosterior')::numeric,
      p_fecha_pago, p_correlation_id, p_usuario
    );

    v_det_count := v_det_count + 1;
  END LOOP;

  -- ── §19 … §22 — encabezados de CxC ──
  FOR v_ren IN SELECT * FROM jsonb_array_elements(COALESCE(p_aplic_cxc, '[]'::jsonb))
  LOOP
    UPDATE "EFINANCIANET_DB"."J_CXC_LINEA" x
       SET pago_total        = (v_ren->>'pagoTotalNuevo')::numeric,
           saldo_pendiente   = (v_ren->>'saldoPosterior')::numeric,
           estatus           = v_ren->>'estatusNuevo',
           fecha_ultimo_pago = p_fecha_pago
     WHERE x.id = (v_ren->>'idCxC')::uuid;

    GET DIAGNOSTICS v_filas = ROW_COUNT;
    IF v_filas = 0 THEN
      RAISE EXCEPTION 'No se encontró la CxC %.', v_ren->>'idCxC' USING ERRCODE = 'no_data_found';
    END IF;

    INSERT INTO "EFINANCIANET_DB"."J_APLICACIONES_PAGO_CXC" (
      proceso_id, cxc_id, pago_referenciado_id, contrato_id, monto_aplicado,
      saldo_anterior, saldo_posterior, fecha_aplicacion
    ) VALUES (
      v_proc_id, (v_ren->>'idCxC')::uuid, p_pago_referenciado_id,
      v_ren->>'idContrato', (v_ren->>'montoAplicado')::numeric,
      (v_ren->>'saldoAnterior')::numeric, (v_ren->>'saldoPosterior')::numeric,
      p_fecha_pago
    );

    v_cxc_count := v_cxc_count + 1;
  END LOOP;

  -- ── §48 — header contra detalle, ya escritos ──
  IF EXISTS (
    SELECT 1
      FROM "EFINANCIANET_DB"."J_CXC_LINEA" x
      JOIN (
        SELECT d.cxc_id AS cid, SUM(d.pago_total) AS suma
          FROM "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" d
         GROUP BY d.cxc_id
      ) s ON s.cid = x.id
     WHERE x.id IN (
             SELECT (e->>'idCxC')::uuid
               FROM jsonb_array_elements(COALESCE(p_aplic_cxc, '[]'::jsonb)) e)
       AND round(x.pago_total, 2) <> round(s.suma, 2)
  ) THEN
    RAISE EXCEPTION
      '§48: el pago acumulado del documento no coincide con la suma de su detalle. No se aplicó nada.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── §31/§34 — Cargo "Aplicación Cobranza" y §37/§40 abonos por contrato ──
  -- §53: si no se aplicó nada, NO se genera cargo ni abonos; el importe
  -- simplemente se queda como saldo disponible en la Cuenta EJE.
  IF v_total_det > 0 THEN
    FOR v_ren IN SELECT * FROM jsonb_array_elements(COALESCE(p_abonos, '[]'::jsonb))
    LOOP
      v_mov_id := NULL;

      -- §40 — para una Línea de Crédito el abono es un movimiento de la línea.
      -- Si el contrato no es una línea conocida, sólo queda el renglón de
      -- distribución: no se inventa un movimiento en una tabla que no le toca.
      IF EXISTS (SELECT 1 FROM "EFINANCIANET_DB"."J_SALDOS_LINEA" sl
                  WHERE sl.linea_id = v_ren->>'idContrato') THEN
        INSERT INTO "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA" (
          linea_id, cliente_id, clave, concepto, descripcion, monto, fecha,
          naturaleza, efectos, calendario, total_consumido, correlation_id
        ) VALUES (
          v_ren->>'idContrato', p_cliente_id,
          COALESCE(p_clave_cargo_eje, 'PAGO_CLIENTE'),
          'Pago realizado por el cliente',
          'Aplicación de pago referenciado ' || COALESCE(p_pago_referenciado_id, ''),
          (v_ren->>'monto')::numeric, p_fecha_pago,
          'Abono', '[]'::jsonb, '[]'::jsonb, 0,
          COALESCE(p_correlation_id, '') || '|abono|' || (v_ren->>'idContrato')
        ) RETURNING id INTO v_mov_id;

        -- §40 — el abono libera línea disponible, pero SÓLO la parte cuyos
        -- conceptos tienen "LIBERA LÍNEA CUANDO SE PAGA" = Sí en el subtab
        -- "Afectación de la Línea" del producto. El motor ya resolvió esa
        -- pregunta concepto por concepto y manda el resultado en `montoLibera`.
        --
        -- COALESCE a `monto` a propósito: si llega un plan viejo sin ese campo
        -- —un bundle en caché contra esta versión del RPC— se conserva el
        -- comportamiento anterior en vez de dejar de liberar en silencio.
        v_libera := COALESCE(
          NULLIF(v_ren->>'montoLibera', '')::numeric,
          (v_ren->>'monto')::numeric);

        IF v_libera > 0 THEN
          UPDATE "EFINANCIANET_DB"."J_SALDOS_LINEA" sl
             SET saldo_disponible = LEAST(sl.monto_autorizado,
                                          sl.saldo_disponible + v_libera),
                 actualizado_en = now()
           WHERE sl.linea_id = v_ren->>'idContrato';
        END IF;
      END IF;

      INSERT INTO "EFINANCIANET_DB"."J_ABONOS_CONTRATO" (
        proceso_id, contrato_id, pago_referenciado_id, monto, movimiento_id, fecha_aplicacion
      ) VALUES (
        v_proc_id, v_ren->>'idContrato', p_pago_referenciado_id,
        (v_ren->>'monto')::numeric, v_mov_id, p_fecha_pago
      );

      v_abo_count := v_abo_count + 1;
    END LOOP;
  END IF;

  -- ── §4/§5/§31/§32 — los dos movimientos de la Cuenta EJE y su saldo ──
  -- El abono del pago y el cargo de lo aplicado se registran como dos renglones
  -- en data.movimientos, con la misma forma que lee el subtab Movimientos de
  -- Personas, y el saldo queda en su valor final.
  v_data_eje := jsonb_set(
    v_data_eje, '{movimientos}',
    public.jsonb_arreglo(v_data_eje->'movimientos')
    || jsonb_build_object(
         'id',           'pago-' || v_proc_id::text,
         'fechaHora',    (p_fecha_pago::timestamptz)::text,
         'fechaRegistro', now()::text,
         'tipo',          'Abono',
         'concepto',      'Pago referenciado',
         'referencia',    COALESCE(p_referencia_pago, p_pago_referenciado_id, ''),
         'monto',         p_monto_pago,
         'usuario',       COALESCE(p_usuario, 'Sistema'),
         'estatus',       'Aplicado',
         'saldoInicial',  v_saldo_ant,
         'saldoFinal',    round(v_saldo_ant + p_monto_pago, 2)),
    true);

  IF v_total_det > 0 THEN
    v_data_eje := jsonb_set(
      v_data_eje, '{movimientos}',
      public.jsonb_arreglo(v_data_eje->'movimientos')
      || jsonb_build_object(
           'id',           'aplic-' || v_proc_id::text,
           'fechaHora',    (p_fecha_pago::timestamptz)::text,
           'fechaRegistro', now()::text,
           'tipo',          'Cargo',
           'concepto',      'Aplicación Cobranza',
           'referencia',    COALESCE(p_pago_referenciado_id, ''),
           'monto',         v_total_det,
           'usuario',       COALESCE(p_usuario, 'Sistema'),
           'estatus',       'Aplicado',
           'saldoInicial',  round(v_saldo_ant + p_monto_pago, 2),
           'saldoFinal',    v_saldo_post),
      true);
  END IF;

  UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
     SET saldo_actual = v_saldo_post, data = v_data_eje
   WHERE id = p_cuenta_eje_id;

  -- ── §42 — estado del Pago Referenciado ──
  v_estatus_ref := CASE
    WHEN v_total_det >= p_monto_pago THEN 'Aplicado'
    WHEN v_total_det > 0            THEN 'Aplicado Parcialmente'
    ELSE 'Pendiente de Aplicación'
  END;

  UPDATE "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO"
     SET cxc_afectadas       = v_cxc_count,
         lineas_afectadas    = v_det_count,
         contratos_afectados = v_abo_count,
         estatus_pago_ref    = v_estatus_ref,
         mensaje             = 'Aplicación de pago realizada correctamente'
   WHERE id = v_proc_id;

  RETURN QUERY SELECT true, 'Aplicación de pago realizada correctamente'::text,
                      v_proc_id, v_total_det, v_saldo_post,
                      v_cxc_count, v_det_count, v_abo_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_pago_referenciado(
  text, text, text, uuid, numeric, date, jsonb, jsonb, jsonb, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.aplicar_pago_referenciado(
  text, text, text, uuid, numeric, date, jsonb, jsonb, jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_pago_referenciado(
  text, text, text, uuid, numeric, date, jsonb, jsonb, jsonb, text, text, text) TO service_role;

-- =============================================================================
-- §6/§6.1 — LECTOR DE CxC PAGABLES DEL CLIENTE
--
-- Devuelve las CxC del cliente que NO están pagadas, con su detalle embebido y
-- el orden_prelacion que congeló la ESPECIFICACIÓN 3 (§10). El motor decide qué
-- hacer con ellas; esta función sólo las entrega.
--
-- Cubre las CxC de Líneas de Crédito. Ver la nota de despliegue sobre otros
-- productos financieros.
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
     AND x.estatus NOT IN ('Pagada', 'Pagado', 'Cancelada')
   ORDER BY x.fecha_vencimiento, x.fecha_documento, x.id;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_cxc_pagables(text) TO anon;
GRANT EXECUTE ON FUNCTION public.obtener_cxc_pagables(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_cxc_pagables(text) TO service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- NOTAS DE DESPLIEGUE
--
-- 1. §6.1 pide buscar CxC en TODO el módulo de Cobranza, no sólo en Líneas de
--    Crédito. `obtener_cxc_pagables` cubre hoy J_CXC_LINEA. Las facturas
--    genéricas (J_FACTURAS / J_FACTURAS_DETALLE) NO se incluyen todavía porque
--    su detalle carece de `orden_prelacion`, y §9 exige aplicar por esa
--    prelación congelada. Incorporarlas requiere decidir qué prelación reciben
--    las facturas emitidas antes de la ESPECIFICACIÓN 3.
--
-- 2. §31 pide que la clave del movimiento "Aplicación Cobranza" sea
--    parametrizable. Se recibe en p_clave_cargo_eje; el cliente la toma del
--    producto. 'PAGO_CLIENTE' es sólo el último recurso si no llega nada.
--
-- 3. §40 — el abono a la Línea de Crédito devuelve saldo disponible, acotado
--    con LEAST(monto_autorizado, ...) para que un pago no pueda dejar la línea
--    con más disponible que su propio límite.
--
-- 4. Prueba de humo de §58.20 — debe devolver CERO filas:
--
--      SELECT p.id, p.monto_total_aplicado,
--             (SELECT COALESCE(SUM(monto_aplicado),0) FROM "EFINANCIANET_DB"."J_APLICACIONES_PAGO_DETALLE" WHERE proceso_id = p.id) AS det,
--             (SELECT COALESCE(SUM(monto_aplicado),0) FROM "EFINANCIANET_DB"."J_APLICACIONES_PAGO_CXC"     WHERE proceso_id = p.id) AS cxc,
--             (SELECT COALESCE(SUM(monto),0)          FROM "EFINANCIANET_DB"."J_ABONOS_CONTRATO"           WHERE proceso_id = p.id) AS abo
--        FROM "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO" p
--       WHERE p.resultado = 'OK'
--         AND (p.monto_total_aplicado <> (SELECT COALESCE(SUM(monto_aplicado),0) FROM "EFINANCIANET_DB"."J_APLICACIONES_PAGO_DETALLE" WHERE proceso_id = p.id)
--           OR p.monto_total_aplicado <> (SELECT COALESCE(SUM(monto_aplicado),0) FROM "EFINANCIANET_DB"."J_APLICACIONES_PAGO_CXC"     WHERE proceso_id = p.id)
--           OR p.monto_total_aplicado <> (SELECT COALESCE(SUM(monto),0)          FROM "EFINANCIANET_DB"."J_ABONOS_CONTRATO"           WHERE proceso_id = p.id));
-- =============================================================================
