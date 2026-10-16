/**
 * CondicionesTarjetaTab — Acordeón "Condiciones de la Tarjeta".
 *
 * Condiciones con las que se origina ESTA tarjeta. Los parámetros de corte y de
 * pago mínimo nacen del subtab "Reglas de Pago y Corte TDC" del producto
 * (J_PRODUCTOS.data → reglasPagoCorteTDC): al seleccionar el producto se
 * precargan una sola vez sobre los campos aún vacíos, y desde ahí el analista
 * puede ajustarlos para el caso concreto sin tocar la configuración del producto.
 *
 * "Regla de pago y corte" NO se teclea: es un combo con los métodos de cálculo
 * que el producto tiene configurados en ese subtab (pago mínimo y pago para no
 * generar intereses). La clave y versión de la regla se muestran al pie como
 * trazabilidad de con qué versión se originó.
 *
 * Persiste en el subtab 'condicionesTarjeta', que SolicitudCreditoForm recoge en
 * `_allSubtabs` al guardar.
 */
import { useState, useEffect, useRef } from 'react';
import { saveToSession, loadFromSession, loadFromSavedStore, parseCurrency, CAT_MONEDA } from '../solicitudCreditoStore';

export interface CondicionesTarjeta {
  limiteAutorizado: string;
  moneda: string;
  tasaOrdinariaAnual: string;
  tasaMoratoriaAnual: string;
  diaCorte: string;
  diasParaPago: string;
  pagoMinimoMetodo: string;
  pagoMinimoPorcentaje: string;
  pagoMinimoMonto: string;
  reglaPagoCorte: string;
  reglaPrelacion: string;
}

const EMPTY: CondicionesTarjeta = {
  limiteAutorizado: '',
  moneda: 'MXN',
  tasaOrdinariaAnual: '',
  tasaMoratoriaAnual: '',
  diaCorte: '',
  diasParaPago: '',
  pagoMinimoMetodo: '',
  pagoMinimoPorcentaje: '',
  pagoMinimoMonto: '',
  reglaPagoCorte: '',
  reglaPrelacion: '',
};

/** Mismo catálogo que el subtab Reglas de Pago y Corte TDC del producto. */
const CAT_METODO_PAGO_MINIMO = [
  '% + mínimo fijo',
  '% del saldo al corte',
  'Monto fijo',
  'El mayor entre % y monto fijo',
];

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  /** Nodo `reglasPagoCorteTDC` del producto seleccionado, si lo tiene configurado. */
  reglaTDC?: Record<string, any>;
  /** % de interés moratorio configurado en el producto — alimenta Tasa moratoria anual. */
  tasaMoratoriaProducto?: string;
}

