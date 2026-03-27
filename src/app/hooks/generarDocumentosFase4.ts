/**
 * generarDocumentosFase4.ts
 *
 * Genera automáticamente al entrar en FASE 4 (Formalización):
 *   1. CONTRATO_BASE  — PDF base generado por el sistema (no firmado)
 *   2. PAGARE_BASE    — PDF base generado por el sistema (no firmado)
 *
 * Y pre-crea los placeholders para FASE 5:
 *   3. CONTRATO_FIRMADO — sin archivo, estatus "Pendiente"
 *   4. PAGARE_FIRMADO   — sin archivo, estatus "Pendiente"
 *
 * Regla principal: si el documento YA existe en Sección 2 → NO duplicar.
 *
 * Los PDFs se generan sin librerías externas usando sintaxis PDF-1.4 nativa.
 */

import type { DocumentoCargado } from '../components/solicitudes/solicitudCreditoStore';
import {
  loadFromSession, loadFromSavedStore, saveToSession, generateId,
} from '../components/solicitudes/solicitudCreditoStore';

type SolId = number | string;

// ─────────────────────────────────────────────────────────────────────────────
// Claves de documentos (clave institucional)
// ─────────────────────────────────────────────────────────────────────────────
export const CLAVE_CONTRATO_BASE    = 'CONTRATO_BASE';
export const CLAVE_PAGARE_BASE      = 'PAGARE_BASE';
export const CLAVE_CONTRATO_FIRMADO = 'CONTRATO_FIRMADO';
export const CLAVE_PAGARE_FIRMADO   = 'PAGARE_FIRMADO';

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
    // Eliminar cualquier carácter no-ASCII (PostScript no los soporta directamente)
    .replace(/[^\x20-\x7E]/g, '');
}

/**
 * Construye un PDF mínimo PDF-1.4 con el contenido provisto y lo devuelve
 * como data URL `data:application/pdf;base64,...`.
 *
 * Solo usa el font estándar Helvetica (sin embedding), disponible en todos
 * los lectores PDF.
 */
