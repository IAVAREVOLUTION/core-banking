export type LineaProducto = 'Crédito' | 'Captación' | 'Línea de Crédito';
export type TipoProducto = 'Crédito Simple' | 'Crédito Revolvente' | 'Línea de Crédito';
export type FaseOriginacion =
  | 'Integración del Expediente'
  | 'Análisis de Expediente Operativo'
  | 'Análisis de Expediente Jurídico'
  | 'Formalización de Cuenta Financiera'
  | 'Validación de Contratos y Pagarés Firmados'
  | 'Solicitud de Activación de Cuenta Financiera'
  | 'Activación de Cuenta Financiera';

export type TipoPersona = 'Física' | 'Moral' | 'Fís. c/Act. Emp.';

export interface DocumentoObligatorio {
  tipoDocumento: string;
  aplicaPersona: TipoPersona[];
  fase: FaseOriginacion;
}

export interface Nota {
  id: number;
  fechaCreacion: Date;
  usuario: string;
  contenido: string;
}

export interface Garantia {
  id: number;
  tipo: string;
  valorNominal: number;
  estatus: string;
}

export interface Beneficiario {
  id: number;
  nombre: string;
  firma: boolean;
}

export interface SolicitudActivacion {
  estatusPago: string;
  monto: number;
}

export interface ContratoData {
  header: Record<string, any>;
  terminosCondiciones: Record<string, any>;
  garantias: Garantia[];
}

export interface CargoItem {
  cveSubproducto: string;
  descSubproducto: string;
  cantidad: number;
  monto: number;
  impuesto: number;
  moneda: string;
  subTotal: number;
  estatus: string;
}

export interface CuentaPorCrear {
  tipo: 'CuentaporPagar' | 'CuentaporCobrar';
  header: Record<string, any>;
  detail: CargoItem[];
}

export interface FlujoTrabajoUpdate {
  faseActual: FaseOriginacion;
  faseDestino: FaseOriginacion;
  estatusSolicitud?: string;
  estatusCuenta?: string;
  estatusPago?: string;
  estatusCartera?: string;
}

export interface ReglaValidacionResult {
  accionPermitida: boolean;
  fase: FaseOriginacion;
  faseDestino: FaseOriginacion | null;
  motivos: string[];
  validaciones: {
    documentosCompletos: boolean;
    notaReciente: boolean;
    garantiasSuficientes: boolean;
    comitesAutorizados: boolean;
    beneficiariosCompletos: boolean;
    solicitudPagoCompletado: boolean;
  };
  actualizaciones: FlujoTrabajoUpdate[];
  contrato?: ContratoData;
  cuenta?: CuentaPorCrear;
  documentosFaltantes?: string[];
}

const FASES: FaseOriginacion[] = [
  'Integración del Expediente',
  'Análisis de Expediente Operativo',
  'Análisis de Expediente Jurídico',
  'Formalización de Cuenta Financiera',
  'Validación de Contratos y Pagarés Firmados',
  'Solicitud de Activación de Cuenta Financiera',
  'Activación de Cuenta Financiera',
];

