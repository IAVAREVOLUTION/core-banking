import { useState } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import * as store from './pldStore';
import type { AlertaInterna } from './pldStore';

interface Props { onBack?: () => void; }

const EMPTY: AlertaInterna = {
  id: 0, noAlerta: '', fecha: '', cliente: '', tipo: 'Relevante',
  estatus: 'Pendiente', descripcion: '', resultado: 'Pendiente',
};

export function PLDAlertasInternas({ onBack }: Props) {
  const [alertas, setAlertas] = useState(store.getAlertasInternas);
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroEstatus, setFiltroEstatus] = useState('Todos');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [modal, setModal] = useState<'nuevo' | 'editar' | 'ver' | null>(null);
  const [current, setCurrent] = useState<AlertaInterna>({ ...EMPTY });

  const filtered = alertas.filter(a => {
    if (filtroTipo !== 'Todos' && a.tipo !== filtroTipo) return false;
    if (filtroEstatus !== 'Todos' && a.estatus !== filtroEstatus) return false;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const persist = (list: AlertaInterna[]) => { setAlertas(list); store.saveAlertasInternas(list); };

  const openNew = () => {
    const id = alertas.length > 0 ? Math.max(...alertas.map(a => a.id)) + 1 : 1;
    setCurrent({ ...EMPTY, id, noAlerta: `AI-2026-${String(id).padStart(3, '0')}`, fecha: new Date().toLocaleDateString('es-MX') });
    setModal('nuevo');
  };
  const openEdit = (a: AlertaInterna) => { setCurrent({ ...a }); setModal('editar'); };
  const openView = (a: AlertaInterna) => { setCurrent({ ...a }); setModal('ver'); };

  const handleSave = () => {
    if (!current.cliente.trim()) { toast.error('El campo Cliente es obligatorio'); return; }
    if (modal === 'nuevo') {
      persist([current, ...alertas]);
      toast.success('Alerta interna creada', { description: current.noAlerta });
    } else {
      persist(alertas.map(a => a.id === current.id ? current : a));
      toast.success('Alerta actualizada');
    }
    setModal(null);
  };

  const handleDelete = (id: number) => {
    persist(alertas.filter(a => a.id !== id));
    toast.success('Alerta eliminada');
    setModal(null);
  };

  const isView = modal === 'ver';
  const labelCls = 'text-xs w-24 flex-shrink-0 text-gray-700';
  const inputCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white';
  const viewCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600';

  return (
    <div className="bg-[#F5F5F5] min-h-full">
      {/* Header */}
      <div className="bg-white px-6 py-3 border-b border-gray-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#4A6FA5" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 7v3M10 13h.01"/></svg>
          <h1 className="text-sm text-gray-800" style={{ fontWeight: 700 }}>Alertas Internas PLD</h1>
          <span className="text-xs text-gray-500">({filtered.length} registros)</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openNew} className="px-4 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB]">+ Nueva</button>
          <button onClick={onBack} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Volver</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white px-6 py-3 border-b border-gray-300 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Tipo:</label>
          <select value={filtroTipo} onChange={e=>{setFiltroTipo(e.target.value);setPage(1);}} className="px-2 py-1 text-xs border border-gray-300 rounded">
            <option>Todos</option><option>Relevante</option><option>Inusual</option><option>Preocupante</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Estatus:</label>
          <select value={filtroEstatus} onChange={e=>{setFiltroEstatus(e.target.value);setPage(1);}} className="px-2 py-1 text-xs border border-gray-300 rounded">
            <option>Todos</option><option>Pendiente</option><option>En Revisión</option><option>Atendida</option><option>Archivada</option>
          </select>
        </div>
        <button onClick={()=>{setFiltroTipo('Todos');setFiltroEstatus('Todos');setPage(1);}} className="px-3 py-1 text-xs border border-gray-400 text-gray-600 rounded hover:bg-gray-50">Limpiar</button>
      </div>

      {/* Barra exportación */}
      <div className="bg-white px-6 py-1.5 border-b border-gray-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {['pdf','xls','csv'].map(t=>(
            <button key={t} onClick={()=>toast.info(`Exportar ${t.toUpperCase()}`)} className="text-gray-500 hover:text-gray-700" title={t.toUpperCase()}>
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
                {['No. Alerta','Fecha','Cliente','Tipo','Descripción','Estatus','Resultado','Acciones'].map(h=>(
                  <th key={h} className="px-2 py-2 text-left text-[10px] border-r border-gray-300 last:border-r-0" style={{fontWeight:600}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length===0?(
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin alertas internas</td></tr>
              ):paged.map((a,i)=>(
                <tr key={a.id} style={{backgroundColor:i%2===1?'#EEEEEE':'#FFFFFF'}}>
                  <td className="px-2 py-1.5 border-r border-gray-200 text-[#0066CC]" style={{fontWeight:500}}>{a.noAlerta}</td>
                  <td className="px-2 py-1.5 border-r border-gray-200">{a.fecha}</td>
                  <td className="px-2 py-1.5 border-r border-gray-200">{a.cliente}</td>
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${a.tipo==='Relevante'?'bg-red-100 text-red-700':a.tipo==='Inusual'?'bg-yellow-100 text-yellow-700':'bg-orange-100 text-orange-700'}`} style={{fontWeight:500}}>{a.tipo}</span>
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-200 max-w-[200px] truncate">{a.descripcion}</td>
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${a.estatus==='Pendiente'?'bg-gray-100 text-gray-700':a.estatus==='En Revisión'?'bg-blue-100 text-blue-700':a.estatus==='Atendida'?'bg-green-100 text-green-700':'bg-purple-100 text-purple-700'}`}>{a.estatus}</span>
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-200">{a.resultado}</td>
                  <td className="px-2 py-1.5 text-center whitespace-nowrap">
                    <span className="text-[#0066CC] cursor-pointer hover:underline text-[10px]" onClick={()=>openEdit(a)}>Editar</span>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="text-[#0066CC] cursor-pointer hover:underline text-[10px]" onClick={()=>openView(a)}>Ver</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Paginación */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-gray-500">Mostrando {Math.min(((page-1)*perPage)+1,filtered.length)}-{Math.min(page*perPage,filtered.length)} de {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={()=>setPage(1)} disabled={page===1} className="px-2 py-1 text-[10px] border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">&laquo;</button>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-2 py-1 text-[10px] border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">&lsaquo;</button>
            <span className="px-3 py-1 text-[10px] bg-[#4A6FA5] text-white rounded">{page}</span>
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-2 py-1 text-[10px] border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">&rsaquo;</button>
            <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2 py-1 text-[10px] border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">&raquo;</button>
          </div>
        </div>
      </div>

      {/* ══════ MODAL ══════ */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={()=>setModal(null)}>
          <div className="bg-white rounded shadow-lg w-[600px] max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#4A6FA5] px-4 py-2.5 rounded-t flex items-center justify-between">
              <h3 className="text-sm text-white" style={{fontWeight:600}}>
                {modal==='nuevo'?'Nueva Alerta Interna':modal==='editar'?`Editar ${current.noAlerta}`:`Detalle ${current.noAlerta}`}
              </h3>
              <button onClick={()=>setModal(null)} className="text-white/80 hover:text-white text-lg">&times;</button>
            </div>
            <div className="p-5">
              <div className="bg-[#D9E2F3] px-3 py-2 mb-4 text-xs text-gray-800 border-l-4 border-[#4A6FA5]" style={{fontWeight:500}}>Información de la Alerta</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
                <div className="flex items-center gap-2"><label className={labelCls}>No. ALERTA</label><div className={viewCls}>{current.noAlerta}</div></div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>FECHA</label>
                  {isView?<div className={viewCls}>{current.fecha}</div>:
                    <DatePicker value={current.fecha} onChange={v=>setCurrent(c=>({...c,fecha:v}))} />
                  }
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>CLIENTE <span className="text-red-600">*</span></label>
                  {isView?<div className={viewCls}>{current.cliente}</div>:
                    <input type="text" value={current.cliente} onChange={e=>setCurrent(c=>({...c,cliente:e.target.value}))} className={inputCls} placeholder="Nombre del cliente..." />
                  }
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>TIPO</label>
                  {isView?<div className={viewCls}>{current.tipo}</div>:
                    <select value={current.tipo} onChange={e=>setCurrent(c=>({...c,tipo:e.target.value}))} className={inputCls}>
                      <option>Relevante</option><option>Inusual</option><option>Preocupante</option>
                    </select>
                  }
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>ESTATUS</label>
                  {isView?<div className={viewCls}>{current.estatus}</div>:
                    <select value={current.estatus} onChange={e=>setCurrent(c=>({...c,estatus:e.target.value}))} className={inputCls}>
                      <option>Pendiente</option><option>En Revisión</option><option>Atendida</option><option>Archivada</option>
                    </select>
                  }
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>RESULTADO</label>
                  {isView?<div className={viewCls}>{current.resultado}</div>:
                    <input type="text" value={current.resultado} onChange={e=>setCurrent(c=>({...c,resultado:e.target.value}))} className={inputCls} />
                  }
                </div>
              </div>
              <div className="flex items-start gap-2">
                <label className={`${labelCls} pt-1`}>DESCRIPCIÓN</label>
                {isView?<div className={`${viewCls} min-h-[48px]`}>{current.descripcion||'—'}</div>:
                  <textarea value={current.descripcion} onChange={e=>setCurrent(c=>({...c,descripcion:e.target.value}))} className={`${inputCls} h-16 resize-none`} placeholder="Describa la alerta..." />
                }
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
              <div>{modal==='editar'&&<button onClick={()=>handleDelete(current.id)} className="px-4 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700">Eliminar</button>}</div>
              <div className="flex items-center gap-2">
                {!isView&&<button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB]">{modal==='nuevo'?'Crear':'Guardar'}</button>}
                <button onClick={()=>setModal(null)} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">{isView?'Cerrar':'Cancelar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
