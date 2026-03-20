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

  return (
    <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5">
          <span className="text-xs text-gray-800">CARGOS DE LA SOLICITUD</span>
        </div>
        {!isRO && (
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
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[160px]">Tipo Cargo <span className="text-red-600">*</span></th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripción</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-right border-r border-gray-300 w-[120px]">Monto <span className="text-red-600">*</span></th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[155px]">Fecha Cargo <span className="text-red-600">*</span></th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[110px]">Estatus <span className="text-red-600">*</span></th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left">Notas</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Agregue cargos con el botón Nuevo' : 'Sin cargos registrados'}</td></tr>
            ) : items.map((c, idx) => (
              <tr key={c.id} className={`border-b border-gray-200 cursor-pointer ${selectedIdx === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isRO && setSelectedIdx(idx)}>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <select value={c.tipoCargo} onChange={e => { e.stopPropagation(); update(idx, 'tipoCargo', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white">
                    <option value="">Seleccione...</option>
                    {CAT_TIPO_CARGO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <input type="text" value={c.descripcion} onChange={e => { e.stopPropagation(); update(idx, 'descripcion', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Descripción..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <input type="number" step="0.01" min="0" value={c.monto} onChange={e => { e.stopPropagation(); update(idx, 'monto', parseFloat(e.target.value) || 0); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white text-right" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200" onClick={e => e.stopPropagation()}>
                  <DatePicker value={c.fechaCargo} onChange={v => update(idx, 'fechaCargo', v)} disabled={isRO} placeholder="dd/mm/aaaa" className="px-1 py-0.5" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <select value={c.estatus} onChange={e => { e.stopPropagation(); update(idx, 'estatus', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white">
                    {CAT_ESTATUS_CARGO.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" value={c.notas} onChange={e => { e.stopPropagation(); update(idx, 'notas', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Notas..." />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length < 3 && <div className="h-12 bg-white" />}
      </div>
    </div>
  );
}