/**
 * evaluacionIntermediario.ts — Dictamen de la Fase 2 de la Línea Global NAFIN
 * calculado a partir de la Información Financiera del Intermediario (MD 06).
 *
 * Modelo de puntaje por indicador (0 a 3 puntos cada uno), promedio ponderado
 * → Calificación interna, Nivel de Riesgo y Dictamen; el Monto Recomendado
 * sale de la capacidad del Intermediario (múltiplo del Capital Contable menos
 * su exposición actual con NAFIN) ajustada por el nivel de riesgo.
 *
 * MD 06 §Reglas: "No hardcodear parámetros financieros. Cuando exista
 * configuración de parámetros en Taller de Producto, utilizarla." Los umbrales
 * de aquí son el DEFAULT; si el producto trae `parametrosEvaluacionIF`, sus
 * valores mandan (se mezclan campo por campo). El resultado es una PROPUESTA:
 * el analista puede ajustarlo y queda marcado como ajuste manual.
 */

/** Umbrales: [3 puntos, 2 puntos, 1 punto]; fuera de ellos, 0 puntos. */
export interface ParametrosEvaluacionIF {
  /** % de cartera vencida / cartera total — menor es mejor. */
  morosidad: [number, number, number];
  /** % capitalización — mayor es mejor. */
  capitalizacion: [number, number, number];
  /** % liquidez — mayor es mejor. */
  liquidez: [number, number, number];
  /** Veces que la cobertura de reservas cubre la morosidad — mayor es mejor. */
  coberturaReservas: [number, number, number];
  /** % ROE — mayor es mejor. */
  roe: [number, number, number];
  /** Peso de cada indicador en el promedio. */
  pesos: { morosidad: number; capitalizacion: number; liquidez: number; coberturaReservas: number; roe: number };
  /** Rechazo directo (knock-out), sin importar el puntaje. */
  capitalizacionMinima: number;
  morosidadMaxima: number;
  /** Capacidad = Capital Contable × múltiplo − exposición actual con NAFIN. */
  multiploCapital: number;
  /** % de la capacidad que se recomienda según el nivel de riesgo. */
  factorRiesgo: { Bajo: number; Medio: number; Alto: number };
  /** Promedio mínimo para cada nivel. */
  cortesNivel: { Bajo: number; Medio: number };
  /** Promedio mínimo para cada calificación interna, de mejor a peor. */
  escalaCalificacion: { calificacion: string; minimo: number }[];
}

export const PARAMETROS_EVALUACION_IF_DEFAULT: ParametrosEvaluacionIF = {
  morosidad: [3, 5, 8],
  capitalizacion: [14, 12, 10.5],
  liquidez: [20, 10, 5],
  coberturaReservas: [1.5, 1, 0.75],
  roe: [15, 10, 5],
  pesos: { morosidad: 0.25, capitalizacion: 0.25, liquidez: 0.15, coberturaReservas: 0.2, roe: 0.15 },
  capitalizacionMinima: 10.5,
  morosidadMaxima: 10,
  multiploCapital: 5,
  factorRiesgo: { Bajo: 1, Medio: 0.75, Alto: 0 },
  cortesNivel: { Bajo: 2, Medio: 1.2 },
  escalaCalificacion: [
    { calificacion: 'AAA', minimo: 2.7 },
    { calificacion: 'AA', minimo: 2.4 },
    { calificacion: 'A', minimo: 2.0 },
    { calificacion: 'BBB', minimo: 1.6 },
    { calificacion: 'BB', minimo: 1.2 },
    { calificacion: 'B', minimo: 0.8 },
    { calificacion: 'C', minimo: 0 },
  ],
};

/** Parámetros efectivos: los del producto sobre los default. */
export function resolverParametrosEvaluacion(delProducto?: Partial<ParametrosEvaluacionIF> | null): ParametrosEvaluacionIF {
  const p = delProducto && typeof delProducto === 'object' ? delProducto : {};
  return {
    ...PARAMETROS_EVALUACION_IF_DEFAULT,
    ...p,
    pesos: { ...PARAMETROS_EVALUACION_IF_DEFAULT.pesos, ...(p.pesos || {}) },
    factorRiesgo: { ...PARAMETROS_EVALUACION_IF_DEFAULT.factorRiesgo, ...(p.factorRiesgo || {}) },
    cortesNivel: { ...PARAMETROS_EVALUACION_IF_DEFAULT.cortesNivel, ...(p.cortesNivel || {}) },
  } as ParametrosEvaluacionIF;
}

