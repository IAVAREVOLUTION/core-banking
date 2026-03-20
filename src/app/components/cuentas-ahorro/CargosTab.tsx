import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import {
  Cargo, saveToSession, loadFromSession, generateId,
  MOCK_CARGOS, fromISODate, toISODate,
  CATALOGO_PERIODICIDAD, CATALOGO_ESTATUS_CARGO,
} from './cuentasAhorroStore';

interface CargosTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  accountId: number | 'new';
}

export function CargosTab({ mode, accountId }: CargosTabProps) {
  const getInitial = (): Cargo[] => {
    const saved = loadFromSession<Cargo[]>(accountId, 'cargos');
    if (saved) return saved;
    if (mode === 'nuevo') return [];
    return MOCK_CARGOS[accountId as number] ? [...MOCK_CARGOS[accountId as number]] : [];
  };

  const [cargos, setCargos] = useState<Cargo[]>(getInitial);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isReadOnly = mode === 'ver';

  useEffect(() => {
    if (mode !== 'ver') saveToSession(accountId, 'cargos', cargos);
  }, [cargos, accountId, mode]);

  const handleNuevo = () => {
    setCargos(prev => [...prev, { id: generateId(), concepto: '', descripcion: '', monto: 0, fechaCargo: '', fechaAplicacion: '', periodicidad: 'Mensual', estatus: 'Pendiente' }]);
    setSelectedIndex(cargos.length);
    toast.success('Cargo agregado');
  };

  const handleEliminar = () => {
    if (selectedIndex === null) { toast.error('Seleccione un cargo'); return; }
    setCargos(prev => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
    toast.success('Cargo eliminado');
  };

  const update = (index: number, field: keyof Cargo, value: any) => {
    setCargos(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const updateDate = (index: number, field: keyof Cargo, ddmmyyyy: string) => {
    update(index, field, toISODate(ddmmyyyy));
  };

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm text-gray-800">CARGOS</span>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <button onClick={handleNuevo} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Nuevo</button>
            <button onClick={handleEliminar} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50">Eliminar</button>
          </div>
        )}
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[180px]">Concepto <span className="text-red-600">*</span></th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripción</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300 w-[120px]">Monto <span className="text-red-600">*</span></th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[155px]">Fecha Cargo <span className="text-red-600">*</span></th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[155px]">Fecha Aplicación</th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[130px]">Periodicidad <span className="text-red-600">*</span></th>
              <th className="px-3 py-2 text-xs text-gray-700 text-left w-[120px]">Estatus <span className="text-red-600">*</span></th>
            </tr>
          </thead>
          <tbody>
            {cargos.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Agregue cargos con el botón Nuevo' : 'Sin cargos registrados'}</td></tr>
            ) : cargos.map((c, idx) => (
              <tr key={c.id} className={`border-b border-gray-300 cursor-pointer ${selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isReadOnly && setSelectedIndex(idx)}>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={c.concepto} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'concepto', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" placeholder="Concepto..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={c.descripcion} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'descripcion', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" placeholder="Descripción..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="number" step="0.01" min="0" value={c.monto} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'monto', parseFloat(e.target.value) || 0); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white text-right" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300" onClick={e => e.stopPropagation()}>
                  <DatePicker value={fromISODate(c.fechaCargo)} onChange={v => updateDate(idx, 'fechaCargo', v)} disabled={isReadOnly} placeholder="dd/mm/aaaa" className="px-1 py-1" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300" onClick={e => e.stopPropagation()}>
                  <DatePicker value={fromISODate(c.fechaAplicacion)} onChange={v => updateDate(idx, 'fechaAplicacion', v)} disabled={isReadOnly} placeholder="dd/mm/aaaa" className="px-1 py-1" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <select value={c.periodicidad} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'periodicidad', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white">
                    {CATALOGO_PERIODICIDAD.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select value={c.estatus} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'estatus', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white">
                    {CATALOGO_ESTATUS_CARGO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cargos.length < 3 && <div className="h-16 bg-white"></div>}
      </div>
    </div>
  );
}
