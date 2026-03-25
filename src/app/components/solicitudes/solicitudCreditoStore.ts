// ============================================================
// Store centralizado para Solicitud de Crédito
// Persistencia via sessionStorage: sol_credito_{id}_{subtab}
// Spec: financial-account-request-spec.md
// ============================================================

// ---- Tipos principales ----
export interface SolicitudFormData {
  // Header — siempre visible
  id: string;                      // PK automático
  noSol: string;                   // BAN-DIGITAL-AAAAMMDD-999999
  cotizacionId: string;            // FK cotización (vacío si creación directa)
  lineaProducto: string;           // Crédito | Captación | Línea de Crédito
  tipoProducto: string;            // Crédito Simple, Revolvente, etc.
  tipoPersona: string;             // Física | Moral
  nombrePersona: string;
  apellidoPaternoPersona: string;
  apellidoMaternoPersona: string;
  productoId: string;
  nombreProducto: string;
  fechaSolicitud: string;          // DD/MM/AAAA HH:MM:SS
  descripcion: string;             // Textarea 1024 chars
  faseId: string;                  // Mínimo FASE_ID del producto
  descripcionFase: string;
  area: string;
  promptIAFase: string;            // Prompt IA de la fase actual
  estatusSolicitud: string;

  // Campos compatibilidad lista
  sucursal: string;
  montoSolicitado: string;
  montoAutorizado: string;
  // Fechas de vigencia del crédito (unificadas con Originación)
  fechaInicio?: string;
  fechaFin?: string;
}

// Términos y Condiciones
export interface TerminosCondiciones {
  montoSolicitado: string;
  fechaPrimerPago: string;
  fechaPrimeraAportacion: string;
  plazo: string;
  frecuencia: string;
  tasa: string;
  tipoTasa: string;
  tipoCalculo: string;
  moneda: string;
  montoGarantia: string;
  seguroFinanciado: boolean;
  montoSeguro: string;
}

// Simulación row
export interface SimulacionRow {
  noPago: number;
  fechaPago: string;
  saldoInsoluto: number;
  pagoCapital: number;
  pagoInteres: number;
  ivaInteres: number;
  pagoPeriodo: number;
  pagoSeguro: number;
  pagoTotal: number;
}

// Expediente Electrónico
export interface RequisitoProducto {
  id: number;
  fase: string;
  faseId: number;
  tipoDocumento: string;
  descripcion: string;
  area: string;
  obligatorio: boolean;
  promptIA: string;
}

export interface DocumentoCargado {
  id: number;
  fecha: string;
  usuario: string;
  tipoDocumento: string;
  archivo: string;
  tipoArchivo: string;
  nota: string;
  area: string;
  fase: string;
  faseId: number;
  estatus: 'Pendiente' | 'Validado' | 'Rechazado';
  validadoIA: boolean;
  fileData?: string;
  /** URL firmada de Supabase Storage o blob URL local */
  url?: string;
  /** Ruta interna en Storage para regenerar URLs firmadas */
  storagePath?: string;
  /** Nombre del bucket de Storage */
  storageBucket?: string;
  /** Tipo MIME del archivo */
  mime?: string;
  /** Tamaño en KB */
  tamanoKB?: number;
  /** Resultado de validación IA — motivos */
  iaMotivos?: string[];
  /** Datos extraídos por IA */
  iaExtraido?: Record<string, string>;
}

// Garantía registrada por el usuario en una solicitud
export interface Garantia {
  id: number;
  fecha: string;
  usuario: string;
  tipo: string;
  subtipo: string;
  descripcion: string;
  valorNominal: number;
  ubicacion: string;
  estatus: string;
  nota: string;
  fase: string;
  faseId: number;
  area: string;
  documentoAdjunto?: string;
}

// Garantía configurada en el producto (J_PRODUCTOS.data.garantias)
export interface GarantiaProducto {
  id: number;
  tipo: string;
  subtipo: string;
  descripcion: string;
  aforo: string;
}

// Comisión
export interface Comision {
  id: number;
  tipoComision: string;
  descripcion: string;
  base: string;        // 'Monto solicitado' | 'Monto autorizado' | 'Fijo'
  porcentaje: number;
  montoCalculado: number;
  estatus: string;
}

// Autorización
export interface Autorizacion {
  id: number;
  fechaHora: string;
  usuario: string;
  puesto?: string;
  area: string;
  descripcion: string;
  observaciones: string;
  estatus: string;
}

// Nota
export interface Nota {
  id: number;
  fecha: string;
  usuario: string;
  puesto: string;
  nota: string;
  archivoAdjunto: string;
  fileData?: string;
}

// Legacy types kept for backward compatibility
export interface CotizacionRow {
  id: number;
  numeroPago: number;
  fechaPago: string;
  saldoInicial: number;
  capital: number;
  interes: number;
  iva: number;
  pagoTotal: number;
  saldoFinal: number;
}

export interface Expediente {
  id: number;
  fechaHora: string;
  usuario: string;
  tipoDocumento: string;
  archivo: string;
  descripcion: string;
  estatus: string;
  observaciones: string;
  fileData?: string;
}

export interface CargoSolicitud {
  id: number;
  tipoCargo: string;
  descripcion: string;
  monto: number;
  fechaCargo: string;
  estatus: string;
  notas: string;
}

export interface Aviso {
  id: number;
  tipo: string;
  mensaje: string;
  fechaCreacion: string;
  fechaVencimiento: string;
  destinatario: string;
  estatus: string;
}

// ---- Persistencia ----
type SolId = number | string | 'new';

