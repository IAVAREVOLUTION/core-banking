import * as store from './pldStore';

export function PLDDashboard() {
  const alertas = store.getAlertas();
  const alertasInternas = store.getAlertasInternas();

  const kpiData = {
    alertasActivas: alertas.filter(a => a.estatus !== 'Atendida').length,
    alertasRelevantes: alertas.filter(a => a.tipoAlerta === 'Relevante').length,
    alertasInusuales: alertas.filter(a => a.tipoAlerta === 'Inusual').length,
    clientesAltoRiesgo: 12,
    operacionesSospechosas: alertas.filter(a => a.tipoAlerta === 'Preocupante').length,
    reportesPendientes: store.getReportes().filter(r => r.estatus === 'Pendiente').length,
    clientesRevisados: 156,
  };

  const distribucionRiesgo = { bajo: 89, medio: 45, alto: 12, critico: 10 };

  return (
    <div className="bg-[#F5F5F5] min-h-full p-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-300 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Alertas Activas</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#DC2626" strokeWidth="1.5"><path d="M10 3L2 17h16L10 3zM10 8v4M10 14h.01"/></svg>
          </div>
          <div className="text-2xl text-gray-800" style={{ fontWeight: 600 }}>{kpiData.alertasActivas}</div>
          <div className="text-[10px] text-red-600 mt-1">Requieren atención inmediata</div>
        </div>
        <div className="bg-white border border-gray-300 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Clientes Alto Riesgo</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#EA580C" strokeWidth="1.5"><path d="M10 2l2 4 4 .5-3 3 .5 4-3.5-2-3.5 2 .5-4-3-3 4-.5z"/></svg>
          </div>
          <div className="text-2xl text-gray-800" style={{ fontWeight: 600 }}>{kpiData.clientesAltoRiesgo}</div>
          <div className="text-[10px] text-gray-600 mt-1">Calificación &ge; 70 puntos</div>
        </div>
        <div className="bg-white border border-gray-300 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Operaciones Sospechosas</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#7C3AED" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M10 7v3M10 13h.01"/></svg>
          </div>
          <div className="text-2xl text-gray-800" style={{ fontWeight: 600 }}>{kpiData.operacionesSospechosas}</div>
          <div className="text-[10px] text-gray-600 mt-1">Detectadas en 30 días</div>
        </div>
        <div className="bg-white border border-gray-300 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Reportes Pendientes CNBV</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#2563EB" strokeWidth="1.5"><rect x="3" y="4" width="14" height="12" rx="1"/><path d="M7 4V2M13 4V2M3 8h14"/></svg>
          </div>
          <div className="text-2xl text-gray-800" style={{ fontWeight: 600 }}>{kpiData.reportesPendientes}</div>
          <div className="text-[10px] text-gray-600 mt-1">Por enviar este mes</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Alertas Recientes */}
        <div className="bg-white border border-gray-300">
          <div className="bg-[#D9E2F3] px-4 py-2 border-l-4 border-[#4A6FA5]">
            <h3 className="text-xs text-[#4A6FA5]" style={{ fontWeight: 700 }}>Alertas PLD Recientes</h3>
          </div>
          <div className="p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D0D0D0]">
                  <th className="px-2 py-1.5 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>No. Alerta</th>
                  <th className="px-2 py-1.5 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Cliente</th>
                  <th className="px-2 py-1.5 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Tipo</th>
                  <th className="px-2 py-1.5 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Monto</th>
                  <th className="px-2 py-1.5 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Fecha</th>
                  <th className="px-2 py-1.5 text-left text-[10px]" style={{ fontWeight: 600 }}>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {alertas.slice(0, 6).map((a, i) => (
                  <tr key={a.id} style={{ backgroundColor: i % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}>
                    <td className="px-2 py-1.5 text-[10px] text-[#0066CC] border-r border-gray-200">{a.noAlerta}</td>
                    <td className="px-2 py-1.5 text-[10px] border-r border-gray-200 max-w-[120px] truncate">{a.cliente}</td>
                    <td className="px-2 py-1.5 text-[10px] border-r border-gray-200">
                      <span className={a.tipoAlerta === 'Relevante' ? 'text-red-700' : a.tipoAlerta === 'Inusual' ? 'text-yellow-700' : 'text-orange-700'} style={{ fontWeight: 600 }}>{a.tipoAlerta}</span>
                    </td>
                    <td className="px-2 py-1.5 text-[10px] border-r border-gray-200">{a.monto}</td>
                    <td className="px-2 py-1.5 text-[10px] border-r border-gray-200">{a.fechaCreacion}</td>
                    <td className="px-2 py-1.5 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                        a.estatus === 'En Análisis' ? 'bg-blue-100 text-blue-700' :
                        a.estatus === 'Pendiente' ? 'bg-yellow-100 text-yellow-700' :
                        a.estatus === 'Atendida' ? 'bg-green-100 text-green-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>{a.estatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribución por Nivel de Riesgo */}
        <div className="bg-white border border-gray-300">
          <div className="bg-[#D9E2F3] px-4 py-2 border-l-4 border-[#4A6FA5]">
            <h3 className="text-xs text-[#4A6FA5]" style={{ fontWeight: 700 }}>Distribución de Clientes por Riesgo</h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {[
                { label: 'Riesgo Bajo (0-39)', value: distribucionRiesgo.bajo, color: 'bg-green-500', textColor: 'text-green-700' },
                { label: 'Riesgo Medio (40-69)', value: distribucionRiesgo.medio, color: 'bg-yellow-500', textColor: 'text-yellow-700' },
                { label: 'Riesgo Alto (70-89)', value: distribucionRiesgo.alto, color: 'bg-orange-500', textColor: 'text-orange-700' },
                { label: 'Riesgo Crítico (90-100)', value: distribucionRiesgo.critico, color: 'bg-red-500', textColor: 'text-red-700' },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700">{r.label}</span>
                    <span className={`text-xs ${r.textColor}`} style={{ fontWeight: 600 }}>{r.value}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-5">
                    <div className={`${r.color} h-5 rounded flex items-center justify-end pr-2`} style={{ width: `${(r.value / kpiData.clientesRevisados) * 100}%` }}>
                      <span className="text-[9px] text-white" style={{ fontWeight: 600 }}>{((r.value / kpiData.clientesRevisados) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-300 flex justify-between text-xs text-gray-700">
              <span>Total Clientes: <strong>{kpiData.clientesRevisados}</strong></span>
              <span>Alertas Internas: <strong>{alertasInternas.length}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas adicionales */}
      <div className="grid grid-cols-4 gap-4 mt-4">
        <div className="bg-white border border-gray-300 p-3">
          <div className="text-xs text-gray-600 mb-1">Alertas Relevantes</div>
          <div className="text-xl text-gray-800" style={{ fontWeight: 600 }}>{kpiData.alertasRelevantes}</div>
          <div className="text-[10px] text-gray-500 mt-1">&ge; $10,000 USD o criterios CNBV</div>
        </div>
        <div className="bg-white border border-gray-300 p-3">
          <div className="text-xs text-gray-600 mb-1">Alertas Inusuales</div>
          <div className="text-xl text-gray-800" style={{ fontWeight: 600 }}>{kpiData.alertasInusuales}</div>
          <div className="text-[10px] text-gray-500 mt-1">Fuera de perfil transaccional</div>
        </div>
        <div className="bg-white border border-gray-300 p-3">
          <div className="text-xs text-gray-600 mb-1">Clientes PEP Detectados</div>
          <div className="text-xl text-gray-800" style={{ fontWeight: 600 }}>8</div>
          <div className="text-[10px] text-gray-500 mt-1">Personas políticamente expuestas</div>
        </div>
        <div className="bg-white border border-gray-300 p-3">
          <div className="text-xs text-gray-600 mb-1">Listas Negras</div>
          <div className="text-xl text-gray-800" style={{ fontWeight: 600 }}>3</div>
          <div className="text-[10px] text-gray-500 mt-1">Coincidencias en listas restrictivas</div>
        </div>
      </div>
    </div>
  );
}
