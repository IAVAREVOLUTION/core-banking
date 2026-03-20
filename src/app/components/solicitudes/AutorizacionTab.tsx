/**
 * AutorizacionTab.tsx — Spec: Solicitudes de Crédito §9 (Autorizaciones)
 *
 * Sección 1: Autorizadores configurados en PRODUCTO → AUTORIZACIÓN
 *   - Se obtienen de J_PRODUCTOS.data.autorizacion vía GET /productos/:id
 *   - Los usuarios se filtran según MONTO_SOLICITADO (rango montoMinimo–montoMaximo)
 *   - Fallback a MOCK_AUTORIZADORES si no hay datos en DB
 *
 * Sección 2: Autorizaciones registradas para la solicitud actual
 *   - Editables, filtradas por solicitudId
 *   - El botón "Auto-cargar" genera autorizaciones desde la configuración del producto
 */
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  Autorizacion, saveToSession, loadFromSession, loadFromSavedStore, generateId,
  MOCK_AUTORIZACIONES, MOCK_AUTORIZADORES, CAT_ESTATUS_AUTORIZACION,
} from './solicitudCreditoStore';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const LOG = '[AutorizacionTab]';

/** Estructura de autorizador en el JSONB del producto */
interface AutorizadorProductoDB {
  usuario: string;
  puesto: string;
  area: string;
  montoMinimo: number;
  montoMaximo: number;
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  montoSolicitado?: string;
  productoId?: string;
}

