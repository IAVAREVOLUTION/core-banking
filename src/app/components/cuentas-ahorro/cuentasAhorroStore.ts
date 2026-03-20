// ============================================================
// Store centralizado para Cuentas de Ahorro
// Persistencia via sessionStorage con clave: cta_ahorro_{id}_{subtab}
// ============================================================

// ---- Tipos ----
export interface CuentaAhorroFormData {
  registroId: string;
  cliente: string;
  fechaApertura: string; // yyyy-MM-dd para input[type=date]
  saldoInicial: string;
  moneda: string;
  sucursal: string;
  lineaProducto: string;
  sublinea: string;
  producto: string;
  tipoTasa: string;
  plazos: string;
  numeroCuenta: string;
  tasaRendimiento: string;
  saldoMinimoPromedio: string;
  estatus: string;
  cuentaEje: boolean;
  fechaCorte: string; // yyyy-MM-dd
  saldoActual: string;
}

export interface Beneficiario {
  id: number;
  claveCliente: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  parentesco: string;
  porcentaje: number;
  notas: string;
  validacion: boolean;
}

export interface CoTitular {
  id: number;
  claveCliente: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  parentesco: string;
  porcentaje: number;
  notas: string;
  validado: boolean;
}

export interface InteresDiario {
  id: number;
  fecha: string;
  saldoDia: number;
  tasaAnual: number;
  interesDiario: number;
  diasTranscurridos: number;
  interesAcumulado: number;
}

export interface RendimientoPeriodo {
  id: number;
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  saldoPromedio: number;
  tasaAplicada: number;
  rendimientoBruto: number;
  impuesto: number;
  rendimientoNeto: number;
}

export interface Impuesto {
  id: number;
  concepto: string;
  periodo: string;
  base: number;
  tasa: number;
  impuestoRetenido: number;
  fechaRetencion: string;
  estatus: string;
}

export interface Movimiento {
  id: number;
  fecha: string;
  concepto: string;
  referencia: string;
  tipo: 'Cargo' | 'Abono';
  monto: number;
  saldoResultante: number;
}

export interface Cargo {
  id: number;
  concepto: string;
  descripcion: string;
  monto: number;
  fechaCargo: string;
  fechaAplicacion: string;
  periodicidad: string;
  estatus: string;
}

export interface Bloqueo {
  id: number;
  tipoBloqueo: string;
  motivo: string;
  fechaInicio: string;
  fechaFin: string;
  estatus: string;
}

export interface SolicitudExtraordinaria {
  id: number;
  numeroCuenta: string;
  productoFinanciero: string;
  areaSolicito: string;
  puestoTrabajo: string;
  solicitudExtraordinaria: string;
  areaAutorizo: string;
  observaciones: string;
  estatus: string;
}

// ---- Helpers de persistencia ----
function storageKey(accountId: number | 'new', subtab: string): string {
  return `cta_ahorro_${accountId}_${subtab}`;
}

export function saveToSession<T>(accountId: number | 'new', subtab: string, data: T): void {
  try {
    sessionStorage.setItem(storageKey(accountId, subtab), JSON.stringify(data));
  } catch { /* silently fail if storage full */ }
}

export function loadFromSession<T>(accountId: number | 'new', subtab: string): T | null {
  try {
    const raw = sessionStorage.getItem(storageKey(accountId, subtab));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSession(accountId: number | 'new'): void {
  const prefix = `cta_ahorro_${accountId}_`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k));
}

// ---- Helpers de formato ----
export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num)) return '$ 0.00';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(num);
}

export function parseCurrency(formatted: string): string {
  return formatted.replace(/[^0-9.-]/g, '');
}

export function formatPercent(value: number): string {
  return `${value.toFixed(4)}%`;
}

