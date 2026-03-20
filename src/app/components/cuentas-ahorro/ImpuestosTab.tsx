import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import {
  Impuesto, saveToSession, loadFromSession, generateId,
  MOCK_IMPUESTOS, formatCurrency, fromISODate, toISODate,
  CATALOGO_ESTATUS_IMPUESTO,
} from './cuentasAhorroStore';

interface ImpuestosTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  accountId: number | 'new';
}

export function ImpuestosTab({ mode, accountId }: ImpuestosTabProps) {
  const getInitial = (): Impuesto[] => {
    const saved = loadFromSession<Impuesto[]>(accountId, 'impuestos');
    if (saved) return saved;
    if (mode === 'nuevo') return [];
    return MOCK_IMPUESTOS[accountId as number] ? [...MOCK_IMPUESTOS[accountId as number]] : [];
  };

  const [impuestos, setImpuestos] = useState<Impuesto[]>(getInitial);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isReadOnly = mode === 'ver';

  useEffect(() => {
    if (mode !== 'ver') saveToSession(accountId, 'impuestos', impuestos);
  }, [impuestos, accountId, mode]);

  const handleNuevo = () => {
    setImpuestos(prev => [...prev, { id: generateId(), concepto: '', periodo: '', base: 0, tasa: 15, impuestoRetenido: 0, fechaRetencion: '', estatus: 'Pendiente' }]);
    setSelectedIndex(impuestos.length);
    toast.success('Registro de impuesto agregado');
  };

  const handleEliminar = () => {
    if (selectedIndex === null) { toast.error('Seleccione un impuesto'); return; }
    setImpuestos(prev => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
    toast.success('Impuesto eliminado');
  };

  const update = (index: number, field: keyof Impuesto, value: any) => {
    setImpuestos(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'base' || field === 'tasa') {
        updated.impuestoRetenido = parseFloat(((updated.base * updated.tasa) / 100).toFixed(2));
      }
      return updated;
    }));
  };

  const updateDate = (index: number, field: keyof Impuesto, ddmmyyyy: string) => {
    update(index, field, toISODate(ddmmyyyy));
  };

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm text-gray-800">IMPUESTOS</span>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <button onClick={handleNuevo} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Nuevo</button>
            <button onClick={handleEliminar} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50">Eliminar</button>
          </div>
        )}
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[180px]">Concepto <span className="text-red-600">*</span></th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[140px]">Periodo <span className="text-red-600">*</span></th>
              <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300 w-[120px]">Base</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300 w-[80px]">Tasa (%)</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300 w-[120px]">Imp. Retenido</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[155px]">Fecha Retención</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left w-[120px]">Estatus <span className="text-red-600">*</span></th>
            </tr>
          </thead>
          <tbody>
            {impuestos.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Se calcularán automáticamente' : 'Sin impuestos registrados'}</td></tr>
            ) : impuestos.map((item, idx) => (
              <tr key={item.id} className={`border-b border-gray-300 cursor-pointer ${selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isReadOnly && setSelectedIndex(idx)}>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={item.concepto} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'concepto', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" placeholder="Concepto..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={item.periodo} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'periodo', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" placeholder="Periodo..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="number" step="0.01" value={item.base} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'base', parseFloat(e.target.value) || 0); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white text-right" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="number" step="0.01" min="0" max="100" value={item.tasa} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'tasa', parseFloat(e.target.value) || 0); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white text-right" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <div className="px-1 py-1 text-xs text-gray-700 bg-gray-100 border border-gray-300 rounded text-right">{formatCurrency(item.impuestoRetenido)}</div>
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300" onClick={e => e.stopPropagation()}>
                  <DatePicker value={fromISODate(item.fechaRetencion)} onChange={v => updateDate(idx, 'fechaRetencion', v)} disabled={isReadOnly} placeholder="dd/mm/aaaa" className="px-1 py-1" />
                </td>
                <td className="px-2 py-1.5">
                  <select value={item.estatus} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'estatus', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white">
                    <option value="">Seleccione...</option>
                    {CATALOGO_ESTATUS_IMPUESTO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {impuestos.length < 3 && <div className="h-16 bg-white"></div>}
      </div>
    </div>
  );
}
