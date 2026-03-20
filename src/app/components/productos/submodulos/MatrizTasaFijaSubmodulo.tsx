import { useState } from 'react';
import { mockMatrizTasaFija, MatrizTasaFija } from '../../../data/mockData';

interface MatrizTasaFijaSubmoduloProps {
  productoId?: number;
  productoNombre?: string;
  onBack: () => void;
  isView: boolean;
}

export function MatrizTasaFijaSubmodulo({ productoId, productoNombre, onBack, isView }: MatrizTasaFijaSubmoduloProps) {
  const [tasas] = useState<MatrizTasaFija[]>(
    mockMatrizTasaFija.filter((t) => t.productoId === productoId)
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm overflow-hidden">
        <div className="bg-[#F5F5F7] px-6 py-3 border-b border-[#E0E0E0]">
          <h4 className="text-sm font-semibold text-[#3C3C3C]">Tasas Configuradas</h4>
        </div>
        <table className="w-full">
          <thead className="bg-[#F5F5F7] border-b border-[#E0E0E0]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase">
                Plazo Inicial
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase">
                Plazo Final
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#3C3C3C] uppercase">
                Monto Inicial
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#3C3C3C] uppercase">
                Monto Final
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#3C3C3C] uppercase">
                Tasa (%)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {tasas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#9E9E9E]">
                  No hay tasas configuradas
                </td>
              </tr>
            ) : (
              tasas.map((tasa) => (
                <tr key={tasa.id} className="hover:bg-[#F5F5F7]">
                  <td className="px-4 py-3 text-sm text-[#3C3C3C]">{tasa.plazoInicial} meses</td>
                  <td className="px-4 py-3 text-sm text-[#3C3C3C]">{tasa.plazoFinal} meses</td>
                  <td className="px-4 py-3 text-sm text-right text-[#3C3C3C]">
                    ${tasa.montoInicial.toLocaleString('es-MX')}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-[#3C3C3C]">
                    ${tasa.montoFinal.toLocaleString('es-MX')}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-[#2E5C91]">
                    {tasa.tasa}%
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
