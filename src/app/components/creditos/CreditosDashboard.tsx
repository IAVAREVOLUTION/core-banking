import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Credito } from '@/types/credito';

interface CreditosDashboardProps {
  creditos: Credito[];
  onNew: () => void;
  onEdit: (credito: Credito) => void;
  onView: (credito: Credito) => void;
}

export function CreditosDashboard({ creditos, onNew, onEdit, onView }: CreditosDashboardProps) {
  // Calcular KPIs
  const totalCreditos = creditos.length;
  const creditosAutorizados = creditos.filter(c => c.estatusCredito === 'Autorizado').length;
  const creditosPendientes = creditos.filter(c => c.estatusCredito === 'Pendiente').length;
  const montoTotalAutorizado = creditos.reduce((sum, c) => sum + c.montoAutorizado, 0);
  
  // Créditos recientes (últimos 8)
  const creditosRecientes = [...creditos]
    .sort((a, b) => {
      const dateA = a.fechaCredito.split('/').reverse().join('');
      const dateB = b.fechaCredito.split('/').reverse().join('');
      return dateB.localeCompare(dateA);
    })
    .slice(0, 8);

  // KPI 1: Evolución de nuevos créditos por mes
  const nuevosCreditosPorMes = [
    { mes: 'Ago', creditos: 10 },
    { mes: 'Sep', creditos: 15 },
    { mes: 'Oct', creditos: 12 },
    { mes: 'Nov', creditos: 18 },
    { mes: 'Dic', creditos: 16 },
    { mes: 'Ene', creditos: creditos.length }, // Mes actual
  ];

  // KPI 2: Distribución por estatus
  const distribucionEstatus = [
    { tipo: 'Autorizado', cantidad: creditosAutorizados, color: '#10B981' },
    { tipo: 'Pendiente', cantidad: creditosPendientes, color: '#F59E0B' },
    { tipo: 'En revisión', cantidad: creditos.filter(c => c.estatusCredito === 'En revisión').length, color: '#3B82F6' },
  ];

  // KPI 3: Créditos por sucursal
  const creditosPorSucursal = [
    { sucursal: 'CDMX', creditos: creditos.filter(c => c.sucursal === 'CDMX').length },
    { sucursal: 'Monterrey', creditos: creditos.filter(c => c.sucursal === 'Monterrey').length },
    { sucursal: 'Guadalajara', creditos: creditos.filter(c => c.sucursal === 'Guadalajara').length },
    { sucursal: 'Querétaro', creditos: creditos.filter(c => c.sucursal === 'Querétaro').length },
    { sucursal: 'Otras', creditos: creditos.filter(c => !['CDMX', 'Monterrey', 'Guadalajara', 'Querétaro'].includes(c.sucursal)).length },
  ].filter(item => item.creditos > 0);

  // KPI 4: Estatus de créditos
  const estatusCreditos = [
    { estatus: 'Autorizados', cantidad: creditosAutorizados, color: '#10B981' },
    { estatus: 'Pendientes', cantidad: creditosPendientes, color: '#F59E0B' },
    { estatus: 'En revisión', cantidad: creditos.filter(c => c.estatusCredito === 'En revisión').length, color: '#3B82F6' },
  ];

  // Crecimiento mensual
  const crecimientoMensual = ((nuevosCreditosPorMes[5].creditos - nuevosCreditosPorMes[4].creditos) / nuevosCreditosPorMes[4].creditos * 100).toFixed(1);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* Tarjetas de resumen superior */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Créditos */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total de Créditos</p>
              <p className="text-2xl font-semibold text-gray-900">{totalCreditos}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-primary-theme" strokeWidth="2">
                <rect x="2" y="3" width="20" height="18" rx="2"/>
                <path d="M2 9h20"/>
                <path d="M7 3v4M17 3v4"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-green-600 font-medium">+{crecimientoMensual}%</span>
            <span className="text-gray-600">vs. mes anterior</span>
          </div>
        </div>

        {/* Monto Total Autorizado */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Monto Total Autorizado</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(montoTotalAutorizado)}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-primary-theme" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Suma de montos autorizados
          </div>
        </div>

        {/* Créditos Autorizados */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Créditos Autorizados</p>
              <p className="text-2xl font-semibold text-gray-900">{creditosAutorizados}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {((creditosAutorizados / totalCreditos) * 100).toFixed(1)}% del total
          </div>
        </div>

        {/* Créditos Pendientes */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Créditos Pendientes</p>
              <p className="text-2xl font-semibold text-gray-900">{creditosPendientes}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {((creditosPendientes / totalCreditos) * 100).toFixed(1)}% del total
          </div>
        </div>
      </div>

      {/* Registros Recientes y Distribución por Estatus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Registros Recientes de Créditos */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimos créditos registrados en el sistema</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">No. Crédito</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Monto</th>
                </tr>
              </thead>
              <tbody>
                {creditosRecientes.map((credito, idx) => (
                  <tr key={credito.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900">{credito.nroCredito}</td>
                    <td className="px-3 py-2 text-gray-900">{credito.clienteNombre}</td>
                    <td className="px-3 py-2 text-gray-700">{credito.fechaCredito}</td>
                    <td className="px-3 py-2 text-gray-700">{formatCurrency(credito.montoAutorizado)}</td>
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
            <p className="text-xs text-gray-600 mt-0.5">Clasificación de créditos por estado</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <div className="w-full">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={distribucionEstatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ tipo, cantidad }) => `${tipo}: ${cantidad}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cantidad"
                  >
                    {distribucionEstatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex justify-center gap-6">
                {distribucionEstatus.map((item) => (
                  <div key={item.tipo} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-700">{item.tipo}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficas KPI - Grid de 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* KPI 1: Nuevos Créditos por Mes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Nuevos Créditos por Mes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Evolución de otorgamiento de créditos</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={nuevosCreditosPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  formatter={(value: any) => [value, 'Créditos']}
                />
                <Bar dataKey="creditos" fill="#2E5C91" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 2: Créditos por Sucursal */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Créditos por Sucursal</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución de cartera por ubicación</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={creditosPorSucursal} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis dataKey="sucursal" type="category" tick={{ fontSize: 11 }} stroke="#6B7280" width={100} />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  formatter={(value: any) => [value, 'Créditos']}
                />
                <Bar dataKey="creditos" fill="var(--theme-primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 3: Estatus de Créditos */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Estatus de Créditos</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación por estado de operación</p>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {estatusCreditos.map((item) => (
                <div key={item.estatus} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700 font-medium">{item.estatus}</span>
                    <span className="text-gray-900">{item.cantidad} créditos ({((item.cantidad / totalCreditos) * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="h-2.5 rounded-full transition-all" 
                      style={{ 
                        width: `${(item.cantidad / totalCreditos) * 100}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KPI 4: Tendencia de Crecimiento */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Tendencia de Crecimiento</h2>
            <p className="text-xs text-gray-600 mt-0.5">Proyección de otorgamiento de créditos</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={nuevosCreditosPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  formatter={(value: any) => [value, 'Créditos']}
                />
                <Line 
                  type="monotone" 
                  dataKey="creditos" 
                  stroke="#2E5C91" 
                  strokeWidth={2} 
                  dot={{ fill: '#2E5C91', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}