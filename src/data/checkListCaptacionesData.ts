import { CheckListCaptacion } from '../types/checkListCaptacion';

export const checkListCaptaciones: CheckListCaptacion[] = [
  {
    id: 1,
    tipoPersona: 'Física',
    tipoDocumento: 'INE/IFE',
    requerido: true,
    permanente: true,
    descripcion: 'Identificación oficial vigente',
    requeridoPor: 'CNBV',
    esquemaFirma: 'Autógrafa',
    procede: 'Apertura',
    fases: 'Apertura, Actualización'
  },
  {
    id: 2,
    tipoPersona: 'Física',
    tipoDocumento: 'Comprobante de domicilio',
    requerido: true,
    permanente: false,
    descripcion: 'No mayor a 3 meses',
    requeridoPor: 'CNBV',
    esquemaFirma: 'N/A',
    procede: 'Apertura',
    fases: 'Apertura, Actualización'
  },
  {
    id: 3,
    tipoPersona: 'Física',
    tipoDocumento: 'RFC',
    requerido: true,
    permanente: true,
    descripcion: 'Registro Federal de Contribuyentes',
    requeridoPor: 'SAT',
    esquemaFirma: 'N/A',
    procede: 'Apertura',
    fases: 'Apertura'
  },
  {
    id: 4,
    tipoPersona: 'Física',
    tipoDocumento: 'CURP',
    requerido: true,
    permanente: true,
    descripcion: 'Clave Única de Registro de Población',
    requeridoPor: 'CNBV',
    esquemaFirma: 'N/A',
    procede: 'Apertura',
    fases: 'Apertura'
  },
  {
    id: 5,
    tipoPersona: 'Física',
    tipoDocumento: 'Estado de cuenta',
    requerido: false,
    permanente: false,
    descripcion: 'Referencia bancaria',
    requeridoPor: 'Interno',
    esquemaFirma: 'N/A',
    procede: 'Evaluación',
    fases: 'Evaluación'
  },
  {
    id: 6,
    tipoPersona: 'Moral',
    tipoDocumento: 'Acta constitutiva',
    requerido: true,
    permanente: true,
    descripcion: 'Escritura pública con sello digital',
    requeridoPor: 'CNBV',
    esquemaFirma: 'Notarial',
    procede: 'Apertura',
    fases: 'Apertura'
  },
  {
    id: 7,
    tipoPersona: 'Moral',
    tipoDocumento: 'Poder notarial',
    requerido: true,
    permanente: true,
    descripcion: 'Poder del representante legal',
    requeridoPor: 'CNBV',
    esquemaFirma: 'Notarial',
    procede: 'Apertura',
    fases: 'Apertura'
  },
  {
    id: 8,
    tipoPersona: 'Moral',
    tipoDocumento: 'RFC de la empresa',
    requerido: true,
    permanente: true,
    descripcion: 'Cédula fiscal de la persona moral',
    requeridoPor: 'SAT',
    esquemaFirma: 'N/A',
    procede: 'Apertura',
    fases: 'Apertura'
  },
  {
    id: 9,
    tipoPersona: 'Moral',
    tipoDocumento: 'Comprobante fiscal',
    requerido: true,
    permanente: false,
    descripcion: 'Comprobante de domicilio fiscal',
    requeridoPor: 'CNBV',
    esquemaFirma: 'N/A',
    procede: 'Apertura',
    fases: 'Apertura, Actualización'
  },
  {
    id: 10,
    tipoPersona: 'Moral',
    tipoDocumento: 'Estados financieros',
    requerido: false,
    permanente: false,
    descripcion: 'Últimos 2 ejercicios fiscales',
    requeridoPor: 'Interno',
    esquemaFirma: 'Contador público',
    procede: 'Evaluación',
    fases: 'Evaluación, Seguimiento'
  },
  {
    id: 11,
    tipoPersona: 'Física',
    tipoDocumento: 'Contrato de apertura',
    requerido: true,
    permanente: true,
    descripcion: 'Contrato firmado de cuenta de ahorro',
    requeridoPor: 'CNBV',
    esquemaFirma: 'Autógrafa',
    procede: 'Apertura',
    fases: 'Apertura'
  },
  {
    id: 12,
    tipoPersona: 'Moral',
    tipoDocumento: 'Opinión de cumplimiento SAT',
    requerido: true,
    permanente: false,
    descripcion: 'Opinión positiva 32-D',
    requeridoPor: 'SAT',
    esquemaFirma: 'N/A',
    procede: 'Apertura',
    fases: 'Apertura, Actualización'
  }
];
