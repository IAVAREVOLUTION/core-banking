/**
 * cotizacionCaptacionTypes.ts  v2.0
 *
 * Tipos institucionales para el módulo Cotizaciones → Captación
 * Mapeados 1:1 con la tabla EFINANCIANET_DB."J_COTIZACIONES"
 *
 * Nombres de campo alineados con la especificación:
 *   - data.plazoCumplirMontoMinimo  (no "plazoCumplirMonto")
 *   - data.periodoCumplirMontoMinimo (top-level, no solo en producto)
 *   - data.tasaMinInteres            (alias institucional)
 *   - data.montoCotizado             (>= producto.montoMinimo)
 */

/** Registro raíz de J_COTIZACIONES */
export interface CotizacionCaptacion {
  id: string;
  no_cotiza: string;
  descripcion: string;
  producto_id: string;
  cliente_id: string;
  fecha_cotiza: string;
  estatus_cotiza: string;
  /** Columna física — "Captación", "Crédito" o "Línea Crédito" */
  linea_cotizacion: string;
  data: CotizacionCaptacionData;
}

/** JSON data institucional — spec §10 */
export interface CotizacionCaptacionData {
  lineaProducto: string;
  usuario: string;
  cliente: {
    claveCliente: string;
    nombreCompleto: string;
    [key: string]: any;
  };
  institucionGobierno: string;
  producto: {
    claveProducto: string;
    nombreProducto: string;
    tipoProducto: string;
    montoMinimo: number;
    periodoCumplirMontoMinimo: string;
    plazoCumplirMontoMinimo: number;
    [key: string]: any;
  };
  montoCotizado: number | string;
  tasaMinInteres: number;
  frecuenciaCapitalizacion: string;
  interesGeneradoPeriodo: number;
  periodoCumplirMontoMinimo: string;
  plazoCumplirMontoMinimo: number;
  fechaPrimeraAportacion: string;
  calendarioAportaciones: AportacionCalendario[];
  // ── Inversión ──
  metodoIntereses?: string;         // 'Al vencimiento' | 'Capitalizable'
  renovacionAutomatica?: boolean;   // checkbox S/N
  numeroRenovaciones?: number;      // entero >= 0
  tablaFlujoInversion?: FlujInversionRow[];
  // ── Crédito / Línea de Crédito fields (opcionales) ──
  plazo?: string;
  periodo?: string;
  tasaCotizada?: string | number;
  amortizacion?: string;
  pagoPorPeriodo?: string | number;
  interesPagar?: string | number;
  fechaPrimerPago?: string;
  seguroFinanciado?: boolean | null;
  seguro?: Record<string, any> | null;
  garantia?: Record<string, any> | null;
  tablaAmortizacion?: any[];
  tipoLinea?: string;
  /** Index signature para campos adicionales del JSONB */
  [key: string]: any;
}

export interface FlujInversionRow {
  periodo: number;
  fechaInversion: string;
  capitalInicial: number;
  interesBruto: number;
  retencionISR: number;
  interesNeto: number;
  capitalFinal: number;
}

export interface AportacionCalendario {
  noAportacion: number;
  /** Fecha de la aportación — spec §10.3 usa "fecha" */
  fecha: string;
  /** Monto de la aportación — spec §10.3 usa "monto" */
  monto: number;
  moneda: string;
}

/** Frecuencias para capitalización de intereses — spec §5 */
export const FRECUENCIAS: { label: string; dias: number }[] = [
  { label: 'Diario', dias: 1 },
  { label: 'Semanal', dias: 7 },
  { label: 'Catorcenal', dias: 14 },
  { label: 'Quincenal', dias: 15 },
  { label: 'Mensual', dias: 30 },
  { label: 'Trimestral', dias: 90 },
];