const DOCUMENTOS_POR_FASE: DocumentoObligatorio[] = [
  // ── FASE 1: Integración del Expediente ──
  // Persona Física
  { tipoDocumento: 'Credencial de elector', aplicaPersona: ['Física'], fase: 'Integración del Expediente' },
  { tipoDocumento: 'CURP', aplicaPersona: ['Física'], fase: 'Integración del Expediente' },
  // Persona Moral
  { tipoDocumento: 'Acta constitutiva', aplicaPersona: ['Moral'], fase: 'Integración del Expediente' },
  { tipoDocumento: 'Poder notarial', aplicaPersona: ['Moral'], fase: 'Integración del Expediente' },
  // Persona Física con Actividad Empresarial
  { tipoDocumento: 'Credencial de elector', aplicaPersona: ['Fís. c/Act. Emp.'], fase: 'Integración del Expediente' },
  { tipoDocumento: 'Alta en SHCP (SAT)', aplicaPersona: ['Fís. c/Act. Emp.'], fase: 'Integración del Expediente' },
  // Todos los tipos
  { tipoDocumento: 'Comprobante de domicilio', aplicaPersona: ['Física', 'Moral', 'Fís. c/Act. Emp.'], fase: 'Integración del Expediente' },
  { tipoDocumento: 'Estado de cuenta bancario', aplicaPersona: ['Física', 'Moral', 'Fís. c/Act. Emp.'], fase: 'Integración del Expediente' },
  { tipoDocumento: 'Constancia de situación fiscal', aplicaPersona: ['Física', 'Moral', 'Fís. c/Act. Emp.'], fase: 'Integración del Expediente' },
  // ── FASE 2: Análisis de Expediente Operativo ──
  { tipoDocumento: 'Avalúo', aplicaPersona: ['Física', 'Moral', 'Fís. c/Act. Emp.'], fase: 'Análisis de Expediente Operativo' },
  // ── FASE 3: Análisis de Expediente Jurídico ──
  { tipoDocumento: 'Carta de autorización', aplicaPersona: ['Física', 'Moral', 'Fís. c/Act. Emp.'], fase: 'Análisis de Expediente Jurídico' },
  // ── FASE 5: Validación de Contratos y Pagarés Firmados ──
  { tipoDocumento: 'Contrato firmado', aplicaPersona: ['Física', 'Moral', 'Fís. c/Act. Emp.'], fase: 'Validación de Contratos y Pagarés Firmados' },
  { tipoDocumento: 'Pagaré firmado', aplicaPersona: ['Física', 'Moral', 'Fís. c/Act. Emp.'], fase: 'Validación de Contratos y Pagarés Firmados' },
];

export function getSiguienteFase(fase: FaseOriginacion): FaseOriginacion | null {
  const idx = FASES.indexOf(fase);
  return idx >= 0 && idx < FASES.length - 1 ? FASES[idx + 1] : null;
}

export function getFaseAnterior(fase: FaseOriginacion): FaseOriginacion | null {
  const idx = FASES.indexOf(fase);
  return idx > 0 ? FASES[idx - 1] : null;
}

export function validarDocumentosObligatorios(
  fase: FaseOriginacion,
  tipoPersona: TipoPersona,
  documentosCargados: string[]
): { valido: boolean; faltantes: string[] } {
  const requeridos = DOCUMENTOS_POR_FASE
    .filter(d => d.fase === fase && d.aplicaPersona.includes(tipoPersona))
    .map(d => d.tipoDocumento);

  const faltantes = requeridos.filter(doc => !documentosCargados.includes(doc));
  return { valido: faltantes.length === 0, faltantes };
}

export function validarNotaReciente(notas: Nota[], minutos: number = 30): boolean {
  if (notas.length === 0) return false;
  const ahora = new Date();
  const limite = new Date(ahora.getTime() - minutos * 60 * 1000);
  return notas.some(n => n.fechaCreacion >= limite);
}

export function validarGarantiasSuficientes(
  garantias: Garantia[],
  montoRequerido: number
): boolean {
  const garantiasValidas = garantias.filter(g => g.estatus === 'Aprobado');
  const totalGarantias = garantiasValidas.reduce((sum, g) => sum + g.valorNominal, 0);
  return totalGarantias >= montoRequerido;
}

export function validarComitesAutorizados(comites: { autoridad: string; estatus: string }[]): boolean {
  return comites.every(c => c.estatus === 'Autorizado');
}

export function validarBeneficiarios(beneficiarios: Beneficiario[]): boolean {
  if (beneficiarios.length === 0) return false;
  return beneficiarios.every(b => b.firma);
}

export function validarSolicitudPago(solicitud: SolicitudActivacion): boolean {
  return solicitud.estatusPago === 'Pagado';
}

export function generarContrato(
  lineaProducto: LineaProducto,
  tipoProducto: TipoProducto,
  header: Record<string, any>,
  garantias: Garantia[]
): ContratoData {
  return {
    header,
    terminosCondiciones: {
      tasa: header.tasa,
      plazo: header.plazo,
      periodicidad: header.periodicidad,
      montoAutorizado: header.montoAutorizado,
      fechaInicio: header.fechaInicio,
      fechaFin: header.fechaFin,
      tipoAmortizacion: header.tipoAmortizacion,
    },
    garantias: garantias.filter(g => g.estatus === 'Aprobado'),
  };
}

