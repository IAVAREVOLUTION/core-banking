import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { GL_JOURNAL_URL, GL_HEADERS } from '../../hooks/usePolizasContablesDB';
import type { PolizaContable, Partida } from './PolizasContablesModule';

type FormMode = 'create' | 'edit' | 'view';

interface Props {
  mode: FormMode;
  poliza?: PolizaContable;
  onSave: () => void;
  onCancel: () => void;
}

type Tab = 'default' | 'detalle';

const TABS: { id: Tab; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'detalle', label: 'Detalle' },
];

const CURRENCIES = ['MXN', 'USD', 'EUR'];
const STATUSES: PolizaContable['status'][] = ['Creada', 'Aplicada', 'Cancelada', 'Procesando', 'Error'];

const emptyPartida = (): Partida => ({ cuentaGl: '', nombreCuenta: '', concepto: '', debito: '', credito: '' });

export function PolizaContableForm({ mode, poliza, onSave, onCancel }: Props) {
  const isView = mode === 'view';
  const [activeTab, setActiveTab] = useState<Tab>('default');
  const [saving, setSaving] = useState(false);

  // Columnas físicas
  const [journalDate, setJournalDate] = useState(poliza?.journal_date || new Date().toISOString().split('T')[0]);
  const [eventCode, setEventCode] = useState(poliza?.event_code || '');
  const [productoId, setProductoId] = useState(poliza?.producto_id || '');
  const [accountId, setAccountId] = useState(poliza?.account_id || '');
  const [currency, setCurrency] = useState(poliza?.currency || 'MXN');
  const [status, setStatus] = useState<PolizaContable['status']>(poliza?.status || 'Creada');

  // JSONB data
  const [concepto, setConcepto] = useState(poliza?.data?.concepto || '');
  const [referencia, setReferencia] = useState(poliza?.data?.referencia || '');
  const [partidas, setPartidas] = useState<Partida[]>(
    poliza?.data?.partidas && poliza.data.partidas.length > 0 ? poliza.data.partidas : [emptyPartida()]
  );

  const totalDebito = partidas.reduce((s, p) => s + (parseFloat(p.debito) || 0), 0);
  const totalCredito = partidas.reduce((s, p) => s + (parseFloat(p.credito) || 0), 0);
  const balanced = Math.abs(totalDebito - totalCredito) < 0.01;

  const addPartida = () => setPartidas(prev => [...prev, emptyPartida()]);
  const removePartida = (i: number) => setPartidas(prev => prev.filter((_, j) => j !== i));
  const updatePartida = (i: number, field: keyof Partida, val: string) =>
    setPartidas(prev => prev.map((p, j) => j === i ? { ...p, [field]: val } : p));

  const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSave = async () => {
    if (!journalDate) { toast.error('La fecha de la póliza es requerida'); return; }
    if (!eventCode.trim()) { toast.error('El código de evento es requerido'); return; }
    if (!balanced) { toast.error('La póliza no está balanceada (débito ≠ crédito)'); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        journal_date: journalDate,
        event_code: eventCode,
        currency,
        status,
        total_debit: totalDebito,
        total_credit: totalCredito,
        data: { concepto, referencia, partidas },
      };
      if (productoId.trim()) body.producto_id = productoId.trim();
      if (accountId.trim()) body.account_id = accountId.trim();

      const isEdit = !!poliza?.id;
      const url = isEdit ? `${GL_JOURNAL_URL}/${poliza!.id}` : GL_JOURNAL_URL;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: GL_HEADERS,
        body: JSON.stringify(body),
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

  const inputCls = `w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:border-primary-theme ${isView ? 'bg-gray-50 border-gray-200 text-gray-700 cursor-default' : 'border-gray-300 bg-white'}`;
  const selectCls = `w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:border-primary-theme ${isView ? 'bg-gray-50 border-gray-200 text-gray-700 cursor-default' : 'border-gray-300 bg-white'}`;
  const labelCls = 'block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5';

  return (
    <div className="bg-[#F0F0F0] min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 8h18M8 3v18M3 13h18M3 18h18"/>
          </svg>
          <h2 className="text-lg font-normal text-gray-800">
            {mode === 'create' ? 'Alta Póliza Contable' : mode === 'edit' ? 'Editar Póliza Contable' : 'Ver Póliza Contable'}
          </h2>
          {poliza?.event_code && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {poliza.event_code} · {poliza.journal_date}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
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

      {/* Form body */}
      <div className="px-4 py-4">
        <div className="bg-white border border-gray-300">

          {/* Datos fijos — siempre visibles */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-200 bg-gradient-to-b from-gray-50/60 to-white">
            <div className="flex items-center gap-2.5 bg-[#D9E2F3] px-4 py-2 mb-4 rounded border-l-4 border-[#4A6FA5] shadow-sm">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
                <rect x="2" y="2" width="12" height="12" rx="2"/>
                <path d="M2 5h12M5 2v12M2 8h12M2 11h12"/>
              </svg>
              <span className="text-sm font-semibold text-[#2E5C91] tracking-wide uppercase">
                Datos de la Póliza
              </span>
            </div>
            <div className="bg-white rounded border border-gray-200 px-4 py-3.5 shadow-sm">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Fecha <span className="text-red-500 normal-case font-normal">*</span></label>
                  <input type="date" value={journalDate} onChange={e => setJournalDate(e.target.value)} readOnly={isView} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Código de Evento <span className="text-red-500 normal-case font-normal">*</span></label>
                  <input value={eventCode} onChange={e => setEventCode(e.target.value)} readOnly={isView} className={inputCls} placeholder="Ej. APERTURA_CUENTA" />
                </div>
                <div>
                  <label className={labelCls}>Moneda</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} disabled={isView} className={selectCls}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Estatus</label>
                  <select value={status} onChange={e => setStatus(e.target.value as PolizaContable['status'])} disabled={isView} className={selectCls}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs navigation */}
          <div className="bg-primary-theme text-white border-b border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs whitespace-nowrap border-r border-gray-500/30 transition-all ${
                    activeTab === tab.id
                      ? 'bg-secondary-theme text-white font-medium'
                      : 'bg-primary-theme text-white/90 hover:bg-[#5A7FB5]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="p-4">

            {/* DEFAULT — campos adicionales */}
            {activeTab === 'default' && (
              <div className="max-w-3xl space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>ID Producto</label>
                    <input value={productoId} onChange={e => setProductoId(e.target.value)} readOnly={isView} className={`${inputCls} font-mono`} placeholder="UUID del producto" />
                  </div>
                  <div>
                    <label className={labelCls}>ID Cuenta</label>
                    <input value={accountId} onChange={e => setAccountId(e.target.value)} readOnly={isView} className={`${inputCls} font-mono`} placeholder="UUID de la cuenta" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Concepto</label>
                  <textarea value={concepto} onChange={e => setConcepto(e.target.value)} readOnly={isView} rows={3} className={`${inputCls} resize-none`} placeholder="Descripción de la póliza..." />
                </div>
                <div>
                  <label className={labelCls}>Referencia</label>
                  <input value={referencia} onChange={e => setReferencia(e.target.value)} readOnly={isView} className={inputCls} placeholder="Número de referencia o documento origen" />
                </div>
              </div>
            )}

            {/* DETALLE — partidas contables */}
            {activeTab === 'detalle' && (
              <div>
                {/* Balance indicator */}
                <div className={`mb-3 px-3 py-1.5 rounded text-xs flex items-center gap-2 ${balanced ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-yellow-50 border border-yellow-200 text-yellow-700'}`}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                    {balanced
                      ? <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm-1 9L3.5 7.5l1-1L6 8.5l3.5-3.5 1 1L6 10z"/>
                      : <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.5 3h1v4h-1V4zm0 5h1v1h-1V9z"/>
                    }
                  </svg>
                  {balanced
                    ? `Balanceada — Débito: $${fmt(totalDebito)} | Crédito: $${fmt(totalCredito)}`
                    : `Sin balance — Diferencia: $${fmt(Math.abs(totalDebito - totalCredito))} | Débito: $${fmt(totalDebito)} | Crédito: $${fmt(totalCredito)}`
                  }
                </div>

                <div className="section-header-theme px-4 py-2 mb-3 flex items-center justify-between rounded-t">
                  <span className="text-xs font-semibold tracking-wide uppercase">Partidas Contables</span>
                  {!isView && (
                    <button onClick={addPartida} className="flex items-center gap-1 px-3 py-1 bg-white/20 text-white text-xs rounded hover:bg-white/30 transition-colors">
                      <Plus size={12} /> Agregar partida
                    </button>
                  )}
                </div>

                <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="table-header-theme">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Cuenta GL</th>
                        <th className="px-3 py-2 text-left font-semibold text-white/90 text-[11px] uppercase tracking-wide w-44">Nombre Cuenta</th>
                        <th className="px-3 py-2 text-left font-semibold text-white/90 text-[11px] uppercase tracking-wide">Concepto</th>
                        <th className="px-3 py-2 text-right font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Débito</th>
                        <th className="px-3 py-2 text-right font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Crédito</th>
                        {!isView && <th className="w-8"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {partidas.map((p, i) => (
                        <tr key={i} className={`row-hover-theme transition-colors border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                          <td className="px-2 py-1.5">
                            {isView ? <span className="font-mono">{p.cuentaGl || '—'}</span> : (
                              <input value={p.cuentaGl} onChange={e => updatePartida(i, 'cuentaGl', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:border-primary-theme" placeholder="1101-0001" />
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {isView ? <span>{p.nombreCuenta || '—'}</span> : (
                              <input value={p.nombreCuenta} onChange={e => updatePartida(i, 'nombreCuenta', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-primary-theme" placeholder="Nombre de la cuenta" />
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {isView ? <span>{p.concepto || '—'}</span> : (
                              <input value={p.concepto} onChange={e => updatePartida(i, 'concepto', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-primary-theme" placeholder="Concepto de la partida" />
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {isView ? <span className="font-mono text-right block">{p.debito ? `$${fmt(parseFloat(p.debito))}` : '—'}</span> : (
                              <input type="number" value={p.debito} onChange={e => updatePartida(i, 'debito', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-right font-mono focus:outline-none focus:border-primary-theme" placeholder="0.00" min="0" step="0.01" />
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {isView ? <span className="font-mono text-right block">{p.credito ? `$${fmt(parseFloat(p.credito))}` : '—'}</span> : (
                              <input type="number" value={p.credito} onChange={e => updatePartida(i, 'credito', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-right font-mono focus:outline-none focus:border-primary-theme" placeholder="0.00" min="0" step="0.01" />
                            )}
                          </td>
                          {!isView && (
                            <td className="px-2 py-1.5 text-center">
                              <button onClick={() => removePartida(i)} className="text-red-400 hover:text-red-600 transition-colors" disabled={partidas.length === 1}>
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#E8E8E8] border-t-2 border-gray-400">
                        <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">Totales</td>
                        <td className="px-3 py-2 text-xs text-right font-mono font-bold text-gray-800">${fmt(totalDebito)}</td>
                        <td className="px-3 py-2 text-xs text-right font-mono font-bold text-gray-800">${fmt(totalCredito)}</td>
                        {!isView && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
