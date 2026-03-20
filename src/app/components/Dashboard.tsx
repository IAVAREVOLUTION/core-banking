import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { memo, useState } from 'react';
import { ProcessFlowMap } from './ProcessFlowMap';

// Datos mock para el dashboard
const clientesRecientes = [
  { id: 1, nombre: 'María González Pérez', fechaAlta: '08/01/26', tipoCliente: 'Persona Física', ejecutivo: 'Juan Ramírez' },
  { id: 2, nombre: 'Comercializadora ABC S.A. de C.V.', fechaAlta: '07/01/26', tipoCliente: 'Persona Moral', ejecutivo: 'Ana Torres' },
  { id: 3, nombre: 'Roberto Martínez López', fechaAlta: '06/01/26', tipoCliente: 'Persona Física', ejecutivo: 'Carlos Medina' },
  { id: 4, nombre: 'Inversiones DEF S.A.', fechaAlta: '05/01/26', tipoCliente: 'Persona Moral', ejecutivo: 'Laura Sánchez' },
  { id: 5, nombre: 'Patricia Hernández Silva', fechaAlta: '04/01/26', tipoCliente: 'Persona Física', ejecutivo: 'Juan Ramírez' },
];

const solicitudesPendientes = [
  { id: 1, tipo: 'Apertura de cuenta', cliente: 'José Luis Fernández', prioridad: 'Alta', fechaLimite: '15/01/26', estado: 'En revisión' },
  { id: 2, tipo: 'Crédito personal', cliente: 'Ana María Castro', prioridad: 'Media', fechaLimite: '18/01/26', estado: 'Pendiente documentación' },
  { id: 3, tipo: 'Actualización de datos', cliente: 'Constructora XYZ S.A.', prioridad: 'Baja', fechaLimite: '20/01/26', estado: 'En proceso' },
  { id: 4, tipo: 'Crédito hipotecario', cliente: 'Ricardo Gómez Ruiz', prioridad: 'Alta', fechaLimite: '16/01/26', estado: 'En análisis' },
  { id: 5, tipo: 'Apertura de inversión', cliente: 'Servicios MNO S.C.', prioridad: 'Media', fechaLimite: '22/01/26', estado: 'Pendiente firma' },
];

const creditosRecientes = [
  { id: 1, cliente: 'Pedro Sánchez López', monto: '$250,000.00', producto: 'Crédito Personal', fechaDesembolso: '10/01/26', estado: 'Vigente' },
  { id: 2, cliente: 'Transportes RST S.A.', monto: '$1,500,000.00', producto: 'Crédito Empresarial', fechaDesembolso: '09/01/26', estado: 'Vigente' },
  { id: 3, cliente: 'Carmen Reyes García', monto: '$850,000.00', producto: 'Crédito Hipotecario', fechaDesembolso: '08/01/26', estado: 'Vigente' },
  { id: 4, cliente: 'PYME Soluciones S.C.', monto: '$450,000.00', producto: 'Crédito PYME', fechaDesembolso: '07/01/26', estado: 'En proceso' },
  { id: 5, cliente: 'Miguel Ángel Torres', monto: '$120,000.00', producto: 'Crédito Automotriz', fechaDesembolso: '06/01/26', estado: 'Vigente' },
];

// Datos para gráficas
const colocacionData = [
  { mes: 'Ago', monto: 2400 },
  { mes: 'Sep', monto: 3200 },
  { mes: 'Oct', monto: 2800 },
  { mes: 'Nov', monto: 3800 },
  { mes: 'Dic', monto: 4200 },
  { mes: 'Ene', monto: 3600 },
];

const cobranzaData = [
  { mes: 'Ago', esperado: 2800, real: 2600 },
  { mes: 'Sep', esperado: 3000, real: 2900 },
  { mes: 'Oct', esperado: 3200, real: 3100 },
  { mes: 'Nov', esperado: 3400, real: 3200 },
  { mes: 'Dic', esperado: 3600, real: 3500 },
  { mes: 'Ene', esperado: 3800, real: 3600 },
];

const antiguedadSaldosData = [
  { categoria: 'Al corriente', valor: 68, color: '#2E5C91' },
  { categoria: '1-30 días', valor: 18, color: 'var(--theme-primary)' },
  { categoria: '31-60 días', valor: 8, color: '#F59E0B' },
  { categoria: '61-90 días', valor: 4, color: '#EF4444' },
  { categoria: '>90 días', valor: 2, color: '#991B1B' },
];

