/**
 * OportunidadesDashboard.tsx
 *
 * Pantalla Home del módulo Oportunidades — HU-CRM-04 CA-02.
 * Réplica del estándar de CotizacionesDashboard (RN-01): fila de KPIs,
 * gráficas y tabla de recientes.
 *
 * Una Oportunidad es una Cotización de Línea de Crédito (decisión HU-CRM-03).
 */
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Briefcase, Clock, CheckCircle, DollarSign } from 'lucide-react';
import type { CotizacionCredito } from '../cotizaciones/cotizacionCreditoTypes';

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'];

const formatMoney = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const montoInversionDe = (o: CotizacionCredito): number => {
  const raw = (o.data as any)?.montoInversion;
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  if (!isNaN(n) && n > 0) return n;
  return Number(o.data?.montoSolicitado || 0);
};

const renderEstatus = (est: string) => {
  const lower = (est || '').toLowerCase();
  let bg = 'bg-gray-100 text-gray-700';
  // HU-CRM-09 — pipeline comercial
  if (lower === 'en cotización') bg = 'bg-yellow-100 text-yellow-800';
  else if (lower === 'propuesta entregada') bg = 'bg-blue-100 text-blue-800';
  else if (lower === 'negociación') bg = 'bg-indigo-100 text-indigo-800';
  // Estatus heredados de cotizaciones previas
  else if (lower === 'pendiente') bg = 'bg-yellow-100 text-yellow-800';
  else if (lower === 'aprobada' || lower === 'aceptada') bg = 'bg-green-100 text-green-800';
  else if (lower === 'rechazada') bg = 'bg-red-100 text-red-800';
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${bg}`}>{est || '—'}</span>;
};

interface Props {
  oportunidades: CotizacionCredito[];
  onNew: () => void;
  onViewList: () => void;
  onView: (o: CotizacionCredito) => void;
}

export function OportunidadesDashboard({ oportunidades, onNew, onViewList, onView }: Props) {
  const total = oportunidades.length;
  const activas = oportunidades.filter(o => {
    const e = (o.estatus_cotiza || '').toLowerCase();
    return e !== 'rechazada' && e !== 'cancelada';
  }).length;
  const enCotizacion = oportunidades.filter(o => (o.estatus_cotiza || '').toLowerCase() === 'en cotización').length;
  const montoTotal = oportunidades.reduce((s, o) => s + montoInversionDe(o), 0);

  const estatusData = Object.entries(
    oportunidades.reduce((acc, o) => {
      const k = o.estatus_cotiza || 'Sin estatus';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const sectorData = Object.entries(
    oportunidades.reduce((acc, o) => {
      const k = (o.data as any)?.sectorInfraestructura || 'Sin sector';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const montoPorSector = Object.entries(
    oportunidades.reduce((acc, o) => {
      const k = (o.data as any)?.sectorInfraestructura || 'Sin sector';
      acc[k] = (acc[k] || 0) + montoInversionDe(o);
      return acc;
    }, {} as Record<string, number>)
  ).map(([sector, monto]) => ({ sector, monto: monto / 1_000_000 }));

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-normal text-gray-800">Oportunidades</h2>
          <p className="text-xs text-gray-500">Pipeline comercial de proyectos de infraestructura</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onViewList} className="px-4 py-1.5 border border-gray-400 rounded text-sm hover:bg-gray-50 transition-colors">Ver lista</button>
          <button onClick={onNew} className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">Nueva Oportunidad</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Briefcase className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-[10px] text-gray-500">Total Oportunidades</p><p className="text-xl text-gray-900">{total}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-indigo-600" /></div>
            <div><p className="text-[10px] text-gray-500">Activas</p><p className="text-xl text-indigo-600">{activas}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center"><Clock className="w-5 h-5 text-yellow-600" /></div>
            <div><p className="text-[10px] text-gray-500">En Cotización</p><p className="text-xl text-yellow-600">{enCotizacion}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-[10px] text-gray-500">Monto Inversión Total</p><p className="text-lg text-emerald-600">{formatMoney(montoTotal)}</p></div>
          </div>
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-sm text-gray-700 mb-3">Por Estatus</h3>
          {estatusData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={estatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {estatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-sm text-gray-700 mb-3">Por Sector Infraestructura</h3>
          {sectorData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sectorData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {sectorData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-sm text-gray-700 mb-3">Monto Inversión por Sector (millones)</h3>
          {montoPorSector.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={montoPorSector}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sector" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`} />
                <Bar dataKey="monto" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recientes */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-gray-700">Oportunidades Recientes</h3>
          <button onClick={onViewList} className="text-xs text-blue-600 hover:underline">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-2">ID Oportunidad</th>
                <th className="text-left px-3 py-2">Cliente Emisor</th>
                <th className="text-left px-3 py-2">Sector</th>
                <th className="text-right px-3 py-2">Monto Inversión</th>
                <th className="text-center px-3 py-2">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {oportunidades.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No hay oportunidades registradas.</td></tr>
              ) : (
                [...oportunidades]
                  .sort((a, b) => new Date(b.fecha_cotiza).getTime() - new Date(a.fecha_cotiza).getTime())
                  .slice(0, 5)
                  .map(o => (
                    <tr key={o.id || o.no_cotiza} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => onView(o)}>
                      <td className="px-3 py-2 text-blue-600">{o.no_cotiza}</td>
                      <td className="px-3 py-2">{o.data?.cliente?.nombreCompleto || '—'}</td>
                      <td className="px-3 py-2">{(o.data as any)?.sectorInfraestructura || '—'}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(montoInversionDe(o))}</td>
                      <td className="px-3 py-2 text-center">{renderEstatus(o.estatus_cotiza)}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
