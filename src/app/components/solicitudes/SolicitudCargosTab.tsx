import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { CargoSolicitud, saveToSession, loadFromSession, loadFromSavedStore, generateId, MOCK_CARGOS, CAT_TIPO_CARGO, CAT_ESTATUS_CARGO, formatCurrency } from './solicitudCreditoStore';

interface Props { mode: 'nuevo' | 'editar' | 'ver'; solicitudId: number | string | 'new'; }

export function SolicitudCargosTab({ mode, solicitudId }: Props) {
  const getInit = (): CargoSolicitud[] => {
    const s = loadFromSession<CargoSolicitud[]>(solicitudId, 'cargos');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<CargoSolicitud[]>(solicitudId, 'cargos');
    if (saved) return saved;
    return MOCK_CARGOS[solicitudId as number] || [];
  };

  const [items, setItems] = useState<CargoSolicitud[]>(getInit);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const isRO = mode === 'ver';

  useEffect(() => { if (mode !== 'ver') saveToSession(solicitudId, 'cargos', items); }, [items, solicitudId, mode]);

  const handleNuevo = () => {
    setItems(p => [...p, { id: generateId(), tipoCargo: '', descripcion: '', monto: 0, fechaCargo: '', estatus: 'Pendiente', notas: '' }]);
    setSelectedIdx(items.length);
    toast.success('Cargo agregado');
  };

  const handleEliminar = () => {
    if (selectedIdx === null) { toast.error('Seleccione un cargo'); return; }
    setItems(p => p.filter((_, i) => i !== selectedIdx));
    setSelectedIdx(null);
    toast.success('Cargo eliminado');
  };

  const update = (idx: number, f: keyof CargoSolicitud, v: any) => {
    setItems(p => p.map((c, i) => i === idx ? { ...c, [f]: v } : c));
  };

  const totalMonto = items.reduce((sum, c) => sum + (c.monto || 0), 0);

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4A6FA5] to-[#607698] flex items-center justify-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M8 2v12M4 6l4-4 4 4M4 10l4 4 4-4" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Cargos de la Solicitud</h4>
              <p className="text-[10px] text-gray-400 leading-tight">
                {solicitudId === 'new' ? 'Nueva Solicitud' : `Sol. ${solicitudId}`}
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-[#4A6FA5] text-white shadow-sm">
              {items.length}
            </span>
          )}
        </div>
        {!isRO && (
          <div className="flex items-center gap-2">
            <button onClick={handleNuevo} className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 shadow-sm bg-[#4A6FA5] text-white hover:bg-[#3A5A8A]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 1v10M1 6h10" />
              </svg>
              Nuevo
            </button>
            <button onClick={handleEliminar} className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 3h8M5 3V2h2v1M4 3v7a1 1 0 001 1h2a1 1 0 001-1V3" />
              </svg>
              Eliminar
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gradient-to-b from-gray-50/50 to-white">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C4C9D4" strokeWidth="1.5">
              <path d="M14 6v16M8 10l6-4 6 4M8 18l6 4 6-4" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Sin cargos</p>
          <p className="text-xs text-gray-400">
            {!isRO ? 'Presione "Nuevo" para agregar un cargo.' : 'No se han registrado cargos para esta solicitud.'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tipo Cargo</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha Cargo</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Estatus</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((c, idx) => (
                  <tr key={c.id} className={`cursor-pointer ${selectedIdx === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isRO && setSelectedIdx(idx)}>
                    <td className="px-3 py-2">
                      <select value={c.tipoCargo} onChange={e => { e.stopPropagation(); update(idx, 'tipoCargo', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]">
                        <option value="">Seleccione...</option>
                        {CAT_TIPO_CARGO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={c.descripcion} onChange={e => { e.stopPropagation(); update(idx, 'descripcion', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]" placeholder="Descripción..." />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={c.monto} onChange={e => { e.stopPropagation(); update(idx, 'monto', parseFloat(e.target.value) || 0); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-right focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]" />
                    </td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <DatePicker value={c.fechaCargo} onChange={v => update(idx, 'fechaCargo', v)} disabled={isRO} placeholder="dd/mm/aaaa" className="px-2 py-1.5" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={c.estatus} onChange={e => { e.stopPropagation(); update(idx, 'estatus', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]">
                        {CAT_ESTATUS_CARGO.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={c.notas} onChange={e => { e.stopPropagation(); update(idx, 'notas', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]" placeholder="Notas..." />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 flex justify-between items-center">
            <span className="text-[10px] text-gray-400">{items.length} cargo{items.length !== 1 ? 's' : ''} registrado{items.length !== 1 ? 's' : ''}</span>
            <span className="text-xs font-semibold text-gray-700">Total: {formatCurrency(totalMonto)}</span>
          </div>
        </div>
      )}
    </div>
  );
}