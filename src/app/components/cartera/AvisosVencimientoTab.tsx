import { useEffect } from 'react';
import { useAvisos, formatMoney, fmtDate } from '../../hooks/useCarteraDB';

const ESTATUS_COLOR: Record<string, string> = {
  Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  Pagada:    'bg-green-50 text-green-700 border-green-200',
  Vencida:   'bg-red-50 text-red-700 border-red-200',
  Cancelada: 'bg-gray-100 text-gray-500 border-gray-200',
};

interface Props { solicitudId: string; }

export function AvisosVencimientoTab({ solicitudId }: Props) {
  const { rows, loading, error, refetch } = useAvisos(solicitudId);
  useEffect(() => { refetch(); }, [refetch]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{rows.length} aviso{rows.length !== 1 ? 's' : ''} de vencimiento</span>
        <button onClick={refetch} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/></svg>
          Actualizar
        </button>
      </div>

      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}

      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#2E5C91] text-white">
              <th className="px-2 py-2 text-left font-medium">No. Docto</th>
              <th className="px-2 py-2 text-left font-medium">Fecha</th>
              <th className="px-2 py-2 text-left font-medium">Tipo</th>
              <th className="px-2 py-2 text-left font-medium">Forma Pago</th>
              <th className="px-2 py-2 text-left font-medium">F. Compromiso</th>
              <th className="px-2 py-2 text-right font-medium">Monto</th>
              <th className="px-2 py-2 text-center font-medium">Moneda</th>
              <th className="px-2 py-2 text-center font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center">
                  <div className="text-gray-400">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-2">
                      <rect x="4" y="6" width="24" height="20" rx="2"/><path d="M4 12h24M10 4v4M22 4v4"/>
                    </svg>
                    <p className="text-xs">Sin avisos de vencimiento</p>
                  </div>
                </td>
              </tr>
            ) : rows.map((r, idx) => (
              <tr key={r.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-2 py-2 font-mono text-gray-700">{r.no_docto || '—'}</td>
                <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{fmtDate(r.fecha)}</td>
                <td className="px-2 py-2 text-gray-600">{r.sub_tipo || r.tipo}</td>
                <td className="px-2 py-2 text-gray-600">{(r as any).forma_pago || '—'}</td>
                <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{fmtDate((r as any).fecha_compromiso)}</td>
                <td className="px-2 py-2 text-right font-medium text-gray-800">{formatMoney(r.monto_transaccion)}</td>
                <td className="px-2 py-2 text-center text-gray-600">{(r as any).moneda || 'MXN'}</td>
                <td className="px-2 py-2 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTATUS_COLOR[r.estatus] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {r.estatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
