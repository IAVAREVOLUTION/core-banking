// ── Tipos ──────────────────────────────────────────────────────────────────

export type TipoCaso = 'Consulta' | 'Queja' | 'Reclamación';
export type Canal = 'Presencial' | 'Telefónico' | 'Correo electrónico' | 'Portal web' | 'App móvil';
export type Prioridad = 'Alta' | 'Media' | 'Baja';
export type EstatusCaso = 'Recibido' | 'En revisión' | 'En resolución' | 'Cerrado';
export type Dictamen = 'Procedente' | 'Improcedente' | 'Parcialmente procedente' | 'Desistido';

export interface FaseCaso {
  fase: EstatusCaso;
  fecha: string;
  usuario: string;
  nota: string;
}

export interface CasoUNE {
  id: string;
  folio: string;
  clienteId: string;
  clienteNombre: string;
  tipo: TipoCaso;
  canal: Canal;
  prioridad: Prioridad;
  estatus: EstatusCaso;
  productoAfectado: string;
  motivoCategoria: string;
  descripcion: string;
  fechaRecepcion: string;
  fechaLimite: string;
  fechaCierre?: string;
  areaResponsable: string;
  operadorAsignado: string;
  resolucion?: string;
  dictamen?: Dictamen;
  notificadoCliente: boolean;
  historial: FaseCaso[];
}

// ── Catálogos ──────────────────────────────────────────────────────────────

export const CAT_TIPO_CASO: TipoCaso[] = ['Consulta', 'Queja', 'Reclamación'];

export const CAT_CANAL: Canal[] = [
  'Presencial', 'Telefónico', 'Correo electrónico', 'Portal web', 'App móvil',
];

export const CAT_PRIORIDAD: Prioridad[] = ['Alta', 'Media', 'Baja'];

export const CAT_ESTATUS: EstatusCaso[] = [
  'Recibido', 'En revisión', 'En resolución', 'Cerrado',
];

export const CAT_PRODUCTOS = [
  'Crédito Hipotecario', 'Crédito Personal', 'Crédito Automotriz',
  'Cuenta de Ahorro', 'Inversión a Plazo', 'Tarjeta de Débito',
  'Seguro de Vida', 'Seguro de Daños',
];

export const CAT_MOTIVOS: Record<TipoCaso, string[]> = {
  Consulta: [
    'Información de producto', 'Estado de cuenta', 'Saldo y movimientos',
    'Tasas y comisiones', 'Requisitos de trámite', 'Otro',
  ],
  Queja: [
    'Cobro indebido', 'Mal servicio', 'Tiempo de espera excesivo',
    'Error en operación', 'Trato inadecuado', 'Publicidad engañosa', 'Otro',
  ],
  Reclamación: [
    'Cargo no reconocido', 'Domiciliación no autorizada', 'Fraude / robo',
    'Retención indebida de fondos', 'Negativa de servicio', 'Incumplimiento contractual', 'Otro',
  ],
};

export const CAT_AREAS = [
  'Atención a Clientes', 'Operaciones', 'Crédito', 'Cobranza', 'Tecnología', 'Dirección',
];

// Plazo legal CONDUSEF en días hábiles por tipo
export const PLAZO_LEGAL: Record<TipoCaso, number> = {
  Consulta: 5,
  Queja: 10,
  Reclamación: 20,
};

// ── Helpers ────────────────────────────────────────────────────────────────

let _folioSeq = 13;
export function generarFolio(): string {
  const seq = String(_folioSeq++).padStart(4, '0');
  return `UNE-2026-${seq}`;
}

export function calcularFechaLimite(fechaRecepcion: string, tipo: TipoCaso): string {
  const [d, m, y] = fechaRecepcion.split('/').map(Number);
  const fecha = new Date(y, m - 1, d);
  let diasHabiles = PLAZO_LEGAL[tipo];
  while (diasHabiles > 0) {
    fecha.setDate(fecha.getDate() + 1);
    const dow = fecha.getDay();
    if (dow !== 0 && dow !== 6) diasHabiles--;
  }
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
}