function storageKey(solId: SolId, subtab: string): string {
  return `sol_credito_${solId}_${subtab}`;
}

export function saveToSession<T>(solId: SolId, subtab: string, data: T): void {
  try { sessionStorage.setItem(storageKey(solId, subtab), JSON.stringify(data)); } catch { /* */ }
}

export function loadFromSession<T>(solId: SolId, subtab: string): T | null {
  try {
    const raw = sessionStorage.getItem(storageKey(solId, subtab));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSession(solId: SolId): void {
  const prefix = `sol_credito_${solId}_`;
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix)) keys.push(k);
  }
  keys.forEach(k => sessionStorage.removeItem(k));
}

// ---- Persistencia en memoria (sobrevive navegación lista↔formulario) ----
const SAVED_DATA: Record<string, Record<string, any>> = {};

export function saveToSavedStore<T>(solId: SolId, subtab: string, data: T): void {
  const key = String(solId);
  if (!SAVED_DATA[key]) SAVED_DATA[key] = {};
  SAVED_DATA[key][subtab] = structuredClone(data);
}

export function loadFromSavedStore<T>(solId: SolId, subtab: string): T | null {
  const key = String(solId);
  const data = SAVED_DATA[key]?.[subtab];
  return data ? structuredClone(data) as T : null;
}

/** Migra TODOS los datos de un ID a otro en el saved store */
export function migrateSavedStore(fromId: SolId, toId: SolId): void {
  const fromKey = String(fromId);
  const toKey = String(toId);
  if (SAVED_DATA[fromKey]) {
    SAVED_DATA[toKey] = structuredClone(SAVED_DATA[fromKey]);
    delete SAVED_DATA[fromKey];
  }
  const prefix = `sol_credito_${fromId}_`;
  const newPrefix = `sol_credito_${toId}_`;
  const keysToMigrate: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix)) keysToMigrate.push(k);
  }
  keysToMigrate.forEach(k => {
    const subtab = k.replace(prefix, '');
    const val = sessionStorage.getItem(k);
    if (val) sessionStorage.setItem(`${newPrefix}${subtab}`, val);
    sessionStorage.removeItem(k);
  });
}

/** Copia todos los datos de sessionStorage al saved store y luego limpia session */
export function commitAndClearSession(solId: SolId): void {
  const prefix = `sol_credito_${solId}_`;
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix)) keys.push(k);
  }
  keys.forEach(k => {
    const subtab = k.replace(prefix, '');
    try {
      const data = JSON.parse(sessionStorage.getItem(k)!);
      saveToSavedStore(solId, subtab, data);
    } catch { /* skip */ }
  });
  keys.forEach(k => sessionStorage.removeItem(k));
}

// ---- Helpers ----
export function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num)) return '$ 0.00';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(num);
}

export function parseCurrency(f: string): string {
  return f.replace(/[^0-9.-]/g, '');
}

// ---- N° Solicitud: BAN-DIGITAL-AAAAMMDD-999999 ----
let _dailyConsecutivo = 1;

function padZero(n: number, len: number): string {
  return String(n).padStart(len, '0');
}

export function generateNoSol(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = padZero(now.getMonth() + 1, 2);
  const dd = padZero(now.getDate(), 2);
  const consecutivo = padZero(_dailyConsecutivo, 6);
  return `BAN-DIGITAL-${yyyy}${mm}${dd}-${consecutivo}`;
}

export function consumeNoSol(): string {
  const noSol = generateNoSol();
  _dailyConsecutivo++;
  return noSol;
}

export function getFechaSolicitudNow(): string {
  const now = new Date();
  const dd = padZero(now.getDate(), 2);
  const mm = padZero(now.getMonth() + 1, 2);
  const yyyy = now.getFullYear();
  const hh = padZero(now.getHours(), 2);
  const mi = padZero(now.getMinutes(), 2);
  const ss = padZero(now.getSeconds(), 2);
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

// Legacy — keep for backward compat
let _nextSolicitud = 9;
export function getNextSolicitudId(): string {
  return `SC-${String(_nextSolicitud).padStart(3, '0')}`;
}
export function consumeSolicitudId(): string {
  const id = `SC-${String(_nextSolicitud).padStart(3, '0')}`;
  _nextSolicitud++;
  return id;
}

// ---- Catálogos ----
export const CAT_LINEA_PRODUCTO = [
  { value: 'Crédito', label: 'Crédito' },
  { value: 'Captación', label: 'Captación' },
  { value: 'Línea de Crédito', label: 'Línea de Crédito' },
];

export const CAT_TIPO_PRODUCTO = [
  { value: 'Crédito Simple', label: 'Crédito Simple' },
  { value: 'Crédito Revolvente', label: 'Crédito Revolvente' },
  { value: 'Crédito Hipotecario', label: 'Crédito Hipotecario' },
  { value: 'Crédito Automotriz', label: 'Crédito Automotriz' },
  { value: 'Crédito Personal', label: 'Crédito Personal' },
  { value: 'Crédito Empresarial', label: 'Crédito Empresarial' },
];

export const CAT_TIPO_PERSONA = [
  { value: 'Física', label: 'Física' },
  { value: 'Moral', label: 'Moral' },
];

export const CAT_PRODUCTOS = [
  { value: 'PROD-001', label: 'PROD-001 — Crédito Personal Clásico', nombre: 'Crédito Personal Clásico' },
  { value: 'PROD-002', label: 'PROD-002 — Crédito Empresarial PyME', nombre: 'Crédito Empresarial PyME' },
  { value: 'PROD-003', label: 'PROD-003 — Crédito Hipotecario Residencial', nombre: 'Crédito Hipotecario Residencial' },
  { value: 'PROD-004', label: 'PROD-004 — Crédito Automotriz Básico', nombre: 'Crédito Automotriz Básico' },
  { value: 'PROD-005', label: 'PROD-005 — Línea de Crédito Revolvente', nombre: 'Línea de Crédito Revolvente' },
];

export const CAT_FASES = [
  { faseId: '1', descripcion: 'Fase 1 — Recepción de Documentos' },
  { faseId: '2', descripcion: 'Fase 2 — Análisis de Crédito' },
  { faseId: '3', descripcion: 'Fase 3 — Comité de Crédito' },
  { faseId: '4', descripcion: 'Fase 4 — Formalización' },
  { faseId: '5', descripcion: 'Fase 5 — Desembolso' },
];

export const CAT_SUCURSAL = [
  { value: 'CDMX', label: 'CDMX' },
  { value: 'Monterrey', label: 'Monterrey' },
  { value: 'Guadalajara', label: 'Guadalajara' },
  { value: 'Querétaro', label: 'Querétaro' },
  { value: 'Toluca', label: 'Toluca' },
];

export const CAT_ESTATUS_SOLICITUD = [
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'En proceso', label: 'En proceso' },
  { value: 'En Análisis', label: 'En Análisis' },
  { value: 'Aprobado', label: 'Aprobado' },
  { value: 'Rechazado', label: 'Rechazado' },
  { value: 'Cancelado', label: 'Cancelado' },
];

