import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Menu,
  Plus,
  Search,
  Store,
  Save,
  RotateCcw,
  Trash2,
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
interface Sucursal {
  id: number;
  nombre: string;
  ubicacion: string;
  nombreOrganizacion: string;
  direccion: string;
  codigoPostal: string;
  ciudad: string;
  region: string;
  pais: string;
  tipoOrganizacion: string;
  sucursalPrincipalId: number | null;
  indicadorOrganizacion: boolean;
  organizacionPrincipal: string;
  idComercianteTarjeta: string;
  noSucursal: string;
  noSucursalPrincipal: string;
  telefono: string;
  moneda: string;
  indicadorSocio: boolean;
  rfcEmpresa: string;
  representanteLegal1: string;
  representanteLegal2: string;
  paginaWeb: string;
}

interface TreeNode {
  sucursal: Sucursal;
  children: TreeNode[];
}

// ═══════════════════════════════════════════════════════════════════
// DATOS MOCK
// ═══════════════════════════════════════════════════════════════════
const SUCURSALES_DATA: Sucursal[] = [
  {
    id: 1, nombre: 'Ciudad de México', ubicacion: 'CDMX Centro',
    nombreOrganizacion: 'MASTER FINANCIAL MANAGEMENT SAPI',
    direccion: 'Av. Paseo de la Reforma 505, Col. Cuauhtémoc', codigoPostal: '06500',
    ciudad: 'Ciudad de México', region: 'Centro', pais: 'México',
    tipoOrganizacion: 'Casa Matriz', sucursalPrincipalId: null,
    indicadorOrganizacion: true, organizacionPrincipal: 'MASTER FINANCIAL MANAGEMENT SAPI - OK',
    idComercianteTarjeta: 'MCH-001-CDMX', noSucursal: '01', noSucursalPrincipal: '01',
    telefono: '(55) 5123-4567', moneda: 'MXN', indicadorSocio: false,
    rfcEmpresa: 'MFM-030515-AB9', representanteLegal1: 'Lic. Carlos Mendoza Ríos',
    representanteLegal2: 'Lic. María Elena Vega', paginaWeb: 'www.masterfinancial.com.mx',
  },
  {
    id: 2, nombre: 'Toluca', ubicacion: 'Toluca Centro',
    nombreOrganizacion: 'MASTER FINANCIAL MANAGEMENT SAPI',
    direccion: 'Blvd. Isidro Fabela 120, Col. Centro', codigoPostal: '50000',
    ciudad: 'Toluca', region: 'Centro', pais: 'México',
    tipoOrganizacion: 'Sucursal Regional', sucursalPrincipalId: 1,
    indicadorOrganizacion: false, organizacionPrincipal: 'MASTER FINANCIAL MANAGEMENT SAPI - OK',
    idComercianteTarjeta: 'MCH-002-TLC', noSucursal: '02', noSucursalPrincipal: '01',
    telefono: '(722) 215-3456', moneda: 'MXN', indicadorSocio: false,
    rfcEmpresa: 'MFM-030515-AB9', representanteLegal1: 'Lic. Roberto Sánchez Vega',
    representanteLegal2: '', paginaWeb: 'www.masterfinancial.com.mx/toluca',
  },
  {
    id: 3, nombre: 'Guadalajara', ubicacion: 'GDL Providencia',
    nombreOrganizacion: 'MASTER FINANCIAL MANAGEMENT SAPI',
    direccion: 'Av. Providencia 2578, Col. Providencia', codigoPostal: '44630',
    ciudad: 'Guadalajara', region: 'Occidente', pais: 'México',
    tipoOrganizacion: 'Sucursal Regional', sucursalPrincipalId: null,
    indicadorOrganizacion: true, organizacionPrincipal: 'MASTER FINANCIAL MANAGEMENT SAPI - OK',
    idComercianteTarjeta: 'MCH-003-GDL', noSucursal: '03', noSucursalPrincipal: '03',
    telefono: '(33) 3345-6789', moneda: 'MXN', indicadorSocio: true,
    rfcEmpresa: 'MFM-030515-AB9', representanteLegal1: 'Lic. Ana García López',
    representanteLegal2: 'Lic. Patricia López Morales', paginaWeb: 'www.masterfinancial.com.mx/guadalajara',
  },
  {
    id: 4, nombre: 'Monterrey', ubicacion: 'MTY San Pedro',
    nombreOrganizacion: 'MASTER FINANCIAL MANAGEMENT SAPI',
    direccion: 'Av. Vasconcelos 345, Col. Del Valle', codigoPostal: '66220',
    ciudad: 'Monterrey', region: 'Norte', pais: 'México',
    tipoOrganizacion: 'Sucursal Regional', sucursalPrincipalId: null,
    indicadorOrganizacion: true, organizacionPrincipal: 'MASTER FINANCIAL MANAGEMENT SAPI - OK',
    idComercianteTarjeta: 'MCH-004-MTY', noSucursal: '04', noSucursalPrincipal: '04',
    telefono: '(81) 8234-5678', moneda: 'MXN', indicadorSocio: false,
    rfcEmpresa: 'MFM-030515-AB9', representanteLegal1: 'Ing. Luis Torres Hernández',
    representanteLegal2: '', paginaWeb: 'www.masterfinancial.com.mx/monterrey',
  },
  {
    id: 5, nombre: 'Querétaro', ubicacion: 'QRO Juriquilla',
    nombreOrganizacion: 'MASTER FINANCIAL MANAGEMENT SAPI',
    direccion: 'Blvd. Juriquilla 3500, Col. Juriquilla', codigoPostal: '76226',
    ciudad: 'Querétaro', region: 'Centro', pais: 'México',
    tipoOrganizacion: 'Sucursal', sucursalPrincipalId: 1,
    indicadorOrganizacion: false, organizacionPrincipal: 'MASTER FINANCIAL MANAGEMENT SAPI - OK',
    idComercianteTarjeta: 'MCH-005-QRO', noSucursal: '05', noSucursalPrincipal: '01',
    telefono: '(442) 678-9012', moneda: 'MXN', indicadorSocio: false,
    rfcEmpresa: 'MFM-030515-AB9', representanteLegal1: 'Lic. Fernando Díaz Castro',
    representanteLegal2: '', paginaWeb: 'www.masterfinancial.com.mx/queretaro',
  },
];