export function AutorizacionTab({ mode, solicitudId, montoSolicitado, productoId }: Props) {
  // ── State: Autorizadores del producto ──
  const [autorizadoresProducto, setAutorizadoresProducto] = useState<AutorizadorProductoDB[]>([]);
  const [loadingProducto, setLoadingProducto] = useState(false);
  const [reqSource, setReqSource] = useState<'db' | 'fallback' | 'none'>('none');

  // ── State: Autorizaciones registradas ──
  const getInit = (): Autorizacion[] => {
    const s = loadFromSession<Autorizacion[]>(solicitudId, 'autorizaciones');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<Autorizacion[]>(solicitudId, 'autorizaciones');
    if (saved) return saved;
    // NO cargar MOCK: si la BD no tiene datos, el array queda vacío
    return [];
  };

  const [items, setItems] = useState<Autorizacion[]>(getInit);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const isRO = mode === 'ver';

  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, 'autorizaciones', items);
  }, [items, solicitudId, isRO]);

  // ══════════════════════════════════════════════════════════════════
  // FETCH: Autorizadores configurados en el producto (J_PRODUCTOS.data.autorizacion)
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!productoId) {
      console.log(`${LOG} Sin productoId — sin autorizadores`);
      return;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productoId)) {
      console.log(`${LOG} productoId '${productoId}' no es UUID — omitiendo consulta BD`);
      return;
    }

    let cancelled = false;
    const fetchAutorizadores = async () => {
      setLoadingProducto(true);
      const headers = { 'Authorization': `Bearer ${publicAnonKey}` };

      try {
        console.log(`${LOG} Consultando autorizadores del producto ${productoId}...`);
        const res = await fetch(`${API_BASE}/productos/${productoId}`, { headers });
        const json = await res.json();

        if (cancelled) return;

        if (!res.ok || json.error) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        const productData = json.data?.data || {};
        const rawAuth: AutorizadorProductoDB[] = Array.isArray(productData.autorizacion) ? productData.autorizacion : [];

        if (rawAuth.length === 0) {
          console.log(`${LOG} Producto ${productoId} no tiene autorizadores configurados`);
          setAutorizadoresProducto([]);
          setReqSource('db');
          setLoadingProducto(false);
          return;
        }

        console.log(`${LOG} ${rawAuth.length} autorizadores encontrados en el producto`);
        setAutorizadoresProducto(rawAuth);
        setReqSource('db');
      } catch (err: any) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`${LOG} Error al cargar autorizadores del producto: ${msg}`);
        // NO fallback a mocks — si falla, queda vacío
        // setAutorizadoresProducto(MOCK_AUTORIZADORES);
        // setReqSource('fallback');
      } finally {
        if (!cancelled) setLoadingProducto(false);
      }
    };

    fetchAutorizadores();
    return () => { cancelled = true; };
  }, [productoId]);

  // ── Derivados ──
  const montoNum = parseFloat((montoSolicitado || '0').replace(/[^0-9.-]/g, ''));

  // Filtrar autorizadores aplicables según el monto solicitado
  const autorizadoresAplicables = useMemo(() => {
    if (montoNum <= 0) return autorizadoresProducto;
    return autorizadoresProducto.filter(a => montoNum >= a.montoMinimo && montoNum <= a.montoMaximo);
  }, [autorizadoresProducto, montoNum]);

  // ── Handlers ──
  const handleNuevo = () => {
    const now = new Date();
    const fh = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setItems(p => [...p, { id: generateId(), fechaHora: fh, usuario: '', area: '', descripcion: '', observaciones: '', estatus: 'Pendiente' }]);
    setSelectedIdx(items.length);
    toast.success('Autorización agregada');
  };

  /** Auto-poblar autorizadores según PRODUCTO_ID y MONTO_SOLICITADO — spec §10 */
  const handleAutoCargar = () => {
    if (montoNum <= 0) {
      toast.error('Monto inválido', { description: 'Capture el monto solicitado en el header antes de cargar autorizadores.' });
      return;
    }

    if (autorizadoresAplicables.length === 0) {
      toast.error('Sin autorizadores', { description: 'No se encontraron autorizadores configurados para este rango de monto.' });
      return;
    }

    const now = new Date();
    const fh = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const autorizadores = autorizadoresAplicables.map(a => ({
      id: generateId(),
      fechaHora: fh,
      usuario: a.usuario,
      puesto: a.puesto,
      area: a.area,
      descripcion: `Autorización para ${productoId || 'producto'} — monto $${montoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
      observaciones: '',
      estatus: 'Pendiente',
    }));

    setItems(autorizadores);
    toast.success(`${autorizadores.length} autorizadores cargados`, {
      description: `Según configuración del producto${reqSource === 'db' ? ' (DB)' : ' (fallback)'} para monto $${montoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
    });
  };

  const handleEliminar = () => {
    if (selectedIdx === null) { toast.error('Seleccione una autorización'); return; }
    setItems(p => p.filter((_, i) => i !== selectedIdx));
    setSelectedIdx(null);
    toast.success('Autorización eliminada');
  };

  const update = (idx: number, f: keyof Autorizacion, v: string) => {
    setItems(p => p.map((a, i) => i === idx ? { ...a, [f]: v } : a));
  };

  const fmtCurrency = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(Number(n))) return '$0.00';
    return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="border border-gray-200 bg-white">
      {/* ═══ SECCIÓN 1 — Autorizadores del Producto ═══ */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-medium text-gray-800">Autorizadores del Producto</h4>
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
          <span className="text-[10px] text-gray-500">
            {autorizadoresProducto.length} autorizador(es) configurados
            {montoNum > 0 && ` | ${autorizadoresAplicables.length} aplicable(s) para monto ${fmtCurrency(montoNum)}`}
          </span>
        </div>

        {loadingProducto && (
          <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-xs">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
            Cargando autorizadores del producto...
          </div>
        )}

        {!loadingProducto && autorizadoresProducto.length === 0 && (
          <div className="text-center py-8 border border-gray-200 rounded bg-gray-50">
            <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <circle cx="16" cy="12" r="5" />
              <path d="M8 26c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
            <p className="text-xs text-gray-500">
              {productoId
                ? 'El producto seleccionado no tiene autorizadores configurados.'
                : 'Seleccione un producto en el header para ver sus autorizadores.'}
            </p>
          </div>
        )}

        {!loadingProducto && autorizadoresProducto.length > 0 && (
          <div className="border border-gray-300 overflow-hidden rounded">
            <table className="w-full text-xs">
              <thead className="bg-[#2E5C91] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Usuario / Puesto</th>
                  <th className="px-3 py-2 text-left font-medium w-28">Área</th>
                  <th className="px-3 py-2 text-right font-medium w-32">Monto Mínimo</th>
                  <th className="px-3 py-2 text-right font-medium w-32">Monto Máximo</th>
                  <th className="px-3 py-2 text-center font-medium w-24">Aplica</th>
                </tr>
              </thead>
              <tbody>
                {autorizadoresProducto.map((a, idx) => {
                  const aplica = montoNum > 0 && montoNum >= a.montoMinimo && montoNum <= a.montoMaximo;
                  return (
                    <tr
                      key={`auth-${idx}`}
                      className="border-b border-gray-200"
                      style={{ backgroundColor: idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF' }}
                    >
                      <td className="px-3 py-1.5">
                        <span className="text-gray-800 font-medium">{a.usuario}</span>
                        <span className="text-gray-500 ml-1.5 text-[10px]">({a.puesto})</span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-700">{a.area}</td>
                      <td className="px-3 py-1.5 text-right text-gray-700">{fmtCurrency(a.montoMinimo)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-700">{fmtCurrency(a.montoMaximo)}</td>
                      <td className="px-3 py-1.5 text-center">
                        {montoNum <= 0 ? (
                          <span className="text-gray-400 text-[10px]">Sin monto</span>
                        ) : aplica ? (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-[10px] border border-green-200">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 5l2 2 4-4" /></svg>
                            Sí
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-gray-500 bg-gray-50 px-2 py-0.5 rounded text-[10px] border border-gray-200">
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ SECCIÓN 2 — Autorizaciones Registradas ═══ */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-800">Autorizaciones Registradas</h4>
          {!isRO && (
            <div className="flex items-center gap-2">
              <button onClick={handleAutoCargar} className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 6h10M6 1v10" /></svg>
                Auto-cargar
              </button>
              <button onClick={handleNuevo} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Autorizar</button>
              <button onClick={handleEliminar} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50">Eliminar</button>
            </div>
          )}
        </div>

        <div className="border border-gray-300 bg-white overflow-x-auto rounded">
          <table className="w-full border-collapse min-w-[1000px] text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-2 py-2 text-gray-700 text-left border-r border-gray-300 w-[140px] font-medium">Fecha/Hora</th>
                <th className="px-2 py-2 text-gray-700 text-left border-r border-gray-300 w-[150px] font-medium">Usuario que Autoriza</th>
                <th className="px-2 py-2 text-gray-700 text-left border-r border-gray-300 w-[120px] font-medium">Área</th>
                <th className="px-2 py-2 text-gray-700 text-left border-r border-gray-300 font-medium">Descripción</th>
                <th className="px-2 py-2 text-gray-700 text-left border-r border-gray-300 font-medium">Observaciones</th>
                <th className="px-2 py-2 text-gray-700 text-left w-[120px] font-medium">Estatus <span className="text-red-600">*</span></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">{mode === 'nuevo' ? 'Presione "Auto-cargar" o "Autorizar" para agregar autorizaciones' : 'Sin autorizaciones registradas'}</td></tr>
              ) : items.map((a, idx) => (
                <tr key={a.id} className={`border-b border-gray-200 cursor-pointer ${selectedIdx === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isRO && setSelectedIdx(idx)}>
                  <td className="px-2 py-1.5 text-gray-700 border-r border-gray-200">{a.fechaHora}</td>
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    {isRO ? (
                      <span className="text-gray-700">{a.usuario}</span>
                    ) : (
                      <input type="text" value={a.usuario} onChange={e => { e.stopPropagation(); update(idx, 'usuario', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Nombre..." />
                    )}
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    {isRO ? (
                      <span className="text-gray-700">{a.area}</span>
                    ) : (
                      <input type="text" value={a.area} onChange={e => { e.stopPropagation(); update(idx, 'area', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Área..." />
                    )}
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    {isRO ? (
                      <span className="text-gray-700">{a.descripcion}</span>
                    ) : (
                      <input type="text" value={a.descripcion} onChange={e => { e.stopPropagation(); update(idx, 'descripcion', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Descripción..." />
                    )}
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    {isRO ? (
                      <span className="text-gray-700">{a.observaciones}</span>
                    ) : (
                      <input type="text" value={a.observaciones} onChange={e => { e.stopPropagation(); update(idx, 'observaciones', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Observaciones..." />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {isRO ? (
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${
                        a.estatus === 'Autorizado' ? 'text-green-700 bg-green-50 border-green-200' :
                        a.estatus === 'Rechazado' ? 'text-red-700 bg-red-50 border-red-200' :
                        a.estatus === 'Condicionado' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                        'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>{a.estatus}</span>
                    ) : (
                      <select value={a.estatus} onChange={e => { e.stopPropagation(); update(idx, 'estatus', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white">
                        {CAT_ESTATUS_AUTORIZACION.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length < 3 && <div className="h-8 bg-white" />}
        </div>

        {/* Resumen */}
        {items.length > 0 && (
          <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500">
            <span>{items.length} autorización(es) registrada(s)</span>
            <span>
              {items.filter(a => a.estatus === 'Autorizado').length} autorizada(s) |{' '}
              {items.filter(a => a.estatus === 'Pendiente').length} pendiente(s) |{' '}
              {items.filter(a => a.estatus === 'Rechazado').length} rechazada(s)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}