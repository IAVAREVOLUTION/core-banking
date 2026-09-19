/**
 * avisosTDC — lectura de los Avisos de Vencimiento / CxC de Tarjeta de Crédito.
 *
 * Los genera el Cierre de Corte (ESPECIFICACIÓN 3) en `J_CXC_LINEA`. Esta capa
 * los entrega a las dos pantallas que los consultan: el subtab "Avisos de
 * Vencimiento" de una Línea y el submódulo "Avisos TDC" de Cobranza.
 *
 * ── Por qué no reusa `cargarCxCPagables` ─────────────────────────────────
 * Aquélla sirve para APLICAR pagos: descarta lo ya pagado, porque el motor
 * sólo necesita lo que puede recibir dinero. Para consultar hace falta ver
 * todo, incluido lo pagado y lo reclasificado.
 */
import { supabase } from './supabaseClient';

/** Una línea del Aviso, con la prelación que congeló el Corte. */
export interface DetalleAvisoTDC {
  id: string;
  claveConcepto: string;
  nombreConcepto: string;
  monto: number;
  pagoTotal: number;
  saldoPendiente: number;
  fechaCargo: string;
  naturaleza: string;
  ordenPrelacion: number;
  bFactura: string;
  estatusPago: string;
  cargoId?: string;
}

export interface AvisoTDC {
  id: string;
  folio: string;
  lineaId: string;
  clienteId: string;
  solicitudId?: string;
  productoId?: string;
  fechaInicio: string;
  fechaFin: string;
  /** §17 — es la fecha de CORTE, igual a fechaFin del periodo. */
  fechaDocumento: string;
  /** La Fecha Límite de Pago. No confundir con la anterior. */
  fechaVencimiento: string;
  montoTotalPagar: number;
  montoMinimoPagar: number;
  pagoTotal: number;
  saldoPendiente: number;
  cantidadCargos: number;
  moneda: string;
  estatus: string;
  fechaUltimoPago?: string;
  contabilizado: boolean;
  polizaId?: string;
  creadoEn?: string;
  detalle: DetalleAvisoTDC[];
}

export interface ResultadoAvisos {
  ok: boolean;
  avisos: AvisoTDC[];
  error?: string;
}

const num = (v: unknown): number => Number(v) || 0;
const fecha = (v: unknown): string => String(v ?? '').slice(0, 10);

/**
 * @param lineaId   filtra por Línea de Crédito (subtab de una cuenta).
 * @param clienteId filtra por cliente.
 * Sin ninguno de los dos devuelve todos — el listado de Cobranza.
 */
export async function cargarAvisosTDC(params: {
  lineaId?: string;
  clienteId?: string;
} = {}): Promise<ResultadoAvisos> {
  try {
    const { data, error } = await supabase.rpc('obtener_avisos_tdc', {
      p_linea_id: params.lineaId || null,
      p_cliente_id: params.clienteId || null,
    });
    if (error) return { ok: false, avisos: [], error: traducirError(error.message || String(error)) };

    const filas: any[] = Array.isArray(data) ? data : [];
    return {
      ok: true,
      avisos: filas.map(f => ({
        id: String(f.id),
        folio: f.folio || '',
        lineaId: f.linea_id || '',
        clienteId: f.cliente_id || '',
        solicitudId: f.solicitud_id || undefined,
        productoId: f.producto_id || undefined,
        fechaInicio: fecha(f.fecha_inicio),
        fechaFin: fecha(f.fecha_fin),
        fechaDocumento: fecha(f.fecha_documento),
        fechaVencimiento: fecha(f.fecha_vencimiento),
        montoTotalPagar: num(f.monto_total_pagar),
        montoMinimoPagar: num(f.monto_minimo_pagar),
        pagoTotal: num(f.pago_total),
        saldoPendiente: num(f.saldo_pendiente),
        cantidadCargos: num(f.cantidad_cargos),
        moneda: f.moneda || 'MXN',
        estatus: f.estatus || 'Pendiente',
        fechaUltimoPago: f.fecha_ultimo_pago ? fecha(f.fecha_ultimo_pago) : undefined,
        contabilizado: f.contabilizado === true,
        polizaId: f.poliza_id || undefined,
        creadoEn: f.creado_en || undefined,
        detalle: (Array.isArray(f.detalle) ? f.detalle : []).map((d: any) => ({
          id: String(d.id),
          claveConcepto: d.claveConcepto || '',
          nombreConcepto: d.nombreConcepto || '',
          monto: num(d.monto),
          pagoTotal: num(d.pagoTotal),
          saldoPendiente: num(d.saldoPendiente),
          fechaCargo: fecha(d.fechaCargo),
          naturaleza: d.naturaleza || 'Cargo',
          ordenPrelacion: num(d.ordenPrelacion),
          bFactura: d.bFactura || 'N',
          estatusPago: d.estatusPago || 'Pendiente',
          cargoId: d.cargoId || undefined,
        })),
      })),
    };
  } catch (e: any) {
    return { ok: false, avisos: [], error: traducirError(e?.message || 'Error desconocido.') };
  }
}

/** Un aviso está vencido si pasó su fecha límite y aún debe. */
export function estaVencido(a: AvisoTDC, hoy = new Date()): boolean {
  if (a.saldoPendiente <= 0) return false;
  if (['Pagada', 'Pagado', 'Cancelada', 'Reclasificada'].includes(a.estatus)) return false;
  const v = new Date(`${a.fechaVencimiento}T23:59:59`);
  return !isNaN(v.getTime()) && v.getTime() < hoy.getTime();
}

function traducirError(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('could not find the function') || m.includes('42883') || m.includes('pgrst202')) {
    return (
      'La función obtener_avisos_tdc no existe en la base de datos. ' +
      'Ejecute supabase/migrations/create_rpc_avisos_tdc.sql.'
    );
  }
  return `No se pudieron consultar los avisos: ${msg}`;
}
