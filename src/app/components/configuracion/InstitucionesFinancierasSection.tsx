import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Landmark,
  Menu,
  Plus,
  Search,
  Trash2,
  Save,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  FileDown,
  Printer,
  X,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface InstitucionFinanciera {
  id: number;
  nombre: string;
  ubicacion: string;
  tipoInstitucion: string;
  institucionPrincipalId: number | null;
  jerarquiaCompanias: string;
  periodoRevision1: string;
  periodoRevision2: string;
  periodoRevision3: string;
  periodoRevision4: string;
  institucionNumero: string;
  direccion: string;
  codigoPostal: string;
  ciudad: string;
  region: string;
  pais: string;
  telefono: string;
  fax: string;
  moneda: string;
  indicadorSocio: boolean;
  ivaPorcentaje: string;
}

interface TreeNode {
  institucion: InstitucionFinanciera;
  children: TreeNode[];
}

// ═══════════════════════════════════════════════════════════════════
// DATOS MOCK
// ═══════════════════════════════════════════════════════════════════
const INSTITUCIONES_DATA: InstitucionFinanciera[] = [
  {
    id: 1,
    nombre: 'MASTER FINANCIAL MANAGEMENT SAPI - OK',
    ubicacion: 'CDMX Centro',
    tipoInstitucion: 'Holding',
    institucionPrincipalId: null,
    jerarquiaCompanias: 'Nivel 1 — Corporativo',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-001',
    direccion: 'Av. Paseo de la Reforma 505, Col. Cuauhtémoc',
    codigoPostal: '06500',
    ciudad: 'Ciudad de México',
    region: 'Centro',
    pais: 'México',
    telefono: '(55) 5123-4567',
    fax: '(55) 5123-4568',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 2,
    nombre: 'DISTRITO FEDERAL',
    ubicacion: 'CDMX Sur',
    tipoInstitucion: 'Sucursal Regional',
    institucionPrincipalId: 1,
    jerarquiaCompanias: 'Nivel 2 — Regional',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-002',
    direccion: 'Av. Insurgentes Sur 1602, Col. Crédito Constructor',
    codigoPostal: '03940',
    ciudad: 'Ciudad de México',
    region: 'Centro',
    pais: 'México',
    telefono: '(55) 5234-5678',
    fax: '(55) 5234-5679',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 3,
    nombre: 'GUADALAJARA',
    ubicacion: 'GDL Providencia',
    tipoInstitucion: 'Sucursal Regional',
    institucionPrincipalId: 1,
    jerarquiaCompanias: 'Nivel 2 — Regional',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-003',
    direccion: 'Av. Providencia 2578, Col. Providencia',
    codigoPostal: '44630',
    ciudad: 'Guadalajara',
    region: 'Occidente',
    pais: 'México',
    telefono: '(33) 3345-6789',
    fax: '(33) 3345-6790',
    moneda: 'MXN',
    indicadorSocio: true,
    ivaPorcentaje: '16',
  },
  {
    id: 4,
    nombre: 'MONTERREY',
    ubicacion: 'MTY San Pedro',
    tipoInstitucion: 'Sucursal Regional',
    institucionPrincipalId: 1,
    jerarquiaCompanias: 'Nivel 2 — Regional',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-004',
    direccion: 'Av. Vasconcelos 345, Col. Del Valle',
    codigoPostal: '66220',
    ciudad: 'Monterrey',
    region: 'Norte',
    pais: 'México',
    telefono: '(81) 8234-5678',
    fax: '(81) 8234-5679',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 5,
    nombre: 'PROMOTORIA-MTY-01',
    ubicacion: 'MTY Centro',
    tipoInstitucion: 'Promotoría',
    institucionPrincipalId: 4,
    jerarquiaCompanias: 'Nivel 3 — Promotoría',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-005',
    direccion: 'Calle Morelos 402, Col. Centro',
    codigoPostal: '64000',
    ciudad: 'Monterrey',
    region: 'Norte',
    pais: 'México',
    telefono: '(81) 8345-1234',
    fax: '(81) 8345-1235',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 6,
    nombre: 'PROMOTORIA-MTY-03',
    ubicacion: 'MTY Cumbres',
    tipoInstitucion: 'Promotoría',
    institucionPrincipalId: 4,
    jerarquiaCompanias: 'Nivel 3 — Promotoría',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-006',
    direccion: 'Blvd. Cumbres 890, Col. Cumbres',
    codigoPostal: '64610',
    ciudad: 'Monterrey',
    region: 'Norte',
    pais: 'México',
    telefono: '(81) 8456-2345',
    fax: '(81) 8456-2346',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 7,
    nombre: 'QUERETARO',
    ubicacion: 'QRO Centro',
    tipoInstitucion: 'Sucursal Regional',
    institucionPrincipalId: 1,
    jerarquiaCompanias: 'Nivel 2 — Regional',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-007',
    direccion: 'Blvd. Bernardo Quintana 300, Col. Arboledas',
    codigoPostal: '76140',
    ciudad: 'Querétaro',
    region: 'Centro',
    pais: 'México',
    telefono: '(442) 678-9012',
    fax: '(442) 678-9013',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 8,
    nombre: 'SUCURSAL QUERETARO',
    ubicacion: 'QRO Juriquilla',
    tipoInstitucion: 'Sucursal',
    institucionPrincipalId: 7,
    jerarquiaCompanias: 'Nivel 3 — Sucursal',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-008',
    direccion: 'Blvd. Juriquilla 3500, Col. Juriquilla',
    codigoPostal: '76226',
    ciudad: 'Querétaro',
    region: 'Centro',
    pais: 'México',
    telefono: '(442) 789-0123',
    fax: '(442) 789-0124',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 9,
    nombre: 'SUCURSAL QUERETARO MFM',
    ubicacion: 'QRO Centro',
    tipoInstitucion: 'Sucursal',
    institucionPrincipalId: 7,
    jerarquiaCompanias: 'Nivel 3 — Sucursal',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-009',
    direccion: 'Av. Constituyentes 120, Col. El Marqués',
    codigoPostal: '76047',
    ciudad: 'Querétaro',
    region: 'Centro',
    pais: 'México',
    telefono: '(442) 890-1234',
    fax: '(442) 890-1235',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 10,
    nombre: 'AGUASCALIENTES',
    ubicacion: 'AGS Centro',
    tipoInstitucion: 'Sucursal Regional',
    institucionPrincipalId: 1,
    jerarquiaCompanias: 'Nivel 2 — Regional',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-010',
    direccion: 'Av. Aguascalientes 802, Zona Centro',
    codigoPostal: '20000',
    ciudad: 'Aguascalientes',
    region: 'Centro',
    pais: 'México',
    telefono: '(449) 912-3456',
    fax: '(449) 912-3457',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 11,
    nombre: 'CREDIPYME',
    ubicacion: 'CDMX Norte',
    tipoInstitucion: 'Subsidiaria',
    institucionPrincipalId: 1,
    jerarquiaCompanias: 'Nivel 2 — Subsidiaria',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-011',
    direccion: 'Calz. Vallejo 1020, Col. Nueva Industrial Vallejo',
    codigoPostal: '07700',
    ciudad: 'Ciudad de México',
    region: 'Centro',
    pais: 'México',
    telefono: '(55) 5567-8901',
    fax: '(55) 5567-8902',
    moneda: 'MXN',
    indicadorSocio: true,
    ivaPorcentaje: '16',
  },
  {
    id: 12,
    nombre: 'SUCURSAL LEON',
    ubicacion: 'León Centro',
    tipoInstitucion: 'Sucursal',
    institucionPrincipalId: 3,
    jerarquiaCompanias: 'Nivel 3 — Sucursal',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-012',
    direccion: 'Blvd. López Mateos 1502, Col. Jardines del Moral',
    codigoPostal: '37160',
    ciudad: 'León',
    region: 'Occidente',
    pais: 'México',
    telefono: '(477) 712-3456',
    fax: '(477) 712-3457',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 13,
    nombre: 'SUCURSAL MTY',
    ubicacion: 'MTY Garza García',
    tipoInstitucion: 'Sucursal',
    institucionPrincipalId: 4,
    jerarquiaCompanias: 'Nivel 3 — Sucursal',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-013',
    direccion: 'Av. Gómez Morín 955, Col. San Pedro Garza García',
    codigoPostal: '66254',
    ciudad: 'Monterrey',
    region: 'Norte',
    pais: 'México',
    telefono: '(81) 8567-3456',
    fax: '(81) 8567-3457',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 14,
    nombre: 'SUCURSAL MTY - MFM',
    ubicacion: 'MTY Santa Catarina',
    tipoInstitucion: 'Sucursal',
    institucionPrincipalId: 4,
    jerarquiaCompanias: 'Nivel 3 — Sucursal',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-014',
    direccion: 'Av. Manuel Ordóñez 120, Col. Santa Catarina',
    codigoPostal: '66368',
    ciudad: 'Monterrey',
    region: 'Norte',
    pais: 'México',
    telefono: '(81) 8678-4567',
    fax: '(81) 8678-4568',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 15,
    nombre: 'SUCURSAL SONORA',
    ubicacion: 'Hermosillo Centro',
    tipoInstitucion: 'Sucursal',
    institucionPrincipalId: 1,
    jerarquiaCompanias: 'Nivel 2 — Sucursal',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-015',
    direccion: 'Blvd. Rosales 85, Zona Centro',
    codigoPostal: '83000',
    ciudad: 'Hermosillo',
    region: 'Noroeste',
    pais: 'México',
    telefono: '(662) 212-5678',
    fax: '(662) 212-5679',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 16,
    nombre: 'SUCURSAL TLAXCALA',
    ubicacion: 'Tlaxcala Centro',
    tipoInstitucion: 'Sucursal',
    institucionPrincipalId: 1,
    jerarquiaCompanias: 'Nivel 2 — Sucursal',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-016',
    direccion: 'Av. Juárez 18, Zona Centro',
    codigoPostal: '90000',
    ciudad: 'Tlaxcala',
    region: 'Centro',
    pais: 'México',
    telefono: '(246) 462-6789',
    fax: '(246) 462-6790',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
  {
    id: 17,
    nombre: 'SUCURSAL VERACRUZ',
    ubicacion: 'Veracruz Puerto',
    tipoInstitucion: 'Sucursal',
    institucionPrincipalId: 1,
    jerarquiaCompanias: 'Nivel 2 — Sucursal',
    periodoRevision1: '2026-03-31',
    periodoRevision2: '2026-06-30',
    periodoRevision3: '2026-09-30',
    periodoRevision4: '2026-12-31',
    institucionNumero: 'IF-017',
    direccion: 'Blvd. Adolfo Ruiz Cortines 3495, Col. Costa Verde',
    codigoPostal: '94294',
    ciudad: 'Veracruz',
    region: 'Golfo',
    pais: 'México',
    telefono: '(229) 935-7890',
    fax: '(229) 935-7891',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  },
];

// ═══════════════════════════════════════════════════════════════════
// PERSISTENCIA sessionStorage
// ═══════════════════════════════════════════════════════════════════
const STORAGE_KEY_IF = 'config_instituciones_data';

function loadDataIF(): InstitucionFinanciera[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_IF);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return INSTITUCIONES_DATA;
}

