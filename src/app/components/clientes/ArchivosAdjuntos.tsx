import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Eye, X } from 'lucide-react';

interface ArchivosAdjuntosProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
}

interface ArchivoAdjunto {
  id: number;
  fileName: string;
  documentType: string;
  description: string;
  uploadDate: string;
  uploadedBy: string;
  status: string;
  fileData?: string;
}

interface ImagenClave {
  ineImage: File | null;
  selfieImage: File | null;
  actaImage: File | null;
}

interface ValidationResult {
  faceMatchScore: number | null;
  faceMatchResult: 'Coincide' | 'No coincide' | 'Parcial' | '';
  nameMatchResult: 'Nombre coincide' | 'No coincide' | 'Parcial' | '';
  legalRepValidated: 'Sí' | 'No' | '';
  validationNotes: string;
}

export function ArchivosAdjuntos({ onBack, mode, clienteId }: ArchivosAdjuntosProps) {
  const isView = mode === 'ver';

  // Estado con persistencia en sessionStorage usando clienteId
  const storageKey = `cliente_${clienteId || 'temp'}_archivos`;
  
  // SIEMPRE inicia vacío. Datos se cargan solo desde sessionStorage vinculado al clienteId.
  const [archivos, setArchivos] = useState<ArchivoAdjunto[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [selectedArchivos, setSelectedArchivos] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'crear' | 'editar'>('crear');
  const [editingArchivo, setEditingArchivo] = useState<ArchivoAdjunto | null>(null);
  const [newArchivo, setNewArchivo] = useState({
    fileName: '',
    documentType: '',
    description: '',
    status: 'Activo'
  });

  // Persistir cambios en sessionStorage usando clienteId
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(archivos));
  }, [archivos, storageKey]);

  const handleSelectArchivo = (id: number) => {
    setSelectedArchivos(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedArchivos.length === archivos.length) {
      setSelectedArchivos([]);
    } else {
      setSelectedArchivos(archivos.map(a => a.id));
    }
  };

  const handleNuevo = () => {
    setModalMode('crear');
    setNewArchivo({
      fileName: '',
      documentType: '',
      description: '',
      status: 'Activo'
    });
    setShowModal(true);
  };

  const handleEliminar = () => {
    if (selectedArchivos.length === 0) {
      toast.error('Debe seleccionar al menos un archivo para eliminar');
      return;
    }

    if (window.confirm(`¿Está seguro de eliminar ${selectedArchivos.length} archivo(s)?`)) {
      setArchivos(prev => prev.filter(a => !selectedArchivos.includes(a.id)));
      setSelectedArchivos([]);
      toast.success('Archivo(s) eliminado(s) exitosamente');
    }
  };

  const handleGuardarArchivo = () => {
    if (!newArchivo.fileName.trim() || !newArchivo.documentType.trim()) {
      toast.error('Debe completar los campos obligatorios (Nombre del archivo y Tipo de documento)');
      return;
    }

    if (modalMode === 'crear') {
      const nuevo: ArchivoAdjunto = {
        id: Math.max(0, ...archivos.map(a => a.id)) + 1,
        fileName: newArchivo.fileName,
        documentType: newArchivo.documentType,
        description: newArchivo.description,
        uploadDate: new Date().toLocaleString('es-MX', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        uploadedBy: 'admin',
        status: newArchivo.status,
        fileData: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      };
      setArchivos(prev => [...prev, nuevo]);
      toast.success('Archivo agregado exitosamente');
    }

    setShowModal(false);
  };

  const [imagenesClaves, setImagenesClaves] = useState<ImagenClave>({
    ineImage: null,
    selfieImage: null,
    actaImage: null
  });

  const [validationResult, setValidationResult] = useState<ValidationResult>({
    faceMatchScore: null,
    faceMatchResult: '',
    nameMatchResult: '',
    legalRepValidated: '',
    validationNotes: ''
  });

  const [validationExecuted, setValidationExecuted] = useState(false);

  const [previews, setPreviews] = useState<{
    ine: string | null;
    selfie: string | null;
    acta: string | null;
  }>({
    ine: null,
    selfie: null,
    acta: null
  });

  const [showViewer, setShowViewer] = useState(false);
  const [currentFile, setCurrentFile] = useState<ArchivoAdjunto | null>(null);

  const fileInputRefs = {
    ine: useRef<HTMLInputElement>(null),
    selfie: useRef<HTMLInputElement>(null),
    acta: useRef<HTMLInputElement>(null)
  };

  const handleViewFile = (archivo: ArchivoAdjunto) => {
    setCurrentFile(archivo);
    setShowViewer(true);
  };

  const handleImageUpload = (type: 'ine' | 'selfie' | 'acta', file: File | null) => {
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (type === 'ine' || type === 'selfie') {
      if (!['jpg', 'jpeg', 'png'].includes(extension || '')) {
        toast.error('INE y Selfie deben estar en formato imagen (JPG/PNG)');
        return;
      }
    } else if (type === 'acta') {
      if (!['jpg', 'jpeg', 'png', 'pdf'].includes(extension || '')) {
        toast.error('Acta Constitutiva debe estar en formato imagen o PDF');
        return;
      }
    }

    // Crear preview para imágenes
    if (['jpg', 'jpeg', 'png'].includes(extension || '')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => ({ ...prev, [type]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      // Para PDF, guardar null en preview
      setPreviews(prev => ({ ...prev, [type]: null }));
    }

    if (type === 'ine') {
      setImagenesClaves({ ...imagenesClaves, ineImage: file });
    } else if (type === 'selfie') {
      setImagenesClaves({ ...imagenesClaves, selfieImage: file });
    } else if (type === 'acta') {
      setImagenesClaves({ ...imagenesClaves, actaImage: file });
    }

    toast.success(`${type === 'ine' ? 'INE' : type === 'selfie' ? 'Selfie' : 'Acta Constitutiva'} cargada exitosamente`);
  };

  const handleEjecutarValidacion = () => {
    if (!imagenesClaves.ineImage || !imagenesClaves.selfieImage || !imagenesClaves.actaImage) {
      toast.error('Debe cargar los tres documentos (INE, Selfie y Acta Constitutiva) para ejecutar la validación');
      return;
    }

    toast.info('Ejecutando validación automática por IA...');

    setTimeout(() => {
      // Simulación de validación automática
      const score = Math.floor(Math.random() * 30) + 70; // 70-100
      const faceResult = score >= 70 ? 'Coincide' : 'No coincide';
      const nameResult = Math.random() > 0.3 ? 'Nombre coincide' : 'No coincide';
      const legalValidated = nameResult === 'Nombre coincide' && faceResult === 'Coincide' ? 'Sí' : 'No';

      const notes = `Validación ejecutada el ${new Date().toLocaleString('es-MX')}. 
Análisis facial completado con confianza del ${score}%. 
Análisis de nombre mediante OCR completado. 
${legalValidated === 'Sí' ? 'La identidad del representante legal ha sido verificada exitosamente.' : 'Se requiere revisión manual de la documentación.'}`;

      setValidationResult({
        faceMatchScore: score,
        faceMatchResult: faceResult,
        nameMatchResult: nameResult,
        legalRepValidated: legalValidated,
        validationNotes: notes
      });

      setValidationExecuted(true);
      toast.success('Validación completada exitosamente');
    }, 2000);
  };

  const inputClassName = (isReadOnly: boolean) => {
    if (isView || mode === 'editar') {
      return isReadOnly 
        ? 'flex-1 px-2 py-1 text-xs border-0 bg-transparent text-gray-700 cursor-default'
        : 'flex-1 px-2 py-1 text-xs border-0 bg-transparent text-gray-700';
    }
    return 'flex-1 px-2 py-1 text-xs border border-gray-400 rounded bg-white';
  };

  const [showAdjuntarOptions, setShowAdjuntarOptions] = useState(false);
  const [showWmdModal, setShowWmdModal] = useState(false);
  const [wmdUrl, setWmdUrl] = useState('');

  return (
    <div className="bg-white">
      {/* SECCIÓN 1 — ARCHIVOS ADJUNTOS (DISEÑO EXACTO DE PROSPECTOS) */}
      <div className="mb-4">
        {/* Título y botones al mismo nivel */}
        <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-800">ARCHIVOS ADJUNTOS</span>
          {!isView && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdjuntarOptions(!showAdjuntarOptions)}
                className="px-4 py-1.5 btn-secondary-theme text-xs font-medium rounded"
              >
                Nuevo
              </button>
              <button
                onClick={() => {
                  if (selectedArchivos.length === 0) {
                    toast.error('Por favor seleccione al menos un registro para eliminar');
                    return;
                  }

                  const archivosAEliminar = archivos.filter(a => selectedArchivos.includes(a.id));
                  const archivosNoActivos = archivosAEliminar.filter(a => a.status !== 'Activo');

                  if (archivosNoActivos.length > 0) {
                    toast.error('Solo se pueden eliminar registros con estatus "Activo"');
                    return;
                  }

                  setArchivos(prev => prev.filter(a => !selectedArchivos.includes(a.id)));
                  const count = selectedArchivos.length;
                  setSelectedArchivos([]);
                  toast.success(`${count} archivo${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
                }}
                className="px-4 py-1.5 btn-secondary-theme text-xs font-medium rounded"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>

        {/* Título y Botones - Se muestran solo cuando showAdjuntarOptions es true */}
        {showAdjuntarOptions && (
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
                    
                    const newArchivo: ArchivoAdjunto = {
                      id: archivos.length + 1,
                      fileName: file.name,
                      documentType: 'Documento',
                      description: '',
                      uploadDate: new Date().toLocaleString('es-MX', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }),
                      uploadedBy: 'Usuario Actual',
                      status: 'Activo',
                      fileData: fileUrl
                    };
                    setArchivos(prev => [...prev, newArchivo]);
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

        {/* Tabla de Archivos */}
        <div className="overflow-hidden border border-gray-300 bg-white">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {!isView && (
                  <th className="border-b border-gray-300 px-2 py-1.5 text-center w-10">
                    <input
                      type="checkbox"
                      checked={archivos.length > 0 && selectedArchivos.length === archivos.length}
                      onChange={(e) => handleSelectAll()}
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
              {archivos.map(archivo => (
                <tr 
                  key={archivo.id} 
                  className={`hover:bg-gray-50 ${selectedArchivos.includes(archivo.id) ? 'bg-blue-50' : ''}`}
                >
                  {!isView && (
                    <td className="border-b border-gray-200 px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedArchivos.includes(archivo.id)}
                        onChange={() => handleSelectArchivo(archivo.id)}
                        className="cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">{archivo.uploadDate}</td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">{archivo.uploadedBy}</td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">
                    {archivo.fileName}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    <select 
                      value={archivo.documentType}
                      onChange={(e) => {
                        setArchivos(prev => prev.map(a => 
                          a.id === archivo.id ? { ...a, documentType: e.target.value } : a
                        ));
                      }}
                      disabled={isView}
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
                      value={archivo.description}
                      onChange={(e) => {
                        setArchivos(prev => prev.map(a => 
                          a.id === archivo.id ? { ...a, description: e.target.value } : a
                        ));
                      }}
                      disabled={isView}
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    <select 
                      value={archivo.status}
                      onChange={(e) => {
                        setArchivos(prev => prev.map(a => 
                          a.id === archivo.id ? { ...a, status: e.target.value } : a
                        ));
                      }}
                      disabled={isView}
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option>Activo</option>
                      <option>Inactivo</option>
                      <option>Rechazado</option>
                    </select>
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    <input 
                      type="text"
                      value=""
                      onChange={() => {}}
                      disabled={isView}
                      placeholder="Observaciones..."
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!archivo.fileData) {
                          toast.error('No hay archivo disponible para visualizar');
                          return;
                        }
                        setCurrentFile(archivo);
                        setShowViewer(true);
                      }}
                      className="inline-flex items-center justify-center px-2 py-1 btn-secondary-theme text-xs rounded"
                      title="Visualizar archivo"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN 2 — IMÁGENES CLAVE PARA VALIDACIÓN */}
      <div className="mb-4">
        <div className="px-3 py-1 bg-primary-theme border-b border-gray-300">
          <span className="text-xs font-semibold text-white">IMÁGENES CLAVE PARA VALIDACIÓN</span>
        </div>

        <div className="border border-gray-400 border-t-0 p-3 bg-white">
          <div className="grid grid-cols-3 gap-4">
            {/* Imagen INE */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700 mb-1">Imagen INE</div>
              
              {/* Preview de la imagen */}
              {previews.ine ? (
                <div className="border border-gray-300 p-2 bg-gray-50">
                  <img 
                    src={previews.ine} 
                    alt="INE Preview" 
                    className="w-full h-32 object-contain"
                  />
                </div>
              ) : (
                <div className="border border-gray-300 p-2 bg-gray-50 h-32 flex items-center justify-center">
                  <span className="text-xs text-gray-400">Sin imagen</span>
                </div>
              )}

              <input
                ref={fileInputRefs.ine}
                type="file"
                accept=".jpg,.jpeg,.png"
                disabled={isView}
                onChange={(e) => handleImageUpload('ine', e.target.files?.[0] || null)}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRefs.ine.current?.click()}
                disabled={isView}
                className="w-full px-3 py-1.5 btn-secondary-theme text-xs rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Seleccionar archivo
              </button>
              
              {imagenesClaves.ineImage ? (
                <div className="text-xs text-green-600">
                  ✓ {imagenesClaves.ineImage.name}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  Sin archivos seleccionados
                </div>
              )}
              <div className="text-xs text-gray-500">
                Validación: OCR automático
              </div>
            </div>

            {/* Imagen Selfie */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700 mb-1">Imagen Selfie</div>
              
              {/* Preview de la imagen */}
              {previews.selfie ? (
                <div className="border border-gray-300 p-2 bg-gray-50">
                  <img 
                    src={previews.selfie} 
                    alt="Selfie Preview" 
                    className="w-full h-32 object-contain"
                  />
                </div>
              ) : (
                <div className="border border-gray-300 p-2 bg-gray-50 h-32 flex items-center justify-center">
                  <span className="text-xs text-gray-400">Sin imagen</span>
                </div>
              )}

              <input
                ref={fileInputRefs.selfie}
                type="file"
                accept=".jpg,.jpeg,.png"
                disabled={isView}
                onChange={(e) => handleImageUpload('selfie', e.target.files?.[0] || null)}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRefs.selfie.current?.click()}
                disabled={isView}
                className="w-full px-3 py-1.5 btn-secondary-theme text-xs rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Seleccionar archivo
              </button>
              
              {imagenesClaves.selfieImage ? (
                <div className="text-xs text-green-600">
                  ✓ {imagenesClaves.selfieImage.name}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  Sin archivos seleccionados
                </div>
              )}
              <div className="text-xs text-gray-500">
                Validación: Reconocimiento facial
              </div>
            </div>

            {/* Imagen Acta Constitutiva */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700 mb-1">Imagen Acta Constitutiva</div>
              
              {/* Preview de la imagen o icono PDF */}
              {previews.acta ? (
                <div className="border border-gray-300 p-2 bg-gray-50">
                  <img 
                    src={previews.acta} 
                    alt="Acta Preview" 
                    className="w-full h-32 object-contain"
                  />
                </div>
              ) : imagenesClaves.actaImage && imagenesClaves.actaImage.name.toLowerCase().endsWith('.pdf') ? (
                <div className="border border-gray-300 p-2 bg-gray-50 h-32 flex flex-col items-center justify-center">
                  <div className="text-4xl text-red-600 mb-1">📄</div>
                  <span className="text-xs text-gray-600">Documento PDF</span>
                </div>
              ) : (
                <div className="border border-gray-300 p-2 bg-gray-50 h-32 flex items-center justify-center">
                  <span className="text-xs text-gray-400">Sin documento</span>
                </div>
              )}

              <input
                ref={fileInputRefs.acta}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                disabled={isView}
                onChange={(e) => handleImageUpload('acta', e.target.files?.[0] || null)}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRefs.acta.current?.click()}
                disabled={isView}
                className="w-full px-3 py-1.5 btn-secondary-theme text-xs rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Seleccionar archivo
              </button>
              
              {imagenesClaves.actaImage ? (
                <div className="text-xs text-green-600">
                  ✓ {imagenesClaves.actaImage.name}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  Sin archivos seleccionados
                </div>
              )}
              <div className="text-xs text-gray-500">
                Validación: OCR + coincidencia de nombre
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3 — VALIDACIÓN AUTOMÁTICA POR IA */}
      <div className="mb-4">
        <div className="px-3 py-1 bg-primary-theme border-b border-gray-300">
          <span className="text-xs font-semibold text-white">VALIDACIÓN AUTOMÁTICA POR IA</span>
        </div>

        <div className="border border-gray-400 border-t-0 p-3 bg-white">
          <div className="space-y-3">
            {/* Fila 1: Coincidencia INE vs Selfie */}
            <div className="flex items-center gap-4">
              <label className="text-xs font-medium text-gray-700 w-48">
                Coincidencia INE vs Selfie
              </label>
              <input
                type="text"
                value={validationResult.faceMatchResult}
                readOnly
                disabled={isView}
                className={inputClassName(true)}
                placeholder={!validationExecuted ? 'Pendiente de validación' : ''}
              />
              {validationResult.faceMatchScore !== null && (
                <div className="text-xs text-gray-700">
                  Similitud facial: {validationResult.faceMatchScore}%
                </div>
              )}
            </div>

            {/* Fila 2: Coincidencia INE vs Acta Constitutiva */}
            <div className="flex items-center gap-4">
              <label className="text-xs font-medium text-gray-700 w-48">
                Coincidencia INE vs Acta Constitutiva
              </label>
              <input
                type="text"
                value={validationResult.nameMatchResult}
                readOnly
                disabled={isView}
                className={inputClassName(true)}
                placeholder={!validationExecuted ? 'Pendiente de validación' : ''}
              />
            </div>

            {/* Fila 3: Representante Legal Validado */}
            <div className="flex items-center gap-4">
              <label className="text-xs font-medium text-gray-700 w-48">
                Representante Legal Validado
              </label>
              <input
                type="text"
                value={validationResult.legalRepValidated}
                readOnly
                disabled={isView}
                className={inputClassName(true)}
                placeholder={!validationExecuted ? 'Pendiente de validación' : ''}
              />
            </div>

            {/* Fila 4: Observaciones IA */}
            <div className="flex items-start gap-4">
              <label className="text-xs font-medium text-gray-700 w-48 pt-1">
                Observaciones IA
              </label>
              <textarea
                value={validationResult.validationNotes}
                readOnly
                disabled={isView}
                className={`flex-1 px-2 py-1 text-xs ${isView || mode === 'editar' ? 'border-0 bg-transparent' : 'border border-gray-400 rounded bg-white'} text-gray-700 resize-none`}
                rows={4}
                placeholder={!validationExecuted ? 'Las observaciones se generarán automáticamente después de ejecutar la validación' : ''}
              />
            </div>

            {/* Botón Ejecutar Validación IA */}
            {!isView && (
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleEjecutarValidacion}
                  disabled={!imagenesClaves.ineImage || !imagenesClaves.selfieImage || !imagenesClaves.actaImage}
                  className={`px-5 py-1.5 text-xs text-white rounded ${
                    !imagenesClaves.ineImage || !imagenesClaves.selfieImage || !imagenesClaves.actaImage
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'btn-secondary-theme'
                  }`}
                >
                  Ejecutar Validación IA
                </button>
                {(!imagenesClaves.ineImage || !imagenesClaves.selfieImage || !imagenesClaves.actaImage) && (
                  <span className="text-xs text-red-600">
                    Debe cargar los tres documentos para ejecutar la validación
                  </span>
                )}
              </div>
            )}

            {/* Indicador de estado de validación */}
            {validationExecuted && validationResult.legalRepValidated === 'Sí' && (
              <div className="mt-3 p-2 bg-green-50 border border-green-300 rounded">
                <p className="text-xs text-green-800 font-medium">
                  ✓ Validación exitosa: El representante legal ha sido verificado automáticamente
                </p>
              </div>
            )}

            {validationExecuted && validationResult.legalRepValidated === 'No' && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded">
                <p className="text-xs text-yellow-800 font-medium">
                  ⚠ Validación requiere revisión manual: Se detectaron inconsistencias en los documentos
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Visualización de Archivos */}
      {showViewer && currentFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90%] h-[90%] flex flex-col">
            {/* Header del modal */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 bg-gray-100">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-800">{currentFile.fileName}</h3>
                <p className="text-xs text-gray-600 mt-0.5">{currentFile.documentType}</p>
              </div>
              <button
                onClick={() => setShowViewer(false)}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Contenido del archivo */}
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              {currentFile.fileData && (
                <iframe
                  src={currentFile.fileData}
                  className="w-full h-full border-0"
                  title={currentFile.fileName}
                />
              )}
            </div>

            {/* Footer del modal */}
            <div className="px-4 py-3 border-t border-gray-300 bg-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowViewer(false)}
                className="px-4 py-1.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Institucional para Nuevo Archivo */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
          <div className="bg-white w-[700px] shadow-2xl">
            {/* Header del modal - Azul institucional */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#5B7DA5' }}>
              <h3 className="text-sm font-medium text-white">
                {modalMode === 'crear' ? 'Nuevo Archivo Adjunto' : 'Editar Archivo Adjunto'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 bg-white">
              {/* Sección con fondo gris */}
              <div className="bg-gray-200 px-3 py-2 mb-4">
                <span className="text-xs font-semibold text-gray-700">INFORMACIÓN DEL ARCHIVO</span>
              </div>

              <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                {/* Nombre del Archivo */}
                <div className="col-span-3">
                  <label className="block text-xs text-gray-700 mb-1.5">
                    Nombre del Archivo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newArchivo.fileName}
                    onChange={(e) => setNewArchivo({ ...newArchivo, fileName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    placeholder="Ej: INE_JuanPerez.pdf"
                  />
                </div>

                {/* Tipo de Documento */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1.5">
                    Tipo de Documento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newArchivo.documentType}
                    onChange={(e) => setNewArchivo({ ...newArchivo, documentType: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  >
                    <option value="">Seleccione...</option>
                    <option value="Identificación oficial">Identificación oficial</option>
                    <option value="Comprobante de domicilio">Comprobante de domicilio</option>
                    <option value="Estado de cuenta">Estado de cuenta</option>
                    <option value="Selfie">Selfie</option>
                    <option value="Acta Constitutiva">Acta Constitutiva</option>
                    <option value="Comprobante de ingresos">Comprobante de ingresos</option>
                    <option value="RFC">RFC</option>
                    <option value="CURP">CURP</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                {/* Estatus */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1.5">
                    Estatus
                  </label>
                  <select
                    value={newArchivo.status}
                    onChange={(e) => setNewArchivo({ ...newArchivo, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>

                {/* Espacio vacío para mantener el grid */}
                <div></div>

                {/* Descripción */}
                <div className="col-span-3">
                  <label className="block text-xs text-gray-700 mb-1.5">
                    Descripción
                  </label>
                  <textarea
                    value={newArchivo.description}
                    onChange={(e) => setNewArchivo({ ...newArchivo, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white resize-none"
                    rows={3}
                    placeholder="Ingrese descripción adicional..."
                  />
                </div>
              </div>
            </div>

            {/* Footer del modal */}
            <div className="px-6 py-4 bg-gray-100 flex justify-end gap-3 border-t border-gray-300">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 text-xs text-white rounded hover:bg-gray-600 transition-colors"
                style={{ backgroundColor: '#6B7280' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarArchivo}
                className="px-6 py-2 text-xs text-white rounded hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#5B7DA5' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar documento desde Web */}
      {showWmdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                Agregar Documento desde Web
              </h3>
              <button
                onClick={() => {
                  setShowWmdModal(false);
                  setWmdUrl('');
                }}
                className="text-white hover:text-gray-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            {/* Contenido del formulario */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Campo URL del Documento */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  URL del Documento <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={wmdUrl}
                  onChange={(e) => setWmdUrl(e.target.value)}
                  placeholder="https://ejemplo.com/documento.pdf"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && wmdUrl.trim()) {
                      const newArchivo: ArchivoAdjunto = {
                        id: archivos.length + 1,
                        fileName: wmdUrl,
                        documentType: 'Documento web',
                        description: '',
                        uploadDate: new Date().toLocaleString('es-MX', { 
                          year: 'numeric', 
                          month: '2-digit', 
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }),
                        uploadedBy: 'Usuario Actual',
                        status: 'Activo',
                        fileData: wmdUrl
                      };
                      setArchivos(prev => [...prev, newArchivo]);
                      setShowWmdModal(false);
                      setWmdUrl('');
                      toast.success('Documento agregado exitosamente');
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ingrese la URL completa del documento que desea agregar (PDF, DOC, imagen, etc.)
                </p>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowWmdModal(false);
                  setWmdUrl('');
                }}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (wmdUrl.trim()) {
                    const newArchivo: ArchivoAdjunto = {
                      id: archivos.length + 1,
                      fileName: wmdUrl,
                      documentType: 'Documento web',
                      description: '',
                      uploadDate: new Date().toLocaleString('es-MX', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }),
                      uploadedBy: 'Usuario Actual',
                      status: 'Activo',
                      fileData: wmdUrl
                    };
                    setArchivos(prev => [...prev, newArchivo]);
                    setShowWmdModal(false);
                    setWmdUrl('');
                    toast.success('Documento agregado exitosamente');
                  }
                }}
                className="px-5 py-2 text-sm btn-secondary-theme rounded font-medium"
                disabled={!wmdUrl.trim()}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}