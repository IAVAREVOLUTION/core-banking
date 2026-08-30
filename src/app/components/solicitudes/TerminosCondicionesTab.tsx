import { useState, useEffect, useRef, useMemo } from 'react';
import { DatePicker } from '@/app/components/ui/DatePicker';
import {
  TerminosCondiciones, RendimientoRow, EMPTY_TERMINOS,
  saveToSession, loadFromSession, loadFromSavedStore,
  MOCK_TERMINOS, parseCurrency, formatCurrency, CAT_FRECUENCIA, CAT_TIPO_TASA, CAT_TIPO_CALCULO, CAT_MONEDA,
} from './solicitudCreditoStore';
import type { ProductoCatalogo } from '../../hooks/useProductosCatalogoDB';
import { useProductosSeguros } from '../../hooks/useProductosSeguros';

// ── Tipos internos ──
interface GarantiaProducto { tipo: string; subtipo?: string; aforo?: number | string; }
interface MatrizSeguroFila { montoMinimo?: number; montoMaximo?: number; montoDefault?: number; tasaDefault?: number; [k: string]: any; }

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  lineaProducto: string;
  /** Sublínea/tipo del producto — usado para detectar Arrendamiento Puro */
  tipoProducto?: string;
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
  /** Callback cuando Monto Autorizado se recalcula (Arrendamiento) — sincroniza el campo del header, que Simular usa */
  onMontoAutorizadoChange?: (monto: string) => void;
  /**
   * Sincroniza la Tasa capturada aquí hacia el encabezado. Sin esto, Simular
   * seguía usando `tasaHeader` (el default de la Matriz) y la tasa tecleada
   * por el usuario no tenía efecto — mismo motivo que onMontoAutorizadoChange.
   */
  onTasaChange?: (tasa: string) => void;
  /** Sincroniza la Frecuencia capturada aquí hacia el encabezado — la cotización GPO la usa como periodicidad. */
  onFrecuenciaChange?: (frecuencia: string) => void;
  /** % Enganche seleccionado en el encabezado (Arrendamiento) — fuente de verdad; Términos lo usa para calcular Monto Autorizado/Enganche */
  porcentajeEngancheHeader?: string;
  /** Plazo capturado en el encabezado (junto al producto) — fuente de verdad; Términos lo usa en sus cálculos internos (tasa, seguro, validaciones de rango) */
  plazoHeader?: string;
  /** Notifica al header el Plazo cargado desde una solicitud existente (migración: solicitudes guardadas antes de que Plazo viviera en el encabezado) */
  onPlazoLoaded?: (plazo: string) => void;
  /** Tasa autocompletada al seleccionar plazo en el modal de Matriz (encabezado) */
  tasaHeader?: string;
  /** Frecuencia autocompletada desde la fila de la Matriz de Tasa Fija seleccionada — prioridad sobre data.frecuencia */
  frecuenciaHeader?: string;
  /** Rango de Tasa anual [mín, máx] de la fila de Matriz vigente — habilita edición de Tasa dentro de ese rango */
  tasaRangoMatriz?: { min: number; max: number } | null;
  /** Rango de Plazo [mín, máx] de la fila de Matriz vigente — permite capturar un Plazo custom validado contra ese rango */
  plazoRangoMatriz?: { min: number; max: number } | null;
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

