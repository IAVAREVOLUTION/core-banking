import { useState } from 'react';

interface TabCargosProps {
  mode: 'nuevo' | 'editar' | 'ver';
  camposEditables: boolean;
}

interface Cargo {
  id: number;
  tipoCargo: string;
  descripcion: string;
  monto: string;
  fechaCargo: string;
  estatus: string;
  notas: string;
}

export function TabCargos({ mode, camposEditables }: TabCargosProps) {
  const [cargos, setCargos] = useState<Cargo[]>(
    mode === 'nuevo' ? [] : [
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
      }
    ]
  );

  const [mostrarModal, setMostrarModal] = useState(false);
  const [cargoSeleccionado, setCargoSeleccionado] = useState<number | null>(null);
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  
  const [nuevoCargo, setNuevoCargo] = useState({
    tipoCargo: '',
    descripcion: '',
    monto: '',
    fechaCargo: '',
    estatus: 'Pendiente',
    notas: ''
  });

  const handleNuevo = () => {
    setNuevoCargo({
      tipoCargo: '',
      descripcion: '',
      monto: '',
      fechaCargo: '',
      estatus: 'Pendiente',
      notas: ''
    });
    setMostrarModal(true);
  };

  const handleEliminar = () => {
    if (cargoSeleccionado === null) {
      alert('Seleccione un cargo para eliminar');
      return;
    }

    const cargo = cargos.find(c => c.id === cargoSeleccionado);
    if (cargo && cargo.estatus !== 'Pendiente') {
      alert('Solo se pueden eliminar cargos con estatus "Pendiente"');
      return;
    }

    setMostrarModalEliminar(true);
  };

  const confirmarEliminar = () => {
    setCargos(cargos.filter(c => c.id !== cargoSeleccionado));
    setCargoSeleccionado(null);
    setMostrarModalEliminar(false);
  };

  const handleAgregarCargo = () => {
    if (!nuevoCargo.tipoCargo || !nuevoCargo.descripcion || !nuevoCargo.monto || !nuevoCargo.fechaCargo) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }

    const nuevoCargoConId = {
      ...nuevoCargo,
      id: cargos.length > 0 ? Math.max(...cargos.map(c => c.id)) + 1 : 1
    };

    setCargos([...cargos, nuevoCargoConId]);
    setMostrarModal(false);
  };

  const handleUpdateCargo = (id: number, field: string, value: string) => {
    setCargos(cargos.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // Determinar si los campos son de solo lectura
  const isReadOnly = mode === 'ver' || !camposEditables;

  return (
    <div className="bg-white p-3 border border-gray-200">
      {/* Botones Nuevo y Eliminar */}
      <div className="flex gap-2 mb-3">
        <button 
          onClick={handleNuevo}
          disabled={isReadOnly}
          className="px-4 py-1.5 bg-[#5B9BD5] text-white text-xs font-normal rounded hover:bg-[#4A8BC2] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Nuevo
        </button>
        <button 
          onClick={handleEliminar}
          disabled={isReadOnly}
          className="px-4 py-1.5 bg-gray-200 text-gray-700 text-xs font-normal border border-gray-400 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Eliminar
        </button>
      </div>

      {/* Tabla de Cargos */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#D3D3D3]">
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800 w-12"></th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Tipo de cargo</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Descripción</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Monto</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Fecha de cargo</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Estatus</th>
              <th className="border border-gray-400 px-3 py-2 text-left font-normal text-gray-800">Notas</th>
            </tr>
          </thead>
          <tbody>
            {cargos.length === 0 ? (
              <tr>
                <td colSpan={7} className="border border-gray-400 px-3 py-8 text-center text-gray-400">
                  No hay cargos registrados
                </td>
              </tr>
            ) : (
              cargos.map((cargo) => (
                <tr key={cargo.id} className="hover:bg-gray-50">
                  <td className="border border-gray-400 px-3 py-2 text-center">
                    <input
                      type="radio"
                      name="cargoSeleccionado"
                      checked={cargoSeleccionado === cargo.id}
                      onChange={() => setCargoSeleccionado(cargo.id)}
                      className="w-4 h-4"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="border border-gray-400 px-3 py-2">
                    <select 
                      value={cargo.tipoCargo}
                      onChange={(e) => handleUpdateCargo(cargo.id, 'tipoCargo', e.target.value)}
                      disabled={isReadOnly}
                      className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none"
                    >
                      <option>Comisión por apertura</option>
                      <option>Seguro de vida</option>
                      <option>Gastos administrativos</option>
                      <option>Avalúo</option>
                      <option>Investigación</option>
                    </select>
                  </td>
                  <td className="border border-gray-400 px-3 py-2">{cargo.descripcion}</td>
                  <td className="border border-gray-400 px-3 py-2">{cargo.monto}</td>
                  <td className="border border-gray-400 px-3 py-2">{cargo.fechaCargo}</td>
                  <td className="border border-gray-400 px-3 py-2">
                    <select 
                      value={cargo.estatus}
                      onChange={(e) => handleUpdateCargo(cargo.id, 'estatus', e.target.value)}
                      disabled={isReadOnly}
                      className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none"
                    >
                      <option>Pendiente</option>
                      <option>Aplicado</option>
                      <option>Cancelado</option>
                    </select>
                  </td>
                  <td className="border border-gray-400 px-3 py-2">{cargo.notas}</td>
                </tr>
              ))
            )}
            {/* Fila vacía para agregar más */}
            {cargos.length > 0 && (
              <tr className="hover:bg-gray-50">
                <td className="border border-gray-400 px-3 py-2 text-center">
                  <input
                    type="radio"
                    name="cargoSeleccionado"
                    disabled
                    className="w-4 h-4"
                  />
                </td>
                <td className="border border-gray-400 px-3 py-2">
                  <select 
                    disabled={isReadOnly}
                    className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none"
                  >
                    <option></option>
                  </select>
                </td>
                <td className="border border-gray-400 px-3 py-2"></td>
                <td className="border border-gray-400 px-3 py-2"></td>
                <td className="border border-gray-400 px-3 py-2"></td>
                <td className="border border-gray-400 px-3 py-2">
                  <select 
                    disabled={isReadOnly}
                    className="w-full px-2 py-1 text-xs border-0 bg-white focus:outline-none"
                  >
                    <option></option>
                  </select>
                </td>
                <td className="border border-gray-400 px-3 py-2"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Cargo */}
      {mostrarModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999]" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div 
            className="bg-white rounded shadow-2xl w-full max-w-xl border-2 border-gray-400"
            style={{
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            {/* Header */}
            <div className="bg-[#4A6FA5] px-3 py-1.5 flex items-center justify-between">
              <h3 className="text-xs font-normal text-white">Nuevo Cargo</h3>
              <button 
                onClick={() => setMostrarModal(false)}
                className="text-white hover:bg-red-500 w-5 h-5 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 bg-gray-50">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-normal text-gray-700 mb-1">
                    Tipo de Cargo <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={nuevoCargo.tipoCargo}
                    onChange={(e) => setNuevoCargo(prev => ({ ...prev, tipoCargo: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 bg-white"
                  >
                    <option value="">Seleccione...</option>
                    <option>Comisión por apertura</option>
                    <option>Seguro de vida</option>
                    <option>Gastos administrativos</option>
                    <option>Avalúo</option>
                    <option>Investigación</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-normal text-gray-700 mb-1">
                    Descripción <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text"
                    maxLength={255}
                    value={nuevoCargo.descripcion}
                    onChange={(e) => setNuevoCargo(prev => ({ ...prev, descripcion: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 bg-white"
                    placeholder="Ingrese la descripción del cargo"
                  />
                </div>

                <div>
                  <label className="block text-xs font-normal text-gray-700 mb-1">
                    Monto <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text"
                    value={nuevoCargo.monto}
                    onChange={(e) => setNuevoCargo(prev => ({ ...prev, monto: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 bg-white"
                    placeholder="$0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-normal text-gray-700 mb-1">
                    Fecha de Cargo <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="date"
                    value={nuevoCargo.fechaCargo}
                    onChange={(e) => setNuevoCargo(prev => ({ ...prev, fechaCargo: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-normal text-gray-700 mb-1">
                    Estatus <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={nuevoCargo.estatus}
                    onChange={(e) => setNuevoCargo(prev => ({ ...prev, estatus: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 bg-white"
                  >
                    <option>Pendiente</option>
                    <option>Aplicado</option>
                    <option>Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-normal text-gray-700 mb-1">
                    Notas / Observaciones
                  </label>
                  <textarea 
                    value={nuevoCargo.notas}
                    onChange={(e) => setNuevoCargo(prev => ({ ...prev, notas: e.target.value }))}
                    maxLength={255}
                    rows={3}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 bg-white resize-none"
                    placeholder="Ingrese notas u observaciones adicionales"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 flex justify-center gap-3 border-t border-gray-300">
              <button
                onClick={handleAgregarCargo}
                className="px-6 py-1.5 border border-gray-400 bg-gray-200 text-gray-800 text-xs font-normal hover:bg-gray-300"
              >
                Agregar
              </button>
              <button
                onClick={() => setMostrarModal(false)}
                className="px-6 py-1.5 border border-gray-400 bg-gray-200 text-gray-800 text-xs font-normal hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {mostrarModalEliminar && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999]" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div 
            className="bg-white rounded shadow-2xl w-full max-w-md border-2 border-gray-400"
            style={{
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            <div className="bg-[#4A6FA5] px-3 py-1.5">
              <h3 className="text-xs font-normal text-white">Confirmar Eliminación</h3>
            </div>
            <div className="p-4 bg-gray-50">
              <p className="text-sm text-gray-700">¿Desea eliminar el cargo seleccionado?</p>
            </div>
            <div className="px-4 py-3 bg-gray-50 flex justify-center gap-3 border-t border-gray-300">
              <button
                onClick={confirmarEliminar}
                className="px-6 py-1.5 border border-gray-400 bg-gray-200 text-gray-800 text-xs font-normal hover:bg-gray-300"
              >
                Confirmar
              </button>
              <button
                onClick={() => setMostrarModalEliminar(false)}
                className="px-6 py-1.5 border border-gray-400 bg-gray-200 text-gray-800 text-xs font-normal hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
