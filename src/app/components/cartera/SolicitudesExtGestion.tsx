/**
 * SolicitudesExtGestion.tsx — Gestión global de Solicitudes Extraordinarias
 * Lista con Autorizar / Rechazar (con comentario obligatorio) y ejecución de lógica de negocio
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAllSolicitudesExt, actualizarSolicitudExt, fmtDate } from '../../hooks/useCarteraDB';

const ESTATUS_COLOR: Record<string, string> = {
  Pendiente:  'bg-amber-50 text-amber-700 border-amber-200',
  Autorizada: 'bg-green-50 text-green-700 border-green-200',
  Rechazada:  'bg-red-50 text-red-700 border-red-200',
  Procesada:  'bg-blue-50 text-blue-700 border-blue-200',
};

interface Props {
  usuario?: string;
}

export function SolicitudesExtGestion({ usuario = 'Sistema' }: Props) {
  const { rows, loading, error, refetch } = useAllSolicitudesExt();
  const [procesando, setProcesando] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('Pendiente');

  // Modal de rechazo
  const [modalRechazo, setModalRechazo] = useState<{ id: string; tipo: string } | null>(null);
  const [comentario, setComentario] = useState('');

  useEffect(() => { refetch(); }, [refetch]);

  const handleAutorizar = async (id: string) => {
    setProcesando(id);
    const result = await actualizarSolicitudExt(id, 'Autorizada', usuario);
    setProcesando(null);
    if (result.ok) {
      toast.success('Solicitud autorizada — lógica de negocio ejecutada');
      refetch();
    } else {
      toast.error('Error al autorizar', { description: result.error });
    }
  };

  const abrirRechazo = (id: string, tipo: string) => {
    setModalRechazo({ id, tipo });
    setComentario('');
  };

  const handleRechazar = async () => {
    if (!modalRechazo) return;
    if (!comentario.trim()) { toast.error('El comentario de rechazo es obligatorio'); return; }
    setProcesando(modalRechazo.id);
    const result = await actualizarSolicitudExt(modalRechazo.id, 'Rechazada', usuario, comentario.trim());
    setProcesando(null);
    if (result.ok) {
      toast.success('Solicitud rechazada');
      setModalRechazo(null);
      refetch();
    } else {
      toast.error('Error al rechazar', { description: result.error });
    }
  };

  const filtered = rows.filter(r => {
    const matchEstatus = filtroEstatus === 'Todos' || r.estatus === filtroEstatus;
    const q = search.toLowerCase();
    const matchSearch = !q || r.tipo_nombre?.toLowerCase().includes(q) || r.usuario.toLowerCase().includes(q);
    return matchEstatus && matchSearch;
  });

  const pendientes = rows.filter(r => r.estatus === 'Pendiente').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
              <rect x="2" y="3" width="16" height="14" rx="1.5"/>
              <path d="M7 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-semibold text-gray-800">Gestión de Solicitudes Extraordinarias</span>
            {pendientes > 0 && (
              <span className="inline-flex items-center justify-center h-5 px-2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {pendientes}
              </span>
            )}
          </div>
          <button onClick={refetch} disabled={loading} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-40">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6A4 4 0 1 0 3.5 2.5"/><path d="M2 2.5v3h3"/></svg>
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="5" r="4"/><path d="M10 10l-2-2"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por tipo, usuario..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg"
          />
        </div>
        <select value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
          <option value="Pendiente">Pendientes</option>
          <option value="Autorizada">Autorizadas</option>
          <option value="Rechazada">Rechazadas</option>
          <option value="Procesada">Procesadas</option>
          <option value="Todos">Todos</option>
        </select>
        <span className="text-xs text-gray-400">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#2E5C91] text-white">
                <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
                <th className="px-3 py-2.5 text-left font-medium">Clave</th>
                <th className="px-3 py-2.5 text-left font-medium">Fecha</th>
                <th className="px-3 py-2.5 text-left font-medium">Usuario Solicita</th>
                <th className="px-3 py-2.5 text-left font-medium">Notas</th>
                <th className="px-3 py-2.5 text-left font-medium">Autorizado por</th>
                <th className="px-3 py-2.5 text-left font-medium">Comentario</th>
                <th className="px-3 py-2.5 text-center font-medium">Estatus</th>
                <th className="px-3 py-2.5 text-center font-medium w-36">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                  <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-[#4A6FA5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                  Cargando solicitudes...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-12 text-center">
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-2">
                    <rect x="4" y="4" width="28" height="28" rx="2"/><path d="M12 18h12M18 12v12" strokeLinecap="round"/>
                  </svg>
                  <p className="text-xs text-gray-400">Sin solicitudes{filtroEstatus !== 'Todos' ? ` con estatus "${filtroEstatus}"` : ''}</p>
                </td></tr>
              ) : filtered.map((r, idx) => {
                const isPendiente = r.estatus === 'Pendiente';
                const isProcessing = procesando === r.id;
                return (
                  <tr key={r.id} className={`border-b border-gray-100 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'} ${isPendiente ? 'hover:bg-amber-50/20' : ''}`}>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{r.tipo_nombre || '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-500 text-[10px]">{r.tipo_clave || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(r.fecha)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{r.usuario}</td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate" title={r.notas || ''}>{r.notas || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-[10px]">
                      {r.usuario_autoriza
                        ? <span>{r.usuario_autoriza}<br/><span className="text-gray-400">{fmtDate(r.fecha_autoriza)}</span></span>
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate" title={r.comentario_aprobador || ''}>
                      {r.comentario_aprobador
                        ? <span className="text-red-600 italic">{r.comentario_aprobador}</span>
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTATUS_COLOR[r.estatus] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {r.estatus}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isPendiente ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleAutorizar(r.id)}
                            disabled={isProcessing}
                            title="Autorizar"
                            className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {isProcessing
                              ? <svg className="animate-spin h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/></svg>
                              : <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1.5 4.5L3.5 6.5L7.5 2.5"/></svg>
                            }
                            Autorizar
                          </button>
                          <button
                            onClick={() => abrirRechazo(r.id, r.tipo_nombre || '')}
                            disabled={isProcessing}
                            title="Rechazar"
                            className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l5 5M7 2L2 7"/></svg>
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Rechazo */}
      {modalRechazo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalRechazo(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-red-50 rounded-t-xl">
              <div>
                <h4 className="text-sm font-bold text-red-800">Rechazar Solicitud</h4>
                <p className="text-[11px] text-red-600 mt-0.5">{modalRechazo.tipo}</p>
              </div>
              <button onClick={() => setModalRechazo(null)} className="text-red-400 hover:text-red-600">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-600">
                Para rechazar esta solicitud es necesario indicar el motivo. Este comentario quedará registrado junto con el rechazo.
              </p>
              <div>
                <label className="block text-[10px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                  Motivo de Rechazo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  rows={4}
                  placeholder="Describa el motivo por el que se rechaza la solicitud..."
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-red-300 focus:border-red-400 outline-none"
                  autoFocus
                />
                {comentario.trim().length === 0 && (
                  <p className="text-[10px] text-red-500 mt-1">El comentario es obligatorio</p>
                )}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setModalRechazo(null)} className="px-4 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
              <button
                onClick={handleRechazar}
                disabled={!comentario.trim() || procesando === modalRechazo.id}
                className="px-5 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium flex items-center gap-1.5"
              >
                {procesando === modalRechazo.id
                  ? <><svg className="animate-spin h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/></svg> Rechazando...</>
                  : <><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l6 6M8 2L2 8"/></svg> Confirmar Rechazo</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
