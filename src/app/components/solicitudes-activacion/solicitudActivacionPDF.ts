/**
 * solicitudActivacionPDF.ts
 *
 * Generates an invoice-like PDF for a Solicitud de Activación.
 * Uses jsPDF + jspdf-autotable (already installed).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SolicitudActivacionFormData } from './solicitudActivacionStore';
import { formatCurrency, parseCurrency } from './solicitudActivacionStore';
import logoSrc from '../../../assets/7b6cb23c00b7817818c638af3eae0a416e1e9f57.png';

const PRIMARY = [30, 64, 120] as [number, number, number];   // dark blue
const LIGHT   = [245, 247, 250] as [number, number, number]; // section bg
const BORDER  = [200, 208, 220] as [number, number, number];

function pctFmt(n: number): string {
  return `${(n * 100).toFixed(2)} %`;
}

export function descargarDetallePDF(form: SolicitudActivacionFormData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();
  let   y   = 15;

  // ── Header bar ──────────────────────────────────────────────────────────────
  const HEADER_H = 28;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, HEADER_H, 'F');

  // Logo — white card behind it for contrast, then the image on top
  const LOGO_W  = 30;
  const LOGO_H  = 20; // 30 * (1024/1536)
  const LOGO_Y  = (HEADER_H - LOGO_H) / 2;
  const PAD     = 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14 - PAD, LOGO_Y - PAD, LOGO_W + PAD * 2, LOGO_H + PAD * 2, 2, 2, 'F');
  doc.addImage(logoSrc as string, 'PNG', 14, LOGO_Y, LOGO_W, LOGO_H);

  // Title — to the right of the logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SOLICITUD DE ACTIVACIÓN', 14 + LOGO_W + 5, 13);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`ID: ${form.id || '—'}`, W - 14, 9,  { align: 'right' });
  doc.text(`Fecha: ${form.fechaSolicitud || '—'}`, W - 14, 15, { align: 'right' });
  doc.text(`Estatus: ${form.estatus || 'Pendiente'}`, W - 14, 21, { align: 'right' });

  y = HEADER_H + 8;

  // ── DATOS GENERALES ──────────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS GENERALES', 17, y + 5);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    styles:      { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles:  { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    head: [['Campo', 'Valor', 'Campo', 'Valor']],
    body: [
      ['ID Solicitud',    form.solicitudId      || '—', 'Fecha Solicitud',   form.fechaSolicitud   || '—'],
      ['Tipo',            form.type             || '—', 'Fecha Compromiso',  form.fechaCompromiso  || '—'],
      ['Cliente',         form.cliente          || '—', 'N° Documento',      form.numeroDocumento  || '—'],
      ['Cuenta Bancaria', form.cuentaBancaria   || '—', 'Estatus',           form.estatus          || 'Pendiente'],
    ],
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── INFORMACIÓN DE PAGO ──────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DE PAGO', 17, y + 5);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    styles:      { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles:  { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    head: [['Campo', 'Valor', 'Campo', 'Valor']],
    body: [
      ['Forma de Pago',          form.formaDePago           || '—', 'Institución Financiera', form.institucionFinanciera || '—'],
      ['Referencia',             form.referencia            || '—', 'Monto Transacción',       formatCurrency(parseCurrency(form.montoTransaccion))],
      ['Moneda',                 form.moneda                || '—', '', ''],
    ],
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── DETALLE ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLE DE SOLICITUD', 17, y + 5);
  y += 10;

  const monto     = form.detailMonto      ?? 0;
  const pct       = form.detailPctImpuesto ?? 0;
  const cantidad  = form.detailCantidad   ?? 1;
  const subTotal  = cantidad * monto * (1 + pct);

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    styles:      { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles:  { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { halign: 'right', cellWidth: 22 },
      2: { halign: 'right' },
      3: { halign: 'right', cellWidth: 28 },
      4: { cellWidth: 18 },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 22 },
    },
    head: [['CLAVE PRODUCTO', 'CANTIDAD', 'MONTO', '% IMPUESTO', 'MONEDA', 'SUB TOTAL', 'ESTATUS']],
    body: [[
      form.detailClaveProducto || '—',
      cantidad.toLocaleString('es-MX'),
      formatCurrency(monto),
      pctFmt(pct),
      form.detailMoneda || 'MXN',
      formatCurrency(subTotal),
      'Pendiente',
    ]],
    foot: [[
      { content: 'TOTAL GENERAL:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: 8 } },
      { content: formatCurrency(subTotal), styles: { halign: 'right', fontStyle: 'bold', fontSize: 8 } },
      '',
    ]],
    footStyles: { fillColor: [235, 238, 245], textColor: [30, 30, 30] },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── NOTA ─────────────────────────────────────────────────────────────────────
  if (form.nota) {
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(...BORDER);
    doc.rect(14, y, W - 28, 7, 'FD');
    doc.setTextColor(...PRIMARY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTA', 17, y + 5);
    y += 10;

    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(form.nota, W - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;

    if (form.usuarioNota) {
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(7);
      doc.text(`— ${form.usuarioNota}`, W - 14, y, { align: 'right' });
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...BORDER);
  doc.line(14, pageH - 12, W - 14, pageH - 12);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Documento generado automáticamente — Sistema Core Banking', 14, pageH - 7);
  doc.text(`${new Date().toLocaleString('es-MX')}`, W - 14, pageH - 7, { align: 'right' });

  // ── Save ─────────────────────────────────────────────────────────────────────
  const filename = `solicitud_activacion_${form.id || 'nuevo'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