export function diasRestantes(fechaLimite: string, fechaCierre?: string): number {
  const parse = (s: string) => { const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d); };
  const ref = fechaCierre ? parse(fechaCierre) : new Date();
  const lim = parse(fechaLimite);
  return Math.ceil((lim.getTime() - ref.getTime()) / 86_400_000);
}

export function formatFecha(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function hoy(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ── Persistencia sessionStorage ────────────────────────────────────────────

const SK = 'une_casos_v1';

export function getCasos(): CasoUNE[] {
  try { const r = sessionStorage.getItem(SK); return r ? JSON.parse(r) : CASOS_DEMO; } catch { return CASOS_DEMO; }
}
export function saveCasos(casos: CasoUNE[]): void {
  try { sessionStorage.setItem(SK, JSON.stringify(casos)); } catch { /* quota */ }
}

// ── Datos demo ─────────────────────────────────────────────────────────────

export const CASOS_DEMO: CasoUNE[] = [
  {
    id: '1', folio: 'UNE-2026-0001',
    clienteId: 'CLI-001', clienteNombre: 'Juan Perez Perez',
    tipo: 'Reclamación', canal: 'Portal web', prioridad: 'Alta',
    estatus: 'En resolución',
    productoAfectado: 'Crédito Hipotecario',
    motivoCategoria: 'Cargo no reconocido',
    descripcion: 'El cliente reporta un cargo de $3,500 aplicado el 15/05/2026 que no corresponde a ninguna comisión contratada ni a su tabla de amortización. Solicita aclaración y devolución inmediata.',
    fechaRecepcion: '16/05/2026', fechaLimite: '13/06/2026',
    areaResponsable: 'Crédito', operadorAsignado: 'Ana Martínez',
    notificadoCliente: true,
    historial: [
      { fase: 'Recibido',     fecha: '16/05/2026 09:10', usuario: 'Sistema',       nota: 'Caso registrado vía portal web. Folio asignado automáticamente.' },
      { fase: 'En revisión',  fecha: '17/05/2026 11:30', usuario: 'Ana Martínez',  nota: 'Se solicitó al área de Crédito el detalle de cargos aplicados en mayo.' },
      { fase: 'En resolución',fecha: '22/05/2026 14:00', usuario: 'Ana Martínez',  nota: 'Se identificó cargo duplicado por error del sistema. Se inició proceso de devolución.' },
    ],
  },
  {
    id: '2', folio: 'UNE-2026-0002',
    clienteId: 'CLI-003', clienteNombre: 'Dulce Fernandez Solis',
    tipo: 'Queja', canal: 'Telefónico', prioridad: 'Media',
    estatus: 'En revisión',
    productoAfectado: 'Cuenta de Ahorro',
    motivoCategoria: 'Tiempo de espera excesivo',
    descripcion: 'La cliente reporta que intentó realizar un retiro en sucursal y tuvo que esperar más de 2 horas sin ser atendida. Solicita explicación y mejora en el servicio.',
    fechaRecepcion: '20/05/2026', fechaLimite: '03/06/2026',
    areaResponsable: 'Atención a Clientes', operadorAsignado: 'Carlos Soto',
    notificadoCliente: true,
    historial: [
      { fase: 'Recibido',    fecha: '20/05/2026 16:45', usuario: 'Sistema',      nota: 'Queja recibida vía línea telefónica UNE.' },
      { fase: 'En revisión', fecha: '21/05/2026 09:00', usuario: 'Carlos Soto',  nota: 'Se solicitó reporte de afluencia y tiempos de atención del día 20/05.' },
    ],
  },
  {
    id: '3', folio: 'UNE-2026-0003',
    clienteId: 'CLI-002', clienteNombre: 'ROTOR AS, S.A DE C.V',
    tipo: 'Reclamación', canal: 'Correo electrónico', prioridad: 'Alta',
    estatus: 'En resolución',
    productoAfectado: 'Crédito Personal',
    motivoCategoria: 'Domiciliación no autorizada',
    descripcion: 'La empresa reporta que se realizaron 2 cargos vía domiciliación los días 01/05 y 15/05 por $8,750 cada uno sin que existiera autorización vigente, ya que el contrato de domiciliación fue cancelado en febrero.',
    fechaRecepcion: '05/05/2026', fechaLimite: '02/06/2026',
    areaResponsable: 'Operaciones', operadorAsignado: 'Laura Vega',
    notificadoCliente: true,
    historial: [
      { fase: 'Recibido',     fecha: '05/05/2026 10:20', usuario: 'Sistema',     nota: 'Reclamación recibida vía correo electrónico.' },
      { fase: 'En revisión',  fecha: '06/05/2026 09:15', usuario: 'Laura Vega',  nota: 'Se verificó cancelación de domiciliación en febrero. Cargos identificados como no autorizados.' },
      { fase: 'En resolución',fecha: '10/05/2026 15:00', usuario: 'Laura Vega',  nota: 'Se aprobó devolución de $17,500. Proceso de reembolso iniciado con Área de Operaciones.' },
    ],
  },
  {
    id: '4', folio: 'UNE-2026-0004',
    clienteId: 'CLI-005', clienteNombre: 'Sofia Reyes Lopez',
    tipo: 'Consulta', canal: 'Presencial', prioridad: 'Baja',
    estatus: 'Cerrado',
    productoAfectado: 'Crédito Personal',
    motivoCategoria: 'Tasas y comisiones',
    descripcion: 'La cliente solicita información detallada sobre la tasa de interés aplicada a su crédito personal y si existe alguna comisión por pago anticipado.',
    fechaRecepcion: '10/04/2026', fechaLimite: '17/04/2026', fechaCierre: '12/04/2026',
    areaResponsable: 'Atención a Clientes', operadorAsignado: 'Pedro Ruiz',
    resolucion: 'Se proporcionó estado de cuenta con desglose de tasa y tabla de comisiones vigente. La tasa aplicada es 22% anual fija. No existe comisión por pago anticipado a partir del mes 6.',
    dictamen: 'Procedente',
    notificadoCliente: true,
    historial: [
      { fase: 'Recibido',fecha: '10/04/2026 11:00', usuario: 'Sistema',    nota: 'Consulta recibida en sucursal CDMX.' },
      { fase: 'Cerrado', fecha: '12/04/2026 12:30', usuario: 'Pedro Ruiz', nota: 'Consulta resuelta de forma presencial. Cliente notificado.' },
    ],
  },
  {
    id: '5', folio: 'UNE-2026-0005',
    clienteId: 'CLI-004', clienteNombre: 'HELVER, S.A. DE C.V.',
    tipo: 'Queja', canal: 'App móvil', prioridad: 'Media',
    estatus: 'Cerrado',
    productoAfectado: 'Cuenta de Ahorro',
    motivoCategoria: 'Error en operación',
    descripcion: 'La empresa reporta que una transferencia de $45,000 realizada el 28/03 aparece como pendiente en la aplicación móvil pero el saldo fue debitado. La transferencia no llegó al destino.',
    fechaRecepcion: '29/03/2026', fechaLimite: '14/04/2026', fechaCierre: '04/04/2026',
    areaResponsable: 'Tecnología', operadorAsignado: 'Mónica Díaz',
    resolucion: 'Se identificó fallo en el proceso de conciliación del día 28/03 afectando 3 transferencias. Los fondos fueron devueltos y la operación reejecutada correctamente el 01/04. Se ofreció compensación de $500 por los inconvenientes.',
    dictamen: 'Procedente',
    notificadoCliente: true,
    historial: [
      { fase: 'Recibido',     fecha: '29/03/2026 08:55', usuario: 'Sistema',     nota: 'Queja recibida vía app móvil.' },
      { fase: 'En revisión',  fecha: '29/03/2026 10:00', usuario: 'Mónica Díaz', nota: 'Se escala a Tecnología por posible fallo en conciliación.' },
      { fase: 'En resolución',fecha: '01/04/2026 09:00', usuario: 'Mónica Díaz', nota: 'Fallo confirmado. Fondos devueltos. Operación reejecutada.' },
      { fase: 'Cerrado',      fecha: '04/04/2026 11:30', usuario: 'Mónica Díaz', nota: 'Cliente notificado. Compensación aplicada. Caso cerrado.' },
    ],
  },
  {
    id: '6', folio: 'UNE-2026-0006',
    clienteId: 'CLI-001', clienteNombre: 'Juan Perez Perez',
    tipo: 'Queja', canal: 'Portal web', prioridad: 'Media',
    estatus: 'Recibido',
    productoAfectado: 'Crédito Automotriz',
    motivoCategoria: 'Cobro indebido',
    descripcion: 'El cliente señala que en su estado de cuenta de mayo aparece un cobro de $1,200 por "Seguro vehicular adicional" que nunca contrató ni autorizó al momento de firmar el crédito automotriz.',
    fechaRecepcion: '07/06/2026', fechaLimite: '21/06/2026',
    areaResponsable: 'Crédito', operadorAsignado: 'Ana Martínez',
    notificadoCliente: false,
    historial: [
      { fase: 'Recibido', fecha: '07/06/2026 14:22', usuario: 'Sistema', nota: 'Queja recibida vía portal web. Pendiente de asignación.' },
    ],
  },
  {
    id: '7', folio: 'UNE-2026-0007',
    clienteId: 'CLI-007', clienteNombre: 'Juan Mendoza Anaya',
    tipo: 'Reclamación', canal: 'Presencial', prioridad: 'Alta',
    estatus: 'En revisión',
    productoAfectado: 'Tarjeta de Débito',
    motivoCategoria: 'Cargo no reconocido',
    descripcion: 'El cliente presenta 4 cargos no reconocidos realizados en comercios de Monterrey entre el 01 y 03/06/2026, por un total de $6,340. El cliente indica que su tarjeta estuvo siempre en su poder. Posible clonación.',
    fechaRecepcion: '05/06/2026', fechaLimite: '03/07/2026',
    areaResponsable: 'Operaciones', operadorAsignado: 'Carlos Soto',
    notificadoCliente: true,
    historial: [
      { fase: 'Recibido',    fecha: '05/06/2026 10:00', usuario: 'Sistema',      nota: 'Reclamación por cargos no reconocidos. Alta prioridad.' },
      { fase: 'En revisión', fecha: '05/06/2026 11:30', usuario: 'Carlos Soto',  nota: 'Se bloqueó la tarjeta preventivamente. Se inició investigación con área de fraudes.' },
    ],
  },
  {
    id: '8', folio: 'UNE-2026-0008',
    clienteId: 'CLI-006', clienteNombre: 'Carlos Perez Leon',
    tipo: 'Consulta', canal: 'Telefónico', prioridad: 'Baja',
    estatus: 'Cerrado',
    productoAfectado: 'Inversión a Plazo',
    motivoCategoria: 'Información de producto',
    descripcion: 'El cliente solicita información sobre las condiciones de renovación automática de su inversión a plazo y si puede modificar el monto antes del vencimiento.',
    fechaRecepcion: '02/06/2026', fechaLimite: '09/06/2026', fechaCierre: '03/06/2026',
    areaResponsable: 'Atención a Clientes', operadorAsignado: 'Pedro Ruiz',
    resolucion: 'Se informó que la inversión se renueva automáticamente a la misma tasa vigente. Puede modificar el monto con 48 horas de anticipación al vencimiento.',
    dictamen: 'Procedente',
    notificadoCliente: true,
    historial: [
      { fase: 'Recibido', fecha: '02/06/2026 09:40', usuario: 'Sistema',    nota: 'Consulta telefónica.' },
      { fase: 'Cerrado',  fecha: '03/06/2026 10:15', usuario: 'Pedro Ruiz', nota: 'Información proporcionada. Cliente satisfecho.' },
    ],
  },
];
