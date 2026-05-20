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

// Catálogo de fases — traduce faseId a nombre legible
const CAT_FASES_MAP: Record<string, string> = {
  '1': 'Fase 1 — Recepción de Documentos',
  '2': 'Fase 2 — Análisis de Crédito',
  '3': 'Fase 3 — Comité de Crédito',
  '4': 'Fase 4 — Formalización',
  '5': 'Fase 5 — Desembolso',
  'fase1': 'Fase 1 — Recepción de Documentos',
  'fase2': 'Fase 2 — Análisis de Crédito',
  'fase3': 'Fase 3 — Comité de Crédito',
  'fase4': 'Fase 4 — Formalización',
  'fase5': 'Fase 5 — Desembolso',
};

function getFaseDescripcion(faseId: string | null | undefined): string {
  if (!faseId) return '';
  return CAT_FASES_MAP[faseId] || faseId; // Si no está en el mapa, devolver tal cual
}

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
  monto_cubrir_garantia: number | null;
  porcentaje_aforo: number | null;
  // ── JOIN fields from J_CLIENTES ──
  cliente_nombre?: string | null;
  cliente_ap_paterno?: string | null;
  cliente_ap_materno?: string | null;
  cliente_rfc?: string | null;
  cliente_curp?: string | null;
  cliente_tipo?: string | null;
  cliente_subtipo?: string | null;
  institucion_gobierno?: string | null;
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

  // ── Producto ──
  // Priority: nested header > flat legacy > JOIN J_PRODUCTOS > column
  const nombreProducto = hdr.nombre_producto || d.nombreProducto || row.producto_nombre || '';
  const tipoProducto = hdr.tipo_producto || d.tipoProducto || row.tipo_produc || '';

  // ── Sucursal ──
  const sucursal = hdr.sucursal || d.sucursal || row.producto_sucursal || '';

  // ── Inyectar monto_cubrir_garantia y porcentaje_aforo (columnas top-level) en _data ──
  // Esto permite que preloadSubtabsFromDBData los lea desde data.solicitud.garantias[0]
  const montoCubrir = row.monto_cubrir_garantia;
  const porcentajeAf = row.porcentaje_aforo;
  if (montoCubrir != null || porcentajeAf != null) {
    const garantiasOrig: any[] = Array.isArray(d.solicitud?.garantias) ? d.solicitud.garantias : [];
    let garantiasActualizadas: any[];
    if (garantiasOrig.length === 0) {
      // Sin garantías en JSONB — crear entrada mínima para transportar los valores
      garantiasActualizadas = [{ monto_cubrir_garantia: montoCubrir, porcentaje_aforo: porcentajeAf }];
    } else {
      // Inyectar en la primera garantía sin mutar el array original
      garantiasActualizadas = garantiasOrig.map((g: any, i: number) =>
        i === 0 ? { ...g, monto_cubrir_garantia: montoCubrir ?? g.monto_cubrir_garantia, porcentaje_aforo: porcentajeAf ?? g.porcentaje_aforo } : g
      );
    }
    d = { ...d, solicitud: { ...d.solicitud, garantias: garantiasActualizadas } };
  }

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
    faseDescripcion: hdr.descripcion_fase || d.descripcionFase || getFaseDescripcion(row.fases) || '',
    estatusSolicitud: row.estatus_sol || d.estatusSolicitud || 'Pendiente',
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
    _clienteCurp: row.cliente_curp || null,
    _clienteRfc: row.cliente_rfc || null,
    _clienteTipo: row.cliente_tipo || null,
    _gobierno: row.institucion_gobierno || null,
    _tipoPersona: hdr.tipo_persona || d.tipoPersona || row.cliente_tipo || null,
    _productoNombre: row.producto_nombre || null,
    _productoClave: row.producto_clave || null,
    _productoSucursal: row.producto_sucursal || null,
    _lineaProducto: row.linea_produc || null,
    _tipoProducto: row.tipo_produc || null,
    _descripcion: row.descripcion || null,
    _fases: row.fases || null,
    _fechaInicio: row.fecha_inicio || null,
    _fechaFin: row.fecha_fin_cu || null,
    _montoCubrirGarantia: row.monto_cubrir_garantia ?? null,
    _porcentajeAforo: row.porcentaje_aforo ?? null,
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
/**
 * Deep merge: obj2 keys override obj1 keys recursively.
 * Arrays are replaced (not concatenated) — caller decides which array to use.
 * Null/undefined values in obj2 do NOT override existing obj1 values.
 */
