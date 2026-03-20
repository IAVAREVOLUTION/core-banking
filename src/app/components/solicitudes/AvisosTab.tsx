import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { Aviso, saveToSession, loadFromSession, loadFromSavedStore, generateId, MOCK_AVISOS, CAT_TIPO_AVISO, CAT_ESTATUS_AVISO } from './solicitudCreditoStore';

interface Props { mode: 'nuevo' | 'editar' | 'ver'; solicitudId: number | string | 'new'; }

export function AvisosTab({ mode, solicitudId }: Props) {
  const getInit = (): Aviso[] => {
    const s = loadFromSession<Aviso[]>(solicitudId, 'avisos');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<Aviso[]>(solicitudId, 'avisos');
    if (saved) return saved;
    return MOCK_AVISOS[solicitudId as number] || [];
  };

  const [items, setItems] = useState<Aviso[]>(getInit);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const isRO = mode === 'ver';

  useEffect(() => { if (mode !== 'ver') saveToSession(solicitudId, 'avisos', items); }, [items, solicitudId, mode]);

  const handleNuevo = () => {
    const now = new Date();
    const fc = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    setItems(p => [...p, { id: generateId(), tipo: '', mensaje: '', fechaCreacion: fc, fechaVencimiento: '', destinatario: '', estatus: 'Activo' }]);
    setSelectedIdx(items.length);
    toast.success('Aviso agregado');
  };

  const handleEliminar = () => {
    if (selectedIdx === null) { toast.error('Seleccione un aviso'); return; }
    setItems(p => p.filter((_, i) => i !== selectedIdx));
    setSelectedIdx(null);
    toast.success('Aviso eliminado');
  };

  const update = (idx: number, f: keyof Aviso, v: string) => {
    setItems(p => p.map((a, i) => i === idx ? { ...a, [f]: v } : a));
  };

  return (
    <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5">
          <span className="text-xs text-gray-800">AVISOS</span>
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
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[120px]">Tipo <span className="text-red-600">*</span></th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Mensaje <span className="text-red-600">*</span></th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[110px]">Fecha Creación</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[155px]">Fecha Vencimiento</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[130px]">Destinatario</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left w-[110px]">Estatus <span className="text-red-600">*</span></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Agregue avisos con el botón Nuevo' : 'Sin avisos registrados'}</td></tr>
            ) : items.map((a, idx) => (
              <tr key={a.id} className={`border-b border-gray-200 cursor-pointer ${selectedIdx === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isRO && setSelectedIdx(idx)}>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <select value={a.tipo} onChange={e => { e.stopPropagation(); update(idx, 'tipo', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white">
                    <option value="">Seleccione...</option>
                    {CAT_TIPO_AVISO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <input type="text" value={a.mensaje} onChange={e => { e.stopPropagation(); update(idx, 'mensaje', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Mensaje..." />
                </td>
                <td className="px-2 py-1.5 text-xs text-gray-600 border-r border-gray-200">{a.fechaCreacion}</td>
                <td className="px-2 py-1.5 border-r border-gray-200" onClick={e => e.stopPropagation()}>
                  <DatePicker value={a.fechaVencimiento} onChange={v => update(idx, 'fechaVencimiento', v)} disabled={isRO} placeholder="dd/mm/aaaa" className="px-1 py-0.5" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <input type="text" value={a.destinatario} onChange={e => { e.stopPropagation(); update(idx, 'destinatario', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Destinatario..." />
                </td>
                <td className="px-2 py-1.5">
                  <select value={a.estatus} onChange={e => { e.stopPropagation(); update(idx, 'estatus', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white">
                    {CAT_ESTATUS_AVISO.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
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