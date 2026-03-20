import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as store from './pldStore';

interface Props { onBack?: () => void; }

export function PLDParametros({ onBack }: Props) {
  const [data, setData] = useState(store.getParametros);

  useEffect(() => { store.saveParametros(data); }, [data]);

  const update = (field: keyof store.ParametrosPLD, value: any) => {
    setData(d => ({ ...d, [field]: value }));
  };

  const handleSave = () => {
    store.saveParametros(data);
    toast.success('Parámetros guardados', { description: 'Configuración PLD actualizada.' });
    onBack?.();
  };

  const labelCls = 'text-xs w-44 flex-shrink-0 text-gray-700';
  const inputCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded';

  return (
    <div className="bg-[#F5F5F5] min-h-full">
      {/* Header */}
      <div className="bg-white px-6 py-3 border-b border-gray-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#4A6FA5" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 3v14M13 3v14M3 7h14M3 13h14"/></svg>
          <h1 className="text-sm text-gray-800" style={{ fontWeight: 700 }}>Parámetros PLD</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="px-4 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB]">Guardar</button>
          <button onClick={onBack} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Cancelar</button>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="bg-white border border-gray-300 p-4">
          {/* Parámetros Institucionales */}
          <div className="mb-4">
            <div className="bg-[#D9E2F3] px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-[#4A6FA5]" style={{ fontWeight: 500 }}>
              Parámetros Institucionales PLD
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <div className="flex items-center gap-2">
                <label className={labelCls}>FACTOR RIESGO</label>
                <input type="text" value={data.factorRiesgo} onChange={e => update('factorRiesgo', e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>MONTO MÁX. OPERACIÓN USD</label>
                <input type="text" value={data.montoMaxOperacionUSD} onChange={e => update('montoMaxOperacionUSD', e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>MONTO MÁX. PERSONA FÍSICA</label>
                <input type="text" value={data.montoMaxPersonaFisica} onChange={e => update('montoMaxPersonaFisica', e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>MONTO MÁX. PERSONA MORAL</label>
                <input type="text" value={data.montoMaxPersonaMoral} onChange={e => update('montoMaxPersonaMoral', e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>PERSONA FÍSICA</label>
                <select value={data.aplicaPersonaFisica} onChange={e => update('aplicaPersonaFisica', e.target.value)} className={inputCls}>
                  <option>Sí</option><option>No</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>PERSONA MORAL</label>
                <select value={data.aplicaPersonaMoral} onChange={e => update('aplicaPersonaMoral', e.target.value)} className={inputCls}>
                  <option>Sí</option><option>No</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>SUJETO OBLIGADO</label>
                <input type="text" value={data.sujetoObligado} onChange={e => update('sujetoObligado', e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>ÓRGANO SUPERVISOR</label>
                <input type="text" value={data.organoSupervisor} onChange={e => update('organoSupervisor', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Parámetros de Alertas */}
          <div className="mb-4">
            <div className="bg-[#D9E2F3] px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-[#4A6FA5]" style={{ fontWeight: 500 }}>
              Parámetros de Alertas Automáticas
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-1.5 mb-3">
              <div className="flex items-center gap-2">
                <label className="text-xs w-36 flex-shrink-0 text-gray-700">DÍAS ACTUALIZACIÓN KYC</label>
                <input type="text" value={data.diasActualizacionKYC} onChange={e => update('diasActualizacionKYC', e.target.value.replace(/\D/g, ''))} className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs w-36 flex-shrink-0 text-gray-700">% DESVIACIÓN ALERTA</label>
                <input type="text" value={data.porcentajeDesviacion} onChange={e => update('porcentajeDesviacion', e.target.value.replace(/\D/g, ''))} className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs w-36 flex-shrink-0 text-gray-700">DÍAS RETENCIÓN DOCS</label>
                <input type="text" value={data.diasRetencion} onChange={e => update('diasRetencion', e.target.value.replace(/\D/g, ''))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6">
              <div className="flex items-center gap-2">
                <label className="text-xs w-44 flex-shrink-0 text-gray-700">ALERTAS AUTOMÁTICAS</label>
                <input type="checkbox" checked={data.alertasAutomaticas} onChange={e => update('alertasAutomaticas', e.target.checked)} className="w-3.5 h-3.5 accent-[#4A6FA5]" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs w-44 flex-shrink-0 text-gray-700">ENVÍO AUTOMÁTICO CNBV</label>
                <input type="checkbox" checked={data.envioAutomaticoCNBV} onChange={e => update('envioAutomaticoCNBV', e.target.checked)} className="w-3.5 h-3.5 accent-[#4A6FA5]" />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3 flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#2563EB" className="mt-0.5 flex-shrink-0"><circle cx="8" cy="8" r="7" fill="none" stroke="#2563EB" strokeWidth="1.5"/><path d="M8 5v1M8 8v3" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <p className="text-[10px] text-blue-700">Los parámetros PLD son críticos para el cumplimiento regulatorio. Cualquier modificación debe ser autorizada por el Oficial de Cumplimiento y documentada según los lineamientos de la CNBV.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
