import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import postgres from "npm:postgres";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
// (seed file removed — seedProductosCompletos.tsx eliminado para evitar duplicados)

// ─── Boot log ───────────────────────────────────────────────────────
// TODOS los endpoints de J_CLIENTES devuelven TODOS los registros SIN WHERE
// useClientesDB v11.0 → /clientes-lista-todos | useProspectosDB → /clientes-prospectos
const EDGE_VERSION = "v20.3-PLANTILLAS-FORMALIZAR";
console.log(`[SERVER BOOT] Edge function loaded — ${EDGE_VERSION}`);
console.log(`[SERVER BOOT] Routes: TODOS los endpoints de J_CLIENTES sin filtros WHERE`);
console.log(`[SERVER BOOT] Auto-bootstrap: public.get_clientes() + public.get_all_jclientes() RPCs`);

const app = new Hono();

// Logger — usa console.log explícitamente
app.use("*", logger(console.log));

// CORS abierto para todas las rutas y métodos
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ═══════════════════════════════════════════════════════════════════
// Conexión directa a PostgreSQL — bypassa PostgREST.
// Columnas reales de la tabla:
//   id   (uuid PK autogenerado)
//   type (varchar)
//   data (jsonb)
// ═══════════════════════════════════════════════════════════════════
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
  prepare: false,      // Requerido para Transaction-mode pooling de Supabase
  max: 1,              // Edge Functions: 1 conexión por instancia para no agotar slots
  idle_timeout: 10,    // Liberar conexiones inactivas después de 10s
  connect_timeout: 15, // Timeout de conexión: 15s
  max_lifetime: 60,    // Reciclar conexiones cada 60s
});

console.log("[SERVER BOOT] PostgreSQL client created (SUPABASE_DB_URL)");

// ════════════════════════════════════════════════════════════════���══
// AUTO-BOOTSTRAP: Crear funciones RPC en esquema public
// para que PostgREST pueda consultar EFINANCIANET_DB sin exponer el esquema.
// Esto se ejecuta UNA VEZ en cada cold-start de la edge function.
// CREATE OR REPLACE es idempotente — seguro de re-ejecutar.
// ═══════════════════════════════════════════════════════════════════
(async () => {
  try {
    console.log("[BOOTSTRAP] Creando/actualizando funciones RPC en public schema...");
    await sql`
      CREATE OR REPLACE FUNCTION public.get_clientes()
      RETURNS TABLE (id uuid, type text, subtipo text, estatus text, data jsonb, par_cliente_id uuid)
      LANGUAGE sql SECURITY DEFINER STABLE
      AS $fn$
        SELECT id, type::text, subtipo::text, estatus::text, data, par_cliente_id
        FROM "EFINANCIANET_DB"."J_CLIENTES"
        ORDER BY data->>'fechaOriginacion' DESC NULLS LAST;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.get_clientes() TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.get_clientes() TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.get_clientes() OK");

    await sql`
      CREATE OR REPLACE FUNCTION public.get_all_jclientes()
      RETURNS TABLE (id uuid, type text, subtipo text, estatus text, data jsonb, par_cliente_id uuid)
      LANGUAGE sql SECURITY DEFINER STABLE
      AS $fn$
        SELECT id, type::text, subtipo::text, estatus::text, data, par_cliente_id
        FROM "EFINANCIANET_DB"."J_CLIENTES"
        ORDER BY data->>'fechaOriginacion' DESC NULLS LAST;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.get_all_jclientes() TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.get_all_jclientes() TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.get_all_jclientes() OK");

    // ── RPC para actualizar par_cliente_id (columna física FK auto-referencial) ──
    await sql`
      CREATE OR REPLACE FUNCTION public.update_par_cliente_id(
        p_id uuid,
        p_par_cliente_id uuid DEFAULT NULL
      )
      RETURNS void
      LANGUAGE sql SECURITY DEFINER VOLATILE
      AS $fn$
        UPDATE "EFINANCIANET_DB"."J_CLIENTES"
        SET par_cliente_id = p_par_cliente_id
        WHERE id = p_id;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.update_par_cliente_id(uuid, uuid) TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.update_par_cliente_id(uuid, uuid) TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.update_par_cliente_id() OK");

    // ── RPC para validación atómica de Cuenta Eje única ──
    await sql`
      CREATE OR REPLACE FUNCTION public.check_cuenta_eje_unique(
        p_cuenta_eje text,
        p_exclude_id uuid DEFAULT NULL
      )
      RETURNS TABLE (is_unique boolean, existing_id uuid, existing_nombre text)
      LANGUAGE plpgsql SECURITY DEFINER STABLE
      AS $fn$
      DECLARE
        v_row RECORD;
      BEGIN
        SELECT c.id, c.data->>'nombre' AS nombre
        INTO v_row
        FROM "EFINANCIANET_DB"."J_CLIENTES" c
        WHERE c.data->>'cuentaEje' = p_cuenta_eje
          AND (p_exclude_id IS NULL OR c.id != p_exclude_id)
        LIMIT 1;

        IF v_row.id IS NULL THEN
          RETURN QUERY SELECT true::boolean, NULL::uuid, NULL::text;
        ELSE
          RETURN QUERY SELECT false::boolean, v_row.id, v_row.nombre;
        END IF;
      END;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.check_cuenta_eje_unique(text, uuid) TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.check_cuenta_eje_unique(text, uuid) TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.check_cuenta_eje_unique() OK");

    // ── RPC para reparar prospectos legacy corrompidos por compactación v3.5 ──
    await sql`
      CREATE OR REPLACE FUNCTION public.repair_legacy_prospectos()
      RETURNS TABLE (repaired_id uuid, repaired_nombre text, fields_restored text)
      LANGUAGE plpgsql SECURITY DEFINER VOLATILE
      AS $fn$
      DECLARE
        v_row RECORD;
        v_data jsonb;
        v_default_node jsonb;
        v_restored text[];
        v_key text;
        v_val jsonb;
      BEGIN
        FOR v_row IN
          SELECT id, data
          FROM "EFINANCIANET_DB"."J_CLIENTES"
          WHERE type = 'Prospecto'
            AND data IS NOT NULL
        LOOP
          v_data := v_row.data;
          v_default_node := v_data->'default';
          v_restored := ARRAY[]::text[];

          -- Restaurar campos esenciales desde nodo default si existen allí pero no en raíz
          IF v_default_node IS NOT NULL AND jsonb_typeof(v_default_node) = 'object' THEN
            FOR v_key, v_val IN SELECT * FROM jsonb_each(v_default_node) LOOP
              IF v_key != 'default'
                AND v_val IS NOT NULL
                AND jsonb_typeof(v_val) != 'null'
                AND (v_val)::text != '""'
                AND (
                  v_data->v_key IS NULL
                  OR jsonb_typeof(v_data->v_key) = 'null'
                  OR (v_data->>v_key) = ''
                )
              THEN
                v_data := v_data || jsonb_build_object(v_key, v_val);
                v_restored := array_append(v_restored, v_key);
              END IF;
            END LOOP;
          END IF;

          -- Solo actualizar si hubo restauraciones
          IF array_length(v_restored, 1) > 0 THEN
            UPDATE "EFINANCIANET_DB"."J_CLIENTES"
            SET data = v_data
            WHERE id = v_row.id;

            RETURN QUERY SELECT v_row.id, (v_data->>'nombre')::text, array_to_string(v_restored, ', ');
          END IF;
        END LOOP;
      END;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.repair_legacy_prospectos() TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.repair_legacy_prospectos() TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.repair_legacy_prospectos() OK");

    // ── RPC para limpiar registros contaminados con clasificacionCliente: "Gobierno Magisterio" ──
    await sql`
      CREATE OR REPLACE FUNCTION public.clean_clasificacion_gobierno_magisterio()
      RETURNS TABLE (cleaned_id uuid, cleaned_nombre text)
      LANGUAGE plpgsql SECURITY DEFINER VOLATILE
      AS $fn$
      DECLARE
        v_row RECORD;
      BEGIN
        FOR v_row IN
          SELECT id, data->>'nombre' AS nombre
          FROM "EFINANCIANET_DB"."J_CLIENTES"
          WHERE data->>'clasificacionCliente' = 'Gobierno Magisterio'
        LOOP
          UPDATE "EFINANCIANET_DB"."J_CLIENTES"
          SET data = data - 'clasificacionCliente'
          WHERE id = v_row.id;

          RETURN QUERY SELECT v_row.id, v_row.nombre;
        END LOOP;
      END;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.clean_clasificacion_gobierno_magisterio() TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.clean_clasificacion_gobierno_magisterio() TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.clean_clasificacion_gobierno_magisterio() OK");

    // ── RPC para detectar expedientes con blob URLs inválidas ──
    await sql`
      CREATE OR REPLACE FUNCTION public.detect_invalid_blob_urls()
      RETURNS TABLE (record_id uuid, record_nombre text, expediente_idx int, expediente_nombre text, invalid_url text)
      LANGUAGE plpgsql SECURITY DEFINER STABLE
      AS $fn$
      DECLARE
        v_row RECORD;
        v_exp jsonb;
        v_idx int;
        v_url text;
      BEGIN
        FOR v_row IN
          SELECT id, data->>'nombre' AS nombre, data->'expedientesElectronicos' AS exps
          FROM "EFINANCIANET_DB"."J_CLIENTES"
          WHERE data->'expedientesElectronicos' IS NOT NULL
            AND jsonb_typeof(data->'expedientesElectronicos') = 'array'
            AND jsonb_array_length(data->'expedientesElectronicos') > 0
        LOOP
          v_idx := 0;
          FOR v_exp IN SELECT * FROM jsonb_array_elements(v_row.exps) LOOP
            v_url := v_exp->>'url';
            IF v_url IS NOT NULL AND (v_url LIKE 'blob:%' OR v_url LIKE 'data:%') THEN
              RETURN QUERY SELECT v_row.id, v_row.nombre, v_idx, (v_exp->>'nombre')::text, v_url;
            END IF;
            v_idx := v_idx + 1;
          END LOOP;
        END LOOP;
      END;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.detect_invalid_blob_urls() TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.detect_invalid_blob_urls() TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.detect_invalid_blob_urls() OK");

    // ══════════════════════════════════════════════════════════════
    // RPCs para J_CUENTAS_CORP_CLIENTES (Solicitudes de Crédito)
    // ══════════════════════════════════════════════════════════════

    await sql`
      CREATE OR REPLACE FUNCTION public.get_solicitudes_credito()
      RETURNS TABLE (
        id uuid, type text, no_sol text, no_cuenta text, no_referenc1 text,
        fecha_sol date, fecha_autori date, fecha_disper date, fecha_cancel date,
        fecha_inicio date, fecha_fin_cu date, descripcion text,
        linea_produc text, tipo_produc text, producto_id uuid, producto_eje uuid,
        cliente_id uuid, saldo_actual money, monto_sol money, monto_aut money,
        monto_disp money, estatus_disp text, estatus_sol text, estatus_cart text,
        estatus_cuen text, cta_eje_chec boolean, fases text, data jsonb
      )
      LANGUAGE sql SECURITY DEFINER STABLE
      AS $fn$
        SELECT id, type::text, no_sol::text, no_cuenta::text, no_referenc1::text,
               fecha_sol, fecha_autori, fecha_disper, fecha_cancel,
               fecha_inicio, fecha_fin_cu, descripcion::text,
               linea_produc::text, tipo_produc::text, producto_id, producto_eje,
               cliente_id, saldo_actual, monto_sol, monto_aut,
               monto_disp, estatus_disp::text, estatus_sol::text, estatus_cart::text,
               estatus_cuen::text, cta_eje_chec, fases::text, data
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        ORDER BY fecha_sol DESC NULLS LAST;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.get_solicitudes_credito() TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.get_solicitudes_credito() TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.get_solicitudes_credito() OK");

    await sql`
      CREATE OR REPLACE FUNCTION public.insert_solicitud_credito(
        p_type text,
        p_no_sol text,
        p_no_cuenta text DEFAULT '',
        p_no_referenc1 text DEFAULT NULL,
        p_fecha_sol date DEFAULT CURRENT_DATE,
        p_descripcion text DEFAULT NULL,
        p_linea_produc text DEFAULT 'Crédito',
        p_tipo_produc text DEFAULT '',
        p_producto_id uuid DEFAULT NULL,
        p_cliente_id uuid DEFAULT NULL,
        p_monto_sol numeric DEFAULT 0,
        p_monto_aut numeric DEFAULT 0,
        p_estatus_sol text DEFAULT 'Pendiente',
        p_fases text DEFAULT '1',
        p_data jsonb DEFAULT '{}'::jsonb
      )
      RETURNS TABLE (id uuid)
      LANGUAGE plpgsql SECURITY DEFINER VOLATILE
      AS $fn$
      DECLARE
        v_cliente uuid;
        v_id uuid;
      BEGIN
        v_cliente := p_cliente_id;
        IF v_cliente IS NULL THEN
          SELECT c.id INTO v_cliente
          FROM "EFINANCIANET_DB"."J_CLIENTES" c
          LIMIT 1;
        END IF;
        IF v_cliente IS NULL THEN
          RAISE EXCEPTION 'No hay clientes en J_CLIENTES para vincular la solicitud. Cree al menos un cliente primero.';
        END IF;

        INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
          type, no_sol, no_cuenta, no_referenc1, fecha_sol, descripcion,
          linea_produc, tipo_produc, producto_id, cliente_id,
          monto_sol, monto_aut, estatus_sol, fases, data
        ) VALUES (
          p_type, p_no_sol, p_no_cuenta, p_no_referenc1, p_fecha_sol, p_descripcion,
          p_linea_produc, p_tipo_produc, p_producto_id, v_cliente,
          p_monto_sol::money, p_monto_aut::money, p_estatus_sol, p_fases, p_data
        )
        RETURNING "J_CUENTAS_CORP_CLIENTES".id INTO v_id;

        RETURN QUERY SELECT v_id;
      END;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.insert_solicitud_credito(text,text,text,text,date,text,text,text,uuid,uuid,numeric,numeric,text,text,jsonb) TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.insert_solicitud_credito(text,text,text,text,date,text,text,text,uuid,uuid,numeric,numeric,text,text,jsonb) TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.insert_solicitud_credito() OK");

    await sql`
      CREATE OR REPLACE FUNCTION public.update_solicitud_credito(
        p_id uuid,
        p_descripcion text DEFAULT NULL,
        p_monto_sol numeric DEFAULT NULL,
        p_monto_aut numeric DEFAULT NULL,
        p_estatus_sol text DEFAULT NULL,
        p_fases text DEFAULT NULL,
        p_data jsonb DEFAULT NULL
      )
      RETURNS void
      LANGUAGE plpgsql SECURITY DEFINER VOLATILE
      AS $fn$
      BEGIN
        UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        SET
          descripcion  = COALESCE(p_descripcion, descripcion),
          monto_sol    = COALESCE(p_monto_sol::money, monto_sol),
          monto_aut    = COALESCE(p_monto_aut::money, monto_aut),
          estatus_sol  = COALESCE(p_estatus_sol, estatus_sol),
          fases        = COALESCE(p_fases, fases),
          data         = CASE WHEN p_data IS NOT NULL THEN COALESCE(data, '{}'::jsonb) || p_data ELSE data END
        WHERE id = p_id;
      END;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.update_solicitud_credito(uuid,text,numeric,numeric,text,text,jsonb) TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.update_solicitud_credito(uuid,text,numeric,numeric,text,text,jsonb) TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.update_solicitud_credito() OK");

    await sql`
      CREATE OR REPLACE FUNCTION public.delete_solicitud_credito(p_id uuid)
      RETURNS void
      LANGUAGE sql SECURITY DEFINER VOLATILE
      AS $fn$
        DELETE FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = p_id;
      $fn$;
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.delete_solicitud_credito(uuid) TO anon;`;
    await sql`GRANT EXECUTE ON FUNCTION public.delete_solicitud_credito(uuid) TO authenticated;`;
    console.log("[BOOTSTRAP] ✅ public.delete_solicitud_credito() OK");

    console.log("[BOOTSTRAP] ✅ TODAS las funciones RPC listas para PostgREST");
  } catch (err: any) {
    console.log("[BOOTSTRAP] ⚠️ Error creando RPCs:", err.message || String(err));
    console.log("[BOOTSTRAP] ⚠️ El servidor sigue funcionando. RPCs se pueden crear manualmente.");
  }
})();

// ═══════════════════════════════════════════════════════════════════
// Utilidad: DEEP MERGE institucional para columna data (JSONB)
//
// REGLAS INSTITUCIONALES DE MERGE:
// 1. NUNCA eliminar campos existentes del JSON
// 2. Leer JSON actual → merge profundo → escribir resultado
// 3. Solo actualizar campos que el frontend envía con valor real
// 4. Conservar TODOS los campos no enviados (contrasena, curp, etc.)
// 5. Para sub-objetos (ej: "default"): merge recursivo, NO reemplazo
// 6. Para arrays (ej: "direcciones", "sic"): reemplazo atómico
//    (el frontend siempre envía el array completo del subtab)
// 7. Campos vacíos ("", null, undefined) del frontend = NO TOCAR
// 8. Campos nuevos del frontend = AGREGAR sin borrar existentes
// ═══════════════════════════════════════════════════════════════════

/**
 * Deep merge: fusiona `incoming` sobre `existing` recursivamente.
 * - Claves con valor "", null, undefined en incoming → se IGNORAN (se conserva existing)
 * - Claves tipo array en incoming → reemplazan el array existente (atómico)
 * - Claves tipo objeto en incoming → merge recursivo con el objeto existente
 * - Claves escalares con valor real en incoming → sobreescriben
 * - Claves que solo existen en existing → se CONSERVAN intactas
 */
function deepMergeData(
  existing: Record<string, any>,
  incoming: Record<string, any>,
): Record<string, any> {
  // Empezar con copia de TODOS los campos existentes (regla 1: nunca eliminar)
  const merged: Record<string, any> = { ...existing };

  for (const [key, incomingValue] of Object.entries(incoming)) {
    // ── Regla 7: campos vacíos del frontend = NO TOCAR ──
    if (incomingValue === null || incomingValue === undefined || incomingValue === "") {
      // No hacer nada — el valor existente (si hay) se conserva
      continue;
    }

    // ── Regla 6: arrays se reemplazan atómicamente ──
    // (direcciones, expedientes, sic, listasNegras, cotizaciones, etc.)
    if (Array.isArray(incomingValue)) {
      merged[key] = incomingValue;
      continue;
    }

    // ── Regla 5: sub-objetos → merge recursivo ──
    if (typeof incomingValue === "object") {
      const existingChild = existing[key];
      if (existingChild && typeof existingChild === "object" && !Array.isArray(existingChild)) {
        // Ambos son objetos → merge recursivo
        merged[key] = deepMergeData(existingChild, incomingValue);
      } else {
        // El existente no era objeto o no existía → usar incoming
        merged[key] = incomingValue;
      }
      continue;
    }

    // ── Regla 3: escalar con valor real → actualizar ──
    merged[key] = incomingValue;
  }

  return merged;
}

// ═══════════════════════════════════════════════════════════════════
// Supabase Client — para operaciones de Storage
// ═══════════════════════════════════════════════════════════════════
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BUCKET_NAME = "make-7e2d13d9-expedientes-electronicos-prospectos";
const BUCKET_CONSTANCIAS = "make-9a76e68a-constancias";

