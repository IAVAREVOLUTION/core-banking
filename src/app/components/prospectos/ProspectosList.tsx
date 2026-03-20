import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export interface Prospecto {
  id: number;
  /** UUID de la llave primaria en J_CLIENTES — para Liga de Edit / Liga de View */
  dbUuid?: string;
  /** ID consecutivo legible: "PROS-001", "PROS-002", etc. */
  idProspecto?: string;
  nombre: string;
  /** TIPO — picklist: Fisica, Moral, Fisica con actividad empresarial */
  tipo?: string;
  /** SUBTIPO — columna subtipo de J_CLIENTES: Persona Fisica, Persona Moral, Persona Fisica con Actividad Empresarial */
  subtipo?: string;
  /** ESTATUS DEL CLIENTE — columna estatus de J_CLIENTES */
  categoria: string;
  sucursal: string;
  estatusSIC: string;
  estatusListaNegra: string;
  fechaOriginacion: string;
  denominacionRazonSocial?: string;
  telefono?: string;
  /** Nombre de pila (sin apellidos) — data.nombre */
  nombrePila?: string;
  /** APELLIDO PATERNO — data.apellidoPaterno */
  apellidoPaterno?: string;
  /** APELLIDO MATERNO — data.apellidoMaterno */
  apellidoMaterno?: string;
  /** SEXO — data.sexo */
  sexo?: string;
  /** FECHA NACIMIENTO — data.fechaNacimiento */
  fechaNacimiento?: string;
  /** ENTIDAD FEDERATIVA — data.entidadFederativa */
  entidadFederativa?: string;
  curp?: string;
  rfc?: string;
  correoElectronico?: string;
  cotizacion?: string;
  direccion?: string;
  // Datos adicionales del JSONB
  estatusProspecto?: string;
  /** ESTATUS — columna estatus de J_CLIENTES: Pendiente, En proceso, Activo, Inactivo */
  estatus?: string;
  // Datos relacionales por prospecto
  direcciones?: any[];
  cotizaciones?: any[];
  consultas?: any[];
  listasNegras?: any[];
  expedientesElectronicos?: any[];
  tablaAmortizacion?: any[];
  /** Nombre de la institucion de gobierno asociada */
  institucionGobierno?: string;
  /** UUID de la institucion de gobierno asociada */
  institucionGobiernoId?: string;
  /** CLASIFICACION CLIENTE — data.clasificacionCliente */
  clasificacionCliente?: string;
  /** Datos crudos del JSONB de J_CLIENTES — para detectar archivos (constanciaResidencia, etc.) */
  _rawData?: Record<string, any>;
}

export const mockProspectos: Prospecto[] = [];

interface ProspectosListProps {
  onNew?: () => void;
  onEdit?: (prospecto: Prospecto) => void;
  onView?: (prospecto: Prospecto) => void;
  prospectos?: Prospecto[];
  onProspectosChange?: (prospectos: Prospecto[]) => void;
  /** Estado de carga desde J_CLIENTES */
  loading?: boolean;
  /** Error de consulta a J_CLIENTES */
  error?: string | null;
  /** Refetch desde J_CLIENTES */
  onRefetch?: () => void;
  /** Método de consulta usado (schema directo, RPC, edge function) */
  queryMethod?: string;
}

