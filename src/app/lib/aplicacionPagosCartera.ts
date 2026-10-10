/**
 * aplicacionPagosCartera — Aplicación de Pagos de la Cartera de Crédito
 * Individual (portado de la rama Producto-TDC-FINAL, `aplicarPagoReferenciado`).
 *
 * El motor (`motorAplicacionPagos`) decide CUÁNTO va a cada línea; aquí se
 * reúnen sus entradas y se persiste el resultado en una sola llamada al
 * servidor (POST /cartera/aplicar-pago), que lo escribe en una transacción.
 *
 * Entradas:
 *   - Avisos de Vencimiento del crédito  → J_FACTURAS + J_FACTURAS_DETALLE
 *   - Lo ya pagado de cada línea         → J_PAGOS (factura_detalle_id)
 *   - Prelación                          → pestaña "Prelación de cargos" del producto
 *   - Saldo de la Cuenta EJE del cliente → J_CUENTAS_CORP_CLIENTES
 */
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { repararDataSolicitud } from './repararDataSolicitud';
import { aplicarPago, money, type DocumentoCxC, type ResultadoAplicacionPago } from './motorAplicacionPagos';
import { mapaPrelacion, ordenDe, type FilaPrelacion } from './prelacionCargos';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const fecha = (v: unknown): string => {
  const s = String(v ?? '');
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s.slice(0, 10);
};

