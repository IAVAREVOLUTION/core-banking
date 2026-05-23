import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { GL_JOURNAL_URL, GL_BASE_URL, GL_HEADERS } from '../../hooks/usePolizasContablesDB';
import type { PolizaContable } from './PolizasContablesModule';
import { CuentaFinancieraPickerModal } from './CuentaFinancieraPickerModal';

type FormMode = 'create' | 'edit' | 'view';

interface Props {
  mode: FormMode;
  poliza?: PolizaContable;
  onSave: () => void;
  onCancel: () => void;
}

interface EventoContable {
  id: string;
  codigo: string;
  evento: string;
  prompt_ia: string;
}

interface CuentaContable {
  id: string;
  cuenta_gl: string;
  nombre: string;
}

interface ComponenteContable {
  id: string;
  codigo: string;
  nombre: string;
}

interface DetalleRow {
  cuenta_contable_id: string;
  cuenta_contable_gl: string;
  cuenta_contable_nombre: string;
  debito: string;
  credito: string;
  componente_id: string;
  componente_codigo: string;
  componente_nombre: string;
}

const EMPTY_DET: DetalleRow = {
  cuenta_contable_id: '', cuenta_contable_gl: '', cuenta_contable_nombre: '',
  debito: '', credito: '',
  componente_id: '', componente_codigo: '', componente_nombre: '',
};

const STATUSES: PolizaContable['status'][] = ['Creada', 'Validada', 'Posteada'];

