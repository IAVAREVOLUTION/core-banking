/**
 * ExpedienteElectronicoTab.tsx — Spec: financial-account-request-spec.md
 *
 * Sección 1: Requisitos del Producto (desde J_PRODUCTOS.data.requisitos)
 *   - Muestra TODOS los requisitos configurados en el producto seleccionado
 *   - Incluye: Fase, Tipo Documento, Descripcion, Area, Obligatorio, Prompt IA, Estatus
 *   - Diferencia visualmente la fase actual
 *
 * Sección 2: Documentos Cargados por el usuario para esta solicitud
 *   - Filtrado por solicitudId + usuario actual
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '../../lib/supabaseClient';

/**
 * pdf.js se carga dinámicamente desde CDN (jsdelivr) para evitar
 * el conflicto con Vite (worker .mjs importa "/@vite/client").
 * Se usa la versión 3.11.174 estable, sin worker (main thread only).
 */
import {
  DocumentoCargado, RequisitoProducto,
  saveToSession, loadFromSession, loadFromSavedStore, generateId,
  MOCK_REQUISITOS_PRODUCTO, MOCK_DOCUMENTOS,
} from './solicitudCreditoStore';
import { AgregarDocumentoModal } from '../originacion/AgregarDocumentoModal';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const LOG = '[ExpedienteTab]';
const CURRENT_USER = '(sesión pendiente)';

/** Bucket principal — mismo que prospectos/clientes */
const BUCKET_EXPEDIENTES = 'make-7e2d13d9-expedientes-electronicos-prospectos';

// ═══════════════════════════════════════════════════════════════════
// Utility: Subir archivo a Supabase Storage
// Estrategia 3-intentos (igual que prospectos):
//   1) supabase.storage.upload directo
//   2) Edge Function fallback
//   3) Blob URL local (último recurso)
// ═══════════════════════════════════════════════════════════════════
async function uploadFileToStorage(
  file: File,
  solicitudId: string,
): Promise<{ nombre: string; url: string; storagePath: string; mime: string; tamanoKB: number } | null> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `expedientes-electronicos/solicitudes/${solicitudId}/${timestamp}_${safeName}`;

  // Detectar MIME robusto: usar file.type, o inferir de extensión
  const extMimeMap: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const detectedMime = file.type || extMimeMap[ext] || 'application/octet-stream';

  console.log(`${LOG} [upload] Subiendo: bucket="${BUCKET_EXPEDIENTES}", path="${storagePath}", size=${file.size}, mime="${detectedMime}" (file.type="${file.type}", ext="${ext}")`);

  // ── Intento 1: supabase.storage.upload directo (usa anon key → necesita RLS) ──
  try {
    console.log(`${LOG} [upload] Intento 1: supabase.storage.upload directo...`);
    const { data, error } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: detectedMime,
      });

    if (!error && data?.path) {
      console.log(`${LOG} [upload] ✅ Intento 1 OK — path="${data.path}"`);
      // Construir URL pública directamente (bucket es public)
      const publicUrl = `https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET_EXPEDIENTES}/${data.path}`;
      let viewUrl = publicUrl;
      try {
        const { data: signedData } = await supabase.storage
          .from(BUCKET_EXPEDIENTES)
          .createSignedUrl(data.path, 3600);
        if (signedData?.signedUrl) viewUrl = signedData.signedUrl;
      } catch (_) {
        console.warn(`${LOG} [upload] createSignedUrl falló, usando URL pública`);
      }
      return {
        nombre: file.name,
        url: viewUrl,
        storagePath: data.path,
        mime: detectedMime,
        tamanoKB: Math.round(file.size / 1024),
      };
    }
    console.warn(`${LOG} [upload] Intento 1 FALLÓ:`, error?.message, '| statusCode:', (error as any)?.statusCode, '| hint:', (error as any)?.hint || 'none');
  } catch (err) {
    console.warn(`${LOG} [upload] Intento 1 excepción:`, err);
  }

  // ── Intento 2: Edge Function fallback (usa SERVICE_ROLE_KEY → bypassa RLS) ──
  try {
    console.log(`${LOG} [upload] Intento 2: Edge Function POST /storage/expedientes/upload...`);
    const formPayload = new FormData();
    formPayload.append('file', file, file.name); // incluir nombre explícitamente
    formPayload.append('prospectoId', solicitudId);

    const res = await fetch(`${API_BASE}/storage/expedientes/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      body: formPayload,
    });

    const responseText = await res.text();
    console.log(`${LOG} [upload] Intento 2 response: HTTP ${res.status}, body=${responseText.substring(0, 500)}`);

    if (res.ok) {
      let json: any;
      try { json = JSON.parse(responseText); } catch { json = {}; }
      console.log(`${LOG} [upload] ✅ Intento 2 OK (Edge Function) — storagePath=${json.storagePath}`);
      const viewUrl = json.url || URL.createObjectURL(file);
      return {
        nombre: json.nombre || file.name,
        url: viewUrl,
        storagePath: json.storagePath || storagePath,
        mime: json.mime || file.type,
        tamanoKB: json.tamanoKB || Math.round(file.size / 1024),
      };
    }
    console.warn(`${LOG} [upload] Intento 2 FALLÓ: HTTP ${res.status} — ${responseText.substring(0, 300)}`);
  } catch (err) {
    console.warn(`${LOG} [upload] Intento 2 excepción:`, err);
  }

  // ── Intento 3: Blob URL local ──
  console.warn(`${LOG} [upload] ⚠️ Todos los intentos fallaron. Guardando blob local.`);
  toast.warning('Archivo guardado localmente', {
    description: 'No se pudo subir a Storage. El archivo estará disponible mientras dure la sesión.',
    duration: 6000,
  });
  return {
    nombre: file.name,
    url: URL.createObjectURL(file),
    storagePath: '',
    mime: detectedMime,
    tamanoKB: Math.round(file.size / 1024),
  };
}

// ═══════════════════════════════════════════════════════════════════
// Utility: Refrescar URL firmada (para documentos de sesiones anteriores)
// ═══════════════════════════════════════════════════════════════════
async function refreshSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  // Intento 1: supabase directo
  try {
    const { data } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .createSignedUrl(storagePath, 3600);
    if (data?.signedUrl) return data.signedUrl;
  } catch (_) {}

  // Intento 2: Edge Function
  try {
    const res = await fetch(`${API_BASE}/storage/expedientes/signed-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ storagePath }),
    });
    const json = await res.json();
    if (json.signedUrl) return json.signedUrl;
  } catch (_) {}

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Componente PreviewModal — regenera URL automáticamente si expiró
// ═══════════════════════════════════════════════════════════════════
interface PreviewModalProps {
  doc: DocumentoCargado;
  fileDataUrl?: string;
  onClose: () => void;
  onUrlRefreshed: (newUrl: string) => void;
}

