import { useEffect } from 'react';
import { usePagos, formatMoney, fmtDate } from '../../hooks/useCarteraDB';

const ESTATUS_COLOR: Record<string, string> = {
  Aplicado:  'bg-green-50 text-green-700 border-green-200',
  Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  Cancelado: 'bg-gray-50 text-gray-500 border-gray-200',
};

interface Props { solicitudId: string; noSol?: string; montoAut?: number; }

export function PagosTab({ solicitudId, noSol, montoAut }: Props) {
  const { rows, loading, error, refetch } = usePagos(solicitudId);
  useEffect(() => { refetch(); }, [refetch]);

  const totalPagado = rows.reduce((s, r) => s + r.monto, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {rows.length} movimiento{rows.length !== 1 ? 's' : ''}
          {rows.length > 0 && ` · Total pagado: ${formatMoney(totalPagado)}`}
        </span>
        <button onClick={refetch} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/></svg>
          Actualizar
        </button>
      </div>

      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}

      <div className="border border-gray-300 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#D0D0D0] border-b border-gray-300">
              <th className="px-3 py-2 text-left font-normal text-gray-700">Fecha</th>
              <th className="px-3 py-2 text-left font-normal text-gray-700">Concepto</th>
              <th className="px-3 py-2 text-left font-normal text-gray-700">Referencia</th>
              <th className="px-3 py-2 text-left font-normal text-gray-700">Forma Pago</th>
              <th className="px-3 py-2 text-right font-normal text-gray-700">Monto</th>
              <th className="px-3 py-2 text-center font-normal text-gray-700">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                <svg className="animate-spin h-5 w-5 mx-auto mb-1 text-[#4A6FA5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                Cargando movimientos...
              </td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-2">
                    <rect x="4" y="8" width="24" height="16" rx="2"/><path d="M4 14h24M10 20h6"/>
                  </svg>
                  <p className="text-xs text-gray-400">Sin movimientos registrados</p>
                </td>
              </tr>
            ) : rows.map((r, idx) => (
              <tr key={r.id}
                className="border-b border-gray-200 transition-colors"
                style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}
              >
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(r.fecha_pago)}</td>
                <td className="px-3 py-2 text-gray-700 font-medium">{r.concepto || 'Cargo de Crédito'}</td>
                <td className="px-3 py-2 text-gray-600 text-[10px] font-mono">
                  {r.referencia || (noSol ? `Referencia (${noSol}) / Pago de Crédito` : '—')}
                </td>
                <td className="px-3 py-2 text-gray-600">{r.forma_pago || '—'}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-700">{formatMoney(r.monto)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTATUS_COLOR[r.estatus] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {r.estatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {rows.length > 0 && (
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={4} className="px-3 py-1.5 text-right text-xs text-gray-500">Total Pagado:</td>
                <td className="px-3 py-1.5 text-right text-xs text-green-700 font-medium">{formatMoney(totalPagado)}</td>
                <td />
              </tr>
            )}
            <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
              <td colSpan={4} className="px-3 py-2 text-right text-xs text-blue-800">Monto Restante por Pagar:</td>
              <td className="px-3 py-2 text-right text-blue-900 font-bold text-sm">
                {montoAut !== undefined ? formatMoney(montoAut) : '—'}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
        {rows.length < 3 && <div className="h-16 bg-white" />}
      </div>
    </div>
  );
}
