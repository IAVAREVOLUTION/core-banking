/**
 * useCotizacionesCaptacionDB.ts — v3.0 (RPC-FIRST)
 *
 * ═══════════════════════════════════════════════════════════════════
 * Módulo Cotizaciones → Subcategoría Captación
 * Tabla: EFINANCIANET_DB."J_COTIZACIONES"
 *
 * ⚠️  El schema EFINANCIANET_DB NO está expuesto en PostgREST
 *     (PGRST106). Todas las operaciones usan RPCs en public schema
 *     con SECURITY DEFINER que acceden al schema internamente.
 *
 * ESTRATEGIA LECTURA (cuando DB_AVAILABLE = true):
 *   1. Supabase RPC — supabase.rpc('get_all_jcotizaciones')
 *   2. Edge Function — /cotizaciones
 *   3. sessionStorage fallback
 *
 * ESTRATEGIA ESCRITURA:
 *   - INSERT → supabase.rpc('insert_jcotizacion', {...})
 *   - UPDATE → supabase.rpc('update_jcotizacion', {...})
 *   - DELETE → supabase.rpc('delete_jcotizacion', {...})
 *   - Fallback → sessionStorage
 *
 * Operaciones:
 *   - fetchAll()       → SELECT * via RPC (o local)
 *   - saveCotizacion() → INSERT / UPDATE via RPC (o local)
 *   - deleteCotizacion → DELETE via RPC (o local)
 * ═══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';
import { publicAnonKey } from '/utils/supabase/info';
import type { CotizacionCaptacion } from '../components/cotizaciones/cotizacionCaptacionTypes';
import { deepMergeJsonb } from '../components/cotizaciones/cotizacionCaptacionTypes';

// ═══════════════════════════════════════════════════════════════════
// ⚠️  CAMBIAR A true DESPUÉS DE LA MIGRACIÓN SQL
// ═══════════════════════════════════════════════════════════════════
const DB_AVAILABLE = true;

const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-7e2d13d9`;
const SS_KEY = 'cotizaciones_captacion_local';

// ═══════════════════════════════════════════════════════════════════
// UUID HELPER — solo pasa UUID válido al RPC, null si es mock ID
// ═════════════════════════════════════════���═══════════════════════
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeUuid(val: string | null | undefined): string | null {
  if (!val) return null;
  return UUID_RE.test(val) ? val : null;
}

// ═══════════════════════════════════════════════════════════════════
// TIPOS INTERNOS
// ═══════════════════════════════════════════════════════════════════

interface JCotizacionRow {
  id: string;
  no_cotiza: string;
  descripcion: string | null;
  producto_id: string;
  cliente_id: string;
  fecha_cotiza: string | null;
  estatus_cotiza: string;
  data: Record<string, any> | null;
  linea_cotizacion: string | null;
}

export type CotizacionBackendStatus = 'ready' | 'pending-deploy' | 'empty' | 'error' | 'local-only';

// ═══════════════════════════════════════════════════════════════════
// SESSION STORAGE helpers (persistencia local mientras no hay DB)
// ═══════════════════════════════════════════════════════════════════

function loadFromSession(): CotizacionCaptacion[] {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveToSession(items: CotizacionCaptacion[]) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════
// MAPEO — Sin filtro, sin transformación
// ═══════════════════════════════════════════════════════════════════

function mapRowToCotizacion(row: JCotizacionRow): CotizacionCaptacion {
  const d = (row.data || {}) as Record<string, any>;
  return {
    id: row.id,
    no_cotiza: row.no_cotiza || '',
    descripcion: row.descripcion || '',
    producto_id: row.producto_id || '',
    cliente_id: row.cliente_id || '',
    fecha_cotiza: row.fecha_cotiza || new Date().toISOString(),
    estatus_cotiza: row.estatus_cotiza || 'Pendiente',
    linea_cotizacion: row.linea_cotizacion || d.lineaProducto || '',
    data: {
      // ── Spread completo del JSONB original para NO perder campos de Crédito/Línea ──
      ...d,
      // ── Campos normalizados (override sobre el spread) ──
      lineaProducto: d.lineaProducto || 'Captación',
      usuario: d.usuario || '',
      cliente: {
        claveCliente: d.cliente?.claveCliente || d.cliente?.id || '',
        nombreCompleto: d.cliente?.nombreCompleto || '',
        ...(d.cliente || {}),
      },
      institucionGobierno: d.institucionGobierno || '',
      producto: {
        claveProducto: d.producto?.claveProducto || '',
        nombreProducto: d.producto?.nombreProducto || '',
        tipoProducto: d.producto?.tipoProducto || '',
        montoMinimo: d.producto?.montoMinimo || 0,
        periodoCumplirMontoMinimo: d.producto?.periodoCumplirMontoMinimo || '',
        plazoCumplirMontoMinimo: d.producto?.plazoCumplirMontoMinimo || 0,
        ...(d.producto || {}),
      },
      // ── Captación fields (safe defaults) ──
      montoCotizado: d.montoCotizado || 0,
      tasaMinInteres: d.tasaMinInteres ?? d.tasaMinima ?? 0,
      frecuenciaCapitalizacion: d.frecuenciaCapitalizacion || '',
      interesGeneradoPeriodo: d.interesGeneradoPeriodo || 0,
      periodoCumplirMontoMinimo: d.periodoCumplirMontoMinimo || '',
      plazoCumplirMontoMinimo: d.plazoCumplirMontoMinimo ?? d.plazoCumplirMonto ?? 0,
      fechaPrimeraAportacion: d.fechaPrimeraAportacion || '',
      calendarioAportaciones: Array.isArray(d.calendarioAportaciones) ? d.calendarioAportaciones : [],
      // ── Crédito / Línea de Crédito fields (preserved from spread, safe fallbacks) ──
      plazo: d.plazo || '',
      periodo: d.periodo || '',
      tasaCotizada: d.tasaCotizada ?? '',
      amortizacion: d.amortizacion || '',
      pagoPorPeriodo: d.pagoPorPeriodo || '',
      interesPagar: d.interesPagar || '',
      fechaPrimerPago: d.fechaPrimerPago || '',
      seguroFinanciado: d.seguroFinanciado ?? null,
      seguro: d.seguro || null,
      garantia: d.garantia || null,
      tablaAmortizacion: Array.isArray(d.tablaAmortizacion) ? d.tablaAmortizacion : [],
      tipoLinea: d.tipoLinea || '',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// ESTRATEGIA 1 (PRIMARIA): RPC — public.get_all_jcotizaciones()
// SECURITY DEFINER accede a EFINANCIANET_DB internamente
// ═══════════════════════════════════════════════════════════════════
async function tryRPC(): Promise<{ ok: boolean; rows: JCotizacionRow[]; method: string; error?: string }> {
  try {
    console.log('[CotizDB] Intento 1: RPC get_all_jcotizaciones...');
    const { data, error } = await supabase.rpc('get_all_jcotizaciones');
    if (error) {
      console.warn('[CotizDB] Intento 1 (RPC) FALLÓ:', error.message, error);
      return { ok: false, rows: [], method: 'rpc', error: error.message };
    }
    const rows = (data || []) as JCotizacionRow[];
    console.log(`[CotizDB] Intento 1 (RPC) OK — ${rows.length} filas`, rows);
    return { ok: true, rows, method: 'supabase-rpc-get_all_jcotizaciones' };
  } catch (err: any) {
    console.error('[CotizDB] Intento 1 (RPC) EXCEPCIÓN:', err);
    return { ok: false, rows: [], method: 'rpc', error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ESTRATEGIA 2 (FALLBACK): Edge Function
// ═══════════════════════════════════════════════════════════════════
async function tryEdgeFunction(): Promise<{ ok: boolean; rows: JCotizacionRow[]; method: string; error?: string }> {
  try {
    console.log('[CotizDB] Intento 2: Edge Function', `${API_BASE}/cotizaciones`);
    const res = await fetch(`${API_BASE}/cotizaciones`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    const text = await res.text();
    console.log('[CotizDB] Intento 2 response status:', res.status, 'body:', text.substring(0, 500));
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }

    if (!json || !res.ok) {
      console.warn('[CotizDB] Intento 2 (Edge) FALLÓ:', json?.error || `HTTP ${res.status}`);
      return { ok: false, rows: [], method: 'edge-function', error: json?.error || `HTTP ${res.status}` };
    }
    const rows: JCotizacionRow[] = json.data || [];
    console.log(`[CotizDB] Intento 2 (Edge) OK — ${rows.length} filas`);
    return { ok: true, rows, method: 'edge-function' };
  } catch (err: any) {
    console.error('[CotizDB] Intento 2 (Edge) EXCEPCIÓN:', err);
    return { ok: false, rows: [], method: 'edge-function', error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// INSERT via RPC — public.insert_jcotizacion()
// ═══════════════════════════════════════════════════════════════════
async function insertCotizacion(c: CotizacionCaptacion): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible (DB_AVAILABLE=false)' };

  const safeProdId = safeUuid(c.producto_id);
  const safeCliId = safeUuid(c.cliente_id);
  console.log('[CotizDB] INSERT — producto_id:', c.producto_id, '→ safe:', safeProdId, '| cliente_id:', c.cliente_id, '→ safe:', safeCliId);

  try {
    console.log('[CotizDB] INSERT via RPC insert_jcotizacion...', c.no_cotiza);
    const { data, error } = await supabase.rpc('insert_jcotizacion', {
      p_no_cotiza: c.no_cotiza,
      p_descripcion: c.descripcion || null,
      p_producto_id: safeProdId,
      p_cliente_id: safeCliId,
      p_fecha_cotiza: c.fecha_cotiza || new Date().toISOString(),
      p_estatus_cotiza: c.estatus_cotiza || 'Pendiente',
      p_data: c.data,
    });

    if (error) {
      console.warn('[CotizDB] INSERT RPC FALLÓ:', error.message, error);
      return { ok: false, error: error.message };
    }
    const row = data as JCotizacionRow | JCotizacionRow[] | null;
    const id = Array.isArray(row) ? row[0]?.id : (row as any)?.id;
    console.log('[CotizDB] INSERT RPC OK — id:', id);
    return { ok: true, id };
  } catch (err: any) {
    console.error('[CotizDB] INSERT RPC EXCEPCIÓN:', err);
    return { ok: false, error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// UPDATE via RPC — public.update_jcotizacion()
// Spec cotizacion-edit-logic.md §2–§4: Read-Before-Write + Deep Merge
//   1. Leer data actual de la BD (o del cache local)
//   2. Deep merge: data_base || data_parcial (recursivo)
//   3. Enviar el JSON mergeado al RPC
// ══════════════════════════════════════════════════════════════════
async function readCurrentDataFromDB(id: string): Promise<Record<string, any> | null> {
  try {
    console.log('[CotizDB] READ-BEFORE-WRITE: leyendo data actual para id:', id);
    const { data, error } = await supabase.rpc('get_all_jcotizaciones');
    if (error || !data) {
      console.warn('[CotizDB] READ-BEFORE-WRITE falló:', error?.message);
      return null;
    }
    const rows = data as JCotizacionRow[];
    const row = rows.find(r => r.id === id);
    if (!row) {
      console.warn('[CotizDB] READ-BEFORE-WRITE: registro no encontrado en DB, id:', id);
      return null;
    }
    console.log('[CotizDB] READ-BEFORE-WRITE OK — data keys:', Object.keys(row.data || {}));
    return row.data || {};
  } catch (err: any) {
    console.warn('[CotizDB] READ-BEFORE-WRITE EXCEPCIÓN:', err?.message);
    return null;
  }
}

async function updateCotizacion(c: CotizacionCaptacion): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible (DB_AVAILABLE=false)' };
  try {
    console.log('[CotizDB] UPDATE via RPC update_jcotizacion...', c.id);

    // ── Spec §2: Leer JSON actual desde la BD ──
    const currentDbData = await readCurrentDataFromDB(c.id);

    // ── Spec §4: MERGE JSON institucional ──
    // data (izquierda/base) || JSON_PARCIAL (derecha/edits)
    // deepMergeJsonb preserva campos no enviados y merge recursivo para cliente/producto
    let mergedData: Record<string, any>;
    if (currentDbData) {
      mergedData = deepMergeJsonb(currentDbData, c.data as Record<string, any>);
      console.log('[CotizDB] DEEP MERGE completado — base keys:', Object.keys(currentDbData).length,
        '→ merged keys:', Object.keys(mergedData).length);
    } else {
      // Si no pudimos leer de DB, enviar data completa del form (ya tiene todos los campos)
      mergedData = c.data as Record<string, any>;
      console.log('[CotizDB] Sin data base de DB — enviando data completa del form');
    }

    const { error } = await supabase.rpc('update_jcotizacion', {
      p_id: c.id,
      p_descripcion: c.descripcion || null,
      p_producto_id: safeUuid(c.producto_id),
      p_cliente_id: safeUuid(c.cliente_id),
      p_estatus_cotiza: c.estatus_cotiza || 'Pendiente',
      p_data: mergedData,
    });

    if (error) {
      console.warn('[CotizDB] UPDATE RPC FALLÓ:', error.message, error);
      return { ok: false, error: error.message };
    }
    console.log('[CotizDB] UPDATE RPC OK (con Deep Merge institucional)');
    return { ok: true };
  } catch (err: any) {
    console.error('[CotizDB] UPDATE RPC EXCEPCIÓN:', err);
    return { ok: false, error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// DELETE via RPC — public.delete_jcotizacion()
// ═══════════════════════════════════════════════════════════════════
async function deleteCotizacionDB(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible (DB_AVAILABLE=false)' };
  try {
    console.log('[CotizDB] DELETE via RPC delete_jcotizacion...', id);
    const { error } = await supabase.rpc('delete_jcotizacion', { p_id: id });
    if (error) {
      console.warn('[CotizDB] DELETE RPC FALLÓ:', error.message, error);
      return { ok: false, error: error.message };
    }
    console.log('[CotizDB] DELETE RPC OK');
    return { ok: true };
  } catch (err: any) {
    console.error('[CotizDB] DELETE RPC EXCEPCIÓN:', err);
    return { ok: false, error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export function useCotizacionesCaptacionDB(active: boolean) {
  const [cotizaciones, setCotizaciones] = useState<CotizacionCaptacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<CotizacionBackendStatus>(
    DB_AVAILABLE ? 'ready' : 'local-only'
  );
  const [fetchMethod, setFetchMethod] = useState<string>(DB_AVAILABLE ? '' : 'local-only');
  const hasFetched = useRef(false);

  // ── FETCH ALL ──
  const fetchCotizaciones = useCallback(async () => {
    console.log('[CotizDB] ═══ fetchCotizaciones() START ═══ DB_AVAILABLE=', DB_AVAILABLE);
    setLoading(true);
    setError(null);
    setWarning(null);

    // ═══════════════════════════════════════════════════════════
    // MODO LOCAL — DB_AVAILABLE = false
    // ═══════════════════════════════════════════════════════════
    if (!DB_AVAILABLE) {
      const local = loadFromSession();
      console.log('[CotizDB] Modo LOCAL — sessionStorage:', local.length, 'items');
      setCotizaciones(local);
      setBackendStatus('local-only');
      setFetchMethod('local-only (sessionStorage)');
      setLoading(false);
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // MODO DB — 2 intentos: RPC → Edge Function
    // (Schema directo eliminado: PGRST106 — schema no expuesto)
    // ═══════════════════════════════════════════════════════════
    try {
      let rows: JCotizacionRow[] = [];
      let method = '';

      // ── INTENTO 1: RPC (primario) ──
      const r1 = await tryRPC();
      if (r1.ok) {
        rows = r1.rows;
        method = r1.method;
      } else {
        console.log('[CotizDB] Intento 1 (RPC) falló, probando Edge Function...');
        // ── INTENTO 2: Edge function ──
        const r2 = await tryEdgeFunction();
        if (r2.ok) {
          rows = r2.rows;
          method = r2.method;
        } else {
          // Fallback silencioso a sessionStorage
          console.warn('[CotizDB] ⚠️ AMBOS INTENTOS FALLARON — fallback a sessionStorage');
          const local = loadFromSession();
          setCotizaciones(local);
          setBackendStatus('pending-deploy');
          setFetchMethod('local-fallback (DB no responde)');
          setWarning(`RPC: ${r1.error} | Edge: ${r2.error}`);
          setLoading(false);
          return;
        }
      }

      setFetchMethod(method);
      console.log(`[CotizDB] ═══ RESULTADO: method=${method}, rows=${rows.length} ═══`);

      if (rows.length > 0) {
        const mapped = rows.map(mapRowToCotizacion);
        console.log('[CotizDB] Mapped cotizaciones:', mapped);
        setCotizaciones(mapped);
        saveToSession(mapped);
        setBackendStatus('ready');
      } else {
        console.log('[CotizDB] Tabla vacía (0 rows) — backendStatus=empty');
        setCotizaciones([]);
        setBackendStatus('empty');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setBackendStatus('error');
      // Fallback a session
      const local = loadFromSession();
      if (local.length > 0) setCotizaciones(local);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── SAVE (Insert o Update) — RPC + fallback local ──
  const saveCotizacion = useCallback(async (c: CotizacionCaptacion): Promise<{ ok: boolean; id?: string; error?: string }> => {
    setSaving(true);
    try {
      // ── Detección INSERT vs UPDATE ──
      // Un registro es "nuevo" si:
      //   1. No tiene id, o tiene un id tipo 'local-*', o es muy corto
      //   2. O bien: tiene un UUID válido generado por crypto.randomUUID() en el form,
      //      pero NO existe en la lista actual que vino de la DB.
      //      Esto evita el error READ-BEFORE-WRITE cuando el registro nunca fue insertado.
      const looksNew = !c.id || c.id.startsWith('local-') || c.id.length < 10;
      const existsInState = cotizaciones.some(x => x.id === c.id);
      const isNew = looksNew || !existsInState;

      console.log('[CotizDB] SAVE — id:', c.id, '| looksNew:', looksNew, '| existsInState:', existsInState, '| → isNew:', isNew);

      if (DB_AVAILABLE) {
        if (isNew) {
          const result = await insertCotizacion(c);
          if (result.ok && result.id) {
            const updated = { ...c, id: result.id };
            setCotizaciones(prev => {
              const next = [...prev.filter(x => x.no_cotiza !== c.no_cotiza), updated];
              saveToSession(next);
              return next;
            });
            return { ok: true, id: result.id };
          }
          // INSERT falló → log y caer a modo local
          console.warn('[CotizDB] INSERT falló, guardando localmente:', result.error);
        } else {
          const result = await updateCotizacion(c);
          if (result.ok) {
            setCotizaciones(prev => {
              const next = prev.map(x => x.id === c.id ? c : x);
              saveToSession(next);
              return next;
            });
            return { ok: true, id: c.id };
          }
          // UPDATE falló → log y caer a modo local
          console.warn('[CotizDB] UPDATE falló, guardando localmente:', result.error);
        }
      }

      // ── Modo local (DB_AVAILABLE=false o RPC falló) ──
      const localId = isNew ? (c.id || `local-${Date.now()}`) : c.id;
      const localCotizacion = { ...c, id: localId };
      setCotizaciones(prev => {
        const idx = prev.findIndex(x => x.id === localCotizacion.id || x.no_cotiza === c.no_cotiza);
        let next: CotizacionCaptacion[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = localCotizacion;
        } else {
          next = [...prev, localCotizacion];
        }
        saveToSession(next);
        return next;
      });
      return { ok: true, id: localId };
    } finally {
      setSaving(false);
    }
  }, [cotizaciones]);

  // ── DELETE via RPC ──
  const deleteCotizacion = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    if (DB_AVAILABLE) {
      const result = await deleteCotizacionDB(id);
      if (!result.ok) {
        console.warn('[CotizDB] DELETE falló:', result.error);
      }
    }
    setCotizaciones(prev => {
      const next = prev.filter(c => c.id !== id);
      saveToSession(next);
      return next;
    });
    return { ok: true };
  }, []);

  // ── SEED: Insertar registro de prueba vía RPC ──
  const seedTestRecord = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!DB_AVAILABLE) return { ok: false, error: 'DB_AVAILABLE=false' };

    const ts = Date.now().toString(36).toUpperCase();
    const noCotiza = `COT-SEED-${ts}`.slice(0, 30);
    const now = new Date().toISOString();

    const seedData = {
      lineaProducto: 'Captación',
      usuario: 'Admin (Seed)',
      cliente: { claveCliente: 'CLI-SEED', nombreCompleto: 'Registro de Prueba DB' },
      institucionGobierno: 'N/A',
      producto: {
        claveProducto: 'PCAP-SEED',
        nombreProducto: 'Producto Seed Test',
        tipoProducto: 'Ahorro',
        montoMinimo: 1000,
        periodoCumplirMontoMinimo: 'Mensual',
        plazoCumplirMontoMinimo: 6,
      },
      montoCotizado: 25000,
      tasaMinInteres: 5.0,
      frecuenciaCapitalizacion: 'Mensual',
      interesGeneradoPeriodo: 104.17,
      periodoCumplirMontoMinimo: 'Mensual',
      plazoCumplirMontoMinimo: 6,
      fechaPrimeraAportacion: '2026-04-01',
      calendarioAportaciones: [],
    };

    console.log('[CotizDB] ═══ SEED TEST RECORD ═══ no_cotiza:', noCotiza);

    try {
      console.log('[CotizDB] SEED via RPC insert_jcotizacion...');
      const { data, error } = await supabase.rpc('insert_jcotizacion', {
        p_no_cotiza: noCotiza,
        p_descripcion: 'Registro de prueba insertado desde UI',
        p_producto_id: null,
        p_cliente_id: null,
        p_fecha_cotiza: now,
        p_estatus_cotiza: 'Pendiente',
        p_data: seedData,
      });

      if (!error) {
        console.log('[CotizDB] SEED OK — data:', data);
        await fetchCotizaciones();
        return { ok: true };
      }

      const msg = error.message || JSON.stringify(error);
      console.error('[CotizDB] SEED FALLÓ:', msg, error);

      // Error NOT NULL — necesita migración
      if (error.code === '23502' || msg.includes('not-null') || msg.includes('NOT NULL') || msg.includes('null value')) {
        return {
          ok: false,
          error: `NOT NULL constraint activa. Ejecuta la migración en Supabase SQL Editor: /src/imports/migration-fix-jcotizaciones-nullable.sql`,
        };
      }
      return { ok: false, error: msg };
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[CotizDB] SEED EXCEPCIÓN:', msg);
      return { ok: false, error: msg };
    }
  }, [fetchCotizaciones]);

  // ── Auto-fetch cuando se activa (una sola vez) ──
  useEffect(() => {
    if (active && !hasFetched.current) {
      hasFetched.current = true;
      fetchCotizaciones();
    }
  }, [active, fetchCotizaciones]);

  return {
    cotizaciones,
    loading,
    saving,
    error,
    warning,
    backendStatus,
    fetchMethod,
    refetch: fetchCotizaciones,
    saveCotizacion,
    deleteCotizacion,
    seedTestRecord,
  };
}