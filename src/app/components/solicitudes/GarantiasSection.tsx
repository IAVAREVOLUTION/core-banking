interface GarantiasSectionProps {
  onOpenModal: () => void;
}

export function GarantiasSection({ onOpenModal }: GarantiasSectionProps) {
  return (
    <div className="bg-white p-3 border border-gray-200">
      {/* Botones Guardar y Eliminar */}
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
            <tr>
              <td className="border border-gray-400 px-2 py-1">
                <input type="checkbox" className="mr-1.5" />
                <select className="inline w-[calc(100%-24px)] px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Mueble</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Automóvil</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-[calc(100%-30px)] inline px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>GAR-006-Inventario-Retail</option>
                </select>
                <button onClick={onOpenModal} className="inline px-1.5 text-xs hover:bg-gray-100">...</button>
              </td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">$850,000.00</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Inventario completo de mercancía en tienda...</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Plaza Comercial Centro, Monterrey...</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1">
                <input type="checkbox" className="mr-1.5" />
                <select className="inline w-[calc(100%-24px)] px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Inmueble</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Departamento</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-[calc(100%-30px)] inline px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>GAR-007-Casa-Guadalajara</option>
                </select>
                <button onClick={onOpenModal} className="inline px-1.5 text-xs hover:bg-gray-100">...</button>
              </td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">$3,250,000.00</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Casa habitación de 3 recámaras, 2 baños co...</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Colonia Chapalita, Guadalajara, Jal...</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1">
                <input type="checkbox" className="mr-1.5" />
                <select className="inline w-[calc(100%-24px)] px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Inmueble</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Departamento</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-[calc(100%-30px)] inline px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Seleccione</option>
                </select>
                <button onClick={onOpenModal} className="inline px-1.5 text-xs hover:bg-gray-100">...</button>
              </td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">$1,200,000.00</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Esc departamento de 3 habita Lomas y 100...</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Refundir, municipio CDAM</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1">
                <input type="checkbox" className="mr-1.5" />
                <select className="inline w-[calc(100%-24px)] px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Mueble</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Maquinaria</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-[calc(100%-30px)] inline px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>GAR-005-Tractor-Caterpillar</option>
                </select>
                <button onClick={onOpenModal} className="inline px-1.5 text-xs hover:bg-gray-100">...</button>
              </td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">$1,500,000.00</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">El Tractor Caterpillar de color amarillo con ca...</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Garage de la Rimada El Rincón, Sa...</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1">
                <input type="checkbox" className="mr-1.5" />
                <select className="inline w-[calc(100%-24px)] px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Mueble</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Automóvil</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-[calc(100%-30px)] inline px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>GAR-004-Automóvil-Mazda3</option>
                </select>
                <button onClick={onOpenModal} className="inline px-1.5 text-xs hover:bg-gray-100">...</button>
              </td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">$218,500.00</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Mazda 3 2020 en un estado propietario 3 años...</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">CP 33000 Colonia Los Flores, CP-61800...</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1">
                <input type="checkbox" className="mr-1.5" />
                <select className="inline w-[calc(100%-24px)] px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Inmueble</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Terreno</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-[calc(100%-30px)] inline px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>GAR-003-Terreno-San-Luis</option>
                </select>
                <button onClick={onOpenModal} className="inline px-1.5 text-xs hover:bg-gray-100">...</button>
              </td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">$200.00</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Casa para particular de 3 habitaciones y 200...</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">La tienda San Luis Nuevo</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1">
                <input type="checkbox" className="mr-1.5" />
                <select className="inline w-[calc(100%-24px)] px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Inmueble</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Departamento</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-[calc(100%-30px)] inline px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>GAR-002-Departamento</option>
                </select>
                <button onClick={onOpenModal} className="inline px-1.5 text-xs hover:bg-gray-100">...</button>
              </td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">$2,100,250.50</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Casa para particular de 2 habitaciones y 200...</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Granjas de Allende San Luis Rincón</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1">
                <input type="checkbox" className="mr-1.5" />
                <select className="inline w-[calc(100%-24px)] px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Mueble</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>Automóvil</option>
                </select>
              </td>
              <td className="border border-gray-400 px-2 py-1">
                <select className="w-[calc(100%-30px)] inline px-2 py-1 text-xs border-0 bg-white focus:outline-none">
                  <option>GAR-001-Automóvil</option>
                </select>
                <button onClick={onOpenModal} className="inline px-1.5 text-xs hover:bg-gray-100">...</button>
              </td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">$189,150.00</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Vehículo marca Chevrolet modelo Aveo 2021...</td>
              <td className="border border-gray-400 px-2 py-1 bg-gray-100">Calle Alem 6710 Plaza CP-Rivas Ave...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}