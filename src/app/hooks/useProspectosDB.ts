/**
 * useProspectosDB.ts — v18.0 BYPASS EDGE FUNCTION
 *
 * ══════════════════════════════════════════════════════════════════
 * Tabla:    "EFINANCIANET_DB"."J_CLIENTES"
 * Columnas: id (uuid PK), type, subtipo, estatus, data (jsonb)
 * Sin filtro — devuelve TODOS los registros
 *
 * ESTRATEGIA v18.0 (3 intentos, primero que funcione gana):
 *   1. Supabase JS — supabase.schema('EFINANCIANET_DB').from('J_CLIENTES').select('*')
 *   2. Supabase RPC — supabase.rpc('get_all_jclientes')
 *   3. Edge Function — fetch /clientes-prospectos (fallback legacy)
 *
 * CERO FILTROS en los 3 paths.
 * ══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';
import { publicAnonKey } from '/utils/supabase/info';
import type { Prospecto } from '../components/prospectos/ProspectosList';

const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-7e2d13d9`;

/** Estructura cruda devuelta por el servidor (columnas reales de J_CLIENTES) */
interface ClienteProspectoRow {
  id: string;        // uuid PK — Llave primaria
  type: string;      // 'Contacto' | 'Prospecto' | 'Cliente'
  subtipo: string;
  estatus: string;   // columna estatus → ESTATUS DEL CLIENTE
  data: Record<string, any>;
}

/**
 * Mapea un registro de J_CLIENTES al tipo Prospecto del frontend.
 */
/**
 * REGLA INSTITUCIONAL (cliente-prospecto-db-rules.md §4 y §6):
 *   Mapear campos del form SIEMPRE desde data (raíz).
 *   NO existe nodo "default" — todo va plano en data.
 *   data.nombre = nombre de pila (campo "Nombre" del formulario)
 *   Nombre completo en listado = data.nombre + ' ' + data.apellidoPaterno + ' ' + data.apellidoMaterno
 */
