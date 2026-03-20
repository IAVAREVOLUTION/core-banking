import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import {
  Bloqueo, saveToSession, loadFromSession, generateId,
  MOCK_BLOQUEOS, fromISODate, toISODate,
  CATALOGO_TIPO_BLOQUEO, CATALOGO_ESTATUS_BLOQUEO,
} from './cuentasAhorroStore';

interface BloqueosTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  accountId: number | 'new';
}

export function BloqueosTab({ mode, accountId }: BloqueosTabProps) {
  const getInitial = (): Bloqueo[] => {
    const saved = loadFromSession<Bloqueo[]>(accountId, 'bloqueos');
    if (saved) return saved;
    if (mode === 'nuevo') return [];
    return MOCK_BLOQUEOS[accountId as number] ? [...MOCK_BLOQUEOS[accountId as number]] : [];
  };

  const [bloqueos, setBloqueos] = useState<Bloqueo[]>(getInitial);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isReadOnly = mode === 'ver';

  useEffect(() => {
    if (mode !== 'ver') saveToSession(accountId, 'bloqueos', bloqueos);
  }, [bloqueos, accountId, mode]);

  const handleNuevo = () => {
    setBloqueos(prev => [...prev, { id: generateId(), tipoBloqueo: '', motivo: '', fechaInicio: '', fechaFin: '', estatus: 'Activo' }]);
    setSelectedIndex(bloqueos.length);
    toast.success('Bloqueo agregado');
  };

  const handleEliminar = () => {
    if (selectedIndex === null) { toast.error('Seleccione un bloqueo'); return; }
    setBloqueos(prev => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
    toast.success('Bloqueo eliminado');
  };

  const update = (index: number, field: keyof Bloqueo, value: any) => {
    setBloqueos(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const updateDate = (index: number, field: keyof Bloqueo, ddmmyyyy: string) => {
    update(index, field, toISODate(ddmmyyyy));
  };

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm text-gray-800">BLOQUEOS</span>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <button onClick={handleNuevo} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Nuevo</button>
            <button onClick={handleEliminar} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50">Eliminar</button>
          </div>
        )}
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[160px]">Tipo Bloqueo <span className="text-red-600">*</span></th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Motivo <span className="text-red-600">*</span></th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[165px]">Fecha Inicio <span className="text-red-600">*</span></th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[165px]">Fecha Fin</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left w-[130px]">Estatus <span className="text-red-600">*</span></th>
            </tr>
          </thead>
          <tbody>
            {bloqueos.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Agregue bloqueos con el botón Nuevo' : 'Sin bloqueos registrados'}</td></tr>
            ) : bloqueos.map((b, idx) => (
              <tr key={b.id} className={`border-b border-gray-300 cursor-pointer ${selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isReadOnly && setSelectedIndex(idx)}>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <select value={b.tipoBloqueo} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'tipoBloqueo', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white">
                    <option value="">Seleccione...</option>
                    {CATALOGO_TIPO_BLOQUEO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={b.motivo} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'motivo', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" placeholder="Motivo del bloqueo..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300" onClick={e => e.stopPropagation()}>
                  <DatePicker value={fromISODate(b.fechaInicio)} onChange={v => updateDate(idx, 'fechaInicio', v)} disabled={isReadOnly} placeholder="dd/mm/aaaa" className="px-1 py-1" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300" onClick={e => e.stopPropagation()}>
                  <DatePicker value={fromISODate(b.fechaFin)} onChange={v => updateDate(idx, 'fechaFin', v)} disabled={isReadOnly} placeholder="dd/mm/aaaa" className="px-1 py-1" />
                </td>
                <td className="px-2 py-1.5">
                  <select value={b.estatus} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'estatus', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white">
                    {CATALOGO_ESTATUS_BLOQUEO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bloqueos.length < 3 && <div className="h-16 bg-white"></div>}
      </div>
    </div>
  );
}
