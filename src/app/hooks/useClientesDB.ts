/**
 * useClientesDB.ts — v18.0 BYPASS EDGE FUNCTION
 *
 * ═══════════════════════════════════════════════════════════════════
 * Módulo Clientes → SubTab Lista de Clientes
 * Tabla: EFINANCIANET_DB."J_CLIENTES"
 *
 * ESTRATEGIA v18.0 (3 intentos, primero que funcione gana):
 *   1. Supabase JS — supabase.schema('EFINANCIANET_DB').from('J_CLIENTES').select('*')
 *   2. Supabase RPC — supabase.rpc('get_all_jclientes')
 *   3. Edge Function — /clientes-lista-todos → fallback /clientes-prospectos
 *
 * CERO FILTROS en los 3 paths.
 * ═══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';
import { publicAnonKey } from '/utils/supabase/info';

const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-7e2d13d9`;

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════════

interface JClienteRow {
  id: string;
  type: string;
  subtipo: string;
  estatus: string;
  data: Record<string, any>;
  par_cliente_id: string | null;
}

export interface ClienteDB {
  dbUuid: string;
  par_cliente_id: string | null;
  id: number;
  idCliente: string;
  nombreCompleto: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  rfc: string;
  telefono: string;
  correoElectronico: string;
  estatus: string;
  subtipo: string;
  tipo: string;
  fechaOriginacion: string;
  sucursal: string;
  personalidad: string;
  estatusSIC: string;
  estatusListaNegra: string;
  cuentaEje: string;
  saldo: string;
  fechaActivacion: string;
  /** JSONB crudo completo de data — necesario para cargar todos los campos + subtabs en Modo Editar */
  _rawData?: Record<string, any>;
}

export type BackendStatus = 'ready' | 'pending-deploy' | 'empty' | 'error';

export interface DiagnosticoEndpoint {
  endpointUrl: string;
  endpointName: string;
  endpointExclusivo: boolean;
  usaFallback: boolean;
  fallbackRazon: string;
  httpStatus: number;
  httpStatusText: string;
  rawResponseKeys: string[];
  edgeVersion: string;
  endpointReportado: string;
  tablaConsultada: string;
  esquema: string;
  sqlEsperado: string;
  totalRegistros: number;
  conteosPorType: Record<string, number>;
  conteosPorSubtipo: Record<string, number>;
  conteosPorEstatus: Record<string, number>;
  tieneRegistrosCliente: boolean;
  tieneRegistrosProspecto: boolean;
  tieneRegistrosContacto: boolean;
  filtroOcultoDetectado: boolean;
  filtroOcultoRazon: string;
  dtoUsado: string;
  camposDTO: string[];
  comparteEndpointConProspectos: boolean;
  comparteHandlerConProspectos: boolean;
  timestamp: string;
  durationMs: number;
  errorRaw: string | null;
  primerRegistroRaw: Record<string, any> | null;
  primerRegistroDataKeys: string[];
  diagnosticoServidor: Record<string, any> | null;
}

// ═══════════════════════════════════════════════════════════════════
// MAPEO — Sin filtro, sin transformación de type
// ═══════════════════════════════════════════════════════════════════

