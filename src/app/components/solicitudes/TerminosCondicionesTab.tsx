import { useState, useEffect, useRef, useMemo } from 'react';
import { DatePicker } from '@/app/components/ui/DatePicker';
import {
  TerminosCondiciones, RendimientoRow, EMPTY_TERMINOS,
  saveToSession, loadFromSession, loadFromSavedStore,
  MOCK_TERMINOS, parseCurrency, formatCurrency, CAT_FRECUENCIA, CAT_TIPO_TASA, CAT_TIPO_CALCULO, CAT_MONEDA,
} from './solicitudCreditoStore';
import type { ProductoCatalogo } from '../../hooks/useProductosCatalogoDB';

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  lineaProducto: string;
  productoSeleccionado?: ProductoCatalogo;
  /** Monto solicitado del header — se sincroniza automáticamente */
  montoSolicitadoHeader?: string;
  /** Fecha Inicio del formulario principal — se usa como Fecha Primera Aportación en captación */
  fechaInicioHeader?: string;
  /** Tasa pre-cargada desde cotización — tiene prioridad sobre la del producto */
  tasaCotizacion?: string;
  /** Plazo pre-cargado desde cotización — tiene prioridad sobre el del producto */
  plazoCotizacion?: string;
  /** Datos completos de términos desde la cotización seleccionada — siembra el estado inicial */
  cotizacionTerminos?: Partial<TerminosCondiciones>;
  /** Callback cuando el usuario edita Fecha Primera Aportación — sincroniza Fecha Inicio en el formulario */
  onFechaPrimeraAportacionChange?: (fecha: string) => void;
  /** Callback para notificar al padre si hay errores de validación */
  onValidationChange?: (hasErrors: boolean) => void;
}

interface ProductLimits {
  montoMin?: number;
  montoMax?: number;
  plazoMin?: number;
  plazoMax?: number;
  tasaMin?: number;
  tasaMax?: number;
  plazoCumplirMontoMinimo?: number;
}