/** "Prelación de cargos" del producto (Taller de Productos). */
export async function cargarPrelacionProducto(productoId: string): Promise<FilaPrelacion[]> {
  if (!productoId) return [];
  try {
    const res = await fetch(`${API_BASE}/productos/${productoId}`, { headers: HDR });
    if (!res.ok) return [];
    const json = await res.json();
    const fila = json?.data ?? json;
    const data = repararDataSolicitud(fila?.data ?? fila) || {};
    const p = data.prelacion ?? data.prelacionCargos;
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** Cuenta EJE del cliente y su saldo (punto de partida del motor). */
export async function cuentaEjeConSaldo(clienteId: string): Promise<{ id: string | null; noCuenta: string; saldo: number }> {
  if (!clienteId) return { id: null, noCuenta: '', saldo: 0 };
  try {
    const res = await fetch(`${API_BASE}/cuentas-ahorro`, { headers: HDR });
    if (!res.ok) return { id: null, noCuenta: '', saldo: 0 };
    const json = await res.json();
    const filas: any[] = Array.isArray(json) ? json : (json?.data || []);
    const delCliente = filas.filter(c => String(c.cliente_id || c.cliente_id_eff || '') === clienteId);
    const eje = delCliente.find(c => c.cta_eje_chec === true || c.cta_eje_chec === 't' || c.cta_eje_chec === 'true')
      || delCliente.find(c => /^(AUTO|CEJE)-/i.test(String(c.no_sol || '')));
    if (!eje) return { id: null, noCuenta: '', saldo: 0 };
    return { id: String(eje.id), noCuenta: String(eje.no_cuenta || ''), saldo: num(eje.saldo_actual) };
  } catch {
    return { id: null, noCuenta: '', saldo: 0 };
  }
}

/**
 * Folio único para un pago nuevo: PAG-<crédito>-<aaaammdd>-<hhmmss>.
 * Es el identificador del pago (no la referencia de la cuenta, que se repite
 * en cada pago del mismo crédito): con él se evita aplicar dos veces lo mismo.
 */
export function generarReferenciaPago(noSol: string, ahora = new Date()): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  const corto = String(noSol || 'CRED').replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase() || 'CRED';
  return `PAG-${corto}-${ahora.getFullYear()}${p2(ahora.getMonth() + 1)}${p2(ahora.getDate())}-${p2(ahora.getHours())}${p2(ahora.getMinutes())}${p2(ahora.getSeconds())}`;
}

/** Referencias de pago ya registradas en el crédito (J_PAGOS), en minúsculas. */
export async function referenciasUsadas(solicitudId: string): Promise<Set<string>> {
  const usadas = new Set<string>();
  if (!solicitudId) return usadas;
  try {
    const res = await fetch(`${API_BASE}/cartera/pagos/${solicitudId}`, { headers: HDR });
    const json = await res.json().catch(() => ({}));
    for (const p of (Array.isArray(json?.data) ? json.data : [])) {
      // Sólo los pagos aplicados a avisos (J_PAGOS); los movimientos JSONB no traen factura.
      if (p?.factura_id && p?.referencia) usadas.add(String(p.referencia).trim().toLowerCase());
    }
  } catch { /* sin lista: el servidor sigue validando la duplicidad */ }
  return usadas;
}

export interface AvisosCargados {
  documentos: DocumentoCxC[];
  ok: boolean;
  error?: string;
}

/**
 * Avisos del crédito que aún pueden recibir pago, con lo ya pagado por línea y
 * la prelación del producto en cada línea.
 */
export async function cargarAvisosPagables(solicitudId: string, prelacion: FilaPrelacion[]): Promise<AvisosCargados> {
  if (!solicitudId) return { documentos: [], ok: false, error: 'No se recibió el crédito.' };
  try {
    const [rAv, rPg] = await Promise.all([
      fetch(`${API_BASE}/cartera/avisos/${solicitudId}`, { headers: HDR }),
      fetch(`${API_BASE}/cartera/pagos/${solicitudId}`, { headers: HDR }),
    ]);
    const jAv = await rAv.json().catch(() => ({}));
    const jPg = await rPg.json().catch(() => ({}));
    if (!rAv.ok) return { documentos: [], ok: false, error: jAv?.error || `HTTP ${rAv.status}` };

    // Lo pagado por línea de detalle.
    const pagadoPorLinea = new Map<string, number>();
    for (const p of (Array.isArray(jPg?.data) ? jPg.data : [])) {
      if (p?.detalle_linea_id == null || String(p?.estatus || '') === 'Cancelado') continue;
      const k = String(p.detalle_linea_id);
      pagadoPorLinea.set(k, money((pagadoPorLinea.get(k) || 0) + num(p.monto)));
    }

    const avisos: any[] = (Array.isArray(jAv?.data) ? jAv.data : []).filter((a: any) => {
      const est = String(a?.estatus || '');
      return String(a?.tipo || 'Por Cobrar') !== 'Por Pagar' && !['Pagado', 'Pagada', 'Cancelado', 'Cancelada'].includes(est);
    });

    const mapa = mapaPrelacion(prelacion);
    const documentos: DocumentoCxC[] = [];
    for (const a of avisos) {
      const rDet = await fetch(`${API_BASE}/cartera/facturas/${a.id}/detalle`, { headers: HDR });
      const jDet = await rDet.json().catch(() => ({}));
      if (!rDet.ok || jDet?.ok === false) {
        return { documentos: [], ok: false, error: `No se pudo leer el detalle del aviso ${a.no_docto || a.id}.` };
      }
      const lineas: any[] = Array.isArray(jDet?.detalle) ? jDet.detalle : [];
      const detalle = lineas.map(l => ({
        id: String(l.id),
        claveConcepto: String(l.cve_subproducto || ''),
        nombreConcepto: String(l.descripcion_subproducto || l.cve_subproducto || ''),
        monto: num(l.monto),
        pagoTotal: pagadoPorLinea.get(String(l.id)) || 0,
        ordenPrelacion: ordenDe(String(l.cve_subproducto || ''), mapa),
      }));
      // Aviso sin desglose: una sola línea por el total (se paga como bloque).
      const conDetalle = detalle.length > 0 ? detalle : [{
        id: `sin-detalle-${a.id}`, claveConcepto: 'TOTAL', nombreConcepto: 'Total del aviso',
        monto: num(a.monto_transaccion), pagoTotal: 0, ordenPrelacion: 1,
      }];
      documentos.push({
        id: String(a.id),
        folio: a.no_docto || undefined,
        idContrato: solicitudId,
        fechaVencimiento: fecha(a.fecha_compromiso || a.fecha),
        fechaDocumento: fecha(a.fecha),
        montoTotalPagar: money(conDetalle.reduce((s, d) => s + d.monto, 0)),
        pagoTotal: money(conDetalle.reduce((s, d) => s + d.pagoTotal, 0)),
        estatus: a.estatus || 'Pendiente',
        detalle: conDetalle,
      });
    }
    return { documentos, ok: true };
  } catch (e: any) {
    return { documentos: [], ok: false, error: e?.message || 'Error al leer los avisos.' };
  }
}

export interface ResultadoAplicacionCredito {
  ok: boolean;
  error?: string;
  motor: ResultadoAplicacionPago;
  persistido: boolean;
  yaAplicado?: boolean;
}

/**
 * Corre el motor con datos frescos y, si cuadra, lo persiste en una transacción.
 * El pago se abona a la Cuenta EJE; de ahí sale (Cargo) lo aplicado a los
 * avisos; el remanente se queda en la EJE.
 */
export async function aplicarPagoCredito(params: {
  solicitudId: string;
  clienteId: string;
  productoId: string;
  referencia: string;
  montoPago: number;
  fechaPago: string;
  noSol?: string;
}): Promise<ResultadoAplicacionCredito> {
  const prelacion = await cargarPrelacionProducto(params.productoId);
  const [eje, avisos] = await Promise.all([
    cuentaEjeConSaldo(params.clienteId),
    cargarAvisosPagables(params.solicitudId, prelacion),
  ]);

  const motor = aplicarPago({
    montoPago: params.montoPago,
    saldoEjeAnterior: eje.saldo,
    documentos: avisos.documentos,
    idCuentaEje: eje.id,
    idCliente: params.clienteId,
    idPagoReferenciado: params.referencia,
  });
  if (!motor.ok) return { ok: false, error: motor.error, motor, persistido: false };
  if (motor.descuadres.length > 0) return { ok: false, error: motor.descuadres.join(' '), motor, persistido: false };
  if (!avisos.ok) return { ok: false, error: avisos.error, motor, persistido: false };
  if (motor.aplicacionesDetalle.some(a => a.idDetalle.startsWith('sin-detalle-'))) {
    return { ok: false, error: 'Hay avisos sin desglose de conceptos: no se pueden aplicar por prelación.', motor, persistido: false };
  }

  try {
    const res = await fetch(`${API_BASE}/cartera/aplicar-pago`, {
      method: 'POST',
      headers: HDR,
      body: JSON.stringify({
        solicitud_id: params.solicitudId,
        cliente_id: params.clienteId,
        cuenta_eje_id: eje.id,
        referencia: params.referencia,
        fecha_pago: params.fechaPago,
        monto_pago: money(params.montoPago),
        monto_total_aplicado: motor.montoTotalAplicado,
        no_sol: params.noSol || '',
        aplicaciones: motor.aplicacionesDetalle.map(a => ({
          factura_id: a.idCxC,
          detalle_id: a.idDetalle,
          cve: a.claveConcepto,
          monto: a.montoAplicado,
          estatus: a.estatusPagoNuevo,
        })),
        facturas: motor.aplicacionesCxC.map(c => ({ factura_id: c.idCxC, estatus: c.estatusNuevo })),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 404) {
      return { ok: false, motor, persistido: false, error: 'El servidor aún no tiene la Aplicación de Pagos (falta desplegar la Edge Function).' };
    }
    if (!res.ok || json?.ok === false) return { ok: false, motor, persistido: false, error: json?.error || `HTTP ${res.status}` };
    return { ok: true, motor, persistido: true, yaAplicado: json?.ya_aplicado === true };
  } catch (e: any) {
    return { ok: false, motor, persistido: false, error: e?.message || 'Error desconocido.' };
  }
}
