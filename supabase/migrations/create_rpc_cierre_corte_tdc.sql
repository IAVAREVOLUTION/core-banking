-- =============================================================================
-- RPC: aplicar_cierre_corte_tdc — REQ-27 (HU-27.0, HU-27.5 … HU-27.8)
--
-- Persiste en UNA SOLA TRANSACCIÓN el resultado que calculó el motor
-- (src/app/lib/motorCierreCorteTDC.ts): la CxC, su detalle, la relación
-- Cargo→CxC, el cambio de estatus a 'Procesado' y la bitácora del cierre.
--
-- POR QUÉ UN RPC
--   §36 exige atomicidad y §37 exige que, ante un fallo, los Cargos vuelvan a
--   'Pendiente' y no quede una CxC parcial. Una función PL/pgSQL corre en una
--   transacción implícita: cualquier EXCEPTION revierte TODO lo que escribió,
--   sin trabajo extra. Mismo patrón que aplicar_movimiento_tdc (REQ-26) y
--   reservar_cupo_gpo (REQ-12).
--
-- EL MOTOR DECIDE QUÉ, ESTA FUNCIÓN DECIDE CÓMO
--   Periodo, selección de cargos, prelación, totales, pago mínimo y fecha
--   límite NO se recalculan aquí. Duplicar esas reglas en SQL garantizaría que
--   las dos copias se separaran con el tiempo.
--
-- §38 — NINGÚN COMMIT INTERNO
--   No hay COMMIT dentro de la función: todo participa de la transacción
--   superior del Cierre de Corte.
--
-- HOW TO DEPLOY — EN ESTE ORDEN:
--   1) create_rpc_movimiento_tdc.sql   (REQ-26)  ← crea J_CARGOS_LINEA
--   2) create_rpc_cierre_corte_tdc.sql (este)    ← la amplía y crea la CxC
--   Pegar en Supabase → SQL Editor → Run.
-- =============================================================================

-- =============================================================================
-- PRECONDICIÓN — este script AMPLÍA tablas que crea REQ-26
--
-- Sin esto, la primera sentencia falla con un 42P01 genérico ("relation does
-- not exist") que no dice qué hacer. Aquí se detiene con el motivo y el
-- remedio.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'EFINANCIANET_DB'
       AND table_name   = 'J_CARGOS_LINEA'
  ) THEN
    RAISE EXCEPTION
      'Falta ejecutar primero la migración de REQ-26 (create_rpc_movimiento_tdc.sql), que crea J_MOVIMIENTOS_LINEA, J_SALDOS_LINEA y J_CARGOS_LINEA. Córrala y vuelva a ejecutar este script.';
  END IF;
END $$;

-- =============================================================================
-- HU-27.0 — El Cargo necesita estatus, relación con su CxC y el bCargo original
-- =============================================================================
ALTER TABLE "EFINANCIANET_DB"."J_CARGOS_LINEA"
  ADD COLUMN IF NOT EXISTS estatus  text NOT NULL DEFAULT 'Pendiente',
  ADD COLUMN IF NOT EXISTS cxc_id   uuid,
  ADD COLUMN IF NOT EXISTS b_cargo  text NOT NULL DEFAULT 'S';

-- El estatus del Cargo ya cortado es 'Aplicado' — el mismo valor que usa el
-- catálogo de la interfaz (CAT_ESTATUS_CARGO). Antes se escribía 'Procesado',
-- que no existe en ese catálogo: el desplegable del subtab Cargos no podía
-- representarlo y caía a la primera opción, mostrando "Pendiente" un cargo que
-- ya estaba cortado. 'Procesado' se conserva en el CHECK por las filas que ya
-- se escribieron así.
DO $$
BEGIN
  -- Ampliar el CHECK si viene de una corrida anterior, que no admitía 'Aplicado'.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cargos_linea_estatus') THEN
    ALTER TABLE "EFINANCIANET_DB"."J_CARGOS_LINEA" DROP CONSTRAINT chk_cargos_linea_estatus;
  END IF;
  ALTER TABLE "EFINANCIANET_DB"."J_CARGOS_LINEA"
    ADD CONSTRAINT chk_cargos_linea_estatus
    CHECK (estatus IN ('Pendiente', 'Aplicado', 'Procesado', 'Cancelado'));
END $$;

