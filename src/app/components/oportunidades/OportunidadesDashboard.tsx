/**
 * OportunidadesDashboard.tsx
 *
 * Pantalla Home del módulo Oportunidades — HU-CRM-04 CA-02.
 * Réplica del estándar visual de ClientesDashboard/CreditosDashboard (RN-01):
 * tarjetas KPI con icono circular, Registros Recientes + Distribución por
 * Estatus a dos columnas, y gráficas complementarias debajo.
 *
 * Una Oportunidad es una Cotización de Línea de Crédito (decisión HU-CRM-03).
 */
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { CotizacionCredito } from '../cotizaciones/cotizacionCreditoTypes';

const PIE_COLORS = ['#2E5C91', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'];

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
  // Cierre Comercial — estados terminales (ver ESTATUS_OPORTUNIDAD_GANADA/PERDIDA)
  else if (lower === 'ganada comercial') bg = 'bg-green-100 text-green-800 font-medium';
  else if (lower === 'perdida') bg = 'bg-red-100 text-red-800';
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

export function OportunidadesDashboard({ oportunidades, onViewList, onView }: Props) {
  const total = oportunidades.length;
  // "Activas" = pipeline en curso. Ganada Comercial y Perdida son estados
  // terminales de Cierre Comercial: ya se resolvieron, no siguen "activos".
  const activas = oportunidades.filter(o => {
    const e = (o.estatus_cotiza || '').toLowerCase();
    return e !== 'rechazada' && e !== 'cancelada' && e !== 'ganada comercial' && e !== 'perdida';
  }).length;
  const enCotizacion = oportunidades.filter(o => (o.estatus_cotiza || '').toLowerCase() === 'en cotización').length;
  const montoTotal = oportunidades.reduce((s, o) => s + montoInversionDe(o), 0);

  const pctActivas = total > 0 ? ((activas / total) * 100).toFixed(1) : '0.0';
  const pctEnCotizacion = total > 0 ? ((enCotizacion / total) * 100).toFixed(1) : '0.0';

  // Oportunidades recientes (últimas 8), igual que Registros Recientes en Clientes/Créditos
  const oportunidadesRecientes = [...oportunidades]
    .sort((a, b) => new Date(b.fecha_cotiza).getTime() - new Date(a.fecha_cotiza).getTime())
    .slice(0, 8);

  const estatusData = Object.entries(
    oportunidades.reduce((acc, o) => {
      const k = o.estatus_cotiza || 'Sin estatus';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([tipo, cantidad], i) => ({ tipo, cantidad, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const sectorData = Object.entries(
    oportunidades.reduce((acc, o) => {
      const k = (o.data as any)?.sectorInfraestructura || 'Sin sector';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([tipo, cantidad], i) => ({ tipo, cantidad, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const montoPorSector = Object.entries(
    oportunidades.reduce((acc, o) => {
      const k = (o.data as any)?.sectorInfraestructura || 'Sin sector';
      acc[k] = (acc[k] || 0) + montoInversionDe(o);
      return acc;
    }, {} as Record<string, number>)
  ).map(([sector, monto]) => ({ sector, monto: monto / 1_000_000 }));

  return (
    <div className="p-6 space-y-6">

      {/* Tarjetas de resumen superior */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Oportunidades */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total de Oportunidades</p>
              <p className="text-2xl font-semibold text-gray-900">{total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-primary-theme" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Pipeline comercial de infraestructura
          </div>
        </div>

        {/* Activas */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Activas</p>
              <p className="text-2xl font-semibold text-gray-900">{activas}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {pctActivas}% del total
          </div>
        </div>

        {/* En Cotización */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">En Cotización</p>
              <p className="text-2xl font-semibold text-gray-900">{enCotizacion}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {pctEnCotizacion}% del total
          </div>
        </div>

        {/* Monto Inversión Total */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Monto Inversión Total</p>
              <p className="text-lg font-semibold text-gray-900">{formatMoney(montoTotal)}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {total} {total === 1 ? 'oportunidad registrada' : 'oportunidades registradas'}
          </div>
        </div>
      </div>

      {/* Registros Recientes y Distribución por Estatus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Oportunidades Recientes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-gray-900">Registros Recientes</h2>
              <p className="text-xs text-gray-600 mt-0.5">Últimas oportunidades registradas en el sistema</p>
            </div>
            <button onClick={onViewList} className="text-xs text-blue-600 hover:underline whitespace-nowrap">Ver todas</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">ID Oportunidad</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente Emisor</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Sector</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Monto Inversión</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {oportunidadesRecientes.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No hay oportunidades registradas.</td></tr>
                ) : (
                  oportunidadesRecientes.map((o, idx) => (
                    <tr
                      key={o.id || o.no_cotiza}
                      className={`cursor-pointer hover:bg-blue-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      onClick={() => onView(o)}
                    >
                      <td className="px-3 py-2 text-blue-600">{o.no_cotiza}</td>
                      <td className="px-3 py-2 text-gray-900">{o.data?.cliente?.nombreCompleto || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{(o.data as any)?.sectorInfraestructura || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{formatMoney(montoInversionDe(o))}</td>
                      <td className="px-3 py-2">{renderEstatus(o.estatus_cotiza)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribución por Estatus */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación de oportunidades por etapa del pipeline</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            {estatusData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-xs text-gray-400">Sin datos</div>
            ) : (
              <div className="w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={estatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ tipo, cantidad }) => `${tipo}: ${cantidad}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="cantidad"
                    >
                      {estatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
                  {estatusData.map((item) => (
                    <div key={item.tipo} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-700">{item.tipo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráficas complementarias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Por Sector de Infraestructura */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Por Sector de Infraestructura</h2>
            <p className="text-xs text-gray-600 mt-0.5">Cantidad de oportunidades por sector</p>
          </div>
          <div className="p-4">
            {sectorData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-xs text-gray-400">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ tipo, cantidad }) => `${tipo}: ${cantidad}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cantidad"
                  >
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Monto Inversión por Sector */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Monto Inversión por Sector</h2>
            <p className="text-xs text-gray-600 mt-0.5">Suma en millones de pesos por sector</p>
          </div>
          <div className="p-4">
            {montoPorSector.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-xs text-gray-400">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={montoPorSector}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="sector" tick={{ fontSize: 10 }} stroke="#6B7280" angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                  <Tooltip
                    contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                    formatter={(v: number) => `$${v.toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`}
                  />
                  <Bar dataKey="monto" fill="#2E5C91" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
