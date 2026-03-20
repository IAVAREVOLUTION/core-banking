import { useState, useRef, useEffect } from 'react';
import { Garantia } from '@/types/garantia';
import { toast } from 'sonner';
import type { GarantiaBackendStatus } from '@/app/hooks/useGarantiasDB';

interface GarantiasListProps {
  garantias: Garantia[];
  loading: boolean;
  backendStatus: GarantiaBackendStatus;
  onNew: () => void;
  onEdit: (garantia: Garantia) => void;
  onView: (garantia: Garantia) => void;
}

export function GarantiasList({ garantias, loading, backendStatus, onNew, onEdit, onView }: GarantiasListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);
  
  // Estado para anchos de columnas — columnas reales de J_GARANTIAS
  const [columnWidths, setColumnWidths] = useState({
    actions: 100,
    id: 100,
    garantia: 180,
    tipo: 120,
    subtipo: 120,
    ubicacion: 200,
    valorNominal: 140,
    fechaRegistro: 130,
    clienteId: 130,
  });
  
  const [resizing, setResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  console.log('[GarantiasDB] Lista — total:', garantias.length, '| backendStatus:', backendStatus);

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  /** Trunca UUID para display legible */
  const truncateId = (id: string | number): string => {
    const s = String(id);
    return s.length > 12 ? s.substring(0, 8) + '...' : s;
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

  const filteredGarantias = garantias
    .filter(garantia => {
      const searchLower = searchTerm.toLowerCase();
      return (
        (garantia.garantia || '').toLowerCase().includes(searchLower) ||
        String(garantia.id).toLowerCase().includes(searchLower) ||
        (garantia.tipo || '').toLowerCase().includes(searchLower) ||
        (garantia.subtipo || '').toLowerCase().includes(searchLower) ||
        (garantia.ubicacion || '').toLowerCase().includes(searchLower) ||
        (garantia.cliente_id || '').toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.fechaRegistro || 0).getTime();
      const dateB = new Date(b.fechaRegistro || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredGarantias.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentGarantias = filteredGarantias.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleFirstPage = () => {
    setCurrentPage(1);
  };

  const handleLastPage = () => {
    setCurrentPage(totalPages);
  };

  // Reset page when search or sort changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

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

  // ── Status banner ──
  const statusBanner = () => {
    if (backendStatus === 'pending-deploy') {
      return (
        <div className="mx-4 mt-2 px-3 py-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
          RPCs no disponibles — ejecutar <code className="bg-yellow-100 px-1 rounded">hotfix-insert-jgarantia.sql</code> en Supabase SQL Editor. Mostrando datos de sessionStorage.
        </div>
      );
    }
    if (backendStatus === 'error') {
      return (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-50 border border-red-300 rounded text-xs text-red-800">
          Error de conexión con J_GARANTIAS. Revisar consola para más detalles.
        </div>
      );
    }
    if (backendStatus === 'local-only') {
      return (
        <div className="mx-4 mt-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded text-xs text-gray-600">
          Modo local — datos almacenados solo en sessionStorage.
        </div>
      );
    }
    return null;
  };

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
            <h2 className="text-lg font-normal text-gray-800">Garantías</h2>
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
              <option>Vista general de garantías</option>
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
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar garantías..." 
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
                disabled={currentPage === totalPages}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 3l5 5-5 5V3z"/>
                </svg>
              </button>
            </div>
            <span className="font-medium">Total: {garantias.length}</span>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {statusBanner()}

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
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.id}px` }}>
                  ID
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'id')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.garantia}px` }}>
                  GARANTÍA
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'garantia')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.tipo}px` }}>
                  TIPO
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'tipo')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.subtipo}px` }}>
                  SUBTIPO
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'subtipo')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.ubicacion}px` }}>
                  UBICACIÓN
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'ubicacion')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.valorNominal}px` }}>
                  VALOR NOMINAL
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'valorNominal')}
                  />
                </th>
                <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.fechaRegistro}px` }}>
                  FECHA REGISTRO
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'fechaRegistro')}
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${columnWidths.clienteId}px` }}>
                  CLIENTE ID
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="animate-spin h-6 w-6 text-[#0099CC]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      <span className="text-sm">Cargando desde J_GARANTIAS...</span>
                    </div>
                  </td>
                </tr>
              ) : currentGarantias.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <path d="M3 9h18M9 3v18"/>
                      </svg>
                      <span className="text-sm">
                        {searchTerm
                          ? 'No se encontraron garantías con ese criterio de búsqueda'
                          : 'No hay registros en J_GARANTIAS. Haz clic en "Nuevo" para crear una garantía.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                currentGarantias.map((garantia, index) => (
                  <tr 
                    key={garantia.id} 
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{
                      backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                  >
                    <td className="px-3 py-2.5 text-xs overflow-hidden text-ellipsis">
                      <a href="#" onClick={(e) => { e.preventDefault(); onEdit(garantia); }} className="text-[#0066CC] hover:underline">Editar</a>
                      <span className="text-gray-700"> | </span>
                      <a href="#" onClick={(e) => { e.preventDefault(); onView(garantia); }} className="text-[#0066CC] hover:underline">Ver</a>
                    </td>
                    <td className="px-3 py-2.5 overflow-hidden">
                      <div className="text-xs text-gray-700" title={String(garantia.id)}>
                        {truncateId(garantia.id)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 overflow-hidden">
                      <div className="text-xs text-gray-700 text-ellipsis overflow-hidden whitespace-nowrap">{garantia.garantia || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">{garantia.tipo || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">{garantia.subtipo || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap" title={garantia.ubicacion || ''}>{garantia.ubicacion || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">{garantia.valorNominal ? formatCurrency(garantia.valorNominal) : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">{formatDate(garantia.fechaRegistro)}</td>
                    <td className="px-3 py-2.5 overflow-hidden">
                      <div className="text-xs text-gray-700" title={garantia.cliente_id || ''}>
                        {garantia.cliente_id ? truncateId(garantia.cliente_id) : '—'}
                      </div>
                    </td>
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
            Página {currentPage} de {totalPages}
          </div>
          <button 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" 
            title="Página siguiente" 
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M5 4l5 5-5 5V4z"/>
            </svg>
          </button>
          <button 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" 
            title="Última página" 
            onClick={handleLastPage}
            disabled={currentPage === totalPages}
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
