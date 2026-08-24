/**
 * OportunidadesList.tsx
 *
 * Lista institucional del módulo Oportunidades — HU-CRM-04 CA-03/04/05/06.
 *
 * Columnas (CA-04):
 *   ID Oportunidad | Cliente Emisor | Sector | Monto Inversión | Estatus | Fecha Creación
 *
 * Réplica del estándar Siebel-like de CotizacionCreditoList (RN-01):
 * cabecera, barra "Ver + Nuevo + Refrescar", filtros, iconos de exportación,
 * grid con zebra + hover, y paginación al pie.
 *
 * Una Oportunidad es una Cotización de Línea de Crédito (decisión HU-CRM-03).
 */
import { useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import type { CotizacionCredito } from '../cotizaciones/cotizacionCreditoTypes';

interface Props {
  oportunidades: CotizacionCredito[];
  onNew: () => void;
  onView: (o: CotizacionCredito) => void;
  onEdit: (o: CotizacionCredito) => void;
  loading?: boolean;
  onRefresh?: () => void;
}

const formatMoney = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '—';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }
  return dateStr;
};

const renderEstatus = (estatus: string) => {
  const lower = (estatus || '').toLowerCase();
  let bg = 'bg-gray-100 text-gray-700';
  // HU-CRM-09 — pipeline comercial
  if (lower === 'en cotización') bg = 'bg-yellow-100 text-yellow-800';
  else if (lower === 'propuesta entregada') bg = 'bg-blue-100 text-blue-800';
  else if (lower === 'negociación') bg = 'bg-indigo-100 text-indigo-800';
  // Estatus heredados de cotizaciones previas
  else if (lower === 'pendiente') bg = 'bg-yellow-100 text-yellow-800';
  else if (lower === 'aprobada' || lower === 'aceptada') bg = 'bg-green-100 text-green-800';
  else if (lower === 'rechazada') bg = 'bg-red-100 text-red-800';
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${bg}`}>{estatus || '—'}</span>;
};

/** Monto de inversión heredado del Lead; si no existe, cae al monto cotizado. */
const montoInversionDe = (o: CotizacionCredito): number => {
  const raw = (o.data as any)?.montoInversion;
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  if (!isNaN(n) && n > 0) return n;
  return Number(o.data?.montoSolicitado || 0);
};

const sectorDe = (o: CotizacionCredito): string => (o.data as any)?.sectorInfraestructura || '';
const clienteDe = (o: CotizacionCredito): string => o.data?.cliente?.nombreCompleto || '';

/** Columnas filtrables (CA-05) */
type ColumnaId = 'todas' | 'id' | 'cliente' | 'sector' | 'monto' | 'estatus' | 'fecha';

const COLUMNAS: { id: ColumnaId; label: string }[] = [
  { id: 'todas', label: 'Todas las columnas' },
  { id: 'id', label: 'ID Oportunidad' },
  { id: 'cliente', label: 'Cliente Emisor' },
  { id: 'sector', label: 'Sector' },
  { id: 'monto', label: 'Monto Inversión' },
  { id: 'estatus', label: 'Estatus' },
  { id: 'fecha', label: 'Fecha Creación' },
];

export function OportunidadesList({ oportunidades, onNew, onView, onEdit, loading, onRefresh }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [columna, setColumna] = useState<ColumnaId>('todas');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    const valoresDe = (o: CotizacionCredito): Record<Exclude<ColumnaId, 'todas'>, string> => ({
      id: o.no_cotiza || '',
      cliente: clienteDe(o),
      sector: sectorDe(o),
      monto: formatMoney(montoInversionDe(o)),
      estatus: o.estatus_cotiza || '',
      fecha: formatDateDisplay(o.fecha_cotiza),
    });

    return oportunidades
      .filter(o => {
        if (!s) return true;
        const v = valoresDe(o);
        if (columna === 'todas') {
          return Object.values(v).some(x => x.toLowerCase().includes(s));
        }
        return (v[columna] || '').toLowerCase().includes(s);
      })
      .sort((a, b) => {
        const dA = new Date(a.fecha_cotiza).getTime();
        const dB = new Date(b.fecha_cotiza).getTime();
        return sortOrder === 'desc' ? dB - dA : dA - dB;
      });
  }, [oportunidades, searchTerm, columna, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageSafe = Math.min(currentPage, totalPages);
  const startIdx = (pageSafe - 1) * itemsPerPage;
  const currentItems = filtered.slice(startIdx, startIdx + itemsPerPage);

  const goPrev = () => { if (pageSafe > 1) setCurrentPage(pageSafe - 1); };
  const goNext = () => { if (pageSafe < totalPages) setCurrentPage(pageSafe + 1); };

  const placeholder = columna === 'todas'
    ? 'Buscar en todas las columnas...'
    : `Buscar por ${COLUMNAS.find(c => c.id === columna)?.label}...`;

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Lista de Oportunidades</h2>
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
              <option>Vista general Oportunidades</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z" /></svg>
          </div>
          <button onClick={onNew} className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">Nuevo</button>
          <button onClick={() => onRefresh?.()} className="px-3 py-1.5 border border-gray-400 rounded text-sm hover:bg-gray-50 transition-colors">
            {loading ? '...' : '⟳ Refrescar'}
          </button>
        </div>
      </div>

      {/* Filtros — CA-05: por cualquier columna */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={columna}
                onChange={(e) => { setColumna(e.target.value as ColumnaId); setCurrentPage(1); }}
                className="px-3 py-1 border border-gray-400 rounded text-sm bg-white pr-7 appearance-none"
              >
                {COLUMNAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z" /></svg>
            </div>
            <input
              ref={searchBarRef}
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder={placeholder}
              className="px-3 py-1 border border-gray-400 rounded text-sm w-72 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="px-2 py-1 text-sm text-gray-600 border border-gray-400 rounded hover:bg-gray-100"
                title="Limpiar filtro"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action Icons */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded" title="CSV" onClick={() => toast.success('Exportando a CSV')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280" /><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded" title="Excel" onClick={() => toast.success('Exportando a Excel')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B" /><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded" title="PDF" onClick={() => toast.success('Exportando a PDF')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F" /><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none" /><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded" title="Imprimir" onClick={() => toast.success('Imprimiendo')}>
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
            <span className="font-medium">
              {searchTerm ? `${filtered.length} de ${oportunidades.length}` : `Total: ${oportunidades.length}`}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Grid — CA-04 ═══ */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">Editar | Ver</th>
                <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">ID OPORTUNIDAD</th>
                <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">CLIENTE EMISOR</th>
                <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">SECTOR</th>
                <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700 whitespace-nowrap">MONTO INVERSIÓN</th>
                <th className="px-2 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">ESTATUS</th>
                <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">FECHA CREACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    {searchTerm ? `No se encontraron registros para "${searchTerm}"` : 'No hay oportunidades registradas.'}
                  </td>
                </tr>
              ) : currentItems.map((o, index) => (
                <tr
                  key={o.id || o.no_cotiza}
                  className="border-b border-gray-200 transition-colors duration-150 cursor-pointer"
                  style={{ backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                  /* CA-06: clic en la fila abre el detalle */
                  onClick={() => onView(o)}
                >
                  <td className="px-2 py-2.5 text-xs whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onEdit(o); }}>Editar</a>
                    <span className="text-gray-700"> | </span>
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); onView(o); }}>Ver</a>
                  </td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 whitespace-nowrap">{o.no_cotiza || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700">{clienteDe(o) || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700">
                    {sectorDe(o)
                      ? <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">{sectorDe(o)}</span>
                      : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 text-right whitespace-nowrap">{formatMoney(montoInversionDe(o))}</td>
                  <td className="px-2 py-2.5 text-xs text-center">{renderEstatus(o.estatus_cotiza)}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatDateDisplay(o.fecha_cotiza)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación — CA-03 */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setCurrentPage(1)} disabled={pageSafe === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={goPrev} disabled={pageSafe === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z" /></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {pageSafe} de {totalPages}</div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={goNext} disabled={pageSafe === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setCurrentPage(totalPages)} disabled={pageSafe === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
