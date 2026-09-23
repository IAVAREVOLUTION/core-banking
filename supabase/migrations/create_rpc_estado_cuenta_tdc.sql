-- =============================================================================
-- ESPECIFICACIÓN 6 — Generación de Estado de Cuenta (REQ-31)
--
-- El Estado de Cuenta es un SNAPSHOT histórico: se congela lo que se sabía a
-- la Fecha Estado y no se recalcula nunca. Por eso el detalle se guarda aquí y
-- no se deriva en tiempo de consulta de las tablas vivas.
--
-- ORDEN DE DESPLIEGUE: después de create_rpc_aplicacion_pagos_tdc.sql
-- (ESPECIFICACIÓN 4) — necesita J_APLICACIONES_PAGO_CXC y las columnas
-- pago_total / saldo_pendiente de J_CXC_LINEA.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'EFINANCIANET_DB' AND table_name = 'J_APLICACIONES_PAGO_CXC'
  ) THEN
    RAISE EXCEPTION
      'Falta ejecutar create_rpc_aplicacion_pagos_tdc.sql (ESPECIFICACIÓN 4). Córralo y vuelva a ejecutar este script.';
  END IF;
END $$;

-- =============================================================================
-- §14 — La entidad histórica
--
-- `id_documento_pdf` es la ruta en Storage. El CHECK de §22 es el que impide
-- que exista un GENERADO sin PDF: no es una convención, es la base quien lo
-- prohíbe. La Decisión D1 de REQ-31 se apoya en él — si el upload falla, el
-- INSERT no puede pasar como GENERADO.
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_ESTADOS_CUENTA" (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id                 text NOT NULL,
  cliente_id               text,
  producto_id              text,

  -- H-1: el Aviso de Vencimiento ES la CxC. Un solo id para ambos conceptos.
  cxc_id                   uuid,
  folio_aviso              text,

  fecha_inicio_periodo     date,
  fecha_fin_periodo        date,
  fecha_corte              date,
  fecha_limite_pago        date,

  -- §8 — las tres fechas viven separadas y pueden diferir.
  fecha_estado             date NOT NULL,
  fecha_generacion         timestamptz NOT NULL DEFAULT now(),

  limite_autorizado        numeric,
  saldo_anterior           numeric,
  cargos_periodo           numeric,
  pagos_periodo            numeric,
  saldo_al_corte           numeric,
  saldo_consume_linea      numeric,
  credito_disponible       numeric,

  pago_minimo              numeric,
  -- D2/H-2 — el sistema no lo calcula todavía. Se guarda en cero y rotulado,
  -- para no inventar una cifra en el documento.
  pago_no_genera_intereses numeric NOT NULL DEFAULT 0,
  pago_no_genera_intereses_configurado boolean NOT NULL DEFAULT false,

  id_documento_pdf         text,
  url_documento            text,
  plantilla_nombre         text,
  plantilla_version        text,
  moneda                   text NOT NULL DEFAULT 'MXN',

  estatus                  text NOT NULL DEFAULT 'GENERADO'
                           CHECK (estatus IN ('GENERADO','ERROR','CANCELADO')),
  usuario_generacion       text,
  codigo_error             text,
  mensaje_error            text,
  correlation_id           text,

  fecha_creacion           timestamptz NOT NULL DEFAULT now(),
  fecha_actualizacion      timestamptz NOT NULL DEFAULT now(),

  -- §22 — la regla que no admite excepción.
  CONSTRAINT chk_edocta_generado_con_pdf
    CHECK (estatus <> 'GENERADO' OR id_documento_pdf IS NOT NULL)
);

-- =============================================================================
-- §16 / §21.3 — el candado real contra duplicados
--
-- Parcial a propósito: un intento fallido (ERROR) no debe bloquear el
-- reintento de la misma Fecha Estado. §19 exige dejar rastro del fallo, §16
-- sólo prohíbe DOS documentos válidos.
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS ux_edocta_linea_fecha
  ON "EFINANCIANET_DB"."J_ESTADOS_CUENTA" (linea_id, fecha_estado)
  WHERE estatus <> 'ERROR';

