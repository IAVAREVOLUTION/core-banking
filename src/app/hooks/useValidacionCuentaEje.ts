// ═══════════════════════════════════════════════════════════════════
// useValidacionCuentaEje.ts — Validación atómica de Cuenta Eje única
//
// Estrategia de intentos (fail-silent pre-deploy):
//   1. RPC public.check_cuenta_eje_unique (atómico en BD)
//   2. Edge Function /mantenimiento/check-cuenta-eje/:cuentaEje
//   3. Fallback: sessionStorage (lectura local de J_CLIENTES cacheados)
//
// Pre-deploy: los intentos 1 y 2 fallan silenciosamente (debug log).
// Post-deploy: el RPC es el método primario, los demás son fallback.
//
// Logging: [CuentaEjeValidation]
// ═══════════════════════════════════════════════════════════════════
import { supabase } from '../lib/supabaseClient';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

/** Track whether RPC is available to avoid repeated failed calls */
let rpcAvailable: boolean | null = null;
/** Track whether Edge Function is available */
let edgeFnAvailable: boolean | null = null;

interface CuentaEjeValidationResult {
  isUnique: boolean;
  existingId: string | null;
  existingNombre: string | null;
}

/**
 * Valida que una Cuenta Eje sea única en J_CLIENTES.
 * Excluye el registro actual (excludeId) para permitir edición sin falso positivo.
 */
export async function validateCuentaEjeUnique(
  cuentaEje: string,
  excludeId?: string | null,
): Promise<CuentaEjeValidationResult> {
  if (!cuentaEje || cuentaEje.trim() === '') {
    return { isUnique: true, existingId: null, existingNombre: null };
  }

  const trimmed = cuentaEje.trim();
  console.log(`[CuentaEjeValidation] Verificando unicidad: "${trimmed}" excludeId=${excludeId || '(none)'}`);

  // ── INTENTO 1: RPC atómico en BD ──
  // Skip si ya sabemos que no está disponible (pre-deploy)
  if (rpcAvailable !== false) {
    try {
      const { data, error } = await supabase.rpc('check_cuenta_eje_unique', {
        p_cuenta_eje: trimmed,
        p_exclude_id: excludeId || null,
      });

      if (!error && data && data.length > 0) {
        rpcAvailable = true;
        const row = data[0];
        const result: CuentaEjeValidationResult = {
          isUnique: row.is_unique,
          existingId: row.existing_id,
          existingNombre: row.existing_nombre,
        };
        console.log(`[CuentaEjeValidation] RPC OK:`, result);
        return result;
      }

      if (error) {
        // PGRST202 = function not found → pre-deploy, mark as unavailable
        const isNotFound = error.message?.includes('Could not find the function')
          || error.code === 'PGRST202'
          || error.message?.includes('schema cache');
        if (isNotFound) {
          rpcAvailable = false;
          console.debug(`[CuentaEjeValidation] RPC no disponible (pre-deploy). Usando fallback...`);
        } else {
          console.warn(`[CuentaEjeValidation] RPC error inesperado: ${error.message}`);
        }
      }
    } catch (rpcErr) {
      console.debug(`[CuentaEjeValidation] RPC exception (pre-deploy):`, rpcErr);
      rpcAvailable = false;
    }
  }

  // ── INTENTO 2: Edge Function ──
  // Skip si ya sabemos que no está disponible
  if (edgeFnAvailable !== false) {
    try {
      const url = `${BASE_URL}/mantenimiento/check-cuenta-eje/${encodeURIComponent(trimmed)}${excludeId ? `?excludeId=${excludeId}` : ''}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (res.ok) {
        edgeFnAvailable = true;
        const json = await res.json();
        if (json.success) {
          const result: CuentaEjeValidationResult = {
            isUnique: json.isUnique,
            existingId: json.existingId,
            existingNombre: json.existingNombre,
          };
          console.log(`[CuentaEjeValidation] Edge Function OK:`, result);
          return result;
        }
      }

      if (res.status === 404) {
        edgeFnAvailable = false;
        console.debug(`[CuentaEjeValidation] Edge Function no disponible (404, pre-deploy). Usando sessionStorage...`);
      } else if (!res.ok) {
        console.warn(`[CuentaEjeValidation] Edge Function HTTP ${res.status}`);
      }
    } catch (fetchErr) {
      edgeFnAvailable = false;
      console.debug(`[CuentaEjeValidation] Edge Function no accesible (pre-deploy):`, fetchErr);
    }
  }

  // ── INTENTO 3: Fallback sessionStorage ──
  // Busca en clientes cacheados localmente (J_CLIENTES sync data)
  try {
    const allKeys = Object.keys(sessionStorage);
    for (const key of allKeys) {
      // Scan both cliente_ entries and jclientes_ sync entries
      try {
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        const stored = JSON.parse(raw);

        // Handle direct cliente_ entries
        if (key.startsWith('cliente_') && !key.includes('_list') && !key.includes('_tab')) {
          const storedCuenta = stored.cuentaEje || stored.data?.cuentaEje;
          if (storedCuenta === trimmed) {
            const storedId = stored.dbUuid || stored.idCliente || stored.id || key.replace('cliente_', '');
            if (excludeId && storedId === excludeId) continue;
            console.log(`[CuentaEjeValidation] sessionStorage: duplicado encontrado en ${key}`);
            return {
              isUnique: false,
              existingId: storedId,
              existingNombre: stored.nombre || stored.nombreCompleto || stored.data?.nombre || '(local)',
            };
          }
        }

        // Handle jclientes_ sync cache (array of rows)
        if (key.startsWith('jclientes_') || key === 'jclientes_cache') {
          const rows = Array.isArray(stored) ? stored : (stored.rows || stored.data || []);
          if (!Array.isArray(rows)) continue;
          for (const row of rows) {
            const rowData = row.data || row;
            const rowCuenta = rowData.cuentaEje || rowData.cuenta_eje;
            if (rowCuenta === trimmed) {
              const rowId = row.id || row.dbUuid;
              if (excludeId && rowId === excludeId) continue;
              console.log(`[CuentaEjeValidation] sessionStorage (sync cache): duplicado en row ${rowId}`);
              return {
                isUnique: false,
                existingId: rowId,
                existingNombre: rowData.nombre || rowData.nombreCompleto || '(cache)',
              };
            }
          }
        }
      } catch { /* skip invalid entries */ }
    }
    console.log(`[CuentaEjeValidation] sessionStorage: no se encontró duplicado — cuenta "${trimmed}" es única (local)`);
  } catch (ssErr) {
    console.warn(`[CuentaEjeValidation] sessionStorage error:`, ssErr);
  }

  // Si todo falla, asumir único (no bloquear guardado)
  return { isUnique: true, existingId: null, existingNombre: null };
}

/**
 * Reset availability flags — útil después de deploy de Edge Function
 * para re-intentar RPC y Edge Function.
 */
export function resetCuentaEjeValidationCache(): void {
  rpcAvailable = null;
  edgeFnAvailable = null;
  console.log(`[CuentaEjeValidation] Cache de disponibilidad reseteado`);
}