function buildDetail(header: Record<string, any>, cargos?: CargoItem[]): CargoItem[] {
  if (cargos && cargos.length > 0) return cargos;
  // Fallback: solo subproducto Capital tomado de Cargos/montoAutorizado
  const monto = header.montoAutorizado || 0;
  return [{
    cveSubproducto: 'CAP',
    descSubproducto: 'Capital',
    cantidad: 1,
    monto,
    impuesto: 0,
    moneda: header.moneda || 'MXN',
    subTotal: monto,
    estatus: 'Pendiente',
  }];
}

export function crearCuentaPorPagar(header: Record<string, any>, cargos?: CargoItem[]): CuentaPorCrear {
  return {
    tipo: 'CuentaporPagar',
    header: {
      solicitudId: header.solicitudId || header.id,
      noDocto: header.noDocto || `CP-${Date.now()}`,
      fecha: new Date().toISOString(),
      tipo: 'Por Pagar',
      cliente: header.cliente,
      fechaCompromiso: header.fechaCompromiso || header.fechaFin || '',
      formaPago: header.formaPago || '',
      institucionFinanciera: header.institucionFinanciera || '',
      cuentaBancaria: header.cuentaBancaria || '',
      referencia: header.referencia || '',
      montoTransaccion: header.montoAutorizado || 0,
      moneda: header.moneda || 'MXN',
      estatus: 'Pendiente',
    },
    detail: buildDetail(header, cargos),
  };
}

export function crearCuentaPorCobrar(header: Record<string, any>, cargos?: CargoItem[]): CuentaPorCrear {
  return {
    tipo: 'CuentaporCobrar',
    header: {
      solicitudId: header.solicitudId || header.id,
      noDocto: header.noDocto || `CC-${Date.now()}`,
      fecha: new Date().toISOString(),
      tipo: 'Por Cobrar',
      cliente: header.cliente,
      fechaCompromiso: header.fechaCompromiso || header.fechaFin || '',
      formaPago: header.formaPago || '',
      institucionFinanciera: header.institucionFinanciera || '',
      cuentaBancaria: header.cuentaBancaria || '',
      referencia: header.referencia || '',
      montoTransaccion: header.montoAutorizado || 0,
      moneda: header.moneda || 'MXN',
      estatus: 'Pendiente',
    },
    detail: buildDetail(header, cargos),
  };
}

export interface OriginacionContext {
  id: number;
  estatusSolicitud: string;
  fase: FaseOriginacion;
  lineaProducto: LineaProducto;
  tipoProducto: TipoProducto;
  tipoPersona: TipoPersona;
  documentos: string[];
  notas: Nota[];
  garantias: Garantia[];
  comites: { autoridad: string; estatus: string }[];
  beneficiarios: Beneficiario[];
  solicitudActivacion?: SolicitudActivacion;
  header: Record<string, any>;
  cargos?: CargoItem[];
  requiereGarantia?: boolean;
  requiereComite?: boolean;
}

