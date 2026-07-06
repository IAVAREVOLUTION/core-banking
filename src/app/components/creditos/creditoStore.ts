// ═══════════════════════════════════════════════════════════════════
// CRÉDITO STORE — prefix: credito_
// ═══════════════════════════════════════════════════════════════════

// ── Imports de Solicitud Store (para generación automática de crédito) ──
import {
  SolicitudFormData as SolFormData,
  Expediente as SolExp,
  Autorizacion as SolAut,
  Garantia as SolGar,
  CargoSolicitud as SolCargo,
  Aviso as SolAviso,
  loadFromSavedStore as loadSolSaved,
  MOCK_FORMS as SOL_MOCK_FORMS,
  MOCK_EXPEDIENTES as SOL_MOCK_EXP,
  MOCK_AUTORIZACIONES as SOL_MOCK_AUT,
  MOCK_GARANTIAS as SOL_MOCK_GAR,
  MOCK_CARGOS as SOL_MOCK_CAR,
  MOCK_AVISOS as SOL_MOCK_AVI,
  EMPTY_FORM as SOL_EMPTY,
} from '../solicitudes/solicitudCreditoStore';

// ── TYPES ──
export interface CreditoFormData {
  noCredito: string; cliente: string; noCliente: string; fechaCredito: string;
  empresaFondeadora: string; sucursal: string; montoSolicitado: string;
  lineaProducto: string; sublinea: string; producto: string; periodo: string;
  plazos: string; destinoCredito: string;
  estatusPago: string; estatusCartera: string; estatusCredito: string;
  plazoAutorizado: string; montoAutorizado: string; tasaAutorizada: string;
  fechaInicio: string; fechaFin: string;
  estatusSIC: string; estatusListaNegra: string; estatusCliente: string;
  moneda: string; direccionPrincipal: string;
  // montos/plazos
  plazoMinimo: string; plazoMaximo: string; montoMinimo: string; montoMaximo: string;
  // tasas
  tasaMinima: string; tasaMaxima: string; tasaAutorizadaTasas: string;
}

export interface CreditoListItem {
  id: number; noCredito: string; noCliente: string; cliente: string;
  fechaCredito: string; montoSolicitado: number; montoAutorizado: number;
  lineaProducto: string; sublinea: string; producto: string; sucursal: string;
  estatusCredito: string; fechaInicio: string; fechaFin: string;
}

export interface CreditoExpediente {
  id: number; fechaHora: string; usuario: string; tipoDocumento: string;
  archivo: string; descripcion: string; estatus: string; observaciones: string;
  fileData?: string;
}

export interface CreditoAutorizacion {
  id: number; fechaHora: string; usuario: string; area: string;
  descripcion: string; observaciones: string; estatus: string;
}

export interface CreditoGarantia {
  id: number; tipo: string; subtipo: string; descripcion: string;
  valorNominal: number; ubicacion: string; estatus: string;
}

export interface CreditoCargo {
  id: number; tipoCargo: string; descripcion: string; monto: number;
  fechaCargo: string; estatus: string; notas: string;
}

export interface CreditoAviso {
  id: number; tipo: string; mensaje: string; fechaCreacion: string;
  fechaVencimiento: string; destinatario: string; estatus: string;
}

export interface CreditoSolicitudExtra {
  id: number; tipo: string; descripcion: string; fechaSolicitud: string;
  solicitante: string; estatus: string; observaciones: string;
}

export interface AmortizacionRow {
  noPago: number; fechaPago: string; capital: number; interes: number;
  ivaInteres: number; pagoTotal: number; saldoInsoluto: number;
}

export interface CotizacionRow {
  id: number; concepto: string; monto: number; porcentaje: number; notas: string;
}

// ── EMPTY FORM ──
export const EMPTY_FORM: CreditoFormData = {
  noCredito: '', cliente: '', noCliente: '', fechaCredito: '',
  empresaFondeadora: '', sucursal: '', montoSolicitado: '',
  lineaProducto: 'Crédito', sublinea: '', producto: '', periodo: '', plazos: '',
  destinoCredito: '',
  estatusPago: 'Pendiente', estatusCartera: 'Vigente', estatusCredito: 'Pendiente',
  plazoAutorizado: '', montoAutorizado: '', tasaAutorizada: '',
  fechaInicio: '', fechaFin: '',
  estatusSIC: '', estatusListaNegra: '', estatusCliente: '', moneda: 'MXN',
  direccionPrincipal: '',
  plazoMinimo: '', plazoMaximo: '', montoMinimo: '', montoMaximo: '',
  tasaMinima: '', tasaMaxima: '', tasaAutorizadaTasas: '',
};

// ── CATALOGS ──
export const CAT_CLIENTES = [
  { value: 'CLI-001', label: 'CLI-001 - Juan Perez Perez' },
  { value: 'CLI-002', label: 'CLI-002 - ROTOR AS, S.A DE C.V' },
  { value: 'CLI-003', label: 'CLI-003 - Dulce Fernandez Solis' },
  { value: 'CLI-004', label: 'CLI-004 - HELVER, S.A. DE C.V.' },
  { value: 'CLI-005', label: 'CLI-005 - Sofia Reyes Lopez' },
  { value: 'CLI-006', label: 'CLI-006 - Carlos Perez Leon' },
  { value: 'CLI-007', label: 'CLI-007 - Juan Mendoza Anaya' },
  { value: 'CLI-008', label: 'CLI-008 - INHEM DE MEXICO S.A. DE C.V.' },
];

