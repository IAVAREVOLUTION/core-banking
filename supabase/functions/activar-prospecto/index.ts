/**
 * Edge Function para activar prospecto y crear cuenta eje
 * Corrige: status_sol = Autorizada + producto_eje
 */
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

function toNullUuid(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

function toNullStr(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Solo POST' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    const body = await req.json();
    const { cliente_id, nombre_prospecto } = body;

    if (!cliente_id) {
      return new Response(JSON.stringify({ error: 'cliente_id requerido' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const clienteUuid = toNullUuid(cliente_id);
    console.log('[activar-prospecto] Iniciando:', clienteUuid);

    // 1. Verificar si ya tiene cuenta eje
    const existing = await sql`
      SELECT id FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE cliente_id = ${clienteUuid}::uuid AND cta_eje_chec = true
      LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        SET estatus_sol = 'Autorizada'
        WHERE id = ${existing[0].id}::uuid
      `;
      return new Response(JSON.stringify({
        ok: true,
        ya_tiene_cuenta_eje: true,
        cuentaEjeId: existing[0].id,
        estatus_sol: 'Autorizada',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Buscar producto eje
    let productoEjeId: string | null = null;
    let productoEjeNombre: string | null = null;
    try {
      const productos = await sql`
        SELECT id, nombre, data FROM "EFINANCIANET_DB"."J_PRODUCTOS"
      `;
      const eje = productos.filter((p: any) => {
        const d = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
        return d.cuentaEje === true || d.cuentaEje === 'true';
      });
      if (eje.length > 0) {
        productoEjeId = eje[0].id;
        const d = typeof eje[0].data === 'string' ? JSON.parse(eje[0].data) : (eje[0].data || {});
        productoEjeNombre = d.nombre || d.nombreProducto || 'Cuenta Eje';
      }
    } catch (e) {
      console.log('[activar-prospecto] Error buscando producto:', e);
    }

    // 3. Generar números de cuenta
    const now = new Date().toISOString();
    const noSol = `AUTO-${clienteUuid?.substring(0, 8) || 'unknown'}`;
    const noCuenta = `0147${String(Math.floor(Math.random() * 99999999)).padStart(8, '0')}`;
    const noRef = `REF-${Date.now().toString(36).toUpperCase()}`;

    // 4. Crear cuenta eje CON estatus_sol = 'Autorizada'
    const dataJson = JSON.stringify({
      metadatos: {
        noSol,
        noCuenta,
        noReferenc1: noRef,
        origenCreacion: 'ActivacionProspecto',
        titular: nombre_prospecto || 'Sin nombre',
        productoEjeNombre,
      },
      estatusCuenta: 'Activa',
      estatusSolicitud: 'Autorizada',
      estatusCartera: 'Activa',
      saldoActual: 0,
      fechaApertura: now,
    });

    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
        type, no_sol, no_cuenta, no_referenc1,
        fecha_sol, fecha_autori, fecha_inicio,
        descripcion, linea_produc, tipo_produc,
        producto_id, producto_eje, cliente_id,
        monto_sol, monto_aut, monto_disp,
        estatus_disp, estatus_sol, estatus_cart, estatus_cuen,
        cta_eje_chec, fases, data
      ) VALUES (
        'CuentaAhorro', ${noSol}, ${noCuenta}, ${noRef},
        ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz,
        ${'Cuenta Eje generada automáticamente al activar prospecto ' + (nombre_prospecto || 'Sin nombre')},
        'CAPTACION', 'Ahorro',
        ${productoEjeId}::uuid, ${productoEjeId}, ${clienteUuid}::uuid,
        0::numeric, 0::numeric, 0::numeric,
        'No Aplica',
        'Autorizada',
        'Activa',
        'Activa',
        true, 'Activa', ${dataJson}::jsonb
      )
      RETURNING id, no_cuenta, estatus_sol, producto_eje
    `;

    const cuentaEje = inserted[0];
    console.log('[activar-prospecto] Cuenta creada:', cuentaEje?.id, 'estatus_sol:', cuentaEje?.estatus_sol);

    // 5. Actualizar prospecto a cliente
    await sql`
      UPDATE "EFINANCIANET_DB"."J_CLIENTES"
      SET 
        type = 'Clientes',
        estatus = 'Activo',
        data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
          'estatusCliente', 'Cliente',
          'fechaActivacion', ${now}::text
        )
      WHERE id = ${clienteUuid}::uuid
    `;

    return new Response(JSON.stringify({
      ok: true,
      cuentaEjeId: cuentaEje.id,
      noCuenta: cuentaEje.no_cuenta,
      estatus_sol: cuentaEje.estatus_sol,
      producto_eje: cuentaEje.producto_eje,
      productoEjeNombre,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[activar-prospecto] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});