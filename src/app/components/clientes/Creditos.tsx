import { useState } from 'react';
import { toast } from 'sonner';
import { DatePicker } from './DatePicker';
import { PercentageInput } from './PercentageInput';
import { useClienteSubtabList } from '@/app/hooks/useClientePersistence';

interface CreditosProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
}

interface CreditoData {
  id: number;
  sublinea: string;
  producto: string;
  montoSolicitado: string;
  montoAutorizado: string;
  montoEntregado: string;
  plazo: string;
  periodicidad: string;
  tasa: string;
  fechaInicio: string;
  fechaFin: string;
  estatusPago: string;
  estatusCartera: string;
  estatusCredito: string;
  fechaRegistro: string;
  usuario: string;
}

export function Creditos({ onBack, mode, clienteId }: CreditosProps) {
  const isView = mode === 'ver';

  const getCurrentDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // SIEMPRE inicia vacío. Datos se cargan solo desde sessionStorage.
  const { items: creditos, setItems: setCreditos } = useClienteSubtabList<CreditoData>(
    clienteId?.toString() || 'temp', 'creditos', []
  );

  const [selectedCreditos, setSelectedCreditos] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    sublinea: '',
    producto: '',
    montoSolicitado: '',
    montoAutorizado: '',
    montoEntregado: '',
    plazo: '',
    periodicidad: '',
    tasa: '',
    fechaInicio: '',
    fechaFin: '',
    estatusPago: 'Al corriente',
    estatusCartera: 'Vigente',
    estatusCredito: 'Activo'
  });

  const sublineas = ['Crédito empresarial', 'Crédito Individual', 'Crédito personal', 'Crédito PYME'];
  const productos = [
    'Crédito Personal',
    'Crédito Automotriz',
    'Crédito Hipotecario',
    'Crédito Empresarial',
    'Crédito PYME',
    'Crédito de Nómina'
  ];
  const periodicidades = ['Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral'];
  const estatusPagos = ['Al corriente', 'Vencido', 'Renovado', 'Cancelado'];
  const estatusCarteras = ['Vigente', 'Vencida', 'Castigada'];
  const estatusCreditos = ['Activo', 'Liquidado', 'Cancelado', 'Suspendido'];

  const handleNuevo = () => {
    setEditingId(null);
    setFormData({
      sublinea: '',
      producto: '',
      montoSolicitado: '',
      montoAutorizado: '',
      montoEntregado: '',
      plazo: '',
      periodicidad: '',
      tasa: '',
      fechaInicio: '',
      fechaFin: '',
      estatusPago: 'Al corriente',
      estatusCartera: 'Vigente',
      estatusCredito: 'Activo'
    });
    setShowModal(true);
  };

  const handleEliminar = () => {
    if (selectedCreditos.length === 0) {
      toast.error('Por favor seleccione al menos un crédito para eliminar');
      return;
    }

    setCreditos(prev => prev.filter(c => !selectedCreditos.includes(c.id)));
    const count = selectedCreditos.length;
    setSelectedCreditos([]);
    toast.success(`${count} crédito${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  const handleGuardarModal = () => {
    const warnings = [];
    
    if (!formData.sublinea) warnings.push('Sublínea');
    if (!formData.producto) warnings.push('Producto');
    if (!formData.montoSolicitado) warnings.push('Monto solicitado');
    if (!formData.montoAutorizado) warnings.push('Monto autorizado');
    if (!formData.montoEntregado) warnings.push('Monto entregado');
    if (!formData.plazo) warnings.push('Plazo');
    if (!formData.periodicidad) warnings.push('Periodicidad');
    if (!formData.tasa) warnings.push('Tasa');
    if (!formData.fechaInicio) warnings.push('Fecha de inicio');
    if (!formData.fechaFin) warnings.push('Fecha de fin');
    
    if (warnings.length > 0) {
      toast.warning(`Campos vacíos: ${warnings.join(', ')}. Puede completarlos posteriormente.`);
    }

    // Validaciones de montos
    if (formData.montoSolicitado && formData.montoAutorizado) {
      const montoSolicitado = parseFloat(formData.montoSolicitado.replace(/[^0-9.]/g, ''));
      const montoAutorizado = parseFloat(formData.montoAutorizado.replace(/[^0-9.]/g, ''));
      
      if (montoAutorizado > montoSolicitado) {
        toast.error('El Monto Autorizado no puede ser mayor al Monto Solicitado');
        return;
      }
    }

    if (formData.montoAutorizado && formData.montoEntregado) {
      const montoAutorizado = parseFloat(formData.montoAutorizado.replace(/[^0-9.]/g, ''));
      const montoEntregado = parseFloat(formData.montoEntregado.replace(/[^0-9.]/g, ''));
      
      if (montoEntregado > montoAutorizado) {
        toast.error('El Monto Entregado no puede ser mayor al Monto Autorizado');
        return;
      }
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
      setCreditos(prev => prev.map(c => 
        c.id === editingId 
          ? { ...formData, id: editingId, fechaRegistro: c.fechaRegistro, usuario: c.usuario }
          : c
      ));
      toast.success('Crédito actualizado correctamente');
    } else {
      const nuevoCredito: CreditoData = {
        id: creditos.length > 0 ? Math.max(...creditos.map(c => c.id)) + 1 : 1,
        fechaRegistro: fechaActual,
        usuario: 'Usuario Actual',
        ...formData
      };
      setCreditos(prev => [...prev, nuevoCredito]);
      toast.success('Crédito creado correctamente');
    }

    setShowModal(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCreditos(creditos.map(c => c.id));
    } else {
      setSelectedCreditos([]);
    }
  };

  const handleSelectCredito = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedCreditos(prev => [...prev, id]);
    } else {
      setSelectedCreditos(prev => prev.filter(cid => cid !== id));
    }
  };

  const handleVerCredito = (credito: CreditoData) => {
    setEditingId(credito.id);
    setFormData({
      sublinea: credito.sublinea,
      producto: credito.producto,
      montoSolicitado: credito.montoSolicitado,
      montoAutorizado: credito.montoAutorizado,
      montoEntregado: credito.montoEntregado,
      plazo: credito.plazo,
      periodicidad: credito.periodicidad,
      tasa: credito.tasa,
      fechaInicio: credito.fechaInicio,
      fechaFin: credito.fechaFin,
      estatusPago: credito.estatusPago,
      estatusCartera: credito.estatusCartera,
      estatusCredito: credito.estatusCredito
    });
    setShowModal(true);
  };

  return (
    <div className="bg-white">
      {/* Encabezado institucional con título y botones */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">CRÉDITOS</span>
      </div>

      {/* Tabla de Créditos */}
      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={creditos.length > 0 && selectedCreditos.length === creditos.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                  disabled={isView}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Registro</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Sublínea</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Solicitado</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Autorizado</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Entregado</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Plazo</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Periodicidad</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tasa</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Inicio</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Fin</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus Pago</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus Cartera</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus Crédito</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {creditos.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-3 py-8 text-center text-xs text-gray-500">
                  No hay créditos registrados. Haga clic en "Nuevo" para agregar uno.
                </td>
              </tr>
            ) : (
              creditos.map(credito => (
                <tr 
                  key={credito.id} 
                  className={`border-b border-gray-300 hover:bg-gray-50 ${selectedCreditos.includes(credito.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-3 py-2 text-center border-r border-gray-300">
                    <input
                      type="checkbox"
                      checked={selectedCreditos.includes(credito.id)}
                      onChange={(e) => handleSelectCredito(credito.id, e.target.checked)}
                      className="w-4 h-4"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isView}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.fechaRegistro}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.sublinea}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.producto}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.montoSolicitado}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.montoAutorizado}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.montoEntregado}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.plazo}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.periodicidad}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.tasa}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.fechaInicio}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{credito.fechaFin}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      credito.estatusPago === 'Al corriente' ? 'bg-green-100 text-green-800' :
                      credito.estatusPago === 'Vencido' ? 'bg-red-100 text-red-800' :
                      credito.estatusPago === 'Renovado' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {credito.estatusPago}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      credito.estatusCartera === 'Vigente' ? 'bg-green-100 text-green-800' :
                      credito.estatusCartera === 'Vencida' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {credito.estatusCartera}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      credito.estatusCredito === 'Activo' ? 'bg-green-100 text-green-800' :
                      credito.estatusCredito === 'Liquidado' ? 'bg-blue-100 text-blue-800' :
                      credito.estatusCredito === 'Suspendido' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {credito.estatusCredito}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerCredito(credito);
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

      {/* Modal Institucional para Nuevo/Editar Crédito */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header azul institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                {editingId !== null ? 'Editar Crédito' : 'Nuevo Crédito'}
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
                  <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DEL CRÉDITO</h3>
                </div>

                <div className="space-y-4">
                  {/* Fila 1: Sublínea, Producto, Monto Solicitado */}
                  <div className="grid grid-cols-3 gap-6">
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
                  </div>

                  {/* Fila 2: Monto Autorizado, Monto Entregado, Plazo */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Monto Autorizado <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.montoAutorizado}
                        onChange={(e) => setFormData(prev => ({ ...prev, montoAutorizado: e.target.value }))}
                        placeholder="$ 0.00"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Monto Entregado <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.montoEntregado}
                        onChange={(e) => setFormData(prev => ({ ...prev, montoEntregado: e.target.value }))}
                        placeholder="$ 0.00"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

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
                  </div>

                  {/* Fila 3: Periodicidad, Tasa, Fecha Inicio */}
                  <div className="grid grid-cols-3 gap-6">
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

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Fecha de Inicio <span className="text-red-600">*</span>
                      </label>
                      <DatePicker
                        value={formData.fechaInicio}
                        onChange={(date) => setFormData(prev => ({ ...prev, fechaInicio: date }))}
                        placeholder="DD/MM/YYYY"
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Fila 4: Fecha Fin, Estatus Pago, Estatus Cartera */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Fecha de Fin <span className="text-red-600">*</span>
                      </label>
                      <DatePicker
                        value={formData.fechaFin}
                        onChange={(date) => setFormData(prev => ({ ...prev, fechaFin: date }))}
                        placeholder="DD/MM/YYYY"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Estatus de Pago <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.estatusPago}
                        onChange={(e) => setFormData(prev => ({ ...prev, estatusPago: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        {estatusPagos.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Estatus de Cartera <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.estatusCartera}
                        onChange={(e) => setFormData(prev => ({ ...prev, estatusCartera: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        {estatusCarteras.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Fila 5: Estatus Crédito */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Estatus del Crédito <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.estatusCredito}
                        onChange={(e) => setFormData(prev => ({ ...prev, estatusCredito: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        {estatusCreditos.map(status => (
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