CREATE INDEX IF NOT EXISTS idx_edocta_linea
  ON "EFINANCIANET_DB"."J_ESTADOS_CUENTA" (linea_id, fecha_estado DESC);

-- =============================================================================
-- §12 paso 13 — el detalle congelado
--
-- Movimientos del periodo, pagos considerados y conceptos del Aviso, tal como
-- se vieron al generar. Si mañana cambia la tabla viva, este documento no.
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_ESTADOS_CUENTA_DETALLE" (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estado_cuenta_id   uuid NOT NULL
                     REFERENCES "EFINANCIANET_DB"."J_ESTADOS_CUENTA"(id) ON DELETE CASCADE,
  tipo               text NOT NULL CHECK (tipo IN ('MOVIMIENTO','PAGO','CONCEPTO')),
  orden              integer,
  clave              text,
  nombre             text,
  naturaleza         text,
  referencia         text,
  monto              numeric,
  pagado             numeric,
  saldo              numeric,
  fecha              date,
  origen_id          text,
  creado_en          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edocta_det_estado
  ON "EFINANCIANET_DB"."J_ESTADOS_CUENTA_DETALLE" (estado_cuenta_id, tipo, orden);

-- =============================================================================
-- §19 — Bitácora de auditoría
--
-- Toda generación deja rastro, la que funcionó y la que falló. Va aparte del
-- documento porque un fallo no produce documento pero sí debe quedar auditado.
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_AUDITORIA_ESTADO_CUENTA" (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id           text NOT NULL,
  cliente_id         text,
  estado_cuenta_id   uuid,
  fecha_estado       date,
  usuario            text,
  resultado          text NOT NULL,
  codigo_error       text,
  mensaje_error      text,
  correlation_id     text,
  fecha_hora         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_edocta_linea
  ON "EFINANCIANET_DB"."J_AUDITORIA_ESTADO_CUENTA" (linea_id, fecha_hora DESC);

