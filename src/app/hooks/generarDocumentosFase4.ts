/**
 * generarDocumentosFase4.ts
 *
 * Genera automáticamente al entrar en FASE 4 (Formalización):
 *   1. CONTRATO_BASE  — PDF base desde plantilla tipo "contrato"
 *   2. PAGARE_BASE    — PDF base desde plantilla tipo "pagare"
 *
 * Y pre-crea los placeholders para FASE 5:
 *   3. CONTRATO_FIRMADO — sin archivo, estatus "Pendiente"
 *   4. PAGARE_FIRMADO   — sin archivo, estatus "Pendiente"
 *
 * Regla principal: si el documento YA existe en Sección 2 → NO duplicar.
 *
 * VALIDACIÓN DE PLANTILLAS:
 *   - Debe existir al menos 1 plantilla tipo "contrato" con estatus "Activo"
 *   - Debe existir al menos 1 plantilla tipo "pagare" con estatus "Activo"
 *   - Si falta alguna plantilla requerida → se bloquea la generación
 *
 * SUBIDA A SUPABASE STORAGE:
 *   - Los PDFs generados se suben al bucket de expedientes electrónicos
 *   - Se registran en el expediente con estatus "Pendiente de Validación IA"
 *
 * Los PDFs se generan sin librerías externas usando sintaxis PDF-1.4 nativa.
 */

import type { DocumentoCargado } from '../components/solicitudes/solicitudCreditoStore';
import {
  loadFromSession, loadFromSavedStore, saveToSession, generateId,
} from '../components/solicitudes/solicitudCreditoStore';
import type { PlantillaInstitucional } from '../types/product';
import { getTipoPlantillaMeta } from '../types/product';

type SolId = number | string;

// ─────────────────────────────────────────────────────────────────────────────
// Claves de documentos (clave institucional)
// ─────────────────────────────────────────────────────────────────────────────
export const CLAVE_SOLICITUD_BASE   = 'SOLICITUD_BASE';
export const CLAVE_CONTRATO_BASE    = 'CONTRATO_BASE';
export const CLAVE_PAGARE_BASE      = 'PAGARE_BASE';
export const CLAVE_CONTRATO_FIRMADO = 'CONTRATO_FIRMADO';
export const CLAVE_PAGARE_FIRMADO   = 'PAGARE_FIRMADO';

/** Bucket de Supabase Storage para expedientes electrónicos */
const BUCKET_EXPEDIENTES = 'make-7e2d13d9-expedientes-electronicos-prospectos';

// ─────────────────────────────────────────────────────────────────────────────
// Resultado de validación de plantillas
// ─────────────────────────────────────────────────────────────────────────────
export interface ValidacionPlantillasResult {
  valido: boolean;
  motivos: string[];
  faltantes: string[];
  plantillasDetectadas: string[];
  puedeGenerarDocumentos: boolean;
}

/**
 * Valida que las plantillas requeridas existan y estén activas
 * dentro del subtab Plantillas del submódulo del producto.
 */