/** Genera un ID de cotización de 30 caracteres — spec §3.1 */
export function generarNoCotiza(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Array.from({ length: 30 - ts.length - 4 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
  ).join('');
  return `COT-${ts}${rand}`.slice(0, 30);
}

/**
 * Calcula intereses generados por periodo — spec §5
 * InteresesGenerados = MontoCotizado × (TasaInicial / 360) × FrecuenciaCapitalizaIntereses
 */
export function calcularIntereses(
  montoCotizado: number,
  tasaAnual: number,
  frecuencia: string
): number {
  const freq = FRECUENCIAS.find(f => f.label === frecuencia);
  if (!freq || montoCotizado <= 0 || tasaAnual <= 0) return 0;
  return montoCotizado * (tasaAnual / 100 / 360) * freq.dias;
}

/**
 * Genera calendario de aportaciones — spec §7
 *   NoAportación: 1 … PlazoCumplirMontoMinimo
 *   FechaAportación[i] = FechaAportación[i-1] + PeriodoDias
 *   MontoAportación = MontoCotizado / PlazoCumplirMontoMinimo
 */
export function generarCalendario(
  montoCotizado: number,
  plazo: number,
  fechaPrimera: string,
  frecuencia: string
): AportacionCalendario[] {
  if (plazo <= 0 || !fechaPrimera || montoCotizado <= 0) return [];
  const freq = FRECUENCIAS.find(f => f.label === frecuencia);
  if (!freq) return [];

  const montoAportacion = montoCotizado / plazo;
  const result: AportacionCalendario[] = [];
  let fecha = new Date(fechaPrimera + 'T00:00:00');

  for (let i = 0; i < plazo; i++) {
    result.push({
      noAportacion: i + 1,
      fecha: fecha.toISOString().split('T')[0],
      monto: Math.round(montoAportacion * 100) / 100,
      moneda: 'MXN',
    });
    fecha = new Date(fecha.getTime() + freq.dias * 86400000);
  }
  return result;
}

/** Validaciones institucionales — spec §4 y §9 */
export interface ValidacionResult {
  valid: boolean;
  errors: string[];
}

export function validarCotizacionCaptacion(c: CotizacionCaptacion): ValidacionResult {
  const errors: string[] = [];
  const d = c.data;

  if (!c.cliente_id) errors.push('Debe seleccionar un Prospecto/Cliente (cliente_id requerido).');
  if (!c.producto_id) errors.push('Debe seleccionar un Producto (producto_id requerido).');
  if (!d.cliente?.claveCliente) errors.push('Falta clave del cliente (data.cliente.claveCliente).');
  if (!d.producto?.claveProducto) errors.push('Falta clave del producto (data.producto.claveProducto).');

  // Validación Monto >= montoMinimo — spec §4.3
  // Normalizar ambos valores a número real, eliminando comas, espacios, símbolos de moneda
  const normalizeNum = (v: number | string | undefined | null): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const cleaned = String(v).replace(/[^0-9.-]/g, '');
    if (cleaned === '' || isNaN(Number(cleaned))) return null;
    return Number(cleaned);
  };

  const montoCotizadoNum = normalizeNum(d.montoCotizado);
  const montoMinimoNum = normalizeNum(d.producto.montoMinimo);

  // DEBUG: ver valores exactos en consola
  console.log('[validarCotizacionCaptacion] montoCotizado raw:', d.montoCotizado, '→ normalized:', montoCotizadoNum);
  console.log('[validarCotizacionCaptacion] montoMinimo raw:', d.producto.montoMinimo, '→ normalized:', montoMinimoNum);

  // Solo validar la comparación cuando:
  // 1. AMBOS valores son numéricos válidos
  // 2. El monto cotizado es mayor a 0 (si es 0 o vacío, el error de "campo requerido" se valida en otro lado)
  // 3. El monto mínimo está configurado (> 0)
  if (montoCotizadoNum !== null && montoCotizadoNum > 0 && montoMinimoNum !== null && montoMinimoNum > 0 && montoCotizadoNum < montoMinimoNum) {
    errors.push(`Monto Cotizado ($${montoCotizadoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}) debe ser ≥ Monto Mínimo ($${montoMinimoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}).`);
  }

  // Validación Plazo — spec §4.5
  const plazoNum = Number(d.plazoCumplirMontoMinimo);
  const plazoProdNum = Number(d.producto.plazoCumplirMontoMinimo);
  if (isNaN(plazoNum) || plazoNum < 0) {
    errors.push('Plazo Cumplir Monto Mínimo no puede ser menor que 0.');
  }
  if (!isNaN(plazoProdNum) && plazoProdNum > 0 && !isNaN(plazoNum) && plazoNum < plazoProdNum) {
    errors.push(`Plazo (${plazoNum}) debe ser ≥ Plazo del Producto (${plazoProdNum}).`);
  }

  // Fecha primera aportación obligatoria si plazo > 0 — spec §6
  if (d.plazoCumplirMontoMinimo > 0 && !d.fechaPrimeraAportacion) {
    errors.push('Fecha Primera Aportación es obligatoria cuando Plazo > 0.');
  }

  return { valid: errors.length === 0, errors };
}