export const CAT_FRECUENCIA = [
  { value: 'Semanal', label: 'Semanal', dias: 7 },
  { value: 'Catorcenal', label: 'Catorcenal', dias: 14 },
  { value: 'Quincenal', label: 'Quincenal', dias: 15 },
  { value: 'Mensual', label: 'Mensual', dias: 30 },
  { value: 'Trimestral', label: 'Trimestral', dias: 90 },
  { value: 'Semestral', label: 'Semestral', dias: 180 },
  { value: 'Anual', label: 'Anual', dias: 360 },
];

export const CAT_TIPO_TASA = ['Fija', 'Variable'];

export const CAT_TIPO_CALCULO = ['Francés', 'Alemán', 'Americano', 'Simple'];

export const CAT_MONEDA = [
  { value: 'MXN', label: 'MXN - Peso Mexicano' },
  { value: 'USD', label: 'USD - Dólar Americano' },
];

export const CAT_TIPO_GARANTIA = [
  { value: 'Hipotecaria', label: 'Hipotecaria' },
  { value: 'Prendaria', label: 'Prendaria' },
  { value: 'Fiduciaria', label: 'Fiduciaria' },
  { value: 'Líquida', label: 'Líquida' },
];

export const CAT_TIPO_DOCUMENTO = [
  'Credencial de elector (INE)',
  'Pasaporte',
  'Comprobante de domicilio',
  'Estado de cuenta bancario',
  'Constancia de situación fiscal',
  'Acta constitutiva',
  'Poder notarial',
  'Avalúo',
  'CURP',
  'Otro',
];

export const CAT_ESTATUS_AUTORIZACION = ['Pendiente', 'Autorizado', 'Rechazado', 'Condicionado'];

// Legacy catalogs kept for compatibility
export const CAT_CLIENTES = [
  { value: 'CL-001 - Juan Pérez Gómez', label: 'CL-001 - Juan Pérez Gómez' },
  { value: 'CL-002 - María García López', label: 'CL-002 - María García López' },
  { value: 'CL-003 - Carlos Martínez Sánchez', label: 'CL-003 - Carlos Martínez Sánchez' },
  { value: 'CL-004 - HELVEX, S.A. DE C.V', label: 'CL-004 - HELVEX, S.A. DE C.V' },
  { value: 'CL-005 - Sofía Reyes López', label: 'CL-005 - Sofía Reyes López' },
];

export const CAT_EMPRESA_FONDEADORA = [
  { value: 'Fondeadora Principal', label: 'Fondeadora Principal' },
  { value: 'Fondeadora Secundaria', label: 'Fondeadora Secundaria' },
  { value: 'FIRA', label: 'FIRA' },
];

export const CAT_SUBLINEA = [
  { value: 'Crédito Personal', label: 'Crédito Personal' },
  { value: 'Crédito Automotriz', label: 'Crédito Automotriz' },
  { value: 'Crédito Hipotecario', label: 'Crédito Hipotecario' },
  { value: 'Crédito Empresarial', label: 'Crédito Empresarial' },
];

export const CAT_PRODUCTO = [
  { value: 'Crédito Simple', label: 'Crédito Simple' },
  { value: 'Crédito Revolvente', label: 'Crédito Revolvente' },
  { value: 'Línea de Crédito', label: 'Línea de Crédito' },
];

export const CAT_PERIODO = [
  { value: 'Mensual', label: 'Mensual' },
  { value: 'Quincenal', label: 'Quincenal' },
  { value: 'Semanal', label: 'Semanal' },
];

export const CAT_PLAZOS = [
  { value: '12', label: '12 meses' },
  { value: '24', label: '24 meses' },
  { value: '36', label: '36 meses' },
  { value: '48', label: '48 meses' },
  { value: '60', label: '60 meses' },
];

export const CAT_DESTINO_CREDITO = [
  { value: 'Capital de trabajo', label: 'Capital de trabajo' },
  { value: 'Adquisición de activos', label: 'Adquisición de activos' },
  { value: 'Consolidación de deudas', label: 'Consolidación de deudas' },
  { value: 'Consumo personal', label: 'Consumo personal' },
  { value: 'Otro', label: 'Otro' },
];