export function parsePercent(formatted: string): number {
  const num = parseFloat(formatted.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
}

export function toISODate(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return ddmmyyyy;
}

export function fromISODate(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
}

// ---- Generador de N de cuenta ----
let accountCounter = 3;
export function generateAccountNumber(): string {
  const base = 315746709150 + accountCounter++;
  return base.toString();
}

export function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

// Generador incremental de N° Registro
let _nextRegistro = 3; // next after 001 and 002
export function getNextRegistroId(): string {
  return String(_nextRegistro).padStart(3, '0');
}
export function consumeRegistroId(): string {
  const id = String(_nextRegistro).padStart(3, '0');
  _nextRegistro++;
  return id;
}

// ---- Mock data por cuenta (solo para modo editar/ver) ----
export const EMPTY_FORM: CuentaAhorroFormData = {
  registroId: 'Auto',
  cliente: '',
  fechaApertura: '',
  saldoInicial: '',
  moneda: 'MXN',
  sucursal: '',
  lineaProducto: '',
  sublinea: '',
  producto: '',
  tipoTasa: '',
  plazos: '',
  numeroCuenta: '',
  tasaRendimiento: '',
  saldoMinimoPromedio: '',
  estatus: 'Pendiente',
  cuentaEje: false,
  fechaCorte: '',
  saldoActual: '',
};

export const MOCK_FORMS: Record<number, CuentaAhorroFormData> = {
  1: {
    registroId: '001',
    cliente: '001 - Juan Perez Perez',
    fechaApertura: '2023-08-08',
    saldoInicial: '1400',
    moneda: 'MXN',
    sucursal: 'CDMX',
    lineaProducto: 'Cuenta de Ahorro',
    sublinea: 'Cuenta de ahorro para empresarios',
    producto: 'Cuenta de ahorro para negocio',
    tipoTasa: 'Tasa fija',
    plazos: '12',
    numeroCuenta: '315746709152',
    tasaRendimiento: '4.0000',
    saldoMinimoPromedio: '100000',
    estatus: 'Activo',
    cuentaEje: false,
    fechaCorte: '2023-08-12',
    saldoActual: '2400',
  },
  2: {
    registroId: '002',
    cliente: '002 - Maria Gonzalez',
    fechaApertura: '2023-09-10',
    saldoInicial: '5000',
    moneda: 'MXN',
    sucursal: 'CDMX',
    lineaProducto: 'Cuenta de Ahorro',
    sublinea: 'Cuenta de ahorro basica',
    producto: 'Cuenta de ahorro basica',
    tipoTasa: 'Tasa fija',
    plazos: '6',
    numeroCuenta: '315746709153',
    tasaRendimiento: '3.5000',
    saldoMinimoPromedio: '50000',
    estatus: 'Activo',
    cuentaEje: true,
    fechaCorte: '2023-09-15',
    saldoActual: '5200',
  },
};

export const MOCK_BENEFICIARIOS: Record<number, Beneficiario[]> = {
  1: [
    { id: 101, claveCliente: 'CLI-0016', nombre: 'Sofia', apellidoPaterno: 'Perez', apellidoMaterno: 'Perez', fechaNacimiento: '1980-06-18', parentesco: 'Hermano', porcentaje: 30, notas: '', validacion: true },
    { id: 102, claveCliente: 'CLI-0013', nombre: 'Dulce', apellidoPaterno: 'Fernandez', apellidoMaterno: 'Solis', fechaNacimiento: '1970-12-10', parentesco: 'Esposo/a', porcentaje: 70, notas: 'Beneficiaria principal', validacion: true },
  ],
  2: [
    { id: 201, claveCliente: 'CLI-0015', nombre: 'Sofia', apellidoPaterno: 'Reyes', apellidoMaterno: 'Lopez', fechaNacimiento: '1995-09-29', parentesco: 'Hijo/a', porcentaje: 100, notas: '', validacion: true },
  ],
};

export const MOCK_COTITULARES: Record<number, CoTitular[]> = {
  1: [
    { id: 101, claveCliente: 'CLI-0012', nombre: 'Maria', apellidoPaterno: 'Lopez', apellidoMaterno: 'Garcia', fechaNacimiento: '1985-03-15', parentesco: 'Esposo/a', porcentaje: 50, notas: '', validado: true },
  ],
  2: [],
};

export const MOCK_INTERESES: Record<number, InteresDiario[]> = {
  1: [
    { id: 101, fecha: '2023-08-08', saldoDia: 1400, tasaAnual: 4.0, interesDiario: 0.15, diasTranscurridos: 1, interesAcumulado: 0.15 },
    { id: 102, fecha: '2023-08-09', saldoDia: 1400, tasaAnual: 4.0, interesDiario: 0.15, diasTranscurridos: 2, interesAcumulado: 0.30 },
    { id: 103, fecha: '2023-08-10', saldoDia: 2400, tasaAnual: 4.0, interesDiario: 0.26, diasTranscurridos: 3, interesAcumulado: 0.56 },
  ],
  2: [
    { id: 201, fecha: '2023-09-10', saldoDia: 5000, tasaAnual: 3.5, interesDiario: 0.48, diasTranscurridos: 1, interesAcumulado: 0.48 },
    { id: 202, fecha: '2023-09-11', saldoDia: 5200, tasaAnual: 3.5, interesDiario: 0.50, diasTranscurridos: 2, interesAcumulado: 0.98 },
  ],
};

export const MOCK_RENDIMIENTOS: Record<number, RendimientoPeriodo[]> = {
  1: [
    { id: 101, periodo: 'Agosto 2023', fechaInicio: '2023-08-01', fechaFin: '2023-08-31', saldoPromedio: 1900, tasaAplicada: 4.0, rendimientoBruto: 6.33, impuesto: 0.95, rendimientoNeto: 5.38 },
    { id: 102, periodo: 'Septiembre 2023', fechaInicio: '2023-09-01', fechaFin: '2023-09-30', saldoPromedio: 2400, tasaAplicada: 4.0, rendimientoBruto: 7.89, impuesto: 1.18, rendimientoNeto: 6.71 },
  ],
  2: [
    { id: 201, periodo: 'Septiembre 2023', fechaInicio: '2023-09-10', fechaFin: '2023-09-30', saldoPromedio: 5100, tasaAplicada: 3.5, rendimientoBruto: 10.25, impuesto: 1.54, rendimientoNeto: 8.71 },
  ],
};

export const MOCK_IMPUESTOS: Record<number, Impuesto[]> = {
  1: [
    { id: 101, concepto: 'ISR Intereses', periodo: 'Agosto 2023', base: 6.33, tasa: 15, impuestoRetenido: 0.95, fechaRetencion: '2023-08-31', estatus: 'Retenido' },
  ],
  2: [
    { id: 201, concepto: 'ISR Intereses', periodo: 'Septiembre 2023', base: 10.25, tasa: 15, impuestoRetenido: 1.54, fechaRetencion: '2023-09-30', estatus: 'Retenido' },
  ],
};

export const MOCK_MOVIMIENTOS: Record<number, Movimiento[]> = {
  1: [
    { id: 101, fecha: '2023-08-08', concepto: 'Deposito inicial', referencia: 'DEP-001', tipo: 'Abono', monto: 1400, saldoResultante: 1400 },
    { id: 102, fecha: '2023-08-10', concepto: 'Transferencia recibida', referencia: 'TRF-012', tipo: 'Abono', monto: 1000, saldoResultante: 2400 },
    { id: 103, fecha: '2023-08-15', concepto: 'Comision mensual', referencia: 'COM-001', tipo: 'Cargo', monto: 50, saldoResultante: 2350 },
  ],
  2: [
    { id: 201, fecha: '2023-09-10', concepto: 'Deposito inicial', referencia: 'DEP-002', tipo: 'Abono', monto: 5000, saldoResultante: 5000 },
    { id: 202, fecha: '2023-09-15', concepto: 'Rendimiento abonado', referencia: 'REN-001', tipo: 'Abono', monto: 200, saldoResultante: 5200 },
  ],
};

export const MOCK_CARGOS: Record<number, Cargo[]> = {
  1: [
    { id: 101, concepto: 'Comision por manejo de cuenta', descripcion: 'Cargo mensual por mantenimiento', monto: 50, fechaCargo: '2023-08-15', fechaAplicacion: '2023-08-15', periodicidad: 'Mensual', estatus: 'Aplicado' },
  ],
  2: [],
};

export const MOCK_BLOQUEOS: Record<number, Bloqueo[]> = {
  1: [],
  2: [
    { id: 201, tipoBloqueo: 'Preventivo', motivo: 'Revision por prevencion de lavado de dinero', fechaInicio: '2023-10-01', fechaFin: '', estatus: 'Activo' },
  ],
};

export const MOCK_SOLICITUDES: Record<number, SolicitudExtraordinaria[]> = {
  1: [
    { id: 101, numeroCuenta: '315746709152', productoFinanciero: 'Cuenta de ahorro para negocio', areaSolicito: 'Depto de RRHH', puestoTrabajo: 'Gerente de Recursos Humanos', solicitudExtraordinaria: 'Bloqueo y descongelamiento de cuenta', areaAutorizo: 'Departamento de Mercados y Finanzas', observaciones: 'Solicitud aprobada sin observaciones', estatus: 'Autorizado' },
  ],
  2: [],
};

// Catálogos institucionales
export const CATALOGO_CLIENTES = [
  { value: '001 - Juan Perez Perez', label: '001 - Juan Perez Perez' },
  { value: '002 - Maria Gonzalez', label: '002 - Maria Gonzalez' },
  { value: '003 - Carlos Rodriguez', label: '003 - Carlos Rodriguez' },
  { value: '004 - Ana Martinez', label: '004 - Ana Martinez' },
];

export const CATALOGO_LINEA_PRODUCTO = [
  { value: 'Cuenta de Ahorro', label: 'Cuenta de Ahorro' },
];

export const CATALOGO_SUBLINEA = [
  { value: 'Cuenta de ahorro para empresarios', label: 'Cuenta de ahorro para empresarios' },
  { value: 'Cuenta de ahorro basica', label: 'Cuenta de ahorro basica' },
  { value: 'Cuenta de ahorro infantil', label: 'Cuenta de ahorro infantil' },
];

export const CATALOGO_PRODUCTO = [
  { value: 'Cuenta de ahorro para negocio', label: 'Cuenta de ahorro para negocio' },
  { value: 'Cuenta de ahorro basica', label: 'Cuenta de ahorro basica' },
  { value: 'Cuenta de ahorro infantil', label: 'Cuenta de ahorro infantil' },
];

export const CATALOGO_TIPO_TASA = [
  { value: 'Tasa fija', label: 'Tasa fija' },
  { value: 'Tasa variable', label: 'Tasa variable' },
];

export const CATALOGO_PLAZOS = [
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
  { value: '24', label: '24 meses' },
  { value: '36', label: '36 meses' },
];

export const CATALOGO_ESTATUS_CUENTA = [
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'Activo', label: 'Activo' },
  { value: 'Inactivo', label: 'Inactivo' },
  { value: 'Cancelado', label: 'Cancelado' },
];