function extractProductLimits(prod: ProductoCatalogo): ProductLimits {
  const d = prod.rawData || {};
  const def = (d.default && typeof d.default === 'object' && !Array.isArray(d.default)) ? d.default as Record<string,any> : d;

  console.log('[TerminosTab] extractProductLimits - def keys:', Object.keys(def));

  // ── Crédito / Línea de Crédito: leer límites desde matrizTasaFija ──
  const matrizRows: any[] = Array.isArray(d.matrizTasaFija) && d.matrizTasaFija.length > 0
    ? d.matrizTasaFija
    : (Array.isArray(d.montosYCoberturas) && d.montosYCoberturas.length > 0 ? d.montosYCoberturas : []);

  if (matrizRows.length > 0) {
    // Rango global: mínimo de todos los mínimos, máximo de todos los máximos
    const plazoMin = matrizRows.reduce((min: number, r: any) => {
      const v = parseInt(String(r.plazoMinimo ?? r.plazoMin ?? '0'), 10);
      return (v > 0 && (min === 0 || v < min)) ? v : min;
    }, 0);
    const plazoMax = matrizRows.reduce((max: number, r: any) => {
      const v = parseInt(String(r.plazoMaximo ?? r.plazoMax ?? '0'), 10);
      return v > max ? v : max;
    }, 0);
    const montoMin = matrizRows.reduce((min: number, r: any) => {
      const v = parseFloat(String(r.montoMinimo ?? r.montoMin ?? '0'));
      return (v > 0 && (min === 0 || v < min)) ? v : min;
    }, 0);
    const montoMax = matrizRows.reduce((max: number, r: any) => {
      const v = parseFloat(String(r.montoMaximo ?? r.montoMax ?? '0'));
      return v > max ? v : max;
    }, 0);
    const tasaMin = matrizRows.reduce((min: number, r: any) => {
      // tasaMinima = Crédito, tasaAplicable = Línea de Crédito
      const v = parseFloat(String(r.tasaMinima ?? r.tasaAplicable ?? r.tasaMin ?? '0'));
      return (v > 0 && (min === 0 || v < min)) ? v : min;
    }, 0);
    const tasaMax = matrizRows.reduce((max: number, r: any) => {
      const v = parseFloat(String(r.tasaMaxima ?? r.tasaAplicable ?? r.tasaMax ?? '0'));
      return v > max ? v : max;
    }, 0);

    console.log('[TerminosTab] extractProductLimits (matrizTasaFija) - plazo:', plazoMin, '-', plazoMax, '| tasa:', tasaMin, '-', tasaMax, '| monto:', montoMin, '-', montoMax);
    return {
      montoMin: montoMin > 0 ? montoMin : undefined,
      montoMax: montoMax > 0 ? montoMax : undefined,
      plazoMin: plazoMin > 0 ? plazoMin : undefined,
      plazoMax: plazoMax > 0 ? plazoMax : undefined,
      tasaMin: tasaMin > 0 ? tasaMin : undefined,
      tasaMax: tasaMax > 0 ? tasaMax : undefined,
    };
  }

  // ── Captación: leer plazo mínimo desde tasaInversionRegistros ──
  const tasaInversionRegistros = Array.isArray(d.tasaInversionRegistros) ? d.tasaInversionRegistros : [];
  if (tasaInversionRegistros.length > 0) {
    const primerPlazo = tasaInversionRegistros[0]?.plazo;
    const plazoMinCap = primerPlazo
      ? parseInt(String(primerPlazo).replace(/[^0-9]/g, ''), 10)
      : 0;
    const montoMin = parseFloat(String(def.montoMinimo || '0'));
    const montoMax = parseFloat(String(def.montoMaximo || '0'));
    const tasaInicial = parseFloat(String(def.tasaInicial || def.tasa || def.tasaMinInteres || '0'));
    const plazoCumplirMontoMinimo = parseInt(String(def.plazoCumplirMontoMinimo || def.plazoCompletarMinimo || '0'), 10);
    console.log('[TerminosTab] extractProductLimits (captación) - plazoMin:', plazoMinCap, '| tasaInicial:', tasaInicial);
    return {
      montoMin: montoMin > 0 ? montoMin : undefined,
      montoMax: montoMax > 0 ? montoMax : undefined,
      plazoMin: plazoMinCap > 0 ? plazoMinCap : undefined,
      plazoMax: undefined,
      plazoCumplirMontoMinimo: plazoCumplirMontoMinimo > 0 ? plazoCumplirMontoMinimo : undefined,
      tasaMin: tasaInicial > 0 ? tasaInicial : undefined,
      tasaMax: tasaInicial > 0 ? tasaInicial : undefined,
    };
  }

  // ── Fallback: campos sueltos en def ──
  const montoMin = parseFloat(String(def.montoMinimo || '0'));
  const montoMax = parseFloat(String(def.montoMaximo || '0'));
  const tasaInicial = parseFloat(String(def.tasaInicial || def.tasa || '0'));
  const plazoMinimo = parseInt(String(def.plazoMinimo || def.plazoCompletarMinimo || def.plazoMin || '0'), 10);
  const plazoMaximo = parseInt(String(def.plazoMaximo || def.plazoMax || '0'), 10);
  const plazoCumplirMontoMinimo = parseInt(String(def.plazoCumplirMontoMinimo || def.plazoCumplir || '0'), 10);
  console.log('[TerminosTab] extractProductLimits (fallback) - montoMin:', montoMin, '| tasaInicial:', tasaInicial, '| plazoMinimo:', plazoMinimo);
  return {
    montoMin: montoMin > 0 ? montoMin : undefined,
    montoMax: montoMax > 0 ? montoMax : undefined,
    plazoMin: plazoMinimo > 0 ? plazoMinimo : undefined,
    plazoMax: plazoMaximo > 0 ? plazoMaximo : undefined,
    plazoCumplirMontoMinimo: plazoCumplirMontoMinimo > 0 ? plazoCumplirMontoMinimo : undefined,
    tasaMin: tasaInicial > 0 ? tasaInicial : undefined,
    tasaMax: tasaInicial > 0 ? tasaInicial : undefined,
  };
}

/**
 * Extrae los campos de Términos y Condiciones desde el rawData del producto.
 * Busca en múltiples niveles del JSONB:
 *   - root (d.*)
 *   - d.default.* (subtab Datos Generales de Crédito/Seguros)
 *   - d.datosGenerales[0].* (legacy / Captación)
 *   - d.matrizTasaFija[0].* (tasa, plazo de la primera fila de la matriz)
 *   - d.periodos[0].* (frecuencia, plazo del primer periodo)
 */
