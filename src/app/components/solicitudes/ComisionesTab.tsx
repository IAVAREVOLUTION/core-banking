/**
 * ComisionesTab.tsx — Spec: Solicitudes de Crédito §8 (Comisiones)
 *
 * Sección 1: Comisiones configuradas en PRODUCTO → COMISIONES
 *   - Se obtienen de J_PRODUCTOS.data.comisiones vía GET /productos/:id
 *   - Fallback a MOCK_COMISIONES_PRODUCTO si no hay datos en DB
 *
 * Sección 2: Comisiones calculadas para la solicitud actual
 *   - Se calculan sobre el monto solicitado usando la configuración del producto
 *   - Solo se permiten tipos de comisión configurados en el producto
 */
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  Comision, saveToSession, loadFromSession, loadFromSavedStore, generateId,
  MOCK_COMISIONES, MOCK_COMISIONES_PRODUCTO, formatCurrency, parseCurrency,
} from './solicitudCreditoStore';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const LOG = '[ComisionesTab]';

/** Estructura de comisión en el JSONB del producto */
interface ComisionProductoDB {
  tipoComision: string;
  descripcion: string;
  base: string;
  porcentaje: number;
  montoFijo?: number;
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  montoSolicitado: string;
  productoId: string;
}

export function ComisionesTab({ mode, solicitudId, montoSolicitado, productoId }: Props) {
  // ── State: Comisiones configuradas en el producto ──
  const [comisionesProducto, setComisionesProducto] = useState<ComisionProductoDB[]>([]);
  const [loadingProducto, setLoadingProducto] = useState(false);
  const [reqSource, setReqSource] = useState<'db' | 'fallback' | 'none'>('none');

  // ── State: Comisiones calculadas para esta solicitud ──
  const getInit = (): Comision[] => {
    const s = loadFromSession<Comision[]>(solicitudId, 'comisiones');
    console.log(`${LOG} getInit → solicitudId=${solicitudId}, session data:`, s ? `${s.length} comisiones` : 'NULL');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<Comision[]>(solicitudId, 'comisiones');
    console.log(`${LOG} getInit → savedStore data:`, saved ? `${saved.length} comisiones` : 'NULL');
    if (saved) return saved;
    return [];
  };

  const [comisiones, setComisiones] = useState<Comision[]>(getInit);
  const isRO = mode === 'ver';

  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, 'comisiones', comisiones);
  }, [comisiones, solicitudId, isRO]);

  // ══════════════════════════════════════════════════════════════════
  // FETCH: Comisiones configuradas en el producto (J_PRODUCTOS.data.comisiones)
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!productoId) {
      console.log(`${LOG} Sin productoId — sin comisiones`);
      return;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productoId)) {
      console.log(`${LOG} productoId '${productoId}' no es UUID — omitiendo consulta BD`);
      return;
    }

    let cancelled = false;
    const fetchComisiones = async () => {
      setLoadingProducto(true);
      const headers = { 'Authorization': `Bearer ${publicAnonKey}` };

      try {
        console.log(`${LOG} Consultando comisiones del producto ${productoId}...`);
        const res = await fetch(`${API_BASE}/productos/${productoId}`, { headers });
        const json = await res.json();

        if (cancelled) return;

        if (!res.ok || json.error) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        const productData = json.data?.data || {};
        const rawComisiones: ComisionProductoDB[] = Array.isArray(productData.comisiones) ? productData.comisiones : [];

        if (rawComisiones.length === 0) {
          console.log(`${LOG} Producto ${productoId} no tiene comisiones configuradas`);
          setComisionesProducto([]);
          setReqSource('db');
          setLoadingProducto(false);
          return;
        }

        console.log(`${LOG} ${rawComisiones.length} comisiones encontradas en el producto`);
        setComisionesProducto(rawComisiones);
        setReqSource('db');
      } catch (err: any) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`${LOG} Error al cargar comisiones del producto: ${msg}`);
        // NO fallback a mocks — si falla, queda vacío
        // setComisionesProducto(MOCK_COMISIONES_PRODUCTO);
        // setReqSource('fallback');
      } finally {
        if (!cancelled) setLoadingProducto(false);
      }
    };

    fetchComisiones();
    return () => { cancelled = true; };
  }, [productoId]);

  // ── Calcular comisiones desde la configuración del producto ──
  const handleCalcular = () => {
    const monto = parseFloat(parseCurrency(montoSolicitado || '0'));
    if (monto <= 0) {
      toast.error('Monto inválido', { description: 'Capture el monto solicitado en el header antes de calcular comisiones.' });
      return;
    }

    if (comisionesProducto.length === 0) {
      toast.error('Sin configuración', { description: 'El producto no tiene comisiones configuradas.' });
      return;
    }

    const nuevas: Comision[] = comisionesProducto.map(cfg => {
      const montoCalc = cfg.base === 'Fijo'
        ? (cfg.montoFijo || 0)
        : monto * (cfg.porcentaje / 100);
      return {
        id: generateId(),
        tipoComision: cfg.tipoComision,
        descripcion: cfg.descripcion,
        base: cfg.base,
        porcentaje: cfg.porcentaje,
        montoCalculado: Math.round(montoCalc * 100) / 100,
        estatus: 'Pendiente',
      };
    });

    setComisiones(nuevas);
    toast.success('Comisiones calculadas', {
      description: `${nuevas.length} comisiones generadas desde la configuración del producto${reqSource === 'db' ? ' (DB)' : ' (fallback)'}.`
    });
  };

  const handleEliminar = (id: number) => {
    setComisiones(prev => prev.filter(c => c.id !== id));
    toast.success('Comisión eliminada');
  };

  const totalComisiones = comisiones.reduce((s, c) => s + (c.montoCalculado ?? 0), 0);

  return (
    <div className="border border-gray-200 bg-white">
      {/* ═══ SECCIÓN 1 — Comisiones del Producto ═══ */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-medium text-gray-800">Comisiones del Producto</h4>
            {reqSource === 'db' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l2 2 4-4" /></svg>
                DB
              </span>
            )}
            {reqSource === 'fallback' && (
              <span className="inline-flex items-center text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                Fallback
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-500">{comisionesProducto.length} comisión(es) configuradas</span>
        </div>

        {loadingProducto && (
          <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-xs">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
            Cargando comisiones del producto...
          </div>
        )}

        {!loadingProducto && comisionesProducto.length === 0 && (
          <div className="text-center py-8 border border-gray-200 rounded bg-gray-50">
            <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <rect x="4" y="8" width="24" height="16" rx="2" />
              <path d="M4 14h24M10 8v-3M22 8v-3" />
            </svg>
            <p className="text-xs text-gray-500">
              {productoId
                ? 'El producto seleccionado no tiene comisiones configuradas.'
                : 'Seleccione un producto en el header para ver sus comisiones.'}
            </p>
          </div>
        )}

        {!loadingProducto && comisionesProducto.length > 0 && (
          <div className="border border-gray-300 overflow-hidden rounded">
            <table className="w-full text-xs">
              <thead className="bg-[#2E5C91] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Tipo Comisión</th>
                  <th className="px-3 py-2 text-left font-medium">Descripción</th>
                  <th className="px-3 py-2 text-left font-medium w-32">Base de Cálculo</th>
                  <th className="px-3 py-2 text-right font-medium w-24">Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                {comisionesProducto.map((cfg, idx) => (
                  <tr key={`cfg-${idx}`} className="border-b border-gray-200" style={{ backgroundColor: idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF' }}>
                    <td className="px-3 py-1.5 text-gray-800 font-medium">{cfg.tipoComision}</td>
                    <td className="px-3 py-1.5 text-gray-600">{cfg.descripcion}</td>
                    <td className="px-3 py-1.5 text-gray-700">{cfg.base}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">
                      {cfg.base === 'Fijo' ? formatCurrency(cfg.montoFijo || 0) : `${(cfg.porcentaje ?? 0).toFixed(2)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ SECCIÓN 2 — Comisiones Calculadas para esta Solicitud ═══ */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-800">Comisiones Calculadas</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Calculadas sobre el monto solicitado usando la configuración del producto {productoId || '(sin producto)'}
            </p>
          </div>
          {!isRO && (
            <button onClick={handleCalcular} className="px-4 py-1.5 btn-secondary-theme rounded text-xs flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="12" height="12" rx="1" />
                <path d="M4 4h2M8 4h2M4 7h6M4 10h3" />
              </svg>
              Calcular Comisiones
            </button>
          )}
        </div>

        {comisiones.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs border border-gray-200 rounded bg-gray-50">
            <svg className="mx-auto mb-2" width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <rect x="4" y="4" width="20" height="20" rx="2" />
              <path d="M4 10h20M10 4v20" />
            </svg>
            No hay comisiones calculadas. Presione "Calcular Comisiones" para generar desde la configuración del producto.
          </div>
        ) : (
          <>
            <div className="border border-gray-300 overflow-hidden rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Tipo Comisión</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Descripción</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Base de Cálculo</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Porcentaje</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Monto</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Estatus</th>
                    {!isRO && <th className="px-3 py-2 text-center font-medium text-gray-700">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {comisiones.map((c, idx) => (
                    <tr
                      key={c.id}
                      className="border-b border-gray-200"
                      style={{ backgroundColor: idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF' }}
                    >
                      <td className="px-3 py-2 text-gray-800 font-medium">{c.tipoComision}</td>
                      <td className="px-3 py-2 text-gray-600">{c.descripcion}</td>
                      <td className="px-3 py-2 text-gray-700">{c.base}</td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {c.base === 'Fijo' ? '—' : `${(c.porcentaje ?? 0).toFixed(2)}%`}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-800 font-medium">{formatCurrency(c.montoCalculado ?? 0)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${
                          c.estatus === 'Aplicado' ? 'text-green-700 bg-green-50 border-green-200' :
                          c.estatus === 'Cancelado' ? 'text-red-700 bg-red-50 border-red-200' :
                          'text-amber-700 bg-amber-50 border-amber-200'
                        }`}>{c.estatus}</span>
                      </td>
                      {!isRO && (
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => handleEliminar(c.id)} className="text-red-600 hover:underline text-[10px]">Eliminar</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-400 font-medium">
                    <td colSpan={4} className="px-3 py-2 text-right text-gray-800">TOTAL COMISIONES:</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-bold">{formatCurrency(totalComisiones)}</td>
                    <td colSpan={isRO ? 1 : 2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Resumen */}
            <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
              <span>{comisiones.length} comisión(es) calculada(s)</span>
              <span>Total: <strong className="text-gray-700">{formatCurrency(totalComisiones)}</strong></span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}