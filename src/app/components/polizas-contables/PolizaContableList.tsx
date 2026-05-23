import { useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import type { PolizaContable } from './PolizasContablesModule';

interface Props {
  polizas: PolizaContable[];
  onNew: () => void;
  onEdit: (p: PolizaContable) => void;
  onView: (p: PolizaContable) => void;
  loading?: boolean;
  error?: string | null;
  onRefetch?: () => void;
}

const INIT_WIDTHS = {
  actions: 90, journal_date: 100, event_code: 140, currency: 80,
  evento: 200, status: 100, total_debit: 120, total_credit: 120, created_at: 130,
};

const STATUS_STYLE: Record<string, string> = {
  Creada:      'bg-blue-100 text-blue-700',
  Aplicada:    'bg-green-100 text-green-700',
  Cancelada:   'bg-red-100 text-red-700',
  Procesando:  'bg-yellow-100 text-yellow-700',
  Error:       'bg-red-200 text-red-800',
};

export function PolizaContableList({ polizas, onNew, onEdit, onView, loading, error, onRefetch }: Props) {
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [widths, setWidths] = useState(INIT_WIDTHS);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const PER_PAGE = 8;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return polizas
      .filter(p =>
        (p.event_code || '').toLowerCase().includes(q) ||
        (p.data?.evento || '').toLowerCase().includes(q) ||
        (p.status || '').toLowerCase().includes(q) ||
        (p.currency || '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const da = new Date(a.created_at || a.journal_date).getTime();
        const db = new Date(b.created_at || b.journal_date).getTime();
        return sortOrder === 'desc' ? db - da : da - db;
      });
  }, [polizas, search, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pg = Math.min(page, totalPages);
  const items = filtered.slice((pg - 1) * PER_PAGE, pg * PER_PAGE);

  const fmt = (n: number) => n === 0 ? '—' : n.toLocaleString('es-MX', { minimumFractionDigits: 2 });
  const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString('es-MX'); } catch { return s || '—'; } };

  const startResize = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widths[col as keyof typeof widths];
    const onMove = (ev: MouseEvent) =>
      setWidths(prev => ({ ...prev, [col]: Math.max(60, startW + ev.clientX - startX) }));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const Th = ({ col, label }: { col: string; label: string }) => (
    <th className="relative px-3 py-2.5 text-left font-normal text-xs text-gray-700" style={{ width: `${widths[col as keyof typeof widths]}px` }}>
      {label}
      <div className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0099CC] transition-colors" onMouseDown={e => startResize(e, col)} />
    </th>
  );

  return (
    <div className="bg-white min-h-screen">
      {/* Título */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 8h18M8 3v18M3 13h18M3 18h18"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Pólizas Contables</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth' })} className="cursor-pointer hover:text-[#0099CC]">Lista</span>
            <span onClick={() => searchRef.current?.focus()} className="cursor-pointer hover:text-[#0099CC]">Buscar</span>
          </div>
        </div>
      </div>

      {/* Ver / Nuevo */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[220px]">
              <option>Vista general de pólizas</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
          </div>
          <button onClick={onNew} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium">
            Nuevo
          </button>
          {onRefetch && (
            <button onClick={() => onRefetch()} className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">
              Actualizar
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-2 bg-[#F0F0F0] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por evento, código, estatus..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-72 bg-white"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2.5 bg-[#F0F0F0] border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {[{ l: 'CSV', bg: '#6B7280' }, { l: 'XLS', bg: '#1D9F5B' }, { l: 'PDF', bg: '#D32F2F' }].map(({ l, bg }) => (
              <button key={l} onClick={() => toast.success(`Exportando ${l}`)} className="p-1.5 hover:bg-gray-200 rounded transition-colors" title={`Exportar ${l}`}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="2" width="16" height="16" rx="2" fill={bg}/>
                  <text x="10" y="13" fontSize="6.5" fontWeight="bold" textAnchor="middle" fill="white">{l}</text>
                </svg>
              </button>
            ))}
            <button onClick={() => toast.success('Imprimiendo')} className="p-1.5 hover:bg-blue-100 rounded" title="Imprimir">
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
                <select value={sortOrder} onChange={e => { setSortOrder(e.target.value as 'desc' | 'asc'); setPage(1); }} className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666"><path d="M5 7l-3-3h6z"/></svg>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[
                { d: 'M10 3L5 8l5 5V3z', act: () => setPage(1), dis: pg === 1 },
                { d: 'M10 3L5 8l5 5V3z', act: () => setPage(p => Math.max(1, p - 1)), dis: pg === 1 },
                { d: 'M6 3l5 5-5 5V3z', act: () => setPage(p => Math.min(totalPages, p + 1)), dis: pg === totalPages },
                { d: 'M6 3l5 5-5 5V3z', act: () => setPage(totalPages), dis: pg === totalPages },
              ].map(({ d, act, dis }, i) => (
                <button key={i} onClick={act} disabled={dis} className="p-0.5 text-[#0099CC] disabled:opacity-40">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d={d}/></svg>
                </button>
              ))}
            </div>
            <span className="font-medium">Total: {polizas.length}</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-700 text-sm flex items-center gap-2">
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="#3B82F6" strokeWidth="2" opacity="0.3"/>
            <path d="M8 2a6 6 0 014.9 9.4" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Consultando J_GL_JOURNAL_ENCABEZADO...
        </div>
      )}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>Error: {error}</span>
          {onRefetch && <button onClick={onRefetch} className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-xs font-medium">Reintentar</button>}
        </div>
      )}

      {/* Tabla */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-[#D0D0D0] border-b border-gray-300">
                <Th col="actions"      label="Editar | Ver" />
                <Th col="journal_date" label="FECHA" />
                <Th col="event_code"   label="EVENTO" />
                <Th col="currency"     label="MONEDA" />
                <Th col="evento"       label="EVENTO" />
                <Th col="status"       label="ESTATUS" />
                <Th col="total_debit"  label="TOTAL DÉBITO" />
                <Th col="total_credit" label="TOTAL CRÉDITO" />
                <Th col="created_at"   label="FECHA CREACIÓN" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500 text-sm">
                    {loading ? 'Cargando...' : 'No se encontraron pólizas contables'}
                  </td>
                </tr>
              ) : (
                items.map((p, i) => (
                  <tr
                    key={p.id || i}
                    className="border-b border-gray-200"
                    style={{ backgroundColor: i % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E8F4F8')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? '#EEEEEE' : '#FFFFFF')}
                  >
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ width: `${widths.actions}px` }}>
                      <a href="#" onClick={e => { e.preventDefault(); onEdit(p); }} className="text-[#0066CC] hover:underline">Editar</a>
                      <span className="text-gray-400"> | </span>
                      <a href="#" onClick={e => { e.preventDefault(); onView(p); }} className="text-[#0066CC] hover:underline">Ver</a>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700" style={{ width: `${widths.journal_date}px` }}>{fmtDate(p.journal_date)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 font-mono overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: `${widths.event_code}px` }}>{p.event_code || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 font-medium" style={{ width: `${widths.currency}px` }}>{p.currency}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: `${widths.evento}px` }}>{p.data?.evento || '—'}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ width: `${widths.status}px` }}>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 font-mono text-right" style={{ width: `${widths.total_debit}px` }}>{fmt(p.total_debit)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 font-mono text-right" style={{ width: `${widths.total_credit}px` }}>{fmt(p.total_credit)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500" style={{ width: `${widths.created_at}px` }}>{fmtDate(p.created_at || '')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      <div className="px-4 py-3 border-t border-gray-300 flex items-center justify-end gap-3">
        {[
          { title: 'Primera',   d: 'M13 4L4 9l9 5V4z', act: () => setPage(1),                                 dis: pg === 1 },
          { title: 'Anterior',  d: 'M9 4L4 9l5 5V4z',  act: () => setPage(p => Math.max(1, p - 1)),           dis: pg === 1 },
          { title: 'Siguiente', d: 'M5 4l5 5-5 5V4z',  act: () => setPage(p => Math.min(totalPages, p + 1)),  dis: pg === totalPages },
          { title: 'Última',    d: 'M4 4L13 9l-9 5V4z', act: () => setPage(totalPages),                       dis: pg === totalPages },
        ].map(({ title, d, act, dis }) => (
          <button key={title} onClick={act} disabled={dis} title={title} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d={d}/></svg>
          </button>
        ))}
        <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {pg} de {totalPages}</div>
      </div>
    </div>
  );
}
