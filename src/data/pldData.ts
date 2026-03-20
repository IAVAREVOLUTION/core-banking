import { RegistroPLD, AlertaPLD, PerfilTransaccional, CalificacionRiesgo, KYCInfo, ParametroPLD } from '@/types/pld';

export const registrosPLD: RegistroPLD[] = [
  {
    id: 1,
    fechaCreacion: '15/01/2026 09:30',
    cliente: 'Juan Pérez García',
    tipoOperacion: 'Depósito en efectivo',
    tipoAlerta: 'Relevante',
    estatus: 'En Análisis',
    usuarioResponsable: 'Ana Martínez',
    resultadoAnalisis: 'En proceso',
    enviadoAutoridad: 'No'
  },
  {
    id: 2,
    fechaCreacion: '14/01/2026 14:15',
    cliente: 'María González López',
    tipoOperacion: 'Transferencia internacional',
    tipoAlerta: 'Inusual',
    estatus: 'Cerrado',
    usuarioResponsable: 'Carlos Ramírez',
    resultadoAnalisis: 'Sin riesgo detectado',
    enviadoAutoridad: 'No'
  },
  {
    id: 3,
    fechaCreacion: '13/01/2026 11:45',
    cliente: 'Empresa XYZ SA de CV',
    tipoOperacion: 'Retiro en efectivo',
    tipoAlerta: 'Relevante',
    estatus: 'Enviado',
    usuarioResponsable: 'Luis Hernández',
    resultadoAnalisis: 'Operación relevante reportada',
    enviadoAutoridad: 'Sí'
  },
  {
    id: 4,
    fechaCreacion: '12/01/2026 16:20',
    cliente: 'Roberto Sánchez Cruz',
    tipoOperacion: 'Compra de divisas',
    tipoAlerta: 'Interna',
    estatus: 'Activo',
    usuarioResponsable: 'Patricia Torres',
    resultadoAnalisis: 'Pendiente',
    enviadoAutoridad: 'No'
  },
  {
    id: 5,
    fechaCreacion: '11/01/2026 10:00',
    cliente: 'Sofía Morales Díaz',
    tipoOperacion: 'Transferencia nacional',
    tipoAlerta: 'Preocupante',
    estatus: 'En Análisis',
    usuarioResponsable: 'Miguel Ángel Rojas',
    resultadoAnalisis: 'En revisión profunda',
    enviadoAutoridad: 'No'
  },
  {
    id: 6,
    fechaCreacion: '10/01/2026 13:30',
    cliente: 'Inversiones ABC SA',
    tipoOperacion: 'Depósito en efectivo',
    tipoAlerta: 'Relevante',
    estatus: 'Cerrado',
    usuarioResponsable: 'Laura Jiménez',
    resultadoAnalisis: 'Operación justificada',
    enviadoAutoridad: 'No'
  },
  {
    id: 7,
    fechaCreacion: '09/01/2026 15:45',
    cliente: 'Fernando Castro Ruiz',
    tipoOperacion: 'Transferencia internacional',
    tipoAlerta: 'Inusual',
    estatus: 'Activo',
    usuarioResponsable: 'Jorge Mendoza',
    resultadoAnalisis: 'Pendiente',
    enviadoAutoridad: 'No'
  },
  {
    id: 8,
    fechaCreacion: '08/01/2026 09:15',
    cliente: 'Construcciones DEF SA',
    tipoOperacion: 'Pago a proveedores',
    tipoAlerta: 'Interna',
    estatus: 'Cerrado',
    usuarioResponsable: 'Daniela Vargas',
    resultadoAnalisis: 'Sin hallazgos',
    enviadoAutoridad: 'No'
  },
  {
    id: 9,
    fechaCreacion: '07/01/2026 12:00',
    cliente: 'Andrea Flores Méndez',
    tipoOperacion: 'Retiro en efectivo',
    tipoAlerta: 'Preocupante',
    estatus: 'En Análisis',
    usuarioResponsable: 'Ricardo Ortiz',
    resultadoAnalisis: 'Análisis en curso',
    enviadoAutoridad: 'No'
  },
  {
    id: 10,
    fechaCreacion: '06/01/2026 17:30',
    cliente: 'Comercializadora GHI SA',
    tipoOperacion: 'Compra de divisas',
    tipoAlerta: 'Relevante',
    estatus: 'Enviado',
    usuarioResponsable: 'Gabriela Núñez',
    resultadoAnalisis: 'Reportado a CNBV',
    enviadoAutoridad: 'Sí'
  }
];