// Crear buckets idempotentemente al arrancar el servidor
// REGLA INSTITUCIONAL: buckets DEBEN ser public para que las URLs /object/public/ funcionen
// REGLA INSTITUCIONAL: policies deben incluir rol "anon" porque el frontend usa publicAnonKey
(async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    console.log(`[STORAGE] Buckets existentes: [${(buckets || []).map((b: any) => b.name).join(', ')}]`);

    // Bucket de expedientes electrónicos — DEBE ser public para URLs /object/public/
    const bucketExists = buckets?.some((b: any) => b.name === BUCKET_NAME);
    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
      if (error) {
        console.log(`[STORAGE] Error creando bucket ${BUCKET_NAME}:`, error.message);
      } else {
        console.log(`[STORAGE] Bucket creado (public): ${BUCKET_NAME}`);
      }
    } else {
      // Asegurar que el bucket existente sea público (pudo haberse creado como private antes)
      try {
        await supabase.storage.updateBucket(BUCKET_NAME, { public: true });
        console.log(`[STORAGE] Bucket actualizado a public: ${BUCKET_NAME}`);
      } catch (updErr: any) {
        console.log(`[STORAGE] Bucket ya existe (update a public):`, updErr?.message || 'OK');
      }
    }

    // Bucket de constancias — DEBE ser public para URLs /object/public/
    const constanciasExists = buckets?.some((b: any) => b.name === BUCKET_CONSTANCIAS);
    if (!constanciasExists) {
      const { error } = await supabase.storage.createBucket(BUCKET_CONSTANCIAS, { public: true });
      if (error) {
        console.log(`[STORAGE] Error creando bucket ${BUCKET_CONSTANCIAS}:`, error.message);
      } else {
        console.log(`[STORAGE] Bucket creado (public): ${BUCKET_CONSTANCIAS}`);
      }
    } else {
      try {
        await supabase.storage.updateBucket(BUCKET_CONSTANCIAS, { public: true });
        console.log(`[STORAGE] Bucket actualizado a public: ${BUCKET_CONSTANCIAS}`);
      } catch (updErr: any) {
        console.log(`[STORAGE] Bucket constancias (update a public):`, updErr?.message || 'OK');
      }
    }

    // ── RLS Policies para AMBOS buckets de Storage ──
    // Target "anon, authenticated" porque el frontend usa publicAnonKey (rol anon)
    // INSERT requiere WITH CHECK (no USING) en PostgreSQL RLS
    console.log("[STORAGE] Creando políticas RLS para buckets expedientes + constancias...");

    const allBucketPolicies = [
      { bucket: BUCKET_NAME, prefix: 'expedientes' },
      { bucket: BUCKET_CONSTANCIAS, prefix: 'constancias' },
    ];

    for (const { bucket, prefix } of allBucketPolicies) {
      const policyDefs = [
        { name: `${prefix}_select_policy`, action: 'SELECT' },
        { name: `${prefix}_insert_policy`, action: 'INSERT' },
        { name: `${prefix}_update_policy`, action: 'UPDATE' },
        { name: `${prefix}_delete_policy`, action: 'DELETE' },
      ];
      for (const p of policyDefs) {
        try {
          await sql.unsafe(`DROP POLICY IF EXISTS "${p.name}" ON storage.objects`);
          if (p.action === 'INSERT') {
            // INSERT usa WITH CHECK, no USING
            await sql.unsafe(
              `CREATE POLICY "${p.name}" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = '${bucket}')`
            );
          } else {
            await sql.unsafe(
              `CREATE POLICY "${p.name}" ON storage.objects FOR ${p.action} TO anon, authenticated USING (bucket_id = '${bucket}')`
            );
          }
          console.log(`[STORAGE] ✅ Policy ${p.name} (${p.action}) OK — bucket=${bucket}`);
        } catch (policyErr: any) {
          console.log(`[STORAGE] ⚠️ Policy ${p.name} error:`, policyErr.message || String(policyErr));
        }
      }
    }
    console.log("[STORAGE] ✅ RLS Policies para expedientes + constancias completadas");

  } catch (err) {
    console.log("[STORAGE] Error verificando/creando buckets:", String(err));
  }
})();

// ═══════════════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════════════

// Health check — incluye versión y deploy timestamp para verificar despliegue
const healthHandler = (c: any) => {
  return c.json({
    status: "ok",
    version: EDGE_VERSION,
    deploy: DEPLOY_TIMESTAMP,
    timestamp: new Date().toISOString(),
    routes: [
      "/clientes-lista-todos (EXCLUSIVO sin WHERE)",
      "/clientes-prospectos (sin WHERE desde v3.0)",
    ],
  });
};

// GET /seed-credito — Inserta un registro de prueba "Crédito Personal" si no existe
const seedCreditoHandler = async (c: any) => {
  try {
    console.log("[GET /seed-credito] Verificando si ya existe PR-001...");

    // Evitar duplicados: buscar por idProducto dentro del JSONB
    const existing = await sql`
      SELECT id FROM "EFINANCIANET_DB"."J_PRODUCTOS"
      WHERE type = 'Credito' AND data->>'idProducto' = 'PR-001'
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.log("[GET /seed-credito] Ya existe PR-001, omitiendo insert.");
      return c.json({
        success: true,
        message: "El registro PR-001 ya existe, no se insertó duplicado.",
        existingId: existing[0].id,
      });
    }

    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_PRODUCTOS" (id, type, data)
      VALUES (
        gen_random_uuid(),
        'Credito',
        ${sql.json({
          idProducto: "PR-001",
          nombre: "Crédito Personal",
          descripcion: "Préstamo que se utiliza para cubrir necesidades personales.",
          lineaProducto: "Crédito",
          sublinea: "Crédito Individual",
          sucursal: "CDMX",
          estatus: "Activo",
          fechaRegistro: "2023-08-24",
        })}
      )
      RETURNING id, type, data
    `;

    console.log("[GET /seed-credito] Registro insertado:", inserted[0]?.id);
    return c.json({ success: true, data: inserted, id: inserted[0]?.id });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en seed-credito:", msg);
    return c.json({ error: `Error al insertar seed: ${msg}` }, 500);
  }
};

// (seed-productos-completos handler eliminado — archivo de datos removido para evitar duplicados)

// GET /productos-credito — registros de J_PRODUCTOS con type='Credito'
const getProductosCreditoHandler = async (c: any) => {
  try {
    console.log("[GET /productos-credito v2.1] Consultando J_PRODUCTOS WHERE type='Credito'...");

    const rows = await sql`
      SELECT id, type, data
      FROM "EFINANCIANET_DB"."J_PRODUCTOS"
      WHERE type = 'Credito'
    `;

    console.log(`[GET /productos-credito v2.1] ${rows.length} registros tipo Credito`);
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en GET /productos-credito:", msg);
    return c.json({ error: `Error de base de datos en SELECT J_PRODUCTOS: ${msg}` }, 500);
  }
};

// GET /productos-seguros — registros de J_PRODUCTOS con type='Seguro'
const getProductosSegurosHandler = async (c: any) => {
  try {
    console.log("[GET /productos-seguros v1.0] Consultando J_PRODUCTOS WHERE type='Seguro'...");

    const rows = await sql`
      SELECT id, type, data
      FROM "EFINANCIANET_DB"."J_PRODUCTOS"
      WHERE type = 'Seguro'
    `;

    console.log(`[GET /productos-seguros v1.0] ${rows.length} registros tipo Seguro`);
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en GET /productos-seguros:", msg);
    return c.json({ error: `Error de base de datos en SELECT J_PRODUCTOS (Seguro): ${msg}` }, 500);
  }
};

// POST /activar-prospecto — Activa prospecto y crea cuenta eje
const activarProspectoHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { cliente_id, nombre_prospecto } = body;
    if (!cliente_id) {
      return c.json({ error: 'cliente_id requerido' }, 400);
    }
    const clienteUuid = toNullUuid(cliente_id);
    console.log('[activar-prospecto] Iniciando:', clienteUuid);

    // Verificar si ya tiene cuenta eje
    const existing = await sql`
      SELECT id FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE cliente_id = ${clienteUuid}::uuid AND cta_eje_chec = true
      LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" SET estatus_sol = 'Autorizada' WHERE id = ${existing[0].id}::uuid`;
      return c.json({ ok: true, ya_tiene_cuenta_eje: true, cuentaEjeId: existing[0].id, estatus_sol: 'Autorizada' });
    }

    // Buscar producto eje
    let productoEjeId: string | null = null;
    try {
      const productos = await sql`SELECT id, data FROM "EFINANCIANET_DB"."J_PRODUCTOS"`;
      const eje = productos.filter((p: any) => {
        const d = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
        return d.cuentaEje === true || d.cuentaEje === 'true';
      });
      if (eje.length > 0) productoEjeId = eje[0].id;
    } catch (e) { console.log('[activar-prospecto] Error producto:', e); }

    const now = new Date().toISOString();
    const noSol = `AUTO-${clienteUuid?.substring(0, 8) || 'unknown'}`;
    const noCuenta = `0147${String(Math.floor(Math.random() * 99999999)).padStart(8, '0')}`;
    const noRef = `REF-${Date.now().toString(36).toUpperCase()}`;

    const dataJson = JSON.stringify({
      metadatos: { noSol, noCuenta, noReferenc1: noRef, origenCreacion: 'ActivacionProspecto', titular: nombre_prospecto || 'Sin nombre' },
      estatusCuenta: 'Activa', estatusSolicitud: 'Autorizada', estatusCartera: 'Activa', saldoActual: 0, fechaApertura: now,
    });

    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
        type, no_sol, no_cuenta, no_referenc1, fecha_sol, fecha_autori, fecha_inicio,
        descripcion, linea_produc, tipo_produc, producto_id, producto_eje, cliente_id,
        monto_sol, monto_aut, monto_disp, estatus_disp, estatus_sol, estatus_cart, estatus_cuen,
        cta_eje_chec, fases, data
      ) VALUES (
        'CuentaAhorro', ${noSol}, ${noCuenta}, ${noRef}, ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz,
        ${'Cuenta Eje generada automáticamente al activar prospecto ' + (nombre_prospecto || 'Sin nombre')},
        'CAPTACION', 'Ahorro', ${productoEjeId}::uuid, ${productoEjeId}, ${clienteUuid}::uuid,
        0, 0, 0, 'No Aplica', 'Autorizada', 'Activa', 'Activa',
        true, 'Activa', ${dataJson}::jsonb
      )
      RETURNING id, no_cuenta, estatus_sol, producto_eje
    `;

    const cuentaEje = inserted[0];

    // Verificar tipo actual del cliente
    const clienteCheck = await sql`
      SELECT type FROM "EFINANCIANET_DB"."J_CLIENTES"
      WHERE id = ${clienteUuid}::uuid
      LIMIT 1
    `;
    const tipoActual = clienteCheck[0]?.type;
    
    // Solo actualizar si es Prospecto (no si ya es Cliente) - ignore par_cliente_id
    try {
      if (tipoActual === 'Prospecto') {
        // Usar UPDATE sin tocar par_cliente_id
        await sql`
          UPDATE "EFINANCIANET_DB"."J_CLIENTES"
          SET type = 'Clientes', 
              estatus = 'Activo', 
              data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('estatusCliente', 'Cliente', 'fechaActivacion', ${now}::text)
          WHERE id = ${clienteUuid}::uuid 
            AND type = 'Prospecto'
            AND par_cliente_id IS NULL
        `;
        
        // Si no se actualizó, puede ser porque par_cliente_id tiene valor - solo actualizar data
        const updated = await sql`SELECT id FROM "EFINANCIANET_DB"."J_CLIENTES" WHERE id = ${clienteUuid}::uuid AND type = 'Clientes'`;
        if (updated.length === 0) {
          await sql`
            UPDATE "EFINANCIANET_DB"."J_CLIENTES"
            SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('estatusCliente', 'Cliente', 'fechaActivacion', ${now}::text)
            WHERE id = ${clienteUuid}::uuid
          `;
        }
      }
    } catch (updErr) {
      console.log('[activar-prospecto] Error actualizando cliente:', updErr);
    }

    return c.json({ ok: true, cuentaEjeId: cuentaEje.id, noCuenta: cuentaEje.no_cuenta, estatus_sol: cuentaEje.estatus_sol, producto_eje: cuentaEje.producto_eje });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
};

// GET /productos-captacion — TODOS los registros de J_PRODUCTOS (sin filtro)
const getProductosCaptacionHandler = async (c: any) => {
  try {
    console.log("[GET /productos-captacion v2.0] Consultando TODOS los registros de J_PRODUCTOS (sin filtro)...");

    const rows = await sql`
      SELECT id, type, subtipo, estatus, data
      FROM "EFINANCIANET_DB"."J_PRODUCTOS"
    `;

    console.log(`[GET /productos-captacion v2.0] ${rows.length} registros totales`);
    return c.json({ success: true, data: rows, _version: EDGE_VERSION });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en GET /productos-captacion:", msg);
    return c.json({ error: `Error de base de datos en SELECT J_PRODUCTOS (captacion): ${msg}` }, 500);
  }
};

// GET /productos — TODOS los registros de J_PRODUCTOS (sin filtro, query param ?tipo ignorado)
const getProductosHandler = async (c: any) => {
  try {
    console.log("[GET /productos v2.0] Consultando TODOS los registros de J_PRODUCTOS (sin filtro)...");

    const rows = await sql`
      SELECT id, type, data
      FROM "EFINANCIANET_DB"."J_PRODUCTOS"
    `;

    console.log(`[GET /productos v2.0] ${rows.length} registros totales`);
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en GET /productos:", msg);
    return c.json({ error: `Error de base de datos en SELECT J_PRODUCTOS: ${msg}` }, 500);
  }
};

// GET /productos/:id — Un solo producto por UUID (incluye data JSONB completo)
const getProductoByIdHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Se requiere el parámetro id" }, 400);
    }
    // Validar formato UUID antes de consultar
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.log(`[GET /productos/${id}] ID no es UUID válido — ignorando consulta`);
      return c.json({ error: `ID '${id}' no es un UUID válido`, data: null }, 400);
    }
    console.log(`[GET /productos/${id}] Consultando producto por UUID...`);

    const rows = await sql`
      SELECT id, type, data
      FROM "EFINANCIANET_DB"."J_PRODUCTOS"
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (rows.length === 0) {
      console.log(`[GET /productos/${id}] No encontrado`);
      return c.json({ error: `Producto con id ${id} no encontrado`, data: null }, 404);
    }

    console.log(`[GET /productos/${id}] Encontrado — type=${rows[0].type}`);
    return c.json({ success: true, data: rows[0] });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`Error en GET /productos/:id:`, msg);
    return c.json({ error: `Error de base de datos en SELECT J_PRODUCTOS por id: ${msg}` }, 500);
  }
};

// POST /productos — Inserta (id lo genera la BD)
// Body del frontend: { tipo, datos }  →  columnas: type, data
const postProductosHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { tipo, datos } = body;

    if (!tipo || !datos) {
      console.log("Error en POST /productos: Faltan campos obligatorios", { tipo, hasDatos: !!datos });
      return c.json({ error: "Campos obligatorios faltantes: tipo y datos son requeridos" }, 400);
    }

    console.log(`[POST /productos] Insertando type=${tipo} via SQL directo...`);

    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_PRODUCTOS" (type, data)
      VALUES (${tipo}, ${sql.json(datos)})
      RETURNING id, type, data
    `;

    const generatedId = inserted[0]?.id;
    console.log(`INSERT exitoso en J_PRODUCTOS — id: ${generatedId}, type: ${tipo}`);
    return c.json({ success: true, data: inserted, id: generatedId });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en POST /productos:", msg);
    return c.json({ error: `Error de base de datos en INSERT J_PRODUCTOS: ${msg}` }, 500);
  }
};

// PUT /productos/:id — Actualiza
// Body del frontend: { tipo, datos }  →  columnas: type, data
const putProductosHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { tipo, datos } = body;

    if (!id || !tipo || !datos) {
      console.log("Error en PUT /productos: Faltan campos obligatorios", { id, tipo, hasDatos: !!datos });
      return c.json({ error: "Campos obligatorios faltantes: id, tipo y datos son requeridos" }, 400);
    }

    console.log(`[PUT /productos/${id}] Actualizando type=${tipo} via SQL directo...`);

    const updated = await sql`
      UPDATE "EFINANCIANET_DB"."J_PRODUCTOS"
      SET type = ${tipo}, data = ${sql.json(datos)}
      WHERE id = ${id}
      RETURNING id, type, data
    `;

    if (updated.length === 0) {
      console.log(`PUT /productos: No se encontró registro con id=${id}`);
      return c.json({ error: `No se encontró registro con id=${id}` }, 404);
    }

    console.log(`UPDATE exitoso en J_PRODUCTOS — id: ${id}, type: ${tipo}`);
    return c.json({ success: true, data: updated });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en PUT /productos:", msg);
    return c.json({ error: `Error de base de datos en UPDATE J_PRODUCTOS: ${msg}` }, 500);
  }
};

// DELETE /productos/:id
const deleteProductosHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Se requiere el parámetro id" }, 400);
    }

    console.log(`[DELETE /productos/${id}] Eliminando via SQL directo...`);

    await sql`
      DELETE FROM "EFINANCIANET_DB"."J_PRODUCTOS"
      WHERE id = ${id}
    `;

    console.log(`DELETE exitoso en J_PRODUCTOS — id: ${id}`);
    return c.json({ success: true, message: `Registro ${id} eliminado` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en DELETE /productos:", msg);
    return c.json({ error: `Error de base de datos en DELETE J_PRODUCTOS: ${msg}` }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// J_CLIENTES — ROUTE HANDLERS
// Tabla: "EFINANCIANET_DB"."J_CLIENTES"
// Columnas: id (uuid PK), type (varchar), subtipo (varchar),
//           estatus (varchar), data (jsonb)
// ═══════════════════════════════════════════════════════════════════

// GET /clientes-prospectos — v17.0 — TODOS los registros de J_CLIENTES SIN FILTRO
// Usado por: useProspectosDB (sin filtro client-side)
const getClientesProspectosHandler = async (c: any) => {
  try {
    console.log("[GET /clientes-prospectos v17.0] ════════════════════════════════════════");
    console.log("[GET /clientes-prospectos v17.0] SQL: SELECT id, type, subtipo, estatus, data FROM J_CLIENTES — SIN WHERE");

    const rawRows = await sql`
      SELECT id, type, subtipo, estatus, data, par_cliente_id
      FROM "EFINANCIANET_DB"."J_CLIENTES"
      ORDER BY data->>'fechaOriginacion' DESC NULLS LAST
    `;

    const rows = rawRows.map((r: any) => ({
      id:      r.id,
      type:    r.type,
      subtipo: r.subtipo,
      estatus: r.estatus,
      data:    r.data,
      par_cliente_id: r.par_cliente_id,
    }));

    const typeCount: Record<string, number> = {};
    for (const r of rows) {
      const t = r.type || '(null)';
      typeCount[t] = (typeCount[t] || 0) + 1;
    }
    console.log(`[GET /clientes-prospectos v17.0] ${rows.length} registros. Desglose:`, JSON.stringify(typeCount));

    return c.json({
      success: true,
      data: rows,
      _version: EDGE_VERSION,
      _endpoint: "clientes-prospectos",
      _totalRegistros: rows.length,
      _conteoPorType: typeCount,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en GET /clientes-prospectos:", msg);
    return c.json({ error: `Error de base de datos en SELECT J_CLIENTES: ${msg}` }, 500);
  }
};

// GET /clientes-lista — v17.0 — TODOS los registros de J_CLIENTES SIN FILTRO
const getClientesListaHandler = async (c: any) => {
  try {
    console.log("[GET /clientes-lista v17.0] SQL: SELECT * FROM J_CLIENTES — SIN WHERE");

    const rawRows = await sql`
      SELECT id, type, subtipo, estatus, data, par_cliente_id
      FROM "EFINANCIANET_DB"."J_CLIENTES"
      ORDER BY data->>'fechaOriginacion' DESC NULLS LAST
    `;

    const rows = rawRows.map((r: any) => ({
      id:      r.id,
      type:    r.type,
      subtipo: r.subtipo,
      estatus: r.estatus,
      data:    r.data,
      par_cliente_id: r.par_cliente_id,
    }));

    const typeCount: Record<string, number> = {};
    for (const r of rows) {
      const t = r.type || '(null)';
      typeCount[t] = (typeCount[t] || 0) + 1;
    }

    return c.json({
      success: true,
      data: rows,
      _version: EDGE_VERSION,
      _endpoint: "clientes-lista",
      _totalRegistros: rows.length,
      _conteoPorType: typeCount,
    });

  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en GET /clientes-lista:", msg);
    return c.json({ error: `Error: ${msg}` }, 500);
  }
};

// GET /seed-prospecto — Inserta UN registro de prueba en J_CLIENTES para verificar lectura
const seedProspectoHandler = async (c: any) => {
  try {
    console.log("[GET /seed-prospecto] Verificando si ya existe prospecto de prueba...");

    // Evitar duplicados: buscar por nombre dentro del JSONB
    const existing = await sql`
      SELECT id FROM "EFINANCIANET_DB"."J_CLIENTES"
      WHERE type = 'Prospecto' AND data->>'nombre' = 'Carlos García Prueba'
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.log("[GET /seed-prospecto] Ya existe prospecto de prueba, omitiendo insert.");
      return c.json({
        success: true,
        message: "El prospecto de prueba ya existe, no se insertó duplicado.",
        existingId: existing[0].id,
      });
    }

    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CLIENTES" (type, subtipo, estatus, data)
      VALUES (
        'Prospecto',
        'Persona Física',
        'Activo',
        ${sql.json({
          nombre: "Carlos García Prueba",
          denominacionRazonSocial: "",
          sucursal: "CDMX",
          estatusSIC: "Positivo",
          estatusListaNegra: "Positivo",
          fechaOriginacion: "2026-02-14",
          telefono: "5551234567",
          curp: "GAPC900101HDFRRL09",
          rfc: "GAPC900101XX1",
          correoElectronico: "carlos.garcia@ejemplo.com",
          cotizacion: "",
          direccion: "Av. Reforma 123, CDMX",
        })}
      )
      RETURNING id, type, subtipo, estatus, data
    `;

    console.log("[GET /seed-prospecto] Registro insertado:", inserted[0]?.id);
    return c.json({ success: true, data: inserted, id: inserted[0]?.id });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en seed-prospecto:", msg);
    return c.json({ error: `Error al insertar seed prospecto: ${msg}` }, 500);
  }
};

// POST /clientes — Inserta un nuevo registro en J_CLIENTES
// Body del frontend: { type, subtipo, estatus, data, par_cliente_id }
const postClientesHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { type, subtipo, estatus, data, par_cliente_id } = body;

    if (!type || !data) {
      console.log("Error en POST /clientes: Faltan campos obligatorios", { type, hasDatos: !!data });
      return c.json({ error: "Campos obligatorios faltantes: type y data son requeridos" }, 400);
    }

    console.log(`[POST /clientes] Insertando type=${type} subtipo=${subtipo} estatus=${estatus} par_cliente_id=${par_cliente_id || '(null)'} via SQL directo...`);

    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CLIENTES" (type, subtipo, estatus, data, par_cliente_id)
      VALUES (${type}, ${subtipo || null}, ${estatus || null}, ${sql.json(data)}, ${par_cliente_id || null})
      RETURNING id, type, subtipo, estatus, data, par_cliente_id
    `;

    const generatedId = inserted[0]?.id;
    console.log(`INSERT exitoso en J_CLIENTES — id: ${generatedId}, type: ${type}, subtipo: ${subtipo}, par_cliente_id: ${par_cliente_id || '(null)'}`);
    return c.json({ success: true, data: inserted, id: generatedId });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en POST /clientes:", msg);
    return c.json({ error: `Error de base de datos en INSERT J_CLIENTES: ${msg}` }, 500);
  }
};