export function TerminosCondicionesTab({ mode, solicitudId, lineaProducto, tipoProducto, productoSeleccionado, montoSolicitadoHeader, fechaInicioHeader, tasaCotizacion, plazoCotizacion, cotizacionTerminos, onFechaPrimeraAportacionChange, onValidationChange, onMontoAutorizadoChange, onTasaChange, onFrecuenciaChange, porcentajeEngancheHeader, plazoHeader, onPlazoLoaded, tasaHeader, frecuenciaHeader, tasaRangoMatriz, plazoRangoMatriz }: Props) {
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

  /**
   * Frecuencias que ofrece el select — las que declara la Matriz de Tasa
   * Fija del producto (columna FRECUENCIA de cada fila, campo `periodo`).
   *
   * El Plazo y la Tasa ya se eligen en esa matriz desde el encabezado; la
   * periodicidad es parte de la MISMA fila, así que ofrecer todo
   * CAT_FRECUENCIA dejaba capturar combinaciones que el producto no
   * contempla (p. ej. Semanal en un producto que sólo cobra Anual).
   * Si el producto no trae matriz, se conserva el catálogo completo.
   */
  const opcionesFrecuencia = useMemo(() => {
    const rd = (productoSeleccionado as any)?.rawData;
    const filas: any[] = Array.isArray(rd?.matrizTasaFija) ? rd.matrizTasaFija : [];
    const periodos: string[] = [];
    for (const f of filas) {
      const per = String(f?.periodo ?? '').trim();
      if (per && !periodos.includes(per)) periodos.push(per);
    }
    if (periodos.length === 0) return CAT_FRECUENCIA;
    // Respetar label/dias del catálogo cuando el periodo existe ahí; si la
    // matriz declara uno fuera de catálogo, mostrarlo tal cual en vez de
    // descartarlo y dejar el select vacío.
    return periodos.map(per =>
      CAT_FRECUENCIA.find(f => f.value === per) || { value: per, label: per, dias: 30 },
    );
  }, [productoSeleccionado]);

  // ── Monto efectivo — debe ir PRIMERO, otros hooks lo usan ──
  const montoEfectivo = useMemo(() => {
    const raw = montoSolicitadoHeader || data.montoSolicitado || '0';
    return parseFloat(parseCurrency(raw)) || 0;
  }, [montoSolicitadoHeader, data.montoSolicitado]);

  // ── Garantías del producto ──
  const garantiasProducto = useMemo((): GarantiaProducto[] => {
    const g = productoSeleccionado?.rawData?.garantias;
    return Array.isArray(g) ? g : [];
  }, [productoSeleccionado]);

  // ── Cotizador de Arrendamiento — Puro y Financiero comparten los mismos
  // campos de Términos (Comisión, Enganche, Residual, Rentas Anticipadas);
  // lo que difiere es el tipo de simulación que genera "Simular"
  // (Calendario de Pagos vs Tabla de Amortización) — ver SimulacionTab.tsx.
  // Detección: mismo patrón usado en GarantiasTab.tsx (defaultCategoriaPorProducto)
  const isArrendamiento = useMemo(() => {
    const t = (tipoProducto || '').toLowerCase();
    return t.includes('arrendamiento');
  }, [tipoProducto]);
  // Alias retrocompatible — el resto del archivo ya usa este nombre para
  // condicionar los campos nuevos, que ahora aplican a Puro Y Financiero.
  const isArrendamientoPuro = isArrendamiento;

  const opcionesActivas = (arr: any): { id: number; valor: string }[] => {
    return Array.isArray(arr)
      ? arr.filter((o: any) => o?.estatus === 'ACTIVO').map((o: any) => ({ id: o.id, valor: String(o.valor) }))
      : [];
  };

  // Comisión por Apertura — lee del subtab genérico "Comisiones" del producto
  // (Transacción = "Apertura Cuenta", Tipo = Porcentaje, Activa = true).
  // El subtab dedicado "Comisiones por Apertura" fue removido: Comisiones es
  // ahora la única fuente que también lee Solicitudes.
  const comisionesAperturaProducto = useMemo(() => {
    const comisiones: any[] = Array.isArray(productoSeleccionado?.rawData?.comisiones)
      ? productoSeleccionado!.rawData!.comisiones
      : [];
    return comisiones
      .filter((c: any) => c?.transaccion === 'Apertura Cuenta' && c?.tipoComision === 'Porcentaje' && c?.assetBoolean === true)
      .map((c: any) => ({ id: c.id, valor: String(c.percentage) }));
  }, [productoSeleccionado]);
  const enganchesProducto = useMemo(
    () => opcionesActivas(productoSeleccionado?.rawData?.enganches),
    [productoSeleccionado]
  );
  const rentasAnticipadasProducto = useMemo(
    () => opcionesActivas(productoSeleccionado?.rawData?.rentasAnticipadas),
    [productoSeleccionado]
  );
  // % Valor Residual — subtab dedicado "Valor Residual" del producto (lista de
  // opciones activas, mismo patrón que Comisión/Enganche/Rentas Anticipadas).
  // Si el producto no tiene opciones configuradas, Monto Residual = 0.
  const valorResidualOpciones = useMemo(
    () => opcionesActivas(productoSeleccionado?.rawData?.valorResidualOpciones),
    [productoSeleccionado]
  );

  // Monto Autorizado = Monto Solicitado × (1 − % Enganche / 100)
  // Sin enganche configurado/seleccionado → Monto Autorizado = Monto Solicitado
  const montoAutorizadoNum = useMemo(() => {
    const pct = parseFloat(data.porcentajeEnganche || '0') || 0;
    return montoEfectivo * (1 - pct / 100);
  }, [montoEfectivo, data.porcentajeEnganche]);

  // % Enganche ahora se selecciona en el encabezado principal del formulario
  // (dropdown junto a Monto Autorizado) — se sincroniza hacia este subtab, que
  // sigue siendo dueño del cálculo de Monto Enganche/Monto Autorizado/Monto Residual.
  useEffect(() => {
    if (porcentajeEngancheHeader !== undefined && porcentajeEngancheHeader !== data.porcentajeEnganche) {
      setData(prev => ({ ...prev, porcentajeEnganche: porcentajeEngancheHeader }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porcentajeEngancheHeader]);

  // Plazo ahora se captura en el encabezado (junto al producto, con el modal de
  // Matriz de Tasa Fija) — se sincroniza hacia este subtab, que conserva toda su
  // lógica interna de cálculo (tasa por plazo en Captación, pago de seguro, etc.).
  useEffect(() => {
    if (plazoHeader !== undefined && plazoHeader !== data.plazo) {
      setData(prev => ({ ...prev, plazo: plazoHeader }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plazoHeader]);

  // Migración: si esta solicitud ya tenía un Plazo capturado en Términos (flujo
  // previo a que Plazo viviera en el encabezado) y el encabezado aún no tiene
  // valor, informar al header una sola vez al cargar.
  const plazoLoadedNotifiedRef = useRef(false);
  useEffect(() => {
    if (plazoLoadedNotifiedRef.current) return;
    if (plazoHeader) { plazoLoadedNotifiedRef.current = true; return; }
    if (data.plazo) {
      onPlazoLoaded?.(data.plazo);
      plazoLoadedNotifiedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.plazo, plazoHeader]);

  // Tasa autocompletada desde el modal de Matriz de Tasa Fija (encabezado) —
  // el modal ya validó que el Plazo/Monto estén dentro de rango antes de fijarla.
  useEffect(() => {
    if (tasaHeader !== undefined && tasaHeader !== data.tasa) {
      setData(prev => ({ ...prev, tasa: tasaHeader }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasaHeader]);

  // Frecuencia autocompletada desde la fila de la Matriz seleccionada (encabezado).
  //
  // BUG FIX: este tab se monta/desmonta con cada cambio de pestaña (se pinta
  // condicionalmente en SolicitudCreditoForm), así que el efecto volvía a
  // correr en cada regreso y pisaba con el valor del encabezado la Frecuencia
  // que el usuario acababa de elegir. El encabezado no se entera del cambio
  // (a diferencia de la Tasa, que sí avisa con onTasaChange), de modo que
  // seguía trayendo el valor viejo — el clásico "la cambio a Mensual y se
  // regresa a Anual". Ahora en el montaje solo autocompleta si todavía no hay
  // Frecuencia capturada; una vez montado, sigue obedeciendo al encabezado
  // para que elegir otra fila de la Matriz sí la actualice.
  const frecuenciaHeaderVistaRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const esMontaje = frecuenciaHeaderVistaRef.current === undefined;
    frecuenciaHeaderVistaRef.current = frecuenciaHeader;
    if (!frecuenciaHeader) return;
    if (esMontaje && data.frecuencia) return;
    if (frecuenciaHeader !== data.frecuencia) {
      setData(prev => ({ ...prev, frecuencia: frecuenciaHeader }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frecuenciaHeader]);

  // La Frecuencia guardada debe existir en el catálogo que se está pintando.
  // Si no (producto cambiado, Solicitud vieja, o valor heredado que la matriz
  // no contempla), el <select> pintaría la primera opción sin que nadie la
  // haya elegido — un valor fantasma. Aquí se encuadra de forma explícita.
  useEffect(() => {
    if (isRO) return;
    const permitidas = opcionesFrecuencia.map(f => f.value);
    if (permitidas.length === 0) return;
    if (data.frecuencia && permitidas.includes(data.frecuencia)) return;
    const elegida = frecuenciaHeader && permitidas.includes(frecuenciaHeader)
      ? frecuenciaHeader
      : permitidas[0];
    if (elegida && elegida !== data.frecuencia) {
      setData(prev => ({ ...prev, frecuencia: elegida }));
      onFrecuenciaChange?.(elegida);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcionesFrecuencia.map(f => f.value).join('|'), data.frecuencia, isRO]);

  // Recalcular Monto Enganche, Monto Autorizado y Monto Residual — solo Arrendamiento Puro.
  // % Valor Residual ahora es una selección del usuario (subtab Valor Residual del
  // producto), no un valor derivado — si el producto no tiene opciones configuradas,
  // no hay nada que elegir y Monto Residual = 0.
  useEffect(() => {
    if (isRO || !isArrendamientoPuro) return;
    const pctEnganche = parseFloat(data.porcentajeEnganche || '0') || 0;
    const montoEnganche = montoEfectivo > 0 && pctEnganche > 0 ? montoEfectivo * pctEnganche / 100 : 0;
    const pctResidual = parseFloat(data.porcentajeValorResidualSel || '0') || 0;
    const montoResidual = montoAutorizadoNum > 0 && pctResidual > 0
      ? montoAutorizadoNum * pctResidual / 100
      : 0;

    if (
      montoEnganche !== data.montoEnganche ||
      montoResidual !== data.montoResidual ||
      montoAutorizadoNum.toFixed(2) !== data.montoAutorizado
    ) {
      setData(prev => ({
        ...prev,
        montoEnganche,
        montoResidual,
        montoAutorizado: montoAutorizadoNum.toFixed(2),
      }));
    }
    // Sincronizar Monto Autorizado con el header — Simular lo lee de ahí (prop
    // montoAutorizado de SimulacionTab), no de este data local por sessionStorage.
    onMontoAutorizadoChange?.(montoAutorizadoNum.toFixed(2));
  }, [isRO, isArrendamientoPuro, montoEfectivo, data.porcentajeEnganche, montoAutorizadoNum, data.porcentajeValorResidualSel]); // eslint-disable-line react-hooks/exhaustive-deps

  // garantiaActiva y garantiaSeleccionada se restauran desde data persistido
  const [garantiaActiva, setGarantiaActiva] = useState<boolean>(
    () => !!(data._garantiaActiva || (data.porcentajeAforo && data.porcentajeAforo > 0))
  );
  /**
   * Ubica el bien guardado dentro de las garantías del producto.
   * Prefiere la identidad (tipo + subtipo); el match por aforo queda sólo como
   * respaldo para solicitudes anteriores a que esa identidad se persistiera.
   */
  const ubicarGarantiaGuardada = (
    lista: GarantiaProducto[],
    d: Pick<TerminosCondiciones, 'tipoGarantia' | 'subtipoGarantia' | 'porcentajeAforo'>,
  ): GarantiaProducto | null => {
    if (lista.length === 0) return null;
    if (d.tipoGarantia) {
      const exacta = lista.find(x =>
        x.tipo === d.tipoGarantia && (x.subtipo || '') === (d.subtipoGarantia || '')
      );
      if (exacta) return exacta;
    }
    if (!d.porcentajeAforo) return null;
    return lista.find(x => parseFloat(String(x.aforo ?? '')) === d.porcentajeAforo) || null;
  };

  const [garantiaSeleccionada, setGarantiaSeleccionada] = useState<GarantiaProducto | null>(
    () => ubicarGarantiaGuardada(
      (productoSeleccionado?.rawData?.garantias as GarantiaProducto[] | undefined) || [],
      data,
    )
  );

  // Las garantías del producto llegan por fetch: al montar el tab suelen estar
  // vacías, y como el estado de arriba sólo se calcula una vez, el bien
  // guardado quedaba sin marcar. Al llegar la lista se vuelve a ubicar.
  useEffect(() => {
    if (garantiaSeleccionada || garantiasProducto.length === 0) return;
    const encontrada = ubicarGarantiaGuardada(garantiasProducto, data);
    if (encontrada) {
      setGarantiaSeleccionada(encontrada);
      setGarantiaActiva(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garantiasProducto, data.tipoGarantia, data.subtipoGarantia, data.porcentajeAforo]);

  // Al seleccionar garantía:
  //   montoGarantia (Monto Autorizado) = Monto Solicitado × (1 − % Enganche / 100)
  //   montoCubrirGarantia              = Monto Solicitado × (aforo / 100)
  // montoCubrirGarantia usa Monto Solicitado (no Monto Autorizado) para que
  // coincida con el "MONTO A CUBRIR" que ya muestra la tabla de selección de
  // garantías (montoEfectivo × aforo), evitando que el valor mostrado antes de
  // seleccionar difiera del valor persistido después de seleccionar.
  useEffect(() => {
    if (!garantiaActiva || !garantiaSeleccionada) return;
    const aforo = parseFloat(String(garantiaSeleccionada.aforo ?? '')) || 0;
    const montoACubrir = montoEfectivo > 0 && aforo > 0 ? montoEfectivo * aforo / 100 : 0;
    setData(prev => ({
      ...prev,
      montoGarantia: montoAutorizadoNum.toFixed(2),
      montoCubrirGarantia: montoACubrir,
      porcentajeAforo: aforo,
      // Guardar cuál bien se eligió, no sólo su aforo.
      tipoGarantia: garantiaSeleccionada.tipo || '',
      subtipoGarantia: garantiaSeleccionada.subtipo || '',
      _garantiaActiva: true,
    }));
  }, [garantiaActiva, garantiaSeleccionada, montoEfectivo, montoAutorizadoNum]);

  // ── Seguros financiados ──
  const isSegurosActive = !!(data.seguroFinanciado);
  const { productos: productosSeguros, loading: loadingSeguros } = useProductosSeguros(isSegurosActive);

  // Ambos se restauran desde data persistido: antes eran useState vacíos, así
  // que al reabrir la solicitud el check de Seguro volvía palomeado pero sin
  // seguro elegido ni fila de matriz.
  const [seguroSeleccionadoId, setSeguroSeleccionadoId] = useState<string>(
    () => data.seguroProductoId || ''
  );
  const [matrizFilaSeleccionada, setMatrizFilaSeleccionada] = useState<MatrizSeguroFila | null>(
    () => (data.seguroMatrizFila as MatrizSeguroFila) || null
  );

  const seguroActual = useMemo(() => {
    if (!seguroSeleccionadoId) return null;
    return productosSeguros.find(s => s.dbUuid === seguroSeleccionadoId || String(s.id) === seguroSeleccionadoId) || null;
  }, [seguroSeleccionadoId, productosSeguros]);

  // Filas de matriz — matrizTasaFija está directo en el objeto Product (no en rawData)
  const matrizFiltrada = useMemo((): MatrizSeguroFila[] => {
    if (!seguroActual) return [];
    const matriz: MatrizSeguroFila[] = Array.isArray((seguroActual as any).matrizTasaFija)
      ? (seguroActual as any).matrizTasaFija
      : [];
    if (montoEfectivo <= 0) return matriz; // sin monto → mostrar todas
    return matriz.filter(f => {
      const min = parseFloat(String(f.montoMinimo || 0)) || 0;
      const max = parseFloat(String(f.montoMaximo || 0)) || 0;
      return (min <= 0 || montoEfectivo >= min) && (max <= 0 || montoEfectivo <= max);
    });
  }, [seguroActual, montoEfectivo]);

  // La fila restaurada viene de JSON, así que NO es el mismo objeto que el de
  // matrizFiltrada y la tabla la compara por identidad (`matrizFilaSeleccionada === f`).
  // Al cargar la matriz se re-apunta a la fila equivalente para que aparezca marcada.
  useEffect(() => {
    if (!matrizFilaSeleccionada || matrizFiltrada.length === 0) return;
    if (matrizFiltrada.includes(matrizFilaSeleccionada)) return; // ya es la misma referencia
    const equivalente = matrizFiltrada.find(f =>
      String(f.montoDefault) === String(matrizFilaSeleccionada.montoDefault) &&
      String(f.tasaDefault) === String(matrizFilaSeleccionada.tasaDefault) &&
      String((f as any).periodo ?? '') === String((matrizFilaSeleccionada as any).periodo ?? '')
    );
    if (equivalente) setMatrizFilaSeleccionada(equivalente);
  }, [matrizFiltrada]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al seleccionar fila de matriz → calcular totalSeguro = monto + monto * (tasa/100)
  useEffect(() => {
    if (!matrizFilaSeleccionada) return;
    const monto = parseFloat(String(matrizFilaSeleccionada.montoDefault || 0)) || 0;
    const tasa  = parseFloat(String(matrizFilaSeleccionada.tasaDefault  || 0)) || 0;
    const plazo = parseInt(String(data.plazo || 1), 10) || 1;
    const total = monto + monto * (tasa / 100);
    const pagoPeriodo = plazo > 0 ? total / plazo : 0;
    setData(prev => ({
      ...prev,
      montoSeguro: total.toFixed(2),
      pagoSeguro: pagoPeriodo,
      pagoTotal: (parseFloat(prev.pagoMensual || '0') + pagoPeriodo),
    }));
  }, [matrizFilaSeleccionada, data.plazo]);

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

  // Tasa capturada/editada por el usuario fuera del rango [min, max] de la
  // fila de Matriz de Tasa Fija vigente (tasaRangoMatriz, del encabezado).
  const tasaFueraDeRango = useMemo(() => {
    if (!tasaRangoMatriz) return null;
    const tasaNum = parseFloat(data.tasa || '0') || 0;
    if (tasaNum <= 0) return null;
    if (tasaNum < tasaRangoMatriz.min || tasaNum > tasaRangoMatriz.max) {
      return `Tasa fuera de rango (${tasaRangoMatriz.min.toFixed(2)}% – ${tasaRangoMatriz.max.toFixed(2)}%)`;
    }
    return null;
  }, [data.tasa, tasaRangoMatriz]);

  // Señal GPO disponible temprano: la validación corre en este useMemo, que
  // se declara ANTES de los helpers gpo()/_tpRaw, así que no puede usar esGPO
  // (daría error por zona muerta temporal). Aquí basta con mirar el propio data.
  const esGpoPorDatos = !!(
    data.periodicidadCobroGpo || data.porcentajeCoberturaGpo ||
    data.montoGarantizadoGpo || data.sectorInfraestructura
  );

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
      } else if (plazoRangoMatriz) {
        // Arrendamiento/Crédito: ya hay una fila de Matriz seleccionada explícitamente
        // (encabezado) — validar solo contra ESE rango, no contra toda la matriz.
        if (!plazoNum || plazoNum <= 0) {
          errs.plazo = `Plazo debe estar en: ${plazoRangoMatriz.min}-${plazoRangoMatriz.max} ${esGpoPorDatos ? 'años' : 'meses'}`;
        } else if (plazoNum < plazoRangoMatriz.min || plazoNum > plazoRangoMatriz.max) {
          errs.plazo = `Plazo debe estar en: ${plazoRangoMatriz.min}-${plazoRangoMatriz.max} ${esGpoPorDatos ? 'años' : 'meses'}`;
        }
      } else if (matrizPlazoRanges.length > 0) {
        // Captación Inversión: sin fila seleccionada explícita — plazo debe caer
        // en cualquiera de los rangos plazoMinimo–plazoMaximo de la matriz.
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
  }, [data.montoSolicitado, data.plazo, data.tasa, productoSeleccionado, plazosValidosDirect, matrizPlazoRanges, lineaProducto, plazoRangoMatriz]);

  // Notificar al padre cuando hay errores
  useEffect(() => {
    onValidationChange?.(Object.keys(validationErrors).length > 0 || !!tasaFueraDeRango);
  }, [validationErrors, tasaFueraDeRango, onValidationChange]);

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

  /**
   * Valores GPO con respaldo directo del JSONB original.
   *
   * BUG FIX (2026-08-25): estos 6 campos llegaban a `data` por una cadena
   * larga y frágil — BD → preloadSubtabsFromDBData → sessionStorage
   * 'terminos' → getInit (que solo lee UNA vez, al montar). Cualquier
   * desfase de tiempo en esa cadena dejaba los seis en blanco y la sección
   * mostraba "—" aunque la Solicitud tuviera los datos completos en la base
   * (verificado: BAN-DIGITAL-20260825-000004 los tiene, 6/6).
   *
   * `_originalData` es el JSONB tal cual vino de la BD y lo siembra la misma
   * función, en sessionStorage Y en el store en memoria. Leerlo aquí como
   * respaldo hace que la sección no dependa del round-trip por `terminos`:
   * si `data` los trae, se usan; si no, se leen del original.
   */
  const gpoFallback = useMemo<Record<string, any>>(() => {
    const orig =
      loadFromSession<any>(solicitudId, '_originalData') ||
      loadFromSavedStore<any>(solicitudId, '_originalData');
    return orig?.solicitud?.terminos_condiciones?._raw || {};
  }, [solicitudId]);

  /** data (lo capturado/sembrado) manda; si viene vacío, cae al JSONB original. */
  const gpo = (campo: keyof TerminosCondiciones): string => {
    const v = (data as any)[campo];
    if (v !== undefined && v !== null && v !== '') return String(v);
    const f = gpoFallback[campo as string];
    return f !== undefined && f !== null && f !== '' ? String(f) : '';
  };
  const _tpRaw = (
    productoSeleccionado?.tipoProducto ||
    productoSeleccionado?.sublineaProducto ||
    productoSeleccionado?.rawData?.tipoProducto ||
    productoSeleccionado?.rawData?.default?.tipoProducto ||
    productoSeleccionado?.nombreProducto ||
    ''
  ).toLowerCase();
  const isInversion = isCaptacion && _tpRaw.includes('invers');


  /**
   * Garantía Financiera 2o Piso — la GPO no financia un bien ni lleva seguro:
   * cobra una comisión periódica sobre el Monto Garantizado. Bien y Seguro
   * Financiado no aplican y solo estorban en la captura.
   *
   * Misma detección que SimulacionTab: el nombre no siempre delata al
   * producto (la Solicitud real que genera el Cierre Comercial guarda
   * tipo_producto = "Simple" y linea_producto = "Línea de Crédito"), así que
   * la señal confiable son los propios datos GPO heredados.
   */
  const esGPO = _tpRaw.includes('garant')
    || !!gpo('periodicidadCobroGpo')
    || !!gpo('porcentajeCoberturaGpo')
    || !!gpo('montoGarantizadoGpo')
    || !!gpo('sectorInfraestructura');

  /**
   * Unidad del Plazo. Crédito/Arrendamiento lo capturan en meses; Garantía
   * Financiera 2o Piso lo captura en AÑOS — un GPO a 20 son 20 años, no 20
   * meses. El encabezado de la Matriz de Tasa Fija dice "PLAZO (MESES)"
   * para todos los productos, así que aquí se rotula según corresponda.
   */
  const unidadPlazo = esGPO ? 'años' : 'meses';

  return (
    <div className="border border-gray-200 bg-white p-5">
      {isInversion ? (
        <div className="bg-purple-50 border border-purple-300 rounded px-3 py-2 mb-4">
          <p className="text-xs text-purple-800">
            <strong>📈 Inversión a Plazo</strong>
            {' '}— Configure monto, plazo, tasa y método de pago de intereses.
            {productoSeleccionado?.rawData && (
              <span className="ml-2 text-purple-600">
                ✓ Producto: <strong>{productoSeleccionado.nombreProducto}</strong>
              </span>
            )}
          </p>
        </div>
      ) : (
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
      )}

      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {/* Col 1 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Monto Autorizado <span className="text-red-500">*</span></label>
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
                {isInversion ? 'Fecha de Inversión' : 'Fecha Primera Aportación'}
                {!isInversion && <span className="ml-1 text-gray-400 font-normal">(= Fecha Inicio)</span>}
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
            <label className="block text-xs text-gray-700 mb-1">
              Plazo <span className="text-red-500">*</span>
              {plazoRangoMatriz && <span className="ml-1 text-gray-400 font-normal">({plazoRangoMatriz.min}–{plazoRangoMatriz.max} {unidadPlazo})</span>}
            </label>
            <input
              type="text" inputMode="decimal"
              value={data.plazo || ''}
              onChange={e => {
                handleNumeric('plazo', e.target.value);
                onPlazoLoaded?.(e.target.value);
              }}
              disabled={isRO}
              placeholder={plazoRangoMatriz ? `Ej: ${plazoRangoMatriz.min}` : 'Ej: 12'}
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
            <select
              value={data.frecuencia}
              onChange={e => {
                set('frecuencia', e.target.value);
                // Mantener el encabezado en sincronía — sin esto conserva el
                // valor viejo y lo reimpone al volver a montar este tab.
                onFrecuenciaChange?.(e.target.value);
              }}
              disabled={isRO}
              className={sc()}
            >
              {opcionesFrecuencia.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">Tasa (%) <span className="text-red-500">*</span></label>
            <input
              type="text" inputMode="decimal"
              value={data.tasa}
              onChange={e => handleNumeric('tasa', e.target.value)}
              onBlur={() => {
                handlePercentBlur('tasa');
                // Subir la tasa al encabezado: es de donde la lee Simular.
                const raw = String(data.tasa || '').replace(/[^0-9.-]/g, '');
                const num = parseFloat(raw);
                if (!isNaN(num)) onTasaChange?.(Math.min(100, Math.max(0, num)).toFixed(4));
              }}
              // Editable dentro del rango de la fila de Matriz de Tasa Fija vigente
              // (tasaRangoMatriz); sin matriz o en Captación sigue de solo lectura.
              disabled={isRO || isCaptacion || (!!productoSeleccionado && !tasaRangoMatriz)}
              placeholder="0.0000"
              className={ic(false, !!validationErrors.tasa || !!tasaFueraDeRango)}
            />
            {tasaFueraDeRango && (
              <p className="text-[10px] text-red-500 mt-0.5">{tasaFueraDeRango}</p>
            )}
            {!tasaFueraDeRango && tasaRangoMatriz && (
              <p className="text-[10px] text-green-600 mt-0.5">Rango permitido: {tasaRangoMatriz.min.toFixed(2)}% – {tasaRangoMatriz.max.toFixed(2)}%</p>
            )}
            {!tasaRangoMatriz && (isCaptacion || productoSeleccionado) && data.tasa && (
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

          {isInversion && (
            <div>
              <label className="block text-xs text-gray-700 mb-1">Método de Pago de Intereses</label>
              <select
                value={data.metodoIntereses || 'Al vencimiento'}
                onChange={e => set('metodoIntereses', e.target.value)}
                disabled={isRO}
                className={sc()}
              >
                <option value="Al vencimiento">Al vencimiento</option>
                <option value="Capitalizable">Capitalizable</option>
              </select>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {(data.metodoIntereses || 'Al vencimiento') === 'Capitalizable'
                  ? 'Compuesto: Monto × (1 + tasa_periodo)^plazo − Monto'
                  : 'Simple: Monto × tasa × (plazo × días / 360)'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Cotizador de Arrendamiento — sección propia, fuera del grid de 3 columnas ── */}
      {isArrendamientoPuro && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="bg-[#4A6FA5] text-white text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded mb-3">
            Parámetros de Arrendamiento
          </div>
          <div className="grid grid-cols-4 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs text-gray-700 mb-1">Comisión por Apertura</label>
              <select
                value={data.comisionApertura || ''}
                onChange={e => set('comisionApertura', e.target.value)}
                disabled={isRO}
                className={sc()}
              >
                <option value="">Seleccione...</option>
                {comisionesAperturaProducto.map(o => (
                  <option key={o.id} value={o.valor}>{o.valor}%</option>
                ))}
              </select>
              {comisionesAperturaProducto.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-0.5">Sin opciones activas configuradas en el producto</p>
              )}
            </div>

            {enganchesProducto.length > 0 && (
              <div>
                <label className="block text-xs text-gray-700 mb-1">Monto Enganche</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                  <input
                    type="text"
                    value={formatCurrency(data.montoEnganche || 0)}
                    disabled
                    className={`${ic(true)} pl-5`}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">% Enganche se selecciona en el encabezado</p>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-700 mb-1">% Valor Residual</label>
              <select
                value={data.porcentajeValorResidualSel || ''}
                onChange={e => set('porcentajeValorResidualSel', e.target.value)}
                disabled={isRO}
                className={sc()}
              >
                <option value="">Sin residual (0%)</option>
                {valorResidualOpciones.map(o => (
                  <option key={o.id} value={o.valor}>{o.valor}%</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">Monto Residual</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  type="text"
                  value={formatCurrency(data.montoResidual || 0)}
                  disabled
                  className={`${ic(true)} pl-5`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">Rentas Anticipadas</label>
              <select
                value={data.rentasAnticipadas || ''}
                onChange={e => set('rentasAnticipadas', e.target.value)}
                disabled={isRO}
                className={sc()}
              >
                <option value="">Seleccione...</option>
                {rentasAnticipadasProducto.map(o => (
                  <option key={o.id} value={o.valor}>{o.valor}</option>
                ))}
              </select>
              {rentasAnticipadasProducto.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-0.5">Sin opciones activas configuradas en el producto</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">Plazo</label>
              <input
                type="text"
                value={data.plazo ? `${data.plazo} ${unidadPlazo}` : ''}
                disabled
                placeholder="Seleccione en Plazos y Montos"
                className={ic(true)}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">Tasa Mensual</label>
              <input
                type="text"
                value={data.tasa ? `${(parseFloat(data.tasa) / 12).toFixed(4)}%` : ''}
                disabled
                placeholder="Seleccione Plazo"
                className={ic(true)}
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Tasa anual de la Matriz ÷ 12</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bien (Garantía) — solo Crédito y Línea de Crédito, nunca GPO ── */}
      {!isCaptacion && !esGPO && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer">
              <input
                type="checkbox"
                checked={garantiaActiva}
                onChange={e => {
                  setGarantiaActiva(e.target.checked);
                  if (!e.target.checked) {
                    setGarantiaSeleccionada(null);
                    setData(prev => ({ ...prev, montoGarantia: '', montoCubrirGarantia: undefined, porcentajeAforo: undefined, tipoGarantia: undefined, subtipoGarantia: undefined, _garantiaActiva: false }));
                  } else {
                    setData(prev => ({ ...prev, _garantiaActiva: true }));
                  }
                }}
                disabled={isRO}
                className="w-3.5 h-3.5 accent-[#4A6FA5]"
              />
              Bien
            </label>
            {garantiasProducto.length === 0 && garantiaActiva && (
              <span className="text-[10px] text-amber-600">El producto no tiene bienes configurados</span>
            )}
          </div>

          {garantiaActiva && garantiasProducto.length > 0 && (() => {
            const montoNum = montoEfectivo;
            const sinMonto = montoNum <= 0;
            return (
              <div className="mb-3">
                {sinMonto && (
                  <div className="mb-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px]">
                    Ingrese el Monto Autorizado antes de seleccionar un bien.
                  </div>
                )}
                <div className={`border border-gray-300 overflow-hidden ${sinMonto ? 'opacity-50 pointer-events-none' : ''}`}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                        <th className="px-2 py-2 w-8 border-r border-gray-300" />
                        <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">TIPO</th>
                        <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">SUBTIPO</th>
                        <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold border-r border-gray-300">% AFORO</th>
                        <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold">MONTO A CUBRIR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {garantiasProducto.map((g, idx) => {
                        const sel = garantiaSeleccionada === g;
                        const aforo = parseFloat(String(g.aforo ?? '')) || 0;
                        const afoInvalido = aforo <= 0;
                        const montoCubrir = !afoInvalido && montoNum > 0 ? montoNum * aforo / 100 : null;
                        return (
                          <tr
                            key={idx}
                            className="border-b border-gray-200 cursor-pointer"
                            style={{ backgroundColor: sel ? '#E8F4F8' : idx % 2 === 0 ? '#FFF' : '#EEE' }}
                            onClick={() => !isRO && !sinMonto && !afoInvalido && setGarantiaSeleccionada(sel ? null : g)}
                          >
                            <td className="px-2 py-1.5 text-center border-r border-gray-200">
                              <input type="radio" checked={sel} readOnly disabled={afoInvalido || sinMonto} className="w-3 h-3 accent-[#4A6FA5]" />
                            </td>
                            <td className="px-3 py-1.5 border-r border-gray-200 font-medium text-gray-700">{g.tipo}</td>
                            <td className="px-3 py-1.5 border-r border-gray-200 text-gray-600">{g.subtipo || '—'}</td>
                            <td className="px-3 py-1.5 text-center border-r border-gray-200">
                              {afoInvalido
                                ? <span className="text-red-500 text-[9px]">Sin aforo</span>
                                : <span className="font-mono text-gray-700">{aforo}%</span>}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-blue-700">
                              {montoCubrir != null ? formatCurrency(montoCubrir) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {garantiaActiva && (
            <div className="grid grid-cols-3 gap-x-6">
              <div>
                <label className="block text-xs text-gray-700 mb-1">Monto Autorizado</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                  <input type="text" value={data.montoGarantia || ''}
                    readOnly disabled placeholder="0.00"
                    className={`${ic(true)} pl-5 bg-gray-50`} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Monto a Cubrir Bien</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                  <input type="text"
                    value={data.montoCubrirGarantia != null && data.montoCubrirGarantia > 0
                      ? Number(data.montoCubrirGarantia).toFixed(2) : ''}
                    readOnly disabled
                    placeholder="0.00" className={`${ic(true)} pl-5 bg-gray-50`} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">% Aforo</label>
                <div className="relative">
                  <input type="text" value={data.porcentajeAforo != null ? String(data.porcentajeAforo) : ''}
                    readOnly disabled placeholder="0" className={`${ic()} pr-6 bg-gray-50`} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Seguro Financiado — solo Crédito y Línea de Crédito, nunca GPO ── */}
      {!isCaptacion && !esGPO && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer">
              <input
                type="checkbox"
                checked={!!data.seguroFinanciado}
                onChange={e => {
                  set('seguroFinanciado', e.target.checked);
                  if (!e.target.checked) {
                    setSeguroSeleccionadoId('');
                    setMatrizFilaSeleccionada(null);
                    setData(prev => ({
                      ...prev,
                      montoSeguro: '', pagoSeguro: 0, pagoTotal: 0,
                      seguroProductoId: '', seguroMatrizFila: undefined,
                    }));
                  }
                }}
                disabled={isRO}
                className="w-3.5 h-3.5 accent-[#4A6FA5]"
              />
              Seguro Financiado
            </label>
          </div>

          {data.seguroFinanciado && (
            <div className="space-y-3">
              {/* Selector de seguro */}
              <div>
                <label className="block text-xs text-gray-700 mb-1">Seguro <span className="text-red-500">*</span></label>
                {loadingSeguros ? (
                  <p className="text-xs text-gray-400 py-1">Cargando seguros...</p>
                ) : productosSeguros.length === 0 ? (
                  <p className="text-xs text-amber-600 py-1">No hay productos de seguro configurados en J_PRODUCTOS</p>
                ) : (
                  <select
                    value={seguroSeleccionadoId}
                    onChange={e => {
                      setSeguroSeleccionadoId(e.target.value);
                      setMatrizFilaSeleccionada(null);
                      setData(prev => ({
                        ...prev,
                        seguroProductoId: e.target.value,
                        seguroMatrizFila: undefined,
                        montoSeguro: '', pagoSeguro: 0, pagoTotal: 0,
                      }));
                    }}
                    disabled={isRO}
                    className={sc()}
                  >
                    <option value="">-- Seleccionar seguro --</option>
                    {productosSeguros.map(s => (
                      <option key={s.dbUuid || String(s.id)} value={s.dbUuid || String(s.id)}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tabla Plazos y Montos del Seguro */}
              {seguroActual && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Plazos y Montos del Seguro</p>
                  {matrizFiltrada.length === 0 ? (
                    <p className="text-xs text-amber-600 py-1">
                      {montoEfectivo > 0
                        ? 'El monto solicitado no está dentro del rango de cobertura de este seguro.'
                        : 'Ingrese el monto solicitado para filtrar coberturas disponibles.'}
                    </p>
                  ) : (
                    <div className="border border-gray-300 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                            <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">PERIODO</th>
                            <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">MONTO DEF.</th>
                            <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">TASA DEF.</th>
                            <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold">ACCIÓN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matrizFiltrada.map((f, idx) => {
                            const sel = matrizFilaSeleccionada === f;
                            const periodo = (f as any).periodo || (f as any).frecuencia || '—';
                            return (
                              <tr key={idx} className="border-b border-gray-200"
                                style={{ backgroundColor: sel ? '#E8F4F8' : idx % 2 === 0 ? '#FFF' : '#EEE' }}>
                                <td className="px-3 py-2 border-r border-gray-200 text-gray-700">{periodo}</td>
                                <td className="px-3 py-2 border-r border-gray-200 text-right font-mono text-gray-700">
                                  {f.montoDefault != null ? formatCurrency(Number(f.montoDefault)) : '—'}
                                </td>
                                <td className="px-3 py-2 border-r border-gray-200 text-right font-mono text-gray-700">
                                  {f.tasaDefault != null ? `${f.tasaDefault}%` : '—'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {sel ? (
                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="inline-block text-[#4A6FA5]">
                                      <circle cx="9" cy="9" r="8" stroke="#4A6FA5" strokeWidth="1.5"/>
                                      <path d="M5 9l3 3 5-5" stroke="#4A6FA5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        if (isRO) return;
                                        setMatrizFilaSeleccionada(f);
                                        setData(prev => ({ ...prev, seguroMatrizFila: f }));
                                      }}
                                      disabled={isRO}
                                      className="px-2 py-0.5 bg-[#4A6FA5] text-white text-[10px] rounded hover:bg-[#3E5C91] disabled:opacity-40"
                                    >
                                      Sel.
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Resumen calculado */}
              {matrizFilaSeleccionada && (() => {
                const monto = Number(matrizFilaSeleccionada.montoDefault || 0);
                const tasa  = Number(matrizFilaSeleccionada.tasaDefault  || 0);
                const total = monto + monto * (tasa / 100);
                return (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Monto Seguro</label>
                      <input type="text" value={formatCurrency(monto)} readOnly disabled className={`${ic(true)} bg-gray-50`} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tasa Seguro</label>
                      <input type="text" value={`${tasa}%`} readOnly disabled className={`${ic(true)} bg-gray-50`} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Total Seguro</label>
                      <input type="text" value={formatCurrency(total)} readOnly disabled
                        className={`${ic(true)} bg-green-50 border-green-300 font-semibold`} />
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Total = {formatCurrency(monto)} + {formatCurrency(monto)} × {tasa / 100} = {formatCurrency(total)}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
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

      {/*
        BUG FIX (2026-08-25): estos campos ya llegaban hasta la BD (ver
        formToDBPayload en useSolicitudesDB.ts, líneas coreTerminosRaw) y ya se
        sembraban en `data` vía cotizacionTerminos (getInit más arriba), pero
        nunca se renderizaban en ningún lado — el usuario los daba por
        "perdidos" porque nada los mostraba, no porque no llegaran.
        Se detecta por la presencia del dato (no por tipoProducto) porque el
        producto GPO puede tener tipoProducto genérico "Línea de Crédito".
      */}
      {/* CAMBIO (2026-08-25): la condición era por presencia de datos, así que
          si la Solicitud no hidrataba bien la sección DESAPARECÍA por completo
          y no había forma de notar que faltaban los campos. La spec la pide
          por tipo de producto: se muestra siempre en Línea de Crédito / GPO,
          y los valores que falten se ven como "—". Un hueco visible es mucho
          más útil que una sección invisible. */}
      {(isLineaCredito || gpo('periodicidadCobroGpo') || gpo('sectorInfraestructura') || gpo('porcentajeCoberturaGpo')) && (
        <div className="mt-4 border border-teal-200 rounded overflow-hidden">
          <div className="bg-teal-50 border-b border-teal-200 px-3 py-2">
            <span className="text-xs font-medium text-teal-800 uppercase">
              Garantía Financiera 2o Piso — heredado de la Oportunidad (Cierre Comercial)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 p-3">
            <div>
              <label className="block text-xs text-gray-700 mb-1">Sector de Infraestructura</label>
              <input type="text" value={gpo('sectorInfraestructura') || '—'} disabled className={ic(true)} />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Monto Emisión Proyectado</label>
              <input
                type="text"
                value={gpo('montoEmisionProyectado') ? formatCurrency(parseFloat(gpo('montoEmisionProyectado')) || 0) : '—'}
                disabled
                className={ic(true)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">% Cobertura GPO</label>
              <input type="text" value={gpo('porcentajeCoberturaGpo') ? `${gpo('porcentajeCoberturaGpo')}%` : '—'} disabled className={ic(true)} />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Monto Garantizado GPO</label>
              <input
                type="text"
                value={gpo('montoGarantizadoGpo') ? formatCurrency(parseFloat(gpo('montoGarantizadoGpo')) || 0) : '—'}
                disabled
                className={ic(true)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Tasa Comisión Anual Pactada</label>
              <input type="text" value={gpo('tasaComisionAnualPactada') ? `${gpo('tasaComisionAnualPactada')}%` : '—'} disabled className={ic(true)} />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Periodicidad Cobro Comisión <span className="text-red-500">*</span></label>
              <input type="text" value={gpo('periodicidadCobroGpo') || '—'} disabled className={ic(true)} />
              <p className="text-[10px] text-gray-500 mt-0.5">
                Heredado de la Oportunidad; no se captura aquí. Determina cada cuánto se cobra la
                comisión — es independiente del <span className="font-medium">Plazo</span> y de la
                <span className="font-medium"> Frecuencia</span> del producto.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}