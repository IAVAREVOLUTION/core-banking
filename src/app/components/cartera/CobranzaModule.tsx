import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GeneracionContableTab } from './GeneracionContableTab';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.split('T')[0].split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
}
function fmtMoney(n: number) {
  return n > 0
    ? `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';
}

interface Aviso {
  id: string;
  solicitud_id?: string;
  no_docto: string;
  fecha_compromiso?: string;
  tipo: string;
  sub_tipo?: string;
  cliente?: string;
  gobierno?: string;
  forma_pago?: string;
  cuenta_bancaria?: string;
  referencia?: string;
  monto_transaccion: number;
  moneda: string;
  estatus: string;
}

const CAT_FORMA_PAGO = ['Banca por internet', 'Transferencia', 'Cheque', 'Efectivo', 'SPEI', 'CIE'];

const statusClass = (estatus: string) => {
  if (estatus === 'Pagado')    return 'text-green-700 bg-green-50 border-green-200';
  if (estatus === 'Vencido')   return 'text-red-700 bg-red-50 border-red-200';
  if (estatus === 'Cancelado') return 'text-gray-600 bg-gray-50 border-gray-200';
  return 'text-amber-700 bg-amber-50 border-amber-200';
};

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, isRO, type = 'text', options, required }: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  isRO?: boolean;
  type?: string;
  options?: string[];
  required?: boolean;
}) {
  return (
    <div className="flex flex-col min-h-[52px]">
      <label className="text-[10px] text-gray-600 mb-0.5">
        {label.toUpperCase()}{required && <span className="text-red-600"> *</span>}
      </label>
      {isRO ? (
        <div className="px-2 py-1 text-xs text-gray-700">{value || '—'}</div>
      ) : options ? (
        <select value={value} onChange={e => onChange?.(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded bg-white">
          <option value="">Elige...</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange?.(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded bg-white" />
      )}
    </div>
  );
}

// ─── Secciones del form ───────────────────────────────────────────────────────
function DatosAviso({ aviso, edit, onChange }: {
  aviso: Aviso; edit: boolean;
  onChange: (field: keyof Aviso, value: string) => void;
}) {
  const RO = !edit;
  return (
    <div className="p-3">
      <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
        <div className="space-y-1.5">
          <Field label="No. Documento"   value={aviso.no_docto}      isRO />
          <Field label="Tipo"            value={aviso.sub_tipo || aviso.tipo} isRO />
          <Field label="Monto"           value={fmtMoney(aviso.monto_transaccion)} isRO />
        </div>
        <div className="space-y-1.5">
          <Field label="F. Compromiso"   value={aviso.fecha_compromiso?.split('T')[0] || ''}
            type="date" isRO={RO} onChange={v => onChange('fecha_compromiso', v)} />
          <Field label="Inst. Gobierno"  value={aviso.gobierno || ''} isRO />
          <Field label="Moneda"          value={aviso.moneda || 'MXN'} isRO />
        </div>
        <div className="space-y-1.5">
          <Field label="Cliente"         value={aviso.cliente || ''} isRO />
          <div className="flex flex-col min-h-[52px]">
            <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS</label>
            <div className="px-2 py-1 text-xs">
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${statusClass(aviso.estatus)}`}>
                {aviso.estatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPago({ aviso, edit, onChange }: {
  aviso: Aviso; edit: boolean;
  onChange: (field: keyof Aviso, value: string) => void;
}) {
  const RO = !edit;
  return (
    <div className="p-3">
      <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
        <div className="space-y-1.5">
          <Field label="Forma de Pago"   value={aviso.forma_pago || ''}  isRO={RO}
            options={CAT_FORMA_PAGO} onChange={v => onChange('forma_pago', v)} />
        </div>
        <div className="space-y-1.5">
          <Field label="Referencia"      value={aviso.referencia || ''}  isRO={RO}
            onChange={v => onChange('referencia', v)} />
        </div>
        <div className="space-y-1.5">
          <Field label="Cuenta Bancaria" value={aviso.cuenta_bancaria || ''} isRO />
        </div>
      </div>
    </div>
  );
}

// ─── Tipos para el detalle de factura ─────────────────────────────────────────
interface DetalleRow {
  id: string | number;
  cve_subproducto: string;
  descripcion_subproducto: string;
  cantidad: number;
  monto: number;
  porcentaje_impuesto: number;
  moneda: string;
  subtotal: number;
  estatus: string;
}

// ─── Tabla institucional de detalle (idéntica a SolicitudActivacionDetailTab) ──
function CobranzaDetailTable({ aviso, detalle, loading }: {
  aviso: Aviso;
  detalle: DetalleRow[];
  loading: boolean;
}) {
  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pctFmt = (n: number) => `${(Number(n) * 100).toFixed(2)} %`;
  const total = detalle.reduce((s, r) => s + (Number(r.subtotal) || 0), 0);

  const statusBadge = (est: string) => {
    const cls =
      est === 'Pagado'   ? 'text-green-700 bg-green-50 border-green-200' :
      est === 'Vencido'  ? 'text-red-700 bg-red-50 border-red-200' :
      'text-amber-700 bg-amber-50 border-amber-200';
    return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${cls}`}>{est}</span>;
  };

  return (
    <div className="space-y-4">
      {/* HEADER institucional */}
      <div className="border border-gray-300 bg-gray-50 p-3">
        <div className="text-xs font-semibold text-gray-700 mb-2 uppercase border-b border-gray-200 pb-1">
          Encabezado del Documento
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
          <div><span className="text-gray-500">No. Documento:</span>{' '}
            <span className="font-mono font-medium text-gray-800">{aviso.no_docto || '—'}</span>
          </div>
          <div><span className="text-gray-500">Fecha Compromiso:</span>{' '}
            <span className="text-gray-800">{aviso.fecha_compromiso ? aviso.fecha_compromiso.split('T')[0] : '—'}</span>
          </div>
          <div><span className="text-gray-500">Estatus:</span>{' '}
            {statusBadge(aviso.estatus)}
          </div>
          <div><span className="text-gray-500">Cliente:</span>{' '}
            <span className="text-gray-800">{aviso.cliente || '—'}</span>
          </div>
          <div><span className="text-gray-500">Solicitud ID:</span>{' '}
            <span className="font-mono text-gray-500 text-[10px]">{aviso.solicitud_id || '—'}</span>
          </div>
          <div><span className="text-gray-500">Referencia:</span>{' '}
            <span className="text-gray-800">{aviso.referencia || '—'}</span>
          </div>
          <div><span className="text-gray-500">Monto Transacción:</span>{' '}
            <span className="font-semibold text-gray-900">{fmt(aviso.monto_transaccion)}</span>
          </div>
          <div><span className="text-gray-500">Moneda:</span>{' '}
            <span className="text-gray-800">{aviso.moneda || 'MXN'}</span>
          </div>
          <div><span className="text-gray-500">Inst. Gobierno:</span>{' '}
            <span className="text-gray-800">{aviso.gobierno || '—'}</span>
          </div>
        </div>
      </div>

      {/* DETAIL table */}
      <div>
        <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-800">DETALLE DEL DOCUMENTO</span>
          <span className="text-xs text-gray-500">
            {loading ? 'Cargando...' : `${detalle.length} línea${detalle.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm border border-gray-200">
            <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#888" strokeWidth="2">
              <circle cx="8" cy="8" r="6" strokeDasharray="24" strokeDashoffset="12"/>
            </svg>
            Cargando detalle...
          </div>
        ) : (
          <div className="border border-gray-300">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header, #F3F4F6)' }}>
                  <th className="px-3 py-2 text-left  font-medium text-xs text-gray-800 border-r border-gray-300">SUBPRODUCTO</th>
                  <th className="px-3 py-2 text-left  font-medium text-xs text-gray-800 border-r border-gray-300">DESCRIPCIÓN</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-gray-800 border-r border-gray-300 w-20">CANTIDAD</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-gray-800 border-r border-gray-300">MONTO</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-gray-800 border-r border-gray-300 w-24">% IMPUESTO</th>
                  <th className="px-3 py-2 text-left  font-medium text-xs text-gray-800 border-r border-gray-300 w-16">MONEDA</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-gray-800 border-r border-gray-300">SUBTOTAL</th>
                  <th className="px-3 py-2 text-left  font-medium text-xs text-gray-800">ESTATUS</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {detalle.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-400 italic text-xs">
                      Sin líneas de detalle — el aviso puede no tener desglose registrado
                    </td>
                  </tr>
                ) : detalle.map((row, i) => (
                  <tr key={String(row.id || i)} className="border-b border-gray-200">
                    <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-800">{row.cve_subproducto}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-700">{row.descripcion_subproducto}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-700">{Number(row.cantidad).toLocaleString('es-MX')}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-700">{fmt(Number(row.monto))}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-700">{pctFmt(Number(row.porcentaje_impuesto))}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-700">{row.moneda || aviso.moneda || 'MXN'}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold text-gray-900">{fmt(Number(row.subtotal))}</td>
                    <td className="px-3 py-2">{statusBadge(row.estatus)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-400 bg-gray-50">
                  <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold text-gray-800">TOTAL GENERAL:</td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">{fmt(total || aviso.monto_transaccion)}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="mt-1 text-[10px] text-gray-400">Subtotal = Cantidad × Monto × (1 + % Impuesto)</p>
      </div>
    </div>
  );
}

// ─── AvisoForm — idéntico en estructura a SolicitudActivacionForm ─────────────
function AvisoForm({ aviso: inicial, mode, onBack, onPagado }: {
  aviso: Aviso;
  mode: 'editar' | 'ver';
  onBack: () => void;
  onPagado: (id: string) => void;
}) {
  const isRO    = mode === 'ver';
  const [aviso, setAviso] = useState<Aviso>(inicial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [activeTab, setActiveTab] = useState('default');
  const [detalle, setDetalle] = useState<DetalleRow[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const detalleLoaded = useRef(false);

  // Cargar detalle desde backend cuando se abre el tab Detail
  useEffect(() => {
    if (activeTab !== 'detail' || detalleLoaded.current) return;
    detalleLoaded.current = true;
    setLoadingDetalle(true);
    fetch(`${API_BASE}/cartera/facturas/${aviso.id}/detalle`, { headers: HDR })
      .then(r => r.json())
      .then(json => {
        if (json.detalle) setDetalle(json.detalle);
      })
      .catch(() => {})
      .finally(() => setLoadingDetalle(false));
  }, [activeTab, aviso.id]);

  const change = (field: keyof Aviso, value: string) => {
    setAviso(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/cartera/facturas/${aviso.id}`, {
        method: 'PATCH',
        headers: { ...HDR, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forma_pago:       aviso.forma_pago       || null,
          fecha_compromiso: aviso.fecha_compromiso || null,
          referencia:       aviso.referencia       || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) { toast.error(`Error al guardar: ${json.error}`); return; }
      toast.success('Aviso actualizado');
      setDirty(false);
    } catch (e: any) { toast.error(`Error: ${e.message}`); }
    finally { setSaving(false); }
  };

  const handleAplicarPago = async () => {
    setPaying(true);
    try {
      const res = await fetch(`${API_BASE}/cartera/facturas/${aviso.id}/pagar`, {
        method: 'PATCH',
        headers: { ...HDR, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) { toast.error(`Error: ${json.error}`); return; }
      toast.success('Pago aplicado exitosamente');
      setAviso(prev => ({ ...prev, estatus: 'Pagado' }));
      onPagado(aviso.id);
    } catch (e: any) { toast.error(`Error: ${e.message}`); }
    finally { setPaying(false); }
  };

  const puedeAplicarPago = !isRO && aviso.estatus === 'Pendiente';
  const yaPagado = aviso.estatus === 'Pagado';

  const TABS = [
    { id: 'default',   label: 'Default' },
    { id: 'detail',    label: 'Detail' },
    { id: 'contable',  label: 'Generación Contable' },
  ];

  return (
    <div className="bg-white min-h-screen">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-2.5 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="stroke-accent-theme" strokeWidth="1.5">
              <rect x="2" y="3" width="16" height="12" rx="1.5"/>
              <path d="M6 9l3 3 5-5"/>
            </svg>
            <span className="text-sm text-gray-700 font-normal">
              {mode === 'editar' ? 'Editar Aviso de Vencimiento' : 'Ver Aviso de Vencimiento'}
            </span>
            {aviso.cliente && (
              <span className="text-xs text-gray-500 ml-1">— {aviso.cliente}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button onClick={onBack} className="text-accent-theme hover:underline">Lista</button>
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {!isRO && dirty && (
            <button onClick={handleGuardar} disabled={saving}
              className="px-5 py-1.5 btn-secondary-theme rounded text-xs font-normal disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
          {puedeAplicarPago && (
            <button onClick={handleAplicarPago} disabled={paying}
              className="px-5 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center gap-1.5 font-medium disabled:opacity-50">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {paying ? 'Aplicando...' : 'Aplicar Pago'}
            </button>
          )}
          {yaPagado && (
            <span className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded text-xs">
              ✓ Aviso Pagado
            </span>
          )}
          <button onClick={onBack}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700">
            {isRO ? 'Cerrar' : 'Cancelar'}
          </button>
          <span className="ml-4 text-xs text-gray-500">
            Monto: <span className="font-medium text-gray-700">{fmtMoney(aviso.monto_transaccion)}</span>
          </span>
        </div>
      </div>

      {/* ── Form content ── */}
      <div className="px-4 py-3">
        <div className="bg-white border border-gray-300">

          {/* Datos del Aviso */}
          <div className="border-l-4 border-primary-theme px-3 py-1.5">
            <span className="text-xs font-medium text-gray-800 uppercase">Datos del Aviso</span>
          </div>
          <DatosAviso aviso={aviso} edit={!isRO} onChange={change} />

          {/* Información de Pago */}
          <div className="border-l-4 border-primary-theme px-3 py-1.5 border-t border-gray-300">
            <span className="text-xs font-medium text-gray-800 uppercase">Información de Pago</span>
          </div>
          <InfoPago aviso={aviso} edit={!isRO} onChange={change} />

          {/* Tab bar */}
          <div className="bg-primary-theme border-t border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-[10px] whitespace-nowrap border-r border-gray-500/30 ${
                    activeTab === tab.id ? 'bg-secondary-theme text-white font-medium' : 'text-white/90'
                  }`}
                  onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = 'var(--theme-primary-hover)'; }}
                  onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = ''; }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Default tab */}
          {activeTab === 'default' && (
            <>
              <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2 border-t border-gray-300">
                <span className="text-sm font-medium text-gray-800">DEFAULT</span>
              </div>
              <div className="border-l-4 border-primary-theme px-3 py-1.5 border-t border-gray-300">
                <span className="text-xs font-medium text-gray-800 uppercase">Datos del Aviso</span>
              </div>
              <DatosAviso aviso={aviso} edit={!isRO} onChange={change} />
              <div className="border-l-4 border-primary-theme px-3 py-1.5 border-t border-gray-300">
                <span className="text-xs font-medium text-gray-800 uppercase">Información de Pago</span>
              </div>
              <InfoPago aviso={aviso} edit={!isRO} onChange={change} />
            </>
          )}

          {/* Detail tab — Header institucional + tabla de subproductos */}
          {activeTab === 'detail' && (
            <div className="p-4">
              <CobranzaDetailTable
                aviso={aviso}
                detalle={detalle}
                loading={loadingDetalle}
              />
            </div>
          )}

          {/* Generación Contable tab */}
          {activeTab === 'contable' && (
            <div className="p-4">
              {aviso.solicitud_id ? (
                <GeneracionContableTab
                  solicitudId={aviso.solicitud_id}
                  credito={{
                    noSol:    aviso.no_docto || aviso.id,
                    cliente:  aviso.cliente  || '',
                    montoAut: aviso.monto_transaccion || 0,
                  }}
                  componentes={detalle.filter(r => Number(r.monto) > 0).map(r => ({
                    id_componente: r.descripcion_subproducto || r.cve_subproducto,
                    monto:         Number(r.monto),
                  }))}
                />
              ) : (
                <div className="py-8 text-center text-xs text-gray-400">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-2">
                    <circle cx="16" cy="16" r="12"/><path d="M16 10v6M16 20v2" strokeLinecap="round"/>
                  </svg>
                  <p>Este aviso no tiene un crédito vinculado.</p>
                  <p className="mt-1 text-gray-300">La Generación Contable requiere una solicitud de crédito asociada.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Panel con view state list / form ─────────────────────────────────────────
type ViewState = { type: 'list' } | { type: 'form'; mode: 'editar' | 'ver'; aviso: Aviso };

function AvisosVencimientoPanel({ subTipoFijo, titulo }: { subTipoFijo?: string; titulo: string }) {
  const [view,          setView]         = useState<ViewState>({ type: 'list' });
  const [rows,          setRows]         = useState<Aviso[]>([]);
  const [loading,       setLoading]      = useState(false);
  const [filterEstatus, setFilterEstatus]= useState('');
  const [searchTerm,    setSearchTerm]   = useState('');
  const [sortOrder,     setSortOrder]    = useState<'desc' | 'asc'>('desc');
  const [currentPage,   setCurrentPage]  = useState(1);
  const ITEMS_PER_PAGE = 10;
  const tableRef  = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subTipoFijo)   params.set('sub_tipo', subTipoFijo);
      if (filterEstatus) params.set('estatus',  filterEstatus);
      const res  = await fetch(`${API_BASE}/cartera/cobranza?${params}`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows((json.data || []).map((r: any) => ({
        ...r,
        monto_transaccion: Number.parseFloat(String(r.monto_transaccion || '0').replace(/[$,\s]/g, '')) || 0,
      })));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [subTipoFijo, filterEstatus]);

  useEffect(() => { cargar(); }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterEstatus) list = list.filter(r => r.estatus === filterEstatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(r =>
        (r.no_docto   || '').toLowerCase().includes(q) ||
        (r.cliente    || '').toLowerCase().includes(q) ||
        (r.referencia || '').toLowerCase().includes(q) ||
        (r.gobierno   || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) =>
      sortOrder === 'desc'
        ? (b.fecha_compromiso || '').localeCompare(a.fecha_compromiso || '')
        : (a.fecha_compromiso || '').localeCompare(b.fecha_compromiso || '')
    );
  }, [rows, filterEstatus, searchTerm, sortOrder]);

  const totalPages   = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const buildTableHTML = (titulo: string) => {
    const rows = filtered.map(r => `
      <tr>
        <td>${r.no_docto || '—'}</td>
        <td>${fmtDate(r.fecha_compromiso)}</td>
        <td>${r.sub_tipo || r.tipo || '—'}</td>
        <td>${r.gobierno || '—'}</td>
        <td>${r.cliente || '—'}</td>
        <td>${r.referencia || '—'}</td>
        <td style="text-align:right">${fmtMoney(r.monto_transaccion)}</td>
        <td>${r.moneda || 'MXN'}</td>
        <td>${r.estatus}</td>
      </tr>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${titulo}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
        h2 { font-size: 13px; margin-bottom: 4px; }
        p.meta { font-size: 9px; color: #666; margin-bottom: 12px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #374151; color: #fff; padding: 5px 8px; text-align: left; font-size: 9px; }
        td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        @media print { body { margin: 10mm; } }
      </style></head><body>
      <h2>${titulo}</h2>
      <p class="meta">Generado: ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })} — ${filtered.length} registro(s)</p>
      <table>
        <thead><tr>
          <th>NO. DOCUMENTO</th><th>F. COMPROMISO</th><th>TIPO</th>
          <th>INST. GOBIERNO</th><th>CLIENTE</th><th>REFERENCIA</th>
          <th>MONTO</th><th>MONEDA</th><th>ESTATUS</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;
  };

  const exportPDF = () => {
    const html = buildTableHTML(titulo);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handleImprimir = () => {
    const html = buildTableHTML(titulo);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const exportCSV = () => {
    const headers = ['No. Documento','F. Compromiso','Tipo','Inst. Gobierno','Cliente','Referencia','Monto','Moneda','Estatus'];
    const lines = filtered.map(r => [
      r.no_docto, fmtDate(r.fecha_compromiso), r.sub_tipo || r.tipo,
      r.gobierno || '', r.cliente || '', r.referencia || '',
      r.monto_transaccion, r.moneda, r.estatus,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv  = '﻿' + [headers.join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `cobranza_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Form view ──────────────────────────────────────────────────────
  if (view.type === 'form') {
    return (
      <AvisoForm
        aviso={view.aviso}
        mode={view.mode}
        onBack={() => setView({ type: 'list' })}
        onPagado={id => {
          setRows(prev => prev.map(r => r.id === id ? { ...r, estatus: 'Pagado' } : r));
          setView({ type: 'list' });
        }}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
              <path d="M6 9l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">{titulo}</h2>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700 transition-colors">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280"/><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
              Generar CSV
            </button>
            <span onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="cursor-pointer hover:text-secondary-theme transition-colors">Lista</span>
            <span onClick={() => searchRef.current?.focus()}
              className="cursor-pointer hover:text-secondary-theme transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[280px]">
              <option>Vista general de {titulo}</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666">
              <path d="M6 8l-4-4h8z"/>
            </svg>
          </div>
          <button onClick={cargar} disabled={loading}
            className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
            {loading ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="2">
                <circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="1.5">
                <path d="M1 7a6 6 0 0111.196-3M13 7a6 6 0 01-11.196 3"/><path d="M1 1v3h3M13 13v-3h-3"/>
              </svg>
            )}
            Refrescar
          </button>
        </div>
      </div>

      {/* ── Search / Status ── */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">Estatus</span>
            <div className="relative">
              <select value={filterEstatus} onChange={e => { setFilterEstatus(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1 border border-gray-400 rounded text-sm bg-white appearance-none pr-7">
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Pagado">Pagado</option>
                <option value="Vencido">Vencido</option>
                <option value="Cancelado">Cancelado</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 12 12" fill="#666">
                <path d="M6 8l-4-4h8z"/>
              </svg>
            </div>
          </div>
          <input ref={searchRef} type="text" value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por No. Documento, cliente, referencia, institución..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-80 transition-all"/>
        </div>
      </div>

      {/* ── Export / Sort ── */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="CSV" onClick={exportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280"/><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors" title="Excel" onClick={exportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B"/><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2"/></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors" title="PDF" onClick={exportPDF}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F"/><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none"/><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2"/></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors" title="Imprimir" onClick={handleImprimir}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2"/><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none"/><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2"/><circle cx="5" cy="8" r="0.8" fill="#1976D2"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden</span>
              <select value={sortOrder} onChange={e => { setSortOrder(e.target.value as 'desc' | 'asc'); setCurrentPage(1); }}
                className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            <span className="font-medium">Total: {filtered.length}</span>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">Editar | Ver</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">NO. DOCUMENTO</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">F. COMPROMISO</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">TIPO</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">INST. GOBIERNO</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">CLIENTE</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">REFERENCIA</th>
                <th className="px-2 py-2.5 text-right font-medium text-xs text-gray-700">MONTO TRANSACCIÓN</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">MONEDA</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">ESTATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="2">
                      <circle cx="8" cy="8" r="6" strokeDasharray="24" strokeDashoffset="12"/>
                    </svg>
                    Cargando avisos...
                  </div>
                </td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  No se encontraron avisos de vencimiento
                </td></tr>
              ) : currentItems.map((r, idx) => (
                <tr key={r.id}
                  className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E8F4F8')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF')}
                >
                  <td className="px-2 py-2.5 text-xs whitespace-nowrap">
                    <a href="#" className="text-[#0066CC] hover:underline"
                      onClick={e => { e.preventDefault(); setView({ type: 'form', mode: 'editar', aviso: r }); }}>Editar</a>
                    <span className="text-gray-500"> | </span>
                    <a href="#" className="text-[#0066CC] hover:underline"
                      onClick={e => { e.preventDefault(); setView({ type: 'form', mode: 'ver', aviso: r }); }}>Ver</a>
                  </td>
                  <td className="px-2 py-2.5 text-xs font-mono text-[#0066CC]">{r.no_docto || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 whitespace-nowrap">{fmtDate(r.fecha_compromiso)}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700">{r.sub_tipo || r.tipo}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[120px] truncate" title={r.gobierno}>{r.gobierno || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[140px] truncate" title={r.cliente}>{r.cliente || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-600 max-w-[120px] truncate" title={r.referencia}>{r.referencia || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-right text-gray-700 font-mono">{fmtMoney(r.monto_transaccion)}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700">{r.moneda || '—'}</td>
                  <td className="px-2 py-2.5 text-xs">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${statusClass(r.estatus)}`}>
                      {r.estatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40"
            onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z"/></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40"
            onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z"/></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">
            Página {currentPage} de {totalPages}
          </div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40"
            onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z"/></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40"
            onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Módulo principal ─────────────────────────────────────────────────────────
export function CobranzaModule() {
  const [activeTab, setActiveTab] = useState<'creditos' | 'aportaciones'>('creditos');

  return (
    <>
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button onClick={() => setActiveTab('creditos')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${activeTab === 'creditos' ? 'tab-active' : 'tab-inactive'}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 7h12M5 3V2M11 3V2"/>
            </svg>
            Avisos de Vencimiento — Créditos
          </button>
          <button onClick={() => setActiveTab('aportaciones')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${activeTab === 'aportaciones' ? 'tab-active' : 'tab-inactive'}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2" strokeLinecap="round"/>
            </svg>
            Avisos de Aportación — Captación
          </button>
        </div>
      </div>

      {activeTab === 'creditos' && (
        <AvisosVencimientoPanel key="creditos"  subTipoFijo="Amortizacion" titulo="Avisos de Vencimiento — Créditos" />
      )}
      {activeTab === 'aportaciones' && (
        <AvisosVencimientoPanel key="aportaciones" subTipoFijo="Aportacion" titulo="Avisos de Aportación — Captación" />
      )}
    </>
  );
}
