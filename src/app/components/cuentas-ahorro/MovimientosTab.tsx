import { useState, useEffect } from 'react';
import {
  Movimiento, saveToSession, loadFromSession,
  MOCK_MOVIMIENTOS, fromISODate, formatCurrency,
} from './cuentasAhorroStore';

interface MovimientosTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  accountId: number | 'new';
}

export function MovimientosTab({ mode, accountId }: MovimientosTabProps) {
  const getInitial = (): Movimiento[] => {
    const saved = loadFromSession<Movimiento[]>(accountId, 'movimientos');
    if (saved) return saved;
    if (mode === 'nuevo') return [];
    return MOCK_MOVIMIENTOS[accountId as number] ? [...MOCK_MOVIMIENTOS[accountId as number]] : [];
  };

  const [movimientos] = useState<Movimiento[]>(getInitial);

  useEffect(() => {
    if (mode !== 'ver') saveToSession(accountId, 'movimientos', movimientos);
  }, [movimientos, accountId, mode]);

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3">
        <span className="text-sm font-medium text-gray-800">MOVIMIENTOS</span>
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300">Fecha</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300">Concepto</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300">Referencia</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-center border-r border-gray-300">Tipo</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right border-r border-gray-300">Monto</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right">Saldo Resultante</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Los movimientos se registraran automaticamente' : 'Sin movimientos registrados'}</td></tr>
            ) : movimientos.map((m, idx) => (
              <tr key={m.id} className={`border-b border-gray-200 ${idx % 2 === 1 ? 'bg-gray-50' : ''}`}>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{fromISODate(m.fecha)}</td>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{m.concepto}</td>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{m.referencia}</td>
                <td className="px-3 py-2 text-xs text-center border-r border-gray-300">
                  <span className={`px-2 py-0.5 rounded text-xs ${m.tipo === 'Abono' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.tipo}</span>
                </td>
                <td className="px-3 py-2 text-xs text-right border-r border-gray-300">
                  <span className={m.tipo === 'Abono' ? 'text-green-700' : 'text-red-700'}>{m.tipo === 'Cargo' ? '-' : ''}{formatCurrency(m.monto)}</span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-700 text-right">{formatCurrency(m.saldoResultante)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