export const CAT_ESTATUS_SC = [
  { value: 'Activo', label: 'Activo' },
  { value: 'Inactivo', label: 'Inactivo' },
  { value: 'Suspendido', label: 'Suspendido' },
  { value: 'Bloqueado', label: 'Bloqueado' },
  { value: 'En Revisión', label: 'En Revisión' },
];

export const CAT_ESTATUS_LISTA_NEGRA = [
  { value: 'POSITIVO', label: 'POSITIVO — Sin coincidencias' },
  { value: 'NEGATIVO', label: 'NEGATIVO — Con coincidencias' },
  { value: 'EN REVISIÓN', label: 'EN REVISIÓN' },
];

export const CAT_ESTATUS_CLIENTE = [
  { value: 'Vigente', label: 'Vigente' },
  { value: 'Inactivo', label: 'Inactivo' },
  { value: 'Suspendido', label: 'Suspendido' },
  { value: 'Bloqueado', label: 'Bloqueado' },
  { value: 'Baja', label: 'Baja' },
];

export const CAT_ESTATUS_EXPEDIENTE = ['Pendiente', 'Aprobado', 'Rechazado'];

export const CAT_TIPO_CARGO = [
  { value: 'Comisión por apertura', label: 'Comisión por apertura' },
  { value: 'Seguro de vida', label: 'Seguro de vida' },
  { value: 'Gastos notariales', label: 'Gastos notariales' },
  { value: 'Avalúo', label: 'Avalúo' },
  { value: 'Otro', label: 'Otro' },
];

export const CAT_ESTATUS_CARGO = ['Pendiente', 'Aplicado', 'Cancelado'];

export const CAT_TIPO_AVISO = [
  { value: 'Recordatorio', label: 'Recordatorio' },
  { value: 'Alerta', label: 'Alerta' },
  { value: 'Notificación', label: 'Notificación' },
  { value: 'Vencimiento', label: 'Vencimiento' },
];

export const CAT_ESTATUS_AVISO = ['Activo', 'Leído', 'Vencido', 'Cancelado'];

// ---- Formulario vacío ----
export const EMPTY_FORM: SolicitudFormData = {
  id: '',
  noSol: '',
  cotizacionId: '',
  lineaProducto: 'Crédito',
  tipoProducto: '',
  tipoPersona: '',
  nombrePersona: '',
  apellidoPaternoPersona: '',
  apellidoMaternoPersona: '',
  productoId: '',
  nombreProducto: '',
  fechaSolicitud: '',
  descripcion: '',
  faseId: '1',
  descripcionFase: 'Fase 1 — Recepción de Documentos',
  area: 'INTEGRACIÓN',
  promptIAFase: '',
  estatusSolicitud: 'Pendiente',
  sucursal: '',
  montoSolicitado: '',
  montoAutorizado: '',
  fechaInicio: '',
  fechaFin: '',
};

export const EMPTY_TERMINOS: TerminosCondiciones = {
  montoSolicitado: '',
  fechaPrimerPago: '',
  fechaPrimeraAportacion: '',
  plazo: '',
  frecuencia: 'Mensual',
  tasa: '',
  tipoTasa: 'Fija',
  tipoCalculo: 'Francés',
  moneda: 'MXN',
  montoGarantia: '',
  seguroFinanciado: false,
  montoSeguro: '',
};

// ---- Mock de requisitos del producto ----
export const MOCK_REQUISITOS_PRODUCTO: RequisitoProducto[] = [
  { id: 1, fase: 'Fase 1', faseId: 1, tipoDocumento: 'Credencial de elector (INE)', descripcion: 'Identificación oficial vigente', area: 'Mesa de Control', obligatorio: true, promptIA: 'Verificar que sea una credencial INE/IFE vigente con fotografía visible' },
  { id: 2, fase: 'Fase 1', faseId: 1, tipoDocumento: 'Comprobante de domicilio', descripcion: 'No mayor a 3 meses', area: 'Mesa de Control', obligatorio: true, promptIA: 'Verificar que sea un recibo de servicios con dirección visible y fecha reciente' },
  { id: 3, fase: 'Fase 1', faseId: 1, tipoDocumento: 'Constancia de situación fiscal', descripcion: 'RFC con situación fiscal activa', area: 'Mesa de Control', obligatorio: true, promptIA: 'Verificar que contenga RFC y situación fiscal del SAT' },
  { id: 4, fase: 'Fase 2', faseId: 2, tipoDocumento: 'Estado de cuenta bancario', descripcion: 'Últimos 3 meses de estado de cuenta', area: 'Análisis', obligatorio: true, promptIA: 'Verificar que sea un estado de cuenta bancario con movimientos recientes' },
  { id: 5, fase: 'Fase 2', faseId: 2, tipoDocumento: 'Avalúo', descripcion: 'Avalúo del bien en garantía', area: 'Análisis', obligatorio: false, promptIA: 'Verificar que sea un avalúo profesional con datos del inmueble' },
  { id: 6, fase: 'Fase 3', faseId: 3, tipoDocumento: 'Acta constitutiva', descripcion: 'Solo para personas morales', area: 'Jurídico', obligatorio: false, promptIA: 'Verificar que sea acta constitutiva notariada de la empresa' },
];

