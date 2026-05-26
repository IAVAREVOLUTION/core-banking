/**
 * SolicitudActivacionForm.tsx
 *
 * Layout (exact Clientes module pattern):
 *   [Header bar]
 *   [Action buttons bar — Guardar / Cancelar at top, no sticky footer]
 *   [Content px-4 py-3]
 *     [bg-white border border-gray-300 container]
 *       [Section header: DATOS GENERALES]
 *       [grid-cols-3 fields]
 *       [Section header: INFORMACIÓN DE PAGO]
 *       [grid-cols-3 fields]
 *       [Sub-tab bar: bg-primary-theme — Default | Detail]
 *       [Default tab: repeat of both sections]
 *       [Detail tab: SolicitudActivacionDetailTab (unchanged)]
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { createClient } from '@supabase/supabase-js';
import { avanzarFaseSolicitudDB } from '../../hooks/useSolicitudesDB';
import {
  type SolicitudActivacionFormData,
  EMPTY_FORM,
  CAT_FORMA_PAGO,
  CAT_MONEDA,
  saveToSession,
  loadFromSession,
  clearSession,
  getFechaSolicitudNow,
  formatCurrency,
  parseCurrency,
} from './solicitudActivacionStore';

const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);
import { SolicitudActivacionDetailTab } from './SolicitudActivacionDetailTab';
import { descargarDetallePDF } from './solicitudActivacionPDF';
import { GeneracionContableTab } from '../cartera/GeneracionContableTab';

type FormMode = 'nuevo' | 'editar' | 'ver';

interface SolicitudActivacionFormProps {
  mode: FormMode;
  solicitudId?: string | number;
  /** Datos de pre-relleno (usados cuando mode='nuevo' y se abre desde Originación) */
  initialData?: Partial<SolicitudActivacionFormData>;
  onCancel: () => void;
  onSave?: (data: SolicitudActivacionFormData, dbId?: string) => void;
  /** Llamado cuando el usuario presiona "Enviar Solicitud" — cambia estatus a Enviada y guarda */
  onEnviar?: (data: SolicitudActivacionFormData, dbId?: string) => void;
}

const TABS = [
  { id: 'default',  label: 'Default' },
  { id: 'detail',   label: 'Detail'  },
  { id: 'contable', label: 'Generación Contable' },
];

// ─── Field component — Clientes exact pattern ─────────────────────────────────

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
  const err         = errors[field];

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

// ─── Section header — Clientes exact pattern ──────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="border-l-4 border-primary-theme px-3 py-1.5 border-t border-gray-300">
      <span className="text-xs font-medium text-gray-800 uppercase">{label}</span>
    </div>
  );
}

// ─── Reusable field grid for both master and Default tab ──────────────────────

const CAT_ESTATUS = [
  { value: 'Pendiente',  label: 'Pendiente'  },
  { value: 'Enviada',    label: 'Enviada'    },
  { value: 'Pagado',     label: 'Pagado'     },
  { value: 'Autorizada', label: 'Autorizada' },
  { value: 'Activo',     label: 'Activo'     },
  { value: 'Activada',   label: 'Activada'   },
  { value: 'Rechazada',  label: 'Rechazada'  },
];

interface FieldGridProps {
  formData: SolicitudActivacionFormData;
  onChange: (field: keyof SolicitudActivacionFormData, value: string | number) => void;
  errors: Record<string, string>;
  isRO: boolean;
  canEditEstatus?: boolean;
}

function DatosGeneralesGrid({ formData, onChange, errors, isRO, canEditEstatus }: FieldGridProps) {
  const f = (p: Omit<FieldProps, 'formData' | 'onChange' | 'errors' | 'isRO'>) => (
    <Field {...p} formData={formData} onChange={onChange} errors={errors} isRO={isRO} />
  );

  const estatusBadgeClass =
    formData.estatus === 'Activada'    ? 'text-green-700 bg-green-50 border-green-200'     :
    formData.estatus === 'Activo'      ? 'text-green-700 bg-green-50 border-green-200'     :
    formData.estatus === 'Pagado'      ? 'text-green-700 bg-green-50 border-green-200'     :
    formData.estatus === 'Enviada'     ? 'text-blue-700 bg-blue-50 border-blue-200'        :
    formData.estatus === 'Aprobada'    ? 'text-purple-700 bg-purple-50 border-purple-200'  :
    formData.estatus === 'En Revisión' ? 'text-blue-700 bg-blue-50 border-blue-200'        :
    formData.estatus === 'Rechazada'   ? 'text-red-700 bg-red-50 border-red-200'           :
    'text-amber-700 bg-amber-50 border-amber-200';

  return (
    <div className="p-3">
      <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">

        {/* Col 1 */}
        <div className="space-y-1.5">
          {f({ label: 'Id Solicitud',     field: 'solicitudId',    forceRO: true })}
          {f({ label: 'Tipo',             field: 'type',           forceRO: true })}
          {f({ label: 'Cuenta Bancaria',  field: 'cuentaBancaria', forceRO: true })}
        </div>

        {/* Col 2 */}
        <div className="space-y-1.5">
          {f({ label: 'Número de Documento', field: 'numeroDocumento', forceRO: true })}
          {f({ label: 'Cliente',             field: 'cliente',         forceRO: true })}
          {/* Estatus — dropdown in edit mode, badge otherwise */}
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
        </div>

        {/* Col 3 */}
        <div className="space-y-1.5">
          {f({ label: 'Fecha Solicitud',  field: 'fechaSolicitud',  forceRO: true })}
          {f({ label: 'Fecha Compromiso', field: 'fechaCompromiso', placeholder: 'DD/MM/YYYY' })}
        </div>

      </div>
    </div>
  );
}

