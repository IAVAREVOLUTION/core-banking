export interface TasaInversion {
  id: number;
  tipoProducto: string;
  empleado: string;
  minimoEmpleado: number;
  tasaMinima: number;
  tasaInicial: number;
  tasaMaxima: number;
  porcentajeIncremento: number;
  inicioVigencia: string;
  finVigencia: string;
  estatus: 'Activo' | 'Inactivo';
  vigenciaTasas: string;
  tipoTasa: string;
}
