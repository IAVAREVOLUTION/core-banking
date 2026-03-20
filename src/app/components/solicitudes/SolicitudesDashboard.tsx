import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SolicitudListItem } from './solicitudCreditoStore';

interface SolicitudesDashboardProps {
  solicitudes: SolicitudListItem[];
  onGoToList: () => void;
}

export function SolicitudesDashboard({ solicitudes, onGoToList }: SolicitudesDashboardProps) {
  const totalSolicitudes = solicitudes.length;
  const montoTotalSolicitado = solicitudes.reduce((sum, s) => sum + s.montoSolicitado, 0);
  const solicitudesAprobadas = solicitudes.filter(s => s.estatusSolicitud === 'Aprobado').length;
  const tasaAprobacion = totalSolicitudes > 0 ? (solicitudesAprobadas / totalSolicitudes * 100) : 0;
  const tiempoPromedioRespuesta = 3.5;

  // Últimas 8 solicitudes
  const solicitudesRecientes = [...solicitudes]
    .sort((a, b) => {
      const dateA = a.fechaSolicitud.split('/').reverse().join('');
      const dateB = b.fechaSolicitud.split('/').reverse().join('');
      return dateB.localeCompare(dateA);
    })
    .slice(0, 8);

  // Evolución mensual
  const solicitudesPorMes = [
    { mes: 'Ago', solicitudes: 145 },
    { mes: 'Sep', solicitudes: 168 },
    { mes: 'Oct', solicitudes: 152 },
    { mes: 'Nov', solicitudes: 189 },
    { mes: 'Dic', solicitudes: 175 },
    { mes: 'Ene', solicitudes: totalSolicitudes },
  ];

  // Distribución por estatus
  const distribucionEstatus = [
    { estatus: 'Aprobado', cantidad: solicitudesAprobadas, color: '#10B981' },
    { estatus: 'Pendiente', cantidad: solicitudes.filter(s => s.estatusSolicitud === 'Pendiente').length, color: '#F59E0B' },
    { estatus: 'En Análisis', cantidad: solicitudes.filter(s => s.estatusSolicitud === 'En Análisis').length, color: '#3B82F6' },
    { estatus: 'Rechazado', cantidad: solicitudes.filter(s => s.estatusSolicitud === 'Rechazado').length, color: '#EF4444' },
  ].filter(d => d.cantidad > 0);

  // Montos por producto
  const montosPorProducto: Record<string, number> = {};
  solicitudes.forEach(s => {
    const key = s.tipoProducto || 'Sin tipo';
    montosPorProducto[key] = (montosPorProducto[key] || 0) + s.montoSolicitado;
  });
  const montosProdData = Object.entries(montosPorProducto).map(([producto, monto]) => ({ producto, monto }));

  // Solicitudes por sucursal
  const porSucursal: Record<string, number> = {};
  solicitudes.forEach(s => { 
    const key = s.sucursal || 'Sin sucursal';
    porSucursal[key] = (porSucursal[key] || 0) + 1; 
  });
  const sucursalData = Object.entries(porSucursal).map(([sucursal, count]) => ({ sucursal, solicitudes: count }));

  const crecimientoMensual = solicitudesPorMes.length >= 2
    ? ((solicitudesPorMes[5].solicitudes - solicitudesPorMes[4].solicitudes) / solicitudesPorMes[4].solicitudes * 100).toFixed(1)
    : '0.0';

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return '$0.00';
    return `$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="p-6 space-y-6">

      {/* ══════ 4 KPIs ══════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Solicitudes */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total de Solicitudes</p>
              <p className="text-2xl font-semibold text-gray-900">{totalSolicitudes}</p>
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
            <span className="text-green-600 font-medium">+{crecimientoMensual}%</span>
            <span className="text-gray-600">vs. mes anterior</span>
          </div>
        </div>

        {/* Monto Total */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Monto Total Solicitado</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(montoTotalSolicitado)}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Promedio: {formatCurrency(totalSolicitudes > 0 ? montoTotalSolicitado / totalSolicitudes : 0)}
          </div>
        </div>

        {/* Tasa de Aprobación */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Tasa de Aprobación</p>
              <p className="text-2xl font-semibold text-gray-900">{tasaAprobacion.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {solicitudesAprobadas} de {totalSolicitudes} aprobadas
          </div>
        </div>

        {/* Tiempo Promedio */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Tiempo Promedio</p>
              <p className="text-2xl font-semibold text-gray-900">{tiempoPromedioRespuesta} días</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">Meta: 4.0 días</div>
        </div>
      </div>

      {/* ══════ Registros Recientes + Distribución por Estatus ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registros Recientes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimas solicitudes registradas en el sistema</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">N° Solicitud</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Solicitante</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Monto</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesRecientes.map((s, idx) => (
                  <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900 font-medium max-w-[160px] truncate" title={s.noSol}>{s.noSol}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate" title={s.nombreCompleto}>{s.nombreCompleto}</td>
                    <td className="px-3 py-2 text-gray-900">{formatCurrency(s.montoSolicitado)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        s.estatusSolicitud === 'Aprobado' ? 'bg-green-100 text-green-700' :
                        s.estatusSolicitud === 'Pendiente' ? 'bg-yellow-100 text-yellow-700' :
                        s.estatusSolicitud === 'En Análisis' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {s.estatusSolicitud}
                      </span>
                    </td>
                  </tr>
                ))}
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
            <p className="text-xs text-gray-600 mt-0.5">Clasificación de solicitudes según su estado</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <div className="w-full">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart id="sol-pie-estatus">
                  <Pie
                    data={distribucionEstatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ estatus, cantidad }) => `${estatus}: ${cantidad}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cantidad"
                    nameKey="estatus"
                    id="pie-estatus"
                  >
                    {distribucionEstatus.map((entry, index) => (
                      <Cell key={`cell-estatus-${entry.estatus}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {distribucionEstatus.map(item => (
                  <div key={item.estatus} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-700">{item.estatus}: {item.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ Gráficas de Tendencias ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolución de Solicitudes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Evolución de Solicitudes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Tendencia en los últimos 6 meses</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart id="sol-line-mes" data={solicitudesPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Line id="line-solicitudes" type="monotone" dataKey="solicitudes" stroke="#2E5C91" strokeWidth={2} dot={{ fill: '#2E5C91', r: 4 }} activeDot={{ r: 6 }} name="Solicitudes" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Por Sucursal */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Solicitudes por Sucursal</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución geográfica</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart id="sol-bar-sucursal" data={sucursalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="sucursal" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Bar id="bar-sucursal" dataKey="solicitudes" fill="#4A6FA5" radius={[4, 4, 0, 0]} name="Solicitudes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ══════ Montos por Producto ══════ */}
      <div className="bg-white border border-gray-300 rounded">
        <div className="bg-white border-b border-gray-300 px-4 py-3">
          <h2 className="text-base font-medium text-gray-900">Montos Solicitados por Tipo de Producto</h2>
          <p className="text-xs text-gray-600 mt-0.5">Comparativo de montos por tipo de producto</p>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart id="sol-bar-montos" data={montosProdData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6B7280" />
              <YAxis dataKey="producto" type="category" tick={{ fontSize: 11 }} stroke="#6B7280" width={150} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar id="bar-montos" dataKey="monto" fill="#10B981" radius={[0, 4, 4, 0]} name="Monto" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}