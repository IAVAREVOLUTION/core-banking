/**
 * Banca2oPisoList.tsx — REQ-17, vista "Lista" del módulo.
 *
 * Réplica del listado institucional de `SolicitudCreditoList`: mismo header con
 * "Lista | Buscar", barra "Ver" + Refrescar, barra de Filtros, barra de iconos de
 * exportación con Orden y Total, tabla de cabecera gris con encabezados en
 * mayúsculas y zebra #EEEEEE/#FFFFFF, y paginación de cuatro botones.
 *
 * Diferencias deliberadas con aquél, por lo que este módulo es:
 *   - No hay botón "Nuevo": las líneas nacen de una Solicitud activada, no se dan de
 *     alta aquí.
 *   - La primera columna sólo ofrece "Ver" (administración de sólo lectura, sin Editar).
 *   - CSV/Excel descargan de verdad e Imprimir abre el diálogo del navegador, en lugar
 *     de un toast que anuncia una descarga que no ocurre.
 */
import { useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { fmtMoneyExacto, norm, type LineaCreditoRow } from './banca2oPisoStore';

interface Props {
  rows: LineaCreditoRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  onVer: (r: LineaCreditoRow) => void;
}

const PER_PAGE = 10;

export function Banca2oPisoList({ rows, loading, error, refetch, onVer }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  const estatusDisponibles = useMemo(
    () => Array.from(new Set(rows.map(r => r.estatus).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (filtroEstatus) list = list.filter(r => r.estatus === filtroEstatus);
    if (searchTerm.trim()) {
      const q = norm(searchTerm);
      list = list.filter(r =>
        norm(r.noCuenta).includes(q) ||
        norm(r.noSol).includes(q) ||
        norm(r.cliente).includes(q) ||
        norm(r.productoNombre).includes(q) ||
        norm(r.gobierno).includes(q) ||
        norm(r.estatus).includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const da = new Date(a.fechaSol || 0).getTime();
      const db = new Date(b.fechaSol || 0).getTime();
      return sortOrder === 'desc' ? db - da : da - db;
    });
  }, [rows, searchTerm, filtroEstatus, sortOrder]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const currentRows = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

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

  const descargarCSV = () => {
    const headers = ['No. Cuenta', 'No. Solicitud', 'Cliente', 'Producto', 'Institución', 'Fecha', 'Monto Aut.', 'Tasa', 'Plazo', 'Moneda', 'Estatus'];
    const lines = filtered.map(r => [
      r.noCuenta || '', r.noSol, r.cliente, r.productoNombre, r.gobierno || '', r.fechaSol || '',
      r.montoAut, r.tasa || '', r.plazo || '', r.moneda || 'MXN', r.estatus,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banca_2o_piso_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exportación generada', { description: `${filtered.length} línea(s) exportadas.`, duration: 3000 });
  };

  const imprimir = () => {
    toast.info('Abriendo diálogo de impresión', { description: 'Desde ahí se puede guardar como PDF.', duration: 3000 });
    window.print();
  };

  const estatusClass = (estatus: string) => {
    const e = norm(estatus);
    if (e === 'activa' || e === 'autorizada') return 'text-green-700 bg-green-50 border-green-200';
    if (e === 'en administracion') return 'text-purple-700 bg-purple-50 border-purple-200';
    if (e === 'cancelada' || e === 'rechazada') return 'text-red-700 bg-red-50 border-red-200';
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h8" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Banca 2º Piso</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={handleListaClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Lista</span>
            <span onClick={handleBuscarClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[280px]">
              <option>Vista general de Líneas de Crédito activas</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z" /></svg>
          </div>
          <button
            onClick={refetch}
            disabled={loading}
            className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="2"><circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="1.5"><path d="M1 7a6 6 0 0111.196-3M13 7a6 6 0 01-11.196 3" /><path d="M1 1v3h3M13 13v-3h-3" /></svg>
            )}
            Refrescar
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">Filtros</span>
            <div className="relative">
              <select
                value={filtroEstatus}
                onChange={e => { setFiltroEstatus(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1 border border-gray-400 rounded text-sm bg-white appearance-none pr-7"
              >
                <option value="">Todos los estatus</option>
                {estatusDisponibles.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z" /></svg>
            </div>
          </div>
          <input
            ref={searchBarRef}
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar líneas..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-64 transition-all"
          />
        </div>
      </div>

      {/* Action icons */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="CSV" onClick={descargarCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280" /><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors" title="Excel" onClick={descargarCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B" /><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors" title="PDF (vía diálogo de impresión)" onClick={imprimir}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F" /><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none" /><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors" title="Imprimir" onClick={imprimir}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2" /><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none" /><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2" /><circle cx="5" cy="8" r="0.8" fill="#1976D2" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden</span>
              <select
                value={sortOrder}
                onChange={e => { setSortOrder(e.target.value as 'desc' | 'asc'); setCurrentPage(1); }}
                className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none"
              >
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            <span className="font-medium">Total: {filtered.length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            No se pudo cargar la cartera: {error}
          </div>
        )}
        <div className="border border-gray-300 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">Ver</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">N° CUENTA</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">N° SOLICITUD</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">CLIENTE</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">PRODUCTO</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">INSTITUCIÓN</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">FECHA</th>
                <th className="px-2 py-2.5 text-right font-medium text-xs text-gray-700">MONTO AUT.</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">FASE</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">ESTATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">Cargando líneas de crédito...</td></tr>
              ) : currentRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                    {rows.length === 0
                      ? 'No hay Líneas de Crédito activas. Este módulo muestra únicamente cuentas con Línea de Producto = Línea de Crédito y estatus Activa, Autorizada o En Administración.'
                      : 'No se encontraron líneas con los filtros aplicados'}
                  </td>
                </tr>
              ) : (
                currentRows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}
                  >
                    <td className="px-2 py-2.5 text-xs whitespace-nowrap">
                      <a
                        href="#"
                        className="text-[#0066CC] hover:underline"
                        onClick={e => { e.preventDefault(); onVer(r); }}
                      >
                        Ver
                      </a>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[160px] truncate" title={r.noCuenta || ''}>{r.noCuenta || '—'}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[180px] truncate" title={r.noSol}>{r.noSol || '—'}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[180px] truncate" title={r.cliente}>{r.cliente}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[150px] truncate" title={r.productoNombre}>{r.productoNombre}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[160px] truncate" title={r.gobierno || ''}>{r.gobierno || '—'}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700">{r.fechaSol || '—'}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 text-right">{fmtMoneyExacto(r.montoAut)}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-600 max-w-[140px] truncate" title={r.descripcionFase || ''}>{r.descripcionFase || '—'}</td>
                    <td className="px-2 py-2.5 text-xs">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${estatusClass(r.estatus)}`}>
                        {r.estatus || '—'}
                      </span>
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
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z" /></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {currentPage} de {totalPages || 1}</div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
