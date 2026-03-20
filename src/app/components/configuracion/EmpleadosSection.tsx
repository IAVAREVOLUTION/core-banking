import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ChevronDown, Menu, Plus, Search, Trash2, UserCheck, Wifi, Save, RotateCcw, X,
  FileSpreadsheet, FileText, FileDown, Printer, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface Empleado {
  id: number; apellidoPaterno: string; apellidoMaterno: string; nombre: string;
  cargo: string; idUsuario: string; contrasena: string; confirmarContrasena: string;
  responsabilidad: string; puestoTrabajo: string; sucursal: string; tipoEmpleado: string;
  nombreCluster: string; indicadorIntegracion: boolean;
  srSra: string; alias: string; nombreCorto: string; noEmpleado: string;
  telefonoTrabajo: string; extension: string; buscapersonas: string; presencia: string;
  correoElectronico: string; telefonoMovil: string; fax: string; enLinea: boolean;
  direccionTrabajo: string; codigoPostal: string; ciudad: string; region: string;
  pais: string; compartirDireccion: boolean;
  zonaHoraria: string; nuevaResponsabilidad: string; division: string;
}

// ═══════════════════════════════════════════════════════════════════
// DATOS MOCK
// ═══════════════════════════════════════════════════════════════════
const EMPLEADOS_DATA: Empleado[] = [
  { id: 1, apellidoPaterno: 'ABOGADO', apellidoMaterno: 'ABOGADO', nombre: 'ABOGADO', cargo: 'ABOGADO', idUsuario: 'ABOGADO', contrasena: '', confirmarContrasena: '', responsabilidad: 'ESPECIALISTA', puestoTrabajo: 'NUEVO PUESTO', sucursal: 'MONTERREY', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sr.', alias: 'ABOGADO', nombreCorto: 'ABOGADO', noEmpleado: 'EMP-0101', telefonoTrabajo: '(81) 8234-5600', extension: '101', buscapersonas: '', presencia: 'Disponible', correoElectronico: 'abogado@mfm.com.mx', telefonoMovil: '(81) 1234-0001', fax: '(81) 8234-5601', enLinea: true, direccionTrabajo: 'Av. Vasconcelos 345, Col. Del Valle', codigoPostal: '66220', ciudad: 'Monterrey', region: 'Norte', pais: 'México', compartirDireccion: false, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: 'Jurídico' },
  { id: 2, apellidoPaterno: 'ACUÑA', apellidoMaterno: '', nombre: 'ARTURO', cargo: '', idUsuario: 'ACUNA', contrasena: '', confirmarContrasena: '', responsabilidad: 'Siebel Administrator', puestoTrabajo: 'Siebel Administrator', sucursal: 'DEFAULT ORGANIZATION', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sr.', alias: 'ACUNA', nombreCorto: 'A. ACUÑA', noEmpleado: 'EMP-0102', telefonoTrabajo: '(55) 5123-4500', extension: '200', buscapersonas: '', presencia: 'Disponible', correoElectronico: 'aacuna@mfm.com.mx', telefonoMovil: '(55) 1234-0002', fax: '', enLinea: false, direccionTrabajo: 'Av. Paseo de la Reforma 505', codigoPostal: '06500', ciudad: 'Ciudad de México', region: 'Centro', pais: 'México', compartirDireccion: false, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: 'Tecnología' },
  { id: 3, apellidoPaterno: 'AGUERRA', apellidoMaterno: '', nombre: 'AGUERRA', cargo: '', idUsuario: 'AGUERRA', contrasena: '', confirmarContrasena: '', responsabilidad: 'Siebel Administrator', puestoTrabajo: 'Siebel Administrator', sucursal: 'DEFAULT ORGANIZATION', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sr.', alias: 'AGUERRA', nombreCorto: 'AGUERRA', noEmpleado: 'EMP-0103', telefonoTrabajo: '(55) 5123-4500', extension: '201', buscapersonas: '', presencia: 'No disponible', correoElectronico: 'aguerra@mfm.com.mx', telefonoMovil: '', fax: '', enLinea: false, direccionTrabajo: 'Av. Paseo de la Reforma 505', codigoPostal: '06500', ciudad: 'Ciudad de México', region: 'Centro', pais: 'México', compartirDireccion: false, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: 'Tecnología' },
  { id: 4, apellidoPaterno: 'ANALISTA', apellidoMaterno: 'ANALISTA', nombre: 'ANALISTA', cargo: '', idUsuario: 'ANALISTA_01', contrasena: '', confirmarContrasena: '', responsabilidad: 'ANALISTA CREDITO TRADICIONAL', puestoTrabajo: 'COORDINADOR DE ANALISIS DE CRED', sucursal: 'DEFAULT ORGANIZATION', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sr.', alias: 'ANALISTA01', nombreCorto: 'ANALISTA', noEmpleado: 'EMP-0104', telefonoTrabajo: '(442) 678-9000', extension: '310', buscapersonas: '', presencia: 'Disponible', correoElectronico: 'analista01@mfm.com.mx', telefonoMovil: '(442) 1234-0004', fax: '', enLinea: true, direccionTrabajo: 'Blvd. Bernardo Quintana 300', codigoPostal: '76140', ciudad: 'Querétaro', region: 'Centro', pais: 'México', compartirDireccion: false, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: 'Crédito' },
  { id: 5, apellidoPaterno: 'ANALISTA', apellidoMaterno: 'DEMO', nombre: 'DEMO', cargo: 'ANALISTA', idUsuario: 'ANALISTADEMO', contrasena: '', confirmarContrasena: '', responsabilidad: 'ANALISTA CREDITO TRADICIONAL', puestoTrabajo: 'ANALISTA DE CREDITO AGRONEGOCIOS', sucursal: 'DEFAULT ORGANIZATION', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sr.', alias: 'ANALISTADEMO', nombreCorto: 'DEMO A.', noEmpleado: 'EMP-0105', telefonoTrabajo: '(442) 678-9000', extension: '311', buscapersonas: '', presencia: 'Disponible', correoElectronico: 'analistademo@mfm.com.mx', telefonoMovil: '', fax: '', enLinea: true, direccionTrabajo: 'Blvd. Bernardo Quintana 300', codigoPostal: '76140', ciudad: 'Querétaro', region: 'Centro', pais: 'México', compartirDireccion: false, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: 'Crédito' },
  { id: 6, apellidoPaterno: 'ARZATE', apellidoMaterno: 'DATOLI', nombre: 'OMAR', cargo: '', idUsuario: 'OARZATE', contrasena: '', confirmarContrasena: '', responsabilidad: 'Siebel Administrator', puestoTrabajo: 'Siebel Administrator', sucursal: 'DEFAULT ORGANIZATION', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sr.', alias: 'OARZATE', nombreCorto: 'O. ARZATE', noEmpleado: 'EMP-0106', telefonoTrabajo: '(55) 5123-4500', extension: '205', buscapersonas: '', presencia: 'Disponible', correoElectronico: 'oarzate@mfm.com.mx', telefonoMovil: '(55) 1234-0006', fax: '', enLinea: false, direccionTrabajo: 'Av. Paseo de la Reforma 505', codigoPostal: '06500', ciudad: 'Ciudad de México', region: 'Centro', pais: 'México', compartirDireccion: true, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: 'Tecnología' },
  { id: 7, apellidoPaterno: 'AVELAR', apellidoMaterno: 'SANCHEZ', nombre: 'MANUEL ISAAC', cargo: '', idUsuario: 'IAVELAR', contrasena: '', confirmarContrasena: '', responsabilidad: 'Siebel Administrator', puestoTrabajo: 'Siebel Administrator', sucursal: 'DEFAULT ORGANIZATION', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sr.', alias: 'IAVELAR', nombreCorto: 'M. AVELAR', noEmpleado: 'EMP-0107', telefonoTrabajo: '(55) 5123-4500', extension: '206', buscapersonas: '', presencia: 'No disponible', correoElectronico: 'iavelar@mfm.com.mx', telefonoMovil: '(55) 1234-0007', fax: '', enLinea: false, direccionTrabajo: 'Av. Paseo de la Reforma 505', codigoPostal: '06500', ciudad: 'Ciudad de México', region: 'Centro', pais: 'México', compartirDireccion: false, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: 'Tecnología' },
  { id: 8, apellidoPaterno: 'Administrator', apellidoMaterno: '', nombre: 'Siebel', cargo: 'Sys Admin', idUsuario: 'SADMIN', contrasena: '', confirmarContrasena: '', responsabilidad: 'TODO DEL SISTEMA', puestoTrabajo: 'Siebel Administrator', sucursal: 'DEFAULT ORGANIZATION', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sr.', alias: 'SADMIN', nombreCorto: 'S. ADMIN', noEmpleado: 'EMP-0108', telefonoTrabajo: '(55) 5123-4500', extension: '100', buscapersonas: '', presencia: 'Disponible', correoElectronico: 'sadmin@mfm.com.mx', telefonoMovil: '(55) 1234-0008', fax: '(55) 5123-4501', enLinea: true, direccionTrabajo: 'Av. Paseo de la Reforma 505', codigoPostal: '06500', ciudad: 'Ciudad de México', region: 'Centro', pais: 'México', compartirDireccion: false, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: 'Tecnología' },
  { id: 9, apellidoPaterno: 'BOX', apellidoMaterno: '', nombre: 'PANDORA', cargo: '', idUsuario: 'PANDORA', contrasena: '', confirmarContrasena: '', responsabilidad: 'Solicitudes Promoción - SIEC', puestoTrabajo: 'PANDORA BOX', sucursal: 'DEFAULT ORGANIZATION', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sra.', alias: 'PANDORA', nombreCorto: 'P. BOX', noEmpleado: 'EMP-0109', telefonoTrabajo: '(55) 5123-4500', extension: '350', buscapersonas: '', presencia: 'Disponible', correoElectronico: 'pandora@mfm.com.mx', telefonoMovil: '', fax: '', enLinea: false, direccionTrabajo: 'Av. Paseo de la Reforma 505', codigoPostal: '06500', ciudad: 'Ciudad de México', region: 'Centro', pais: 'México', compartirDireccion: false, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: 'Comercial' },
  { id: 10, apellidoPaterno: 'CABRERA', apellidoMaterno: 'VLADÉS', nombre: 'LIC. ADRIANA', cargo: '', idUsuario: 'DIR-OPER', contrasena: '', confirmarContrasena: '', responsabilidad: 'COMITE DE CREDITO', puestoTrabajo: 'DIRECTOR DE OPERACIONES MTY', sucursal: 'DEFAULT ORGANIZATION', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sra.', alias: 'DIR-OPER', nombreCorto: 'A. CABRERA', noEmpleado: 'EMP-0110', telefonoTrabajo: '(81) 8234-5600', extension: '400', buscapersonas: '', presencia: 'Disponible', correoElectronico: 'acabrera@mfm.com.mx', telefonoMovil: '(81) 1234-0010', fax: '(81) 8234-5601', enLinea: true, direccionTrabajo: 'Av. Vasconcelos 345, Col. Del Valle', codigoPostal: '66220', ciudad: 'Monterrey', region: 'Norte', pais: 'México', compartirDireccion: true, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: 'Operaciones' },
];

// ═══════════════════════════════════════════════════════════════════
// PERSISTENCIA
// ═══════════════════════════════════════════════════════════════════
const STORAGE_KEY_EMP = 'config_empleados_data';
function loadDataEmp(): Empleado[] { try { const r = sessionStorage.getItem(STORAGE_KEY_EMP); if (r) return JSON.parse(r); } catch {} return EMPLEADOS_DATA; }
function saveDataEmp(d: Empleado[]) { try { sessionStorage.setItem(STORAGE_KEY_EMP, JSON.stringify(d)); } catch {} }

function generateNextEmpNo(data: Empleado[]): string {
  const nums = data.map((d) => { const m = d.noEmpleado.match(/EMP-(\d+)/); return m ? parseInt(m[1], 10) : 0; });
  return `EMP-${String(Math.max(0, ...nums) + 1).padStart(4, '0')}`;
}

function emptyEmpleado(): Omit<Empleado, 'id'> {
  return { apellidoPaterno: '', apellidoMaterno: '', nombre: '', cargo: '', idUsuario: '', contrasena: '', confirmarContrasena: '', responsabilidad: '', puestoTrabajo: '', sucursal: 'DEFAULT ORGANIZATION', tipoEmpleado: 'Empleado', nombreCluster: '', indicadorIntegracion: false, srSra: 'Sr.', alias: '', nombreCorto: '', noEmpleado: '', telefonoTrabajo: '', extension: '', buscapersonas: '', presencia: 'Disponible', correoElectronico: '', telefonoMovil: '', fax: '', enLinea: false, direccionTrabajo: '', codigoPostal: '', ciudad: '', region: '', pais: 'México', compartirDireccion: false, zonaHoraria: '(GMT-06:00) América/Ciudad de México', nuevaResponsabilidad: '', division: '' };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTACIÓN
// ═══════════════════════════════════════════════════════════════════
function exportExcelEmp(data: Empleado[]) {
  const rows = data.map((d) => ({ 'No': d.noEmpleado, 'Ap. Paterno': d.apellidoPaterno, 'Ap. Materno': d.apellidoMaterno, 'Nombre': d.nombre, 'Cargo': d.cargo, 'ID Usuario': d.idUsuario, 'Responsabilidad': d.responsabilidad, 'Sucursal': d.sucursal, 'Correo': d.correoElectronico }));
  const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Empleados'); XLSX.writeFile(wb, 'empleados.xlsx'); toast.success('Exportado a Excel');
}
function exportCSVEmp(data: Empleado[]) {
  const rows = data.map((d) => ({ 'No': d.noEmpleado, 'Ap. Paterno': d.apellidoPaterno, 'Nombre': d.nombre, 'ID Usuario': d.idUsuario, 'Correo': d.correoElectronico, 'Sucursal': d.sucursal }));
  const ws = XLSX.utils.json_to_sheet(rows); const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'empleados.csv'; link.click(); toast.success('Exportado a CSV');
}
function exportPDFEmp(data: Empleado[]) {
  const doc = new jsPDF({ orientation: 'landscape' }); doc.setFontSize(14); doc.text('Empleados', 14, 18); doc.setFontSize(9); doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 14, 24);
  autoTable(doc, { startY: 30, head: [['No', 'Ap. Paterno', 'Nombre', 'Cargo', 'ID Usuario', 'Responsabilidad', 'Sucursal', 'Correo']], body: data.map((d) => [d.noEmpleado, d.apellidoPaterno, d.nombre, d.cargo, d.idUsuario, d.responsabilidad, d.sucursal, d.correoElectronico]), styles: { fontSize: 7 }, headStyles: { fillColor: [74, 111, 165] }, alternateRowStyles: { fillColor: [245, 245, 245] } });
  doc.save('empleados.pdf'); toast.success('Exportado a PDF');
}
function doPrintEmp(data: Empleado[]) {
  const html = `<html><head><title>Empleados</title><style>body{font-family:Arial;font-size:11px;margin:20px}h2{color:#4A6FA5}table{border-collapse:collapse;width:100%}th{background:#4A6FA5;color:#fff;padding:6px 8px;text-align:left;font-size:10px}td{padding:4px 8px;border-bottom:1px solid #ddd;font-size:10px}tr:nth-child(even){background:#f5f5f5}</style></head><body><h2>Empleados</h2><table><tr><th>No</th><th>Ap. Paterno</th><th>Nombre</th><th>Cargo</th><th>ID Usuario</th><th>Responsabilidad</th><th>Sucursal</th></tr>${data.map((d) => `<tr><td>${d.noEmpleado}</td><td>${d.apellidoPaterno}</td><td>${d.nombre}</td><td>${d.cargo}</td><td>${d.idUsuario}</td><td>${d.responsabilidad}</td><td>${d.sucursal}</td></tr>`).join('')}</table></body></html>`;
  const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
}

// ═══════════════════════════════════════════════════════════════════
// OPCIONES
// ═══════════════════════════════════════════════════════════════════
const SR_SRA_OPTIONS = [{ value: 'Sr.', label: 'Sr.' }, { value: 'Sra.', label: 'Sra.' }, { value: 'Lic.', label: 'Lic.' }, { value: 'Ing.', label: 'Ing.' }, { value: 'Dr.', label: 'Dr.' }];
const REGION_OPTIONS = [{ value: 'Centro', label: 'Centro' }, { value: 'Norte', label: 'Norte' }, { value: 'Noroeste', label: 'Noroeste' }, { value: 'Occidente', label: 'Occidente' }, { value: 'Golfo', label: 'Golfo' }, { value: 'Sur', label: 'Sur' }];
const PAIS_OPTIONS = [{ value: 'México', label: 'México' }, { value: 'Estados Unidos', label: 'Estados Unidos' }];
const ZONA_HORARIA_OPTIONS = [{ value: '(GMT-06:00) América/Ciudad de México', label: '(GMT-06:00) América/Ciudad de México' }, { value: '(GMT-07:00) América/Chihuahua', label: '(GMT-07:00) América/Chihuahua' }, { value: '(GMT-08:00) América/Tijuana', label: '(GMT-08:00) América/Tijuana' }, { value: '(GMT-05:00) América/Cancún', label: '(GMT-05:00) América/Cancún' }];
const PRESENCIA_OPTIONS = [{ value: 'Disponible', label: 'Disponible' }, { value: 'No disponible', label: 'No disponible' }, { value: 'Ausente', label: 'Ausente' }, { value: 'Ocupado', label: 'Ocupado' }];
const TIPO_EMPLEADO_OPTIONS = [{ value: 'Empleado', label: 'Empleado' }, { value: 'Contratista', label: 'Contratista' }, { value: 'Temporal', label: 'Temporal' }];

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES UI
// ═══════════════════════════════════════════════════════════════════
const FormFieldEmp = React.memo(function FormFieldEmp({ label, value, name, required, type = 'text', options, checked, onChange, onCheck, inputType }: {
  label: string; value?: string; name: string; required?: boolean;
  type?: 'text' | 'select' | 'checkbox' | 'date' | 'password'; options?: { value: string; label: string }[];
  checked?: boolean; onChange?: (n: string, v: string) => void; onCheck?: (n: string, c: boolean) => void; inputType?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-gray-600 w-[145px] flex-shrink-0 text-right">{label}{required && <span className="text-red-500 ml-0.5">*</span>}{':'}</label>
      {type === 'checkbox' ? <input type="checkbox" checked={checked} onChange={(e) => onCheck?.(name, e.target.checked)} className="h-3.5 w-3.5 accent-primary-theme" />
      : type === 'select' ? <select value={String(value ?? '')} onChange={(e) => onChange?.(name, e.target.value)} className="flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-primary-theme/30 outline-none"><option value="">-- Seleccionar --</option>{options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      : type === 'date' ? <input type="date" value={value ?? ''} onChange={(e) => onChange?.(name, e.target.value)} className="flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-primary-theme/30 outline-none" />
      : <input type={type === 'password' ? 'password' : inputType ?? 'text'} value={value ?? ''} onChange={(e) => onChange?.(name, e.target.value)} className="flex-1 text-[11px] px-1.5 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-primary-theme/30 outline-none" />}
    </div>
  );
});

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="col-span-2 flex items-center gap-2 mt-2 mb-0.5">
      <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5 rounded-r"><span className="text-[11px] text-primary-theme" style={{ fontWeight: 600 }}>{title}</span></div>
      <div className="flex-1 border-t border-primary-theme/15" />
    </div>
  );
}

function ExportMenuEmp({ data, onClose }: { data: Empleado[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); } document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [onClose]);
  const items = [
    { icon: <FileSpreadsheet size={12} className="text-green-600" />, label: 'Exportar a Excel', action: () => { exportExcelEmp(data); onClose(); } },
    { icon: <FileText size={12} className="text-blue-600" />, label: 'Exportar a CSV', action: () => { exportCSVEmp(data); onClose(); } },
    { icon: <FileDown size={12} className="text-red-600" />, label: 'Exportar a PDF', action: () => { exportPDFEmp(data); onClose(); } },
    { icon: <Printer size={12} className="text-gray-600" />, label: 'Imprimir', action: () => { doPrintEmp(data); onClose(); } },
  ];
  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 py-1 min-w-[180px]">
      {items.map((i) => <button key={i.label} onClick={i.action} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-primary-tint-theme/60 text-left">{i.icon}{i.label}</button>)}
    </div>
  );
}

function DeleteConfirmEmp({ emp, onConfirm, onCancel }: { emp: Empleado; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-2xl w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white"><AlertTriangle size={16} /><span className="text-sm" style={{ fontWeight: 600 }}>Confirmar eliminación</span></div>
        <div className="p-5">
          <p className="text-xs text-gray-700 mb-2">¿Está seguro de eliminar el empleado?</p>
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-3"><p className="text-[11px] text-gray-800" style={{ fontWeight: 600 }}>{emp.apellidoPaterno} {emp.apellidoMaterno}, {emp.nombre}</p><p className="text-[10px] text-gray-500 mt-0.5">{emp.noEmpleado} &bull; {emp.idUsuario}</p></div>
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

function CreateModalEmp({ nextNo, puestoOptions, responsabilidadOptions, sucursalOptions, divisionOptions, onSave, onCancel }: {
  nextNo: string; puestoOptions: { value: string; label: string }[]; responsabilidadOptions: { value: string; label: string }[];
  sucursalOptions: { value: string; label: string }[]; divisionOptions: { value: string; label: string }[];
  onSave: (e: Omit<Empleado, 'id'>) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Empleado, 'id'>>({ ...emptyEmpleado(), noEmpleado: nextNo });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const handleChange = useCallback((n: string, v: string) => { setForm((p) => ({ ...p, [n]: v })); setErrors((p) => ({ ...p, [n]: false })); }, []);
  const handleCheck = useCallback((n: string, c: boolean) => { setForm((p) => ({ ...p, [n]: c })); }, []);
  const handleSave = () => {
    const req: (keyof typeof form)[] = ['apellidoPaterno', 'nombre', 'idUsuario'];
    const ne: Record<string, boolean> = {};
    req.forEach((f) => { if (!form[f]) ne[f] = true; });
    if (Object.keys(ne).length > 0) { setErrors(ne); toast.error('Complete los campos obligatorios'); return; }
    onSave(form);
  };
  const fld = (label: string, name: string, opts?: { required?: boolean; type?: 'text' | 'select' | 'checkbox' | 'password'; options?: { value: string; label: string }[] }) => {
    const o = opts ?? {};
    return (
      <div className="flex items-center gap-2">
        <label className={`text-[11px] w-[145px] flex-shrink-0 text-right ${errors[name] ? 'text-red-600' : 'text-gray-600'}`}>{label}{o.required && <span className="text-red-500 ml-0.5">*</span>}{':'}</label>
        {o.type === 'checkbox' ? <input type="checkbox" checked={(form as any)[name] as boolean} onChange={(e) => handleCheck(name, e.target.checked)} className="h-3.5 w-3.5 accent-primary-theme" />
        : o.type === 'select' ? <select value={String((form as any)[name] ?? '')} onChange={(e) => handleChange(name, e.target.value)} className={`flex-1 text-[11px] px-1.5 py-1 border rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-primary-theme/30 outline-none ${errors[name] ? 'border-red-400' : 'border-gray-300'}`}><option value="">-- Seleccionar --</option>{o.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
        : <input type={o.type === 'password' ? 'password' : 'text'} value={String((form as any)[name] ?? '')} onChange={(e) => handleChange(name, e.target.value)} className={`flex-1 text-[11px] px-1.5 py-1 border rounded bg-white text-gray-800 min-w-0 focus:border-primary-theme focus:ring-1 focus:ring-primary-theme/30 outline-none ${errors[name] ? 'border-red-400' : 'border-gray-300'}`} />}
      </div>
    );
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-2xl flex flex-col" style={{ width: '780px', maxHeight: '88vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 bg-primary-theme rounded-t-lg">
          <div className="flex items-center gap-2"><Plus size={15} className="text-white" /><span className="text-white text-sm" style={{ fontWeight: 600 }}>Nuevo Empleado</span><span className="text-white/60 text-xs ml-2">{nextNo}</span></div>
          <button onClick={onCancel} className="text-white/80 hover:text-white p-0.5 rounded hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
            <div className="col-span-2 mb-1"><div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5 rounded-r inline-block"><span className="text-[11px] text-primary-theme" style={{ fontWeight: 600 }}>Datos personales</span></div></div>
            {fld('Apellido paterno', 'apellidoPaterno', { required: true })}
            {fld('Sr./Sra.', 'srSra', { type: 'select', options: SR_SRA_OPTIONS })}
            {fld('Apellido materno', 'apellidoMaterno')}
            {fld('Alias', 'alias')}
            {fld('Nombre', 'nombre', { required: true })}
            {fld('Nombre corto', 'nombreCorto')}
            {fld('Cargo', 'cargo')}
            {fld('No. Empleado', 'noEmpleado')}
            <div className="col-span-2 mt-2 mb-1"><div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5 rounded-r inline-block"><span className="text-[11px] text-primary-theme" style={{ fontWeight: 600 }}>Inicio de sesión y asignación</span></div></div>
            {fld('ID de usuario', 'idUsuario', { required: true })}
            {fld('Responsabilidad', 'responsabilidad', { type: 'select', options: responsabilidadOptions })}
            {fld('Contraseña', 'contrasena', { type: 'password' })}
            {fld('Puesto de trabajo', 'puestoTrabajo', { type: 'select', options: puestoOptions })}
            {fld('Confirmar', 'confirmarContrasena', { type: 'password' })}
            {fld('Sucursal', 'sucursal', { type: 'select', options: sucursalOptions })}
            {fld('Tipo empleado', 'tipoEmpleado', { type: 'select', options: TIPO_EMPLEADO_OPTIONS })}
            {fld('División', 'division', { type: 'select', options: divisionOptions })}
            <div className="col-span-2 mt-2 mb-1"><div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5 rounded-r inline-block"><span className="text-[11px] text-primary-theme" style={{ fontWeight: 600 }}>Contacto</span></div></div>
            {fld('Correo electrónico', 'correoElectronico')}
            {fld('Teléfono trabajo', 'telefonoTrabajo')}
            {fld('Teléfono móvil', 'telefonoMovil')}
            {fld('Extensión', 'extension')}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button onClick={onCancel} className="px-4 py-1.5 text-[11px] border border-gray-400 rounded bg-white hover:bg-gray-100 text-gray-700">Cancelar</button>
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-[#0099CC] text-white rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}><Save size={12} />Crear empleado</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function EmpleadosSection() {
  const [data, setData] = useState<Empleado[]>(loadDataEmp);
  const [selectedId, setSelectedId] = useState<number | null>(() => { const d = loadDataEmp(); return d.length > 0 ? d[0].id : null; });
  const [formData, setFormData] = useState<Empleado | null>(() => { const d = loadDataEmp(); return d.length > 0 ? { ...d[0] } : null; });
  const [showMenu, setShowMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Empleado | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => { saveDataEmp(data); }, [data]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((e) => e.apellidoPaterno.toLowerCase().includes(q) || e.nombre.toLowerCase().includes(q) || e.idUsuario.toLowerCase().includes(q) || e.noEmpleado.toLowerCase().includes(q));
  }, [data, searchQuery]);

  const handleSelect = useCallback((id: number) => { setSelectedId(id); const e = data.find((i) => i.id === id); if (e) setFormData({ ...e }); }, [data]);
  const handleFieldChange = useCallback((name: string, value: string) => { setFormData((p) => p ? { ...p, [name]: value } : p); }, []);
  const handleCheckChange = useCallback((name: string, checked: boolean) => { setFormData((p) => p ? { ...p, [name]: checked } : p); }, []);

  const handleSave = useCallback(() => { if (!formData) return; setData((p) => p.map((e) => e.id === formData.id ? { ...formData } : e)); toast.success('Empleado actualizado', { description: `${formData.apellidoPaterno} ${formData.nombre} guardado.` }); }, [formData]);
  const handleReset = useCallback(() => { if (!selectedId) return; const e = data.find((i) => i.id === selectedId); if (e) { setFormData({ ...e }); toast.info('Cambios descartados'); } }, [data, selectedId]);

  const handleCreate = useCallback((emp: Omit<Empleado, 'id'>) => {
    const newId = Math.max(0, ...data.map((d) => d.id)) + 1;
    const n: Empleado = { ...emp, id: newId };
    setData((p) => [...p, n]); setSelectedId(newId); setFormData({ ...n });
    setShowCreate(false); toast.success('Empleado creado', { description: `${n.apellidoPaterno} ${n.nombre} (${n.noEmpleado}) agregado.` });
  }, [data]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    setData((p) => p.filter((d) => d.id !== deleteTarget.id));
    const rem = data.filter((d) => d.id !== deleteTarget.id);
    if (rem.length > 0) { setSelectedId(rem[0].id); setFormData({ ...rem[0] }); } else { setSelectedId(null); setFormData(null); }
    setDeleteTarget(null); toast.success('Empleado eliminado', { description: `${deleteTarget.apellidoPaterno} ${deleteTarget.nombre} eliminado.` });
  }, [deleteTarget, data]);

  const puestoOptions = useMemo(() => Array.from(new Set(data.map((e) => e.puestoTrabajo))).map((p) => ({ value: p, label: p })), [data]);
  const responsabilidadOptions = useMemo(() => Array.from(new Set(data.map((e) => e.responsabilidad))).map((r) => ({ value: r, label: r })), [data]);
  const sucursalOptions = useMemo(() => Array.from(new Set(data.map((e) => e.sucursal))).map((s) => ({ value: s, label: s })), [data]);
  const divisionOptions = useMemo(() => Array.from(new Set(data.map((e) => e.division).filter(Boolean))).map((d) => ({ value: d, label: d })), [data]);
  const nextNo = useMemo(() => generateNextEmpNo(data), [data]);

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] bg-gray-100">
      {showCreate && <CreateModalEmp nextNo={nextNo} puestoOptions={puestoOptions} responsabilidadOptions={responsabilidadOptions} sucursalOptions={sucursalOptions} divisionOptions={divisionOptions} onSave={handleCreate} onCancel={() => setShowCreate(false)} />}
      {deleteTarget && <DeleteConfirmEmp emp={deleteTarget} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />}

      {/* TABLA */}
      <div className="flex-shrink-0 border-b border-gray-300 bg-white flex flex-col">
        <div className="px-3 py-1.5 border-b border-gray-200 flex items-center gap-1 bg-gray-50">
          <span className="text-xs text-primary-theme px-2 py-0.5 bg-primary-tint-theme rounded" style={{ fontWeight: 600 }}>Empleados</span>
          <div className="flex items-center gap-1 ml-3">
            <div className="relative">
              <button onClick={() => setShowMenu((p) => !p)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700"><Menu size={11} />Menu<ChevronDown size={10} /></button>
              {showMenu && <ExportMenuEmp data={filteredData} onClose={() => setShowMenu(false)} />}
            </div>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700"><Plus size={11} />Nuevo</button>
            <button onClick={() => { if (!selectedId) { toast.warning('Seleccione un empleado'); return; } const e = data.find((i) => i.id === selectedId); if (e) setDeleteTarget(e); }}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700"><Trash2 size={11} />Eliminar</button>
            <button onClick={() => setShowSearch((p) => !p)} className={`flex items-center gap-1 px-2.5 py-1 text-[11px] border rounded ${showSearch ? 'border-primary-theme bg-primary-tint-theme text-primary-theme' : 'border-gray-300 bg-white hover:bg-gray-100 text-gray-700'}`}><Search size={11} />Consulta</button>
          </div>
          {showSearch && (
            <div className="ml-2 flex items-center gap-1">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar..." className="text-[11px] px-2 py-1 border border-gray-300 rounded w-[200px] focus:border-primary-theme outline-none" autoFocus />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 p-0.5"><X size={12} /></button>}
              <span className="text-[10px] text-gray-400">{filteredData.length}/{data.length}</span>
            </div>
          )}
        </div>
        <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#D0D0D0]">
                <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Ap. Paterno</th>
                <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Ap. Materno</th>
                <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Nombre</th>
                <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Cargo</th>
                <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">ID de usuario</th>
                <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Responsabilidad</th>
                <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Puesto</th>
                <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Sucursal</th>
                <th className="px-2 py-1.5 text-left text-gray-700 border-r border-gray-400 whitespace-nowrap">Tipo</th>
                <th className="px-2 py-1.5 text-center text-gray-700 whitespace-nowrap">En línea</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((emp, i) => (
                <tr key={emp.id} onClick={() => handleSelect(emp.id)}
                  className={`cursor-pointer border-b border-gray-100 transition-colors ${selectedId === emp.id ? 'bg-primary-theme text-white' : i % 2 === 0 ? 'bg-white hover:bg-blue-50/50' : 'bg-gray-50/50 hover:bg-blue-50/50'}`}>
                  <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{emp.apellidoPaterno}</td>
                  <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{emp.apellidoMaterno}</td>
                  <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{emp.nombre}</td>
                  <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{emp.cargo}</td>
                  <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{emp.idUsuario}</td>
                  <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap truncate max-w-[180px]">{emp.responsabilidad}</td>
                  <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap truncate max-w-[200px]">{emp.puestoTrabajo}</td>
                  <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{emp.sucursal}</td>
                  <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">{emp.tipoEmpleado}</td>
                  <td className="px-2 py-1 text-center whitespace-nowrap">
                    {emp.enLinea ? <Wifi size={12} className={selectedId === emp.id ? 'text-white inline' : 'text-green-500 inline'} /> : ''}
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400">No se encontraron empleados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORMULARIO */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {formData ? (
          <div className="p-0">
            <div className="px-4 py-2 bg-primary-tint-theme border-b border-gray-300 flex items-center justify-between">
              <h3 className="text-sm text-primary-theme tracking-wide" style={{ fontWeight: 700 }}>
                {formData.apellidoPaterno}{formData.apellidoMaterno ? ` ${formData.apellidoMaterno}` : ''}{formData.nombre ? `, ${formData.nombre}` : ''}
              </h3>
              <span className="text-[10px] text-primary-theme/60">{formData.noEmpleado}</span>
            </div>
            <div className="p-4 bg-white mx-3 my-3 rounded border border-gray-200">
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                <SectionHeader title="Nombre" />
                <FormFieldEmp label="Apellido paterno" name="apellidoPaterno" value={formData.apellidoPaterno} required onChange={handleFieldChange} />
                <FormFieldEmp label="Sr./Sra." name="srSra" value={formData.srSra} type="select" options={SR_SRA_OPTIONS} onChange={handleFieldChange} />
                <FormFieldEmp label="Apellido materno" name="apellidoMaterno" value={formData.apellidoMaterno} onChange={handleFieldChange} />
                <FormFieldEmp label="Alias" name="alias" value={formData.alias} onChange={handleFieldChange} />
                <FormFieldEmp label="Nombre" name="nombre" value={formData.nombre} required onChange={handleFieldChange} />
                <FormFieldEmp label="Nombre corto" name="nombreCorto" value={formData.nombreCorto} onChange={handleFieldChange} />
                <FormFieldEmp label="No. Empleado" name="noEmpleado" value={formData.noEmpleado} onChange={handleFieldChange} />
                <div />

                <SectionHeader title="Información del contacto" />
                <FormFieldEmp label="Teléfono del trabajo" name="telefonoTrabajo" value={formData.telefonoTrabajo} onChange={handleFieldChange} />
                <FormFieldEmp label="Correo electrónico" name="correoElectronico" value={formData.correoElectronico} onChange={handleFieldChange} />
                <FormFieldEmp label="Extensión" name="extension" value={formData.extension} onChange={handleFieldChange} />
                <FormFieldEmp label="Teléfono móvil" name="telefonoMovil" value={formData.telefonoMovil} onChange={handleFieldChange} />
                <FormFieldEmp label="Buscapersonas" name="buscapersonas" value={formData.buscapersonas} onChange={handleFieldChange} />
                <FormFieldEmp label="Fax" name="fax" value={formData.fax} onChange={handleFieldChange} />
                <FormFieldEmp label="Presencia" name="presencia" value={formData.presencia} type="select" options={PRESENCIA_OPTIONS} onChange={handleFieldChange} />
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-gray-600 w-[145px] flex-shrink-0 text-right">En línea:</label>
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" checked={formData.enLinea} onChange={(e) => handleCheckChange('enLinea', e.target.checked)} className="h-3.5 w-3.5 accent-primary-theme" />
                    <Wifi size={13} className={formData.enLinea ? 'text-green-500' : 'text-gray-300'} />
                    <span className={`text-[10px] ${formData.enLinea ? 'text-green-600' : 'text-gray-400'}`}>{formData.enLinea ? 'Conectado' : 'Desconectado'}</span>
                  </div>
                </div>

                <SectionHeader title="Dirección comercial" />
                <FormFieldEmp label="Dirección del trabajo" name="direccionTrabajo" value={formData.direccionTrabajo} onChange={handleFieldChange} />
                <FormFieldEmp label="Región" name="region" value={formData.region} type="select" options={REGION_OPTIONS} onChange={handleFieldChange} />
                <FormFieldEmp label="Código postal" name="codigoPostal" value={formData.codigoPostal} onChange={handleFieldChange} />
                <FormFieldEmp label="País" name="pais" value={formData.pais} type="select" options={PAIS_OPTIONS} onChange={handleFieldChange} />
                <FormFieldEmp label="Ciudad" name="ciudad" value={formData.ciudad} onChange={handleFieldChange} />
                <FormFieldEmp label="Compartir dirección" name="compartirDireccion" type="checkbox" checked={formData.compartirDireccion} onCheck={handleCheckChange} />

                <SectionHeader title="Inicio de sesión" />
                <FormFieldEmp label="ID de usuario" name="idUsuario" value={formData.idUsuario} required onChange={handleFieldChange} />
                <FormFieldEmp label="Responsabilidad" name="responsabilidad" value={formData.responsabilidad} type="select" options={responsabilidadOptions} onChange={handleFieldChange} />
                <FormFieldEmp label="Contraseña" name="contrasena" value={formData.contrasena} type="password" onChange={handleFieldChange} />
                <FormFieldEmp label="Nueva responsabilidad" name="nuevaResponsabilidad" value={formData.nuevaResponsabilidad} onChange={handleFieldChange} />
                <FormFieldEmp label="Confirmar contraseña" name="confirmarContrasena" value={formData.confirmarContrasena} type="password" onChange={handleFieldChange} />
                <FormFieldEmp label="Puesto de trabajo" name="puestoTrabajo" value={formData.puestoTrabajo} type="select" options={puestoOptions} onChange={handleFieldChange} />
                <FormFieldEmp label="Zona horaria" name="zonaHoraria" value={formData.zonaHoraria} type="select" options={ZONA_HORARIA_OPTIONS} onChange={handleFieldChange} />
                <FormFieldEmp label="División" name="division" value={formData.division} type="select" options={divisionOptions} onChange={handleFieldChange} />
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200">
                <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-[#0099CC] text-white rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}><Save size={12} />Guardar cambios</button>
                <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-white border border-gray-400 text-gray-700 rounded hover:bg-gray-50" style={{ fontWeight: 500 }}><RotateCcw size={12} />Descartar cambios</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Seleccione un empleado de la tabla para ver sus detalles</div>
        )}
      </div>
    </div>
  );
}