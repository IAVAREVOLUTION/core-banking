import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Cliente } from './ClientesList';

interface ClientesDashboardProps {
  clientes: Cliente[];
  onNew: () => void;
  onEdit: (cliente: Cliente) => void;
  onView: (cliente: Cliente) => void;
  onClientesChange: (clientes: Cliente[]) => void;
}

export function ClientesDashboard({ clientes, onNew, onEdit, onView, onClientesChange }: ClientesDashboardProps) {
  // Helper: parsear fecha a timestamp para sorting
  const parseDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    // ISO format: 2024-01-15T10:30:00
    if (dateStr.includes('T') || dateStr.includes('-')) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    // DD/MM/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
  };

  // Helper: formatear fecha a DD/MM/YYYY para display
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    // Si ya está en DD/MM/YYYY, retornar tal cual
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    // ISO format
    if (dateStr.includes('T') || dateStr.includes('-')) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
      }
    }
    return dateStr;
  };

  // Calcular KPIs
  const totalClientes = clientes.length;
  const personasFisicas = clientes.filter(c => c.personalidad === 'Persona Física').length;
  const personasFisicasActividad = clientes.filter(c => 
    c.personalidad === 'Persona Física c/ Actividad empresarial' || 
    c.personalidad === 'Persona Física c/Actividad empresarial'
  ).length;
  const personasMorales = clientes.filter(c => c.personalidad === 'Persona Moral').length;
  
  // Clientes recientes (últimos 8)
  const clientesRecientes = [...clientes]
    .sort((a, b) => parseDate(b.fechaActivacion) - parseDate(a.fechaActivacion))
    .slice(0, 8);

  // KPI 1: Evolución de nuevos clientes por mes
  const nuevosClientesPorMes = [
    { name: 'Ago', mes: 'Ago', clientes: 12 },
    { name: 'Sep', mes: 'Sep', clientes: 18 },
    { name: 'Oct', mes: 'Oct', clientes: 15 },
    { name: 'Nov', mes: 'Nov', clientes: 22 },
    { name: 'Dic', mes: 'Dic', clientes: 19 },
    { name: 'Ene', mes: 'Ene', clientes: clientes.length }, // Mes actual
  ];

  // KPI 2: Distribución por tipo de personalidad
  const distribucionTipo = [
    { name: 'Persona Física', tipo: 'Persona Física', cantidad: personasFisicas, color: '#2E5C91' },
    { name: 'PF c/ Act. Emp.', tipo: 'PF c/ Act. Emp.', cantidad: personasFisicasActividad, color: 'var(--theme-accent)' },
    { name: 'Persona Moral', tipo: 'Persona Moral', cantidad: personasMorales, color: 'var(--theme-primary)' },
  ].filter(item => item.cantidad > 0);

  // KPI 3: Clientes por ejecutivo
  const clientesPorEjecutivo = [
    { name: 'Juan Ramírez', ejecutivo: 'Juan Ramírez', clientes: 28 },
    { name: 'Ana Torres', ejecutivo: 'Ana Torres', clientes: 24 },
    { name: 'Carlos Medina', ejecutivo: 'Carlos Medina', clientes: 22 },
    { name: 'Laura Sánchez', ejecutivo: 'Laura Sánchez', clientes: 19 },
    { name: 'Miguel Ángel', ejecutivo: 'Miguel Ángel', clientes: 16 },
  ];

  // KPI 4: Estatus de clientes
  const estatusClientes = [
    { estatus: 'Activos', cantidad: Math.floor(totalClientes * 0.85), color: '#10B981' },
    { estatus: 'Inactivos', cantidad: Math.floor(totalClientes * 0.10), color: '#F59E0B' },
    { estatus: 'Suspendidos', cantidad: Math.floor(totalClientes * 0.05), color: '#EF4444' },
  ];

  // Crecimiento mensual
  const crecimientoMensual = ((nuevosClientesPorMes[5].clientes - nuevosClientesPorMes[4].clientes) / nuevosClientesPorMes[4].clientes * 100).toFixed(1);

  return (
    <div className="p-6 space-y-6">
      
      {/* Tarjetas de resumen superior */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Clientes */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total de Clientes</p>
              <p className="text-2xl font-semibold text-gray-900">{totalClientes}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E5C91" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-green-600 font-medium">+{crecimientoMensual}%</span>
            <span className="text-gray-600">vs. mes anterior</span>
          </div>
        </div>

        {/* Personas Físicas */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Personas Físicas</p>
              <p className="text-2xl font-semibold text-gray-900">{personasFisicas + personasFisicasActividad}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-primary-theme" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {(((personasFisicas + personasFisicasActividad) / totalClientes) * 100).toFixed(1)}% del total
          </div>
        </div>

        {/* Personas Morales */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Personas Morales</p>
              <p className="text-2xl font-semibold text-gray-900">{personasMorales}</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {((personasMorales / totalClientes) * 100).toFixed(1)}% del total
          </div>
        </div>

        {/* Clientes Activos */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Clientes Activos</p>
              <p className="text-2xl font-semibold text-gray-900">{Math.floor(totalClientes * 0.85)}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            85% tasa de actividad
          </div>
        </div>
      </div>

      {/* Registros Recientes y Distribución por Tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Registros Recientes de Clientes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimos clientes registrados en el sistema</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Nombre</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Sucursal</th>
                </tr>
              </thead>
              <tbody>
                {clientesRecientes.map((cliente, idx) => (
                  <tr key={cliente.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900">{(cliente as any).nombreCompleto || cliente.nombre}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        cliente.personalidad === 'Persona Física' 
                          ? 'bg-blue-50 text-blue-700' 
                          : cliente.personalidad.includes('Actividad') 
                            ? 'bg-cyan-50 text-cyan-700'
                            : 'bg-purple-50 text-purple-700'
                      }`}>
                        {cliente.personalidad === 'Persona Física' ? 'PF' : 
                         cliente.personalidad.includes('Actividad') ? 'PFAE' : 'PM'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formatDate(cliente.fechaActivacion)}</td>
                    <td className="px-3 py-2 text-gray-700">{cliente.sucursal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribución por Tipo de Personalidad */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Tipo</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación de clientes por personalidad jurídica</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <div className="w-full">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={distribucionTipo}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ tipo, cantidad }) => `${tipo.split(' ')[1]}: ${cantidad}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cantidad"
                  >
                    {distribucionTipo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex justify-center gap-6">
                {distribucionTipo.map((item) => (
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
        
        {/* KPI 1: Nuevos Clientes por Mes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Nuevos Clientes por Mes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Evolución de captación de clientes</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={nuevosClientesPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  formatter={(value: any) => [value, 'Clientes']}
                />
                <Bar dataKey="clientes" fill="#2E5C91" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 2: Clientes por Ejecutivo */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Clientes por Ejecutivo</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución de cartera por asesor</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={clientesPorEjecutivo} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis dataKey="ejecutivo" type="category" tick={{ fontSize: 11 }} stroke="#6B7280" width={100} />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  formatter={(value: any) => [value, 'Clientes']}
                />
                <Bar dataKey="clientes" fill="var(--theme-primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI 3: Estatus de Clientes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Estatus de Clientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación por estado de actividad</p>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {estatusClientes.map((item) => (
                <div key={item.estatus} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700 font-medium">{item.estatus}</span>
                    <span className="text-gray-900">{item.cantidad} clientes ({((item.cantidad / totalClientes) * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="h-2.5 rounded-full transition-all" 
                      style={{ 
                        width: `${(item.cantidad / totalClientes) * 100}%`,
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
            <p className="text-xs text-gray-600 mt-0.5">Proyección de captación de clientes</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={nuevosClientesPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  formatter={(value: any) => [value, 'Clientes']}
                />
                <Line 
                  type="monotone" 
                  dataKey="clientes" 
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