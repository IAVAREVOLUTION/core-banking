export type FormModeLineaCredito = 'create' | 'edit' | 'view';

export interface GarantiaLineaCredito {
  id: number;
  tipo: string;
  subtipo: string;
  descripcion: string;
  aforo: string;
}

export interface JerarquiaProductoLineaCredito {
  id: number;
  principal: boolean;
  producto: string;
  porcentajeLimiteMaximo: number | string;
  numeroLimiteMaximo: number | string;
  frecuenciaMaxima: number | string;
  spreadMinimo: number | string;
  porcentajeRentabilidad: number | string;
  observaciones: string;
  sga: string;
  porcentajeSga: number | string;
  montoSga: number | string;
}

export interface ComiteCreditoLineaCredito {
  id: number;
  comiteInterno: string;
  desdeMonto: number | string;
  hastaMonto: number | string;
  activo: boolean;
  renovaciones: number | string;
}

export interface PeriodicidadLineaCredito {
  id: number;
  periodicidad: string;
  observaciones: string;
}

export interface FaseLineaCredito {
  id: number;
  fase: string;
  numeroFase: number | string;
  posicion: string;
}

export interface MatrizTasaFijaLineaCredito {
  id: number;
  plazoMinimo: number | string;
  plazoMaximo: number | string;
  frecuencia: string;
  tasaAplicable: number | string;
  aplicaValorResidual: boolean;
  valorResidual: number | string;
  inicioVigencia: string;
  finVigencia: string;
  diasAnticipoFondeador: string;
}

export interface IvaPorcentajeLineaCredito {
  id: number;
  zonaFronteriza: boolean;
  porcentaje: number | string;
}

export interface ExentoIvaLineaCredito {
  id: number;
  tipoPersona: string;
  exentoIva: boolean;
  comentarios: string;
}

export interface CheckListLineaCredito {
  id: number;
  tipoPersona: string;
  tipoDocumento: string;
  requerido: boolean;
  permanente: boolean;
  descripcion: string;
  requeridoPor: string;
  esquemaFirma: string;
  proceso: string;
  fases: string;
}

export interface ProductoLineaCredito {
  id: number;
  /** UUID de la llave primaria en J_PRODUCTOS — para CRUD contra Supabase */
  dbUuid?: string;
  
  // Columna izquierda
  nombre: string;
  clave: string;
  descripcion: string;
  tipoProducto: string;
  subTipo: string;
  sucursal: string;
  nombreEquipoAnalista: string;
  nombreEquipoAnalistaMesa: string;
  
  // Columna central
  tipoLinea: string;
  montoMinimo: number | string;
  montoMaximo: number | string;
  permiteSobregiros: boolean;
  tipoSobregiro: string;
  montoOPorcentaje: string;
  numDisposicionesAbiertas: number | string;
  intervaloCleanUp: number | string;
  verificacionCleanUp: boolean;
  
  // Columna derecha
  porcentajeComisionApertura: number | string;
  plazoMinimoDisposicion: number | string;
  plazoMaximoDisposicion: number | string;
  diasGraciaDisposicion: number | string;
  vigenciaLineaDias: number | string;
  porcentajeInteresMoratorio: number | string;
  diasParaRenovacion: number | string;
  
  // Campos para tabla
  claveIbs?: string;
  vodRowId?: string;
  opcionCompra?: string;
  porcentajeOpcionCompra?: number | string;
  tasaBase?: string;
  calculo?: string;
  productoSeg?: string;
  referenciaCliente?: string;
  referenciaProducto?: string;
  rentabilidad?: number | string;
  tasa?: number | string;
  
  // Tabs
  garantias?: GarantiaLineaCredito[];
  jerarquias?: JerarquiaProductoLineaCredito[];
  comites?: ComiteCreditoLineaCredito[];
  periodicidades?: PeriodicidadLineaCredito[];
  fases?: FaseLineaCredito[];
  matrizTasaFija?: MatrizTasaFijaLineaCredito[];
  ivaPorcentaje?: IvaPorcentajeLineaCredito[];
  exentoIva?: ExentoIvaLineaCredito[];
  checkList?: CheckListLineaCredito[];
  condicionesDisposicion?: any[];
  parametrosCalculo?: any[];
  // Subtabs adicionales (forwardRef tabs)
  paquetes?: any[];
  sucursales?: any[];
  cargos?: any[];
  comisionesTab?: any[];
  matrizTasaVariable?: any[];
  // Subtabs homologados (periodos, tasas referencia, expedientes/requisitos)
  periodosRegistros?: any[];
  tasasReferenciaRegistros?: any[];
  expedientes?: any[];
  
  // Campos del sistema (mantener para compatibilidad)
  lineaProducto: string;
  sublineaProducto: string;
  estatus: string;
  fechaRegistro: string;
  moneda: string;
  usuarioRegistro: string;
  puestoTrabajo: string;
  tipoTasa: string;
  baseCalculo: string;
  aplicaInteresMoratorio: boolean;
  
  // Nuevos campos para tab Default
  formaDisposicion?: string;
  renovable?: boolean;
  frecuenciaRevision?: string;
  tipoGarantia?: string;
  destino?: string;
  tasaOrdinaria?: number | string;
  spread?: number | string;
  factorMoratorio?: number | string;
  comisiones?: string;
  iva?: number | string;
  formaDevengo?: string;
  metodoInteres?: string;
  periodicidadIntereses?: string;
}