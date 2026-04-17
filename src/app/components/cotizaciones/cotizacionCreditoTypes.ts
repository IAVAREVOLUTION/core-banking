/**
 * cotizacionCreditoTypes.ts  v2.0
 *
 * Tipos institucionales para Cotizaciones → Crédito y Línea de Crédito
 * Alineado con spec credito-cotizaciones-module.md §1–§12
 *
 * Campos físicos en J_COTIZACIONES:
 *   no_cotiza, producto_id, cliente_id, fecha_cotiza, estatus_cotiza, linea_cotizacion
 * Todo lo demás va en data (jsonb).
 */

// ═══════════════════════════════════════════════════════════════
// ROOT — misma tabla J_COTIZACIONES
// ═══════════════════════════════════════════════════════════════
export interface CotizacionCredito {
  id: string;
  no_cotiza: string;
  descripcion: string;
  producto_id: string;
  cliente_id: string;
  fecha_cotiza: string;
  estatus_cotiza: string;
  /** Columna física — "Crédito" o "Línea de Crédito" */
  linea_cotizacion?: string;
  data: CotizacionCreditoData;
}

// ═══════════════════════════════════════════════════════════════
// DATA (jsonb) — spec §2–§10
// ═══════════��═══════════════════════════════════════════════════
export interface CotizacionCreditoData {
  lineaProducto: 'Crédito' | 'Línea de Crédito';
  usuario: string;

  // §2.1 — Cliente
  cliente: {
    claveCliente: string;
    nombreCompleto: string;
  };
  institucionGobierno: string;

  // §3 — Producto
  producto: {
    claveProducto: string;
    nombreProducto: string;
    tipoProducto: string;
    lineaProducto: string;
  };
  moneda: string;

  // §4 — Plazos y Montos (Matriz Tasa Fija pick-map)
  periodo: string;
  plazoMinimo: number;
  plazoMaximo: number;
  plazo: number;               // editable, default from matriz
  montoMinimo: number;
  montoMaximo: number;
  montoSolicitado: number;     // editable, default from matriz
  tasaMinima: number;
  tasaMaxima: number;
  tasaCotizada: number;        // editable, default from matriz

  // §5 — Garantía
  tipoGarantia: string;
  subtipoGarantia: string;
  aforo: number;
  montoGarantia: number;       // = montoSolicitado * aforo

  // §6 — Cálculo de Amortización
  tipoCalculoAmortizacion: string;

  // §7 — Seguro Financiado
  seguroFinanciado: boolean;
  seguroNombre: string;
  montoSeguro: number;
  tasaSeguro: number;
  totalSeguro: number;         // = montoSeguro * (1 + tasaSeguro * plazo)

  // §8 — Fecha Primer Pago
  fechaPrimerPago: string;

  // Calculados
  interesAPagar: number;
  pagoPeriodo: number;
  pagoSeguroPeriodo: number;
  pagoTotal: number;           // pagoPeriodo + pagoSeguroPeriodo

  // Compatibilidad (se mantienen para la tabla de amortización existente)
  pagoMensual: number;
  interesTotal: number;
  montoTotal: number;
  cat: number;

  // Tipo tasa / frecuencia (del formulario anterior)
  tipoTasa: string;
  frecuenciaPago: string;

  // Línea de Crédito específicos
  tipoLinea?: 'Fija' | 'Revolvente' | '';

  // §10 — Tabla de amortización
  tablaAmortizacion: AmortizacionRow[];
}

// ═══════════════════════════════════════════════════════════════
// Fila de la tabla de amortización — spec §10
// ═══════════════════════════════════════════════════════════════
export interface AmortizacionRow {
  noPago: number;
  fechaPago: string;
  saldoInsoluto: number;
  pagoCapital: number;
  pagoInteres: number;
  ivaInteres: number;
  pagoPeriodo: number;
  pagoSeguro: number;
  pagoTotal: number;
  moneda: string;
}

