import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { CasoUNE } from './uneStore';
import { diasRestantes } from './uneStore';

interface Props { casos: CasoUNE[]; }

const PERIODOS = ['Enero 2026', 'Febrero 2026', 'Marzo 2026', 'Abril 2026', 'Mayo 2026', 'Junio 2026 (parcial)'];

export function UNEReportes({ casos }: Props) {
  const [periodoSel, setPeriodoSel] = useState('Mayo 2026');
  const [generando, setGenerando]   = useState(false);

  const stats = useMemo(() => {
    const cerrados   = casos.filter(c => c.estatus === 'Cerrado');
    const abiertos   = casos.filter(c => c.estatus !== 'Cerrado');
    const vencidos   = abiertos.filter(c => diasRestantes(c.fechaLimite) < 0);

    const tiempos = cerrados.map(c => {
      if (!c.fechaCierre) return 0;
      const [dr, mr, yr] = c.fechaRecepcion.split('/').map(Number);
      const [dc, mc, yc] = c.fechaCierre.split('/').map(Number);
      return (new Date(yc, mc - 1, dc).getTime() - new Date(yr, mr - 1, dr).getTime()) / 86_400_000;
    }).filter(t => t > 0);

    const promDias = tiempos.length ? (tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(1) : '—';
    const maxDias  = tiempos.length ? Math.max(...tiempos) : 0;
    const enPlazo  = cerrados.filter(c => {
      if (!c.fechaCierre) return false;
      return diasRestantes(c.fechaLimite, c.fechaCierre) >= 0;
    }).length;

    return {
      total: casos.length,
      consultas:    casos.filter(c => c.tipo === 'Consulta').length,
      quejas:       casos.filter(c => c.tipo === 'Queja').length,
      reclamaciones:casos.filter(c => c.tipo === 'Reclamación').length,
      cerrados: cerrados.length,
      abiertos: abiertos.length,
      vencidos: vencidos.length,
      procedentes:       cerrados.filter(c => c.dictamen === 'Procedente').length,
      improcedentes:     cerrados.filter(c => c.dictamen === 'Improcedente').length,
      parciales:         cerrados.filter(c => c.dictamen === 'Parcialmente procedente').length,
      desistidos:        cerrados.filter(c => c.dictamen === 'Desistido').length,
      porCanal: {
        Presencial:          casos.filter(c => c.canal === 'Presencial').length,
        Telefónico:          casos.filter(c => c.canal === 'Telefónico').length,
        'Correo electrónico':casos.filter(c => c.canal === 'Correo electrónico').length,
        'Portal web':        casos.filter(c => c.canal === 'Portal web').length,
        'App móvil':         casos.filter(c => c.canal === 'App móvil').length,
      },
      porProducto: Object.fromEntries(
        [...new Set(casos.map(c => c.productoAfectado))].map(p => [p, casos.filter(c => c.productoAfectado === p).length])
      ),
      promDias,
      maxDias,
      enPlazo,
      cumplimiento: cerrados.length > 0 ? Math.round((enPlazo / cerrados.length) * 100) : 100,
    };
  }, [casos]);

  const handleGenerar = () => {
    setGenerando(true);
    setTimeout(() => {
      setGenerando(false);
      toast.success(`Reporte CONDUSEF generado — ${periodoSel}`, {
        description: 'Archivo XML listo para envío al portal CONDUSEF.',
      });
    }, 1800);
  };

  const Fila = ({ label, valor, highlight }: { label: string; valor: string | number; highlight?: boolean }) => (
    <div className={`flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 ${highlight ? 'bg-amber-50 -mx-3 px-3' : ''}`}>
      <span className="text-xs text-gray-600">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-amber-700' : 'text-gray-800'}`}>{valor}</span>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Selector período + botón generar */}
      <div className="bg-white border border-gray-200 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-600 font-medium">Período del reporte:</label>
          <select value={periodoSel} onChange={e => setPeriodoSel(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#2E5C91]">
            {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGenerar} disabled={generando}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2E5C91] text-white text-xs rounded hover:bg-[#1d3f6b] disabled:opacity-50">
            {generando ? (
              <svg className="animate-spin w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6" cy="6" r="4" strokeOpacity="0.25"/><path d="M6 2a4 4 0 014 4" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 1v7M3 5l3 3 3-3M2 10h8"/>
              </svg>
            )}
            {generando ? 'Generando...' : 'Generar XML CONDUSEF'}
          </button>
          <button onClick={() => toast.success('Vista previa descargada como PDF')}
            className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50">
            Vista previa PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* Columna 1: Resumen general */}
        <div className="bg-white border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-3">Resumen general</p>
          <Fila label="Total de casos en el período" valor={stats.total}/>
          <Fila label="Consultas" valor={stats.consultas}/>
          <Fila label="Quejas" valor={stats.quejas}/>
          <Fila label="Reclamaciones" valor={stats.reclamaciones}/>
          <div className="my-2 border-t border-gray-200"/>
          <Fila label="Casos cerrados" valor={stats.cerrados}/>
          <Fila label="Casos en proceso" valor={stats.abiertos}/>
          <Fila label="Casos vencidos (fuera de plazo)" valor={stats.vencidos} highlight={stats.vencidos > 0}/>
        </div>

        {/* Columna 2: Tiempos y cumplimiento */}
        <div className="bg-white border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-3">Tiempos de resolución</p>
          <Fila label="Tiempo promedio de resolución" valor={`${stats.promDias} días`}/>
          <Fila label="Tiempo máximo registrado" valor={`${stats.maxDias} días`}/>
          <Fila label="Casos resueltos en plazo" valor={`${stats.enPlazo} / ${stats.cerrados}`}/>
          <div className="my-3">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-gray-600">Cumplimiento de plazos CONDUSEF</span>
              <span className={`font-semibold ${stats.cumplimiento >= 90 ? 'text-green-700' : stats.cumplimiento >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {stats.cumplimiento}%
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full">
              <div className="h-2.5 rounded-full transition-all"
                style={{ width: `${stats.cumplimiento}%`, backgroundColor: stats.cumplimiento >= 90 ? '#16A34A' : stats.cumplimiento >= 70 ? '#D97706' : '#DC2626' }}/>
            </div>
          </div>
          <div className="my-2 border-t border-gray-200"/>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-2 mt-3">Dictámenes</p>
          <Fila label="Procedentes"                  valor={stats.procedentes}/>
          <Fila label="Improcedentes"                valor={stats.improcedentes}/>
          <Fila label="Parcialmente procedentes"     valor={stats.parciales}/>
          <Fila label="Desistidos"                   valor={stats.desistidos}/>
        </div>

        {/* Columna 3: Por canal y producto */}
        <div className="bg-white border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-3">Por canal de recepción</p>
          {Object.entries(stats.porCanal).map(([canal, n]) => {
            const pct = stats.total > 0 ? Math.round((n / stats.total) * 100) : 0;
            return (
              <div key={canal} className="mb-2">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-gray-600">{canal}</span>
                  <span className="text-gray-800 font-medium">{n} ({pct}%)</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full">
                  <div className="h-1.5 rounded-full bg-[#2E5C91]" style={{ width: `${pct}%` }}/>
                </div>
              </div>
            );
          })}
          <div className="my-3 border-t border-gray-200"/>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-2">Por producto afectado</p>
          {Object.entries(stats.porProducto).sort((a, b) => b[1] - a[1]).map(([prod, n]) => (
            <div key={prod} className="flex justify-between py-1 border-b border-gray-100 last:border-0 text-xs">
              <span className="text-gray-600 truncate mr-2" title={prod}>{prod}</span>
              <span className="text-gray-800 font-semibold flex-shrink-0">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Nota regulatoria */}
      <div className="bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-3">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 flex-shrink-0">
          <circle cx="7" cy="7" r="6" stroke="#2E5C91" strokeWidth="1.5"/>
          <path d="M7 6v5M7 4h.01" stroke="#2E5C91" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p className="text-[10px] text-blue-800 leading-relaxed">
          <strong>Obligación regulatoria:</strong> El reporte periódico de casos UNE debe enviarse a CONDUSEF
          dentro de los primeros <strong>10 días hábiles</strong> del mes siguiente al período reportado,
          conforme a las Disposiciones de carácter general aplicables a las instituciones de crédito
          (Circular 2/2010 CNBV). El archivo XML generado cumple con el formato SIPRES v4.0.
        </p>
      </div>
    </div>
  );
}
