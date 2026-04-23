/**
 * useCuentasAhorroDB.ts — v3.0 (RPC-FIRST + INSERT + UPDATE)
 *
 * ═══════════════════════════════════════════════════════════════════
 * Módulo Cuentas de Ahorro → Lista + Alta + Edición
 * Tabla: EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES"
 * Filtro: linea_produc = 'CAPTACION' AND tipo_produc = 'Ahorro'
 *
 * ⚠️  El schema EFINANCIANET_DB NO está expuesto en PostgREST
 *     (PGRST106). Todas las operaciones usan RPCs en public schema.
 *
 * ESTRATEGIA LECTURA:
 *   1. Supabase RPC — supabase.rpc('get_cuentas_ahorro')
 *   2. Edge Function — /cuentas-ahorro
 *   3. sessionStorage fallback
 *
 * ESTRATEGIA GET BY ID:
 *   1. Supabase RPC — supabase.rpc('get_cuenta_ahorro_by_id', {p_id})
 *   2. sessionStorage fallback (buscar en lista local)
 *
 * ESTRATEGIA INSERT:
 *   1. Edge Function POST /cuentas-ahorro (direct SQL — bypasses RPC overload ambiguity)
 *   2. RPC insert_cuenta_ahorro (puede fallar con PGRST106 si hay overloads ambiguos)
 *   3. sessionStorage fallback
 *
 * ESTRATEGIA UPDATE:
 *   1. Supabase RPC — supabase.rpc('update_cuenta_ahorro', {...})
 *   2. Edge Function fallback
 *   3. sessionStorage fallback
 * ═══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';
import { publicAnonKey } from '/utils/supabase/info';

// ═══════════════════════════════════════════════════════════════════
// ⚠️  CAMBIAR A true DESPUÉS DE CREAR LA RPC EN SUPABASE
// ═══════════════════════════════════════════════════════════════════
const DB_AVAILABLE = true;

const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-7e2d13d9`;
const SS_KEY = 'cuentas_ahorro_local';
const SS_KEY_ROWS = 'cuentas_ahorro_rows'; // filas completas JCuentaAhorroRow
const LOG = '[CuentasAhorroDB]';

// ═══════════════════════════════════════════════════════════════════
// HELPER: Parsear valores MONEY de PostgreSQL
// PostgreSQL MONEY devuelve strings como "$1,400.00" o "($.50)"
// ═══════════════════════════════════════════════════════════════════
function parseMoney(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove currency symbols, commas, parentheses (negative in accounting)
    const cleaned = val.replace(/[$,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════

/** Fila tal como viene de la DB / RPC */
export interface JCuentaAhorroRow {
  id: string;
  type: string | null;
  no_sol: string | null;
  no_cuenta: string | null;
  no_referenc1: string | null;
  fecha_sol: string | null;
  fecha_autori: string | null;
  fecha_disper: string | null;
  fecha_cancel: string | null;
  fecha_inicio: string | null;
  fecha_fin_cu: string | null;
  descripcion: string | null;
  linea_produc: string | null;
  tipo_produc: string | null;
  producto_id: string | null;
  producto_eje: string | null;
  cliente_id: string | null;
  saldo_actual: number | null;
  monto_sol: number | null;
  monto_aut: number | null;
  monto_disp: number | null;
  estatus_disp: string | null;
  estatus_sol: string | null;
  estatus_cart: string | null;
  estatus_cuen: string | null;
  cta_eje_chec: string | boolean | null;
  fases: string | null;
  data: Record<string, unknown> | null;
  // Campos resueltos por la RPC (JOIN con J_CLIENTES / J_PRODUCTOS)
  cliente_nombre?: string | null;
  producto_nombre?: string | null;
}

/** Vista simplificada para la UI */
export interface CuentaAhorroListItem {
  id: string;
  noSol: string;
  noCuenta: string;
  clienteId: string;
  clienteNombre: string;
  productoId: string;
  productoNombre: string;
  fechaSol: string;
  fechaAutori: string;
  saldoActual: number;
  montoAut: number;
  estatusCuen: string;
  estatusCart: string;
  estatusSol: string;
  estatusDisp: string;
  ctaEjeChec: boolean;
  // Campos ocultos preservados
  lineaProduc: string;
  tipoProduc: string;
  data: Record<string, unknown> | null;
}

