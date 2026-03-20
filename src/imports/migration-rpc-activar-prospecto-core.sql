-- =====================================================================
-- RPC: public.activar_prospecto_core(p_cliente_id TEXT)
-- Base de datos: IAVaRevolutions
-- Schema: EFINANCIANET_DB
--
-- TRANSACCION ATOMICA que ejecuta la spec completa:
--   1. Valida que el cliente exista
--   2. Valida que NO tenga cuenta eje previa
--   3. Busca producto institucional eje en J_PRODUCTOS
--   4. UPDATE J_CLIENTES → type='Clientes', estatus='Activo'
--   5. INSERT J_CUENTAS_CORP_CLIENTES → cuenta eje
--   6. Retorna resultado completo
--
-- INSTRUCCIONES:
--   1. Abrir Supabase → SQL Editor
--   2. Pegar TODO este archivo
--   3. Ejecutar (Run)
-- =====================================================================


-- =====================================================================
-- PASO 0: ALTER producto_id para permitir NULL en cuentas eje
-- (Solo se ejecuta si la columna aún es NOT NULL)
-- =====================================================================
DO $$
BEGIN
  -- Quitar FK si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_producto'
      AND table_schema = 'EFINANCIANET_DB'
      AND table_name = 'J_CUENTAS_CORP_CLIENTES'
  ) THEN
    ALTER TABLE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      DROP CONSTRAINT fk_producto;
  END IF;

  -- Quitar NOT NULL de producto_id
  ALTER TABLE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
    ALTER COLUMN producto_id DROP NOT NULL;

  -- Re-crear FK (ahora permite NULL)
  ALTER TABLE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
    ADD CONSTRAINT fk_producto
    FOREIGN KEY (producto_id)
    REFERENCES "EFINANCIANET_DB"."J_PRODUCTOS" (id)
    ON DELETE RESTRICT;

  RAISE NOTICE 'producto_id ahora permite NULL (para cuentas eje sin producto)';
END $$;


-- =====================================================================
-- PASO 1: DROP previo
-- =====================================================================
DROP FUNCTION IF EXISTS public.activar_prospecto_core(TEXT);


