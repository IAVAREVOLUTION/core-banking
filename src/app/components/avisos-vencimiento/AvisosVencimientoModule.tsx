import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DatePicker } from '@/app/components/ui/DatePicker';

// ═══════════════════════════════════════════════════════════════════
// STORE (inline — prefix: aviso_venc_)
// ═══════════════════════════════════════════════════════════════════
interface AvisoVencFormData {
  noAviso: string;
  noCredito: string;
  noCliente: string;
  cliente: string;
  fechaAviso: string;
  fechaVencimiento: string;
  estatus: string;
  subEstatus: string;
  responsable: string;
  observaciones: string;
}

interface DetalleRow {
  id: number;
  concepto: string;
  cantidad: number;
  monto: number;
  subtotal: number;
  pagado: number;
  saldo: number;
  estatusConcepto: string;
}

interface AvisoListItem {
  id: number;
  noAviso: string;
  noCredito: string;
  noCliente: string;
  cliente: string;
  fechaAviso: string;
  fechaVencimiento: string;
  estatus: string;
  subEstatus: string;
  responsable: string;
  montoTotal: number;
}

const SAVED: Record<string, Record<string, any>> = {};
function sKey(id: number | 'new', sub: string) { return `aviso_venc_${id}_${sub}`; }
function ssSave<T>(id: number | 'new', sub: string, d: T) { try { sessionStorage.setItem(sKey(id, sub), JSON.stringify(d)); } catch {} }
function ssLoad<T>(id: number | 'new', sub: string): T | null { try { const r = sessionStorage.getItem(sKey(id, sub)); return r ? JSON.parse(r) : null; } catch { return null; } }
function ssClear(id: number | 'new') { const p = `aviso_venc_${id}_`; const ks: string[] = []; for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k?.startsWith(p)) ks.push(k); } ks.forEach(k => sessionStorage.removeItem(k)); }
function sdSave<T>(id: number | 'new', sub: string, d: T) { const k = String(id); if (!SAVED[k]) SAVED[k] = {}; SAVED[k][sub] = structuredClone(d); }
function sdLoad<T>(id: number | 'new', sub: string): T | null { const d = SAVED[String(id)]?.[sub]; return d ? structuredClone(d) as T : null; }
function migrate(from: number | 'new', to: number) { const fk = String(from), tk = String(to); if (SAVED[fk]) { SAVED[tk] = structuredClone(SAVED[fk]); delete SAVED[fk]; } const p = `aviso_venc_${from}_`, np = `aviso_venc_${to}_`; const ks: string[] = []; for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k?.startsWith(p)) ks.push(k); } ks.forEach(k => { const sub = k.replace(p, ''); const v = sessionStorage.getItem(k); if (v) sessionStorage.setItem(`${np}${sub}`, v); sessionStorage.removeItem(k); }); }
function commit(id: number | 'new') { const p = `aviso_venc_${id}_`; const ks: string[] = []; for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k?.startsWith(p)) ks.push(k); } ks.forEach(k => { const sub = k.replace(p, ''); try { sdSave(id, sub, JSON.parse(sessionStorage.getItem(k)!)); } catch {} }); ks.forEach(k => sessionStorage.removeItem(k)); }
function gid() { return Date.now() + Math.floor(Math.random() * 1000); }

let _nxt = 17;
function nextAvisoId() { return `AV-${String(_nxt).padStart(3, '0')}`; }
function consumeAvisoId() { const id = `AV-${String(_nxt).padStart(3, '0')}`; _nxt++; return id; }

const EMPTY_FORM: AvisoVencFormData = { noAviso: 'Auto', noCredito: '', noCliente: '', cliente: '', fechaAviso: '', fechaVencimiento: '', estatus: 'Pendiente', subEstatus: 'Integración', responsable: '', observaciones: '' };

const CAT_ESTATUS = ['Pendiente', 'En Proceso', 'Atendido', 'Vencido', 'Cancelado'];
const CAT_SUB_ESTATUS = ['Integración', 'Análisis', 'Jurídico', 'Liberación'];
const CAT_CONCEPTO = ['Capital', 'Interés', 'IVA de Interés'];
const CAT_CLIENTES = [
  { value: 'CL-001', label: 'CL-001 - Juan Pérez Gómez' },
  { value: 'CL-002', label: 'CL-002 - María García López' },
  { value: 'CL-003', label: 'CL-003 - Carlos Martínez Sánchez' },
  { value: 'CL-004', label: 'CL-004 - HELVEX, S.A. DE C.V' },
  { value: 'CL-005', label: 'CL-005 - Sofía Reyes López' },
];
const CAT_CREDITOS = ['CR-001', 'CR-002', 'CR-003', 'CR-004', 'CR-005', 'CR-006', 'CR-007', 'CR-008'];

const fmt = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function parseDate(d: string): Date {
  const [day, month, year] = d.split('/');
  const y = parseInt(year);
  return new Date(y < 100 ? 2000 + y : y, parseInt(month) - 1, parseInt(day));
}

