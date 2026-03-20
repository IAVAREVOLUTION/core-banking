import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import * as store from './pldStore';
import type { CalificacionData } from './pldStore';

interface Props { onBack?: () => void; }

const CLIENTES_PLD = [
  { id: 1, nombre: 'Juan Carlos García López', rfc: 'GALJ850315HDF', personalidad: 'Persona Física', sucursal: 'Matriz Centro' },
  { id: 2, nombre: 'Comercializadora Del Norte SA de CV', rfc: 'CDN2011234567', personalidad: 'Persona Moral', sucursal: 'Sucursal Norte' },
  { id: 3, nombre: 'María Elena Rodríguez Sánchez', rfc: 'ROSM900728MLN', personalidad: 'Persona Física c/Act. Emp.', sucursal: 'Sucursal Sur' },
  { id: 4, nombre: 'Roberto Sánchez Cruz', rfc: 'SACR780512QWE', personalidad: 'Persona Física', sucursal: 'Matriz Centro' },
  { id: 5, nombre: 'Ana Patricia Mendoza Flores', rfc: 'MEFA920310RTY', personalidad: 'Persona Física', sucursal: 'Sucursal Poniente' },
  { id: 6, nombre: 'GRUPO EMPRESARIAL XYZ SA de CV', rfc: 'GEX180523ABC', personalidad: 'Persona Moral', sucursal: 'Sucursal Norte' },
  { id: 7, nombre: 'Fernando Castro Ruiz', rfc: 'CARF761210DEF', personalidad: 'Persona Física', sucursal: 'Matriz Centro' },
];

const RIESGO_COLORS: Record<string, string> = {
  'Bajo': 'bg-green-100 text-green-700 border-green-300',
  'Medio': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  'Alto': 'bg-red-100 text-red-700 border-red-300',
};

type ViewMode = 'list' | 'detail';

