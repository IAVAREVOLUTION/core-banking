import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ChevronRight, ChevronDown, Briefcase, Menu, Plus, Search, Trash2, GitBranch, X, Users, Building2, Save, RotateCcw,
  FileSpreadsheet, FileText, FileDown, Printer, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface PuestoTrabajo {
  id: number; rowIdBase: string; puestoTrabajo: string; parentPositionId: string;
  puestoSuperiorId: number | null; puestoSuperiorNombre: string;
  rowIdAbuelo: string; positionNameAbuelo: string; tipoPuesto: string;
  sucursal: string; territorio: string; apellidos: string; nombre: string;
  cargo: string; fechaInicio: string; fechaFinal: string; remunerable: boolean;
  lanzamientoPlanRemuneracion: string; codigoMonedaRemuneracion: string;
  productoFacturable: string; descripcion: string;
}
interface TreeNode { puesto: PuestoTrabajo; children: TreeNode[]; }

// ═══════════════════════════════════════════════════════════════════
// DATOS MOCK
// ═══════════════════════════════════════════════════════════════════
const PUESTOS_DATA: PuestoTrabajo[] = [
  { id: 1, rowIdBase: 'RID-00001', puestoTrabajo: 'ADMIN', parentPositionId: 'PID-DG-001', puestoSuperiorId: null, puestoSuperiorNombre: 'DIRECTOR GENERAL', rowIdAbuelo: 'RID-AB-001', positionNameAbuelo: 'CONSEJO DE ADMINISTRACIÓN', tipoPuesto: 'Administrativo', sucursal: 'Monterrey', territorio: 'Norte', apellidos: 'MOCTEZUMA', nombre: 'FERMIN', cargo: 'Administrador de Sistemas', fechaInicio: '2020-03-15', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: 'PR-2024-NOM', codigoMonedaRemuneracion: 'MXN', productoFacturable: 'N/A', descripcion: 'Administración general de plataformas y accesos del sistema.' },
  { id: 2, rowIdBase: 'RID-00002', puestoTrabajo: 'ADMINISTRADOR SISTEMA MFM', parentPositionId: 'PID-DG-MFM', puestoSuperiorId: null, puestoSuperiorNombre: 'DIRECTOR GENERAL MFM', rowIdAbuelo: 'RID-AB-001', positionNameAbuelo: 'CONSEJO DE ADMINISTRACIÓN', tipoPuesto: 'Administrativo', sucursal: 'Monterrey', territorio: 'Norte', apellidos: '', nombre: '', cargo: 'Administrador de Sistemas MFM', fechaInicio: '2021-06-01', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: 'PR-2024-NOM', codigoMonedaRemuneracion: 'MXN', productoFacturable: 'N/A', descripcion: 'Administración del sistema core MFM y soporte tecnológico.' },
  { id: 3, rowIdBase: 'RID-00003', puestoTrabajo: 'ANALISTA CUMPLIMIENTO', parentPositionId: 'PID-DC-001', puestoSuperiorId: null, puestoSuperiorNombre: 'DIRECTOR DE CUMPLIMIENTO', rowIdAbuelo: 'RID-AB-002', positionNameAbuelo: 'DIRECTOR GENERAL', tipoPuesto: 'Operativo', sucursal: 'Querétaro', territorio: 'Centro', apellidos: '', nombre: '', cargo: 'Analista de Cumplimiento Normativo', fechaInicio: '2022-01-10', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: 'PR-2024-NOM', codigoMonedaRemuneracion: 'MXN', productoFacturable: 'N/A', descripcion: 'Análisis y seguimiento de normativa PLD/FT y regulación CNBV.' },
  { id: 4, rowIdBase: 'RID-00004', puestoTrabajo: 'ANALISTA DE CREDITO AGRONEGOCIOS', parentPositionId: 'PID-SC-001', puestoSuperiorId: null, puestoSuperiorNombre: 'SUBDIRECTOR DE CREDITO', rowIdAbuelo: 'RID-AB-003', positionNameAbuelo: 'DIRECTOR DE CREDITO', tipoPuesto: 'Operativo', sucursal: 'Querétaro', territorio: 'Centro', apellidos: '', nombre: '', cargo: 'Analista de Crédito — Agronegocios', fechaInicio: '2021-09-20', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: 'PR-2024-NOM', codigoMonedaRemuneracion: 'MXN', productoFacturable: 'CRED-AGRO', descripcion: 'Evaluación y dictamen de créditos para sector agroindustrial.' },
  { id: 5, rowIdBase: 'RID-00005', puestoTrabajo: 'ANALISTA DE CREDITO TRADICIONAL', parentPositionId: 'PID-SC-001', puestoSuperiorId: null, puestoSuperiorNombre: 'SUBDIRECTOR DE CREDITO', rowIdAbuelo: 'RID-AB-003', positionNameAbuelo: 'DIRECTOR DE CREDITO', tipoPuesto: 'Operativo', sucursal: 'Querétaro', territorio: 'Centro', apellidos: '', nombre: '', cargo: 'Analista de Crédito — Tradicional', fechaInicio: '2022-04-05', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: 'PR-2024-NOM', codigoMonedaRemuneracion: 'MXN', productoFacturable: 'CRED-TRAD', descripcion: 'Evaluación y dictamen de créditos tradicionales (PYME, personal).' },
  { id: 6, rowIdBase: 'RID-00006', puestoTrabajo: 'ANALISTA DE OPERACIONES', parentPositionId: 'PID-GO-001', puestoSuperiorId: null, puestoSuperiorNombre: 'GERENTE DE OPERACIONES', rowIdAbuelo: 'RID-AB-004', positionNameAbuelo: 'DIRECTOR DE OPERACIONES', tipoPuesto: 'Operativo', sucursal: 'Guadalajara', territorio: 'Occidente', apellidos: '', nombre: '', cargo: 'Analista de Operaciones Bancarias', fechaInicio: '2023-02-14', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: 'PR-2024-NOM', codigoMonedaRemuneracion: 'MXN', productoFacturable: 'N/A', descripcion: 'Control y seguimiento de operaciones diarias de la sucursal.' },
  { id: 7, rowIdBase: 'RID-00007', puestoTrabajo: 'ASISTENTE FACTORAJE', parentPositionId: 'PID-SF-001', puestoSuperiorId: null, puestoSuperiorNombre: 'SUBDIRECTOR DE FACTORAJE', rowIdAbuelo: 'RID-AB-005', positionNameAbuelo: 'DIRECTOR DE CREDITO', tipoPuesto: 'Operativo', sucursal: 'Toluca', territorio: 'Centro', apellidos: '', nombre: '', cargo: 'Asistente de Factoraje Financiero', fechaInicio: '2023-07-01', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: 'PR-2024-NOM', codigoMonedaRemuneracion: 'MXN', productoFacturable: 'FACT-FIN', descripcion: 'Apoyo en la gestión de contratos de factoraje financiero.' },
  { id: 8, rowIdBase: 'RID-00008', puestoTrabajo: 'AUDITOR INTERNO', parentPositionId: 'PID-DG-MFM', puestoSuperiorId: null, puestoSuperiorNombre: 'DIRECTOR GENERAL MFM', rowIdAbuelo: 'RID-AB-001', positionNameAbuelo: 'CONSEJO DE ADMINISTRACIÓN', tipoPuesto: 'Especialista', sucursal: 'Ciudad de México', territorio: 'Centro', apellidos: '', nombre: '', cargo: 'Auditor Interno Senior', fechaInicio: '2019-11-18', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: 'PR-2024-NOM', codigoMonedaRemuneracion: 'MXN', productoFacturable: 'N/A', descripcion: 'Auditoría interna de procesos, controles y cumplimiento regulatorio.' },
  { id: 9, rowIdBase: 'RID-00009', puestoTrabajo: 'CAJERO CENTRAL', parentPositionId: 'PID-DF-001', puestoSuperiorId: null, puestoSuperiorNombre: 'DIRECTOR DE FINANZAS', rowIdAbuelo: 'RID-AB-006', positionNameAbuelo: 'DIRECTOR GENERAL', tipoPuesto: 'Operativo', sucursal: 'Monterrey', territorio: 'Norte', apellidos: '', nombre: '', cargo: 'Cajero Central', fechaInicio: '2021-03-01', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: 'PR-2024-NOM', codigoMonedaRemuneracion: 'MXN', productoFacturable: 'N/A', descripcion: 'Gestión centralizada de caja y arqueos diarios.' },
  { id: 10, rowIdBase: 'RID-00010', puestoTrabajo: 'CAJERO PRINCIPAL_CAJA02', parentPositionId: 'PID-CC-001', puestoSuperiorId: 9, puestoSuperiorNombre: 'CAJERO CENTRAL', rowIdAbuelo: 'RID-AB-006', positionNameAbuelo: 'DIRECTOR DE FINANZAS', tipoPuesto: 'Operativo', sucursal: 'Monterrey', territorio: 'Norte', apellidos: '', nombre: '', cargo: 'Cajero Principal — Caja 02', fechaInicio: '2022-08-15', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: 'PR-2024-NOM', codigoMonedaRemuneracion: 'MXN', productoFacturable: 'N/A', descripcion: 'Operación de caja 02, recepción de pagos y dispersiones.' },
];

