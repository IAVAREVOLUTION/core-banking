import { useState, useRef, useEffect, useMemo } from 'react';
import { Product } from '../../types/product';
import { toast } from 'sonner';

interface ProductosListProps {
  products: Product[];
  onNew: () => void;
  onEdit: (producto: Product) => void;
  onView: (producto: Product) => void;
  tipoProducto?: 'captacion' | 'credito' | 'producto-credito' | 'seguros';
  loading?: boolean;
  error?: string | null;
  onRefetch?: () => void;
}

export function ProductosList({ products, onNew, onEdit, onView, tipoProducto, loading, error, onRefetch }: ProductosListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [sublineaFilter, setSublineaFilter] = useState<string>('');
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);
  
  // Detectar si son productos de Crédito o Captación basándose en prop o en productos existentes
  const isCredito = useMemo(() => {
    if (tipoProducto) return tipoProducto === 'credito';
    return products.length > 0 && products[0].lineaProducto === 'Crédito';
  }, [products, tipoProducto]);
  
  const isCaptacion = useMemo(() => {
    if (tipoProducto) return tipoProducto === 'captacion';
    return products.length > 0 && products[0].lineaProducto === 'Captación';
  }, [products, tipoProducto]);

  const isSeguros = useMemo(() => {
    if (tipoProducto) return tipoProducto === 'seguros';
    return products.length > 0 && (products[0].lineaProducto || '').toLowerCase().includes('seguro');
  }, [products, tipoProducto]);
  
  // Estado para anchos de columnas - Inicializar una sola vez
  const getInitialColumnWidths = () => {
    if (tipoProducto === 'credito' || (products.length > 0 && products[0].lineaProducto === 'Crédito')) {
      return {
        actions: 100,
        nombre: 150,
        clave: 100,
        claveEBS: 100,
        vddRowId: 100,
        tipoProducto: 120,
        estatus: 90,
        opcionCompra: 110,
        porcentajeOpcionCompra: 120,
        tasaBase: 90,
        calculo: 90,
        baseCalculo: 110,
        productoSegu: 120,
        referenciaCliente: 130,
        referenciaProducto: 140,
        rentabilidad: 100,
        tasa: 80,
      };
    }
    if (tipoProducto === 'captacion' || (products.length > 0 && products[0].lineaProducto === 'Captación')) {
      return {
        actions: 100,
        clave: 100,
        producto: 150,
        tipoProducto: 150,
        lineaProducto: 150,
        tipoTasa: 100,
        estatus: 100,
        cuentaEje: 100,
      };
    }
    return {
      actions: 100,
      idProducto: 100,
      nombre: 180,
      descripcion: 250,
      lineaProducto: 150,
      sublinea: 150,
      sucursal: 120,
      estatus: 100,
      fecha: 120,
    };
  };
  
  const [columnWidths, setColumnWidths] = useState(getInitialColumnWidths());
  const [resizing, setResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Debug: Log total products
  console.log('Total de productos cargados:', products.length);

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

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setIsSearching(true);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (term) {
      searchTimeoutRef.current = setTimeout(() => {
        setIsSearching(false);
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

  // CRÍTICO: Usar useMemo para evitar filtrados y ordenamientos en cada render
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

  // Paginación con useMemo
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredProductos.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentProductos = filteredProductos.slice(startIndex, endIndex);
    return { totalPages, currentProductos, startIndex, endIndex };
  }, [filteredProductos, currentPage, itemsPerPage]);

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

  // Reset page when search or sort changes
  const handleSortChange = (value: 'desc' | 'asc') => {
    setSortOrder(value);
    setCurrentPage(1);
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
            <h2 className="text-lg font-normal text-gray-800">{isSeguros ? 'Productos Seguros' : 'Productos'}</h2>
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
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar productos...\" 
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

      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
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
                {isCredito ? (
                  <>
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
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.claveEBS}px` }}>
                      CLAVE EBS
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'claveEBS')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.vddRowId}px` }}>
                      VDD ROW ID
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'vddRowId')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.tipoProducto}px` }}>
                      TIPO PRODUCTO
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'tipoProducto')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.estatus}px` }}>
                      ESTATUS
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'estatus')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.opcionCompra}px` }}>
                      OPCIÓN COMPRA
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'opcionCompra')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.porcentajeOpcionCompra}px` }}>
                      % OPCIÓN COMPRA
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'porcentajeOpcionCompra')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.tasaBase}px` }}>
                      TASA BASE
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'tasaBase')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.calculo}px` }}>
                      CÁLCULO
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'calculo')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.baseCalculo}px` }}>
                      BASE CÁLCULO
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'baseCalculo')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.productoSegu}px` }}>
                      PRODUCTO SEGU
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'productoSegu')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.referenciaCliente}px` }}>
                      REFERENCIA CLIENTE
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'referenciaCliente')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.referenciaProducto}px` }}>
                      REFERENCIA PRODUCTO
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'referenciaProducto')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.rentabilidad}px` }}>
                      RENTABILIDAD
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'rentabilidad')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.tasa}px` }}>
                      TASA
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'tasa')}
                      />
                    </th>
                  </>
                ) : isCaptacion ? (
                  <>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.clave}px` }}>
                      CLAVE
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'clave')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.producto}px` }}>
                      PRODUCTO
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'producto')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.tipoProducto}px` }}>
                      TIPO DE PRODUCTO
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'tipoProducto')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.lineaProducto}px` }}>
                      LÍNEA DE PRODUCTO
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'lineaProducto')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.tipoTasa}px` }}>
                      TIPO TASA
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'tipoTasa')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.estatus}px` }}>
                      ESTATUS
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'estatus')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.cuentaEje}px` }}>
                      CUENTA EJE
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'cuentaEje')}
                      />
                    </th>
                  </>
                ) : (
                  <>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.idProducto}px` }}>
                      ID PRODUCTO
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'idProducto')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.nombre}px` }}>
                      NOMBRE
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'nombre')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.descripcion}px` }}>
                      DESCRIPCIÓN
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'descripcion')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.lineaProducto}px` }}>
                      LÍNEA PRODUCTO
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'lineaProducto')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.sublinea}px` }}>
                      SUBLÍNEA
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'sublinea')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.sucursal}px` }}>
                      SUCURSAL
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'sucursal')}
                      />
                    </th>
                    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.estatus}px` }}>
                      ESTATUS
                      <div
                        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, 'estatus')}
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.fecha}px` }}>
                      FECHA REGISTRO
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {paginationData.currentProductos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                paginationData.currentProductos.map((producto, index) => (
                  <tr 
                    key={`producto-${producto.id || index}-${index}`} 
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{
                      backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                  >
                    <td className="px-3 py-2.5 text-xs overflow-hidden text-ellipsis">
                      <a href="#" onClick={(e) => { e.preventDefault(); onEdit(producto); }} className="text-[#0066CC] hover:underline">Editar</a>
                      <span className="text-gray-700"> | </span>
                      <a href="#" onClick={(e) => { e.preventDefault(); onView(producto); }} className="text-[#0066CC] hover:underline">Ver</a>
                    </td>
                    {isCredito ? (
                      <>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.nombre || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.clave || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.claveEBS || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.vddRowId || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.tipoProducto || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.estatus || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.opcionCompra || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.porcentajeOpcionCompra !== undefined ? producto.porcentajeOpcionCompra : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.tasaBase !== undefined ? producto.tasaBase : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.calculo !== undefined ? producto.calculo : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.baseCalculo !== undefined ? producto.baseCalculo : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.productoSegu !== undefined ? producto.productoSegu : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.referenciaCliente !== undefined ? producto.referenciaCliente : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.referenciaProducto !== undefined ? producto.referenciaProducto : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.rentabilidad !== undefined ? producto.rentabilidad : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.tasa !== undefined ? producto.tasa : ''}</div>
                        </td>
                      </>
                    ) : isCaptacion ? (
                      <>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.clave || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.producto || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.tipoProducto || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.lineaProducto || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.tipoTasa || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.estatus || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap flex items-center gap-1.5">
                            {producto.cuentaEje === true ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
                                  <rect x="1" y="1" width="18" height="18" rx="3" className="fill-green-500" />
                                  <path d="M5.5 10.5L8.5 13.5L14.5 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span className="truncate text-green-700 font-medium">Sí</span>
                              </>
                            ) : (
                              <span className="truncate text-gray-400">No</span>
                            )}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700">{producto.idProducto || `PR-${(producto.id || 0).toString().padStart(3, '0')}`}</div>
                        </td>
                        <td className="px-3 py-2.5 overflow-hidden">
                          <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{producto.nombre}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">{producto.descripcion}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">{producto.lineaProducto}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">{producto.sublineaProducto}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">{producto.sucursal}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">{producto.estatus}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">{formatDate(producto.fechaRegistro)}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" 
            title="Primera página" 
            onClick={handleFirstPage}
            disabled={currentPage === 1}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M13 4L4 9l9 5V4z"/>
            </svg>
          </button>
          <button 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" 
            title="Página anterior" 
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M9 4L4 9l5 5V4z"/>
            </svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">
            Página {currentPage} de {paginationData.totalPages}
          </div>
          <button 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" 
            title="Página siguiente" 
            onClick={handleNextPage}
            disabled={currentPage === paginationData.totalPages}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M5 4l5 5-5 5V4z"/>
            </svg>
          </button>
          <button 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" 
            title="Última página" 
            onClick={handleLastPage}
            disabled={currentPage === paginationData.totalPages}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M4 4L13 9l-9 5V4z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}