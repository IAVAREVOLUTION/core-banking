/**
 * CarteraList.tsx — Módulo Gestión de Cartera · Créditos
 * Diseño institucional idéntico a CasosCobranza
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CarteraForm, type CarteraCredito } from './CarteraForm';
import { SolicitudesExtGestion } from './SolicitudesExtGestion';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

const parseMon = (v: unknown): number => parseFloat(String(v || '0').replace(/[$,\s]/g, '')) || 0;
const fmtMoney = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 });

type ViewState =
  | { type: 'inicio' }
  | { type: 'lista' }
  | { type: 'sol-ext' }
  | { type: 'detalle'; mode: 'ver' | 'editar'; credito: CarteraCredito };

// ═══════════════════════════════════════════════════════════════════
// HOOK — fetch créditos
// ═══════════════════════════════════════════════════════════════════
function useCreditos() {
  const [rows, setRows] = useState<CarteraCredito[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/solicitudes-credito`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const mapped: CarteraCredito[] = (json.data || []).map((r: any) => {
        const h = r.data?.solicitud?.header || {};
        const t = r.data?.solicitud?.terminos_condiciones?._raw || {};
        return {
          id:             r.id,
          noSol:          r.no_sol || '',
          cliente:        [r.cliente_nombre, r.cliente_ap_paterno, r.cliente_ap_materno].filter(Boolean).join(' ') || h.nombre_persona || '—',
          clienteId:      r.cliente_id || '',
          productoNombre: r.producto_nombre || h.nombre_producto || '—',
          lineaProducto:  r.linea_produc || h.linea_producto || 'Crédito',
          tipoProducto:   r.tipo_produc || h.tipo_producto || '',
          montoAut:       parseMon(r.monto_aut),
          montoSol:       parseMon(r.monto_sol),
          tasa:           t.tasa || h.tasa_autorizada || '',
          plazo:          t.plazo || h.plazo_autorizado || '',
          frecuencia:     t.frecuencia || '',
          estatus:        r.estatus_sol || 'Pendiente',
          noCuenta:       r.no_cuenta || '',
          moneda:         t.moneda || 'MXN',
          usuario:        h.responsable || '',
          gobierno:       r.institucion_gobierno || undefined,
          fechaSol:       r.fecha_sol || r.fecha_autori || '',
        };
      });
      setRows(mapped);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { rows, loading, error, refetch: fetch };
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function CarteraList() {
  const [view, setView] = useState<ViewState>({ type: 'inicio' });
  const { rows, loading, error, refetch } = useCreditos();

  const goInicio = () => setView({ type: 'inicio' });
  const goLista  = () => setView({ type: 'lista' });
  const goSolExt = () => setView({ type: 'sol-ext' });
  const goDetalle = (credito: CarteraCredito, mode: 'ver' | 'editar') =>
    setView({ type: 'detalle', mode, credito });

  const tabLabel = view.type === 'detalle'
    ? view.mode === 'editar' ? 'Editar Crédito' : 'Ver Crédito'
    : '';

  return (
    <>
      {/* Sub-navegación institucional */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={goInicio}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view.type === 'inicio' ? 'tab-active' : 'tab-inactive'}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/><path d="M6 14v-5h4v5"/>
            </svg>
            Inicio
          </button>
          <button
            onClick={goLista}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view.type === 'lista' ? 'tab-active' : 'tab-inactive'}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 4h10M3 8h10M3 12h10"/>
            </svg>
            Lista de Créditos
          </button>
          <button
            onClick={goSolExt}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view.type === 'sol-ext' ? 'tab-active' : 'tab-inactive'}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="12" height="10" rx="1"/><path d="M5 7l2 2 4-4" strokeLinecap="round"/>
            </svg>
            Sol. Extraordinarias
          </button>
          {view.type === 'detalle' && (
            <button className="flex items-center gap-2 px-3 py-1.5 rounded text-sm tab-active">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 13l8-8 2 2-8 8H3v-2z"/>
              </svg>
              {tabLabel}
            </button>
          )}
        </div>
      </div>

      {view.type === 'inicio' ? (
        <DashboardScreen rows={rows} loading={loading} error={error} refetch={refetch} onVer={c => goDetalle(c, 'ver')} />
      ) : view.type === 'lista' ? (
        <ListScreen rows={rows} loading={loading} error={error} refetch={refetch} onVer={c => goDetalle(c, 'ver')} onEditar={c => goDetalle(c, 'editar')} />
      ) : view.type === 'sol-ext' ? (
        <SolicitudesExtGestion />
      ) : (
        <CarteraForm credito={view.credito} mode={view.mode === 'editar' ? 'editar' : 'ver'} onBack={goLista} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════════════════════════════
function KPICard({ label, value, sub, iconBg, iconColor, icon }: {
  label: string; value: string | number; sub: string;
  iconBg: string; iconColor: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-300 rounded p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">{icon}</svg>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-600">{sub}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function DashboardScreen({ rows, loading, error, refetch, onVer }: {
  rows: CarteraCredito[]; loading: boolean; error: string | null;
  refetch: () => void; onVer: (c: CarteraCredito) => void;
}) {
  const kpis = useMemo(() => {
    const total     = rows.length;
    const activos   = rows.filter(r => r.estatus === 'Activa' || r.estatus === 'Autorizada').length;
    const pendientes = rows.filter(r => r.estatus === 'Pendiente').length;
    const montoTotal = rows.reduce((s, r) => s + r.montoAut, 0);
    return { total, activos, pendientes, montoTotal };
  }, [rows]);

  const distribucionEstatus = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r.estatus] = (map[r.estatus] || 0) + 1; });
    const COLORS: Record<string, string> = {
      Pendiente: '#F59E0B', Autorizada: '#10B981', Activa: '#10B981',
      Rechazada: '#EF4444', Cancelado: '#6B7280', Finiquitado: '#3B82F6',
    };
    return Object.entries(map).map(([estatus, cantidad]) => ({ estatus, cantidad, color: COLORS[estatus] || '#9CA3AF' }));
  }, [rows]);

  const distribucionLinea = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach(r => { const l = r.lineaProducto || 'Otros'; map[l] = (map[l] || 0) + 1; });
    return Object.entries(map).map(([linea, cantidad]) => ({ linea, cantidad }));
  }, [rows]);

  const recientes = useMemo(() => [...rows].slice(0, 8), [rows]);

  return (
    <div className="p-6 space-y-6 bg-[#F5F5F5] min-h-screen">
      {/* Refresh */}
      <div className="flex justify-end">
        <button onClick={refetch} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7A5 5 0 1 0 4 3"/><path d="M2 3v4h4" strokeLinecap="round"/></svg>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total de Créditos" value={kpis.total} sub="En cartera" iconBg="bg-blue-50" iconColor="#2E5C91"
          icon={<><path d="M3 5a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/></>} />
        <KPICard label="Activos" value={kpis.activos}
          sub={`${kpis.total > 0 ? ((kpis.activos / kpis.total) * 100).toFixed(1) : 0}% del total`}
          iconBg="bg-green-50" iconColor="#10B981"
          icon={<><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>} />
        <KPICard label="Pendientes" value={kpis.pendientes}
          sub={`${kpis.total > 0 ? ((kpis.pendientes / kpis.total) * 100).toFixed(1) : 0}% del total`}
          iconBg="bg-amber-50" iconColor="#F59E0B"
          icon={<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>} />
        <KPICard label="Monto Total Autorizado" value={fmtMoney(kpis.montoTotal)} sub="Suma de créditos autorizados"
          iconBg="bg-purple-50" iconColor="#7C3AED"
          icon={<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>} />
      </div>

      {/* Registros Recientes + Distribución Estatus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimos créditos en cartera</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">No. Sol.</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Línea</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">Monto Aut.</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Cargando...</td></tr>
                ) : recientes.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Sin registros</td></tr>
                ) : recientes.map((c, idx) => (
                  <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-[#0066CC] cursor-pointer hover:underline font-mono" onClick={() => onVer(c)}>{c.noSol}</td>
                    <td className="px-3 py-2 text-gray-900">{c.cliente}</td>
                    <td className="px-3 py-2 text-gray-600">{c.lineaProducto}</td>
                    <td className="px-3 py-2 text-gray-700 text-right">{fmtMoney(c.montoAut)}</td>
                    <td className="px-3 py-2 text-gray-600">{c.estatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación de créditos por estatus</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            {distribucionEstatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={distribucionEstatus} dataKey="cantidad" nameKey="estatus" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {distribucionEstatus.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'Créditos']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-xs">Sin datos</div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 pb-4 flex-wrap px-4">
            {distribucionEstatus.map(d => (
              <div key={d.estatus} className="flex items-center gap-1.5 text-xs text-gray-700">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span>{d.estatus} ({d.cantidad})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribución por Línea de Producto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Créditos por Línea de Producto</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución por tipo de producto</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distribucionLinea} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="linea" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v: number) => [v, 'Créditos']} />
                <Bar dataKey="cantidad" fill="var(--theme-primary, #2E5C91)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Monto por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Monto autorizado acumulado por estatus</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={useMemo(() => {
                  const map: Record<string, number> = {};
                  rows.forEach(r => { map[r.estatus] = (map[r.estatus] || 0) + r.montoAut; });
                  return Object.entries(map).map(([estatus, monto]) => ({ estatus, monto: Math.round(monto) }));
                }, [rows])}
                margin={{ left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="estatus" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [fmtMoney(v), 'Monto']} />
                <Bar dataKey="monto" fill="#2E5C91" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LIST SCREEN — diseño idéntico a SolicitudActivacionList
// ═══════════════════════════════════════════════════════════════════
function ListScreen({ rows, loading, error, refetch, onVer, onEditar }: {
  rows: CarteraCredito[]; loading: boolean; error: string | null;
  refetch: () => void;
  onVer: (c: CarteraCredito) => void;
  onEditar: (c: CarteraCredito) => void;
}) {
  const [search, setSearch]           = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [sortOrder, setSortOrder]     = useState<'desc' | 'asc'>('desc');
  const [page, setPage]               = useState(1);
  const PER_PAGE = 10;

  const filtered = useMemo(() => {
    let list = rows;
    if (filtroEstatus) list = list.filter(r => r.estatus === filtroEstatus);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.noSol.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.productoNombre.toLowerCase().includes(q) ||
        r.lineaProducto.toLowerCase().includes(q) ||
        r.estatus.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const da = new Date(a.fechaSol || 0).getTime();
      const db = new Date(b.fechaSol || 0).getTime();
      return sortOrder === 'desc' ? db - da : da - db;
    });
  }, [rows, search, filtroEstatus, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const statusClass = (estatus: string) => {
    if (estatus === 'Activa' || estatus === 'Autorizada') return 'text-green-700 bg-green-50 border-green-200';
    if (estatus === 'Rechazada' || estatus === 'Cancelado') return 'text-red-700 bg-red-50 border-red-200';
    if (estatus === 'Finiquitado') return 'text-blue-700 bg-blue-50 border-blue-200';
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  const exportCSV = () => {
    const headers = ['No. Sol.','Cliente','Producto','Línea','Monto Aut.','Tasa','Plazo','Moneda','Estatus'];
    const lines = filtered.map(c => [
      c.noSol, c.cliente, c.productoNombre, c.lineaProducto,
      c.montoAut, c.tasa || '', c.plazo || '', c.moneda || 'MXN', c.estatus,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `cartera_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white min-h-screen">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M8 5V3M16 5V3"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Gestión de Cartera — Créditos</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span className="cursor-pointer hover:text-secondary-theme transition-colors">Lista</span>
            <span className="cursor-pointer hover:text-secondary-theme transition-colors" onClick={() => {}}>Buscar</span>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── (idéntico a SolicitudActivacionList) */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[280px]">
              <option>Vista general de Cartera de Crédito</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666">
              <path d="M6 8l-4-4h8z" />
            </svg>
          </div>
          <button onClick={refetch} disabled={loading}
            className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
            {loading ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="2">
                <circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="1.5">
                <path d="M1 7a6 6 0 0111.196-3M13 7a6 6 0 01-11.196 3" /><path d="M1 1v3h3M13 13v-3h-3" />
              </svg>
            )}
            Refrescar
          </button>
        </div>
      </div>

      {/* ── Search / Status filter ── */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">Estatus</span>
            <div className="relative">
              <select value={filtroEstatus} onChange={e => { setFiltroEstatus(e.target.value); setPage(1); }}
                className="px-3 py-1 border border-gray-400 rounded text-sm bg-white appearance-none pr-7">
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Autorizada">Autorizada</option>
                <option value="Activa">Activa</option>
                <option value="Rechazada">Rechazada</option>
                <option value="Cancelado">Cancelado</option>
                <option value="Finiquitado">Finiquitado</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 12 12" fill="#666">
                <path d="M6 8l-4-4h8z" />
              </svg>
            </div>
          </div>
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por No. Sol., cliente, producto, línea..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-80 transition-all" />
        </div>
      </div>

      {/* ── Export / Sort bar ── */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="CSV" onClick={exportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280" /><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors" title="Excel" onClick={exportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B" /><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors" title="PDF" onClick={() => {}}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F" /><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none" /><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors" title="Imprimir" onClick={() => window.print()}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2" /><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none" /><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2" /><circle cx="5" cy="8" r="0.8" fill="#1976D2" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden</span>
              <select value={sortOrder} onChange={e => { setSortOrder(e.target.value as 'desc' | 'asc'); setPage(1); }}
                className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            <span className="font-medium">Total: {filtered.length}</span>
          </div>
        </div>
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}

      {/* ── Tabla ── */}
      <div className="px-4 py-4">
        <div className="border border-gray-300 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">Editar | Ver</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">NO. SOL.</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">CLIENTE</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">PRODUCTO</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">LÍNEA</th>
                <th className="px-2 py-2.5 text-right font-medium text-xs text-gray-700">MONTO AUT.</th>
                <th className="px-2 py-2.5 text-center font-medium text-xs text-gray-700">TASA</th>
                <th className="px-2 py-2.5 text-center font-medium text-xs text-gray-700">PLAZO</th>
                <th className="px-2 py-2.5 text-center font-medium text-xs text-gray-700">MONEDA</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">ESTATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="2">
                      <circle cx="8" cy="8" r="6" strokeDasharray="24" strokeDashoffset="12" />
                    </svg>
                    Cargando créditos...
                  </div>
                </td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-gray-500">No se encontraron créditos</td></tr>
              ) : pageRows.map((c, idx) => (
                <tr key={c.id}
                  className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E8F4F8')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF')}
                >
                  <td className="px-2 py-2.5 text-xs whitespace-nowrap">
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onEditar(c); }}>Editar</a>
                    <span className="text-gray-500"> | </span>
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onVer(c); }}>Ver</a>
                  </td>
                  <td className="px-2 py-2.5 text-xs font-mono text-[#0066CC] cursor-pointer hover:underline" onClick={() => onVer(c)}>{c.noSol}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-800 font-medium max-w-[160px] truncate" title={c.cliente}>{c.cliente}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[140px] truncate" title={c.productoNombre}>{c.productoNombre}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-600">{c.lineaProducto}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-800 text-right font-mono">{fmtMoney(c.montoAut)}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-600 text-center">{c.tasa ? `${c.tasa}%` : '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-600 text-center">{c.plazo ? `${c.plazo}m` : '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-600 text-center">{c.moneda || 'MXN'}</td>
                  <td className="px-2 py-2.5 text-xs">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${statusClass(c.estatus)}`}>
                      {c.estatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Paginación ── */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setPage(1)} disabled={page === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z" /></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">
            Página {page} de {totalPages}
          </div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
