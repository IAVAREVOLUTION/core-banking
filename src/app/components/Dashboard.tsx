import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { memo, useMemo } from 'react';
import { useClientesDB } from '../hooks/useClientesDB';
import { useSolicitudesDB } from '../hooks/useSolicitudesDB';
import {
  clientesRecientes as calcClientesRecientes,
  solicitudesPendientes as calcSolicitudesPendientes,
  creditosRecientes as calcCreditosRecientes,
  serieColocacion, distribucionPorEstatus, carteraPorProducto, insightsReales,
  diasEnTramite, prioridadPorAntiguedad, fechaCorta, money, montoEje, pct,
} from '../lib/dashboardReal';

/**
 * Home. Todo lo que se muestra sale de la base real (J_CLIENTES y
 * J_CUENTAS_CORP_CLIENTES) via los mismos hooks que usan los modulos; no hay
 * datos de ejemplo. Las derivaciones viven en lib/dashboardReal.ts.
 */

// ─── Graficas aisladas: reciben sus datos ya calculados ─────────────────────

const ColocacionChart = memo(function ColocacionChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis key="x" dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
        <YAxis key="y" tick={{ fontSize: 10 }} stroke="#6B7280" tickFormatter={montoEje} width={70} />
        <Tooltip
          key="tooltip"
          contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
          formatter={(value: any) => [money(value), 'Autorizado']}
        />
        <Bar key="bar" dataKey="monto" fill="#2E5C91" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

const SolicitadoVsAutorizadoChart = memo(function SolicitadoVsAutorizadoChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis key="x" dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
        <YAxis key="y" tick={{ fontSize: 10 }} stroke="#6B7280" tickFormatter={montoEje} width={70} />
        <Tooltip
          key="tooltip"
          contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
          formatter={(value: any) => money(value)}
        />
        <Legend key="legend" wrapperStyle={{ fontSize: '11px' }} />
        <Line key="sol" type="monotone" dataKey="solicitado" stroke="#9CA3AF" strokeWidth={2} name="Solicitado" strokeDasharray="5 5" />
        <Line key="aut" type="monotone" dataKey="monto" stroke="#2E5C91" strokeWidth={2} name="Autorizado" />
      </LineChart>
    </ResponsiveContainer>
  );
});

const EstatusChart = memo(function EstatusChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data} cx="50%" cy="50%" labelLine={false}
          label={({ categoria, valor }: any) => `${categoria}: ${valor}%`}
          outerRadius={80} fill="#8884d8" dataKey="valor" nameKey="categoria"
        >
          {data.map((entry: any) => (<Cell key={`cell-${entry.categoria}`} fill={entry.color} />))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
          formatter={(value: any, _n: any, p: any) => [`${p?.payload?.cantidad ?? 0} solicitud(es) — ${value}%`, p?.payload?.categoria]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});

const VACIO = (
  <tr><td colSpan={9} className="px-3 py-6 text-center text-xs text-gray-500">Sin registros</td></tr>
);