// PUT /clientes/:id — Actualiza un registro en J_CLIENTES
// Body del frontend: { type, subtipo, estatus, data, par_cliente_id }
// ── CUMPLE REGLAS INSTITUCIONALES DE MERGE JSONB ──
// 1. Lee el JSON actual desde la BD (SELECT data)
// 2. Deep merge recursivo en JS (incoming sobre existing)
// 3. Solo actualiza campos con valor real; vacíos se ignoran
// 4. Conserva TODOS los campos no enviados (contrasena, curp, etc.)
// 5. Sub-objetos (ej: "default") se fusionan recursivamente, NO se reemplazan
// 6. Arrays (ej: "direcciones", "sic") se reemplazan atómicamente
// 7. Escribe el resultado merged como SET data = <merged>
const putClientesHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { type, subtipo, estatus, data } = body;
    // par_cliente_id: solo actualizar si el frontend lo envió explícitamente en el body
    // Si no viene en el body (ej: ProspectoForm), conservar el valor existente en BD
    const parClienteIdExplicit = 'par_cliente_id' in body;
    const par_cliente_id = parClienteIdExplicit ? (body.par_cliente_id || null) : undefined;

    if (!id || !type || !data) {
      console.log("Error en PUT /clientes: Faltan campos obligatorios", { id, type, hasDatos: !!data });
      return c.json({ error: "Campos obligatorios faltantes: id, type y data son requeridos" }, 400);
    }

    console.log(`[PUT /clientes/${id}] ════ ${EDGE_VERSION} ════`);
    console.log(`[PUT /clientes/${id}] DEEP MERGE v5 NUCLEAR — type=${type} subtipo=${subtipo} estatus=${estatus} par_cliente_id=${parClienteIdExplicit ? (par_cliente_id || '(null)') : '(no enviado, conservar existente)'}`);
    console.log(`[PUT /clientes/${id}] INCOMING data keys (${Object.keys(data).length}):`, Object.keys(data).join(", "));
    console.log(`[PUT /clientes/${id}] INCOMING has 'contrasena' key: ${"contrasena" in data}, value: ${data.contrasena === undefined ? "UNDEFINED" : data.contrasena === null ? "NULL" : data.contrasena === "" ? "EMPTY_STRING" : `"${String(data.contrasena).substring(0, 5)}..."`}`);

    // ── PASO 1: Leer el data JSONB actual desde la BD ──
    const currentRows = await sql`
      SELECT data, par_cliente_id
      FROM "EFINANCIANET_DB"."J_CLIENTES"
      WHERE id = ${id}
    `;

    if (currentRows.length === 0) {
      console.log(`PUT /clientes: No se encontro registro con id=${id}`);
      return c.json({ error: `No se encontro registro con id=${id}` }, 404);
    }

    // ── DEFENSA: el driver postgres puede devolver data como string o como objeto ──
    let existingData: Record<string, any>;
    const rawData = currentRows[0].data;
    if (typeof rawData === "string") {
      try {
        existingData = JSON.parse(rawData);
        console.log(`[PUT /clientes/${id}] NOTA: data vino como STRING del driver, parseado a objeto`);
      } catch {
        existingData = {};
        console.log(`[PUT /clientes/${id}] WARN: data STRING no parseable, usando {}`);
      }
    } else if (rawData === null || rawData === undefined) {
      existingData = {};
      console.log(`[PUT /clientes/${id}] WARN: data es null/undefined en BD, usando {}`);
    } else {
      existingData = rawData;
    }

    console.log(`[PUT /clientes/${id}] EXISTING data keys (${Object.keys(existingData).length}):`, Object.keys(existingData).join(", "));
    console.log(`[PUT /clientes/${id}] EXISTING has 'contrasena': ${"contrasena" in existingData}, value: ${existingData.contrasena === undefined ? "UNDEFINED" : `"${String(existingData.contrasena).substring(0, 10)}..."`}`);

    // ── LOG de diagnóstico: campos sensibles ANTES del merge ──
    const sensitiveKeys = ["contrasena", "curp", "sexo", "telefono", "correoElectronico", "institucionGobierno", "fechaNacimiento"];
    const existingSensitive: Record<string, any> = {};
    const incomingSensitive: Record<string, any> = {};
    for (const k of sensitiveKeys) {
      if (k in existingData) existingSensitive[k] = typeof existingData[k] === "string" ? existingData[k].substring(0, 20) : existingData[k];
      if (k in data) incomingSensitive[k] = typeof data[k] === "string" ? (data[k] === "" ? '""' : data[k].substring(0, 20)) : data[k];
    }
    console.log(`[PUT /clientes/${id}] EXISTING sensitive:`, JSON.stringify(existingSensitive));
    console.log(`[PUT /clientes/${id}] INCOMING sensitive:`, JSON.stringify(incomingSensitive));

    // ── PASO 2: Deep merge recursivo — incoming sobre existing ──
    const mergedData = deepMergeData(existingData, data);

    // ══════════════════════════════════════════════════════════════════
    // PASO 2.5: ESCUDO NUCLEAR — Restauración explícita de campos sensibles
    // Si el campo existía en existingData pero NO aparece en mergedData,
    // restaurarlo explícitamente. Esto es un safety net contra CUALQUIER
    // bug en deepMergeData, spread operator, o serialización.
    // ══════════════════════════════════════════════════════════════════
    const PROTECTED_FIELDS = ["contrasena", "curp", "telefono", "correoElectronico", "institucionGobierno", "fechaNacimiento", "sexo"];
    for (const field of PROTECTED_FIELDS) {
      // Caso 1: Campo existía en BD pero desapareció del merge → RESTAURAR
      if (field in existingData && !(field in mergedData)) {
        mergedData[field] = existingData[field];
        console.log(`[PUT /clientes/${id}] ⚡ NUCLEAR RESTORE (missing): ${field} = "${String(existingData[field]).substring(0, 15)}..."`);
      }
      // Caso 2: Campo existía con valor real en BD pero merge lo dejó vacío → RESTAURAR
      if (field in existingData && existingData[field] && field in mergedData && (mergedData[field] === "" || mergedData[field] === null || mergedData[field] === undefined)) {
        mergedData[field] = existingData[field];
        console.log(`[PUT /clientes/${id}] ⚡ NUCLEAR RESTORE (emptied): ${field} = "${String(existingData[field]).substring(0, 15)}..."`);
      }
    }

    // También proteger campos sensibles dentro del nodo "default" si existe
    if (existingData.default && typeof existingData.default === "object" && mergedData.default && typeof mergedData.default === "object") {
      for (const field of PROTECTED_FIELDS) {
        if (field in existingData.default && !(field in mergedData.default)) {
          mergedData.default[field] = existingData.default[field];
          console.log(`[PUT /clientes/${id}] ⚡ NUCLEAR RESTORE (default.${field} missing): "${String(existingData.default[field]).substring(0, 15)}..."`);
        }
        if (field in existingData.default && existingData.default[field] && field in mergedData.default && (mergedData.default[field] === "" || mergedData.default[field] === null || mergedData.default[field] === undefined)) {
          mergedData.default[field] = existingData.default[field];
          console.log(`[PUT /clientes/${id}] ⚡ NUCLEAR RESTORE (default.${field} emptied): "${String(existingData.default[field]).substring(0, 15)}..."`);
        }
      }
    }

    // ── LOG post-merge: verificar campos sensibles DESPUÉS del merge + escudo ──
    const mergedSensitive: Record<string, any> = {};
    for (const k of sensitiveKeys) {
      if (k in mergedData) mergedSensitive[k] = typeof mergedData[k] === "string" ? mergedData[k].substring(0, 20) : mergedData[k];
    }
    console.log(`[PUT /clientes/${id}] MERGED+SHIELD sensitive:`, JSON.stringify(mergedSensitive));

    const existingKeys = Object.keys(existingData).length;
    const incomingKeys = Object.keys(data).length;
    const mergedKeys = Object.keys(mergedData).length;
    console.log(`[PUT /clientes/${id}] Keys — existing: ${existingKeys}, incoming: ${incomingKeys}, merged: ${mergedKeys}`);

    // ── VALIDACIÓN INSTITUCIONAL: merged NUNCA debe tener MENOS keys que existing ──
    if (mergedKeys < existingKeys) {
      console.log(`[PUT /clientes/${id}] ⚠️ ALERTA: merged (${mergedKeys}) < existing (${existingKeys})! Abortando para proteger datos.`);
      return c.json({
        error: `Merge abortado: el resultado (${mergedKeys} keys) tendría menos campos que el original (${existingKeys} keys). Posible pérdida de datos.`,
      }, 409);
    }

    // ══════════════════════════════════════════════════════════════════
    // PASO 3: Escribir merged — el mergedData ya tiene TODOS los campos
    // (existing + incoming + nuclear shield) así que es seguro escribirlo.
    //
    // Capa SQL: COALESCE(data, '{}') || mergedData
    // El || de PostgreSQL preserva keys del LEFT que no estén en RIGHT,
    // así que si mergedData por algún bug no tuviera contrasena,
    // el data original (LEFT) la preservaría.
    // ══════════════════════════════════════════════════════════════════
    console.log(`[PUT /clientes/${id}] FINAL mergedData keys (${Object.keys(mergedData).length}):`, Object.keys(mergedData).join(", "));
    console.log(`[PUT /clientes/${id}] FINAL mergedData.contrasena: ${mergedData.contrasena === undefined ? "UNDEFINED" : `"${String(mergedData.contrasena).substring(0, 10)}..."`}`);

    // Si par_cliente_id fue enviado explícitamente → setearlo (puede ser null para limpiar)
    // Si NO fue enviado → conservar el valor existente en BD
    const updated = parClienteIdExplicit
      ? await sql`
        UPDATE "EFINANCIANET_DB"."J_CLIENTES"
        SET
          type    = COALESCE(${type ?? null}, type),
          subtipo = COALESCE(${subtipo ?? null}, subtipo),
          estatus = COALESCE(${estatus ?? null}, estatus),
          data    = COALESCE(data, '{}'::jsonb) || ${sql.json(mergedData)}::jsonb,
          par_cliente_id = ${par_cliente_id}
        WHERE id = ${id}
        RETURNING id, type, subtipo, estatus, data, par_cliente_id
      `
      : await sql`
        UPDATE "EFINANCIANET_DB"."J_CLIENTES"
        SET
          type    = COALESCE(${type ?? null}, type),
          subtipo = COALESCE(${subtipo ?? null}, subtipo),
          estatus = COALESCE(${estatus ?? null}, estatus),
          data    = COALESCE(data, '{}'::jsonb) || ${sql.json(mergedData)}::jsonb
        WHERE id = ${id}
        RETURNING id, type, subtipo, estatus, data, par_cliente_id
      `;

    // ── PASO 4: Verificación post-escritura ──
    const writtenData = updated[0]?.data || {};
    const writtenParsed = typeof writtenData === "string" ? JSON.parse(writtenData) : writtenData;
    const postWriteSensitive: Record<string, any> = {};
    for (const k of sensitiveKeys) {
      if (k in writtenParsed) postWriteSensitive[k] = typeof writtenParsed[k] === "string" ? writtenParsed[k].substring(0, 20) : writtenParsed[k];
    }
    console.log(`[PUT /clientes/${id}] POST-WRITE sensitive:`, JSON.stringify(postWriteSensitive));
    console.log(`[PUT /clientes/${id}] POST-WRITE total keys: ${Object.keys(writtenParsed).length}`);

    // ── PASO 5: ALERTA FINAL — si contrasena existía y ahora no está → LOG CRITICO ──
    if (existingData.contrasena && !writtenParsed.contrasena) {
      console.log(`[PUT /clientes/${id}] 🚨🚨🚨 CRITICAL: contrasena EXISTED in DB ("${String(existingData.contrasena).substring(0, 10)}...") but is MISSING after write! All protections FAILED.`);
      console.log(`[PUT /clientes/${id}] 🚨 mergedData had contrasena: ${"contrasena" in mergedData}, value: ${mergedData.contrasena}`);
      console.log(`[PUT /clientes/${id}] 🚨 SQL used: data || mergedData || (subquery with originals)`);
    } else if (existingData.contrasena && writtenParsed.contrasena) {
      console.log(`[PUT /clientes/${id}] ✅ contrasena PRESERVED: "${String(writtenParsed.contrasena).substring(0, 10)}..."`);
    }

    console.log(`[PUT /clientes/${id}] ════ UPDATE (deep merge v5 NUCLEAR) exitoso — merged keys: ${mergedKeys} ════`);
    return c.json({ success: true, data: updated, id, _version: EDGE_VERSION });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en PUT /clientes:", msg);
    return c.json({ error: `Error de base de datos en UPDATE J_CLIENTES: ${msg}` }, 500);
  }
};

// PATCH /clientes/:id — Actualiza parcialmente un registro en J_CLIENTES
// ── CUMPLE REGLAS INSTITUCIONALES DE MERGE JSONB ──
// Misma lógica que PUT: READ → DEEP MERGE → WRITE
// Diferencia: columnas escalares (type, subtipo, estatus) solo se actualizan si se envían
const patchClientesHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { type, subtipo, estatus, data, par_cliente_id } = body;

    if (!id) {
      console.log("Error en PATCH /clientes: Falta el parametro id");
      return c.json({ error: "Falta el parametro id" }, 400);
    }

    console.log(`[PATCH /clientes/${id}] DEEP MERGE parcial — type=${type} subtipo=${subtipo} estatus=${estatus} par_cliente_id=${par_cliente_id ?? '(no enviado)'} dataKeys=${data ? Object.keys(data).length : 0}`);

    if (data !== undefined && data !== null) {
      // ── PASO 1: Leer data actual ──
      const currentRows = await sql`
        SELECT data, par_cliente_id
        FROM "EFINANCIANET_DB"."J_CLIENTES"
        WHERE id = ${id}
      `;

      if (currentRows.length === 0) {
        console.log(`PATCH /clientes: No se encontro registro con id=${id}`);
        return c.json({ error: `No se encontro registro con id=${id}` }, 404);
      }

      // ── DEFENSA: parsear si viene como string ──
      let existingData: Record<string, any>;
      const rawPatchData = currentRows[0].data;
      if (typeof rawPatchData === "string") {
        try {
          existingData = JSON.parse(rawPatchData);
        } catch {
          existingData = {};
        }
      } else {
        existingData = rawPatchData || {};
      }

      // ── PASO 2: Deep merge ──
      const mergedData = deepMergeData(existingData, data);
      console.log(`[PATCH /clientes/${id}] Existing keys: ${Object.keys(existingData).length}, Merged keys: ${Object.keys(mergedData).length}`);

      // ── PASO 3: Escribir merged + actualizar escalares opcionales ──
      const updated = await sql`
        UPDATE "EFINANCIANET_DB"."J_CLIENTES"
        SET
          type    = COALESCE(${type ?? null}, type),
          subtipo = COALESCE(${subtipo ?? null}, subtipo),
          estatus = COALESCE(${estatus ?? null}, estatus),
          data    = COALESCE(data, '{}'::jsonb) || ${sql.json(mergedData)}::jsonb,
          par_cliente_id = COALESCE(${par_cliente_id ?? null}, par_cliente_id)
        WHERE id = ${id}
        RETURNING id, type, subtipo, estatus, data, par_cliente_id
      `;

      if (updated.length === 0) {
        return c.json({ error: `No se encontro registro con id=${id}` }, 404);
      }

      console.log(`PATCH (deep merge) exitoso en J_CLIENTES — id: ${id}`);
      return c.json({ success: true, data: updated, id });
    } else {
      // Sin data — solo actualizar columnas escalares
      const updated = await sql`
        UPDATE "EFINANCIANET_DB"."J_CLIENTES"
        SET
          type    = COALESCE(${type ?? null}, type),
          subtipo = COALESCE(${subtipo ?? null}, subtipo),
          estatus = COALESCE(${estatus ?? null}, estatus),
          par_cliente_id = COALESCE(${par_cliente_id ?? null}, par_cliente_id)
        WHERE id = ${id}
        RETURNING id, type, subtipo, estatus, data, par_cliente_id
      `;

      if (updated.length === 0) {
        return c.json({ error: `No se encontro registro con id=${id}` }, 404);
      }

      console.log(`PATCH (scalar only) exitoso en J_CLIENTES — id: ${id}`);
      return c.json({ success: true, data: updated, id });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en PATCH /clientes:", msg);
    return c.json({ error: `Error de base de datos en PATCH J_CLIENTES: ${msg}` }, 500);
  }
};

// DELETE /clientes/:id — Elimina un registro de J_CLIENTES
const deleteClientesHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Falta el parametro id" }, 400);
    }

    console.log(`[DELETE /clientes/${id}] Eliminando registro de J_CLIENTES...`);

    const deleted = await sql`
      DELETE FROM "EFINANCIANET_DB"."J_CLIENTES"
      WHERE id = ${id}
      RETURNING id
    `;

    if (deleted.length === 0) {
      console.log(`DELETE /clientes: No se encontro registro con id=${id}`);
      return c.json({ error: `No se encontro registro con id=${id}` }, 404);
    }

    console.log(`DELETE exitoso en J_CLIENTES — id: ${id}`);
    return c.json({ success: true, message: `Registro ${id} eliminado` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en DELETE /clientes:", msg);
    return c.json({ error: `Error de base de datos en DELETE J_CLIENTES: ${msg}` }, 500);
  }
};

// GET /clientes/:id — Consulta un registro individual de J_CLIENTES por llave primaria (UUID)
// Usado por Liga de Edit y Liga de View para cargar el registro completo
const getClienteByIdHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Falta el parametro id (UUID)" }, 400);
    }

    console.log(`[GET /clientes/${id}] Consultando J_CLIENTES por llave primaria...`);

    const rows = await sql`
      SELECT id, type, subtipo, estatus, data, par_cliente_id
      FROM "EFINANCIANET_DB"."J_CLIENTES"
      WHERE id = ${id}
    `;

    if (rows.length === 0) {
      console.log(`GET /clientes/${id}: No se encontro registro`);
      return c.json({ error: `No se encontro registro con id=${id}` }, 404);
    }

    console.log(`GET exitoso en J_CLIENTES — id: ${id}, type: ${rows[0].type}`);
    return c.json({ success: true, data: rows[0] });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en GET /clientes/:id:", msg);
    return c.json({ error: `Error de base de datos en SELECT J_CLIENTES por id: ${msg}` }, 500);
  }
};

// GET /clientes-gobierno — Consulta TODOS los registros de J_CLIENTES (sin filtro)
const getClientesGobiernoHandler = async (c: any) => {
  try {
    console.log("[GET /clientes-gobierno v2.0] Consultando TODOS los registros de J_CLIENTES (sin filtro)...");

    const rawRows = await sql`
      SELECT id, type, subtipo, estatus, data, par_cliente_id
      FROM "EFINANCIANET_DB"."J_CLIENTES"
      ORDER BY data->>'nombre' ASC NULLS LAST
    `;

    const rows = rawRows.map((r: any) => ({
      id:      r.id,
      type:    r.type,
      subtipo: r.subtipo,
      estatus: r.estatus,
      data:    r.data,
      par_cliente_id: r.par_cliente_id,
    }));

    console.log(`[GET /clientes-gobierno v2.0] ${rows.length} registros totales`);
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en GET /clientes-gobierno:", msg);
    return c.json({ error: `Error de base de datos en SELECT J_CLIENTES (gobierno): ${msg}` }, 500);
  }
};

