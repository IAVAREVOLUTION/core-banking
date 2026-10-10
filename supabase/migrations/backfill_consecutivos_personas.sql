-- =============================================================================
-- REQ-01 — Backfill: consecutivo de 10 dígitos para Personas existentes
--
-- Requiere haber ejecutado antes create_consecutivos_personas.sql.
-- Conviene correrlo justo después, antes de que se den de alta personas
-- nuevas, para que los registros históricos reciban los números más bajos.
--
-- Qué hace:
--   1. Asigna consecutivo (data.idCliente = data.idProspecto) a cada fila de
--      J_CLIENTES que aún no tiene uno de 10 dígitos, en orden de
--      fechaOriginacion → número PROS-XXX → id. Usa fn_siguiente_consecutivo,
--      así J_CONSECUTIVOS queda en el último número asignado.
--   2. Guarda el mapeo id anterior → id nuevo en J_CONSECUTIVOS_MAPEO_PERSONAS.
--   3. Actualiza las COPIAS del ID legible en todas las columnas jsonb del
--      esquema (claveCliente, idCliente, idProspecto, noCliente, ...).
--      Las ligas reales entre tablas son por UUID y no se tocan. Para decidir
--      a qué persona pertenece una copia, en este orden:
--        a) el mismo objeto JSON trae el UUID de la persona (clienteUuid,
--           clienteId, leadOrigenId, dbUuid, cliente_id) → id nuevo de esa persona;
--        b) la fila tiene columna cliente_id y el valor coincide con un id
--           anterior de ESA persona → id nuevo;
--        c) el valor es un id anterior que pertenecía a UNA sola persona
--           (los repetidos o muy cortos, p. ej. "3", no se tocan) → id nuevo.
--      Lo que no cumpla ninguna regla se deja igual y se reporta.
--   4. Respalda cada valor jsonb antes de cambiarlo en
--      J_CONSECUTIVOS_RESPALDO (para revertir).
--   5. Columnas de texto que contengan un id anterior solo se REPORTAN.
--
-- CÓMO USARLO (Supabase → SQL Editor):
--   a) Ejecutar este archivo completo (solo crea funciones y tablas).
--   b) Simulación, no cambia nada:
--        SELECT * FROM "EFINANCIANET_DB".fn_backfill_consecutivos_personas(false);
--   c) Revisar el reporte y aplicar:
--        SELECT * FROM "EFINANCIANET_DB".fn_backfill_consecutivos_personas(true);
--   d) Si algo sale mal, revertir:
--        SELECT "EFINANCIANET_DB".fn_revertir_backfill_consecutivos_personas();
-- =============================================================================

CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CONSECUTIVOS_MAPEO_PERSONAS" (
  cliente_id            uuid        PRIMARY KEY,
  id_anterior_prospecto varchar     NULL,
  id_anterior_cliente   varchar     NULL,
  id_nuevo              varchar     NOT NULL UNIQUE,
  fecha                 timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "EFINANCIANET_DB"."J_CONSECUTIVOS_MAPEO_PERSONAS" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CONSECUTIVOS_RESPALDO" (
  id             bigserial   PRIMARY KEY,
  tabla          varchar     NOT NULL,
  columna        varchar     NOT NULL,
  columna_pk     varchar     NOT NULL,
  pk             text        NOT NULL,
  valor_anterior jsonb       NULL,
  fecha          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "EFINANCIANET_DB"."J_CONSECUTIVOS_RESPALDO" ENABLE ROW LEVEL SECURITY;

