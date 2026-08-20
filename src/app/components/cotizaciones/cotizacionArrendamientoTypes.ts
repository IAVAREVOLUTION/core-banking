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
  // ── Sólo Arrendamiento Financiero ──
  // Se guardan en el MISMO contenedor que el calendario de Puro para que
  // Cartera de Arrendamiento, el Anexo de Rentas y Cobranza sigan leyendo
  // `rentaSinIva`/`pagoPeriodo`/`estatus` sin cambio alguno.
  /** Saldo insoluto AL INICIO del periodo (base del interés del mes). */
  saldoInsoluto?: number;
  /** Amortización de capital implícita del periodo. */
  capital?: number;
  /** Interés implícito del periodo = saldoInsoluto × i. */
  interes?: number;
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

  // Las rentas anticipadas se cobran en el desembolso inicial (subtab Cargos),
  // por lo que siguen exponiéndose aquí para ese cálculo.
  const rentasAnticipadasDescontadas = todasLasRentas.slice(0, numAnticipadas);

  // El calendario conserva TODAS las rentas con su numeración original; las
  // primeras N (las anticipadas) se marcan como 'Pagado' porque ya se
  // liquidaron por adelantado. Antes se eliminaban del calendario y las
  // restantes se renumeraban desde 1, lo que ocultaba esos periodos.
  const calendario = todasLasRentas.map((r, idx) => (
    idx < numAnticipadas ? { ...r, estatus: 'Pagado' as const } : r
  ));

  return { rentaSinIvaBase, calendario, rentasAnticipadasDescontadas };
}

/**
 * Genera la TABLA DE AMORTIZACIÓN de Arrendamiento Financiero.
 *
 * Difiere del calendario de Arrendamiento Puro en dos cosas:
 *
 *  1. Desglosa saldo insoluto, capital e interés implícitos — el saldo decrece
 *     y converge al Valor Residual (opción de compra), no a cero.
 *  2. El IVA grava la RENTA BASE COMPLETA (capital + interés), no sólo el
 *     interés como en Crédito Simple. Como la renta base es fija, el IVA es
 *     constante todo el contrato en vez de decrecer.
 *
 * OJO: aquí el IVA NO incluye el seguro (`iva = rentaSinIva × 0.16`), a
 * diferencia de `generarTablaArrendamiento` (Puro), donde la base es
 * `rentaSinIva + seguro`. El seguro se suma al Pago del Periodo, no a la base.
 *
 * Renta (Subtotal) = ((ValorActivo − Enganche) − ValorResidual/(1+i)^n)
 *                    ÷ ((1 − (1+i)^(−n)) / i)
 *
 * `montoAutorizado` ya viene neteado del enganche (Términos y Condiciones lo
 * calcula como montoSolicitado × (1 − %enganche/100)), así que corresponde a
 * (ValorActivo − Enganche) de la fórmula.
 */
export function generarTablaArrendamientoFinanciero(params: {
  montoAutorizado: number;
  montoResidual: number;
  tasaAnual: number;
  plazoMeses: number;
  frecuencia: string;
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

  // Misma anualidad con valor futuro que usa Puro — no se duplica la fórmula.
  const rentaSinIvaBase = calcularRentaSinIva(montoAutorizado, montoResidual, tasaAnual, plazoMeses);
  const renta = Math.round(rentaSinIvaBase * 100) / 100;

  const i = tasaAnual / 100 / 12;
  const freq = FRECUENCIAS_PAGO.find(f => f.label === frecuencia);
  const diasPeriodo = freq?.dias || 30;
  const seguro = Math.round(seguroPorPeriodo * 100) / 100;

  // El IVA es constante: la renta base no cambia en todo el plazo.
  const iva = Math.round(renta * IVA_RATE * 100) / 100;
  const pagoPeriodo = Math.round((renta + iva + seguro) * 100) / 100;

  const r2 = (n: number) => Math.round(n * 100) / 100;

  const todasLasRentas: RentaArrendamientoRow[] = [];
  let fecha = new Date(fechaPrimerPago + 'T00:00:00');
  let saldo = montoAutorizado;

  for (let k = 0; k < plazoMeses; k++) {
    const interes = r2(saldo * i);
    const esUltima = k === plazoMeses - 1;
    // En la última renta el capital cierra el saldo EXACTAMENTE contra el Valor
    // Residual, absorbiendo el residuo de centavos que deja redondear la renta
    // y el capital en cada periodo (si no, el saldo final queda en 0.01 / 3000.02).
    // La renta, el IVA y el pago del periodo se mantienen constantes.
    const capital = esUltima ? r2(saldo - montoResidual) : r2(renta - interes);
    const saldoInicial = r2(saldo);

    todasLasRentas.push({
      noRenta: k + 1,
      fechaPago: fecha.toISOString().split('T')[0],
      saldoInsoluto: saldoInicial,
      capital,
      interes,
      rentaSinIva: renta,
      seguro,
      iva,
      pagoPeriodo,
      estatus: 'Pendiente',
    });

    saldo = saldo - capital;
    fecha = new Date(fecha.getTime() + diasPeriodo * 86400000);
  }

  // Mismo tratamiento de rentas anticipadas que Puro: se conservan en el
  // calendario con su numeración original y se marcan como pagadas.
  const numAnticipadas = Math.max(0, Math.min(numRentasAnticipadas, todasLasRentas.length));
  const rentasAnticipadasDescontadas = todasLasRentas.slice(0, numAnticipadas);
  const calendario = todasLasRentas.map((r, idx) => (
    idx < numAnticipadas ? { ...r, estatus: 'Pagado' as const } : r
  ));

  return { rentaSinIvaBase, calendario, rentasAnticipadasDescontadas };
}
