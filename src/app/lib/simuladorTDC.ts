/**
 * simuladorTDC — Simulación de pagos de Tarjeta de Crédito (Solicitudes y
 * Originación → Simulación).
 *
 * Proyecta, corte por corte, qué pasa con una disposición de la línea si el
 * cliente paga siempre el mismo "Pago Periodo". Tres escenarios, según cómo se
 * compara ese pago contra el PRIMER estado de cuenta:
 *
 *   1. Pago Periodo = Pago para No Generar Intereses → liquida en el primer
 *      corte, sin interés ordinario ni moratorio.
 *   2. Pago mínimo ≤ Pago Periodo < Pago para No Generar Intereses → paga
 *      interés ordinario y capital hasta saldar.
 *   3. Pago Periodo < Pago mínimo → además del ordinario, el faltante del
 *      mínimo queda vencido y genera interés moratorio.
 *
 * ── Reglas de cálculo ────────────────────────────────────────────────────
 * · Pago mínimo: el MISMO `calcularPagoMinimo` del Cierre de Corte (REQ-27),
 *   con el método / % / monto fijo / conceptos / saldo vencido que define el
 *   Taller del producto. Nunca excede el saldo total al corte.
 * · Interés ordinario: saldo de capital × tasa ordinaria anual / 360 × 30
 *   (convención comercial del sistema). El primer corte no genera interés:
 *   la disposición ocurre dentro del periodo de gracia.
 * · Interés moratorio: saldo vencido (parte del pago mínimo no cubierta) ×
 *   tasa moratoria anual / 360 × 30.
 * · IVA sobre intereses (ordinario y moratorio) al % configurado.
 * · Los intereses no pagados quedan pendientes; NO se capitalizan.
 * · Prelación del pago: IVA → Interés moratorio → Interés ordinario → Capital,
 *   la prelación real del producto TDC.
 *
 * Motor puro: sin React, sin BD. Igual que los demás motores TDC.
 */

import { money } from './motorMovimientosTDC';
import { calcularPagoMinimo, type ConfigCorte, type RenglonDetalleCxC } from './motorCierreCorteTDC';

export type EscenarioTDC = 1 | 2 | 3;

export interface ParamsSimulacionTDC {
  /** Monto Promedio de Disposición — ≤ Monto Autorizado. */
  montoDisposicion: number;
  /** Pago que el cliente hace en cada periodo. */
  pagoPeriodo: number;
  /** % anual. */
  tasaOrdinariaAnual: number;
  /** % anual. */
  tasaMoratoriaAnual: number;
  /** % de IVA sobre intereses (16 por default). */
  ivaPct?: number;
  /** Definición de pago mínimo del Taller del producto. */
  configPagoMinimo: Pick<ConfigCorte,
    'pagoMinimoMetodo' | 'pagoMinimoPorcentaje' | 'pagoMinimoMonto' |
    'pagoMinimoAgregarSaldoVencido' | 'pagoMinimoConceptos'>;
  /** YYYY-MM-DD — fecha de la disposición. */
  fechaInicio: string;
  /** Día de corte de la tarjeta; si falta, el corte cae un mes después de la disposición. */
  diaCorte?: number;
  /** Días entre corte y fecha límite de pago. */
  diasParaPago?: number;
  /** Tope de periodos para no ciclar cuando el pago no amortiza. */
  maxPeriodos?: number;
}

export interface RenglonSimulacionTDC {
  periodo: number;
  fechaCorte: string;
  fechaLimitePago: string;
  /** Capital al inicio del periodo. */
  capitalInicial: number;
  interesOrdinario: number;
  interesMoratorio: number;
  iva: number;
  /** Intereses + IVA de periodos anteriores que quedaron sin pagar. */
  pendienteAnterior: number;
  /** Saldo total al corte = Pago para No Generar Intereses del periodo. */
  saldoTotalCorte: number;
  pagoMinimo: number;
  pagoRealizado: number;
  aplicadoIva: number;
  aplicadoMoratorio: number;
  aplicadoOrdinario: number;
  aplicadoCapital: number;
  /** Parte del pago mínimo no cubierta — base del moratorio del siguiente periodo. */
  saldoVencido: number;
  capitalFinal: number;
  saldoFinal: number;
}