export const CATALOGO_MONEDA = [
  { value: 'MXN', label: 'MXN - Peso Mexicano' },
  { value: 'USD', label: 'USD - Dolar Americano' },
];

export const CATALOGO_SUCURSAL = [
  { value: 'CDMX', label: 'CDMX' },
  { value: 'Guadalajara', label: 'Guadalajara' },
  { value: 'Monterrey', label: 'Monterrey' },
];

export const CATALOGO_PARENTESCO = [
  { value: 'Esposo/a', label: 'Esposo/a' },
  { value: 'Hermano', label: 'Hermano' },
  { value: 'Hijo/a', label: 'Hijo/a' },
  { value: 'Padre/Madre', label: 'Padre/Madre' },
  { value: 'Controladora', label: 'Controladora' },
  { value: 'PRR', label: 'PRR' },
  { value: 'Subsidiaria', label: 'Subsidiaria' },
  { value: 'Accionista', label: 'Accionista' },
  { value: 'Socio', label: 'Socio' },
];

export const CATALOGO_TIPO_BLOQUEO = [
  { value: 'Preventivo', label: 'Preventivo' },
  { value: 'Judicial', label: 'Judicial' },
  { value: 'Administrativo', label: 'Administrativo' },
  { value: 'Por mora', label: 'Por mora' },
];

