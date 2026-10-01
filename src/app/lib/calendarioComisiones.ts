/**
 * calendarioComisiones.ts — calendario de comisiones de la Línea Global (GPO)
 * y de la SubLínea de Carta de Crédito. Una sola implementación para la
 * Cotización manual (SimulacionTab) y la automática (activación de una
 * SubLínea Automática desde Disposiciones), para que den lo mismo.
 *
 *   Monto a cotizar (comisión anual) = Monto Garantizado × % Comisión
 *   Comisión por cobro               = Monto a cotizar ÷ cobros al año de la Periodicidad
 *   IVA                              = % IVA (16 por defecto)
 */
import { fechasCobroComision } from './fechasComisionGPO';
import { diasDeFrecuencia } from './fechasPlazo';

/** Cobros por año de cada Periodicidad Cobro Comisión. */
export const COBROS_POR_ANIO: Record<string, number> = {
  Semanal: 52, Catorcenal: 26, Quincenal: 24, Mensual: 12, Bimestral: 6,
  Trimestral: 4, Semestral: 2, Anual: 1,
};

export interface RenglonComision {
  noPago: number;
  fechaPago: string;
  saldoInsoluto: number;
  pagoCapital: number;
  pagoInteres: number;
  ivaInteres: number;
  pagoPeriodo: number;
  pagoSeguro: number;
  pagoTotal: number;
}

export function construirCalendarioComisiones(p: {
  montoGarantizado: number;
  porcentajeComision: number;
  cobrosPorAnio: number;
  totalPeriodos: number;
  ancla: string;
  ivaPct?: number;
}): RenglonComision[] {
  if (!(p.montoGarantizado > 0) || !(p.porcentajeComision > 0) || !(p.cobrosPorAnio > 0) || !(p.totalPeriodos > 0)) return [];
  const ivaPct = p.ivaPct ?? 16;
  const porCobro = (p.montoGarantizado * (p.porcentajeComision / 100)) / p.cobrosPorAnio;
  const iva = porCobro * (ivaPct / 100);
  return fechasCobroComision(p.totalPeriodos, p.cobrosPorAnio, p.ancla).map((fechaPago, i) => ({
    noPago: i + 1,
    fechaPago,
    saldoInsoluto: p.montoGarantizado,
    pagoCapital: 0,
    pagoInteres: porCobro,
    ivaInteres: iva,
    pagoPeriodo: porCobro,
    pagoSeguro: 0,
    pagoTotal: porCobro + iva,
  }));
}

/**
 * SubLínea: cuántos cobros caben en la vigencia de la Carta
 * (Plazo × días de la Frecuencia), redondeado hacia arriba.
 */
export function cobrosEnVigencia(plazo: number, frecuencia: string, periodicidad: string): number {
  const diasVigencia = plazo * diasDeFrecuencia(frecuencia);
  const diasCobro = diasDeFrecuencia(periodicidad);
  return diasVigencia > 0 && diasCobro > 0 ? Math.ceil(diasVigencia / diasCobro) : 0;
}

/** Renglones en el formato de `data.solicitud.simulacion` de la BD. */
export function simulacionParaBD(rows: RenglonComision[]) {
  return {
    tipo_tabla: 'Comisiones',
    resultado_simulacion: rows.map(r => ({
      no_pago: r.noPago, fecha_pago: r.fechaPago, saldo_insoluto: r.saldoInsoluto,
      pago_capital: r.pagoCapital, pago_interes: r.pagoInteres, iva_interes: r.ivaInteres,
      pago_periodo: r.pagoPeriodo, pago_seguro: r.pagoSeguro, pago_total: r.pagoTotal,
    })),
  };
}
