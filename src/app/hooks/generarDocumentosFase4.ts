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

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import logoSrc from '../../assets/7b6cb23c00b7817818c638af3eae0a416e1e9f57.png';
import type { DocumentoCargado } from '../components/solicitudes/solicitudCreditoStore';
import {
  loadFromSession, loadFromSavedStore, saveToSession, generateId,
} from '../components/solicitudes/solicitudCreditoStore';
import type { PlantillaInstitucional } from '../types/product';
import { getTipoPlantillaMeta } from '../types/product';
import { projectId as SUPA_PROJECT_ID, publicAnonKey } from '/utils/supabase/info';

type SolId = number | string;

// ─────────────────────────────────────────────────────────────────────────────
// Claves de documentos (clave institucional)
// ─────────────────────────────────────────────────────────────────────────────
export const CLAVE_SOLICITUD_BASE   = 'SOLICITUD_BASE';
export const CLAVE_CONTRATO_BASE    = 'CONTRATO_BASE';
export const CLAVE_PAGARE_BASE      = 'PAGARE_BASE';
export const CLAVE_CONTRATO_FIRMADO = 'CONTRATO_FIRMADO';
export const CLAVE_PAGARE_FIRMADO   = 'PAGARE_FIRMADO';
/**
 * Debe coincidir EXACTAMENTE con el `tipo` del requisito configurado en el
 * producto (expedientesElectronicos → clave DOC-BURO), porque el expediente
 * empareja documentos con requisitos por nombre de tipo. Si no coincide, la
 * validación IA lo rechaza con "se esperaba X, se encontró Y".
 */
export const CLAVE_REPORTE_BURO     = 'Autorización Buró de Crédito';

/**
 * Fase 3 — Contratación e Instrumentación. Igual que el Buró, estos nombres
 * deben coincidir EXACTAMENTE con el `tipo` de los requisitos del producto
 * (DOC-CONTRATO-FIRMADO, DOC-PAGARE, DOC-ANXREN).
 */
export const CLAVE_CONTRATO_REQ = 'Contrato Firmado';
export const CLAVE_PAGARE_REQ   = 'Pagaré de Respaldo';
export const CLAVE_ANEXO_RENTAS = 'Anexo de Rentas';

/**
 * Fase 6 — Liberación y Dispersión (Tesorería). Debe coincidir EXACTAMENTE con
 * el requisito DOC-SPEI del producto; la validación IA compara por nombre.
 */
export const CLAVE_COMPROBANTE_SPEI = 'Comprobante de Transferencia SPEI';

/** Bucket de Supabase Storage para expedientes electrónicos */
const BUCKET_EXPEDIENTES = 'make-7e2d13d9-expedientes-electronicos-prospectos';

const API_BASE_DOCS = `https://${SUPA_PROJECT_ID}.supabase.co/functions/v1/make-server-7e2d13d9`;
const UUID_RE_DOCS = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Persiste el arreglo completo de documentos del expediente en la BD
 * (J_CUENTAS_CORP_CLIENTES.data.solicitud.expediente_electronico.documentos).
 *
 * Se llama directamente desde los generadores automáticos porque el
 * auto-guardado general del formulario no siempre alcanza a correr (o falla
 * en silencio) cuando el documento se crea fuera de un "Guardar" explícito.
 * El endpoint PUT hace deep merge del lado del servidor, así que sólo se
 * envía la rama del expediente y el resto del JSON queda intacto.
 */
