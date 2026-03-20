import { useState } from 'react';
import { mockComisiones, Comision } from '../../../data/mockData';

interface ComisionesSubmoduloProps {
  productoId?: number;
  productoNombre?: string;
  onBack: () => void;
  isView: boolean;
}

export function ComisionesSubmodulo({ productoId, productoNombre, onBack, isView }: ComisionesSubmoduloProps) {
  const [comisiones] = useState<Comision[]>(
    mockComisiones.filter((c) => c.productoId === productoId)
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
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {comisiones.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[#9E9E9E]">
                  No hay comisiones configuradas
                </td>
              </tr>
            ) : (
              comisiones.map((comision) => (
                <tr key={comision.id} className="hover:bg-[#F5F5F7]">
                  <td className="px-4 py-3 text-sm font-medium text-[#3C3C3C]">{comision.concepto}</td>
                  <td className="px-4 py-3 text-sm text-[#9E9E9E]">{comision.tipo}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-[#2E5C91]">
                    {comision.tipo === 'Porcentaje'
                      ? `${comision.monto}%`
                      : `$${comision.monto.toLocaleString('es-MX')}`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
