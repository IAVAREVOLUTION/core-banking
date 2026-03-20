import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Eye, Download, Upload, Loader2, Database, AlertTriangle } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '../../lib/supabaseClient';
import { currentUser } from '../../data/mockData';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

// Bucket principal para expedientes de prospectos
const BUCKET_EXPEDIENTES = 'make-7e2d13d9-expedientes-electronicos-prospectos';

// ═══════════════════════════════════════════════════════════════════
// Interfaz del nodo expedientesElectronicos dentro del JSONB
// Combina los campos institucionales requeridos + campos de UI existentes
// ═══════════════════════════════════════════════════════════════════
export interface Expediente {
  id: number;
  /** Nombre del archivo original */
  nombre: string;
  /** URL firmada de Supabase Storage (privada, temporal) */
  url: string;
  /** Ruta interna en Storage para regenerar URLs firmadas */
  storagePath?: string;
  /** Tipo MIME del archivo */
  mime: string;
  /** Tamaño en KB */
  tamanoKB: number;
  /** Fecha de carga: YYYY-MM-DD */
  fechaCarga: string;
  /** Usuario que realizó la carga */
  usuarioCarga: string;
  /** Tipo de documento (catálogo) */
  tipoDocumento: string;
  /** Descripción libre */
  descripcion: string;
  /** Estatus del expediente */
  estatus: string;
  /** Observaciones */
  observaciones: string;
  /** Archivo File pendiente de subir (solo en memoria, no se serializa al JSON) */
  _pendingFile?: File;
  /** Bucket de Storage a usar (si difiere del default de expedientes) */
  _bucket?: string;
  /** Indica que este expediente proviene de un campo directo en data JSONB (solo lectura) */
  _fromData?: boolean;
}

