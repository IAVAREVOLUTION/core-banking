import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-9a76e68a/health", (c) => {
  return c.json({ status: "ok" });
});

// Helper: parsear data que puede venir como string o como objeto JSONB
function parseClientData(raw: any): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

// Helper: crear conexión SQL con timeout y manejo de errores
// SINGLETON: Se reutiliza una sola instancia de pool para todas las peticiones.
// Usa el Connection Pooler de Supabase (puerto 6543) en vez de conexión directa (5432)
// para evitar CONNECT_TIMEOUT en Edge Functions.
let _sqlPool: ReturnType<typeof postgres> | null = null;

function getSql() {
  if (!_sqlPool) {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      throw new Error("DB_CONFIG_ERROR: SUPABASE_DB_URL no está configurada");
    }
    // Forzar uso del Connection Pooler (puerto 6543) en vez de conexión directa (5432).
    // El pooler de Supabase (Supavisor) es mucho más confiable desde Edge Functions.
    const poolerUrl = dbUrl.replace(/:5432\b/, ':6543');
    if (poolerUrl !== dbUrl) {
      console.log("[DB] URL ajustada: puerto 5432 → 6543 (Connection Pooler / Supavisor)");
    }
    _sqlPool = postgres(poolerUrl, {
      max: 5,
      connect_timeout: 10,
      idle_timeout: 20,
      max_lifetime: 90,
      // IMPORTANTE: El pooler en transaction mode no soporta prepared statements
      prepare: false,
    });
    console.log("[DB] Pool inicializado (max=5, connect_timeout=10s, prepare=false)");
  }
  return _sqlPool;
}

// Legacy alias — las rutas usan createSqlConnection() pero ahora retorna el pool singleton.
// IMPORTANTE: Ya NO se debe llamar sql.end() en cada ruta, porque el pool se reutiliza.
function createSqlConnection() {
  return getSql();
}

// Helper: clasificar error de conexión terminada y reiniciar pool si es necesario
function handleConnectionError(err: any) {
  const msg = err?.message || String(err);
  // Don't reset pool for client-side disconnects — not a DB issue
  if (msg.includes('connection closed before message completed')) return;
  if (msg.includes('CONNECT_TIMEOUT') || msg.includes('connection terminated') || 
      msg.includes('Connection terminated') || msg.includes('ended') ||
      msg.includes('write CONNECT_TIMEOUT') || msg.includes('ECONNREFUSED') ||
      msg.includes('terminated unexpectedly')) {
    console.log('[DB] Pool corrupto detectado, reiniciando...');
    try { _sqlPool?.end({ timeout: 0 }); } catch (_) { /* ignore */ }
    _sqlPool = null;
  }
}

// Helper: ejecutar query con retry automático (1 reintento tras resetear pool)
async function withRetry<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  try {
    return await fn(getSql());
  } catch (err: any) {
    const msg = err?.message || String(err);
    // Skip retry for client-side disconnects — these are NOT DB errors
    if (msg.includes('connection closed before message completed')) {
      throw err;
    }
    const isConnectionError = msg.includes('CONNECT_TIMEOUT') || msg.includes('connection terminated') || 
      msg.includes('Connection terminated') || msg.includes('ended') || msg.includes('ECONNREFUSED') ||
      msg.includes('write CONNECT_TIMEOUT') || msg.includes('connection refused') ||
      msg.includes('terminated unexpectedly');
    if (isConnectionError) {
      console.log(`[DB] Error de conexión: ${msg}. Reintentando con pool nuevo...`);
      try { _sqlPool?.end({ timeout: 0 }); } catch (_) { /* ignore */ }
      _sqlPool = null;
      // Segundo intento con pool nuevo
      return await fn(getSql());
    }
    throw err;
  }
}

// Helper: clasificar error de base de datos para respuesta al cliente
function classifyDbError(err: any): { message: string; status: number; code: string } {
  const msg = err?.message || String(err);

  // Si hay error de conexión, resetear pool para que la próxima petición reconecte
  handleConnectionError(err);

  if (msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("connect_timeout") || msg.includes("CONNECT_TIMEOUT")) {
    return { message: "El servidor está tardando en responder. Intenta de nuevo en unos segundos.", status: 503, code: "DB_TIMEOUT" };
  }
  if (msg.includes("ECONNREFUSED") || msg.includes("connection refused")) {
    return { message: "No se pudo conectar al servidor de datos. Intenta más tarde.", status: 503, code: "DB_CONNECTION_REFUSED" };
  }
  if (msg.includes("relation") && msg.includes("does not exist")) {
    return { message: "Error de configuración interna. Contacta soporte.", status: 500, code: "DB_TABLE_NOT_FOUND" };
  }
  if (msg.includes("permission denied") || msg.includes("insufficient_privilege")) {
    return { message: "Error de permisos en el servidor. Contacta soporte.", status: 500, code: "DB_PERMISSION_DENIED" };
  }
  if (msg.includes("too many connections") || msg.includes("remaining connection slots")) {
    return { message: "El servidor está saturado. Intenta de nuevo en unos momentos.", status: 503, code: "DB_POOL_EXHAUSTED" };
  }
  return { message: `Error interno del servidor: ${msg}`, status: 500, code: "DB_UNKNOWN_ERROR" };
}

// Helper: crear cliente Supabase con SERVICE_ROLE_KEY (admin)
// SINGLETON: Se reutiliza una sola instancia para evitar overhead de creación en cada request.
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function createSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      throw new Error("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas");
    }
    _supabaseAdmin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("[SUPABASE] Admin client singleton inicializado");
  }
  return _supabaseAdmin;
}

// ── In-memory cache: authUserId (UUID) → { clienteId, subtipo, data } ──
// TTL: 5 minutos. Evita repetir la consulta JSONB en J_CLIENTES en cada request.
const _clienteCache = new Map<string, { clienteId: string; subtipo: string; data: any; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function getCachedCliente(authUserId: string) {
  const entry = _clienteCache.get(authUserId);
  if (entry && (Date.now() - entry.ts) < CACHE_TTL_MS) return entry;
  if (entry) _clienteCache.delete(authUserId); // expired
  return null;
}

function setCachedCliente(authUserId: string, clienteId: string, subtipo: string, data: any) {
  // Evitar que el cache crezca indefinidamente
  if (_clienteCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of _clienteCache) {
      if (now - v.ts > CACHE_TTL_MS) _clienteCache.delete(k);
    }
  }
  _clienteCache.set(authUserId, { clienteId, subtipo, data, ts: Date.now() });
}

function invalidateCachedCliente(authUserId: string) {
  _clienteCache.delete(authUserId);
}

// Helper: buscar clienteId a partir de authUserId, con cache
async function lookupClienteId(sql: ReturnType<typeof postgres>, authUserId: string): Promise<{ clienteId: string; subtipo: string; data: any } | null> {
  const cached = getCachedCliente(authUserId);
  if (cached) {
    return { clienteId: cached.clienteId, subtipo: cached.subtipo, data: cached.data };
  }
  const result = await sql`
    SELECT id, subtipo, data
    FROM "EFINANCIANET_DB"."J_CLIENTES"
    WHERE (data->>'authUserId') = ${authUserId}
    LIMIT 1
  `;
  if (result.length === 0) return null;
  const row = result[0];
  const clienteId = String(row.id);
  const subtipo = row.subtipo || '';
  const data = parseClientData(row.data) || {};
  setCachedCliente(authUserId, clienteId, subtipo, data);
  return { clienteId, subtipo, data };
}

// Helper: extraer y validar usuario del JWT via Supabase Auth
// El frontend envía el JWT del usuario en X-User-Token (porque Authorization
// lleva el publicAnonKey que exige el gateway de Supabase Edge Functions).
async function extractAuthUser(c: any): Promise<{ id: string; email: string } | null> {
  // Primario: header custom X-User-Token
  // Fallback: Authorization Bearer (para compatibilidad)
  const userToken = c.req.header("X-User-Token");
  const authHeader = c.req.header("Authorization")?.split(" ")[1];
  const accessToken = userToken || authHeader;

  if (!accessToken) {
    console.log("Auth: No se encontró token en X-User-Token ni Authorization");
    return null;
  }
  try {
    const supabase = createSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user?.id) {
      console.log(`Auth: Token inválido o expirado: ${error?.message || "user not found"}`);
      return null;
    }
    return { id: user.id, email: user.email || "" };
  } catch (err: any) {
    console.log(`Auth: Error validando token: ${err.message}`);
    return null;
  }
}

// ── Warm up DB pool on startup (reduce cold-start latency) ──
(async () => {
  try {
    const sql = getSql();
    await sql`SELECT 1`;
    console.log("[DB] Warm-up: conexión verificada exitosamente");
  } catch (err: any) {
    console.log(`[DB] Warm-up falló (se reintentará en la primera petición): ${err.message}`);
    _sqlPool = null;
  }
})();

// Inicializar bucket de expedientes electrónicos al arrancar el servidor
const CONSTANCIAS_BUCKET = "make-7e2d13d9-expedientes-electronicos-prospectos";
const EXPEDIENTE_SOLICITUD_BUCKET = "make-9a76e68a-expediente-solicitudes";
(async () => {
  try {
    const supabase = createSupabaseAdmin();
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket: any) => bucket.name === CONSTANCIAS_BUCKET);
    if (!bucketExists) {
      await supabase.storage.createBucket(CONSTANCIAS_BUCKET, { public: false });
      console.log(`Bucket "${CONSTANCIAS_BUCKET}" creado exitosamente`);
    } else {
      console.log(`Bucket "${CONSTANCIAS_BUCKET}" ya existe`);
    }
  } catch (err: any) {
    console.log(`Error inicializando bucket de constancias: ${err.message}`);
  }
})();

// Inicializar bucket para documentos de expediente de solicitudes
(async () => {
  try {
    const supabase = createSupabaseAdmin();
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket: any) => bucket.name === EXPEDIENTE_SOLICITUD_BUCKET);
    if (!bucketExists) {
      await supabase.storage.createBucket(EXPEDIENTE_SOLICITUD_BUCKET, { public: false });
      console.log(`Bucket "${EXPEDIENTE_SOLICITUD_BUCKET}" creado exitosamente`);
    } else {
      console.log(`Bucket "${EXPEDIENTE_SOLICITUD_BUCKET}" ya existe`);
    }
  } catch (err: any) {
    console.log(`Error inicializando bucket de expediente solicitudes: ${err.message}`);
  }
})();

// ═════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN — Delegada a Supabase Auth
// ═══════════════════════════════════════════════════════════════════════

