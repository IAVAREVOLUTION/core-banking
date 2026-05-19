import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Plus, Search, Trash2, Save, RotateCcw, X, Menu,
  FileSpreadsheet, FileText, FileDown, Printer, AlertTriangle,
  Eye, Pencil, Brain, RefreshCw, Loader2, CloudOff, Cloud, ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ═══════════════════════════════════════════════════════════════════
// TIPOS — Tabla EFINANCIANET_DB.REPORTES_REGULATORIOS
// Columnas reales (no JSONB): id, clave_reporte, nombre_reporte, formato_salida, prompt_ia
// ═══════════════════════════════════════════════════════════════════
interface ReporteRegulatorio {
  id: string;
  clave_reporte: string;
  nombre_reporte: string;
  formato_salida: string;
  prompt_ia: string;
}

type FormMode = 'list' | 'create' | 'edit' | 'view';

// ═══════════════════════════════════════════════════════════════════
// API CONFIG
// ═══════════════════════════════════════════════════════════════════
const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${publicAnonKey}`,
};
const STORAGE_KEY = 'config_reportes_regulatorios_v2';
const LOG = '[ReportesReg]';

// ═══════════════════════════════════════════════════════════════════
// HOOK: useReportesRegulariosDB
// Patrón: Edge Function (SQL directo) → sessionStorage fallback
// ═══════════════════════════════════════════════════════════════════
function useReportesRegulariosDB() {
  const [data, setData] = useState<ReporteRegulatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const loadedRef = useRef(false);

  const saveCache = (items: ReporteRegulatorio[]) => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* */ }
  };
  const loadCache = (): ReporteRegulatorio[] => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* */ }
    return [];
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      console.log(`${LOG} GET /reportes-regulatorios`);
      const res = await fetch(`${BASE_URL}/reportes-regulatorios`, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items: ReporteRegulatorio[] = json.data || [];
      console.log(`${LOG} Recibidos ${items.length} registros de REPORTES_REGULATORIOS`);
      setData(items);
      saveCache(items);
      setSynced(true);
    } catch (err: any) {
      console.log(`${LOG} Error fetch: ${err.message} — usando cache local`);
      const cached = loadCache();
      if (cached.length > 0) {
        setData(cached);
        toast.warning('Modo offline', { description: 'Usando datos en cache. Los cambios se guardarán localmente.' });
      }
      setSynced(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  const create = useCallback(async (item: Omit<ReporteRegulatorio, 'id'>): Promise<ReporteRegulatorio | null> => {
    try {
      console.log(`${LOG} POST /reportes-regulatorios — ${item.clave_reporte}`);
      const res = await fetch(`${BASE_URL}/reportes-regulatorios`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(item),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const newItem: ReporteRegulatorio = json.data;
      console.log(`${LOG} INSERT exitoso — uuid: ${newItem.id}`);
      setData(prev => {
        const updated = [...prev, newItem];
        saveCache(updated);
        return updated;
      });
      setSynced(true);
      return newItem;
    } catch (err: any) {
      console.log(`${LOG} Error POST: ${err.message} — guardando en cache`);
      const tempItem: ReporteRegulatorio = { ...item, id: `temp-${Date.now()}` };
      setData(prev => {
        const updated = [...prev, tempItem];
        saveCache(updated);
        return updated;
      });
      setSynced(false);
      toast.warning('Guardado localmente', { description: 'No se pudo sincronizar con el servidor.' });
      return tempItem;
    }
  }, []);

  const update = useCallback(async (item: ReporteRegulatorio): Promise<boolean> => {
    try {
      console.log(`${LOG} PUT /reportes-regulatorios/${item.id}`);
      const res = await fetch(`${BASE_URL}/reportes-regulatorios/${item.id}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({
          clave_reporte: item.clave_reporte,
          nombre_reporte: item.nombre_reporte,
          formato_salida: item.formato_salida,
          prompt_ia: item.prompt_ia,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      setData(prev => {
        const updated = prev.map(d => d.id === item.id ? item : d);
        saveCache(updated);
        return updated;
      });
      setSynced(true);
      return true;
    } catch (err: any) {
      console.log(`${LOG} Error PUT: ${err.message} — guardando en cache`);
      setData(prev => {
        const updated = prev.map(d => d.id === item.id ? item : d);
        saveCache(updated);
        return updated;
      });
      setSynced(false);
      toast.warning('Guardado localmente', { description: 'No se pudo sincronizar con el servidor.' });
      return true;
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      console.log(`${LOG} DELETE /reportes-regulatorios/${id}`);
      const res = await fetch(`${BASE_URL}/reportes-regulatorios/${id}`, {
        method: 'DELETE', headers: HEADERS,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(prev => {
        const updated = prev.filter(d => d.id !== id);
        saveCache(updated);
        return updated;
      });
      setSynced(true);
      return true;
    } catch (err: any) {
      console.log(`${LOG} Error DELETE: ${err.message} — eliminando de cache`);
      setData(prev => {
        const updated = prev.filter(d => d.id !== id);
        saveCache(updated);
        return updated;
      });
      setSynced(false);
      return true;
    }
  }, []);

  return { data, loading, synced, fetchAll, create, update, remove };
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function ReportesRegulariosSection() {
  const db = useReportesRegulariosDB();
  const [mode, setMode] = useState<FormMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ReporteRegulatorio | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    clave_reporte: '',
    nombre_reporte: '',
    formato_salida: '',
    prompt_ia: '',
  });

  // ─── Filtrado ──────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (!filterText) return db.data;
    const q = filterText.toLowerCase();
    return db.data.filter(item =>
      item.clave_reporte.toLowerCase().includes(q) ||
      item.nombre_reporte.toLowerCase().includes(q) ||
      item.formato_salida.toLowerCase().includes(q)
    );
  }, [db.data, filterText]);

  // ─── CRUD handlers ─────────────────────────────────────────────
  const handleNew = () => {
    setFormData({ clave_reporte: '', nombre_reporte: '', formato_salida: '', prompt_ia: '' });
    setSelectedItem(null);
    setMode('create');
  };

  const handleEdit = (item: ReporteRegulatorio) => {
    setFormData({
      clave_reporte: item.clave_reporte,
      nombre_reporte: item.nombre_reporte,
      formato_salida: item.formato_salida,
      prompt_ia: item.prompt_ia,
    });
    setSelectedItem(item);
    setMode('edit');
  };

  const handleView = (item: ReporteRegulatorio) => {
    setFormData({
      clave_reporte: item.clave_reporte,
      nombre_reporte: item.nombre_reporte,
      formato_salida: item.formato_salida,
      prompt_ia: item.prompt_ia,
    });
    setSelectedItem(item);
    setMode('view');
  };

  const handleSave = async () => {
    if (!formData.clave_reporte.trim()) {
      toast.error('Campo requerido', { description: 'Ingrese la Clave del reporte.' });
      return;
    }
    if (!formData.nombre_reporte.trim()) {
      toast.error('Campo requerido', { description: 'Ingrese el Nombre del reporte.' });
      return;
    }
    if (!formData.formato_salida.trim()) {
      toast.error('Campo requerido', { description: 'Ingrese el Formato de salida.' });
      return;
    }
    if (!formData.prompt_ia.trim()) {
      toast.error('Campo requerido', { description: 'Ingrese el Prompt IA.' });
      return;
    }

    const duplicateClave = db.data.find(
      d => d.clave_reporte.toUpperCase() === formData.clave_reporte.trim().toUpperCase() &&
        d.id !== selectedItem?.id
    );
    if (duplicateClave) {
      toast.error('Clave duplicada', { description: `Ya existe un reporte con clave "${duplicateClave.clave_reporte}".` });
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        const newItem = {
          clave_reporte: formData.clave_reporte.trim().toUpperCase(),
          nombre_reporte: formData.nombre_reporte.trim(),
          formato_salida: formData.formato_salida.trim().toUpperCase(),
          prompt_ia: formData.prompt_ia.trim(),
        };
        const created = await db.create(newItem);
        if (created) {
          toast.success('Reporte creado en BD', { description: `${newItem.clave_reporte} — uuid: ${created.id.substring(0, 8)}...` });
        }
      } else if (mode === 'edit' && selectedItem) {
        const updated: ReporteRegulatorio = {
          ...selectedItem,
          clave_reporte: formData.clave_reporte.trim().toUpperCase(),
          nombre_reporte: formData.nombre_reporte.trim(),
          formato_salida: formData.formato_salida.trim().toUpperCase(),
          prompt_ia: formData.prompt_ia.trim(),
        };
        await db.update(updated);
        toast.success('Reporte actualizado en BD', { description: `${updated.clave_reporte} guardado en REPORTES_REGULATORIOS.` });
      }
      setMode('list');
      setSelectedItem(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setMode('list');
    setSelectedItem(null);
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (deleteTargetId !== null) {
      await db.remove(deleteTargetId);
      setSelectedId(null);
      setDeleteTargetId(null);
      setShowDeleteModal(false);
      toast.success('Reporte eliminado de REPORTES_REGULATORIOS');
    }
  };

  // ─── Exports ───────────────────────────────────────────────────
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(db.data.map(d => ({
      ID: d.id,
      'Clave Reporte': d.clave_reporte,
      'Nombre Reporte': d.nombre_reporte,
      'Formato Salida': d.formato_salida,
      'Prompt IA': d.prompt_ia,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reportes Regulatorios');
    XLSX.writeFile(wb, 'reportes_regulatorios.xlsx');
    toast.success('Exportado a Excel');
  };

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(db.data.map(d => ({
      ID: d.id,
      'Clave Reporte': d.clave_reporte,
      'Nombre Reporte': d.nombre_reporte,
      'Formato Salida': d.formato_salida,
      'Prompt IA': d.prompt_ia,
    })));
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'reportes_regulatorios.csv'; a.click();
    toast.success('Exportado a CSV');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Reportes Regulatorios del Sistema', 14, 15);
    doc.setFontSize(8);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')} | Fuente: REPORTES_REGULATORIOS`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [['Clave', 'Nombre', 'Formato', 'Prompt IA']],
      body: db.data.map(d => [
        d.clave_reporte, d.nombre_reporte, d.formato_salida,
        d.prompt_ia.substring(0, 80) + (d.prompt_ia.length > 80 ? '...' : ''),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [46, 92, 145] },
    });
    doc.save('reportes_regulatorios.pdf');
    toast.success('Exportado a PDF');
  };

  const isViewMode = mode === 'view';

  const inputClassName = (disabled?: boolean) => {
    const base = 'w-full px-2.5 py-1.5 text-xs rounded-sm';
    if (isViewMode || disabled) return `${base} border-0 bg-gray-50 text-gray-700 cursor-default`;
    return `${base} border border-gray-300 bg-white focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none transition-colors`;
  };

  // ═══════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════
  if (db.loading && mode === 'list') {
    return (
      <div className="p-6 bg-[#FAFBFC] min-h-[600px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 size={32} className="animate-spin text-[#2E5C91]" />
          <span className="text-sm">Cargando reportes desde REPORTES_REGULATORIOS...</span>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // FORM VIEW
  // ═══════════════════════════════════════════════════════════════
  if (mode !== 'list') {
    return (
      <div className="p-6 bg-[#FAFBFC] min-h-[600px]">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2E5C91] to-[#4A6FA5] px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList size={18} className="text-white/80" />
              <span className="text-sm font-semibold text-white tracking-wide uppercase">
                {mode === 'create' ? 'Nuevo Reporte Regulatorio' : mode === 'edit' ? 'Editar Reporte Regulatorio' : 'Detalle del Reporte'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isViewMode && (
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-xs font-medium rounded-sm hover:bg-green-700 transition-colors shadow-sm disabled:opacity-60">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              )}
              <button onClick={handleCancel} className="flex items-center gap-1.5 px-4 py-1.5 bg-white/20 text-white text-xs font-medium rounded-sm hover:bg-white/30 transition-colors">
                <RotateCcw size={13} /> {isViewMode ? 'Regresar' : 'Cancelar'}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="bg-white border-2 border-gray-400 border-t-0 p-6">
            {/* Sección: Datos del Reporte */}
            <div className="bg-[#E7E6E6] px-3 py-1.5 mb-5 border-l-4 border-[#2E5C91] rounded-r">
              <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Datos del Reporte Regulatorio</span>
            </div>

            <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-6">
              {/* Clave Reporte */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Clave Reporte <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={formData.clave_reporte}
                  onChange={(e) => setFormData(p => ({ ...p, clave_reporte: e.target.value.toUpperCase() }))}
                  disabled={isViewMode}
                  placeholder="Ej: R01, SIPRES-01"
                  className={inputClassName()}
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">Identificador único del reporte</span>
              </div>

              {/* Nombre Reporte */}
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Nombre Reporte <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={formData.nombre_reporte}
                  onChange={(e) => setFormData(p => ({ ...p, nombre_reporte: e.target.value }))}
                  disabled={isViewMode}
                  placeholder="Nombre descriptivo del reporte regulatorio"
                  className={inputClassName()}
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">Máximo 200 caracteres</span>
              </div>

              {/* Formato Salida */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Formato de Salida <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={formData.formato_salida}
                  onChange={(e) => setFormData(p => ({ ...p, formato_salida: e.target.value.toUpperCase() }))}
                  disabled={isViewMode}
                  placeholder="Ej: XML, JSON, CSV, PDF"
                  className={inputClassName()}
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">Formato del archivo generado</span>
              </div>
            </div>

            {/* Sección: Prompt IA */}
            <div className="bg-[#E7E6E6] px-3 py-1.5 mb-5 border-l-4 border-[#2E5C91] rounded-r">
              <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
                Prompt de Inteligencia Artificial
              </span>
            </div>

            <div className="mb-4">
              <div className="flex items-start gap-3 mb-3 p-3 bg-blue-50 border border-blue-200 rounded-sm">
                <Brain size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Este campo define las instrucciones que la IA utilizará para generar o procesar el reporte regulatorio.
                  Describe el contenido esperado, campos requeridos, formato y reglas de negocio aplicables.
                </p>
              </div>

              <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Prompt IA <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={6}
                value={formData.prompt_ia}
                onChange={(e) => setFormData(p => ({ ...p, prompt_ia: e.target.value }))}
                disabled={isViewMode}
                placeholder="Describe detalladamente las instrucciones para la generación del reporte regulatorio mediante IA..."
                className={`${inputClassName()} resize-none font-mono text-[11px] leading-relaxed`}
              />
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-gray-400">Instrucciones para generación automática por IA.</span>
                <span className={`text-[10px] ${formData.prompt_ia.length > 3500 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {formData.prompt_ia.length} caracteres
                </span>
              </div>
            </div>

            {/* Metadata (solo en edit/view) */}
            {selectedItem && (
              <div className="mt-6 pt-4 border-t border-gray-200 flex items-center gap-6 text-[10px] text-gray-400">
                <span>UUID: {selectedItem.id}</span>
                <span>Tabla: EFINANCIANET_DB.REPORTES_REGULATORIOS</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="p-6 bg-[#FAFBFC] min-h-[600px]">
      {/* Header principal */}
      <div className="bg-gradient-to-r from-[#2E5C91] to-[#4A6FA5] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList size={18} className="text-white/80" />
          <span className="text-sm font-semibold text-white tracking-wide uppercase">
            Reportes Regulatorios del Sistema
          </span>
          {db.synced ? (
            <span className="flex items-center gap-1 text-[10px] text-green-200" title="Sincronizado con REPORTES_REGULATORIOS">
              <Cloud size={11} /> BD
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-yellow-200" title="Datos locales — sin conexión a BD">
              <CloudOff size={11} /> Local
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => db.fetchAll()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white text-xs font-medium rounded-sm hover:bg-white/30 transition-colors"
            title="Recargar desde REPORTES_REGULATORIOS"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white/20 text-white text-xs font-medium rounded-sm hover:bg-white/30 transition-colors"
          >
            <Plus size={13} /> Nuevo
          </button>
          <button
            onClick={() => setDeleteMode(!deleteMode)}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              deleteMode
                ? 'bg-white text-red-600 font-semibold shadow-sm'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="bg-white border-x-2 border-gray-400 px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* Menú exportar */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] rounded-sm"
          >
            <Menu size={12} /> Menú
          </button>
          {showMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 shadow-lg z-10 min-w-[160px] rounded-sm overflow-hidden">
              <button onClick={() => { exportExcel(); setShowMenu(false); }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">
                <FileSpreadsheet size={12} className="text-green-600" /> Exportar a Excel
              </button>
              <button onClick={() => { exportCSV(); setShowMenu(false); }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">
                <FileText size={12} className="text-blue-600" /> Exportar a CSV
              </button>
              <button onClick={() => { exportPDF(); setShowMenu(false); }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">
                <FileDown size={12} className="text-red-600" /> Exportar a PDF
              </button>
              <button onClick={() => { window.print(); setShowMenu(false); }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50">
                <Printer size={12} className="text-gray-600" /> Imprimir
              </button>
            </div>
          )}
        </div>

        {/* Buscar */}
        <div className="flex items-center gap-1.5">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Buscar por clave, nombre o formato..."
            className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-sm w-64 focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none"
          />
        </div>

        {filterText && (
          <button
            onClick={() => setFilterText('')}
            className="text-[10px] text-blue-600 hover:underline"
          >
            Limpiar filtros
          </button>
        )}

        <span className="text-[11px] text-gray-500 ml-auto">
          Doble clic para editar
        </span>
      </div>

      {/* Tabla */}
      <div className="border-2 border-gray-400 border-t-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#2E5C91]">
                {deleteMode && (
                  <th className="text-center px-2 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-12">
                    <Trash2 size={13} className="mx-auto text-white/70" />
                  </th>
                )}
                <th className="text-left px-3 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-36">Clave Reporte</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Nombre Reporte</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Formato Salida</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-64">Prompt IA</th>
                <th className="text-center px-2 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={deleteMode ? 6 : 5} className="px-3 py-12 text-center text-gray-400 text-xs">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList size={32} className="text-gray-300" />
                      <span className="font-medium text-gray-500">
                        {db.data.length === 0 ? 'No hay reportes en REPORTES_REGULATORIOS' : 'No se encontraron resultados'}
                      </span>
                      {db.data.length === 0 && (
                        <span className="text-gray-400">Haga clic en "+ Nuevo" para agregar un reporte regulatorio</span>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    onDoubleClick={() => handleEdit(item)}
                    className={`transition-colors cursor-pointer ${
                      selectedId === item.id
                        ? 'bg-blue-100/70 ring-1 ring-inset ring-blue-300'
                        : index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/60 hover:bg-gray-100/60'
                    }`}
                  >
                    {deleteMode && (
                      <td className="text-center px-2 py-2 border-b border-gray-200">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item.id); }}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                          title="Eliminar"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    )}
                    <td className="px-3 py-2 border-b border-gray-200">
                      <span className="font-mono font-semibold text-[#2E5C91] text-[11px]">{item.clave_reporte}</span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-200 font-medium text-gray-800">{item.nombre_reporte}</td>
                    <td className="px-3 py-2 border-b border-gray-200">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {item.formato_salida}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-200 text-gray-500">
                      {item.prompt_ia ? (
                        <div className="flex items-start gap-1.5">
                          <Brain size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2 text-[11px]">{item.prompt_ia}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 italic text-[10px]">Sin prompt</span>
                      )}
                    </td>
                    <td className="px-2 py-2 border-b border-gray-200 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleView(item); }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Ver detalle"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                          className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-x-2 border-b-2 border-gray-400 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <span className="text-[11px] text-gray-500">
          Total: <span className="font-semibold text-gray-700">{db.data.length}</span> reporte{db.data.length !== 1 ? 's' : ''}
          {filteredData.length !== db.data.length && (
            <span className="text-blue-600 ml-1">(mostrando {filteredData.length})</span>
          )}
          <span className="text-gray-300 ml-2">|</span>
          <span className="text-gray-400 ml-2">Tabla: EFINANCIANET_DB.REPORTES_REGULATORIOS</span>
        </span>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-sm shadow-2xl w-[440px] mx-4 overflow-hidden border-2 border-gray-400">
            <div className="bg-gradient-to-r from-[#2E5C91] to-[#4A6FA5] px-5 py-3">
              <h3 className="text-sm font-semibold text-white">Confirmar Eliminación</h3>
            </div>
            <div className="px-6 py-6 flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 mb-1">¿Eliminar este reporte regulatorio?</p>
                <p className="text-xs text-gray-500">
                  El registro será eliminado permanentemente de la tabla REPORTES_REGULATORIOS.
                </p>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2.5 border-t border-gray-200">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null); }}
                className="px-5 py-1.5 text-xs bg-white border border-gray-300 rounded-sm text-gray-600 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-1.5 text-xs bg-red-600 text-white rounded-sm hover:bg-red-700 font-medium transition-colors shadow-sm"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