export function PolizaContableForm({ mode, poliza, onSave, onCancel }: Props) {
  const isView = mode === 'view';
  const [saving, setSaving] = useState(false);

  // ── Columnas físicas ──────────────────────────────────────────────
  const [journalDate, setJournalDate] = useState(
    poliza?.journal_date || new Date().toISOString().split('T')[0]
  );
  const [accountId, setAccountId]   = useState(poliza?.account_id || '');
  const [noCuenta, setNoCuenta]     = useState('');
  const [productoId, setProductoId] = useState(poliza?.producto_id || '');
  const [eventCode, setEventCode]   = useState(poliza?.event_code || '');
  const [currency, setCurrency]     = useState(poliza?.currency || '');
  const [status, setStatus]         = useState<PolizaContable['status']>(poliza?.status || 'Creada');

  // ── Tab Detalle — filas ──────────────────────────────────────────
  const [detalleRows, setDetalleRows] = useState<DetalleRow[]>(
    () => Array.isArray(poliza?.data?.Detalle) ? poliza!.data.Detalle : []
  );

  // Totales calculados desde el tab Detalle
  const totalDebit  = detalleRows.reduce((s, r) => s + (parseFloat(r.debito)  || 0), 0);
  const totalCredit = detalleRows.reduce((s, r) => s + (parseFloat(r.credito) || 0), 0);

  // ── Catálogos ─────────────────────────────────────────────────────
  const [eventos, setEventos]               = useState<EventoContable[]>([]);
  const [cuentasContables, setCuentasContables] = useState<CuentaContable[]>([]);
  const [catComponentes, setCatComponentes] = useState<ComponenteContable[]>([]);
  const [catLoading, setCatLoading]         = useState(false);

  // ── Modales ───────────────────────────────────────────────────────
  const [cuentaModalOpen, setCuentaModalOpen] = useState(false);
  const [detModalOpen, setDetModalOpen]       = useState(false);
  const [detForm, setDetForm]                 = useState<DetalleRow>(EMPTY_DET);

  // ── Tab activo ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'default' | 'detalle'>('default');

  useEffect(() => {
    let cancelled = false;
    setCatLoading(true);
    Promise.all([
      fetch(`${GL_BASE_URL}/eventos-contables`,    { headers: GL_HEADERS }).then(r => r.json()),
      fetch(`${GL_BASE_URL}/catalogos-contables`,  { headers: GL_HEADERS }).then(r => r.json()),
      fetch(`${GL_BASE_URL}/componentes-contables`, { headers: GL_HEADERS }).then(r => r.json()),
    ]).then(([ev, cu, co]) => {
      if (cancelled) return;
      if (Array.isArray(ev.data)) setEventos(ev.data);
      if (Array.isArray(cu.data)) setCuentasContables(cu.data);
      if (Array.isArray(co.data)) setCatComponentes(co.data);
    }).catch(() => {}).finally(() => { if (!cancelled) setCatLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleCuentaSelect = (result: { account_id: string; no_cuenta: string; producto_id: string; producto_display: string; cliente_id: string; cliente_nombre: string; moneda: string }) => {
    setAccountId(result.account_id);
    setNoCuenta(result.no_cuenta);
    setProductoId(result.producto_id);
    if (result.moneda) setCurrency(result.moneda);
  };

  const handleEventoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEventCode(e.target.value);
  };

  // ── Detalle modal ─────────────────────────────────────────────────
  const openDetModal = () => { setDetForm(EMPTY_DET); setDetModalOpen(true); };

  const addDetalleRow = () => {
    setDetalleRows(prev => [...prev, { ...detForm }]);
    setDetModalOpen(false);
  };

  const removeDetalleRow = (i: number) =>
    setDetalleRows(prev => prev.filter((_, j) => j !== i));

  const canAddDetalle = Boolean(
    detForm.cuenta_contable_id &&
    detForm.componente_id &&
    (detForm.debito || detForm.credito)
  );

  // ── Guardar ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!journalDate)        { toast.error('La fecha valor es requerida'); return; }
    if (!eventCode.trim())   { toast.error('El código de evento es requerido'); return; }
    if (!accountId.trim())   { toast.error('Selecciona una cuenta financiera'); return; }
    if (!productoId.trim())  { toast.error('La cuenta seleccionada no tiene producto asignado'); return; }


    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        journal_date: journalDate,
        event_code:   eventCode.trim(),
        account_id:   accountId.trim(),
        producto_id:  productoId.trim(),
        currency:     currency.trim(),
        status,
        total_debit:  totalDebit,
        total_credit: totalCredit,
        data: { Detalle: detalleRows },
      };

      const isEdit = !!poliza?.id;
      const url    = isEdit ? `${GL_JOURNAL_URL}/${poliza!.id}` : GL_JOURNAL_URL;
      const res    = await fetch(url, {
        method:  isEdit ? 'PUT' : 'POST',
        headers: GL_HEADERS,
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      toast.success(isEdit ? 'Póliza actualizada' : 'Póliza creada');
      onSave();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // ── Estilos ───────────────────────────────────────────────────────
  const inputCls = `w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:border-primary-theme ${
    isView ? 'bg-gray-50 border-gray-200 text-gray-700 cursor-default' : 'border-gray-300 bg-white'
  }`;
  const readonlyCls = 'w-full px-2.5 py-1.5 text-xs border rounded bg-gray-50 border-gray-200 text-gray-600 cursor-default';
  const selectCls   = `w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:border-primary-theme ${
    isView ? 'bg-gray-50 border-gray-200 text-gray-700 cursor-default' : 'border-gray-300 bg-white'
  }`;
  const labelCls = 'block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5';
  const modalSelectCls = 'w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-[#2E5C91]';
  const modalInputCls  = 'w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-[#2E5C91]';

  return (
    <div className="bg-[#F0F0F0] min-h-screen">

      {/* ── Header título ─────────────────────────────────────────── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 8h18M8 3v18M3 13h18M3 18h18"/>
          </svg>
          <h2 className="text-lg font-normal text-gray-800">
            {mode === 'create' ? 'Alta Póliza Contable'
              : mode === 'edit' ? 'Editar Póliza Contable'
              : 'Ver Póliza Contable'}
          </h2>
          {poliza?.event_code && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {poliza.event_code} · {poliza.journal_date}
            </span>
          )}
        </div>
      </div>

      {/* ── Botones de acción ─────────────────────────────────────── */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {!isView && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {saving && (
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10"/>
                </svg>
              )}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700"
          >
            {isView ? 'Volver' : 'Cancelar'}
          </button>
          {isView && (
            <span className="ml-3 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="6"/>
                <path d="M7 4v3M7 9h.01"/>
              </svg>
              Modo Consulta — Solo lectura
            </span>
          )}
        </div>
      </div>

      {/* ── Cuerpo del form ───────────────────────────────────────── */}
      <div className="px-4 py-4">
        <div className="bg-white border border-gray-300">

          {/* ── DATOS GENERALES ─────────────────────────────────── */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-200 bg-gradient-to-b from-gray-50/60 to-white">
            <div className="flex items-center gap-2.5 bg-[#D9E2F3] px-4 py-2 mb-4 rounded border-l-4 border-[#4A6FA5] shadow-sm">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
                <rect x="2" y="2" width="12" height="12" rx="2"/>
                <path d="M2 5h12M5 2v12M2 8h12M2 11h12"/>
              </svg>
              <span className="text-sm font-semibold text-[#2E5C91] tracking-wide uppercase">
                Datos Generales
              </span>
            </div>

            <div className="bg-white rounded border border-gray-200 px-4 py-3.5 shadow-sm space-y-4">

              {poliza?.id && (
                <div>
                  <label className={labelCls}>Id</label>
                  <input value={poliza.id} readOnly className={`${readonlyCls} font-mono`} />
                </div>
              )}

              {/* Fila 1: Fecha valor | Moneda | Estatus */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>
                    Fecha Valor <span className="text-red-500 normal-case font-normal">*</span>
                  </label>
                  <input type="date" value={journalDate} onChange={e => setJournalDate(e.target.value)} readOnly={isView} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>
                    Moneda
                  </label>
                  <input value={currency} readOnly placeholder="—" className={readonlyCls} />
                </div>
                <div>
                  <label className={labelCls}>Estatus</label>
                  <select value={status} onChange={e => setStatus(e.target.value as PolizaContable['status'])} disabled={isView} className={selectCls}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Fila 2: Id Cuenta | No. Cuenta | Producto */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Id Cuenta</label>
                  <div className="flex gap-1.5">
                    <input value={accountId} readOnly placeholder={isView ? '—' : '(seleccionar cuenta...)'} title={accountId} className={`${readonlyCls} font-mono flex-1 min-w-0 truncate`} />
                    {!isView && (
                      <button type="button" onClick={() => setCuentaModalOpen(true)} title="Seleccionar cuenta financiera"
                        className="px-2.5 py-1.5 bg-[#4A6FA5] text-white rounded text-xs hover:bg-[#3A5F95] transition-colors flex items-center shrink-0">
                        <Search size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>No. Cuenta</label>
                  <input value={noCuenta} readOnly placeholder="—" className={readonlyCls} />
                </div>
                <div>
                  <label className={labelCls}>Producto</label>
                  <input value={productoId} readOnly placeholder="—" title={productoId} className={`${readonlyCls} font-mono truncate`} />
                </div>
              </div>

              {/* Fila 3: Código de Evento | Total Débito | Total Crédito */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>
                    Código de Evento <span className="text-red-500 normal-case font-normal">*</span>
                  </label>
                  {isView ? (
                    <input value={eventCode} readOnly className={readonlyCls} />
                  ) : (
                    <select value={eventCode} onChange={handleEventoChange} className={selectCls}>
                      <option value="">— Seleccionar —</option>
                      {eventos.map(ev => (
                        <option key={ev.id} value={ev.codigo}>
                          {ev.codigo}{ev.evento ? ` — ${ev.evento}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Total Débito</label>
                  <input value={totalDebit.toLocaleString('es-MX', { minimumFractionDigits: 2 })} readOnly className={`${readonlyCls} text-right font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Total Crédito</label>
                  <input value={totalCredit.toLocaleString('es-MX', { minimumFractionDigits: 2 })} readOnly className={`${readonlyCls} text-right font-mono`} />
                </div>
              </div>

            </div>
          </div>

          {/* ── TAB BAR ──────────────────────────────────────────── */}
          <div className="bg-primary-theme text-white border-b border-gray-400">
            <div className="flex items-center">
              {(['default', 'detalle'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-xs border-r border-gray-500/30 transition-all ${
                    activeTab === tab
                      ? 'bg-secondary-theme text-white font-medium'
                      : 'bg-primary-theme text-white/90 hover:bg-[#5A7FB5]'
                  }`}
                >
                  {tab === 'default' ? 'Default' : 'Detalle'}
                </button>
              ))}
            </div>
          </div>

          {/* ── TAB: DEFAULT ─────────────────────────────────────── */}
          {activeTab === 'default' && (
            <div className="p-4">
              <div className="space-y-4">

                {poliza?.id && (
                  <div>
                    <label className={labelCls}>Id</label>
                    <input value={poliza.id} readOnly className={`${readonlyCls} font-mono`} />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Fecha Valor <span className="text-red-500 normal-case font-normal">*</span></label>
                    <input type="date" value={journalDate} onChange={e => setJournalDate(e.target.value)} readOnly={isView} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Moneda</label>
                    <input value={currency} readOnly placeholder="—" className={readonlyCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Estatus</label>
                    <select value={status} onChange={e => setStatus(e.target.value as PolizaContable['status'])} disabled={isView} className={selectCls}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Id Cuenta</label>
                    <div className="flex gap-1.5">
                      <input value={accountId} readOnly placeholder={isView ? '—' : '(seleccionar cuenta...)'} title={accountId} className={`${readonlyCls} font-mono flex-1 min-w-0 truncate`} />
                      {!isView && (
                        <button type="button" onClick={() => setCuentaModalOpen(true)} title="Seleccionar cuenta financiera"
                          className="px-2.5 py-1.5 bg-[#4A6FA5] text-white rounded text-xs hover:bg-[#3A5F95] transition-colors flex items-center shrink-0">
                          <Search size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>No. Cuenta</label>
                    <input value={noCuenta} readOnly placeholder="—" className={readonlyCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Producto</label>
                    <input value={productoId} readOnly placeholder="—" title={productoId} className={`${readonlyCls} font-mono truncate`} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Código de Evento <span className="text-red-500 normal-case font-normal">*</span></label>
                    {isView ? (
                      <input value={eventCode} readOnly className={readonlyCls} />
                    ) : (
                      <select value={eventCode} onChange={handleEventoChange} className={selectCls}>
                        <option value="">— Seleccionar —</option>
                        {eventos.map(ev => (
                          <option key={ev.id} value={ev.codigo}>{ev.codigo}{ev.evento ? ` — ${ev.evento}` : ''}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Total Débito</label>
                    <input value={totalDebit.toLocaleString('es-MX', { minimumFractionDigits: 2 })} readOnly className={`${readonlyCls} text-right font-mono`} />
                  </div>
                  <div>
                    <label className={labelCls}>Total Crédito</label>
                    <input value={totalCredit.toLocaleString('es-MX', { minimumFractionDigits: 2 })} readOnly className={`${readonlyCls} text-right font-mono`} />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── TAB: DETALLE ─────────────────────────────────────── */}
          {activeTab === 'detalle' && (
            <div>
              {/* Subheader con botón Nuevo */}
              <div className="bg-[#E8E8E8] px-4 py-1.5 border-b border-gray-300 flex items-center justify-between mx-4 mt-3">
                <span className="text-xs font-medium text-gray-700">DETALLE — Líneas contables de la póliza</span>
                {!isView && (
                  <button
                    onClick={openDetModal}
                    className="flex items-center gap-1 px-3 py-1 bg-[#2E5C91] text-white text-[10px] hover:bg-[#24497A] rounded font-medium transition-colors"
                  >
                    <Plus size={11} /> Nuevo
                  </button>
                )}
              </div>

              {/* Tabla */}
              <div className="px-4 py-3">
              <div className="border border-gray-300">
                <table className="w-full text-xs">
                  <thead className="bg-[#E8E8E8]">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Cuenta Contable</th>
                      <th className="text-right px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300 w-28">Débito</th>
                      <th className="text-right px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300 w-28">Crédito</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Componente</th>
                      {!isView && <th className="text-center px-2 py-1.5 font-medium text-gray-700 border-b border-gray-300 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detalleRows.length === 0 ? (
                      <tr>
                        <td colSpan={isView ? 4 : 5} className="px-3 py-8 text-center text-gray-400 text-xs">
                          {catLoading ? 'Cargando catálogos…' : 'No hay líneas contables. Haz clic en "Nuevo" para agregar.'}
                        </td>
                      </tr>
                    ) : (
                      detalleRows.map((row, i) => (
                        <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                          <td className="px-3 py-1.5 border-b border-gray-200 font-mono">
                            {row.cuenta_contable_gl}{row.cuenta_contable_nombre ? ` · ${row.cuenta_contable_nombre}` : ''}
                          </td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-right font-mono">
                            {row.debito ? Number(row.debito).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-right font-mono">
                            {row.credito ? Number(row.credito).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-3 py-1.5 border-b border-gray-200">
                            {row.componente_codigo}{row.componente_nombre ? ` · ${row.componente_nombre}` : ''}
                          </td>
                          {!isView && (
                            <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                              <button onClick={() => removeDetalleRow(i)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={12} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Modal selector de cuenta ──────────────────────────────── */}
      <CuentaFinancieraPickerModal
        open={cuentaModalOpen}
        onClose={() => setCuentaModalOpen(false)}
        onSelect={handleCuentaSelect}
      />

      {/* ── Modal nueva línea Detalle ─────────────────────────────── */}
      {detModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-xl w-[480px] max-w-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-800">Nueva línea contable</span>
              <button onClick={() => setDetModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-4 space-y-3">
              {catLoading ? (
                <div className="text-xs text-gray-500 text-center py-4">Cargando catálogos…</div>
              ) : (
                <>
                  {/* Cuenta Contable */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Cuenta Contable <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={modalSelectCls}
                      value={detForm.cuenta_contable_id}
                      onChange={e => {
                        const c = cuentasContables.find(x => x.id === e.target.value);
                        setDetForm(f => ({
                          ...f,
                          cuenta_contable_id: c?.id ?? '',
                          cuenta_contable_gl: c?.cuenta_gl ?? '',
                          cuenta_contable_nombre: c?.nombre ?? '',
                        }));
                      }}
                    >
                      <option value="">— Seleccionar —</option>
                      {cuentasContables.map(c => (
                        <option key={c.id} value={c.id}>{c.cuenta_gl} · {c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Débito */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Débito <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className={`${modalInputCls} text-right font-mono ${detForm.credito ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      value={detForm.debito}
                      disabled={Boolean(detForm.credito)}
                      onChange={e => setDetForm(f => ({ ...f, debito: e.target.value }))}
                    />
                  </div>

                  {/* Crédito */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Crédito <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className={`${modalInputCls} text-right font-mono ${detForm.debito ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      value={detForm.credito}
                      disabled={Boolean(detForm.debito)}
                      onChange={e => setDetForm(f => ({ ...f, credito: e.target.value }))}
                    />
                  </div>

                  {/* Componente */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Componente <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={modalSelectCls}
                      value={detForm.componente_id}
                      onChange={e => {
                        const c = catComponentes.find(x => x.id === e.target.value);
                        setDetForm(f => ({
                          ...f,
                          componente_id: c?.id ?? '',
                          componente_codigo: c?.codigo ?? '',
                          componente_nombre: c?.nombre ?? '',
                        }));
                      }}
                    >
                      <option value="">— Seleccionar —</option>
                      {catComponentes.map(c => (
                        <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => setDetModalOpen(false)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                disabled={!canAddDetalle}
                onClick={addDetalleRow}
                className="px-3 py-1.5 text-xs bg-[#2E5C91] text-white rounded hover:bg-[#24497A] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
