/**
 * useCarteraDB.ts — Gestión de Cartera / Módulo de Créditos
 */
import { useState, useCallback } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` };

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Amortizacion {
  id: string;
  solicitud_id: string;
  no_pago: number;
  fecha_pago: string;
  saldo_insoluto: number;
  pago_capital: number;
  pago_interes: number;
  iva_interes: number;
  pago_seguro: number;
  iva_seguro: number;
  pago_total: number;
  estatus: string; // 'Pendiente' | 'Facturada' | 'Pagada' | 'Cancelado'
}

export interface Factura {
  id: string;
  solicitud_id: string;
  amortiza_id: string | null;
  gobierno_id: string | null;
  no_docto: string;
  fecha: string;
  tipo: string;
  categoria?: string | null;
  cliente: string;
  fecha_compromiso: string | null;
  forma_pago: string | null;
  institucion_financiera: string | null;
  cuenta_bancaria: string | null;
  referencia: string | null;
  monto_transaccion: number;
  moneda: string;
  estatus: string;
}

export interface FacturaDetalle {
  id: string;
  factura_id: string;
  cve_subproducto: string;
  desc_subproducto: string;
  cantidad: number;
  monto: number;
  pct_impuesto: number;
  moneda: string;
  subtotal: number;
  estatus: string;
}

export interface Pago {
  id: string;
  solicitud_id?: string | null;
  factura_id: string | null;
  detalle_linea_id?: string | null;
  fecha_pago: string;
  monto: number;
  concepto: string | null;
  forma_pago?: string | null;
  referencia?: string | null;
  estatus: string;
}

export interface TipoSolicitudExt {
  id: string;
  clave: string;
  nombre: string;
  area: string | null;
  puesto: string | null;
  prompt_ia: string | null;
  estatus: string;
}

export interface SolicitudExt {
  id: string;
  solicitud_id: string;
  tipo_id: string;
  tipo_nombre?: string;
  tipo_clave?: string;
  fecha: string;
  usuario: string;
  estatus: string;
  notas: string | null;
  usuario_autoriza?: string | null;
  fecha_autoriza?: string | null;
  comentario_aprobador?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const parseMon = (v: unknown): number => {
  if (v == null) return 0;
  return parseFloat(String(v).replace(/[$,\s]/g, '')) || 0;
};

export function formatMoney(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.split('T')[0].split('-');
  if (d.length === 3) return `${d[2]}/${d[1]}/${d[0]}`;
  return iso;
}

// ─── Amortizaciones ─────────────────────────────────────────────────────────

export function useAmortizaciones(solicitudId: string) {
  const [rows, setRows] = useState<Amortizacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!solicitudId) return;
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/cartera/amortizaciones/${solicitudId}`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows((json.data || []).map((r: any) => ({
        ...r,
        saldo_insoluto: parseMon(r.saldo_insoluto),
        pago_capital:   parseMon(r.pago_capital),
        pago_interes:   parseMon(r.pago_interes),
        iva_interes:    parseMon(r.iva_interes),
        pago_seguro:    parseMon(r.pago_seguro),
        iva_seguro:     parseMon(r.iva_seguro),
        pago_total:     parseMon(r.pago_total),
      })));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [solicitudId]);

  return { rows, loading, error, refetch: fetch };
}

// ─── Avisos de Vencimiento ───────────────────────────────────────────────────

export function useAvisos(solicitudId: string) {
  const [rows, setRows] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!solicitudId) return;
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/cartera/avisos/${solicitudId}`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows((json.data || []).map((r: any) => ({ ...r, monto_transaccion: parseMon(r.monto_transaccion) })));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [solicitudId]);

  return { rows, loading, error, refetch: fetch };
}

// ─── Pagos ───────────────────────────────────────────────────────────────────

export function usePagos(solicitudId: string) {
  const [rows, setRows] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!solicitudId) return;
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/cartera/pagos/${solicitudId}`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows((json.data || []).map((r: any) => ({ ...r, monto: parseMon(r.monto) })));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [solicitudId]);

  return { rows, loading, error, refetch: fetch };
}

// ─── Tipos de Solicitudes Extraordinarias ────────────────────────────────────

export async function fetchTiposSolicitudesExt(): Promise<TipoSolicitudExt[]> {
  try {
    const res = await window.fetch(`${API_BASE}/cartera/tipos-solicitudes-ext`, { headers: HDR });
    const json = await res.json();
    return json.data || [];
  } catch { return []; }
}

// ─── Solicitudes Extraordinarias ─────────────────────────────────────────────

