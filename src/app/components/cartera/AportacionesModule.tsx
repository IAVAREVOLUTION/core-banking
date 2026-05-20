/**
 * AportacionesModule.tsx — Gestión de Cartera / Captación (Inversión & Ahorro)
 * Módulo similar a Créditos pero para productos de captación:
 * Calendario de Pagos, Avisos de Aportaciones, Movimientos
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

const parseMon = (v: unknown) => parseFloat(String(v || '0').replace(/[$,\s]/g, '')) || 0;
const fmtMoney = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = iso.split('T')[0].split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AportacionCredito {
  id: string; noSol: string; cliente: string; clienteId?: string;
  productoNombre: string; lineaProducto: string; tipoProducto?: string;
  montoAut: number; montoSol: number; tasa?: string; plazo?: string;
  frecuencia?: string; estatus: string; noCuenta?: string; moneda?: string; usuario?: string;
}

interface PagoCalendario {
  id: string; no_pago: number; fecha_pago: string;
  capital: number; pago_total: number; estatus: string;
}

type AportView = 'inicio' | 'lista' | 'detalle';

// ─── Hook: fetch aportaciones (captación) ─────────────────────────────────────
function useAportaciones() {
  const [rows, setRows] = useState<AportacionCredito[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/solicitudes-credito`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const mapped: AportacionCredito[] = (json.data || [])
        .filter((r: any) => {
          const linea = (r.linea_produc || '').toLowerCase();
          return linea.includes('capt') || linea.includes('invers') || linea.includes('ahorro');
        })
        .map((r: any) => {
          const h = r.data?.solicitud?.header || {};
          const t = r.data?.solicitud?.terminos_condiciones?._raw || {};
          return {
            id: r.id, noSol: r.no_sol || '',
            cliente: [r.cliente_nombre, r.cliente_ap_paterno, r.cliente_ap_materno].filter(Boolean).join(' ') || '—',
            clienteId: r.cliente_id || '',
            productoNombre: r.producto_nombre || '—',
            lineaProducto: r.linea_produc || '',
            tipoProducto: r.tipo_produc || '',
            montoAut: parseMon(r.monto_aut), montoSol: parseMon(r.monto_sol),
            tasa: t.tasa || h.tasa_autorizada || '',
            plazo: t.plazo || h.plazo_autorizado || '',
            frecuencia: t.frecuencia || '',
            estatus: r.estatus_sol || 'Pendiente',
            noCuenta: r.no_cuenta || '',
            moneda: t.moneda || 'MXN',
            usuario: h.responsable || '',
          };
        });
      setRows(mapped);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { rows, loading, error, refetch: fetch };
}

// ─── Main Module ──────────────────────────────────────────────────────────────
export function AportacionesModule() {
  const [view, setView] = useState<AportView>('inicio');
  const [selected, setSelected] = useState<AportacionCredito | null>(null);
  const { rows, loading, error, refetch } = useAportaciones();

  const goInicio  = () => setView('inicio');
  const goLista   = () => setView('lista');
  const goDetalle = (c: AportacionCredito) => { setSelected(c); setView('detalle'); };

  return (
    <>
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button onClick={goInicio} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view === 'inicio' ? 'tab-active' : 'tab-inactive'}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/><path d="M6 14v-5h4v5"/></svg>
            Inicio
          </button>
          <button onClick={goLista} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view === 'lista' ? 'tab-active' : 'tab-inactive'}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M3 8h10M3 12h10"/></svg>
            Lista de Aportaciones
          </button>
          {view === 'detalle' && selected && (
            <button className="flex items-center gap-2 px-3 py-1.5 rounded text-sm tab-active">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"/><path d="M5 8h6M5 11h4"/></svg>
              Ver Aportación
            </button>
          )}
        </div>
      </div>

      {view === 'inicio' && <AportDashboard rows={rows} loading={loading} refetch={refetch} onVer={goDetalle} />}
      {view === 'lista'  && <AportLista rows={rows} loading={loading} error={error} refetch={refetch} onVer={goDetalle} />}
      {view === 'detalle' && selected && <AportDetalle credito={selected} onBack={goLista} />}
    </>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function AportDashboard({ rows, loading, refetch, onVer }: { rows: AportacionCredito[]; loading: boolean; refetch: () => void; onVer: (c: AportacionCredito) => void }) {
  const kpis = useMemo(() => ({
    total:    rows.length,
    activas:  rows.filter(r => r.estatus === 'Activa' || r.estatus === 'Autorizada').length,
    pendientes: rows.filter(r => r.estatus === 'Pendiente').length,
    monto:    rows.reduce((s, r) => s + r.montoAut, 0),
  }), [rows]);

  const distribucion = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r.estatus] = (map[r.estatus] || 0) + 1; });
    const COLORS: Record<string, string> = { Pendiente: '#F59E0B', Autorizada: '#10B981', Activa: '#10B981', Rechazada: '#EF4444' };
    return Object.entries(map).map(([k, v]) => ({ estatus: k, cantidad: v, color: COLORS[k] || '#9CA3AF' }));
  }, [rows]);

  return (
    <div className="p-6 space-y-6 bg-[#F5F5F5] min-h-screen">
      <div className="flex justify-end">
        <button onClick={refetch} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7A5 5 0 1 0 4 3"/><path d="M2 3v4h4" strokeLinecap="round"/></svg>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Aportaciones', value: kpis.total,  sub: 'En cartera captación', color: '#2E5C91' },
          { label: 'Activas',            value: kpis.activas, sub: `${kpis.total > 0 ? ((kpis.activas/kpis.total)*100).toFixed(1) : 0}% del total`, color: '#10B981' },
          { label: 'Pendientes',         value: kpis.pendientes, sub: `${kpis.total > 0 ? ((kpis.pendientes/kpis.total)*100).toFixed(1) : 0}% del total`, color: '#F59E0B' },
          { label: 'Monto Total',        value: fmtMoney(kpis.monto), sub: 'Captación autorizada', color: '#7C3AED' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-gray-300 rounded p-4">
            <p className="text-xs text-gray-600 mb-1">{kpi.label}</p>
            <p className="text-2xl font-semibold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-2">{kpi.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimas aportaciones en cartera</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">No. Sol.</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">Monto</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((c, idx) => (
                  <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-[#0066CC] cursor-pointer hover:underline font-mono" onClick={() => onVer(c)}>{c.noSol}</td>
                    <td className="px-3 py-2 text-gray-800">{c.cliente}</td>
                    <td className="px-3 py-2 text-gray-700 text-right">{fmtMoney(c.montoAut)}</td>
                    <td className="px-3 py-2 text-gray-600">{c.estatus}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Sin registros</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white border border-gray-300 rounded">
          <div className="border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Captación por estatus actual</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            {distribucion.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={distribucion} dataKey="cantidad" nameKey="estatus" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {distribucion.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'Aportaciones']} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px] flex items-center justify-center text-gray-400 text-xs">Sin datos</div>}
          </div>
          <div className="flex items-center justify-center gap-4 pb-4 flex-wrap px-4">
            {distribucion.map(d => (
              <div key={d.estatus} className="flex items-center gap-1.5 text-xs text-gray-700">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span>{d.estatus} ({d.cantidad})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Lista ─────────────────────────────────────────────────────────────────────
function AportLista({ rows, loading, error, refetch, onVer }: { rows: AportacionCredito[]; loading: boolean; error: string | null; refetch: () => void; onVer: (c: AportacionCredito) => void }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => r.noSol.toLowerCase().includes(q) || r.cliente.toLowerCase().includes(q) || r.productoNombre.toLowerCase().includes(q));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 6h14M4 10h14M4 14h10"/></svg>
            <h2 className="text-lg font-normal text-gray-800">Lista de Aportaciones / Captación</h2>
            <button onClick={refetch} disabled={loading} className="p-1 text-gray-400 hover:text-gray-600">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7A5 5 0 1 0 4 3"/><path d="M2 3v4h4"/></svg>
            </button>
          </div>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar..." className="px-3 py-1 border border-gray-400 rounded text-sm w-56 bg-white" />
        </div>
      </div>
      {error && <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
      <div className="px-4 py-4">
        <div className="border border-gray-300 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#D0D0D0] border-b border-gray-300">
                <th className="px-3 py-2.5 text-left font-normal text-gray-700">Ver</th>
                <th className="px-3 py-2.5 text-left font-normal text-gray-700">NO. SOL.</th>
                <th className="px-3 py-2.5 text-left font-normal text-gray-700">CLIENTE</th>
                <th className="px-3 py-2.5 text-left font-normal text-gray-700">PRODUCTO</th>
                <th className="px-3 py-2.5 text-left font-normal text-gray-700">LÍNEA</th>
                <th className="px-3 py-2.5 text-right font-normal text-gray-700">MONTO AUT.</th>
                <th className="px-3 py-2.5 text-center font-normal text-gray-700">TASA</th>
                <th className="px-3 py-2.5 text-center font-normal text-gray-700">PLAZO</th>
                <th className="px-3 py-2.5 text-left font-normal text-gray-700">ESTATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">Cargando...</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">Sin aportaciones registradas</td></tr>
              ) : pageRows.map((c, idx) => (
                <tr key={c.id}
                  className="border-b border-gray-200 transition-colors"
                  style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                >
                  <td className="px-3 py-2.5 text-xs">
                    <button className="text-[#0066CC] hover:underline" onClick={() => onVer(c)}>Ver</button>
                  </td>
                  <td className="px-3 py-2.5 text-[#0066CC] cursor-pointer hover:underline font-mono" onClick={() => onVer(c)}>{c.noSol}</td>
                  <td className="px-3 py-2.5 text-gray-800 font-medium">{c.cliente}</td>
                  <td className="px-3 py-2.5 text-gray-700">{c.productoNombre}</td>
                  <td className="px-3 py-2.5 text-gray-600">{c.lineaProducto}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-800">{fmtMoney(c.montoAut)}</td>
                  <td className="px-3 py-2.5 text-center text-gray-600">{c.tasa ? `${c.tasa}%` : '—'}</td>
                  <td className="px-3 py-2.5 text-center text-gray-600">{c.plazo ? `${c.plazo}m` : '—'}</td>
                  <td className="px-3 py-2.5 text-gray-700">{c.estatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-500">{filtered.length} aportaciones</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p=>p-1)} disabled={page===1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-40">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#555" strokeWidth="1.5"><path d="M8 3L3 7l5 4V3z"/></svg>
            </button>
            <span className="text-xs text-gray-600">Pág. {page} / {totalPages}</span>
            <button onClick={() => setPage(p=>p+1)} disabled={page===totalPages} className="p-1 hover:bg-gray-100 rounded disabled:opacity-40">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#555" strokeWidth="1.5"><path d="M6 3l5 4-5 4V3z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detalle de Aportación ────────────────────────────────────────────────────
function AportDetalle({ credito, onBack }: { credito: AportacionCredito; onBack: () => void }) {
  const TABS = [
    { id: 'default',    label: 'Default' },
    { id: 'calendario', label: 'Calendario de Pagos' },
    { id: 'avisos',     label: 'Avisos de Aportaciones' },
    { id: 'movimientos', label: 'Movimientos' },
  ];
  const [activeTab, setActiveTab] = useState('default');

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-400 hover:text-gray-700 p-1">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4L6 9l5 5"/></svg>
            </button>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#666" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M11 7v4l3 2"/></svg>
            <h2 className="text-lg font-normal text-gray-800">Aportación — {credito.noSol}</h2>
          </div>
          <span className="text-sm text-gray-500">{credito.estatus}</span>
        </div>
      </div>

      {/* Info strip */}
      <div className="px-4 py-2.5 bg-[#F0F2F5] border-b border-gray-300">
        <div className="flex flex-wrap gap-x-8 gap-y-1.5">
          {[
            { label: 'Cliente',    value: credito.cliente },
            { label: 'Producto',   value: credito.productoNombre },
            { label: 'Línea',      value: credito.lineaProducto },
            { label: 'Monto Aut.', value: fmtMoney(credito.montoAut) },
            { label: 'Tasa',       value: credito.tasa ? `${credito.tasa}%` : '—' },
            { label: 'Plazo',      value: credito.plazo ? `${credito.plazo}m` : '—' },
            { label: 'No. Cuenta', value: credito.noCuenta || '—' },
          ].map(c => (
            <div key={c.label} className="flex flex-col">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide">{c.label}</span>
              <span className="text-xs text-gray-800 font-medium">{c.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-primary-theme text-white border-b border-gray-400">
        <div className="px-4 flex items-center overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-secondary-theme text-white font-medium' : 'text-white/90 hover:bg-white/10'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 bg-[#F5F5F5]">
        {activeTab === 'default'    && <AportDefaultTab credito={credito} />}
        {activeTab === 'calendario' && <CalendarioPagosTab solicitudId={credito.id} moneda={credito.moneda} />}
        {activeTab === 'avisos'     && <AvisosAportacionTab solicitudId={credito.id} />}
        {activeTab === 'movimientos' && <MovimientosTab solicitudId={credito.id} clienteId={credito.clienteId} />}
      </div>
    </div>
  );
}

// ─── Default Tab (Aportación) ─────────────────────────────────────────────────
function AportDefaultTab({ credito }: { credito: AportacionCredito }) {
  return (
    <div className="bg-white border border-gray-300 p-4 space-y-6">
      <div className="bg-primary-tint-theme px-3 py-2 text-sm font-medium text-gray-800 border-l-4 border-primary-theme mb-3">
        Términos y Condiciones de la Aportación
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <div className="space-y-3">
          {[
            { label: 'No. Solicitud',   value: credito.noSol },
            { label: 'No. Cuenta',      value: credito.noCuenta || '—' },
            { label: 'Línea',           value: credito.lineaProducto },
            { label: 'Producto',        value: credito.productoNombre },
            { label: 'Estatus',         value: credito.estatus },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2 py-1 border-b border-gray-100">
              <span className="text-xs text-gray-500 w-40">{f.label}</span>
              <span className="text-xs text-gray-800 font-medium">{f.value}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[
            { label: 'Monto Autorizado', value: fmtMoney(credito.montoAut) },
            { label: 'Tasa',             value: credito.tasa ? `${credito.tasa}%` : '—' },
            { label: 'Plazo',            value: credito.plazo ? `${credito.plazo} meses` : '—' },
            { label: 'Frecuencia',       value: credito.frecuencia || '—' },
            { label: 'Moneda',           value: credito.moneda || 'MXN' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2 py-1 border-b border-gray-100">
              <span className="text-xs text-gray-500 w-40">{f.label}</span>
              <span className="text-xs text-gray-800 font-medium">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Calendario de Pagos ──────────────────────────────────────────────────────
function CalendarioPagosTab({ solicitudId, moneda = 'MXN' }: { solicitudId: string; moneda?: string }) {
  const [rows, setRows]       = useState<PagoCalendario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/cartera/amortizaciones/${solicitudId}`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows((json.data || []).map((r: any) => ({
        id: r.id, no_pago: r.no_pago || r.numero_pago,
        fecha_pago: r.fecha_pago || r.fecha,
        capital: parseMon(r.pago_capital || r.capital),
        pago_total: parseMon(r.pago_total || r.pago_periodo),
        estatus: r.estatus || 'Pendiente',
      })));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [solicitudId]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggle = (id: string, estatus: string) => {
    if (estatus !== 'Pendiente') return;
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectedRows = rows.filter(r => selected.has(r.id));
  const totalCapital = selectedRows.reduce((s, r) => s + r.capital, 0);
  const totalPago    = selectedRows.reduce((s, r) => s + r.pago_total, 0);

  const handleAvisoPago = async () => {
    if (selected.size === 0) { toast.error('Seleccione aportaciones'); return; }
    setEnviando(true);
    try {
      const amortizaciones = selectedRows.map(r => ({
        id: r.id, pago_total: r.pago_total, pago_capital: r.capital,
        pago_interes: 0, iva_interes: 0, pago_seguro: 0, iva_seguro: 0,
      }));
      const res = await fetch(`${API_BASE}/cartera/facturas`, {
        method: 'POST', headers: HDR,
        body: JSON.stringify({ solicitud_id: solicitudId, amortizaciones, moneda, sub_tipo: 'Aportacion' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success('Aviso de aportación creado', { description: `Folio: ${json.no_docto}` });
      setSelected(new Set()); cargar();
    } catch (e: any) {
      toast.error('Error al crear aviso', { description: (e as any).message });
    } finally { setEnviando(false); }
  };

  const ESTATUS_COLOR: Record<string, string> = {
    Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
    Facturada: 'bg-blue-50 text-blue-700 border-blue-200',
    Pagada:    'bg-green-50 text-green-700 border-green-200',
  };

  return (
    <div className="bg-white border border-gray-300 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{rows.length} pagos · {selected.size} seleccionados</span>
        <div className="flex items-center gap-2">
          <button onClick={cargar} className="text-xs text-blue-600 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/></svg>
            Actualizar
          </button>
          <button onClick={handleAvisoPago} disabled={selected.size === 0 || enviando}
            className="px-3 py-1.5 text-xs font-medium rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 1v6M3 4l3 3 3-3" strokeLinecap="round"/><rect x="1" y="8" width="10" height="3" rx="1"/></svg>
            Aviso Pago {selected.size > 0 && `(${selected.size})`}
          </button>
        </div>
      </div>
      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#2E5C91] text-white">
              <th className="px-2 py-2 text-center w-8"><input type="checkbox" /></th>
              <th className="px-2 py-2 text-center font-medium w-10">No.</th>
              <th className="px-2 py-2 text-left font-medium">Fecha</th>
              <th className="px-2 py-2 text-right font-medium">Capital</th>
              <th className="px-2 py-2 text-right font-medium">Total Pago</th>
              <th className="px-2 py-2 text-center font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Cargando...</td></tr>
            : rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Sin calendario de pagos</td></tr>
            : rows.map((r, idx) => {
              const isPend = r.estatus === 'Pendiente';
              const isSel  = selected.has(r.id);
              return (
                <tr key={r.id} onClick={() => toggle(r.id, r.estatus)}
                  className={`border-b border-gray-100 transition-colors ${isSel ? 'bg-blue-50' : idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${isPend ? 'cursor-pointer hover:bg-blue-50/60' : ''}`}>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={isSel} disabled={!isPend} onChange={() => toggle(r.id, r.estatus)} onClick={e => e.stopPropagation()} className="disabled:opacity-30" />
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600">{r.no_pago}</td>
                  <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{fmtDate(r.fecha_pago)}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{fmtMoney(r.capital)}</td>
                  <td className="px-2 py-2 text-right font-medium text-gray-800">{fmtMoney(r.pago_total)}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTATUS_COLOR[r.estatus] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>{r.estatus}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {selected.size > 0 && (
            <tfoot>
              <tr className="bg-blue-100 border-t border-blue-200 font-medium text-blue-900">
                <td colSpan={3} className="px-2 py-2 text-right text-[10px] uppercase">Selección:</td>
                <td className="px-2 py-2 text-right">{fmtMoney(totalCapital)}</td>
                <td className="px-2 py-2 text-right font-bold">{fmtMoney(totalPago)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Avisos de Aportaciones ───────────────────────────────────────────────────
function AvisosAportacionTab({ solicitudId }: { solicitudId: string }) {
  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/cartera/avisos/${solicitudId}`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows((json.data || []).map((r: any) => ({ ...r, monto_transaccion: parseMon(r.monto_transaccion) })));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [solicitudId]);

  useEffect(() => { cargar(); }, [cargar]);

  const ESTATUS_COLOR: Record<string, string> = {
    Pendiente: 'bg-amber-50 text-amber-700', Pagado: 'bg-green-50 text-green-700',
  };

  return (
    <div className="bg-white border border-gray-300 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{rows.length} aviso{rows.length !== 1 ? 's' : ''} de aportación</span>
        <button onClick={cargar} className="text-xs text-blue-600 flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/></svg>
          Actualizar
        </button>
      </div>
      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#2E5C91] text-white">
              <th className="px-3 py-2.5 text-left font-medium">No. Documento</th>
              <th className="px-3 py-2.5 text-left font-medium">Fecha Emisión</th>
              <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
              <th className="px-3 py-2.5 text-right font-medium">Monto</th>
              <th className="px-3 py-2.5 text-center font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Cargando...</td></tr>
            : rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Sin avisos de aportación</td></tr>
            : rows.map((r, idx) => (
              <tr key={r.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-3 py-2.5 font-mono text-gray-600">{r.no_docto || '—'}</td>
                <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{fmtDate(r.fecha)}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.tipo}</td>
                <td className="px-3 py-2.5 text-right font-medium text-gray-800">{fmtMoney(r.monto_transaccion)}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${ESTATUS_COLOR[r.estatus] || 'bg-gray-50 text-gray-600'}`}>{r.estatus}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Movimientos ──────────────────────────────────────────────────────────────
function MovimientosTab({ solicitudId, clienteId }: { solicitudId: string; clienteId?: string }) {
  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/cuenta-eje/movimientos?cliente_id=${clienteId}`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows(json.data || json.movimientos || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [clienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const total = rows.reduce((s: number, r: any) => s + parseMon(r.monto || r.importe || 0), 0);

  return (
    <div className="bg-white border border-gray-300 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{rows.length} movimiento{rows.length !== 1 ? 's' : ''} {rows.length > 0 && `· ${fmtMoney(total)}`}</span>
        <button onClick={cargar} className="text-xs text-blue-600 flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/></svg>
          Actualizar
        </button>
      </div>
      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#2E5C91] text-white">
              <th className="px-3 py-2.5 text-left font-medium">Fecha</th>
              <th className="px-3 py-2.5 text-left font-medium">Concepto</th>
              <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
              <th className="px-3 py-2.5 text-right font-medium">Monto</th>
              <th className="px-3 py-2.5 text-center font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Cargando...</td></tr>
            : rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Sin movimientos registrados</td></tr>
            : rows.map((r: any, idx: number) => (
              <tr key={r.id || idx} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{fmtDate(r.fecha || r.created_at)}</td>
                <td className="px-3 py-2.5 text-gray-700">{r.concepto || r.descripcion || '—'}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.tipo || r.type || '—'}</td>
                <td className="px-3 py-2.5 text-right font-medium text-gray-800">{fmtMoney(parseMon(r.monto || r.importe || 0))}</td>
                <td className="px-3 py-2.5 text-center text-gray-600">{r.estatus || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
