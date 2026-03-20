import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Eye, Download, Loader2 } from 'lucide-react';
import { useClienteSubtabList } from '@/app/hooks/useClientePersistence';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '../../lib/supabaseClient';
import { currentUser } from '../../data/mockData';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

// Buckets de Supabase Storage (los mismos que Prospectos)
const BUCKET_EXPEDIENTES = 'make-7e2d13d9-expedientes-electronicos-prospectos';
const BUCKET_CONSTANCIAS = 'make-9a76e68a-constancias';

// ═══════════════════════════════════════════════════════════════════
// Mapeo de campos de archivo en data (JSONB) → etiquetas legibles
// Estos campos pueden almacenarse como string (ruta) o como objeto {path, bucket, mime, nombre}
// ═══════════════════════════════════════════════════════════════════
const DATA_FILE_FIELDS: Record<string, string> = {
  constanciaResidencia: 'Constancia de Residencia',
  ineFrente: 'INE Frente',
  ineReverso: 'INE Reverso',
  comprobanteDomicilio: 'Comprobante de Domicilio',
  actaNacimiento: 'Acta de Nacimiento',
  curpDocumento: 'Documento CURP',
  rfcDocumento: 'Documento RFC',
  estadoCuenta: 'Estado de Cuenta',
  comprobanteIngresos: 'Comprobante de Ingresos',
  cartaLaboral: 'Carta Laboral',
  escrituras: 'Escrituras',
  avaluo: 'Avalúo',
  poderNotarial: 'Poder Notarial',
  actaConstitutiva: 'Acta Constitutiva',
  fotoCliente: 'Foto del Cliente',
  firma: 'Firma',
};

/** Campos que NUNCA son archivos — excluidos del escaneo dinámico */
const NON_FILE_FIELDS = new Set([
  'fechaNacimiento', 'fechaOriginacion', 'fechaActivacion', 'fechaAlta',
  'fechaModificacion', 'fechaCreacion', 'fechaVencimiento', 'fechaExpedicion',
  'nombre', 'apellidoPaterno', 'apellidoMaterno', 'denominacionRazonSocial',
  'telefono', 'correoElectronico', 'curp', 'rfc', 'sexo', 'tipo', 'subtipo',
  'estatus', 'estatusCliente', 'estatusProspecto', 'estatusSIC', 'estatusListaNegra',
  'entidadFederativa', 'entidadFederativaNacimiento', 'sucursal', 'clasificacionCliente',
  'institucionGobierno', 'institucionGobiernoId', 'idProspecto', 'idCliente', 'cotizacion',
  'direcciones', 'cotizaciones', 'sic', 'listasNegras', 'expedientesElectronicos',
  'personasRelacionadas', 'perfilTransaccional', 'garantias',
]);

/** Patrones que NO son rutas de archivo */
const DATE_PATTERN = /^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;
const FILE_EXTENSIONS = /\.(png|jpg|jpeg|gif|bmp|webp|pdf|doc|docx|xls|xlsx|csv|txt)$/i;

/** Detecta si un valor es un objeto de archivo con estructura {path, bucket, mime, nombre} */
function isFileObject(val: any): val is { path: string; bucket?: string; mime?: string; nombre?: string } {
  return val && typeof val === 'object' && !Array.isArray(val) && typeof val.path === 'string' && val.path.length > 0;
}

/** Detecta si un valor string parece ser una ruta de archivo */
function looksLikeFilePath(value: any): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (DATE_PATTERN.test(value) || ISO_DATE_PATTERN.test(value)) return false;
  if (FILE_EXTENSIONS.test(value)) return true;
  if (value.includes('/') && !value.startsWith('http') && !value.includes(' ') && value.length > 5) return true;
  return false;
}

// Validaciones
const ALLOWED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.doc,.docx,.xls,.xlsx';
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ═══════════════════════════════════════════════════════════════════
// Interfaz UNIFICADA — idéntica a la de Prospectos para interoperabilidad
// ═══════════════════════════════════════════════════════════════════
interface Expediente {
  id: number;
  nombre: string;
  url: string;
  storagePath?: string;
  storageBucket?: string;
  mime: string;
  tamanoKB: number;
  fechaCarga: string;
  usuarioCarga: string;
  tipoDocumento: string;
  descripcion: string;
  estatus: string;
  observaciones: string;
  _pendingFile?: File;
  _bucket?: string;
}

