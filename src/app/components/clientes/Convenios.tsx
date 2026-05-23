import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { mockProducts, captacionProducts } from '../../data/mockData';
import { mockProductosLineaCredito } from '../../data/mockDataLineaCredito';
import { useProductosCatalogoDB } from '../../hooks/useProductosCatalogoDB';

// Interfaz unificada para el catálogo de productos (todos los tipos)
interface CatalogoProducto {
  id: number;
  codigo: string;
  nombre: string;
  lineaProducto: string;
}

interface Convenio {
  id: number;
  codigoProducto: string;
  producto: string;
  lineaProducto: string;
  descripcion: string;
  socio: string;
  comisionSobreIngreso: boolean;
  seleccionado: boolean;
}

interface ConveniosProps {
  clienteId?: string;
  mode?: 'nuevo' | 'editar' | 'ver';
  isView?: boolean;
}

export function Convenios({ clienteId, mode, isView }: ConveniosProps = {}) {
  const storageKey = `cliente_${clienteId || 'temp'}_convenios`;
  const readOnly = isView || mode === 'ver';

  // Productos desde la DB (catálogo completo sin filtro de tipo)
  const { productos: productosDB } = useProductosCatalogoDB(true);

  // Construir catálogo unificado — DB primero, mock como fallback
  const catalogoProductos = useMemo<CatalogoProducto[]>(() => {
    if (productosDB.length > 0) {
      return productosDB.map((p, i) => ({
        id: i + 1, // índice numérico para compatibilidad con el select
        codigo: p.claveProducto || p.id.slice(0, 8),
        nombre: p.nombreProducto,
        lineaProducto: p.lineaProducto,
      }));
    }

    // Fallback a mock si DB no responde
    const productos: CatalogoProducto[] = [];
    mockProducts.forEach((p) => {
      productos.push({ id: p.id, codigo: p.claveEBS || p.clave?.toString() || `CR-${p.id}`, nombre: p.nombre, lineaProducto: p.lineaProducto });
    });
    captacionProducts.forEach((p) => {
      productos.push({ id: 1000 + p.id, codigo: (p as any).clave?.toString() || `CAP-${p.id}`, nombre: p.nombre, lineaProducto: p.lineaProducto });
    });
    mockProductosLineaCredito.forEach((p) => {
      productos.push({ id: 2000 + p.id, codigo: p.clave || `LC-${p.id}`, nombre: p.nombre, lineaProducto: p.lineaProducto });
    });
    return productos;
  }, [productosDB]);

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

  const [convenios, setConvenios] = useState<Convenio[]>(() =>
    loadPersistedData(storageKey, [])
  );

  // Guardar en sessionStorage cuando cambien los convenios
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(convenios));
  }, [convenios, storageKey]);

  const [showConsulta, setShowConsulta] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const emptyForm = {
    productoSeleccionado: '',
    codigoProducto: '',
    producto: '',
    lineaProducto: '',
    descripcion: '',
    socio: '',
    comisionSobreIngreso: false,
  };

  const [formData, setFormData] = useState({ ...emptyForm });

  const [filters, setFilters] = useState({
    codigoProducto: '',
    producto: '',
    lineaProducto: '',
    descripcion: '',
    socio: '',
  });

  // Al seleccionar un producto en el dropdown, auto-mapear código y línea
  const handleProductoChange = (catalogoId: string) => {
    if (!catalogoId) {
      setFormData({
        ...formData,
        productoSeleccionado: '',
        codigoProducto: '',
        producto: '',
        lineaProducto: '',
      });
      return;
    }
    const prod = catalogoProductos.find((p) => p.id.toString() === catalogoId);
    if (prod) {
      setFormData({
        ...formData,
        productoSeleccionado: catalogoId,
        codigoProducto: prod.codigo,
        producto: prod.nombre,
        lineaProducto: prod.lineaProducto,
      });
    }
  };

  const handleToggleSeleccion = (id: number) => {
    setConvenios(
      convenios.map((item) =>
        item.id === id ? { ...item, seleccionado: !item.seleccionado } : item
      )
    );
  };

  const handleSeleccionarTodos = (checked: boolean) => {
    setConvenios(convenios.map((item) => ({ ...item, seleccionado: checked })));
  };

  const handleEliminarSeleccionados = () => {
    const seleccionados = convenios.filter((item) => item.seleccionado);
    if (seleccionados.length === 0) {
      toast.error('No hay registros seleccionados para eliminar');
      return;
    }
    if (
      window.confirm(
        `Esta seguro de eliminar ${seleccionados.length} registro(s)?`
      )
    ) {
      setConvenios(convenios.filter((item) => !item.seleccionado));
      toast.success('Registros eliminados correctamente');
    }
  };

  const handleNuevo = () => {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setShowModal(true);
  };

  const handleEditar = () => {
    if (selectedRow === null) {
      toast.error('Seleccione un registro para editar');
      return;
    }
    const conv = convenios.find((c) => c.id === selectedRow);
    if (!conv) return;
    // Buscar el producto en el catálogo por nombre para pre-seleccionar
    const prodMatch = catalogoProductos.find(
      (p) => p.nombre === conv.producto && p.lineaProducto === conv.lineaProducto
    );
    setEditingId(conv.id);
    setFormData({
      productoSeleccionado: prodMatch ? prodMatch.id.toString() : '',
      codigoProducto: conv.codigoProducto,
      producto: conv.producto,
      lineaProducto: conv.lineaProducto,
      descripcion: conv.descripcion,
      socio: conv.socio,
      comisionSobreIngreso: conv.comisionSobreIngreso,
    });
    setShowModal(true);
  };

  const handleGuardarConvenio = () => {
    if (!formData.producto.trim()) {
      toast.error('Debe seleccionar un producto');
      return;
    }
    if (!formData.descripcion.trim()) {
      toast.error('La descripcion es obligatoria');
      return;
    }
    if (!formData.socio.trim()) {
      toast.error('El socio es obligatorio');
      return;
    }

    if (editingId !== null) {
      // Modo edición
      setConvenios(
        convenios.map((c) =>
          c.id === editingId
            ? {
                ...c,
                codigoProducto: formData.codigoProducto,
                producto: formData.producto,
                lineaProducto: formData.lineaProducto,
                descripcion: formData.descripcion,
                socio: formData.socio,
                comisionSobreIngreso: formData.comisionSobreIngreso,
              }
            : c
        )
      );
      toast.success('Convenio actualizado correctamente');
    } else {
      // Modo nuevo
      const nuevoConvenio: Convenio = {
        id: Math.max(...convenios.map((c) => c.id), 0) + 1,
        codigoProducto: formData.codigoProducto,
        producto: formData.producto,
        lineaProducto: formData.lineaProducto,
        descripcion: formData.descripcion,
        socio: formData.socio,
        comisionSobreIngreso: formData.comisionSobreIngreso,
        seleccionado: false,
      };
      setConvenios([...convenios, nuevoConvenio]);
      toast.success('Convenio creado correctamente');
    }
    setShowModal(false);
    setFormData({ ...emptyForm });
    setEditingId(null);
  };

  const todosSeleccionados =
    convenios.length > 0 && convenios.every((item) => item.seleccionado);
  const algunoSeleccionado = convenios.some((item) => item.seleccionado);

  // Aplicar filtros
  const filteredData = convenios.filter((item) => {
    const matchesCodigo =
      filters.codigoProducto === '' ||
      item.codigoProducto
        .toLowerCase()
        .includes(filters.codigoProducto.toLowerCase());
    const matchesProducto =
      filters.producto === '' ||
      item.producto.toLowerCase().includes(filters.producto.toLowerCase());
    const matchesLinea =
      filters.lineaProducto === '' ||
      item.lineaProducto
        .toLowerCase()
        .includes(filters.lineaProducto.toLowerCase());
    const matchesDescripcion =
      filters.descripcion === '' ||
      item.descripcion
        .toLowerCase()
        .includes(filters.descripcion.toLowerCase());
    const matchesSocio =
      filters.socio === '' ||
      item.socio.toLowerCase().includes(filters.socio.toLowerCase());
    return (
      matchesCodigo &&
      matchesProducto &&
      matchesLinea &&
      matchesDescripcion &&
      matchesSocio
    );
  });

  // Helper: label legible para lineaProducto
  const lineaLabel = (lp: string) => {
    switch (lp) {
      case 'Credito':
        return 'Credito';
      case 'Captacion':
        return 'Captacion';
      case 'Linea Credito':
        return 'Linea Credito';
      default:
        return lp;
    }
  };

  return (
    <div className="bg-white">
      {/* Encabezado institucional con botones */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">CONVENIOS</span>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={handleNuevo}
                className="px-4 py-1.5 btn-secondary-theme text-xs font-medium rounded"
              >
                Nuevo
              </button>
              <button
                onClick={handleEditar}
                className="px-4 py-1.5 btn-secondary-theme text-xs font-medium rounded"
              >
                Editar
              </button>
              <button
                onClick={handleEliminarSeleccionados}
                className="px-4 py-1.5 btn-secondary-theme text-xs font-medium rounded"
              >
                Eliminar
              </button>
            </>
          )}
          <button
            onClick={() => setShowConsulta(!showConsulta)}
            className="px-4 py-1.5 btn-secondary-theme text-xs font-medium rounded"
          >
            {showConsulta ? 'Ocultar Consulta' : 'Consulta'}
          </button>
        </div>
      </div>

      {/* Panel de filtros */}
      {showConsulta && (
        <div className="mb-3 p-3 bg-[#F5F5F5] border border-gray-300 rounded">
          <div className="grid grid-cols-5 gap-3 mb-2">
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">
                Codigo Producto
              </label>
              <input
                type="text"
                value={filters.codigoProducto}
                onChange={(e) =>
                  setFilters({ ...filters, codigoProducto: e.target.value })
                }
                placeholder="Buscar codigo..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">
                Producto
              </label>
              <input
                type="text"
                value={filters.producto}
                onChange={(e) =>
                  setFilters({ ...filters, producto: e.target.value })
                }
                placeholder="Buscar producto..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">
                Linea de Producto
              </label>
              <input
                type="text"
                value={filters.lineaProducto}
                onChange={(e) =>
                  setFilters({ ...filters, lineaProducto: e.target.value })
                }
                placeholder="Buscar linea..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">
                Descripcion
              </label>
              <input
                type="text"
                value={filters.descripcion}
                onChange={(e) =>
                  setFilters({ ...filters, descripcion: e.target.value })
                }
                placeholder="Buscar..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">
                Socio
              </label>
              <input
                type="text"
                value={filters.socio}
                onChange={(e) =>
                  setFilters({ ...filters, socio: e.target.value })
                }
                placeholder="Buscar..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setFilters({
                  codigoProducto: '',
                  producto: '',
                  lineaProducto: '',
                  descripcion: '',
                  socio: '',
                })
              }
              className="px-4 py-1.5 btn-secondary-theme text-xs rounded"
            >
              Limpiar
            </button>
            <button
              onClick={() => setShowConsulta(false)}
              className="px-4 py-1.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Tabla de convenios */}
      <div className="border border-gray-300 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#D9D9D9]">
              <th
                className="px-3 py-2.5 text-center font-medium text-xs text-gray-800"
                style={{ width: '40px' }}
              >
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={(e) => handleSeleccionarTodos(e.target.checked)}
                  className="w-4 h-4"
                />
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">
                Codigo Producto
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">
                Producto
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">
                Linea de Producto
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">
                Descripcion
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">
                Socio
              </th>
              <th className="px-3 py-2.5 text-center font-medium text-xs text-gray-800">
                Comision sobre Ingreso
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-gray-500 text-xs"
                >
                  No se encontraron registros
                </td>
              </tr>
            ) : (
              filteredData.map((convenio) => (
                <tr
                  key={convenio.id}
                  onClick={() => setSelectedRow(convenio.id)}
                  className={`border-b border-gray-200 cursor-pointer transition-colors ${
                    selectedRow === convenio.id
                      ? 'bg-[#FFFF99]'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={convenio.seleccionado}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleSeleccion(convenio.id);
                      }}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    {convenio.codigoProducto}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    {convenio.producto}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    {lineaLabel(convenio.lineaProducto)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    {convenio.descripcion}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    {convenio.socio}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-700">
                    {convenio.comisionSobreIngreso && (
                      <span className="text-green-600 font-bold text-sm">
                        &#10003;
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Contador de registros */}
      <div className="mt-2 text-xs text-gray-600">
        <span className="font-medium">
          Total de registros: {filteredData.length}
        </span>
        {algunoSeleccionado && (
          <span className="ml-3 font-medium">
            Seleccionados: {convenios.filter((c) => c.seleccionado).length}
          </span>
        )}
      </div>

      {/* Modal para nuevo/editar convenio */}
      {showModal && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.44)] flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 bg-[#D9D9D9]">
              <h3 className="text-sm font-medium text-gray-800">
                {editingId !== null ? 'Editar Convenio' : 'Nuevo Convenio'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormData({ ...emptyForm });
                  setEditingId(null);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Dropdown Producto (alimentado del catálogo completo) */}
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">
                  Producto <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.productoSeleccionado}
                  onChange={(e) => handleProductoChange(e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                >
                  <option value="">-- Seleccione un producto --</option>
                  {Array.from(new Set(catalogoProductos.map((p) => p.lineaProducto))).map((linea) => (
                    <optgroup key={linea} label={lineaLabel(linea)}>
                      {catalogoProductos
                        .filter((p) => p.lineaProducto === linea)
                        .map((p) => (
                          <option key={p.id} value={p.id.toString()}>
                            {p.codigo} - {p.nombre}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Código de Producto y Línea de Producto (auto-mapeados, read-only) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Codigo de Producto
                  </label>
                  <input
                    type="text"
                    value={formData.codigoProducto}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 text-xs rounded bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Linea de Producto
                  </label>
                  <input
                    type="text"
                    value={lineaLabel(formData.lineaProducto)}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 text-xs rounded bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">
                  Descripcion <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                  disabled={readOnly}
                  placeholder="Ej: Convenio a 12 meses tasa 3.8%"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                />
              </div>

              {/* Socio y Comisión sobre Ingreso */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Socio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.socio}
                    onChange={(e) =>
                      setFormData({ ...formData, socio: e.target.value })
                    }
                    disabled={readOnly}
                    placeholder="Ej: CREDIEMPLEADO"
                    className="w-full px-3 py-2 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Comision sobre Ingreso
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="comisionSobreIngreso"
                      checked={formData.comisionSobreIngreso}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          comisionSobreIngreso: e.target.checked,
                        })
                      }
                      disabled={readOnly}
                      className="w-4 h-4"
                    />
                    <label
                      htmlFor="comisionSobreIngreso"
                      className="text-xs text-gray-700 cursor-pointer"
                    >
                      Aplicar comision sobre ingreso
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-300 bg-gray-50">
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormData({ ...emptyForm });
                  setEditingId(null);
                }}
                className="px-4 py-1.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
              >
                Cancelar
              </button>
              {!readOnly && (
                <button
                  onClick={handleGuardarConvenio}
                  className="px-4 py-1.5 btn-secondary-theme text-xs rounded"
                >
                  {editingId !== null ? 'Actualizar' : 'Guardar'} Convenio
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
