export interface DocumentoExpediente {
  id: number;
  fechaRegistro: string;
  usuarioRegistro: string;
  archivo: string;
  tipoDocumento: string;
  descripcion: string;
  estatus: string;
  observaciones: string;
  fileData?: string; // URL o base64 del archivo
}

export interface Garantia {
  id: number | string; // AUTOINCREMENTAL o UUID desde DB
  tipo: string; // TYPE - VARCHAR(30) - Obligatorio
  subtipo: string; // SUBTYPE - VARCHAR(30) - Obligatorio
  garantia: string; // COLLATERAL - VARCHAR(50) - Obligatorio
  descripcion: string; // DESCRIPTION - TEXT - Opcional
  valorNominal: number; // NOMINAL_VALUE - DECIMAL(10,2) - Obligatorio
  ubicacion: string; // LOCATION - TEXT - Obligatorio
  fechaTasacion: string; // APPRAISAL_DATE - DATE - Opcional
  valorTasacion: number; // APPRAISED_VALUE - DECIMAL(10,2) - Opcional
  peritaTasador: string; // EXPERT_APP - VARCHAR(150) - Opcional
  tasaInteres: string; // INTEREST_RATE - VARCHAR(5) - Opcional
  observaciones: string; // NOTES - VARCHAR(255) - Opcional
  fechaVencimiento: string; // DUE_DATE - DATE - Opcional
  fechaRegistro: string; // REGISTRATION_DATE - DATETIME - Opcional
  estatus: string; // STATUS - VARCHAR(30) - Opcional
  estado: string; // STATE - VARCHAR(30) - Opcional
  municipio: string; // COUNTY - VARCHAR(30) - Opcional
  // ── FK a J_CLIENTES ──
  cliente_id?: string; // uuid FK → J_CLIENTES.uuid (se guarda en columna)
  clienteNombre?: string; // nombre para mostrar en UI (NO se persiste en columna, va en data)
  documentos?: DocumentoExpediente[]; // Expediente Electrónico
}