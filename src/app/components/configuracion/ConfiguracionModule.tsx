import React, { useState } from 'react';
import { Settings, Building2, MapPin, Briefcase, UserCheck, Landmark, Store, Wrench, BookOpen, ChevronRight } from 'lucide-react';
import { SucursalesSection } from './SucursalesSection';
import { InstitucionesFinancierasSection } from './InstitucionesFinancierasSection';
import { PuestosTrabajoSection } from './PuestosTrabajoSection';
import { EmpleadosSection } from './EmpleadosSection';
import { ParametrosGeneralesSection } from './ParametrosGeneralesSection';
import { ParametrosInstitucionSection } from './ParametrosInstitucionSection';
import { ParametrosSucursalesSection } from './ParametrosSucursalesSection';
import { MantenimientoSection } from './MantenimientoSection';
import { CatalogoDocumentosSection } from './CatalogoDocumentosSection';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
type ConfigTab =
  | 'parametros-generales'
  | 'parametros-institucion'
  | 'parametros-sucursales'
  | 'instituciones-financieras'
  | 'sucursales'
  | 'puestos-trabajo'
  | 'empleados'
  | 'mantenimiento'
  | 'catalogo-documentos';

interface TabDef {
  id: ConfigTab;
  label: string;
  icon?: React.ReactNode;
}

interface TabGroup {
  groupLabel: string;
  tabs: TabDef[];
}

// ═══════════════════════════════════════════════════════════════════
// TAB DEFINITIONS — agrupados por categoría
// ═══════════════════════════════════════════════════════════════════
const CONFIG_TAB_GROUPS: TabGroup[] = [
  {
    groupLabel: 'Parámetros',
    tabs: [
      { id: 'parametros-generales', label: 'Generales', icon: <Settings size={14} /> },
      { id: 'parametros-institucion', label: 'Institución', icon: <Building2 size={14} /> },
      { id: 'parametros-sucursales', label: 'Sucursales', icon: <MapPin size={14} /> },
    ],
  },
  {
    groupLabel: 'Estructura Organizacional',
    tabs: [
      { id: 'instituciones-financieras', label: 'Inst. Financieras', icon: <Landmark size={14} /> },
      { id: 'sucursales', label: 'Sucursales', icon: <Store size={14} /> },
      { id: 'puestos-trabajo', label: 'Puestos', icon: <Briefcase size={14} /> },
      { id: 'empleados', label: 'Empleados', icon: <UserCheck size={14} /> },
    ],
  },
  {
    groupLabel: 'Sistema',
    tabs: [
      { id: 'mantenimiento', label: 'Mantenimiento BD', icon: <Wrench size={14} /> },
      { id: 'catalogo-documentos', label: 'Catálogos', icon: <BookOpen size={14} /> },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function ConfiguracionModule() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('parametros-generales');

  return (
    <>
      {/* Subnavegación interna del módulo Configuración */}
      <div className="bg-[#F3F4F6] border-b-2 border-gray-300">
        <div className="px-5 py-2.5 flex items-center gap-5 overflow-x-auto">
          {CONFIG_TAB_GROUPS.map((group, gIdx) => (
            <React.Fragment key={group.groupLabel}>
              {gIdx > 0 && (
                <div className="h-8 w-px bg-gray-300 flex-shrink-0" />
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1.5 select-none">
                  {group.groupLabel}
                </span>
                {group.tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-sm transition-all duration-150 border ${
                        isActive
                          ? 'bg-[#2E5C91] text-white border-[#2E5C91] shadow-sm'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-[#E8EDF3] hover:text-[#2E5C91] hover:border-[#2E5C91]/40'
                      }`}
                    >
                      <span className={isActive ? 'text-white/80' : 'text-gray-400'}>{tab.icon}</span>
                      <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Contenido del submódulo activo */}
      {activeTab === 'parametros-generales' && <ParametrosGeneralesSection />}
      {activeTab === 'parametros-institucion' && <ParametrosInstitucionSection />}
      {activeTab === 'parametros-sucursales' && <ParametrosSucursalesSection />}
      {activeTab === 'instituciones-financieras' && <InstitucionesFinancierasSection />}
      {activeTab === 'sucursales' && <SucursalesSection />}
      {activeTab === 'puestos-trabajo' && <PuestosTrabajoSection />}
      {activeTab === 'empleados' && <EmpleadosSection />}
      {activeTab === 'mantenimiento' && <MantenimientoSection />}
      {activeTab === 'catalogo-documentos' && <CatalogoDocumentosSection />}
    </>
  );
}