// ═══════════════════════════════════════════════════════════════════
// PERSISTENCIA
// ═══════════════════════════════════════════════════════════════════
const STORAGE_KEY_PT = 'config_puestos_data';
function loadDataPT(): PuestoTrabajo[] { try { const r = sessionStorage.getItem(STORAGE_KEY_PT); if (r) return JSON.parse(r); } catch {} return PUESTOS_DATA; }
function saveDataPT(d: PuestoTrabajo[]) { try { sessionStorage.setItem(STORAGE_KEY_PT, JSON.stringify(d)); } catch {} }

// ═══════════════════════════════════════════════════════════════════
// OPCIONES
// ═══════════════════════════════════════════════════════════════════
const SUCURSAL_OPTIONS = [
  { value: 'Querétaro', label: 'Querétaro' }, { value: 'Monterrey', label: 'Monterrey' },
  { value: 'Ciudad de México', label: 'Ciudad de México' }, { value: 'Guadalajara', label: 'Guadalajara' }, { value: 'Toluca', label: 'Toluca' },
];
const TIPO_PUESTO_OPTIONS = [
  { value: 'Administrativo', label: 'Administrativo' }, { value: 'Operativo', label: 'Operativo' },
  { value: 'Especialista', label: 'Especialista' }, { value: 'Gerencial', label: 'Gerencial' }, { value: 'Directivo', label: 'Directivo' },
];
const MONEDA_OPTIONS = [{ value: 'MXN', label: 'MXN' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }];
const TERRITORIO_OPTIONS = [
  { value: 'Centro', label: 'Centro' }, { value: 'Norte', label: 'Norte' }, { value: 'Occidente', label: 'Occidente' },
  { value: 'Golfo', label: 'Golfo' }, { value: 'Noroeste', label: 'Noroeste' }, { value: 'Sur', label: 'Sur' },
];

