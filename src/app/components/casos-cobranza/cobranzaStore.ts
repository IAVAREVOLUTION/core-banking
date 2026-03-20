// ═══════════════════════════════════════════════════════════════════
// COBRANZA STORE — prefix: cobranza_
// ═══════════════════════════════════════════════════════════════════

// ── TYPES ──
export interface CasoCobranzaListItem {
  id: number;
  noCaso: string;
  tipo: string;
  propietario: string;
  estatus: string;
  prioridad: string;
  area: string;
  nombreCompleto: string;
  nombreDespacho: string;
  subEstatus: string;
  fechaSolicitud: string;
  resumen: string;
}

export interface CasoFormData {
  noCaso: string;
  tipo: string;
  fechaAsignacion: string;
  area: string;
  estatus: string;
  subEstatus: string;
  prioridad: string;
  despachoAsignado: string;
  nombreDespacho: string;
  empresa: string;
  noEmpresa: string;
  noCredito: string;
  resumen: string;
}

export interface Convenio {
  id: number;
  fechaCreacion: string;
  creadoPor: string;
  noConvenio: string;
  tipoConvenio: string;
  aprobadoPorMEF: string;
  fechaConvenio: string;
  fechaPago: string;
  monto: number;
  periodicidad: string;
  noPagos: number;
  socioContacto: string;
  estatus: string;
  comentarios: string;
  fechaRealizacion: string;
  tipoPago: string;
}

// ── EMPTY FORM ──
export const EMPTY_FORM: CasoFormData = {
  noCaso: '', tipo: 'Normal', fechaAsignacion: '', area: 'DEFAULT ORGANIZACI',
  estatus: 'Abierto', subEstatus: 'Integración', prioridad: '3 - Media',
  despachoAsignado: 'SADMIN', nombreDespacho: '', empresa: '', noEmpresa: '',
  noCredito: '', resumen: '',
};

// ── CATALOGS ──
export const CAT_TIPO = ['Normal', 'Extrajudicial', 'Judicial'];
export const CAT_ESTATUS = ['Abierto', 'En Proceso', 'Cerrado'];
export const CAT_SUB_ESTATUS = ['Integración', 'Análisis', 'Jurídico', 'Liberación', 'No asignado'];
export const CAT_PRIORIDAD = ['1 - Alta', '2 - Media', '3 - Media', '4 - Baja'];
export const CAT_AREA = ['DEFAULT ORGANIZACI', 'COBRANZA NORTE', 'COBRANZA SUR', 'COBRANZA CDMX', 'JURÍDICO'];
export const CAT_DESPACHO = ['SADMIN', 'DESPACHO LEGAL MX', 'BUFETE JURÍDICO SA', 'COBRANZA EFICAZ'];
export const CAT_TIPO_CONVENIO = ['Normal', 'Extra-Judicial', 'Judicial'];
export const CAT_PERIODICIDAD = ['Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral'];
export const CAT_ESTATUS_CONVENIO = ['No programado', 'Programado', 'Cumplido', 'Incumplido'];
export const CAT_TIPO_PAGO = ['Transferencia', 'Cheque', 'Efectivo', 'SPEI', 'Depósito'];

// ── PERSISTENCE (prefix: cobranza_) ──
const PREFIX = 'cobranza_';
const SAVED: Record<string, Record<string, any>> = {};