function mapRowToCliente(row: JClienteRow, index: number): ClienteDB {
  const d = (row.data || {}) as Record<string, any>;
  const def = (d.default || {}) as Record<string, any>;
  const g = (key: string) => (d[key] as string) || (def[key] as string) || '';

  const nombre = g('nombre');
  const apellidoPaterno = g('apellidoPaterno');
  const apellidoMaterno = g('apellidoMaterno');
  const nombreCompleto = [nombre, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ');

  return {
    dbUuid: row.id,
    par_cliente_id: row.par_cliente_id || null,
    id: index + 1,
    idCliente: g('idCliente') || g('idProspecto') || `REG-${String(index + 1).padStart(3, '0')}`,
    nombreCompleto: nombreCompleto || 'Sin nombre',
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    curp: g('curp'),
    rfc: g('rfc'),
    telefono: g('telefono'),
    correoElectronico: g('correoElectronico'),
    estatus: row.estatus || '',
    subtipo: row.subtipo || '',
    tipo: row.type || '',
    fechaOriginacion: g('fechaOriginacion'),
    sucursal: g('sucursal'),
    personalidad: row.subtipo || g('personalidad'),
    estatusSIC: g('estatusSIC'),
    estatusListaNegra: g('estatusListaNegra'),
    cuentaEje: g('cuentaEje'),
    saldo: (d.saldoCuentaEje as string) || g('saldo'),
    fechaActivacion: g('fechaActivacion') || g('fechaOriginacion'),
    _rawData: row.data,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ESTRATEGIA 1: Schema directo
// ═══════════════════════════════════════════════════════════════════
async function tryDirectSchema(): Promise<{ ok: boolean; rows: JClienteRow[]; method: string; error?: string }> {
  try {
    console.log('[useClientesDB] INTENTO 1: supabase.schema("EFINANCIANET_DB").from("J_CLIENTES").select("*")');
    const { data, error } = await supabase
      .schema('EFINANCIANET_DB')
      .from('J_CLIENTES')
      .select('id, type, subtipo, estatus, data, par_cliente_id');

    if (error) {
      console.log('[useClientesDB] INTENTO 1 FALLÓ:', error.message);
      return { ok: false, rows: [], method: 'direct-schema', error: error.message };
    }

    const rows = (data || []) as JClienteRow[];
    console.log(`[useClientesDB] INTENTO 1 ÉXITO: ${rows.length} registros via schema directo`);
    return { ok: true, rows, method: 'supabase-direct-schema' };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('[useClientesDB] INTENTO 1 EXCEPCIÓN:', msg);
    return { ok: false, rows: [], method: 'direct-schema', error: msg };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ESTRATEGIA 2: RPC
// ═══════════════════════════════════════════════════════════════════
async function tryRPC(): Promise<{ ok: boolean; rows: JClienteRow[]; method: string; error?: string }> {
  try {
    console.log('[useClientesDB] INTENTO 2: supabase.rpc("get_all_jclientes")');
    const { data, error } = await supabase.rpc('get_all_jclientes');

    if (error) {
      console.log('[useClientesDB] INTENTO 2 FALLÓ:', error.message);
      return { ok: false, rows: [], method: 'rpc', error: error.message };
    }

    const rows = (data || []) as JClienteRow[];
    console.log(`[useClientesDB] INTENTO 2 ÉXITO: ${rows.length} registros via RPC`);
    return { ok: true, rows, method: 'supabase-rpc-get_all_jclientes' };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('[useClientesDB] INTENTO 2 EXCEPCIÓN:', msg);
    return { ok: false, rows: [], method: 'rpc', error: msg };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ESTRATEGIA 3: Edge Function (legacy fallback)
// ═══════════════════════════════════════════════════════════════════
async function tryEdgeFunction(): Promise<{ ok: boolean; rows: JClienteRow[]; method: string; error?: string; json?: any }> {
  try {
    // Intento primario: /clientes-lista-todos
    console.log('[useClientesDB] INTENTO 3a: Edge function /clientes-lista-todos');
    let res = await fetch(`${API_BASE}/clientes-lista-todos`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    let text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }

    const is404 = res.status === 404 || text.includes('Route not found');

    if (is404 || !res.ok) {
      // Fallback: /clientes-prospectos
      console.log('[useClientesDB] INTENTO 3a falló, probando 3b: /clientes-prospectos');
      res = await fetch(`${API_BASE}/clientes-prospectos`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      text = await res.text();
      try { json = JSON.parse(text); } catch { json = null; }
    }

    if (!json || !res.ok) {
      return { ok: false, rows: [], method: 'edge-function', error: json?.error || `HTTP ${res.status}` };
    }

    const rows: JClienteRow[] = json.data || [];
    console.log(`[useClientesDB] INTENTO 3 ÉXITO: ${rows.length} registros via edge function`);
    return { ok: true, rows, method: 'edge-function', json };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, rows: [], method: 'edge-function', error: msg };
  }
}

// ═══════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export function useClientesDB(active: boolean) {
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('ready');
  const [diagnostico, setDiagnostico] = useState<DiagnosticoEndpoint | null>(null);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    setBackendStatus('ready');

    const startTime = Date.now();

    const diag: DiagnosticoEndpoint = {
      endpointUrl: '',
      endpointName: '',
      endpointExclusivo: false,
      usaFallback: false,
      fallbackRazon: '',
      httpStatus: 0,
      httpStatusText: '',
      rawResponseKeys: [],
      edgeVersion: '',
      endpointReportado: '',
      tablaConsultada: 'EFINANCIANET_DB."J_CLIENTES"',
      esquema: 'EFINANCIANET_DB',
      sqlEsperado: 'SELECT id, type, subtipo, estatus, data, par_cliente_id FROM EFINANCIANET_DB."J_CLIENTES" (SIN WHERE)',
      totalRegistros: 0,
      conteosPorType: {},
      conteosPorSubtipo: {},
      conteosPorEstatus: {},
      tieneRegistrosCliente: false,
      tieneRegistrosProspecto: false,
      tieneRegistrosContacto: false,
      filtroOcultoDetectado: false,
      filtroOcultoRazon: '',
      dtoUsado: 'ClienteDB (useClientesDB v18.0 — bypass edge function)',
      camposDTO: ['dbUuid', 'id', 'idCliente', 'nombreCompleto', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'curp', 'rfc', 'telefono', 'correoElectronico', 'estatus', 'subtipo', 'tipo', 'fechaOriginacion'],
      comparteEndpointConProspectos: false,
      comparteHandlerConProspectos: false,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      errorRaw: null,
      primerRegistroRaw: null,
      primerRegistroDataKeys: [],
      diagnosticoServidor: null,
    };

    try {
      console.log('[useClientesDB v18.0] ════════════════════════════════════════');
      console.log('[useClientesDB v18.0] Iniciando consulta con 3 estrategias...');

      let rows: JClienteRow[] = [];
      let method = '';
      const errors: string[] = [];

      // ── INTENTO 1: Schema directo ──
      const r1 = await tryDirectSchema();
      if (r1.ok) {
        rows = r1.rows;
        method = r1.method;
        diag.endpointExclusivo = true;
        diag.endpointName = 'supabase.schema("EFINANCIANET_DB").from("J_CLIENTES")';
      } else {
        errors.push(`Schema directo: ${r1.error}`);

        // ── INTENTO 2: RPC ──
        const r2 = await tryRPC();
        if (r2.ok) {
          rows = r2.rows;
          method = r2.method;
          diag.endpointName = 'supabase.rpc("get_all_jclientes")';
        } else {
          errors.push(`RPC: ${r2.error}`);

          // ── INTENTO 3: Edge function ──
          const r3 = await tryEdgeFunction();
          if (r3.ok) {
            rows = r3.rows;
            method = r3.method;
            diag.endpointName = 'edge-function (legacy)';
            diag.usaFallback = true;
            diag.fallbackRazon = 'Supabase directo y RPC fallaron. Usando edge function legacy.';
            if (r3.json) {
              diag.edgeVersion = r3.json._version || '(desconocida)';
              diag.diagnosticoServidor = r3.json._diagnostico || null;
            }
          } else {
            errors.push(`Edge function: ${r3.error}`);
            throw new Error(`Todos los métodos fallaron:\n${errors.join('\n')}`);
          }
        }
      }

      diag.endpointUrl = method;
      diag.totalRegistros = rows.length;

      // Conteos
      for (const r of rows) {
        const t = r.type || '(null)';
        const s = r.subtipo || '(null)';
        const e = r.estatus || '(null)';
        diag.conteosPorType[t] = (diag.conteosPorType[t] || 0) + 1;
        diag.conteosPorSubtipo[s] = (diag.conteosPorSubtipo[s] || 0) + 1;
        diag.conteosPorEstatus[e] = (diag.conteosPorEstatus[e] || 0) + 1;
      }

      diag.tieneRegistrosCliente = (diag.conteosPorType['Cliente'] || 0) > 0;
      diag.tieneRegistrosProspecto = (diag.conteosPorType['Prospecto'] || 0) > 0;
      diag.tieneRegistrosContacto = (diag.conteosPorType['Contacto'] || 0) > 0;

      diag.filtroOcultoDetectado = false;
      const typeSummary = Object.entries(diag.conteosPorType).map(([t, c]) => `${t}(${c})`).join(', ');
      diag.filtroOcultoRazon = rows.length === 0
        ? '0 registros. Tabla vacía.'
        : `✅ ${rows.length} registros totales via ${method}. Types: ${typeSummary}`;

      if (rows.length > 0) {
        const first = rows[0];
        diag.primerRegistroRaw = {
          id: first.id,
          type: first.type,
          subtipo: first.subtipo,
          estatus: first.estatus,
          'data (keys)': Object.keys(first.data || {}),
        };
        diag.primerRegistroDataKeys = Object.keys(first.data || {});
      }

      diag.durationMs = Date.now() - startTime;

      console.log(`[useClientesDB v18.0] ✅ MÉTODO EXITOSO: ${method}`);
      console.log(`[useClientesDB v18.0] Total: ${rows.length} registros`);
      console.log(`[useClientesDB v18.0] Distribución por type:`, JSON.stringify(diag.conteosPorType));
      console.log('[useClientesDB v18.0] ════════════════════════════════════════');

      const mapped = rows.map(mapRowToCliente);
      setClientes(mapped);
      setDiagnostico(diag);

      if (mapped.length > 0) {
        setBackendStatus('ready');
        if (diag.usaFallback) {
          setWarning(`Usando ${method} (los métodos preferidos fallaron). Sin filtros.`);
        }
      } else {
        setBackendStatus('empty');
        setWarning('La tabla J_CLIENTES no contiene registros.');
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useClientesDB v18.0] Error:', msg);
      diag.errorRaw = msg;
      diag.durationMs = Date.now() - startTime;
      setDiagnostico(diag);
      setError(msg);
      setBackendStatus('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) {
      fetchClientes();
    }
  }, [active, fetchClientes]);

  return { clientes, loading, error, warning, backendStatus, diagnostico, refetch: fetchClientes };
}