// ── Mock data (16 registros) ──
const MOCK: AvisoListItem[] = Array.from({ length: 16 }, (_, i) => {
  const id = i + 1;
  const clIdx = i % 5;
  const cl = CAT_CLIENTES[clIdx];
  const se = CAT_SUB_ESTATUS[i % 4];
  const es = i < 4 ? 'Pendiente' : i < 8 ? 'En Proceso' : i < 12 ? 'Atendido' : 'Vencido';
  const d = new Date(2026, 0, 5 + i * 2);
  const dStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
  const vd = new Date(2026, 1, 5 + i * 3);
  const vStr = `${vd.getDate().toString().padStart(2,'0')}/${(vd.getMonth()+1).toString().padStart(2,'0')}/${String(vd.getFullYear()).slice(-2)}`;
  return {
    id, noAviso: `AV-${String(id).padStart(3,'0')}`, noCredito: `CR-${String((i % 8) + 1).padStart(3,'0')}`,
    noCliente: cl.value, cliente: cl.label.split(' - ')[1], fechaAviso: dStr, fechaVencimiento: vStr,
    estatus: es, subEstatus: se, responsable: ['Ana López', 'Carlos Ruiz', 'Laura Torres', 'Pedro Vega'][i % 4],
    montoTotal: [2500, 5800, 12000, 3400, 8900, 15600, 1200, 45000, 7800, 23000, 6700, 9100, 4300, 18500, 2100, 31000][i],
  };
});

// ── Pre-seed SAVED_DATA ──
MOCK.forEach((m, idx) => {
  sdSave(m.id, 'form', {
    ...EMPTY_FORM,
    noAviso: m.noAviso, noCredito: m.noCredito, noCliente: m.noCliente,
    cliente: m.cliente, fechaAviso: m.fechaAviso, fechaVencimiento: m.fechaVencimiento,
    estatus: m.estatus, subEstatus: m.subEstatus, responsable: m.responsable,
  } as AvisoVencFormData);

  // Pre-seed detalle rows: Capital, Interés, IVA de Interés
  const capital = Math.round(m.montoTotal * 0.8);
  const interes = Math.round(m.montoTotal * 0.14);
  const ivaInt  = m.montoTotal - capital - interes;
  const payRatio = m.estatus === 'Atendido' ? 1
    : m.estatus === 'En Proceso' ? [0.9, 0.75, 0.6, 0.85][idx % 4]
    : m.estatus === 'Vencido' ? [0.0, 0.1, 0.0, 0.05][idx % 4]
    : [0.0, 0.0, 0.0, 0.0][idx % 4];
  const bRow = (rid: number, concepto: string, monto: number): DetalleRow => {
    const subtotal = monto;
    const pagado = Math.round(monto * payRatio);
    const saldo = subtotal - pagado;
    return { id: rid, concepto, cantidad: 1, monto, subtotal, pagado, saldo,
      estatusConcepto: pagado <= 0 ? 'Pendiente' : pagado >= subtotal ? 'Pagado' : 'Parcial' };
  };
  sdSave(m.id, 'detalle', [
    bRow(m.id * 100 + 1, 'Capital', capital),
    bRow(m.id * 100 + 2, 'Interés', interes),
    bRow(m.id * 100 + 3, 'IVA de Interés', ivaInt),
  ] as DetalleRow[]);
});

// ═══════════════════════════════════════════════════════════════════
// MAIN MODULE
// ═══════════════════════════════════════════════════════════════════
type ViewState = { type: 'dashboard' } | { type: 'list' } | { type: 'form'; mode: 'nuevo' | 'editar' | 'ver'; id?: number };

