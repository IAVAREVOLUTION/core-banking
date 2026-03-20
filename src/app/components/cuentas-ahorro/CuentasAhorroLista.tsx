/**
 * CuentasAhorroLista.tsx — v2.2 (RPC-FIRST + UPDATE support)
 *
 * ═══════════════════════════════════════════════════════════════════
 * Lista institucional de Cuentas de Ahorro
 * Fuente: EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES"
 * Filtro: linea_produc = 'CAPTACION' AND tipo_produc = 'Ahorro'
 * Orden: fecha_sol DESC
 *
 * Columnas institucionales (spec ahorro-cuentas-lista.txt):
 *   Editar|Ver, No.Cuenta, Cliente, Producto, Fecha Solicitud,
 *   Fecha Autorización, Saldo Actual, Estatus Cuenta, Estatus Cartera,
 *   Estatus Solicitud, Estatus Dispersión, Cuenta Eje/Chequera
 * ═══════════════════════════════════════════════════════════════════
 */
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useCuentasAhorroDB } from '@/app/hooks/useCuentasAhorroDB';
import type { CuentaAhorroListItem } from '@/app/hooks/useCuentasAhorroDB';

interface CuentasAhorroListaProps {
  onEdit?: (id: number | string) => void;
  onView?: (id: number | string) => void;
  onNew?: () => void;
}