// ---- Mock comisiones del producto ----
export const MOCK_COMISIONES_PRODUCTO: { tipoComision: string; descripcion: string; base: string; porcentaje: number }[] = [
  { tipoComision: 'Comisión por apertura', descripcion: 'Comisión por apertura de crédito', base: 'Monto solicitado', porcentaje: 2.0 },
  { tipoComision: 'Comisión por disposición', descripcion: 'Comisión por disposición de fondos', base: 'Monto solicitado', porcentaje: 0.5 },
  { tipoComision: 'Seguro de vida', descripcion: 'Prima de seguro de vida deudor', base: 'Monto solicitado', porcentaje: 0.35 },
  { tipoComision: 'Gastos de investigación', descripcion: 'Consulta buró de crédito y verificación', base: 'Fijo', porcentaje: 0 },
];

// ---- Mock autorizadores del producto ----
export const MOCK_AUTORIZADORES: { usuario: string; puesto: string; area: string; montoMinimo: number; montoMaximo: number }[] = [
  { usuario: 'Lic. Roberto Hernández', puesto: 'Gerente de Crédito', area: 'Crédito', montoMinimo: 0, montoMaximo: 100000 },
  { usuario: 'Ing. Patricia Solís', puesto: 'Director de Riesgos', area: 'Riesgos', montoMinimo: 100001, montoMaximo: 500000 },
  { usuario: 'C.P. Arturo Gómez', puesto: 'Director General', area: 'Dirección', montoMinimo: 500001, montoMaximo: 99999999 },
  { usuario: 'Comité de Crédito', puesto: 'Comité', area: 'Comité', montoMinimo: 0, montoMaximo: 99999999 },
];

// ---- Mock data para 2 solicitudes existentes ----
export const MOCK_FORMS: Record<number, SolicitudFormData> = {
  1: {
    id: '1',
    noSol: 'BAN-DIGITAL-20230824-000001',
    cotizacionId: '',
    lineaProducto: 'Crédito',
    tipoProducto: 'Crédito Simple',
    tipoPersona: 'Física',
    nombrePersona: 'Juan',
    apellidoPaternoPersona: 'Pérez',
    apellidoMaternoPersona: 'Gómez',
    productoId: 'PROD-001',
    nombreProducto: 'Crédito Personal Clásico',
    fechaSolicitud: '24/08/2023 10:30:00',
    descripcion: 'Solicitud de crédito personal para capital de trabajo.',
    faseId: '2',
    descripcionFase: 'Fase 2 — Análisis de Crédito',
    estatusSolicitud: 'Aprobado',
    sucursal: 'CDMX',
    montoSolicitado: '2400.00',
    montoAutorizado: '2400.00',
  },
  2: {
    id: '2',
    noSol: 'BAN-DIGITAL-20230810-000001',
    cotizacionId: '',
    lineaProducto: 'Crédito',
    tipoProducto: 'Crédito Empresarial',
    tipoPersona: 'Moral',
    nombrePersona: 'ROTOPLAS',
    apellidoPaternoPersona: 'S.A.',
    apellidoMaternoPersona: 'DE C.V.',
    productoId: 'PROD-002',
    nombreProducto: 'Crédito Empresarial PyME',
    fechaSolicitud: '10/08/2023 09:15:00',
    descripcion: 'Solicitud de crédito empresarial para adquisición de activos fijos.',
    faseId: '3',
    descripcionFase: 'Fase 3 — Comité de Crédito',
    estatusSolicitud: 'Aprobado',
    sucursal: 'Monterrey',
    montoSolicitado: '10800.00',
    montoAutorizado: '10800.00',
  },
};

export const MOCK_TERMINOS: Record<number, TerminosCondiciones> = {
  1: {
    montoSolicitado: '2400.00', fechaPrimerPago: '24/09/2023', fechaPrimeraAportacion: '',
    plazo: '12', frecuencia: 'Mensual', tasa: '12.5000', tipoTasa: 'Fija',
    tipoCalculo: 'Francés', moneda: 'MXN', montoGarantia: '', seguroFinanciado: false, montoSeguro: '',
  },
  2: {
    montoSolicitado: '10800.00', fechaPrimerPago: '10/09/2023', fechaPrimeraAportacion: '',
    plazo: '24', frecuencia: 'Mensual', tasa: '15.0000', tipoTasa: 'Fija',
    tipoCalculo: 'Francés', moneda: 'MXN', montoGarantia: '12960.00', seguroFinanciado: true, montoSeguro: '250.00',
  },
};

export const MOCK_SIMULACION: Record<number, SimulacionRow[]> = {
  1: [
    { noPago: 1, fechaPago: '24/09/2023', saldoInsoluto: 2400, pagoCapital: 185.58, pagoInteres: 25.00, ivaInteres: 4.00, pagoPeriodo: 214.58, pagoSeguro: 0, pagoTotal: 214.58 },
    { noPago: 2, fechaPago: '24/10/2023', saldoInsoluto: 2214.42, pagoCapital: 187.51, pagoInteres: 23.07, ivaInteres: 3.69, pagoPeriodo: 214.27, pagoSeguro: 0, pagoTotal: 214.27 },
    { noPago: 3, fechaPago: '24/11/2023', saldoInsoluto: 2026.91, pagoCapital: 189.46, pagoInteres: 21.11, ivaInteres: 3.38, pagoPeriodo: 213.95, pagoSeguro: 0, pagoTotal: 213.95 },
  ],
  2: [
    { noPago: 1, fechaPago: '10/09/2023', saldoInsoluto: 10800, pagoCapital: 395.12, pagoInteres: 135.00, ivaInteres: 21.60, pagoPeriodo: 551.72, pagoSeguro: 10.42, pagoTotal: 562.14 },
    { noPago: 2, fechaPago: '10/10/2023', saldoInsoluto: 10404.88, pagoCapital: 400.06, pagoInteres: 130.06, ivaInteres: 20.81, pagoPeriodo: 550.93, pagoSeguro: 10.42, pagoTotal: 561.35 },
  ],
};

