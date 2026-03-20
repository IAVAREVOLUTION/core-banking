// ============================================================
// Store centralizado para Originación
// Persistencia via sessionStorage: originacion_{id}_{subtab}
// ============================================================

export interface OriginacionFormData {
  noOriginacion: string;
  noSolicitud: string;
  cliente: string;
  noCliente: string;
  fechaSolicitud: string;
  empresaFondeadora: string;
  sucursal: string;
  montoSolicitado: string;
  lineaProducto: string;
  sublinea: string;
  producto: string;
  periodo: string;
  plazos: string;
  destinoCredito: string;
  estatus: string;
  subEstatus: string;
  plazoAutorizado: string;
  montoAutorizado: string;
  tasaAutorizada: string;
  fechaInicio: string;
  fechaFin: string;
  responsable: string;
  // Default sub-tab
  estatusSC: string;
  estatusPago?: string;
  estatusCartera?: string;
  direccionPrincipal: string;
  estatusListaNegra: string;
  estatusCliente: string;
  moneda: string;
  // Montos/Plazos
  plazoMinimo: string;
  plazoAutorizadoMontos: string;
  plazoMaximo: string;
  montoMinimo: string;
  montoAutorizadoMontos: string;
  montoMaximo: string;
  // Tasas
  tasaMinima: string;
  tasaAutorizadaTasas: string;
  tasaMaxima: string;
}

export interface OriginacionExpediente {
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

export interface OriginacionAutorizacion {
  id: number;
  fechaHora: string;
  usuario: string;
  area: string;
  descripcion: string;
  observaciones: string;
  estatus: string;
}

export interface OriginacionGarantia {
  id: number;
  tipo: string;
  subtipo: string;
  descripcion: string;
  valorNominal: number;
  ubicacion: string;
  estatus: string;
}

export interface OriginacionCargo {
  id: number;
  tipoCargo: string;
  descripcion: string;
  monto: number;
  fechaCargo: string;
  estatus: string;
  notas: string;
}

export interface OriginacionAviso {
  id: number;
  tipo: string;
  mensaje: string;
  fechaCreacion: string;
  fechaVencimiento: string;
  destinatario: string;
  estatus: string;
}

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

// ---- Persistencia ----
function storageKey(id: number | 'new', subtab: string): string {
  return `originacion_${id}_${subtab}`;
}

export function saveToSession<T>(id: number | 'new', subtab: string, data: T): void {
  try { sessionStorage.setItem(storageKey(id, subtab), JSON.stringify(data)); } catch { /* */ }
}

export function loadFromSession<T>(id: number | 'new', subtab: string): T | null {
  try {
    const raw = sessionStorage.getItem(storageKey(id, subtab));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSession(id: number | 'new'): void {
  const prefix = `originacion_${id}_`;
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix)) keys.push(k);
  }
  keys.forEach(k => sessionStorage.removeItem(k));
}

// ---- Saved store (in-memory) ----
const SAVED_DATA: Record<string, Record<string, any>> = {};

export function saveToSavedStore<T>(id: number | 'new', subtab: string, data: T): void {
  const key = String(id);
  if (!SAVED_DATA[key]) SAVED_DATA[key] = {};
  SAVED_DATA[key][subtab] = structuredClone(data);
}

export function loadFromSavedStore<T>(id: number | 'new', subtab: string): T | null {
  const key = String(id);
  const data = SAVED_DATA[key]?.[subtab];
  return data ? structuredClone(data) as T : null;
}

