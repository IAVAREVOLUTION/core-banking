/**
 * SimulacionTDC — Subpestaña "Simulación" de Solicitudes y Originación para
 * productos Tarjeta de Crédito.
 *
 * El usuario captura el Monto Promedio de Disposición (≤ Monto Autorizado) y
 * el Pago Periodo. La pantalla calcula el Pago para No Generar Intereses y el
 * Pago Mínimo del periodo (definición del Taller del producto) y proyecta los
 * cortes hasta saldar la deuda en uno de tres escenarios. El cálculo vive en
 * lib/simuladorTDC.ts.
 *
 * Fuentes:
 *  · Monto Autorizado / Tasa Ordinaria → Términos y Condiciones (encabezado).
 *  · Tasa Moratoria → % de interés moratorio del producto, o Ordinaria × factor
 *    moratorio cuando el producto lo define como factor.
 *  · Pago mínimo, día de corte y días para pago → acordeón Condiciones de la
 *    Tarjeta (que nace del subtab Reglas de Pago y Corte TDC), con respaldo a
 *    la regla del producto.
 */
import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { saveToSession, loadFromSession, loadFromSavedStore, formatCurrency, parseCurrency } from './solicitudCreditoStore';
import {
  simularTDC, pagoMinimoInicialTDC, clasificarEscenario,
  type ResultadoSimulacionTDC, type EscenarioTDC,
} from '../../lib/simuladorTDC';

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string;
  montoAutorizado?: number;
  montoSolicitadoHeader?: string;
  tasaHeader?: string;
  fechaInicioHeader?: string;
  /** Nodo `reglasPagoCorteTDC` del producto (Taller). */
  reglaTDC?: Record<string, any>;
  /** % anual de interés moratorio del producto. */
  porcentajeMoratorioProducto?: string | number;
  /** Factor moratorio del producto (Ordinaria × factor). */
  factorMoratorioProducto?: string | number;
  /** % de IVA del producto. */
  ivaProducto?: string | number;
  /** Fecha Inicio del encabezado ← fecha de la disposición simulada (DD/MM/YYYY). */
  onFechaInicioChange?: (fecha: string) => void;
  /** Fecha Fin del encabezado ← fecha límite de pago del último periodo (DD/MM/YYYY). */
  onFechaFinChange?: (fecha: string) => void;
}

interface EstadoGuardado {
  montoDisposicion: string;
  pagoPeriodo: string;
  tasaOrdinaria: string;
  tasaMoratoria: string;
  resultado: ResultadoSimulacionTDC | null;
}

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtFecha = (iso: string) => {
  const [y, m, d] = (iso || '').split('-');
  return y && m && d ? `${d}-${MESES[parseInt(m, 10) - 1]}-${y}` : '—';
};

