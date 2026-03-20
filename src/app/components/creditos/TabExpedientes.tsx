import { useState } from 'react';
import { toast } from 'sonner';

interface Archivo {
  id: number;
  fechaRegistro: string;
  usuario: string;
  archivo: string;
  tipoDocumento: string;
  descripcion: string;
  estatus: string;
  notas: string;
}

interface TabExpedientesProps {
  camposEditables: boolean;
  archivosExpediente: Archivo[];
  setArchivosExpediente: (archivos: Archivo[]) => void;
  setMostrarModalNuevoArchivo: (mostrar: boolean) => void;
}

export function TabExpedientes({
  camposEditables,
  archivosExpediente,
  setArchivosExpediente,
  setMostrarModalNuevoArchivo
}: TabExpedientesProps) {
  
  const [selectedArchivos, setSelectedArchivos] = useState<number[]>([]);
  const [mostrarModalURL, setMostrarModalURL] = useState(false);
  const [urlArchivo, setUrlArchivo] = useState('');
  const [showAdjuntarOptions, setShowAdjuntarOptions] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedArchivos(archivosExpediente.map(a => a.id));
    } else {
      setSelectedArchivos([]);
    }
  };

  const handleSelectArchivo = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedArchivos(prev => [...prev, id]);
    } else {
      setSelectedArchivos(prev => prev.filter(archId => archId !== id));
    }
  };

  const eliminarArchivos = () => {
    if (selectedArchivos.length === 0) {
      toast.error('Por favor seleccione al menos un registro para eliminar');
      return;
    }

    const archivosAEliminar = archivosExpediente.filter(a => selectedArchivos.includes(a.id));
    const archivosNoPendientes = archivosAEliminar.filter(a => a.estatus !== 'Pendiente');

    if (archivosNoPendientes.length > 0) {
      toast.error('Solo se pueden eliminar registros con estatus "Pendiente"');
      return;
    }

    setArchivosExpediente(archivosExpediente.filter(a => !selectedArchivos.includes(a.id)));
    const count = selectedArchivos.length;
    setSelectedArchivos([]);
    toast.success(`${count} archivo${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  const adjuntarDesdeEquipo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        // Obtener fecha y hora actual
        const ahora = new Date();
        const dia = ahora.getDate().toString().padStart(2, '0');
        const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
        const anio = ahora.getFullYear();
        const horas = ahora.getHours().toString().padStart(2, '0');
        const minutos = ahora.getMinutes().toString().padStart(2, '0');
        const fechaHora = `${dia}/${mes}/${anio} ${horas}:${minutos}`;
        
        const nuevoId = archivosExpediente.length > 0 
          ? Math.max(...archivosExpediente.map(a => a.id)) + 1 
          : 1;
        
        const nuevoArchivo = {
          id: nuevoId,
          fechaRegistro: fechaHora,
          usuario: 'admin',
          archivo: file.name,
          tipoDocumento: '',
          descripcion: '',
          estatus: 'Pendiente',
          notas: ''
        };
        
        setArchivosExpediente([...archivosExpediente, nuevoArchivo]);
        setShowAdjuntarOptions(false);
        toast.success(`Archivo "${file.name}" adjuntado exitosamente`);
      }
    };
    input.click();
  };

  const adjuntarDesdeWeb = () => {
    setMostrarModalURL(true);
    setShowAdjuntarOptions(false);
  };

  const guardarURL = () => {
    if (urlArchivo.trim()) {
      // Obtener fecha y hora actual
      const ahora = new Date();
      const dia = ahora.getDate().toString().padStart(2, '0');
      const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
      const anio = ahora.getFullYear();
      const horas = ahora.getHours().toString().padStart(2, '0');
      const minutos = ahora.getMinutes().toString().padStart(2, '0');
      const fechaHora = `${dia}/${mes}/${anio} ${horas}:${minutos}`;
      
      const nuevoId = archivosExpediente.length > 0 
        ? Math.max(...archivosExpediente.map(a => a.id)) + 1 
        : 1;
      
      const nombreArchivo = urlArchivo.split('/').pop() || 'archivo_web.pdf';
      
      const nuevoArchivo = {
        id: nuevoId,
        fechaRegistro: fechaHora,
        usuario: 'admin',
        archivo: nombreArchivo,
        tipoDocumento: 'Documento web',
        descripcion: '',
        estatus: 'Pendiente',
        notas: ''
      };
      
      setArchivosExpediente([...archivosExpediente, nuevoArchivo]);
      setMostrarModalURL(false);
      setUrlArchivo('');
      toast.success('Documento nuevo agregado exitosamente');
    } else {
      toast.error('Por favor ingrese una URL válida');
    }
  };

  return (
    <div className="p-4">
      {/* LAYOUT PRINCIPAL - DOS COLUMNAS */}
      <div className="grid grid-cols-[200px_1fr] gap-4">
        
        {/* COLUMNA IZQUIERDA - PANEL DE REQUISITOS */}
        <div className="bg-[#E7E6E6] border border-gray-300 rounded p-3">
          <h4 className="text-[11px] font-semibold text-gray-800 mb-3">Requisitos</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={archivosExpediente.some(a => a.tipoDocumento.includes('Identificación'))}
                disabled
                className="mt-0.5 w-3.5 h-3.5"
              />
              <label className="text-[10px] text-gray-700 leading-tight">
                Identificación Oficial (INE, Pasaporte, Credencial del INE)
              </label>
            </div>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={archivosExpediente.some(a => a.tipoDocumento.includes('domicilio'))}
                disabled
                className="mt-0.5 w-3.5 h-3.5"
              />
              <label className="text-[10px] text-gray-700 leading-tight">
                Comprobante de domicilio
              </label>
            </div>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={archivosExpediente.some(a => a.tipoDocumento.includes('cuenta bancaria'))}
                disabled
                className="mt-0.5 w-3.5 h-3.5"
              />
              <label className="text-[10px] text-gray-700 leading-tight">
                Estado de cuenta bancaria
              </label>
            </div>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={archivosExpediente.some(a => a.tipoDocumento.includes('Puntaje'))}
                disabled
                className="mt-0.5 w-3.5 h-3.5"
              />
              <label className="text-[10px] text-gray-700 leading-tight">
                Puntaje de Crédito
              </label>
            </div>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={archivosExpediente.some(a => a.tipoDocumento.includes('Autorización'))}
                disabled
                className="mt-0.5 w-3.5 h-3.5"
              />
              <label className="text-[10px] text-gray-700 leading-tight">
                Carta de Autorización del Crédito
              </label>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA - CONTENIDO PRINCIPAL */}
        <div>
          {/* ENCABEZADO CON TÍTULO Y BOTONES */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-800 mb-2">Expediente electrónico</h4>
            
            {/* BOTONES PRINCIPALES */}
            <div className="flex items-center gap-2 mb-2">
              <button
                className="px-4 py-1 bg-[#5B9BD5] text-white rounded text-[10px] hover:bg-[#4A8BC5] disabled:opacity-50"
                onClick={() => setShowAdjuntarOptions(!showAdjuntarOptions)}
                disabled={!camposEditables}
              >
                Nuevo
              </button>
              <button
                className="px-4 py-1 bg-white border border-gray-400 rounded text-[10px] hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                onClick={eliminarArchivos}
                disabled={!camposEditables}
              >
                Eliminar
              </button>
            </div>

            {/* ADJUNTAR DESDE - Mostrar solo cuando showAdjuntarOptions es true */}
            {showAdjuntarOptions && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-700 font-medium">Adjuntar desde:</span>
                <button
                  className="px-3 py-1 bg-gray-200 border border-gray-300 rounded text-[10px] hover:bg-gray-300 text-gray-600"
                  onClick={adjuntarDesdeEquipo}
                >
                  Equipo
                </button>
                <button
                  className="px-3 py-1 bg-gray-200 border border-gray-300 rounded text-[10px] hover:bg-gray-300 text-gray-600"
                  onClick={adjuntarDesdeWeb}
                >
                  Web
                </button>
              </div>
            )}
          </div>

          {/* TABLA DE ARCHIVOS */}
          <div className="overflow-hidden border border-gray-300 rounded">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-200 border-b border-gray-300">
                  <th className="px-2 py-2 text-center border-r border-gray-300 w-10">
                    <input
                      type="checkbox"
                      checked={archivosExpediente.length > 0 && selectedArchivos.length === archivosExpediente.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="px-2 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">Fecha y hora del registro</th>
                  <th className="px-2 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">Usuario que registró</th>
                  <th className="px-2 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">Archivo</th>
                  <th className="px-2 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">Tipo de Documento</th>
                  <th className="px-2 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">Descripción</th>
                  <th className="px-2 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">Estatus</th>
                  <th className="px-2 py-2 text-left font-semibold text-[10px] text-gray-700">Observaciones</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {archivosExpediente.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-xs">
                      No hay archivos en el expediente. Haz clic en "Nuevo" para agregar uno.
                    </td>
                  </tr>
                ) : (
                  archivosExpediente.map((archivo) => (
                    <tr 
                      key={archivo.id} 
                      className={`border-b border-gray-200 hover:bg-gray-50 ${selectedArchivos.includes(archivo.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-2 py-2 text-center border-r border-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedArchivos.includes(archivo.id)}
                          onChange={(e) => handleSelectArchivo(archivo.id, e.target.checked)}
                          className="cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-2 py-2 text-left text-gray-700 border-r border-gray-300 text-[10px]">{archivo.fechaRegistro}</td>
                      <td className="px-2 py-2 text-left text-gray-700 border-r border-gray-300 text-[10px]">{archivo.usuario}</td>
                      <td className="px-2 py-2 border-r border-gray-300">
                        <input
                          type="text"
                          value={archivo.archivo}
                          onChange={(e) => {
                            setArchivosExpediente(archivosExpediente.map(a => 
                              a.id === archivo.id ? { ...a, archivo: e.target.value } : a
                            ));
                          }}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-2 py-2 border-r border-gray-300">
                        <select
                          value={archivo.tipoDocumento}
                          onChange={(e) => {
                            setArchivosExpediente(archivosExpediente.map(a => 
                              a.id === archivo.id ? { ...a, tipoDocumento: e.target.value } : a
                            ));
                          }}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="">Seleccione...</option>
                          <option value="Identificación oficial">Identificación oficial</option>
                          <option value="Comprobante de domicilio">Comprobante de domicilio</option>
                          <option value="Estado de cuenta bancaria">Estado de cuenta bancaria</option>
                          <option value="Puntaje de Crédito">Puntaje de Crédito</option>
                          <option value="Carta de Autorización del Crédito">Carta de Autorización del Crédito</option>
                          <option value="Comprobante de ingresos">Comprobante de ingresos</option>
                          <option value="Documento web">Documento web</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 border-r border-gray-300">
                        <input
                          type="text"
                          value={archivo.descripcion}
                          onChange={(e) => {
                            setArchivosExpediente(archivosExpediente.map(a => 
                              a.id === archivo.id ? { ...a, descripcion: e.target.value } : a
                            ));
                          }}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                          placeholder="Descripción"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-2 py-2 border-r border-gray-300">
                        <select
                          value={archivo.estatus}
                          onChange={(e) => {
                            setArchivosExpediente(archivosExpediente.map(a => 
                              a.id === archivo.id ? { ...a, estatus: e.target.value } : a
                            ));
                          }}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="Pendiente">Pendiente</option>
                          <option value="Aprobado">Aprobado</option>
                          <option value="Rechazado">Rechazado</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={archivo.notas}
                          onChange={(e) => {
                            setArchivosExpediente(archivosExpediente.map(a => 
                              a.id === archivo.id ? { ...a, notas: e.target.value } : a
                            ));
                          }}
                          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                          placeholder="Sin observaciones"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL PARA INGRESAR URL */}
      {mostrarModalURL && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
          onClick={() => setMostrarModalURL(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl border border-gray-300" 
            style={{ width: '400px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado del modal */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#4A6FA5] text-white rounded-t-lg">
              <h3 className="text-sm font-semibold">Agregar Documento desde Web</h3>
              <button 
                onClick={() => {
                  setMostrarModalURL(false);
                  setUrlArchivo('');
                }}
                className="text-white hover:text-gray-200 text-lg font-bold leading-none"
              >
                ×
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6">
              <div>
                <label className="block text-xs text-gray-700 mb-1.5 font-medium">URL del Documento:</label>
                <input
                  type="text"
                  value={urlArchivo}
                  onChange={(e) => setUrlArchivo(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="https://ejemplo.com/archivo.pdf"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && urlArchivo.trim()) {
                      guardarURL();
                    }
                  }}
                />
              </div>
            </div>

            {/* Pie del modal - Botones */}
            <div className="flex justify-end gap-2 px-6 py-3 bg-gray-50 rounded-b-lg border-t border-gray-200">
              <button
                className="px-4 py-1.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-100 text-gray-700 font-medium"
                onClick={() => {
                  setMostrarModalURL(false);
                  setUrlArchivo('');
                }}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-1.5 bg-[#5B9BD5] text-white rounded text-xs hover:bg-[#4A8BC5] font-medium"
                onClick={guardarURL}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}