export interface EntradaEvaluacion {
  capitalContable: unknown;
  carteraTotal: unknown;
  carteraVencida: unknown;
  capitalizacion: unknown;
  liquidez: unknown;
  coberturaReservas: unknown;
  roe: unknown;
  exposicionNafin: unknown;
  montoSolicitado: unknown;
}

export interface IndicadorEvaluado {
  indicador: string;
  valor: string;
  puntos: number | null;
  /** Por qué recibió esos puntos (umbral alcanzado). */
  criterio: string;
}

export interface ResultadoEvaluacion {
  /** false si falta información para calcular. */
  calculable: boolean;
  faltantes: string[];
  indicadores: IndicadorEvaluado[];
  puntaje: number;
  calificacion: string;
  nivelRiesgo: 'Bajo' | 'Medio' | 'Alto' | '';
  dictamen: 'Favorable' | 'Favorable con Condiciones' | 'No Favorable' | '';
  capacidad: number;
  montoRecomendado: number;
  condiciones: string;
  observaciones: string;
}

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const capturado = (v: unknown) => String(v ?? '').trim() !== '' && Number.isFinite(num(v));
const pct = (n: number) => `${n.toFixed(2)}%`;
const mxn = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Puntos de un indicador. `mayorEsMejor` invierte la comparación. */
function puntuar(valor: number, umbrales: [number, number, number], mayorEsMejor: boolean): { puntos: number; criterio: string } {
  const [u3, u2, u1] = umbrales;
  const cumple = (u: number) => (mayorEsMejor ? valor >= u : valor <= u);
  const op = mayorEsMejor ? '≥' : '≤';
  if (cumple(u3)) return { puntos: 3, criterio: `${op} ${u3}` };
  if (cumple(u2)) return { puntos: 2, criterio: `${op} ${u2}` };
  if (cumple(u1)) return { puntos: 1, criterio: `${op} ${u1}` };
  return { puntos: 0, criterio: `fuera de ${op} ${u1}` };
}