interface ExpedientesElectronicosProps {
  isView?: boolean;
  clienteId?: string;
  mode?: 'nuevo' | 'editar' | 'ver';
  diagData?: { rawNode: any; loaded: number } | null;
  diagKeys?: string[];
  diagUuid?: string;
  /** Objeto data completo del cliente (JSONB de J_CLIENTES.data) para detectar archivos como constanciaResidencia */
  clienteData?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════
// Utilidades de Storage — compartidas con Prospectos
// ═══════════════════════════════════════════════════════════════════

function mimeFromExt(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  return '';
}

function normalizePath(raw: string): string {
  let p = raw.trim();
  try { p = decodeURIComponent(p); } catch (_) { /* ya decodificado */ }
  while (p.startsWith('/')) p = p.substring(1);
  return p;
}

/** Normaliza cualquier formato de expediente (Prospectos o Clientes legacy) al formato unificado */
function normalizeExpediente(raw: any, index: number): Expediente {
  const r = raw || {};
  
  // Obtener URL — priorizar url sobre fileData
  // NOTA: NO destruir blob URLs aquí — son válidas durante la sesión actual
  // (se invalidan al recargar la página, pero el handleView maneja ese caso)
  let rawUrl = r.url || r.fileData || r.file_data || r.fileUrl || r.file_url || r.archivoUrl || '';
  
  // REGLA INSTITUCIONAL (expediente-electronico-fix.md §4):
  // Si tiene storageBucket + storagePath y NO tiene URL válida → construir URL pública
  const sBucket = r.storageBucket || '';
  const sPath = r.storagePath || r.storage_path || '';
  if (sBucket && sPath && !rawUrl) {
    rawUrl = `https://${projectId}.supabase.co/storage/v1/object/public/${sBucket}/${sPath}`;
  }
  
  return {
    id: r.id ?? index + 1,
    nombre: r.nombre || r.archivo || r.file || r.fileName || r.nombre_archivo || '',
    url: rawUrl,
    storagePath: sPath,
    storageBucket: sBucket,
    mime: r.mime || r.mimeType || '',
    tamanoKB: r.tamanoKB || r.tamano_kb || r.size_kb || 0,
    fechaCarga: r.fechaCarga || r.fecha_carga || r.fechaHora || r.fecha_hora || r.fecha || r.createdAt || '',
    usuarioCarga: r.usuarioCarga || r.usuario_carga || r.usuario || r.user || r.registradoPor || 'Usuario Actual',
    tipoDocumento: r.tipoDocumento || r.tipo_documento || '',
    descripcion: r.descripcion || r.description || '',
    estatus: r.estatus || r.status || 'Pendiente',
    observaciones: r.observaciones || r.observations || '',
    _bucket: r._bucket || '',
  };
}

interface RefreshResult {
  url: string;
  discoveredName?: string;
  discoveredMime?: string;
}

/**
 * Solicita URL firmada fresca — estrategia multi-intento
 * Intento 1: createSignedUrl directo con supabase client
 * Intento 2: download blob como fallback
 * Intento 3: Edge Function como último recurso
 */
async function refreshSignedUrl(rawStoragePath: string, bucket?: string, entityId?: string): Promise<RefreshResult | null> {
  const storagePath = normalizePath(rawStoragePath);
  console.log(`[ClienteExpedientes-refreshSignedUrl] 🔍 raw="${rawStoragePath}" → normalized="${storagePath}", entityId="${entityId || '(none)'}"`);

  if (!storagePath) {
    console.error('[ClienteExpedientes-refreshSignedUrl] ❌ storagePath vacío');
    return null;
  }

  const fileName = storagePath.includes('/') ? storagePath.substring(storagePath.lastIndexOf('/') + 1) : storagePath;
  const SUPABASE_URL = `https://${projectId}.supabase.co`;

  // Generar variantes de rutas
  const pathVariantsRaw: string[] = [storagePath];
  if (entityId) {
    pathVariantsRaw.push(`${entityId}/${fileName}`);
    pathVariantsRaw.push(`expedientes-electronicos/prospectos/${entityId}/${fileName}`);
  }
  pathVariantsRaw.push(fileName);
  pathVariantsRaw.push(`expedientes-electronicos/prospectos/${fileName}`);
  const pathVariants = [...new Set(pathVariantsRaw)];

  // Buckets a probar
  const bucketsToTry = [...new Set([
    bucket || BUCKET_EXPEDIENTES,
    BUCKET_EXPEDIENTES,
    BUCKET_CONSTANCIAS,
  ])];

  // Intento 0 (FASTEST): Public URL directo — buckets son public, no requiere RLS ni firma
  // REGLA INSTITUCIONAL (expediente-electronico-fix.md §4): usar /storage/v1/object/public/
  console.log(`[ClienteExpedientes-refreshSignedUrl] Intento 0 (public URL): ${pathVariants.length} rutas × ${bucketsToTry.length} buckets`);
  for (const pathVar of pathVariants) {
    for (const tryBucket of bucketsToTry) {
      try {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${tryBucket}/${pathVar}`;
        const headResp = await fetch(publicUrl, { method: 'HEAD' });
        if (headResp.ok) {
          const dName = pathVar.split('/').pop() || pathVar;
          console.log(`[ClienteExpedientes-refreshSignedUrl] ✅ Intento 0 OK (public URL) — ${tryBucket}/"${pathVar}"`);
          return { url: publicUrl, discoveredName: dName, discoveredMime: mimeFromExt(dName) };
        }
      } catch (_) { /* silencioso */ }
    }
  }

  // Intento 1: createSignedUrl directo (fallback si bucket no es público)
  console.log(`[ClienteExpedientes-refreshSignedUrl] Intento 1 (signedUrl): ${pathVariants.length} rutas × ${bucketsToTry.length} buckets`);
  for (const pathVar of pathVariants) {
    for (const tryBucket of bucketsToTry) {
      try {
        const { data, error } = await supabase.storage.from(tryBucket).createSignedUrl(pathVar, 3600);
        if (data?.signedUrl && !error) {
          const dName = pathVar.split('/').pop() || pathVar;
          console.log(`[ClienteExpedientes-refreshSignedUrl] ✅ Intento 1 OK — ${tryBucket}/"${pathVar}"`);
          return { url: data.signedUrl, discoveredName: dName, discoveredMime: mimeFromExt(dName) };
        }
      } catch (_) { /* silencioso */ }
    }
  }

  // Intento 2: Download directo (blob)
  console.log(`[ClienteExpedientes-refreshSignedUrl] Intento 2 (download blob)...`);
  for (const pathVar of pathVariants) {
    for (const tryBucket of bucketsToTry) {
      try {
        const { data, error } = await supabase.storage.from(tryBucket).download(pathVar);
        if (data && data.size > 0 && !error) {
          const blobUrl = URL.createObjectURL(data);
          const dName = pathVar.split('/').pop() || pathVar;
          console.log(`[ClienteExpedientes-refreshSignedUrl] ✅ Intento 2 OK — ${tryBucket}/"${pathVar}" (${data.size} bytes)`);
          return { url: blobUrl, discoveredName: dName, discoveredMime: data.type || mimeFromExt(dName) };
        }
      } catch (_) { /* silencioso */ }
    }
  }

  // Intento 3: Edge Function
  try {
    const bodyPayload: Record<string, string> = { storagePath };
    if (bucket) bodyPayload.bucket = bucket;
    if (entityId) bodyPayload.prospectoId = entityId;

    console.log(`[ClienteExpedientes-refreshSignedUrl] Intento 3 (Edge Function)...`);
    const res = await fetch(`${API_BASE}/storage/expedientes/signed-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
      body: JSON.stringify(bodyPayload),
    });
    const json = await res.json();
    if (json.signedUrl) {
      const resolvedName = json.resolvedPath ? (json.resolvedPath.split('/').pop() || fileName) : fileName;
      console.log(`[ClienteExpedientes-refreshSignedUrl] ✅ Intento 3 OK (Edge Function)`);
      return { url: json.signedUrl, discoveredName: resolvedName, discoveredMime: mimeFromExt(resolvedName) };
    }
  } catch (err) {
    console.warn(`[ClienteExpedientes-refreshSignedUrl] Intento 3 falló:`, err);
  }

  console.error(`[ClienteExpedientes-refreshSignedUrl] ❌ TODOS LOS INTENTOS FALLARON para: "${rawStoragePath}"`);
  return null;
}

/** Sube un archivo al Storage */
async function uploadFileToStorage(
  file: File,
  entityId: string,
): Promise<{ nombre: string; url: string; storagePath: string; mime: string; tamanoKB: number } | null> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `expedientes-electronicos/prospectos/${entityId}/${timestamp}_${safeName}`;