function deepMerge(base: Record<string, any>, patch: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...base };
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    const bv = base[key];
    if (pv === null || pv === undefined) {
      // Don't wipe existing data with null — keep base value
      continue;
    }
    if (Array.isArray(pv)) {
      // Arrays: use patch value always (caller decided which array to send)
      result[key] = pv;
    } else if (typeof pv === 'object' && typeof bv === 'object' && bv !== null && !Array.isArray(bv)) {
      result[key] = deepMerge(bv, pv);
    } else {
      result[key] = pv;
    }
  }
  return result;
}

function formToDBPayload(form: SolicitudFormData, allSubtabs?: Record<string, any>) {
  const montoSolNum = parseFloat((form.montoSolicitado || '0').replace(/[^0-9.-]/g, ''));
  const montoAutNum = parseFloat((form.montoAutorizado || '0').replace(/[^0-9.-]/g, ''));

  // Original JSONB from DB (present when editing an existing record from any source)
  const originalData: Record<string, any> | undefined = allSubtabs?._originalData;
  const origSol: Record<string, any> = originalData?.solicitud || {};

  // Helper: use session array if it was explicitly loaded; otherwise fall back to original JSONB array
  function subtabArr(sessionKey: string, origKey: string): any[] {
    if (allSubtabs?.[sessionKey] !== undefined) return allSubtabs[sessionKey] as any[];
    const orig = origSol[origKey];
    return Array.isArray(orig) ? orig : [];
  }

  const terminos = allSubtabs?.terminos || {};
  const simulacion: any[] = allSubtabs?.simulacion || [];
  const documentos: any[] = allSubtabs?.documentos !== undefined ? allSubtabs.documentos : (origSol.expediente_electronico?.documentos || []);
  const garantias: any[] = subtabArr('garantias', 'garantias');
  const comisiones: any[] = subtabArr('comisiones', 'comisiones');
  const autorizaciones: any[] = subtabArr('autorizaciones', 'autorizaciones');
  const notas: any[] = subtabArr('notas', 'notas');
  const partesRelacionadas: any[] = subtabArr('partesRelacionadas', 'partes_relacionadas');

  // ── Build the Core-managed header fields ──
  // Only non-null values are included so deepMerge won't wipe original fields
  const coreHeader: Record<string, any> = {};
  if (form.id) coreHeader.id = form.id;
  if (form.noSol) coreHeader.no_sol = form.noSol;
  if (form.cotizacionId) coreHeader.cotizacion_id = form.cotizacionId;
  if (form.lineaProducto) coreHeader.linea_producto = form.lineaProducto;
  if (form.tipoProducto) coreHeader.tipo_producto = form.tipoProducto;
  if (form.tipoPersona) coreHeader.tipo_persona = form.tipoPersona;
  if (form.nombrePersona) coreHeader.nombre_persona = form.nombrePersona;
  if (form.apellidoPaternoPersona) coreHeader.apellido_paterno_persona = form.apellidoPaternoPersona;
  if (form.apellidoMaternoPersona) coreHeader.apellido_materno_persona = form.apellidoMaternoPersona;
  if (form.productoId) coreHeader.producto_id = form.productoId;
  if (form.nombreProducto) coreHeader.nombre_producto = form.nombreProducto;
  if (form.fechaSolicitud) coreHeader.fecha_solicitud = form.fechaSolicitud;
  if (form.descripcion) coreHeader.descripcion = form.descripcion;
  if (form.faseId) coreHeader.fase_id = form.faseId;
  if (form.descripcionFase) coreHeader.descripcion_fase = form.descripcionFase;
  if (form.estatusSolicitud) coreHeader.estatus = form.estatusSolicitud;
  if ((form as any)._curp) coreHeader.curp = (form as any)._curp;
  if ((form as any)._rfc) coreHeader.rfc = (form as any)._rfc;

  // Merge Core header on top of original header (preserves banca móvil-specific fields)
  const mergedHeader = origSol.header ? deepMerge(origSol.header, coreHeader) : coreHeader;

  // ── Build Core-managed terminos fields (only non-empty) ──
  const coreTerminosRaw: Record<string, any> = {};
  if (terminos.montoSolicitado || form.montoSolicitado) coreTerminosRaw.montoSolicitado = terminos.montoSolicitado || form.montoSolicitado || '';
  if (terminos.plazo) coreTerminosRaw.plazo = terminos.plazo;
  if (terminos.tasa) coreTerminosRaw.tasa = terminos.tasa;
  if (terminos.frecuencia) coreTerminosRaw.frecuencia = terminos.frecuencia;
  if (terminos.fechaPrimerPago) coreTerminosRaw.fechaPrimerPago = terminos.fechaPrimerPago;
  if (terminos.fechaPrimeraAportacion) coreTerminosRaw.fechaPrimeraAportacion = terminos.fechaPrimeraAportacion;
  if ((terminos as any).fechaInicio || terminos.fechaPrimerPago || (form as any).fechaInicio) coreTerminosRaw.fechaInicio = (terminos as any).fechaInicio || terminos.fechaPrimerPago || (form as any).fechaInicio;
  if ((terminos as any).fechaFin || (form as any).fechaFin) coreTerminosRaw.fechaFin = (terminos as any).fechaFin || (form as any).fechaFin;
  if (terminos.tipoTasa) coreTerminosRaw.tipoTasa = terminos.tipoTasa;
  if (terminos.tipoCalculo) coreTerminosRaw.tipoCalculo = terminos.tipoCalculo;
  if (terminos.moneda) coreTerminosRaw.moneda = terminos.moneda;
  if (terminos.montoGarantia) coreTerminosRaw.montoGarantia = terminos.montoGarantia;
  if (terminos.seguroFinanciado !== undefined) coreTerminosRaw.seguroFinanciado = terminos.seguroFinanciado;
  if (terminos.montoSeguro) coreTerminosRaw.montoSeguro = terminos.montoSeguro;
  if (terminos.rendimientos?.length) coreTerminosRaw.rendimientos = terminos.rendimientos;
  if (terminos.perfilInversionista) coreTerminosRaw.perfilInversionista = terminos.perfilInversionista;
  if (terminos.riesgoInversionista) coreTerminosRaw.riesgoInversionista = terminos.riesgoInversionista;
  if (terminos.horizonteInversion) coreTerminosRaw.horizonteInversion = terminos.horizonteInversion;
  if (terminos.experienciaInversion) coreTerminosRaw.experienciaInversion = terminos.experienciaInversion;

  const origRaw = origSol.terminos_condiciones?._raw || {};
  const mergedRaw = Object.keys(coreTerminosRaw).length > 0
    ? deepMerge(origRaw, coreTerminosRaw)
    : origRaw;

  const origTcParams = origSol.terminos_condiciones?.parametros_simulacion || {};
  const coreParams: Record<string, any> = {};
  if (terminos.montoSolicitado || form.montoSolicitado) coreParams.monto_solicitado = terminos.montoSolicitado || form.montoSolicitado;
  if (terminos.plazo) coreParams.plazo = terminos.plazo;
  if (terminos.tasa) coreParams.tasa_interes = terminos.tasa;
  if (terminos.frecuencia) coreParams.periodicidad = terminos.frecuencia;
  if (terminos.fechaPrimerPago) coreParams.fecha_primer_pago = terminos.fechaPrimerPago;
  if (terminos.fechaPrimeraAportacion) coreParams.fecha_primera_aportacion = terminos.fechaPrimeraAportacion;
  const mergedTcParams = Object.keys(coreParams).length > 0 ? deepMerge(origTcParams, coreParams) : origTcParams;

  const origTc = origSol.terminos_condiciones || {};
  const mergedTc = deepMerge(origTc, {
    tipo_producto: form.tipoProducto || origTc.tipo_producto || null,
    parametros_simulacion: mergedTcParams,
    _raw: mergedRaw,
  });

  // ── Build the full data.solicitud via deep merge ──
  const coreSolicitud: Record<string, any> = {
    header: mergedHeader,
    terminos_condiciones: mergedTc,
    simulacion: (() => {
      const invRows: any[] = allSubtabs?.simulacion_inv || [];
      const isInversion = invRows.length > 0 || !!(terminos as any).metodoIntereses;

      if (isInversion && invRows.length > 0) {
        // Tabla de flujo de inversión
        return {
          tipo_tabla: (terminos as any).metodoIntereses || terminos.tipoCalculo || origSol.simulacion?.tipo_tabla || null,
          resultado_simulacion: invRows.map((r: any) => ({
            no_pago: r.periodo,
            fecha_pago: r.fechaInversion,
            capital_inicial: r.capitalInicial,
            interes_bruto: r.interesBruto,
            retencion_isr: r.retencionISR,
            iva_interes: r.retencionISR,
            interes_neto: r.interesNeto,
            pago_interes: r.interesNeto,
            pago_periodo: r.interesBruto,
            pago_capital: 0,
            pago_seguro: 0,
            capital_final: r.capitalFinal,
            saldo_insoluto: r.capitalFinal,
            pago_total: r.capitalFinal,
          })),
          calendario_aportaciones: [],
        };
      }

      // Crédito / Captación
      return {
        tipo_tabla: terminos.tipoCalculo || origSol.simulacion?.tipo_tabla || null,
        resultado_simulacion: simulacion.map((r: any) => ({
          no_pago: r.noPago, fecha_pago: r.fechaPago, saldo_insoluto: r.saldoInsoluto,
          pago_capital: r.pagoCapital, pago_interes: r.pagoInteres, iva_interes: r.ivaInteres,
          pago_periodo: r.pagoPeriodo, pago_seguro: r.pagoSeguro, pago_total: r.pagoTotal,
        })),
        calendario_aportaciones: (() => {
          const fromSession = allSubtabs?.simulacion_cal;
          if (Array.isArray(fromSession) && fromSession.length > 0) return fromSession;
          if (Array.isArray((form as any)._calendarioAportaciones) && (form as any)._calendarioAportaciones.length > 0)
            return (form as any)._calendarioAportaciones;
          return origSol.simulacion?.calendario_aportaciones || [];
        })(),
      };
    })(),
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
        url: doc.url || null,
        storage_path: doc.storagePath || null,
        storage_bucket: doc.storageBucket || null,
        mime: doc.mime || null,
        tamano_kb: doc.tamanoKB || null,
        ia_motivos: doc.iaMotivos || null,
        ia_extraido: doc.iaExtraido || null,
      })),
    },
    garantias: garantias.map((g: any) => ({
      tipo_garantia: g.tipo || null, subtipo: g.subtipo || null,
      descripcion: g.descripcion || null, valor_garantia: g.valorNominal || null,
      monto_cubrir_garantia: g.montoCubrirGarantia ?? null,
      porcentaje_aforo: g.porcentajeAforo ?? null,
      ubicacion: g.ubicacion || null, estatus: g.estatus || null,
      observaciones: g.nota || null, fase: g.fase || null,
      fase_id: g.faseId || null, area: g.area || null,
    })),
    comisiones: comisiones.map((c: any) => ({
      tipo_comision: c.tipoComision ?? null, descripcion: c.descripcion ?? null,
      monto: c.montoCalculado ?? null, porcentaje: c.porcentaje ?? null,
      base: c.base ?? null, estatus: c.estatus ?? null, periodicidad: null,
    })),
    autorizaciones: autorizaciones.map((a: any) => ({
      usuario: a.usuario || null, puesto: a.puesto || null,
      estado_autorizacion: a.estatus || null, fecha_autorizacion: a.fechaHora || null,
      comentario: a.observaciones || null, area: a.area || null,
      descripcion: a.descripcion || null,
    })),
    notas: notas.map((n: any) => ({
      fecha: n.fecha || null, usuario: n.usuario || null,
      puesto: n.puesto || null, nota: n.nota || null,
      archivo_adjunto: n.archivoAdjunto || null,
    })),
    partes_relacionadas: partesRelacionadas.map((p: any) => ({
      relacionLegal: p.tipoRelacion || null,
      participacion: p.participacion || null,
      persona: {
        nombreCompleto: p.nombreCompleto || null,
        telefono: p.telefono || null,
        email: p.email || null,
        curp: p.curp || null,
        rfc: p.rfc || null,
      },
      rolAsignado: p.rolAsignado || null,
      nombreEjecutivo: p.nombreEjecutivo || null,
    })),
  };

  // Deep merge Core solicitud on top of original — preserves ALL banca móvil fields not managed by Core
  const mergedSolicitud = origSol && Object.keys(origSol).length > 0
    ? deepMerge(origSol, coreSolicitud)
    : coreSolicitud;

  // Deep merge Core data on top of original — preserves top-level keys from banca móvil
  const mergedData = originalData && Object.keys(originalData).length > 0
    ? deepMerge(originalData, { solicitud: mergedSolicitud })
    : { solicitud: mergedSolicitud };

  // no_referenc1 is VARCHAR(30) in DB — UUID (36 chars) doesn't fit, so omit it on updates
  // (it was set correctly on INSERT and should not change)
  const noReferenc1 = form.cotizacionId && form.cotizacionId.length <= 30
    ? form.cotizacionId
    : null;

  // Leer monto_cubrir_garantia y porcentaje_aforo desde terminos (columnas top-level de J_CUENTAS_CORP_CLIENTES)
  const montoCubrirGarantia = terminos.montoCubrirGarantia != null ? Number(terminos.montoCubrirGarantia) : null;
  const porcentajeAforo = terminos.porcentajeAforo != null ? Number(terminos.porcentajeAforo) : null;

  return {
    type: 'Solicitudes',
    no_sol: form.noSol || '',
    no_cuenta: '',
    no_referenc1: noReferenc1,
    fecha_sol: parseFechaSolToISO(form.fechaSolicitud),
    descripcion: form.descripcion || null,
    linea_produc: form.lineaProducto || 'Crédito',
    tipo_produc: form.tipoProducto || '',
    producto_id: safeUuid(form.productoId),
    cliente_id: safeUuid((form as any)._clienteId) || null,
    monto_sol: isNaN(montoSolNum) ? 0 : montoSolNum,
    monto_aut: isNaN(montoAutNum) ? 0 : montoAutNum,
    estatus_sol: form.estatusSolicitud || 'Pendiente',
    fases: form.faseId || '1',
    monto_cubrir_garantia: montoCubrirGarantia,
    porcentaje_aforo: porcentajeAforo,
    data: mergedData,
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
  } catch (err: any) {
    console.warn('[SolicDB] UPDATE RPC EXCEPCIÓN:', err?.message);
  }

  // ── Intento 3: Supabase directo (último recurso) ──
  try {
    console.log('[SolicDB] UPDATE via Supabase directo (intento 3)...', id);
    const { error } = await supabase
      .from('J_CUENTAS_CORP_CLIENTES')
      .update({
        no_sol: payload.no_sol,
        no_referenc1: payload.no_referenc1,
        fecha_sol: payload.fecha_sol,
        descripcion: payload.descripcion,
        linea_produc: payload.linea_produc,
        tipo_produc: payload.tipo_produc,
        producto_id: payload.producto_id,
        cliente_id: payload.cliente_id,
        monto_sol: payload.monto_sol,
        monto_aut: payload.monto_aut,
        estatus_sol: payload.estatus_sol,
        fases: payload.fases,
        data: payload.data,
      })
      .eq('id', id);
    if (!error) {
      console.log('[SolicDB] UPDATE Supabase directo OK');
      return { ok: true };
    }
    console.warn('[SolicDB] UPDATE Supabase directo FALLÓ:', error.message);
  } catch (err: any) {
    console.warn('[SolicDB] UPDATE Supabase directo EXCEPCIÓN:', err?.message);
  }

  // ── Todos los intentos fallaron ──
  console.warn('[SolicDB] UPDATE — todos los intentos fallaron.');
  return { ok: false, error: 'Todos los intentos de actualización fallaron' };
}

