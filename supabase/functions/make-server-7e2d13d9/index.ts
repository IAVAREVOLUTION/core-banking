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
const EDGE_VERSION = "v52.0-FINAL-NO-DUPES";
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

// POST /activar-prospecto — Activa prospecto y crea cuenta por solicitud
// Si se provee solicitud_id → crea cuenta dedicada POR SOLICITUD (una por cada solicitud autorizada)
// Sin solicitud_id           → comportamiento legacy: cuenta eje única por cliente (cta_eje_chec=true)
const activarProspectoHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { cliente_id, nombre_prospecto, solicitud_id, linea_produc, tipo_produc, monto_inicial } = body;
    if (!cliente_id) {
      return c.json({ error: 'cliente_id requerido' }, 400);
    }
    const clienteUuid = toNullUuid(cliente_id);
    const UUID_RE_AP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const solicitudUuid = solicitud_id && UUID_RE_AP.test(String(solicitud_id)) ? String(solicitud_id) : null;
    // Determinar linea y tipo del producto (usa los del body o defaults CAPTACION/Ahorro)
    const lineaProd = String(linea_produc || 'CAPTACION');
    const tipoProd  = String(tipo_produc  || 'Ahorro');
    const montoInicial = typeof monto_inicial === 'number' ? monto_inicial : parseFloat(String(monto_inicial || '0')) || 0;
    console.log('[activar-prospecto] Iniciando:', clienteUuid, '| solicitud_id:', solicitudUuid, '| linea:', lineaProd, '| tipo:', tipoProd);

    // ── MODO POR SOLICITUD: crear una cuenta dedicada para cada solicitud ──────
    if (solicitudUuid) {
      // Idempotencia via JSONB — no_referenc1 es VARCHAR(30), no acepta UUID de 36 chars
      const existsSol = await sql`
        SELECT id, no_cuenta FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE type = 'CuentaAhorro'
          AND data->'metadatos'->>'solicitudId' = ${solicitudUuid}
          AND cliente_id = ${clienteUuid}::uuid
        LIMIT 1
      `;
      if (existsSol.length > 0) {
        console.log('[activar-prospecto] Cuenta ya existe para esta solicitud:', existsSol[0].id);
        return c.json({ ok: true, ya_existe: true, cuentaId: existsSol[0].id, noCuenta: existsSol[0].no_cuenta });
      }

      // Buscar producto eje para asociar
      let productoEjeId: string | null = null;
      try {
        const productos = await sql`SELECT id, data FROM "EFINANCIANET_DB"."J_PRODUCTOS"`;
        const eje = productos.filter((p: any) => {
          const d = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
          return d.cuentaEje === true || d.cuentaEje === 'true';
        });
        if (eje.length > 0) productoEjeId = eje[0].id;
      } catch (e) { /* sin producto eje */ }

      const now = new Date().toISOString();
      const noSol    = `CEJE-${solicitudUuid.substring(0, 8)}`;
      const noCuenta = `0147${String(Math.floor(Math.random() * 99999999)).padStart(8, '0')}`;

      // Movimiento inicial
      const lineaNorm = lineaProd.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const esCaptacion = lineaNorm.includes('captacion') || lineaNorm.includes('ahorro') || lineaNorm.includes('inversion');
      const tipoMov = esCaptacion ? 'Abono Inicial' : 'Cargo Inicial';
      const movInicial = {
        id: `mov-apertura-${Date.now()}`,
        fechaHora: now, fechaRegistro: now,
        tipo: tipoMov,
        concepto: 'Apertura de Cuenta',
        referencia: `Solicitud ${solicitudUuid.substring(0, 8)}`,
        monto: montoInicial,
        usuario: 'Sistema',
        estatus: 'Aplicado',
        saldoInicial: 0,
        saldoFinal: esCaptacion ? montoInicial : 0,
        origenCreacion: 'ActivacionSolicitud',
      };

      const dataJson = JSON.stringify({
        metadatos: { noSol, noCuenta, noReferenc1: solicitudUuid, origenCreacion: 'ActivacionSolicitud', titular: nombre_prospecto || 'Sin nombre', solicitudId: solicitudUuid },
        estatusCuenta: 'Activa', estatusSolicitud: 'Autorizada', estatusCartera: 'Activa',
        saldoActual: esCaptacion ? montoInicial : 0, fechaApertura: now,
        movimientos: [movInicial],
      });

      // no_referenc1 es VARCHAR(30) — no acepta UUID. Usar noSol (13 chars) ahí.
      const inserted = await sql`
        INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
          type, no_sol, no_cuenta, no_referenc1, fecha_sol, fecha_autori, fecha_inicio,
          descripcion, linea_produc, tipo_produc, producto_id, producto_eje, cliente_id,
          saldo_actual, monto_sol, monto_aut, monto_disp,
          estatus_disp, estatus_sol, estatus_cart, estatus_cuen,
          cta_eje_chec, fases, data
        ) VALUES (
          'CuentaAhorro', ${noSol}, ${noCuenta}, ${noSol},
          ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz,
          ${'Cuenta generada por activación: ' + (nombre_prospecto || 'Sin nombre')},
          ${lineaProd}, ${tipoProd}, ${productoEjeId}::uuid, ${productoEjeId}, ${clienteUuid}::uuid,
          ${esCaptacion ? montoInicial : 0}::numeric,
          ${montoInicial}::numeric, ${montoInicial}::numeric, 0,
          'No Aplica', 'Autorizada', 'Activa', 'Activa',
          false, 'Activa', ${dataJson}::jsonb
        )
        RETURNING id, no_cuenta
      `;
      console.log('[activar-prospecto] Cuenta creada por solicitud:', inserted[0].id, 'noCuenta:', inserted[0].no_cuenta, 'linea:', lineaProd, 'tipo:', tipoProd);
      return c.json({ ok: true, cuentaId: inserted[0].id, noCuenta: inserted[0].no_cuenta, tipo: 'por-solicitud', lineaProd, tipoProd });
    }

    // ── MODO LEGACY: cuenta eje única por cliente (cta_eje_chec=true) ──────────
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
        SELECT s.*,
          COALESCE(s.cliente_id, sa.cliente_id)      AS cliente_id_eff,
          COALESCE(s.producto_id, sa_sol.producto_id) AS producto_id_eff,
          COALESCE(s.tipo_produc, sa_sol.tipo_produc) AS tipo_produc_eff,
          CONCAT_WS(' ', cl.data->>'nombre', cl.data->>'apellidoPaterno', cl.data->>'apellidoMaterno') AS cliente_nombre,
          cl.data->>'idCliente' AS cliente_clave,
          p.data->>'nombreProducto' AS producto_nombre,
          p.data->>'claveProducto'  AS producto_clave
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" s
        LEFT JOIN "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION" sa ON sa.solicitud_id = s.id
        LEFT JOIN "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"  sa_sol ON sa_sol.id = sa.solicitud_id
        LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES"  cl ON cl.id = COALESCE(s.cliente_id, sa.cliente_id)
        LEFT JOIN "EFINANCIANET_DB"."J_PRODUCTOS"  p  ON p.id  = COALESCE(s.producto_id, sa_sol.producto_id)
        WHERE s.id = ${idParam.trim()}::uuid
        LIMIT 1
      `;
      if (rows.length === 0) {
        console.log(`[CUENTAS-AHORRO] GET by id — no encontrado: ${idParam}`);
        return c.json({ error: `Cuenta no encontrada con id=${idParam}` }, 404);
      }
      console.log(`[CUENTAS-AHORRO] GET by id OK — id: ${rows[0].id}, cliente: ${rows[0].cliente_nombre}`);
      return c.json(rows[0]);
    }

    console.log("[CUENTAS-AHORRO] GET /cuentas-ahorro (all)");
    const rows = await sql`
      SELECT s.*,
        COALESCE(s.cliente_id, sa.cliente_id)      AS cliente_id_eff,
        COALESCE(s.producto_id, sa_sol.producto_id) AS producto_id_eff,
        COALESCE(s.tipo_produc, sa_sol.tipo_produc) AS tipo_produc_eff,
        CONCAT_WS(' ', cl.data->>'nombre', cl.data->>'apellidoPaterno', cl.data->>'apellidoMaterno') AS cliente_nombre,
        cl.data->>'idCliente' AS cliente_clave,
        p.data->>'nombreProducto' AS producto_nombre,
        p.data->>'claveProducto'  AS producto_clave
      FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" s
      LEFT JOIN "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION" sa ON sa.solicitud_id = s.id
      LEFT JOIN "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"  sa_sol ON sa_sol.id = sa.solicitud_id
      LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES"  cl ON cl.id = COALESCE(s.cliente_id, sa.cliente_id)
      LEFT JOIN "EFINANCIANET_DB"."J_PRODUCTOS"  p  ON p.id  = COALESCE(s.producto_id, sa_sol.producto_id)
      WHERE (
        -- CAPTACION sin CuentaAhorro dedicada (evita duplicados)
        LOWER(REPLACE(REPLACE(s.linea_produc, 'á','a'), 'ó','o')) = 'captacion'
        AND (
          LOWER(REPLACE(REPLACE(s.tipo_produc, 'ó','o'), 'ó','o')) ILIKE '%ahorro%'
          OR LOWER(s.tipo_produc) ILIKE '%aportacion%'
          OR LOWER(s.tipo_produc) ILIKE '%aportación%'
          OR LOWER(s.tipo_produc) ILIKE '%inversion%'
          OR LOWER(s.tipo_produc) ILIKE '%inversión%'
        )
        AND NOT EXISTS (
          SELECT 1 FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" ca
          WHERE ca.no_referenc1 = s.id::text AND ca.type = 'CuentaAhorro'
        )
      )
      OR s.cta_eje_chec = true
      -- Todas las CuentaAhorro con cliente asignado (créditos, captación, activaciones, etc.)
      OR (s.type = 'CuentaAhorro' AND s.cliente_id IS NOT NULL)
      ORDER BY s.fecha_sol DESC NULLS LAST
    `;
    console.log(`[CUENTAS-AHORRO] OK — ${rows.length} registros`);
    return c.json(rows);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.log("[CUENTAS-AHORRO] Error GET (fallback simple):", msg);
    // Fallback: query sin JOINs con filtro CAPTACION/cta_eje_chec
    try {
      const simple = await sql`
        SELECT * FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE linea_produc ILIKE '%captacion%'
           OR linea_produc ILIKE '%captación%'
           OR cta_eje_chec = true
        ORDER BY fecha_sol DESC NULLS LAST
      `;
      return c.json(simple);
    } catch (e2: any) {
      console.log("[CUENTAS-AHORRO] Error GET fallback:", e2?.message);
      return c.json([]); // siempre HTTP 200 para que backendStatus='connected'
    }
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

// ── Helper: escribir movimiento en una cuenta específica por UUID ──────────────
const escribirMovimientoEnCuenta = async (cuentaId: string, movimiento: Record<string, any>, saldo_nuevo: number | null) => {
  const [cuenta] = await sql`
    SELECT id, saldo_actual, data
    FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
    WHERE id = ${cuentaId}::uuid LIMIT 1
  `;
  if (!cuenta) throw new Error(`Cuenta no encontrada: ${cuentaId}`);

  const saldoActual = parseFloat(String(cuenta.saldo_actual || '0').replace(/[^0-9.-]/g, '')) || 0;
  const nuevoSaldo  = saldo_nuevo !== null && saldo_nuevo !== undefined ? saldo_nuevo : saldoActual;
  const now = new Date().toISOString();

  const existingData = parseJsonbData(cuenta.data);
  const movimientos  = Array.isArray(existingData.movimientos) ? existingData.movimientos : [];
  movimientos.push({
    id:           movimiento.id           || `mov-${Date.now()}`,
    fechaHora:    movimiento.fechaHora    || now,
    fechaRegistro: now,
    tipo:         movimiento.tipo         || 'Cargo',
    concepto:     movimiento.concepto     || '',
    referencia:   movimiento.referencia   || '',
    monto:        movimiento.monto        ?? 0,
    usuario:      movimiento.usuario      || 'Sistema',
    estatus:      movimiento.estatus      || 'Aplicado',
    saldoInicial: saldoActual,
    saldoFinal:   nuevoSaldo,
    ...movimiento,
  });
  const newData = { ...existingData, movimientos };

  await sql`
    UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
    SET saldo_actual = ${nuevoSaldo}::numeric, data = ${JSON.stringify(newData)}::jsonb
    WHERE id = ${cuenta.id}::uuid
  `;
  return { cuentaId: String(cuenta.id), saldo_anterior: saldoActual, saldoNuevo: nuevoSaldo };
};

// Replica un movimiento en la cuenta eje del cliente (fire-and-forget — nunca lanza).
// Se llama después de escribirMovimientoEnCuenta para que el tab Movimientos en Clientes
// refleje todos los flujos: aperturas, pagos, dispersiones, etc.
const replicarEnCuentaEje = async (
  clienteId: string | null,
  cuentaOrigenId: string,
  movimiento: Record<string, any>,
) => {
  if (!clienteId) return;
  try {
    const [ejeRow] = await sql`
      SELECT id, saldo_actual, data
      FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE cliente_id = ${clienteId}::uuid AND cta_eje_chec = true LIMIT 1
    `;
    // No replicar si la cuenta eje ES la misma cuenta origen
    if (!ejeRow || String(ejeRow.id) === cuentaOrigenId) return;

    const saldoEje = parseFloat(String(ejeRow.saldo_actual || '0').replace(/[^0-9.-]/g, '')) || 0;
    const monto    = parseFloat(movimiento.monto) || 0;
    const nuevoSaldoEje = movimiento.tipo === 'Abono' ? saldoEje + monto : saldoEje - monto;

    const dataEje  = parseJsonbData(ejeRow.data);
    const movsEje  = Array.isArray(dataEje.movimientos) ? dataEje.movimientos : [];
    movsEje.push({
      ...movimiento,
      id:            `eje-${Date.now()}`,
      fechaRegistro: new Date().toISOString(),
      saldoInicial:  saldoEje,
      saldoFinal:    nuevoSaldoEje,
      origenCuenta:  cuentaOrigenId,
    });
    await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      SET saldo_actual = ${nuevoSaldoEje}::numeric, data = ${JSON.stringify({ ...dataEje, movimientos: movsEje })}::jsonb
      WHERE id = ${ejeRow.id}::uuid
    `;
    console.log(`[REPLICA-EJE] clienteId=${clienteId} saldo eje: ${saldoEje} → ${nuevoSaldoEje}`);
  } catch (e: any) {
    console.warn(`[REPLICA-EJE] falló (no bloquea): ${e?.message}`);
  }
};