-- ── Reemplazo recursivo de copias del ID dentro de un jsonb ──────────────────
-- Lee las tablas temporales _bf_map / _bf_glob que crea el backfill.
CREATE OR REPLACE FUNCTION "EFINANCIANET_DB".fn_bf_mapear_clave(j jsonb, p_ctx uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  c_claves CONSTANT text[] := ARRAY['claveCliente','clienteClave','cliente_clave','idCliente',
                                    'idProspecto','noCliente','numCliente','numProspecto'];
  c_ligas  CONSTANT text[] := ARRAY['clienteUuid','clienteId','cliente_id','leadOrigenId',
                                    'dbUuid','clienteDbUuid'];
  c_uuid   CONSTANT text   := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_res   jsonb;
  v_own   uuid;
  v_lk    text;
  v_val   text;
  v_nuevo varchar;
  k       text;
  v       jsonb;
BEGIN
  IF jsonb_typeof(j) = 'array' THEN
    SELECT COALESCE(jsonb_agg("EFINANCIANET_DB".fn_bf_mapear_clave(e, p_ctx) ORDER BY o), '[]'::jsonb)
      INTO v_res
      FROM jsonb_array_elements(j) WITH ORDINALITY AS t(e, o);
    RETURN v_res;
  ELSIF jsonb_typeof(j) IS DISTINCT FROM 'object' THEN
    RETURN j;
  END IF;

  -- a) ¿El objeto trae el UUID de una persona mapeada?
  FOREACH v_lk IN ARRAY c_ligas LOOP
    v_val := j->>v_lk;
    IF v_val ~ c_uuid AND EXISTS (SELECT 1 FROM _bf_map WHERE cliente_id = v_val::uuid) THEN
      v_own := v_val::uuid;
      EXIT;
    END IF;
  END LOOP;

  v_res := '{}'::jsonb;
  FOR k, v IN SELECT * FROM jsonb_each(j) LOOP
    IF k = ANY (c_claves) AND jsonb_typeof(v) = 'string' THEN
      v_val := v #>> '{}';
      v_nuevo := NULL;
      -- Vacíos, UUIDs y consecutivos ya asignados no son copias a migrar.
      IF v_val <> '' AND v_val !~ c_uuid AND v_val !~ '^[0-9]{10}$' THEN
        IF v_own IS NOT NULL THEN
          SELECT id_nuevo INTO v_nuevo FROM _bf_map WHERE cliente_id = v_own;
        ELSIF p_ctx IS NOT NULL THEN
          SELECT id_nuevo INTO v_nuevo FROM _bf_map
           WHERE cliente_id = p_ctx AND v_val = ANY (ids_anteriores);
        END IF;
        IF v_nuevo IS NULL THEN
          SELECT id_nuevo INTO v_nuevo FROM _bf_glob WHERE id_anterior = v_val;
        END IF;
        IF v_nuevo IS NOT NULL THEN
          v := to_jsonb(v_nuevo);
        END IF;
      END IF;
    ELSE
      v := "EFINANCIANET_DB".fn_bf_mapear_clave(v, p_ctx);
    END IF;
    v_res := v_res || jsonb_build_object(k, v);
  END LOOP;
  RETURN v_res;
END;
$$;

-- ── Backfill ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "EFINANCIANET_DB".fn_backfill_consecutivos_personas(p_aplicar boolean DEFAULT false)
RETURNS TABLE (seccion text, tabla text, columna text, filas int, detalle text)
LANGUAGE plpgsql
AS $$
DECLARE
  c_uuid  CONSTANT text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  c_excluir CONSTANT text[] := ARRAY['J_CONSECUTIVOS','J_CONSECUTIVOS_MAPEO_PERSONAS','J_CONSECUTIVOS_RESPALDO'];
  v_rep    jsonb := '[]'::jsonb;
  r        record;
  t        record;
  v_pk     text;
  v_ctx    text;
  v_nuevo  jsonb;
  v_num    varchar;
  v_cambia int;
  v_err    int;
  v_msg    text;
  v_cnt    int;