// Endpoint: Registrar usuario nuevo (Supabase Auth + J_CLIENTES)
app.post("/make-server-9a76e68a/signup", async (c) => {
  const sql = createSqlConnection();

  try {
    const body = await c.req.json();
    const {
      curp,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      correoElectronico,
      telefono,
      fechaNacimiento,
      sexo,
      institucionGobierno,
      expedientesElectronicos,
      contrasena,
    } = body;

    // Validate required fields
    if (!correoElectronico || !contrasena || !nombre || !apellidoPaterno || !curp || !telefono) {
      return c.json({ error: "Faltan campos obligatorios para el registro" }, 400);
    }

    // Validar contraseña mínima (Supabase requiere >= 6 caracteres)
    if (contrasena.length < 6) {
      return c.json({ error: "La contraseña debe tener al menos 6 caracteres", code: "WEAK_PASSWORD" }, 400);
    }

    console.log(`[SIGNUP] Iniciando registro para: ${correoElectronico}`);
    console.log(`[SIGNUP] Password length: ${contrasena.length} chars`);

    // 1. Crear usuario en Supabase Auth (Identity Layer)
    const supabase = createSupabaseAdmin();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: correoElectronico,
      password: contrasena,
      user_metadata: {
        nombre,
        apellidoPaterno,
        apellidoMaterno: apellidoMaterno || null,
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (authError) {
      console.log(`[SIGNUP] ERROR Supabase Auth: ${authError.message}`);
      console.log(`[SIGNUP] ERROR details: ${JSON.stringify(authError)}`);
      if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
        return c.json({ error: "Ya existe una cuenta registrada con ese correo electrónico.", code: "EMAIL_DUPLICATE" }, 409);
      }
      return c.json({ error: `Error al crear cuenta: ${authError.message}`, code: "AUTH_ERROR" }, 500);
    }

    const authUserId = authData.user?.id;
    if (!authUserId) {
      console.log("[SIGNUP] ERROR: Supabase Auth no devolvió UUID del usuario creado");
      console.log(`[SIGNUP] authData: ${JSON.stringify(authData)}`);
      return c.json({ error: "Error interno al crear cuenta de autenticación", code: "AUTH_NO_UUID" }, 500);
    }

    // Verificar que el usuario se creó correctamente
    console.log(`[SIGNUP] Usuario creado en auth.users — UUID: ${authUserId}`);
    console.log(`[SIGNUP] Email confirmed: ${authData.user?.email_confirmed_at ? 'SI' : 'NO'}`);
    console.log(`[SIGNUP] User role: ${authData.user?.role}`);
    console.log(`[SIGNUP] User identities: ${authData.user?.identities?.length || 0}`);

    // 2. Verificación extra: confirmar que el usuario existe en auth.users
    const { data: verifyData, error: verifyError } = await supabase.auth.admin.getUserById(authUserId);
    if (verifyError || !verifyData.user) {
      console.log(`[SIGNUP] ADVERTENCIA: No se pudo verificar usuario post-creación: ${verifyError?.message}`);
    } else {
      console.log(`[SIGNUP] Verificación post-creación OK — email: ${verifyData.user.email}, confirmed: ${!!verifyData.user.email_confirmed_at}`);
    }

    // 3. Insertar datos de dominio en J_CLIENTES (Domain Layer)
    //    SIN contrasena — el password vive SOLO en auth.users
    const dataJson: Record<string, any> = {
      authUserId,
      curp,
      nombre,
      apellidoPaterno,
      apellidoMaterno: apellidoMaterno || null,
      correoElectronico,
      telefono,
      fechaNacimiento: fechaNacimiento || null,
      sexo: sexo || null,
      institucionGobierno: institucionGobierno || null,
      expedientesElectronicos: Array.isArray(expedientesElectronicos) ? expedientesElectronicos : [],
      // NO contrasena — eliminada de la tabla de dominio
    };

    const result = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CLIENTES" (type, subtipo, estatus, data)
      VALUES (
        'Prospecto',
        'Persona Fisica',
        'Pendiente',
        ${sql.json(dataJson)}
      )
      RETURNING id
    `;

    const clienteId = result[0]?.id;
    console.log(`Prospecto registrado en J_CLIENTES (row id: ${clienteId}) vinculado a auth UUID: ${authUserId}`);

    // 4. Si hay expedientesElectronicos con archivos en storage, mover al path definitivo con authUserId
    const expedientes: any[] = Array.isArray(expedientesElectronicos) ? expedientesElectronicos : [];
    if (expedientes.length > 0) {
      let needsUpdate = false;
      const updatedExpedientes: any[] = [];

      for (const doc of expedientes) {
        if (doc && doc.storagePath) {
          try {
            const supabaseStorage = createSupabaseAdmin();
            const oldPath = doc.storagePath;
            const fileName = oldPath.split('/').pop() || `constancia_${Date.now()}.bin`;
            const newPath = `expedientes-electronicos/prospectos/${authUserId}/${fileName}`;

            // Mover archivo en storage (copy + delete)
            const { error: copyError } = await supabaseStorage.storage
              .from(CONSTANCIAS_BUCKET)
              .copy(oldPath, newPath);

            if (!copyError) {
              // Eliminar archivo temporal
              await supabaseStorage.storage.from(CONSTANCIAS_BUCKET).remove([oldPath]);
              console.log(`[SIGNUP] Expediente movido de ${oldPath} → ${newPath}`);

              updatedExpedientes.push({
                id: doc.id || clienteId,
                mime: doc.mime || 'application/octet-stream',
                nombre: doc.nombre || fileName,
                estatus: doc.estatus || 'Pendiente',
                tamanoKB: doc.tamanoKB || 0,
                fechaCarga: doc.fechaCarga || new Date().toISOString().split('T')[0],
                storagePath: newPath,
                tipoDocumento: doc.tipoDocumento || 'Documento',
              });
              needsUpdate = true;
            } else {
              console.log(`[SIGNUP] No se pudo mover expediente (copy error): ${copyError.message}. Se mantiene path temporal.`);
              // Guardar la estructura completa con el path temporal
              updatedExpedientes.push({
                id: doc.id || clienteId,
                mime: doc.mime || 'application/octet-stream',
                nombre: doc.nombre || fileName,
                estatus: doc.estatus || 'Pendiente',
                tamanoKB: doc.tamanoKB || 0,
                fechaCarga: doc.fechaCarga || new Date().toISOString().split('T')[0],
                storagePath: oldPath,
                tipoDocumento: doc.tipoDocumento || 'Documento',
              });
              needsUpdate = true;
            }
          } catch (moveErr: any) {
            console.log(`[SIGNUP] Error moviendo expediente: ${moveErr.message}. Se mantiene sin cambios.`);
            updatedExpedientes.push(doc);
          }
        } else {
          // Documento sin storagePath, conservar tal cual
          updatedExpedientes.push(doc);
        }
      }

      if (needsUpdate) {
        dataJson.expedientesElectronicos = updatedExpedientes;
        await sql`
          UPDATE "EFINANCIANET_DB"."J_CLIENTES"
          SET data = ${sql.json(dataJson)}
          WHERE id = ${clienteId}
        `;
        console.log(`[SIGNUP] expedientesElectronicos actualizados en J_CLIENTES (${updatedExpedientes.length} documentos)`);
      }
    }

    return c.json({
      success: true,
      message: "Registro completado exitosamente",
      authUserId,
      clienteId,
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /signup: ${err.message}`);
    return c.json(
      { error: `Error al registrar: ${dbError.message}`, code: dbError.code },
      dbError.status
    );
  }
});