export interface ResultadoSimulacionTDC {
  ok: boolean;
  error?: string;
  escenario: EscenarioTDC;
  /** Del primer corte. */
  pagoNoGenerarIntereses: number;
  /** Del primer corte. */
  pagoMinimoPeriodo: number;
  renglones: RenglonSimulacionTDC[];
  /** false cuando el pago no alcanza a amortizar y se cortó la proyección. */
  liquida: boolean;
  /** true si en algún periodo el pago quedó por debajo del mínimo. */
  generoMoratorio: boolean;
  totales: {
    pagado: number;
    capital: number;
    interesOrdinario: number;
    interesMoratorio: number;
    iva: number;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const aISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Mismo día del mes `n` meses después, acotado al último día del mes. */
function sumarMeses(base: Date, n: number, dia: number): Date {
  const anio = base.getFullYear();
  const mes = base.getMonth() + n;
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(Math.max(1, dia), ultimo));
}

/** Fechas de corte: la primera estrictamente posterior a la disposición, luego mensual. */
export function fechasCorteTDC(fechaInicio: string, n: number, diaCorte?: number): string[] {
  const ini = new Date(`${(fechaInicio || '').slice(0, 10)}T00:00:00`);
  const base = Number.isNaN(ini.getTime()) ? new Date() : ini;
  const dia = diaCorte && diaCorte > 0 ? diaCorte : base.getDate();
  let primero = sumarMeses(base, 0, dia);
  if (primero <= base) primero = sumarMeses(base, 1, dia);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(aISO(sumarMeses(primero, i, dia)));
  }
  return out;
}

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return aISO(d);
}

const renglon = (nombre: string, monto: number): RenglonDetalleCxC => ({
  idCargo: nombre, claveConcepto: nombre, nombreConcepto: nombre, monto,
  fechaCargo: '', naturaleza: 'Cargo', ordenPrelacion: 0, bFactura: 'N',
});

/** Pago mínimo de un corte con la definición del Taller, acotado al saldo total. */
function minimoDelCorte(
  config: ParamsSimulacionTDC['configPagoMinimo'],
  partes: { capital: number; ordinario: number; moratorio: number; iva: number },
  total: number,
  saldoVencido: number,
): number {
  const detalle = [
    renglon('Capital', partes.capital),
    renglon('Interés ordinario', partes.ordinario),
    renglon('Interés moratorio', partes.moratorio),
    renglon('IVA', partes.iva),
  ].filter(r => r.monto > 0);
  const m = calcularPagoMinimo(
    { diaCorte: 0, diasParaPago: 0, ...config },
    detalle,
    total,
    saldoVencido,
  );
  // El saldo vencido ya forma parte del saldo total: el mínimo nunca lo rebasa.
  return money(Math.min(m, total));
}

/** Determina el escenario comparando el pago contra el primer corte. */
export function clasificarEscenario(pago: number, pagoNoIntereses: number, pagoMinimo: number): EscenarioTDC {
  if (pago >= pagoNoIntereses - 0.005) return 1;
  if (pago >= pagoMinimo - 0.005) return 2;
  return 3;
}