export function saveToSession<T>(id: number | 'new', sub: string, d: T) {
  try { sessionStorage.setItem(`${PREFIX}${id}_${sub}`, JSON.stringify(d)); } catch {}
}
export function loadFromSession<T>(id: number | 'new', sub: string): T | null {
  try { const r = sessionStorage.getItem(`${PREFIX}${id}_${sub}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function saveToSavedStore<T>(id: number | 'new', sub: string, d: T) {
  const k = String(id); if (!SAVED[k]) SAVED[k] = {}; SAVED[k][sub] = structuredClone(d);
}
export function loadFromSavedStore<T>(id: number | 'new', sub: string): T | null {
  const d = SAVED[String(id)]?.[sub]; return d ? structuredClone(d) as T : null;
}
export function clearSession(id: number | 'new') {
  const p = `${PREFIX}${id}_`; const ks: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k?.startsWith(p)) ks.push(k); }
  ks.forEach(k => sessionStorage.removeItem(k));
}
export function migrateSavedStore(from: number | 'new', to: number) {
  const fk = String(from), tk = String(to);
  if (SAVED[fk]) { SAVED[tk] = structuredClone(SAVED[fk]); delete SAVED[fk]; }
}

let _nextCob = 9;
export function getNextCasoId(): string { return `3-${String(12351010 + _nextCob).padStart(8, '0')}`; }
export function consumeCasoId(): string { const id = getNextCasoId(); _nextCob++; return id; }

export function formatCurrency(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : v;
  if (isNaN(n)) return '$0.00';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function parseCurrency(v: string): string { return v.replace(/[^0-9.-]/g, ''); }

// ── MOCK DATA ──
export const MOCK_CASOS: CasoCobranzaListItem[] = [
  { id: 1, noCaso: '3-12351011', tipo: 'Normal', propietario: 'SADMIN', estatus: 'Abierto', prioridad: '3 - Media', area: 'DEFAULT ORGANIZACI', nombreCompleto: 'FRANCISCO JAVIER', nombreDespacho: 'No asignado', subEstatus: 'Integración', fechaSolicitud: '09/26/2023', resumen: '' },
  { id: 2, noCaso: '3-12061063', tipo: 'Normal', propietario: 'SADMIN', estatus: 'Abierto', prioridad: '3 - Media', area: 'DEFAULT ORGANIZACI', nombreCompleto: 'LUIS AGUILAR SAIN', nombreDespacho: 'No asignado', subEstatus: 'Análisis', fechaSolicitud: '10/18/2023', resumen: '' },
  { id: 3, noCaso: '3-12181068', tipo: 'Extrajudicial', propietario: 'SADMIN', estatus: 'Abierto', prioridad: '3 - Media', area: 'DEFAULT ORGANIZACI', nombreCompleto: 'FRANCISCO JAVIER', nombreDespacho: 'No asignado', subEstatus: 'Integración', fechaSolicitud: '12/06/2023', resumen: '' },
  { id: 4, noCaso: '3-12181070', tipo: 'Extrajudicial', propietario: 'SADMIN', estatus: 'Abierto', prioridad: '3 - Media', area: 'DEFAULT ORGANIZACI', nombreCompleto: 'FRANCISCO JAVIER', nombreDespacho: 'No asignado', subEstatus: 'Jurídico', fechaSolicitud: '12/11/2023', resumen: '' },
  { id: 5, noCaso: '3-14210404', tipo: 'Extrajudicial', propietario: 'SADMIN', estatus: 'Abierto', prioridad: '3 - Media', area: 'DEFAULT ORGANIZACI', nombreCompleto: 'FRANCISCO JAVIER', nombreDespacho: 'No asignado', subEstatus: 'Análisis', fechaSolicitud: '12/11/2023', resumen: 'OK' },
  { id: 6, noCaso: '3-14577911', tipo: 'Normal', propietario: 'SADMIN', estatus: 'En Proceso', prioridad: '1 - Alta', area: 'DEFAULT ORGANIZACI', nombreCompleto: 'ROBERTO MARTINEZ', nombreDespacho: 'No asignado', subEstatus: 'Integración', fechaSolicitud: '12/16/2023', resumen: 'PAGO DE CUENTA ATRASADA' },
  { id: 7, noCaso: '3-12660081', tipo: 'Extrajudicial', propietario: 'SADMIN', estatus: 'Abierto', prioridad: '3 - Media', area: 'DEFAULT ORGANIZACI', nombreCompleto: 'FRANCISCO JAVIER', nombreDespacho: 'No asignado', subEstatus: 'Liberación', fechaSolicitud: '10/07/2023', resumen: '' },
  { id: 8, noCaso: '3-13667018', tipo: 'Normal', propietario: 'SADMIN', estatus: 'En Proceso', prioridad: '2 - Media', area: 'COBRANZA NORTE', nombreCompleto: 'DANIEL ARELLETA', nombreDespacho: 'No asignado', subEstatus: 'Análisis', fechaSolicitud: '11/22/2023', resumen: '' },
  { id: 9, noCaso: '3-12850291', tipo: 'Extrajudicial', propietario: 'SADMIN', estatus: 'Abierto', prioridad: '3 - Media', area: 'DEFAULT ORGANIZACI', nombreCompleto: 'RAUL PEREZ PEREZ', nombreDespacho: 'No asignado', subEstatus: 'Jurídico', fechaSolicitud: '12/05/2023', resumen: 'Ejemplo para caso de cobranza extrajudicial' },
  { id: 10, noCaso: '3-12822014', tipo: 'Judicial', propietario: 'SADMIN', estatus: 'Cerrado', prioridad: '3 - Media', area: 'JURÍDICO', nombreCompleto: 'IGNACIO REYES ESTI', nombreDespacho: 'No asignado', subEstatus: 'Liberación', fechaSolicitud: '09/05/2023', resumen: 'Este contrato está en el proceso de "Cobranza Judicial"' },
];

// Pre-seed SAVED store
function buildForm(m: CasoCobranzaListItem): CasoFormData {
  return {
    noCaso: m.noCaso, tipo: m.tipo,
    fechaAsignacion: m.fechaSolicitud,
    area: m.area, estatus: m.estatus, subEstatus: m.subEstatus,
    prioridad: m.prioridad, despachoAsignado: m.propietario,
    nombreDespacho: m.nombreDespacho,
    empresa: m.nombreCompleto.includes('S.A') ? m.nombreCompleto : 'SOLUCIONES APLICADAS DF',
    noEmpresa: `3-${String(Math.floor(Math.random() * 9000) + 1000)}5`,
    noCredito: `1${String(7000000 + m.id * 111).padStart(7, '0')}`,
    resumen: m.resumen,
  };
}

const MOCK_CONVENIOS_1: Convenio[] = [
  { id: 1, fechaCreacion: '12/06/2023 11:10:25', creadoPor: 'SADMIN', noConvenio: '3-8P1F1', tipoConvenio: 'Normal', aprobadoPorMEF: '', fechaConvenio: '02/12/2023', fechaPago: '12/06/2023', monto: 10000.00, periodicidad: 'Mensual', noPagos: 1, socioContacto: '', estatus: 'No programado', comentarios: '', fechaRealizacion: '', tipoPago: '' },
  { id: 2, fechaCreacion: '11/05/2023 10:52:01', creadoPor: 'SADMIN', noConvenio: '3-899E2', tipoConvenio: 'Extra-Judicial', aprobadoPorMEF: '', fechaConvenio: '02/12/2023', fechaPago: '11/05/2023', monto: 11000.00, periodicidad: 'Mensual', noPagos: 1, socioContacto: '', estatus: 'No Programado', comentarios: '', fechaRealizacion: '', tipoPago: '' },
  { id: 3, fechaCreacion: '11/04/2023 11:37:13', creadoPor: 'SADMIN', noConvenio: '3-7Y5M1', tipoConvenio: 'Normal', aprobadoPorMEF: '', fechaConvenio: '', fechaPago: '11/04/2023', monto: 15000.00, periodicidad: 'Mensual', noPagos: 1, socioContacto: '', estatus: 'No programado', comentarios: '', fechaRealizacion: '', tipoPago: '' },
];

MOCK_CASOS.forEach(m => {
  saveToSavedStore(m.id, 'form', buildForm(m));
  if (m.id === 1) saveToSavedStore(m.id, 'convenios', MOCK_CONVENIOS_1);
});
