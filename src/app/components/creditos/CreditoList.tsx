import { useState, useRef, useEffect } from 'react';
import { Credito } from '@/types/credito';
import { creditos as creditosData } from '@/data/creditosData';
import { toast } from 'sonner';

interface CreditoListProps {
  onNew?: () => void;
  onEdit?: (credito: Credito) => void;
  onView?: (credito: Credito) => void;
}

export function CreditoList({ onNew, onEdit, onView }: CreditoListProps) {
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Ordenar por fecha de crédito DESC
    const sorted = [...creditosData].sort((a, b) => {
      const dateA = parseDate(a.fechaCredito).getTime();
      const dateB = parseDate(b.fechaCredito).getTime();
      return dateB - dateA;
    });
    setCreditos(sorted);
  }, []);

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
      description: 'El archivo PDF se está descargando...',
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

  // Parse date string (DD/MM/YY) to Date
  const parseDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split('/');
    return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
  };

  const handleNuevoCredito = () => {
    if (onNew) {
      onNew();
    }
  };

  const handleEditar = (credito: Credito) => {
    if (onEdit) {
      onEdit(credito);
    }
  };

  const handleVer = (credito: Credito) => {
    if (onView) {
      onView(credito);
    }
  };

  // Filtrar créditos
  const filteredCreditos = creditos
    .filter((credito) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        credito.nroCredito.toLowerCase().includes(searchLower) ||
        credito.clienteNombre.toLowerCase().includes(searchLower) ||
        credito.sucursal.toLowerCase().includes(searchLower) ||
        credito.estatusCredito.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const dateA = parseDate(a.fechaCredito).getTime();
      const dateB = parseDate(b.fechaCredito).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  // Paginación
  const totalPages = Math.ceil(filteredCreditos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCreditos = filteredCreditos.slice(startIndex, endIndex);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header Section con ícono y título */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="18" rx="2"/>
              <path d="M2 9h20"/>
              <path d="M7 3v4M17 3v4"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Crédito</h2>
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
              <option>Vista general de Créditos</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666">
              <path d="M6 8l-4-4h8z"/>
            </svg>
          </div>
          <button onClick={handleNuevoCredito} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium">
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
              placeholder="Buscar créditos..." 
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
                <select className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                  <option>Admin - Anterior</option>
                  <option>Otro registro 1</option>
                  <option>Otro registro 2</option>
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
                disabled={currentPage === totalPages}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 3l5 5-5 5V3z"/>
                </svg>
              </button>
            </div>
            <span className="font-medium">Total: {creditos.length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm" style={{ backgroundColor: 'transparent' }}>
            <thead>
              <tr className="bg-[#D0D0D0] border-b border-gray-300">
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">Editar | Ver</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">NO. DE CRÉDITO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">CLIENTE</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">FECHA DE CRÉDITO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">MONTO SOLICITADO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">MONTO AUTORIZADO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">LÍNEA PRODUCTO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">SUBLÍNEA</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">PRODUCTO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">SUCURSAL</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">ESTATUS CRÉDITO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">FECHA DE INICIO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">FECHA FIN</th>
              </tr>
            </thead>
            <tbody>
              {currentCreditos.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-gray-500">
                    No se encontraron créditos
                  </td>
                </tr>
              ) : (
                currentCreditos.map((credito, index) => (
                  <tr 
                    key={credito.id} 
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{
                      backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                  >
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); handleEditar(credito); }}>Editar</a>
                      <span className="text-gray-700"> | </span>
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); handleVer(credito); }}>Ver</a>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{credito.nroCredito}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{credito.clienteNombre}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{credito.fechaCredito}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{formatCurrency(credito.montoSolicitado)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{formatCurrency(credito.montoAutorizado)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{credito.lineaProducto}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{credito.sublinea}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{credito.producto}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{credito.sucursal}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{credito.estatusCredito}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{credito.fechaInicio}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{credito.fechaFin}</td>
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