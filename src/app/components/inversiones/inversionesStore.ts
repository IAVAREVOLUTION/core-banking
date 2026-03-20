// ═══════════════════════════════════════════════════════════════════
// STORE DE INVERSIONES — Persistencia en sessionStorage
// ═══════════════════════════════════════════════════════════════════
import type {
  InversionCompleta,
  InversionFormData,
  Inversion,
} from '@/types/inversion';

const STORE_KEY = 'inversiones_store';
const TEMP_KEY = 'inversiones_temp'; // datos temporales mientras se edita

// ═══════════════════════════════════════════════════════════════════
// VALORES INICIALES
// ═══════════════════════════════════════════════════════════════════
export function emptyFormData(): InversionFormData {
  return {
    noRegistro: '',
    cliente: '',
    fechaInicio: '',
    fechaVencimiento: '',
    montoInversion: '',
    moneda: 'MXN',
    lineaProducto: 'Inversión',
    formula: '',
    producto: '',
    tipoTasa: 'Fija',
    cuponCero: false,
    periodo: '',
    plazos: '',
    numeroRenovaciones: '',
    noCuentaInversion: '',
    fechaCorteEstados: '',
    montoPagare: '',
    montoIntereses: '',
    tasaIntereses: '',
    estatusInversion: 'Pendiente',
    subEstatus: '',
    cuentaPago: '',
    plazoMinimo: '',
    plazoAutorizado: '',
    plazoMaximo: '',
    montoMinimo: '',
    montoAutorizado: '',
    montoMaximo: '',
    tasaMinima: '',
    tasaAutorizada: '',
    tasaMaxima: '',
  };
}

export function emptyInversion(): InversionCompleta {
  return {
    id: 0,
    numero: '',
    form: emptyFormData(),
    cotitulares: [],
    beneficiarios: [],
    rendimientos: [],
    impuestos: [],
    cargos: [],
    expedientes: [],
    documentosValor: [],
    movimientos: [],
    bloqueos: [],
    solicitudesExtra: [],
    fechaCreacion: '',
    usuarioCreacion: '',
    fechaModificacion: '',
    usuarioModificacion: '',
  };
}