function saveDataIF(data: InstitucionFinanciera[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY_IF, JSON.stringify(data));
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════
// OPCIONES REUTILIZABLES
// ═══════════════════════════════════════════════════════════════════
const TIPO_OPTIONS = [
  { value: 'Holding', label: 'Holding' },
  { value: 'Subsidiaria', label: 'Subsidiaria' },
  { value: 'Sucursal Regional', label: 'Sucursal Regional' },
  { value: 'Sucursal', label: 'Sucursal' },
  { value: 'Promotoría', label: 'Promotoría' },
];

const JERARQUIA_OPTIONS = [
  { value: 'Nivel 1 — Corporativo', label: 'Nivel 1 — Corporativo' },
  { value: 'Nivel 2 — Regional', label: 'Nivel 2 — Regional' },
  { value: 'Nivel 2 — Subsidiaria', label: 'Nivel 2 — Subsidiaria' },
  { value: 'Nivel 2 — Sucursal', label: 'Nivel 2 — Sucursal' },
  { value: 'Nivel 3 — Sucursal', label: 'Nivel 3 — Sucursal' },
  { value: 'Nivel 3 — Promotoría', label: 'Nivel 3 — Promotoría' },
];

const REGION_OPTIONS = [
  { value: 'Centro', label: 'Centro' },
  { value: 'Norte', label: 'Norte' },
  { value: 'Noroeste', label: 'Noroeste' },
  { value: 'Occidente', label: 'Occidente' },
  { value: 'Golfo', label: 'Golfo' },
  { value: 'Sur', label: 'Sur' },
  { value: 'Sureste', label: 'Sureste' },
];

const MONEDA_OPTIONS = [
  { value: 'MXN', label: 'MXN — Peso Mexicano' },
  { value: 'USD', label: 'USD — Dólar Americano' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const PAIS_OPTIONS = [
  { value: 'México', label: 'México' },
  { value: 'Estados Unidos', label: 'Estados Unidos' },
];

// ═══════════════════════════════════════════════════════════════════
// UTILIDADES ÁRBOL
// ═══════════════════════════════════════════════════════════════════
function buildTree(data: InstitucionFinanciera[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  data.forEach((inst) =>
    map.set(inst.id, { institucion: inst, children: [] })
  );

  data.forEach((inst) => {
    const node = map.get(inst.id)!;
    if (inst.institucionPrincipalId && map.has(inst.institucionPrincipalId)) {
      map.get(inst.institucionPrincipalId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function generateNextNumber(data: InstitucionFinanciera[]): string {
  const nums = data.map((d) => {
    const m = d.institucionNumero.match(/IF-(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const next = Math.max(0, ...nums) + 1;
  return `IF-${String(next).padStart(3, '0')}`;
}

function emptyInstitucion(): Omit<InstitucionFinanciera, 'id' | 'institucionNumero'> {
  return {
    nombre: '',
    ubicacion: '',
    tipoInstitucion: '',
    institucionPrincipalId: null,
    jerarquiaCompanias: '',
    periodoRevision1: '',
    periodoRevision2: '',
    periodoRevision3: '',
    periodoRevision4: '',
    direccion: '',
    codigoPostal: '',
    ciudad: '',
    region: '',
    pais: 'México',
    telefono: '',
    fax: '',
    moneda: 'MXN',
    indicadorSocio: false,
    ivaPorcentaje: '16',
  };
}

// ═══════════════════════════════════════════════════════════════════
// UTILIDADES EXPORTACIÓN
// ═══════════════════════════════════════════════════════════════════
function exportToExcel(data: InstitucionFinanciera[]) {
  const rows = data.map((d) => ({
    'Institución #': d.institucionNumero,
    'Nombre': d.nombre,
    'Ubicación': d.ubicacion,
    'Tipo': d.tipoInstitucion,
    'Dirección': d.direccion,
    'C.P.': d.codigoPostal,
    'Ciudad': d.ciudad,
    'Región': d.region,
    'País': d.pais,
    'Teléfono': d.telefono,
    'Fax': d.fax,
    'Moneda': d.moneda,
    'IVA %': d.ivaPorcentaje,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Instituciones');
  XLSX.writeFile(wb, 'instituciones_financieras.xlsx');
  toast.success('Exportado a Excel correctamente');
}

function exportToCSV(data: InstitucionFinanciera[]) {
  const rows = data.map((d) => ({
    'Institución #': d.institucionNumero,
    'Nombre': d.nombre,
    'Ubicación': d.ubicacion,
    'Tipo': d.tipoInstitucion,
    'Dirección': d.direccion,
    'C.P.': d.codigoPostal,
    'Ciudad': d.ciudad,
    'Región': d.region,
    'País': d.pais,
    'Teléfono': d.telefono,
    'Fax': d.fax,
    'Moneda': d.moneda,
    'IVA %': d.ivaPorcentaje,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'instituciones_financieras.csv';
  link.click();
  toast.success('Exportado a CSV correctamente');
}

function exportToPDF(data: InstitucionFinanciera[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text('Instituciones Financieras', 14, 18);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 14, 24);

  autoTable(doc, {
    startY: 30,
    head: [['#', 'Nombre', 'Tipo', 'Ubicación', 'Ciudad', 'Región', 'Teléfono', 'Moneda']],
    body: data.map((d) => [
      d.institucionNumero,
      d.nombre,
      d.tipoInstitucion,
      d.ubicacion,
      d.ciudad,
      d.region,
      d.telefono,
      d.moneda,
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [74, 111, 165], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save('instituciones_financieras.pdf');
  toast.success('Exportado a PDF correctamente');
}

function handlePrint(data: InstitucionFinanciera[]) {
  const html = `
    <html><head><title>Instituciones Financieras</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
      h2 { color: #4A6FA5; margin-bottom: 4px; }
      table { border-collapse: collapse; width: 100%; }
      th { background: #4A6FA5; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
      td { padding: 4px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
      tr:nth-child(even) { background: #f5f5f5; }
      .date { color: #888; font-size: 9px; margin-bottom: 12px; }
    </style></head><body>
    <h2>Instituciones Financieras</h2>
    <div class="date">Generado: ${new Date().toLocaleDateString('es-MX')}</div>
    <table>
      <tr><th>#</th><th>Nombre</th><th>Tipo</th><th>Ubicación</th><th>Ciudad</th><th>Región</th><th>Teléfono</th><th>Moneda</th></tr>
      ${data.map((d) => `<tr><td>${d.institucionNumero}</td><td>${d.nombre}</td><td>${d.tipoInstitucion}</td><td>${d.ubicacion}</td><td>${d.ciudad}</td><td>${d.region}</td><td>${d.telefono}</td><td>${d.moneda}</td></tr>`).join('')}
    </table></body></html>`;
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.print();
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: NODO DEL ÁRBOL
// ═══════════════════════════════════════════════════════════════════
function TreeNodeItem({
  node,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}: {
  node: TreeNode;
  level: number;
  selectedId: number | null;
  expandedIds: Set<number>;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.institucion.id);
  const isSelected = selectedId === node.institucion.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-1 cursor-pointer rounded transition-colors text-xs ${
          isSelected
            ? 'bg-primary-theme text-white'
            : 'hover:bg-primary-theme-10 text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onClick={() => {
          onSelect(node.institucion.id);
          if (hasChildren) onToggle(node.institucion.id);
        }}
      >
        {hasChildren ? (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </span>
        ) : (
          <span className="flex-shrink-0 w-4 h-4" />
        )}
        <Landmark
          size={12}
          className={`flex-shrink-0 ${isSelected ? 'text-white' : 'text-primary-theme'}`}
        />
        <span className="truncate">{node.institucion.nombre}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.institucion.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: CAMPO DE FORMULARIO (editable)
// ═══════════════════════════════════════════════════════════════════
const FormFieldIF = React.memo(function FormFieldIF({
  label,
  value,
  name,
  required,
  type = 'text',
  inputType,
  options,
  checked,
  readOnly,
  onChange,
  onCheck,
}: {
  label: string;
  value?: string;
  name?: string;
  required?: boolean;
  type?: 'text' | 'select' | 'checkbox' | 'date';
  inputType?: string;
  options?: { value: string; label: string }[];
  checked?: boolean;
  readOnly?: boolean;
  onChange?: (name: string, value: string) => void;
  onCheck?: (name: string, checked: boolean) => void;
}) {
  const isEditable = !!onChange && !readOnly;
  const isCheckEditable = !!onCheck && !readOnly;

  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-gray-600 w-[155px] flex-shrink-0 text-right">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {':'}
      </label>
      {type === 'checkbox' ? (
        <input
          type="checkbox"
          checked={checked}
          readOnly={!isCheckEditable}
          onChange={isCheckEditable ? (e) => onCheck!(name!, e.target.checked) : undefined}
          className="h-3.5 w-3.5 accent-primary-theme"
        />
      ) : type === 'select' ? (
        <select
          value={value}
          disabled={!isEditable}
          onChange={isEditable ? (e) => onChange!(name!, e.target.value) : undefined}
          className={`flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 ${
            isEditable
              ? 'focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none'
              : 'disabled:bg-gray-50'
          }`}
        >
          <option value="">-- Seleccionar --</option>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === 'date' ? (
        <input
          type="date"
          value={value ?? ''}
          readOnly={!isEditable}
          onChange={isEditable ? (e) => onChange!(name!, e.target.value) : undefined}
          className={`flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 ${
            isEditable
              ? 'focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none'
              : 'read-only:bg-gray-50'
          }`}
        />
      ) : (
        <input
          type={inputType ?? 'text'}
          value={value ?? ''}
          readOnly={!isEditable}
          onChange={isEditable ? (e) => onChange!(name!, e.target.value) : undefined}
          className={`flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 ${
            isEditable
              ? 'focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none'
              : 'read-only:bg-gray-50'
          }`}
        />
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: MENÚ DROPDOWN (Exportar)
// ═══════════════════════════════════════════════════════════════════
function ExportMenu({ data, onClose }: { data: InstitucionFinanciera[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const items = [
    { icon: <FileSpreadsheet size={12} className="text-green-600" />, label: 'Exportar a Excel', action: () => { exportToExcel(data); onClose(); } },
    { icon: <FileText size={12} className="text-blue-600" />, label: 'Exportar a CSV', action: () => { exportToCSV(data); onClose(); } },
    { icon: <FileDown size={12} className="text-red-600" />, label: 'Exportar a PDF', action: () => { exportToPDF(data); onClose(); } },
    { icon: <Printer size={12} className="text-gray-600" />, label: 'Imprimir', action: () => { handlePrint(data); onClose(); } },
  ];

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 py-1 min-w-[180px]"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-primary-theme-10 transition-colors text-left"
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: MODAL CONFIRMACIÓN DE ELIMINACIÓN
// ═══════════════════════════════════════════════════════════════════
function DeleteConfirmModal({
  inst,
  childCount,
  onConfirm,
  onCancel,
}: {
  inst: InstitucionFinanciera;
  childCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-[420px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white">
          <AlertTriangle size={16} />
          <span className="text-sm" style={{ fontWeight: 600 }}>Confirmar eliminación</span>
        </div>
        <div className="p-5">
          <p className="text-xs text-gray-700 mb-2">
            ¿Está seguro de eliminar la institución financiera?
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-3">
            <p className="text-[11px] text-gray-800" style={{ fontWeight: 600 }}>{inst.nombre}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{inst.institucionNumero} &bull; {inst.tipoInstitucion}</p>
          </div>
          {childCount > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-2.5 mb-3">
              <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800">
                Esta institución tiene <span style={{ fontWeight: 600 }}>{childCount} institución(es) hija(s)</span> que también serán eliminadas.
              </p>
            </div>
          )}
          <p className="text-[10px] text-gray-500">Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-[11px] border border-gray-400 rounded bg-white hover:bg-gray-100 text-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-[11px] bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            style={{ fontWeight: 500 }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: MODAL CREAR INSTITUCIÓN
// ═══════════════════════════════════════════════════════════════════
function CreateModal({
  nextNumber,
  institucionOptions,
  onSave,
  onCancel,
}: {
  nextNumber: string;
  institucionOptions: { value: string; label: string }[];
  onSave: (inst: Omit<InstitucionFinanciera, 'id'>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<InstitucionFinanciera, 'id'>>({
    ...emptyInstitucion(),
    institucionNumero: nextNumber,
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const handleChange = useCallback((name: string, value: string) => {
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: false }));
  }, []);

  const handleCheck = useCallback((name: string, checked: boolean) => {
    setForm((p) => ({ ...p, [name]: checked }));
  }, []);

  const handleSave = () => {
    const required: (keyof typeof form)[] = ['nombre', 'tipoInstitucion', 'codigoPostal', 'ciudad', 'moneda'];
    const newErrors: Record<string, boolean> = {};
    required.forEach((f) => {
      if (!form[f]) newErrors[f] = true;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Complete los campos obligatorios marcados con *');
      return;
    }
    onSave(form);
  };

  const fld = (label: string, name: keyof typeof form, opts?: {
    required?: boolean;
    type?: 'text' | 'select' | 'date' | 'checkbox';
    options?: { value: string; label: string }[];
  }) => {
    const o = opts ?? {};
    return (
      <div className="flex items-center gap-2">
        <label className={`text-[11px] w-[155px] flex-shrink-0 text-right ${errors[name] ? 'text-red-600' : 'text-gray-600'}`}>
          {label}
          {o.required && <span className="text-red-500 ml-0.5">*</span>}
          {':'}
        </label>
        {o.type === 'checkbox' ? (
          <input
            type="checkbox"
            checked={form[name] as unknown as boolean}
            onChange={(e) => handleCheck(name, e.target.checked)}
            className="h-3.5 w-3.5 accent-primary-theme"
          />
        ) : o.type === 'select' ? (
          <select
            value={String(form[name] ?? '')}
            onChange={(e) => handleChange(name, e.target.value)}
            className={`flex-1 text-[11px] px-1.5 py-1 border rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none ${
              errors[name] ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
            }`}
          >
            <option value="">-- Seleccionar --</option>
            {o.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : o.type === 'date' ? (
          <input
            type="date"
            value={String(form[name] ?? '')}
            onChange={(e) => handleChange(name, e.target.value)}
            className={`flex-1 text-[11px] px-1.5 py-1 border rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none ${
              errors[name] ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
            }`}
          />
        ) : (
          <input
            type="text"
            value={String(form[name] ?? '')}
            onChange={(e) => handleChange(name, e.target.value)}
            className={`flex-1 text-[11px] px-1.5 py-1 border rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none ${
              errors[name] ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
            }`}
          />
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-2xl flex flex-col"
        style={{ width: '780px', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-primary-theme rounded-t-lg">
          <div className="flex items-center gap-2">
            <Plus size={15} className="text-white" />
            <span className="text-white text-sm" style={{ fontWeight: 600 }}>
              Nueva Institución Financiera
            </span>
            <span className="text-white/60 text-xs ml-2">{nextNumber}</span>
          </div>
          <button onClick={onCancel} className="text-white/80 hover:text-white p-0.5 rounded hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
            {/* Sección: Datos principales */}
            <div className="col-span-2 mb-1">
              <div className="bg-primary-theme-10 border-l-4 border-primary-theme px-3 py-1.5 rounded-r inline-block">
                <span className="text-[11px] text-primary-theme" style={{ fontWeight: 600 }}>Datos principales</span>
              </div>
            </div>

            {fld('Nombre de la inst. fin.', 'nombre', { required: true })}
            {fld('Ubicación', 'ubicacion')}
            {fld('Tipo de inst. financiera', 'tipoInstitucion', { required: true, type: 'select', options: TIPO_OPTIONS })}
            {fld('Institución #', 'institucionNumero')}
            {fld('Inst. financiera princ.', 'institucionPrincipalId' as any, {
              type: 'select',
              options: institucionOptions,
            })}
            {fld('Dirección', 'direccion')}
            {fld('Jerarquía de compañías', 'jerarquiaCompanias', { type: 'select', options: JERARQUIA_OPTIONS })}
            {fld('Código postal', 'codigoPostal', { required: true })}

            {/* Sección: Períodos de revisión */}
            <div className="col-span-2 mt-2 mb-1">
              <div className="bg-primary-theme-10 border-l-4 border-primary-theme px-3 py-1.5 rounded-r inline-block">
                <span className="text-[11px] text-primary-theme" style={{ fontWeight: 600 }}>Períodos de revisión</span>
              </div>
            </div>

            {fld('Período 1', 'periodoRevision1', { type: 'date' })}
            {fld('Ciudad', 'ciudad', { required: true })}
            {fld('Período 2', 'periodoRevision2', { type: 'date' })}
            {fld('Región', 'region', { type: 'select', options: REGION_OPTIONS })}
            {fld('Período 3', 'periodoRevision3', { type: 'date' })}
            {fld('País', 'pais', { type: 'select', options: PAIS_OPTIONS })}
            {fld('Período 4', 'periodoRevision4', { type: 'date' })}
            {fld('Teléfono', 'telefono')}

            {/* Sección: Datos complementarios */}
            <div className="col-span-2 mt-2 mb-1">
              <div className="bg-primary-theme-10 border-l-4 border-primary-theme px-3 py-1.5 rounded-r inline-block">
                <span className="text-[11px] text-primary-theme" style={{ fontWeight: 600 }}>Datos complementarios</span>
              </div>
            </div>

            {fld('Moneda', 'moneda', { required: true, type: 'select', options: MONEDA_OPTIONS })}
            {fld('Fax', 'fax')}
            {fld('Indicador de socio', 'indicadorSocio', { type: 'checkbox' })}
            {fld('IVA %', 'ivaPorcentaje')}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] border border-gray-400 rounded bg-white hover:bg-gray-100 text-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-[#0099CC] text-white rounded hover:bg-[#0088BB] transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Save size={12} />
            Crear institución
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function InstitucionesFinancierasSection() {
  const [data, setData] = useState<InstitucionFinanciera[]>(loadDataIF);
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const d = loadDataIF();
    return d.length > 0 ? d[0].id : null;
  });
  const [formData, setFormData] = useState<InstitucionFinanciera | null>(() => {
    const d = loadDataIF();
    return d.length > 0 ? { ...d[0] } : null;
  });

  // Persist on data changes
  useEffect(() => { saveDataIF(data); }, [data]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(
    new Set([1, 4, 7])
  );

  // UI states
  const [showMenuTop, setShowMenuTop] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InstitucionFinanciera | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const tree = useMemo(() => buildTree(data), [data]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(
      (i) =>
        i.nombre.toLowerCase().includes(q) ||
        i.ubicacion.toLowerCase().includes(q) ||
        i.institucionNumero.toLowerCase().includes(q) ||
        i.ciudad.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  const handleToggle = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (id: number) => {
      setSelectedId(id);
      const inst = data.find((i) => i.id === id);
      if (inst) setFormData({ ...inst });
    },
    [data]
  );

  const handleFieldChange = useCallback((name: string, value: string) => {
    setFormData((prev) => {
      if (!prev) return prev;
      if (name === 'institucionPrincipalId') {
        return { ...prev, institucionPrincipalId: value ? parseInt(value, 10) : null };
      }
      return { ...prev, [name]: value };
    });
  }, []);

  const handleCheckChange = useCallback((name: string, checked: boolean) => {
    setFormData((prev) => (prev ? { ...prev, [name]: checked } : prev));
  }, []);

  const handleSaveForm = useCallback(() => {
    if (!formData) return;
    setData((prev) =>
      prev.map((i) => (i.id === formData.id ? { ...formData } : i))
    );
    toast.success('Cambios guardados', {
      description: `Institución "${formData.nombre}" actualizada correctamente.`,
    });
  }, [formData]);

  const handleResetForm = useCallback(() => {
    if (!selectedId) return;
    const orig = data.find((i) => i.id === selectedId);
    if (orig) {
      setFormData({ ...orig });
      toast.info('Cambios descartados', {
        description: 'Los campos han sido restaurados a sus valores originales.',
      });
    }
  }, [data, selectedId]);

  // Crear nueva institución
  const handleCreate = useCallback(
    (inst: Omit<InstitucionFinanciera, 'id'>) => {
      const newId = Math.max(0, ...data.map((d) => d.id)) + 1;
      const newInst: InstitucionFinanciera = {
        ...inst,
        id: newId,
        institucionPrincipalId:
          (inst as any).institucionPrincipalId
            ? parseInt(String((inst as any).institucionPrincipalId), 10)
            : null,
      };
      setData((prev) => [...prev, newInst]);
      setSelectedId(newId);
      setFormData({ ...newInst });
      // Expand parent if exists
      if (newInst.institucionPrincipalId) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.add(newInst.institucionPrincipalId!);
          return next;
        });
      }
      setShowCreateModal(false);
      toast.success('Institución creada', {
        description: `${newInst.nombre} (${newInst.institucionNumero}) agregada exitosamente.`,
      });
    },
    [data]
  );

  // Eliminar institución
  const getDescendantCount = useCallback(
    (id: number): number => {
      const children = data.filter((d) => d.institucionPrincipalId === id);
      return children.reduce((acc, c) => acc + 1 + getDescendantCount(c.id), 0);
    },
    [data]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    // Collect all descendant IDs
    const toRemove = new Set<number>();
    const collectIds = (id: number) => {
      toRemove.add(id);
      data
        .filter((d) => d.institucionPrincipalId === id)
        .forEach((d) => collectIds(d.id));
    };
    collectIds(deleteTarget.id);

    setData((prev) => prev.filter((d) => !toRemove.has(d.id)));

    // Select next available
    const remaining = data.filter((d) => !toRemove.has(d.id));
    if (remaining.length > 0) {
      setSelectedId(remaining[0].id);
      setFormData({ ...remaining[0] });
    } else {
      setSelectedId(null);
      setFormData(null);
    }

    setDeleteTarget(null);
    toast.success('Institución eliminada', {
      description: `"${deleteTarget.nombre}" y ${toRemove.size - 1 > 0 ? toRemove.size - 1 + ' dependencia(s)' : 'sin dependencias'} eliminada(s).`,
    });
  }, [deleteTarget, data]);

  const institucionOptions = useMemo(
    () => data.map((inst) => ({ value: String(inst.id), label: inst.nombre })),
    [data]
  );

  const nextNumber = useMemo(() => generateNextNumber(data), [data]);

  return (
    <div className="flex h-[calc(100vh-160px)] bg-gray-100">
      {/* ═══════ MODALES ═══════ */}
      {showCreateModal && (
        <CreateModal
          nextNumber={nextNumber}
          institucionOptions={institucionOptions}
          onSave={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          inst={deleteTarget}
          childCount={getDescendantCount(deleteTarget.id)}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ═══════ PANEL IZQUIERDO: ÁRBOL ═══════ */}
      <div className="w-[260px] flex-shrink-0 border-r border-gray-300 bg-white flex flex-col">
        <div className="px-3 py-2 bg-primary-theme-10 border-b border-gray-300 flex items-center gap-2">
          <Landmark size={14} className="text-primary-theme" />
          <span
            className="text-xs text-primary-theme"
            style={{ fontWeight: 600 }}
          >
            Instituciones Financieras
          </span>
          <span className="text-[9px] text-primary-theme-60 ml-auto">{data.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {tree.map((node) => (
            <TreeNodeItem
              key={node.institucion.id}
              node={node}
              level={0}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={handleSelect}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>

      {/* ═══════ PANEL DERECHO ═══════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── TABLA SUPERIOR ── */}
        <div className="flex-shrink-0 border-b border-gray-300 bg-white flex flex-col">
          {/* Botones de acción */}
          <div className="px-3 py-1.5 border-b border-gray-200 flex items-center gap-1 bg-gray-50">
            <span
              className="text-xs text-primary-theme px-2 py-0.5 bg-primary-theme-10 rounded"
              style={{ fontWeight: 600 }}
            >
              Instituciones Financieras
            </span>
            <div className="flex items-center gap-1 ml-3">
              {/* Menú de exportación */}
              <div className="relative">
                <button
                  onClick={() => setShowMenuTop((p) => !p)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 transition-colors"
                >
                  <Menu size={11} />
                  Menu
                  <ChevronDown size={10} />
                </button>
                {showMenuTop && (
                  <ExportMenu data={filteredData} onClose={() => setShowMenuTop(false)} />
                )}
              </div>

              {/* Nuevo */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 transition-colors"
              >
                <Plus size={11} />
                Nuevo
              </button>

              {/* Eliminar */}
              <button
                onClick={() => {
                  if (!selectedId) {
                    toast.warning('Seleccione una institución para eliminar');
                    return;
                  }
                  const inst = data.find((i) => i.id === selectedId);
                  if (inst) setDeleteTarget(inst);
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 transition-colors"
              >
                <Trash2 size={11} />
                Eliminar
              </button>

              {/* Consulta / Búsqueda */}
              <button
                onClick={() => setShowSearch((p) => !p)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] border rounded transition-colors ${
                  showSearch
                    ? 'border-primary-theme bg-primary-theme-10 text-primary-theme'
                    : 'border-gray-300 bg-white hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Search size={11} />
                Consulta
              </button>
            </div>

            {/* Search input */}
            {showSearch && (
              <div className="ml-2 flex items-center gap-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, ubicación, ciudad..."
                  className="text-[11px] px-2 py-1 border border-gray-300 rounded w-[250px] focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-gray-400 hover:text-gray-600 p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
                <span className="text-[10px] text-gray-400">
                  {filteredData.length}/{data.length}
                </span>
              </div>
            )}
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#D0D0D0]">
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">
                    Nombre
                  </th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">
                    Ubicación
                  </th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">
                    Dirección
                  </th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">
                    Teléfono principal
                  </th>
                  <th className="px-2 py-1.5 text-left text-gray-700 whitespace-nowrap">
                    Fax principal
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((inst, i) => {
                  const isRow = selectedId === inst.id;
                  return (
                    <tr
                      key={inst.id}
                      onClick={() => handleSelect(inst.id)}
                      className={`cursor-pointer border-b border-gray-100 transition-colors ${
                        isRow
                          ? 'bg-primary-theme text-white'
                          : i % 2 === 0
                            ? 'bg-white hover:bg-blue-50/50'
                            : 'bg-gray-50/50 hover:bg-blue-50/50'
                      }`}
                    >
                      <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">
                        {inst.nombre}
                      </td>
                      <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">
                        {inst.ubicacion}
                      </td>
                      <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap truncate max-w-[260px]">
                        {inst.direccion}
                      </td>
                      <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">
                        {inst.telefono}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {inst.fax}
                      </td>
                    </tr>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                      No se encontraron instituciones.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FORMULARIO INFERIOR ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {formData ? (
            <div className="p-0">
              {/* Header del formulario */}
              <div className="px-4 py-2 bg-primary-theme-10 border-b border-gray-300 flex items-center justify-between">
                <h3
                  className="text-sm text-primary-theme tracking-wide"
                  style={{ fontWeight: 700 }}
                >
                  {formData.nombre || 'Sin nombre'}
                </h3>
                <span className="text-[10px] text-primary-theme-60">{formData.institucionNumero}</span>
              </div>

              {/* Campos del formulario */}
              <div className="p-4 bg-white mx-3 my-3 rounded border border-gray-200">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                  {/* ── Fila 1 ── */}
                  <FormFieldIF
                    label="Nombre de la inst. fin."
                    name="nombre"
                    value={formData.nombre}
                    required
                    onChange={handleFieldChange}
                  />
                  <FormFieldIF
                    label="Ubicación"
                    name="ubicacion"
                    value={formData.ubicacion}
                    onChange={handleFieldChange}
                  />

                  {/* ── Fila 2 ── */}
                  <FormFieldIF
                    label="Tipo de inst. financiera"
                    name="tipoInstitucion"
                    value={formData.tipoInstitucion}
                    type="select"
                    options={TIPO_OPTIONS}
                    required
                    onChange={handleFieldChange}
                  />
                  <FormFieldIF
                    label="Institución #"
                    name="institucionNumero"
                    value={formData.institucionNumero}
                    readOnly
                  />

                  {/* ── Fila 3 ── */}
                  <FormFieldIF
                    label="Inst. financiera princ."
                    name="institucionPrincipalId"
                    value={
                      formData.institucionPrincipalId
                        ? String(formData.institucionPrincipalId)
                        : ''
                    }
                    type="select"
                    options={institucionOptions}
                    onChange={handleFieldChange}
                  />
                  <FormFieldIF
                    label="Dirección"
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleFieldChange}
                  />

                  {/* ── Fila 4 ── */}
                  <FormFieldIF
                    label="Jerarquía de compañías"
                    name="jerarquiaCompanias"
                    value={formData.jerarquiaCompanias}
                    type="select"
                    options={JERARQUIA_OPTIONS}
                    onChange={handleFieldChange}
                  />
                  <FormFieldIF
                    label="Código postal"
                    name="codigoPostal"
                    value={formData.codigoPostal}
                    required
                    onChange={handleFieldChange}
                  />

                  {/* ── Separador: Períodos de revisión ── */}
                  <div className="col-span-2 mt-1 mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-primary-theme" style={{ fontWeight: 600 }}>
                        Períodos de revisión
                      </span>
                      <div className="flex-1 border-t border-primary-theme-15" />
                    </div>
                  </div>

                  {/* ── Períodos ── */}
                  <FormFieldIF
                    label="Período 1"
                    name="periodoRevision1"
                    value={formData.periodoRevision1}
                    type="date"
                    onChange={handleFieldChange}
                  />
                  <FormFieldIF
                    label="Ciudad"
                    name="ciudad"
                    value={formData.ciudad}
                    required
                    onChange={handleFieldChange}
                  />

                  <FormFieldIF
                    label="Período 2"
                    name="periodoRevision2"
                    value={formData.periodoRevision2}
                    type="date"
                    onChange={handleFieldChange}
                  />
                  <FormFieldIF
                    label="Región"
                    name="region"
                    value={formData.region}
                    type="select"
                    options={REGION_OPTIONS}
                    onChange={handleFieldChange}
                  />

                  <FormFieldIF
                    label="Período 3"
                    name="periodoRevision3"
                    value={formData.periodoRevision3}
                    type="date"
                    onChange={handleFieldChange}
                  />
                  <FormFieldIF
                    label="País"
                    name="pais"
                    value={formData.pais}
                    type="select"
                    options={PAIS_OPTIONS}
                    onChange={handleFieldChange}
                  />

                  <FormFieldIF
                    label="Período 4"
                    name="periodoRevision4"
                    value={formData.periodoRevision4}
                    type="date"
                    onChange={handleFieldChange}
                  />
                  <FormFieldIF
                    label="Teléfono"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleFieldChange}
                  />

                  {/* ── Separador ── */}
                  <div className="col-span-2 border-t border-gray-100 my-1" />

                  {/* ── Datos complementarios ── */}
                  <FormFieldIF
                    label="Moneda"
                    name="moneda"
                    value={formData.moneda}
                    required
                    type="select"
                    options={MONEDA_OPTIONS}
                    onChange={handleFieldChange}
                  />
                  <FormFieldIF
                    label="Fax"
                    name="fax"
                    value={formData.fax}
                    onChange={handleFieldChange}
                  />

                  <FormFieldIF
                    label="Indicador de socio"
                    name="indicadorSocio"
                    type="checkbox"
                    checked={formData.indicadorSocio}
                    onCheck={handleCheckChange}
                  />
                  <FormFieldIF
                    label="IVA %"
                    name="ivaPorcentaje"
                    value={formData.ivaPorcentaje}
                    onChange={handleFieldChange}
                  />
                </div>

                {/* ── Botones de acción del formulario ── */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200">
                  <button
                    onClick={handleSaveForm}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-[#0099CC] text-white rounded hover:bg-[#0088BB] transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Save size={12} />
                    Guardar cambios
                  </button>
                  <button
                    onClick={handleResetForm}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-white border border-gray-400 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <RotateCcw size={12} />
                    Descartar cambios
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Seleccione una institución del árbol o la tabla para ver sus detalles
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
