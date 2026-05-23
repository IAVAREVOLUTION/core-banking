import { useState, useEffect } from 'react';
import {
  RendimientoPeriodo, saveToSession, loadFromSession,
  MOCK_RENDIMIENTOS, fromISODate, formatCurrency,
} from './cuentasAhorroStore';

interface RendimientoPeriodoTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  accountId: number | 'new';
}

export function RendimientoPeriodoTab({ mode, accountId }: RendimientoPeriodoTabProps) {
  const getInitial = (): RendimientoPeriodo[] => {
    const saved = loadFromSession<RendimientoPeriodo[]>(accountId, 'rendimientos');
    if (saved) return saved;
    if (mode === 'nuevo') return [];
    return MOCK_RENDIMIENTOS[accountId as number] ? [...MOCK_RENDIMIENTOS[accountId as number]] : [];
  };

  const [rendimientos] = useState<RendimientoPeriodo[]>(getInitial);

  useEffect(() => {
    if (mode !== 'ver') saveToSession(accountId, 'rendimientos', rendimientos);
  }, [rendimientos, accountId, mode]);

  return (
    <div className="bg-white">
      <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-2 mb-3">
        <span className="text-sm font-medium text-gray-800">RENDIMIENTO POR PERIODO</span>
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-[#D0D0D0] border-b border-gray-300">
              <th className="px-3 py-2 text-xs font-normal text-gray-700 text-left border-r border-gray-300">Periodo</th>
              <th className="px-3 py-2 text-xs font-normal text-gray-700 text-left border-r border-gray-300">Fecha Inicio</th>
              <th className="px-3 py-2 text-xs font-normal text-gray-700 text-left border-r border-gray-300">Fecha Fin</th>
              <th className="px-3 py-2 text-xs font-normal text-gray-700 text-right border-r border-gray-300">Saldo Promedio</th>
              <th className="px-3 py-2 text-xs font-normal text-gray-700 text-right border-r border-gray-300">Tasa (%)</th>
              <th className="px-3 py-2 text-xs font-normal text-gray-700 text-right border-r border-gray-300">Rend. Bruto</th>
              <th className="px-3 py-2 text-xs font-normal text-gray-700 text-right border-r border-gray-300">Impuesto</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right">Rend. Neto</th>
            </tr>
          </thead>
          <tbody>
            {rendimientos.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Se calcularan al cierre de periodo' : 'Sin rendimientos registrados'}</td></tr>
            ) : rendimientos.map((r, idx) => (
              <tr key={r.id}
                className="border-b border-gray-200 transition-colors"
                style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{r.periodo}</td>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{fromISODate(r.fechaInicio)}</td>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{fromISODate(r.fechaFin)}</td>
                <td className="px-3 py-2 text-xs font-normal text-gray-700 text-right border-r border-gray-300">{formatCurrency(r.saldoPromedio)}</td>
                <td className="px-3 py-2 text-xs font-normal text-gray-700 text-right border-r border-gray-300">{r.tasaAplicada.toFixed(4)}%</td>
                <td className="px-3 py-2 text-xs font-normal text-gray-700 text-right border-r border-gray-300">{formatCurrency(r.rendimientoBruto)}</td>
                <td className="px-3 py-2 text-xs font-normal text-gray-700 text-right border-r border-gray-300">{formatCurrency(r.impuesto)}</td>
                <td className="px-3 py-2 text-xs text-gray-700 text-right">{formatCurrency(r.rendimientoNeto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