// ═══════════════════════════════════════════════════════════════════
// DATOS MOCK INICIALES (seed)
// ═══════════════════════════════════════════════════════════════════
const SEED_DATA: InversionCompleta[] = [
  {
    id: 1,
    numero: 'INV.001',
    form: {
      ...emptyFormData(),
      noRegistro: '1',
      cliente: 'CL-001 - Juan Pérez',
      fechaInicio: '2026-01-10',
      fechaVencimiento: '2026-04-10',
      montoInversion: '500,000.00',
      moneda: 'MXN',
      lineaProducto: 'Inversión',
      formula: 'Inversión a plazo fijo',
      producto: 'CETES 90 días',
      tipoTasa: 'Fija',
      cuponCero: false,
      periodo: 'Año',
      plazos: '1-6',
      numeroRenovaciones: '2',
      noCuentaInversion: 'INV-000001',
      fechaCorteEstados: '2026-03-31',
      montoPagare: '500,000.00',
      montoIntereses: '12,500.00',
      tasaIntereses: '10.00',
      estatusInversion: 'Aprobada',
      subEstatus: 'Vigente',
      cuentaPago: '01 PAGARES',
      plazoMinimo: '30',
      plazoAutorizado: '90',
      plazoMaximo: '365',
      montoMinimo: '10,000.00',
      montoAutorizado: '500,000.00',
      montoMaximo: '5,000,000.00',
      tasaMinima: '5.00',
      tasaAutorizada: '10.00',
      tasaMaxima: '15.00',
    },
    cotitulares: [
      { id: 'ct1', idCliente: 'CL-003', nombre: 'José', apellidoPaterno: 'Pérez', apellidoMaterno: 'Rivera', fechaNacimiento: '1986-04-02', parentesco: 'Esposo', notas: 'Co-titular de la cuenta' },
    ],
    beneficiarios: [
      { id: 'bn1', claveCliente: 'CL-002', nombre: 'María', apellidoPaterno: 'García', apellidoMaterno: 'Sánchez', fechaNacimiento: '1990-08-15', parentesco: 'Esposa', notas: 'Beneficiaria principal', porcentaje: '60', validado: true },
      { id: 'bn2', claveCliente: 'CL-004', nombre: 'Luis', apellidoPaterno: 'Pérez', apellidoMaterno: 'García', fechaNacimiento: '2010-03-20', parentesco: 'Hijo', notas: '', porcentaje: '40', validado: true },
    ],
    rendimientos: [
      { id: 'r1', fechaCreacion: '2026-02-10', concepto: 'Rendimiento mensual', tasa: '10.00', montoBase: '500,000.00', monto: '4,166.67' },
      { id: 'r2', fechaCreacion: '2026-03-10', concepto: 'Rendimiento mensual', tasa: '10.00', montoBase: '500,000.00', monto: '4,166.67' },
    ],
    impuestos: [
      { id: 'i1', fechaCalculo: '2026-02-10', conceptoImpuesto: 'ISR', porcentaje: '0.97', montoBase: '4,166.67', conceptoBase: 'Rendimiento mensual', valorImpuestos: '40.42' },
    ],
    cargos: [],
    expedientes: [
      { id: 1, fechaRegistro: '2026-01-10 10:30:00', usuarioRegistro: 'admin', archivo: 'Contrato_INV001.pdf', tipoDocumento: 'Contrato', descripcion: 'Contrato de inversión', estatus: 'Aceptado', observaciones: '' },
    ],
    documentosValor: [],
    movimientos: [
      { id: 'm1', fechaHora: '2026-01-10 09:00:00', tipoMovimiento: 'Apertura', montoMovimiento: '500,000.00', saldoInicial: '0.00', saldoFinal: '500,000.00', referencia: 'APE-001', estatus: 'Aplicado' },
    ],
    bloqueos: [],
    solicitudesExtra: [],
    fechaCreacion: '2026-01-10 09:00:00',
    usuarioCreacion: 'admin',
    fechaModificacion: '2026-01-10 09:00:00',
    usuarioModificacion: 'admin',
  },
  {
    id: 2,
    numero: 'INV.002',
    form: {
      ...emptyFormData(),
      noRegistro: '2',
      cliente: 'CL-002 - María García',
      fechaInicio: '2026-01-12',
      fechaVencimiento: '2026-07-11',
      montoInversion: '1,200,000.00',
      moneda: 'MXN',
      lineaProducto: 'Inversión',
      formula: 'Inversión a plazo fijo',
      producto: 'Bonos Gubernamentales',
      tipoTasa: 'Fija',
      cuponCero: false,
      periodo: 'Año',
      plazos: '1-6',
      numeroRenovaciones: '0',
      noCuentaInversion: 'INV-000002',
      fechaCorteEstados: '2026-06-30',
      montoPagare: '1,200,000.00',
      montoIntereses: '55,200.00',
      tasaIntereses: '9.20',
      estatusInversion: 'Aprobada',
      subEstatus: 'Vigente',
      cuentaPago: '01 PAGARES',
      plazoMinimo: '90',
      plazoAutorizado: '180',
      plazoMaximo: '365',
      montoMinimo: '100,000.00',
      montoAutorizado: '1,200,000.00',
      montoMaximo: '10,000,000.00',
      tasaMinima: '7.00',
      tasaAutorizada: '9.20',
      tasaMaxima: '12.00',
    },
    cotitulares: [],
    beneficiarios: [
      { id: 'bn1', claveCliente: 'CL-005', nombre: 'Pedro', apellidoPaterno: 'González', apellidoMaterno: 'López', fechaNacimiento: '1988-11-05', parentesco: 'Esposo', notas: '', porcentaje: '100', validado: true },
    ],
    rendimientos: [],
    impuestos: [],
    cargos: [],
    expedientes: [],
    documentosValor: [],
    movimientos: [
      { id: 'm1', fechaHora: '2026-01-12 11:30:00', tipoMovimiento: 'Apertura', montoMovimiento: '1,200,000.00', saldoInicial: '0.00', saldoFinal: '1,200,000.00', referencia: 'APE-002', estatus: 'Aplicado' },
    ],
    bloqueos: [],
    solicitudesExtra: [],
    fechaCreacion: '2026-01-12 11:30:00',
    usuarioCreacion: 'admin',
    fechaModificacion: '2026-01-12 11:30:00',
    usuarioModificacion: 'admin',
  },
  {
    id: 3,
    numero: 'INV.003',
    form: {
      ...emptyFormData(),
      noRegistro: '3',
      cliente: 'CL-003 - Carlos Ramírez',
      fechaInicio: '2026-01-15',
      fechaVencimiento: '2026-02-14',
      montoInversion: '800,000.00',
      moneda: 'MXN',
      lineaProducto: 'Inversión',
      formula: 'Inversión a plazo fijo',
      producto: 'Pagaré Bancario',
      tipoTasa: 'Fija',
      cuponCero: true,
      periodo: 'Mes',
      plazos: '1-6',
      numeroRenovaciones: '3',
      noCuentaInversion: 'INV-000003',
      fechaCorteEstados: '2026-02-14',
      montoPagare: '800,000.00',
      montoIntereses: '5,200.00',
      tasaIntereses: '7.80',
      estatusInversion: 'Aprobada',
      subEstatus: 'Vigente',
      cuentaPago: '01 PAGARES',
      plazoMinimo: '28',
      plazoAutorizado: '30',
      plazoMaximo: '90',
      montoMinimo: '50,000.00',
      montoAutorizado: '800,000.00',
      montoMaximo: '2,000,000.00',
      tasaMinima: '6.00',
      tasaAutorizada: '7.80',
      tasaMaxima: '10.00',
    },
    cotitulares: [],
    beneficiarios: [],
    rendimientos: [
      { id: 'r1', fechaCreacion: '2026-02-14', concepto: 'Rendimiento al vencimiento', tasa: '7.80', montoBase: '800,000.00', monto: '5,200.00' },
    ],
    impuestos: [
      { id: 'i1', fechaCalculo: '2026-02-14', conceptoImpuesto: 'ISR', porcentaje: '0.97', montoBase: '5,200.00', conceptoBase: 'Rendimiento al vencimiento', valorImpuestos: '50.44' },
    ],
    cargos: [
      { id: 'c1', tipoCargo: 'Comisión', descripcion: 'Comisión por apertura', monto: '1,500.00', moneda: 'MXN', fechaHora: '2026-01-15 10:00:00' },
    ],
    expedientes: [],
    documentosValor: [],
    movimientos: [],
    bloqueos: [],
    solicitudesExtra: [],
    fechaCreacion: '2026-01-15 10:00:00',
    usuarioCreacion: 'admin',
    fechaModificacion: '2026-01-15 10:00:00',
    usuarioModificacion: 'admin',
  },
];

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES DE PERSISTENCIA
// ═══════════════════════════════════════════════════════════════════
function readStore(): InversionCompleta[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // Seed
  sessionStorage.setItem(STORE_KEY, JSON.stringify(SEED_DATA));
  return [...SEED_DATA];
}