export const alertasPLD: AlertaPLD[] = [
  {
    id: 1,
    cliente: 'Juan Pérez García',
    tipoAlerta: 'Relevante',
    fecha: '15/01/2026',
    estatus: 'Activo',
    oficialAsignado: 'Ana Martínez',
    prioridad: 'Alta',
    fechaLimite: '20/01/2026',
    resultadoPreliminar: 'En revisión'
  },
  {
    id: 2,
    cliente: 'Sofía Morales Díaz',
    tipoAlerta: 'Preocupante',
    fecha: '11/01/2026',
    estatus: 'En Análisis',
    oficialAsignado: 'Miguel Ángel Rojas',
    prioridad: 'Alta',
    fechaLimite: '16/01/2026',
    resultadoPreliminar: 'Requiere atención'
  },
  {
    id: 3,
    cliente: 'Roberto Sánchez Cruz',
    tipoAlerta: 'Interna',
    fecha: '12/01/2026',
    estatus: 'Activo',
    oficialAsignado: 'Patricia Torres',
    prioridad: 'Media',
    fechaLimite: '19/01/2026',
    resultadoPreliminar: 'Pendiente'
  },
  {
    id: 4,
    cliente: 'Andrea Flores Méndez',
    tipoAlerta: 'Preocupante',
    fecha: '07/01/2026',
    estatus: 'En Análisis',
    oficialAsignado: 'Ricardo Ortiz',
    prioridad: 'Alta',
    fechaLimite: '14/01/2026',
    resultadoPreliminar: 'Investigación profunda'
  },
  {
    id: 5,
    cliente: 'Fernando Castro Ruiz',
    tipoAlerta: 'Inusual',
    fecha: '09/01/2026',
    estatus: 'Activo',
    oficialAsignado: 'Jorge Mendoza',
    prioridad: 'Media',
    fechaLimite: '17/01/2026',
    resultadoPreliminar: 'Análisis inicial'
  }
];

export const perfilesTransaccionales: PerfilTransaccional[] = [
  {
    id: 1,
    fechaInicio: '01/01/2026',
    fechaFin: '31/12/2026',
    estatus: 'Activo',
    producto: 'Cuenta de Ahorro',
    frecuencia: 'Mensual',
    tipoProducto: 'Captación',
    subtipo: 'Ahorro',
    plazo: '12 meses',
    maxPagosMes: 10,
    montoMaximoDiario: 50000,
    montoMaximoMensual: 500000
  }
];

export const parametrosPLD: ParametroPLD[] = [
  {
    clave: 'PLD_FACTOR_RIESGO',
    nombre: 'PLD Factor Riesgo',
    valor: 100,
    descripcion: 'Factor de ponderación de riesgo'
  },
  {
    clave: 'PLD_MONTO_MAX_USD',
    nombre: 'PLD Monto Máximo Operación USD',
    valor: 10000,
    descripcion: 'Monto máximo en USD para operaciones relevantes'
  },
  {
    clave: 'PLD_MONTO_MAX_FISICA',
    nombre: 'PLD Monto Max Física',
    valor: 500000,
    descripcion: 'Monto máximo para persona física en MXN'
  },
  {
    clave: 'PLD_MONTO_MAX_MORAL',
    nombre: 'PLD Monto Max Moral',
    valor: 5000000,
    descripcion: 'Monto máximo para persona moral en MXN'
  },
  {
    clave: 'PLD_PERSONA_FISICA',
    nombre: 'PLD Persona Física',
    valor: 'FÍSICA',
    descripcion: 'Tipo de persona física'
  },
  {
    clave: 'PLD_PERSONA_MORAL',
    nombre: 'PLD Persona Moral',
    valor: 'MORAL',
    descripcion: 'Tipo de persona moral'
  },
  {
    clave: 'PLD_SUJETO_OBLIGADO',
    nombre: 'PLD Sujeto Obligado',
    valor: 'Sí',
    descripcion: 'Institución es sujeto obligado'
  },
  {
    clave: 'PLD_ORGANO_SUPERVISOR',
    nombre: 'PLD Órgano Supervisor',
    valor: 'CNBV',
    descripcion: 'Comisión Nacional Bancaria y de Valores'
  }
];

export const catalogosPLD = {
  actividadEconomica: [
    'Servicios profesionales',
    'Comercio',
    'Construcción',
    'Manufactura',
    'Tecnología',
    'Agricultura',
    'Transporte',
    'Educación',
    'Salud',
    'Finanzas'
  ],
  paises: [
    'México',
    'Estados Unidos',
    'Canadá',
    'España',
    'Colombia',
    'Argentina',
    'Chile',
    'Brasil',
    'Perú',
    'Alemania'
  ],
  instrumentoMonetario: [
    'Efectivo',
    'Transferencia electrónica',
    'Cheque',
    'Tarjeta débito',
    'Tarjeta crédito',
    'Inversión',
    'Divisas'
  ],
  tipoOperacion: [
    'Depósito',
    'Retiro',
    'Transferencia nacional',
    'Transferencia internacional',
    'Compra divisas',
    'Venta divisas',
    'Pago servicios',
    'Pago préstamo'
  ],
  tipoAlerta: [
    'Relevante',
    'Inusual',
    'Interna',
    'Preocupante'
  ]
};

export const kycInfoDefault: KYCInfo = {
  pep: 'No',
  funcionarios: 'No',
  familiares: 'No',
  listasNegras: 'No',
  ingresos: 25000,
  actividadEconomica: 'Servicios profesionales',
  numeroSalarios: 5,
  fechaCalificacion: '01/01/2026'
};

export const calificacionRiesgoDefault: CalificacionRiesgo = {
  actividadEconomica: 15,
  residencia: 10,
  nacionalidad: 10,
  tipoPersona: 15,
  pepListasNegras: 20,
  calificacionPonderada: 70,
  resultado: 'Bajo'
};