-- CA-04: un Cargo no puede quedar ligado a dos CxC. El índice parcial permite
-- muchos NULL (cargos aún sin cortar) pero una sola CxC por cargo cortado.
CREATE INDEX IF NOT EXISTS idx_cargos_linea_estatus ON "EFINANCIANET_DB"."J_CARGOS_LINEA" (linea_id, estatus);
CREATE INDEX IF NOT EXISTS idx_cargos_linea_cxc     ON "EFINANCIANET_DB"."J_CARGOS_LINEA" (cxc_id) WHERE cxc_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cargos_linea_fecha   ON "EFINANCIANET_DB"."J_CARGOS_LINEA" (linea_id, fecha);

-- =============================================================================
-- Cuenta por Cobrar del corte y su detalle
--
-- Se modelan aquí porque el documento del corte necesita dos campos que la
-- factura genérica no tiene: monto_minimo_pagar y, en el detalle,
-- orden_prelacion — que es justo lo que consumirá la ESPECIFICACIÓN 4.
-- La emisión de Factura/Aviso hacia Cobranza sigue usando el servicio
-- existente (POST /cartera/facturas); esta tabla es el documento del corte.
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CXC_LINEA" (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id            text NOT NULL,
  cliente_id          text,
  solicitud_id        text,
  producto_id         text,
  folio               text,
  fecha_inicio        date NOT NULL,
  fecha_fin           date NOT NULL,
  -- §17: FechaDocumento = FechaFin (la fecha de CORTE). Regla obligatoria:
  -- no puede ser FechaInicio ni la fecha/hora del proceso.
  fecha_documento     date NOT NULL,
  fecha_vencimiento   date NOT NULL,
  monto_total_pagar   numeric NOT NULL CHECK (monto_total_pagar >= 0),
  monto_minimo_pagar  numeric NOT NULL CHECK (monto_minimo_pagar >= 0),
  cantidad_cargos     integer NOT NULL DEFAULT 0,
  moneda              text NOT NULL DEFAULT 'MXN',
  estatus             text NOT NULL DEFAULT 'Pendiente'
                      CHECK (estatus IN ('Pendiente','Facturada','Pagada','Cancelada')),
  factura_id          uuid,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  creado_por          text
);

CREATE INDEX IF NOT EXISTS idx_cxc_linea_linea ON "EFINANCIANET_DB"."J_CXC_LINEA" (linea_id);

-- CA-41: un solo documento por línea y periodo. Es la última defensa contra la
-- doble ejecución, aun si la verificación aplicativa fallara.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cxc_linea_periodo
  ON "EFINANCIANET_DB"."J_CXC_LINEA" (linea_id, fecha_inicio, fecha_fin)
  WHERE estatus <> 'Cancelada';

CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cxc_id              uuid NOT NULL REFERENCES "EFINANCIANET_DB"."J_CXC_LINEA"(id) ON DELETE CASCADE,
  cargo_id            uuid NOT NULL,
  clave_concepto      text NOT NULL,
  nombre_concepto     text,
  monto               numeric NOT NULL,
  fecha_cargo         date NOT NULL,
  naturaleza          text NOT NULL DEFAULT 'Cargo',
  -- CA-24: lo consume la ESPECIFICACIÓN 4 para aplicar pagos.
  orden_prelacion     integer NOT NULL,
  b_factura           text NOT NULL DEFAULT 'N',
  movimiento_origen   uuid,
  creado_en           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cxc_det_cxc   ON "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" (cxc_id, orden_prelacion);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cxc_det_cargo ON "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" (cargo_id);

-- =============================================================================
-- §40 — Bitácora de cierres
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CIERRES_CORTE" (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id            text NOT NULL,
  cxc_id              uuid,
  cliente_id          text,
  solicitud_id        text,
  producto_id         text,
  fecha_inicio        date NOT NULL,
  fecha_fin           date NOT NULL,
  fecha_vencimiento   date,
  monto_total_pagar   numeric,
  monto_minimo_pagar  numeric,
  cantidad_cargos     integer,
  fecha_hora_proceso  timestamptz NOT NULL DEFAULT now(),
  usuario_proceso     text,
  correlation_id      text,
  resultado           text NOT NULL,
  mensaje             text
);

CREATE INDEX IF NOT EXISTS idx_cierres_linea ON "EFINANCIANET_DB"."J_CIERRES_CORTE" (linea_id, fecha_fin);

