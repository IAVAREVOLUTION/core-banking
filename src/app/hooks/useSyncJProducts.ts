// ═══════════════════════════════════════════════════════════════════
// useSyncJProducts — Utilidad institucional para sincronizar
// registros con EFINANCIANET_DB.J_PRODUCTOS en Supabase.
//
// Columnas REALES de la tabla (solo 3):
//   id   (uuid PK autogenerado — gen_random_uuid())
//   type (varchar NOT NULL)   — "Captación", "Credito", "ProductoLineaCredito"
//   data (jsonb NULL)         — JSON institucional completo
//
// NO existen columnas subtipo ni estatus en la tabla.
// Esos valores se almacenan DENTRO del jsonb "data".
//
// El servidor (edge function) espera en el body:
//   { tipo: string, datos: object }
// y los mapea a:
//   type ← tipo,  data ← datos
//
// Para INSERT  → POST  /productos         (id lo genera la BD)
// Para UPDATE  → PUT   /productos/:id     (deep merge frontend v6.0)
//
// ═══════════════════════════════════════════════════════════════════
// PROTECCIÓN FRONTEND DE DEEP MERGE (v6.0)
//
// Antes de enviar un PUT, el frontend:
//   1. GET /productos/:id → lee el data ACTUAL de la BD
//   2. Deep merge local   → incoming sobre existing (nunca pierde campos)
//   3. PUT /productos/:id → envía el data COMPLETO
//
// Esto garantiza que campos existentes no se pierdan
// INDEPENDIENTEMENTE de si la edge function tiene deep merge o no.
// ═══════════════════════════════════════════════════════════════════
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

// ⚠️ Flag institucional: la ruta GET /productos/:id NO está desplegada.
// Cuando se redespliegue la edge function con soporte para esta ruta,
// cambiar a true para activar el Nivel 1 del deep merge (más eficiente).
const RUTA_POR_ID_DISPONIBLE = false;

// ═══════════════════════════════════════════════════════════════════
// Deep merge FRONTEND — misma lógica institucional que useSyncJClientes
// Fusiona incoming sobre existing SIN perder campos existentes.
// ══════════════════════════════════════════════════════════════��═══
function deepMergeData(
  existing: Record<string, any>,
  incoming: Record<string, any>,
): Record<string, any> {
  const merged: Record<string, any> = { ...existing };

  for (const [key, incomingValue] of Object.entries(incoming)) {
    // Campos vacíos del frontend → NO TOCAR (conservar existente)
    if (incomingValue === null || incomingValue === undefined || incomingValue === '') {
      continue;
    }
    // Arrays se reemplazan atómicamente
    if (Array.isArray(incomingValue)) {
      merged[key] = incomingValue;
      continue;
    }
    // Sub-objetos → merge recursivo
    if (typeof incomingValue === 'object') {
      const existingChild = existing[key];
      if (existingChild && typeof existingChild === 'object' && !Array.isArray(existingChild)) {
        merged[key] = deepMergeData(existingChild, incomingValue);
      } else {
        merged[key] = incomingValue;
      }
      continue;
    }
    // Escalar con valor real → actualizar
    merged[key] = incomingValue;
  }

  return merged;
}

// ═══════════════════════════════════════════════════════════════════
// Interfaces — nueva (institucional) + legacy (retrocompatible)
// ═══════════════════════════════════════════════════════════════════

/**
 * Firma INSTITUCIONAL (v2):
 *   type    → columna type ("Captación", "Credito", "ProductoLineaCredito")
 *   subtipo → se embebe DENTRO de data.subtipo ("Captación", "Crédito", etc.)
 *   estatus → se embebe DENTRO de data.estatus ("Activo", "Inactivo", "Pendiente")
 *   data    → columna data (jsonb)
 */
interface SyncProductoOptionsV2 {
  type: string;
  subtipo: string;
  estatus: string;
  data: Record<string, any>;
  label?: string;
  existingId?: string | null;
}

/** Firma LEGACY (v1): tipo + datos — retrocompatible con ProductoForm (Crédito) y ProductoLineaCredito */
interface SyncProductoOptionsLegacy {
  tipo: string;
  datos: Record<string, any>;
  label?: string;
  existingId?: number | string | null;
}

type SyncProductoOptions = SyncProductoOptionsV2 | SyncProductoOptionsLegacy;

/** Type guard para distinguir firma v2 de legacy */
function isV2Options(opts: SyncProductoOptions): opts is SyncProductoOptionsV2 {
  return 'type' in opts && 'subtipo' in opts && 'data' in opts;
}

