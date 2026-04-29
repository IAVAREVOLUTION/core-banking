import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  SimulacionRow, TerminosCondiciones, EMPTY_TERMINOS,
  saveToSession, loadFromSession, loadFromSavedStore,
  MOCK_SIMULACION, MOCK_TERMINOS, formatCurrency, generarSimulacion, parseCurrency,
  CAT_FRECUENCIA,
} from './solicitudCreditoStore';
import { FlujInversionRow, calcularFlujInversion, TASA_ISR_ANUAL } from '../cotizaciones/cotizacionCaptacionTypes';

interface AportacionRow {
  noAportacion: number;
  fecha: string;
  monto: number;
  moneda: string;
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  lineaProducto: string;
  tipoProducto?: string;
  /** Calendario de aportaciones heredado desde Cotización — solo Captación/Aportación */
  calendarioAportaciones?: AportacionRow[];
  /** Tabla de amortización heredada desde Cotización — solo Crédito/Línea de Crédito */
  simulacionInicial?: SimulacionRow[];
  /** Monto autorizado de la solicitud — usado para simulación de aportaciones */
  montoAutorizado?: number;
  /** Notifica la fecha del último pago cuando cambia la tabla/calendario */
  onFechaFinChange?: (fecha: string) => void;
}

/** Determina si el producto es de tipo Captación/Aportación (no crédito) */
function esCaptacion(lineaProducto: string, tipoProducto?: string): boolean {
  const linea = (lineaProducto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // lineaProducto es la señal definitiva — si dice 'credito' nunca es captación
  if (linea.includes('cred')) return false;
  if (linea.includes('captac') || linea.includes('ahorro') || linea.includes('invers')) return true;
  // Solo usar tipoProducto como señal secundaria cuando lineaProducto es ambiguo
  const tipo = (tipoProducto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (tipo.includes('aportac') || tipo.includes('ahorro') || tipo.includes('captac') || tipo.includes('invers')) return true;
  return false;
}

/** Convierte YYYY-MM-DD o DD/MM/YYYY → Date. Retorna null si inválida. */
function parseDate(f: string): Date | null {
  if (!f) return null;
  const parts = f.split('/');
  if (parts.length === 3 && parts[0].length === 2) {
    // DD/MM/YYYY
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = f.split('-');
  if (iso.length === 3 && iso[0].length === 4) {
    // YYYY-MM-DD
    const d = new Date(parseInt(iso[0]), parseInt(iso[1]) - 1, parseInt(iso[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Formatea Date → DD/MM/YYYY (interno) */
function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Formatea fecha (DD/MM/YYYY o YYYY-MM-DD) → "DD-mon-YYYY" igual que Cotización */
function formatDateCalendar(f: string): string {
  if (!f) return '—';
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  // DD/MM/YYYY
  const slash = f.split('/');
  if (slash.length === 3 && slash[0].length === 2) {
    return `${slash[0]}-${months[parseInt(slash[1]) - 1]}-${slash[2]}`;
  }
  // YYYY-MM-DD
  const dash = f.split('-');
  if (dash.length === 3 && dash[0].length === 4) {
    return `${dash[2]}-${months[parseInt(dash[1]) - 1]}-${dash[0]}`;
  }
  return f;
}

/**
 * Convierte plazo en meses + frecuencia → número real de periodos de pago.
 * Reglas: mensual=plazo, quincenal/catorcenal=plazo*2, semanal=plazo*4,
 *         trimestral=plazo/3, semestral=plazo/6, anual=plazo/12.
 */
export function calcularNumeroPeriodos(plazoMeses: number, frecuencia: string): number {
  if (plazoMeses <= 0) return 1;
  const f = (frecuencia || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (f.includes('semana'))                         return Math.round(plazoMeses * 4);
  if (f.includes('catorce') || f.includes('quincen')) return Math.round(plazoMeses * 2);
  if (f.includes('mensual'))                        return plazoMeses;
  if (f.includes('trimest'))                        return Math.max(1, Math.round(plazoMeses / 3));
  if (f.includes('semest'))                         return Math.max(1, Math.round(plazoMeses / 6));
  if (f.includes('anual'))                          return Math.max(1, Math.round(plazoMeses / 12));
  return plazoMeses; // default: asumir mensual
}

/**
 * Genera un calendario de aportaciones — lógica idéntica a Cotización (generarCalendario).
 * @param montoTotal  — monto TOTAL de la inversión/aportación
 * @param plazo       — número EXACTO de aportaciones (no meses — igual que plazoCumplirMontoMinimo en Cotización)
 * @param frecuencia  — periodicidad (Mensual, Quincenal, Semanal…) — solo afecta el intervalo entre fechas
 * @param fechaInicio — DD/MM/YYYY o YYYY-MM-DD
 * @param moneda      — código de moneda
 */
function generarCalendarioAportaciones(
  montoTotal: number,
  plazo: number,
  frecuencia: string,
  fechaInicio: string,
  moneda: string
): AportacionRow[] {
  if (montoTotal <= 0 || plazo <= 0) return [];
  const diasPeriodo = CAT_FRECUENCIA.find(f => f.value === frecuencia)?.dias || 30;

  // Monto base para las primeras aportaciones
  const montoBase = Math.floor((montoTotal / plazo) * 100) / 100;
  // La última aportación completa para llegar al total exacto
  const montoRestante = Math.round((montoTotal - (montoBase * (plazo - 1))) * 100) / 100;

  let currentDate = parseDate(fechaInicio);
  if (!currentDate) {
    currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + diasPeriodo);
  }

  const rows: AportacionRow[] = [];
  for (let i = 1; i <= plazo; i++) {
    // La última aportación tiene el monto restante para total exacto
    const monto = (i === plazo) ? montoRestante : montoBase;
    rows.push({
      noAportacion: i,
      fecha: fmtDate(currentDate),
      monto: monto,
      moneda: moneda || 'MXN',
    });
    currentDate = new Date(currentDate.getTime() + diasPeriodo * 86400000);
  }
  return rows;
}

export function SimulacionTab({ mode, solicitudId, lineaProducto, tipoProducto, calendarioAportaciones, simulacionInicial, montoAutorizado, onFechaFinChange }: Props) {
  const isRO = mode === 'ver';
  const isCap = esCaptacion(lineaProducto, tipoProducto);
  const _tpRaw = (tipoProducto || lineaProducto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const isInversion = isCap && _tpRaw.includes('invers');

  // ── Amortización (solo crédito) ──
  const getInitRows = (): SimulacionRow[] => {
    if (isCap) return [];
    const s = loadFromSession<SimulacionRow[]>(solicitudId, 'simulacion');
    if (s) return s;
    if (mode === 'nuevo') {
      // Semilla desde cotización si se pasó como prop
      if (simulacionInicial && simulacionInicial.length > 0) return simulacionInicial;
      return [];
    }
    const saved = loadFromSavedStore<SimulacionRow[]>(solicitudId, 'simulacion');
    if (saved) return saved;
    const mock = MOCK_SIMULACION[solicitudId as number];
    return mock ? [...mock] : [];
  };

  const [rows, setRows] = useState<SimulacionRow[]>(getInitRows);

  // Flag para evitar carga múltiple
  const hasLoadedFromSession = useRef(false);

  // Si no había nada en storage y llega después (prop cotización o sessionStorage), cargar una sola vez
  useEffect(() => {
    if (hasLoadedFromSession.current) return;
    if (rows && rows.length > 0) {
      hasLoadedFromSession.current = true;
      return;
    }
    // Intentar sessionStorage primero
    const fromSession = loadFromSession<SimulacionRow[]>(solicitudId, 'simulacion');
    if (fromSession && fromSession.length > 0) {
      hasLoadedFromSession.current = true;
      setRows(fromSession);
      console.log('[SimulacionTab] Rows cargadas desde sessionStorage:', fromSession.length);
      return;
    }
    // Fallback: prop de cotización (cuando llega después del mount inicial)
    if (simulacionInicial && simulacionInicial.length > 0) {
      hasLoadedFromSession.current = true;
      setRows(simulacionInicial);
      console.log('[SimulacionTab] Rows cargadas desde cotización (prop):', simulacionInicial.length);
    }
  }, [solicitudId, simulacionInicial]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calendario de aportaciones (captación) ──
  // Prioridad: sessionStorage > savedStore > prop (cotización heredada)
  const getInitCalRows = (): AportacionRow[] | null => {
    const fromSession = loadFromSession<AportacionRow[]>(solicitudId, 'simulacion_cal');
    console.log('[SimulacionTab] getInitCalRows | solicitudId:', solicitudId, '| isCap:', isCap, '| mode:', mode,
      '| fromSession:', fromSession ? `${fromSession.length} rows` : 'null',
      '| prop calendarioAportaciones:', calendarioAportaciones ? `${calendarioAportaciones.length} rows` : 'null');
    if (fromSession && fromSession.length > 0) { console.log('[SimulacionTab] → usando SESSION'); return fromSession; }
    // Para solicitudes nuevas, SAVED_DATA['new'] puede tener datos de una sesión anterior.
    // Solo usar savedStore en editar/ver, no en nuevo.
    if (mode !== 'nuevo') {
      const fromSaved = loadFromSavedStore<AportacionRow[]>(solicitudId, 'simulacion_cal');
      console.log('[SimulacionTab] fromSavedStore:', fromSaved ? `${fromSaved.length} rows` : 'null');
      if (fromSaved && fromSaved.length > 0) { console.log('[SimulacionTab] → usando SAVED_STORE'); return fromSaved; }
    }
    if (calendarioAportaciones && calendarioAportaciones.length > 0) { console.log('[SimulacionTab] → usando PROP'); return calendarioAportaciones; }
    console.log('[SimulacionTab] → null (sin datos)');
    return null;
  };

  const [calRows, setCalRows] = useState<AportacionRow[] | null>(getInitCalRows);

  // Si no había nada en storage y la prop llega luego (carga asíncrona), usarla una sola vez
  useEffect(() => {
    if (calRows) return; // ya tenemos datos, no sobrescribir
    if (calendarioAportaciones && calendarioAportaciones.length > 0) {
      setCalRows(calendarioAportaciones);
    }
  }, [calendarioAportaciones]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persistir amortización en sessionStorage
  useEffect(() => {
    if (!isRO && !isCap) saveToSession(solicitudId, 'simulacion', rows);
  }, [rows, solicitudId, isRO, isCap]);

  // Persistir calendario de aportaciones en sessionStorage
  useEffect(() => {
    if (!isRO && isCap && calRows) saveToSession(solicitudId, 'simulacion_cal', calRows);
  }, [calRows, solicitudId, isRO, isCap]);

  // Notificar fecha del último pago a SolicitudCreditoForm → campo "Fecha Fin"
  useEffect(() => {
    if (!onFechaFinChange || isCap) return;
    const last = rows[rows.length - 1];
    if (last?.fechaPago) onFechaFinChange(last.fechaPago);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onFechaFinChange || !isCap) return;
    const last = calRows?.[calRows.length - 1];
    if (last?.fecha) onFechaFinChange(last.fecha);
  }, [calRows]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Leer Términos y Condiciones actualizados desde sessionStorage ──
  const readTerminos = (): TerminosCondiciones => {
    return (
      loadFromSession<TerminosCondiciones>(solicitudId, 'terminos') ||
      loadFromSavedStore<TerminosCondiciones>(solicitudId, 'terminos') ||
      MOCK_TERMINOS[solicitudId as number] ||
      EMPTY_TERMINOS
    );
  };

  // ── Tabla de Flujo de Inversión ──
  const getInitInvRows = (): FlujInversionRow[] | null => {
    const s = loadFromSession<FlujInversionRow[]>(solicitudId, 'simulacion_inv');
    if (s && s.length > 0) return s;
    if (mode !== 'nuevo') {
      const saved = loadFromSavedStore<FlujInversionRow[]>(solicitudId, 'simulacion_inv');
      if (saved && saved.length > 0) return saved;
    }
    return null;
  };

  const [invRows, setInvRows] = useState<FlujInversionRow[] | null>(isInversion ? getInitInvRows : null);

  useEffect(() => {
    if (!isRO && isInversion && invRows) saveToSession(solicitudId, 'simulacion_inv', invRows);
  }, [invRows, solicitudId, isRO, isInversion]);

  useEffect(() => {
    if (!onFechaFinChange || !isInversion || !invRows) return;
    const last = invRows[invRows.length - 1];
    if (last?.fechaInversion) onFechaFinChange(last.fechaInversion);
  }, [invRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSimularInversion = () => {
    const terminos = readTerminos();
    const montoBase = (montoAutorizado && montoAutorizado > 0) ? montoAutorizado : parseFloat(parseCurrency(terminos.montoSolicitado || '0'));
    const tasa = parseFloat(String(terminos.tasa || '0').replace(/[^0-9.-]/g, ''));
    const plazo = parseInt(String(terminos.plazo || '0'));
    const frecuencia = terminos.frecuencia || 'Mensual';
    const fechaRaw = terminos.fechaPrimeraAportacion || terminos.fechaPrimerPago || '';
    // Normalize DD/MM/YYYY → YYYY-MM-DD for calcularFlujInversion
    const normalizarFecha = (f: string): string => {
      const parts = f.split('/');
      if (parts.length === 3 && parts[0].length === 2) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      return f;
    };
    const fechaInicio = normalizarFecha(fechaRaw);
    const metodo = terminos.metodoIntereses || 'Al vencimiento';

    if (montoBase <= 0 || tasa <= 0 || plazo <= 0) {
      toast.error('Datos insuficientes', {
        description: `Complete Monto (${montoBase}), Tasa (${tasa}) y Plazo (${plazo}) en Términos y Condiciones.`,
        duration: 4000,
      });
      return;
    }
    if (!fechaInicio) {
      toast.error('Fecha de Inversión requerida', { description: 'Complete la Fecha de Inversión en Términos y Condiciones.', duration: 3000 });
      return;
    }

    const newRows = calcularFlujInversion(montoBase, tasa, plazo, frecuencia, fechaInicio, metodo, TASA_ISR_ANUAL);
    setInvRows(newRows);
    saveToSession(solicitudId, 'simulacion_inv', newRows);
    toast.success('Tabla de flujo generada', { description: `${newRows.length} período(s) · Método: ${metodo}`, duration: 3000 });
  };

  // ── Simular Crédito ──
  const handleSimularCredito = () => {
    const terminos = readTerminos();
    const montoSol = parseFloat(parseCurrency(terminos.montoSolicitado || '0'));
    // Monto Autorizado tiene prioridad sobre Monto Solicitado en Términos
    const monto = (montoAutorizado && montoAutorizado > 0) ? montoAutorizado : montoSol;
    const tasa = parseFloat(String(terminos.tasa || '0').replace(/[^0-9.-]/g, ''));
    const plazo = parseInt(String(terminos.plazo || '0'));
    const frecuencia = terminos.frecuencia || 'Mensual';
    const fechaPrimerPago = terminos.fechaPrimerPago || '';
    const tipoCalculo = terminos.tipoCalculo || 'Francés';
    const seguro = terminos.seguroFinanciado
      ? parseFloat(parseCurrency(terminos.montoSeguro || '0')) / (plazo || 1)
      : 0;

    if (monto <= 0 || tasa <= 0 || plazo <= 0) {
      toast.error('Datos insuficientes', {
        description: `Complete Monto (${ monto }), Tasa (${ tasa }) y Plazo (${ plazo }) en Términos y Condiciones.`,
        duration: 4000,
      });
      return;
    }

    const newRows = generarSimulacion(monto, tasa, plazo, frecuencia, fechaPrimerPago, tipoCalculo, seguro);
    setRows(newRows);
    saveToSession(solicitudId, 'simulacion', newRows);
    const fuenteMonto = (montoAutorizado && montoAutorizado > 0) ? 'Monto Autorizado' : 'Monto Solicitado';
    toast.success('Simulación generada', { description: `${newRows.length} pagos (${tipoCalculo}) · ${fuenteMonto}: ${formatCurrency(monto)}`, duration: 3000 });
  };

  // ── Simular Captación/Aportación ──
  const handleSimularAportaciones = () => {
    const terminos = readTerminos();
    // Prioridad: montoAutorizado (si existe y > 0) > montoSolicitado
    const montoBase = (montoAutorizado && montoAutorizado > 0) ? montoAutorizado : parseFloat(parseCurrency(terminos.montoSolicitado || '0'));
    const monto = montoBase;
    const plazo = parseInt(String(terminos.plazo || '0'));
    const frecuencia = terminos.frecuencia || 'Mensual';
    const fechaInicio = terminos.fechaPrimeraAportacion || terminos.fechaPrimerPago || '';
    const moneda = terminos.moneda || 'MXN';

    if (monto <= 0 || plazo <= 0) {
      toast.error('Datos insuficientes', {
        description: `Complete Monto (${ monto }) y Plazo (${ plazo }) en Términos y Condiciones.`,
        duration: 4000,
      });
      return;
    }

    const newCal = generarCalendarioAportaciones(monto, plazo, frecuencia, fechaInicio, moneda);
    setCalRows(newCal);
    saveToSession(solicitudId, 'simulacion_cal', newCal);
    const montoPorPeriodo = newCal.length > 0 ? newCal[0].monto : 0;
    const fuente = (montoAutorizado && montoAutorizado > 0) ? 'Monto Autorizado' : 'Monto Solicitado';
    toast.success('Calendario recalculado', {
      description: `${newCal.length} aportaciones · ${formatCurrency(montoPorPeriodo)} c/u · Total: ${formatCurrency(monto)} (${fuente})`,
      duration: 3000,
    });
  };

  // ════════════════════════════════════════════════
  // INVERSIÓN A PLAZO — tabla de flujo
  // ════════════════════════════════════════════════
  if (isInversion) {
    const terminos = readTerminos();
    const metodoActual = terminos.metodoIntereses || 'Al vencimiento';
    const totalInteresBruto = invRows ? invRows.reduce((s, r) => s + r.interesBruto, 0) : 0;
    const totalISR = invRows ? invRows.reduce((s, r) => s + r.retencionISR, 0) : 0;
    const totalInteresNeto = invRows ? invRows.reduce((s, r) => s + r.interesNeto, 0) : 0;
    const capitalFinalTotal = invRows && invRows.length > 0 ? invRows[invRows.length - 1].capitalFinal : 0;

    return (
      <div className="border border-gray-200 bg-white p-0">
        <div className="border-t border-gray-300">
          <div className="bg-purple-50 border-l-4 border-purple-500 px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-purple-900">TABLA DE FLUJO DE INVERSIÓN</span>
            {!isRO && (
              <button
                onClick={handleSimularInversion}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs flex items-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6.5 1v5.5L9 9" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="6.5" cy="6.5" r="5.5"/>
                </svg>
                Cotizar
              </button>
            )}
          </div>

          {!invRows ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-3">
                <rect x="6" y="10" width="36" height="30" rx="3" />
                <path d="M6 18h36" /><path d="M16 6v8M32 6v8" />
              </svg>
              <p>No se ha generado la tabla de flujo de inversión.</p>
              <p className="text-xs text-gray-400 mt-1">
                Complete los Términos y Condiciones y presione <strong>Cotizar</strong>.
              </p>
            </div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-purple-50 border border-purple-200 rounded p-3">
                  <span className="text-[10px] text-purple-600">Método</span>
                  <p className="text-base font-medium text-purple-900">{metodoActual}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <span className="text-[10px] text-green-600">Interés Bruto Total</span>
                  <p className="text-base font-medium text-green-800">{formatCurrency(totalInteresBruto)}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <span className="text-[10px] text-red-600">Retención ISR Total</span>
                  <p className="text-base font-medium text-red-800">{formatCurrency(totalISR)}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <span className="text-[10px] text-blue-600">Capital Final</span>
                  <p className="text-base font-medium text-blue-900">{formatCurrency(capitalFinalTotal)}</p>
                </div>
              </div>

              <div className="border border-gray-300 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-purple-700 text-white">
                      <th className="px-3 py-2.5 text-center font-medium whitespace-nowrap">Período</th>
                      <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Fecha</th>
                      <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Capital Inicial</th>
                      <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Interés Bruto</th>
                      <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Retención ISR</th>
                      <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Interés Neto</th>
                      <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Capital Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invRows.map((r, idx) => (
                      <tr
                        key={r.periodo}
                        className="border-b border-gray-200"
                        style={{ backgroundColor: idx % 2 === 1 ? '#F5F3FF' : '#FFFFFF' }}
                      >
                        <td className="px-3 py-2 text-center text-gray-700">{r.periodo}</td>
                        <td className="px-3 py-2 text-gray-700">{formatDateCalendar(r.fechaInversion)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(r.capitalInicial)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(r.interesBruto)}</td>
                        <td className="px-3 py-2 text-right text-red-700">{formatCurrency(r.retencionISR)}</td>
                        <td className="px-3 py-2 text-right text-green-700">{formatCurrency(r.interesNeto)}</td>
                        <td className="px-3 py-2 text-right font-medium text-purple-800">{formatCurrency(r.capitalFinal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 border-t-2 border-gray-400 font-medium">
                      <td colSpan={3} className="px-3 py-2.5 text-xs text-gray-800">TOTALES</td>
                      <td className="px-3 py-2.5 text-xs text-right text-gray-800">{formatCurrency(totalInteresBruto)}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-red-800">{formatCurrency(totalISR)}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-green-800">{formatCurrency(totalInteresNeto)}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-purple-900 font-bold">{formatCurrency(capitalFinalTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // CAPTACIÓN / APORTACIÓN
  // ════════════════════════════════════════════════
  if (isCap) {
    const totalMonto = calRows ? calRows.reduce((s, r) => s + r.monto, 0) : 0;

    const terminos = readTerminos();
    const frecuenciaActual = terminos.frecuencia || 'Mensual';

    return (
      <div className="border border-gray-200 bg-white p-0">
        <div className="border-t border-gray-300">
          <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">CALENDARIO DE APORTACIONES</span>
            {!isRO && (
              <button
                onClick={handleSimularAportaciones}
                className="px-4 py-1.5 btn-secondary-theme rounded text-xs flex items-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6.5 1v5.5L9 9" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="6.5" cy="6.5" r="5.5"/>
                </svg>
                Simular
              </button>
            )}
          </div>

          {!calRows ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-3">
                <rect x="6" y="10" width="36" height="30" rx="3" />
                <path d="M6 18h36" />
                <path d="M16 6v8M32 6v8" />
              </svg>
              <p>No se ha generado un calendario de aportaciones.</p>
              <p className="text-xs text-gray-400 mt-1">
                Complete los Términos y Condiciones y presione <strong>Simular</strong> para generar el calendario.
              </p>
            </div>
          ) : (
            <div className="p-4">
              {/* Resumen — igual que Cotización */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <span className="text-[10px] text-blue-600">Total Aportaciones</span>
                  <p className="text-lg text-blue-800">{calRows.length}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <span className="text-[10px] text-green-600">Monto por Aportación</span>
                  <p className="text-lg text-green-800">{calRows[0] ? formatCurrency(calRows[0].monto) : '—'}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <span className="text-[10px] text-amber-600">Periodo</span>
                  <p className="text-lg text-amber-800">{frecuenciaActual}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded p-3">
                  <span className="text-[10px] text-purple-600">Monto Total</span>
                  <p className="text-lg text-purple-800">{formatCurrency(totalMonto)}</p>
                </div>
              </div>

              {/* Tabla — igual que Cotización */}
              <div className="border border-gray-300 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">No Aportación</th>
                      <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">Fecha de Aportación</th>
                      <th className="px-3 py-2.5 text-right font-normal text-xs text-gray-700 whitespace-nowrap">Monto de Aportación</th>
                      <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">Moneda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calRows.map((r, idx) => (
                      <tr
                        key={r.noAportacion}
                        className="border-b border-gray-200 transition-colors duration-150"
                        style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E8F4F8')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF')}
                      >
                        <td className="px-3 py-2 text-xs text-center text-gray-700">{r.noAportacion}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{formatDateCalendar(r.fecha)}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-right">{formatCurrency(r.monto)}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 text-center">{r.moneda || 'MXN'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 border-t border-gray-300">
                      <td colSpan={2} className="px-3 py-2.5 text-xs font-medium text-gray-800 text-right">Total:</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-gray-800 text-right">{formatCurrency(totalMonto)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 text-center">{calRows[0]?.moneda || 'MXN'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // CRÉDITO / LÍNEA DE CRÉDITO — tabla de amortización
  // ════════════════════════════════════════════════
  const tableTitle = lineaProducto === 'Línea de Crédito' ? 'Tabla de Amortización' : 'Tabla de Pagos';
  const totalCapital = rows.reduce((s, r) => s + r.pagoCapital, 0);
  const totalInteres = rows.reduce((s, r) => s + r.pagoInteres, 0);
  const totalIVA = rows.reduce((s, r) => s + r.ivaInteres, 0);
  const totalSeguro = rows.reduce((s, r) => s + r.pagoSeguro, 0);
  const totalPago = rows.reduce((s, r) => s + r.pagoTotal, 0);

  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-800">{tableTitle}</h4>
        {!isRO && (
          <button
            onClick={handleSimularCredito}
            className="px-4 py-1.5 btn-secondary-theme rounded text-xs flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6.5 1v5.5L9 9" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="6.5" cy="6.5" r="5.5"/>
            </svg>
            Simular
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-xs">
          <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#ccc" strokeWidth="1.5">
            <rect x="5" y="8" width="30" height="24" rx="2" />
            <path d="M5 14h30M13 8v6M20 8v6M27 8v6" />
          </svg>
          No hay simulación generada. Complete los Términos y Condiciones y presione "Simular".
        </div>
      ) : (
        <>
          <div className="border border-gray-300 overflow-auto max-h-[400px]">
            <table className="w-full text-xs">
              <thead className="bg-[#2E5C91] text-white sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">N° Pago</th>
                  <th className="px-2 py-2 text-left font-medium">Fecha</th>
                  <th className="px-2 py-2 text-right font-medium">Saldo Insoluto</th>
                  <th className="px-2 py-2 text-right font-medium">Capital</th>
                  <th className="px-2 py-2 text-right font-medium">Interés</th>
                  <th className="px-2 py-2 text-right font-medium">IVA</th>
                  <th className="px-2 py-2 text-right font-medium">Pago Periodo</th>
                  {totalSeguro > 0 && <th className="px-2 py-2 text-right font-medium">Seguro</th>}
                  <th className="px-2 py-2 text-right font-medium">Pago Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r.noPago}
                    className="border-b border-gray-200"
                    style={{ backgroundColor: idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF' }}
                  >
                    <td className="px-2 py-1.5 text-gray-700">{r.noPago}</td>
                    <td className="px-2 py-1.5 text-gray-700">{r.fechaPago}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.saldoInsoluto)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pagoCapital)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pagoInteres)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.ivaInteres)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pagoPeriodo)}</td>
                    {totalSeguro > 0 && <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pagoSeguro)}</td>}
                    <td className="px-2 py-1.5 text-right font-medium text-gray-800">{formatCurrency(r.pagoTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-400 font-medium">
                  <td className="px-2 py-2 text-gray-800" colSpan={2}>TOTALES</td>
                  <td className="px-2 py-2 text-right text-gray-600">—</td>
                  <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalCapital)}</td>
                  <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalInteres)}</td>
                  <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalIVA)}</td>
                  <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalCapital + totalInteres + totalIVA)}</td>
                  {totalSeguro > 0 && <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalSeguro)}</td>}
                  <td className="px-2 py-2 text-right text-gray-900 font-bold">{formatCurrency(totalPago)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-3 text-xs text-gray-500 flex items-center gap-4">
            <span>Total Pagos: {rows.length}</span>
            <span>Monto Total: {formatCurrency(totalPago)}</span>
          </div>
        </>
      )}
    </div>
  );
}
