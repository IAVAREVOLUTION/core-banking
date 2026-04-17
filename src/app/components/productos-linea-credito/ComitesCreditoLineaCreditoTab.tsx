/**
 * ComitesCreditoLineaCreditoTab.tsx
 *
 * Replica la estructura y comportamiento de AutorizacionTab (Solicitudes de Crédito).
 *
 * Sección 1: Catálogo de Puestos de Trabajo (J_CATALOGOS type=PuestoTrabajo)
 *   - Se obtienen del catálogo institucional
 *   - Los puestos se filtran según MONTO_SOLICITADO (rango montoMinimo–montoMaximo)
 *
 * Sección 2: Comités registrados para la línea de crédito actual
 *   - Editables inline, sin modal
 *   - El botón "Auto-cargar" genera comités desde el catálogo de puestos
 */
import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { usePuestosTrabajoDB, PuestoTrabajo } from '../../hooks/usePuestosTrabajoDB';
import { useProductoPersistence } from '../../hooks/useProductoPersistence';

const LOG = '[ComitesCreditoLineaCreditoTab]';

// Mismo shape que Autorizacion en solicitudCreditoStore
export interface ComiteCreditoLineaCredito {
  id: number;
  fechaHora: string;
  usuario: string;
  puesto?: string;
  area: string;
  descripcion: string;
  observaciones: string;
  estatus: string;
}

export const CAT_ESTATUS_COMITE = ['Pendiente', 'Autorizado', 'Rechazado', 'Condicionado'];

interface Props {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  montoSolicitado?: string;
  initialData?: ComiteCreditoLineaCredito[];
  persistToStorage?: boolean;
}