function writeStore(data: InversionCompleta[]) {
  sessionStorage.setItem(STORE_KEY, JSON.stringify(data));
}

// ═══════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════
export function getAll(): InversionCompleta[] {
  return readStore();
}

export function getById(id: number): InversionCompleta | undefined {
  return readStore().find((i) => i.id === id);
}

export function getNextNumero(): string {
  const all = readStore();
  const next = all.length + 1;
  return `INV.${String(next).padStart(3, '0')}`;
}

export function getNextId(): number {
  const all = readStore();
  return all.length > 0 ? Math.max(...all.map((i) => i.id)) + 1 : 1;
}

export function save(inv: InversionCompleta): InversionCompleta {
  const all = readStore();
  const now = new Date().toLocaleString('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  if (inv.id === 0) {
    // NUEVO
    const id = getNextId();
    const numero = getNextNumero();
    const created: InversionCompleta = {
      ...inv,
      id,
      numero,
      form: { ...inv.form, noRegistro: String(id), noCuentaInversion: `INV-${String(id).padStart(6, '0')}` },
      fechaCreacion: now,
      usuarioCreacion: 'admin',
      fechaModificacion: now,
      usuarioModificacion: 'admin',
    };
    all.push(created);
    writeStore(all);
    return created;
  } else {
    // EDITAR
    const idx = all.findIndex((i) => i.id === inv.id);
    if (idx >= 0) {
      all[idx] = { ...inv, fechaModificacion: now, usuarioModificacion: 'admin' };
      writeStore(all);
      return all[idx];
    }
    return inv;
  }
}

export function deleteInversion(id: number) {
  const all = readStore().filter((i) => i.id !== id);
  writeStore(all);
}

// ═══════════════════════════════════════════════════════════════════
// PERSISTENCIA TEMPORAL (mientras se navega entre subtabs)
// ═══════════════════════════════════════════════════════════════════
export function saveTemp(data: InversionCompleta) {
  sessionStorage.setItem(TEMP_KEY, JSON.stringify(data));
}

export function loadTemp(): InversionCompleta | null {
  try {
    const raw = sessionStorage.getItem(TEMP_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function clearTemp() {
  sessionStorage.removeItem(TEMP_KEY);
}

// ═══════════════════════════════════════════════════════════════════
// CONVERSIÓN A TIPO LEGACY (para App.tsx)
// ═══════════════════════════════════════════════════════════════════
export function toLegacy(inv: InversionCompleta): Inversion {
  const parseMoney = (s: string) => parseFloat(s.replace(/,/g, '')) || 0;
  return {
    id: inv.id,
    noCuentaInversion: inv.form.noCuentaInversion || inv.numero,
    cliente: inv.form.cliente,
    fechaInicio: inv.form.fechaInicio,
    fechaFin: inv.form.fechaVencimiento,
    montoPagare: parseMoney(inv.form.montoPagare),
    montoIntereses: parseMoney(inv.form.montoIntereses),
    producto: inv.form.producto,
    lineaProducto: inv.form.lineaProducto,
    sublinea: '',
    cuentaPago: inv.form.cuentaPago,
  };
}

export function getAllLegacy(): Inversion[] {
  return readStore().map(toLegacy);
}