/** Datos vacíos para Alta — spec §10 JSON institucional completo */
export function crearCotizacionVacia(noCotiza: string): CotizacionCaptacion {
  return {
    id: '',
    no_cotiza: noCotiza,
    descripcion: '',
    producto_id: '',
    cliente_id: '',
    fecha_cotiza: new Date().toISOString(),
    estatus_cotiza: 'Pendiente',
    linea_cotizacion: 'Captación',
    data: {
      lineaProducto: 'Captación',
      usuario: 'Admin',
      cliente: { claveCliente: '', nombreCompleto: '' },
      institucionGobierno: '',
      producto: {
        claveProducto: '',
        nombreProducto: '',
        tipoProducto: '',
        montoMinimo: 0,
        periodoCumplirMontoMinimo: '',
        plazoCumplirMontoMinimo: 0,
      },
      montoCotizado: 0,
      tasaMinInteres: 0,
      frecuenciaCapitalizacion: 'Mensual',
      interesGeneradoPeriodo: 0,
      periodoCumplirMontoMinimo: '',
      plazoCumplirMontoMinimo: 0,
      fechaPrimeraAportacion: '',
      calendarioAportaciones: [],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// DEEP MERGE INSTITUCIONAL — spec cotizacion-edit-logic.md §4
//
// Reglas:
//   • data SIEMPRE va a la izquierda (base)
//   • El JSON parcial va a la derecha (edits)
//   • Solo se actualizan los campos enviados
//   • Los campos no enviados se conservan
//   • No se borra nada del JSON existente
//   • Merge recursivo para objetos anidados (cliente, producto)
// ═══════════════════════════════════════════════════════════════════

/** Deep merge de dos objetos JSONB — equivale a `data || partial` pero recursivo */
export function deepMergeJsonb<T extends Record<string, any>>(base: T, partial: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(partial) as Array<keyof T>) {
    const baseVal = base[key];
    const partialVal = partial[key];
    if (
      partialVal !== null &&
      partialVal !== undefined &&
      typeof partialVal === 'object' &&
      !Array.isArray(partialVal) &&
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      // Merge recursivo para objetos anidados (cliente, producto)
      result[key] = deepMergeJsonb(baseVal, partialVal) as T[keyof T];
    } else if (partialVal !== undefined) {
      result[key] = partialVal as T[keyof T];
    }
  }
  return result;
}

/**
 * Computa el JSON parcial (diff) entre original y editado.
 * Solo incluye campos que cambiaron. Para objetos anidados,
 * incluye el objeto completo si algún sub-campo cambió.
 * Spec §3: "Construcción del JSON parcial (solo campos editados)"
 */
export function computePartialData(
  original: CotizacionCaptacionData,
  edited: CotizacionCaptacionData
): Partial<CotizacionCaptacionData> {
  const partial: Record<string, any> = {};

  // Campos escalares top-level
  const scalarKeys: (keyof CotizacionCaptacionData)[] = [
    'lineaProducto', 'usuario', 'institucionGobierno',
    'montoCotizado', 'tasaMinInteres', 'frecuenciaCapitalizacion',
    'interesGeneradoPeriodo', 'periodoCumplirMontoMinimo',
    'plazoCumplirMontoMinimo', 'fechaPrimeraAportacion',
  ];

  for (const key of scalarKeys) {
    if (JSON.stringify(original[key]) !== JSON.stringify(edited[key])) {
      partial[key] = edited[key];
    }
  }

  // Objeto anidado: cliente
  if (
    original.cliente.claveCliente !== edited.cliente.claveCliente ||
    original.cliente.nombreCompleto !== edited.cliente.nombreCompleto
  ) {
    partial.cliente = edited.cliente;
  }

  // Objeto anidado: producto (siempre incluir completo si algo cambió)
  const prodKeys = ['claveProducto', 'nombreProducto', 'tipoProducto', 'montoMinimo', 'periodoCumplirMontoMinimo', 'plazoCumplirMontoMinimo'] as const;
  const prodChanged = prodKeys.some(k => JSON.stringify(original.producto[k]) !== JSON.stringify(edited.producto[k]));
  if (prodChanged) {
    partial.producto = edited.producto;
  }

  // Array: calendarioAportaciones (siempre incluir si cambió)
  if (JSON.stringify(original.calendarioAportaciones) !== JSON.stringify(edited.calendarioAportaciones)) {
    partial.calendarioAportaciones = edited.calendarioAportaciones;
  }

  return partial as Partial<CotizacionCaptacionData>;
}

// ═══════════════════════════════════════════════════════════════════
// TABLA DE FLUJO DE INVERSIÓN
// ═══════════════════════════════════════════════════════════════════

/** Tasa ISR anual SAT 2024 — 1.04% sobre el capital */
export const TASA_ISR_ANUAL = 0.0104;

const DIAS_FRECUENCIA: Record<string, number> = {
  'Diario': 1, 'Semanal': 7, 'Catorcenal': 14, 'Quincenal': 15,
  'Mensual': 30, 'Trimestral': 90, 'Semestral': 180, 'Anual': 360,
};

export function getDiasFrecuencia(freq: string): number {
  return DIAS_FRECUENCIA[freq] || 30;
}

/**
 * Genera la Tabla de Flujo de Inversión.
 *
 * Capitalizable : interés se reinvierte → capitalInicial[i+1] = capitalFinal[i]
 * Al vencimiento: capital constante, última fila acumula totales
 *
 * Fórmulas (imagen referencia):
 *   tasaPeriodo  = tasaAnual% / 360 * diasPeriodo
 *   interesBruto = capitalInicial * tasaPeriodo
 *   retencionISR = capitalInicial * (TASA_ISR_ANUAL / 360 * diasPeriodo)
 *   interesNeto  = interesBruto - retencionISR
 */
/** Parsea fecha en YYYY-MM-DD o DD/MM/YYYY → Date local sin problemas de TZ */
function parseFechaLocal(f: string): Date {
  const slash = f.split('/');
  if (slash.length === 3 && slash[0].length === 2) {
    // DD/MM/YYYY
    return new Date(parseInt(slash[2]), parseInt(slash[1]) - 1, parseInt(slash[0]));
  }
  const dash = f.split('-');
  if (dash.length === 3 && dash[0].length === 4) {
    // YYYY-MM-DD
    return new Date(parseInt(dash[0]), parseInt(dash[1]) - 1, parseInt(dash[2]));
  }
  return new Date(f); // fallback
}

export function calcularFlujInversion(
  monto: number,
  tasaAnual: number,
  plazo: number,
  frecuencia: string,
  fechaInicio: string,
  metodo: string,
  tasaISRAnual: number = TASA_ISR_ANUAL,
): FlujInversionRow[] {
  if (!monto || !tasaAnual || !plazo || !fechaInicio) return [];

  const dias = getDiasFrecuencia(frecuencia);
  const tasaPeriodo    = (tasaAnual / 100) / 360 * dias;
  const tasaISRPeriodo = tasaISRAnual / 360 * dias;
  const esCapitalizable = (metodo || '').toLowerCase().includes('capitaliz');
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const toISO = (d: Date): string => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  // ── Al vencimiento: UNA sola fila con interés compuesto al vencimiento ──
  if (!esCapitalizable) {
    const totalDias = plazo * dias;
    const base = parseFechaLocal(fechaInicio);
    const fechaVencimiento = new Date(base.getFullYear(), base.getMonth(), base.getDate() + totalDias);
    const interesBruto = r2(monto * (Math.pow(1 + tasaPeriodo, plazo) - 1)); // compuesto
    const retencionISR = r2(monto * (tasaISRAnual / 360) * totalDias);
    const interesNeto  = r2(interesBruto - retencionISR);
    return [{
      periodo: 1,
      fechaInversion: toISO(fechaVencimiento),
      capitalInicial: monto,
      interesBruto,
      retencionISR,
      interesNeto,
      capitalFinal: r2(monto + interesNeto),
    }];
  }

  // ── Capitalizable: una fila por período con reinversión ──
  const rows: FlujInversionRow[] = [];
  let fecha = parseFechaLocal(fechaInicio);
  let capitalActual = monto;

  for (let i = 1; i <= plazo; i++) {
    const interesBruto = r2(capitalActual * tasaPeriodo);
    const retencionISR = r2(capitalActual * tasaISRPeriodo);
    const interesNeto  = r2(interesBruto - retencionISR);
    const capitalFinal = r2(capitalActual + interesNeto);
    rows.push({ periodo: i, fechaInversion: toISO(fecha), capitalInicial: capitalActual, interesBruto, retencionISR, interesNeto, capitalFinal });
    capitalActual = capitalFinal;
    fecha = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);
  }

  return rows;
}