/**
 * ClientesList.tsx
 *
 * Formulario de Lista Principal — Módulo Clientes → SubTab Lista de Clientes
 *
 * ══════════════════════════════════════════════════════════════════
 * Fuente de datos:  J_CLIENTES  (SIN FILTROS — todos los registros)
 * Hook:             useClientesDB v8.0
 *
 * Columnas institucionales:
 *   Editar | Ver        → Liga de Edit / Liga de View (usa dbUuid como llave primaria)
 *   ID CLIENTE           → data.idCliente o data.idProspecto
 *   NOMBRE COMPLETO      → data.nombre + data.apellidoPaterno + data.apellidoMaterno
 *   CURP                 → data.curp
 *   RFC                  → data.rfc
 *   TELÉFONO             → data.telefono
 *   CORREO               → data.correoElectronico
 *   ESTATUS              → columna estatus
 *   SUBTIPO              → columna subtipo
 *   TIPO                 → columna type
 *   FECHA ORIGINACIÓN    → data.fechaOriginacion
 * ══════════════════════════════════════════════════════════════════
 */
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import type { ClienteDB, BackendStatus, DiagnosticoEndpoint } from '../../hooks/useClientesDB';

// ── Re-export para compatibilidad con módulos legacy ──
// AltaClienteDefault.tsx, ClientesDashboard.tsx importan { Cliente } desde aquí
export type { Cliente } from '../../data/mockClientesData';
export { mockClientes } from '../../data/mockClientesData';

interface ClientesListProps {
  clientes: ClienteDB[];
  loading?: boolean;
  error?: string | null;
  warning?: string | null;
  backendStatus?: BackendStatus;
  diagnostico?: DiagnosticoEndpoint | null;
  onRefresh?: () => void;
  onNew?: () => void;
  onEdit?: (cliente: ClienteDB) => void;
  onView?: (cliente: ClienteDB) => void;
}