export const MOCK_DOCUMENTOS: Record<number, DocumentoCargado[]> = {
  1: [
    { id: 1, fecha: '24/08/2023 10:30', usuario: 'Admin', tipoDocumento: 'Credencial de elector (INE)', archivo: 'INE_JuanPerez.pdf', tipoArchivo: 'PDF', nota: 'INE vigente', area: 'Mesa de Control', fase: 'Fase 1', faseId: 1, estatus: 'Validado', validadoIA: true },
    { id: 2, fecha: '24/08/2023 11:15', usuario: 'Admin', tipoDocumento: 'Comprobante de domicilio', archivo: 'CFE_Agosto2023.pdf', tipoArchivo: 'PDF', nota: 'CFE mes actual', area: 'Mesa de Control', fase: 'Fase 1', faseId: 1, estatus: 'Validado', validadoIA: true },
  ],
  2: [
    { id: 1, fecha: '10/08/2023 09:00', usuario: 'Admin', tipoDocumento: 'Acta constitutiva', archivo: 'ActaConstitutiva.pdf', tipoArchivo: 'PDF', nota: 'Acta constitutiva empresa', area: 'Jurídico', fase: 'Fase 3', faseId: 3, estatus: 'Validado', validadoIA: true },
  ],
};

export const MOCK_GARANTIAS: Record<number, Garantia[]> = {
  1: [],
  2: [
    { id: 1, fecha: '10/08/2023 11:00', usuario: 'Admin', tipo: 'Hipotecaria', subtipo: 'Inmobiliaria', descripcion: 'Terreno industrial en Apodaca, NL', valorNominal: 250000, ubicacion: 'Apodaca, NL', estatus: 'Vigente', nota: 'Escrituras notariadas', fase: 'Fase 3', faseId: 3, area: 'Jurídico' },
  ],
};

export const MOCK_COMISIONES: Record<number, Comision[]> = {
  1: [
    { id: 1, tipoComision: 'Comisión por apertura', descripcion: 'Comisión 2% apertura', base: 'Monto solicitado', porcentaje: 2.0, montoCalculado: 48, estatus: 'Aplicado' },
  ],
  2: [
    { id: 1, tipoComision: 'Comisión por apertura', descripcion: 'Comisión 2% apertura', base: 'Monto solicitado', porcentaje: 2.0, montoCalculado: 216, estatus: 'Aplicado' },
    { id: 2, tipoComision: 'Seguro de vida', descripcion: 'Prima seguro deudor', base: 'Monto solicitado', porcentaje: 0.35, montoCalculado: 37.80, estatus: 'Aplicado' },
  ],
};

export const MOCK_AUTORIZACIONES: Record<number, Autorizacion[]> = {
  1: [
    { id: 1, fechaHora: '25/08/2023 14:00', usuario: 'Lic. Roberto Hernández', puesto: 'Gerente de Crédito', area: 'Crédito', descripcion: 'Autorización de crédito personal', observaciones: 'Aprobado sin condiciones', estatus: 'Autorizado' },
  ],
  2: [
    { id: 1, fechaHora: '11/08/2023 09:30', usuario: 'Comité de Crédito', puesto: 'Comité', area: 'Comité', descripcion: 'Línea de crédito empresarial', observaciones: 'Autorizado con garantía hipotecaria', estatus: 'Autorizado' },
  ],
};

export const MOCK_NOTAS: Record<number, Nota[]> = {
  1: [
    { id: 1, fecha: '24/08/2023 12:00', usuario: 'Admin', puesto: 'Ejecutivo de Crédito', nota: 'Cliente presenta documentación completa en primera visita.', archivoAdjunto: '' },
  ],
  2: [
    { id: 1, fecha: '10/08/2023 10:00', usuario: 'Admin', puesto: 'Ejecutivo de Crédito', nota: 'Empresa con buen historial crediticio. Se requiere avalúo de inmueble.', archivoAdjunto: '' },
    { id: 2, fecha: '12/08/2023 16:30', usuario: 'Admin', puesto: 'Analista de Riesgos', nota: 'Avalúo recibido. Valor de mercado superior al monto solicitado.', archivoAdjunto: 'avaluo_resumen.pdf' },
  ],
};

// Legacy mock data for compatibility with existing subtabs
export const MOCK_COTIZACIONES: Record<number, CotizacionRow[]> = {
  1: [
    { id: 1, numeroPago: 1, fechaPago: '24/09/2023', saldoInicial: 2400, capital: 185.58, interes: 25.00, iva: 4.00, pagoTotal: 214.58, saldoFinal: 2214.42 },
    { id: 2, numeroPago: 2, fechaPago: '24/10/2023', saldoInicial: 2214.42, capital: 187.51, interes: 23.07, iva: 3.69, pagoTotal: 214.27, saldoFinal: 2026.91 },
    { id: 3, numeroPago: 3, fechaPago: '24/11/2023', saldoInicial: 2026.91, capital: 189.46, interes: 21.11, iva: 3.38, pagoTotal: 213.95, saldoFinal: 1837.45 },
  ],
  2: [
    { id: 1, numeroPago: 1, fechaPago: '10/09/2023', saldoInicial: 10800, capital: 395.12, interes: 135.00, iva: 21.60, pagoTotal: 551.72, saldoFinal: 10404.88 },
    { id: 2, numeroPago: 2, fechaPago: '10/10/2023', saldoInicial: 10404.88, capital: 400.06, interes: 130.06, iva: 20.81, pagoTotal: 550.93, saldoFinal: 10004.82 },
  ],
};

