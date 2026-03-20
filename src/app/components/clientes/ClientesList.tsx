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
            <h2 className="text-lg font-normal text-gray-800">Lista de Clientes</h2>
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
              <option>Vista general del Cliente</option>
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
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">ID CLIENTE</th>
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PANEL DE DIAGNÓSTICO — Endpoint de Lista de Clientes              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="px-4 py-3 border-t border-gray-300">
        <button
          onClick={() => setShowDiagnostico(!showDiagnostico)}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            {showDiagnostico ? (
              <path d="M3 5l4 4 4-4" />
            ) : (
              <path d="M5 3l4 4-4 4" />
            )}
          </svg>
          <span>Diagnóstico del Endpoint {diagnostico ? `(${diagnostico.durationMs}ms)` : ''}</span>
          {diagnostico?.filtroOcultoDetectado && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">FILTRO OCULTO DETECTADO</span>
          )}
          {diagnostico && !diagnostico.filtroOcultoDetectado && diagnostico.totalRegistros > 0 && (
            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">OK</span>
          )}
          {diagnostico?.errorRaw && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">ERROR</span>
          )}
        </button>

        {showDiagnostico && diagnostico && (
          <div className="mt-3 border border-gray-300 rounded bg-gray-50 text-xs overflow-hidden">
            {/* Sección 1: Verificación de la tabla real */}
            <div className="p-3 border-b border-gray-200">
              <h4 className="text-gray-800 mb-2" style={{ fontWeight: 600 }}>1. Tabla REAL consultada</h4>
              <div className="grid grid-cols-2 gap-1 text-gray-600">
                <span>Tabla:</span>
                <span className="text-gray-900" style={{ fontWeight: 500 }}>{diagnostico.tablaConsultada}</span>
                <span>Esquema:</span>
                <span className="text-gray-900">{diagnostico.esquema}</span>
                <span>Es J_PROSPECTOS?</span>
                <span className="text-green-700" style={{ fontWeight: 500 }}>NO — Consulta J_CLIENTES exclusivamente</span>
                <span>Vista/repo compartido?</span>
                <span className={diagnostico.comparteEndpointConProspectos ? 'text-amber-700' : 'text-green-700'} style={{ fontWeight: 500 }}>
                  {diagnostico.comparteEndpointConProspectos
                    ? 'SI — Endpoint /clientes-prospectos es compartido con useProspectosDB'
                    : 'NO — Endpoint exclusivo'}
                </span>
              </div>
              <div className="mt-2 p-2 bg-gray-100 rounded font-mono text-[11px] text-gray-700 overflow-x-auto">
                <span className="text-purple-700">SQL ejecutado:</span> {diagnostico.sqlEsperado}
              </div>
            </div>

            {/* Sección 2: Filtro oculto por TYPE */}
            <div className="p-3 border-b border-gray-200">
              <h4 className="text-gray-800 mb-2" style={{ fontWeight: 600 }}>2. Filtro oculto por TYPE</h4>
              <div className={`p-2 rounded ${diagnostico.filtroOcultoDetectado ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none mt-[-2px]">{diagnostico.filtroOcultoDetectado ? '⚠️' : '✅'}</span>
                  <div>
                    <span className={`${diagnostico.filtroOcultoDetectado ? 'text-red-800' : 'text-green-800'}`} style={{ fontWeight: 500 }}>
                      {diagnostico.filtroOcultoDetectado ? 'FILTRO OCULTO DETECTADO' : 'Sin filtro oculto'}
                    </span>
                    <p className={`mt-1 ${diagnostico.filtroOcultoDetectado ? 'text-red-700' : 'text-green-700'}`}>
                      {diagnostico.filtroOcultoRazon}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección 3: Conteos y desglose */}
            <div className="p-3 border-b border-gray-200">
              <h4 className="text-gray-800 mb-2" style={{ fontWeight: 600 }}>3. Registros recibidos del endpoint</h4>
              <div className="flex items-center gap-6 mb-3">
                <div className="text-center">
                  <div className="text-2xl text-gray-900" style={{ fontWeight: 700 }}>{diagnostico.totalRegistros}</div>
                  <div className="text-gray-500">Total</div>
                </div>
                <div className="h-10 w-px bg-gray-300" />
                <div className="text-center">
                  <div className={`text-2xl ${diagnostico.tieneRegistrosCliente ? 'text-green-700' : 'text-red-600'}`} style={{ fontWeight: 700 }}>
                    {diagnostico.conteosPorType['Cliente'] || 0}
                  </div>
                  <div className="text-gray-500">Cliente</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl text-blue-700" style={{ fontWeight: 700 }}>{diagnostico.conteosPorType['Prospecto'] || 0}</div>
                  <div className="text-gray-500">Prospecto</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl text-purple-700" style={{ fontWeight: 700 }}>{diagnostico.conteosPorType['Contacto'] || 0}</div>
                  <div className="text-gray-500">Contacto</div>
                </div>
                {Object.entries(diagnostico.conteosPorType)
                  .filter(([t]) => !['Cliente', 'Prospecto', 'Contacto'].includes(t))
                  .map(([t, c]) => (
                    <div key={t} className="text-center">
                      <div className="text-2xl text-gray-600" style={{ fontWeight: 700 }}>{c}</div>
                      <div className="text-gray-500">{t}</div>
                    </div>
                  ))}
              </div>

              {/* Desglose subtipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500">Desglose por subtipo:</span>
                  <div className="mt-1 space-y-0.5">
                    {Object.entries(diagnostico.conteosPorSubtipo).map(([s, c]) => (
                      <div key={s} className="flex justify-between text-gray-700">
                        <span>{s}</span>
                        <span style={{ fontWeight: 500 }}>{c}</span>
                      </div>
                    ))}
                    {Object.keys(diagnostico.conteosPorSubtipo).length === 0 && (
                      <span className="text-gray-400">Sin datos</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Desglose por estatus:</span>
                  <div className="mt-1 space-y-0.5">
                    {Object.entries(diagnostico.conteosPorEstatus).map(([e, c]) => (
                      <div key={e} className="flex justify-between text-gray-700">
                        <span>{e}</span>
                        <span style={{ fontWeight: 500 }}>{c}</span>
                      </div>
                    ))}
                    {Object.keys(diagnostico.conteosPorEstatus).length === 0 && (
                      <span className="text-gray-400">Sin datos</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sección 4: Compartición con Prospectos */}
            <div className="p-3 border-b border-gray-200">
              <h4 className="text-gray-800 mb-2" style={{ fontWeight: 600 }}>4. Compartición con módulo Prospectos</h4>
              {diagnostico.usaFallback && (
                <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded">
                  <span className="text-amber-800" style={{ fontWeight: 500 }}>FALLBACK ACTIVO: </span>
                  <span className="text-amber-700">{diagnostico.fallbackRazon}</span>
                </div>
              )}
              {diagnostico.endpointExclusivo && (
                <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded">
                  <span className="text-green-800" style={{ fontWeight: 500 }}>ENDPOINT EXCLUSIVO ACTIVO: </span>
                  <span className="text-green-700">/clientes-lista-todos con handler propio getClientesListaTodosHandler</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-1 text-gray-600">
                <span>Comparte endpoint:</span>
                <span className={diagnostico.comparteEndpointConProspectos ? 'text-amber-700' : 'text-green-700'} style={{ fontWeight: 500 }}>
                  {diagnostico.comparteEndpointConProspectos
                    ? 'SI — Usando /clientes-prospectos (fallback) compartido con useProspectosDB'
                    : 'NO — Usando /clientes-lista-todos (exclusivo)'}
                </span>
                <span>Comparte handler:</span>
                <span className={diagnostico.comparteHandlerConProspectos ? 'text-amber-700' : 'text-green-700'} style={{ fontWeight: 500 }}>
                  {diagnostico.comparteHandlerConProspectos
                    ? 'SI — getClientesProspectosHandler (fallback)'
                    : 'NO — getClientesListaTodosHandler (exclusivo)'}
                </span>
                <span>Comparte DTO:</span>
                <span className="text-green-700" style={{ fontWeight: 500 }}>NO — ClienteDB es independiente de ProspectoDB</span>
                <span>Comparte mapeo:</span>
                <span className="text-green-700" style={{ fontWeight: 500 }}>NO — mapRowToCliente es independiente</span>
              </div>
            </div>

            {/* Sección 5: Metadata del endpoint */}
            <div className="p-3 border-b border-gray-200">
              <h4 className="text-gray-800 mb-2" style={{ fontWeight: 600 }}>5. Metadata del endpoint</h4>
              <div className="grid grid-cols-2 gap-1 text-gray-600">
                <span>URL completa:</span>
                <span className="font-mono text-[10px] text-gray-700 break-all">{diagnostico.endpointUrl}</span>
                <span>HTTP Status:</span>
                <span className={diagnostico.httpStatus === 200 ? 'text-green-700' : 'text-red-700'} style={{ fontWeight: 500 }}>
                  {diagnostico.httpStatus} {diagnostico.httpStatusText}
                </span>
                <span>Edge Version (reportada):</span>
                <span className="font-mono text-gray-700">{diagnostico.edgeVersion}</span>
                <span>Endpoint (reportado):</span>
                <span className="font-mono text-gray-700">{diagnostico.endpointReportado}</span>
                <span>Response keys:</span>
                <span className="font-mono text-gray-700">{diagnostico.rawResponseKeys.join(', ')}</span>
                <span>Duración:</span>
                <span className="text-gray-700">{diagnostico.durationMs}ms</span>
                <span>Timestamp:</span>
                <span className="text-gray-700">{diagnostico.timestamp}</span>
              </div>
            </div>

            {/* Sección 6: DTO usado */}
            <div className="p-3 border-b border-gray-200">
              <h4 className="text-gray-800 mb-2" style={{ fontWeight: 600 }}>6. DTO usado</h4>
              <div className="text-gray-600">
                <span>Interface: </span>
                <span className="font-mono text-gray-800">{diagnostico.dtoUsado}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {diagnostico.camposDTO.map(c => (
                  <span key={c} className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono text-gray-700">{c}</span>
                ))}
              </div>
              <div className="mt-2 text-gray-600">
                <span>Campos de Prospectos en DTO: </span>
                <span className="text-green-700" style={{ fontWeight: 500 }}>NO — No tiene idProspecto, estatusProspecto, listasNegras, sic como campos primarios</span>
              </div>
            </div>

            {/* Sección 7: Primer registro raw */}
            {diagnostico.primerRegistroRaw && (
              <div className="p-3 border-b border-gray-200">
                <h4 className="text-gray-800 mb-2" style={{ fontWeight: 600 }}>7. Muestra: Primer registro (raw)</h4>
                <div className="p-2 bg-gray-100 rounded font-mono text-[10px] text-gray-700 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(diagnostico.primerRegistroRaw, null, 2)}
                </div>
                <div className="mt-2 text-gray-600">
                  <span>Keys en data (jsonb): </span>
                  <span className="font-mono text-gray-700">{diagnostico.primerRegistroDataKeys.length} campos</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {diagnostico.primerRegistroDataKeys.map(k => (
                    <span key={k} className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[10px] font-mono text-blue-700">{k}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Sección 7.5: Diagnóstico del servidor */}
            {diagnostico.diagnosticoServidor && (
              <div className="p-3 border-b border-gray-200">
                <h4 className="text-gray-800 mb-2" style={{ fontWeight: 600 }}>7b. Diagnóstico del servidor (server-side)</h4>
                <div className="p-2 bg-gray-100 rounded font-mono text-[10px] text-gray-700 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(diagnostico.diagnosticoServidor, null, 2)}
                </div>
              </div>
            )}

            {/* Sección 8: Error raw */}
            {diagnostico.errorRaw && (
              <div className="p-3 border-b border-gray-200">
                <h4 className="text-red-800 mb-2" style={{ fontWeight: 600 }}>ERROR RAW</h4>
                <div className="p-2 bg-red-50 border border-red-200 rounded font-mono text-[10px] text-red-700">
                  {diagnostico.errorRaw}
                </div>
              </div>
            )}

            {/* Sección 9: Corrección necesaria */}
            <div className="p-3">
              <h4 className="text-gray-800 mb-2" style={{ fontWeight: 600 }}>8. Corrección necesaria</h4>
              {diagnostico.filtroOcultoDetectado ? (
                <div className="space-y-2 text-gray-700">
                  <p>El endpoint devuelve registros pero el diagnóstico detectó una inconsistencia.
                    Verificar que la edge function desplegada corresponda a la versión <span className="font-mono">v16.0-sin-filtros</span> (sin WHERE).</p>
                  <p style={{ fontWeight: 600 }}>Acciones requeridas (en orden de prioridad):</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Forzar redespliegue del edge function en Supabase Dashboard</li>
                    <li>O ejecutar la migración SQL en SQL Editor para crear las RPCs como fallback</li>
                    <li>O verificar manualmente: visitar <span className="font-mono text-blue-700">/health</span> y confirmar que <span className="font-mono">_version</span> coincide con <span className="font-mono">{diagnostico.edgeVersion || 'la versión esperada'}</span></li>
                  </ol>
                </div>
              ) : diagnostico.totalRegistros === 0 && !diagnostico.errorRaw ? (
                <div className="text-gray-700">
                  <p>La tabla J_CLIENTES no contiene registros. Insertar datos de prueba con el endpoint <span className="font-mono">/seed-prospecto</span> o directamente en SQL Editor.</p>
                </div>
              ) : !diagnostico.errorRaw ? (
                <div className="text-green-700">
                  <p>El endpoint funciona correctamente. Devuelve todos los registros de J_CLIENTES sin filtros ocultos.</p>
                </div>
              ) : (
                <div className="text-red-700">
                  <p>El endpoint reportó un error. Revisar la sección ERROR RAW arriba.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}