export function CuentasAhorroLista({ onEdit, onView, onNew }: CuentasAhorroListaProps) {
  const { cuentas, loading, backendStatus, refetch } = useCuentasAhorroDB();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  // ── Export stubs ──
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

  // ── Formateo ──
  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // ── Estatus badge ──
  const statusColor = (estatus: string): string => {
    const lower = estatus.toLowerCase();
    if (lower === 'activo' || lower === 'vigente' || lower === 'dispersado' || lower === 'autorizado') return 'bg-green-100 text-green-800';
    if (lower === 'pendiente' || lower === 'en proceso') return 'bg-yellow-100 text-yellow-800';
    if (lower === 'cancelado' || lower === 'vencido' || lower === 'rechazado') return 'bg-red-100 text-red-800';
    if (lower === 'inactivo') return 'bg-gray-100 text-gray-600';
    return 'bg-gray-100 text-gray-700';
  };

  // ── Filtrado y ordenamiento ──
  const parseDate = (dateStr: string) => new Date(dateStr || '1970-01-01');

  const filteredCuentas = cuentas
    .filter((cuenta: CuentaAhorroListItem) => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        cuenta.noCuenta.toLowerCase().includes(s) ||
        cuenta.clienteNombre.toLowerCase().includes(s) ||
        cuenta.productoNombre.toLowerCase().includes(s) ||
        cuenta.estatusCuen.toLowerCase().includes(s)
      );
    })
    .sort((a: CuentaAhorroListItem, b: CuentaAhorroListItem) => {
      const dateA = parseDate(a.fechaSol).getTime();
      const dateB = parseDate(b.fechaSol).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  // ── Paginación ──
  const totalPages = Math.max(1, Math.ceil(filteredCuentas.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentCuentas = filteredCuentas.slice(startIndex, startIndex + itemsPerPage);

  const handleSearchChange = (value: string) => { setSearchTerm(value); setCurrentPage(1); };
  const handleSortChange = (value: 'desc' | 'asc') => { setSortOrder(value); setCurrentPage(1); };
  const handleFirstPage = () => setCurrentPage(1);
  const handlePreviousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const handleLastPage = () => setCurrentPage(totalPages);

  return (
    <div className="bg-white min-h-screen">
      {/* ── Banner de advertencia cuando backend no está conectado ── */}
      {backendStatus !== 'connected' && (
        <div className="mx-4 mt-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-amber-600 text-lg mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-medium text-amber-800">
                Datos solo en memoria local (sessionStorage)
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Las cuentas que ves NO están en la BD <code className="bg-amber-100 px-1 rounded">J_CUENTAS_CORP_CLIENTES</code>.
                {backendStatus === 'pending-deploy' && (
                  <> La Edge Function v19.3 no está desplegada y el RPC <code className="bg-amber-100 px-1 rounded">insert_cuenta_ahorro</code> tiene overloads ambiguos (PGRST106).</>
                )}
                {' '}Al cerrar el navegador se perderán.
              </p>
              <p className="text-[10px] text-amber-600 mt-1">
                Solución: (1) Desplegar Edge Function v19.3, o (2) En SQL Editor: <code className="bg-amber-100 px-1 rounded">DROP FUNCTION</code> los overloads extra de <code className="bg-amber-100 px-1 rounded">insert_cuenta_ahorro</code> dejando solo el de timestamptz.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="3" y="6" width="18" height="13" rx="2"/>
              <path d="M3 10h18"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Cuenta ahorro</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={handleListaClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Lista</span>
            <span onClick={handleBuscarClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[200px]">
              <option>Vista general de Cuenta ahorro</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666">
              <path d="M6 8l-4-4h8z"/>
            </svg>
          </div>
          <button onClick={onNew} className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">
            Nuevo
          </button>
          {backendStatus !== 'connected' && (
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 text-xs border border-blue-400 text-blue-700 rounded hover:bg-blue-50"
              title="Reintentar conexión con Supabase"
            >
              ↻ Reintentar DB
            </button>
          )}
        </div>
      </div>

      {/* Backend status banner */}
      {backendStatus === 'pending-deploy' && (
        <div className="mx-4 mt-2 px-3 py-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
          ⚠️ RPCs no disponibles. Crear <code className="bg-yellow-100 px-1 rounded">get_cuentas_ahorro</code> en Supabase SQL Editor.
          La lista mostrará datos de sessionStorage si existen.
        </div>
      )}
      {backendStatus === 'connected' && (
        <div className="mx-4 mt-2 px-3 py-1.5 bg-green-50 border border-green-300 rounded text-xs text-green-700 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
          Conectado a J_CUENTAS_CORP_CLIENTES — {filteredCuentas.length} cuenta{filteredCuentas.length !== 1 ? 's' : ''} de ahorro
        </div>
      )}

      {/* Filtros */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 mt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <input
            ref={searchBarRef}
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por cuenta, cliente, producto, estatus..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-72 transition-all"
          />
        </div>
      </div>

      {/* Action Icons Bar */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors hover:scale-110 transform" title="Exportar a CSV" onClick={handleExportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280"/>
                <text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text>
              </svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors hover:scale-110 transform" title="Exportar a Excel" onClick={handleExportExcel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B"/>
                <path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2"/>
              </svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors hover:scale-110 transform" title="Exportar a PDF" onClick={handleExportPDF}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F"/>
                <path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none"/>
                <path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2"/>
              </svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors hover:scale-110 transform" title="Imprimir" onClick={handlePrint}>
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
              <span>Orden</span>
              <div className="relative">
                <select
                  value={sortOrder}
                  onChange={(e) => handleSortChange(e.target.value as 'desc' | 'asc')}
                  className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none"
                >
                  <option value="desc">Fecha ↓</option>
                  <option value="asc">Fecha ↑</option>
                </select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666">
                  <path d="M5 7l-3-3h6z"/>
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-0.5 text-secondary-theme disabled:opacity-40" title="Anterior" onClick={handlePreviousPage} disabled={currentPage === 1}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
              </button>
              <button className="p-0.5 text-secondary-theme disabled:opacity-40" title="Siguiente" onClick={handleNextPage} disabled={currentPage === totalPages}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
              </button>
            </div>
            <span className="font-medium">Total: {filteredCuentas.length}</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TABLA INSTITUCIONAL                                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead>
              <tr className="border-b border-gray-300" style={{ backgroundColor: 'var(--theme-table-header)' }}>
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-700 whitespace-nowrap">Editar | Ver</th>
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-700 whitespace-nowrap">NO. CUENTA</th>
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-700 whitespace-nowrap">CLIENTE</th>
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-700 whitespace-nowrap">PRODUCTO</th>
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-700 whitespace-nowrap">FECHA SOLICITUD</th>
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-700 whitespace-nowrap">FECHA AUTORIZACIÓN</th>
                <th className="px-3 py-2.5 text-right font-medium text-xs text-gray-700 whitespace-nowrap">SALDO ACTUAL</th>
                <th className="px-3 py-2.5 text-center font-medium text-xs text-gray-700 whitespace-nowrap">EST. CUENTA</th>
                <th className="px-3 py-2.5 text-center font-medium text-xs text-gray-700 whitespace-nowrap">EST. CARTERA</th>
                <th className="px-3 py-2.5 text-center font-medium text-xs text-gray-700 whitespace-nowrap">EST. SOLICITUD</th>
                <th className="px-3 py-2.5 text-center font-medium text-xs text-gray-700 whitespace-nowrap">EST. DISPERSIÓN</th>
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-700 whitespace-nowrap">CTA EJE / CHEQUERA</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-3 py-12 text-center text-xs text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-[#0099CC]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Cargando cuentas de ahorro desde J_CUENTAS_CORP_CLIENTES...
                    </div>
                  </td>
                </tr>
              ) : currentCuentas.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                        <rect x="3" y="6" width="18" height="13" rx="2"/>
                        <path d="M3 10h18"/>
                      </svg>
                      <span className="text-sm">
                        {searchTerm
                          ? 'No se encontraron cuentas con ese criterio de búsqueda'
                          : 'No hay cuentas de ahorro registradas'}
                      </span>
                      {backendStatus === 'pending-deploy' && (
                        <span className="text-xs text-yellow-600">
                          Verifica que la RPC <code className="bg-yellow-100 px-1 rounded">get_cuentas_ahorro</code> esté creada en Supabase.
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentCuentas.map((cuenta: CuentaAhorroListItem, index: number) => (
                  <tr
                    key={cuenta.id}
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{ backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                  >
                    {/* Editar | Ver */}
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onEdit?.(cuenta.id); }}>Editar</a>
                      <span className="text-gray-700"> | </span>
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onView?.(cuenta.id); }}>Ver</a>
                    </td>
                    {/* No. Cuenta */}
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{cuenta.noCuenta || '—'}</td>
                    {/* Cliente */}
                    <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[180px] truncate" title={cuenta.clienteNombre}>
                      {cuenta.clienteNombre}
                    </td>
                    {/* Producto */}
                    <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[180px] truncate" title={cuenta.productoNombre}>
                      {cuenta.productoNombre}
                    </td>
                    {/* Fecha Solicitud */}
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatDate(cuenta.fechaSol)}</td>
                    {/* Fecha Autorización */}
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatDate(cuenta.fechaAutori)}</td>
                    {/* Saldo Actual */}
                    <td className="px-3 py-2.5 text-xs text-gray-700 text-right whitespace-nowrap">{formatCurrency(cuenta.saldoActual)}</td>
                    {/* Estatus Cuenta */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusColor(cuenta.estatusCuen)}`}>
                        {cuenta.estatusCuen}
                      </span>
                    </td>
                    {/* Estatus Cartera */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusColor(cuenta.estatusCart)}`}>
                        {cuenta.estatusCart}
                      </span>
                    </td>
                    {/* Estatus Solicitud */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusColor(cuenta.estatusSol)}`}>
                        {cuenta.estatusSol}
                      </span>
                    </td>
                    {/* Estatus Dispersión */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusColor(cuenta.estatusDisp)}`}>
                        {cuenta.estatusDisp}
                      </span>
                    </td>
                    {/* Cuenta Eje / Chequera — Booleano */}
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap text-center">
                      {cuenta.ctaEjeChec ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">Sí</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">No</span>
                      )}
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
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Mostrando {filteredCuentas.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredCuentas.length)} de {filteredCuentas.length}
          </span>
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Primera página" onClick={handleFirstPage} disabled={currentPage === 1}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z"/></svg>
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Página anterior" onClick={handlePreviousPage} disabled={currentPage === 1}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z"/></svg>
            </button>
            <div className="text-sm text-gray-700 min-w-[100px] text-center">
              Página {currentPage} de {totalPages}
            </div>
            <button className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Página siguiente" onClick={handleNextPage} disabled={currentPage === totalPages}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z"/></svg>
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Última página" onClick={handleLastPage} disabled={currentPage === totalPages}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}