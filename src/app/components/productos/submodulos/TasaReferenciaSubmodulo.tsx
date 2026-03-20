import { useState } from 'react';
import { mockTasasReferencia, TasaReferencia } from '../../../data/mockData';

interface TasaReferenciaSubmoduloProps {
  productoId?: number;
  productoNombre?: string;
  onBack: () => void;
  isView: boolean;
}

export function TasaReferenciaSubmodulo({ productoId, productoNombre, onBack, isView }: TasaReferenciaSubmoduloProps) {
  const [tasas] = useState<TasaReferencia[]>(
    mockTasasReferencia.filter((t) => t.productoId === productoId)
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

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
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#3C3C3C] uppercase">
                Valor (%)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase">
                Fecha Vigencia
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {tasas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#9E9E9E]">
                  No hay tasas de referencia configuradas
                </td>
              </tr>
            ) : (
              tasas.map((tasa) => (
                <tr key={tasa.id} className="hover:bg-[#F5F5F7]">
                  <td className="px-4 py-3 text-sm font-medium text-[#3C3C3C]">{tasa.nombre}</td>
                  <td className="px-4 py-3 text-sm text-[#9E9E9E]">{tasa.descripcion}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-[#4CAF50]">
                    {tasa.valor}%
                  </td>
                  <td className="px-4 py-3 text-sm text-[#3C3C3C]">{formatDate(tasa.fechaVigencia)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