/** 100000 → "100,000.00" — los montos capturados se muestran con separador de miles. */
const fmtMonto = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** YYYY-MM-DD → DD/MM/YYYY, el formato del DatePicker del encabezado. */
const aDDMMYYYY = (iso: string) => {
  const [y, m, d] = (iso || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
};

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** DD/MM/YYYY o YYYY-MM-DD → YYYY-MM-DD. */
const aISO = (f: string): string => {
  if (!f) return '';
  const s = f.split('/');
  if (s.length === 3 && s[0].length <= 2) return `${s[2]}-${s[1].padStart(2, '0')}-${s[0].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(f) ? f.slice(0, 10) : '';
};

const ESCENARIOS: Record<EscenarioTDC, { titulo: string; detalle: string; cls: string }> = {
  1: {
    titulo: 'Escenario 1 — Liquida sin intereses',
    detalle: 'Pago Periodo = Pago para No Generar Intereses: se liquida en el primer corte sin interés ordinario ni moratorio.',
    cls: 'bg-green-50 border-green-300 text-green-800',
  },
  2: {
    titulo: 'Escenario 2 — Paga intereses ordinarios',
    detalle: 'Pago mínimo ≤ Pago Periodo < Pago para No Generar Intereses: se pagan interés ordinario, IVA y capital hasta saldar.',
    cls: 'bg-amber-50 border-amber-300 text-amber-800',
  },
  3: {
    titulo: 'Escenario 3 — Genera intereses moratorios',
    detalle: 'Pago Periodo < Pago mínimo: el faltante del mínimo queda vencido y genera interés moratorio, además del ordinario.',
    cls: 'bg-red-50 border-red-300 text-red-800',
  },
};

export function SimulacionTDC({
  mode, solicitudId, montoAutorizado, montoSolicitadoHeader, tasaHeader, fechaInicioHeader,
  reglaTDC, porcentajeMoratorioProducto, factorMoratorioProducto, ivaProducto,
  onFechaInicioChange, onFechaFinChange,
}: Props) {
  const isRO = mode === 'ver';

  // ── Fuentes: Términos, Condiciones de la Tarjeta y Taller del producto ──
  const terminos: any =
    loadFromSession<any>(solicitudId, 'terminos') ?? loadFromSavedStore<any>(solicitudId, 'terminos') ?? {};
  const condiciones: any =
    loadFromSession<any>(solicitudId, 'condicionesTarjeta') ?? loadFromSavedStore<any>(solicitudId, 'condicionesTarjeta') ?? {};

  const autorizado =
    (montoAutorizado && montoAutorizado > 0 ? montoAutorizado : 0) ||
    num(terminos.montoAutorizado) ||
    num(condiciones.limiteAutorizado) ||
    num(parseCurrency(montoSolicitadoHeader || terminos.montoSolicitado || ''));

  const tasaOrdDefault = num(tasaHeader || terminos.tasa || condiciones.tasaOrdinariaAnual);
  const tasaMorDefault = (() => {
    const pct = num(porcentajeMoratorioProducto);
    if (pct > 0) return pct;
    const factor = num(factorMoratorioProducto);
    if (factor > 0 && tasaOrdDefault > 0) return Math.round(tasaOrdDefault * factor * 100) / 100;
    return num(condiciones.tasaMoratoriaAnual);
  })();
  const ivaPct = (() => { const v = num(ivaProducto); return v > 0 && v <= 100 ? v : 16; })();

  // Lo capturado en Condiciones de la Tarjeta manda; la regla del producto es respaldo.
  const configPagoMinimo = useMemo(() => ({
    pagoMinimoMetodo: String(condiciones.pagoMinimoMetodo || reglaTDC?.pagoMinimoMetodo || ''),
    pagoMinimoPorcentaje: num(condiciones.pagoMinimoPorcentaje || reglaTDC?.pagoMinimoPorcentajeBase),
    pagoMinimoMonto: num(condiciones.pagoMinimoMonto || reglaTDC?.pagoMinimoMontoAbsoluto),
    pagoMinimoAgregarSaldoVencido: reglaTDC?.pagoMinimoAgregarSaldoVencido ?? true,
    pagoMinimoConceptos: Array.isArray(reglaTDC?.pagoMinimoConceptos) ? reglaTDC!.pagoMinimoConceptos : [],
  }), [condiciones.pagoMinimoMetodo, condiciones.pagoMinimoPorcentaje, condiciones.pagoMinimoMonto, reglaTDC]);

  const diaCorte = num(condiciones.diaCorte || reglaTDC?.diaCorte) || undefined;
  const diasParaPago = num(condiciones.diasParaPago || reglaTDC?.diasFechaLimitePago) || undefined;
  const fechaInicio = aISO(fechaInicioHeader || terminos.fechaPrimerPago || '') || hoyISO();

  // ── Estado de la pantalla ──
  const inicial = (): EstadoGuardado => {
    const s = loadFromSession<EstadoGuardado>(solicitudId, 'simulacion_tdc') ??
      loadFromSavedStore<EstadoGuardado>(solicitudId, 'simulacion_tdc');
    return {
      montoDisposicion: s?.montoDisposicion ?? (autorizado > 0 ? fmtMonto(autorizado) : ''),
      pagoPeriodo: s?.pagoPeriodo ?? '',
      tasaOrdinaria: s?.tasaOrdinaria || (tasaOrdDefault ? String(tasaOrdDefault) : ''),
      tasaMoratoria: s?.tasaMoratoria || (tasaMorDefault ? String(tasaMorDefault) : ''),
      resultado: s?.resultado ?? null,
    };
  };
  const [st, setSt] = useState<EstadoGuardado>(inicial);
  const set = (k: keyof Omit<EstadoGuardado, 'resultado'>, v: string) =>
    setSt(prev => ({ ...prev, [k]: v.replace(/[^0-9.,]/g, '') }));

  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, 'simulacion_tdc', st);
  }, [st, solicitudId, isRO]);

  const disposicion = num(st.montoDisposicion);
  const pago = num(st.pagoPeriodo);
  const tasaOrd = num(st.tasaOrdinaria);
  const tasaMor = num(st.tasaMoratoria);

  // Primer corte: la disposición completa es el Pago para No Generar Intereses.
  const pagoNoIntereses = disposicion > 0 ? Math.round(disposicion * 100) / 100 : 0;
  const pagoMinimo = pagoMinimoInicialTDC(disposicion, configPagoMinimo);
  const escenarioVivo: EscenarioTDC | null =
    pago > 0 && disposicion > 0 ? clasificarEscenario(pago, pagoNoIntereses, pagoMinimo) : null;

  const excedeAutorizado = autorizado > 0 && disposicion > autorizado + 0.005;
  const excedeNoIntereses = pago > pagoNoIntereses + 0.005 && pagoNoIntereses > 0;

  const descripcionMinimo = (() => {
    const c = configPagoMinimo;
    if (!c.pagoMinimoMetodo) return 'Sin método en el Taller: el mínimo es el saldo total';
    const partes = [c.pagoMinimoMetodo];
    if (c.pagoMinimoPorcentaje) partes.push(`${c.pagoMinimoPorcentaje}%`);
    if (c.pagoMinimoMonto) partes.push(`mín. ${formatCurrency(c.pagoMinimoMonto)}`);
    return partes.join(' · ');
  })();

  const handleSimular = () => {
    if (autorizado <= 0) {
      toast.error('Monto Autorizado requerido', { description: 'Capture el Monto Autorizado en Términos y Condiciones.' });
      return;
    }
    if (disposicion <= 0 || excedeAutorizado) {
      toast.error('Monto Promedio de Disposición inválido', {
        description: `Debe ser mayor a cero y menor o igual al Monto Autorizado (${formatCurrency(autorizado)}).`,
      });
      return;
    }
    if (pago <= 0) {
      toast.error('Pago Periodo requerido', { description: 'Capture el pago que el cliente realizará cada periodo.' });
      return;
    }
    if (excedeNoIntereses) {
      toast.error('Pago Periodo excede la deuda', {
        description: `No puede ser mayor al Pago para No Generar Intereses (${formatCurrency(pagoNoIntereses)}).`,
      });
      return;
    }
    if (tasaOrd <= 0 && pago < pagoNoIntereses) {
      toast.error('Tasa Ordinaria requerida', { description: 'Capture la tasa en Términos y Condiciones o en este simulador.' });
      return;
    }
    if (tasaMor <= 0 && escenarioVivo === 3) {
      toast.error('Tasa Moratoria requerida', { description: 'El escenario 3 genera interés moratorio: capture la tasa.' });
      return;
    }

    const r = simularTDC({
      montoDisposicion: disposicion,
      pagoPeriodo: pago,
      tasaOrdinariaAnual: tasaOrd,
      tasaMoratoriaAnual: tasaMor,
      ivaPct,
      configPagoMinimo,
      fechaInicio,
      diaCorte,
      diasParaPago,
    });
    if (!r.ok) {
      toast.error('No se pudo simular', { description: r.error });
      return;
    }
    setSt(prev => ({ ...prev, resultado: r }));

    // Vigencia de la solicitud = vigencia de la cotización: inicia con la
    // disposición y termina en la fecha límite de pago del último periodo.
    // Si la deuda nunca se paga no hay fecha fin que proponer.
    onFechaInicioChange?.(aDDMMYYYY(fechaInicio));
    const ultimo = r.renglones[r.renglones.length - 1];
    if (r.liquida && ultimo) onFechaFinChange?.(aDDMMYYYY(ultimo.fechaLimitePago));
    if (r.liquida) {
      toast.success('Simulación generada', {
        description: `${ESCENARIOS[r.escenario].titulo} · ${r.renglones.length} periodo(s) · Total pagado ${formatCurrency(r.totales.pagado)}`,
        duration: 4000,
      });
    } else {
      toast.warning('Bajo este escenario la deuda nunca se paga', {
        description: r.pagoMinimoParaLiquidar !== undefined
          ? `Pago mínimo para liquidarla: ${formatCurrency(r.pagoMinimoParaLiquidar)} por periodo (${r.periodosParaLiquidar} periodos).`
          : 'El Pago Periodo no cubre los intereses que se generan.',
        duration: 6000,
      });
    }
  };

  const res = st.resultado;
  const labelClass = 'block text-[11px] mb-1 text-gray-700';
  const inputClass = `w-full px-2 py-1 text-xs border rounded focus:outline-none border-gray-300 ${
    isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-[#4A6FA5]'
  }`;
  const heredadoClass = 'w-full px-2 py-1 text-xs bg-[#EEF3FA] border border-gray-200 rounded text-gray-800 font-medium';

  const campoMoneda = (label: string, k: 'montoDisposicion' | 'pagoPeriodo', error?: string) => (
    <div>
      <label className={labelClass}>{label} <span className="text-red-600">*</span></label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={st[k]}
          disabled={isRO}
          onChange={e => set(k, e.target.value)}
          onBlur={() => { const n = num(st[k]); if (n > 0) set(k, fmtMonto(n)); }}
          className={`${inputClass} pl-5 text-right ${error ? 'border-red-400' : ''}`}
        />
      </div>
      {error && <p className="text-[11px] text-red-600 mt-0.5">{error}</p>}
    </div>
  );

  const campoTasa = (label: string, k: 'tasaOrdinaria' | 'tasaMoratoria', nota?: string) => (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={st[k]}
          disabled={isRO}
          onChange={e => set(k, e.target.value)}
          className={`${inputClass} pr-6 text-right`}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">%</span>
      </div>
      {nota && <p className="text-[11px] text-gray-500 mt-0.5">{nota}</p>}
    </div>
  );

  const notaMoratoria = num(porcentajeMoratorioProducto) > 0
    ? 'Del producto (% moratorio)'
    : num(factorMoratorioProducto) > 0
      ? `Ordinaria × ${num(factorMoratorioProducto)} (factor del producto)`
      : 'Capture la tasa moratoria anual';

  return (
    <div className="border border-gray-200 bg-white p-0">
      <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">SIMULACIÓN DE PAGOS — TARJETA DE CRÉDITO</span>
        {!isRO && (
          <button
            onClick={handleSimular}
            className="px-4 py-1.5 btn-secondary-theme rounded text-xs flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6.5 1v5.5L9 9" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6.5" cy="6.5" r="5.5" />
            </svg>
            Simular
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* ── Parámetros ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Monto Autorizado</label>
            <div className={`${heredadoClass} text-right`}>{autorizado > 0 ? formatCurrency(autorizado) : '—'}</div>
            <p className="text-[11px] text-gray-500 mt-0.5">De Términos y Condiciones</p>
          </div>
          {campoTasa('Tasa Ordinaria anual', 'tasaOrdinaria', 'De Términos y Condiciones')}
          {campoTasa('Tasa Moratoria anual', 'tasaMoratoria', notaMoratoria)}

          {campoMoneda(
            'Monto Promedio de Disposición',
            'montoDisposicion',
            excedeAutorizado ? `No puede exceder el Monto Autorizado (${formatCurrency(autorizado)})` : undefined,
          )}
          <div>
            <label className={labelClass}>Pago para No Generar Intereses</label>
            <div className={`${heredadoClass} text-right`}>{formatCurrency(pagoNoIntereses)}</div>
            <p className="text-[11px] text-gray-500 mt-0.5">Igual al total dispuesto</p>
          </div>
          <div>
            <label className={labelClass}>Pago Mínimo del Periodo</label>
            <div className={`${heredadoClass} text-right`}>{formatCurrency(pagoMinimo)}</div>
            <p className="text-[11px] text-gray-500 mt-0.5">Taller del producto: {descripcionMinimo}</p>
          </div>

          <div className="md:col-span-1">
            {campoMoneda(
              'Pago Periodo',
              'pagoPeriodo',
              excedeNoIntereses ? 'No puede exceder el Pago para No Generar Intereses' : undefined,
            )}
            {!isRO && disposicion > 0 && (
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => set('pagoPeriodo', fmtMonto(pagoNoIntereses))}
                  className="px-2 py-0.5 text-[11px] border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                >
                  Usar Pago No Intereses
                </button>
                <button
                  type="button"
                  onClick={() => set('pagoPeriodo', fmtMonto(pagoMinimo))}
                  className="px-2 py-0.5 text-[11px] border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                >
                  Usar Pago Mínimo
                </button>
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            {escenarioVivo ? (
              <div className={`border rounded px-3 py-2 ${ESCENARIOS[escenarioVivo].cls}`}>
                <p className="text-xs font-medium">{ESCENARIOS[escenarioVivo].titulo}</p>
                <p className="text-[11px] mt-0.5">{ESCENARIOS[escenarioVivo].detalle}</p>
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded px-3 py-2 text-[11px] text-gray-500">
                Capture el Monto Promedio de Disposición y el Pago Periodo para identificar el escenario.
              </div>
            )}
          </div>
        </div>

        <p className="text-[11px] text-gray-500">
          Cortes mensuales{diaCorte ? ` el día ${diaCorte}` : ''} a partir del {fmtFecha(fechaInicio)} · fecha límite a {diasParaPago || 20} días del corte ·
          interés = saldo × tasa anual / 360 × 30 · IVA {ivaPct}% sobre intereses · prelación: IVA, moratorio, ordinario, capital.
        </p>

        {/* ── Resultado ── */}
        {!res ? (
          <div className="p-8 text-center text-gray-500 text-sm border border-gray-200 rounded">
            No hay simulación generada. Capture los montos y presione <strong>Simular</strong>.
          </div>
        ) : (
          <>
            <div className={`border rounded px-3 py-2 ${ESCENARIOS[res.escenario].cls}`}>
              <p className="text-xs font-medium">Resultado: {ESCENARIOS[res.escenario].titulo}</p>
            </div>

            {!res.liquida && (
              <>
                <div className="px-3 py-2 bg-red-50 border border-red-300 rounded text-xs text-red-800">
                  Bajo este escenario <strong>la deuda nunca se paga</strong>: con un Pago Periodo de{' '}
                  {formatCurrency(num(st.pagoPeriodo))} los intereses, el IVA y el moratorio que se generan cada periodo
                  no permiten que el saldo llegue a cero. Se muestran los primeros {res.renglones.length} periodos.
                </div>
                {res.pagoMinimoParaLiquidar !== undefined && (
                  <div className="px-3 py-2 bg-blue-50 border border-blue-300 rounded text-xs text-blue-900 flex items-center justify-between gap-3">
                    <span>
                      Pago mínimo para que la deuda sí se pague:{' '}
                      <strong>{formatCurrency(res.pagoMinimoParaLiquidar)}</strong> por periodo — se liquidaría en{' '}
                      {res.periodosParaLiquidar} periodo(s).
                    </span>
                    {!isRO && (
                      <button
                        type="button"
                        onClick={() => set('pagoPeriodo', fmtMonto(res.pagoMinimoParaLiquidar!))}
                        className="px-2 py-0.5 text-[11px] border border-blue-300 rounded bg-white hover:bg-blue-100 text-blue-900 whitespace-nowrap"
                      >
                        Usar este pago
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {res.escenario === 2 && res.generoMoratorio && (
              <div className="px-3 py-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-800">
                En periodos posteriores el pago mínimo (que incluye intereses) superó el Pago Periodo, por lo que se generó
                interés moratorio aunque el primer corte cumplía el mínimo.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                ['Periodos', String(res.renglones.length), 'text-gray-900'],
                ['Total Pagado', formatCurrency(res.totales.pagado), 'text-gray-900'],
                ['Capital', formatCurrency(res.totales.capital), 'text-gray-900'],
                ['Interés Ordinario', formatCurrency(res.totales.interesOrdinario), 'text-amber-800'],
                ['Interés Moratorio', formatCurrency(res.totales.interesMoratorio), 'text-red-800'],
                ['IVA', formatCurrency(res.totales.iva), 'text-gray-900'],
              ].map(([t, v, c]) => (
                <div key={t} className="bg-gray-50 border border-gray-200 rounded p-3">
                  <span className="text-[11px] text-gray-600">{t}</span>
                  <p className={`text-sm font-medium ${c}`}>{v}</p>
                </div>
              ))}
            </div>

            <div className="border border-gray-300 overflow-auto max-h-[460px]">
              <table className="w-full text-xs">
                <thead className="bg-[#2E5C91] text-white sticky top-0">
                  <tr>
                    {['Periodo', 'Fecha Corte', 'Fecha Límite', 'Capital Inicial', 'Int. Ordinario', 'Int. Moratorio', 'IVA',
                      'Pendiente Ant.', 'Saldo al Corte', 'Pago Mínimo', 'Pago Realizado', 'A Intereses + IVA', 'A Capital',
                      'Saldo Vencido', 'Saldo Final'].map((h, i) => (
                      <th key={h} className={`px-2 py-2 font-medium whitespace-nowrap ${i < 3 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.renglones.map((r, idx) => (
                    <tr key={r.periodo} className="border-b border-gray-200" style={{ backgroundColor: idx % 2 ? '#F5F5F5' : '#FFFFFF' }}>
                      <td className="px-2 py-1.5 text-gray-700">{r.periodo}</td>
                      <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{fmtFecha(r.fechaCorte)}</td>
                      <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{fmtFecha(r.fechaLimitePago)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.capitalInicial)}</td>
                      <td className="px-2 py-1.5 text-right text-amber-800">{formatCurrency(r.interesOrdinario)}</td>
                      <td className="px-2 py-1.5 text-right text-red-700">{formatCurrency(r.interesMoratorio)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.iva)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pendienteAnterior)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-800 font-medium">{formatCurrency(r.saldoTotalCorte)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pagoMinimo)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-800 font-medium">{formatCurrency(r.pagoRealizado)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-700">
                        {formatCurrency(r.aplicadoIva + r.aplicadoMoratorio + r.aplicadoOrdinario)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.aplicadoCapital)}</td>
                      <td className={`px-2 py-1.5 text-right ${r.saldoVencido > 0 ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
                        {formatCurrency(r.saldoVencido)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-900 font-medium">{formatCurrency(r.saldoFinal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-400 font-medium">
                    <td className="px-2 py-2 text-gray-800" colSpan={4}>TOTALES</td>
                    <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(res.totales.interesOrdinario)}</td>
                    <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(res.totales.interesMoratorio)}</td>
                    <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(res.totales.iva)}</td>
                    <td colSpan={3} />
                    <td className="px-2 py-2 text-right text-gray-900 font-bold">{formatCurrency(res.totales.pagado)}</td>
                    <td className="px-2 py-2 text-right text-gray-800">
                      {formatCurrency(res.totales.pagado - res.totales.capital)}
                    </td>
                    <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(res.totales.capital)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
