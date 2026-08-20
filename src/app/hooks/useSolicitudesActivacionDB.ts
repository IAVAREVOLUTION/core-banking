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
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';
import { publicAnonKey } from '/utils/supabase/info';

const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-7e2d13d9`;
import type {
  SolicitudActivacionListItem,
  SolicitudActivacionFormData,
} from '../components/solicitudes-activacion/solicitudActivacionStore';
import { INSTITUCION_RAZON_SOCIAL, IVA_FACTURA } from '../components/solicitudes/solicitudCreditoStore';

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

/** Únicos tipos de cuenta válidos en Solicitud de Activación. */
export const TIPOS_CUENTA = ['Por Cobrar', 'Por Pagar'];

/** Maps J_CUENTAS_CORP_CLIENTES.linea_produc → TIPO display value */
export function lineaProdToTipo(linea: string | null | undefined): string {
  if (!linea) return '';
  const normalized = linea.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'captacion') return 'Por Cobrar';
  if (normalized === 'credito')   return 'Por Pagar';
  return '';
}

/**
 * Crea una Solicitud de Activación "Por Pagar" para la cuenta al proveedor
 * del bien en Arrendamiento Puro (Fase 5 — Recepción del Activo).
 *
 * El proveedor no es un cliente del banco (no tiene fila en J_CLIENTES), por
 * lo que cliente_id queda null — el nombre/RFC del proveedor se guarda como
 * texto libre en data.header, igual que ya hace crearFacturaArrendamientoCobranza
 * con la columna `cliente` de J_FACTURAS. No usa el hook de React para poder
 * invocarse desde un handler fuera de un componente montado con este hook.
 */
export async function crearFacturaProveedorActivacion(params: {
  solicitudId: string;
  /** UUID del proveedor en J_CLIENTES (type='Proveedor') — cliente_id es NOT NULL. */
  proveedorId: string;
  proveedor: string;
  rfcProveedor: string;
  /** Monto autorizado — importe total de la factura, IVA incluido. */
  monto: number;
  moneda?: string;
  referencia?: string;
  fechaCompromiso?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { solicitudId, proveedorId, proveedor, rfcProveedor, monto, moneda = 'MXN', referencia, fechaCompromiso } = params;

  // El Detail desglosa la operación en dos líneas a partir del importe TOTAL
  // (el monto autorizado) y la tasa de IVA:
  //   Capital = monto × (1 − IVA)   ·   IVA = monto × IVA
  // Por eso aquí se guarda el total y la tasa, no el importe ya neteado.
  const pctImpuesto = IVA_FACTURA;

  const form: SolicitudActivacionFormData = {
    id: '',
    solicitudId,
    // El proveedor ES el cliente de esta cuenta por pagar: vive en J_CLIENTES
    // con type='Proveedor' (GarantiaForm lo selecciona desde ahí), así que su
    // UUID satisface el FK/NOT NULL de cliente_id sin registros ficticios.
    clienteId: proveedorId,
    type: 'Por Pagar',
    fechaSolicitud: '',
    fechaCompromiso: fechaCompromiso || '',
    estatus: 'Pendiente',
    numeroDocumento: rfcProveedor,
    cliente: proveedor,
    cuentaBancaria: '',
    formaDePago: 'Banca por internet',
    // Quien paga al proveedor es la institución.
    institucionFinanciera: INSTITUCION_RAZON_SOCIAL,
    referencia: referencia || '',
    montoTransaccion: monto.toFixed(2),
    moneda,
    nota: 'Cuenta por pagar al proveedor del bien — generada desde Originación (Fase 5).',
    usuarioNota: 'Sistema',
    detailClaveProducto: 'ARRENDAMIENTO_PROVEEDOR',
    detailCantidad: 1,
    detailMonto: monto,
    detailPctImpuesto: pctImpuesto,
    detailMoneda: moneda,
    detailSubTotal: monto,
    detailEstatus: 'Pendiente',
  };

  const payload = formToDBPayload(form);

  // Vía Edge Function (cliente con permisos de servidor) — el rol público no
  // tiene GRANT sobre J_SOLICITUDES_ACTIVACION, así que un INSERT directo vía
  // supabase.schema(...) falla con "permission denied". Mismo patrón que el
  // PUT existente (putSolicitudActivacionHandler).
  try {
    const res = await fetch(`${API_BASE}/solicitudes-activacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true, id: json.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Mapa `id → estatus` de TODAS las solicitudes de activación, en una sola
 * consulta.
 *
 * Para vistas que reconcilian muchos registros de golpe (Cartera de
 * Arrendamiento lista todos los contratos) en vez de pedir uno por factura.
 * Devuelve mapa vacío ante cualquier fallo: quien lo use debe conservar el
 * estatus guardado, no asumir 'Pendiente'.
 */
