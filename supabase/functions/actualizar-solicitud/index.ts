/**
 * Edge Function para actualizar solicitudes de crédito - PATCH semantics
 * Corrige el bug de NULL en estatus_sol
 * 
 * Comportamiento PATCH:
 * - Solo actualiza campos que el frontend envía explícitamente
 * - NO convierte campos no enviados a NULL
 * - Cuando flujo = 'Activar Prospecto', fuerza estatus_sol = 'Autorizada'
 * - También actualiza data.estatus = 'Autorizada'
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
  idle_timeout: 10,
  connect_timeout: 15,
  max_lifetime: 60,
});

function toNullStr(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function toNullUuid(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

function toNullNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
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
    // ═══════════════════════════════════════════════════════════════
    // PUT /actualizar-solicitud/:id — PATCH semantics
    // ═══════════════════════════════════════════════════════════════
    if (req.method === 'PUT' && resourcePath.startsWith('actualizar-solicitud/')) {
      const id = resourcePath.replace('actualizar-solicitud/', '');
      const body = await req.json().catch(() => ({}));
      
      console.log('[actualizar-solicitud] PUT /', id);
      console.log('[actualizar-solicitud] body keys:', Object.keys(body).join(', '));

      // Detectar flujo de activación
      const flujo = body.flujo || body.data?.flujo || '';
      const isActivarProspecto = flujo === 'Activar Prospecto';

      if (isActivarProspecto) {
        console.log('[actualizar-solicitud] 🔄 FLUJO ACTIVAR PROSPECTO — forzando estatus_sol = Autorizada');
      }

      // Verificar que existe el registro primero
      const existingRows = await sql`
        SELECT id, estatus_sol, data 
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" 
        WHERE id = ${id}::uuid
      `;

      if (existingRows.length === 0) {
        console.error('[actualizar-solicitud] No encontrado:', id);
        return new Response(JSON.stringify({ error: 'Solicitud no encontrada' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }

      const existingRecord = existingRows[0];
      console.log('[actualizar-solicitud] Existing estatus_sol:', existingRecord.estatus_sol);

      // Construir SET clause dinámicamente - SOLO campos enviados
      const setClauses: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      // Función helper para agregar campo solo si se envía
      const addField = (fieldName: string, value: unknown, transform?: (v: unknown) => unknown) => {
        // Solo incluir si el campo existe en body (no undefined)
        if (!(fieldName in body) && !fieldName.startsWith('data.')) return;
        
        let finalValue = value;
        if (transform) {
          finalValue = transform(value);
        }
        
        // Si el valor es null pero el campo SÍ está en body, incluir NULL explícito
        // Si el campo NO está en body, no incluir nada ( Patch semantics)
        setClauses.push(`${fieldName} = $${paramIndex}`);
        params.push(finalValue);
        paramIndex++;
      };

      // ═══════════════════════════════════════════════════════════
      // Lógica PATCH: construir UPDATE solo con campos presentes en body
      // ═══════════════════════════════════════════════════════════

      // Para flujo Activar Prospecto, forzar estatus_sol = 'Autorizada'
      let estatusSolValue: string | null = null;
      if (isActivarProspecto) {
        estatusSolValue = 'Autorizada';
      } else if ('estatus_sol' in body) {
        estatusSolValue = toNullStr(body.estatus_sol);
      }

      // Solo actualizar estatus_sol si:
      // 1. Es flujo Activar Prospecto (forzar)
      // 2. El campo viene en el body explícitamente
      if (estatusSolValue !== null) {
        setClauses.push(`estatus_sol = $${paramIndex}`);
        params.push(estatusSolValue);
        paramIndex++;
        console.log('[actualizar-solicitud] SET estatus_sol =', estatusSolValue);
      } else if ('estatus_sol' in body && body.estatus_sol === null) {
        // Si explicitamente envía null, permitirlo
        setClauses.push(`estatus_sol = $${paramIndex}`);
        params.push(null);
        paramIndex++;
      }
      // Si estatus_sol NO está en body, NO incluir en UPDATE (preservar existente)

      // Otros campos - solo actualizar si vienen en body
      if ('no_sol' in body) {
        setClauses.push(`no_sol = $${paramIndex}`);
        params.push(toNullStr(body.no_sol));
        paramIndex++;
      }
      if ('no_cuenta' in body) {
        setClauses.push(`no_cuenta = $${paramIndex}`);
        params.push(toNullStr(body.no_cuenta));
        paramIndex++;
      }
      if ('no_referenc1' in body) {
        setClauses.push(`no_referenc1 = $${paramIndex}`);
        params.push(toNullStr(body.no_referenc1));
        paramIndex++;
      }
      if ('descripcion' in body) {
        setClauses.push(`descripcion = $${paramIndex}`);
        params.push(toNullStr(body.descripcion));
        paramIndex++;
      }
      if ('linea_produc' in body) {
        setClauses.push(`linea_produc = $${paramIndex}`);
        params.push(toNullStr(body.linea_produc));
        paramIndex++;
      }
      if ('tipo_produc' in body) {
        setClauses.push(`tipo_produc = $${paramIndex}`);
        params.push(toNullStr(body.tipo_produc));
        paramIndex++;
      }
      if ('producto_id' in body) {
        setClauses.push(`producto_id = $${paramIndex}`);
        params.push(toNullUuid(body.producto_id));
        paramIndex++;
      }
      if ('cliente_id' in body) {
        setClauses.push(`cliente_id = $${paramIndex}`);
        params.push(toNullUuid(body.cliente_id));
        paramIndex++;
      }
      if ('monto_sol' in body) {
        setClauses.push(`monto_sol = $${paramIndex}`);
        params.push(toNullNum(body.monto_sol));
        paramIndex++;
      }
      if ('monto_aut' in body) {
        setClauses.push(`monto_aut = $${paramIndex}`);
        params.push(toNullNum(body.monto_aut));
        paramIndex++;
      }
      if ('estatus_cuen' in body) {
        setClauses.push(`estatus_cuen = $${paramIndex}`);
        params.push(toNullStr(body.estatus_cuen));
        paramIndex++;
      }
      if ('estatus_disp' in body) {
        setClauses.push(`estatus_disp = $${paramIndex}`);
        params.push(toNullStr(body.estatus_disp));
        paramIndex++;
      }
      if ('estatus_cart' in body) {
        setClauses.push(`estatus_cart = $${paramIndex}`);
        params.push(toNullStr(body.estatus_cart));
        paramIndex++;
      }
      if ('fases' in body) {
        setClauses.push(`fases = $${paramIndex}`);
        params.push(toNullStr(body.fases));
        paramIndex++;
      }

      // ═══════════════════════════════════════════════════════════
      // data JSONB - merge para no perder campos existentes
      // ═══════════════════════════════════════════════════════════
      let newData = body.data;
      if (newData && typeof newData === 'object') {
        // Para flujo Activar Prospecto, también actualizar data.estatus
        if (isActivarProspecto && newData) {
          newData = { ...newData, estatus: 'Autorizada' };
        }

        if (Object.keys(newData).length > 0) {
          // Merge con data existente usando jsonb_merge_patch
          setClauses.push(`data = data || $${paramIndex}::jsonb`);
          params.push(JSON.stringify(newData));
          paramIndex++;
        }
      }

      // Si no hay campos que actualizar, devolver error
      if (setClauses.length === 0) {
        console.log('[actualizar-solicitud] No hay campos para actualizar');
        return new Response(JSON.stringify({ 
          message: 'No hay campos para actualizar',
          currentEstatusSol: existingRecord.estatus_sol
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // agregar el ID al final de params
      params.push(id);

      // Ejecutar UPDATE dinámico
      const updateSql = `
        UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}::uuid
      `;

      console.log('[actualizar-solicitud] UPDATE SQL:', updateSql);
      console.log('[actualizar-solicitud] params:', params);

      await sql.unsafe(updateSql, params);

      // Verificar rowcount
      const verifyRows = await sql`
        SELECT id, estatus_sol, data 
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" 
        WHERE id = ${id}::uuid
      `;

      if (verifyRows.length === 0) {
        console.error('[actualizar-solicitud] Error: registro desapareció después del UPDATE');
        return new Response(JSON.stringify({ error: 'Error al actualizar' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      const updated = verifyRows[0];
      console.log('[actualizar-solicitud] ✓ Updated estatus_sol:', updated.estatus_sol);
      console.log('[actualizar-solicitud] ✓ Updated data.estatus:', updated.data?.estatus);

      // Resultado
      const result = {
        success: true,
        id: updated.id,
        estatus_sol: updated.estatus_sol,
        data_estatus: updated.data?.estatus,
        isActivarProspecto,
        flujoDetectado: flujo,
      };

      return new Response(JSON.stringify(result), {
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
    console.error('[actualizar-solicitud] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});