BEGIN
  IF to_regclass('"EFINANCIANET_DB"."J_CONSECUTIVOS"') IS NULL THEN
    RAISE EXCEPTION 'Primero ejecute create_consecutivos_personas.sql';
  END IF;

  BEGIN
    LOCK TABLE "EFINANCIANET_DB"."J_CLIENTES" IN EXCLUSIVE MODE;

    IF to_regclass('pg_temp._bf_map') IS NOT NULL THEN DROP TABLE _bf_map; END IF;
    IF to_regclass('pg_temp._bf_glob') IS NOT NULL THEN DROP TABLE _bf_glob; END IF;
    CREATE TEMP TABLE _bf_map (cliente_id uuid PRIMARY KEY, id_nuevo varchar, ids_anteriores text[]) ON COMMIT DROP;
    CREATE TEMP TABLE _bf_glob (id_anterior text PRIMARY KEY, id_nuevo varchar) ON COMMIT DROP;

    -- ── 1. Asignar consecutivo a las personas existentes ──
    v_cnt := 0;
    FOR r IN
      SELECT c.id, c.data->>'idProspecto' AS ant_pros, c.data->>'idCliente' AS ant_cli
        FROM "EFINANCIANET_DB"."J_CLIENTES" c
       WHERE COALESCE(c.data->>'idCliente', '') !~ '^[0-9]{10}$'
       ORDER BY CASE WHEN c.data->>'fechaOriginacion' ~ '^\d{4}-\d{2}-\d{2}'
                     THEN left(c.data->>'fechaOriginacion', 10)::date END NULLS LAST,
                CASE WHEN c.data->>'idProspecto' ~ '^PROS-\d{1,9}$'
                     THEN substring(c.data->>'idProspecto' FROM 6)::int END NULLS LAST,
                c.id
    LOOP
      v_num := "EFINANCIANET_DB".fn_siguiente_consecutivo('PERSONAS');

      INSERT INTO "EFINANCIANET_DB"."J_CONSECUTIVOS_RESPALDO" (tabla, columna, columna_pk, pk, valor_anterior)
      SELECT 'J_CLIENTES', 'data', 'id', c.id::text, c.data
        FROM "EFINANCIANET_DB"."J_CLIENTES" c WHERE c.id = r.id;

      UPDATE "EFINANCIANET_DB"."J_CLIENTES"
         SET data = data || jsonb_build_object('idCliente', v_num, 'idProspecto', v_num)
       WHERE id = r.id;

      INSERT INTO "EFINANCIANET_DB"."J_CONSECUTIVOS_MAPEO_PERSONAS"
             (cliente_id, id_anterior_prospecto, id_anterior_cliente, id_nuevo)
      VALUES (r.id, NULLIF(r.ant_pros, ''), NULLIF(r.ant_cli, ''), v_num)
      ON CONFLICT (cliente_id) DO UPDATE
         SET id_anterior_prospecto = EXCLUDED.id_anterior_prospecto,
             id_anterior_cliente   = EXCLUDED.id_anterior_cliente,
             id_nuevo              = EXCLUDED.id_nuevo,
             fecha                 = now();

      INSERT INTO _bf_map VALUES (
        r.id, v_num,
        array_remove(ARRAY[NULLIF(r.ant_pros, ''), NULLIF(r.ant_cli, ''), left(r.id::text, 8)], NULL));
      v_cnt := v_cnt + 1;
    END LOOP;
    v_rep := v_rep || jsonb_build_object('seccion', '1. Personas', 'tabla', 'J_CLIENTES', 'columna', 'data',
               'filas', v_cnt, 'detalle', 'Consecutivo asignado a registros existentes');

    -- Ids anteriores que identifican a UNA sola persona (aptos para coincidencia de texto)
    INSERT INTO _bf_glob
    SELECT a.id_anterior, min(m.id_nuevo)
      FROM _bf_map m, unnest(m.ids_anteriores) AS a(id_anterior)
     WHERE length(a.id_anterior) >= 5 AND a.id_anterior !~ c_uuid
     GROUP BY a.id_anterior
    HAVING count(DISTINCT m.cliente_id) = 1;

    SELECT count(*) INTO v_cnt FROM (
      SELECT a.id_anterior FROM _bf_map m, unnest(m.ids_anteriores) AS a(id_anterior)
       GROUP BY a.id_anterior HAVING count(DISTINCT m.cliente_id) > 1) x;
    IF v_cnt > 0 THEN
      v_rep := v_rep || jsonb_build_object('seccion', '1. Personas', 'tabla', 'J_CLIENTES', 'columna', 'data',
                 'filas', v_cnt, 'detalle',
                 'Ids anteriores repetidos entre personas: sus copias solo se migran por liga UUID');
    END IF;

    -- ── 2. Actualizar copias en todas las columnas jsonb del esquema ──
    FOR t IN
      SELECT c.table_name AS tbl, c.column_name AS col,
             EXISTS (SELECT 1 FROM information_schema.columns x
                      WHERE x.table_schema = c.table_schema AND x.table_name = c.table_name
                        AND x.column_name = 'cliente_id') AS tiene_ctx
        FROM information_schema.columns c
        JOIN information_schema.tables tb
          ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
       WHERE c.table_schema = 'EFINANCIANET_DB' AND c.data_type = 'jsonb'
         AND NOT (c.table_name = ANY (c_excluir))
       ORDER BY 1, 2
    LOOP
      SELECT string_agg(a.attname, ',') INTO v_pk
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
       WHERE i.indrelid = format('%I.%I', 'EFINANCIANET_DB', t.tbl)::regclass AND i.indisprimary;

      IF v_pk IS NULL OR v_pk LIKE '%,%' THEN
        v_rep := v_rep || jsonb_build_object('seccion', '2. Copias', 'tabla', t.tbl, 'columna', t.col,
                   'filas', 0, 'detalle', 'OMITIDA: sin llave primaria simple, revisar manualmente');
        CONTINUE;
      END IF;

      v_ctx := CASE WHEN t.tiene_ctx AND t.tbl <> 'J_CLIENTES'
                    THEN format('CASE WHEN cliente_id::text ~ %L THEN cliente_id::text::uuid END', c_uuid)
                    ELSE 'NULL::uuid' END;
      v_cambia := 0; v_err := 0; v_msg := NULL;

      FOR r IN EXECUTE format('SELECT %I::text AS pk, %I AS j, %s AS ctx FROM %I.%I WHERE %I IS NOT NULL',
                              v_pk, t.col, v_ctx, 'EFINANCIANET_DB', t.tbl, t.col)
      LOOP
        v_nuevo := "EFINANCIANET_DB".fn_bf_mapear_clave(r.j, r.ctx);
        IF v_nuevo IS DISTINCT FROM r.j THEN
          BEGIN
            INSERT INTO "EFINANCIANET_DB"."J_CONSECUTIVOS_RESPALDO" (tabla, columna, columna_pk, pk, valor_anterior)
            VALUES (t.tbl, t.col, v_pk, r.pk, r.j);
            EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE %I::text = $2', 'EFINANCIANET_DB', t.tbl, t.col, v_pk)
              USING v_nuevo, r.pk;
            v_cambia := v_cambia + 1;
          EXCEPTION WHEN others THEN
            -- p. ej. un trigger de validación de la tabla rechaza la fila:
            -- se deja como estaba y se reporta.
            v_err := v_err + 1;
            v_msg := COALESCE(v_msg || ' | ', '') || r.pk || ': ' || SQLERRM;
          END;
        END IF;
      END LOOP;

      IF v_cambia > 0 THEN
        v_rep := v_rep || jsonb_build_object('seccion', '2. Copias', 'tabla', t.tbl, 'columna', t.col,
                   'filas', v_cambia, 'detalle', 'Filas con copias del id actualizadas');
      END IF;
      IF v_err > 0 THEN
        v_rep := v_rep || jsonb_build_object('seccion', '2. Copias', 'tabla', t.tbl, 'columna', t.col,
                   'filas', v_err, 'detalle', 'ERROR, no actualizadas: ' || left(v_msg, 800));
      END IF;
    END LOOP;

    -- ── 3. Columnas de texto con ids anteriores: solo reporte ──
    FOR t IN
      SELECT c.table_name AS tbl, c.column_name AS col
        FROM information_schema.columns c
        JOIN information_schema.tables tb
          ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
       WHERE c.table_schema = 'EFINANCIANET_DB'
         AND c.data_type IN ('text', 'character varying')
         AND NOT (c.table_name = ANY (c_excluir))
    LOOP
      EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I IN (SELECT id_anterior FROM _bf_glob)',
                     'EFINANCIANET_DB', t.tbl, t.col) INTO v_cnt;
      IF v_cnt > 0 THEN
        v_rep := v_rep || jsonb_build_object('seccion', '3. Revisar', 'tabla', t.tbl, 'columna', t.col,
                   'filas', v_cnt, 'detalle', 'Columna de texto con ids anteriores (no se modificó)');
      END IF;
    END LOOP;

    IF NOT p_aplicar THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '__SIMULACION__';
    END IF;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '__SIMULACION__' THEN RAISE; END IF;
    -- Simulación: todos los cambios del bloque se revirtieron; el reporte se conserva.
  END;

  RETURN QUERY
  SELECT CASE WHEN p_aplicar THEN '' ELSE '[SIMULACION] ' END || x.seccion, x.tabla, x.columna, x.filas, x.detalle
    FROM jsonb_to_recordset(v_rep) AS x(seccion text, tabla text, columna text, filas int, detalle text);
