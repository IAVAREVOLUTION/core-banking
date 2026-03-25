/**
 * useSolicitudesDB.ts — v3.0 (EDGE-FIRST for ALL operations)
 *
 * Tabla: EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES"
 *
 * ESTRATEGIA (Edge Function PRIMERO, RPC como fallback):
 *   LECTURA:
 *     1. Edge Function — /solicitudes-credito (JOIN con J_CLIENTES + J_PRODUCTOS)
 *     2. Supabase RPC — supabase.rpc('get_solicitudes_credito') (sin JOIN)
 *     3. sessionStorage fallback
 *   INSERT:
 *     1. Edge Function — POST /solicitudes-credito (resuelve cliente_id por nombre)
 *     2. Supabase RPC — supabase.rpc('insert_solicitud_credito')
 *   UPDATE:
 *     1. Edge Function — PUT /solicitudes-credito/:id (COALESCE 13 columnas)
 *     2. Supabase RPC — supabase.rpc('update_solicitud_credito')
 *   DELETE:
 *     1. Supabase RPC — supabase.rpc('delete_solicitud_credito')
 *     2. Edge Function — DELETE /solicitudes-credito/:id
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';
import { publicAnonKey } from '/utils/supabase/info';
import type { SolicitudFormData, SolicitudListItem } from '../components/solicitudes/solicitudCreditoStore';

// ═══════════════════════════════════════════════════════════════════
const DB_AVAILABLE = true;
const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-7e2d13d9`;
const SS_KEY = 'solicitudes_credito_db';

// ═══════════════════════════════════════════════════════════════════
// UUID + date helpers
// ═══════════════════════════════════════════════════════════════════
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeUuid(val: string | null | undefined): string | null {
  if (!val) return null;
  return UUID_RE.test(val) ? val : null;
}

/** DD/MM/YYYY HH:MM:SS → YYYY-MM-DD */
function parseFechaSolToISO(fechaSol: string): string {
  if (!fechaSol) return new Date().toISOString().split('T')[0];
  // DD/MM/YYYY ...
  const m = fechaSol.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(fechaSol)) return fechaSol.split('T')[0];
  return new Date().toISOString().split('T')[0];
}

