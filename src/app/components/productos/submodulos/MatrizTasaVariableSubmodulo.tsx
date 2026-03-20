import { LineChart } from 'lucide-react';

interface MatrizTasaVariableSubmoduloProps {
  productoId?: number;
  productoNombre?: string;
  onBack: () => void;
  isView: boolean;
}

export function MatrizTasaVariableSubmodulo({ productoId, productoNombre, onBack, isView }: MatrizTasaVariableSubmoduloProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-[#9E9E9E] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
          <LineChart className="h-8 w-8 text-[#9E9E9E]" strokeWidth={2} />
        </div>
        <h4 className="text-lg font-semibold text-[#3C3C3C] mb-2">Sin Configuración</h4>
        <p className="text-sm text-[#9E9E9E]">
          No hay matrices de tasa variable configuradas para este producto.
        </p>
      </div>
    </div>
  );
}