export type CuentaAhorroBackendStatus = 'connected' | 'pending-deploy' | 'local-only';

/** Flag que indica si el último INSERT se persistió realmente en BD */
export type InsertResult = { ok: boolean; data?: JCuentaAhorroRow; error?: string; persisted: boolean };

// ═══════════════════════════════════════════════════════════════════
// PAYLOAD INSERT (lo que recibe la RPC)
// ═══════════════════════════════════════════════════════════════════
export interface InsertCuentaAhorroPayload {
  p_no_sol: string;
  p_no_cuenta: string;
  p_no_referenc1?: string | null;
  p_fecha_sol: string;
  p_fecha_autori?: string | null;
  p_fecha_disper?: string | null;
  p_fecha_cancel?: string | null;
  p_fecha_inicio?: string | null;
  p_fecha_fin_cu?: string | null;
  p_descripcion?: string | null;
  p_linea_produc?: string | null;
  p_tipo_produc?: string | null;
  p_producto_id?: string | null;
  p_producto_eje?: string | null;
  p_cliente_id?: string | null;
  p_monto_sol?: number | null;
  p_monto_aut?: number | null;
  p_monto_disp?: number | null;
  p_cta_eje_chec?: string | boolean | null;
  p_fases?: string | null;
  p_data?: Record<string, unknown> | null;
}

// ═══════════════════════════════════════════════════════════════════
// PAYLOAD UPDATE (lo que recibe la RPC update_cuenta_ahorro)
// ═══════════════════════════════════════════════════════════════════
export interface UpdateCuentaAhorroPayload {
  p_id: string;
  p_no_sol: string;
  p_no_cuenta: string;
  p_no_referenc1?: string | null;
  p_fecha_sol?: string | null;
  p_fecha_autori?: string | null;
  p_fecha_disper?: string | null;
  p_fecha_cancel?: string | null;
  p_fecha_inicio?: string | null;
  p_fecha_fin_cu?: string | null;
  p_descripcion?: string | null;
  p_producto_id?: string | null;
  p_producto_eje?: string | null;
  p_cliente_id?: string | null;
  p_saldo_actual?: number | null;
  p_monto_sol?: number | null;
  p_monto_aut?: number | null;
  p_monto_disp?: number | null;
  p_estatus_disp?: string | null;
  p_estatus_sol?: string | null;
  p_estatus_cart?: string | null;
  p_estatus_cuen?: string | null;
  p_cta_eje_chec?: string | boolean | null;
  p_fases?: string | null;
  p_data_partial?: Record<string, unknown> | null;
}

// ═══════════════════════════════════════════════════════════════════
// MAPEO ROW → ListItem
// ═══════════════════════════════════════════════════════════════════
function mapRow(row: JCuentaAhorroRow): CuentaAhorroListItem {
  return {
    id: row.id,
    noSol: row.no_sol || '',
    noCuenta: row.no_cuenta || '',
    clienteId: row.cliente_id || '',
    clienteNombre: row.cliente_nombre || row.cliente_id || '—',
    productoId: row.producto_id || '',
    productoNombre: row.producto_nombre || row.producto_id || '—',
    fechaSol: row.fecha_sol || '',
    fechaAutori: row.fecha_autori || '',
    saldoActual: parseMoney(row.saldo_actual) ?? 0,
    montoAut: parseMoney(row.monto_aut) ?? 0,
    estatusCuen: row.estatus_cuen || '—',
    estatusCart: row.estatus_cart || '—',
    estatusSol: row.estatus_sol || '—',
    estatusDisp: row.estatus_disp || '—',
    ctaEjeChec: row.cta_eje_chec === true || row.cta_eje_chec === 'true' || row.cta_eje_chec === 't',
    lineaProduc: row.linea_produc || '',
    tipoProduc: row.tipo_produc || '',
    data: row.data,
  };
}

// ═══════════════════════════════════════════════════════════════════
// sessionStorage helpers
// ═══════════════════════════════════════════════════════════════════
function loadLocal(): CuentaAhorroListItem[] {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocal(items: CuentaAhorroListItem[]): void {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(items));
  } catch { /* silently fail */ }
}