// Endpoint: Obtener perfil del usuario autenticado (protegido con JWT)
app.get("/make-server-9a76e68a/me", async (c) => {
  const authUser = await extractAuthUser(c);
  if (!authUser) {
    return c.json({ error: "No autorizado. Token inválido o expirado.", code: "UNAUTHORIZED" }, 401);
  }

  try {
    const cliente = await withRetry(async (sql) => {
      // 1. Intentar cache primero (evita hit a BD)
      const cached = getCachedCliente(authUser.id);
      if (cached) {
        // Necesitamos type y estatus que no están en el cache, hacer query ligera
        const result = await sql`
          SELECT id, type, subtipo, estatus, data
          FROM "EFINANCIANET_DB"."J_CLIENTES"
          WHERE id = ${cached.clienteId}
          LIMIT 1
        `;
        if (result[0]) return result[0];
      }

      // 2. Buscar por authUserId (JSONB index scan)
      const result = await sql`
        SELECT id, type, subtipo, estatus, data
        FROM "EFINANCIANET_DB"."J_CLIENTES"
        WHERE (data->>'authUserId') = ${authUser.id}
        LIMIT 1
      `;

      let found = result[0];
      if (!found) {
        // Fallback simplificado: buscar solo por correoElectronico (sin jsonb_typeof costoso)
        const fallback = await sql`
          SELECT id, type, subtipo, estatus, data
          FROM "EFINANCIANET_DB"."J_CLIENTES"
          WHERE (data->>'correoElectronico') = ${authUser.email}
          LIMIT 1
        `;
        found = fallback[0];

        // Si encontramos por email, vincular authUserId y cachear
        if (found) {
          const cd = parseClientData(found.data) || {};
          cd.authUserId = authUser.id;
          await sql`
            UPDATE "EFINANCIANET_DB"."J_CLIENTES"
            SET data = ${sql.json(cd)}
            WHERE id = ${found.id}
          `;
          console.log(`Migración: authUserId vinculado a J_CLIENTES id=${found.id} para ${authUser.email}`);
        }
      }

      // Cachear resultado para próximas peticiones
      if (found) {
        const fd = parseClientData(found.data) || {};
        setCachedCliente(authUser.id, String(found.id), found.subtipo || '', fd);
      }

      return found;
    });

    if (!cliente) {
      console.log(`/me: No se encontró perfil de dominio para authUserId=${authUser.id} / email=${authUser.email}`);
      return c.json({
        error: "No se encontró perfil de cliente asociado a tu cuenta.",
        code: "PROFILE_NOT_FOUND",
      }, 404);
    }

    const clientData = parseClientData(cliente.data) || {};

    console.log(`/me: Perfil encontrado para ${authUser.email} — estatus: ${cliente.estatus}`);

    return c.json({
      success: true,
      cliente: {
        id: cliente.id,
        authUserId: authUser.id,
        type: cliente.type,
        subtipo: cliente.subtipo,
        estatus: cliente.estatus,
        nombre: clientData.nombre || "",
        apellidoPaterno: clientData.apellidoPaterno || "",
        apellidoMaterno: clientData.apellidoMaterno || "",
        correoElectronico: clientData.correoElectronico || authUser.email,
        telefono: clientData.telefono || "",
        curp: clientData.curp || "",
        fechaNacimiento: clientData.fechaNacimiento || "",
        sexo: clientData.sexo || "",
      },
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /me: ${err.message}`);
    return c.json({ error: `Error al obtener perfil: ${dbError.message}` }, dbError.status);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ENDPOINTS EXISTENTES (mantenidos, ahora protegidos con JWT donde aplica)
// ═══════════════════════════════════════════════════════════════════════

// Endpoint: Subir constancia de residencia a Supabase Storage
app.post("/make-server-9a76e68a/upload-constancia", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ error: "No se recibió ningún archivo" }, 400);
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "Tipo de archivo no permitido. Solo PDF, JPG y PNG." }, 400);
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return c.json({ error: "El archivo excede el tamaño máximo de 5MB." }, 400);
    }

    const supabase = createSupabaseAdmin();
    const ext = file.name.split(".").pop() || "bin";
    const uniqueName = `constancia_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`;
    const storagePath = `expedientes-electronicos/prospectos/temp/${uniqueName}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(CONSTANCIAS_BUCKET)
      .upload(storagePath, uint8, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.log(`Error subiendo constancia a storage: ${uploadError.message}`);
      return c.json({ error: `Error al subir archivo: ${uploadError.message}` }, 500);
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(CONSTANCIAS_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (signedUrlError) {
      console.log(`Error generando signed URL: ${signedUrlError.message}`);
      return c.json({ error: `Error generando URL del archivo: ${signedUrlError.message}` }, 500);
    }

    console.log(`Constancia subida exitosamente: ${storagePath}`);

    return c.json({
      success: true,
      storagePath,
      signedUrl: signedUrlData?.signedUrl || null,
      fileName: file.name,
    });
  } catch (err: any) {
    console.log(`Error in /upload-constancia: ${err.message}`);
    return c.json({ error: `Error interno al subir archivo: ${err.message}` }, 500);
  }
});

// Endpoint: Buscar instituciones de gobierno desde J_CLIENTES
app.get("/make-server-9a76e68a/instituciones-gobierno", async (c) => {
  const sql = createSqlConnection();

  try {
    const search = c.req.query("search") || "";
    const page = parseInt(c.req.query("page") || "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") || "10", 10);
    const offset = (page - 1) * pageSize;

    let countResult;
    let dataResult;

    if (search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM "EFINANCIANET_DB"."J_CLIENTES"
        WHERE (data->>'clasificacionCliente') = 'Gobierno Magisterio'
          AND (
            (data->>'nombreCompleto') ILIKE ${searchPattern}
            OR (data->>'razonSocial') ILIKE ${searchPattern}
            OR (data->>'clasificacionCliente') ILIKE ${searchPattern}
          )
      `;
      dataResult = await sql`
        SELECT *
        FROM "EFINANCIANET_DB"."J_CLIENTES"
        WHERE (data->>'clasificacionCliente') = 'Gobierno Magisterio'
          AND (
            (data->>'nombreCompleto') ILIKE ${searchPattern}
            OR (data->>'razonSocial') ILIKE ${searchPattern}
            OR (data->>'clasificacionCliente') ILIKE ${searchPattern}
          )
        ORDER BY (data->>'razonSocial') ASC NULLS LAST, (data->>'nombreCompleto') ASC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else {
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM "EFINANCIANET_DB"."J_CLIENTES"
        WHERE (data->>'clasificacionCliente') = 'Gobierno Magisterio'
      `;
      dataResult = await sql`
        SELECT *
        FROM "EFINANCIANET_DB"."J_CLIENTES"
        WHERE (data->>'clasificacionCliente') = 'Gobierno Magisterio'
        ORDER BY (data->>'razonSocial') ASC NULLS LAST, (data->>'nombreCompleto') ASC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    }

    const total = parseInt(countResult[0]?.total || "0", 10);
    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      data: dataResult || [],
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /instituciones-gobierno: ${err.message}`);
    return c.json(
      { error: `Error al consultar instituciones: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Obtener notificaciones no leídas (protegido con JWT)
app.get("/make-server-9a76e68a/notificaciones", async (c) => {
  try {
    // Aceptar user_id como query param (para compatibilidad)
    // o extraer del JWT si está presente
    let userId = c.req.query("user_id");
    
    if (!userId) {
      const authUser = await extractAuthUser(c);
      if (authUser) {
        userId = authUser.id;
      }
    }

    if (!userId) {
      return c.json({ error: "El parámetro user_id es obligatorio" }, 400);
    }

    console.log(`[NOTIF] Buscando notificaciones para user_id=${userId}`);

    // Resolver UUID → clienteId FUERA del withRetry principal para no duplicar lookup en reintentos
    const isNumeric = /^\d+$/.test(userId);
    let effectiveUserId = userId;

    if (!isNumeric) {
      const lookup = await withRetry(async (sql) => lookupClienteId(sql, userId!));
      if (lookup) {
        effectiveUserId = lookup.clienteId;
        console.log(`[NOTIF] UUID ${userId} → clienteId = ${effectiveUserId}`);
      } else {
        console.log(`[NOTIF] No se encontró J_CLIENTES para authUserId=${userId}. Retornando vacío.`);
        return c.json({ success: true, notificaciones: [] });
      }
    }

    const numericId = parseInt(effectiveUserId, 10);
    const result = await withRetry(async (sql) => {
      return await sql`
        SELECT id, title, message, type, description, created_at, read
        FROM "EFINANCIANET_DB"."NOTIFICACIONES"
        WHERE user_id = ${numericId}
          AND read = false
        ORDER BY created_at DESC
        LIMIT 50
      `;
    });

    console.log(`[NOTIF] Notificaciones no leídas para user_id=${userId}: ${result.length} encontradas`);

    return c.json({
      success: true,
      notificaciones: result || [],
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /notificaciones: ${err.message}`);
    return c.json(
      { error: `Error al consultar notificaciones: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Marcar notificación como leída
app.put("/make-server-9a76e68a/notificaciones/:id/leer", async (c) => {
  const sql = createSqlConnection();

  try {
    const notifId = c.req.param("id");
    if (!notifId) {
      return c.json({ error: "ID de notificación inválido" }, 400);
    }

    await sql`
      UPDATE "EFINANCIANET_DB"."NOTIFICACIONES"
      SET read = true
      WHERE id = ${notifId}
    `;

    console.log(`Notificación ${notifId} marcada como leída`);

    return c.json({ success: true });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /notificaciones/:id/leer: ${err.message}`);
    return c.json(
      { error: `Error al marcar notificación: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Marcar todas las notificaciones de un usuario como leídas
app.put("/make-server-9a76e68a/notificaciones/leer-todas", async (c) => {
  const sql = createSqlConnection();

  try {
    const body = await c.req.json();
    const { user_id } = body;

    if (!user_id) {
      return c.json({ error: "user_id es obligatorio" }, 400);
    }

    await sql`
      UPDATE "EFINANCIANET_DB"."NOTIFICACIONES"
      SET read = true
      WHERE user_id = ${user_id}
        AND read = false
    `;

    console.log(`Todas las notificaciones de user_id=${user_id} marcadas como leídas`);

    return c.json({ success: true });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /notificaciones/leer-todas: ${err.message}`);
    return c.json(
      { error: `Error al marcar notificaciones: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Verificar estado de un usuario en auth.users (DIAGNÓSTICO)
app.get("/make-server-9a76e68a/debug-auth-user", async (c) => {
  try {
    const email = c.req.query("email");
    if (!email) {
      return c.json({ error: "El parámetro email es obligatorio" }, 400);
    }

    const supabase = createSupabaseAdmin();

    // Listar usuarios y buscar por email
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 50,
    });

    if (listError) {
      return c.json({ error: `Error listando usuarios: ${listError.message}` }, 500);
    }

    const matchedUser = listData.users?.find((u: any) => u.email === email);
    
    if (!matchedUser) {
      return c.json({
        found: false,
        email,
        message: "No se encontró usuario con ese email en auth.users",
        totalAuthUsers: listData.users?.length || 0,
      });
    }

    return c.json({
      found: true,
      email: matchedUser.email,
      id: matchedUser.id,
      email_confirmed_at: matchedUser.email_confirmed_at,
      created_at: matchedUser.created_at,
      updated_at: matchedUser.updated_at,
      role: matchedUser.role,
      has_identities: (matchedUser.identities?.length || 0) > 0,
      identities_count: matchedUser.identities?.length || 0,
      user_metadata: matchedUser.user_metadata,
      last_sign_in_at: matchedUser.last_sign_in_at,
    });
  } catch (err: any) {
    console.log(`Error in /debug-auth-user: ${err.message}`);
    return c.json({ error: `Error: ${err.message}` }, 500);
  }
});

// Endpoint: Verificar si un correo ya está registrado en J_CLIENTES
app.get("/make-server-9a76e68a/check-email", async (c) => {
  const sql = createSqlConnection();

  try {
    const email = c.req.query("email");
    if (!email) {
      return c.json({ error: "El parámetro email es obligatorio" }, 400);
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Buscar en J_CLIENTES por data->>'correoElectronico' (case-insensitive)
    const result = await sql`
      SELECT id
      FROM "EFINANCIANET_DB"."J_CLIENTES"
      WHERE LOWER(data->>'correoElectronico') = ${trimmedEmail}
      LIMIT 1
    `;

    const exists = result.length > 0;
    console.log(`[CHECK-EMAIL] ${trimmedEmail} → ${exists ? 'YA EXISTE (id=' + result[0].id + ')' : 'DISPONIBLE'}`);

    return c.json({ exists });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /check-email: ${err.message}`);
    return c.json(
      { error: `Error al verificar correo: ${dbError.message}`, code: dbError.code },
      dbError.status
    );
  }
});

// ──────────────────────────────────────────────────────────
// COTIZACIONES
// ──────────────────────────────────────────────────────────

// Endpoint: Buscar productos de captación
// Consulta J_PRODUCTOS donde type = 'Captación'
app.get("/make-server-9a76e68a/productos-captacion", async (c) => {
  const sql = createSqlConnection();

  try {
    const search = c.req.query("search") || "";
    const page = parseInt(c.req.query("page") || "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") || "10", 10);
    const offset = (page - 1) * pageSize;

    let countResult;
    let dataResult;

    if (search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE type = 'Captación'
          AND (
            (data->>'claveProducto') ILIKE ${searchPattern}
            OR (data->>'nombreProducto') ILIKE ${searchPattern}
            OR (data->>'tipoProducto') ILIKE ${searchPattern}
          )
      `;
      dataResult = await sql`
        SELECT *
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE type = 'Captación'
          AND (
            (data->>'claveProducto') ILIKE ${searchPattern}
            OR (data->>'nombreProducto') ILIKE ${searchPattern}
            OR (data->>'tipoProducto') ILIKE ${searchPattern}
          )
        ORDER BY (data->>'nombreProducto') ASC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else {
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE type = 'Captación'
      `;
      dataResult = await sql`
        SELECT *
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE type = 'Captación'
        ORDER BY (data->>'nombreProducto') ASC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    }

    const total = parseInt(countResult[0]?.total || "0", 10);
    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      data: dataResult || [],
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /productos-captacion: ${err.message}`);
    return c.json(
      { error: `Error al consultar productos: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Buscar productos de línea de crédito
// Consulta J_PRODUCTOS donde data.tipoProducto = 'Linea de Credito'
app.get("/make-server-9a76e68a/productos-linea-credito", async (c) => {
  const sql = createSqlConnection();

  try {
    const search = c.req.query("search") || "";
    const page = parseInt(c.req.query("page") || "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") || "10", 10);
    const offset = (page - 1) * pageSize;

    let countResult;
    let dataResult;

    if (search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE (data->>'tipoProducto') = 'Linea de Credito'
          AND (
            (data->>'nombre') ILIKE ${searchPattern}
            OR (data->>'claveProducto') ILIKE ${searchPattern}
            OR (data->>'nombreProducto') ILIKE ${searchPattern}
            OR (data->'datosGenerales'->>'claveProducto') ILIKE ${searchPattern}
            OR (data->'datosGenerales'->>'nombreProducto') ILIKE ${searchPattern}
            OR (data->'default'->>'clave') ILIKE ${searchPattern}
          )
      `;
      dataResult = await sql`
        SELECT *
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE (data->>'tipoProducto') = 'Linea de Credito'
          AND (
            (data->>'nombre') ILIKE ${searchPattern}
            OR (data->>'claveProducto') ILIKE ${searchPattern}
            OR (data->>'nombreProducto') ILIKE ${searchPattern}
            OR (data->'datosGenerales'->>'claveProducto') ILIKE ${searchPattern}
            OR (data->'datosGenerales'->>'nombreProducto') ILIKE ${searchPattern}
            OR (data->'default'->>'clave') ILIKE ${searchPattern}
          )
        ORDER BY COALESCE(data->>'nombre', data->>'nombreProducto') ASC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else {
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE (data->>'tipoProducto') = 'Linea de Credito'
      `;
      dataResult = await sql`
        SELECT *
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE (data->>'tipoProducto') = 'Linea de Credito'
        ORDER BY COALESCE(data->>'nombre', data->>'nombreProducto') ASC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    }

    const total = parseInt(countResult[0]?.total || "0", 10);
    const totalPages = Math.ceil(total / pageSize);

    console.log(`[PRODUCTOS-LINEA-CREDITO] page=${page}, search="${search}", total=${total}`);

    return c.json({
      data: dataResult || [],
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /productos-linea-credito: ${err.message}`);
    return c.json(
      { error: `Error al consultar productos de línea de crédito: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Buscar productos de crédito
// Consulta J_PRODUCTOS donde type = 'Credito' OR data.lineaProducto = 'Credito'
app.get("/make-server-9a76e68a/productos-credito", async (c) => {
  const sql = createSqlConnection();

  try {
    const search = c.req.query("search") || "";
    const page = parseInt(c.req.query("page") || "1", 10);
    const pageSize = parseInt(c.req.query("pageSize") || "10", 10);
    const offset = (page - 1) * pageSize;

    let countResult;
    let dataResult;

    if (search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE (type = 'Credito' OR (data->>'lineaProducto') = 'Credito')
          AND (
            (data->>'nombre') ILIKE ${searchPattern}
            OR (data->>'claveProducto') ILIKE ${searchPattern}
            OR (data->>'nombreProducto') ILIKE ${searchPattern}
            OR (data->'default'->>'clave') ILIKE ${searchPattern}
            OR (data->'datosGenerales'->>'claveProducto') ILIKE ${searchPattern}
            OR (data->'datosGenerales'->>'nombreProducto') ILIKE ${searchPattern}
          )
      `;
      dataResult = await sql`
        SELECT *
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE (type = 'Credito' OR (data->>'lineaProducto') = 'Credito')
          AND (
            (data->>'nombre') ILIKE ${searchPattern}
            OR (data->>'claveProducto') ILIKE ${searchPattern}
            OR (data->>'nombreProducto') ILIKE ${searchPattern}
            OR (data->'default'->>'clave') ILIKE ${searchPattern}
            OR (data->'datosGenerales'->>'claveProducto') ILIKE ${searchPattern}
            OR (data->'datosGenerales'->>'nombreProducto') ILIKE ${searchPattern}
          )
        ORDER BY COALESCE(data->>'nombre', data->>'nombreProducto') ASC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else {
      countResult = await sql`
        SELECT COUNT(*) as total
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE (type = 'Credito' OR (data->>'lineaProducto') = 'Credito')
      `;
      dataResult = await sql`
        SELECT *
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE (type = 'Credito' OR (data->>'lineaProducto') = 'Credito')
        ORDER BY COALESCE(data->>'nombre', data->>'nombreProducto') ASC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    }

    const total = parseInt(countResult[0]?.total || "0", 10);
    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      data: dataResult || [],
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /productos-credito: ${err.message}`);
    return c.json(
      { error: `Error al consultar productos de crédito: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Listar cotizaciones del usuario autenticado (protegido con JWT)
app.get("/make-server-9a76e68a/cotizaciones", async (c) => {
  try {
    // Validar usuario autenticado
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado. Inicia sesión para ver tus cotizaciones." }, 401);
    }

    const { clienteId, cotizaciones } = await withRetry(async (sql) => {
      // Buscar el cliente_id usando cache
      const lookup = await lookupClienteId(sql, authUser.id);
      if (!lookup) {
        return { clienteId: null, cotizaciones: [] };
      }

      const cId = lookup.clienteId;

      // Obtener cotizaciones del cliente, ordenadas por fecha_cotiza descendente
      const rows = await sql`
        SELECT id, no_cotiza, descripcion, producto_id, cliente_id, fecha_cotiza, estatus_cotiza, linea_cotizacion, data
        FROM "EFINANCIANET_DB"."J_COTIZACIONES"
        WHERE cliente_id = ${String(cId)}
        ORDER BY fecha_cotiza DESC
      `;

      return { clienteId: cId, cotizaciones: rows };
    });

    if (clienteId === null) {
      return c.json({ error: "No se encontró el perfil de cliente asociado a tu cuenta." }, 404);
    }

    console.log(`[COTIZACIONES] GET: ${cotizaciones.length} cotizaciones para cliente_id=${clienteId}`);

    return c.json({
      success: true,
      cotizaciones,
      total: cotizaciones.length,
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in GET /cotizaciones: ${err.message}`);
    return c.json(
      { error: `Error al obtener cotizaciones: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Crear cotización (protegido con JWT)
app.post("/make-server-9a76e68a/cotizaciones", async (c) => {
  const sql = createSqlConnection();

  try {
    // Validar usuario autenticado
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado. Inicia sesión para crear una cotización." }, 401);
    }

    // Buscar el cliente_id usando cache
    const lookup = await lookupClienteId(sql, authUser.id);
    if (!lookup) {
      return c.json({ error: "No se encontró el perfil de cliente asociado a tu cuenta." }, 404);
    }

    const clienteId = lookup.clienteId;

    const body = await c.req.json();
    const { producto_id, fecha_cotiza, data: cotizacionData, linea_cotizacion: lineaParam } = body;

    if (!cotizacionData) {
      return c.json({ error: "El campo 'data' es obligatorio." }, 400);
    }
    if (!producto_id) {
      return c.json({ error: "producto_id es obligatorio." }, 400);
    }
    if (!fecha_cotiza) {
      return c.json({ error: "fecha_cotiza es obligatorio." }, 400);
    }

    // linea_cotizacion: si viene en el body, usar ese; si no, default 'Captación'
    const lineaCotizacion = lineaParam || 'Captación';

    // Insertar en J_COTIZACIONES con UUID autogenerado y no_cotiza construido
    const result = await sql`
      WITH new_id AS (
        SELECT gen_random_uuid() AS uuid
      )
      INSERT INTO "EFINANCIANET_DB"."J_COTIZACIONES" (
        id,
        no_cotiza,
        descripcion,
        producto_id,
        cliente_id,
        fecha_cotiza,
        estatus_cotiza,
        linea_cotizacion,
        data
      )
      SELECT
        new_id.uuid,
        'COT-' || LEFT(${String(clienteId)}::text, 8) || '-' || LEFT(new_id.uuid::text, 8),
        '',
        ${String(producto_id)},
        ${String(clienteId)},
        ${fecha_cotiza}::date,
        'Pendiente',
        ${lineaCotizacion},
        ${sql.json(cotizacionData)}
      FROM new_id
      RETURNING id, no_cotiza, descripcion, producto_id, cliente_id, fecha_cotiza, estatus_cotiza, linea_cotizacion, data
    `;

    const inserted = result[0];
    console.log(`[COTIZACIONES] Cotización creada: id=${inserted.id}, no_cotiza=${inserted.no_cotiza}, cliente_id=${clienteId}, producto_id=${producto_id}`);

    return c.json({
      success: true,
      cotizacion: inserted,
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in POST /cotizaciones: ${err.message}`);
    return c.json(
      { error: `Error al crear cotización: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Crear calendario de pagos (protegido con JWT)
app.post("/make-server-9a76e68a/calendario-pagos", async (c) => {
  const sql = createSqlConnection();

  try {
    // Validar usuario autenticado
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado. Inicia sesión para crear un calendario de pagos." }, 401);
    }

    // Buscar el cliente_id usando cache
    const lookup = await lookupClienteId(sql, authUser.id);
    if (!lookup) {
      return c.json({ error: "No se encontró el perfil de cliente asociado a tu cuenta." }, 404);
    }

    const clienteId = lookup.clienteId;

    const body = await c.req.json();
    const { data: calendarData } = body;

    if (!calendarData) {
      return c.json({ error: "El campo 'data' es obligatorio." }, 400);
    }

    if (!calendarData.calendario || calendarData.calendario.length === 0) {
      return c.json({ error: "El calendario de aportaciones no puede estar vacío." }, 400);
    }

    // Insertar en J_CALENDARIO_PAGOS
    const result = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CALENDARIO_PAGOS" (cliente_id, type, data)
      VALUES (${clienteId}, 'Captación', ${sql.json(calendarData)})
      RETURNING id, cliente_id, type, data, created_at
    `;

    const inserted = result[0];
    console.log(`[CALENDARIO_PAGOS] Registro creado: id=${inserted.id}, cliente_id=${clienteId}, aportaciones=${calendarData.calendario.length}`);

    return c.json({
      success: true,
      registro: inserted,
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in POST /calendario-pagos: ${err.message}`);
    return c.json(
      { error: `Error al crear calendario de pagos: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Buscar productos de seguro por claveProducto
// Recibe ?claves=CLAVE1,CLAVE2 y retorna productos de J_PRODUCTOS donde lineaProducto = 'Seguro'
// que coincidan con alguna de las claves proporcionadas.
app.get("/make-server-9a76e68a/productos-seguro", async (c) => {
  const sql = createSqlConnection();

  try {
    const clavesParam = c.req.query("claves") || "";
    const claves = clavesParam.split(",").map((s: string) => s.trim()).filter(Boolean);

    if (claves.length === 0) {
      // Sin claves → retornar todos los productos de seguro
      const dataResult = await sql`
        SELECT *
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE (data->>'lineaProducto') = 'Seguro'
           OR type = 'Seguro'
        ORDER BY COALESCE(data->>'nombre', data->>'nombreProducto') ASC NULLS LAST
      `;
      return c.json({ data: dataResult || [] });
    }

    // Buscar productos cuya claveProducto coincida con alguna de las claves
    const dataResult = await sql`
      SELECT *
      FROM "EFINANCIANET_DB"."J_PRODUCTOS"
      WHERE ((data->>'lineaProducto') = 'Seguro' OR type = 'Seguro')
        AND (
          (data->>'claveProducto') = ANY(${claves})
          OR (data->'datosGenerales'->>'claveProducto') = ANY(${claves})
          OR (data->'default'->>'clave') = ANY(${claves})
        )
      ORDER BY COALESCE(data->>'nombre', data->>'nombreProducto') ASC NULLS LAST
    `;

    console.log(`[PRODUCTOS-SEGURO] Claves solicitadas: [${claves.join(', ')}] → ${dataResult.length} productos encontrados`);
    return c.json({ data: dataResult || [] });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /productos-seguro: ${err.message}`);
    return c.json(
      { error: `Error al consultar productos de seguro: ${dbError.message}` },
      dbError.status
    );
  }
});

// Endpoint: Buscar un producto por su UUID (id) en J_PRODUCTOS
app.get("/make-server-9a76e68a/producto-by-id", async (c) => {
  const sql = createSqlConnection();
  try {
    const id = (c.req.query("id") || "").trim();
    if (!id) {
      return c.json({ error: "Se requiere el parámetro 'id'." }, 400);
    }
    const dataResult = await sql`
      SELECT *
      FROM "EFINANCIANET_DB"."J_PRODUCTOS"
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    if (dataResult.length === 0) {
      console.log(`[PRODUCTO-BY-ID] No encontrado: ${id}`);
      return c.json({ error: `Producto no encontrado con id: ${id}` }, 404);
    }
    console.log(`[PRODUCTO-BY-ID] Encontrado: ${id}`);
    return c.json({ data: dataResult[0] });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in /producto-by-id: ${err.message}`);
    return c.json(
      { error: `Error al consultar producto por id: ${dbError.message}` },
      dbError.status
    );
  }
});

// ──────────────────────────────────────────────────────────
// SOLICITUDES (almacenadas en J_CUENTAS_CORP_CLIENTES)
// ──────────────────────────────────────────────────────────

// Helper: mapear linea_produc a TipoSolicitud del frontend
function mapLineaToTipo(linea: string): string {
  const l = (linea || '').toLowerCase().trim();
  if (l.includes('captaci') || l.includes('captacion')) return 'captacion';
  if (l.includes('linea') || l.includes('línea')) return 'linea-credito';
  if (l.includes('credi') || l.includes('credito') || l.includes('crédito')) return 'credito';
  return 'captacion';
}

// Endpoint: Preview — devuelve la data mapeada sin insertar (pre-rellenar wizard)
app.get("/make-server-9a76e68a/solicitudes/preview", async (c) => {
  const sql = createSqlConnection();
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) return c.json({ error: "No autorizado." }, 401);

    const cotizacionId = c.req.query("cotizacion_id");
    if (!cotizacionId) return c.json({ error: "Se requiere cotizacion_id." }, 400);

    // Cotización (primero, para obtener cotizData.cliente.id)
    const cotizResult = await sql`
      SELECT id, no_cotiza, descripcion, producto_id, cliente_id, fecha_cotiza,
             estatus_cotiza, linea_cotizacion, data
      FROM "EFINANCIANET_DB"."J_COTIZACIONES"
      WHERE id = ${cotizacionId} LIMIT 1
    `;
    if (cotizResult.length === 0) return c.json({ error: "Cotización no encontrada." }, 404);
    const cotiz = cotizResult[0];
    const cotizData = parseClientData(cotiz.data) || {};

    // Cliente — buscar por cotizData.cliente.id o cache de authUserId
    const cotizClienteId = cotizData.cliente?.id || '';
    let clienteId = '';
    let clienteSubtipo = '';
    let clienteData: Record<string, any> = {};

    if (cotizClienteId) {
      const clienteResult = await sql`
        SELECT id, subtipo, data FROM "EFINANCIANET_DB"."J_CLIENTES"
        WHERE id = ${cotizClienteId} LIMIT 1
      `;
      if (clienteResult.length > 0) {
        clienteId = String(clienteResult[0].id);
        clienteSubtipo = clienteResult[0].subtipo || '';
        clienteData = parseClientData(clienteResult[0].data) || {};
      }
    }
    if (!clienteId) {
      // Fallback con cache
      const lookup = await lookupClienteId(sql, authUser.id);
      if (!lookup) return c.json({ error: "No se encontró el perfil de cliente." }, 404);
      clienteId = lookup.clienteId;
      clienteSubtipo = lookup.subtipo;
      clienteData = lookup.data;
    }

    // Producto
    let productoData: Record<string, any> = {};
    if (cotiz.producto_id) {
      const prodResult = await sql`
        SELECT id, data FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE id = ${String(cotiz.producto_id)} LIMIT 1
      `;
      if (prodResult.length > 0) productoData = parseClientData(prodResult[0].data) || {};
    }

    // Helper: fallback 3 estructuras de producto
    const gpf = (field: string): any => {
      if (productoData[field] !== undefined) return productoData[field];
      if (productoData.datosGenerales?.[field] !== undefined) return productoData.datosGenerales[field];
      if (productoData.default?.[field] !== undefined) return productoData.default[field];
      return undefined;
    };

    // Campos principales desde cotizData (según mapeo especificado)
    // Línea de Producto: J_COTIZACIONES.data.lineaProducto
    const lineaProd = cotizData.lineaProducto || cotiz.linea_cotizacion || '';
    // Tipo de Producto: J_COTIZACIONES.data.producto.tipoProducto
    const tipoProd = cotizData.producto?.tipoProducto || '';
    const nombreProducto = cotizData.producto?.nombreProducto || '';
    // Tipo de Persona: J_CLIENTES.subtipo (columna de la tabla), con fallbacks en data
    const tipoPersona = clienteSubtipo || clienteData.tipo || clienteData.tipoPersona || clienteData.subtipo || 'Fisica';

    // Nombre del cliente desglosado
    const nombreCliente = cotizData.cliente?.nombreCompleto || '';
    const partesNombre = nombreCliente.split(' ');
    const nombreDesglosado = {
      nombre: clienteData.nombre || partesNombre[0] || '',
      apellidoPaterno: clienteData.apellidoPaterno || partesNombre[1] || '',
      apellidoMaterno: clienteData.apellidoMaterno || partesNombre.slice(2).join(' ') || '',
    };

    const header = {
      cotizacion_id: String(cotiz.id),
      numero_cotizacion: cotiz.no_cotiza || '',
      cliente_id: clienteId,
      nombre_cliente: nombreCliente,
      nombre: nombreDesglosado.nombre,
      apellidoPaterno: nombreDesglosado.apellidoPaterno,
      apellidoMaterno: nombreDesglosado.apellidoMaterno,
      tipo_persona: tipoPersona,
      linea_producto: lineaProd,
      tipo_producto: tipoProd,
      producto_id: cotizData.producto?.id || String(cotiz.producto_id || ''),
      nombre_producto: nombreProducto,
      fecha_cotizacion: cotiz.fecha_cotiza || '',
      usuario_cotiza: cotizData.usuario || '',
      institucion_gobierno: cotizData.institucionGobierno || '',
    };

    // ── Determinar tipo de producto para seleccionar fuente de datos correcta ──
    const lineaLower = (lineaProd || '').toLowerCase();
    const isCaptacion = lineaLower.includes('captacion') || lineaLower.includes('captación');

    // Obtener primer pagoPeriodo del array correcto como fallback para monto_por_aportacion
    const previewSourceArray = isCaptacion
      ? (Array.isArray(cotizData.calendarioAportaciones) ? cotizData.calendarioAportaciones : [])
      : (Array.isArray(cotizData.tablaAmortizacion) ? cotizData.tablaAmortizacion : []);
    const firstPagoPeriodo = previewSourceArray.length > 0
      ? (previewSourceArray[0].pagoPeriodo ?? previewSourceArray[0].monto ?? '')
      : '';

    const terminos = {
      monto_solicitado: cotizData.montoCotizado || '',
      tasa_interes: cotizData.tasaMinInteres || '',
      plazo: cotizData.plazoCumplirMontoMinimo || '',
      periodo_plazo: cotizData.periodoCumplirMontoMinimo || '',
      periodicidad_aportacion: cotizData.tablaCotizacion?.periodoAportacion || '',
      monto_por_aportacion: cotizData.tablaCotizacion?.montoPorAportacion || firstPagoPeriodo || '',
      total_aportaciones: cotizData.tablaCotizacion?.totalAportaciones || String(previewSourceArray.length) || '',
      intereses_generados: cotizData.tablaCotizacion?.interesesGenerados || '',
      moneda: cotizData.tablaCotizacion?.moneda || 'MXN',
      fecha_primera_aportacion: cotizData.fechaPrimeraAportacion || '',
      frecuencia_capitalizacion: cotizData.frecuenciaCapitalizacion || '',
    };
    const calendario = previewSourceArray.map((item: any, idx: number) => {
      // El campo correcto para el monto por aportación es pagoPeriodo (viene como string)
      const rawMonto = item.pagoPeriodo ?? item.monto ?? '';
      const montoNum = parseFloat(String(rawMonto).replace(/[^0-9.\-]/g, ''));
      return {
        noAportacion: item.noAportacion || item.noPago || String(idx + 1),
        fecha: item.fecha || item.fechaPago || '',
        monto: !isNaN(montoNum) ? montoNum : 0,
        moneda: item.moneda || 'MXN',
      };
    });

    // Expediente Electrónico (from producto)
    const expedientesReg = productoData.expedientesRegistros || gpf('expedientesRegistros') || [];
    const expediente = {
      documentos_requeridos: Array.isArray(expedientesReg)
        ? expedientesReg.map((doc: any) => ({
            claveDocumento: doc.claveDocumento || '',
            tipo: doc.tipo || doc.tipoDocumento || '',
            descripcion: doc.descripcion || doc.nombreDocumento || '',
            formato: doc.formato || '',
            persona: doc.persona || '',
            fase: doc.fase || '',
            obligatorio: doc.obligatorio ?? doc.requerido ?? true,
            areaResponsable: doc.areaResponsable || doc.area || '',
          }))
        : [],
    };

    // Comisiones (from producto — J_PRODUCTOS.data.comisiones)
    const comisionesReg = productoData.comisiones || gpf('comisiones') || productoData.comisionesRegistros || gpf('comisionesRegistros') || [];
    const comisiones = Array.isArray(comisionesReg)
      ? comisionesReg.map((com: any) => ({
          tipoComision: com.tipoComision || com.tipoComisionNombre || com.tipo || '',
          transaccion: com.transaccion || '',
          sobre: com.sobre || '',
          amount: com.amount || com.monto || '',
          percentage: com.percentage || com.porcentaje || '',
          moneda: com.moneda || 'MXN',
        }))
      : [];

    // Fases (from producto)
    const fasesReg = productoData.fasesRegistros || gpf('fasesRegistros') || [];
    const fases = {
      lista_fases: Array.isArray(fasesReg)
        ? fasesReg.map((fase: any) => ({
            seq: fase.seq || '',
            phaseName: fase.phaseName || fase.nombre || '',
            notes: fase.notes || fase.descripcion || '',
          }))
        : [],
    };

    // Autorizaciones (from producto + J_CATALOGOS cruce por puesto)
    const autorizacionReg = productoData.autorizacion || gpf('autorizacion') || [];
    const autorizacionesActivas = Array.isArray(autorizacionReg)
      ? autorizacionReg.filter((a: any) => a.activo === true)
      : [];
    let autorizaciones: { puesto: string; nombreFuncionario: string; data?: any }[] = [];
    if (autorizacionesActivas.length > 0) {
      const puestosActivos = autorizacionesActivas.map((a: any) => a.puesto).filter(Boolean);
      if (puestosActivos.length > 0) {
        const catalogoResult = await sql`
          SELECT data FROM "EFINANCIANET_DB"."J_CATALOGOS"
          WHERE type = 'PuestoTrabajo'
        `;
        const catalogoMap = new Map<string, any>();
        for (const row of catalogoResult) {
          const d = parseClientData(row.data) || {};
          if (d.puesto) catalogoMap.set(d.puesto, d);
        }
        autorizaciones = puestosActivos
          .filter((p: string) => catalogoMap.has(p))
          .map((p: string) => {
            const d = catalogoMap.get(p) || {};
            return {
              puesto: p,
              nombreFuncionario: d.nombre || '',
              montoDesde: d.montoDesde ?? null,
              montoHasta: d.montoHasta ?? null,
            };
          });
      }
    }

    const matrizSeleccionada = cotizData.matrizRegistroSeleccionado || null;

    console.log(`[SOLICITUDES] Preview: cotizacion_id=${cotizacionId}, lineaProd=${lineaProd}, isCaptacion=${isCaptacion}, sourceLen=${previewSourceArray.length}, producto_id=${cotiz.producto_id}, docs=${expedientesReg?.length||0}, comisiones=${comisionesReg?.length||0}, fases=${fasesReg?.length||0}, autorizaciones=${autorizaciones.length}, calendario=${calendario.length}`);

    return c.json({
      success: true,
      preview: { header, terminos_condiciones: terminos, calendario_aportaciones: calendario, expediente_electronico: expediente, comisiones, fases, autorizaciones, matrizSeleccionada },
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in GET /solicitudes/preview: ${err.message}`);
    return c.json({ error: `Error al generar preview: ${dbError.message}` }, dbError.status);
  }
});

// Endpoint: Crear solicitud (protegido con JWT)
// Mapeo completo: J_COTIZACIONES + J_PRODUCTOS + J_CLIENTES → J_CUENTAS_CORP_CLIENTES
app.post("/make-server-9a76e68a/solicitudes", async (c) => {
  const sql = createSqlConnection();
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado. Inicia sesión para crear una solicitud." }, 401);
    }

    const body = await c.req.json();
    const {
      cotizacion_id,
      tipo,
      lineaProducto,
      tipoProducto,
      tipoPersona,
      producto_id: productoIdManual,
      datosProducto,
      datosSolicitante,
      descripcion: descripcionManual,
      garantias: garantiasManual,
      notas: notasManual,
      comisiones: comisionesManual,
      fases: fasesManual,
      cargos: cargosManual,
      autorizaciones: autorizacionesManual,
      partes_relacionadas: partesRelacionadasManual,
      data: frontendData,
    } = body;

    // 1. Lookup cliente usando cache
    const initialLookup = await lookupClienteId(sql, authUser.id);
    if (!initialLookup) {
      return c.json({ error: "No se encontró el perfil de cliente asociado a tu cuenta." }, 404);
    }
    let clienteId = initialLookup.clienteId;
    let clienteSubtipo = initialLookup.subtipo;
    let clienteData = initialLookup.data;

    // 2. Generate no_sol: BAN-DIGITAL-AAAAMMDD-999999 (unique — retry until no collision)
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const fechaKey = `${yyyy}${mm}${dd}`;
    const counterKey = `solicitud-counter:${fechaKey}`;
    let counter = 1;
    try {
      const existing = await kv.get(counterKey);
      if (existing && typeof existing === 'number') {
        counter = existing + 1;
      } else if (existing && typeof existing === 'object' && (existing as any).value != null) {
        counter = Number((existing as any).value) + 1;
      }
    } catch (_e) { /* first of the day */ }

    let noSol = `BAN-DIGITAL-${fechaKey}-${String(counter).padStart(6, '0')}`;
    // Verify uniqueness against the DB (no_sol is UNIQUE); retry with incremented counter if collision
    let attempts = 0;
    while (attempts < 100) {
      const existing = await sql`
        SELECT id FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE no_sol = ${noSol}
        LIMIT 1
      `;
      if (existing.length === 0) break; // truly unique — proceed
      counter++;
      noSol = `BAN-DIGITAL-${fechaKey}-${String(counter).padStart(6, '0')}`;
      attempts++;
    }
    await kv.set(counterKey, counter);

    let headerData: Record<string, any> = {};
    let terminosCondiciones: Record<string, any> = {};
    let calendarioAportaciones: Array<Record<string, any>> = [];
    let expedienteElectronico: Record<string, any> = { documentos: [] };
    let comisiones: Array<Record<string, any>> = [];
    let cargos: Array<Record<string, any>> = [];
    let autorizacionesArray: Array<Record<string, any>> = [];
    let fases: Record<string, any> = { lista_fases: [], fase_actual: null };
    let notasArray: Array<any> = [];
    let garantiasArray: Array<any> = [];
    let partesRelacionadasArray: Array<any> = [];
    let solicitudJsonData: object | null = null;

    // Column-level values
    let colFechaSol = now.toISOString().split('T')[0];
    let colDescripcion = '';
    let colLineaProduc = '';
    let colTipoProduc = '';
    let colProductoId: string | null = '';
    let colMontoSol = 0;

    // ── FLOW A: Created from a Cotización — full mapping ──
    if (cotizacion_id) {
      const cotizResult = await sql`
        SELECT id, no_cotiza, descripcion, producto_id, cliente_id, fecha_cotiza, estatus_cotiza, linea_cotizacion, data
        FROM "EFINANCIANET_DB"."J_COTIZACIONES"
        WHERE id = ${cotizacion_id}
        LIMIT 1
      `;
      if (cotizResult.length === 0) {
        return c.json({ error: `No se encontró la cotización con ID: ${cotizacion_id}` }, 404);
      }
      const cotiz = cotizResult[0];
      const cotizData = parseClientData(cotiz.data) || {};

      // Re-lookup cliente by cotizData.cliente.id if available (para obtener subtipo correcto)
      const cotizClienteId = cotizData.cliente?.id || '';
      if (cotizClienteId) {
        const cotizClienteResult = await sql`
          SELECT id, subtipo, data FROM "EFINANCIANET_DB"."J_CLIENTES"
          WHERE id = ${cotizClienteId} LIMIT 1
        `;
        if (cotizClienteResult.length > 0) {
          clienteId = String(cotizClienteResult[0].id);
          clienteSubtipo = cotizClienteResult[0].subtipo || '';
          clienteData = parseClientData(cotizClienteResult[0].data) || {};
        }
      }

      // Verify ownership
      if (clienteData.authUserId !== authUser.id) {
        return c.json({ error: "No tienes permiso para crear solicitudes sobre esta cotización." }, 403);
      }

      // Fetch producto
      let productoData: Record<string, any> = {};
      if (cotiz.producto_id) {
        const prodResult = await sql`
          SELECT id, data FROM "EFINANCIANET_DB"."J_PRODUCTOS"
          WHERE id = ${String(cotiz.producto_id)}
          LIMIT 1
        `;
        if (prodResult.length > 0) {
          productoData = parseClientData(prodResult[0].data) || {};
        }
      }

      // Campos principales según mapeo:
      // Línea de Producto: J_COTIZACIONES.data.lineaProducto
      const lineaProd = cotizData.lineaProducto || cotiz.linea_cotizacion || '';
      // Tipo de Producto: J_COTIZACIONES.data.producto.tipoProducto
      const tipoProd = cotizData.producto?.tipoProducto || '';
      const productoId = cotizData.producto?.id || (cotiz.producto_id ? String(cotiz.producto_id) : null);
      const nombreProducto = cotizData.producto?.nombreProducto || '';
      const montoSol = parseFloat(cotizData.montoCotizado || '0') || 0;
      // Tipo de Persona: J_CLIENTES.subtipo (columna de la tabla)
      const tipoPersona = clienteSubtipo || clienteData.tipo || clienteData.tipoPersona || clienteData.subtipo || 'Fisica';

      colFechaSol = cotiz.fecha_cotiza || now.toISOString().split('T')[0];
      colDescripcion = cotiz.descripcion || descripcionManual || '';
      colLineaProduc = lineaProd;
      colTipoProduc = tipoProd;
      colProductoId = productoId || null;
      colMontoSol = montoSol;

      // --- HEADER ---
      headerData = {
        cotizacion_id: String(cotiz.id),
        numero_cotizacion: cotiz.no_cotiza || '',
        cliente_id: clienteId,
        nombre_cliente: cotizData.cliente?.nombreCompleto || '',
        tipo_persona: tipoPersona,
        linea_producto: lineaProd,
        tipo_producto: tipoProd,
        producto_id: productoId,
        nombre_producto: nombreProducto,
        fecha_cotizacion: cotiz.fecha_cotiza || '',
        usuario_cotiza: cotizData.usuario || '',
        institucion_gobierno: cotizData.institucionGobierno || '',
        estatus: 'Pendiente',
      };

      // --- TERMINOS_CONDICIONES ---
      terminosCondiciones = {
        monto_solicitado: cotizData.montoCotizado || '',
        tasa_interes: cotizData.tasaMinInteres || '',
        plazo: cotizData.plazoCumplirMontoMinimo || '',
        periodo_plazo: cotizData.periodoCumplirMontoMinimo || '',
        periodicidad_aportacion: cotizData.tablaCotizacion?.periodoAportacion || '',
        monto_por_aportacion: cotizData.tablaCotizacion?.montoPorAportacion || '',
        total_aportaciones: cotizData.tablaCotizacion?.totalAportaciones || '',
        intereses_generados: cotizData.tablaCotizacion?.interesesGenerados || '',
        moneda: cotizData.tablaCotizacion?.moneda || '',
        fecha_primera_aportacion: cotizData.fechaPrimeraAportacion || '',
        frecuencia_capitalizacion: cotizData.frecuenciaCapitalizacion || '',
      };

      // --- CALENDARIO_APORTACIONES ---
      if (Array.isArray(cotizData.calendarioAportaciones)) {
        calendarioAportaciones = cotizData.calendarioAportaciones.map((item: any) => ({
          noAportacion: item.noAportacion || '',
          fecha: item.fecha || '',
          monto: item.monto || '',
          moneda: item.moneda || '',
        }));
      }

      // --- EXPEDIENTE_ELECTRONICO (from producto) ---
      // Field name differs by type (mirrors frontend getRequisitosProducto)
      const tipoFlow = lineaProd.toLowerCase().includes('captacion') ? 'captacion'
        : lineaProd.toLowerCase().includes('linea') ? 'linea-credito'
        : 'credito';
      const expedientesReg = tipoFlow === 'captacion'
        ? (productoData.expedientesRegistros || [])
        : tipoFlow === 'linea-credito'
        ? (productoData.expedientes || [])
        : (productoData.expedientesElectronicos || []);
      expedienteElectronico = { documentos: [] };

      // --- COMISIONES (from producto) ---
      const comisionesReg2 = productoData.comisiones || productoData.comisionesRegistros || [];
      comisiones = Array.isArray(comisionesReg2)
        ? comisionesReg2.map((com: any) => ({
            tipoComision: com.tipoComision || com.tipoComisionNombre || com.tipo || '',
            transaccion: com.transaccion || '',
            sobre: com.sobre || '',
            amount: com.amount || com.monto || '',
            percentage: com.percentage || com.porcentaje || '',
            moneda: com.moneda || 'MXN',
          }))
        : [];

      // --- AUTORIZACIONES (from producto + J_CATALOGOS cruce por puesto) ---
      const autorizacionRegPost = productoData.autorizacion || [];
      const autorizacionesActivasPost = Array.isArray(autorizacionRegPost)
        ? autorizacionRegPost.filter((a: any) => a.activo === true)
        : [];
      if (autorizacionesActivasPost.length > 0) {
        const puestosActivosPost = autorizacionesActivasPost.map((a: any) => a.puesto).filter(Boolean);
        if (puestosActivosPost.length > 0) {
          const catResultPost = await sql`
            SELECT data FROM "EFINANCIANET_DB"."J_CATALOGOS"
            WHERE type = 'PuestoTrabajo'
          `;
          const catMapPost = new Map<string, any>();
          for (const row of catResultPost) {
            const d = parseClientData(row.data) || {};
            if (d.puesto) catMapPost.set(d.puesto, d);
          }
          autorizacionesArray = puestosActivosPost
            .filter((p: string) => catMapPost.has(p))
            .map((p: string) => {
              const d = catMapPost.get(p) || {};
              return {
                puesto: p,
                nombreFuncionario: d.nombre || '',
                montoDesde: d.montoDesde ?? null,
                montoHasta: d.montoHasta ?? null,
              };
            });
        }
      }

      // --- FASES (from producto) ---
      // captacion uses fasesRegistros; credito/linea-credito use fases (mirrors frontend getFaseActivaNombre)
      const fasesReg: any[] = tipoFlow === 'captacion'
        ? (productoData.fasesRegistros || [])
        : (Array.isArray(productoData.fases) ? productoData.fases : (productoData.fases?.lista_fases || []));
      const primeraFase = Array.isArray(fasesReg) && fasesReg.length > 0 ? fasesReg[0] : null;
      fases = {
        lista_fases: Array.isArray(fasesReg)
          ? fasesReg.map((fase: any) => ({
              seq: fase.seq || '',
              phaseName: fase.phaseName || '',
              notes: fase.notes || '',
            }))
          : [],
        fase_actual: primeraFase
          ? { seq: primeraFase.seq || '', phaseName: primeraFase.phaseName || '', notes: primeraFase.notes || '' }
          : null,
      };

      // Store faseActual / descripcionFase in header (first phase of product)
      headerData.faseActual = primeraFase?.seq || primeraFase?.phaseName || 'Fase 1';
      headerData.descripcionFase = primeraFase?.phaseName || 'Registro';

      // --- CARGOS (from producto) ---
      const cargosReg = productoData.cargos || productoData.cargosRegistros || [];
      cargos = Array.isArray(cargosReg) ? cargosReg : [];

      // --- PARTES RELACIONADAS / NOTAS / GARANTIAS (accepted from body for both flows) ---
      if (Array.isArray(garantiasManual)) {
        garantiasArray = garantiasManual.filter((g: any) => g.tipo || g.descripcion || g.garantia);
      }
      if (Array.isArray(notasManual)) {
        notasArray = notasManual.filter((n: any) => n.nota?.trim());
      }
      if (Array.isArray(partesRelacionadasManual)) {
        partesRelacionadasArray = partesRelacionadasManual;
      }

    } else {
      // ── FLOW B: Manual creation (no cotización) ──
      if (!tipo) {
        return c.json({ error: "Se requiere 'cotizacion_id' o 'tipo' para crear una solicitud." }, 400);
      }

      colDescripcion = descripcionManual || '';
      colLineaProduc = lineaProducto || '';
      colTipoProduc = tipoProducto || '';
      colProductoId = productoIdManual || null;
      colMontoSol = parseFloat(String(datosProducto?.montoSolicitado || '0')) || 0;

      // Fase info
      const fasesManualList: any[] = Array.isArray(fasesManual) ? fasesManual : (fasesManual?.lista_fases ?? []);
      const primeraFaseManual = fasesManualList.length > 0 ? fasesManualList[0] : null;
      const faseIdManual = String(primeraFaseManual?.seq || primeraFaseManual?.id || '1');
      const descripcionFaseManual = primeraFaseManual?.phaseName || 'Integración del Expediente';
      // Populate the shared `fases` variable so solicitudJsonData picks it up correctly
      fases = {
        lista_fases: fasesManualList.map((f: any) => ({
          seq: f.seq || '',
          phaseName: f.phaseName || '',
          notes: f.notes || '',
        })),
        fase_actual: primeraFaseManual
          ? { seq: primeraFaseManual.seq || '', phaseName: primeraFaseManual.phaseName || '', notes: primeraFaseManual.notes || '' }
          : null,
      };
      const tipoFlujoB = tipo === 'captacion' ? 'captacion' : tipo === 'linea-credito' ? 'linea-credito' : 'credito';
      const fechaInicioB = tipoFlujoB === 'captacion'
        ? (datosProducto?.fechaPrimeraAportacion || '')
        : (datosProducto?.fechaPrimerPago || '');
      const fechaSolicitudB = now.toLocaleDateString('es-MX', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      const tipoTablaB = tipoFlujoB === 'captacion' ? 'Aportaciones' : tipoFlujoB === 'credito' ? 'Francés' : 'Pagos';

      // Header — spec-compliant field names
      headerData = {
        no_sol: '',
        cotizacion_id: null,
        linea_producto: lineaProducto || '',
        tipo_producto: tipoProducto || '',
        tipo_persona: tipoPersona || 'Física',
        nombre_persona: datosSolicitante?.nombre || '',
        apellido_paterno_persona: datosSolicitante?.apellidoPaterno || '',
        apellido_materno_persona: datosSolicitante?.apellidoMaterno || '',
        producto_id: productoIdManual || '',
        nombre_producto: datosProducto?.productoNombre || '',
        fecha_solicitud: fechaSolicitudB,
        descripcion: descripcionManual || '',
        fase_id: faseIdManual,
        descripcion_fase: descripcionFaseManual,
        estatus: 'En Proceso',
        curp: '',
        rfc: '',
        responsable: authUser.email || '',
        fecha_inicio: fechaInicioB,
      };

      // Términos y condiciones — spec-compliant structure
      terminosCondiciones = {
        tipo_producto: tipoProducto || tipo,
        parametros_simulacion: {
          monto_solicitado: String(datosProducto?.montoSolicitado || ''),
          plazo: datosProducto?.plazo || '',
          tasa_interes: datosProducto?.tasaInteres || '',
          periodicidad: datosProducto?.periodicidad || '',
          fecha_primer_pago: datosProducto?.fechaPrimerPago || '',
          fecha_primera_aportacion: datosProducto?.fechaPrimeraAportacion || '',
        },
        _raw: {
          montoSolicitado: String(datosProducto?.montoSolicitado || ''),
          plazo: datosProducto?.plazo || '',
          tasa: datosProducto?.tasaInteres || '',
          frecuencia: datosProducto?.periodicidad || '',
          fechaPrimerPago: datosProducto?.fechaPrimerPago || '',
          fechaPrimeraAportacion: datosProducto?.fechaPrimeraAportacion || '',
          fechaInicio: fechaInicioB,
          fechaFin: '',
          tipoTasa: '',
          tipoCalculo: tipoTablaB,
          moneda: 'MXN',
          montoGarantia: '',
          seguroFinanciado: false,
          montoSeguro: '',
        },
      };

      // Expediente: always start empty; POST /solicitudes/:id/documentos fills it
      expedienteElectronico = { documentos: [] };

      // Comisiones, autorizaciones from body
      if (Array.isArray(comisionesManual)) comisiones = comisionesManual;
      if (Array.isArray(autorizacionesManual)) autorizacionesArray = autorizacionesManual;

      // Garantías, notas
      if (Array.isArray(garantiasManual)) {
        garantiasArray = garantiasManual.filter((g: any) => g.tipo || g.descripcion || g.garantia);
      }
      if (Array.isArray(notasManual)) {
        notasArray = notasManual.filter((n: any) => n.nota?.trim());
      }
      if (Array.isArray(partesRelacionadasManual)) {
        partesRelacionadasArray = partesRelacionadasManual;
      }

      // Flow B: use the mapper payload from the frontend as the source of truth.
      // Only override fields the server owns (header identifiers, expediente_electronico).
      const frontendSolicitud = (frontendData as any)?.solicitud ?? {};
      solicitudJsonData = {
        solicitud: {
          ...frontendSolicitud,
          header: {
            ...frontendSolicitud.header,
            // These are assigned by the backend, not the frontend
            no_sol: '',      // patched after INSERT
            responsable: authUser.email || '',
          },
          expediente_electronico: expedienteElectronico, // always start empty; POST /documentos fills it
          partes_relacionadas: partesRelacionadasArray,
          notas: Array.isArray(notasArray) && notasArray.length > 0 ? notasArray : (frontendSolicitud.notas ?? []),
          garantias: Array.isArray(garantiasArray) && garantiasArray.length > 0 ? garantiasArray : (frontendSolicitud.garantias ?? []),
        },
      };
    }

    // Flow A: build solicitudJsonData from cotización data (Flow B already set it above)
    if (!solicitudJsonData) {
      const tipoTablaA = colLineaProduc.toLowerCase().includes('captacion') ? 'Aportaciones'
        : colLineaProduc.toLowerCase().includes('linea') ? 'Pagos' : 'Francés';
      solicitudJsonData = {
        solicitud: {
          header: headerData,
          terminos_condiciones: terminosCondiciones,
          simulacion: {
            tipo_tabla: tipoTablaA,
            resultado_simulacion: [],
            calendario_aportaciones: calendarioAportaciones,
          },
          expediente_electronico: expedienteElectronico,
          garantias: garantiasArray,
          comisiones,
          cargos,
          autorizaciones: autorizacionesArray,
          fases,
          notas: notasArray,
          partes_relacionadas: partesRelacionadasArray,
        },
      };
    }

    // Patch server-owned header fields (curp/rfc from J_CLIENTES.data, responsable from auth)
    if ((solicitudJsonData as any)?.solicitud?.header) {
      const h = (solicitudJsonData as any).solicitud.header;
      h.curp        = clienteData.curp  || '';
      h.rfc         = clienteData.rfc   || null;
      h.responsable = authUser.email    || '';
    }

    // INSERT into J_CUENTAS_CORP_CLIENTES using sql.json() for JSONB
    // no_cuenta is NOT NULL — we reuse the noSol value as the account number
    const insertResult = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
        id, type, no_sol, no_cuenta, fecha_sol, descripcion, linea_produc, tipo_produc,
        producto_id, cliente_id, monto_sol, estatus_sol, data
      ) VALUES (
        gen_random_uuid(), 'Solicitud', ${noSol}, ${noSol}, ${colFechaSol}, ${colDescripcion},
        ${colLineaProduc}, ${colTipoProduc}, ${colProductoId}, ${clienteId},
        ${colMontoSol}, 'Pendiente', ${sql.json(solicitudJsonData || {})}
      )
      RETURNING id, no_sol, no_cuenta, fecha_sol, descripcion, linea_produc, tipo_produc, producto_id, cliente_id, monto_sol, estatus_sol, data
    `;

    const inserted = insertResult[0];
    console.log(`[SOLICITUDES] Solicitud creada en J_CUENTAS_CORP_CLIENTES: id=${inserted.id}, no_sol=${inserted.no_sol}, cliente_id=${clienteId}, cotizacion_id=${cotizacion_id || 'manual'}`);

    // Patch header.no_sol and header.id in the JSONB now that we have the real values
    await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      SET data = jsonb_set(jsonb_set(data, '{solicitud,header,no_sol}', ${sql.json(inserted.no_sol)}::jsonb), '{solicitud,header,id}', ${sql.json(String(inserted.id))}::jsonb)
      WHERE id = ${String(inserted.id)}
    `;

    const respData = parseClientData(inserted.data);
    const expedienteDocs = respData?.expediente_electronico?.documentos || [];

    return c.json({
      success: true,
      solicitud: {
        id: String(inserted.id),
        noSolicitud: inserted.no_sol,
        tipo: mapLineaToTipo(inserted.linea_produc),
        estado: inserted.estatus_sol,
        faseActual: 'Fase 1 - Registro',
        descripcionFase: 'Captura de datos iniciales y documentación',
        lineaProducto: inserted.linea_produc,
        tipoProducto: inserted.tipo_produc,
        tipoPersona: '',
        fechaCreacion: inserted.fecha_sol,
        descripcion: inserted.descripcion,
        datosProducto: {
          productoNombre: '',
          montoSolicitado: parseFloat(inserted.monto_sol) || 0,
          plazo: '',
          tasaInteres: '',
          periodicidad: '',
          fechaPrimeraAportacion: '',
        },
        datosSolicitante: { nombre: '' },
        cotizacionRef: cotizacion_id ? { id: cotizacion_id, noCotiza: '' } : null,
        expediente_electronico: { documentos: expedienteDocs },
      },
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in POST /solicitudes: ${err.message}`);
    return c.json({ error: `Error al crear solicitud: ${dbError.message}` }, dbError.status);
  }
});

// Endpoint: Listar solicitudes del usuario autenticado (protegido con JWT)
// Lee desde J_CUENTAS_CORP_CLIENTES WHERE type='Solicitud'
app.get("/make-server-9a76e68a/solicitudes", async (c) => {
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado. Inicia sesión para ver tus solicitudes." }, 401);
    }

    const { clienteId, solicitudesResult } = await withRetry(async (sql) => {
      const lookup = await lookupClienteId(sql, authUser.id);
      if (!lookup) {
        return { clienteId: null, solicitudesResult: [] };
      }
      const cId = lookup.clienteId;

      const rows = await sql`
        SELECT id, type, no_sol, fecha_sol, descripcion, linea_produc, tipo_produc,
               producto_id, cliente_id, monto_sol, estatus_sol, data
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE cliente_id = ${cId}
          AND type = 'Solicitud'
        ORDER BY fecha_sol DESC
      `;
      return { clienteId: cId, solicitudesResult: rows };
    });

    if (clienteId === null) {
      return c.json({ error: "No se encontró el perfil de cliente asociado a tu cuenta." }, 404);
    }

    const solicitudes = solicitudesResult.map((row: any) => {
      const data = parseClientData(row.data);
      const header = data?.solicitud?.header || {};
      const terminos = data?.solicitud?.terminos_condiciones || {};
      const fasesData = data?.solicitud?.fases || {};
      // Soportar ambos formatos de fases
      const faseActual = fasesData.fase_actual;
      const faseActualName = faseActual?.phaseName || faseActual || 'Fase 1';
      const faseActualNotes = faseActual?.notes || '';

      return {
        id: String(row.id),
        noSolicitud: row.no_sol || '',
        tipo: mapLineaToTipo(row.linea_produc),
        estado: row.estatus_sol || 'Pendiente',
        faseActual: faseActualName || 'Fase 1 - Registro',
        descripcionFase: faseActualNotes || 'Captura de datos iniciales y documentación',
        lineaProducto: row.linea_produc || '',
        tipoProducto: row.tipo_produc || '',
        tipoPersona: header.tipo_persona || '',
        fechaCreacion: row.fecha_sol || '',
        descripcion: row.descripcion || '',
        datosProducto: {
          productoNombre: header.nombre_producto || '',
          montoSolicitado: parseFloat(row.monto_sol) || 0,
          plazo: terminos.plazo || '',
          tasaInteres: terminos.tasa_interes || '',
          periodicidad: terminos.periodicidad_aportacion || '',
          fechaPrimerPago: terminos.fecha_primer_pago || '',
          fechaPrimeraAportacion: terminos.fecha_primera_aportacion || '',
          institucion: header.institucion_gobierno || '',
        },
        datosSolicitante: { nombre: header.nombre_cliente || '' },
        cotizacionRef: header.cotizacion_id
          ? { id: header.cotizacion_id, noCotiza: header.numero_cotizacion || '' }
          : null,
        data,
      };
    });

    console.log(`[SOLICITUDES] GET: ${solicitudes.length} solicitudes para cliente_id=${clienteId}`);
    return c.json({ success: true, solicitudes, total: solicitudes.length });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in GET /solicitudes: ${err.message}`);
    return c.json({ error: `Error al obtener solicitudes: ${dbError.message}` }, dbError.status);
  }
});

// Endpoint: Obtener solicitud por ID (protegido con JWT)
app.get("/make-server-9a76e68a/solicitudes/:id", async (c) => {
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado." }, 401);
    }

    const solicitudId = c.req.param("id");
    const row = await withRetry(async (sql) => {
      const rows = await sql`
        SELECT id, type, no_sol, fecha_sol, descripcion, linea_produc, tipo_produc,
               producto_id, cliente_id, monto_sol, estatus_sol, data
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE id = ${solicitudId}
        LIMIT 1
      `;
      return rows[0] || null;
    });

    if (!row) {
      return c.json({ error: "Solicitud no encontrada." }, 404);
    }

    const data = parseClientData(row.data);
    return c.json({
      success: true,
      solicitud: {
        id: String(row.id),
        noSolicitud: row.no_sol || '',
        data,
      },
    });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in GET /solicitudes/${c.req.param("id")}: ${err.message}`);
    return c.json({ error: `Error al obtener solicitud: ${dbError.message}` }, dbError.status);
  }
});

// Endpoint: Actualizar JSONB de solicitud (protegido con JWT)
app.patch("/make-server-9a76e68a/solicitudes/:id", async (c) => {
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado." }, 401);
    }

    const solicitudId = c.req.param("id");
    const body = await c.req.json();
    const { data: newData } = body;

    if (!newData || typeof newData !== 'object') {
      return c.json({ error: "Se requiere el campo 'data' con el JSONB actualizado." }, 400);
    }

    await withRetry(async (sql) => {
      await sql`
        UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        SET data = ${sql.json(newData)}
        WHERE id = ${solicitudId}
      `;
    });

    return c.json({ success: true });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in PATCH /solicitudes/${c.req.param("id")}: ${err.message}`);
    return c.json({ error: `Error al actualizar solicitud: ${dbError.message}` }, dbError.status);
  }
});

// Endpoint: Eliminar solicitud (protegido con JWT)
app.delete("/make-server-9a76e68a/solicitudes/:id", async (c) => {
  const sql = createSqlConnection();
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado." }, 401);
    }

    const solicitudId = c.req.param("id");
    if (!solicitudId) {
      return c.json({ error: "Se requiere el ID de la solicitud." }, 400);
    }

    // Buscar cliente_id usando cache
    const lookup = await lookupClienteId(sql, authUser.id);
    if (!lookup) {
      return c.json({ error: "No se encontró el perfil de cliente." }, 404);
    }
    const clienteId = lookup.clienteId;

    // Verificar que la solicitud pertenece al cliente y eliminar
    const deleteResult = await sql`
      DELETE FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE id = ${solicitudId}
        AND cliente_id = ${clienteId}
        AND type = 'Solicitud'
      RETURNING id, no_sol
    `;

    if (deleteResult.length === 0) {
      return c.json({ error: "Solicitud no encontrada o no tienes permisos para eliminarla." }, 404);
    }

    console.log(`[SOLICITUDES] DELETE: id=${solicitudId}, no_sol=${deleteResult[0].no_sol}, cliente_id=${clienteId}`);
    return c.json({ success: true, deleted: { id: solicitudId, noSolicitud: deleteResult[0].no_sol } });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in DELETE /solicitudes/${c.req.param("id")}: ${err.message}`);
    return c.json({ error: `Error al eliminar solicitud: ${dbError.message}` }, dbError.status);
  }
});

// Endpoint: Actualizar estatus de cotización a "Aceptada" cuando se abre una solicitud vinculada
app.patch("/make-server-9a76e68a/solicitudes/cotizacion-aceptar", async (c) => {
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado." }, 401);
    }
    const body = await c.req.json();
    const { cotizacion_id } = body;
    if (!cotizacion_id) {
      return c.json({ error: "Se requiere cotizacion_id." }, 400);
    }

    const result = await withRetry(async (sql) => {
      const updated = await sql`
        UPDATE "EFINANCIANET_DB"."J_COTIZACIONES"
        SET estatus_cotiza = 'Aceptada'
        WHERE id = ${cotizacion_id}
          AND estatus_cotiza != 'Aceptada'
        RETURNING id, no_cotiza, estatus_cotiza
      `;
      return updated;
    });

    if (result.length === 0) {
      console.log(`[SOLICITUDES] cotizacion-aceptar: cotizacion_id=${cotizacion_id} ya estaba Aceptada o no existe`);
      return c.json({ success: true, message: "Ya estaba aceptada o no encontrada." });
    }

    console.log(`[SOLICITUDES] Cotización ${result[0].no_cotiza} actualizada a Aceptada`);
    return c.json({ success: true, cotizacion: { id: result[0].id, noCotiza: result[0].no_cotiza, estatus: result[0].estatus_cotiza } });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in PATCH /solicitudes/cotizacion-aceptar: ${err.message}`);
    return c.json({ error: `Error al actualizar cotización: ${dbError.message}` }, dbError.status);
  }
});

// Endpoint: Obtener líneas de producto para dropdown de solicitudes
app.get("/make-server-9a76e68a/productos-lineas", async (c) => {
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado." }, 401);
    }

    const lineas = await withRetry(async (sql) => {
      const rows = await sql`
        SELECT DISTINCT data->>'lineaProducto' as linea
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE data->>'lineaProducto' IS NOT NULL
          AND data->>'lineaProducto' != ''
        ORDER BY linea
      `;
      return rows.map((r: any) => r.linea);
    });

    return c.json({ success: true, lineas });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in GET /productos-lineas: ${err.message}`);
    return c.json({ error: `Error al obtener líneas: ${dbError.message}` }, dbError.status);
  }
});

// Endpoint: Obtener productos filtrados por línea de producto
app.get("/make-server-9a76e68a/productos-por-linea", async (c) => {
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado." }, 401);
    }

    const linea = c.req.query("linea") || "";
    if (!linea.trim()) {
      return c.json({ error: "Parámetro 'linea' requerido." }, 400);
    }

    const productos = await withRetry(async (sql) => {
      const rows = await sql`
        SELECT DISTINCT
          COALESCE(data->>'nombreProducto', data->>'nombre', data->'default'->>'nombre') as nombre_producto,
          data->>'claveProducto' as clave_producto,
          data->>'tipoProducto' as tipo_producto
        FROM "EFINANCIANET_DB"."J_PRODUCTOS"
        WHERE data->>'lineaProducto' = ${linea.trim()}
          AND COALESCE(data->>'nombreProducto', data->>'nombre', data->'default'->>'nombre') IS NOT NULL
          AND COALESCE(data->>'nombreProducto', data->>'nombre', data->'default'->>'nombre') != ''
        ORDER BY nombre_producto
      `;
      return rows.map((r: any) => ({
        nombre: r.nombre_producto,
        clave: r.clave_producto || '',
        tipoProducto: r.tipo_producto || '',
      }));
    });

    return c.json({ success: true, productos });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in GET /productos-por-linea: ${err.message}`);
    return c.json({ error: `Error al obtener productos: ${dbError.message}` }, dbError.status);
  }
});

// Endpoint: Subir documento al expediente electrónico de una solicitud
app.post("/make-server-9a76e68a/solicitudes/:id/documentos", async (c) => {
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado." }, 401);
    }

    const solicitudId = c.req.param("id");
    if (!solicitudId) {
      return c.json({ error: "ID de solicitud requerido." }, 400);
    }

    // Parse multipart form data
    const formData = await c.req.formData();
    const archivo = formData.get("archivo") as File | null;
    const tipoDocumento = formData.get("tipo_documento") as string || "";
    const nota = formData.get("nota") as string || "";
    const area = formData.get("area") as string || "";
    const fase = formData.get("fase") as string || "";
    const claveDocumento = formData.get("clave_documento") as string || "";
    const faseId = parseInt(formData.get("fase_id") as string || "0") || null;
    const validadoIa = (formData.get("validado_ia") as string) === "true";
    const estatus = formData.get("estatus") as string || "Validado";
    const tamanoKb = parseFloat(formData.get("tamano_kb") as string || "0") || null;
    let iaExtraido: any = null;
    let iaMotivos: string[] = [];
    try {
      const ieRaw = formData.get("ia_extraido") as string | null;
      if (ieRaw) iaExtraido = JSON.parse(ieRaw);
    } catch { /* non-fatal */ }
    try {
      const imRaw = formData.get("ia_motivos") as string | null;
      if (imRaw) iaMotivos = JSON.parse(imRaw);
    } catch { /* non-fatal */ }

    if (!archivo) {
      return c.json({ error: "Se requiere un archivo adjunto." }, 400);
    }
    if (!tipoDocumento.trim()) {
      return c.json({ error: "Se requiere seleccionar un Tipo de Documento." }, 400);
    }

    // Derive file extension
    const fileName = archivo.name || "archivo";
    const extension = fileName.includes(".")
      ? fileName.split(".").pop()?.toLowerCase() || ""
      : "";

    // Upload file to Supabase Storage
    const supabase = createSupabaseAdmin();
    const timestamp = Date.now();
    const safeFileName = fileName
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-zA-Z0-9._-]/g, '_');                // replace invalid chars with _
    const storagePath = `${solicitudId}/${timestamp}_${safeFileName}`;
    const fileBuffer = await archivo.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(EXPEDIENTE_SOLICITUD_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: archivo.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.log(`[DOCUMENTOS] Error uploading file: ${uploadError.message}`);
      return c.json({ error: `Error al subir archivo: ${uploadError.message}` }, 500);
    }

    // Generate signed URL (valid 7 days)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(EXPEDIENTE_SOLICITUD_BUCKET)
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

    const signedUrl = signedData?.signedUrl || "";
    if (signedError) {
      console.log(`[DOCUMENTOS] Warning: could not create signed URL: ${signedError.message}`);
    }

    // Build document record (spec-compliant structure)
    const nuevoDocumento = {
      id: crypto.randomUUID(),
      fecha_creacion: new Date().toISOString(),
      usuario: authUser.email,
      tipo_documento: tipoDocumento,
      clave_documento: claveDocumento,
      archivo_adjunto: fileName,
      tipo_archivo: extension.toUpperCase(),
      nota: nota.trim() || "100% Validado",
      area,
      fase,
      fase_id: faseId,
      validado_ia: validadoIa,
      estatus,
      url: signedUrl,
      storage_path: storagePath,
      storage_bucket: EXPEDIENTE_SOLICITUD_BUCKET,
      mime: archivo.type || "application/octet-stream",
      tamano_kb: tamanoKb ?? Math.round(archivo.size / 1024),
      ia_motivos: iaMotivos,
      ia_extraido: iaExtraido,
    };

    // Update solicitud JSONB: add to expediente_electronico.documentos[]
    const current = await withRetry(async (sql) => {
      const rows = await sql`
        SELECT id, data
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE id = ${solicitudId}
      `;
      return rows[0] || null;
    });

    if (!current) {
      return c.json({ error: "Solicitud no encontrada." }, 404);
    }

    const currentData = parseClientData(current.data) || {};
    const solData = currentData.solicitud || {};
    const expElectronico = solData.expediente_electronico || {};
    // Siempre usar 'documentos' (formato spec-compliant)
    const docsKey = 'documentos';
    const docsCargados = Array.isArray(expElectronico[docsKey])
      ? [...expElectronico[docsKey]]
      : [];
    docsCargados.push(nuevoDocumento);

    const updatedData = {
      ...currentData,
      solicitud: {
        ...solData,
        expediente_electronico: {
          ...expElectronico,
          [docsKey]: docsCargados,
        },
      },
    };

    await withRetry(async (sql) => {
      await sql`
        UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        SET data = ${sql.json(updatedData)}
        WHERE id = ${solicitudId}
      `;
    });

    console.log(`[DOCUMENTOS] Documento "${fileName}" subido para solicitud ${solicitudId} por ${authUser.email}`);
    return c.json({ success: true, documento: nuevoDocumento });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in POST /solicitudes/${c.req.param("id")}/documentos: ${err.message}`);
    return c.json({ error: `Error al guardar documento: ${dbError.message}` }, dbError.status);
  }
});

// Endpoint: Obtener documentos cargados de una solicitud (con URLs firmadas renovadas)
app.get("/make-server-9a76e68a/solicitudes/:id/documentos", async (c) => {
  try {
    const authUser = await extractAuthUser(c);
    if (!authUser) {
      return c.json({ error: "No autorizado." }, 401);
    }

    const solicitudId = c.req.param("id");
    const current = await withRetry(async (sql) => {
      const rows = await sql`
        SELECT data
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE id = ${solicitudId}
      `;
      return rows[0] || null;
    });

    if (!current) {
      return c.json({ error: "Solicitud no encontrada." }, 404);
    }

    const currentData = parseClientData(current.data) || {};
    const expElectronico = currentData.solicitud?.expediente_electronico || {};
    // Leer de 'documentos' (spec-compliant) con fallback a 'documentos_cargados' para registros legacy
    const docsCargados = expElectronico['documentos'] || expElectronico['documentos_cargados'] || [];

    // Renew signed URLs
    const supabase = createSupabaseAdmin();
    const docsWithUrls = await Promise.all(
      docsCargados.map(async (doc: any) => {
        if (doc.storage_path) {
          const { data } = await supabase.storage
            .from(EXPEDIENTE_SOLICITUD_BUCKET)
            .createSignedUrl(doc.storage_path, 7 * 24 * 60 * 60);
          return { ...doc, url: data?.signedUrl || doc.url };
        }
        return doc;
      })
    );

    return c.json({ success: true, documentos: docsWithUrls });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`Error in GET /solicitudes/${c.req.param("id")}/documentos: ${err.message}`);
    return c.json({ error: `Error al obtener documentos: ${dbError.message}` }, dbError.status);
  }
});

// Global error handler: catch unhandled errors in routes
app.onError((err, c) => {
  const msg = err?.message || String(err);
  // "connection closed before message completed" = client disconnected; benign, don't log as error
  if (msg.includes('connection closed before message completed')) {
    console.log(`[HTTP] Client disconnected before response completed: ${c.req.method} ${c.req.path}`);
    return c.json({ error: 'Client disconnected' }, 499);
  }
  console.log(`[HTTP] Unhandled error in ${c.req.method} ${c.req.path}: ${msg}`);
  return c.json({ error: 'Error interno del servidor' }, 500);
});

// ═══════════════════════════════════════════════════════════════════════
// ENDPOINT: Obtener garantías del cliente autenticado (desde J_GARANTIAS)
// ═══════════════════════════════════════════════════════════════════════
app.get("/make-server-9a76e68a/garantias/cliente", async (c) => {
  const authUser = await extractAuthUser(c);
  if (!authUser) {
    return c.json({ error: "No autorizado. Token inválido o expirado.", code: "UNAUTHORIZED" }, 401);
  }

  try {
    const garantias = await withRetry(async (sql) => {
      const lookup = await lookupClienteId(sql, authUser.id);
      if (!lookup) {
        console.log(`[GARANTIAS] No se encontró J_CLIENTES para authUserId=${authUser.id}`);
        return [];
      }
      const clienteId = lookup.clienteId;
      console.log(`[GARANTIAS] Buscando garantías para cliente_id=${clienteId}`);

      const rows = await sql`
        SELECT uuid, garantia, tipo, subtipo, descripcion, ubicacion, valor_nominal, fecha_registro
        FROM "EFINANCIANET_DB"."J_GARANTIAS"
        WHERE cliente_id = ${clienteId}
        ORDER BY fecha_registro DESC
      `;

      return rows.map((row: any) => ({
        id: String(row.uuid),
        garantia: row.garantia || '',
        tipo: row.tipo || '',
        subtipo: row.subtipo || '',
        descripcion: row.descripcion || '',
        ubicacion: row.ubicacion || '',
        valor_nominal: row.valor_nominal != null ? String(row.valor_nominal) : '',
        fecha_registro: row.fecha_registro || '',
      }));
    });

    console.log(`[GARANTIAS] Encontradas ${garantias.length} garantías para usuario ${authUser.email}`);
    return c.json({ success: true, garantias });
  } catch (err: any) {
    const dbError = classifyDbError(err);
    console.log(`[GARANTIAS] Error: ${err.message}`);
    handleConnectionError(err);
    return c.json({ error: `Error al obtener garantías: ${dbError.message}` }, dbError.status);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ENDPOINT: Validar documento con OCR + IA (Anthropic)
// Body: { ocrText: string, promptIA: string }
// Returns: { valido: boolean, score: number, observaciones: string }
// ═══════════════════════════════════════════════════════════════════════
app.post("/make-server-9a76e68a/validar-documento", async (c) => {
  const authUser = await extractAuthUser(c);
  if (!authUser) {
    return c.json({ error: "No autorizado. Token inválido o expirado.", code: "UNAUTHORIZED" }, 401);
  }

  try {
    const body = await c.req.json();
    const ocrText: string = body.ocrText ?? '';
    const promptIA: string = body.promptIA ?? '';

    if (!promptIA.trim()) {
      return c.json({ error: "promptIA es requerido" }, 400);
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      console.log("[VALIDAR-DOC] ANTHROPIC_API_KEY no configurada");
      return c.json({ error: "Servicio de IA no configurado" }, 503);
    }

    const userPrompt = `Eres un validador de documentos financieros. Analiza el texto extraído de un documento y determina si cumple el siguiente criterio:

CRITERIO: ${promptIA}

TEXTO DEL DOCUMENTO:
${ocrText.trim() || '(Sin texto extraído — documento vacío o no legible)'}

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional:
{"valido": true_o_false, "score": 0.0_a_1.0, "observaciones": "explicación breve en español"}

- "valido": true si el documento cumple el criterio, false si no
- "score": confianza (0.0 = ninguna, 1.0 = total)
- "observaciones": máximo 120 caracteres explicando el resultado`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => '');
      console.log(`[VALIDAR-DOC] Anthropic error ${anthropicRes.status}: ${errText}`);
      return c.json({ error: "Error al consultar la IA" }, 502);
    }

    const anthropicData = await anthropicRes.json();
    const rawContent: string = anthropicData?.content?.[0]?.text ?? '';

    let result: { valido: boolean; score: number; observaciones: string };
    try {
      const match = rawContent.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : null;
      if (!result || typeof result.valido !== 'boolean') throw new Error('Invalid shape');
    } catch {
      console.log(`[VALIDAR-DOC] Failed to parse Claude response: ${rawContent}`);
      result = { valido: false, score: 0, observaciones: 'No se pudo interpretar la respuesta de IA' };
    }

    console.log(`[VALIDAR-DOC] user=${authUser.email} valido=${result.valido} score=${result.score}`);
    return c.json({
      valido: Boolean(result.valido),
      score: Math.min(1, Math.max(0, Number(result.score) || 0)),
      observaciones: String(result.observaciones ?? ''),
    });
  } catch (err: any) {
    console.log(`[VALIDAR-DOC] Error: ${err.message}`);
    return c.json({ error: "Error interno al validar documento" }, 500);
  }
});

// Wrap app.fetch to silently handle "connection closed" errors at the Deno runtime level.
// These occur when the client (browser) aborts the request (e.g. timeout, navigation)
// before the server finishes writing the response. This is benign and expected.
Deno.serve(async (req, info) => {
  try {
    return await app.fetch(req, info);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('connection closed before message completed') || msg.includes('connection closed')) {
      console.log(`[HTTP] Client disconnected (caught at Deno.serve): ${req.method} ${new URL(req.url).pathname}`);
      return new Response('Client disconnected', { status: 499 });
    }
    console.log(`[HTTP] Fatal error in Deno.serve handler: ${msg}`);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});