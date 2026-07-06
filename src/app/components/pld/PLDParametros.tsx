import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as store from './pldStore';

interface Props { onBack?: () => void; }

export function PLDParametros({ onBack }: Props) {
  const [data, setData] = useState(store.getParametros);

  useEffect(() => { store.saveParametros(data); }, [data]);

  const update = (field: keyof store.ParametrosPLD, value: any) => setData(d => ({ ...d, [field]: value }));

  const handleSave = () => {
    store.saveParametros(data);
    toast.success('Parámetros guardados', { description: 'Configuración PLD actualizada.' });
    onBack?.();
  };

  const labelCls = 'text-xs w-52 flex-shrink-0 text-gray-700';
  const inputCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white';

  return (
    <div className="bg-white min-h-full">

      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            <h2 className="text-lg text-gray-800">Parámetros PLD</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white text-sm rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}>Guardar</button>
            <button onClick={onBack} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-sm rounded hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Parámetros institucionales */}
        <div className="border border-gray-300">
          <div style={{ backgroundColor: '#D0D0D0' }} className="px-3 py-2 border-b border-gray-300">
            <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>PARÁMETROS INSTITUCIONALES PLD</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2.5">
            <div className="flex items-center gap-2"><label className={labelCls}>FACTOR RIESGO</label><input type="text" value={data.factorRiesgo} onChange={e => update('factorRiesgo', e.target.value)} className={inputCls} /></div>
            <div className="flex items-center gap-2"><label className={labelCls}>MONTO MÁX. OPERACIÓN USD</label><input type="text" value={data.montoMaxOperacionUSD} onChange={e => update('montoMaxOperacionUSD', e.target.value)} className={inputCls} /></div>
            <div className="flex items-center gap-2"><label className={labelCls}>MONTO MÁX. PERSONA FÍSICA</label><input type="text" value={data.montoMaxPersonaFisica} onChange={e => update('montoMaxPersonaFisica', e.target.value)} className={inputCls} /></div>
            <div className="flex items-center gap-2"><label className={labelCls}>MONTO MÁX. PERSONA MORAL</label><input type="text" value={data.montoMaxPersonaMoral} onChange={e => update('montoMaxPersonaMoral', e.target.value)} className={inputCls} /></div>
            <div className="flex items-center gap-2"><label className={labelCls}>APLICA PERSONA FÍSICA</label>
              <select value={data.aplicaPersonaFisica} onChange={e => update('aplicaPersonaFisica', e.target.value)} className={inputCls}>
                <option>Sí</option><option>No</option>
              </select>
            </div>
            <div className="flex items-center gap-2"><label className={labelCls}>APLICA PERSONA MORAL</label>
              <select value={data.aplicaPersonaMoral} onChange={e => update('aplicaPersonaMoral', e.target.value)} className={inputCls}>
                <option>Sí</option><option>No</option>
              </select>
            </div>
            <div className="flex items-center gap-2"><label className={labelCls}>SUJETO OBLIGADO</label><input type="text" value={data.sujetoObligado} onChange={e => update('sujetoObligado', e.target.value)} className={inputCls} /></div>
            <div className="flex items-center gap-2"><label className={labelCls}>ÓRGANO SUPERVISOR</label><input type="text" value={data.organoSupervisor} onChange={e => update('organoSupervisor', e.target.value)} className={inputCls} /></div>
          </div>
        </div>

        {/* Alertas automáticas */}
        <div className="border border-gray-300">
          <div style={{ backgroundColor: '#D0D0D0' }} className="px-3 py-2 border-b border-gray-300">
            <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>PARÁMETROS DE ALERTAS AUTOMÁTICAS</span>
          </div>
          <div className="p-4 grid grid-cols-3 gap-x-8 gap-y-2.5">
            <div className="flex items-center gap-2">
              <label className="text-xs w-44 flex-shrink-0 text-gray-700">DÍAS ACTUALIZACIÓN KYC</label>
              <input type="text" value={data.diasActualizacionKYC} onChange={e => update('diasActualizacionKYC', e.target.value.replace(/\D/g,''))} className={inputCls} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-44 flex-shrink-0 text-gray-700">% DESVIACIÓN ALERTA</label>
              <input type="text" value={data.porcentajeDesviacion} onChange={e => update('porcentajeDesviacion', e.target.value.replace(/\D/g,''))} className={inputCls} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-44 flex-shrink-0 text-gray-700">DÍAS RETENCIÓN DOCS</label>
              <input type="text" value={data.diasRetencion} onChange={e => update('diasRetencion', e.target.value.replace(/\D/g,''))} className={inputCls} />
            </div>
          </div>
          <div className="px-4 pb-4 grid grid-cols-2 gap-x-8 gap-y-2.5">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-700 flex-1">ALERTAS AUTOMÁTICAS</label>
              <input type="checkbox" checked={data.alertasAutomaticas} onChange={e => update('alertasAutomaticas', e.target.checked)} className="w-3.5 h-3.5 accent-[#4A6FA5]" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-700 flex-1">ENVÍO AUTOMÁTICO CNBV</label>
              <input type="checkbox" checked={data.envioAutomaticoCNBV} onChange={e => update('envioAutomaticoCNBV', e.target.checked)} className="w-3.5 h-3.5 accent-[#4A6FA5]" />
            </div>
          </div>
        </div>

        {/* Nota informativa */}
        <div className="border border-blue-200 bg-blue-50 px-4 py-3 rounded flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#1D4ED8" strokeWidth="1.5" className="mt-0.5 flex-shrink-0"><circle cx="8" cy="8" r="6"/><path d="M8 5v1M8 8v3" strokeLinecap="round"/></svg>
          <p className="text-xs text-blue-800">Los parámetros PLD son críticos para el cumplimiento regulatorio. Cualquier modificación debe ser autorizada por el Oficial de Cumplimiento y documentada según los lineamientos de la CNBV.</p>
        </div>
      </div>
    </div>
  );
}