export function ClientesList({
  clientes,
  loading,
  error,
  warning,
  backendStatus,
  diagnostico,
  onRefresh,
  onNew,
  onEdit,
  onView,
}: ClientesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDiagnostico, setShowDiagnostico] = useState(false);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

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

  // Parse date string (DD/MM/YYYY or ISO) to Date
  const parseDate = (dateStr: string) => {
    if (!dateStr || typeof dateStr !== 'string') {
      return new Date();
    }
    if (dateStr.includes('T') || (dateStr.includes('-') && !dateStr.includes('/'))) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date();
    const [day, month, year] = parts;
    if (!day || !month || !year) return new Date();
    const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  };

  // Helper: formatear fecha a DD/MM/YYYY para display
  const formatDateDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr) || /^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) return dateStr;
    if (dateStr.includes('T') || dateStr.includes('-')) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
      }
    }
    return dateStr;
  };

  const filteredClientes = clientes
    .filter(cliente => {
      const s = searchTerm.toLowerCase();
      return (
        cliente.nombreCompleto.toLowerCase().includes(s) ||
        cliente.curp.toLowerCase().includes(s) ||
        cliente.rfc.toLowerCase().includes(s) ||
        cliente.correoElectronico.toLowerCase().includes(s) ||
        cliente.idCliente.toLowerCase().includes(s) ||
        cliente.estatus.toLowerCase().includes(s) ||
        cliente.subtipo.toLowerCase().includes(s) ||
        cliente.tipo.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      const dateA = parseDate(a.fechaOriginacion).getTime();
      const dateB = parseDate(b.fechaOriginacion).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredClientes.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClientes = filteredClientes.slice(startIndex, endIndex);

  const handlePreviousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const handleFirstPage = () => { setCurrentPage(1); };
  const handleLastPage = () => { setCurrentPage(totalPages); };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: 'desc' | 'asc') => {
    setSortOrder(value);
    setCurrentPage(1);
  };

  // ── Estatus badge ──
  const renderEstatus = (estatus: string) => {
    const lower = estatus.toLowerCase();
    let bgColor = 'bg-gray-100 text-gray-700';
    if (lower === 'activo') bgColor = 'bg-green-100 text-green-800';
    else if (lower === 'inactivo') bgColor = 'bg-red-100 text-red-800';
    else if (lower === 'pendiente') bgColor = 'bg-yellow-100 text-yellow-800';
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${bgColor}`}>
        {estatus || '—'}
      </span>
    );
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header Section con ícono y título */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Lista de Personas</h2>
            <button className="p-1 ml-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="8" cy="8" r="6"/>
                <path d="M13 13l3 3"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={handleListaClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Lista</span>
            <span onClick={handleBuscarClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* Filter Section con Ver, Dropdown y Nuevo */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[200px]">
              <option>Vista general de Personas</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666">
              <path d="M6 8l-4-4h8z"/>
            </svg>
          </div>
          <button onClick={onNew} className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">
            Nuevo
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-400 rounded text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loading ? '⟳ Cargando...' : '⟳ Refrescar'}
            </button>
          )}
        </div>
      </div>

      {/* Filtros Label */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <div className="flex items-center gap-2">
            <input 
              ref={searchBarRef}
              type="text" 
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por nombre, CURP, RFC, correo..." 
              className="px-3 py-1 border border-gray-400 rounded text-sm w-72 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Action Icons Bar */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
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
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="var(--theme-secondary)">
                  <path d="M5 7l-3-3h6z"/>
                </svg>
              </div>
              <button 
                className="p-0.5 text-secondary-theme disabled:opacity-40" 
                title="Anterior"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M10 3L5 8l5 5V3z"/>
                </svg>
              </button>
              <button 
                className="p-0.5 text-secondary-theme disabled:opacity-40" 
                title="Siguiente"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 3l5 5-5 5V3z"/>
                </svg>
              </button>
            </div>
            <span className="font-medium">Total: {clientes.length}</span>
          </div>
        </div>
      </div>

      {/* ── Error / Warning / Pending states ── */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
              <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 4v5M8 11v1"/>
            </svg>
            <span>{error}</span>
            {onRefresh && <button onClick={onRefresh} className="ml-auto underline hover:text-red-900 shrink-0">Reintentar</button>}
          </div>
        </div>
      )}

      {!error && warning && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 text-amber-500">
              <path d="M8 1l7 14H1L8 1z" fill="none" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M8 6v4M8 12v1"/>
            </svg>
            <span>{warning}</span>
            {onRefresh && <button onClick={onRefresh} className="ml-auto underline hover:text-amber-900 shrink-0">Reintentar</button>}
          </div>
        </div>
      )}

      {!error && !warning && backendStatus === 'pending-deploy' && (
        <div className="mx-4 mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span>Sincronizando con el backend... El edge function se esta redesplegando.</span>
            {onRefresh && <button onClick={onRefresh} className="ml-auto underline hover:text-blue-900 shrink-0">Reintentar</button>}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-x-auto" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm" style={{ backgroundColor: 'transparent' }}>
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">Editar | Ver</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">ID</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">NOMBRE COMPLETO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">CURP</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">RFC</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">TELÉFONO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">CORREO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">ESTATUS</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">SUBTIPO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">TIPO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">FECHA ORIGINACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {loading && clientes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Consultando J_CLIENTES (todos los registros)...
                    </div>
                  </td>
                </tr>
              ) : currentClientes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                    {searchTerm
                      ? `No se encontraron registros para "${searchTerm}"`
                      : 'La tabla J_CLIENTES no contiene registros.'}
                  </td>
                </tr>
              ) : (
                currentClientes.map((cliente, index) => (
                  <tr 
                    key={cliente.dbUuid} 
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{
                      backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                  >
                    {/* Liga de Edit / Liga de View — llave primaria: dbUuid */}
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onEdit?.(cliente); }}>Editar</a>
                      <span className="text-gray-700"> | </span>
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onView?.(cliente); }}>Ver</a>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{cliente.idCliente || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{cliente.nombreCompleto}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{cliente.curp || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{cliente.rfc || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{cliente.telefono || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{cliente.correoElectronico || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{renderEstatus(cliente.estatus)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{cliente.subtipo || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{cliente.tipo || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatDateDisplay(cliente.fechaOriginacion)}</td>
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