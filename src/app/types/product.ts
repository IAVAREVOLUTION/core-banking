export interface Product {
  id: number;
  nombre: string;
  descripcion: string;
  lineaProducto: string;
  sublineaProducto: string;
  moneda: string;
  estatus: 'Activo' | 'Inactivo' | 'Pendiente';
  tipoTasa: 'Fija' | 'Variable';
  sucursal: string;
  fechaRegistro: string;
  // PK de J_PRODUCTOS — se mapea como campo oculto para CRUD
  identificacion?: string | number;
  // UUID devuelto por J_PRODUCTOS al insertar — se usa para UPDATE posteriores
  dbUuid?: string | null;
  // ID del producto extraído del JSONB (datos.idProducto)
  idProducto?: string;
  cat?: number;
  baseCalculo: '360' | '180';
  aplicaInteresMoratorio: boolean;
  numeroVecesMoratorio?: number;
  aplicaMoraAPartir?: number;
  saldoMinimoPromedio?: number;
  
  // Campos específicos de Línea de Crédito
  clave?: number;
  claveEBS?: string;
  vddRowId?: string;
  tipoProducto?: string;
  opcionCompra?: string;
  porcentajeOpcionCompra?: number;
  tasaBase?: number;
  calculo?: string;
  productoSegu?: string;
  referenciaCliente?: string;
  referenciaProducto?: string;
  rentabilidad?: number;
  tasa?: number;
  subTipo?: string;
  nombreEquipoAnalista?: string;
  nombreEquipoAnalistaMesa?: string;
  tipoLinea?: string;
  montoMinimo?: number;
  montoMaximo?: number;
  permiteSobregiros?: boolean;
  tipoSobregiro?: string;
  montoPorcentajeSobregiro?: number;
  numDisposicionesAbiertas?: number;
  intervaloCleanUp?: number;
  verificacionCleanUp?: boolean;
  porcentajeComisionApertura?: number;
  plazoMinimoDisposicion?: number;
  plazoMaximoDisposicion?: number;
  diasGraciaDisposicion?: number;
  vigenciaLineaDias?: number;
  porcentajeInteresMoratorio?: number;
  diasParaRenovacion?: number;
  
  // Campos específicos de Captación
  producto?: string;
  cuentaEje?: boolean; // Cambiado de string a boolean para checkbox
  clave?: string | number; // Puede ser string (PC-001) o number (para Crédito)
  tipoPersona?: string;
  tipoDocumento?: string;
  requerido?: string; // "Sí" o "No"
  permanente?: string; // "Sí" o "No"
  requeridoPor?: string;
  esquemaFirma?: string;
  procede?: string;
  fases?: any[] | string | {
    requiereAutorizacionGerencia?: boolean;
    requiereValidacionCompliance?: boolean;
    requiereRevisionMesaControl?: boolean;
    requiereAprobacionComite?: boolean;
    diasVigenciaAutorizacion?: number;
    observaciones?: string;
  };
  descuentoNomina?: boolean; // Campo checkbox para Descuento en Nómina
  
  // === DETALLE: Tab "Default" - Datos Generales de Captación ===
  tasaBase?: string | number; // Puede ser string "Fija" o number para Crédito
  capitalizaIntereses?: boolean;
  frecuenciaPagoIntereses?: string;
  plazo?: string;
  periodoCorte?: string;
  diasVentana?: string;
  montoMinimo?: number | string;
  montoMaximo?: number | string;
  numeroMaximoRenovaciones?: string;
  tasaInicial?: string;
  porcentajeIncremento?: string;
  tasaMinima?: string;
  tasaMaxima?: string;
  
  // === DETALLE: Tab "Check List Captaciones" ===
  checkListCaptaciones?: {
    requiereIdentificacion?: boolean;
    requiereComprobantedomicilio?: boolean;
    requiereRFC?: boolean;
    requiereCURP?: boolean;
    requiereEstadoCuenta?: boolean;
    requiereActaConstitutiva?: boolean;
    requierePoderNotarial?: boolean;
    observaciones?: string;
  };
  
  // === DETALLE: Tab "Tasa de Inversión" ===
  tasaInversion?: {
    tasaTipoCalculo?: string;
    tasaPorcentajeBase?: number;
    tasaPorcentajeAdicional?: number;
    tasaTotalCalculada?: number;
    tasaIndexada?: string;
    puntosSobreTasa?: number;
    aplicaCapitalizacion?: boolean;
    frecuenciaCapitalizacion?: string;
    diasBaseCalculo?: number;
  };
  
  // === DETALLE: Tab "Constitución" ===
  constitucion?: {
    montoMinimoCuenta?: number;
    montoMaximoCuenta?: number;
    plazoDiasCuenta?: number;
    permiteFondeoInicial?: boolean;
    montoFondeoMinimo?: number;
    permiteFondeosParciales?: boolean;
    numeroMaximoAbonos?: number;
    cobraPenalidadRetiroAnticipado?: boolean;
    porcentajePenalidad?: number;
    observaciones?: string;
  };
  
  // === DETALLE: Tab "Comisiones" ===
  comisiones?: any[] | {
    cobraComisionApertura?: boolean;
    montoComisionApertura?: number;
    porcentajeComisionApertura?: number;
    cobraComisionManejo?: boolean;
    montoComisionManejo?: number;
    frecuenciaCobroManejo?: string;
    cobraComisionCancelacion?: boolean;
    montoComisionCancelacion?: number;
    cobraComisionRetiroAnticipado?: boolean;
    porcentajeRetiroAnticipado?: number;
    observaciones?: string;
  };
  
  // === ARRAYS DE REGISTROS DE LOS TABS ===
  // Estos arrays almacenan los registros de las tablas dentro de cada tab
  comisionesRegistros?: Comision[]; // Array de comisiones del tab Comisiones
  checkListCaptacionesRegistros?: any[]; // Array de check lists del tab Check List
  tasaInversionRegistros?: any[]; // Array de tasas del tab Tasa de Inversión  
  constitucionRegistros?: any[]; // Array de registros del tab Constitución
  fasesRegistros?: any[]; // Array de fases del tab Fases
  cargoRegistros?: any[]; // Array de cargos del tab Cargo
  checkListRegistros?: any[]; // Array de check lists (alias directo de d.checkListRegistros)
  
  // === ARRAYS DE DETALLE DE CRÉDITO (tabs maestro-detalle) ===
  // Estos campos se llenan al guardar desde ProductoForm vía refs getData()
  // y se pasan como initialData cuando se re-abre el producto para editar/ver
  matrizTasaFija?: any[];
  matrizTasaVariable?: any[];
  requisitos?: any[];
  paquetes?: any[];
  sucursales?: any[];
  cargos?: any[];
  prelacion?: any[];
  impuestos?: any[];
  tabulador?: any[];
  periodos?: any[];
  tasasReferencia?: any[];
  garantias?: any[];
  plantillas?: PlantillaInstitucional[];

  // === SUBTABS ESTÁTICOS DE CRÉDITO (se guardan/leen del JSONB) ===
  amortizaciones?: any[];
  expedientesElectronicos?: any[];
  autorizacionNiveles?: any[];
  eventoContable?: any[];

  // Campos del sistema
  usuarioRegistro: string;
  puestoTrabajo: string;
}

