import { useState, useEffect, useRef } from 'react';
import { DatePicker } from '@/app/components/ui/DatePicker';
import {
  TerminosCondiciones, EMPTY_TERMINOS,
  saveToSession, loadFromSession, loadFromSavedStore,
  MOCK_TERMINOS, parseCurrency, CAT_FRECUENCIA, CAT_TIPO_TASA, CAT_TIPO_CALCULO, CAT_MONEDA,
} from './solicitudCreditoStore';
import type { ProductoCatalogo } from '../../hooks/useProductosCatalogoDB';

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  lineaProducto: string;
  productoSeleccionado?: ProductoCatalogo;
  /** Monto solicitado del header — se sincroniza automáticamente */
  montoSolicitadoHeader?: string;
}

/**
 * Extrae los campos de Términos y Condiciones desde el rawData del producto.
 * Busca en múltiples niveles del JSONB:
 *   - root (d.*)
 *   - d.default.* (subtab Datos Generales de Crédito/Seguros)
 *   - d.datosGenerales[0].* (legacy / Captación)
 *   - d.matrizTasaFija[0].* (tasa, plazo de la primera fila de la matriz)
 *   - d.periodos[0].* (frecuencia, plazo del primer periodo)
 */
function extractTerminosFromProduct(prod: ProductoCatalogo): Partial<TerminosCondiciones> {
  const d = prod.rawData || {};

  // Nivel 1: nodo default (ProductoForm → jCreditoData.default)
  const def = (d.default && typeof d.default === 'object' && !Array.isArray(d.default))
    ? d.default as Record<string, any>
    : null;

  // Nivel 2: legacy datosGenerales[0] (Captación / viejo formato)
  const dg = Array.isArray(d.datosGenerales) && d.datosGenerales.length > 0
    ? d.datosGenerales[0]
    : null;

  // Nivel 3: primera fila de matrizTasaFija (contiene tasa, plazo, etc.)
  const mtf = Array.isArray(d.matrizTasaFija) && d.matrizTasaFija.length > 0
    ? d.matrizTasaFija[0]
    : null;

  // Nivel 4: primer periodo (contiene frecuencia, plazo)
  const per = Array.isArray(d.periodos) && d.periodos.length > 0
    ? d.periodos[0]
    : null;

  // Helper: first truthy value from multiple keys across all sources
  const pick = (...keys: string[]): string => {
    // Search order: root → default → datosGenerales → matrizTasaFija → periodos
    const sources = [d, def, dg, mtf, per].filter(Boolean);
    for (const k of keys) {
      for (const src of sources) {
        const v = src?.[k];
        if (v !== undefined && v !== null && v !== '') return String(v);
      }
    }
    return '';
  };

  const result: Partial<TerminosCondiciones> = {};

  // Tasa — priorizar matrizTasaFija que es la fuente de verdad
  const tasa = pick('tasa', 'tasaBase', 'tasaInicial', 'tasaOrdinaria', 'tasaPorcentaje', 'tasaPorcentajeBase');
  if (tasa) {
    const num = parseFloat(tasa);
    result.tasa = !isNaN(num) ? num.toFixed(4) : tasa;
  }

  // Tipo de tasa (Fija / Variable)
  const tipoTasa = pick('tipoTasa', 'tipoTasaInteres', 'tasaTipo');
  if (tipoTasa) result.tipoTasa = tipoTasa;

  // Plazo
  const plazo = pick('plazo', 'plazoMeses', 'plazoMaximo', 'plazoMinimoDisposicion', 'numeroPagos');
  if (plazo) result.plazo = plazo;

  // Frecuencia
  const frecuencia = pick('frecuencia', 'frecuenciaPago', 'frecuenciaPagoIntereses', 'periodicidad', 'frecuenciaCapitalizacion');
  if (frecuencia) result.frecuencia = frecuencia;

  // Tipo cálculo de amortización
  const tipoCalculo = pick('calculo', 'tipoCalculo', 'tipoCalculoAmortizacion', 'metodoCalculo');
  if (tipoCalculo) result.tipoCalculo = tipoCalculo;

  // Moneda
  const moneda = pick('moneda', 'tipoMoneda');
  if (moneda) result.moneda = moneda;

  // Monto garantía
  const montoGarantia = pick('montoGarantia', 'montoMinimo');
  if (montoGarantia) {
    const num = parseFloat(montoGarantia);
    result.montoGarantia = !isNaN(num) ? num.toFixed(2) : montoGarantia;
  }

  // Base de cálculo (360/180) — mapear a tipoCalculo si no se encontró antes
  if (!result.tipoCalculo) {
    const baseCalculo = pick('baseCalculo');
    if (baseCalculo) result.tipoCalculo = baseCalculo;
  }

  return result;
}

