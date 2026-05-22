import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
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

const STATUSES: PolizaContable['status'][] = ['Creada', 'Validada', 'Posteada'];

export function PolizaContableForm({ mode, poliza, onSave, onCancel }: Props) {
  const isView = mode === 'view';
  const [saving, setSaving] = useState(false);

  // ── Columnas físicas ──────────────────────────────────────────────
  const [journalDate, setJournalDate] = useState(
    poliza?.journal_date || new Date().toISOString().split('T')[0]
  );
  const [accountId, setAccountId]         = useState(poliza?.account_id || '');
  const [noCuenta, setNoCuenta]           = useState(''); // informativo, no se persiste
  const [productoId, setProductoId]       = useState(poliza?.producto_id || '');
  const [eventCode, setEventCode]     = useState(poliza?.event_code || '');
  const [totalDebit, setTotalDebit]   = useState(String(poliza?.total_debit ?? ''));
  const [totalCredit, setTotalCredit] = useState(String(poliza?.total_credit ?? ''));
  const [currency, setCurrency]       = useState(poliza?.currency || 'MXN');
  const [status, setStatus]           = useState<PolizaContable['status']>(poliza?.status || 'Creada');

  // ── JSONB data → subkey Detalle ──────────────────────────────────
  const _det = poliza?.data?.Detalle ?? {};
  const [dataEvento, setDataEvento]         = useState(_det.evento || '');
  const [dataPromptIA, setDataPromptIA]     = useState(_det.prompt_ia || '');
  const [dataCatalogoId, setDataCatalogoId] = useState(_det.catalogo_id || '');
  const [dataSolicitudId, setDataSolicitudId] = useState(_det.solicitud_id || '');
  const [dataCuentaContableId, setDataCuentaContableId] = useState(_det.cuenta_contable_id || '');
  const [dataMontoCredito, setDataMontoCredito] = useState(String(_det.monto_credito ?? ''));
  const [dataMontoDebito, setDataMontoDebito] = useState(String(_det.monto_debito ?? ''));
  const [clienteId, setClienteId] = useState(_det.cliente_id || '');
  const [clienteNombre, setClienteNombre] = useState(_det.cliente_nombre || '');

  // ── Catálogo de eventos ───────────────────────────────────────────
  const [eventos, setEventos] = useState<EventoContable[]>([]);
  const [cuentasContables, setCuentasContables] = useState<CuentaContable[]>([]);

  // ── Modal cuenta ──────────────────────────────────────────────────
  const [cuentaModalOpen, setCuentaModalOpen] = useState(false);

  // ── Tab activo ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'default' | 'detalle'>('default');

  // Cargar catálogos al montar
  useEffect(() => {
    fetch(`${GL_BASE_URL}/eventos-contables`, { headers: GL_HEADERS })
      .then(r => r.json())
      .then(j => { if (Array.isArray(j.data)) setEventos(j.data); })
      .catch(() => {});
    fetch(`${GL_BASE_URL}/catalogos-contables`, { headers: GL_HEADERS })
      .then(r => r.json())
      .then(j => { if (Array.isArray(j.data)) setCuentasContables(j.data); })
      .catch(() => {});
  }, []);

  // Cuando el usuario selecciona una cuenta del modal
  const handleCuentaSelect = (result: { account_id: string; no_cuenta: string; producto_id: string; producto_display: string; cliente_id: string; cliente_nombre: string }) => {
    setAccountId(result.account_id);
    setNoCuenta(result.no_cuenta);
    setProductoId(result.producto_id);
    setDataSolicitudId(result.account_id);
    setClienteId(result.cliente_id);
    setClienteNombre(result.cliente_nombre);
  };

  // Cuando cambia el evento: autocompletar campos JSONB
  const handleEventoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const codigo = e.target.value;
    setEventCode(codigo);
    const found = eventos.find(ev => ev.codigo === codigo);
    if (found) {
      setDataEvento(found.evento || '');
      setDataPromptIA(found.prompt_ia || '');
      setDataCatalogoId(found.id);
    } else {
      setDataEvento('');
      setDataPromptIA('');
      setDataCatalogoId('');
    }
  };

  const handleSave = async () => {
    if (!journalDate)        { toast.error('La fecha valor es requerida'); return; }
    if (!eventCode.trim())   { toast.error('El código de evento es requerido'); return; }
    if (!accountId.trim())   { toast.error('Selecciona una cuenta financiera'); return; }
    if (!productoId.trim())  { toast.error('La cuenta seleccionada no tiene producto asignado'); return; }
    if (!currency.trim())    { toast.error('La moneda es requerida'); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        journal_date: journalDate,
        event_code:   eventCode.trim(),
        account_id:   accountId.trim(),
        producto_id:  productoId.trim(),
        currency:     currency.trim(),
        status,
        total_debit:  parseFloat(totalDebit)  || 0,
        total_credit: parseFloat(totalCredit) || 0,
        data: {
          Detalle: {
            evento:             dataEvento,
            prompt_ia:          dataPromptIA,
            catalogo_id:        dataCatalogoId,
            solicitud_id:       dataSolicitudId,
            cuenta_contable_id: dataCuentaContableId,
            monto_credito:      parseFloat(dataMontoCredito) || 0,
            monto_debito:       parseFloat(dataMontoDebito)  || 0,
            account_id:         accountId.trim(),
            producto_id:        productoId.trim(),
            cliente_id:         clienteId,
            cliente_nombre:     clienteNombre,
          },
        },
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

  // ── Estilos reutilizables ─────────────────────────────────────────
  const inputCls = `w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:border-primary-theme ${
    isView ? 'bg-gray-50 border-gray-200 text-gray-700 cursor-default' : 'border-gray-300 bg-white'
  }`;
  const readonlyCls = 'w-full px-2.5 py-1.5 text-xs border rounded bg-gray-50 border-gray-200 text-gray-600 cursor-default';
  const selectCls  = `w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:border-primary-theme ${
    isView ? 'bg-gray-50 border-gray-200 text-gray-700 cursor-default' : 'border-gray-300 bg-white'
  }`;
  const labelCls   = 'block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5';

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

              {/* Campo Id — solo en edit/view */}
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
                  <input
                    type="date"
                    value={journalDate}
                    onChange={e => setJournalDate(e.target.value)}
                    readOnly={isView}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Moneda <span className="text-red-500 normal-case font-normal">*</span>
                  </label>
                  <input
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    readOnly={isView}
                    placeholder="Ej. MXN"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Estatus</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as PolizaContable['status'])}
                    disabled={isView}
                    className={selectCls}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Fila 2: Id Cuenta (modal) | No. Cuenta (readonly) | Producto (readonly) */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Id Cuenta</label>
                  <div className="flex gap-1.5">
                    <input
                      value={accountId}
                      readOnly
                      placeholder={isView ? '—' : '(seleccionar cuenta...)'}
                      title={accountId}
                      className={`${readonlyCls} font-mono flex-1 min-w-0 truncate`}
                    />
                    {!isView && (
                      <button
                        type="button"
                        onClick={() => setCuentaModalOpen(true)}
                        title="Seleccionar cuenta financiera"
                        className="px-2.5 py-1.5 bg-[#4A6FA5] text-white rounded text-xs hover:bg-[#3A5F95] transition-colors flex items-center shrink-0"
                      >
                        <Search size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>No. Cuenta</label>
                  <input
                    value={noCuenta}
                    readOnly
                    placeholder="—"
                    className={readonlyCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Producto</label>
                  <input
                    value={productoId}
                    readOnly
                    placeholder="—"
                    title={productoId}
                    className={`${readonlyCls} font-mono truncate`}
                  />
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
                  <input
                    type="number"
                    value={totalDebit}
                    onChange={e => setTotalDebit(e.target.value)}
                    readOnly={isView}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={`${inputCls} text-right font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Total Crédito</label>
                  <input
                    type="number"
                    value={totalCredit}
                    onChange={e => setTotalCredit(e.target.value)}
                    readOnly={isView}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={`${inputCls} text-right font-mono`}
                  />
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
                  className={`px-4 py-2.5 text-xs border-r border-gray-500/30 transition-all capitalize ${
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

          {/* ── TAB: DEFAULT — copia del formulario ──────────────── */}
          {activeTab === 'default' && (
            <div className="p-4">
              <div className="space-y-4">

                {/* Id */}
                {poliza?.id && (
                  <div>
                    <label className={labelCls}>Id</label>
                    <input value={poliza.id} readOnly className={`${readonlyCls} font-mono`} />
                  </div>
                )}

                {/* Fila 1: Fecha Valor | Moneda | Estatus */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>
                      Fecha Valor <span className="text-red-500 normal-case font-normal">*</span>
                    </label>
                    <input
                      type="date"
                      value={journalDate}
                      onChange={e => setJournalDate(e.target.value)}
                      readOnly={isView}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Moneda <span className="text-red-500 normal-case font-normal">*</span>
                    </label>
                    <input
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      readOnly={isView}
                      placeholder="Ej. MXN"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Estatus</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as PolizaContable['status'])}
                      disabled={isView}
                      className={selectCls}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Fila 2: Id Cuenta | No. Cuenta | Producto */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Id Cuenta</label>
                    <div className="flex gap-1.5">
                      <input
                        value={accountId}
                        readOnly
                        placeholder={isView ? '—' : '(seleccionar cuenta...)'}
                        title={accountId}
                        className={`${readonlyCls} font-mono flex-1 min-w-0 truncate`}
                      />
                      {!isView && (
                        <button
                          type="button"
                          onClick={() => setCuentaModalOpen(true)}
                          title="Seleccionar cuenta financiera"
                          className="px-2.5 py-1.5 bg-[#4A6FA5] text-white rounded text-xs hover:bg-[#3A5F95] transition-colors flex items-center shrink-0"
                        >
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
                    <input
                      value={productoId}
                      readOnly
                      placeholder="—"
                      title={productoId}
                      className={`${readonlyCls} font-mono truncate`}
                    />
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
                    <input
                      type="number"
                      value={totalDebit}
                      onChange={e => setTotalDebit(e.target.value)}
                      readOnly={isView}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className={`${inputCls} text-right font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Total Crédito</label>
                    <input
                      type="number"
                      value={totalCredit}
                      onChange={e => setTotalCredit(e.target.value)}
                      readOnly={isView}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className={`${inputCls} text-right font-mono`}
                    />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── TAB: DETALLE — data JSONB ─────────────────────────── */}
          {activeTab === 'detalle' && (
            <div className="p-4">
              <div className="space-y-4">

                {/* Fila: ID Cuenta | ID Producto | ID Cliente | Nombre Cliente */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className={labelCls}>ID Cuenta</label>
                    <input value={accountId} readOnly placeholder="—" title={accountId} className={`${readonlyCls} font-mono truncate`} />
                  </div>
                  <div>
                    <label className={labelCls}>ID Producto</label>
                    <input value={productoId} readOnly placeholder="—" title={productoId} className={`${readonlyCls} font-mono truncate`} />
                  </div>
                  <div>
                    <label className={labelCls}>ID Cliente</label>
                    <input value={clienteId} readOnly placeholder="—" title={clienteId} className={`${readonlyCls} font-mono truncate`} />
                  </div>
                  <div>
                    <label className={labelCls}>Nombre Cliente</label>
                    <input value={clienteNombre} readOnly placeholder="—" className={readonlyCls} />
                  </div>
                </div>

                {/* Fila: Cuenta Contable | Monto Crédito | Monto Débito */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Cuenta Contable</label>
                    {isView ? (
                      <input
                        value={cuentasContables.find(c => c.id === dataCuentaContableId)
                          ? `${cuentasContables.find(c => c.id === dataCuentaContableId)!.cuenta_gl} — ${cuentasContables.find(c => c.id === dataCuentaContableId)!.nombre}`
                          : dataCuentaContableId || '—'}
                        readOnly
                        className={readonlyCls}
                      />
                    ) : (
                      <select
                        value={dataCuentaContableId}
                        onChange={e => setDataCuentaContableId(e.target.value)}
                        className={selectCls}
                      >
                        <option value="">— Seleccionar —</option>
                        {cuentasContables.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.cuenta_gl} — {c.nombre}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Monto Crédito</label>
                    <input
                      type="number"
                      value={dataMontoCredito}
                      onChange={e => setDataMontoCredito(e.target.value)}
                      readOnly={isView}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className={`${inputCls} text-right font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Monto Débito</label>
                    <input
                      type="number"
                      value={dataMontoDebito}
                      onChange={e => setDataMontoDebito(e.target.value)}
                      readOnly={isView}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className={`${inputCls} text-right font-mono`}
                    />
                  </div>
                </div>

                {/* Fila: Evento | Catálogo ID */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Evento</label>
                    <input
                      value={dataEvento}
                      readOnly
                      placeholder="—"
                      className={readonlyCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Catálogo ID</label>
                    <input
                      value={dataCatalogoId}
                      readOnly
                      placeholder="—"
                      title={dataCatalogoId}
                      className={`${readonlyCls} font-mono`}
                    />
                  </div>
                </div>

                {/* Prompt IA */}
                <div>
                  <label className={labelCls}>Prompt IA</label>
                  <textarea
                    value={dataPromptIA}
                    readOnly
                    rows={5}
                    placeholder="—"
                    className={`${readonlyCls} resize-none`}
                  />
                </div>

                {/* Solicitud ID */}
                <div>
                  <label className={labelCls}>Solicitud ID</label>
                  <input
                    value={dataSolicitudId}
                    readOnly
                    placeholder="—"
                    title={dataSolicitudId}
                    className={`${readonlyCls} font-mono`}
                  />
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

    </div>
  );
}
