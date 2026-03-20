/**
 * CotizacionCreditoList.tsx  v2.0
 *
 * Lista institucional para Cotizaciones → Crédito / Línea de Crédito
 * Columnas alineadas con spec credito-cotizaciones-module.md §1:
 *   Id Cotiza | Fecha y Hora | Usuario | Producto | Monto Cotizado |
 *   Tasa Interés | Plazo | Periodo | Interés a Pagar | Pago por Periodo | Estatus
 */
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import type { CotizacionCredito } from './cotizacionCreditoTypes';

interface Props {
  cotizaciones: CotizacionCredito[];
  lineaLabel: string;
  onNew: () => void;
  onEdit: (c: CotizacionCredito) => void;
  onView: (c: CotizacionCredito) => void;
  loading?: boolean;
  onRefresh?: () => void;
  /** Callback para crear una Solicitud desde una Cotización (spec R1) */
  onCrearSolicitud?: (c: CotizacionCredito) => void;
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

export function CotizacionCreditoList({ cotizaciones, lineaLabel, onNew, onEdit, onView, loading, onRefresh, onCrearSolicitud }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  const handleExportExcel = () => { toast.success('Exportando a Excel'); };
  const handleExportCSV = () => { toast.success('Exportando a CSV'); };
  const handleExportPDF = () => { toast.success('Exportando a PDF'); };
  const handlePrint = () => { toast.success('Imprimiendo'); };

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

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" /><path d="M16 13H8M16 17H8M10 9H8" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Lista de Cotizaciones — {lineaLabel}</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth' })} className="cursor-pointer hover:text-secondary-theme transition-colors">Lista</span>
            <span onClick={() => searchBarRef.current?.focus()} className="cursor-pointer hover:text-secondary-theme transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* Ver + Nuevo + Refrescar */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[200px]">
              <option>Vista general Cotización {lineaLabel}</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z" /></svg>
          </div>
          <button onClick={onNew} className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">Nuevo</button>
          <button onClick={() => onRefresh?.()} className="px-3 py-1.5 border border-gray-400 rounded text-sm hover:bg-gray-50 transition-colors">
            {loading ? '...' : '⟳ Refrescar'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <input
            ref={searchBarRef}
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por folio, cliente, producto, estatus..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-72 transition-all"
          />
        </div>
      </div>

      {/* Action Icons */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded" title="CSV" onClick={handleExportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280" /><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded" title="Excel" onClick={handleExportExcel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B" /><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded" title="PDF" onClick={handleExportPDF}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F" /><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none" /><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded" title="Imprimir" onClick={handlePrint}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2" /><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none" /><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden</span>
              <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as any); setCurrentPage(1); }} className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            <span className="font-medium">Total: {cotizaciones.length}</span>
          </div>
        </div>
      </div>

      {/* ═══ Tabla — spec §1 ═══ */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">Editar | Ver</th>
                <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">ID COTIZA</th>
                <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">FECHA Y HORA</th>
                <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">USUARIO</th>
                <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">PRODUCTO</th>
                <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700 whitespace-nowrap">MONTO COTIZADO</th>
                <th className="px-2 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">TASA INTERÉS</th>
                <th className="px-2 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">PLAZO</th>
                <th className="px-2 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">PERIODO</th>
                <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700 whitespace-nowrap">INTERÉS A PAGAR</th>
                <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700 whitespace-nowrap">PAGO PERIODO</th>
                <th className="px-2 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">ESTATUS</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-500">{searchTerm ? `No se encontraron registros para "${searchTerm}"` : 'No hay cotizaciones registradas.'}</td></tr>
              ) : currentItems.map((c, index) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                >
                  <td className="px-2 py-2.5 text-xs whitespace-nowrap">
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onEdit(c); }}>Editar</a>
                    <span className="text-gray-700"> | </span>
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onView(c); }}>Ver</a>
                  </td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 whitespace-nowrap">{c.no_cotiza}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatDateDisplay(c.fecha_cotiza)}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700">{c.data.usuario || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700">{c.data.producto?.nombreProducto || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoney(c.data.montoSolicitado || 0)}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 text-center">{c.data.tasaCotizada ? `${c.data.tasaCotizada}%` : (c.data as any).tasaAnual ? `${(c.data as any).tasaAnual}%` : '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 text-center">{c.data.plazo || (c.data as any).plazoMeses || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 text-center">{c.data.periodo || (c.data as any).frecuenciaPago || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 text-right whitespace-nowrap">{(c.data.interesAPagar || (c.data as any).interesTotal) ? formatMoney(c.data.interesAPagar || (c.data as any).interesTotal || 0) : '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 text-right whitespace-nowrap">{(c.data.pagoPeriodo || c.data.pagoMensual) ? formatMoney(c.data.pagoPeriodo || c.data.pagoMensual || 0) : '—'}</td>
                  <td className="px-2 py-2.5 text-xs">{renderEstatus(c.estatus_cotiza)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={goFirst} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={goPrev} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z" /></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {currentPage} de {totalPages}</div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={goNext} disabled={currentPage === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={goLast} disabled={currentPage === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}