-- =============================================================================
-- REQ-01 — Control de consecutivos para Personas (Prospectos / Clientes)
--
-- Prospecto y Cliente son la MISMA entidad: viven en la misma fila de
-- J_CLIENTES y la activación solo cambia type 'Prospecto' → 'Clientes'.
-- Por eso llevan UN solo consecutivo (entidad 'PERSONAS'), con formato de
-- 10 dígitos rellenado a la izquierda con ceros: 1450 → '0000001450'.
--
-- El consecutivo se asigna en un trigger BEFORE INSERT sobre J_CLIENTES, no
-- en el frontend: las altas entran por varios caminos (Edge Function
-- make-server-7e2d13d9 POST /clientes, make-server-9a76e68a, seed) y calcular
-- "max + 1" en el navegador repetía números con dos altas simultáneas.
-- El UPDATE ... RETURNING sobre la fila de control la bloquea hasta el
-- COMMIT, así que dos altas concurrentes nunca reciben el mismo número; y si
-- el INSERT falla, el incremento se revierte con él (sin huecos).
--
-- El número se escribe en data.idCliente y data.idProspecto (los campos que
-- ya leen el listado, el formulario y la activación). Es inmutable: en un
-- UPDATE se conserva el valor de la fila aunque el frontend mande otro.
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

-- ── 1. Tabla de control de consecutivos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CONSECUTIVOS" (
  entidad             varchar     PRIMARY KEY,
  descripcion         varchar     NULL,
  ultimo_consecutivo  bigint      NOT NULL DEFAULT 0 CHECK (ultimo_consecutivo >= 0),
  longitud            smallint    NOT NULL DEFAULT 10 CHECK (longitud BETWEEN 1 AND 20),
  fecha_actualizacion timestamptz NOT NULL DEFAULT now()
);

-- Solo el trigger (SECURITY DEFINER) escribe aquí; sin políticas, anon y
-- authenticated no pueden alterar el contador vía PostgREST.
ALTER TABLE "EFINANCIANET_DB"."J_CONSECUTIVOS" ENABLE ROW LEVEL SECURITY;

INSERT INTO "EFINANCIANET_DB"."J_CONSECUTIVOS" (entidad, descripcion, ultimo_consecutivo, longitud)
VALUES ('PERSONAS', 'Prospectos / Clientes / Personas (J_CLIENTES)', 0, 10)
ON CONFLICT (entidad) DO NOTHING;

-- ── 2. Obtener el siguiente consecutivo formateado ───────────────────────────
CREATE OR REPLACE FUNCTION "EFINANCIANET_DB".fn_siguiente_consecutivo(p_entidad varchar)
RETURNS varchar
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", pg_temp
AS $$
DECLARE
  v_valor    bigint;
  v_longitud smallint;
BEGIN
  UPDATE "EFINANCIANET_DB"."J_CONSECUTIVOS"
     SET ultimo_consecutivo  = ultimo_consecutivo + 1,
         fecha_actualizacion = now()
   WHERE entidad = p_entidad
  RETURNING ultimo_consecutivo, longitud INTO v_valor, v_longitud;

  IF v_valor IS NULL THEN
    RAISE EXCEPTION 'No existe la entidad "%" en J_CONSECUTIVOS', p_entidad;
  END IF;

  -- lpad trunca si el número excede la longitud: se bloquea en lugar de
  -- emitir un consecutivo cortado que chocaría con uno anterior.
  IF length(v_valor::text) > v_longitud THEN
    RAISE EXCEPTION 'Consecutivo % de "%" excede % dígitos', v_valor, p_entidad, v_longitud;
  END IF;

  RETURN lpad(v_valor::text, v_longitud, '0');
END;
$$;

REVOKE ALL ON FUNCTION "EFINANCIANET_DB".fn_siguiente_consecutivo(varchar) FROM PUBLIC, anon, authenticated;

-- ── 3. Trigger sobre J_CLIENTES ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "EFINANCIANET_DB".asignar_consecutivo_persona()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", pg_temp
AS $$
DECLARE
  v_numero varchar;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Siempre se asigna aquí: cualquier idCliente/idProspecto que traiga el
    -- frontend (PROS-XXX, Date.now()) es provisional y se descarta.
    v_numero := "EFINANCIANET_DB".fn_siguiente_consecutivo('PERSONAS');
  ELSE
    -- UPDATE: conservar el consecutivo ya asignado. Registros legacy sin
    -- consecutivo de 10 dígitos se dejan como están.
    v_numero := OLD.data->>'idCliente';
    IF v_numero IS NULL OR v_numero !~ '^[0-9]{10}$' THEN
      RETURN NEW;
    END IF;
  END IF;

  NEW.data := COALESCE(NEW.data, '{}'::jsonb)
              || jsonb_build_object('idCliente', v_numero, 'idProspecto', v_numero);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_asignar_consecutivo_persona" ON "EFINANCIANET_DB"."J_CLIENTES";
CREATE TRIGGER "trg_asignar_consecutivo_persona"
  BEFORE INSERT OR UPDATE OF data ON "EFINANCIANET_DB"."J_CLIENTES"
  FOR EACH ROW
  EXECUTE FUNCTION "EFINANCIANET_DB".asignar_consecutivo_persona();

-- ── 4. Unicidad del consecutivo (registros legacy con otro formato quedan fuera) ──
CREATE UNIQUE INDEX IF NOT EXISTS "J_CLIENTES_consecutivo_persona_uq"
  ON "EFINANCIANET_DB"."J_CLIENTES" ((data->>'idCliente'))
  WHERE data->>'idCliente' ~ '^[0-9]{10}$';
