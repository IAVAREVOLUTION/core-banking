import { useState, useEffect } from 'react';
import {
  saveToSession, loadFromSession, loadFromSavedStore, MOCK_FORMS,
  CAT_MONEDA, CAT_ESTATUS_SC, CAT_ESTATUS_LISTA_NEGRA, CAT_ESTATUS_CLIENTE,
} from './solicitudCreditoStore';

interface Props { mode: 'nuevo' | 'editar' | 'ver'; solicitudId: number | string | 'new'; }

interface DefaultData {
  estatusSC: string; direccionPrincipal: string; estatusListaNegra: string;
  estatusCliente: string; moneda: string;
}

const EMPTY: DefaultData = { estatusSC: '', direccionPrincipal: '', estatusListaNegra: 'POSITIVO', estatusCliente: '', moneda: 'MXN' };

export function DefaultTab({ mode, solicitudId }: Props) {
  const getInit = (): DefaultData => {
    const s = loadFromSession<DefaultData>(solicitudId, 'default');
    if (s) return s;
    if (mode === 'nuevo') return { ...EMPTY };
    const saved = loadFromSavedStore<DefaultData>(solicitudId, 'default');
    if (saved) return saved;
    const mock = MOCK_FORMS[solicitudId as number] as any;
    if (mock) {
      return {
        estatusSC: mock.estatusSC,
        direccionPrincipal: mock.direccionPrincipal,
        estatusListaNegra: mock.estatusListaNegra,
        estatusCliente: mock.estatusCliente,
        moneda: mock.moneda,
      };
    }
    return { ...EMPTY };
  };

  const [data, setData] = useState<DefaultData>(getInit);
  const isRO = mode === 'ver';

  useEffect(() => { if (mode !== 'ver') saveToSession(solicitudId, 'default', data); }, [data, solicitudId, mode]);

  const set = (f: keyof DefaultData, v: string) => { if (!isRO) setData(p => ({ ...p, [f]: v })); };

  const ic = (disabled = false) => `w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none ${disabled || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-[#4A6FA5]'}`;

  // Color indicator for lista negra
  const listaNegraBadge = () => {
    if (data.estatusListaNegra === 'POSITIVO') return 'bg-green-100 text-green-800 border-green-300';
    if (data.estatusListaNegra === 'NEGATIVO') return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  };

  return (
    <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50">
      <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5 mb-4">
        <span className="text-xs text-gray-800">DATOS DEL CLIENTE</span>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        {/* Estatus S.C. — Select institucional */}
        <div>
          <label className="block text-xs text-gray-700 mb-1">ESTATUS S.C <span className="text-red-600">*</span></label>
          <select value={data.estatusSC} onChange={e => set('estatusSC', e.target.value)} disabled={isRO} className={ic()}>
            <option value="">Seleccionar...</option>
            {CAT_ESTATUS_SC.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Dirección Principal */}
        <div className="row-span-3">
          <label className="block text-xs text-gray-700 mb-1">DIRECCIÓN PRINCIPAL</label>
          <textarea value={data.direccionPrincipal} onChange={e => set('direccionPrincipal', e.target.value)} disabled={isRO} className={`${ic()} resize-none`} rows={5} maxLength={500} placeholder="Calle, número, colonia, CP, ciudad, estado..." />
          <span className="text-[10px] text-gray-400 mt-0.5 block text-right">{data.direccionPrincipal.length}/500</span>
        </div>

        {/* Estatus Lista Negra — Select con badge de color */}
        <div>
          <label className="block text-xs text-gray-700 mb-1">ESTATUS LISTA NEGRA</label>
          <div className="flex items-center gap-2">
            <select value={data.estatusListaNegra} onChange={e => set('estatusListaNegra', e.target.value)} disabled={isRO} className={`flex-1 ${ic()}`}>
              {CAT_ESTATUS_LISTA_NEGRA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <span className={`px-2 py-0.5 text-[10px] rounded border whitespace-nowrap ${listaNegraBadge()}`}>
              {data.estatusListaNegra === 'POSITIVO' ? '✓ OK' : data.estatusListaNegra === 'NEGATIVO' ? '✗ ALERTA' : '⟳ REV.'}
            </span>
          </div>
        </div>

        {/* Estatus del Cliente — Select institucional */}
        <div>
          <label className="block text-xs text-gray-700 mb-1">ESTATUS DEL CLIENTE <span className="text-red-600">*</span></label>
          <select value={data.estatusCliente} onChange={e => set('estatusCliente', e.target.value)} disabled={isRO} className={ic()}>
            <option value="">Seleccionar...</option>
            {CAT_ESTATUS_CLIENTE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Moneda — ya era select, OK */}
        <div>
          <label className="block text-xs text-gray-700 mb-1">MONEDA <span className="text-red-600">*</span></label>
          <select value={data.moneda} onChange={e => set('moneda', e.target.value)} disabled={isRO} className={ic()}>
            {CAT_MONEDA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}