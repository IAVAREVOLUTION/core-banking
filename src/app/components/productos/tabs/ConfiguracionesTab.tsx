import { useState } from 'react';
import {
  Calendar,
  Percent,
  TrendingUp,
  LineChart,
  FileCheck,
  Package,
  MapPin,
  DollarSign,
  List,
  Layers,
  Receipt,
  Banknote,
} from 'lucide-react';
import { PeriodosSubmodulo } from '../submodulos/PeriodosSubmodulo';
import { MatrizTasaFijaSubmodulo } from '../submodulos/MatrizTasaFijaSubmodulo';
import { TasaReferenciaSubmodulo } from '../submodulos/TasaReferenciaSubmodulo';
import { MatrizTasaVariableSubmodulo } from '../submodulos/MatrizTasaVariableSubmodulo';
import { RequisitosSubmodulo } from '../submodulos/RequisitosSubmodulo';
import { CargosSubmodulo } from '../submodulos/CargosSubmodulo';
import { ComisionesSubmodulo } from '../submodulos/ComisionesSubmodulo';

interface ConfiguracionesTabProps {
  productoId?: number;
  productoNombre?: string;
  lineaProducto?: string;
  sublineaProducto?: string;
  isView: boolean;
}

type SubmoduloType =
  | 'periodos'
  | 'matriz-tasa-fija'
  | 'tasa-referencia'
  | 'matriz-tasa-variable'
  | 'requisitos'
  | 'cargos'
  | 'comisiones'
  | null;

export function ConfiguracionesTab({
  productoId,
  productoNombre,
  lineaProducto,
  sublineaProducto,
  isView,
}: ConfiguracionesTabProps) {
  const [activeSubmodulo, setActiveSubmodulo] = useState<SubmoduloType>(null);

  const submodulos = [
    {
      id: 'periodos' as SubmoduloType,
      nombre: 'Periodos',
      descripcion: 'Configurar periodos de pago o capitalización',
      icon: Calendar,
      color: '#2E5C91',
    },
    {
      id: 'matriz-tasa-fija' as SubmoduloType,
      nombre: 'Matriz Tasa Fija',
      descripcion: 'Definir tasas fijas por plazo y monto',
      icon: Percent,
      color: '#4A76A8',
    },
    {
      id: 'tasa-referencia' as SubmoduloType,
      nombre: 'Tasa Referencia',
      descripcion: 'Tasas de referencia para productos variables',
      icon: TrendingUp,
      color: '#4CAF50',
    },
    {
      id: 'matriz-tasa-variable' as SubmoduloType,
      nombre: 'Matriz Tasa Variable',
      descripcion: 'Puntos sobre tasa de referencia',
      icon: LineChart,
      color: '#2E5C91',
    },
    {
      id: 'requisitos' as SubmoduloType,
      nombre: 'Requisitos',
      descripcion: 'Documentación y requisitos del producto',
      icon: FileCheck,
      color: '#4A76A8',
    },
    {
      id: 'cargos' as SubmoduloType,
      nombre: 'Cargos',
      descripcion: 'Cargos asociados al producto',
      icon: DollarSign,
      color: '#F9A825',
    },
    {
      id: 'comisiones' as SubmoduloType,
      nombre: 'Comisiones',
      descripcion: 'Comisiones del producto',
      icon: Banknote,
      color: '#2E5C91',
    },
  ];

  // Renderizar submódulo activo
  if (activeSubmodulo === 'periodos') {
    return (
      <PeriodosSubmodulo
        productoId={productoId}
        productoNombre={productoNombre}
        lineaProducto={lineaProducto}
        sublineaProducto={sublineaProducto}
        onBack={() => setActiveSubmodulo(null)}
        isView={isView}
      />
    );
  }

  if (activeSubmodulo === 'matriz-tasa-fija') {
    return (
      <MatrizTasaFijaSubmodulo
        productoId={productoId}
        productoNombre={productoNombre}
        onBack={() => setActiveSubmodulo(null)}
        isView={isView}
      />
    );
  }

  if (activeSubmodulo === 'tasa-referencia') {
    return (
      <TasaReferenciaSubmodulo
        productoId={productoId}
        productoNombre={productoNombre}
        onBack={() => setActiveSubmodulo(null)}
        isView={isView}
      />
    );
  }

  if (activeSubmodulo === 'matriz-tasa-variable') {
    return (
      <MatrizTasaVariableSubmodulo
        productoId={productoId}
        productoNombre={productoNombre}
        onBack={() => setActiveSubmodulo(null)}
        isView={isView}
      />
    );
  }

  if (activeSubmodulo === 'requisitos') {
    return (
      <RequisitosSubmodulo
        productoId={productoId}
        productoNombre={productoNombre}
        onBack={() => setActiveSubmodulo(null)}
        isView={isView}
      />
    );
  }

  if (activeSubmodulo === 'cargos') {
    return (
      <CargosSubmodulo
        productoId={productoId}
        productoNombre={productoNombre}
        onBack={() => setActiveSubmodulo(null)}
        isView={isView}
      />
    );
  }

  if (activeSubmodulo === 'comisiones') {
    return (
      <ComisionesSubmodulo
        productoId={productoId}
        productoNombre={productoNombre}
        onBack={() => setActiveSubmodulo(null)}
        isView={isView}
      />
    );
  }

  // Vista principal de configuraciones
  return (
    <div className="space-y-4">
      {/* Card Resumen del Producto */}
      <div className="bg-[#F5F5F7] border border-[#E0E0E0] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#3C3C3C] mb-3">
          Producto Maestro
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-[#9E9E9E]">ID Producto</p>
            <p className="text-sm font-semibold text-[#3C3C3C]">{productoId || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-[#9E9E9E]">Nombre</p>
            <p className="text-sm font-semibold text-[#3C3C3C]">{productoNombre || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-[#9E9E9E]">Línea</p>
            <p className="text-sm font-semibold text-[#3C3C3C]">{lineaProducto || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-[#9E9E9E]">Sublínea</p>
            <p className="text-sm font-semibold text-[#3C3C3C]">{sublineaProducto || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Submódulos */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4">
          Configuraciones del Producto
        </h3>
        <p className="text-sm text-[#9E9E9E] mb-6">
          Seleccione una configuración para administrar los detalles del producto
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {submodulos.map((submodulo) => {
            const Icon = submodulo.icon;
            return (
              <button
                key={submodulo.id}
                onClick={() => setActiveSubmodulo(submodulo.id)}
                className="bg-white border border-[#E0E0E0] rounded-lg p-4 hover:border-[#2E5C91] hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${submodulo.color}15` }}
                  >
                    <Icon
                      className="h-6 w-6"
                      style={{ color: submodulo.color }}
                      strokeWidth={2}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-[#3C3C3C] mb-1 group-hover:text-[#2E5C91] transition-colors">
                      {submodulo.nombre}
                    </h4>
                    <p className="text-xs text-[#9E9E9E] line-clamp-2">
                      {submodulo.descripcion}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Nota informativa */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Nota:</strong> Guarde primero los datos generales del producto antes de configurar
          periodos, tasas y otros parámetros específicos.
        </p>
      </div>
    </div>
  );
}