export function ProspectosList({ onNew, onEdit, onView, prospectos: prospectosProp, onProspectosChange, loading, error, onRefetch, queryMethod }: ProspectosListProps) {
  const [prospectos, setProspectos] = useState<Prospecto[]>(prospectosProp || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  // Actualizar prospectos cuando cambien desde el prop
  useEffect(() => {
    if (prospectosProp) {
      setProspectos(prospectosProp);
    }
  }, [prospectosProp]);

  // ── Conteo por type (columna "categoria") para diagnóstico visible ──
  const typeDistribution = prospectos.reduce<Record<string, number>>((acc, p) => {
    const t = p.categoria || '(sin type)';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  // Estado para anchos de columnas
  const [columnWidths, setColumnWidths] = useState({
    actions: 100,
    id: 80,
    nombre: 200,
    categoria: 180,
    sucursal: 120,
    estatusSIC: 120,
    estatusListaNegra: 150,
    fechaOriginacion: 140,
  });
  
  const [resizing, setResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const handleExportExcel = () => {
    toast.success('Exportando a Excel', {
      description: 'El archivo se esta descargando...',
      duration: 3000,
    });
  };

  const handleExportCSV = () => {
    toast.success('Exportando a CSV', {
      description: 'El archivo CSV se esta descargando...',
      duration: 3000,
    });
  };

  const handleExportPDF = () => {
    toast.success('Exportando a PDF', {
      description: 'El archivo PDF se esta descargando...',
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
    if (!dateStr) return new Date(0);
    // Soportar ISO (YYYY-MM-DD o ISO 8601) y formato corto (DD/MM/YY)
    if (dateStr.includes('-') || dateStr.includes('T')) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? new Date(0) : d;
    }
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const fullYear = parseInt(year) < 100 ? 2000 + parseInt(year) : parseInt(year);
      return new Date(fullYear, parseInt(month) - 1, parseInt(day));
    }
    return new Date(0);
  };

  // Formatear fecha para la celda de la tabla (siempre DD/MM/YY)
  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    // Si ya es DD/MM/YY, devolver tal cual
    if (/^\d{2}\/\d{2}\/\d{2,4}$/.test(dateStr)) return dateStr;
    // ISO -> DD/MM/YY
    const d = parseDate(dateStr);
    if (d.getTime() === 0) return dateStr;
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const yy = (d.getFullYear() % 100).toString().padStart(2, '0');
    return `${dd}/${mm}/${yy}`;
  };

  const filteredProspectos = prospectos
    .filter(prospecto => {
      const searchLower = searchTerm.toLowerCase();
      return (
        (prospecto.nombre || '').toLowerCase().includes(searchLower) ||
        (prospecto.idProspecto || '').toLowerCase().includes(searchLower) ||
        (prospecto.dbUuid || '').toLowerCase().includes(searchLower) ||
        prospecto.id.toString().includes(searchLower) ||
        (prospecto.sucursal || '').toLowerCase().includes(searchLower) ||
        (prospecto.categoria || '').toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const dateA = parseDate(a.fechaOriginacion).getTime();
      const dateB = parseDate(b.fechaOriginacion).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  // Paginacion
  const totalPages = Math.max(1, Math.ceil(filteredProspectos.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProspectos = filteredProspectos.slice(startIndex, endIndex);

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

  // Funciones para redimensionar columnas
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
      {/* Header Section con icono y titulo */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Prospecto</h2>
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
              <option>Vista general del Prospecto</option>
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
              placeholder="Buscar prospectos..." 
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
              <span>Orden Rapido</span>
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
            <span className="font-medium">Total: {prospectos.length}</span>
          </div>
        </div>
      </div>

      {/* Error de consulta a J_CLIENTES */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>Error al consultar J_CLIENTES: {error}</span>
          {onRefetch && (
            <button onClick={onRefetch} className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-xs font-medium">Reintentar</button>
          )}
        </div>
      )}

      {/* Diagnóstico v17.0: distribución de types recibidos del servidor */}
      {!loading && prospectos.length > 0 && (
        <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-200 text-xs flex items-center gap-3">
          <span className="text-blue-800">
            J_CLIENTES: {prospectos.length} registros |{' '}
            {Object.entries(typeDistribution).map(([t, c]) => `${t}: ${c}`).join(', ')}
            {queryMethod && <> | via: {queryMethod}</>}
          </span>
          {onRefetch && (
            <button onClick={onRefetch} className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 rounded text-[10px] text-blue-700">
              Refrescar
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
        {loading ? (
          <div className="border border-gray-300 px-3 py-8 text-center text-gray-500 bg-white">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-[#0099CC] mr-2 align-middle"></div>
            Consultando J_CLIENTES...
          </div>
        ) : (
        <div className="border border-gray-300 overflow-hidden" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm" style={{ backgroundColor: 'transparent' }}>
            <thead>
              <tr className="bg-[#D0D0D0] border-b border-gray-300">
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">Editar | Ver</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">ID</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">NOMBRE</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">ESTATUS DEL CLIENTE</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">SUCURSAL</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">ESTATUS SIC</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">ESTATUS LISTA NEGRA</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">FECHA ORIGINACION</th>
              </tr>
            </thead>
            <tbody>
              {currentProspectos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    {error ? 'Error al cargar prospectos' : 'No se encontraron prospectos en J_CLIENTES'}
                  </td>
                </tr>
              ) : (
                currentProspectos.map((prospecto, index) => (
                  <tr 
                    key={prospecto.dbUuid || `local-${prospecto.id}`} 
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{
                      backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                  >
                    <td className="px-3 py-2.5 text-xs">
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onEdit?.(prospecto); }}>Editar</a>
                      <span className="text-gray-700"> | </span>
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onView?.(prospecto); }}>Ver</a>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700" title={prospecto.dbUuid || undefined}>
                      {prospecto.idProspecto || `PROS-${prospecto.id.toString().padStart(3, '0')}`}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{prospecto.nombre}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{prospecto.estatus}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{prospecto.sucursal}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{prospecto.estatusSIC}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{prospecto.estatusListaNegra}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{formatDateForDisplay(prospecto.fechaOriginacion)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" 
            title="Primera pagina" 
            onClick={handleFirstPage}
            disabled={currentPage === 1}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M13 4L4 9l9 5V4z"/>
            </svg>
          </button>
          <button 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" 
            title="Pagina anterior" 
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M9 4L4 9l5 5V4z"/>
            </svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">
            Pagina {currentPage} de {totalPages}
          </div>
          <button 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" 
            title="Pagina siguiente" 
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M5 4l5 5-5 5V4z"/>
            </svg>
          </button>
          <button 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" 
            title="Ultima pagina" 
            onClick={handleLastPage}
            disabled={currentPage === totalPages}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M4 4L13 9l-9 5V4z"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes highlight {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(59, 130, 246, 0.1); }
        }
        
        @keyframes highlight-border {
          0%, 100% { border-color: #9CA3AF; }
          50% { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        }
        
        .animate-highlight {
          animation: highlight 1s ease-in-out;
        }
        
        .animate-highlight-border {
          animation: highlight-border 1s ease-in-out;
        }
      `}</style>
    </div>
  );
}