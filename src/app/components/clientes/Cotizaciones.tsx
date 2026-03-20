/**
 * Cotizaciones.tsx — Subtab de Cotizaciones dentro del módulo Clientes
 *
 * Muestra las cotizaciones (Captación, Crédito, Línea de Crédito) asociadas
 * al cliente actual, cargadas desde J_COTIZACIONES vía RPC.
 *
 * Estrategia: useCotizacionesCaptacionDB → filtrar por cliente_id
 * Logging: [CotizCliente]
 */
import { useState, useMemo } from 'react';
import { useCotizacionesCaptacionDB } from '@/app/hooks/useCotizacionesCaptacionDB';

const LOG = '[CotizCliente]';

type LineaFilter = 'Todas' | 'Captación' | 'Crédito' | 'Línea de Crédito';

interface CotizacionesProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
  onNavigateToCotizacion?: (cotizacionId: string, linea: string) => void;
}

export function Cotizaciones({ onBack: _onBack, mode, clienteId, onNavigateToCotizacion }: CotizacionesProps) {
  const _isView = mode === 'ver';

  // ── Hook DB: todas las cotizaciones de J_COTIZACIONES ──
  const {
    cotizaciones: allCotizaciones,
    loading,
    error,
    backendStatus,
    fetchMethod,
    refetch,
  } = useCotizacionesCaptacionDB(true);

  const [lineaFilter, setLineaFilter] = useState<LineaFilter>('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDetail, setShowDetail] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════
  // FILTRO: cotizaciones del cliente actual
  // ═══════════════════════════════════════════════════════════════════
  const cotizacionesCliente = useMemo(() => {
    if (!clienteId || !allCotizaciones.length) return [];

    const cId = String(clienteId);
    const filtered = allCotizaciones.filter(c => {
      // Match por cliente_id directo o por data.cliente.claveCliente
      const matchId = c.cliente_id === cId;
      const matchClave = c.data?.cliente?.claveCliente === cId;
      return matchId || matchClave;
    });

    console.log(`${LOG} Cliente ${cId}: ${filtered.length} cotizaciones de ${allCotizaciones.length} totales`);
    return filtered;
  }, [allCotizaciones, clienteId]);

  // ── Filtro por Línea y búsqueda ──
  const cotizacionesFiltradas = useMemo(() => {
    let result = cotizacionesCliente;

    if (lineaFilter !== 'Todas') {
      result = result.filter(c => c.data?.lineaProducto === lineaFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.no_cotiza?.toLowerCase().includes(term) ||
        c.descripcion?.toLowerCase().includes(term) ||
        c.data?.producto?.nombreProducto?.toLowerCase().includes(term) ||
        c.estatus_cotiza?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [cotizacionesCliente, lineaFilter, searchTerm]);

  // ── Contadores por línea ──
  const contadores = useMemo(() => {
    const c = { todas: cotizacionesCliente.length, captacion: 0, credito: 0, lineaCredito: 0 };
    cotizacionesCliente.forEach(cot => {
      const lp = cot.data?.lineaProducto || '';
      if (lp === 'Captación') c.captacion++;
      else if (lp === 'Crédito') c.credito++;
      else if (lp === 'Línea de Crédito') c.lineaCredito++;
    });
    return c;
  }, [cotizacionesCliente]);

  // ── Selección ──
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(cotizacionesFiltradas.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(sid => sid !== id));
    }
  };

  // ── Helpers de formato ──
  const formatFecha = (fecha: string) => {
    if (!fecha) return '—';
    try {
      return new Date(fecha).toLocaleDateString('es-MX', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch { return fecha; }
  };

  const formatMonto = (monto: number | string | undefined | null) => {
    if (monto == null) return '—';
    const num = typeof monto === 'string' ? parseFloat(monto) : monto;
    if (isNaN(num)) return '—';
    return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getEstatusBadge = (estatus: string) => {
    const s = estatus?.toLowerCase() || '';
    if (s.includes('aprob') || s.includes('activ')) return 'bg-green-100 text-green-700 border-green-300';
    if (s.includes('pend') || s.includes('revis')) return 'bg-amber-100 text-amber-700 border-amber-300';
    if (s.includes('rechaz') || s.includes('cancel')) return 'bg-red-100 text-red-700 border-red-300';
    return 'bg-gray-100 text-gray-600 border-gray-300';
  };

  const getLineaBadge = (linea: string) => {
    if (linea === 'Captación') return 'bg-blue-100 text-blue-700';
    if (linea === 'Crédito') return 'bg-purple-100 text-purple-700';
    if (linea === 'Línea de Crédito') return 'bg-teal-100 text-teal-700';
    return 'bg-gray-100 text-gray-600';
  };

  // ── Detalle de cotización ──
  const detailCotizacion = showDetail
    ? cotizacionesFiltradas.find(c => c.id === showDetail)
    : null;

  // Debug: log data structure when detail is open
  if (detailCotizacion) {
    console.log(`${LOG} DETALLE data keys:`, Object.keys(detailCotizacion.data || {}));
    console.log(`${LOG} DETALLE data completo:`, JSON.stringify(detailCotizacion.data, null, 2).substring(0, 1000));
  }

  return (
    <div className="flex-1">
      {/* Encabezado institucional */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-800">COTIZACIONES DEL CLIENTE</span>
          {/* Badge de fuente de datos */}
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
            backendStatus === 'ready'
              ? 'bg-green-50 text-green-700 border-green-300'
              : backendStatus === 'local-only'
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-gray-50 text-gray-500 border-gray-300'
          }`}>
            {loading ? '⏳ Cargando...' :
             backendStatus === 'ready' ? `✓ DB (${fetchMethod})` :
             backendStatus === 'local-only' ? '⚠ Local' : backendStatus}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50 font-medium"
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Refrescar'}
          </button>
        </div>
      </div>

      {/* Filtros por línea de producto */}
      <div className="flex items-center gap-2 mb-3 px-1">
        {([
          { key: 'Todas' as LineaFilter, label: 'Todas', count: contadores.todas },
          { key: 'Captación' as LineaFilter, label: 'Captación', count: contadores.captacion },
          { key: 'Crédito' as LineaFilter, label: 'Crédito', count: contadores.credito },
          { key: 'Línea de Crédito' as LineaFilter, label: 'Línea de Crédito', count: contadores.lineaCredito },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => setLineaFilter(f.key)}
            className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
              lineaFilter === f.key
                ? 'bg-primary-theme text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
              lineaFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {f.count}
            </span>
          </button>
        ))}

        {/* Búsqueda */}
        <div className="ml-auto">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por No. Cotización, producto, estatus..."
            className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white w-64"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-1 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      {/* Tabla de Cotizaciones */}
      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '36px' }}>
                <input
                  type="checkbox"
                  checked={cotizacionesFiltradas.length > 0 && selectedIds.length === cotizacionesFiltradas.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">No. Cotización</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Línea</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Descripción</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-gray-800 border-r border-gray-300">Monto</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300">Estatus</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800" style={{ width: '70px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-gray-500">Cargando cotizaciones desde J_COTIZACIONES...</p>
                </td>
              </tr>
            ) : cotizacionesFiltradas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-xs text-gray-500">
                  {cotizacionesCliente.length === 0
                    ? 'No hay cotizaciones asociadas a este cliente.'
                    : `No se encontraron cotizaciones con los filtros aplicados (${cotizacionesCliente.length} total del cliente).`
                  }
                </td>
              </tr>
            ) : (
              cotizacionesFiltradas.map(cot => {
                const linea = cot.data?.lineaProducto || '—';
                const producto = cot.data?.producto?.nombreProducto || '—';
                const d = cot.data as any;
                const monto = linea === 'Captación'
                  ? d?.montoCotizado
                  : (d?.montoCotizado ?? d?.montoSolicitado);

                return (
                  <tr
                    key={cot.id}
                    className={`border-b border-gray-300 hover:bg-gray-50 ${
                      selectedIds.includes(cot.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-center border-r border-gray-300">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(cot.id)}
                        onChange={(e) => handleSelectOne(cot.id, e.target.checked)}
                        className="w-4 h-4"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300 font-mono">
                      <button
                        onClick={() => {
                          if (onNavigateToCotizacion) {
                            const lineaNav = cot.data?.lineaProducto || 'Captación';
                            console.log(`${LOG} Navegando al módulo Cotizaciones (folio click) → id=${cot.id}, línea=${lineaNav}`);
                            onNavigateToCotizacion(cot.id, lineaNav);
                          } else {
                            setShowDetail(cot.id);
                          }
                        }}
                        className="text-[#2E5C91] hover:text-[#1a3d66] underline hover:no-underline cursor-pointer font-mono text-xs"
                        title="Ver en módulo Cotizaciones"
                      >
                        {cot.no_cotiza ? (cot.no_cotiza.length > 16 ? cot.no_cotiza.slice(0, 16) + '...' : cot.no_cotiza) : '—'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs border-r border-gray-300">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${getLineaBadge(linea)}`}>
                        {linea}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{producto}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                      {cot.descripcion || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                      {formatFecha(cot.fecha_cotiza)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">
                      {formatMonto(monto)}
                    </td>
                    <td className="px-3 py-2 text-center border-r border-gray-300">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getEstatusBadge(cot.estatus_cotiza)}`}>
                        {cot.estatus_cotiza || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => {
                          if (onNavigateToCotizacion) {
                            const lineaNav = cot.data?.lineaProducto || 'Captación';
                            console.log(`${LOG} Navegando al módulo Cotizaciones → id=${cot.id}, línea=${lineaNav}`);
                            onNavigateToCotizacion(cot.id, lineaNav);
                          } else {
                            setShowDetail(cot.id);
                          }
                        }}
                        className="inline-flex items-center justify-center px-3 py-1 btn-secondary-theme text-xs rounded font-medium"
                        title="Ver en módulo Cotizaciones"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Resumen inferior */}
      {!loading && cotizacionesCliente.length > 0 && (
        <div className="mt-2 px-1 flex items-center justify-between text-[10px] text-gray-500">
          <span>
            Mostrando {cotizacionesFiltradas.length} de {cotizacionesCliente.length} cotización{cotizacionesCliente.length !== 1 ? 'es' : ''} del cliente
          </span>
          <span>
            Captación: {contadores.captacion} | Crédito: {contadores.credito} | Línea de Crédito: {contadores.lineaCredito}
          </span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Modal de detalle de cotización */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showDetail && detailCotizacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                Detalle de Cotización
              </h3>
              <button
                onClick={() => setShowDetail(null)}
                className="text-white hover:text-gray-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Info general */}
              <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
                <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN GENERAL</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="block text-[10px] text-gray-500 mb-0.5">No. Cotización</span>
                  <span className="text-xs text-gray-800 font-mono">{detailCotizacion.no_cotiza}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 mb-0.5">Estatus</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getEstatusBadge(detailCotizacion.estatus_cotiza)}`}>
                    {detailCotizacion.estatus_cotiza}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 mb-0.5">Línea de Producto</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${getLineaBadge(detailCotizacion.data?.lineaProducto || '')}`}>
                    {detailCotizacion.data?.lineaProducto || '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 mb-0.5">Fecha Cotización</span>
                  <span className="text-xs text-gray-800">{formatFecha(detailCotizacion.fecha_cotiza)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 mb-0.5">Descripción</span>
                  <span className="text-xs text-gray-800">{detailCotizacion.descripcion || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 mb-0.5">Usuario</span>
                  <span className="text-xs text-gray-800">{detailCotizacion.data?.usuario || '—'}</span>
                </div>
              </div>

              {/* Producto */}
              <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
                <h3 className="text-xs font-semibold text-gray-700">PRODUCTO</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="block text-[10px] text-gray-500 mb-0.5">Clave Producto</span>
                  <span className="text-xs text-gray-800">{detailCotizacion.data?.producto?.claveProducto || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 mb-0.5">Nombre Producto</span>
                  <span className="text-xs text-gray-800">{detailCotizacion.data?.producto?.nombreProducto || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 mb-0.5">Tipo Producto</span>
                  <span className="text-xs text-gray-800">{(detailCotizacion.data?.producto as any)?.tipoProducto || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 mb-0.5">Institución / Gobierno</span>
                  <span className="text-xs text-gray-800">{detailCotizacion.data?.institucionGobierno || '—'}</span>
                </div>
              </div>

              {/* Montos / Condiciones */}
              <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
                <h3 className="text-xs font-semibold text-gray-700">CONDICIONES FINANCIERAS</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {detailCotizacion.data?.lineaProducto === 'Captación' ? (
                  <>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Monto Cotizado</span>
                      <span className="text-xs text-gray-800 font-medium">
                        {formatMonto((detailCotizacion.data as any)?.montoCotizado)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Tasa Mín. Interés</span>
                      <span className="text-xs text-gray-800">
                        {(detailCotizacion.data as any)?.tasaMinInteres != null
                          ? `${(detailCotizacion.data as any).tasaMinInteres}%`
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Frecuencia Capitalización</span>
                      <span className="text-xs text-gray-800">
                        {(detailCotizacion.data as any)?.frecuenciaCapitalizacion || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Interés Generado</span>
                      <span className="text-xs text-gray-800">
                        {formatMonto((detailCotizacion.data as any)?.interesGeneradoPeriodo)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Monto Cotizado</span>
                      <span className="text-xs text-gray-800 font-medium">
                        {formatMonto((detailCotizacion.data as any)?.montoCotizado ?? (detailCotizacion.data as any)?.montoSolicitado)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Plazo</span>
                      <span className="text-xs text-gray-800">
                        {(detailCotizacion.data as any)?.plazo
                          ? `${(detailCotizacion.data as any).plazo} periodos`
                          : (detailCotizacion.data as any)?.plazoMeses
                            ? `${(detailCotizacion.data as any).plazoMeses} meses`
                            : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Periodo</span>
                      <span className="text-xs text-gray-800">
                        {(detailCotizacion.data as any)?.periodo || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Tasa Cotizada</span>
                      <span className="text-xs text-gray-800">
                        {(detailCotizacion.data as any)?.tasaCotizada != null
                          ? `${(detailCotizacion.data as any).tasaCotizada}%`
                          : (detailCotizacion.data as any)?.tasaAnual != null
                            ? `${(detailCotizacion.data as any).tasaAnual}%`
                            : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Amortización</span>
                      <span className="text-xs text-gray-800">
                        {(detailCotizacion.data as any)?.amortizacion || (detailCotizacion.data as any)?.tipoTasa || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Pago por Periodo</span>
                      <span className="text-xs text-gray-800 font-medium">
                        {formatMonto((detailCotizacion.data as any)?.pagoPorPeriodo ?? (detailCotizacion.data as any)?.pagoMensual)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Interés a Pagar</span>
                      <span className="text-xs text-gray-800">
                        {formatMonto((detailCotizacion.data as any)?.interesPagar)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Fecha Primer Pago</span>
                      <span className="text-xs text-gray-800">
                        {formatFecha((detailCotizacion.data as any)?.fechaPrimerPago)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 mb-0.5">Seguro Financiado</span>
                      <span className="text-xs text-gray-800">
                        {(detailCotizacion.data as any)?.seguroFinanciado === true
                          ? 'Sí'
                          : (detailCotizacion.data as any)?.seguroFinanciado === false
                            ? 'No'
                            : '—'}
                      </span>
                    </div>
                    {/* Seguro details if present */}
                    {(detailCotizacion.data as any)?.seguro?.montoSeguro != null && (
                      <>
                        <div>
                          <span className="block text-[10px] text-gray-500 mb-0.5">Monto Seguro</span>
                          <span className="text-xs text-gray-800">
                            {formatMonto((detailCotizacion.data as any)?.seguro?.montoSeguro)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-500 mb-0.5">Tasa Seguro</span>
                          <span className="text-xs text-gray-800">
                            {(detailCotizacion.data as any)?.seguro?.tasaSeguro != null
                              ? `${(detailCotizacion.data as any).seguro.tasaSeguro}%`
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-500 mb-0.5">Total Seguro</span>
                          <span className="text-xs text-gray-800 font-medium">
                            {formatMonto((detailCotizacion.data as any)?.seguro?.totalSeguro)}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end">
              <button
                onClick={() => setShowDetail(null)}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}