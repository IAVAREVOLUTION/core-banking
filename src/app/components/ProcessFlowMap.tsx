/**
 * ProcessFlowMap.tsx
 *
 * Componente visual del Proceso General de Core Banking.
 * Muestra el flujo de 9 pasos con estado de implementación
 * y enlaces de navegación a los módulos existentes.
 *
 * Referencia: Diagrama "PROCESO GENERAL CORE BANKING"
 */
import { useState } from 'react';
import {
  CheckCircle, AlertCircle, Clock, ArrowDown,
  Settings, Package, Users, UserPlus, FileText, ClipboardList,
  Landmark, CreditCard, TrendingUp, BarChart3
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DEL FLUJO
// ═══════════════════════════════════════════════════════════════════

type ModuleId = string;
type FlowStatus = 'ok' | 'partial' | 'missing';

interface FlowStep {
  id: string;
  number: string;
  label: string;
  moduleId: ModuleId;
  icon: React.ReactNode;
  status: FlowStatus;
  /** Descripción corta del estado */
  statusDetail: string;
  /** Subtabs o subpasos */
  subSteps?: { label: string; status: FlowStatus; detail: string }[];
  /** Flujos de navegación hacia otros módulos */
  outgoingFlows?: { targetStep: string; label: string; status: FlowStatus; detail: string }[];
}

const FLOW_STEPS: FlowStep[] = [
  {
    id: 'config-empresa',
    number: '1',
    label: 'Configuración Empresa',
    moduleId: 'configuracion',
    icon: <Settings size={20} />,
    status: 'ok',
    statusDetail: 'Completo: Parámetros, Sucursales, Empleados, Puestos, Catálogos, Instituciones Financieras, Mantenimiento',
    outgoingFlows: [
      { targetStep: 'config-productos', label: '→ Productos', status: 'ok', detail: 'Navegación por tab en barra principal' },
    ],
  },
  {
    id: 'config-productos',
    number: '2',
    label: 'Configuración Taller de Productos',
    moduleId: 'productos',
    icon: <Package size={20} />,
    status: 'ok',
    statusDetail: 'Completo: 4 submódulos con CRUD + Supabase + Seed de 8 productos',
    subSteps: [
      { label: 'Productos Crédito', status: 'ok', detail: '2 productos seed (PYME + Nómina) con todos los subtabs' },
      { label: 'Productos Captación', status: 'ok', detail: '2 productos seed (Plazo Fijo + Ahorro Infantil) con todos los subtabs' },
      { label: 'Productos Línea de Crédito', status: 'ok', detail: '2 productos seed (Revolvente + Agropecuario) con todos los subtabs' },
      { label: 'Productos Seguros', status: 'ok', detail: '2 productos seed (Auto Total + GMM Grupal) con todos los subtabs' },
    ],
    outgoingFlows: [
      { targetStep: 'prospectos', label: '→ Prospectos', status: 'ok', detail: 'Navegación por tab en barra principal' },
    ],
  },
  {
    id: 'prospectos',
    number: '3',
    label: 'Gestión de Prospectos',
    moduleId: 'prospectos',
    icon: <UserPlus size={20} />,
    status: 'ok',
    statusDetail: 'Completo: Dashboard + Lista + Form con Supabase (J_CLIENTES type=Prospecto/Contacto)',
    outgoingFlows: [
      { targetStep: 'clientes', label: '→ Convertir a Cliente', status: 'missing', detail: 'NO IMPLEMENTADO: No existe botón "Promover a Cliente" en ProspectoForm' },
      { targetStep: 'solicitudes', label: '→ Solicitudes (directo)', status: 'missing', detail: 'NO IMPLEMENTADO: No hay flujo directo Prospecto → Solicitud' },
    ],
  },
  {
    id: 'clientes',
    number: '4',
    label: 'Gestión de Clientes',
    moduleId: 'clientes',
    icon: <Users size={20} />,
    status: 'ok',
    statusDetail: 'Completo: Dashboard + Lista + Form con 15+ subtabs + Supabase (J_CLIENTES)',
    subSteps: [
      { label: 'Alta/Editar/Ver', status: 'ok', detail: 'Datos generales, dirección, personas relacionadas, expedientes, PLD, SIC' },
      { label: 'Subtab Cotizaciones', status: 'ok', detail: 'Lista cotizaciones del cliente con deep-link al módulo Cotizaciones' },
      { label: 'Subtab Solicitudes', status: 'ok', detail: 'Lista de solicitudes del cliente' },
      { label: 'Subtab Créditos', status: 'ok', detail: 'Lista de créditos del cliente' },
      { label: 'Subtab Inversiones', status: 'ok', detail: 'Lista de inversiones del cliente' },
      { label: 'Subtab Cuentas Ahorro', status: 'ok', detail: 'Lista de cuentas del cliente' },
    ],
    outgoingFlows: [
      { targetStep: 'cotizaciones', label: '→ Cotizaciones', status: 'ok', detail: 'FUNCIONAL: Deep-link desde subtab Cotizaciones del cliente' },
    ],
  },
  {
    id: 'cotizaciones',
    number: '5',
    label: 'Gestión Cotizaciones',
    moduleId: 'cotizaciones',
    icon: <FileText size={20} />,
    status: 'ok',
    statusDetail: 'Completo: 3 subcategorías con Dashboard + Lista + Form',
    subSteps: [
      { label: '5.1 Cotizaciones Créditos', status: 'ok', detail: 'Lista + Form con simulación de amortización' },
      { label: '5.2 Cotizaciones Captaciones', status: 'ok', detail: 'Lista + Form con integración DB (J_COTIZACIONES)' },
      { label: '5.3 Cotizaciones Líneas de Crédito', status: 'ok', detail: 'Lista + Form reutilizando componentes de crédito' },
    ],
    outgoingFlows: [
      { targetStep: 'solicitudes', label: '→ Crear Solicitud', status: 'ok', detail: 'FUNCIONAL: Botón "Crear Solicitud" pre-llena datos en SolicitudCreditoForm' },
    ],
  },
  {
    id: 'solicitudes',
    number: '6',
    label: 'Gestión Solicitudes',
    moduleId: 'solicitudes-creditos',
    icon: <ClipboardList size={20} />,
    status: 'ok',
    statusDetail: 'Completo: Dashboard + Lista + Form con 7 secciones acordeón',
    subSteps: [
      { label: 'Términos y Condiciones', status: 'ok', detail: 'Tab con condiciones del crédito' },
      { label: 'Simulación', status: 'ok', detail: 'Tabla de amortización' },
      { label: 'Expediente Electrónico', status: 'ok', detail: 'Documentos del expediente' },
      { label: 'Garantías', status: 'ok', detail: 'Garantías de la solicitud' },
      { label: 'Comisiones', status: 'ok', detail: 'Comisiones aplicables' },
      { label: 'Autorizaciones', status: 'ok', detail: 'Niveles de autorización' },
      { label: 'Notas', status: 'ok', detail: 'Notas y observaciones' },
    ],
    outgoingFlows: [
      { targetStep: 'originacion', label: '→ Originación', status: 'missing', detail: 'NO IMPLEMENTADO: No hay botón "Enviar a Originación" en SolicitudCreditoForm' },
    ],
  },
  {
    id: 'originacion',
    number: '7',
    label: 'Originación Solicitudes',
    moduleId: 'originacion',
    icon: <Landmark size={20} />,
    status: 'partial',
    statusDetail: 'Parcial: Dashboard + Lista + Form (solo consulta/editar, sin "Nuevo"). Datos MOCK no enlazados con Solicitudes',
    subSteps: [
      { label: 'Dashboard', status: 'ok', detail: 'Métricas y KPIs de originación' },
      { label: 'Lista', status: 'ok', detail: 'Grid con MOCK_ORIGINACIONES' },
      { label: 'Form (Editar/Ver)', status: 'ok', detail: 'Tabs: Default, Autorizaciones, Garantías, Cargos, Avisos, Expedientes' },
    ],
    outgoingFlows: [
      { targetStep: 'activacion', label: '→ Activación Cuentas', status: 'missing', detail: 'NO IMPLEMENTADO: No hay flujo de aprobación → activación' },
    ],
  },
  {
    id: 'activacion',
    number: '8',
    label: 'Activación Cuentas',
    moduleId: 'cuentas-ahorro',
    icon: <CreditCard size={20} />,
    status: 'ok',
    statusDetail: 'Completo: Dashboard + Lista + Form con 11 subtabs. Datos independientes (no enlazados con Originación)',
    subSteps: [
      { label: 'Beneficiarios', status: 'ok', detail: 'Tab de beneficiarios de la cuenta' },
      { label: 'Co-titulares', status: 'ok', detail: 'Tab de co-titulares' },
      { label: 'Expedientes Electrónicos', status: 'ok', detail: 'Documentos de la cuenta' },
      { label: 'Cargos', status: 'ok', detail: 'Cargos asociados' },
      { label: 'Impuestos', status: 'ok', detail: 'Configuración de impuestos' },
      { label: 'Movimientos', status: 'ok', detail: 'Movimientos de la cuenta' },
    ],
    outgoingFlows: [
      { targetStep: 'cartera-creditos', label: '→ Cartera Créditos', status: 'partial', detail: 'Sin enlace directo, módulo Créditos es independiente' },
      { targetStep: 'cartera-captacion', label: '→ Cartera Captación', status: 'partial', detail: 'Sin enlace directo, módulo Inversiones es independiente' },
      { targetStep: 'cartera-lineas', label: '→ Cartera Líneas', status: 'missing', detail: 'NO IMPLEMENTADO: Módulo en desarrollo' },
    ],
  },
  {
    id: 'cartera',
    number: '9',
    label: 'Gestión de Cartera',
    moduleId: 'creditos',
    icon: <BarChart3 size={20} />,
    status: 'partial',
    statusDetail: '2 de 3 submódulos implementados. Sin enlace con Activación.',
    subSteps: [
      { label: '9.1 Cartera Créditos', status: 'ok', detail: 'CreditosModule: Dashboard + Lista + Form con Amortización, Autorizaciones, Garantías, Cargos, Avisos, Solicitudes Extra, Expedientes' },
      { label: '9.2 Cartera Captación/Inversiones', status: 'ok', detail: 'InversionesModule: Home + Lista + Form con Movimientos, Documentos Valor, Bloqueos' },
      { label: '9.3 Cartera Líneas de Crédito', status: 'missing', detail: 'PLACEHOLDER: Tabs "Cartera crédito/inversión/ahorro" muestran "Módulo en desarrollo"' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════
function StatusBadge({ status }: { status: FlowStatus }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle size={12} /> Implementado
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
        <Clock size={12} /> Parcial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
      <AlertCircle size={12} /> Faltante
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FLOW ARROW
// ═══════════════════════════════════════════════════════════════════
function FlowArrow({ status }: { status: FlowStatus }) {
  const color = status === 'ok' ? '#10B981' : status === 'partial' ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center justify-center py-1">
      <ArrowDown size={20} color={color} strokeWidth={2.5} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP CARD
// ═══════════════════════════════════════════════════════════════════
function StepCard({ step, onNavigate }: { step: FlowStep; onNavigate: (moduleId: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const borderColor = step.status === 'ok' ? 'border-emerald-400' : step.status === 'partial' ? 'border-amber-400' : 'border-red-400';
  const bgHeader = step.status === 'ok' ? 'bg-emerald-50' : step.status === 'partial' ? 'bg-amber-50' : 'bg-red-50';

  return (
    <div className={`border-2 ${borderColor} rounded-lg overflow-hidden shadow-sm`}>
      {/* Header */}
      <div
        className={`${bgHeader} px-4 py-3 flex items-center gap-3 cursor-pointer select-none`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--theme-primary)] text-white text-sm font-bold">
          {step.number}
        </div>
        <div className="text-[var(--theme-primary)]">{step.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900">{step.label}</span>
            <StatusBadge status={step.status} />
          </div>
          <p className="text-[11px] text-gray-600 mt-0.5 truncate">{step.statusDetail}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(step.moduleId); }}
          className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--theme-primary)] text-white hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          Ir al módulo
        </button>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-3 bg-white border-t border-gray-200 space-y-3">
          {/* Substeps */}
          {step.subSteps && step.subSteps.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-1.5">Submódulos / Tabs:</h4>
              <div className="space-y-1">
                {step.subSteps.map((sub, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <StatusBadge status={sub.status} />
                    <div>
                      <span className="font-medium text-gray-800">{sub.label}</span>
                      <span className="text-gray-500 ml-1">— {sub.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing flows */}
          {step.outgoingFlows && step.outgoingFlows.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-1.5">Flujos de navegación:</h4>
              <div className="space-y-1">
                {step.outgoingFlows.map((flow, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <StatusBadge status={flow.status} />
                    <div>
                      <span className="font-medium text-gray-800">{flow.label}</span>
                      <span className="text-gray-500 ml-1">— {flow.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY STATS
// ═══════════════════════════════════════════════════════════════════
function SummaryStats() {
  const total = FLOW_STEPS.length;
  const ok = FLOW_STEPS.filter(s => s.status === 'ok').length;
  const partial = FLOW_STEPS.filter(s => s.status === 'partial').length;
  const missing = FLOW_STEPS.filter(s => s.status === 'missing').length;

  // Count flow links
  const allFlows = FLOW_STEPS.flatMap(s => s.outgoingFlows || []);
  const flowsOk = allFlows.filter(f => f.status === 'ok').length;
  const flowsPartial = allFlows.filter(f => f.status === 'partial').length;
  const flowsMissing = allFlows.filter(f => f.status === 'missing').length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-white border border-gray-300 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-[var(--theme-primary)]">{total}</div>
        <div className="text-xs text-gray-600">Módulos del Flujo</div>
      </div>
      <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-emerald-700">{ok}</div>
        <div className="text-xs text-emerald-600">Implementados</div>
      </div>
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-amber-700">{partial}</div>
        <div className="text-xs text-amber-600">Parciales</div>
      </div>
      <div className="bg-white border border-gray-300 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-[var(--theme-primary)]">{flowsOk}/{allFlows.length}</div>
        <div className="text-xs text-gray-600">Flujos Inter-módulo</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
interface ProcessFlowMapProps {
  onNavigateToModule: (moduleId: string) => void;
}

export function ProcessFlowMap({ onNavigateToModule }: ProcessFlowMapProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-300 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--theme-primary)] text-white flex items-center justify-center">
            <TrendingUp size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Proceso General Core Banking</h2>
            <p className="text-xs text-gray-500">Estado de implementación del flujo completo — auditoría de módulos y navegación inter-módulo</p>
          </div>
        </div>
        <SummaryStats />
      </div>

      {/* Flow Steps */}
      <div className="space-y-1">
        {FLOW_STEPS.map((step, idx) => (
          <div key={step.id}>
            <StepCard step={step} onNavigate={onNavigateToModule} />
            {idx < FLOW_STEPS.length - 1 && (
              <FlowArrow status={step.outgoingFlows?.[0]?.status || 'ok'} />
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="bg-white border border-gray-300 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Leyenda de Flujos Faltantes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-gray-600">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <span><strong>3→4:</strong> Prospectos → Clientes — Falta botón "Promover a Cliente" en ProspectoForm que cree un registro tipo=Cliente en J_CLIENTES con los datos del prospecto</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <span><strong>3→6:</strong> Prospectos → Solicitudes (directo) — Diagrama muestra flujo directo para prospectos pre-aprobados</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <span><strong>6→7:</strong> Solicitudes → Originación — Falta botón "Enviar a Originación" que cambie estatus y aparezca en lista de Originación</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <span><strong>7→8:</strong> Originación → Activación — Falta flujo de aprobación que cree la cuenta en Cuentas de Ahorro</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <span><strong>8→9:</strong> Activación → Cartera — Falta que la activación de cuenta genere el registro de crédito/inversión en cartera</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <span><strong>9.3:</strong> Cartera Líneas de Crédito — Tabs "Cartera crédito/inversión/ahorro" son placeholder</span>
          </div>
        </div>
      </div>
    </div>
  );
}