// ═══════════════════════════════════════════════════════════════
// Fila de Matriz Tasa Fija (del producto)
// ═══════════════════════════════════════════════════════════════
export interface MatrizTasaFijaRow {
  id: number;
  periodo: string;
  plazoMinimo: number;
  plazoMaximo: number;
  plazoDefault: number;
  montoMinimo: number;
  montoMaximo: number;
  montoDefault: number;
  moneda: string;
  tasaMinima: number;
  tasaMaxima: number;
  tasaDefault: number;
}

// ═══════════════════════════════════════════════════════════════
// Garantía (del producto)
// ═══════════════════════════════════════════════════════════════
export interface GarantiaProducto {
  id: number;
  tipoGarantia: string;
  subtipoGarantia: string;
  aforo: number; // porcentaje, e.g. 1.2 = 120%
}

// ═══════════════════════════════════════════════════════════════
// Seguro / Paquete (del producto)
// Montos y Coberturas — estructura alineada con MatrizTasaFija del subtab
// ═══════════════════════════════════════════════════════════════
export interface SeguroProducto {
  id: number;
  nombre: string;
  tipo: string;
  montosYCoberturas: SeguroMatrizRow[];
}

/** Fila de Montos y Coberturas — misma estructura que MatrizTasaFija del Producto Seguro */
export interface SeguroMatrizRow {
  periodo: string;
  plazoMinimo: number;
  plazoMaximo: number;
  plazoDefault: number;
  montoMinimo: number;
  montoMaximo: number;
  montoDefault: number;
  tasaMinima: number;
  tasaMaxima: number;
  tasaDefault: number;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════
export const TIPOS_CALCULO_AMORTIZACION = [
  'Francés',
  'Alemán',
  'Americano',
  'Simple',
];

export const TIPOS_TASA = ['Fija', 'Variable'];

export const FRECUENCIAS_PAGO: { label: string; dias: number }[] = [
  { label: 'Semanal', dias: 7 },
  { label: 'Catorcenal', dias: 14 },
  { label: 'Quincenal', dias: 15 },
  { label: 'Mensual', dias: 30 },
  { label: 'Trimestral', dias: 90 },
  { label: 'Semestral', dias: 180 },
  { label: 'Anual', dias: 360 },
];

const IVA_RATE = 0.16;

// ═══════════════════════════════════════════════════════════════
// FUNCIONES UTILITARIAS
// ═══════════════════════════════════════════════════════════════

/** Genera ID cotización 30 chars */
export function generarNoCotizaCredito(prefix: 'CRE' | 'LDC' = 'CRE'): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Array.from({ length: 30 - ts.length - 4 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
  ).join('');
  return `${prefix}-${ts}${rand}`.slice(0, 30);
}

/**
 * Calcula Pago por Periodo (sistema Francés)
 * PMT = P × [r(1+r)^n] / [(1+r)^n − 1]
 * donde r = tasaAnual/100/360 × díasPeriodo
 */
export function calcularPagoPeriodo(
  monto: number,
  tasaAnual: number,
  numeroPagos: number,
  diasPeriodo: number
): number {
  if (monto <= 0 || tasaAnual <= 0 || numeroPagos <= 0 || diasPeriodo <= 0) return 0;
  const r = (tasaAnual / 100 / 360) * diasPeriodo;
  const factor = Math.pow(1 + r, numeroPagos);
  return monto * (r * factor) / (factor - 1);
}

/**
 * Genera tabla de amortización completa — spec §10
 * Soporta: Francés, Alemán, Americano, Simple
 */
export function generarTablaAmortizacionCredito(
  monto: number,
  tasaAnual: number,
  plazo: number,
  periodo: string,
  fechaPrimerPago: string,
  tipoCalculo: string,
  seguroPorPeriodo: number = 0
): AmortizacionRow[] {
  if (monto <= 0 || tasaAnual <= 0 || plazo <= 0 || !fechaPrimerPago) return [];

  const freq = FRECUENCIAS_PAGO.find(f => f.label === periodo);
  const diasPeriodo = freq?.dias || 30;
  const r = (tasaAnual / 100 / 360) * diasPeriodo;

  const rows: AmortizacionRow[] = [];
  let saldo = monto;
  let fecha = new Date(fechaPrimerPago + 'T00:00:00');

  const tipoLower = (tipoCalculo || 'francés').toLowerCase();

  for (let i = 0; i < plazo; i++) {
    let pagoCapital = 0;
    let pagoInteres = Math.round(saldo * r * 100) / 100;
    let ivaInteres = Math.round(pagoInteres * IVA_RATE * 100) / 100;

    if (tipoLower.includes('francés') || tipoLower.includes('frances')) {
      // Pagos iguales
      const pmt = calcularPagoPeriodo(monto, tasaAnual, plazo, diasPeriodo);
      pagoCapital = Math.round((pmt - pagoInteres) * 100) / 100;
    } else if (tipoLower.includes('alemán') || tipoLower.includes('aleman')) {
      // Capital constante
      pagoCapital = Math.round((monto / plazo) * 100) / 100;
    } else if (tipoLower.includes('americano')) {
      // Solo intereses, capital al final
      pagoCapital = i === plazo - 1 ? saldo : 0;
    } else {
      // Simple — capital constante + interés sobre saldo original
      pagoCapital = Math.round((monto / plazo) * 100) / 100;
      pagoInteres = Math.round((monto * r) * 100) / 100;
      ivaInteres = Math.round(pagoInteres * IVA_RATE * 100) / 100;
    }

    // Ajuste último pago
    if (i === plazo - 1 && !tipoLower.includes('americano')) {
      pagoCapital = Math.round(saldo * 100) / 100;
    }

    const pagoPeriodo = Math.round((pagoCapital + pagoInteres + ivaInteres) * 100) / 100;
    const pagoSeguro = Math.round(seguroPorPeriodo * 100) / 100;
    const pagoTotal = Math.round((pagoPeriodo + pagoSeguro) * 100) / 100;

    saldo = Math.round((saldo - pagoCapital) * 100) / 100;
    if (saldo < 0) saldo = 0;

    rows.push({
      noPago: i + 1,
      fechaPago: fecha.toISOString().split('T')[0],
      saldoInsoluto: saldo,
      pagoCapital,
      pagoInteres,
      ivaInteres,
      pagoPeriodo,
      pagoSeguro,
      pagoTotal,
      moneda: 'MXN',
    });

    fecha = new Date(fecha.getTime() + diasPeriodo * 86400000);
  }

  return rows;
}

/** Cotización vacía para Crédito */
export function crearCotizacionCreditoVacia(
  noCotiza: string,
  linea: 'Crédito' | 'Línea de Crédito' = 'Crédito'
): CotizacionCredito {
  return {
    id: '',
    no_cotiza: noCotiza,
    descripcion: '',
    producto_id: '',
    cliente_id: '',
    fecha_cotiza: new Date().toISOString(),
    estatus_cotiza: 'Pendiente',
    linea_cotizacion: linea === 'Línea de Crédito' ? 'Línea Crédito' : 'Crédito',
    data: {
      lineaProducto: linea,
      usuario: 'Admin',
      cliente: { claveCliente: '', nombreCompleto: '' },
      institucionGobierno: '',
      producto: { claveProducto: '', nombreProducto: '', tipoProducto: '', lineaProducto: linea },
      moneda: 'MXN',

      // Matriz Tasa Fija
      periodo: 'Mensual',
      plazoMinimo: 0,
      plazoMaximo: 0,
      plazo: 0,
      montoMinimo: 0,
      montoMaximo: 0,
      montoSolicitado: 0,
      tasaMinima: 0,
      tasaMaxima: 0,
      tasaCotizada: 0,

      // Garantía
      tipoGarantia: '',
      subtipoGarantia: '',
      aforo: 0,
      montoGarantia: 0,

      // Cálculo
      tipoCalculoAmortizacion: 'Francés',

      // Seguro
      seguroFinanciado: false,
      seguroNombre: '',
      montoSeguro: 0,
      tasaSeguro: 0,
      totalSeguro: 0,

      // Fecha
      fechaPrimerPago: '',

      // Calculados
      interesAPagar: 0,
      pagoPeriodo: 0,
      pagoSeguroPeriodo: 0,
      pagoTotal: 0,
      pagoMensual: 0,
      interesTotal: 0,
      montoTotal: 0,
      cat: 0,

      tipoTasa: 'Fija',
      frecuenciaPago: 'Mensual',

      tablaAmortizacion: [],

      ...(linea === 'Línea de Crédito' ? {
        tipoLinea: '',
      } : {}),
    },
  };
}

/** Validaciones institucionales — spec §9 */
export function validarCotizacionCredito(c: CotizacionCredito): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const d = c.data;

