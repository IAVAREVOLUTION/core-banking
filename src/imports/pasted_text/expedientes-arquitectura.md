Perfecto. Ahora te doy el resumen completo de la lógica. Aquí tienes toda la arquitectura de Expedientes Electrónicos:

Arquitectura completa de Expedientes Electrónicos
1. Buckets en Supabase Storage
Nombre del bucket principal:  "make-7e2d13d9-expedientes-electronicos-prospectos"
Nombre del bucket secundario: "make-9a76e68a-constancias"
Ambos configurados como:      public: true  (necesario para URLs /object/public/)
Los buckets se crean/actualizan automáticamente en el bootstrap de la Edge Function (/supabase/functions/server/index.tsx). También se crean 4 políticas RLS que aplican a TO anon, authenticated (porque el frontend usa publicAnonKey con rol anon).

2. Ruta de archivos en Storage (storagePath)
expedientes-electronicos/prospectos/{entityId}/{timestamp}_{safeName}
Ejemplo real:

expedientes-electronicos/prospectos/a1b2c3d4-e5f6-7890-abcd-ef1234567890/1709490000000_INE_frente.pdf
entityId = UUID del cliente o prospecto (clienteId o diagUuid)
timestamp = Date.now() para evitar colisiones
safeName = nombre original del archivo sanitizado: file.name.replace(/[^a-zA-Z0-9.-]/g, '')
3. Interfaz del JSON (lo que se guarda en J_CLIENTES.data.expedientesElectronicos[])
interface Expediente {
  id: number;              // Autoincremental local (max id + 1)
  nombre: string;          // Nombre original del archivo ("INE frente.pdf")
  url: string;             // URL pública: https://{projectId}.supabase.co/storage/v1/object/public/{bucket}/{storagePath}
  storagePath: string;     // Ruta en Storage: "expedientes-electronicos/prospectos/{uuid}/{ts}_{name}"
  storageBucket: string;   // Nombre del bucket donde se subió (para reconstruir URL)
  mime: string;            // "application/pdf", "image/jpeg", etc.
  tamanoKB: number;        // Math.round(file.size / 1024)
  fechaCarga: string;      // "2026-03-03" (ISO date sin hora)
  usuarioCarga: string;    // Nombre del usuario actual
  tipoDocumento: string;   // Categoría del documento (capturado por el usuario)
  descripcion: string;     // Descripción libre
  estatus: string;         // "Pendiente" por default
  observaciones: string;   // Observaciones libres
}
Ejemplo de un elemento en el array JSON:

{
  "id": 1,
  "nombre": "INE_frente.pdf",
  "url": "https://pvzrjmsynzgfsowntywf.supabase.co/storage/v1/object/public/make-7e2d13d9-expedientes-electronicos-prospectos/expedientes-electronicos/prospectos/a1b2c3d4/1709490000000_INE_frente.pdf",
  "storagePath": "expedientes-electronicos/prospectos/a1b2c3d4/1709490000000_INE_frente.pdf",
  "storageBucket": "make-7e2d13d9-expedientes-electronicos-prospectos",
  "mime": "application/pdf",
  "tamanoKB": 245,
  "fechaCarga": "2026-03-03",
  "usuarioCarga": "Admin Sistema",
  "tipoDocumento": "",
  "descripcion": "",
  "estatus": "Pendiente",
  "observaciones": ""
}
4. Flujo de Upload (función uploadFileToStorage)
┌─────────────────────────────────────────────────┐
│  Usuario selecciona archivo (input type="file")  │
└───────────────────────┬─────────────────────────┘
                        ▼
            Validar tamaño (≤ 10 MB)
                        │
                        ▼
         ┌──── INTENTO 1: supabase.storage ────┐
         │  supabase.storage                    │
         │    .from(BUCKET_EXPEDIENTES)         │
         │    .upload(storagePath, file, {       │
         │       cacheControl: '3600',          │
         │       upsert: false,                 │
         │       contentType: file.type          │
         │    })                                │
         │                                      │
         │  Si OK → construir URL pública:      │
         │  https://{projectId}.supabase.co/    │
         │  storage/v1/object/public/           │
         │  {BUCKET}/{data.path}                │
         └──────────┬───────────────────────────┘
                    │ si falla ↓
         ┌──── INTENTO 2: Edge Function ───────┐
         │  POST {API_BASE}/storage/            │
         │       expedientes/upload             │
         │  Headers: Authorization Bearer       │
         │  Body: FormData { file, prospectoId }│
         └──────────┬───────────────────────────┘
                    │ si falla ↓
         ┌──── INTENTO 3: Blob URL local ──────┐
         │  URL.createObjectURL(file)           │
         │  storagePath = '' (NO en Storage)    │
         │  toast.warning("guardado localmente")│
         └──────────────────────────────────────┘
