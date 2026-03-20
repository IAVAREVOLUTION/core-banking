import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Beneficiario, saveToSession, loadFromSession, generateId,
  MOCK_BENEFICIARIOS, CATALOGO_PARENTESCO, CATALOGO_BUSQUEDA_CLIENTES,
  fromISODate,
} from './cuentasAhorroStore';

interface BeneficiariosTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  accountId: number | 'new';
}

export function BeneficiariosTab({ mode, accountId }: BeneficiariosTabProps) {
  const getInitial = (): Beneficiario[] => {
    const saved = loadFromSession<Beneficiario[]>(accountId, 'beneficiarios');
    if (saved) return saved;
    if (mode === 'nuevo') return [];
    return MOCK_BENEFICIARIOS[accountId as number] ? [...MOCK_BENEFICIARIOS[accountId as number]] : [];
  };

  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>(getInitial);
  const [showModal, setShowModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isReadOnly = mode === 'ver';

  // Persist on change
  useEffect(() => {
    if (mode !== 'ver') saveToSession(accountId, 'beneficiarios', beneficiarios);
  }, [beneficiarios, accountId, mode]);

  const handleSelectCliente = (cliente: typeof CATALOGO_BUSQUEDA_CLIENTES[0]) => {
    const nombres = cliente.nombre.split(' ');
    const newB: Beneficiario = {
      id: generateId(),
      claveCliente: cliente.clave,
      nombre: nombres[0] || '',
      apellidoPaterno: nombres[1] || '',
      apellidoMaterno: nombres.slice(2).join(' ') || '',
      fechaNacimiento: cliente.fechaNacimiento,
      parentesco: '',
      porcentaje: 0,
      notas: '',
      validacion: false,
    };
    setBeneficiarios(prev => [...prev, newB]);
    setShowModal(false);
    toast.success('Beneficiario agregado');
  };

  const handleEliminar = () => {
    if (selectedIndex === null) { toast.error('Seleccione un beneficiario'); return; }
    setBeneficiarios(prev => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
    toast.success('Beneficiario eliminado');
  };

  const update = (index: number, field: keyof Beneficiario, value: any) => {
    setBeneficiarios(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const handlePercentChange = (index: number, rawValue: string) => {
    const num = parseFloat(rawValue.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return update(index, 'porcentaje', 0);
    update(index, 'porcentaje', Math.min(100, Math.max(0, num)));
  };

  const totalPct = beneficiarios.reduce((s, b) => s + b.porcentaje, 0);

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">BENEFICIARIOS</span>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowModal(true)} className="px-4 py-1.5 btn-secondary-theme rounded text-xs font-medium">Nuevo</button>
            <button onClick={handleEliminar} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50 font-medium">Eliminar</button>
          </div>
        )}
      </div>

      {/* Validation summary */}
      {beneficiarios.length > 0 && (
        <div className={`px-3 py-1.5 mb-2 text-xs rounded ${totalPct === 100 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
          Total porcentaje: {totalPct.toFixed(2)}% {totalPct !== 100 && '(debe sumar 100%)'}
        </div>
      )}

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-2 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[100px]">Id Cliente *</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[100px]">Nombre</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[120px]">Ap. Paterno</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[120px]">Ap. Materno</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[130px]">Fecha Nac.</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[120px]">Parentesco *</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[90px]">Porcentaje *</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300">Notas</th>
              <th className="px-2 py-2 text-xs font-medium text-gray-700 text-center w-[70px]">Validacion</th>
            </tr>
          </thead>
          <tbody>
            {beneficiarios.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Agregue beneficiarios con el boton Nuevo' : 'Sin beneficiarios registrados'}</td></tr>
            ) : beneficiarios.map((b, idx) => (
              <tr key={b.id} className={`border-b border-gray-300 cursor-pointer ${selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isReadOnly && setSelectedIndex(idx)}>
                <td className="px-2 py-1.5 border-r border-gray-300"><div className="px-1 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-300 rounded truncate">{b.claveCliente}</div></td>
                <td className="px-2 py-1.5 border-r border-gray-300"><div className="px-1 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-300 rounded">{b.nombre}</div></td>
                <td className="px-2 py-1.5 border-r border-gray-300"><div className="px-1 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-300 rounded">{b.apellidoPaterno}</div></td>
                <td className="px-2 py-1.5 border-r border-gray-300"><div className="px-1 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-300 rounded">{b.apellidoMaterno}</div></td>
                <td className="px-2 py-1.5 border-r border-gray-300"><div className="px-1 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-300 rounded">{fromISODate(b.fechaNacimiento)}</div></td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <select value={b.parentesco} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'parentesco', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white">
                    <option value="">Elige...</option>
                    {CATALOGO_PARENTESCO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={b.porcentaje} disabled={isReadOnly} onChange={e => { e.stopPropagation(); handlePercentChange(idx, e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white text-right" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={b.notas} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'notas', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" placeholder="Notas..." />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input type="checkbox" checked={b.validacion} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'validacion', e.target.checked); }} onClick={e => e.stopPropagation()} className="w-4 h-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {beneficiarios.length < 3 && <div className="h-16 bg-white"></div>}
      </div>

      {/* Client search modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl w-[850px] max-h-[550px] flex flex-col">
            <div className="bg-[#4A6FA5] text-white px-4 py-3 flex items-center justify-between rounded-t">
              <h3 className="text-sm font-medium">Buscar Cliente - Beneficiario</h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <div className="p-3 flex-1 overflow-auto">
              <table className="w-full text-xs border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Clave</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">RFC</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Nombre</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Personalidad</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Fecha Nac.</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {CATALOGO_BUSQUEDA_CLIENTES.map((c, i) => (
                    <tr key={c.clave} className={`border-b border-gray-200 cursor-pointer ${i % 2 === 1 ? 'bg-gray-50' : ''} hover:bg-blue-50`} onClick={() => handleSelectCliente(c)}>
                      <td className="px-3 py-2">{c.clave}</td>
                      <td className="px-3 py-2">{c.rfc}</td>
                      <td className="px-3 py-2">{c.nombre}</td>
                      <td className="px-3 py-2">{c.personalidad}</td>
                      <td className="px-3 py-2">{fromISODate(c.fechaNacimiento)}</td>
                      <td className="px-3 py-2">{c.estatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-300 flex justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