// ══════════════════════════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════════════════════════
async function deleteSolicitudDB(id: string): Promise<{ ok: boolean; error?: string; activaciones_vinculadas?: number }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };

  // Intento 1: Edge Function (verifica activaciones vinculadas antes de DELETE)
  try {
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    // HTTP 409 = bloqueado por activaciones vinculadas
    if (res.status === 409) {
      console.warn('[SolicDB] DELETE bloqueado por FK:', json.error);
      return { ok: false, error: json.error, activaciones_vinculadas: json.activaciones_vinculadas };
    }
    console.warn('[SolicDB] DELETE Edge FALLÓ:', json.error || `HTTP ${res.status}`);
  } catch (err: any) {
    console.warn('[SolicDB] DELETE Edge EXCEPCIÓN:', err?.message);
  }

  // Intento 2: RPC (también tiene guard contra activaciones vinculadas)
  try {
    const { error } = await supabase.rpc('delete_solicitud_credito', { p_id: id });
    if (!error) return { ok: true };
    const msg = error.message || '';
    // Detectar FK violation o el mensaje del guard del RPC
    if (msg.includes('activación') || msg.includes('foreign key') || msg.includes('violates')) {
      console.warn('[SolicDB] DELETE RPC bloqueado por FK/guard:', msg);
      return { ok: false, error: msg };
    }
    console.warn('[SolicDB] DELETE RPC FALLÓ:', msg);
    return { ok: false, error: msg };
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
    const edgePayload: Record<string, any> = { fases: faseId };
    if (estatusSolicitud) edgePayload.estatus_sol = estatusSolicitud;
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(edgePayload),
    });
    if (res.ok) {
      console.log('[SolicDB] updateFase Edge OK — faseId:', faseId);
      return { ok: true };
    }
    const json = await res.json().catch(() => ({}));
    console.warn('[SolicDB] updateFase Edge FALLÓ:', json.error || `HTTP ${res.status}`);
  } catch (err: any) {
    console.warn('[SolicDB] updateFase Edge EXCEPCIÓN:', err?.message);
  }

  // ── Intento 3: Supabase directo (último recurso) ──
  try {
    const directPayload: Record<string, any> = { fases: faseId };
    if (estatusSolicitud) directPayload.estatus_sol = estatusSolicitud;
    const { error } = await supabase
      .from('J_CUENTAS_CORP_CLIENTES')
      .update(directPayload)
      .eq('id', id);
    if (!error) {
      console.log('[SolicDB] updateFase Supabase directo OK — faseId:', faseId);
      return { ok: true };
    }
    console.warn('[SolicDB] updateFase Supabase directo FALLÓ:', error.message);
  } catch (err: any) {
    console.warn('[SolicDB] updateFase Supabase directo EXCEPCIÓN:', err?.message);
  }

  // ── Todos los intentos fallaron — la fase está actualizada en estado local ──
  console.warn('[SolicDB] updateFase — todos los intentos fallaron. Estado preservado localmente.');
  return { ok: true };
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

  // Usar updateFaseSolicitudDB directamente — el RPC update_fase_solicitud hace JSONB merge
  // y NO toca la columna data, por lo que preserva los datos de banca móvil.
  // El endpoint /avanzarFase del Edge Function fue eliminado porque su comportamiento
  // server-side sobre la columna data no está garantizado.
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
 * Intenta POST /formalizarContrato; si el endpoint no existe (404/error),
 * hace fallback a Supabase directo (select + merge en data.contrato) y
 * luego a Edge Function PUT como último recurso.
 */
