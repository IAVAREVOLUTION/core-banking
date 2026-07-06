import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import type { ReporteCNBV } from './pldStore';
import { usePLDReportes } from './usePLDData';
import { usePLDClientes } from './usePLDClientes';

interface Props { onBack?: () => void; }

const EMPTY: ReporteCNBV = {
  id: 0, folio: '', fecha: '', tipo: 'Operación Relevante',
  cliente: '', monto: '', estatus: 'Pendiente', enviado: 'No',
};

function tipeBadge(t: string) {
  if (t.includes('Relevante'))  return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (t.includes('Inusual'))    return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
  return 'bg-red-50 text-red-700 border border-red-200';
}
function statBadge(s: string) {
  if (s === 'Validado')    return 'bg-green-50 text-green-700 border border-green-200';
  if (s === 'En Revisión') return 'bg-blue-50 text-blue-700 border border-blue-200';
  return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
}

export function PLDReportesCNBV({ onBack }: Props) {
  const { reportes, loading: loadingReportes, save: saveReporte, remove: removeReporte } = usePLDReportes();
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroEstatus, setFiltroEstatus] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [modal, setModal] = useState<'nuevo' | 'editar' | 'ver' | null>(null);
  const [current, setCurrent] = useState<ReporteCNBV>({ ...EMPTY });

  const { clientes: clientesDB } = usePLDClientes();
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDrop, setShowClienteDrop] = useState(false);
  const clientesFiltrados = useMemo(() => {
    if (!clienteSearch) return clientesDB.slice(0, 8);
    const q = clienteSearch.toLowerCase();
    return clientesDB.filter(c => c.nombre.toLowerCase().includes(q) || c.rfc.toLowerCase().includes(q)).slice(0, 8);
  }, [clienteSearch, clientesDB]);

  const filtered = reportes.filter(r => {
    if (filtroTipo !== 'Todos' && r.tipo !== filtroTipo) return false;
    if (filtroEstatus !== 'Todos' && r.estatus !== filtroEstatus) return false;
    if (busqueda && !r.cliente.toLowerCase().includes(busqueda.toLowerCase()) && !r.folio.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const openNew = () => {
    setCurrent({ ...EMPTY, id: 0, folio: `REP-CNBV-${Date.now()}`, fecha: new Date().toLocaleDateString('es-MX') });
    setClienteSearch('');
    setModal('nuevo');
  };
  const openEdit = (r: ReporteCNBV) => { setCurrent({ ...r }); setClienteSearch(''); setModal('editar'); };
  const openView = (r: ReporteCNBV) => { setCurrent({ ...r }); setModal('ver'); };

  const handleSave = async () => {
    if (!current.cliente.trim()) { toast.error('El campo Cliente es obligatorio'); return; }
    if (!current.monto.trim())   { toast.error('El campo Monto es obligatorio'); return; }
    await saveReporte(current);
    toast.success(modal === 'nuevo' ? 'Reporte generado' : 'Reporte actualizado', { description: current.folio });
    setModal(null);
  };

  const handleDelete = async (id: number) => { await removeReporte(id); toast.success('Reporte eliminado'); setModal(null); };

  const handleValidar = async (r: ReporteCNBV) => {
    await saveReporte({ ...r, estatus: 'Validado' });
    if (modal === 'ver') setCurrent(c => ({ ...c, estatus: 'Validado' }));
    toast.success('Reporte validado', { description: r.folio });
  };

  const handleEnviar = async (r: ReporteCNBV) => {
    if (r.estatus !== 'Validado') { toast.error('Valide el reporte antes de enviarlo'); return; }
    await saveReporte({ ...r, enviado: 'Sí' });
    if (modal === 'ver') setCurrent(c => ({ ...c, enviado: 'Sí' }));
    toast.success('Reporte enviado a CNBV', { description: r.folio });
  };

  const isView = modal === 'ver';
  const labelCls = 'text-xs w-32 flex-shrink-0 text-gray-700';
  const inputCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white';
  const viewCls  = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600';

  return (
    <div className="bg-white min-h-full">

      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
            <h2 className="text-lg text-gray-800">Reportes CNBV</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span>Lista</span>
            <span className="cursor-pointer hover:text-[#0066CC] transition-colors" onClick={openNew}>Generar Reporte</span>
          </div>
        </div>
      </div>

      {/* Ver bar */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[260px]">
              <option>Vista general de Reportes CNBV</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
          </div>
          <button onClick={openNew} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">+ Generar Reporte</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 font-medium">Filtros</span>
            <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded bg-white">
              <option value="Todos">Tipo: Todos</option>
              <option>Operación Relevante</option><option>Operación Inusual</option><option>Operación Preocupante</option>
            </select>
            <select value={filtroEstatus} onChange={e => { setFiltroEstatus(e.target.value); setPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded bg-white">
              <option value="Todos">Estatus: Todos</option>
              <option>Pendiente</option><option>En Revisión</option><option>Validado</option>
            </select>
          </div>
          <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1); }} placeholder="Buscar por folio o cliente..." className="px-3 py-1 border border-gray-400 rounded text-sm w-72 transition-all" />
        </div>
      </div>

      {/* Export / sort bar */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {['CSV','XLS','PDF'].map((t, i) => {
              const fills = ['#6B7280','#1D9F5B','#D32F2F'];
              return (
                <button key={t} onClick={() => toast.info(`Exportar ${t}`)}
                  className={`p-1.5 rounded transition-colors hover:scale-110 transform ${i===1?'hover:bg-green-100':i===2?'hover:bg-red-100':'hover:bg-gray-200'}`} title={t}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill={fills[i]}/><text x="10" y="13.5" fontSize="6" fontWeight="bold" textAnchor="middle" fill="white">{t}</text></svg>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span className="font-medium">Total: {filtered.length}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="p-0.5 text-[#0066CC] disabled:opacity-40">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="p-0.5 text-[#0066CC] disabled:opacity-40">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="px-4 py-4">
        <div className="border border-gray-300 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Editar | Ver</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Folio</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Fecha</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Tipo</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Cliente</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Monto</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Estatus</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Enviado</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">Sin reportes</td></tr>
              ) : paged.map((r, idx) => (
                <tr key={r.id} className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    <span className="text-[#0066CC] cursor-pointer hover:underline" onClick={() => openEdit(r)}>Editar</span>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="text-[#0066CC] cursor-pointer hover:underline" onClick={() => openView(r)}>Ver</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#0066CC]" style={{ fontWeight: 500 }}>{r.folio}</td>
                  <td className="px-3 py-2.5 text-xs">{r.fecha}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${tipeBadge(r.tipo)}`}>{r.tipo}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs max-w-[180px] truncate">{r.cliente}</td>
                  <td className="px-3 py-2.5 text-xs font-mono">{r.monto}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${statBadge(r.estatus)}`}>{r.estatus}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-center">
                    {r.enviado === 'Sí' ? <span className="text-green-700" style={{ fontWeight: 700 }}>&#x2713;</span> : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
          <span>Mostrando {Math.min((page-1)*perPage+1, filtered.length)}–{Math.min(page*perPage, filtered.length)} de {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page===1} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">&laquo;</button>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">&lsaquo;</button>
            <span className="px-3 py-1 bg-[#4A6FA5] text-white rounded">{page}</span>
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">&rsaquo;</button>
            <button onClick={() => setPage(totalPages)} disabled={page===totalPages} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">&raquo;</button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setModal(null)}>
          <div className="bg-white rounded shadow-xl w-[700px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="bg-[#4A6FA5] px-6 py-4 rounded-t flex items-center justify-between flex-shrink-0">
              <h3 className="text-base text-white" style={{ fontWeight: 500 }}>
                {modal === 'nuevo' ? 'Generar Nuevo Reporte CNBV' : modal === 'editar' ? `Editar Reporte — ${current.folio}` : `Detalle Reporte — ${current.folio}`}
              </h3>
              <button onClick={() => setModal(null)} className="text-white/80 hover:text-white text-xl leading-none">&times;</button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded">
                <div className="text-xs text-gray-700 mb-3" style={{ fontWeight: 600 }}>INFORMACIÓN DEL REPORTE</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>FOLIO</label>
                    <div className={viewCls}>{current.folio}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>FECHA</label>
                    {isView ? <div className={viewCls}>{current.fecha}</div>
                      : <DatePicker value={current.fecha} onChange={v => setCurrent(c => ({ ...c, fecha: v }))} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>TIPO <span className="text-red-600">*</span></label>
                    {isView ? <div className={viewCls}>{current.tipo}</div>
                      : <select value={current.tipo} onChange={e => setCurrent(c => ({ ...c, tipo: e.target.value }))} className={inputCls}>
                          <option>Operación Relevante</option>
                          <option>Operación Inusual</option>
                          <option>Operación Preocupante</option>
                        </select>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>CLIENTE <span className="text-red-600">*</span></label>
                    {isView ? <div className={viewCls}>{current.cliente}</div> : (
                      <div className="flex-1 relative">
                        <input type="text"
                          value={clienteSearch || current.cliente}
                          onChange={e => { setClienteSearch(e.target.value); setCurrent(c => ({ ...c, cliente: e.target.value })); setShowClienteDrop(true); }}
                          onFocus={() => setShowClienteDrop(true)}
                          onBlur={() => setTimeout(() => setShowClienteDrop(false), 150)}
                          className={inputCls} placeholder="Buscar cliente..." autoComplete="off" />
                        {showClienteDrop && clientesFiltrados.length > 0 && (
                          <div className="absolute left-0 top-full z-50 bg-white border border-gray-300 shadow-lg w-full max-h-40 overflow-auto">
                            {clientesFiltrados.map(c => (
                              <div key={c.id} className="px-3 py-1.5 text-xs cursor-pointer hover:bg-[#E8F4F8] border-b border-gray-100"
                                onMouseDown={() => { setCurrent(cur => ({ ...cur, cliente: c.nombre })); setClienteSearch(''); setShowClienteDrop(false); }}>
                                <span style={{ fontWeight: 500 }}>{c.nombre}</span>
                                {c.rfc && <span className="text-gray-400 ml-2 font-mono text-[10px]">{c.rfc}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>MONTO <span className="text-red-600">*</span></label>
                    {isView ? <div className={viewCls}>{current.monto}</div>
                      : <input type="text" value={current.monto} onChange={e => setCurrent(c => ({ ...c, monto: e.target.value }))} className={inputCls} placeholder="$0.00" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>ESTATUS</label>
                    {isView
                      ? <div className={`${viewCls} ${current.estatus === 'Validado' ? 'bg-green-50 text-green-700 border-green-200' : ''}`}>{current.estatus}</div>
                      : <select value={current.estatus} onChange={e => setCurrent(c => ({ ...c, estatus: e.target.value }))} className={inputCls}>
                          <option>Pendiente</option><option>En Revisión</option><option>Validado</option>
                        </select>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>ENVIADO CNBV</label>
                    {isView
                      ? <div className={`${viewCls} ${current.enviado === 'Sí' ? 'bg-green-50 text-green-700 border-green-200' : ''}`}>{current.enviado}</div>
                      : <select value={current.enviado} onChange={e => setCurrent(c => ({ ...c, enviado: e.target.value }))} className={inputCls}>
                          <option>No</option><option>Sí</option>
                        </select>}
                  </div>
                </div>
              </div>

              {/* Acciones rápidas en modo Ver */}
              {isView && (
                <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded">
                  <div className="text-xs text-blue-800 mb-2" style={{ fontWeight: 600 }}>ACCIONES DISPONIBLES</div>
                  <div className="flex items-center gap-2">
                    {current.estatus !== 'Validado' && (
                      <button onClick={() => handleValidar(current)} className="px-4 py-1.5 bg-[#0E7B1F] text-white text-xs rounded hover:bg-[#0A6118]">Validar Reporte</button>
                    )}
                    {current.enviado !== 'Sí' && current.estatus === 'Validado' && (
                      <button onClick={() => handleEnviar(current)} className="px-4 py-1.5 bg-[#5C3D9B] text-white text-xs rounded hover:bg-[#4a3080]">Enviar a CNBV</button>
                    )}
                    <button onClick={() => toast.info('Descargando archivo XML...')} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Descargar XML</button>
                    {current.estatus === 'Validado' && current.enviado === 'Sí' && (
                      <span className="text-xs text-green-700 ml-2" style={{ fontWeight: 500 }}>&#x2713; Completado y enviado</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b flex items-center justify-between flex-shrink-0">
              <div>
                {modal === 'editar' && (
                  <button onClick={() => handleDelete(current.id)} className="px-4 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">Eliminar</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isView && (
                  <button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white text-sm rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}>
                    {modal === 'nuevo' ? 'Generar Reporte' : 'Guardar Cambios'}
                  </button>
                )}
                <button onClick={() => setModal(null)} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-sm rounded hover:bg-gray-50">
                  {isView ? 'Cerrar' : 'Cancelar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