/** Guardar fila completa (para que getCuentaAhorroById no pierda campos) */
function saveFullRow(row: JCuentaAhorroRow): void {
  try {
    const all = loadFullRows();
    const idx = all.findIndex(r => r.id === row.id);
    if (idx >= 0) all[idx] = row; else all.push(row);
    sessionStorage.setItem(SS_KEY_ROWS, JSON.stringify(all));
  } catch { /* silently fail */ }
}

function saveFullRows(rows: JCuentaAhorroRow[]): void {
  try {
    sessionStorage.setItem(SS_KEY_ROWS, JSON.stringify(rows));
  } catch { /* silently fail */ }
}

function loadFullRows(): JCuentaAhorroRow[] {
  try {
    const raw = sessionStorage.getItem(SS_KEY_ROWS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function loadFullRowById(id: string): JCuentaAhorroRow | null {
  const rows = loadFullRows();
  return rows.find(r => r.id === id) || null;
}

/**
 * Mergea cuentas obtenidas de BD con cuentas locales (sessionStorage)
 * que aún no existen en la BD (e.g. cuenta eje recién creada por activación).
 * Evita duplicados por ID.
 */
function mergeWithLocalEntries(dbItems: CuentaAhorroListItem[]): CuentaAhorroListItem[] {
  const localItems = loadLocal();
  if (localItems.length === 0) return dbItems;

  const dbIds = new Set(dbItems.map(c => c.id));
  const localOnly = localItems.filter(c => !dbIds.has(c.id));

  if (localOnly.length > 0) {
    console.log(`${LOG} mergeWithLocalEntries: ${localOnly.length} cuentas locales NO están en BD — mergeando`);
    localOnly.forEach(c => console.log(`${LOG}   → local-only: id=${c.id.slice(0, 8)} noCuenta=${c.noCuenta} ctaEje=${c.ctaEjeChec}`));
    return [...dbItems, ...localOnly];
  }

  return dbItems;
}

/** Evento custom para forzar refetch desde otros hooks/componentes */
export const CUENTA_AHORRO_REFETCH_EVENT = 'cuentaAhorroRefetch';

// ═══════════════════════════════════════════════════════════════════
// REGISTRAR MOVIMIENTO en Cuenta Eje — función standalone
// ═══════════════════════════════════════════════════════════════════
export async function registrarMovimientoCuentaEje(
  clienteId: string,
  movimiento: Record<string, unknown>,
  saldoNuevo: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/cuentas-ahorro/movimiento`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cliente_id: clienteId, movimiento, saldo_nuevo: saldoNuevo }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`${LOG} registrarMovimientoCuentaEje ERROR HTTP ${res.status}:`, err?.error);
      return { ok: false, error: err?.error || `HTTP ${res.status}` };
    }
    console.log(`${LOG} registrarMovimientoCuentaEje OK — clienteId=${clienteId} saldo=${saldoNuevo}`);
    return { ok: true };
  } catch (e: any) {
    console.warn(`${LOG} registrarMovimientoCuentaEje EXCEPCIÓN:`, e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// GET BY ID — función standalone (no hook) para evitar cambios de hook order
// ═══════════════════════════════════════════════════════════════════
export async function getCuentaAhorroById(id: string): Promise<{ ok: boolean; row?: JCuentaAhorroRow; error?: string }> {
  console.log(`${LOG} getCuentaAhorroById — id: ${id}`);

  if (!DB_AVAILABLE) {
    // Buscar fila completa primero
    const fullRow = loadFullRowById(id);
    if (fullRow) {
      console.log(`${LOG} getCuentaAhorroById — encontrado en sessionStorage (fila completa)`);
      return { ok: true, row: fullRow };
    }
    return { ok: false, error: 'Registro no encontrado en sessionStorage' };
  }

  // Intento 1: RPC
  try {
    console.log(`${LOG} getCuentaAhorroById Intento 1 → supabase.rpc('get_cuenta_ahorro_by_id')`);
    const { data, error } = await supabase.rpc('get_cuenta_ahorro_by_id', { p_id: id });

    if (!error && data) {
      const rows = Array.isArray(data) ? data : [data];
      if (rows.length > 0) {
        const row = rows[0] as JCuentaAhorroRow;
        console.log(`${LOG} getCuentaAhorroById RPC OK`);
        saveFullRow(row); // persistir fila completa
        return { ok: true, row };
      }
    }
    if (error) {
      console.log(`${LOG} getCuentaAhorroById RPC no disponible: ${error.message}`);
    }
  } catch (e: any) {
    console.log(`${LOG} getCuentaAhorroById RPC no disponible: ${e?.message || e}`);
  }

  // Intento 2: Edge Function
  try {
    console.log(`${LOG} getCuentaAhorroById Intento 2 → Edge Function GET /cuentas-ahorro?id=${id}`);
    const res = await fetch(`${API_BASE}/cuentas-ahorro?id=${id}`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      const json = await res.json();
      // Edge Function returns a single object when ?id= is provided, or array when listing all
      let matchedRow: JCuentaAhorroRow | null = null;

      if (json && !Array.isArray(json) && json.id) {
        // Single object response (GET by id)
        matchedRow = json as JCuentaAhorroRow;
      } else {
        // Array response — filter by ID as defense
        const rows = Array.isArray(json) ? json : json.data ? (Array.isArray(json.data) ? json.data : [json.data]) : [];
        matchedRow = rows.find((r: any) => r.id === id) || null;
      }

      if (matchedRow) {
        console.log(`${LOG} getCuentaAhorroById Edge Function OK — id: ${matchedRow.id}, no_cuenta: ${matchedRow.no_cuenta}`);
        saveFullRow(matchedRow);
        return { ok: true, row: matchedRow };
      }
      console.log(`${LOG} getCuentaAhorroById Edge Function — registro no encontrado en respuesta`);
    } else if (res.status === 404) {
      console.log(`${LOG} getCuentaAhorroById Edge Function — 404 (registro no existe en BD)`);
    } else {
      const errText = await res.text().catch(() => '');
      console.log(`${LOG} getCuentaAhorroById Edge Function status: ${res.status}`, errText);
    }
  } catch (e: any) {
    console.log(`${LOG} getCuentaAhorroById Edge Function no disponible: ${e?.message || e}`);
  }

  // Intento 3: sessionStorage — fila completa
  const fullRow = loadFullRowById(id);
  if (fullRow) {
    console.log(`${LOG} getCuentaAhorroById → sessionStorage fila completa`);
    return { ok: true, row: fullRow };
  }

  return { ok: false, error: 'Registro no encontrado' };
}

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════
export function useCuentasAhorroDB() {
  const [cuentas, setCuentas] = useState<CuentaAhorroListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState<CuentaAhorroBackendStatus>('local-only');
  const fetchedRef = useRef(false);

  // ── Fetch All ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    console.log(`${LOG} fetchAll — iniciando`);

    if (!DB_AVAILABLE) {
      console.log(`${LOG} DB_AVAILABLE=false → cargando desde sessionStorage`);
      setCuentas(loadLocal());
      setBackendStatus('local-only');
      setLoading(false);
      return;
    }

    // ── Intento 1: RPC ──
    try {
      console.log(`${LOG} Intento 1 → supabase.rpc('get_cuentas_ahorro')`);
      const { data, error } = await supabase.rpc('get_cuentas_ahorro');

      if (!error && Array.isArray(data)) {
        const mapped = (data as JCuentaAhorroRow[]).map(mapRow);
        console.log(`${LOG} RPC OK — ${mapped.length} registros de BD`);
        setCuentas(mapped);
        saveLocal(mapped);
        saveFullRows(data as JCuentaAhorroRow[]);
        setBackendStatus('connected');
        setLoading(false);
        return;
      }

      console.warn(`${LOG} RPC error:`, error?.message || 'respuesta no-array');
    } catch (e) {
      console.warn(`${LOG} RPC excepción:`, e);
    }

    // ── Intento 2: Edge Function ──
    try {
      console.log(`${LOG} Intento 2 → Edge Function /cuentas-ahorro`);
      const res = await fetch(`${API_BASE}/cuentas-ahorro`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        const rows = Array.isArray(json) ? json : json.data || [];
        const mapped = (rows as JCuentaAhorroRow[]).map(mapRow);
        console.log(`${LOG} Edge Function OK — ${mapped.length} registros de BD`);
        setCuentas(mapped);
        saveLocal(mapped);
        saveFullRows(rows as JCuentaAhorroRow[]);
        setBackendStatus('connected');
        setLoading(false);
        return;
      }
      console.warn(`${LOG} Edge Function status:`, res.status);
    } catch (e) {
      console.warn(`${LOG} Edge Function excepción:`, e);
    }

    // ── Intento 3: sessionStorage fallback ──
    console.log(`${LOG} Fallback → sessionStorage`);
    const local = loadLocal();
    setCuentas(local);
    setBackendStatus('pending-deploy');
    setLoading(false);
  }, []);

  // ── Auto-fetch al montar ──
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  // ── Insert ──
  const insertCuenta = useCallback(async (payload: InsertCuentaAhorroPayload): Promise<InsertResult> => {
    console.log(`${LOG} insertCuenta — iniciando`, payload);

    if (!DB_AVAILABLE) {
      console.log(`${LOG} DB_AVAILABLE=false → guardando solo en sessionStorage`);
      const fakeRow: JCuentaAhorroRow = {
        id: crypto.randomUUID(),
        type: 'CAPTACION',
        no_sol: payload.p_no_sol,
        no_cuenta: payload.p_no_cuenta,
        no_referenc1: payload.p_no_referenc1 || null,
        fecha_sol: payload.p_fecha_sol,
        fecha_autori: payload.p_fecha_autori || null,
        fecha_disper: payload.p_fecha_disper || null,
        fecha_cancel: payload.p_fecha_cancel || null,
        fecha_inicio: payload.p_fecha_inicio || null,
        fecha_fin_cu: payload.p_fecha_fin_cu || null,
        descripcion: payload.p_descripcion || null,
        linea_produc: payload.p_linea_produc || 'CAPTACION',
        tipo_produc: payload.p_tipo_produc || 'Ahorro',
        producto_id: payload.p_producto_id || null,
        producto_eje: payload.p_producto_eje || null,
        cliente_id: payload.p_cliente_id || null,
        saldo_actual: 0,
        monto_sol: payload.p_monto_sol || null,
        monto_aut: payload.p_monto_aut || null,
        monto_disp: payload.p_monto_disp || null,
        estatus_disp: 'Pendiente',
        estatus_sol: 'Pendiente',
        estatus_cart: 'Activa',
        estatus_cuen: 'Activa',
        cta_eje_chec: payload.p_cta_eje_chec || null,
        fases: payload.p_fases || null,
        data: payload.p_data || null,
      };
      saveFullRow(fakeRow);
      const mapped = mapRow(fakeRow);
      setCuentas(prev => {
        const updated = [mapped, ...prev];
        saveLocal(updated);
        return updated;
      });
      return { ok: true, data: fakeRow, persisted: false };
    }

    // ── Intento 1: Edge Function (direct SQL — bypasses PostgREST RPC overload ambiguity) ──
    try {
      console.log(`${LOG} Insert Intento 1 → Edge Function POST /cuentas-ahorro (direct SQL)`);
      // Sanitize payload: empty strings → null for UUID/date/numeric fields to prevent PostgreSQL cast errors
      const sanitizedPayload = { ...payload };
      const UUID_FIELDS: (keyof InsertCuentaAhorroPayload)[] = ['p_producto_id', 'p_cliente_id'];
      for (const f of UUID_FIELDS) {
        if (sanitizedPayload[f] !== undefined && sanitizedPayload[f] !== null) {
          const v = String(sanitizedPayload[f]).trim();
          if (v === '' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
            (sanitizedPayload as any)[f] = null;
            console.log(`${LOG} Sanitized ${f} from '${v}' → null (not a valid UUID)`);
          }
        }
      }
      const DATE_FIELDS_EF: (keyof InsertCuentaAhorroPayload)[] = [
        'p_fecha_sol', 'p_fecha_autori', 'p_fecha_disper', 'p_fecha_cancel', 'p_fecha_inicio', 'p_fecha_fin_cu'
      ];
      for (const f of DATE_FIELDS_EF) {
        const v = sanitizedPayload[f];
        if (v === '') (sanitizedPayload as any)[f] = null;
      }

      const res = await fetch(`${API_BASE}/cuentas-ahorro`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sanitizedPayload),
      });
      if (res.ok) {
        const json = await res.json();
        const row = json as JCuentaAhorroRow;
        console.log(`${LOG} ✅ Insert Edge Function OK — id: ${row?.id}`);
        if (row) saveFullRow(row);
        await fetchAll();
        return { ok: true, data: row, persisted: true };
      }
      const errBody = await res.text().catch(() => '');
      console.warn(`${LOG} Insert Edge Function status: ${res.status}`, errBody);
    } catch (e: any) {
      console.warn(`${LOG} Insert Edge Function no disponible: ${e?.message || e}`);
    }

    // ── Intento 2: RPC insert_cuenta_ahorro (puede fallar con PGRST106 si hay overloads ambiguos) ──
    try {
      console.log(`${LOG} Insert Intento 2 → supabase.rpc('insert_cuenta_ahorro')`);
      // Normalizar fechas a ISO 8601 timestamptz para ayudar a PostgREST a resolver overloads
      const rpcPayload = { ...payload };
      const DATE_FIELDS: (keyof InsertCuentaAhorroPayload)[] = [
        'p_fecha_sol', 'p_fecha_autori', 'p_fecha_disper', 'p_fecha_cancel', 'p_fecha_inicio', 'p_fecha_fin_cu'
      ];
      for (const field of DATE_FIELDS) {
        const val = rpcPayload[field] as string | null | undefined;
        if (val && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
          (rpcPayload as any)[field] = `${val}T00:00:00.000Z`;
        }
      }
      // Normalizar cta_eje_chec a boolean
      if (rpcPayload.p_cta_eje_chec !== undefined && rpcPayload.p_cta_eje_chec !== null) {
        const v = rpcPayload.p_cta_eje_chec;
        (rpcPayload as any).p_cta_eje_chec = v === true || v === 'true' || v === 't' || v === '1';
      }
      // Stringify p_data si es objeto (PostgREST espera text para jsonb en algunos overloads)
      if (rpcPayload.p_data && typeof rpcPayload.p_data === 'object') {
        (rpcPayload as any).p_data = JSON.stringify(rpcPayload.p_data);
      }

      const { data, error } = await supabase.rpc('insert_cuenta_ahorro', rpcPayload as any);

      if (!error && data) {
        const rows = Array.isArray(data) ? data : [data];
        const row = rows[0] as JCuentaAhorroRow;
        console.log(`${LOG} ✅ Insert RPC OK — id: ${row?.id}`);
        if (row) saveFullRow(row);
        await fetchAll();
        return { ok: true, data: row, persisted: true };
      }

      if (error) {
        console.warn(`${LOG} Insert RPC error (PGRST106 esperado si hay overloads): ${error.message}`, error.details, error.hint);
        console.warn(`${LOG} ⚠️ Para corregir: en SQL Editor de Supabase, eliminar overloads extra de insert_cuenta_ahorro dejando solo el de timestamptz, O desplegar la Edge Function v19.3`);
      }
    } catch (e: any) {
      console.warn(`${LOG} Insert RPC excepción: ${e?.message || e}`);
    }

    // ── Intento 3: sessionStorage fallback (siempre funciona) ──
    console.warn(`${LOG} ⚠️⚠️⚠️ INSERT CAYÓ A sessionStorage — LA CUENTA NO SE PERSISTIÓ EN BD ⚠️⚠️⚠️`);
    console.warn(`${LOG} Para que las cuentas se guarden en J_CUENTAS_CORP_CLIENTES, necesitas:`);
    console.warn(`${LOG}   1. Desplegar la Edge Function v19.3 (tiene endpoint POST /cuentas-ahorro con SQL directo)`);
    console.warn(`${LOG}   2. O limpiar overloads de insert_cuenta_ahorro en SQL Editor (dejar solo 1 overload timestamptz)`);
    console.log(`${LOG} Insert → sessionStorage fallback (datos guardados localmente SOLAMENTE)`);
    const fakeRow: JCuentaAhorroRow = {
      id: crypto.randomUUID(),
      type: 'CAPTACION',
      no_sol: payload.p_no_sol,
      no_cuenta: payload.p_no_cuenta,
      no_referenc1: payload.p_no_referenc1 || null,
      fecha_sol: payload.p_fecha_sol,
      fecha_autori: payload.p_fecha_autori || null,
      fecha_disper: payload.p_fecha_disper || null,
      fecha_cancel: payload.p_fecha_cancel || null,
      fecha_inicio: payload.p_fecha_inicio || null,
      fecha_fin_cu: payload.p_fecha_fin_cu || null,
      descripcion: payload.p_descripcion || null,
      linea_produc: payload.p_linea_produc || 'CAPTACION',
      tipo_produc: payload.p_tipo_produc || 'Ahorro',
      producto_id: payload.p_producto_id || null,
      producto_eje: payload.p_producto_eje || null,
      cliente_id: payload.p_cliente_id || null,
      saldo_actual: 0,
      monto_sol: payload.p_monto_sol || null,
      monto_aut: payload.p_monto_aut || null,
      monto_disp: payload.p_monto_disp || null,
      estatus_disp: 'Pendiente',
      estatus_sol: 'Pendiente',
      estatus_cart: 'Activa',
      estatus_cuen: 'Activa',
      cta_eje_chec: payload.p_cta_eje_chec || null,
      fases: payload.p_fases || null,
      data: payload.p_data || null,
    };
    saveFullRow(fakeRow);
    const mapped = mapRow(fakeRow);
    setCuentas(prev => {
      const updated = [mapped, ...prev];
      saveLocal(updated);
      return updated;
    });
    return { ok: true, data: fakeRow, persisted: false };
  }, [fetchAll]);

  // ── Update ──
  const updateCuenta = useCallback(async (payload: UpdateCuentaAhorroPayload): Promise<{ ok: boolean; data?: JCuentaAhorroRow; error?: string }> => {
    console.log(`${LOG} updateCuenta — iniciando`, payload);

    // Normalizar p_cta_eje_chec a boolean nativo (la columna es BOOLEAN)
    if (payload.p_cta_eje_chec !== undefined && payload.p_cta_eje_chec !== null) {
      const v = payload.p_cta_eje_chec;
      payload.p_cta_eje_chec = v === true || v === 'true' || v === 't' || v === '1';
    }

    if (!DB_AVAILABLE) {
      console.log(`${LOG} DB_AVAILABLE=false → guardando solo en sessionStorage`);
      const fakeRow: JCuentaAhorroRow = {
        id: payload.p_id,
        type: 'CAPTACION',
        no_sol: payload.p_no_sol,
        no_cuenta: payload.p_no_cuenta,
        no_referenc1: payload.p_no_referenc1 || null,
        fecha_sol: payload.p_fecha_sol || '',
        fecha_autori: payload.p_fecha_autori || null,
        fecha_disper: payload.p_fecha_disper || null,
        fecha_cancel: payload.p_fecha_cancel || null,
        fecha_inicio: payload.p_fecha_inicio || null,
        fecha_fin_cu: payload.p_fecha_fin_cu || null,
        descripcion: payload.p_descripcion || null,
        linea_produc: 'CAPTACION',
        tipo_produc: 'Ahorro',
        producto_id: payload.p_producto_id || null,
        producto_eje: payload.p_producto_eje || null,
        cliente_id: payload.p_cliente_id || null,
        saldo_actual: payload.p_saldo_actual || 0,
        monto_sol: payload.p_monto_sol || null,
        monto_aut: payload.p_monto_aut || null,
        monto_disp: payload.p_monto_disp || null,
        estatus_disp: payload.p_estatus_disp || 'Pendiente',
        estatus_sol: payload.p_estatus_sol || 'Pendiente',
        estatus_cart: payload.p_estatus_cart || 'Activa',
        estatus_cuen: payload.p_estatus_cuen || 'Activa',
        cta_eje_chec: payload.p_cta_eje_chec || null,
        fases: payload.p_fases || null,
        data: payload.p_data_partial || null,
      };
      saveFullRow(fakeRow);
      const mapped = mapRow(fakeRow);
      setCuentas(prev => {
        const updated = prev.map(item => item.id === payload.p_id ? mapped : item);
        saveLocal(updated);
        return updated;
      });
      return { ok: true, data: fakeRow };
    }

    // ── Normalizar fechas a ISO 8601 (timestamptz) para resolver ambigüedad ──
    const UPDATE_DATE_FIELDS: (keyof UpdateCuentaAhorroPayload)[] = [
      'p_fecha_sol', 'p_fecha_autori', 'p_fecha_disper', 'p_fecha_cancel', 'p_fecha_inicio', 'p_fecha_fin_cu'
    ];
    for (const field of UPDATE_DATE_FIELDS) {
      const val = payload[field] as string | null | undefined;
      if (val && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        (payload as any)[field] = `${val}T00:00:00.000Z`;
      }
    }

    // ── Intento 1: RPC ──
    try {
      console.log(`${LOG} Update Intento 1 → supabase.rpc('update_cuenta_ahorro')`, payload);
      const { data, error } = await supabase.rpc('update_cuenta_ahorro', payload as any);

      if (!error && data) {
        const rows = Array.isArray(data) ? data : [data];
        const row = rows[0] as JCuentaAhorroRow;
        console.log(`${LOG} Update RPC OK — id: ${row?.id}`);
        if (row) saveFullRow(row);
        await fetchAll(); // Refresh list
        return { ok: true, data: row };
      }

      if (error) {
        console.error(`${LOG} ❌ Update RPC ERROR:`, error.message, error.details, error.hint);
      }
    } catch (e: any) {
      console.error(`${LOG} ❌ Update RPC EXCEPCIÓN:`, e?.message || e);
    }

    // ── Intento 2: Edge Function ──
    try {
      console.log(`${LOG} Update Intento 2 → Edge Function /cuentas-ahorro`);
      const res = await fetch(`${API_BASE}/cuentas-ahorro`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        console.log(`${LOG} Update Edge Function OK`);
        await fetchAll();
        return { ok: true, data: json };
      }
      console.log(`${LOG} Update Edge Function status: ${res.status} (esperado si no hay Edge Function)`);
    } catch (e: any) {
      console.log(`${LOG} Update Edge Function no disponible: ${e?.message || e}`);
    }

    // ── Intento 3: sessionStorage fallback (siempre funciona) ──
    console.log(`${LOG} Update → sessionStorage fallback (datos guardados localmente)`);
    const fakeRow: JCuentaAhorroRow = {
      id: payload.p_id,
      type: 'CAPTACION',
      no_sol: payload.p_no_sol,
      no_cuenta: payload.p_no_cuenta,
      no_referenc1: payload.p_no_referenc1 || null,
      fecha_sol: payload.p_fecha_sol || '',
      fecha_autori: payload.p_fecha_autori || null,
      fecha_disper: payload.p_fecha_disper || null,
      fecha_cancel: payload.p_fecha_cancel || null,
      fecha_inicio: payload.p_fecha_inicio || null,
      fecha_fin_cu: payload.p_fecha_fin_cu || null,
      descripcion: payload.p_descripcion || null,
      linea_produc: 'CAPTACION',
      tipo_produc: 'Ahorro',
      producto_id: payload.p_producto_id || null,
      producto_eje: payload.p_producto_eje || null,
      cliente_id: payload.p_cliente_id || null,
      saldo_actual: payload.p_saldo_actual || 0,
      monto_sol: payload.p_monto_sol || null,
      monto_aut: payload.p_monto_aut || null,
      monto_disp: payload.p_monto_disp || null,
      estatus_disp: payload.p_estatus_disp || 'Pendiente',
      estatus_sol: payload.p_estatus_sol || 'Pendiente',
      estatus_cart: payload.p_estatus_cart || 'Activa',
      estatus_cuen: payload.p_estatus_cuen || 'Activa',
      cta_eje_chec: payload.p_cta_eje_chec || null,
      fases: payload.p_fases || null,
      data: payload.p_data_partial || null,
    };
    // Merge data with existing row to preserve fields not in the partial
    const existingRow = loadFullRowById(payload.p_id);
    if (existingRow && existingRow.data && fakeRow.data) {
      fakeRow.data = { ...existingRow.data, ...fakeRow.data };
    } else if (existingRow && existingRow.data && !fakeRow.data) {
      fakeRow.data = existingRow.data;
    }
    saveFullRow(fakeRow);
    const mapped = mapRow(fakeRow);
    setCuentas(prev => {
      const updated = prev.map(item => item.id === payload.p_id ? mapped : item);
      saveLocal(updated);
      return updated;
    });
    return { ok: true, data: fakeRow };
  }, [fetchAll]);

  // ── Escuchar evento de refetch (disparado desde generarCuentaEje, etc.) ──
  useEffect(() => {
    const handler = () => {
      console.log(`${LOG} Evento ${CUENTA_AHORRO_REFETCH_EVENT} recibido → refetch`);
      fetchAll();
    };
    window.addEventListener(CUENTA_AHORRO_REFETCH_EVENT, handler);
    return () => window.removeEventListener(CUENTA_AHORRO_REFETCH_EVENT, handler);
  }, [fetchAll]);

  return {
    cuentas,
    loading,
    backendStatus,
    refetch: fetchAll,
    insertCuenta,
    updateCuenta,
  };
}