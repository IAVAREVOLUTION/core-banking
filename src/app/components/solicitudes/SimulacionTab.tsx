import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import {
  SimulacionRow, TerminosCondiciones, EMPTY_TERMINOS,
  saveToSession, loadFromSession, loadFromSavedStore,
  MOCK_SIMULACION, MOCK_TERMINOS, formatCurrency, generarSimulacion, parseCurrency,
  CAT_FRECUENCIA,
} from './solicitudCreditoStore';
import { FlujInversionRow, calcularFlujInversion, TASA_ISR_ANUAL } from '../cotizaciones/cotizacionCaptacionTypes';
import { generarTablaArrendamiento, generarTablaArrendamientoFinanciero, type SimulacionArrendamiento } from '../cotizaciones/cotizacionArrendamientoTypes';

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
  /** Monto capturado en el encabezado (Plazos y Montos), bruto — respaldo cuando montoAutorizado aún no se calculó (Términos y Condiciones nunca se visitó) */
  montoSolicitadoHeader?: string;
  /** Plazo capturado en el encabezado — prioridad sobre terminos.plazo (Simular no requiere haber visitado Términos y Condiciones) */
  plazoHeader?: string;
  /** Tasa autocompletada en el encabezado (Matriz de Tasa Fija) — prioridad sobre terminos.tasa */
  tasaHeader?: string;
  /** Fecha Inicio del encabezado — respaldo cuando terminos.fechaPrimerPago aún no se sincronizó (Términos y Condiciones nunca se visitó) */
  fechaInicioHeader?: string;
  /** Frecuencia autocompletada desde la Matriz de Tasa Fija (encabezado) — respaldo cuando terminos.frecuencia aún no se sincronizó */
  frecuenciaHeader?: string;
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