5. Persistencia local (sessionStorage)
Los expedientes se manejan con el hook useClienteSubtabList:

const { items, setItems } = useClienteSubtabList<Expediente>(
  clienteId || 'temp',   // ID del cliente
  'expedientes',          // nombre del subtab
  []                      // valor inicial vacío
);
// Clave en sessionStorage: "cliente_{clienteId}_expedientes_list"
Cada vez que items cambia, se serializa automáticamente a sessionStorage.

6. Cómo llega al JSONB de J_CLIENTES.data (handleSave)
En AltaClienteDefault.tsx, al guardar:

// Recuperar expedientes de sessionStorage
const subtabData = {
  expedientesElectronicos: recoverSubtab(
    cliente_${clienteId}_expedientes_list, 
    'expedientesElectronicos'  // fallback key en _rawData
  ),
  // ... otros subtabs ...
};

// En UPDATE: solo incluir subtabs CON datos
for (const [key, arr] of Object.entries(subtabData)) {
  if (Array.isArray(arr) && arr.length > 0) {
    dataJson[key] = arr;  // dataJson es el JSONB que se envía a la BD
  }
}
recoverSubtab intenta: 1) sessionStorage, 2) _rawData del cliente cargado.

7. Carga desde BD (al editar un cliente existente)
// En el useEffect de carga, busca en múltiples aliases del JSONB:
const candidates = [
  raw['expedientesElectronicos'], 
  raw['expedientes_electronicos'],
  raw['expedientes'], 
  raw['documents'], 
  raw['archivos'],
];
// El primero que sea Array no vacío → se usa

// Luego se "siembra" en sessionStorage para que el componente lo lea:
sessionStorage.setItem(
  cliente_${clienteId}_expedientes_list, 
  JSON.stringify(expedientesFromDB)
);
8. Resolución de URLs para Ver/Descargar (refreshSignedUrl)
Estrategia de 4 intentos para resolver la URL del archivo:

Intento	Método	Detalle
0	URL pública (HEAD)	GET /storage/v1/object/public/{bucket}/{path} — el más rápido
1	createSignedUrl	supabase.storage.from(bucket).createSignedUrl(path, 3600)
2	Download blob	supabase.storage.from(bucket).download(path) → URL.createObjectURL
3	Edge Function	POST /storage/expedientes/signed-url con { storagePath, bucket }
Cada intento prueba múltiples variantes de ruta × múltiples buckets.

Resumen para replicar
Si quieres replicar esta funcionalidad en otro módulo, necesitas:

Bucket: Usar el mismo bucket o crear uno nuevo (via bootstrap en Edge Function, public: true)
Upload: supabase.storage.from(BUCKET).upload(storagePath, file) → construir URL pública
JSON: Guardar en el JSONB del registro { nombre, url, storagePath, storageBucket, mime, tamanoKB, fechaCarga, ... }
Persistencia local: useClienteSubtabList con sessionStorage como cache
Visualización: refreshSignedUrl con fallbacks múltiples
Guardar a BD: Recuperar de sessionStorage en handleSave y meter como nodo del JSONB