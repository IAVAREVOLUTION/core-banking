import React, { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import type {
  InversionCompleta, InversionFormData, Cotitular, Beneficiario,
  Rendimiento, ImpuestoInv, CargoInv, ExpedienteDoc,
  DocumentoValor, MovimientoInv, BloqueoInv, SolicitudExtra,
} from '@/types/inversion';
import * as store from './inversionesStore';

// ═══════════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════════
interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  inversionId?: number;
  onCancel: () => void;
  onSave: (data: InversionCompleta) => void;
}

// ═══════════════════════════════════════════════════════════════════
// OPCIONES INSTITUCIONALES
// ═══════════════════════════════════════════════════════════════════
const CLIENTES = [
  'CL-001 - Juan Pérez', 'CL-002 - María García', 'CL-003 - Carlos Ramírez',
  'CL-004 - Ana Martínez', 'CL-005 - Roberto Torres', 'CL-006 - Sofía Reyes',
];
const PRODUCTOS = ['CETES 28 días', 'CETES 90 días', 'CETES 180 días', 'Bonos Gubernamentales', 'Pagaré Bancario', 'Fondo de Inversión', '24 TESTPLUS'];
const FORMULAS = ['Inversión a plazo fijo', 'Inversión a la vista', 'Pagaré con rendimiento liquidable'];
const PERIODOS = ['Día', 'Semana', 'Mes', 'Trimestre', 'Semestre', 'Año'];
const PLAZOS = ['1-6', '7-28', '29-91', '92-182', '183-365', '366+'];
const MONEDAS = ['MXN', 'USD', 'EUR'];
const TIPOS_TASA = ['Fija', 'Variable', 'Mixta'];
const ESTATUS_INV = ['Pendiente', 'Aprobada', 'Rechazada', 'Vencida', 'Cancelada'];
const SUB_ESTATUS = ['', 'Vigente', 'En renovación', 'Liquidada', 'Suspendida'];
const CUENTAS_PAGO = ['01 PAGARES', '02 BONOS', '03 CUENTA CORRIENTE'];
const PARENTESCOS = ['Esposo', 'Esposa', 'Padre', 'Madre', 'Hijo', 'Hija', 'Hermano', 'Hermana', 'Socio', 'Otro'];
const TIPOS_CARGO = ['Comisión', 'Penalización', 'Ajuste', 'Servicio', 'Cargo administrativo'];
const TIPOS_DOC = ['Contrato', 'Estado de cuenta bancaria', 'Comprobante de domicilio', 'Identificación oficial', 'Carta de Aceptación', 'Otro'];
const TIPOS_MOV = ['Apertura', 'Depósito', 'Retiro', 'Pago de intereses', 'Renovación', 'Cancelación', 'Ajuste'];
const TIPOS_BLOQUEO = ['Judicial', 'Administrativo', 'Por solicitud', 'PLD', 'Otro'];
const ESTATUS_EXP = ['Pendiente', 'Aceptado', 'Rechazado'];
const LINEAS_PRODUCTO = ['Inversión'];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function formatMoney(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const int = parts[0] || '';
  const dec = parts[1] !== undefined ? '.' + parts[1].slice(0, 2) : '';
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return formatted + dec;
}

function formatPct(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return cleaned;
  if (num > 100) return '100.00';
  if (num < 0) return '0';
  return cleaned;
}

// ═══════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════
type TabId = 'default' | 'cotitulares' | 'beneficiarios' | 'rendimientos' | 'impuestos' | 'cargos' | 'expedientes' | 'documentos' | 'movimientos' | 'bloqueos' | 'solicitud';

const TABS: { id: TabId; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'cotitulares', label: 'Co-titulares' },
  { id: 'beneficiarios', label: 'Beneficiarios' },
  { id: 'rendimientos', label: 'Rendimientos' },
  { id: 'impuestos', label: 'Impuestos' },
  { id: 'cargos', label: 'Cargos' },
  { id: 'expedientes', label: 'Expedientes Electrónicos' },
  { id: 'documentos', label: 'Documentos/Valor' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'bloqueos', label: 'Bloqueos' },
  { id: 'solicitud', label: 'Solicitud Extraordinaria' },
];

