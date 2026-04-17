/**
 * useGarantiasDB.ts — v1.0 (RPC-FIRST)
 *
 * ═══════════════════════════════════════════════════════════════════
 * Módulo Garantías → Tabla: EFINANCIANET_DB."J_GARANTIAS"
 *
 * Todas las operaciones usan RPCs en public schema
 * con SECURITY DEFINER que acceden al schema internamente.
 *
 * ESTRATEGIA:
 *   - SELECT  → supabase.rpc('get_all_jgarantias')
 *   - INSERT  → supabase.rpc('insert_jgarantia', {...})
 *   - UPDATE  → supabase.rpc('update_jgarantia', {...})
 *   - DELETE  → supabase.rpc('delete_jgarantia', {...})
 *   - Fallback → sessionStorage
 *
 * data JSON estructura:
 *   {
 *     "default": { ...campos del tab Default },
 *     "expedienteElectronico": { ...documentos }
 *   }
 * ═══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Garantia, DocumentoExpediente } from '@/types/garantia';

const DB_AVAILABLE = true;
const SS_KEY = 'garantias_db_local';
const LOG = '[GarantiasDB]';

// ═══════════════════════════════════════════════════════════════════
// UUID HELPER
// ═══════════════════════════════════════════════════════════════════
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeUuid(val: string | null | undefined): string | null {
  if (!val) return null;
  return UUID_RE.test(val) ? val : null;
}

// ═══════════════════════════════════════════════════════════════════
// TIPOS INTERNOS
// ═══════════════════════════════════════════════════════════════════
interface JGarantiaRow {
  uuid: string;
  garantia: string;
  tipo: string;
  subtipo: string;
  descripcion: string | null;
  ubicacion: string | null;
  valor_nominal: number | null;
  fecha_registro: string | null;
  cliente_id: string | null;
  data: Record<string, any> | null;
}

export type GarantiaBackendStatus = 'ready' | 'pending-deploy' | 'empty' | 'error' | 'local-only';

// ═══════════════════════════════════════════════════════════════════
// SESSION STORAGE helpers
// ═══════════════════════════════════════════════════════════════════
function loadFromSession(): Garantia[] {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveToSession(items: Garantia[]) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════
// MAPEO — JGarantiaRow → Garantia
// ═══════════════════════════════════════════════════════════════════
function mapRowToGarantia(row: JGarantiaRow): Garantia {
  const d = (row.data || {}) as Record<string, any>;
  const def = (d.default || d) as Record<string, any>;
  const exp = (d.expedienteElectronico || {}) as Record<string, any>;

  return {
    id: row.uuid,
    tipo: row.tipo || def.tipo || '',
    subtipo: row.subtipo || def.subtipo || '',
    garantia: row.garantia || def.garantia || '',
    descripcion: row.descripcion || def.descripcion || '',
    valorNominal: row.valor_nominal ?? def.valorNominal ?? 0,
    ubicacion: row.ubicacion || def.ubicacion || '',
    fechaTasacion: def.fechaTasacion || '',
    valorTasacion: def.valorTasacion ?? 0,
    peritaTasador: def.peritaTasador || '',
    tasaInteres: def.tasaInteres || '',
    observaciones: def.observaciones || '',
    fechaVencimiento: def.fechaVencimiento || '',
    fechaRegistro: row.fecha_registro || def.fechaRegistro || new Date().toISOString(),
    estatus: def.estatus || '',
    estado: def.estado || '',
    municipio: def.municipio || '',
    cliente_id: row.cliente_id || '',
    clienteNombre: def.clienteNombre || '',
    documentos: Array.isArray(exp.documentos) ? exp.documentos : [],
  };
}

// ═══════════════════════════════════════════════════════════════════
// Garantia → payload para INSERT/UPDATE RPC
// ═══════════════════════════════════════════════════════════════════
function buildDataJson(g: Garantia): Record<string, any> {
  return {
    default: {
      tipo: g.tipo,
      subtipo: g.subtipo,
      garantia: g.garantia,
      descripcion: g.descripcion,
      valorNominal: g.valorNominal,
      ubicacion: g.ubicacion,
      fechaTasacion: g.fechaTasacion,
      valorTasacion: g.valorTasacion,
      peritaTasador: g.peritaTasador,
      tasaInteres: g.tasaInteres,
      observaciones: g.observaciones,
      fechaVencimiento: g.fechaVencimiento,
      fechaRegistro: g.fechaRegistro,
      estatus: g.estatus,
      estado: g.estado,
      municipio: g.municipio,
      clienteNombre: g.clienteNombre || '',
    },
    expedienteElectronico: {
      documentos: g.documentos || [],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// RPC: SELECT ALL
// ═══════════════════════════════════════════════════════════════════
async function tryRPC(): Promise<{ ok: boolean; rows: JGarantiaRow[]; error?: string }> {
  try {
    console.log(`${LOG} RPC get_all_jgarantias...`);
    const { data, error } = await supabase.rpc('get_all_jgarantias');
    if (error) {
      const isNotFound = error.message.includes('Could not find the function');
      if (isNotFound) {
        console.warn(`${LOG} SELECT — RPCs no desplegadas aún. Ejecutar migration-jgarantias-rpcs.sql en Supabase SQL Editor.`);
      } else {
        console.warn(`${LOG} RPC FALLÓ:`, error.message);
      }
      return { ok: false, rows: [], error: error.message };
    }
    const rows = (data || []) as JGarantiaRow[];
    console.log(`${LOG} RPC OK — ${rows.length} filas`);
    return { ok: true, rows };
  } catch (err: any) {
    console.error(`${LOG} RPC EXCEPCIÓN:`, err);
    return { ok: false, rows: [], error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// RPC: INSERT
// ═══════════════════════════════════════════════════════════════════
async function insertGarantia(g: Garantia): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  try {
    const dataJson = buildDataJson(g);
    const clienteId = safeUuid(g.cliente_id);
    console.log(`${LOG} INSERT via RPC insert_jgarantia...`, {
      garantia: g.garantia,
      tipo: g.tipo,
      subtipo: g.subtipo,
      cliente_id: g.cliente_id,
      cliente_id_safe: clienteId,
      valorNominal: g.valorNominal,
    });

    const { data, error } = await supabase.rpc('insert_jgarantia', {
      p_garantia: g.garantia,
      p_tipo: g.tipo,
      p_subtipo: g.subtipo,
      p_descripcion: g.descripcion || '',
      p_ubicacion: g.ubicacion || null,
      p_valor_nominal: g.valorNominal || null,
      p_fecha_registro: g.fechaRegistro || new Date().toISOString(),
      p_cliente_id: clienteId,
      p_data: dataJson,
    });

    console.log(`${LOG} INSERT raw response:`, { data, error });

    if (error) {
      const isNotFound = error.message.includes('Could not find the function');
      const isFKViolation = error.message.includes('violates foreign key') || error.message.includes('is not present in table');
      if (isNotFound) {
        console.warn(`${LOG} INSERT — RPC no existe aún. Ejecutar hotfix-insert-jgarantia.sql en Supabase SQL Editor.`);
      } else if (isFKViolation) {
        console.warn(`${LOG} INSERT — FK violation en cliente_id. El cliente no existe en J_CLIENTES. Ejecutar hotfix-insert-jgarantia.sql para remover FK.`);
      } else {
        console.warn(`${LOG} INSERT FALLÓ:`, error.message, error);
      }
      return { ok: false, error: error.message };
    }

    // RETURNS SETOF → data es array; RETURNS single → data es objeto
    const row = Array.isArray(data) ? data[0] : data;
    const id = row?.uuid || row?.id;
    console.log(`${LOG} INSERT OK — id:`, id, '| row:', row);

    if (!id) {
      console.warn(`${LOG} INSERT — RPC retornó OK pero sin UUID. data:`, data);
      return { ok: false, error: 'RPC retornó sin UUID' };
    }

    return { ok: true, id };
  } catch (err: any) {
    console.error(`${LOG} INSERT EXCEPCIÓN:`, err);
    return { ok: false, error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// RPC: UPDATE
// ═══════════════════════════════════════════════════════════════════
async function updateGarantia(g: Garantia): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  try {
    const dataJson = buildDataJson(g);
    console.log(`${LOG} UPDATE via RPC update_jgarantia...`, g.id);
    const { error } = await supabase.rpc('update_jgarantia', {
      p_uuid: String(g.id),
      p_garantia: g.garantia,
      p_tipo: g.tipo,
      p_subtipo: g.subtipo,
      p_descripcion: g.descripcion || '',
      p_ubicacion: g.ubicacion || null,
      p_valor_nominal: g.valorNominal || null,
      p_cliente_id: safeUuid(g.cliente_id),
      p_data: dataJson,
    });

    if (error) {
      console.warn(`${LOG} UPDATE FALLÓ:`, error.message);
      return { ok: false, error: error.message };
    }
    console.log(`${LOG} UPDATE OK`);
    return { ok: true };
  } catch (err: any) {
    console.error(`${LOG} UPDATE EXCEPCIÓN:`, err);
    return { ok: false, error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// RPC: DELETE
// ═══════════════════════════════════════════════════════════════════
async function deleteGarantiaDB(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  try {
    console.log(`${LOG} DELETE via RPC delete_jgarantia...`, id);
    const { error } = await supabase.rpc('delete_jgarantia', { p_uuid: id });
    if (error) {
      console.warn(`${LOG} DELETE FALLÓ:`, error.message);
      return { ok: false, error: error.message };
    }
    console.log(`${LOG} DELETE OK`);
    return { ok: true };
  } catch (err: any) {
    console.error(`${LOG} DELETE EXCEPCIÓN:`, err);
    return { ok: false, error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function useGarantiasDB(clienteId?: string | null) {
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<GarantiaBackendStatus>(
    DB_AVAILABLE ? 'ready' : 'local-only'
  );
  const hasFetched = useRef(false);

  // ── FETCH ALL (filtrado por cliente si se proporciona) ──
  const fetchGarantias = useCallback(async () => {
    console.log(`${LOG} ═══ fetchGarantias() START ═══`);
    setLoading(true);
    setError(null);

    if (!DB_AVAILABLE) {
      let local = loadFromSession();
      // Filtrar por cliente si se proporciona
      if (clienteId) {
        local = local.filter(g => g.cliente_id === clienteId);
      }
      setGarantias(local);
      setBackendStatus('local-only');
      setLoading(false);
      return;
    }

    try {
      const result = await tryRPC();
      if (result.ok) {
        let mapped = result.rows.map(mapRowToGarantia);
        let local = loadFromSession();
        
        console.log(`${LOG} Raw mapped (before filter):`, mapped.length, '| clienteId:', clienteId);
        
        // Filtrar por cliente si se proporciona
        if (clienteId) {
          const beforeCount = mapped.length;
          mapped = mapped.filter(g => {
            const match = String(g.cliente_id || '') === String(clienteId || '');
            if (!match) console.log(`${LOG} Filter mismatch: g.cliente_id="${g.cliente_id}" vs clienteId="${clienteId}"`);
            return match;
          });
          local = local.filter(g => String(g.cliente_id || '') === String(clienteId || ''));
          console.log(`${LOG} After filter: ${beforeCount} -> ${mapped.length}`);
        }
        
        // ── MERGE: si DB retorna vacío pero hay datos locales, conservarlos ──
        if (mapped.length > 0) {
          // DB tiene datos reales → usarlos como fuente de verdad
          setGarantias(mapped);
          saveToSession(mapped);
          setBackendStatus('ready');
        } else if (local.length > 0) {
          // DB vacía pero hay datos locales (inserts que no llegaron a DB) → conservarlos
          console.log(`${LOG} DB vacía pero hay ${local.length} registros locales — conservando sessionStorage`);
          setGarantias(local);
          setBackendStatus('empty');
        } else {
          // Ambos vacíos
          setGarantias([]);
          setBackendStatus('empty');
        }
        console.log(`${LOG} ═══ fetchGarantias() END — ${mapped.length} DB + ${local.length} local ═══`);
      } else {
        console.warn(`${LOG} RPC falló — fallback a sessionStorage`);
        let local = loadFromSession();
        if (clienteId) {
          local = local.filter(g => g.cliente_id === clienteId);
        }
        setGarantias(local);
        setBackendStatus('pending-deploy');
        setError(result.error || null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setBackendStatus('error');
      let local = loadFromSession();
      if (clienteId) {
        local = local.filter(g => g.cliente_id === clienteId);
      }
      if (local.length > 0) setGarantias(local);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  // ── SAVE (Insert o Update) ──
  const saveGarantia = useCallback(async (g: Garantia): Promise<{ ok: boolean; source?: 'db' | 'local'; error?: string }> => {
    setSaving(true);
    try {
      const isNumericId = typeof g.id === 'number';
      const isLocalId = typeof g.id === 'string' && (g.id.startsWith('local-') || g.id.length < 10);
      const existsInState = garantias.some(x => x.id === g.id);
      const isNew = isNumericId || isLocalId || !existsInState;

      console.log(`${LOG} SAVE — id:`, g.id, '| type:', typeof g.id, '| isNew:', isNew, '| existsInState:', existsInState);

      if (DB_AVAILABLE) {
        if (isNew) {
          const result = await insertGarantia(g);
          if (result.ok && result.id) {
            console.log(`${LOG} ✅ INSERT DB exitoso — nuevo id:`, result.id);
            const updated = { ...g, id: result.id };
            setGarantias(prev => {
              const next = [...prev.filter(x => x.garantia !== g.garantia), updated];
              saveToSession(next);
              return next;
            });
            return { ok: true, source: 'db' };
          }
          console.warn(`${LOG} ❌ INSERT DB falló — error:`, result.error, '| Guardando en sessionStorage...');
        } else {
          const result = await updateGarantia(g);
          if (result.ok) {
            console.log(`${LOG} ✅ UPDATE DB exitoso — id:`, g.id);
            setGarantias(prev => {
              const next = prev.map(x => x.id === g.id ? g : x);
              saveToSession(next);
              return next;
            });
            return { ok: true, source: 'db' };
          }
          console.warn(`${LOG} ❌ UPDATE DB falló — error:`, result.error, '| Guardando en sessionStorage...');
        }
      }

      // ── Fallback local ──
      console.log(`${LOG} 💾 Fallback: guardando solo en sessionStorage`);
      const localId = isNew ? (typeof g.id === 'string' ? g.id : `local-${Date.now()}`) : g.id;
      const localGarantia = { ...g, id: localId };
      setGarantias(prev => {
        const idx = prev.findIndex(x => x.id === localGarantia.id || x.garantia === g.garantia);
        let next: Garantia[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = localGarantia;
        } else {
          next = [...prev, localGarantia];
        }
        saveToSession(next);
        return next;
      });
      return { ok: true, source: 'local' };
    } finally {
      setSaving(false);
    }
  }, [garantias]);

  // ── DELETE ──
  const deleteGarantia = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    if (DB_AVAILABLE) {
      const result = await deleteGarantiaDB(id);
      if (!result.ok) console.warn(`${LOG} DELETE falló:`, result.error);
    }
    setGarantias(prev => {
      const next = prev.filter(g => String(g.id) !== id);
      saveToSession(next);
      return next;
    });
    return { ok: true };
  }, []);

  // ── ASSOCIATE / DISASSOCIATE cliente_id ──
  const associateToCliente = useCallback(async (
    garantiaUuid: string,
    clienteId: string | null
  ): Promise<{ ok: boolean; source?: 'db' | 'local'; error?: string }> => {
    try {
      const safeClienteId = clienteId ? (UUID_RE.test(clienteId) ? clienteId : null) : null;
      const isValidUuid = UUID_RE.test(garantiaUuid);
      console.log(`${LOG} ASSOCIATE — garantia:`, garantiaUuid,
        '→ cliente_id:', clienteId,
        '| safeUuid:', safeClienteId,
        '| garantiaIsUuid:', isValidUuid);

      let dbOk = false;

      // Intentar RPC solo si DB disponible y la garantía tiene UUID real
      if (DB_AVAILABLE && isValidUuid) {
        try {
          const { error } = await supabase.rpc('update_jgarantia', {
            p_uuid: garantiaUuid,
            p_cliente_id: safeClienteId,
          });
          if (error) {
            console.warn(`${LOG} ASSOCIATE RPC FALLÓ:`, error.message);
          } else {
            console.log(`${LOG} ASSOCIATE RPC OK`);
            dbOk = true;
          }
        } catch (rpcErr: any) {
          console.warn(`${LOG} ASSOCIATE RPC EXCEPCIÓN:`, rpcErr?.message);
        }
      }

      // ── SIEMPRE actualizar estado local con el clienteId original (no sanitizado) ──
      // Esto permite que el filtro en Clientes funcione incluso con IDs temporales
      const localClienteId = clienteId || '';
      setGarantias(prev => {
        const next = prev.map(g =>
          String(g.id) === garantiaUuid ? { ...g, cliente_id: localClienteId } : g
        );
        saveToSession(next);
        return next;
      });

      return { ok: true, source: dbOk ? 'db' : 'local' };
    } catch (err: any) {
      console.error(`${LOG} ASSOCIATE EXCEPCIÓN:`, err);
      return { ok: false, error: err?.message || String(err) };
    }
  }, []);

  // ── Auto-fetch ──
  useEffect(() => {
    console.log(`${LOG} Auto-fetch triggered, clienteId:`, clienteId);
    fetchGarantias();
  }, [clienteId]);

  return {
    garantias,
    loading,
    saving,
    error,
    backendStatus,
    refetch: fetchGarantias,
    saveGarantia,
    deleteGarantia,
    associateToCliente,
  };
}