export function CondicionesTarjetaTab({ mode, solicitudId, reglaTDC, tasaMoratoriaProducto }: Props) {
  const isRO = mode === 'ver';
  const [data, setData] = useState<CondicionesTarjeta>(EMPTY);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;
    const stored =
      loadFromSession<CondicionesTarjeta>(solicitudId, 'condicionesTarjeta') ??
      loadFromSavedStore<CondicionesTarjeta>(solicitudId, 'condicionesTarjeta');
    setData(stored ? { ...EMPTY, ...stored } : EMPTY);
    loadedRef.current = true;
  }, [solicitudId]);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveToSession(solicitudId, 'condicionesTarjeta', data);
  }, [data, solicitudId]);

  // ── Precarga desde la regla del producto ──
  // Una sola vez por regla y solo sobre campos vacíos: nunca pisa lo capturado.
  const precargadoRef = useRef('');
  useEffect(() => {
    if (isRO || !reglaTDC || !loadedRef.current) return;
    const firma = `${solicitudId}|${reglaTDC.claveRegla || ''}|${reglaTDC.version || ''}`;
    if (precargadoRef.current === firma) return;
    precargadoRef.current = firma;

    setData(prev => {
      const next = { ...prev };
      const poner = (campo: keyof CondicionesTarjeta, valor: any) => {
        if (valor === undefined || valor === null || valor === '') return;
        if ((next[campo] || '').trim() !== '') return;
        next[campo] = String(valor);
      };

      poner('diaCorte', reglaTDC.diaCorte);
      poner('diasParaPago', reglaTDC.diasFechaLimitePago);
      poner('pagoMinimoMetodo', reglaTDC.pagoMinimoMetodo);
      poner('pagoMinimoPorcentaje', reglaTDC.pagoMinimoPorcentajeBase);
      poner('pagoMinimoMonto', reglaTDC.pagoMinimoMontoAbsoluto);
      // "Regla de pago y corte" es el método de cálculo configurado en el
      // producto (subtab Reglas de Pago y Corte TDC), no un texto libre.
      poner('reglaPagoCorte', reglaTDC.pagoMinimoMetodo);
      poner('reglaPrelacion', reglaTDC.reglaPrelacion);
      return next;
    });
    // Este efecto se declara DESPUÉS del de carga, así que en el mismo commit
    // loadedRef ya es true y la precarga ve lo que vino de sesión/BD.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reglaTDC, isRO, solicitudId]);

  // ── Valores que manda Términos y Condiciones ──
  // Límite autorizado y Tasa ordinaria NO se capturan aquí: son el Monto
  // Autorizado y la Tasa que el analista pactó en Términos. Capturarlos por
  // separado permitiría que la tarjeta se originara con condiciones distintas
  // a las pactadas. Se leen de la misma sesión, así que reflejan lo último
  // capturado cada vez que se abre el acordeón.
  const terminos: any =
    loadFromSession<any>(solicitudId, 'terminos') ??
    loadFromSavedStore<any>(solicitudId, 'terminos') ??
    {};

  const limiteDeTerminos = String(terminos.montoAutorizado || terminos.montoSolicitado || '');
  const tasaDeTerminos = String(terminos.tasa || '');
  const tasaMoratoria = String(tasaMoratoriaProducto || '');

  // El registro guardado conserva su propia copia: si mañana cambian los
  // Términos, la tarjeta ya originada no se altera sola.
  useEffect(() => {
    if (isRO || !loadedRef.current) return;
    setData(prev => {
      const next = { ...prev };
      let cambio = false;
      if (limiteDeTerminos && next.limiteAutorizado !== limiteDeTerminos) { next.limiteAutorizado = limiteDeTerminos; cambio = true; }
      if (tasaDeTerminos && next.tasaOrdinariaAnual !== tasaDeTerminos) { next.tasaOrdinariaAnual = tasaDeTerminos; cambio = true; }
      if (tasaMoratoria && next.tasaMoratoriaAnual !== tasaMoratoria) { next.tasaMoratoriaAnual = tasaMoratoria; cambio = true; }
      return cambio ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limiteDeTerminos, tasaDeTerminos, tasaMoratoria, isRO]);

  // ── Métodos de cálculo configurados en el producto ──
  // El combo "Regla de pago y corte" sólo ofrece lo que el producto tiene
  // configurado en su subtab "Reglas de Pago y Corte TDC": no se teclea a mano.
  const metodosDelProducto: { value: string; grupo: string }[] = [];
  if (reglaTDC?.pagoMinimoMetodo) {
    metodosDelProducto.push({ value: String(reglaTDC.pagoMinimoMetodo), grupo: 'Pago mínimo' });
  }
  if (
    reglaTDC?.pagoNoInteresesMetodo &&
    reglaTDC.pagoNoInteresesMetodo !== reglaTDC.pagoMinimoMetodo
  ) {
    metodosDelProducto.push({
      value: String(reglaTDC.pagoNoInteresesMetodo),
      grupo: 'Pago para no generar intereses',
    });
  }

  /** Identidad de la regla vigente del producto — se muestra como trazabilidad. */
  const identidadRegla = reglaTDC?.claveRegla
    ? (reglaTDC.version ? `${reglaTDC.claveRegla} v${reglaTDC.version}` : String(reglaTDC.claveRegla))
    : '';

  const set = (f: keyof CondicionesTarjeta, v: string) => {
    if (isRO) return;
    setData(prev => ({ ...prev, [f]: v }));
  };
  const setNum = (f: keyof CondicionesTarjeta, v: string) => set(f, v.replace(/[^0-9.,-]/g, ''));
  const setEntero = (f: keyof CondicionesTarjeta, v: string) => set(f, v.replace(/[^0-9]/g, ''));
  const curBlur = (f: keyof CondicionesTarjeta) => {
    const raw = data[f] || '';
    if (raw.trim() === '') return;
    const n = parseFloat(parseCurrency(raw));
    if (!isNaN(n) && n >= 0) set(f, n.toFixed(2));
  };
  const pctBlur = (f: keyof CondicionesTarjeta) => {
    const raw = data[f] || '';
    if (raw.trim() === '') return;
    const n = parseFloat(raw.replace(/[^0-9.-]/g, ''));
    if (!isNaN(n)) set(f, Math.min(100, Math.max(0, n)).toFixed(2));
  };

  const inputClass = `w-full px-2 py-1 text-xs border rounded focus:outline-none border-gray-300 ${
    isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-[#4A6FA5]'
  }`;
  const labelClass = 'block text-xs mb-1 text-gray-700';
  /** Campo que viene de otra pantalla: se muestra, no se teclea. */
  const heredadoClass = 'w-full px-2 py-1 text-xs bg-[#EEF3FA] border border-gray-200 rounded text-gray-800 font-medium';

  const campoMoneda = (label: string, field: keyof CondicionesTarjeta) => (
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

  const campoPorcentaje = (label: string, field: keyof CondicionesTarjeta) => (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <input
          type="text"
          value={data[field]}
          onChange={e => setNum(field, e.target.value)}
          onBlur={() => pctBlur(field)}
          disabled={isRO}
          placeholder="0.00"
          className={`${inputClass} pr-6`}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">%</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 p-4 space-y-4">
      <div className="section-header-theme px-4 py-2 flex items-center justify-between rounded-t">
        <span className="text-xs font-semibold tracking-wide uppercase">Condiciones de la Tarjeta</span>
        {reglaTDC && (
          <span className="text-[10px] text-white/80">Precargadas desde la regla del producto</span>
        )}
      </div>

      {/* ── Límite y tasas — heredados, no se capturan aquí ── */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <label className={labelClass}>Límite autorizado</label>
          <div className={heredadoClass}>
            {limiteDeTerminos ? `$${Number(String(limiteDeTerminos).replace(/[,$\s]/g, '')).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          </div>
          <span className="text-[10px] text-gray-500 italic">Monto Autorizado de Términos y Condiciones</span>
        </div>

        <div>
          <label className={labelClass}>Moneda</label>
          <select
            value={data.moneda}
            onChange={e => set('moneda', e.target.value)}
            disabled={isRO}
            className={inputClass}
          >
            {CAT_MONEDA.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div />

        <div>
          <label className={labelClass}>Tasa ordinaria anual</label>
          <div className={heredadoClass}>{tasaDeTerminos ? `${tasaDeTerminos} %` : '—'}</div>
          <span className="text-[10px] text-gray-500 italic">Tasa (%) de Términos y Condiciones</span>
        </div>

        <div>
          <label className={labelClass}>Tasa moratoria anual</label>
          <div className={heredadoClass}>{tasaMoratoria ? `${tasaMoratoria} %` : '—'}</div>
          <span className="text-[10px] text-gray-500 italic">
            {tasaMoratoria ? 'Interés moratorio del producto' : 'El producto no tiene interés moratorio configurado'}
          </span>
        </div>
        <div />
      </div>

      {/* ── Ciclo de corte ── */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <label className={labelClass}>Día de corte</label>
          <input
            type="text"
            value={data.diaCorte}
            onChange={e => setEntero('diaCorte', e.target.value)}
            onBlur={() => {
              const n = parseInt(data.diaCorte, 10);
              if (!isNaN(n)) set('diaCorte', String(Math.min(31, Math.max(1, n))));
            }}
            disabled={isRO}
            placeholder="1 - 31"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Días para pago</label>
          <input
            type="text"
            value={data.diasParaPago}
            onChange={e => setEntero('diasParaPago', e.target.value)}
            disabled={isRO}
            placeholder="0"
            className={inputClass}
          />
          <span className="text-[10px] text-gray-500 italic">
            Días entre el corte y la fecha límite de pago
          </span>
        </div>
        <div />
      </div>

      {/* ── Pago mínimo ── */}
      <div>
        <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
          <span className="text-xs font-medium text-gray-800">PAGO MÍNIMO</span>
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-3">
          <div>
            <label className={labelClass}>Método</label>
            <select
              value={data.pagoMinimoMetodo}
              onChange={e => set('pagoMinimoMetodo', e.target.value)}
              disabled={isRO}
              className={inputClass}
            >
              <option value="">Seleccionar...</option>
              {CAT_METODO_PAGO_MINIMO.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          {campoPorcentaje('Porcentaje', 'pagoMinimoPorcentaje')}
          {campoMoneda('Monto mínimo', 'pagoMinimoMonto')}
        </div>
      </div>

      {/* ── Trazabilidad de reglas ── */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <label className={labelClass}>Regla de pago y corte</label>
          {metodosDelProducto.length > 0 ? (
            <select
              value={data.reglaPagoCorte}
              onChange={e => set('reglaPagoCorte', e.target.value)}
              disabled={isRO}
              className={inputClass}
            >
              <option value="">Seleccionar...</option>
              {metodosDelProducto.map(m => (
                <option key={m.value} value={m.value}>{m.grupo} — {m.value}</option>
              ))}
              {/* Un método guardado que el producto ya no tiene configurado no debe perderse */}
              {data.reglaPagoCorte && !metodosDelProducto.some(m => m.value === data.reglaPagoCorte) && (
                <option value={data.reglaPagoCorte}>{data.reglaPagoCorte}</option>
              )}
            </select>
          ) : (
            <input
              type="text"
              value={data.reglaPagoCorte}
              onChange={e => set('reglaPagoCorte', e.target.value)}
              disabled={isRO}
              placeholder="Sin método configurado en el producto"
              className={inputClass}
            />
          )}
          <span className="text-[10px] text-gray-500 italic">
            {metodosDelProducto.length > 0
              ? `Métodos de cálculo del producto${identidadRegla ? ` · ${identidadRegla}` : ''}`
              : 'El producto no tiene métodos de cálculo configurados'}
          </span>
        </div>

        <div>
          <label className={labelClass}>Regla de prelación</label>
          <input
            type="text"
            value={data.reglaPrelacion}
            onChange={e => set('reglaPrelacion', e.target.value.toUpperCase())}
            disabled={isRO}
            placeholder="TC-PREL-001 v1.0"
            className={inputClass}
          />
        </div>
        <div />
      </div>

      {!reglaTDC && (
        <p className="text-[10px] text-gray-500 italic">
          El producto seleccionado no tiene configurado el subtab “Reglas de Pago y Corte TDC”;
          las condiciones se capturan manualmente.
        </p>
      )}
    </div>
  );
}