function buildPDFDataUrl(titulo: string, campos: Array<[string, string]>): string {
  // ── Construir stream de contenido de la página ──
  const rows: string[] = [
    'BT',
    '/F1 16 Tf',
    '50 760 Td',
    `(${escPS(titulo)}) Tj`,
    '/F1 10 Tf',
    '0 -30 Td',
    `(Generado automaticamente por el sistema) Tj`,
    `(${escPS(new Date().toLocaleString('es-MX'))}) Tj`,
    '0 -24 Td',
  ];

  for (const [etiqueta, valor] of campos) {
    rows.push(`(${escPS(etiqueta + ': ' + valor)}) Tj`);
    rows.push('0 -16 Td');
  }

  // Área de firma
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
  // Para ASCII puro, length === byteLength
  const streamLen = streamContent.length;

  // ── Construir objetos PDF ──
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

  // ── Acumular bytes y calcular offsets de xref ──
  // Para contenido ASCII puro, posición de carácter === posición de byte.
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

  // Convertir a base64
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
  const monto = t.montoSolicitado || t.monto || '—';
  const plazo = t.plazo || t.plazoMeses ? `${t.plazo || t.plazoMeses} meses` : '—';
  const tasa  = t.tasa  || t.tasaAnual  ? `${t.tasa  || t.tasaAnual}%` : '—';
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
  const plazo   = t.plazo  || t.plazoMeses || '—';
  const fecha   = new Date().toLocaleDateString('es-MX');
  // Calcular fecha de vencimiento aproximada
  const meses   = parseInt(String(plazo)) || 0;
  let fechaVence = '—';
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
// Función principal de auto-creación
// ─────────────────────────────────────────────────────────────────────────────

export interface AutoCrearOpts {
  storageId: SolId;
  datos: DatosSolicitud;
}

/**
 * Crea automáticamente en la Sección 2 del Expediente Electrónico:
 *   - CONTRATO_BASE  (Fase 4, estatus "Validado", PDF generado adjunto)
 *   - PAGARE_BASE    (Fase 4, estatus "Validado", PDF generado adjunto)
 *   - CONTRATO_FIRMADO (Fase 5, estatus "Pendiente", sin archivo)
 *   - PAGARE_FIRMADO   (Fase 5, estatus "Pendiente", sin archivo)
 *
 * Respeta la regla de NO DUPLICAR: si el documento ya existe (por clave) → omitir.
 * Persiste en session storage (`documentos`) para que el Expediente lo muestre.
 *
 * @returns `true` si se creó al menos un documento nuevo; `false` si todos ya existían.
 */
export function autoCrearDocumentosFase4(opts: AutoCrearOpts): boolean {
  const { storageId, datos } = opts;
  const fecha = new Date().toLocaleString('es-MX');

  // ── Cargar documentos existentes ──
  const docsPrevios: DocumentoCargado[] =
    loadFromSession<DocumentoCargado[]>(storageId, 'documentos') ??
    loadFromSavedStore<DocumentoCargado[]>(storageId, 'documentos') ??
    [];

  // Helper: ¿ya existe un documento con esta clave?
  const existe = (clave: string) =>
    docsPrevios.some(d =>
      d.tipoDocumento === clave ||
      (d as any).claveDocumento === clave
    );

  const nuevos: DocumentoCargado[] = [];

  // ── 1. CONTRATO_BASE — Fase 4, PDF generado ──
  if (!existe(CLAVE_CONTRATO_BASE)) {
    const fileData = generarContratoPDF(datos);
    nuevos.push({
      id: generateId(),
      fecha,
      usuario: 'Sistema',
      tipoDocumento: CLAVE_CONTRATO_BASE,
      archivo: 'contrato_base.pdf',
      tipoArchivo: 'pdf',
      nota: 'Documento generado automáticamente por el sistema en Fase 4.',
      area: 'LIBERACIÓN',
      fase: 'Fase 4',
      faseId: 4,
      estatus: 'Validado',
      validadoIA: false,
      fileData,
      mime: 'application/pdf',
      tamanoKB: Math.round((fileData.length * 3) / 4 / 1024) || 1,
    } as DocumentoCargado & { claveDocumento?: string });
  }

  // ── 2. PAGARE_BASE — Fase 4, PDF generado ──
  if (!existe(CLAVE_PAGARE_BASE)) {
    const fileData = generarPagePDF(datos);
    nuevos.push({
      id: generateId() + 1,
      fecha,
      usuario: 'Sistema',
      tipoDocumento: CLAVE_PAGARE_BASE,
      archivo: 'pagare_base.pdf',
      tipoArchivo: 'pdf',
      nota: 'Documento generado automáticamente por el sistema en Fase 4.',
      area: 'LIBERACIÓN',
      fase: 'Fase 4',
      faseId: 4,
      estatus: 'Validado',
      validadoIA: false,
      fileData,
      mime: 'application/pdf',
      tamanoKB: Math.round((fileData.length * 3) / 4 / 1024) || 1,
    } as DocumentoCargado & { claveDocumento?: string });
  }

  // ── 3. CONTRATO_FIRMADO — Fase 5, Pendiente (placeholder para firma) ──
  if (!existe(CLAVE_CONTRATO_FIRMADO)) {
    nuevos.push({
      id: generateId() + 2,
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

  // ── 4. PAGARE_FIRMADO — Fase 5, Pendiente (placeholder para firma) ──
  if (!existe(CLAVE_PAGARE_FIRMADO)) {
    nuevos.push({
      id: generateId() + 3,
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

  if (nuevos.length === 0) return false;

  // ── Guardar la lista actualizada en session storage ──
  const docsActualizados = [...docsPrevios, ...nuevos];
  saveToSession(storageId, 'documentos', docsActualizados);

  console.log(
    `[generarDocumentosFase4] Creados ${nuevos.length} documento(s) para solicitud ${storageId}:`,
    nuevos.map(d => d.tipoDocumento).join(', ')
  );

  return true;
}
