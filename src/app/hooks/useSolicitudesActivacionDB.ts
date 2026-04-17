/**
 * useSolicitudesActivacionDB.ts — v3.0
 *
 * Tabla: EFINANCIANET_DB."J_SOLICITUDES_ACTIVACION"
 * JOINs: J_CLIENTES (cliente_id), J_CUENTAS_CORP_CLIENTES (solicitud_id)
 *
 * ESTRATEGIA (mismo patrón que useClientesDB):
 *   1. supabase.rpc('get_solicitudes_activacion')  — con JOINs completos
 *   2. supabase.schema('EFINANCIANET_DB').from(…)  — sin JOINs, datos base
 *   3. sessionStorage                              — último recurso offline
 *
 *   INSERT/UPDATE: supabase.rpc('insert/update_solicitud_activacion')
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type {
  SolicitudActivacionListItem,
  SolicitudActivacionFormData,
} from '../components/solicitudes-activacion/solicitudActivacionStore';

// ═══════════════════════════════════════════════════════════════════
const SS_KEY = 'solicitudes_activacion_db';

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** YYYY-MM-DD (or ISO timestamp) → DD/MM/YYYY */
export function parseISOToDisplay(iso: string): string {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

/** DD/MM/YYYY → YYYY-MM-DD */
function parseDisplayToISO(display: string): string {
  if (!display) return new Date().toISOString().split('T')[0];
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(display)) return display.split('T')[0];
  return new Date().toISOString().split('T')[0];
}

export function parseMoney(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) {
    console.warn('[parseMoney] Failed to parse value:', val, '-> string:', String(val));
    return 0;
  }
  return n;
}

export function parsePct(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

/** Maps J_CUENTAS_CORP_CLIENTES.linea_produc → TIPO display value */
export function lineaProdToTipo(linea: string | null | undefined): string {
  if (!linea) return '';
  const normalized = linea.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'captacion') return 'Por Cobrar';
  if (normalized === 'credito')   return 'Por Pagar';
  return '';
}

// ═══════════════════════════════════════════════════════════════════
// DB ROW TYPES
// ═══════════════════════════════════════════════════════════════════

/** Row returned by the get_solicitudes_activacion() RPC (includes JOINs) */
export interface SolicitudActivacionDBRow {
  id: string;
  cliente_id: string | null;
  solicitud_id: string | null;
  type: string | null;
  created_at: string | null;          // actual column name in J_SOLICITUDES_ACTIVACION
  fecha_compromiso: string | null;
  estatus: string | null;
  data: Record<string, unknown> | null;
  // J_CLIENTES JOIN columns
  cliente_nombre: string | null;
  cliente_ap_paterno: string | null;
  cliente_ap_materno: string | null;
  cliente_curp: string | null;
  // J_CUENTAS_CORP_CLIENTES JOIN columns
  solicitud_type: string | null;
  solicitud_no_cuenta: string | null;
  solicitud_producto_id: string | null;
  solicitud_fecha_inicio: string | null;
  solicitud_fecha_primera_aportacion: string | null;
  solicitud_monto: unknown;
  solicitud_moneda: string | null;
  solicitud_tasa_interes: unknown;
  solicitud_linea_produc: string | null;
}

/** Row returned by schema-direct select (base columns only, no JOINs) */
interface SolicitudActivacionBaseRow {
  id: string;
  cliente_id: string | null;
  solicitud_id: string | null;
  type: string | null;
  created_at: string | null;
  fecha_compromiso: string | null;
  estatus: string | null;
  data: Record<string, unknown> | null;
}

// ═══════════════════════════════════════════════════════════════════
// MAPPERS
// ═══════════════════════════════════════════════════════════════════

function mapRowToListItem(row: SolicitudActivacionDBRow): SolicitudActivacionListItem {
  let d: Record<string, unknown> = {};
  if (typeof row.data === 'string') {
    try { d = JSON.parse(row.data as string); } catch { d = {}; }
  } else {
    d = (row.data || {}) as Record<string, unknown>;
  }

  const header = (d.header as Record<string, unknown>) || {};

  const clienteNombre = [
    row.cliente_nombre,
    row.cliente_ap_paterno,
    row.cliente_ap_materno,
  ].filter(Boolean).join(' ') || (header.cliente as string) || '(sin nombre)';

  // montoTransaccion is the first payment amount — never fall back to solicitud_monto (total)
  const rawMonto = parseMoney(header.montoTransaccion);
  const montoStr = rawMonto > 0 ? rawMonto.toFixed(2) : '';
  console.log('[DIAG mapRowToListItem] header.montoTransaccion:', header.montoTransaccion, '-> rawMonto:', rawMonto, '-> montoStr:', montoStr);

  return {
    id:              row.id,
    solicitudId:     row.solicitud_id || '',
    cliente:         clienteNombre,
    numeroDocumento: row.cliente_curp || (header.numeroDocumento as string) || '',
    tipo:            lineaProdToTipo(row.solicitud_linea_produc) || row.type || row.solicitud_type || '',
    fechaSolicitud:  parseISOToDisplay(row.created_at || ''),
    estatus:         row.estatus || 'Pendiente',
    montoTransaccion: montoStr,
    moneda:          String(header.moneda || row.solicitud_moneda || 'MXN'),
    _dbId:    row.id,
    _fromDB:  true,
    _raw:     { ...row, data: d } as Record<string, unknown>,
  };
}

