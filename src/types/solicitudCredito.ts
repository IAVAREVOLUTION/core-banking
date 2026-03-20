export interface SolicitudCredito {
  id: number;
  noSolicitud: string;
  idSolicitud?: string;
  noCuenta?: string;
  cliente: string;
  fechaSolicitud: string;
  numeroIdentificacion?: string;
  montoSolicitado: number;
  montoAutorizado: number;
  montoAprobado?: string;
  lineaProducto: string;
  sublinea: string;
  producto: string;
  sucursal: string;
  estatusSolicitud: string;
  estatusPagare?: string;
  fechaInicio: string;
  fechaFin: string;
  fechaAprobacion?: string;
  tipoAmortizacion?: string;
  plazo?: string;
  periodicidad?: string;
  tasa?: string;
  ejecutivo?: boolean;
  ejecutivoNombre?: string;
  tipoIdentificacion?: string;
  intermediario?: boolean;
  zonaFiscal?: string;
  nombreTitular?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  domicilioCompleto?: string;
  createdById?: string;
  positionId?: string;
  branchId?: string;
}

export type FormModeSolicitud = 'create' | 'edit' | 'view';