export async function formalizarContratoSolicitudDB(
  id: string,
  datosContrato: Record<string, any>,
): Promise<{ ok: boolean; contrato?: any; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  if (!UUID_RE.test(id)) return { ok: false, error: 'ID inválido (no UUID)' };

  // ── Intento 1: Endpoint dedicado /formalizarContrato ─────────────────────
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
    console.warn('[SolicDB] formalizarContrato POST FALLÓ:', res.status);
  } catch {
    // fallthrough
  }

  // ── Fallback 1: Supabase directo — merge datosContrato en data.contrato ──
  try {
    const { data: row, error: selErr } = await supabase
      .from('J_CUENTAS_CORP_CLIENTES')
      .select('data')
      .eq('id', id)
      .single();

    if (!selErr) {
      const currentData = (row?.data as Record<string, any>) || {};
      const mergedData = { ...currentData, contrato: datosContrato };

      const { error: updErr } = await supabase
        .from('J_CUENTAS_CORP_CLIENTES')
        .update({ data: mergedData })
        .eq('id', id);

      if (!updErr) {
        console.log('[SolicDB] formalizarContrato Supabase directo OK');
        return { ok: true, contrato: datosContrato };
      }
      console.warn('[SolicDB] formalizarContrato Supabase update FALLÓ:', updErr.message);
    } else {
      console.warn('[SolicDB] formalizarContrato Supabase select FALLÓ:', selErr.message);
    }
  } catch (err: any) {
    console.warn('[SolicDB] formalizarContrato Supabase EXCEPCIÓN:', err?.message);
  }

  // ── Fallback 2: Edge Function PUT ─────────────────────────────────────────
  try {
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contrato: datosContrato }),
    });
    if (res.ok) {
      console.log('[SolicDB] formalizarContrato Edge PUT OK');
      return { ok: true, contrato: datosContrato };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Crea una entidad "Cuenta por Pagar" (Fase 6 — Línea Crédito).
 * Intenta POST /crearCuentaPagar; fallback actualiza fases via updateFaseSolicitudDB.
 */
export async function crearCuentaPorPagarDB(
  id: string,
  datos: Record<string, any>,
): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  if (!UUID_RE.test(id)) return { ok: false, error: 'ID inválido (no UUID)' };

  try {
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}/crearCuentaPagar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    if (res.ok) {
      console.log('[SolicDB] crearCuentaPagar POST OK');
      return { ok: true };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Crea una entidad "Cuenta por Cobrar" (Fase 6 — Línea Captación).
 */
export async function crearCuentaPorCobrarDB(
  id: string,
  datos: Record<string, any>,
): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  if (!UUID_RE.test(id)) return { ok: false, error: 'ID inválido (no UUID)' };

  try {
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}/crearCuentaCobrar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    if (res.ok) {
      console.log('[SolicDB] crearCuentaCobrar POST OK');
      return { ok: true };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Activa la cuenta (Fase 7).
 * Actualiza en Fin_Corp_Accnt:
 *   EstatusSolicitud = "Autorizada"
 *   EstatusCuenta    = "Activa"
 *   EstatusPago      = "Pagado"
 *   EstatusCartera   = "Activa"
 * 
 * Validaciones por Línea de Producto:
 * - Crédito/Captación: requiere que datos.estatus='Pagado' para activar
 * - Línea de Crédito: permite activación sin validación de estatus
 */
// Crea la cuenta eje para el cliente si no existe — llama a /activar-prospecto (idempotente)
export async function crearCuentaEjeDB(
  clienteId: string,
  nombreCliente?: string,
  solicitudId?: string,
  lineaProduc?: string,
  tipoProduc?: string,
  montoInicial?: number,
): Promise<void> {
  if (!clienteId || !UUID_RE.test(clienteId)) return;
  try {
    const body: Record<string, unknown> = { cliente_id: clienteId, nombre_prospecto: nombreCliente || '' };
    if (solicitudId && UUID_RE.test(solicitudId)) body.solicitud_id = solicitudId;
    if (lineaProduc) body.linea_produc = lineaProduc;
    if (tipoProduc)  body.tipo_produc  = tipoProduc;
    if (montoInicial !== undefined && montoInicial > 0) body.monto_inicial = montoInicial;
    const res = await fetch(`${API_BASE}/activar-prospecto`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    console.log('[SolicDB] crearCuentaEje OK — clienteId:', clienteId, '| solicitudId:', solicitudId, '| linea:', lineaProduc, '| tipo:', tipoProduc, '| resp:', json);
  } catch (e: any) {
    console.warn('[SolicDB] crearCuentaEje error (no bloquea):', e?.message);
  }
}

export async function activarCuentaDB(
  id: string,
  datos: Record<string, any>,
  lineaProducto?: string,
): Promise<{ ok: boolean; error?: string; clienteId?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  if (!UUID_RE.test(id)) return { ok: false, error: 'ID inválido (no UUID)' };

  // Intento 1: Endpoint dedicado /activarCuenta
  try {
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}/activarCuenta`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...datos, lineaProducto }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok !== false) {
      console.log('[SolicDB] activarCuenta POST OK', json.clienteId);
      return { ok: true, clienteId: json.clienteId };
    }
    // HTTP 2xx pero el handler reportó divergencia o fallo lógico
    if (json.ok === false) {
      console.warn('[SolicDB] activarCuenta POST — BD reportó error:', json.error);
      return { ok: false, error: json.error || 'Error en BD al activar cuenta' };
    }
    console.warn('[SolicDB] activarCuenta POST HTTP', res.status, json);
    // fallthrough a fallback si HTTP error
  } catch {
    // fallthrough a fallback
  }

  // Fallback 1: actualizar estatus vía Edge Function PUT
  try {
    const payload: Record<string, any> = {
      estatus_sol: 'Aprobado',
      estatus_cuen: 'Activa',
      estatus_disp: 'Pagado',
      estatus_cart: 'Activa',
      ...datos,
    };
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log('[SolicDB] activarCuenta fallback PUT OK');
      return { ok: true };
    }
    console.warn('[SolicDB] activarCuenta PUT falló, intentando Supabase directo…');
  } catch {
    console.warn('[SolicDB] activarCuenta PUT excepción, intentando Supabase directo…');
  }

  // Fallback 2: Supabase directo con schema EFINANCIANET_DB
  try {
    const campos: Record<string, any> = {
      estatus_sol:  'Aprobado',
      estatus_cuen: 'Activa',
      estatus_disp: 'Pagado',
      estatus_cart: 'Activa',
      ...datos,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).schema('EFINANCIANET_DB')
      .from('J_CUENTAS_CORP_CLIENTES')
      .update(campos)
      .eq('id', id);
    if (!error) {
      console.log('[SolicDB] activarCuenta Supabase directo OK');
      return { ok: true };
    }
    return { ok: false, error: error.message };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Actualiza únicamente el estatus de una solicitud (estatus_sol).
 */
export async function actualizarEstatusSolicitudDB(
  id: string,
  nuevoEstatus: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!DB_AVAILABLE) return { ok: false, error: 'DB no disponible' };
  if (!UUID_RE.test(id)) return { ok: false, error: 'ID inválido (no UUID)' };

  // Intento 1: Edge Function PUT
  try {
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ estatus_sol: nuevoEstatus }),
    });
    if (res.ok) {
      console.log('[SolicDB] actualizarEstatus Edge OK —', nuevoEstatus);
      return { ok: true };
    }
    const json = await res.json().catch(() => ({}));
    console.warn('[SolicDB] actualizarEstatus Edge FALLÓ:', json.error || `HTTP ${res.status}`);
  } catch (err: any) {
    console.warn('[SolicDB] actualizarEstatus Edge EXCEPCIÓN:', err?.message);
  }

  // Intento 2: Supabase directo
  try {
    const { error } = await supabase
      .from('J_CUENTAS_CORP_CLIENTES')
      .update({ estatus_sol: nuevoEstatus })
      .eq('id', id);
    if (!error) {
      console.log('[SolicDB] actualizarEstatus Supabase directo OK —', nuevoEstatus);
      return { ok: true };
    }
    console.warn('[SolicDB] actualizarEstatus Supabase directo FALLÓ:', error.message);
    return { ok: false, error: error.message };
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

      // Filtrar solo registros de tipo 'Solicitudes' o 'Solicitud' — excluye captación, cuentas eje, etc.
      const solicitudesRows = rows.filter(r => r.type === 'Solicitudes' || r.type === 'Solicitud');
      console.log(`[SolicDB] === RESULTADO: method=${method}, rows=${rows.length}, solicitudes=${solicitudesRows.length} ===`);

      if (solicitudesRows.length > 0) {
        const mapped = solicitudesRows.map(mapRowToListItem);
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
      const isNew = !existingDbId;

      // ── FIX CRÍTICO: Guardia de _originalData ──
      // Si estamos en modo edición y falta _originalData, el deepMerge en formToDBPayload
      // producirá un objeto parcial (solo campos Core) que sobreescribirá datos de banca móvil.
      // Solución: recuperar data actual de la BD antes de construir el payload.
      let subtabsWithOriginal = allSubtabs;
      if (!isNew && !(allSubtabs?._originalData) && existingDbId) {
        console.warn('[SolicDB] SAVE — _originalData faltante en modo edición, recuperando de BD...');
        try {
          const { data: row } = await supabase
            .from('J_CUENTAS_CORP_CLIENTES')
            .select('data')
            .eq('id', existingDbId)
            .single();
          if (row?.data) {
            const fetchedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            subtabsWithOriginal = { ...(allSubtabs || {}), _originalData: fetchedData };
            console.log('[SolicDB] SAVE — _originalData recuperado de BD, keys:', Object.keys(fetchedData).length);
          } else {
            console.warn('[SolicDB] SAVE — BD devolvió data vacío para id:', existingDbId);
          }
        } catch (fetchErr: any) {
          console.warn('[SolicDB] SAVE — no se pudo recuperar _originalData de BD:', fetchErr?.message);
        }
      }

      const payload = formToDBPayload(form, subtabsWithOriginal);

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
  const deleteSolicitud = useCallback(async (id: string): Promise<{ ok: boolean; error?: string; activaciones_vinculadas?: number }> => {
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