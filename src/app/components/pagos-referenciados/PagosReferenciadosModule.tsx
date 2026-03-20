import { useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface PagoReferenciado {
  id: number;
  banco: string;
  cuenta: string;
  referencia: string;
  fecha: string;
  importe: number;
  identificado: boolean;
  procesado: boolean;
  observaciones: string;
  descripcion: string;
  moneda: string;
  tipoPago: string;
}

// ═══════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════
const MOCK_PAGOS: PagoReferenciado[] = [
  { id: 1, banco: 'BBVA', cuenta: 'CTA-EJE-001', referencia: 'I-001213', fecha: '02/02/2024', importe: 123.00, identificado: true, procesado: false, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'Transferencia' },
  { id: 2, banco: 'BANAMEX', cuenta: 'CTA-EJE-002', referencia: 'I-001207', fecha: '04/28/2024', importe: 2000.00, identificado: false, procesado: false, observaciones: '', descripcion: 'SET', moneda: 'MXN', tipoPago: 'SPEI' },
  { id: 3, banco: 'BANORTE', cuenta: 'CTA-EJE-003', referencia: 'SI-001208', fecha: '02/02/2024', importe: 59000.00, identificado: true, procesado: false, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'Depósito' },
  { id: 4, banco: 'BANAMEX', cuenta: 'CTA-EJE-002', referencia: 'I-001209', fecha: '04/28/2024', importe: 2000.00, identificado: true, procesado: false, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'SPEI' },
  { id: 5, banco: 'BANCOMER', cuenta: 'CTA-EJE-004', referencia: 'I-001211', fecha: '02/02/2024', importe: 3990.00, identificado: true, procesado: false, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'Cheque' },
  { id: 6, banco: 'BANCOMER', cuenta: 'CTA-EJE-004', referencia: 'I-001210', fecha: '03/31/2025', importe: 300000.00, identificado: true, procesado: false, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'Transferencia' },
  { id: 7, banco: 'BANCOMER', cuenta: 'CTA-EJE-004', referencia: 'I-001211', fecha: '03/31/2025', importe: 490000.00, identificado: true, procesado: false, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'SPEI' },
  { id: 8, banco: 'HSBC', cuenta: 'CTA-EJE-005', referencia: 'I-001215', fecha: '05/15/2025', importe: 75000.00, identificado: true, procesado: true, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'Transferencia' },
  { id: 9, banco: 'SANTANDER', cuenta: 'CTA-EJE-006', referencia: 'I-001220', fecha: '06/10/2025', importe: 150000.00, identificado: false, procesado: false, observaciones: '', descripcion: 'SET', moneda: 'USD', tipoPago: 'Cheque' },
  { id: 10, banco: 'BBVA', cuenta: 'CTA-EJE-001', referencia: 'I-001225', fecha: '07/22/2025', importe: 45000.00, identificado: true, procesado: true, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'SPEI' },
  { id: 11, banco: 'BANORTE', cuenta: 'CTA-EJE-003', referencia: 'I-001230', fecha: '08/05/2025', importe: 12500.00, identificado: true, procesado: false, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'Transferencia' },
  { id: 12, banco: 'SCOTIABANK', cuenta: 'CTA-EJE-007', referencia: 'I-001235', fecha: '09/18/2025', importe: 88000.00, identificado: false, procesado: false, observaciones: '', descripcion: 'SET', moneda: 'MXN', tipoPago: 'Depósito' },
  { id: 13, banco: 'BANAMEX', cuenta: 'CTA-EJE-002', referencia: 'I-001240', fecha: '10/30/2025', importe: 210000.00, identificado: true, procesado: true, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'SPEI' },
  { id: 14, banco: 'HSBC', cuenta: 'CTA-EJE-005', referencia: 'I-001245', fecha: '11/12/2025', importe: 5600.00, identificado: true, procesado: false, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'USD', tipoPago: 'Cheque' },
  { id: 15, banco: 'BBVA', cuenta: 'CTA-EJE-001', referencia: 'I-001250', fecha: '01/20/2026', importe: 340000.00, identificado: true, procesado: true, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'Transferencia' },
  { id: 16, banco: 'SANTANDER', cuenta: 'CTA-EJE-006', referencia: 'I-001255', fecha: '03/08/2026', importe: 67500.00, identificado: false, procesado: false, observaciones: '', descripcion: 'SET', moneda: 'MXN', tipoPago: 'SPEI' },
  { id: 17, banco: 'BANCOMER', cuenta: 'CTA-EJE-004', referencia: 'I-001260', fecha: '04/25/2026', importe: 125000.00, identificado: true, procesado: true, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'SPEI' },
  { id: 18, banco: 'BANORTE', cuenta: 'CTA-EJE-003', referencia: 'I-001265', fecha: '06/14/2026', importe: 990.00, identificado: true, procesado: false, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'Depósito' },
  { id: 19, banco: 'INBURSA', cuenta: 'CTA-EJE-008', referencia: 'I-001270', fecha: '08/02/2026', importe: 450000.00, identificado: true, procesado: true, observaciones: 'NET SUITE', descripcion: 'SET', moneda: 'MXN', tipoPago: 'Transferencia' },
  { id: 20, banco: 'BBVA', cuenta: 'CTA-EJE-001', referencia: 'I-001275', fecha: '12/19/2026', importe: 28750.00, identificado: false, procesado: false, observaciones: '', descripcion: 'SET', moneda: 'USD', tipoPago: 'Cheque' },
];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
function formatCurrency(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function PagosReferenciadosModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  // ── Export stubs ──
  const handleExportCSV = () => toast.success('Exportando a CSV', { description: 'El archivo CSV se está descargando...', duration: 3000 });
  const handleExportExcel = () => toast.success('Exportando a Excel', { description: 'El archivo se está descargando...', duration: 3000 });
  const handleExportPDF = () => toast.success('Exportando a PDF', { description: 'El archivo PDF se está descargando...', duration: 3000 });
  const handlePrint = () => toast.success('Imprimiendo', { description: 'Enviando documento a la impresora...', duration: 3000 });

  const handleListaClick = () => {
    if (tableRef.current) {
      tableRef.current.classList.add('animate-highlight');
      setTimeout(() => tableRef.current?.classList.remove('animate-highlight'), 1000);
    }
  };

  const handleBuscarClick = () => {
    if (searchBarRef.current) {
      searchBarRef.current.focus();
      searchBarRef.current.classList.add('animate-highlight-border');
      setTimeout(() => searchBarRef.current?.classList.remove('animate-highlight-border'), 1000);
    }
  };

  // ── Filtrado ──
  const filtered = useMemo(() => {
    if (!searchTerm) return MOCK_PAGOS;
    const s = searchTerm.toLowerCase();
    return MOCK_PAGOS.filter(p =>
      p.banco.toLowerCase().includes(s) ||
      p.cuenta.toLowerCase().includes(s) ||
      p.referencia.toLowerCase().includes(s) ||
      p.fecha.includes(s) ||
      p.observaciones.toLowerCase().includes(s) ||
      p.descripcion.toLowerCase().includes(s) ||
      p.moneda.toLowerCase().includes(s) ||
      p.tipoPago.toLowerCase().includes(s) ||
      formatCurrency(p.importe).includes(s)
    );
  }, [searchTerm]);

  // ── Ordenamiento por fecha ──
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Parse MM/DD/YYYY
      const [am, ad, ay] = a.fecha.split('/').map(Number);
      const [bm, bd, by_] = b.fecha.split('/').map(Number);
      const da = new Date(ay, am - 1, ad).getTime();
      const db = new Date(by_, bm - 1, bd).getTime();
      return sortOrder === 'desc' ? db - da : da - db;
    });
  }, [filtered, sortOrder]);

  // ── Paginación ──
  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = sorted.slice(startIndex, startIndex + itemsPerPage);

  const handleSearchChange = (value: string) => { setSearchTerm(value); setCurrentPage(1); };
  const handleSortChange = (value: 'desc' | 'asc') => { setSortOrder(value); setCurrentPage(1); };
  const handleFirstPage = () => setCurrentPage(1);
  const handlePreviousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const handleLastPage = () => setCurrentPage(totalPages);

  return (
    <div className="bg-white min-h-screen">
      {/* ── Header Section con ícono y título ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 16h4M14 16h4" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Pagos Referenciados</h2>
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

      {/* ── Filter Section con Ver y Dropdown (sin botón Nuevo) ── */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[200px]">
              <option>Vista general de Pagos</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666">
              <path d="M6 8l-4-4h8z" />
            </svg>
          </div>
          {/* Sin botón Nuevo — módulo de solo consulta */}
        </div>
      </div>

      {/* ── Filtros Label ── */}
      <div className="px-4 py-2 bg-[#F0F0F0] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <div className="flex items-center gap-2">
            <input
              ref={searchBarRef}
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar pagos..."
              className="px-3 py-1 border border-gray-400 rounded text-sm w-64 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Action Icons Bar ── */}
      <div className="px-4 py-2.5 bg-[#F0F0F0] border-b border-gray-300">
        <div className="flex items-center justify-between">
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
                  <option>Todos los Pagos</option>
                  <option>Identificados</option>
                  <option>No Identificados</option>
                  <option>Procesados</option>
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
            <span className="font-medium">Total: {sorted.length}</span>
          </div>
        </div>
      </div>

      {/* ── Tabla institucional ── */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm" style={{ backgroundColor: 'transparent' }}>
            <thead>
              <tr className="bg-[#D0D0D0] border-b border-gray-300">
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">BANCO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">CUENTA</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">REFERENCIA</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">FECHA</th>
                <th className="px-3 py-2.5 text-right font-normal text-xs text-gray-700">IMPORTE</th>
                <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700">IDENTIFICADO</th>
                <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700">PROCESADO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">OBSERVACIONES</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">DESCRIPCIÓN</th>
                <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700">MONEDA</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">TIPO DE PAGO</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                    No se encontraron pagos referenciados
                  </td>
                </tr>
              ) : (
                currentItems.map((pago, index) => (
                  <tr
                    key={pago.id}
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{
                      backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                  >
                    <td className="px-3 py-2.5 text-xs text-gray-700">{pago.banco}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{pago.cuenta}</td>
                    <td className="px-3 py-2.5 text-xs text-[#0066CC]">{pago.referencia}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{pago.fecha}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 text-right">{formatCurrency(pago.importe)}</td>
                    <td className="px-3 py-2.5 text-center">
                      {pago.identificado ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
                          <path d="M3 8l3 3 7-7" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {pago.procesado ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
                          <path d="M3 8l3 3 7-7" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{pago.observaciones}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{pago.descripcion}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 text-center">{pago.moneda}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{pago.tipoPago}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Paginación institucional ── */}
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