  console.log(`[ClienteExpedientes-upload] Subiendo: bucket="${BUCKET_EXPEDIENTES}", path="${storagePath}"`);

  // Intento 1: supabase.storage.upload directo
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

    if (!error && data?.path) {
      console.log(`[ClienteExpedientes-upload] ✅ Intento 1 OK — path="${data.path}"`);
      // Bucket es public → construir URL pública directa (más confiable que signed URL)
      const SUPABASE_URL = `https://${projectId}.supabase.co`;
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_EXPEDIENTES}/${data.path}`;
      console.log(`[ClienteExpedientes-upload] URL pública: ${publicUrl}`);

      return {
        nombre: file.name,
        url: publicUrl,
        storagePath: data.path,
        mime: file.type || 'application/octet-stream',
        tamanoKB: Math.round(file.size / 1024),
      };
    }
    console.warn(`[ClienteExpedientes-upload] Intento 1 error:`, error?.message);
  } catch (err) {
    console.warn(`[ClienteExpedientes-upload] Intento 1 excepción:`, err);
  }

  // Intento 2: Edge Function fallback
  try {
    console.log(`[ClienteExpedientes-upload] Intento 2 (Edge Function)...`);
    const formPayload = new FormData();
    formPayload.append('file', file);
    formPayload.append('prospectoId', entityId);

    const res = await fetch(`${API_BASE}/storage/expedientes/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      body: formPayload,
    });

    if (res.ok) {
      const json = await res.json();
      console.log(`[ClienteExpedientes-upload] ✅ Intento 2 OK (Edge Function)`);
      // Si la Edge Function no devuelve URL, crear blob local
      const viewUrl = json.url || URL.createObjectURL(file);
      return {
        nombre: json.nombre || file.name,
        url: viewUrl,
        storagePath: json.storagePath || storagePath,
        mime: json.mime || file.type,
        tamanoKB: json.tamanoKB || Math.round(file.size / 1024),
      };
    }
  } catch (err) {
    console.warn(`[ClienteExpedientes-upload] Intento 2 excepción:`, err);
  }

  // Intento 3: blob URL local como último recurso (archivo NO en Storage)
  console.warn(`[ClienteExpedientes-upload] ⚠️ Storage fallaron, guardando como blob URL local`);
  const blobUrl = URL.createObjectURL(file);
  toast.warning('Archivo guardado localmente', {
    description: 'No se pudo subir a Storage. El archivo estará disponible mientras dure la sesión.',
    duration: 6000,
  });
  return {
    nombre: file.name,
    url: blobUrl,
    storagePath: '', // vacío porque NO está en Storage
    mime: file.type || 'application/octet-stream',
    tamanoKB: Math.round(file.size / 1024),
  };
}