export function calcularDictamen(e: EntradaEvaluacion, params?: ParametrosEvaluacionIF): ResultadoEvaluacion {
  const P = params || PARAMETROS_EVALUACION_IF_DEFAULT;
  const faltantes: string[] = [];
  if (!(num(e.capitalContable) > 0)) faltantes.push('Capital Contable');
  if (!(num(e.carteraTotal) > 0)) faltantes.push('Cartera Total');
  if (!capturado(e.carteraVencida)) faltantes.push('Cartera Vencida');
  if (!capturado(e.capitalizacion)) faltantes.push('Capitalización');
  if (!capturado(e.liquidez)) faltantes.push('Liquidez');
  if (!capturado(e.coberturaReservas)) faltantes.push('Cobertura de Reservas');
  if (!capturado(e.roe)) faltantes.push('ROE');
  const vacio: ResultadoEvaluacion = {
    calculable: false, faltantes, indicadores: [], puntaje: 0, calificacion: '', nivelRiesgo: '', dictamen: '',
    capacidad: 0, montoRecomendado: 0, condiciones: '', observaciones: '',
  };
  if (faltantes.length > 0) return vacio;

  const capital = num(e.capitalContable);
  const morosidad = (num(e.carteraVencida) / num(e.carteraTotal)) * 100;
  const capitalizacion = num(e.capitalizacion);
  const liquidez = num(e.liquidez);
  const cobertura = num(e.coberturaReservas);
  // Cobertura de reservas en VECES la morosidad: 3% de reservas contra 1% de
  // morosidad cubre 3 veces. Sin morosidad, la cobertura es total.
  const coberturaVeces = morosidad > 0 ? cobertura / morosidad : Infinity;
  const roe = num(e.roe);

  const pMor = puntuar(morosidad, P.morosidad, false);
  const pCap = puntuar(capitalizacion, P.capitalizacion, true);
  const pLiq = puntuar(liquidez, P.liquidez, true);
  const pCob = puntuar(coberturaVeces, P.coberturaReservas, true);
  const pRoe = puntuar(roe, P.roe, true);

  const indicadores: IndicadorEvaluado[] = [
    { indicador: 'Índice de Morosidad', valor: pct(morosidad), puntos: pMor.puntos, criterio: `${pMor.criterio}%` },
    { indicador: 'Capitalización', valor: pct(capitalizacion), puntos: pCap.puntos, criterio: `${pCap.criterio}%` },
    { indicador: 'Liquidez', valor: pct(liquidez), puntos: pLiq.puntos, criterio: `${pLiq.criterio}%` },
    { indicador: 'Cobertura de Reservas', valor: Number.isFinite(coberturaVeces) ? `${coberturaVeces.toFixed(2)} veces la morosidad` : 'Sin morosidad', puntos: pCob.puntos, criterio: `${pCob.criterio} veces` },
    { indicador: 'ROE', valor: pct(roe), puntos: pRoe.puntos, criterio: `${pRoe.criterio}%` },
  ];

  const w = P.pesos;
  const sumaPesos = w.morosidad + w.capitalizacion + w.liquidez + w.coberturaReservas + w.roe || 1;
  const puntaje = Math.round(((pMor.puntos * w.morosidad + pCap.puntos * w.capitalizacion + pLiq.puntos * w.liquidez
    + pCob.puntos * w.coberturaReservas + pRoe.puntos * w.roe) / sumaPesos) * 100) / 100;

  const calificacion = `${(P.escalaCalificacion.find(c => puntaje >= c.minimo) || P.escalaCalificacion[P.escalaCalificacion.length - 1]).calificacion} (interna)`;

  // Rechazos directos: debajo del mínimo regulatorio de capital o morosidad excesiva.
  const knockOut: string[] = [];
  if (capitalizacion < P.capitalizacionMinima) knockOut.push(`Capitalización ${pct(capitalizacion)} debajo del mínimo de ${P.capitalizacionMinima}%`);
  if (morosidad > P.morosidadMaxima) knockOut.push(`Morosidad ${pct(morosidad)} arriba del máximo de ${P.morosidadMaxima}%`);

  let nivelRiesgo: 'Bajo' | 'Medio' | 'Alto' = puntaje >= P.cortesNivel.Bajo ? 'Bajo' : puntaje >= P.cortesNivel.Medio ? 'Medio' : 'Alto';
  if (knockOut.length > 0) nivelRiesgo = 'Alto';

  const solicitado = Math.max(0, num(e.montoSolicitado) || 0);
  const exposicion = Math.max(0, num(e.exposicionNafin) || 0);
  const capacidad = Math.max(0, Math.round((capital * P.multiploCapital - exposicion) * 100) / 100);
  let montoRecomendado = Math.round(Math.min(solicitado, capacidad) * (P.factorRiesgo[nivelRiesgo] ?? 0) * 100) / 100;

  let dictamen: ResultadoEvaluacion['dictamen'] =
    nivelRiesgo === 'Bajo' ? 'Favorable' : nivelRiesgo === 'Medio' ? 'Favorable con Condiciones' : 'No Favorable';
  if (dictamen !== 'No Favorable' && !(montoRecomendado > 0)) {
    dictamen = 'No Favorable';
    knockOut.push('Sin capacidad: la exposición actual con NAFIN ya alcanza el múltiplo del Capital Contable');
  }
  if (dictamen === 'No Favorable') montoRecomendado = 0;
  // Con monto recortado por capacidad o por riesgo, el dictamen va condicionado.
  if (dictamen === 'Favorable' && montoRecomendado < solicitado) dictamen = 'Favorable con Condiciones';

  const debiles = indicadores.filter(i => (i.puntos ?? 0) <= 1).map(i => `${i.indicador} (${i.valor})`);
  const condiciones = dictamen === 'Favorable con Condiciones'
    ? [
        ...(montoRecomendado < solicitado ? [`Monto limitado a ${mxn(montoRecomendado)} (capacidad ${mxn(capacidad)} = Capital × ${P.multiploCapital} − exposición NAFIN).`] : []),
        ...debiles.map(d => `Plan de mejora y seguimiento trimestral de ${d}.`),
      ].join('\n')
    : '';
  const observaciones = [
    `Puntaje ${puntaje.toFixed(2)} de 3.00 → ${calificacion}, riesgo ${nivelRiesgo}.`,
    ...indicadores.map(i => `${i.indicador}: ${i.valor} → ${i.puntos} pts (${i.criterio}).`),
    `Capacidad: Capital ${mxn(capital)} × ${P.multiploCapital} − exposición NAFIN ${mxn(exposicion)} = ${mxn(capacidad)}.`,
    ...knockOut.map(k => `Rechazo: ${k}.`),
  ].join('\n');

  return {
    calculable: true, faltantes: [], indicadores, puntaje, calificacion, nivelRiesgo, dictamen,
    capacidad, montoRecomendado, condiciones, observaciones,
  };
}