interface ExpedientesElectronicosProps {
  isView?: boolean;
  /** UUID del prospecto en J_CLIENTES — requerido para la ruta de Storage */
  prospectoDbUuid?: string;
  /** Datos iniciales del nodo expedientesElectronicos del JSONB de J_CLIENTES */
  initialData?: any[];
  /** Callback para notificar cambios al padre (ProspectoForm) para inclusión en el JSON de guardado */
  onDataChange?: (expedientes: Expediente[]) => void;
  /** Objeto data completo del prospecto para detectar archivos almacenados como campos directos en el JSONB */
  prospectoData?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════
// Utilidades
// ════════════════════════════════════════════════════════════════════

/** Mapea un registro legacy o nuevo al formato Expediente unificado */
function normalizeExpediente(raw: any, index: number): Expediente {
  return {
    id: raw.id ?? index + 1,
    nombre: raw.nombre || raw.archivo || '',
    url: raw.url || raw.fileData || '',
    storagePath: raw.storagePath || '',
    mime: raw.mime || '',
    tamanoKB: raw.tamanoKB || 0,
    fechaCarga: raw.fechaCarga || raw.fechaHora || '',
    usuarioCarga: raw.usuarioCarga || raw.usuario || 'Usuario Actual',
    tipoDocumento: raw.tipoDocumento || '',
    descripcion: raw.descripcion || '',
    estatus: raw.estatus || 'Pendiente',
    observaciones: raw.observaciones || '',
  };
}

/** Serializa para el JSON de J_CLIENTES — excluye campos internos (_pendingFile) */
function serializeForJson(exp: Expediente): Record<string, any> {
  return {
    id: exp.id,
    nombre: exp.nombre,
    url: exp.url,
    storagePath: exp.storagePath || '',
    mime: exp.mime,
    tamanoKB: exp.tamanoKB,
    fechaCarga: exp.fechaCarga,
    usuarioCarga: exp.usuarioCarga,
    tipoDocumento: exp.tipoDocumento,
    descripcion: exp.descripcion,
    estatus: exp.estatus,
    observaciones: exp.observaciones,
  };
}

/**
 * Solicita URL firmada fresca — estrategia v4.0 (client-side directo)
 * ────────────────────────────────────────────────────────────────────
 * Ya NO depende de Edge Functions como primer intento.
 * Intento 1: createSignedUrl directo con supabase client
 * Intento 2: download blob como fallback
 * Intento 3: Edge Function como último recurso
 */
async function refreshSignedUrl(rawStoragePath: string, bucket?: string, prospectoId?: string): Promise<RefreshResult | null> {
  const storagePath = normalizePath(rawStoragePath);
  console.log(`[refreshSignedUrl v4.0] 🔍 raw="${rawStoragePath}" → normalized="${storagePath}", prospectoId="${prospectoId || '(none)'}"`);

  if (!storagePath) {
    console.error('[refreshSignedUrl] ❌ storagePath vacío después de normalizar');
    return null;
  }

  const fileName = storagePath.includes('/') ? storagePath.substring(storagePath.lastIndexOf('/') + 1) : storagePath;

  // Generar variantes de rutas — nivel primario (sin extensiones alternativas) para Intento 0
  const primaryPathsRaw: string[] = [storagePath];
  if (prospectoId) {
    primaryPathsRaw.push(`${prospectoId}/${fileName}`);
    primaryPathsRaw.push(`expedientes-electronicos/prospectos/${prospectoId}/${fileName}`);
  }
  primaryPathsRaw.push(fileName);
  primaryPathsRaw.push(`expedientes-electronicos/prospectos/${fileName}`);
  const primaryPaths = [...new Set(primaryPathsRaw)];

  // Nivel extendido: primarios + extensiones alternativas (para Intentos 1-3 de fallback)
  const extendedPathsRaw: string[] = [...primaryPathsRaw];
  for (const p of primaryPathsRaw) {
    extendedPathsRaw.push(...getAlternativePaths(p));
  }
  const pathVariants = [...new Set(extendedPathsRaw)];

  // Buckets a probar
  const bucketsToTry = [...new Set([
    bucket || BUCKET_EXPEDIENTES,
    BUCKET_EXPEDIENTES,
    BUCKET_CONSTANCIAS,
  ])];

  const SUPABASE_URL = `https://${projectId}.supabase.co`;

  // ═══════════════════════════════════════════════════════════════
  // Intento 0 (FASTEST): Public URL directo — buckets son public,
  // no requiere RLS ni firma. REGLA INSTITUCIONAL (expediente-electronico-fix.md §4)
  // ═══════════════════════════════════════════════════════════════
  console.log(`[refreshSignedUrl] Intento 0 (public URL): ${primaryPaths.length} rutas × ${bucketsToTry.length} buckets`);
  for (const pathVar of primaryPaths) {
    for (const tryBucket of bucketsToTry) {
      try {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${tryBucket}/${pathVar}`;
        const headResp = await fetch(publicUrl, { method: 'HEAD' });
        if (headResp.ok) {
          const dName = pathVar.split('/').pop() || pathVar;
          console.log(`[refreshSignedUrl] ✅ Intento 0 OK (public URL) — ${tryBucket}/"${pathVar}"`);
          return { url: publicUrl, discoveredName: dName, discoveredMime: mimeFromExt(dName) };
        }
      } catch (_) { /* silencioso */ }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Intento 1: createSignedUrl directo con supabase client (fallback si bucket no es público)
  // ═══════════════════════════════════════════════════════════════
  console.log(`[refreshSignedUrl] Intento 1 (createSignedUrl): ${pathVariants.length} rutas × ${bucketsToTry.length} buckets`);
  for (const pathVar of pathVariants) {
    for (const tryBucket of bucketsToTry) {
      try {
        const { data, error } = await supabase.storage.from(tryBucket).createSignedUrl(pathVar, 3600);
        if (data?.signedUrl && !error) {
          const dName = pathVar.split('/').pop() || pathVar;
          console.log(`[refreshSignedUrl] ✅ Intento 1 OK — ${tryBucket}/"${pathVar}"`);
          return { url: data.signedUrl, discoveredName: dName, discoveredMime: mimeFromExt(dName) };
        }
      } catch (_) { /* silencioso */ }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Intento 2: Download directo (blob)
  // ═══════════════════════════════════════════════════════════════
  console.log(`[refreshSignedUrl] Intento 2 (download blob)...`);
  for (const pathVar of pathVariants) {
    for (const tryBucket of bucketsToTry) {
      try {
        const { data, error } = await supabase.storage.from(tryBucket).download(pathVar);
        if (data && data.size > 0 && !error) {
          const blobUrl = URL.createObjectURL(data);
          const dName = pathVar.split('/').pop() || pathVar;
          console.log(`[refreshSignedUrl] ✅ Intento 2 OK — ${tryBucket}/"${pathVar}" (${data.size} bytes)`);
          return { url: blobUrl, discoveredName: dName, discoveredMime: data.type || mimeFromExt(dName) };
        }
      } catch (_) { /* silencioso */ }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Intento 3: Edge Function como último recurso
  // ═══════════════════════════════════════════════════════════════
  try {
    const bodyPayload: Record<string, string> = { storagePath };
    if (bucket) bodyPayload.bucket = bucket;
    if (prospectoId) bodyPayload.prospectoId = prospectoId;

    console.log(`[refreshSignedUrl] Intento 3 (Edge Function fallback): path="${storagePath}"`);
    const res = await fetch(`${API_BASE}/storage/expedientes/signed-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
      body: JSON.stringify(bodyPayload),
    });
    const json = await res.json();
    if (json.signedUrl) {
      const resolvedName = json.resolvedPath
        ? (json.resolvedPath.split('/').pop() || fileName)
        : fileName;
      console.log(`[refreshSignedUrl] ✅ Intento 3 OK (Edge Function)`);
      return { url: json.signedUrl, discoveredName: resolvedName, discoveredMime: mimeFromExt(resolvedName) };
    }
  } catch (err) {
    console.warn(`[refreshSignedUrl] Intento 3 (Edge Function) falló:`, err);
  }

  console.error(`[refreshSignedUrl] ❌ TODOS LOS INTENTOS FALLARON para: "${rawStoragePath}"`);
  return null;
}

/** Sube un archivo al Storage usando el cliente Supabase directamente */
async function uploadFileToStorage(
  file: File,
  prospectoId: string,
): Promise<{ nombre: string; url: string; storagePath: string; mime: string; tamanoKB: number } | null> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Formato de ruta que coincide con el esquema existente en Storage
  const storagePath = `expedientes-electronicos/prospectos/${prospectoId}/${timestamp}_${safeName}`;