export function PLDCalificacionRiesgo({ onBack }: Props) {
  const [view, setView] = useState<ViewMode>('list');
  const [calificaciones, setCalificaciones] = useState<CalificacionData[]>(store.getCalificaciones);
  const [selectedData, setSelectedData] = useState<CalificacionData | null>(null);

  // Modal buscar cliente para nueva calificación
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');

  // Filtros lista
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRiesgo, setFilterRiesgo] = useState('');

  const filtered = useMemo(() => {
    let result = calificaciones;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.nombreCliente.toLowerCase().includes(q) ||
        (c.clienteRFC || '').toLowerCase().includes(q) ||
        c.noCliente.toLowerCase().includes(q)
      );
    }
    if (filterRiesgo) result = result.filter(c => c.nivelRiesgo === filterRiesgo);
    return result;
  }, [calificaciones, searchTerm, filterRiesgo]);

  const filteredClientes = useMemo(() => {
    if (!clienteSearch) return CLIENTES_PLD;
    const q = clienteSearch.toLowerCase();
    return CLIENTES_PLD.filter(c =>
      c.nombre.toLowerCase().includes(q) || c.rfc.toLowerCase().includes(q)
    );
  }, [clienteSearch]);

  // ── Abrir detalle existente ──
  const handleOpenDetail = (cal: CalificacionData) => {
    setSelectedData({ ...cal });
    setView('detail');
  };

  // ── Seleccionar cliente para nueva calificación ──
  const handleSelectCliente = (c: typeof CLIENTES_PLD[0]) => {
    // Verificar si ya tiene calificación
    const existing = calificaciones.find(cal => cal.clienteId === c.id);
    if (existing) {
      setSelectedData({ ...existing });
    } else {
      setSelectedData({
        clienteId: c.id,
        noCliente: `CLI-${String(c.id).padStart(3, '0')}`,
        nombreCliente: c.nombre,
        clienteRFC: c.rfc,
        clientePersonalidad: c.personalidad,
        clienteSucursal: c.sucursal,
        fechaCalificacion: '',
        actividadEconomica: 0,
        residencia: 0,
        nacionalidad: 0,
        tipoPersona: 0,
        pepListasNegras: 0,
        calificacionTotal: 0,
        nivelRiesgo: '',
      });
    }
    setShowClienteModal(false);
    setClienteSearch('');
    setView('detail');
  };

  // ── Calcular riesgo ──
  const handleCalcular = () => {
    if (!selectedData) return;
    const total =
      (selectedData.actividadEconomica * 0.25) + (selectedData.residencia * 0.15) +
      (selectedData.nacionalidad * 0.15) + (selectedData.tipoPersona * 0.20) +
      (selectedData.pepListasNegras * 0.25);
    const nivel = total >= 70 ? 'Alto' : total >= 40 ? 'Medio' : 'Bajo';
    const now = new Date();
    const fechaHoy = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    const updated = { ...selectedData, calificacionTotal: parseFloat(total.toFixed(2)), nivelRiesgo: nivel, fechaCalificacion: fechaHoy };
    setSelectedData(updated);
    toast.success('Riesgo calculado', { description: `Calificación: ${total.toFixed(2)} — Nivel: ${nivel}` });
  };

  // ── Guardar calificación ──
  const handleGuardar = () => {
    if (!selectedData) return;
    if (!selectedData.nivelRiesgo) {
      toast.error('Calcule el riesgo antes de guardar');
      return;
    }
    store.saveCalificacionCliente(selectedData);
    setCalificaciones(store.getCalificaciones());
    toast.success('Calificación guardada', { description: `Riesgo de "${selectedData.nombreCliente}" registrado como ${selectedData.nivelRiesgo}.` });
    setView('list');
    setSelectedData(null);
  };

  // ── Volver a lista ──
  const handleBackToList = () => {
    setView('list');
    setSelectedData(null);
  };

  const labelCls = 'text-xs w-28 flex-shrink-0 text-gray-700';
  const disabledCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600';

  // ══════════════════════════════════════════
  // VISTA LISTA
  // ══════════════════════════════════════════
  if (view === 'list') {
    return (
      <div className="bg-[#F5F5F5] min-h-full flex flex-col">
        {/* Header */}
        <div className="bg-white px-6 py-3 border-b border-gray-300 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#4A6FA5" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10l2 2 4-4"/></svg>
            <h1 className="text-sm text-gray-800" style={{ fontWeight: 700 }}>Matriz de Riesgo / Calificación PLD</h1>
            <span className="text-xs text-gray-500">({filtered.length} registros)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowClienteModal(true); setClienteSearch(''); }}
              className="px-4 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB]"
            >
              + Nueva Calificación
            </button>
            <button onClick={onBack} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Volver</button>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-6 py-2 bg-white border-b border-gray-300 flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Buscar:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nombre, RFC, No. Cliente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded w-56"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">x</button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Riesgo:</label>
            <select value={filterRiesgo} onChange={e => setFilterRiesgo(e.target.value)} className="px-2 py-1 text-xs border border-gray-300 rounded">
              <option value="">Todos</option>
              <option value="Bajo">Bajo</option>
              <option value="Medio">Medio</option>
              <option value="Alto">Alto</option>
            </select>
          </div>
          {(searchTerm || filterRiesgo) && (
            <button onClick={() => { setSearchTerm(''); setFilterRiesgo(''); }} className="px-2 py-1 text-xs text-[#4A6FA5] hover:underline">Limpiar filtros</button>
          )}
        </div>

        {/* Tabla */}
        <div className="flex-1 px-6 py-4 overflow-auto">
          <div className="bg-white border border-gray-300">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D0D0D0]">
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>No. Cliente</th>
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>Cliente</th>
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>RFC</th>
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>Personalidad</th>
                  <th className="px-3 py-2 text-center" style={{ fontWeight: 600 }}>Calificación</th>
                  <th className="px-3 py-2 text-center" style={{ fontWeight: 600 }}>Nivel Riesgo</th>
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>Fecha</th>
                  <th className="px-3 py-2 text-center" style={{ fontWeight: 600 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">No se encontraron calificaciones</td></tr>
                ) : filtered.map((cal, idx) => (
                  <tr key={cal.clienteId || idx} className={idx % 2 === 1 ? 'bg-[#EEEEEE]' : 'bg-white'}>
                    <td className="px-3 py-2 text-[#4A6FA5]" style={{ fontWeight: 500 }}>{cal.noCliente}</td>
                    <td className="px-3 py-2" style={{ fontWeight: 500 }}>{cal.nombreCliente}</td>
                    <td className="px-3 py-2 font-mono">{cal.clienteRFC || '—'}</td>
                    <td className="px-3 py-2">{cal.clientePersonalidad || '—'}</td>
                    <td className="px-3 py-2 text-center" style={{ fontWeight: 600 }}>{cal.calificacionTotal.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      {cal.nivelRiesgo ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${RIESGO_COLORS[cal.nivelRiesgo]}`} style={{ fontWeight: 500 }}>
                          {cal.nivelRiesgo}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2">{cal.fechaCalificacion || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => handleOpenDetail(cal)} className="text-[#0099CC] hover:underline text-xs mr-2">Editar</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => handleOpenDetail(cal)} className="text-[#4A6FA5] hover:underline text-xs ml-2">Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal seleccionar cliente */}
        {showClienteModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowClienteModal(false)}>
            <div className="bg-white rounded shadow-xl w-[700px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="bg-[#4A6FA5] px-5 py-3 rounded-t flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5"><circle cx="8" cy="6" r="3"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/></svg>
                  <h3 className="text-sm text-white" style={{ fontWeight: 600 }}>Seleccionar Cliente para Calificación</h3>
                </div>
                <button onClick={() => setShowClienteModal(false)} className="text-white/80 hover:text-white text-lg leading-none">&times;</button>
              </div>
              <div className="p-4 flex-shrink-0">
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Buscar por nombre o RFC..."
                    value={clienteSearch}
                    onChange={e => setClienteSearch(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded pr-8"
                    autoFocus
                  />
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><circle cx="6" cy="6" r="4"/><path d="M9.5 9.5l3 3"/></svg>
                </div>
              </div>
              <div className="flex-1 overflow-auto px-4 pb-2">
                <div className="border border-gray-300">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="bg-[#D0D0D0]">
                        <th className="px-3 py-2 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Nombre / Razón Social</th>
                        <th className="px-3 py-2 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>RFC</th>
                        <th className="px-3 py-2 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Personalidad</th>
                        <th className="px-3 py-2 text-left text-[10px]" style={{ fontWeight: 600 }}>Sucursal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClientes.length === 0 ? (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No se encontraron clientes</td></tr>
                      ) : filteredClientes.map((c, idx) => (
                        <tr
                          key={c.id}
                          onClick={() => handleSelectCliente(c)}
                          className="cursor-pointer border-b border-gray-100 transition-colors"
                          style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}
                        >
                          <td className="px-3 py-2 border-r border-gray-200" style={{ fontWeight: 500 }}>
                            <div className="flex items-center gap-2">
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#4A6FA5" strokeWidth="1.2"><circle cx="7" cy="5.5" r="2.5"/><path d="M3 12.5c0-2.2 1.8-4 4-4s4 1.8 4 4"/></svg>
                              {c.nombre}
                            </div>
                          </td>
                          <td className="px-3 py-2 border-r border-gray-200 font-mono">{c.rfc}</td>
                          <td className="px-3 py-2 border-r border-gray-200">{c.personalidad}</td>
                          <td className="px-3 py-2">{c.sucursal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                <span className="text-[10px] text-gray-400">Haga clic en un cliente para evaluar su riesgo</span>
                <button onClick={() => setShowClienteModal(false)} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════
  // VISTA DETALLE — CALIFICACIÓN DE UN CLIENTE
  // ══════════════════════════════════════════
  if (!selectedData) return null;

  return (
    <div className="bg-[#F5F5F5] min-h-full flex flex-col">
      {/* Header */}
      <div className="bg-white px-6 py-3 border-b border-gray-300 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={handleBackToList} className="text-[#4A6FA5] hover:text-[#3a5a8a]" title="Volver a la lista">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4L6 9l5 5"/></svg>
          </button>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#4A6FA5" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10l2 2 4-4"/></svg>
          <h1 className="text-sm text-gray-800" style={{ fontWeight: 700 }}>Calificación de Riesgo — {selectedData.nombreCliente}</h1>
          {selectedData.nivelRiesgo && (
            <span className={`ml-2 inline-block px-2 py-0.5 rounded text-[10px] border ${RIESGO_COLORS[selectedData.nivelRiesgo]}`} style={{ fontWeight: 500 }}>
              {selectedData.nivelRiesgo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCalcular} className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs rounded hover:bg-[#3a5a8a]">Calcular Riesgo</button>
          <button onClick={handleGuardar} className="px-4 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB]">Guardar</button>
          <button onClick={handleBackToList} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Cancelar</button>
        </div>
      </div>

      <div className="flex-1 px-6 py-4 overflow-auto">
        <div className="bg-white border border-gray-300 p-4">

          {/* Información del Cliente */}
          <div className="mb-4">
            <div className="bg-[#D9E2F3] px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-[#4A6FA5]" style={{ fontWeight: 500 }}>
              Información del Cliente
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-1.5">
              <div className="flex items-center gap-2">
                <label className={labelCls}>No. CLIENTE</label>
                <div className={disabledCls}>{selectedData.noCliente}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>CLIENTE</label>
                <div className={disabledCls} style={{ fontWeight: 500 }}>{selectedData.nombreCliente}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>RFC</label>
                <div className={`${disabledCls} font-mono`}>{selectedData.clienteRFC || '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>PERSONALIDAD</label>
                <div className={disabledCls}>{selectedData.clientePersonalidad || '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>SUCURSAL</label>
                <div className={disabledCls}>{selectedData.clienteSucursal || '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>FECHA CALIF.</label>
                <div className={disabledCls}>{selectedData.fechaCalificacion || 'Sin evaluar'}</div>
              </div>
            </div>
          </div>

          {/* Matriz de Riesgo */}
          <div className="mb-4">
            <div className="bg-[#D9E2F3] px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-[#4A6FA5]" style={{ fontWeight: 500 }}>
              Matriz de Riesgo — Ponderadores
            </div>
            <div className="border border-gray-300">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#D0D0D0]">
                    <th className="px-3 py-2 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Factor de Riesgo</th>
                    <th className="px-3 py-2 text-center text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Ponderador</th>
                    <th className="px-3 py-2 text-center text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Calificación (0-100)</th>
                    <th className="px-3 py-2 text-center text-[10px]" style={{ fontWeight: 600 }}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Actividad Económica', pond: 25, field: 'actividadEconomica' as const, mult: 0.25 },
                    { label: 'Residencia', pond: 15, field: 'residencia' as const, mult: 0.15 },
                    { label: 'Nacionalidad', pond: 15, field: 'nacionalidad' as const, mult: 0.15 },
                    { label: 'Tipo de Persona', pond: 20, field: 'tipoPersona' as const, mult: 0.20 },
                    { label: 'PEP / Listas Negras', pond: 25, field: 'pepListasNegras' as const, mult: 0.25 },
                  ].map((r, i) => (
                    <tr key={r.field} style={{ backgroundColor: i % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}>
                      <td className="px-3 py-2 border-r border-gray-200">{r.label}</td>
                      <td className="px-3 py-2 text-center border-r border-gray-200" style={{ fontWeight: 600 }}>{r.pond}%</td>
                      <td className="px-3 py-2 text-center border-r border-gray-200">
                        <input
                          type="text"
                          value={String(selectedData[r.field])}
                          onChange={e => {
                            const v = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                            setSelectedData(d => d ? { ...d, [r.field]: Math.min(100, v) } : d);
                          }}
                          className="w-20 px-2 py-1 text-center text-xs border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-center" style={{ fontWeight: 500 }}>{(selectedData[r.field] * r.mult).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#D9E2F3]">
                    <td className="px-3 py-2" style={{ fontWeight: 700 }}>CALIFICACIÓN TOTAL</td>
                    <td className="px-3 py-2 text-center" style={{ fontWeight: 700 }}>100%</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-center text-[#4A6FA5]" style={{ fontWeight: 700 }}>{selectedData.calificacionTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Resultado */}
          {selectedData.nivelRiesgo && (
            <div className={`border rounded p-4 ${
              selectedData.nivelRiesgo === 'Alto' ? 'bg-red-50 border-red-300' :
              selectedData.nivelRiesgo === 'Medio' ? 'bg-yellow-50 border-yellow-300' :
              'bg-green-50 border-green-300'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-800" style={{ fontWeight: 700 }}>RESULTADO DE CALIFICACIÓN</div>
                  <div className="text-xs text-gray-700 mt-1">
                    Cliente: <strong>{selectedData.nombreCliente}</strong>
                  </div>
                  <div className="text-xs text-gray-700 mt-0.5">
                    Calificación Total: <strong>{selectedData.calificacionTotal.toFixed(2)}</strong> puntos
                  </div>
                </div>
                <div className={`px-6 py-3 rounded text-white text-sm ${
                  selectedData.nivelRiesgo === 'Alto' ? 'bg-red-600' :
                  selectedData.nivelRiesgo === 'Medio' ? 'bg-yellow-600' : 'bg-green-600'
                }`} style={{ fontWeight: 700 }}>
                  RIESGO {selectedData.nivelRiesgo.toUpperCase()}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-300 flex items-center gap-6 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span> Bajo: 0-39</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-600 inline-block"></span> Medio: 40-69</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600 inline-block"></span> Alto: 70-100</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