// ═══════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════
function buildTree(data: PuestoTrabajo[]): TreeNode[] {
  const map = new Map<number, TreeNode>(); const roots: TreeNode[] = [];
  data.forEach((p) => map.set(p.id, { puesto: p, children: [] }));
  data.forEach((p) => { const n = map.get(p.id)!; if (p.puestoSuperiorId && map.has(p.puestoSuperiorId)) map.get(p.puestoSuperiorId)!.children.push(n); else roots.push(n); });
  return roots;
}

function generateNextRowId(data: PuestoTrabajo[]): string {
  const nums = data.map((d) => { const m = d.rowIdBase.match(/RID-(\d+)/); return m ? parseInt(m[1], 10) : 0; });
  return `RID-${String(Math.max(0, ...nums) + 1).padStart(5, '0')}`;
}

function emptyPuesto(): Omit<PuestoTrabajo, 'id'> {
  return { rowIdBase: '', puestoTrabajo: '', parentPositionId: '', puestoSuperiorId: null, puestoSuperiorNombre: '', rowIdAbuelo: '', positionNameAbuelo: '', tipoPuesto: '', sucursal: '', territorio: '', apellidos: '', nombre: '', cargo: '', fechaInicio: '', fechaFinal: '', remunerable: true, lanzamientoPlanRemuneracion: '', codigoMonedaRemuneracion: 'MXN', productoFacturable: '', descripcion: '' };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTACIÓN
// ═══════════════════════════════════════════════════════════════════
function exportExcelPT(data: PuestoTrabajo[]) {
  const rows = data.map((d) => ({ 'Row ID': d.rowIdBase, 'Puesto': d.puestoTrabajo, 'Superior': d.puestoSuperiorNombre, 'Tipo': d.tipoPuesto, 'Sucursal': d.sucursal, 'Territorio': d.territorio, 'Apellidos': d.apellidos, 'Nombre': d.nombre, 'Cargo': d.cargo }));
  const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Puestos'); XLSX.writeFile(wb, 'puestos_trabajo.xlsx'); toast.success('Exportado a Excel');
}
function exportCSVPT(data: PuestoTrabajo[]) {
  const rows = data.map((d) => ({ 'Puesto': d.puestoTrabajo, 'Superior': d.puestoSuperiorNombre, 'Tipo': d.tipoPuesto, 'Sucursal': d.sucursal, 'Apellidos': d.apellidos, 'Nombre': d.nombre }));
  const ws = XLSX.utils.json_to_sheet(rows); const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'puestos_trabajo.csv'; link.click(); toast.success('Exportado a CSV');
}
function exportPDFPT(data: PuestoTrabajo[]) {
  const doc = new jsPDF({ orientation: 'landscape' }); doc.setFontSize(14); doc.text('Puestos de Trabajo', 14, 18); doc.setFontSize(9); doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 14, 24);
  autoTable(doc, { startY: 30, head: [['Row ID', 'Puesto', 'Superior', 'Tipo', 'Sucursal', 'Territorio', 'Cargo']], body: data.map((d) => [d.rowIdBase, d.puestoTrabajo, d.puestoSuperiorNombre, d.tipoPuesto, d.sucursal, d.territorio, d.cargo]), styles: { fontSize: 7 }, headStyles: { fillColor: [74, 111, 165] }, alternateRowStyles: { fillColor: [245, 245, 245] } });
  doc.save('puestos_trabajo.pdf'); toast.success('Exportado a PDF');
}
function doPrintPT(data: PuestoTrabajo[]) {
  const html = `<html><head><title>Puestos de Trabajo</title><style>body{font-family:Arial;font-size:11px;margin:20px}h2{color:#4A6FA5}table{border-collapse:collapse;width:100%}th{background:#4A6FA5;color:#fff;padding:6px 8px;text-align:left;font-size:10px}td{padding:4px 8px;border-bottom:1px solid #ddd;font-size:10px}tr:nth-child(even){background:#f5f5f5}</style></head><body><h2>Puestos de Trabajo</h2><table><tr><th>Puesto</th><th>Superior</th><th>Tipo</th><th>Sucursal</th><th>Apellidos</th><th>Nombre</th><th>Cargo</th></tr>${data.map((d) => `<tr><td>${d.puestoTrabajo}</td><td>${d.puestoSuperiorNombre}</td><td>${d.tipoPuesto}</td><td>${d.sucursal}</td><td>${d.apellidos}</td><td>${d.nombre}</td><td>${d.cargo}</td></tr>`).join('')}</table></body></html>`;
  const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
}

// ═══════════════════════════════════════════════════════════════════
// ÁRBOL JERÁRQUICO (Org Chart) — preservado
// ═══════════════════════════════════════════════════════════════════
interface HierarchyNode { name: string; sucursal?: string; tipoPuesto?: string; isVirtual: boolean; children: HierarchyNode[]; }