-- =============================================================================
-- FUNCIÓN PRINCIPAL
--
-- p_detalle: arreglo del motor — { idCargo, claveConcepto, nombreConcepto,
--            monto, fechaCargo, naturaleza, ordenPrelacion, bFactura,
--            idMovimientoOrigen }
-- =============================================================================
-- ────────────────────────────────────────────────────────────────────────
-- POR QUÉ LA FUNCIÓN VIVE EN `public` Y LAS TABLAS EN `EFINANCIANET_DB`
--
-- PostgREST — lo que hay detrás de `supabase.rpc(...)` — sólo expone el esquema
-- `public`. Una función creada en "EFINANCIANET_DB" es invisible para el cliente
-- y devuelve PGRST202 ("Could not find the function"), que se confunde fácil con
-- "la migración no ha corrido".
--
-- Por eso: la función en `public`, las tablas en "EFINANCIANET_DB", y
-- SECURITY DEFINER + GRANT para que el rol anon pueda ejecutarla sin tener
-- permisos directos sobre las tablas. Mismo patrón que public.reservar_cupo_gpo
-- (REQ-12), que ya opera en producción.
-- ────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS "EFINANCIANET_DB".aplicar_cierre_corte_tdc(
  text, text, text, text, date, date, date, date, numeric, numeric, text, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.aplicar_cierre_corte_tdc(
  p_linea_id       text,
  p_cliente_id     text,
  p_solicitud_id   text,
  p_producto_id    text,
  p_fecha_inicio   date,
  p_fecha_fin      date,
  p_fecha_doc      date,
  p_fecha_venc     date,
  p_monto_total    numeric,
  p_monto_minimo   numeric,
  p_moneda         text,
  p_detalle        jsonb,
  p_usuario        text,
  p_correlation_id text
)
RETURNS TABLE (ok boolean, mensaje text, cxc_id uuid, folio text, cargos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
DECLARE
  v_cxc_id    uuid;
  v_folio     text;
  v_renglon   jsonb;
  v_cargo_id  uuid;
  v_filas     integer;
  v_total     integer := 0;
BEGIN
  IF p_detalle IS NULL OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'No hay cargos que procesar en el periodo % a %', p_fecha_inicio, p_fecha_fin
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── Encabezado de la CxC ──
  -- El índice único (linea_id, periodo) hace que una segunda ejecución del
  -- mismo corte falle aquí, revirtiendo todo: es la idempotencia de CA-41.
  v_folio := 'CXC-' || to_char(now(), 'YYYYMMDD') || '-' ||
             lpad((floor(random() * 100000))::int::text, 5, '0');

  INSERT INTO "EFINANCIANET_DB"."J_CXC_LINEA" (
    linea_id, cliente_id, solicitud_id, producto_id, folio,
    fecha_inicio, fecha_fin, fecha_documento, fecha_vencimiento,
    monto_total_pagar, monto_minimo_pagar, cantidad_cargos, moneda, creado_por
  ) VALUES (
    p_linea_id, p_cliente_id, p_solicitud_id, p_producto_id, v_folio,
    p_fecha_inicio, p_fecha_fin, p_fecha_doc, p_fecha_venc,
    p_monto_total, p_monto_minimo, jsonb_array_length(p_detalle),
    COALESCE(p_moneda, 'MXN'), p_usuario
  )
  RETURNING id INTO v_cxc_id;

  -- ── Detalle + relación + estatus, renglón por renglón ──
  FOR v_renglon IN SELECT * FROM jsonb_array_elements(p_detalle)
  LOOP
    v_cargo_id := (v_renglon->>'idCargo')::uuid;

    INSERT INTO "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" (
      cxc_id, cargo_id, clave_concepto, nombre_concepto, monto,
      fecha_cargo, naturaleza, orden_prelacion, b_factura, movimiento_origen
    ) VALUES (
      v_cxc_id,
      v_cargo_id,
      v_renglon->>'claveConcepto',
      v_renglon->>'nombreConcepto',
      (v_renglon->>'monto')::numeric,
      (v_renglon->>'fechaCargo')::date,
      COALESCE(v_renglon->>'naturaleza', 'Cargo'),
      (v_renglon->>'ordenPrelacion')::int,
      COALESCE(v_renglon->>'bFactura', 'N'),
      NULLIF(v_renglon->>'idMovimientoOrigen', '')::uuid
    );

    -- ── CA-39/CA-40 — Pendiente → Aplicado, DESPUÉS del detalle ──
    -- El WHERE con estatus='Pendiente' AND cxc_id IS NULL es el candado de
    -- concurrencia (CA-43): si otro proceso ya lo tomó, aquí no hay fila y la
    -- transacción completa aborta.
    -- Alias `cl` obligatorio: `cxc_id` es también parámetro de salida de
    -- RETURNS TABLE, y sin calificarlo el WHERE aborta con 42702.
    UPDATE "EFINANCIANET_DB"."J_CARGOS_LINEA" cl
       SET estatus = 'Aplicado',
           cxc_id  = v_cxc_id
     WHERE cl.id = v_cargo_id
       AND cl.estatus = 'Pendiente'
       AND cl.cxc_id IS NULL;

    GET DIAGNOSTICS v_filas = ROW_COUNT;
    IF v_filas = 0 THEN
      RAISE EXCEPTION 'El cargo % ya fue procesado por otro cierre o no está Pendiente', v_cargo_id
        USING ERRCODE = 'check_violation';
    END IF;

    v_total := v_total + 1;
  END LOOP;

  -- ── §40 — bitácora del cierre exitoso ──
  INSERT INTO "EFINANCIANET_DB"."J_CIERRES_CORTE" (
    linea_id, cxc_id, cliente_id, solicitud_id, producto_id,
    fecha_inicio, fecha_fin, fecha_vencimiento,
    monto_total_pagar, monto_minimo_pagar, cantidad_cargos,
    usuario_proceso, correlation_id, resultado, mensaje
  ) VALUES (
    p_linea_id, v_cxc_id, p_cliente_id, p_solicitud_id, p_producto_id,
    p_fecha_inicio, p_fecha_fin, p_fecha_venc,
    p_monto_total, p_monto_minimo, v_total,
    p_usuario, p_correlation_id, 'OK', 'Cierre procesado correctamente'
  );

  RETURN QUERY SELECT true, 'Cierre procesado correctamente'::text, v_cxc_id, v_folio, v_total;
END;
$$;

-- =============================================================================
-- LECTOR DE CARGOS
--
-- El subtab Cierre de Corte necesita los Cargos que dejó la ESPECIFICACIÓN 2.
-- Viven en "EFINANCIANET_DB"."J_CARGOS_LINEA", que PostgREST no expone; sin
-- esta función la pantalla no tendría forma de leerlos y seguiría dependiendo
-- del store de sesión, con lo que las dos especificaciones quedarían
-- desconectadas.
--
-- Devuelve el periodo completo SIN filtrar por estatus ni bCargo: filtrar es
-- decisión del motor (§8.1/§8.2), no de la consulta. Así la pantalla puede
-- mostrar también los ya procesados y los no facturables.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.obtener_cargos_linea(
  p_linea_id     text,
  p_fecha_inicio date DEFAULT NULL,
  p_fecha_fin    date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, clave text, nombre text, naturaleza text, monto numeric,
  fecha date, b_factura text, b_cargo text, estatus text,
  movimiento_id uuid, cxc_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
  SELECT c.id, c.clave, c.nombre, c.naturaleza, c.monto,
         c.fecha, c.b_factura, c.b_cargo, c.estatus,
         c.movimiento_id, c.cxc_id
    FROM "EFINANCIANET_DB"."J_CARGOS_LINEA" c
   WHERE c.linea_id = p_linea_id
     AND (p_fecha_inicio IS NULL OR c.fecha >= p_fecha_inicio)
     AND (p_fecha_fin    IS NULL OR c.fecha <= p_fecha_fin)
   ORDER BY c.fecha, c.id;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_cargos_linea(text, date, date) TO anon;
GRANT EXECUTE ON FUNCTION public.obtener_cargos_linea(text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_cargos_linea(text, date, date) TO service_role;

-- ── Permisos ──
GRANT EXECUTE ON FUNCTION public.aplicar_cierre_corte_tdc(
  text, text, text, text, date, date, date, date, numeric, numeric, text, jsonb, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.aplicar_cierre_corte_tdc(
  text, text, text, text, date, date, date, date, numeric, numeric, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_cierre_corte_tdc(
  text, text, text, text, date, date, date, date, numeric, numeric, text, jsonb, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICACIÓN DE §44.10
--
-- "Ningún Cargo puede quedar en 'Aplicado' si la CxC o su Detail no fueron
--  creados correctamente". Esta consulta debe devolver CERO filas siempre;
--  úsela como prueba de humo después de cualquier cierre:
--
--   SELECT c.id, c.estatus, c.cxc_id
--     FROM "EFINANCIANET_DB"."J_CARGOS_LINEA" c
--     LEFT JOIN "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" d ON d.cargo_id = c.id
--    WHERE c.estatus IN ('Aplicado', 'Procesado')
--      AND (c.cxc_id IS NULL OR d.id IS NULL);
--
-- La integridad la garantizan tres cosas, no la consulta:
--   1. el UPDATE de estatus ocurre DESPUÉS del INSERT del detalle;
--   2. ambos viven en la misma transacción implícita de la función;
--   3. ux_cxc_det_cargo impide dos detalles para el mismo cargo.
-- =============================================================================
