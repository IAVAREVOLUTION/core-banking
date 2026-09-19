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
  fechaHora: string;
  usuario: string;
  puesto?: string;
  area: string;
  descripcion: string;
  observaciones: string;
  estatus: string;
}

/**
 * Escalamiento de Comité por Monto — matriz de configuración del PRODUCTO
 * (no una bitácora de autorizaciones en tiempo de solicitud).
 * Ej.: $500,000,000 – $1,000,000,000 → COMITÉ 1.
 */
export interface ComiteEscalamientoMonto {
  id: number;
  montoDesde: number | string;
  montoHasta: number | string;
  comiteAsignado: string;
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

// ══════════════════════════════════════════════════════════════════
// Garantía Financiera 2o Piso (REQ-8)
// ══════════════════════════════════════════════════════════════════

/** Escenarios de la cascada de pagos (Cash Flow Waterfall) del fideicomiso. */
export type EscenarioPrelacion2oPiso = 'OPERACION_NORMAL' | 'BOTON_PANICO';

/**
 * Un renglón de la cascada de pagos. Se guarda un solo array con
 * discriminante `escenario` (no dos arrays), para que el motor de cascada
 * consuma el mismo shape filtrando.
 */
export interface PrelacionSegundoPiso {
  id: number;
  escenario: EscenarioPrelacion2oPiso;
  seq: number | string;
  concepto: string;
  valor: string;
}

/** Base sobre la que se calcula un porcentaje de cobertura o comisión. */
export type BaseCalculo2oPiso = 'Monto Emisión' | 'Saldo Garantizado' | '';

/** Un renglón del subtab Cobertura y Comisiones 2o Piso. */
export interface CoberturaComisiones2oPiso {
  id: number;
  productId: number;
  porcentajeMinCobertura: number | string;
  porcentajeDefaultCobertura: number | string;
  porcentajeMaxCobertura: number | string;
  sobreCobertura: BaseCalculo2oPiso;
  porcentajeMinComision: number | string;
  porcentajeDefaultComision: number | string;
  porcentajeMaxComision: number | string;
  sobreComision: BaseCalculo2oPiso;
}

/* ════════════════════════════════════════════════════════════════
 * Reglas de Pago y Corte TDC — subtab del producto Línea de Crédito
 * (tarjeta de crédito revolvente). Todo se guarda dentro del JSON
 * institucional J_PRODUCTOS.data → nodo `reglasPagoCorteTDC`.
 * ════════════════════════════════════════════════════════════════ */

/** A quién alcanza una nueva versión de la configuración. */
export type AplicacionVersionTDC = 'SOLO_NUEVAS' | 'EXISTENTES_Y_NUEVAS';

/** Un renglón del orden de aplicación de pagos (prelación de la TDC). */
export interface OrdenPrelacionTDC {
  id: number;
  seq: number;
  concepto: string;
}

/** Configuración única (no lista) de reglas de pago y corte de la TDC. */
export interface ReglasPagoCorteTDC {
  // ── [VIGENCIA DE LA CONFIGURACIÓN] ──
  claveRegla: string;
  version: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  /** Cuando es true, `vigenciaHasta` se ignora y la regla queda abierta. */
  vigenciaIndefinida: boolean;
  estatus: string;
  aplicacionNuevaVersion: AplicacionVersionTDC;

  // ── [CICLO DE CORTE] ──
  tipoCorte: string;
  diaCorte: number | string;
  diasFechaLimitePago: number | string;
  ajusteDiaInhabil: string;
  generarEstadoCuenta: boolean;
  horaCierre: string;

  // ── [PAGO MÍNIMO] ──
  pagoMinimoMetodo: string;
  pagoMinimoPorcentajeBase: number | string;
  pagoMinimoMontoAbsoluto: number | string;
  pagoMinimoAgregarSaldoVencido: boolean;
  /** Conceptos que suman al pago mínimo (catálogo en el subtab). */
  pagoMinimoConceptos: string[];

