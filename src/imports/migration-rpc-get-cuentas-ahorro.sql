-- ═══════════════════════════════════════════════════════════════════
-- RPC: public.get_cuentas_ahorro()
-- Base de datos: IAVaRevolutions
-- Schema: EFINANCIANET_DB
-- Tabla: J_CUENTAS_CORP_CLIENTES
--
-- OBJETIVO:
--   Retorna TODAS las cuentas de ahorro (CAPTACION + Ahorro)
--   con nombres de cliente y producto resueltos via LEFT JOIN.
--
-- FILTROS INSTITUCIONALES:
--   linea_produc = 'CAPTACION' AND tipo_produc = 'Ahorro'
--   OR cta_eje_chec = true (cuentas eje siempre se incluyen)
--
-- ORDEN: fecha_sol DESC (más recientes primero)
--
-- INSTRUCCIONES:
--   1. Abrir Supabase → SQL Editor
--   2. Pegar TODO este archivo
--   3. Ejecutar (Run)
--   4. Verificar con la query de VERIFICACIÓN al final
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- PASO 1: DROP de función previa (evita conflictos de firma)
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_cuentas_ahorro();


-- ═══════════════════════════════════════════════════════════════════
-- PASO 2: CREATE — Retorna cuentas de ahorro con JOINs
--
-- Usa RETURNS TABLE para incluir las columnas base de
-- J_CUENTAS_CORP_CLIENTES + cliente_nombre + producto_nombre
-- resueltos desde J_CLIENTES y J_PRODUCTOS respectivamente.
--
-- SECURITY DEFINER permite acceder al schema EFINANCIANET_DB
-- desde el public schema sin exponerlo en PostgREST (PGRST106).
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_cuentas_ahorro()
RETURNS TABLE (
  id              UUID,
  type            TEXT,
  no_sol          TEXT,
  no_cuenta       TEXT,
  no_referenc1    TEXT,
  fecha_sol       TIMESTAMPTZ,
  fecha_autori    TIMESTAMPTZ,
  fecha_disper    TIMESTAMPTZ,
  fecha_cancel    TIMESTAMPTZ,
  fecha_inicio    TIMESTAMPTZ,
  fecha_fin_cu    TIMESTAMPTZ,
  descripcion     TEXT,
  linea_produc    TEXT,
  tipo_produc     TEXT,
  producto_id     UUID,
  producto_eje    TEXT,
  cliente_id      UUID,
  saldo_actual    NUMERIC,
  monto_sol       NUMERIC,
  monto_aut       NUMERIC,
  monto_disp      NUMERIC,
  estatus_disp    TEXT,
  estatus_sol     TEXT,
  estatus_cart    TEXT,
  estatus_cuen    TEXT,
  cta_eje_chec    TEXT,
  fases           TEXT,
  data            JSONB,
  -- Campos resueltos via JOIN
  cliente_nombre  TEXT,
  producto_nombre TEXT
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
    c.fecha_autori,
    c.fecha_disper,
    c.fecha_cancel,
    c.fecha_inicio,
    c.fecha_fin_cu,
    c.descripcion,
    c.linea_produc,
    c.tipo_produc,
    c.producto_id,
    c.producto_eje,
    c.cliente_id,
    TRIM(REPLACE(REPLACE(REPLACE(c.saldo_actual::TEXT, '$', ''), ',', ''), ' ', ''))::NUMERIC AS saldo_actual,
    TRIM(REPLACE(REPLACE(REPLACE(c.monto_sol::TEXT,    '$', ''), ',', ''), ' ', ''))::NUMERIC AS monto_sol,
    TRIM(REPLACE(REPLACE(REPLACE(c.monto_aut::TEXT,    '$', ''), ',', ''), ' ', ''))::NUMERIC AS monto_aut,
    TRIM(REPLACE(REPLACE(REPLACE(c.monto_disp::TEXT,   '$', ''), ',', ''), ' ', ''))::NUMERIC AS monto_disp,
    c.estatus_disp,
    c.estatus_sol,
    c.estatus_cart,
    c.estatus_cuen,
    c.cta_eje_chec,
    c.fases,
    c.data,
    -- Resolver nombre del cliente desde J_CLIENTES
    -- Intenta: data->>'nombre' + data->>'apellidoPaterno' + data->>'apellidoMaterno'
    -- Fallback: data->>'razonSocial'
    -- Fallback final: c.cliente_id::TEXT
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
    ) AS cliente_nombre,
    -- Resolver nombre del producto desde J_PRODUCTOS
    -- Captación: data->>'nombreProducto', Crédito: data->>'nombre'
    COALESCE(
      p.data->>'nombreProducto',
      p.data->>'nombre',
      c.producto_id::TEXT
    ) AS producto_nombre
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
  LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES" cl
    ON cl.id = c.cliente_id
  LEFT JOIN "EFINANCIANET_DB"."J_PRODUCTOS" p
    ON p.id = c.producto_id
  WHERE (
    LOWER(REPLACE(REPLACE(c.linea_produc, 'á','a'), 'ó','o')) = 'captacion'
    AND LOWER(REPLACE(c.tipo_produc, 'ó','o')) IN ('ahorro', 'aportacion')
  )
  OR c.cta_eje_chec = TRUE
  ORDER BY c.fecha_sol DESC NULLS LAST;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- PASO 3: GRANTS — Permisos para los roles de Supabase
-- ═══════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.get_cuentas_ahorro()
  TO anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — Ejecutar después para confirmar que funciona
-- ═══════════════════════════════════════════════════════════════════
-- SELECT * FROM public.get_cuentas_ahorro() LIMIT 5;
--
-- Resultado esperado:
--   ┌──────────────────────┬──────────┬───────────────────────┬────────────────┼──────────────┐
--   │ id                   │ no_cuenta│ cliente_nombre        │ producto_nombre│ saldo_actual │
--   ├──────────────────────┼──────────┼───────────────────────┼────────────────┼──────────────┤
--   │ uuid...              │ 12345... │ Juan Perez Lopez      │ Ahorro Básico  │ 15000.00     │
--   └──────────────────────┴──────────┴───────────────────────┴────────────────┴──────────────┘
--
-- Si no existe J_PRODUCTOS aún, la columna producto_nombre
-- mostrará el UUID del producto_id como fallback.
--
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- NOTA IMPORTANTE SOBRE J_PRODUCTOS
-- ═══════════════════════════════════════════════════════════════════
-- Si la tabla J_PRODUCTOS aún NO existe en el schema EFINANCIANET_DB,
-- el LEFT JOIN simplemente retornará NULL para producto_nombre y el
-- COALESCE usará producto_id::TEXT como fallback.
--
-- Cuando crees la tabla J_PRODUCTOS, esta RPC resolverá los nombres
-- automáticamente sin necesidad de modificarla.
--
-- Si J_PRODUCTOS tiene una estructura diferente (ej: el nombre está
-- en otra columna), ajusta la línea:
--   COALESCE(p.data->>'nombre', p.descripcion, c.producto_id::TEXT)
-- por la columna correcta.
-- ═══════════════════════════════════════════════════════════════════