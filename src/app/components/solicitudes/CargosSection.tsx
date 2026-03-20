import { useState } from 'react';

interface CargosSectionProps {
  onOpenModal: () => void;
}

interface CargoData {
  id: number;
  tipoCargo: string;
  descripcion: string;
  monto: string;
  fechaCargo: string;
  estatus: string;
  notas: string;
}

export function CargosSection({ onOpenModal }: CargosSectionProps) {
  const [cargos] = useState<CargoData[]>([
    {
      id: 1,
      tipoCargo: 'Comisión por apertura',
      descripcion: 'Comisión por apertura de crédito',
      monto: '$2,500.00',
      fechaCargo: '13/01/2026',
      estatus: 'Pendiente',
      notas: 'Cargo aplicable al momento de la disposición'
    },
    {
      id: 2,
      tipoCargo: 'Seguro de vida',
      descripcion: 'Prima de seguro de vida anual',
      monto: '$1,200.00',
      fechaCargo: '13/01/2026',
      estatus: 'Pendiente',
      notas: 'Renovación anual obligatoria'
    },
    {
      id: 3,
      tipoCargo: 'Gastos administrativos',
      descripcion: 'Gastos de evaluación y gestión',
      monto: '$800.00',
      fechaCargo: '13/01/2026',
      estatus: 'Aplicado',
      notas: 'Cargo único por procesamiento'
    },
    {
      id: 4,
      tipoCargo: 'Comisión por disposición',
      descripcion: 'Comisión por cada disposición del crédito',
      monto: '$150.00',
      fechaCargo: '15/01/2026',
      estatus: 'Aplicado',
      notas: 'Por disposición parcial'
    },
    {
      id: 5,
      tipoCargo: 'Seguro de daños',
      descripcion: 'Prima de seguro contra daños',
      monto: '$950.00',
      fechaCargo: '13/01/2026',
      estatus: 'Cancelado',
      notas: 'Cliente optó por seguro externo'
    }
  ]);

  return (
    <div className="bg-white p-3 border border-gray-200">
      {/* Botones Nuevo y Eliminar */}
      <div className="flex gap-2 mb-3">
        <button 
          onClick={onOpenModal}
          className="px-4 py-1.5 bg-[#5B9BD5] text-white text-xs font-normal rounded hover:bg-[#4A8BC2]"
        >
          Nuevo
        </button>
        <button className="px-4 py-1.5 bg-gray-200 text-gray-700 text-xs font-normal border border-gray-400 rounded hover:bg-gray-300">
          Eliminar
        </button>
      </div>

      {/* Tabla de Cargos */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#D3D3D3]">
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Tipo de cargo</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Descripción</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Monto</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Fecha de cargo</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Estatus</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Notas</th>
            </tr>
          </thead>
          <tbody>
            {cargos.map((cargo) => (
              <tr key={cargo.id} className="hover:bg-gray-50">
                <td className="border border-gray-400 px-3 py-2 text-gray-700">
                  {cargo.tipoCargo}
                </td>
                <td className="border border-gray-400 px-3 py-2 text-gray-700">
                  {cargo.descripcion}
                </td>
                <td className="border border-gray-400 px-3 py-2 text-gray-700">
                  {cargo.monto}
                </td>
                <td className="border border-gray-400 px-3 py-2 text-gray-700">
                  {cargo.fechaCargo}
                </td>
                <td className="border border-gray-400 px-3 py-2 text-gray-700">
                  <span className={`inline-block px-2 py-1 rounded text-xs ${
                    cargo.estatus === 'Aplicado' ? 'bg-green-100 text-green-800' :
                    cargo.estatus === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {cargo.estatus}
                  </span>
                </td>
                <td className="border border-gray-400 px-3 py-2 text-gray-700">
                  {cargo.notas}
                </td>
              </tr>
            ))}
            {/* Filas vacías para mantener estructura */}
            <tr className="hover:bg-gray-50">
              <td className="border border-gray-400 px-3 py-2">&nbsp;</td>
              <td className="border border-gray-400 px-3 py-2">&nbsp;</td>
              <td className="border border-gray-400 px-3 py-2">&nbsp;</td>
              <td className="border border-gray-400 px-3 py-2">&nbsp;</td>
              <td className="border border-gray-400 px-3 py-2">&nbsp;</td>
              <td className="border border-gray-400 px-3 py-2">&nbsp;</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