  console.log(`[uploadFileToStorage] Subiendo: bucket="${BUCKET_EXPEDIENTES}", path="${storagePath}", size=${file.size}`);

  // ── Intento 1: supabase.storage.upload directo ──
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

    if (!error && data?.path) {
      console.log(`[uploadFileToStorage] ✅ Intento 1 OK — path="${data.path}"`);

      // Intentar obtener URL firmada (puede fallar si no hay política SELECT/RLS)
      let signedUrl = '';
      try {
        const { data: signedData } = await supabase.storage
          .from(BUCKET_EXPEDIENTES)
          .createSignedUrl(data.path, 3600);
        signedUrl = signedData?.signedUrl || '';
      } catch (_) {
        console.warn(`[uploadFileToStorage] createSignedUrl falló (posible RLS SELECT faltante)`);
      }

      // Si la URL firmada falló, usar blob URL local para visualización inmediata
      const viewUrl = signedUrl || URL.createObjectURL(file);
      if (!signedUrl) {
        console.warn(`[uploadFileToStorage] ⚠️ Usando blob URL local (archivo SÍ está en Storage pero sin política SELECT)`);
      }

      return {
        nombre: file.name,
        url: viewUrl,
        storagePath: data.path,
        mime: file.type || 'application/octet-stream',
        tamanoKB: Math.round(file.size / 1024),
      };
    }
    // RLS errors are expected if bucket policies aren't configured yet
    // SQL Fix: In Supabase SQL Editor, run:
    //   CREATE POLICY "allow_anon_upload" ON storage.objects
    //     FOR INSERT TO anon WITH CHECK (bucket_id = 'expedientes-electronicos');
    //   CREATE POLICY "allow_anon_select" ON storage.objects
    //     FOR SELECT TO anon USING (bucket_id = 'expedientes-electronicos');
    const isRLS = error?.message?.includes('row-level security') || error?.message?.includes('RLS');
    if (isRLS) {
      console.warn(`[uploadFileToStorage] Intento 1 error (RLS — ejecutar políticas del bucket en Supabase SQL Editor):`, error?.message);
    } else {
      console.warn(`[uploadFileToStorage] Intento 1 error:`, error?.message);
    }
  } catch (err) {
    console.warn(`[uploadFileToStorage] Intento 1 excepción:`, err);
  }

  // ── Intento 2: Edge Function como fallback ──
  try {
    console.log(`[uploadFileToStorage] Intento 2 (Edge Function fallback)...`);
    const formPayload = new FormData();
    formPayload.append('file', file);
    formPayload.append('prospectoId', prospectoId);

    const res = await fetch(`${API_BASE}/storage/expedientes/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      body: formPayload,
    });

    if (res.ok) {
      const json = await res.json();
      console.log(`[uploadFileToStorage] ✅ Intento 2 OK (Edge Function)`);
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
    console.warn(`[uploadFileToStorage] Intento 2 excepción:`, err);
  }

  // ── Intento 3: Guardar como blob local (último recurso — archivo NO en Storage) ──
  console.warn(`[uploadFileToStorage] ⚠️ Todos los intentos de subir a Storage fallaron. Guardando blob local.`);
  toast.warning('Archivo guardado localmente', {
    description: 'No se pudo subir a Storage. El archivo estará disponible mientras dure la sesión.',
    duration: 6000,
  });
  const blobUrl = URL.createObjectURL(file);
  return {
    nombre: file.name,
    url: blobUrl,
    storagePath: '', // vacío porque NO está en Storage — evita intentos de refreshSignedUrl que siempre fallarían
    mime: file.type || 'application/octet-stream',
    tamanoKB: Math.round(file.size / 1024),
  };
}

/** Elimina un archivo del Storage usando el cliente Supabase directamente */
async function deleteFileFromStorage(storagePath: string): Promise<boolean> {
  const normalizedPath = normalizePath(storagePath);
  if (!normalizedPath) return false;

  console.log(`[deleteFileFromStorage] Eliminando: "${normalizedPath}"`);

  // ── Intento 1: supabase.storage.remove en bucket principal ──
  try {
    const { error } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .remove([normalizedPath]);
    if (!error) {
      console.log(`[deleteFileFromStorage] ✅ Eliminado OK de ${BUCKET_EXPEDIENTES}`);
      return true;
    }
    console.warn(`[deleteFileFromStorage] Error bucket principal:`, error.message);
  } catch (err) {
    console.warn(`[deleteFileFromStorage] Excepción bucket principal:`, err);
  }

  // ── Intento 2: bucket de constancias ──
  try {
    const { error } = await supabase.storage
      .from(BUCKET_CONSTANCIAS)
      .remove([normalizedPath]);
    if (!error) {
      console.log(`[deleteFileFromStorage] ✅ Eliminado OK de ${BUCKET_CONSTANCIAS}`);
      return true;
    }
  } catch (_) { /* silencioso */ }

  // ── Intento 3: Edge Function fallback ──
  try {
    const res = await fetch(`${API_BASE}/storage/expedientes/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ storagePath: normalizedPath }),
    });
    if (res.ok) {
      console.log(`[deleteFileFromStorage] ✅ Eliminado via Edge Function`);
      return true;
    }
  } catch (_) { /* silencioso */ }

  console.warn(`[deleteFileFromStorage] ⚠️ No se pudo eliminar: "${normalizedPath}"`);
  return false;
}