export function ejecutarReglasFase(
  context: OriginacionContext,
  accion: 'enviarFase' | 'regresarFase' | 'formalizarContrato' | 'solicitudActivacion' | 'activarCuenta'
): ReglaValidacionResult {
  const { fase, estatusSolicitud } = context;
  const motivos: string[] = [];
  const actualizaciones: FlujoTrabajoUpdate[] = [];

  if (estatusSolicitud === 'Pendiente') {
    return {
      accionPermitida: false,
      fase,
      faseDestino: null,
      motivos: ['No se pueden ejecutar acciones mientras la solicitud esté en estatus Pendiente'],
      validaciones: {
        documentosCompletos: false,
        notaReciente: false,
        garantiasSuficientes: false,
        comitesAutorizados: false,
        beneficiariosCompletos: false,
        solicitudPagoCompletado: false,
      },
      actualizaciones: [],
    };
  }

  switch (fase) {
    case 'Integración del Expediente':
      return validarFase1Integracion(context);
    case 'Análisis de Expediente Operativo':
      return validarFase2Operativo(context, accion);
    case 'Análisis de Expediente Jurídico':
      return validarFase3Juridico(context, accion);
    case 'Formalización de Cuenta Financiera':
      return validarFase4Formalizacion(context, accion);
    case 'Validación de Contratos y Pagarés Firmados':
      return validarFase5Contratos(context, accion);
    case 'Solicitud de Activación de Cuenta Financiera':
      return validarFase6SolicitudActivacion(context, accion);
    case 'Activación de Cuenta Financiera':
      return validarFase7Activacion(context, accion);
    default:
      return {
        accionPermitida: false,
        fase,
        faseDestino: null,
        motivos: [`Fase desconocida: ${fase}`],
        validaciones: {
          documentosCompletos: false,
          notaReciente: false,
          garantiasSuficientes: false,
          comitesAutorizados: false,
          beneficiariosCompletos: false,
          solicitudPagoCompletado: false,
        },
        actualizaciones: [],
      };
  }
}

function validarFase1Integracion(context: OriginacionContext): ReglaValidacionResult {
  const { fase, tipoPersona, documentos, header } = context;
  const docsValidacion = validarDocumentosObligatorios(fase, tipoPersona, documentos);

  if (!docsValidacion.valido) {
    return {
      accionPermitida: false,
      fase,
      faseDestino: null,
      motivos: [`Documentos obligatorios faltantes: ${docsValidacion.faltantes.join(', ')}`],
      validaciones: {
        documentosCompletos: false,
        notaReciente: true,
        garantiasSuficientes: true,
        comitesAutorizados: true,
        beneficiariosCompletos: true,
        solicitudPagoCompletado: true,
      },
      actualizaciones: [],
      documentosFaltantes: docsValidacion.faltantes,
    };
  }

  const faseDestino = getSiguienteFase(fase);
  return {
    accionPermitida: true,
    fase,
    faseDestino,
    motivos: ['Documentación completa. Avanzando a la siguiente fase.'],
    validaciones: {
      documentosCompletos: true,
      notaReciente: true,
      garantiasSuficientes: true,
      comitesAutorizados: true,
      beneficiariosCompletos: true,
      solicitudPagoCompletado: true,
    },
    actualizaciones: [{
      faseActual: fase,
      faseDestino: faseDestino!,
      estatusSolicitud: 'En Proceso',
    }],
  };
}

function validarFase2Operativo(
  context: OriginacionContext,
  accion: 'enviarFase' | 'regresarFase' | 'formalizarContrato' | 'solicitudActivacion' | 'activarCuenta'
): ReglaValidacionResult {
  const { fase, tipoPersona, documentos, notas } = context;

  if (accion === 'enviarFase') {
    const docsValidacion = validarDocumentosObligatorios(fase, tipoPersona, documentos);
    if (!docsValidacion.valido) {
      return {
        accionPermitida: false,
        fase,
        faseDestino: null,
        motivos: [`Documentos obligatorios faltantes: ${docsValidacion.faltantes.join(', ')}`],
        validaciones: { documentosCompletos: false, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
        actualizaciones: [],
        documentosFaltantes: docsValidacion.faltantes,
      };
    }
    const faseDestino = getSiguienteFase(fase);
    return {
      accionPermitida: true,
      fase,
      faseDestino,
      motivos: ['Documentación completa. Avanzando a la siguiente fase.'],
      validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
      actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }],
    };
  }

  if (accion === 'regresarFase') {
    if (!validarNotaReciente(notas)) {
      return {
        accionPermitida: false,
        fase,
        faseDestino: null,
        motivos: ['Debe existir al menos una nota creada en los últimos 30 minutos para regresar de fase'],
        validaciones: { documentosCompletos: true, notaReciente: false, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
        actualizaciones: [],
      };
    }
    const faseDestino = getFaseAnterior(fase);
    return {
      accionPermitida: true,
      fase,
      faseDestino,
      motivos: ['Nota reciente encontrada. Regresando a la fase anterior.'],
      validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
      actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }],
    };
  }

  return { accionPermitida: false, fase, faseDestino: null, motivos: ['Acción no permitida en esta fase'], validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true }, actualizaciones: [] };
}

