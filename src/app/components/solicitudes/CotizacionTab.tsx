import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  CotizacionRow, saveToSession, loadFromSession, loadFromSavedStore, generateId,
  MOCK_COTIZACIONES, formatCurrency, parseCurrency,
} from './solicitudCreditoStore';

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  /** Datos del formulario maestro para generar tabla de amortización */
  formContext?: {
    montoAutorizado: string;
    montoSolicitado: string;
    tasaAutorizada: string;
    plazoAutorizado: string;
    plazos: string;
    periodo: string;
    fechaInicio: string;
  };
}

/** Parsea fecha DD/MM/YYYY → Date */
function parseDateDDMMYYYY(d: string): Date | null {
  if (!d) return null;
  const [dd, mm, yyyy] = d.split('/');
  if (!dd || !mm || !yyyy) return null;
  const y = parseInt(yyyy);
  return new Date(y < 100 ? 2000 + y : y, parseInt(mm) - 1, parseInt(dd));
}

/** Formatea Date → DD/MM/YYYY */
function fmtDate(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

/** Avanza la fecha según el periodo */
function advanceDate(base: Date, periodIndex: number, periodo: string): Date {
  const d = new Date(base);
  if (periodo === 'Semanal') {
    d.setDate(d.getDate() + 7 * periodIndex);
  } else if (periodo === 'Quincenal') {
    d.setDate(d.getDate() + 15 * periodIndex);
  } else {
    // Mensual (default)
    d.setMonth(d.getMonth() + periodIndex);
  }
  return d;
}

/** Periodos por año según tipo de periodo */
function periodosAnuales(periodo: string): number {
  if (periodo === 'Semanal') return 52;
  if (periodo === 'Quincenal') return 24;
  return 12; // Mensual
}

export function CotizacionTab({ mode, solicitudId, formContext }: Props) {
  const getInit = (): CotizacionRow[] => {
    const s = loadFromSession<CotizacionRow[]>(solicitudId, 'cotizacion');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<CotizacionRow[]>(solicitudId, 'cotizacion');
    if (saved) return saved;
    return MOCK_COTIZACIONES[solicitudId as number] || [];
  };

  const [rows, setRows] = useState<CotizacionRow[]>(getInit);
  const isRO = mode === 'ver';

  useEffect(() => { if (mode !== 'ver') saveToSession(solicitudId, 'cotizacion', rows); }, [rows, solicitudId, mode]);

  // ── Determinar valores para la tabla ──
  const getMontoBase = (): number => {
    if (!formContext) return 0;
    // Prioridad: montoAutorizado > montoSolicitado
    const ma = parseFloat(parseCurrency(formContext.montoAutorizado || '0'));
    if (!isNaN(ma) && ma > 0) return ma;
    const ms = parseFloat(parseCurrency(formContext.montoSolicitado || '0'));
    return !isNaN(ms) && ms > 0 ? ms : 0;
  };

  const getTasa = (): number => {
    if (!formContext) return 0;
    const t = parseFloat((formContext.tasaAutorizada || '0').replace(/[^0-9.-]/g, ''));
    return !isNaN(t) && t > 0 ? t : 0;
  };

  const getPlazo = (): number => {
    if (!formContext) return 0;
    // Prioridad: plazoAutorizado > plazos (del catálogo)
    const pa = parseInt(formContext.plazoAutorizado || '0');
    if (!isNaN(pa) && pa > 0) return pa;
    const pl = parseInt(formContext.plazos || '0');
    return !isNaN(pl) && pl > 0 ? pl : 0;
  };

  const getPeriodo = (): string => formContext?.periodo || 'Mensual';

  const getFechaInicio = (): Date => {
    if (formContext?.fechaInicio) {
      const parsed = parseDateDDMMYYYY(formContext.fechaInicio);
      if (parsed) return parsed;
    }
    return new Date();
  };

  const montoBase = getMontoBase();
  const tasaAnual = getTasa();
  const plazoTotal = getPlazo();
  const periodo = getPeriodo();
  const canGenerate = montoBase > 0 && tasaAnual > 0 && plazoTotal > 0;

  // ── Resumen de parámetros ──
  const resumenParams = () => {
    if (!formContext) return null;
    return (
      <div className="grid grid-cols-5 gap-3 mb-3 px-1">
        <div className="bg-white border border-gray-200 rounded px-3 py-2">
          <span className="text-[10px] text-gray-500 block">Monto</span>
          <span className="text-xs text-gray-800">{montoBase > 0 ? formatCurrency(montoBase) : '—'}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded px-3 py-2">
          <span className="text-[10px] text-gray-500 block">Tasa Anual</span>
          <span className="text-xs text-gray-800">{tasaAnual > 0 ? `${tasaAnual.toFixed(4)}%` : '—'}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded px-3 py-2">
          <span className="text-[10px] text-gray-500 block">Plazo</span>
          <span className="text-xs text-gray-800">{plazoTotal > 0 ? `${plazoTotal} periodos` : '—'}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded px-3 py-2">
          <span className="text-[10px] text-gray-500 block">Periodo</span>
          <span className="text-xs text-gray-800">{periodo}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded px-3 py-2">
          <span className="text-[10px] text-gray-500 block">Fecha Inicio</span>
          <span className="text-xs text-gray-800">{formContext?.fechaInicio || '—'}</span>
        </div>
      </div>
    );
  };

  const handleGenerar = () => {
    if (!canGenerate) {
      const missing: string[] = [];
      if (montoBase <= 0) missing.push('Monto Autorizado o Solicitado');
      if (tasaAnual <= 0) missing.push('Tasa Autorizada');
      if (plazoTotal <= 0) missing.push('Plazo Autorizado o Plazos');
      toast.error('No se puede generar la cotización', {
        description: `Complete en el formulario principal: ${missing.join(', ')}`,
        duration: 5000,
      });
      return;
    }

    const ppAnuales = periodosAnuales(periodo);
    const tasaPeriodo = tasaAnual / 100 / ppAnuales;
    const fechaBase = getFechaInicio();

    // Fórmula de pago fijo (amortización francesa)
    const pago = montoBase * (tasaPeriodo * Math.pow(1 + tasaPeriodo, plazoTotal)) / (Math.pow(1 + tasaPeriodo, plazoTotal) - 1);

    const newRows: CotizacionRow[] = [];
    let saldo = montoBase;
    const baseId = generateId();

    for (let i = 1; i <= plazoTotal; i++) {
      const interes = saldo * tasaPeriodo;
      const capital = pago - interes;
      const iva = interes * 0.16;
      const saldoFinal = Math.max(0, saldo - capital);
      const fechaPago = advanceDate(fechaBase, i, periodo);

      newRows.push({
        id: baseId + i,
        numeroPago: i,
        fechaPago: fmtDate(fechaPago),
        saldoInicial: parseFloat(saldo.toFixed(2)),
        capital: parseFloat(capital.toFixed(2)),
        interes: parseFloat(interes.toFixed(2)),
        iva: parseFloat(iva.toFixed(2)),
        pagoTotal: parseFloat((pago + iva).toFixed(2)),
        saldoFinal: parseFloat(saldoFinal.toFixed(2)),
      });
      saldo = saldoFinal;
    }

    setRows(newRows);
    toast.success('Tabla de amortización generada', {
      description: `${plazoTotal} pagos — ${periodo} — Pago fijo: ${formatCurrency(pago)}`,
      duration: 4000,
    });
  };

  const handleLimpiar = () => {
    setRows([]);
    toast.success('Tabla de amortización eliminada');
  };

  // ── Totales ──
  const totales = rows.reduce((acc, r) => ({
    capital: acc.capital + r.capital,
    interes: acc.interes + r.interes,
    iva: acc.iva + r.iva,
    pagoTotal: acc.pagoTotal + r.pagoTotal,
  }), { capital: 0, interes: 0, iva: 0, pagoTotal: 0 });

  return (
    <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5">
          <span className="text-xs text-gray-800">TABLA DE AMORTIZACIÓN</span>
        </div>
        {!isRO && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerar}
              className={`px-4 py-1.5 rounded text-xs ${canGenerate ? 'btn-secondary-theme' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              title={!canGenerate ? 'Complete Monto, Tasa y Plazo en el formulario principal' : 'Generar tabla de amortización'}
            >
              Generar Cotización
            </button>
            {rows.length > 0 && (
              <button onClick={handleLimpiar} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50">
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resumen de parámetros calculados */}
      {resumenParams()}

      {/* Mensaje si no se puede generar */}
      {!canGenerate && rows.length === 0 && !isRO && (
        <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 mb-3 text-xs text-yellow-700">
          Para generar la cotización, complete en el formulario principal: <strong>Monto Autorizado</strong> (o Solicitado), <strong>Tasa Autorizada</strong> y <strong>Plazo Autorizado</strong> (o Plazos).
        </div>
      )}

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300 w-[60px]">N° Pago</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[110px]">Fecha Pago</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Saldo Inicial</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Capital</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Interés</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">IVA</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Pago Total</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-right">Saldo Final</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Genere una cotización con el botón superior' : 'Sin tabla de amortización'}</td></tr>
            ) : (
              <>
                {rows.map((r, idx) => (
                  <tr key={r.id} className={`border-b border-gray-200 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50`}>
                    <td className="px-3 py-1.5 text-xs text-center border-r border-gray-200">{r.numeroPago}</td>
                    <td className="px-3 py-1.5 text-xs border-r border-gray-200">{r.fechaPago}</td>
                    <td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{formatCurrency(r.saldoInicial)}</td>
                    <td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{formatCurrency(r.capital)}</td>
                    <td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{formatCurrency(r.interes)}</td>
                    <td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{formatCurrency(r.iva)}</td>
                    <td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{formatCurrency(r.pagoTotal)}</td>
                    <td className="px-3 py-1.5 text-xs text-right">{formatCurrency(r.saldoFinal)}</td>
                  </tr>
                ))}
                {/* Fila de totales */}
                <tr className="bg-[#D9E2F3] border-t-2 border-[#4A6FA5]">
                  <td colSpan={3} className="px-3 py-2 text-xs text-gray-800 text-right border-r border-gray-300">TOTALES</td>
                  <td className="px-3 py-2 text-xs text-right border-r border-gray-300 text-gray-800">{formatCurrency(totales.capital)}</td>
                  <td className="px-3 py-2 text-xs text-right border-r border-gray-300 text-gray-800">{formatCurrency(totales.interes)}</td>
                  <td className="px-3 py-2 text-xs text-right border-r border-gray-300 text-gray-800">{formatCurrency(totales.iva)}</td>
                  <td className="px-3 py-2 text-xs text-right border-r border-gray-300 text-gray-800">{formatCurrency(totales.pagoTotal)}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-800">{formatCurrency(rows[rows.length - 1]?.saldoFinal ?? 0)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}