import { useState } from 'react';

interface TabGarantiasProps {
  mode: 'nuevo' | 'editar' | 'ver';
  camposEditables: boolean;
}

interface Garantia {
  id: number;
  tipo: string;
  subtipo: string;
  garantia: string;
  valorNominal: string;
  descripcion: string;
  ubicacion: string;
}

export function TabGarantias({ mode, camposEditables }: TabGarantiasProps) {
  const [data, setData] = useState<Garantia[]>([
    { id: 1, tipo: 'Mueble', subtipo: 'Automóvil', garantia: 'GAR-006-Inventario-Retail', valorNominal: '$850,000.00', descripcion: 'Inventario completo de mercancía en tienda...', ubicacion: 'Plaza Comercial Centro, Monterrey...' },
    { id: 2, tipo: 'Inmueble', subtipo: 'Departamento', garantia: 'GAR-007-Casa-Guadalajara', valorNominal: '$3,250,000.00', descripcion: 'Casa habitación de 3 recámaras, 2 baños co...', ubicacion: 'Colonia Chapalita, Guadalajara, Jal...' },
    { id: 3, tipo: 'Inmueble', subtipo: 'Departamento', garantia: 'Seleccione', valorNominal: '$1,200,000.00', descripcion: 'Esc departamento de 3 habita Lomas y 100...', ubicacion: 'Refundir, municipio CDAM' },
    { id: 4, tipo: 'Mueble', subtipo: 'Maquinaria', garantia: 'GAR-005-Tractor-Caterpillar', valorNominal: '$1,500,000.00', descripcion: 'El Tractor Caterpillar de color amarillo con ca...', ubicacion: 'Garage de la Rimada El Rincón, Sa...' },
    { id: 5, tipo: 'Mueble', subtipo: 'Automóvil', garantia: 'GAR-004-Automóvil-Mazda3', valorNominal: '$218,500.00', descripcion: 'Mazda 3 2020 en un estado propietario 3 años...', ubicacion: 'CP 33000 Colonia Los Flores, CP-61800...' },
    { id: 6, tipo: 'Inmueble', subtipo: 'Terreno', garantia: 'GAR-003-Terreno-San-Luis', valorNominal: '$200.00', descripcion: 'Casa para particular de 3 habitaciones y 200...', ubicacion: 'La tienda San Luis Nuevo' },
    { id: 7, tipo: 'Inmueble', subtipo: 'Departamento', garantia: 'GAR-002-Departamento', valorNominal: '$2,100,250.50', descripcion: 'Casa para particular de 2 habitaciones y 200...', ubicacion: 'Granjas de Allende San Luis Rincón' },
    { id: 8, tipo: 'Mueble', subtipo: 'Automóvil', garantia: 'GAR-001-Automóvil', valorNominal: '$189,150.00', descripcion: 'Vehículo marca Chevrolet modelo Aveo 2021...', ubicacion: 'Calle Alem 6710 Plaza CP-Rivas Ave...' },
  ]);
  const [showFormModal, setShowFormModal] = useState(false);

  const isViewMode = mode === 'ver' || !camposEditables;

  const handleNew = () => {
    if (isViewMode) {
      return;
    }
    setShowFormModal(true);
  };

  const handleDelete = () => {
    if (isViewMode) {
      return;
    }
  };

  return (
    <>
      <div className="bg-white p-3 border border-gray-200">
        {/* Botones Nuevo y Eliminar */}
        <div className="flex gap-2 mb-3">
          <button 
            onClick={handleNew}
            disabled={isViewMode}
            className="px-4 py-1.5 bg-[#5B9BD5] text-white text-xs font-normal rounded hover:bg-[#4A8BC2] disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Nuevo
          </button>
          <button 
            onClick={handleDelete}
            disabled={isViewMode}
            className="px-4 py-1.5 bg-gray-200 text-gray-700 text-xs font-normal border border-gray-400 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Eliminar
          </button>
        </div>

        {/* Tabla de Garantías */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#D3D3D3]">
                <th className="border border-gray-400 px-2 py-1.5 text-left font-normal text-gray-800">Tipo *</th>
                <th className="border border-gray-400 px-2 py-1.5 text-left font-normal text-gray-800">Subtipo *</th>
                <th className="border border-gray-400 px-2 py-1.5 text-left font-normal text-gray-800">Garantía *</th>
                <th className="border border-gray-400 px-2 py-1.5 text-left font-normal text-gray-800">Valor Nominal</th>
                <th className="border border-gray-400 px-2 py-1.5 text-left font-normal text-gray-800">Descripción</th>
                <th className="border border-gray-400 px-2 py-1.5 text-left font-normal text-gray-800">Ubicación</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {data.map((item) => (
                <tr key={item.id}>
                  <td className="border border-gray-400 px-2 py-1">
                    <input type="checkbox" className="mr-1.5" disabled={isViewMode} />
                    <select 
                      className="inline w-[calc(100%-24px)] px-2 py-1 text-xs border-0 bg-white focus:outline-none"
                      disabled={isViewMode}
                    >
                      <option>{item.tipo}</option>
                    </select>
                  </td>
                  <td className="border border-gray-400 px-2 py-1">
                    <select 
                      className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none"
                      disabled={isViewMode}
                    >
                      <option>{item.subtipo}</option>
                    </select>
                  </td>
                  <td className="border border-gray-400 px-2 py-1">
                    <select 
                      className="w-[calc(100%-30px)] inline px-2 py-1 text-xs border-0 bg-white focus:outline-none"
                      disabled={isViewMode}
                    >
                      <option>{item.garantia}</option>
                    </select>
                    <button 
                      onClick={handleNew} 
                      className="inline px-1.5 text-xs hover:bg-gray-100"
                      disabled={isViewMode}
                    >
                      ...
                    </button>
                  </td>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-100">{item.valorNominal}</td>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-100">{item.descripcion}</td>
                  <td className="border border-gray-400 px-2 py-1 bg-gray-100">{item.ubicacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sección Expedientes Electrónicos */}
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-gray-800 mb-2 uppercase">Expedientes Electrónicos</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#D3D3D3]">
                  <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Fecha y hora del registro</th>
                  <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Usuario que registró</th>
                  <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Nombre del documento</th>
                  <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Tipo de Documento</th>
                  <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Descripción</th>
                  <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Estatus</th>
                  <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-400 px-3 py-2 text-center" colSpan={7}>
                    <span className="text-gray-500 text-xs">No hay expedientes electrónicos registrados</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Formulario */}
      {showFormModal && (
        <FormModal
          onClose={() => setShowFormModal(false)}
        />
      )}
    </>
  );
}

// Componente de Modal de Formulario
interface FormModalProps {
  onClose: () => void;
}

function FormModal({ onClose }: FormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Nueva Garantía</h3>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-300 font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 overflow-auto bg-white">
          <div className="mb-4">
            <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
              <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE GARANTÍA</span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {/* Tipo */}
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">
                  Tipo <span className="text-red-600">*</span>
                </label>
                <select className="w-full px-2 py-1 text-xs border border-gray-400">
                  <option value="">Seleccionar...</option>
                  <option value="Mueble">Mueble</option>
                  <option value="Inmueble">Inmueble</option>
                </select>
              </div>

              {/* Subtipo */}
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">
                  Subtipo <span className="text-red-600">*</span>
                </label>
                <select className="w-full px-2 py-1 text-xs border border-gray-400">
                  <option value="">Seleccionar...</option>
                  <option value="Automóvil">Automóvil</option>
                  <option value="Terreno">Terreno</option>
                  <option value="Departamento">Departamento</option>
                  <option value="Maquinaria">Maquinaria</option>
                </select>
              </div>

              {/* Garantía */}
              <div className="col-span-2">
                <label className="block text-xs text-gray-700 mb-1 font-medium">
                  Garantía <span className="text-red-600">*</span>
                </label>
                <div className="flex gap-2">
                  <select className="flex-1 px-2 py-1 text-xs border border-gray-400">
                    <option value="">Seleccionar...</option>
                  </select>
                  <button className="px-3 py-1 text-xs border border-gray-400 bg-white hover:bg-gray-100">
                    ...
                  </button>
                </div>
              </div>

              {/* Valor Nominal */}
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">
                  Valor Nominal
                </label>
                <input 
                  type="text"
                  placeholder="$0.00"
                  className="w-full px-2 py-1 text-xs border border-gray-400"
                />
              </div>

              {/* Ubicación */}
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">
                  Ubicación
                </label>
                <input 
                  type="text"
                  placeholder="Ubicación..."
                  className="w-full px-2 py-1 text-xs border border-gray-400"
                />
              </div>

              {/* Descripción */}
              <div className="col-span-2">
                <label className="block text-xs text-gray-700 mb-1 font-medium">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  placeholder="Descripción de la garantía..."
                  className="w-full px-2 py-1 text-xs border border-gray-400 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2 justify-end pt-3 border-t border-gray-300">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-500 text-white text-xs hover:bg-gray-600 border border-gray-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91]"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
