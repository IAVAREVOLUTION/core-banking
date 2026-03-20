import { useState } from 'react';
import { toast } from 'sonner';
import { Eye } from 'lucide-react';

interface Expediente {
  id: number;
  fechaHora: string;
  usuario: string;
  archivo: string;
  tipoDocumento: string;
  descripcion: string;
  estatus: string;
  observaciones: string;
  fileData?: string; // Base64 data o URL del archivo
}

interface ExpedientesElectronicosTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
}

export function ExpedientesElectronicosTab({ mode }: ExpedientesElectronicosTabProps) {
  const [selectedExpedientes, setSelectedExpedientes] = useState<number[]>([]);
  const [showWmdModal, setShowWmdModal] = useState(false);
  const [wmdUrl, setWmdUrl] = useState('');
  const [showAdjuntarOptions, setShowAdjuntarOptions] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [currentFile, setCurrentFile] = useState<Expediente | null>(null);
  const [expedientes, setExpedientes] = useState<Expediente[]>([
    {
      id: 1,
      fechaHora: '13/01/2025 10:30',
      usuario: 'Usuario Actual',
      archivo: 'ContratoAperturaCuenta.pdf',
      tipoDocumento: 'Contrato de apertura',
      descripcion: 'Contrato de apertura de cuenta de ahorro',
      estatus: 'Pendiente',
      observaciones: 'Sin Observaciones',
      fileData: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    }
  ]);

  const isReadOnly = mode === 'ver';

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedExpedientes(expedientes.map(e => e.id));
    } else {
      setSelectedExpedientes([]);
    }
  };

  const handleSelectExpediente = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedExpedientes(prev => [...prev, id]);
    } else {
      setSelectedExpedientes(prev => prev.filter(expId => expId !== id));
    }
  };

  return (
    <div className="flex-1">
      <div className="bg-gray-200 px-3 py-2 mb-2">
        <span className="text-xs font-medium text-gray-700">Expediente electrónico</span>
      </div>

      {/* Botones de Acción */}
      {!isReadOnly && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowAdjuntarOptions(!showAdjuntarOptions)}
            className="px-4 py-1.5 btn-secondary-theme text-xs font-medium rounded"
          >
            Nuevo
          </button>
          <button
            onClick={() => {
              if (selectedExpedientes.length === 0) {
                toast.error('Por favor seleccione al menos un registro para eliminar');
                return;
              }

              const expedientesAEliminar = expedientes.filter(e => selectedExpedientes.includes(e.id));
              const expedientesNoPendientes = expedientesAEliminar.filter(e => e.estatus !== 'Pendiente');

              if (expedientesNoPendientes.length > 0) {
                toast.error('Solo se pueden eliminar registros con estatus "Pendiente"');
                return;
              }

              setExpedientes(prev => prev.filter(e => !selectedExpedientes.includes(e.id)));
              const count = selectedExpedientes.length;
              setSelectedExpedientes([]);
              toast.success(`${count} expediente${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
            }}
            className="px-4 py-1.5 border border-gray-400 text-gray-700 text-xs font-medium rounded hover:bg-gray-100"
          >
            Eliminar
          </button>
        </div>
      )}

      {/* Título y Botones - Se muestran solo cuando showAdjuntarOptions es true */}
      {showAdjuntarOptions && !isReadOnly && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-700 font-medium">Adjuntar desde:</span>
          <label 
            className="px-3 py-1.5 border border-gray-300 text-xs rounded bg-gray-200 text-gray-600 cursor-pointer hover:bg-gray-300"
          >
            Equipo
            <input 
              type="file" 
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Crear URL del objeto para visualización
                  const fileUrl = URL.createObjectURL(file);
                  
                  const newExpediente: Expediente = {
                    id: expedientes.length + 1,
                    fechaHora: new Date().toLocaleString('es-MX', { 
                      year: 'numeric', 
                      month: '2-digit', 
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    }),
                    usuario: 'Usuario Actual',
                    tipoDocumento: 'Documento web',
                    archivo: file.name,
                    descripcion: '',
                    estatus: 'Pendiente',
                    observaciones: '',
                    fileData: fileUrl
                  };
                  setExpedientes(prev => [...prev, newExpediente]);
                  setShowAdjuntarOptions(false);
                  toast.success(`Archivo "${file.name}" adjuntado exitosamente`);
                }
              }}
            />
          </label>
          <button 
            onClick={() => {
              setShowWmdModal(true);
              setShowAdjuntarOptions(false);
            }}
            className="px-3 py-1.5 border border-gray-300 text-xs rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
          >
            Web
          </button>
        </div>
      )}

      {/* Tabla de Expedientes */}
      <div className="overflow-hidden border border-gray-300 bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {!isReadOnly && (
                <th className="border-b border-gray-300 px-2 py-1.5 text-center w-10">
                  <input
                    type="checkbox"
                    checked={expedientes.length > 0 && selectedExpedientes.length === expedientes.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="cursor-pointer"
                  />
                </th>
              )}
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Fecha y hora del registro</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Usuario que registró</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Archivo</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Tipo de Documento</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Descripción</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Estatus</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Observaciones</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-center text-xs font-medium text-gray-700 w-24">Visualizar</th>
            </tr>
          </thead>
          <tbody>
            {expedientes.map(expediente => (
              <tr 
                key={expediente.id} 
                className={`hover:bg-gray-50 ${selectedExpedientes.includes(expediente.id) ? 'bg-blue-50' : ''}`}
              >
                {!isReadOnly && (
                  <td className="border-b border-gray-200 px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedExpedientes.includes(expediente.id)}
                      onChange={(e) => handleSelectExpediente(expediente.id, e.target.checked)}
                      className="cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">{expediente.fechaHora}</td>
                <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">{expediente.usuario}</td>
                <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">
                  <input 
                    type="text"
                    value={expediente.archivo}
                    onChange={(e) => {
                      setExpedientes(prev => prev.map(exp => 
                        exp.id === expediente.id ? { ...exp, archivo: e.target.value } : exp
                      ));
                    }}
                    disabled={isReadOnly}
                    className={`w-full px-1 py-0.5 text-xs border ${isReadOnly ? 'border-0 bg-transparent' : 'border-gray-300'} rounded`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="border-b border-gray-200 px-2 py-1.5">
                  <select 
                    value={expediente.tipoDocumento}
                    onChange={(e) => {
                      setExpedientes(prev => prev.map(exp => 
                        exp.id === expediente.id ? { ...exp, tipoDocumento: e.target.value } : exp
                      ));
                    }}
                    disabled={isReadOnly}
                    className={`w-full px-1 py-0.5 text-xs border ${isReadOnly ? 'border-0 bg-transparent' : 'border-gray-300'} rounded`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">Seleccione...</option>
                    <option>Credencial de elector</option>
                    <option>Pasaporte</option>
                    <option>Licencia de conducir</option>
                    <option>Cartilla militar</option>
                    <option>Visa</option>
                    <option>Tarjeta de residencia</option>
                    <option>Cédula de ciudadanía</option>
                    <option>Registro Federal de Contribuyentes (RFC)</option>
                    <option>Número de Identificación Personal (NIP)</option>
                    <option>Documento migratorio</option>
                    <option>Documento de propiedad</option>
                    <option>Estado de cuenta bancario</option>
                    <option>Comprobante de domicilio</option>
                    <option>Certificado de nacimiento</option>
                    <option>Certificado de matrimonio</option>
                    <option>Certificado de defunción</option>
                  </select>
                </td>
                <td className="border-b border-gray-200 px-2 py-1.5">
                  <input 
                    type="text"
                    value={expediente.descripcion}
                    onChange={(e) => {
                      setExpedientes(prev => prev.map(exp => 
                        exp.id === expediente.id ? { ...exp, descripcion: e.target.value } : exp
                      ));
                    }}
                    disabled={isReadOnly}
                    className={`w-full px-1 py-0.5 text-xs border ${isReadOnly ? 'border-0 bg-transparent' : 'border-gray-300'} rounded`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="border-b border-gray-200 px-2 py-1.5">
                  <select 
                    value={expediente.estatus}
                    onChange={(e) => {
                      setExpedientes(prev => prev.map(exp => 
                        exp.id === expediente.id ? { ...exp, estatus: e.target.value } : exp
                      ));
                    }}
                    disabled={isReadOnly}
                    className={`w-full px-1 py-0.5 text-xs border ${isReadOnly ? 'border-0 bg-transparent' : 'border-gray-300'} rounded`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option>Pendiente</option>
                    <option>Aprobado</option>
                    <option>Rechazado</option>
                  </select>
                </td>
                <td className="border-b border-gray-200 px-2 py-1.5">
                  <input 
                    type="text"
                    value={expediente.observaciones}
                    onChange={(e) => {
                      setExpedientes(prev => prev.map(exp => 
                        exp.id === expediente.id ? { ...exp, observaciones: e.target.value } : exp
                      ));
                    }}
                    disabled={isReadOnly}
                    className={`w-full px-1 py-0.5 text-xs border ${isReadOnly ? 'border-0 bg-transparent' : 'border-gray-300'} rounded`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="border-b border-gray-200 px-2 py-1.5 text-center">
                  <button
                    onClick={() => {
                      setCurrentFile(expediente);
                      setShowViewer(true);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal para agregar documento desde Web */}
      {showWmdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">Agregar Documento desde Web</h3>
              <button
                onClick={() => {
                  setShowWmdModal(false);
                  setWmdUrl('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                URL del Documento
              </label>
              <input
                type="text"
                value={wmdUrl}
                onChange={(e) => setWmdUrl(e.target.value)}
                placeholder="https://ejemplo.com/documento.pdf"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && wmdUrl.trim()) {
                    const newExpediente: Expediente = {
                      id: expedientes.length + 1,
                      fechaHora: new Date().toLocaleString('es-MX', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }),
                      usuario: 'Usuario Actual',
                      tipoDocumento: 'Documento web',
                      archivo: wmdUrl,
                      descripcion: '',
                      estatus: 'Pendiente',
                      observaciones: '',
                      fileData: wmdUrl
                    };
                    setExpedientes(prev => [...prev, newExpediente]);
                    setShowWmdModal(false);
                    setWmdUrl('');
                    toast.success('Documento nuevo agregado exitosamente');
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowWmdModal(false);
                  setWmdUrl('');
                }}
                className="px-4 py-2 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (wmdUrl.trim()) {
                    const newExpediente: Expediente = {
                      id: expedientes.length + 1,
                      fechaHora: new Date().toLocaleString('es-MX', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }),
                      usuario: 'Usuario Actual',
                      tipoDocumento: 'Documento web',
                      archivo: wmdUrl,
                      descripcion: '',
                      estatus: 'Pendiente',
                      observaciones: '',
                      fileData: wmdUrl
                    };
                    setExpedientes(prev => [...prev, newExpediente]);
                    setShowWmdModal(false);
                    setWmdUrl('');
                    toast.success('Documento nuevo agregado exitosamente');
                  }
                }}
                className="px-4 py-2 text-xs btn-secondary-theme rounded"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver el archivo */}
      {showViewer && currentFile && (() => {
        const fileExtension = currentFile.archivo.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension);
        const isPDF = fileExtension === 'pdf';
        const canPreview = isImage || isPDF;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#5B9BD5]" />
                  <h3 className="text-sm font-semibold text-gray-800">Visualizador de Documento</h3>
                </div>
                <button
                  onClick={() => {
                    setShowViewer(false);
                    setCurrentFile(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                  </svg>
                </button>
              </div>

              {/* Info del archivo */}
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-medium text-gray-700">Archivo:</span>
                    <span className="ml-2 text-gray-600">{currentFile.archivo}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tipo:</span>
                    <span className="ml-2 text-gray-600">{currentFile.tipoDocumento}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Fecha:</span>
                    <span className="ml-2 text-gray-600">{currentFile.fechaHora}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Usuario:</span>
                    <span className="ml-2 text-gray-600">{currentFile.usuario}</span>
                  </div>
                </div>
              </div>

              {/* Contenedor del visor */}
              <div className="flex-1 overflow-auto p-6 bg-gray-100">
                {canPreview ? (
                  <div className="bg-white rounded border border-gray-300 h-full flex items-center justify-center">
                    {isImage && currentFile.fileData && (
                      <img 
                        src={currentFile.fileData} 
                        alt={currentFile.archivo}
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                    {isPDF && currentFile.fileData && (
                      <iframe
                        src={currentFile.fileData}
                        className="w-full h-full min-h-[500px]"
                        title={currentFile.archivo}
                      />
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded border border-gray-300 h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="mb-4">
                      <svg className="w-16 h-16 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Vista previa no disponible</p>
                    <p className="text-xs text-gray-500 mb-4">Este tipo de archivo no se puede visualizar en el navegador</p>
                    {currentFile.fileData && (
                      <a
                        href={currentFile.fileData}
                        download={currentFile.archivo}
                        className="px-4 py-2 text-xs btn-secondary-theme rounded"
                      >
                        Descargar Archivo
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-600">
                  {currentFile.descripcion && (
                    <span><span className="font-medium">Descripción:</span> {currentFile.descripcion}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentFile.fileData && (
                    <a
                      href={currentFile.fileData}
                      download={currentFile.archivo}
                      className="px-4 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Descargar
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setShowViewer(false);
                      setCurrentFile(null);
                    }}
                    className="px-4 py-2 text-xs btn-secondary-theme rounded"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}