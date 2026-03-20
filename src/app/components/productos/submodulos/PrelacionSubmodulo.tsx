import { List } from 'lucide-react';

interface PrelacionSubmoduloProps {
  productoId?: number;
  productoNombre?: string;
  onBack: () => void;
  isView: boolean;
}

export function PrelacionSubmodulo({ productoId, productoNombre, onBack, isView }: PrelacionSubmoduloProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-[#F9A825] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
          <List className="h-8 w-8 text-[#F9A825]" strokeWidth={2} />
        </div>
        <h4 className="text-lg font-semibold text-[#3C3C3C] mb-2">Prelación</h4>
        <p className="text-sm text-[#9E9E9E]">
          No hay prelaciones configuradas para este producto.
        </p>
      </div>
    </div>
  );
}
