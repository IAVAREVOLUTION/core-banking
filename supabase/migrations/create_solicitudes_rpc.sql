-- ============================================================
-- RPC: get_solicitudes_credito
-- Lista todas las solicitudes de la tabla J_CUENTAS_CORP_CLIENTES
-- con JOIN a J_CLIENTES para obtener datos del cliente
-- ============================================================

CREATE OR REPLACE FUNCTION get_solicitudes_credito()
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
  data jsonb,
  cliente_nombre varchar(100),
  cliente_ap_paterno varchar(100),
  cliente_ap_materno varchar(100),
  cliente_rfc varchar(20),
  cliente_curp varchar(20),
  cliente_tipo varchar(30),
  cliente_subtipo varchar(30),
  producto_nombre varchar(100),
  producto_clave varchar(20),
  producto_sucursal varchar(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = EFINANCIANET_DB, public
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
    t.data,
    c.nombre as cliente_nombre,
    c.apellido_paterno as cliente_ap_paterno,
    c.apellido_materno as cliente_ap_materno,
    c.rfc as cliente_rfc,
    c.curp as cliente_curp,
    c.tipo as cliente_tipo,
    c.subtipo as cliente_subtipo,
    p.nombre_producto as producto_nombre,
    p.clave_producto as producto_clave,
    p.sucursal as producto_sucursal
  FROM "J_CUENTAS_CORP_CLIENTES" t
  LEFT JOIN "J_CLIENTES" c ON t.cliente_id = c.id
  LEFT JOIN "J_PRODUCTOS" p ON t.producto_id = p.id
  WHERE t.type = 'Solicitud'
  ORDER BY t.fecha_sol DESC NULLS LAST, t.no_sol DESC
  LIMIT 500;
END;
$$;

GRANT EXECUTE ON FUNCTION get_solicitudes_credito() TO anon;
GRANT EXECUTE ON FUNCTION get_solicitudes_credito() TO authenticated;
GRANT EXECUTE ON FUNCTION get_solicitudes_credito() TO service_role;

-- ============================================================
-- RPC: insert_solicitud_credito
-- Inserta una nueva solicitud
-- ============================================================

CREATE OR REPLACE FUNCTION insert_solicitud_credito(
  p_type varchar,
  p_no_sol varchar,
  p_no_cuenta varchar,
  p_no_referenc1 varchar,
  p_fecha_sol date,
  p_descripcion varchar,
  p_linea_produc varchar,
  p_tipo_produc varchar,
  p_producto_id uuid,
  p_cliente_id uuid,
  p_monto_sol money,
  p_monto_aut money,
  p_estatus_sol varchar,
  p_fases varchar,
  p_data jsonb
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = EFINANCIANET_DB, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := gen_random_uuid();
  
  INSERT INTO "J_CUENTAS_CORP_CLIENTES" (
    id, type, no_sol, no_cuenta, no_referenc1, fecha_sol, descripcion,
    linea_produc, tipo_produc, producto_id, cliente_id, monto_sol, monto_aut,
    estatus_sol, fases, data
  ) VALUES (
    v_id, p_type, p_no_sol, p_no_cuenta, p_no_referenc1, p_fecha_sol, p_descripcion,
    p_linea_produc, p_tipo_produc, p_producto_id, p_cliente_id, p_monto_sol, p_monto_aut,
    p_estatus_sol, p_fases, p_data
  );
  
  RETURN QUERY SELECT v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_solicitud_credito TO anon;
GRANT EXECUTE ON FUNCTION insert_solicitud_credito TO authenticated;
GRANT EXECUTE ON FUNCTION insert_solicitud_credito TO service_role;

-- ============================================================
-- RPC: update_solicitud_credito
-- Actualiza una solicitud existente
-- ============================================================

CREATE OR REPLACE FUNCTION update_solicitud_credito(
  p_id uuid,
  p_no_sol varchar,
  p_no_referenc1 varchar,
  p_fecha_sol date,
  p_descripcion varchar,
  p_linea_produc varchar,
  p_tipo_produc varchar,
  p_producto_id uuid,
  p_cliente_id uuid,
  p_monto_sol money,
  p_monto_aut money,
  p_estatus_sol varchar,
  p_fases varchar,
  p_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = EFINANCIANET_DB, public
AS $$
BEGIN
  UPDATE "J_CUENTAS_CORP_CLIENTES"
  SET 
    no_sol = COALESCE(p_no_sol, no_sol),
    no_referenc1 = COALESCE(p_no_referenc1, no_referenc1),
    fecha_sol = COALESCE(p_fecha_sol, fecha_sol),
    descripcion = COALESCE(p_descripcion, descripcion),
    linea_produc = COALESCE(p_linea_produc, linea_produc),
    tipo_produc = COALESCE(p_tipo_produc, tipo_produc),
    producto_id = COALESCE(p_producto_id, producto_id),
    cliente_id = COALESCE(p_cliente_id, cliente_id),
    monto_sol = COALESCE(p_monto_sol, monto_sol),
    monto_aut = COALESCE(p_monto_aut, monto_aut),
    estatus_sol = COALESCE(p_estatus_sol, estatus_sol),
    fases = COALESCE(p_fases, fases),
    data = COALESCE(p_data, data)
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_solicitud_credito TO anon;
GRANT EXECUTE ON FUNCTION update_solicitud_credito TO authenticated;
GRANT EXECUTE ON FUNCTION update_solicitud_credito TO service_role;

-- ============================================================
-- RPC: delete_solicitud_credito
-- Elimina una solicitud
-- ============================================================

CREATE OR REPLACE FUNCTION delete_solicitud_credito(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = EFINANCIANET_DB, public
AS $$
BEGIN
  DELETE FROM "J_CUENTAS_CORP_CLIENTES"
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_solicitud_credito TO anon;
GRANT EXECUTE ON FUNCTION delete_solicitud_credito TO authenticated;
GRANT EXECUTE ON delete_solicitud_credito TO service_role;
