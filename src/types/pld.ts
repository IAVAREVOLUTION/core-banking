// Tipos de datos para el módulo PLD

export interface RegistroPLD {
  id: number;
  fechaCreacion: string;
  cliente: string;
  tipoOperacion: string;
  tipoAlerta: 'Relevante' | 'Inusual' | 'Interna' | 'Preocupante';
  estatus: 'Activo' | 'En Análisis' | 'Cerrado' | 'Enviado';
  usuarioResponsable: string;
  resultadoAnalisis: string;
  enviadoAutoridad: 'Sí' | 'No';
}

export interface AlertaPLD {
  id: number;
  cliente: string;
  tipoAlerta: 'Relevante' | 'Inusual' | 'Interna' | 'Preocupante';
  fecha: string;
  estatus: 'Activo' | 'En Análisis' | 'Cerrado';
  oficialAsignado: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  fechaLimite: string;
  resultadoPreliminar: string;
}

export interface PerfilTransaccional {
  id: number;
  fechaInicio: string;
  fechaFin: string;
  estatus: 'Activo' | 'Inactivo';
  producto: string;
  frecuencia: string;
  tipoProducto: string;
  subtipo: string;
  plazo: string;
  maxPagosMes: number;
  montoMaximoDiario: number;
  montoMaximoMensual: number;
}

export interface CalificacionRiesgo {
  actividadEconomica: number; // 25%
  residencia: number; // 15%
  nacionalidad: number; // 15%
  tipoPersona: number; // 20%
  pepListasNegras: number; // 25%
  calificacionPonderada: number;
  resultado: 'Bajo' | 'Medio' | 'Alto';
}

export interface KYCInfo {
  pep: 'Sí' | 'No';
  funcionarios: 'Sí' | 'No';
  familiares: 'Sí' | 'No';
  listasNegras: 'Sí' | 'No';
  ingresos: number;
  actividadEconomica: string;
  numeroSalarios: number;
  fechaCalificacion: string;
}

export interface ParametroPLD {
  clave: string;
  nombre: string;
  valor: string | number;
  descripcion: string;
}