function buildFullHierarchy(data: PuestoTrabajo[]): HierarchyNode[] {
  const superiorGroups = new Map<string, PuestoTrabajo[]>();
  data.forEach((p) => { const k = p.puestoSuperiorNombre; if (!superiorGroups.has(k)) superiorGroups.set(k, []); superiorGroups.get(k)!.push(p); });
  const actualNodes = new Map<string, HierarchyNode>();
  data.forEach((p) => { actualNodes.set(p.puestoTrabajo, { name: p.puestoTrabajo, sucursal: p.sucursal, tipoPuesto: p.tipoPuesto, isVirtual: false, children: [] }); });
  data.forEach((p) => { if (p.puestoSuperiorId) { const parent = data.find((d) => d.id === p.puestoSuperiorId); if (parent) actualNodes.get(parent.puestoTrabajo)!.children.push(actualNodes.get(p.puestoTrabajo)!); } });
  const virtualRoots: HierarchyNode[] = [];
  superiorGroups.forEach((puestos, superiorName) => {
    if (actualNodes.has(superiorName)) return;
    const vn: HierarchyNode = { name: superiorName, isVirtual: true, children: [] };
    puestos.forEach((p) => { if (!p.puestoSuperiorId) vn.children.push(actualNodes.get(p.puestoTrabajo)!); });
    if (vn.children.length > 0) virtualRoots.push(vn);
  });
  return virtualRoots;
}