function extractTerminosFromProduct(prod: ProductoCatalogo): Partial<TerminosCondiciones> {
  const d = prod.rawData || {};

  // Nivel 1: nodo default (ProductoForm → jCreditoData.default)
  const def = (d.default && typeof d.default === 'object' && !Array.isArray(d.default))
    ? d.default as Record<string, any>
    : null;

  // Nivel 2: legacy datosGenerales[0] (Captación / viejo formato)
  const dg = Array.isArray(d.datosGenerales) && d.datosGenerales.length > 0
    ? d.datosGenerales[0]
    : null;

  // Nivel 3: primera fila de matrizTasaFija (contiene tasa, plazo, etc.)
  const mtf = Array.isArray(d.matrizTasaFija) && d.matrizTasaFija.length > 0
    ? d.matrizTasaFija[0]
    : null;

  // Nivel 4: primer periodo (contiene frecuencia, plazo)
  const per = Array.isArray(d.periodos) && d.periodos.length > 0
    ? d.periodos[0]
    : null;

  // Nivel 5: tasaInversion (Captación — contiene tasaPorcentajeBase, frecuenciaCapitalizacion, etc.)
  const ti = (d.tasaInversion && typeof d.tasaInversion === 'object' && !Array.isArray(d.tasaInversion))
    ? d.tasaInversion as Record<string, any>
    : null;

  // Helper: first truthy value from multiple keys across all sources
  const pick = (...keys: string[]): string => {
    // Search order: root → default → datosGenerales → matrizTasaFija → periodos → tasaInversion
    const sources = [d, def, dg, mtf, per, ti].filter(Boolean);
    for (const k of keys) {
      for (const src of sources) {
        const v = src?.[k];
        if (v !== undefined && v !== null && v !== '') return String(v);
      }
    }
    return '';
  };

  const result: Partial<TerminosCondiciones> = {};

  // Tasa — buscar el primer campo que tenga un valor numérico válido
  // tasaOrdinaria = Línea de Crédito; tasaAplicable = MatrizTasaFijaLineaCredito; tasaBase puede ser "Fija" (texto)
  const TASA_KEYS = ['tasaInicial', 'tasa', 'tasaOrdinaria', 'tasaAplicable', 'tasaPorcentaje', 'tasaPorcentajeBase', 'tasaTotalCalculada', 'tasaMinima', 'tasaMaxima', 'tasaInversion', 'tasaMinInteres', 'tasaBase'];
  for (const k of TASA_KEYS) {
    const raw = pick(k);
    if (!raw) continue;
    const num = parseFloat(raw.replace(/[^0-9.-]/g, ''));
    if (!isNaN(num) && num > 0) {
      result.tasa = num.toFixed(4);
      break;
    }
  }

  // Tipo de tasa (Fija / Variable)
  const tipoTasa = pick('tipoTasa', 'tipoTasaInteres', 'tasaTipo', 'tasaBase');
  if (tipoTasa) result.tipoTasa = tipoTasa;

  // Plazo — plazoDefault tiene prioridad (valor razonable configurado en el producto)
  // vigenciaLineaDias = vigencia total de una Línea de Crédito
  // plazoMaximo/plazoMinimo solo como último recurso para no auto-llenar con el límite
  const plazo = pick('plazo', 'plazoMeses', 'plazoDefault', 'numeroPagos', 'vigenciaLineaDias', 'plazoMinimoDisposicion', 'plazoCompletarMinimo', 'plazoMinimo', 'plazoMaximo');
  if (plazo) result.plazo = plazo;

  // Frecuencia
  const frecuencia = pick('frecuencia', 'frecuenciaPago', 'frecuenciaPagoIntereses', 'periodicidad', 'frecuenciaCapitalizacion');
  if (frecuencia) result.frecuencia = frecuencia;

  // Tipo cálculo de amortización
  const tipoCalculo = pick('calculo', 'tipoCalculo', 'tipoCalculoAmortizacion', 'metodoCalculo');
  if (tipoCalculo) result.tipoCalculo = tipoCalculo;

  // Moneda
  const moneda = pick('moneda', 'tipoMoneda');
  if (moneda) result.moneda = moneda;

  // Monto garantía
  const montoGarantia = pick('montoGarantia', 'montoMinimo');
  if (montoGarantia) {
    const num = parseFloat(montoGarantia);
    result.montoGarantia = !isNaN(num) ? num.toFixed(2) : montoGarantia;
  }

  // Base de cálculo (360/180) — mapear a tipoCalculo si no se encontró antes
  if (!result.tipoCalculo) {
    const baseCalculo = pick('baseCalculo');
    if (baseCalculo) result.tipoCalculo = baseCalculo;
  }

  // Rendimientos — solo Captación (tabla de tasas por plazo desde tasaInversionRegistros)
  const tasaInversionRegistros = Array.isArray(d.tasaInversionRegistros) ? d.tasaInversionRegistros : [];
  if (tasaInversionRegistros.length > 0) {
    result.rendimientos = tasaInversionRegistros.map((r: any) => ({
      plazo: String(r.plazo || ''),
      tasaAnual: String(r.tasaAnual ?? r.tasaInicial ?? ''),
      montoMinimo: String(r.montoMinimo ?? ''),
      tasaMensual: String(r.tasaMensual ?? ''),
    }));

    // Para Captación: si no se obtuvo plazo desde el producto, usar el plazo del primer registro
    if (!result.plazo && tasaInversionRegistros[0]?.plazo) {
      result.plazo = String(tasaInversionRegistros[0].plazo);
    }
    // Tasa inicial: del primer registro (se actualizará dinámicamente al cambiar el plazo)
    if (!result.tasa) {
      const primeraTasa = String(tasaInversionRegistros[0]?.tasaInicial ?? tasaInversionRegistros[0]?.tasaAnual ?? '').replace(/[^0-9.]/g, '');
      const num = parseFloat(primeraTasa);
      if (!isNaN(num) && num > 0) result.tasa = num.toFixed(4);
    }
  }

  return result;
}

