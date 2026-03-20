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
  if (d.producto.montoMinimo > 0 && d.montoCotizado < d.producto.montoMinimo) {
    errors.push(`Monto Cotizado ($${d.montoCotizado}) debe ser ≥ Monto Mínimo ($${d.producto.montoMinimo}).`);
  }

  // Validación Plazo — spec §4.5
  if (d.plazoCumplirMontoMinimo < 0) {
    errors.push('Plazo Cumplir Monto Mínimo no puede ser menor que 0.');
  }
  if (d.producto.plazoCumplirMontoMinimo > 0 && d.plazoCumplirMontoMinimo > d.producto.plazoCumplirMontoMinimo) {
    errors.push(`Plazo (${d.plazoCumplirMontoMinimo}) debe ser ≤ Plazo del Producto (${d.producto.plazoCumplirMontoMinimo}).`);
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
      result[key] = deepMergeJsonb(baseVal, partialVal);
    } else if (partialVal !== undefined) {
      result[key] = partialVal;
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