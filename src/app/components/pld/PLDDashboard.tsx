import { usePLDDashboard } from './usePLDData';

export function PLDDashboard() {
  const { stats, loading } = usePLDDashboard();

  const s = stats ?? {
    alertasActivas: 0, alertasRelevantes: 0, alertasInusuales: 0, alertasPreoc: 0,
    internasTotal: 0, internasPendientes: 0, reportesPendientes: 0,
    calTotal: 0, calBajo: 0, calMedio: 0, calAlto: 0, recentAlertas: [],
  };

  const totalRisk = Math.max(s.calTotal, 1);

  const tipeCls = (t: string) =>
    t === 'Relevante' ? 'bg-red-50 text-red-700 border border-red-200' :
    t === 'Inusual'   ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                        'bg-orange-50 text-orange-700 border border-orange-200';

  const statCls = (e: string) =>
    e === 'Atendida'   ? 'bg-green-50 text-green-700 border border-green-200' :
    e === 'En Análisis'? 'bg-blue-50 text-blue-700 border border-blue-200' :
    e === 'Enviada'    ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                         'bg-gray-100 text-gray-600 border border-gray-300';

  return (
    <div className="bg-white min-h-full">

      {/* KPI bar */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
            <svg className="animate-spin h-4 w-4 text-[#4A6FA5]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/></svg>
            Cargando datos PLD...
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Alertas Activas',      value: s.alertasActivas,      sub: 'Requieren atención',                          color: '#D32F2F' },
              { label: 'Clientes Calificados', value: s.calTotal,            sub: `${s.calAlto} riesgo alto`,                    color: '#0066CC' },
              { label: 'Alertas Internas',     value: s.internasTotal,       sub: `${s.internasPendientes} pendientes`,           color: '#5C3D9B' },
              { label: 'Reportes CNBV Pend.',  value: s.reportesPendientes,  sub: 'Por enviar',                                  color: '#0E7B1F' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-300 px-3 py-2.5">
                <div className="text-xs text-gray-600 mb-1">{k.label}</div>
                <div className="text-2xl" style={{ fontWeight: 700, color: k.color }}>{k.value}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-5 gap-4">

          {/* Alertas recientes — col 1-3 */}
          <div className="col-span-3 border border-gray-300">
            <div style={{ backgroundColor: '#D0D0D0' }} className="px-3 py-2 border-b border-gray-300">
              <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>Alertas PLD Recientes</span>
            </div>
            {loading ? (
              <div className="px-3 py-8 text-center text-gray-500 text-xs">Cargando alertas...</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                    <th className="px-3 py-2 text-left text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>No. Alerta</th>
                    <th className="px-3 py-2 text-left text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>Cliente</th>
                    <th className="px-3 py-2 text-left text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>Tipo</th>
                    <th className="px-3 py-2 text-left text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>Monto</th>
                    <th className="px-3 py-2 text-left text-[10px] text-gray-700" style={{ fontWeight: 600 }}>Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentAlertas.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">Sin alertas registradas</td></tr>
                  ) : s.recentAlertas.map((a, idx) => (
                    <tr key={a.id} className="border-b border-gray-200"
                      style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}>
                      <td className="px-3 py-2 text-[#0066CC] border-r border-gray-200" style={{ fontWeight: 500 }}>{a.noAlerta}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate border-r border-gray-200">{a.cliente}</td>
                      <td className="px-3 py-2 border-r border-gray-200">
                        <span className={`inline-block px-1.5 py-0.5 text-[9px] ${tipeCls(a.tipoAlerta)}`} style={{ fontWeight: 500 }}>{a.tipoAlerta}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] border-r border-gray-200">{a.monto}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 text-[9px] ${statCls(a.estatus)}`}>{a.estatus}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Distribución de riesgo — col 4-5 */}
          <div className="col-span-2 border border-gray-300">
            <div style={{ backgroundColor: '#D0D0D0' }} className="px-3 py-2 border-b border-gray-300">
              <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>Distribución de Riesgo</span>
            </div>
            <div className="px-4 py-4 space-y-4">
              {[
                { label: 'Riesgo Bajo',  value: s.calBajo,  color: '#0E7B1F', range: '0–39 pts' },
                { label: 'Riesgo Medio', value: s.calMedio, color: '#B45309', range: '40–69 pts' },
                { label: 'Riesgo Alto',  value: s.calAlto,  color: '#D32F2F', range: '70–100 pts' },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700">{r.label} <span className="text-[10px] text-gray-400">({r.range})</span></span>
                    <span className="text-xs" style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                  </div>
                  <div className="w-full bg-gray-200 h-4 rounded-sm overflow-hidden">
                    <div className="h-4 flex items-center justify-end pr-1.5 transition-all"
                      style={{ width: `${(r.value / totalRisk) * 100}%`, backgroundColor: r.color }}>
                      {r.value > 0 && <span className="text-[8px] text-white" style={{ fontWeight: 700 }}>{((r.value / totalRisk) * 100).toFixed(0)}%</span>}
                    </div>
                  </div>
                </div>
              ))}
              {!loading && s.calTotal === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">Sin calificaciones registradas</p>
              )}
            </div>

            {/* Mini stats */}
            <div className="border-t border-gray-300 grid grid-cols-2">
              {[
                { label: 'Relevantes',   value: s.alertasRelevantes, color: '#D32F2F' },
                { label: 'Inusuales',    value: s.alertasInusuales,  color: '#B45309' },
                { label: 'Preocupantes', value: s.alertasPreoc,      color: '#C2610C' },
                { label: 'Internas',     value: s.internasTotal,     color: '#5C3D9B' },
              ].map((s2, i) => (
                <div key={s2.label} className={`px-3 py-2 ${i % 2 === 0 ? 'border-r border-gray-300' : ''} ${i < 2 ? 'border-b border-gray-300' : ''}`}>
                  <div className="text-[10px] text-gray-500">{s2.label}</div>
                  <div className="text-lg" style={{ fontWeight: 700, color: s2.color }}>{s2.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
