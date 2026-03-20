import { useState, useEffect } from 'react';
import { saveToSession, loadFromSession, loadFromSavedStore, MOCK_FORMS } from './solicitudCreditoStore';

interface Props { mode: 'nuevo' | 'editar' | 'ver'; solicitudId: number | string | 'new'; }

interface TasasData { tasaMinima: string; tasaAutorizada: string; tasaMaxima: string; }

const EMPTY: TasasData = { tasaMinima: '8.5000', tasaAutorizada: '', tasaMaxima: '24.0000' };

export function TasasTab({ mode, solicitudId }: Props) {
  const getInit = (): TasasData => {
    const s = loadFromSession<TasasData>(solicitudId, 'tasas');
    if (s) return s;
    if (mode === 'nuevo') return { ...EMPTY };
    const saved = loadFromSavedStore<TasasData>(solicitudId, 'tasas');
    if (saved) return saved;
    const mock = MOCK_FORMS[solicitudId as number] as any;
    if (mock) {
      return {
        tasaMinima: mock.tasaMinima,
        tasaAutorizada: mock.tasaAutorizadaTasas,
        tasaMaxima: mock.tasaMaxima,
      };
    }
    return { ...EMPTY };
  };

  const [data, setData] = useState<TasasData>(getInit);
  const isRO = mode === 'ver';

  useEffect(() => { if (mode !== 'ver') saveToSession(solicitudId, 'tasas', data); }, [data, solicitudId, mode]);

  const handleTasaChange = (v: string) => {
    if (!isRO) setData(p => ({ ...p, tasaAutorizada: v.replace(/[^0-9.]/g, '') }));
  };

  const handleTasaBlur = () => {
    const num = parseFloat(data.tasaAutorizada);
    if (!isNaN(num)) setData(p => ({ ...p, tasaAutorizada: Math.min(100, Math.max(0, num)).toFixed(4) }));
  };

  // ── Validación de rango ──
  const tasaVal = parseFloat(data.tasaAutorizada || '0');
  const tasaMin = parseFloat(data.tasaMinima || '0');
  const tasaMax = parseFloat(data.tasaMaxima || '100');
  const tasaInRange = !data.tasaAutorizada || (tasaVal >= tasaMin && tasaVal <= tasaMax);

  const ic = (disabled = false, outOfRange = false) => {
    const base = 'w-full px-2 py-1 text-xs border rounded focus:outline-none';
    const border = outOfRange ? 'border-orange-400' : 'border-gray-300';
    return `${base} ${border} ${disabled || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-[#4A6FA5]'}`;
  };

  return (
    <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50">
      <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5 mb-4">
        <span className="text-xs text-gray-800">TASAS DE INTERÉS</span>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-700 mb-1">TASA MÍNIMA (%)</label>
            <div className="flex items-center gap-2">
              <input type="text" value={data.tasaMinima} disabled className={ic(true)} />
              <span className="text-[10px] text-gray-500">% anual</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">TASA AUTORIZADA (%) <span className="text-red-600">*</span></label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={data.tasaAutorizada}
                onChange={e => handleTasaChange(e.target.value)}
                onBlur={handleTasaBlur}
                disabled={isRO}
                placeholder="0.0000"
                className={ic(false, !tasaInRange)}
              />
              <span className="text-[10px] text-gray-500">% anual</span>
            </div>
            {!tasaInRange && (
              <span className="text-[10px] text-orange-600 mt-0.5 block">
                Fuera de rango ({tasaMin.toFixed(4)}% — {tasaMax.toFixed(4)}%)
              </span>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">TASA MÁXIMA (%)</label>
            <div className="flex items-center gap-2">
              <input type="text" value={data.tasaMaxima} disabled className={ic(true)} />
              <span className="text-[10px] text-gray-500">% anual</span>
            </div>
          </div>

          {/* Barra visual de rango */}
          {data.tasaAutorizada && (
            <div className="px-1">
              <div className="h-2 bg-gray-200 rounded-full relative">
                <div
                  className={`h-2 rounded-full ${tasaInRange ? 'bg-green-500' : 'bg-orange-400'}`}
                  style={{ width: `${Math.min(100, Math.max(5, ((tasaVal - tasaMin) / (tasaMax - tasaMin)) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>{tasaMin.toFixed(2)}%</span>
                <span className={tasaInRange ? 'text-green-600' : 'text-orange-600'}>{tasaVal.toFixed(4)}%</span>
                <span>{tasaMax.toFixed(2)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Panel informativo */}
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded p-3">
            <span className="text-[10px] text-gray-500 block mb-2">RESUMEN DE TASA</span>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Rango permitido:</span>
                <span className="text-gray-800">{tasaMin.toFixed(2)}% — {tasaMax.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Spread (máx - mín):</span>
                <span className="text-gray-800">{(tasaMax - tasaMin).toFixed(2)} pp</span>
              </div>
              {data.tasaAutorizada && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Tasa autorizada:</span>
                    <span className={`${tasaInRange ? 'text-green-700' : 'text-orange-600'}`}>
                      {tasaVal.toFixed(4)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Tasa periódica (mensual):</span>
                    <span className="text-gray-800">{(tasaVal / 12).toFixed(4)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Estatus:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${tasaInRange ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {tasaInRange ? 'Dentro del rango' : 'Fuera del rango'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}