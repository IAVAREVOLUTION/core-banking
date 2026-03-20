import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  SolicitudExtraordinaria, saveToSession, loadFromSession, generateId,
  MOCK_SOLICITUDES,
  CATALOGO_SOLICITUD_EXTRAORDINARIA, CATALOGO_ESTATUS_SOLICITUD,
} from './cuentasAhorroStore';

interface SolicitudExtraordinariaTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  accountId: number | 'new';
}

export function SolicitudExtraordinariaTab({ mode, accountId }: SolicitudExtraordinariaTabProps) {
  const getInitial = (): SolicitudExtraordinaria[] => {
    const saved = loadFromSession<SolicitudExtraordinaria[]>(accountId, 'solicitudes');
    if (saved) return saved;
    if (mode === 'nuevo') return [];
    return MOCK_SOLICITUDES[accountId as number] ? [...MOCK_SOLICITUDES[accountId as number]] : [];
  };

  const [solicitudes, setSolicitudes] = useState<SolicitudExtraordinaria[]>(getInitial);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isReadOnly = mode === 'ver';

  useEffect(() => {
    if (mode !== 'ver') saveToSession(accountId, 'solicitudes', solicitudes);
  }, [solicitudes, accountId, mode]);

  const handleNuevo = () => {
    const newS: SolicitudExtraordinaria = {
      id: generateId(),
      numeroCuenta: '',
      productoFinanciero: '',
      areaSolicito: '',
      puestoTrabajo: '',
      solicitudExtraordinaria: '',
      areaAutorizo: '',
      observaciones: '',
      estatus: 'Pendiente',
    };
    setSolicitudes(prev => [...prev, newS]);
    setSelectedIndex(solicitudes.length);
    toast.success('Solicitud agregada');
  };

  const handleEliminar = () => {
    if (selectedIndex === null) { toast.error('Seleccione una solicitud'); return; }
    setSolicitudes(prev => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
    toast.success('Solicitud eliminada');
  };

  const update = (index: number, field: keyof SolicitudExtraordinaria, value: any) => {
    setSolicitudes(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">SOLICITUD EXTRAORDINARIA</span>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <button onClick={handleNuevo} className="px-4 py-1.5 btn-secondary-theme rounded text-xs font-medium">Nuevo</button>
            <button onClick={handleEliminar} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50 font-medium">Eliminar</button>
          </div>
        )}
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[1300px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[120px]">N Cuenta</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[180px]">Producto Financiero</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[160px]">Area que Solicito *</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[150px]">Puesto de Trabajo *</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[200px]">Solicitud Extraordinaria *</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300 w-[160px]">Area que Autorizo</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300">Observaciones</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left w-[120px]">Estatus *</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Agregue solicitudes con el boton Nuevo' : 'Sin solicitudes registradas'}</td></tr>
            ) : solicitudes.map((s, idx) => (
              <tr key={s.id} className={`border-b border-gray-300 cursor-pointer ${selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isReadOnly && setSelectedIndex(idx)}>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={s.numeroCuenta} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'numeroCuenta', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={s.productoFinanciero} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'productoFinanciero', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={s.areaSolicito} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'areaSolicito', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" placeholder="Area..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={s.puestoTrabajo} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'puestoTrabajo', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" placeholder="Puesto..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <select value={s.solicitudExtraordinaria} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'solicitudExtraordinaria', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white">
                    <option value="">Elige...</option>
                    {CATALOGO_SOLICITUD_EXTRAORDINARIA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={s.areaAutorizo} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'areaAutorizo', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" placeholder="Area..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-300">
                  <input type="text" value={s.observaciones} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'observaciones', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white" placeholder="Observaciones..." />
                </td>
                <td className="px-2 py-1.5">
                  <select value={s.estatus} disabled={isReadOnly} onChange={e => { e.stopPropagation(); update(idx, 'estatus', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white">
                    <option value="">Elige...</option>
                    {CATALOGO_ESTATUS_SOLICITUD.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {solicitudes.length < 3 && <div className="h-16 bg-white"></div>}
      </div>

      {/* Validations panel */}
      <div className="mt-4">
        <div className="bg-gray-50 border border-gray-300 rounded p-3">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Reglas de Validacion</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <p>- Campos obligatorios: Area que solicito, Puesto de trabajo, Tipo de solicitud, Estatus</p>
            <p>- Si tipo = "Otro", las observaciones son obligatorias</p>
            <p>- Si estatus = "Autorizado", el area que autorizo es obligatoria</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">Pendientes</p>
          <p className="text-2xl font-semibold text-yellow-600">{solicitudes.filter(s => s.estatus === 'Pendiente').length}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">Autorizadas</p>
          <p className="text-2xl font-semibold text-green-600">{solicitudes.filter(s => s.estatus === 'Autorizado').length}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">Rechazadas</p>
          <p className="text-2xl font-semibold text-red-600">{solicitudes.filter(s => s.estatus === 'Rechazado').length}</p>
        </div>
      </div>
    </div>
  );
}