export function migrateSavedStore(fromId: number | 'new', toId: number): void {
  const fromKey = String(fromId);
  const toKey = String(toId);
  if (SAVED_DATA[fromKey]) {
    SAVED_DATA[toKey] = structuredClone(SAVED_DATA[fromKey]);
    delete SAVED_DATA[fromKey];
  }
  const prefix = `originacion_${fromId}_`;
  const newPrefix = `originacion_${toId}_`;
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

export function commitAndClearSession(id: number | 'new'): void {
  const prefix = `originacion_${id}_`;
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix)) keys.push(k);
  }
  keys.forEach(k => {
    const subtab = k.replace(prefix, '');
    try {
      const data = JSON.parse(sessionStorage.getItem(k)!);
      saveToSavedStore(id, subtab, data);
    } catch { /* */ }
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

let _nextOrig = 9;
export function getNextOriginacionId(): string {
  return `OR-${String(_nextOrig).padStart(3, '0')}`;
}
export function consumeOriginacionId(): string {
  const id = `OR-${String(_nextOrig).padStart(3, '0')}`;
  _nextOrig++;
  return id;
}

// ---- Catálogos ----
export const CAT_CLIENTES = [
  { value: 'CL-001 - Juan Pérez Gómez', label: 'CL-001 - Juan Pérez Gómez' },
  { value: 'CL-002 - María García López', label: 'CL-002 - María García López' },
  { value: 'CL-003 - Carlos Martínez Sánchez', label: 'CL-003 - Carlos Martínez Sánchez' },
  { value: 'CL-004 - HELVEX, S.A. DE C.V', label: 'CL-004 - HELVEX, S.A. DE C.V' },
  { value: 'CL-005 - Sofía Reyes López', label: 'CL-005 - Sofía Reyes López' },
];

export const CAT_SUCURSAL = [
  { value: 'CDMX', label: 'CDMX' },
  { value: 'Monterrey', label: 'Monterrey' },
  { value: 'Guadalajara', label: 'Guadalajara' },
  { value: 'Querétaro', label: 'Querétaro' },
  { value: 'Toluca', label: 'Toluca' },
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
];

export const CAT_ESTATUS = [
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'En Proceso', label: 'En Proceso' },
  { value: 'Aprobado', label: 'Aprobado' },
  { value: 'Rechazado', label: 'Rechazado' },
  { value: 'Cancelado', label: 'Cancelado' },
];

export const CAT_SUB_ESTATUS = [
  { value: 'Integración del Expediente', label: 'Integración del Expediente' },
  { value: 'Análisis de Crédito', label: 'Análisis de Crédito' },
  { value: 'Jurídico', label: 'Jurídico' },
  { value: 'Liberación', label: 'Liberación' },
];

export const CAT_MONEDA = [
  { value: 'MXN', label: 'MXN - Peso Mexicano' },
  { value: 'USD', label: 'USD - Dólar Americano' },
];

export const CAT_TIPO_DOCUMENTO = [
  'Credencial de elector', 'Pasaporte', 'Licencia de conducir', 'Comprobante de domicilio',
  'Estado de cuenta bancario', 'Constancia de situación fiscal', 'Acta constitutiva',
  'Carta de autorización', 'Avalúo', 'Otro',
];
export const CAT_ESTATUS_EXPEDIENTE = ['Pendiente', 'Aprobado', 'Rechazado'];
export const CAT_ESTATUS_AUTORIZACION = ['Pendiente', 'Autorizado', 'Rechazado', 'Condicionado'];
export const CAT_TIPO_GARANTIA = [
  { value: 'Hipotecaria', label: 'Hipotecaria' },
  { value: 'Prendaria', label: 'Prendaria' },
  { value: 'Fiduciaria', label: 'Fiduciaria' },
  { value: 'Líquida', label: 'Líquida' },
];
export const CAT_TIPO_CARGO = [
  { value: 'Comisión por apertura', label: 'Comisión por apertura' },
  { value: 'Seguro de vida', label: 'Seguro de vida' },
  { value: 'Gastos notariales', label: 'Gastos notariales' },
  { value: 'Avalúo', label: 'Avalúo' },
];
export const CAT_ESTATUS_CARGO = ['Pendiente', 'Aplicado', 'Cancelado'];
export const CAT_TIPO_AVISO = [
  { value: 'Recordatorio', label: 'Recordatorio' },
  { value: 'Alerta', label: 'Alerta' },
  { value: 'Notificación', label: 'Notificación' },
];
export const CAT_ESTATUS_AVISO = ['Activo', 'Leído', 'Vencido', 'Cancelado'];
export const CAT_ESTATUS_SC = [
  { value: 'Activo', label: 'Activo' },
  { value: 'Inactivo', label: 'Inactivo' },
  { value: 'Suspendido', label: 'Suspendido' },
];
export const CAT_ESTATUS_CLIENTE = [
  { value: 'Vigente', label: 'Vigente' },
  { value: 'Inactivo', label: 'Inactivo' },
  { value: 'Suspendido', label: 'Suspendido' },
  { value: 'Bloqueado', label: 'Bloqueado' },
];
export const CAT_ESTATUS_LISTA_NEGRA = [
  { value: 'POSITIVO', label: 'POSITIVO — Sin coincidencias' },
  { value: 'NEGATIVO', label: 'NEGATIVO — Con coincidencias' },
  { value: 'EN REVISIÓN', label: 'EN REVISIÓN' },
];

// ---- Formulario vacío ----
export const EMPTY_FORM: OriginacionFormData = {
  noOriginacion: 'Auto',
  noSolicitud: '',
  cliente: '',
  noCliente: '',
  fechaSolicitud: '',
  empresaFondeadora: '',
  sucursal: '',
  montoSolicitado: '',
  lineaProducto: 'Crédito',
  sublinea: '',
  producto: '',
  periodo: '',
  plazos: '',
  destinoCredito: '',
  estatus: 'Pendiente',
  subEstatus: 'Integración del Expediente',
  plazoAutorizado: '',
  montoAutorizado: '',
  tasaAutorizada: '',
  fechaInicio: '',
  fechaFin: '',
  responsable: '',
  estatusSC: '',
  estatusPago: '',
  estatusCartera: '',
  direccionPrincipal: '',
  estatusListaNegra: 'POSITIVO',
  estatusCliente: '',
  moneda: 'MXN',
  plazoMinimo: '12.00',
  plazoAutorizadoMontos: '',
  plazoMaximo: '60.00',
  montoMinimo: '50,000.00',
  montoAutorizadoMontos: '',
  montoMaximo: '500,000.00',
  tasaMinima: '8.5000',
  tasaAutorizadaTasas: '',
  tasaMaxima: '24.0000',
};

// ---- Lista ----
export interface OriginacionListItem {
  id: number;
  noOriginacion: string;
  noSolicitud: string;
  noCliente: string;
  cliente: string;
  fechaSolicitud: string;
  montoSolicitado: number;
  montoAutorizado: number;
  sublinea: string;
  producto: string;
  sucursal: string;
  estatus: string;
  subEstatus: string;
  responsable: string;
}

// ── Mock data (8 registros provenientes de Solicitud de Crédito) ──
export const MOCK_ORIGINACIONES: OriginacionListItem[] = [
  { id: 1, noOriginacion: 'OR-001', noSolicitud: 'SC-001', noCliente: 'CL-001', cliente: 'Juan Pérez Gómez', fechaSolicitud: '05/01/26', montoSolicitado: 150000, montoAutorizado: 150000, sublinea: 'Crédito Personal', producto: 'Crédito Simple', sucursal: 'CDMX', estatus: 'En Proceso', subEstatus: 'Integración del Expediente', responsable: 'Ana López' },
  { id: 2, noOriginacion: 'OR-002', noSolicitud: 'SC-002', noCliente: 'CL-002', cliente: 'María García López', fechaSolicitud: '08/01/26', montoSolicitado: 500000, montoAutorizado: 480000, sublinea: 'Crédito Empresarial', producto: 'Línea de Crédito', sucursal: 'Monterrey', estatus: 'En Proceso', subEstatus: 'Análisis de Crédito', responsable: 'Carlos Ruiz' },
  { id: 3, noOriginacion: 'OR-003', noSolicitud: 'SC-003', noCliente: 'CL-003', cliente: 'Carlos Martínez Sánchez', fechaSolicitud: '12/01/26', montoSolicitado: 80000, montoAutorizado: 80000, sublinea: 'Crédito Automotriz', producto: 'Crédito Simple', sucursal: 'Guadalajara', estatus: 'En Proceso', subEstatus: 'Jurídico', responsable: 'Laura Torres' },
  { id: 4, noOriginacion: 'OR-004', noSolicitud: 'SC-004', noCliente: 'CL-004', cliente: 'HELVEX, S.A. DE C.V', fechaSolicitud: '15/01/26', montoSolicitado: 1200000, montoAutorizado: 1200000, sublinea: 'Crédito Empresarial', producto: 'Línea de Crédito', sucursal: 'Querétaro', estatus: 'En Proceso', subEstatus: 'Liberación', responsable: 'Pedro Vega' },
  { id: 5, noOriginacion: 'OR-005', noSolicitud: 'SC-005', noCliente: 'CL-005', cliente: 'Sofía Reyes López', fechaSolicitud: '20/01/26', montoSolicitado: 45000, montoAutorizado: 0, sublinea: 'Crédito Personal', producto: 'Crédito Simple', sucursal: 'CDMX', estatus: 'Pendiente', subEstatus: 'Integración del Expediente', responsable: 'Ana López' },
  { id: 6, noOriginacion: 'OR-006', noSolicitud: 'SC-006', noCliente: 'CL-001', cliente: 'Juan Pérez Gómez', fechaSolicitud: '22/01/26', montoSolicitado: 300000, montoAutorizado: 300000, sublinea: 'Crédito Hipotecario', producto: 'Crédito Simple', sucursal: 'Toluca', estatus: 'Aprobado', subEstatus: 'Liberación', responsable: 'Carlos Ruiz' },
  { id: 7, noOriginacion: 'OR-007', noSolicitud: 'SC-007', noCliente: 'CL-003', cliente: 'Carlos Martínez Sánchez', fechaSolicitud: '25/01/26', montoSolicitado: 95000, montoAutorizado: 90000, sublinea: 'Crédito Personal', producto: 'Crédito Revolvente', sucursal: 'CDMX', estatus: 'En Proceso', subEstatus: 'Análisis de Crédito', responsable: 'Laura Torres' },
  { id: 8, noOriginacion: 'OR-008', noSolicitud: 'SC-008', noCliente: 'CL-002', cliente: 'María García López', fechaSolicitud: '28/01/26', montoSolicitado: 750000, montoAutorizado: 0, sublinea: 'Crédito Empresarial', producto: 'Línea de Crédito', sucursal: 'Monterrey', estatus: 'Pendiente', subEstatus: 'Integración del Expediente', responsable: 'Pedro Vega' },
];

// ── Pre-seed SAVED_DATA from mock records so Editar/Ver loads correct data ──
function buildFormFromMock(m: OriginacionListItem): OriginacionFormData {
  const clienteVal = CAT_CLIENTES.find(c => c.value.includes(m.cliente))?.value || m.cliente;
  return {
    ...EMPTY_FORM,
    noOriginacion: m.noOriginacion,
    noSolicitud: m.noSolicitud,
    cliente: clienteVal,
    noCliente: m.noCliente,
    fechaSolicitud: m.fechaSolicitud,
    sucursal: m.sucursal,
    montoSolicitado: m.montoSolicitado.toFixed(2),
    montoAutorizado: m.montoAutorizado.toFixed(2),
    sublinea: m.sublinea,
    producto: m.producto,
    estatus: m.estatus,
    subEstatus: m.subEstatus,
    responsable: m.responsable,
    periodo: 'Mensual',
    plazos: '24',
    destinoCredito: 'Capital de trabajo',
    tasaAutorizada: '14.5000',
  };
}

// Seed on module load
MOCK_ORIGINACIONES.forEach(m => {
  saveToSavedStore(m.id, 'form', buildFormFromMock(m));
});