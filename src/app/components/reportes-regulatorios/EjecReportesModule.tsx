import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, Play, Download, CheckCircle, AlertCircle, Paperclip, Brain, X, Search, Eye, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
const PERIODICIDADES = ['Diario', 'Semanal', 'Catorcenal', 'Quincenal', 'Mensual', 'Trimestral', 'Semestral', 'Anual'] as const;

interface Archivo {
  nombre: string;
  formato: string;
  tamaño: number;
  generadoEn: string;
  contenido: string;
  modelo?: string;
  // Storage metadata (set after Guardar)
  url?: string;
  storage_path?: string;
  storage_bucket?: string;
  mime?: string;
  tamano_kb?: number;
}

interface EjecucionData {
  contenido?: string;
  modelo?: string;
  formatoSalida?: string;
  ejecutadoEn?: string;
  archivo?: Archivo;     // single file (current)
  archivos?: Archivo[];  // legacy array — backward compat only
}

interface ReporteEjecucion {
  id: string;
  fecha_creacion: string;
  periodicidad: string;
  nombre_reporte: string;
  estatus: 'Pendiente' | 'Generado';
  id_catalogo_reportes_regulatorios: string;
  data: EjecucionData | null;
}

interface CatalogoReporte {
  id: string;
  clave_reporte: string;
  nombre_reporte: string;
  formato_salida: string;
  prompt_ia: string;
}

type FormMode = 'create' | 'edit' | 'view';
type ViewState =
  | { type: 'lista' }
  | { type: 'form'; mode: FormMode; record?: ReporteEjecucion };

