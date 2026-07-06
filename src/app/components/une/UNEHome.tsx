import { useState } from 'react';
import { UNEDashboard } from './UNEDashboard';
import { UNECasos } from './UNECasos';
import { UNEDetalleCaso } from './UNEDetalleCaso';
import { UNEReportes } from './UNEReportes';
import { getCasos, saveCasos, type CasoUNE } from './uneStore';

type TabId = 'dashboard' | 'casos' | 'reportes';

const TABS: { id: TabId; label: string; icon: string }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  },
  {
    id: 'casos',
    label: 'Casos',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    id: 'reportes',
    label: 'Reportes CONDUSEF',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
];

// Inicializar sessionStorage con datos demo si está vacío
(() => {
  try {
    if (!sessionStorage.getItem('une_casos_v1')) {
      const { CASOS_DEMO } = require('./uneStore');
      sessionStorage.setItem('une_casos_v1', JSON.stringify(CASOS_DEMO));
    }
  } catch { /* silencioso */ }
})();

export function UNEHome() {
  const [tabActivo,  setTabActivo]  = useState<TabId>('dashboard');
  const [casos,      setCasos]      = useState<CasoUNE[]>(getCasos);
  const [casoAbierto,setCasoAbierto]= useState<string | null>(null);

  const handleSaveCasos = (nuevosCasos: CasoUNE[]) => {
    setCasos(nuevosCasos);
    saveCasos(nuevosCasos);
  };

  const handleUpdateCaso = (casoActualizado: CasoUNE) => {
    const nuevos = casos.map(c => c.id === casoActualizado.id ? casoActualizado : c);
    handleSaveCasos(nuevos);
  };

  const handleVerCaso = (id: string) => {
    setCasoAbierto(id);
    setTabActivo('casos');
  };

  const casoDetalle = casoAbierto ? casos.find(c => c.id === casoAbierto) : null;

  const abiertos = casos.filter(c => c.estatus !== 'Cerrado').length;

  return (
    <div className="bg-white min-h-screen">

      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300 flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#666" strokeWidth="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <div>
          <h2 className="text-base text-gray-800 font-medium leading-tight">Unidad Especializada (UNE)</h2>
          <p className="text-[10px] text-gray-500">Consultas, Quejas y Reclamaciones — CONDUSEF</p>
        </div>
        {abiertos > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"/>
            <span className="text-[10px] text-amber-700 font-medium">{abiertos} casos abiertos</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-stretch bg-[#2E5C91]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTabActivo(t.id); if (t.id !== 'casos') setCasoAbierto(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs border-r border-white/20 last:border-0 transition-colors ${
              tabActivo === t.id ? 'bg-[#1d3f6b] text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d={t.icon}/>
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="px-5 py-5 bg-[#F5F5F5] min-h-[calc(100vh-110px)]">

        {tabActivo === 'dashboard' && (
          <UNEDashboard casos={casos} onVerCaso={handleVerCaso} />
        )}

        {tabActivo === 'casos' && (
          casoDetalle ? (
            <UNEDetalleCaso
              caso={casoDetalle}
              onBack={() => setCasoAbierto(null)}
              onUpdate={handleUpdateCaso}
            />
          ) : (
            <UNECasos
              casos={casos}
              onSave={handleSaveCasos}
              onVerCaso={handleVerCaso}
            />
          )
        )}

        {tabActivo === 'reportes' && (
          <UNEReportes casos={casos} />
        )}
      </div>
    </div>
  );
}