export const ComitesCreditoLineaCreditoTab = forwardRef<{ getData: () => ComiteCreditoLineaCredito[] }, Props>(
  ({ mode, productId, montoSolicitado, initialData, persistToStorage }, ref) => {
    const storageKey = persistToStorage && productId ? `linea_credito_comites_${productId}` : '';
    const isViewMode = mode === 'view';

    // Catálogo de Puestos de Trabajo
    const { puestos, loading: loadingPuestos } = usePuestosTrabajoDB();

    // Comités registrados
    const getInit = (): ComiteCreditoLineaCredito[] => {
      if (initialData && initialData.length > 0) return initialData;
      return [];
    };

    const { data, setData } = useProductoPersistence<ComiteCreditoLineaCredito[]>(
      storageKey,
      getInit()
    );

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    // Derivados
    const montoNum = parseFloat((montoSolicitado || '0').replace(/[^0-9.-]/g, ''));

    const puestosAplicables = useMemo(() => {
      if (montoNum <= 0) return puestos;
      return puestos.filter(a => montoNum >= a.montoMinimo && montoNum <= a.montoMaximo);
    }, [puestos, montoNum]);

    // Handlers
    const handleNuevo = () => {
      if (isViewMode) {
        toast.warning('Modo solo lectura');
        return;
      }
      const now = new Date();
      const fh = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setData(p => [...p, { id: Date.now() + Math.floor(Math.random() * 1000), fechaHora: fh, usuario: '', area: '', descripcion: '', observaciones: '', estatus: 'Pendiente' }]);
      setSelectedIdx(data.length);
      toast.success('Comité agregado');
    };

    const handleAutoCargar = () => {
      if (montoNum <= 0) {
        toast.error('Monto inválido', { description: 'Capture el monto solicitado antes de cargar comités.' });
        return;
      }

      if (puestosAplicables.length === 0) {
        toast.error('Sin puestos aplicables', { description: 'No se encontraron puestos configurados para este rango de monto.' });
        return;
      }

      const now = new Date();
      const fh = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const comites = puestosAplicables.map(a => ({
        id: Date.now() + Math.floor(Math.random() * 1000),
        fechaHora: fh,
        usuario: a.nombre,
        puesto: a.puesto,
        area: a.area,
        descripcion: `Comité para línea de crédito — monto $${montoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        observaciones: '',
        estatus: 'Pendiente',
      }));

      setData(comites);
      toast.success(`${comites.length} comités cargados`, {
        description: `Según catálogo de puestos para monto $${montoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
      });
    };

    const handleEliminar = () => {
      if (selectedIdx === null) { toast.error('Seleccione un comité'); return; }
      setData(p => p.filter((_, i) => i !== selectedIdx));
      setSelectedIdx(null);
      toast.success('Comité eliminado');
    };

    const update = (idx: number, f: keyof ComiteCreditoLineaCredito, v: string) => {
      setData(p => p.map((a, i) => i === idx ? { ...a, [f]: v } : a));
    };

    const fmtCurrency = (n: number | undefined | null) => {
      if (n === undefined || n === null || isNaN(Number(n))) return '$0.00';
      return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
      <>
        {/* ═══ SECCIÓN 1 — Catálogo de Puestos de Trabajo ═══ */}
        <div className="border border-gray-200 bg-white">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-medium text-gray-800">Catálogo de Puestos de Trabajo</h4>
              </div>
              <span className="text-[10px] text-gray-500">
                {puestos.length} puesto(s) configurados
                {montoNum > 0 && ` | ${puestosAplicables.length} aplicable(s) para monto ${fmtCurrency(montoNum)}`}
              </span>
            </div>

            {loadingPuestos && (
              <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-xs">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                Cargando puestos de trabajo...
              </div>
            )}

            {!loadingPuestos && puestos.length === 0 && (
              <div className="text-center py-8 border border-gray-200 rounded bg-gray-50">
                <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                  <circle cx="16" cy="12" r="5" />
                  <path d="M8 26c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                </svg>
                <p className="text-xs text-gray-500">
                  No hay puestos de trabajo configurados en el catálogo.
                </p>
              </div>
            )}

            {!loadingPuestos && puestos.length > 0 && (
              <div className="border border-gray-300 overflow-hidden rounded">
                <table className="w-full text-xs">
                  <thead className="bg-[#2E5C91] text-white">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Puesto</th>
                      <th className="px-3 py-2 text-left font-medium">Nombre</th>
                      <th className="px-3 py-2 text-right font-medium w-32">Monto Desde</th>
                      <th className="px-3 py-2 text-right font-medium w-32">Monto Hasta</th>
                      <th className="px-3 py-2 text-center font-medium w-24">Aplica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {puestos.map((a, idx) => {
                      const aplica = montoNum > 0 && montoNum >= a.montoMinimo && montoNum <= a.montoMaximo;
                      return (
                        <tr
                          key={`puesto-${a.id}`}
                          className="border-b border-gray-200"
                          style={{ backgroundColor: idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF' }}
                        >
                          <td className="px-3 py-1.5">
                            <span className="text-gray-800 font-medium">{a.puesto || '—'}</span>
                          </td>
                          <td className="px-3 py-1.5 text-gray-700">{a.nombre || '—'}</td>
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

          {/* ═══ SECCIÓN 2 — Comités Registrados ═══ */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-800">Comités Registrados</h4>
              {!isViewMode && (
                <div className="flex items-center gap-2">
                  <button onClick={handleAutoCargar} className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 6h10M6 1v10" /></svg>
                    Auto-cargar
                  </button>
                  <button onClick={handleNuevo} className="px-4 py-1.5 bg-[#4A6FA5] text-white rounded text-xs hover:bg-[#3E5C91]">Nuevo Comité</button>
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
                  {data.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">Presione "Auto-cargar" o "Nuevo Comité" para agregar comités</td></tr>
                  ) : data.map((a, idx) => (
                    <tr key={a.id} className={`border-b border-gray-200 cursor-pointer ${selectedIdx === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isViewMode && setSelectedIdx(idx)}>
                      <td className="px-2 py-1.5 text-gray-700 border-r border-gray-200">{a.fechaHora}</td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        {isViewMode ? (
                          <span className="text-gray-700">{a.usuario}</span>
                        ) : (
                          <input type="text" value={a.usuario} onChange={e => { e.stopPropagation(); update(idx, 'usuario', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Nombre..." />
                        )}
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        {isViewMode ? (
                          <span className="text-gray-700">{a.area}</span>
                        ) : (
                          <input type="text" value={a.area} onChange={e => { e.stopPropagation(); update(idx, 'area', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Área..." />
                        )}
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        {isViewMode ? (
                          <span className="text-gray-700">{a.descripcion}</span>
                        ) : (
                          <input type="text" value={a.descripcion} onChange={e => { e.stopPropagation(); update(idx, 'descripcion', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Descripción..." />
                        )}
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        {isViewMode ? (
                          <span className="text-gray-700">{a.observaciones}</span>
                        ) : (
                          <input type="text" value={a.observaciones} onChange={e => { e.stopPropagation(); update(idx, 'observaciones', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white" placeholder="Observaciones..." />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {isViewMode ? (
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${
                            a.estatus === 'Autorizado' ? 'text-green-700 bg-green-50 border-green-200' :
                            a.estatus === 'Rechazado' ? 'text-red-700 bg-red-50 border-red-200' :
                            a.estatus === 'Condicionado' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                            'text-amber-700 bg-amber-50 border-amber-200'
                          }`}>{a.estatus}</span>
                        ) : (
                          <select value={a.estatus} onChange={e => { e.stopPropagation(); update(idx, 'estatus', e.target.value); }} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded bg-white">
                            {CAT_ESTATUS_COMITE.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length < 3 && <div className="h-8 bg-white" />}
            </div>

            {/* Resumen */}
            {data.length > 0 && (
              <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500">
                <span>{data.length} comité(s) registrado(s)</span>
                <span>
                  {data.filter(a => a.estatus === 'Autorizado').length} autorizado(s) |{' '}
                  {data.filter(a => a.estatus === 'Pendiente').length} pendiente(s) |{' '}
                  {data.filter(a => a.estatus === 'Rechazado').length} rechazado(s)
                </span>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
);

ComitesCreditoLineaCreditoTab.displayName = 'ComitesCreditoLineaCreditoTab';
