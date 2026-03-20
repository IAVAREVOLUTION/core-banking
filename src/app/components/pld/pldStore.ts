// ═══════════════════════════════════════════════════════════════════
// STORE — Módulo PLD (persistencia sessionStorage)
// ═══════════════════════════════════════════════════════════════════

const KEYS = {
  alertas: 'pld_alertas',
  alertasInternas: 'pld_alertas_internas',
  perfiles: 'pld_perfiles',
  kyc: 'pld_kyc',
  kycClientes: 'pld_kyc_clientes',
  parametros: 'pld_parametros',
  reportes: 'pld_reportes',
  catalogos: 'pld_catalogos',
  calificacion: 'pld_calificacion',
  calificaciones: 'pld_calificaciones',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save<T>(key: string, data: T) {
  sessionStorage.setItem(key, JSON.stringify(data));
}

// ═══════════════════════════════════════════════════════════════════
// TIPOS LOCALES
// ═══════════════════════════════════════════════════════════════════
export interface AlertaPLD {
  id: number;
  noAlerta: string;
  fechaCreacion: string;
  cliente: string;
  tipoAlerta: string;
  estatus: string;
  usuarioAsignado: string;
  resultado: string;
  enviadoCNBV: string;
  monto: string;
  descripcion: string;
}

export interface AlertaInterna {
  id: number;
  noAlerta: string;
  fecha: string;
  cliente: string;
  tipo: string;
  estatus: string;
  descripcion: string;
  resultado: string;
}

export interface PerfilTransaccional {
  id: number;
  clienteId?: number;
  clienteNombre?: string;
  clienteRFC?: string;
  sublinea: string;
  producto: string;
  numTransRetiro: string;
  numTransDeposito: string;
  montoMaxRetiros: string;
  montoMaxDepositos: string;
  periodo: string;
  fechaRegistro?: string;
  estatus?: 'Activo' | 'Inactivo';
}

export interface KYCData {
  clienteId?: number;
  clienteNombre?: string;
  clienteRFC?: string;
  clienteCURP?: string;
  clientePersonalidad?: string;
  clienteSucursal?: string;
  estatusKYC?: 'Pendiente' | 'En Proceso' | 'Completo' | 'Vencido';
  fechaUltimaRevision?: string;
  esPEP: boolean;
  numeroSalarios: string;
  conyugeFamiliarPEP: boolean;
  listasNegras: string;
  actividadIngresos: string;
  resultadoCoincidencias: boolean;
  aprobadoOficial: boolean;
  fechaCalificacion: string;
  noCalculado: string;
  ingresoMensual: string;
  actividadEconomica: string;
  funcionariosPublicos: boolean;
  percibeOtrosIngresos: boolean;
  calificacionPonderada: string;
  nivelRiesgo: string;
}

export interface ParametrosPLD {
  factorRiesgo: string;
  montoMaxOperacionUSD: string;
  montoMaxPersonaFisica: string;
  montoMaxPersonaMoral: string;
  aplicaPersonaFisica: string;
  aplicaPersonaMoral: string;
  sujetoObligado: string;
  organoSupervisor: string;
  diasActualizacionKYC: string;
  porcentajeDesviacion: string;
  diasRetencion: string;
  alertasAutomaticas: boolean;
  envioAutomaticoCNBV: boolean;
}

export interface CalificacionData {
  clienteId?: number;
  noCliente: string;
  nombreCliente: string;
  clienteRFC?: string;
  clientePersonalidad?: string;
  clienteSucursal?: string;
  fechaCalificacion?: string;
  actividadEconomica: number;
  residencia: number;
  nacionalidad: number;
  tipoPersona: number;
  pepListasNegras: number;
  calificacionTotal: number;
  nivelRiesgo: string;
}

export interface ReporteCNBV {
  id: number;
  folio: string;
  fecha: string;
  tipo: string;
  cliente: string;
  monto: string;
  estatus: string;
  enviado: string;
}

// ═══════════════════════════════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════════════════════════════
const SEED_ALERTAS: AlertaPLD[] = [
  { id: 1, noAlerta: 'ALR-001', fechaCreacion: '15/01/2026', cliente: 'Juan Pérez García', tipoAlerta: 'Relevante', estatus: 'En Análisis', usuarioAsignado: 'Ana Martínez', resultado: 'En proceso', enviadoCNBV: 'No', monto: '$125,000.00', descripcion: 'Depósito en efectivo excede perfil' },
  { id: 2, noAlerta: 'ALR-002', fechaCreacion: '14/01/2026', cliente: 'COMERCIAL XYZ S.A.', tipoAlerta: 'Inusual', estatus: 'Pendiente', usuarioAsignado: 'Carlos Ramírez', resultado: 'Pendiente', enviadoCNBV: 'No', monto: '$85,400.00', descripcion: 'Transferencia internacional no habitual' },
  { id: 3, noAlerta: 'ALR-003', fechaCreacion: '13/01/2026', cliente: 'María López Sánchez', tipoAlerta: 'Preocupante', estatus: 'En Análisis', usuarioAsignado: 'Luis Hernández', resultado: 'En revisión profunda', enviadoCNBV: 'No', monto: '$45,200.00', descripcion: 'Retiros frecuentes en efectivo' },
  { id: 4, noAlerta: 'ALR-004', fechaCreacion: '12/01/2026', cliente: 'IMPORTADORA ABC', tipoAlerta: 'Relevante', estatus: 'Atendida', usuarioAsignado: 'Patricia Torres', resultado: 'Reportado a CNBV', enviadoCNBV: 'Sí', monto: '$210,000.00', descripcion: 'Operación relevante detectada' },
  { id: 5, noAlerta: 'ALR-005', fechaCreacion: '11/01/2026', cliente: 'Carlos Ramírez Ávila', tipoAlerta: 'Inusual', estatus: 'Atendida', usuarioAsignado: 'Jorge Mendoza', resultado: 'Sin hallazgos', enviadoCNBV: 'No', monto: '$32,100.00', descripcion: 'Cambio en patrón transaccional' },
  { id: 6, noAlerta: 'ALR-006', fechaCreacion: '10/01/2026', cliente: 'DISTRIBUIDORA DEL SUR', tipoAlerta: 'Relevante', estatus: 'Enviada', usuarioAsignado: 'Gabriela Núñez', resultado: 'Reportado', enviadoCNBV: 'Sí', monto: '$95,600.00', descripcion: 'Depósito recurrente en efectivo' },
  { id: 7, noAlerta: 'ALR-007', fechaCreacion: '09/01/2026', cliente: 'Sofía Morales Díaz', tipoAlerta: 'Preocupante', estatus: 'En Análisis', usuarioAsignado: 'Ricardo Ortiz', resultado: 'Investigación profunda', enviadoCNBV: 'No', monto: '$178,000.00', descripcion: 'Operaciones con países de alto riesgo' },
  { id: 8, noAlerta: 'ALR-008', fechaCreacion: '08/01/2026', cliente: 'Fernando Castro Ruiz', tipoAlerta: 'Inusual', estatus: 'Pendiente', usuarioAsignado: 'Daniela Vargas', resultado: 'Pendiente', enviadoCNBV: 'No', monto: '$67,300.00', descripcion: 'Compra de divisas fuera de perfil' },
];

const SEED_ALERTAS_INTERNAS: AlertaInterna[] = [
  { id: 1, noAlerta: 'AI-2026-001', fecha: '15/01/2026', cliente: 'COMERCIALIZADORA ABC SA', tipo: 'Relevante', estatus: 'Pendiente', descripcion: 'Depósitos frecuentes en efectivo', resultado: 'En revisión' },
  { id: 2, noAlerta: 'AI-2026-002', fecha: '14/01/2026', cliente: 'Juan Pérez García', tipo: 'Inusual', estatus: 'En Revisión', descripcion: 'Transferencias fuera del perfil', resultado: 'Investigando' },
  { id: 3, noAlerta: 'AI-2026-003', fecha: '13/01/2026', cliente: 'GRUPO EMPRESARIAL XYZ', tipo: 'Preocupante', estatus: 'Atendida', descripcion: 'Operaciones con países de alto riesgo', resultado: 'Reportado' },
  { id: 4, noAlerta: 'AI-2026-004', fecha: '12/01/2026', cliente: 'María López Sánchez', tipo: 'Relevante', estatus: 'Archivada', descripcion: 'Retiros inusuales de efectivo', resultado: 'Sin hallazgos' },
  { id: 5, noAlerta: 'AI-2026-005', fecha: '11/01/2026', cliente: 'SERVICIOS INTEGRALES SA', tipo: 'Inusual', estatus: 'Pendiente', descripcion: 'Cambio en patrón transaccional', resultado: 'Pendiente análisis' },
  { id: 6, noAlerta: 'AI-2026-006', fecha: '10/01/2026', cliente: 'Roberto Sánchez Cruz', tipo: 'Relevante', estatus: 'En Revisión', descripcion: 'Operaciones con terceros no identificados', resultado: 'En proceso' },
];

const SEED_PERFILES: PerfilTransaccional[] = [
  { id: 1, clienteId: 1, clienteNombre: 'Juan Carlos García López', clienteRFC: 'GALJ850315HDF', sublinea: 'Cuenta de ahorro para importadores', producto: 'Cuenta de Ahorro', numTransRetiro: '500', numTransDeposito: '500', montoMaxRetiros: '$10,000', montoMaxDepositos: '$10,000', periodo: 'Mensual', fechaRegistro: '10/01/2026', estatus: 'Activo' },
  { id: 2, clienteId: 2, clienteNombre: 'Comercializadora Del Norte SA de CV', clienteRFC: 'CDN2011234567', sublinea: 'Cuenta de ahorro estándar', producto: 'Cuenta Corriente', numTransRetiro: '1000', numTransDeposito: '1500', montoMaxRetiros: '$50,000', montoMaxDepositos: '$80,000', periodo: 'Mensual', fechaRegistro: '05/12/2025', estatus: 'Activo' },
  { id: 3, clienteId: 3, clienteNombre: 'María Elena Rodríguez Sánchez', clienteRFC: 'ROSM900728MLN', sublinea: 'Cuenta de ahorro premium', producto: 'Inversión', numTransRetiro: '200', numTransDeposito: '300', montoMaxRetiros: '$25,000', montoMaxDepositos: '$30,000', periodo: 'Mensual', fechaRegistro: '20/01/2026', estatus: 'Activo' },
];

const SEED_KYC: KYCData = {
  esPEP: false, numeroSalarios: '0', conyugeFamiliarPEP: false, listasNegras: '',
  actividadIngresos: '', resultadoCoincidencias: false, aprobadoOficial: false,
  fechaCalificacion: '', noCalculado: '', ingresoMensual: '', actividadEconomica: '',
  funcionariosPublicos: false, percibeOtrosIngresos: false,
  calificacionPonderada: '0 puntos', nivelRiesgo: 'Bajo',
};

const SEED_PARAMETROS: ParametrosPLD = {
  factorRiesgo: '100', montoMaxOperacionUSD: '10,000', montoMaxPersonaFisica: '500,000',
  montoMaxPersonaMoral: '5,000,000', aplicaPersonaFisica: 'Sí', aplicaPersonaMoral: 'Sí',
  sujetoObligado: 'SOFOM ENR - Institución Financiera', organoSupervisor: 'CNBV',
  diasActualizacionKYC: '365', porcentajeDesviacion: '30', diasRetencion: '1825',
  alertasAutomaticas: true, envioAutomaticoCNBV: true,
};

const SEED_CALIFICACION: CalificacionData = {
  noCliente: 'CLI-2025-001', nombreCliente: 'Juan Pérez García',
  actividadEconomica: 60, residencia: 50, nacionalidad: 40,
  tipoPersona: 55, pepListasNegras: 80, calificacionTotal: 0, nivelRiesgo: '',
};

const SEED_REPORTES: ReporteCNBV[] = [
  { id: 1, folio: 'REP-CNBV-2026-001', fecha: '15/01/2026', tipo: 'Operación Relevante', cliente: 'COMERCIALIZADORA ABC SA', monto: '$1,250,000.00', estatus: 'Validado', enviado: 'Sí' },
  { id: 2, folio: 'REP-CNBV-2026-002', fecha: '14/01/2026', tipo: 'Operación Inusual', cliente: 'Juan Pérez García', monto: '$850,000.00', estatus: 'Pendiente', enviado: 'No' },
  { id: 3, folio: 'REP-CNBV-2026-003', fecha: '13/01/2026', tipo: 'Operación Preocupante', cliente: 'GRUPO EMPRESARIAL XYZ', monto: '$2,500,000.00', estatus: 'Validado', enviado: 'Sí' },
  { id: 4, folio: 'REP-CNBV-2026-004', fecha: '12/01/2026', tipo: 'Operación Relevante', cliente: 'SERVICIOS INTEGRALES SA', monto: '$1,100,000.00', estatus: 'En Revisión', enviado: 'No' },
  { id: 5, folio: 'REP-CNBV-2026-005', fecha: '11/01/2026', tipo: 'Operación Inusual', cliente: 'María López Sánchez', monto: '$650,000.00', estatus: 'Validado', enviado: 'Sí' },
];

// ═══════════════════════════════════════════════════════════════════
// GETTERS / SETTERS
// ═══════════════════════════════════════════════════════════════════
export const getAlertas = (): AlertaPLD[] => load(KEYS.alertas, SEED_ALERTAS);
export const saveAlertas = (d: AlertaPLD[]) => save(KEYS.alertas, d);

export const getAlertasInternas = (): AlertaInterna[] => load(KEYS.alertasInternas, SEED_ALERTAS_INTERNAS);
export const saveAlertasInternas = (d: AlertaInterna[]) => save(KEYS.alertasInternas, d);

export const getPerfiles = (): PerfilTransaccional[] => load(KEYS.perfiles, SEED_PERFILES);
export const savePerfiles = (d: PerfilTransaccional[]) => save(KEYS.perfiles, d);

export const getKYC = (): KYCData => load(KEYS.kyc, SEED_KYC);
export const saveKYC = (d: KYCData) => save(KEYS.kyc, d);

export const getParametros = (): ParametrosPLD => load(KEYS.parametros, SEED_PARAMETROS);
export const saveParametros = (d: ParametrosPLD) => save(KEYS.parametros, d);

export const getCalificacion = (): CalificacionData => load(KEYS.calificacion, SEED_CALIFICACION);
export const saveCalificacion = (d: CalificacionData) => save(KEYS.calificacion, d);

export const getReportes = (): ReporteCNBV[] => load(KEYS.reportes, SEED_REPORTES);
export const saveReportes = (d: ReporteCNBV[]) => save(KEYS.reportes, d);

export const getCatalogos = () => load(KEYS.catalogos, {
  actividadEconomica: ['Servicios profesionales', 'Comercio', 'Construcción', 'Manufactura', 'Tecnología', 'Agricultura', 'Transporte', 'Educación', 'Salud', 'Finanzas'],
  paises: ['México', 'Estados Unidos', 'Canadá', 'España', 'Colombia', 'Argentina', 'Chile', 'Brasil', 'Perú', 'Alemania'],
  instrumentoMonetario: ['Efectivo', 'Transferencia electrónica', 'Cheque', 'Tarjeta débito', 'Tarjeta crédito', 'Inversión', 'Divisas'],
  tipoOperacion: ['Depósito', 'Retiro', 'Transferencia nacional', 'Transferencia internacional', 'Compra divisas', 'Venta divisas', 'Pago servicios', 'Pago préstamo'],
  tipoAlerta: ['Relevante', 'Inusual', 'Interna', 'Preocupante'],
});
export const saveCatalogos = (d: any) => save(KEYS.catalogos, d);

// ═══════════════════════════════════════════════════════════════════
// KYC MULTI-CLIENTE
// ═══════════════════════════════════════════════════════════════════
const SEED_KYC_CLIENTES: KYCData[] = [
  {
    clienteId: 1, clienteNombre: 'Juan Carlos García López', clienteRFC: 'GALJ850315HDF',
    clienteCURP: 'GALJ850315HDFPPR03', clientePersonalidad: 'Persona Física',
    clienteSucursal: 'Matriz Centro', estatusKYC: 'Completo', fechaUltimaRevision: '10/01/2026',
    esPEP: false, numeroSalarios: '3', conyugeFamiliarPEP: false, listasNegras: 'Sin coincidencias',
    actividadIngresos: 'Gerente de Sistemas en Tech Solutions SA', resultadoCoincidencias: false,
    aprobadoOficial: true, fechaCalificacion: '10/01/2026', noCalculado: 'KYC-001',
    ingresoMensual: '$20,001 - $50,000', actividadEconomica: 'Tecnología',
    funcionariosPublicos: false, percibeOtrosIngresos: true,
    calificacionPonderada: '32.5 puntos', nivelRiesgo: 'Bajo',
  },
  {
    clienteId: 2, clienteNombre: 'Comercializadora Del Norte SA de CV', clienteRFC: 'CDN2011234567',
    clienteCURP: '', clientePersonalidad: 'Persona Moral',
    clienteSucursal: 'Sucursal Norte', estatusKYC: 'Completo', fechaUltimaRevision: '05/12/2025',
    esPEP: false, numeroSalarios: '0', conyugeFamiliarPEP: false, listasNegras: 'Sin coincidencias',
    actividadIngresos: 'Comercialización de productos al por mayor', resultadoCoincidencias: false,
    aprobadoOficial: true, fechaCalificacion: '05/12/2025', noCalculado: 'KYC-002',
    ingresoMensual: 'Más de $100,000', actividadEconomica: 'Comercio',
    funcionariosPublicos: false, percibeOtrosIngresos: false,
    calificacionPonderada: '45.0 puntos', nivelRiesgo: 'Medio',
  },
  {
    clienteId: 3, clienteNombre: 'María Elena Rodríguez Sánchez', clienteRFC: 'ROSM900728MLN',
    clienteCURP: 'ROSM900728MNLNDN04', clientePersonalidad: 'Persona Física c/Actividad empresarial',
    clienteSucursal: 'Sucursal Sur', estatusKYC: 'En Proceso', fechaUltimaRevision: '20/01/2026',
    esPEP: false, numeroSalarios: '2', conyugeFamiliarPEP: false, listasNegras: '',
    actividadIngresos: 'Restaurantera independiente', resultadoCoincidencias: false,
    aprobadoOficial: false, fechaCalificacion: '', noCalculado: 'KYC-003',
    ingresoMensual: '$10,001 - $20,000', actividadEconomica: 'Servicios profesionales',
    funcionariosPublicos: false, percibeOtrosIngresos: true,
    calificacionPonderada: '0 puntos', nivelRiesgo: 'Bajo',
  },
  {
    clienteId: 4, clienteNombre: 'Roberto Sánchez Cruz', clienteRFC: 'SACR780512QWE',
    clienteCURP: 'SACR780512HDFNRB06', clientePersonalidad: 'Persona Física',
    clienteSucursal: 'Matriz Centro', estatusKYC: 'Vencido', fechaUltimaRevision: '15/06/2024',
    esPEP: true, numeroSalarios: '5', conyugeFamiliarPEP: false, listasNegras: 'Revisión pendiente',
    actividadIngresos: 'Director General empresa privada', resultadoCoincidencias: true,
    aprobadoOficial: false, fechaCalificacion: '15/06/2024', noCalculado: 'KYC-004',
    ingresoMensual: '$50,001 - $100,000', actividadEconomica: 'Servicios financieros',
    funcionariosPublicos: true, percibeOtrosIngresos: true,
    calificacionPonderada: '72.0 puntos', nivelRiesgo: 'Alto',
  },
  {
    clienteId: 5, clienteNombre: 'Ana Patricia Mendoza Flores', clienteRFC: 'MEFA920310RTY',
    clienteCURP: 'MEFA920310MDFNLN01', clientePersonalidad: 'Persona Física',
    clienteSucursal: 'Sucursal Poniente', estatusKYC: 'Pendiente', fechaUltimaRevision: '',
    esPEP: false, numeroSalarios: '0', conyugeFamiliarPEP: false, listasNegras: '',
    actividadIngresos: '', resultadoCoincidencias: false,
    aprobadoOficial: false, fechaCalificacion: '', noCalculado: 'KYC-005',
    ingresoMensual: '', actividadEconomica: '',
    funcionariosPublicos: false, percibeOtrosIngresos: false,
    calificacionPonderada: '0 puntos', nivelRiesgo: 'Bajo',
  },
];

export const getKYCClientes = (): KYCData[] => load(KEYS.kycClientes, SEED_KYC_CLIENTES);
export const saveKYCClientes = (d: KYCData[]) => save(KEYS.kycClientes, d);

export const getKYCByClienteId = (clienteId: number): KYCData | undefined => {
  const all = getKYCClientes();
  return all.find(k => k.clienteId === clienteId);
};

export const saveKYCCliente = (kyc: KYCData) => {
  const all = getKYCClientes();
  const idx = all.findIndex(k => k.clienteId === kyc.clienteId);
  if (idx >= 0) {
    all[idx] = kyc;
  } else {
    all.push(kyc);
  }
  saveKYCClientes(all);
};

export const createEmptyKYC = (clienteId: number, nombre: string, rfc: string, curp: string, personalidad: string, sucursal: string): KYCData => ({
  clienteId, clienteNombre: nombre, clienteRFC: rfc, clienteCURP: curp,
  clientePersonalidad: personalidad, clienteSucursal: sucursal,
  estatusKYC: 'Pendiente', fechaUltimaRevision: '',
  esPEP: false, numeroSalarios: '0', conyugeFamiliarPEP: false, listasNegras: '',
  actividadIngresos: '', resultadoCoincidencias: false, aprobadoOficial: false,
  fechaCalificacion: '', noCalculado: `KYC-${String(clienteId).padStart(3, '0')}`,
  ingresoMensual: '', actividadEconomica: '',
  funcionariosPublicos: false, percibeOtrosIngresos: false,
  calificacionPonderada: '0 puntos', nivelRiesgo: 'Bajo',
});

// ═══════════════════════════════════════════════════════════════════
// CALIFICACIONES MULTI-CLIENTE
// ═══════════════════════════════════════════════════════════════════
const SEED_CALIFICACIONES: CalificacionData[] = [
  { clienteId: 1, noCliente: 'CLI-001', nombreCliente: 'Juan Carlos García López', clienteRFC: 'GALJ850315HDF', clientePersonalidad: 'Persona Física', clienteSucursal: 'Matriz Centro', fechaCalificacion: '10/01/2026', actividadEconomica: 40, residencia: 30, nacionalidad: 20, tipoPersona: 35, pepListasNegras: 10, calificacionTotal: 27.75, nivelRiesgo: 'Bajo' },
  { clienteId: 2, noCliente: 'CLI-002', nombreCliente: 'Comercializadora Del Norte SA de CV', clienteRFC: 'CDN2011234567', clientePersonalidad: 'Persona Moral', clienteSucursal: 'Sucursal Norte', fechaCalificacion: '05/12/2025', actividadEconomica: 55, residencia: 40, nacionalidad: 35, tipoPersona: 60, pepListasNegras: 30, calificacionTotal: 44.25, nivelRiesgo: 'Medio' },
  { clienteId: 4, noCliente: 'CLI-004', nombreCliente: 'Roberto Sánchez Cruz', clienteRFC: 'SACR780512QWE', clientePersonalidad: 'Persona Física', clienteSucursal: 'Matriz Centro', fechaCalificacion: '15/06/2024', actividadEconomica: 70, residencia: 60, nacionalidad: 50, tipoPersona: 65, pepListasNegras: 90, calificacionTotal: 70.0, nivelRiesgo: 'Alto' },
];

export const getCalificaciones = (): CalificacionData[] => load(KEYS.calificaciones, SEED_CALIFICACIONES);
export const saveCalificaciones = (d: CalificacionData[]) => save(KEYS.calificaciones, d);

export const getCalificacionByClienteId = (clienteId: number): CalificacionData | undefined => {
  return getCalificaciones().find(c => c.clienteId === clienteId);
};

export const saveCalificacionCliente = (cal: CalificacionData) => {
  const all = getCalificaciones();
  const idx = all.findIndex(c => c.clienteId === cal.clienteId);
  if (idx >= 0) { all[idx] = cal; } else { all.push(cal); }
  saveCalificaciones(all);
};