const carteraPorRiesgoData = [
  { nivel: 'A', monto: 4500, porcentaje: 65 },
  { nivel: 'B', monto: 1800, porcentaje: 26 },
  { nivel: 'C', monto: 450, porcentaje: 6 },
  { nivel: 'D', monto: 150, porcentaje: 2 },
  { nivel: 'E', monto: 50, porcentaje: 1 },
];

const insights = [
  { 
    tipo: 'tendencia', 
    titulo: 'Colocación en crecimiento',
    descripcion: 'La colocación de créditos aumentó 15% vs. mes anterior. Se recomienda ampliar capacidad de análisis.',
    prioridad: 'media'
  },
  { 
    tipo: 'alerta', 
    titulo: 'Incremento en cartera vencida',
    descripcion: 'Se detectó aumento de 8% en cartera con antigüedad >60 días. Requiere seguimiento inmediato.',
    prioridad: 'alta'
  },
  { 
    tipo: 'oportunidad', 
    titulo: 'Alta conversión en créditos PYME',
    descripcion: 'Tasa de aprobación PYME alcanzó 82%. Oportunidad de aumentar promoción en este segmento.',
    prioridad: 'baja'
  },
];

// ─── Isolated chart components to prevent Recharts internal key collisions ───
const ColocacionChart = memo(function ColocacionChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={colocacionData}>
        <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis key="x" dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
        <YAxis key="y" tick={{ fontSize: 11 }} stroke="#6B7280" />
        <Tooltip
          key="tooltip"
          contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
          formatter={(value: any) => [`$${value}K`, 'Monto']}
        />
        <Bar key="bar" dataKey="monto" fill="#2E5C91" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

const CobranzaChart = memo(function CobranzaChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={cobranzaData}>
        <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis key="x" dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
        <YAxis key="y" tick={{ fontSize: 11 }} stroke="#6B7280" />
        <Tooltip
          key="tooltip"
          contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
          formatter={(value: any) => `$${value}K`}
        />
        <Legend key="legend" wrapperStyle={{ fontSize: '11px' }} />
        <Line key="esperado" type="monotone" dataKey="esperado" stroke="#9CA3AF" strokeWidth={2} name="Esperado" strokeDasharray="5 5" />
        <Line key="real" type="monotone" dataKey="real" stroke="#2E5C91" strokeWidth={2} name="Real" />
      </LineChart>
    </ResponsiveContainer>
  );
});

const AntiguedadChart = memo(function AntiguedadChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={antiguedadSaldosData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ categoria, valor }: any) => `${categoria}: ${valor}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="valor"
          nameKey="categoria"
        >
          {antiguedadSaldosData.map((entry) => (
            <Cell key={`cell-${entry.categoria}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
          formatter={(value: any) => `${value}%`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});

