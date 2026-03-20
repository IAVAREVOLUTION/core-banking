import { useState, useEffect, useCallback } from 'react';
import { Garantia, DocumentoExpediente } from '@/types/garantia';
import { FormMode } from '@/types/product';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { currentUser } from '@/app/data/mockData';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { Eye, Search, X, Users } from 'lucide-react';
import { useClientesDB, type ClienteDB } from '@/app/hooks/useClientesDB';

// ─── Persistencia sessionStorage ───
const STORAGE_KEY_FORM = 'garantia_form_data';
const STORAGE_KEY_DOCS = 'garantia_documentos';
const STORAGE_KEY_TAB = 'garantia_active_tab';

function saveSession<T>(key: string, data: T) {
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}
function loadSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}
function clearSession(id: number | string) {
  sessionStorage.removeItem(`${STORAGE_KEY_FORM}_${id}`);
  sessionStorage.removeItem(`${STORAGE_KEY_DOCS}_${id}`);
  sessionStorage.removeItem(`${STORAGE_KEY_TAB}_${id}`);
}

// Helper: Archivo → base64 para persistir
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Tipos de archivo aceptados
const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar';
const ACCEPTED_MIME_DISPLAY = 'PDF, Imágenes (JPG, PNG, GIF, WEBP), Word, Excel, TXT, ZIP';

interface GarantiaFormProps {
  mode: FormMode;
  garantia?: Garantia;
  onSave: (garantia: Garantia) => void;
  onCancel: () => void;
  nextId: number;
}

// Catálogos según definición
const TIPOS_GARANTIA = ['Mueble', 'Inmueble'];
const SUBTIPOS_GARANTIA = ['Automóvil', 'Terreno', 'Maquinaria', 'Departamento'];
const ESTATUS_GARANTIA = ['Aceptado', 'Rechazado', 'Pendiente'];
const TIPOS_DOCUMENTO = [
  'Escritura',
  'Factura',
  'Avalúo',
  'Contrato',
  'Identificación',
  'Comprobante de domicilio',
  'Fotografía',
  'Póliza de seguro',
  'Otro',
];
const ESTADOS_MEXICO = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Coahuila de Zaragoza',
  'Colima',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Durango',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Estado de México',
  'Michoacán de Ocampo',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
];

