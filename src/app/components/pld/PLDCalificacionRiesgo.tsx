import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { CalificacionData } from './pldStore';
import { usePLDCalificaciones } from './usePLDData';
import { usePLDClientes } from './usePLDClientes';

interface Props { onBack?: () => void; }

const RIESGO_BADGE: Record<string, string> = {
  'Bajo':  'bg-green-50 text-green-700 border border-green-200',
  'Medio': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  'Alto':  'bg-red-50 text-red-700 border border-red-200',
};

type ViewMode = 'list' | 'detail';

export function PLDCalificacionRiesgo({ onBack }: Props) {
  const [view, setView] = useState<ViewMode>('list');
  const { calificaciones, loading: loadingCal, save: saveCalificacion, remove: removeCalificacion } = usePLDCalificaciones();
  const [selectedData, setSelectedData] = useState<CalificacionData | null>(null);
  const { clientes: clientesDB, loading: loadingClientes } = usePLDClientes();

  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRiesgo, setFilterRiesgo] = useState('');

  const filtered = useMemo(() => {
    let r = calificaciones;
    if (searchTerm) { const q = searchTerm.toLowerCase(); r = r.filter(c => c.nombreCliente.toLowerCase().includes(q) || (c.clienteRFC||'').toLowerCase().includes(q) || c.noCliente.toLowerCase().includes(q)); }
    if (filterRiesgo) r = r.filter(c => c.nivelRiesgo === filterRiesgo);
    return r;
  }, [calificaciones, searchTerm, filterRiesgo]);

  const filteredClientes = useMemo(() => {
    const base = clientesDB;
    if (!clienteSearch) return base;
    const q = clienteSearch.toLowerCase();
    return base.filter(c => c.nombre.toLowerCase().includes(q) || c.rfc.toLowerCase().includes(q));
  }, [clienteSearch, clientesDB]);

  const handleOpenDetail = (cal: CalificacionData) => { setSelectedData({ ...cal }); setView('detail'); };

  const handleSelectCliente = (c: typeof clientesDB[0]) => {
    const existing = calificaciones.find(cal => cal.clienteId === c.id);
    setSelectedData(existing ? { ...existing } : {
      clienteId: c.id, noCliente: `CLI-${String(c.id).padStart(3,'0')}`,
      nombreCliente: c.nombre, clienteRFC: c.rfc, clientePersonalidad: c.personalidad,
      clienteSucursal: c.sucursal, fechaCalificacion: '',
      actividadEconomica: 0, residencia: 0, nacionalidad: 0, tipoPersona: 0,
      pepListasNegras: 0, calificacionTotal: 0, nivelRiesgo: '',
    });
    setShowClienteModal(false);
    setClienteSearch('');
    setView('detail');
  };

  const handleCalcular = () => {
    if (!selectedData) return;
    const total = (selectedData.actividadEconomica*0.25)+(selectedData.residencia*0.15)+(selectedData.nacionalidad*0.15)+(selectedData.tipoPersona*0.20)+(selectedData.pepListasNegras*0.25);
    const nivel = total >= 70 ? 'Alto' : total >= 40 ? 'Medio' : 'Bajo';
    const now = new Date();
    const fechaHoy = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;
    setSelectedData(d => d ? { ...d, calificacionTotal: parseFloat(total.toFixed(2)), nivelRiesgo: nivel, fechaCalificacion: fechaHoy } : d);
    toast.success('Riesgo calculado', { description: `Calificación: ${total.toFixed(2)} — ${nivel}` });
  };

  const handleGuardar = async () => {
    if (!selectedData) return;
    if (!selectedData.nivelRiesgo) { toast.error('Calcule el riesgo antes de guardar'); return; }
    await saveCalificacion(selectedData);
    toast.success('Calificación guardada', { description: `${selectedData.nombreCliente} — ${selectedData.nivelRiesgo}` });
    setView('list');
    setSelectedData(null);
  };

  const labelCls = 'text-xs w-32 flex-shrink-0 text-gray-700';
  const disabledCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600';

  // ── LISTA ──
  if (view === 'list') {
    return (
      <div className="bg-white min-h-full">

        {/* Header */}
        <div className="bg-white px-4 py-3 border-b border-gray-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <h2 className="text-lg text-gray-800">Calificación de Riesgo PLD</h2>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-700">
              <span>Lista</span>
              <span className="cursor-pointer hover:text-[#0066CC] transition-colors" onClick={() => { setShowClienteModal(true); setClienteSearch(''); }}>Nueva Calificación</span>
            </div>
          </div>
        </div>

        {/* Ver bar */}
        <div className="px-4 py-2 bg-white border-b border-gray-300">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Ver</span>
            <div className="relative">
              <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[280px]">
                <option>Vista general de Calificación de Riesgo</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
            </div>
            <button onClick={() => { setShowClienteModal(true); setClienteSearch(''); }} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">+ Nueva Calificación</button>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 font-medium">Filtros</span>
              <select value={filterRiesgo} onChange={e => setFilterRiesgo(e.target.value)} className="px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                <option value="">Riesgo: Todos</option>
                <option>Bajo</option><option>Medio</option><option>Alto</option>
              </select>
              {(filterRiesgo || searchTerm) && <button onClick={() => { setFilterRiesgo(''); setSearchTerm(''); }} className="text-xs text-[#0066CC] hover:underline">Limpiar</button>}
            </div>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por nombre, RFC, No. Cliente..." className="px-3 py-1 border border-gray-400 rounded text-sm w-72 transition-all" />
          </div>
        </div>

        {/* Export bar */}
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {['CSV','XLS','PDF'].map((t, i) => {
                const fills = ['#6B7280','#1D9F5B','#D32F2F'];
                return (
                  <button key={t} className={`p-1.5 rounded transition-colors hover:scale-110 transform ${i===1?'hover:bg-green-100':i===2?'hover:bg-red-100':'hover:bg-gray-200'}`} title={t}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill={fills[i]}/><text x="10" y="13.5" fontSize="6" fontWeight="bold" textAnchor="middle" fill="white">{t}</text></svg>
                  </button>
                );
              })}
            </div>
            <span className="text-sm text-gray-700 font-medium">Total: {filtered.length}</span>
          </div>
        </div>

        {/* Tabla */}
        <div className="px-4 py-4">
          <div className="border border-gray-300 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Editar | Ver</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">No. Cliente</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Cliente</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">RFC</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Personalidad</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Calificación</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Nivel Riesgo</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">No se encontraron calificaciones</td></tr>
                ) : filtered.map((cal, idx) => (
                  <tr key={cal.clienteId || idx} className="border-b border-gray-200 transition-colors duration-150"
                    style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      <span className="text-[#0066CC] cursor-pointer hover:underline" onClick={() => handleOpenDetail(cal)}>Editar</span>
                      <span className="text-gray-400 mx-1">|</span>
                      <span className="text-[#0066CC] cursor-pointer hover:underline" onClick={() => handleOpenDetail(cal)}>Ver</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#0066CC]" style={{ fontWeight: 500 }}>{cal.noCliente}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ fontWeight: 500 }}>{cal.nombreCliente}</td>
                    <td className="px-3 py-2.5 text-xs font-mono">{cal.clienteRFC||'—'}</td>
                    <td className="px-3 py-2.5 text-xs">{cal.clientePersonalidad||'—'}</td>
                    <td className="px-3 py-2.5 text-xs text-center" style={{ fontWeight: 600 }}>{cal.calificacionTotal.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {cal.nivelRiesgo
                        ? <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] border ${RIESGO_BADGE[cal.nivelRiesgo]}`} style={{ fontWeight: 500 }}>{cal.nivelRiesgo}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{cal.fechaCalificacion||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal seleccionar cliente */}
        {showClienteModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowClienteModal(false)}>
            <div className="bg-white rounded shadow-xl w-[700px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="bg-[#4A6FA5] px-6 py-4 rounded-t flex items-center justify-between flex-shrink-0">
                <h3 className="text-base text-white" style={{ fontWeight: 500 }}>Seleccionar Cliente para Calificación</h3>
                <button onClick={() => setShowClienteModal(false)} className="text-white/80 hover:text-white text-xl leading-none">&times;</button>
              </div>
              <div className="p-4 flex-shrink-0">
                <input type="text" placeholder="Buscar por nombre o RFC..." value={clienteSearch} onChange={e => setClienteSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-400 rounded" autoFocus />
              </div>
              <div className="flex-1 overflow-auto px-4 pb-2">
                <div className="border border-gray-300 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                        <th className="px-3 py-2 text-left text-xs text-gray-700">Nombre / Razón Social</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-700">RFC</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-700">Personalidad</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-700">Sucursal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingClientes ? (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Cargando clientes...</td></tr>
                      ) : filteredClientes.length === 0 ? (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No se encontraron clientes</td></tr>
                      ) : filteredClientes.map((c, idx) => (
                        <tr key={c.id} onClick={() => handleSelectCliente(c)}
                          className="border-b border-gray-200 cursor-pointer transition-colors duration-150"
                          style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}>
                          <td className="px-3 py-2.5 text-xs" style={{ fontWeight: 500 }}>{c.nombre}</td>
                          <td className="px-3 py-2.5 text-xs font-mono">{c.rfc}</td>
                          <td className="px-3 py-2.5 text-xs">{c.personalidad}</td>
                          <td className="px-3 py-2.5 text-xs">{c.sucursal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                <span className="text-xs text-gray-500">Clic en un cliente para evaluar su riesgo</span>
                <button onClick={() => setShowClienteModal(false)} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-sm rounded hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── DETALLE ──
  if (!selectedData) return null;

  return (
    <div className="bg-white min-h-full">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setView('list'); setSelectedData(null); }} className="text-gray-500 hover:text-gray-700">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4L6 9l5 5"/></svg>
            </button>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <h2 className="text-lg text-gray-800">Calificación — {selectedData.nombreCliente}</h2>
            {selectedData.nivelRiesgo && (
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${RIESGO_BADGE[selectedData.nivelRiesgo]}`} style={{ fontWeight: 500 }}>{selectedData.nivelRiesgo}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCalcular} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-sm rounded hover:bg-gray-50">Calcular Riesgo</button>
            <button onClick={handleGuardar} className="px-5 py-1.5 bg-[#0099CC] text-white text-sm rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}>Guardar</button>
            <button onClick={() => { setView('list'); setSelectedData(null); }} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-sm rounded hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Info cliente */}
        <div className="border border-gray-300">
          <div style={{ backgroundColor: '#D0D0D0' }} className="px-3 py-2 border-b border-gray-300">
            <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>INFORMACIÓN DEL CLIENTE</span>
          </div>
          <div className="p-4 grid grid-cols-3 gap-x-6 gap-y-2">
            <div className="flex items-center gap-2"><label className={labelCls}>No. CLIENTE</label><div className={disabledCls}>{selectedData.noCliente}</div></div>
            <div className="flex items-center gap-2"><label className={labelCls}>CLIENTE</label><div className={disabledCls} style={{ fontWeight: 500 }}>{selectedData.nombreCliente}</div></div>
            <div className="flex items-center gap-2"><label className={labelCls}>RFC</label><div className={`${disabledCls} font-mono`}>{selectedData.clienteRFC||'—'}</div></div>
            <div className="flex items-center gap-2"><label className={labelCls}>PERSONALIDAD</label><div className={disabledCls}>{selectedData.clientePersonalidad||'—'}</div></div>
            <div className="flex items-center gap-2"><label className={labelCls}>SUCURSAL</label><div className={disabledCls}>{selectedData.clienteSucursal||'—'}</div></div>
            <div className="flex items-center gap-2"><label className={labelCls}>FECHA CALIFICACIÓN</label><div className={disabledCls}>{selectedData.fechaCalificacion||'Sin evaluar'}</div></div>
          </div>
        </div>

        {/* Matriz de riesgo */}
        <div className="border border-gray-300">
          <div style={{ backgroundColor: '#D0D0D0' }} className="px-3 py-2 border-b border-gray-300">
            <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>MATRIZ DE RIESGO — PONDERADORES</span>
          </div>
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Factor de Riesgo</th>
                  <th className="px-3 py-2.5 text-center text-xs text-gray-700">Ponderador</th>
                  <th className="px-3 py-2.5 text-center text-xs text-gray-700">Calificación (0–100)</th>
                  <th className="px-3 py-2.5 text-center text-xs text-gray-700">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Actividad Económica', pond: 25, field: 'actividadEconomica' as const, mult: 0.25 },
                  { label: 'Residencia',           pond: 15, field: 'residencia'          as const, mult: 0.15 },
                  { label: 'Nacionalidad',          pond: 15, field: 'nacionalidad'         as const, mult: 0.15 },
                  { label: 'Tipo de Persona',       pond: 20, field: 'tipoPersona'          as const, mult: 0.20 },
                  { label: 'PEP / Listas Negras',   pond: 25, field: 'pepListasNegras'      as const, mult: 0.25 },
                ].map((r, i) => (
                  <tr key={r.field} className="border-b border-gray-200 transition-colors"
                    style={{ backgroundColor: i % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}>
                    <td className="px-3 py-2.5 text-xs">{r.label}</td>
                    <td className="px-3 py-2.5 text-xs text-center" style={{ fontWeight: 600 }}>{r.pond}%</td>
                    <td className="px-3 py-2.5 text-center">
                      <input type="text" value={String(selectedData[r.field])}
                        onChange={e => { const v = parseInt(e.target.value.replace(/\D/g,''))||0; setSelectedData(d => d ? { ...d, [r.field]: Math.min(100,v) } : d); }}
                        className="w-20 px-2 py-1 text-xs text-center border border-gray-300 rounded" />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-center" style={{ fontWeight: 500 }}>{(selectedData[r.field]*r.mult).toFixed(2)}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: '#D0D0D0' }}>
                  <td className="px-3 py-2.5 text-xs" style={{ fontWeight: 700 }}>CALIFICACIÓN TOTAL</td>
                  <td className="px-3 py-2.5 text-xs text-center" style={{ fontWeight: 700 }}>100%</td>
                  <td />
                  <td className="px-3 py-2.5 text-xs text-center text-[#0066CC]" style={{ fontWeight: 700 }}>{selectedData.calificacionTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Resultado */}
        {selectedData.nivelRiesgo && (
          <div className={`border px-4 py-3 ${selectedData.nivelRiesgo==='Alto'?'bg-red-50 border-red-200':selectedData.nivelRiesgo==='Medio'?'bg-yellow-50 border-yellow-200':'bg-green-50 border-green-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-800 mb-1" style={{ fontWeight: 700 }}>RESULTADO DE CALIFICACIÓN</div>
                <div className="text-xs text-gray-700">Cliente: <strong>{selectedData.nombreCliente}</strong></div>
                <div className="text-xs text-gray-700 mt-0.5">Calificación Total: <strong>{selectedData.calificacionTotal.toFixed(2)}</strong> puntos</div>
              </div>
              <div className={`px-6 py-3 rounded text-white text-sm ${selectedData.nivelRiesgo==='Alto'?'bg-red-700':selectedData.nivelRiesgo==='Medio'?'bg-yellow-600':'bg-green-700'}`} style={{ fontWeight: 700 }}>
                RIESGO {selectedData.nivelRiesgo.toUpperCase()}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-200 flex items-center gap-6 text-[10px] text-gray-600">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-700 inline-block"/>Bajo: 0–39</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-600 inline-block"/>Medio: 40–69</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-700 inline-block"/>Alto: 70–100</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