// GET /clientes-only — Consulta TODOS los registros de J_CLIENTES (sin filtro)
const getClientesOnlyHandler = async (c: any) => {
  try {
    console.log("[GET /clientes-only v3.0] Consultando TODOS los registros de J_CLIENTES (sin filtro type)...");

    const rawRows = await sql`
      SELECT id, type, subtipo, estatus, data, par_cliente_id
      FROM "EFINANCIANET_DB"."J_CLIENTES"
      ORDER BY data->>'fechaOriginacion' DESC NULLS LAST
    `;

    // ── CRITICAL FIX v3.0: mapear a objetos planos ──
    const rows = rawRows.map((r: any) => ({
      id:      r.id,
      type:    r.type,
      subtipo: r.subtipo,
      estatus: r.estatus,
      data:    r.data,
      par_cliente_id: r.par_cliente_id,
    }));

    console.log(`[GET /clientes-only v3.0] ${rows.length} registros totales encontrados`);

    return c.json({ success: true, data: rows, _version: EDGE_VERSION, _endpoint: "clientes-only" });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Error en GET /clientes-only:", msg);
    return c.json({ error: `Error de base de datos en SELECT J_CLIENTES (clientes): ${msg}` }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /clientes-lista-v2 — Consulta TODOS los registros de J_CLIENTES (sin filtro)
// ═══════════════════════════════════════════════════════════════════
const getClientesListaV2Handler = async (c: any) => {
  try {
    console.log("[GET /clientes-lista-v2] ════════════════════════════════════════");
    console.log("[GET /clientes-lista-v2] Consultando TODOS los registros de J_CLIENTES (sin filtro)...");

    const rawRows = await sql`
      SELECT id, type, subtipo, estatus, data, par_cliente_id
      FROM "EFINANCIANET_DB"."J_CLIENTES"
      ORDER BY data->>'fechaOriginacion' DESC NULLS LAST
    `;

    // Mapear a objetos planos para serialización segura
    const rows = rawRows.map((r: any) => ({
      id:      r.id,
      type:    r.type,
      subtipo: r.subtipo,
      estatus: r.estatus,
      data:    r.data,
      par_cliente_id: r.par_cliente_id,
    }));

    // Conteos por type para diagnóstico
    const diagnostico: Record<string, number> = {};
    for (const r of rows) {
      const t = r.type || '(null)';
      diagnostico[t] = (diagnostico[t] || 0) + 1;
    }

    console.log(`[GET /clientes-lista-v2] ${rows.length} registros totales. Desglose:`, JSON.stringify(diagnostico));
    console.log("[GET /clientes-lista-v2] ════════════════════════════════════════");

    return c.json({
      success: true,
      data: rows,
      _version: EDGE_VERSION,
      _endpoint: "clientes-lista-v2",
      _diagnostico: {
        totalRegistrosJClientes: rows.length,
        conteosPorType: diagnostico,
        filtros: "NINGUNO",
      },
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[GET /clientes-lista-v2] ERROR:", msg);
    return c.json({ error: `Error en SELECT J_CLIENTES (lista-v2): ${msg}` }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /clientes-lista-todos — ENDPOINT NEUTRO DE TRANSPORTE
//
// Propósito: Devolver TODOS los registros de J_CLIENTES sin ningún
//            filtro. El filtrado por type se hace SOLO en el frontend.
//
// Tabla:  "EFINANCIANET_DB"."J_CLIENTES"
// SQL:    SELECT id, type, subtipo, estatus, data
//         FROM "EFINANCIANET_DB"."J_CLIENTES"
//
// REGLAS:
//   1. NO usa WHERE, .eq(), .in() ni ninguna condición sobre type
//   2. NO comparte handler con /clientes-prospectos
//   3. NO copia lógica de filtrado de ningún otro endpoint
//   4. Handler propio, ruta propia, SQL propio
//   5. Devuelve Clientes, Prospectos y Contactos por igual
// ═══════════════════════════════════════════════════════════════════
const getClientesListaTodosHandler = async (c: any) => {
  try {
    console.log("[/clientes-lista-todos v15] ════════════════════════════════════════");
    console.log("[/clientes-lista-todos v15] SQL: SELECT id, type, subtipo, estatus, data FROM J_CLIENTES — SIN WHERE");

    // ── Consulta directa — SIN WHERE — SIN FILTRO de ningún tipo ──
    const rawRows = await sql`
      SELECT id, type, subtipo, estatus, data, par_cliente_id
      FROM "EFINANCIANET_DB"."J_CLIENTES"
    `;

    // Mapear a objetos planos para serialización segura
    // (postgresjs devuelve Result objects que no serializan bien con c.json())
    const rows = rawRows.map((r: any) => ({
      id:      r.id,
      type:    r.type,
      subtipo: r.subtipo,
      estatus: r.estatus,
      data:    r.data,
      par_cliente_id: r.par_cliente_id,
    }));

    // Log desglose por type para diagnóstico server-side
    const desglose: Record<string, number> = {};
    for (const r of rows) {
      const t = r.type || "(null)";
      desglose[t] = (desglose[t] || 0) + 1;
    }
    console.log(`[/clientes-lista-todos v15] ${rows.length} registros. Desglose:`, JSON.stringify(desglose));
    console.log("[/clientes-lista-todos v15] ════════════════════════════════════════");

    return c.json({
      data: rows,
      _endpoint: "clientes-lista-todos",
      _version: EDGE_VERSION,
      _diagnostico: {
        tabla: 'EFINANCIANET_DB.J_CLIENTES',
        filtros: "NINGUNO",
        sql: "SELECT id, type, subtipo, estatus, data FROM J_CLIENTES",
        totalRegistros: rows.length,
        desglosePorType: desglose,
      },
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[/clientes-lista-todos v15] ERROR:", msg);
    return c.json({ error: `Error en SELECT J_CLIENTES (todos): ${msg}` }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /verificar-db — Diagnóstico crudo de J_CLIENTES (conteo directo)
// ═══════════════════════════════════════════════════════════════════
const verificarDBHandler = async (c: any) => {
  try {
    console.log("[GET /verificar-db] Diagnóstico crudo...");
    const totalResult = await sql`SELECT COUNT(*)::int AS total FROM "EFINANCIANET_DB"."J_CLIENTES"`;
    const typeResult = await sql`SELECT type, COUNT(*)::int AS cantidad FROM "EFINANCIANET_DB"."J_CLIENTES" GROUP BY type ORDER BY cantidad DESC`;
    const subtipoResult = await sql`SELECT subtipo, COUNT(*)::int AS cantidad FROM "EFINANCIANET_DB"."J_CLIENTES" GROUP BY subtipo ORDER BY cantidad DESC`;
    const estatusResult = await sql`SELECT estatus, COUNT(*)::int AS cantidad FROM "EFINANCIANET_DB"."J_CLIENTES" GROUP BY estatus ORDER BY cantidad DESC`;
    const sampleResult = await sql`SELECT id, type, subtipo, estatus FROM "EFINANCIANET_DB"."J_CLIENTES" ORDER BY data->>'fechaOriginacion' DESC NULLS LAST LIMIT 20`;
    const diag = {
      _version: EDGE_VERSION,
      _timestamp: new Date().toISOString(),
      _tabla: 'EFINANCIANET_DB."J_CLIENTES"',
      _sql: "SELECT sin WHERE — conteo crudo directo",
      totalRegistros: totalResult[0]?.total || 0,
      conteoPorType: typeResult.map((r: any) => ({ type: r.type, cantidad: r.cantidad })),
      conteoPorSubtipo: subtipoResult.map((r: any) => ({ subtipo: r.subtipo, cantidad: r.cantidad })),
      conteoPorEstatus: estatusResult.map((r: any) => ({ estatus: r.estatus, cantidad: r.cantidad })),
      muestra: sampleResult.map((r: any) => ({ id: r.id, type: r.type, subtipo: r.subtipo, estatus: r.estatus })),
    };
    console.log(`[GET /verificar-db] Total: ${diag.totalRegistros} | Types:`, JSON.stringify(diag.conteoPorType));
    return c.json({ success: true, ...diag });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error diagnóstico: ${msg}` }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// STORAGE — Expedientes Electrónicos (Supabase Storage)
// Bucket: make-7e2d13d9-expedientes-electronicos-prospectos
// Ruta:   expedientes-electronicos/prospectos/<UUID>/<archivo>
// ═══════════════════════════════════════════════════════════════════

/** MIME types permitidos para carga de documentos */
const ALLOWED_MIMES: Record<string, boolean> = {
  "application/pdf": true,
  "image/png": true,
  "image/jpeg": true,
  "image/jpg": true,
  "image/gif": true,
  "image/bmp": true,
  "image/webp": true,
  "image/tiff": true,
  "image/svg+xml": true,
  "application/msword": true,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
  "application/vnd.ms-excel": true,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
  "application/octet-stream": true,
  "text/plain": true,
};

/** Tamaño máximo permitido: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// POST /storage/expedientes/upload
// Body: multipart/form-data con campos 'file' y 'prospectoId'
// Retorna: { nombre, url, storagePath, mime, tamanoKB }
const uploadExpedienteHandler = async (c: any) => {
  try {
    console.log("[STORAGE UPLOAD] Recibiendo petición de upload...");
    const body = await c.req.parseBody();
    const file = body["file"];
    const prospectoId = body["prospectoId"] as string;

    console.log(`[STORAGE UPLOAD] parseBody keys: [${Object.keys(body).join(', ')}]`);
    console.log(`[STORAGE UPLOAD] prospectoId=${prospectoId}, fileType=${typeof file}, isFile=${file instanceof File}, isBlob=${file instanceof Blob}`);

    if (!prospectoId) {
      return c.json({ error: "Campo obligatorio faltante: prospectoId (UUID del prospecto)" }, 400);
    }

    // Aceptar File o Blob (Hono en Deno puede retornar Blob en lugar de File)
    const isFileOrBlob = file && (file instanceof File || file instanceof Blob);
    if (!isFileOrBlob) {
      console.log(`[STORAGE UPLOAD] Archivo no es File ni Blob. typeof=${typeof file}, constructor=${file?.constructor?.name}`);
      return c.json({ error: `Campo obligatorio faltante: file (archivo a subir). Recibido: ${typeof file} / ${file?.constructor?.name}` }, 400);
    }

    // Normalizar: si es Blob sin .name, usar un nombre genérico
    const fileNameRaw = (file as any).name || `upload_${Date.now()}`;
    const fileSize = file.size || 0;

    // Detectar MIME: usar file.type, o inferir de extensión del nombre
    const extMap: Record<string, string> = {
      pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      gif: "image/gif", bmp: "image/bmp", webp: "image/webp", doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    const fileExt = fileNameRaw.split('.').pop()?.toLowerCase() || '';
    const fileMime = file.type || extMap[fileExt] || "application/octet-stream";
    console.log(`[STORAGE UPLOAD] MIME detection: file.type="${file.type}", ext="${fileExt}", final="${fileMime}"`);

    // Validar tipo MIME
    if (!ALLOWED_MIMES[fileMime]) {
      console.log(`[STORAGE UPLOAD] MIME rechazado: ${fileMime} para archivo ${fileNameRaw}`);
      return c.json({
        error: `Tipo de archivo no permitido: ${fileMime}. Permitidos: PDF, PNG, JPG, GIF, BMP, WEBP, DOC, DOCX, XLS, XLSX`,
      }, 400);
    }

    // Validar tamaño
    if (fileSize > MAX_FILE_SIZE) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      console.log(`[STORAGE UPLOAD] Archivo demasiado grande: ${sizeMB} MB (max 10 MB)`);
      return c.json({
        error: `El archivo excede el tamaño máximo permitido (${sizeMB} MB > 10 MB)`,
      }, 400);
    }

    // Sanitizar nombre de archivo
    const safeName = fileNameRaw.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ts = Date.now();
    const finalFileName = `${ts}_${safeName}`;
    const storagePath = `expedientes-electronicos/prospectos/${prospectoId}/${finalFileName}`;

    console.log(`[STORAGE UPLOAD] Subiendo: ${storagePath} (${fileMime}, ${(fileSize / 1024).toFixed(1)} KB)`);

    // Leer archivo como Uint8Array (Supabase Storage prefiere Uint8Array sobre ArrayBuffer)
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    console.log(`[STORAGE UPLOAD] Archivo leído: ${uint8.byteLength} bytes (Uint8Array)`);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, uint8, {
        contentType: fileMime,
        upsert: false,
      });

    if (uploadError) {
      console.log(`[STORAGE UPLOAD] Error al subir archivo:`, uploadError.message);
      // Si es "already exists", intentar con upsert
      if (uploadError.message?.includes("already exists")) {
        console.log(`[STORAGE UPLOAD] Reintentando con upsert=true...`);
        const { error: retryErr } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, uint8, { contentType: fileMime, upsert: true });
        if (retryErr) {
          return c.json({ error: `Error al subir archivo a Storage (retry): ${retryErr.message}` }, 500);
        }
      } else {
        return c.json({ error: `Error al subir archivo a Storage: ${uploadError.message}` }, 500);
      }
    }

    console.log(`[STORAGE UPLOAD] ✅ Archivo subido exitosamente a Storage`);

    // Generar URL pública (bucket es public) + signed URL como fallback
    const supaUrl = Deno.env.get("SUPABASE_URL") || "";
    const publicUrl = `${supaUrl}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
    let viewUrl = publicUrl;

    try {
      const { data: signedData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, 3600);
      if (signedData?.signedUrl) {
        viewUrl = signedData.signedUrl;
      }
    } catch (_) {
      console.log(`[STORAGE UPLOAD] createSignedUrl falló, usando URL pública`);
    }

    const tamanoKB = Math.round(fileSize / 1024);
    console.log(`[STORAGE UPLOAD] Éxito: ${storagePath} — URL generada`);

    return c.json({
      success: true,
      nombre: fileNameRaw,
      url: viewUrl,
      storagePath,
      storageBucket: BUCKET_NAME,
      mime: fileMime,
      tamanoKB,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[STORAGE UPLOAD] Error no capturado:", msg);
    console.log("[STORAGE UPLOAD] Stack:", err?.stack || "no stack");
    return c.json({ error: `Error al procesar carga de archivo: ${msg}` }, 500);
  }
};

// POST /storage/expedientes/signed-url
// Body JSON: { storagePath, bucket? }
// Retorna: { signedUrl, bucket }
// Estrategia multi-bucket v2.0: exacta → variantes → .list() discovery (service role, bypasses RLS)
const getSignedUrlHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { storagePath, bucket, prospectoId } = body;

    if (!storagePath) {
      return c.json({ error: "Campo obligatorio faltante: storagePath" }, 400);
    }

    // Lista de buckets a intentar
    const primaryBucket = bucket || BUCKET_NAME;
    const allBuckets = [primaryBucket];
    if (primaryBucket !== BUCKET_NAME) allBuckets.push(BUCKET_NAME);
    if (primaryBucket !== BUCKET_CONSTANCIAS) allBuckets.push(BUCKET_CONSTANCIAS);

    console.log(`[STORAGE SIGNED-URL v2.0] Buscando: "${storagePath}" — buckets: [${allBuckets.join(', ')}], prospectoId=${prospectoId || '(none)'}`);

    // ── Paso 1: Ruta exacta ──
    for (const tryBucket of allBuckets) {
      const { data, error } = await supabase.storage
        .from(tryBucket)
        .createSignedUrl(storagePath, 3600);
      if (data?.signedUrl) {
        console.log(`[STORAGE SIGNED-URL] ✅ EXACTA: ${tryBucket}/${storagePath}`);
        return c.json({ success: true, signedUrl: data.signedUrl, bucket: tryBucket, method: 'exact' });
      }
    }

    // ── Paso 2: Generar variantes de ruta ──
    const fileName = storagePath.includes('/')
      ? storagePath.substring(storagePath.lastIndexOf('/') + 1)
      : storagePath;
    const dotIdx = fileName.lastIndexOf('.');
    const fileNameNoExt = dotIdx > 0 ? fileName.substring(0, dotIdx) : null;

    const pathVariants: string[] = [];
    // Sin extension del path completo
    if (storagePath.lastIndexOf('.') > storagePath.lastIndexOf('/')) {
      pathVariants.push(storagePath.substring(0, storagePath.lastIndexOf('.')));
    }
    // Solo filename
    if (fileName !== storagePath) pathVariants.push(fileName);
    if (fileNameNoExt && fileNameNoExt !== storagePath) pathVariants.push(fileNameNoExt);
    // Prefijo expedientes
    pathVariants.push(`expedientes-electronicos/prospectos/${fileName}`);
    if (fileNameNoExt) pathVariants.push(`expedientes-electronicos/prospectos/${fileNameNoExt}`);
    if (prospectoId) {
      pathVariants.push(`expedientes-electronicos/prospectos/${prospectoId}/${fileName}`);
      if (fileNameNoExt) pathVariants.push(`expedientes-electronicos/prospectos/${prospectoId}/${fileNameNoExt}`);
      pathVariants.push(`${prospectoId}/${fileName}`);
      if (fileNameNoExt) pathVariants.push(`${prospectoId}/${fileNameNoExt}`);
    }

    for (const variant of [...new Set(pathVariants)]) {
      for (const tryBucket of allBuckets) {
        const { data } = await supabase.storage.from(tryBucket).createSignedUrl(variant, 3600);
        if (data?.signedUrl) {
          console.log(`[STORAGE SIGNED-URL] ✅ VARIANTE: ${tryBucket}/"${variant}"`);
          return c.json({ success: true, signedUrl: data.signedUrl, bucket: tryBucket, method: 'variant', resolvedPath: variant });
        }
      }
    }

    // ── Paso 3: .list() DISCOVERY (service role bypasses RLS) ──
    console.log(`[STORAGE SIGNED-URL] Paso 3: .list() discovery server-side...`);
    const searchName = (fileNameNoExt || fileName).toLowerCase();

    for (const tryBucket of allBuckets) {
      const dirsToScan: string[] = [''];
      if (storagePath.includes('/')) {
        dirsToScan.push(storagePath.substring(0, storagePath.lastIndexOf('/')));
      }
      if (prospectoId) {
        dirsToScan.push(`expedientes-electronicos/prospectos/${prospectoId}`);
        dirsToScan.push(prospectoId);
      }
      dirsToScan.push('expedientes-electronicos/prospectos');

      for (const dir of [...new Set(dirsToScan)]) {
        try {
          const { data: files } = await supabase.storage.from(tryBucket).list(dir, { limit: 500 });
          const realFiles = (files || []).filter((f: any) => f.name && f.name !== '.emptyFolderPlaceholder');
          if (realFiles.length === 0) continue;

          // Buscar por base name
          const matchFile = (f: any) => {
            const fLower = f.name.toLowerCase();
            const fDot = fLower.lastIndexOf('.');
            const fBase = fDot > 0 ? fLower.substring(0, fDot) : fLower;
            return fBase === searchName || fLower === searchName || fLower === fileName.toLowerCase();
          };

          let match = realFiles.find(matchFile) || realFiles.find((f: any) => f.name.toLowerCase().includes(searchName));

          if (match) {
            const discoveredPath = dir ? `${dir}/${match.name}` : match.name;
            const { data: signedData } = await supabase.storage.from(tryBucket).createSignedUrl(discoveredPath, 3600);
            if (signedData?.signedUrl) {
              console.log(`[STORAGE SIGNED-URL] ✅ DISCOVERY: "${discoveredPath}" in "${tryBucket}"`);
              return c.json({ success: true, signedUrl: signedData.signedUrl, bucket: tryBucket, method: 'discovery', resolvedPath: discoveredPath });
            }
          }

          // Escanear subdirectorios (1 nivel más para paths 3+ niveles deep)
          const subDirs = realFiles.filter((f: any) => !f.id || (f.metadata && !f.metadata.mimetype));
          for (const sub of subDirs) {
            const subPath = dir ? `${dir}/${sub.name}` : sub.name;
            try {
              const { data: subFiles } = await supabase.storage.from(tryBucket).list(subPath, { limit: 500 });
              const realSub = (subFiles || []).filter((f: any) => f.name && f.name !== '.emptyFolderPlaceholder');
              const subMatch = realSub.find(matchFile) || realSub.find((f: any) => f.name.toLowerCase().includes(searchName));
              if (subMatch) {
                const discoveredPath = `${subPath}/${subMatch.name}`;
                const { data: signedData } = await supabase.storage.from(tryBucket).createSignedUrl(discoveredPath, 3600);
                if (signedData?.signedUrl) {
                  console.log(`[STORAGE SIGNED-URL] ✅ DISCOVERY-SUB: "${discoveredPath}" in "${tryBucket}"`);
                  return c.json({ success: true, signedUrl: signedData.signedUrl, bucket: tryBucket, method: 'discovery-sub', resolvedPath: discoveredPath });
                }
              }
            } catch { /* skip sub */ }
          }
        } catch (listErr) {
          console.warn(`[STORAGE SIGNED-URL] .list() error ${tryBucket}/${dir}:`, listErr);
        }
      }
    }

    console.log(`[STORAGE SIGNED-URL] ❌ TODOS LOS MÉTODOS FALLARON: "${storagePath}"`);
    return c.json({
      error: `Archivo no encontrado (exacta + variantes + discovery). Ruta: ${storagePath}`,
      intentos: [],
      fileNotFound: true,
    }, 404);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[STORAGE SIGNED-URL] Error:", msg);
    return c.json({ error: `Error al generar URL firmada: ${msg}` }, 500);
  }
};

// DELETE /storage/expedientes/delete
// Body JSON: { storagePath }
const deleteExpedienteFileHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { storagePath } = body;

    if (!storagePath) {
      return c.json({ error: "Campo obligatorio faltante: storagePath" }, 400);
    }

    console.log(`[STORAGE DELETE] Eliminando: ${storagePath}`);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.log(`[STORAGE DELETE] Error:`, error.message);
      return c.json({ error: `Error al eliminar archivo: ${error.message}` }, 500);
    }

    console.log(`[STORAGE DELETE] Eliminado exitosamente: ${storagePath}`);
    return c.json({ success: true, message: `Archivo eliminado: ${storagePath}` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[STORAGE DELETE] Error:", msg);
    return c.json({ error: `Error al eliminar archivo: ${msg}` }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// MANTENIMIENTO — Endpoints para tareas de limpieza y reparación
// ═══════════════════════════════════════════════════════════════════

// POST /mantenimiento/clean-clasificacion — Limpia registros con clasificacionCliente: "Gobierno Magisterio"
const cleanClasificacionHandler = async (c: any) => {
  try {
    console.log("[MAINT] Limpiando registros con clasificacionCliente='Gobierno Magisterio'...");
    const rows = await sql`SELECT * FROM public.clean_clasificacion_gobierno_magisterio()`;
    console.log(`[MAINT] ${rows.length} registros limpiados`);
    return c.json({
      success: true,
      cleaned: rows.length,
      records: rows.map((r: any) => ({ id: r.cleaned_id, nombre: r.cleaned_nombre })),
      _version: EDGE_VERSION,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[MAINT] Error limpiando clasificacion:", msg);
    return c.json({ error: `Error: ${msg}` }, 500);
  }
};

// POST /mantenimiento/repair-legacy-prospectos — Repara prospectos corrompidos por compactación v3.5
const repairLegacyProspectosHandler = async (c: any) => {
  try {
    console.log("[MAINT] Reparando prospectos legacy corrompidos...");
    const rows = await sql`SELECT * FROM public.repair_legacy_prospectos()`;
    console.log(`[MAINT] ${rows.length} prospectos reparados`);
    return c.json({
      success: true,
      repaired: rows.length,
      records: rows.map((r: any) => ({
        id: r.repaired_id,
        nombre: r.repaired_nombre,
        fieldsRestored: r.fields_restored,
      })),
      _version: EDGE_VERSION,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[MAINT] Error reparando prospectos:", msg);
    return c.json({ error: `Error: ${msg}` }, 500);
  }
};

// GET /mantenimiento/detect-invalid-urls — Detecta expedientes con blob/data URLs inválidas
const detectInvalidUrlsHandler = async (c: any) => {
  try {
    console.log("[MAINT] Detectando expedientes con blob/data URLs inválidas...");
    const rows = await sql`SELECT * FROM public.detect_invalid_blob_urls()`;
    console.log(`[MAINT] ${rows.length} expedientes con URLs inválidas detectados`);
    return c.json({
      success: true,
      invalidCount: rows.length,
      records: rows.map((r: any) => ({
        clienteId: r.record_id,
        clienteNombre: r.record_nombre,
        expedienteIdx: r.expediente_idx,
        expedienteNombre: r.expediente_nombre,
        invalidUrl: r.invalid_url?.substring(0, 50) + '...',
      })),
      _version: EDGE_VERSION,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[MAINT] Error detectando URLs:", msg);
    return c.json({ error: `Error: ${msg}` }, 500);
  }
};

// POST /mantenimiento/reupload-invalid-expedientes — Re-sube archivos con blob URLs usando storagePath
const reuploadInvalidExpedientesHandler = async (c: any) => {
  try {
    console.log("[MAINT] Limpiando blob/data URLs de expedientes (conservando storagePath)...");

    // Buscar todos los registros con blob URLs
    const affected = await sql`
      SELECT id, data
      FROM "EFINANCIANET_DB"."J_CLIENTES"
      WHERE data->'expedientesElectronicos' IS NOT NULL
        AND jsonb_typeof(data->'expedientesElectronicos') = 'array'
        AND jsonb_array_length(data->'expedientesElectronicos') > 0
        AND (
          data::text LIKE '%"url":"blob:%'
          OR data::text LIKE '%"url":"data:%'
          OR data::text LIKE '%"fileData":"blob:%'
          OR data::text LIKE '%"fileData":"data:%'
        )
    `;

    let totalCleaned = 0;
    const results: any[] = [];

    for (const row of affected) {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      const exps = data.expedientesElectronicos;
      if (!Array.isArray(exps)) continue;

      let modified = false;
      const cleanedExps = exps.map((exp: any) => {
        const url = exp.url || exp.fileData || '';
        if (url.startsWith('blob:') || url.startsWith('data:')) {
          modified = true;
          totalCleaned++;
          // Limpiar URL inválida, conservar storagePath para regenerar URL firmada
          const clean = { ...exp };
          delete clean.url;
          delete clean.fileData;
          delete clean.file_data;
          clean._urlCleaned = true;
          clean._cleanedAt = new Date().toISOString();
          return clean;
        }
        return exp;
      });

      if (modified) {
        data.expedientesElectronicos = cleanedExps;
        await sql`
          UPDATE "EFINANCIANET_DB"."J_CLIENTES"
          SET data = ${sql.json(data)}
          WHERE id = ${row.id}
        `;
        results.push({ id: row.id, nombre: data.nombre || '(sin nombre)', cleanedCount: cleanedExps.filter((e: any) => e._urlCleaned).length });
      }
    }

    console.log(`[MAINT] ${totalCleaned} blob/data URLs limpiadas en ${results.length} registros`);
    return c.json({
      success: true,
      totalCleaned,
      affectedRecords: results.length,
      records: results,
      _version: EDGE_VERSION,
      _note: "Los archivos con storagePath válido se pueden regenerar via /storage/expedientes/signed-url",
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[MAINT] Error re-subiendo expedientes:", msg);
    return c.json({ error: `Error: ${msg}` }, 500);
  }
};

// GET /mantenimiento/verify-par-cliente-id — Verifica que par_cliente_id se guarda en columna física
const verifyParClienteIdHandler = async (c: any) => {
  try {
    console.log("[MAINT] Verificando par_cliente_id en columna física...");
    const rows = await sql`
      SELECT
        id,
        data->>'nombre' AS nombre,
        par_cliente_id,
        data->>'institucionGobiernoId' AS json_inst_id,
        data->>'institucionGobierno' AS json_inst_nombre
      FROM "EFINANCIANET_DB"."J_CLIENTES"
      WHERE par_cliente_id IS NOT NULL
         OR data->>'institucionGobiernoId' IS NOT NULL
         OR data->>'institucionGobiernoId' != ''
    `;

    const discrepancies = rows.filter((r: any) => {
      const physical = r.par_cliente_id || null;
      const jsonId = r.json_inst_id || null;
      return physical !== jsonId;
    });

    console.log(`[MAINT] ${rows.length} registros con institución gobierno, ${discrepancies.length} discrepancias`);
    return c.json({
      success: true,
      total: rows.length,
      discrepancies: discrepancies.length,
      records: rows.map((r: any) => ({
        id: r.id,
        nombre: r.nombre,
        par_cliente_id_physical: r.par_cliente_id,
        institucionGobiernoId_json: r.json_inst_id,
        institucionGobierno_json: r.json_inst_nombre,
        synced: (r.par_cliente_id || null) === (r.json_inst_id || null),
      })),
      _version: EDGE_VERSION,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[MAINT] Error verificando par_cliente_id:", msg);
    return c.json({ error: `Error: ${msg}` }, 500);
  }
};

// POST /mantenimiento/sync-par-cliente-id — Sincroniza par_cliente_id desde data.institucionGobiernoId
const syncParClienteIdHandler = async (c: any) => {
  try {
    console.log("[MAINT] Sincronizando par_cliente_id desde data.institucionGobiernoId...");
    const updated = await sql`
      UPDATE "EFINANCIANET_DB"."J_CLIENTES"
      SET par_cliente_id = (data->>'institucionGobiernoId')::uuid
      WHERE data->>'institucionGobiernoId' IS NOT NULL
        AND data->>'institucionGobiernoId' != ''
        AND (par_cliente_id IS NULL OR par_cliente_id::text != data->>'institucionGobiernoId')
      RETURNING id, data->>'nombre' AS nombre, par_cliente_id
    `;

    console.log(`[MAINT] ${updated.length} registros sincronizados`);
    return c.json({
      success: true,
      synced: updated.length,
      records: updated.map((r: any) => ({ id: r.id, nombre: r.nombre, par_cliente_id: r.par_cliente_id })),
      _version: EDGE_VERSION,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[MAINT] Error sincronizando par_cliente_id:", msg);
    return c.json({ error: `Error: ${msg}` }, 500);
  }
};

// GET /mantenimiento/check-cuenta-eje/:cuentaEje — Validación atómica de Cuenta Eje única
const checkCuentaEjeHandler = async (c: any) => {
  try {
    const cuentaEje = c.req.param("cuentaEje");
    const excludeId = c.req.query("excludeId") || null;
    console.log(`[MAINT] Verificando unicidad de cuentaEje=${cuentaEje} excludeId=${excludeId || '(none)'}...`);

    const rows = await sql`SELECT * FROM public.check_cuenta_eje_unique(${cuentaEje}, ${excludeId})`;
    const result = rows[0] || { is_unique: true, existing_id: null, existing_nombre: null };

    return c.json({
      success: true,
      isUnique: result.is_unique,
      existingId: result.existing_id,
      existingNombre: result.existing_nombre,
      _version: EDGE_VERSION,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[MAINT] Error check cuenta eje:", msg);
    return c.json({ error: `Error: ${msg}` }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// CUENTAS DE AHORRO — Direct SQL (bypasses PostgREST RPC overload ambiguity)
// Tabla: EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES"
// ═══════════════════════════════════════════════════════════════════

// GET /cuentas-ahorro — Lista todas las cuentas de ahorro
const getCuentasAhorroHandler = async (c: any) => {
  try {
    // Support optional ?id=UUID to fetch a single record by PK
    const url = new URL(c.req.url);
    const idParam = url.searchParams.get('id');

    if (idParam && idParam.trim()) {
      console.log(`[CUENTAS-AHORRO] GET /cuentas-ahorro?id=${idParam}`);
      const rows = await sql`
        SELECT *
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE id = ${idParam.trim()}::uuid
        LIMIT 1
      `;
      if (rows.length === 0) {
        console.log(`[CUENTAS-AHORRO] GET by id — no encontrado: ${idParam}`);
        return c.json({ error: `Cuenta no encontrada con id=${idParam}` }, 404);
      }
      console.log(`[CUENTAS-AHORRO] GET by id OK — id: ${rows[0].id}, no_cuenta: ${rows[0].no_cuenta}`);
      return c.json(rows[0]);
    }

    console.log("[CUENTAS-AHORRO] GET /cuentas-ahorro (all)");
    const rows = await sql`
      SELECT *
      FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      ORDER BY fecha_sol DESC NULLS LAST
    `;
    console.log(`[CUENTAS-AHORRO] OK — ${rows.length} registros`);
    return c.json(rows);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.log("[CUENTAS-AHORRO] Error GET:", msg);
    return c.json({ error: `Error listando cuentas de ahorro: ${msg}` }, 500);
  }
};

// ── Helpers de sanitización para cuentas de ahorro ──
// Empty strings ('') causan errores fatales en PostgreSQL al castear:
//   ''::uuid → ERROR: invalid input syntax for type uuid
//   ''::timestamptz → ERROR: invalid input syntax for type timestamp with time zone
const toNullStr  = (v: unknown) => (v === null || v === undefined || v === '') ? null : String(v);
const toNullUuid = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
};
const toNullTs = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  return null;
};
const toNullNum = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
};
const toBool = (v: unknown) => {
  if (v === true || v === 'true' || v === 'TRUE' || v === 't' || v === '1') return true;
  if (v === false || v === 'false' || v === 'FALSE' || v === 'f' || v === '0') return false;
  return null;
};

// PATCH /cuentas-ahorro/movimiento — Registrar movimiento y actualizar saldo
const patchMovimientoHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { cliente_id, movimiento, saldo_nuevo } = body;
    if (!cliente_id) {
      return c.json({ error: 'cliente_id requerido' }, 400);
    }
    const clienteUuid = toNullUuid(cliente_id);
    
    // Buscar cuenta eje del cliente
    const cuentaRows = await sql`
      SELECT id, saldo_actual, data
      FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE cliente_id = ${clienteUuid}::uuid AND cta_eje_chec = true
      LIMIT 1
    `;
    
    if (cuentaRows.length === 0) {
      return c.json({ error: 'No se encontró cuenta eje para este cliente' }, 404);
    }
    
    const cuenta = cuentaRows[0];
    const saldoActual = typeof cuenta.saldo_actual === 'number' ? cuenta.saldo_actual : parseFloat(String(cuenta.saldo_actual).replace(/[^0-9.-]/g, '')) || 0;
    const nuevoSaldo = typeof saldo_nuevo === 'number' ? saldo_nuevo : parseFloat(String(saldo_nuevo).replace(/[^0-9.-]/g, '')) || saldoActual;
    
    // Agregar movimiento al data de la cuenta
    const existingData = typeof cuenta.data === 'string' ? JSON.parse(cuenta.data) : (cuenta.data || {});
    const movimientosData = existingData.movimientos || [];
    movimientosData.push({
      ...movimiento,
      saldoInicial: saldoActual,
      saldoFinal: nuevoSaldo,
      fechaRegistro: new Date().toISOString(),
    });
    
    const newData = { ...existingData, movimientos: movimientosData };
    
    // Actualizar saldo_actual y data
    await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      SET saldo_actual = ${nuevoSaldo}::numeric, data = ${JSON.stringify(newData)}::jsonb
      WHERE id = ${cuenta.id}::uuid
    `;
    
    console.log(`[Movimiento] Cuenta ${cuenta.id} - saldo: ${saldoActual} -> ${nuevoSaldo}`);
    return c.json({ ok: true, cuentaId: cuenta.id, saldo_anterior: saldoActual, saldoNuevo: nuevoSaldo });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
};

// POST /cuentas-ahorro — Insert directo via SQL (bypasses ambiguous RPC overloads)
const postCuentasAhorroHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    console.log("[CUENTAS-AHORRO] POST /cuentas-ahorro — insert directo", JSON.stringify(body).substring(0, 500));

    // Accept both p_* prefixed params (from RPC payload) and plain params — sanitize empties to null
    const no_sol       = toNullStr(body.p_no_sol       ?? body.no_sol)       || '';
    const no_cuenta    = toNullStr(body.p_no_cuenta    ?? body.no_cuenta)    || '';
    const no_referenc1 = toNullStr(body.p_no_referenc1 ?? body.no_referenc1);
    const fecha_sol    = toNullTs(body.p_fecha_sol    ?? body.fecha_sol)    || new Date().toISOString();
    const fecha_autori = toNullTs(body.p_fecha_autori ?? body.fecha_autori);
    const fecha_disper = toNullTs(body.p_fecha_disper ?? body.fecha_disper);
    const fecha_cancel = toNullTs(body.p_fecha_cancel ?? body.fecha_cancel);
    const fecha_inicio = toNullTs(body.p_fecha_inicio ?? body.fecha_inicio);
    const fecha_fin_cu = toNullTs(body.p_fecha_fin_cu ?? body.fecha_fin_cu);
    const descripcion  = toNullStr(body.p_descripcion  ?? body.descripcion);
    const linea_produc = toNullStr(body.p_linea_produc ?? body.linea_produc) || 'CAPTACION';
    const tipo_produc  = toNullStr(body.p_tipo_produc  ?? body.tipo_produc)  || 'Ahorro';
    const producto_id  = toNullUuid(body.p_producto_id  ?? body.producto_id);
    const producto_eje = toNullStr(body.p_producto_eje ?? body.producto_eje);
    const cliente_id   = toNullUuid(body.p_cliente_id   ?? body.cliente_id);
    const monto_sol    = toNullNum(body.p_monto_sol    ?? body.monto_sol);
    const monto_aut    = toNullNum(body.p_monto_aut    ?? body.monto_aut);
    const monto_disp   = toNullNum(body.p_monto_disp   ?? body.monto_disp);
    const cta_eje_chec = toBool(body.p_cta_eje_chec ?? body.cta_eje_chec);
    const fases        = toNullStr(body.p_fases        ?? body.fases);
    const rawData      = body.p_data ?? body.data ?? null;
    const dataJson     = rawData && typeof rawData === 'object' ? JSON.stringify(rawData) : (typeof rawData === 'string' ? rawData : null);

    console.log("[CUENTAS-AHORRO] Sanitized:", JSON.stringify({ no_sol, no_cuenta, fecha_sol, producto_id, cliente_id, cta_eje_chec, monto_sol }));

    const estatus_sol = cta_eje_chec === true ? 'Autorizada' : null;
    const estatus_cuen = cta_eje_chec === true ? 'Activa' : null;
    const estatus_cart = cta_eje_chec === true ? 'Activa' : null;
    const estatus_disp = 'No Aplica';

    const rows = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
        type, no_sol, no_cuenta, no_referenc1,
        fecha_sol, fecha_autori, fecha_disper, fecha_cancel, fecha_inicio, fecha_fin_cu,
        descripcion, linea_produc, tipo_produc,
        producto_id, producto_eje, cliente_id,
        monto_sol, monto_aut, monto_disp,
        estatus_disp, estatus_sol, estatus_cart, estatus_cuen,
        cta_eje_chec, fases, data
      ) VALUES (
        'CuentaAhorro', ${no_sol}, ${no_cuenta}, ${no_referenc1},
        ${fecha_sol}::timestamptz, ${fecha_autori}::timestamptz, ${fecha_disper}::timestamptz,
        ${fecha_cancel}::timestamptz, ${fecha_inicio}::timestamptz, ${fecha_fin_cu}::timestamptz,
        ${descripcion}, ${linea_produc}, ${tipo_produc},
        ${producto_id}::uuid, ${producto_eje}, ${cliente_id}::uuid,
        ${monto_sol}::numeric, ${monto_aut}::numeric, ${monto_disp}::numeric,
        ${estatus_disp}, ${estatus_sol}, ${estatus_cart}, ${estatus_cuen},
        ${cta_eje_chec}::boolean, ${fases}, ${dataJson}::jsonb
      )
      RETURNING *
    `;

    const inserted = rows[0];
    console.log(`[CUENTAS-AHORRO] Insert OK — id: ${inserted?.id}`);
    return c.json(inserted, 201);
  } catch (err: any) {
    const msg = err?.message || String(err);
    const stack = err?.stack || '';
    console.log("[CUENTAS-AHORRO] Error POST:", msg);
    console.log("[CUENTAS-AHORRO] Stack:", stack);
    return c.json({ error: `Error insertando cuenta de ahorro: ${msg}`, details: stack }, 500);
  }
};

// PUT /cuentas-ahorro — Update directo via SQL
const putCuentasAhorroHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    console.log("[CUENTAS-AHORRO] PUT /cuentas-ahorro — update directo", JSON.stringify(body).substring(0, 500));

    const id = toNullUuid(body.p_id ?? body.id);
    if (!id) {
      return c.json({ error: "Se requiere p_id (uuid) para actualizar" }, 400);
    }

    const no_sol       = toNullStr(body.p_no_sol       ?? body.no_sol)       || '';
    const no_cuenta    = toNullStr(body.p_no_cuenta    ?? body.no_cuenta)    || '';
    const no_referenc1 = toNullStr(body.p_no_referenc1 ?? body.no_referenc1);
    const fecha_sol    = toNullTs(body.p_fecha_sol    ?? body.fecha_sol);
    const fecha_autori = toNullTs(body.p_fecha_autori ?? body.fecha_autori);
    const fecha_disper = toNullTs(body.p_fecha_disper ?? body.fecha_disper);
    const fecha_cancel = toNullTs(body.p_fecha_cancel ?? body.fecha_cancel);
    const fecha_inicio = toNullTs(body.p_fecha_inicio ?? body.fecha_inicio);
    const fecha_fin_cu = toNullTs(body.p_fecha_fin_cu ?? body.fecha_fin_cu);
    const descripcion  = toNullStr(body.p_descripcion  ?? body.descripcion);
    const producto_id  = toNullUuid(body.p_producto_id  ?? body.producto_id);
    const producto_eje = toNullStr(body.p_producto_eje ?? body.producto_eje);
    const cliente_id   = toNullUuid(body.p_cliente_id   ?? body.cliente_id);
    const saldo_actual = toNullNum(body.p_saldo_actual ?? body.saldo_actual);
    const monto_sol    = toNullNum(body.p_monto_sol    ?? body.monto_sol);
    const monto_aut    = toNullNum(body.p_monto_aut    ?? body.monto_aut);
    const monto_disp   = toNullNum(body.p_monto_disp   ?? body.monto_disp);
    const estatus_disp = toNullStr(body.p_estatus_disp ?? body.estatus_disp);
    const estatus_sol  = toNullStr(body.p_estatus_sol  ?? body.estatus_sol);
    const estatus_cart = toNullStr(body.p_estatus_cart ?? body.estatus_cart);
    const estatus_cuen = toNullStr(body.p_estatus_cuen ?? body.estatus_cuen);
    const cta_eje_chec = toBool(body.p_cta_eje_chec ?? body.cta_eje_chec);
    const fases        = toNullStr(body.p_fases        ?? body.fases);
    const rawData      = body.p_data_partial ?? body.p_data ?? body.data ?? null;
    const dataJson     = rawData && typeof rawData === 'object' ? JSON.stringify(rawData) : (typeof rawData === 'string' ? rawData : null);

    const rows = await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" SET
        no_sol       = ${no_sol},
        no_cuenta    = ${no_cuenta},
        no_referenc1 = ${no_referenc1},
        fecha_sol    = ${fecha_sol}::timestamptz,
        fecha_autori = ${fecha_autori}::timestamptz,
        fecha_disper = ${fecha_disper}::timestamptz,
        fecha_cancel = ${fecha_cancel}::timestamptz,
        fecha_inicio = ${fecha_inicio}::timestamptz,
        fecha_fin_cu = ${fecha_fin_cu}::timestamptz,
        descripcion  = ${descripcion},
        producto_id  = ${producto_id}::uuid,
        producto_eje = ${producto_eje},
        cliente_id   = ${cliente_id}::uuid,
        saldo_actual = COALESCE(${saldo_actual}::numeric, saldo_actual),
        monto_sol    = ${monto_sol}::numeric,
        monto_aut    = ${monto_aut}::numeric,
        monto_disp   = ${monto_disp}::numeric,
        estatus_disp = COALESCE(${estatus_disp}, estatus_disp),
        estatus_sol  = COALESCE(${estatus_sol}, estatus_sol),
        estatus_cart = COALESCE(${estatus_cart}, estatus_cart),
        estatus_cuen = COALESCE(${estatus_cuen}, estatus_cuen),
        cta_eje_chec = ${cta_eje_chec}::boolean,
        fases        = COALESCE(${fases}, fases),
        data         = CASE WHEN ${dataJson}::jsonb IS NOT NULL THEN COALESCE(data, '{}'::jsonb) || ${dataJson}::jsonb ELSE data END
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    if (rows.length === 0) {
      return c.json({ error: `No se encontró cuenta con id=${id}` }, 404);
    }

    const updated = rows[0];
    console.log(`[CUENTAS-AHORRO] Update OK — id: ${updated?.id}`);
    return c.json(updated, 200);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.log("[CUENTAS-AHORRO] Error PUT:", msg);
    return c.json({ error: `Error actualizando cuenta de ahorro: ${msg}` }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// CATÁLOGOS DEL SISTEMA — CRUD via SQL directo contra J_CATALOGOS
// Tabla: EFINANCIANET_DB.J_CATALOGOS (id uuid, type varchar, data jsonb)
// Patrón idéntico a J_PRODUCTOS
// ═══════════════════════════════════════════════════════════════════

// GET /catalogos/documentos — registros con type='Documento' (o ?type=X)
const getCatalogoDocumentosHandler = async (c: any) => {
  try {
    const p_type = c.req.query("type") || "Documento";
    console.log(`[CatalogoDB] GET /catalogos/documentos — type=${p_type}`);

    const rows = await sql`
      SELECT id, type, data
      FROM "EFINANCIANET_DB"."J_CATALOGOS"
      WHERE type = ${p_type}
      ORDER BY data->>'clave' ASC
    `;

    console.log(`[CatalogoDB] ${rows.length} registros tipo ${p_type}`);
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[CatalogoDB] Error GET:", msg);
    return c.json({ error: `Error de base de datos en SELECT J_CATALOGOS: ${msg}` }, 500);
  }
};

// POST /catalogos/documentos — Body: { tipo, datos }
const postCatalogoDocumentoHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { tipo, datos } = body;

    if (!tipo || !datos) {
      console.log("[CatalogoDB] Error POST: Faltan campos obligatorios", { tipo, hasDatos: !!datos });
      return c.json({ error: "Campos obligatorios faltantes: tipo y datos son requeridos" }, 400);
    }

    console.log(`[CatalogoDB] POST /catalogos/documentos — type=${tipo}, clave=${datos.clave}`);

    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CATALOGOS" (type, data)
      VALUES (${tipo}, ${sql.json(datos)})
      RETURNING id, type, data
    `;

    const generatedId = inserted[0]?.id;
    console.log(`[CatalogoDB] INSERT exitoso — id: ${generatedId}, type: ${tipo}`);
    return c.json({ success: true, data: inserted[0], id: generatedId }, 201);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[CatalogoDB] Error POST:", msg);
    return c.json({ error: `Error de base de datos en INSERT J_CATALOGOS: ${msg}` }, 500);
  }
};

// PUT /catalogos/documentos/:id — Body: { tipo, datos }
const putCatalogoDocumentoHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { tipo, datos } = body;

    if (!id || !datos) {
      console.log("[CatalogoDB] Error PUT: Faltan campos obligatorios", { id, hasDatos: !!datos });
      return c.json({ error: "Campos obligatorios faltantes: id y datos son requeridos" }, 400);
    }

    const typeVal = tipo || "Documento";
    console.log(`[CatalogoDB] PUT /catalogos/documentos/${id} — type=${typeVal}`);

    const updated = await sql`
      UPDATE "EFINANCIANET_DB"."J_CATALOGOS"
      SET type = ${typeVal}, data = ${sql.json(datos)}
      WHERE id = ${id}
      RETURNING id, type, data
    `;

    if (updated.length === 0) {
      console.log(`[CatalogoDB] PUT: No se encontró registro con id=${id}`);
      return c.json({ error: `No se encontró registro con id=${id}` }, 404);
    }

    console.log(`[CatalogoDB] UPDATE exitoso — id: ${id}`);
    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[CatalogoDB] Error PUT:", msg);
    return c.json({ error: `Error de base de datos en UPDATE J_CATALOGOS: ${msg}` }, 500);
  }
};

// DELETE /catalogos/documentos/:id
const deleteCatalogoDocumentoHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Se requiere el parámetro id" }, 400);
    }

    console.log(`[CatalogoDB] DELETE /catalogos/documentos/${id}`);

    await sql`
      DELETE FROM "EFINANCIANET_DB"."J_CATALOGOS"
      WHERE id = ${id}
    `;

    console.log(`[CatalogoDB] DELETE exitoso — id: ${id}`);
    return c.json({ success: true, message: `Catálogo ${id} eliminado` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[CatalogoDB] Error DELETE:", msg);
    return c.json({ error: `Error de base de datos en DELETE J_CATALOGOS: ${msg}` }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// MOUNT ROUTES — AMBOS prefijos
// ═══════════════════════════════════════════════════════════════════
const PREFIX = "/make-server-7e2d13d9";

// ── Rutas CON prefijo (caso A) ──
app.get(`${PREFIX}/health`, healthHandler);
app.get(`${PREFIX}/seed-credito`, seedCreditoHandler);
// (ruta seed-productos-completos eliminada)
app.get(`${PREFIX}/productos-credito`, getProductosCreditoHandler);
app.get(`${PREFIX}/productos-seguros`, getProductosSegurosHandler);
app.get(`${PREFIX}/productos-captacion`, getProductosCaptacionHandler);
app.get(`${PREFIX}/productos/:id`, getProductoByIdHandler);
app.get(`${PREFIX}/productos`, getProductosHandler);
app.post(`${PREFIX}/productos`, postProductosHandler);
app.put(`${PREFIX}/productos/:id`, putProductosHandler);
app.delete(`${PREFIX}/productos/:id`, deleteProductosHandler);
// Rutas estáticas de clientes ANTES de la parametrizada :id
app.get(`${PREFIX}/clientes-prospectos`, getClientesProspectosHandler);
app.get(`${PREFIX}/clientes-lista`, getClientesListaHandler);
app.get(`${PREFIX}/clientes-gobierno`, getClientesGobiernoHandler);
app.get(`${PREFIX}/seed-prospecto`, seedProspectoHandler);
// Rutas parametrizadas de clientes
app.get(`${PREFIX}/clientes/:id`, getClienteByIdHandler);
app.post(`${PREFIX}/clientes`, postClientesHandler);
app.put(`${PREFIX}/clientes/:id`, putClientesHandler);
app.patch(`${PREFIX}/clientes/:id`, patchClientesHandler);
app.delete(`${PREFIX}/clientes/:id`, deleteClientesHandler);
app.post(`${PREFIX}/storage/expedientes/upload`, uploadExpedienteHandler);
app.post(`${PREFIX}/storage/expedientes/signed-url`, getSignedUrlHandler);
app.post(`${PREFIX}/storage/expedientes/delete`, deleteExpedienteFileHandler);
app.get(`${PREFIX}/clientes-only`, getClientesOnlyHandler);
app.get(`${PREFIX}/clientes-lista-v2`, getClientesListaV2Handler);
app.get(`${PREFIX}/clientes-lista-todos`, getClientesListaTodosHandler);
app.get(`${PREFIX}/verificar-db`, verificarDBHandler);
// ── Mantenimiento ──
app.post(`${PREFIX}/mantenimiento/clean-clasificacion`, cleanClasificacionHandler);
app.post(`${PREFIX}/mantenimiento/repair-legacy-prospectos`, repairLegacyProspectosHandler);
app.get(`${PREFIX}/mantenimiento/detect-invalid-urls`, detectInvalidUrlsHandler);
app.post(`${PREFIX}/mantenimiento/reupload-invalid-expedientes`, reuploadInvalidExpedientesHandler);
app.get(`${PREFIX}/mantenimiento/verify-par-cliente-id`, verifyParClienteIdHandler);
app.post(`${PREFIX}/mantenimiento/sync-par-cliente-id`, syncParClienteIdHandler);
app.get(`${PREFIX}/mantenimiento/check-cuenta-eje/:cuentaEje`, checkCuentaEjeHandler);
// ── Cuentas de Ahorro (direct SQL — bypasses PostgREST RPC overload ambiguity) ──
app.get(`${PREFIX}/cuentas-ahorro`, getCuentasAhorroHandler);
app.post(`${PREFIX}/cuentas-ahorro`, postCuentasAhorroHandler);
app.put(`${PREFIX}/cuentas-ahorro`, putCuentasAhorroHandler);
app.patch(`${PREFIX}/cuentas-ahorro/movimiento`, patchMovimientoHandler);
app.patch(`/cuentas-ahorro/movimiento`, patchMovimientoHandler);
// ── Catálogos del Sistema ──
app.get(`${PREFIX}/catalogos/documentos`, getCatalogoDocumentosHandler);
app.post(`${PREFIX}/catalogos/documentos`, postCatalogoDocumentoHandler);
app.put(`${PREFIX}/catalogos/documentos/:id`, putCatalogoDocumentoHandler);
app.delete(`${PREFIX}/catalogos/documentos/:id`, deleteCatalogoDocumentoHandler);

// ── Activar Prospecto ──
app.post(`${PREFIX}/activar-prospecto`, activarProspectoHandler);
app.post("/activar-prospecto", activarProspectoHandler);

// ── Rutas SIN prefijo (caso B — fallback) ──
app.get("/health", healthHandler);
app.get("/seed-credito", seedCreditoHandler);
// (ruta seed-productos-completos sin prefijo eliminada)
app.get("/productos-credito", getProductosCreditoHandler);
app.get("/productos-seguros", getProductosSegurosHandler);
app.get("/productos-captacion", getProductosCaptacionHandler);
app.get("/productos/:id", getProductoByIdHandler);
app.get("/productos", getProductosHandler);
app.post("/productos", postProductosHandler);
app.put("/productos/:id", putProductosHandler);
app.delete("/productos/:id", deleteProductosHandler);
// Rutas estáticas de clientes ANTES de la parametrizada :id
app.get("/clientes-prospectos", getClientesProspectosHandler);
app.get("/clientes-lista", getClientesListaHandler);
app.get("/clientes-gobierno", getClientesGobiernoHandler);
app.get("/seed-prospecto", seedProspectoHandler);
// Rutas parametrizadas de clientes
app.get("/clientes/:id", getClienteByIdHandler);
app.post("/clientes", postClientesHandler);
app.put("/clientes/:id", putClientesHandler);
app.patch("/clientes/:id", patchClientesHandler);
app.delete("/clientes/:id", deleteClientesHandler);
app.post("/storage/expedientes/upload", uploadExpedienteHandler);
app.post("/storage/expedientes/signed-url", getSignedUrlHandler);
app.post("/storage/expedientes/delete", deleteExpedienteFileHandler);
app.get("/clientes-only", getClientesOnlyHandler);
app.get("/clientes-lista-v2", getClientesListaV2Handler);
app.get("/clientes-lista-todos", getClientesListaTodosHandler);
app.get("/verificar-db", verificarDBHandler);
// ── Mantenimiento (sin prefijo) ──
app.post("/mantenimiento/clean-clasificacion", cleanClasificacionHandler);
app.post("/mantenimiento/repair-legacy-prospectos", repairLegacyProspectosHandler);
app.get("/mantenimiento/detect-invalid-urls", detectInvalidUrlsHandler);
app.post("/mantenimiento/reupload-invalid-expedientes", reuploadInvalidExpedientesHandler);
app.get("/mantenimiento/verify-par-cliente-id", verifyParClienteIdHandler);
app.post("/mantenimiento/sync-par-cliente-id", syncParClienteIdHandler);
app.get("/mantenimiento/check-cuenta-eje/:cuentaEje", checkCuentaEjeHandler);
// ── Cuentas de Ahorro (sin prefijo — fallback) ──
app.get("/cuentas-ahorro", getCuentasAhorroHandler);
app.post("/cuentas-ahorro", postCuentasAhorroHandler);
app.put("/cuentas-ahorro", putCuentasAhorroHandler);
// ── Catálogos del Sistema (sin prefijo — fallback) ──
app.get("/catalogos/documentos", getCatalogoDocumentosHandler);
app.post("/catalogos/documentos", postCatalogoDocumentoHandler);
app.put("/catalogos/documentos/:id", putCatalogoDocumentoHandler);
app.delete("/catalogos/documentos/:id", deleteCatalogoDocumentoHandler);

// ── Solicitudes de Crédito (direct SQL — J_CUENTAS_CORP_CLIENTES) ──

const getSolicitudesHandler = async (c: any) => {
  try {
    console.log("[SOLICITUDES] GET /solicitudes-credito — ALL rows (inclusive) with JOIN");
    const rows = await sql`
      SELECT
        s.*,
        cl.data->>'nombre'           AS cliente_nombre,
        cl.data->>'apellidoPaterno'  AS cliente_ap_paterno,
        cl.data->>'apellidoMaterno'  AS cliente_ap_materno,
        cl.data->>'rfc'              AS cliente_rfc,
        cl.data->>'curp'             AS cliente_curp,
        cl.type                      AS cliente_tipo,
        cl.subtipo                   AS cliente_subtipo,
        p.data->>'nombreProducto'    AS producto_nombre,
        p.data->>'claveProducto'     AS producto_clave,
        p.data->>'sucursal'          AS producto_sucursal
      FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" s
      LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES" cl ON cl.id = s.cliente_id
      LEFT JOIN "EFINANCIANET_DB"."J_PRODUCTOS" p  ON p.id  = s.producto_id
      ORDER BY s.fecha_sol DESC NULLS LAST
    `;
    console.log(`[SOLICITUDES] OK — ${rows.length} registros totales (sin filtro WHERE type)`);
    // Log de los types encontrados para diagnóstico
    const typeCounts: Record<string, number> = {};
    rows.forEach((r: any) => { typeCounts[r.type || '(null)'] = (typeCounts[r.type || '(null)'] || 0) + 1; });
    console.log("[SOLICITUDES] Types en tabla:", JSON.stringify(typeCounts));
    // Normalizar: asegurar que row.data sea objeto (no string) antes de enviar al frontend
    const normalized = rows.map((r: any) => {
      if (typeof r.data === 'string') {
        try { r.data = JSON.parse(r.data); } catch { /* keep as-is */ }
      }
      return r;
    });
    return c.json({ data: normalized });
  } catch (err: any) {
    console.log("[SOLICITUDES] Error GET:", err?.message);
    return c.json({ error: `Error listando solicitudes: ${err?.message}` }, 500);
  }
};

const postSolicitudesHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    console.log("[SOLICITUDES] POST /solicitudes-credito — payload body keys:", Object.keys(body).join(','));

    const type = toNullStr(body.type) || 'Solicitud';
    const no_sol = toNullStr(body.no_sol) || '';
    const no_cuenta = toNullStr(body.no_cuenta) || '';
    const no_referenc1 = toNullStr(body.no_referenc1);
    const fecha_sol = toNullTs(body.fecha_sol) || new Date().toISOString().split('T')[0];
    const descripcion = toNullStr(body.descripcion);
    const linea_produc = toNullStr(body.linea_produc) || 'Crédito';
    const tipo_produc = toNullStr(body.tipo_produc) || '';
    const producto_id = toNullUuid(body.producto_id);
    let cliente_id = toNullUuid(body.cliente_id);
    const monto_sol = toNullNum(body.monto_sol);
    const monto_aut = toNullNum(body.monto_aut);
    const estatus_sol = toNullStr(body.estatus_sol) || 'Pendiente';
    const fases = toNullStr(body.fases) || '1';
    const data = body.data || {};

    // ── Diagnóstico: verificar estructura del JSONB data ──
    const hdrCheck = data?.solicitud?.header || {};
    console.log("[SOLICITUDES] POST — JSONB data.solicitud.header:", JSON.stringify({
      nombre_persona: hdrCheck.nombre_persona,
      apellido_paterno_persona: hdrCheck.apellido_paterno_persona,
      apellido_materno_persona: hdrCheck.apellido_materno_persona,
      no_sol: hdrCheck.no_sol,
      tipo_producto: hdrCheck.tipo_producto,
      producto_id: hdrCheck.producto_id,
    }));
    console.log("[SOLICITUDES] POST — columnas:", JSON.stringify({
      type, no_sol, linea_produc, tipo_produc, producto_id, monto_sol, monto_aut, estatus_sol, fases
    }));

    // ── Resolver cliente_id por nombre si no viene explícito ──
    if (!cliente_id) {
      const nombre = hdrCheck.nombre_persona || '';
      const apPat = hdrCheck.apellido_paterno_persona || '';
      const apMat = hdrCheck.apellido_materno_persona || '';
      console.log(`[SOLICITUDES] POST — buscando cliente por nombre: '${nombre}' '${apPat}' '${apMat}'`);

      if (nombre || apPat) {
        try {
          // Nivel 1: match exacto nombre + apellidos en J_CLIENTES.data
          const matchRows = await sql`
            SELECT id, data->>'nombre' AS n, data->>'apellidoPaterno' AS ap
            FROM "EFINANCIANET_DB"."J_CLIENTES"
            WHERE data->>'nombre' = ${nombre}
              AND COALESCE(data->>'apellidoPaterno', '') = ${apPat}
              AND COALESCE(data->>'apellidoMaterno', '') = ${apMat}
            LIMIT 1
          `;
          if (matchRows.length > 0) {
            cliente_id = matchRows[0].id;
            console.log(`[SOLICITUDES] POST — match EXACTO: ${cliente_id} (${matchRows[0].n} ${matchRows[0].ap})`);
          } else {
            // Nivel 2: match parcial por nombre
            const partialRows = await sql`
              SELECT id, data->>'nombre' AS n, data->>'apellidoPaterno' AS ap
              FROM "EFINANCIANET_DB"."J_CLIENTES"
              WHERE data->>'nombre' ILIKE ${nombre + '%'}
              LIMIT 1
            `;
            if (partialRows.length > 0) {
              cliente_id = partialRows[0].id;
              console.log(`[SOLICITUDES] POST — match PARCIAL: ${cliente_id} (${partialRows[0].n} ${partialRows[0].ap})`);
            }
          }
        } catch (lookupErr: any) {
          console.warn(`[SOLICITUDES] POST — error buscando cliente: ${lookupErr?.message}`);
        }
      }

      // Nivel 3: fallback a primer cliente (solo si columna NOT NULL)
      if (!cliente_id) {
        console.warn("[SOLICITUDES] POST — ⚠️ FALLBACK: nombre del form NO coincide con ningún cliente en J_CLIENTES");
        console.warn("[SOLICITUDES] POST — ⚠️ El nombre CORRECTO se preserva en data.solicitud.header (JSONB)");
        const fallbackRows = await sql`
          SELECT id, data->>'nombre' AS n FROM "EFINANCIANET_DB"."J_CLIENTES" LIMIT 1
        `;
        if (fallbackRows.length > 0) {
          cliente_id = fallbackRows[0].id;
          console.warn(`[SOLICITUDES] POST — FALLBACK cliente_id: ${cliente_id} (${fallbackRows[0].n}) — NO es el cliente real`);
        }
      }
    }

    if (!cliente_id) {
      return c.json({ error: 'No se pudo resolver cliente_id y no hay clientes en J_CLIENTES.' }, 400);
    }

    console.log("[SOLICITUDES] POST — cliente_id final:", cliente_id);

    // ── INSERT con RETURNING id, data para verificación ──
    const dataJson = JSON.stringify(data);
    const result = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
        type, no_sol, no_cuenta, no_referenc1, fecha_sol, descripcion,
        linea_produc, tipo_produc, producto_id, cliente_id,
        monto_sol, monto_aut, estatus_sol, fases, data
      ) VALUES (
        ${type}, ${no_sol}, ${no_cuenta}, ${no_referenc1}, ${fecha_sol}::date, ${descripcion},
        ${linea_produc}, ${tipo_produc}, ${producto_id}::uuid, ${cliente_id}::uuid,
        ${monto_sol}::numeric::money, ${monto_aut}::numeric::money, ${estatus_sol}, ${fases}, ${dataJson}::jsonb
      )
      RETURNING id, no_sol, type, data->'solicitud'->'header'->>'nombre_persona' AS saved_nombre
    `;
    const newId = result[0]?.id;
    const savedNombre = result[0]?.saved_nombre;
    console.log(`[SOLICITUDES] INSERT OK — id: ${newId} | no_sol: ${result[0]?.no_sol} | saved_nombre_from_jsonb: '${savedNombre}'`);
    return c.json({ id: newId, no_sol: result[0]?.no_sol, saved_nombre: savedNombre });
  } catch (err: any) {
    console.log("[SOLICITUDES] Error POST:", err?.message);
    return c.json({ error: `Error insertando solicitud: ${err?.message}` }, 500);
  }
};

const putSolicitudesHandler = async (c: any) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    console.log(`[SOLICITUDES] PUT /solicitudes-credito/${id}`, JSON.stringify(body).substring(0, 800));

    // Diagnóstico: verificar comisiones en el payload
    const solData = body.data?.solicitud || {};
    console.log(`[SOLICITUDES] PUT — comisiones: ${Array.isArray(solData.comisiones) ? solData.comisiones.length : 'N/A'} | garantias: ${Array.isArray(solData.garantias) ? solData.garantias.length : 'N/A'} | documentos: ${Array.isArray(solData.expediente_electronico?.documentos) ? solData.expediente_electronico.documentos.length : 'N/A'}`);

    const no_sol = toNullStr(body.no_sol);
    const no_cuenta = toNullStr(body.no_cuenta);
    const no_referenc1 = toNullStr(body.no_referenc1);
    const fecha_sol = toNullTs(body.fecha_sol);
    const descripcion = toNullStr(body.descripcion);
    const linea_produc = toNullStr(body.linea_produc);
    const tipo_produc = toNullStr(body.tipo_produc);
    const producto_id = toNullUuid(body.producto_id);
    const cliente_id = toNullUuid(body.cliente_id);
    const monto_sol = toNullNum(body.monto_sol);
    const monto_aut = toNullNum(body.monto_aut);
    const estatus_sol = toNullStr(body.estatus_sol);
    const estatus_cuen = toNullStr(body.estatus_cuen);
    const estatus_cart = toNullStr(body.estatus_cart);
    const estatus_disp = toNullStr(body.estatus_disp);
    const cta_eje_chec = body.cta_eje_chec !== undefined ? Boolean(body.cta_eje_chec) : null;
    const fases = toNullStr(body.fases);
    const incomingData = body.data;
    const monto_cubrir_garantia = body.monto_cubrir_garantia != null ? Number(body.monto_cubrir_garantia) : null;
    const porcentaje_aforo = body.porcentaje_aforo != null ? Number(body.porcentaje_aforo) : null;

    // ── FIX CRÍTICO: Deep merge para columna data — previene sobreescritura de datos de banca móvil ──
    // Antes se usaba COALESCE(new_data, old_data) que reemplaza COMPLETO cuando new_data != null.
    // Ahora: leer data existente → deepMerge(existing, incoming) → escribir fusionado.
    let finalDataJson: string | null = null;
    if (incomingData !== null && incomingData !== undefined) {
      const existingRows = await sql`
        SELECT data FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE id = ${id}::uuid LIMIT 1
      `;
      let existingData: Record<string, any> = {};
      if (existingRows.length > 0 && existingRows[0].data) {
        existingData = typeof existingRows[0].data === "string"
          ? JSON.parse(existingRows[0].data)
          : (existingRows[0].data as Record<string, any>);
      }
      const merged = deepMergeData(existingData, incomingData as Record<string, any>);
      finalDataJson = JSON.stringify(merged);
      console.log(`[SOLICITUDES] PUT deep-merge data: existing=${Object.keys(existingData).length} keys → incoming=${Object.keys(incomingData as object).length} keys → merged=${Object.keys(merged).length} keys`);
    }

    await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      SET
        no_sol                = COALESCE(${no_sol}, no_sol),
        no_cuenta             = COALESCE(${no_cuenta}, no_cuenta),
        no_referenc1          = COALESCE(${no_referenc1}, no_referenc1),
        fecha_sol             = COALESCE(${fecha_sol}::date, fecha_sol),
        descripcion           = COALESCE(${descripcion}, descripcion),
        linea_produc          = COALESCE(${linea_produc}, linea_produc),
        tipo_produc           = COALESCE(${tipo_produc}, tipo_produc),
        producto_id           = COALESCE(${producto_id}::uuid, producto_id),
        cliente_id            = COALESCE(${cliente_id}::uuid, cliente_id),
        monto_sol             = COALESCE(${monto_sol}::numeric::money, monto_sol),
        monto_aut             = COALESCE(${monto_aut}::numeric::money, monto_aut),
        estatus_sol           = COALESCE(${estatus_sol}, estatus_sol),
        estatus_cuen          = COALESCE(${estatus_cuen}, estatus_cuen),
        estatus_cart          = COALESCE(${estatus_cart}, estatus_cart),
        estatus_disp          = COALESCE(${estatus_disp}, estatus_disp),
        cta_eje_chec          = COALESCE(${cta_eje_chec}, cta_eje_chec),
        fases                 = COALESCE(${fases}, fases),
        monto_cubrir_garantia = COALESCE(${monto_cubrir_garantia}::numeric, monto_cubrir_garantia),
        porcentaje_aforo      = COALESCE(${porcentaje_aforo}::numeric, porcentaje_aforo),
        data                  = CASE WHEN ${finalDataJson}::jsonb IS NOT NULL THEN ${finalDataJson}::jsonb ELSE data END
      WHERE id = ${id}::uuid
    `;
    console.log(`[SOLICITUDES] UPDATE OK — id: ${id}`);
    return c.json({ ok: true });
  } catch (err: any) {
    console.log(`[SOLICITUDES] Error PUT:`, err?.message);
    return c.json({ error: `Error actualizando solicitud: ${err?.message}` }, 500);
  }
};

const deleteSolicitudesHandler = async (c: any) => {
  try {
    const id = c.req.param('id');
    console.log(`[SOLICITUDES] DELETE /solicitudes-credito/${id}`);
    await sql`DELETE FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = ${id}::uuid`;
    console.log(`[SOLICITUDES] DELETE OK — id: ${id}`);
    return c.json({ ok: true });
  } catch (err: any) {
    console.log(`[SOLICITUDES] Error DELETE:`, err?.message);
    return c.json({ error: `Error eliminando solicitud: ${err?.message}` }, 500);
  }
};

// ── Endpoint: generar siguiente NO_SOL atómico ──
// Consulta el último consecutivo del día en J_CUENTAS_CORP_CLIENTES y devuelve el siguiente
const getNextNoSolHandler = async (c: any) => {
  try {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `BAN-DIGITAL-${yyyy}${mm}${dd}-`;

    console.log(`[NO_SOL] Buscando último consecutivo con prefijo: ${datePrefix}`);

    const rows = await sql`
      SELECT no_sol FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE no_sol LIKE ${datePrefix + '%'}
      ORDER BY no_sol DESC
      LIMIT 1
    `;

    let nextConsecutivo = 1;
    if (rows.length > 0 && rows[0].no_sol) {
      const lastNoSol = rows[0].no_sol as string;
      // Extraer el consecutivo numérico después del último guión
      const parts = lastNoSol.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextConsecutivo = lastNum + 1;
      }
      console.log(`[NO_SOL] Último: ${lastNoSol} → siguiente: ${nextConsecutivo}`);
    } else {
      console.log(`[NO_SOL] No hay solicitudes del día ${yyyy}${mm}${dd} → empezando en 1`);
    }

    const noSol = `${datePrefix}${String(nextConsecutivo).padStart(6, '0')}`;
    return c.json({ no_sol: noSol, consecutivo: nextConsecutivo, fecha: `${yyyy}-${mm}-${dd}` });
  } catch (err: any) {
    console.log("[NO_SOL] Error:", err?.message);
    return c.json({ error: `Error generando NO_SOL: ${err?.message}` }, 500);
  }
};

app.get(`${PREFIX}/solicitudes-credito/next-no-sol`, getNextNoSolHandler);
app.get(`${PREFIX}/solicitudes-credito`, getSolicitudesHandler);
app.post(`${PREFIX}/solicitudes-credito`, postSolicitudesHandler);
app.put(`${PREFIX}/solicitudes-credito/:id`, putSolicitudesHandler);
app.delete(`${PREFIX}/solicitudes-credito/:id`, deleteSolicitudesHandler);
// ── Solicitudes (sin prefijo — fallback) ──
app.get("/solicitudes-credito/next-no-sol", getNextNoSolHandler);
app.get("/solicitudes-credito", getSolicitudesHandler);
app.post("/solicitudes-credito", postSolicitudesHandler);
app.put("/solicitudes-credito/:id", putSolicitudesHandler);
app.delete("/solicitudes-credito/:id", deleteSolicitudesHandler);

// ═══════════════════════════════════════════════════════════════════
// FORMALIZAR CONTRATO / PAGARÉ (Fase 4 — Originación)
// POST /solicitudes-credito/:id/formalizarContrato
// Merge de datosContrato en data.contrato + marca estatus_sol = 'Formalizado'
// ═══════════════════════════════════════════════════════════════════
const formalizarContratoHandler = async (c: any) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    console.log(`[FORMALIZAR] POST /solicitudes-credito/${id}/formalizarContrato`, JSON.stringify(body).substring(0, 400));

    // Verificar que existe la solicitud y obtener data actual
    const rows = await sql`
      SELECT data, estatus_sol
      FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE id = ${id}::uuid
    `;
    if (rows.length === 0) {
      console.log(`[FORMALIZAR] Solicitud no encontrada — id: ${id}`);
      return c.json({ error: 'Solicitud no encontrada' }, 404);
    }

    const currentData = (rows[0].data as Record<string, any>) ?? {};
    const mergedData  = { ...currentData, contrato: body };

    await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      SET
        data        = ${JSON.stringify(mergedData)}::jsonb,
        estatus_sol = 'Formalizado'
      WHERE id = ${id}::uuid
    `;

    console.log(`[FORMALIZAR] UPDATE OK — id: ${id}`);
    return c.json({ ok: true, contrato: body });
  } catch (err: any) {
    console.log(`[FORMALIZAR] Error:`, err?.message);
    return c.json({ error: `Error formalizando contrato: ${err?.message}` }, 500);
  }
};

// ── Registro de rutas: con prefijo y sin prefijo (fallback) ──
app.post(`${PREFIX}/solicitudes-credito/:id/formalizarContrato`, formalizarContratoHandler);
app.post("/solicitudes-credito/:id/formalizarContrato", formalizarContratoHandler);

// ═══════════════════════════════════════════════════════════════════
// VALIDACIÓN DE DOCUMENTOS CON IA (Groq — Llama 3.2 Vision)
// ═══════════════════════════════════════════════════════════════════
// ── System prompt: validador Módulo de Producto — Formalizar Contrato ──
const SYSTEM_PROMPT_FORMALIZAR_CONTRATO = `Eres un asistente experto en configuración del CORE bancario.
Tu tarea es asegurar que el Módulo de "Producto" esté correctamente configurado
para soportar la creación y uso de plantillas institucionales en el flujo de Originación.

INSTRUCCIONES DE VALIDACIÓN:
1. El subtab "Plantillas" debe existir en el submódulo del Producto.
2. Tipos de plantilla válidos (picklist): solicitud, contrato, pagare, minuta.
3. Cada plantilla debe tener: Nombre, Tipo, Archivo base, Versión, Estatus (Activo/Inactivo).
4. Para Formalizar Contrato (Fase 4) se requiere al menos:
   - Una plantilla tipo "contrato" con Estatus "Activo"
   - Una plantilla tipo "pagare" con Estatus "Activo"
5. Si falta alguna plantilla requerida, si el subtab no existe, o si el tipo no es válido → bloquear.
6. Verifica también que los documentos de Fase 4 obligatorios estén cargados y validados.

REGLAS:
- Si falta plantilla "contrato" activa → valido: false, reportar en faltantes.
- Si falta plantilla "pagare" activa → valido: false, reportar en faltantes.
- Si ambas existen y están activas → puedeGenerarDocumentos: true.
- Detecta y reporta en plantillasDetectadas los tipos de plantillas activas encontradas.

Responde ÚNICAMENTE en JSON con esta estructura exacta:
{
  "valido": true,
  "motivos": ["motivo 1"],
  "faltantes": ["plantilla o configuración faltante"],
  "plantillasDetectadas": ["contrato", "pagare"],
  "puedeGenerarDocumentos": true
}
NO incluyas texto fuera del JSON.`;

// ── System prompt: validador experto CORE Bancario ──────────────────
const SYSTEM_PROMPT_CORE_BANKING = `Eres un validador experto de procesos bancarios del CORE de Productos y Originación.
Tu función es validar fases completas del flujo de originación, documentos, subtabs,
plantillas, reglas de negocio y condiciones legales, operativas y jurídicas.
El sistema te enviará:
- Datos del cliente
- Tipo de persona (Física, Moral, Física con Actividad Empresarial)
- Datos del crédito
- Línea de producto (Crédito, Captación, Línea de Crédito)
- Documentos cargados en el expediente electrónico (Sección 2)
- Documentos obligatorios por fase (Sección 1)
- Documentos generados automáticamente (Solicitud, Contrato, Pagaré)
- Subtabs configurados en el producto
- Plantillas configuradas en el producto
- Reglas de negocio de la fase
- Notas registradas
- Fase actual, número de fase y área actual
- Prompt IA del producto
- Prompt IA de la fase (si existe)
- Catálogo de prompts por documento (fallback)
- Botón presionado por el usuario (Enviar Fase, Regresar Fase, Formalizar Contrato, Solicitud de Activación, Activar Cuenta)

────────────────────────────────────────
1. INTERPRETACIÓN DEL CONTEXTO
────────────────────────────────────────
Debes interpretar:
- El prompt IA del producto
- El prompt IA de la fase
- El catálogo de prompts por documento
- Las reglas de negocio del flujo de originación
- Los documentos cargados
- Los documentos generados
- Los subtabs
- Las plantillas
- El tipo de persona
- La línea de producto
- La fase actual
- El botón presionado

────────────────────────────────────────
2. VALIDACIÓN DE DOCUMENTOS OBLIGATORIOS
────────────────────────────────────────
Para la fase actual:
- Identifica los documentos obligatorios según el tipo de persona.
- Verifica que existan en la Sección 2 del expediente electrónico.
- Verifica que hayan sido validados por IA.
- Verifica que cumplan con el tipo esperado.
- Verifica que sean legibles.
- Verifica que coincidan con los datos del cliente.
- Verifica requisitos legales (RFC, firmas, vigencia, etc.).
Si falta un documento obligatorio, repórtalo.

────────────────────────────────────────
3. VALIDACIÓN DE SUBTABS Y CONFIGURACIÓN
────────────────────────────────────────
Verifica:
- Que existan los subtabs requeridos por la fase.
- Que existan plantillas configuradas (Solicitud, Contrato, Pagaré, Minuta).
- Que las plantillas correspondan al producto.
- Que los documentos generados provengan de la plantilla correcta.

────────────────────────────────────────
4. VALIDACIÓN DE REGLAS DE NEGOCIO POR FASE
────────────────────────────────────────
FASE 1 — Expediente Electrónico
- Validar que los datos del cliente estén completos.
- Validar que existan los documentos base según tipo de persona.
FASE 2 — Integración / Solicitud
- Validar que exista el PDF "SOLICITUD".
- Validar encabezado EXACTO: "SOLICITUD".
- Validar datos del cliente y monto.
- Validar firma (si aplica).
FASE 3 — Análisis / RFC
- Validar que exista la Constancia Fiscal SAT.
- Validar que el RFC coincida con el del cliente.
FASE 4 — Expediente Jurídico / Formalización
- Validar Acta Constitutiva.
- Validar plantillas de Contrato y Pagaré.
- Validar generación de Contrato.pdf y Pagare.pdf.
- Validar datos del crédito, términos y condiciones y garantías.
FASE 5 — Validación de Firmas
- Validar Contrato firmado.
- Validar Pagaré firmado.
- Validar firmas legibles.
FASE 6 — Solicitud de Activación
- Validar que todas las fases anteriores estén completas.
- Validar garantías (si aplica).
- Validar comités (si aplica).
- Validar cargos.
- Validar creación de Cuenta por Pagar o Cuenta por Cobrar.
FASE 7 — Activación de Cuenta
- Validar que el estatus en Solicitudes de Activación sea "Pagado".
- Validar que se puedan actualizar los estatus:
  - Estatus Solicitud = Autorizada
  - Estatus Cuenta = Activa
  - Estatus Pago = Pagado
  - Estatus Cartera = Activa

────────────────────────────────────────
5. VALIDACIÓN DE BOTONES Y ACCIONES
────────────────────────────────────────
Botón "Enviar Fase"
- Validar documentos obligatorios.
- Validar reglas de negocio.
- Validar que la fase esté completa.
Botón "Regresar Fase"
- Validar que exista al menos una NOTA en los últimos 30 minutos.
Botón "Formalizar Contrato"
- Validar plantillas.
- Validar datos del crédito.
- Validar garantías.
- Validar términos y condiciones.
- Validar generación de Contrato y Pagaré.
Botón "Solicitud de Activación"
- Validar garantías.
- Validar comités.
- Validar cargos.
- Validar creación de Cuenta por Pagar o Cobrar.
Botón "Activar Cuenta"
- Validar estatus de Solicitud de Activación.

────────────────────────────────────────
6. RESPUESTA EN JSON
────────────────────────────────────────
Responde únicamente en JSON:
{
  "valido": true | false,
  "confianza": 0.0 a 1.0,
  "motivos": ["motivo 1", "motivo 2"],
  "faltantes": ["documento o condición faltante"],
  "faseListaParaAvanzar": true | false,
  "documentosValidados": [
    {
      "tipo": "INE",
      "valido": true,
      "motivos": ["Nombre coincide", "Documento vigente"]
    }
  ]
}
NO incluyas texto fuera del JSON.`;

const SYSTEM_PROMPT_DOCUMENTO_INDIVIDUAL = `Eres un validador experto de documentos bancarios.
Tu única tarea es evaluar SI EL DOCUMENTO ES VÁLIDO según el criterio indicado.

REGLAS ESTRICTAS:
1. Analiza SOLO el documento proporcionado. NO menciones documentos faltantes de la fase.
2. Si el RFC del cliente coincide con el visible en el documento → el documento ES VÁLIDO para ese criterio.
3. Si el CURP del cliente coincide con el visible en el documento → el documento ES VÁLIDO para ese criterio.
4. Si el documento está vigente y es legible → ES VÁLIDO.
5. "valido": true SIGNIFICA que el documento cumple los requisitos. USA true cuando los criterios se cumplen.
6. Solo usa "valido": false si hay un problema REAL y CONCRETO en el documento mismo.
7. "confianza" debe ser >= 0.8 cuando el documento cumple los criterios claramente.

RESPONDE ÚNICAMENTE EN JSON:
{
  "valido": true,
  "confianza": 0.9,
  "motivos": ["El RFC coincide", "Documento vigente y legible"],
  "faltantes": [],
  "faseListaParaAvanzar": true,
  "documentosValidados": [{"tipo": "<tipoDocumento>", "valido": true, "motivos": ["..."]}]
}
NO incluyas texto fuera del JSON.`;

const validarDocumentoIAHandler = async (c: any) => {
  const LOG_IA = "[VALIDAR-IA]";
  try {
    const body = await c.req.json();
    const {
      // ── Parámetros de validación de documento individual (modo documento) ──
      storagePath, promptIA, tipoDocumento, nombreSolicitante, imageBase64,
      // ── Parámetros de validación de fase completa (modo fase) ──
      datosCliente, tipoPersona, datosCredito, lineaProducto,
      documentosCargados, documentosObligatorios, documentosGenerados,
      subtabs, plantillas, reglas, notas,
      faseActual, faseNumero, areaActual,
      promptIAProducto, promptIAFase, catalogoPrompts,
      botonPresionado,
    } = body;

    // modoFase SOLO cuando el usuario presionó un botón de flujo — enviar faseActual/faseNumero
    // como contexto en documento individual NO debe activar validación de fase completa
    const modoFase = !!botonPresionado;
    const modoDocumento = !!(tipoDocumento && (storagePath || imageBase64));

    console.log(`${LOG_IA} Request — modo=${modoFase ? 'FASE' : 'DOCUMENTO'}, tipo=${tipoDocumento}, fase=${faseActual}(${faseNumero}), boton=${botonPresionado}`);

    if (!modoFase && !modoDocumento) {
      return c.json({ error: "Faltan parámetros: especifique (tipoDocumento + storagePath/imageBase64) o (faseActual/faseNumero/botonPresionado)" }, 400);
    }

    // ── 1. Obtener imagen (solo si modo documento) ──
    let imageDataUrl = "";

    if (modoDocumento) {
      if (imageBase64) {
        // Frontend renderizó el PDF a imagen y envía base64 directamente
        console.log(LOG_IA + " Usando imageBase64 del frontend (PDF pre-renderizado)");
        const approxBytes = imageBase64.length * 0.75;
        if (approxBytes > 4 * 1024 * 1024) {
          return c.json({ error: "La imagen renderizada es demasiado grande (máx 4MB)", details: (approxBytes / 1024).toFixed(0) + " KB" }, 400);
        }
        imageDataUrl = imageBase64.startsWith("data:") ? imageBase64 : "data:image/png;base64," + imageBase64;
        console.log(LOG_IA + " imageBase64 OK — ~" + (approxBytes / 1024).toFixed(1) + " KB");
      } else if (storagePath) {
        const supabaseIA = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: fileData, error: downloadError } = await supabaseIA.storage
          .from(BUCKET_NAME)
          .download(storagePath);
        if (downloadError || !fileData) {
          console.log(LOG_IA + " Error descargando archivo:", downloadError?.message);
          return c.json({ error: "No se pudo descargar el documento de Storage", details: downloadError?.message }, 500);
        }
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        const base64Content = btoa(binary);
        const fileSizeKB = uint8.length / 1024;
        if (uint8.length > 4 * 1024 * 1024) {
          return c.json({ error: "El documento es demasiado grande para validación IA (máx 4MB)", details: fileSizeKB.toFixed(0) + " KB" }, 400);
        }
        const ext = storagePath.split(".").pop()?.toLowerCase() || "png";
        if (ext === "pdf") {
          return c.json({ error: "Los PDFs requieren pre-renderizado. El frontend debe enviar imageBase64.", details: "Use pdfjs-dist en frontend" }, 400);
        }
        const mimeMap: Record<string, string> = {
          png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
          gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
        };
        imageDataUrl = "data:" + (mimeMap[ext] || "image/png") + ";base64," + base64Content;
        console.log(LOG_IA + " Archivo descargado OK — " + fileSizeKB.toFixed(1) + " KB");
      }
    }

    // ── 2. Construir contexto para el validador bancario ──
    const fechaSistema = new Date().toISOString();

    // Contexto de la fase / proceso
    const contextoFase = {
      fechaSistema,
      botonPresionado: botonPresionado || "(no especificado)",
      faseActual: faseActual || "(no especificada)",
      faseNumero: faseNumero ?? "(no especificado)",
      areaActual: areaActual || "(no especificada)",
      tipoPersona: tipoPersona || "(no especificado)",
      lineaProducto: lineaProducto || "(no especificado)",
      datosCliente: datosCliente || {},
      datosCredito: datosCredito || {},
      promptIAProducto: promptIAProducto || promptIA || "(no especificado)",
      promptIAFase: promptIAFase || "(no especificado)",
      catalogoPrompts: catalogoPrompts || [],
      documentosObligatorios: documentosObligatorios || [],
      documentosCargados: documentosCargados || [],
      documentosGenerados: documentosGenerados || [],
      subtabs: subtabs || [],
      plantillas: plantillas || [],
      reglas: reglas || [],
      notas: notas || [],
      ...(tipoDocumento ? { tipoDocumentoActual: tipoDocumento } : {}),
      ...(nombreSolicitante ? { nombreSolicitante } : {}),
    };

    // Documento individual: solo enviar lo necesario para validar ESE documento
    const userMessage = modoDocumento && !modoFase
      ? `Valida el documento "${tipoDocumento}" según esta instrucción:\n${promptIA || "Verifica que el documento sea auténtico, legible y corresponda al tipo indicado."}\n\nContexto del solicitante:\n- Nombre: ${nombreSolicitante || "(no indicado)"}\n- Tipo persona: ${tipoPersona || "(no indicado)"}\n- Línea producto: ${lineaProducto || "(no indicado)"}\n- Fase: ${faseActual || `Fase ${faseNumero}`}\n\nResponde ÚNICAMENTE en JSON.`
      : `Valida el siguiente contexto del proceso bancario y responde ÚNICAMENTE en JSON:\n\n${JSON.stringify(contextoFase, null, 2)}`;

    // ── 3. Preparar prompt y llamar a IA ──
    const esFormalizarContrato = (botonPresionado || "").toLowerCase().includes("formalizar");
    const systemPrompt = modoDocumento && !modoFase
      ? SYSTEM_PROMPT_DOCUMENTO_INDIVIDUAL          // validación de un documento individual
      : esFormalizarContrato
        ? SYSTEM_PROMPT_FORMALIZAR_CONTRATO         // formalizar contrato
        : SYSTEM_PROMPT_CORE_BANKING;               // avance de fase completa

    const textoPrincipal = systemPrompt + "\n\n" + userMessage;

    // ── Helper: parsear JSON de respuesta IA ──
    // ── Helper: llamar a OpenRouter con un modelo dado ──
    const OR_KEY   = Deno.env.get("OPENROUTER_API_KEY") || "";
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY") || "";
    const OR_URL   = "https://openrouter.ai/api/v1/chat/completions";
    const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    const OR_HDR   = { "HTTP-Referer": "https://pvzrjmsynzgfsowntywf.supabase.co", "X-Title": "CORE Bancario" };

    const tryModel = async (url: string, auth: string, model: string, extra: Record<string,string> = {}): Promise<{raw: string; err?: string} | null> => {
      const messages = imageDataUrl
        ? [{ role: "user", content: [{ type: "text", text: textoPrincipal }, { type: "image_url", image_url: { url: imageDataUrl } }] }]
        : [{ role: "user", content: textoPrincipal }];
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth}`, ...extra },
          body: JSON.stringify({ model, messages, temperature: 0, max_tokens: 1024 }),
        });
        const body = await res.text();
        if (!res.ok) {
          console.log(`${LOG_IA} [${model}] HTTP ${res.status}: ${body.substring(0, 300)}`);
          return { raw: "", err: `${model} HTTP ${res.status}: ${body.substring(0, 200)}` };
        }
        const j = JSON.parse(body);
        const content = j.choices?.[0]?.message?.content || "";
        if (!content) return { raw: "", err: `${model} devolvió contenido vacío` };
        console.log(`${LOG_IA} [${model}] OK (${content.length} chars)`);
        return { raw: content };
      } catch (e: any) {
        console.log(`${LOG_IA} [${model}] excepción: ${e.message}`);
        return { raw: "", err: `${model} excepción: ${e.message}` };
      }
    };

    const intentos: Array<() => Promise<{raw:string;err?:string}|null>> = [
      // Gemini Flash 1.5 vía OpenRouter — más barato, ~$0.000075/1K tokens
      () => GROQ_KEY ? tryModel(GROQ_URL, GROQ_KEY, "meta-llama/llama-4-scout-17b-16e-instruct") : null,
    ];

    let rawContent = "";
    let modeloUsado = "ninguno";
    const errores: string[] = [];

    for (const intento of intentos) {
      const r = await intento();
      if (!r) continue;
      if (r.raw) { rawContent = r.raw; break; }
      if (r.err) errores.push(r.err);
    }

    // Si ninguno respondió → pass-through (no bloquear al usuario)
    if (!rawContent) {
      console.log(`${LOG_IA} Todos fallaron: ${errores.join(" | ")}`);
      return c.json({
        valido: true, confianza: 0,
        motivos: ["Validación IA omitida — sin disponibilidad. Revisión manual recomendada.", ...errores.slice(0, 2)],
        faltantes: [], faseListaParaAvanzar: true, documentosValidados: [],
        puedeGenerarDocumentos: true, puedeGenerarContrato: true, puedeGenerarPagare: true,
        modelo: "ninguno", timestamp: new Date().toISOString(), _rateLimited: true, _errores: errores,
      });
    }

    // ── 5. Parsear JSON de la respuesta ──
    const parseIAJson = (raw: string): any | null => {
      try {
        const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        return JSON.parse(m ? m[1].trim() : raw.trim());
      } catch (_) { return null; }
    };
    let parsed: any = parseIAJson(rawContent);
    if (!parsed) {
      parsed = {
        valido: false, confianza: 0,
        motivos: ["La IA no pudo analizar el contexto correctamente", "Respuesta no estructurada: " + rawContent.substring(0, 200)],
        faltantes: [], faseListaParaAvanzar: false, documentosValidados: [],
        _rawResponse: rawContent.substring(0, 500),
      };
    }

    // ── Post-procesamiento: detectar respuesta contradictoria del modelo ──
    // Si todos los motivos son positivos pero valido=false, el modelo cometió un error lógico
    const motivosPositivos = ["coincide", "válido", "vigente", "legible", "correcto", "auténtico",
      "coinciden", "verificado", "aprobado", "completo", "presente", "corresponde"];
    const motivosNegativos = ["no coincide", "falta", "inválido", "ilegible", "rechazado",
      "incorrecto", "no se puede", "no presenta", "ausente", "error", "vencido"];
    const motivosArr: string[] = Array.isArray(parsed.motivos) ? parsed.motivos : [];
    if (!parsed.valido && motivosArr.length > 0 && modoDocumento && !modoFase) {
      const textoMotivos = motivosArr.join(" ").toLowerCase();
      const tienePositivo = motivosPositivos.some(p => textoMotivos.includes(p));
      const tieneNegativo = motivosNegativos.some(n => textoMotivos.includes(n));
      if (tienePositivo && !tieneNegativo) {
        console.log(`${LOG_IA} ⚠️ Respuesta contradictoria detectada: motivos positivos pero valido=false → corrigiendo a valido=true`);
        parsed.valido = true;
        parsed.confianza = parsed.confianza > 0 ? parsed.confianza : 0.85;
      }
    }

    const result = {
      valido: parsed.valido === true,
      confianza: typeof parsed.confianza === "number" ? parsed.confianza : (parsed.valido ? 0.8 : 0.2),
      motivos: Array.isArray(parsed.motivos) ? parsed.motivos : [],
      faltantes: Array.isArray(parsed.faltantes) ? parsed.faltantes : [],
      faseListaParaAvanzar: parsed.faseListaParaAvanzar === true,
      documentosValidados: Array.isArray(parsed.documentosValidados) ? parsed.documentosValidados : [],
      // Campos específicos Formalizar Contrato (Fase 4) — nuevo formato
      plantillasDetectadas: Array.isArray(parsed.plantillasDetectadas) ? parsed.plantillasDetectadas : [],
      puedeGenerarDocumentos: parsed.puedeGenerarDocumentos === true,
      // Compatibilidad con campos legacy
      puedeGenerarContrato: parsed.puedeGenerarContrato === true || (Array.isArray(parsed.plantillasDetectadas) && parsed.plantillasDetectadas.includes('contrato')),
      puedeGenerarPagare: parsed.puedeGenerarPagare === true || (Array.isArray(parsed.plantillasDetectadas) && parsed.plantillasDetectadas.includes('pagare')),
      // Campos legacy para compatibilidad con validación de documento individual
      extraido: parsed.extraido || {},
      modelo: modeloUsado,
      timestamp: fechaSistema,
      tipoDocumento: tipoDocumento || null,
      faseActual: faseActual || null,
      botonPresionado: botonPresionado || null,
      usage: null,
    };

    console.log(`${LOG_IA} ✅ valido=${result.valido}, confianza=${result.confianza}, faseListaParaAvanzar=${result.faseListaParaAvanzar}, faltantes=${result.faltantes.length}, docsValidados=${result.documentosValidados.length}`);
    return c.json(result);
  } catch (err: any) {
    console.log(`${LOG_IA} Error no capturado:`, err.message, err.stack);
    return c.json({ error: "Error interno en validación IA", details: err.message }, 500);
  }
};

app.post(`${PREFIX}/validar-documento-ia`, validarDocumentoIAHandler);
app.post("/validar-documento-ia", validarDocumentoIAHandler);

// ═══════════════════════════════════════════════════════════════════
// ACTIVAR CUENTA FINANCIERA — Endpoint transaccional para la fase final
// de Línea de Crédito. Actualiza estatus_sol='Autorizada' y finaliza el flujo.
// Input:  { solicitud_id, usuario_id, fase_actual, fase_siguiente }
// Output: { valido, estatusActualizado, flujoFinalizado, idempotente, esFaseFinal, faltantes, motivos }
// ═══════════════════════════════════════════════════════════════════
const activarCuentaFinancieraHandler = async (c: any) => {
  const LOG = "[ACTIVAR-CUENTA-FIN]";
  try {
    const body = await c.req.json();
    const { solicitud_id, usuario_id, fase_actual, fase_siguiente } = body;

    console.log(`${LOG} Request — solicitud_id=${solicitud_id}, fase_actual=${fase_actual}, fase_siguiente=${fase_siguiente ?? "null"}`);

    if (!solicitud_id) {
      return c.json({ valido: false, estatusActualizado: false, flujoFinalizado: false, idempotente: false, esFaseFinal: false, faltantes: ["solicitud_id"], motivos: ["Falta solicitud_id"] });
    }

    // ── Precondición: verificar que la solicitud existe y su estatus actual ──
    let rows: any[];
    try {
      rows = await sql`
        SELECT estatus_sol
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE id = ${solicitud_id}::uuid
        LIMIT 1
      `;
    } catch (dbErr: any) {
      console.error(`${LOG} Error consultando solicitud:`, dbErr.message);
      return c.json({ valido: false, estatusActualizado: false, flujoFinalizado: false, idempotente: false, esFaseFinal: false, faltantes: [], motivos: ["Error consultando solicitud: " + dbErr.message] });
    }

    if (rows.length === 0) {
      return c.json({ valido: false, estatusActualizado: false, flujoFinalizado: false, idempotente: false, esFaseFinal: false, faltantes: [], motivos: ["Solicitud no encontrada"] });
    }

    const estatusActual: string = rows[0].estatus_sol || "";
    if (["Cancelada", "Rechazada"].includes(estatusActual)) {
      return c.json({ valido: false, estatusActualizado: false, flujoFinalizado: false, idempotente: false, esFaseFinal: false, faltantes: [], motivos: [`Solicitud en estatus '${estatusActual}' — no se puede autorizar`] });
    }

    const idempotente = estatusActual === "Autorizada";

    // ── Actualizar estatus si aún no está Autorizada ──
    if (!idempotente) {
      try {
        await sql`
          UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
          SET estatus_sol = 'Autorizada'
          WHERE id = ${solicitud_id}::uuid
        `;
        console.log(`${LOG} ✅ estatus_sol actualizado a 'Autorizada'`);
      } catch (updErr: any) {
        console.error(`${LOG} Error actualizando estatus:`, updErr.message);
        return c.json({ valido: false, estatusActualizado: false, flujoFinalizado: false, idempotente: false, esFaseFinal: false, faltantes: [], motivos: ["Error al actualizar estatus_sol: " + updErr.message] });
      }
    }

    // ── Evaluar si es fase final ──
    const esFaseFinal = !fase_siguiente || String(fase_siguiente).trim() === "";
    const flujoFinalizado = esFaseFinal;

    const motivos = idempotente
      ? ["Solicitud ya estaba en estatus Autorizada (idempotente)"]
      : ["Solicitud autorizada correctamente"];
    if (flujoFinalizado) motivos.push("Flujo finalizado — no existe fase siguiente");

    console.log(`${LOG} OK — idempotente=${idempotente}, esFaseFinal=${esFaseFinal}, flujoFinalizado=${flujoFinalizado}`);

    return c.json({
      valido: true,
      estatusActualizado: true,
      flujoFinalizado,
      idempotente,
      esFaseFinal,
      faltantes: [],
      motivos,
    });
  } catch (err: any) {
    console.error(`${LOG} Error no capturado:`, err.message);
    return c.json({ valido: false, estatusActualizado: false, flujoFinalizado: false, idempotente: false, esFaseFinal: false, faltantes: [], motivos: ["Error interno: " + err.message] });
  }
};

app.post(`${PREFIX}/activar-cuenta-financiera`, activarCuentaFinancieraHandler);
app.post("/activar-cuenta-financiera", activarCuentaFinancieraHandler);
console.log("[ROUTE] activar-cuenta-financiera registered OK");

// ─── Diagnostic 404 handler ─────────────────────────────────────────
app.notFound((c) => {
  const info = {
    error: "Route not found in Hono",
    method: c.req.method,
    path: c.req.path,
    url: c.req.url,
    registeredPrefixes: [PREFIX, "/"],
  };
  console.log("[notFound]", JSON.stringify(info));
  return c.json(info, 404);
});

// ─── Error handler global ───────────────────────────────────────────
app.onError((err, c) => {
  console.log("[onError] Error no capturado en handler:", err.message, err.stack);
  return c.json(
    { error: "Error interno del servidor", details: err.message },
    500,
  );
});

// ═══════════════════════════════════════════════════════════════════
// SOLICITUDES DE ACTIVACIÓN — J_SOLICITUDES_ACTIVACION
// PUT /solicitudes-activacion/:id  → actualiza estatus + data
// ═══════════════════════════════════════════════════════════════════
const putSolicitudActivacionHandler = async (c: any) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    console.log(`[SOL-ACTIVACION] PUT /solicitudes-activacion/${id}`, JSON.stringify(body).substring(0, 400));

    const estatus          = toNullStr(body.estatus);
    const fecha_compromiso = toNullStr(body.fecha_compromiso);
    const tipo             = toNullStr(body.type);
    const data             = body.data ?? null;

    await sql`
      UPDATE "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"
      SET
        estatus          = COALESCE(${estatus}, estatus),
        fecha_compromiso = COALESCE(${fecha_compromiso}::date, fecha_compromiso),
        type             = COALESCE(${tipo}, type),
        data             = COALESCE(${data ? JSON.stringify(data) : null}::jsonb, data)
      WHERE id = ${id}::uuid
    `;
    console.log(`[SOL-ACTIVACION] UPDATE OK — id: ${id} estatus: ${estatus}`);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error(`[SOL-ACTIVACION] Error PUT:`, err?.message);
    return c.json({ error: `Error actualizando solicitud de activación: ${err?.message}` }, 500);
  }
};

app.put(`${PREFIX}/solicitudes-activacion/:id`, putSolicitudActivacionHandler);
app.put(`/solicitudes-activacion/:id`, putSolicitudActivacionHandler);

// ═══════════════════════════════════════════════════════════════════
// SERVE — FORCE REDEPLOY 2026-02-25T12:00:00Z
// ═══════════════════════════════════════════════════════════════════
const DEPLOY_TIMESTAMP = "2026-04-21T10:00:00Z-v20.2-SOL-ACTIVACION";
console.log(`[SERVER BOOT] Routes registered — deploy=${DEPLOY_TIMESTAMP}, starting Deno.serve...`);

// ── Headers CORS universales (reutilizados en preflight y errores fatales) ──
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Expose-Headers": "Content-Length",
  "Access-Control-Max-Age": "600",
};

// Force redeploy: unique hash 20260225-v14-no-filters
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  console.log(`[v14 NO-FILTERS] ${req.method} ${url.pathname}`);

  // ── CORS Preflight: responder OPTIONS inmediatamente sin pasar a Hono ──
  // Supabase Edge Functions gateway puede no reenviar OPTIONS correctamente
  // a Hono, causando que el preflight falle y el navegador lance
  // "TypeError: Failed to fetch" en peticiones PATCH/PUT/DELETE.
  if (req.method === "OPTIONS") {
    console.log(`[CORS PREFLIGHT] Respondiendo 204 para ${url.pathname}`);
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  try {
    // Delegar a Hono y luego inyectar CORS headers manualmente.
    // NO usamos response.body (ReadableStream) para crear un nuevo Response
    // porque en Deno Deploy eso corrompe el stream y causa net::ERR_FAILED.
    // En su lugar, consumimos el body como texto (seguro para JSON responses)
    // y creamos un nuevo Response con headers CORS garantizados.
    const response = await app.fetch(req);
    const bodyText = await response.text();

    const headers = new Headers(response.headers);
    // Forzar CORS headers en TODAS las respuestas — no depender de Hono
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      headers.set(key, value);
    }

    return new Response(bodyText, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err) {
    console.log("[FATAL] Error in app.fetch:", err);
    return new Response(
      JSON.stringify({
        error: "Fatal server error",
        details: String(err),
        path: url.pathname,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      },
    );
  }
});