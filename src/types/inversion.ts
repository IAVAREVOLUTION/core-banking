// ═══════════════════════════════════════════════════════════════════
// TIPOS — Módulo de Inversiones (maestro + detalles)
// ═══════════════════════════════════════════════════════════════════

export interface Cotitular {
  id: string;
  idCliente: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  parentesco: string;
  notas: string;
}

export interface Beneficiario {
  id: string;
  claveCliente: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  parentesco: string;
  notas: string;
  porcentaje: string;
  validado: boolean;
}

export interface Rendimiento {
  id: string;
  fechaCreacion: string;
  concepto: string;
  tasa: string;
  montoBase: string;
  monto: string;
}

export interface ImpuestoInv {
  id: string;
  fechaCalculo: string;
  conceptoImpuesto: string;
  porcentaje: string;
  montoBase: string;
  conceptoBase: string;
  valorImpuestos: string;
}

export interface CargoInv {
  id: string;
  tipoCargo: string;
  descripcion: string;
  monto: string;
  moneda: string;
  fechaHora: string;
}

export interface ExpedienteDoc {
  id: number;
  fechaRegistro: string;
  usuarioRegistro: string;
  archivo: string;
  tipoDocumento: string;
  descripcion: string;
  estatus: string;
  observaciones: string;
}

export interface DocumentoValor {
  id: string;
  tipoDocumento: string;
  descripcion: string;
  fechaCarga: string;
  usuarioCarga: string;
  archivo: string;
  valorDocumentado: string;
  estatus: string;
}

export interface MovimientoInv {
  id: string;
  fechaHora: string;
  tipoMovimiento: string;
  montoMovimiento: string;
  saldoInicial: string;
  saldoFinal: string;
  referencia: string;
  estatus: string;
}

export interface BloqueoInv {
  id: string;
  tipoBloqueo: string;
  motivo: string;
  fechaInicio: string;
  fechaFin: string;
  estatus: string;
  usuarioRegistro: string;
  fechaRegistro: string;
}

export interface SolicitudExtra {
  id: string;
  noSolicitud: string;
  numeroCliente: string;
  cliente: string;
  numeroCuenta: string;
  productoFinanciero: string;
  areaSolicito: string;
  puestoTrabajo: string;
  solicitudExtraordinaria: string;
  areaAutorizo: string;
  puestoTrabajoAutorizo: string;
  descripcionCaso: string;
  fechaRegistro: string;
  estatus: string;
}

// ═══════════════════════════════════════════════════════════════════
// FORMULARIO PRINCIPAL (maestro)
// ═══════════════════════════════════════════════════════════════════
export interface InversionFormData {
  noRegistro: string;
  cliente: string;
  fechaInicio: string;
  fechaVencimiento: string;
  montoInversion: string;
  moneda: string;
  lineaProducto: string;
  formula: string;
  producto: string;
  tipoTasa: string;
  cuponCero: boolean;
  periodo: string;
  plazos: string;
  numeroRenovaciones: string;
  noCuentaInversion: string;
  fechaCorteEstados: string;
  montoPagare: string;
  montoIntereses: string;
  tasaIntereses: string;
  estatusInversion: string;
  subEstatus: string;
  cuentaPago: string;
  // Default tab
  plazoMinimo: string;
  plazoAutorizado: string;
  plazoMaximo: string;
  montoMinimo: string;
  montoAutorizado: string;
  montoMaximo: string;
  tasaMinima: string;
  tasaAutorizada: string;
  tasaMaxima: string;
}

// ═══════════════════════════════════════════════════════════════════
// INVERSIÓN COMPLETA (maestro + detalles)
// ═══════════════════════════════════════════════════════════════════
export interface InversionCompleta {
  id: number;
  numero: string; // INV.001, INV.002...
  form: InversionFormData;
  cotitulares: Cotitular[];
  beneficiarios: Beneficiario[];
  rendimientos: Rendimiento[];
  impuestos: ImpuestoInv[];
  cargos: CargoInv[];
  expedientes: ExpedienteDoc[];
  documentosValor: DocumentoValor[];
  movimientos: MovimientoInv[];
  bloqueos: BloqueoInv[];
  solicitudesExtra: SolicitudExtra[];
  fechaCreacion: string;
  usuarioCreacion: string;
  fechaModificacion: string;
  usuarioModificacion: string;
}

// ═══════════════════════════════════════════════════════════════════
// TIPO LEGACY (para compatibilidad con App.tsx)
// ═══════════════════════════════════════════════════════════════════
export interface Inversion {
  id: number;
  noCuentaInversion: string;
  cliente: string;
  fechaInicio: string;
  fechaFin: string;
  montoPagare: number;
  montoIntereses: number;
  producto: string;
  lineaProducto: string;
  sublinea: string;
  cuentaPago: string;
}
