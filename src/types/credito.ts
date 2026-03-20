export interface Credito {
  id: string;
  nroCredito: string;
  clienteId: string;
  clienteNombre: string;
  fechaCredito: string;
  montoSolicitado: number;
  montoAutorizado: number;
  lineaProducto: string;
  sublinea: string;
  producto: string;
  sucursal: string;
  estatusCredito: string;
  fechaInicio: string;
  fechaFin: string;
  createdById?: string;
  positionId?: string;
  branchId?: string;
}

export type FormModeCredito = 'create' | 'edit' | 'view';