/** Normaliza DD/MM/YYYY o YYYY-MM-DD → YYYY-MM-DD. Retorna '' si inválida. */
function toIsoDate(f: string): string {
  const d = parseDate(f);
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

export function SimulacionTab({ mode, solicitudId, lineaProducto, tipoProducto, calendarioAportaciones, simulacionInicial, montoAutorizado, montoSolicitadoHeader, plazoHeader, tasaHeader, fechaInicioHeader, frecuenciaHeader, onFechaFinChange }: Props) {
  const isRO = mode === 'ver';
  const isCap = esCaptacion(lineaProducto, tipoProducto);
  const _tpRaw = (tipoProducto || lineaProducto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const isInversion = isCap && _tpRaw.includes('invers');
  // Puro y Financiero comparten TODA la maquinaria de calendario (estado,
  // persistencia en `simulacion_arrendamiento` → `calendario_arrendamiento`,
  // rentas anticipadas, Cartera de Arrendamiento). Lo único que cambia es qué
  // motor lo genera y qué columnas se pintan.
  const isArrendamiento = !isCap && _tpRaw.includes('arrendamiento');
  const isArrFinanciero = isArrendamiento && !_tpRaw.includes('puro');
  /**
   * Garantía Financiera 2o Piso (GPO) — comisión periódica, no amortización.
   *
   * BUG FIX (2026-08-25): detectaba solo por nombre (`_tpRaw.includes('garant')`),
   * pero la Solicitud real que genera el Cierre Comercial guarda
   * tipo_producto = "Simple" y linea_producto = "Línea de Crédito" — ninguno
   * de los dos contiene "garant", así que isGPO daba false y la pestaña
   * pintaba columnas de amortización de crédito (Saldo Insoluto, Capital)
   * sobre filas que son comisiones. La señal confiable es el propio dato GPO
   * en Términos y Condiciones, que solo existe en este producto.
   */
  const _terminosGPO =
    loadFromSession<TerminosCondiciones>(solicitudId, 'terminos') ||
    loadFromSavedStore<TerminosCondiciones>(solicitudId, 'terminos');
  // Mismo respaldo que TerminosCondicionesTab: el JSONB original nunca pasa
  // por el round-trip de 'terminos', así que sobrevive a los desfases de
  // hidratación que dejaban la sesión sin los campos GPO.
  const _origRawGPO =
    (loadFromSession<any>(solicitudId, '_originalData') ||
      loadFromSavedStore<any>(solicitudId, '_originalData'))
      ?.solicitud?.terminos_condiciones?._raw || {};
  const isGPO = !isCap && !isArrendamiento && (
    _tpRaw.includes('garant') ||
    !!_terminosGPO?.periodicidadCobroGpo ||
    !!_terminosGPO?.porcentajeCoberturaGpo ||
    !!_origRawGPO.periodicidadCobroGpo ||
    !!_origRawGPO.porcentajeCoberturaGpo
  );

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

  // ── Tabla de Arrendamiento Puro ──
  const getInitArrRows = (): SimulacionArrendamiento | null => {
    const s = loadFromSession<SimulacionArrendamiento>(solicitudId, 'simulacion_arrendamiento');
    if (s) return s;
    if (mode !== 'nuevo') {
      const saved = loadFromSavedStore<SimulacionArrendamiento>(solicitudId, 'simulacion_arrendamiento');
      if (saved) return saved;
    }
    return null;
  };

  const [arrRows, setArrRows] = useState<SimulacionArrendamiento | null>(isArrendamiento ? getInitArrRows : null);

  useEffect(() => {
    if (!isRO && isArrendamiento && arrRows) saveToSession(solicitudId, 'simulacion_arrendamiento', arrRows);
  }, [arrRows, solicitudId, isRO, isArrendamiento]);

  useEffect(() => {
    if (!onFechaFinChange || !isArrendamiento || !arrRows) return;
    const last = arrRows.calendario[arrRows.calendario.length - 1];
    if (last?.fechaPago) onFechaFinChange(last.fechaPago);
  }, [arrRows]); // eslint-disable-line react-hooks/exhaustive-deps

  // El parámetro Rentas Anticipadas es la fuente de verdad del estatus de las
  // primeras N rentas. Se reaplica aquí sobre el calendario ya generado para que
  // cambiar el parámetro en Términos y Condiciones se refleje al volver a este
  // subtab, sin obligar al usuario a simular de nuevo.
  const arrRowsView = useMemo<SimulacionArrendamiento | null>(() => {
    if (!isArrendamiento || !arrRows) return arrRows;
    const n = Math.max(0, Math.min(
      parseInt(String(readTerminos().rentasAnticipadas || '0'), 10) || 0,
      arrRows.calendario.length
    ));
    const yaAplicado = arrRows.calendario.every((r, idx) =>
      idx < n ? r.estatus === 'Pagado' : r.estatus !== 'Pagado'
    );
    if (yaAplicado) return arrRows;
    return {
      ...arrRows,
      calendario: arrRows.calendario.map((r, idx) =>
        idx < n
          ? { ...r, estatus: 'Pagado' as const }
          : (r.estatus === 'Pagado' ? { ...r, estatus: 'Pendiente' as const } : r)
      ),
      rentasAnticipadasDescontadas: arrRows.calendario.slice(0, n),
    };
  }, [arrRows, isArrendamiento]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSimularInversion = () => {
    const terminos = readTerminos();
    const montoBase = (montoAutorizado && montoAutorizado > 0) ? montoAutorizado : parseFloat(parseCurrency(montoSolicitadoHeader || terminos.montoSolicitado || '0'));
    const tasa = parseFloat((tasaHeader || terminos.tasa || '0').replace(/[^0-9.-]/g, ''));
    const plazo = parseInt(String(plazoHeader || terminos.plazo || '0'));
    const frecuencia = terminos.frecuencia || frecuenciaHeader || 'Mensual';
    const fechaRaw = terminos.fechaPrimeraAportacion || terminos.fechaPrimerPago || fechaInicioHeader || '';
    const fechaInicio = toIsoDate(fechaRaw);
    const metodo = terminos.metodoIntereses || 'Al vencimiento';

    if (montoBase <= 0 || tasa <= 0 || plazo <= 0) {
      toast.error('Datos insuficientes', {
        description: `Complete Monto (${montoBase}), Tasa (${tasa}) y Plazo (${plazo}) en Plazos y Montos / Términos y Condiciones.`,
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
  /** Valor GPO con respaldo al JSONB original (misma cadena frágil que Términos). */
  const gpoVal = (campo: string): string => {
    const v = (_terminosGPO as any)?.[campo];
    if (v !== undefined && v !== null && v !== '') return String(v);
    const f = _origRawGPO[campo];
    return f !== undefined && f !== null && f !== '' ? String(f) : '';
  };

  /**
   * "Cotizar" — recalcula el flujo de comisiones GPO de UN AÑO.
   *
   * No es amortización: el Monto Garantizado no se abona, solo se cobra la
   * comisión pactada por periodo. El número de renglones lo fija la
   * periodicidad (Anual→1, Semestral→2, Trimestral→4, Mensual→12), igual que
   * el cálculo que hace el Cierre Comercial en la Oportunidad.
   */
  // Cubre TODO CAT_FRECUENCIA (solicitudCreditoStore) — antes solo tenía 4
  // entradas, así que elegir Semanal/Catorcenal/Quincenal daba 0 periodos y
  // abortaba la cotización con "Datos insuficientes".
  const PERIODOS_ANIO_GPO: Record<string, number> = {
    Semanal: 52, Catorcenal: 26, Quincenal: 24, Mensual: 12,
    Trimestral: 4, Semestral: 2, Anual: 1,
  };

  const handleCotizarGPO = () => {
    // Términos leídos EN EL CLIC, no del render. `_terminosGPO`/`gpoVal` son
    // constantes de render: si este acordeón ya estaba montado cuando el
    // usuario cambió la Frecuencia en Términos y Condiciones, el handler
    // cerraba sobre el snapshot viejo y seguía cotizando con el valor
    // anterior. El resto de los handlers de este archivo (handleSimularCredito,
    // handleSimularArrendamiento…) ya usaban readTerminos() por esta razón.
    const terminosAlClic = readTerminos();
    const gpoAlClic = (campo: string): string => {
      const v = (terminosAlClic as any)?.[campo];
      if (v !== undefined && v !== null && v !== '') return String(v);
      const f = _origRawGPO[campo];
      return f !== undefined && f !== null && f !== '' ? String(f) : '';
    };

    const montoGarantizado = parseFloat(parseCurrency(gpoAlClic('montoGarantizadoGpo') || '0')) || 0;
    const tasaComision = parseFloat(gpoAlClic('tasaComisionAnualPactada') || '0') || 0;
    // La periodicidad de la cotización sale de la Frecuencia que el usuario
    // captura en Términos y Condiciones — es el campo editable y el que ve en
    // pantalla. periodicidadCobroGpo es el valor heredado de la Oportunidad y
    // se pinta deshabilitado; queda solo como último respaldo.
    // La cadencia de la comisión la fija SOLO la Periodicidad Cobro Comisión
    // (heredada de la Oportunidad). Deliberadamente NO se usan aquí:
    //   · `frecuencia`  → es la periodicidad del PRODUCTO (matriz de tasa fija)
    //   · `plazo`       → es la duración del financiamiento
    // Son tres conceptos distintos; mezclarlos fue la causa de que la
    // cotización saliera con una periodicidad que nadie había elegido.
    const periodicidad = gpoAlClic('periodicidadCobroGpo');
    const periodosPorAnio = PERIODOS_ANIO_GPO[periodicidad] || 0;

    if (montoGarantizado <= 0 || tasaComision <= 0 || !periodosPorAnio) {
      toast.error('Datos insuficientes para cotizar', {
        description: `Revise Monto Garantizado (${montoGarantizado}), Tasa Comisión (${tasaComision}%) y Periodicidad Cobro Comisión (${periodicidad || 'sin capturar'}) en Términos y Condiciones.`,
        duration: 5000,
      });
      return;
    }

    // Conserva la tasa de IVA con la que se generó la tabla original (el
    // producto puede tener un % distinto al 16 general); si no hay tabla
    // previa de dónde deducirla, usa el 16% general.
    //
    // BUG FIX: antes bastaba con que pagoInteres > 0 para deducir la tasa. Si
    // la tabla heredada traía ivaInteres = 0 (la Oportunidad la generó con un
    // % de IVA sin capturar), la división daba 0% y la columna "IVA del
    // Periodo" se quedaba en $0.00 para siempre: recotizar volvía a deducir 0
    // de sus propias filas. Solo se deduce del histórico cuando ese histórico
    // efectivamente trae IVA; si no, se cae al 16%.
    const ivaPct = rows.length > 0 && rows[0].pagoInteres > 0 && rows[0].ivaInteres > 0
      ? (rows[0].ivaInteres / rows[0].pagoInteres) * 100
      : 16;

    const ingresoAnual = montoGarantizado * (tasaComision / 100);
    const ingresoPorPeriodo = ingresoAnual / periodosPorAnio;
    const ivaPorPeriodo = ingresoPorPeriodo * (ivaPct / 100);
    const mesesPorPeriodo = 12 / periodosPorAnio;

    // Horizonte fijo de 1 AÑO: la proyección de comisión es anual y no se
    // extiende al plazo contratado del producto. Mensual→12, Trimestral→4,
    // Semestral→2, Anual→1.
    const totalPeriodos = periodosPorAnio;

    const nuevas: SimulacionRow[] = [];
    let fecha = new Date();
    for (let i = 0; i < totalPeriodos; i++) {
      fecha = new Date(fecha.getFullYear(), fecha.getMonth() + mesesPorPeriodo, fecha.getDate());
      nuevas.push({
        noPago: i + 1,
        fechaPago: fecha.toISOString().split('T')[0],
        saldoInsoluto: montoGarantizado,
        pagoCapital: 0,
        pagoInteres: ingresoPorPeriodo,
        ivaInteres: ivaPorPeriodo,
        pagoPeriodo: ingresoPorPeriodo,
        pagoSeguro: 0,
        pagoTotal: ingresoPorPeriodo + ivaPorPeriodo,
      });
    }

    setRows(nuevas);
    saveToSession(solicitudId, 'simulacion', nuevas);
    toast.success('Cotización generada', {
      description: `${nuevas.length} comisión(es) al año · ${periodicidad} · Total ${formatCurrency(nuevas.reduce((s, r) => s + r.pagoTotal, 0))}`,
      duration: 4000,
    });
  };

  const handleSimularCredito = () => {
    const terminos = readTerminos();
    const montoSol = parseFloat(parseCurrency(montoSolicitadoHeader || terminos.montoSolicitado || '0'));
    // Monto Autorizado tiene prioridad sobre Monto Solicitado en Términos
    const monto = (montoAutorizado && montoAutorizado > 0) ? montoAutorizado : montoSol;
    // Plazo/Tasa del encabezado tienen prioridad — Simular no requiere haber
    // visitado Términos y Condiciones (Plazo se captura en Plazos y Montos).
    const tasa = parseFloat((tasaHeader || terminos.tasa || '0').replace(/[^0-9.-]/g, ''));
    const plazo = parseInt(String(plazoHeader || terminos.plazo || '0'));
    const frecuencia = terminos.frecuencia || frecuenciaHeader || 'Mensual';
    const fechaPrimerPago = toIsoDate(terminos.fechaPrimerPago || fechaInicioHeader || '');
    const tipoCalculo = terminos.tipoCalculo || 'Francés';
    const seguro = terminos.seguroFinanciado
      ? parseFloat(parseCurrency(terminos.montoSeguro || '0')) / (plazo || 1)
      : 0;

    if (monto <= 0 || tasa <= 0 || plazo <= 0) {
      toast.error('Datos insuficientes', {
        description: `Complete Monto (${ monto }), Tasa (${ tasa }) y Plazo (${ plazo }) en Plazos y Montos / Términos y Condiciones.`,
        duration: 4000,
      });
      return;
    }

    // Arrendamiento Financiero: descuenta el valor residual configurado en
    // Términos y Condiciones — la tabla de amortización converge a ese saldo
    // en vez de a cero (Crédito tradicional no tiene residual, siempre 0).
    const montoResidual = terminos.montoResidual || 0;
    const newRows = generarSimulacion(monto, tasa, plazo, frecuencia, fechaPrimerPago, tipoCalculo, seguro, montoResidual);
    setRows(newRows);
    saveToSession(solicitudId, 'simulacion', newRows);
    toast.success('Simulación generada', { description: `${newRows.length} pagos (${tipoCalculo}) · Monto Autorizado: ${formatCurrency(monto)}`, duration: 3000 });
  };

  // ── Simular Arrendamiento Puro ──
  const handleSimularArrendamiento = () => {
    const terminos = readTerminos();
    const monto = (montoAutorizado && montoAutorizado > 0)
      ? montoAutorizado
      : parseFloat(String(terminos.montoAutorizado || montoSolicitadoHeader || '0'));
    const montoResidual = terminos.montoResidual || 0;
    const tasa = parseFloat((tasaHeader || terminos.tasa || '0').replace(/[^0-9.-]/g, ''));
    const plazo = parseInt(String(plazoHeader || terminos.plazo || '0'));
    const frecuencia = terminos.frecuencia || frecuenciaHeader || 'Mensual';
    const fechaPrimerPago = toIsoDate(terminos.fechaPrimerPago || fechaInicioHeader || '');
    const seguro = terminos.seguroFinanciado
      ? parseFloat(parseCurrency(terminos.montoSeguro || '0')) / (plazo || 1)
      : 0;
    const numRentasAnticipadas = parseInt(String(terminos.rentasAnticipadas || '0'), 10) || 0;

    if (monto <= 0 || tasa <= 0 || plazo <= 0) {
      toast.error('Datos insuficientes', {
        description: `Complete Monto Autorizado (${monto}), Tasa (${tasa}) y Plazo (${plazo}) en Plazos y Montos / Términos y Condiciones.`,
        duration: 4000,
      });
      return;
    }
    if (!fechaPrimerPago) {
      toast.error('Fecha requerida', { description: 'Complete la Fecha Inicio en el encabezado o la Fecha Primer Pago en Términos y Condiciones.', duration: 4000 });
      return;
    }

    // Arrendamiento Financiero usa su propio motor: tabla de amortización con
    // saldo insoluto que converge al Valor Residual e IVA sobre la renta
    // completa. Puro conserva el calendario de rentas de siempre.
    const generar = isArrFinanciero ? generarTablaArrendamientoFinanciero : generarTablaArrendamiento;

    const resultado = generar({
      montoAutorizado: monto,
      montoResidual,
      tasaAnual: tasa,
      plazoMeses: plazo,
      frecuencia,
      fechaPrimerPago,
      seguroPorPeriodo: seguro,
      numRentasAnticipadas,
    });
    setArrRows(resultado);
    saveToSession(solicitudId, 'simulacion_arrendamiento', resultado);
    toast.success(isArrFinanciero ? 'Tabla de amortización generada' : 'Simulación generada', {
      description: `${resultado.calendario.length} rentas · Monto Autorizado: ${formatCurrency(monto)}${numRentasAnticipadas > 0 ? ` · ${numRentasAnticipadas} renta(s) anticipada(s) en Cargos` : ''}`,
      duration: 3500,
    });
  };

  // ── Simular Captación/Aportación ──
  const handleSimularAportaciones = () => {
    const terminos = readTerminos();
    // Prioridad: montoAutorizado (si existe y > 0) > montoSolicitado
    const montoBase = (montoAutorizado && montoAutorizado > 0) ? montoAutorizado : parseFloat(parseCurrency(montoSolicitadoHeader || terminos.montoSolicitado || '0'));
    const monto = montoBase;
    const plazo = parseInt(String(plazoHeader || terminos.plazo || '0'));
    const frecuencia = terminos.frecuencia || frecuenciaHeader || 'Mensual';
    const fechaInicio = terminos.fechaPrimeraAportacion || terminos.fechaPrimerPago || fechaInicioHeader || '';
    const moneda = terminos.moneda || 'MXN';

    if (monto <= 0 || plazo <= 0) {
      toast.error('Datos insuficientes', {
        description: `Complete Monto (${ monto }) y Plazo (${ plazo }) en Plazos y Montos / Términos y Condiciones.`,
        duration: 4000,
      });
      return;
    }

    const newCal = generarCalendarioAportaciones(monto, plazo, frecuencia, fechaInicio, moneda);
    setCalRows(newCal);
    saveToSession(solicitudId, 'simulacion_cal', newCal);
    const montoPorPeriodo = newCal.length > 0 ? newCal[0].monto : 0;
    toast.success('Calendario recalculado', {
      description: `${newCal.length} aportaciones · ${formatCurrency(montoPorPeriodo)} c/u · Total: ${formatCurrency(monto)} (Monto Autorizado)`,
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
          <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">TABLA DE FLUJO DE INVERSIÓN</span>
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
                    <tr className="bg-[#2E5C91] text-white">
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
  // ARRENDAMIENTO PURO
  // ════════════════════════════════════════════════
  if (isArrendamiento) {
    const totalPago = arrRowsView ? arrRowsView.calendario.reduce((s, r) => s + r.pagoPeriodo, 0) : 0;

    const estatusBadge = (estatus: string) => {
      const cls =
        estatus === 'Pagado' ? 'bg-green-50 text-green-700 border-green-200' :
        estatus === 'Vencido' ? 'bg-red-50 text-red-700 border-red-200' :
        'bg-amber-50 text-amber-700 border-amber-200';
      // "Renta" es femenino: se etiqueta "Pagada" sin cambiar el valor interno 'Pagado'.
      const label = estatus === 'Pagado' ? 'Pagada' : estatus;
      return <span className={`px-1.5 py-0.5 text-[9px] border rounded ${cls}`}>{label}</span>;
    };

    return (
      <div className="border border-gray-200 bg-white p-0">
        <div className="border-t border-gray-300">
          <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">
              {isArrFinanciero
                ? 'TABLA DE AMORTIZACIÓN — ARRENDAMIENTO FINANCIERO'
                : 'CALENDARIO DE PAGOS — ARRENDAMIENTO PURO'}
            </span>
            {!isRO && (
              <button
                onClick={handleSimularArrendamiento}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs flex items-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6.5 1v5.5L9 9" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="6.5" cy="6.5" r="5.5"/>
                </svg>
                Simular
              </button>
            )}
          </div>

          {!arrRowsView || arrRowsView.calendario.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No hay simulación generada. Complete los Términos y Condiciones y presione "Simular".
            </div>
          ) : (
            <div className="p-4">
              {arrRowsView.rentasAnticipadasDescontadas.length > 0 && (
                <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 text-xs text-blue-800">
                  Las primeras {arrRowsView.rentasAnticipadasDescontadas.length} renta(s) aparecen como <strong>Pagada</strong> por
                  tratarse de rentas anticipadas — se cobran en el subtab <strong>Cargos</strong> como parte del desembolso inicial.
                </div>
              )}
              <div className="border border-gray-300 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                      <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold border-r border-gray-300">{isArrFinanciero ? 'N° PAGO' : 'NO. RENTA'}</th>
                      <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">FECHA</th>
                      {isArrFinanciero && <>
                        <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">SALDO INSOLUTO</th>
                        <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">CAPITAL</th>
                        <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">INTERÉS</th>
                      </>}
                      <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">{isArrFinanciero ? 'RENTA BASE' : 'RENTA SIN IVA'}</th>
                      {isArrFinanciero
                        ? <>
                            <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">IVA DE LA RENTA</th>
                            <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">SEGURO</th>
                          </>
                        : <>
                            <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">SEGURO</th>
                            <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">IVA</th>
                          </>}
                      <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">{isArrFinanciero ? 'PAGO DEL PERIODO' : 'PAGO PERIODO'}</th>
                      <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold">ESTATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arrRowsView.calendario.map((r, idx) => (
                      <tr key={r.noRenta} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-1.5 text-center border-r border-gray-200">{r.noRenta}</td>
                        <td className="px-3 py-1.5 border-r border-gray-200">{formatDateCalendar(r.fechaPago)}</td>
                        {isArrFinanciero && <>
                          <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{formatCurrency(r.saldoInsoluto ?? 0)}</td>
                          <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{formatCurrency(r.capital ?? 0)}</td>
                          <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{formatCurrency(r.interes ?? 0)}</td>
                        </>}
                        <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{formatCurrency(r.rentaSinIva)}</td>
                        {isArrFinanciero
                          ? <>
                              <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{formatCurrency(r.iva)}</td>
                              <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{formatCurrency(r.seguro)}</td>
                            </>
                          : <>
                              <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{formatCurrency(r.seguro)}</td>
                              <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{formatCurrency(r.iva)}</td>
                            </>}
                        <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono font-medium">{formatCurrency(r.pagoPeriodo)}</td>
                        <td className="px-3 py-1.5 text-center">{estatusBadge(r.estatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 border-t-2 border-gray-400 font-medium">
                      <td colSpan={isArrFinanciero ? 8 : 5} className="px-3 py-2.5 text-xs text-gray-800">
                        {isArrFinanciero ? 'TOTAL DE LA TABLA' : 'TOTAL CALENDARIO'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right text-gray-800 font-mono">{formatCurrency(totalPago)}</td>
                      <td />
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
  const tableTitle = isGPO ? 'Cotización — Comisiones GPO' : lineaProducto === 'Línea de Crédito' ? 'Cotización' : 'Tabla de Pagos';
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
            onClick={isGPO ? handleCotizarGPO : handleSimularCredito}
            title={isGPO
              ? 'Recalcula las comisiones GPO del año con los datos de Términos y Condiciones'
              : 'Genera la tabla de amortización'}
            className="px-4 py-1.5 btn-secondary-theme rounded text-xs flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6.5 1v5.5L9 9" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="6.5" cy="6.5" r="5.5"/>
            </svg>
            {isGPO ? 'Cotizar' : 'Simular'}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-xs">
          <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#ccc" strokeWidth="1.5">
            <rect x="5" y="8" width="30" height="24" rx="2" />
            <path d="M5 14h30M13 8v6M20 8v6M27 8v6" />
          </svg>
          {isGPO
            ? 'No hay comisiones generadas. Presione "Cotizar" para calcularlas con los datos de Términos y Condiciones.'
            : 'No hay simulación generada. Complete los Términos y Condiciones y presione "Simular".'}
        </div>
      ) : isGPO ? (
        /*
         * BUG FIX (2026-08-25): esta tabla venía pintando columnas de
         * amortización de crédito (Saldo Insoluto, Capital) sobre filas que
         * en realidad son comisiones GPO — no hay capital que amortizar, la
         * GPO solo cobra una comisión periódica sobre el Monto Garantizado.
         * Spec: Fecha, Comisión del periodo, IVA del periodo y Total; el
         * número de líneas ya viene acotado a 1 año (ver
         * construirSimulacionComisionGPO en OportunidadForm.tsx).
         */
        <>
          <div className="border border-gray-300 overflow-auto max-h-[400px]">
            <table className="w-full text-xs">
              <thead className="bg-[#2E5C91] text-white sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Fecha</th>
                  <th className="px-2 py-2 text-right font-medium">Comisión del Periodo</th>
                  <th className="px-2 py-2 text-right font-medium">IVA del Periodo</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r.noPago}
                    className="border-b border-gray-200"
                    style={{ backgroundColor: idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF' }}
                  >
                    <td className="px-2 py-1.5 text-gray-700">{formatDateCalendar(r.fechaPago)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pagoInteres)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.ivaInteres)}</td>
                    <td className="px-2 py-1.5 text-right font-medium text-gray-800">{formatCurrency(r.pagoTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-400 font-medium">
                  <td className="px-2 py-2 text-gray-800">TOTALES ({rows.length})</td>
                  <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalInteres)}</td>
                  <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalIVA)}</td>
                  <td className="px-2 py-2 text-right text-gray-900 font-bold">{formatCurrency(totalPago)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-3 text-xs text-gray-500 flex items-center gap-4">
            <span>Comisiones por año: {rows.length}</span>
            <span>Total con IVA: {formatCurrency(totalPago)}</span>
          </div>
        </>
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