  // ── [PAGO PARA NO GENERAR INTERESES] ──
  pagoNoInteresesMetodo: string;
  pagoNoInteresesPorcentaje: number | string;
  pagoNoInteresesConceptos: string[];

  // ── [APLICACIÓN DE PAGOS] ──
  reglaPrelacion: string;
  ordenAplicacionPagos: OrdenPrelacionTDC[];
}

/**
 * Un renglón del subtab "Comisiones e IVA": cómo se cobra cada cargo permitido.
 * `clave` y `concepto` provienen del Catálogo de Componentes vía el cargo.
 */
export interface ComisionIvaCargo {
  clave: string;
  concepto: string;
  comisionFija: string;
  porcentajeComision: string;
  aplicaIva: 'S' | 'N';
  porcentajeIva: string;
}

/** Un movimiento suma al saldo (Cargo) o lo disminuye (Abono). */
export type NaturalezaMovimiento = 'Cargo' | 'Abono';

/**
 * Un renglón del subtab "Afectación de la línea": cómo mueve la línea
 * revolvente cada cargo permitido. 'S' | 'N' en lugar de booleanos porque así
 * se captura y se muestra (Sí/No) sin conversiones intermedias.
 */
export interface AfectacionLineaCargo {
  clave: string;
  concepto: string;
  naturaleza: NaturalezaMovimiento;
  consumeLineaDisponible: 'S' | 'N';
  /** Si el movimiento genera factura. */
  bFactura: 'S' | 'N';
  /** Si el movimiento genera cargo a la cuenta. */
  bCargo: 'S' | 'N';
  liberaLineaAlPagar: 'S' | 'N';
}

/**
 * Un valor numérico con la clave contable a la que se imputa. Es el
 * `valor|clave` de la especificación (p. ej. "250.00|021"), guardado separado
 * para no depender de parsear un string con pipe.
 */
export interface ValorConClave {
  valor: string;
  /** Código del Catálogo de Componentes; vacío si el valor no se imputa. */
  clave: string;
}

/** Un renglón del subtab "Prom Comis e Impue". */
export interface PromComisImpuesto {
  clave: string;
  concepto: string;
  comisionFija: ValorConClave;
  porcentajeComision: ValorConClave;
  porcentajeIvaComision: ValorConClave;
  porcentajeCashback: ValorConClave;
  plazo: ValorConClave;
  porcentajeInteresAnual: ValorConClave;
  porcentajeIvaInteres: ValorConClave;
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
  comiteEscalamiento?: ComiteEscalamientoMonto[];
  periodicidades?: PeriodicidadLineaCredito[];
  fases?: FaseLineaCredito[];
  matrizTasaFija?: MatrizTasaFijaLineaCredito[];
  ivaPorcentaje?: IvaPorcentajeLineaCredito[];
  exentoIva?: ExentoIvaLineaCredito[];
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
  plantillas?: any[];
  motorContable?: any[];
  // Subtabs de Garantía Financiera 2o Piso (REQ-8)
  prelacion2oPiso?: PrelacionSegundoPiso[];
  cobertura2oPiso?: CoberturaComisiones2oPiso[];
  // Subtab Reglas de Pago y Corte TDC (configuración única, no lista)
  reglasPagoCorteTDC?: ReglasPagoCorteTDC;
  // Subtab Prelación de cargos (reutiliza PrelacionTab de Producto Activo)
  prelacionCargos?: any[];
  // Subtab Comisiones e IVA (derivado de Cargos Permitidos)
  comisionesIva?: ComisionIvaCargo[];
  // Subtab Afectación de la línea (derivado de Cargos Permitidos)
  afectacionLinea?: AfectacionLineaCargo[];
  // Subtab Prom Comis e Impue
  promComisImpuestos?: PromComisImpuesto[];

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