function validarFase3Juridico(
  context: OriginacionContext,
  accion: 'enviarFase' | 'regresarFase' | 'formalizarContrato' | 'solicitudActivacion' | 'activarCuenta'
): ReglaValidacionResult {
  const { fase, tipoPersona, documentos, notas } = context;

  if (accion === 'enviarFase') {
    const docsValidacion = validarDocumentosObligatorios(fase, tipoPersona, documentos);
    if (!docsValidacion.valido) {
      return {
        accionPermitida: false,
        fase,
        faseDestino: null,
        motivos: [`Documentos obligatorios faltantes: ${docsValidacion.faltantes.join(', ')}`],
        validaciones: { documentosCompletos: false, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
        actualizaciones: [],
        documentosFaltantes: docsValidacion.faltantes,
      };
    }
    const faseDestino = getSiguienteFase(fase);
    return {
      accionPermitida: true,
      fase,
      faseDestino,
      motivos: ['Documentación jurídica completa. Avanzando a la siguiente fase.'],
      validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
      actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }],
    };
  }

  if (accion === 'regresarFase') {
    if (!validarNotaReciente(notas)) {
      return {
        accionPermitida: false,
        fase,
        faseDestino: null,
        motivos: ['Debe existir al menos una nota creada en los últimos 30 minutos para regresar de fase'],
        validaciones: { documentosCompletos: true, notaReciente: false, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
        actualizaciones: [],
      };
    }
    const faseDestino = getFaseAnterior(fase);
    return {
      accionPermitida: true,
      fase,
      faseDestino,
      motivos: ['Nota reciente encontrada. Regresando a la fase anterior.'],
      validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
      actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }],
    };
  }

  return {
    accionPermitida: false,
    fase,
    faseDestino: null,
    motivos: ['Acción no permitida en esta fase'],
    validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
    actualizaciones: [],
  };
}

function validarFase4Formalizacion(
  context: OriginacionContext,
  accion: 'enviarFase' | 'regresarFase' | 'formalizarContrato' | 'solicitudActivacion' | 'activarCuenta'
): ReglaValidacionResult {
  const { fase, tipoPersona, documentos, notas, lineaProducto, tipoProducto, header, garantias } = context;

  if (accion === 'formalizarContrato') {
    // Solo genera el contrato/pagaré para revisión e impresión.
    // NO avanza de fase — el avance ocurre con "Enviar de Fase".
    const contrato = generarContrato(lineaProducto, tipoProducto, header, garantias);
    return {
      accionPermitida: true,
      fase,
      faseDestino: null,
      motivos: ['Contrato y pagaré generados. Revise e imprima los documentos antes de avanzar.'],
      validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
      actualizaciones: [],
      contrato,
    };
  }

  if (accion === 'enviarFase') {
    const docsValidacion = validarDocumentosObligatorios(fase, tipoPersona, documentos);
    if (!docsValidacion.valido) {
      return { accionPermitida: false, fase, faseDestino: null, motivos: [`Documentos obligatorios faltantes: ${docsValidacion.faltantes.join(', ')}`], validaciones: { documentosCompletos: false, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true }, actualizaciones: [], documentosFaltantes: docsValidacion.faltantes };
    }
    const faseDestino = getSiguienteFase(fase);
    return { accionPermitida: true, fase, faseDestino, motivos: ['Documentación completa. Avanzando a la siguiente fase.'], validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true }, actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }] };
  }

  if (accion === 'regresarFase') {
    if (!validarNotaReciente(notas)) {
      return { accionPermitida: false, fase, faseDestino: null, motivos: ['Debe existir al menos una nota creada en los últimos 30 minutos para regresar de fase'], validaciones: { documentosCompletos: true, notaReciente: false, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true }, actualizaciones: [] };
    }
    const faseDestino = getFaseAnterior(fase);
    return { accionPermitida: true, fase, faseDestino, motivos: ['Nota reciente encontrada. Regresando a la fase anterior.'], validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true }, actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }] };
  }

  return { accionPermitida: false, fase, faseDestino: null, motivos: ['Acción no permitida en esta fase'], validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true }, actualizaciones: [] };
}