// Validaciones MIME y tamaño (frontend)
const ALLOWED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.doc,.docx,.xls,.xlsx';
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ═══════════════════════════════════════════════════════════════════
// Nombre del bucket de constancias en Supabase Storage
// ═══════════════════════════════════════════════════════════════════
const BUCKET_CONSTANCIAS = 'make-9a76e68a-constancias';

// ═══════════════════════════════════════════════════════════════════
// Mapeo de campos de archivo en data (JSONB) → etiquetas legibles
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

/** Extensiones de archivo reconocidas */
const FILE_EXTENSIONS = /\.(png|jpg|jpeg|gif|bmp|webp|pdf|doc|docx|xls|xlsx|csv|txt)$/i;

/** Patrones que NO son rutas de archivo aunque contengan "/" */
const DATE_PATTERN = /^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

/** Campos de data JSONB que NUNCA son archivos — excluidos del escaneo dinámico */
const NON_FILE_FIELDS = new Set([
  'fechaNacimiento', 'fechaOriginacion', 'fechaActivacion', 'fechaAlta',
  'fechaModificacion', 'fechaCreacion', 'fechaVencimiento', 'fechaExpedicion',
  'nombre', 'apellidoPaterno', 'apellidoMaterno', 'denominacionRazonSocial',
  'telefono', 'correoElectronico', 'curp', 'rfc', 'sexo', 'tipo', 'subtipo',
  'estatus', 'estatusCliente', 'estatusProspecto', 'estatusSIC', 'estatusListaNegra',
  'entidadFederativa', 'sucursal', 'clasificacionCliente', 'institucionGobierno',
  'institucionGobiernoId', 'idProspecto', 'idCliente', 'cotizacion',
  'direcciones', 'cotizaciones', 'sic', 'listasNegras', 'expedientesElectronicos',
]);

/** Detecta si un valor string parece ser una ruta de archivo.
 *  Reconoce extensiones conocidas Y rutas con `/` que parezcan rutas de storage
 *  (ej: "residencia/constancia_1772122018073_lc0wy8wh" sin extensión).
 *  Excluye fechas y valores que parecen datos, no archivos.
 */
function looksLikeFilePath(value: any): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (DATE_PATTERN.test(value) || ISO_DATE_PATTERN.test(value)) return false;
  if (FILE_EXTENSIONS.test(value)) return true;
  if (value.includes('/') && !value.startsWith('http') && !value.includes(' ') && value.length > 5) return true;
  return false;
}

/** Extensiones alternativas para fallback cuando la extensión original no coincide con el archivo real en Storage */
const ALTERNATIVE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'doc', 'docx', 'xls', 'xlsx'];

/** Genera rutas alternativas cambiando la extensión del archivo */
function getAlternativePaths(originalPath: string): string[] {
  const lastDotIdx = originalPath.lastIndexOf('.');
  if (lastDotIdx === -1) {
    // Sin extensión: probar TODAS las extensiones
    return ALTERNATIVE_EXTENSIONS.map(ext => `${originalPath}.${ext}`);
  }
  const basePath = originalPath.substring(0, lastDotIdx);
  const currentExt = originalPath.substring(lastDotIdx + 1).toLowerCase();
  // Incluir la ruta SIN extensión y con cada extensión alternativa
  return [
    basePath, // sin extensión
    ...ALTERNATIVE_EXTENSIONS
      .filter(ext => ext !== currentExt)
      .map(ext => `${basePath}.${ext}`),
  ];
}

/**
 * Resultado de refreshSignedUrl — incluye URL y metadatos del archivo descubierto
 */
interface RefreshResult {
  url: string;
  /** Nombre real del archivo en Storage (puede tener extensión diferente al JSONB) */
  discoveredName?: string;
  /** MIME inferido del archivo descubierto */
  discoveredMime?: string;
}

/** Infiere MIME a partir de extensión */
function mimeFromExt(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return '';
}

/** Normaliza un storagePath: quita `/` inicial, espacios, y decodifica URI */
function normalizePath(raw: string): string {
  let p = raw.trim();
  // Decodificar %20, %2F, etc. si vienen codificados
  try { p = decodeURIComponent(p); } catch (_) { /* ya decodificado */ }
  // Quitar barras iniciales
  while (p.startsWith('/')) p = p.substring(1);
  return p;
}

