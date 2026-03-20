import { useState } from 'react';

interface CaptacionTabProps {
  mode: 'create' | 'edit' | 'view';
  productId?: number;
}

interface DocumentacionItem {
  tipoPersona: string;
  tipoDocumento: string;
  requerido: boolean;
  permanente: boolean;
  descripcion: string;
  requeridoPor: string;
  empresaFormProcede: string;
  fases: string;
}

export function CaptacionTab({ mode }: CaptacionTabProps) {
  const isView = mode === 'view';
  
  const [documentacionItems] = useState<DocumentacionItem[]>([
    {
      tipoPersona: 'Moral',
      tipoDocumento: 'A ésta Capitalizado y poeta en',
      requerido: true,
      permanente: true,
      descripcion: '',
      requeridoPor: 'Jurídico',
      empresaFormProcede: 'AutoAgila',
      fases: 'Análisis de Crédito'
    }
  ]);

  return (
    <div>
      {/* Sección 1: Documentación Captaciones */}
      <div className="mb-6">
        {/* Header con botones */}
        <div className="bg-[#E8E8E8] px-3 py-2 mb-0 flex items-center justify-between border border-gray-400">
          <h4 className="text-xs font-medium text-gray-800">Documentación Captaciones</h4>
          <div className="flex gap-2">
            {!isView && (
              <>
                <button className="px-3 py-1 text-xs bg-[#5B9BD5] text-white hover:bg-[#4A8BC2] rounded">
                  Nuevo
                </button>
                <button className="px-3 py-1 text-xs bg-[#5B9BD5] text-white hover:bg-[#4A8BC2] rounded">
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="border border-gray-400 border-t-0">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-[#E8E8E8]">
                <th className="border-r border-gray-400 px-2 py-2 text-left font-medium text-gray-800">Tipo persona</th>
                <th className="border-r border-gray-400 px-2 py-2 text-left font-medium text-gray-800">Tipo documento</th>
                <th className="border-r border-gray-400 px-2 py-2 text-center font-medium text-gray-800">Requerido</th>
                <th className="border-r border-gray-400 px-2 py-2 text-center font-medium text-gray-800">Permanente</th>
                <th className="border-r border-gray-400 px-2 py-2 text-left font-medium text-gray-800">Descripción</th>
                <th className="border-r border-gray-400 px-2 py-2 text-left font-medium text-gray-800">Requerido Por</th>
                <th className="border-r border-gray-400 px-2 py-2 text-left font-medium text-gray-800">Empresa de Form Procede</th>
                <th className="px-2 py-2 text-left font-medium text-gray-800">Fases</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {documentacionItems.map((item, index) => (
                <tr key={index}>
                  <td className="border-r border-t border-gray-400 px-2 py-2">{item.tipoPersona}</td>
                  <td className="border-r border-t border-gray-400 px-2 py-2">{item.tipoDocumento}</td>
                  <td className="border-r border-t border-gray-400 px-2 py-2 text-center">
                    {item.requerido ? '✓' : ''}
                  </td>
                  <td className="border-r border-t border-gray-400 px-2 py-2 text-center">
                    {item.permanente ? '✓' : ''}
                  </td>
                  <td className="border-r border-t border-gray-400 px-2 py-2">{item.descripcion}</td>
                  <td className="border-r border-t border-gray-400 px-2 py-2">{item.requeridoPor}</td>
                  <td className="border-r border-t border-gray-400 px-2 py-2">{item.empresaFormProcede}</td>
                  <td className="border-t border-gray-400 px-2 py-2">{item.fases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}