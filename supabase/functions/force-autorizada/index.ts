import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // CREATE TRIGGER to set estatus_sol automatically
    await sql.unsafe(`
      DROP TRIGGER IF EXISTS trg_set_estatus_autorizada ON "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES";
      
      CREATE OR REPLACE FUNCTION "EFINANCIANET_DB".trg_set_estatus_autorizada()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Si es cuenta eje y estatus_sol es NULL, poner 'Autorizada'
        IF NEW.cta_eje_chec = true AND NEW.estatus_sol IS NULL THEN
          NEW.estatus_sol := 'Autorizada';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_set_estatus_autorizada
      BEFORE INSERT ON "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      FOR EACH ROW
      EXECUTE FUNCTION "EFINANCIANET_DB".trg_set_estatus_autorizada();
    `);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Trigger creado: estatus_sol = Autorizada para cuentas eje' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});