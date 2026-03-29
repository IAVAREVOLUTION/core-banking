/**
 * SolicitudActivacionForm.tsx
 *
 * Layout:
 *   [Header bar]
 *   [Action buttons bar]
 *   [Content px-4 py-3]
 *     [bg-white border container]
 *       [Section: DATOS GENERALES]
 *         [SOLICITUD picker — full-width, first field]
 *         [grid-cols-3 fields]
 *       [Section: INFORMACIÓN DE PAGO]
 *         [grid-cols-3 fields]
 *       [Sub-tab bar: Default | Detail]
 *       [Default tab: repeat of both sections]
 *       [Detail tab: SolicitudActivacionDetailTab]
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  type SolicitudActivacionFormData,
  EMPTY_FORM,
  CAT_FORMA_PAGO,
  CAT_MONEDA,
  saveToSession,
  loadFromSession,
  clearSession,
  formatCurrency,
  parseCurrency,
} from './solicitudActivacionStore';
import { SolicitudActivacionDetailTab } from './SolicitudActivacionDetailTab';
import { descargarDetallePDF } from './solicitudActivacionPDF';
import {
  SolicitudPickerModal,
  type JCuentasCorpRow,
} from './SolicitudPickerModal';
import { lineaProdToTipo } from '../../hooks/useSolicitudesActivacionDB';
import { supabase } from '../../lib/supabaseClient';

type FormMode = 'nuevo' | 'editar' | 'ver';

interface SolicitudActivacionFormProps {
  mode: FormMode;
  solicitudId?: string | number;
  onCancel: () => void;
  onSave?: (data: SolicitudActivacionFormData, dbId?: string) => void;
}

const TABS = [
  { id: 'default', label: 'Default' },
  { id: 'detail',  label: 'Detail'  },
];

const CAT_ESTATUS = [
  { value: 'Pendiente',  label: 'Pendiente'  },
  { value: 'Cancelado',  label: 'Cancelado'  },
  { value: 'Pagado',     label: 'Pagado'     },
];

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function parseMoney(val: unknown): number {
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ─── Field component ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  field: keyof SolicitudActivacionFormData;
  formData: SolicitudActivacionFormData;
  onChange: (field: keyof SolicitudActivacionFormData, value: string | number) => void;
  errors: Record<string, string>;
  isRO: boolean;
  forceRO?: boolean;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

function Field({
  label, field, formData, onChange, errors, isRO, forceRO,
  type = 'text', required, options, placeholder,
}: FieldProps) {
  const value       = formData[field] as string | number;
  const effectiveRO = isRO || (forceRO ?? false);
  const err         = errors[field as string];

  return (
    <div className="flex flex-col min-h-[52px]">
      <label className="text-[10px] text-gray-600 mb-0.5">
        {label.toUpperCase()}
        {required && <span className="text-red-600"> *</span>}
      </label>

      {effectiveRO ? (
        <div className="px-2 py-1 text-xs text-gray-700">{String(value || '—')}</div>

      ) : options ? (
        <select
          value={String(value ?? '')}
          onChange={e => onChange(field, e.target.value)}
          className={`px-2 py-1 text-xs border rounded ${err ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
        >
          <option value="">Elige...</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

      ) : (
        <input
          type={type}
          value={String(value ?? '')}
          onChange={e => onChange(field, e.target.value)}
          placeholder={placeholder}
          className={`px-2 py-1 text-xs border rounded ${err ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
        />
      )}

      {err && <span className="text-[10px] text-red-500 mt-0.5">{err}</span>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="border-l-4 border-primary-theme px-3 py-1.5 border-t border-gray-300">
      <span className="text-xs font-medium text-gray-800 uppercase">{label}</span>
    </div>
  );
}

// ─── Datos Generales grid ─────────────────────────────────────────────────────

interface DatosGeneralesGridProps {
  formData: SolicitudActivacionFormData;
  onChange: (field: keyof SolicitudActivacionFormData, value: string | number) => void;
  errors: Record<string, string>;
  isRO: boolean;
  canEditEstatus?: boolean;
  onOpenSolicitudPicker?: () => void;
}

function DatosGeneralesGrid({
  formData, onChange, errors, isRO, canEditEstatus, onOpenSolicitudPicker,
}: DatosGeneralesGridProps) {
  const f = (p: Omit<FieldProps, 'formData' | 'onChange' | 'errors' | 'isRO'>) => (
    <Field {...p} formData={formData} onChange={onChange} errors={errors} isRO={isRO} />
  );

  const estatusBadgeClass =
    formData.estatus === 'Pagado'    ? 'text-green-700 bg-green-50 border-green-200'  :
    formData.estatus === 'Cancelado' ? 'text-red-700 bg-red-50 border-red-200'        :
    'text-amber-700 bg-amber-50 border-amber-200';

  const solicitudDisplay = formData.solicitudId || '';

  return (
    <div className="p-3">

      {/* ── 3-column grid — 9 fields, 3×3 ── */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">

        {/* Row 1 */}
        {/* Solicitud */}
        <div className="flex flex-col min-h-[52px]">
          <label className="text-[10px] text-gray-600 mb-0.5">
            SOLICITUD{!isRO && <span className="text-red-600"> *</span>}
          </label>
          <div className="flex items-center gap-2">
            <div className={`flex-1 px-2 py-1 text-xs border rounded min-h-[26px] text-gray-700 ${errors['solicitudId'] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50'}`}>
              {solicitudDisplay || <span className="text-gray-400 italic">Sin selección</span>}
            </div>
            {!isRO && (
              <button
                type="button"
                onClick={onOpenSolicitudPicker}
                className="px-3 py-1 text-xs border border-gray-400 rounded hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="5" cy="5" r="3.5" />
                  <path d="M8 8l2.5 2.5" strokeLinecap="round" />
                </svg>
                Buscar
              </button>
            )}
          </div>
          {errors['solicitudId'] && (
            <span className="text-[10px] text-red-500 mt-0.5">{errors['solicitudId']}</span>
          )}
        </div>
        {/* Número de Documento */}
        <div className="flex flex-col min-h-[52px]">
          <label className="text-[10px] text-gray-600 mb-0.5">NÚMERO DE DOCUMENTO</label>
          <div className="px-2 py-1 text-xs text-gray-700">
            {formData.numeroDocumento
              ? <span className="font-mono">{formData.numeroDocumento}</span>
              : <span className="text-gray-400 italic">Se generará al guardar</span>
            }
          </div>
        </div>
        {/* Estatus */}
        <div className="flex flex-col min-h-[52px]">
          <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS</label>
          {canEditEstatus ? (
            <select
              value={formData.estatus || 'Pendiente'}
              onChange={e => onChange('estatus', e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded"
            >
              {CAT_ESTATUS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <div className="px-2 py-1 text-xs text-gray-700">
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${estatusBadgeClass}`}>
                {formData.estatus || 'Pendiente'}
              </span>
            </div>
          )}
        </div>

        {/* Row 2 */}
        {f({ label: 'Producto',  field: 'producto', forceRO: true })}
        {f({ label: 'Cliente',   field: 'cliente',  forceRO: true })}
        {/* Fecha Solicitud */}
        <div className="flex flex-col min-h-[52px]">
          <label className="text-[10px] text-gray-600 mb-0.5">
            FECHA SOLICITUD{!isRO && <span className="text-red-600"> *</span>}
          </label>
          {isRO ? (
            <div className="px-2 py-1 text-xs text-gray-700">{formData.fechaSolicitud || '—'}</div>
          ) : (
            <input
              type="date"
              value={formData.fechaSolicitud || ''}
              onChange={e => onChange('fechaSolicitud', e.target.value)}
              className={`px-2 py-1 text-xs border rounded ${errors['fechaSolicitud'] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
          )}
          {errors['fechaSolicitud'] && (
            <span className="text-[10px] text-red-500 mt-0.5">{errors['fechaSolicitud']}</span>
          )}
        </div>

        {/* Row 3 */}
        {f({ label: 'Cuenta Bancaria', field: 'cuentaBancaria', forceRO: true })}
        {f({ label: 'Tipo',            field: 'type',           forceRO: true })}
        {/* Fecha Compromiso */}
        <div className="flex flex-col min-h-[52px]">
          <label className="text-[10px] text-gray-600 mb-0.5">
            FECHA COMPROMISO{!isRO && <span className="text-red-600"> *</span>}
          </label>
          {isRO ? (
            <div className="px-2 py-1 text-xs text-gray-700">{formData.fechaCompromiso || '—'}</div>
          ) : (
            <input
              type="date"
              value={formData.fechaCompromiso || ''}
              onChange={e => onChange('fechaCompromiso', e.target.value)}
              className={`px-2 py-1 text-xs border rounded ${errors['fechaCompromiso'] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
          )}
          {errors['fechaCompromiso'] && (
            <span className="text-[10px] text-red-500 mt-0.5">{errors['fechaCompromiso']}</span>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Información de Pago grid ─────────────────────────────────────────────────

interface InfoPagoGridProps {
  formData: SolicitudActivacionFormData;
  onChange: (field: keyof SolicitudActivacionFormData, value: string | number) => void;
  errors: Record<string, string>;
  isRO: boolean;
}

function InfoPagoGrid({ formData, onChange, errors, isRO }: InfoPagoGridProps) {
  const f = (p: Omit<FieldProps, 'formData' | 'onChange' | 'errors' | 'isRO'>) => (
    <Field {...p} formData={formData} onChange={onChange} errors={errors} isRO={isRO} />
  );

  return (
    <div className="p-3">
      <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">

        {/* Col 1 */}
        <div className="space-y-1.5">
          {f({ label: 'Forma de Pago', field: 'formaDePago', required: true, options: CAT_FORMA_PAGO })}
          {f({ label: 'Referencia',    field: 'referencia',  forceRO: true })}
        </div>

        {/* Col 2 */}
        <div className="space-y-1.5">
          {f({ label: 'Institución Financiera', field: 'institucionFinanciera', placeholder: 'Banco o institución', required: true })}
          {/* Monto Transacción — read-only, from selected SOLICITUD */}
          {f({ label: 'Monto Transacción', field: 'montoTransaccion', forceRO: true })}
        </div>

        {/* Col 3 */}
        <div className="space-y-1.5">
          {/* Moneda — read-only, from selected SOLICITUD */}
          {f({ label: 'Moneda', field: 'moneda', forceRO: true, options: CAT_MONEDA })}
        </div>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SolicitudActivacionForm({
  mode,
  solicitudId,
  onCancel,
  onSave,
}: SolicitudActivacionFormProps) {
  const storageId = mode === 'nuevo' ? 'new' : (solicitudId ?? 'new');
  const isRO      = mode === 'ver';

  // ── Form state ───────────────────────────────────────────────────
  const getInitial = useCallback((): SolicitudActivacionFormData => {
    const session = loadFromSession<SolicitudActivacionFormData>(storageId, 'form');
    if (session) return { ...EMPTY_FORM, ...session };
    if (mode === 'nuevo') return { ...EMPTY_FORM, fechaSolicitud: getTodayISO(), estatus: 'Pendiente' };
    return { ...EMPTY_FORM };
  }, [mode, solicitudId, storageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [formData,            setFormData]            = useState<SolicitudActivacionFormData>(getInitial);
  const [errors,              setErrors]              = useState<Record<string, string>>({});
  const [activeTab,           setActiveTab]           = useState<string>('default');
  const [solicitudPickerOpen, setSolicitudPickerOpen] = useState(false);
  const [activando,           setActivando]           = useState(false);

  useEffect(() => {
    setFormData(getInitial());
    setActiveTab('default');
  }, [solicitudId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open picker when creating a new record with no SOLICITUD pre-selected
  useEffect(() => {
    if (mode === 'nuevo' && !getInitial().solicitudId) {
      setSolicitudPickerOpen(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SOLICITUD selection ───────────────────────────────────────────
  const handleSolicitudSelect = (row: JCuentasCorpRow) => {
    const d      = (row.data || {}) as Record<string, unknown>;
    const solHdr = ((d.solicitud as Record<string, unknown> | undefined)?.header ?? {}) as Record<string, unknown>;

    const nombreCliente  = String(solHdr.nombre_cliente  || '');
    const nombreProducto = String(solHdr.nombre_producto || '');
    const montoNum       = parseMoney(row.monto_sol);
    const montoStr       = String(montoNum);
    const moneda         = String((d as Record<string, unknown>).moneda || 'MXN');
    const tipo           = lineaProdToTipo(String(row.linea_produc || ''));
    const claveProducto  = String(solHdr.producto_id || solHdr.clave_producto || row.linea_produc || '');
    const clienteId      = String((row as Record<string, unknown>).cliente_id || '');

    setFormData(prev => {
      const updated: SolicitudActivacionFormData = {
        ...prev,
        solicitudId:         row.id,
        clienteId,
        noSol:               String(row.no_sol    || ''),
        cuentaBancaria:      String(row.no_cuenta || ''),
        cliente:             nombreCliente,
        producto:            nombreProducto,
        type:                tipo,
        montoTransaccion:    montoStr,
        moneda,
        detailClaveProducto: claveProducto,
        detailMonto:         montoNum,
        detailMoneda:        moneda,
        detailSubTotal:      prev.detailCantidad * montoNum * (1 + prev.detailPctImpuesto),
      };
      saveToSession(storageId, 'form', updated);
      return updated;
    });
  };

  // ── Change handler ────────────────────────────────────────────────
  const handleChange = (field: keyof SolicitudActivacionFormData, value: string | number) => {
    if (isRO) return;
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      if (field === 'detailCantidad') {
        const qty = parseFloat(String(value)) || 0;
        updated.detailCantidad = qty;
        updated.detailSubTotal = qty * updated.detailMonto * (1 + updated.detailPctImpuesto);
      }

      saveToSession(storageId, 'form', updated);
      return updated;
    });
    if (errors[field as string]) setErrors(prev => { const e = { ...prev }; delete e[field as string]; return e; });
  };

  // ── Validation ───────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const today = getTodayISO();

    if (!formData.solicitudId)          errs.solicitudId          = 'Requerido';
    if (!formData.formaDePago)          errs.formaDePago          = 'Requerido';
    if (!formData.institucionFinanciera) errs.institucionFinanciera = 'Requerido';

    if (!formData.fechaSolicitud) {
      errs.fechaSolicitud = 'Requerido';
    } else if (formData.fechaSolicitud < today) {
      errs.fechaSolicitud = 'No puede ser menor a hoy';
    }

    if (!formData.fechaCompromiso) {
      errs.fechaCompromiso = 'Requerido';
    } else if (formData.fechaCompromiso < today) {
      errs.fechaCompromiso = 'No puede ser menor a hoy';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Activar Cuenta Financiera ─────────────────────────────────────
  const handleActivarCuenta = async () => {
    if (!validate()) {
      toast.error('Faltan campos requeridos', {
        description: 'Completa todos los campos obligatorios antes de activar.',
      });
      return;
    }
    const monto = formData.detailMonto;
    if (!monto || isNaN(monto) || monto <= 0) {
      toast.error('El Monto no es válido', {
        description: 'Selecciona una Solicitud con un monto definido antes de activar.',
      });
      return;
    }
    setActivando(true);
    try {
      const { data, error } = await supabase.rpc('activar_cuenta_financiera', {
        p_solicitud_id: formData.solicitudId,
        p_monto:        monto,
      });
      if (error) throw new Error(error.message);
      const affected = data as number;
      if (affected === 0) {
        toast.warning('No se encontró el registro en J_CUENTAS_CORP_CLIENTES');
      } else {
        toast.success('Cuenta Financiera activada exitosamente', {
          description: `Solicitud ${formData.solicitudId} → Formalizado / Activo / Autorizado`,
          duration: 4000,
        });
        setFormData(prev => {
          const updated = { ...prev, estatus: 'Pagado' as const };
          saveToSession(storageId, 'form', updated);
          return updated;
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Error al activar la cuenta', { description: msg, duration: 5000 });
    } finally {
      setActivando(false);
    }
  };

  const handleSubmit = () => {
    if (!validate()) { toast.error('Faltan campos requeridos'); return; }
    clearSession(storageId);
    onSave?.(formData, typeof solicitudId === 'string' ? solicitudId : undefined);
  };

  const montoNum = parseCurrency(formData.montoTransaccion);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-2.5 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="stroke-accent-theme" strokeWidth="1.5">
              <rect x="2" y="3" width="16" height="12" rx="1.5" />
              <path d="M7 9l2 2 4-4" />
            </svg>
            <span className="text-sm text-gray-700 font-normal">
              {mode === 'nuevo'  ? 'Nueva Solicitud de Activación'  :
               mode === 'editar' ? 'Editar Solicitud de Activación' :
                                   'Ver Solicitud de Activación'}
            </span>
            {formData.cliente && (
              <span className="text-xs text-gray-500 ml-1">— {formData.cliente}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button onClick={onCancel} className="text-accent-theme hover:underline">Lista</button>
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {!isRO && (
            <button
              onClick={handleSubmit}
              className="px-5 py-1.5 btn-secondary-theme rounded text-xs font-normal"
            >
              Guardar
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700"
          >
            {isRO ? 'Cerrar' : 'Cancelar'}
          </button>
          <button
            onClick={() => descargarDetallePDF(formData)}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6.5 1v7M3.5 5.5l3 3 3-3" />
              <path d="M1 10h11" strokeLinecap="round" />
            </svg>
            Descargar Detalle
          </button>
          {montoNum > 0 && (
            <span className="ml-4 text-xs text-gray-500">
              Monto: <span className="font-medium text-gray-700">{formatCurrency(montoNum)}</span>
            </span>
          )}
          <div className="ml-auto">
            <button
              onClick={handleActivarCuenta}
              disabled={formData.estatus !== 'Pagado' || activando}
              title={formData.estatus !== 'Pagado' ? 'El estatus debe ser Pagado para activar' : undefined}
              className="px-5 py-1.5 rounded text-xs font-normal border transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
                enabled:bg-green-600 enabled:border-green-700 enabled:text-white enabled:hover:bg-green-700"
            >
              {activando ? 'Activando...' : 'Activar Cuenta Financiera'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Form content ── */}
      <div className="px-4 py-3">
        <div className="bg-white border border-gray-300">

          {/* DATOS GENERALES */}
          <div className="border-l-4 border-primary-theme px-3 py-1.5">
            <span className="text-xs font-medium text-gray-800 uppercase">Datos Generales</span>
          </div>
          <DatosGeneralesGrid
            formData={formData}
            onChange={handleChange}
            errors={errors}
            isRO={isRO}
            canEditEstatus={mode === 'editar' || mode === 'nuevo'}
            onOpenSolicitudPicker={() => setSolicitudPickerOpen(true)}
          />

          {/* INFORMACIÓN DE PAGO */}
          <SectionTitle label="Información de Pago" />
          <InfoPagoGrid
            formData={formData}
            onChange={handleChange}
            errors={errors}
            isRO={isRO}
          />

          {/* ── Sub-tab bar ── */}
          <div className="bg-primary-theme border-t border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-[10px] whitespace-nowrap border-r border-gray-500/30 ${
                    activeTab === tab.id
                      ? 'bg-secondary-theme text-white font-medium'
                      : 'text-white/90'
                  }`}
                  style={activeTab !== tab.id ? { transition: 'background-color 0.2s' } : {}}
                  onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = 'var(--theme-primary-hover)'; }}
                  onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = ''; }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* DEFAULT tab */}
          {activeTab === 'default' && (
            <>
              <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2 border-t border-gray-300">
                <span className="text-sm font-medium text-gray-800">DEFAULT</span>
              </div>
              <div className="border-l-4 border-primary-theme px-3 py-1.5 border-t border-gray-300">
                <span className="text-xs font-medium text-gray-800 uppercase">Datos Generales</span>
              </div>
              <DatosGeneralesGrid
                formData={formData}
                onChange={handleChange}
                errors={errors}
                isRO={isRO}
                canEditEstatus={mode === 'editar' || mode === 'nuevo'}
                onOpenSolicitudPicker={() => setSolicitudPickerOpen(true)}
              />
              <SectionTitle label="Información de Pago" />
              <InfoPagoGrid
                formData={formData}
                onChange={handleChange}
                errors={errors}
                isRO={isRO}
              />
            </>
          )}

          {/* DETAIL tab */}
          {activeTab === 'detail' && (
            <div className="p-4">
              <SolicitudActivacionDetailTab
                storageId={storageId}
                isRO={isRO}
                claveProducto={formData.detailClaveProducto}
                monto={formData.detailMonto}
                pctImpuesto={formData.detailPctImpuesto}
                moneda={formData.detailMoneda}
                cantidad={formData.detailCantidad}
                onCantidadChange={n => handleChange('detailCantidad', n)}
              />
            </div>
          )}

        </div>
      </div>

      {/* ── SOLICITUD Picker Modal ── */}
      <SolicitudPickerModal
        open={solicitudPickerOpen}
        onClose={() => setSolicitudPickerOpen(false)}
        onSelect={handleSolicitudSelect}
      />

    </div>
  );
}
