import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { SolicitudActivacionListItem } from './solicitudActivacionStore';

interface SolicitudActivacionDashboardProps {
  solicitudes: SolicitudActivacionListItem[];
  loading?: boolean;
  onGoToList: () => void;
}

export function SolicitudActivacionDashboard({
  solicitudes,
  loading,
  onGoToList,
}: SolicitudActivacionDashboardProps) {
  const total      = solicitudes.length;
  const activadas  = solicitudes.filter(s => s.estatus === 'Activada').length;
  const pendientes = solicitudes.filter(s => s.estatus === 'Pendiente').length;
  const tasaActivacion = total > 0 ? (activadas / total * 100) : 0;

  // Últimas 8 solicitudes
  const recientes = [...solicitudes]
    .sort((a, b) => {
      const da = a.fechaSolicitud.split('/').reverse().join('');
      const db = b.fechaSolicitud.split('/').reverse().join('');
      return db.localeCompare(da);
    })
    .slice(0, 8);

  // Distribución por estatus
  const distribucionEstatus = [
    { estatus: 'Activada',    cantidad: solicitudes.filter(s => s.estatus === 'Activada').length,    color: '#10B981' },
    { estatus: 'Pendiente',   cantidad: solicitudes.filter(s => s.estatus === 'Pendiente').length,   color: '#F59E0B' },
    { estatus: 'En Revisión', cantidad: solicitudes.filter(s => s.estatus === 'En Revisión').length, color: '#3B82F6' },
    { estatus: 'Aprobada',    cantidad: solicitudes.filter(s => s.estatus === 'Aprobada').length,    color: '#8B5CF6' },
    { estatus: 'Rechazada',   cantidad: solicitudes.filter(s => s.estatus === 'Rechazada').length,   color: '#EF4444' },
  ].filter(d => d.cantidad > 0);

  // Solicitudes por tipo
  const porTipo: Record<string, number> = {};
  solicitudes.forEach(s => {
    const key = s.tipo || 'Sin tipo';
    porTipo[key] = (porTipo[key] || 0) + 1;
  });
  const tipoData = Object.entries(porTipo).map(([tipo, count]) => ({ tipo, solicitudes: count }));

  // Evolución mensual (estática + total actual)
  const evolucion = [
    { mes: 'Ago', solicitudes: 12 },
    { mes: 'Sep', solicitudes: 18 },
    { mes: 'Oct', solicitudes: 15 },
    { mes: 'Nov', solicitudes: 22 },
    { mes: 'Dic', solicitudes: 19 },
    { mes: 'Ene', solicitudes: total },
  ];

  const crecimiento = evolucion.length >= 2
    ? ((evolucion[5].solicitudes - evolucion[4].solicitudes) / (evolucion[4].solicitudes || 1) * 100).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="animate-spin" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#666" strokeWidth="2">
            <circle cx="10" cy="10" r="8" strokeDasharray="30" strokeDashoffset="15" />
          </svg>
          <span className="text-sm">Cargando datos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* ══════ 4 KPIs ══════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* Total Solicitudes */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total de Solicitudes</p>
              <p className="text-2xl font-semibold text-gray-900">{total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E5C91" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-green-600 font-medium">+{crecimiento}%</span>
            <span className="text-gray-600">vs. mes anterior</span>
          </div>
        </div>

        {/* Cuentas Activadas */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Cuentas Activadas</p>
              <p className="text-2xl font-semibold text-gray-900">{activadas}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {total - activadas} pendientes de activar
          </div>
        </div>

        {/* Tasa de Activación */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Tasa de Activación</p>
              <p className="text-2xl font-semibold text-gray-900">{tasaActivacion.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {activadas} de {total} activadas
          </div>
        </div>

        {/* Solicitudes Pendientes */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Solicitudes Pendientes</p>
              <p className="text-2xl font-semibold text-gray-900">{pendientes}</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {total - activadas} sin activar en total
          </div>
        </div>
      </div>

      {/* ══════ Registros Recientes + Distribución por Estatus ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Registros Recientes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimas solicitudes de activación registradas</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">ID Solicitud</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {recientes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-500">Sin registros</td>
                  </tr>
                ) : (
                  recientes.map((s, idx) => (
                    <tr key={String(s.id)} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-mono text-[10px] text-gray-700 max-w-[120px] truncate" title={s.solicitudId}>{s.solicitudId || '—'}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-[130px] truncate" title={s.cliente}>{s.cliente}</td>
                      <td className="px-3 py-2 text-gray-700">{s.tipo || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          s.estatus === 'Activada'    ? 'bg-green-100 text-green-700' :
                          s.estatus === 'Pendiente'   ? 'bg-yellow-100 text-yellow-700' :
                          s.estatus === 'En Revisión' ? 'bg-blue-100 text-blue-700' :
                          s.estatus === 'Aprobada'    ? 'bg-purple-100 text-purple-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {s.estatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-300 flex justify-end">
            <button onClick={onGoToList} className="text-xs text-[#0066CC] hover:underline">
              Ver todas las solicitudes →
            </button>
          </div>
        </div>

        {/* Distribución por Estatus */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación según el estado de activación</p>
          </div>
          <div className="p-4">
            {distribucionEstatus.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Sin datos</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart id="act-pie-estatus">
                    <Pie
                      data={distribucionEstatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ estatus, cantidad }: { estatus: string; cantidad: number }) => `${estatus}: ${cantidad}`}
                      outerRadius={70}
                      dataKey="cantidad"
                      nameKey="estatus"
                      id="pie-act-estatus"
                    >
                      {distribucionEstatus.map((entry) => (
                        <Cell key={`cell-${entry.estatus}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {distribucionEstatus.map(item => (
                    <div key={item.estatus} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-700">{item.estatus}: {item.cantidad}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════ Gráficas de Tendencias ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Evolución mensual */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Evolución de Solicitudes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Tendencia en los últimos 6 meses</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart id="act-line-mes" data={evolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Line
                  id="line-act-solicitudes"
                  type="monotone"
                  dataKey="solicitudes"
                  stroke="#2E5C91"
                  strokeWidth={2}
                  dot={{ fill: '#2E5C91', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Solicitudes"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Por tipo */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Por Tipo de Solicitud</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución por tipo de activación</p>
          </div>
          <div className="p-4">
            {tipoData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart id="act-bar-tipo" data={tipoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="tipo" tick={{ fontSize: 11 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <Tooltip />
                  <Bar id="bar-act-tipo" dataKey="solicitudes" fill="#4A6FA5" radius={[4, 4, 0, 0]} name="Solicitudes" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