function mapBaseRowToListItem(row: SolicitudActivacionBaseRow): SolicitudActivacionListItem {
  let d: Record<string, unknown> = {};
  if (typeof row.data === 'string') {
    try { d = JSON.parse(row.data as string); } catch { d = {}; }
  } else {
    d = (row.data || {}) as Record<string, unknown>;
  }
  const header = (d.header as Record<string, unknown>) || {};

  const rawMonto = parseMoney(header.montoTransaccion);
  const montoStr = rawMonto > 0 ? rawMonto.toFixed(2) : '';

  return {
    id:              row.id,
    solicitudId:     row.solicitud_id || '',
    cliente:         (header.cliente as string) || '(sin nombre)',
    numeroDocumento: (header.numeroDocumento as string) || '',
    tipo:            row.type || '',
    fechaSolicitud:  parseISOToDisplay(row.created_at || ''),
    estatus:         row.estatus || 'Pendiente',
    montoTransaccion: montoStr,
    moneda:          String(header.moneda || 'MXN'),
    _dbId:   row.id,
    _fromDB: true,
    _raw:    { ...row, data: d } as Record<string, unknown>,
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORM → DB PAYLOAD
// ═══════════════════════════════════════════════════════════════════

// UUID helper — ensures only valid UUIDs reach the DB cast; anything else → null
const UUID_RE_DB = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toUUID(v: string | null | undefined): string | null {
  return v && UUID_RE_DB.test(v) ? v : null;
}

function formToDBPayload(form: SolicitudActivacionFormData) {
  const payload = {
    cliente_id:       toUUID(form.clienteId),
    solicitud_id:     toUUID(form.solicitudId),
    type:             form.type        || null,
    // created_at is auto-set by the DB — never sent in the payload
    fecha_compromiso: form.fechaCompromiso ? parseDisplayToISO(form.fechaCompromiso) : null,
    estatus:          form.estatus || 'Pendiente',
    data: {
      estatus:  form.estatus || 'Pendiente',
      header: {
        cliente:               form.cliente,
        numeroDocumento:       form.numeroDocumento,
        cuentaBancaria:        form.cuentaBancaria,
        formaDePago:           form.formaDePago,
        institucionFinanciera: form.institucionFinanciera,
        referencia:            form.referencia,
        montoTransaccion:      form.montoTransaccion,
        moneda:                form.moneda,
        nota:                  form.nota,
        usuarioNota:           form.usuarioNota,
      },
      detail: {
        tipoProducto:  'CAPITAL',
        claveProducto: form.detailClaveProducto,
        cantidad:      form.detailCantidad,
        monto:         form.detailMonto,
        pctImpuesto:   form.detailPctImpuesto,
        moneda:        form.detailMoneda,
        subTotal:     form.detailSubTotal,
        estatus:      form.detailEstatus,
      },
    },
  };
  
  console.log('[DIAG formToDBPayload] form.estatus:', form.estatus, '| payload.estatus:', payload.estatus);
  return payload;
}

// ═══════════════════════════════════════════════════════════════════
// BACKEND STATUS
// ═══════════════════════════════════════════════════════════════════

export type BackendStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'local-only';

// ═══════════════════════════════════════════════════════════════════
// STRATEGY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

async function tryRPC(): Promise<{ ok: boolean; items: SolicitudActivacionListItem[]; method: string; error?: string }> {
  try {
    console.log('[useSolicitudesActivacionDB] INTENTO 1: supabase.rpc("get_solicitudes_activacion")');
    const { data, error } = await supabase.rpc('get_solicitudes_activacion');

    if (error) {
      console.log('[useSolicitudesActivacionDB] INTENTO 1 FALLÓ:', error.message);
      return { ok: false, items: [], method: 'rpc', error: error.message };
    }

    const rows = (data || []) as SolicitudActivacionDBRow[];
    const items = rows.map(mapRowToListItem);
    console.log(`[useSolicitudesActivacionDB] INTENTO 1 ÉXITO: ${items.length} registros via RPC`);
    return { ok: true, items, method: 'rpc-get_solicitudes_activacion' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('[useSolicitudesActivacionDB] INTENTO 1 EXCEPCIÓN:', msg);
    return { ok: false, items: [], method: 'rpc', error: msg };
  }
}

async function trySchemaSelect(): Promise<{ ok: boolean; items: SolicitudActivacionListItem[]; method: string; error?: string }> {
  try {
    console.log('[useSolicitudesActivacionDB] INTENTO 2: supabase.schema("EFINANCIANET_DB").from("J_SOLICITUDES_ACTIVACION").select("*")');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .schema('EFINANCIANET_DB')
      .from('J_SOLICITUDES_ACTIVACION')
      .select('id, cliente_id, solicitud_id, type, created_at, fecha_compromiso, estatus, data')
      .order('fecha_solicitud', { ascending: false });

    if (error) {
      console.log('[useSolicitudesActivacionDB] INTENTO 2 FALLÓ:', error.message);
      return { ok: false, items: [], method: 'direct-schema', error: error.message };
    }

    const rows = (data || []) as SolicitudActivacionBaseRow[];
    const items = rows.map(mapBaseRowToListItem);
    console.log(`[useSolicitudesActivacionDB] INTENTO 2 ÉXITO: ${items.length} registros via schema directo (sin JOINs)`);
    return { ok: true, items, method: 'supabase-direct-schema' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('[useSolicitudesActivacionDB] INTENTO 2 EXCEPCIÓN:', msg);
    return { ok: false, items: [], method: 'direct-schema', error: msg };
  }
}

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════

export function useSolicitudesActivacionDB(enabled: boolean) {
  const [solicitudesActivacion, setSolicitudesActivacion] = useState<SolicitudActivacionListItem[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [warning,       setWarning]       = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('idle');
  const [fetchMethod,   setFetchMethod]   = useState<string>('');
  const [dbRowCount,    setDbRowCount]    = useState<number>(0);

  // ─── FETCH ────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    setBackendStatus('loading');

    try {
      // Strategy 1: RPC with JOINs
      const rpcResult = await tryRPC();
      if (rpcResult.ok) {
        setSolicitudesActivacion(rpcResult.items);
        setDbRowCount(rpcResult.items.length);
        setFetchMethod(rpcResult.method);
        setBackendStatus(rpcResult.items.length > 0 ? 'ready' : 'empty');
        try { sessionStorage.setItem(SS_KEY, JSON.stringify(rpcResult.items)); } catch { /* */ }
        return;
      }

      // Strategy 2: Schema direct (no JOINs — client name from data.header only)
      const directResult = await trySchemaSelect();
      if (directResult.ok) {
        setSolicitudesActivacion(directResult.items);
        setDbRowCount(directResult.items.length);
        setFetchMethod(directResult.method);
        setBackendStatus(directResult.items.length > 0 ? 'ready' : 'empty');
        setWarning('Datos sin JOINs — ejecuta la migración SQL para ver nombres de cliente');
        try { sessionStorage.setItem(SS_KEY, JSON.stringify(directResult.items)); } catch { /* */ }
        return;
      }

      // Both failed
      throw new Error(rpcResult.error || directResult.error || 'No se pudo conectar a la base de datos');

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al obtener datos';
      console.warn('[useSolicitudesActivacionDB] fetch error:', msg);
      setError(msg);
      setBackendStatus('error');
      setFetchMethod('session');

      // Strategy 3: sessionStorage
      try {
        const cached = sessionStorage.getItem(SS_KEY);
        if (cached) {
          const items = JSON.parse(cached) as SolicitudActivacionListItem[];
          setSolicitudesActivacion(items);
          setWarning('Datos desde caché local (sin conexión a BD)');
          setBackendStatus('local-only');
        } else {
          setSolicitudesActivacion([]);
          setBackendStatus('empty');
        }
      } catch { setSolicitudesActivacion([]); }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) refetch();
  }, [enabled, refetch]);

  // ─── SAVE (INSERT / UPDATE) ────────────────────────────────────────
  const saveSolicitudActivacion = useCallback(
    async (
      form: SolicitudActivacionFormData,
      dbId: string | undefined,
    ): Promise<{ ok: boolean; id?: string; error?: string }> => {
      setSaving(true);
      const payload = formToDBPayload(form);
      const isNew   = !dbId;

      console.log('[PROMPT_IA][saveSolicitudActivacion] iniciando:', {
        isNew,
        dbId,
        solicitud_id: payload.solicitud_id,
        estatus: payload.estatus,
        cliente_id: payload.cliente_id,
      });

      // Columnas directas para el fallback schema (excluye undefined y campos auto-generados)
      const directCols = {
        cliente_id:       payload.cliente_id       ?? null,
        solicitud_id:     payload.solicitud_id      ?? null,
        type:             payload.type              ?? null,
        fecha_compromiso: payload.fecha_compromiso  ?? null,
        estatus:          payload.estatus           || 'Pendiente',
        data:             payload.data              ?? null,
      };

      try {
        if (isNew) {
          // ── Intento 1: RPC insert_solicitud_activacion ──────────────────
          let savedId = '';
          try {
            const { data: rpcData, error: rpcErr } = await supabase.rpc('insert_solicitud_activacion', {
              p_payload: payload,
            });
            console.log('[PROMPT_IA][saveSolicitudActivacion] INSERT RPC result:', { rpcData, rpcErr });
            if (!rpcErr) {
              savedId = (rpcData as { id?: string }[])?.[0]?.id
                ?? (rpcData as { id?: string } | null)?.id
                ?? (typeof rpcData === 'string' ? rpcData : '');
            } else {
              throw new Error(rpcErr.message);
            }
          } catch (rpcEx: unknown) {
            // ── Fallback: Supabase schema directo ──────────────────────────
            console.warn('[PROMPT_IA][saveSolicitudActivacion] INSERT RPC falló, intentando schema directo:', (rpcEx as Error).message);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: directData, error: directErr } = await (supabase as any)
              .schema('EFINANCIANET_DB')
              .from('J_SOLICITUDES_ACTIVACION')
              .insert([directCols])
              .select('id')
              .single();
            console.log('[PROMPT_IA][saveSolicitudActivacion] INSERT schema directo:', { directData, directErr });
            if (directErr) throw new Error(directErr.message);
            savedId = (directData as { id?: string })?.id ?? '';
          }

          console.log('[PROMPT_IA][saveSolicitudActivacion] INSERT savedId:', savedId);
          await refetch();
          return { ok: true, id: savedId };

        } else {
          // ── Validar que dbId sea UUID antes de llamar al RPC ─────────────
          if (!dbId || !UUID_RE_DB.test(dbId)) {
            console.error('[PROMPT_IA][saveSolicitudActivacion] dbId no es UUID, no se puede actualizar:', dbId);
            return { ok: false, error: `ID de registro inválido (${dbId}) — no se puede actualizar` };
          }

          // ── Intento 1: RPC update_solicitud_activacion ──────────────────
          try {
            const { data: updData, error: updErr } = await supabase.rpc('update_solicitud_activacion', {
              p_id:      dbId,
              p_payload: payload,
            });
            console.log('[DIAG UPDATE] RPC call result:', { data: updData, error: updErr });
            console.log('[DIAG UPDATE] payload sent to RPC:', JSON.stringify(payload));
            if (updErr) throw new Error(updErr.message);
          } catch (rpcEx: unknown) {
            // ── Fallback: Supabase schema directo ──────────────────────────
            console.warn('[DIAG UPDATE] RPC falló, intentando schema directo:', (rpcEx as Error).message);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: directErr } = await (supabase as any)
              .schema('EFINANCIANET_DB')
              .from('J_SOLICITUDES_ACTIVACION')
              .update({ estatus: directCols.estatus, fecha_compromiso: directCols.fecha_compromiso, data: directCols.data })
              .eq('id', dbId);
            console.log('[DIAG UPDATE] schema directo result:', { error: directErr, dbId, estatus: directCols.estatus });
            if (directErr) throw new Error(directErr.message);
          }

          await refetch();
          return { ok: true, id: dbId };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al guardar';
        console.error('[PROMPT_IA][saveSolicitudActivacion] TODOS LOS INTENTOS FALLARON:', msg, {
          isNew, dbId, solicitud_id: payload.solicitud_id, estatus: payload.estatus,
        });
        return { ok: false, error: msg };
      } finally {
        setSaving(false);
      }
    },
    [refetch],
  );

  return {
    solicitudesActivacion,
    loading,
    saving,
    error,
    warning,
    backendStatus,
    fetchMethod,
    dbRowCount,
    refetch,
    saveSolicitudActivacion,
  };
}
