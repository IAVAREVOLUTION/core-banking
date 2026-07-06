import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import type { AlertaPLD } from './pldStore';
import { usePLDAlertas } from './usePLDData';
import { usePLDClientes } from './usePLDClientes';

interface Props { onBack?: () => void; }

const EMPTY: AlertaPLD = {
  id: 0, noAlerta: '', fechaCreacion: '', cliente: '', tipoAlerta: 'Relevante',
  estatus: 'Pendiente', usuarioAsignado: '', resultado: 'Pendiente',
  enviadoCNBV: 'No', monto: '', descripcion: '',
};

function tipeBadge(t: string) {
  if (t === 'Relevante') return 'bg-red-50 text-red-700 border border-red-200';
  if (t === 'Inusual')   return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
  return 'bg-orange-50 text-orange-700 border border-orange-200';
}
function statBadge(s: string) {
  if (s === 'Atendida')    return 'bg-green-50 text-green-700 border border-green-200';
  if (s === 'En Análisis') return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (s === 'Enviada')     return 'bg-purple-50 text-purple-700 border border-purple-200';
  return 'bg-gray-100 text-gray-600 border border-gray-300';
}

export function PLDAlertasPLD({ onBack }: Props) {
  const { alertas, loading: loadingAlertas, save: saveAlerta, remove: removeAlerta } = usePLDAlertas();
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroEstatus, setFiltroEstatus] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [modal, setModal] = useState<'nuevo' | 'editar' | 'ver' | null>(null);
  const [current, setCurrent] = useState<AlertaPLD>({ ...EMPTY });

  const { clientes: clientesDB } = usePLDClientes();
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDrop, setShowClienteDrop] = useState(false);
  const clientesFiltrados = useMemo(() => {
    if (!clienteSearch) return clientesDB.slice(0, 8);
    const q = clienteSearch.toLowerCase();
    return clientesDB.filter(c => c.nombre.toLowerCase().includes(q) || c.rfc.toLowerCase().includes(q)).slice(0, 8);
  }, [clienteSearch, clientesDB]);

  const filtered = alertas.filter(a => {
    if (filtroTipo !== 'Todos' && a.tipoAlerta !== filtroTipo) return false;
    if (filtroEstatus !== 'Todos' && a.estatus !== filtroEstatus) return false;
    if (busqueda && !a.cliente.toLowerCase().includes(busqueda.toLowerCase()) && !a.noAlerta.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paged = filtered.slice((page - 1) * perPage, page * perPage);


  const openNew = () => {
    const ts = Date.now();
    setCurrent({ ...EMPTY, id: 0, noAlerta: `ALR-${ts}`, fechaCreacion: new Date().toLocaleDateString('es-MX'), usuarioAsignado: 'admin' });
    setClienteSearch('');
    setModal('nuevo');
  };
  const openEdit = (a: AlertaPLD) => { setCurrent({ ...a }); setClienteSearch(''); setModal('editar'); };
  const openView = (a: AlertaPLD) => { setCurrent({ ...a }); setModal('ver'); };

  const handleSave = async () => {
    if (!current.cliente.trim()) { toast.error('El campo Cliente es obligatorio'); return; }
    await saveAlerta(current);
    toast.success(modal === 'nuevo' ? 'Alerta creada' : 'Alerta actualizada', { description: current.noAlerta });
    setModal(null);
  };

  const handleDelete = async (id: number) => {
    await removeAlerta(id);
    toast.success('Alerta eliminada');
    setModal(null);
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            <h2 className="text-lg text-gray-800">Alertas PLD Generadas</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span>Lista</span>
            <span className="cursor-pointer hover:text-[#0066CC] transition-colors" onClick={openNew}>Nueva Alerta</span>
          </div>
        </div>
      </div>

      {/* Ver bar */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[260px]">
              <option>Vista general de Alertas PLD</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
          </div>
          <button onClick={openNew} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">+ Nueva Alerta</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 font-medium">Filtros</span>
            <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded bg-white">
              <option value="Todos">Tipo: Todos</option>
              <option>Relevante</option><option>Inusual</option><option>Preocupante</option>
            </select>
            <select value={filtroEstatus} onChange={e => { setFiltroEstatus(e.target.value); setPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded bg-white">
              <option value="Todos">Estatus: Todos</option>
              <option>Pendiente</option><option>En Análisis</option><option>Atendida</option><option>Enviada</option>
            </select>
          </div>
          <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1); }} placeholder="Buscar por cliente o No. Alerta..." className="px-3 py-1 border border-gray-400 rounded text-sm w-72 transition-all" />
        </div>
      </div>

      {/* Export / sort bar */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {['CSV','XLS','PDF','IMP'].map((t, i) => {
              const fills = ['#6B7280','#1D9F5B','#D32F2F','#1976D2'];
              return (
                <button key={t} onClick={() => toast.info(`Exportar ${t}`)}
                  className={`p-1.5 rounded transition-colors hover:scale-110 transform ${i===1?'hover:bg-green-100':i===2?'hover:bg-red-100':i===3?'hover:bg-blue-100':'hover:bg-gray-200'}`} title={t}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill={fills[i]}/><text x="10" y="13.5" fontSize="6" fontWeight="bold" textAnchor="middle" fill="white">{t}</text></svg>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span className="font-medium">Total: {filtered.length}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="p-0.5 text-[#0066CC] disabled:opacity-40">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="p-0.5 text-[#0066CC] disabled:opacity-40">
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
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">No. Alerta</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Fecha</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Cliente</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Tipo</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Monto</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Estatus</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Usuario</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">CNBV</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">Sin alertas que coincidan</td></tr>
              ) : paged.map((a, idx) => (
                <tr key={a.id} className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    <span className="text-[#0066CC] cursor-pointer hover:underline" onClick={() => openEdit(a)}>Editar</span>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="text-[#0066CC] cursor-pointer hover:underline" onClick={() => openView(a)}>Ver</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#0066CC]" style={{ fontWeight: 500 }}>{a.noAlerta}</td>
                  <td className="px-3 py-2.5 text-xs">{a.fechaCreacion}</td>
                  <td className="px-3 py-2.5 text-xs max-w-[180px] truncate">{a.cliente}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${tipeBadge(a.tipoAlerta)}`} style={{ fontWeight: 500 }}>{a.tipoAlerta}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono">{a.monto}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${statBadge(a.estatus)}`}>{a.estatus}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{a.usuarioAsignado}</td>
                  <td className="px-3 py-2.5 text-xs text-center">
                    {a.enviadoCNBV === 'Sí' ? <span className="text-green-700" style={{ fontWeight: 700 }}>&#x2713;</span> : <span className="text-gray-400">—</span>}
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

            {/* Modal header */}
            <div className="bg-[#4A6FA5] px-6 py-4 rounded-t flex items-center justify-between flex-shrink-0">
              <h3 className="text-base text-white" style={{ fontWeight: 500 }}>
                {modal === 'nuevo' ? 'Nueva Alerta PLD' : modal === 'editar' ? `Editar Alerta — ${current.noAlerta}` : `Detalle Alerta — ${current.noAlerta}`}
              </h3>
              <button onClick={() => setModal(null)} className="text-white/80 hover:text-white text-xl leading-none">&times;</button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {/* Sección info */}
              <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded">
                <div className="text-xs text-gray-700 mb-3" style={{ fontWeight: 600 }}>INFORMACIÓN DE LA ALERTA</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>No. ALERTA</label>
                    <div className={viewCls}>{current.noAlerta}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>FECHA</label>
                    {isView ? <div className={viewCls}>{current.fechaCreacion}</div>
                      : <DatePicker value={current.fechaCreacion} onChange={v => setCurrent(c => ({ ...c, fechaCreacion: v }))} />}
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
                    <label className={labelCls}>MONTO</label>
                    {isView ? <div className={viewCls}>{current.monto}</div>
                      : <input type="text" value={current.monto} onChange={e => setCurrent(c => ({ ...c, monto: e.target.value }))} className={inputCls} placeholder="$0.00" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>TIPO ALERTA</label>
                    {isView ? <div className={viewCls}>{current.tipoAlerta}</div>
                      : <select value={current.tipoAlerta} onChange={e => setCurrent(c => ({ ...c, tipoAlerta: e.target.value }))} className={inputCls}>
                          <option>Relevante</option><option>Inusual</option><option>Preocupante</option>
                        </select>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>ESTATUS</label>
                    {isView ? <div className={viewCls}>{current.estatus}</div>
                      : <select value={current.estatus} onChange={e => setCurrent(c => ({ ...c, estatus: e.target.value }))} className={inputCls}>
                          <option>Pendiente</option><option>En Análisis</option><option>Atendida</option><option>Enviada</option>
                        </select>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>USUARIO</label>
                    {isView ? <div className={viewCls}>{current.usuarioAsignado}</div>
                      : <input type="text" value={current.usuarioAsignado} onChange={e => setCurrent(c => ({ ...c, usuarioAsignado: e.target.value }))} className={inputCls} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>ENVIADO CNBV</label>
                    {isView ? <div className={viewCls}>{current.enviadoCNBV}</div>
                      : <select value={current.enviadoCNBV} onChange={e => setCurrent(c => ({ ...c, enviadoCNBV: e.target.value }))} className={inputCls}>
                          <option>No</option><option>Sí</option>
                        </select>}
                  </div>
                </div>
              </div>

              {/* Resultado / Descripción */}
              <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded">
                <div className="text-xs text-gray-700 mb-3" style={{ fontWeight: 600 }}>RESULTADO Y DESCRIPCIÓN</div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>RESULTADO</label>
                    {isView ? <div className={viewCls}>{current.resultado}</div>
                      : <input type="text" value={current.resultado} onChange={e => setCurrent(c => ({ ...c, resultado: e.target.value }))} className={inputCls} />}
                  </div>
                  <div className="flex items-start gap-2">
                    <label className={`${labelCls} pt-1`}>DESCRIPCIÓN</label>
                    {isView ? <div className={`${viewCls} min-h-[56px]`}>{current.descripcion || '—'}</div>
                      : <textarea value={current.descripcion} onChange={e => setCurrent(c => ({ ...c, descripcion: e.target.value }))} className={`${inputCls} h-16 resize-none`} placeholder="Describa la alerta..." />}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b flex items-center justify-between flex-shrink-0">
              <div>
                {modal === 'editar' && (
                  <button onClick={() => handleDelete(current.id)} className="px-4 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">Eliminar</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isView && (
                  <button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white text-sm rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}>
                    {modal === 'nuevo' ? 'Crear Alerta' : 'Guardar Cambios'}
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
