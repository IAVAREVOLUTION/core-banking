import { MapPin } from 'lucide-react';

interface SucursalSubmoduloProps {
  productoId?: number;
  productoNombre?: string;
  onBack: () => void;
  isView: boolean;
}

export function SucursalSubmodulo({ productoId, productoNombre, onBack, isView }: SucursalSubmoduloProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-[color:var(--theme-primary)] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="h-8 w-8 text-[color:var(--theme-primary)]" strokeWidth={2} />
        </div>
        <h4 className="text-lg font-semibold text-[#3C3C3C] mb-2">Sucursales</h4>
        <p className="text-sm text-[#9E9E9E]">
          No hay sucursales configuradas para este producto.
        </p>
      </div>
    </div>
  );
}