-- ────────────────────────────────────────────────────────────────────────
-- Las funciones viven en `public` porque PostgREST sólo expone ese esquema;
-- las tablas siguen en "EFINANCIANET_DB". SECURITY DEFINER + GRANT dan acceso
-- al rol anon sin permisos directos. Mismo patrón que
-- public.aplicar_cierre_corte_tdc y public.aplicar_pago_referenciado.
-- ────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- §22 — La generación completa, en UNA transacción
--
-- El PDF ya está en Storage cuando se llama: `p_id_documento_pdf` es su ruta.
-- Si esta función falla, el PDF queda huérfano en el bucket — inofensivo. Al
-- revés sería el problema: una fila GENERADO sin documento. Por eso el orden
-- es subir primero y registrar después (D1).
-- =============================================================================
DROP FUNCTION IF EXISTS public.generar_estado_cuenta_tdc(
  text, text, text, uuid, text, date, date, date, date, date,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, boolean, text, text, text, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.generar_estado_cuenta_tdc(
  p_linea_id             text,
  p_cliente_id           text,
  p_producto_id          text,
  p_cxc_id               uuid,
  p_folio_aviso          text,
  p_fecha_inicio_periodo date,
  p_fecha_fin_periodo    date,
  p_fecha_corte          date,
  p_fecha_limite_pago    date,
  p_fecha_estado         date,
  p_limite_autorizado    numeric,
  p_saldo_anterior       numeric,
  p_cargos_periodo       numeric,
  p_pagos_periodo        numeric,
  p_saldo_al_corte       numeric,
  p_saldo_consume_linea  numeric,
  p_credito_disponible   numeric,
  p_pago_minimo          numeric,
  p_pago_no_genera_int   numeric,
  p_pago_no_genera_conf  boolean,
  p_id_documento_pdf     text,
  p_url_documento        text,
  p_plantilla_nombre     text,
  p_plantilla_version    text,
  p_moneda               text,
  p_usuario              text,
  p_correlation_id       text,
  -- Renglones { tipo, orden, clave, nombre, naturaleza, referencia,
  --             monto, pagado, saldo, fecha, origenId }
  p_detalle              jsonb
)
RETURNS TABLE (
  ok boolean, mensaje text, estado_id uuid, renglones integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
DECLARE
  v_id        uuid;
  v_existente uuid;
  v_ren       integer := 0;
BEGIN
  IF p_fecha_estado IS NULL THEN
    RAISE EXCEPTION 'Debe capturar la Fecha Estado.' USING ERRCODE = 'check_violation';
  END IF;

  -- §22 — la comprobación explícita, además del CHECK de la tabla, para que
  -- el mensaje sea entendible y no un error de constraint.
  IF p_id_documento_pdf IS NULL OR btrim(p_id_documento_pdf) = '' THEN
    RAISE EXCEPTION
      'No se puede registrar un Estado de Cuenta sin su PDF. No se guardó nada.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- §16 / §21 — idempotencia. El índice único lo garantiza aun con dos
  -- procesos simultáneos; esto devuelve el mensaje que pide la especificación.
  SELECT e.id INTO v_existente
    FROM "EFINANCIANET_DB"."J_ESTADOS_CUENTA" e
   WHERE e.linea_id = p_linea_id
     AND e.fecha_estado = p_fecha_estado
     AND e.estatus <> 'ERROR';

  IF v_existente IS NOT NULL THEN
    RETURN QUERY SELECT false,
      format('Ya existe un Estado de Cuenta generado para la fecha %s.',
             to_char(p_fecha_estado, 'DD/MM/YYYY'))::text,
      v_existente, 0;
    RETURN;
  END IF;

  INSERT INTO "EFINANCIANET_DB"."J_ESTADOS_CUENTA" (
    linea_id, cliente_id, producto_id, cxc_id, folio_aviso,
    fecha_inicio_periodo, fecha_fin_periodo, fecha_corte, fecha_limite_pago,
    fecha_estado, limite_autorizado, saldo_anterior, cargos_periodo,
    pagos_periodo, saldo_al_corte, saldo_consume_linea, credito_disponible,
    pago_minimo, pago_no_genera_intereses, pago_no_genera_intereses_configurado,
    id_documento_pdf, url_documento, plantilla_nombre, plantilla_version,
    moneda, estatus, usuario_generacion, correlation_id
  ) VALUES (
    p_linea_id, p_cliente_id, p_producto_id, p_cxc_id, p_folio_aviso,
    p_fecha_inicio_periodo, p_fecha_fin_periodo, p_fecha_corte, p_fecha_limite_pago,
    p_fecha_estado, p_limite_autorizado, p_saldo_anterior, p_cargos_periodo,
    p_pagos_periodo, p_saldo_al_corte, p_saldo_consume_linea, p_credito_disponible,
    p_pago_minimo, COALESCE(p_pago_no_genera_int, 0), COALESCE(p_pago_no_genera_conf, false),
    p_id_documento_pdf, p_url_documento, p_plantilla_nombre, p_plantilla_version,
    COALESCE(p_moneda, 'MXN'), 'GENERADO', p_usuario, p_correlation_id
  ) RETURNING id INTO v_id;

  INSERT INTO "EFINANCIANET_DB"."J_ESTADOS_CUENTA_DETALLE" (
    estado_cuenta_id, tipo, orden, clave, nombre, naturaleza, referencia,
    monto, pagado, saldo, fecha, origen_id
  )
  SELECT v_id,
         e->>'tipo',
         NULLIF(e->>'orden','')::int,
         e->>'clave', e->>'nombre', e->>'naturaleza', e->>'referencia',
         NULLIF(e->>'monto','')::numeric,
         NULLIF(e->>'pagado','')::numeric,
         NULLIF(e->>'saldo','')::numeric,
         NULLIF(e->>'fecha','')::date,
         e->>'origenId'
    FROM jsonb_array_elements(COALESCE(p_detalle, '[]'::jsonb)) e;

  GET DIAGNOSTICS v_ren = ROW_COUNT;

  -- §19 — la generación exitosa también se audita.
  INSERT INTO "EFINANCIANET_DB"."J_AUDITORIA_ESTADO_CUENTA" (
    linea_id, cliente_id, estado_cuenta_id, fecha_estado, usuario,
    resultado, correlation_id
  ) VALUES (
    p_linea_id, p_cliente_id, v_id, p_fecha_estado, p_usuario, 'OK', p_correlation_id
  );

  RETURN QUERY SELECT true, 'Estado de Cuenta generado correctamente'::text, v_id, v_ren;
END;
$$;

-- =============================================================================
-- §19 — Registro de un intento fallido
--
-- Deja rastro sin crear documento. Nunca escribe en J_ESTADOS_CUENTA: un
-- fallo no debe ocupar la combinación (linea, fecha) que §16 protege.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.registrar_error_estado_cuenta(
  p_linea_id       text,
  p_cliente_id     text,
  p_fecha_estado   date,
  p_usuario        text,
  p_codigo_error   text,
  p_mensaje_error  text,
  p_correlation_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO "EFINANCIANET_DB"."J_AUDITORIA_ESTADO_CUENTA" (
    linea_id, cliente_id, fecha_estado, usuario, resultado,
    codigo_error, mensaje_error, correlation_id
  ) VALUES (
    p_linea_id, p_cliente_id, p_fecha_estado, p_usuario, 'ERROR',
    p_codigo_error, p_mensaje_error, p_correlation_id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- =============================================================================
-- §13 / §20 — Historial de Estados de Cuenta, más reciente arriba
-- =============================================================================
CREATE OR REPLACE FUNCTION public.obtener_estados_cuenta(p_linea_id text)
RETURNS TABLE (
  id uuid, fecha_estado date, fecha_inicio_periodo date, fecha_fin_periodo date,
  fecha_corte date, fecha_limite_pago date, fecha_generacion timestamptz,
  saldo_al_corte numeric, pago_minimo numeric, pago_no_genera_intereses numeric,
  pago_no_genera_intereses_configurado boolean,
  limite_autorizado numeric, credito_disponible numeric,
  estatus text, usuario_generacion text, folio_aviso text,
  id_documento_pdf text, url_documento text, moneda text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
  SELECT e.id, e.fecha_estado, e.fecha_inicio_periodo, e.fecha_fin_periodo,
         e.fecha_corte, e.fecha_limite_pago, e.fecha_generacion,
         e.saldo_al_corte, e.pago_minimo, e.pago_no_genera_intereses,
         e.pago_no_genera_intereses_configurado,
         e.limite_autorizado, e.credito_disponible,
         e.estatus, e.usuario_generacion, e.folio_aviso,
         e.id_documento_pdf, e.url_documento, e.moneda
    FROM "EFINANCIANET_DB"."J_ESTADOS_CUENTA" e
   WHERE e.linea_id = p_linea_id
   ORDER BY e.fecha_estado DESC, e.fecha_generacion DESC;
$$;

-- =============================================================================
-- §9 — Pagos aplicados de una Línea hasta una fecha
--
-- Función NUEVA: no se toca ningún lector de las especificaciones anteriores.
-- El vínculo pago → línea pasa por la CxC, que es quien conoce `linea_id`.
-- Sólo entran procesos con resultado 'OK' (§9: nada cancelado ni pendiente).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.obtener_pagos_aplicados_linea(
  p_linea_id    text,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, cxc_id uuid, proceso_id uuid, referencia text,
  monto_aplicado numeric, fecha_pago date, estatus text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
  SELECT a.id, a.cxc_id, a.proceso_id,
         COALESCE(pr.referencia_pago, a.pago_referenciado_id),
         a.monto_aplicado,
         COALESCE(pr.fecha_pago, a.fecha_aplicacion),
         COALESCE(pr.estatus_pago_ref, 'Aplicado')
    FROM "EFINANCIANET_DB"."J_APLICACIONES_PAGO_CXC" a
    JOIN "EFINANCIANET_DB"."J_CXC_LINEA" x  ON x.id = a.cxc_id
    LEFT JOIN "EFINANCIANET_DB"."J_PROCESOS_APLICACION_PAGO" pr ON pr.id = a.proceso_id
   WHERE x.linea_id = p_linea_id
     AND COALESCE(pr.resultado, 'OK') = 'OK'
     AND (p_fecha_hasta IS NULL
          OR COALESCE(pr.fecha_pago, a.fecha_aplicacion) <= p_fecha_hasta)
   ORDER BY COALESCE(pr.fecha_pago, a.fecha_aplicacion), a.id;
$$;

-- =============================================================================
-- §6 / §14 — Límite y disponible de la Línea
--
-- Función NUEVA. `J_SALDOS_LINEA` no tenía lector expuesto: la ESPEC 2 sólo
-- devuelve el saldo como salida de aplicar_movimiento_tdc, y consultar no
-- debería exigir aplicar un movimiento.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.obtener_saldo_linea(p_linea_id text)
RETURNS TABLE (
  linea_id text, monto_autorizado numeric, saldo_disponible numeric,
  actualizado_en timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
  SELECT s.linea_id, s.monto_autorizado, s.saldo_disponible, s.actualizado_en
    FROM "EFINANCIANET_DB"."J_SALDOS_LINEA" s
   WHERE s.linea_id = p_linea_id;
$$;

-- ── Permisos ──
GRANT EXECUTE ON FUNCTION public.generar_estado_cuenta_tdc(
  text, text, text, uuid, text, date, date, date, date, date,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, boolean, text, text, text, text, text, text, text, jsonb) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.registrar_error_estado_cuenta(
  text, text, date, text, text, text, text) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.obtener_estados_cuenta(text) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.obtener_pagos_aplicados_linea(text, date) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.obtener_saldo_linea(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- NOTAS DE DESPLIEGUE
--
-- 1. El PDF se guarda en el bucket de expedientes que ya usa la Carta Oferta.
--    Aquí sólo se registra su ruta: la base no almacena el binario (D1 de
--    REQ-31, opción a).
--
-- 2. §22 — prueba de humo. Debe devolver CERO filas siempre:
--
--      SELECT id, estatus, id_documento_pdf
--        FROM "EFINANCIANET_DB"."J_ESTADOS_CUENTA"
--       WHERE estatus = 'GENERADO' AND id_documento_pdf IS NULL;
--
-- 3. §16 — prueba de humo de duplicados. También CERO filas:
--
--      SELECT linea_id, fecha_estado, COUNT(*)
--        FROM "EFINANCIANET_DB"."J_ESTADOS_CUENTA"
--       WHERE estatus <> 'ERROR'
--       GROUP BY linea_id, fecha_estado
--      HAVING COUNT(*) > 1;
--
-- 4. §16 deja la REGENERACIÓN como acción explícita y separada: no se
--    implementó. Para rehacer un documento hay que cancelarlo primero
--    (estatus 'CANCELADO'), que es lo que libera el índice único parcial…
--    salvo que se quiera conservar el cancelado: en ese caso el índice debe
--    excluir también 'CANCELADO'. Se dejó incluyéndolo a propósito, para que
--    cancelar NO habilite un duplicado silencioso.
-- =============================================================================