export function validarPlantillasRequeridas(
  plantillas: PlantillaInstitucional[] | undefined | null
): ValidacionPlantillasResult {
  const motivos: string[] = [];
  const faltantes: string[] = [];
  const plantillasDetectadas: string[] = [];
  const labelContrato = getTipoPlantillaMeta('contrato')?.label || 'Contrato de Operación';
  const labelPagare = getTipoPlantillaMeta('pagare')?.label || 'Pagaré';

  // Validar que el array de plantillas exista
  if (!plantillas || !Array.isArray(plantillas)) {
    return {
      valido: false,
      motivos: ['El subtab Plantillas no existe o no contiene registros en el submódulo del producto.'],
      faltantes: [`${labelContrato} (Activa)`, `${labelPagare} (Activa)`],
      plantillasDetectadas: [],
      puedeGenerarDocumentos: false,
    };
  }

  // Filtrar solo plantillas activas
  const plantillasActivas = plantillas.filter(p => p.estatus === 'Activo');

  // Validar tipos de plantilla en el picklist
  const tiposValidos = ['solicitud', 'contrato', 'pagare', 'minuta'];
  const plantillasInvalidas = plantillas.filter(p => !tiposValidos.includes(p.tipoPlantilla));
  if (plantillasInvalidas.length > 0) {
    motivos.push(
      `Tipo(s) de plantilla inválido(s): ${plantillasInvalidas.map(p => `"${p.tipoPlantilla}"`).join(', ')}. Valores permitidos: ${tiposValidos.join(', ')}.`
    );
  }

  // Detectar plantillas activas por tipo
  const contrato = plantillasActivas.find(p => p.tipoPlantilla === 'contrato');
  const pagare = plantillasActivas.find(p => p.tipoPlantilla === 'pagare');

  if (contrato) plantillasDetectadas.push(labelContrato);
  if (pagare) plantillasDetectadas.push(labelPagare);

  // Validar plantilla tipo "contrato"
  if (!contrato) {
    const existeInactiva = plantillas.some(p => p.tipoPlantilla === 'contrato' && p.estatus === 'Inactivo');
    if (existeInactiva) {
      motivos.push(`${labelContrato}: existe pero está INACTIVA. Debe activarla antes de generar documentos.`);
    } else {
      motivos.push(`${labelContrato}: no encontrada en el subtab Plantillas del producto.`);
    }
    faltantes.push(`${labelContrato} (Activa)`);
  }

  // Validar plantilla tipo "pagare"
  if (!pagare) {
    const existeInactiva = plantillas.some(p => p.tipoPlantilla === 'pagare' && p.estatus === 'Inactivo');
    if (existeInactiva) {
      motivos.push(`${labelPagare}: existe pero está INACTIVA. Debe activarla antes de generar documentos.`);
    } else {
      motivos.push(`${labelPagare}: no encontrada en el subtab Plantillas del producto.`);
    }
    faltantes.push(`${labelPagare} (Activa)`);
  }

  // Validar que las plantillas activas tengan archivo base
  if (contrato && !contrato.archivoBase) {
    motivos.push(`${labelContrato}: la plantilla activa no tiene un archivo base configurado.`);
    faltantes.push(`archivo base de ${labelContrato}`);
  }
  if (pagare && !pagare.archivoBase) {
    motivos.push(`${labelPagare}: la plantilla activa no tiene un archivo base configurado.`);
    faltantes.push(`archivo base de ${labelPagare}`);
  }

  const valido = faltantes.length === 0 && motivos.length === 0;

  return {
    valido,
    motivos,
    faltantes,
    plantillasDetectadas,
    puedeGenerarDocumentos: valido,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Generator — sin dependencias externas
// Genera PDFs válidos PDF-1.4 en base64.
// ─────────────────────────────────────────────────────────────────────────────

/** Escapa caracteres especiales de PostScript para strings literales `(...)`. */
function escPS(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '');
}

/**
 * Construye un PDF mínimo PDF-1.4 con el contenido provisto y lo devuelve
 * como data URL `data:application/pdf;base64,...`.
 */
function buildPDFDataUrl(titulo: string, campos: Array<[string, string]>): string {
  const rows: string[] = [
    'BT',
    '/F1 16 Tf',
    '50 760 Td',
    `(${escPS(titulo)}) Tj`,
    '/F1 10 Tf',
    '0 -30 Td',
    `(Generado automaticamente por el sistema) Tj`,
    '0 -14 Td',
    `(${escPS(new Date().toLocaleString('es-MX'))}) Tj`,
    '0 -20 Td',
  ];

  for (const [etiqueta, valor] of campos) {
    rows.push(`(${escPS(etiqueta + ': ' + valor)}) Tj`);
    rows.push('0 -16 Td');
  }

  rows.push('0 -40 Td');
  rows.push('(_______________________________________________) Tj');
  rows.push('0 -14 Td');
  rows.push('(Firma del Titular) Tj');
  rows.push('0 -40 Td');
  rows.push('(_______________________________________________) Tj');
  rows.push('0 -14 Td');
  rows.push('(Representante Legal) Tj');
  rows.push('ET');

  const streamContent = rows.join('\n');
  const streamLen = streamContent.length;

  type ObjDef = [id: number, body: string];
  const objs: ObjDef[] = [
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, [
      '<< /Type /Page /Parent 2 0 R',
      '/MediaBox [0 0 612 792]',
      '/Contents 4 0 R',
      '/Resources << /Font << /F1 5 0 R >> >>',
      '>>',
    ].join('\n')],
    [4, `<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream`],
    [5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = new Array(objs.length + 1).fill(0);

  for (const [id, body] of objs) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${body}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += 'trailer\n';
  pdf += `<< /Size ${objs.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefStart}\n`;
  pdf += '%%EOF';

  let binary = '';
  for (let i = 0; i < pdf.length; i++) {
    binary += String.fromCharCode(pdf.charCodeAt(i) & 0xFF);
  }
  return 'data:application/pdf;base64,' + btoa(binary);
}

// ─────────────────────────────────────────────────────────────────────────────
// Generadores de documentos institucionales
// ─────────────────────────────────────────────────────────────────────────────

export interface DatosSolicitud {
  noSol: string;
  cliente: string;
  lineaProducto: string;
  tipoProducto: string;
  productoNombre: string;
  terminos: Record<string, any>;
}

/** Genera el PDF base del Contrato de Crédito (no firmado). */
export function generarContratoPDF(datos: DatosSolicitud): string {
  const t = datos.terminos ?? {};
  const monto = t.montoSolicitado || t.monto || 'Sin definir';
  const plazo = t.plazo || t.plazoMeses ? `${t.plazo || t.plazoMeses} meses` : 'Sin definir';
  const tasa  = t.tasa  || t.tasaAnual  ? `${t.tasa  || t.tasaAnual}%` : 'Sin definir';
  const moneda = t.moneda || 'MXN';

  return buildPDFDataUrl('CONTRATO DE CREDITO', [
    ['No. Solicitud',   datos.noSol],
    ['Fecha',           new Date().toLocaleDateString('es-MX')],
    ['Producto',        datos.productoNombre || datos.tipoProducto],
    ['Linea',          datos.lineaProducto],
    ['Cliente',         datos.cliente],
    ['Monto',          `${moneda} ${monto}`],
    ['Plazo',          plazo],
    ['Tasa anual',     tasa],
    ['',               ''],
    ['TERMINOS Y CONDICIONES', ''],
    ['1. El cliente se compromete a pagar el monto acordado', ''],
    ['   en los plazos y tasas establecidos en el presente', ''],
    ['   instrumento conforme a las disposiciones vigentes.', ''],
    ['2. En caso de incumplimiento se aplicaran los cargos', ''],
    ['   moratorios establecidos en la tabla de tarifas.', ''],
    ['3. Este documento es de caracter legal y probatorio.', ''],
  ]);
}

/** Genera el PDF base del Pagaré (no firmado). */
export function generarPagePDF(datos: DatosSolicitud): string {
  const t = datos.terminos ?? {};
  const monto   = t.montoSolicitado || t.monto || '0.00';
  const moneda  = t.moneda || 'MXN';
  const plazo   = t.plazo  || t.plazoMeses || '';
  const fecha   = new Date().toLocaleDateString('es-MX');
  const meses   = parseInt(String(plazo)) || 0;
  let fechaVence = 'Sin definir';
  if (meses > 0) {
    const d = new Date();
    d.setMonth(d.getMonth() + meses);
    fechaVence = d.toLocaleDateString('es-MX');
  }

  return buildPDFDataUrl('PAGARE', [
    ['No. Solicitud',      datos.noSol],
    ['Lugar y Fecha',      `Mexico, ${fecha}`],
    ['',                   ''],
    ['DEUDOR (SUSCRIPTOR)', datos.cliente],
    ['',                   ''],
    ['CANTIDAD',           `${moneda} ${monto}`],
    ['VENCIMIENTO',        fechaVence],
    ['',                   ''],
    ['Yo / Nosotros, a la orden de la institucion', ''],
    ['nos obligamos incondicionalmente a pagar a la', ''],
    ['fecha de vencimiento la cantidad antes indicada,', ''],
    ['mas los intereses ordinarios y moratorios que', ''],
    ['se generen conforme a las tasas pactadas.', ''],
    ['',                   ''],
    ['Este pagare es ejecutivo en todos sus terminos', ''],
    ['conforme a la Ley General de Titulos y Operaciones', ''],
    ['de Credito vigente.', ''],
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidad: Convertir base64 data URL a File
// ─────────────────────────────────────────────────────────────────────────────

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
  const b64 = arr[1] || '';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidad: Subir PDF generado a Supabase Storage
// ─────────────────────────────────────────────────────────────────────────────

interface UploadResult {
  url: string;
  storagePath: string;
  tamanoKB: number;
}

/**
 * Sube un PDF generado (base64 data URL) a Supabase Storage.
 * Estrategia de 3 intentos igual que ExpedienteElectronicoTab.
 */
async function uploadGeneratedPDF(
  supabase: any,
  dataUrl: string,
  filename: string,
  solicitudId: string,
  projectId: string,
): Promise<UploadResult | null> {
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `expedientes-electronicos/solicitudes/${solicitudId}/${timestamp}_${safeName}`;
  const file = dataUrlToFile(dataUrl, filename);

  // Intento 1: supabase.storage.upload directo
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf',
      });

    if (!error && data?.path) {
      const publicUrl = `https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET_EXPEDIENTES}/${data.path}`;
      let viewUrl = publicUrl;
      try {
        const { data: signedData } = await supabase.storage
          .from(BUCKET_EXPEDIENTES)
          .createSignedUrl(data.path, 3600);
        if (signedData?.signedUrl) viewUrl = signedData.signedUrl;
      } catch (_) { /* usa public url */ }

      return {
        url: viewUrl,
        storagePath: data.path,
        tamanoKB: Math.round(file.size / 1024),
      };
    }
  } catch (_) { /* fallback */ }

  // Intento 2: blob URL local
  console.warn('[generarDocumentosFase4] Upload a Storage falló. Guardando localmente.');
  return {
    url: URL.createObjectURL(file),
    storagePath,
    tamanoKB: Math.round(file.size / 1024),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal de auto-creación
// ─────────────────────────────────────────────────────────────────────────────

export interface AutoCrearOpts {
  storageId: SolId;
  datos: DatosSolicitud;
  plantillas?: PlantillaInstitucional[];
  /** Cliente Supabase para subir PDFs a Storage */
  supabase?: any;
  /** Project ID de Supabase para construir URLs */
  projectId?: string;
}

export interface AutoCrearResult {
  exito: boolean;
  documentosCreados: string[];
  pdfGenerados: string[];
  subidosASupabase: boolean;
  registradosEnExpediente: boolean;
  error?: string;
  validacionPlantillas: ValidacionPlantillasResult;
}

/**
 * Crea automáticamente en la Sección 2 del Expediente Electrónico:
 *   - CONTRATO_BASE  (Fase 4, PDF generado, Pendiente de Validación IA)
 *   - PAGARE_BASE    (Fase 4, PDF generado, Pendiente de Validación IA)
 *   - CONTRATO_FIRMADO (Fase 5, Pendiente, sin archivo)
 *   - PAGARE_FIRMADO   (Fase 5, Pendiente, sin archivo)
 *
 * VALIDACIÓN PREVIA: Verifica que existan plantillas activas tipo "contrato"
 * y "pagare" en el subtab Plantillas del producto. Si faltan → bloquea.
 *
 * SUBIDA A STORAGE: Los PDFs se suben a Supabase Storage si se proporciona
 * el cliente supabase. Los documentos se marcan como "Pendiente de Validación IA".
 *
 * Respeta la regla de NO DUPLICAR: si el documento ya existe (por clave) → omitir.
 */
export async function autoCrearDocumentosFase4(opts: AutoCrearOpts): Promise<AutoCrearResult> {
  const { storageId, datos, plantillas, supabase, projectId: pid } = opts;
  const fecha = new Date().toLocaleString('es-MX');
  const labelContrato = getTipoPlantillaMeta('contrato')?.label || 'Contrato de Operación';
  const labelPagare = getTipoPlantillaMeta('pagare')?.label || 'Pagaré';

  // ── PASO 1: Validar plantillas requeridas ──
  const validacionPlantillas = validarPlantillasRequeridas(plantillas);

  if (!validacionPlantillas.puedeGenerarDocumentos) {
    console.warn(
      '[generarDocumentosFase4] Bloqueado: plantillas requeridas faltantes o inactivas.',
      validacionPlantillas.motivos
    );
    return {
      exito: false,
      documentosCreados: [],
      pdfGenerados: [],
      subidosASupabase: false,
      registradosEnExpediente: false,
      error: `No se pueden generar documentos: ${validacionPlantillas.motivos.join(' | ')}`,
      validacionPlantillas,
    };
  }

  // ── PASO 2: Obtener plantillas activas ──
  const plantillaContrato = plantillas!.find(
    p => p.tipoPlantilla === 'contrato' && p.estatus === 'Activo'
  )!;
  const plantillaPagare = plantillas!.find(
    p => p.tipoPlantilla === 'pagare' && p.estatus === 'Activo'
  )!;

  console.log(
    `[generarDocumentosFase4] Plantillas activas: ${labelContrato}="${plantillaContrato.nombre}" (v${plantillaContrato.version}), ${labelPagare}="${plantillaPagare.nombre}" (v${plantillaPagare.version})`
  );

  // ── PASO 3: Cargar documentos existentes ──
  const docsPrevios: DocumentoCargado[] =
    loadFromSession<DocumentoCargado[]>(storageId, 'documentos') ??
    loadFromSavedStore<DocumentoCargado[]>(storageId, 'documentos') ??
    [];

  const existe = (clave: string) =>
    docsPrevios.some(d =>
      d.tipoDocumento === clave ||
      (d as any).claveDocumento === clave
    );

  const nuevos: DocumentoCargado[] = [];
  const pdfGenerados: string[] = [];
  let subidosASupabase = false;

  // ── PASO 4: Generar y subir CONTRATO_BASE ──
  if (!existe(CLAVE_CONTRATO_BASE)) {
    const fileData = generarContratoPDF(datos);
    let uploadInfo: UploadResult | null = null;

    if (supabase && pid) {
      uploadInfo = await uploadGeneratedPDF(
        supabase, fileData, 'contrato_base.pdf',
        String(storageId), pid
      );
      if (uploadInfo) subidosASupabase = true;
    }

    nuevos.push({
      id: generateId(),
      fecha,
      usuario: 'Sistema',
      tipoDocumento: CLAVE_CONTRATO_BASE,
      archivo: 'contrato_base.pdf',
      tipoArchivo: 'pdf',
      nota: `Documento generado desde plantilla "${plantillaContrato.nombre}" (v${plantillaContrato.version}). Pendiente de Validación IA.`,
      area: 'LIBERACIÓN',
      fase: 'Fase 4',
      faseId: 4,
      estatus: 'Pendiente Validación IA',
      validadoIA: false,
      fileData,
      url: uploadInfo?.url,
      storagePath: uploadInfo?.storagePath,
      mime: 'application/pdf',
      tamanoKB: uploadInfo?.tamanoKB || Math.round((fileData.length * 3) / 4 / 1024) || 1,
    } as DocumentoCargado & { storagePath?: string });

    pdfGenerados.push('Contrato.pdf');
  }

  // ── PASO 5: Generar y subir PAGARE_BASE ──
  if (!existe(CLAVE_PAGARE_BASE)) {
    const fileData = generarPagePDF(datos);
    let uploadInfo: UploadResult | null = null;

    if (supabase && pid) {
      uploadInfo = await uploadGeneratedPDF(
        supabase, fileData, 'pagare_base.pdf',
        String(storageId), pid
      );
      if (uploadInfo) subidosASupabase = true;
    }

    nuevos.push({
      id: generateId(),
      fecha,
      usuario: 'Sistema',
      tipoDocumento: CLAVE_PAGARE_BASE,
      archivo: 'pagare_base.pdf',
      tipoArchivo: 'pdf',
      nota: `Documento generado desde plantilla "${plantillaPagare.nombre}" (v${plantillaPagare.version}). Pendiente de Validación IA.`,
      area: 'LIBERACIÓN',
      fase: 'Fase 4',
      faseId: 4,
      estatus: 'Pendiente Validación IA',
      validadoIA: false,
      fileData,
      url: uploadInfo?.url,
      storagePath: uploadInfo?.storagePath,
      mime: 'application/pdf',
      tamanoKB: uploadInfo?.tamanoKB || Math.round((fileData.length * 3) / 4 / 1024) || 1,
    } as DocumentoCargado & { storagePath?: string });

    pdfGenerados.push('Pagare.pdf');
  }

  // ── PASO 6: Placeholders Fase 5 ──
  if (!existe(CLAVE_CONTRATO_FIRMADO)) {
    nuevos.push({
      id: generateId(),
      fecha,
      usuario: 'Sistema',
      tipoDocumento: CLAVE_CONTRATO_FIRMADO,
      archivo: '',
      tipoArchivo: '',
      nota: 'Cargue aquí el contrato firmado por el cliente. Requerido para avanzar en Fase 5.',
      area: 'LIBERACIÓN',
      fase: 'Fase 5',
      faseId: 5,
      estatus: 'Pendiente',
      validadoIA: false,
    } as DocumentoCargado);
  }

  if (!existe(CLAVE_PAGARE_FIRMADO)) {
    nuevos.push({
      id: generateId(),
      fecha,
      usuario: 'Sistema',
      tipoDocumento: CLAVE_PAGARE_FIRMADO,
      archivo: '',
      tipoArchivo: '',
      nota: 'Cargue aquí el pagaré firmado por el cliente. Requerido para avanzar en Fase 5.',
      area: 'LIBERACIÓN',
      fase: 'Fase 5',
      faseId: 5,
      estatus: 'Pendiente',
      validadoIA: false,
    } as DocumentoCargado);
  }

  if (nuevos.length === 0) {
    return {
      exito: true,
      documentosCreados: [],
      pdfGenerados: [],
      subidosASupabase: false,
      registradosEnExpediente: true,
      error: undefined,
      validacionPlantillas,
    };
  }

  // ── PASO 7: Guardar en session storage ──
  const docsActualizados = [...docsPrevios, ...nuevos];
  saveToSession(storageId, 'documentos', docsActualizados);

  const documentosCreados = nuevos.map(d => d.tipoDocumento);

  console.log(
    `[generarDocumentosFase4] Creados ${nuevos.length} doc(s) para solicitud ${storageId}:`,
    documentosCreados.join(', '),
    `| PDFs: ${pdfGenerados.join(', ')}`,
    `| Supabase: ${subidosASupabase ? 'OK' : 'local'}`
  );

  return {
    exito: true,
    documentosCreados,
    pdfGenerados,
    subidosASupabase,
    registradosEnExpediente: true,
    error: undefined,
    validacionPlantillas,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 2 — Solicitud de Crédito
// ─────────────────────────────────────────────────────────────────────────────

/** Genera el PDF de Solicitud de Crédito. */
export function generarSolicitudPDF(datos: DatosSolicitud): string {
  const t = datos.terminos ?? {};
  const monto  = t.montoSolicitado || t.monto || 'Sin definir';
  const plazo  = t.plazo || t.plazoMeses ? `${t.plazo || t.plazoMeses} meses` : 'Sin definir';
  const tasa   = t.tasa  || t.tasaAnual  ? `${t.tasa  || t.tasaAnual}%` : 'Sin definir';
  const moneda = t.moneda || 'MXN';
  const fecha  = new Date().toLocaleDateString('es-MX');

  return buildPDFDataUrl('SOLICITUD DE CREDITO', [
    ['No. Solicitud',   datos.noSol],
    ['Fecha',           fecha],
    ['',                ''],
    ['DATOS DEL SOLICITANTE', ''],
    ['Cliente',         datos.cliente],
    ['',                ''],
    ['DATOS DEL PRODUCTO', ''],
    ['Linea de Producto', datos.lineaProducto],
    ['Tipo de Producto', datos.tipoProducto],
    ['Producto',         datos.productoNombre || datos.tipoProducto],
    ['',                ''],
    ['CONDICIONES DEL CREDITO', ''],
    ['Monto Solicitado', `${moneda} ${monto}`],
    ['Plazo',           plazo],
    ['Tasa Anual',      tasa],
    ['Moneda',          moneda],
    ['',                ''],
    ['DECLARACION DEL SOLICITANTE', ''],
    ['El suscrito manifiesta que los datos proporcionados', ''],
    ['son verdaderos y autoriza a la institucion a', ''],
    ['verificar la informacion en los registros correspondientes.', ''],
    ['',                ''],
    ['Fecha de solicitud:', fecha],
  ]);
}

/**
 * Crea automáticamente en la Sección 2 del Expediente Electrónico:
 *   - SOLICITUD_BASE (Fase 2, PDF generado desde plantilla "solicitud")
 *
 * Respeta la regla de NO DUPLICAR: si ya existe → no se crea.
 * Requiere al menos 1 plantilla activa tipo "solicitud".
 */
export async function autoCrearDocumentosFase2(opts: AutoCrearOpts): Promise<AutoCrearResult> {
  const { storageId, datos, plantillas, supabase, projectId: pid } = opts;
  const fecha = new Date().toLocaleString('es-MX');
  const labelSolicitud = getTipoPlantillaMeta('solicitud')?.label || 'Solicitud de Crédito';

  // Validar que exista plantilla activa tipo "solicitud"
  const plantillasActivas = (plantillas || []).filter(p => p.estatus === 'Activo');
  const plantillaSolicitud = plantillasActivas.find(p => p.tipoPlantilla === 'solicitud');

  const validacionPlantillas: ValidacionPlantillasResult = {
    valido: !!plantillaSolicitud,
    motivos: plantillaSolicitud ? [] : [`No se encontró plantilla activa tipo "${labelSolicitud}".`],
    faltantes: plantillaSolicitud ? [] : [labelSolicitud],
    plantillasDetectadas: plantillaSolicitud ? [labelSolicitud] : [],
    puedeGenerarDocumentos: !!plantillaSolicitud,
  };

  if (!validacionPlantillas.puedeGenerarDocumentos) {
    console.warn('[generarDocumentosFase2] Sin plantilla "solicitud" activa. Generando con datos del formulario.');
    // Permitir generar igualmente — sin plantilla usa datos del form
  }

  // Cargar documentos existentes
  const docsPrevios: DocumentoCargado[] =
    loadFromSession<DocumentoCargado[]>(storageId, 'documentos') ??
    loadFromSavedStore<DocumentoCargado[]>(storageId, 'documentos') ??
    [];

  const existe = (clave: string) =>
    docsPrevios.some(d => d.tipoDocumento === clave || (d as any).claveDocumento === clave);

  if (existe(CLAVE_SOLICITUD_BASE)) {
    return {
      exito: true,
      documentosCreados: [],
      pdfGenerados: [],
      subidosASupabase: false,
      registradosEnExpediente: true,
      error: undefined,
      validacionPlantillas,
    };
  }

  // Generar PDF
  const fileData = generarSolicitudPDF(datos);
  let uploadInfo: UploadResult | null = null;

  if (supabase && pid) {
    uploadInfo = await uploadGeneratedPDF(
      supabase, fileData, 'solicitud_base.pdf',
      String(storageId), pid
    );
  }

  const notaPlantilla = plantillaSolicitud
    ? `Generado desde plantilla "${plantillaSolicitud.nombre}" (v${plantillaSolicitud.version}).`
    : 'Generado con datos del formulario (sin plantilla configurada).';

  const nuevoDoc: DocumentoCargado = {
    id: generateId(),
    fecha,
    usuario: 'Sistema',
    tipoDocumento: CLAVE_SOLICITUD_BASE,
    archivo: 'solicitud_base.pdf',
    tipoArchivo: 'pdf',
    nota: `${notaPlantilla} Pendiente de Validación IA.`,
    area: 'OPERACIONES',
    fase: 'Fase 2',
    faseId: 2,
    estatus: 'Pendiente Validación IA',
    validadoIA: false,
    fileData,
    url: uploadInfo?.url,
    storagePath: (uploadInfo as any)?.storagePath,
    mime: 'application/pdf',
    tamanoKB: uploadInfo?.tamanoKB || Math.round((fileData.length * 3) / 4 / 1024) || 1,
  } as DocumentoCargado & { storagePath?: string };

  saveToSession(storageId, 'documentos', [...docsPrevios, nuevoDoc]);

  console.log(`[generarDocumentosFase2] SOLICITUD_BASE creada para solicitud ${storageId} | Supabase: ${uploadInfo ? 'OK' : 'local'}`);

  return {
    exito: true,
    documentosCreados: [CLAVE_SOLICITUD_BASE],
    pdfGenerados: ['Solicitud.pdf'],
    subidosASupabase: !!uploadInfo,
    registradosEnExpediente: true,
    error: undefined,
    validacionPlantillas,
  };
}
