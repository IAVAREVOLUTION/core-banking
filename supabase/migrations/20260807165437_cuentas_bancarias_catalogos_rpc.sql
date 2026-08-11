-- =====================================================================
-- HU Módulo Clientes — Subtab "Cuentas Bancarias"
--
-- Reusa EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES" (misma tabla que
-- Cuentas de Ahorro) con tipo_produc = 'otros_bancos'. Los campos
-- específicos de banco (pais, banco, clabe, numeroCuenta, moneda,
-- swift) NO tienen columna física — van dentro de "data" jsonb,
-- igual que el resto de campos institucionales de esa tabla.
--
-- Catálogos País / Banco / Moneda siguen el patrón real de
-- J_CATALOGOS (id/type/data jsonb) — mismo patrón ya usado para
-- type='CategoriaBien'. La policy de lectura pública ya existe
-- (migración 20260807160949_add_categoria_bien_catalogo.sql).
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════
-- PASO 1: Catálogo de Países (para CLABE/SWIFT — México primero)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO "EFINANCIANET_DB"."J_CATALOGOS" (type, data)
SELECT 'Pais', v.data
FROM (VALUES
  ('{"clave": "MX", "nombre": "México", "activo": true}'::jsonb),
  ('{"clave": "US", "nombre": "Estados Unidos", "activo": true}'::jsonb),
  ('{"clave": "CA", "nombre": "Canadá", "activo": true}'::jsonb),
  ('{"clave": "ES", "nombre": "España", "activo": true}'::jsonb),
  ('{"clave": "OTRO", "nombre": "Otro", "activo": true}'::jsonb)
) AS v(data)
WHERE NOT EXISTS (
  SELECT 1 FROM "EFINANCIANET_DB"."J_CATALOGOS"
  WHERE type = 'Pais' AND data->>'clave' = v.data->>'clave'
);

-- ═══════════════════════════════════════════════════════════════════
-- PASO 2: Catálogo de Bancos (principales bancos mexicanos)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO "EFINANCIANET_DB"."J_CATALOGOS" (type, data)
SELECT 'Banco', v.data
FROM (VALUES
  ('{"clave": "BBVA", "nombre": "BBVA México", "activo": true}'::jsonb),
  ('{"clave": "BANORTE", "nombre": "Banorte", "activo": true}'::jsonb),
  ('{"clave": "SANTANDER", "nombre": "Santander", "activo": true}'::jsonb),
  ('{"clave": "CITIBANAMEX", "nombre": "Citibanamex", "activo": true}'::jsonb),
  ('{"clave": "HSBC", "nombre": "HSBC México", "activo": true}'::jsonb),
  ('{"clave": "SCOTIABANK", "nombre": "Scotiabank", "activo": true}'::jsonb),
  ('{"clave": "INBURSA", "nombre": "Inbursa", "activo": true}'::jsonb),
  ('{"clave": "AZTECA", "nombre": "Banco Azteca", "activo": true}'::jsonb),
  ('{"clave": "OTRO", "nombre": "Otro", "activo": true}'::jsonb)
) AS v(data)
WHERE NOT EXISTS (
  SELECT 1 FROM "EFINANCIANET_DB"."J_CATALOGOS"
  WHERE type = 'Banco' AND data->>'clave' = v.data->>'clave'
);

-- ═══════════════════════════════════════════════════════════════════
-- PASO 3: Catálogo de Monedas
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO "EFINANCIANET_DB"."J_CATALOGOS" (type, data)
SELECT 'Moneda', v.data
FROM (VALUES
  ('{"clave": "MXN", "nombre": "Peso Mexicano", "activo": true}'::jsonb),
  ('{"clave": "USD", "nombre": "Dólar Americano", "activo": true}'::jsonb),
  ('{"clave": "EUR", "nombre": "Euro", "activo": true}'::jsonb)
) AS v(data)
WHERE NOT EXISTS (
  SELECT 1 FROM "EFINANCIANET_DB"."J_CATALOGOS"
  WHERE type = 'Moneda' AND data->>'clave' = v.data->>'clave'
);

