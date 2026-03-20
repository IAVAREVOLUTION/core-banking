import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DatePicker } from './DatePicker';

interface AvisosProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
}

interface AvisoData {
  id: number;
  fechaEmision: string;
  numeroReferencia: string;
  tipo: 'Pagar' | 'Cobrar';
  montoTotal: string;
  pagoTotal: string;
  saldo: string;
  estatus: string;
  condicionPago: string;
  observaciones: string;
  fechaVencimiento: string;
}

export function Avisos({ onBack, mode, clienteId }: AvisosProps) {
  const isView = mode === 'ver';
  const storageKey = `cliente_${clienteId || 'temp'}_avisos`;
  
  const getCurrentDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // SIEMPRE inicia vacío. Datos se cargan solo desde sessionStorage vinculado al clienteId.
  const [avisos, setAvisos] = useState<AvisoData[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [filtroTipo, setFiltroTipo] = useState<'Todos' | 'Pagar' | 'Cobrar'>('Todos');
  const [selectedAvisos, setSelectedAvisos] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    fechaEmision: getCurrentDate(),
    numeroReferencia: '',
    tipo: '' as 'Pagar' | 'Cobrar' | '',
    montoTotal: '',
    pagoTotal: '',
    saldo: '',
    estatus: 'Pendiente',
    condicionPago: '',
    observaciones: '',
    fechaVencimiento: ''
  });

  // Catálogos
  const tiposAviso = ['Pagar', 'Cobrar'];
  const estatusOpciones = ['Pendiente', 'Pagado', 'Vencido', 'Cancelado'];
  const condicionesPago = [
    'Cobro a través de cuenta eje',
    'Pago a través de cuenta eje',
    'Pago a proveedor',
    'Cobro directo',
    'Pago directo',
    'Transferencia bancaria'
  ];

  // Persistir avisos en sessionStorage
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(avisos));
  }, [avisos, storageKey]);

  // Calcular saldo automáticamente
  useEffect(() => {
    const montoTotal = parseFloat(formData.montoTotal.replace(/[^0-9.]/g, '')) || 0;
    const pagoTotal = parseFloat(formData.pagoTotal.replace(/[^0-9.]/g, '')) || 0;
    
    const saldo = montoTotal - pagoTotal;
    setFormData(prev => ({
      ...prev,
      saldo: `$${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }));
  }, [formData.montoTotal, formData.pagoTotal]);

  // Filtrar avisos según el tipo seleccionado
  const avisosFiltrados = avisos.filter(aviso => {
    if (filtroTipo === 'Todos') return true;
    return aviso.tipo === filtroTipo;
  });

  const handleNuevo = () => {
    setEditingId(null);
    setFormData({
      fechaEmision: getCurrentDate(),
      numeroReferencia: '',
      tipo: '',
      montoTotal: '',
      pagoTotal: '',
      saldo: '',
      estatus: 'Pendiente',
      condicionPago: '',
      observaciones: '',
      fechaVencimiento: ''
    });
    setShowModal(true);
  };

  const handleEliminar = () => {
    if (selectedAvisos.length === 0) {
      toast.error('Por favor seleccione al menos un aviso para eliminar');
      return;
    }

    setAvisos(prev => prev.filter(a => !selectedAvisos.includes(a.id)));
    const count = selectedAvisos.length;
    setSelectedAvisos([]);
    toast.success(`${count} aviso${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  const handleGuardarModal = () => {
    const warnings = [];
    
    if (!formData.numeroReferencia) warnings.push('Número de referencia');
    if (!formData.tipo) warnings.push('Tipo');
    if (!formData.montoTotal) warnings.push('Monto total');
    if (!formData.condicionPago) warnings.push('Condición de pago');
    if (!formData.fechaVencimiento) warnings.push('Fecha de vencimiento');
    
    if (warnings.length > 0) {
      toast.warning(`Campos vacíos: ${warnings.join(', ')}. Puede completarlos posteriormente.`);
    }

    // Validar Monto Total > 0
    if (formData.montoTotal) {
      const montoTotal = parseFloat(formData.montoTotal.replace(/[^0-9.]/g, ''));
      if (montoTotal <= 0) {
        toast.error('El Monto Total debe ser mayor a 0');
        return;
      }
    }

    // Validar Pago Total <= Monto Total
    if (formData.montoTotal && formData.pagoTotal) {
      const montoTotal = parseFloat(formData.montoTotal.replace(/[^0-9.]/g, ''));
      const pagoTotal = parseFloat(formData.pagoTotal.replace(/[^0-9.]/g, ''));
      if (pagoTotal > montoTotal) {
        toast.error('El Pago Total no puede ser mayor al Monto Total');
        return;
      }
    }

    if (editingId !== null) {
      setAvisos(prev => prev.map(a => 
        a.id === editingId 
          ? { ...formData as any, id: editingId }
          : a
      ));
      toast.success('Aviso actualizado correctamente');
    } else {
      const nuevoAviso: AvisoData = {
        id: avisos.length > 0 ? Math.max(...avisos.map(a => a.id)) + 1 : 1,
        ...formData as any
      };
      setAvisos(prev => [...prev, nuevoAviso]);
      toast.success('Aviso creado correctamente');
    }

    setShowModal(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAvisos(avisosFiltrados.map(a => a.id));
    } else {
      setSelectedAvisos([]);
    }
  };

  const handleSelectAviso = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedAvisos(prev => [...prev, id]);
    } else {
      setSelectedAvisos(prev => prev.filter(aid => aid !== id));
    }
  };

  const handleVerAviso = (aviso: AvisoData) => {
    setEditingId(aviso.id);
    setFormData({
      fechaEmision: aviso.fechaEmision,
      numeroReferencia: aviso.numeroReferencia,
      tipo: aviso.tipo,
      montoTotal: aviso.montoTotal,
      pagoTotal: aviso.pagoTotal,
      saldo: aviso.saldo,
      estatus: aviso.estatus,
      condicionPago: aviso.condicionPago,
      observaciones: aviso.observaciones,
      fechaVencimiento: aviso.fechaVencimiento
    });
    setShowModal(true);
  };

  return (
    <div className="bg-white">
      {/* Encabezado institucional con fondo azul claro, borde izquierdo y botones */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">AVISOS</span>
      </div>

      {/* Filtro por tipo de aviso - adaptado al diseño institucional */}
      <div className="px-3 mb-3">
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-300 px-3 py-2 rounded">
          <label className="text-xs font-medium text-gray-700 whitespace-nowrap">Filtrar por tipo:</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as 'Todos' | 'Pagar' | 'Cobrar')}
            className="px-2 py-1 border border-gray-300 text-xs rounded bg-white"
          >
            <option value="Todos">Todos</option>
            <option value="Pagar">Por pagar</option>
            <option value="Cobrar">Por cobrar</option>
          </select>
          <span className="text-xs text-gray-600">
            ({avisosFiltrados.length} de {avisos.length})
          </span>
        </div>
      </div>

      {/* Tabla de Avisos */}
      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={avisosFiltrados.length > 0 && selectedAvisos.length === avisosFiltrados.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                  disabled={isView}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha de Emisión</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Número de Referencia</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tipo</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Total</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Pago Total</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Saldo</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Condición de Pago</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Observaciones</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha de Vencimiento</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {avisosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-xs text-gray-500">
                  No hay avisos registrados. Haga clic en "Nuevo" para agregar uno.
                </td>
              </tr>
            ) : (
              avisosFiltrados.map((aviso) => (
                <tr 
                  key={aviso.id} 
                  className={`border-b border-gray-300 hover:bg-gray-50 ${selectedAvisos.includes(aviso.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-3 py-2 text-center border-r border-gray-300">
                    <input
                      type="checkbox"
                      checked={selectedAvisos.includes(aviso.id)}
                      onChange={(e) => handleSelectAviso(aviso.id, e.target.checked)}
                      className="w-4 h-4"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isView}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{aviso.fechaEmision}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{aviso.numeroReferencia}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      aviso.tipo === 'Cobrar' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {aviso.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{aviso.montoTotal}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{aviso.pagoTotal}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{aviso.saldo}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      aviso.estatus === 'Pagado' ? 'bg-green-100 text-green-800' :
                      aviso.estatus === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                      aviso.estatus === 'Vencido' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {aviso.estatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{aviso.condicionPago}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{aviso.observaciones}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{aviso.fechaVencimiento}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerAviso(aviso);
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

      {/* Modal Institucional para Nuevo/Editar Aviso */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header azul institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                {editingId !== null ? 'Editar Aviso' : 'Nuevo Aviso'}
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
                  <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DEL AVISO</h3>
                </div>

                <div className="space-y-4">
                  {/* Fila 1: Fecha Emisión, Número Referencia, Tipo */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Fecha de Emisión
                      </label>
                      <DatePicker
                        value={formData.fechaEmision}
                        onChange={(date) => setFormData(prev => ({ ...prev, fechaEmision: date }))}
                        placeholder="DD/MM/YYYY"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Número de Referencia <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.numeroReferencia}
                        onChange={(e) => setFormData(prev => ({ ...prev, numeroReferencia: e.target.value }))}
                        placeholder="1686519844"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Tipo <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.tipo}
                        onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as 'Pagar' | 'Cobrar' }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option value="">Seleccione...</option>
                        {tiposAviso.map(tipo => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Fila 2: Monto Total, Pago Total, Saldo */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Monto Total <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.montoTotal}
                        onChange={(e) => setFormData(prev => ({ ...prev, montoTotal: e.target.value }))}
                        placeholder="$ 0.00"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Pago Total
                      </label>
                      <input
                        type="text"
                        value={formData.pagoTotal}
                        onChange={(e) => setFormData(prev => ({ ...prev, pagoTotal: e.target.value }))}
                        placeholder="$ 0.00"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Saldo (Calculado)
                      </label>
                      <input
                        type="text"
                        value={formData.saldo}
                        readOnly
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                      />
                    </div>
                  </div>

                  {/* Fila 3: Estatus, Fecha Vencimiento, Condición Pago */}
                  <div className="grid grid-cols-3 gap-6">
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
                        Condición de Pago <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.condicionPago}
                        onChange={(e) => setFormData(prev => ({ ...prev, condicionPago: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option value="">Seleccione...</option>
                        {condicionesPago.map(condicion => (
                          <option key={condicion} value={condicion}>{condicion}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Fila 4: Observaciones */}
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">
                      Observaciones
                    </label>
                    <textarea
                      value={formData.observaciones}
                      onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                      placeholder="Ingrese observaciones adicionales..."
                      rows={3}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white resize-none"
                    />
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
                className="px-5 py-2 text-sm btn-secondary-theme rounded font-medium"
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