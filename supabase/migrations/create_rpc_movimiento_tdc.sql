-- =============================================================================
-- RPC: aplicar_movimiento_tdc — REQ-26 HU-26.6 (RN-08)
--
-- Aplica en UNA SOLA TRANSACCIÓN todos los efectos que el motor
-- (src/app/lib/motorMovimientosTDC.ts) calculó para un movimiento de Tarjeta
-- de Crédito: el movimiento, el descuento del saldo disponible de la línea,
-- los cargos de la línea y el movimiento de la Cuenta Eje del cliente.
--
-- POR QUÉ UN RPC Y NO VARIOS PUT
--   Hoy cada entidad se escribe con su propio PUT contra el edge function, con
--   deep merge por registro. Un fallo a la mitad deja el saldo descontado y los
--   cargos sin crear — exactamente lo que la especificación prohíbe. Una
--   función PL/pgSQL corre dentro de una transacción implícita: cualquier
--   EXCEPTION revierte TODO lo que la función haya escrito, sin trabajo extra.
--
-- EL DESCUENTO DEL SALDO ES ATÓMICO (CA-31)
--   UPDATE ... SET saldo_disponible = saldo_disponible - p_total
--                WHERE saldo_disponible >= p_total
--   Postgres evalúa el WHERE y aplica el SET bajo el mismo bloqueo de fila, así
--   que dos movimientos concurrentes no pueden sobregirar la línea: el segundo
--   ve el saldo ya actualizado por el primero (o espera su commit). Mismo
--   patrón que reservar_cupo_gpo (REQ-12).
--
-- EL MOTOR DECIDE QUÉ, ESTA FUNCIÓN DECIDE CÓMO
--   Las reglas de negocio (Max de comisión, IVA sobre comisión, MSI/MCI,
--   cash back) NO se reimplementan aquí. El cliente manda el arreglo de efectos
--   ya resuelto y esta función sólo lo persiste. Duplicar las reglas en SQL
--   garantizaría que las dos copias se separen con el tiempo.
--
-- HOW TO DEPLOY: pegar en Supabase → SQL Editor → Run
-- =============================================================================

