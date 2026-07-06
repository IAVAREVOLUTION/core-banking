import { useMemo } from 'react';
import type { CasoUNE } from './uneStore';
import { diasRestantes } from './uneStore';

interface Props { casos: CasoUNE[]; onVerCaso: (id: string) => void; }

const fmt = (n: number) => n.toLocaleString('es-MX');

export function UNEDashboard({ casos, onVerCaso }: Props) {
  const stats = useMemo(() => {
    const abiertos = casos.filter(c => c.estatus !== 'Cerrado');
    const cerrados = casos.filter(c => c.estatus === 'Cerrado');
    const vencidos = abiertos.filter(c => diasRestantes(c.fechaLimite) < 0);
    const porVencer = abiertos.filter(c => { const d = diasRestantes(c.fechaLimite); return d >= 0 && d <= 3; });
    const tiemposProm = cerrados.map(c => {
      if (!c.fechaCierre) return 0;
      const [dr, mr, yr] = c.fechaRecepcion.split('/').map(Number);
      const [dc, mc, yc] = c.fechaCierre.split('/').map(Number);
      return (new Date(yc, mc - 1, dc).getTime() - new Date(yr, mr - 1, dr).getTime()) / 86_400_000;
    });
    const promDias = tiemposProm.length ? Math.round(tiemposProm.reduce((a, b) => a + b, 0) / tiemposProm.length) : 0;

    return {
      total: casos.length,
      abiertos: abiertos.length,
      cerrados: cerrados.length,
      vencidos: vencidos.length,
      porVencer: porVencer.length,
      altaPrioridad: abiertos.filter(c => c.prioridad === 'Alta').length,
      promDias,
      porTipo: {
        Consulta:    casos.filter(c => c.tipo === 'Consulta').length,
        Queja:       casos.filter(c => c.tipo === 'Queja').length,
        Reclamación: casos.filter(c => c.tipo === 'Reclamación').length,
      },
      porEstatus: {
        'Recibido':      casos.filter(c => c.estatus === 'Recibido').length,
        'En revisión':   casos.filter(c => c.estatus === 'En revisión').length,
        'En resolución': casos.filter(c => c.estatus === 'En resolución').length,
        'Cerrado':       casos.filter(c => c.estatus === 'Cerrado').length,
      },
      procedentes: cerrados.filter(c => c.dictamen === 'Procedente').length,
      improcedentes: cerrados.filter(c => c.dictamen === 'Improcedente').length,
    };
  }, [casos]);

  const urgentes = casos
    .filter(c => c.estatus !== 'Cerrado')
    .sort((a, b) => diasRestantes(a.fechaLimite) - diasRestantes(b.fechaLimite))
    .slice(0, 5);

  const kpis = [
    { label: 'Total de casos', valor: stats.total,          color: '#2E5C91', bg: '#EFF6FF' },
    { label: 'Casos abiertos', valor: stats.abiertos,       color: '#0891B2', bg: '#E0F7FA' },
    { label: 'Casos cerrados', valor: stats.cerrados,       color: '#059669', bg: '#ECFDF5' },
    { label: 'Alta prioridad', valor: stats.altaPrioridad,  color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Vencidos',       valor: stats.vencidos,       color: '#B91C1C', bg: '#FEE2E2' },
    { label: 'Días prom. resolución', valor: stats.promDias, color: '#7C3AED', bg: '#F5F3FF', sufijo: 'd' },
  ];

  return (
    <div className="space-y-4">

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white border border-gray-200 px-4 py-3" style={{ borderTopColor: k.color, borderTopWidth: 3 }}>
            <p className="text-[10px] text-gray-500 mb-1 leading-tight">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>
              {fmt(k.valor)}{k.sufijo || ''}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* Por tipo */}
        <div className="bg-white border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-3">Casos por tipo</p>
          {([['Consulta','#0891B2'],['Queja','#D97706'],['Reclamación','#DC2626']] as const).map(([tipo, color]) => {
            const val = stats.porTipo[tipo];
            const pct = stats.total > 0 ? Math.round((val / stats.total) * 100) : 0;
            return (
              <div key={tipo} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700">{tipo}</span>
                  <span className="font-semibold text-gray-800">{val} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full">
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Por estatus */}
        <div className="bg-white border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-3">Distribución por estatus</p>
          {([
            ['Recibido',      '#94A3B8'],
            ['En revisión',   '#F59E0B'],
            ['En resolución', '#3B82F6'],
            ['Cerrado',       '#10B981'],
          ] as const).map(([est, color]) => {
            const val = stats.porEstatus[est];
            const pct = stats.total > 0 ? Math.round((val / stats.total) * 100) : 0;
            return (
              <div key={est} className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }}/>
                <span className="text-xs text-gray-600 flex-1">{est}</span>
                <span className="text-xs font-semibold text-gray-800">{val}</span>
                <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
          <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
            <span>Procedentes: <strong className="text-green-700">{stats.procedentes}</strong></span>
            <span>Improcedentes: <strong className="text-gray-700">{stats.improcedentes}</strong></span>
          </div>
        </div>

        {/* Por vencer */}
        <div className="bg-white border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-3">
            Casos urgentes — por vencimiento
          </p>
          {urgentes.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4 text-center">Sin casos urgentes</p>
          ) : urgentes.map(c => {
            const dias = diasRestantes(c.fechaLimite);
            const color = dias < 0 ? '#DC2626' : dias <= 3 ? '#D97706' : '#2E5C91';
            return (
              <button key={c.id} onClick={() => onVerCaso(c.id)}
                className="w-full text-left flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                <div className="w-8 text-center flex-shrink-0">
                  <span className="text-xs font-bold" style={{ color }}>
                    {dias < 0 ? `+${Math.abs(dias)}d` : `${dias}d`}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-700 truncate">{c.folio}</p>
                  <p className="text-[10px] text-gray-500 truncate">{c.clienteNombre}</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 flex-shrink-0 ${
                  c.tipo === 'Reclamación' ? 'bg-red-50 text-red-700' :
                  c.tipo === 'Queja'       ? 'bg-amber-50 text-amber-700' :
                                             'bg-blue-50 text-blue-700'}`}>
                  {c.tipo}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerta vencidos */}
      {stats.vencidos > 0 && (
        <div className="bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 flex-shrink-0">
            <path d="M8 1L15 14H1L8 1Z" stroke="#DC2626" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M8 6v4M8 12h.01" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="text-xs text-red-800">
            <strong>{stats.vencidos} caso(s) vencido(s)</strong> — superaron el plazo legal CONDUSEF sin resolución.
            Requieren atención inmediata para evitar sanciones regulatorias.
          </p>
        </div>
      )}
    </div>
  );
}