function validarFase5Contratos(
  context: OriginacionContext,
  accion: 'enviarFase' | 'regresarFase' | 'formalizarContrato' | 'solicitudActivacion' | 'activarCuenta'
): ReglaValidacionResult {
  const { fase, tipoPersona, documentos, notas } = context;

  if (accion === 'enviarFase') {
    const docsValidacion = validarDocumentosObligatorios(fase, tipoPersona, documentos);
    if (!docsValidacion.valido) {
      return {
        accionPermitida: false,
        fase,
        faseDestino: null,
        motivos: [`Documentos obligatorios faltantes: ${docsValidacion.faltantes.join(', ')}`],
        validaciones: { documentosCompletos: false, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
        actualizaciones: [],
        documentosFaltantes: docsValidacion.faltantes,
      };
    }
    const faseDestino = getSiguienteFase(fase);
    return {
      accionPermitida: true,
      fase,
      faseDestino,
      motivos: ['Contratos y pagarés validados. Avanzando a la siguiente fase.'],
      validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
      actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }],
    };
  }

  if (accion === 'regresarFase') {
    if (!validarNotaReciente(notas)) {
      return {
        accionPermitida: false,
        fase,
        faseDestino: null,
        motivos: ['Debe existir al menos una nota creada en los últimos 30 minutos para regresar de fase'],
        validaciones: { documentosCompletos: true, notaReciente: false, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
        actualizaciones: [],
      };
    }
    const faseDestino = getFaseAnterior(fase);
    return {
      accionPermitida: true,
      fase,
      faseDestino,
      motivos: ['Nota reciente encontrada. Regresando a la fase anterior.'],
      validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
      actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }],
    };
  }

  return {
    accionPermitida: false,
    fase,
    faseDestino: null,
    motivos: ['Acción no permitida en esta fase'],
    validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
    actualizaciones: [],
  };
}

function validarFase6SolicitudActivacion(
  context: OriginacionContext,
  accion: 'enviarFase' | 'regresarFase' | 'formalizarContrato' | 'solicitudActivacion' | 'activarCuenta'
): ReglaValidacionResult {
  const { fase, notas, lineaProducto, header, garantias, comites, cargos, requiereGarantia, requiereComite } = context;
  const montoAutorizado = header.montoAutorizado || 0;

  const V_OK = { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true };

  if (accion === 'solicitudActivacion') {
    const errores: string[] = [];
    let cuenta: CuentaPorCrear | undefined;

    if (lineaProducto === 'Crédito') {
      // Validar garantías solo si el producto lo requiere
      if (requiereGarantia && !validarGarantiasSuficientes(garantias, montoAutorizado)) {
        errores.push('El Acuerdo de Garantías no cubre el monto requerido');
      }
      // Validar comités solo si el producto lo requiere
      if (requiereComite && !validarComitesAutorizados(comites)) {
        errores.push('Los Comités no están todos autorizados');
      }
      if (errores.length === 0) {
        // Crear Cuenta por Pagar; si solo hay Capital, se toma de Cargos via cargos param
        cuenta = crearCuentaPorPagar(header, cargos);
      }
    } else if (lineaProducto === 'Captación') {
      // Captación: crear Cuenta por Cobrar directamente (sin validar garantías/comités)
      cuenta = crearCuentaPorCobrar(header, cargos);
    } else if (lineaProducto === 'Línea de Crédito') {
      // Línea de Crédito: actúa como "Enviar Solicitud" — avanza automáticamente
      if (requiereGarantia && !validarGarantiasSuficientes(garantias, montoAutorizado)) {
        errores.push('El Acuerdo de Garantías no cubre el monto requerido');
      }
      if (requiereComite && !validarComitesAutorizados(comites)) {
        errores.push('Los Comités no están todos autorizados');
      }
      // Línea de Crédito NO genera Cuenta — avanza directamente
    }

    if (errores.length > 0) {
      return {
        accionPermitida: false,
        fase,
        faseDestino: null,
        motivos: errores,
        validaciones: {
          ...V_OK,
          garantiasSuficientes: !(requiereGarantia && !validarGarantiasSuficientes(garantias, montoAutorizado)),
          comitesAutorizados: !(requiereComite && !validarComitesAutorizados(comites)),
        },
        actualizaciones: [],
        cuenta,
      };
    }

    const faseDestino = getSiguienteFase(fase);
    const mensaje = lineaProducto === 'Línea de Crédito'
      ? 'Validaciones completadas. Avanzando a la siguiente fase.'
      : lineaProducto === 'Captación'
        ? 'Cuenta por Cobrar generada. Avanzando a la siguiente fase.'
        : 'Cuenta por Pagar generada. Avanzando a la siguiente fase.';

    return {
      accionPermitida: true,
      fase,
      faseDestino,
      motivos: [mensaje],
      validaciones: V_OK,
      actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }],
      cuenta,
    };
  }

  if (accion === 'regresarFase') {
    if (!validarNotaReciente(notas)) {
      return {
        accionPermitida: false,
        fase,
        faseDestino: null,
        motivos: ['Debe existir al menos una nota creada en los últimos 30 minutos para regresar de fase'],
        validaciones: { ...V_OK, notaReciente: false },
        actualizaciones: [],
      };
    }
    const faseDestino = getFaseAnterior(fase);
    return {
      accionPermitida: true,
      fase,
      faseDestino,
      motivos: ['Nota reciente encontrada. Regresando a la fase anterior.'],
      validaciones: V_OK,
      actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }],
    };
  }

  return {
    accionPermitida: false,
    fase,
    faseDestino: null,
    motivos: ['Acción no permitida en esta fase'],
    validaciones: V_OK,
    actualizaciones: [],
  };
}