export function TerminosCondicionesTab({ mode, solicitudId, lineaProducto, productoSeleccionado, montoSolicitadoHeader }: Props) {
  // Track which productoId was last applied to avoid re-applying
  const lastAppliedProductoId = useRef<string>('');

  const getInit = (): TerminosCondiciones => {
    const s = loadFromSession<TerminosCondiciones>(solicitudId, 'terminos');
    if (s) return s;
    if (mode === 'nuevo') return { ...EMPTY_TERMINOS };
    const saved = loadFromSavedStore<TerminosCondiciones>(solicitudId, 'terminos');
    if (saved) return saved;
    const mock = MOCK_TERMINOS[solicitudId as number];
    return mock ? { ...mock } : { ...EMPTY_TERMINOS };
  };

  const [data, setData] = useState<TerminosCondiciones>(getInit);
  const isRO = mode === 'ver';

  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, 'terminos', data);
  }, [data, solicitudId, isRO]);

  // ── Sync montoSolicitado from header → terminos ──
  useEffect(() => {
    if (isRO) return;
    if (!montoSolicitadoHeader) return;
    // Only sync if the header has a value and terminos monto is empty or different
    if (montoSolicitadoHeader !== data.montoSolicitado) {
      console.log('[TerminosTab] Sync montoSolicitado from header:', montoSolicitadoHeader);
      setData(prev => ({ ...prev, montoSolicitado: montoSolicitadoHeader }));
    }
  }, [montoSolicitadoHeader]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fill from product when it changes ──
  useEffect(() => {
    if (isRO) return;
    if (!productoSeleccionado?.id) return;
    if (productoSeleccionado.id === lastAppliedProductoId.current) return;
    if (!productoSeleccionado.rawData) return;

    const extracted = extractTerminosFromProduct(productoSeleccionado);
    const keys = Object.keys(extracted) as (keyof TerminosCondiciones)[];

    console.log('[TerminosTab] Auto-fill from product:', productoSeleccionado.nombreProducto,
      '| tipoProducto:', productoSeleccionado.tipoProducto || productoSeleccionado.sublineaProducto,
      '| fields:', keys.join(', '), '| values:', extracted,
      '| rawData keys:', Object.keys(productoSeleccionado.rawData));

    lastAppliedProductoId.current = productoSeleccionado.id;

    if (keys.length === 0) {
      console.warn('[TerminosTab] No se extrajeron campos del producto. rawData:', productoSeleccionado.rawData);
      return;
    }

    setData(prev => {
      const updated = { ...prev };
      for (const key of keys) {
        // Sobrescribir campos con valores del producto (el producto es la fuente de verdad)
        (updated as any)[key] = extracted[key];
      }
      return updated;
    });
  }, [productoSeleccionado, isRO]);

  const set = (field: keyof TerminosCondiciones, value: any) => {
    if (isRO) return;
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleNumeric = (field: keyof TerminosCondiciones, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    set(field, formatted);
  };

  const handleCurrencyBlur = (field: keyof TerminosCondiciones) => {
    const raw = parseCurrency(String(data[field]) || '');
    const num = parseFloat(raw);
    if (!isNaN(num) && num >= 0) set(field, num.toFixed(2));
  };

  const handlePercentBlur = (field: keyof TerminosCondiciones) => {
    const raw = String(data[field] || '').replace(/[^0-9.-]/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num)) set(field, Math.min(100, Math.max(0, num)).toFixed(4));
  };

  const ic = (disabled = false) => {
    const base = 'w-full px-2 py-1.5 text-xs border rounded focus:outline-none';
    const focus = !disabled && !isRO ? 'focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5]' : '';
    const bg = disabled || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800';
    return `${base} border-gray-300 ${focus} ${bg}`;
  };

  const sc = () => {
    const base = 'w-full px-2 py-1.5 text-xs border rounded focus:outline-none border-gray-300';
    const focus = !isRO ? 'focus:ring-2 focus:ring-[#4A6FA5]' : '';
    const bg = isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800';
    return `${base} ${focus} ${bg}`;
  };

  const isCaptacion = lineaProducto === 'Captación';
  const isLineaCredito = lineaProducto === 'Línea de Crédito';

  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-4">
        <p className="text-xs text-blue-800">
          <strong>Datos para simular — {lineaProducto || 'Crédito'}</strong>
          {' '}| Modifique los campos y genere la simulación en el acordeón correspondiente.
          {productoSeleccionado?.rawData && (
            <span className="ml-2 text-blue-600">
              ✓ Pre-llenado desde producto: <strong>{productoSeleccionado.nombreProducto}</strong>
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {/* Col 1 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Monto Solicitado <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
              <input
                type="text" inputMode="decimal"
                value={data.montoSolicitado}
                onChange={e => handleNumeric('montoSolicitado', e.target.value)}
                onBlur={() => handleCurrencyBlur('montoSolicitado')}
                disabled={isRO} placeholder="0.00"
                className={`${ic()} pl-5`}
              />
            </div>
          </div>

          {!isCaptacion && (
            <div>
              <label className="block text-xs text-gray-700 mb-1">Fecha Primer Pago</label>
              <DatePicker
                value={data.fechaPrimerPago}
                onChange={v => set('fechaPrimerPago', v)}
                disabled={isRO} placeholder="dd/mm/aaaa"
                className="px-2 py-1.5"
              />
            </div>
          )}

          {isCaptacion && (
            <div>
              <label className="block text-xs text-gray-700 mb-1">Fecha Primera Aportación</label>
              <DatePicker
                value={data.fechaPrimeraAportacion}
                onChange={v => set('fechaPrimeraAportacion', v)}
                disabled={isRO} placeholder="dd/mm/aaaa"
                className="px-2 py-1.5"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-700 mb-1">Plazo <span className="text-red-500">*</span></label>
            <input
              type="text" inputMode="decimal"
              value={data.plazo}
              onChange={e => handleNumeric('plazo', e.target.value)}
              disabled={isRO} placeholder="Ej: 12"
              className={ic()}
            />
          </div>
        </div>

        {/* Col 2 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Frecuencia <span className="text-red-500">*</span></label>
            <select value={data.frecuencia} onChange={e => set('frecuencia', e.target.value)} disabled={isRO} className={sc()}>
              {CAT_FRECUENCIA.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">Tasa (%) <span className="text-red-500">*</span></label>
            <input
              type="text" inputMode="decimal"
              value={data.tasa}
              onChange={e => handleNumeric('tasa', e.target.value)}
              onBlur={() => handlePercentBlur('tasa')}
              disabled={isRO} placeholder="0.0000"
              className={ic()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">Tipo de Tasa</label>
            <select value={data.tipoTasa} onChange={e => set('tipoTasa', e.target.value)} disabled={isRO} className={sc()}>
              {CAT_TIPO_TASA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Col 3 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Tipo Cálculo Amortización</label>
            <select value={data.tipoCalculo} onChange={e => set('tipoCalculo', e.target.value)} disabled={isRO} className={sc()}>
              {CAT_TIPO_CALCULO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-700 mb-1">Moneda</label>
            <select value={data.moneda} onChange={e => set('moneda', e.target.value)} disabled={isRO} className={sc()}>
              {CAT_MONEDA.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {!isCaptacion && (
            <div>
              <label className="block text-xs text-gray-700 mb-1">Monto Garantía</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  type="text" inputMode="decimal"
                  value={data.montoGarantia}
                  onChange={e => handleNumeric('montoGarantia', e.target.value)}
                  onBlur={() => handleCurrencyBlur('montoGarantia')}
                  disabled={isRO} placeholder="0.00"
                  className={`${ic()} pl-5`}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seguro financiado */}
      {!isCaptacion && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={data.seguroFinanciado}
                onChange={e => set('seguroFinanciado', e.target.checked)}
                disabled={isRO}
                className="w-3.5 h-3.5"
              />
              Seguro Financiado
            </label>
            {data.seguroFinanciado && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-700">Monto Seguro:</label>
                <div className="relative w-40">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                  <input
                    type="text" inputMode="decimal"
                    value={data.montoSeguro}
                    onChange={e => handleNumeric('montoSeguro', e.target.value)}
                    onBlur={() => handleCurrencyBlur('montoSeguro')}
                    disabled={isRO} placeholder="0.00"
                    className={`${ic()} pl-5`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resumen dinámico */}
      {isLineaCredito && (
        <div className="mt-4 bg-purple-50 border border-purple-200 rounded px-3 py-2">
          <p className="text-xs text-purple-800">
            <strong>Línea de Crédito:</strong> La simulación generará una tabla de amortización para disposiciones sobre la línea.
          </p>
        </div>
      )}
    </div>
  );
}