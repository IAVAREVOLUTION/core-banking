import { useState, useEffect } from 'react';
import { saveToSession, loadFromSession, loadFromSavedStore, MOCK_FORMS, parseCurrency } from './solicitudCreditoStore';

interface Props { mode: 'nuevo' | 'editar' | 'ver'; solicitudId: number | string | 'new'; }

interface MontosData {
  plazoMinimo: string; plazoAutorizado: string; plazoMaximo: string;
  montoMinimo: string; montoAutorizado: string; montoMaximo: string;
}

const EMPTY: MontosData = { plazoMinimo: '12.00', plazoAutorizado: '', plazoMaximo: '60.00', montoMinimo: '50,000.00', montoAutorizado: '', montoMaximo: '500,000.00' };

export function MontosPlazosTab({ mode, solicitudId }: Props) {
  const getInit = (): MontosData => {
    const s = loadFromSession<MontosData>(solicitudId, 'montos');
    if (s) return s;
    if (mode === 'nuevo') return { ...EMPTY };
    const saved = loadFromSavedStore<MontosData>(solicitudId, 'montos');
    if (saved) return saved;
    const mock = MOCK_FORMS[solicitudId as number] as any;
    if (mock) {
      return {
        plazoMinimo: mock.plazoMinimo,
        plazoAutorizado: mock.plazoAutorizadoMontos,
        plazoMaximo: mock.plazoMaximo,
        montoMinimo: mock.montoMinimo,
        montoAutorizado: mock.montoAutorizadoMontos,
        montoMaximo: mock.montoMaximo,
      };
    }
    return { ...EMPTY };
  };

  const [data, setData] = useState<MontosData>(getInit);
  const isRO = mode === 'ver';

  useEffect(() => { if (mode !== 'ver') saveToSession(solicitudId, 'montos', data); }, [data, solicitudId, mode]);

  const set = (f: keyof MontosData, v: string) => { if (!isRO) setData(p => ({ ...p, [f]: v })); };

  // ── Validación de rangos ──
  const plazoVal = parseFloat(data.plazoAutorizado || '0');
  const plazoMin = parseFloat(data.plazoMinimo || '0');
  const plazoMax = parseFloat(data.plazoMaximo || '999');
  const plazoInRange = !data.plazoAutorizado || (plazoVal >= plazoMin && plazoVal <= plazoMax);

  const montoVal = parseFloat(parseCurrency(data.montoAutorizado || '0'));
  const montoMin = parseFloat(parseCurrency(data.montoMinimo || '0'));
  const montoMax = parseFloat(parseCurrency(data.montoMaximo || '999999999'));
  const montoInRange = !data.montoAutorizado || (montoVal >= montoMin && montoVal <= montoMax);

  const ic = (disabled = false, outOfRange = false) => {
    const base = 'w-full px-2 py-1 text-xs border rounded focus:outline-none';
    const border = outOfRange ? 'border-orange-400' : 'border-gray-300';
    return `${base} ${border} ${disabled || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-[#4A6FA5]'}`;
  };

  const handlePlazoBlur = () => {
    const num = parseFloat(data.plazoAutorizado);
    if (!isNaN(num) && num >= 0) setData(p => ({ ...p, plazoAutorizado: num.toString() }));
  };

  const handleMontoBlur = () => {
    const raw = parseCurrency(data.montoAutorizado || '');
    const num = parseFloat(raw);
    if (!isNaN(num) && num >= 0) {
      setData(p => ({ ...p, montoAutorizado: num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
    }
  };

  return (
    <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        {/* PLAZOS */}
        <div className="space-y-4">
          <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5 mb-1">
            <span className="text-xs text-gray-800">PLAZOS</span>
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">PLAZO MÍNIMO</label>
            <div className="flex items-center gap-2">
              <input type="text" value={data.plazoMinimo} disabled className={ic(true)} />
              <span className="text-[10px] text-gray-500 whitespace-nowrap">meses</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">PLAZO AUTORIZADO <span className="text-red-600">*</span></label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={data.plazoAutorizado}
                onChange={e => set('plazoAutorizado', e.target.value.replace(/[^0-9.]/g, ''))}
                onBlur={handlePlazoBlur}
                disabled={isRO}
                placeholder="0"
                className={ic(false, !plazoInRange)}
              />
              <span className="text-[10px] text-gray-500 whitespace-nowrap">meses</span>
            </div>
            {!plazoInRange && (
              <span className="text-[10px] text-orange-600 mt-0.5 block">
                Fuera de rango ({plazoMin} — {plazoMax} meses)
              </span>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">PLAZO MÁXIMO</label>
            <div className="flex items-center gap-2">
              <input type="text" value={data.plazoMaximo} disabled className={ic(true)} />
              <span className="text-[10px] text-gray-500 whitespace-nowrap">meses</span>
            </div>
          </div>

          {/* Barra visual de rango */}
          {data.plazoAutorizado && (
            <div className="px-1">
              <div className="h-2 bg-gray-200 rounded-full relative">
                <div
                  className={`h-2 rounded-full ${plazoInRange ? 'bg-green-500' : 'bg-orange-400'}`}
                  style={{ width: `${Math.min(100, Math.max(5, ((plazoVal - plazoMin) / (plazoMax - plazoMin)) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>{plazoMin}</span>
                <span className={plazoInRange ? 'text-green-600' : 'text-orange-600'}>{plazoVal}</span>
                <span>{plazoMax}</span>
              </div>
            </div>
          )}
        </div>

        {/* MONTOS */}
        <div className="space-y-4">
          <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5 mb-1">
            <span className="text-xs text-gray-800">MONTOS</span>
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">MONTO MÍNIMO</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span>
              <input type="text" value={data.montoMinimo} disabled className={`${ic(true)} pl-5`} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">MONTO AUTORIZADO <span className="text-red-600">*</span></label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span>
              <input
                type="text"
                value={data.montoAutorizado}
                onChange={e => set('montoAutorizado', e.target.value.replace(/[^0-9.,-]/g, ''))}
                onBlur={handleMontoBlur}
                disabled={isRO}
                placeholder="0.00"
                className={`${ic(false, !montoInRange)} pl-5`}
              />
            </div>
            {!montoInRange && (
              <span className="text-[10px] text-orange-600 mt-0.5 block">
                Fuera de rango (${ montoMin.toLocaleString('es-MX') } — ${ montoMax.toLocaleString('es-MX') })
              </span>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">MONTO MÁXIMO</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span>
              <input type="text" value={data.montoMaximo} disabled className={`${ic(true)} pl-5`} />
            </div>
          </div>

          {/* Barra visual de rango */}
          {data.montoAutorizado && (
            <div className="px-1">
              <div className="h-2 bg-gray-200 rounded-full relative">
                <div
                  className={`h-2 rounded-full ${montoInRange ? 'bg-green-500' : 'bg-orange-400'}`}
                  style={{ width: `${Math.min(100, Math.max(5, ((montoVal - montoMin) / (montoMax - montoMin)) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>${montoMin.toLocaleString('es-MX')}</span>
                <span className={montoInRange ? 'text-green-600' : 'text-orange-600'}>${montoVal.toLocaleString('es-MX')}</span>
                <span>${montoMax.toLocaleString('es-MX')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}