export function Dashboard({ onNavigateToModule }: { onNavigateToModule?: (moduleId: string) => void }) {
  const [showFlowMap, setShowFlowMap] = useState(false);

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad.toLowerCase()) {
      case 'alta': return 'text-red-600 bg-red-50';
      case 'media': return 'text-yellow-700 bg-yellow-50';
      case 'baja': return 'text-green-700 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getInsightIcon = (tipo: string) => {
    switch (tipo) {
      case 'alerta':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L2 17h16L10 2z" stroke="#EF4444" strokeWidth="1.5" fill="#FEE2E2"/>
            <path d="M10 8v4M10 14h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'tendencia':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M2 15l5-5 4 4 7-7" stroke="#2E5C91" strokeWidth="2" strokeLinecap="round"/>
            <path d="M18 5v5h-5" stroke="#2E5C91" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'oportunidad':
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#10B981" strokeWidth="1.5" fill="#D1FAE5"/>
            <path d="M6 10l2.5 2.5L14 7" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toggle Mapa de Flujo */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowFlowMap(!showFlowMap)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border-2 transition-colors"
          style={{
            borderColor: 'var(--theme-primary)',
            color: showFlowMap ? 'white' : 'var(--theme-primary)',
            backgroundColor: showFlowMap ? 'var(--theme-primary)' : 'transparent',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3h4v4H2zM12 3h4v4h-4zM7 11h4v4H7z"/>
            <path d="M4 7v2h5V9M14 7v2H9V9"/>
            <path d="M9 11V9"/>
          </svg>
          {showFlowMap ? 'Ocultar' : 'Mostrar'} Mapa de Flujo del Proceso
        </button>
        {showFlowMap && (
          <span className="text-xs text-gray-500">Haz clic en cada paso para ver detalles y navegar al módulo</span>
        )}
      </div>

      {/* Mapa de Flujo del Proceso General */}
      {showFlowMap && onNavigateToModule && (
        <ProcessFlowMap onNavigateToModule={onNavigateToModule} />
      )}

      {/* Grid principal: 2 columnas en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Registros Recientes de Clientes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes de Clientes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Nombre</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha Alta</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Ejecutivo</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesRecientes.map((cliente, idx) => (
                  <tr key={cliente.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900">{cliente.nombre}</td>
                    <td className="px-3 py-2 text-gray-700">{cliente.fechaAlta}</td>
                    <td className="px-3 py-2 text-gray-700">{cliente.tipoCliente}</td>
                    <td className="px-3 py-2 text-gray-700">{cliente.ejecutivo}</td>
                    <td className="px-3 py-2 text-center">
                      <button className="text-[#2E5C91] hover:underline text-xs">Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Solicitudes Pendientes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Solicitudes Pendientes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Prioridad</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha Límite</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesPendientes.map((solicitud, idx) => (
                  <tr key={solicitud.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900">{solicitud.tipo}</td>
                    <td className="px-3 py-2 text-gray-700">{solicitud.cliente}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${getPrioridadColor(solicitud.prioridad)}`}>
                        {solicitud.prioridad}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{solicitud.fechaLimite}</td>
                    <td className="px-3 py-2 text-gray-700">{solicitud.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Créditos Recientes - Ancho completo */}
      <div className="bg-white border border-gray-300 rounded">
        <div className="bg-white border-b border-gray-300 px-4 py-3">
          <h2 className="text-base font-medium text-gray-900">Créditos Recientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-300">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700">Monto</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Producto</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha Desembolso</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Estado</th>
                <th className="text-center px-3 py-2 font-medium text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {creditosRecientes.map((credito, idx) => (
                <tr key={credito.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-900">{credito.cliente}</td>
                  <td className="px-3 py-2 text-right text-gray-900 font-medium">{credito.monto}</td>
                  <td className="px-3 py-2 text-gray-700">{credito.producto}</td>
                  <td className="px-3 py-2 text-gray-700">{credito.fechaDesembolso}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      credito.estado === 'Vigente' ? 'text-green-700 bg-green-50' : 'text-yellow-700 bg-yellow-50'
                    }`}>
                      {credito.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button className="text-[#2E5C91] hover:underline text-xs">Ver detalle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficas KPI - Grid de 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Colocación */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Colocación Mensual</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimos 6 meses (en miles de pesos)</p>
          </div>
          <div className="p-4">
            <ColocacionChart />
          </div>
        </div>

        {/* Cobranza */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Cobranza vs Esperado</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimos 6 meses (en miles de pesos)</p>
          </div>
          <div className="p-4">
            <CobranzaChart />
          </div>
        </div>

        {/* Antigüedad de Saldos */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Antigüedad de Saldos</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución de cartera por días vencidos (%)</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <div className="w-full max-w-sm">
              <AntiguedadChart />
            </div>
          </div>
        </div>

        {/* Cartera por Nivel de Riesgo */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Cartera por Nivel de Riesgo</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación de cartera activa</p>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {carteraPorRiesgoData.map((item) => (
                <div key={item.nivel} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700 font-medium">Nivel {item.nivel}</span>
                    <span className="text-gray-900">${item.monto}K ({item.porcentaje}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full" 
                      style={{ 
                        width: `${item.porcentaje}%`,
                        backgroundColor: item.nivel === 'A' ? '#2E5C91' : 
                                        item.nivel === 'B' ? 'var(--theme-primary)' : 
                                        item.nivel === 'C' ? '#F59E0B' : 
                                        item.nivel === 'D' ? '#EF4444' : '#991B1B'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Propuestas Inteligentes */}
      <div className="bg-white border border-gray-300 rounded">
        <div className="bg-white border-b border-gray-300 px-4 py-3">
          <h2 className="text-base font-medium text-gray-900">Propuestas Inteligentes</h2>
          <p className="text-xs text-gray-600 mt-0.5">Insights y alertas basadas en análisis de datos</p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, idx) => (
              <div 
                key={idx} 
                className="border border-gray-200 rounded p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getInsightIcon(insight.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 mb-1">{insight.titulo}</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">{insight.descripcion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}