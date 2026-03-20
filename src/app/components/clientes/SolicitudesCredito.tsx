import { useState } from 'react';
import { toast } from 'sonner';
import { DatePicker } from './DatePicker';
import { PercentageInput } from './PercentageInput';
import { useClienteSubtabList } from '@/app/hooks/useClientePersistence';

interface SolicitudesCreditoProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
}

interface SolicitudCreditoData {
  id: number;
  fechaSolicitud: string;
  lineaProducto: string;
  sublinea: string;
  producto: string;
  montoSolicitado: string;
  montoAutorizado: string;
  plazo: string;
  periodicidad: string;
  tasa: string;
  fechaInicio: string;
  fechaFin: string;
  estatusSolicitud: string;
  fechaRegistro: string;
  usuario: string;
}

export function SolicitudesCredito({ onBack, mode, clienteId }: SolicitudesCreditoProps) {
  const isView = mode === 'ver';
  
  const getCurrentDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // SIEMPRE inicia vacío. Datos se cargan solo desde sessionStorage.
  const { items: solicitudes, setItems: setSolicitudes } = useClienteSubtabList<SolicitudCreditoData>(
    clienteId?.toString() || 'temp', 'solicitudes', []
  );

  const [selectedSolicitudes, setSelectedSolicitudes] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    fechaSolicitud: getCurrentDate(),
    lineaProducto: '',
    sublinea: '',
    producto: '',
    montoSolicitado: '',
    montoAutorizado: '',
    plazo: '',
    periodicidad: '',
    tasa: '',
    fechaInicio: '',
    fechaFin: '',
    estatusSolicitud: 'Pendiente'
  });

  const lineasProducto = ['Crédito', 'Préstamo', 'Financiamiento'];
  const sublineas = ['Crédito empleado', 'Crédito empresarial', 'Crédito Individual', 'Crédito personal'];
  const productos = [
    'Crédito Personal',
    'Crédito Automotriz',
    'Crédito Hipotecario',
    'Crédito Empresarial',
    'Crédito PYME'
  ];
  const periodicidades = ['Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral'];
  const estatusSolicitudes = ['Pendiente', 'Aprobado', 'En Análisis', 'Rechazado', 'Cancelado'];

  const handleNuevo = () => {
    setEditingId(null);
    setFormData({
      fechaSolicitud: getCurrentDate(),
      lineaProducto: '',
      sublinea: '',
      producto: '',
      montoSolicitado: '',
      montoAutorizado: '',
      plazo: '',
      periodicidad: '',
      tasa: '',
      fechaInicio: '',
      fechaFin: '',
      estatusSolicitud: 'Pendiente'
    });
    setShowModal(true);
  };

  const handleEliminar = () => {
    if (selectedSolicitudes.length === 0) {
      toast.error('Por favor seleccione al menos una solicitud para eliminar');
      return;
    }

    setSolicitudes(prev => prev.filter(s => !selectedSolicitudes.includes(s.id)));
    const count = selectedSolicitudes.length;
    setSelectedSolicitudes([]);
    toast.success(`${count} solicitud${count > 1 ? 'es' : ''} eliminada${count > 1 ? 's' : ''} exitosamente`);
  };

  const handleGuardarModal = () => {
    const warnings = [];
    
    if (!formData.fechaSolicitud) warnings.push('Fecha de solicitud');
    if (!formData.lineaProducto) warnings.push('Línea de producto');
    if (!formData.sublinea) warnings.push('Sublínea');
    if (!formData.producto) warnings.push('Producto');
    if (!formData.montoSolicitado) warnings.push('Monto solicitado');
    if (!formData.plazo) warnings.push('Plazo');
    if (!formData.periodicidad) warnings.push('Periodicidad');
    if (!formData.tasa) warnings.push('Tasa');
    if (!formData.fechaInicio) warnings.push('Fecha de inicio');
    if (!formData.fechaFin) warnings.push('Fecha de fin');
    
    if (warnings.length > 0) {
      toast.warning(`Campos vacíos: ${warnings.join(', ')}. Puede completarlos posteriormente.`);
    }

    // Validación de monto solicitado
    if (formData.montoSolicitado) {
      const montoSolicitado = parseFloat(formData.montoSolicitado.replace(/[^0-9.]/g, ''));
      if (montoSolicitado <= 0) {
        toast.error('El Monto Solicitado debe ser mayor a 0');
        return;
      }

      // Validar Monto Autorizado > Monto Solicitado
      if (formData.montoAutorizado) {
        const montoAutorizado = parseFloat(formData.montoAutorizado.replace(/[^0-9.]/g, ''));
        if (montoAutorizado > montoSolicitado) {
          toast.warning('El Monto Autorizado es mayor al Solicitado. Se requiere autorización adicional.');
        }
      }
    }

    // Validar Estatus Autorizado requiere Monto Autorizado
    if (formData.estatusSolicitud === 'Aprobado' && !formData.montoAutorizado) {
      toast.error('Si el Estatus es Aprobado, el Monto Autorizado es obligatorio');
      return;
    }

    // Validar fechas
    if (formData.fechaInicio && formData.fechaFin) {
      const fechaInicio = new Date(formData.fechaInicio.split('/').reverse().join('-'));
      const fechaFin = new Date(formData.fechaFin.split('/').reverse().join('-'));
      if (fechaFin < fechaInicio) {
        toast.error('La Fecha de Fin no puede ser menor a la Fecha de Inicio');
        return;
      }
    }

    const fechaActual = new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (editingId !== null) {
      setSolicitudes(prev => prev.map(s => 
        s.id === editingId 
          ? { ...formData, id: editingId, fechaRegistro: s.fechaRegistro, usuario: s.usuario }
          : s
      ));
      toast.success('Solicitud actualizada correctamente');
    } else {
      const nuevaSolicitud: SolicitudCreditoData = {
        id: solicitudes.length > 0 ? Math.max(...solicitudes.map(s => s.id)) + 1 : 1,
        fechaRegistro: fechaActual,
        usuario: 'Usuario Actual',
        ...formData
      };
      setSolicitudes(prev => [...prev, nuevaSolicitud]);
      toast.success('Solicitud creada correctamente');
    }

    setShowModal(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSolicitudes(solicitudes.map(s => s.id));
    } else {
      setSelectedSolicitudes([]);
    }
  };

  const handleSelectSolicitud = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedSolicitudes(prev => [...prev, id]);
    } else {
      setSelectedSolicitudes(prev => prev.filter(sid => sid !== id));
    }
  };

  const handleVerSolicitud = (solicitud: SolicitudCreditoData) => {
    setEditingId(solicitud.id);
    setFormData({
      fechaSolicitud: solicitud.fechaSolicitud,
      lineaProducto: solicitud.lineaProducto,
      sublinea: solicitud.sublinea,
      producto: solicitud.producto,
      montoSolicitado: solicitud.montoSolicitado,
      montoAutorizado: solicitud.montoAutorizado,
      plazo: solicitud.plazo,
      periodicidad: solicitud.periodicidad,
      tasa: solicitud.tasa,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      estatusSolicitud: solicitud.estatusSolicitud
    });
    setShowModal(true);
  };

  return (
    <div className="bg-white">
      {/* Encabezado institucional con título y botones */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">SOLICITUDES DE CRÉDITO</span>
        {!isView && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleNuevo}
              className="px-4 py-1.5 btn-secondary-theme rounded text-xs font-medium"
            >
              Nuevo
            </button>
            <button
              onClick={handleEliminar}
              className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50 font-medium"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Tabla de Solicitudes de Crédito */}
      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={solicitudes.length > 0 && selectedSolicitudes.length === solicitudes.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                  disabled={isView}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Registro</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Solicitud</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Línea Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Sublínea</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Solicitado</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Autorizado</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Plazo</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Periodicidad</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tasa</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Inicio</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Fin</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {solicitudes.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-xs text-gray-500">
                  No hay solicitudes de crédito registradas. Haga clic en "Nuevo" para agregar una.
                </td>
              </tr>
            ) : (
              solicitudes.map(solicitud => (
                <tr 
                  key={solicitud.id} 
                  className={`border-b border-gray-300 hover:bg-gray-50 ${selectedSolicitudes.includes(solicitud.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-3 py-2 text-center border-r border-gray-300">
                    <input
                      type="checkbox"
                      checked={selectedSolicitudes.includes(solicitud.id)}
                      onChange={(e) => handleSelectSolicitud(solicitud.id, e.target.checked)}
                      className="w-4 h-4"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isView}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.fechaRegistro}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.fechaSolicitud}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.lineaProducto}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.sublinea}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.producto}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.montoSolicitado}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.montoAutorizado}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.plazo}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.periodicidad}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.tasa}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.fechaInicio}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{solicitud.fechaFin}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      solicitud.estatusSolicitud === 'Aprobado' ? 'bg-green-100 text-green-800' :
                      solicitud.estatusSolicitud === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                      solicitud.estatusSolicitud === 'En Análisis' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {solicitud.estatusSolicitud}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerSolicitud(solicitud);
                      }}
                      className="inline-flex items-center justify-center px-3 py-1 btn-secondary-theme text-xs rounded font-medium"
                      title="Ver/Editar"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Institucional para Nuevo/Editar Solicitud */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header azul institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                {editingId !== null ? 'Editar Solicitud de Crédito' : 'Nueva Solicitud de Crédito'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-gray-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            {/* Contenido del formulario */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
                  <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DE LA SOLICITUD</h3>
                </div>

                <div className="space-y-4">
                  {/* Fila 1: Fecha Solicitud, Línea Producto, Sublínea */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Fecha de Solicitud <span className="text-red-600">*</span>
                      </label>
                      <DatePicker
                        value={formData.fechaSolicitud}
                        onChange={(date) => setFormData(prev => ({ ...prev, fechaSolicitud: date }))}
                        placeholder="DD/MM/YYYY"
                        disabled={editingId === null}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Línea de Producto <span className="text-red-600">*</span>
                      </label>
                      <select 
                        value={formData.lineaProducto}
                        onChange={(e) => setFormData(prev => ({ ...prev, lineaProducto: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option value="">Seleccione...</option>
                        {lineasProducto.map(linea => (
                          <option key={linea} value={linea}>{linea}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Sublínea <span className="text-red-600">*</span>
                      </label>
                      <select 
                        value={formData.sublinea}
                        onChange={(e) => setFormData(prev => ({ ...prev, sublinea: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option value="">Seleccione...</option>
                        {sublineas.map(sublinea => (
                          <option key={sublinea} value={sublinea}>{sublinea}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Fila 2: Producto, Monto Solicitado, Monto Autorizado */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Producto <span className="text-red-600">*</span>
                      </label>
                      <select 
                        value={formData.producto}
                        onChange={(e) => setFormData(prev => ({ ...prev, producto: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option value="">Seleccione...</option>
                        {productos.map(producto => (
                          <option key={producto} value={producto}>{producto}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Monto Solicitado <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.montoSolicitado}
                        onChange={(e) => setFormData(prev => ({ ...prev, montoSolicitado: e.target.value }))}
                        placeholder="$ 0.00"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Monto Autorizado
                      </label>
                      <input
                        type="text"
                        value={formData.montoAutorizado}
                        onChange={(e) => setFormData(prev => ({ ...prev, montoAutorizado: e.target.value }))}
                        placeholder="$ 0.00"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>
                  </div>

                  {/* Fila 3: Plazo, Periodicidad, Tasa */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Plazo <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.plazo}
                        onChange={(e) => setFormData(prev => ({ ...prev, plazo: e.target.value }))}
                        placeholder="12"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Periodicidad <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.periodicidad}
                        onChange={(e) => setFormData(prev => ({ ...prev, periodicidad: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option value="">Seleccione...</option>
                        {periodicidades.map(per => (
                          <option key={per} value={per}>{per}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Tasa <span className="text-red-600">*</span>
                      </label>
                      <PercentageInput
                        value={formData.tasa}
                        onChange={(value) => setFormData(prev => ({ ...prev, tasa: value }))}
                        placeholder="15%"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>
                  </div>

                  {/* Fila 4: Fecha Inicio, Fecha Fin, Estatus */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Fecha de Inicio <span className="text-red-600">*</span>
                      </label>
                      <DatePicker
                        value={formData.fechaInicio}
                        onChange={(date) => setFormData(prev => ({ ...prev, fechaInicio: date }))}
                        placeholder="DD/MM/YYYY"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Fecha de Fin <span className="text-red-600">*</span>
                      </label>
                      <DatePicker
                        value={formData.fechaFin}
                        onChange={(date) => setFormData(prev => ({ ...prev, fechaFin: date }))}
                        placeholder="DD/MM/YYYY"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Estatus de Solicitud <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.estatusSolicitud}
                        onChange={(e) => setFormData(prev => ({ ...prev, estatusSolicitud: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        {estatusSolicitudes.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarModal}
                className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90 font-medium"
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