  if (!c.cliente_id) errors.push('Debe seleccionar un Cliente.');
  if (!c.producto_id) errors.push('Debe seleccionar un Producto.');

  // §9 — Plazo
  const _plazo    = parseFloat(String(d.plazo).replace(/[^0-9.-]/g, '')) || 0;
  const _plazoMin = parseFloat(String(d.plazoMinimo).replace(/[^0-9.-]/g, '')) || 0;
  const _plazoMax = parseFloat(String(d.plazoMaximo).replace(/[^0-9.-]/g, '')) || 0;
  if (_plazo <= 0) errors.push('Plazo debe ser mayor a 0.');
  if (_plazoMin > 0 && _plazo < _plazoMin) errors.push(`Plazo (${_plazo}) debe ser ≥ Plazo Mínimo (${_plazoMin}).`);
  if (_plazoMax > 0 && _plazo > _plazoMax) errors.push(`Plazo (${_plazo}) debe ser ≤ Plazo Máximo (${_plazoMax}).`);

  // §9 — Monto
  const _monto    = parseFloat(String(d.montoSolicitado).replace(/[^0-9.-]/g, '')) || 0;
  const _montoMin = parseFloat(String(d.montoMinimo).replace(/[^0-9.-]/g, '')) || 0;
  const _montoMax = parseFloat(String(d.montoMaximo).replace(/[^0-9.-]/g, '')) || 0;
  if (_monto <= 0) errors.push('Monto Solicitado debe ser mayor a 0.');
  if (_montoMin > 0 && _monto < _montoMin) errors.push(`Monto (${_monto}) debe ser ≥ Monto Mínimo (${_montoMin}).`);
  if (_montoMax > 0 && _monto > _montoMax) errors.push(`Monto (${_monto}) debe ser ≤ Monto Máximo (${_montoMax}).`);