function validarFase7Activacion(
  context: OriginacionContext,
  accion: 'enviarFase' | 'regresarFase' | 'formalizarContrato' | 'solicitudActivacion' | 'activarCuenta'
): ReglaValidacionResult {
  const { fase, lineaProducto, solicitudActivacion, notas } = context;

  if (accion === 'activarCuenta') {
    if (lineaProducto === 'Crédito' || lineaProducto === 'Captación') {
      if (!solicitudActivacion || !validarSolicitudPago(solicitudActivacion)) {
        return {
          accionPermitida: false,
          fase,
          faseDestino: null,
          motivos: [`La Solicitud de Activación debe estar Pagada para productos ${lineaProducto}`],
          validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: false },
          actualizaciones: [],
        };
      }
    }

    return {
      accionPermitida: true,
      fase,
      faseDestino: fase,
      motivos: ['Cuenta activada exitosamente. Estatus actualizados.'],
      validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true },
      actualizaciones: [{
        faseActual: fase,
        faseDestino: fase,
        estatusSolicitud: 'Autorizada',
        estatusCuenta: 'Activa',
        estatusPago: 'Pagado',
        estatusCartera: 'Activa',
      }],
    };
  }

  if (accion === 'regresarFase') {
    if (!validarNotaReciente(notas)) {
      return { accionPermitida: false, fase, faseDestino: null, motivos: ['Debe existir al menos una nota creada en los últimos 30 minutos para regresar de fase'], validaciones: { documentosCompletos: true, notaReciente: false, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true }, actualizaciones: [] };
    }
    const faseDestino = getFaseAnterior(fase);
    return { accionPermitida: true, fase, faseDestino, motivos: ['Nota reciente encontrada. Regresando a la fase anterior.'], validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true }, actualizaciones: [{ faseActual: fase, faseDestino: faseDestino! }] };
  }

  return { accionPermitida: false, fase, faseDestino: null, motivos: ['Acción no permitida en esta fase'], validaciones: { documentosCompletos: true, notaReciente: true, garantiasSuficientes: true, comitesAutorizados: true, beneficiariosCompletos: true, solicitudPagoCompletado: true }, actualizaciones: [] };
}

export function toJSON(result: ReglaValidacionResult): string {
  return JSON.stringify(result, null, 2);
}
