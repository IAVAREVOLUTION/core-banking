import { useState, useRef, useMemo, useEffect } from 'react';
import { ProductoLineaCredito } from '@/app/types/productoLineaCredito';
import { toast } from 'sonner';

interface ProductoLineaCreditoListProps {
  onNew: () => void;
  onEdit: (product: ProductoLineaCredito) => void;
  onView: (product: ProductoLineaCredito) => void;
  products?: ProductoLineaCredito[];
  /** Estado de carga desde J_PRODUCTOS */
  loading?: boolean;
  /** Error de consulta a J_PRODUCTOS */
  error?: string | null;
  /** Refetch desde J_PRODUCTOS */
  onRefetch?: () => void;
}

export function ProductoLineaCreditoList({ onNew, onEdit, onView, products: externalProducts, loading, error, onRefetch }: ProductoLineaCreditoListProps) {
  const products = externalProducts || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [sublineaFilter, setSublineaFilter] = useState<string>('');
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  // Estado para anchos de columnas - Inicializar una sola vez
  const getInitialColumnWidths = () => {
    return {
      actions: 100,
      nombre: 160,
      clave: 110,
      subTipo: 130,
      tipoLinea: 110,
      sucursal: 110,
      moneda: 80,
      estatus: 90,
      tasaBase: 100,
      baseCalculo: 110,
      vigenciaLineaDias: 110,
      diasParaRenovacion: 120,
      numDisposicionesAbiertas: 130,
    };
  };
  
  const [columnWidths, setColumnWidths] = useState(getInitialColumnWidths());
  const [resizing, setResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const handleExportExcel = () => {
    toast.success('Exportando a Excel', {
      description: 'El archivo se está descargando...',
      duration: 3000,
    });
  };

  const handleExportCSV = () => {
    toast.success('Exportando a CSV', {
      description: 'El archivo CSV se está descargando...',
      duration: 3000,
    });
  };

  const handleExportPDF = () => {
    toast.success('Exportando a PDF', {
      description: 'El archivo se está descargando...',
      duration: 3000,
    });
  };

  const handlePrint = () => {
    toast.success('Imprimiendo', {
      description: 'Enviando documento a la impresora...',
      duration: 3000,
    });
  };

  const handleListaClick = () => {
    if (tableRef.current) {
      tableRef.current.classList.add('animate-highlight');
      setTimeout(() => {
        tableRef.current?.classList.remove('animate-highlight');
      }, 1000);
    }
  };

  const handleBuscarClick = () => {
    if (searchBarRef.current) {
      searchBarRef.current.focus();
      searchBarRef.current.classList.add('animate-highlight-border');
      setTimeout(() => {
        searchBarRef.current?.classList.remove('animate-highlight-border');
      }, 1000);
    }
  };

  // Obtener sublíneas únicas para el filtro
  const sublineasUnicas = useMemo(() => {
    const sublíneas = new Set<string>();
    products.forEach(producto => {
      if (producto.sublineaProducto) {
        sublíneas.add(producto.sublineaProducto);
      }
    });
    return Array.from(sublíneas).sort();
  }, [products]);

  // Filtrado y ordenamiento
  const filteredProductos = useMemo(() => {
    return products
      .filter(producto => {
        const searchLower = searchTerm.toLowerCase();
        const matchSearch = (
          (producto.nombre || '').toLowerCase().includes(searchLower) ||
          (producto.id?.toString() || '').includes(searchLower) ||
          (producto.descripcion || '').toLowerCase().includes(searchLower)
        );
        
        const matchSublinea = !sublineaFilter || producto.sublineaProducto === sublineaFilter;
        
        return matchSearch && matchSublinea;
      })
      .sort((a, b) => {
        const dateA = new Date(a.fechaRegistro).getTime();
        const dateB = new Date(b.fechaRegistro).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [products, searchTerm, sortOrder, sublineaFilter]);

  // Paginación
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredProductos.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentProductos = filteredProductos.slice(startIndex, endIndex);
    return { totalPages, currentProductos, startIndex, endIndex };
  }, [filteredProductos, currentPage, itemsPerPage]);

  const handleSortChange = (newSortOrder: 'desc' | 'asc') => {
    setSortOrder(newSortOrder);
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < paginationData.totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleFirstPage = () => {
    setCurrentPage(1);
  };

  const handleLastPage = () => {
    setCurrentPage(paginationData.totalPages);
  };

  const handleResizeStart = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    setResizing(column);
    setStartX(e.clientX);
    setStartWidth(columnWidths[column as keyof typeof columnWidths]);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) {
        const diff = e.clientX - startX;
        const newWidth = Math.max(80, startWidth + diff);
        setColumnWidths(prev => ({
          ...prev,
          [resizing]: newWidth
        }));
      }
    };

    const handleMouseUp = () => {
      if (resizing) {
        setResizing(null);
      }
    };

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, startX, startWidth]);

  return (
    <div className="bg-white min-h-screen">
      {/* Header Section con ícono y título */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#4A90E2">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M4 9h16M9 4v16" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Productos</h2>
            <button className="p-1 ml-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="8" cy="8" r="6"/>
                <path d="M13 13l3 3"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={handleListaClick} className="cursor-pointer hover:text-[#0099CC] transition-colors">Lista</span>
            <span onClick={handleBuscarClick} className="cursor-pointer hover:text-[#0099CC] transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* Filter Section con Ver, Dropdown y Nuevo */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[200px]">
              <option>Vista general de productos</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666">
              <path d="M6 8l-4-4h8z"/>
            </svg>
          </div>
          <button onClick={onNew} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium">
            Nuevo
          </button>
        </div>
      </div>

      {/* Filtros Label */}
      <div className="px-4 py-2 bg-[#F0F0F0] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <div className="flex items-center gap-2">
            <input 
              ref={searchBarRef}
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar productos..." 
              className="px-3 py-1 border border-gray-400 rounded text-sm w-64 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Action Icons Bar */}
      <div className="px-4 py-2.5 bg-[#F0F0F0] border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              className="p-1.5 hover:bg-gray-200 rounded transition-colors hover:scale-110 transform" 
              title="Exportar a CSV"
              onClick={handleExportCSV}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280"/>
                <text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text>
              </svg>
            </button>
            <button 
              className="p-1.5 hover:bg-green-100 rounded transition-colors hover:scale-110 transform" 
              title="Exportar a Excel" 
              onClick={handleExportExcel}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B"/>
                <path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2"/>
              </svg>
            </button>
            <button 
              className="p-1.5 hover:bg-red-100 rounded transition-colors hover:scale-110 transform" 
              title="Exportar a PDF" 
              onClick={handleExportPDF}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F"/>
                <path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none"/>
                <path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2"/>
              </svg>
            </button>
            <button 
              className="p-1.5 hover:bg-blue-100 rounded transition-colors hover:scale-110 transform" 
              title="Imprimir" 
              onClick={handlePrint}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2"/>
                <rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none"/>
                <rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2"/>
                <circle cx="5" cy="8" r="0.8" fill="#1976D2"/>
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden Rápido</span>
              <div className="relative">
                <select 
                  value={sortOrder} 
                  onChange={(e) => handleSortChange(e.target.value as 'desc' | 'asc')}
                  className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none"
                >
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666">
                  <path d="M5 7l-3-3h6z"/>
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select 
                  value={sublineaFilter} 
                  onChange={(e) => {
                    setSublineaFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none"
                >
                  <option value="">Todas las Sublíneas</option>
                  {sublineasUnicas.map((sublinea) => (
                    <option key={sublinea} value={sublinea}>
                      {sublinea}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#0099CC">
                  <path d="M5 7l-3-3h6z"/>
                </svg>
              </div>
              <button 
                className="p-0.5 text-[#0099CC] hover:text-[#0088BB] disabled:opacity-40" 
                title="Anterior"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M10 3L5 8l5 5V3z"/>
                </svg>
              </button>
              <button 
                className="p-0.5 text-[#0099CC] hover:text-[#0088BB] disabled:opacity-40" 
                title="Siguiente"
                onClick={handleNextPage}
                disabled={currentPage === paginationData.totalPages}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 3l5 5-5 5V3z"/>
                </svg>
              </button>
            </div>
            <span className="font-medium">Total: {products.length}</span>
          </div>
        </div>
      </div>

      {/* Error de consulta a J_PRODUCTOS */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>Error al consultar J_PRODUCTOS: {error}</span>
          {onRefetch && (
            <button onClick={onRefetch} className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-xs font-medium">Reintentar</button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
        {loading ? (
          <div className="border border-gray-300 px-3 py-8 text-center text-gray-500 bg-white">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-[#0099CC] mr-2 align-middle"></div>
            Consultando J_PRODUCTOS (ProductoLineaCredito)...
          </div>
        ) : (
        <div className="border border-gray-300 overflow-x-auto" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm table-fixed" style={{ backgroundColor: 'transparent' }}>
            <thead>
              <tr className="bg-[#D0D0D0] border-b border-gray-300">
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.actions}px` }}>
                  Editar | Ver
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'actions')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.nombre}px` }}>
                  NOMBRE
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'nombre')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.clave}px` }}>
                  CLAVE
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'clave')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.subTipo}px` }}>
                  SUBTIPO
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'subTipo')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.tipoLinea}px` }}>
                  TIPO LÍNEA
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'tipoLinea')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.sucursal}px` }}>
                  SUCURSAL
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'sucursal')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.moneda}px` }}>
                  MONEDA
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'moneda')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.estatus}px` }}>
                  ESTATUS
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'estatus')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.tasaBase}px` }}>
                  TASA BASE
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'tasaBase')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.baseCalculo}px` }}>
                  BASE CÁLCULO
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'baseCalculo')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.vigenciaLineaDias}px` }}>
                  VIGENCIA LÍNEA DIAS
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'vigenciaLineaDias')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.diasParaRenovacion}px` }}>
                  DIAS PARA RENOVACIÓN
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'diasParaRenovacion')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.numDisposicionesAbiertas}px` }}>
                  NUM DISPOSICIONES ABIERTAS
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'numDisposicionesAbiertas')}
                  />
                </th>
              </tr>
            </thead>
            <tbody style={{ backgroundColor: 'white' }}>
              {paginationData.currentProductos.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-gray-500 text-sm">
                    {searchTerm || sublineaFilter ? 'No se encontraron productos que coincidan con los filtros' : 'No hay productos registrados'}
                  </td>
                </tr>
              ) : (
                paginationData.currentProductos.map((product, index) => (
                  <tr 
                    key={product.dbUuid || product.id}
                    className={`border-b border-gray-300 hover:bg-[#E8F4F8] transition-colors cursor-pointer ${
                      index % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-xs text-gray-700">
                      <a href="#" onClick={(e) => { e.preventDefault(); onEdit(product); }} className="text-[#0066CC] hover:underline">Editar</a>
                      <span className="text-gray-700"> | </span>
                      <a href="#" onClick={(e) => { e.preventDefault(); onView(product); }} className="text-[#0066CC] hover:underline">Ver</a>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.nombre}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.clave}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.subTipo || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.tipoLinea || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.sucursal || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.moneda || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        product.estatus === 'Activo' ? 'bg-green-100 text-green-800' :
                        product.estatus === 'Inactivo' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {product.estatus}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.tasaBase || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.baseCalculo}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.vigenciaLineaDias || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.diasParaRenovacion || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{product.numDisposicionesAbiertas || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Pagination Info */}
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
          <div>
            Mostrando {paginationData.startIndex + 1} a {Math.min(paginationData.endIndex, filteredProductos.length)} de {filteredProductos.length} registros
            {(searchTerm || sublineaFilter) && ` (filtrados de ${products.length} registros totales)`}
          </div>
          <div>
            Página {currentPage} de {paginationData.totalPages || 1}
          </div>
        </div>
      </div>
    </div>
  );
}