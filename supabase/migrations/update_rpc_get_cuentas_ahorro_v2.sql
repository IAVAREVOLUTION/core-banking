-- Actualiza get_cuentas_ahorro para incluir cuentas creadas por activación
-- (type='CuentaAhorro' con data->metadatos->solicitudId)
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
  cliente_nombre  TEXT,
  producto_nombre TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.id, c.type, c.no_sol, c.no_cuenta, c.no_referenc1,
    c.fecha_sol, c.fecha_autori, c.fecha_disper, c.fecha_cancel,
    c.fecha_inicio, c.fecha_fin_cu, c.descripcion,
    c.linea_produc, c.tipo_produc, c.producto_id, c.producto_eje,
    c.cliente_id, c.saldo_actual, c.monto_sol, c.monto_aut, c.monto_disp,
    c.estatus_disp, c.estatus_sol, c.estatus_cart, c.estatus_cuen,
    c.cta_eje_chec, c.fases, c.data,
    COALESCE(
      NULLIF(TRIM(
        COALESCE(cl.data->>'nombre','') || ' ' ||
        COALESCE(cl.data->>'apellidoPaterno','') || ' ' ||
        COALESCE(cl.data->>'apellidoMaterno','')
      ), ''),
      cl.data->>'razonSocial',
      c.cliente_id::TEXT
    ) AS cliente_nombre,
    COALESCE(p.data->>'nombre', p.data->>'nombreProducto', c.producto_id::TEXT) AS producto_nombre
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
  LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES" cl ON cl.id = c.cliente_id
  LEFT JOIN "EFINANCIANET_DB"."J_PRODUCTOS" p  ON p.id  = c.producto_id
  WHERE
    (c.linea_produc = 'CAPTACION' AND c.tipo_produc = 'Ahorro')
    OR c.cta_eje_chec = TRUE
    -- Cuentas creadas automáticamente por activación de solicitud
    OR (c.type = 'CuentaAhorro' AND (c.data->'metadatos'->>'solicitudId') IS NOT NULL)
  ORDER BY c.fecha_sol DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_cuentas_ahorro() TO anon, authenticated, service_role;
