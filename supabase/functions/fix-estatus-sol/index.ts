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
  if (req.method === 'OPTIONS' || req.method === 'GET') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const result = await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      SET estatus_sol = 'Autorizada'
      WHERE estatus_sol IS NULL AND cta_eje_chec = true
      RETURNING id, no_cuenta, estatus_sol
    `;

    console.log('[fix-estatus-sol] Updated:', result.length, 'records');

    return new Response(JSON.stringify({ 
      success: true, 
      updated_count: result.length,
      records: result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[fix-estatus-sol] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});