-- =====================================================================
-- PASO 2: CREATE — Activar Prospecto (transacción atómica)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.activar_prospecto_core(
  p_cliente_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cliente_id     UUID;
  v_cliente_row    RECORD;
  v_nombre_completo TEXT;
  v_clave_cliente  TEXT;
  v_rfc            TEXT;
  v_telefono       TEXT;
  v_cuenta_eje_count INT;
  v_producto_id    UUID := NULL;
  v_producto_nombre TEXT := NULL;
  v_producto_clave TEXT := NULL;
  v_producto_tasa  NUMERIC := 0;
  v_producto_monto_min NUMERIC := 0;
  v_no_sol         TEXT;
  v_no_cuenta      TEXT;
  v_new_cuenta_id  UUID;
  v_fecha_hoy      DATE := CURRENT_DATE;
  v_fecha_iso      TEXT;
  v_json_data      JSONB;
  v_client_data    JSONB;
  v_warnings       JSONB := '[]'::JSONB;
  v_existing_type  TEXT;
BEGIN
  -- ══════════════════════════════════════════════════════
  -- 1. Validar UUID
  -- ══════════════════════════════════════════════════════
  BEGIN
    v_cliente_id := p_cliente_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'ID del cliente no es un UUID válido: ' || p_cliente_id
    );
  END;

  -- ══════════════════════════════════════════════════════
  -- 2. Validar que el cliente exista (con FOR UPDATE lock anti-race)
  -- ══════════════════════════════════════════════════════
  SELECT id, type, data
  INTO v_cliente_row
  FROM "EFINANCIANET_DB"."J_CLIENTES"
  WHERE id = v_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Cliente no encontrado con id: ' || p_cliente_id
    );
  END IF;

  v_client_data := v_cliente_row.data;
  v_existing_type := v_cliente_row.type;

  -- Si ya es Cliente activo, no re-activar
  IF v_existing_type = 'Clientes' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'El registro ya es de type=Clientes. No se puede re-activar.',
      'ya_es_cliente', true
    );
  END IF;

  -- Extraer datos del cliente desde JSONB
  v_nombre_completo := COALESCE(
    NULLIF(TRIM(
      COALESCE(v_client_data->>'nombre', '') || ' ' ||
      COALESCE(v_client_data->>'apellidoPaterno', '') || ' ' ||
      COALESCE(v_client_data->>'apellidoMaterno', '')
    ), ''),
    v_client_data->>'denominacionRazonSocial',
    'Sin nombre'
  );
  v_clave_cliente := COALESCE(v_client_data->>'claveCliente', v_client_data->>'idProspecto', v_cliente_id::TEXT);
  v_rfc := v_client_data->>'rfc';
  v_telefono := v_client_data->>'telefono';

  -- ══════════════════════════════════════════════════════
  -- 3. Validar que NO tenga cuenta eje previa
  -- ══════════════════════════════════════════════════════
  SELECT COUNT(*)
  INTO v_cuenta_eje_count
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
  WHERE cliente_id = v_cliente_id
    AND cta_eje_chec = TRUE;

  IF v_cuenta_eje_count >= 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'El cliente ya tiene una cuenta eje (' || v_cuenta_eje_count || ' encontrada(s)). No se creará otra.',
      'ya_tiene_cuenta_eje', true
    );
  END IF;

  -- ══════════════════════════════════════════════════════
  -- 4. Buscar producto institucional eje en J_PRODUCTOS
  --    J_PRODUCTOS solo tiene: id (uuid), type (varchar), data (jsonb)
  --    Captación: type ILIKE '%Captaci%'
  --    Ahorro:    data->>'tipoProducto' = 'Ahorro'
  --    Eje:       (data->>'esProductoEje')::boolean = true
  -- ══════════════════════════════════════════════════════
  -- Intento 1: producto marcado como eje
  -- FIX v2: Usar TRIM + regex guard para evitar "invalid input syntax for type numeric: ''"
  --         NULLIF solo atrapa '' exacto; TRIM atrapa whitespace; regex rechaza 'abc' etc.
  SELECT
    id,
    COALESCE(data->>'nombreProducto', data->>'nombre', 'Producto Eje'),
    COALESCE(data->>'claveProducto', ''),
    CASE WHEN NULLIF(TRIM(COALESCE(data->>'tasa', '')), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
         THEN TRIM(data->>'tasa')::NUMERIC ELSE 0::NUMERIC END,
    CASE WHEN NULLIF(TRIM(COALESCE(data->>'montoMinimo', '')), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
         THEN TRIM(data->>'montoMinimo')::NUMERIC ELSE 0::NUMERIC END
  INTO v_producto_id, v_producto_nombre, v_producto_clave, v_producto_tasa, v_producto_monto_min
  FROM "EFINANCIANET_DB"."J_PRODUCTOS"
  WHERE type ILIKE '%Captaci%'
    AND data->>'tipoProducto' = 'Ahorro'
    AND COALESCE(NULLIF(TRIM(data->>'esProductoEje'), ''), 'false')::boolean = TRUE
  LIMIT 1;

  -- Intento 2: primer producto Captación/Ahorro (fallback)
  IF v_producto_id IS NULL THEN
    SELECT
      id,
      COALESCE(data->>'nombreProducto', data->>'nombre', 'Producto Ahorro'),
      COALESCE(data->>'claveProducto', ''),
      CASE WHEN NULLIF(TRIM(COALESCE(data->>'tasa', '')), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
           THEN TRIM(data->>'tasa')::NUMERIC ELSE 0::NUMERIC END,
      CASE WHEN NULLIF(TRIM(COALESCE(data->>'montoMinimo', '')), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
           THEN TRIM(data->>'montoMinimo')::NUMERIC ELSE 0::NUMERIC END
    INTO v_producto_id, v_producto_nombre, v_producto_clave, v_producto_tasa, v_producto_monto_min
    FROM "EFINANCIANET_DB"."J_PRODUCTOS"
    WHERE type ILIKE '%Captaci%'
      AND data->>'tipoProducto' = 'Ahorro'
    LIMIT 1;
  END IF;

  -- Si no hay producto, continuamos con NULL (producto_id ya es nullable)
  -- pero registramos warning en el JSON de respuesta
  IF v_producto_id IS NULL THEN
    v_warnings := '["No se encontró producto institucional eje en J_PRODUCTOS. La cuenta eje se creó sin producto_id."]'::JSONB;
  END IF;

  -- ══════════════════════════════════════════════════════
  -- 5. UPDATE J_CLIENTES → type='Clientes', estatus='Activo'
  --    SPEC §3: estatusCliente='Cliente', estatusProspecto='Convertido',
  --             fechaActivacion=NOW(), estatus='Activo'
  -- ══════════════════════════════════════════════════════
  v_fecha_iso := to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  UPDATE "EFINANCIANET_DB"."J_CLIENTES"
  SET
    type = 'Clientes',
    estatus = 'Activo',
    data = v_client_data
      || jsonb_build_object('estatusCliente', 'Cliente')
      || jsonb_build_object('estatusProspecto', 'Convertido')
      || jsonb_build_object('estatus', 'Activo')
      || jsonb_build_object('fechaActivacion', v_fecha_iso)
  WHERE id = v_cliente_id;

  -- ══════════════════════════════════════════════════════
  -- 6. Generar claves institucionales
  --    no_cuenta tiene varchar(30) → máx 30 chars
  --    Formato: AHO-XXXXXXXX-YYYYMMDD (21 chars) ✓
  -- ══════════════════════════════════════════════════════
  v_no_sol := 'AUTO-' || substring(gen_random_uuid()::text, 1, 8);
  v_no_cuenta := 'AHO-' || substring(v_cliente_id::text, 1, 8) || '-' || to_char(NOW(), 'YYYYMMDD');

  -- ══════════════════════════════════════════════════════
  -- 7. Construir JSON institucional (spec sección 8)
  -- ══════════════════════════════════════════════════════
  v_json_data := jsonb_build_object(
    'cliente', jsonb_build_object(
      'id', v_cliente_id::TEXT,
      'nombreCompleto', v_nombre_completo,
      'claveCliente', v_clave_cliente
    ),
    'producto', jsonb_build_object(
      'id', COALESCE(v_producto_id::TEXT, ''),
      'nombreProducto', COALESCE(v_producto_nombre, ''),
      'claveProducto', COALESCE(v_producto_clave, ''),
      'tasa', v_producto_tasa,
      'montoMinimo', v_producto_monto_min
    ),
    'cuenta', jsonb_build_object(
      'esCuentaEje', true,
      'generadaAutomaticamente', true
    ),
    'metadatos', jsonb_build_object(
      'creadoPor', 'Sistema',
      'fechaCreacion', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'motivo', 'Activación automática de prospecto'
    )
  );

  -- ══════════════════════════════════════════════════════
  -- 8. INSERT cuenta eje en J_CUENTAS_CORP_CLIENTES
  -- ══════════════════════════════════════════════════════
  INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
    type, no_sol, no_cuenta, no_referenc1,
    fecha_sol, fecha_autori, fecha_disper, fecha_cancel,
    fecha_inicio, fecha_fin_cu,
    descripcion, linea_produc, tipo_produc,
    producto_id, producto_eje, cliente_id,
    saldo_actual, monto_sol, monto_aut, monto_disp,
    estatus_disp, estatus_sol, estatus_cart, estatus_cuen,
    cta_eje_chec, fases, data
  ) VALUES (
    'CAPTACION',
    v_no_sol,
    v_no_cuenta,
    NULL,                          -- no_referenc1
    v_fecha_hoy,                   -- fecha_sol
    v_fecha_hoy,                   -- fecha_autori
    NULL, NULL,                    -- fecha_disper, fecha_cancel
    v_fecha_hoy,                   -- fecha_inicio
    NULL,                          -- fecha_fin_cu
    'Cuenta eje generada automáticamente al activar prospecto',
    'CAPTACION',
    'Ahorro',
    v_producto_id,                 -- puede ser NULL si no hay producto
    NULL,                          -- producto_eje
    v_cliente_id,
    0::MONEY,                      -- saldo_actual
    0::MONEY, 0::MONEY, 0::MONEY, -- monto_sol, monto_aut, monto_disp (MONEY NOT NULL safe)
    'No Aplica',                   -- estatus_disp (spec)
    'Autorizado',                  -- estatus_sol (spec)
    'Activa',                      -- estatus_cart (spec)
    'Activa',                      -- estatus_cuen (spec)
    TRUE,                          -- cta_eje_chec
    'Inicial',                     -- fases (spec)
    v_json_data
  )
  RETURNING id INTO v_new_cuenta_id;

  -- ══════════════════════════════════════════════════════
  -- 9. Retornar resultado exitoso
  -- ══════════════════════════════════════════════════════
  RETURN jsonb_build_object(
    'ok', true,
    'mensaje', 'Prospecto activado exitosamente',
    'cliente', jsonb_build_object(
      'id', v_cliente_id::TEXT,
      'nombreCompleto', v_nombre_completo,
      'type', 'Clientes',
      'estatus', 'Activo'
    ),
    'cuentaEje', jsonb_build_object(
      'id', v_new_cuenta_id::TEXT,
      'noSol', v_no_sol,
      'noCuenta', v_no_cuenta,
      'productoId', COALESCE(v_producto_id::TEXT, ''),
      'productoNombre', COALESCE(v_producto_nombre, 'Sin producto asignado')
    ),
    'warnings', v_warnings
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;


-- =====================================================================
-- PASO 3: GRANTS
-- =====================================================================
GRANT EXECUTE ON FUNCTION public.activar_prospecto_core(TEXT)
  TO anon, authenticated, service_role;


-- =====================================================================
-- VERIFICACION (reemplazar con UUID real)
-- =====================================================================
-- SELECT public.activar_prospecto_core('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
--
-- Resultado esperado:
-- {
--   "ok": true,
--   "mensaje": "Prospecto activado exitosamente",
--   "cliente": { "id": "...", "nombreCompleto": "...", "type": "Clientes", "estatus": "Activo" },
--   "cuentaEje": { "id": "...", "noSol": "AUTO-abc12345", "noCuenta": "AHO-...-20260228" },
--   "warnings": []
-- }
-- =====================================================================