END;
$$;

-- ── Revertir ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "EFINANCIANET_DB".fn_revertir_backfill_consecutivos_personas()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  r     record;
  v_n   int := 0;
  v_max bigint;
BEGIN
  -- El trigger impide cambiar un consecutivo ya asignado; se suspende solo aquí.
  ALTER TABLE "EFINANCIANET_DB"."J_CLIENTES" DISABLE TRIGGER "trg_asignar_consecutivo_persona";

  -- En orden inverso: la primera imagen respaldada de cada fila queda al final.
  FOR r IN SELECT * FROM "EFINANCIANET_DB"."J_CONSECUTIVOS_RESPALDO" ORDER BY id DESC LOOP
    EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE %I::text = $2',
                   'EFINANCIANET_DB', r.tabla, r.columna, r.columna_pk)
      USING r.valor_anterior, r.pk;
    v_n := v_n + 1;
  END LOOP;

  ALTER TABLE "EFINANCIANET_DB"."J_CLIENTES" ENABLE TRIGGER "trg_asignar_consecutivo_persona";

  DELETE FROM "EFINANCIANET_DB"."J_CONSECUTIVOS_RESPALDO";
  DELETE FROM "EFINANCIANET_DB"."J_CONSECUTIVOS_MAPEO_PERSONAS";

  -- El contador vuelve al mayor consecutivo que siga en uso (altas posteriores).
  SELECT COALESCE(max((data->>'idCliente')::bigint), 0) INTO v_max
    FROM "EFINANCIANET_DB"."J_CLIENTES" WHERE data->>'idCliente' ~ '^[0-9]{10}$';
  UPDATE "EFINANCIANET_DB"."J_CONSECUTIVOS"
     SET ultimo_consecutivo = v_max, fecha_actualizacion = now()
   WHERE entidad = 'PERSONAS';

  RETURN v_n || ' valores restaurados; contador PERSONAS = ' || v_max;
END;
$$;

REVOKE ALL ON FUNCTION "EFINANCIANET_DB".fn_backfill_consecutivos_personas(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "EFINANCIANET_DB".fn_revertir_backfill_consecutivos_personas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "EFINANCIANET_DB".fn_bf_mapear_clave(jsonb, uuid) FROM PUBLIC, anon, authenticated;
