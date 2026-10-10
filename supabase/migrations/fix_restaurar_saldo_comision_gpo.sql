-- =============================================================================
-- FIX: Saldo Monto Garantía consumido por pagos de Comisión GPO
--
-- Hasta el deploy del 30/09/2026, `PATCH /cartera/facturas/:id/pagar` trataba
-- TODO aviso como abono a capital: al marcar pagada una comisión GPO restaba su
-- importe de `saldo_actual`, la columna que alimenta "Saldo Monto Garantía".
-- Cobrar la comisión periódica de una garantía no consume la garantía, así que
-- cada cobro le quitaba cobertura real al cliente. El handler ya está corregido.
--
-- ALCANCE: sólo `saldo_actual`. `monto_aut` conserva su comportamiento (Req 13).
--
-- ⚠️ LEA ESTO ANTES DE ESCRIBIR CUALQUIER UPDATE SOBRE ESTA TABLA ⚠️
--
--   En `J_CUENTAS_CORP_CLIENTES` la columna `data` NO es un objeto jsonb en la
--   mayoría de las filas: es una CADENA jsonb que contiene el JSON. Al 30/09/2026
--   eran 131 de 155 filas.
--
--   El operador `||` sólo fusiona entre objetos. Entre una cadena y un objeto
--   construye un ARRAY:
--
--       '"{\"solicitud\":...}"'::jsonb || '{"x":1}'::jsonb
--          →  ["{\"solicitud\":...}", {"x":1}]
--
--   La primera versión de este script usaba `data || jsonb_build_object(...)`
--   para sellar la corrección y dejó dos filas en ese estado: la app dejó de
--   leerlas (el contenido quedó envuelto, no borrado). El PASO 3 repara eso.
--
--   Por eso este script YA NO TOCA `data`. Y por eso NO es idempotente:
--   ejecútelo UNA sola vez. El PASO 1 le dice si ya se aplicó.
-- =============================================================================


-- ── PASO 1 — DIAGNÓSTICO (no modifica nada) ─────────────────────────────────
WITH comisiones AS (
  SELECT f.solicitud_id,
         count(*) AS pagos,
         sum(trim(replace(replace(f.monto_transaccion::text, '$', ''), ',', ''))::numeric) AS total
    FROM "EFINANCIANET_DB"."J_FACTURAS" f
   WHERE f.sub_tipo = 'ComisionGPO'
     AND f.estatus  = 'Pagado'
   GROUP BY f.solicitud_id
)
SELECT cc.no_sol,
       c.pagos                                              AS comisiones_cobradas,
       c.total                                              AS a_restaurar,
       cc.saldo_actual::text                                AS saldo_hoy,
       ((cc.saldo_actual::numeric) + c.total)::money::text  AS saldo_corregido,
       CASE WHEN cc.saldo_actual::numeric > 0
            THEN 'se corrige'
            ELSE 'NO se toca — un 0 es ambiguo (ver PASO 2)' END AS accion
  FROM comisiones c
  JOIN "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" cc ON cc.id = c.solicitud_id
 ORDER BY cc.no_sol;


-- ── PASO 2 — CORRECCIÓN ─────────────────────────────────────────────────────
-- Descomente y ejecute UNA vez, después de revisar el paso 1.
--
-- Sólo se corrigen las líneas con `saldo_actual > 0`. Un 0 puede significar tres
-- cosas que no se pueden distinguir —nunca se sembró, una disposición lo agotó,
-- o el descuento lo dejó en el piso de `max(0, saldo - monto)`— y escribirle el
-- importe de la comisión marcaría la línea como "sembrada" con una cifra
-- inventada: en `resolverSaldoGarantia`, un saldo > 0 gana sobre el Monto
-- Garantizado de los términos, así que la pantalla pasaría a mostrar unos pocos
-- millones en lugar de la garantía real.
/*
WITH comisiones AS (
  SELECT f.solicitud_id,
         sum(trim(replace(replace(f.monto_transaccion::text, '$', ''), ',', ''))::numeric) AS total
    FROM "EFINANCIANET_DB"."J_FACTURAS" f
   WHERE f.sub_tipo = 'ComisionGPO'
     AND f.estatus  = 'Pagado'
   GROUP BY f.solicitud_id
)
UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" cc
   SET saldo_actual = ((cc.saldo_actual::numeric) + c.total)::money
  FROM comisiones c
 WHERE cc.id = c.solicitud_id
   AND cc.saldo_actual::numeric > 0
RETURNING cc.no_sol, cc.saldo_actual::text AS saldo_nuevo;
*/


-- ── PASO 3 — REPARAR FILAS CON `data` ENVUELTO EN ARRAY ─────────────────────
-- Devuelve `data` a su forma original tomando el elemento [0], que es donde
-- quedó el contenido íntegro. Aplica tanto a las filas que envolvió la primera
-- versión de este script como a las que rompe `escribirMovimientoEnCuenta` en
-- la Edge Function (ver nota al final).
--
-- Diagnóstico:
/*
SELECT no_sol,
       jsonb_array_length(data)                        AS elementos,
       jsonb_typeof((data->>0)::jsonb)                 AS contenido_recuperable,
       ((data->>0)::jsonb ? 'solicitud')               AS tiene_solicitud
  FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
 WHERE jsonb_typeof(data) = 'array'
 ORDER BY no_sol;
*/
--
-- Reparación (el guard evita tocar filas cuyo [0] no sea un objeto válido):
/*
UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
   SET data = to_jsonb(data->>0)
 WHERE jsonb_typeof(data) = 'array'
   AND jsonb_typeof((data->>0)::jsonb) = 'object'
RETURNING no_sol, jsonb_typeof(data) AS tipo;
*/


-- ── PENDIENTE DE FONDO ──────────────────────────────────────────────────────
-- `escribirMovimientoEnCuenta` y `replicarEnCuentaEje` leen `data` asumiendo
-- objeto y hacen `{ ...existingData, movimientos }`. Sobre una CADENA, el spread
-- la desarma carácter por carácter y produce `{"0":"{","1":"\"",...}`; por eso
-- hay filas con llaves numéricas. `parseJsonbData` debe devolver objeto siempre.
-- Mientras no se corrija, el PASO 3 habrá que repetirlo.