function InfoPagoGrid({ formData, onChange, errors, isRO }: FieldGridProps) {
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
          {f({ label: 'Institución Financiera', field: 'institucionFinanciera', placeholder: 'Banco o institución' })}
          {f({ label: 'Monto Transacción',      field: 'montoTransaccion',      type: 'number', placeholder: '0.00' })}
        </div>

        {/* Col 3 */}
        <div className="space-y-1.5">
          {f({ label: 'Moneda', field: 'moneda', options: CAT_MONEDA })}
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
  initialData,
  onCancel,
  onSave,
  onEnviar,
}: SolicitudActivacionFormProps) {
  const storageId = mode === 'nuevo' ? 'new' : (solicitudId ?? 'new');
  const isRO      = mode === 'ver';

  // ── Form state ───────────────────────────────────────────────────
  const getInitial = useCallback((): SolicitudActivacionFormData => {
    // 1. nuevo: initialData tiene prioridad (evita race condition)
    if (initialData && mode === 'nuevo') {
      return { ...EMPTY_FORM, fechaSolicitud: getFechaSolicitudNow(), estatus: 'Pendiente', ...initialData };
    }
    // 2. Sesión (aplica a todos los modos)
    const session = loadFromSession<SolicitudActivacionFormData>(storageId, 'form');
    if (session) return { ...EMPTY_FORM, ...session };
    // 3. initialData fallback para editar/ver cuando la sesión no está disponible
    if (initialData) return { ...EMPTY_FORM, ...initialData };
    if (mode === 'nuevo') return { ...EMPTY_FORM, fechaSolicitud: getFechaSolicitudNow(), estatus: 'Pendiente' };
    return { ...EMPTY_FORM };
  }, [mode, solicitudId, storageId, initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  const [formData,  setFormData]  = useState<SolicitudActivacionFormData>(getInitial);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('default');
  // Estatus con que se abrió el formulario — si ya era Pagado no mostrar botón Activar
  const estatusAlAbrir = useRef<string>(getInitial().estatus);

  useEffect(() => {
    setFormData(getInitial());
    setActiveTab('default');
  }, [solicitudId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Change handler with mirror logic ─────────────────────────────
  const handleChange = (field: keyof SolicitudActivacionFormData, value: string | number) => {
    if (isRO) return;
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      if (field === 'montoTransaccion') {
        const monto = parseCurrency(String(value));
        updated.detailMonto    = monto;
        updated.detailSubTotal = updated.detailCantidad * monto * (1 + updated.detailPctImpuesto);
      }
      if (field === 'moneda') {
        updated.detailMoneda = String(value);
      }
      if (field === 'detailCantidad') {
        const qty = parseFloat(String(value)) || 0;
        updated.detailCantidad = qty;
        updated.detailSubTotal = qty * updated.detailMonto * (1 + updated.detailPctImpuesto);
      }

      saveToSession(storageId, 'form', updated);
      return updated;
    });
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  };

  // ── Validation ───────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.formaDePago) errs.formaDePago = 'Requerido';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) { toast.error('Faltan campos requeridos'); return; }
    clearSession(storageId);
    onSave?.(formData, typeof solicitudId === 'string' ? solicitudId : undefined);
  };

  /** Enviar = guardar con estatus "Enviada". Registra fecha de envío en data. */
  const handleEnviarSolicitud = () => {
    if (!validate()) { toast.error('Faltan campos requeridos'); return; }
    if (['Enviada', 'Pagado', 'Activo', 'Autorizada', 'Activada'].includes(formData.estatus)) {
      toast.info(`La solicitud ya tiene estatus: ${formData.estatus}.`); return;
    }
    const dataEnviada: SolicitudActivacionFormData = {
      ...formData,
      estatus: 'Enviada',
    };
    clearSession(storageId);
    const dbId = typeof solicitudId === 'string' ? solicitudId : undefined;
    if (onEnviar) {
      onEnviar(dataEnviada, dbId);
    } else {
      onSave?.(dataEnviada, dbId);
    }
  };

  /**
   * Activar — aparece cuando estatus = 'Pagado'.
   * Cambia estatus a 'Pagado', guarda y avanza la fase en BD.
   */
  const handleActivar = async () => {
    if (!validate()) { toast.error('Faltan campos requeridos'); return; }

    // Validación por Línea de Producto: Crédito/Captación requieren estatus='Pagado'
    const lineaNorm = (formData.lineaProducto || '')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const esLineaCredLocal = lineaNorm.includes('linea');
    if (!esLineaCredLocal && formData.estatus !== 'Pagado') {
      toast.error('Debe estar en estatus Pagado para activar', {
        description: `Estatus actual: ${formData.estatus || 'Pendiente'}`,
      });
      return;
    }

    // Guardar primero en la tabla de activación
    const dataActivar: SolicitudActivacionFormData = {
      ...formData,
      estatus: 'Pagado',
      _fromActivar: true,
    };
    clearSession(storageId);
    const dbId = typeof solicitudId === 'string' ? solicitudId : undefined;
    
    // Si hay callback externo (desde SolicitudCreditoForm), usarlo
    if (onEnviar) {
      onEnviar(dataActivar, dbId);
      return;
    }
    if (onSave) {
      onSave?.(dataActivar, dbId);
      return;
    }
    
    // SIN callback externo: guardar directamente y avanzar fase
    try {
      const solId = formData.solicitud_id || formData.originacionSolicitudId;
      if (solId) {
        await supabase.from('EFINANCIANET_DB.J_CUENTAS_CORP_CLIENTES').update({
          estatus: 'Aprobado',
          faseId: '3_completada',
          descripcionFase: 'Completada',
        }).eq('id', solId);
        toast.success('¡Solicitud completada!', { description: 'Fase finalizada — Estatus: Aprobado' });
      }
    } catch (err) {
      console.error('Error advancing phase:', err);
    }
  };

  const esPagado      = formData.estatus === 'Pagado';
  const esLineaCredito = (formData.lineaProducto || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('linea');
  // No mostrar Activar si el registro ya lleg\u00f3 con estatus Pagado (o superior) desde la BD
  const estatusFinales = ['Pagado', 'Autorizada', 'Activada', 'Activo'];
  const yaEraActivado  = estatusFinales.includes(estatusAlAbrir.current);
  const puedeActivar   = !yaEraActivado && (esPagado || esLineaCredito);
  // Cualquier estatus "post-enviado" que no sea Pagado: no mostrar bot\u00f3n Enviar
  const yaEnviada = ['Enviada', 'Activo', 'Autorizada', 'Activada'].includes(formData.estatus);

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
          {/* Enviar — visible cuando Pendiente o En Revisión (no Pagado ni Enviada, no Línea de Crédito) */}
          {!isRO && !esPagado && !yaEnviada && !esLineaCredito && (
            <button
              onClick={handleEnviarSolicitud}
              className="px-5 py-1.5 bg-[#2E5C91] text-white rounded text-xs hover:bg-[#1E4A75] flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
              Enviar Solicitud de Activación
            </button>
          )}
          {/* Activar — solo cuando el estatus acaba de cambiar a Pagado (no si ya llegó así) */}
          {!isRO && puedeActivar && (
            <button
              onClick={handleActivar}
              className="px-5 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center gap-1.5 font-medium"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Activar
            </button>
          )}
          {yaEnviada && (
            <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded text-xs">
              ✓ Solicitud {formData.estatus}
            </span>
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
            canEditEstatus={mode === 'editar'}
          />

          {/* INFORMACIÓN DE PAGO */}
          <SectionTitle label="Información de Pago" />
          <InfoPagoGrid
            formData={formData}
            onChange={handleChange}
            errors={errors}
            isRO={isRO}
          />

          {/* ── Sub-tab bar — exact Clientes pattern ── */}
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

          {/* DEFAULT tab — repeat of form fields (intentional, Clientes pattern) */}
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
                canEditEstatus={mode === 'editar'}
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

          {/* DETAIL tab — unchanged */}
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

          {/* GENERACIÓN CONTABLE tab */}
          {activeTab === 'contable' && (
            <div className="p-4">
              <GeneracionContableTab
                solicitudId={formData.solicitudId || (typeof solicitudId === 'string' ? solicitudId : String(solicitudId ?? ''))}
                credito={{
                  noSol:    formData.numeroDocumento || formData.solicitudId || '',
                  cliente:  formData.cliente || '',
                  montoAut: parseCurrency(formData.montoTransaccion),
                }}
                componentes={formData.detailMonto > 0
                  ? [{ id_componente: 'CAPITAL', monto: formData.detailMonto }]
                  : undefined
                }
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