export const CATALOGO_ESTATUS_BLOQUEO = [
  { value: 'Activo', label: 'Activo' },
  { value: 'Liberado', label: 'Liberado' },
  { value: 'Vencido', label: 'Vencido' },
];

export const CATALOGO_PERIODICIDAD = [
  { value: 'Mensual', label: 'Mensual' },
  { value: 'Bimestral', label: 'Bimestral' },
  { value: 'Trimestral', label: 'Trimestral' },
  { value: 'Semestral', label: 'Semestral' },
  { value: 'Anual', label: 'Anual' },
  { value: 'Unico', label: 'Unico' },
];

export const CATALOGO_ESTATUS_CARGO = [
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'Aplicado', label: 'Aplicado' },
  { value: 'Cancelado', label: 'Cancelado' },
];

export const CATALOGO_ESTATUS_IMPUESTO = [
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'Retenido', label: 'Retenido' },
  { value: 'Enterado', label: 'Enterado' },
];

export const CATALOGO_SOLICITUD_EXTRAORDINARIA = [
  { value: 'Bloqueo y descongelamiento de cuenta', label: 'Bloqueo y descongelamiento de cuenta' },
  { value: 'Reversion', label: 'Reversion' },
  { value: 'Ajuste', label: 'Ajuste' },
  { value: 'Otro', label: 'Otro' },
];

