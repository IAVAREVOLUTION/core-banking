import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface InversionesHomeProps {
  onViewList: () => void;
  onNewInversion: () => void;
}

// Datos mock para las gráficas
const dataNuevasInversionesMes = [
  { mes: 'Ene', cantidad: 8 },
  { mes: 'Feb', cantidad: 12 },
  { mes: 'Mar', cantidad: 10 },
  { mes: 'Abr', cantidad: 16 },
  { mes: 'May', cantidad: 14 },
  { mes: 'Jun', cantidad: 5 },
];

const dataInversionesPorSucursal = [
  { sucursal: 'CDMX', cantidad: 45 },
  { sucursal: 'Monterrey', cantidad: 32 },
  { sucursal: 'Guadalajara', cantidad: 28 },
];

const dataEstatus = [
  { name: 'Activas', value: 68, color: '#28A745' },
  { name: 'Vencidas', value: 15, color: '#FFA500' },
  { name: 'En revisión', value: 17, color: '#2E5C91' },
];

// Registros recientes mock
const registrosRecientes = [
  { noInversion: 'INV-001', cliente: 'Juan Pérez García', fecha: '14/01/26', monto: '$500,000.00' },
  { noInversion: 'INV-002', cliente: 'María González López', fecha: '13/01/26', monto: '$1,200,000.00' },
  { noInversion: 'INV-003', cliente: 'Carlos Ramírez Soto', fecha: '12/01/26', monto: '$800,000.00' },
  { noInversion: 'INV-004', cliente: 'Ana Martínez Cruz', fecha: '11/01/26', monto: '$2,500,000.00' },
  { noInversion: 'INV-005', cliente: 'Roberto Torres Vega', fecha: '10/01/26', monto: '$300,000.00' },
  { noInversion: 'INV-006', cliente: 'Patricia Jiménez Ruiz', fecha: '09/01/26', monto: '$650,000.00' },
  { noInversion: 'INV-007', cliente: 'Luis Fernando Castro', fecha: '08/01/26', monto: '$1,100,000.00' },
  { noInversion: 'INV-008', cliente: 'Carmen Delgado Silva', fecha: '07/01/26', monto: '$950,000.00' },
];

export function InversionesHome({ onViewList, onNewInversion }: InversionesHomeProps) {
  return (
    <div className="flex-1 bg-[#F5F5F5] p-6 overflow-auto">
      {/* KPIs superiores */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* KPI 1 */}
        <div className="bg-white rounded-lg border border-gray-300 p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className="text-xs text-gray-600 mb-2">Total de Inversiones</p>
              <p className="text-3xl font-normal text-gray-900">136</p>
            </div>
            <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#2E5C91" strokeWidth="1.5">
                <rect x="3" y="3" width="14" height="14" rx="2"/>
              </svg>
            </div>
          </div>
          <p className="text-xs text-green-600">↑ 12.5% vs. mes anterior</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-lg border border-gray-300 p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className="text-xs text-gray-600 mb-2">Monto Total Invertido</p>
              <p className="text-3xl font-normal text-gray-900">$45.2M</p>
            </div>
            <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#2E5C91" strokeWidth="1.5">
                <path d="M10 2v16M15 5H7.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H5"/>
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-600">Suma de montos invertidos</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-lg border border-gray-300 p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className="text-xs text-gray-600 mb-2">Inversiones Activas</p>
              <p className="text-3xl font-normal text-gray-900">92</p>
            </div>
            <div className="w-10 h-10 rounded bg-green-50 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#28A745" strokeWidth="2">
                <path d="M16 6L7.5 14.5 4 11"/>
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-600">67.6% del total</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-lg border border-gray-300 p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className="text-xs text-gray-600 mb-2">Inversiones Vencidas</p>
              <p className="text-3xl font-normal text-gray-900">20</p>
            </div>
            <div className="w-10 h-10 rounded bg-yellow-50 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#FFA500" strokeWidth="2">
                <circle cx="10" cy="10" r="8"/>
                <path d="M10 6v4M10 14h.01"/>
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-600">14.7% del total</p>
        </div>
      </div>

      {/* Sección de Registros Recientes y Distribución por Estatus */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Registros Recientes */}
        <div className="bg-white rounded-lg border border-gray-300 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Registros Recientes</h3>
            <p className="text-xs text-gray-500">Últimas inversiones registradas en el sistema</p>
          </div>
          <div className="space-y-0">
            <div className="grid grid-cols-4 gap-2 pb-2 border-b border-gray-200 mb-2">
              <p className="text-xs font-medium text-gray-600">No. Inversión</p>
              <p className="text-xs font-medium text-gray-600">Cliente</p>
              <p className="text-xs font-medium text-gray-600">Fecha</p>
              <p className="text-xs font-medium text-gray-600 text-right">Monto</p>
            </div>
            {registrosRecientes.map((registro, index) => (
              <div key={index} className="grid grid-cols-4 gap-2 py-1.5 hover:bg-gray-50">
                <p className="text-xs text-blue-600">{registro.noInversion}</p>
                <p className="text-xs text-gray-700 truncate">{registro.cliente}</p>
                <p className="text-xs text-gray-700">{registro.fecha}</p>
                <p className="text-xs text-gray-700 text-right">{registro.monto}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Distribución por Estatus */}
        <div className="bg-white rounded-lg border border-gray-300 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Distribución por Estatus</h3>
            <p className="text-xs text-gray-500">Clasificación de inversiones por estado</p>
          </div>
          <div className="flex items-center justify-center" style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataEstatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {dataEstatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} contentStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-2">
            {dataEstatus.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs text-gray-700">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sección de Gráficas */}
      <div className="grid grid-cols-2 gap-4">
        {/* Nuevas Inversiones por Mes */}
        <div className="bg-white rounded-lg border border-gray-300 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Nuevas Inversiones por Mes</h3>
            <p className="text-xs text-gray-500">Evolución de registro de inversiones</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dataNuevasInversionesMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px' }} />
              <Bar dataKey="cantidad" fill="#2E5C91" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Inversiones por Sucursal */}
        <div className="bg-white rounded-lg border border-gray-300 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Inversiones por Sucursal</h3>
            <p className="text-xs text-gray-500">Distribución de cartera por ubicación</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dataInversionesPorSucursal} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis type="category" dataKey="sucursal" tick={{ fontSize: 11 }} stroke="#9CA3AF" width={80} />
              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px' }} />
              <Bar dataKey="cantidad" fill="#2E5C91" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}