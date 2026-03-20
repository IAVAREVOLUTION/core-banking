/**
 * GarantiasTab.tsx — Spec: Garantías de Solicitud de Crédito
 *
 * Sección 1: Garantías exigidas por el Producto (desde J_PRODUCTOS.data.garantias)
 *   - Tabla de solo lectura que refleja EXACTAMENTE lo configurado en PRODUCTO → GARANTÍAS
 *   - Campos: Tipo, Subtipo, Descripción, Aforo (%), Estatus de cumplimiento
 *
 * Sección 2: Garantías registradas por el usuario para la Solicitud actual
 *   - Editables, filtradas por solicitudId + usuario
 *   - Campos: Fecha, Usuario, Tipo, Subtipo, Descripción, Valor Nominal, Ubicación, Nota, Fase, Área, Estatus
 *   - Solo se permiten tipos de garantía configurados en el producto
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  Garantia, GarantiaProducto,
  saveToSession, loadFromSession, loadFromSavedStore, generateId,
  MOCK_GARANTIAS, CAT_TIPO_GARANTIA, formatCurrency, CAT_FASES,
} from './solicitudCreditoStore';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const LOG = '[GarantiasTab]';
// TODO: reemplazar con usuario real de sesión cuando se implemente auth
const CURRENT_USER = '(sesión pendiente)';

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  montoSolicitado?: string;
  productoId?: string;
  faseIdActual?: number;
}

/** Fallback estático cuando no hay productoId o falla el fetch */
// ELIMINADO: MOCK_GARANTIAS_PRODUCTO — no se deben mostrar datos inventados como reales
// const MOCK_GARANTIAS_PRODUCTO: GarantiaProducto[] = [
//   { id: 1, tipo: 'Inmueble', subtipo: 'Terreno', descripcion: 'Terreno urbano con servicios de 500 m2', aforo: '300.00' },
//   { id: 2, tipo: 'Inmueble', subtipo: 'Departamento', descripcion: 'Casa habitación de 3 recámaras, 2 baños', aforo: '200.00' },
//   { id: 3, tipo: 'Mueble', subtipo: 'Automóvil', descripcion: 'Inventario completo de mercancía en tienda', aforo: '100.00' },
// ];