export function TerminosCondicionesTab({ mode, solicitudId, lineaProducto, productoSeleccionado, montoSolicitadoHeader, fechaInicioHeader, tasaCotizacion, plazoCotizacion, cotizacionTerminos, onFechaPrimeraAportacionChange, onValidationChange }: Props) {
  console.log('[TerminosTab] MOUNT - productoSeleccionado:', productoSeleccionado?.nombreProducto, '| productoId:', productoSeleccionado?.id);
  // Track which productoId was last applied to avoid re-applying
  const lastAppliedProductoId = useRef<string>('');
  // Track if cotizacion data was already applied to avoid overwriting user edits on re-mount
  const cotizacionApplied = useRef<boolean>(false);
  // Track the productoId that was active when session data was loaded
  // Used to detect a real product change vs async product load arriving after mount
  const sessionProductoId = useRef<string | null>(null);

  const getInit = (): TerminosCondiciones => {
    const s = loadFromSession<TerminosCondiciones>(solicitudId, 'terminos');
    if (s) {
      // Hay datos de sesión — marcar para que auto-fill no sobreescriba al cargar el producto async
      sessionProductoId.current = productoSeleccionado?.id ?? '__session__';
      cotizacionApplied.current = true;
      return s;
    }
    if (mode !== 'nuevo') {
      const saved = loadFromSavedStore<TerminosCondiciones>(solicitudId, 'terminos');
      if (saved) {
        sessionProductoId.current = productoSeleccionado?.id ?? '__session__';
        cotizacionApplied.current = true;
        return saved;
      }
      const mock = MOCK_TERMINOS[solicitudId as number];
      if (mock) {
        sessionProductoId.current = productoSeleccionado?.id ?? '__session__';
        return { ...mock };
      }
    }
    // Seed from cotizacion data if available (first visit, no stored data)
    if (cotizacionTerminos && Object.keys(cotizacionTerminos).length > 0) {
      console.log('[TerminosTab] Seeding initial state from cotizacionTerminos:', cotizacionTerminos);
      cotizacionApplied.current = true;
      return { ...EMPTY_TERMINOS, ...cotizacionTerminos };
    }
    return { ...EMPTY_TERMINOS };
  };

  const [data, setData] = useState<TerminosCondiciones>(getInit);
  const isRO = mode === 'ver';

  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, 'terminos', data);
  }, [data, solicitudId, isRO]);

  // ── Apply full cotizacion data when it arrives (handles async load) ──
  useEffect(() => {
    if (isRO) return;
    if (!cotizacionTerminos || Object.keys(cotizacionTerminos).length === 0) return;
    if (cotizacionApplied.current) return;
    console.log('[TerminosTab] Applying cotizacionTerminos (async):', cotizacionTerminos);
    cotizacionApplied.current = true;
    setData(prev => {
      const updated = { ...prev };
      for (const [k, v] of Object.entries(cotizacionTerminos)) {
        if (v !== undefined && v !== null && v !== '') {
          (updated as any)[k] = v;
        }
      }
      return updated;
    });
  }, [cotizacionTerminos, isRO]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync montoSolicitado from header → terminos ──
  useEffect(() => {
    if (isRO) return;
    if (!montoSolicitadoHeader) return;
    if (montoSolicitadoHeader !== data.montoSolicitado) {
      console.log('[TerminosTab] Sync montoSolicitado from header:', montoSolicitadoHeader);
      setData(prev => ({ ...prev, montoSolicitado: montoSolicitadoHeader }));
    }
  }, [montoSolicitadoHeader]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync fechaInicio ↔ fecha de primer pago en Términos ──
  useEffect(() => {
    if (isRO) return;
    if (!fechaInicioHeader) return;
    if (lineaProducto === 'Captación') {
      if (fechaInicioHeader !== data.fechaPrimeraAportacion) {
        setData(prev => ({ ...prev, fechaPrimeraAportacion: fechaInicioHeader }));
      }
    } else {
      if (fechaInicioHeader !== data.fechaPrimerPago) {
        setData(prev => ({ ...prev, fechaPrimerPago: fechaInicioHeader }));
      }
    }
  }, [fechaInicioHeader, lineaProducto]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Captación: cuando cambia el plazo, buscar la tasa correspondiente en tasaInversionRegistros ──
  useEffect(() => {
    if (isRO) return;
    if (lineaProducto !== 'Captación') return;
    if (!productoSeleccionado?.rawData) return;
    const regs = productoSeleccionado.rawData.tasaInversionRegistros as any[] | undefined;
    if (!regs || regs.length === 0) return;
    const plazoNum = parseInt(String(data.plazo || '0').replace(/[^0-9]/g, ''), 10);
    if (!plazoNum) return;
    const match = regs.find((r: any) => parseInt(String(r.plazo || '0').replace(/[^0-9]/g, ''), 10) === plazoNum);
    if (!match) return;
    const rawTasa = String(match.tasaInicial ?? match.tasaAnual ?? '').replace(/[^0-9.]/g, '');
    const num = parseFloat(rawTasa);
    if (!isNaN(num) && num > 0) {
      const formatted = num.toFixed(4);
      if (formatted !== data.tasa) {
        setData(prev => ({ ...prev, tasa: formatted }));
      }
    }
  }, [data.plazo, productoSeleccionado, lineaProducto, isRO]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fill from product when it changes (skipped if session/cotizacion already loaded) ──
  useEffect(() => {
    if (isRO) return;
    if (!productoSeleccionado?.id) return;
    if (productoSeleccionado.id === lastAppliedProductoId.current) return;
    if (!productoSeleccionado.rawData) return;

    // Si había datos de sesión y el producto que llega es el mismo que ya estaba guardado,
    // solo marcar como aplicado sin sobreescribir — el usuario puede tener valores editados
    if (sessionProductoId.current !== null && productoSeleccionado.id === sessionProductoId.current) {
      lastAppliedProductoId.current = productoSeleccionado.id;
      return;
    }
    // Si había sesión con producto desconocido (async), primera vez que llega el producto
    // tampoco sobreescribir — marcar y salir
    if (sessionProductoId.current === '__session__') {
      sessionProductoId.current = productoSeleccionado.id;
      lastAppliedProductoId.current = productoSeleccionado.id;
      return;
    }

    const extracted = extractTerminosFromProduct(productoSeleccionado);
    const keys = Object.keys(extracted) as (keyof TerminosCondiciones)[];

    console.log('[TerminosTab] Auto-fill from product:', productoSeleccionado.nombreProducto,
      '| tipoProducto:', productoSeleccionado.tipoProducto || productoSeleccionado.sublineaProducto,
      '| fields:', keys.join(', '), '| values:', extracted,
      '| rawData keys:', Object.keys(productoSeleccionado.rawData));

    lastAppliedProductoId.current = productoSeleccionado.id;

    if (keys.length === 0) {
      console.warn('[TerminosTab] No se extrajeron campos del producto. rawData:', productoSeleccionado.rawData);
      return;
    }

    setData(prev => {
      const updated = { ...prev };
      for (const key of keys) {
        // NUNCA sobrescribir tasa si vino de cotización
        if (key === 'tasa' && tasaCotizacion) continue;
        // NUNCA sobrescribir plazo si vino de cotización
        if (key === 'plazo' && plazoCotizacion) continue;
        // Al cambiar de producto, siempre aplicar campos del nuevo producto
        (updated as any)[key] = extracted[key];
      }
      return updated;
    });
  }, [productoSeleccionado, isRO]);

  const set = (field: keyof TerminosCondiciones, value: any) => {
    if (isRO) return;
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleNumeric = (field: keyof TerminosCondiciones, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    set(field, formatted);
  };

  const handleCurrencyBlur = (field: keyof TerminosCondiciones) => {
    const raw = parseCurrency(String(data[field]) || '');
    const num = parseFloat(raw);
    if (!isNaN(num) && num >= 0) set(field, num.toFixed(2));
  };

  const handlePercentBlur = (field: keyof TerminosCondiciones) => {
    const raw = String(data[field] || '').replace(/[^0-9.-]/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num)) set(field, Math.min(100, Math.max(0, num)).toFixed(4));
  };

  // ── Validaciones contra límites del producto ──
  // Para Captación Ahorro/Aportación: plazos exactos desde tasaInversionRegistros (campo "plazo")
  // Para Captación Inversión: rangos de plazo desde matrizTasaFijaRegistros (plazoMinimo-plazoMaximo)
  const plazosValidosDirect = useMemo(() => {
    const rd = productoSeleccionado?.rawData;
    if (!rd) return [];
    // tasaInversionRegistros → lista exacta de plazos
    if (Array.isArray(rd.tasaInversionRegistros) && rd.tasaInversionRegistros.length > 0) {
      return rd.tasaInversionRegistros
        .map((r: any) => parseInt(String(r.plazo || '').replace(/[^0-9]/g, ''), 10))
        .filter((p: number) => p > 0);
    }
    return [];
  }, [productoSeleccionado]);

  // Para Inversión: rangos plazoMinimo-plazoMaximo de matrizTasaFijaRegistros
  const matrizPlazoRanges = useMemo(() => {
    const rd = productoSeleccionado?.rawData;
    if (!rd) return [];
    const regs = Array.isArray(rd.matrizTasaFijaRegistros) ? rd.matrizTasaFijaRegistros
      : Array.isArray(rd.matrizTasaFija) ? rd.matrizTasaFija
      : [];
    return regs
      .map((r: any) => ({ min: parseFloat(r.plazoMinimo) || 0, max: parseFloat(r.plazoMaximo) || 0 }))
      .filter((r: { min: number; max: number }) => r.min > 0);
  }, [productoSeleccionado]);

  const validationErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const limits = productoSeleccionado ? extractProductLimits(productoSeleccionado) : {};
    const { montoMin, montoMax, plazoMin, plazoMax, tasaMin, tasaMax } = limits;

    const hayProducto = !!productoSeleccionado;
    const esCaptacion = lineaProducto === 'Captación';
    // Aportación: la validación de plazo usa plazoCompletarMinimo como mínimo (no lista exacta)
    const isAportacion = esCaptacion && (
      (productoSeleccionado?.tipoProducto || '').toLowerCase().includes('aportaci') ||
      (productoSeleccionado?.sublineaProducto || '').toLowerCase().includes('aportaci')
    );
    console.log('[TerminosTab] validation - hayProducto:', hayProducto, '| producto:', productoSeleccionado?.nombreProducto, '| plazosValidos:', plazosValidosDirect, '| isAportacion:', isAportacion);

    // Monto válido y dentro de límites
    const monto = parseFloat(parseCurrency(String(data.montoSolicitado || '0')));
    if (!hayProducto) {
      if (!monto || monto <= 0) errs.montoSolicitado = 'Ingrese monto';
    } else {
      if (montoMin && monto > 0 && monto < montoMin)
        errs.montoSolicitado = `Mínimo: ${formatCurrency(montoMin)}`;
      else if (montoMax && monto > montoMax)
        errs.montoSolicitado = `Máximo: ${formatCurrency(montoMax)}`;
    }

    // Plazo válido: debe ser mayor o igual al mínimo del producto
    const plazoNum = parseInt(String(data.plazo || '0'), 10);
    if (!hayProducto) {
      if (!plazoNum || plazoNum <= 0) errs.plazo = 'Ingrese plazo';
    } else {
      if (isAportacion) {
        // Aportación: validar contra plazoCompletarMinimo (mínimo del producto), no lista exacta
        const minPlazo = limits.plazoCumplirMontoMinimo || plazoMin;
        if (!plazoNum || plazoNum <= 0) {
          errs.plazo = minPlazo ? `Mínimo: ${minPlazo}` : 'Ingrese plazo';
        } else if (minPlazo && plazoNum < minPlazo) {
          errs.plazo = `Plazo debe ser ≥ ${minPlazo}`;
        }
      } else if (plazosValidosDirect.length > 0) {
        // Captación Ahorro/Inversión: lista exacta de plazos válidos
        if (!plazoNum || plazoNum <= 0) {
          const plazosStr = [...new Set(plazosValidosDirect)].sort((a, b) => a - b).join(', ');
          errs.plazo = `Plazos válidos: ${plazosStr} días`;
        } else if (!plazosValidosDirect.some(p => p === plazoNum)) {
          const plazosStr = [...new Set(plazosValidosDirect)].sort((a, b) => a - b).join(', ');
          errs.plazo = `Plazos válidos: ${plazosStr} días`;
        }
      } else if (matrizPlazoRanges.length > 0) {
        // Captación Inversión: plazo debe caer en algún rango plazoMinimo–plazoMaximo
        if (!plazoNum || plazoNum <= 0) {
          const rangosStr = matrizPlazoRanges.map((r: { min: number; max: number }) => r.max > r.min ? `${r.min}-${r.max}` : `${r.min}`).join(', ');
          errs.plazo = `Plazo debe estar en: ${rangosStr} días`;
        } else {
          const enRango = matrizPlazoRanges.some((r: { min: number; max: number }) =>
            plazoNum >= r.min && (r.max <= 0 || r.max >= r.min ? plazoNum <= r.max : true)
          );
          if (!enRango) {
            const rangosStr = matrizPlazoRanges.map((r: { min: number; max: number }) => r.max > r.min ? `${r.min}-${r.max}` : `${r.min}`).join(', ');
            errs.plazo = `Plazo debe estar en: ${rangosStr} días`;
          }
        }
      } else if (!plazoNum || plazoNum <= 0) {
        errs.plazo = 'Ingrese plazo';
      } else if (plazoMin && plazoNum < plazoMin) {
        errs.plazo = `Mayor o igual a ${plazoMin} días`;
      }
    }

    // Tasa válida y dentro de límites
    // Para Captación: la tasa es de solo lectura (del producto), no validar
    if (!esCaptacion) {
      const tasaNum = parseFloat(String(data.tasa || '0'));
      if (!hayProducto) {
        if (!tasaNum || tasaNum <= 0) errs.tasa = 'Ingrese tasa';
      } else {
        if (tasaMin && tasaNum > 0 && tasaNum < tasaMin)
          errs.tasa = `Mínimo: ${tasaMin}%`;
        else if (tasaMax && tasaNum > tasaMax)
          errs.tasa = `Máximo: ${tasaMax}%`;
      }
    }

    console.log('[TerminosTab] validationErrors:', errs);
    return errs;
  }, [data.montoSolicitado, data.plazo, data.tasa, productoSeleccionado, plazosValidosDirect, matrizPlazoRanges, lineaProducto]);

  // Notificar al padre cuando hay errores
  useEffect(() => {
    onValidationChange?.(Object.keys(validationErrors).length > 0);
  }, [validationErrors, onValidationChange]);

  const ic = (disabled = false, hasError = false) => {
    const base = 'w-full px-2 py-1.5 text-xs border rounded focus:outline-none';
    const focus = !disabled && !isRO ? 'focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5]' : '';
    const bg = disabled || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800';
    const border = hasError ? 'border-red-400' : 'border-gray-300';
    return `${base} ${border} ${focus} ${bg}`;
  };

  const sc = () => {
    const base = 'w-full px-2 py-1.5 text-xs border rounded focus:outline-none border-gray-300';
    const focus = !isRO ? 'focus:ring-2 focus:ring-[#4A6FA5]' : '';
    const bg = isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800';
    return `${base} ${focus} ${bg}`;
  };

  const isCaptacion = lineaProducto === 'Captación';
  const isLineaCredito = lineaProducto === 'Línea de Crédito';

  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-4">
        <p className="text-xs text-blue-800">
          <strong>Datos para simular — {lineaProducto || 'Crédito'}</strong>
          {' '}| Modifique los campos y genere la simulación en el acordeón correspondiente.
          {productoSeleccionado?.rawData && (
            <span className="ml-2 text-blue-600">
              ✓ Pre-llenado desde producto: <strong>{productoSeleccionado.nombreProducto}</strong>
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {/* Col 1 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Monto Solicitado <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
              <input
                type="text" inputMode="decimal"
                value={data.montoSolicitado}
                onChange={e => handleNumeric('montoSolicitado', e.target.value)}
                onBlur={() => handleCurrencyBlur('montoSolicitado')}
                disabled={isRO} placeholder="0.00"
                className={`${ic(false, !!validationErrors.montoSolicitado)} pl-5`}
              />
            </div>
            {validationErrors.montoSolicitado && (
              <p className="text-[10px] text-red-500 mt-0.5">{validationErrors.montoSolicitado}</p>
            )}
          </div>

          {!isCaptacion && (
            <div>
              <label className="block text-xs text-gray-700 mb-1">Fecha Primer Pago</label>
              <DatePicker
                value={data.fechaPrimerPago}
                onChange={(v: string) => {
                  set('fechaPrimerPago', v);
                  onFechaPrimeraAportacionChange?.(v);
                }}
                disabled={isRO} placeholder="dd/mm/aaaa"
                className="px-2 py-1.5"
              />
            </div>
          )}

          {isCaptacion && (
            <div>
              <label className="block text-xs text-gray-700 mb-1">
                Fecha Primera Aportación
                <span className="ml-1 text-gray-400 font-normal">(= Fecha Inicio)</span>
              </label>
              <DatePicker
                value={data.fechaPrimeraAportacion}
                onChange={(v: string) => {
                  set('fechaPrimeraAportacion', v);
                  onFechaPrimeraAportacionChange?.(v);
                }}
                disabled={isRO}
                placeholder="dd/mm/aaaa"
                className="px-2 py-1.5"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-700 mb-1">Plazo <span className="text-red-500">*</span></label>
            <input
              type="text" inputMode="decimal"
              value={data.plazo}
              onChange={e => handleNumeric('plazo', e.target.value)}
              disabled={isRO} placeholder="Ej: 12"
              className={ic(false, !!validationErrors.plazo)}
            />
            {validationErrors.plazo && (
              <p className="text-[10px] text-red-500 mt-0.5">{validationErrors.plazo}</p>
            )}
          </div>
        </div>

        {/* Col 2 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Frecuencia <span className="text-red-500">*</span></label>
            <select value={data.frecuencia} onChange={e => set('frecuencia', e.target.value)} disabled={isRO} className={sc()}>
              {CAT_FRECUENCIA.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">Tasa (%) <span className="text-red-500">*</span></label>
            <input
              type="text" inputMode="decimal"
              value={data.tasa}
              onChange={e => handleNumeric('tasa', e.target.value)}
              onBlur={() => handlePercentBlur('tasa')}
              disabled={isRO || isCaptacion || !!productoSeleccionado} placeholder="0.0000"
              className={ic(false, !!validationErrors.tasa)}
            />
            {(isCaptacion || productoSeleccionado) && data.tasa && (
              <p className="text-[10px] text-green-600 mt-0.5">{isCaptacion ? 'Tasa del producto (solo lectura)' : 'Tasa del producto'}</p>
            )}
            {validationErrors.tasa && (
              <p className="text-[10px] text-red-500 mt-0.5">{validationErrors.tasa}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">Tipo de Tasa</label>
            <select value={data.tipoTasa} onChange={e => set('tipoTasa', e.target.value)} disabled={isRO} className={sc()}>
              {CAT_TIPO_TASA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Col 3 */}
        <div className="space-y-3">
          {!isCaptacion && (
            <div>
              <label className="block text-xs text-gray-700 mb-1">Tipo Cálculo Amortización</label>
              <select value={data.tipoCalculo} onChange={e => set('tipoCalculo', e.target.value)} disabled={isRO} className={sc()}>
                {CAT_TIPO_CALCULO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-700 mb-1">Moneda</label>
            <select value={data.moneda} onChange={e => set('moneda', e.target.value)} disabled={isRO} className={sc()}>
              {CAT_MONEDA.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {!isCaptacion && (
            <div>
              <label className="block text-xs text-gray-700 mb-1">Monto Garantía</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  type="text" inputMode="decimal"
                  value={data.montoGarantia}
                  onChange={e => handleNumeric('montoGarantia', e.target.value)}
                  onBlur={() => handleCurrencyBlur('montoGarantia')}
                  disabled={isRO} placeholder="0.00"
                  className={`${ic()} pl-5`}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seguro financiado */}
      {!isCaptacion && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={data.seguroFinanciado}
                onChange={e => set('seguroFinanciado', e.target.checked)}
                disabled={isRO}
                className="w-3.5 h-3.5"
              />
              Seguro Financiado
            </label>
            {data.seguroFinanciado && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-700">Monto Seguro:</label>
                <div className="relative w-40">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                  <input
                    type="text" inputMode="decimal"
                    value={data.montoSeguro}
                    onChange={e => handleNumeric('montoSeguro', e.target.value)}
                    onBlur={() => handleCurrencyBlur('montoSeguro')}
                    disabled={isRO} placeholder="0.00"
                    className={`${ic()} pl-5`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rendimientos — solo Captación (tabla de tasas por plazo) */}
      {isCaptacion && data.rendimientos && data.rendimientos.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Rendimientos</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Plazo</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Tasa Anual (%)</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Monto Mínimo</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Tasa Mensual (%)</th>
                </tr>
              </thead>
              <tbody>
                {data.rendimientos.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 border-b border-gray-100">{r.plazo}</td>
                    <td className="px-3 py-2 border-b border-gray-100">{r.tasaAnual}</td>
                    <td className="px-3 py-2 border-b border-gray-100">{formatCurrency(parseFloat(r.montoMinimo) || 0)}</td>
                    <td className="px-3 py-2 border-b border-gray-100">{r.tasaMensual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Perfil del Inversionista — solo Captación */}
      {isCaptacion && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Perfil del Inversionista</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-700 mb-1">Perfil</label>
              <select value={data.perfilInversionista || ''} onChange={e => set('perfilInversionista', e.target.value)} disabled={isRO} className={sc()}>
                <option value="">-- Seleccionar --</option>
                {['Conservador', 'Moderado', 'Agresivo'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Riesgo</label>
              <select value={data.riesgoInversionista || ''} onChange={e => set('riesgoInversionista', e.target.value)} disabled={isRO} className={sc()}>
                <option value="">-- Seleccionar --</option>
                {['Bajo', 'Medio', 'Alto'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Horizonte de Inversión</label>
              <select value={data.horizonteInversion || ''} onChange={e => set('horizonteInversion', e.target.value)} disabled={isRO} className={sc()}>
                <option value="">-- Seleccionar --</option>
                {['Corto plazo', 'Mediano plazo', 'Largo plazo'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Experiencia</label>
              <select value={data.experienciaInversion || ''} onChange={e => set('experienciaInversion', e.target.value)} disabled={isRO} className={sc()}>
                <option value="">-- Seleccionar --</option>
                {['Ninguna', 'Básica', 'Intermedia', 'Avanzada'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Resumen dinámico */}
      {isLineaCredito && (
        <div className="mt-4 bg-purple-50 border border-purple-200 rounded px-3 py-2">
          <p className="text-xs text-purple-800">
            <strong>Línea de Crédito:</strong> La simulación generará una tabla de amortización para disposiciones sobre la línea.
          </p>
        </div>
      )}
    </div>
  );
}