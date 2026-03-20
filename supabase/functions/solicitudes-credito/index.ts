/**
 * Edge Function principal para CRUD de Solicitudes de Crédito
 * Tabla: EFINANCIANET_DB.J_CUENTAS_CORP_CLIENTES
 * 
 * Endpoints:
 *   GET  /                        → Listar todas las solicitudes
 *   POST /                        → Crear nueva solicitud
 *   PUT  /:id                     → Actualizar solicitud
 *   DELETE /:id                   → Eliminar solicitud
 *   GET  /next-no-sol             → Obtener siguiente número de solicitud
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function createSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function parseMoney(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function formatMoney(num: number): string {
  return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const functionIndex = pathParts.indexOf('functions');
  const resourcePath = pathParts.slice(functionIndex + 2).join('/');

  try {
    const supabase = createSupabaseClient();

    // ═══════════════════════════════════════════════════════════════
    // GET /solicitudes-credito
    // ═══════════════════════════════════════════════════════════════
    if (req.method === 'GET' && (resourcePath === 'solicitudes-credito' || resourcePath === '')) {
      console.log('[solicitudes-credito] GET - Listando solicitudes...');
      
      // Intentar RPC primero
      const { data, error } = await supabase.rpc('get_solicitudes_credito');

      if (error) {
        console.error('[solicitudes-credito] Error RPC:', error);
        // Fallback: intentar acceso directo a la tabla
        const { data: directData, error: directError } = await supabase
          .from('J_CUENTAS_CORP_CLIENTES')
          .select('*')
          .eq('type', 'Solicitud')
          .order('fecha_sol', { ascending: false })
          .limit(100);

        if (directError) {
          console.error('[solicitudes-credito] Error acceso directo:', directError);
          return new Response(JSON.stringify({ 
            error: error.message,
            fallbackError: directError.message,
            hint: 'Ejecuta el script de migración en el SQL Editor de Supabase'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }

        return new Response(JSON.stringify({ data: directData || [], source: 'direct' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      return new Response(JSON.stringify({ data: data || [], source: 'rpc' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // GET /solicitudes-credito/next-no-sol
    // ═══════════════════════════════════════════════════════════════
    if (req.method === 'GET' && resourcePath === 'solicitudes-credito/next-no-sol') {
      console.log('[solicitudes-credito] GET next-no-sol');
      
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, '0');
      const dd = String(hoy.getDate()).padStart(2, '0');
      const prefijo = `BAN-DIGITAL-${yyyy}${mm}${dd}-`;

      // Buscar el último número del día
      const { data, error } = await supabase
        .from('J_CUENTAS_CORP_CLIENTES')
        .select('no_sol')
        .ilike('no_sol', `${prefijo}%`)
        .order('no_sol', { ascending: false })
        .limit(1);

      let consecutivo = 1;
      if (!error && data && data.length > 0) {
        const lastNoSol = data[0].no_sol;
        const match = lastNoSol.match(/-(\d{6})$/);
        if (match) {
          consecutivo = parseInt(match[1]) + 1;
        }
      }

      const noSol = `${prefijo}${String(consecutivo).padStart(6, '0')}`;
      
      return new Response(JSON.stringify({ 
        no_sol: noSol, 
        consecutivos: { yyyy, mm, dd, numero: consecutivos }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // POST /solicitudes-credito
    // ═══════════════════════════════════════════════════════════════
    if (req.method === 'POST' && (resourcePath === 'solicitudes-credito' || resourcePath === '')) {
      const body = await req.json();
      console.log('[solicitudes-credito] POST - Nueva solicitud:', body.no_sol);

      // Generar UUID si no existe
      const id = body.id || crypto.randomUUID();

      const { data, error } = await supabase
        .from('J_CUENTAS_CORP_CLIENTES')
        .insert({
          id,
          type: body.type || 'Solicitud',
          no_sol: body.no_sol,
          no_cuenta: body.no_cuenta || '',
          no_referenc1: body.no_referenc1 || null,
          fecha_sol: body.fecha_sol || new Date().toISOString().split('T')[0],
          descripcion: body.descripcion || null,
          linea_produc: body.linea_produc || 'Crédito',
          tipo_produc: body.tipo_produc || '',
          producto_id: body.producto_id || null,
          cliente_id: body.cliente_id || '00000000-0000-0000-0000-000000000000',
          monto_sol: body.monto_sol || 0,
          monto_aut: body.monto_aut || 0,
          estatus_sol: body.estatus_sol || 'Pendiente',
          fases: body.fases || '1',
          data: body.data || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[solicitudes-credito] Error INSERT:', error);
        return new Response(JSON.stringify({ 
          error: error.message,
          details: error.details 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ id: data.id, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // PUT /solicitudes-credito/:id
    // ═══════════════════════════════════════════════════════════════
    if (req.method === 'PUT' && resourcePath.startsWith('solicitudes-credito/')) {
      const id = resourcePath.replace('solicitudes-credito/', '');
      const body = await req.json();
      console.log('[solicitudes-credito] PUT - Actualizando:', id);

      const updates: Record<string, any> = {};

      // Solo actualizar campos que vienen en el payload
      if (body.no_sol !== undefined) updates.no_sol = body.no_sol;
      if (body.no_referenc1 !== undefined) updates.no_referenc1 = body.no_referenc1;
      if (body.fecha_sol !== undefined) updates.fecha_sol = body.fecha_sol;
      if (body.descripcion !== undefined) updates.descripcion = body.descripcion;
      if (body.linea_produc !== undefined) updates.linea_produc = body.linea_produc;
      if (body.tipo_produc !== undefined) updates.tipo_produc = body.tipo_produc;
      if (body.producto_id !== undefined) updates.producto_id = body.producto_id;
      if (body.cliente_id !== undefined) updates.cliente_id = body.cliente_id;
      if (body.monto_sol !== undefined) updates.monto_sol = body.monto_sol;
      if (body.monto_aut !== undefined) updates.monto_aut = body.monto_aut;
      if (body.estatus_sol !== undefined) updates.estatus_sol = body.estatus_sol;
      if (body.fases !== undefined) updates.fases = body.fases;
      if (body.data !== undefined) updates.data = body.data;

      const { data, error } = await supabase
        .from('J_CUENTAS_CORP_CLIENTES')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[solicitudes-credito] Error UPDATE:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // DELETE /solicitudes-credito/:id
    // ═══════════════════════════════════════════════════════════════
    if (req.method === 'DELETE' && resourcePath.startsWith('solicitudes-credito/')) {
      const id = resourcePath.replace('solicitudes-credito/', '');
      console.log('[solicitudes-credito] DELETE:', id);

      const { error } = await supabase
        .from('J_CUENTAS_CORP_CLIENTES')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[solicitudes-credito] Error DELETE:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Ruta no encontrada
    return new Response(JSON.stringify({ 
      error: 'Endpoint no encontrado',
      path: resourcePath,
      method: req.method
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });

  } catch (err) {
    console.error('[solicitudes-credito] Error general:', err);
    return new Response(JSON.stringify({ 
      error: String(err),
      stack: err instanceof Error ? err.stack : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
