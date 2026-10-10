/**
 * aplicarPagoReferenciado — capa transaccional de la ESPECIFICACIÓN 4.
 *
 * El motor (`motorAplicacionPagosTDC`) decide CUÁNTO va a cada línea; este
 * módulo lo persiste todo en UNA llamada a `aplicar_pago_referenciado`, que
 * corre dentro de una transacción de Postgres (§50, §51, §52).
 *
 * Es el tercer gemelo de `aplicarMovimientoTDC` y `aplicarCierreCorteTDC`, y
 * existe por la misma razón: §52 prohíbe que RegistrarAbonoCuentaEje,
 * AplicarPagoCxC, AplicarPagoDetail y RegistrarAbonoContrato hagan commits
 * independientes.
 *
 * ── Cómo se llega del pago al cliente (§2, §58.2) ────────────────────────
 * No se inventa un campo: se usa la misma cadena que ya emplea el módulo de
 * Pagos Referenciados — `referencia` → cuenta en J_CUENTAS_CORP_CLIENTES →
 * `cliente_id` — y de ahí la Cuenta EJE con `buscarCuentaEje`.
 */
import { supabase } from './supabaseClient';
import { buscarCuentaEje } from '../hooks/useCuentaEjeGenerator';
import {
  aplicarPago,
  type DocumentoCxC,
  type ResultadoAplicacionPago,
} from './motorAplicacionPagosTDC';

/** Fila que devuelve `obtener_cxc_pagables`. */
interface FilaCxC {
  id: string;
  folio: string | null;
  contrato_id: string | null;
  fecha_vencimiento: string | null;
  fecha_documento: string | null;
  monto_total_pagar: string | number | null;
  pago_total: string | number | null;
  estatus: string | null;
  detalle: any;
}

export interface CxCCargadas {
  documentos: DocumentoCxC[];
  desdeBD: boolean;
  error?: string;
}

/**
 * §6/§6.1 — CxC del cliente susceptibles de recibir pago.
 * No filtra ni ordena aquí: eso es decisión del motor (§7, §9).
 */
export async function cargarCxCPagables(idCliente: string): Promise<CxCCargadas> {
  if (!idCliente) return { documentos: [], desdeBD: false, error: 'No se recibió el cliente.' };
  try {
    const { data, error } = await supabase.rpc('obtener_cxc_pagables', { p_cliente_id: idCliente });
    if (error) return { documentos: [], desdeBD: false, error: traducirErrorPago(error.message || String(error)) };

    const filas: FilaCxC[] = Array.isArray(data) ? data : [];
    return {
      desdeBD: true,
      documentos: filas.map(f => ({
        id: f.id,
        folio: f.folio || undefined,
        idContrato: f.contrato_id || '',
        fechaVencimiento: String(f.fecha_vencimiento || '').slice(0, 10),
        fechaDocumento: String(f.fecha_documento || '').slice(0, 10),
        montoTotalPagar: Number(f.monto_total_pagar) || 0,
        pagoTotal: Number(f.pago_total) || 0,
        estatus: f.estatus || 'Pendiente',
        detalle: (Array.isArray(f.detalle) ? f.detalle : []).map((d: any) => ({
          id: String(d.id),
          claveConcepto: d.claveConcepto || '',
          nombreConcepto: d.nombreConcepto || '',
          monto: Number(d.monto) || 0,
          pagoTotal: Number(d.pagoTotal) || 0,
          ordenPrelacion: Number(d.ordenPrelacion) || 0,
          estatusPago: d.estatusPago,
        })),
      })),
    };
  } catch (e: any) {
    return { documentos: [], desdeBD: false, error: traducirErrorPago(e?.message || 'Error al leer las CxC.') };
  }
}

/** Saldo actual de la Cuenta EJE — el punto de partida de §24. */
export async function saldoCuentaEje(idCliente: string): Promise<{ id: string | null; saldo: number }> {
  const cuenta = await buscarCuentaEje(idCliente);
  if (!cuenta) return { id: null, saldo: 0 };
  const bruto = String((cuenta as any).saldo_actual ?? '0').replace(/[^0-9.-]/g, '');
  return { id: String(cuenta.id), saldo: parseFloat(bruto) || 0 };
}

export interface ResultadoAplicacion {
  ok: boolean;
  error?: string;
  /** Plan del motor: sirve para pintar el desglose aunque no se persista. */
  motor: ResultadoAplicacionPago;
  persistido: boolean;
  procesoId?: string;
  montoTotalAplicado?: number;
  saldoEjePosterior?: number;
}

