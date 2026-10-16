/**
 * CarteraTDCModule — Cartera TDC.
 *
 * Las Líneas de Crédito de Tarjeta no generan Solicitud de Activación: al
 * liberarse quedan operando. Este módulo es su administración, con el mismo
 * criterio de separación que ya aplican Arrendamiento y Banca 2º Piso — una
 * cuenta se administra en un solo lugar, así que estas cuentas se excluyen de
 * Cartera de Crédito ([carteraTDCStore.ts](./carteraTDCStore.ts)).
 *
 * Diseño homologado con Originación: Inicio (KPIs + recientes + gráficas) y
 * Lista (filtros, barra de acciones y paginación).
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { CarteraTDCForm, type CuentaTDC } from './CarteraTDCForm';
import { esCuentaTDCRow } from './carteraTDCStore';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

const parseMon = (v: unknown) => parseFloat(String(v || '0').replace(/[$,\s]/g, '')) || 0;
const fmtCur = (n: number) =>
  `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Acepta dd/mm/aa, dd/mm/aaaa e ISO — igual que el resto del sistema. */
function parseFecha(f: string): Date {
  if (!f) return new Date(0);
  if (f.includes('/')) {
    const [d, m, y] = f.split('/');
    const anio = y?.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y || '0', 10);
    return new Date(anio, parseInt(m, 10) - 1, parseInt(d, 10));
  }
  const d = new Date(f);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

type ViewState =
  | { type: 'inicio' }
  | { type: 'lista' }
  | { type: 'detalle'; mode: 'ver' | 'editar'; cuenta: CuentaTDC };

