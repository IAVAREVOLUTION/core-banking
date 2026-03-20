-- =============================================================================
-- Script SQL para crear función RPC que accede a J_CUENTAS_CORP_CLIENTES
-- Ejecutar este script en la consola SQL de Supabase (Dashboard > SQL Editor)
-- =============================================================================

-- Primero, verificar que el schema EFINANCIANET_DB existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'EFINANCIANET_DB') THEN
    RAISE NOTICE 'El schema EFINANCIANET_DB no existe. Verifica el nombre correcto del schema.';
  ELSE
    RAISE NOTICE 'Schema EFINANCIANET_DB encontrado.';
  END IF;
END $$;

-- Listar tablas en el schema EFINANCIANET_DB
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'EFINANCIANET_DB';

-- Función para listar solicitudes (para el módulo de Originación)
CREATE OR REPLACE FUNCTION get_solicitudes_para_originacion()
RETURNS TABLE (
  id uuid,
  type varchar(30),
  no_sol varchar(30),
  no_cuenta varchar(30),
  no_referenc1 varchar(30),
  fecha_sol date,
  fecha_autori date,
  fecha_disper date,
  fecha_cancel date,
  fecha_inicio date,
  fecha_fin_cu date,
  descripcion varchar(512),
  linea_produc varchar(30),
  tipo_produc varchar(30),
  producto_id uuid,
  producto_eje uuid,
  cliente_id uuid,
  saldo_actual money,
  monto_sol money,
  monto_aut money,
  monto_disp money,
  estatus_disp varchar(30),
  estatus_sol varchar(30),
  estatus_cart varchar(30),
  estatus_cuen varchar(30),
  cta_eje_chec boolean,
  fases varchar(50),
  data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = EFINANCIANET_DB
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.type,
    t.no_sol,
    t.no_cuenta,
    t.no_referenc1,
    t.fecha_sol,
    t.fecha_autori,
    t.fecha_disper,
    t.fecha_cancel,
    t.fecha_inicio,
    t.fecha_fin_cu,
    t.descripcion,
    t.linea_produc,
    t.tipo_produc,
    t.producto_id,
    t.producto_eje,
    t.cliente_id,
    t.saldo_actual,
    t.monto_sol,
    t.monto_aut,
    t.monto_disp,
    t.estatus_disp,
    t.estatus_sol,
    t.estatus_cart,
    t.estatus_cuen,
    t.cta_eje_chec,
    t.fases,
    t.data
  FROM "J_CUENTAS_CORP_CLIENTES" t
  WHERE t.type = 'Solicitud'
    AND t.estatus_sol IS DISTINCT FROM 'Pendiente'
  ORDER BY t.fecha_sol DESC
  LIMIT 100;
END;
$$;

-- Permisos para permitir acceso desde el API
GRANT EXECUTE ON FUNCTION get_solicitudes_para_originacion() TO anon;
GRANT EXECUTE ON FUNCTION get_solicitudes_para_originacion() TO authenticated;

-- Verificar que la función fue creada
-- SELECT * FROM get_solicitudes_para_originacion() LIMIT 5;
