import { useState } from 'react';
import { mockRequisitos, Requisito } from '../../../data/mockData';

interface RequisitosSubmoduloProps {
  productoId?: number;
  productoNombre?: string;
  onBack: () => void;
  isView: boolean;
}

export function RequisitosSubmodulo({ productoId, productoNombre, onBack, isView }: RequisitosSubmoduloProps) {
  const [requisitos] = useState<Requisito[]>(
    mockRequisitos.filter((r) => r.productoId === productoId)
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#F5F5F7] border-b border-[#E0E0E0]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase">
                Descripción
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-[#3C3C3C] uppercase">
                Obligatorio
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {requisitos.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[#9E9E9E]">
                  No hay requisitos configurados
                </td>
              </tr>
            ) : (
              requisitos.map((req) => (
                <tr key={req.id} className="hover:bg-[#F5F5F7]">
                  <td className="px-4 py-3 text-sm font-medium text-[#3C3C3C]">{req.nombre}</td>
                  <td className="px-4 py-3 text-sm text-[#9E9E9E]">{req.descripcion}</td>
                  <td className="px-4 py-3 text-center">
                    {req.obligatorio ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#C62828] text-white">
                        Sí
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#9E9E9E] text-white">
                        No
                      </span>
                    )}
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