export function simularTDC(p: ParamsSimulacionTDC): ResultadoSimulacionTDC {
  const vacio = (error: string): ResultadoSimulacionTDC => ({
    ok: false, error, escenario: 1, pagoNoGenerarIntereses: 0, pagoMinimoPeriodo: 0,
    renglones: [], liquida: false, generoMoratorio: false,
    totales: { pagado: 0, capital: 0, interesOrdinario: 0, interesMoratorio: 0, iva: 0 },
  });

  const D = money(Number(p.montoDisposicion) || 0);
  const P = money(Number(p.pagoPeriodo) || 0);
  if (D <= 0) return vacio('El Monto Promedio de Disposición debe ser mayor a cero.');
  if (P <= 0) return vacio('El Pago Periodo debe ser mayor a cero.');

  const tasaOrdMes = (Number(p.tasaOrdinariaAnual) || 0) / 100 / 360 * 30;
  const tasaMorMes = (Number(p.tasaMoratoriaAnual) || 0) / 100 / 360 * 30;
  const ivaPct = (p.ivaPct ?? 16) / 100;
  const maxPeriodos = p.maxPeriodos ?? 360;
  const diasPago = p.diasParaPago && p.diasParaPago > 0 ? p.diasParaPago : 20;
  const fechas = fechasCorteTDC(p.fechaInicio, maxPeriodos, p.diaCorte);

  // Estado entre cortes.
  let capital = D;
  let pendOrd = 0;   // interés ordinario sin pagar
  let pendMor = 0;   // interés moratorio sin pagar
  let pendIva = 0;   // IVA sin pagar
  let vencido = 0;   // faltante del mínimo del corte anterior

  const renglones: RenglonSimulacionTDC[] = [];
  let pagoNoIntereses1 = 0;
  let pagoMinimo1 = 0;
  let liquida = false;
  let generoMoratorio = false;
  let saldoPrevio = Infinity;
  let periodosSinAmortizar = 0;

  for (let k = 1; k <= maxPeriodos; k++) {
    // Primer corte: la disposición está dentro del periodo de gracia.
    const iOrd = k === 1 ? 0 : money(capital * tasaOrdMes);
    const iMor = k === 1 ? 0 : money(vencido * tasaMorMes);
    const iva = money((iOrd + iMor) * ivaPct);
    if (iMor > 0) generoMoratorio = true;

    const pendienteAnterior = money(pendOrd + pendMor + pendIva);
    const ordTot = money(pendOrd + iOrd);
    const morTot = money(pendMor + iMor);
    const ivaTot = money(pendIva + iva);
    const total = money(capital + ordTot + morTot + ivaTot);

    const minimo = minimoDelCorte(
      p.configPagoMinimo,
      { capital, ordinario: ordTot, moratorio: morTot, iva: ivaTot },
      total,
      vencido,
    );
    if (k === 1) { pagoNoIntereses1 = total; pagoMinimo1 = minimo; }

    // Prelación: IVA → Moratorio → Ordinario → Capital.
    let resto = money(Math.min(P, total));
    const pagado = resto;
    const aIva = money(Math.min(resto, ivaTot)); resto = money(resto - aIva);
    const aMor = money(Math.min(resto, morTot)); resto = money(resto - aMor);
    const aOrd = money(Math.min(resto, ordTot)); resto = money(resto - aOrd);
    const aCap = money(Math.min(resto, capital));

    const capitalInicial = capital;
    capital = money(capital - aCap);
    pendIva = money(ivaTot - aIva);
    pendMor = money(morTot - aMor);
    pendOrd = money(ordTot - aOrd);
    vencido = money(Math.max(0, minimo - pagado));
    const saldoFinal = money(capital + pendIva + pendMor + pendOrd);

    renglones.push({
      periodo: k,
      fechaCorte: fechas[k - 1],
      fechaLimitePago: sumarDias(fechas[k - 1], diasPago),
      capitalInicial,
      interesOrdinario: iOrd,
      interesMoratorio: iMor,
      iva,
      pendienteAnterior,
      saldoTotalCorte: total,
      pagoMinimo: minimo,
      pagoRealizado: pagado,
      aplicadoIva: aIva,
      aplicadoMoratorio: aMor,
      aplicadoOrdinario: aOrd,
      aplicadoCapital: aCap,
      saldoVencido: vencido,
      capitalFinal: capital,
      saldoFinal,
    });

    if (saldoFinal <= 0.005) { liquida = true; break; }

    // Si el pago ni siquiera cubre lo que se genera, la deuda no baja nunca.
    if (saldoFinal >= saldoPrevio - 0.005) {
      if (++periodosSinAmortizar >= 3) break;
    } else {
      periodosSinAmortizar = 0;
    }
    saldoPrevio = saldoFinal;
  }

  const suma = (f: (r: RenglonSimulacionTDC) => number) => money(renglones.reduce((a, r) => a + f(r), 0));

  return {
    ok: true,
    escenario: clasificarEscenario(P, pagoNoIntereses1, pagoMinimo1),
    pagoNoGenerarIntereses: pagoNoIntereses1,
    pagoMinimoPeriodo: pagoMinimo1,
    renglones,
    liquida,
    generoMoratorio,
    totales: {
      pagado: suma(r => r.pagoRealizado),
      capital: suma(r => r.aplicadoCapital),
      interesOrdinario: suma(r => r.interesOrdinario),
      interesMoratorio: suma(r => r.interesMoratorio),
      iva: suma(r => r.iva),
    },
  };
}

/**
 * Pago mínimo del primer corte para una disposición — lo que la pantalla
 * muestra antes de simular, para que el usuario elija su Pago Periodo.
 */
export function pagoMinimoInicialTDC(
  montoDisposicion: number,
  config: ParamsSimulacionTDC['configPagoMinimo'],
): number {
  const D = money(Number(montoDisposicion) || 0);
  if (D <= 0) return 0;
  return minimoDelCorte(config, { capital: D, ordinario: 0, moratorio: 0, iva: 0 }, D, 0);
}
