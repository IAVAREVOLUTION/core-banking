/**
 * DatosFinancierosTab — Acordeón "Datos Financieros".
 *
 * Captura la situación financiera del solicitante y deriva su capacidad de pago.
 * Se usa desde SolicitudCreditoForm, que es el formulario que renderizan tanto
 * Solicitudes como Originación (vía SolicitudBaseForm).
 *
 * Los tres campos calculados NO se capturan ni se guardan: se recalculan en cada
 * render a partir de lo capturado, así que no pueden quedar desfasados.
 *   Ingreso mensual total = comprobado + otros ingresos
 *   Capacidad de pago     = ingreso total − deuda mensual − gastos mensuales
 *   % Deuda / Ingreso     = deuda mensual ÷ ingreso total × 100
 *
 * Persiste en el subtab 'datosFinancieros' (sesión + store guardado), que es lo
 * que SolicitudCreditoForm recoge en `_allSubtabs` al guardar.
 */
import { useState, useEffect, useRef } from 'react';
import { saveToSession, loadFromSession, loadFromSavedStore, parseCurrency } from '../solicitudCreditoStore';

export interface DatosFinancieros {
  ingresoMensualComprobado: string;
  otrosIngresos: string;
  deudaMensualActual: string;
  gastosMensualesEstimados: string;
  antiguedadLaboralMeses: string;
  actividadEconomica: string;
}

const EMPTY: DatosFinancieros = {
  ingresoMensualComprobado: '',
  otrosIngresos: '',
  deudaMensualActual: '',
  gastosMensualesEstimados: '',
  antiguedadLaboralMeses: '',
  actividadEconomica: '',
};

const CAT_ACTIVIDAD_ECONOMICA = [
  'Empleado',
  'Independiente / Profesionista',
  'Empresario',
  'Comerciante',
  'Jubilado / Pensionado',
  'Otro',
];

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
}

/** '' y undefined no son 0: solo suma lo efectivamente capturado. */
const num = (v?: string): number => {
  const n = parseFloat(parseCurrency(v || ''));
  return isNaN(n) ? 0 : n;
};

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function DatosFinancierosTab({ mode, solicitudId }: Props) {
  const isRO = mode === 'ver';
  const [data, setData] = useState<DatosFinancieros>(EMPTY);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;
    const stored =
      loadFromSession<DatosFinancieros>(solicitudId, 'datosFinancieros') ??
      loadFromSavedStore<DatosFinancieros>(solicitudId, 'datosFinancieros');
    setData(stored ? { ...EMPTY, ...stored } : EMPTY);
    loadedRef.current = true;
  }, [solicitudId]);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveToSession(solicitudId, 'datosFinancieros', data);
  }, [data, solicitudId]);

  const set = (f: keyof DatosFinancieros, v: string) => {
    if (isRO) return;
    setData(prev => ({ ...prev, [f]: v }));
  };
  const setNum = (f: keyof DatosFinancieros, v: string) => set(f, v.replace(/[^0-9.,-]/g, ''));
  const curBlur = (f: keyof DatosFinancieros) => {
    const raw = data[f] || '';
    if (raw.trim() === '') return;
    const n = parseFloat(parseCurrency(raw));
    if (!isNaN(n) && n >= 0) set(f, n.toFixed(2));
  };

  // ── Derivados ──
  const ingresoTotal = num(data.ingresoMensualComprobado) + num(data.otrosIngresos);
  const deuda = num(data.deudaMensualActual);
  const capacidadPago = ingresoTotal - deuda - num(data.gastosMensualesEstimados);
  const pctDeudaIngreso = ingresoTotal > 0 ? (deuda / ingresoTotal) * 100 : null;

  const inputClass = `w-full px-2 py-1 text-xs border rounded focus:outline-none border-gray-300 ${
    isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-[#4A6FA5]'
  }`;
  const calcClass =
    'w-full px-2 py-1 text-xs border border-gray-200 rounded bg-[#EEF3FA] text-gray-800 font-medium';
  const labelClass = 'block text-xs mb-1 text-gray-700';

  const campoMoneda = (label: string, field: keyof DatosFinancieros) => (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span>
        <input
          type="text"
          value={data[field]}
          onChange={e => setNum(field, e.target.value)}
          onBlur={() => curBlur(field)}
          disabled={isRO}
          placeholder="0.00"
          className={`${inputClass} pl-5`}
        />
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 p-4 space-y-4">
      <div className="section-header-theme px-4 py-2 flex items-center justify-between rounded-t">
        <span className="text-xs font-semibold tracking-wide uppercase">Datos Financieros</span>
        <span className="text-[10px] text-white/80">Capacidad de pago del solicitante</span>
      </div>

      {/* ── Ingresos ── */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        {campoMoneda('Ingreso mensual comprobado', 'ingresoMensualComprobado')}
        {campoMoneda('Otros ingresos', 'otrosIngresos')}
        <div>
          <label className={labelClass}>Ingreso mensual total</label>
          <div className={calcClass}>{fmtMoney(ingresoTotal)}</div>
          <span className="text-[10px] text-gray-500 italic">Comprobado + otros ingresos</span>
        </div>
      </div>

      {/* ── Egresos ── */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        {campoMoneda('Deuda mensual actual', 'deudaMensualActual')}
        {campoMoneda('Gastos mensuales estimados', 'gastosMensualesEstimados')}
        <div />
      </div>

      {/* ── Resultado del análisis ── */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <label className={labelClass}>Capacidad de pago estimada</label>
          <div className={`${calcClass} ${capacidadPago < 0 ? 'text-red-600' : ''}`}>
            {fmtMoney(capacidadPago)}
          </div>
          <span className="text-[10px] text-gray-500 italic">Ingreso total − deuda − gastos</span>
        </div>

        <div>
          <label className={labelClass}>% Deuda / Ingreso</label>
          <div className={calcClass}>
            {pctDeudaIngreso === null ? '—' : `${pctDeudaIngreso.toFixed(2)} %`}
          </div>
          <span className="text-[10px] text-gray-500 italic">
            {pctDeudaIngreso === null ? 'Requiere ingreso mensual total' : 'Deuda ÷ ingreso total'}
          </span>
        </div>
        <div />
      </div>

      {/* ── Perfil laboral ── */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <label className={labelClass}>Antigüedad laboral (meses)</label>
          <input
            type="text"
            value={data.antiguedadLaboralMeses}
            onChange={e => set('antiguedadLaboralMeses', e.target.value.replace(/[^0-9]/g, ''))}
            disabled={isRO}
            placeholder="0"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Actividad económica</label>
          <select
            value={data.actividadEconomica}
            onChange={e => set('actividadEconomica', e.target.value)}
            disabled={isRO}
            className={inputClass}
          >
            <option value="">Seleccionar...</option>
            {CAT_ACTIVIDAD_ECONOMICA.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>
        <div />
      </div>
    </div>
  );
}
