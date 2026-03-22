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
  area: string;
  promptIAFase: string;
  notasFase: string;
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

export const CAT_AREA = [
  { value: '', label: '(Sin área asignada)' },
  { value: 'INTEGRACIÓN', label: 'Integración' },
  { value: 'ANÁLISIS', label: 'Análisis' },
  { value: 'JURÍDICO', label: 'Jurídico' },
  { value: 'LIBERACIÓN', label: 'Liberación' },
  { value: 'COBRANZA NORTE', label: 'Cobranza Norte' },
  { value: 'COBRANZA SUR', label: 'Cobranza Sur' },
  { value: 'COBRANZA CDMX', label: 'Cobranza CDMX' },
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
  area: '',
  promptIAFase: '',
  notasFase: '',
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

// ── Removed: MOCK_ORIGINACIONES — Originación carga exclusivamente desde Fin_Corp_Accnt (Supabase) ──
// El módulo OriginacionModule usa useSolicitudesDB() como fuente de datos.

/** Construye OriginacionFormData desde un OriginacionListItem (sin datos de prueba) */
function buildFormFromListItem(m: OriginacionListItem): OriginacionFormData {
  return {
    ...EMPTY_FORM,
    noOriginacion: m.noOriginacion,
    noSolicitud: m.noSolicitud,
    cliente: m.cliente,
    noCliente: m.noCliente,
    fechaSolicitud: m.fechaSolicitud,
    sucursal: m.sucursal,
    montoSolicitado: m.montoSolicitado ? String(m.montoSolicitado) : '',
    montoAutorizado: m.montoAutorizado ? String(m.montoAutorizado) : '',
    sublinea: m.sublinea,
    producto: m.producto,
    estatus: m.estatus,
    subEstatus: m.subEstatus,
    responsable: m.responsable,
  };
}

/**
 * Construye OriginacionFormData a partir de un SolicitudListItem real (DB).
 * Extrae datos del JSONB data.solicitud.* — sin valores de prueba.
 * Sincronizado con SolicitudCreditoForm para mostrar los mismos campos.
 */
export function buildFormFromSolicitudItem(item: Record<string, any>): OriginacionFormData {
  const d = item._data || {};
  const sol = d.solicitud || {};
  const hdr = sol.header || {};
  const terminos = sol.terminos_condiciones?.parametros_simulacion || {};

  const nombreCompleto = [hdr.nombre_persona, hdr.apellido_paterno_persona, hdr.apellido_materno_persona]
    .filter(Boolean).join(' ').trim() || item.nombreCompleto || '';

  const faseId = item.faseId || hdr.faseId || '1';
  const faseDescripcion = item.descripcionFase || hdr.descripcion_fase || 'Integración del Expediente';

  let area = item.area || hdr.area || '';
  if (!area && faseDescripcion) {
    if (faseDescripcion.toLowerCase().includes('integraci')) area = 'INTEGRACIÓN';
    else if (faseDescripcion.toLowerCase().includes('análisis') || faseDescripcion.toLowerCase().includes('operativo')) area = 'ANÁLISIS';
    else if (faseDescripcion.toLowerCase().includes('jurídi')) area = 'JURÍDICO';
    else if (faseDescripcion.toLowerCase().includes('formaliz') || faseDescripcion.toLowerCase().includes('liberac')) area = 'LIBERACIÓN';
  }

  return {
    ...EMPTY_FORM,
    noOriginacion: item.noSol || String(item.id || ''),
    noSolicitud: item.noSol || '',
    noCliente: item._clienteId || '',
    cliente: nombreCompleto,
    fechaSolicitud: item.fechaSolicitud || hdr.fecha_solicitud || '',
    empresaFondeadora: item.empresaFondeadora || hdr.empresa_fondeadora || '',
    sucursal: item.sucursal || hdr.sucursal || '',
    montoSolicitado: item.montoSolicitado ? String(item.montoSolicitado) : '',
    montoAutorizado: item.montoAutorizado ? String(item.montoAutorizado) : '',
    lineaProducto: item._lineaProducto || hdr.linea_producto || 'Crédito',
    sublinea: item.tipoProducto || hdr.tipo_producto || '',
    producto: item.nombreProducto || hdr.nombre_producto || '',
    periodo: terminos.periodicidad || '',
    plazos: String(terminos.plazo || ''),
    destinoCredito: hdr.destino_credito || '',
    estatus: item.estatusSolicitud || hdr.estatus || 'En Proceso',
    subEstatus: faseDescripcion,
    responsable: hdr.responsable || '',
    area: area,
    promptIAFase: item.promptIAFase || hdr.prompt_ia || '',
    notasFase: item.notasFase || hdr.notas_fase || faseDescripcion,
    tasaAutorizada: String(terminos.tasa_interes || ''),
    fechaInicio: hdr.fecha_inicio || '',
    fechaFin: hdr.fecha_fin || '',
    moneda: terminos.moneda || 'MXN',
    estatusCliente: item.estatusCliente || hdr.estatus_cliente || '',
    direccionPrincipal: hdr.direccion || item.direccion || '',
    estatusListaNegra: item.estatusListaNegra || hdr.estatus_lista_negra || 'POSITIVO',
  };
}

/**
 * Siembra el store de Originación con datos reales del item de Solicitud (DB).
 * Solo siembra si aún no hay datos propios del módulo de Originación para este ID.
 * Preserva cambios que el usuario haya hecho dentro de Originación.
 */
export function seedOriginacionFromSolicitudItem(origId: number | string, item: Record<string, any>): void {
  // No sobrescribir si ya fue sembrado Y el usuario tiene cambios guardados
  if (loadFromSavedStore(origId, '_seeded')) return;

  const form = buildFormFromSolicitudItem(item);
  saveToSavedStore(origId, 'form', form);
  saveToSavedStore(origId, '_seeded', true);

  const d = item._data || {};
  const sol = d.solicitud || {};

  // Expediente electrónico → expedientes de originación
  const docs: any[] = sol.expediente_electronico || [];
  if (docs.length > 0) {
    const expedientes = docs.map((doc: any) => ({
      id: doc.id || generateId(),
      fechaHora: doc.fecha || doc.fecha_hora || '',
      usuario: doc.usuario || '',
      tipoDocumento: doc.tipo_documento || doc.tipoDocumento || '',
      archivo: doc.archivo || '',
      descripcion: doc.nota || doc.descripcion || '',
      estatus: doc.estatus === 'Validado' ? 'Aprobado' : (doc.estatus || 'Pendiente'),
      observaciones: doc.observaciones || '',
      fileData: doc.fileData || doc.file_data,
    }));
    saveToSavedStore(origId, 'expedientes', expedientes);
  }

  // Garantías
  const gars: any[] = sol.garantias || [];
  if (gars.length > 0) {
    const garantias = gars.map((g: any) => ({
      id: g.id || generateId(),
      tipo: g.tipo || '',
      subtipo: g.subtipo || '',
      descripcion: g.descripcion || '',
      valorNominal: g.valor_garantia || g.valorNominal || g.valor_nominal || 0,
      ubicacion: g.ubicacion || '',
      estatus: g.estatus || 'Vigente',
    }));
    saveToSavedStore(origId, 'garantias', garantias);
  }

  // Notas → formato Originación (fechaCreacion: Date, contenido: string)
  const nts: any[] = sol.notas || [];
  if (nts.length > 0) {
    const notas = nts.map((n: any) => ({
      id: n.id || generateId(),
      fechaCreacion: new Date(n.fecha || n.fecha_creacion || Date.now()),
      usuario: n.usuario || '',
      contenido: n.nota || n.contenido || '',
    }));
    saveToSavedStore(origId, 'notas', notas);
  }

  // Autorizaciones → comités
  const auths: any[] = sol.autorizaciones || [];
  if (auths.length > 0) {
    const comites = auths.map((a: any) => ({
      autoridad: a.usuario || a.area || '',
      estatus: a.estado_autorizacion || a.estatus || 'Pendiente',
    }));
    saveToSavedStore(origId, 'comites', comites);
  }

  // Comisiones → cargos (necesario para FASE 6: CxP/CxC DETAIL)
  const comisiones: any[] = sol.comisiones || [];
  if (comisiones.length > 0) {
    const cargos = comisiones.map((c: any) => ({
      id: c.id || generateId(),
      tipoCargo: c.tipo_comision || c.tipoCargo || 'Capital',
      descripcion: c.descripcion || c.tipo_comision || '',
      monto: typeof c.monto === 'number' ? c.monto : (c.montoCalculado || 0),
      fechaCargo: c.fecha || '',
      estatus: c.estatus || 'Pendiente',
      notas: '',
    }));
    saveToSavedStore(origId, 'cargos', cargos);
  }
}

// ── Bridge: solicitudes enviadas desde Solicitudes pero aún sin refetch de DB ──
const _originacionesDinamicas: OriginacionListItem[] = [];

export function addOriginacionItem(item: Omit<OriginacionListItem, 'id' | 'noOriginacion'>): void {
  const newId = Date.now();
  const nextNum = _originacionesDinamicas.length + 1;
  const newItem: OriginacionListItem = {
    id: newId,
    noOriginacion: `OR-${String(nextNum).padStart(3, '0')}`,
    ...item,
  };
  _originacionesDinamicas.push(newItem);
  // Guardar form sin datos de prueba — solo lo que viene del item real
  saveToSavedStore(newId, 'form', buildFormFromListItem(newItem));
}

/**
 * Devuelve items locales (bridge) — sin datos de prueba.
 * La lista principal de Originación la provee useSolicitudesDB() en OriginacionModule.
 */
export function getOriginaciones(): OriginacionListItem[] {
  return [..._originacionesDinamicas];
}