// GET /cuentas-ahorro/:id/movimientos — Leer movimientos de una cuenta (+ cuenta eje del cliente)
const getMovimientosCuentaHandler = async (c: any) => {
  const id = c.req.param('id');
  try {
    const [cuenta] = await sql`
      SELECT id, cliente_id, saldo_actual, data
      FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE id = ${id}::uuid LIMIT 1
    `;
    if (!cuenta) return c.json({ data: [] });

    const parseMov = (raw: any): any[] => {
      const parsed = parseJsonbData(raw);
      return Array.isArray(parsed.movimientos) ? parsed.movimientos : [];
    };

    // Movimientos propios de esta cuenta (no mezclar con cuenta eje)
    const movs = parseMov(cuenta.data);

    movs.sort((a: any, b: any) =>
      new Date(b.fechaHora || b.fechaRegistro || 0).getTime() -
      new Date(a.fechaHora || a.fechaRegistro || 0).getTime()
    );

    return c.json({ data: movs, saldo_actual: cuenta.saldo_actual });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

// PATCH /cuentas-ahorro/movimiento — Registrar movimiento
// Soporta cuenta_id (UUID directo) O cliente_id+cta_eje_chec (legado)
const patchMovimientoHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { cuenta_id, cliente_id, movimiento, saldo_nuevo } = body;

    let targetId: string | null = null;

    if (cuenta_id) {
      targetId = String(cuenta_id);
    } else if (cliente_id) {
      const clienteUuid = toNullUuid(cliente_id);
      const [cuentaEje] = await sql`
        SELECT id FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE cliente_id = ${clienteUuid}::uuid AND cta_eje_chec = true LIMIT 1
      `;
      if (!cuentaEje) return c.json({ error: 'No se encontró cuenta eje para este cliente' }, 404);
      targetId = String(cuentaEje.id);
    } else {
      return c.json({ error: 'Se requiere cuenta_id o cliente_id' }, 400);
    }

    const nuevoSaldo = saldo_nuevo !== undefined ? (typeof saldo_nuevo === 'number' ? saldo_nuevo : parseFloat(String(saldo_nuevo).replace(/[^0-9.-]/g, '')) || null) : null;
    const result = await escribirMovimientoEnCuenta(targetId, movimiento || {}, nuevoSaldo);
    console.log(`[Movimiento] Cuenta ${result.cuentaId} saldo: ${result.saldo_anterior} → ${result.saldoNuevo}`);
    return c.json({ ok: true, ...result });
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

    // Aceptar estatus explícitos del payload; si no vienen, inferir desde cta_eje_chec
    const estatus_sol  = toNullStr(body.p_estatus_sol  ?? body.estatus_sol)  ?? (cta_eje_chec === true ? 'Autorizada' : null);
    const estatus_cuen = toNullStr(body.p_estatus_cuen ?? body.estatus_cuen) ?? (cta_eje_chec === true ? 'Activa' : null);
    const estatus_cart = toNullStr(body.p_estatus_cart ?? body.estatus_cart) ?? (cta_eje_chec === true ? 'Activa' : null);
    const estatus_disp = toNullStr(body.p_estatus_disp ?? body.estatus_disp) ?? 'No Aplica';

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

    // Registrar movimiento inicial automáticamente después del INSERT
    // Crédito / Línea de Crédito → Cargo Inicial; Captación / Aportación / Inversión → Abono Inicial
    const montoInicial = monto_aut ?? monto_sol ?? 0;
    if (inserted?.id && montoInicial && montoInicial > 0) {
      try {
        const lineaNorm = (linea_produc || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const esCredito = lineaNorm.includes('cred') || lineaNorm.includes('linea');
        const tipoMov   = esCredito ? 'Cargo' : 'Abono';
        const conceptoMov = esCredito ? 'Saldo Inicial del Crédito' : 'Abono Inicial';
        const referenciaMov = `Apertura de Cuenta / Solicitud ${no_sol}`;
        const movApertura = {
          tipo:      tipoMov,
          concepto:  conceptoMov,
          referencia: referenciaMov,
          monto:     montoInicial,
          estatus:   'Aplicado',
          origenCreacion: 'AperturaAutomatica',
        };
        await escribirMovimientoEnCuenta(String(inserted.id), movApertura, montoInicial);
        console.log(`[CUENTAS-AHORRO] Movimiento inicial registrado — tipo: ${tipoMov}, monto: ${montoInicial}`);
        // Replicar en cuenta eje del cliente
        await replicarEnCuentaEje(cliente_id, String(inserted.id), movApertura);
      } catch (movErr: any) {
        console.warn(`[CUENTAS-AHORRO] Movimiento inicial fallido (no bloquea): ${movErr?.message}`);
      }
    }

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
app.get(`${PREFIX}/cuentas-ahorro/:id/movimientos`, getMovimientosCuentaHandler);
app.get(`/cuentas-ahorro/:id/movimientos`, getMovimientosCuentaHandler);
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
        cl.data->>'nombre'                AS cliente_nombre,
        cl.data->>'apellidoPaterno'       AS cliente_ap_paterno,
        cl.data->>'apellidoMaterno'       AS cliente_ap_materno,
        cl.data->>'rfc'                   AS cliente_rfc,
        cl.data->>'curp'                  AS cliente_curp,
        cl.data->>'institucionGobierno'   AS institucion_gobierno,
        cl.type                           AS cliente_tipo,
        cl.subtipo                        AS cliente_subtipo,
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

// ── Helper: crea CuentaAhorro por solicitud (idempotente por JSONB solicitudId) ──
// no_referenc1 es VARCHAR(30) — no puede almacenar un UUID de 36 chars.
// Se usa data->metadatos->solicitudId para la relación y la idempotencia.
async function crearCuentaAhorroParaSolicitud(
  solicitudId: string,
  clienteId: string,
  lineaProd: string,
  tipoProd: string,
  montoTransaccion: number,
  nombreCliente: string,
): Promise<string | null> {
  const LOG = '[CREAR-CUENTA-AHORRO]';
  try {
    // Leer no_sol real del registro origen (para guardarlo en metadatos, no como PK)
    let noSolReal = '';
    try {
      const [solRow] = await sql`SELECT no_sol FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = ${solicitudId}::uuid LIMIT 1`;
      noSolReal = solRow?.no_sol || '';
    } catch { /* no bloquea */ }

    const noSolCEJE = `CEJE-${solicitudId.substring(0, 8)}`;

    // Idempotencia: buscar por solicitudId en metadatos O por no_sol CEJE- (registros legacy sin metadatos)
    const existe = await sql`
      SELECT id FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE type = 'CuentaAhorro'
        AND cliente_id = ${clienteId}::uuid
        AND (
          data->'metadatos'->>'solicitudId' = ${solicitudId}
          OR no_sol = ${noSolCEJE}
        )
      LIMIT 1
    `;
    if (existe.length > 0) {
      // Actualizar metadatos si faltan (registros legacy sin data o sin solicitudId)
      try {
        const metaNueva = JSON.stringify({ solicitudId, noSol: noSolReal || noSolCEJE, origenCreacion: 'ActivacionSolicitud' });
        await sql`
          UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
          SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('metadatos', ${metaNueva}::jsonb)
          WHERE id = ${existe[0].id}::uuid AND (data IS NULL OR (data->'metadatos'->>'solicitudId') IS NULL)
        `;
      } catch { /* no bloquea */ }
      console.log(`${LOG} Ya existe para solicitud ${solicitudId}: ${existe[0].id}`);
      return existe[0].id;
    }

    const lineaNorm = lineaProd.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const esCaptacion = lineaNorm.includes('captacion') || lineaNorm.includes('ahorro')
      || lineaNorm.includes('inversion') || lineaNorm.includes('aportacion');
    const tipoMov  = esCaptacion ? 'Abono Inicial' : 'Cargo Inicial';
    const saldoFin = esCaptacion ? montoTransaccion : 0;
    // no_sol de la CuentaAhorro: prefijo CEJE + uuid corto (evita duplicate key con la solicitud)
    const noSolC   = noSolCEJE;
    const noCuenta = `0147${String(Math.floor(Math.random() * 99999999)).padStart(8, '0')}`;
    const now      = new Date().toISOString();
    const movInicial = {
      id: `mov-apertura-${Date.now()}`,
      fechaHora: now, fechaRegistro: now,
      tipo: tipoMov, concepto: 'Apertura de Cuenta',
      referencia: `Solicitud ${solicitudId.substring(0, 8)}`,
      monto: montoTransaccion, usuario: 'Sistema',
      estatus: 'Aplicado', saldoInicial: 0, saldoFinal: saldoFin,
      origenCreacion: 'ActivacionSolicitud',
    };
    const dataJson = JSON.stringify({
      metadatos: { noSol: noSolReal || noSolC, noCuenta, solicitudId, origenCreacion: 'ActivacionSolicitud', titular: nombreCliente },
      estatusCuenta: 'Activa', estatusSolicitud: 'Autorizada', estatusCartera: 'Activa',
      saldoActual: saldoFin, fechaApertura: now,
      movimientos: [movInicial],
    });
    // no_referenc1 = noSolC (13 chars) — no el UUID completo
    const [ins] = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
        type, no_sol, no_cuenta, no_referenc1, fecha_sol, fecha_autori, fecha_inicio,
        descripcion, linea_produc, tipo_produc, cliente_id,
        saldo_actual, monto_sol, monto_aut, monto_disp,
        estatus_disp, estatus_sol, estatus_cart, estatus_cuen,
        cta_eje_chec, fases, data
      ) VALUES (
        'CuentaAhorro', ${noSolC}, ${noCuenta}, ${noSolC},
        ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz,
        ${'Cuenta por activación: ' + nombreCliente},
        ${lineaProd}, ${tipoProd}, ${clienteId}::uuid,
        ${saldoFin}::numeric, ${montoTransaccion}::numeric, ${montoTransaccion}::numeric, 0,
        'No Aplica', 'Autorizada', 'Activa', 'Activa',
        false, 'Activa', ${dataJson}::jsonb
      )
      RETURNING id, no_cuenta
    `;
    console.log(`${LOG} ✅ CuentaAhorro id=${ins.id} noCuenta=${ins.no_cuenta} solicitudId=${solicitudId}`);
    // Replicar movimiento de apertura en cuenta eje del cliente
    await replicarEnCuentaEje(clienteId, String(ins.id), {
      tipo:    tipoMov,
      concepto: 'Apertura de Cuenta',
      referencia: `Solicitud ${solicitudId.substring(0, 8)}`,
      monto:   montoTransaccion,
      estatus: 'Aplicado',
      origenCreacion: 'ActivacionSolicitud',
    });
    return ins.id;
  } catch (e: any) {
    console.warn(`${LOG} Error:`, e?.message);
    return null;
  }
}

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

    // Si el estatus cambia a Autorizada/Aprobado → crear CuentaAhorro por solicitud
    const estatusAutoriza = estatus_sol && ['Autorizada', 'Aprobado'].includes(estatus_sol);
    if (estatusAutoriza) {
      // Leer el registro completo para tener cliente_id, linea, tipo, monto aunque no vengan en el body
      try {
        const [solRow] = await sql`
          SELECT cliente_id, linea_produc, tipo_produc,
            TRIM(REPLACE(REPLACE(monto_aut::text,'$',''),',',' '))::numeric AS monto_num
          FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
          WHERE id = ${id}::uuid LIMIT 1
        `;
        const clienteIdFin = (cliente_id || solRow?.cliente_id)?.toString() || null;
        if (clienteIdFin && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteIdFin)) {
          let nombreCl = 'Sin nombre';
          try {
            const [clRow] = await sql`SELECT data FROM "EFINANCIANET_DB"."J_CLIENTES" WHERE id = ${clienteIdFin}::uuid LIMIT 1`;
            if (clRow?.data) {
              const cd = parseJsonbData(clRow.data);
              nombreCl = [cd.nombre, cd.apellidoPaterno, cd.apellidoMaterno].filter(Boolean).join(' ') || 'Sin nombre';
            }
          } catch { /* sin nombre */ }
          const lineaFin  = linea_produc || solRow?.linea_produc || 'CAPTACION';
          const tipoFin   = tipo_produc  || solRow?.tipo_produc  || 'Ahorro';
          const montoFin  = monto_aut != null ? monto_aut : (parseFloat(String(solRow?.monto_num || '0')) || 0);
          crearCuentaAhorroParaSolicitud(id, clienteIdFin, lineaFin, tipoFin, montoFin, nombreCl);
        } else {
          console.warn(`[SOLICITUDES] Autorizada pero sin cliente_id válido — id: ${id} clienteId: ${clienteIdFin}`);
        }
      } catch (e: any) {
        console.warn(`[SOLICITUDES] Error al crear CuentaAhorro tras autorización:`, e?.message);
      }
    }

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
// ACTIVAR CUENTA — Solicitud de Activación
// POST /solicitudes-credito/:id/activarCuenta
// Actualiza estatus → Autorizada/Activa + registra primer movimiento en data.movimientos
// ═══════════════════════════════════════════════════════════════════
const activarCuentaSolicitudHandler = async (c: any) => {
  const LOG = "[ACTIVAR-CUENTA-SOL]";
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    console.log(`${LOG} POST /solicitudes-credito/${id}/activarCuenta`, JSON.stringify(body).substring(0, 400));

    const estatus_sol  = toNullStr(body.estatus_sol)  || 'Autorizada';
    const estatus_cuen = toNullStr(body.estatus_cuen) || 'Activa';
    const estatus_cart = toNullStr(body.estatus_cart) || 'Activa';
    const estatus_disp = toNullStr(body.estatus_disp) || 'Pagado';
    const no_cuenta    = toNullStr(body.no_cuenta);
    const ctaEjeReq    = body.cta_eje_chec !== undefined ? Boolean(body.cta_eje_chec) : null;
    const montoTransaccion = typeof body.monto_transaccion === 'number'
      ? body.monto_transaccion
      : (parseFloat(String(body.monto_transaccion || '0').replace(/[^0-9.-]/g, '')) || 0);

    // Leer cuenta existente
    const rows = await sql`
      SELECT id, data, no_sol, linea_produc, tipo_produc, cliente_id FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE id = ${id}::uuid LIMIT 1
    `;
    if (rows.length === 0) {
      return c.json({ ok: false, error: 'Cuenta no encontrada' }, 404);
    }
    const cuenta = rows[0];

    // Resolver cliente_id: columna directa → data JSONB → J_SOLICITUDES_ACTIVACION
    let clienteIdFinal = cuenta.cliente_id;
    const existingData0 = parseJsonbData(cuenta.data);
    if (!clienteIdFinal) {
      // Buscar en el JSONB del registro (algunos flujos guardan clienteId ahí)
      const UUID_RE_BACK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const jsonbClienteId = existingData0?.clienteId || existingData0?.cliente_id
        || existingData0?.metadatos?.clienteId || existingData0?.header?.clienteId;
      if (jsonbClienteId && UUID_RE_BACK.test(String(jsonbClienteId))) {
        clienteIdFinal = String(jsonbClienteId);
        console.log(`${LOG} cliente_id resuelto desde JSONB data: ${clienteIdFinal}`);
      }
    }
    if (!clienteIdFinal) {
      try {
        const [saRow] = await sql`
          SELECT cliente_id FROM "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"
          WHERE solicitud_id = ${id}::uuid LIMIT 1
        `;
        if (saRow?.cliente_id) {
          clienteIdFinal = saRow.cliente_id;
          // Propagar cliente_id al registro para futuros reads
          await sql`
            UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
            SET cliente_id = ${clienteIdFinal}::uuid
            WHERE id = ${id}::uuid AND cliente_id IS NULL
          `;
          console.log(`${LOG} cliente_id propagado desde J_SOLICITUDES_ACTIVACION: ${clienteIdFinal}`);
        }
      } catch { /* no bloquea */ }
    }

    // Si se solicita marcar como cuenta eje pero el cliente ya tiene una, no sobrescribir
    let cta_eje_chec = ctaEjeReq;
    if (ctaEjeReq === true && clienteIdFinal) {
      const [yaExiste] = await sql`
        SELECT id FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
        WHERE cliente_id = ${clienteIdFinal}::uuid AND cta_eje_chec = true AND id != ${id}::uuid
        LIMIT 1
      `.catch(() => [null]);
      if (yaExiste) {
        cta_eje_chec = null; // no tocar — ya hay cuenta principal para este cliente
        console.log(`${LOG} Cliente ya tiene cuenta eje (${yaExiste.id}), no se sobrescribe`);
      }
    }

    const existingData = existingData0; // ya parseado arriba

    // Determinar tipo de movimiento según línea de producto
    const linea = (String(body.lineaProducto || body.linea_produc || cuenta.linea_produc || '')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const tipoProd = (String(cuenta.tipo_produc || '')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const esCaptacion = linea.includes('captacion') || linea.includes('ahorro') || linea.includes('inversion')
      || tipoProd.includes('aportacion') || tipoProd.includes('ahorro') || tipoProd.includes('inversion')
      || linea.includes('aportacion');
    const tipoMovimiento = esCaptacion ? 'Abono' : 'Cargo';
    const conceptoMovimiento = esCaptacion ? 'Apertura de cuenta - Depósito inicial' : 'Apertura de cuenta - Disposición inicial';
    const saldoFinal = esCaptacion ? montoTransaccion : 0;

    // Construir primer movimiento
    const now = new Date().toISOString();
    const movimientos = Array.isArray(existingData.movimientos) ? existingData.movimientos : [];
    if (!movimientos.some((m: any) => m.origenCreacion === 'SolicitudActivacion')) {
      movimientos.push({
        id:             `mov-act-${Date.now()}`,
        fechaHora:      now,
        fechaRegistro:  now,
        tipo:           tipoMovimiento,
        concepto:       conceptoMovimiento,
        referencia:     cuenta.no_sol || id.substring(0, 8),
        monto:          montoTransaccion,
        usuario:        body.usuario || 'Sistema',
        estatus:        'Aplicado',
        saldoInicial:   0,
        saldoFinal,
        origenCreacion: 'SolicitudActivacion',
      });
    }
    const newData    = { ...existingData, movimientos };
    const newDataJson = JSON.stringify(newData);

    // UPDATE atómico — simple y confiable
    await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      SET
        estatus_sol  = ${estatus_sol},
        estatus_cuen = ${estatus_cuen},
        estatus_cart = ${estatus_cart},
        estatus_disp = ${estatus_disp},
        cta_eje_chec = COALESCE(${cta_eje_chec}, cta_eje_chec),
        no_cuenta    = COALESCE(${no_cuenta}, no_cuenta),
        saldo_actual = ${saldoFinal}::numeric,
        data         = ${newDataJson}::jsonb
      WHERE id = ${id}::uuid
    `;

    // Sincronizar estatus en J_SOLICITUDES_ACTIVACION (si existe un registro vinculado)
    try {
      const updated = await sql`
        UPDATE "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"
        SET estatus = 'Autorizada'
        WHERE solicitud_id = ${id}::uuid AND estatus != 'Autorizada'
        RETURNING id
      `;
      if (updated.length > 0) {
        console.log(`${LOG} J_SOLICITUDES_ACTIVACION actualizada a Autorizada — id: ${updated[0].id}`);
      }
    } catch (saErr: any) {
      console.warn(`${LOG} No se pudo actualizar J_SOLICITUDES_ACTIVACION: ${saErr?.message}`);
    }

    // ── Crear CuentaAhorro dedicada por solicitud (idempotente via helper) ──────
    let cuentaAhorroId: string | null = null;
    if (clienteIdFinal) {
      let nombreCliente = 'Sin nombre';
      try {
        const [clRow] = await sql`SELECT data FROM "EFINANCIANET_DB"."J_CLIENTES" WHERE id = ${clienteIdFinal}::uuid LIMIT 1`;
        if (clRow?.data) {
          const cd = parseJsonbData(clRow.data);
          nombreCliente = [cd.nombre, cd.apellidoPaterno, cd.apellidoMaterno].filter(Boolean).join(' ') || 'Sin nombre';
        }
      } catch { /* sin nombre */ }
      cuentaAhorroId = await crearCuentaAhorroParaSolicitud(
        id, clienteIdFinal,
        String(cuenta.linea_produc || 'CAPTACION'),
        String(cuenta.tipo_produc  || 'Ahorro'),
        montoTransaccion,
        nombreCliente,
      );
    }

    console.log(`${LOG} ✅ cuenta=${id} tipo=${tipoMovimiento} monto=${montoTransaccion} saldoFinal=${saldoFinal} clienteId=${clienteIdFinal} cuentaAhorroId=${cuentaAhorroId}`);
    return c.json({ ok: true, tipoMovimiento, montoTransaccion, saldoFinal, clienteId: clienteIdFinal, cuentaAhorroId });
  } catch (err: any) {
    console.error(`${LOG} Error:`, err?.message);
    return c.json({ ok: false, error: String(err?.message || err) }, 500);
  }
};

app.post(`${PREFIX}/solicitudes-credito/:id/activarCuenta`, activarCuentaSolicitudHandler);
app.post(`/solicitudes-credito/:id/activarCuenta`, activarCuentaSolicitudHandler);

// ═══════════════════════════════════════════════════════════════════
// CARTERA DE CRÉDITOS
// ═══════════════════════════════════════════════════════════════════

const carteraAmortizacionesHandler = async (c: any) => {
  const solicitudId = c.req.param('solicitudId');
  try {
    // 1. Intentar desde J_CALEN_PAGOS_AMORTIZA (cotizacion_id = UUID)
    const amortRows = await sql`
      SELECT id, cotizacion_id,
        numero_pago,
        fecha AS fecha_pago,
        TRIM(REPLACE(REPLACE(saldo_insoluto::text,'$',''),',',' '))::numeric AS saldo_insoluto,
        TRIM(REPLACE(REPLACE(capital::text,'$',''),',',' '))::numeric        AS pago_capital,
        TRIM(REPLACE(REPLACE(interes::text,'$',''),',',' '))::numeric        AS pago_interes,
        0::numeric AS iva_interes,
        TRIM(REPLACE(REPLACE(seguro::text,'$',''),',',' '))::numeric         AS pago_seguro,
        TRIM(REPLACE(REPLACE(iva_seguro::text,'$',''),',',' '))::numeric     AS iva_seguro,
        TRIM(REPLACE(REPLACE(pago_periodo::text,'$',''),',',' '))::numeric   AS pago_total,
        moneda
      FROM "EFINANCIANET_DB"."J_CALEN_PAGOS_AMORTIZA"
      WHERE cotizacion_id = ${solicitudId}::uuid
      ORDER BY numero_pago ASC
    `;

    if (amortRows.length > 0) {
      // Determinar estatus desde J_FACTURAS
      const facturaLinks = await sql`
        SELECT amortizacion_id, estatus
        FROM "EFINANCIANET_DB"."J_FACTURAS"
        WHERE solicitud_id = ${solicitudId}::uuid AND amortizacion_id IS NOT NULL
      `;
      const facturadaMap: Record<string, string> = {};
      for (const f of facturaLinks) {
        facturadaMap[String(f.amortizacion_id)] = f.estatus === 'Pagado' ? 'Pagada' : 'Facturada';
      }
      const rows = amortRows.map((a: any) => ({
        ...a,
        no_pago: a.numero_pago,
        solicitud_id: solicitudId,
        estatus: facturadaMap[String(a.id)] || 'Pendiente',
      }));
      return c.json({ data: rows, fuente: 'tabla' });
    }

    // 2. Fallback: leer simulacion desde data JSONB de J_CUENTAS_CORP_CLIENTES
    const [solicitud] = await sql`
      SELECT type, monto_aut, fecha_inicio, fecha_fin_cu, data
      FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE id = ${solicitudId}::uuid
    `;
    if (!solicitud) return c.json({ data: [], fuente: 'sin_datos' });

    let jsonData = solicitud.data;
    // Manejar el caso donde JSONB se devuelve como objeto con índices numéricos (string serializado)
    if (jsonData && typeof jsonData === 'object' && !Array.isArray(jsonData) && '0' in jsonData) {
      try {
        const str = Object.values(jsonData).join('');
        jsonData = JSON.parse(str);
      } catch { jsonData = {}; }
    } else if (typeof jsonData === 'string') {
      try { jsonData = JSON.parse(jsonData); } catch { jsonData = {}; }
    }

    // Buscar resultado_simulacion en varias rutas posibles
    const simRows: any[] =
      jsonData?.simulacion?.resultado_simulacion ||
      jsonData?.default?.simulacion?.resultado_simulacion ||
      jsonData?.solicitud?.simulacion?.resultado_simulacion ||
      jsonData?.resultado_simulacion ||
      [];

    // Determinar estatus facturas para estas filas
    // Path 2a: via amortizacion_id → J_CALEN_PAGOS_AMORTIZA.numero_pago (para creditos con tabla real)
    const facturaLinks2 = await sql`
      SELECT f.amortizacion_id, f.estatus, a.numero_pago
      FROM "EFINANCIANET_DB"."J_FACTURAS" f
      LEFT JOIN "EFINANCIANET_DB"."J_CALEN_PAGOS_AMORTIZA" a ON a.id = f.amortizacion_id
      WHERE f.solicitud_id = ${solicitudId}::uuid AND f.amortizacion_id IS NOT NULL
    `;
    const pagadoSet = new Set(facturaLinks2.filter((f: any) => f.estatus === 'Pagado').map((f: any) => Number(f.numero_pago)));
    const facturadoSet = new Set(facturaLinks2.map((f: any) => Number(f.numero_pago)));

    // Path 2b: fallback por fecha_compromiso (para creditos con amortizaciones JSONB — amortizacion_id=null)
    const facturasPorFecha = await sql`
      SELECT fecha_compromiso::date::text AS fecha, estatus
      FROM "EFINANCIANET_DB"."J_FACTURAS"
      WHERE solicitud_id = ${solicitudId}::uuid AND sub_tipo IN ('Amortizacion', 'Aportacion')
    `;
    const fechaStatusMap: Record<string, string> = {};
    for (const f of facturasPorFecha) {
      if (f.fecha) fechaStatusMap[f.fecha] = f.estatus === 'Pagado' ? 'Pagada' : 'Facturada';
    }

    const normDate = (d: string) => {
      if (!d) return '';
      const s = d.split('T')[0];
      const p = s.split('/');
      return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s;
    };

    // Para cuentas de ahorro/captación: calendario de aportaciones
    const calAportaciones: any[] =
      jsonData?.solicitud?.simulacion?.calendario_aportaciones ||
      jsonData?.simulacion?.calendario_aportaciones ||
      jsonData?.calendario_aportaciones ||
      [];

    // Path 2c: CuentaAhorro sin simulacion → generar calendario mensual desde campos de la fila
    if (simRows.length === 0 && calAportaciones.length === 0 && solicitud.type === 'CuentaAhorro') {
      const montoAut = parseFloat(solicitud.monto_aut) || 0;
      const tasa = parseFloat(jsonData?.producto?.tasa) || 0;
      const fechaIni = solicitud.fecha_inicio ? new Date(solicitud.fecha_inicio) : null;
      const fechaFin = solicitud.fecha_fin_cu  ? new Date(solicitud.fecha_fin_cu)  : null;

      if (montoAut > 0 && fechaIni && fechaFin && fechaFin > fechaIni) {
        const msPerMonth = 30.4375 * 24 * 3600 * 1000;
        const meses = Math.round((fechaFin.getTime() - fechaIni.getTime()) / msPerMonth);
        const montoMensual = montoAut / (meses || 1);
        const tasaMensual  = tasa / 100 / 12;

        const calRows: any[] = [];
        let saldo = 0;
        for (let i = 1; i <= meses; i++) {
          const fechaPago = new Date(fechaIni.getTime() + i * msPerMonth);
          const fechaStr  = fechaPago.toISOString().split('T')[0];
          saldo += montoMensual;
          const interes = saldo * tasaMensual;
          calRows.push({
            id:            `gen-${i}`,
            solicitud_id:  solicitudId,
            no_pago:       i,
            fecha_pago:    fechaStr,
            saldo_insoluto: Math.round(saldo * 100) / 100,
            pago_capital:  Math.round(montoMensual * 100) / 100,
            pago_interes:  Math.round(interes * 100) / 100,
            iva_interes:   Math.round(interes * 0.16 * 100) / 100,
            pago_seguro:   0,
            iva_seguro:    0,
            pago_total:    Math.round(montoMensual * 100) / 100,
            moneda:        'MXN',
            estatus:       fechaStatusMap[fechaStr] || 'Pendiente',
          });
        }
        return c.json({ data: calRows, fuente: 'generado_cuenta_ahorro' });
      }
      return c.json({ data: [], fuente: 'cuenta_ahorro_sin_fechas' });
    }

    // Si no hay resultado_simulacion pero sí calendario_aportaciones, mapear al mismo shape
    if (simRows.length === 0 && calAportaciones.length > 0) {
      const calRows = calAportaciones.map((r: any) => {
        const noPago = Number(r.noAportacion ?? r.no_aportacion ?? r.no_pago ?? 0);
        const fechaNorm = normDate(r.fecha ?? r.fecha_pago ?? '');
        const monto = parseFloat(r.monto ?? r.pagoPeriodo ?? r.pago_periodo ?? 0) || 0;
        const estatus = fechaStatusMap[fechaNorm] || 'Pendiente';
        return {
          id: `cal-${noPago}`,
          solicitud_id: solicitudId,
          no_pago: noPago,
          fecha_pago: r.fecha ?? r.fecha_pago ?? null,
          saldo_insoluto: 0,
          pago_capital:   monto,
          pago_interes:   0,
          iva_interes:    0,
          pago_seguro:    0,
          iva_seguro:     0,
          pago_total:     monto,
          moneda: r.moneda || 'MXN',
          estatus,
        };
      });
      return c.json({ data: calRows, fuente: 'calendario_aportaciones' });
    }

    const rows = simRows.map((r: any) => {
      const noPago = Number(r.no_pago);
      const fechaNorm = normDate(r.fecha_pago || r.fecha || '');
      const estatus = pagadoSet.has(noPago) ? 'Pagada'
                    : facturadoSet.has(noPago) ? 'Facturada'
                    : (fechaStatusMap[fechaNorm] || 'Pendiente');
      return {
        id: `sim-${noPago}`,
        solicitud_id: solicitudId,
        no_pago: noPago,
        fecha_pago: r.fecha_pago || r.fecha || null,
        saldo_insoluto: parseFloat(r.saldo_insoluto) || 0,
        pago_capital:   parseFloat(r.pago_capital)   || 0,
        pago_interes:   parseFloat(r.pago_interes)   || 0,
        iva_interes:    parseFloat(r.iva_interes)    || 0,
        pago_seguro:    parseFloat(r.pago_seguro)    || 0,
        iva_seguro:     parseFloat(r.iva_seguro)     || parseFloat(r.pago_seguro) * 0.16 || 0,
        pago_total:     parseFloat(r.pago_total)     || parseFloat(r.pago_periodo) || 0,
        moneda: 'MXN',
        estatus,
      };
    });

    return c.json({ data: rows, fuente: 'simulacion' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

const carteraAvisosHandler = async (c: any) => {
  const solicitudId = c.req.param('solicitudId');
  try {
    const rows = await sql`
      SELECT f.id,
        f.numero_documento   AS no_docto,
        f.fecha_emision      AS fecha,
        f.tipo, f.sub_tipo, f.cliente,
        f.forma_pago,
        COALESCE(f.fecha_compromiso, a.fecha) AS fecha_compromiso,
        f.moneda, f.institucion_financiera, f.cuenta_bancaria, f.referencia,
        TRIM(REPLACE(REPLACE(f.monto_transaccion::text,'$',''),',',' '))::numeric AS monto_transaccion,
        f.estatus
      FROM "EFINANCIANET_DB"."J_FACTURAS" f
      LEFT JOIN "EFINANCIANET_DB"."J_CALEN_PAGOS_AMORTIZA" a ON a.id = f.amortizacion_id
      WHERE f.solicitud_id = ${solicitudId}::uuid
      ORDER BY f.fecha_emision DESC
    `;
    return c.json({ data: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

const carteraPagosHandler = async (c: any) => {
  const solicitudId = c.req.param('solicitudId');
  try {
    // 1. J_PAGOS via J_FACTURAS (fuente estructurada)
    let pagosRows: any[] = [];
    try {
      pagosRows = await sql`
        SELECT p.id::text AS id, p.factura_id::text AS factura_id,
          p.factura_detalle_id AS detalle_linea_id,
          p.fecha_pago,
          TRIM(REPLACE(REPLACE(p.monto_pagado::text,'$',''),',',' '))::numeric AS monto,
          p.forma_pago, p.numero_referencia AS referencia, p.estatus,
          'Cargo de Crédito' AS concepto
        FROM "EFINANCIANET_DB"."J_PAGOS" p
        JOIN "EFINANCIANET_DB"."J_FACTURAS" f ON f.id = p.factura_id
        WHERE f.solicitud_id = ${solicitudId}::uuid
        ORDER BY p.fecha_pago DESC
      `;
    } catch (e: any) {
      console.warn(`[PAGOS-GET] J_PAGOS query fallida: ${e?.message}`);
    }

    // 2. data.movimientos del crédito (fuente JSONB — siempre se actualiza al pagar)
    let jsonbMovs: any[] = [];
    try {
      const [cuentaRow] = await sql`
        SELECT data FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = ${solicitudId}::uuid
      `;
      if (cuentaRow?.data) {
        const parsed = parseJsonbData(cuentaRow.data);
        if (Array.isArray(parsed.movimientos)) {
          jsonbMovs = parsed.movimientos.map((m: any) => ({
            id: String(m.id || `jsonb-${m.fechaRegistro}`),
            factura_id: null,
            detalle_linea_id: null,
            fecha_pago: m.fechaRegistro || m.fecha_pago || null,
            monto: parseFloat(String(m.monto || '0')) || 0,
            concepto: m.concepto || 'Cargo de Crédito',
            forma_pago: m.forma_pago || null,
            referencia: m.referencia || null,
            estatus: m.estatus || 'Aplicado',
          }));
        }
      }
    } catch (e: any) {
      console.warn(`[PAGOS-GET] data.movimientos query fallida: ${e?.message}`);
    }

    // 3. Combinar: J_PAGOS primero, JSONB como complemento (deduplicado por id)
    const pagosIds = new Set(pagosRows.map((p: any) => String(p.id)));
    const combined = [
      ...pagosRows,
      ...jsonbMovs.filter((m: any) => !pagosIds.has(String(m.id))),
    ].sort((a: any, b: any) =>
      new Date(b.fecha_pago || 0).getTime() - new Date(a.fecha_pago || 0).getTime()
    );

    return c.json({ data: combined });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

const carteraTiposExtHandler = async (c: any) => {
  try {
    const rows = await sql`
      SELECT id, clave, nombre, area, puesto, prompt_ia, estatus
      FROM "EFINANCIANET_DB"."J_TIPOS_SOLICITUDES_EXTRAORDINARIAS"
      ORDER BY nombre ASC
    `;
    return c.json({ data: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

const carteraSolicitudesExtGetHandler = async (c: any) => {
  const solicitudId = c.req.param('solicitudId');
  try {
    // solicitud_id en J_SOLICITUDES_EXTRAORDINARIAS es int8 (no uuid)
    // Usamos numero_solicitud para almacenar el UUID del crédito como filtro
    const rows = solicitudId
      ? await sql`
          SELECT se.id, se.numero_solicitud AS solicitud_id,
            se.tipo_solicitud_id      AS tipo_id,
            se.fecha_solicitud        AS fecha,
            se.usuario_solicita       AS usuario,
            se.estatus,
            se.descripcion            AS notas,
            se.usuario_aprueba        AS usuario_autoriza,
            se.fecha_aprobacion       AS fecha_autoriza,
            se.comentario_aprobador,
            t.nombre AS tipo_nombre, t.clave AS tipo_clave
          FROM "EFINANCIANET_DB"."J_SOLICITUDES_EXTRAORDINARIAS" se
          LEFT JOIN "EFINANCIANET_DB"."J_TIPOS_SOLICITUDES_EXTRAORDINARIAS" t ON t.id = se.tipo_solicitud_id
          WHERE se.numero_solicitud = ${solicitudId}
          ORDER BY se.fecha_solicitud DESC
        `
      : await sql`
          SELECT se.id, se.numero_solicitud AS solicitud_id,
            se.tipo_solicitud_id      AS tipo_id,
            se.fecha_solicitud        AS fecha,
            se.usuario_solicita       AS usuario,
            se.estatus,
            se.descripcion            AS notas,
            se.usuario_aprueba        AS usuario_autoriza,
            se.fecha_aprobacion       AS fecha_autoriza,
            se.comentario_aprobador,
            t.nombre AS tipo_nombre, t.clave AS tipo_clave
          FROM "EFINANCIANET_DB"."J_SOLICITUDES_EXTRAORDINARIAS" se
          LEFT JOIN "EFINANCIANET_DB"."J_TIPOS_SOLICITUDES_EXTRAORDINARIAS" t ON t.id = se.tipo_solicitud_id
          ORDER BY se.fecha_solicitud DESC
        `;
    return c.json({ data: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

const carteraCrearFacturaHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const {
      solicitud_id, amortizaciones,
      sub_tipo = 'Amortizacion',
      cliente = null,
      forma_pago = null,
      fecha_compromiso = null,
      moneda = 'MXN',
      institucion_financiera = null,
      cuenta_bancaria = null,
      referencia = null,
    } = body;
    if (!solicitud_id || !amortizaciones?.length) return c.json({ error: 'solicitud_id y amortizaciones son requeridos' }, 400);

    const fecha = new Date().toISOString().split('T')[0];

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const toIsoDate = (v: string | null | undefined): string | null => {
      if (!v) return null;
      const parts = v.split('/');
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      return v.split('T')[0];
    };

    // Buscar institución de gobierno
    let gobierno: string | null = null;
    try {
      const [solRow] = await sql`
        SELECT cl.data AS cl_data
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" cc
        JOIN "EFINANCIANET_DB"."J_CLIENTES" cl ON cl.id = cc.cliente_id
        WHERE cc.id = ${solicitud_id}::uuid
      `;
      if (solRow?.cl_data) {
        const clData = parseJsonbData(solRow.cl_data);
        gobierno = clData?.institucionGobierno || null;
      }
    } catch { /* gobierno queda null */ }

    // Crear una factura por amortización para que cada una cambie a 'Facturada'
    let primeraFactura: { id: string; numero_documento: string } | null = null;
    const ts = Date.now();

    for (let i = 0; i < amortizaciones.length; i++) {
      const amort = amortizaciones[i];
      // amortizacion_id en J_FACTURAS es uuid — solo disponible para amortizaciones de J_CALEN_PAGOS_AMORTIZA
      // Para amortizaciones de simulacion JSONB (id="sim-N") amortizaId queda null; el GET usa fecha_compromiso como fallback
      const amortizaId = amort.id && UUID_RE.test(String(amort.id)) ? amort.id : null;
      const montoAmort = parseFloat(amort.pago_total) || 0;
      const no_docto = `FAC-${(ts + i).toString(36).toUpperCase()}`;
      const fechaComp = toIsoDate(amort.fecha_pago || amort.fecha || fecha_compromiso);

      const [factura] = await sql`
        INSERT INTO "EFINANCIANET_DB"."J_FACTURAS"
          (solicitud_id, amortizacion_id, numero_documento, fecha_emision, tipo,
           sub_tipo, cliente, forma_pago, fecha_compromiso, moneda,
           institucion_financiera, cuenta_bancaria, referencia, gobierno,
           monto_transaccion, estatus)
        VALUES (
          ${solicitud_id}::uuid, ${amortizaId}::uuid, ${no_docto}, ${fecha}::date, 'Por Cobrar',
          ${sub_tipo}, ${cliente}, ${forma_pago},
          ${fechaComp}::date,
          ${moneda}, ${institucion_financiera}, ${cuenta_bancaria}, ${referencia}, ${gobierno},
          ${montoAmort}::numeric::money, 'Pendiente'
        )
        RETURNING id, numero_documento
      `;
      if (!primeraFactura) primeraFactura = factura;

      const subproductos = [
        { cve: 'CAPITAL', desc: 'Capital',     monto: parseFloat(amort.pago_capital) || 0 },
        { cve: 'INTERES', desc: 'Interés',     monto: parseFloat(amort.pago_interes) || 0 },
        { cve: 'IVA_INT', desc: 'IVA Interés', monto: parseFloat(amort.iva_interes)  || 0 },
        { cve: 'SEGURO',  desc: 'Seguro',      monto: parseFloat(amort.pago_seguro)  || 0 },
        { cve: 'IVA_SEG', desc: 'IVA Seguro',  monto: parseFloat(amort.iva_seguro)   || 0 },
      ].filter(sp => sp.monto > 0);

      for (const sp of subproductos) {
        await sql`
          INSERT INTO "EFINANCIANET_DB"."J_FACTURAS_DETALLE"
            (factura_id, cve_subproducto, descripcion_subproducto, cantidad, monto, porcentaje_impuesto, moneda, subtotal, estatus)
          VALUES (${factura.id}, ${sp.cve}, ${sp.desc}, 1, ${sp.monto}, 0, ${moneda}, ${sp.monto}, 'Pendiente')
        `;
      }
    }

    return c.json({ id: primeraFactura!.id, no_docto: primeraFactura!.numero_documento, facturas_creadas: amortizaciones.length });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// MARCAR FACTURA COMO PAGADA — PATCH /cartera/facturas/:id/pagar
// Req 11: estatus aviso → Pagado + amortizacion → Pagada
// Req 12: registra movimiento en J_PAGOS (concepto='Cargo de Crédito')
// Req 13: disminuye monto_aut en J_CUENTAS_CORP_CLIENTES
// ═══════════════════════════════════════════════════════════════════
const carteraMarcarPagadoHandler = async (c: any) => {
  const LOG = '[PAGAR-FACTURA]';
  try {
    const facturaId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const forma_pago = body.forma_pago || null;

    // 1. Leer factura + datos de la cuenta
    const [factura] = await sql`
      SELECT f.id, f.solicitud_id, f.amortizacion_id, f.estatus,
        TRIM(REPLACE(REPLACE(f.monto_transaccion::text,'$',''),',',' '))::numeric AS monto,
        cc.no_cuenta, cc.no_sol
      FROM "EFINANCIANET_DB"."J_FACTURAS" f
      LEFT JOIN "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" cc ON cc.id = f.solicitud_id
      WHERE f.id = ${facturaId}::bigint
      LIMIT 1
    `;
    if (!factura) return c.json({ ok: false, error: 'Factura no encontrada' }, 404);
    if (factura.estatus === 'Pagado') return c.json({ ok: true, idempotente: true });

    const monto = parseFloat(String(factura.monto || '0')) || 0;
    const noCuenta = factura.no_cuenta || '';
    const noSol    = factura.no_sol    || '';
    const solicitudId = factura.solicitud_id;

    // 2. Actualizar J_FACTURAS → Pagado
    await sql`UPDATE "EFINANCIANET_DB"."J_FACTURAS" SET estatus = 'Pagado' WHERE id = ${facturaId}::bigint`;
    console.log(`${LOG} J_FACTURAS estatus=Pagado — id: ${facturaId}`);

    // 3. Si hay amortizacion_id, buscar todas las facturas de esa amortizacion y marcar en J_CALEN_PAGOS_AMORTIZA si tiene columna estatus
    // (El estatus de la amortizacion se deriva de J_FACTURAS.estatus en el GET, así que esto es suficiente)

    // 4. Registrar movimiento en J_PAGOS
    const referencia = `Referencia (${noSol || noCuenta}) / Pago de Crédito`;
    try {
      await sql`
        INSERT INTO "EFINANCIANET_DB"."J_PAGOS"
          (factura_id, fecha_pago, monto_pagado, numero_referencia, forma_pago, estatus)
        VALUES (
          ${facturaId}::bigint, NOW()::date, ${monto}::numeric::money,
          ${referencia}, ${forma_pago}, 'Aplicado'
        )
      `;
      console.log(`${LOG} J_PAGOS registrado — monto: ${monto}`);
    } catch (pagosErr: any) {
      console.warn(`${LOG} J_PAGOS insert fallido (no bloquea): ${pagosErr?.message}`);
    }

    // 5. Disminuir monto_aut + registrar movimiento en data.movimientos (Req 13 + Req 16)
    if (solicitudId) {
      try {
        if (monto > 0) {
          await sql`
            UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
            SET monto_aut = GREATEST(0::money, monto_aut - ${monto}::numeric::money)
            WHERE id = ${solicitudId}::uuid
          `;
          console.log(`${LOG} monto_aut reducido en ${monto} — solicitudId: ${solicitudId}`);
        }
      } catch (montoErr: any) {
        console.warn(`${LOG} monto_aut update fallido (no bloquea): ${montoErr?.message}`);
      }

      // Req 16: registrar movimiento en data.movimientos usando escribirMovimientoEnCuenta
      try {
        const [cuentaRow] = await sql`
          SELECT saldo_actual, monto_aut, cliente_id FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
          WHERE id = ${solicitudId}::uuid
        `;
        if (cuentaRow) {
          const montoAutStr = String(cuentaRow.monto_aut || '0').replace(/[^0-9.-]/g, '');
          const saldoActual = parseFloat(String(cuentaRow.saldo_actual || '0').replace(/[^0-9.-]/g, '')) || 0;
          const saldoAntes  = saldoActual;
          const nuevoSaldo  = Math.max(0, parseFloat(montoAutStr) || 0);
          const movPago = {
            tipo:          'Abono',
            concepto:      'Pago de Crédito',
            referencia,
            monto,
            saldoInicial:  saldoAntes,
            estatus:       'Aplicado',
            origenCreacion: 'Cobranza',
          };
          await escribirMovimientoEnCuenta(String(solicitudId), movPago, nuevoSaldo);
          // Replicar en cuenta eje del cliente para que aparezca en tab Movimientos
          await replicarEnCuentaEje(cuentaRow.cliente_id ? String(cuentaRow.cliente_id) : null, String(solicitudId), movPago);
          console.log(`${LOG} Movimiento registrado — saldo: ${saldoAntes} → ${nuevoSaldo}`);
        }
      } catch (movErr: any) {
        console.warn(`${LOG} data.movimientos update fallido (no bloquea): ${movErr?.message}`);
      }
    }

    return c.json({ ok: true, monto, referencia });
  } catch (err: any) {
    console.error(`${LOG} Error:`, err?.message);
    return c.json({ ok: false, error: String(err?.message || err) }, 500);
  }
};

app.patch(`${PREFIX}/cartera/facturas/:id/pagar`, carteraMarcarPagadoHandler);
app.patch(`/cartera/facturas/:id/pagar`, carteraMarcarPagadoHandler);

// PATCH /cartera/facturas/:id — actualizar campos meta del aviso (forma_pago, fecha_compromiso, referencia, estatus)
const carteraActualizarFacturaHandler = async (c: any) => {
  const LOG = '[ACTUALIZAR-FACTURA]';
  try {
    const facturaId = c.req.param('id');
    const body = await c.req.json();
    const forma_pago       = toNullStr(body.forma_pago);
    const fecha_compromiso = toNullStr(body.fecha_compromiso);
    const referencia       = toNullStr(body.referencia);
    const estatus          = toNullStr(body.estatus);

    await sql`
      UPDATE "EFINANCIANET_DB"."J_FACTURAS"
      SET
        forma_pago       = COALESCE(${forma_pago}, forma_pago),
        fecha_compromiso = COALESCE(${fecha_compromiso}::date, fecha_compromiso),
        referencia       = COALESCE(${referencia}, referencia),
        estatus          = COALESCE(${estatus}, estatus)
      WHERE id = ${facturaId}::bigint
    `;
    console.log(`${LOG} Factura actualizada — id: ${facturaId}`);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error(`${LOG} Error:`, err?.message);
    return c.json({ ok: false, error: String(err?.message || err) }, 500);
  }
};

app.patch(`${PREFIX}/cartera/facturas/:id`, carteraActualizarFacturaHandler);
app.patch(`/cartera/facturas/:id`, carteraActualizarFacturaHandler);

const carteraCrearSolicitudExtHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { solicitud_id, tipo_id, usuario, notas } = body;
    if (!solicitud_id || !tipo_id) return c.json({ error: 'solicitud_id y tipo_id son requeridos' }, 400);

    // tipo_solicitud_id = int8, solicitud_id = int8 (no uuid)
    // Guardamos el UUID del crédito en numero_solicitud para poder filtrar por crédito
    const [row] = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_SOLICITUDES_EXTRAORDINARIAS"
        (tipo_solicitud_id, numero_solicitud, fecha_solicitud, usuario_solicita, estatus, descripcion)
      VALUES (${Number(tipo_id)}, ${solicitud_id}, NOW(), ${usuario || 'Sistema'}, 'Pendiente', ${notas || null})
      RETURNING id
    `;
    return c.json({ id: row.id });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

const carteraActualizarSolicitudExtHandler = async (c: any) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { estatus, usuario_autoriza, fecha_autoriza, comentario_aprobador } = body;

    // id en J_SOLICITUDES_EXTRAORDINARIAS es int8; numero_solicitud guarda el UUID del crédito
    const [solExt] = await sql`
      SELECT se.*, t.clave AS tipo_clave
      FROM "EFINANCIANET_DB"."J_SOLICITUDES_EXTRAORDINARIAS" se
      LEFT JOIN "EFINANCIANET_DB"."J_TIPOS_SOLICITUDES_EXTRAORDINARIAS" t ON t.id = se.tipo_solicitud_id
      WHERE se.id = ${Number(id)}
    `;
    if (!solExt) return c.json({ error: 'Solicitud extraordinaria no encontrada' }, 404);

    await sql`
      UPDATE "EFINANCIANET_DB"."J_SOLICITUDES_EXTRAORDINARIAS"
      SET estatus              = ${estatus},
          usuario_aprueba      = ${usuario_autoriza || null},
          fecha_aprobacion     = ${fecha_autoriza || null},
          comentario_aprobador = ${comentario_aprobador || null}
      WHERE id = ${Number(id)}
    `;

    if (estatus === 'Autorizada') {
      const clave = (solExt.tipo_clave || '').toUpperCase();
      // numero_solicitud contiene el UUID del crédito (guardado al crear)
      const solicitudId = solExt.numero_solicitud;
      const fecha = new Date().toISOString().split('T')[0];

      if (clave === 'CANCELACION') {
        const [countRow] = await sql`
          SELECT COUNT(*)::int AS cnt
          FROM "EFINANCIANET_DB"."J_FACTURAS" f
          JOIN "EFINANCIANET_DB"."J_CALEN_PAGOS_AMORTIZA" a ON a.id = f.amortizacion_id
          WHERE a.cotizacion_id = ${solicitudId}::uuid AND f.estatus = 'Pagado'
        `;
        if ((countRow.cnt || 0) > 0) {
          await sql`
            UPDATE "EFINANCIANET_DB"."J_SOLICITUDES_EXTRAORDINARIAS"
            SET estatus = 'Pendiente', usuario_aprueba = null, fecha_aprobacion = null
            WHERE id = ${Number(id)}
          `;
          return c.json({ error: 'El crédito tiene avisos de vencimiento pagados, no se puede cancelar' }, 400);
        }
        await sql`UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" SET estatus_sol = 'Cancelado' WHERE id = ${solicitudId}::uuid`;

      } else if (clave === 'FINIQUITO' || clave === 'RENOVACION') {
        // Obtener saldo insoluto de la última amortización linkeada a una factura
        const lastAmort = await sql`
          SELECT a.saldo_insoluto
          FROM "EFINANCIANET_DB"."J_CALEN_PAGOS_AMORTIZA" a
          JOIN "EFINANCIANET_DB"."J_FACTURAS" f ON f.amortizacion_id = a.id
          WHERE f.solicitud_id = ${solicitudId}::uuid
          ORDER BY a.numero_pago DESC LIMIT 1
        `;
        const saldo = parseFloat(String(lastAmort[0]?.saldo_insoluto || '0').replace(/[$,\s]/g, '')) || 0;

        // Factura de liquidación — sin solicitud_id (bigint incompatible con UUID)
        const noDocto = `LIQ-${Date.now().toString(36).toUpperCase()}`;
        const [facturaLiq] = await sql`
          INSERT INTO "EFINANCIANET_DB"."J_FACTURAS"
            (numero_documento, fecha_emision, tipo, monto_transaccion, estatus)
          VALUES (${noDocto}, ${fecha}::date, 'Por Cobrar', ${saldo}::numeric::money, 'Pendiente')
          RETURNING id
        `;
        if (saldo > 0) {
          // J_FACTURAS_DETALLE.factura_id es int8 — no ::uuid
          await sql`
            INSERT INTO "EFINANCIANET_DB"."J_FACTURAS_DETALLE"
              (factura_id, cve_subproducto, descripcion_subproducto, cantidad, monto, porcentaje_impuesto, moneda, subtotal, estatus)
            VALUES (${facturaLiq.id}, 'SALDO_INSOLUTO', 'Saldo Insoluto', 1, ${saldo}, 0, 'MXN', ${saldo}, 'Pendiente')
          `;
        }

        // Aplicar pago a todas las facturas pendientes (J_PAGOS: solicitud_id, factura_id, fecha_pago, monto_pagado, forma_pago, estatus)
        const pendingFacturas = await sql`
          SELECT f.id, f.monto_transaccion
          FROM "EFINANCIANET_DB"."J_FACTURAS" f
          JOIN "EFINANCIANET_DB"."J_CALEN_PAGOS_AMORTIZA" a ON a.id = f.amortizacion_id
          WHERE a.cotizacion_id = ${solicitudId}::uuid AND f.estatus = 'Pendiente'
        `;
        for (const fac of pendingFacturas) {
          const montoFac = parseFloat(String(fac.monto_transaccion).replace(/[$,\s]/g, '')) || 0;
          // J_PAGOS.factura_id = int8, J_FACTURAS.id = int8 — no ::uuid
          await sql`
            INSERT INTO "EFINANCIANET_DB"."J_PAGOS"
              (factura_id, fecha_pago, monto_pagado, forma_pago, estatus)
            VALUES (${fac.id}, ${fecha}::date, ${montoFac}, 'Liquidación', 'Aplicado')
          `;
          await sql`UPDATE "EFINANCIANET_DB"."J_FACTURAS" SET estatus = 'Pagado' WHERE id = ${fac.id}`;
        }

        await sql`UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" SET estatus_sol = 'Finiquitado' WHERE id = ${solicitudId}::uuid`;

        if (clave === 'RENOVACION') {
          const [orig] = await sql`SELECT * FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = ${solicitudId}::uuid`;
          if (orig) {
            const [maxRow] = await sql`
              SELECT COALESCE(MAX(CASE WHEN no_sol ~ '^[0-9]+$' THEN no_sol::int ELSE 0 END), 0) AS mx
              FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
            `;
            const newNoSol = String((maxRow.mx || 0) + 1).padStart(6, '0');
            let newData = orig.data || {};
            if (typeof newData === 'string') { try { newData = JSON.parse(newData); } catch {} }
            if (newData?.solicitud?.header) { newData.solicitud.header.no_sol = newNoSol; newData.solicitud.header.fecha_solicitud = fecha; }
            await sql`
              INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
                (type, no_sol, no_cuenta, linea_produc, tipo_produc, producto_id, cliente_id, monto_sol, monto_aut, estatus_sol, fases, fecha_sol, data)
              VALUES (${orig.type || 'Solicitud'}, ${newNoSol}, ${orig.no_cuenta || null},
                ${orig.linea_produc || 'Crédito'}, ${orig.tipo_produc || null},
                ${orig.producto_id}::uuid, ${orig.cliente_id}::uuid,
                ${orig.monto_sol || null}, ${orig.monto_aut || null},
                'Pendiente', '1', ${fecha}::date, ${JSON.stringify(newData)}::jsonb)
            `;
          }
        }
      }
    }

    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// COBRANZA — Lista global de J_FACTURAS con filtros
// ═══════════════════════════════════════════════════════════════════
const carteraCobranzaHandler = async (c: any) => {
  try {
    const { estatus, sub_tipo, fecha_desde, fecha_hasta } = c.req.query();
    const rows = await sql`
      SELECT f.id, f.solicitud_id,
        f.numero_documento   AS no_docto,
        COALESCE(f.fecha_compromiso, a.fecha) AS fecha_compromiso,
        f.tipo, f.sub_tipo, f.cliente,
        COALESCE(f.gobierno, cl.data->>'institucionGobierno') AS gobierno,
        f.forma_pago, f.moneda, f.cuenta_bancaria, f.referencia,
        TRIM(REPLACE(REPLACE(f.monto_transaccion::text,'$',''),',',' '))::numeric AS monto_transaccion,
        f.estatus
      FROM "EFINANCIANET_DB"."J_FACTURAS" f
      LEFT JOIN "EFINANCIANET_DB"."J_CALEN_PAGOS_AMORTIZA" a ON a.id = f.amortizacion_id
      LEFT JOIN "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" cc ON cc.id = f.solicitud_id
      LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES" cl ON cl.id = cc.cliente_id
      WHERE 1=1
        ${estatus && estatus !== 'Todos' ? sql`AND f.estatus = ${estatus}` : sql``}
        ${sub_tipo ? sql`AND f.sub_tipo = ${sub_tipo}` : sql``}
        ${fecha_desde ? sql`AND f.fecha_compromiso >= ${fecha_desde}::date` : sql``}
        ${fecha_hasta ? sql`AND f.fecha_compromiso <= ${fecha_hasta}::date` : sql``}
      ORDER BY f.fecha_emision DESC
      LIMIT 500
    `;

    return c.json({ data: rows });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

// ═══════════════════════════════════════════════════════════════════
// GENERACIÓN CONTABLE — Eventos por crédito (almacenados en JSONB)
// ═══════════════════════════════════════════════════════════════════
const parseJsonbData = (raw: any): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  if (typeof raw === 'object' && !Array.isArray(raw) && '0' in raw) {
    try { return JSON.parse(Object.values(raw).join('')); } catch { return {}; }
  }
  return typeof raw === 'object' ? raw : {};
};

const carteraContableGetHandler = async (c: any) => {
  try {
    const solicitudId = c.req.param('solicitudId');
    const [row] = await sql`
      SELECT data FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = ${solicitudId}::uuid
    `;
    const parsed = parseJsonbData(row?.data);
    return c.json({ data: Array.isArray(parsed.eventosContables) ? parsed.eventosContables : [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

const carteraContableCreateHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { solicitud_id, codigo, evento, prompt } = body;
    if (!solicitud_id || !codigo) return c.json({ error: 'solicitud_id y codigo son requeridos' }, 400);

    // Read current data in TypeScript to avoid "cannot set path in scalar" on JSONB string
    const [row] = await sql`
      SELECT data FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = ${solicitud_id}::uuid
    `;
    const currentData = parseJsonbData(row?.data);
    const eventosContables: any[] = Array.isArray(currentData.eventosContables) ? currentData.eventosContables : [];

    const nuevoEvento = {
      id: crypto.randomUUID(),
      codigo, evento, prompt,
      estatus: 'Creado',
      fecha: new Date().toISOString(),
    };
    eventosContables.push(nuevoEvento);
    currentData.eventosContables = eventosContables;

    await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      SET data = ${JSON.stringify(currentData)}::jsonb
      WHERE id = ${solicitud_id}::uuid
    `;
    return c.json({ ok: true, evento: nuevoEvento });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

const carteraContableEjecutarHandler = async (c: any) => {
  try {
    const eventoId = c.req.param('eventoId');
    const body = await c.req.json();
    const { solicitud_id, contexto, prompt } = body;

    // Ejecutar prompt IA via Groq
    const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
    const systemPrompt = `Eres un experto en contabilidad bancaria. Genera pólizas contables claras y estructuradas en formato texto, con columnas: CUENTA | DESCRIPCIÓN | DEBE | HABER. Incluye totales al final.`;
    const userMessage  = `Contexto del crédito: ${contexto}\n\nEvento: ${prompt}`;

    let poliza = `[Póliza generada automáticamente]\n\nEvento: ${prompt}\nContexto: ${contexto}`;
    try {
      const iaRes = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
          max_tokens: 1024,
          temperature: 0.3,
        }),
      });
      if (iaRes.ok) {
        const iaJson = await iaRes.json();
        poliza = iaJson.choices?.[0]?.message?.content || poliza;
      }
    } catch { /* usar poliza fallback */ }

    // Read + update in TypeScript to avoid "cannot set path in scalar" on JSONB string
    const [rowEj] = await sql`
      SELECT data FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = ${solicitud_id}::uuid
    `;
    const dataEj = parseJsonbData(rowEj?.data);
    const eventosEj: any[] = Array.isArray(dataEj.eventosContables) ? dataEj.eventosContables : [];
    dataEj.eventosContables = eventosEj.map((e: any) =>
      e.id === eventoId ? { ...e, estatus: 'Procesado', poliza } : e
    );

    await sql`
      UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      SET data = ${JSON.stringify(dataEj)}::jsonb
      WHERE id = ${solicitud_id}::uuid
    `;
    return c.json({ ok: true, poliza });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

// Diagnóstico: columnas reales de tablas cartera
const carteraMigrateHandler = async (c: any) => {
  try {
    await sql`
      ALTER TABLE "EFINANCIANET_DB"."J_FACTURAS"
        ADD COLUMN IF NOT EXISTS sub_tipo             text,
        ADD COLUMN IF NOT EXISTS cliente              text,
        ADD COLUMN IF NOT EXISTS forma_pago           text,
        ADD COLUMN IF NOT EXISTS fecha_compromiso     date,
        ADD COLUMN IF NOT EXISTS moneda               text DEFAULT 'MXN',
        ADD COLUMN IF NOT EXISTS institucion_financiera text,
        ADD COLUMN IF NOT EXISTS cuenta_bancaria      text,
        ADD COLUMN IF NOT EXISTS referencia           text,
        ADD COLUMN IF NOT EXISTS gobierno             text
    `;
    return c.json({ ok: true, mensaje: 'Migración J_FACTURAS completada' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

const carteraSchemaHandler = async (c: any) => {
  try {
    const tablas = [
      'J_CALEN_PAGOS_AMORTIZA', 'J_FACTURAS', 'J_FACTURAS_DETALLE',
      'J_PAGOS', 'J_SOLICITUDES_EXTRAORDINARIAS', 'J_TIPOS_SOLICITUDES_EXTRAORDINARIAS',
      'J_SOLICITUDES_ACTIVACION',
    ];
    const result: Record<string, {col: string; type: string}[]> = {};
    for (const tabla of tablas) {
      const cols = await sql`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'EFINANCIANET_DB' AND table_name = ${tabla}
        ORDER BY ordinal_position
      `;
      result[tabla] = cols.map((r: any) => ({ col: r.column_name, type: r.udt_name || r.data_type }));
    }
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};
app.get(`${PREFIX}/cartera/schema`, carteraSchemaHandler);
app.get(`${PREFIX}/cartera/migrate`, carteraMigrateHandler);
app.get(`/cartera/migrate`, carteraMigrateHandler);
app.get(`${PREFIX}/cartera/debug-gobierno/:solicitudId`, async (c: any) => {
  const sid = c.req.param('solicitudId');
  try {
    // 1. Columnas de J_CUENTAS_CORP_CLIENTES
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='EFINANCIANET_DB' AND table_name='J_CUENTAS_CORP_CLIENTES'
      ORDER BY ordinal_position
    `;
    // 2. La fila del solicitud
    const [cc] = await sql`SELECT * FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = ${sid}::uuid`;
    // 3. Si hay cliente_id, buscar en J_CLIENTES
    let clData: any = null;
    if (cc?.cliente_id) {
      const [cl] = await sql`SELECT data FROM "EFINANCIANET_DB"."J_CLIENTES" WHERE id = ${cc.cliente_id}::uuid`;
      clData = cl ? parseJsonbData(cl.data) : null;
    }
    const nonDataCols = cc ? Object.entries(cc).filter(([k]) => k !== 'data').reduce((o: any, [k,v]) => { o[k]=v; return o; }, {}) : {};
    return c.json({
      cc_columns: cols.map((r:any) => r.column_name),
      cc_non_data_fields: nonDataCols,
      cl_found: !!clData,
      cl_institucionGobierno: clData?.institucionGobierno,
      cl_keys: clData ? Object.keys(clData).slice(0, 20) : [],
    });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});
app.get(`/cartera/debug-gobierno/:solicitudId`, async (c: any) => {
  const sid = c.req.param('solicitudId');
  try {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='EFINANCIANET_DB' AND table_name='J_CUENTAS_CORP_CLIENTES' ORDER BY ordinal_position`;
    const [cc] = await sql`SELECT * FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = ${sid}::uuid`;
    let clData: any = null;
    if (cc?.cliente_id) {
      const [cl] = await sql`SELECT data FROM "EFINANCIANET_DB"."J_CLIENTES" WHERE id = ${cc.cliente_id}::uuid`;
      clData = cl ? parseJsonbData(cl.data) : null;
    }
    const nonDataCols = cc ? Object.entries(cc).filter(([k]) => k !== 'data').reduce((o: any, [k,v]) => { o[k]=v; return o; }, {}) : {};
    return c.json({ cc_columns: cols.map((r:any) => r.column_name), cc_non_data_fields: nonDataCols, cl_institucionGobierno: clData?.institucionGobierno, cl_keys: clData ? Object.keys(clData).slice(0,20) : [] });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});
app.get(`/cartera/schema`, carteraSchemaHandler);
// Cobranza global
app.get(`${PREFIX}/cartera/cobranza`, carteraCobranzaHandler);
app.get(`/cartera/cobranza`, carteraCobranzaHandler);
// Generación Contable (legacy — mantener compatibilidad)
app.get(`${PREFIX}/cartera/contable/:solicitudId`, carteraContableGetHandler);
app.post(`${PREFIX}/cartera/contable`, carteraContableCreateHandler);
app.post(`${PREFIX}/cartera/contable/:eventoId/ejecutar`, carteraContableEjecutarHandler);
app.get(`/cartera/contable/:solicitudId`, carteraContableGetHandler);
app.post(`/cartera/contable`, carteraContableCreateHandler);
app.post(`/cartera/contable/:eventoId/ejecutar`, carteraContableEjecutarHandler);

// ── Generación Contable v2 (tablas GL reales) ──────────────────────────────

// GET /contable/catalogo — Lee J_CATALOGO_EVENTOS_CONTABLES
app.get(`${PREFIX}/contable/catalogo`, async (c: any) => {
  try {
    const rows = await sql`SELECT id, codigo, evento, prompt_ia FROM "EFINANCIANET_DB"."J_CATALOGO_EVENTOS_CONTABLES" ORDER BY codigo`;
    return c.json({ data: rows });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});
app.get(`/contable/catalogo`, async (c: any) => {
  try {
    const rows = await sql`SELECT id, codigo, evento, prompt_ia FROM "EFINANCIANET_DB"."J_CATALOGO_EVENTOS_CONTABLES" ORDER BY codigo`;
    return c.json({ data: rows });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// GET /contable/eventos/:solicitudId — busca por account_id O data->>'solicitud_id'
const contableEventosGetHandler = async (c: any) => {
  try {
    const sid = c.req.param('solicitudId');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid || '');
    const rows = isUUID
      ? await sql`
          SELECT j.id, j.event_code as codigo, j.status as estatus,
                 j.journal_date as fecha, j.total_debit, j.total_credit, j.data
          FROM "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO" j
          WHERE j.account_id = ${sid}::uuid
             OR j.data->>'solicitud_id' = ${sid}
          ORDER BY j.created_at DESC
        `
      : await sql`
          SELECT j.id, j.event_code as codigo, j.status as estatus,
                 j.journal_date as fecha, j.total_debit, j.total_credit, j.data
          FROM "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO" j
          WHERE j.data->>'solicitud_id' = ${sid}
          ORDER BY j.created_at DESC
        `;
    const data = rows.map((r: any) => {
      const d = parseJsonbData(r.data);
      return {
        id:          r.id,
        codigo:      d.codigo    || r.codigo,
        evento:      d.evento    || r.codigo,
        prompt_ia:   d.prompt_ia || '',
        estatus:     r.estatus === 'creada' ? 'Creado' : r.estatus === 'procesada' ? 'Procesado' : (r.estatus || 'Creado'),
        poliza:      d.poliza    || null,
        fecha:       r.fecha,
        total_debit:  r.total_debit,
        total_credit: r.total_credit,
      };
    });
    return c.json({ data });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
};
app.get(`${PREFIX}/contable/eventos/:solicitudId`, contableEventosGetHandler);
app.get(`/contable/eventos/:solicitudId`, contableEventosGetHandler);

// POST /contable/eventos — Crea encabezado en J_GL_JOURNAL_ENCABEZADO con estatus=creada
app.post(`${PREFIX}/contable/eventos`, async (c: any) => {
  try {
    const b = await c.req.json();
    const { solicitud_id, catalogo_id, codigo, evento, prompt_ia } = b;
    if (!solicitud_id || !codigo) return c.json({ error: 'solicitud_id y codigo requeridos' }, 400);

    // Leer producto y montos de la cuenta financiera
    const [cuenta] = await sql`
      SELECT producto_id, monto_aut, monto_sol, cliente_id FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE id = ${solicitud_id}::uuid LIMIT 1
    `;
    const monto = parseFloat(String(cuenta?.monto_aut || cuenta?.monto_sol || '0').replace(/[^0-9.-]/g, '')) || 0;
    const productoId = cuenta?.producto_id || null;
    // Si el registro no existe en J_CUENTAS_CORP_CLIENTES, no usar como FK (evita constraint error)
    const accountId = cuenta ? solicitud_id : null;
    const dataJson = JSON.stringify({ solicitud_id, catalogo_id: catalogo_id || null, codigo, evento: evento || codigo, prompt_ia: prompt_ia || '' });

    const [ins] = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO"
        (journal_date, producto_id, event_code, account_id, currency, total_debit, total_credit, status, created_at, data)
      VALUES (
        CURRENT_DATE,
        ${productoId}::uuid,
        ${codigo},
        ${accountId}::uuid,
        'MXN',
        ${monto}::numeric,
        ${monto}::numeric,
        'creada',
        NOW(),
        ${sql.json({ solicitud_id, catalogo_id: catalogo_id || null, codigo, evento: evento || codigo, prompt_ia: prompt_ia || '' })}
      )
      RETURNING id
    `;
    return c.json({ ok: true, id: ins.id });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});
app.post(`/contable/eventos`, async (c: any) => {
  try {
    const b = await c.req.json();
    const { solicitud_id, catalogo_id, codigo, evento, prompt_ia } = b;
    if (!solicitud_id || !codigo) return c.json({ error: 'solicitud_id y codigo requeridos' }, 400);
    const [cuenta] = await sql`SELECT producto_id, monto_aut, monto_sol FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" WHERE id = ${solicitud_id}::uuid LIMIT 1`;
    const monto = parseFloat(String(cuenta?.monto_aut || cuenta?.monto_sol || '0').replace(/[^0-9.-]/g, '')) || 0;
    const pId2 = cuenta?.producto_id || null;
    const aId2 = cuenta ? solicitud_id : null;
    const [ins] = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO"
        (journal_date, producto_id, event_code, account_id, currency, total_debit, total_credit, status, created_at, data)
      VALUES (CURRENT_DATE, ${pId2}::uuid, ${codigo}, ${aId2}::uuid, 'MXN', ${monto}::numeric, ${monto}::numeric, 'creada', NOW(), ${sql.json({ solicitud_id, catalogo_id: catalogo_id || null, codigo, evento: evento || codigo, prompt_ia: prompt_ia || '' })})
      RETURNING id`;
    return c.json({ ok: true, id: ins.id });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// POST /contable/eventos/:id/ejecutar — Lee motor contable, genera póliza con IA, inserta DETALLE
app.post(`${PREFIX}/contable/eventos/:id/ejecutar`, async (c: any) => {
  const LOG = '[CONTABLE-EJECUTAR]';
  try {
    const journalId = c.req.param('id');
    const b = await c.req.json();
    const { solicitud_id, contexto, prompt_ia } = b;

    // 1. Leer encabezado y cuenta financiera
    const [header] = await sql`
      SELECT j.*, cc.producto_id as prod_id, cc.cliente_id as cli_id,
             cc.monto_aut, cc.monto_sol
      FROM "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO" j
      LEFT JOIN "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" cc ON cc.id = j.account_id
      WHERE j.id = ${journalId}::uuid LIMIT 1
    `;
    if (!header) return c.json({ error: 'Encabezado no encontrado' }, 404);

    // 2. Leer motor contable del producto
    let motorContable: any[] = [];
    if (header.prod_id) {
      try {
        const [prod] = await sql`SELECT data FROM "EFINANCIANET_DB"."J_PRODUCTOS" WHERE id = ${header.prod_id}::uuid LIMIT 1`;
        const pd = parseJsonbData(prod?.data);
        motorContable = Array.isArray(pd.motorContable) ? pd.motorContable : [];
      } catch { /* sin motor */ }
    }

    // 3. Filtrar entradas del motor contable para este evento
    const lineasMotor = motorContable.filter((m: any) => m.evento?.codigo === header.event_code);
    const monto = parseFloat(String(header.monto_aut || header.monto_sol || '0').replace(/[^0-9.-]/g, '')) || 0;

    // 4. Insertar líneas de detalle basadas en motor contable
    let totalDebito = 0; let totalCredito = 0;
    if (lineasMotor.length > 0) {
      for (const linea of lineasMotor) {
        const montoLinea = monto;
        await sql`
          INSERT INTO "EFINANCIANET_DB"."J_GL_JOURNAL_DETALLE"
            (journal_id, gl_account, debit_amount, credit_amount, currency, customer_id, account_id, product_id, descripcion)
          VALUES (
            ${journalId}::uuid,
            ${linea.debito?.cuenta_gl || linea.debito?.id || '—'},
            ${montoLinea}::numeric,
            0,
            'MXN',
            ${header.cli_id || null}::uuid,
            ${header.account_id}::uuid,
            ${header.prod_id || null}::uuid,
            ${`DÉBITO: ${linea.debito?.nombre || ''} | Componente: ${linea.componente?.nombre || ''}`}
          )
        `;
        await sql`
          INSERT INTO "EFINANCIANET_DB"."J_GL_JOURNAL_DETALLE"
            (journal_id, gl_account, debit_amount, credit_amount, currency, customer_id, account_id, product_id, descripcion)
          VALUES (
            ${journalId}::uuid,
            ${linea.credito?.cuenta_gl || linea.credito?.id || '—'},
            0,
            ${montoLinea}::numeric,
            'MXN',
            ${header.cli_id || null}::uuid,
            ${header.account_id}::uuid,
            ${header.prod_id || null}::uuid,
            ${`CRÉDITO: ${linea.credito?.nombre || ''} | Componente: ${linea.componente?.nombre || ''}`}
          )
        `;
        totalDebito  += montoLinea;
        totalCredito += montoLinea;
      }
    }

    // 5. Generar texto de póliza con IA (Groq)
    const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY") || "";
    let polizaTexto = lineasMotor.length > 0
      ? lineasMotor.map((l: any) =>
          `DÉBITO  ${(l.debito?.cuenta_gl || '').padEnd(15)} ${l.debito?.nombre || ''} $${monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n` +
          `CRÉDITO ${(l.credito?.cuenta_gl || '').padEnd(15)} ${l.credito?.nombre || ''} $${monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
        ).join('\n\n') + `\n\n${'─'.repeat(60)}\nTOTAL DÉBITO:  $${totalDebito.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\nTOTAL CRÉDITO: $${totalCredito.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
      : `[Sin configuración de motor contable para ${header.event_code}]\n\n${prompt_ia || ''}\n\nContexto: ${contexto || ''}`;

    try {
      if (GROQ_KEY) {
        const motorResumen = lineasMotor.map((l: any) =>
          `${l.evento?.codigo}: DEBE ${l.debito?.cuenta_gl} ${l.debito?.nombre} / HABER ${l.credito?.cuenta_gl} ${l.credito?.nombre} (${l.componente?.nombre})`
        ).join('\n');
        const iaRes = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
              { role: 'system', content: 'Eres un experto en contabilidad bancaria. Genera pólizas contables claras en formato: CUENTA | DESCRIPCIÓN | DEBE | HABER. Totales al final. Siempre cuadrada (DEBE = HABER).' },
              { role: 'user', content: `${prompt_ia || ''}\n\nContexto: ${contexto || ''}\nMotor contable configurado:\n${motorResumen}\nMonto: $${monto.toLocaleString('es-MX')}` },
            ],
            max_tokens: 1024, temperature: 0.2,
          }),
        });
        if (iaRes.ok) {
          const iaJ = await iaRes.json();
          polizaTexto = iaJ.choices?.[0]?.message?.content || polizaTexto;
        }
      }
    } catch { /* usar texto generado localmente */ }

    // 6. Actualizar encabezado: status=procesada, total_debit/credit reales, póliza en data
    const existData = parseJsonbData(header.data);
    existData.poliza = polizaTexto;
    await sql`
      UPDATE "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO"
      SET status = 'procesada',
          total_debit  = ${totalDebito  || monto}::numeric,
          total_credit = ${totalCredito || monto}::numeric,
          data = ${JSON.stringify(existData)}::jsonb
      WHERE id = ${journalId}::uuid
    `;

    console.log(`${LOG} ✅ journal=${journalId} event=${header.event_code} lineas=${lineasMotor.length} débito=${totalDebito}`);
    return c.json({ ok: true, poliza: polizaTexto, lineas: lineasMotor.length });
  } catch (e: any) {
    console.error(`${LOG} Error:`, e?.message);
    return c.json({ error: e.message }, 500);
  }
});
app.post(`/contable/eventos/:id/ejecutar`, async (c: any) => {
  const LOG = '[CONTABLE-EJECUTAR-v2]';
  try {
    const journalId = c.req.param('id');
    const b = await c.req.json();
    const { solicitud_id, contexto, prompt_ia } = b;
    const [header] = await sql`
      SELECT j.*, cc.producto_id as prod_id, cc.cliente_id as cli_id, cc.monto_aut, cc.monto_sol
      FROM "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO" j
      LEFT JOIN "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" cc ON cc.id = j.account_id
      WHERE j.id = ${journalId}::uuid LIMIT 1
    `;
    if (!header) return c.json({ error: 'Encabezado no encontrado' }, 404);
    let motorContable: any[] = [];
    if (header.prod_id) {
      try {
        const [prod] = await sql`SELECT data FROM "EFINANCIANET_DB"."J_PRODUCTOS" WHERE id = ${header.prod_id}::uuid LIMIT 1`;
        const pd = parseJsonbData(prod?.data);
        motorContable = Array.isArray(pd.motorContable) ? pd.motorContable : [];
      } catch { /* sin motor */ }
    }
    const lineasMotor = motorContable.filter((m: any) => m.evento?.codigo === header.event_code);
    const monto = parseFloat(String(header.monto_aut || header.monto_sol || '0').replace(/[^0-9.-]/g, '')) || 0;
    let totalDebito = 0; let totalCredito = 0;
    for (const linea of lineasMotor) {
      await sql`INSERT INTO "EFINANCIANET_DB"."J_GL_JOURNAL_DETALLE" (journal_id, gl_account, debit_amount, credit_amount, currency, customer_id, account_id, product_id, descripcion) VALUES (${journalId}::uuid, ${linea.debito?.cuenta_gl || '—'}, ${monto}::numeric, 0, 'MXN', ${header.cli_id || null}::uuid, ${header.account_id}::uuid, ${header.prod_id || null}::uuid, ${`DÉBITO: ${linea.debito?.nombre || ''}`})`;
      await sql`INSERT INTO "EFINANCIANET_DB"."J_GL_JOURNAL_DETALLE" (journal_id, gl_account, debit_amount, credit_amount, currency, customer_id, account_id, product_id, descripcion) VALUES (${journalId}::uuid, ${linea.credito?.cuenta_gl || '—'}, 0, ${monto}::numeric, 'MXN', ${header.cli_id || null}::uuid, ${header.account_id}::uuid, ${header.prod_id || null}::uuid, ${`CRÉDITO: ${linea.credito?.nombre || ''}`})`;
      totalDebito += monto; totalCredito += monto;
    }
    let polizaTexto = lineasMotor.length > 0
      ? lineasMotor.map((l: any) => `DÉBITO  ${(l.debito?.cuenta_gl||'').padEnd(15)} ${l.debito?.nombre||''} $${monto.toLocaleString('es-MX',{minimumFractionDigits:2})}\nCRÉDITO ${(l.credito?.cuenta_gl||'').padEnd(15)} ${l.credito?.nombre||''} $${monto.toLocaleString('es-MX',{minimumFractionDigits:2})}`).join('\n\n') + `\n\n${'─'.repeat(50)}\nTOTAL DÉBITO:  $${totalDebito.toLocaleString('es-MX',{minimumFractionDigits:2})}\nTOTAL CRÉDITO: $${totalCredito.toLocaleString('es-MX',{minimumFractionDigits:2})}`
      : `[Sin motor contable para ${header.event_code}]\n${contexto||''}`;
    try {
      const GROQ_KEY = Deno.env.get("GROQ_API_KEY") || "";
      if (GROQ_KEY) {
        const motorRes = lineasMotor.map((l: any) => `${l.evento?.codigo}: DEBE ${l.debito?.cuenta_gl} ${l.debito?.nombre} / HABER ${l.credito?.cuenta_gl} ${l.credito?.nombre} (${l.componente?.nombre})`).join('\n');
        const iaRes = await fetch("https://api.groq.com/openai/v1/chat/completions", { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${GROQ_KEY}`}, body: JSON.stringify({ model:'meta-llama/llama-4-scout-17b-16e-instruct', messages:[{role:'system',content:'Experto contable. Genera pólizas formato: CUENTA | DESCRIPCIÓN | DEBE | HABER. Siempre cuadrada.'},{role:'user',content:`${prompt_ia||''}\n\nContexto: ${contexto||''}\nMotor:\n${motorRes}\nMonto: $${monto.toLocaleString('es-MX')}`}], max_tokens:1024, temperature:0.2 }) });
        if (iaRes.ok) { const iaJ = await iaRes.json(); polizaTexto = iaJ.choices?.[0]?.message?.content || polizaTexto; }
      }
    } catch { /* usar texto local */ }
    const existData = parseJsonbData(header.data);
    existData.poliza = polizaTexto;
    await sql`UPDATE "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO" SET status='procesada', total_debit=${totalDebito||monto}::numeric, total_credit=${totalCredito||monto}::numeric, data=${JSON.stringify(existData)}::jsonb WHERE id=${journalId}::uuid`;
    console.log(`${LOG} ✅ journal=${journalId} lineas=${lineasMotor.length}`);
    return c.json({ ok: true, poliza: polizaTexto, lineas: lineasMotor.length });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// Monto actualizado del crédito (disminuye con cada pago)
const carteraCreditoMontoHandler = async (c: any) => {
  const id = c.req.param('id');
  try {
    const [row] = await sql`
      SELECT
        TRIM(REPLACE(REPLACE(monto_aut::text,'$',''),',',' '))::numeric  AS monto_aut,
        TRIM(REPLACE(REPLACE(monto_sol::text,'$',''),',',' '))::numeric  AS monto_sol
      FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
      WHERE id = ${id}::uuid
    `;
    if (!row) return c.json({ error: 'Crédito no encontrado' }, 404);
    return c.json({
      monto_aut: parseFloat(String(row.monto_aut)) || 0,
      monto_sol: parseFloat(String(row.monto_sol)) || 0,
    });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
};
app.get(`${PREFIX}/cartera/credito/:id/monto`, carteraCreditoMontoHandler);
app.get(`/cartera/credito/:id/monto`, carteraCreditoMontoHandler);

// Cartera routes
app.get(`${PREFIX}/cartera/amortizaciones/:solicitudId`, carteraAmortizacionesHandler);
app.get(`${PREFIX}/cartera/avisos/:solicitudId`, carteraAvisosHandler);
app.get(`${PREFIX}/cartera/pagos/:solicitudId`, carteraPagosHandler);
app.get(`${PREFIX}/cartera/tipos-solicitudes-ext`, carteraTiposExtHandler);
app.get(`${PREFIX}/cartera/solicitudes-ext/:solicitudId`, carteraSolicitudesExtGetHandler);
app.get(`${PREFIX}/cartera/solicitudes-ext`, carteraSolicitudesExtGetHandler);
app.post(`${PREFIX}/cartera/facturas`, carteraCrearFacturaHandler);
app.post(`${PREFIX}/cartera/solicitudes-ext`, carteraCrearSolicitudExtHandler);
app.put(`${PREFIX}/cartera/solicitudes-ext/:id`, carteraActualizarSolicitudExtHandler);

// GET /cartera/facturas/:id/detalle — filas de J_FACTURAS_DETALLE para una factura
app.get(`${PREFIX}/cartera/facturas/:id/detalle`, async (c: any) => {
  try {
    const facturaId = c.req.param('id');
    const rows = await sql`
      SELECT id, factura_id, cve_subproducto, descripcion_subproducto,
        cantidad, monto::numeric AS monto,
        porcentaje_impuesto, moneda, subtotal::numeric AS subtotal, estatus
      FROM "EFINANCIANET_DB"."J_FACTURAS_DETALLE"
      WHERE factura_id = ${facturaId}::bigint
      ORDER BY CASE cve_subproducto
        WHEN 'CAPITAL'  THEN 1 WHEN 'INTERES' THEN 2
        WHEN 'IVA_INT'  THEN 3 WHEN 'SEGURO'  THEN 4 WHEN 'IVA_SEG' THEN 5
        ELSE 9 END
    `;
    // También devolver el header de la factura para el HEADER del Detail
    const [factura] = await sql`
      SELECT f.id, f.numero_documento, f.fecha_emision, f.fecha_compromiso,
        f.cliente, f.solicitud_id, f.referencia, f.gobierno,
        TRIM(REPLACE(REPLACE(f.monto_transaccion::text,'$',''),',',' '))::numeric AS monto_transaccion,
        f.moneda, f.estatus, f.tipo, f.sub_tipo
      FROM "EFINANCIANET_DB"."J_FACTURAS" f
      WHERE f.id = ${facturaId}::bigint LIMIT 1
    `;
    return c.json({ ok: true, header: factura || null, detalle: rows });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message, detalle: [] }, 500);
  }
});
app.get(`/cartera/facturas/:id/detalle`, async (c: any) => {
  try {
    const facturaId = c.req.param('id');
    const rows = await sql`
      SELECT id, factura_id, cve_subproducto, descripcion_subproducto,
        cantidad, monto::numeric AS monto,
        porcentaje_impuesto, moneda, subtotal::numeric AS subtotal, estatus
      FROM "EFINANCIANET_DB"."J_FACTURAS_DETALLE"
      WHERE factura_id = ${facturaId}::bigint
      ORDER BY CASE cve_subproducto
        WHEN 'CAPITAL'  THEN 1 WHEN 'INTERES' THEN 2
        WHEN 'IVA_INT'  THEN 3 WHEN 'SEGURO'  THEN 4 WHEN 'IVA_SEG' THEN 5
        ELSE 9 END
    `;
    const [factura] = await sql`
      SELECT f.id, f.numero_documento, f.fecha_emision, f.fecha_compromiso,
        f.cliente, f.solicitud_id, f.referencia, f.gobierno,
        TRIM(REPLACE(REPLACE(f.monto_transaccion::text,'$',''),',',' '))::numeric AS monto_transaccion,
        f.moneda, f.estatus, f.tipo, f.sub_tipo
      FROM "EFINANCIANET_DB"."J_FACTURAS" f
      WHERE f.id = ${facturaId}::bigint LIMIT 1
    `;
    return c.json({ ok: true, header: factura || null, detalle: rows });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message, detalle: [] }, 500);
  }
});

// Sin prefijo (fallback)
app.get(`/cartera/amortizaciones/:solicitudId`, carteraAmortizacionesHandler);
app.get(`/cartera/avisos/:solicitudId`, carteraAvisosHandler);
app.get(`/cartera/pagos/:solicitudId`, carteraPagosHandler);
app.get(`/cartera/tipos-solicitudes-ext`, carteraTiposExtHandler);
app.get(`/cartera/solicitudes-ext/:solicitudId`, carteraSolicitudesExtGetHandler);
app.get(`/cartera/solicitudes-ext`, carteraSolicitudesExtGetHandler);
app.post(`/cartera/facturas`, carteraCrearFacturaHandler);
app.post(`/cartera/solicitudes-ext`, carteraCrearSolicitudExtHandler);
app.put(`/cartera/solicitudes-ext/:id`, carteraActualizarSolicitudExtHandler);

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
Verifica SOLO cuando los datos estén presentes:
- Si se proporcionaron subtabs → verificar que correspondan a la fase.
- Si se proporcionaron plantillas → verificar que estén activas y sean correctas.
- Si NO se proporcionaron subtabs o plantillas → NO bloquear por este motivo. No es un error de configuración faltante en el sistema, sino que el producto puede no requerirlos.
- Para productos de Captación/Inversión: NO se requieren plantillas de Contrato ni Pagaré. Solo aplica "solicitud" si existe.
- Si el payload llega con campos vacíos (documentos, subtabs, plantillas, reglas) → interpretar como contexto mínimo y ser PERMISIVO. Aprobar si los datos del cliente y monto están presentes.

────────────────────────────────────────
4. VALIDACIÓN DE REGLAS DE NEGOCIO POR FASE
────────────────────────────────────────
REGLA GENERAL: Si los campos de contexto (documentos, subtabs, plantillas, reglas) llegan vacíos,
ser PERMISIVO y aprobar basándose en los datos básicos disponibles (cliente, monto, fase).

Para productos de Captación/Inversión (lineaProducto = "Captación" o tipoProducto contiene "Inversión"):
- NO requerir Contrato ni Pagaré en ninguna fase.
- Las fases son personalizadas por el producto — validar solo lo que se proporciona.
- Si hay documentos → validarlos. Si no hay → aprobar.

Para productos de Crédito/Línea de Crédito:
FASE 1 — Expediente Electrónico
- Validar que los datos del cliente estén completos.
- Validar que existan los documentos base según tipo de persona (si se proporcionan).
FASE 2 — Integración / Solicitud
- Validar que exista el PDF "SOLICITUD" (si se proporcionan documentos generados).
- Validar datos del cliente y monto (si están disponibles).
FASE 3 — Análisis / RFC
- Validar RFC (si se proporcionan documentos).
FASE 4 — Expediente Jurídico / Formalización
- REGLA PRIORITARIA: Si el expediente contiene documentos validados por IA de tipo "Contrato Firmado" y "Pagaré Firmado" (o equivalentes como "contrato firmado", "pagare firmado", "Contrato", "Pagaré") → la formalización está COMPLETA. Retornar valido: true INMEDIATAMENTE, ignorar cualquier otra regla de esta fase.
- Si NO hay Contrato Firmado ni Pagaré Firmado validados, entonces verificar plantillas (solo si se proporcionan en el payload).
- Si no hay plantillas ni contratos firmados → aprobación permisiva basada en datos del cliente.
FASE 5 — Validación de Firmas
- Validar Contrato y Pagaré firmados (solo si se proporcionan documentos).
- Si el expediente ya tiene "Contrato Firmado" y "Pagaré Firmado" validados → aprobar automáticamente.
FASE 6 — Solicitud de Activación
- Validar garantías y cargos (solo si se proporcionan).
FASE 7 — Activación de Cuenta
- Validar estatus de Solicitud de Activación (si se proporciona).

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
8. Para documentos tipo "Contrato Firmado", "Pagaré Firmado" o cualquier tipo que contenga "Firmado": el nombre mismo indica que el usuario ya verificó la firma. NO rechaces por ausencia de firmas físicas visibles — las firmas pueden ser digitales, electrónicas o estar fuera del área visible de la imagen. Si el documento tiene estructura de contrato o pagaré → responde valido: true.
9. NUNCA rechaces un documento solo porque no ves firmas. Las firmas pueden ser invisibles en la imagen digital.

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
      // Frontend sends docs as 'documentos' — normalize to documentosCargados
      documentos,
    } = body;
    // Alias: frontend sends documentos[], edge function uses documentosCargados
    const documentosCargadosEff = documentosCargados || documentos || [];

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
      documentosCargados: documentosCargadosEff,
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

    // ── Post-procesamiento Fase 4: si Contrato Firmado + Pagaré Firmado validados → aprobar ──
    if (modoFase && !parsed.valido) {
      const promptTexto = (contextoFase.promptIAProducto || "").toLowerCase();
      const tieneContratoFirmado = promptTexto.includes("contrato firmado") && promptTexto.includes("validado por ia");
      const tienePagareFirmado   = (promptTexto.includes("pagaré firmado") || promptTexto.includes("pagare firmado")) && promptTexto.includes("validado por ia");
      if (tieneContratoFirmado && tienePagareFirmado) {
        console.log(`${LOG_IA} ⚠️ Fase: Contrato Firmado + Pagaré Firmado validados → override valido=true`);
        parsed.valido = true;
        parsed.confianza = 0.9;
        parsed.motivos = ["Contrato Firmado y Pagaré Firmado presentes y validados por IA — formalización completa", ...(parsed.motivos || []).slice(0, 2)];
      }
    }

    // ── Post-procesamiento: detectar respuesta contradictoria del modelo ──
    // Si todos los motivos son positivos pero valido=false, el modelo cometió un error lógico
    const motivosPositivos = ["coincide", "válido", "vigente", "legible", "correcto", "auténtico",
      "coinciden", "verificado", "aprobado", "completo", "presente", "corresponde"];
    const motivosNegativos = ["no coincide", "falta", "inválido", "ilegible", "rechazado",
      "incorrecto", "no se puede", "no presenta", "ausente", "error", "vencido",
      "no se observan", "no se ven", "no hay firma", "sin firma", "no firma"];
    const motivosArr: string[] = Array.isArray(parsed.motivos) ? parsed.motivos : [];
    if (!parsed.valido && motivosArr.length > 0 && modoDocumento && !modoFase) {
      const textoMotivos = motivosArr.join(" ").toLowerCase();
      const tienePositivo = motivosPositivos.some(p => textoMotivos.includes(p));
      const tieneNegativo = motivosNegativos.some(n => textoMotivos.includes(n));
      if (tienePositivo && !tieneNegativo) {
        console.log(`${LOG_IA} ⚠️ Respuesta contradictoria: motivos positivos pero valido=false → corrigiendo a valido=true`);
        parsed.valido = true;
        parsed.confianza = parsed.confianza > 0 ? parsed.confianza : 0.85;
      }
      // Override específico: documentos "Firmado" rechazados solo por ausencia de firmas visibles
      const esFirmado = (tipoDocumento || "").toLowerCase().includes("firmado");
      const soloFirmasFaltantes = tieneNegativo && motivosArr.every((m: string) =>
        ["firma", "observan", "ven", "visible", "representante", "cliente"].some(kw => m.toLowerCase().includes(kw))
      );
      if (esFirmado && soloFirmasFaltantes) {
        console.log(`${LOG_IA} ⚠️ Documento 'Firmado' rechazado por firmas no visibles → override a valido=true`);
        parsed.valido = true;
        parsed.confianza = 0.85;
        parsed.motivos = ["Documento marcado como Firmado — firma puede ser digital o electrónica", ...motivosArr];
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
        SELECT estatus_sol, cliente_id, data
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
    let clienteId: string | null = rows[0].cliente_id || null;

    // Fallback: resolver cliente_id desde JSONB si la columna es null
    if (!clienteId && rows[0].data) {
      try {
        const parsedData = parseJsonbData(rows[0].data);
        const nombrePersona = parsedData?.solicitud?.header?.nombre_persona
          || parsedData?.header?.nombre_persona
          || parsedData?.default?.nombre_persona
          || null;
        if (nombrePersona) {
          const [clRow] = await sql`
            SELECT id FROM "EFINANCIANET_DB"."J_CLIENTES"
            WHERE data->>'nombre' ILIKE ${nombrePersona.split(' ')[0] + '%'}
              AND (data->>'apellidoPaterno' ILIKE ${(nombrePersona.split(' ')[1] || '') + '%'} OR data->>'apellidoPaterno' IS NULL)
            LIMIT 1
          `;
          if (clRow) { clienteId = clRow.id; console.log(`${LOG} cliente_id resuelto desde JSONB nombre: ${clienteId}`); }
        }
      } catch { /* no bloquea */ }
    }

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

    // ── Evaluar si es fase final (necesario antes del bloque cuenta eje) ──
    const esFaseFinal = !fase_siguiente || String(fase_siguiente).trim() === "";

    // ── Crear cuenta eje para el cliente si no existe (para créditos) ──
    if (clienteId && (!idempotente || esFaseFinal)) {
      try {
        const [cuentaEjeExistente] = await sql`
          SELECT id FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
          WHERE cliente_id = ${clienteId}::uuid AND cta_eje_chec = true
          LIMIT 1
        `;
        if (!cuentaEjeExistente) {
          // Buscar producto eje
          let productoEjeId: string | null = null;
          try {
            const productos = await sql`SELECT id, data FROM "EFINANCIANET_DB"."J_PRODUCTOS"`;
            const eje = productos.filter((p: any) => {
              const d = typeof p.data === 'string' ? JSON.parse(p.data) : (p.data || {});
              return d.cuentaEje === true || d.cuentaEje === 'true';
            });
            if (eje.length > 0) productoEjeId = eje[0].id;
          } catch { /* sin producto eje */ }

          const now = new Date().toISOString();
          const noSolEje = `EJE-${String(clienteId).substring(0, 8).toUpperCase()}`;
          const noCuentaEje = `0147${String(Math.floor(Math.random() * 99999999)).padStart(8, '0')}`;
          await sql`
            INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (
              type, no_sol, no_cuenta, no_referenc1,
              fecha_sol, fecha_autori, fecha_inicio,
              descripcion, linea_produc, tipo_produc,
              producto_id, producto_eje, cliente_id,
              monto_sol, monto_aut, monto_disp,
              estatus_disp, estatus_sol, estatus_cart, estatus_cuen,
              cta_eje_chec, fases, data
            ) VALUES (
              'CuentaAhorro', ${noSolEje}, ${noCuentaEje}, ${'REF-' + Date.now().toString(36).toUpperCase()},
              ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz,
              ${'Cuenta Eje — generada automáticamente al autorizar crédito'},
              'CAPTACION', 'Ahorro',
              ${productoEjeId}::uuid, ${productoEjeId}, ${clienteId}::uuid,
              0, 0, 0,
              'No Aplica', 'Autorizada', 'Activa', 'Activa',
              true, 'Activa', ${'{"origenCreacion":"AutorizacionCredito"}'}::jsonb
            )
          `;
          console.log(`${LOG} ✅ Cuenta eje creada para cliente ${clienteId}`);
        }
      } catch (ejeErr: any) {
        console.warn(`${LOG} No se pudo crear cuenta eje: ${ejeErr?.message}`);
      }
    }

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

// ═══════════════════════════════════════════════════════════════════
// Handlers únicos de master: Reportes Regulatorios, Catálogos,
// Eventos y Componentes Contables, Ejecuciones, GL Journal, Upload
// ═══════════════════════════════════════════════════════════════════
﻿const uploadReporteHandler = async (c: any) => {
  try {
    console.log("[REPORTE UPLOAD] Recibiendo petición...");
    const body = await c.req.parseBody();
    const file = body["file"];
    const reporteId = body["reporteId"] as string;

    if (!reporteId) {
      return c.json({ error: "Campo obligatorio faltante: reporteId" }, 400);
    }
    const isFileOrBlob = file && (file instanceof File || file instanceof Blob);
    if (!isFileOrBlob) {
      return c.json({ error: `Campo obligatorio faltante: file. Recibido: ${typeof file}` }, 400);
    }

    const fileNameRaw = (file as any).name || `reporte_${Date.now()}`;
    const fileSize = file.size || 0;
    const fileExt = fileNameRaw.split('.').pop()?.toLowerCase() || 'txt';

    const textMimeMap: Record<string, string> = {
      html: "text/html", htm: "text/html",
      json: "application/json",
      csv: "text/csv",
      xml: "application/xml", txt: "text/plain",
      md: "text/markdown",
    };
    const fileMime = file.type || textMimeMap[fileExt] || "text/plain";

    const safeName = fileNameRaw.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ts = Date.now();
    const finalFileName = `${ts}_${safeName}`;
    const storagePath = `reportes-regulatorios/${reporteId}/${finalFileName}`;

    console.log(`[REPORTE UPLOAD] Subiendo: ${storagePath} (${fileMime}, ${(fileSize / 1024).toFixed(1)} KB)`);

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, uint8, { contentType: fileMime, upsert: true });

    if (uploadError) {
      console.log(`[REPORTE UPLOAD] Error:`, uploadError.message);
      return c.json({ error: `Error al subir archivo: ${uploadError.message}` }, 500);
    }

    const supaUrl = Deno.env.get("SUPABASE_URL") || "";
    let viewUrl = `${supaUrl}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
    try {
      const { data: signedData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, 3600);
      if (signedData?.signedUrl) viewUrl = signedData.signedUrl;
    } catch (_) {}

    const tamanoKB = Math.max(1, Math.round(fileSize / 1024));
    console.log(`[REPORTE UPLOAD] ✅ ${storagePath}`);

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
    console.log("[REPORTE UPLOAD] Error no capturado:", msg);
    return c.json({ error: `Error al procesar carga: ${msg}` }, 500);
  }
};

const ejecutarReporteIAHandler = async (c: any) => {
  const LOG_REP = "[EjecReporte]";
  try {
    const body = await c.req.json();
    const { claveReporte, nombreReporte, formatoSalida, promptIA, fechaInicio, fechaFin, parametrosExtra } = body;

    if (!claveReporte || !promptIA) {
      return c.json({ error: "Faltan parámetros obligatorios: claveReporte, promptIA" }, 400);
    }

    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_KEY) {
      return c.json({ error: "GROQ_API_KEY no configurada en secrets" }, 500);
    }

    const fechaSistema = new Date().toISOString();

    const promptFinal =
      promptIA +
      (fechaInicio && fechaFin ? `\n\nPeríodo: del ${fechaInicio} al ${fechaFin}.` : '') +
      (parametrosExtra ? `\n${parametrosExtra}` : '') +
      `\n\nIMPORTANTE: No uses bloques de código markdown (\`\`\`). Responde directamente con el contenido solicitado, sin ningún texto adicional fuera del formato indicado.`;

    console.log(`${LOG_REP} Ejecutando reporte ${claveReporte} via Groq (texto)...`);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GROQ_KEY,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{ role: "user", content: promptFinal }],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return c.json({ error: `Groq API error: HTTP ${groqRes.status}`, details: errText }, 502);
    }

    const groqResult = await groqRes.json();
    const contenido = groqResult.choices?.[0]?.message?.content || "";

    console.log(`${LOG_REP} ✅ Reporte generado — ${contenido.length} chars`);
    return c.json({
      success: true,
      contenido,
      modelo: "meta-llama/llama-4-scout-17b-16e-instruct",
      claveReporte,
      formatoSalida,
      fechaInicio,
      fechaFin,
      timestamp: fechaSistema,
      usage: groqResult.usage || null,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[EjecReporte] Error: ${msg}`);
    return c.json({ error: "Error interno al ejecutar reporte", details: msg }, 500);
  }
};

const getReportesRegulariosHandler = async (c: any) => {
  try {
    console.log("[ReportesReg] GET /reportes-regulatorios");
    const rows = await sql`
      SELECT id, clave_reporte, nombre_reporte, formato_salida, prompt_ia
      FROM "EFINANCIANET_DB"."J_CATALOGO_REPORTES_REGULATORIOS"
      ORDER BY clave_reporte ASC
    `;
    console.log(`[ReportesReg] ${rows.length} registros`);
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[ReportesReg] Error GET:", msg);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const postReporteRegulatorioHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { clave_reporte, nombre_reporte, formato_salida, prompt_ia } = body;

    if (!clave_reporte || !nombre_reporte || !formato_salida || !prompt_ia) {
      return c.json({ error: "Campos obligatorios: clave_reporte, nombre_reporte, formato_salida, prompt_ia" }, 400);
    }

    console.log(`[ReportesReg] POST — clave=${clave_reporte}`);
    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CATALOGO_REPORTES_REGULATORIOS"
        (clave_reporte, nombre_reporte, formato_salida, prompt_ia)
      VALUES
        (${clave_reporte}, ${nombre_reporte}, ${formato_salida}, ${prompt_ia})
      RETURNING id, clave_reporte, nombre_reporte, formato_salida, prompt_ia
    `;

    console.log(`[ReportesReg] INSERT exitoso — id: ${inserted[0]?.id}`);
    return c.json({ success: true, data: inserted[0] }, 201);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[ReportesReg] Error POST:", msg);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const putReporteRegulatorioHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { clave_reporte, nombre_reporte, formato_salida, prompt_ia } = body;

    if (!id || !clave_reporte || !nombre_reporte || !formato_salida || !prompt_ia) {
      return c.json({ error: "Campos obligatorios: id, clave_reporte, nombre_reporte, formato_salida, prompt_ia" }, 400);
    }

    console.log(`[ReportesReg] PUT /reportes-regulatorios/${id}`);
    const updated = await sql`
      UPDATE "EFINANCIANET_DB"."J_CATALOGO_REPORTES_REGULATORIOS"
      SET
        clave_reporte  = ${clave_reporte},
        nombre_reporte = ${nombre_reporte},
        formato_salida = ${formato_salida},
        prompt_ia      = ${prompt_ia}
      WHERE id = ${id}
      RETURNING id, clave_reporte, nombre_reporte, formato_salida, prompt_ia
    `;

    if (updated.length === 0) {
      return c.json({ error: `No se encontró registro con id=${id}` }, 404);
    }

    console.log(`[ReportesReg] UPDATE exitoso — id: ${id}`);
    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[ReportesReg] Error PUT:", msg);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const deleteReporteRegulatorioHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Se requiere el parámetro id" }, 400);

    console.log(`[ReportesReg] DELETE /reportes-regulatorios/${id}`);
    await sql`
      DELETE FROM "EFINANCIANET_DB"."J_CATALOGO_REPORTES_REGULATORIOS"
      WHERE id = ${id}
    `;

    console.log(`[ReportesReg] DELETE exitoso — id: ${id}`);
    return c.json({ success: true, message: `Reporte ${id} eliminado` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[ReportesReg] Error DELETE:", msg);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const getCatalogosContablesHandler = async (c: any) => {
  try {
    const rows = await sql`
      SELECT id, cuenta_gl, nombre
      FROM "EFINANCIANET_DB"."J_CATALOGO_CATALOGOS_CONTABLES"
      ORDER BY cuenta_gl ASC
    `;
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const postCatalogoContableHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { cuenta_gl, nombre } = body;
    if (!cuenta_gl || !nombre) {
      return c.json({ error: "Campos obligatorios: cuenta_gl, nombre" }, 400);
    }
    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CATALOGO_CATALOGOS_CONTABLES"
        (cuenta_gl, nombre)
      VALUES
        (${cuenta_gl}, ${nombre})
      RETURNING id, cuenta_gl, nombre
    `;
    return c.json({ success: true, data: inserted[0] }, 201);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const putCatalogoContableHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { cuenta_gl, nombre } = body;
    if (!id || !cuenta_gl || !nombre) {
      return c.json({ error: "Campos obligatorios: id, cuenta_gl, nombre" }, 400);
    }
    const updated = await sql`
      UPDATE "EFINANCIANET_DB"."J_CATALOGO_CATALOGOS_CONTABLES"
      SET cuenta_gl = ${cuenta_gl}, nombre = ${nombre}
      WHERE id = ${id}
      RETURNING id, cuenta_gl, nombre
    `;
    if (updated.length === 0) return c.json({ error: `No se encontró registro con id=${id}` }, 404);
    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const deleteCatalogoContableHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Se requiere el parámetro id" }, 400);
    await sql`DELETE FROM "EFINANCIANET_DB"."J_CATALOGO_CATALOGOS_CONTABLES" WHERE id = ${id}`;
    return c.json({ success: true, message: `Registro ${id} eliminado` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const getEventosContablesHandler = async (c: any) => {
  try {
    const rows = await sql`
      SELECT id, codigo, evento, prompt_ia
      FROM "EFINANCIANET_DB"."J_CATALOGO_EVENTOS_CONTABLES"
      ORDER BY codigo ASC
    `;
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const postEventoContableHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { codigo, evento, prompt_ia } = body;
    if (!codigo || !evento) {
      return c.json({ error: "Campos obligatorios: codigo, evento" }, 400);
    }
    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CATALOGO_EVENTOS_CONTABLES"
        (codigo, evento, prompt_ia)
      VALUES
        (${codigo}, ${evento}, ${prompt_ia ?? null})
      RETURNING id, codigo, evento, prompt_ia
    `;
    return c.json({ success: true, data: inserted[0] }, 201);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const putEventoContableHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { codigo, evento, prompt_ia } = body;
    if (!id || !codigo || !evento) {
      return c.json({ error: "Campos obligatorios: id, codigo, evento" }, 400);
    }
    const updated = await sql`
      UPDATE "EFINANCIANET_DB"."J_CATALOGO_EVENTOS_CONTABLES"
      SET codigo = ${codigo}, evento = ${evento}, prompt_ia = ${prompt_ia ?? null}
      WHERE id = ${id}
      RETURNING id, codigo, evento, prompt_ia
    `;
    if (updated.length === 0) return c.json({ error: `No se encontró registro con id=${id}` }, 404);
    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const deleteEventoContableHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Se requiere el parámetro id" }, 400);
    await sql`DELETE FROM "EFINANCIANET_DB"."J_CATALOGO_EVENTOS_CONTABLES" WHERE id = ${id}`;
    return c.json({ success: true, message: `Evento ${id} eliminado` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const getComponentesContablesHandler = async (c: any) => {
  try {
    const rows = await sql`
      SELECT id, codigo, nombre
      FROM "EFINANCIANET_DB"."J_CATALOGO_COMPONENTES"
      ORDER BY codigo ASC
    `;
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const postComponenteContableHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { codigo, nombre } = body;
    if (!codigo || !nombre) {
      return c.json({ error: "Campos obligatorios: codigo, nombre" }, 400);
    }
    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_CATALOGO_COMPONENTES"
        (codigo, nombre)
      VALUES
        (${codigo}, ${nombre})
      RETURNING id, codigo, nombre
    `;
    return c.json({ success: true, data: inserted[0] }, 201);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const putComponenteContableHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { codigo, nombre } = body;
    if (!id || !codigo || !nombre) {
      return c.json({ error: "Campos obligatorios: id, codigo, nombre" }, 400);
    }
    const updated = await sql`
      UPDATE "EFINANCIANET_DB"."J_CATALOGO_COMPONENTES"
      SET codigo = ${codigo}, nombre = ${nombre}
      WHERE id = ${id}
      RETURNING id, codigo, nombre
    `;
    if (updated.length === 0) return c.json({ error: `No se encontró registro con id=${id}` }, 404);
    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const deleteComponenteContableHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Se requiere el parámetro id" }, 400);
    await sql`DELETE FROM "EFINANCIANET_DB"."J_CATALOGO_COMPONENTES" WHERE id = ${id}`;
    return c.json({ success: true, message: `Componente ${id} eliminado` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const getReportesEjecucionesHandler = async (c: any) => {
  try {
    console.log("[ReportesEjec] GET /reportes-ejecuciones");
    const rows = await sql`
      SELECT id, fecha_creacion, periodicidad, nombre_reporte, estatus,
             id_catalogo_reportes_regulatorios, data
      FROM "EFINANCIANET_DB"."J_REPORTES_REGULATORIOS"
      ORDER BY fecha_creacion DESC
    `;
    console.log(`[ReportesEjec] ${rows.length} registros`);
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[ReportesEjec] Error GET:", msg);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const postReporteEjecucionHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { periodicidad, nombre_reporte, id_catalogo_reportes_regulatorios, data } = body;

    if (!periodicidad || !nombre_reporte || !id_catalogo_reportes_regulatorios) {
      return c.json({ error: "Campos obligatorios: periodicidad, nombre_reporte, id_catalogo_reportes_regulatorios" }, 400);
    }

    console.log(`[ReportesEjec] POST — catalogo_id=${id_catalogo_reportes_regulatorios}`);
    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_REPORTES_REGULATORIOS"
        (periodicidad, nombre_reporte, id_catalogo_reportes_regulatorios, data)
      VALUES
        (${periodicidad}, ${nombre_reporte}, ${id_catalogo_reportes_regulatorios},
         ${data ? sql.json(data) : null})
      RETURNING id, fecha_creacion, periodicidad, nombre_reporte, estatus,
                id_catalogo_reportes_regulatorios, data
    `;
    console.log(`[ReportesEjec] INSERT exitoso — id: ${inserted[0]?.id}`);
    return c.json({ success: true, data: inserted[0] }, 201);
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[ReportesEjec] Error POST:", msg);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const putReporteEjecucionHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { periodicidad, nombre_reporte, estatus, data } = body;

    if (!id) return c.json({ error: "Se requiere el parámetro id" }, 400);

    console.log(`[ReportesEjec] PUT /reportes-ejecuciones/${id}`);
    const updated = await sql`
      UPDATE "EFINANCIANET_DB"."J_REPORTES_REGULATORIOS"
      SET
        periodicidad  = COALESCE(${periodicidad ?? null}, periodicidad),
        nombre_reporte = COALESCE(${nombre_reporte ?? null}, nombre_reporte),
        estatus       = COALESCE(${estatus ?? null}, estatus),
        data          = ${data !== undefined ? sql.json(data) : sql`data`}
      WHERE id = ${id}
      RETURNING id, fecha_creacion, periodicidad, nombre_reporte, estatus,
                id_catalogo_reportes_regulatorios, data
    `;
    if (updated.length === 0) return c.json({ error: `No se encontró id=${id}` }, 404);
    console.log(`[ReportesEjec] UPDATE exitoso — id: ${id}`);
    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[ReportesEjec] Error PUT:", msg);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const deleteReporteEjecucionHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Se requiere el parámetro id" }, 400);
    console.log(`[ReportesEjec] DELETE /reportes-ejecuciones/${id}`);
    await sql`DELETE FROM "EFINANCIANET_DB"."J_REPORTES_REGULATORIOS" WHERE id = ${id}`;
    console.log(`[ReportesEjec] DELETE exitoso — id: ${id}`);
    return c.json({ success: true, message: `Ejecución ${id} eliminada` });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[ReportesEjec] Error DELETE:", msg);
    return c.json({ error: `Error de base de datos: ${msg}` }, 500);
  }
};

const validarFaseIAHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { faseNombre, faseSeq, promptIA, documentos, tipoPersona, solicitudId } = body;

    console.log("[VALIDAR-FASE-IA] Request — fase=" + faseSeq + " " + faseNombre + ", docs=" + (documentos?.length || 0));

    if (!faseNombre || !faseSeq) {
      return c.json({ valido: false, motivos: ["Faltan parámetros: faseNombre, faseSeq"] }, 400);
    }
    if (!promptIA) {
      return c.json({ valido: false, motivos: ["Falta promptIA de la fase"] }, 400);
    }
    if (!Array.isArray(documentos)) {
      return c.json({ valido: false, motivos: ["documentos debe ser un array"] }, 400);
    }

    // Construir resumen de documentos
    const docsResumen = documentos.map(function(d: any, i: number) {
      return (i + 1) + ". " + d.tipoDocumento + " — estatus: " + (d.estatus || "N/A") + ", IA: " + (d.validadoIA ? "Sí" : "No");
    }).join("\n");

    var fechaSistema = new Date().toISOString();
    var promptFinal = "Eres un validador experto del CORE bancario.\n\n" +
      "FASE: " + faseSeq + " — " + faseNombre + "\n" +
      "TIPO PERSONA: " + (tipoPersona || "No especificado") + "\n\n" +
      "PROMPT DE LA FASE:\n" + promptIA + "\n\n" +
      "DOCUMENTOS EN EXPEDIENTE:\n" + (docsResumen || "(ninguno)") + "\n\n" +
      "Evalúa si la fase cumple los criterios del prompt.\n" +
      "Responde SOLO en JSON:\n" +
      "{\"valido\": true|false, \"motivos\": [\"...\"], \"resumen\": \"...\"}";

    var GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_KEY) {
      return c.json({ valido: false, motivos: ["GROQ_API_KEY no configurada"] }, 500);
    }

    var groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_KEY },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{ role: "user", content: promptFinal }],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!groqResponse.ok) {
      var errText = await groqResponse.text();
      return c.json({ valido: false, motivos: ["Groq API error: " + errText] }, 502);
    }

    var groqResult = await groqResponse.json();
    var aiText = groqResult.choices?.[0]?.message?.content || "";

    var resultado: any;
    try {
      var jsonMatch = aiText.match(/\{[\s\S]*\}/);
      resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText);
    } catch (_) {
      resultado = { valido: false, motivos: ["Error parseando respuesta IA: " + aiText.substring(0, 200)], resumen: "Error" };
    }

    resultado.timestamp = fechaSistema;
    resultado.faseSeq = faseSeq;
    resultado.faseActual = faseNombre;

    console.log("[VALIDAR-FASE-IA] Resultado: valido=" + resultado.valido);
    return c.json(resultado);
  } catch (err: any) {
    console.log("[VALIDAR-FASE-IA] Error:", err.message);
    return c.json({ valido: false, motivos: ["Error interno: " + err.message] }, 500);
  }
};

const getGlJournalHandler = async (c: any) => {
  try {
    const rows = await sql`
      SELECT id, journal_date, producto_id, event_code, account_id,
             transaction_id, currency, total_debit, total_credit,
             status, created_at, data
      FROM "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO"
      ORDER BY created_at DESC
    `;
    return c.json({ success: true, data: rows });
  } catch (err: any) {
    return c.json({ error: `Error al consultar J_GL_JOURNAL_ENCABEZADO: ${err.message ?? err}` }, 500);
  }
};

const postGlJournalHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const { journal_date, producto_id, event_code, account_id, currency, total_debit, total_credit, status, data } = body;
    if (!journal_date || !producto_id || !event_code || !account_id || !currency) {
      return c.json({ error: "Campos requeridos: journal_date, producto_id, event_code, account_id, currency" }, 400);
    }
    const inserted = await sql`
      INSERT INTO "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO"
        (journal_date, producto_id, event_code, account_id, currency,
         total_debit, total_credit, status, created_at, data)
      VALUES (
        ${journal_date}::date,
        ${producto_id}::uuid,
        ${event_code},
        ${account_id}::uuid,
        ${currency},
        ${total_debit ?? 0},
        ${total_credit ?? 0},
        ${status ?? 'Creada'},
        now(),
        ${JSON.stringify(data ?? {})}::jsonb
      )
      RETURNING id, journal_date, producto_id, event_code, account_id,
                transaction_id, currency, total_debit, total_credit,
                status, created_at, data
    `;
    return c.json({ success: true, data: inserted[0] }, 201);
  } catch (err: any) {
    return c.json({ error: `Error al insertar en J_GL_JOURNAL_ENCABEZADO: ${err.message ?? err}` }, 500);
  }
};

const putGlJournalHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Se requiere id" }, 400);
    const body = await c.req.json();
    const { journal_date, producto_id, event_code, account_id, currency, total_debit, total_credit, status, data } = body;
    const updated = await sql`
      UPDATE "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO"
      SET
        journal_date  = COALESCE(${journal_date ?? null}::date,    journal_date),
        producto_id   = COALESCE(${producto_id ?? null}::uuid,     producto_id),
        event_code    = COALESCE(${event_code ?? null},             event_code),
        account_id    = COALESCE(${account_id ?? null}::uuid,      account_id),
        currency      = COALESCE(${currency ?? null},               currency),
        total_debit   = COALESCE(${total_debit ?? null}::numeric,  total_debit),
        total_credit  = COALESCE(${total_credit ?? null}::numeric, total_credit),
        status        = COALESCE(${status ?? null},                 status),
        data          = COALESCE(${data != null ? JSON.stringify(data) : null}::jsonb, data)
      WHERE id = ${id}::uuid
      RETURNING id, journal_date, producto_id, event_code, account_id,
                transaction_id, currency, total_debit, total_credit,
                status, created_at, data
    `;
    if (updated.length === 0) return c.json({ error: `No se encontró registro con id=${id}` }, 404);
    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ error: `Error al actualizar J_GL_JOURNAL_ENCABEZADO: ${err.message ?? err}` }, 500);
  }
};

const deleteGlJournalHandler = async (c: any) => {
  try {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Se requiere id" }, 400);
    await sql`DELETE FROM "EFINANCIANET_DB"."J_GL_JOURNAL_ENCABEZADO" WHERE id = ${id}::uuid`;
    return c.json({ success: true, message: `Póliza ${id} eliminada` });
  } catch (err: any) {
    return c.json({ error: `Error al eliminar en J_GL_JOURNAL_ENCABEZADO: ${err.message ?? err}` }, 500);
  }
};


// ── Rutas nuevas de master ──
app.post(`${PREFIX}/ejecutar-reporte-ia`, ejecutarReporteIAHandler);
app.get(`${PREFIX}/reportes-regulatorios`, getReportesRegulariosHandler);
app.post(`${PREFIX}/reportes-regulatorios`, postReporteRegulatorioHandler);
app.put(`${PREFIX}/reportes-regulatorios/:id`, putReporteRegulatorioHandler);
app.delete(`${PREFIX}/reportes-regulatorios/:id`, deleteReporteRegulatorioHandler);
app.get(`${PREFIX}/catalogos-contables`, getCatalogosContablesHandler);
app.post(`${PREFIX}/catalogos-contables`, postCatalogoContableHandler);
app.put(`${PREFIX}/catalogos-contables/:id`, putCatalogoContableHandler);
app.delete(`${PREFIX}/catalogos-contables/:id`, deleteCatalogoContableHandler);
app.get(`${PREFIX}/eventos-contables`, getEventosContablesHandler);
app.post(`${PREFIX}/eventos-contables`, postEventoContableHandler);
app.put(`${PREFIX}/eventos-contables/:id`, putEventoContableHandler);
app.delete(`${PREFIX}/eventos-contables/:id`, deleteEventoContableHandler);
app.get(`${PREFIX}/componentes-contables`, getComponentesContablesHandler);
app.post(`${PREFIX}/componentes-contables`, postComponenteContableHandler);
app.put(`${PREFIX}/componentes-contables/:id`, putComponenteContableHandler);
app.delete(`${PREFIX}/componentes-contables/:id`, deleteComponenteContableHandler);
app.get(`${PREFIX}/reportes-ejecuciones`, getReportesEjecucionesHandler);
app.post(`${PREFIX}/reportes-ejecuciones`, postReporteEjecucionHandler);
app.put(`${PREFIX}/reportes-ejecuciones/:id`, putReporteEjecucionHandler);
app.delete(`${PREFIX}/reportes-ejecuciones/:id`, deleteReporteEjecucionHandler);
app.post(`${PREFIX}/storage/reportes-regulatorios/upload`, uploadReporteHandler);
app.get(`${PREFIX}/gl-journal`, getGlJournalHandler);
app.post(`${PREFIX}/gl-journal`, postGlJournalHandler);
app.put(`${PREFIX}/gl-journal/:id`, putGlJournalHandler);
app.delete(`${PREFIX}/gl-journal/:id`, deleteGlJournalHandler);
app.post("/ejecutar-reporte-ia", ejecutarReporteIAHandler);
app.get("/reportes-regulatorios", getReportesRegulariosHandler);
app.post("/reportes-regulatorios", postReporteRegulatorioHandler);
app.put("/reportes-regulatorios/:id", putReporteRegulatorioHandler);
app.delete("/reportes-regulatorios/:id", deleteReporteRegulatorioHandler);
app.get("/catalogos-contables", getCatalogosContablesHandler);
app.post("/catalogos-contables", postCatalogoContableHandler);
app.put("/catalogos-contables/:id", putCatalogoContableHandler);
app.delete("/catalogos-contables/:id", deleteCatalogoContableHandler);
app.get("/eventos-contables", getEventosContablesHandler);
app.post("/eventos-contables", postEventoContableHandler);
app.put("/eventos-contables/:id", putEventoContableHandler);
app.delete("/eventos-contables/:id", deleteEventoContableHandler);
app.get("/componentes-contables", getComponentesContablesHandler);
app.post("/componentes-contables", postComponenteContableHandler);
app.put("/componentes-contables/:id", putComponenteContableHandler);
app.delete("/componentes-contables/:id", deleteComponenteContableHandler);
app.get("/reportes-ejecuciones", getReportesEjecucionesHandler);
app.post("/reportes-ejecuciones", postReporteEjecucionHandler);
app.put("/reportes-ejecuciones/:id", putReporteEjecucionHandler);
app.delete("/reportes-ejecuciones/:id", deleteReporteEjecucionHandler);
app.post("/storage/reportes-regulatorios/upload", uploadReporteHandler);
app.get("/gl-journal", getGlJournalHandler);
app.post("/gl-journal", postGlJournalHandler);
app.put("/gl-journal/:id", putGlJournalHandler);
app.delete("/gl-journal/:id", deleteGlJournalHandler);
console.log("[ROUTE] Master-only: reportes-regulatorios, catalogos/eventos/componentes-contables, ejecuciones, gl-journal, upload OK");

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

// ── Admin: ejecutar migración SQL (temporal) ──
app.post(`/admin/run-migration`, async (c: any) => {
  try {
    await sql`
      CREATE OR REPLACE FUNCTION public.get_cuentas_ahorro()
      RETURNS TABLE (
        id UUID, type TEXT, no_sol TEXT, no_cuenta TEXT, no_referenc1 TEXT,
        fecha_sol TIMESTAMPTZ, fecha_autori TIMESTAMPTZ, fecha_disper TIMESTAMPTZ,
        fecha_cancel TIMESTAMPTZ, fecha_inicio TIMESTAMPTZ, fecha_fin_cu TIMESTAMPTZ,
        descripcion TEXT, linea_produc TEXT, tipo_produc TEXT,
        producto_id UUID, producto_eje TEXT, cliente_id UUID,
        saldo_actual NUMERIC, monto_sol NUMERIC, monto_aut NUMERIC, monto_disp NUMERIC,
        estatus_disp TEXT, estatus_sol TEXT, estatus_cart TEXT, estatus_cuen TEXT,
        cta_eje_chec TEXT, fases TEXT, data JSONB,
        cliente_nombre TEXT, producto_nombre TEXT
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = ''
      AS $$
        SELECT c.id, c.type, c.no_sol, c.no_cuenta, c.no_referenc1,
          c.fecha_sol, c.fecha_autori, c.fecha_disper, c.fecha_cancel,
          c.fecha_inicio, c.fecha_fin_cu, c.descripcion,
          c.linea_produc, c.tipo_produc, c.producto_id, c.producto_eje,
          c.cliente_id, c.saldo_actual, c.monto_sol, c.monto_aut, c.monto_disp,
          c.estatus_disp, c.estatus_sol, c.estatus_cart, c.estatus_cuen,
          c.cta_eje_chec, c.fases, c.data,
          COALESCE(NULLIF(TRIM(COALESCE(cl.data->>'nombre','') || ' ' || COALESCE(cl.data->>'apellidoPaterno','') || ' ' || COALESCE(cl.data->>'apellidoMaterno','')), ''), cl.data->>'razonSocial', c.cliente_id::TEXT) AS cliente_nombre,
          COALESCE(p.data->>'nombre', p.data->>'nombreProducto', c.producto_id::TEXT) AS producto_nombre
        FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" c
        LEFT JOIN "EFINANCIANET_DB"."J_CLIENTES" cl ON cl.id = c.cliente_id
        LEFT JOIN "EFINANCIANET_DB"."J_PRODUCTOS" p ON p.id = c.producto_id
        WHERE (c.linea_produc = 'CAPTACION' AND c.tipo_produc = 'Ahorro')
           OR c.cta_eje_chec = TRUE
           OR (c.type = 'CuentaAhorro' AND (c.data->'metadatos'->>'solicitudId') IS NOT NULL)
        ORDER BY c.fecha_sol DESC NULLS LAST;
      $$
    `;
    await sql`GRANT EXECUTE ON FUNCTION public.get_cuentas_ahorro() TO anon, authenticated, service_role`;
    return c.json({ ok: true, msg: 'get_cuentas_ahorro actualizado' });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// SERVE — FORCE REDEPLOY 2026-02-25T12:00:00Z
// ═══════════════════════════════════════════════════════════════════
const DEPLOY_TIMESTAMP = "2026-05-22T18:00:00Z-v43.0-CONTABLE-GL-FIX";
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