// ═══════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════
export function ExpedientesElectronicos({
  isView = false,
  prospectoDbUuid,
  initialData,
  onDataChange,
  prospectoData,
}: ExpedientesElectronicosProps) {
  // Función para cargar datos persistidos
  const loadPersistedData = (key: string, defaultValue: any) => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error('Error loading persisted data:', error);
      return defaultValue;
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedExpedientes, setSelectedExpedientes] = useState<number[]>([]);
  const [showWmdModal, setShowWmdModal] = useState(false);
  const [wmdUrl, setWmdUrl] = useState('');
  const [showViewer, setShowViewer] = useState(false);
  const [currentFile, setCurrentFile] = useState<Expediente | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [showAdjuntarOptions, setShowAdjuntarOptions] = useState(false);

  // Cargar expedientes: prioridad → initialData (J_CLIENTES) > vacío
  // Ya NO carga de sessionStorage — la persistencia la maneja ProspectoForm con claves por prospecto
  const [expedientes, setExpedientes] = useState<Expediente[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map(normalizeExpediente);
    }
    return [];
  });

  // Notificar al padre cuando cambien (ProspectoForm maneja la persistencia en sessionStorage)
  useEffect(() => {
    onDataChange?.(expedientes);
  }, [expedientes]);

  // ─── Siguiente ID disponible ──────────────────────────────────────
  const getNextId = () => Math.max(...expedientes.map(e => e.id), 0) + 1;

  // ─── Selección ────────────────────────────────────────────────────
  const handleSelectAll = (checked: boolean) => {
    setSelectedExpedientes(checked ? expedientes.map(e => e.id) : []);
  };

  const handleSelectExpediente = (id: number, checked: boolean) => {
    setSelectedExpedientes(prev =>
      checked ? [...prev, id] : prev.filter(expId => expId !== id),
    );
  };

  // ─── Subir archivo desde equipo ───────────────────────────────────
  const handleFileSelect = async (file: File) => {
    // Validar tamaño en el frontend
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(`El archivo excede el tamaño máximo (${sizeMB} MB > ${MAX_FILE_SIZE_MB} MB)`);
      return;
    }

    const fechaCarga = new Date().toISOString().split('T')[0];

    // Si tenemos UUID → subir inmediatamente al Storage
    if (prospectoDbUuid) {
      setUploading(true);
      const result = await uploadFileToStorage(file, prospectoDbUuid);
      setUploading(false);

      if (result) {
        const newExp: Expediente = {
          id: getNextId(),
          nombre: result.nombre,
          url: result.url,
          storagePath: result.storagePath,
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
        toast.success(`Archivo "${result.nombre}" subido exitosamente a Storage`);
      }
    } else {
      // Sin UUID (modo create) → almacenar archivo pendiente en memoria
      const blobUrl = URL.createObjectURL(file);
      const newExp: Expediente = {
        id: getNextId(),
        nombre: file.name,
        url: blobUrl,
        storagePath: '',
        mime: file.type || 'application/octet-stream',
        tamanoKB: Math.round(file.size / 1024),
        fechaCarga,
        usuarioCarga: currentUser.name || 'Usuario Actual',
        tipoDocumento: '',
        descripcion: '',
        estatus: 'Pendiente',
        observaciones: '',
        _pendingFile: file,
      };
      setExpedientes(prev => [...prev, newExp]);
      toast.info(`Archivo "${file.name}" listo para subir al guardar el prospecto`);
    }
  };

  // ─── Ver archivo ──────────────────────────────────────────────────
  const handleView = async (exp: Expediente) => {
    if (!exp.url && !exp.storagePath) {
      toast.error('No hay archivo disponible para visualizar');
      return;
    }

    // blob URL → mostrar directo
    if (exp.url && exp.url.startsWith('blob:')) {
      console.log(`[handleView] Usando blob URL directa`);
      setCurrentFile(exp);
      setShowViewer(true);
      return;
    }

    // URL http sin storagePath → mostrar directo (no es archivo de Storage)
    if (exp.url && exp.url.startsWith('http') && !exp.storagePath) {
      console.log(`[handleView] Usando URL http directa (sin storagePath)`);
      setCurrentFile(exp);
      setShowViewer(true);
      return;
    }

    // URL pública de Storage → validar con HEAD antes de mostrar; si falla, cae al refresh
    if (exp.url && exp.url.includes('/object/public/') && exp.storagePath) {
      try {
        console.log(`[handleView] Validando URL pública con HEAD...`);
        setViewerLoading(true);
        const headResp = await fetch(exp.url, { method: 'HEAD' });
        setViewerLoading(false);
        if (headResp.ok) {
          console.log(`[handleView] ✅ URL pública válida`);
          setCurrentFile(exp);
          setShowViewer(true);
          return;
        }
        console.warn(`[handleView] ⚠️ URL pública ${headResp.status}, fallback a refreshSignedUrl`);
      } catch (err) {
        setViewerLoading(false);
        console.warn(`[handleView] ⚠️ HEAD falló, fallback a refreshSignedUrl`, err);
      }
      // NO return — cae al bloque de refreshSignedUrl abajo
    }

    // Si tiene storagePath, refrescar URL firmada
    if (exp.storagePath) {
      setViewerLoading(true);
      const result = await refreshSignedUrl(exp.storagePath, exp._bucket, prospectoDbUuid);
      setViewerLoading(false);
      if (result) {
        const updatedExp = { ...exp, url: result.url };
        if (result.discoveredMime) updatedExp.mime = result.discoveredMime;
        if (result.discoveredName && !FILE_EXTENSIONS.test(exp.nombre)) {
          updatedExp.nombre = result.discoveredName;
        }
        console.log(`[handleView] Archivo resuelto: nombre="${updatedExp.nombre}", mime="${updatedExp.mime}"`);
        setCurrentFile(updatedExp);
        setShowViewer(true);
        return;
      }
      // Si falla pero tiene URL existente, intentar con esa
      if (exp.url) {
        console.log(`[handleView] Refresh falló, usando URL existente: "${exp.url.substring(0, 60)}..."`);
        setCurrentFile(exp);
        setShowViewer(true);
        return;
      }
      toast.error(`Archivo no encontrado en Storage`, {
        description: `Ruta: ${exp.storagePath}. Verifique que el archivo exista en los buckets de Supabase Storage.`,
        duration: 8000,
      });
      return;
    }

    // Fallback: mostrar con lo que tengamos
    setCurrentFile(exp);
    setShowViewer(true);
  };

  // ─── Descargar archivo ────────────────────────────────────────────
  const handleDownload = async (exp: Expediente) => {
    if (!exp.url && !exp.storagePath) {
      toast.error('No hay archivo disponible para descargar');
      return;
    }

    let downloadUrl = exp.url;

    // Si es blob URL → descargar directamente
    if (downloadUrl && downloadUrl.startsWith('blob:')) {
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
      let publicOk = false;
      if (downloadUrl && downloadUrl.includes('/object/public/')) {
        try {
          const headResp = await fetch(downloadUrl, { method: 'HEAD' });
          publicOk = headResp.ok;
        } catch (_) { /* silencioso */ }
      }
      if (!publicOk) {
        const result = await refreshSignedUrl(exp.storagePath, exp._bucket, prospectoDbUuid);
        if (result) {
          downloadUrl = result.url;
        }
      }
    }

    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    } else {
      toast.error(`Archivo no encontrado en Storage`, {
        description: `Ruta: ${exp.storagePath}. Verifique que el archivo exista en los buckets de Supabase Storage.`,
        duration: 8000,
      });
    }
  };

  // ─── Eliminar expedientes seleccionados ───────────────────────────
  const handleDelete = async () => {
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

    // Eliminar archivos del Storage (si tienen storagePath)
    for (const exp of expedientesAEliminar) {
      if (exp.storagePath) {
        await deleteFileFromStorage(exp.storagePath);
      }
      // Revocar blob URLs de archivos pendientes
      if (exp._pendingFile && exp.url?.startsWith('blob:')) {
        URL.revokeObjectURL(exp.url);
      }
    }

    setExpedientes(prev => prev.filter(e => !selectedExpedientes.includes(e.id)));
    const count = selectedExpedientes.length;
    setSelectedExpedientes([]);
    toast.success(`${count} expediente${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  // ─── Agregar documento desde Web (URL externa) ────────────────────
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

  // Determinar si un archivo es previsualizable
  // Inspecciona nombre, storagePath, url Y mime para máxima detección
  const getFileType = (exp: Expediente) => {
    // Extraer extensión de múltiples fuentes
    const extFrom = (s: string) => {
      if (!s) return '';
      // Para URLs, quitar query params antes de buscar extensión
      const clean = s.split('?')[0].split('#')[0];
      const dot = clean.lastIndexOf('.');
      const slash = clean.lastIndexOf('/');
      return (dot > slash && dot > 0) ? clean.substring(dot + 1).toLowerCase() : '';
    };
    const extNombre = extFrom(exp.nombre);
    const extStorage = extFrom(exp.storagePath || '');
    const extUrl = extFrom(exp.url || '');
    // Usar la primera extensión válida encontrada
    const ext = extNombre || extStorage || extUrl || '';
    const mime = exp.mime || '';

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const isImage = imageExts.includes(ext) || mime.startsWith('image/');
    const isPDF = ext === 'pdf' || mime === 'application/pdf';
    return { isImage, isPDF, canPreview: isImage || isPDF };
  };

  // ─── Archivos detectados en data (JSONB) del prospecto ───────────
  const archivosEnData = useMemo(() => {
    if (!prospectoData) return [];
    const result: { campo: string; label: string; storagePath: string; bucket: string; mime: string; nombre: string }[] = [];

    /** Detecta si un valor es un objeto de archivo con estructura {path, bucket, mime, nombre} */
    const isFileObj = (v: any): v is { path: string; bucket?: string; mime?: string; nombre?: string } =>
      v && typeof v === 'object' && !Array.isArray(v) && typeof v.path === 'string' && v.path.length > 0;

    // Primero buscar campos conocidos
    for (const [key, label] of Object.entries(DATA_FILE_FIELDS)) {
      const val = prospectoData[key];
      if (isFileObj(val)) {
        // Formato objeto: { path, bucket, mime, nombre }
        result.push({
          campo: key, label,
          storagePath: val.path,
          bucket: val.bucket || BUCKET_CONSTANCIAS,
          mime: val.mime || mimeFromExt(val.nombre || val.path),
          nombre: val.nombre || val.path.split('/').pop() || key,
        });
      } else if (looksLikeFilePath(val)) {
        const fileName = val.split('/').pop() || val;
        result.push({ campo: key, label, storagePath: val, bucket: '', mime: mimeFromExt(fileName), nombre: fileName });
      }
    }

    // Luego buscar campos no conocidos que parezcan rutas de archivo
    for (const [key, val] of Object.entries(prospectoData)) {
      if (DATA_FILE_FIELDS[key]) continue; // ya procesado
      if (NON_FILE_FIELDS.has(key)) continue; // campo conocido que NO es archivo
      if (isFileObj(val)) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
        result.push({
          campo: key, label,
          storagePath: val.path,
          bucket: val.bucket || BUCKET_CONSTANCIAS,
          mime: val.mime || mimeFromExt(val.nombre || val.path),
          nombre: val.nombre || val.path.split('/').pop() || key,
        });
        continue;
      }
      if (Array.isArray(val) || (typeof val === 'object' && val !== null)) continue; // excluir arrays/objetos
      if (looksLikeFilePath(val)) {
        // Generar label legible: camelCase → "Camel Case"
        const label = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (s) => s.toUpperCase())
          .trim();
        const fileName = (val as string).split('/').pop() || (val as string);
        result.push({ campo: key, label, storagePath: val as string, bucket: '', mime: mimeFromExt(fileName), nombre: fileName });
      }
    }

    return result;
  }, [prospectoData]);

  // ─── Convertir archivos de data JSONB a Expedientes virtuales ─────
  const dataFileExpedientes = useMemo<Expediente[]>(() => {
    const SUPABASE_URL = `https://${projectId}.supabase.co`;
    return archivosEnData.map((item, idx) => {
      const resolvedBucket = item.bucket || (item.storagePath.startsWith('expedientes-electronicos/')
        ? 'make-7e2d13d9-expedientes-electronicos-prospectos'
        : BUCKET_CONSTANCIAS);
      const resolvedMime = item.mime || (() => {
        const ext = item.nombre.split('.').pop()?.toLowerCase() || '';
        return ['jpg','jpeg','png','gif','bmp','webp'].includes(ext) ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
          : ext === 'pdf' ? 'application/pdf' : '';
      })();
      // Construir URL pública directa cuando tenemos bucket
      const publicUrl = resolvedBucket
        ? `${SUPABASE_URL}/storage/v1/object/public/${resolvedBucket}/${item.storagePath}`
        : '';
      return {
        id: -(idx + 1), // IDs negativos para no colisionar con expedientes regulares
        nombre: item.nombre,
        url: publicUrl,
        storagePath: item.storagePath,
        mime: resolvedMime,
        tamanoKB: 0,
        fechaCarga: '—',
        usuarioCarga: '—',
        tipoDocumento: item.label,
        descripcion: `Campo JSONB: ${item.campo}`,
        estatus: 'Activo',
        observaciones: '',
        _bucket: resolvedBucket,
        _fromData: true,
      };
    });
  }, [archivosEnData]);

  // ─── Lista combinada: expedientes regulares + archivos de data JSONB ─
  const allExpedientes = useMemo(() => {
    return [...dataFileExpedientes, ...expedientes];
  }, [expedientes, dataFileExpedientes]);

  return (
    <div className="flex-1">
      {/* Título y botones al mismo nivel */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
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

      {/* Título y Botones - Se muestran solo cuando showAdjuntarOptions es true */}
      {showAdjuntarOptions && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-700 font-medium">Adjuntar desde:</span>
          <label 
            className="px-3 py-1.5 border border-gray-300 text-xs rounded bg-gray-200 text-gray-600 cursor-pointer hover:bg-gray-300"
          >
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

      {/* Indicador de archivos pendientes (modo create sin UUID) */}
      {!prospectoDbUuid && expedientes.some(e => e._pendingFile) && (
        <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          <strong>Nota:</strong> {expedientes.filter(e => e._pendingFile).length} archivo(s) pendiente(s) de subir.
          Se subirán automáticamente al guardar el prospecto.
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
                    checked={expedientes.length > 0 && selectedExpedientes.length === expedientes.length}
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
                <td colSpan={isView ? 9 : 10} className="px-3 py-6 text-center text-xs text-gray-500">
                  No hay expedientes electrónicos registrados
                </td>
              </tr>
            ) : (
              allExpedientes.map(expediente => (
                <tr
                  key={expediente.id}
                  className={`hover:bg-gray-50 ${expediente._fromData ? 'bg-green-50/50' : ''} ${selectedExpedientes.includes(expediente.id) ? 'bg-blue-50' : ''}`}
                >
                  {!isView && (
                    <td className="border-b border-gray-200 px-2 py-1.5 text-center">
                      {expediente._fromData ? (
                        <Database className="w-3.5 h-3.5 text-green-500 mx-auto" title="Archivo desde data JSONB (solo lectura)" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedExpedientes.includes(expediente.id)}
                          onChange={(e) => handleSelectExpediente(expediente.id, e.target.checked)}
                          className="cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </td>
                  )}
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">
                    {expediente.fechaCarga}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">
                    {expediente.usuarioCarga}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">
                    <div className="flex items-center gap-1">
                      {expediente._pendingFile && (
                        <span className="inline-block w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" title="Pendiente de subir" />
                      )}
                      {expediente._fromData && (
                        <span className="inline-flex items-center px-1 py-0.5 bg-green-100 text-green-700 text-[10px] rounded flex-shrink-0" title="Archivo almacenado en campo directo de data JSONB">JSONB</span>
                      )}
                      <span className="truncate max-w-[160px]" title={expediente.nombre}>
                        {expediente.nombre}
                      </span>
                    </div>
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-500">
                    {expediente.tamanoKB > 0 ? expediente.tamanoKB : '—'}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    {expediente._fromData ? (
                      <span className="text-xs text-gray-700">{expediente.tipoDocumento}</span>
                    ) : (
                    <select
                      value={expediente.tipoDocumento}
                      onChange={(e) => {
                        setExpedientes(prev =>
                          prev.map(exp =>
                            exp.id === expediente.id ? { ...exp, tipoDocumento: e.target.value } : exp,
                          ),
                        );
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
                    </select>
                    )}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    {expediente._fromData ? (
                      <span className="text-xs text-gray-500">{expediente.descripcion}</span>
                    ) : (
                    <input
                      type="text"
                      value={expediente.descripcion}
                      onChange={(e) => {
                        setExpedientes(prev =>
                          prev.map(exp =>
                            exp.id === expediente.id ? { ...exp, descripcion: e.target.value } : exp,
                          ),
                        );
                      }}
                      disabled={isView}
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    )}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    {expediente._fromData ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">{expediente.estatus}</span>
                    ) : (
                    <select
                      value={expediente.estatus}
                      onChange={(e) => {
                        setExpedientes(prev =>
                          prev.map(exp =>
                            exp.id === expediente.id ? { ...exp, estatus: e.target.value } : exp,
                          ),
                        );
                      }}
                      disabled={isView}
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option>Pendiente</option>
                      <option>Aprobado</option>
                      <option>Rechazado</option>
                    </select>
                    )}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    {expediente._fromData ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                    <input
                      type="text"
                      value={expediente.observaciones}
                      onChange={(e) => {
                        setExpedientes(prev =>
                          prev.map(exp =>
                            exp.id === expediente.id ? { ...exp, observaciones: e.target.value } : exp,
                          ),
                        );
                      }}
                      disabled={isView}
                      className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    )}
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

      {/* Modal para agregar documento desde Web */}
      {showWmdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header azul institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                Agregar Documento desde Web
              </h3>
              <button
                onClick={() => {
                  setShowWmdModal(false);
                  setWmdUrl('');
                }}
                className="text-white hover:text-gray-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z" />
                </svg>
              </button>
            </div>

            {/* Contenido del formulario */}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddFromWeb();
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ingrese la URL completa del documento que desea agregar (PDF, DOC, imagen, etc.)
                </p>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowWmdModal(false);
                  setWmdUrl('');
                }}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddFromWeb}
                className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90 font-medium"
                disabled={!wmdUrl.trim()}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay para viewer */}
      {viewerLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl">
            <Loader2 className="w-5 h-5 animate-spin text-accent-theme" />
            <span className="text-sm text-gray-700">Obteniendo archivo...</span>
          </div>
        </div>
      )}

      {/* Modal para ver el archivo */}
      {showViewer && currentFile && (() => {
        const { isImage, isPDF, canPreview } = getFileType(currentFile);

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-accent-theme" />
                  <h3 className="text-sm font-semibold text-gray-800">Visualizador de Documento</h3>
                </div>
                <button
                  onClick={() => {
                    setShowViewer(false);
                    setCurrentFile(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z" />
                  </svg>
                </button>
              </div>

              {/* Info del archivo */}
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-medium text-gray-700">Archivo:</span>
                    <span className="ml-2 text-gray-600">{currentFile.nombre}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tipo:</span>
                    <span className="ml-2 text-gray-600">{currentFile.tipoDocumento || currentFile.mime}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Fecha:</span>
                    <span className="ml-2 text-gray-600">{currentFile.fechaCarga}</span>
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
                        onError={() => {
                          console.error(`[ProspectoExpedientes-viewer] ❌ Error cargando imagen: ${currentFile.url}`);
                          toast.error('No se pudo cargar la imagen');
                        }}
                        onLoad={() => {
                          console.log(`[ProspectoExpedientes-viewer] ✅ Imagen cargada: ${currentFile.nombre}`);
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
                  <div className="bg-white rounded border border-gray-300 h-full flex flex-col items-center justify-center p-8 text-center">
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
                    onClick={() => {
                      setShowViewer(false);
                      setCurrentFile(null);
                    }}
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

// ═══════════════════════════════════════════════════════════════════
// Función exportada para subir archivos pendientes después de obtener UUID
// Usada por ProspectoForm al guardar en modo Create
// ═══════════════════════════════════════════════════════════════════
export async function uploadPendingExpedientes(
  expedientes: any[],
  prospectoDbUuid: string,
): Promise<any[]> {
  const updated: any[] = [];

  for (const exp of expedientes) {
    if (exp._pendingFile && exp._pendingFile instanceof File) {
      console.log(`[uploadPendingExpedientes] Subiendo archivo pendiente: ${exp._pendingFile.name}`);
      const result = await uploadFileToStorage(exp._pendingFile, prospectoDbUuid);
      if (result) {
        updated.push({
          ...serializeForJson(exp),
          nombre: result.nombre,
          url: result.url,
          storagePath: result.storagePath,
          mime: result.mime,
          tamanoKB: result.tamanoKB,
        });
      } else {
        // Si falla el upload, guardar sin URL
        updated.push(serializeForJson(exp));
      }
    } else {
      updated.push(serializeForJson(exp));
    }
  }

  return updated;
}