export const CLIENT_DETAIL_MAP: Record<string, { estatusSIC: string; estatusListaNegra: string; estatusCliente: string; direccionPrincipal: string }> = {
  'CLI-001': { estatusSIC: 'Positivo', estatusListaNegra: 'Negativo', estatusCliente: 'Activo', direccionPrincipal: 'Av. Reforma 123, Col. Centro, Cuauhtémoc, CDMX, C.P. 06600' },
  'CLI-002': { estatusSIC: 'Positivo', estatusListaNegra: 'Negativo', estatusCliente: 'Activo', direccionPrincipal: 'Blvd. Manuel Ávila Camacho 40, Col. Lomas de Chapultepec, CDMX, C.P. 11000' },
  'CLI-003': { estatusSIC: 'Sin consulta', estatusListaNegra: 'Negativo', estatusCliente: 'Activo', direccionPrincipal: 'Calle Morelos 456, Col. Juárez, Monterrey, N.L., C.P. 64000' },
  'CLI-004': { estatusSIC: 'Positivo', estatusListaNegra: 'Negativo', estatusCliente: 'Activo', direccionPrincipal: 'Av. Vallarta 2477, Col. Arcos Vallarta, Guadalajara, Jal., C.P. 44130' },
  'CLI-005': { estatusSIC: 'Negativo', estatusListaNegra: 'Negativo', estatusCliente: 'Inactivo', direccionPrincipal: 'Calle 5 de Febrero 102, Col. Centro, Querétaro, Qro., C.P. 76000' },
  'CLI-006': { estatusSIC: 'Positivo', estatusListaNegra: 'Positivo', estatusCliente: 'En revisión', direccionPrincipal: 'Av. Universidad 1200, Col. Del Valle, CDMX, C.P. 03100' },
  'CLI-007': { estatusSIC: 'Sin consulta', estatusListaNegra: 'Negativo', estatusCliente: 'Activo', direccionPrincipal: 'Blvd. Adolfo López Mateos 500, Col. Los Alpes, Toluca, Edo. Méx., C.P. 50140' },
  'CLI-008': { estatusSIC: 'Positivo', estatusListaNegra: 'Negativo', estatusCliente: 'Activo', direccionPrincipal: 'Av. Industrialización 22, Parque Industrial Benito Juárez, Querétaro, Qro., C.P. 76120' },
};

export const CAT_SUCURSAL = ['CDMX', 'Monterrey', 'Guadalajara', 'Querétaro', 'Toluca', 'San Luis Potosí'];
export const CAT_EMPRESA_FONDEADORA = ['Crédito Mx', 'Crédito maestro', 'Fondeadora A', 'Fondeadora B'];
export const CAT_SUBLINEA = ['Crédito empleado', 'Crédito individual', 'Crédito empresarial', 'Crédito minorista'];
export const CAT_PRODUCTO = ['Crédito Personal', 'Crédito Hipotecario', 'Crédito Automotriz', 'Crédito PYME'];
export const CAT_PERIODO = ['Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral'];
export const CAT_PLAZOS = ['0-6', '7-12', '13-24', '25-36', '37-48', '49-60'];
export const CAT_ESTATUS_PAGO = ['Pendiente', 'Al corriente', 'Atrasado', 'Liquidado'];
export const CAT_ESTATUS_CARTERA = ['Vigente', 'Vencida', 'Castigada', 'Reestructurada'];
export const CAT_ESTATUS_CREDITO = [
  { value: 'Pendiente', label: 'Pendiente' }, { value: 'En revisión', label: 'En revisión' },
  { value: 'Autorizado', label: 'Autorizado' }, { value: 'Rechazado', label: 'Rechazado' },
  { value: 'Activo', label: 'Activo' }, { value: 'Liquidado', label: 'Liquidado' },
];
export const CAT_MONEDA = ['MXN', 'USD', 'EUR'];
export const CAT_TIPO_DOCUMENTO = ['INE', 'Comprobante domicilio', 'Estado de cuenta', 'Escritura', 'Avalúo', 'Contrato', 'Otro'];
export const CAT_ESTATUS_EXPEDIENTE = ['Pendiente', 'Aprobado', 'Rechazado'];
export const CAT_ESTATUS_AUTORIZACION = ['Pendiente', 'Aprobado', 'Rechazado', 'Condicionado'];
export const CAT_TIPO_GARANTIA = [
  { value: 'Hipotecaria', label: 'Hipotecaria' }, { value: 'Prendaria', label: 'Prendaria' },
  { value: 'Fiduciaria', label: 'Fiduciaria' }, { value: 'Personal', label: 'Personal' },
];
export const CAT_TIPO_CARGO = [
  { value: 'Comisión apertura', label: 'Comisión apertura' }, { value: 'Seguro', label: 'Seguro' },
  { value: 'Avalúo', label: 'Avalúo' }, { value: 'Gastos notariales', label: 'Gastos notariales' },
];
export const CAT_ESTATUS_CARGO = ['Pendiente', 'Pagado', 'Exento'];
export const CAT_TIPO_AVISO = [
  { value: 'Vencimiento', label: 'Vencimiento' }, { value: 'Pago', label: 'Pago' },
  { value: 'Renovación', label: 'Renovación' }, { value: 'Otro', label: 'Otro' },
];
export const CAT_ESTATUS_AVISO = ['Activo', 'Atendido', 'Vencido', 'Cancelado'];
export const CAT_TIPO_SOL_EXTRA = [
  { value: 'Reestructura', label: 'Reestructura' }, { value: 'Prórroga', label: 'Prórroga' },
  { value: 'Ampliación', label: 'Ampliación' }, { value: 'Condonación', label: 'Condonación' },
];
export const CAT_ESTATUS_SOL_EXTRA = ['Pendiente', 'Aprobada', 'Rechazada', 'En revisión'];