export interface Periodo {
  id: number;
  productoId: number;
  periodo: string;
  descripcion: string;
}

export interface MatrizTasaFija {
  id: number;
  productoId: number;
  plazoInicial: number;
  plazoFinal: number;
  montoInicial: number;
  montoFinal: number;
  tasa: number;
}

export interface TasaReferencia {
  id: number;
  productoId: number;
  nombre: string;
  descripcion: string;
  valor: number;
  fechaVigencia: string;
}

export interface MatrizTasaVariable {
  id: number;
  productoId: number;
  tasaReferenciaId: number;
  plazoInicial: number;
  plazoFinal: number;
  puntos: number;
}

export interface Requisito {
  id: number;
  productoId: number;
  nombre: string;
  descripcion: string;
  obligatorio: boolean;
}

export interface Cargo {
  id: number;
  productoId: number;
  concepto: string;
  monto: number;
  tipo: 'Fijo' | 'Porcentaje';
  frecuencia: string;
}

export interface Comision {
  id: number;
  productoId: number;
  concepto: string;
  monto: number;
  tipo: 'Fijo' | 'Porcentaje';
}

// === Plantillas Institucionales (subtab Plantillas) ===
export type TipoPlantilla = 'solicitud' | 'contrato' | 'pagare' | 'minuta';

export interface PlantillaInstitucional {
  id: number;
  productId: number;
  nombre: string;
  tipoPlantilla: TipoPlantilla;
  archivoBase: string;       // Nombre del archivo (PDF, DOCX o HTML)
  archivoData?: string;      // Data URL del archivo cargado (base64)
  version: string;
  estatus: 'Activo' | 'Inactivo';
  fechaCreacion: string;
  fechaModificacion: string;
}

export const TIPO_PLANTILLA_OPTIONS: TipoPlantilla[] = ['solicitud', 'contrato', 'pagare', 'minuta'];

export interface TipoPlantillaOption {
  value: TipoPlantilla;
  label: string;
  descripcion: string;
  icon: string;
  color: string;
}

export const TIPO_PLANTILLA_CATALOGO: TipoPlantillaOption[] = [
  {
    value: 'solicitud',
    label: 'Solicitud de Crédito',
    descripcion: 'Formato de solicitud formal del producto financiero por parte del cliente',
    icon: '📋',
    color: '#2196F3',
  },
  {
    value: 'contrato',
    label: 'Contrato de Operación',
    descripcion: 'Instrumento legal que formaliza la relación jurídica entre la institución y el cliente',
    icon: '📄',
    color: '#4CAF50',
  },
  {
    value: 'pagare',
    label: 'Pagare',
    descripcion: 'Título de crédito que ampara la obligación de pago a favor de la institución',
    icon: '📝',
    color: '#FF9800',
  },
  {
    value: 'minuta',
    label: 'Minuta de Acuerdos',
    descripcion: 'Registro formal de acuerdos, términos y condiciones pactados entre las partes',
    icon: '📑',
    color: '#9C27B0',
  },
];

/** Obtiene la metadata de un tipo de plantilla por su valor */
export function getTipoPlantillaMeta(value: TipoPlantilla): TipoPlantillaOption | undefined {
  return TIPO_PLANTILLA_CATALOGO.find(t => t.value === value);
}

export type FormMode = 'view' | 'edit' | 'create';