export function AvisosVencimientoModule() {
  const [view, setView] = useState<ViewState>({ type: 'dashboard' });
  const [items, setItems] = useState<AvisoListItem[]>([...MOCK]);

  const goToDashboard = () => { setView({ type: 'dashboard' }); };
  const goToList = () => { setView({ type: 'list' }); };

  const handleNuevo = () => { ssClear('new'); setView({ type: 'form', mode: 'nuevo' }); };
  const handleEditar = (i: AvisoListItem) => { ssClear(i.id); setView({ type: 'form', mode: 'editar', id: i.id }); };
  const handleVer = (i: AvisoListItem) => { setView({ type: 'form', mode: 'ver', id: i.id }); };

  const handleSave = (data: AvisoVencFormData, detalles: DetalleRow[]) => {
    const total = detalles.reduce((s, d) => s + d.subtotal, 0);
    if (view.type === 'form' && view.mode === 'nuevo') {
      const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
      migrate('new', newId);
      sdSave(newId, 'form', data);
      sdSave(newId, 'detalle', detalles);
      setItems(prev => [{
        id: newId, noAviso: data.noAviso, noCredito: data.noCredito, noCliente: data.noCliente,
        cliente: data.cliente, fechaAviso: data.fechaAviso, fechaVencimiento: data.fechaVencimiento,
        estatus: data.estatus, subEstatus: data.subEstatus, responsable: data.responsable, montoTotal: total,
      }, ...prev]);
    } else if (view.type === 'form' && view.mode === 'editar' && view.id) {
      sdSave(view.id, 'form', data);
      sdSave(view.id, 'detalle', detalles);
      setItems(prev => prev.map(i => i.id === view.id ? {
        ...i, noCredito: data.noCredito || i.noCredito, noCliente: data.noCliente || i.noCliente,
        cliente: data.cliente || i.cliente, fechaAviso: data.fechaAviso || i.fechaAviso,
        fechaVencimiento: data.fechaVencimiento || i.fechaVencimiento, estatus: data.estatus || i.estatus,
        subEstatus: data.subEstatus || i.subEstatus, responsable: data.responsable || i.responsable, montoTotal: total || i.montoTotal,
      } : i));
    }
    goToList();
  };

  // ── FORM VIEW ──
  if (view.type === 'form') {
    return <AvisoForm mode={view.mode} avisoId={view.id} onCancel={goToList} onSave={handleSave} />;
  }

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD VIEW
  // ═══════════════════════════════════════════════════════════════
  if (view.type === 'dashboard') {
    return (
      <>
        {/* Sub-navigation */}
        <div className="bg-gray-100 border-b border-gray-300">
          <div className="px-6 py-3 flex items-center gap-4">
            <button onClick={goToDashboard} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-active">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/><path d="M6 14v-5h4v5"/></svg>
              <span>Inicio</span>
            </button>
            <button onClick={goToList} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-inactive">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h10M3 8h10M3 13h10"/></svg>
              <span>Lista de Avisos</span>
            </button>
          </div>
        </div>
        <AvisosDashboard items={items} onGoToList={goToList} onNuevo={handleNuevo} />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      {/* Sub-navigation */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button onClick={goToDashboard} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-inactive">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/><path d="M6 14v-5h4v5"/></svg>
            <span>Inicio</span>
          </button>
          <button onClick={goToList} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-active">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h10M3 8h10M3 13h10"/></svg>
            <span>Lista de Avisos</span>
          </button>
        </div>
      </div>
      <AvisosList items={items} onNuevo={handleNuevo} onEditar={handleEditar} onVer={handleVer} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
function AvisosDashboard({ items, onGoToList, onNuevo }: {
  items: AvisoListItem[]; onGoToList: () => void; onNuevo: () => void;
}) {
  const total = items.length;
  const montoTotal = items.reduce((s, i) => s + i.montoTotal, 0);
  const atendidos = items.filter(i => i.estatus === 'Atendido').length;
  const vencidos = items.filter(i => i.estatus === 'Vencido').length;
  const tasaAtencion = total > 0 ? (atendidos / total * 100) : 0;
  const tiempoPromedio = 3.8;

  const recientes = [...items].sort((a, b) => parseDate(b.fechaAviso).getTime() - parseDate(a.fechaAviso).getTime()).slice(0, 8);

  const distribucionEstatus = [
    { estatus: 'Atendido', cantidad: items.filter(i => i.estatus === 'Atendido').length, color: '#10B981' },
    { estatus: 'Pendiente', cantidad: items.filter(i => i.estatus === 'Pendiente').length, color: '#F59E0B' },
    { estatus: 'En Proceso', cantidad: items.filter(i => i.estatus === 'En Proceso').length, color: '#3B82F6' },
    { estatus: 'Vencido', cantidad: items.filter(i => i.estatus === 'Vencido').length, color: '#EF4444' },
    { estatus: 'Cancelado', cantidad: items.filter(i => i.estatus === 'Cancelado').length, color: '#6B7280' },
  ];

  const evolucion = [
    { mes: 'Ago', avisos: 8 }, { mes: 'Sep', avisos: 14 },
    { mes: 'Oct', avisos: 11 }, { mes: 'Nov', avisos: 18 },
    { mes: 'Dic', avisos: 15 }, { mes: 'Ene', avisos: total },
  ];
  const crecimiento = evolucion[4].avisos > 0 ? ((evolucion[5].avisos - evolucion[4].avisos) / evolucion[4].avisos * 100).toFixed(1) : '0';

  const porSubEstatus = CAT_SUB_ESTATUS.map(se => ({
    subEstatus: se,
    cantidad: items.filter(i => i.subEstatus === se).length,
  }));

  const seBadge = (se: string) => {
    const m: Record<string, string> = { 'Integración': 'bg-blue-100 text-blue-700', 'Análisis': 'bg-yellow-100 text-yellow-700', 'Jurídico': 'bg-purple-100 text-purple-700', 'Liberación': 'bg-green-100 text-green-700' };
    return m[se] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total de Avisos</p>
              <p className="text-2xl text-gray-900">{total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E5C91" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-green-600">+{crecimiento}%</span>
            <span className="text-gray-600">vs. mes anterior</span>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Monto Total</p>
              <p className="text-2xl text-gray-900">{fmt(montoTotal)}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">Promedio: {fmt(total > 0 ? montoTotal / total : 0)}</div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Tasa de Atención</p>
              <p className="text-2xl text-gray-900">{tasaAtencion.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">{atendidos} de {total} atendidos</div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Avisos Vencidos</p>
              <p className="text-2xl text-gray-900">{vencidos}</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-red-600">Requieren atención inmediata</div>
        </div>
      </div>

      {/* Registros Recientes + Distribución por Estatus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Avisos Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimos avisos registrados</p>
          </div>
          <div className="divide-y divide-gray-200">
            {recientes.slice(0, 5).map(item => (
              <div key={item.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-primary-theme">{item.noAviso}</span>
                  <span className="text-xs text-gray-700">{item.cliente}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600">{fmt(item.montoTotal)}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded ${seBadge(item.subEstatus)}`}>{item.subEstatus}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-gray-200">
            <button onClick={onGoToList} className="text-xs text-secondary-theme hover:underline">Ver todos los avisos →</button>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Distribución por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación actual de avisos</p>
          </div>
          <div className="p-4 flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={distribucionEstatus.filter(d => d.cantidad > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="cantidad" stroke="none">
                  {distribucionEstatus.filter(d => d.cantidad > 0).map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [v, 'Avisos']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {distribucionEstatus.filter(d => d.cantidad > 0).map(item => (
                <div key={item.estatus} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-gray-700">{item.estatus}: {item.cantidad}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Evolución de Avisos</h2>
            <p className="text-xs text-gray-600 mt-0.5">Tendencia en los últimos 6 meses</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={evolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Line type="monotone" dataKey="avisos" stroke="#2E5C91" strokeWidth={2} dot={{ fill: '#2E5C91', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Avisos por Sub Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución por fase</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porSubEstatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="subEstatus" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Bar dataKey="cantidad" fill="var(--theme-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LIST COMPONENT (institutional design)
// ═══════════════════════════════════════════════════════════════════
function AvisosList({ items, onNuevo, onEditar, onVer }: {
  items: AvisoListItem[];
  onNuevo: () => void;
  onEditar: (i: AvisoListItem) => void;
  onVer: (i: AvisoListItem) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [fEstatus, setFEstatus] = useState('');
  const [fSubEstatus, setFSubEstatus] = useState('');
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleExportExcel = () => { toast.success('Exportando a Excel', { description: 'El archivo se está descargando...', duration: 3000 }); };
  const handleExportCSV = () => { toast.success('Exportando a CSV', { description: 'El archivo CSV se está descargando...', duration: 3000 }); };
  const handleExportPDF = () => { toast.success('Exportando a PDF', { description: 'El archivo PDF se está descargando...', duration: 3000 }); };
  const handlePrint = () => { toast.success('Imprimiendo', { description: 'Enviando documento a la impresora...', duration: 3000 }); };

  const filtered = items.filter(i => {
    if (fEstatus && i.estatus !== fEstatus) return false;
    if (fSubEstatus && i.subEstatus !== fSubEstatus) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return i.noAviso.toLowerCase().includes(s) || i.cliente.toLowerCase().includes(s) || i.noCredito.toLowerCase().includes(s) || i.noCliente.toLowerCase().includes(s);
    }
    return true;
  }).sort((a, b) => {
    const da = parseDate(a.fechaAviso).getTime();
    const db = parseDate(b.fechaAviso).getTime();
    return sortOrder === 'desc' ? db - da : da - db;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const seBadge = (se: string) => {
    const m: Record<string, string> = { 'Integración': 'bg-blue-100 text-blue-800', 'Análisis': 'bg-yellow-100 text-yellow-800', 'Jurídico': 'bg-purple-100 text-purple-800', 'Liberación': 'bg-green-100 text-green-800' };
    return m[se] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            <h2 className="text-lg text-gray-800">Avisos de Vencimiento</h2>
            <button className="p-1 ml-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2"><circle cx="8" cy="8" r="6"/><path d="M13 13l3 3"/></svg></button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span className="cursor-pointer hover:text-secondary-theme transition-colors" onClick={() => { if (tableRef.current) { tableRef.current.classList.add('animate-highlight'); setTimeout(() => tableRef.current?.classList.remove('animate-highlight'), 1000); } }}>Lista</span>
            <span className="cursor-pointer hover:text-secondary-theme transition-colors" onClick={() => { if (searchRef.current) { searchRef.current.focus(); } }}>Buscar</span>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[250px]">
              <option>Vista general de Avisos de Vencimiento</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
          </div>
          <button onClick={onNuevo} className="px-5 py-1.5 btn-secondary-theme rounded text-sm">Nuevo</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Filtros</span>
          <div className="flex items-center gap-2">
            <select value={fEstatus} onChange={e => { setFEstatus(e.target.value); setCurrentPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded"><option value="">Estatus: Todos</option>{CAT_ESTATUS.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select value={fSubEstatus} onChange={e => { setFSubEstatus(e.target.value); setCurrentPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded"><option value="">Sub Estatus: Todos</option>{CAT_SUB_ESTATUS.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <input ref={searchRef} type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="Buscar avisos..." className="px-3 py-1 border border-gray-400 rounded text-sm w-64 transition-all" />
          </div>
        </div>
      </div>

      {/* Action Icons Bar */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors hover:scale-110 transform" title="Exportar a CSV" onClick={handleExportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280"/><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors hover:scale-110 transform" title="Exportar a Excel" onClick={handleExportExcel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B"/><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2"/></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors hover:scale-110 transform" title="Exportar a PDF" onClick={handleExportPDF}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F"/><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none"/><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2"/></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors hover:scale-110 transform" title="Imprimir" onClick={handlePrint}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2"/><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none"/><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2"/><circle cx="5" cy="8" r="0.8" fill="#1976D2"/></svg>
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
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666"><path d="M5 7l-3-3h6z"/></svg>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-0.5 text-secondary-theme disabled:opacity-40" title="Anterior" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
              </button>
              <button className="p-0.5 text-secondary-theme disabled:opacity-40" title="Siguiente" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
              </button>
            </div>
            <span>Total: {filtered.length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm" style={{ backgroundColor: 'transparent' }}>
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Editar | Ver</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">N° AVISO</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">N° CRÉDITO</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">CLIENTE</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">FECHA AVISO</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">VENCIMIENTO</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">MONTO TOTAL</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">ESTATUS</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">SUB ESTATUS</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">RESPONSABLE</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">No se encontraron registros de avisos</td></tr>
              ) : paginated.map((i, idx) => (
                <tr key={i.id} className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}>
                  <td className="px-3 py-2.5 text-xs">
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onEditar(i); }}>Editar</a>
                    <span className="text-gray-700"> | </span>
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onVer(i); }}>Ver</a>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.noAviso}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.noCredito}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.cliente}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.fechaAviso}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.fechaVencimiento}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{fmt(i.montoTotal)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.estatus}</td>
                  <td className="px-3 py-2.5 text-xs"><span className={`px-2 py-0.5 rounded text-[10px] ${seBadge(i.subEstatus)}`}>{i.subEstatus}</span></td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.responsable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Primera página" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z"/></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Página anterior" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z"/></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {currentPage} de {totalPages || 1}</div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Página siguiente" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z"/></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Última página" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FORM — Subtabs: Default, Detalle, Flujo de Trabajo
// ═══════════════════════════════════════════════════════════════════
function AvisoForm({ mode, avisoId, onCancel, onSave }: {
  mode: 'nuevo' | 'editar' | 'ver'; avisoId?: number;
  onCancel: () => void; onSave: (d: AvisoVencFormData, det: DetalleRow[]) => void;
}) {
  const sid: number | 'new' = mode === 'nuevo' ? 'new' : (avisoId || 1);
  const isRO = mode === 'ver';

  const getInit = useCallback((): AvisoVencFormData => {
    const s = ssLoad<AvisoVencFormData>(sid, 'form');
    if (s) return s;
    if (mode === 'nuevo') return { ...EMPTY_FORM, noAviso: nextAvisoId() };
    const saved = sdLoad<AvisoVencFormData>(sid, 'form');
    if (saved) return saved;
    return { ...EMPTY_FORM };
  }, [mode, sid]);

  const getDetInit = useCallback((): DetalleRow[] => {
    const s = ssLoad<DetalleRow[]>(sid, 'detalle');
    if (s) return s;
    if (mode === 'nuevo') return [];
    return sdLoad<DetalleRow[]>(sid, 'detalle') || [];
  }, [mode, sid]);

  const [fd, setFd] = useState<AvisoVencFormData>(getInit);
  const [detalles, setDetalles] = useState<DetalleRow[]>(getDetInit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSec, setActiveSec] = useState('default');

  useEffect(() => { if (!isRO) { ssSave(sid, 'form', fd); } }, [fd, sid, isRO]);
  useEffect(() => { if (!isRO) { ssSave(sid, 'detalle', detalles); } }, [detalles, sid, isRO]);

  const set = (f: keyof AvisoVencFormData, v: string) => {
    if (isRO) return;
    setFd(p => ({ ...p, [f]: v }));
    if (errors[f]) setErrors(p => { const n = { ...p }; delete n[f]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fd.noCredito) e.noCredito = 'Obligatorio';
    if (!fd.cliente) e.cliente = 'Obligatorio';
    if (!fd.fechaAviso) e.fechaAviso = 'Obligatorio';
    if (!fd.fechaVencimiento) e.fechaVencimiento = 'Obligatorio';
    setErrors(e);
    if (Object.keys(e).length > 0) { toast.error('Campos obligatorios incompletos'); return false; }
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    const d = { ...fd };
    if (mode === 'nuevo') d.noAviso = consumeAvisoId();
    sdSave(sid, 'form', d);
    sdSave(sid, 'detalle', detalles);
    commit(sid);
    sdSave(sid, 'form', d);
    sdSave(sid, 'detalle', detalles);
    toast.success('Aviso de vencimiento guardado', { description: `N° ${d.noAviso}` });
    onSave(d, detalles);
  };

  const ic = (err = false, dis = false) => `w-full px-2 py-1 text-xs border rounded focus:outline-none ${err ? 'border-red-400' : 'border-gray-300'} ${dis || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-primary-theme'}`;
  const sc = (err = false) => `w-full px-2 py-1 text-xs border rounded focus:outline-none ${err ? 'border-red-400' : 'border-gray-300'} ${isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-primary-theme'}`;
  const Lbl = ({ children, req, error }: { children: string; req?: boolean; error?: string }) => (
    <label className={`block text-xs mb-1 ${error ? 'text-red-600' : 'text-gray-700'}`}>{children}{req && <span className="text-red-600 ml-0.5">*</span>}</label>
  );

  // ── Detalle helpers ──
  const addDetalle = () => setDetalles(p => [...p, { id: gid(), concepto: '', cantidad: 1, monto: 0, subtotal: 0, pagado: 0, saldo: 0, estatusConcepto: 'Pendiente' }]);
  const removeDetalle = (id: number) => setDetalles(p => p.filter(d => d.id !== id));
  const updateDetalle = (id: number, field: keyof DetalleRow, value: any) => {
    setDetalles(p => p.map(d => {
      if (d.id !== id) return d;
      const upd = { ...d, [field]: value };
      upd.subtotal = upd.cantidad * upd.monto;
      upd.saldo = upd.subtotal - upd.pagado;
      if (upd.pagado <= 0) upd.estatusConcepto = 'Pendiente';
      else if (upd.pagado >= upd.subtotal) upd.estatusConcepto = 'Pagado';
      else upd.estatusConcepto = 'Parcial';
      return upd;
    }));
  };
  const totalDetalle = detalles.reduce((s, d) => s + d.subtotal, 0);
  const totalPagado = detalles.reduce((s, d) => s + d.pagado, 0);
  const totalSaldo = detalles.reduce((s, d) => s + d.saldo, 0);
  const estatusGlobal = totalDetalle === 0 ? 'Pendiente' : totalPagado >= totalDetalle ? 'Pagado' : totalPagado > 0 ? 'Parcial' : 'Pendiente';

  const sections = [
    { id: 'default', label: 'Default' },
    { id: 'detalle', label: 'Detalle' },
    { id: 'flujo', label: 'Flujo de Trabajo' },
  ];

  // ── Sub-estatus phase index for workflow ──
  const phases = ['Integración', 'Análisis', 'Jurídico', 'Liberación'];
  const currentPhase = phases.indexOf(fd.subEstatus);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-auto">
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="stroke-primary-theme" strokeWidth="1.5"><path d="M14 6A5 5 0 004 6c0 6-2 7-2 7h14s-2-1-2-7"/><path d="M10.5 16a1.5 1.5 0 01-3 0"/></svg>
            <span className="text-sm text-gray-700">
              {mode === 'nuevo' ? `Alta Aviso de Vencimiento — N° ${fd.noAviso}` : mode === 'editar' ? `Edición Aviso — N° ${fd.noAviso}` : `Detalle Aviso — N° ${fd.noAviso}`}
            </span>
          </div>
          <button onClick={() => { ssClear(sid); onCancel(); }} className="text-secondary-theme text-sm hover:underline">Lista</button>
        </div>
      </div>
      <div className="bg-white px-6 py-3 border-b border-gray-200 flex items-center gap-2">
        {!isRO && (<>
          <button onClick={handleSave} className="px-5 py-1.5 btn-secondary-theme rounded text-sm">Guardar</button>
          <button onClick={() => { ssClear(sid); onCancel(); }} className="px-5 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">Cancelar</button>
        </>)}
        {isRO && <button onClick={() => { onCancel(); }} className="px-5 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">Cerrar</button>}
      </div>

      <div className="px-6 py-6">
        <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-4 py-2 mb-5"><h3 className="text-sm text-gray-800 uppercase">Información del Aviso</h3></div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-8">
          <div className="space-y-3">
            <div><Lbl req>N° Aviso</Lbl><input type="text" value={fd.noAviso} disabled className={ic(false, true)} /></div>
            <div><Lbl req error={errors.noCredito}>N° Crédito</Lbl><select value={fd.noCredito} onChange={e => set('noCredito', e.target.value)} disabled={isRO} className={sc(!!errors.noCredito)}><option value="">Seleccionar...</option>{CAT_CREDITOS.map(c => <option key={c} value={c}>{c}</option>)}</select>{errors.noCredito && <span className="text-[10px] text-red-500">{errors.noCredito}</span>}</div>
            <div><Lbl req error={errors.cliente}>Cliente</Lbl><select value={fd.noCliente} onChange={e => { const cl = CAT_CLIENTES.find(c => c.value === e.target.value); set('noCliente', e.target.value); set('cliente', cl?.label.split(' - ')[1] || ''); }} disabled={isRO} className={sc(!!errors.cliente)}><option value="">Seleccionar...</option>{CAT_CLIENTES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>{errors.cliente && <span className="text-[10px] text-red-500">{errors.cliente}</span>}</div>
          </div>
          <div className="space-y-3">
            <div><Lbl req error={errors.fechaAviso}>Fecha Aviso</Lbl><DatePicker value={fd.fechaAviso} onChange={v => set('fechaAviso', v)} disabled={isRO} placeholder="dd/mm/aaaa" className={`px-2 py-1 ${errors.fechaAviso ? 'border-red-400' : ''}`} />{errors.fechaAviso && <span className="text-[10px] text-red-500">{errors.fechaAviso}</span>}</div>
            <div><Lbl req error={errors.fechaVencimiento}>Fecha Vencimiento</Lbl><DatePicker value={fd.fechaVencimiento} onChange={v => set('fechaVencimiento', v)} disabled={isRO} placeholder="dd/mm/aaaa" className={`px-2 py-1 ${errors.fechaVencimiento ? 'border-red-400' : ''}`} />{errors.fechaVencimiento && <span className="text-[10px] text-red-500">{errors.fechaVencimiento}</span>}</div>
            <div><Lbl>Responsable</Lbl><input type="text" value={fd.responsable} onChange={e => set('responsable', e.target.value)} disabled={isRO} className={ic()} placeholder="Nombre del responsable" /></div>
          </div>
          <div className="space-y-3">
            <div><Lbl req>Estatus</Lbl><select value={fd.estatus} onChange={e => set('estatus', e.target.value)} disabled={isRO} className={sc()}>{CAT_ESTATUS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><Lbl req>Sub Estatus</Lbl><select value={fd.subEstatus} onChange={e => set('subEstatus', e.target.value)} disabled={isRO} className={sc()}>{CAT_SUB_ESTATUS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><Lbl>Observaciones</Lbl><textarea value={fd.observaciones} onChange={e => set('observaciones', e.target.value)} disabled={isRO} className={`${ic()} resize-none`} rows={3} /></div>
          </div>
        </div>

        {/* ── Header Aviso — resumen de montos ── */}
        <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-4 py-2 mb-4"><h3 className="text-sm text-gray-800 uppercase">Header Aviso</h3></div>
        <div className="grid grid-cols-4 gap-x-6 gap-y-3 mb-8">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Monto a Pagar</label>
            <input type="text" value={fmt(totalDetalle)} disabled className={ic(false, true)} />
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">Monto Pagado</label>
            <input type="text" value={fmt(totalPagado)} disabled className={ic(false, true)} />
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">Saldo</label>
            <input type="text" value={fmt(totalSaldo)} disabled className={ic(false, true)} />
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">Estatus</label>
            <input type="text" value={estatusGlobal} disabled className={`${ic(false, true)} ${estatusGlobal === 'Pagado' ? '!text-green-700' : estatusGlobal === 'Parcial' ? '!text-yellow-700' : ''}`} />
          </div>
        </div>

        {/* SUBTABS — horizontal tab bar */}
        <div className="flex items-stretch bg-primary-theme overflow-hidden">
          {sections.map(sec => (
            <button
              key={sec.id}
              onClick={() => setActiveSec(sec.id)}
              className={`px-5 py-2 text-xs transition-colors whitespace-nowrap border-r border-white/20 last:border-r-0 ${
                activeSec === sec.id
                  ? 'bg-[var(--theme-primary-hover)] text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50 mb-4">
          {/* ── DEFAULT ── */}
          {activeSec === 'default' && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div><label className="block text-xs text-gray-700 mb-1">N° AVISO</label><input type="text" value={fd.noAviso} disabled className={ic(false, true)} /></div>
              <div><label className="block text-xs text-gray-700 mb-1">N° CRÉDITO</label><input type="text" value={fd.noCredito} disabled className={ic(false, true)} /></div>
              <div><label className="block text-xs text-gray-700 mb-1">N° CLIENTE</label><input type="text" value={fd.noCliente} disabled className={ic(false, true)} /></div>
              <div><label className="block text-xs text-gray-700 mb-1">ESTATUS</label><input type="text" value={fd.estatus} disabled className={ic(false, true)} /></div>
              <div><label className="block text-xs text-gray-700 mb-1">SUB ESTATUS</label><input type="text" value={fd.subEstatus} disabled className={ic(false, true)} /></div>
              <div><label className="block text-xs text-gray-700 mb-1">FECHA</label><input type="text" value={fd.fechaAviso} disabled className={ic(false, true)} /></div>
              <div><label className="block text-xs text-gray-700 mb-1">RESPONSABLE</label><input type="text" value={fd.responsable} disabled className={ic(false, true)} /></div>
              <div><label className="block text-xs text-gray-700 mb-1">MONTO TOTAL</label><input type="text" value={fmt(totalDetalle)} disabled className={ic(false, true)} /></div>
            </div>
          )}

          {/* ── DETALLE ── */}
          {activeSec === 'detalle' && (<>
            <div className="flex items-center justify-between mb-3">
              <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5"><span className="text-xs text-gray-800">Detalle</span></div>
              {!isRO && <button onClick={addDetalle} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Agregar Concepto</button>}
            </div>
            <div className="border border-gray-300 bg-white overflow-x-auto">
              <table className="w-full border-collapse min-w-[850px]">
                <thead><tr className="bg-[#4AC5CC]/20 border-b-2 border-[#4AC5CC]">
                  <th className="px-2 py-2 text-xs text-gray-700 text-center border-r border-gray-300 w-[40px]">No</th>
                  <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[150px]">Concepto</th>
                  <th className="px-2 py-2 text-xs text-gray-700 text-center border-r border-gray-300 w-[50px]">Cant</th>
                  <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300 w-[110px]">Monto</th>
                  <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300 w-[110px]">Sub Total</th>
                  <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300 w-[110px]">Pagado</th>
                  <th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300 w-[110px]">Saldo</th>
                  <th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[80px]">Estatus</th>
                  {!isRO && <th className="px-2 py-2 text-xs text-gray-700 text-center w-[60px]">Acción</th>}
                </tr></thead>
                <tbody>
                  {detalles.length === 0 ? <tr><td colSpan={isRO ? 8 : 9} className="px-3 py-6 text-center text-xs text-gray-400">Agregue conceptos con el botón superior</td></tr>
                  : detalles.map((d, idx) => (
                    <tr key={d.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-2 py-1.5 text-xs text-center text-gray-600 border-r border-gray-200">{idx + 1}</td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <select value={d.concepto} onChange={e => updateDetalle(d.id, 'concepto', e.target.value)} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}>
                          <option value="">Seleccione...</option>
                          {CAT_CONCEPTO.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="number" min="1" value={d.cantidad} onChange={e => updateDetalle(d.id, 'cantidad', Math.max(1, +e.target.value || 1))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded text-center ${isRO ? 'bg-gray-100' : 'bg-white'}`} />
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="number" step="0.01" min="0" value={d.monto} onChange={e => updateDetalle(d.id, 'monto', +e.target.value || 0)} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded text-right ${isRO ? 'bg-gray-100' : 'bg-white'}`} />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right border-r border-gray-200 bg-gray-50">{fmt(d.subtotal)}</td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="number" step="0.01" min="0" value={d.pagado} onChange={e => updateDetalle(d.id, 'pagado', Math.max(0, +e.target.value || 0))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded text-right ${isRO ? 'bg-gray-100' : 'bg-white'}`} />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right border-r border-gray-200 bg-gray-50">{fmt(d.saldo)}</td>
                      <td className={`px-2 py-1.5 text-xs border-r border-gray-200 ${d.estatusConcepto === 'Pagado' ? 'text-green-700' : d.estatusConcepto === 'Parcial' ? 'text-yellow-700' : 'text-gray-500'}`}>{d.estatusConcepto}</td>
                      {!isRO && <td className="px-2 py-1.5 text-center"><button onClick={() => removeDetalle(d.id)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}

          {/* ── FLUJO DE TRABAJO ── */}
          {activeSec === 'flujo' && (
            <div>
              <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5 mb-6"><span className="text-xs text-gray-800">FLUJO DE TRABAJO</span></div>
              <div className="flex items-center justify-center gap-0 py-8">
                {/* Inicio */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">Inicio</div>
                </div>
                <div className="w-8 h-0.5 bg-gray-300" />

                {phases.map((phase, idx) => (
                  <div key={phase} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={`w-28 h-14 rounded-lg flex items-center justify-center text-xs border-2 transition-all ${
                        idx === currentPhase
                          ? 'bg-primary-theme text-white border-primary-theme shadow-lg scale-110'
                          : idx < currentPhase
                          ? 'bg-green-100 text-green-800 border-green-400'
                          : 'bg-gray-100 text-gray-500 border-gray-300'
                      }`}>
                        <div className="text-center">
                          <div className="text-[10px] opacity-70">Fase {idx + 1}</div>
                          <div>{phase}</div>
                        </div>
                      </div>
                      {idx === currentPhase && <div className="mt-1 text-[10px] text-primary-theme">Fase actual</div>}
                    </div>
                    {idx < phases.length - 1 && (
                      <div className={`w-8 h-0.5 ${idx < currentPhase ? 'bg-green-400' : 'bg-gray-300'}`} />
                    )}
                  </div>
                ))}

                <div className="w-8 h-0.5 bg-gray-300" />
                {/* Fin */}
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xs ${currentPhase >= 3 ? 'bg-green-500' : 'bg-gray-400'}`}>Fin</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-3">
                {phases.map((phase, idx) => (
                  <div key={phase} className={`border rounded p-3 ${idx === currentPhase ? 'border-primary-theme bg-primary-tint-theme' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-800">{phase}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        idx < currentPhase ? 'bg-green-100 text-green-700' : idx === currentPhase ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>{idx < currentPhase ? 'Completada' : idx === currentPhase ? 'En curso' : 'Pendiente'}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full">
                      <div className={`h-1.5 rounded-full ${idx < currentPhase ? 'bg-green-500 w-full' : idx === currentPhase ? 'bg-primary-theme w-1/2' : 'w-0'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
