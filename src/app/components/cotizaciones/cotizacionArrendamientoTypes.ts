/**
 * cotizacionArrendamientoTypes.ts
 *
 * Motor de simulación — Cotizador de Arrendamiento Puro.
 *
 * NO reemplaza generarTablaAmortizacionCredito (cotizacionCreditoTypes.ts) —
 * ese motor calcula amortización de Crédito tradicional (Francés/Alemán/
 * Americano/Simple), sin concepto de Enganche ni Valor Residual como saldo
 * final. Arrendamiento usa una fórmula de anualidad distinta (residual como
 * saldo remanente al final del plazo, no cero), así que vive en un motor
 * separado — pero reutiliza las mismas piezas base (FRECUENCIAS_PAGO,
 * IVA_RATE, avance de fechas por días) para no duplicar convenciones.
 */
import { FRECUENCIAS_PAGO, IVA_RATE } from './cotizacionCreditoTypes';

export interface RentaArrendamientoRow {
  noRenta: number;
  fechaPago: string;
  rentaSinIva: number;
  seguro: number;
  iva: number;
  pagoPeriodo: number;
  estatus: 'Pendiente' | 'Pagado' | 'Vencido';
}

export interface SimulacionArrendamiento {
  rentaSinIvaBase: number; // resultado de la fórmula de anualidad, antes de descontar anticipadas
  calendario: RentaArrendamientoRow[];
  rentasAnticipadasDescontadas: RentaArrendamientoRow[]; // rentas que salieron del calendario (van a Cargos)
}

/**
 * Renta sin IVA — fórmula de anualidad con valor residual:
 *   Renta = (MontoAutorizado − MontoResidual / (1+i)^n) / ((1 − (1+i)^(-n)) / i)
 * donde i = tasa mensual, n = número de rentas del calendario (plazo).
 * Si no hay residual (0), la fórmula se simplifica a una anualidad estándar.
 */
export function calcularRentaSinIva(
  montoAutorizado: number,
  montoResidual: number,
  tasaAnual: number,
  plazoMeses: number
): number {
  if (montoAutorizado <= 0 || tasaAnual <= 0 || plazoMeses <= 0) return 0;
  const i = tasaAnual / 100 / 12;
  const factorDescuento = Math.pow(1 + i, plazoMeses);
  const numerador = montoAutorizado - montoResidual / factorDescuento;
  const denominador = (1 - Math.pow(1 + i, -plazoMeses)) / i;
  if (denominador === 0) return 0;
  return numerador / denominador;
}

/**
 * Genera el calendario de pagos de Arrendamiento Puro.
 *
 * Rentas anticipadas: se descuentan del calendario — si numRentasAnticipadas=1,
 * el calendario visible inicia en renta No. 2 (la renta 1 se retorna aparte,
 * en rentasAnticipadasDescontadas, para que el subtab Cargos la muestre como
 * "Renta Anticipada Mes 1" del desembolso inicial).
 */
export function generarTablaArrendamiento(params: {
  montoAutorizado: number;
  montoResidual: number;
  tasaAnual: number;
  plazoMeses: number;
  frecuencia: string; // label de FRECUENCIAS_PAGO, ej. 'Mensual'
  fechaPrimerPago: string;
  seguroPorPeriodo?: number;
  numRentasAnticipadas?: number;
}): SimulacionArrendamiento {
  const {
    montoAutorizado, montoResidual, tasaAnual, plazoMeses, frecuencia,
    fechaPrimerPago, seguroPorPeriodo = 0, numRentasAnticipadas = 0,
  } = params;

  if (montoAutorizado <= 0 || tasaAnual <= 0 || plazoMeses <= 0 || !fechaPrimerPago) {
    return { rentaSinIvaBase: 0, calendario: [], rentasAnticipadasDescontadas: [] };
  }

  const rentaSinIvaBase = calcularRentaSinIva(montoAutorizado, montoResidual, tasaAnual, plazoMeses);
  const freq = FRECUENCIAS_PAGO.find(f => f.label === frecuencia);
  const diasPeriodo = freq?.dias || 30;
  const seguro = Math.round(seguroPorPeriodo * 100) / 100;

  const todasLasRentas: RentaArrendamientoRow[] = [];
  let fecha = new Date(fechaPrimerPago + 'T00:00:00');

  for (let i = 0; i < plazoMeses; i++) {
    const rentaSinIva = Math.round(rentaSinIvaBase * 100) / 100;
    const iva = Math.round((rentaSinIva + seguro) * IVA_RATE * 100) / 100;
    const pagoPeriodo = Math.round((rentaSinIva + seguro + iva) * 100) / 100;

    todasLasRentas.push({
      noRenta: i + 1,
      fechaPago: fecha.toISOString().split('T')[0],
      rentaSinIva,
      seguro,
      iva,
      pagoPeriodo,
      estatus: 'Pendiente',
    });

    fecha = new Date(fecha.getTime() + diasPeriodo * 86400000);
  }

  const numAnticipadas = Math.max(0, Math.min(numRentasAnticipadas, todasLasRentas.length));
  const rentasAnticipadasDescontadas = todasLasRentas.slice(0, numAnticipadas);
  const calendario = todasLasRentas.slice(numAnticipadas).map((r, idx) => ({ ...r, noRenta: idx + 1 }));

  return { rentaSinIvaBase, calendario, rentasAnticipadasDescontadas };
}