export async function fetchEstatusActivacionMap(): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  try {
    const { data, error } = await supabase.rpc('get_solicitudes_activacion');
    if (error || !data) return mapa;
    for (const r of data as Record<string, any>[]) {
      if (r?.id) mapa.set(String(r.id), String(r.estatus || ''));
    }
  } catch { /* sin conexión se conserva el estatus guardado */ }
  return mapa;
}

/**
 * Lee el estatus real de una Solicitud de Activación por id.
 *
 * La Fase 6 de Arrendamiento Puro no puede confiar en la copia local de la
 * factura del proveedor: el pago se aplica desde el módulo Solicitud de
 * Activación y ese cambio no vuelve solo a la solicitud de crédito.
 */
export async function fetchEstatusSolicitudActivacion(
  id: string,
): Promise<{ ok: boolean; estatus?: string; noDocto?: string; monto?: number; error?: string }> {
  const mapear = (row: Record<string, any>) => {
    const header = (row.data?.header || {}) as Record<string, unknown>;
    return {
      ok: true as const,
      estatus: row.estatus as string,
      noDocto: String(header.referencia || ''),
      monto: Number.parseFloat(String(header.montoTransaccion || '0').replace(/[$,\s]/g, '')) || 0,
    };
  };

  // Intento 1: RPC con JOINs — es la vía que ya usa el listado del módulo y la
  // única con permisos para el rol público (el SELECT directo al schema y el
  // INSERT están denegados por RLS sobre J_SOLICITUDES_ACTIVACION).
  try {
    const { data, error } = await supabase.rpc('get_solicitudes_activacion');
    if (!error) {
      const row = (data as Record<string, any>[] | null || []).find(r => String(r.id) === String(id));
      if (!row) return { ok: false, error: 'La solicitud de activación ya no existe' };
      return mapear(row);
    }
  } catch { /* cae al intento 2 */ }

  // Intento 2: schema directo — sólo funciona donde el rol sí tenga SELECT.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .schema('EFINANCIANET_DB')
      .from('J_SOLICITUDES_ACTIVACION')
      .select('id, estatus, data')
      .eq('id', id)
      .single();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'La solicitud de activación ya no existe' };
    return mapear(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
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
    // La columna `type` manda cuando ya trae un tipo de cuenta explícito
    // ('Por Cobrar'/'Por Pagar'). lineaProdToTipo sólo es un derivado para
    // registros legacy que no lo tienen guardado — si se evalúa primero, pisa
    // el tipo real (ej. la cuenta por pagar al proveedor de Arrendamiento).
    tipo:            (TIPOS_CUENTA.includes(String(row.type)) ? row.type : '')
                     || lineaProdToTipo(row.solicitud_linea_produc)
                     || row.type || row.solicitud_type || '',
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
      estatus:  form.estatus || null,
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
      .order('created_at', { ascending: false });

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
        estatus:          payload.estatus           || null,
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

          // ── Intento 1: Edge Function PUT /solicitudes-activacion/:id ──────
          let edgeFnOk = false;
          try {
            const efRes = await fetch(`${API_BASE}/solicitudes-activacion/${dbId}`, {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                estatus:          payload.estatus,
                fecha_compromiso: payload.fecha_compromiso,
                type:             payload.type,
                data:             payload.data,
              }),
            });
            if (efRes.ok) {
              console.log('[DIAG UPDATE] Edge Function OK — estatus:', payload.estatus);
              edgeFnOk = true;
            } else {
              console.warn('[DIAG UPDATE] Edge Function status:', efRes.status);
            }
          } catch (efEx: unknown) {
            console.warn('[DIAG UPDATE] Edge Function excepción:', (efEx as Error).message);
          }

          if (!edgeFnOk) {
            // ── Intento 2: RPC update_solicitud_activacion ────────────────
            try {
              const { data: updData, error: updErr } = await supabase.rpc('update_solicitud_activacion', {
                p_id:      dbId,
                p_payload: payload,
              });
              console.log('[DIAG UPDATE] RPC result:', { data: updData, error: updErr, estatus: payload.estatus });
              if (updErr) throw new Error(updErr.message);
            } catch (rpcEx: unknown) {
              // ── Intento 3: Supabase schema directo ──────────────────────
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
          }

          // Patch session immediately so refetch fallback uses fresh estatus
          try {
            const cached = sessionStorage.getItem(SS_KEY);
            if (cached) {
              const items = JSON.parse(cached);
              const idx = items.findIndex((i: Record<string, unknown>) => i._dbId === dbId || i.id === dbId);
              if (idx >= 0) {
                items[idx] = { ...items[idx], estatus: payload.estatus };
                sessionStorage.setItem(SS_KEY, JSON.stringify(items));
              }
            }
          } catch { /* ignore */ }

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