export const MOCK_EXPEDIENTES: Record<number, Expediente[]> = {
  1: [
    { id: 1, fechaHora: '24/08/2023 10:30', usuario: 'Juan Pérez', tipoDocumento: 'Credencial de elector', archivo: 'INE_JuanPerez.pdf', descripcion: 'INE vigente', estatus: 'Aprobado', observaciones: 'Documento válido' },
    { id: 2, fechaHora: '24/08/2023 11:15', usuario: 'Juan Pérez', tipoDocumento: 'Comprobante de domicilio', archivo: 'CFE_Agosto2023.pdf', descripcion: 'CFE mes actual', estatus: 'Aprobado', observaciones: '' },
  ],
  2: [
    { id: 1, fechaHora: '10/08/2023 09:00', usuario: 'María García', tipoDocumento: 'Acta constitutiva', archivo: 'ActaConstitutiva.pdf', descripcion: 'Acta constitutiva empresa', estatus: 'Aprobado', observaciones: '' },
  ],
};

export const MOCK_CARGOS: Record<number, CargoSolicitud[]> = {
  1: [
    { id: 1, tipoCargo: 'Comisión por apertura', descripcion: 'Comisión 2% apertura', monto: 48, fechaCargo: '24/08/2023', estatus: 'Aplicado', notas: '' },
  ],
  2: [
    { id: 1, tipoCargo: 'Comisión por apertura', descripcion: 'Comisión 1.5% apertura', monto: 162, fechaCargo: '10/08/2023', estatus: 'Aplicado', notas: '' },
    { id: 2, tipoCargo: 'Avalúo', descripcion: 'Avalúo de garantía hipotecaria', monto: 3500, fechaCargo: '12/08/2023', estatus: 'Pendiente', notas: 'En proceso de avalúo' },
  ],
};

export const MOCK_AVISOS: Record<number, Aviso[]> = {
  1: [
    { id: 1, tipo: 'Notificación', mensaje: 'Crédito aprobado y dispersado exitosamente', fechaCreacion: '25/08/2023', fechaVencimiento: '', destinatario: 'Cliente', estatus: 'Leído' },
  ],
  2: [
    { id: 1, tipo: 'Recordatorio', mensaje: 'Garantía pendiente de formalización notarial', fechaCreacion: '12/08/2023', fechaVencimiento: '30/09/2023', destinatario: 'Ejecutivo', estatus: 'Activo' },
  ],
};

// ---- Lista maestra ----
export interface SolicitudListItem {
  id: number | string;
  noSol: string;
  nombreCompleto: string;
  tipoProducto: string;
  nombreProducto: string;
  fechaSolicitud: string;
  montoSolicitado: number;
  montoAutorizado: number;
  sucursal: string;
  faseDescripcion: string;
  estatusSolicitud: string;
  _dbId?: string;
  _clienteId?: string;
}

export const SOLICITUDES_LISTA: SolicitudListItem[] = [
  { id: 1, noSol: 'BAN-DIGITAL-20230824-000001', nombreCompleto: 'Juan Pérez Gómez', tipoProducto: 'Crédito Simple', nombreProducto: 'Crédito Personal Clásico', fechaSolicitud: '24/08/2023', montoSolicitado: 2400, montoAutorizado: 2400, sucursal: 'CDMX', faseDescripcion: 'Fase 2 — Análisis', estatusSolicitud: 'Aprobado' },
  { id: 2, noSol: 'BAN-DIGITAL-20230810-000001', nombreCompleto: 'ROTOPLAS, S.A. DE C.V.', tipoProducto: 'Crédito Empresarial', nombreProducto: 'Crédito Empresarial PyME', fechaSolicitud: '10/08/2023', montoSolicitado: 10800, montoAutorizado: 10800, sucursal: 'Monterrey', faseDescripcion: 'Fase 3 — Comité', estatusSolicitud: 'Aprobado' },
  { id: 3, noSol: 'BAN-DIGITAL-20230812-000001', nombreCompleto: 'Dulce Fernández Solís', tipoProducto: 'Crédito Simple', nombreProducto: 'Crédito Personal Clásico', fechaSolicitud: '12/08/2023', montoSolicitado: 5700, montoAutorizado: 5700, sucursal: 'Guadalajara', faseDescripcion: 'Fase 4 — Formalización', estatusSolicitud: 'Aprobado' },
  { id: 4, noSol: 'BAN-DIGITAL-20230814-000001', nombreCompleto: 'HELVEX, S.A. DE C.V.', tipoProducto: 'Crédito Empresarial', nombreProducto: 'Crédito Empresarial PyME', fechaSolicitud: '14/08/2023', montoSolicitado: 11900, montoAutorizado: 11900, sucursal: 'Querétaro', faseDescripcion: 'Fase 2 — Análisis', estatusSolicitud: 'En Análisis' },
  { id: 5, noSol: 'BAN-DIGITAL-20230817-000001', nombreCompleto: 'Sofía Reyes López', tipoProducto: 'Crédito Personal', nombreProducto: 'Crédito Personal Clásico', fechaSolicitud: '17/08/2023', montoSolicitado: 2200, montoAutorizado: 2200, sucursal: 'CDMX', faseDescripcion: 'Fase 5 — Desembolso', estatusSolicitud: 'Aprobado' },
  { id: 6, noSol: 'BAN-DIGITAL-20230821-000001', nombreCompleto: 'Carlos Pérez León', tipoProducto: 'Crédito Hipotecario', nombreProducto: 'Crédito Hipotecario Residencial', fechaSolicitud: '21/08/2023', montoSolicitado: 10000, montoAutorizado: 0, sucursal: 'Toluca', faseDescripcion: 'Fase 1 — Recepción', estatusSolicitud: 'Pendiente' },
  { id: 7, noSol: 'BAN-DIGITAL-20230817-000002', nombreCompleto: 'Juan Mendoza Anaya', tipoProducto: 'Crédito Simple', nombreProducto: 'Crédito Personal Clásico', fechaSolicitud: '17/08/2023', montoSolicitado: 100, montoAutorizado: 100, sucursal: 'Monterrey', faseDescripcion: 'Fase 5 — Desembolso', estatusSolicitud: 'Aprobado' },
  { id: 8, noSol: 'BAN-DIGITAL-20230821-000002', nombreCompleto: 'INELEM DE MEXICO S.A. DE C.V.', tipoProducto: 'Crédito Empresarial', nombreProducto: 'Crédito Empresarial PyME', fechaSolicitud: '21/08/2023', montoSolicitado: 15600, montoAutorizado: 15600, sucursal: 'CDMX', faseDescripcion: 'Fase 4 — Formalización', estatusSolicitud: 'Aprobado' },
];

