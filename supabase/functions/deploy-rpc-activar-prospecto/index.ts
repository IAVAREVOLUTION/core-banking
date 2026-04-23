import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, {
  prepare: false,
  max: 1,
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Fix existing accounts with NULL estatus_sol
    const fixResult = await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      SET estatus_sol = 'Autorizada'
      WHERE estatus_sol IS NULL AND cta_eje_chec = true
      RETURNING id, no_cuenta, estatus_sol
    `;

    // 2. Create/Update the RPC with correct 'Autorizada' (con 'a')
    const rpcSql = `
      CREATE OR REPLACE FUNCTION public.activar_prospecto_core(p_cliente_id TEXT)
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = ''
      AS $$
      DECLARE
        v_cliente_id UUID;
        v_cliente_row RECORD;
        v_producto_id UUID;
        v_client_data JSONB;
        v_new_cuenta_id UUID;
        v_fecha_hoy DATE := CURRENT_DATE;
        v_json_data JSONB;
      BEGIN
        BEGIN
          v_cliente_id := p_cliente_id::UUID;
        EXCEPTION WHEN OTHERS THEN
          RETURN jsonb_build_object('ok', false, 'error', 'ID inválido');
        END;

        SELECT id, type, data INTO v_cliente_row FROM "EFINANCIANET_DB"."J_CLIENTES" WHERE id = v_cliente_id FOR UPDATE;
        IF NOT FOUND THEN
          RETURN jsonb_build_object('ok', false, 'error', 'Cliente no encontrado');
        END IF;

        IF v_cliente_row.type = 'Clientes' THEN
          RETURN jsonb_build_object('ok', false, 'ya_es_cliente', true, 'error', 'Ya es cliente');
        END IF;

        IF EXISTS(SELECT 1 FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE cliente_id = v_cliente_id AND cta_eje_chec = TRUE) THEN
          RETURN jsonb_build_object('ok', false, 'ya_tiene_cuenta_eje', true, 'error', 'Ya tiene cuenta eje');
        END IF;

        SELECT id, data INTO v_producto_id, v_client_data FROM "EFINANCIANET_DB"."J_PRODUCTOS" 
        WHERE type ILIKE '%captacion%' AND (data->>'cuentaEje' = 'true') LIMIT 1;

        v_json_data := jsonb_build_object(
          'metadatos', jsonb_build_object('origenCreacion', 'ActivacionProspecto'),
          'estatusSolicitud', 'Autorizada'
        );

        INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
          type, no_sol, no_cuenta, fecha_sol, fecha_autori, fecha_inicio,
          descripcion, linea_produc, tipo_produc, producto_id, producto_eje, cliente_id,
          monto_sol, monto_aut, monto_disp, estatus_disp, estatus_sol, estatus_cart, estatus_cuen,
          cta_eje_chec, fases, data
        ) VALUES (
          'CuentaAhorro', 'AUTO-' || SUBSTRING(p_cliente_id, 1, 8), 
          '0147' || LPAD(SUBSTRING(MD5(p_cliente_id) FROM 1 FOR 8), 8, '0'),
          v_fecha_hoy, v_fecha_hoy, v_fecha_hoy,
          'Cuenta Eje generada automáticamente',
          'CAPTACION', 'Ahorro',
          v_producto_id, v_producto_id, v_cliente_id,
          0, 0, 0,
          'No Aplica',
          'Autorizada',  -- <-- CORREGIDO: era 'Autorizado'
          'Activa',
          'Activa',
          TRUE,
          'Inicial',
          v_json_data
        )
        RETURNING id INTO v_new_cuenta_id;

        UPDATE "EFINANCIANET_DB"."J_CLIENTES"
        SET type = 'Clientes', estatus = 'Activo'
        WHERE id = v_cliente_id;

        RETURN jsonb_build_object('ok', true, 'cuentaEjeId', v_new_cuenta_id);
      END;
      $$;
    `;

    await sql.unsafe(rpcSql);

    return new Response(JSON.stringify({ 
      success: true, 
      fixed_accounts: fixResult.length,
      rpc_updated: true,
      details: fixResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[deploy-rpc] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});