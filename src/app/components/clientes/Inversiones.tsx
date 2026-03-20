import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useClienteSubtabList } from '@/app/hooks/useClientePersistence';
import { DatePicker } from './DatePicker';
import { PercentageInput } from './PercentageInput';

interface InversionesProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
}

interface InversionData {
  id: number;
  lineaProducto: string;
  sublinea: string;
  producto: string;
  plazo: string;
  periodicidad: string;
  fechaInicio: string;
  fechaVencimiento: string;
  montoPagare: string;
  montoIntereses: string;
  tasaInteres: string;
  estatus: string;
  cuentaPago: string;
  fechaRegistro: string;
  usuario: string;
}

export function Inversiones({ onBack, mode, clienteId }: InversionesProps) {
  const isView = mode === 'ver';
  
  const getCurrentDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // SIEMPRE inicia vacío. Datos se cargan solo desde sessionStorage.
  const { items: inversiones, setItems: setInversiones } = useClienteSubtabList<InversionData>(
    clienteId?.toString() || 'temp', 'inversiones', []
  );

  const [selectedInversiones, setSelectedInversiones] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    lineaProducto: '',
    sublinea: '',
    producto: '',
    plazo: '',
    periodicidad: '',
    fechaInicio: getCurrentDate(),
    fechaVencimiento: '',
    montoPagare: '',
    montoIntereses: '',
    tasaInteres: '',
    estatus: 'Pendiente',
    cuentaPago: ''
  });

  const lineasProducto = ['Inversión', 'Depósito a plazo', 'CETES', 'Fondos'];
  const sublineas = ['Gubernamental', 'Privada', 'Mixta', 'Inversión a un año', 'Inversión a 6 meses', 'Inversión flexible'];
  const periodicidades = ['Día', 'Mes', 'Año', 'Mensual', 'Trimestral', 'Semestral', 'Anual'];
  const estatusOpciones = ['Aceptado', 'Pendiente', 'Rechazado', 'Cancelado', 'Vencido'];
  const cuentasPago = ['CTA-001', 'CTA-002', 'CTA-003', 'CTA-004', 'CTA-005', '20124456712345'];
  const productos = [
    'CETES 28 días',
    'CETES 90 días',
    'CETES PLUS',
    'Pagaré Bancario',
    'Bonos Gubernamentales',
    'Pagos de Inversión',
    'Cuenta de Ahorro'
  ];

  // Calcular Monto Intereses automáticamente
  useEffect(() => {
    const montoPagare = parseFloat(formData.montoPagare.replace(/[^0-9.]/g, '')) || 0;
    const tasa = parseFloat(formData.tasaInteres.replace(/[^0-9.]/g, '')) || 0;
    const plazo = parseInt(formData.plazo) || 0;

    if (montoPagare > 0 && tasa > 0 && plazo > 0) {
      let factor = 1;
      if (formData.periodicidad === 'Mes' || formData.periodicidad === 'Mensual') {
        factor = plazo / 12;
      } else if (formData.periodicidad === 'Año' || formData.periodicidad === 'Anual') {
        factor = plazo;
      } else if (formData.periodicidad === 'Día') {
        factor = plazo / 365;
      } else if (formData.periodicidad === 'Trimestral') {
        factor = plazo / 4;
      } else if (formData.periodicidad === 'Semestral') {
        factor = plazo / 2;
      }
      
      const intereses = montoPagare * (tasa / 100) * factor;
      setFormData(prev => ({
        ...prev,
        montoIntereses: `$${intereses.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }));
    }
  }, [formData.montoPagare, formData.tasaInteres, formData.plazo, formData.periodicidad]);

  const handleNuevo = () => {
    setEditingId(null);
    setFormData({
      lineaProducto: '',
      sublinea: '',
      producto: '',
      plazo: '',
      periodicidad: '',
      fechaInicio: getCurrentDate(),
      fechaVencimiento: '',
      montoPagare: '',
      montoIntereses: '',
      tasaInteres: '',
      estatus: 'Pendiente',
      cuentaPago: ''
    });
    setShowModal(true);
  };

  const handleEliminar = () => {
    if (selectedInversiones.length === 0) {
      toast.error('Por favor seleccione al menos una inversión para eliminar');
      return;
    }

    setInversiones(prev => prev.filter(i => !selectedInversiones.includes(i.id)));
    const count = selectedInversiones.length;
    setSelectedInversiones([]);
    toast.success(`${count} inversión${count > 1 ? 'es' : ''} eliminada${count > 1 ? 's' : ''} exitosamente`);
  };

  const handleGuardarModal = () => {
    const warnings = [];
    
    if (!formData.lineaProducto) warnings.push('Línea de producto');
    if (!formData.sublinea) warnings.push('Sublínea');
    if (!formData.producto) warnings.push('Producto');
    if (!formData.plazo) warnings.push('Plazo');
    if (!formData.periodicidad) warnings.push('Periodicidad');
    if (!formData.fechaInicio) warnings.push('Fecha de inicio');
    if (!formData.fechaVencimiento) warnings.push('Fecha de vencimiento');
    if (!formData.montoPagare) warnings.push('Monto pagaré');
    if (!formData.tasaInteres) warnings.push('Tasa de interés');
    if (!formData.cuentaPago) warnings.push('Cuenta de pago');
    
    if (warnings.length > 0) {
      toast.warning(`Campos vacíos: ${warnings.join(', ')}. Puede completarlos posteriormente.`);
    }

    // Validar Monto Pagaré > 0
    if (formData.montoPagare) {
      const montoPagare = parseFloat(formData.montoPagare.replace(/[^0-9.]/g, ''));
      if (montoPagare <= 0) {
        toast.error('El Monto Pagaré debe ser mayor a 0');
        return;
      }
    }

    // Validar fechas
    if (formData.fechaInicio && formData.fechaVencimiento) {
      const fechaInicio = new Date(formData.fechaInicio.split('/').reverse().join('-'));
      const fechaVencimiento = new Date(formData.fechaVencimiento.split('/').reverse().join('-'));
      if (fechaVencimiento < fechaInicio) {
        toast.error('La Fecha de Vencimiento no puede ser menor a la Fecha de Inicio');
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
      setInversiones(prev => prev.map(i => 
        i.id === editingId 
          ? { ...formData, id: editingId, fechaRegistro: i.fechaRegistro, usuario: i.usuario }
          : i
      ));
      toast.success('Inversión actualizada correctamente');
    } else {
      const nuevaInversion: InversionData = {
        id: inversiones.length > 0 ? Math.max(...inversiones.map(i => i.id)) + 1 : 1,
        fechaRegistro: fechaActual,
        usuario: 'Usuario Actual',
        ...formData
      };
      setInversiones(prev => [...prev, nuevaInversion]);
      toast.success('Inversión creada correctamente');
    }

    setShowModal(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInversiones(inversiones.map(i => i.id));
    } else {
      setSelectedInversiones([]);
    }
  };

  const handleSelectInversion = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedInversiones(prev => [...prev, id]);
    } else {
      setSelectedInversiones(prev => prev.filter(iid => iid !== id));
    }
  };

  const handleVerInversion = (inversion: InversionData) => {
    setEditingId(inversion.id);
    setFormData({
      lineaProducto: inversion.lineaProducto,
      sublinea: inversion.sublinea,
      producto: inversion.producto,
      plazo: inversion.plazo,
      periodicidad: inversion.periodicidad,
      fechaInicio: inversion.fechaInicio,
      fechaVencimiento: inversion.fechaVencimiento,
      montoPagare: inversion.montoPagare,
      montoIntereses: inversion.montoIntereses,
      tasaInteres: inversion.tasaInteres,
      estatus: inversion.estatus,
      cuentaPago: inversion.cuentaPago
    });
    setShowModal(true);
  };

  return (
    <div className="bg-white">
      {/* Encabezado institucional con título y botones */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">INVERSIONES</span>
      </div>

      {/* Tabla de Inversiones */}
      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={inversiones.length > 0 && selectedInversiones.length === inversiones.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                  disabled={isView}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Registro</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Línea Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Sublínea</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Plazo</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Periodicidad</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Inicio</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Vencimiento</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Pagaré</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Intereses</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tasa Interés</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Cuenta Pago</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {inversiones.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-xs text-gray-500">
                  No hay inversiones registradas. Haga clic en "Nuevo" para agregar una.
                </td>
              </tr>
            ) : (
              inversiones.map(inversion => (
                <tr 
                  key={inversion.id} 
                  className={`border-b border-gray-300 hover:bg-gray-50 ${selectedInversiones.includes(inversion.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-3 py-2 text-center border-r border-gray-300">
                    <input
                      type="checkbox"
                      checked={selectedInversiones.includes(inversion.id)}
                      onChange={(e) => handleSelectInversion(inversion.id, e.target.checked)}
                      className="w-4 h-4"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isView}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.fechaRegistro}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.lineaProducto}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.sublinea}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.producto}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.plazo}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.periodicidad}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.fechaInicio}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.fechaVencimiento}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.montoPagare}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.montoIntereses}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.tasaInteres}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      inversion.estatus === 'Aceptado' ? 'bg-green-100 text-green-800' :
                      inversion.estatus === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                      inversion.estatus === 'Vencido' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {inversion.estatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{inversion.cuentaPago}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerInversion(inversion);
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

      {/* Modal Institucional para Nuevo/Editar Inversión */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header azul institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                {editingId !== null ? 'Editar Inversión' : 'Nueva Inversión'}
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
              <div className="py-4">
                <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
                  <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DE LA INVERSIÓN</h3>
                </div>

                <div className="space-y-4">
                  {/* Fila 1: Línea Producto, Sublínea, Producto */}
                  <div className="grid grid-cols-3 gap-6">
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
                  </div>

                  {/* Fila 2: Plazo, Periodicidad, Tasa de Interés */}
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
                        Tasa de Interés <span className="text-red-600">*</span>
                      </label>
                      <PercentageInput
                        value={formData.tasaInteres}
                        onChange={(value) => setFormData(prev => ({ ...prev, tasaInteres: value }))}
                        placeholder="5%"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>
                  </div>

                  {/* Fila 3: Fecha Inicio, Fecha Vencimiento, Estatus */}
                  <div className="grid grid-cols-3 gap-6">
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

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Fecha de Vencimiento <span className="text-red-600">*</span>
                      </label>
                      <DatePicker
                        value={formData.fechaVencimiento}
                        onChange={(date) => setFormData(prev => ({ ...prev, fechaVencimiento: date }))}
                        placeholder="DD/MM/YYYY"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Estatus <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.estatus}
                        onChange={(e) => setFormData(prev => ({ ...prev, estatus: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        {estatusOpciones.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Fila 4: Monto Pagaré, Monto Intereses, Cuenta de Pago */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Monto Pagaré <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.montoPagare}
                        onChange={(e) => setFormData(prev => ({ ...prev, montoPagare: e.target.value }))}
                        placeholder="$ 0.00"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Monto Intereses (Calculado)
                      </label>
                      <input
                        type="text"
                        value={formData.montoIntereses}
                        readOnly
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Cuenta de Pago <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.cuentaPago}
                        onChange={(e) => setFormData(prev => ({ ...prev, cuentaPago: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option value="">Seleccione...</option>
                        {cuentasPago.map(cuenta => (
                          <option key={cuenta} value={cuenta}>{cuenta}</option>
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