/**
 * Sincroniza un registro con EFINANCIANET_DB.J_PRODUCTOS.
 *
 * Acepta DOS firmas:
 *   v2 (institucional): { type, subtipo, estatus, data }
 *   v1 (legacy):        { tipo, datos }
 *
 * En AMBOS casos el body enviado al servidor es siempre:
 *   { tipo: string, datos: object }
 * porque la edge function desplegada solo reconoce esos campos.
 *
 * Para v2, subtipo y estatus se inyectan DENTRO del jsonb datos
 * (la tabla NO tiene esas columnas físicas).
 *
 * Retorna el id (uuid) generado/usado, o null si falló.
 */
export async function syncToJProducts(opts: SyncProductoOptions): Promise<string | null> {
  // ── Normalizar ambas firmas ──
  let tipo: string;       // → columna type
  let data: Record<string, any>;  // → columna data (jsonb)
  let label: string | undefined;
  let existingId: string | null;

  if (isV2Options(opts)) {
    // Firma institucional v2
    tipo = opts.type;       // "Captación", "Credito", "ProductoLineaCredito"
    // Inyectar subtipo y estatus DENTRO del jsonb
    data = {
      ...opts.data,
      subtipo: opts.subtipo,    // "Captación"
      estatus: opts.estatus,    // "Activo" / "Inactivo" / "Pendiente"
    };
    // También inyectar en el nodo default si existe
    if (data.default && typeof data.default === 'object') {
      data.default = {
        ...data.default,
        subtipo: opts.subtipo,
        estatus: opts.estatus,
      };
    }
    label = opts.label;
    existingId = opts.existingId ?? null;
  } else {
    // Firma legacy v1
    tipo = opts.tipo;
    data = opts.datos;
    label = opts.label;
    existingId = opts.existingId ? String(opts.existingId) : null;
  }

  const displayLabel = label || 'Producto';

  try {
    let url: string;
    let method: string;
    let mergedData = data; // Por defecto, usar data tal cual (para INSERT)

    if (existingId) {
      // ═══════════════════════════════════════════════════════════════
      // UPDATE — PROTECCIÓN FRONTEND v6.0:
      // 1. Leer data ACTUAL de la BD
      // 2. Deep merge: incoming (formulario) sobre existing (BD)
      // 3. Enviar data COMPLETO
      // ═══════════════════════════════════════════════════════════════
      url = `${BASE_URL}/productos/${existingId}`;
      method = 'PUT';

      console.log(`[syncToJProducts] ════ FRONTEND DEEP MERGE v6.0 ════`);
      console.log(`[syncToJProducts] PASO 1: Leyendo data actual de BD para id=${existingId}...`);

      // ── Helper: extraer data de un registro encontrado ──
      const extractExistingData = (record: any): Record<string, any> | null => {
        const rawData = record?.data;
        if (!rawData) return null;
        const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        return parsed && typeof parsed === 'object' ? parsed : null;
      };

      let existingData: Record<string, any> | null = null;

      // ── Nivel 1: GET /productos/:id (ruta por ID) ──
      if (RUTA_POR_ID_DISPONIBLE) {
        try {
          const getRes = await fetch(`${BASE_URL}/productos/${existingId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${publicAnonKey}` },
          });

          if (getRes.ok) {
            const getText = await getRes.text();
            let getResult: any;
            try { getResult = JSON.parse(getText); } catch { getResult = null; }

            if (getResult?.success && getResult?.data) {
              // Soportar respuesta como objeto directo o array
              const record = Array.isArray(getResult.data) ? getResult.data[0] : getResult.data;
              existingData = extractExistingData(record);
              if (existingData) {
                console.log(`[syncToJProducts] Nivel 1 OK: GET /productos/${existingId} — ${Object.keys(existingData).length} keys`);
              }
            }
          } else {
            console.warn(`[syncToJProducts] Nivel 1: GET /productos/${existingId} → HTTP ${getRes.status}, intentando fallback...`);
          }
        } catch (err1) {
          console.warn(`[syncToJProducts] Nivel 1: Error de red en GET /productos/${existingId}, intentando fallback...`);
        }
      }

      // ── Nivel 2: GET /productos (todos) + filtro client-side por id ──
      // Fallback cuando la ruta /productos/:id no está desplegada (404)
      if (!existingData) {
        try {
          console.log(`[syncToJProducts] Nivel 2: GET /productos (todos) + filtro client-side por id=${existingId}...`);
          const getRes2 = await fetch(`${BASE_URL}/productos`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${publicAnonKey}` },
          });

          if (getRes2.ok) {
            const json2 = await getRes2.json();
            const allRows: any[] = json2?.data || [];
            const match = allRows.find((r: any) => r.id === existingId);
            if (match) {
              existingData = extractExistingData(match);
              if (existingData) {
                console.log(`[syncToJProducts] Nivel 2 OK: encontrado en /productos (${allRows.length} total) — ${Object.keys(existingData).length} keys`);
              }
            } else {
              console.warn(`[syncToJProducts] Nivel 2: id=${existingId} no encontrado entre ${allRows.length} registros`);
            }
          } else {
            console.warn(`[syncToJProducts] Nivel 2: GET /productos → HTTP ${getRes2.status}`);
          }
        } catch (err2) {
          console.warn(`[syncToJProducts] Nivel 2: Error de red en GET /productos`);
        }
      }

      // ── PASO 2: Deep merge si se obtuvo data existente ──
      if (existingData) {
        console.log(`[syncToJProducts] EXISTING data keys (${Object.keys(existingData).length}):`, Object.keys(existingData).join(', '));
        console.log(`[syncToJProducts] INCOMING data keys (${Object.keys(data).length}):`, Object.keys(data).join(', '));

        mergedData = deepMergeData(existingData, data);

        console.log(`[syncToJProducts] MERGED data keys (${Object.keys(mergedData).length}):`, Object.keys(mergedData).join(', '));

        // Validación: merged nunca debe tener MENOS keys que existing
        if (Object.keys(mergedData).length < Object.keys(existingData).length) {
          console.error(`[syncToJProducts] ALERTA: merged (${Object.keys(mergedData).length}) < existing (${Object.keys(existingData).length})! Posible pérdida de datos.`);
        }
      } else {
        console.warn(`[syncToJProducts] No se pudo leer data existente (ambos niveles fallaron). Enviando data del formulario sin merge.`);
      }
    } else {
      // INSERT — sin id, la BD lo genera con gen_random_uuid()
      url = `${BASE_URL}/productos`;
      method = 'POST';
    }

    console.log(`[syncToJProducts] ${method} ${url} | tipo=${tipo} | subtipo=${data.subtipo || 'N/A'} | estatus=${data.estatus || 'N/A'}`);
    console.log(`[syncToJProducts] FINAL data keys: ${Object.keys(mergedData).length}`);

    // ═══════════════════════════════════════════════════════════════
    // BODY: siempre { tipo, datos }
    //   tipo  → servidor lo mapea a columna type
    //   datos → servidor lo mapea a columna data (jsonb)
    //
    // subtipo y estatus viajan DENTRO de datos (no hay columnas para ellos)
    // ═══════════════════════════════════════════════════════════════
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ tipo, datos: mergedData }),
    });

    // Safe text-first parsing
    const text = await res.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      console.error(`[syncToJProducts] Respuesta no-JSON del servidor (HTTP ${res.status}):`, text.substring(0, 300));
      toast.error('Error al sincronizar con J_PRODUCTOS', {
        description: `Respuesta inesperada del servidor (HTTP ${res.status})`,
        duration: 5000,
      });
      return existingId ?? null;
    }

    if (!res.ok) {
      console.error(`[syncToJProducts] Error al sincronizar ${displayLabel} con J_PRODUCTOS:`, result);
      toast.error('Error al sincronizar con J_PRODUCTOS', {
        description: result.error || `HTTP ${res.status} — ${displayLabel}`,
        duration: 5000,
      });
      return existingId ?? null;
    }

    // El servidor retorna { success, data: [...], id: uuid, _version?: string }
    const returnedId = result.id ?? existingId ?? result.data?.[0]?.id ?? null;

    // ── VERIFICACIÓN DE DESPLIEGUE ──
    if (result._version) {
      console.log(`[syncToJProducts] SERVER VERSION: ${result._version}`);
    }

    console.log(`[syncToJProducts] J_PRODUCTOS — ${existingId ? 'UPDATE' : 'INSERT'} exitoso (${displayLabel}):`, result);
    toast.success('Sincronizado con J_PRODUCTOS', {
      description: `ID: ${returnedId ? String(returnedId).substring(0, 8) + '...' : 'N/A'} — Type: ${tipo}`,
      duration: 4000,
    });

    return returnedId;
  } catch (err) {
    console.error(`[syncToJProducts] Error de red al sincronizar ${displayLabel} con J_PRODUCTOS:`, err);
    toast.error('Error de conexión al sincronizar con J_PRODUCTOS', {
      description: `${displayLabel}: ${String(err)}`,
      duration: 5000,
    });
    return null;
  }
}