/**
 * Corre el motor y, si aprueba, persiste TODO en una transacción.
 *
 * @param soloSimular sólo calcula, no escribe: la vista previa de §55.
 */
export async function aplicarPagoReferenciado(params: {
  idPagoReferenciado: string;
  referenciaPago?: string;
  idCliente: string;
  montoPago: number;
  fechaPago: string;
  /** §31 — clave parametrizada del movimiento en Cuenta EJE. */
  claveCargoEje?: string;
  usuario?: string;
  correlationId?: string;
  soloSimular?: boolean;
}): Promise<ResultadoAplicacion> {
  const { idPagoReferenciado, idCliente, montoPago, fechaPago, soloSimular } = params;

  // §3 — la Cuenta EJE se resuelve por la relación del modelo, no se asume.
  const eje = await saldoCuentaEje(idCliente);
  const cxc = await cargarCxCPagables(idCliente);

  const motor = aplicarPago({
    montoPago,
    saldoEjeAnterior: eje.saldo,
    documentos: cxc.documentos,
    idCuentaEje: eje.id,
    idCliente,
    idPagoReferenciado,
  });

  if (!motor.ok) {
    return { ok: false, error: motor.error, motor, persistido: false };
  }
  // §48/§49 — si el plan no cuadra no se intenta escribir nada.
  if (motor.descuadres.length > 0) {
    return { ok: false, error: motor.descuadres.join(' '), motor, persistido: false };
  }
  // Leer las CxC falló: aplicar con una lista incompleta dejaría pagos sin
  // aplicar y el dinero "perdido" en la EJE sin explicación.
  if (!cxc.desdeBD) {
    return { ok: false, error: cxc.error || 'No se pudieron leer las CxC del cliente.', motor, persistido: false };
  }
  if (soloSimular) {
    return { ok: true, motor, persistido: false };
  }

  // §45 — dos envíos del mismo pago comparten el id y el segundo no duplica.
  const correlationId = params.correlationId || `pago|${idPagoReferenciado}`;

  try {
    const { data, error } = await supabase.rpc('aplicar_pago_referenciado', {
      p_pago_referenciado_id: idPagoReferenciado,
      p_referencia_pago: params.referenciaPago || null,
      p_cliente_id: idCliente,
      p_cuenta_eje_id: eje.id,
      p_monto_pago: montoPago,
      p_fecha_pago: fechaPago,
      p_aplic_detalle: motor.aplicacionesDetalle,
      p_aplic_cxc: motor.aplicacionesCxC,
      p_abonos: motor.abonosPorContrato,
      p_clave_cargo_eje: params.claveCargoEje || null,
      p_usuario: params.usuario || 'Sistema',
      p_correlation_id: correlationId,
    });

    if (error) {
      // §51 — el RPC hizo ROLLBACK: nada quedó a medias.
      return { ok: false, error: traducirErrorPago(error.message || String(error)), motor, persistido: false };
    }

    const fila = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      motor,
      persistido: true,
      procesoId: fila?.proceso_id,
      montoTotalAplicado: fila?.monto_total_aplicado != null ? Number(fila.monto_total_aplicado) : motor.montoTotalAplicado,
      saldoEjePosterior: fila?.saldo_eje_posterior != null ? Number(fila.saldo_eje_posterior) : motor.saldoEjePosterior,
    };
  } catch (e: any) {
    return { ok: false, error: traducirErrorPago(e?.message || 'Error desconocido.'), motor, persistido: false };
  }
}

function traducirErrorPago(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('could not find the function') || m.includes('42883') || m.includes('pgrst202')) {
    return (
      'Las funciones de Aplicación de Pagos no existen en la base de datos. ' +
      'Ejecute supabase/migrations/create_rpc_aplicacion_pagos_tdc.sql (después de las dos anteriores).'
    );
  }
  if (m.includes('ux_proc_aplic_pago_ref') || m.includes('duplicate key')) {
    return 'Este pago ya había sido aplicado. No se duplicó.';
  }
  if (m.includes('cambió de saldo durante el proceso')) {
    return 'Otro proceso modificó estas cuentas por cobrar mientras se aplicaba el pago. No se aplicó nada; vuelva a intentarlo.';
  }
  if (m.includes('cuenta eje')) return msg;
  return `No se pudo aplicar el pago: ${msg}`;
}