export function Dashboard({ onNavigateToModule, modulos }: {
  onNavigateToModule?: (moduleId: string) => void;
  /**
   * REQ-25 — accesos del Home. Llegan YA FILTRADOS por el perfil de la sesion,
   * asi que el Home nunca ofrece un modulo que el usuario no puede abrir.
   */
  modulos?: { id: string; label: string }[];
}) {
  const { clientes, loading: cargandoClientes } = useClientesDB(true);
  const { solicitudes, loading: cargandoSols } = useSolicitudesDB(true);

  const ultimosClientes = useMemo(() => calcClientesRecientes(clientes as any), [clientes]);
  const pendientes      = useMemo(() => calcSolicitudesPendientes(solicitudes as any), [solicitudes]);
  const colocados       = useMemo(() => calcCreditosRecientes(solicitudes as any), [solicitudes]);
  const colocacion      = useMemo(() => serieColocacion(solicitudes as any), [solicitudes]);
  const porEstatus      = useMemo(() => distribucionPorEstatus(solicitudes as any), [solicitudes]);
  const porProducto     = useMemo(() => carteraPorProducto(solicitudes as any), [solicitudes]);
  const insights        = useMemo(() => insightsReales(solicitudes as any, clientes as any), [solicitudes, clientes]);

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

  const Cargando = ({ n }: { n: number }) => (
    <tr><td colSpan={n} className="px-3 py-6 text-center text-xs text-gray-500">Cargando...</td></tr>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Accesos a los modulos visibles de la sesion */}
      {onNavigateToModule && (modulos?.length ?? 0) > 0 && (
        <div className="mb-6">
          <div className="bg-primary-light-theme border-l-4 border-primary-theme px-3 py-2 mb-3">
            <span className="text-sm font-medium text-gray-800">ACCESOS</span>
            <span className="text-[11px] text-gray-500 ml-2">{modulos!.length} módulo(s) disponibles</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {modulos!.map(m => (
              <button
                key={m.id}
                onClick={() => onNavigateToModule(m.id)}
                className="group flex items-center gap-2.5 px-3 py-3 bg-white border border-gray-200 rounded-lg text-left hover:border-primary-theme hover:shadow-md transition-all"
              >
                <span className="shrink-0 w-8 h-8 rounded-lg bg-primary-light-theme flex items-center justify-center text-primary-theme group-hover:bg-primary-theme group-hover:text-white transition-colors">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </span>
                <span className="text-xs font-medium text-gray-700 leading-tight">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid principal: 2 columnas en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Registros Recientes de Clientes — reales */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3 flex items-baseline justify-between">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes de Clientes</h2>
            <span className="text-[11px] text-gray-500">{clientes.length} en total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Nombre</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha Alta</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Sucursal</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {cargandoClientes && ultimosClientes.length === 0 ? <Cargando n={5} />
                  : ultimosClientes.length === 0 ? VACIO
                  : ultimosClientes.map((c: any, idx: number) => (
                  <tr key={c.dbUuid || c.idCliente || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900">{c.nombreCompleto || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{fechaCorta(c.fechaOriginacion || c.fechaAlta)}</td>
                    <td className="px-3 py-2 text-gray-700">{c.subtipo || c.tipo || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{c.sucursal || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{c.estatus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Solicitudes en tramite — reales */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3 flex items-baseline justify-between">
            <div>
              <h2 className="text-base font-medium text-gray-900">Solicitudes en Trámite</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">La prioridad se calcula por antigüedad, no es un dato capturado</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Producto</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Prioridad</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {cargandoSols && pendientes.length === 0 ? <Cargando n={5} />
                  : pendientes.length === 0 ? VACIO
                  : pendientes.map((s: any, idx: number) => {
                  const dias = diasEnTramite(s);
                  const prio = prioridadPorAntiguedad(dias);
                  return (
                    <tr key={s.id || s.noSol || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-gray-900">{s.tipoProducto || s.nombreProducto || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{s.nombreCompleto || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${getPrioridadColor(prio)}`} title={dias != null ? `${dias} día(s) en trámite` : ''}>
                          {prio}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{fechaCorta(s.fechaSolicitud)}</td>
                      <td className="px-3 py-2 text-gray-700">{s.estatusSolicitud || s.faseDescripcion || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Creditos colocados — reales */}
      <div className="bg-white border border-gray-300 rounded">
        <div className="bg-white border-b border-gray-300 px-4 py-3">
          <h2 className="text-base font-medium text-gray-900">Créditos Colocados Recientes</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Solicitudes con monto autorizado</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-300">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700">Monto Autorizado</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Producto</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Folio</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {cargandoSols && colocados.length === 0 ? <Cargando n={6} />
                : colocados.length === 0 ? VACIO
                : colocados.map((c: any, idx: number) => (
                <tr key={c.id || c.noSol || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-900">{c.nombreCompleto || '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-900 font-medium">{money(c.montoAutorizado)}</td>
                  <td className="px-3 py-2 text-gray-700">{c.tipoProducto || c.nombreProducto || '—'}</td>
                  <td className="px-3 py-2 text-gray-600 font-mono text-[11px]">{c.noSol || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{fechaCorta(c.fechaSolicitud)}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-xs text-green-700 bg-green-50">{c.estatusSolicitud || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Graficas KPI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Colocación Mensual</h2>
            <p className="text-xs text-gray-600 mt-0.5">Monto autorizado, últimos 6 meses</p>
          </div>
          <div className="p-4"><ColocacionChart data={colocacion} /></div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Solicitado vs Autorizado</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimos 6 meses. La cobranza real requiere el módulo de pagos</p>
          </div>
          <div className="p-4"><SolicitadoVsAutorizadoChart data={colocacion} /></div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Solicitudes por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución de las {solicitudes.length} solicitudes registradas</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <div className="w-full max-w-sm">
              {porEstatus.length === 0
                ? <p className="text-xs text-gray-500 text-center py-12">Sin solicitudes registradas</p>
                : <EstatusChart data={porEstatus} />}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Cartera por Tipo de Producto</h2>
            <p className="text-xs text-gray-600 mt-0.5">Monto autorizado colocado, por línea de producto</p>
          </div>
          <div className="p-4">
            {porProducto.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-12">Sin cartera colocada</p>
            ) : (
              <div className="space-y-3">
                {porProducto.map((item: any, i: number) => (
                  <div key={item.nivel} className="space-y-1">
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-gray-700 font-medium truncate">{item.nivel}</span>
                      <span className="text-gray-900 whitespace-nowrap">{montoEje(item.monto)} ({pct(item.porcentaje, item.monto)})</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(item.porcentaje, item.monto > 0 ? 1 : 0)}%`,
                          backgroundColor: ['#2E5C91', 'var(--theme-primary)', '#10B981', '#F59E0B', '#EF4444'][i % 5],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Senales calculadas sobre los datos reales */}
      <div className="bg-white border border-gray-300 rounded">
        <div className="bg-white border-b border-gray-300 px-4 py-3">
          <h2 className="text-base font-medium text-gray-900">Propuestas Inteligentes</h2>
          <p className="text-xs text-gray-600 mt-0.5">Señales calculadas sobre los registros de la base</p>
        </div>
        <div className="p-4">
          {insights.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">
              Aún no hay suficientes registros para calcular señales.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.map((insight, idx) => (
                <div key={idx} className="border border-gray-200 rounded p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{getInsightIcon(insight.tipo)}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 mb-1">{insight.titulo}</h3>
                      <p className="text-xs text-gray-600 leading-relaxed">{insight.descripcion}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
