import { useState } from 'react';
import { mockCargos, Cargo } from '../../../data/mockData';

interface CargosSubmoduloProps {
  productoId?: number;
  productoNombre?: string;
  onBack: () => void;
  isView: boolean;
}

export function CargosSubmodulo({ productoId, productoNombre, onBack, isView }: CargosSubmoduloProps) {
  const [cargos] = useState<Cargo[]>(
    mockCargos.filter((c) => c.productoId === productoId)
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#F5F5F7] border-b border-[#E0E0E0]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase">
                Concepto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase">
                Tipo
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#3C3C3C] uppercase">
                Monto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase">
                Frecuencia
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {cargos.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#9E9E9E]">
                  No hay cargos configurados
                </td>
              </tr>
            ) : (
              cargos.map((cargo) => (
                <tr key={cargo.id} className="hover:bg-[#F5F5F7]">
                  <td className="px-4 py-3 text-sm font-medium text-[#3C3C3C]">{cargo.concepto}</td>
                  <td className="px-4 py-3 text-sm text-[#9E9E9E]">{cargo.tipo}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-[#F9A825]">
                    {cargo.tipo === 'Porcentaje' ? `${cargo.monto}%` : `$${cargo.monto.toLocaleString('es-MX')}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#3C3C3C]">{cargo.frecuencia}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
