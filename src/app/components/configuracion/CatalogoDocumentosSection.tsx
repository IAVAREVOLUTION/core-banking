import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Plus, Search, Trash2, Save, RotateCcw, X, Menu,
  FileSpreadsheet, FileText, FileDown, Printer, AlertTriangle,
  FileCheck, Eye, Pencil, Brain, RefreshCw, Loader2, CloudOff, Cloud,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ═══════════════════════════════════════════════════════════════════
// TIPOS — Estructura de J_CATALOGOS: { id: uuid, type: varchar, data: jsonb }
// El JSONB `data` contiene los campos del documento
// ═══════════════════════════════════════════════════════════════════
interface ElementoRequerido {
  id: string;
  elemento: string;
  /** true → ausencia del elemento rechaza el documento */
  obligatorio: boolean;
}

interface DocumentoCatalogoData {
  clave: string;
  nombre: string;
  descripcion: string;
  promptIA: string;
  elementosRequeridos?: ElementoRequerido[];
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion: string;
}

/** Registro completo como viene de la BD */
interface DocumentoCatalogoRow {
  id: string;        // uuid de J_CATALOGOS
  type: string;      // 'Documento'
  data: DocumentoCatalogoData;
}

/** Vista aplanada para la UI */
interface DocumentoCatalogo {
  id: string;        // uuid
  clave: string;
  nombre: string;
  descripcion: string;
  promptIA: string;
  elementosRequeridos: ElementoRequerido[];
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion: string;
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
const STORAGE_KEY = 'config_catalogo_documentos_v2';
const CATALOGO_TYPE = 'Documento';

// ═══════════════════════════════════════════════════════════════════
// MAPPERS: BD row ↔ UI flat
// ═══════════════════════════════════════════════════════════════════

// Helper para extraer promptIA (maneja objeto anidado o string directo)
function extractPromptIA(data: any): string {
  if (!data) return '';
  // Caso 1: promptIA es un objeto con propiedad promptIA anidada
  if (typeof data.promptIA === 'object' && data.promptIA !== null) {
    return data.promptIA.promptIA || data.promptIA.instrucciones || data.promptIA.texto || '';
  }
  // Caso 2: promptIA es un string directo
  if (typeof data.promptIA === 'string') {
    return data.promptIA;
  }
  return '';
}

function rowToFlat(row: DocumentoCatalogoRow): DocumentoCatalogo {
  const d = row.data || {} as DocumentoCatalogoData;
  return {
    id: row.id,
    clave: d.clave || '',
    nombre: d.nombre || '',
    descripcion: d.descripcion || '',
    promptIA: extractPromptIA(d),
    elementosRequeridos: Array.isArray(d.elementosRequeridos) ? d.elementosRequeridos : [],
    activo: d.activo !== false,
    fechaCreacion: d.fechaCreacion || '',
    fechaModificacion: d.fechaModificacion || '',
  };
}

function flatToData(item: DocumentoCatalogo): DocumentoCatalogoData {
  return {
    clave: item.clave,
    nombre: item.nombre,
    descripcion: item.descripcion,
    promptIA: item.promptIA,
    elementosRequeridos: item.elementosRequeridos,
    activo: item.activo,
    fechaCreacion: item.fechaCreacion,
    fechaModificacion: item.fechaModificacion,
  };
}

// ═══════════════════════════════════════════════════════════════════
// HOOK: useCatalogoDocumentosDB
// Patrón: Edge Function (SQL directo a J_CATALOGOS) → sessionStorage fallback
// Logging: [CatalogoDB]
// ═══════════════════════════════════════════════════════════════════
function useCatalogoDocumentosDB() {
  const [data, setData] = useState<DocumentoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const loadedRef = useRef(false);

  // ─── Cache helpers ─────────────────────────────────────────────
  const saveCache = (items: DocumentoCatalogo[]) => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* */ }
  };
  const loadCache = (): DocumentoCatalogo[] => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* */ }
    return [];
  };

  // ─── Fetch from server ─────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[CatalogoDB] GET /catalogos/documentos');
      const res = await fetch(`${BASE_URL}/catalogos/documentos`, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows: DocumentoCatalogoRow[] = json.data || [];
      const items = rows.map(rowToFlat);
      console.log(`[CatalogoDB] Recibidos ${items.length} documentos de J_CATALOGOS`);
      setData(items);
      saveCache(items);
      setSynced(true);
    } catch (err: any) {
      console.log(`[CatalogoDB] Error fetch: ${err.message} — usando cache local`);
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

  // ─── Create → POST { tipo, datos } ────────────────────────────
  const create = useCallback(async (item: DocumentoCatalogo): Promise<DocumentoCatalogo | null> => {
    const datos = flatToData(item);
    try {
      console.log(`[CatalogoDB] POST /catalogos/documentos — ${datos.clave}`);
      const res = await fetch(`${BASE_URL}/catalogos/documentos`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ tipo: CATALOGO_TYPE, datos }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      // json.data = { id, type, data } — row insertada con uuid generado por BD
      const newItem = rowToFlat(json.data);
      console.log(`[CatalogoDB] INSERT exitoso — uuid: ${newItem.id}`);
      setData(prev => {
        const updated = [...prev, newItem];
        saveCache(updated);
        return updated;
      });
      setSynced(true);
      return newItem;
    } catch (err: any) {
      console.log(`[CatalogoDB] Error POST: ${err.message} — guardando en cache`);
      // Fallback local con id temporal
      const tempItem = { ...item, id: item.id || `temp-${Date.now()}` };
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

  // ─── Update → PUT { tipo, datos } ─────────────────────────────
  const update = useCallback(async (item: DocumentoCatalogo): Promise<boolean> => {
    const datos = flatToData(item);
    try {
      console.log(`[CatalogoDB] PUT /catalogos/documentos/${item.id}`);
      const res = await fetch(`${BASE_URL}/catalogos/documentos/${item.id}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ tipo: CATALOGO_TYPE, datos }),
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
      console.log(`[CatalogoDB] Error PUT: ${err.message} — guardando en cache`);
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

  // ─── Delete ────────────────────────────────────────────────────
  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      console.log(`[CatalogoDB] DELETE /catalogos/documentos/${id}`);
      const res = await fetch(`${BASE_URL}/catalogos/documentos/${id}`, {
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
      console.log(`[CatalogoDB] Error DELETE: ${err.message} — eliminando de cache`);
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
// DATOS SEMILLA — se insertan vía POST si la tabla J_CATALOGOS está vacía
// El id lo genera la BD (uuid), aquí solo van los datos del JSONB
// ═══════════════════════════════════════════════════════════════════
const SEED_DATA: Omit<DocumentoCatalogo, 'id'>[] = [
  {
    clave: 'DOC-INE', nombre: 'INE / Identificación Oficial',
    descripcion: 'Credencial para votar vigente emitida por el INE, con fotografía legible.',
    promptIA: 'Documento de identificación oficial mexicano (INE/IFE) con fotografía del titular, nombre completo, CURP, clave de elector, sección y vigencia. Verificar que la imagen sea legible, no esté vencida y coincida con los datos del solicitante.',
    activo: true, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-CDOM', nombre: 'Comprobante de Domicilio',
    descripcion: 'Recibo de servicios (luz, agua, teléfono) no mayor a 3 meses.',
    promptIA: 'Comprobante de domicilio que muestre dirección completa del titular, con antigüedad no mayor a 3 meses. Puede ser recibo de CFE, agua, teléfono fijo, estado de cuenta bancario o constancia de residencia. Verificar que la dirección coincida con la declarada en la solicitud.',
    activo: true, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-CSF', nombre: 'Constancia de Situación Fiscal',
    descripcion: 'CSF emitida por el SAT con RFC, régimen fiscal y domicilio fiscal vigente.',
    promptIA: 'Constancia de Situación Fiscal emitida por el Servicio de Administración Tributaria (SAT) de México. Debe contener RFC del contribuyente, nombre o razón social, régimen fiscal, domicilio fiscal y fecha de emisión reciente. Validar que el RFC coincida con el del solicitante.',
    activo: true, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-EFIN', nombre: 'Estados Financieros',
    descripcion: 'Últimos 2 ejercicios fiscales dictaminados o internos.',
    promptIA: 'Estados financieros (Balance General, Estado de Resultados, Estado de Flujo de Efectivo) correspondientes a los últimos 2 ejercicios fiscales. Pueden ser dictaminados por auditor externo o internos firmados por el representante legal y contador. Verificar que incluyan cifras comparativas y notas a los estados financieros.',
    activo: true, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-EDOCTA', nombre: 'Estados de Cuenta Bancarios',
    descripcion: 'Últimos 6 meses de cuenta bancaria principal.',
    promptIA: 'Estados de cuenta bancarios de los últimos 6 meses de la cuenta principal del solicitante. Deben mostrar nombre del titular, número de cuenta, movimientos (depósitos y retiros), saldos promedio y banco emisor. Verificar que el titular coincida con el solicitante y que los meses sean consecutivos.',
    activo: true, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-ACTA', nombre: 'Acta Constitutiva',
    descripcion: 'Acta constitutiva con inscripción en el RPP, para personas morales.',
    promptIA: 'Acta constitutiva de la empresa, protocolizada ante notario público e inscrita en el Registro Público de la Propiedad y Comercio. Debe contener denominación social, objeto social, capital social, nombres de socios/accionistas, facultades del representante legal y datos de inscripción registral.',
    activo: true, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-PODER', nombre: 'Poder Notarial',
    descripcion: 'Poder del representante legal vigente ante notario.',
    promptIA: 'Poder notarial otorgado al representante legal de la persona moral. Debe especificar el tipo de poder (general para actos de administración, de dominio, para pleitos y cobranzas, o especial), nombre del apoderado, facultades conferidas, datos del notario y número de escritura. Verificar vigencia y que no haya sido revocado.',
    activo: true, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-AVALUO', nombre: 'Avalúo de Garantía',
    descripcion: 'Avalúo certificado del bien ofrecido en garantía.',
    promptIA: 'Avalúo comercial del bien inmueble o mueble ofrecido en garantía, elaborado por perito valuador certificado. Debe incluir descripción detallada del bien, ubicación, superficie, valor comercial, valor de realización, fotografías, datos del perito y vigencia no mayor a 6 meses.',
    activo: false, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-BURO', nombre: 'Autorización Buró de Crédito',
    descripcion: 'Formato de autorización firmado para consulta de buró.',
    promptIA: 'Formato de autorización para consulta de historial crediticio en Buró de Crédito / Círculo de Crédito, firmado por el solicitante (persona física) o representante legal (persona moral). Debe contener nombre completo, RFC, CURP, firma autógrafa y fecha. Verificar que la firma sea consistente con la identificación oficial.',
    activo: true, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-DAISR', nombre: 'Declaración Anual ISR',
    descripcion: 'Última declaración anual del ISR presentada ante el SAT.',
    promptIA: 'Declaración anual del Impuesto Sobre la Renta presentada al SAT. Debe mostrar el ejercicio fiscal, ingresos acumulables, deducciones autorizadas, resultado fiscal, impuesto determinado y acuse de recibo del SAT con sello digital. Verificar que corresponda al último ejercicio fiscal completo.',
    activo: false, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-CURP', nombre: 'CURP',
    descripcion: 'Clave Única de Registro de Población del solicitante.',
    promptIA: 'Documento de la Clave Única de Registro de Población (CURP) del solicitante, emitido por RENAPO. Debe contener nombre completo, fecha de nacimiento, sexo, entidad de nacimiento y la clave alfanumérica de 18 caracteres. Verificar que los datos coincidan con la identificación oficial.',
    activo: true, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
  {
    clave: 'DOC-POLSEG', nombre: 'Póliza de Seguro',
    descripcion: 'Póliza de seguro del bien dado en garantía, endosada a favor de la institución.',
    promptIA: 'Póliza de seguro vigente del bien otorgado en garantía (inmueble, vehículo, maquinaria). Debe contener datos del asegurado, bien asegurado, coberturas contratadas, suma asegurada, vigencia, prima y endoso a favor de la institución financiera como beneficiario preferente. Verificar que la suma asegurada cubra al menos el monto del crédito.',
    activo: true, fechaCreacion: '2025-01-15', fechaModificacion: '2025-01-15',
  },
];

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function CatalogoDocumentosSection() {
  const db = useCatalogoDocumentosDB();
  const [mode, setMode] = useState<FormMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<DocumentoCatalogo | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterEstado, setFilterEstado] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [showMenu, setShowMenu] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const seededRef = useRef(false);

  // ─── Auto-seed si J_CATALOGOS type='Documento' está vacía ─────
  useEffect(() => {
    if (!db.loading && db.data.length === 0 && !seededRef.current) {
      seededRef.current = true;
      console.log('[CatalogoDB] J_CATALOGOS vacía para type=Documento — insertando datos semilla...');
      (async () => {
        for (const seed of SEED_DATA) {
          const item: DocumentoCatalogo = { ...seed, id: '' }; // id será generado por BD
          await db.create(item);
        }
        toast.success('Catálogo inicializado', { description: `${SEED_DATA.length} documentos insertados en J_CATALOGOS.` });
        db.fetchAll();
      })();
    }
  }, [db.loading, db.data.length]);

  // ─── Form state ────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    clave: '',
    nombre: '',
    descripcion: '',
    promptIA: '',
    elementosRequeridos: [] as ElementoRequerido[],
    activo: true,
  });

  // ─── Filtrado ──────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    return db.data.filter(item => {
      const matchText = !filterText ||
        item.clave.toLowerCase().includes(filterText.toLowerCase()) ||
        item.nombre.toLowerCase().includes(filterText.toLowerCase()) ||
        item.descripcion.toLowerCase().includes(filterText.toLowerCase());
      const matchEstado = filterEstado === 'todos' ||
        (filterEstado === 'activos' && item.activo) ||
        (filterEstado === 'inactivos' && !item.activo);
      return matchText && matchEstado;
    });
  }, [db.data, filterText, filterEstado]);

  // ─── CRUD handlers ─────────────────────────────────────────────
  const handleNew = () => {
    setFormData({ clave: '', nombre: '', descripcion: '', promptIA: '', elementosRequeridos: [], activo: true });
    setSelectedItem(null);
    setMode('create');
  };

  const handleEdit = (item: DocumentoCatalogo) => {
    setFormData({
      clave: item.clave,
      nombre: item.nombre,
      descripcion: item.descripcion,
      promptIA: item.promptIA,
      elementosRequeridos: item.elementosRequeridos || [],
      activo: item.activo,
    });
    setSelectedItem(item);
    setMode('edit');
  };

  const handleView = (item: DocumentoCatalogo) => {
    setFormData({
      clave: item.clave,
      nombre: item.nombre,
      descripcion: item.descripcion,
      promptIA: item.promptIA,
      elementosRequeridos: item.elementosRequeridos || [],
      activo: item.activo,
    });
    setSelectedItem(item);
    setMode('view');
  };

  const handleRowDoubleClick = (item: DocumentoCatalogo) => {
    handleEdit(item);
  };

  const handleSave = async () => {
    // Validaciones
    if (!formData.clave.trim()) {
      toast.error('Campo requerido', { description: 'Ingrese la Clave del documento.' });
      return;
    }
    if (formData.clave.length > 20) {
      toast.error('Clave demasiado larga', { description: 'Máximo 20 caracteres.' });
      return;
    }
    if (!formData.nombre.trim()) {
      toast.error('Campo requerido', { description: 'Ingrese el Nombre del documento.' });
      return;
    }
    if (formData.nombre.length > 100) {
      toast.error('Nombre demasiado largo', { description: 'Máximo 100 caracteres.' });
      return;
    }
    if (!formData.descripcion.trim()) {
      toast.error('Campo requerido', { description: 'Ingrese la Descripción del documento.' });
      return;
    }

    // Clave duplicada
    const duplicateClave = db.data.find(
      d => d.clave.toUpperCase() === formData.clave.trim().toUpperCase() &&
        d.id !== selectedItem?.id
    );
    if (duplicateClave) {
      toast.error('Clave duplicada', { description: `Ya existe un documento con clave "${duplicateClave.clave}".` });
      return;
    }

    setSaving(true);
    const now = new Date().toISOString().slice(0, 10);

    try {
      if (mode === 'create') {
        const newItem: DocumentoCatalogo = {
          id: '', // será generado por la BD (uuid)
          clave: formData.clave.trim().toUpperCase(),
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim(),
          promptIA: formData.promptIA.trim(),
          elementosRequeridos: formData.elementosRequeridos,
          activo: formData.activo,
          fechaCreacion: now,
          fechaModificacion: now,
        };
        const created = await db.create(newItem);
        if (created) {
          toast.success('Documento creado en BD', { description: `${newItem.clave} — uuid: ${created.id.substring(0, 8)}...` });
        }
      } else if (mode === 'edit' && selectedItem) {
        const updated: DocumentoCatalogo = {
          ...selectedItem,
          clave: formData.clave.trim().toUpperCase(),
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim(),
          promptIA: formData.promptIA.trim(),
          elementosRequeridos: formData.elementosRequeridos,
          activo: formData.activo,
          fechaModificacion: now,
        };
        await db.update(updated);
        toast.success('Documento actualizado en BD', { description: `${updated.clave} guardado en J_CATALOGOS.` });
      }
      // Invalidar todos los cachés del catálogo para que el Expediente tome los datos nuevos
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem('solicitud_catalogo_documentos_cache');
        sessionStorage.removeItem('catalogo_documentos_nombres_v1');
      } catch { /* */ }
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
      toast.success('Documento eliminado de J_CATALOGOS');
    }
  };

  // ─── Exports ───────────────────────────────────────────────────
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(db.data.map(d => ({
      ID: d.id,
      Clave: d.clave, Nombre: d.nombre, Descripción: d.descripcion,
      'Prompt IA': d.promptIA, Activo: d.activo ? 'Sí' : 'No',
      'Fecha Creación': d.fechaCreacion, 'Fecha Modificación': d.fechaModificacion,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Catálogo Documentos');
    XLSX.writeFile(wb, 'catalogo_documentos.xlsx');
    toast.success('Exportado a Excel');
  };

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(db.data.map(d => ({
      ID: d.id,
      Clave: d.clave, Nombre: d.nombre, Descripción: d.descripcion,
      'Prompt IA': d.promptIA, Activo: d.activo ? 'Sí' : 'No',
    })));
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'catalogo_documentos.csv'; a.click();
    toast.success('Exportado a CSV');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Catálogo de Documentos del Sistema', 14, 15);
    doc.setFontSize(8);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')} | Fuente: J_CATALOGOS`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [['Clave', 'Nombre', 'Descripción', 'Prompt IA', 'Activo']],
      body: db.data.map(d => [d.clave, d.nombre, d.descripcion, d.promptIA.substring(0, 80) + '...', d.activo ? 'Sí' : 'No']),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [46, 92, 145] },
    });
    doc.save('catalogo_documentos.pdf');
    toast.success('Exportado a PDF');
  };

  // ─── Stats ─────────────────────────────────────────────────────
  const totalActivos = db.data.filter(d => d.activo).length;
  const totalInactivos = db.data.length - totalActivos;

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
          <span className="text-sm">Cargando catálogo de documentos desde J_CATALOGOS...</span>
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
              <FileCheck size={18} className="text-white/80" />
              <span className="text-sm font-semibold text-white tracking-wide uppercase">
                {mode === 'create' ? 'Nuevo Documento' : mode === 'edit' ? 'Editar Documento' : 'Detalle del Documento'}
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
            {/* Sección: Datos del Documento */}
            <div className="bg-[#E7E6E6] px-3 py-1.5 mb-5 border-l-4 border-[#2E5C91] rounded-r">
              <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Datos del Documento</span>
            </div>

            <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-6">
              {/* Clave */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Clave <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={formData.clave}
                  onChange={(e) => setFormData(p => ({ ...p, clave: e.target.value.toUpperCase() }))}
                  disabled={isViewMode}
                  placeholder="Ej: DOC-INE"
                  className={inputClassName()}
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">Identificador único, máximo 20 caracteres</span>
              </div>

              {/* Nombre */}
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={formData.nombre}
                  onChange={(e) => setFormData(p => ({ ...p, nombre: e.target.value }))}
                  disabled={isViewMode}
                  placeholder="Nombre del tipo de documento"
                  className={inputClassName()}
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">Máximo 100 caracteres</span>
              </div>

              {/* Descripción */}
              <div className="col-span-3">
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <textarea
                  maxLength={500}
                  rows={2}
                  value={formData.descripcion}
                  onChange={(e) => setFormData(p => ({ ...p, descripcion: e.target.value }))}
                  disabled={isViewMode}
                  placeholder="Descripción breve del documento y su uso..."
                  className={`${inputClassName()} resize-none`}
                />
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px] text-gray-400">Máximo 500 caracteres</span>
                  <span className={`text-[10px] ${formData.descripcion.length > 450 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {formData.descripcion.length}/500
                  </span>
                </div>
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
                  Este campo define el prompt que se utilizará cuando el usuario adjunte documentos en la sección
                  <strong> "Expediente Electrónico" </strong> de las Solicitudes. El sistema empleará este texto para
                  validar, clasificar y procesar automáticamente los documentos adjuntados mediante IA.
                </p>
              </div>

              <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Prompt IA
              </label>
              <textarea
                maxLength={2000}
                rows={5}
                value={formData.promptIA}
                onChange={(e) => setFormData(p => ({ ...p, promptIA: e.target.value }))}
                disabled={isViewMode}
                placeholder="Describe qué es este documento y qué debe contener. Ej: 'Verifica que sea una Identificación Oficial vigente (INE/IFE). Debe mostrar claramente la fotografía del titular, nombre completo y CURP.' Los elementos específicos a verificar se configuran en la tabla de abajo."
                className={`${inputClassName()} resize-none font-mono text-[11px] leading-relaxed`}
              />
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-gray-400">Texto descriptivo para validación automática por IA. Máximo 2000 caracteres.</span>
                <span className={`text-[10px] ${formData.promptIA.length > 1800 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {formData.promptIA.length}/2000
                </span>
              </div>
            </div>

            {/* Elementos a Verificar */}
            <div className="bg-[#E7E6E6] px-3 py-1.5 mb-4 border-l-4 border-[#2E5C91] rounded-r flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Elementos a Verificar por IA</span>
              {!isViewMode && (
                <button
                  type="button"
                  onClick={() => setFormData(p => ({
                    ...p,
                    elementosRequeridos: [
                      ...p.elementosRequeridos,
                      { id: `elem-${Date.now()}`, elemento: '', obligatorio: true },
                    ],
                  }))}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[#2E5C91] text-white text-[10px] rounded hover:bg-[#1e4070]"
                >
                  <Plus size={11} /> Agregar elemento
                </button>
              )}
            </div>

            <div className="mb-6">
              <p className="text-[10px] text-gray-500 mb-2">
                Define qué elementos debe encontrar la IA en el documento. Los marcados como <strong>Obligatorio</strong> rechazan el documento si no están presentes.
              </p>
              {formData.elementosRequeridos.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic py-2">Sin elementos definidos — la IA solo usará el prompt general.</p>
              ) : (
                <div className="border border-gray-300 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                        <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">ELEMENTO A VERIFICAR</th>
                        <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold border-r border-gray-300 w-28">OBLIGATORIO</th>
                        {!isViewMode && <th className="px-2 py-2 w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {formData.elementosRequeridos.map((elem, idx) => (
                        <tr key={elem.id} style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#EEEEEE' }} className="border-b border-gray-200">
                          <td className="px-2 py-1.5 border-r border-gray-200">
                            {isViewMode ? (
                              <span className="text-gray-700">{elem.elemento || <em className="text-gray-400">Sin texto</em>}</span>
                            ) : (
                              <input
                                type="text"
                                value={elem.elemento}
                                onChange={e => setFormData(p => ({
                                  ...p,
                                  elementosRequeridos: p.elementosRequeridos.map((el, i) =>
                                    i === idx ? { ...el, elemento: e.target.value } : el
                                  ),
                                }))}
                                placeholder="Ej: Firma del titular, Fotografía, CURP visible..."
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#2E5C91]"
                              />
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center border-r border-gray-200">
                            <input
                              type="checkbox"
                              checked={elem.obligatorio}
                              disabled={isViewMode}
                              onChange={e => setFormData(p => ({
                                ...p,
                                elementosRequeridos: p.elementosRequeridos.map((el, i) =>
                                  i === idx ? { ...el, obligatorio: e.target.checked } : el
                                ),
                              }))}
                              className="w-3.5 h-3.5 accent-[#2E5C91]"
                              title={elem.obligatorio ? 'Obligatorio — su ausencia rechaza el documento' : 'Opcional — solo se registra si está presente'}
                            />
                            <span className={`ml-1.5 text-[10px] ${elem.obligatorio ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                              {elem.obligatorio ? 'Sí' : 'No'}
                            </span>
                          </td>
                          {!isViewMode && (
                            <td className="px-2 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => setFormData(p => ({
                                  ...p,
                                  elementosRequeridos: p.elementosRequeridos.filter((_, i) => i !== idx),
                                }))}
                                className="text-red-500 hover:text-red-700"
                                title="Eliminar elemento"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Estado */}
            <div className="bg-[#E7E6E6] px-3 py-1.5 mb-5 border-l-4 border-[#2E5C91] rounded-r">
              <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Estado</span>
            </div>
            <div className="flex items-center gap-3">
              <label className={`relative inline-flex items-center ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={formData.activo}
                  onChange={(e) => setFormData(p => ({ ...p, activo: e.target.checked }))}
                  disabled={isViewMode}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
              </label>
              <span className={`text-xs font-medium ${formData.activo ? 'text-green-700' : 'text-gray-500'}`}>
                {formData.activo ? 'Documento Activo' : 'Documento Inactivo'}
              </span>
            </div>

            {/* Metadata (solo en edit/view) */}
            {selectedItem && (
              <div className="mt-6 pt-4 border-t border-gray-200 flex items-center gap-6 text-[10px] text-gray-400">
                <span>UUID: {selectedItem.id}</span>
                <span>Tabla: J_CATALOGOS</span>
                <span>Type: Documento</span>
                <span>Creado: {selectedItem.fechaCreacion}</span>
                <span>Modificado: {selectedItem.fechaModificacion}</span>
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
          <FileCheck size={18} className="text-white/80" />
          <span className="text-sm font-semibold text-white tracking-wide uppercase">
            Catálogo de Documentos del Sistema
          </span>
          {/* Indicador de sincronización */}
          {db.synced ? (
            <span className="flex items-center gap-1 text-[10px] text-green-200" title="Sincronizado con J_CATALOGOS">
              <Cloud size={11} /> J_CATALOGOS
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
            title="Recargar desde J_CATALOGOS"
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
            placeholder="Buscar por clave, nombre o descripción..."
            className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-sm w-64 focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none"
          />
        </div>

        {/* Filtro estado */}
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value as any)}
          className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-sm bg-white focus:border-blue-500 outline-none"
        >
          <option value="todos">Todos los estados</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
        </select>

        {(filterText || filterEstado !== 'todos') && (
          <button
            onClick={() => { setFilterText(''); setFilterEstado('todos'); }}
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
                <th className="text-left px-3 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-32">Clave</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Nombre</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Descripción</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-56">Prompt IA</th>
                <th className="text-center px-2 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-20">Estado</th>
                <th className="text-center px-2 py-2.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={deleteMode ? 7 : 6} className="px-3 py-12 text-center text-gray-400 text-xs">
                    <div className="flex flex-col items-center gap-2">
                      <FileCheck size={32} className="text-gray-300" />
                      <span className="font-medium text-gray-500">
                        {db.data.length === 0 ? 'No hay documentos en J_CATALOGOS' : 'No se encontraron resultados'}
                      </span>
                      {db.data.length === 0 && (
                        <span className="text-gray-400">Haga clic en "+ Nuevo" para agregar un tipo de documento</span>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    onDoubleClick={() => handleRowDoubleClick(item)}
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
                      <span className="font-mono font-semibold text-[#2E5C91] text-[11px]">{item.clave}</span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-200 font-medium text-gray-800">{item.nombre}</td>
                    <td className="px-3 py-2 border-b border-gray-200 text-gray-600">
                      <span className="line-clamp-2">{item.descripcion}</span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-200 text-gray-500">
                      {item.promptIA ? (
                        <div className="flex items-start gap-1.5">
                          <Brain size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2 text-[11px]">{item.promptIA}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 italic text-[10px]">Sin prompt</span>
                      )}
                    </td>
                    <td className="px-2 py-2 border-b border-gray-200 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        item.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.activo ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {item.activo ? 'Activo' : 'Inactivo'}
                      </span>
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
          Total: <span className="font-semibold text-gray-700">{db.data.length}</span> documento{db.data.length !== 1 ? 's' : ''}
          {filteredData.length !== db.data.length && (
            <span className="text-blue-600 ml-1">(mostrando {filteredData.length})</span>
          )}
          <span className="text-gray-300 ml-2">|</span>
          <span className="text-gray-400 ml-2">Tabla: EFINANCIANET_DB.J_CATALOGOS (type=Documento)</span>
        </span>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-green-600">
            <span className="font-semibold">{totalActivos}</span> activo{totalActivos !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            <span className="font-semibold">{totalInactivos}</span> inactivo{totalInactivos !== 1 ? 's' : ''}
          </span>
        </div>
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
                <p className="text-sm font-medium text-gray-800 mb-1">¿Eliminar este documento del catálogo?</p>
                <p className="text-xs text-gray-500">
                  El registro será eliminado permanentemente de la tabla J_CATALOGOS. Los productos que lo referencien ya no lo mostrarán.
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