export function useSolicitudesExt(solicitudId: string) {
  const [rows, setRows] = useState<SolicitudExt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!solicitudId) return;
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/cartera/solicitudes-ext/${solicitudId}`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows(json.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [solicitudId]);

  return { rows, loading, error, refetch: fetch };
}

export function useAllSolicitudesExt() {
  const [rows, setRows] = useState<SolicitudExt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/cartera/solicitudes-ext`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows(json.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  return { rows, loading, error, refetch: fetch };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function fetchMontoAut(solicitudId: string): Promise<{ monto_aut: number; monto_sol: number } | null> {
  try {
    const res = await window.fetch(`${API_BASE}/cartera/credito/${solicitudId}/monto`, { headers: HDR });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function crearAvisoVencimiento(payload: {
  solicitud_id: string;
  amortizaciones: Amortizacion[];
  sub_tipo?: string;
  cliente: string;
  forma_pago?: string;
  fecha_compromiso?: string;
  moneda?: string;
  institucion_financiera?: string;
  cuenta_bancaria?: string;
  referencia?: string;
}): Promise<{ ok: boolean; error?: string; factura_id?: string }> {
  try {
    const res = await window.fetch(`${API_BASE}/cartera/facturas`, {
      method: 'POST', headers: HDR, body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true, factura_id: json.id };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

// ─── Arrendamiento: facturas del ciclo (Fases 4 y 5) ─────────────────────────

/**
 * sub_tipo de las facturas de Arrendamiento Puro en Cobranza.
 * Separado de 'Amortizacion' (crédito) y 'Aportacion' (captación) para que
 * cada panel de CobranzaModule liste lo suyo.
 */
export const SUB_TIPO_ARRENDAMIENTO = 'Arrendamiento';

/** Concepto de una factura de arrendamiento, tal como se guarda en el detalle de Cobranza. */
export interface ConceptoCobranza {
  cve: string;
  desc: string;
  monto: number;
}

/**
 * Da de alta en Cobranza (Avisos de Vencimiento — Créditos) una factura del
 * ciclo de arrendamiento.
 *
 * Usa el mismo POST /cartera/facturas que el resto de la cartera, enviando una
 * sola "amortización" que transporta los conceptos propios del arrendamiento
 * (Enganche, Comisión, Rentas anticipadas o los conceptos del CFDI). El
 * backend crea una línea de J_FACTURAS_DETALLE por concepto.
 */
export async function crearFacturaArrendamientoCobranza(payload: {
  solicitud_id: string;
  cliente: string;
  conceptos: ConceptoCobranza[];
  total: number;
  fecha_compromiso?: string;
  referencia?: string;
  moneda?: string;
  /**
   * 'Por Cobrar' (default): el cliente le paga a la institución — Pago Inicial.
   * 'Por Pagar': la institución le paga a la contraparte — cuenta al proveedor
   * del bien.
   */
  tipo?: 'Por Cobrar' | 'Por Pagar';
  forma_pago?: string;
}): Promise<{ ok: boolean; error?: string; factura_id?: string; no_docto?: string }> {
  const { solicitud_id, cliente, conceptos, total, fecha_compromiso, referencia, moneda = 'MXN', tipo = 'Por Cobrar', forma_pago } = payload;

  if (!conceptos.length) return { ok: false, error: 'La factura no tiene conceptos con monto mayor a cero' };

  try {
    const res = await window.fetch(`${API_BASE}/cartera/facturas`, {
      method: 'POST',
      headers: HDR,
      body: JSON.stringify({
        solicitud_id,
        tipo,
        // sub_tipo propio: el panel "Facturación — Arrendamiento Puro" de Cobranza
        // filtra por él, para que estas facturas no se mezclen con las
        // amortizaciones de crédito del panel de Créditos.
        sub_tipo: SUB_TIPO_ARRENDAMIENTO,
        cliente,
        moneda,
        forma_pago: forma_pago || null,
        referencia: referencia || null,
        fecha_compromiso: fecha_compromiso || null,
        amortizaciones: [{
          id: `arr-${Date.now()}`,
          fecha_pago: fecha_compromiso || null,
          pago_total: total,
          conceptos,
        }],
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true, factura_id: json.id, no_docto: json.no_docto };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * Lee el estatus real de una factura en Cobranza.
 *
 * La Fase 6 no puede confiar en la copia guardada en data.solicitud.facturas:
 * el pago se aplica desde Cobranza (PATCH /cartera/facturas/:id/pagar) y ese
 * cambio no vuelve solo a la solicitud.
 */
export async function fetchEstatusFacturaCobranza(
  facturaId: string,
): Promise<{ ok: boolean; estatus?: string; noDocto?: string; monto?: number; error?: string }> {
  try {
    const res = await window.fetch(`${API_BASE}/cartera/cobranza?sub_tipo=${SUB_TIPO_ARRENDAMIENTO}`, { headers: HDR });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };

    const row = (json.data || []).find((r: any) => String(r.id) === String(facturaId));
    if (!row) return { ok: false, error: 'La factura ya no existe en Cobranza' };

    return {
      ok: true,
      estatus: row.estatus,
      noDocto: row.numero_documento || row.no_docto,
      monto: Number.parseFloat(String(row.monto_transaccion || '0').replace(/[$,\s]/g, '')) || 0,
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function crearSolicitudExt(payload: {
  solicitud_id: string;
  tipo_id: string;
  usuario: string;
  notas?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const res = await window.fetch(`${API_BASE}/cartera/solicitudes-ext`, {
      method: 'POST', headers: HDR, body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true, id: json.id };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

export async function actualizarSolicitudExt(
  id: string,
  estatus: 'Autorizada' | 'Rechazada',
  usuario: string,
  comentario?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await window.fetch(`${API_BASE}/cartera/solicitudes-ext/${id}`, {
      method: 'PUT',
      headers: HDR,
      body: JSON.stringify({
        estatus,
        usuario_autoriza: usuario,
        fecha_autoriza: new Date().toISOString(),
        comentario_aprobador: comentario || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) { return { ok: false, error: e.message }; }
}
