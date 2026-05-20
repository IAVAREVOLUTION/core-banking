/**
 * CalendarioPagosTab.tsx
 *
 * Calendario de Pagos/Aportaciones para Cuentas de Ahorro.
 * Lógica, estructura, cálculos y comportamiento idénticos a
 * AmortizacionesTab de Cartera de Crédito — adaptado para captación.
 *
 * Diferencias respecto a AmortizacionesTab:
 *  - Total Pago = Capital (aportación pura, sin interés/seguro)
 *  - sub_tipo = 'Aportacion'
 *  - Movimiento = 'Abono'
 *  - Etiquetas en español para ahorro/captación
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAmortizaciones, crearAvisoVencimiento, formatMoney, fmtDate } from '../../hooks/useCarteraDB';

const ESTATUS_COLOR: Record<string, string> = {
  Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  Facturada: 'bg-blue-50 text-blue-700 border-blue-200',
  Pagada:    'bg-green-50 text-green-700 border-green-200',
  Cancelado: 'bg-gray-50 text-gray-500 border-gray-200',
  Vencida:   'bg-red-50 text-red-700 border-red-200',
};

interface Props {
  accountId: string;
  cliente?: string;
  noSol?: string;
  noCuenta?: string;
  moneda?: string;
}

export function CalendarioPagosTab({ accountId, cliente = '', noSol, noCuenta, moneda = 'MXN' }: Props) {
  const { rows, loading, error, refetch } = useAmortizaciones(accountId);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [showModal, setShowModal]         = useState(false);
  const [enviando, setEnviando]           = useState(false);

  // Campos del modal de aviso
  const [formaPago, setFormaPago]             = useState('Banca por internet');
  const [fechaCompromiso, setFechaCompromiso] = useState('');
  const [institucion, setInstitucion]         = useState('eFinancianet');
  const [cuentaBancaria, setCuentaBancaria]   = useState('');
  const [referencia, setReferencia]           = useState('');

  useEffect(() => { refetch(); }, [refetch]);
  useEffect(() => { if (noSol)    setReferencia(noSol);      }, [noSol]);
  useEffect(() => { if (noCuenta) setCuentaBancaria(noCuenta); }, [noCuenta]);

  // Auto-rellenar fecha compromiso con fecha de la primera fila seleccionada
  useEffect(() => {
    if (selected.size === 0) return;
    const primera = rows.find(r => selected.has(r.id));
    if (!primera?.fecha_pago) return;
    const parts = primera.fecha_pago.split('/');
    if (parts.length === 3) {
      setFechaCompromiso(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      setFechaCompromiso(primera.fecha_pago.split('T')[0]);
    }
  }, [selected, rows]);

  const toggle = (id: string, estatus: string) => {
    if (estatus !== 'Pendiente') return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pendientes = rows.filter(r => r.estatus === 'Pendiente').map(r => r.id);
    const allSel = pendientes.every(id => selected.has(id));
    setSelected(allSel ? new Set() : new Set(pendientes));
  };

  const selectedRows = rows.filter(r => selected.has(r.id));

  // Para captación el total = suma de pago_total (= capital / aportación)
  const totals = selectedRows.reduce(
    (acc, r) => ({
      capital: acc.capital + r.pago_capital,
      interes: acc.interes + r.pago_interes,
      iva:     acc.iva     + r.iva_interes,
      seguro:  acc.seguro  + r.pago_seguro,
      ivaSeg:  acc.ivaSeg  + r.iva_seguro,
      total:   acc.total   + r.pago_total,
    }),
    { capital: 0, interes: 0, iva: 0, seguro: 0, ivaSeg: 0, total: 0 }
  );

  const allTotals = rows.reduce(
    (acc, r) => ({
      capital: acc.capital + r.pago_capital,
      interes: acc.interes + r.pago_interes,
      iva:     acc.iva     + r.iva_interes,
      seguro:  acc.seguro  + r.pago_seguro,
      ivaSeg:  acc.ivaSeg  + r.iva_seguro,
      total:   acc.total   + r.pago_total,
    }),
    { capital: 0, interes: 0, iva: 0, seguro: 0, ivaSeg: 0, total: 0 }
  );

  const handleCrearAviso = async () => {
    if (selected.size === 0) { toast.error('Seleccione al menos una aportación'); return; }
    setEnviando(true);
    const result = await crearAvisoVencimiento({
      solicitud_id:           accountId,
      amortizaciones:         selectedRows,
      sub_tipo:               'Aportacion',   // ← captación (no 'Amortizacion')
      cliente,
      forma_pago:             formaPago,
      fecha_compromiso:       fechaCompromiso || undefined,
      moneda,
      institucion_financiera: institucion || undefined,
      cuenta_bancaria:        cuentaBancaria || undefined,
      referencia:             referencia || undefined,
    });
    setEnviando(false);
    if (result.ok) {
      toast.success('Aviso de pago creado', { description: `Folio: ${result.factura_id?.substring(0, 8)}...` });
      setSelected(new Set());
      setShowModal(false);
      setCuentaBancaria(noCuenta || '');
      setReferencia(noSol || '');
      refetch();
    } else {
      toast.error('Error al crear aviso', { description: result.error });
    }
  };

  const pendientesCount    = rows.filter(r => r.estatus === 'Pendiente').length;
  const allPendientesSelec = pendientesCount > 0 && pendientesCount === selected.size;

  return (
    <div className="space-y-3">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {rows.length} aportación{rows.length !== 1 ? 'es' : ''} · {pendientesCount} pendientes · {selected.size} seleccionadas
        </span>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/>
            </svg>
            Actualizar
          </button>
          <button
            onClick={() => selected.size > 0 ? setShowModal(true) : toast.error('Seleccione aportaciones')}
            disabled={selected.size === 0}
            className="px-3 py-1.5 text-xs font-medium rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 1v6M3 4l3 3 3-3" strokeLinecap="round"/><rect x="1" y="8" width="10" height="3" rx="1"/>
            </svg>
            Aviso Pago {selected.size > 0 && `(${selected.size})`}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
      )}

      {/* ── Tabla idéntica a Amortizaciones ── */}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#2E5C91] text-white">
              <th className="px-2 py-2 text-center w-8">
                <input type="checkbox" checked={allPendientesSelec} onChange={toggleAll} className="cursor-pointer" />
              </th>
              <th className="px-2 py-2 text-center font-medium w-8">No.</th>
              <th className="px-2 py-2 text-left font-medium">Fecha</th>
              <th className="px-2 py-2 text-right font-medium">Saldo</th>
              <th className="px-2 py-2 text-right font-medium">Aportación</th>
              <th className="px-2 py-2 text-right font-medium">Interés</th>
              <th className="px-2 py-2 text-right font-medium">IVA Int.</th>
              <th className="px-2 py-2 text-right font-medium">Seguro</th>
              <th className="px-2 py-2 text-right font-medium">IVA Seg.</th>
              <th className="px-2 py-2 text-right font-medium">Total Pago</th>
              <th className="px-2 py-2 text-center font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-400 text-xs">
                  <svg className="animate-spin h-5 w-5 mx-auto mb-1 text-[#4A6FA5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                  </svg>
                  Cargando calendario de pagos...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-2">
                    <rect x="4" y="4" width="24" height="24" rx="3"/>
                    <path d="M10 16h12M16 10v12" strokeLinecap="round"/>
                  </svg>
                  <p className="text-xs text-gray-400">Sin aportaciones programadas</p>
                  <p className="text-[10px] text-gray-300 mt-1">El calendario se genera desde la simulación del producto</p>
                </td>
              </tr>
            ) : rows.map((r, idx) => {
              const isPendiente = r.estatus === 'Pendiente';
              const isSelected  = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  className={`border-b border-gray-100 transition-colors ${
                    isSelected ? 'bg-blue-50' : idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                  } ${isPendiente ? 'cursor-pointer hover:bg-blue-50/60' : ''}`}
                  onClick={() => toggle(r.id, r.estatus)}
                >
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isPendiente}
                      onChange={() => toggle(r.id, r.estatus)}
                      onClick={e => e.stopPropagation()}
                      className="disabled:opacity-30"
                    />
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600">{r.no_pago}</td>
                  <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{fmtDate(r.fecha_pago)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatMoney(r.saldo_insoluto)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatMoney(r.pago_capital)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatMoney(r.pago_interes)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatMoney(r.iva_interes)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatMoney(r.pago_seguro)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{formatMoney(r.iva_seguro)}</td>
                  <td className="px-2 py-2 text-right font-medium text-gray-800">{formatMoney(r.pago_total)}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTATUS_COLOR[r.estatus] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {r.estatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              {selected.size > 0 && (
                <tr className="bg-blue-100 border-t border-blue-200 font-medium text-blue-900">
                  <td colSpan={4} className="px-2 py-2 text-right text-[10px] uppercase tracking-wide">Selección:</td>
                  <td className="px-2 py-2 text-right">{formatMoney(totals.capital)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(totals.interes)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(totals.iva)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(totals.seguro)}</td>
                  <td className="px-2 py-2 text-right">{formatMoney(totals.ivaSeg)}</td>
                  <td className="px-2 py-2 text-right font-bold">{formatMoney(totals.total)}</td>
                  <td />
                </tr>
              )}
              <tr className="bg-gray-100 border-t-2 border-gray-300 font-medium text-gray-800">
                <td colSpan={4} className="px-2 py-2 text-right text-[10px] uppercase tracking-wide">Total General:</td>
                <td className="px-2 py-2 text-right">{formatMoney(allTotals.capital)}</td>
                <td className="px-2 py-2 text-right">{formatMoney(allTotals.interes)}</td>
                <td className="px-2 py-2 text-right">{formatMoney(allTotals.iva)}</td>
                <td className="px-2 py-2 text-right">{formatMoney(allTotals.seguro)}</td>
                <td className="px-2 py-2 text-right">{formatMoney(allTotals.ivaSeg)}</td>
                <td className="px-2 py-2 text-right font-bold">{formatMoney(allTotals.total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Modal Aviso de Pago (idéntico a modal de Amortizaciones) ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200" onClick={e => e.stopPropagation()}>

            {/* Header modal */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-[#2E5C91] rounded-t-xl">
              <div>
                <h4 className="text-sm font-bold text-white">Nuevo Aviso de Pago</h4>
                <p className="text-[11px] text-blue-200 mt-0.5">
                  {selected.size} aportación{selected.size !== 1 ? 'es' : ''} · {moneda}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l8 8M11 3l-8 8"/>
                </svg>
              </button>
            </div>

            {/* Resumen montos */}
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 grid grid-cols-2 gap-y-1.5 gap-x-6">
                {[
                  ['Aportación (Capital)', totals.capital],
                  ...(totals.interes > 0  ? [['Interés',     totals.interes]] : []),
                  ...(totals.iva     > 0  ? [['IVA Interés', totals.iva]]     : []),
                  ...(totals.seguro  > 0  ? [['Seguro',      totals.seguro]]  : []),
                  ...(totals.ivaSeg  > 0  ? [['IVA Seguro',  totals.ivaSeg]]  : []),
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between text-xs">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium">{formatMoney(val as number)}</span>
                  </div>
                ))}
                <div className="col-span-2 flex justify-between text-xs font-bold border-t border-gray-200 pt-1.5 mt-0.5">
                  <span>Total a Cobrar</span>
                  <span className="text-[#2E5C91]">{formatMoney(totals.total)}</span>
                </div>
              </div>

              {/* Campos del aviso */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Forma de Pago *</label>
                  <select
                    value={formaPago}
                    onChange={e => setFormaPago(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
                  >
                    <option>Banca por internet</option>
                    <option>En sucursal</option>
                    <option>Transferencia SPEI</option>
                    <option>Depósito en efectivo</option>
                    <option>Cheque</option>
                    <option>Cargo automático</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Fecha Compromiso</label>
                  <input
                    type="date"
                    value={fechaCompromiso}
                    readOnly
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-default"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">No. Solicitud</label>
                  <input
                    type="text"
                    value={referencia}
                    readOnly
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-default"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Institución Financiera</label>
                  <input
                    type="text"
                    value={institucion}
                    readOnly
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-default"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Cuenta Bancaria</label>
                  <input
                    type="text"
                    value={cuentaBancaria}
                    readOnly
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-default"
                  />
                </div>
              </div>
            </div>

            {/* Footer modal */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearAviso}
                disabled={enviando}
                className="px-5 py-1.5 text-xs bg-[#2E5C91] text-white rounded-lg hover:bg-[#245080] disabled:opacity-50 font-medium flex items-center gap-1.5"
              >
                {enviando ? (
                  <>
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/>
                    </svg>
                    Creando...
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M6 1v6M3 4l3 3 3-3" strokeLinecap="round"/><rect x="1" y="8" width="10" height="3" rx="1"/>
                    </svg>
                    Crear Aviso de Pago
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
