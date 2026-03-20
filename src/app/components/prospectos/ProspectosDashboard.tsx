import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Prospecto } from './ProspectosList';

interface ProspectosDashboardProps {
  prospectos: Prospecto[];
  onNew: () => void;
  onEdit: (prospecto: Prospecto) => void;
  onView: (prospecto: Prospecto) => void;
  onProspectosChange: (prospectos: Prospecto[]) => void;
}

export function ProspectosDashboard({ prospectos, onNew, onEdit, onView, onProspectosChange }: ProspectosDashboardProps) {
  // Calcular KPIs
  const totalProspectos = prospectos.length;
  const prospectosActivos = prospectos.filter(p => p.categoria === 'Prospecto').length;
  const sicPositivos = prospectos.filter(p => p.estatusSIC === 'Positivo').length;
  const sicNegativos = 3; // Forzar 3 negativos
  
  // Prospectos recientes (últimos 8)
  const prospectosRecientes = [...prospectos]
    .sort((a, b) => {
      const dateA = a.fechaOriginacion.split('/').reverse().join('');
      const dateB = b.fechaOriginacion.split('/').reverse().join('');
      return dateB.localeCompare(dateA);
    })
    .slice(0, 8);

  // KPI 1: Nuevos prospectos por mes
  const nuevosPorMes = [
    { name: 'Ago', mes: 'Ago', prospectos: 6 },
    { name: 'Sep', mes: 'Sep', prospectos: 8 },
    { name: 'Oct', mes: 'Oct', prospectos: 5 },
    { name: 'Nov', mes: 'Nov', prospectos: 10 },
    { name: 'Dic', mes: 'Dic', prospectos: 7 },
    { name: 'Ene', mes: 'Ene', prospectos: totalProspectos },
  ];

  // KPI 2: Distribución por estatus SIC
  const distribucionSIC = [
    { name: 'Positivo', estatus: 'Positivo', cantidad: sicPositivos, color: '#10B981' },
    { name: 'Negativo', estatus: 'Negativo', cantidad: sicNegativos, color: '#EF4444' },
    { name: 'Pendiente', estatus: 'Pendiente', cantidad: totalProspectos - sicPositivos - sicNegativos, color: '#F59E0B' },
  ].filter(item => item.cantidad > 0);

  // KPI 3: Prospectos por sucursal
  const prospectosPorSucursal = [
    { name: 'Monterrey', sucursal: 'Monterrey', cantidad: prospectos.filter(p => p.sucursal === 'Monterrey').length },
    { name: 'Guadalajara', sucursal: 'Guadalajara', cantidad: prospectos.filter(p => p.sucursal === 'Guadalajara').length },
    { name: 'CDMX', sucursal: 'CDMX', cantidad: prospectos.filter(p => p.sucursal === 'CDMX').length },
    { name: 'Querétaro', sucursal: 'Querétaro', cantidad: prospectos.filter(p => p.sucursal === 'Querétaro').length },
    { name: 'Toluca', sucursal: 'Toluca', cantidad: prospectos.filter(p => p.sucursal === 'Toluca').length },
  ].filter(item => item.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);

  // KPI 4: Tasa de conversión simulada
  const tasaConversion = [
    { name: 'Ago', mes: 'Ago', tasa: 15 },
    { name: 'Sep', mes: 'Sep', tasa: 22 },
    { name: 'Oct', mes: 'Oct', tasa: 18 },
    { name: 'Nov', mes: 'Nov', tasa: 28 },
    { name: 'Dic', mes: 'Dic', tasa: 25 },
    { name: 'Ene', mes: 'Ene', tasa: 30 },
  ];

  const tasaPromedio = (tasaConversion.reduce((sum, item) => sum + item.tasa, 0) / tasaConversion.length).toFixed(1);

  return (
    <div className="p-6 space-y-6">
      
      {/* Tarjetas de resumen superior */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Prospectos */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total de Prospectos</p>
              <p className="text-2xl font-semibold text-gray-900">{totalProspectos}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E5C91" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Prospectos activos en sistema
          </div>
        </div>

        {/* SIC Positivos */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">SIC Positivo</p>
              <p className="text-2xl font-semibold text-gray-900">{sicPositivos}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {((sicPositivos / totalProspectos) * 100).toFixed(1)}% del total
          </div>
        </div>

        {/* SIC Negativos */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">SIC Negativo</p>
              <p className="text-2xl font-semibold text-gray-900">{sicNegativos}</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {((sicNegativos / totalProspectos) * 100).toFixed(1)}% del total
          </div>
        </div>

        {/* Tasa de Conversión */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Tasa de Conversión</p>
              <p className="text-2xl font-semibold text-gray-900">{tasaPromedio}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Promedio mensual
          </div>
        </div>
      </div>

      {/* Registros Recientes y Distribución SIC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Registros Recientes de Prospectos */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimos prospectos registrados en el sistema</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">ID</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Nombre</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Sucursal</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {prospectosRecientes.map((prospecto, idx) => (
                  <tr key={prospecto.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-700">{prospecto.id.toString().padStart(3, '0')}</td>
                    <td className="px-3 py-2 text-gray-900">{prospecto.nombre}</td>
                    <td className="px-3 py-2 text-gray-700">{prospecto.sucursal || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{prospecto.fechaOriginacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribución por Estatus SIC */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Estatus SIC</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación de prospectos por estatus crediticio</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <div className="w-full">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={distribucionSIC}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ estatus, cantidad }) => `${estatus}: ${cantidad}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cantidad"
                  >
                    {distribucionSIC.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex justify-center gap-6">
                {distribucionSIC.map((item) => (
                  <div key={item.estatus} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-700">{item.estatus}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficas KPI - Grid de 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* KPI 1: Nuevos Prospectos por Mes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Nuevos Prospectos por Mes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Evolución de captación de prospectos</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={nuevosPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  formatter={(value: any) => [value, 'Prospectos']}
                />
                <Bar dataKey="prospectos" fill="#2E5C91" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 2: Prospectos por Sucursal */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Prospectos por Sucursal</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución geográfica de prospectos</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={prospectosPorSucursal} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis dataKey="sucursal" type="category" tick={{ fontSize: 11 }} stroke="#6B7280" width={80} />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  formatter={(value: any) => [value, 'Prospectos']}
                />
                <Bar dataKey="cantidad" fill="#4A6FA5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 3: Tasa de Conversión */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Tasa de Conversión a Cliente</h2>
            <p className="text-xs text-gray-600 mt-0.5">Porcentaje de prospectos convertidos mensualmente</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={tasaConversion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  formatter={(value: any) => [`${value}%`, 'Conversión']}
                />
                <Line 
                  type="monotone" 
                  dataKey="tasa" 
                  stroke="#2E5C91" 
                  strokeWidth={2} 
                  dot={{ fill: '#2E5C91', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 4: Resumen de Estatus */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Resumen de Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Estado actual de la cartera de prospectos</p>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-700 font-medium">SIC Positivo</span>
                  <span className="text-gray-900">{sicPositivos} ({((sicPositivos / totalProspectos) * 100).toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="h-2.5 rounded-full bg-green-500 transition-all" 
                    style={{ width: `${(sicPositivos / totalProspectos) * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-700 font-medium">SIC Negativo</span>
                  <span className="text-gray-900">{sicNegativos} ({((sicNegativos / totalProspectos) * 100).toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="h-2.5 rounded-full bg-red-500 transition-all" 
                    style={{ width: `${(sicNegativos / totalProspectos) * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-700 font-medium">SIC Pendiente</span>
                  <span className="text-gray-900">{totalProspectos - sicPositivos - sicNegativos} ({(((totalProspectos - sicPositivos - sicNegativos) / totalProspectos) * 100).toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="h-2.5 rounded-full bg-yellow-500 transition-all" 
                    style={{ width: `${((totalProspectos - sicPositivos - sicNegativos) / totalProspectos) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}