import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { DatePicker } from './DatePicker';

interface Credito {
  id: number;
  folio: string;
  producto: string;
  montoSolicitado: number;
  plazos: number;
  periodoPagos: string;
  pagoPeriodo: number;
  estatus: string;
  estatusCredito: string;
  montoTotal: number;
  totalPagado: number;
  numeroPagos: number;
  fechaUltimoPago: string;
  seleccionado: boolean;
}

interface Pago {
  id: number;
  secuencia: number;
  referencia: string;
  fechaPago: string;
  pago: number;
  metodoPago: string;
  socio: string;
  cuenta: string;
  propCapital: number;
  propInteres: number;
  propIVA: number;
  propSeguro: number;
  propIVASeguro: number;
  seleccionado: boolean;
}

interface EstadoCuentaProps {
  clienteId?: string;
  mode?: 'nuevo' | 'editar' | 'ver';
  isView?: boolean;
}

export function EstadoCuenta({ clienteId, mode, isView }: EstadoCuentaProps = {}) {
  const storageKey = `cliente_${clienteId || 'temp'}_estado_cuenta`;
  const readOnly = isView || mode === 'ver';
  
  // Función para cargar datos persistidos
  const loadPersistedData = (key: string, defaultValue: any) => {
    try {
      if (mode === 'nuevo') return [];
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error('Error loading persisted data:', error);
      return defaultValue;
    }
  };

  const [showModalCredito, setShowModalCredito] = useState(false);
  const [showModalPago, setShowModalPago] = useState(false);
  const [modeCredito, setModeCredito] = useState<'create' | 'edit' | 'view'>('create');
  const [modePago, setModePago] = useState<'create' | 'edit' | 'view'>('create');
  const [editingCredito, setEditingCredito] = useState<Credito | null>(null);
  const [editingPago, setEditingPago] = useState<Pago | null>(null);

  // Créditos activos del cliente
  const [creditos, setCreditos] = useState<Credito[]>(() =>
    loadPersistedData(storageKey + '_creditos', [])
  );

  const [pagos, setPagos] = useState<Pago[]>(() =>
    loadPersistedData(storageKey + '_pagos', [])
  );

  const [selectedCreditos, setSelectedCreditos] = useState<number[]>([]);
  const [selectedPagos, setSelectedPagos] = useState<number[]>([]);

  // Guardar en sessionStorage cuando cambien los datos
  useEffect(() => {
    sessionStorage.setItem(storageKey + '_creditos', JSON.stringify(creditos));
  }, [creditos, storageKey]);

  useEffect(() => {
    sessionStorage.setItem(storageKey + '_pagos', JSON.stringify(pagos));
  }, [pagos, storageKey]);

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Funciones para créditos
  const handleNuevoCredito = () => {
    setModeCredito('create');
    setEditingCredito(null);
    setShowModalCredito(true);
  };

  const handleEliminarCredito = () => {
    if (selectedCreditos.length === 0) {
      toast.error('Por favor seleccione al menos un crédito para eliminar');
      return;
    }

    setCreditos(prev => prev.filter(c => !selectedCreditos.includes(c.id)));
    const count = selectedCreditos.length;
    setSelectedCreditos([]);
    toast.success(`${count} crédito${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  const handleEditCredito = (credito: Credito) => {
    setModeCredito('edit');
    setEditingCredito(credito);
    setShowModalCredito(true);
  };

  const handleSelectAllCreditos = (checked: boolean) => {
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

  // Funciones para pagos
  const handleNuevoPago = () => {
    setModePago('create');
    setEditingPago(null);
    setShowModalPago(true);
  };

  const handleEliminarPago = () => {
    if (selectedPagos.length === 0) {
      toast.error('Por favor seleccione al menos un pago para eliminar');
      return;
    }

    setPagos(prev => prev.filter(p => !selectedPagos.includes(p.id)));
    const count = selectedPagos.length;
    setSelectedPagos([]);
    toast.success(`${count} pago${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  const handleEditPago = (pago: Pago) => {
    setModePago('edit');
    setEditingPago(pago);
    setShowModalPago(true);
  };

  const handleSelectAllPagos = (checked: boolean) => {
    if (checked) {
      setSelectedPagos(pagos.map(p => p.id));
    } else {
      setSelectedPagos([]);
    }
  };

  const handleSelectPago = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedPagos(prev => [...prev, id]);
    } else {
      setSelectedPagos(prev => prev.filter(pid => pid !== id));
    }
  };

  return (
    <div className="bg-white">
      {/* SECCIÓN: CRÉDITOS ACTIVOS */}
      <div className="mb-6">
        {/* Encabezado institucional con fondo azul claro, borde izquierdo y botones */}
        <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-800">CRÉDITOS ACTIVOS</span>
          <div className="flex items-center gap-2">
          </div>
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
                    onChange={(e) => handleSelectAllCreditos(e.target.checked)}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Folio</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Producto</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto solicitado</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Plazos</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Periodo de pagos</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Pago de periodo</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus del crédito</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto total</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Total pagado</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">N° pagos</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800">Último pago</th>
              </tr>
            </thead>
            <tbody>
              {creditos.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-gray-500 text-xs border-b border-gray-300">
                    No hay créditos registrados
                  </td>
                </tr>
              ) : (
                creditos.map((credito, index) => (
                  <tr
                    key={credito.id}
                    onDoubleClick={() => handleEditCredito(credito)}
                    className={`border-b border-gray-300 hover:bg-gray-50 cursor-pointer ${
                      selectedCreditos.includes(credito.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-center border-r border-gray-300">
                      <input
                        type="checkbox"
                        checked={selectedCreditos.includes(credito.id)}
                        onChange={(e) => handleSelectCredito(credito.id, e.target.checked)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{credito.folio}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{credito.producto}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{formatMoney(credito.montoSolicitado)}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{credito.plazos}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{credito.periodoPagos}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{formatMoney(credito.pagoPeriodo)}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{credito.estatus}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{credito.estatusCredito}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{formatMoney(credito.montoTotal)}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{formatMoney(credito.totalPagado)}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{credito.numeroPagos}</td>
                    <td className="px-3 py-2 text-gray-700">{credito.fechaUltimoPago}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN: RESUMEN DE COBROS */}
      <div>
        {/* Encabezado institucional con fondo azul claro, borde izquierdo y botones */}
        <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-800">RESUMEN DE COBROS</span>
          <div className="flex items-center gap-2">
          </div>
        </div>

        {/* Tabla de Pagos */}
        <div className="border border-gray-300">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
                <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={pagos.length > 0 && selectedPagos.length === pagos.length}
                    onChange={(e) => handleSelectAllPagos(e.target.checked)}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">N° Secuencia</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Referencia</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha de pago</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Pago</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Método de pago</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Socio</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Cuenta</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Prop. Capital</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Prop. Interés</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Prop. IVA</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Prop. Seguro</th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800">Prop. IVA Seg.</th>
              </tr>
            </thead>
            <tbody>
              {pagos.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-gray-500 text-xs border-b border-gray-300">
                    No hay pagos registrados
                  </td>
                </tr>
              ) : (
                pagos.map((pago, index) => (
                  <tr
                    key={pago.id}
                    onDoubleClick={() => handleEditPago(pago)}
                    className={`border-b border-gray-300 hover:bg-gray-50 cursor-pointer ${
                      selectedPagos.includes(pago.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-center border-r border-gray-300">
                      <input
                        type="checkbox"
                        checked={selectedPagos.includes(pago.id)}
                        onChange={(e) => handleSelectPago(pago.id, e.target.checked)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{pago.secuencia}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{pago.referencia}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{pago.fechaPago}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{formatMoney(pago.pago)}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{pago.metodoPago}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{pago.socio}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{pago.cuenta}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{formatMoney(pago.propCapital)}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{formatMoney(pago.propInteres)}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{formatMoney(pago.propIVA)}</td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{formatMoney(pago.propSeguro)}</td>
                    <td className="px-3 py-2 text-gray-700">{formatMoney(pago.propIVASeguro)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PARA CRÉDITOS */}
      {showModalCredito && (
        <ModalCredito
          mode={modeCredito}
          credito={editingCredito}
          onSave={(creditoData) => {
            if (modeCredito === 'create') {
              const newCredito: Credito = {
                id: creditos.length > 0 ? Math.max(...creditos.map(c => c.id)) + 1 : 1,
                ...creditoData,
                seleccionado: false
              };
              setCreditos([...creditos, newCredito]);
              toast.success('Crédito creado correctamente');
            } else {
              setCreditos(creditos.map(c =>
                c.id === editingCredito?.id ? { ...c, ...creditoData } : c
              ));
              toast.success('Crédito actualizado correctamente');
            }
            setShowModalCredito(false);
          }}
          onClose={() => setShowModalCredito(false)}
        />
      )}

      {/* MODAL PARA PAGOS */}
      {showModalPago && (
        <ModalPago
          mode={modePago}
          pago={editingPago}
          onSave={(pagoData) => {
            if (modePago === 'create') {
              const newPago: Pago = {
                id: pagos.length > 0 ? Math.max(...pagos.map(p => p.id)) + 1 : 1,
                secuencia: pagos.length > 0 ? Math.max(...pagos.map(p => p.secuencia)) + 1 : 1,
                ...pagoData,
                seleccionado: false
              };
              setPagos([...pagos, newPago]);
              toast.success('Pago registrado correctamente');
            } else {
              setPagos(pagos.map(p =>
                p.id === editingPago?.id ? { ...p, ...pagoData } : p
              ));
              toast.success('Pago actualizado correctamente');
            }
            setShowModalPago(false);
          }}
          onClose={() => setShowModalPago(false)}
        />
      )}
    </div>
  );
}

// MODAL PARA CRÉDITOS
interface ModalCreditoProps {
  mode: 'create' | 'edit' | 'view';
  credito: Credito | null;
  onSave: (data: any) => void;
  onClose: () => void;
}

function ModalCredito({ mode, credito, onSave, onClose }: ModalCreditoProps) {
  const [formData, setFormData] = useState({
    folio: credito?.folio || '',
    producto: credito?.producto || '',
    montoSolicitado: credito?.montoSolicitado || 0,
    plazos: credito?.plazos || 0,
    periodoPagos: credito?.periodoPagos || 'Quincenal',
    pagoPeriodo: credito?.pagoPeriodo || 0,
    estatus: credito?.estatus || 'Atendida',
    estatusCredito: credito?.estatusCredito || 'Activo',
    montoTotal: credito?.montoTotal || 0,
    totalPagado: credito?.totalPagado || 0,
    numeroPagos: credito?.numeroPagos || 0,
    fechaUltimoPago: credito?.fechaUltimoPago || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.folio.trim()) newErrors.folio = 'El folio es requerido';
    if (!formData.producto.trim()) newErrors.producto = 'El producto es requerido';
    if (formData.montoSolicitado <= 0) newErrors.montoSolicitado = 'El monto debe ser mayor a 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Formulario incompleto', {
        description: 'Por favor complete todos los campos requeridos',
      });
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header azul institucional */}
        <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
          <h3 className="text-base font-medium text-white">
            {mode === 'create' ? 'Nuevo Crédito' : 'Editar Crédito'}
          </h3>
          <button
            onClick={onClose}
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
            {/* Barra de sección gris */}
            <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
              <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DEL CRÉDITO</h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Fila 1 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Folio <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      value={formData.folio}
                      onChange={(e) => handleChange('folio', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                    {errors.folio && <p className="text-red-600 text-[10px] mt-1">{errors.folio}</p>}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Producto <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      value={formData.producto}
                      onChange={(e) => handleChange('producto', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                    {errors.producto && <p className="text-red-600 text-[10px] mt-1">{errors.producto}</p>}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Monto Solicitado <span className="text-red-600">*</span></label>
                    <input
                      type="number"
                      value={formData.montoSolicitado}
                      onChange={(e) => handleChange('montoSolicitado', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                    {errors.montoSolicitado && <p className="text-red-600 text-[10px] mt-1">{errors.montoSolicitado}</p>}
                  </div>
                </div>

                {/* Fila 2 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Plazos</label>
                    <input
                      type="number"
                      value={formData.plazos}
                      onChange={(e) => handleChange('plazos', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Periodo de Pagos</label>
                    <select
                      value={formData.periodoPagos}
                      onChange={(e) => handleChange('periodoPagos', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    >
                      <option value="Quincenal">Quincenal</option>
                      <option value="Mensual">Mensual</option>
                      <option value="Semanal">Semanal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Pago por Periodo</label>
                    <input
                      type="number"
                      value={formData.pagoPeriodo}
                      onChange={(e) => handleChange('pagoPeriodo', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>
                </div>

                {/* Fila 3 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Estatus</label>
                    <select
                      value={formData.estatus}
                      onChange={(e) => handleChange('estatus', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    >
                      <option value="Atendida">Atendida</option>
                      <option value="Pendiente">Pendiente</option>
                      <option value="Rechazada">Rechazada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Estatus del Crédito</label>
                    <select
                      value={formData.estatusCredito}
                      onChange={(e) => handleChange('estatusCredito', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    >
                      <option value="Activo">Activo</option>
                      <option value="Liquidado">Liquidado</option>
                      <option value="Vencido">Vencido</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Monto Total</label>
                    <input
                      type="number"
                      value={formData.montoTotal}
                      onChange={(e) => handleChange('montoTotal', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>
                </div>

                {/* Fila 4 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Total Pagado</label>
                    <input
                      type="number"
                      value={formData.totalPagado}
                      onChange={(e) => handleChange('totalPagado', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Número de Pagos</label>
                    <input
                      type="number"
                      value={formData.numeroPagos}
                      onChange={(e) => handleChange('numeroPagos', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de Último Pago</label>
                    <DatePicker
                      value={formData.fechaUltimoPago}
                      onChange={(date) => handleChange('fechaUltimoPago', date)}
                      placeholder="DD/MM/YYYY"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Footer con botones */}
              <div className="border-t border-gray-200 px-0 py-4 mt-6 bg-gray-50 -mx-6 px-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90 font-medium"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// MODAL PARA PAGOS
interface ModalPagoProps {
  mode: 'create' | 'edit' | 'view';
  pago: Pago | null;
  onSave: (data: any) => void;
  onClose: () => void;
}

function ModalPago({ mode, pago, onSave, onClose }: ModalPagoProps) {
  const [formData, setFormData] = useState({
    referencia: pago?.referencia || '',
    fechaPago: pago?.fechaPago || '',
    pago: pago?.pago || 0,
    metodoPago: pago?.metodoPago || 'Descuento nómina',
    socio: pago?.socio || '',
    cuenta: pago?.cuenta || '',
    propCapital: pago?.propCapital || 0,
    propInteres: pago?.propInteres || 0,
    propIVA: pago?.propIVA || 0,
    propSeguro: pago?.propSeguro || 0,
    propIVASeguro: pago?.propIVASeguro || 0
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.referencia.trim()) newErrors.referencia = 'La referencia es requerida';
    if (!formData.fechaPago.trim()) newErrors.fechaPago = 'La fecha de pago es requerida';
    if (formData.pago <= 0) newErrors.pago = 'El monto del pago debe ser mayor a 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Formulario incompleto', {
        description: 'Por favor complete todos los campos requeridos',
      });
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header azul institucional */}
        <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
          <h3 className="text-base font-medium text-white">
            {mode === 'create' ? 'Nuevo Pago' : 'Editar Pago'}
          </h3>
          <button
            onClick={onClose}
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
            {/* Barra de sección gris */}
            <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
              <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DEL PAGO</h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Fila 1 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Referencia <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      value={formData.referencia}
                      onChange={(e) => handleChange('referencia', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                    {errors.referencia && <p className="text-red-600 text-[10px] mt-1">{errors.referencia}</p>}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de Pago <span className="text-red-600">*</span></label>
                    <DatePicker
                      value={formData.fechaPago}
                      onChange={(date) => handleChange('fechaPago', date)}
                      placeholder="DD/MM/YYYY"
                      className="w-full"
                    />
                    {errors.fechaPago && <p className="text-red-600 text-[10px] mt-1">{errors.fechaPago}</p>}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Monto del Pago <span className="text-red-600">*</span></label>
                    <input
                      type="number"
                      value={formData.pago}
                      onChange={(e) => handleChange('pago', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                    {errors.pago && <p className="text-red-600 text-[10px] mt-1">{errors.pago}</p>}
                  </div>
                </div>

                {/* Fila 2 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Método de Pago</label>
                    <select
                      value={formData.metodoPago}
                      onChange={(e) => handleChange('metodoPago', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    >
                      <option value="Descuento nómina">Descuento nómina</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Socio</label>
                    <input
                      type="text"
                      value={formData.socio}
                      onChange={(e) => handleChange('socio', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Cuenta</label>
                    <input
                      type="text"
                      value={formData.cuenta}
                      onChange={(e) => handleChange('cuenta', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>
                </div>

                {/* Fila 3 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Proporción Capital</label>
                    <input
                      type="number"
                      value={formData.propCapital}
                      onChange={(e) => handleChange('propCapital', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Proporción Interés</label>
                    <input
                      type="number"
                      value={formData.propInteres}
                      onChange={(e) => handleChange('propInteres', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Proporción IVA</label>
                    <input
                      type="number"
                      value={formData.propIVA}
                      onChange={(e) => handleChange('propIVA', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>
                </div>

                {/* Fila 4 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Proporción Seguro</label>
                    <input
                      type="number"
                      value={formData.propSeguro}
                      onChange={(e) => handleChange('propSeguro', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Proporción IVA Seguro</label>
                    <input
                      type="number"
                      value={formData.propIVASeguro}
                      onChange={(e) => handleChange('propIVASeguro', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Footer con botones */}
              <div className="border-t border-gray-200 px-0 py-4 mt-6 bg-gray-50 -mx-6 px-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90 font-medium"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}