-- ═══════════════════════════════════════════════════════════════════
-- PASO 4: RPC get_cuentas_bancarias — filtra tipo_produc = 'otros_bancos'
--
-- get_cuentas_ahorro() existente filtra hardcodeado por
-- tipo_produc IN ('ahorro','aportacion'), así que NO devuelve estas
-- filas. Se necesita una RPC de lectura dedicada. INSERT/UPDATE sí
-- reusan insert_cuenta_ahorro/update_cuenta_ahorro sin cambios
-- (p_tipo_produc ya es parametrizable).
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_cuentas_bancarias();
CREATE OR REPLACE FUNCTION public.get_cuentas_bancarias()
RETURNS TABLE (
  id              UUID,
  type            TEXT,
  no_sol          TEXT,
  no_cuenta       TEXT,
  no_referenc1    TEXT,
  fecha_sol       TIMESTAMPTZ,
  descripcion     TEXT,
  linea_produc    TEXT,
  tipo_produc     TEXT,
  cliente_id      UUID,
  estatus_cuen    TEXT,
  data            JSONB,
  cliente_nombre  TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.id,
    c.type,
    c.no_sol,
    c.no_cuenta,
    c.no_referenc1,
    c.fecha_sol,
    c.descripcion,
    c.linea_produc,
    c.tipo_produc,
    c.cliente_id,
    c.estatus_cuen,
    c.data,
    COALESCE(
      NULLIF(
        TRIM(
          COALESCE(cl.data->>'nombre', '') || ' ' ||
          COALESCE(cl.data->>'apellidoPaterno', '') || ' ' ||
          COALESCE(cl.data->>'apellidoMaterno', '')
        ),
        ''
      ),
      cl.data->>'razonSocial',
      c.cliente_id::TEXT
    ) AS cliente_nombre
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
  LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES" cl
    ON cl.id = c.cliente_id
  WHERE LOWER(c.tipo_produc) = 'otros_bancos'
  ORDER BY c.fecha_sol DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_cuentas_bancarias()
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- PASO 5: RPC get_cuentas_bancarias_by_cliente — filtra además por cliente
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_cuentas_bancarias_by_cliente(UUID);
CREATE OR REPLACE FUNCTION public.get_cuentas_bancarias_by_cliente(p_cliente_id UUID)
RETURNS TABLE (
  id              UUID,
  type            TEXT,
  no_sol          TEXT,
  no_cuenta       TEXT,
  no_referenc1    TEXT,
  fecha_sol       TIMESTAMPTZ,
  descripcion     TEXT,
  linea_produc    TEXT,
  tipo_produc     TEXT,
  cliente_id      UUID,
  estatus_cuen    TEXT,
  data            JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.id, c.type, c.no_sol, c.no_cuenta, c.no_referenc1, c.fecha_sol,
    c.descripcion, c.linea_produc, c.tipo_produc, c.cliente_id, c.estatus_cuen, c.data
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
  WHERE LOWER(c.tipo_produc) = 'otros_bancos'
    AND c.cliente_id = p_cliente_id
  ORDER BY c.fecha_sol DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_cuentas_bancarias_by_cliente(UUID)
  TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- PASO 6: RPCs de escritura dedicadas — NO reusan insert_cuenta_ahorro
--
-- insert_cuenta_ahorro tiene 3 overloads ambiguos en producción
-- (mismo nombre, p_fecha_sol como text/timestamptz/date) y
-- update_cuenta_ahorro no existe en absoluto. Para no heredar ese
-- problema, Cuentas Bancarias usa RPCs propias, sin ambigüedad,
-- que fijan tipo_produc='otros_bancos' siempre (el usuario nunca
-- lo ve ni lo edita).
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.insert_cuenta_bancaria(UUID, JSONB);
CREATE OR REPLACE FUNCTION public.insert_cuenta_bancaria(
  p_cliente_id UUID,
  p_data       JSONB
)
RETURNS TABLE (
  id           UUID,
  cliente_id   UUID,
  estatus_cuen VARCHAR(30),
  fecha_sol    DATE,
  data         JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
    type, no_sol, no_cuenta, fecha_sol, linea_produc, tipo_produc,
    cliente_id, estatus_disp, estatus_sol, estatus_cart, estatus_cuen, data
  ) VALUES (
    'CAPTACION',
    'BANC-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    COALESCE(p_data->'bancaria'->>'numeroCuenta', ''),
    CURRENT_DATE,
    'CAPTACION',
    'otros_bancos',
    p_cliente_id,
    'Aprobada',
    'Vigente',
    'Activa',
    'Activo',
    p_data
  )
  RETURNING "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES".id INTO v_new_id;

  RETURN QUERY
  SELECT c.id, c.cliente_id, c.estatus_cuen, c.fecha_sol, c.data
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
  WHERE c.id = v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_cuenta_bancaria(UUID, JSONB)
  TO anon, authenticated, service_role;


DROP FUNCTION IF EXISTS public.update_cuenta_bancaria(UUID, JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.update_cuenta_bancaria(
  p_id      UUID,
  p_data    JSONB,
  p_estatus TEXT DEFAULT NULL
)
RETURNS TABLE (
  id           UUID,
  cliente_id   UUID,
  estatus_cuen VARCHAR(30),
  data         JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
  SET
    no_cuenta    = COALESCE(p_data->'bancaria'->>'numeroCuenta', c.no_cuenta),
    estatus_cuen = COALESCE(p_estatus, c.estatus_cuen),
    data         = COALESCE(p_data, c.data)
  WHERE c.id = p_id
    AND LOWER(c.tipo_produc) = 'otros_bancos';

  RETURN QUERY
  SELECT c.id, c.cliente_id, c.estatus_cuen, c.data
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
  WHERE c.id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_cuenta_bancaria(UUID, JSONB, TEXT)
  TO anon, authenticated, service_role;


DROP FUNCTION IF EXISTS public.delete_cuenta_bancaria(UUID);
CREATE OR REPLACE FUNCTION public.delete_cuenta_bancaria(p_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
  WHERE id = p_id AND LOWER(tipo_produc) = 'otros_bancos'
  RETURNING id;
$$;

GRANT EXECUTE ON FUNCTION public.delete_cuenta_bancaria(UUID)
  TO anon, authenticated, service_role;