async function persistirDocumentosEnBD(
  solicitudId: SolId,
  documentos: DocumentoCargado[],
): Promise<{ ok: boolean; error?: string }> {
  const id = String(solicitudId);
  if (!UUID_RE_DOCS.test(id)) {
    return { ok: false, error: 'La solicitud aún no tiene ID de BD (guarde la solicitud primero).' };
  }

  // camelCase (front) → snake_case (columna JSONB), mismo shape que lee
  // preloadSubtabsFromDBData al reabrir la solicitud.
  const docsDB = documentos.map(d => ({
    id: d.id,
    fecha_creacion: d.fecha,
    usuario: d.usuario || '',
    tipo_documento: d.tipoDocumento || '',
    archivo_adjunto: d.archivo || '',
    tipo_archivo: d.tipoArchivo || '',
    nota: d.nota || '',
    area: d.area || '',
    fase: d.fase || '',
    fase_id: d.faseId ?? 0,
    estatus: d.estatus || '',
    validado_ia: d.validadoIA ?? false,
    url: d.url || '',
    storage_path: (d as any).storagePath || '',
    storage_bucket: (d as any).storageBucket || BUCKET_EXPEDIENTES,
    mime: d.mime || '',
    tamano_kb: d.tamanoKB ?? 0,
  }));

  try {
    const res = await fetch(`${API_BASE_DOCS}/solicitudes-credito/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: { solicitud: { expediente_electronico: { documentos: docsDB } } },
      }),
    });
    if (res.ok) return { ok: true };
    const json = await res.json().catch(() => ({} as any));
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

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
  rfc?: string;
  curp?: string;
  domicilio?: string;
  finalidad?: string;
  sucursal?: string;
  telefono?: string;
  email?: string;
  fechaNacimiento?: string;
  // ── Fase 6 — Dispersión al proveedor (Tesorería) ──
  proveedor?: string;
  bancoProveedor?: string;
  clabeProveedor?: string;
  montoDispersar?: number;
  claveRastreo?: string;
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

const BURO_PRIMARY = [30, 64, 120] as [number, number, number];
const BURO_LIGHT    = [245, 247, 250] as [number, number, number];
const BURO_BORDER   = [200, 208, 220] as [number, number, number];
const BURO_GREEN    = [34, 139, 84] as [number, number, number];
const BURO_AMBER    = [180, 130, 20] as [number, number, number];

/**
 * Genera el PDF de "Autorización Buró de Crédito" (Fase 2 — Análisis y
 * Dictaminación), con el mismo lenguaje visual institucional que el resto de
 * los documentos generados (jsPDF + autoTable + logo, ver
 * solicitudActivacionPDF.ts).
 *
 * El título y el tipo deben coincidir con el requisito DOC-BURO del producto
 * ("Autorización Buró de Crédito"); incluye además el resultado simulado de la
 * consulta. No hay integración real con una Sociedad de Información Crediticia.
 */
export function generarReporteBuroPDF(datos: DatosSolicitud): string {
  const fecha = new Date().toLocaleString('es-MX');
  // Score determinístico por solicitud (600-780) para que no sea siempre idéntico.
  const seed = String(datos.noSol || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const score = 600 + (seed % 181);
  const folio = `SIC-${new Date().getFullYear()}${String(seed % 900000 + 100000)}`;
  const calificacion = score >= 700 ? 'Excelente' : score >= 650 ? 'Bueno' : 'Aceptable';
  const scoreColor = score >= 700 ? BURO_GREEN : score >= 650 ? BURO_PRIMARY : BURO_AMBER;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth();
  let y = 15;

  // ── Header bar ──
  const HEADER_H = 28;
  doc.setFillColor(...BURO_PRIMARY);
  doc.rect(0, 0, W, HEADER_H, 'F');

  const LOGO_W = 30;
  const LOGO_H = 20;
  const LOGO_Y = (HEADER_H - LOGO_H) / 2;
  const PAD = 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14 - PAD, LOGO_Y - PAD, LOGO_W + PAD * 2, LOGO_H + PAD * 2, 2, 2, 'F');
  try { doc.addImage(logoSrc as string, 'PNG', 14, LOGO_Y, LOGO_W, LOGO_H); } catch { /* logo opcional */ }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTORIZACIÓN BURÓ DE CRÉDITO', 14 + LOGO_W + 5, 13);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Folio: ${folio}`, W - 14, 9, { align: 'right' });
  doc.text(`Consulta: ${fecha}`, W - 14, 15, { align: 'right' });
  doc.text(`No. Solicitud: ${datos.noSol || '—'}`, W - 14, 21, { align: 'right' });

  y = HEADER_H + 8;

  // ── DATOS DEL CONSULTADO ──
  doc.setFillColor(...BURO_LIGHT);
  doc.setDrawColor(...BURO_BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...BURO_PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL TITULAR', 17, y + 5);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: BURO_PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    head: [['Campo', 'Valor', 'Campo', 'Valor']],
    body: [
      ['Nombre / Razón Social', datos.cliente || '—', 'RFC', datos.rfc || '—'],
      ['CURP', datos.curp || '—', 'Domicilio', datos.domicilio || '—'],
      ['Producto', datos.productoNombre || datos.tipoProducto || '—', 'Sociedad Consultante', 'Sociedad de Información Crediticia'],
    ],
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── TEXTO DE AUTORIZACIÓN ──
  doc.setFillColor(...BURO_LIGHT);
  doc.setDrawColor(...BURO_BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...BURO_PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTORIZACIÓN DE CONSULTA', 17, y + 5);
  y += 11;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const textoAutorizacion =
    `Por este conducto autorizo expresamente a la institución financiera para que, por conducto de sus ` +
    `funcionarios facultados, lleve a cabo investigaciones sobre mi comportamiento crediticio en las ` +
    `Sociedades de Información Crediticia que estime conveniente. Declaro que conozco la naturaleza y ` +
    `alcance de la información que se solicitará, del uso que se le dará y que podrá realizarse consultas ` +
    `periódicas durante la vigencia de la operación de arrendamiento solicitada. Acepto que este documento ` +
    `quede bajo propiedad de la institución para efectos de control y cumplimiento del artículo 28 de la ` +
    `Ley para Regular las Sociedades de Información Crediticia.`;
  const lineasAut = doc.splitTextToSize(textoAutorizacion, W - 28);
  doc.text(lineasAut, 14, y);
  y += lineasAut.length * 4 + 8;

  // ── RESULTADO DE LA CONSULTA ──
  doc.setFillColor(...BURO_LIGHT);
  doc.setDrawColor(...BURO_BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...BURO_PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('RESULTADO DE LA CONSULTA', 17, y + 5);
  y += 10;

  // Score destacado en tarjeta a la izquierda
  const CARD_W = 55;
  const CARD_H = 30;
  doc.setFillColor(...BURO_LIGHT);
  doc.setDrawColor(...scoreColor);
  doc.roundedRect(14, y, CARD_W, CARD_H, 2, 2, 'FD');
  doc.setTextColor(...scoreColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(String(score), 14 + CARD_W / 2, y + 15, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('SCORE CREDITICIO', 14 + CARD_W / 2, y + 21, { align: 'center' });
  doc.setTextColor(...scoreColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(calificacion.toUpperCase(), 14 + CARD_W / 2, y + 26.5, { align: 'center' });

  autoTable(doc, {
    startY: y,
    margin: { left: 14 + CARD_W + 6, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: BURO_PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 } },
    head: [['Indicador', 'Resultado']],
    body: [
      ['Estatus de la consulta', 'Consulta exitosa'],
      ['Resultado del dictamen', 'Aprobado'],
      ['Rango de score', '600 – 780 (escala simulada)'],
    ],
  });
  y = Math.max(
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY,
    y + CARD_H
  ) + 8;

  // ── AVISO ──
  doc.setFillColor(...BURO_LIGHT);
  doc.setDrawColor(...BURO_BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...BURO_PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('AVISO', 17, y + 5);
  y += 10;

  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  const avisoLines = doc.splitTextToSize(
    'Documento simulado generado automáticamente por el sistema para efectos de flujo interno de análisis y dictaminación. No constituye una consulta real ante una Sociedad de Información Crediticia (SIC) conforme a la Ley para Regular las Sociedades de Información Crediticia.',
    W - 28
  );
  doc.text(avisoLines, 14, y);
  y += avisoLines.length * 4 + 16;

  // ── FIRMA DEL TITULAR ──
  const SIG_W = 70;
  const sigX = (W - SIG_W) / 2;
  doc.setDrawColor(90, 90, 90);
  doc.line(sigX, y, sigX + SIG_W, y);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(datos.cliente || 'Titular', W / 2, y + 5, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Nombre y firma del titular', W / 2, y + 10, { align: 'center' });
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, W / 2, y + 15, { align: 'center' });

  return doc.output('datauristring');
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
  fileData?: string;
  /** id (DocumentoCargado.id) del documento recién creado — para abrir su vista previa de inmediato */
  documentoCreadoId?: number;
  /**
   * PDFs recién generados, con su contenido, para abrir/descargar de inmediato.
   * Se entregan aquí y no vía storage porque los PDFs render­izados desde
   * plantilla HTML son pesados y sessionStorage puede rechazarlos por cuota.
   */
  documentosGenerados?: Array<{ tipo: string; archivo: string; fileData: string }>;
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

  // Helper: genera fileData desde plantilla (archivoData) o fallback a PDF genérico
  const generarFileData = async (
    plantilla: typeof plantillaContrato,
    fallback: () => string,
  ): Promise<string> => {
    if (plantilla.archivoData) {
      const decodedHtml = decodificarArchivoData(plantilla.archivoData);
      const htmlSource = sustituirPlaceholders(decodedHtml, datos);
      try {
        return await htmlToPdfBlobUrl(htmlSource);
      } catch (e) {
        console.warn('[generarDocumentosFase4] Error renderizando plantilla a PDF, usando fallback:', e);
      }
    }
    return fallback();
  };

  // ── PASO 4: Generar y subir CONTRATO_BASE ──
  if (!existe(CLAVE_CONTRATO_BASE)) {
    const fileData = await generarFileData(plantillaContrato, () => generarContratoPDF(datos));
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
    const fileData = await generarFileData(plantillaPagare, () => generarPagePDF(datos));
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
// Fase 2 — Análisis y Dictaminación: Reporte de Buró (simulado)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea automáticamente en el Expediente Electrónico:
 *   - REPORTE_BURO (Fase 2, PDF simulado, Pendiente de Validación IA)
 *
 * No requiere plantilla — el reporte de buró siempre se genera con el
 * formato nativo (Score y consulta simulados como exitosos).
 * Respeta la regla de NO DUPLICAR: si ya existe (por clave) → se omite.
 */
export async function autoCrearReporteBuro(opts: AutoCrearOpts): Promise<AutoCrearResult> {
  const { storageId, datos, supabase, projectId: pid } = opts;
  const fecha = new Date().toLocaleString('es-MX');

  const docsPrevios: DocumentoCargado[] =
    loadFromSession<DocumentoCargado[]>(storageId, 'documentos') ??
    loadFromSavedStore<DocumentoCargado[]>(storageId, 'documentos') ??
    [];

  const existe = docsPrevios.some(d =>
    d.tipoDocumento === CLAVE_REPORTE_BURO || (d as any).claveDocumento === CLAVE_REPORTE_BURO
  );

  if (existe) {
    return {
      exito: true,
      documentosCreados: [],
      pdfGenerados: [],
      subidosASupabase: false,
      registradosEnExpediente: true,
      error: undefined,
      validacionPlantillas: { valido: true, motivos: [], faltantes: [], plantillasDetectadas: [], puedeGenerarDocumentos: true },
    };
  }

  const fileData = generarReporteBuroPDF(datos);
  let uploadInfo: UploadResult | null = null;
  let subidosASupabase = false;

  if (supabase && pid) {
    uploadInfo = await uploadGeneratedPDF(supabase, fileData, 'autorizacion_buro_credito.pdf', String(storageId), pid);
    if (uploadInfo) subidosASupabase = true;
  }

  const nuevo: DocumentoCargado = {
    id: generateId(),
    fecha,
    usuario: 'Sistema',
    tipoDocumento: CLAVE_REPORTE_BURO,
    archivo: 'autorizacion_buro_credito.pdf',
    tipoArchivo: 'pdf',
    nota: 'Autorización Buró de Crédito generada automáticamente (simulada). Consulta exitosa, score aprobado. Pendiente de Validación IA.',
    // area/fase deben coincidir con el requisito DOC-BURO del producto.
    area: 'Comercial',
    fase: 'Análisis y Dictaminación',
    faseId: 2,
    estatus: 'Pendiente Validación IA',
    validadoIA: false,
    fileData,
    url: uploadInfo?.url,
    storagePath: uploadInfo?.storagePath,
    mime: 'application/pdf',
    tamanoKB: uploadInfo?.tamanoKB || Math.round((fileData.length * 3) / 4 / 1024) || 1,
  } as DocumentoCargado & { storagePath?: string };

  const docsActualizados = [...docsPrevios, nuevo];
  saveToSession(storageId, 'documentos', docsActualizados);

  // Persistir en BD de inmediato — no depender del auto-guardado del formulario,
  // que puede no ejecutarse (o fallar en silencio) al generar fuera de un "Guardar".
  const persist = await persistirDocumentosEnBD(storageId, docsActualizados);

  console.log(
    `[autoCrearReporteBuro] Reporte de Buró creado para solicitud ${storageId} | Storage: ${subidosASupabase ? 'OK' : 'local'} | BD: ${persist.ok ? 'OK' : `FALLÓ (${persist.error})`}`
  );

  return {
    exito: true,
    documentosCreados: [CLAVE_REPORTE_BURO],
    pdfGenerados: ['autorizacion_buro_credito.pdf'],
    subidosASupabase,
    registradosEnExpediente: persist.ok,
    error: persist.ok ? undefined : `Documento generado pero NO persistido en BD: ${persist.error}`,
    validacionPlantillas: { valido: true, motivos: [], faltantes: [], plantillasDetectadas: [], puedeGenerarDocumentos: true },
    documentoCreadoId: nuevo.id,
    fileData,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 3 — Contratación e Instrumentación (Kit Legal)
// ─────────────────────────────────────────────────────────────────────────────

/** Fila de renta/amortización normalizada para el Anexo de Rentas. */
interface FilaAnexo {
  no: number;
  fecha: string;
  rentaSinIva: number;
  seguro: number;
  iva: number;
  total: number;
}

/**
 * Lee el calendario de rentas (Arrendamiento Puro) o la tabla de amortización
 * (Crédito / Arrendamiento Financiero) desde el almacenamiento de la solicitud
 * y la normaliza para el Anexo de Rentas.
 */
function leerFilasAnexo(storageId: SolId): FilaAnexo[] {
  // Arrendamiento Puro: calendario de rentas fijas
  const arr: any =
    loadFromSession<any>(storageId, 'simulacion_arrendamiento') ??
    loadFromSavedStore<any>(storageId, 'simulacion_arrendamiento');
  if (arr?.calendario?.length > 0) {
    return arr.calendario.map((r: any) => ({
      no: r.noRenta,
      fecha: r.fechaPago || '',
      rentaSinIva: r.rentaSinIva || 0,
      seguro: r.seguro || 0,
      iva: r.iva || 0,
      total: r.pagoPeriodo || 0,
    }));
  }

  // Crédito / Arrendamiento Financiero: tabla de amortización
  const sim: any[] =
    loadFromSession<any[]>(storageId, 'simulacion') ??
    loadFromSavedStore<any[]>(storageId, 'simulacion') ??
    [];
  return sim.map((r: any) => {
    const capital = r.pagoCapital || 0;
    const interes = r.pagoInteres || 0;
    const iva = r.ivaInteres || 0;
    const seguro = r.pagoSeguro || 0;
    return {
      no: r.noPago,
      fecha: r.fechaPago || '',
      rentaSinIva: capital + interes,
      seguro,
      iva,
      total: r.pagoPeriodo ?? capital + interes + iva + seguro,
    };
  });
}

function money(n: number): string {
  return (n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Genera el PDF del Anexo de Rentas — la tabla de rentas/amortización que se
 * firma de conformidad y que acompaña al contrato de arrendamiento.
 */
export function generarAnexoRentasPDF(datos: DatosSolicitud, filas: FilaAnexo[]): string {
  const t = datos.terminos ?? {};
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth();

  const HEADER_H = 28;
  doc.setFillColor(...BURO_PRIMARY);
  doc.rect(0, 0, W, HEADER_H, 'F');
  const LOGO_W = 30, LOGO_H = 20, LOGO_Y = (HEADER_H - LOGO_H) / 2, PAD = 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14 - PAD, LOGO_Y - PAD, LOGO_W + PAD * 2, LOGO_H + PAD * 2, 2, 2, 'F');
  try { doc.addImage(logoSrc as string, 'PNG', 14, LOGO_Y, LOGO_W, LOGO_H); } catch { /* opcional */ }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ANEXO DE RENTAS', 14 + LOGO_W + 5, 13);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Contrato: ${datos.noSol || '—'}`, W - 14, 9, { align: 'right' });
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, W - 14, 15, { align: 'right' });
  doc.text(`Arrendatario: ${datos.cliente || '—'}`, W - 14, 21, { align: 'right' });

  let y = HEADER_H + 8;

  // Condiciones generales
  doc.setFillColor(...BURO_LIGHT);
  doc.setDrawColor(...BURO_BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...BURO_PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CONDICIONES DE LA OPERACIÓN', 17, y + 5);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: BURO_PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 2: { fontStyle: 'bold', cellWidth: 45 } },
    head: [['Campo', 'Valor', 'Campo', 'Valor']],
    body: [
      ['Producto', datos.productoNombre || datos.tipoProducto || '—', 'Moneda', String(t.moneda || 'MXN')],
      ['Monto Autorizado', money(parseFloat(String(t.montoAutorizado || t.montoSolicitado || 0))), 'Plazo', `${t.plazo || '—'}`],
      ['Tasa Anual', `${t.tasa || '—'}%`, 'Frecuencia', String(t.frecuencia || '—')],
      ['No. de Rentas', String(filas.length), 'Primer Pago', String(t.fechaPrimerPago || '—')],
    ],
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Tabla de rentas
  doc.setFillColor(...BURO_LIGHT);
  doc.setDrawColor(...BURO_BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...BURO_PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CALENDARIO DE RENTAS', 17, y + 5);
  y += 10;

  const totRenta = filas.reduce((s, f) => s + f.rentaSinIva, 0);
  const totSeguro = filas.reduce((s, f) => s + f.seguro, 0);
  const totIva = filas.reduce((s, f) => s + f.iva, 0);
  const totPago = filas.reduce((s, f) => s + f.total, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [50, 50, 50] },
    headStyles: { fillColor: BURO_PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { cellWidth: 30 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    head: [['No.', 'Fecha', 'Renta sin IVA', 'Seguro', 'IVA', 'Pago Periodo']],
    body: filas.length > 0
      ? filas.map(f => [String(f.no), f.fecha, money(f.rentaSinIva), money(f.seguro), money(f.iva), money(f.total)])
      : [[{ content: 'Sin calendario generado — ejecute "Simular" en la solicitud.', colSpan: 6, styles: { halign: 'center', textColor: [150, 150, 150] } } as any]],
    foot: filas.length > 0
      ? [[
          { content: 'TOTALES', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: money(totRenta), styles: { halign: 'right', fontStyle: 'bold' } },
          { content: money(totSeguro), styles: { halign: 'right', fontStyle: 'bold' } },
          { content: money(totIva), styles: { halign: 'right', fontStyle: 'bold' } },
          { content: money(totPago), styles: { halign: 'right', fontStyle: 'bold' } },
        ]]
      : undefined,
    footStyles: { fillColor: [235, 238, 245], textColor: [30, 30, 30] },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  // Firma de conformidad
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 40) { doc.addPage(); y = 25; }
  const SIG_W = 70;
  const sigX = (W - SIG_W) / 2;
  doc.setDrawColor(90, 90, 90);
  doc.line(sigX, y, sigX + SIG_W, y);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(datos.cliente || 'Arrendatario', W / 2, y + 5, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Firma de conformidad del arrendatario', W / 2, y + 10, { align: 'center' });

  return doc.output('datauristring');
}

/**
 * Crea el "Kit Legal" de la Fase 3 (Contratación e Instrumentación):
 *   - Contrato Firmado   — desde la plantilla tipo "contrato" del producto
 *   - Pagaré de Respaldo — desde la plantilla tipo "pagare" del producto
 *   - Anexo de Rentas    — calendario de rentas/amortización de la solicitud
 *
 * Los tres se suben a Storage, se registran en el expediente y se persisten
 * en BD. Respeta la regla de NO DUPLICAR (por tipo de documento).
 */
export async function autoCrearKitLegal(opts: AutoCrearOpts): Promise<AutoCrearResult> {
  const { storageId, datos, plantillas, supabase, projectId: pid } = opts;
  const fecha = new Date().toLocaleString('es-MX');

  const validacionPlantillas = validarPlantillasRequeridas(plantillas);
  if (!validacionPlantillas.puedeGenerarDocumentos) {
    return {
      exito: false,
      documentosCreados: [],
      pdfGenerados: [],
      subidosASupabase: false,
      registradosEnExpediente: false,
      error: validacionPlantillas.motivos.join(' | '),
      validacionPlantillas,
    };
  }

  const plantillaContrato = plantillas!.find(p => p.tipoPlantilla === 'contrato' && p.estatus === 'Activo')!;
  const plantillaPagare   = plantillas!.find(p => p.tipoPlantilla === 'pagare'   && p.estatus === 'Activo')!;

  const docsPrevios: DocumentoCargado[] =
    loadFromSession<DocumentoCargado[]>(storageId, 'documentos') ??
    loadFromSavedStore<DocumentoCargado[]>(storageId, 'documentos') ?? [];
  const existe = (tipo: string) => docsPrevios.some(d => d.tipoDocumento === tipo);

  const filasAnexo = leerFilasAnexo(storageId);

  // Renderiza una plantilla HTML del producto a PDF (data URI, apto para subir).
  const desdePlantilla = async (pl: PlantillaInstitucional, fallback: () => string): Promise<string> => {
    if (pl.archivoData) {
      try {
        const html = sustituirPlaceholders(decodificarArchivoData(pl.archivoData), datos);
        return await htmlToPdfBlobUrl(html, 'datauri');
      } catch (e) {
        console.warn('[autoCrearKitLegal] Falló el render de la plantilla, usando fallback:', e);
      }
    }
    return fallback();
  };

  const nuevos: DocumentoCargado[] = [];
  const pdfGenerados: string[] = [];
  const documentosGenerados: Array<{ tipo: string; archivo: string; fileData: string }> = [];
  let subidosASupabase = false;
  let primerFileData: string | undefined;
  let primerId: number | undefined;

  const agregar = async (tipo: string, archivo: string, fileData: string, nota: string) => {
    let uploadInfo: UploadResult | null = null;
    if (supabase && pid) {
      uploadInfo = await uploadGeneratedPDF(supabase, fileData, archivo, String(storageId), pid);
      if (uploadInfo) subidosASupabase = true;
    }
    const doc: DocumentoCargado = {
      id: generateId(),
      fecha,
      usuario: 'Sistema',
      tipoDocumento: tipo,
      archivo,
      tipoArchivo: 'pdf',
      nota,
      area: 'Comercial',
      fase: 'Contratación e Instrumentación',
      faseId: 3,
      estatus: 'Pendiente Validación IA',
      validadoIA: false,
      // Sólo conservar el PDF embebido si NO se pudo subir a Storage: estos PDFs
      // pesan varios MB y guardarlos en sessionStorage revienta la cuota,
      // haciendo que se pierda TODO el arreglo de documentos.
      fileData: uploadInfo?.url ? undefined : fileData,
      url: uploadInfo?.url,
      storagePath: uploadInfo?.storagePath,
      mime: 'application/pdf',
      tamanoKB: uploadInfo?.tamanoKB || Math.round((fileData.length * 3) / 4 / 1024) || 1,
    } as DocumentoCargado & { storagePath?: string };
    nuevos.push(doc);
    pdfGenerados.push(archivo);
    documentosGenerados.push({ tipo, archivo, fileData });
    if (primerFileData === undefined) { primerFileData = fileData; primerId = doc.id; }
  };

  if (!existe(CLAVE_CONTRATO_REQ)) {
    const fd = await desdePlantilla(plantillaContrato, () => generarContratoPDF(datos));
    await agregar(
      CLAVE_CONTRATO_REQ,
      'contrato_arrendamiento.pdf',
      fd,
      `Generado desde la plantilla "${plantillaContrato.nombre}" (v${plantillaContrato.version}). Pendiente de firma y Validación IA.`,
    );
  }

  if (!existe(CLAVE_ANEXO_RENTAS)) {
    const fd = generarAnexoRentasPDF(datos, filasAnexo);
    await agregar(
      CLAVE_ANEXO_RENTAS,
      'anexo_de_rentas.pdf',
      fd,
      filasAnexo.length > 0
        ? `Calendario de ${filasAnexo.length} renta(s) generado desde la simulación de la solicitud. Pendiente de firma de conformidad.`
        : 'Sin calendario: ejecute "Simular" en la solicitud y vuelva a generar para incluir la tabla de rentas.',
    );
  }

  if (!existe(CLAVE_PAGARE_REQ)) {
    const fd = await desdePlantilla(plantillaPagare, () => generarPagePDF(datos));
    await agregar(
      CLAVE_PAGARE_REQ,
      'pagare_arrendamiento.pdf',
      fd,
      `Generado desde la plantilla "${plantillaPagare.nombre}" (v${plantillaPagare.version}). Pendiente de firma y Validación IA.`,
    );
  }

  if (nuevos.length === 0) {
    return {
      exito: true,
      documentosCreados: [],
      pdfGenerados: [],
      subidosASupabase: false,
      registradosEnExpediente: true,
      validacionPlantillas,
    };
  }

  const docsActualizados = [...docsPrevios, ...nuevos];
  saveToSession(storageId, 'documentos', docsActualizados);
  const persist = await persistirDocumentosEnBD(storageId, docsActualizados);

  console.log(
    `[autoCrearKitLegal] ${nuevos.length} documento(s) creados para ${storageId}:`,
    nuevos.map(d => d.tipoDocumento).join(', '),
    `| Storage: ${subidosASupabase ? 'OK' : 'local'} | BD: ${persist.ok ? 'OK' : `FALLÓ (${persist.error})`}`,
  );

  return {
    exito: true,
    documentosCreados: nuevos.map(d => d.tipoDocumento),
    pdfGenerados,
    subidosASupabase,
    registradosEnExpediente: persist.ok,
    error: persist.ok ? undefined : `Documentos generados pero NO persistidos en BD: ${persist.error}`,
    validacionPlantillas,
    documentoCreadoId: primerId,
    fileData: primerFileData,
    documentosGenerados,
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

  const tpNorm = (datos.tipoProducto || '').toLowerCase();
  const esInversion = tpNorm.includes('invers');

  const rows: Array<[string, string]> = [
    ['No. Solicitud',   datos.noSol || 'N/A'],
    ['Fecha',           fecha],
    ['',                ''],
    ['DATOS DEL SOLICITANTE', ''],
    ['Cliente',         datos.cliente || 'N/A'],
    ['RFC',             datos.rfc || 'N/A'],
    ['CURP',            datos.curp || 'N/A'],
    ['Fecha Nac.',      datos.fechaNacimiento || 'N/A'],
    ['Domicilio',       datos.domicilio || 'N/A'],
    ['Teléfono',        datos.telefono || 'N/A'],
    ['Email',           datos.email || 'N/A'],
    ['',                ''],
    ['DATOS DEL PRODUCTO', ''],
    ['Línea de Producto', datos.lineaProducto || 'N/A'],
    ['Tipo de Producto', datos.tipoProducto || 'N/A'],
    ['Producto',        datos.productoNombre || datos.tipoProducto || 'N/A'],
    ['',                ''],
    ...(esInversion ? [
      ['CONDICIONES DE LA INVERSION', ''] as [string,string],
      ['Monto de Inversión',  `${moneda} ${monto}`] as [string,string],
      ['Plazo',               plazo] as [string,string],
      ['Tasa / Rendimiento',  tasa] as [string,string],
      ['Método de Intereses', String(t.metodoIntereses || (t as any).metodoPagoIntereses || 'N/A')] as [string,string],
      ['Fecha de Inversión',  String(t.fechaPrimeraAportacion || (t as any).fechaInversion || 'N/A')] as [string,string],
      ['Moneda',              moneda] as [string,string],
      ['',                    ''] as [string,string],
      ['PERFIL DEL INVERSIONISTA', ''] as [string,string],
      ['Perfil',              String(t.perfilInversionista || 'N/A')] as [string,string],
      ['Riesgo',              String(t.riesgoInversionista || 'N/A')] as [string,string],
      ['Horizonte',           String(t.horizonteInversion  || 'N/A')] as [string,string],
      ['Experiencia',         String(t.experienciaInversion || 'N/A')] as [string,string],
    ] : [
      ['CONDICIONES DEL CREDITO', ''] as [string,string],
      ['Monto Solicitado', `${moneda} ${monto}`] as [string,string],
      ['Plazo',            plazo] as [string,string],
      ['Tasa Anual',       tasa] as [string,string],
      ['Moneda',           moneda] as [string,string],
      ['Finalidad',        datos.finalidad || 'N/A'] as [string,string],
    ]),
    ['',                ''],
    ['SUCURSAL',        datos.sucursal || 'N/A'],
    ['',                ''],
    [esInversion ? 'DECLARACION DEL INVERSIONISTA' : 'DECLARACION DEL SOLICITANTE', ''],
    [esInversion
      ? 'El inversionista declara que los recursos son de procedencia licita'
      : 'El suscrito manifiesta que los datos proporcionados son verdaderos', ''],
    ['y autoriza a la institucion a verificar la informacion correspondiente.', ''],
    ['',                ''],
    ['Fecha de solicitud:', fecha],
  ];

  return buildPDFDataUrl(
    esInversion ? 'SOLICITUD DE INVERSION A PLAZO' : 'SOLICITUD DE CREDITO',
    rows
  );
}

/**
 * Crea automáticamente en la Sección 2 del Expediente Electrónico:
 *   - SOLICITUD_BASE (Fase 2, PDF generado desde plantilla "solicitud")
 *
 * Respeta la regla de NO DUPLICAR: si ya existe → no se crea.
 * Requiere al menos 1 plantilla activa tipo "solicitud".
 */

// ─────────────────────────────────────────────────────────────────────────────
// Sustitución de placeholders {{...}} en HTML de plantilla
// ─────────────────────────────────────────────────────────────────────────────

/** Reemplaza todos los placeholders {{campo}} con los datos de la solicitud. */
export function sustituirPlaceholders(html: string, datos: DatosSolicitud): string {
  const t = datos.terminos ?? {};
  const fechaStr = new Date().toLocaleDateString('es-MX');
  const monto = t.montoSolicitado || t.monto || '';
  const plazoRaw = String(t.plazo || t.plazoMeses || '');
  const tasaValor = String(t.tasa || t.tasaAnual || t.tasaMinInteres || '');
  const catValor = String(t.cat || '');
  const garantiaValor = String(t.montoGarantia || '');
  const montoResidualValor = String(t.montoResidual || '');
  const descripcionBienValor = String(t.descripcionBien || (t as any).bienDescripcion || 'N/A');
  const seguroValor = String(t.montoSeguro || '');
  const freqValor = String(t.frecuencia || '');
  const tipoTasaValor = String(t.tipoTasa || '');
  const tipoCalcValor = String(t.tipoCalculo || '');
  const monedaValor = t.moneda || 'MXN';
  const fechaSolicitudValor = t.fechaSolicitud || fechaStr;
  const fechaPrimerPagoValor = String(t.fechaPrimerPago || 'N/A');

  const nombreCliente   = datos.cliente    || '';
  const rfcCliente      = datos.rfc        || 'N/A';
  const curpCliente     = datos.curp       || 'N/A';
  const domicilioCliente = datos.domicilio || 'N/A';
  const fechaNacCliente = datos.fechaNacimiento || 'N/A';

  // Fecha en formato largo (ej. "22 de abril de 2026")
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const hoy = new Date();
  const fechaLarga = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  // Fecha de vencimiento (plazo en meses desde hoy)
  const mesesPlazo = parseInt(plazoRaw) || 0;
  const fechaVenc = (() => {
    if (!mesesPlazo) return 'N/A';
    const d = new Date();
    d.setMonth(d.getMonth() + mesesPlazo);
    return d.toLocaleDateString('es-MX');
  })();

  // Pago periódico (pagoMensual, primerPago, pagoPeriodico, etc.)
  const pagoPeriodicoNum = Number(
    t.pagoMensual || t.primerPago || t.pagoPeriodico || t.pago || 0
  );
  const pagoPeriodico = String(
    t.pagoMensual || t.primerPago || t.pagoPeriodico || t.pago || ''
  ) || 'N/A';

  // Suma total de rentas del plazo (para el Pagaré de Arrendamiento Puro,
  // que ampara el total de rentas pactadas y no el valor del bien).
  const montoTotalRentasValor = mesesPlazo > 0 && pagoPeriodicoNum > 0
    ? (pagoPeriodicoNum * mesesPlazo).toFixed(2)
    : '';

  return html
    // ── Fechas ──
    .replace(/\{\{fecha\}\}/g, fechaStr)
    .replace(/\{\{fecha_emision\}\}/g, fechaStr)
    .replace(/\{\{fechaFirmaLarga\}\}/g, fechaLarga)
    .replace(/\{\{fecha_firma_larga\}\}/g, fechaLarga)
    .replace(/\{\{fecha_vencimiento\}\}/g, fechaVenc)
    .replace(/\{\{fecha_solicitud\}\}/g, fechaSolicitudValor)
    .replace(/\{\{fecha_primer_pago\}\}/g, fechaPrimerPagoValor)
    .replace(/\{\{fecha_inicio\}\}/g, String(t.fechaInicio || fechaStr))
    .replace(/\{\{fecha_fin\}\}/g, String(t.fechaFin || 'N/A'))
    .replace(/\{\{fecha_nacimiento\}\}/g, fechaNacCliente)
    .replace(/\{\{fecha_nac\}\}/g, fechaNacCliente)
    // ── No. Solicitud / Folio ──
    .replace(/\{\{folio\}\}/g, datos.noSol || '')
    .replace(/\{\{noSol\}\}/g, datos.noSol || '')
    .replace(/\{\{no_solicitud\}\}/g, datos.noSol || '')
    .replace(/\{\{numero_solicitud\}\}/g, datos.noSol || '')
    .replace(/\{\{numeroSolicitud\}\}/g, datos.noSol || '')
    // ── Nombre del cliente ── (cubrir todas las variantes de los templates)
    .replace(/\{\{clienteNombre\}\}/g, nombreCliente)
    .replace(/\{\{clienteNombreCompleto\}\}/g, nombreCliente)
    .replace(/\{\{cliente_nombre\}\}/g, nombreCliente)
    .replace(/\{\{nombre_cliente\}\}/g, nombreCliente)
    .replace(/\{\{nombre\}\}/g, nombreCliente)
    .replace(/\{\{nombre_completo\}\}/g, nombreCliente)
    .replace(/\{\{solicitante\}\}/g, nombreCliente)
    .replace(/\{\{deudor_nombre\}\}/g, nombreCliente)
    // ── RFC ──
    .replace(/\{\{clienteRFC\}\}/g, rfcCliente)
    .replace(/\{\{cliente_rfc\}\}/g, rfcCliente)
    .replace(/\{\{deudor_rfc\}\}/g, rfcCliente)
    .replace(/\{\{rfc\}\}/g, rfcCliente)
    // ── CURP ──
    .replace(/\{\{clienteCURP\}\}/g, curpCliente)
    .replace(/\{\{cliente_curp\}\}/g, curpCliente)
    .replace(/\{\{curp\}\}/g, curpCliente)
    // ── Domicilio ──
    .replace(/\{\{clienteDomicilio\}\}/g, domicilioCliente)
    .replace(/\{\{cliente_domicilio\}\}/g, domicilioCliente)
    .replace(/\{\{deudor_domicilio\}\}/g, domicilioCliente)
    .replace(/\{\{domicilio\}\}/g, domicilioCliente)
    .replace(/\{\{direccion\}\}/g, domicilioCliente)
    .replace(/\{\{direccion_cliente\}\}/g, domicilioCliente)
    // ── Datos adicionales del cliente ──
    .replace(/\{\{clienteFechaNacimientoConstitucion\}\}/g, fechaNacCliente)
    .replace(/\{\{clienteTipoPersonaDescripcion\}\}/g, 'N/A')
    .replace(/\{\{telefono\}\}/g, datos.telefono || 'N/A')
    .replace(/\{\{telefono_cliente\}\}/g, datos.telefono || 'N/A')
    .replace(/\{\{email\}\}/g, datos.email || 'N/A')
    .replace(/\{\{correo\}\}/g, datos.email || 'N/A')
    .replace(/\{\{correo_electronico\}\}/g, datos.email || 'N/A')
    // ── Producto ──
    .replace(/\{\{productoNombre\}\}/g, datos.productoNombre || datos.tipoProducto || 'N/A')
    .replace(/\{\{producto\}\}/g, datos.productoNombre || datos.tipoProducto || 'N/A')
    .replace(/\{\{nombre_producto\}\}/g, datos.productoNombre || datos.tipoProducto || 'N/A')
    .replace(/\{\{lineaProducto\}\}/g, datos.lineaProducto || 'N/A')
    .replace(/\{\{linea_producto\}\}/g, datos.lineaProducto || 'N/A')
    .replace(/\{\{tipoProducto\}\}/g, datos.tipoProducto || 'N/A')
    .replace(/\{\{tipo_producto\}\}/g, datos.tipoProducto || 'N/A')
    // ── Montos ──
    .replace(/\{\{monto\}\}/g, monto)
    .replace(/\{\{monto_solicitado\}\}/g, monto)
    .replace(/\{\{monto_autorizado\}\}/g, String(t.montoAutorizado || monto))
    .replace(/\{\{montoCredito\}\}/g, monto)
    .replace(/\{\{limite\}\}/g, monto)
    .replace(/\{\{limite_numero\}\}/g, monto)
    .replace(/\{\{limite_letra\}\}/g, monto)
    .replace(/\{\{monto_numero\}\}/g, monto)
    .replace(/\{\{monto_letra\}\}/g, monto)
    .replace(/\{\{monto_garantia\}\}/g, garantiaValor || 'N/A')
    .replace(/\{\{monto_seguro\}\}/g, seguroValor || 'N/A')
    .replace(/\{\{monto_residual\}\}/g, montoResidualValor || 'N/A')
    .replace(/\{\{montoResidual\}\}/g, montoResidualValor || 'N/A')
    .replace(/\{\{valor_residual\}\}/g, montoResidualValor || 'N/A')
    .replace(/\{\{descripcionBien\}\}/g, descripcionBienValor)
    .replace(/\{\{descripcion_bien\}\}/g, descripcionBienValor)
    .replace(/\{\{monto_total_rentas\}\}/g, montoTotalRentasValor || monto || 'N/A')
    .replace(/\{\{montoPago\}\}/g, pagoPeriodico)
    .replace(/\{\{monto_pago\}\}/g, pagoPeriodico)
    // ── Plazo ──
    .replace(/\{\{plazo\}\}/g, plazoRaw)
    .replace(/\{\{plazo_meses\}\}/g, plazoRaw)
    .replace(/\{\{plazoMeses\}\}/g, plazoRaw)
    .replace(/\{\{plazoDescripcion\}\}/g, plazoRaw ? `${plazoRaw} meses` : 'N/A')
    .replace(/\{\{plazo_descripcion\}\}/g, plazoRaw ? `${plazoRaw} meses` : 'N/A')
    .replace(/\{\{numeroPagos\}\}/g, plazoRaw || 'N/A')
    .replace(/\{\{numero_pagos\}\}/g, plazoRaw || 'N/A')
    // ── Tasas ──
    .replace(/\{\{tasa\}\}/g, tasaValor || 'N/A')
    .replace(/\{\{tasa_anual\}\}/g, tasaValor || 'N/A')
    .replace(/\{\{tasaAnual\}\}/g, tasaValor || 'N/A')
    .replace(/\{\{tasaInteres\}\}/g, tasaValor || 'N/A')
    .replace(/\{\{tasa_interes\}\}/g, tasaValor || 'N/A')
    .replace(/\{\{tasa_min_interes\}\}/g, tasaValor || 'N/A')
    .replace(/\{\{tasaMinInteres\}\}/g, String(t.tasaMinInteres || tasaValor || 'N/A'))
    .replace(/\{\{tasa_moratoria\}\}/g, String(t.tasaMoratoria || t.tasaMora || 'N/A'))
    .replace(/\{\{tipo_tasa\}\}/g, tipoTasaValor || 'N/A')
    .replace(/\{\{tipo_calculo\}\}/g, tipoCalcValor || 'N/A')
    .replace(/\{\{cat\}\}/g, catValor || 'N/A')
    // ── Otros financieros ──
    .replace(/\{\{frecuencia\}\}/g, freqValor || 'N/A')
    .replace(/\{\{moneda\}\}/g, monedaValor)
    // ── Localización ──
    .replace(/\{\{ciudad\}\}/g, 'N/A')
    .replace(/\{\{ciudadFirma\}\}/g, 'N/A')
    .replace(/\{\{ciudad_firma\}\}/g, 'N/A')
    .replace(/\{\{jurisdiccion\}\}/g, 'N/A')
    .replace(/\{\{lugar_pago\}\}/g, 'N/A')
    // ── Institución / Empresa ──
    .replace(/\{\{institucionNombre\}\}/g, 'N/A')
    .replace(/\{\{institucion_nombre\}\}/g, 'N/A')
    .replace(/\{\{acreedor_nombre\}\}/g, 'N/A')
    .replace(/\{\{aval_nombre\}\}/g, 'N/A')
    .replace(/\{\{empresa_nombre\}\}/g, 'N/A')
    .replace(/\{\{empresa_razon_social\}\}/g, 'N/A')
    .replace(/\{\{direccion_empresa\}\}/g, 'N/A')
    .replace(/\{\{empresa\}\}/g, 'N/A')
    // ── Solicitud / Operación ──
    .replace(/\{\{finalidad\}\}/g, datos.finalidad || 'N/A')
    .replace(/\{\{descripcion\}\}/g, datos.finalidad || 'N/A')
    .replace(/\{\{sucursal\}\}/g, datos.sucursal || 'N/A')
    .replace(/\{\{ejecutivo\}\}/g, 'N/A')
    .replace(/\{\{puesto\}\}/g, 'N/A')
    .replace(/\{\{ingreso\}\}/g, 'N/A')
    .replace(/\{\{antiguedad\}\}/g, 'N/A')
    // ── Inversión / Captación ──
    .replace(/\{\{perfil\}\}/g, String(t.perfilInversionista || (t as any).perfil || 'N/A'))
    .replace(/\{\{riesgo\}\}/g, String(t.riesgoInversionista || (t as any).riesgo || 'N/A'))
    .replace(/\{\{horizonte\}\}/g, String(t.horizonteInversion || (t as any).horizonte || 'N/A'))
    .replace(/\{\{experiencia\}\}/g, String(t.experienciaInversion || (t as any).experiencia || 'N/A'))
    .replace(/\{\{rendimiento\}\}/g, String(t.tasa || (t as any).rendimiento || 'N/A'))
    .replace(/\{\{metodo_intereses\}\}/g, String(t.metodoIntereses || (t as any).metodoPagoIntereses || 'N/A'))
    .replace(/\{\{metodoIntereses\}\}/g, String(t.metodoIntereses || (t as any).metodoPagoIntereses || 'N/A'))
    .replace(/\{\{metodo_pago_intereses\}\}/g, String(t.metodoIntereses || (t as any).metodoPagoIntereses || 'N/A'))
    .replace(/\{\{fecha_inversion\}\}/g, String(t.fechaPrimeraAportacion || (t as any).fechaInversion || 'N/A'))
    .replace(/\{\{fecha_primera_aportacion\}\}/g, String(t.fechaPrimeraAportacion || (t as any).fechaInversion || 'N/A'))
    .replace(/\{\{monto_inversion\}\}/g, monto)
    .replace(/\{\{montoInversion\}\}/g, monto)
    // ── Catch-all: cualquier {{placeholder}} no reconocido → vacío ──
    .replace(/\{\{[^}]+\}\}/g, '');
}

/** Decodifica archivoData (base64 data URL o texto plano) a string HTML. */
export function decodificarArchivoData(raw: string): string {
  const b64Match = raw.match(/^data:([^;]+);base64,(.+)$/s);
  return b64Match
    ? new TextDecoder('utf-8').decode(Uint8Array.from(atob(b64Match[2]), c => c.charCodeAt(0)))
    : raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML → PDF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza HTML a PDF usando html2canvas + jsPDF y devuelve un Blob URL.
 *
 * El contenedor se posiciona en la esquina superior-izquierda del viewport
 * (left:0;top:0) detrás del contenido (z-index:-1) para que html2canvas pueda
 * capturarlo correctamente — si se usa left:-9999px, getBoundingClientRect()
 * devuelve x=-9999 y html2canvas renderiza fuera del canvas produciendo un PDF
 * en blanco. Los estilos se inyectan dentro del contenedor para que se eliminen
 * junto con él sin afectar de forma persistente el CSS de la aplicación.
 */
export async function htmlToPdfBlobUrl(html: string, salida: 'blob' | 'datauri' = 'blob'): Promise<string> {
  // ── 1. Extraer <style> y contenido del <body> ─────────────────────────────
  const styleBlocks: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = styleRegex.exec(html)) !== null) styleBlocks.push(sm[1]);

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  // ── 2. Contenedor en viewport (left:0;top:0) detrás del contenido ─────────
  // CRÍTICO: left:-9999px hace que getBoundingClientRect().left = -9999 y
  // html2canvas renderiza fuera del canvas → PDF en blanco.
  const container = document.createElement('div');
  // 850px en lugar de 794px para evitar que texto alineado a la derecha quede cortado al borde.
  // El PDF final escala la imagen a 210mm (A4) independientemente del ancho de captura.
  const CAPTURE_W = 850;
  container.style.cssText = `position:fixed;left:0;top:0;width:${CAPTURE_W}px;background:#fff;z-index:-1;pointer-events:none;overflow:visible;`;

  const styleTag = styleBlocks.length
    ? `<style>${styleBlocks.join('\n')}</style>`
    : '';
  // Override extra para que el contenido interno no desborde horizontalmente
  const safetyStyle = `<style>
    *{box-sizing:border-box!important}
    body,html{max-width:100%!important;overflow-x:hidden!important}
    .page,.sheet{max-width:100%!important}
  </style>`;
  container.innerHTML = safetyStyle + styleTag + bodyContent;
  document.body.appendChild(container);

  // Esperar fonts e imágenes
  await new Promise(r => setTimeout(r, 700));

  try {
    // Capturar la primera .page si existe; sino el contenedor completo
    const pageEl = (container.querySelector('.page') as HTMLElement)
      || (container.querySelector('[class*="page"]') as HTMLElement)
      || container;

    // Forzar que la altura mínima se compute (para que flex space-between funcione)
    const computedH = window.getComputedStyle(pageEl).minHeight;
    const minHPx = computedH && computedH !== 'none' ? parseFloat(computedH) : 0;
    const elW = CAPTURE_W;
    const elH = Math.max(pageEl.scrollHeight, pageEl.offsetHeight, minHPx, 100);

    // Escala 1.5 (antes 2): a 850px de captura da ~1275px de ancho, suficiente
    // para texto nítido en A4, y reduce ~44% los píxeles a codificar.
    const canvas = await html2canvas(pageEl, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: elW,
      height: elH,
      windowWidth: CAPTURE_W,
      windowHeight: elH,
    });

    // Calidad 0.8 (antes 0.92): en documentos de texto la diferencia visual es
    // imperceptible y el peso baja de forma notable.
    const imgData = canvas.toDataURL('image/jpeg', 0.8);
    const PAGE_W = 210;
    const PAGE_H = 297;
    // compress: activa la compresión de streams del PDF.
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

    const imgW = PAGE_W;
    const imgH = (canvas.height / canvas.width) * PAGE_W;
    let yLeft = imgH;
    let yOffset = 0;

    // Alias fijo ('doc') en todas las páginas: sin él, jsPDF incrusta una copia
    // completa de la MISMA imagen por cada página, multiplicando el tamaño del
    // archivo en documentos de varias páginas. Con alias se almacena una vez y
    // las demás páginas la referencian.
    const ALIAS = 'doc';
    pdf.addImage(imgData, 'JPEG', 0, yOffset, imgW, imgH, ALIAS, 'FAST');
    yLeft -= PAGE_H;

    while (yLeft > 0) {
      yOffset -= PAGE_H;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, yOffset, imgW, imgH, ALIAS, 'FAST');
      yLeft -= PAGE_H;
    }

    // Liberar el canvas: en documentos largos ocupa decenas de MB en memoria.
    canvas.width = 0;
    canvas.height = 0;

    // 'datauri' es necesario cuando el PDF se va a subir a Storage: la utilidad
    // de subida convierte data URL → File, y un blob URL no es parseable ahí.
    return salida === 'datauri'
      ? pdf.output('datauristring')
      : URL.createObjectURL(pdf.output('blob'));
  } finally {
    try { document.body.removeChild(container); } catch (_) {}
  }
}

export async function autoCrearDocumentosFase2(opts: AutoCrearOpts): Promise<AutoCrearResult> {
  const { storageId, datos, plantillas, supabase, projectId: pid } = opts;
  const fecha = new Date().toLocaleString('es-MX');
  const labelSolicitud = getTipoPlantillaMeta('solicitud')?.label || 'Solicitud de Crédito';

  // Validar que exista plantilla activa tipo "solicitud"
  const plantillasActivas = (plantillas || []).filter(p => p.estatus === 'Activo');
  const plantillaSolicitud = plantillasActivas.find(p => p.tipoPlantilla === 'solicitud');

  console.log('[autoCrearDocumentosFase2] plantillasActivas:', plantillasActivas.map(p => ({
    nombre: p.nombre,
    tipo: p.tipoPlantilla,
    estatus: p.estatus,
    archivoBase: p.archivoBase,
    archivoDataLen: p.archivoData?.length || 0,
  })));
  console.log('[autoCrearDocumentosFase2] plantillaSolicitud encontrada:', !!plantillaSolicitud, plantillaSolicitud ? {
    nombre: plantillaSolicitud.nombre,
    archivoBase: plantillaSolicitud.archivoBase,
    archivoDataLen: plantillaSolicitud.archivoData?.length || 0,
  } : null);

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

  // Generar PDF — usar plantilla real si existe, sino fallback
  let fileData: string;

  if (plantillaSolicitud?.archivoData) {
    const decodedHtml = decodificarArchivoData(plantillaSolicitud.archivoData);
    const htmlSource = sustituirPlaceholders(decodedHtml, datos);
    try {
      fileData = await htmlToPdfBlobUrl(htmlSource);
    } catch (e) {
      console.warn('[generarDocumentosFase2] Error renderizando plantilla a PDF:', e);
      fileData = generarSolicitudPDF(datos);
    }
    console.log(`[generarDocumentosFase2] Usando plantilla: "${plantillaSolicitud.nombre}" v${plantillaSolicitud.version}`);
  } else {
    fileData = generarSolicitudPDF(datos);
    console.log('[generarDocumentosFase2] Sin plantilla — PDF genérico con datos del formulario');
  }

  // NO registrar en expediente ni subir a Supabase — solo generar y descargar
  return {
    exito: true,
    documentosCreados: [],
    pdfGenerados: ['Solicitud.pdf'],
    subidosASupabase: false,
    registradosEnExpediente: false,
    error: undefined,
    validacionPlantillas,
    fileData,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// FASE 6 — Liberación y Dispersión (Tesorería)
// ═════════════════════════════════════════════════════════════════════════════

const SPEI_PRIMARY = [17, 61, 110] as [number, number, number];
const SPEI_LIGHT   = [244, 247, 251] as [number, number, number];
const SPEI_BORDER  = [198, 208, 222] as [number, number, number];
const SPEI_GREEN   = [21, 128, 61] as [number, number, number];

/**
 * Clave de rastreo SPEI determinística por solicitud.
 *
 * Determinística a propósito: regenerar el comprobante de la misma solicitud
 * debe producir la misma clave, igual que un banco no reasigna la clave de una
 * transferencia ya ejecutada.
 */
export function generarClaveRastreo(noSol: string): string {
  const seed = String(noSol || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const hoy = new Date();
  const ymd = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;
  return `MBAN${ymd}${String((seed * 7919) % 1000000).padStart(6, '0')}`;
}

/** Enmascara una CLABE dejando visibles solo los últimos 4 dígitos. */
function enmascararClabe(clabe: string): string {
  const limpia = String(clabe || '').replace(/\D/g, '');
  if (limpia.length < 4) return '—';
  return `${'*'.repeat(Math.max(0, limpia.length - 4))}${limpia.slice(-4)}`;
}

/**
 * Genera el Comprobante de Transferencia SPEI de la dispersión al proveedor
 * (Fase 6 — Liberación y Dispersión).
 *
 * Vectorial (jsPDF + autoTable), no html2canvas: el comprobante debe pesar
 * pocos KB porque se adjunta al Expediente Electrónico y luego se convierte a
 * imagen para la validación IA.
 *
 * La transferencia es SIMULADA — no hay conexión con el SPEI de Banxico.
 */
export function generarComprobanteSPEIPDF(datos: DatosSolicitud): string {
  const ahora = new Date();
  const fechaHora = ahora.toLocaleString('es-MX');
  const claveRastreo = datos.claveRastreo || generarClaveRastreo(datos.noSol || '');
  const seed = String(datos.noSol || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const referencia = String((seed % 9000000) + 1000000);
  const monto = Number(datos.montoDispersar || 0);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const W = doc.internal.pageSize.getWidth();
  let y = 15;

  // ── Header ──
  const HEADER_H = 28;
  doc.setFillColor(...SPEI_PRIMARY);
  doc.rect(0, 0, W, HEADER_H, 'F');

  const LOGO_W = 30;
  const LOGO_H = 20;
  const LOGO_Y = (HEADER_H - LOGO_H) / 2;
  const PAD = 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14 - PAD, LOGO_Y - PAD, LOGO_W + PAD * 2, LOGO_H + PAD * 2, 2, 2, 'F');
  try { doc.addImage(logoSrc as string, 'PNG', 14, LOGO_Y, LOGO_W, LOGO_H); } catch { /* logo opcional */ }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROBANTE DE TRANSFERENCIA SPEI', 14 + LOGO_W + 5, 13);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Pagos Electrónicos Interbancarios', 14 + LOGO_W + 5, 19);

  doc.text(`Fecha: ${fechaHora}`, W - 14, 9, { align: 'right' });
  doc.text(`No. Solicitud: ${datos.noSol || '—'}`, W - 14, 15, { align: 'right' });
  doc.text(`Ref: ${referencia}`, W - 14, 21, { align: 'right' });

  y = HEADER_H + 10;

  // ── Banda de operación exitosa ──
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(...SPEI_GREEN);
  doc.roundedRect(14, y, W - 28, 16, 2, 2, 'FD');
  doc.setTextColor(...SPEI_GREEN);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TRANSFERENCIA EXITOSA', 20, y + 7);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('La operación fue liquidada y acreditada al beneficiario.', 20, y + 12.5);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${money(monto)} MXN`, W - 20, y + 10, { align: 'right' });
  y += 24;

  // ── Datos de la operación ──
  doc.setFillColor(...SPEI_LIGHT);
  doc.setDrawColor(...SPEI_BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...SPEI_PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DE LA OPERACIÓN', 17, y + 5);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: SPEI_PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 2: { fontStyle: 'bold', cellWidth: 40 } },
    head: [['Campo', 'Valor', 'Campo', 'Valor']],
    body: [
      ['Clave de rastreo', claveRastreo, 'Referencia numérica', referencia],
      ['Fecha de operación', ahora.toLocaleDateString('es-MX'), 'Hora', ahora.toLocaleTimeString('es-MX')],
      ['Tipo de pago', 'Transferencia SPEI (Tercero a Tercero)', 'Divisa', 'MXN'],
      ['Estado', 'Liquidada', 'Medio de entrega', 'Electrónico'],
    ],
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── Ordenante / Beneficiario ──
  doc.setFillColor(...SPEI_LIGHT);
  doc.setDrawColor(...SPEI_BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...SPEI_PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDENANTE Y BENEFICIARIO', 17, y + 5);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: SPEI_PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    head: [['', 'Ordenante', 'Beneficiario']],
    body: [
      ['Nombre / Razón Social', 'Institución Financiera (Tesorería)', datos.proveedor || '—'],
      ['Institución bancaria', 'Banco Emisor', datos.bancoProveedor || '—'],
      ['Cuenta CLABE', enmascararClabe('012180001234567890'), enmascararClabe(datos.clabeProveedor || '')],
    ],
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── Concepto ──
  doc.setFillColor(...SPEI_LIGHT);
  doc.setDrawColor(...SPEI_BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...SPEI_PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CONCEPTO DE PAGO', 17, y + 5);
  y += 11;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const concepto =
    `Dispersión de recursos por adquisición del bien objeto del contrato de ` +
    `${datos.productoNombre || datos.tipoProducto || 'arrendamiento'} correspondiente a la solicitud ` +
    `${datos.noSol || '—'} a nombre de ${datos.cliente || '—'}. Pago liberado por Tesorería previa ` +
    `autorización en la Fila de Pagos.`;
  const lineasConcepto = doc.splitTextToSize(concepto, W - 28);
  doc.text(lineasConcepto, 14, y);
  y += lineasConcepto.length * 4 + 8;

  // ── Aviso ──
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  const aviso = doc.splitTextToSize(
    'Comprobante simulado generado automáticamente por el sistema para efectos de flujo interno de ' +
    'liberación y dispersión. No constituye un comprobante emitido por el Sistema de Pagos Electrónicos ' +
    'Interbancarios (SPEI) de Banco de México ni sustituye el estado de cuenta de la institución.',
    W - 28
  );
  doc.text(aviso, 14, y);

  return doc.output('datauristring');
}

/**
 * Crea el Comprobante de Transferencia SPEI en el Expediente Electrónico.
 *
 * Mismo contrato que autoCrearReporteBuro: no duplica si ya existe, sube a
 * Storage cuando hay cliente Supabase y persiste en BD de inmediato sin
 * depender del auto-guardado del formulario.
 */
export async function autoCrearComprobanteSPEI(opts: AutoCrearOpts): Promise<AutoCrearResult> {
  const { storageId, datos, supabase, projectId: pid } = opts;
  const fecha = new Date().toLocaleString('es-MX');
  const sinPlantillas: ValidacionPlantillasResult = {
    valido: true, motivos: [], faltantes: [], plantillasDetectadas: [], puedeGenerarDocumentos: true,
  };

  const docsPrevios: DocumentoCargado[] =
    loadFromSession<DocumentoCargado[]>(storageId, 'documentos') ??
    loadFromSavedStore<DocumentoCargado[]>(storageId, 'documentos') ??
    [];

  const existe = docsPrevios.some(d =>
    d.tipoDocumento === CLAVE_COMPROBANTE_SPEI || (d as any).claveDocumento === CLAVE_COMPROBANTE_SPEI
  );

  if (existe) {
    return {
      exito: true,
      documentosCreados: [],
      pdfGenerados: [],
      subidosASupabase: false,
      registradosEnExpediente: true,
      validacionPlantillas: sinPlantillas,
    };
  }

  const fileData = generarComprobanteSPEIPDF(datos);
  const nombreArchivo = 'comprobante_transferencia_spei.pdf';
  let uploadInfo: UploadResult | null = null;
  let subidosASupabase = false;

  if (supabase && pid) {
    uploadInfo = await uploadGeneratedPDF(supabase, fileData, nombreArchivo, String(storageId), pid);
    if (uploadInfo) subidosASupabase = true;
  }

  const nuevo: DocumentoCargado = {
    id: generateId(),
    fecha,
    usuario: 'Sistema',
    tipoDocumento: CLAVE_COMPROBANTE_SPEI,
    archivo: nombreArchivo,
    tipoArchivo: 'pdf',
    nota: 'Comprobante de dispersión al proveedor generado automáticamente (simulado). Pendiente de Validación IA.',
    // area/fase deben coincidir con el requisito DOC-SPEI del producto.
    area: 'Tesorería',
    fase: 'Liberación y Dispersión',
    faseId: 6,
    estatus: 'Pendiente Validación IA',
    validadoIA: false,
    fileData,
    url: uploadInfo?.url,
    storagePath: uploadInfo?.storagePath,
    mime: 'application/pdf',
    tamanoKB: uploadInfo?.tamanoKB || Math.round((fileData.length * 3) / 4 / 1024) || 1,
  } as DocumentoCargado & { storagePath?: string };

  const docsActualizados = [...docsPrevios, nuevo];
  saveToSession(storageId, 'documentos', docsActualizados);

  const persist = await persistirDocumentosEnBD(storageId, docsActualizados);

  console.log(
    `[autoCrearComprobanteSPEI] Comprobante SPEI creado para solicitud ${storageId} | Storage: ${subidosASupabase ? 'OK' : 'local'} | BD: ${persist.ok ? 'OK' : `FALLO (${persist.error})`}`
  );

  return {
    exito: true,
    documentosCreados: [CLAVE_COMPROBANTE_SPEI],
    pdfGenerados: [nombreArchivo],
    subidosASupabase,
    registradosEnExpediente: persist.ok,
    error: persist.ok ? undefined : `Documento generado pero NO persistido en BD: ${persist.error}`,
    validacionPlantillas: sinPlantillas,
    documentoCreadoId: nuevo.id,
    fileData,
    documentosGenerados: [{ tipo: CLAVE_COMPROBANTE_SPEI, archivo: nombreArchivo, fileData }],
  };
}
