export interface CheckListCaptacion {
  id: number;
  tipoPersona: 'Física' | 'Moral';
  tipoDocumento: string;
  requerido: boolean;
  permanente: boolean;
  descripcion: string;
  requeridoPor: string;
  esquemaFirma: string;
  procede: string;
  fases: string;
}

export type FormModeCheckList = 'create' | 'edit' | 'view';
