import { useState, useRef, useEffect } from 'react';
import type { InversionCompleta } from '@/types/inversion';
import * as store from './inversionesStore';
import { toast } from 'sonner';

interface Props {
  onNew: () => void;
  onEdit: (inv: InversionCompleta) => void;
  onView: (inv: InversionCompleta) => void;
}

export function InversionesList({ onNew, onEdit, onView }: Props) {
  const inversiones = store.getAll();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  const fmtMoney = (v: string) => (v ? `$${v}` : '$0.00');

  // ── Filtrado ──
  const filteredInversiones = inversiones
    .filter((inv) => {
      const t = searchTerm.toLowerCase();
      return (
        inv.numero.toLowerCase().includes(t) ||
        inv.form.cliente.toLowerCase().includes(t) ||
        inv.form.producto.toLowerCase().includes(t) ||
        inv.form.noCuentaInversion.toLowerCase().includes(t) ||
        inv.form.estatusInversion.toLowerCase().includes(t)
      );
    })
    .sort((a, b) => {
      const cmp = a.id - b.id;
      return sortOrder === 'desc' ? -cmp : cmp;
    });

  // ── Paginación ──
  const totalPages = Math.max(1, Math.ceil(filteredInversiones.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentInversiones = filteredInversiones.slice(startIndex, startIndex + itemsPerPage);

  const handlePreviousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const handleFirstPage = () => setCurrentPage(1);
  const handleLastPage = () => setCurrentPage(totalPages);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: 'desc' | 'asc') => {
    setSortOrder(value);
    setCurrentPage(1);
  };

  // ── Acciones ──
  const handleDelete = (inv: InversionCompleta) => {
    if (confirm(`¿Eliminar inversión ${inv.numero}?`)) {
      store.deleteInversion(inv.id);
      toast.success('Inversión eliminada');
      setCurrentPage(1);
    }
  };

  const handleExportExcel = () => {
    toast.success('Exportando a Excel', { description: 'El archivo se está descargando...', duration: 3000 });
  };
  const handleExportCSV = () => {
    toast.success('Exportando a CSV', { description: 'El archivo CSV se está descargando...', duration: 3000 });
  };
  const handleExportPDF = () => {
    toast.success('Exportando a PDF', { description: 'El archivo PDF se está descargando...', duration: 3000 });
  };
  const handlePrint = () => {
    toast.success('Imprimiendo', { description: 'Enviando documento a la impresora...', duration: 3000 });
  };

  const handleListaClick = () => {
    if (tableRef.current) {
      tableRef.current.classList.add('animate-highlight');
      setTimeout(() => { tableRef.current?.classList.remove('animate-highlight'); }, 1000);
    }
  };
  const handleBuscarClick = () => {
    if (searchBarRef.current) {
      searchBarRef.current.focus();
      searchBarRef.current.classList.add('animate-highlight-border');
      setTimeout(() => { searchBarRef.current?.classList.remove('animate-highlight-border'); }, 1000);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* ═══ Header Section con ícono y título ═══ */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            <h2 className="text-lg text-gray-800" style={{ fontWeight: 400 }}>Inversión</h2>
            <button className="p-1 ml-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="8" cy="8" r="6" />
                <path d="M13 13l3 3" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={handleListaClick} className="cursor-pointer hover:text-[#0099CC] transition-colors">Lista</span>
            <span onClick={handleBuscarClick} className="cursor-pointer hover:text-[#0099CC] transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* ═══ Filter Section: Ver + Dropdown + Nuevo ═══ */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[200px]">
              <option>Vista general de la Inversión</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666">
              <path d="M6 8l-4-4h8z" />
            </svg>
          </div>
          <button onClick={onNew} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB]" style={{ fontWeight: 500 }}>
            Nuevo
          </button>
        </div>
      </div>

      {/* ═══ Filtros Label + Buscar ═══ */}
      <div className="px-4 py-2 bg-[#F0F0F0] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700" style={{ fontWeight: 500 }}>Filtros</span>
          <div className="flex items-center gap-2">
            <input
              ref={searchBarRef}
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar inversiones..."
              className="px-3 py-1 border border-gray-400 rounded text-sm w-64 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ═══ Action Icons Bar ═══ */}
      <div className="px-4 py-2.5 bg-[#F0F0F0] border-b border-gray-300">
        <div className="flex items-center justify-between">
          {/* Iconos de exportación */}
          <div className="flex items-center gap-3">
            <button
              className="p-1.5 hover:bg-gray-200 rounded transition-colors hover:scale-110 transform"
              title="Exportar a CSV"
              onClick={handleExportCSV}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280" />
                <text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text>
              </svg>
            </button>
            <button
              className="p-1.5 hover:bg-green-100 rounded transition-colors hover:scale-110 transform"
              title="Exportar a Excel"
              onClick={handleExportExcel}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B" />
                <path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2" />
              </svg>
            </button>
            <button
              className="p-1.5 hover:bg-red-100 rounded transition-colors hover:scale-110 transform"
              title="Exportar a PDF"
              onClick={handleExportPDF}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F" />
                <path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none" />
                <path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2" />
              </svg>
            </button>
            <button
              className="p-1.5 hover:bg-blue-100 rounded transition-colors hover:scale-110 transform"
              title="Imprimir"
              onClick={handlePrint}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2" />
                <rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none" />
                <rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2" />
                <circle cx="5" cy="8" r="0.8" fill="#1976D2" />
              </svg>
            </button>
          </div>

          {/* Orden + Paginación inline + Total */}
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
                  <path d="M5 7l-3-3h6z" />
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
                  <path d="M5 7l-3-3h6z" />
                </svg>
              </div>
              <button
                className="p-0.5 text-[#0099CC] hover:text-[#0088BB] disabled:opacity-40"
                title="Anterior"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M10 3L5 8l5 5V3z" />
                </svg>
              </button>
              <button
                className="p-0.5 text-[#0099CC] hover:text-[#0088BB] disabled:opacity-40"
                title="Siguiente"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 3l5 5-5 5V3z" />
                </svg>
              </button>
            </div>
            <span style={{ fontWeight: 500 }}>Total: {inversiones.length}</span>
          </div>
        </div>
      </div>

      {/* ═══ Table ═══ */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm" style={{ backgroundColor: 'transparent' }}>
            <thead>
              <tr className="bg-[#D0D0D0] border-b border-gray-300">
                <th className="px-3 py-2.5 text-left text-xs text-gray-700" style={{ fontWeight: 400 }}>Editar | Ver</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700" style={{ fontWeight: 400 }}>ID</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700" style={{ fontWeight: 400 }}>NOMBRE</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700" style={{ fontWeight: 400 }}>PRODUCTO</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700" style={{ fontWeight: 400 }}>MONEDA</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700" style={{ fontWeight: 400 }}>ESTATUS INVERSIÓN</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700" style={{ fontWeight: 400 }}>CUENTA INVERSIÓN</th>
                <th className="px-3 py-2.5 text-right text-xs text-gray-700" style={{ fontWeight: 400 }}>SALDO</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700" style={{ fontWeight: 400 }}>FECHA ACTIVACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {currentInversiones.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    No se encontraron inversiones
                  </td>
                </tr>
              ) : (
                currentInversiones.map((inv, index) => (
                  <tr
                    key={inv.id}
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{
                      backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E8F4F8')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF')}
                  >
                    <td className="px-3 py-2.5 text-xs">
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onEdit(inv); }}>Editar</a>
                      <span className="text-gray-700"> | </span>
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onView(inv); }}>Ver</a>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{inv.numero}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{inv.form.cliente}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{inv.form.producto}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{inv.form.moneda}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{inv.form.estatusInversion}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{inv.form.noCuentaInversion}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 text-right">{fmtMoney(inv.form.montoInversion)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{inv.form.fechaInicio}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Pagination ═══ */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Primera página"
            onClick={handleFirstPage}
            disabled={currentPage === 1}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M13 4L4 9l9 5V4z" />
            </svg>
          </button>
          <button
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Página anterior"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M9 4L4 9l5 5V4z" />
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
              <path d="M5 4l5 5-5 5V4z" />
            </svg>
          </button>
          <button
            className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Última página"
            onClick={handleLastPage}
            disabled={currentPage === totalPages}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M4 4L13 9l-9 5V4z" />
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