function OrgChartNode({ node }: { node: HierarchyNode }) {
  const hasChildren = node.children.length > 0;
  return (
    <div className="flex flex-col items-center">
      <div className={`relative px-3 py-2 rounded-lg border-2 min-w-[160px] max-w-[200px] text-center shadow-sm transition-all ${node.isVirtual ? 'bg-primary-theme border-primary-theme text-white' : 'bg-white border-primary-theme-40 text-gray-800 hover:border-primary-theme hover:shadow-md'}`}>
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          {node.isVirtual ? <Users size={11} className="text-white/80 flex-shrink-0" /> : <Briefcase size={11} className="text-primary-theme flex-shrink-0" />}
          <span className="text-[10px] truncate" style={{ fontWeight: 600 }} title={node.name}>{node.name}</span>
        </div>
        {!node.isVirtual && node.sucursal && <div className="flex items-center justify-center gap-1 text-[9px] text-gray-500"><Building2 size={8} className="flex-shrink-0" /><span>{node.sucursal}</span></div>}
        {!node.isVirtual && node.tipoPuesto && <div className="mt-0.5"><span className="inline-block px-1.5 py-0 rounded-full bg-primary-theme-10 text-primary-theme text-[8px]">{node.tipoPuesto}</span></div>}
        {node.isVirtual && <div className="text-[8px] text-white/60 mt-0.5">Superior (no registrado)</div>}
      </div>
      {hasChildren && (
        <>
          <div className="w-px h-5 bg-primary-theme-40" />
          {node.children.length === 1 ? <OrgChartNode node={node.children[0]} /> : (
            <div className="relative">
              <div className="absolute top-0 h-px bg-primary-theme-40" style={{ left: `calc(${(100 / node.children.length) * 0.5}%)`, right: `calc(${(100 / node.children.length) * 0.5}%)` }} />
              <div className="flex items-start gap-4">
                {node.children.map((c, i) => <div key={`${c.name}-${i}`} className="flex flex-col items-center"><div className="w-px h-5 bg-primary-theme-40" /><OrgChartNode node={c} /></div>)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HierarchyModal({ data, onClose }: { data: PuestoTrabajo[]; onClose: () => void }) {
  const hierarchy = useMemo(() => buildFullHierarchy(data), [data]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl flex flex-col" style={{ width: '92vw', maxWidth: '1300px', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 bg-primary-theme rounded-t-lg">
          <div className="flex items-center gap-2"><GitBranch size={16} className="text-white" /><span className="text-white text-sm" style={{ fontWeight: 600 }}>Relaciones Jerárquicas — Puestos de Trabajo</span></div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-0.5 rounded hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="px-5 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-6 text-[10px] text-gray-500">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary-theme border border-primary-theme" /><span>Superior (virtual)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-white border-2 border-primary-theme-40" /><span>Puesto registrado</span></div>
          <div className="flex items-center gap-1.5"><div className="w-6 h-px bg-primary-theme-40" /><span>Relación jerárquica</span></div>
          <div className="ml-auto text-gray-400">{data.length} puestos &bull; {hierarchy.length} ramas</div>
        </div>
        <div className="flex-1 overflow-auto p-6"><div className="flex flex-wrap items-start justify-center gap-8">{hierarchy.map((r, i) => <OrgChartNode key={`${r.name}-${i}`} node={r} />)}</div></div>
        <div className="px-5 py-2.5 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end"><button onClick={onClose} className="px-4 py-1.5 text-xs btn-primary-theme text-white rounded">Cerrar</button></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES UI REUTILIZABLES
// ═══════════════════════════════════════════════════════════════════
function TreeNodeItem({ node, level, selectedId, expandedIds, onSelect, onToggle }: {
  node: TreeNode; level: number; selectedId: number | null; expandedIds: Set<number>;
  onSelect: (id: number) => void; onToggle: (id: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.puesto.id);
  const isSelected = selectedId === node.puesto.id;
  return (
    <div>
      <div className={`flex items-center gap-1 py-1 px-1 cursor-pointer rounded transition-colors text-xs ${isSelected ? 'bg-primary-theme text-white' : 'hover:bg-primary-theme-10 text-gray-700'}`}
        style={{ paddingLeft: `${level * 16 + 4}px` }} onClick={() => { onSelect(node.puesto.id); if (hasChildren) onToggle(node.puesto.id); }}>
        {hasChildren ? <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span> : <span className="flex-shrink-0 w-4 h-4" />}
        <Briefcase size={12} className={`flex-shrink-0 ${isSelected ? 'text-white' : 'text-primary-theme'}`} />
        <span className="truncate">{node.puesto.puestoTrabajo}</span>
      </div>
      {hasChildren && isExpanded && <div>{node.children.map((c) => <TreeNodeItem key={c.puesto.id} node={c} level={level + 1} selectedId={selectedId} expandedIds={expandedIds} onSelect={onSelect} onToggle={onToggle} />)}</div>}
    </div>
  );
}

const FormFieldPT = React.memo(function FormFieldPT({ label, value, name, required, type = 'text', options, checked, readOnly, onChange, onCheck }: {
  label: string; value?: string; name?: string; required?: boolean;
  type?: 'text' | 'select' | 'checkbox' | 'date'; options?: { value: string; label: string }[];
  checked?: boolean; readOnly?: boolean;
  onChange?: (n: string, v: string) => void; onCheck?: (n: string, c: boolean) => void;
}) {
  const editable = !!onChange && !readOnly;
  const checkEditable = !!onCheck && !readOnly;
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-gray-600 w-[160px] flex-shrink-0 text-right">{label}{required && <span className="text-red-500 ml-0.5">*</span>}{':'}</label>
      {type === 'checkbox' ? (
        <input type="checkbox" checked={checked} readOnly={!checkEditable} onChange={checkEditable ? (e) => onCheck!(name!, e.target.checked) : undefined} className="h-3.5 w-3.5 accent-primary-theme" />
      ) : type === 'select' ? (
        <select value={String(value ?? '')} disabled={!editable} onChange={editable ? (e) => onChange!(name!, e.target.value) : undefined}
          className={`flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 ${editable ? 'focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none' : 'disabled:bg-gray-50'}`}>
          <option value="">-- Seleccionar --</option>{options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'date' ? (
        <input type="date" value={value ?? ''} readOnly={!editable} onChange={editable ? (e) => onChange!(name!, e.target.value) : undefined}
          className={`flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 ${editable ? 'focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none' : 'read-only:bg-gray-50'}`} />
      ) : (
        <input type="text" value={value ?? ''} readOnly={!editable} onChange={editable ? (e) => onChange!(name!, e.target.value) : undefined}
          className={`flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 ${editable ? 'focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none' : 'read-only:bg-gray-50'}`} />
      )}
    </div>
  );
});

function ExportMenuPT({ data, onClose }: { data: PuestoTrabajo[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); } document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [onClose]);
  const items = [
    { icon: <FileSpreadsheet size={12} className="text-green-600" />, label: 'Exportar a Excel', action: () => { exportExcelPT(data); onClose(); } },
    { icon: <FileText size={12} className="text-blue-600" />, label: 'Exportar a CSV', action: () => { exportCSVPT(data); onClose(); } },
    { icon: <FileDown size={12} className="text-red-600" />, label: 'Exportar a PDF', action: () => { exportPDFPT(data); onClose(); } },
    { icon: <Printer size={12} className="text-gray-600" />, label: 'Imprimir', action: () => { doPrintPT(data); onClose(); } },
  ];
  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 py-1 min-w-[180px]">
      {items.map((i) => <button key={i.label} onClick={i.action} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-primary-theme-10 text-left">{i.icon}{i.label}</button>)}
    </div>
  );
}

function DeleteConfirmPT({ puesto, childCount, onConfirm, onCancel }: { puesto: PuestoTrabajo; childCount: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-2xl w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white"><AlertTriangle size={16} /><span className="text-sm" style={{ fontWeight: 600 }}>Confirmar eliminación</span></div>
        <div className="p-5">
          <p className="text-xs text-gray-700 mb-2">¿Está seguro de eliminar el puesto de trabajo?</p>
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-3"><p className="text-[11px] text-gray-800" style={{ fontWeight: 600 }}>{puesto.puestoTrabajo}</p><p className="text-[10px] text-gray-500 mt-0.5">{puesto.rowIdBase} &bull; {puesto.tipoPuesto}</p></div>
          {childCount > 0 && <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-2.5 mb-3"><AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" /><p className="text-[10px] text-amber-800">Tiene <span style={{ fontWeight: 600 }}>{childCount} puesto(s) subordinado(s)</span> que también serán eliminados.</p></div>}
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

function CreateModalPT({ nextRowId, puestoOptions, onSave, onCancel }: {
  nextRowId: string; puestoOptions: { value: string; label: string }[];
  onSave: (p: Omit<PuestoTrabajo, 'id'>) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<PuestoTrabajo, 'id'>>({ ...emptyPuesto(), rowIdBase: nextRowId });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const handleChange = useCallback((n: string, v: string) => {
    setForm((p) => { if (n === 'puestoSuperiorId') return { ...p, puestoSuperiorId: v ? parseInt(v, 10) : null }; return { ...p, [n]: v }; });
    setErrors((p) => ({ ...p, [n]: false }));
  }, []);
  const handleCheck = useCallback((n: string, c: boolean) => { setForm((p) => ({ ...p, [n]: c })); }, []);
  const handleSave = () => {
    const req: (keyof typeof form)[] = ['puestoTrabajo', 'sucursal', 'tipoPuesto'];
    const ne: Record<string, boolean> = {};
    req.forEach((f) => { if (!form[f]) ne[f] = true; });
    if (Object.keys(ne).length > 0) { setErrors(ne); toast.error('Complete los campos obligatorios'); return; }
    onSave(form);
  };
  const fld = (label: string, name: string, opts?: { required?: boolean; type?: 'text' | 'select' | 'checkbox' | 'date'; options?: { value: string; label: string }[] }) => {
    const o = opts ?? {};
    return (
      <div className="flex items-center gap-2">
        <label className={`text-[11px] w-[160px] flex-shrink-0 text-right ${errors[name] ? 'text-red-600' : 'text-gray-600'}`}>{label}{o.required && <span className="text-red-500 ml-0.5">*</span>}{':'}</label>
        {o.type === 'checkbox' ? <input type="checkbox" checked={(form as any)[name] as boolean} onChange={(e) => handleCheck(name, e.target.checked)} className="h-3.5 w-3.5 accent-primary-theme" />
        : o.type === 'select' ? <select value={String((form as any)[name] ?? '')} onChange={(e) => handleChange(name, e.target.value)} className={`flex-1 text-[11px] px-1.5 py-1 border rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none ${errors[name] ? 'border-red-400' : 'border-gray-300'}`}><option value="">-- Seleccionar --</option>{o.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
        : o.type === 'date' ? <input type="date" value={String((form as any)[name] ?? '')} onChange={(e) => handleChange(name, e.target.value)} className={`flex-1 text-[11px] px-1.5 py-1 border rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none ${errors[name] ? 'border-red-400' : 'border-gray-300'}`} />
        : <input type="text" value={String((form as any)[name] ?? '')} onChange={(e) => handleChange(name, e.target.value)} className={`flex-1 text-[11px] px-1.5 py-1 border rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none ${errors[name] ? 'border-red-400' : 'border-gray-300'}`} />}
      </div>
    );
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-2xl flex flex-col" style={{ width: '780px', maxHeight: '88vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 bg-primary-theme rounded-t-lg">
          <div className="flex items-center gap-2"><Plus size={15} className="text-white" /><span className="text-white text-sm" style={{ fontWeight: 600 }}>Nuevo Puesto de Trabajo</span><span className="text-white/60 text-xs ml-2">{nextRowId}</span></div>
          <button onClick={onCancel} className="text-white/80 hover:text-white p-0.5 rounded hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
            <div className="col-span-2 mb-1"><div className="bg-primary-theme-10 border-l-4 border-primary-theme px-3 py-1.5 rounded-r inline-block"><span className="text-[11px] text-primary-theme" style={{ fontWeight: 600 }}>Datos principales</span></div></div>
            {fld('Row Id Base', 'rowIdBase')}
            {fld('Puesto de trabajo', 'puestoTrabajo', { required: true })}
            {fld('Tipo de puesto', 'tipoPuesto', { required: true, type: 'select', options: TIPO_PUESTO_OPTIONS })}
            {fld('Sucursal', 'sucursal', { required: true, type: 'select', options: SUCURSAL_OPTIONS })}
            {fld('Puesto superior', 'puestoSuperiorId', { type: 'select', options: puestoOptions })}
            {fld('Territorio', 'territorio', { type: 'select', options: TERRITORIO_OPTIONS })}
            {fld('Cargo', 'cargo')}
            {fld('Parent Position Id', 'parentPositionId')}
            <div className="col-span-2 mt-2 mb-1"><div className="bg-primary-theme-10 border-l-4 border-primary-theme px-3 py-1.5 rounded-r inline-block"><span className="text-[11px] text-primary-theme" style={{ fontWeight: 600 }}>Personal y remuneración</span></div></div>
            {fld('Apellidos', 'apellidos')}
            {fld('Nombre', 'nombre')}
            {fld('Fecha de inicio', 'fechaInicio', { type: 'date' })}
            {fld('Fecha final', 'fechaFinal', { type: 'date' })}
            {fld('Remunerable', 'remunerable', { type: 'checkbox' })}
            {fld('Cód. moneda remun.', 'codigoMonedaRemuneracion', { type: 'select', options: MONEDA_OPTIONS })}
            {fld('Producto facturable', 'productoFacturable')}
            {fld('Lanz. plan remun.', 'lanzamientoPlanRemuneracion')}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button onClick={onCancel} className="px-4 py-1.5 text-[11px] border border-gray-400 rounded bg-white hover:bg-gray-100 text-gray-700">Cancelar</button>
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-[#0099CC] text-white rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}><Save size={12} />Crear puesto</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function PuestosTrabajoSection() {
  const [data, setData] = useState<PuestoTrabajo[]>(loadDataPT);
  const [selectedId, setSelectedId] = useState<number | null>(() => { const d = loadDataPT(); return d.length > 0 ? d[0].id : null; });
  const [formData, setFormData] = useState<PuestoTrabajo | null>(() => { const d = loadDataPT(); return d.length > 0 ? { ...d[0] } : null; });
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set([9]));
  const [showHierarchyModal, setShowHierarchyModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PuestoTrabajo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => { saveDataPT(data); }, [data]);

  const tree = useMemo(() => buildTree(data), [data]);
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((p) => p.puestoTrabajo.toLowerCase().includes(q) || p.sucursal.toLowerCase().includes(q) || p.cargo.toLowerCase().includes(q) || p.apellidos.toLowerCase().includes(q));
  }, [data, searchQuery]);

  const handleToggle = useCallback((id: number) => { setExpandedIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);
  const handleSelect = useCallback((id: number) => { setSelectedId(id); const p = data.find((i) => i.id === id); if (p) setFormData({ ...p }); }, [data]);
  const handleFieldChange = useCallback((name: string, value: string) => {
    setFormData((p) => { if (!p) return p; if (name === 'puestoSuperiorId') return { ...p, puestoSuperiorId: value ? parseInt(value, 10) : null }; return { ...p, [name]: value }; });
  }, []);
  const handleCheckChange = useCallback((name: string, checked: boolean) => { setFormData((p) => p ? { ...p, [name]: checked } : p); }, []);

  const handleSaveForm = useCallback(() => { if (!formData) return; setData((p) => p.map((i) => i.id === formData.id ? { ...formData } : i)); toast.success('Cambios guardados', { description: `Puesto "${formData.puestoTrabajo}" actualizado.` }); }, [formData]);
  const handleResetForm = useCallback(() => { if (!selectedId) return; const o = data.find((i) => i.id === selectedId); if (o) { setFormData({ ...o }); toast.info('Cambios descartados'); } }, [data, selectedId]);

  const handleCreate = useCallback((pt: Omit<PuestoTrabajo, 'id'>) => {
    const newId = Math.max(0, ...data.map((d) => d.id)) + 1;
    const n: PuestoTrabajo = { ...pt, id: newId, puestoSuperiorId: pt.puestoSuperiorId ? Number(pt.puestoSuperiorId) : null };
    setData((p) => [...p, n]); setSelectedId(newId); setFormData({ ...n });
    if (n.puestoSuperiorId) setExpandedIds((p) => { const s = new Set(p); s.add(n.puestoSuperiorId!); return s; });
    setShowCreate(false); toast.success('Puesto creado', { description: `${n.puestoTrabajo} (${n.rowIdBase}) agregado.` });
  }, [data]);

  const getDescendantCount = useCallback((id: number): number => {
    const ch = data.filter((d) => d.puestoSuperiorId === id);
    return ch.reduce((a, c) => a + 1 + getDescendantCount(c.id), 0);
  }, [data]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    const toRm = new Set<number>();
    const collect = (id: number) => { toRm.add(id); data.filter((d) => d.puestoSuperiorId === id).forEach((d) => collect(d.id)); };
    collect(deleteTarget.id);
    setData((p) => p.filter((d) => !toRm.has(d.id)));
    const rem = data.filter((d) => !toRm.has(d.id));
    if (rem.length > 0) { setSelectedId(rem[0].id); setFormData({ ...rem[0] }); } else { setSelectedId(null); setFormData(null); }
    setDeleteTarget(null); toast.success('Puesto eliminado', { description: `"${deleteTarget.puestoTrabajo}" eliminado.` });
  }, [deleteTarget, data]);

  const puestoOptions = useMemo(() => data.map((p) => ({ value: String(p.id), label: p.puestoTrabajo })), [data]);
  const nextRowId = useMemo(() => generateNextRowId(data), [data]);

  return (
    <div className="flex h-[calc(100vh-160px)] bg-gray-100">
      {showHierarchyModal && <HierarchyModal data={data} onClose={() => setShowHierarchyModal(false)} />}
      {showCreate && <CreateModalPT nextRowId={nextRowId} puestoOptions={puestoOptions} onSave={handleCreate} onCancel={() => setShowCreate(false)} />}
      {deleteTarget && <DeleteConfirmPT puesto={deleteTarget} childCount={getDescendantCount(deleteTarget.id)} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />}

      {/* PANEL IZQUIERDO */}
      <div className="w-[260px] flex-shrink-0 border-r border-gray-300 bg-white flex flex-col">
        <div className="px-3 py-2 bg-primary-theme-10 border-b border-gray-300 flex items-center gap-2">
          <Briefcase size={14} className="text-primary-theme" />
          <span className="text-xs text-primary-theme" style={{ fontWeight: 600 }}>Puestos de Trabajo</span>
          <span className="text-[9px] text-primary-theme-60 ml-auto">{data.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {tree.map((n) => <TreeNodeItem key={n.puesto.id} node={n} level={0} selectedId={selectedId} expandedIds={expandedIds} onSelect={handleSelect} onToggle={handleToggle} />)}
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TABLA */}
        <div className="flex-shrink-0 border-b border-gray-300 bg-white flex flex-col">
          <div className="px-3 py-1.5 border-b border-gray-200 flex items-center gap-1 bg-gray-50 flex-wrap">
            <span className="text-xs text-primary-theme px-2 py-0.5 bg-primary-theme-10 rounded" style={{ fontWeight: 600 }}>Puestos de Trabajo</span>
            <div className="flex items-center gap-1 ml-3">
              <div className="relative">
                <button onClick={() => setShowMenu((p) => !p)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700"><Menu size={11} />Menu<ChevronDown size={10} /></button>
                {showMenu && <ExportMenuPT data={filteredData} onClose={() => setShowMenu(false)} />}
              </div>
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700"><Plus size={11} />Nuevo</button>
              <button onClick={() => { if (!selectedId) { toast.warning('Seleccione un puesto'); return; } const p = data.find((i) => i.id === selectedId); if (p) setDeleteTarget(p); }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700"><Trash2 size={11} />Eliminar</button>
              <button onClick={() => setShowSearch((p) => !p)} className={`flex items-center gap-1 px-2.5 py-1 text-[11px] border rounded ${showSearch ? 'border-primary-theme bg-primary-theme-10 text-primary-theme' : 'border-gray-300 bg-white hover:bg-gray-100 text-gray-700'}`}><Search size={11} />Consulta</button>
              <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-primary-theme rounded bg-primary-theme-10 hover:bg-primary-theme-40 text-primary-theme" onClick={() => setShowHierarchyModal(true)}><GitBranch size={11} />Relaciones jerárquicas</button>
            </div>
            {showSearch && (
              <div className="ml-2 flex items-center gap-1">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar..." className="text-[11px] px-2 py-1 border border-gray-300 rounded w-[200px] focus:border-primary-theme outline-none" autoFocus />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 p-0.5"><X size={12} /></button>}
                <span className="text-[10px] text-gray-400">{filteredData.length}/{data.length}</span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#D0D0D0]">
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Sucursal</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Puesto de trabajo</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Puesto superior</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Tipo</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Apellidos</th>
                  <th className="px-2 py-1.5 text-left text-gray-700 whitespace-nowrap">Nombre</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((p, i) => (
                  <tr key={p.id} onClick={() => handleSelect(p.id)} className={`cursor-pointer border-b border-gray-100 transition-colors ${selectedId === p.id ? 'bg-primary-theme text-white' : i % 2 === 0 ? 'bg-white hover:bg-blue-50/50' : 'bg-gray-50/50 hover:bg-blue-50/50'}`}>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{p.sucursal}</td>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{p.puestoTrabajo}</td>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{p.puestoSuperiorNombre}</td>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{p.tipoPuesto}</td>
                    <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{p.apellidos}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{p.nombre}</td>
                  </tr>
                ))}
                {filteredData.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No se encontraron puestos.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORMULARIO */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {formData ? (
            <div className="p-0">
              <div className="px-4 py-2 bg-primary-theme-10 border-b border-gray-300 flex items-center justify-between">
                <h3 className="text-sm text-primary-theme tracking-wide" style={{ fontWeight: 700 }}>{formData.puestoTrabajo}</h3>
                <span className="text-[10px] text-primary-theme-60">{formData.rowIdBase}</span>
              </div>
              <div className="p-4 bg-white mx-3 my-3 rounded border border-gray-200">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                  <FormFieldPT label="Row Id Base" name="rowIdBase" value={formData.rowIdBase} readOnly />
                  <FormFieldPT label="Apellidos" name="apellidos" value={formData.apellidos} onChange={handleFieldChange} />
                  <FormFieldPT label="Puesto de trabajo" name="puestoTrabajo" value={formData.puestoTrabajo} required onChange={handleFieldChange} />
                  <FormFieldPT label="Nombre" name="nombre" value={formData.nombre} onChange={handleFieldChange} />
                  <FormFieldPT label="Parent Position Id" name="parentPositionId" value={formData.parentPositionId} onChange={handleFieldChange} />
                  <FormFieldPT label="Cargo" name="cargo" value={formData.cargo} onChange={handleFieldChange} />
                  <FormFieldPT label="Puesto superior" name="puestoSuperiorId" value={formData.puestoSuperiorId ? String(formData.puestoSuperiorId) : ''} type="select" options={puestoOptions} onChange={handleFieldChange} />
                  <FormFieldPT label="Fecha de inicio" name="fechaInicio" value={formData.fechaInicio} type="date" onChange={handleFieldChange} />
                  <FormFieldPT label="Row Id Abuelo" name="rowIdAbuelo" value={formData.rowIdAbuelo} onChange={handleFieldChange} />
                  <FormFieldPT label="Fecha final" name="fechaFinal" value={formData.fechaFinal} type="date" onChange={handleFieldChange} />
                  <FormFieldPT label="Position Name Abuelo" name="positionNameAbuelo" value={formData.positionNameAbuelo} onChange={handleFieldChange} />
                  <FormFieldPT label="Remunerable" name="remunerable" type="checkbox" checked={formData.remunerable} onCheck={handleCheckChange} />
                  <FormFieldPT label="Tipo de puesto" name="tipoPuesto" value={formData.tipoPuesto} type="select" options={TIPO_PUESTO_OPTIONS} required onChange={handleFieldChange} />
                  <FormFieldPT label="Lanz. plan remun." name="lanzamientoPlanRemuneracion" value={formData.lanzamientoPlanRemuneracion} onChange={handleFieldChange} />
                  <FormFieldPT label="Sucursal" name="sucursal" value={formData.sucursal} required type="select" options={SUCURSAL_OPTIONS} onChange={handleFieldChange} />
                  <FormFieldPT label="Cód. moneda remun." name="codigoMonedaRemuneracion" value={formData.codigoMonedaRemuneracion} type="select" options={MONEDA_OPTIONS} onChange={handleFieldChange} />
                  <FormFieldPT label="Territorio" name="territorio" value={formData.territorio} type="select" options={TERRITORIO_OPTIONS} onChange={handleFieldChange} />
                  <FormFieldPT label="Producto facturable" name="productoFacturable" value={formData.productoFacturable} onChange={handleFieldChange} />
                  <div className="col-span-2 border-t border-gray-100 my-1" />
                  <div className="col-span-2 flex items-start gap-2">
                    <label className="text-[11px] text-gray-600 w-[160px] flex-shrink-0 text-right pt-1">Descripción:</label>
                    <textarea value={formData.descripcion} onChange={(e) => handleFieldChange('descripcion', e.target.value)} rows={2}
                      className="flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 resize-none focus:border-primary-theme focus:ring-1 focus:ring-accent-theme outline-none" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200">
                  <button onClick={handleSaveForm} className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-[#0099CC] text-white rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}><Save size={12} />Guardar cambios</button>
                  <button onClick={handleResetForm} className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-white border border-gray-400 text-gray-700 rounded hover:bg-gray-50" style={{ fontWeight: 500 }}><RotateCcw size={12} />Descartar cambios</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Seleccione un puesto del árbol o la tabla para ver sus detalles</div>
          )}
        </div>
      </div>
    </div>
  );
}