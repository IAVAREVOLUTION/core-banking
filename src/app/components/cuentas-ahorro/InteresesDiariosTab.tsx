import { useState, useEffect } from 'react';
import {
  InteresDiario, saveToSession, loadFromSession,
  MOCK_INTERESES, fromISODate, formatCurrency,
} from './cuentasAhorroStore';

interface InteresesDiariosTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  accountId: number | 'new';
}

export function InteresesDiariosTab({ mode, accountId }: InteresesDiariosTabProps) {
  const getInitial = (): InteresDiario[] => {
    const saved = loadFromSession<InteresDiario[]>(accountId, 'intereses');
    if (saved) return saved;
    if (mode === 'nuevo') return [];
    return MOCK_INTERESES[accountId as number] ? [...MOCK_INTERESES[accountId as number]] : [];
  };

  const [intereses] = useState<InteresDiario[]>(getInitial);

  useEffect(() => {
    if (mode !== 'ver') saveToSession(accountId, 'intereses', intereses);
  }, [intereses, accountId, mode]);

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3">
        <span className="text-sm font-medium text-gray-800">INTERESES DIARIOS</span>
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300">Fecha</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right border-r border-gray-300">Saldo del Dia</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right border-r border-gray-300">Tasa Anual (%)</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right border-r border-gray-300">Interes Diario</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right border-r border-gray-300">Dias Transcurridos</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right">Interes Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {intereses.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Se calcularan al guardar la cuenta' : 'Sin intereses registrados'}</td></tr>
            ) : intereses.map((item, idx) => (
              <tr key={item.id} className={`border-b border-gray-200 ${idx % 2 === 1 ? 'bg-gray-50' : ''}`}>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{fromISODate(item.fecha)}</td>
                <td className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">{formatCurrency(item.saldoDia)}</td>
                <td className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">{item.tasaAnual.toFixed(4)}%</td>
                <td className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">{formatCurrency(item.interesDiario)}</td>
                <td className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">{item.diasTranscurridos}</td>
                <td className="px-3 py-2 text-xs text-gray-700 text-right">{formatCurrency(item.interesAcumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