/** YYYY-MM-DD → DD/MM/YYYY */
function parseISOToFechaSol(iso: string): string {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

/** Parse PostgreSQL money ($1,234.56) to number */
function parseMoney(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
export interface SolicitudDBRow {
  id: string;
  type: string;
  no_sol: string;
  no_cuenta: string;
  no_referenc1: string | null;
  fecha_sol: string;
  fecha_autori: string | null;
  fecha_disper: string | null;
  fecha_cancel: string | null;
  fecha_inicio: string | null;
  fecha_fin_cu: string | null;
  descripcion: string | null;
  linea_produc: string;
  tipo_produc: string;
  producto_id: string | null;
  producto_eje: string | null;
  cliente_id: string;
  saldo_actual: any;
  monto_sol: any;
  monto_aut: any;
  monto_disp: any;
  estatus_disp: string | null;
  estatus_sol: string | null;
  estatus_cart: string | null;
  estatus_cuen: string | null;
  cta_eje_chec: boolean | null;
  fases: string | null;
  data: Record<string, any> | null;
  // ── JOIN fields from J_CLIENTES ──
  cliente_nombre?: string | null;
  cliente_ap_paterno?: string | null;
  cliente_ap_materno?: string | null;
  cliente_rfc?: string | null;
  cliente_curp?: string | null;
  cliente_tipo?: string | null;
  cliente_subtipo?: string | null;
  // ── JOIN fields from J_PRODUCTOS ──
  producto_nombre?: string | null;
  producto_clave?: string | null;
  producto_sucursal?: string | null;
}

export type SolicitudBackendStatus = 'ready' | 'pending-deploy' | 'empty' | 'error' | 'local-only';

// ═══════════════════════════════════════════════════════════════════
// SESSION STORAGE
// ═══════════════════════════════════════════════════════════════════
function loadFromSession(): SolicitudListItem[] {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveToSession(items: SolicitudListItem[]) {
  try { sessionStorage.setItem(SS_KEY, JSON.stringify(items)); } catch { /* */ }
}

// ═══════════════════════════════════════════════════════════════════
// MAPEO: DB Row → SolicitudListItem (para la lista)
// ═══════════════════════════════════════════════════════════════════
function mapRowToListItem(row: SolicitudDBRow): SolicitudListItem {
  // ── Protección: row.data puede venir como string si el driver no parsea JSONB ──
  let d: Record<string, any>;
  if (typeof row.data === 'string') {
    try { d = JSON.parse(row.data); } catch { d = {}; }
    console.warn('[mapRow] row.data era STRING — parseado manualmente. id:', row.id);
  } else {
    d = (row.data || {}) as Record<string, any>;
  }

  // ── Nested structure (banca móvil) ──
  const sol = d.solicitud || {};
  const hdr = sol.header || {};

  // ── Nombre del solicitante ──
  // Priority: 1) nested header (lo que el usuario escribió en el form),
  //           2) flat legacy, 3) JOIN J_CLIENTES (puede ser un cliente_id genérico), 4) fallback
  const nestedNombre = [hdr.nombre_persona, hdr.apellido_paterno_persona, hdr.apellido_materno_persona].filter(Boolean).join(' ');
  const flatNombre = d.nombreCompleto || [d.nombrePersona, d.apellidoPaternoPersona, d.apellidoMaternoPersona].filter(Boolean).join(' ');
  const joinNombre = [row.cliente_nombre, row.cliente_ap_paterno, row.cliente_ap_materno].filter(Boolean).join(' ');
  const nombreCompleto = nestedNombre || flatNombre || joinNombre || '(sin nombre)';

  // ── Debug: trazar origen del nombre ──
  if (!nestedNombre && !flatNombre) {
    console.log(`[mapRow] id=${row.id} — nombre viene del JOIN (no del JSONB header). joinNombre='${joinNombre}'`);
  }

  // ── Producto ──
  // Priority: nested header > flat legacy > JOIN J_PRODUCTOS > column
  const nombreProducto = hdr.nombre_producto || d.nombreProducto || row.producto_nombre || '';
  const tipoProducto = hdr.tipo_producto || d.tipoProducto || row.tipo_produc || '';

  // ── Sucursal ──
  const sucursal = hdr.sucursal || d.sucursal || row.producto_sucursal || '';

  return {
    id: row.id as any, // UUID string
    noSol: row.no_sol || hdr.no_sol || d.noSol || '',
    nombreCompleto,
    tipoProducto,
    nombreProducto,
    fechaSolicitud: parseISOToFechaSol(row.fecha_sol),
    montoSolicitado: parseMoney(row.monto_sol),
    montoAutorizado: parseMoney(row.monto_aut),
    sucursal,
    faseDescripcion: hdr.descripcion_fase || d.descripcionFase || row.fases || '',
    estatusSolicitud: row.estatus_sol || hdr.estatus || d.estatusSolicitud || 'Pendiente',
    // Extra fields for form reconstruction
    _dbId: row.id,
    _clienteId: row.cliente_id,
    _productoId: row.producto_id,
    _data: d,
    _fromDB: true,
    // ── JOIN fields preserved for form reconstruction ──
    _clienteNombre: row.cliente_nombre || null,
    _clienteApPaterno: row.cliente_ap_paterno || null,
    _clienteApMaterno: row.cliente_ap_materno || null,
    _clienteTipo: row.cliente_tipo || null,
    _productoNombre: row.producto_nombre || null,
    _productoClave: row.producto_clave || null,
    _productoSucursal: row.producto_sucursal || null,
    _lineaProducto: row.linea_produc || null,
    _tipoProducto: row.tipo_produc || null,
    _descripcion: row.descripcion || null,
    _fases: row.fases || null,
    _fechaInicio: row.fecha_inicio || null,
    _fechaFin: row.fecha_fin_cu || null,
  } as SolicitudListItem & Record<string, any>;
}

// ══════════════════════════════════════════════════════════════════
// MAPEO: SolicitudFormData → DB payload (estructura banca móvil)
//
// El campo JSONB `data` usa estructura anidada:
//   data.solicitud.header          — campos del header
//   data.solicitud.terminos_condiciones
//   data.solicitud.simulacion
//   data.solicitud.expediente_electronico
//   data.solicitud.garantias[]
//   data.solicitud.comisiones[]
//   data.solicitud.autorizaciones[]
//   data.solicitud.notas[]
// ═══════════════════════════════════════════════════════════════════
function formToDBPayload(form: SolicitudFormData, allSubtabs?: Record<string, any>) {
  const montoSolNum = parseFloat((form.montoSolicitado || '0').replace(/[^0-9.-]/g, ''));
  const montoAutNum = parseFloat((form.montoAutorizado || '0').replace(/[^0-9.-]/g, ''));

  const terminos = allSubtabs?.terminos || {};
  const simulacion: any[] = allSubtabs?.simulacion || [];
  const documentos: any[] = allSubtabs?.documentos || [];
  const garantias: any[] = allSubtabs?.garantias || [];
  const comisiones: any[] = allSubtabs?.comisiones || [];
  const autorizaciones: any[] = allSubtabs?.autorizaciones || [];
  const notas: any[] = allSubtabs?.notas || [];

  return {
    type: 'Solicitud',
    no_sol: form.noSol,
    no_cuenta: '',
    no_referenc1: form.cotizacionId || null,
    fecha_sol: parseFechaSolToISO(form.fechaSolicitud),
    descripcion: form.descripcion || null,
    linea_produc: form.lineaProducto || 'Crédito',
    tipo_produc: form.tipoProducto || '',
    producto_id: safeUuid(form.productoId),
    cliente_id: null as string | null, // Will be resolved by RPC/edge function
    monto_sol: isNaN(montoSolNum) ? 0 : montoSolNum,
    monto_aut: isNaN(montoAutNum) ? 0 : montoAutNum,
    estatus_sol: form.estatusSolicitud || 'Pendiente',
    fases: form.faseId || '1',
    data: {
      solicitud: {
        header: {
          id: form.id || null,
          no_sol: form.noSol || null,
          cotizacion_id: form.cotizacionId || null,
          linea_producto: form.lineaProducto || null,
          tipo_producto: form.tipoProducto || null,
          tipo_persona: form.tipoPersona || null,
          nombre_persona: form.nombrePersona || null,
          apellido_paterno_persona: form.apellidoPaternoPersona || null,
          apellido_materno_persona: form.apellidoMaternoPersona || null,
          producto_id: form.productoId || null,
          nombre_producto: form.nombreProducto || null,
          fecha_solicitud: form.fechaSolicitud || null,
          descripcion: form.descripcion || null,
          fase_id: form.faseId || null,
          descripcion_fase: form.descripcionFase || null,
          estatus: form.estatusSolicitud || null,
        },
        terminos_condiciones: {
          tipo_producto: form.tipoProducto || null,
          parametros_simulacion: {
            monto_solicitado: terminos.montoSolicitado || form.montoSolicitado || null,
            plazo: terminos.plazo || null,
            tasa_interes: terminos.tasa || null,
            periodicidad: terminos.frecuencia || null,
            fecha_primer_pago: terminos.fechaPrimerPago || null,
            fecha_primera_aportacion: terminos.fechaPrimeraAportacion || null,
          },
          // Preservar campos camelCase originales para roundtrip (preloadSubtabsFromDBData los lee)
          _raw: {
            montoSolicitado: terminos.montoSolicitado || form.montoSolicitado || '',
            plazo: terminos.plazo || '',
            tasa: terminos.tasa || '',
            frecuencia: terminos.frecuencia || '',
            fechaPrimerPago: terminos.fechaPrimerPago || '',
            fechaPrimeraAportacion: terminos.fechaPrimeraAportacion || '',
            tipoTasa: terminos.tipoTasa || '',
            tipoCalculo: terminos.tipoCalculo || '',
            moneda: terminos.moneda || '',
            montoGarantia: terminos.montoGarantia || '',
            seguroFinanciado: terminos.seguroFinanciado ?? false,
            montoSeguro: terminos.montoSeguro || '',
          },
        },
        simulacion: {
          tipo_tabla: terminos.tipoCalculo || null,
          resultado_simulacion: simulacion.map((r: any) => ({
            no_pago: r.noPago,
            fecha_pago: r.fechaPago,
            saldo_insoluto: r.saldoInsoluto,
            pago_capital: r.pagoCapital,
            pago_interes: r.pagoInteres,
            iva_interes: r.ivaInteres,
            pago_periodo: r.pagoPeriodo,
            pago_seguro: r.pagoSeguro,
            pago_total: r.pagoTotal,
          })),
        },
        expediente_electronico: {
          documentos: documentos.map((doc: any) => ({
            id: doc.id || null,
            fecha_creacion: doc.fecha || null,
            usuario: doc.usuario || null,
            tipo_documento: doc.tipoDocumento || null,
            archivo_adjunto: doc.archivo || null,
            tipo_archivo: doc.tipoArchivo || null,
            nota: doc.nota || null,
            area: doc.area || null,
            fase: doc.fase || null,
            fase_id: doc.faseId || null,
            validado_ia: doc.validadoIA ?? null,
            estatus: doc.estatus || null,
            // ── Campos de referencia al archivo en Storage (críticos para recuperación) ──
            url: doc.url || null,
            storage_path: doc.storagePath || null,
            storage_bucket: doc.storageBucket || null,
            mime: doc.mime || null,
            tamano_kb: doc.tamanoKB || null,
            // ── Resultados de validación IA ──
            ia_motivos: doc.iaMotivos || null,
            ia_extraido: doc.iaExtraido || null,
          })),
        },
        garantias: garantias.map((g: any) => ({
          tipo_garantia: g.tipo || null,
          subtipo: g.subtipo || null,
          descripcion: g.descripcion || null,
          valor_garantia: g.valorNominal || null,
          ubicacion: g.ubicacion || null,
          estatus: g.estatus || null,
          observaciones: g.nota || null,
          fase: g.fase || null,
          fase_id: g.faseId || null,
          area: g.area || null,
        })),
        comisiones: comisiones.map((c: any) => ({
          tipo_comision: c.tipoComision ?? null,
          descripcion: c.descripcion ?? null,
          monto: c.montoCalculado ?? null,
          porcentaje: c.porcentaje ?? null,
          base: c.base ?? null,
          estatus: c.estatus ?? null,
          periodicidad: null,
        })),
        autorizaciones: autorizaciones.map((a: any) => ({
          usuario: a.usuario || null,
          puesto: a.puesto || null,
          estado_autorizacion: a.estatus || null,
          fecha_autorizacion: a.fechaHora || null,
          comentario: a.observaciones || null,
          area: a.area || null,
          descripcion: a.descripcion || null,
        })),
        notas: notas.map((n: any) => ({
          fecha: n.fecha || null,
          usuario: n.usuario || null,
          puesto: n.puesto || null,
          nota: n.nota || null,
          archivo_adjunto: n.archivoAdjunto || null,
        })),
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// ESTRATEGIA 1: Edge Function
// ═════════════════════════════════════án════════════════════════════
async function tryEdgeFunction(): Promise<{ ok: boolean; rows: SolicitudDBRow[]; method: string; error?: string }> {
  try {
    console.log('[SolicDB] Intento 1: Edge Function', `${API_BASE}/solicitudes-credito`);
    const res = await fetch(`${API_BASE}/solicitudes-credito`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }

    if (!json || !res.ok) {
      console.warn('[SolicDB] Edge FALLÓ:', json?.error || `HTTP ${res.status}`);
      return { ok: false, rows: [], method: 'edge-function', error: json?.error || `HTTP ${res.status}` };
    }
    const rows: SolicitudDBRow[] = json.data || json || [];
    console.log(`[SolicDB] Edge OK — ${rows.length} filas`);
    return { ok: true, rows, method: 'edge-function' };
  } catch (err: any) {
    console.error('[SolicDB] Edge EXCEPCIÓN:', err);
    return { ok: false, rows: [], method: 'edge-function', error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ESTRATEGIA 2: RPC
// ═══════════════════════════════════════════════════════════════════
async function tryRPC(): Promise<{ ok: boolean; rows: SolicitudDBRow[]; method: string; error?: string }> {
  try {
    console.log('[SolicDB] Intento 2: RPC get_solicitudes_credito...');
    const { data, error } = await supabase.rpc('get_solicitudes_credito');
    if (error) {
      console.warn('[SolicDB] RPC FALLÓ:', error.message);
      return { ok: false, rows: [], method: 'rpc', error: error.message };
    }
    const rows = (data || []) as SolicitudDBRow[];
    console.log(`[SolicDB] RPC OK — ${rows.length} filas`);
    return { ok: true, rows, method: 'supabase-rpc-get_solicitudes_credito' };
  } catch (err: any) {
    console.error('[SolicDB] RPC EXCEPCIÓN:', err);
    return { ok: false, rows: [], method: 'rpc', error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// INSERT
// ═══════════════════════════════════════════════════════════════════
async function insertSolicitud(payload: ReturnType<typeof formToDBPayload>): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };

  // ── Intento 1: Edge Function (prioridad — resuelve cliente_id por nombre) ──
  try {
    console.log('[SolicDB] INSERT via Edge Function (prioridad)...');
    const res = await fetch(`${API_BASE}/solicitudes-credito`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.id) {
      console.log('[SolicDB] INSERT Edge OK — id:', json.id);
      return { ok: true, id: json.id };
    }
    console.warn('[SolicDB] INSERT Edge FALLÓ:', json.error);
  } catch (err: any) {
    console.warn('[SolicDB] INSERT Edge EXCEPCIÓN:', err?.message);
  }

  // ── Intento 2: RPC (fallback) ──
  try {
    console.log('[SolicDB] INSERT via RPC (fallback)...');
    const { data, error } = await supabase.rpc('insert_solicitud_credito', {
      p_type: payload.type,
      p_no_sol: payload.no_sol,
      p_no_cuenta: payload.no_cuenta,
      p_no_referenc1: payload.no_referenc1,
      p_fecha_sol: payload.fecha_sol,
      p_descripcion: payload.descripcion,
      p_linea_produc: payload.linea_produc,
      p_tipo_produc: payload.tipo_produc,
      p_producto_id: payload.producto_id,
      p_cliente_id: payload.cliente_id,
      p_monto_sol: payload.monto_sol,
      p_monto_aut: payload.monto_aut,
      p_estatus_sol: payload.estatus_sol,
      p_fases: payload.fases,
      p_data: payload.data,
    });
    if (!error) {
      const row = data as any;
      const id = Array.isArray(row) ? row[0]?.id : row?.id;
      console.log('[SolicDB] INSERT RPC OK — id:', id);
      return { ok: true, id };
    }
    console.warn('[SolicDB] INSERT RPC FALLÓ:', error.message);
    return { ok: false, error: error.message };
  } catch (err: any) {
    console.error('[SolicDB] INSERT RPC EXCEPCIÓN:', err?.message);
    return { ok: false, error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// UPDATE
// ═══════════════════════════════════════════════════════════════════
async function updateSolicitud(id: string, payload: Partial<ReturnType<typeof formToDBPayload>>): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };

  // ── Intento 1: Edge Function (prioridad — actualiza 13 columnas con COALESCE) ──
  try {
    console.log('[SolicDB] UPDATE via Edge Function (prioridad)...', id);
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok) {
      console.log('[SolicDB] UPDATE Edge OK');
      return { ok: true };
    }
    console.warn('[SolicDB] UPDATE Edge FALLÓ:', json.error);
  } catch (err: any) {
    console.warn('[SolicDB] UPDATE Edge EXCEPCIÓN:', err?.message);
  }

  // ── Intento 2: RPC (fallback) ──
  try {
    console.log('[SolicDB] UPDATE via RPC (fallback)...', id);
    const { error } = await supabase.rpc('update_solicitud_credito', {
      p_id: id,
      p_no_sol: payload.no_sol,
      p_no_referenc1: payload.no_referenc1,
      p_fecha_sol: payload.fecha_sol,
      p_descripcion: payload.descripcion,
      p_linea_produc: payload.linea_produc,
      p_tipo_produc: payload.tipo_produc,
      p_producto_id: payload.producto_id,
      p_cliente_id: payload.cliente_id,
      p_monto_sol: payload.monto_sol,
      p_monto_aut: payload.monto_aut,
      p_estatus_sol: payload.estatus_sol,
      p_fases: payload.fases,
      p_data: payload.data,
    });
    if (!error) {
      console.log('[SolicDB] UPDATE RPC OK');
      return { ok: true };
    }
    console.warn('[SolicDB] UPDATE RPC FALLÓ:', error.message);
    return { ok: false, error: error.message };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ══════════════════════════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════════════════════════
async function deleteSolicitudDB(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };

  try {
    const { error } = await supabase.rpc('delete_solicitud_credito', { p_id: id });
    if (!error) return { ok: true };
    console.warn('[SolicDB] DELETE RPC FALLÓ:', error.message);
  } catch { /* */ }

  try {
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    if (res.ok) return { ok: true };
    const json = await res.json();
    return { ok: false, error: json.error };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ══════════════════════════════════════════════════════════════════
// NEXT NO_SOL — consulta atómica al backend
// ═══════════════════════════════════════════════════════════════════
export async function fetchNextNoSol(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/solicitudes-credito/next-no-sol`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.no_sol) {
      console.log('[SolicDB] fetchNextNoSol OK:', json.no_sol, '| consecutivo:', json.consecutivo);
      return json.no_sol;
    }
    throw new Error('no_sol vacío en respuesta');
  } catch (err) {
    console.warn('[SolicDB] fetchNextNoSol falló, usando fallback en memoria:', err);
    // Fallback: generar en frontend con timestamp para evitar duplicados
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const ts = String(Date.now()).slice(-6);
    return `BAN-DIGITAL-${yyyy}${mm}${dd}-${ts}`;
  }
}

// ══════════════════════════════════════════════════════════════════
// UPDATE FASE — Actualiza SOLO los campos de fase (JSONB merge)
// Entidad: Fin_Corp_Accnt  |  Campos: NoFaseActual, FaseActual, AreaActual
// ══════════════════════════════════════════════════════════════════

/**
 * Actualiza los campos de fase en Fin_Corp_Accnt sin sobreescribir el resto del JSONB.
 * Usa la RPC update_fase_solicitud (JSONB || merge) como estrategia primaria.
 * Fallback: Edge Function con solo el campo fases (columna top-level).
 *
 * @param id              UUID del registro en J_CUENTAS_CORP_CLIENTES
 * @param faseId          NoFaseActual — número de fase como string ('1', '2', …)
 * @param descripcionFase FaseActual — nombre descriptivo de la fase
 * @param areaActual      AreaActual — área responsable de la fase
 * @param estatusSolicitud EstatusSolicitud — si cambia al avanzar (opcional)
 */
export async function updateFaseSolicitudDB(
  id: string,
  faseId: string,
  descripcionFase: string,
  areaActual: string = '',
  estatusSolicitud?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  if (!UUID_RE.test(id)) {
    console.warn('[SolicDB] updateFase — ID no UUID:', id);
    return { ok: false, error: 'ID inválido (no UUID)' };
  }

  // ── Intento 1: RPC update_fase_solicitud (JSONB merge — no pierde datos) ──
  try {
    const { error } = await supabase.rpc('update_fase_solicitud', {
      p_id: id,
      p_fase_id: faseId,
      p_descripcion_fase: descripcionFase,
      p_area_actual: areaActual || null,
      p_estatus_sol: estatusSolicitud || null,
    });
    if (!error) {
      console.log('[SolicDB] updateFase RPC OK — faseId:', faseId, '|', descripcionFase);
      return { ok: true };
    }
    console.warn('[SolicDB] updateFase RPC FALLÓ:', error.message);
  } catch (err: any) {
    console.warn('[SolicDB] updateFase RPC EXCEPCIÓN:', err?.message);
  }

  // ── Intento 2: Edge Function (actualiza columna fases y estatus_sol top-level) ──
  try {
    const payload: Record<string, any> = { fases: faseId };
    if (estatusSolicitud) payload.estatus_sol = estatusSolicitud;
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log('[SolicDB] updateFase Edge OK — faseId:', faseId);
      return { ok: true };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Avanza la fase de la solicitud al siguiente paso.
 * Intenta POST /avanzarFase; si falla, usa updateFaseSolicitudDB como fallback.
 */
export async function avanzarFaseSolicitudDB(
  id: string,
  nuevaFaseId: string,
  nuevaDescripcionFase: string,
  nuevaArea: string,
  nuevoEstatus?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  if (!UUID_RE.test(id)) return { ok: false, error: 'ID inválido (no UUID)' };

  // Intento 1: Endpoint dedicado /avanzarFase
  try {
    const payload: Record<string, any> = {
      nuevaFaseId,
      nuevaDescripcionFase,
      nuevaArea,
    };
    if (nuevoEstatus) payload.nuevoEstatus = nuevoEstatus;
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}/avanzarFase`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log('[SolicDB] avanzarFase POST OK — faseId:', nuevaFaseId);
      return { ok: true };
    }
  } catch {
    // fallthrough
  }

  // Fallback: reutilizar updateFaseSolicitudDB
  return updateFaseSolicitudDB(id, nuevaFaseId, nuevaDescripcionFase, nuevaArea, nuevoEstatus);
}

/**
 * Regresa la fase de la solicitud al paso anterior.
 * Requiere validación previa (nota reciente) en el llamador.
 * Intenta POST /regresarFase; si falla, usa updateFaseSolicitudDB como fallback.
 */
export async function regresarFaseSolicitudDB(
  id: string,
  faseAnteriorId: string,
  faseAnteriorDesc: string,
  faseAnteriorArea: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  if (!UUID_RE.test(id)) return { ok: false, error: 'ID inválido (no UUID)' };

  // Intento 1: Endpoint dedicado /regresarFase
  try {
    const payload = { faseAnteriorId, faseAnteriorDesc, faseAnteriorArea };
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}/regresarFase`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log('[SolicDB] regresarFase POST OK — faseId:', faseAnteriorId);
      return { ok: true };
    }
  } catch {
    // fallthrough
  }

  // Fallback
  return updateFaseSolicitudDB(id, faseAnteriorId, faseAnteriorDesc, faseAnteriorArea);
}

/**
 * Formaliza contrato/pagaré (Fase 4).
 * Llama POST /formalizarContrato con datos del contrato.
 */
export async function formalizarContratoSolicitudDB(
  id: string,
  datosContrato: Record<string, any>,
): Promise<{ ok: boolean; contrato?: any; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  if (!UUID_RE.test(id)) return { ok: false, error: 'ID inválido (no UUID)' };

  try {
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}/formalizarContrato`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(datosContrato),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      console.log('[SolicDB] formalizarContrato POST OK');
      return { ok: true, contrato: json.contrato ?? json };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ══════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function useSolicitudesDB(active: boolean) {
  const [solicitudes, setSolicitudes] = useState<SolicitudListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<SolicitudBackendStatus>(
    DB_AVAILABLE ? 'ready' : 'local-only'
  );
  const [fetchMethod, setFetchMethod] = useState<string>('');
  const [dbRowCount, setDbRowCount] = useState(0);
  const hasFetched = useRef(false);

  // ── FETCH ALL ──
  const fetchSolicitudes = useCallback(async () => {
    console.log('[SolicDB] === fetchSolicitudes() START === DB_AVAILABLE=', DB_AVAILABLE);
    setLoading(true);
    setError(null);
    setWarning(null);

    if (!DB_AVAILABLE) {
      const local = loadFromSession();
      setSolicitudes(local);
      setBackendStatus('local-only');
      setFetchMethod('local-only');
      setLoading(false);
      return;
    }

    try {
      let rows: SolicitudDBRow[] = [];
      let method = '';

      // Intento 1: Edge Function (tiene JOIN con J_CLIENTES + J_PRODUCTOS)
      const r1 = await tryEdgeFunction();
      if (r1.ok) {
        rows = r1.rows;
        method = r1.method;
      } else {
        // Intento 2: RPC (sin JOIN — nombre viene solo del jsonb data)
        const r2 = await tryRPC();
        if (r2.ok) {
          rows = r2.rows;
          method = r2.method;
        } else {
          console.warn('[SolicDB] AMBOS INTENTOS FALLARON — fallback a sessionStorage');
          const local = loadFromSession();
          setSolicitudes(local);
          setBackendStatus('pending-deploy');
          setFetchMethod('local-fallback');
          setWarning(`Edge: ${r1.error} | RPC: ${r2.error}`);
          setLoading(false);
          return;
        }
      }

      setFetchMethod(method);
      setDbRowCount(rows.length);
      console.log(`[SolicDB] === RESULTADO: method=${method}, rows=${rows.length} ===`);

      if (rows.length > 0) {
        const mapped = rows.map(mapRowToListItem);
        setSolicitudes(mapped);
        saveToSession(mapped);
        setBackendStatus('ready');
      } else {
        setSolicitudes([]);
        setBackendStatus('empty');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setBackendStatus('error');
      const local = loadFromSession();
      if (local.length > 0) setSolicitudes(local);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── SAVE (Insert or Update) ──
  const saveSolicitud = useCallback(async (
    form: SolicitudFormData,
    existingDbId?: string,
    allSubtabs?: Record<string, any>,
  ): Promise<{ ok: boolean; id?: string; error?: string }> => {
    setSaving(true);
    try {
      const payload = formToDBPayload(form, allSubtabs);
      const isNew = !existingDbId;

      console.log('[SolicDB] SAVE — isNew:', isNew, '| dbId:', existingDbId,
        '| payload columns: no_sol=', payload.no_sol, '| tipo_produc=', payload.tipo_produc,
        '| producto_id=', payload.producto_id, '| monto_sol=', payload.monto_sol,
        '| data.solicitud.header keys=', Object.keys(payload.data?.solicitud?.header || {}).join(','));
      console.log('[SolicDB] SAVE — subtabs keys:', Object.keys(allSubtabs || {}).join(', ') || '(none)');

      if (DB_AVAILABLE) {
        if (isNew) {
          const result = await insertSolicitud(payload);
          if (result.ok && result.id) {
            await fetchSolicitudes();
            return { ok: true, id: result.id };
          }
          console.warn('[SolicDB] INSERT falló, guardando localmente:', result.error);
          return { ok: false, error: result.error };
        } else {
          const result = await updateSolicitud(existingDbId!, payload);
          if (result.ok) {
            await fetchSolicitudes();
            return { ok: true, id: existingDbId };
          }
          console.warn('[SolicDB] UPDATE falló:', result.error);
          return { ok: false, error: result.error };
        }
      }

      return { ok: false, error: 'DB no disponible' };
    } finally {
      setSaving(false);
    }
  }, [fetchSolicitudes]);

  // ── DELETE ──
  const deleteSolicitud = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    if (DB_AVAILABLE) {
      const result = await deleteSolicitudDB(id);
      if (!result.ok) {
        console.warn('[SolicDB] DELETE falló:', result.error);
        return result;
      }
    }
    setSolicitudes(prev => {
      const next = prev.filter(s => (s as any)._dbId !== id && String(s.id) !== id);
      saveToSession(next);
      return next;
    });
    return { ok: true };
  }, []);

  // ── Auto-fetch ──
  useEffect(() => {
    if (active && !hasFetched.current) {
      hasFetched.current = true;
      fetchSolicitudes();
    }
  }, [active, fetchSolicitudes]);

  return {
    solicitudes,
    loading,
    saving,
    error,
    warning,
    backendStatus,
    fetchMethod,
    dbRowCount,
    refetch: fetchSolicitudes,
    saveSolicitud,
    deleteSolicitud,
    formToDBPayload,
  };
}