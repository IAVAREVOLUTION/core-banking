import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DatePicker } from '../clientes/DatePicker';
import {
  CasoCobranzaListItem, CasoFormData, Convenio,
  EMPTY_FORM, MOCK_CASOS,
  saveToSession, loadFromSession, loadFromSavedStore, saveToSavedStore,
  clearSession, migrateSavedStore, consumeCasoId,
  formatCurrency, parseCurrency,
  CAT_TIPO, CAT_ESTATUS, CAT_SUB_ESTATUS, CAT_PRIORIDAD, CAT_AREA,
  CAT_DESPACHO, CAT_TIPO_CONVENIO, CAT_PERIODICIDAD, CAT_ESTATUS_CONVENIO,
  CAT_TIPO_PAGO,
} from './cobranzaStore';

type ViewState =
  | { type: 'inicio' }
  | { type: 'lista' }
  | { type: 'detalle'; mode: 'nuevo' | 'editar' | 'ver'; id?: number };

// ═══════════════════════════════════════════════════════════════════
// MAIN MODULE
// ═══════════════════════════════════════════════════════════════════
export function CasosCobranzaModule() {
  const [view, setView] = useState<ViewState>({ type: 'inicio' });
  const [items, setItems] = useState<CasoCobranzaListItem[]>([...MOCK_CASOS]);

  const goToInicio = () => setView({ type: 'inicio' });
  const goToLista = () => setView({ type: 'lista' });
  const handleNuevo = () => { clearSession('new'); setView({ type: 'detalle', mode: 'nuevo' }); };
  const handleEditar = (i: CasoCobranzaListItem) => { clearSession(i.id); setView({ type: 'detalle', mode: 'editar', id: i.id }); };
  const handleVer = (i: CasoCobranzaListItem) => setView({ type: 'detalle', mode: 'ver', id: i.id });

  const handleSave = (data: CasoFormData, convenios: Convenio[]) => {
    if (view.type === 'detalle' && view.mode === 'nuevo') {
      const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
      migrateSavedStore('new', newId);
      saveToSavedStore(newId, 'form', { ...data });
      saveToSavedStore(newId, 'convenios', convenios);
      setItems(prev => [{
        id: newId, noCaso: data.noCaso, tipo: data.tipo, propietario: data.despachoAsignado,
        estatus: data.estatus, prioridad: data.prioridad, area: data.area,
        nombreCompleto: data.empresa, nombreDespacho: data.nombreDespacho || 'No asignado',
        subEstatus: data.subEstatus, fechaSolicitud: data.fechaAsignacion, resumen: data.resumen,
      }, ...prev]);
      toast.success('Caso de cobranza creado', { description: `Caso ${data.noCaso} registrado exitosamente.` });
    } else if (view.type === 'detalle' && view.mode === 'editar' && view.id) {
      saveToSavedStore(view.id, 'form', { ...data });
      saveToSavedStore(view.id, 'convenios', convenios);
      setItems(prev => prev.map(i => i.id === view.id ? {
        ...i, tipo: data.tipo, estatus: data.estatus, prioridad: data.prioridad,
        area: data.area, nombreCompleto: data.empresa,
        nombreDespacho: data.nombreDespacho || i.nombreDespacho,
        subEstatus: data.subEstatus, fechaSolicitud: data.fechaAsignacion || i.fechaSolicitud,
        resumen: data.resumen, propietario: data.despachoAsignado,
      } : i));
      toast.success('Caso actualizado', { description: `Los cambios del caso ${data.noCaso} han sido guardados.` });
    }
    goToLista();
  };

  const tabLabel = view.type === 'detalle'
    ? view.mode === 'nuevo' ? '+ Nuevo Caso' : view.mode === 'editar' ? 'Editar Caso' : 'Ver Caso'
    : '';

  return (
    <>
      {/* Sub-navegación institucional */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button onClick={goToInicio} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view.type === 'inicio' ? 'tab-active' : 'tab-inactive'}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/><path d="M6 14v-5h4v5"/></svg>
            <span>Inicio</span>
          </button>
          <button onClick={goToLista} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view.type === 'lista' ? 'tab-active' : 'tab-inactive'}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M3 8h10M3 12h10"/></svg>
            <span>Lista de Casos</span>
          </button>
          {view.type === 'detalle' && (
            <button className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-active">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                {view.mode === 'nuevo' ? <path d="M8 3v10M3 8h10"/> : view.mode === 'editar' ? <path d="M3 13l8-8 2 2-8 8H3v-2z"/> : <><path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"/><path d="M4 8h8M6 4v8"/></>}
              </svg>
              <span>{tabLabel}</span>
            </button>
          )}
        </div>
      </div>

      {view.type === 'inicio' ? (
        <DashboardScreen items={items} onVer={handleVer} />
      ) : view.type === 'lista' ? (
        <ListScreen items={items} onNuevo={handleNuevo} onEditar={handleEditar} onVer={handleVer} />
      ) : (
        <DetalleScreen mode={view.mode} casoId={view.id} onCancel={goToLista} onSave={handleSave} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PANTALLA DASHBOARD — KPIs + Registros + Charts
// ═══════════════════════════════════════════════════════════════════
function DashboardScreen({ items, onVer }: {
  items: CasoCobranzaListItem[];
  onVer: (i: CasoCobranzaListItem) => void;
}) {
  // ── KPIs ──
  const kpis = useMemo(() => {
    const total = items.length;
    const abiertos = items.filter(i => i.estatus === 'Abierto').length;
    const enProceso = items.filter(i => i.estatus === 'En Proceso').length;
    const cerrados = items.filter(i => i.estatus === 'Cerrado').length;
    const integracion = items.filter(i => i.subEstatus === 'Integración').length;
    const analisis = items.filter(i => i.subEstatus === 'Análisis').length;
    const juridico = items.filter(i => i.subEstatus === 'Jurídico').length;
    const liberacion = items.filter(i => i.subEstatus === 'Liberación').length;
    return { total, abiertos, enProceso, cerrados, integracion, analisis, juridico, liberacion };
  }, [items]);

  // ── Data para charts ──
  const distribucionEstatus = useMemo(() => [
    { estatus: 'Abierto', cantidad: kpis.abiertos, color: '#10B981' },
    { estatus: 'En Proceso', cantidad: kpis.enProceso, color: '#F59E0B' },
    { estatus: 'Cerrado', cantidad: kpis.cerrados, color: '#EF4444' },
  ].filter(d => d.cantidad > 0), [kpis]);

  const casosPorTipo = useMemo(() => [
    { tipo: 'Normal', cantidad: items.filter(i => i.tipo === 'Normal').length },
    { tipo: 'Extrajudicial', cantidad: items.filter(i => i.tipo === 'Extrajudicial').length },
    { tipo: 'Judicial', cantidad: items.filter(i => i.tipo === 'Judicial').length },
  ].filter(d => d.cantidad > 0), [items]);

  const registrosRecientes = useMemo(() =>
    [...items].sort((a, b) => new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime()).slice(0, 8)
  , [items]);

  const casosPorSubEstatus = useMemo(() => [
    { sub: 'Integración', cantidad: kpis.integracion },
    { sub: 'Análisis', cantidad: kpis.analisis },
    { sub: 'Jurídico', cantidad: kpis.juridico },
    { sub: 'Liberación', cantidad: kpis.liberacion },
  ], [kpis]);

  return (
    <div className="p-6 space-y-6">
      {/* ── KPI Cards (institutional white) ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total de Casos" value={kpis.total} sub="Casos asignados al equipo" iconBg="bg-blue-50" iconColor="#2E5C91"
          icon={<><path d="M3 5a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/></>} />
        <KPICard label="Casos Abiertos" value={kpis.abiertos} sub={`${kpis.total > 0 ? ((kpis.abiertos / kpis.total) * 100).toFixed(1) : 0}% del total`} iconBg="bg-green-50" iconColor="#10B981"
          icon={<><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>} />
        <KPICard label="En Proceso" value={kpis.enProceso} sub={`${kpis.total > 0 ? ((kpis.enProceso / kpis.total) * 100).toFixed(1) : 0}% del total`} iconBg="bg-orange-50" iconColor="#F59E0B"
          icon={<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>} />
        <KPICard label="Cerrados" value={kpis.cerrados} sub={`${kpis.total > 0 ? ((kpis.cerrados / kpis.total) * 100).toFixed(1) : 0}% del total`} iconBg="bg-red-50" iconColor="#EF4444"
          icon={<><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>} />
      </div>

      {/* ── Registros Recientes + Distribución Estatus ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registros Recientes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimos casos de cobranza registrados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">No. Caso</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Nombre</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {registrosRecientes.map((c, idx) => (
                  <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-[#0066CC] cursor-pointer hover:underline" onClick={() => onVer(c)}>{c.noCaso}</td>
                    <td className="px-3 py-2 text-gray-900">{c.nombreCompleto}</td>
                    <td className="px-3 py-2 text-gray-700">{c.tipo}</td>
                    <td className="px-3 py-2 text-gray-700">{c.fechaSolicitud}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribución por Estatus */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación de casos por estatus actual</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={distribucionEstatus} dataKey="cantidad" nameKey="estatus" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {distribucionEstatus.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [v, 'Casos']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 pb-4">
            {distribucionEstatus.map(d => (
              <div key={d.estatus} className="flex items-center gap-1.5 text-xs text-gray-700">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span>{d.estatus}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Casos por Sub Estatus + Casos por Tipo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Casos por Sub Estatus */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Casos por Sub Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución por etapa del proceso</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={casosPorSubEstatus} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="sub" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v: number) => [v, 'Casos']} />
                <Bar dataKey="cantidad" fill="var(--theme-primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Casos por Tipo */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Casos por Tipo</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución por tipo de cobranza</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={casosPorTipo} margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, 'Casos']} />
                <Bar dataKey="cantidad" fill="#2E5C91" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// KPI CARD (institutional white like Prospectos)
// ═══════════════════════════════════════════════════════════════════
function KPICard({ label, value, sub, iconBg, iconColor, icon }: {
  label: string; value: number | string; sub: string; iconBg: string; iconColor: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-300 rounded p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
            {icon}
          </svg>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-600">{sub}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PANTALLA LISTA — Institutional
// ═══════════════════════════════════════════════════════════════════
function ListScreen({ items, onNuevo, onEditar, onVer }: {
  items: CasoCobranzaListItem[];
  onNuevo: () => void;
  onEditar: (i: CasoCobranzaListItem) => void;
  onVer: (i: CasoCobranzaListItem) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!searchTerm) return items;
    const s = searchTerm.toLowerCase();
    return items.filter(i =>
      i.noCaso.toLowerCase().includes(s) || i.nombreCompleto.toLowerCase().includes(s) ||
      i.tipo.toLowerCase().includes(s) || i.resumen.toLowerCase().includes(s) ||
      i.estatus.toLowerCase().includes(s) || i.subEstatus.toLowerCase().includes(s)
    );
  }, [items, searchTerm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const da = new Date(a.fechaSolicitud).getTime();
      const db = new Date(b.fechaSolicitud).getTime();
      return sortOrder === 'desc' ? db - da : da - db;
    });
  }, [filtered, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const currentItems = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="bg-white min-h-screen">
      {/* ── Header institucional ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M8 5V3M16 5V3"/></svg>
            <h2 className="text-lg font-normal text-gray-800">Casos de Cobranza</h2>
            <button className="p-1 ml-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2"><circle cx="8" cy="8" r="6"/><path d="M13 13l3 3"/></svg></button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth' })} className="cursor-pointer hover:text-[#0099CC] transition-colors">Lista</span>
            <span onClick={() => searchRef.current?.focus()} className="cursor-pointer hover:text-[#0099CC] transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* ── Ver + Nuevo ── */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[250px]">
              <option>Casos de cobranza de mi equipo</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
          </div>
          <button onClick={onNuevo} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium">Nuevo</button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="px-4 py-2 bg-[#F0F0F0] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <input ref={searchRef} type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar casos..." className="px-3 py-1 border border-gray-400 rounded text-sm w-64" />
        </div>
      </div>

      {/* ── Barra de acciones ── */}
      <div className="px-4 py-2.5 bg-[#F0F0F0] border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ExportBtn type="csv" />
            <ExportBtn type="excel" />
            <ExportBtn type="pdf" />
            <ExportBtn type="print" />
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden Rápido</span>
              <div className="relative">
                <select value={sortOrder} onChange={e => { setSortOrder(e.target.value as any); setCurrentPage(1); }} className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                  <option value="desc">Descendente</option><option value="asc">Ascendente</option>
                </select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666"><path d="M5 7l-3-3h6z"/></svg>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-0.5 text-[#0099CC] hover:text-[#0088BB] disabled:opacity-40" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
              </button>
              <button className="p-0.5 text-[#0099CC] hover:text-[#0088BB] disabled:opacity-40" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
              </button>
            </div>
            <span className="font-medium">Total: {sorted.length}</span>
          </div>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#D0D0D0] border-b border-gray-300">
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">Editar | Ver</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">NO. CASO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">TIPO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">PROPIETARIO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">ESTATUS</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">PRIORIDAD</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">ÁREA</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">NOMBRE COMPLETO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">NOMBRE DESPACHO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">SUB ESTATUS</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">FECHA SOLICITUD</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">RESUMEN</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-500">No se encontraron casos</td></tr>
              ) : currentItems.map((c, idx) => (
                <tr key={c.id} className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                >
                  <td className="px-3 py-2.5 text-xs">
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onEditar(c); }}>Editar</a>
                    <span className="text-gray-700"> | </span>
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onVer(c); }}>Ver</a>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#0066CC] cursor-pointer hover:underline" onClick={() => onVer(c)}>{c.noCaso}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.tipo}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.propietario}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.estatus}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.prioridad}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.area}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.nombreCompleto}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.nombreDespacho}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.subEstatus}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.fechaSolicitud}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.resumen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Paginación ── */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <PagBtn title="Primera" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} d="M13 4L4 9l9 5V4z" />
          <PagBtn title="Anterior" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} d="M9 4L4 9l5 5V4z" />
          <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {currentPage} de {totalPages}</div>
          <PagBtn title="Siguiente" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} d="M5 4l5 5-5 5V4z" />
          <PagBtn title="Última" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} d="M4 4L13 9l-9 5V4z" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PANTALLA DETALLE — Formulario Institucional + Subtabs
// ═══════════════════════════════════════════════════════════════════
function DetalleScreen({ mode, casoId, onCancel, onSave }: {
  mode: 'nuevo' | 'editar' | 'ver';
  casoId?: number;
  onCancel: () => void;
  onSave: (data: CasoFormData, convenios: Convenio[]) => void;
}) {
  const storageId = casoId ?? 'new';
  const readOnly = mode === 'ver';
  const [activeTab, setActiveTab] = useState<'default' | 'convenios'>('default');

  // ── Load form ──
  const [form, setForm] = useState<CasoFormData>(() => {
    if (mode === 'nuevo') {
      const noCaso = consumeCasoId();
      const now = new Date();
      const fecha = `${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      return { ...EMPTY_FORM, noCaso, fechaAsignacion: fecha };
    }
    const saved = loadFromSavedStore<CasoFormData>(storageId, 'form');
    return saved ?? { ...EMPTY_FORM };
  });

  // ── Load convenios ──
  const [convenios, setConvenios] = useState<Convenio[]>(() => {
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<Convenio[]>(storageId, 'convenios');
    return saved ?? [];
  });

  // ── Convenio modal ──
  const [convModal, setConvModal] = useState<{ open: boolean; mode: 'nuevo' | 'editar' | 'ver'; conv?: Convenio }>({ open: false, mode: 'nuevo' });

  // Persist on change
  useEffect(() => { if (!readOnly) saveToSession(storageId, 'form', form); }, [form, storageId, readOnly]);
  useEffect(() => { if (!readOnly) saveToSession(storageId, 'convenios', convenios); }, [convenios, storageId, readOnly]);

  const handleChange = (field: keyof CasoFormData, value: string) => {
    if (readOnly) return;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.tipo || !form.estatus || !form.area) {
      toast.error('Complete los campos obligatorios', { description: 'Tipo, Estatus y Área son requeridos.' });
      return;
    }
    onSave(form, convenios);
  };

  const totalConvenios = convenios.reduce((s, c) => s + (c.monto || 0), 0);

  const tabs = [
    { id: 'default' as const, label: 'Default' },
    { id: 'convenios' as const, label: 'Convenios' },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* ── Header del caso ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>
            <h2 className="text-lg font-normal text-gray-800">
              {mode === 'nuevo' ? 'Alta Caso de Cobranza' : mode === 'editar' ? `Editar Caso ${form.noCaso}` : `Caso ${form.noCaso}`}
            </h2>
            <button className="p-1 ml-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2"><circle cx="8" cy="8" r="6"/><path d="M13 13l3 3"/></svg></button>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button onClick={handleSubmit} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium">Guardar</button>
          )}
          <button onClick={onCancel} className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700">
            {readOnly ? 'Volver' : 'Cancelar'}
          </button>
        </div>
      </div>

      {/* ── Form Content ── */}
      <div className="px-4 py-4 bg-[#F5F5F5]">
        <div className="bg-white border border-gray-300 p-4">

          {/* ── Información Principal Section ── */}
          <div className="mb-4">
            <div className="bg-primary-tint-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
              Información Principal
            </div>
            <div className="grid grid-cols-3 gap-x-4">
              {/* Columna 1 */}
              <div className="space-y-1">
                <FormRow label="NO. CASO" required>
                  <input type="text" value={form.noCaso} disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                </FormRow>
                <FormRow label="TIPO" required>
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{form.tipo}</div>
                  ) : (
                    <select value={form.tipo} onChange={e => handleChange('tipo', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                      {CAT_TIPO.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </FormRow>
                <FormRow label="FECHA ASIGNACIÓN" required>
                  <input type="text" value={form.fechaAsignacion} disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                </FormRow>
                <FormRow label="ÁREA" required>
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{form.area}</div>
                  ) : (
                    <select value={form.area} onChange={e => handleChange('area', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                      {CAT_AREA.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </FormRow>
              </div>

              {/* Columna 2 */}
              <div className="space-y-1">
                <FormRow label="ESTATUS" required>
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{form.estatus}</div>
                  ) : (
                    <select value={form.estatus} onChange={e => handleChange('estatus', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                      {CAT_ESTATUS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </FormRow>
                <FormRow label="SUB ESTATUS">
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{form.subEstatus}</div>
                  ) : (
                    <select value={form.subEstatus} onChange={e => handleChange('subEstatus', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                      {CAT_SUB_ESTATUS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </FormRow>
                <FormRow label="PRIORIDAD">
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{form.prioridad}</div>
                  ) : (
                    <select value={form.prioridad} onChange={e => handleChange('prioridad', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                      {CAT_PRIORIDAD.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </FormRow>
                <FormRow label="DESPACHO ASIG.">
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{form.despachoAsignado}</div>
                  ) : (
                    <select value={form.despachoAsignado} onChange={e => handleChange('despachoAsignado', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                      {CAT_DESPACHO.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </FormRow>
                <FormRow label="NOMBRE DESPACHO">
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{form.nombreDespacho}</div>
                  ) : (
                    <input type="text" value={form.nombreDespacho} onChange={e => handleChange('nombreDespacho', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  )}
                </FormRow>
              </div>

              {/* Columna 3 */}
              <div className="space-y-1">
                <FormRow label="EMPRESA">
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{form.empresa}</div>
                  ) : (
                    <input type="text" value={form.empresa} onChange={e => handleChange('empresa', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  )}
                </FormRow>
                <FormRow label="NO. EMPRESA">
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{form.noEmpresa}</div>
                  ) : (
                    <input type="text" value={form.noEmpresa} onChange={e => handleChange('noEmpresa', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  )}
                </FormRow>
                <FormRow label="NO. CRÉDITO">
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{form.noCredito}</div>
                  ) : (
                    <input type="text" value={form.noCredito} onChange={e => handleChange('noCredito', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  )}
                </FormRow>
                <div className="flex items-start gap-2">
                  <label className="text-xs w-28 flex-shrink-0 text-gray-700 pt-1">RESUMEN</label>
                  {readOnly ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700 h-16">{form.resumen}</div>
                  ) : (
                    <textarea value={form.resumen} onChange={e => handleChange('resumen', e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded h-16 resize-none" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabs Navigation (institutional blue bar) ── */}
          <div className="bg-primary-theme text-white border-y border-gray-400 -mx-4 mb-4">
            <div className="px-4 flex items-center overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs whitespace-nowrap transition-colors ${
                    activeTab === tab.id ? 'bg-secondary-theme text-white font-medium' : 'text-white/90'
                  }`}
                  style={activeTab !== tab.id ? { transition: 'background-color 0.2s' } : {}}
                  onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = 'var(--theme-primary-hover)'; }}
                  onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = ''; }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab Content ── */}
          {activeTab === 'default' && (
            <>
              {/* DEFAULT Section */}
              <div className="mb-4">
                <div className="bg-primary-tint-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
                  DEFAULT
                </div>
                <div className="grid grid-cols-3 gap-x-4">
                  {/* Columna 1 */}
                  <div className="space-y-1">
                    <FormRow label="NO. CASO" required>
                      <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.noCaso}</div>
                    </FormRow>
                    <FormRow label="TIPO" required>
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.tipo}</div>
                      ) : (
                        <select value={form.tipo} onChange={e => handleChange('tipo', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                          {CAT_TIPO.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </FormRow>
                    <FormRow label="FECHA ASIGNACIÓN" required>
                      <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.fechaAsignacion}</div>
                    </FormRow>
                    <FormRow label="ÁREA" required>
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.area}</div>
                      ) : (
                        <select value={form.area} onChange={e => handleChange('area', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                          {CAT_AREA.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </FormRow>
                  </div>

                  {/* Columna 2 */}
                  <div className="space-y-1">
                    <FormRow label="ESTATUS" required>
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.estatus}</div>
                      ) : (
                        <select value={form.estatus} onChange={e => handleChange('estatus', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                          {CAT_ESTATUS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </FormRow>
                    <FormRow label="SUB ESTATUS">
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.subEstatus}</div>
                      ) : (
                        <select value={form.subEstatus} onChange={e => handleChange('subEstatus', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                          {CAT_SUB_ESTATUS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </FormRow>
                    <FormRow label="PRIORIDAD">
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.prioridad}</div>
                      ) : (
                        <select value={form.prioridad} onChange={e => handleChange('prioridad', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                          {CAT_PRIORIDAD.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </FormRow>
                    <FormRow label="DESPACHO ASIG.">
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.despachoAsignado}</div>
                      ) : (
                        <select value={form.despachoAsignado} onChange={e => handleChange('despachoAsignado', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                          {CAT_DESPACHO.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </FormRow>
                    <FormRow label="NOMBRE DESPACHO">
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.nombreDespacho}</div>
                      ) : (
                        <input type="text" value={form.nombreDespacho} onChange={e => handleChange('nombreDespacho', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                      )}
                    </FormRow>
                  </div>

                  {/* Columna 3 */}
                  <div className="space-y-1">
                    <FormRow label="EMPRESA">
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.empresa}</div>
                      ) : (
                        <input type="text" value={form.empresa} onChange={e => handleChange('empresa', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                      )}
                    </FormRow>
                    <FormRow label="NO. EMPRESA">
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.noEmpresa}</div>
                      ) : (
                        <input type="text" value={form.noEmpresa} onChange={e => handleChange('noEmpresa', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                      )}
                    </FormRow>
                    <FormRow label="NO. CRÉDITO">
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{form.noCredito}</div>
                      ) : (
                        <input type="text" value={form.noCredito} onChange={e => handleChange('noCredito', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                      )}
                    </FormRow>
                    <div className="flex items-start gap-2">
                      <label className="text-xs w-28 flex-shrink-0 text-gray-700 pt-1">RESUMEN</label>
                      {readOnly ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100 h-16">{form.resumen}</div>
                      ) : (
                        <textarea value={form.resumen} onChange={e => handleChange('resumen', e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded h-16 resize-none" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'convenios' && (
            <ConveniosTab
              convenios={convenios}
              setConvenios={setConvenios}
              readOnly={readOnly}
              totalConvenios={totalConvenios}
              onOpenModal={(m, c) => setConvModal({ open: true, mode: m, conv: c })}
            />
          )}
        </div>
      </div>

      {/* ── Modal de Convenios ── */}
      {convModal.open && (
        <ConvenioModal
          mode={convModal.mode}
          convenio={convModal.conv}
          onClose={() => setConvModal({ open: false, mode: 'nuevo' })}
          onSave={(conv) => {
            if (convModal.mode === 'nuevo') {
              const newId = convenios.length > 0 ? Math.max(...convenios.map(c => c.id)) + 1 : 1;
              setConvenios(prev => [...prev, { ...conv, id: newId }]);
              toast.success('Convenio agregado');
            } else if (convModal.mode === 'editar' && convModal.conv) {
              setConvenios(prev => prev.map(c => c.id === convModal.conv!.id ? { ...conv, id: c.id } : c));
              toast.success('Convenio actualizado');
            }
            setConvModal({ open: false, mode: 'nuevo' });
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUBTAB CONVENIOS
// ═══════════════════════════════════════════════════════════════════
function ConveniosTab({ convenios, setConvenios, readOnly, totalConvenios, onOpenModal }: {
  convenios: Convenio[];
  setConvenios: React.Dispatch<React.SetStateAction<Convenio[]>>;
  readOnly: boolean;
  totalConvenios: number;
  onOpenModal: (mode: 'nuevo' | 'editar' | 'ver', conv?: Convenio) => void;
}) {
  const handleEliminar = (id: number) => {
    if (!confirm('¿Está seguro de eliminar este convenio?')) return;
    setConvenios(prev => prev.filter(c => c.id !== id));
    toast.success('Convenio eliminado');
  };

  return (
    <div className="mb-4">
      <div className="bg-primary-tint-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        Convenios
      </div>

      {/* Barra de acciones */}
      <div className="flex items-center gap-3 mb-3">
        {!readOnly && (
          <button onClick={() => onOpenModal('nuevo')} className="px-4 py-1.5 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB] font-medium">Nuevo</button>
        )}
        <span className="text-xs text-gray-500">Resultados de la consulta</span>
        <span className="ml-auto text-xs text-gray-500">{convenios.length} de {convenios.length}</span>
      </div>

      {/* Tabla de convenios */}
      <div className="border border-gray-300 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#D0D0D0] border-b border-gray-300">
              {!readOnly && <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">ACCIONES</th>}
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">CREADO</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">CREADO POR</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">NO. CONVENIO</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">TIPO CONVENIO</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">APROBADO MEF</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">FECHA CONVENIO</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">FECHA PAGO</th>
              <th className="px-2 py-2 text-right font-normal text-[10px] text-gray-700">MONTO</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">PERIODICIDAD</th>
              <th className="px-2 py-2 text-center font-normal text-[10px] text-gray-700">NO. PAGOS</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">SOCIO CONTACTO</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">ESTATUS</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">COMENTARIOS</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">FECHA REALIZ.</th>
              <th className="px-2 py-2 text-left font-normal text-[10px] text-gray-700">TIPO PAGO</th>
            </tr>
          </thead>
          <tbody>
            {convenios.length === 0 ? (
              <tr><td colSpan={readOnly ? 15 : 16} className="px-3 py-6 text-center text-gray-400 text-xs">Sin convenios registrados</td></tr>
            ) : convenios.map((c, idx) => (
              <tr key={c.id} className="border-b border-gray-200 transition-colors duration-150"
                style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
              >
                {!readOnly && (
                  <td className="px-2 py-2 text-[10px] whitespace-nowrap">
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onOpenModal('editar', c); }}>Editar</a>
                    <span className="text-gray-400"> | </span>
                    <a href="#" className="text-[#CC3333] hover:underline" onClick={e => { e.preventDefault(); handleEliminar(c.id); }}>Eliminar</a>
                  </td>
                )}
                <td className="px-2 py-2 text-[10px] text-gray-700 whitespace-nowrap">{c.fechaCreacion}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.creadoPor}</td>
                <td className="px-2 py-2 text-[10px] text-[#0066CC] cursor-pointer hover:underline" onClick={() => onOpenModal(readOnly ? 'ver' : 'editar', c)}>{c.noConvenio}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.tipoConvenio}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.aprobadoPorMEF}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.fechaConvenio}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.fechaPago}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700 text-right">{formatCurrency(c.monto)}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.periodicidad}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700 text-center">{c.noPagos}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.socioContacto}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.estatus}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.comentarios}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.fechaRealizacion}</td>
                <td className="px-2 py-2 text-[10px] text-gray-700">{c.tipoPago}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="mt-3 text-right">
        <span className="text-xs text-gray-600">Total: </span>
        <span className="text-sm text-gray-800 font-medium">{formatCurrency(totalConvenios)}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL CONVENIO (institutional header)
// ═══════════════════════════════════════════════════════════════════
function ConvenioModal({ mode, convenio, onClose, onSave }: {
  mode: 'nuevo' | 'editar' | 'ver';
  convenio?: Convenio;
  onClose: () => void;
  onSave: (conv: Convenio) => void;
}) {
  const readOnly = mode === 'ver';
  const now = new Date();
  const nowStr = `${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  const [conv, setConv] = useState<Convenio>(
    convenio
      ? { ...convenio }
      : {
          id: 0, fechaCreacion: nowStr, creadoPor: 'SADMIN',
          noConvenio: `3-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          tipoConvenio: 'Normal', aprobadoPorMEF: '', fechaConvenio: '',
          fechaPago: '', monto: 0, periodicidad: 'Mensual', noPagos: 1,
          socioContacto: '', estatus: 'No programado', comentarios: '',
          fechaRealizacion: '', tipoPago: '',
        }
  );

  const update = (field: keyof Convenio, value: any) => {
    if (readOnly) return;
    setConv(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!conv.tipoConvenio) { toast.error('Seleccione un tipo de convenio'); return; }
    if (conv.monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    onSave(conv);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center py-8">
      <div className="bg-white rounded-lg shadow-xl w-[700px] relative" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-primary-theme px-4 py-3 rounded-t-lg flex items-center justify-between">
          <span className="text-white text-sm font-medium">
            {mode === 'nuevo' ? 'Nuevo Convenio' : mode === 'editar' ? 'Editar Convenio' : 'Ver Convenio'}
          </span>
          <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">&times;</button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <ModalRow label="NO. CONVENIO"><input type="text" value={conv.noConvenio} disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" /></ModalRow>
            <ModalRow label="CREADO"><input type="text" value={conv.fechaCreacion} disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" /></ModalRow>
            <ModalRow label="CREADO POR"><input type="text" value={conv.creadoPor} disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" /></ModalRow>
            <ModalRow label="TIPO CONVENIO" required>
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{conv.tipoConvenio}</div> : (
                <select value={conv.tipoConvenio} onChange={e => update('tipoConvenio', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                  {CAT_TIPO_CONVENIO.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </ModalRow>
            <ModalRow label="APROBADO MEF">
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{conv.aprobadoPorMEF}</div> : (
                <input type="text" value={conv.aprobadoPorMEF} onChange={e => update('aprobadoPorMEF', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
              )}
            </ModalRow>
            <ModalRow label="FECHA CONVENIO">
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{conv.fechaConvenio}</div> : (
                <div className="flex-1">
                  <DatePicker value={conv.fechaConvenio} onChange={(date) => update('fechaConvenio', date)} placeholder="DD/MM/YYYY" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                </div>
              )}
            </ModalRow>
            <ModalRow label="FECHA DE PAGO">
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{conv.fechaPago}</div> : (
                <div className="flex-1">
                  <DatePicker value={conv.fechaPago} onChange={(date) => update('fechaPago', date)} placeholder="DD/MM/YYYY" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                </div>
              )}
            </ModalRow>
            <ModalRow label="MONTO" required>
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 text-right">{formatCurrency(conv.monto)}</div> : (
                <input type="text" value={conv.monto === 0 && mode === 'nuevo' ? '' : String(conv.monto)}
                  onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); update('monto', parseFloat(v) || 0); }}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded text-right" />
              )}
            </ModalRow>
            <ModalRow label="PERIODICIDAD">
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{conv.periodicidad}</div> : (
                <select value={conv.periodicidad} onChange={e => update('periodicidad', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                  {CAT_PERIODICIDAD.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </ModalRow>
            <ModalRow label="NO. DE PAGOS">
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{conv.noPagos}</div> : (
                <input type="text" value={String(conv.noPagos)} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); update('noPagos', parseInt(v) || 0); }}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
              )}
            </ModalRow>
            <ModalRow label="SOCIO CONTACTO">
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{conv.socioContacto}</div> : (
                <input type="text" value={conv.socioContacto} onChange={e => update('socioContacto', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
              )}
            </ModalRow>
            <ModalRow label="ESTATUS">
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{conv.estatus}</div> : (
                <select value={conv.estatus} onChange={e => update('estatus', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                  {CAT_ESTATUS_CONVENIO.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </ModalRow>
            <ModalRow label="TIPO DE PAGO">
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{conv.tipoPago}</div> : (
                <select value={conv.tipoPago} onChange={e => update('tipoPago', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                  <option value="">Seleccionar...</option>
                  {CAT_TIPO_PAGO.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </ModalRow>
            <ModalRow label="FECHA REALIZ.">
              {readOnly ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{conv.fechaRealizacion}</div> : (
                <div className="flex-1">
                  <DatePicker value={conv.fechaRealizacion} onChange={(date) => update('fechaRealizacion', date)} placeholder="DD/MM/YYYY" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                </div>
              )}
            </ModalRow>
          </div>
          <div className="mt-2">
            <div className="flex items-start gap-2">
              <label className="text-xs w-28 flex-shrink-0 text-gray-700 pt-1">COMENTARIOS</label>
              {readOnly ? (
                <div className="flex-1 px-2 py-1 text-xs text-gray-700 h-16">{conv.comentarios}</div>
              ) : (
                <textarea value={conv.comentarios} onChange={e => update('comentarios', e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded h-16 resize-none" />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
          {!readOnly && (
            <button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium">Guardar</button>
          )}
          <button onClick={onClose} className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700">
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════════

/** Form row: label (w-28) + children (flex-1) */
function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs w-28 flex-shrink-0 text-gray-700">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}

/** Modal form row */
function ModalRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs w-28 flex-shrink-0 text-gray-700">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function ExportBtn({ type }: { type: 'csv' | 'excel' | 'pdf' | 'print' }) {
  const svgs: Record<string, JSX.Element> = {
    csv: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280"/><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>,
    excel: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B"/><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2"/></svg>,
    pdf: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F"/><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none"/><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2"/></svg>,
    print: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2"/><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none"/><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2"/><circle cx="5" cy="8" r="0.8" fill="#1976D2"/></svg>,
  };
  const colors: Record<string, string> = { csv: 'hover:bg-gray-200', excel: 'hover:bg-green-100', pdf: 'hover:bg-red-100', print: 'hover:bg-blue-100' };
  const titles: Record<string, string> = { csv: 'Exportar a CSV', excel: 'Exportar a Excel', pdf: 'Exportar a PDF', print: 'Imprimir' };
  return (
    <button className={`p-1.5 ${colors[type]} rounded transition-colors hover:scale-110 transform`} title={titles[type]} onClick={() => toast.success(titles[type])}>
      {svgs[type]}
    </button>
  );
}

function PagBtn({ title, disabled, onClick, d }: { title: string; disabled: boolean; onClick: () => void; d: string }) {
  return (
    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title={title} onClick={onClick} disabled={disabled}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d={d}/></svg>
    </button>
  );
}