// ═══════════════════════════════════════════════════════════════════
// PERSISTENCIA
// ═══════════════════════════════════════════════════════════════════
const STORAGE_KEY_SUC = 'config_sucursales_data';
function loadDataSuc(): Sucursal[] {
  try { const r = sessionStorage.getItem(STORAGE_KEY_SUC); if (r) return JSON.parse(r); } catch {}
  return SUCURSALES_DATA;
}
function saveDataSuc(d: Sucursal[]) {
  try { sessionStorage.setItem(STORAGE_KEY_SUC, JSON.stringify(d)); } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// OPCIONES
// ═══════════════════════════════════════════════════════════════════
const TIPO_ORG_OPTIONS = [
  { value: 'Casa Matriz', label: 'Casa Matriz' },
  { value: 'Sucursal Regional', label: 'Sucursal Regional' },
  { value: 'Sucursal', label: 'Sucursal' },
];
const REGION_OPTIONS = [
  { value: 'Centro', label: 'Centro' },
  { value: 'Norte', label: 'Norte' },
  { value: 'Occidente', label: 'Occidente' },
  { value: 'Sur', label: 'Sur' },
  { value: 'Sureste', label: 'Sureste' },
  { value: 'Golfo', label: 'Golfo' },
  { value: 'Noroeste', label: 'Noroeste' },
];
const MONEDA_OPTIONS = [
  { value: 'MXN', label: 'MXN' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
];
const PAIS_OPTIONS = [
  { value: 'México', label: 'México' },
  { value: 'Estados Unidos', label: 'Estados Unidos' },
];

// ═══════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════
function buildTree(data: Sucursal[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];
  data.forEach((s) => map.set(s.id, { sucursal: s, children: [] }));
  data.forEach((s) => {
    const node = map.get(s.id)!;
    if (s.sucursalPrincipalId && map.has(s.sucursalPrincipalId)) {
      map.get(s.sucursalPrincipalId)!.children.push(node);
    } else { roots.push(node); }
  });
  return roots;
}

function generateNextNo(data: Sucursal[]): string {
  const nums = data.map((d) => parseInt(d.noSucursal, 10) || 0);
  return String(Math.max(0, ...nums) + 1).padStart(2, '0');
}

function emptySucursal(): Omit<Sucursal, 'id'> {
  return {
    nombre: '', ubicacion: '', nombreOrganizacion: 'MASTER FINANCIAL MANAGEMENT SAPI',
    direccion: '', codigoPostal: '', ciudad: '', region: '', pais: 'México',
    tipoOrganizacion: '', sucursalPrincipalId: null, indicadorOrganizacion: false,
    organizacionPrincipal: 'MASTER FINANCIAL MANAGEMENT SAPI - OK',
    idComercianteTarjeta: '', noSucursal: '', noSucursalPrincipal: '',
    telefono: '', moneda: 'MXN', indicadorSocio: false,
    rfcEmpresa: 'MFM-030515-AB9', representanteLegal1: '', representanteLegal2: '', paginaWeb: '',
  };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTACIÓN
// ═══════════════════════════════════════════════════════════════════
function exportExcel(data: Sucursal[]) {
  const rows = data.map((d) => ({ 'No': d.noSucursal, 'Nombre': d.nombre, 'Ubicación': d.ubicacion, 'Organización': d.nombreOrganizacion, 'Dirección': d.direccion, 'C.P.': d.codigoPostal, 'Ciudad': d.ciudad, 'Región': d.region, 'País': d.pais, 'Teléfono': d.telefono }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sucursales');
  XLSX.writeFile(wb, 'sucursales.xlsx');
  toast.success('Exportado a Excel');
}
function exportCSV(data: Sucursal[]) {
  const rows = data.map((d) => ({ 'No': d.noSucursal, 'Nombre': d.nombre, 'Ubicación': d.ubicacion, 'Ciudad': d.ciudad, 'Región': d.region, 'Teléfono': d.telefono }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'sucursales.csv'; link.click();
  toast.success('Exportado a CSV');
}
function exportPDF(data: Sucursal[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14); doc.text('Sucursales', 14, 18);
  doc.setFontSize(9); doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 14, 24);
  autoTable(doc, {
    startY: 30,
    head: [['No', 'Nombre', 'Tipo', 'Ubicación', 'Ciudad', 'Región', 'Teléfono', 'Moneda']],
    body: data.map((d) => [d.noSucursal, d.nombre, d.tipoOrganizacion, d.ubicacion, d.ciudad, d.region, d.telefono, d.moneda]),
    styles: { fontSize: 7 }, headStyles: { fillColor: [74, 111, 165] }, alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  doc.save('sucursales.pdf');
  toast.success('Exportado a PDF');
}
function doPrint(data: Sucursal[]) {
  const html = `<html><head><title>Sucursales</title><style>body{font-family:Arial;font-size:11px;margin:20px}h2{color:#4A6FA5}table{border-collapse:collapse;width:100%}th{background:#4A6FA5;color:#fff;padding:6px 8px;text-align:left;font-size:10px}td{padding:4px 8px;border-bottom:1px solid #ddd;font-size:10px}tr:nth-child(even){background:#f5f5f5}</style></head><body><h2>Sucursales</h2><table><tr><th>No</th><th>Nombre</th><th>Tipo</th><th>Ubicación</th><th>Ciudad</th><th>Región</th><th>Teléfono</th></tr>${data.map((d) => `<tr><td>${d.noSucursal}</td><td>${d.nombre}</td><td>${d.tipoOrganizacion}</td><td>${d.ubicacion}</td><td>${d.ciudad}</td><td>${d.region}</td><td>${d.telefono}</td></tr>`).join('')}</table></body></html>`;
  const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: NODO DEL ÁRBOL
// ═══════════════════════════════════════════════════════════════════
function TreeNodeItem({ node, level, selectedId, expandedIds, onSelect, onToggle }: {
  node: TreeNode; level: number; selectedId: number | null; expandedIds: Set<number>;
  onSelect: (id: number) => void; onToggle: (id: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.sucursal.id);
  const isSelected = selectedId === node.sucursal.id;
  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-1 cursor-pointer rounded transition-colors text-xs ${isSelected ? 'bg-[#4A6FA5] text-white' : 'hover:bg-[#D9E2F3]/60 text-gray-700'}`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onClick={() => { onSelect(node.sucursal.id); if (hasChildren) onToggle(node.sucursal.id); }}
      >
        {hasChildren ? (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : <span className="flex-shrink-0 w-4 h-4" />}
        <Building2 size={12} className={`flex-shrink-0 ${isSelected ? 'text-white' : 'text-[#4A6FA5]'}`} />
        <span className="truncate">{node.sucursal.nombre}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>{node.children.map((c) => <TreeNodeItem key={c.sucursal.id} node={c} level={level + 1} selectedId={selectedId} expandedIds={expandedIds} onSelect={onSelect} onToggle={onToggle} />)}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: CAMPO DE FORMULARIO (editable)
// ═══════════════════════════════════════════════════════════════════
const FormFieldSuc = React.memo(function FormFieldSuc({ label, value, name, required, type = 'text', options, checked, readOnly, onChange, onCheck }: {
  label: string; value?: string; name?: string; required?: boolean;
  type?: 'text' | 'select' | 'checkbox'; options?: { value: string; label: string }[];
  checked?: boolean; readOnly?: boolean;
  onChange?: (n: string, v: string) => void; onCheck?: (n: string, c: boolean) => void;
}) {
  const editable = !!onChange && !readOnly;
  const checkEditable = !!onCheck && !readOnly;
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-gray-600 w-[140px] flex-shrink-0 text-right">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}{':'}
      </label>
      {type === 'checkbox' ? (
        <input type="checkbox" checked={checked} readOnly={!checkEditable}
          onChange={checkEditable ? (e) => onCheck!(name!, e.target.checked) : undefined}
          className="h-3.5 w-3.5 accent-[#4A6FA5]" />
      ) : type === 'select' ? (
        <select value={String(value ?? '')} disabled={!editable}
          onChange={editable ? (e) => onChange!(name!, e.target.value) : undefined}
          className={`flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 ${editable ? 'focus:border-[#4A6FA5] focus:ring-1 focus:ring-[#4A6FA5]/30 outline-none' : 'disabled:bg-gray-50'}`}>
          <option value="">-- Seleccionar --</option>
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type="text" value={value ?? ''} readOnly={!editable}
          onChange={editable ? (e) => onChange!(name!, e.target.value) : undefined}
          className={`flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 ${editable ? 'focus:border-[#4A6FA5] focus:ring-1 focus:ring-[#4A6FA5]/30 outline-none' : 'read-only:bg-gray-50'}`} />
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: MENÚ EXPORTACIÓN
// ═══════════════════════════════════════════════════════════════════
function ExportMenuSuc({ data, onClose }: { data: Sucursal[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const items = [
    { icon: <FileSpreadsheet size={12} className="text-green-600" />, label: 'Exportar a Excel', action: () => { exportExcel(data); onClose(); } },
    { icon: <FileText size={12} className="text-blue-600" />, label: 'Exportar a CSV', action: () => { exportCSV(data); onClose(); } },
    { icon: <FileDown size={12} className="text-red-600" />, label: 'Exportar a PDF', action: () => { exportPDF(data); onClose(); } },
    { icon: <Printer size={12} className="text-gray-600" />, label: 'Imprimir', action: () => { doPrint(data); onClose(); } },
  ];
  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 py-1 min-w-[180px]">
      {items.map((i) => (
        <button key={i.label} onClick={i.action} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-[#D9E2F3]/60 transition-colors text-left">
          {i.icon}{i.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL: CONFIRMAR ELIMINACIÓN
// ═══════════════════════════════════════════════════════════════════
function DeleteConfirmSuc({ suc, childCount, onConfirm, onCancel }: { suc: Sucursal; childCount: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-2xl w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white"><AlertTriangle size={16} /><span className="text-sm" style={{ fontWeight: 600 }}>Confirmar eliminación</span></div>
        <div className="p-5">
          <p className="text-xs text-gray-700 mb-2">¿Está seguro de eliminar la sucursal?</p>
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-3">
            <p className="text-[11px] text-gray-800" style={{ fontWeight: 600 }}>{suc.nombre}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">No. {suc.noSucursal} &bull; {suc.tipoOrganizacion}</p>
          </div>
          {childCount > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-2.5 mb-3">
              <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800">Esta sucursal tiene <span style={{ fontWeight: 600 }}>{childCount} sucursal(es) hija(s)</span> que también serán eliminadas.</p>
            </div>
          )}
          <p className="text-[10px] text-gray-500">Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button onClick={onCancel} className="px-3.5 py-1.5 text-[11px] border border-gray-400 rounded bg-white hover:bg-gray-100 text-gray-700">Cancelar</button>
          <button onClick={onConfirm} className="px-3.5 py-1.5 text-[11px] bg-red-600 text-white rounded hover:bg-red-700" style={{ fontWeight: 500 }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL: CREAR SUCURSAL
// ═══════════════════════════════════════════════════════════════════
function CreateModalSuc({ nextNo, sucursalOptions, onSave, onCancel }: {
  nextNo: string; sucursalOptions: { value: string; label: string }[];
  onSave: (s: Omit<Sucursal, 'id'>) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Sucursal, 'id'>>({ ...emptySucursal(), noSucursal: nextNo });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const handleChange = useCallback((n: string, v: string) => {
    setForm((p) => {
      if (n === 'sucursalPrincipalId') return { ...p, sucursalPrincipalId: v ? parseInt(v, 10) : null };
      return { ...p, [n]: v };
    });
    setErrors((p) => ({ ...p, [n]: false }));
  }, []);
  const handleCheck = useCallback((n: string, c: boolean) => { setForm((p) => ({ ...p, [n]: c })); }, []);

  const handleSave = () => {
    const req: (keyof typeof form)[] = ['nombre', 'codigoPostal', 'ciudad', 'noSucursal', 'nombreOrganizacion'];
    const ne: Record<string, boolean> = {};
    req.forEach((f) => { if (!form[f]) ne[f] = true; });
    if (Object.keys(ne).length > 0) { setErrors(ne); toast.error('Complete los campos obligatorios'); return; }
    onSave(form);
  };

  const fld = (label: string, name: string, opts?: { required?: boolean; type?: 'text' | 'select' | 'checkbox'; options?: { value: string; label: string }[] }) => {
    const o = opts ?? {};
    return (
      <div className="flex items-center gap-2">
        <label className={`text-[11px] w-[140px] flex-shrink-0 text-right ${errors[name] ? 'text-red-600' : 'text-gray-600'}`}>
          {label}{o.required && <span className="text-red-500 ml-0.5">*</span>}{':'}
        </label>
        {o.type === 'checkbox' ? (
          <input type="checkbox" checked={(form as any)[name] as boolean} onChange={(e) => handleCheck(name, e.target.checked)} className="h-3.5 w-3.5 accent-[#4A6FA5]" />
        ) : o.type === 'select' ? (
          <select value={String((form as any)[name] ?? '')} onChange={(e) => handleChange(name, e.target.value)}
            className={`flex-1 text-[11px] px-1.5 py-1 border rounded bg-white text-gray-800 min-w-0 focus:border-[#4A6FA5] focus:ring-1 focus:ring-[#4A6FA5]/30 outline-none ${errors[name] ? 'border-red-400' : 'border-gray-300'}`}>
            <option value="">-- Seleccionar --</option>
            {o.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        ) : (
          <input type="text" value={String((form as any)[name] ?? '')} onChange={(e) => handleChange(name, e.target.value)}
            className={`flex-1 text-[11px] px-1.5 py-1 border rounded bg-white text-gray-800 min-w-0 focus:border-[#4A6FA5] focus:ring-1 focus:ring-[#4A6FA5]/30 outline-none ${errors[name] ? 'border-red-400' : 'border-gray-300'}`} />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-2xl flex flex-col" style={{ width: '780px', maxHeight: '88vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 bg-[#4A6FA5] rounded-t-lg">
          <div className="flex items-center gap-2"><Plus size={15} className="text-white" /><span className="text-white text-sm" style={{ fontWeight: 600 }}>Nueva Sucursal</span><span className="text-white/60 text-xs ml-2">No. {nextNo}</span></div>
          <button onClick={onCancel} className="text-white/80 hover:text-white p-0.5 rounded hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
            <div className="col-span-2 mb-1"><div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5 rounded-r inline-block"><span className="text-[11px] text-[#4A6FA5]" style={{ fontWeight: 600 }}>Datos principales</span></div></div>
            {fld('Nombre sucursal', 'nombre', { required: true })}
            {fld('Ubicación', 'ubicacion')}
            {fld('Tipo de organización', 'tipoOrganizacion', { type: 'select', options: TIPO_ORG_OPTIONS })}
            {fld('No. Sucursal', 'noSucursal', { required: true })}
            {fld('Sucursal principal', 'sucursalPrincipalId', { type: 'select', options: sucursalOptions })}
            {fld('Dirección', 'direccion')}
            {fld('Nombre de la org.', 'nombreOrganizacion', { required: true })}
            {fld('C.P.', 'codigoPostal', { required: true })}
            {fld('Org. principal', 'organizacionPrincipal')}
            {fld('Ciudad', 'ciudad', { required: true })}
            <div className="col-span-2 mt-2 mb-1"><div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5 rounded-r inline-block"><span className="text-[11px] text-[#4A6FA5]" style={{ fontWeight: 600 }}>Contacto y complementarios</span></div></div>
            {fld('Teléfono', 'telefono')}
            {fld('Región', 'region', { type: 'select', options: REGION_OPTIONS })}
            {fld('Moneda', 'moneda', { type: 'select', options: MONEDA_OPTIONS })}
            {fld('País', 'pais', { type: 'select', options: PAIS_OPTIONS })}
            {fld('RFC Empresa', 'rfcEmpresa')}
            {fld('Página web', 'paginaWeb')}
            {fld('Representante Legal 1', 'representanteLegal1')}
            {fld('Representante Legal 2', 'representanteLegal2')}
            {fld('Indicador socio', 'indicadorSocio', { type: 'checkbox' })}
            {fld('Org. de sucursal', 'indicadorOrganizacion', { type: 'checkbox' })}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button onClick={onCancel} className="px-4 py-1.5 text-[11px] border border-gray-400 rounded bg-white hover:bg-gray-100 text-gray-700">Cancelar</button>
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-[#0099CC] text-white rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}><Save size={12} />Crear sucursal</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function SucursalesSection() {
  const [data, setData] = useState<Sucursal[]>(loadDataSuc);
  const [selectedId, setSelectedId] = useState<number | null>(() => { const d = loadDataSuc(); return d.length > 0 ? d[0].id : null; });
  const [formData, setFormData] = useState<Sucursal | null>(() => { const d = loadDataSuc(); return d.length > 0 ? { ...d[0] } : null; });
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set([1, 3]));
  const [showMenu, setShowMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sucursal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => { saveDataSuc(data); }, [data]);

  const tree = useMemo(() => buildTree(data), [data]);
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((s) => s.nombre.toLowerCase().includes(q) || s.ubicacion.toLowerCase().includes(q) || s.ciudad.toLowerCase().includes(q));
  }, [data, searchQuery]);

  const handleToggle = useCallback((id: number) => { setExpandedIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);
  const handleSelect = useCallback((id: number) => { setSelectedId(id); const s = data.find((i) => i.id === id); if (s) setFormData({ ...s }); }, [data]);
  const handleFieldChange = useCallback((name: string, value: string) => {
    setFormData((p) => {
      if (!p) return p;
      if (name === 'sucursalPrincipalId') return { ...p, sucursalPrincipalId: value ? parseInt(value, 10) : null };
      return { ...p, [name]: value };
    });
  }, []);
  const handleCheckChange = useCallback((name: string, checked: boolean) => { setFormData((p) => p ? { ...p, [name]: checked } : p); }, []);

  const handleSaveForm = useCallback(() => {
    if (!formData) return;
    setData((p) => p.map((s) => s.id === formData.id ? { ...formData } : s));
    toast.success('Cambios guardados', { description: `Sucursal "${formData.nombre}" actualizada.` });
  }, [formData]);

  const handleResetForm = useCallback(() => {
    if (!selectedId) return;
    const orig = data.find((s) => s.id === selectedId);
    if (orig) { setFormData({ ...orig }); toast.info('Cambios descartados'); }
  }, [data, selectedId]);

  const handleCreate = useCallback((suc: Omit<Sucursal, 'id'>) => {
    const newId = Math.max(0, ...data.map((d) => d.id)) + 1;
    const newSuc: Sucursal = { ...suc, id: newId, sucursalPrincipalId: suc.sucursalPrincipalId ? Number(suc.sucursalPrincipalId) : null };
    setData((p) => [...p, newSuc]);
    setSelectedId(newId); setFormData({ ...newSuc });
    if (newSuc.sucursalPrincipalId) setExpandedIds((p) => { const n = new Set(p); n.add(newSuc.sucursalPrincipalId!); return n; });
    setShowCreate(false);
    toast.success('Sucursal creada', { description: `${newSuc.nombre} (No. ${newSuc.noSucursal}) agregada.` });
  }, [data]);

  const getDescendantCount = useCallback((id: number): number => {
    const children = data.filter((d) => d.sucursalPrincipalId === id);
    return children.reduce((a, c) => a + 1 + getDescendantCount(c.id), 0);
  }, [data]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    const toRemove = new Set<number>();
    const collect = (id: number) => { toRemove.add(id); data.filter((d) => d.sucursalPrincipalId === id).forEach((d) => collect(d.id)); };
    collect(deleteTarget.id);
    setData((p) => p.filter((d) => !toRemove.has(d.id)));
    const remaining = data.filter((d) => !toRemove.has(d.id));
    if (remaining.length > 0) { setSelectedId(remaining[0].id); setFormData({ ...remaining[0] }); }
    else { setSelectedId(null); setFormData(null); }
    setDeleteTarget(null);
    toast.success('Sucursal eliminada', { description: `"${deleteTarget.nombre}" eliminada.` });
  }, [deleteTarget, data]);

  const sucursalOptions = useMemo(() => data.map((s) => ({ value: String(s.id), label: s.nombre })), [data]);
  const nextNo = useMemo(() => generateNextNo(data), [data]);

  return (
    <div className="flex h-[calc(100vh-160px)] bg-gray-100">
      {showCreate && <CreateModalSuc nextNo={nextNo} sucursalOptions={sucursalOptions} onSave={handleCreate} onCancel={() => setShowCreate(false)} />}
      {deleteTarget && <DeleteConfirmSuc suc={deleteTarget} childCount={getDescendantCount(deleteTarget.id)} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />}

      {/* PANEL IZQUIERDO */}
      <div className="w-[220px] flex-shrink-0 border-r border-gray-300 bg-white flex flex-col">
        <div className="px-3 py-2 bg-[#D9E2F3] border-b border-gray-300 flex items-center gap-2">
          <Store size={14} className="text-[#4A6FA5]" />
          <span className="text-xs text-[#4A6FA5]" style={{ fontWeight: 600 }}>Sucursales</span>
          <span className="text-[9px] text-[#4A6FA5]/60 ml-auto">{data.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {tree.map((n) => <TreeNodeItem key={n.sucursal.id} node={n} level={0} selectedId={selectedId} expandedIds={expandedIds} onSelect={handleSelect} onToggle={handleToggle} />)}
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TABLA */}
        <div className="flex-shrink-0 border-b border-gray-300 bg-white flex flex-col">
          <div className="px-3 py-1.5 border-b border-gray-200 flex items-center gap-1 bg-gray-50">
            <span className="text-xs text-[#4A6FA5] px-2 py-0.5 bg-[#D9E2F3] rounded" style={{ fontWeight: 600 }}>Sucursales</span>
            <div className="flex items-center gap-1 ml-3">
              <div className="relative">
                <button onClick={() => setShowMenu((p) => !p)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700">
                  <Menu size={11} />Menu<ChevronDown size={10} />
                </button>
                {showMenu && <ExportMenuSuc data={filteredData} onClose={() => setShowMenu(false)} />}
              </div>
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700"><Plus size={11} />Nuevo</button>
              <button onClick={() => { if (!selectedId) { toast.warning('Seleccione una sucursal'); return; } const s = data.find((i) => i.id === selectedId); if (s) setDeleteTarget(s); }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700"><Trash2 size={11} />Eliminar</button>
              <button onClick={() => setShowSearch((p) => !p)} className={`flex items-center gap-1 px-2.5 py-1 text-[11px] border rounded ${showSearch ? 'border-[#4A6FA5] bg-[#D9E2F3] text-[#4A6FA5]' : 'border-gray-300 bg-white hover:bg-gray-100 text-gray-700'}`}>
                <Search size={11} />Consulta
              </button>
            </div>
            {showSearch && (
              <div className="ml-2 flex items-center gap-1">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar..." className="text-[11px] px-2 py-1 border border-gray-300 rounded w-[200px] focus:border-[#4A6FA5] outline-none" autoFocus />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 p-0.5"><X size={12} /></button>}
                <span className="text-[10px] text-gray-400">{filteredData.length}/{data.length}</span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto max-h-[180px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#D0D0D0]">
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Nombre</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Ubicación</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Nombre de la org.</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Dirección</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">C.P.</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Ciudad</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Región</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 whitespace-nowrap">País</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((s, i) => (
                  <tr key={s.id} onClick={() => handleSelect(s.id)}
                    className={`cursor-pointer border-b border-gray-100 transition-colors ${selectedId === s.id ? 'bg-[#4A6FA5] text-white' : i % 2 === 0 ? 'bg-white hover:bg-blue-50/50' : 'bg-gray-50/50 hover:bg-blue-50/50'}`}>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{s.nombre}</td>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{s.ubicacion}</td>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap truncate max-w-[180px]">{s.nombreOrganizacion}</td>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap truncate max-w-[220px]">{s.direccion}</td>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{s.codigoPostal}</td>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{s.ciudad}</td>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{s.region}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{s.pais}</td>
                  </tr>
                ))}
                {filteredData.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No se encontraron sucursales.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORMULARIO */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {formData ? (
            <div className="p-0">
              <div className="px-4 py-2 bg-[#D9E2F3] border-b border-gray-300 flex items-center justify-between">
                <h3 className="text-sm text-[#4A6FA5] tracking-wide" style={{ fontWeight: 700 }}>{formData.nombre.toUpperCase()}</h3>
                <span className="text-[10px] text-[#4A6FA5]/60">No. {formData.noSucursal}</span>
              </div>
              <div className="p-4 bg-white mx-3 my-3 rounded border border-gray-200">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                  <FormFieldSuc label="Sucursal" name="nombre" value={formData.nombre} required onChange={handleFieldChange} />
                  <FormFieldSuc label="Ubicación" name="ubicacion" value={formData.ubicacion} onChange={handleFieldChange} />
                  <FormFieldSuc label="Tipo de organización" name="tipoOrganizacion" value={formData.tipoOrganizacion} type="select" options={TIPO_ORG_OPTIONS} onChange={handleFieldChange} />
                  <FormFieldSuc label="Dirección" name="direccion" value={formData.direccion} onChange={handleFieldChange} />
                  <FormFieldSuc label="Sucursal principal" name="sucursalPrincipalId" value={formData.sucursalPrincipalId ? String(formData.sucursalPrincipalId) : ''} type="select" options={sucursalOptions} onChange={handleFieldChange} />
                  <FormFieldSuc label="Código postal" name="codigoPostal" value={formData.codigoPostal} required onChange={handleFieldChange} />
                  <FormFieldSuc label="Org. de sucursal" name="indicadorOrganizacion" type="checkbox" checked={formData.indicadorOrganizacion} onCheck={handleCheckChange} />
                  <FormFieldSuc label="Ciudad" name="ciudad" value={formData.ciudad} required onChange={handleFieldChange} />
                  <FormFieldSuc label="Nombre de la org." name="nombreOrganizacion" value={formData.nombreOrganizacion} required onChange={handleFieldChange} />
                  <FormFieldSuc label="Región" name="region" value={formData.region} type="select" options={REGION_OPTIONS} onChange={handleFieldChange} />
                  <FormFieldSuc label="Org. principal" name="organizacionPrincipal" value={formData.organizacionPrincipal} onChange={handleFieldChange} />
                  <FormFieldSuc label="País" name="pais" value={formData.pais} type="select" options={PAIS_OPTIONS} onChange={handleFieldChange} />
                  <FormFieldSuc label="ID comerc. tarjeta" name="idComercianteTarjeta" value={formData.idComercianteTarjeta} onChange={handleFieldChange} />
                  <FormFieldSuc label="Teléfono" name="telefono" value={formData.telefono} onChange={handleFieldChange} />
                  <FormFieldSuc label="No Sucursal" name="noSucursal" value={formData.noSucursal} required readOnly />
                  <FormFieldSuc label="Moneda" name="moneda" value={formData.moneda} required type="select" options={MONEDA_OPTIONS} onChange={handleFieldChange} />
                  <FormFieldSuc label="No Sucursal Princ." name="noSucursalPrincipal" value={formData.noSucursalPrincipal} onChange={handleFieldChange} />
                  <FormFieldSuc label="Indicador de socio" name="indicadorSocio" type="checkbox" checked={formData.indicadorSocio} onCheck={handleCheckChange} />
                  <div className="col-span-2 border-t border-gray-100 my-1" />
                  <FormFieldSuc label="RFC Empresa" name="rfcEmpresa" value={formData.rfcEmpresa} onChange={handleFieldChange} />
                  <FormFieldSuc label="Página web" name="paginaWeb" value={formData.paginaWeb} onChange={handleFieldChange} />
                  <FormFieldSuc label="Representante Legal 1" name="representanteLegal1" value={formData.representanteLegal1} onChange={handleFieldChange} />
                  <FormFieldSuc label="Representante Legal 2" name="representanteLegal2" value={formData.representanteLegal2} onChange={handleFieldChange} />
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200">
                  <button onClick={handleSaveForm} className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-[#0099CC] text-white rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}><Save size={12} />Guardar cambios</button>
                  <button onClick={handleResetForm} className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-white border border-gray-400 text-gray-700 rounded hover:bg-gray-50" style={{ fontWeight: 500 }}><RotateCcw size={12} />Descartar cambios</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Seleccione una sucursal del árbol o la tabla para ver sus detalles</div>
          )}
        </div>
      </div>
    </div>
  );
}