-- =============================================================================
-- jsonb_objeto / jsonb_arreglo — normalizadores de JSONB mal codificado
--
-- POR QUÉ HACEN FALTA
--   `J_CUENTAS_CORP_CLIENTES.data` NO siempre es un objeto JSON. En esta
--   instalación las 19 cuentas eje lo tienen como *string* JSON doble-codificado,
--   y existen filas con la variante "char-split" ({"0":"{","1":"\"",...}).
--   `jsonb_set` sobre un string falla con 22023 "cannot set path in scalar".
--
--   El código TypeScript ya vive con esto: `parseJsonbData` en el edge function
--   maneja las tres formas. Estas funciones son su equivalente en SQL, para que
--   los RPC no se rompan con datos que el resto del sistema sí lee.
--
--   Al escribir, los RPC dejan un objeto JSONB correcto: cada fila tocada queda
--   normalizada y `parseJsonbData` la sigue leyendo igual.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.jsonb_objeto(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v_txt text;
  v_out jsonb;
BEGIN
  IF p IS NULL THEN RETURN '{}'::jsonb; END IF;

  IF jsonb_typeof(p) = 'object' THEN
    -- Variante char-split: {"0":"{","1":"\"",...} — se reconstruye la cadena.
    IF p ? '0' THEN
      BEGIN
        SELECT string_agg(e.value, '' ORDER BY e.key::int)
          INTO v_txt
          FROM jsonb_each_text(p) e
         WHERE e.key ~ '^[0-9]+$';
        v_out := v_txt::jsonb;
        RETURN CASE WHEN jsonb_typeof(v_out) = 'object' THEN v_out ELSE '{}'::jsonb END;
      EXCEPTION WHEN others THEN
        RETURN '{}'::jsonb;
      END;
    END IF;
    RETURN p;
  END IF;

  IF jsonb_typeof(p) = 'string' THEN
    BEGIN
      -- `#>> '{}'` saca el texto del string JSON; luego se reinterpreta.
      v_out := (p #>> '{}')::jsonb;
      RETURN CASE WHEN jsonb_typeof(v_out) = 'object' THEN v_out ELSE '{}'::jsonb END;
    EXCEPTION WHEN others THEN
      RETURN '{}'::jsonb;
    END;
  END IF;

  RETURN '{}'::jsonb;
END;
$fn$;

/* Un arreglo garantizado: `||` sobre algo que no es arreglo produce basura. */
CREATE OR REPLACE FUNCTION public.jsonb_arreglo(p jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
           WHEN p IS NULL THEN '[]'::jsonb
           WHEN jsonb_typeof(p) = 'array' THEN p
           ELSE '[]'::jsonb
         END;
$fn$;

GRANT EXECUTE ON FUNCTION public.jsonb_objeto(jsonb)  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.jsonb_arreglo(jsonb) TO anon, authenticated, service_role;

-- =============================================================================
-- Tabla: movimientos de la Línea de Crédito (HU-26.0)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA" (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id          text NOT NULL,
  cliente_id        text,
  clave             text NOT NULL,
  concepto          text,
  descripcion       text,
  monto             numeric NOT NULL CHECK (monto >= 0),
  fecha             date NOT NULL,
  naturaleza        text NOT NULL CHECK (naturaleza IN ('Cargo','Abono')),
  -- Efectos derivados, tal como los devolvió el motor. Se guardan para poder
  -- auditar por qué el saldo quedó como quedó sin recalcular nada.
  efectos           jsonb NOT NULL DEFAULT '[]'::jsonb,
  calendario        jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_consumido   numeric NOT NULL DEFAULT 0,
  -- §8 Idempotencia: identificador de la operación enviado por el cliente. Dos
  -- envíos del mismo movimiento (doble clic, reintento de red) traen el mismo
  -- valor y el segundo NO vuelve a descontar la línea.
  correlation_id    text,
  creado_en         timestamptz NOT NULL DEFAULT now()
);

-- Por si la tabla ya existía de una corrida anterior sin esta columna.
ALTER TABLE "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA"
  ADD COLUMN IF NOT EXISTS correlation_id text;

CREATE INDEX IF NOT EXISTS idx_mov_linea_linea  ON "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA" (linea_id);
CREATE INDEX IF NOT EXISTS idx_mov_linea_fecha  ON "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA" (fecha);

-- La unicidad es lo que hace la idempotencia real: aunque dos peticiones
-- simultáneas pasen a la vez por el SELECT previo, la segunda choca aquí.
CREATE UNIQUE INDEX IF NOT EXISTS ux_mov_linea_correlation
  ON "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA" (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- =============================================================================
-- Tabla: saldo disponible por Línea de Crédito
-- Se mantiene como fila propia — no derivada — para poder bloquearla y
-- descontarla atómicamente (CA-31).
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_SALDOS_LINEA" (
  linea_id          text PRIMARY KEY,
  monto_autorizado  numeric NOT NULL CHECK (monto_autorizado >= 0),
  saldo_disponible  numeric NOT NULL CHECK (saldo_disponible >= 0),
  actualizado_en    timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Tabla: cargos de la Línea (destino del punto 3 cuando bCargo = 'S')
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CARGOS_LINEA" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id      text NOT NULL,
  movimiento_id uuid REFERENCES "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA"(id) ON DELETE CASCADE,
  clave         text NOT NULL,
  nombre        text,
  naturaleza    text NOT NULL CHECK (naturaleza IN ('Cargo','Abono')),
  monto         numeric NOT NULL,
  fecha         date NOT NULL,
  b_factura     text NOT NULL DEFAULT 'N' CHECK (b_factura IN ('S','N')),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargos_linea_linea ON "EFINANCIANET_DB"."J_CARGOS_LINEA" (linea_id);

-- =============================================================================
-- FUNCIÓN PRINCIPAL
--
-- p_efectos:   arreglo de objetos del motor — { clave, nombre, naturaleza,
--              monto, fecha, bFactura, bCargo, consumeLineaDisponible, origen }
-- p_cuenta_eje: arreglo de { clave, descripcion, monto, fecha, naturaleza,
--              efectoEnSaldo } — normalmente 0 o 1 elementos (cash back)
--
-- Devuelve: ok, mensaje, saldo_disponible resultante y el id del movimiento.
-- =============================================================================
-- Si una corrida anterior dejó la versión sin p_correlation_id, se elimina para
-- no quedar con dos sobrecargas ambiguas.
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

-- Versiones anteriores: en el esquema equivocado, o sin los parámetros nuevos.
DROP FUNCTION IF EXISTS "EFINANCIANET_DB".aplicar_movimiento_tdc(
  text, text, text, text, text, numeric, date, text, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS "EFINANCIANET_DB".aplicar_movimiento_tdc(
  text, text, text, text, text, numeric, date, text, jsonb, jsonb, jsonb, text);
DROP FUNCTION IF EXISTS public.aplicar_movimiento_tdc(
  text, text, text, text, text, numeric, date, text, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.aplicar_movimiento_tdc(
  text, text, text, text, text, numeric, date, text, jsonb, jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.aplicar_movimiento_tdc(
  p_linea_id     text,
  p_cliente_id   text,
  p_clave        text,
  p_concepto     text,
  p_descripcion  text,
  p_monto        numeric,
  p_fecha        date,
  p_naturaleza   text,
  p_efectos      jsonb,
  p_calendario   jsonb,
  p_cuenta_eje   jsonb,
  p_correlation_id text DEFAULT NULL,
  -- Límite autorizado de la línea, para sembrar su saldo la primera vez que se
  -- opera. NULL = no sembrar (la línea debe existir ya).
  p_monto_autorizado numeric DEFAULT NULL
)
RETURNS TABLE (ok boolean, mensaje text, saldo_disponible numeric, movimiento_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
DECLARE
  v_total_consumido numeric := 0;
  v_saldo           numeric;
  v_mov_id          uuid;
  v_efecto          jsonb;
  v_eje             jsonb;
  v_delta           numeric;
  v_filas           integer;
  v_saldo_eje       numeric;
  v_data_eje        jsonb;
  v_cta_id          uuid;
BEGIN
  -- ── §8 Idempotencia: si este correlation_id ya se aplicó, devolver el
  --    resultado anterior sin tocar nada. No es un error: es el mismo
  --    movimiento llegando dos veces.
  IF p_correlation_id IS NOT NULL THEN
    SELECT m.id INTO v_mov_id
      FROM "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA" m
     WHERE m.correlation_id = p_correlation_id;

    IF v_mov_id IS NOT NULL THEN
      SELECT s.saldo_disponible INTO v_saldo
        FROM "EFINANCIANET_DB"."J_SALDOS_LINEA" s
       WHERE s.linea_id = p_linea_id;
      RETURN QUERY SELECT true, 'Movimiento ya aplicado (idempotente)'::text, v_saldo, v_mov_id;
      RETURN;
    END IF;
  END IF;

  -- ── Primera operación de la línea: sembrar su saldo ──
  --    Sin esto el primer movimiento fallaría por "saldo insuficiente" cuando en
  --    realidad lo que falta es la fila. Va dentro de la misma transacción, así
  --    que si el movimiento se revierte, la siembra también.
  --    ON CONFLICT DO NOTHING: si la fila ya existe, su saldo manda — el
  --    límite que envía la pantalla NUNCA reescribe un saldo ya consumido.
  IF p_monto_autorizado IS NOT NULL AND p_monto_autorizado > 0 THEN
    INSERT INTO "EFINANCIANET_DB"."J_SALDOS_LINEA" (linea_id, monto_autorizado, saldo_disponible)
    VALUES (p_linea_id, p_monto_autorizado, p_monto_autorizado)
    ON CONFLICT (linea_id) DO NOTHING;
  END IF;

  -- ── Total que consume línea: sólo los efectos marcados, y nunca los
  --    renglones del calendario (el movimiento ya consumió el total) ──
  SELECT COALESCE(SUM((e->>'monto')::numeric), 0)
    INTO v_total_consumido
    FROM jsonb_array_elements(p_efectos) e
   WHERE e->>'consumeLineaDisponible' = 'S'
     AND COALESCE(e->>'origen', '') <> 'msi-mci';

  -- ── Descuento atómico del disponible (CA-30, CA-31) ──
  IF v_total_consumido > 0 THEN
    -- El alias `sl` no es cosmético: `saldo_disponible` es también uno de los
    -- parámetros de salida de RETURNS TABLE, y sin calificar la referencia
    -- Postgres aborta con 42702 "column reference is ambiguous".
    UPDATE "EFINANCIANET_DB"."J_SALDOS_LINEA" sl
       SET saldo_disponible = sl.saldo_disponible - v_total_consumido,
           actualizado_en   = now()
     WHERE sl.linea_id = p_linea_id
       AND sl.saldo_disponible >= v_total_consumido
    RETURNING sl.saldo_disponible INTO v_saldo;

    GET DIAGNOSTICS v_filas = ROW_COUNT;

    IF v_filas = 0 THEN
      -- Sin fila de saldo, o sin disponible suficiente. RAISE revierte todo
      -- lo escrito por esta función hasta aquí (RN-08).
      -- Distinguir las dos causas: sin fila de saldo el mensaje "insuficiente"
      -- manda a buscar el problema donde no está.
      IF NOT EXISTS (SELECT 1 FROM "EFINANCIANET_DB"."J_SALDOS_LINEA" sl2 WHERE sl2.linea_id = p_linea_id) THEN
        RAISE EXCEPTION 'La línea % no tiene saldo registrado: primero debe establecerse su límite autorizado',
          p_linea_id
          USING ERRCODE = 'no_data_found';
      END IF;

      RAISE EXCEPTION 'Saldo disponible insuficiente en la línea % para consumir %',
        p_linea_id, v_total_consumido
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    SELECT s.saldo_disponible INTO v_saldo
      FROM "EFINANCIANET_DB"."J_SALDOS_LINEA" s
     WHERE s.linea_id = p_linea_id;
  END IF;

  -- ── El movimiento ──
  INSERT INTO "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA"
    (linea_id, cliente_id, clave, concepto, descripcion, monto, fecha,
     naturaleza, efectos, calendario, total_consumido)
  VALUES
    (p_linea_id, p_cliente_id, p_clave, p_concepto, p_descripcion, p_monto, p_fecha,
     p_naturaleza, COALESCE(p_efectos, '[]'::jsonb), COALESCE(p_calendario, '[]'::jsonb), v_total_consumido)
  RETURNING id INTO v_mov_id;

  UPDATE "EFINANCIANET_DB"."J_MOVIMIENTOS_LINEA"
     SET correlation_id = p_correlation_id
   WHERE id = v_mov_id AND p_correlation_id IS NOT NULL;

  -- ── Cargos de la línea: sólo los efectos con bCargo = 'S' (CA-32/CA-33) ──
  FOR v_efecto IN SELECT * FROM jsonb_array_elements(COALESCE(p_efectos, '[]'::jsonb))
  LOOP
    IF v_efecto->>'bCargo' = 'S' THEN
      INSERT INTO "EFINANCIANET_DB"."J_CARGOS_LINEA"
        (linea_id, movimiento_id, clave, nombre, naturaleza, monto, fecha, b_factura)
      VALUES
        (p_linea_id, v_mov_id,
         v_efecto->>'clave', v_efecto->>'nombre',
         COALESCE(v_efecto->>'naturaleza', 'Cargo'),
         (v_efecto->>'monto')::numeric,
         (v_efecto->>'fecha')::date,
         COALESCE(v_efecto->>'bFactura', 'N'));
    END IF;
  END LOOP;

  -- ── Cuenta EJE del cliente (§1.1.2, RN-04) ──
  --
  -- La cuenta se afecta POR SU ID, el que el motor ya resolvió (`idCuentaEje`).
  -- La especificación prohíbe asumir `IdCliente == IdCuentaEje`, así que aquí
  -- NO se vuelve a buscar por cliente: si el id no llega, es un error.
  --
  -- El saldo vive en J_CUENTAS_CORP_CLIENTES.saldo_actual y el historial en
  -- data.movimientos — el mismo lugar que lee el subtab Movimientos de
  -- Personas, con la misma forma de registro, para que el cash back aparezca
  -- ahí sin ningún trabajo extra.
  --
  -- Abono suma, Cargo resta. Si la cuenta no existe o no está marcada como eje,
  -- la función falla y revierte todo: no se abona "a la nada" (CA-32).
  FOR v_eje IN SELECT * FROM jsonb_array_elements(COALESCE(p_cuenta_eje, '[]'::jsonb))
  LOOP
    v_delta  := (v_eje->>'efectoEnSaldo')::numeric;
    v_cta_id := NULLIF(v_eje->>'idCuentaEje', '')::uuid;

    IF v_cta_id IS NULL THEN
      RAISE EXCEPTION 'El movimiento de Cuenta EJE no trae idCuentaEje: no se puede aplicar % al cliente %',
        v_delta, p_cliente_id
        USING ERRCODE = 'no_data_found';
    END IF;

    -- Bloquea la fila: dos movimientos con cash back sobre la misma cuenta se
    -- serializan en lugar de pisarse el saldo.
    -- `data` puede venir como string JSON doble-codificado: se normaliza antes
    -- de tocarlo, o jsonb_set falla con "cannot set path in scalar".
    -- `saldo_actual` es de tipo `money`. El cast entero->money es de ASIGNACION,
    -- no implicito, asi que COALESCE(money, 0) no resuelve un tipo comun y falla
    -- con "could not convert type integer to money". Se normaliza a numeric al
    -- leer; al escribir, numeric->money si es cast de asignacion y funciona.
    SELECT c.saldo_actual::numeric, public.jsonb_objeto(c.data)
      INTO v_saldo_eje, v_data_eje
      FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
     WHERE c.id = v_cta_id AND c.cta_eje_chec = true
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se encontró una Cuenta EJE válida (%) para el Cliente % asociado a la Línea de Crédito %',
        v_cta_id, p_cliente_id, p_linea_id
        USING ERRCODE = 'no_data_found';
    END IF;

    v_saldo_eje := COALESCE(v_saldo_eje, 0);

    UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
       SET saldo_actual = v_saldo_eje + v_delta,
           data = jsonb_set(
             v_data_eje,
             '{movimientos}',
             public.jsonb_arreglo(v_data_eje->'movimientos') || jsonb_build_object(
               'id',           'mov-' || v_mov_id::text,
               'fechaHora',    (p_fecha::timestamptz)::text,
               'fechaRegistro', now()::text,
               'tipo',          v_eje->>'naturaleza',
               'concepto',      COALESCE(v_eje->>'nombre', v_eje->>'clave'),
               'referencia',    COALESCE(v_eje->>'clave', ''),
               'monto',         (v_eje->>'monto')::numeric,
               'usuario',       'Sistema',
               'estatus',       'Aplicado',
               'saldoInicial',  v_saldo_eje,
               'saldoFinal',    v_saldo_eje + v_delta
             ),
             true)
     WHERE id = v_cta_id;
  END LOOP;

  RETURN QUERY SELECT true, 'Movimiento aplicado'::text, v_saldo, v_mov_id;
END;
$$;

-- ── Permisos: sin esto el rol `anon` del navegador no puede ejecutarla ──
GRANT EXECUTE ON FUNCTION public.aplicar_movimiento_tdc(
  text, text, text, text, text, numeric, date, text, jsonb, jsonb, jsonb, text, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.aplicar_movimiento_tdc(
  text, text, text, text, text, numeric, date, text, jsonb, jsonb, jsonb, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_movimiento_tdc(
  text, text, text, text, text, numeric, date, text, jsonb, jsonb, jsonb, text, numeric) TO service_role;

-- PostgREST cachea la lista de funciones; sin esto la primera llamada puede
-- seguir devolviendo PGRST202 aunque la función ya exista.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- =============================================================================
-- LECTOR DEL SALDO DE LA LINEA
--
-- J_SALDOS_LINEA es la AUTORIDAD sobre el disponible: la mantienen tanto
-- aplicar_movimiento_tdc (al consumir) como aplicar_pago_referenciado (al
-- liberar con "LIBERA LINEA CUANDO SE PAGA"). Sin este lector la pantalla
-- tenia que derivar el disponible sumando los movimientos que traia en
-- sesion, y asi un pago que libero linea era invisible: la liberacion ocurre
-- en la base, no en la lista local.
--
-- Definicion IDENTICA a la de create_rpc_estado_cuenta_tdc.sql, con CREATE OR
-- REPLACE, para que correr las migraciones en cualquier orden de el mismo
-- resultado. Mismo criterio que usa create_rpc_avisos_tdc.sql con las
-- columnas contables.
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
AS $fn$
  SELECT s.linea_id, s.monto_autorizado, s.saldo_disponible, s.actualizado_en
    FROM "EFINANCIANET_DB"."J_SALDOS_LINEA" s
   WHERE s.linea_id = p_linea_id;
$fn$;

GRANT EXECUTE ON FUNCTION public.obtener_saldo_linea(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- NOTAS DE DESPLIEGUE
--
-- 1. La Cuenta EJE es J_CUENTAS_CORP_CLIENTES (saldo en `saldo_actual`,
--    historial en `data.movimientos`, marcada con `cta_eje_chec = true`), la
--    misma que usan Alta de Cliente y el subtab Movimientos de Personas. No se
--    crea ninguna tabla nueva para esto.
--
-- 2. No hace falta sembrar el saldo a mano: la función crea la fila en la
--    primera operación usando el límite autorizado que envía la pantalla. Si
--    la fila ya existe, su saldo manda y el límite enviado se ignora — así una
--    pantalla no puede "recargar" una línea ya consumida reenviando el límite.
--    Para ajustar un límite deliberadamente:
--      UPDATE "EFINANCIANET_DB"."J_SALDOS_LINEA"
--         SET monto_autorizado = <nuevo>, saldo_disponible = <nuevo disponible>
--       WHERE linea_id = '<id de la línea>';
--
-- 3. El CHECK saldo_disponible >= 0 es la última defensa: aun si alguien
--    llamara la función sin el WHERE de disponibilidad, la fila no puede
--    quedar negativa.
-- =============================================================================