  // §9 — Tasa
  const _tMin = parseFloat(String(d.tasaMinima).replace(/[^0-9.-]/g, '')) || 0;
  const _tMax = parseFloat(String(d.tasaMaxima).replace(/[^0-9.-]/g, '')) || 0;
  const _tCot = parseFloat(String(d.tasaCotizada).replace(/[^0-9.-]/g, '')) || 0;
  if (_tCot <= 0) errors.push('Tasa Cotizada debe ser mayor a 0%.');
  if (_tMin > 0 && _tCot < _tMin) errors.push(`Tasa (${_tCot}%) debe ser ≥ Tasa Mínima (${_tMin}%).`);
  if (_tMax > 0 && _tCot > _tMax) errors.push(`Tasa (${_tCot}%) debe ser ≤ Tasa Máxima (${_tMax}%).`);

  if (!d.fechaPrimerPago) errors.push('Debe indicar Fecha de Primer Pago.');

  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════
// MOCK DATA — Fallback cuando el producto real no tiene subviews
// ═══════════════════════════════════════════════════════════════
export const MOCK_MATRIZ_TASA_FIJA: MatrizTasaFijaRow[] = [
  { id: 1, periodo: 'Mensual',    plazoMinimo: 6,  plazoMaximo: 12, plazoDefault: 12, montoMinimo: 5000,   montoMaximo: 100000,  montoDefault: 50000,  moneda: 'MXN', tasaMinima: 12, tasaMaxima: 24, tasaDefault: 18 },
  { id: 2, periodo: 'Mensual',    plazoMinimo: 13, plazoMaximo: 24, plazoDefault: 24, montoMinimo: 10000,  montoMaximo: 250000,  montoDefault: 100000, moneda: 'MXN', tasaMinima: 10, tasaMaxima: 22, tasaDefault: 16 },
  { id: 3, periodo: 'Mensual',    plazoMinimo: 25, plazoMaximo: 48, plazoDefault: 36, montoMinimo: 50000,  montoMaximo: 500000,  montoDefault: 200000, moneda: 'MXN', tasaMinima: 9,  tasaMaxima: 20, tasaDefault: 14 },
  { id: 4, periodo: 'Quincenal',  plazoMinimo: 12, plazoMaximo: 24, plazoDefault: 24, montoMinimo: 5000,   montoMaximo: 150000,  montoDefault: 75000,  moneda: 'MXN', tasaMinima: 11, tasaMaxima: 23, tasaDefault: 17 },
  { id: 5, periodo: 'Semanal',    plazoMinimo: 24, plazoMaximo: 52, plazoDefault: 52, montoMinimo: 3000,   montoMaximo: 80000,   montoDefault: 30000,  moneda: 'MXN', tasaMinima: 13, tasaMaxima: 26, tasaDefault: 20 },
];

export const MOCK_GARANTIAS: GarantiaProducto[] = [
  { id: 1, tipoGarantia: 'Hipotecaria',  subtipoGarantia: 'Inmueble Urbano',   aforo: 1.5 },
  { id: 2, tipoGarantia: 'Hipotecaria',  subtipoGarantia: 'Inmueble Rural',    aforo: 2.0 },
  { id: 3, tipoGarantia: 'Prendaria',    subtipoGarantia: 'Vehículo',          aforo: 1.3 },
  { id: 4, tipoGarantia: 'Prendaria',    subtipoGarantia: 'Maquinaria',        aforo: 1.8 },
  { id: 5, tipoGarantia: 'Fiduciaria',   subtipoGarantia: 'Obligado Solidario', aforo: 1.0 },
  { id: 6, tipoGarantia: 'Líquida',      subtipoGarantia: 'Depósito en Garantía', aforo: 1.0 },
  { id: 7, tipoGarantia: 'Líquida',      subtipoGarantia: 'Pagaré',             aforo: 0.10 },
];

export const MOCK_SEGUROS: SeguroProducto[] = [
  {
    id: 1, nombre: 'Seguro de Vida Deudor', tipo: 'Seguro',
    montosYCoberturas: [
      { periodo: 'Mensual', plazoMinimo: 6, plazoMaximo: 24, plazoDefault: 24, montoMinimo: 5000, montoMaximo: 250000, montoDefault: 100000, tasaMinima: 0.002, tasaMaxima: 0.002, tasaDefault: 0.002 },
      { periodo: 'Mensual', plazoMinimo: 25, plazoMaximo: 48, plazoDefault: 36, montoMinimo: 50000, montoMaximo: 500000, montoDefault: 200000, tasaMinima: 0.0015, tasaMaxima: 0.0015, tasaDefault: 0.0015 },
    ],
  },
  {
    id: 2, nombre: 'Seguro de Daños', tipo: 'Seguro',
    montosYCoberturas: [
      { periodo: 'Mensual', plazoMinimo: 6, plazoMaximo: 48, plazoDefault: 36, montoMinimo: 10000, montoMaximo: 500000, montoDefault: 200000, tasaMinima: 0.001, tasaMaxima: 0.001, tasaDefault: 0.001 },
    ],
  },
];