// ── PERSISTENCE ──
const PREFIX = 'credito_';
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
export function commitAndClearSession(id: number | 'new') {
  const p = `${PREFIX}${id}_`; const ks: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k?.startsWith(p)) ks.push(k); }
  ks.forEach(k => { const sub = k.replace(p, ''); try { saveToSavedStore(id, sub, JSON.parse(sessionStorage.getItem(k)!)); } catch {} });
  ks.forEach(k => sessionStorage.removeItem(k));
}
export function migrateSavedStore(from: number | 'new', to: number) {
  const fk = String(from), tk = String(to);
  if (SAVED[fk]) { SAVED[tk] = structuredClone(SAVED[fk]); delete SAVED[fk]; }
  const p = `${PREFIX}${from}_`, np = `${PREFIX}${to}_`; const ks: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k?.startsWith(p)) ks.push(k); }
  ks.forEach(k => { const sub = k.replace(p, ''); const v = sessionStorage.getItem(k); if (v) sessionStorage.setItem(`${np}${sub}`, v); sessionStorage.removeItem(k); });
}
export function generateId(): number { return Date.now() + Math.floor(Math.random() * 1000); }
export function formatCurrency(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : v;
  if (isNaN(n)) return '$0.00';
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function parseCurrency(v: string): string { return v.replace(/[^0-9.-]/g, ''); }

let _nextCR = 13;
export function getNextCreditoId(): string { return `CR-${String(_nextCR).padStart(3, '0')}`; }
export function consumeCreditoId(): string { const id = `CR-${String(_nextCR).padStart(3, '0')}`; _nextCR++; return id; }

// ── MOCK DATA ──
function buildFormFromMock(m: CreditoListItem): CreditoFormData {
  const cd = CLIENT_DETAIL_MAP[m.noCliente] || { estatusSIC: '', estatusListaNegra: '', estatusCliente: '', direccionPrincipal: '' };
  return {
    ...EMPTY_FORM, noCredito: m.noCredito, noCliente: m.noCliente,
    cliente: CAT_CLIENTES.find(c => c.value === m.noCliente)?.label || m.cliente,
    fechaCredito: m.fechaCredito, sucursal: m.sucursal,
    montoSolicitado: m.montoSolicitado.toFixed(2), montoAutorizado: m.montoAutorizado.toFixed(2),
    sublinea: m.sublinea, producto: m.producto, estatusCredito: m.estatusCredito,
    fechaInicio: m.fechaInicio, fechaFin: m.fechaFin,
    empresaFondeadora: 'Crédito Mx', periodo: 'Mensual', plazos: '7-12',
    plazoAutorizado: '12', tasaAutorizada: '15.50',
    estatusSIC: cd.estatusSIC, estatusListaNegra: cd.estatusListaNegra,
    estatusCliente: cd.estatusCliente, direccionPrincipal: cd.direccionPrincipal,
    plazoMinimo: '6', plazoMaximo: '60', montoMinimo: '1000', montoMaximo: '500000',
    tasaMinima: '8.00', tasaMaxima: '36.00', tasaAutorizadaTasas: '15.50',
  };
}

export const MOCK_CREDITOS: CreditoListItem[] = [
  { id: 1, noCredito: 'CR-001', noCliente: 'CLI-001', cliente: 'Juan Perez Perez', fechaCredito: '24/08/23', montoSolicitado: 2400, montoAutorizado: 2400, lineaProducto: 'Crédito', sublinea: 'Crédito empleado', producto: 'Crédito Personal', sucursal: 'CDMX', estatusCredito: 'Autorizado', fechaInicio: '24/08/23', fechaFin: '24/08/24' },
  { id: 2, noCredito: 'CR-002', noCliente: 'CLI-002', cliente: 'ROTOR AS, S.A DE C.V', fechaCredito: '10/08/23', montoSolicitado: 10800, montoAutorizado: 10800, lineaProducto: 'Crédito', sublinea: 'Crédito individual', producto: 'Crédito Personal', sucursal: 'Monterrey', estatusCredito: 'Autorizado', fechaInicio: '10/08/23', fechaFin: '10/08/24' },
  { id: 3, noCredito: 'CR-003', noCliente: 'CLI-003', cliente: 'Dulce Fernandez Solis', fechaCredito: '12/08/23', montoSolicitado: 5700, montoAutorizado: 5700, lineaProducto: 'Crédito', sublinea: 'Crédito individual', producto: 'Crédito Personal', sucursal: 'Guadalajara', estatusCredito: 'Autorizado', fechaInicio: '12/08/23', fechaFin: '12/08/24' },
  { id: 4, noCredito: 'CR-004', noCliente: 'CLI-004', cliente: 'HELVER, S.A. DE C.V.', fechaCredito: '14/08/23', montoSolicitado: 11900, montoAutorizado: 11900, lineaProducto: 'Crédito', sublinea: 'Crédito individual', producto: 'Crédito Personal', sucursal: 'Querétaro', estatusCredito: 'Autorizado', fechaInicio: '14/08/23', fechaFin: '14/08/24' },
  { id: 5, noCredito: 'CR-005', noCliente: 'CLI-005', cliente: 'Sofia Reyes Lopez', fechaCredito: '17/08/23', montoSolicitado: 7200, montoAutorizado: 7200, lineaProducto: 'Crédito', sublinea: 'Crédito individual', producto: 'Crédito Personal', sucursal: 'CDMX', estatusCredito: 'Autorizado', fechaInicio: '17/08/23', fechaFin: '17/08/24' },
  { id: 6, noCredito: 'CR-006', noCliente: 'CLI-006', cliente: 'Carlos Perez Leon', fechaCredito: '21/08/23', montoSolicitado: 10000, montoAutorizado: 10000, lineaProducto: 'Crédito', sublinea: 'Crédito individual', producto: 'Crédito Personal', sucursal: 'Toluca', estatusCredito: 'En revisión', fechaInicio: '21/08/23', fechaFin: '21/08/24' },
  { id: 7, noCredito: 'CR-007', noCliente: 'CLI-007', cliente: 'Juan Mendoza Anaya', fechaCredito: '17/08/23', montoSolicitado: 1100, montoAutorizado: 1100, lineaProducto: 'Crédito', sublinea: 'Crédito individual', producto: 'Crédito Personal', sucursal: 'San Luis Potosí', estatusCredito: 'Pendiente', fechaInicio: '17/08/23', fechaFin: '17/08/24' },
  { id: 8, noCredito: 'CR-008', noCliente: 'CLI-008', cliente: 'INHEM DE MEXICO S.A. DE C.V.', fechaCredito: '21/08/23', montoSolicitado: 15600, montoAutorizado: 15600, lineaProducto: 'Crédito', sublinea: 'Crédito individual', producto: 'Crédito Personal', sucursal: 'CDMX', estatusCredito: 'Autorizado', fechaInicio: '21/08/23', fechaFin: '21/08/24' },
  { id: 9, noCredito: 'CR-009', noCliente: 'CLI-001', cliente: 'Juan Perez Perez', fechaCredito: '15/03/25', montoSolicitado: 1850000, montoAutorizado: 1850000, lineaProducto: 'Crédito', sublinea: 'Crédito Hipotecario', producto: 'Crédito Simple', sucursal: 'CDMX', estatusCredito: 'Autorizado', fechaInicio: '15/03/25', fechaFin: '15/03/45' },
  { id: 10, noCredito: 'CR-010', noCliente: 'CLI-001', cliente: 'Juan Perez Perez', fechaCredito: '20/04/25', montoSolicitado: 150000, montoAutorizado: 150000, lineaProducto: 'Crédito', sublinea: 'Crédito Quirografario', producto: 'Crédito Personal', sucursal: 'CDMX', estatusCredito: 'Autorizado', fechaInicio: '20/04/25', fechaFin: '20/04/27' },
  { id: 11, noCredito: 'CR-011', noCliente: 'CLI-001', cliente: 'Juan Perez Perez', fechaCredito: '10/05/25', montoSolicitado: 320000, montoAutorizado: 320000, lineaProducto: 'Crédito', sublinea: 'Crédito Prendario', producto: 'Crédito Simple', sucursal: 'CDMX', estatusCredito: 'Autorizado', fechaInicio: '10/05/25', fechaFin: '10/05/29' },
  { id: 12, noCredito: 'CR-012', noCliente: 'CLI-001', cliente: 'Juan Perez Perez', fechaCredito: '02/06/25', montoSolicitado: 85000, montoAutorizado: 85000, lineaProducto: 'Crédito', sublinea: 'Crédito por Scoring', producto: 'Crédito Personal', sucursal: 'CDMX', estatusCredito: 'Autorizado', fechaInicio: '02/06/25', fechaFin: '02/06/27' },
];

// Pre-seed SAVED_DATA
MOCK_CREDITOS.forEach(m => { saveToSavedStore(m.id, 'form', buildFormFromMock(m)); });

// Override CR-009 — Crédito Hipotecario (Crédito Simple con Garantía Depto)
saveToSavedStore<CreditoGarantia[]>(9, 'garantias', [
  {
    id: 9001,
    tipo: 'Hipotecaria',
    subtipo: 'Departamento',
    descripcion: 'Departamento habitacional de 3 recámaras, 2 baños, 95 m², escritura pública inscrita en RPP, libre de gravamen. Avalúo vigente emitido por perito certificado CNBV.',
    valorNominal: 2_500_000,
    ubicacion: 'Calle Roble #247, Depto. 4B, Col. Jardines del Pedregal, Álvaro Obregón, CDMX',
    estatus: 'Vigente',
  },
]);
saveToSavedStore(9, 'form', {
  ...buildFormFromMock(MOCK_CREDITOS.find(m => m.id === 9)!),
  lineaProducto: 'Crédito',
  sublinea: 'Crédito Hipotecario',
  producto: 'Crédito Simple',
  destinoCredito: 'Adquisición de departamento habitacional con garantía hipotecaria inscrita en RPP. Inmueble ubicado en Col. Jardines del Pedregal, CDMX.',
  periodo: 'Mensual',
  plazos: '240',
  plazoAutorizado: '240',
  tasaAutorizada: '10.50',
  tasaMinima: '9.00',
  tasaMaxima: '13.50',
  tasaAutorizadaTasas: '10.50',
  plazoMinimo: '60',
  plazoMaximo: '360',
  montoMinimo: '500000',
  montoMaximo: '5000000',
  empresaFondeadora: 'Crédito Mx',
  estatusPago: 'Al corriente',
  estatusCartera: 'Vigente',
  moneda: 'MXN',
});

// Override CR-010 — Crédito Quirografario (Crédito Personal con Pagaré)
saveToSavedStore(10, 'form', {
  ...buildFormFromMock(MOCK_CREDITOS.find(m => m.id === 10)!),
  lineaProducto: 'Crédito',
  sublinea: 'Crédito Quirografario',
  producto: 'Crédito Personal',
  destinoCredito: 'Capital de trabajo personal. Crédito quirografario respaldado únicamente con pagaré firmado por el acreditado y aval con obligación solidaria.',
  periodo: 'Mensual',
  plazos: '24',
  plazoAutorizado: '24',
  tasaAutorizada: '22.00',
  tasaMinima: '18.00',
  tasaMaxima: '28.00',
  tasaAutorizadaTasas: '22.00',
  plazoMinimo: '6',
  plazoMaximo: '36',
  montoMinimo: '5000',
  montoMaximo: '300000',
  empresaFondeadora: 'Crédito Mx',
  estatusPago: 'Al corriente',
  estatusCartera: 'Vigente',
  moneda: 'MXN',
});
saveToSavedStore<CreditoGarantia[]>(10, 'garantias', [
  {
    id: 10001,
    tipo: 'Personal',
    subtipo: 'Pagaré',
    descripcion: 'Pagaré quirografario por $150,000.00 firmado por el acreditado ante dos testigos. Vence a la par con la última amortización del crédito. Documento original en resguardo.',
    valorNominal: 150_000,
    ubicacion: 'Resguardo documental — Sucursal CDMX Norte',
    estatus: 'Vigente',
  },
  {
    id: 10002,
    tipo: 'Personal',
    subtipo: 'Aval',
    descripcion: 'Obligado solidario con ingresos verificados $35,000/mes. Sin notas negativas en Buró de Crédito. Firma de contrato de obligación solidaria ante fedatario.',
    valorNominal: 150_000,
    ubicacion: 'Resguardo documental — Sucursal CDMX Norte',
    estatus: 'Vigente',
  },
]);

// Override CR-011 — Crédito Prendario / Vehículo (Crédito Simple con Garantía Auto)
saveToSavedStore(11, 'form', {
  ...buildFormFromMock(MOCK_CREDITOS.find(m => m.id === 11)!),
  lineaProducto: 'Crédito',
  sublinea: 'Crédito Prendario',
  producto: 'Crédito Simple',
  destinoCredito: 'Adquisición de vehículo automotor. Crédito prendario con prenda sin desplazamiento sobre el vehículo financiado, endoso en garantía registrado ante REPUVE.',
  periodo: 'Mensual',
  plazos: '48',
  plazoAutorizado: '48',
  tasaAutorizada: '14.50',
  tasaMinima: '12.00',
  tasaMaxima: '18.00',
  tasaAutorizadaTasas: '14.50',
  plazoMinimo: '12',
  plazoMaximo: '60',
  montoMinimo: '50000',
  montoMaximo: '800000',
  empresaFondeadora: 'Crédito Mx',
  estatusPago: 'Al corriente',
  estatusCartera: 'Vigente',
  moneda: 'MXN',
});
saveToSavedStore<CreditoGarantia[]>(11, 'garantias', [
  {
    id: 11001,
    tipo: 'Prendaria',
    subtipo: 'Automóvil',
    descripcion: 'Vehículo sedán 2023, 4 puertas, transmisión automática, color blanco — prenda sin desplazamiento. Factura original en resguardo. Endoso en garantía registrado ante REPUVE. Seguro todo riesgo vigente con beneficiario endosado a la institución.',
    valorNominal: 420_000,
    ubicacion: 'Estacionamiento del acreditado — Av. Insurgentes Sur 1235, Col. Del Valle, CDMX',
    estatus: 'Vigente',
  },
]);

// Override CR-012 — Scoring Crediticio (Crédito Personal pre-aprobado por score)
saveToSavedStore(12, 'form', {
  ...buildFormFromMock(MOCK_CREDITOS.find(m => m.id === 12)!),
  lineaProducto: 'Crédito',
  sublinea: 'Crédito por Scoring',
  producto: 'Crédito Personal',
  destinoCredito: 'Crédito pre-aprobado otorgado con base en modelo de scoring interno. Calificación crediticia 782/850. Sin garantía real — aprobación fundamentada en historial de pagos, nivel de endeudamiento y capacidad de pago verificada.',
  periodo: 'Mensual',
  plazos: '18',
  plazoAutorizado: '18',
  tasaAutorizada: '19.50',
  tasaMinima: '16.00',
  tasaMaxima: '24.00',
  tasaAutorizadaTasas: '19.50',
  plazoMinimo: '6',
  plazoMaximo: '24',
  montoMinimo: '10000',
  montoMaximo: '150000',
  empresaFondeadora: 'Crédito Mx',
  estatusPago: 'Al corriente',
  estatusCartera: 'Vigente',
  moneda: 'MXN',
});
saveToSavedStore<CreditoGarantia[]>(12, 'garantias', [
  {
    id: 12001,
    tipo: 'Personal',
    subtipo: 'Score Buró de Crédito',
    descripcion: 'Score Buró de Crédito: 782/850. Historial de 7 años sin notas negativas. 4 créditos previos liquidados puntualmente. Nivel de endeudamiento: 28% de ingresos mensuales.',
    valorNominal: 85_000,
    ubicacion: 'Buró de Crédito, S.A. de C.V. — Consulta folio BC-2025-06-0042871',
    estatus: 'Vigente',
  },
  {
    id: 12002,
    tipo: 'Personal',
    subtipo: 'Score Interno',
    descripcion: 'Score interno modelo FICO adaptado: 810/1000. Variables: antigüedad laboral 6 años, ingresos netos $42,000/mes, relación deuda-ingreso 0.28, domicilio estable 4 años. Aprobación automática nivel A.',
    valorNominal: 85_000,
    ubicacion: 'Sistema de Originación Digital — Expediente SOD-2025-CLI001-0612',
    estatus: 'Vigente',
  },
  {
    id: 12003,
    tipo: 'Personal',
    subtipo: 'Capacidad de Pago',
    descripcion: 'Análisis de capacidad de pago: ingresos comprobables $42,000/mes, egresos fijos $18,500/mes, excedente disponible $23,500/mes. Pago mensual estimado $5,200 representa el 12.4% del ingreso neto.',
    valorNominal: 0,
    ubicacion: 'Expediente digital — Área de Análisis de Crédito CDMX',
    estatus: 'Vigente',
  },
]);

// ═══════════════════════════════════════════════════════════════════
// GENERAR CRÉDITO DESDE SOLICITUD
// ═══════════════════════════════════════════════════════════════════

export interface CreditoGenerado {
  listItem: CreditoListItem;
  noCredito: string;
  creditoId: number;
}

/**
 * Construye un SolFormData a partir de los datos mínimos del listado,
 * para solicitudes que no tienen MOCK_FORMS (3-8).
 */
function buildSolFormFromListItem(sol: {
  id: number; noSolicitud: string; cliente: string;
  fechaSolicitud: string; montoSolicitado: number; montoAutorizado: number;
  sublinea: string; producto: string; sucursal: string;
  estatusSolicitud: string;
}): SolFormData {
  // Build a new-shape SolicitudFormData from minimal list data
  const nameParts = sol.cliente.replace(/^CLI-\d+-/, '').split(' ');
  return {
    ...SOL_EMPTY,
    id: String(sol.id),
    noSol: sol.noSolicitud,
    lineaProducto: 'Crédito',
    tipoProducto: sol.sublinea || sol.producto || '',
    tipoPersona: 'Física',
    nombrePersona: nameParts[0] || sol.cliente,
    apellidoPaternoPersona: nameParts[1] || '',
    apellidoMaternoPersona: nameParts.slice(2).join(' ') || '',
    productoId: '',
    nombreProducto: sol.producto || '',
    fechaSolicitud: sol.fechaSolicitud,
    descripcion: '',
    faseId: '5',
    descripcionFase: 'Fase 5 — Desembolso',
    estatusSolicitud: sol.estatusSolicitud,
    sucursal: sol.sucursal,
    montoSolicitado: sol.montoSolicitado.toFixed(2),
    montoAutorizado: sol.montoAutorizado.toFixed(2),
  };
}

/**
 * Genera un Crédito completo a partir de una Solicitud de Crédito aprobada.
 * - Copia todos los datos del formulario
 * - Copia todos los subtabs (expedientes, autorizaciones, garantías, cargos, avisos)
 * - Genera tabla de amortizaciones con cálculo financiero real
 * - Inicializa solicitudes extraordinarias vacías
 * - Registra la solicitud origen
 */
export function createCreditoFromSolicitud(
  solicitudId: number,
  solicitudListItem: {
    id: number; noSolicitud: string; cliente: string;
    fechaSolicitud: string; montoSolicitado: number; montoAutorizado: number;
    sublinea: string; producto: string; sucursal: string;
    estatusSolicitud: string;
  },
): CreditoGenerado {
  // ── 1. Cargar formulario completo de la solicitud ──
  const solForm: SolFormData =
    loadSolSaved<SolFormData>(solicitudId, 'form')
    || SOL_MOCK_FORMS[solicitudId]
    || buildSolFormFromListItem(solicitudListItem);

  // ── 2. Generar IDs del crédito ──
  const noCredito = consumeCreditoId();
  const creditoId = generateId();

  // Extraer nombre completo del cliente desde la nueva SolicitudFormData
  const clienteStr = `${solForm.nombrePersona || ''} ${solForm.apellidoPaternoPersona || ''} ${solForm.apellidoMaternoPersona || ''}`.trim()
    || solicitudListItem.cliente || '';
  // Intentar mapear a código CLI-00X
  const noCliente = solicitudListItem.cliente?.match(/CLI-(\d+)/)?.[0]
    || solicitudListItem.cliente?.split('-')[0]?.trim() || '';

  // ── 3. Mapear nueva SolicitudFormData → CreditoFormData ──
  // Los campos que ya no existen en la nueva SolicitudFormData se llenan con defaults
  const sf = solForm as any; // safe fallback for legacy field access
  const creditoForm: CreditoFormData = {
    noCredito,
    cliente: clienteStr,
    noCliente,
    fechaCredito: (solForm.fechaSolicitud || '').split(' ')[0], // remove time part
    empresaFondeadora: sf.empresaFondeadora || 'Crédito Mx',
    sucursal: solForm.sucursal,
    montoSolicitado: solForm.montoSolicitado,
    lineaProducto: solForm.lineaProducto || 'Crédito',
    sublinea: solForm.tipoProducto || sf.sublinea || solicitudListItem.sublinea || '',
    producto: solForm.nombreProducto || sf.producto || solicitudListItem.producto || '',
    periodo: sf.periodo || 'Mensual',
    plazos: sf.plazos || '7-12',
    destinoCredito: sf.destinoCredito || '',
    estatusPago: 'Al corriente',
    estatusCartera: 'Vigente',
    estatusCredito: 'Autorizado',
    plazoAutorizado: sf.plazoAutorizado || '12',
    montoAutorizado: solForm.montoAutorizado || solForm.montoSolicitado,
    tasaAutorizada: sf.tasaAutorizada || '15.5000',
    fechaInicio: sf.fechaInicio || (solForm.fechaSolicitud || '').split(' ')[0],
    fechaFin: sf.fechaFin || '',
    estatusSIC: CLIENT_DETAIL_MAP[noCliente]?.estatusSIC || 'Positivo',
    estatusListaNegra: CLIENT_DETAIL_MAP[noCliente]?.estatusListaNegra || 'Negativo',
    estatusCliente: CLIENT_DETAIL_MAP[noCliente]?.estatusCliente || 'Activo',
    moneda: sf.moneda || 'MXN',
    direccionPrincipal: CLIENT_DETAIL_MAP[noCliente]?.direccionPrincipal || '',
    plazoMinimo: sf.plazoMinimo || '6',
    plazoMaximo: sf.plazoMaximo || '60',
    montoMinimo: sf.montoMinimo || '1000',
    montoMaximo: sf.montoMaximo || '500000',
    tasaMinima: sf.tasaMinima || '8.00',
    tasaMaxima: sf.tasaMaxima || '36.00',
    tasaAutorizadaTasas: sf.tasaAutorizadaTasas || sf.tasaAutorizada || '15.5000',
  };

  // Guardar formulario
  saveToSavedStore(creditoId, 'form', creditoForm);

  // ── 4. Copiar subtabs de la solicitud ──
  const solExp = loadSolSaved<SolExp[]>(solicitudId, 'expedientes') || SOL_MOCK_EXP[solicitudId] || [];
  const solAut = loadSolSaved<SolAut[]>(solicitudId, 'autorizaciones') || SOL_MOCK_AUT[solicitudId] || [];
  const solGar = loadSolSaved<SolGar[]>(solicitudId, 'garantias') || SOL_MOCK_GAR[solicitudId] || [];
  const solCar = loadSolSaved<SolCargo[]>(solicitudId, 'cargos') || SOL_MOCK_CAR[solicitudId] || [];
  const solAvi = loadSolSaved<SolAviso[]>(solicitudId, 'avisos') || SOL_MOCK_AVI[solicitudId] || [];

  // Expedientes → copiar con nuevos IDs
  const crExpedientes: CreditoExpediente[] = solExp.map(e => ({
    id: generateId(), fechaHora: e.fechaHora, usuario: e.usuario,
    tipoDocumento: e.tipoDocumento, archivo: e.archivo,
    descripcion: e.descripcion, estatus: e.estatus,
    observaciones: e.observaciones, fileData: e.fileData,
  }));
  saveToSavedStore(creditoId, 'expedientes', crExpedientes);

  // Autorizaciones → copiar con nuevos IDs
  const crAutorizaciones: CreditoAutorizacion[] = solAut.map(a => ({
    id: generateId(), fechaHora: a.fechaHora, usuario: a.usuario,
    area: a.area, descripcion: a.descripcion,
    observaciones: a.observaciones, estatus: a.estatus,
  }));
  saveToSavedStore(creditoId, 'autorizaciones', crAutorizaciones);

  // Garantías → copiar con nuevos IDs
  const crGarantias: CreditoGarantia[] = solGar.map(g => ({
    id: generateId(), tipo: g.tipo, subtipo: g.subtipo,
    descripcion: g.descripcion, valorNominal: g.valorNominal,
    ubicacion: g.ubicacion, estatus: g.estatus,
  }));
  saveToSavedStore(creditoId, 'garantias', crGarantias);

  // Cargos → copiar con nuevos IDs
  const crCargos: CreditoCargo[] = solCar.map(c => ({
    id: generateId(), tipoCargo: c.tipoCargo, descripcion: c.descripcion,
    monto: c.monto, fechaCargo: c.fechaCargo,
    estatus: c.estatus, notas: c.notas,
  }));
  saveToSavedStore(creditoId, 'cargos', crCargos);

  // Avisos → copiar con nuevos IDs
  const crAvisos: CreditoAviso[] = solAvi.map(a => ({
    id: generateId(), tipo: a.tipo, mensaje: a.mensaje,
    fechaCreacion: a.fechaCreacion, fechaVencimiento: a.fechaVencimiento,
    destinatario: a.destinatario, estatus: a.estatus,
  }));
  saveToSavedStore(creditoId, 'avisos', crAvisos);

  // ── 5. Generar tabla de amortización ──
  const monto = parseFloat(parseCurrency(creditoForm.montoAutorizado || creditoForm.montoSolicitado || '0')) || 0;
  const tasa = parseFloat((creditoForm.tasaAutorizada || creditoForm.tasaAutorizadaTasas || '0').replace(/[^0-9.]/g, '')) || 0;
  const plazo = parseInt(creditoForm.plazoAutorizado || '12') || 12;

  if (monto > 0) {
    const tasaMensual = tasa / 100 / 12;
    const pago = tasaMensual > 0
      ? monto * (tasaMensual * Math.pow(1 + tasaMensual, plazo)) / (Math.pow(1 + tasaMensual, plazo) - 1)
      : monto / plazo;
    const amortRows: AmortizacionRow[] = [];
    let saldo = monto;
    // Parsear fecha de inicio para las fechas de pago
    const parts = (creditoForm.fechaInicio || '').split('/');
    const hoy = parts.length === 3
      ? new Date(parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      : new Date();
    for (let i = 1; i <= plazo; i++) {
      const interes = saldo * tasaMensual;
      const capital = pago - interes;
      const ivaInteres = interes * 0.16;
      saldo = Math.max(0, saldo - capital);
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, hoy.getDate());
      amortRows.push({
        noPago: i,
        fechaPago: `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}/${fecha.getFullYear()}`,
        capital: +capital.toFixed(2),
        interes: +interes.toFixed(2),
        ivaInteres: +ivaInteres.toFixed(2),
        pagoTotal: +(pago + ivaInteres).toFixed(2),
        saldoInsoluto: +saldo.toFixed(2),
      });
    }
    saveToSavedStore(creditoId, 'amortizaciones', amortRows);
  }

  // ── 6. Inicializar solicitudes extraordinarias (vacío pero funcional) ──
  saveToSavedStore(creditoId, 'solicitudes_extra', []);

  // ── 7. Guardar referencia a la solicitud origen ──
  saveToSavedStore(creditoId, 'solicitud_origen', {
    solicitudId,
    noSolicitud: solForm.noSol || solicitudListItem.noSolicitud,
  });

  // ── 8. Crear el registro para la lista maestra ──
  const montoSol = parseFloat(parseCurrency(creditoForm.montoSolicitado || '0')) || 0;
  const montoAut = parseFloat(parseCurrency(creditoForm.montoAutorizado || '0')) || 0;
  const fmtDt = (d: string) => {
    if (!d) return '';
    const p = d.split('/');
    if (p.length !== 3) return d;
    return p[2].length <= 2 ? d : `${p[0]}/${p[1]}/${p[2].slice(-2)}`;
  };

  const listItem: CreditoListItem = {
    id: creditoId,
    noCredito,
    noCliente,
    cliente: creditoForm.cliente,
    fechaCredito: fmtDt(creditoForm.fechaCredito),
    montoSolicitado: montoSol,
    montoAutorizado: montoAut,
    lineaProducto: creditoForm.lineaProducto,
    sublinea: creditoForm.sublinea,
    producto: creditoForm.producto,
    sucursal: creditoForm.sucursal,
    estatusCredito: 'Autorizado',
    fechaInicio: fmtDt(creditoForm.fechaInicio),
    fechaFin: fmtDt(creditoForm.fechaFin),
  };

  // Agregar a la lista maestra para que CreditosModule lo vea al montar
  MOCK_CREDITOS.unshift(listItem);

  return { listItem, noCredito, creditoId };
}