// ═══════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════
export function ExpedientesElectronicos({ isView = false, clienteId, mode = 'nuevo', diagData = null, diagKeys = [], diagUuid = '', clienteData = {} }: ExpedientesElectronicosProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedExpedientes, setSelectedExpedientes] = useState<number[]>([]);
  const [showDiag, setShowDiag] = useState(false);
  const [showWmdModal, setShowWmdModal] = useState(false);
  const [wmdUrl, setWmdUrl] = useState('');
  const [showAdjuntarOptions, setShowAdjuntarOptions] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [currentFile, setCurrentFile] = useState<Expediente | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [normalized, setNormalized] = useState(false);
  
  // Persistencia en sessionStorage via hook
  const { 
    items: rawExpedientes, 
    setItems: setExpedientes 
  } = useClienteSubtabList<Expediente>(
    clienteId || 'temp', 
    'expedientes', 
    []
  );

  // ── Normalizar datos al cargar (una sola vez) ──
  useEffect(() => {
    if (normalized || rawExpedientes.length === 0) return;
    
    const needsNormalization = rawExpedientes.some((exp: any) => {
      // Detectar formato Clientes legacy (archivo/fileData) o datos sin normalizar
      return (exp.archivo && !exp.nombre) || (exp.fileData && !exp.url) || (exp.fechaHora && !exp.fechaCarga);
    });
    
    if (needsNormalization) {
      console.log(`[ClienteExpedientes] 🔄 Normalizando ${rawExpedientes.length} expedientes`);
      const normalizedItems = rawExpedientes.map((exp: any, idx: number) => normalizeExpediente(exp, idx));
      setExpedientes(normalizedItems);
    }
    setNormalized(true);
  }, [rawExpedientes, normalized, setExpedientes]);

  // Vista normalizada para rendering
  const expedientes = useMemo(() => {
    return rawExpedientes.map((exp: any, idx: number) => normalizeExpediente(exp, idx));
  }, [rawExpedientes]);

  // ─── Archivos detectados en data (JSONB) del cliente ───────────────
  // Escanea clienteData buscando campos de archivo (string paths o objetos {path, bucket, mime, nombre})
  const archivosEnData = useMemo(() => {
    if (!clienteData || Object.keys(clienteData).length === 0) return [];
    const result: { campo: string; label: string; storagePath: string; bucket: string; mime: string; nombre: string }[] = [];

    // 1. Buscar campos conocidos (DATA_FILE_FIELDS)
    for (const [key, label] of Object.entries(DATA_FILE_FIELDS)) {
      const val = clienteData[key];
      if (isFileObject(val)) {
        // Formato objeto: { path, bucket, mime, nombre }
        result.push({
          campo: key,
          label,
          storagePath: val.path,
          bucket: val.bucket || BUCKET_CONSTANCIAS,
          mime: val.mime || mimeFromExt(val.nombre || val.path),
          nombre: val.nombre || val.path.split('/').pop() || key,
        });
      } else if (looksLikeFilePath(val)) {
        // Formato string legacy: "residencia/path/to/file.png"
        const fileName = (val as string).split('/').pop() || (val as string);
        result.push({
          campo: key,
          label,
          storagePath: val as string,
          bucket: (val as string).startsWith('expedientes-electronicos/') ? BUCKET_EXPEDIENTES : BUCKET_CONSTANCIAS,
          mime: mimeFromExt(fileName),
          nombre: fileName,
        });
      }
    }

    // 2. Buscar campos desconocidos que parezcan archivos
    for (const [key, val] of Object.entries(clienteData)) {
      if (DATA_FILE_FIELDS[key]) continue;
      if (NON_FILE_FIELDS.has(key)) continue;
      if (isFileObject(val)) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
        result.push({
          campo: key,
          label,
          storagePath: val.path,
          bucket: val.bucket || BUCKET_CONSTANCIAS,
          mime: val.mime || mimeFromExt(val.nombre || val.path),
          nombre: val.nombre || val.path.split('/').pop() || key,
        });
      } else if (looksLikeFilePath(val)) {
        if (Array.isArray(val) || (typeof val === 'object' && val !== null)) continue;
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
        const fileName = (val as string).split('/').pop() || (val as string);
        result.push({
          campo: key,
          label,
          storagePath: val as string,
          bucket: (val as string).startsWith('expedientes-electronicos/') ? BUCKET_EXPEDIENTES : BUCKET_CONSTANCIAS,
          mime: mimeFromExt(fileName),
          nombre: fileName,
        });
      }
    }

    if (result.length > 0) {
      console.log(`[ClienteExpedientes] Archivos detectados en data JSONB: ${result.length}`, result.map(r => r.campo));
    }
    return result;
  }, [clienteData]);

  // ─── Convertir archivos de data JSONB a Expedientes virtuales ─────
  const dataFileExpedientes = useMemo<Expediente[]>(() => {
    const SUPABASE_URL = `https://${projectId}.supabase.co`;
    return archivosEnData.map((item, idx) => {
      // Construir URL pública directa desde bucket + path
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${item.bucket}/${item.storagePath}`;
      return {
        id: -(idx + 1), // IDs negativos para no colisionar con expedientes regulares
        nombre: item.nombre,
        url: publicUrl,
        storagePath: item.storagePath,
        storageBucket: item.bucket,
        mime: item.mime,
        tamanoKB: 0,
        fechaCarga: '—',
        usuarioCarga: '—',
        tipoDocumento: item.label,
        descripcion: `Campo JSONB: ${item.campo}`,
        estatus: 'Activo',
        observaciones: '',
        _bucket: item.bucket,
      };
    });
  }, [archivosEnData]);

  // ─── Lista combinada: archivos de data JSONB + expedientes regulares ─
  const allExpedientes = useMemo(() => {
    return [...dataFileExpedientes, ...expedientes];
  }, [expedientes, dataFileExpedientes]);

  const getNextId = () => Math.max(...allExpedientes.map(e => e.id), 0) + 1;

  // ── Selección ──
  const handleSelectAll = (checked: boolean) => {
    setSelectedExpedientes(checked ? allExpedientes.map(e => e.id) : []);
  };

  const handleSelectExpediente = (id: number, checked: boolean) => {
    setSelectedExpedientes(prev =>
      checked ? [...prev, id] : prev.filter(expId => expId !== id),
    );
  };

  // ── Subir archivo desde equipo (idéntico a Prospectos) ──
  const handleFileSelect = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(`El archivo excede el tamaño máximo (${sizeMB} MB > ${MAX_FILE_SIZE_MB} MB)`);
      return;
    }

    const fechaCarga = new Date().toISOString().split('T')[0];
    const entityId = diagUuid || clienteId || 'temp';

    setUploading(true);
    const result = await uploadFileToStorage(file, entityId);
    setUploading(false);

    if (result) {
      const newExp: Expediente = {
        id: getNextId(),
        nombre: result.nombre,
        url: result.url,
        storagePath: result.storagePath,
        // REGLA INSTITUCIONAL (expediente-electronico-fix.md §3):
        // Guardar storageBucket en el JSON para que la construcción de URL sea correcta
        storageBucket: result.storagePath ? BUCKET_EXPEDIENTES : '',
        mime: result.mime,
        tamanoKB: result.tamanoKB,
        fechaCarga,
        usuarioCarga: currentUser.name || 'Usuario Actual',
        tipoDocumento: '',
        descripcion: '',
        estatus: 'Pendiente',
        observaciones: '',
      };
      setExpedientes(prev => [...prev, newExp]);
      toast.success(`Archivo "${result.nombre}" subido exitosamente`);
    }
  };

  // ── Ver archivo (con refresh de URL firmada, idéntico a Prospectos) ──
  const handleView = async (exp: Expediente) => {
    // base64 data URL → mostrar directo
    if (exp.url && exp.url.startsWith('data:')) {
      console.log(`[ClienteExpedientes-handleView] Usando data URL directa`);
      setCurrentFile(exp);
      setShowViewer(true);
      return;
    }

    // blob URL válida (sesión actual) → mostrar directo
    if (exp.url && exp.url.startsWith('blob:')) {
      console.log(`[ClienteExpedientes-handleView] Usando blob URL directa`);
      setCurrentFile(exp);
      setShowViewer(true);
      return;
    }

    // URL http sin storagePath → mostrar directo (no es archivo de Storage)
    if (exp.url && exp.url.startsWith('http') && !exp.storagePath) {
      console.log(`[ClienteExpedientes-handleView] Usando URL http directa (sin storagePath)`);
      setCurrentFile(exp);
      setShowViewer(true);
      return;
    }

    // URL pública de Storage → validar con HEAD antes de mostrar; si falla, cae al refresh
    if (exp.url && exp.url.includes('/object/public/') && exp.storagePath) {
      try {
        console.log(`[ClienteExpedientes-handleView] Validando URL pública con HEAD...`);
        setViewerLoading(true);
        const headResp = await fetch(exp.url, { method: 'HEAD' });
        setViewerLoading(false);
        if (headResp.ok) {
          console.log(`[ClienteExpedientes-handleView] ✅ URL pública válida`);
          setCurrentFile(exp);
          setShowViewer(true);
          return;
        }
        console.warn(`[ClienteExpedientes-handleView] ⚠️ URL pública ${headResp.status}, fallback a refreshSignedUrl`);
      } catch (err) {
        setViewerLoading(false);
        console.warn(`[ClienteExpedientes-handleView] ⚠️ HEAD falló, fallback a refreshSignedUrl`, err);
      }
      // NO return — cae al bloque de refreshSignedUrl abajo
    }

    // Si tiene storagePath → refrescar URL firmada desde Storage
    if (exp.storagePath) {
      setViewerLoading(true);
      const entityId = diagUuid || clienteId || '';
      // REGLA INSTITUCIONAL: usar storageBucket del JSON (si existe) como bucket primario
      const bucketToUse = exp.storageBucket || exp._bucket;
      const result = await refreshSignedUrl(exp.storagePath, bucketToUse, entityId);
      setViewerLoading(false);

      if (result) {
        const updatedExp = { ...exp, url: result.url };
        if (result.discoveredMime) updatedExp.mime = result.discoveredMime;
        if (result.discoveredName && exp.nombre && !/\.\w{2,5}$/.test(exp.nombre)) {
          updatedExp.nombre = result.discoveredName;
        }
        console.log(`[ClienteExpedientes-handleView] Archivo resuelto: "${updatedExp.nombre}", mime="${updatedExp.mime}"`);
        setCurrentFile(updatedExp);
        setShowViewer(true);
        return;
      }

      // Si falla pero tiene URL existente, intentar con esa
      if (exp.url) {
        console.log(`[ClienteExpedientes-handleView] Refresh falló, usando URL existente`);
        setCurrentFile(exp);
        setShowViewer(true);
        return;
      }

      toast.error('Archivo no encontrado en Storage', {
        description: `Ruta: ${exp.storagePath}`,
        duration: 8000,
      });
      return;
    }

    // Sin URL ni storagePath
    if (!exp.url) {
      toast.error('No hay archivo disponible para visualizar');
      return;
    }

    // Fallback: mostrar con lo que tengamos
    setCurrentFile(exp);
    setShowViewer(true);
  };

  // ── Descargar archivo ──
  const handleDownload = async (exp: Expediente) => {
    if (!exp.url && !exp.storagePath) {
      toast.error('No hay archivo disponible para descargar');
      return;
    }

    let downloadUrl = exp.url;

    // base64 o blob → descargar directamente
    if (downloadUrl && (downloadUrl.startsWith('data:') || downloadUrl.startsWith('blob:'))) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = exp.nombre || 'archivo';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Si tiene storagePath, intentar refresh (incluso si tiene URL pública — puede fallar)
    if (exp.storagePath) {
      // Si tiene URL pública, validar primero con HEAD
      let publicOk = false;
      if (downloadUrl && downloadUrl.includes('/object/public/')) {
        try {
          const headResp = await fetch(downloadUrl, { method: 'HEAD' });
          publicOk = headResp.ok;
        } catch (_) { /* silencioso */ }
      }
      if (!publicOk) {
        const entityId = diagUuid || clienteId || '';
        const bucketToUse = exp.storageBucket || exp._bucket;
        const result = await refreshSignedUrl(exp.storagePath, bucketToUse, entityId);
        if (result) {
          downloadUrl = result.url;
        }
      }
    }

    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    } else {
      toast.error('Archivo no encontrado en Storage');
    }
  };

  // ── Eliminar seleccionados ──
  const handleDelete = () => {
    if (selectedExpedientes.length === 0) {
      toast.error('Por favor seleccione al menos un registro para eliminar');
      return;
    }

    const expedientesAEliminar = expedientes.filter(e => selectedExpedientes.includes(e.id));
    const expedientesNoPendientes = expedientesAEliminar.filter(e => e.estatus !== 'Pendiente');

    if (expedientesNoPendientes.length > 0) {
      toast.error('Solo se pueden eliminar registros con estatus "Pendiente"');
      return;
    }

    setExpedientes(prev => prev.filter(e => !selectedExpedientes.includes(e.id)));
    const count = selectedExpedientes.length;
    setSelectedExpedientes([]);
    toast.success(`${count} expediente${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  // ── Agregar desde Web ──
  const handleAddFromWeb = () => {
    if (!wmdUrl.trim()) return;
    const newExp: Expediente = {
      id: getNextId(),
      nombre: wmdUrl.split('/').pop() || wmdUrl,
      url: wmdUrl,
      storagePath: '',
      mime: 'text/html',
      tamanoKB: 0,
      fechaCarga: new Date().toISOString().split('T')[0],
      usuarioCarga: currentUser.name || 'Usuario Actual',
      tipoDocumento: 'Documento web',
      descripcion: '',
      estatus: 'Pendiente',
      observaciones: '',
    };
    setExpedientes(prev => [...prev, newExp]);
    setShowWmdModal(false);
    setWmdUrl('');
    toast.success('Documento agregado exitosamente');
  };

  // ── Detectar tipo de archivo para preview ──
  const getFileType = (exp: Expediente) => {
    const extFrom = (s: string) => {
      if (!s) return '';
      const clean = s.split('?')[0].split('#')[0];
      const dot = clean.lastIndexOf('.');
      const slash = clean.lastIndexOf('/');
      return (dot > slash && dot > 0) ? clean.substring(dot + 1).toLowerCase() : '';
    };
    const ext = extFrom(exp.nombre) || extFrom(exp.storagePath || '') || extFrom(exp.url || '') || '';
    const mime = exp.mime || '';

    // También detectar desde data URL
    const url = exp.url || '';
    const isBase64Image = url.startsWith('data:image/');
    const isBase64PDF = url.startsWith('data:application/pdf');

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const isImage = imageExts.includes(ext) || mime.startsWith('image/') || isBase64Image;
    const isPDF = ext === 'pdf' || mime === 'application/pdf' || isBase64PDF;
    return { isImage, isPDF, canPreview: isImage || isPDF };
  };

  return (
    <div className="flex-1">
      {/* ═══ PANEL DIAGNÓSTICO ═══ */}
      {(mode === 'editar' || mode === 'ver') && diagData && (
        <div className="mb-3 border border-amber-300 rounded bg-amber-50">
          <button
            onClick={() => setShowDiag(!showDiag)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <span className="font-semibold">DIAGNÓSTICO DB — EXPEDIENTES</span>
              <span className="font-normal">
                — Fuente: {diagData.rawNode ? `encontrado (${Array.isArray(diagData.rawNode) ? diagData.rawNode.length : 1} crudo)` : 'NO encontrado'}
                {` | Mostradas: ${allExpedientes.length}`}
                {` | UUID: ${diagUuid}`}
              </span>
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showDiag ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {showDiag && (
            <div className="px-3 pb-3 space-y-2 border-t border-amber-200">
              <div className="mt-2">
                <span className="text-xs font-semibold text-amber-900">Keys en _rawData ({diagKeys.length}):</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {diagKeys.map(k => (
                    <span key={k} className={`px-1.5 py-0.5 text-[10px] rounded ${['expedientesElectronicos','expedientes_electronicos','expedientes','documents','archivos'].includes(k) ? 'bg-green-200 text-green-800 font-bold' : 'bg-gray-200 text-gray-700'}`}>
                      {k}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-amber-900">JSON crudo de "expedientes" de J_CLIENTES.data:</span>
                <pre className="mt-1 p-2 bg-white border border-amber-200 rounded text-[10px] text-gray-800 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                  {diagData.rawNode
                    ? JSON.stringify(diagData.rawNode, null, 2)
                    : '(null — no existe nodo de expedientes en el JSONB)'}
                </pre>
              </div>
              {!diagData.rawNode && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  <strong>No se encontró nodo de expedientes en _rawData.</strong> Keys que SÍ existen: {diagKeys.join(', ') || '(ninguna)'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Encabezado institucional */}
      <div className="bg-[rgb(239,246,255)] border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">EXPEDIENTES ELECTRÓNICOS</span>
        {!isView && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdjuntarOptions(!showAdjuntarOptions)}
              className="px-4 py-1.5 btn-accent-theme text-white text-xs font-medium rounded hover:bg-accent-hover-theme"
            >
              Nuevo
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-1.5 btn-accent-theme text-white text-xs font-medium rounded hover:bg-accent-hover-theme"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Opciones de adjuntar */}
      {showAdjuntarOptions && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-700 font-medium">Adjuntar desde:</span>
          <label className="px-3 py-1.5 border border-gray-300 text-xs rounded bg-gray-200 text-gray-600 cursor-pointer hover:bg-gray-300">
            Equipo
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden"
              accept={ALLOWED_EXTENSIONS}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file);
                  e.target.value = '';
                  setShowAdjuntarOptions(false);
                }
              }}
            />
          </label>
          <button 
            onClick={() => {
              setShowWmdModal(true);
              setShowAdjuntarOptions(false);
            }}
            className="px-3 py-1.5 border border-gray-300 text-xs rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
          >
            Web
          </button>
        </div>
      )}

      {/* Indicador de carga */}
      {uploading && (
        <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded flex items-center gap-2 text-xs text-blue-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          Subiendo archivo a Supabase Storage...
        </div>
      )}

      {/* Tabla de Expedientes */}
      <div className="overflow-hidden border border-gray-300 bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {!isView && (
                <th className="border-b border-gray-300 px-2 py-1.5 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allExpedientes.length > 0 && selectedExpedientes.length === allExpedientes.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="cursor-pointer"
                  />
                </th>
              )}
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Fecha de Carga</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Usuario</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Archivo</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700 w-16">KB</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Tipo de Documento</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Descripción</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Estatus</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Observaciones</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-center text-xs font-medium text-gray-700 w-28">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {allExpedientes.length === 0 ? (
              <tr>
                <td colSpan={isView ? 9 : 10} className="px-4 py-6 text-center text-xs text-gray-500 italic">
                  No hay expedientes registrados.{!isView && ' Haga clic en "Nuevo" para agregar un expediente.'}
                </td>
              </tr>
            ) : (
              allExpedientes.map(expediente => (
                <tr
                  key={expediente.id}
                  className={`hover:bg-gray-50 ${selectedExpedientes.includes(expediente.id) ? 'bg-blue-50' : ''}`}
                >
                  {!isView && (
                    <td className="border-b border-gray-200 px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedExpedientes.includes(expediente.id)}
                        onChange={(e) => handleSelectExpediente(expediente.id, e.target.checked)}
                        className="cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">
                    {expediente.fechaCarga || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">
                    {expediente.usuarioCarga || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">
                    <div className="flex items-center gap-1">
                      {expediente._pendingFile && (
                        <span className="inline-block w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" title="Pendiente de subir" />
                      )}
                      {expediente.storagePath && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 flex-shrink-0" title="En Supabase Storage">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>
                        </svg>
                      )}
                      <span className="truncate max-w-[160px]" title={expediente.nombre}>
                        {expediente.nombre || <span className="text-gray-400 italic">—</span>}
                      </span>
                    </div>
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-500">
                    {expediente.tamanoKB > 0 ? expediente.tamanoKB : '—'}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    <select
                      value={expediente.tipoDocumento}
                      onChange={(e) => {
                        setExpedientes(prev => prev.map(exp =>
                          exp.id === expediente.id ? { ...exp, tipoDocumento: e.target.value } : exp
                        ));
                      }}
                      disabled={isView}
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Seleccione...</option>
                      <option>Credencial de elector</option>
                      <option>Pasaporte</option>
                      <option>Licencia de conducir</option>
                      <option>Cartilla militar</option>
                      <option>Visa</option>
                      <option>Tarjeta de residencia</option>
                      <option>Cédula de ciudadanía</option>
                      <option>Registro Federal de Contribuyentes (RFC)</option>
                      <option>Número de Identificación Personal (NIP)</option>
                      <option>Documento migratorio</option>
                      <option>Documento de propiedad</option>
                      <option>Estado de cuenta bancario</option>
                      <option>Comprobante de domicilio</option>
                      <option>Certificado de nacimiento</option>
                      <option>Certificado de matrimonio</option>
                      <option>Certificado de defunción</option>
                      <option>Documento web</option>
                    </select>
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    <input
                      type="text"
                      value={expediente.descripcion}
                      onChange={(e) => {
                        setExpedientes(prev => prev.map(exp =>
                          exp.id === expediente.id ? { ...exp, descripcion: e.target.value } : exp
                        ));
                      }}
                      disabled={isView}
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    <select
                      value={expediente.estatus}
                      onChange={(e) => {
                        setExpedientes(prev => prev.map(exp =>
                          exp.id === expediente.id ? { ...exp, estatus: e.target.value } : exp
                        ));
                      }}
                      disabled={isView}
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option>Pendiente</option>
                      <option>Aprobado</option>
                      <option>Rechazado</option>
                    </select>
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    <input
                      type="text"
                      value={expediente.observaciones}
                      onChange={(e) => {
                        setExpedientes(prev => prev.map(exp =>
                          exp.id === expediente.id ? { ...exp, observaciones: e.target.value } : exp
                        ));
                      }}
                      disabled={isView}
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(expediente);
                        }}
                        className="inline-flex items-center justify-center px-1.5 py-1 btn-accent-theme text-xs rounded hover:bg-accent-hover-theme"
                        title="Ver archivo"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(expediente);
                        }}
                        className="inline-flex items-center justify-center px-1.5 py-1 btn-accent-theme text-xs rounded hover:bg-accent-hover-theme"
                        title="Descargar archivo"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Web */}
      {showWmdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">Agregar Documento desde Web</h3>
              <button onClick={() => { setShowWmdModal(false); setWmdUrl(''); }} className="text-white hover:text-gray-200">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  URL del Documento <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={wmdUrl}
                  onChange={(e) => setWmdUrl(e.target.value)}
                  placeholder="https://ejemplo.com/documento.pdf"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddFromWeb(); }}
                />
                <p className="text-xs text-gray-500 mt-1">Ingrese la URL completa del documento</p>
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button onClick={() => { setShowWmdModal(false); setWmdUrl(''); }} className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium">Cancelar</button>
              <button onClick={handleAddFromWeb} className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90 font-medium" disabled={!wmdUrl.trim()}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {viewerLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl">
            <Loader2 className="w-5 h-5 animate-spin text-accent-theme" />
            <span className="text-sm text-gray-700">Obteniendo archivo...</span>
          </div>
        </div>
      )}

      {/* Modal visor de archivo */}
      {showViewer && currentFile && (() => {
        const { isImage, isPDF, canPreview } = getFileType(currentFile);
        const isExternalUrl = (currentFile.url || '').startsWith('http');

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-accent-theme" />
                  <h3 className="text-sm font-semibold text-gray-800">Visualizador de Documento</h3>
                </div>
                <button onClick={() => { setShowViewer(false); setCurrentFile(null); }} className="text-gray-500 hover:text-gray-700">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                  </svg>
                </button>
              </div>

              {/* Info del archivo */}
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-medium text-gray-700">Archivo:</span>
                    <span className="ml-2 text-gray-600">{currentFile.nombre || '(sin nombre)'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tipo:</span>
                    <span className="ml-2 text-gray-600">{currentFile.tipoDocumento || currentFile.mime || '—'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Fecha:</span>
                    <span className="ml-2 text-gray-600">{currentFile.fechaCarga || '—'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tamaño:</span>
                    <span className="ml-2 text-gray-600">{currentFile.tamanoKB > 0 ? `${currentFile.tamanoKB} KB` : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Contenedor del visor */}
              <div className="flex-1 overflow-auto p-6 bg-gray-100" style={{ minHeight: '400px' }}>
                {canPreview ? (
                  <div className="bg-white rounded border border-gray-300 flex items-center justify-center" style={{ minHeight: '350px' }}>
                    {isImage && currentFile.url && (
                      <img
                        src={currentFile.url}
                        alt={currentFile.nombre}
                        className="object-contain"
                        style={{ maxWidth: '100%', maxHeight: '60vh' }}
                        onError={(e) => {
                          console.error(`[ClienteExpedientes-viewer] ❌ Error cargando imagen: ${currentFile.url}`);
                          toast.error('No se pudo cargar la imagen');
                        }}
                        onLoad={() => {
                          console.log(`[ClienteExpedientes-viewer] ✅ Imagen cargada: ${currentFile.nombre}`);
                        }}
                      />
                    )}
                    {isPDF && currentFile.url && (
                      <iframe
                        src={currentFile.url}
                        className="w-full h-full min-h-[500px]"
                        title={currentFile.nombre}
                      />
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded border border-gray-300 h-full flex flex-col items-center justify-center p-8 text-center" style={{ minHeight: '350px' }}>
                    <div className="mb-4">
                      <svg className="w-16 h-16 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Vista previa no disponible</p>
                    <p className="text-xs text-gray-500 mb-4">Este tipo de archivo no se puede visualizar en el navegador</p>
                    {currentFile.url && (
                      <button
                        onClick={() => handleDownload(currentFile)}
                        className="px-4 py-2 text-xs btn-accent-theme rounded hover:bg-accent-hover-theme"
                      >
                        Descargar Archivo
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-600">
                  {currentFile.descripcion && (
                    <span><span className="font-medium">Descripción:</span> {currentFile.descripcion}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentFile.url && (
                    <button
                      onClick={() => handleDownload(currentFile)}
                      className="px-4 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Descargar
                    </button>
                  )}
                  <button
                    onClick={() => { setShowViewer(false); setCurrentFile(null); }}
                    className="px-4 py-2 text-xs btn-accent-theme rounded hover:bg-accent-hover-theme"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}