// ═══════════════════════════════════════════════════════════════════
// TABLE HEADER institucional
// ═══════════════════════════════════════════════════════════════════
function TH({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 text-left text-[10px] bg-[#D0D0D0] text-gray-800 border-r border-gray-300 last:border-r-0 ${className || ''}`} style={{ fontWeight: 600 }}>{children}</th>;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function InversionForm({ mode, inversionId, onCancel, onSave }: Props) {
  const isView = mode === 'ver';
  const isNew = mode === 'nuevo';

  // ── Cargar datos ──
  const loadInitial = (): InversionCompleta => {
    const temp = store.loadTemp();
    if (temp) return temp;
    if (!isNew && inversionId) {
      const existing = store.getById(inversionId);
      if (existing) return { ...existing };
    }
    return store.emptyInversion();
  };

  const [data, setData] = useState<InversionCompleta>(loadInitial);
  const [activeTab, setActiveTab] = useState<TabId>('default');
  const [showClientModal, setShowClientModal] = useState<'cotitular' | 'beneficiario' | null>(null);
  const [selectedModalCliente, setSelectedModalCliente] = useState<string | null>(null);
  const [showWebUrlModal, setShowWebUrlModal] = useState(false);
  const [webUrl, setWebUrl] = useState('');
  const [showExpNuevo, setShowExpNuevo] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Persistencia temporal al cambiar de tab ──
  useEffect(() => {
    if (!isView) store.saveTemp(data);
  }, [data, isView]);

  // ── Handlers genéricos ──
  const updateForm = useCallback((field: keyof InversionFormData, value: any) => {
    if (isView) return;
    setData((d) => ({ ...d, form: { ...d.form, [field]: value } }));
  }, [isView]);

  const updateList = useCallback(<K extends keyof InversionCompleta>(key: K, value: InversionCompleta[K]) => {
    if (isView) return;
    setData((d) => ({ ...d, [key]: value }));
  }, [isView]);

  // ── Validación y guardado ──
  const handleSave = () => {
    const f = data.form;
    const missing: string[] = [];
    if (!f.cliente) missing.push('Cliente');
    if (!f.fechaInicio) missing.push('Fecha de Inicio');
    if (!f.fechaVencimiento) missing.push('Fecha de Vencimiento');
    if (!f.montoInversion) missing.push('Monto Inversión');
    if (!f.producto) missing.push('Producto');
    if (!f.estatusInversion) missing.push('Estatus Inversión');

    const totalPct = data.beneficiarios.reduce((s, b) => s + (parseFloat(b.porcentaje) || 0), 0);
    if (data.beneficiarios.length > 0 && totalPct !== 100) {
      missing.push(`Porcentajes de beneficiarios deben sumar 100% (actual: ${totalPct}%)`);
    }

    if (missing.length) {
      toast.error('Campos obligatorios faltantes:', { description: missing.join(', ') });
      return;
    }
    onSave(data);
  };

  // ═══════════════════════════════════════════════════════════════════
  // MODAL BÚSQUEDA CLIENTES
  // ═══════════════════════════════════════════════════════════════════
  const clientesMock = [
    { clave: 'CL-001', nombre: 'Juan Pérez', apPat: 'Pérez', apMat: 'García', rfc: 'JEAL670524F37', fechaNac: '1967-10-02' },
    { clave: 'CL-002', nombre: 'María García', apPat: 'García', apMat: 'Sánchez', rfc: 'FLY890905A5M', fechaNac: '1990-08-15' },
    { clave: 'CL-003', nombre: 'Carlos Ramírez', apPat: 'Ramírez', apMat: 'Soto', rfc: 'RACS850320F37', fechaNac: '1985-03-20' },
    { clave: 'CL-004', nombre: 'Ana Martínez', apPat: 'Martínez', apMat: 'Cruz', rfc: 'MACA921115F37', fechaNac: '1992-11-15' },
    { clave: 'CL-005', nombre: 'Roberto Torres', apPat: 'Torres', apMat: 'Vega', rfc: 'TOVR880705F37', fechaNac: '1988-07-05' },
    { clave: 'CL-006', nombre: 'Sofía Reyes', apPat: 'Reyes', apMat: 'López', rfc: 'RELS950228F37', fechaNac: '1995-02-28' },
  ];

  const handleSelectCliente = () => {
    if (!selectedModalCliente) return;
    const cl = clientesMock.find((c) => c.clave === selectedModalCliente);
    if (!cl) return;

    if (showClientModal === 'cotitular') {
      const newCt: Cotitular = {
        id: uid(), idCliente: cl.clave, nombre: cl.nombre.split(' ')[0],
        apellidoPaterno: cl.apPat, apellidoMaterno: cl.apMat,
        fechaNacimiento: cl.fechaNac, parentesco: '', notas: '',
      };
      updateList('cotitulares', [...data.cotitulares, newCt]);
    } else {
      const newBn: Beneficiario = {
        id: uid(), claveCliente: cl.clave, nombre: cl.nombre.split(' ')[0],
        apellidoPaterno: cl.apPat, apellidoMaterno: cl.apMat,
        fechaNacimiento: cl.fechaNac, parentesco: '', notas: '',
        porcentaje: '', validado: false,
      };
      updateList('beneficiarios', [...data.beneficiarios, newBn]);
    }
    toast.success('Cliente agregado');
    setShowClientModal(null);
    setSelectedModalCliente(null);
  };

  // ═══════════════════════════════════════════════════════════════════
  // EXPEDIENTES
  // ═══════════════════════════════════════════════════════════════════
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const newDoc: ExpedienteDoc = {
      id: data.expedientes.length > 0 ? Math.max(...data.expedientes.map((d) => d.id)) + 1 : 1,
      fechaRegistro: now(), usuarioRegistro: 'admin', archivo: file.name,
      tipoDocumento: '', descripcion: '', estatus: 'Pendiente', observaciones: '',
    };
    updateList('expedientes', [...data.expedientes, newDoc]);
    toast.success(`Archivo "${file.name}" adjuntado`);
    setShowExpNuevo(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleWebUrlAdd = () => {
    if (!webUrl.trim()) { toast.error('Ingrese una URL válida'); return; }
    const fileName = webUrl.split('/').pop() || 'archivo-web';
    const newDoc: ExpedienteDoc = {
      id: data.expedientes.length > 0 ? Math.max(...data.expedientes.map((d) => d.id)) + 1 : 1,
      fechaRegistro: now(), usuarioRegistro: 'admin', archivo: fileName,
      tipoDocumento: 'Documento web', descripcion: '', estatus: 'Pendiente', observaciones: '',
    };
    updateList('expedientes', [...data.expedientes, newDoc]);
    toast.success('Documento agregado');
    setShowWebUrlModal(false);
    setWebUrl('');
  };

  const handleDeleteDocs = () => {
    if (selectedDocs.length === 0) { toast.error('Seleccione documentos'); return; }
    const notPending = data.expedientes.filter((d) => selectedDocs.includes(d.id) && d.estatus !== 'Pendiente');
    if (notPending.length) { toast.error('Solo se eliminan documentos "Pendiente"'); return; }
    updateList('expedientes', data.expedientes.filter((d) => !selectedDocs.includes(d.id)));
    toast.success(`${selectedDocs.length} documento(s) eliminado(s)`);
    setSelectedDocs([]);
  };

  // ═══════════════════════════════════════════════════════════════════
  // FIELD HELPERS — Layout horizontal: label izquierda, input derecha
  // ═══════════════════════════════════════════════════════════════════
  const inputCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded';
  const disabledCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600';
  const labelCls = 'text-xs w-32 flex-shrink-0 text-gray-700';

  const renderField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: {
      required?: boolean;
      readOnly?: boolean;
      type?: 'text' | 'select' | 'date';
      options?: string[];
      isMoney?: boolean;
      isPct?: boolean;
      placeholder?: string;
      isCheckbox?: boolean;
      checked?: boolean;
      onCheck?: (v: boolean) => void;
    }
  ) => {
    const o = opts || {};
    const ro = o.readOnly || isView;

    if (o.isCheckbox) {
      return (
        <div className="flex items-center gap-2">
          <label className={labelCls}>{label}</label>
          <input
            type="checkbox"
            checked={o.checked}
            onChange={(e) => o.onCheck?.(e.target.checked)}
            disabled={ro}
            className="w-3.5 h-3.5 accent-[#4A6FA5]"
          />
        </div>
      );
    }

    if (o.type === 'date') {
      return (
        <div className="flex items-center gap-2">
          <label className={labelCls}>
            {label}{o.required && <span className="text-red-600"> *</span>}
          </label>
          {ro ? (
            <div className={disabledCls}>{value || ''}</div>
          ) : (
            <DatePicker
              value={value}
              onChange={onChange}
              disabled={ro}
            />
          )}
        </div>
      );
    }

    if (o.type === 'select') {
      return (
        <div className="flex items-center gap-2">
          <label className={labelCls}>
            {label}{o.required && <span className="text-red-600"> *</span>}
          </label>
          {ro ? (
            <div className={disabledCls}>{value || ''}</div>
          ) : (
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={ro}
              className={ro ? disabledCls : inputCls}
            >
              <option value="">— Seleccionar —</option>
              {o.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}
        </div>
      );
    }

    // Text / money / pct
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value;
      if (o.isMoney) v = formatMoney(v);
      if (o.isPct) v = formatPct(v);
      onChange(v);
    };

    return (
      <div className="flex items-center gap-2">
        <label className={labelCls}>
          {label}{o.required && <span className="text-red-600"> *</span>}
        </label>
        {ro ? (
          <div className={disabledCls}>{value || ''}</div>
        ) : (
          <input
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={o.placeholder}
            readOnly={ro}
            className={ro ? disabledCls : inputCls}
          />
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER TABS
  // ═══════════════════════════════════════════════════════════════════

  const renderDefault = () => (
    <>
      {/* DEFAULT Section Header */}
      <div className="mb-4">
        <div className="bg-[#D9E2F3] px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-[#4A6FA5]" style={{ fontWeight: 500 }}>
          DEFAULT
        </div>
        <div className="grid grid-cols-3 gap-x-4">
          {/* Columna 1 — Plazos */}
          <div className="space-y-1">
            {renderField('PLAZO MÍNIMO', data.form.plazoMinimo, (v) => updateForm('plazoMinimo', v), { placeholder: '30' })}
            {renderField('PLAZO AUTORIZADO', data.form.plazoAutorizado, (v) => updateForm('plazoAutorizado', v), { required: true, placeholder: '90' })}
            {renderField('PLAZO MÁXIMO', data.form.plazoMaximo, (v) => updateForm('plazoMaximo', v), { placeholder: '365' })}
          </div>
          {/* Columna 2 — Montos */}
          <div className="space-y-1">
            {renderField('MONTO MÍNIMO', data.form.montoMinimo, (v) => updateForm('montoMinimo', v), { isMoney: true, placeholder: '10,000.00' })}
            {renderField('MONTO AUTORIZADO', data.form.montoAutorizado, (v) => updateForm('montoAutorizado', v), { required: true, isMoney: true, placeholder: '500,000.00' })}
            {renderField('MONTO MÁXIMO', data.form.montoMaximo, (v) => updateForm('montoMaximo', v), { isMoney: true, placeholder: '5,000,000.00' })}
          </div>
          {/* Columna 3 — Tasas */}
          <div className="space-y-1">
            {renderField('TASA MÍNIMA (%)', data.form.tasaMinima, (v) => updateForm('tasaMinima', v), { isPct: true, placeholder: '5.00' })}
            {renderField('TASA AUTORIZADA (%)', data.form.tasaAutorizada, (v) => updateForm('tasaAutorizada', v), { required: true, isPct: true, placeholder: '10.00' })}
            {renderField('TASA MÁXIMA (%)', data.form.tasaMaxima, (v) => updateForm('tasaMaxima', v), { isPct: true, placeholder: '15.00' })}
          </div>
        </div>
      </div>
    </>
  );

  const renderTable = <T extends { id: string }>(
    items: T[],
    key: keyof InversionCompleta,
    columns: { label: string; field: keyof T; type?: 'text' | 'select' | 'date' | 'money' | 'pct'; options?: string[]; readOnly?: boolean }[],
    onAdd: () => void,
    addLabel: string,
  ) => (
    <div className="space-y-3">
      <div className="bg-[#D9E2F3] px-3 py-2 text-sm text-gray-800 border-l-4 border-[#4A6FA5] flex items-center justify-between" style={{ fontWeight: 500 }}>
        <span>{addLabel}</span>
        {!isView && (
          <div className="flex items-center gap-2">
            <button onClick={onAdd} className="px-3 py-1 bg-[#0099CC] text-white text-[10px] rounded hover:bg-[#0088BB]">Nuevo</button>
            {items.length > 0 && (
              <button
                onClick={() => updateList(key, (items as any[]).slice(0, -1) as any)}
                className="px-3 py-1 border border-gray-400 text-gray-700 text-[10px] rounded hover:bg-gray-50 bg-white"
              >Eliminar último</button>
            )}
          </div>
        )}
      </div>
      <div className="border border-gray-300 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr>{columns.map((c) => <TH key={String(c.field)}>{c.label}</TH>)}</tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-gray-400 text-xs">Sin registros</td></tr>
            ) : items.map((item, idx) => (
              <tr key={item.id} className="border-b border-gray-200" style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}>
                {columns.map((c) => {
                  const val = String(item[c.field] ?? '');
                  const disabled = isView || c.readOnly;
                  return (
                    <td key={String(c.field)} className="px-2 py-1 border-r border-gray-200 last:border-r-0">
                      {c.type === 'select' ? (
                        <select
                          value={val}
                          onChange={(e) => {
                            const updated = (items as any[]).map((it: any) =>
                              it.id === item.id ? { ...it, [c.field]: e.target.value } : it
                            );
                            updateList(key, updated as any);
                          }}
                          disabled={disabled}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white disabled:bg-gray-100"
                        >
                          <option value="">—</option>
                          {c.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={c.type === 'date' ? 'date' : 'text'}
                          value={val}
                          onChange={(e) => {
                            let v = e.target.value;
                            if (c.type === 'money') v = formatMoney(v);
                            if (c.type === 'pct') v = formatPct(v);
                            const updated = (items as any[]).map((it: any) =>
                              it.id === item.id ? { ...it, [c.field]: v } : it
                            );
                            updateList(key, updated as any);
                          }}
                          readOnly={disabled}
                          className={`w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded ${disabled ? 'bg-gray-100' : 'bg-white'}`}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCotitulares = () => renderTable<Cotitular>(
    data.cotitulares, 'cotitulares',
    [
      { label: 'ID Cliente', field: 'idCliente', readOnly: true },
      { label: 'Nombre', field: 'nombre', readOnly: true },
      { label: 'Apellido Paterno', field: 'apellidoPaterno', readOnly: true },
      { label: 'Apellido Materno', field: 'apellidoMaterno', readOnly: true },
      { label: 'F. Nacimiento', field: 'fechaNacimiento', type: 'date', readOnly: true },
      { label: 'Parentesco', field: 'parentesco', type: 'select', options: PARENTESCOS },
      { label: 'Notas', field: 'notas' },
    ],
    () => setShowClientModal('cotitular'),
    'Co-titulares',
  );

  const renderBeneficiarios = () => (
    <div className="space-y-3">
      <div className="bg-[#D9E2F3] px-3 py-2 text-sm text-gray-800 border-l-4 border-[#4A6FA5] flex items-center justify-between" style={{ fontWeight: 500 }}>
        <div className="flex items-center gap-3">
          <span>Beneficiarios</span>
          {data.beneficiarios.length > 0 && (
            <span className={`text-[10px] ${
              data.beneficiarios.reduce((s, b) => s + (parseFloat(b.porcentaje) || 0), 0) === 100
                ? 'text-green-700' : 'text-red-700'
            }`}>
              Total: {data.beneficiarios.reduce((s, b) => s + (parseFloat(b.porcentaje) || 0), 0)}%
            </span>
          )}
        </div>
        {!isView && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowClientModal('beneficiario')} className="px-3 py-1 bg-[#0099CC] text-white text-[10px] rounded hover:bg-[#0088BB]">Nuevo</button>
            {data.beneficiarios.length > 0 && (
              <button onClick={() => updateList('beneficiarios', data.beneficiarios.slice(0, -1))} className="px-3 py-1 border border-gray-400 text-gray-700 text-[10px] rounded hover:bg-gray-50 bg-white">Eliminar último</button>
            )}
          </div>
        )}
      </div>
      <div className="border border-gray-300 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <TH>Clave Cliente</TH><TH>Nombre</TH><TH>Ap. Paterno</TH><TH>Ap. Materno</TH>
              <TH>F. Nacimiento</TH><TH>Parentesco</TH><TH>% Participación</TH><TH>Notas</TH>
            </tr>
          </thead>
          <tbody>
            {data.beneficiarios.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-xs">Sin beneficiarios</td></tr>
            ) : data.beneficiarios.map((b, idx) => (
              <tr key={b.id} className="border-b border-gray-200" style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}>
                <td className="px-2 py-1 border-r border-gray-200"><input value={b.claveCliente} readOnly className="w-full px-1 py-0.5 text-[10px] bg-gray-100 border border-gray-300 rounded" /></td>
                <td className="px-2 py-1 border-r border-gray-200"><input value={b.nombre} readOnly className="w-full px-1 py-0.5 text-[10px] bg-gray-100 border border-gray-300 rounded" /></td>
                <td className="px-2 py-1 border-r border-gray-200"><input value={b.apellidoPaterno} readOnly className="w-full px-1 py-0.5 text-[10px] bg-gray-100 border border-gray-300 rounded" /></td>
                <td className="px-2 py-1 border-r border-gray-200"><input value={b.apellidoMaterno} readOnly className="w-full px-1 py-0.5 text-[10px] bg-gray-100 border border-gray-300 rounded" /></td>
                <td className="px-2 py-1 border-r border-gray-200"><input type="date" value={b.fechaNacimiento} readOnly className="w-full px-1 py-0.5 text-[10px] bg-gray-100 border border-gray-300 rounded" /></td>
                <td className="px-2 py-1 border-r border-gray-200">
                  <select value={b.parentesco} disabled={isView} onChange={(e) => updateList('beneficiarios', data.beneficiarios.map((x) => x.id === b.id ? { ...x, parentesco: e.target.value } : x))} className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white disabled:bg-gray-100">
                    <option value="">—</option>
                    {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1 border-r border-gray-200">
                  <input
                    type="text" value={b.porcentaje} readOnly={isView}
                    onChange={(e) => {
                      const v = formatPct(e.target.value);
                      updateList('beneficiarios', data.beneficiarios.map((x) => x.id === b.id ? { ...x, porcentaje: v } : x));
                    }}
                    className={`w-full px-1 py-0.5 text-[10px] border rounded ${isView ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-300'}`}
                    placeholder="0"
                  />
                </td>
                <td className="px-2 py-1">
                  <input value={b.notas} readOnly={isView} onChange={(e) => updateList('beneficiarios', data.beneficiarios.map((x) => x.id === b.id ? { ...x, notas: e.target.value } : x))} className={`w-full px-1 py-0.5 text-[10px] border rounded ${isView ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-300'}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRendimientos = () => renderTable<Rendimiento>(
    data.rendimientos, 'rendimientos',
    [
      { label: 'Fecha', field: 'fechaCreacion', type: 'date' },
      { label: 'Concepto', field: 'concepto' },
      { label: 'Tasa (%)', field: 'tasa', type: 'pct' },
      { label: 'Monto Base', field: 'montoBase', type: 'money' },
      { label: 'Monto Rendimiento', field: 'monto', type: 'money' },
    ],
    () => updateList('rendimientos', [...data.rendimientos, { id: uid(), fechaCreacion: '', concepto: '', tasa: '', montoBase: '', monto: '' }]),
    'Rendimientos',
  );

  const renderImpuestos = () => renderTable<ImpuestoInv>(
    data.impuestos, 'impuestos',
    [
      { label: 'Fecha Cálculo', field: 'fechaCalculo', type: 'date' },
      { label: 'Concepto Impuesto', field: 'conceptoImpuesto' },
      { label: 'Porcentaje', field: 'porcentaje', type: 'pct' },
      { label: 'Monto Base', field: 'montoBase', type: 'money' },
      { label: 'Concepto Base', field: 'conceptoBase' },
      { label: 'Valor Impuestos', field: 'valorImpuestos', type: 'money' },
    ],
    () => updateList('impuestos', [...data.impuestos, { id: uid(), fechaCalculo: '', conceptoImpuesto: 'ISR', porcentaje: '', montoBase: '', conceptoBase: '', valorImpuestos: '' }]),
    'Impuestos',
  );

  const renderCargos = () => renderTable<CargoInv>(
    data.cargos, 'cargos',
    [
      { label: 'Tipo Cargo', field: 'tipoCargo', type: 'select', options: TIPOS_CARGO },
      { label: 'Descripción', field: 'descripcion' },
      { label: 'Monto', field: 'monto', type: 'money' },
      { label: 'Moneda', field: 'moneda', type: 'select', options: MONEDAS },
      { label: 'Fecha y Hora', field: 'fechaHora', readOnly: true },
    ],
    () => updateList('cargos', [...data.cargos, { id: uid(), tipoCargo: '', descripcion: '', monto: '', moneda: 'MXN', fechaHora: now() }]),
    'Cargos',
  );

  const renderExpedientes = () => (
    <div className="space-y-3">
      <div className="bg-[#D9E2F3] px-3 py-2 text-sm text-gray-800 border-l-4 border-[#4A6FA5] flex items-center justify-between" style={{ fontWeight: 500 }}>
        <span>Expediente Electrónico</span>
        {!isView && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowExpNuevo(!showExpNuevo)} className="px-3 py-1 bg-[#0099CC] text-white text-[10px] rounded hover:bg-[#0088BB]">Nuevo</button>
            <button onClick={handleDeleteDocs} className="px-3 py-1 border border-gray-400 text-gray-700 text-[10px] rounded hover:bg-gray-50 bg-white">Eliminar</button>
          </div>
        )}
      </div>
      {showExpNuevo && !isView && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">Adjuntar desde:</span>
          <input type="file" ref={fileRef} onChange={handleFileUpload} className="hidden" id="inv-file-upload" />
          <button onClick={() => fileRef.current?.click()} className="px-3 py-1 bg-gray-200 border border-gray-300 rounded text-[10px] hover:bg-gray-300">Equipo</button>
          <button onClick={() => { setShowWebUrlModal(true); setShowExpNuevo(false); }} className="px-3 py-1 bg-gray-200 border border-gray-300 rounded text-[10px] hover:bg-gray-300">Web</button>
        </div>
      )}
      <div className="border border-gray-300 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <TH className="w-8 text-center">
                <input type="checkbox" checked={data.expedientes.length > 0 && selectedDocs.length === data.expedientes.length} onChange={(e) => setSelectedDocs(e.target.checked ? data.expedientes.map((d) => d.id) : [])} />
              </TH>
              <TH>Fecha Registro</TH><TH>Usuario</TH><TH>Archivo</TH><TH>Tipo Documento</TH><TH>Descripción</TH><TH>Estatus</TH><TH>Observaciones</TH>
            </tr>
          </thead>
          <tbody>
            {data.expedientes.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-xs">Sin archivos. Clic en "Nuevo" para agregar.</td></tr>
            ) : data.expedientes.map((doc, idx) => (
              <tr key={doc.id} className="border-b border-gray-200" style={{ backgroundColor: selectedDocs.includes(doc.id) ? '#E0ECFF' : idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}>
                <td className="px-2 py-1 text-center border-r border-gray-200">
                  <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={(e) => setSelectedDocs(e.target.checked ? [...selectedDocs, doc.id] : selectedDocs.filter((x) => x !== doc.id))} />
                </td>
                <td className="px-2 py-1 border-r border-gray-200 text-[10px] text-gray-600">{doc.fechaRegistro}</td>
                <td className="px-2 py-1 border-r border-gray-200 text-[10px] text-gray-600">{doc.usuarioRegistro}</td>
                <td className="px-2 py-1 border-r border-gray-200 text-[10px] text-[#0066CC]">{doc.archivo}</td>
                <td className="px-2 py-1 border-r border-gray-200">
                  {isView ? <span className="text-[10px]">{doc.tipoDocumento}</span> : (
                    <select value={doc.tipoDocumento} onChange={(e) => updateList('expedientes', data.expedientes.map((d) => d.id === doc.id ? { ...d, tipoDocumento: e.target.value } : d))} className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded">
                      <option value="">Seleccione...</option>
                      {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-2 py-1 border-r border-gray-200">
                  {isView ? <span className="text-[10px]">{doc.descripcion}</span> : (
                    <input value={doc.descripcion} onChange={(e) => updateList('expedientes', data.expedientes.map((d) => d.id === doc.id ? { ...d, descripcion: e.target.value } : d))} className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded" />
                  )}
                </td>
                <td className="px-2 py-1 border-r border-gray-200">
                  {isView ? <span className="text-[10px]">{doc.estatus}</span> : (
                    <select value={doc.estatus} onChange={(e) => updateList('expedientes', data.expedientes.map((d) => d.id === doc.id ? { ...d, estatus: e.target.value } : d))} className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded">
                      {ESTATUS_EXP.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-2 py-1">
                  {isView ? <span className="text-[10px]">{doc.observaciones}</span> : (
                    <input value={doc.observaciones} onChange={(e) => updateList('expedientes', data.expedientes.map((d) => d.id === doc.id ? { ...d, observaciones: e.target.value } : d))} className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded" placeholder="Sin observaciones" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDocumentosValor = () => renderTable<DocumentoValor>(
    data.documentosValor, 'documentosValor',
    [
      { label: 'Tipo Documento', field: 'tipoDocumento', type: 'select', options: ['Pagaré', 'Certificado', 'Título', 'Recibo', 'Otro'] },
      { label: 'Descripción', field: 'descripcion' },
      { label: 'Fecha Carga', field: 'fechaCarga', readOnly: true },
      { label: 'Usuario', field: 'usuarioCarga', readOnly: true },
      { label: 'Archivo', field: 'archivo' },
      { label: 'Valor Documentado', field: 'valorDocumentado', type: 'money' },
      { label: 'Estatus', field: 'estatus', type: 'select', options: ESTATUS_EXP },
    ],
    () => updateList('documentosValor', [...data.documentosValor, { id: uid(), tipoDocumento: '', descripcion: '', fechaCarga: now(), usuarioCarga: 'admin', archivo: '', valorDocumentado: '', estatus: 'Pendiente' }]),
    'Documentos/Valor',
  );

  const renderMovimientos = () => renderTable<MovimientoInv>(
    data.movimientos, 'movimientos',
    [
      { label: 'Fecha y Hora', field: 'fechaHora', readOnly: true },
      { label: 'Tipo Movimiento', field: 'tipoMovimiento', type: 'select', options: TIPOS_MOV },
      { label: 'Monto', field: 'montoMovimiento', type: 'money' },
      { label: 'Saldo Inicial', field: 'saldoInicial', type: 'money', readOnly: true },
      { label: 'Saldo Final', field: 'saldoFinal', type: 'money', readOnly: true },
      { label: 'Referencia', field: 'referencia' },
      { label: 'Estatus', field: 'estatus', type: 'select', options: ['Aplicado', 'Pendiente', 'Rechazado'] },
    ],
    () => updateList('movimientos', [...data.movimientos, { id: uid(), fechaHora: now(), tipoMovimiento: '', montoMovimiento: '', saldoInicial: '', saldoFinal: '', referencia: '', estatus: 'Pendiente' }]),
    'Movimientos',
  );

  const renderBloqueos = () => renderTable<BloqueoInv>(
    data.bloqueos, 'bloqueos',
    [
      { label: 'Tipo Bloqueo', field: 'tipoBloqueo', type: 'select', options: TIPOS_BLOQUEO },
      { label: 'Motivo', field: 'motivo' },
      { label: 'Fecha Inicio', field: 'fechaInicio', type: 'date' },
      { label: 'Fecha Fin', field: 'fechaFin', type: 'date' },
      { label: 'Estatus', field: 'estatus', type: 'select', options: ['Activo', 'Inactivo', 'Levantado'] },
      { label: 'Usuario', field: 'usuarioRegistro', readOnly: true },
      { label: 'Fecha Registro', field: 'fechaRegistro', readOnly: true },
    ],
    () => updateList('bloqueos', [...data.bloqueos, { id: uid(), tipoBloqueo: '', motivo: '', fechaInicio: '', fechaFin: '', estatus: 'Activo', usuarioRegistro: 'admin', fechaRegistro: now() }]),
    'Bloqueos',
  );

  const renderSolicitudExtra = () => renderTable<SolicitudExtra>(
    data.solicitudesExtra, 'solicitudesExtra',
    [
      { label: 'No. Solicitud', field: 'noSolicitud', readOnly: true },
      { label: 'Cliente', field: 'cliente' },
      { label: 'No. Cuenta', field: 'numeroCuenta' },
      { label: 'Producto', field: 'productoFinanciero' },
      { label: 'Área Solicitó', field: 'areaSolicito' },
      { label: 'Descripción del Caso', field: 'descripcionCaso' },
      { label: 'Fecha', field: 'fechaRegistro', readOnly: true },
      { label: 'Estatus', field: 'estatus', type: 'select', options: ['Pendiente', 'Aprobada', 'Rechazada', 'En proceso'] },
    ],
    () => {
      const num = `SE-${String(data.solicitudesExtra.length + 1).padStart(3, '0')}`;
      updateList('solicitudesExtra', [...data.solicitudesExtra, {
        id: uid(), noSolicitud: num, numeroCliente: '', cliente: data.form.cliente,
        numeroCuenta: data.form.noCuentaInversion, productoFinanciero: data.form.producto,
        areaSolicito: '', puestoTrabajo: '', solicitudExtraordinaria: '',
        areaAutorizo: '', puestoTrabajoAutorizo: '', descripcionCaso: '',
        fechaRegistro: now(), estatus: 'Pendiente',
      }]);
    },
    'Solicitudes Extraordinarias',
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'default': return renderDefault();
      case 'cotitulares': return renderCotitulares();
      case 'beneficiarios': return renderBeneficiarios();
      case 'rendimientos': return renderRendimientos();
      case 'impuestos': return renderImpuestos();
      case 'cargos': return renderCargos();
      case 'expedientes': return renderExpedientes();
      case 'documentos': return renderDocumentosValor();
      case 'movimientos': return renderMovimientos();
      case 'bloqueos': return renderBloqueos();
      case 'solicitud': return renderSolicitudExtra();
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* ── HEADER con ícono y título ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          <h2 className="text-lg text-gray-800" style={{ fontWeight: 400 }}>
            {isNew ? 'Alta Inversión' : mode === 'editar' ? 'Editar Inversión' : 'Ver Inversión'}
          </h2>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2" className="ml-2">
            <circle cx="8" cy="8" r="6" />
            <path d="M13 13l3 3" />
          </svg>
          {!isNew && data.numero && (
            <span className="text-xs text-gray-500 ml-2">— {data.numero}</span>
          )}
        </div>
      </div>

      {/* ── BOTONES Guardar / Cancelar ── */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          {!isView && (
            <button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB]" style={{ fontWeight: 500 }}>
              Guardar
            </button>
          )}
          <button onClick={onCancel} className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700">
            {isView ? 'Volver' : 'Cancelar'}
          </button>
        </div>
      </div>

      {/* ── CONTENIDO del formulario ── */}
      <div className="flex-1 px-4 py-4 bg-[#F5F5F5] overflow-auto">
        <div className="bg-white border border-gray-300 p-4">

          {/* ── INFORMACIÓN PRINCIPAL ── */}
          <div className="mb-4">
            <div className="bg-[#D9E2F3] px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-[#4A6FA5]" style={{ fontWeight: 500 }}>
              Información Principal
            </div>
            <div className="grid grid-cols-3 gap-x-4">
              {/* Columna 1 */}
              <div className="space-y-1">
                {renderField('No. DE REGISTRO', data.form.noRegistro || (isNew ? 'AUTO' : ''), () => {}, { readOnly: true })}
                {renderField('CLIENTE', data.form.cliente, (v) => updateForm('cliente', v), { required: true, type: 'select', options: CLIENTES })}
                {renderField('FECHA DE INICIO', data.form.fechaInicio, (v) => updateForm('fechaInicio', v), { required: true, type: 'date' })}
                {renderField('FECHA DE VENCIMIENTO', data.form.fechaVencimiento, (v) => updateForm('fechaVencimiento', v), { required: true, type: 'date' })}
                {renderField('MONTO INVERSIÓN', data.form.montoInversion, (v) => updateForm('montoInversion', v), { required: true, isMoney: true, placeholder: '$0.00' })}
                {renderField('MONEDA', data.form.moneda, (v) => updateForm('moneda', v), { required: true, type: 'select', options: MONEDAS })}
                {renderField('LÍNEA PRODUCTO', data.form.lineaProducto, (v) => updateForm('lineaProducto', v), { type: 'select', options: LINEAS_PRODUCTO })}
              </div>
              {/* Columna 2 */}
              <div className="space-y-1">
                {renderField('FÓRMULA', data.form.formula, (v) => updateForm('formula', v), { type: 'select', options: FORMULAS })}
                {renderField('PRODUCTO', data.form.producto, (v) => updateForm('producto', v), { required: true, type: 'select', options: PRODUCTOS })}
                {renderField('TIPO DE TASA', data.form.tipoTasa, (v) => updateForm('tipoTasa', v), { type: 'select', options: TIPOS_TASA })}
                {renderField('CUPÓN CERO', '', () => {}, { isCheckbox: true, checked: data.form.cuponCero, onCheck: (v) => updateForm('cuponCero', v) })}
                {renderField('PERIODO', data.form.periodo, (v) => updateForm('periodo', v), { type: 'select', options: PERIODOS })}
                {renderField('PLAZOS', data.form.plazos, (v) => updateForm('plazos', v), { type: 'select', options: PLAZOS })}
                {renderField('No. RENOVACIONES', data.form.numeroRenovaciones, (v) => updateForm('numeroRenovaciones', v.replace(/\D/g, '')), { placeholder: '0' })}
              </div>
              {/* Columna 3 */}
              <div className="space-y-1">
                {renderField('No. CUENTA INVERSIÓN', data.form.noCuentaInversion || (isNew ? 'AUTOINCREMENT' : ''), () => {}, { readOnly: true })}
                {renderField('FECHA CORTE ESTADOS', data.form.fechaCorteEstados, (v) => updateForm('fechaCorteEstados', v), { type: 'date' })}
                {renderField('MONTO PAGARÉ', data.form.montoPagare, (v) => updateForm('montoPagare', v), { isMoney: true, placeholder: '$0.00' })}
                {renderField('MONTO INTERESES', data.form.montoIntereses, (v) => updateForm('montoIntereses', v), { isMoney: true, placeholder: '$0.00' })}
                {renderField('TASA INTERESES (%)', data.form.tasaIntereses, (v) => updateForm('tasaIntereses', v), { isPct: true, placeholder: '0.00' })}
                {renderField('ESTATUS INVERSIÓN', data.form.estatusInversion, (v) => updateForm('estatusInversion', v), { required: true, type: 'select', options: ESTATUS_INV })}
                {renderField('SUB ESTATUS', data.form.subEstatus, (v) => updateForm('subEstatus', v), { type: 'select', options: SUB_ESTATUS })}
                {renderField('CUENTA DE PAGO', data.form.cuentaPago, (v) => updateForm('cuentaPago', v), { type: 'select', options: CUENTAS_PAGO })}
              </div>
            </div>
          </div>

          {/* ── SUB-TABS ── */}
          <div className="bg-primary-theme text-white border-y border-gray-400 -mx-4 mb-4">
            <div className="px-4 flex items-center overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-secondary-theme text-white'
                      : 'text-white/90'
                  }`}
                  style={activeTab === tab.id ? { fontWeight: 500 } : { fontWeight: 400 }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = 'var(--theme-primary-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = '';
                    }
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── CONTENIDO DEL TAB ── */}
          <div className="min-h-[200px]">
            {renderTabContent()}
          </div>

        </div>

        {/* ── AUDITORÍA ── */}
        {!isNew && (
          <div className="mt-3 px-4 py-2 bg-white border border-gray-300">
            <div className="flex items-center gap-6 text-[9px] text-gray-500">
              <span>Creador: <strong>{data.usuarioCreacion}</strong></span>
              <span>Fecha creación: <strong>{data.fechaCreacion}</strong></span>
              <span>Última modificación: <strong>{data.fechaModificacion}</strong></span>
              <span>Modificado por: <strong>{data.usuarioModificacion}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL: Búsqueda de Clientes */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-[700px] max-h-[550px] flex flex-col">
            <div className="bg-[#4A6FA5] px-4 py-2.5 rounded-t flex items-center justify-between">
              <h3 className="text-sm text-white" style={{ fontWeight: 600 }}>
                Buscar Cliente — {showClientModal === 'cotitular' ? 'Co-titular' : 'Beneficiario'}
              </h3>
              <button onClick={() => { setShowClientModal(null); setSelectedModalCliente(null); }} className="text-white/80 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-auto px-4 py-3">
              <div className="border border-gray-300 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D0D0D0] text-gray-800">
                      <th className="px-3 py-2 text-left text-xs" style={{ fontWeight: 400 }}>Clave</th>
                      <th className="px-3 py-2 text-left text-xs" style={{ fontWeight: 400 }}>Nombre</th>
                      <th className="px-3 py-2 text-left text-xs" style={{ fontWeight: 400 }}>RFC</th>
                      <th className="px-3 py-2 text-left text-xs" style={{ fontWeight: 400 }}>F. Nacimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesMock.map((cl, i) => (
                      <tr
                        key={cl.clave}
                        onClick={() => setSelectedModalCliente(cl.clave)}
                        className="cursor-pointer border-b border-gray-200 transition-colors"
                        style={{
                          backgroundColor: selectedModalCliente === cl.clave ? '#4A6FA5' : i % 2 === 1 ? '#EEEEEE' : '#FFFFFF',
                          color: selectedModalCliente === cl.clave ? 'white' : 'inherit',
                        }}
                        onMouseEnter={(e) => { if (selectedModalCliente !== cl.clave) e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                        onMouseLeave={(e) => { if (selectedModalCliente !== cl.clave) e.currentTarget.style.backgroundColor = i % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}
                      >
                        <td className="px-3 py-2">{cl.clave}</td>
                        <td className="px-3 py-2">{cl.nombre}</td>
                        <td className="px-3 py-2">{cl.rfc}</td>
                        <td className="px-3 py-2">{cl.fechaNac}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={handleSelectCliente} disabled={!selectedModalCliente} className="px-4 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB] disabled:opacity-50">
                Aceptar
              </button>
              <button onClick={() => { setShowClientModal(null); setSelectedModalCliente(null); }} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL: URL Web */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showWebUrlModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-[480px]">
            <div className="bg-[#4A6FA5] px-4 py-2.5 rounded-t flex items-center justify-between">
              <h3 className="text-sm text-white" style={{ fontWeight: 600 }}>Agregar URL</h3>
              <button onClick={() => { setShowWebUrlModal(false); setWebUrl(''); }} className="text-white/80 hover:text-white">✕</button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-xs text-gray-700 mb-2">URL:</label>
              <input
                type="url" value={webUrl} onChange={(e) => setWebUrl(e.target.value)}
                placeholder="https://ejemplo.com/archivo.pdf" autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]"
              />
            </div>
            <div className="px-6 py-3 flex justify-end gap-3 border-t border-gray-200">
              <button onClick={() => { setShowWebUrlModal(false); setWebUrl(''); }} className="px-4 py-1.5 text-xs bg-white border border-gray-400 rounded text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleWebUrlAdd} className="px-4 py-1.5 text-xs bg-[#0099CC] text-white rounded hover:bg-[#0088BB]">Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