function mapRowToProspecto(row: ClienteProspectoRow, index: number): Prospecto {
  const d = (row.data || {}) as Record<string, any>;
  // Soporte legacy: si aún existe nodo default, leer de ahí como último fallback
  const legacy = (d.default || {}) as Record<string, any>;

  const storedIdProspecto = (d.idProspecto as string)
    || (legacy.idProspecto as string)
    || '';

  // data.nombre = nombre de pila; nombre completo = nombre + apellidoPaterno + apellidoMaterno
  const nombrePila = (d.nombre as string) || (legacy.nombre as string) || '';
  const apPat = (d.apellidoPaterno as string) || (legacy.apellidoPaterno as string) || '';
  const apMat = (d.apellidoMaterno as string) || (legacy.apellidoMaterno as string) || '';
  const nombreCompleto = `${nombrePila} ${apPat} ${apMat}`.trim();

  return {
    dbUuid: row.id,
    id: index + 1,
    idProspecto: storedIdProspecto || `PROS-${String(index + 1).padStart(3, '0')}`,
    nombre:            nombreCompleto,
    estatus:           row.estatus || '',
    sucursal:          (d.sucursal as string) || (d.entidadFederativa as string) || '',
    estatusSIC:        (d.estatusSIC as string) || '',
    estatusListaNegra: (d.estatusListaNegra as string) || '',
    fechaOriginacion:  (d.fechaOriginacion as string) || '',
    tipo:              (d.tipo as string) || (legacy.tipo as string) || '',
    subtipo:           row.subtipo || '',
    categoria:         row.type || '',
    nombrePila:        nombrePila,
    apellidoPaterno:   apPat,
    apellidoMaterno:   apMat,
    sexo:              (d.sexo as string) || '',
    fechaNacimiento:   (d.fechaNacimiento as string) || '',
    entidadFederativa: (d.entidadFederativa as string) || '',
    denominacionRazonSocial: (d.denominacionRazonSocial as string) || (d.razonSocial as string) || '',
    telefono:          (d.telefono as string) || '',
    curp:              (d.curp as string) || '',
    rfc:               (d.rfc as string) || '',
    correoElectronico: (d.correoElectronico as string) || '',
    cotizacion:        (d.cotizacion as string) || '',
    direccion:         (d.direccion as string) || '',
    institucionGobierno: (d.institucionGobierno as string) || '',
    institucionGobiernoId: (d.institucionGobiernoId as string) || '',
    clasificacionCliente: (d.clasificacionCliente as string) || '',
    direcciones:       Array.isArray(d.direcciones) ? d.direcciones : undefined,
    cotizaciones:      Array.isArray(d.cotizaciones) ? d.cotizaciones : undefined,
    consultas:         Array.isArray(d.sic) ? d.sic : (Array.isArray(d.consultas) ? d.consultas : undefined),
    listasNegras:      Array.isArray(d.listasNegras) ? d.listasNegras : undefined,
    expedientesElectronicos: Array.isArray(d.expedientesElectronicos) ? d.expedientesElectronicos : undefined,
    tablaAmortizacion: Array.isArray(d.tablaAmortizacion) ? d.tablaAmortizacion : undefined,
    _rawData: d,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ESTRATEGIA 1: Supabase JS directo — schema('EFINANCIANET_DB').from('J_CLIENTES')
// ═══════════════════════════════════════════════════════════════════
async function tryDirectSchema(): Promise<{ ok: boolean; rows: ClienteProspectoRow[]; method: string; error?: string }> {
  try {
    console.log('[useProspectosDB] INTENTO 1: supabase.schema("EFINANCIANET_DB").from("J_CLIENTES").select("*")');
    const { data, error } = await supabase
      .schema('EFINANCIANET_DB')
      .from('J_CLIENTES')
      .select('id, type, subtipo, estatus, data');

    if (error) {
      console.log('[useProspectosDB] INTENTO 1 FALLÓ:', error.message);
      return { ok: false, rows: [], method: 'direct-schema', error: error.message };
    }

    const rows = (data || []) as ClienteProspectoRow[];
    console.log(`[useProspectosDB] INTENTO 1 ÉXITO: ${rows.length} registros via schema directo`);
    return { ok: true, rows, method: 'supabase-direct-schema' };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('[useProspectosDB] INTENTO 1 EXCEPCIÓN:', msg);
    return { ok: false, rows: [], method: 'direct-schema', error: msg };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ESTRATEGIA 2: Supabase RPC — supabase.rpc('get_all_jclientes')
// ═══════════════════════════════════════════════════════════════════
async function tryRPC(): Promise<{ ok: boolean; rows: ClienteProspectoRow[]; method: string; error?: string }> {
  try {
    console.log('[useProspectosDB] INTENTO 2: supabase.rpc("get_all_jclientes")');
    const { data, error } = await supabase.rpc('get_all_jclientes');

    if (error) {
      console.log('[useProspectosDB] INTENTO 2 FALLÓ:', error.message);
      return { ok: false, rows: [], method: 'rpc', error: error.message };
    }

    const rows = (data || []) as ClienteProspectoRow[];
    console.log(`[useProspectosDB] INTENTO 2 ÉXITO: ${rows.length} registros via RPC`);
    return { ok: true, rows, method: 'supabase-rpc-get_all_jclientes' };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('[useProspectosDB] INTENTO 2 EXCEPCIÓN:', msg);
    return { ok: false, rows: [], method: 'rpc', error: msg };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ESTRATEGIA 3: Edge Function — fetch /clientes-prospectos (legacy fallback)
// ═══════════════════════════════════════════════════════════════════
async function tryEdgeFunction(): Promise<{ ok: boolean; rows: ClienteProspectoRow[]; method: string; error?: string; version?: string }> {
  try {
    console.log('[useProspectosDB] INTENTO 3: Edge function /clientes-prospectos (legacy)');
    const res = await fetch(`${API_BASE}/clientes-prospectos`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, rows: [], method: 'edge-function', error: `Respuesta no-JSON: ${text.substring(0, 200)}` };
    }

    if (!res.ok) {
      return { ok: false, rows: [], method: 'edge-function', error: json.error || `HTTP ${res.status}` };
    }

    const rows: ClienteProspectoRow[] = json.data || [];
    console.log(`[useProspectosDB] INTENTO 3 ÉXITO: ${rows.length} registros via edge function`);
    return { ok: true, rows, method: 'edge-function', version: json._version || '(desconocida)' };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, rows: [], method: 'edge-function', error: msg };
  }
}

// ═══════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export function useProspectosDB(active: boolean) {
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryMethod, setQueryMethod] = useState<string>('');

  const fetchProspectos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[useProspectosDB v18.0] ════════════════════════════════════════');
      console.log('[useProspectosDB v18.0] Iniciando consulta con 3 estrategias...');

      let rows: ClienteProspectoRow[] = [];
      let method = '';
      const errors: string[] = [];

      // ── INTENTO 1: Schema directo ──
      const r1 = await tryDirectSchema();
      if (r1.ok) {
        rows = r1.rows;
        method = r1.method;
      } else {
        errors.push(`Schema directo: ${r1.error}`);

        // ── INTENTO 2: RPC ──
        const r2 = await tryRPC();
        if (r2.ok) {
          rows = r2.rows;
          method = r2.method;
        } else {
          errors.push(`RPC: ${r2.error}`);

          // ── INTENTO 3: Edge function (legacy) ──
          const r3 = await tryEdgeFunction();
          if (r3.ok) {
            rows = r3.rows;
            method = r3.method;
            console.log(`[useProspectosDB v18.0] ⚠️ USANDO EDGE FUNCTION LEGACY (version: ${r3.version})`);
          } else {
            errors.push(`Edge function: ${r3.error}`);
            throw new Error(`Todos los métodos fallaron:\n${errors.join('\n')}`);
          }
        }
      }

      // ── Diagnóstico: distribución por type ──
      const typeCount: Record<string, number> = {};
      for (const r of rows) {
        const t = r.type || '(null)';
        typeCount[t] = (typeCount[t] || 0) + 1;
      }

      console.log(`[useProspectosDB v18.0] ✅ MÉTODO EXITOSO: ${method}`);
      console.log(`[useProspectosDB v18.0] Total: ${rows.length} registros`);
      console.log(`[useProspectosDB v18.0] Distribución por type:`, JSON.stringify(typeCount));
      if (rows.length > 0) {
        console.log(`[useProspectosDB v18.0] Primer registro — id: ${rows[0].id}, type: "${rows[0].type}"`);
        console.log(`[useProspectosDB v18.0] Último registro — id: ${rows[rows.length - 1].id}, type: "${rows[rows.length - 1].type}"`);
      }
      console.log('[useProspectosDB v18.0] ════════════════════════════════════════');

      setQueryMethod(method);
      const mapped = rows.map(mapRowToProspecto);
      setProspectos(mapped);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useProspectosDB v18.0] Error fatal:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) {
      fetchProspectos();
    }
  }, [active, fetchProspectos]);

  return { prospectos, loading, error, refetch: fetchProspectos, queryMethod };
}