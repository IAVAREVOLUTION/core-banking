-- Corrige el FK de J_SOLICITUDES_ACTIVACION.solicitud_id para usar ON DELETE SET NULL.
-- Sin este cambio, eliminar una solicitud de J_CUENTAS_CORP_CLIENTES que tenga
-- activaciones vinculadas provoca: "update or delete on table J_CUENTAS_CORP_CLIENTES
-- violates foreign key constraint on table J_SOLICITUDES_ACTIVACION".
--
-- Con ON DELETE SET NULL: al borrar la solicitud padre, solicitud_id queda NULL
-- en los registros hijo de J_SOLICITUDES_ACTIVACION (no se pierden datos).
--
-- Ejecutar en Supabase SQL Editor (una sola vez).

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Eliminar cualquier FK existente en solicitud_id → J_CUENTAS_CORP_CLIENTES
  FOR r IN
    SELECT kcu.constraint_name
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = rc.constraint_name
     AND kcu.constraint_schema = rc.constraint_schema
    WHERE kcu.table_schema  = 'EFINANCIANET_DB'
      AND kcu.table_name    = 'J_SOLICITUDES_ACTIVACION'
      AND kcu.column_name   = 'solicitud_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION" DROP CONSTRAINT IF EXISTS %I',
      r.constraint_name
    );
    RAISE NOTICE 'FK eliminado: %', r.constraint_name;
  END LOOP;

  -- Agregar FK nueva con ON DELETE SET NULL / ON UPDATE CASCADE
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'EFINANCIANET_DB'
      AND table_name        = 'J_SOLICITUDES_ACTIVACION'
      AND constraint_name   = 'fk_sol_activacion_solicitud_id'
  ) THEN
    ALTER TABLE "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"
      ADD CONSTRAINT fk_sol_activacion_solicitud_id
      FOREIGN KEY (solicitud_id)
      REFERENCES "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES" (id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
    RAISE NOTICE 'FK fk_sol_activacion_solicitud_id creado con ON DELETE SET NULL';
  ELSE
    RAISE NOTICE 'FK fk_sol_activacion_solicitud_id ya existe — sin cambios';
  END IF;
END $$;
