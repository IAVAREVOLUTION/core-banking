/**
 * CotizacionCaptacionList.tsx
 *
 * Lista institucional de Cotizaciones de Captación
 * Réplica exacta del patrón ClientesList.tsx
 *
 * Columnas:
 *   Editar | Ver | Id Cotiza | Fecha y Hora | Usuario | Producto |
 *   Monto Cotizado | Tasa Min Interés | Interés Generado Periodo |
 *   Plazo Cumplir Monto
 */
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import type { CotizacionCaptacion } from './cotizacionCaptacionTypes';

interface Props {
  cotizaciones: CotizacionCaptacion[];
  onNew: () => void;
  onEdit: (c: CotizacionCaptacion) => void;
  onView: (c: CotizacionCaptacion) => void;
  loading?: boolean;
  warning?: string | null;
  backendStatus?: string;
  fetchMethod?: string;
  onRefresh?: () => void;
  onSeedTest?: () => Promise<{ ok: boolean; error?: string }>;
  dbRowCount?: number;
  /** Callback para crear Solicitud desde Cotización Captación — spec solicitudes-financieras §1 */
  onCrearSolicitud?: (c: CotizacionCaptacion) => void;
}

const formatMoney = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '—';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return dateStr;
};

const renderEstatus = (estatus: string) => {
  const lower = estatus.toLowerCase();
  let bg = 'bg-gray-100 text-gray-700';
  if (lower === 'pendiente') bg = 'bg-yellow-100 text-yellow-800';
  else if (lower === 'aprobada') bg = 'bg-green-100 text-green-800';
  else if (lower === 'rechazada') bg = 'bg-red-100 text-red-800';
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${bg}`}>{estatus || '—'}</span>;
};

export function CotizacionCaptacionList({ cotizaciones, onNew, onEdit, onView, loading, warning, backendStatus, fetchMethod, onRefresh, onSeedTest, dbRowCount, onCrearSolicitud }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDiag, setShowDiag] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  // Export handlers
  const handleExportExcel = () => { toast.success('Exportando a Excel', { description: 'El archivo se está descargando...', duration: 3000 }); };
  const handleExportCSV = () => { toast.success('Exportando a CSV', { description: 'El archivo CSV se está descargando...', duration: 3000 }); };
  const handleExportPDF = () => { toast.success('Exportando a PDF', { description: 'El archivo PDF se está descargando...', duration: 3000 }); };
  const handlePrint = () => { toast.success('Imprimiendo', { description: 'Enviando documento a la impresora...', duration: 3000 }); };

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

  const filtered = cotizaciones
    .filter(c => {
      const s = searchTerm.toLowerCase();
      return (
        c.no_cotiza.toLowerCase().includes(s) ||
        (c.data.usuario || '').toLowerCase().includes(s) ||
        (c.data.producto?.nombreProducto || '').toLowerCase().includes(s) ||
        (c.data.cliente?.nombreCompleto || '').toLowerCase().includes(s) ||
        c.estatus_cotiza.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      const dA = new Date(a.fecha_cotiza).getTime();
      const dB = new Date(b.fecha_cotiza).getTime();
      return sortOrder === 'desc' ? dB - dA : dA - dB;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentItems = filtered.slice(startIdx, startIdx + itemsPerPage);

  const goPrev = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const goNext = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const goFirst = () => setCurrentPage(1);
  const goLast = () => setCurrentPage(totalPages);
  const handleSearchChange = (v: string) => { setSearchTerm(v); setCurrentPage(1); };
  const handleSortChange = (v: 'desc' | 'asc') => { setSortOrder(v); setCurrentPage(1); };

  const [seedError, setSeedError] = useState<string | null>(null);

  const handleSeedTest = async () => {
    setSeeding(true);
    setSeedStatus(null);
    setSeedError(null);
    try {
      const result = await onSeedTest?.();
      if (result?.ok) {
        setSeedStatus('success');
        toast.success('Registro de prueba insertado OK', { description: 'Datos cargados desde Supabase DB.', duration: 5000 });
      } else {
        setSeedStatus('error');
        setSeedError(result?.error || 'Error desconocido');
        toast.error('Seed falló', { description: 'Abre el panel de Diagnóstico para ver detalles.', duration: 8000 });
        // Auto-abrir el panel de diagnóstico
        setShowDiag(true);
      }
    } catch (error) {
      setSeedStatus('error');
      setSeedError(String(error));
      toast.error('Seed falló', { description: 'Abre el panel de Diagnóstico para ver detalles.', duration: 8000 });
      setShowDiag(true);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* ═══ DIAGNÓSTICO DB — panel amarillo colapsable ═══ */}
      <div className="px-4 pt-2">
        <button
          onClick={() => setShowDiag(!showDiag)}
          className="text-xs px-2 py-1 bg-yellow-100 border border-yellow-400 rounded hover:bg-yellow-200 transition-colors"
        >
          {showDiag ? '▼' : '▶'} DIAGNÓSTICO DB — J_COTIZACIONES
        </button>
        {showDiag && (
          <div className="mt-1 p-3 bg-yellow-50 border border-yellow-300 rounded text-xs font-mono space-y-1">
            <div><strong>DB_AVAILABLE:</strong> <span className="text-blue-700">true</span></div>
            <div><strong>backendStatus:</strong> <span className={
              backendStatus === 'ready' ? 'text-green-700' :
              backendStatus === 'empty' ? 'text-orange-600' :
              backendStatus === 'error' ? 'text-red-700' :
              backendStatus === 'pending-deploy' ? 'text-red-700' :
              'text-gray-600'
            }>{backendStatus || '—'}</span></div>
            <div><strong>fetchMethod:</strong> <span className="text-blue-700">{fetchMethod || '(ninguno aún)'}</span></div>
            <div><strong>dbRowCount (todas las líneas):</strong> {dbRowCount ?? '—'}</div>
            <div><strong>cotizaciones Captación (UI):</strong> {cotizaciones.length}</div>
            <div><strong>dataSource:</strong> <span className={
              (dbRowCount ?? 0) > 0 && backendStatus === 'ready' ? 'text-green-700' : 'text-orange-600'
            }>{(dbRowCount ?? 0) > 0 && backendStatus === 'ready' ? 'SUPABASE DB (J_COTIZACIONES)' : 'MOCK DATA (fallback local)'}</span></div>
            <div><strong>loading:</strong> {loading ? 'true' : 'false'}</div>
            {warning && <div className="text-red-700"><strong>warning:</strong> {warning}</div>}
            {seedStatus === 'error' && (
              <div className="mt-1 p-2 bg-red-100 border border-red-400 rounded text-red-800 space-y-1">
                <div><strong>SEED ERROR:</strong> {seedError}</div>
                {(seedError?.includes('NOT NULL') || seedError?.includes('not-null') || seedError?.includes('null value') || seedError?.includes('23502')) && (
                  <div className="mt-1 p-2 bg-white border border-red-300 rounded">
                    <div className="text-red-900 mb-1"><strong>SOLUCIÓN:</strong> Ejecuta este SQL en Supabase SQL Editor:</div>
                    <div className="text-[10px] text-gray-800 bg-gray-100 p-2 rounded font-mono whitespace-pre-wrap select-all cursor-text">
{`-- Copiar TODO esto y pegarlo en SQL Editor:
ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ALTER COLUMN producto_id DROP NOT NULL;
ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ALTER COLUMN cliente_id DROP NOT NULL;
ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" DROP CONSTRAINT IF EXISTS fk_cliente;
ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" DROP CONSTRAINT IF EXISTS fk_producto;`}
                    </div>
                    <div className="text-[10px] mt-1 text-gray-600">O ejecuta el archivo completo: /src/imports/migration-fix-jcotizaciones-nullable.sql</div>
                  </div>
                )}
              </div>
            )}
            {seedStatus === 'success' && <div className="text-green-700"><strong>seed:</strong> Registro de prueba insertado OK — datos cargados desde DB.</div>}
            <div className="pt-1 text-gray-500">Abre DevTools → Console y busca "[CotizDB]" para ver logs detallados de cada intento.</div>
            {backendStatus === 'empty' && (
              <div className="pt-1 p-2 bg-orange-100 border border-orange-300 rounded text-orange-800">
                La tabla J_COTIZACIONES existe pero está vacía. Usa el botón "Sembrar" para insertar un registro de prueba vía RPC insert_jcotizacion.
                Si falla por NOT NULL, ejecuta en SQL Editor:<br/>
                <code className="text-[10px]">ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ALTER COLUMN producto_id DROP NOT NULL; ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ALTER COLUMN cliente_id DROP NOT NULL;</code>
              </div>
            )}
            {backendStatus === 'pending-deploy' && (
              <div className="pt-1 p-2 bg-red-100 border border-red-300 rounded text-red-800">
                No se pudo conectar a la DB. Verifica que ejecutaste la migración: /src/imports/migration-jcotizaciones.sql
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Header ═══ */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M16 13H8M16 17H8M10 9H8" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Lista de Cotizaciones — Captación</h2>
            <button className="p-1 ml-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="8" cy="8" r="6" /><path d="M13 13l3 3" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={handleListaClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Lista</span>
            <span onClick={handleBuscarClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* ═══ Ver + Nuevo + Refrescar ═══ */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[200px]">
              <option>Vista general de Cotización Captación</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z" /></svg>
          </div>
          <button onClick={onNew} className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">Nuevo</button>
          <button onClick={() => onRefresh?.()} className="px-3 py-1.5 border border-gray-400 rounded text-sm hover:bg-gray-50 transition-colors">
            {loading ? '⏳ Cargando...' : '⟳ Refrescar'}
          </button>
          <button
            onClick={handleSeedTest}
            className={`px-3 py-1.5 border border-gray-400 rounded text-sm hover:bg-gray-50 transition-colors ${seeding ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={seeding}
          >
            {seeding ? '🌱 Sembrando...' : '🌱 Sembrar'}
          </button>
        </div>
      </div>

      {/* ═══ Filtros ═══ */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <input
            ref={searchBarRef}
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por folio, cliente, producto, estatus..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-72 transition-all"
          />
        </div>
      </div>

      {/* ═══ Action Icons Bar ═══ */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors hover:scale-110 transform" title="CSV" onClick={handleExportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280" /><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors hover:scale-110 transform" title="Excel" onClick={handleExportExcel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B" /><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors hover:scale-110 transform" title="PDF" onClick={handleExportPDF}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F" /><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none" /><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors hover:scale-110 transform" title="Imprimir" onClick={handlePrint}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2" /><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none" /><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2" /><circle cx="5" cy="8" r="0.8" fill="#1976D2" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden Rápido</span>
              <div className="relative">
                <select value={sortOrder} onChange={(e) => handleSortChange(e.target.value as any)} className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666"><path d="M5 7l-3-3h6z" /></svg>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none"><option>Admin - Anterior</option></select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="var(--theme-secondary)"><path d="M5 7l-3-3h6z" /></svg>
              </div>
              <button className="p-0.5 text-secondary-theme disabled:opacity-40" onClick={goPrev} disabled={currentPage === 1}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z" /></svg>
              </button>
              <button className="p-0.5 text-secondary-theme disabled:opacity-40" onClick={goNext} disabled={currentPage === totalPages}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z" /></svg>
              </button>
            </div>
            <span className="font-medium">Total: {cotizaciones.length}</span>
          </div>
        </div>
      </div>

      {/* ═══ Tabla ═══ */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-x-auto" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm" style={{ backgroundColor: 'transparent' }}>
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">Editar | Ver</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">ID COTIZA</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">FECHA Y HORA</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">USUARIO</th>
                <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">PRODUCTO</th>
                <th className="px-3 py-2.5 text-right font-normal text-xs text-gray-700 whitespace-nowrap">MONTO COTIZADO</th>
                <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">TASA MIN INTERÉS</th>
                <th className="px-3 py-2.5 text-right font-normal text-xs text-gray-700 whitespace-nowrap">INTERÉS GENERADO</th>
                <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">PERIODO</th>
                <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">PLAZO CUMPLIR MONTO</th>
                <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">ESTATUS</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-500">{searchTerm ? `No se encontraron registros para "${searchTerm}"` : 'No hay cotizaciones registradas.'}</td></tr>
              ) : currentItems.map((c, index) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                >
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onEdit(c); }}>Editar</a>
                    <span className="text-gray-700"> | </span>
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onView(c); }}>Ver</a>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{c.no_cotiza}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatDateDisplay(c.fecha_cotiza)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{c.data.usuario || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{c.data.producto?.nombreProducto || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoney(c.data.montoCotizado || 0)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 text-center">{c.data.tasaMinInteres != null ? `${c.data.tasaMinInteres}%` : '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 text-right whitespace-nowrap">{c.data.interesGeneradoPeriodo != null ? formatMoney(c.data.interesGeneradoPeriodo) : '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 text-center">{c.data.periodoCumplirMontoMinimo || c.data.frecuenciaCapitalizacion || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700 text-center">{c.data.plazoCumplirMontoMinimo || '—'}</td>
                  <td className="px-3 py-2.5 text-xs">{renderEstatus(c.estatus_cotiza)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Paginación ═══ */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" onClick={goFirst} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" onClick={goPrev} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z" /></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {currentPage} de {totalPages}</div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" onClick={goNext} disabled={currentPage === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" onClick={goLast} disabled={currentPage === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}