export function GarantiasTab({ mode, solicitudId, montoSolicitado, productoId, faseIdActual = 1 }: Props) {
  // ── State: Garantías del producto (desde DB) ──
  const [garantiasProducto, setGarantiasProducto] = useState<GarantiaProducto[]>([]);
  const [loadingProducto, setLoadingProducto] = useState(false);
  const [reqSource, setReqSource] = useState<'db' | 'fallback' | 'none'>('none');

  // ── State: Garantías registradas por el usuario ──
  const getInitItems = useCallback((): Garantia[] => {
    const s = loadFromSession<Garantia[]>(solicitudId, 'garantias');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<Garantia[]>(solicitudId, 'garantias');
    if (saved) return saved;
    // NO cargar MOCK: si la BD no tiene datos, el array queda vacío
    return [];
  }, [solicitudId, mode]);

  const [items, setItems] = useState<Garantia[]>(getInitItems);
  const [showForm, setShowForm] = useState(false);
  const [newGarantia, setNewGarantia] = useState<Partial<Garantia>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const isRO = mode === 'ver';

  // ── Persist en sessionStorage ──
  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, 'garantias', items);
  }, [items, solicitudId, isRO]);

  // ══════════════════════════════════════════════════════════════════
  // FETCH: Garantías configuradas en el producto (J_PRODUCTOS.data.garantias)
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!productoId) {
      console.log(`${LOG} Sin productoId — sin garantías de producto configuradas`);
      return;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productoId)) {
      console.log(`${LOG} productoId '${productoId}' no es UUID — omitiendo consulta BD`);
      return;
    }

    let cancelled = false;
    const fetchGarantias = async () => {
      setLoadingProducto(true);
      const headers = { 'Authorization': `Bearer ${publicAnonKey}` };

      try {
        console.log(`${LOG} Consultando garantías del producto ${productoId}...`);
        const res = await fetch(`${API_BASE}/productos/${productoId}`, { headers });
        const json = await res.json();

        if (cancelled) return;

        if (!res.ok || json.error) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        const productData = json.data?.data || {};
        const rawGarantias: GarantiaProducto[] = Array.isArray(productData.garantias) ? productData.garantias : [];

        if (rawGarantias.length === 0) {
          console.log(`${LOG} Producto ${productoId} no tiene garantías configuradas`);
          setGarantiasProducto([]);
          setReqSource('db');
          setLoadingProducto(false);
          return;
        }

        console.log(`${LOG} ${rawGarantias.length} garantías encontradas en el producto`);
        setGarantiasProducto(rawGarantias);
        setReqSource('db');
      } catch (err: any) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`${LOG} Error al cargar garantías del producto: ${msg}`);
        // setGarantiasProducto(MOCK_GARANTIAS_PRODUCTO);
        // setReqSource('fallback');
      } finally {
        if (!cancelled) setLoadingProducto(false);
      }
    };

    fetchGarantias();
    return () => { cancelled = true; };
  }, [productoId]);

  // ── Derivados ──
  // TODO: cuando se implemente auth, filtrar por usuario real de sesión
  // Por ahora se muestran TODAS las garantías de la solicitud (sin filtrar por usuario)
  const itemsFiltrados = useMemo(() => items, [items]);

  const totalGarantias = itemsFiltrados.reduce((s, g) => s + (g.valorNominal || 0), 0);
  const montoReq = parseFloat((montoSolicitado || '0').replace(/[^0-9.-]/g, ''));
  const garantiaSuficiente = montoReq <= 0 || totalGarantias >= montoReq;

  // Tipos disponibles = los configurados en el producto (no se permiten otros)
  const tiposPermitidos = useMemo(() => {
    if (garantiasProducto.length > 0) {
      return [...new Set(garantiasProducto.map(g => g.tipo))];
    }
    return CAT_TIPO_GARANTIA.map(t => t.value);
  }, [garantiasProducto]);

  // Match: para cada garantía del producto, ¿cuánto se ha cubierto?
  const matchProductoUsuario = useMemo(() => {
    return garantiasProducto.map(gp => {
      const registradas = itemsFiltrados.filter(
        g => g.tipo === gp.tipo && g.subtipo === gp.subtipo
      );
      const totalRegistrado = registradas.reduce((s, g) => s + (g.valorNominal || 0), 0);
      return { ...gp, registradas: registradas.length, totalRegistrado };
    });
  }, [garantiasProducto, itemsFiltrados]);

  // ── Handlers ──
  const handleAddGarantia = () => {
    if (!newGarantia.tipo) {
      toast.error('Seleccione un tipo de garantía');
      return;
    }
    if (!newGarantia.descripcion) {
      toast.error('Ingrese una descripción');
      return;
    }
    if (!newGarantia.valorNominal || newGarantia.valorNominal <= 0) {
      toast.error('El valor nominal debe ser mayor a 0');
      return;
    }

    const now = new Date();
    const fecha = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const doc: Garantia = {
      id: generateId(),
      fecha,
      usuario: CURRENT_USER,
      tipo: newGarantia.tipo,
      subtipo: newGarantia.subtipo || '',
      descripcion: newGarantia.descripcion,
      valorNominal: newGarantia.valorNominal,
      ubicacion: newGarantia.ubicacion || '',
      estatus: 'Vigente',
      nota: newGarantia.nota || '',
      fase: `Fase ${faseIdActual}`,
      faseId: faseIdActual,
      area: newGarantia.area || 'General',
      documentoAdjunto: newGarantia.documentoAdjunto || '',
    };

    setItems(prev => [...prev, doc]);
    setNewGarantia({});
    setShowForm(false);
    toast.success('Garantía registrada', { description: `${doc.tipo} — ${formatCurrency(doc.valorNominal)}` });
  };

  const handleEliminar = (id: number) => {
    setItems(prev => prev.filter(g => g.id !== id));
    setSelectedId(null);
    toast.success('Garantía eliminada');
  };

  // Subtipos dinámicos según tipo seleccionado (misma lógica que GarantiaTab del producto)
  const getSubtipos = (tipo: string) => {
    if (tipo === 'Mueble') return ['Automóvil', 'Maquinaria', 'Equipo de Cómputo', 'Inventario', 'Otro Mueble'];
    if (tipo === 'Inmueble') return ['Terreno', 'Casa Habitación', 'Departamento', 'Local Comercial', 'Nave Industrial', 'Otro Inmueble'];
    // Para tipos del catálogo estático
    if (tipo === 'Hipotecaria') return ['Inmobiliaria', 'Terreno', 'Departamento'];
    if (tipo === 'Prendaria') return ['Vehículo', 'Maquinaria', 'Equipo'];
    if (tipo === 'Fiduciaria') return ['Fideicomiso'];
    if (tipo === 'Líquida') return ['Depósito bancario', 'Inversión'];
    return [];
  };

  return (
    <div className="border border-gray-200 bg-white">
      {/* ═══ SECCIÓN 1 — Garantías Exigidas por el Producto ═══ */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-medium text-gray-800">
              Garantías del Producto
            </h4>
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
          <span className="text-[10px] text-gray-500">{garantiasProducto.length} garantía(s) configuradas</span>
        </div>

        {/* Loading */}
        {loadingProducto && (
          <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-xs">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
            Cargando garantías del producto...
          </div>
        )}

        {/* Empty state */}
        {!loadingProducto && garantiasProducto.length === 0 && (
          <div className="text-center py-8 border border-gray-200 rounded bg-gray-50">
            <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <rect x="4" y="8" width="24" height="16" rx="2" />
              <path d="M4 14h24M10 8v-3M22 8v-3" />
            </svg>
            <p className="text-xs text-gray-500">
              {productoId
                ? 'El producto seleccionado no tiene garantías configuradas.'
                : 'Seleccione un producto en el header para ver sus garantías requeridas.'}
            </p>
          </div>
        )}

        {/* Tabla de garantías del producto */}
        {!loadingProducto && garantiasProducto.length > 0 && (
          <div className="border border-gray-300 overflow-hidden rounded">
            <table className="w-full text-xs">
              <thead className="bg-[#2E5C91] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-28">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium w-32">Subtipo</th>
                  <th className="px-3 py-2 text-left font-medium">Descripción</th>
                  <th className="px-3 py-2 text-right font-medium w-24">Aforo (%)</th>
                  <th className="px-3 py-2 text-center font-medium w-24">Registradas</th>
                  <th className="px-3 py-2 text-right font-medium w-32">Monto Cubierto</th>
                  <th className="px-3 py-2 text-center font-medium w-24">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {matchProductoUsuario.map((gp, idx) => {
                  const cubierta = gp.registradas > 0;
                  return (
                    <tr
                      key={`gp-${gp.id}-${idx}`}
                      className="border-b border-gray-200"
                      style={{ backgroundColor: idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF' }}
                    >
                      <td className="px-3 py-1.5 text-gray-700 font-medium">{gp.tipo}</td>
                      <td className="px-3 py-1.5 text-gray-700">{gp.subtipo}</td>
                      <td className="px-3 py-1.5 text-gray-600">{gp.descripcion || <span className="text-gray-400 italic">Sin descripción</span>}</td>
                      <td className="px-3 py-1.5 text-right text-gray-700">{gp.aforo}%</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] border ${
                          cubierta
                            ? 'text-blue-700 bg-blue-50 border-blue-200'
                            : 'text-gray-500 bg-gray-50 border-gray-200'
                        }`}>
                          {gp.registradas}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-700">
                        {cubierta ? formatCurrency(gp.totalRegistrado) : <span className="text-gray-400">--</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {cubierta ? (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-[10px] border border-green-200">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 5l2 2 4-4" /></svg>
                            Cubierta
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-gray-500 bg-gray-50 px-2 py-0.5 rounded text-[10px] border border-gray-200">
                            Pendiente
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

        {/* Leyenda */}
        {!loadingProducto && garantiasProducto.length > 0 && (
          <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Cubierta (usuario ha registrado garantía de este tipo)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300" /> Pendiente
            </span>
          </div>
        )}
      </div>

      {/* ═══ SECCIÓN 2 — Garantías Registradas por el Usuario ═══ */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-800">Garantías Registradas</h4>
            <span className="text-[10px] text-gray-500">
              (Usuario: {CURRENT_USER} | Solicitud: {solicitudId === 'new' ? 'Nueva' : solicitudId})
            </span>
          </div>
          {!isRO && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-3 py-1 btn-secondary-theme rounded text-xs flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 1v10M1 6h10" />
              </svg>
              Agregar Garantía
            </button>
          )}
        </div>

        {/* Validación cobertura vs monto solicitado */}
        {itemsFiltrados.length > 0 && montoReq > 0 && (
          <div className={`mb-3 px-3 py-2 rounded border text-xs flex items-center gap-2 ${
            garantiaSuficiente
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              {garantiaSuficiente
                ? <path d="M3 7l3 3 5-5" />
                : <><circle cx="7" cy="7" r="6" /><path d="M7 4v3M7 9v.5" /></>
              }
            </svg>
            <span>
              Total garantías: <strong>{formatCurrency(totalGarantias)}</strong>
              {' '}| Monto solicitado: <strong>{formatCurrency(montoReq)}</strong>
              {' '}— {garantiaSuficiente ? 'Cobertura suficiente' : 'Cobertura insuficiente — el monto de garantías debe cubrir el monto solicitado'}
            </span>
          </div>
        )}

        {/* Formulario inline de carga */}
        {showForm && !isRO && (
          <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1">Tipo de Garantía <span className="text-red-500">*</span></label>
                <select
                  value={newGarantia.tipo || ''}
                  onChange={e => setNewGarantia(prev => ({ ...prev, tipo: e.target.value, subtipo: '' }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]"
                >
                  <option value="">Seleccionar...</option>
                  {tiposPermitidos.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Subtipo</label>
                <select
                  value={newGarantia.subtipo || ''}
                  onChange={e => setNewGarantia(prev => ({ ...prev, subtipo: e.target.value }))}
                  disabled={!newGarantia.tipo}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5] disabled:bg-gray-100"
                >
                  <option value="">Seleccionar...</option>
                  {getSubtipos(newGarantia.tipo || '').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Valor Nominal <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newGarantia.valorNominal || ''}
                    onChange={e => setNewGarantia(prev => ({ ...prev, valorNominal: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5] text-right"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1">Descripción <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newGarantia.descripcion || ''}
                  onChange={e => setNewGarantia(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción de la garantía..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Ubicación</label>
                <input
                  type="text"
                  value={newGarantia.ubicacion || ''}
                  onChange={e => setNewGarantia(prev => ({ ...prev, ubicacion: e.target.value }))}
                  placeholder="Ubicación del bien..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Nota</label>
                <input
                  type="text"
                  value={newGarantia.nota || ''}
                  onChange={e => setNewGarantia(prev => ({ ...prev, nota: e.target.value }))}
                  placeholder="Observaciones..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1">Área Responsable</label>
                <select
                  value={newGarantia.area || ''}
                  onChange={e => setNewGarantia(prev => ({ ...prev, area: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Jurídico">Jurídico</option>
                  <option value="Mesa de Control">Mesa de Control</option>
                  <option value="Análisis">Análisis</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Documento Adjunto</label>
                <input
                  type="text"
                  value={newGarantia.documentoAdjunto || ''}
                  readOnly
                  placeholder="(sin adjunto)"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Fase</label>
                <input
                  type="text"
                  value={`Fase ${faseIdActual}`}
                  disabled
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-100"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleAddGarantia} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Registrar</button>
              <button onClick={() => { setShowForm(false); setNewGarantia({}); }} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        )}

        {/* Tabla de garantías registradas */}
        {itemsFiltrados.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs border border-gray-200 rounded bg-gray-50">
            <svg className="mx-auto mb-2" width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <rect x="4" y="4" width="20" height="20" rx="2" />
              <path d="M4 10h20M10 4v20" />
            </svg>
            No se han registrado garantías para esta solicitud.
            {!isRO && ' Presione "Agregar Garantía" para iniciar.'}
          </div>
        ) : (
          <div className="border border-gray-300 overflow-hidden rounded overflow-x-auto">
            <table className="w-full text-xs min-w-[1100px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-700">Fecha</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-700">Usuario</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-700">Tipo</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-700">Subtipo</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-700">Descripción</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-700">Valor Nominal</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-700">Ubicación</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-700">Nota</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-700">Fase</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-700">Área</th>
                  <th className="px-2 py-2 text-center font-medium text-gray-700">Estatus</th>
                  {!isRO && <th className="px-2 py-2 text-center font-medium text-gray-700">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.map((g, idx) => (
                  <tr
                    key={g.id}
                    className={`border-b border-gray-200 cursor-pointer ${selectedId === g.id ? 'bg-blue-50' : ''}`}
                    style={{ backgroundColor: selectedId === g.id ? undefined : idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF' }}
                    onClick={() => setSelectedId(g.id)}
                  >
                    <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{g.fecha}</td>
                    <td className="px-2 py-1.5 text-gray-700">{g.usuario}</td>
                    <td className="px-2 py-1.5 text-gray-700 font-medium">{g.tipo}</td>
                    <td className="px-2 py-1.5 text-gray-700">{g.subtipo || <span className="text-gray-300">--</span>}</td>
                    <td className="px-2 py-1.5 text-gray-600 max-w-[150px] truncate" title={g.descripcion}>{g.descripcion}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700 font-medium whitespace-nowrap">{formatCurrency(g.valorNominal)}</td>
                    <td className="px-2 py-1.5 text-gray-700">{g.ubicacion || <span className="text-gray-300">--</span>}</td>
                    <td className="px-2 py-1.5 text-gray-600 max-w-[100px] truncate" title={g.nota}>{g.nota || <span className="text-gray-300">--</span>}</td>
                    <td className="px-2 py-1.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-blue-700 bg-blue-50 border border-blue-200">
                        {g.fase}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-gray-700">{g.area}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] border ${
                        g.estatus === 'Vigente' ? 'text-green-700 bg-green-50 border-green-200' :
                        g.estatus === 'Cancelada' ? 'text-red-700 bg-red-50 border-red-200' :
                        'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>
                        {g.estatus}
                      </span>
                    </td>
                    {!isRO && (
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={e => { e.stopPropagation(); handleEliminar(g.id); }}
                          className="text-red-600 hover:underline text-[10px]"
                          title="Eliminar"
                        >
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumen */}
        {itemsFiltrados.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
            <span>{itemsFiltrados.length} garantía(s) registrada(s)</span>
            <span>Total: <strong className="text-gray-700">{formatCurrency(totalGarantias)}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}