export const CATALOGO_ESTATUS_SOLICITUD = [
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'Autorizado', label: 'Autorizado' },
  { value: 'Rechazado', label: 'Rechazado' },
];

export const CATALOGO_BUSQUEDA_CLIENTES = [
  { clave: 'CLI-0011', rfc: 'PPAM29F3F37', nombre: 'Marta Lopez Perez', personalidad: 'Persona Fisica', fechaNacimiento: '1997-10-02', estatus: 'Activo' },
  { clave: 'CLI-0012', rfc: 'FLY9650505M2M', nombre: 'IMBURSA S.A. DE C.V.', personalidad: 'Persona Moral', fechaNacimiento: '1987-02-08', estatus: 'Activo' },
  { clave: 'CLI-0013', rfc: 'FLY9650505M2M', nombre: 'Dulce Fernandez Solis', personalidad: 'Persona Fisica', fechaNacimiento: '1970-12-10', estatus: 'Activo' },
  { clave: 'CLI-0014', rfc: 'MCH102809F37', nombre: 'Manuel Cruz Hernandez', personalidad: 'Persona Fisica', fechaNacimiento: '1997-10-08', estatus: 'Activo' },
  { clave: 'CLI-0015', rfc: 'RLSA950923F37', nombre: 'Sofia Reyes Lopez', personalidad: 'Persona Fisica', fechaNacimiento: '1995-09-29', estatus: 'Activo' },
  { clave: 'CLI-0016', rfc: 'PRPE4708F37', nombre: 'Sofia Reyes Perez', personalidad: 'Persona Fisica', fechaNacimiento: '1989-08-13', estatus: 'Activo' },
];