function PreviewModal({ doc, fileDataUrl, onClose, onUrlRefreshed }: PreviewModalProps) {
  const [currentUrl, setCurrentUrl] = useState(fileDataUrl || doc.url || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const isImage = currentUrl?.startsWith('data:image/') || doc.mime?.startsWith('image/');
  const isPdf = currentUrl?.startsWith('data:application/pdf') || doc.mime === 'application/pdf';

  // Regenerar URL al abrir si hay storagePath
  useEffect(() => {
    const refresh = async () => {
      if (!doc.storagePath || currentUrl?.startsWith('data:')) return;
      
      // Intentar acceder a la URL actual
      try {
        const testRes = await fetch(currentUrl, { method: 'HEAD' });
        if (testRes.ok) return; // URL válida, no regenerar
        console.log(`[PreviewModal] URL expirada (HTTP ${testRes.status}), regenerando...`);
      } catch (err) {
        console.log('[PreviewModal] URL no accesible, regenerando...');
      }

      // Regenerar
      setLoading(true);
      const newUrl = await refreshSignedUrl(doc.storagePath!);
      if (newUrl) {
        setCurrentUrl(newUrl);
        onUrlRefreshed(newUrl);
        console.log('[PreviewModal] URL regenerada OK');
      } else {
        setError(true);
        toast.error('No se pudo regenerar la URL del archivo');
      }
      setLoading(false);
    };
    refresh();
  }, []);

  const handleRefresh = async () => {
    if (!doc.storagePath) return;
    setLoading(true);
    setError(false);
    const newUrl = await refreshSignedUrl(doc.storagePath);
    if (newUrl) {
      setCurrentUrl(newUrl);
      onUrlRefreshed(newUrl);
      toast.success('URL regenerada');
    } else {
      setError(true);
      toast.error('No se pudo regenerar la URL');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-200/50 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
                <path d="M4 1h6l4 4v8a2 2 0 01-2 2H4a2 2 0 01-2-2V3a2 2 0 012-2z" />
                <path d="M10 1v4h4" />
              </svg>
            </div>
            <div>
              <h5 className="text-sm font-semibold text-gray-800">{doc.archivo}</h5>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-gray-400">{doc.tipoDocumento}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="text-[10px] text-gray-400">{doc.tipoArchivo}</span>
                {doc.tamanoKB && <>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span className="text-[10px] text-gray-400">{doc.tamanoKB} KB</span>
                </>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50/50 flex items-center justify-center min-h-[400px]">
          {loading ? (
            <div className="text-center py-10">
              <svg className="animate-spin h-8 w-8 text-[#4A6FA5] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
              <p className="text-sm text-gray-500">Regenerando acceso al archivo...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <svg className="mx-auto mb-3" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#EF4444" strokeWidth="1.5">
                <circle cx="24" cy="24" r="20" />
                <path d="M16 16l16 16M32 16L16 32" strokeLinecap="round" />
              </svg>
              <p className="text-xs text-gray-500 mb-3">No se pudo acceder al archivo</p>
              <button onClick={handleRefresh} className="text-xs text-blue-600 hover:underline">
                Reintentar
              </button>
            </div>
          ) : currentUrl ? (
            isImage ? (
              <img src={currentUrl} alt={doc.archivo} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm m-4" />
            ) : isPdf ? (
              <iframe src={currentUrl} className="w-full h-[70vh] m-4 rounded-lg border border-gray-200" title={doc.archivo} />
            ) : (
              <div className="text-center py-10">
                <svg className="mx-auto mb-3" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                  <path d="M12 6h16l8 8v24a4 4 0 01-4 4H12a4 4 0 01-4-4V10a4 4 0 014-4z" />
                  <path d="M28 6v8h8" />
                </svg>
                <p className="text-xs text-gray-500 mb-2">Vista previa no disponible para {doc.tipoArchivo}</p>
                <a href={currentUrl} download={doc.archivo} className="text-xs text-blue-600 hover:underline">Descargar archivo</a>
              </div>
            )
          ) : doc.storagePath ? (
            <div className="text-center py-10">
              <p className="text-xs text-gray-500 mb-3">El archivo no está disponible</p>
              <button onClick={handleRefresh} className="text-xs text-blue-600 hover:underline">Regenerar acceso</button>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-xs text-gray-500">El archivo fue cargado en una sesión anterior y no está disponible.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-2">
          {currentUrl && !error && (
            <a href={currentUrl} download={doc.archivo}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M6 2v7M3 7l3 3 3-3M2 11h8" />
              </svg>
              Descargar
            </a>
          )}
          <button onClick={onClose} className="px-5 py-2 bg-[#4A6FA5] text-white rounded-lg text-xs font-medium hover:bg-[#3A5A8A] transition-colors shadow-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Utility: Eliminar archivo de Storage
// ═══════════════════════════════════════════════════════════════════
async function deleteFileFromStorage(storagePath: string): Promise<boolean> {
  if (!storagePath) return false;
  try {
    const { error } = await supabase.storage.from(BUCKET_EXPEDIENTES).remove([storagePath]);
    if (!error) { console.log(`${LOG} [delete] ✅ Eliminado de Storage: ${storagePath}`); return true; }
    console.warn(`${LOG} [delete] Error:`, error.message);
  } catch (err) {
    console.warn(`${LOG} [delete] Excepción:`, err);
  }
  // Fallback: Edge Function
  try {
    const res = await fetch(`${API_BASE}/storage/expedientes/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ storagePath }),
    });
    if (res.ok) { console.log(`${LOG} [delete] ✅ Eliminado via Edge Function`); return true; }
  } catch (_) {}
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// DB Row types — forma cruda del JSONB del producto
// ═══════════════════════════════════════════════════════════════════

/** Fila de data.expedientesElectronicos (ExpedientesProductoTab) */
interface ExpedienteDBRow {
  id?: number;
  tipo?: string;
  claveDocumento?: string;
  descripcion?: string;
  obligatorio?: boolean;
  persona?: string;
  fase?: string;
  formato?: string;
  area?: string;
  // Variantes camelCase/snake_case posibles
  tipo_documento?: string;
  prompt_ia?: string;
  promptIA?: string;
  fase_id?: number;
  faseId?: number;
}

/** Fila de data.requisitos (RequisitosTab) */
interface RequisitoDBRow {
  id?: number;
  productId?: number;
  clave?: number;
  requisitoId?: number;
  requisitoNombre?: string;
  area?: string;
  fase?: string;
  obligatorio?: boolean;
  activo?: boolean;
  nota?: string;
  // Variantes
  tipo_documento?: string;
  tipoDocumento?: string;
  descripcion?: string;
  prompt_ia?: string;
  promptIA?: string;
  fase_id?: number;
  faseId?: number;
}

// ═══════════════════════════════════════════════════════════════════
// Mappers: DB row → RequisitoProducto (local)
// ═══════════════════════════════════════════════════════════════════

/** Extraer faseId numérico de un string como "Fase 1", "2", etc. */
function parseFaseId(fase?: string | number): number {
  if (typeof fase === 'number') return fase;
  if (!fase) return 1;
  const match = String(fase).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

/** Helper para extraer promptIA del catálogo usando claveDocumento */
interface CatalogoDocItem {
  id: string;
  clave: string;
  nombre: string;
  activo: boolean;
  promptIA: string;
}

function getPromptIAFromCatalogo(claveDocumento: string | undefined, catalogo: CatalogoDocItem[]): string {
  if (!claveDocumento) return '';
  const match = catalogo.find(d => d.clave === claveDocumento);
  if (match?.promptIA) {
    console.log(`[ExpedienteTab] getPromptIAFromCatalogo: clave="${claveDocumento}" → ENCONTRADO`);
    return match.promptIA;
  }
  console.log(`[ExpedienteTab] getPromptIAFromCatalogo: clave="${claveDocumento}" → NO ENCONTRADO en catálogo`);
  return '';
}

/** Mapea una fila de data.expedientesElectronicos → RequisitoProducto */
function mapExpedienteToLocal(row: ExpedienteDBRow, idx: number, catalogo: CatalogoDocItem[] = []): RequisitoProducto {
  const faseStr = row.fase || 'Fase 1';
  const claveDoc = row.claveDocumento;

  // faseId: normalizar SIEMPRE a número para evitar mismatch string "1" vs número 1
  const rawFaseId = row.faseId ?? row.fase_id;
  const faseId = rawFaseId != null ? parseInt(String(rawFaseId), 10) || parseFaseId(faseStr) : parseFaseId(faseStr);

  // Buscar promptIA: 1) del row mismo, 2) del catálogo usando claveDocumento
  const promptIADelRow = row.promptIA || row.prompt_ia || '';
  const promptIADelCatalogo = getPromptIAFromCatalogo(claveDoc, catalogo);
  const promptIA = promptIADelRow || promptIADelCatalogo;

  return {
    id: row.id ?? (idx + 1),
    fase: faseStr,
    faseId,
    // tipoDocumento: prioridad al nombre descriptivo sobre la clave técnica
    tipoDocumento: (row as any).tipoDocumento || row.tipo_documento || row.tipo || row.claveDocumento || `Doc-${idx + 1}`,
    descripcion: row.descripcion || '',
    area: row.area || 'General',
    obligatorio: row.obligatorio ?? true,
    promptIA,
  };
}

/** Mapea una fila de data.requisitos → RequisitoProducto */
function mapDBRequisitoToLocal(row: RequisitoDBRow, idx: number, catalogo: CatalogoDocItem[] = []): RequisitoProducto {
  const faseStr = row.fase || 'Fase 1';
  return {
    id: row.id ?? (10000 + idx),
    fase: faseStr,
    faseId: row.faseId ?? row.fase_id ?? parseFaseId(faseStr),
    tipoDocumento: row.requisitoNombre || row.tipoDocumento || row.tipo_documento || `Requisito-${idx + 1}`,
    descripcion: row.descripcion || row.nota || '',
    area: row.area || 'General',
    obligatorio: row.obligatorio ?? true,
    promptIA: row.promptIA || row.prompt_ia || '',
  };
}

// ═══════════════════════════════════════════════════════════════════
// Props del componente
// ═══════════════════════════════════════════════════════════════════
interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  faseIdActual: number;
  productoId?: string;
  nombreSolicitante?: string;
  curpCliente?: string;
  rfcCliente?: string;
  fasePromptIA?: string;
  onEnviarSolicitud?: () => void;
}

export function ExpedienteElectronicoTab({ mode, solicitudId, faseIdActual, productoId, nombreSolicitante, curpCliente, rfcCliente, fasePromptIA, onEnviarSolicitud }: Props) {
  // ── State: requisitos del producto (desde DB) ──
  const [requisitosDB, setRequisitosDB] = useState<RequisitoProducto[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [reqSource, setReqSource] = useState<'db' | 'fallback' | 'none'>('none');

  // ── State: catálogo de documentos (para obtener promptIA) ──
  const [catalogoDocs, setCatalogoDocs] = useState<CatalogoDocItem[]>([]);

  // ── Cargar catálogo de documentos ──
  useEffect(() => {
    const CATALOGO_CACHE_KEY = 'solicitud_catalogo_documentos_cache';
    const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos

    const loadCatalogo = async () => {
      // 1) Intentar cache
      try {
        const cached = sessionStorage.getItem(CATALOGO_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRY) {
            setCatalogoDocs(data);
            return;
          }
        }
      } catch { /* ignore */ }

      // 2) Fetch desde API
      try {
        const res = await fetch(`${API_BASE}/catalogos/documentos`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        if (res.ok) {
          const json = await res.json();
          const rows: any[] = json.data || json || [];
          
          // Helper para extraer promptIA (maneja objeto anidado o string directo)
          const extractPromptIA = (data: any): string => {
            if (!data) return '';
            if (typeof data.promptIA === 'object' && data.promptIA !== null) {
              return data.promptIA.promptIA || data.promptIA.instrucciones || data.promptIA.texto || '';
            }
            if (typeof data.promptIA === 'string') return data.promptIA;
            return '';
          };

          const items: CatalogoDocItem[] = rows
            .map((r: any) => ({
              id: r.id,
              clave: r.data?.clave || '',
              nombre: r.data?.nombre || '',
              activo: r.data?.activo !== false,
              promptIA: extractPromptIA(r.data),
            }))
            .filter((d: CatalogoDocItem) => d.activo);

          console.log(`${LOG} Catálogo documentos cargado: ${items.length} items`);
          console.log(`${LOG} Catálogo con promptIA:`, items.filter(i => i.promptIA).length);
          
          setCatalogoDocs(items);
          
          // Guardar en cache
          try {
            sessionStorage.setItem(CATALOGO_CACHE_KEY, JSON.stringify({
              data: items,
              timestamp: Date.now(),
            }));
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.warn(`${LOG} Error cargando catálogo de documentos:`, err);
      }
    };

    loadCatalogo();
  }, []);

  // ── State: documentos cargados ──
  const getInitDocs = useCallback((): DocumentoCargado[] => {
    const s = loadFromSession<DocumentoCargado[]>(solicitudId, 'documentos');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<DocumentoCargado[]>(solicitudId, 'documentos');
    if (saved) return saved;
    // NO cargar MOCK: si la BD no tiene datos, el array queda vacío
    return [];
  }, [solicitudId, mode]);

  const [documentos, setDocumentos] = useState<DocumentoCargado[]>(getInitDocs);
  const [showForm, setShowForm] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<DocumentoCargado>>({});
  const [validatingId, setValidatingId] = useState<number | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrls, setFileDataUrls] = useState<Record<number, string>>({});
  const [previewDocId, setPreviewDocId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [iaResultModal, setIaResultModal] = useState<{ docId: number; result: any } | null>(null);
  const [showIADebug, setShowIADebug] = useState(false);
  const [showAgregarModal, setShowAgregarModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRO = mode === 'ver';

  // ── Persist documentos en sessionStorage (caché local) ──
  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, 'documentos', documentos);
  }, [documentos, solicitudId, isRO]);

  // ── Guardar documentos en BD cada vez que cambian (debounce 800ms) ──
  useEffect(() => {
    if (isRO) return;
    // Solo guardar si es una solicitud persistida (UUID)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const dbId = String(solicitudId);
    if (!UUID_RE.test(dbId)) return;

    const timer = setTimeout(async () => {
      const payload = {
        data: {
          solicitud: {
            expediente_electronico: {
              documentos: documentos.map(doc => ({
                id: doc.id || null,
                fecha_creacion: doc.fecha || null,
                usuario: doc.usuario || null,
                tipo_documento: doc.tipoDocumento || null,
                archivo_adjunto: doc.archivo || null,
                tipo_archivo: doc.tipoArchivo || null,
                nota: doc.nota || null,
                area: doc.area || null,
                fase: doc.fase || null,
                fase_id: doc.faseId || null,
                validado_ia: doc.validadoIA ?? null,
                estatus: doc.estatus || null,
                url: (doc as any).url || null,
                storage_path: (doc as any).storagePath || null,
                storage_bucket: (doc as any).storageBucket || null,
                mime: (doc as any).mime || null,
                tamano_kb: (doc as any).tamanoKB || null,
                ia_motivos: (doc as any).iaMotivos || null,
                ia_extraido: (doc as any).iaExtraido || null,
              })),
            },
          },
        },
      };

      try {
        const res = await fetch(`${API_BASE}/solicitudes-credito/${dbId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          console.log(`${LOG} Expediente guardado en BD (${documentos.length} docs)`);
        } else {
          const err = await res.json().catch(() => ({}));
          console.warn(`${LOG} Error guardando expediente en BD:`, err);
        }
      } catch (err) {
        console.warn(`${LOG} Excepción guardando expediente en BD:`, err);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [documentos, solicitudId, isRO]);

  // ══════════════════════════════════════════════════════════════════
  // FETCH: Requisitos del producto seleccionado desde J_PRODUCTOS
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!productoId) {
      console.log(`${LOG} Sin productoId — sin requisitos`);
      setRequisitosDB([]);
      setReqSource('none');
      return;
    }
    // Validar UUID antes de consultar BD
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productoId)) {
      console.warn(`${LOG} productoId '${productoId}' no es UUID — producto local/fallback sin requisitos en BD`);
      setRequisitosDB([]);
      setReqSource('fallback');
      return;
    }

    let cancelled = false;
    const fetchRequisitos = async () => {
      setLoadingReqs(true);
      const headers = { 'Authorization': `Bearer ${publicAnonKey}` };

      try {
        console.log(`${LOG} Consultando requisitos del producto ${productoId}...`);
        const res = await fetch(`${API_BASE}/productos/${productoId}`, { headers });
        const json = await res.json();

        if (cancelled) return;

        if (!res.ok || json.error) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        // ── Protección JSON.parse: data puede llegar como string ──
        let rawData = json.data?.data;
        if (typeof rawData === 'string') {
          try {
            rawData = JSON.parse(rawData);
            console.log(`${LOG} data era string — parseado a objeto OK`);
          } catch (parseErr) {
            console.warn(`${LOG} data era string pero JSON.parse falló:`, parseErr);
            rawData = {};
          }
        }
        const productData = rawData || {};

        // ── Diagnóstico: mostrar llaves del JSONB para debug ──
        const topKeys = Object.keys(productData);
        console.log(`${LOG} Producto ${productoId} — topKeys del JSONB:`, topKeys);

        // ══════════════════════════════════════════════════════════════
        // PRIORIDAD DE FUENTES:
        //   1) data.expedientesElectronicos → subtab "Requisitos OK" (ExpedientesProductoTab) [Crédito]
        //   2) data.expedientesRegistros → subtab "Requisitos OK" (ExpedientesProductoTab) [Captación]
        //   3) data.expedientes → subtab "Requisitos OK" (ExpedientesProductoTab) [Línea de Crédito]
        //   4) data.requisitos → subtab "Requisitos" (RequisitosTab)
        // Se fusionan ambos arrays si existen, sin duplicados por tipoDocumento.
        // ══════════════════════════════════════════════════════════════
        // FIX: Captación guarda como "expedientesRegistros", Crédito como "expedientesElectronicos", Línea de Crédito como "expedientes"
        const rawExpedientes: ExpedienteDBRow[] = Array.isArray(productData.expedientesElectronicos)
          ? productData.expedientesElectronicos
          : Array.isArray(productData.expedientesRegistros)
            ? productData.expedientesRegistros
            : Array.isArray(productData.expedientes)
              ? productData.expedientes
              : [];
        const rawRequisitos: RequisitoDBRow[] = Array.isArray(productData.requisitos)
          ? productData.requisitos : [];

        const expSource = Array.isArray(productData.expedientesElectronicos)
          ? 'expedientesElectronicos'
          : Array.isArray(productData.expedientesRegistros)
            ? 'expedientesRegistros'
            : Array.isArray(productData.expedientes)
              ? 'expedientes'
              : null;
        console.log(`${LOG} expedientes (fuente: ${expSource || 'ninguna'}):`, rawExpedientes.length > 0 ? `Array(${rawExpedientes.length})` : 'vacío/no existe');
        console.log(`${LOG} requisitos:`, rawRequisitos.length > 0 ? `Array(${rawRequisitos.length})` : 'vacío/no existe');
        
        // DEBUG: Mostrar contenido de rawExpedientes para ver si tiene promptIA
        if (rawExpedientes.length > 0) {
          console.log(`${LOG} [DEBUG] rawExpedientes[0] keys:`, Object.keys(rawExpedientes[0]));
          console.log(`${LOG} [DEBUG] rawExpedientes[0]:`, JSON.stringify(rawExpedientes[0]));
          console.log(`${LOG} [DEBUG] rawExpedientes[0].promptIA:`, rawExpedientes[0]?.promptIA);
        }

        // Mapear cada fuente con su mapper especializado (pasando catálogo para obtener promptIA)
        const mappedExpedientes = rawExpedientes.map((r, idx) => mapExpedienteToLocal(r, idx, catalogoDocs));
        console.log(`${LOG} [DEBUG] mappedExpedientes[0] después del mapeo:`, JSON.stringify(mappedExpedientes[0]));
        console.log(`${LOG} [DEBUG] mappedExpedientes[0].promptIA:`, mappedExpedientes[0]?.promptIA);
        const activosRequisitos = rawRequisitos.filter(r => r.activo !== false);
        const mappedRequisitos = activosRequisitos.map((r, idx) => mapDBRequisitoToLocal(r, idx, catalogoDocs));

        // Fusionar: expedientesElectronicos primero, luego requisitos sin duplicar tipoDocumento
        const seen = new Set(mappedExpedientes.map(r => r.tipoDocumento));
        const merged = [
          ...mappedExpedientes,
          ...mappedRequisitos.filter(r => !seen.has(r.tipoDocumento)),
        ];

        if (merged.length === 0) {
          console.log(`${LOG} Producto ${productoId} no tiene requisitos en ninguna fuente (keys: ${topKeys.join(', ')})`);
          setRequisitosDB([]);
          setReqSource('db');
          setLoadingReqs(false);
          return;
        }

        console.log(`${LOG} ${merged.length} requisitos totales (${mappedExpedientes.length} de "Requisitos OK" + ${mappedRequisitos.filter(r => !seen.has(r.tipoDocumento)).length} de "Requisitos")`);
        if (merged.length > 0) {
          console.log(`${LOG} Primer requisito mapeado:`, JSON.stringify(merged[0]));
        }
        setRequisitosDB(merged);
        setReqSource('db');
      } catch (err: any) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`${LOG} Error al cargar requisitos del producto: ${msg}`);
        setRequisitosDB([]);
        setReqSource('none');
      } finally {
        if (!cancelled) setLoadingReqs(false);
      }
    };

    fetchRequisitos();
    return () => { cancelled = true; };
  }, [productoId, catalogoDocs]);

  // ── Usar requisitos del producto (todos, no solo la fase actual) ──
  const requisitos = requisitosDB;

  // ── Helper: normalizar tipo de documento para comparación robusta ──
  const normTipo = (s: string) => (s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  /**
   * Busca si existe un documento cargado para un requisito dado.
   * Matching case-insensitive + NFD-normalizado para tolerar diferencias
   * de formato entre la plataforma web y banca móvil.
   */
  const findDocForReq = useCallback((req: RequisitoProducto): DocumentoCargado | undefined => {
    const reqNorm = normTipo(req.tipoDocumento);
    return documentos.find(d => normTipo(d.tipoDocumento) === reqNorm);
  }, [documentos]);

  /**
   * Un requisito se considera "cubierto" (para progreso y canAdvance) cuando:
   *   - Existe un documento con el tipo coincidente
   *   - Tiene archivo/url (no es un stub vacío)
   *   - No está Rechazado
   * Documentos en estado 'Pendiente' o 'En Revisión' SÍ cuentan como cubiertos —
   * la validación IA es un proceso aparte que no bloquea el avance de fase.
   */
  const docCubre = useCallback((req: RequisitoProducto): boolean => {
    const doc = findDocForReq(req);
    if (!doc) return false;
    if (doc.estatus === 'Rechazado') return false;
    return !!(doc.url || (doc as any).storagePath || doc.archivo);
  }, [findDocForReq]);

  // Requisitos obligatorios de la fase actual (para barra de progreso y canAdvance)
  const requisitosFaseActual = useMemo(
    () => requisitos.filter(r => r.faseId <= faseIdActual),
    [requisitos, faseIdActual]
  );

  const obligatoriosFaseActual = useMemo(
    () => requisitosFaseActual.filter(r => r.obligatorio),
    [requisitosFaseActual]
  );

  const docsValidadosFase = useMemo(
    () => obligatoriosFaseActual.filter(req => docCubre(req)),
    [obligatoriosFaseActual, docCubre]
  );

  const porcentajeCompletado = obligatoriosFaseActual.length > 0
    ? Math.round((docsValidadosFase.length / obligatoriosFaseActual.length) * 100)
    : 0;

  const canAdvance = obligatoriosFaseActual.every(req => docCubre(req));

  // ── Documentos filtrados por usuario actual y solicitud ──
  // TODO: cuando se implemente auth, filtrar por usuario real de sesión
  // Por ahora se muestran TODOS los documentos de la solicitud
  const documentosFiltrados = useMemo(
    () => documentos,
    [documentos]
  );

  // ── Handlers ──
  const handleAddDoc = async () => {
    if (!newDoc.tipoDocumento) {
      toast.error('Seleccione un tipo de documento');
      return;
    }
    if (!selectedFile) {
      toast.error('Seleccione un archivo');
      return;
    }

    const reqInfo = requisitos.find(r => r.tipoDocumento === newDoc.tipoDocumento);
    const now = new Date();
    const fecha = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // ── Subir archivo a Supabase Storage (estrategia 3-intentos) ──
    setUploading(true);
    const solIdStr = String(solicitudId === 'new' ? `new_${Date.now()}` : solicitudId);
    let uploadResult: Awaited<ReturnType<typeof uploadFileToStorage>> = null;
    try {
      uploadResult = await uploadFileToStorage(selectedFile, solIdStr);
    } catch (err) {
      console.error(`${LOG} Error inesperado en upload:`, err);
    }
    setUploading(false);

    if (!uploadResult) {
      toast.error('Error al subir archivo', { description: 'No se pudo cargar el archivo. Intente de nuevo.' });
      return;
    }

    const doc: DocumentoCargado = {
      id: generateId(),
      fecha,
      usuario: CURRENT_USER,
      tipoDocumento: newDoc.tipoDocumento,
      archivo: uploadResult.nombre,
      tipoArchivo: uploadResult.mime.split('/').pop()?.toUpperCase() || 'PDF',
      nota: newDoc.nota || '',
      area: reqInfo?.area || 'General',
      fase: reqInfo?.fase || `Fase ${faseIdActual}`,
      faseId: reqInfo?.faseId || faseIdActual,
      estatus: 'Pendiente',
      validadoIA: false,
      url: uploadResult.url,
      storagePath: uploadResult.storagePath,
      storageBucket: BUCKET_EXPEDIENTES,
      mime: uploadResult.mime,
      tamanoKB: uploadResult.tamanoKB,
    };

    // También guardar data URL local para preview inmediato
    setFileDataUrls(prev => {
      const updated = { ...prev };
      if ((updated as any).pending) {
        (updated as any)[doc.id] = (updated as any).pending;
        delete (updated as any).pending;
      }
      return updated;
    });

    setDocumentos(prev => [...prev, doc]);
    setNewDoc({});
    setSelectedFile(null);
    setShowForm(false);

    const storageInfo = uploadResult.storagePath
      ? `Subido a Storage (${uploadResult.tamanoKB} KB)`
      : 'Guardado localmente (sesión)';
    toast.success('Documento agregado', { description: `${doc.tipoDocumento} — ${storageInfo}` });
  };

  /**
   * Renderiza la primera página de un PDF a PNG base64.
   * Carga pdf.js dinámicamente desde CDN (jsdelivr) para evitar
   * conflictos con Vite y el worker .mjs.
   */
  const renderPdfToImage = async (pdfUrl: string): Promise<string | null> => {
    try {
      // Cargar pdf.js desde CDN (solo una vez, se cachea)
      if (!(window as any)._pdfjsLoaded) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
          script.onload = () => {
            const pdfjsLib = (window as any).pdfjsLib;
            if (pdfjsLib?.GlobalWorkerOptions) {
              pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
            }
            console.log('[pdf.js] Cargado desde CDN v3.11.174');
            resolve();
          };
          script.onerror = () => reject(new Error('No se pudo cargar pdf.js desde CDN'));
          document.head.appendChild(script);
        });
        (window as any)._pdfjsLoaded = true;
      }

      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) throw new Error('pdf.js no disponible después de carga CDN');

      console.log(`${LOG} [PDF→IMG] Descargando PDF desde: ${pdfUrl.substring(0, 100)}...`);
      const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
      });

      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const scale = 2.0;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo crear contexto 2D del canvas');

      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      console.log(`${LOG} [PDF→IMG] ✅ Página 1 renderizada: ${canvas.width}x${canvas.height}, dataUrl length=${dataUrl.length}`);

      // Cleanup
      page.cleanup();
      pdf.destroy();

      return dataUrl;
    } catch (err: any) {
      console.error(`${LOG} [PDF→IMG] Error:`, err?.message || err);
      return null;
    }
  };

  const handleValidarIA = async (docId: number) => {
    const doc = documentos.find(d => d.id === docId);
    if (!doc) return;

    // Necesita storagePath o url para validar
    if (!doc.storagePath && !doc.url) {
      toast.error('No se puede validar', {
        description: 'El documento no tiene ruta en Storage ni URL. Re-suba el archivo.',
      });
      return;
    }

    // Buscar el promptIA del requisito correspondiente (búsqueda flexible)
    // FIX: Usar coincidencia case-insensitive y trim para evitar problemas de espacios
    const docTipoLower = (doc.tipoDocumento || '').trim().toLowerCase();
    const reqInfo = requisitos.find(r => 
      (r.tipoDocumento || '').trim().toLowerCase() === docTipoLower
    );

    // DEBUG: Log detallado para diagnosticar problemas de matching
    if (requisitos.length > 0) {
      console.log(`${LOG} [IA Debug] Documento a validar: "${doc.tipoDocumento}"`);
      console.log(`${LOG} [IA Debug] Requisitos disponibles (${requisitos.length}):`, requisitos.map(r => ({ tipo: r.tipoDocumento, hasPrompt: !!r.promptIA, prompt: r.promptIA?.substring(0, 50) + '...' })));
      console.log(`${LOG} [IA Debug] Requisito encontrado:`, reqInfo ? { tipo: reqInfo.tipoDocumento, prompt: reqInfo.promptIA } : 'NULO');
    }

    setValidatingId(docId);

    // Detectar si es PDF → pre-renderizar primera página con pdf.js (CDN)
    const isPdf = doc.mime?.includes('pdf') || doc.archivo?.toLowerCase().endsWith('.pdf') || doc.storagePath?.toLowerCase().endsWith('.pdf');
    let imageBase64: string | undefined;

    if (isPdf) {
      const renderToastId = toast.loading('Renderizando PDF para validación IA...', {
        description: 'Convirtiendo primera página a imagen...',
      });
      try {
        // Construir URL del PDF — preferir signed URL
        let pdfUrl: string | null = null;
        if (doc.storagePath) {
          pdfUrl = await refreshSignedUrl(doc.storagePath);
        }
        if (!pdfUrl && doc.url) {
          pdfUrl = doc.url;
        }
        if (!pdfUrl) throw new Error('No hay URL disponible para el PDF');

        const rendered = await renderPdfToImage(pdfUrl);
        toast.dismiss(renderToastId);

        if (!rendered) {
          toast.error('No se pudo renderizar el PDF', {
            description: 'Intente subir una imagen (JPG, PNG) del documento en su lugar.',
            duration: 6000,
          });
          setValidatingId(null);
          return;
        }
        imageBase64 = rendered;
        toast.success('PDF renderizado correctamente', { duration: 2000 });
      } catch (err: any) {
        toast.dismiss(renderToastId);
        toast.error('Error al renderizar PDF', { description: err.message, duration: 6000 });
        setValidatingId(null);
        return;
      }
    }

    const toastId = toast.loading('Validando documento con IA...', {
      description: `${doc.tipoDocumento} — Groq Llama 3.2 Vision${isPdf ? ' (PDF→imagen)' : ''}`,
    });

    try {
      // PRIORIDAD DE PROMPT IA PARA VALIDACIÓN DE DOCUMENTO (botón "Validar IA"):
      // 1. reqInfo?.promptIA — prompt propio del documento (catálogo de documentos)
      // 2. Fallback por defecto
      //
      // NOTA: El prompt de la fase (fasePromptIA) NO se usa aquí.
      // El prompt de la fase se usa ÚNICAMENTE al cambiar de fase ("Enviar Fase").
      let promptAEnviar = reqInfo?.promptIA || `Verificar que el documento sea un "${doc.tipoDocumento}" legítimo y legible.`;
      const promptFuente = reqInfo?.promptIA ? 'DOCUMENTO (catálogo)' : 'FALLBACK';
      // Enriquecer el prompt con datos del cliente para documentos de identidad
      const tipoDocNorm = (doc.tipoDocumento || '').toLowerCase();
      const esINE = tipoDocNorm.includes('ine') || tipoDocNorm.includes('ife') || tipoDocNorm.includes('credencial') || tipoDocNorm.includes('elector');
      const esCSF = tipoDocNorm.includes('situaci') || tipoDocNorm.includes('fiscal') || tipoDocNorm.includes('rfc') || tipoDocNorm.includes('sat');
      if (esINE && curpCliente) {
        promptAEnviar += `\n\nDATOS DEL CLIENTE REGISTRADO:\n- CURP del cliente: ${curpCliente}\nVerifica que el CURP visible en el documento coincida EXACTAMENTE con el CURP registrado del cliente. Si no coincide, el documento debe ser RECHAZADO.`;
      }
      if (esCSF && rfcCliente) {
        promptAEnviar += `\n\nDATOS DEL CLIENTE REGISTRADO:\n- RFC del cliente: ${rfcCliente}\nVerifica que el RFC visible en el documento coincida EXACTAMENTE con el RFC registrado del cliente. Si no coincide, el documento debe ser RECHAZADO.`;
      }
      console.log(`${LOG} [IA] Enviando a /validar-documento-ia`);
      console.log(`${LOG} [IA]   - storagePath: ${doc.storagePath || '(n/a)'}`);
      console.log(`${LOG} [IA]   - tipoDocumento: ${doc.tipoDocumento}`);
      console.log(`${LOG} [IA]   - prompt usado: ${promptAEnviar.substring(0, 100)}...`);
      console.log(`${LOG} [IA]   - fuente prompt: ${promptFuente}`);
      
      const payload: any = {
        storagePath: doc.storagePath,
        promptIA: promptAEnviar,
        tipoDocumento: doc.tipoDocumento,
        nombreSolicitante: nombreSolicitante || '(no proporcionado)',
        curpCliente: curpCliente || '',
        rfcCliente: rfcCliente || '',
      };
      if (imageBase64) {
        payload.imageBase64 = imageBase64;
      }
      // Si no hay imagen renderizada pero hay fileData (no-PDF), enviarlo
      if (!imageBase64 && !isPdf && doc.fileData) {
        payload.imageBase64 = doc.fileData;
      }

      const res = await fetch(`${API_BASE}/validar-documento-ia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      console.log(`${LOG} [IA] Resultado:`, result);

      if (!res.ok || result.error) {
        const rawError = result.error || result.details || `HTTP ${res.status}`;
        // Si Hono no tiene el endpoint de IA, mostrar mensaje amigable en lugar del error técnico
        if (res.status === 404 || rawError.toLowerCase().includes('route not found') || rawError.toLowerCase().includes('not found in hono')) {
          throw new Error('El servicio de validación IA no está disponible. Valide el documento manualmente cambiando el estatus a "Validado".');
        }
        throw new Error(rawError);
      }

      const esValido = result.valido === true;
      const confianza = typeof result.confianza === 'number' ? Math.round(result.confianza * 100) : null;

      // Actualizar documento con resultado IA
      setDocumentos(prev => prev.map(d =>
        d.id === docId
          ? {
              ...d,
              estatus: esValido ? 'Validado' as const : 'Rechazado' as const,
              validadoIA: true,
              iaMotivos: result.motivos || [],
              iaExtraido: result.extraido || {},
              nota: d.nota
                ? d.nota
                : esValido
                  ? `IA: Validado${confianza ? ` (${confianza}%)` : ''}`
                  : `IA: Rechazado — ${(result.motivos || []).join('; ').substring(0, 100)}`,
            }
          : d
      ));

      toast.dismiss(toastId);

      if (esValido) {
        toast.success('Documento VALIDADO por IA', {
          description: `${doc.tipoDocumento}${confianza ? ` — Confianza: ${confianza}%` : ''} — ${(result.motivos || []).slice(0, 2).join('. ')}`,
          duration: 6000,
        });
      } else {
        toast.error('Documento RECHAZADO por IA', {
          description: `${doc.tipoDocumento} — ${(result.motivos || ['Sin motivo específico']).slice(0, 2).join('. ')}`,
          duration: 8000,
        });
      }

      // Mostrar modal con resultado detallado
      setIaResultModal({ docId, result });
    } catch (err: any) {
      console.error(`${LOG} [IA] Error:`, err);
      toast.dismiss(toastId);
      toast.error('Error en validación IA', {
        description: err.message || 'No se pudo contactar al servicio de validación.',
        duration: 6000,
      });
    } finally {
      setValidatingId(null);
    }
  };

  const handleEliminar = (docId: number) => {
    const doc = documentos.find(d => d.id === docId);
    if (!doc) return;
    if (doc.storagePath) {
      deleteFileFromStorage(doc.storagePath);
    }
    setDocumentos(prev => prev.filter(d => d.id !== docId));
    toast.success('Documento eliminado');
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validar tamaño (máx 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('Archivo demasiado grande', { description: 'El tamaño máximo permitido es 10 MB.' });
      return;
    }
    setSelectedFile(file);
    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    setNewDoc(prev => ({ ...prev, archivo: file.name, tipoArchivo: ext }));

    // Leer como data URL para preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      // Se almacena temporalmente con key 'pending' hasta que se asigne el id real en handleAddDoc
      setFileDataUrls(prev => ({ ...prev, pending: dataUrl }));
    };
    reader.readAsDataURL(file);
    toast.info('Archivo seleccionado', { description: `${file.name} (${(file.size / 1024).toFixed(1)} KB)` });
    // Reset input para poder seleccionar el mismo archivo de nuevo
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePreview = (docId: number) => {
    setPreviewDocId(docId);
  };

  /** Re-abrir el modal de resultado IA desde los datos guardados en el documento */
  const handleVerResultadoIA = (doc: DocumentoCargado) => {
    const result: any = {
      valido: doc.estatus === 'Validado',
      confianza: null as number | null,
      motivos: doc.iaMotivos || [],
      extraido: doc.iaExtraido || {},
      tipoDocumento: doc.tipoDocumento,
      modelo: 'Resultado guardado',
      timestamp: null,
      usage: null,
    };
    // Extraer confianza de la nota (e.g. "IA: Validado (85%)")
    const confMatch = doc.nota?.match(/\((\d+)%\)/);
    if (confMatch) result.confianza = parseInt(confMatch[1]) / 100;
    setIaResultModal({ docId: doc.id, result });
  };

  return (
    <div className="border border-gray-200 bg-white">
      {/* ═══ SECCION 1 — Requisitos del Producto ═══ */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-medium text-gray-800">
              Requisitos del Producto
              <span className="text-gray-500 font-normal ml-1">(Fase Actual: {faseIdActual})</span>
            </h4>
            {fasePromptIA && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M9 9h.01M15 9h.01M9.5 15a3.5 3.5 0 0 0 5 0"/></svg>
                Prompt IA de Fase activo
              </span>
            )}
            {reqSource === 'db' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l2 2 4-4" /></svg>
                DB
              </span>
            )}
            {reqSource === 'fallback' && (
              <span className="inline-flex items-center text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                Fallback
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">
              {docsValidadosFase.length}/{obligatoriosFaseActual.length} obligatorios
            </span>
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, porcentajeCompletado)}%`, backgroundColor: porcentajeCompletado >= 100 ? '#10B981' : '#F59E0B' }}
              />
            </div>
            <span className="text-xs text-gray-600">{Math.min(100, porcentajeCompletado)}%</span>
          </div>
        </div>

        {/* Loading state */}
        {loadingReqs && (
          <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-xs">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
            Cargando requisitos del producto...
          </div>
        )}

        {/* Empty state */}
        {!loadingReqs && requisitos.length === 0 && (
          <div className="text-center py-8 border border-gray-200 rounded bg-gray-50">
            <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <path d="M8 4h10l6 6v16a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
              <path d="M18 4v6h6" /><path d="M12 18h8M12 22h4" />
            </svg>
            <p className="text-xs text-gray-500">
              {!productoId
                ? 'Seleccione un producto en el header para ver sus requisitos.'
                : reqSource === 'fallback'
                  ? 'El producto seleccionado es del catálogo local (fallback) y no tiene requisitos configurados en la base de datos. Seleccione un producto registrado en J_PRODUCTOS.'
                  : 'El producto seleccionado no tiene requisitos/documentos configurados en su JSONB (data.requisitos). Verifique la configuración del producto en el módulo Productos → Requisitos.'
              }
            </p>
            {productoId && (
              <p className="text-[10px] text-gray-400 mt-1">
                productoId: {productoId} | source: {reqSource}
              </p>
            )}
          </div>
        )}

        {/* Tabla de requisitos */}
        {!loadingReqs && requisitos.length > 0 && (
          <div className="border border-gray-300 overflow-hidden rounded">
            <table className="w-full text-xs">
              <thead className="bg-[#2E5C91] text-white">
                <tr>
                  <th className="px-2 py-2 text-left font-medium w-16">Fase</th>
                  <th className="px-2 py-2 text-left font-medium">Tipo Documento</th>
                  <th className="px-2 py-2 text-left font-medium">Descripcion</th>
                  <th className="px-2 py-2 text-left font-medium w-24">Area</th>
                  <th className="px-2 py-2 text-center font-medium w-20">Obligatorio</th>
                  <th className="px-2 py-2 text-center font-medium w-16">Prompt IA</th>
                  <th className="px-2 py-2 text-center font-medium w-24">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {requisitos.map((req, idx) => {
                  const docCargado = findDocForReq(req);
                  const esCumplido = docCargado?.estatus === 'Validado';
                  const esFaseActual = req.faseId <= faseIdActual;
                  const esFaseFutura = req.faseId > faseIdActual;

                  return (
                    <tr
                      key={`req-${req.id}-${idx}`}
                      className={`border-b border-gray-200 ${esFaseFutura ? 'opacity-50' : ''}`}
                      style={{
                        backgroundColor: esFaseFutura
                          ? '#F9FAFB'
                          : idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF'
                      }}
                    >
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${
                          esFaseActual
                            ? 'text-blue-700 bg-blue-50 border-blue-200 font-medium'
                            : 'text-gray-500 bg-gray-50 border-gray-200'
                        }`}>
                          {req.fase}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-700 font-medium">{req.tipoDocumento}</td>
                      <td className="px-2 py-1.5 text-gray-600">{req.descripcion || <span className="text-gray-400 italic">Sin descripcion</span>}</td>
                      <td className="px-2 py-1.5 text-gray-700">{req.area}</td>
                      <td className="px-2 py-1.5 text-center">
                        {req.obligatorio ? (
                          <span className="inline-flex items-center gap-0.5 text-red-600 font-medium">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="3" /></svg>
                            Si
                          </span>
                        ) : (
                          <span className="text-gray-400">Opcional</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {req.promptIA ? (
                          <button
                            onClick={() => setExpandedPrompt(expandedPrompt === req.id ? null : req.id)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title={req.promptIA}
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="7" cy="7" r="5.5" />
                              <path d="M5.5 5.5a1.5 1.5 0 113 0c0 .83-.67 1-1.5 1.5V8.5" strokeLinecap="round" />
                              <circle cx="7" cy="10" r="0.5" fill="currentColor" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-gray-300">--</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {esFaseFutura ? (
                          <span className="inline-flex items-center text-gray-400 bg-gray-50 px-2 py-0.5 rounded text-[10px] border border-gray-200">Fase futura</span>
                        ) : esCumplido ? (
                          <button
                            onClick={() => docCargado && handleVerResultadoIA(docCargado)}
                            className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-[10px] border border-green-200 hover:bg-green-100 cursor-pointer transition-colors"
                            title="Clic para ver resultado de validación IA"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 5l2 2 4-4" /></svg>
                            Validado — Ver Resultado
                          </button>
                        ) : docCargado && docCargado.validadoIA && docCargado.estatus === 'Rechazado' ? (
                          <button
                            onClick={() => handleVerResultadoIA(docCargado)}
                            className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-[10px] border border-red-200 hover:bg-red-100 cursor-pointer transition-colors"
                            title="Clic para ver resultado de validación IA"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l4 4M7 3l-4 4" /></svg>
                            Rechazado — Ver Resultado
                          </button>
                        ) : docCargado ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] border border-amber-200">Pendiente IA</span>
                            {!isRO && (
                              <button
                                onClick={() => handleValidarIA(docCargado.id)}
                                disabled={validatingId === docCargado.id}
                                className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors disabled:opacity-50"
                                title="Validar este documento con IA"
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="5" r="4" /><path d="M5 3v4M3 5h4" /></svg>
                                {validatingId === docCargado.id ? 'Validando...' : 'Validar con IA'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center text-gray-500 bg-gray-50 px-2 py-0.5 rounded text-[10px] border border-gray-200">Sin cargar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Prompt IA expandido */}
            {expandedPrompt !== null && (() => {
              const req = requisitos.find(r => r.id === expandedPrompt);
              if (!req?.promptIA) return null;
              return (
                <div className="bg-blue-50 border-t border-blue-200 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#2563EB" strokeWidth="1.5">
                      <circle cx="7" cy="7" r="5.5" />
                      <path d="M7 5v4M7 10.5v.5" strokeLinecap="round" />
                    </svg>
                    <div>
                      <span className="text-[10px] font-semibold text-blue-800 block mb-0.5">
                        Prompt IA para: {req.tipoDocumento}
                      </span>
                      <p className="text-xs text-blue-700">{req.promptIA}</p>
                    </div>
                    <button onClick={() => setExpandedPrompt(null)} className="ml-auto text-blue-400 hover:text-blue-600">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 2l8 8M10 2l-8 8" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Leyenda de fases */}
        {!loadingReqs && requisitos.length > 0 && (
          <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Fase actual o anterior (aplica)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300" /> Fase futura (informativa)
            </span>
            <span className="ml-auto">{requisitos.length} requisito(s) totales del producto</span>
          </div>
        )}

        {/* Boton Enviar Solicitud */}
        {!isRO && requisitos.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <button
              disabled={!canAdvance}
              onClick={() => { if (canAdvance && onEnviarSolicitud) onEnviarSolicitud(); }}
              className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
                canAdvance
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Validar Requisitos / Enviar Solicitud
            </button>
            {!canAdvance && (
              <span className="text-xs text-amber-600">
                Todos los documentos obligatorios de la fase actual deben estar cargados y validados por IA.
              </span>
            )}
          </div>
        )}
      </div>

      {/* ═══ SECCION 2 — Documentos Cargados por el Usuario ═══ */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4A6FA5] to-[#607698] flex items-center justify-center shadow-sm">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 4h12M2 8h12M2 12h8" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-800">Documentos Cargados</h4>
                <p className="text-[10px] text-gray-400 leading-tight">
                  {CURRENT_USER} &middot; {solicitudId === 'new' ? 'Nueva Solicitud' : `Sol. ${solicitudId}`}
                </p>
              </div>
            </div>
            {documentosFiltrados.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-[#4A6FA5] text-white shadow-sm">
                {documentosFiltrados.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIADebug(v => !v)}
              title="Panel de debug de validación IA"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                showIADebug
                  ? 'bg-violet-600 text-white border-violet-700 shadow-sm'
                  : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="5.5" cy="3.5" r="2.5" />
                <path d="M1 10c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
                <path d="M7 2l1.5-1M4 2L2.5 1" />
              </svg>
              Debug IA
            </button>
            {!isRO && (
              <button
                onClick={() => setShowAgregarModal(true)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 shadow-sm bg-[#4A6FA5] text-white hover:bg-[#3A5A8A]"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 1v10M1 6h10" />
                </svg>
                Agregar Documento
              </button>
            )}
          </div>
        </div>

        {/* ── Tabla de documentos cargados ── */}
        {documentosFiltrados.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gradient-to-b from-gray-50/50 to-white">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C4C9D4" strokeWidth="1.5">
                <rect x="4" y="4" width="20" height="20" rx="3" />
                <path d="M4 10h20M10 4v20" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 font-medium mb-1">Sin documentos</p>
            <p className="text-xs text-gray-400">
              {!isRO ? 'Presione "Agregar Documento" para iniciar la carga.' : 'No se han cargado documentos para esta solicitud.'}
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 overflow-hidden rounded-xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tipo Documento</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Archivo</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Formato</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Nota</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fase</th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Estatus</th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documentosFiltrados.map((doc, idx) => (
                    <tr key={doc.id} className="hover:bg-blue-50/40 transition-colors" style={{ backgroundColor: idx % 2 === 1 ? '#FAFBFC' : '#FFFFFF' }}>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        <span className="font-mono text-[11px]">{doc.fecha}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{doc.usuario}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-gray-800">{doc.tipoDocumento}</span>
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => handlePreview(doc.id)} className="inline-flex items-center gap-1 text-[#4A6FA5] hover:text-[#3A5A8A] font-medium cursor-pointer text-left group">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                            <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" />
                            <circle cx="6" cy="6" r="1.5" />
                          </svg>
                          <span className="truncate max-w-[140px] hover:underline">{doc.archivo}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/60">
                          {doc.tipoArchivo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[130px] truncate" title={doc.nota}>
                        {doc.nota || <span className="text-gray-300 italic">--</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{doc.fase}</td>
                      <td className="px-3 py-2 text-center">
                        {doc.validadoIA ? (
                          <button onClick={() => handleVerResultadoIA(doc)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border cursor-pointer hover:shadow-sm transition-all ${
                            doc.estatus === 'Validado' ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' :
                            doc.estatus === 'Rechazado' ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100' :
                            'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${doc.estatus === 'Validado' ? 'bg-emerald-500' : doc.estatus === 'Rechazado' ? 'bg-red-500' : 'bg-amber-500'}`} />
                            {doc.estatus}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border text-amber-600 bg-amber-50/60 border-amber-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {doc.validadoIA && (
                            <button onClick={() => handleVerResultadoIA(doc)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/60 transition-colors">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="8" height="8" rx="1" /><path d="M3 4h4M3 6h2" /></svg>
                              Resultado
                            </button>
                          )}
                          {!doc.validadoIA && !isRO && (
                            <button onClick={() => handleValidarIA(doc.id)} disabled={validatingId === doc.id}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                                validatingId === doc.id ? 'text-blue-400 bg-blue-50 border-blue-200/60 cursor-wait' : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200/60 hover:shadow-sm'
                              }`}>
                              {validatingId === doc.id ? (
                                <svg className="animate-spin h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="5" strokeOpacity="0.25" /><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round" /></svg>
                              ) : (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="5" cy="3.5" r="2.5" /><path d="M1 9c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" strokeLinecap="round" /><path d="M7 2.5l1.5-1M3 2.5L1.5 1.5" strokeLinecap="round" /></svg>
                              )}
                              {validatingId === doc.id ? 'Validando...' : 'Validar IA'}
                            </button>
                          )}
                          {!isRO && (
                            <button onClick={() => handleEliminar(doc.id)} className="inline-flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors">
                              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1.5 3h8M4 3V1.5h3V3M3 3v6.5a1 1 0 001 1h3a1 1 0 001-1V3" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">{documentosFiltrados.length} documento{documentosFiltrados.length !== 1 ? 's' : ''} cargado{documentosFiltrados.length !== 1 ? 's' : ''}</span>
              <span className="text-[10px] text-gray-400">{documentosFiltrados.filter(d => d.validadoIA).length} validado{documentosFiltrados.filter(d => d.validadoIA).length !== 1 ? 's' : ''} por IA</span>
            </div>
          </div>
        )}
      </div>

      <AgregarDocumentoModal
        isOpen={showAgregarModal}
        onClose={() => setShowAgregarModal(false)}
        solicitudId={String(solicitudId)}
        faseIdActual={faseIdActual}
        requisitos={requisitos}
        onAdd={(doc) => {
          const updated = [...documentos, doc];
          setDocumentos(updated);
          saveToSession(solicitudId, 'documentos', updated);
        }}
      />

      {/* ═══ Modal Preview Documento ═══ */}
      {previewDocId !== null && (() => {
        const doc = documentosFiltrados.find(d => d.id === previewDocId);
        if (!doc) return null;
        return (
          <PreviewModal 
            doc={doc} 
            fileDataUrl={fileDataUrls[previewDocId]}
            onClose={() => setPreviewDocId(null)}
            onUrlRefreshed={(newUrl) => {
              setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, url: newUrl } : d));
            }}
          />
        );
      })()}

      {/* ═══ Modal Resultado IA ═══ */}
      {iaResultModal && (() => {
        const r = iaResultModal.result;
        const esValido = r.valido === true;
        const confianza = typeof r.confianza === 'number' ? Math.round(r.confianza * 100) : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIaResultModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden border border-gray-200/50" onClick={e => e.stopPropagation()}>
              <div className={`flex items-center justify-between px-5 py-4 border-b ${esValido ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${esValido ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    {esValido ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#059669" strokeWidth="2.5"><path d="M4 10l4 4 8-8" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#DC2626" strokeWidth="2.5"><path d="M5 5l10 10M15 5l-10 10" /></svg>
                    )}
                  </div>
                  <div>
                    <h5 className={`text-sm font-bold ${esValido ? 'text-emerald-800' : 'text-red-800'}`}>
                      {esValido ? 'Documento VALIDADO' : 'Documento RECHAZADO'}
                    </h5>
                    {confianza !== null && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className={`h-full rounded-full ${confianza >= 80 ? 'bg-emerald-500' : confianza >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${confianza}%` }} />
                        </div>
                        <span className={`text-[10px] font-bold ${confianza >= 80 ? 'text-emerald-600' : confianza >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{confianza}%</span>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => setIaResultModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8" /></svg>
                </button>
              </div>
              <div className="p-5 overflow-auto max-h-[60vh] space-y-4">
                {Array.isArray(r.motivos) && r.motivos.length > 0 && (
                  <div>
                    <h6 className="text-[11px] font-bold text-gray-600 uppercase mb-2">Motivos</h6>
                    <div className="space-y-2">
                      {r.motivos.map((m: string, i: number) => (
                        <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${esValido ? 'bg-emerald-50/60' : 'bg-red-50/60'}`}>
                          <span className={`mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-bold ${esValido ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{i + 1}</span>
                          <span className="text-xs text-gray-700 leading-relaxed">{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {r.extraido && Object.keys(r.extraido).length > 0 && (
                  <div>
                    <h6 className="text-[11px] font-bold text-gray-600 uppercase mb-2">Datos extraídos</h6>
                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 space-y-1.5">
                      {Object.entries(r.extraido).filter(([, v]) => v && v !== '...' && v !== 'N/A').map(([key, val]) => (
                        <div key={key} className="flex items-baseline justify-between py-1.5 border-b border-blue-100/60 last:border-0">
                          <span className="text-[11px] text-blue-600 font-medium">{key.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-gray-800 font-medium ml-4">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                <button onClick={() => setIaResultModal(null)} className="px-5 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 shadow-sm transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}