export function GarantiaForm({
  mode,
  garantia,
  onSave,
  onCancel,
  nextId,
}: GarantiaFormProps) {
  const isView = mode === 'view';
  const isCreate = mode === 'create';
  const storageId = garantia?.id || 'nuevo';

  // ─── Inicialización con persistencia ───
  const getInitialForm = useCallback((): Garantia => {
    // 1. Intentar sessionStorage
    const cached = loadSession<Garantia>(`${STORAGE_KEY_FORM}_${storageId}`);
    if (cached) return cached;
    // 2. Desde prop
    if (!isCreate && garantia) return garantia;
    // 3. Nuevo
    return {
      id: nextId,
      tipo: '',
      subtipo: '',
      garantia: '',
      descripcion: '',
      valorNominal: 0,
      ubicacion: '',
      fechaTasacion: '',
      valorTasacion: 0,
      peritaTasador: '',
      tasaInteres: '',
      observaciones: '',
      fechaVencimiento: '',
      fechaRegistro: new Date().toISOString(),
      estatus: '',
      estado: '',
      municipio: '',
      cliente_id: '',
      clienteNombre: '',
    };
  }, [isCreate, garantia, nextId, storageId]);

  const getInitialDocs = useCallback((): DocumentoExpediente[] => {
    const cached = loadSession<DocumentoExpediente[]>(`${STORAGE_KEY_DOCS}_${storageId}`);
    if (cached) return cached;
    if (garantia?.documentos && garantia.documentos.length > 0) return garantia.documentos;
    // Demo doc solo para garantías existentes que no tengan documentos guardados
    if (!isCreate && garantia) {
      return [{
        id: 1,
        fechaRegistro: '2024-01-15T10:30:00',
        usuarioRegistro: 'EMI-001 Emilio Camarena',
        archivo: 'GarantiaAutomotriz.pdf',
        tipoDocumento: 'Carta de Aceptación',
        descripcion: 'Carta de aceptación del crédito Juan Perez Perez',
        estatus: 'Pendiente',
        observaciones: 'Sin Observaciones',
        fileData: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      }];
    }
    return [];
  }, [isCreate, garantia, storageId]);

  const getInitialTab = useCallback((): string => {
    return loadSession<string>(`${STORAGE_KEY_TAB}_${storageId}`) || 'default';
  }, [storageId]);

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Estado para Expediente Electrónico
  const [documentos, setDocumentos] = useState<DocumentoExpediente[]>(getInitialDocs);
  
  // Estados para tabs de acción del expediente
  const [selectedDocumentos, setSelectedDocumentos] = useState<number[]>([]);
  const [showAdjuntarOptions, setShowAdjuntarOptions] = useState(false);
  const [showWebUrlModal, setShowWebUrlModal] = useState(false);
  const [webUrl, setWebUrl] = useState('');
  
  // Estados adicionales para compatibilidad
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<number | null>(null);
  
  // Estados para visualizador de archivos
  const [showViewer, setShowViewer] = useState(false);
  const [currentFile, setCurrentFile] = useState<DocumentoExpediente | null>(null);

  // Estado del formulario
  const [formData, setFormData] = useState<Garantia>(getInitialForm);

  // ─── Cliente modal state ───
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const { clientes: clientesDB, loading: loadingClientes } = useClientesDB(showClienteModal);

  const filteredClientes = clientesDB.filter((c: ClienteDB) => {
    if (!clienteSearch.trim()) return true;
    const q = clienteSearch.toLowerCase();
    return (
      c.nombreCompleto.toLowerCase().includes(q) ||
      c.idCliente.toLowerCase().includes(q) ||
      (c.rfc && c.rfc.toLowerCase().includes(q)) ||
      (c.curp && c.curp.toLowerCase().includes(q))
    );
  });

  const handleSelectCliente = (cliente: ClienteDB) => {
    setFormData(prev => ({
      ...prev,
      cliente_id: cliente.dbUuid,
      clienteNombre: cliente.nombreCompleto,
    }));
    setShowClienteModal(false);
    setClienteSearch('');
    if (errors.cliente_id) {
      setErrors(prev => { const n = { ...prev }; delete n.cliente_id; return n; });
    }
  };

  const handleClearCliente = () => {
    setFormData(prev => ({ ...prev, cliente_id: '', clienteNombre: '' }));
  };

  // ─── Persistencia automática ───
  useEffect(() => {
    if (!isView) {
      saveSession(`${STORAGE_KEY_FORM}_${storageId}`, formData);
    }
  }, [formData, storageId, isView]);

  useEffect(() => {
    if (!isView) {
      saveSession(`${STORAGE_KEY_DOCS}_${storageId}`, documentos);
    }
  }, [documentos, storageId, isView]);

  useEffect(() => {
    saveSession(`${STORAGE_KEY_TAB}_${storageId}`, activeTab);
  }, [activeTab, storageId]);

  const handleChange = (
    field: keyof Garantia,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Limpiar error del campo al editarlo
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar campos obligatorios
    if (!formData.tipo) newErrors.tipo = 'Campo obligatorio';
    if (!formData.subtipo) newErrors.subtipo = 'Campo obligatorio';
    if (!formData.garantia?.trim()) newErrors.garantia = 'Campo obligatorio';
    if (!formData.valorNominal || formData.valorNominal <= 0) newErrors.valorNominal = 'Debe ser mayor a 0';
    if (!formData.ubicacion?.trim()) newErrors.ubicacion = 'Campo obligatorio';
    if (!formData.cliente_id) newErrors.cliente_id = 'Debe seleccionar un cliente';

    // Validar longitudes
    if (formData.garantia && formData.garantia.length > 50) {
      newErrors.garantia = 'Máximo 50 caracteres';
    }
    if (formData.peritaTasador && formData.peritaTasador.length > 150) {
      newErrors.peritaTasador = 'Máximo 150 caracteres';
    }
    if (formData.tasaInteres && formData.tasaInteres.length > 5) {
      newErrors.tasaInteres = 'Máximo 5 caracteres';
    }
    if (formData.observaciones && formData.observaciones.length > 255) {
      newErrors.observaciones = 'Máximo 255 caracteres';
    }
    if (formData.municipio && formData.municipio.length > 30) {
      newErrors.municipio = 'Máximo 30 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!isView) {
      if (validateForm()) {
        // Incluir documentos del expediente electrónico en la garantía
        const garantiaConDocs: Garantia = { ...formData, documentos };
        onSave(garantiaConDocs);
        clearSession(storageId);
      }
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), "dd/MM/yyyy", {
        locale: es,
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", {
        locale: es,
      });
    } catch {
      return dateString;
    }
  };

  // Handlers para tabla de documentos
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocumentos(documentos.map(d => d.id));
    } else {
      setSelectedDocumentos([]);
    }
  };

  const handleSelectDocumento = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedDocumentos(prev => [...prev, id]);
    } else {
      setSelectedDocumentos(prev => prev.filter(docId => docId !== id));
    }
  };

  const handleDocumentChange = (
    docId: number,
    field: keyof DocumentoExpediente,
    value: string
  ) => {
    setDocumentos((prev) =>
      prev.map((doc) =>
        doc.id === docId ? { ...doc, [field]: value } : doc
      )
    );
  };

  // Handler para subir archivo desde equipo (PDF, imágenes, cualquier archivo)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Convertir a base64 para persistencia en sessionStorage
      const base64 = await fileToBase64(file);
      const newDoc: DocumentoExpediente = {
        id: Math.max(...documentos.map((d) => d.id), 0) + 1,
        fechaRegistro: new Date().toISOString(),
        usuarioRegistro: currentUser.name,
        archivo: file.name,
        tipoDocumento: '',
        descripcion: '',
        estatus: 'Pendiente',
        observaciones: '',
        fileData: base64,
      };
      setDocumentos((prev) => [...prev, newDoc]);
      toast.success('Documento agregado exitosamente', {
        description: `Se agregó el archivo "${file.name}"`,
      });
    }
    e.target.value = '';
  };

  // Handler para agregar desde Web (cualquier URL)
  const handleWebUrl = () => {
    if (!webUrl.trim()) {
      toast.error('Por favor ingrese una URL válida');
      return;
    }
    // Validar formato URL básico
    try {
      new URL(webUrl);
    } catch {
      toast.error('La URL ingresada no tiene un formato válido');
      return;
    }
    const urlPath = webUrl.split('/').pop()?.split('?')[0] || '';
    const fileName = urlPath || 'recurso-web';
    const newDoc: DocumentoExpediente = {
      id: Math.max(...documentos.map((d) => d.id), 0) + 1,
      fechaRegistro: new Date().toISOString(),
      usuarioRegistro: currentUser.name,
      archivo: fileName,
      tipoDocumento: '',
      descripcion: '',
      estatus: 'Pendiente',
      observaciones: '',
      fileData: webUrl,
    };
    setDocumentos((prev) => [...prev, newDoc]);
    toast.success('Documento agregado exitosamente', {
      description: `Se agregó recurso desde Web`,
    });
    setShowWebUrlModal(false);
    setWebUrl('');
  };

  // Funciones para adjuntar archivos
  const adjuntarDesdeEquipo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_FILE_TYPES;
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        // Convertir a base64 para persistencia
        const base64 = await fileToBase64(file);
        const newDoc: DocumentoExpediente = {
          id: Math.max(...documentos.map((d) => d.id), 0) + 1,
          fechaRegistro: new Date().toISOString(),
          usuarioRegistro: currentUser.name,
          archivo: file.name,
          tipoDocumento: '',
          descripcion: '',
          estatus: 'Pendiente',
          observaciones: '',
          fileData: base64,
        };
        setDocumentos((prev) => [...prev, newDoc]);
        toast.success('Documento agregado exitosamente', {
          description: `Se agregó el archivo "${file.name}"`,
        });
        setShowAdjuntarOptions(false);
      }
    };
    input.click();
  };

  const adjuntarDesdeWeb = () => {
    setShowWebUrlModal(true);
  };

  const handleViewFile = (doc: DocumentoExpediente) => {
    if (!doc.fileData) {
      toast.error('No hay archivo disponible para visualizar');
      return;
    }
    setCurrentFile(doc);
    setShowViewer(true);
  };

  const eliminarDocumentos = () => {
    if (selectedDocumentos.length === 0) {
      toast.error('Por favor seleccione al menos un registro para eliminar');
      return;
    }

    const documentosAEliminar = documentos.filter(d => selectedDocumentos.includes(d.id));
    const documentosNoPendientes = documentosAEliminar.filter(d => d.estatus !== 'Pendiente');

    if (documentosNoPendientes.length > 0) {
      toast.error('Solo se pueden eliminar registros con estatus "Pendiente"');
      return;
    }

    setDocumentos(documentos.filter(d => !selectedDocumentos.includes(d.id)));
    const count = selectedDocumentos.length;
    setSelectedDocumentos([]);
    toast.success(`${count} archivo${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  // Handler para eliminar documento (compatibilidad con código existente)
  const handleDeleteDocument = (docId: number) => {
    setDocumentToDelete(docId);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (documentToDelete !== null) {
      setDocumentos((prev) => prev.filter((doc) => doc.id !== documentToDelete));
      toast.success('Expediente eliminado exitosamente');
      setShowDeleteModal(false);
      setDocumentToDelete(null);
    }
  };

  const tabs = [
    { id: 'default', label: 'Default' },
    { id: 'expediente', label: 'Expediente Electrónico' },
  ];

  return (
    <div className="bg-[#F0F0F0] min-h-screen">
      {/* Header Section */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#4A90E2">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M4 9h16M9 4v16" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Alta Garantía</h2>
            <button className="p-1 ml-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="8" cy="8" r="6"/>
                <path d="M13 13l3 3"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {!isView && (
            <button 
              onClick={handleSubmit}
              className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium"
            >
              Guardar
            </button>
          )}
          <button 
            onClick={() => { clearSession(storageId); onCancel(); }}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700"
          >
            {isView ? 'Volver' : 'Cancelar'}
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-4 py-4">
        <div className="bg-white border border-gray-300">
          {/* Datos Garantía - Siempre visible */}
          <div className="p-4 border-b border-gray-300">
            <div className="bg-[#D9E2F3] px-3 py-1.5 mb-3 text-sm font-medium text-gray-800 border-l-4 border-[#4A6FA5]">
              Datos Garantía
            </div>
            
            <div className="space-y-1">
              {/* Fila 1 - 3 columnas */}
              <div className="grid grid-cols-3 gap-x-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">ID Garantía <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={formData.id}
                    disabled 
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Tipo <span className="text-red-500">*</span></label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.tipo}</div>
                  ) : (
                    <div className="flex-1">
                      <select 
                        value={formData.tipo}
                        onChange={(e) => handleChange('tipo', e.target.value)}
                        className={`w-full px-2 py-0.5 text-xs border rounded ${errors.tipo ? 'border-red-500' : 'border-gray-300'}`}
                      >
                        <option value="">Seleccione...</option>
                        {TIPOS_GARANTIA.map((tipo) => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                      {errors.tipo && <span className="text-xs text-red-500">{errors.tipo}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Subtipo <span className="text-red-500">*</span></label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.subtipo}</div>
                  ) : (
                    <div className="flex-1">
                      <select 
                        value={formData.subtipo}
                        onChange={(e) => handleChange('subtipo', e.target.value)}
                        className={`w-full px-2 py-0.5 text-xs border rounded ${errors.subtipo ? 'border-red-500' : 'border-gray-300'}`}
                      >
                        <option value="">Seleccione...</option>
                        {SUBTIPOS_GARANTIA.map((subtipo) => (
                          <option key={subtipo} value={subtipo}>{subtipo}</option>
                        ))}
                      </select>
                      {errors.subtipo && <span className="text-xs text-red-500">{errors.subtipo}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Fila Cliente — FK a J_CLIENTES */}
              <div className="grid grid-cols-3 gap-x-4">
                <div className="flex items-center gap-2 col-span-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">
                    <Users className="inline w-3.5 h-3.5 mr-1 text-blue-500" />
                    Cliente <span className="text-red-500">*</span>
                  </label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">
                      {formData.clienteNombre || '—'}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-1">
                      <div
                        onClick={() => !isView && setShowClienteModal(true)}
                        className={`flex-1 flex items-center justify-between px-2 py-1 text-xs border rounded cursor-pointer hover:border-blue-400 ${
                          errors.cliente_id ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        <span className={formData.clienteNombre ? 'text-gray-800' : 'text-gray-400'}>
                          {formData.clienteNombre || 'Seleccionar cliente...'}
                        </span>
                        <Search className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      {formData.cliente_id && (
                        <button
                          type="button"
                          onClick={handleClearCliente}
                          className="p-0.5 text-red-400 hover:text-red-600"
                          title="Quitar cliente"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  {errors.cliente_id && <span className="text-xs text-red-500 ml-1">{errors.cliente_id}</span>}
                </div>
                {formData.cliente_id && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-500">UUID</label>
                    <input
                      type="text"
                      value={formData.cliente_id}
                      disabled
                      className="flex-1 px-2 py-1 text-[10px] border border-gray-300 rounded bg-gray-100 text-gray-500 font-mono truncate"
                    />
                  </div>
                )}
              </div>

              {/* Fila 2 - 3 columnas */}
              <div className="grid grid-cols-3 gap-x-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Garantía <span className="text-red-500">*</span></label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.garantia}</div>
                  ) : (
                    <div className="flex-1">
                      <input 
                        type="text" 
                        value={formData.garantia}
                        onChange={(e) => handleChange('garantia', e.target.value)}
                        maxLength={50}
                        className={`w-full px-2 py-0.5 text-xs border rounded ${errors.garantia ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.garantia && <span className="text-xs text-red-500">{errors.garantia}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Valor Nominal <span className="text-red-500">*</span></label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">
                      {new Intl.NumberFormat('es-MX', {
                        style: 'currency',
                        currency: 'MXN',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(formData.valorNominal)}
                    </div>
                  ) : (
                    <div className="flex-1">
                      <input 
                        type="number" 
                        value={formData.valorNominal === 0 ? '' : formData.valorNominal}
                        onChange={(e) => handleChange('valorNominal', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                        step="0.01"
                        placeholder="0.00"
                        className={`w-full px-2 py-0.5 text-xs border rounded ${errors.valorNominal ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.valorNominal && <span className="text-xs text-red-500">{errors.valorNominal}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Fecha de Tasación</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formatDate(formData.fechaTasacion)}</div>
                  ) : (
                    <DatePicker 
                      value={formData.fechaTasacion}
                      onChange={(date) => handleChange('fechaTasacion', date)}
                    />
                  )}
                </div>
              </div>

              {/* Fila 3 - 3 columnas */}
              <div className="grid grid-cols-3 gap-x-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Valor de Tasación</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">
                      {formData.valorTasacion ? new Intl.NumberFormat('es-MX', {
                        style: 'currency',
                        currency: 'MXN',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(formData.valorTasacion) : ''}
                    </div>
                  ) : (
                    <input 
                      type="number" 
                      value={formData.valorTasacion || ''}
                      onChange={(e) => handleChange('valorTasacion', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded" 
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Notario o Perito Tasador</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.peritaTasador}</div>
                  ) : (
                    <div className="flex-1">
                      <input 
                        type="text" 
                        value={formData.peritaTasador}
                        onChange={(e) => handleChange('peritaTasador', e.target.value)}
                        maxLength={150}
                        className={`w-full px-2 py-0.5 text-xs border rounded ${errors.peritaTasador ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.peritaTasador && <span className="text-xs text-red-500">{errors.peritaTasador}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Tasa de Interés</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.tasaInteres}</div>
                  ) : (
                    <div className="flex-1">
                      <input 
                        type="text" 
                        value={formData.tasaInteres}
                        onChange={(e) => handleChange('tasaInteres', e.target.value)}
                        placeholder="%"
                        maxLength={5}
                        className={`w-full px-2 py-0.5 text-xs border rounded ${errors.tasaInteres ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.tasaInteres && <span className="text-xs text-red-500">{errors.tasaInteres}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Fila 4 - 3 columnas */}
              <div className="grid grid-cols-3 gap-x-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Fecha de Vencimiento</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formatDate(formData.fechaVencimiento)}</div>
                  ) : (
                    <DatePicker 
                      value={formData.fechaVencimiento}
                      onChange={(date) => handleChange('fechaVencimiento', date)}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Fecha Registro</label>
                  <input 
                    type="text" 
                    value={formatDateTime(formData.fechaRegistro)}
                    disabled 
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Estatus</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.estatus}</div>
                  ) : (
                    <select 
                      value={formData.estatus}
                      onChange={(e) => handleChange('estatus', e.target.value)}
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Seleccione...</option>
                      {ESTATUS_GARANTIA.map((estatus) => (
                        <option key={estatus} value={estatus}>{estatus}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Fila 5 - 3 columnas */}
              <div className="grid grid-cols-3 gap-x-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Estado</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.estado}</div>
                  ) : (
                    <select 
                      value={formData.estado}
                      onChange={(e) => handleChange('estado', e.target.value)}
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Seleccione...</option>
                      {ESTADOS_MEXICO.map((estado) => (
                        <option key={estado} value={estado}>{estado}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Municipio</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.municipio}</div>
                  ) : (
                    <div className="flex-1">
                      <input 
                        type="text" 
                        value={formData.municipio}
                        onChange={(e) => handleChange('municipio', e.target.value)}
                        maxLength={30}
                        className={`w-full px-2 py-0.5 text-xs border rounded ${errors.municipio ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.municipio && <span className="text-xs text-red-500">{errors.municipio}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Columna vacía */}
                </div>
              </div>

              {/* Fila 6 - 1 columna completa (textarea) */}
              <div className="grid grid-cols-1 gap-x-4">
                <div className="flex items-start gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700 pt-1">Ubicación <span className="text-red-500">*</span></label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.ubicacion}</div>
                  ) : (
                    <div className="flex-1">
                      <textarea 
                        value={formData.ubicacion}
                        onChange={(e) => handleChange('ubicacion', e.target.value)}
                        rows={2}
                        className={`w-full px-2 py-0.5 text-xs border rounded ${errors.ubicacion ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.ubicacion && <span className="text-xs text-red-500">{errors.ubicacion}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Fila 7 - 1 columna completa (textarea) */}
              <div className="grid grid-cols-1 gap-x-4">
                <div className="flex items-start gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700 pt-1">Descripción</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.descripcion}</div>
                  ) : (
                    <textarea 
                      value={formData.descripcion}
                      onChange={(e) => handleChange('descripcion', e.target.value)}
                      rows={3}
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    />
                  )}
                </div>
              </div>

              {/* Fila 8 - 1 columna completa (textarea) */}
              <div className="grid grid-cols-1 gap-x-4">
                <div className="flex items-start gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700 pt-1">Observaciones</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.observaciones}</div>
                  ) : (
                    <div className="flex-1">
                      <textarea 
                        value={formData.observaciones}
                        onChange={(e) => handleChange('observaciones', e.target.value)}
                        maxLength={255}
                        rows={2}
                        className={`w-full px-2 py-0.5 text-xs border rounded ${errors.observaciones ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.observaciones && <span className="text-xs text-red-500">{errors.observaciones}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="bg-primary-theme text-white border-b border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-[10px] whitespace-nowrap border-r border-gray-500/30 ${
                    activeTab === tab.id
                      ? 'bg-secondary-theme text-white font-medium'
                      : 'text-white/90'
                  }`}
                  style={activeTab !== tab.id ? { transition: 'background-color 0.2s' } : {}}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = 'var(--theme-primary-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = '';
                    }
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'default' && (
              <div>
                {/* Datos Garantía - COPIA EXACTA */}
                <div className="space-y-1">
                  {/* Fila 1 - 3 columnas */}
                  <div className="grid grid-cols-3 gap-x-4">
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">ID Garantía <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.id}
                        disabled 
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Tipo <span className="text-red-500">*</span></label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.tipo}</div>
                      ) : (
                        <div className="flex-1">
                          <select 
                            value={formData.tipo}
                            onChange={(e) => handleChange('tipo', e.target.value)}
                            className={`w-full px-2 py-0.5 text-xs border rounded ${errors.tipo ? 'border-red-500' : 'border-gray-300'}`}
                          >
                            <option value="">Seleccione...</option>
                            {TIPOS_GARANTIA.map((tipo) => (
                              <option key={tipo} value={tipo}>{tipo}</option>
                            ))}
                          </select>
                          {errors.tipo && <span className="text-xs text-red-500">{errors.tipo}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Subtipo <span className="text-red-500">*</span></label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.subtipo}</div>
                      ) : (
                        <div className="flex-1">
                          <select 
                            value={formData.subtipo}
                            onChange={(e) => handleChange('subtipo', e.target.value)}
                            className={`w-full px-2 py-0.5 text-xs border rounded ${errors.subtipo ? 'border-red-500' : 'border-gray-300'}`}
                          >
                            <option value="">Seleccione...</option>
                            {SUBTIPOS_GARANTIA.map((subtipo) => (
                              <option key={subtipo} value={subtipo}>{subtipo}</option>
                            ))}
                          </select>
                          {errors.subtipo && <span className="text-xs text-red-500">{errors.subtipo}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fila Cliente (Tab Default) */}
                  <div className="grid grid-cols-3 gap-x-4">
                    <div className="flex items-center gap-2 col-span-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">
                        <Users className="inline w-3.5 h-3.5 mr-1 text-blue-500" />
                        Cliente <span className="text-red-500">*</span>
                      </label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.clienteNombre || '—'}</div>
                      ) : (
                        <div className="flex-1 flex items-center gap-1">
                          <div
                            onClick={() => !isView && setShowClienteModal(true)}
                            className={`flex-1 flex items-center justify-between px-2 py-1 text-xs border rounded cursor-pointer hover:border-blue-400 ${
                              errors.cliente_id ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                          >
                            <span className={formData.clienteNombre ? 'text-gray-800' : 'text-gray-400'}>
                              {formData.clienteNombre || 'Seleccionar cliente...'}
                            </span>
                            <Search className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          {formData.cliente_id && (
                            <button type="button" onClick={handleClearCliente} className="p-0.5 text-red-400 hover:text-red-600" title="Quitar cliente">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {formData.cliente_id && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-32 flex-shrink-0 text-gray-500">UUID</label>
                        <input type="text" value={formData.cliente_id} disabled className="flex-1 px-2 py-1 text-[10px] border border-gray-300 rounded bg-gray-100 text-gray-500 font-mono truncate" />
                      </div>
                    )}
                  </div>

                  {/* Fila 2 - 3 columnas */}
                  <div className="grid grid-cols-3 gap-x-4">
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Garantía <span className="text-red-500">*</span></label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.garantia}</div>
                      ) : (
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={formData.garantia}
                            onChange={(e) => handleChange('garantia', e.target.value)}
                            maxLength={50}
                            className={`w-full px-2 py-0.5 text-xs border rounded ${errors.garantia ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {errors.garantia && <span className="text-xs text-red-500">{errors.garantia}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Valor Nominal <span className="text-red-500">*</span></label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">
                          {new Intl.NumberFormat('es-MX', {
                            style: 'currency',
                            currency: 'MXN',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(formData.valorNominal)}
                        </div>
                      ) : (
                        <div className="flex-1">
                          <input 
                            type="number" 
                            value={formData.valorNominal}
                            onChange={(e) => handleChange('valorNominal', parseFloat(e.target.value) || 0)}
                            step="0.01"
                            className={`w-full px-2 py-0.5 text-xs border rounded ${errors.valorNominal ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {errors.valorNominal && <span className="text-xs text-red-500">{errors.valorNominal}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Fecha de Tasación</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formatDate(formData.fechaTasacion)}</div>
                      ) : (
                        <DatePicker 
                          value={formData.fechaTasacion}
                          onChange={(date) => handleChange('fechaTasacion', date)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Fila 3 - 3 columnas */}
                  <div className="grid grid-cols-3 gap-x-4">
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Valor de Tasación</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">
                          {formData.valorTasacion ? new Intl.NumberFormat('es-MX', {
                            style: 'currency',
                            currency: 'MXN',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(formData.valorTasacion) : ''}
                        </div>
                      ) : (
                        <input 
                          type="number" 
                          value={formData.valorTasacion || ''}
                          onChange={(e) => handleChange('valorTasacion', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded" 
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Notario o Perito Tasador</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.peritaTasador}</div>
                      ) : (
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={formData.peritaTasador}
                            onChange={(e) => handleChange('peritaTasador', e.target.value)}
                            maxLength={150}
                            className={`w-full px-2 py-0.5 text-xs border rounded ${errors.peritaTasador ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {errors.peritaTasador && <span className="text-xs text-red-500">{errors.peritaTasador}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Tasa de Interés</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.tasaInteres}</div>
                      ) : (
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={formData.tasaInteres}
                            onChange={(e) => handleChange('tasaInteres', e.target.value)}
                            placeholder="%"
                            maxLength={5}
                            className={`w-full px-2 py-0.5 text-xs border rounded ${errors.tasaInteres ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {errors.tasaInteres && <span className="text-xs text-red-500">{errors.tasaInteres}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fila 4 - 3 columnas */}
                  <div className="grid grid-cols-3 gap-x-4">
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Fecha de Vencimiento</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formatDate(formData.fechaVencimiento)}</div>
                      ) : (
                        <DatePicker 
                          value={formData.fechaVencimiento}
                          onChange={(date) => handleChange('fechaVencimiento', date)}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Fecha Registro</label>
                      <input 
                        type="text" 
                        value={formatDateTime(formData.fechaRegistro)}
                        disabled 
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Estatus</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.estatus}</div>
                      ) : (
                        <select 
                          value={formData.estatus}
                          onChange={(e) => handleChange('estatus', e.target.value)}
                          className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                        >
                          <option value="">Seleccione...</option>
                          {ESTATUS_GARANTIA.map((estatus) => (
                            <option key={estatus} value={estatus}>{estatus}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Fila 5 - 3 columnas */}
                  <div className="grid grid-cols-3 gap-x-4">
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Estado</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.estado}</div>
                      ) : (
                        <select 
                          value={formData.estado}
                          onChange={(e) => handleChange('estado', e.target.value)}
                          className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                        >
                          <option value="">Seleccione...</option>
                          {ESTADOS_MEXICO.map((estado) => (
                            <option key={estado} value={estado}>{estado}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">Municipio</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.municipio}</div>
                      ) : (
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={formData.municipio}
                            onChange={(e) => handleChange('municipio', e.target.value)}
                            maxLength={30}
                            className={`w-full px-2 py-0.5 text-xs border rounded ${errors.municipio ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {errors.municipio && <span className="text-xs text-red-500">{errors.municipio}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Columna vacía */}
                    </div>
                  </div>

                  {/* Fila 6 - 1 columna completa (textarea) */}
                  <div className="grid grid-cols-1 gap-x-4">
                    <div className="flex items-start gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700 pt-1">Ubicación <span className="text-red-500">*</span></label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.ubicacion}</div>
                      ) : (
                        <div className="flex-1">
                          <textarea 
                            value={formData.ubicacion}
                            onChange={(e) => handleChange('ubicacion', e.target.value)}
                            rows={2}
                            className={`w-full px-2 py-0.5 text-xs border rounded ${errors.ubicacion ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {errors.ubicacion && <span className="text-xs text-red-500">{errors.ubicacion}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fila 7 - 1 columna completa (textarea) */}
                  <div className="grid grid-cols-1 gap-x-4">
                    <div className="flex items-start gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700 pt-1">Descripción</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.descripcion}</div>
                      ) : (
                        <textarea 
                          value={formData.descripcion}
                          onChange={(e) => handleChange('descripcion', e.target.value)}
                          rows={3}
                          className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                        />
                      )}
                    </div>
                  </div>

                  {/* Fila 8 - 1 columna completa (textarea) */}
                  <div className="grid grid-cols-1 gap-x-4">
                    <div className="flex items-start gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700 pt-1">Observaciones</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.observaciones}</div>
                      ) : (
                        <div className="flex-1">
                          <textarea 
                            value={formData.observaciones}
                            onChange={(e) => handleChange('observaciones', e.target.value)}
                            maxLength={255}
                            rows={2}
                            className={`w-full px-2 py-0.5 text-xs border rounded ${errors.observaciones ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {errors.observaciones && <span className="text-xs text-red-500">{errors.observaciones}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'expediente' && (
              <div>
                <h4 className="text-xs font-semibold text-gray-800 mb-2">Expediente electrónico</h4>
                
                {/* BOTONES PRINCIPALES */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    className="px-4 py-1 bg-[#5B9BD5] text-white rounded text-[10px] hover:bg-[#4A8BC5] disabled:opacity-50"
                    onClick={() => setShowAdjuntarOptions(!showAdjuntarOptions)}
                    disabled={isView}
                  >
                    Nuevo
                  </button>
                  <button
                    className="px-4 py-1 bg-white border border-gray-400 rounded text-[10px] hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                    onClick={eliminarDocumentos}
                    disabled={isView}
                  >
                    Eliminar
                  </button>
                </div>

                {/* ADJUNTAR DESDE - Mostrar solo cuando showAdjuntarOptions es true */}
                {showAdjuntarOptions && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
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
                        Web (URL)
                      </button>
                    </div>
                    <p className="text-[9px] text-gray-500 ml-1">Formatos aceptados: {ACCEPTED_MIME_DISPLAY}</p>
                  </div>
                )}

                {/* TABLA DE ARCHIVOS */}
                <div className="overflow-hidden border border-gray-300 rounded">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-200 border-b border-gray-300">
                        <th className="px-2 py-2 text-center border-r border-gray-300 w-10">
                          <input
                            type="checkbox"
                            checked={documentos.length > 0 && selectedDocumentos.length === documentos.length}
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
                        <th className="px-2 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">Observaciones</th>
                        <th className="px-2 py-2 text-center font-semibold text-[10px] text-gray-700 w-24">Visualizar</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {documentos.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-8 text-center text-gray-500 text-xs">
                            No hay archivos en el expediente. Haz clic en "Nuevo" para agregar uno.
                          </td>
                        </tr>
                      ) : (
                        documentos.map((doc) => (
                          <tr 
                            key={doc.id} 
                            className={`border-b border-gray-200 hover:bg-gray-50 ${selectedDocumentos.includes(doc.id) ? 'bg-blue-50' : ''}`}
                          >
                            <td className="px-2 py-2 text-center border-r border-gray-300">
                              <input
                                type="checkbox"
                                checked={selectedDocumentos.includes(doc.id)}
                                onChange={(e) => handleSelectDocumento(doc.id, e.target.checked)}
                                className="cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-2 py-2 text-left text-gray-700 border-r border-gray-300 text-[10px]">{formatDateTime(doc.fechaRegistro)}</td>
                            <td className="px-2 py-2 text-left text-gray-700 border-r border-gray-300 text-[10px]">{doc.usuarioRegistro}</td>
                            <td className="px-2 py-2 border-r border-gray-300">
                              <input
                                type="text"
                                value={doc.archivo}
                                disabled
                                className="w-full px-1 py-0.5 text-[10px] bg-white border-0 text-gray-700"
                              />
                            </td>
                            <td className="px-2 py-2 border-r border-gray-300">
                              {isView ? (
                                <div className="text-[10px] text-gray-700">{doc.tipoDocumento}</div>
                              ) : (
                                <select
                                  value={doc.tipoDocumento}
                                  onChange={(e) => handleDocumentChange(doc.id, 'tipoDocumento', e.target.value)}
                                  className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                                >
                                  <option value="">Seleccione...</option>
                                  {TIPOS_DOCUMENTO.map((tipo) => (
                                    <option key={tipo} value={tipo}>{tipo}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-2 py-2 border-r border-gray-300">
                              {isView ? (
                                <div className="text-[10px] text-gray-700">{doc.descripcion}</div>
                              ) : (
                                <input
                                  type="text"
                                  value={doc.descripcion}
                                  onChange={(e) => handleDocumentChange(doc.id, 'descripcion', e.target.value)}
                                  className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                                />
                              )}
                            </td>
                            <td className="px-2 py-2 border-r border-gray-300">
                              {isView ? (
                                <div className="text-[10px] text-gray-700">{doc.estatus}</div>
                              ) : (
                                <select
                                  value={doc.estatus}
                                  onChange={(e) => handleDocumentChange(doc.id, 'estatus', e.target.value)}
                                  className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                                >
                                  <option>Pendiente</option>
                                  <option>Aceptado</option>
                                  <option>Rechazado</option>
                                </select>
                              )}
                            </td>
                            <td className="px-2 py-2 border-r border-gray-300">
                              {isView ? (
                                <div className="text-[10px] text-gray-700">{doc.observaciones}</div>
                              ) : (
                                <input
                                  type="text"
                                  value={doc.observaciones}
                                  onChange={(e) => handleDocumentChange(doc.id, 'observaciones', e.target.value)}
                                  className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                                />
                              )}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewFile(doc);
                                }}
                                className="inline-flex items-center justify-center px-2 py-1 bg-[#5B9BD5] text-white text-xs rounded hover:bg-[#4A8BC2]"
                                title="Visualizar archivo"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Modal de URL desde Web */}
                {showWebUrlModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Adjuntar desde Web</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Ingrese la URL de un archivo o recurso en línea:
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        Se aceptan URLs de archivos PDF, imágenes, documentos o cualquier recurso web.
                      </p>
                      <input
                        type="url"
                        value={webUrl}
                        onChange={(e) => setWebUrl(e.target.value)}
                        placeholder="https://ejemplo.com/documento.pdf"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded mb-6"
                      />
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => {
                            setShowWebUrlModal(false);
                            setWebUrl('');
                          }}
                          className="px-4 py-1.5 text-sm border border-gray-400 rounded hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleWebUrl}
                          className="px-4 py-1.5 text-sm bg-[#5B9BD5] text-white rounded hover:bg-[#4A8BC5]"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Modal Selección de Cliente ═══ */}
      {showClienteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-[#D9E2F3]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4A6FA5]" />
                <h3 className="text-sm font-semibold text-gray-800">Seleccionar Cliente</h3>
              </div>
              <button onClick={() => { setShowClienteModal(false); setClienteSearch(''); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={clienteSearch}
                  onChange={e => setClienteSearch(e.target.value)}
                  placeholder="Buscar por nombre, ID, RFC o CURP..."
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 rounded focus:border-blue-400 focus:outline-none"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                {loadingClientes ? 'Cargando clientes...' : `${filteredClientes.length} cliente(s) encontrado(s)`}
              </p>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">ID</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Nombre Completo</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">RFC</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">CURP</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingClientes ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          Cargando clientes desde J_CLIENTES...
                        </div>
                      </td>
                    </tr>
                  ) : filteredClientes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                        No se encontraron clientes
                      </td>
                    </tr>
                  ) : (
                    filteredClientes.slice(0, 100).map((c: ClienteDB) => (
                      <tr
                        key={c.dbUuid}
                        onClick={() => handleSelectCliente(c)}
                        className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2 font-mono text-[10px] text-blue-600">{c.idCliente}</td>
                        <td className="px-3 py-2 font-medium">{c.nombreCompleto}</td>
                        <td className="px-3 py-2 text-gray-600">{c.rfc || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">{c.curp || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                            c.estatus === 'Activo' ? 'bg-green-100 text-green-700' :
                            c.estatus === 'Inactivo' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {c.estatus || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => { setShowClienteModal(false); setClienteSearch(''); }}
                className="px-4 py-1.5 text-xs border border-gray-400 rounded hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para visualizar archivos */}
      {showViewer && currentFile && (() => {
        const fileExtension = currentFile.archivo.split('.').pop()?.toLowerCase() || '';
        const dataUrl = currentFile.fileData || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension) || dataUrl.startsWith('data:image/');
        const isPDF = fileExtension === 'pdf' || dataUrl.startsWith('data:application/pdf');
        const isWebUrl = dataUrl.startsWith('http://') || dataUrl.startsWith('https://');
        const canPreview = isImage || isPDF || isWebUrl;

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
                    <span className="ml-2 text-gray-600">{formatDateTime(currentFile.fechaRegistro)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Usuario:</span>
                    <span className="ml-2 text-gray-600">{currentFile.usuarioRegistro}</span>
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
                    {(isPDF || (isWebUrl && !isImage)) && currentFile.fileData && (
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
                        className="px-4 py-2 text-xs bg-[#5B9BD5] text-white rounded hover:bg-[#4A8BC2]"
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
                    className="px-4 py-2 text-xs bg-[#5B9BD5] text-white rounded hover:bg-[#4A8BC2]"
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