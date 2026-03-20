import { useState } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import * as store from './pldStore';
import type { ReporteCNBV } from './pldStore';

interface Props { onBack?: () => void; }

const EMPTY: ReporteCNBV = {
  id: 0, folio: '', fecha: '', tipo: 'Operación Relevante',
  cliente: '', monto: '', estatus: 'Pendiente', enviado: 'No',
};

export function PLDReportesCNBV({ onBack }: Props) {
  const [reportes, setReportes] = useState(store.getReportes);
  const [filtros, setFiltros] = useState({ fechaInicio: '01/01/2026', fechaFin: '12/02/2026', tipoReporte: 'Todos', estatusValidacion: 'Todos', cliente: '' });
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modal state
  const [modal, setModal] = useState<'nuevo' | 'editar' | 'ver' | null>(null);
  const [current, setCurrent] = useState<ReporteCNBV>({ ...EMPTY });

  const filtered = reportes.filter(r => {
    if (filtros.tipoReporte !== 'Todos' && r.tipo !== filtros.tipoReporte) return false;
    if (filtros.estatusValidacion !== 'Todos' && r.estatus !== filtros.estatusValidacion) return false;
    if (filtros.cliente && !r.cliente.toLowerCase().includes(filtros.cliente.toLowerCase())) return false;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const persist = (list: ReporteCNBV[]) => { setReportes(list); store.saveReportes(list); };

  const openNew = () => {
    const id = reportes.length > 0 ? Math.max(...reportes.map(r => r.id)) + 1 : 1;
    setCurrent({
      ...EMPTY,
      id,
      folio: `REP-CNBV-2026-${String(id).padStart(3, '0')}`,
      fecha: new Date().toLocaleDateString('es-MX'),
    });
    setModal('nuevo');
  };

  const openEdit = (r: ReporteCNBV) => { setCurrent({ ...r }); setModal('editar'); };
  const openView = (r: ReporteCNBV) => { setCurrent({ ...r }); setModal('ver'); };

  const handleSave = () => {
    if (!current.cliente.trim()) { toast.error('El campo Cliente es obligatorio'); return; }
    if (!current.monto.trim()) { toast.error('El campo Monto es obligatorio'); return; }
    if (modal === 'nuevo') {
      persist([current, ...reportes]);
      toast.success('Reporte generado', { description: current.folio });
    } else {
      persist(reportes.map(r => r.id === current.id ? current : r));
      toast.success('Reporte actualizado', { description: current.folio });
    }
    setModal(null);
  };

  const handleDelete = (id: number) => {
    persist(reportes.filter(r => r.id !== id));
    toast.success('Reporte eliminado');
    setModal(null);
  };

  const handleValidar = (r: ReporteCNBV) => {
    const updated = reportes.map(rep => rep.id === r.id ? { ...rep, estatus: 'Validado' } : rep);
    persist(updated);
    if (modal === 'ver') setCurrent(c => ({ ...c, estatus: 'Validado' }));
    toast.success('Reporte validado', { description: r.folio });
  };

  const handleEnviar = (r: ReporteCNBV) => {
    if (r.estatus !== 'Validado') { toast.error('Debe validar el reporte antes de enviarlo'); return; }
    const updated = reportes.map(rep => rep.id === r.id ? { ...rep, enviado: 'Sí' } : rep);
    persist(updated);
    if (modal === 'ver') setCurrent(c => ({ ...c, enviado: 'Sí' }));
    toast.success('Reporte enviado a CNBV', { description: r.folio });
  };

  const isView = modal === 'ver';
  const labelCls = 'text-xs w-28 flex-shrink-0 text-gray-700';
  const inputCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white';
  const viewCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600';

  return (
    <div className="bg-[#F5F5F5] min-h-full">
      {/* Header */}
      <div className="bg-white px-6 py-3 border-b border-gray-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#4A6FA5" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="1"/><path d="M7 3v14M13 3v14M3 7h14M3 13h14"/></svg>
          <h1 className="text-sm text-gray-800" style={{ fontWeight: 700 }}>Reportes CNBV</h1>
          <span className="text-xs text-gray-500">({filtered.length} registros)</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openNew} className="px-4 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB]">+ Generar Reporte</button>
          <button onClick={() => toast.info('Exportando formato CNBV...')} className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs rounded hover:bg-[#3a5a8a]">Exportar</button>
          <button onClick={onBack} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Volver</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white px-6 py-3 border-b border-gray-300">
        <div className="grid grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <label className={labelCls}>FECHA INICIO</label>
            <DatePicker value={filtros.fechaInicio} onChange={v => setFiltros(f => ({ ...f, fechaInicio: v }))} />
          </div>
          <div className="flex items-center gap-2">
            <label className={labelCls}>FECHA FIN</label>
            <DatePicker value={filtros.fechaFin} onChange={v => setFiltros(f => ({ ...f, fechaFin: v }))} />
          </div>
          <div className="flex items-center gap-2">
            <label className={labelCls}>TIPO</label>
            <select value={filtros.tipoReporte} onChange={e => { setFiltros(f => ({ ...f, tipoReporte: e.target.value })); setPage(1); }} className={inputCls}>
              <option>Todos</option><option>Operación Relevante</option><option>Operación Inusual</option><option>Operación Preocupante</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className={labelCls}>ESTATUS</label>
            <select value={filtros.estatusValidacion} onChange={e => { setFiltros(f => ({ ...f, estatusValidacion: e.target.value })); setPage(1); }} className={inputCls}>
              <option>Todos</option><option>Validado</option><option>Pendiente</option><option>En Revisión</option>
            </select>
          </div>
        </div>
      </div>

      {/* Barra exportación */}
      <div className="bg-white px-6 py-1.5 border-b border-gray-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {['pdf', 'xls', 'csv'].map(t => (
            <button key={t} onClick={() => toast.info(`Exportar ${t.toUpperCase()}`)} className="text-gray-500 hover:text-gray-700" title={t.toUpperCase()}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="2" y="1" width="10" height="12" rx="1"/><path d="M5 4h4M5 7h4M5 10h2"/></svg>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-gray-500">Ordenar: <button className="hover:text-gray-700">Fecha ↓</button></div>
      </div>

      {/* Tabla */}
      <div className="px-6 py-4">
        <div className="border border-gray-300 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#D0D0D0]">
                {['Folio', 'Fecha', 'Tipo', 'Cliente', 'Monto', 'Estatus', 'Enviado', 'Acciones'].map(h => (
                  <th key={h} className="px-2 py-2 text-left text-[10px] border-r border-gray-300 last:border-r-0" style={{ fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin reportes</td></tr>
              ) : paged.map((r, i) => (
                <tr key={r.id} style={{ backgroundColor: i % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}>
                  <td className="px-2 py-1.5 border-r border-gray-200 text-[#0066CC]" style={{ fontWeight: 500 }}>{r.folio}</td>
                  <td className="px-2 py-1.5 border-r border-gray-200">{r.fecha}</td>
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${r.tipo.includes('Relevante') ? 'bg-blue-100 text-blue-700' : r.tipo.includes('Inusual') ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{r.tipo}</span>
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-200">{r.cliente}</td>
                  <td className="px-2 py-1.5 border-r border-gray-200" style={{ fontWeight: 500 }}>{r.monto}</td>
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${r.estatus === 'Validado' ? 'bg-green-100 text-green-700' : r.estatus === 'Pendiente' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{r.estatus}</span>
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                    {r.enviado === 'Sí' ? <span className="text-green-600" style={{ fontWeight: 600 }}>&#x2713;</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center whitespace-nowrap">
                    <span className="text-[#0066CC] cursor-pointer hover:underline text-[10px]" onClick={() => openEdit(r)}>Editar</span>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="text-[#0066CC] cursor-pointer hover:underline text-[10px]" onClick={() => openView(r)}>Ver</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Paginación */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-gray-500">Mostrando {Math.min(((page - 1) * perPage) + 1, filtered.length)}-{Math.min(page * perPage, filtered.length)} de {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-[10px] border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">&laquo;</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-[10px] border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">&lsaquo;</button>
            <span className="px-3 py-1 text-[10px] bg-[#4A6FA5] text-white rounded">{page}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 text-[10px] border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">&rsaquo;</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-[10px] border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">&raquo;</button>
          </div>
        </div>
      </div>

      {/* ══════ MODAL Nuevo / Editar / Ver ══════ */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded shadow-lg w-[680px] max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="bg-[#4A6FA5] px-4 py-2.5 rounded-t flex items-center justify-between">
              <h3 className="text-sm text-white" style={{ fontWeight: 600 }}>
                {modal === 'nuevo' ? 'Generar Nuevo Reporte CNBV' : modal === 'editar' ? `Editar Reporte ${current.folio}` : `Detalle Reporte ${current.folio}`}
              </h3>
              <button onClick={() => setModal(null)} className="text-white/80 hover:text-white text-lg">&times;</button>
            </div>

            <div className="p-5">
              {/* Sección principal */}
              <div className="bg-[#D9E2F3] px-3 py-2 mb-4 text-xs text-gray-800 border-l-4 border-[#4A6FA5]" style={{ fontWeight: 500 }}>
                Información del Reporte
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <label className={labelCls}>FOLIO</label>
                  <div className={viewCls}>{current.folio}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>FECHA</label>
                  {isView ? (
                    <div className={viewCls}>{current.fecha}</div>
                  ) : (
                    <DatePicker value={current.fecha} onChange={v => setCurrent(c => ({ ...c, fecha: v }))} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>TIPO <span className="text-red-600">*</span></label>
                  {isView ? <div className={viewCls}>{current.tipo}</div> : (
                    <select value={current.tipo} onChange={e => setCurrent(c => ({ ...c, tipo: e.target.value }))} className={inputCls}>
                      <option>Operación Relevante</option>
                      <option>Operación Inusual</option>
                      <option>Operación Preocupante</option>
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>CLIENTE <span className="text-red-600">*</span></label>
                  {isView ? <div className={viewCls}>{current.cliente}</div> : (
                    <input type="text" value={current.cliente} onChange={e => setCurrent(c => ({ ...c, cliente: e.target.value }))} className={inputCls} placeholder="Nombre del cliente..." />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>MONTO <span className="text-red-600">*</span></label>
                  {isView ? <div className={viewCls}>{current.monto}</div> : (
                    <input type="text" value={current.monto} onChange={e => setCurrent(c => ({ ...c, monto: e.target.value }))} className={inputCls} placeholder="$0.00" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>ESTATUS</label>
                  {isView ? (
                    <div className={`${viewCls} ${current.estatus === 'Validado' ? 'bg-green-100 text-green-700 border-green-300' : current.estatus === 'Pendiente' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : ''}`} style={{ fontWeight: 500 }}>
                      {current.estatus}
                    </div>
                  ) : (
                    <select value={current.estatus} onChange={e => setCurrent(c => ({ ...c, estatus: e.target.value }))} className={inputCls}>
                      <option>Pendiente</option>
                      <option>En Revisión</option>
                      <option>Validado</option>
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>ENVIADO CNBV</label>
                  {isView ? (
                    <div className={`${viewCls} ${current.enviado === 'Sí' ? 'bg-green-100 text-green-700 border-green-300' : ''}`} style={{ fontWeight: 500 }}>
                      {current.enviado}
                    </div>
                  ) : (
                    <select value={current.enviado} onChange={e => setCurrent(c => ({ ...c, enviado: e.target.value }))} className={inputCls}>
                      <option>No</option>
                      <option>Sí</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Acciones rápidas (solo en modo Ver) */}
              {isView && (
                <div className="bg-gray-50 border border-gray-200 rounded p-3">
                  <div className="text-[10px] text-gray-600 mb-2" style={{ fontWeight: 600 }}>ACCIONES DISPONIBLES</div>
                  <div className="flex items-center gap-2">
                    {current.estatus !== 'Validado' && (
                      <button onClick={() => handleValidar(current)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700">Validar Campos</button>
                    )}
                    {current.enviado !== 'Sí' && current.estatus === 'Validado' && (
                      <button onClick={() => handleEnviar(current)} className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700">Enviar a CNBV</button>
                    )}
                    <button onClick={() => toast.info('Descargando archivo XML...')} className="px-3 py-1.5 bg-[#4A6FA5] text-white text-xs rounded hover:bg-[#3a5a8a]">Descargar XML</button>
                    {current.estatus === 'Validado' && current.enviado === 'Sí' && (
                      <span className="text-[10px] text-green-600 ml-2" style={{ fontWeight: 500 }}>Reporte completado y enviado</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
              <div>
                {modal === 'editar' && (
                  <button onClick={() => handleDelete(current.id)} className="px-4 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700">Eliminar</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isView && (
                  <button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB]">
                    {modal === 'nuevo' ? 'Generar Reporte' : 'Guardar Cambios'}
                  </button>
                )}
                <button onClick={() => setModal(null)} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">
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