function useCuentasTDC() {
  const [rows, setRows] = useState<CuentaTDC[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/solicitudes-credito`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      const mapped: CuentaTDC[] = (json.data || [])
        .filter((r: any) => {
          const h = r.data?.solicitud?.header || {};
          return esCuentaTDCRow(
            r.linea_produc || h.linea_producto || '',
            r.tipo_produc || h.tipo_producto || '',
            r.producto_nombre || h.nombre_producto || '',
          );
        })
        .map((r: any) => {
          const h = r.data?.solicitud?.header || {};
          const t = r.data?.solicitud?.terminos_condiciones?._raw || {};
          return {
            id: r.id,
            noSol: r.no_sol || '',
            cliente: [r.cliente_nombre, r.cliente_ap_paterno, r.cliente_ap_materno].filter(Boolean).join(' ') || h.nombre_persona || '—',
            clienteId: r.cliente_id || '',
            productoNombre: r.producto_nombre || h.nombre_producto || '—',
            productoId: h.producto_id || '',
            lineaProducto: r.linea_produc || h.linea_producto || 'Línea de Crédito',
            tipoProducto: r.tipo_produc || h.tipo_producto || '',
            montoAut: parseMon(r.monto_aut),
            montoSol: parseMon(r.monto_sol),
            tasa: t.tasa || h.tasa_autorizada || '',
            plazo: t.plazo || h.plazo_autorizado || '',
            frecuencia: t.frecuencia || '',
            estatus: r.estatus_sol || h.estatus || '—',
            noCuenta: r.no_cuenta || h.no_cuenta || '',
            moneda: t.moneda || 'MXN',
            fechaSol: r.fecha_sol || h.fecha_solicitud || '',
            // El objeto completo, no sólo los campos del encabezado: el subtab
            // de Términos lo necesita entero para hidratarse.
            terminos: t,
          } as CuentaTDC;
        });

      setRows(mapped);
    } catch (e: any) {
      setError(e.message || 'No se pudo consultar la cartera.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  return { rows, loading, error, refetch: cargar };
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO
// ═══════════════════════════════════════════════════════════════════
export function CarteraTDCModule() {
  const [view, setView] = useState<ViewState>({ type: 'inicio' });
  const { rows, loading, error, refetch } = useCuentasTDC();

  const subNav = (
    <div className="bg-gray-100 border-b border-gray-300">
      <div className="px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => setView({ type: 'inicio' })}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view.type === 'inicio' ? 'tab-active' : 'tab-inactive'}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z" /><path d="M6 14v-5h4v5" />
          </svg>
          Inicio
        </button>
        <button
          onClick={() => setView({ type: 'lista' })}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view.type === 'lista' ? 'tab-active' : 'tab-inactive'}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4h10M3 8h10M3 12h10" />
          </svg>
          Lista de Cartera TDC
        </button>
        {view.type === 'detalle' && (
          <button className="flex items-center gap-2 px-3 py-1.5 rounded text-sm tab-active">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 13l8-8 2 2-8 8H3v-2z" />
            </svg>
            {view.mode === 'editar' ? 'Editar Cuenta' : 'Ver Cuenta'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {subNav}
      {view.type === 'inicio' ? (
        <DashboardTDC rows={rows} loading={loading} onGoToList={() => setView({ type: 'lista' })} />
      ) : view.type === 'lista' ? (
        <ListaTDC
          rows={rows}
          loading={loading}
          error={error}
          refetch={refetch}
          onVer={c => setView({ type: 'detalle', mode: 'ver', cuenta: c })}
          onEditar={c => setView({ type: 'detalle', mode: 'editar', cuenta: c })}
        />
      ) : (
        <CarteraTDCForm
          cuenta={view.cuenta}
          mode={view.mode}
          onBack={() => setView({ type: 'lista' })}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INICIO — mismo layout que el Dashboard de Originación
// ═══════════════════════════════════════════════════════════════════
function DashboardTDC({ rows, loading, onGoToList }: {
  rows: CuentaTDC[];
  loading: boolean;
  onGoToList: () => void;
}) {
  const total = rows.length;
  const limiteTotal = rows.reduce((s, r) => s + r.montoAut, 0);
  const activas = rows.filter(r => /activ/i.test(r.estatus)).length;
  const tasaActivacion = total > 0 ? (activas / total) * 100 : 0;
  const limitePromedio = total > 0 ? limiteTotal / total : 0;

  const recientes = [...rows]
    .sort((a, b) => parseFecha(b.fechaSol || '').getTime() - parseFecha(a.fechaSol || '').getTime())
    .slice(0, 8);

  /** Distribución real por estatus — los colores salen de una paleta fija por orden. */
  const PALETA = ['#3B82F6', '#10B981', '#F59E0B', '#7C3AED', '#EF4444', '#6B7280'];
  const distribucionEstatus = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach(r => counts.set(r.estatus || '—', (counts.get(r.estatus || '—') || 0) + 1));
    return [...counts.entries()].map(([estatus, cantidad], i) => ({
      estatus, cantidad, color: PALETA[i % PALETA.length],
    }));
  }, [rows]);

  /** Distribución por producto — en TDC suele haber varias tarjetas. */
  const distribucionProducto = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach(r => counts.set(r.productoNombre || '—', (counts.get(r.productoNombre || '—') || 0) + 1));
    return [...counts.entries()].map(([producto, cantidad], i) => ({
      producto: producto.length > 18 ? `${producto.slice(0, 18)}…` : producto,
      cantidad,
      color: PALETA[i % PALETA.length],
    }));
  }, [rows]);

  /** Evolución real por mes de alta, últimos 6 meses. */
  const evolucion = useMemo(() => {
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hoy = new Date();
    const buckets: { mes: string; cuentas: number; key: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      buckets.push({ mes: MESES[d.getMonth()], cuentas: 0, key: `${d.getFullYear()}-${d.getMonth()}` });
    }
    rows.forEach(r => {
      const d = parseFecha(r.fechaSol || '');
      if (d.getTime() === 0) return;
      const b = buckets.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (b) b.cuentas++;
    });
    return buckets;
  }, [rows]);

  const crecimiento = (() => {
    const prev = evolucion[evolucion.length - 2]?.cuentas || 0;
    const act = evolucion[evolucion.length - 1]?.cuentas || 0;
    if (prev === 0) return act > 0 ? '100.0' : '0.0';
    return (((act - prev) / prev) * 100).toFixed(1);
  })();

  const estatusBadge = (e: string) => {
    const s = (e || '').toLowerCase();
    if (s.includes('activ')) return 'bg-green-100 text-green-700';
    if (s.includes('proceso')) return 'bg-blue-100 text-blue-700';
    if (s.includes('pend')) return 'bg-yellow-100 text-yellow-700';
    if (s.includes('cancel') || s.includes('rechaz')) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-6 space-y-6 bg-[#F5F5F5] min-h-screen">
      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total de Cuentas TDC</p>
              <p className="text-2xl text-gray-900">{total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E5C91" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
              </svg>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className={Number(crecimiento) >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Number(crecimiento) >= 0 ? '+' : ''}{crecimiento}%
            </span>
            <span className="text-gray-600">vs. mes anterior</span>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Límite Autorizado Total</p>
              <p className="text-2xl text-gray-900">{fmtCur(limiteTotal)}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">Promedio: {fmtCur(limitePromedio)}</div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Cuentas Activas</p>
              <p className="text-2xl text-gray-900">{tasaActivacion.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">{activas} de {total} activas</div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Productos Distintos</p>
              <p className="text-2xl text-gray-900">{distribucionProducto.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">Tarjetas en cartera</div>
        </div>
      </div>

      {/* ── Recientes + Estatus ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimas cuentas de tarjeta liberadas</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-700">N° Solicitud</th>
                  <th className="text-left px-3 py-2 text-gray-700">Cliente</th>
                  <th className="text-left px-3 py-2 text-gray-700">Límite</th>
                  <th className="text-left px-3 py-2 text-gray-700">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Cargando…</td></tr>
                ) : recientes.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Sin cuentas de tarjeta registradas.</td></tr>
                ) : recientes.map((r, idx) => (
                  <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900">{r.noSol}</td>
                    <td className="px-3 py-2 text-gray-700">{r.cliente.length > 25 ? `${r.cliente.slice(0, 25)}…` : r.cliente}</td>
                    <td className="px-3 py-2 text-gray-900">{fmtCur(r.montoAut)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${estatusBadge(r.estatus)}`}>{r.estatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-300 flex justify-end">
            <button onClick={onGoToList} className="text-xs text-[#0066CC] hover:underline">Ver toda la cartera →</button>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Distribución por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Estado general de las cuentas</p>
          </div>
          <div className="p-4">
            {distribucionEstatus.length === 0 ? (
              <div className="flex items-center justify-center h-[240px] text-gray-400 text-xs">Sin datos disponibles</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart id="tdc-pie-estatus">
                    <Pie data={distribucionEstatus} cx="50%" cy="50%" labelLine={false} label={false} outerRadius={90} dataKey="cantidad" nameKey="estatus">
                      {distribucionEstatus.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {distribucionEstatus.map(e => (
                    <div key={e.estatus} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                      <span className="text-xs text-gray-700">{e.estatus}: {e.cantidad}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Gráficas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Evolución de la Cartera</h2>
            <p className="text-xs text-gray-600 mt-0.5">Altas en los últimos 6 meses</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart id="tdc-line-evolucion" data={evolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="cuentas" stroke="#2E5C91" strokeWidth={2} dot={{ fill: '#2E5C91', r: 4 }} activeDot={{ r: 6 }} name="Cuentas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Cuentas por Producto</h2>
            <p className="text-xs text-gray-600 mt-0.5">Tarjetas contratadas por producto</p>
          </div>
          <div className="p-4">
            {distribucionProducto.length === 0 ? (
              <div className="flex items-center justify-center h-[240px] text-gray-400 text-xs">Sin datos disponibles</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart id="tdc-bar-producto" data={distribucionProducto}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="producto" tick={{ fontSize: 11 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} name="Cuentas">
                    {distribucionProducto.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LISTA — mismo layout que la Lista de Originación
// ═══════════════════════════════════════════════════════════════════
function ListaTDC({ rows, loading, error, refetch, onVer, onEditar }: {
  rows: CuentaTDC[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  onVer: (c: CuentaTDC) => void;
  onEditar: (c: CuentaTDC) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [fEstatus, setFEstatus] = useState('');
  const [fProducto, setFProducto] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const exportar = (formato: string, detalle: string) =>
    toast.success(`Exportando a ${formato}`, { description: detalle, duration: 3000 });

  const estatusDisponibles = useMemo(
    () => [...new Set(rows.map(r => r.estatus).filter(Boolean))],
    [rows],
  );
  const productosDisponibles = useMemo(
    () => [...new Set(rows.map(r => r.productoNombre).filter(Boolean))],
    [rows],
  );

  const filtered = rows.filter(r => {
    if (fEstatus && r.estatus !== fEstatus) return false;
    if (fProducto && r.productoNombre !== fProducto) return false;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return [r.noSol, r.cliente, r.productoNombre, r.noCuenta, r.estatus]
        .some(v => String(v || '').toLowerCase().includes(t));
    }
    return true;
  }).sort((a, b) => {
    const da = parseFecha(a.fechaSol || '').getTime();
    const db = parseFecha(b.fechaSol || '').getTime();
    return sortOrder === 'desc' ? db - da : da - db;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
            </svg>
            <h2 className="text-lg text-gray-800">Cartera TDC</h2>
            <button className="p-1 ml-2" onClick={() => searchRef.current?.focus()}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2"><circle cx="8" cy="8" r="6" /><path d="M13 13l3 3" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span
              className="cursor-pointer hover:text-secondary-theme transition-colors"
              onClick={() => {
                if (tableRef.current) {
                  tableRef.current.classList.add('animate-highlight');
                  setTimeout(() => tableRef.current?.classList.remove('animate-highlight'), 1000);
                }
              }}
            >
              Lista
            </span>
            <span className="cursor-pointer hover:text-secondary-theme transition-colors" onClick={() => searchRef.current?.focus()}>Buscar</span>
          </div>
        </div>
      </div>

      {/* Selector de vista */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[250px]">
              <option>Vista general de Cartera TDC</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z" /></svg>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Filtros</span>
          <div className="flex items-center gap-2">
            <select value={fProducto} onChange={e => { setFProducto(e.target.value); setCurrentPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded">
              <option value="">Producto: Todos</option>
              {productosDisponibles.map(pr => <option key={pr} value={pr}>{pr}</option>)}
            </select>
            <select value={fEstatus} onChange={e => { setFEstatus(e.target.value); setCurrentPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded">
              <option value="">Estatus: Todos</option>
              {estatusDisponibles.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Buscar cuentas..."
              className="px-3 py-1 border border-gray-400 rounded text-sm w-64 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Barra de iconos de acción */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors hover:scale-110 transform" title="Exportar a CSV" onClick={() => exportar('CSV', 'El archivo CSV se está descargando...')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280" /><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors hover:scale-110 transform" title="Exportar a Excel" onClick={() => exportar('Excel', 'El archivo se está descargando...')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B" /><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors hover:scale-110 transform" title="Exportar a PDF" onClick={() => exportar('PDF', 'El archivo PDF se está descargando...')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F" /><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none" /><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors hover:scale-110 transform" title="Imprimir" onClick={() => exportar('impresión', 'Enviando documento a la impresora...')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2" /><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none" /><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2" /><circle cx="5" cy="8" r="0.8" fill="#1976D2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors hover:scale-110 transform" title="Actualizar" onClick={refetch}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6B7280" strokeWidth="1.6"><path d="M3 10a7 7 0 1 1 2.5 5.4" /><path d="M3 5v5h5" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden Rápido</span>
              <div className="relative">
                <select value={sortOrder} onChange={e => { setSortOrder(e.target.value as 'desc' | 'asc'); setCurrentPage(1); }} className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666"><path d="M5 7l-3-3h6z" /></svg>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-0.5 text-secondary-theme disabled:opacity-40" title="Anterior" onClick={() => setCurrentPage(pg => Math.max(1, pg - 1))} disabled={currentPage === 1}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z" /></svg>
              </button>
              <button className="p-0.5 text-secondary-theme disabled:opacity-40" title="Siguiente" onClick={() => setCurrentPage(pg => Math.min(totalPages, pg + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z" /></svg>
              </button>
            </div>
            <span>Total: {filtered.length}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700">{error}</div>
      )}

      {/* Tabla */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-x-auto" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm min-w-[980px]" style={{ backgroundColor: 'transparent' }}>
            <thead>
              <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Editar | Ver</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">N° SOLICITUD</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">CLIENTE</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">PRODUCTO</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">N° CUENTA</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">ESTATUS</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">FECHA</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">LÍMITE AUT.</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">TASA</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">Cargando cartera…</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">No se encontraron cuentas de Tarjeta de Crédito</td></tr>
              ) : paginated.map((r, idx) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E8F4F8')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF')}
                >
                  <td className="px-3 py-2.5 text-xs">
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onEditar(r); }}>Editar</a>
                    <span className="text-gray-700"> | </span>
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onVer(r); }}>Ver</a>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{r.noSol}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{r.cliente}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{r.productoNombre}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{r.noCuenta || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{r.estatus}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{r.fechaSol || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{fmtCur(r.montoAut)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{r.tasa ? `${r.tasa}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Primera página" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Página anterior" onClick={() => setCurrentPage(pg => Math.max(1, pg - 1))} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z" /></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {currentPage} de {totalPages || 1}</div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Página siguiente" onClick={() => setCurrentPage(pg => Math.min(totalPages, pg + 1))} disabled={currentPage === totalPages || totalPages === 0}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Última página" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
