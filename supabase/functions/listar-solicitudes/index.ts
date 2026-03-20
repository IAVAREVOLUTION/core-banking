/**
 * Edge Function para listar solicitudes de Originación
 * Usa la RPC get_solicitudes_para_originacion() que accede a EFINANCIANET_DB.J_CUENTAS_CORP_CLIENTES
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Usar la RPC que accede a la tabla en EFINANCIANET_DB
    const { data, error } = await supabase.rpc('get_solicitudes_para_originacion');

    if (error) {
      console.error('Error calling get_solicitudes_para_originacion:', error);
      return new Response(JSON.stringify({ 
        error: error.message,
        hint: ' Asegúrate de ejecutar el script supabase/migrations/create_originacion_rpc.sql en el SQL Editor de Supabase'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ data: data || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Error general:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
