-- =============================================================================
-- RPC: reservar_cupo_gpo — REQ-12, Actividad 6.2 "Autorización del CIC"
--
-- Implementa el "bloqueo preventivo de líneas" del requerimiento: al aprobar el
-- CIC, el sistema resta el monto de la operación contra un límite GLOBAL
-- compartido entre TODAS las Solicitudes de Garantía Financiera 2o Piso, para
-- que dos operaciones aprobándose casi al mismo tiempo no puedan comprometer
-- juntas más capacidad de la que el banco tiene disponible.
--
-- LA RESTA Y EL CHEQUEO SON UNA SOLA SENTENCIA ATÓMICA
--   UPDATE ... SET saldo_disponible = saldo_disponible - p_monto
--                WHERE saldo_disponible >= p_monto
-- Postgres evalúa el WHERE y aplica el SET dentro del mismo bloqueo de fila;
-- si dos llamadas concurrentes compiten por el mismo saldo, la segunda ve el
-- saldo YA actualizado por la primera (o espera su commit) y sólo una de las
-- dos puede tener éxito si el remanente no alcanza para ambas. No se necesita
-- SELECT ... FOR UPDATE explícito: el propio UPDATE ya sirve de lock de fila.
--
-- ALCANCE DE ESTA VERSIÓN (decisión de negocio pendiente en REQ-12 §Decisión #2,
-- resuelta aquí con el default más simple para no bloquear la HU completa):
--   Un único límite GLOBAL para toda la línea GPO, clave fija 'GPO_GLOBAL'.
--   Segmentar por sector de infraestructura, año fiscal, etc. es una extensión
--   futura: agregar más filas a J_LIMITES_GPO con otra clave y decidir en el
--   frontend cuál usar — el mecanismo atómico no cambia.
--
-- EL VALOR SEMBRADO DE limite_total ES UN PLACEHOLDER — actualícelo a la cifra
-- real que Riesgos/Tesorería autorice antes de usar esto en producción:
--   UPDATE "EFINANCIANET_DB"."J_LIMITES_GPO"
--      SET limite_total = <monto real>, saldo_disponible = <monto real>
--    WHERE clave = 'GPO_GLOBAL';
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

-- =============================================================================
-- Tabla: límites globales por clave (hoy sólo 'GPO_GLOBAL')
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_LIMITES_GPO" (
  clave             text PRIMARY KEY,
  limite_total      numeric NOT NULL CHECK (limite_total >= 0),
  saldo_disponible  numeric NOT NULL CHECK (saldo_disponible >= 0),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Placeholder — ver nota arriba. No conflictúa si ya se sembró antes.
INSERT INTO "EFINANCIANET_DB"."J_LIMITES_GPO" (clave, limite_total, saldo_disponible)
VALUES ('GPO_GLOBAL', 5000000000, 5000000000)
ON CONFLICT (clave) DO NOTHING;

-- =============================================================================
-- Tabla: bitácora de reservas — una fila por cada bloqueo exitoso.
-- Es lo que una futura HU de "liberar cupo" (si la operación se cae antes de
-- formalizarse) necesitaría para saber cuánto devolver y de qué Solicitud.
-- No hay UI para liberar en REQ-12 — sólo se deja el rastro para no repetir
-- la investigación de dónde vive el monto reservado por Solicitud.
-- =============================================================================
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_RESERVAS_CUPO_GPO" (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave          text NOT NULL REFERENCES "EFINANCIANET_DB"."J_LIMITES_GPO"(clave),
  solicitud_id   uuid NOT NULL,
  monto          numeric NOT NULL CHECK (monto > 0),
  folio_oficio   text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservas_cupo_gpo_solicitud
  ON "EFINANCIANET_DB"."J_RESERVAS_CUPO_GPO" (solicitud_id);

-- =============================================================================
-- RPC: reservar_cupo_gpo
--
-- Intenta reservar p_monto contra el saldo disponible de p_clave. Devuelve una
-- sola fila con el resultado — SIN excepción en el camino "sin saldo", para que
-- el frontend distinga con claridad "no hay línea configurada" (error real) de
-- "sí hay línea, pero no alcanza" (resultado de negocio esperado).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reservar_cupo_gpo(
  p_clave        text,
  p_monto        numeric,
  p_solicitud_id uuid,
  p_folio_oficio text DEFAULT NULL
)
RETURNS TABLE (
  ok                boolean,
  saldo_disponible  numeric,
  limite_total      numeric,
  mensaje           text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo  numeric;
  v_limite numeric;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RETURN QUERY SELECT false, NULL::numeric, NULL::numeric, 'Monto inválido para reservar cupo.';
    RETURN;
  END IF;

  -- La resta y el chequeo en UNA sola sentencia: ver nota de atomicidad arriba.
  -- Alias "lim" obligatorio: el nombre de columna de salida de esta función
  -- (RETURNS TABLE) también se llama "saldo_disponible", y sin calificar la
  -- columna de la tabla con un alias, Postgres no puede distinguir cuál de
  -- los dos "saldo_disponible" se quiere en el SET/WHERE/RETURNING.
  UPDATE "EFINANCIANET_DB"."J_LIMITES_GPO" AS lim
     SET saldo_disponible = lim.saldo_disponible - p_monto,
         updated_at = now()
   WHERE lim.clave = p_clave
     AND lim.saldo_disponible >= p_monto
  RETURNING lim.saldo_disponible, lim.limite_total INTO v_saldo, v_limite;

  IF FOUND THEN
    INSERT INTO "EFINANCIANET_DB"."J_RESERVAS_CUPO_GPO" (clave, solicitud_id, monto, folio_oficio)
    VALUES (p_clave, p_solicitud_id, p_monto, p_folio_oficio);

    RETURN QUERY SELECT true, v_saldo, v_limite, 'Cupo reservado correctamente.';
    RETURN;
  END IF;

  -- Distinguir "no existe la clave" de "existe pero no alcanza" para un mensaje útil.
  SELECT l.saldo_disponible, l.limite_total INTO v_saldo, v_limite
    FROM "EFINANCIANET_DB"."J_LIMITES_GPO" l
   WHERE l.clave = p_clave;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::numeric, NULL::numeric,
      'No existe un límite configurado con clave "' || p_clave || '".';
    RETURN;
  END IF;

  RETURN QUERY SELECT false, v_saldo, v_limite,
    'Saldo insuficiente: disponible ' || v_saldo::text || ', solicitado ' || p_monto::text || '.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.reservar_cupo_gpo(text, numeric, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.reservar_cupo_gpo(text, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_cupo_gpo(text, numeric, uuid, text) TO service_role;

-- =============================================================================
-- RPC: consultar_cupo_gpo — lectura simple, para mostrar el saldo en la UI
-- antes de intentar reservar (informativo; el chequeo real sigue siendo el
-- UPDATE atómico de arriba, esto sólo evita sorprender al usuario).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.consultar_cupo_gpo(p_clave text DEFAULT 'GPO_GLOBAL')
RETURNS TABLE (
  clave             text,
  limite_total      numeric,
  saldo_disponible  numeric,
  updated_at        timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT clave, limite_total, saldo_disponible, updated_at
    FROM "EFINANCIANET_DB"."J_LIMITES_GPO"
   WHERE clave = p_clave;
$$;

GRANT EXECUTE ON FUNCTION public.consultar_cupo_gpo(text) TO anon;
GRANT EXECUTE ON FUNCTION public.consultar_cupo_gpo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_cupo_gpo(text) TO service_role;
