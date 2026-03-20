import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useClienteSubtabList } from '@/app/hooks/useClientePersistence';
import { useProductosCatalogoDB, type ProductoCatalogo } from '@/app/hooks/useProductosCatalogoDB';

interface PerfilTransaccionalProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
}

/**
 * Estructura JSON institucional que se guarda en data.perfilTransaccional[]
 * dentro de J_CLIENTES. Alineada con el spec clientes-perfil-transaccional.md
 */
interface PerfilItem {
  id: number | string;
  productoId: string;
  nombreProducto: string;
  lineaProducto: string;
  tipoProducto: string;
  claveProducto: string;
  montoMaximo: string;
  frecuencia: string;
  canal: string;
  numTransaccionesRetiro: string;
  numTransaccionesDeposito: string;
  montoMaxRetiros: string;
  montoMaxDepositos: string;
  periodo: string;
  usuarioRegistro: string;
  fechaRegistro: string;
}

const LOG = '[PerfilTx]';

export function PerfilTransaccional({ onBack, mode, clienteId }: PerfilTransaccionalProps) {
  const isView = mode === 'ver';

  // ── Datos del subtab persistidos en sessionStorage ──
  const { items: perfiles, setItems: setPerfiles } = useClienteSubtabList<PerfilItem>(
    clienteId?.toString() || 'temp', 'perfil_transaccional', []
  );

  // ── Hook DB: catálogo COMPLETO de J_PRODUCTOS (todos los tipos) ──
  const {
    productos: catalogoProductos,
    loading: loadingProductos,
    backendStatus,
    lineasDisponibles,
  } = useProductosCatalogoDB(true);

  const [selectedPerfiles, setSelectedPerfiles] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showModalCatalogo, setShowModalCatalogo] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [filtroLinea, setFiltroLinea] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');

  const [formData, setFormData] = useState({
    productoId: '',
    nombreProducto: '',
    lineaProducto: '',
    tipoProducto: '',
    claveProducto: '',
    numTransaccionesRetiro: '',
    numTransaccionesDeposito: '',
    montoMaxRetiros: '',
    montoMaxDepositos: '',
    periodo: 'Mensual',
    frecuencia: 'Mensual',
    canal: '',
  });

  // ═══════════════════════════════════════════════════════════════════
  // Catálogo filtrado para el modal (por línea + búsqueda de texto)
  // SIN filtrar por tipo a menos que el usuario lo pida
  // ═══════════════���══════════════════════════════════════════════════
  const productosFiltrados = useMemo(() => {
    let result = catalogoProductos;
    if (filtroLinea) {
      result = result.filter(p => p.lineaProducto === filtroLinea);
    }
    if (busquedaProducto.trim()) {
      const term = busquedaProducto.toLowerCase().trim();
      result = result.filter(p =>
        p.nombreProducto.toLowerCase().includes(term) ||
        p.claveProducto.toLowerCase().includes(term) ||
        p.tipoProducto.toLowerCase().includes(term)
      );
    }
    return result;
  }, [catalogoProductos, filtroLinea, busquedaProducto]);

  const handleNuevo = () => {
    setEditingId(null);
    setFormData({
      productoId: '',
      nombreProducto: '',
      lineaProducto: '',
      tipoProducto: '',
      claveProducto: '',
      numTransaccionesRetiro: '',
      numTransaccionesDeposito: '',
      montoMaxRetiros: '',
      montoMaxDepositos: '',
      periodo: 'Mensual',
      frecuencia: 'Mensual',
      canal: '',
    });
    setShowModal(true);
  };

  const handleEliminar = () => {
    if (selectedPerfiles.length === 0) {
      toast.error('Por favor seleccione al menos un registro para eliminar');
      return;
    }

    setPerfiles(prev => prev.filter((_, idx) => !selectedPerfiles.includes(idx)));
    const count = selectedPerfiles.length;
    setSelectedPerfiles([]);
    toast.success(`${count} perfil${count > 1 ? 'es' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  const handleGuardarModal = () => {
    // Validaciones del spec: no guardar sin campos esenciales
    if (!formData.nombreProducto) {
      toast.error('Debe seleccionar un Producto del catálogo');
      return;
    }
    if (!formData.lineaProducto) {
      toast.error('El producto seleccionado no tiene Línea de Producto');
      return;
    }

    const warnings = [];
    if (!formData.numTransaccionesRetiro) warnings.push('Nº Trans. Retiro');
    if (!formData.numTransaccionesDeposito) warnings.push('Nº Trans. Depósito');
    if (!formData.montoMaxRetiros) warnings.push('Monto Max. Retiros');
    if (!formData.montoMaxDepositos) warnings.push('Monto Max. Depósitos');

    if (warnings.length > 0) {
      toast.warning(`Campos vacíos: ${warnings.join(', ')}. Puede completarlos posteriormente.`);
    }

    const fechaActual = new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (editingId !== null) {
      // Editar existente — usar == para comparar number/string ids de legacy
      setPerfiles(prev => prev.map(p =>
        String(p.id) === String(editingId)
          ? {
              ...p,
              productoId: formData.productoId,
              nombreProducto: formData.nombreProducto,
              lineaProducto: formData.lineaProducto,
              tipoProducto: formData.tipoProducto,
              claveProducto: formData.claveProducto,
              numTransaccionesRetiro: formData.numTransaccionesRetiro,
              numTransaccionesDeposito: formData.numTransaccionesDeposito,
              montoMaxRetiros: formData.montoMaxRetiros,
              montoMaxDepositos: formData.montoMaxDepositos,
              periodo: formData.periodo,
              frecuencia: formData.frecuencia,
              canal: formData.canal,
              montoMaximo: formData.montoMaxRetiros || formData.montoMaxDepositos,
            }
          : p
      ));
      toast.success('Perfil actualizado correctamente');
    } else {
      // Nuevo — estructura JSON del spec
      const nuevoPerfil: PerfilItem = {
        id: Date.now().toString(),
        productoId: formData.productoId,
        nombreProducto: formData.nombreProducto,
        lineaProducto: formData.lineaProducto,
        tipoProducto: formData.tipoProducto,
        claveProducto: formData.claveProducto,
        montoMaximo: formData.montoMaxRetiros || formData.montoMaxDepositos,
        frecuencia: formData.frecuencia,
        canal: formData.canal,
        numTransaccionesRetiro: formData.numTransaccionesRetiro,
        numTransaccionesDeposito: formData.numTransaccionesDeposito,
        montoMaxRetiros: formData.montoMaxRetiros,
        montoMaxDepositos: formData.montoMaxDepositos,
        periodo: formData.periodo,
        usuarioRegistro: 'Usuario Actual',
        fechaRegistro: fechaActual,
      };
      setPerfiles(prev => [...prev, nuevoPerfil]);
      toast.success('Perfil creado correctamente');
      console.log(`${LOG} Nuevo perfil guardado:`, JSON.stringify(nuevoPerfil));
    }

    setShowModal(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPerfiles(perfiles.map((_, idx) => idx));
    } else {
      setSelectedPerfiles([]);
    }
  };

  const handleSelectPerfil = (idx: number, checked: boolean) => {
    if (checked) {
      setSelectedPerfiles(prev => [...prev, idx]);
    } else {
      setSelectedPerfiles(prev => prev.filter(i => i !== idx));
    }
  };

  const handleVerPerfil = (perfil: PerfilItem) => {
    setEditingId(perfil.id);
    // Compatibilidad con datos legacy que usaban campo 'producto' en vez de 'nombreProducto'
    const legacy = perfil as any;
    setFormData({
      productoId: perfil.productoId || legacy.productoId || '',
      nombreProducto: perfil.nombreProducto || legacy.producto || '',
      lineaProducto: perfil.lineaProducto || '',
      tipoProducto: perfil.tipoProducto || '',
      claveProducto: perfil.claveProducto || '',
      numTransaccionesRetiro: perfil.numTransaccionesRetiro || '',
      numTransaccionesDeposito: perfil.numTransaccionesDeposito || '',
      montoMaxRetiros: perfil.montoMaxRetiros || '',
      montoMaxDepositos: perfil.montoMaxDepositos || '',
      periodo: perfil.periodo || 'Mensual',
      frecuencia: perfil.frecuencia || 'Mensual',
      canal: perfil.canal || '',
    });
    setShowModal(true);
  };

  const handleSelectProducto = (producto: ProductoCatalogo) => {
    setFormData(prev => ({
      ...prev,
      productoId: producto.id,
      nombreProducto: producto.nombreProducto,
      lineaProducto: producto.lineaProducto,
      tipoProducto: producto.tipoProducto,
      claveProducto: producto.claveProducto,
    }));
    setShowModalCatalogo(false);
    if (producto.source === 'db') {
      toast.success(`Producto "${producto.nombreProducto}" seleccionado (fuente: J_PRODUCTOS)`);
    } else {
      toast.info(`Producto "${producto.nombreProducto}" seleccionado (datos locales)`);
    }
  };

  const handleAbrirCatalogo = () => {
    setFiltroLinea('');
    setBusquedaProducto('');
    setShowModalCatalogo(true);
  };

  return (
    <div className="flex-1">
      {/* Encabezado institucional con título y botones */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">PERFIL TRANSACCIONAL</span>
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

      {/* Tabla de Perfiles Transaccionales */}
      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={perfiles.length > 0 && selectedPerfiles.length === perfiles.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                  disabled={isView}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Registro</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Línea de Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Clave</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Nº Trans. Retiro</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Nº Trans. Depósito</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Max. Retiros</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Max. Depósitos</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Periodo</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {perfiles.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-xs text-gray-500">
                  No hay perfiles transaccionales registrados. Haga clic en "Nuevo" para agregar uno.
                </td>
              </tr>
            ) : (
              perfiles.map((perfil, idx) => (
                <tr
                  key={perfil.id}
                  className={`border-b border-gray-300 hover:bg-gray-50 ${selectedPerfiles.includes(idx) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-3 py-2 text-center border-r border-gray-300">
                    <input
                      type="checkbox"
                      checked={selectedPerfiles.includes(idx)}
                      onChange={(e) => handleSelectPerfil(idx, e.target.checked)}
                      className="w-4 h-4"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isView}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{perfil.fechaRegistro}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{perfil.lineaProducto}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{perfil.claveProducto}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{perfil.nombreProducto || (perfil as any).producto}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{perfil.numTransaccionesRetiro}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{perfil.numTransaccionesDeposito}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{perfil.montoMaxRetiros}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{perfil.montoMaxDepositos}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{perfil.periodo}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerPerfil(perfil);
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Modal Institucional para Nuevo/Editar Perfil Transaccional     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header azul institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                {editingId !== null ? 'Editar Perfil Transaccional' : 'Nuevo Perfil Transaccional'}
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
                  <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DEL PERFIL TRANSACCIONAL</h3>
                </div>

                <div className="space-y-4">
                  {/* Fila 1: Producto (selector desde catálogo J_PRODUCTOS) */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Producto <span className="text-red-600">*</span>
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                          backendStatus === 'connected'
                            ? 'bg-green-100 text-green-700'
                            : backendStatus === 'fallback'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}>
                          {loadingProductos ? '... Cargando DB...' :
                           backendStatus === 'connected' ? `J_PRODUCTOS (${catalogoProductos.length})` :
                           backendStatus === 'fallback' ? 'sessionStorage' : 'Datos locales'}
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={
                            formData.nombreProducto
                              ? `${formData.claveProducto ? formData.claveProducto + ' — ' : ''}${formData.nombreProducto} (${formData.lineaProducto})`
                              : ''
                          }
                          readOnly
                          placeholder={
                            loadingProductos
                              ? 'Cargando catálogo desde J_PRODUCTOS...'
                              : 'Seleccione un producto del catálogo...'
                          }
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-50"
                        />
                        <button
                          onClick={handleAbrirCatalogo}
                          className="px-3 py-1.5 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700"
                          disabled={loadingProductos}
                        >
                          {loadingProductos ? '...' : 'Buscar...'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Datos del producto seleccionado (readonly) */}
                  {formData.nombreProducto && (
                    <div className="grid grid-cols-4 gap-4 bg-blue-50 p-3 rounded border border-blue-200">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Línea de Producto</label>
                        <span className="text-xs text-gray-800">{formData.lineaProducto || '—'}</span>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Tipo de Producto</label>
                        <span className="text-xs text-gray-800">{formData.tipoProducto || '—'}</span>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Clave de Producto</label>
                        <span className="text-xs text-gray-800">{formData.claveProducto || '—'}</span>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">ID Producto</label>
                        <span className="text-xs text-gray-800 font-mono">{formData.productoId ? formData.productoId.substring(0, 8) + '...' : '—'}</span>
                      </div>
                    </div>
                  )}

                  {/* Fila 2: Transacciones */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Número de transacciones de retiro <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.numTransaccionesRetiro}
                        onChange={(e) => setFormData(prev => ({ ...prev, numTransaccionesRetiro: e.target.value }))}
                        placeholder="Ej: 500"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Número de transacciones de depósito <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.numTransaccionesDeposito}
                        onChange={(e) => setFormData(prev => ({ ...prev, numTransaccionesDeposito: e.target.value }))}
                        placeholder="Ej: 500"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>
                  </div>

                  {/* Fila 3: Montos */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Monto Max. Retiros <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.montoMaxRetiros}
                        onChange={(e) => setFormData(prev => ({ ...prev, montoMaxRetiros: e.target.value }))}
                        placeholder="$0.00"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Monto Max. Depósitos <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.montoMaxDepositos}
                        onChange={(e) => setFormData(prev => ({ ...prev, montoMaxDepositos: e.target.value }))}
                        placeholder="$0.00"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      />
                    </div>
                  </div>

                  {/* Fila 4: Periodo, Frecuencia, Canal */}
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Periodo <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.periodo}
                        onChange={(e) => setFormData(prev => ({ ...prev, periodo: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option>Mensual</option>
                        <option>Semanal</option>
                        <option>Quincenal</option>
                        <option>Anual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Frecuencia
                      </label>
                      <select
                        value={formData.frecuencia}
                        onChange={(e) => setFormData(prev => ({ ...prev, frecuencia: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option>Mensual</option>
                        <option>Semanal</option>
                        <option>Quincenal</option>
                        <option>Diario</option>
                        <option>Anual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Canal
                      </label>
                      <select
                        value={formData.canal}
                        onChange={(e) => setFormData(prev => ({ ...prev, canal: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option value="">Seleccione...</option>
                        <option>Ventanilla</option>
                        <option>Banca Electrónica</option>
                        <option>Transferencia</option>
                        <option>Domiciliación</option>
                        <option>ATM</option>
                        <option>Otro</option>
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Modal de Catálogo de Productos — Cargado desde J_PRODUCTOS     */}
      {/* Muestra TODOS los tipos: Captación, Crédito, ProductoLineaCredito */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showModalCatalogo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                Catálogo de Productos — J_PRODUCTOS
              </h3>
              <button
                onClick={() => setShowModalCatalogo(false)}
                className="text-white hover:text-gray-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            {/* Fuente de datos badge + filtros */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${
                  backendStatus === 'connected'
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : backendStatus === 'fallback'
                      ? 'bg-amber-100 text-amber-700 border border-amber-300'
                      : 'bg-gray-100 text-gray-500 border border-gray-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    backendStatus === 'connected' ? 'bg-green-500' :
                    backendStatus === 'fallback' ? 'bg-amber-500' : 'bg-gray-400'
                  }`} />
                  {backendStatus === 'connected'
                    ? `${catalogoProductos.length} productos de J_PRODUCTOS (DB)`
                    : backendStatus === 'fallback'
                      ? `${catalogoProductos.length} productos (sessionStorage)`
                      : `${catalogoProductos.length} productos (datos locales)`
                  }
                </span>
                <span className="text-[10px] text-gray-500">
                  Mostrando: {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Filtros */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-gray-500">Línea:</label>
                  <select
                    value={filtroLinea}
                    onChange={(e) => setFiltroLinea(e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                  >
                    <option value="">Todas las líneas</option>
                    {lineasDisponibles.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={busquedaProducto}
                    onChange={(e) => setBusquedaProducto(e.target.value)}
                    placeholder="Buscar por nombre, clave o tipo..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingProductos ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-xs text-gray-500">Cargando catálogo desde J_PRODUCTOS...</p>
                  </div>
                </div>
              ) : productosFiltrados.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-xs text-gray-500">
                    No se encontraron productos{filtroLinea ? ` para línea "${filtroLinea}"` : ''}{busquedaProducto ? ` con "${busquedaProducto}"` : ''}
                  </p>
                </div>
              ) : (
                <div className="border border-gray-300">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
                        <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Clave</th>
                        <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Nombre</th>
                        <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Línea</th>
                        <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tipo</th>
                        <th className="px-3 py-2 text-center font-medium text-xs text-gray-800" style={{ width: '60px' }}>Fuente</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {productosFiltrados.map(producto => (
                        <tr
                          key={producto.id}
                          onClick={() => handleSelectProducto(producto)}
                          className="border-b border-gray-300 cursor-pointer hover:bg-blue-50 transition-colors"
                        >
                          <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{producto.claveProducto || '—'}</td>
                          <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{producto.nombreProducto}</td>
                          <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${
                              producto.lineaProducto.includes('aptación') ? 'bg-blue-100 text-blue-700' :
                              producto.lineaProducto.includes('rédito') || producto.lineaProducto.includes('redito') ? 'bg-green-100 text-green-700' :
                              producto.lineaProducto.includes('ínea') || producto.lineaProducto.includes('inea') ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {producto.lineaProducto}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{producto.tipoProducto || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded ${
                              producto.source === 'db'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {producto.source === 'db' ? 'DB' : 'Local'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}