// ---- Amortization generator ----
const IVA_RATE = 0.16;

export function generarSimulacion(
  monto: number,
  tasaAnual: number,
  plazo: number,
  frecuencia: string,
  fechaPrimerPago: string,
  tipoCalculo: string = 'Francés',
  seguroPorPeriodo: number = 0
): SimulacionRow[] {
  if (monto <= 0 || tasaAnual <= 0 || plazo <= 0) return [];
  const diasPeriodo = CAT_FRECUENCIA.find(f => f.value === frecuencia)?.dias || 30;
  const r = (tasaAnual / 100 / 360) * diasPeriodo;
  const rows: SimulacionRow[] = [];
  let saldo = monto;

  // Parse first payment date
  let currentDate: Date;
  if (fechaPrimerPago) {
    const [dd, mm, yyyy] = fechaPrimerPago.split('/');
    currentDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
  } else {
    currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + diasPeriodo);
  }

  const fmtDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const tipo = tipoCalculo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (tipo === 'frances' || tipo === 'french') {
    // Sistema Francés: cuota fija (capital + interés + IVA)
    const factor = Math.pow(1 + r, plazo);
    const pmt = monto * (r * factor) / (factor - 1);
    for (let i = 1; i <= plazo; i++) {
      const interes = saldo * r;
      const iva = interes * IVA_RATE;
      const capital = pmt - interes - iva;
      rows.push({
        noPago: i,
        fechaPago: fmtDate(currentDate),
        saldoInsoluto: Math.max(0, saldo),
        pagoCapital: Math.max(0, capital),
        pagoInteres: interes,
        ivaInteres: iva,
        pagoPeriodo: pmt,
        pagoSeguro: seguroPorPeriodo,
        pagoTotal: pmt + seguroPorPeriodo,
      });
      saldo -= capital;
      currentDate.setDate(currentDate.getDate() + diasPeriodo);
    }
  } else if (tipo === 'aleman' || tipo === 'german') {
    // Sistema Alemán: capital fijo, interés decreciente
    const capitalFijo = monto / plazo;
    for (let i = 1; i <= plazo; i++) {
      const interes = saldo * r;
      const iva = interes * IVA_RATE;
      const pagoPeriodo = capitalFijo + interes + iva;
      rows.push({
        noPago: i,
        fechaPago: fmtDate(currentDate),
        saldoInsoluto: Math.max(0, saldo),
        pagoCapital: capitalFijo,
        pagoInteres: interes,
        ivaInteres: iva,
        pagoPeriodo,
        pagoSeguro: seguroPorPeriodo,
        pagoTotal: pagoPeriodo + seguroPorPeriodo,
      });
      saldo -= capitalFijo;
      currentDate.setDate(currentDate.getDate() + diasPeriodo);
    }
  } else if (tipo === 'americano' || tipo === 'american') {
    // Sistema Americano: solo interés, capital al final
    for (let i = 1; i <= plazo; i++) {
      const interes = saldo * r;
      const iva = interes * IVA_RATE;
      const capital = i === plazo ? monto : 0;
      const pagoPeriodo = capital + interes + iva;
      rows.push({
        noPago: i,
        fechaPago: fmtDate(currentDate),
        saldoInsoluto: Math.max(0, saldo),
        pagoCapital: capital,
        pagoInteres: interes,
        ivaInteres: iva,
        pagoPeriodo,
        pagoSeguro: seguroPorPeriodo,
        pagoTotal: pagoPeriodo + seguroPorPeriodo,
      });
      if (i === plazo) saldo = 0;
      currentDate.setDate(currentDate.getDate() + diasPeriodo);
    }
  } else {
    // Simple / cualquier otro: capital fijo + interés simple sobre monto original
    const capitalFijo = monto / plazo;
    const interesFijo = monto * r;
    for (let i = 1; i <= plazo; i++) {
      const iva = interesFijo * IVA_RATE;
      const pagoPeriodo = capitalFijo + interesFijo + iva;
      rows.push({
        noPago: i,
        fechaPago: fmtDate(currentDate),
        saldoInsoluto: Math.max(0, saldo),
        pagoCapital: capitalFijo,
        pagoInteres: interesFijo,
        ivaInteres: iva,
        pagoPeriodo,
        pagoSeguro: seguroPorPeriodo,
        pagoTotal: pagoPeriodo + seguroPorPeriodo,
      });
      saldo -= capitalFijo;
      currentDate.setDate(currentDate.getDate() + diasPeriodo);
    }
  }

  return rows;
}