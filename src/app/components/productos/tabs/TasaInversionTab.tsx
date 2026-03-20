import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';

interface PeriodoDisponible {
  periodoId: number;
  descripcion: string;
  dias: number;
}

interface TasaInversionTabProps {
  mode: 'nuevo' | 'editar' | 'ver' | 'create' | 'edit' | 'view';
  productId?: number | string;
  initialData?: TasaInversionItem[];
  persistToStorage?: boolean;
  periodosDisponibles?: PeriodoDisponible[];
}

interface TasaInversionItem {
  id: number;
  tipoProducto: string;
  empleado: string;
  minimoEmpleado: string;
  plazo: string;
  periodoId: number;
  periodoDescripcion: string;
  tasaMinima: string;
  tasaInicial: string;
  tasaMaxima: string;
  porcentajeIncremento: string;
  inicioVigencia: string;
  finVigencia: string;
  estatus: string;
  vigenciaTasas: string;
  tipoTasa: string;
}

// FIX: Sin registros automaticos. Vacio hasta captura manual del usuario.
const defaultTasaInversionData: TasaInversionItem[] = [];

export const TasaInversionTab = forwardRef<{ getData: () => TasaInversionItem[] }, TasaInversionTabProps>(
  ({ mode, productId, initialData, persistToStorage, periodosDisponibles }, ref) => {
    const storageKey = persistToStorage && productId ? `captacion_tasainversion_${productId}` : '';

    const getInitialData = (): TasaInversionItem[] => {
      if (storageKey) {
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) return JSON.parse(stored);
        } catch (e) { /* ignore */ }
      }
      if (initialData && initialData.length > 0) return initialData;
      return defaultTasaInversionData;
    };

    const [data, setData] = useState<TasaInversionItem[]>(getInitialData);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<TasaInversionItem | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

    const isViewMode = mode === 'ver' || mode === 'view';

    useImperativeHandle(ref, () => ({ getData: () => data }));

    useEffect(() => {
      if (storageKey) {
        try { sessionStorage.setItem(storageKey, JSON.stringify(data)); } catch (e) { /* ignore */ }
      }
    }, [data, storageKey]);

    const emptyForm = {
      tipoProducto: 'Inversion',
      empleado: '',
      minimoEmpleado: '',
      plazo: '',
      periodoId: 0,
      periodoDescripcion: '',
      tasaMinima: '',
      tasaInicial: '',
      tasaMaxima: '',
      porcentajeIncremento: '',
      inicioVigencia: '',
      finVigencia: '',
      estatus: 'Activo',
      vigenciaTasas: 'Vigente',
      tipoTasa: 'Fija',
    };

    const [formData, setFormData] = useState(emptyForm);

    const handleDecimalInput = (value: string): string => {
      // Solo permite digitos y un punto decimal con hasta 2 decimales
      const cleaned = value.replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      if (parts.length > 2) return parts[0] + '.' + parts[1];
      if (parts[1] && parts[1].length > 2) return parts[0] + '.' + parts[1].slice(0, 2);
      return cleaned;
    };

    const handleOpenNew = () => {
      setEditingItem(null);
      setFormData(emptyForm);
      setShowModal(true);
    };

    const handleOpenEdit = (item: TasaInversionItem) => {
      if (isViewMode) return;
      setEditingItem(item);
      setFormData({
        tipoProducto: item.tipoProducto,
        empleado: item.empleado,
        minimoEmpleado: item.minimoEmpleado,
        plazo: item.plazo,
        periodoId: item.periodoId,
        periodoDescripcion: item.periodoDescripcion,
        tasaMinima: item.tasaMinima,
        tasaInicial: item.tasaInicial,
        tasaMaxima: item.tasaMaxima,
        porcentajeIncremento: item.porcentajeIncremento,
        inicioVigencia: item.inicioVigencia,
        finVigencia: item.finVigencia,
        estatus: item.estatus,
        vigenciaTasas: item.vigenciaTasas,
        tipoTasa: item.tipoTasa,
      });
      setShowModal(true);
    };

    const handleSave = () => {
      if (!formData.plazo.trim()) {
        toast.error('El campo Plazo es requerido');
        return;
      }

      if (editingItem) {
        setData(data.map(d => d.id === editingItem.id ? { ...d, ...formData } : d));
        toast.success('Registro actualizado');
      } else {
        const newId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1;
        setData([...data, { id: newId, ...formData }]);
        toast.success('Registro agregado');
      }
      setShowModal(false);
    };

    const handleRequestDelete = (id: number) => {
      setDeleteTarget(id);
      setShowDeleteModal(true);
    };

    const confirmDelete = () => {
      if (deleteTarget !== null) {
        setData(data.filter(d => d.id !== deleteTarget));
        toast.success('Registro eliminado');
      }
      setShowDeleteModal(false);
      setDeleteTarget(null);
    };

    const handlePeriodoChange = (periodoId: number) => {
      const periodo = periodosDisponibles?.find(p => p.periodoId === periodoId);
      setFormData({
        ...formData,
        periodoId,
        periodoDescripcion: periodo?.descripcion || '',
      });
    };

    return (
      <div>
        {/* Header */}
        <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
          <span className="text-xs font-semibold tracking-wide uppercase">Tasas de Inversion</span>
          {!isViewMode && (
            <button
              onClick={handleOpenNew}
              className="px-4 py-1 rounded text-xs font-medium transition-colors bg-white/20 text-white hover:bg-white/30"
            >
              + Nuevo
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="table-header-theme">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">Tipo Producto</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">Plazo</th>
                  <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">Periodo</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">Tasa Minima</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">Tasa Inicial</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">Tasa Maxima</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">% Incremento</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">Tipo Tasa</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">Estatus</th>
                  <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">Inicio Vigencia</th>
                  <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide whitespace-nowrap">Fin Vigencia</th>
                  {!isViewMode && (
                    <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-24">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={isViewMode ? 11 : 12} className="px-3 py-8 text-center text-gray-400 text-xs">
                      <div className="flex flex-col items-center gap-1">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                          <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span>No hay tasas de inversion configuradas</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`row-hover-theme transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}
                      onDoubleClick={() => handleOpenEdit(item)}
                    >
                      <td className="px-3 py-1.5 border-b border-gray-200 font-medium text-gray-700">{item.tipoProducto}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">{item.plazo}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200">{item.periodoDescripcion || '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">{item.tasaMinima || '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">{item.tasaInicial || '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">{item.tasaMaxima || '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">{item.porcentajeIncremento || '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">{item.tipoTasa}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          item.estatus === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                        }`}>
                          {item.estatus}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-gray-600 whitespace-nowrap">{item.inicioVigencia || '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-gray-600 whitespace-nowrap">{item.finVigencia || '—'}</td>
                      {!isViewMode && (
                        <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Editar"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRequestDelete(item.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Nuevo/Editar */}
        {showModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setShowModal(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-theme px-5 py-3 flex items-center justify-between sticky top-0 z-10">
                <span className="text-sm font-semibold tracking-wide uppercase">
                  {editingItem ? 'Editar Tasa de Inversion' : 'Nueva Tasa de Inversion'}
                </span>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                  title="Cerrar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Tipo Producto</label>
                    <select
                      value={formData.tipoProducto}
                      onChange={(e) => setFormData({ ...formData, tipoProducto: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                    >
                      <option value="Inversion">Inversion</option>
                      <option value="Ahorro">Ahorro</option>
                      <option value="Cuenta Corriente">Cuenta Corriente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Tipo Tasa</label>
                    <select
                      value={formData.tipoTasa}
                      onChange={(e) => setFormData({ ...formData, tipoTasa: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                    >
                      <option value="Fija">Fija</option>
                      <option value="Variable">Variable</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Empleado</label>
                    <input
                      type="text"
                      value={formData.empleado}
                      onChange={(e) => setFormData({ ...formData, empleado: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="$0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Minimo Empleado</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.minimoEmpleado}
                      onChange={(e) => setFormData({ ...formData, minimoEmpleado: handleDecimalInput(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Plazo <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.plazo}
                      onChange={(e) => setFormData({ ...formData, plazo: handleDecimalInput(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Periodo</label>
                    <select
                      value={formData.periodoId || ''}
                      onChange={(e) => handlePeriodoChange(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                    >
                      <option value="">Seleccione...</option>
                      {(periodosDisponibles || []).map((p) => (
                        <option key={p.periodoId} value={p.periodoId}>{p.descripcion}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">% Incremento</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.porcentajeIncremento}
                      onChange={(e) => setFormData({ ...formData, porcentajeIncremento: handleDecimalInput(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Tasa Minima</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.tasaMinima}
                      onChange={(e) => setFormData({ ...formData, tasaMinima: handleDecimalInput(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Tasa Inicial</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.tasaInicial}
                      onChange={(e) => setFormData({ ...formData, tasaInicial: handleDecimalInput(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Tasa Maxima</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.tasaMaxima}
                      onChange={(e) => setFormData({ ...formData, tasaMaxima: handleDecimalInput(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Inicio Vigencia</label>
                    <input
                      type="date"
                      value={formData.inicioVigencia}
                      onChange={(e) => setFormData({ ...formData, inicioVigencia: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Fin Vigencia</label>
                    <input
                      type="date"
                      value={formData.finVigencia}
                      onChange={(e) => setFormData({ ...formData, finVigencia: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Estatus</label>
                    <select
                      value={formData.estatus}
                      onChange={(e) => setFormData({ ...formData, estatus: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                    >
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Vigencia Tasas</label>
                    <select
                      value={formData.vigenciaTasas}
                      onChange={(e) => setFormData({ ...formData, vigenciaTasas: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                    >
                      <option value="Vigente">Vigente</option>
                      <option value="No Vigente">No Vigente</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium transition-colors shadow-sm"
                  >
                    {editingItem ? 'Guardar Cambios' : 'Agregar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal confirmacion eliminacion */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-[440px] mx-4 overflow-hidden">
              <div className="modal-header-theme px-5 py-3">
                <h3 className="text-sm font-semibold text-white">Confirmar Eliminacion</h3>
              </div>
              <div className="px-6 py-6 flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">Eliminar esta tasa de inversion?</p>
                  <p className="text-xs text-gray-500">Esta accion no se puede deshacer.</p>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2.5 border-t border-gray-200">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-5 py-1.5 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-5 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors shadow-sm"
                >
                  Si, Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

TasaInversionTab.displayName = 'TasaInversionTab';