// ═══════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════
const formatDateDMY = (isoStr: string): string => {
  const d = new Date(isoStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const todayDMY = (): string => formatDateDMY(new Date().toISOString());

const stripCodeFences = (text: string): string => {
  const t = text.trim();
  const m = t.match(/^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```\s*$/);
  return m ? m[1].trim() : t;
};

// ─── Plantilla CSS estándar compartida por todos los reportes HTML ───
const REPORT_CSS = `
/* ============================================================
   PLANTILLA CSS ESTÁNDAR — REPORTES REGULATORIOS
   ============================================================ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Segoe UI', Arial, sans-serif;
  font-size: 12px;
  color: #1a1a1a;
  background: #ffffff;
  padding: 28px 36px;
  line-height: 1.6;
}

/* Tipografía */
h1 {
  font-size: 18px;
  font-weight: 700;
  color: #1e3a5f;
  border-bottom: 2px solid #2E5C91;
  padding-bottom: 10px;
  margin-bottom: 20px;
}
h2 {
  font-size: 14px;
  font-weight: 600;
  color: #1e3a5f;
  margin: 20px 0 10px;
}
h3 {
  font-size: 13px;
  font-weight: 600;
  color: #2E5C91;
  margin: 16px 0 8px;
}
p { margin-bottom: 10px; text-align: justify; }

/* Tablas */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0 20px;
  font-size: 11px;
}
thead tr {
  background-color: #2E5C91;
  color: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
thead th {
  padding: 8px 10px;
  text-align: left;
  font-weight: 600;
  letter-spacing: 0.3px;
  border: 1px solid #1e3a5f;
  white-space: nowrap;
}
tbody tr:nth-child(even) {
  background-color: #f0f4f9;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
tbody tr:nth-child(odd) { background-color: #ffffff; }
tbody tr:hover { background-color: #dbeafe; }
tbody td {
  padding: 6px 10px;
  border: 1px solid #d0d8e4;
  vertical-align: top;
}
tfoot tr {
  background-color: #e2e8f0;
  font-weight: 700;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
tfoot td {
  padding: 7px 10px;
  border: 1px solid #b0bece;
}

/* Sección de análisis / interpretación */
.interpretacion, .analisis, .conclusion, .observacion {
  background: #f8fafd;
  border-left: 4px solid #2E5C91;
  padding: 12px 16px;
  margin: 16px 0;
  border-radius: 0 4px 4px 0;
  font-size: 11.5px;
}

/* Badges de estado */
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}
.badge-green  { background: #d1fae5; color: #065f46; }
.badge-yellow { background: #fef3c7; color: #92400e; }
.badge-red    { background: #fee2e2; color: #991b1b; }
.badge-blue   { background: #dbeafe; color: #1e40af; }
.badge-gray   { background: #f3f4f6; color: #374151; }

/* Utilidades */
.text-right  { text-align: right; }
.text-center { text-align: center; }
.font-mono   { font-family: 'Courier New', Courier, monospace; }
.highlight   { background: #fef9c3; }
.text-muted  { color: #6b7280; font-size: 10.5px; }

/* Pie de página */
footer, .footer {
  margin-top: 36px;
  padding-top: 10px;
  border-top: 1px solid #d0d8e4;
  font-size: 10px;
  color: #6b7280;
  text-align: center;
}

/* Impresión */
@media print {
  body { padding: 12px 18px; font-size: 11px; }
  table { font-size: 10px; }
}
`.trim();

const injectReportCSS = (html: string): string => {
  const styleBlock = `<style>\n${REPORT_CSS}\n</style>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n${styleBlock}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, `$1\n<head>\n<meta charset="UTF-8">\n${styleBlock}\n</head>`);
  }
  // Sin estructura HTML — envolver completamente
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${styleBlock}
</head>
<body>
${html}
</body>
</html>`;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const downloadArchivo = (archivo: Archivo) => {
  const ext = archivo.formato.toLowerCase();
  const mimeMap: Record<string, string> = {
    html: 'text/html', xml: 'application/xml', json: 'application/json',
    csv: 'text/csv', txt: 'text/plain', md: 'text/markdown',
  };
  const blob = new Blob([archivo.contenido], { type: mimeMap[ext] || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = archivo.nombre; a.click();
  URL.revokeObjectURL(url);
  toast.success('Descarga iniciada');
};

const downloadArchivoSmart = async (archivo: Archivo) => {
  if (archivo.storage_path) {
    try {
      const res = await fetch(`${BASE_URL}/storage/expedientes/signed-url`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ storagePath: archivo.storage_path, bucket: archivo.storage_bucket }),
      });
      const json = await res.json();
      if (json.signedUrl) {
        const a = document.createElement('a');
        a.href = json.signedUrl;
        a.download = archivo.nombre;
        a.click();
        toast.success('Descarga iniciada');
        return;
      }
    } catch { /* fall through */ }
  }
  downloadArchivo(archivo);
};

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════
const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` };
const EJEC_KEY = 'ejec_jrr_v1';
const CATALOG_KEY = 'ejec_catalog_v2';
const ITEMS_PER_PAGE = 10;

// ═══════════════════════════════════════════════════════════════════
// HOOK — J_REPORTES_REGULATORIOS
// ═══════════════════════════════════════════════════════════════════
function useEjecuciones() {
  const [data, setData] = useState<ReporteEjecucion[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const cache = {
    save: (items: ReporteEjecucion[]) => { try { sessionStorage.setItem(EJEC_KEY, JSON.stringify(items)); } catch { /* */ } },
    load: (): ReporteEjecucion[] => { try { const r = sessionStorage.getItem(EJEC_KEY); return r ? JSON.parse(r) : []; } catch { return []; } },
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/reportes-ejecuciones`, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items: ReporteEjecucion[] = json.data || [];
      setData(items);
      cache.save(items);
    } catch {
      const cached = cache.load();
      if (cached.length > 0) { setData(cached); toast.warning('Modo offline'); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!loadedRef.current) { loadedRef.current = true; fetchAll(); } }, [fetchAll]);

  const create = useCallback(async (body: { periodicidad: string; nombre_reporte: string; id_catalogo_reportes_regulatorios: string }): Promise<ReporteEjecucion | null> => {
    try {
      const res = await fetch(`${BASE_URL}/reportes-ejecuciones`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const item: ReporteEjecucion = json.data;
      setData(prev => { const updated = [item, ...prev]; cache.save(updated); return updated; });
      return item;
    } catch (err: any) { toast.error('Error al crear', { description: err.message }); return null; }
  }, []);

  const update = useCallback(async (id: string, body: Partial<Pick<ReporteEjecucion, 'periodicidad' | 'nombre_reporte' | 'estatus' | 'data'>>): Promise<ReporteEjecucion | null> => {
    try {
      const res = await fetch(`${BASE_URL}/reportes-ejecuciones/${id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const item: ReporteEjecucion = json.data;
      setData(prev => { const updated = prev.map(r => r.id === id ? item : r); cache.save(updated); return updated; });
      return item;
    } catch (err: any) { toast.error('Error al actualizar', { description: err.message }); return null; }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/reportes-ejecuciones/${id}`, { method: 'DELETE', headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(prev => { const updated = prev.filter(r => r.id !== id); cache.save(updated); return updated; });
      return true;
    } catch (err: any) { toast.error('Error al eliminar', { description: err.message }); return false; }
  }, []);

  return { data, loading, fetchAll, create, update, remove };
}

// ═══════════════════════════════════════════════════════════════════
// HOOK — Catálogo (J_CATALOGO_REPORTES_REGULATORIOS)
// ═══════════════════════════════════════════════════════════════════
function useCatalogo() {
  const [catalogo, setCatalogo] = useState<CatalogoReporte[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    try {
      const cached = sessionStorage.getItem(CATALOG_KEY);
      if (cached) { setCatalogo(JSON.parse(cached)); setLoading(false); return; }
      const res = await fetch(`${BASE_URL}/reportes-regulatorios`, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items: CatalogoReporte[] = json.data || [];
      setCatalogo(items);
      sessionStorage.setItem(CATALOG_KEY, JSON.stringify(items));
    } catch {
      toast.error('No se pudo cargar el catálogo de reportes');
    } finally {
      setLoading(false);
    }
  }, []);

  return { catalogo, loading, load };
}

// ═══════════════════════════════════════════════════════════════════
// MODAL — Selector de catálogo
// ═══════════════════════════════════════════════════════════════════
interface CatalogoModalProps {
  catalogo: CatalogoReporte[];
  onSelect: (item: CatalogoReporte) => void;
  onClose: () => void;
}

function CatalogoModal({ catalogo, onSelect, onClose }: CatalogoModalProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    catalogo.filter(c =>
      c.clave_reporte.toLowerCase().includes(search.toLowerCase()) ||
      c.nombre_reporte.toLowerCase().includes(search.toLowerCase())
    ),
    [catalogo, search]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl max-h-[75vh] flex flex-col rounded shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#2E5C91] rounded-t">
          <span className="text-white font-medium text-sm flex items-center gap-2">
            <Search size={14} /> Seleccionar Reporte
          </span>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-200 bg-[#F0F0F0]">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por clave o nombre..."
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-400 rounded bg-white focus:border-[#0099CC] outline-none"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-[#D0D0D0]">
                <th className="px-4 py-2 text-left text-xs font-normal text-gray-700 w-32">CLAVE</th>
                <th className="px-4 py-2 text-left text-xs font-normal text-gray-700">NOMBRE REPORTE</th>
                <th className="px-4 py-2 text-left text-xs font-normal text-gray-700 w-24">FORMATO</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-gray-400 text-sm">No hay resultados</td>
                </tr>
              ) : filtered.map((c, idx) => (
                  <tr
                    key={c.id}
                    style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#EEEEEE' }}
                    onClick={() => onSelect(c)}
                    className="border-b border-gray-200 transition-colors cursor-pointer hover:bg-[#E8F4F8]"
                  >
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-700">{c.clave_reporte}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-800">{c.nombre_reporte}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{c.formato_salida}</td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 border-t border-gray-200 bg-[#F0F0F0] flex justify-between items-center">
          <span className="text-xs text-gray-500">{filtered.length} reporte{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={onClose} className="px-4 py-1.5 border border-gray-400 rounded text-sm text-gray-600 hover:bg-gray-100">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL — Visualizar archivo adjunto
// ═══════════════════════════════════════════════════════════════════
function ArchivoModal({ archivo, onClose, onDownload }: { archivo: Archivo; onClose: () => void; onDownload: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-3xl flex flex-col rounded shadow-2xl overflow-hidden"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#2E5C91] rounded-t flex-shrink-0">
          <span className="text-white font-medium text-sm flex items-center gap-2 truncate">
            <FileText size={14} className="flex-shrink-0" /> {archivo.nombre}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {archivo.storage_path && (
              <span title="Persistido en Storage" className="text-white/60 text-[10px] flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M6 1L10 4v1H8v4H4V5H2V4L6 1z"/><rect x="3" y="9" width="6" height="1.5" rx="0.5"/></svg>
                Guardado
              </span>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="px-4 py-2 border-b border-gray-200 bg-[#F0F0F0] flex items-center justify-between text-xs text-gray-600 flex-shrink-0">
          <span>
            Formato: <strong>{archivo.formato}</strong>
            &nbsp;·&nbsp;
            Tamaño: <strong>{formatSize(archivo.tamaño)}</strong>
            &nbsp;·&nbsp;
            Generado: <strong>{formatDateDMY(archivo.generadoEn)}</strong>
          </span>
          {archivo.modelo && (
            <span className="font-mono text-gray-400 text-[10px]">{archivo.modelo}</span>
          )}
        </div>

        {/* Content */}
        {archivo.formato.toUpperCase() === 'HTML' ? (
          <iframe
            srcDoc={archivo.contenido}
            className="flex-1 w-full border-0 bg-white"
            style={{ minHeight: '320px' }}
            sandbox="allow-same-origin"
            title={archivo.nombre}
          />
        ) : (
          <textarea
            readOnly
            value={archivo.contenido}
            className="flex-1 px-4 py-3 text-[11px] font-mono bg-gray-50 resize-none leading-relaxed text-gray-800 focus:outline-none overflow-y-auto"
            style={{ minHeight: '300px' }}
          />
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-[#F0F0F0] flex items-center justify-between flex-shrink-0">
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#1D9F5B] text-white text-sm font-medium rounded hover:bg-[#178a4e] transition-colors"
          >
            <Download size={14} /> Descargar {archivo.formato}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-gray-400 rounded text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function EjecReportesModule() {
  const db = useEjecuciones();
  const catalogHook = useCatalogo();
  const [view, setView] = useState<ViewState>({ type: 'lista' });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [estatusFilter, setEstatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const searchBarRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => db.data.filter(r => {
    const q = searchTerm.toLowerCase();
    return (!q || r.nombre_reporte.toLowerCase().includes(q) || r.periodicidad.toLowerCase().includes(q))
      && (!estatusFilter || r.estatus === estatusFilter);
  }).sort((a, b) => sortOrder === 'desc'
    ? b.fecha_creacion.localeCompare(a.fecha_creacion)
    : a.fecha_creacion.localeCompare(b.fecha_creacion)
  ), [db.data, searchTerm, estatusFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const goNuevo = () => { catalogHook.load(); setView({ type: 'form', mode: 'create' }); };
  const goEdit  = (r: ReporteEjecucion) => { catalogHook.load(); setView({ type: 'form', mode: 'edit', record: r }); };
  const goView  = (r: ReporteEjecucion) => { catalogHook.load(); setView({ type: 'form', mode: 'view', record: r }); };
  const goLista = () => setView({ type: 'lista' });

  const handleExportCSV   = () => toast.success('Exportando a CSV');
  const handleExportExcel = () => toast.success('Exportando a Excel');
  const handleExportPDF   = () => toast.success('Exportando a PDF');
  const handlePrint       = () => toast.success('Imprimiendo');

  if (view.type === 'form') {
    return (
      <ReporteForm
        mode={view.mode}
        record={view.record}
        catalogo={catalogHook.catalogo}
        catalogLoading={catalogHook.loading}
        onCreate={async (body) => {
          const created = await db.create(body);
          if (created) { toast.success('Registro creado'); goLista(); }
        }}
        onUpdate={async (id, body) => {
          const updated = await db.update(id, body);
          if (updated) { toast.success('Registro actualizado'); goLista(); }
        }}
        onExecute={async (id, body) => db.update(id, body)}
        onCancel={goLista}
      />
    );
  }

  // ── Lista ────────────────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">

      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#4A90E2">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M4 9h16M9 4v16" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Ejec. Reportes Regulatorios</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth' })} className="cursor-pointer hover:text-[#0099CC] transition-colors">Lista</span>
            <span onClick={() => searchBarRef.current?.focus()} className="cursor-pointer hover:text-[#0099CC] transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* Ver + Nuevo */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[220px]">
              <option>Vista general de ejecuciones</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
          </div>
          <button onClick={goNuevo} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium">
            Nuevo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-2 bg-[#F0F0F0] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <input ref={searchBarRef} type="text" value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por nombre o periodicidad..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-72 bg-white focus:border-[#0099CC] outline-none"
          />
        </div>
      </div>

      {/* Icons bar */}
      <div className="px-4 py-2.5 bg-[#F0F0F0] border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="CSV" onClick={handleExportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280"/><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors" title="Excel" onClick={handleExportExcel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B"/><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2"/></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors" title="PDF" onClick={handleExportPDF}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F"/><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none"/><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2"/></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors" title="Imprimir" onClick={handlePrint}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2"/><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none"/><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2"/><circle cx="5" cy="8" r="0.8" fill="#1976D2"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden Rápido</span>
              <div className="relative">
                <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as 'desc' | 'asc'); setCurrentPage(1); }}
                  className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                  <option value="desc">Más reciente</option>
                  <option value="asc">Más antiguo</option>
                </select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666"><path d="M5 7l-3-3h6z"/></svg>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select value={estatusFilter} onChange={(e) => { setEstatusFilter(e.target.value); setCurrentPage(1); }}
                  className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                  <option value="">Todos los Estatus</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Generado">Generado</option>
                </select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#0099CC"><path d="M5 7l-3-3h6z"/></svg>
              </div>
              <button className="p-0.5 text-[#0099CC] disabled:opacity-40" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
              </button>
              <button className="p-0.5 text-[#0099CC] disabled:opacity-40" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
              </button>
            </div>
            <span className="font-medium">Total: {db.data.length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
        {db.loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 size={20} className="animate-spin text-[#0099CC]" />
            <span className="text-sm">Cargando registros...</span>
          </div>
        ) : (
          <div className="border border-gray-300 overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-[#D0D0D0] border-b border-gray-300">
                  <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 w-28">Editar | Ver</th>
                  <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 w-32">FECHA CREACIÓN</th>
                  <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 w-32">PERIODICIDAD</th>
                  <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">NOMBRE REPORTE</th>
                  <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 w-28">ESTATUS</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-12 text-center text-gray-400 text-sm">
                    {db.data.length === 0
                      ? 'No hay registros. Haga clic en "Nuevo" para crear uno.'
                      : 'No se encontraron resultados.'}
                  </td></tr>
                ) : pageData.map((r, idx) => (
                  <tr key={r.id}
                    style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#EEEEEE' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E8F4F8')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#EEEEEE')}
                    onDoubleClick={() => goEdit(r)}
                    className="transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2 border-b border-gray-200 text-xs">
                      <span className="text-[#0066CC] hover:underline cursor-pointer mr-2" onClick={() => goEdit(r)}>Editar</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-[#0066CC] hover:underline cursor-pointer ml-2" onClick={() => goView(r)}>Ver</span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-200 text-xs text-gray-700">{formatDateDMY(r.fecha_creacion)}</td>
                    <td className="px-3 py-2 border-b border-gray-200 text-xs text-gray-700">{r.periodicidad}</td>
                    <td className="px-3 py-2 border-b border-gray-200 text-xs text-gray-800">{r.nombre_reporte}</td>
                    <td className="px-3 py-2 border-b border-gray-200">
                      <EstatusBadge estatus={r.estatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination footer */}
      <div className="px-4 py-3 border-t border-gray-300 flex items-center justify-end gap-2">
        <button className="p-0.5 text-[#0099CC] disabled:opacity-40" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11 3L6 8l5 5V3zM6 3L1 8l5 5V3z"/></svg>
        </button>
        <button className="p-0.5 text-[#0099CC] disabled:opacity-40" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
        </button>
        <span className="text-sm text-gray-700 mx-1">Página {currentPage} de {totalPages}</span>
        <button className="p-0.5 text-[#0099CC] disabled:opacity-40" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
        </button>
        <button className="p-0.5 text-[#0099CC] disabled:opacity-40" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3l5 5-5 5V3zM10 3l5 5-5 5V3z"/></svg>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FORMULARIO — create / edit / view
// ═══════════════════════════════════════════════════════════════════
interface ReporteFormProps {
  mode: FormMode;
  record?: ReporteEjecucion;
  catalogo: CatalogoReporte[];
  catalogLoading: boolean;
  onCreate: (body: { periodicidad: string; nombre_reporte: string; id_catalogo_reportes_regulatorios: string }) => Promise<void>;
  onUpdate: (id: string, body: Partial<Pick<ReporteEjecucion, 'periodicidad' | 'nombre_reporte' | 'estatus' | 'data'>>) => Promise<void>;
  onExecute: (id: string, body: Partial<Pick<ReporteEjecucion, 'periodicidad' | 'nombre_reporte' | 'estatus' | 'data'>>) => Promise<ReporteEjecucion | null>;
  onCancel: () => void;
}

function ReporteForm({ mode, record, catalogo, catalogLoading, onCreate, onUpdate, onExecute, onCancel }: ReporteFormProps) {
  const isView   = mode === 'view';
  const isCreate = mode === 'create';

  const [activeTab, setActiveTab]     = useState<'default' | 'adjuntos'>('default');
  const [saving, setSaving]           = useState(false);
  const [ejecutando, setEjecutando]   = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [viewArchivo, setViewArchivo] = useState<Archivo | null>(null);

  // ─── Form state ───────────────────────────────────────────────
  const [catalogoId, setCatalogoId]     = useState(record?.id_catalogo_reportes_regulatorios ?? '');
  const [periodicidad, setPeriodicidad] = useState<string>(record?.periodicidad ?? 'Mensual');

  // ─── Archivo adjunto (máx 1 por registro) ────────────────────
  const initArchivo = (): Archivo | null => {
    if (!record?.data) return null;
    if (record.data.archivo) return record.data.archivo;
    if (record.data.archivos && record.data.archivos.length > 0) return record.data.archivos[0];
    return null;
  };
  const [archivo, setArchivo] = useState<Archivo | null>(initArchivo);

  const selectedCatalogo = catalogo.find(c => c.id === catalogoId) ?? null;
  const nombreReporte    = selectedCatalogo?.nombre_reporte ?? record?.nombre_reporte ?? '';
  const estatus: 'Pendiente' | 'Generado' = isCreate ? 'Pendiente' : (record?.estatus ?? 'Pendiente');
  const fechaCreacion = isCreate ? todayDMY() : (record ? formatDateDMY(record.fecha_creacion) : '—');

  // ─── Guardar ───────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!catalogoId) { toast.error('Seleccione un reporte del catálogo'); return; }
    if (!periodicidad) { toast.error('Seleccione la periodicidad'); return; }
    setSaving(true);
    try {
      if (isCreate) {
        await onCreate({ periodicidad, nombre_reporte: nombreReporte, id_catalogo_reportes_regulatorios: catalogoId });
        return;
      }
      if (!record) return;

      // Upload archivo to Storage if it exists and hasn't been uploaded yet
      let archivoFinal = archivo;
      if (archivo && !archivo.storage_path) {
        try {
          const ext = archivo.formato.toLowerCase();
          const mimeMap: Record<string, string> = {
            html: 'text/html', xml: 'application/xml', json: 'application/json',
            csv: 'text/csv', txt: 'text/plain', md: 'text/markdown',
          };
          const mime = mimeMap[ext] || 'text/plain';
          const blob = new Blob([archivo.contenido], { type: mime });
          const formData = new FormData();
          formData.append('file', blob, archivo.nombre);
          formData.append('reporteId', record.id);

          const uploadRes = await fetch(`${BASE_URL}/storage/reportes-regulatorios/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${publicAnonKey}` },
            body: formData,
          });
          const uploadJson = await uploadRes.json();
          if (uploadRes.ok && uploadJson.success) {
            archivoFinal = {
              ...archivo,
              url: uploadJson.url,
              storage_path: uploadJson.storagePath,
              storage_bucket: uploadJson.storageBucket,
              mime: uploadJson.mime,
              tamano_kb: uploadJson.tamanoKB,
            };
            setArchivo(archivoFinal);
          } else {
            toast.warning('No se pudo subir a Storage, se guardará sin respaldo en nube', { description: uploadJson.error });
          }
        } catch (uploadErr: any) {
          toast.warning('Error al subir a Storage', { description: uploadErr.message });
        }
      }

      const dataUpdate: EjecucionData = record.data
        ? { ...record.data, archivo: archivoFinal ?? undefined, archivos: undefined }
        : (archivoFinal ? { archivo: archivoFinal } : {});

      await onUpdate(record.id, {
        periodicidad,
        nombre_reporte: nombreReporte,
        ...(archivoFinal ? { estatus: 'Generado' as const, data: dataUpdate } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Ejecutar reporte ──────────────────────────────────────────
  const handleEjecutar = async () => {
    if (isCreate) { toast.error('Guarde el registro antes de ejecutar el reporte'); return; }
    if (!record) return;

    const template = selectedCatalogo ?? catalogo.find(c => c.id === record.id_catalogo_reportes_regulatorios);
    if (!template) { toast.error('No se encontró la plantilla del reporte'); return; }

    setEjecutando(true);

    try {
      const res = await fetch(`${BASE_URL}/ejecutar-reporte-ia`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({
          claveReporte: template.clave_reporte,
          nombreReporte: template.nombre_reporte,
          formatoSalida: template.formato_salida,
          promptIA: template.prompt_ia,
          parametrosExtra: `PERIODICIDAD: ${periodicidad}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);

      let contenido: string = stripCodeFences(json.contenido || json.resultado || JSON.stringify(json, null, 2));
      if (template.formato_salida.toUpperCase() === 'HTML') {
        contenido = injectReportCSS(contenido);
      }
      const ext = template.formato_salida.toLowerCase();
      const fecha = new Date().toISOString();

      const nuevoArchivo: Archivo = {
        nombre: `${template.clave_reporte}_${fecha.slice(0, 10)}.${ext}`,
        formato: template.formato_salida,
        tamaño: new TextEncoder().encode(contenido).length,
        generadoEn: fecha,
        contenido,
        modelo: json.modelo,
      };

      setArchivo(nuevoArchivo);
      setActiveTab('adjuntos');

      await onExecute(record.id, {
        estatus: 'Generado',
        data: {
          contenido,
          modelo: json.modelo,
          formatoSalida: template.formato_salida,
          ejecutadoEn: fecha,
          archivo: nuevoArchivo,
          archivos: undefined,
        },
      });

      toast.success('Reporte generado', { description: `${template.clave_reporte} — ${template.formato_salida}` });
    } catch (err: any) {
      toast.error('Error al ejecutar reporte', { description: err.message });
    } finally {
      setEjecutando(false);
    }
  };

  const inputCls    = `w-full px-3 py-1.5 text-sm border border-gray-400 rounded bg-white focus:border-[#0099CC] outline-none transition-colors`;
  const inputDisCls = `w-full px-3 py-1.5 text-sm border border-gray-200 bg-gray-50 text-gray-700 rounded`;

  // ─── Campos Datos Generales (compartidos entre sección y tab Default) ──
  const renderDatosGeneralesGrid = () => (
    <div className="grid grid-cols-3 gap-x-6 gap-y-4">

      {/* Fecha de creación */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
          Fecha de Creación
        </label>
        <div className={inputDisCls}>{fechaCreacion}</div>
      </div>

      {/* Periodicidad */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
          Periodicidad <span className="text-red-500">*</span>
        </label>
        {isView ? (
          <div className={inputDisCls}>{periodicidad}</div>
        ) : (
          <div className="relative">
            <select value={periodicidad} onChange={e => setPeriodicidad(e.target.value)}
              className={inputCls + ' appearance-none pr-8'}>
              {PERIODICIDADES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
          </div>
        )}
      </div>

      {/* Estatus */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
          Estatus
        </label>
        <div className="py-1">
          <EstatusBadge estatus={estatus} />
        </div>
      </div>

      {/* Reporte — fila completa con botón modal */}
      <div className="col-span-3">
        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
          Reporte <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          <div className={`${inputDisCls} flex-1`}>
            {selectedCatalogo
              ? `${selectedCatalogo.clave_reporte} — ${selectedCatalogo.nombre_reporte}`
              : record?.nombre_reporte
              ? record.nombre_reporte
              : <span className="text-gray-400 italic">— Ninguno seleccionado —</span>}
          </div>
          {!isView && (
            <button
              type="button"
              onClick={() => setShowCatalog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-400 rounded text-sm text-gray-700 hover:bg-gray-50 hover:border-[#0099CC] hover:text-[#0099CC] transition-colors whitespace-nowrap"
            >
              <Search size={13} /> Buscar
            </button>
          )}
        </div>
        {selectedCatalogo && (
          <div className="mt-2 flex items-start gap-2 p-2.5 bg-[#F0F0F0] border border-gray-200 rounded">
            <Brain size={12} className="text-[#0099CC] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-gray-600 font-mono leading-relaxed line-clamp-3">{selectedCatalogo.prompt_ia}</p>
          </div>
        )}
      </div>
    </div>
  );

  const TABS = [
    { id: 'default'  as const, label: 'Default' },
    { id: 'adjuntos' as const, label: 'Archivos Adjuntos' },
  ];

  const sectionHeader = (label: string, icon?: React.ReactNode) => (
    <div className="flex items-center gap-2.5 bg-[#D9E2F3] px-4 py-2 mb-4 rounded border-l-4 border-[#4A6FA5] shadow-sm">
      {icon ?? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
          <rect x="2" y="2" width="12" height="12" rx="2"/>
          <path d="M5 6h6M5 8.5h4M5 11h5"/>
        </svg>
      )}
      <span className="text-sm font-semibold text-[#2E5C91] tracking-wide uppercase">{label}</span>
    </div>
  );

  return (
    <>
      {showCatalog && (
        <CatalogoModal
          catalogo={catalogo}
          onSelect={(item) => { setCatalogoId(item.id); setShowCatalog(false); }}
          onClose={() => setShowCatalog(false)}
        />
      )}

      {viewArchivo && (
        <ArchivoModal
          archivo={viewArchivo}
          onClose={() => setViewArchivo(null)}
          onDownload={() => downloadArchivoSmart(viewArchivo)}
        />
      )}

      <div className="bg-[#F0F0F0] min-h-screen">

        {/* Header */}
        <div className="bg-white px-4 py-3 border-b border-gray-300">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#4A90E2">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M4 9h16M9 4v16" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">
              {isCreate ? 'Alta Ejec. Reportes Regulatorios'
                : mode === 'edit' ? 'Editar Ejec. Reporte Regulatorio'
                : 'Ver Ejec. Reporte Regulatorio'}
            </h2>
            {record && (
              <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded">{record.id}</span>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="px-4 py-2.5 bg-white border-b border-gray-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isView && (
                <button
                  onClick={handleGuardar}
                  disabled={saving}
                  className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              )}
              <button
                onClick={onCancel}
                className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700"
              >
                {isView ? 'Volver' : 'Cancelar'}
              </button>
              {isView && (
                <span className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="6"/><path d="M7 4v3M7 9h.01"/></svg>
                  Modo Consulta — Solo lectura
                </span>
              )}
            </div>

            <button
              onClick={handleEjecutar}
              disabled={ejecutando || isCreate}
              title={isCreate ? 'Guarde el registro primero' : 'Generar reporte con IA'}
              className="flex items-center gap-2 px-5 py-1.5 bg-[#2E5C91] text-white text-sm font-medium rounded hover:bg-[#253f6a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ejecutando ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {ejecutando ? 'Generando...' : 'Ejecutar Reporte'}
            </button>
          </div>
        </div>

        {/* Form card */}
        <div className="px-4 py-4">
          <div className="bg-white border border-gray-300">

            {/* ── Datos Generales ───────────────────────────────── */}
            <div className="px-5 pt-5 pb-5 border-b border-gray-200">
              {sectionHeader('Datos Generales')}
              {catalogLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader2 size={14} className="animate-spin text-[#0099CC]" /> Cargando catálogo...
                </div>
              ) : renderDatosGeneralesGrid()}
            </div>

            {/* ── Subtabs ───────────────────────────────────────── */}
            <div className="bg-[#2E5C91] text-white">
              <div className="flex items-center overflow-x-auto">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-xs whitespace-nowrap border-r border-gray-500/30 transition-all flex items-center gap-1.5 ${
                      activeTab === tab.id
                        ? 'bg-[#4A6FA5] text-white font-medium'
                        : 'bg-[#2E5C91] text-white/90 hover:bg-[#3d6fa5]'
                    }`}>
                    {tab.id === 'adjuntos' && archivo !== null && (
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${activeTab === tab.id ? 'bg-white text-[#4A6FA5]' : 'bg-white/30 text-white'}`}>
                        1
                      </span>
                    )}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Contenido del tab ────────────────────────────── */}
            <div className="p-5">

              {/* DEFAULT — copia exacta de Datos Generales */}
              {activeTab === 'default' && (
                <div>
                  {sectionHeader('Datos Generales')}
                  {catalogLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                      <Loader2 size={14} className="animate-spin text-[#0099CC]" /> Cargando catálogo...
                    </div>
                  ) : renderDatosGeneralesGrid()}

                  {!ejecutando && !isView && (
                    <div className="mt-5 flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                      <Play size={14} />
                      {isCreate
                        ? 'Guarde el registro y use "Ejecutar Reporte" para generar el archivo.'
                        : 'Use "Ejecutar Reporte" (arriba a la derecha) para generar el reporte. El archivo quedará en Archivos Adjuntos.'}
                    </div>
                  )}
                </div>
              )}

              {/* ARCHIVOS ADJUNTOS */}
              {activeTab === 'adjuntos' && (
                <div>
                  {sectionHeader('Archivos Adjuntos', <Paperclip size={14} className="text-[#4A6FA5]" />)}

                  {archivo === null ? (
                    <div className="flex flex-col items-center justify-center py-14 text-gray-400 gap-3">
                      <Paperclip size={36} className="text-gray-300" />
                      <span className="text-sm">No hay archivos adjuntos</span>
                      {!isView && (
                        <p className="text-xs text-gray-400 text-center max-w-xs">
                          Los reportes generados aparecerán aquí automáticamente.
                          Use "Ejecutar Reporte" para generar el primero.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="border border-gray-300 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#D0D0D0]">
                            <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 w-28">Ver | Descargar</th>
                            <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">NOMBRE ARCHIVO</th>
                            <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 w-20">FORMATO</th>
                            <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 w-20">TAMAÑO</th>
                            <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 w-32">FECHA GENERACIÓN</th>
                            <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 w-24">STORAGE</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            style={{ backgroundColor: '#FFFFFF' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E8F4F8')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                            className="transition-colors"
                          >
                            <td className="px-3 py-2 border-b border-gray-200 text-xs">
                              <span
                                className="text-[#0066CC] hover:underline cursor-pointer mr-2 inline-flex items-center gap-0.5"
                                onClick={() => setViewArchivo(archivo)}
                              >
                                <Eye size={11} /> Ver
                              </span>
                              <span className="text-gray-300">|</span>
                              <span
                                className="text-[#0066CC] hover:underline cursor-pointer ml-2 inline-flex items-center gap-0.5"
                                onClick={() => downloadArchivoSmart(archivo)}
                              >
                                <Download size={11} /> Descargar
                              </span>
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 text-xs text-gray-800 font-mono">
                              <div className="flex items-center gap-1.5">
                                <FileText size={12} className="text-[#0099CC] flex-shrink-0" />
                                {archivo.nombre}
                              </div>
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 text-xs">
                              <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono text-gray-700">
                                {archivo.formato}
                              </span>
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 text-xs text-gray-500">
                              {formatSize(archivo.tamaño)}
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 text-xs text-gray-500">
                              {formatDateDMY(archivo.generadoEn)}
                            </td>
                            <td className="px-3 py-2 border-b border-gray-200 text-xs">
                              {archivo.storage_path ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 border border-green-300">
                                  <CheckCircle size={9} /> Guardado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700 border border-yellow-300">
                                  <AlertCircle size={9} /> Sin guardar
                                </span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BADGE de estatus
// ═══════════════════════════════════════════════════════════════════
function EstatusBadge({ estatus }: { estatus: 'Pendiente' | 'Generado' }) {
  if (estatus === 'Generado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 border border-green-300">
        <CheckCircle size={10} /> Generado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300">
      <Loader2 size={10} /> Pendiente
    </span>
  );
}
