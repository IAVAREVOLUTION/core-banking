-- =============================================================================
-- Table: J_SOLICITUDES_ACTIVACION
-- Almacena las solicitudes de activación de cuentas
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

-- Crear el schema si no existe
CREATE SCHEMA IF NOT EXISTS "EFINANCIANET_DB";

-- Crear la tabla
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_id" uuid,
  "solicitud_id" uuid,
  "type" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "fecha_compromiso" date,
  "estatus" text NOT NULL DEFAULT 'Pendiente',
  "data" jsonb DEFAULT '{}'::jsonb
);

-- Agregar comentarios a las columnas
COMMENT ON TABLE "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION" IS 'Solicitudes de Activacion de Cuentas';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"."id" IS 'ID único de la solicitud';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"."cliente_id" IS 'FK al cliente (J_CLIENTES)';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"."solicitud_id" IS 'FK a la solicitud original (J_CUENTAS_CORP_CLIENTES)';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"."type" IS 'Tipo: Por Cobrar / Por Pagar';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"."created_at" IS 'Fecha de creacion';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"."fecha_compromiso" IS 'Fecha compromiso de pago';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"."estatus" IS 'Estatus: Pendiente, Enviada, Pagada, Cancelada';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"."data" IS 'Datos adicionales en formato JSONB';

-- Agregar indices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS "idx_solicitudes_activacion_cliente_id" ON "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"("cliente_id");
CREATE INDEX IF NOT EXISTS "idx_solicitudes_activacion_solicitud_id" ON "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"("solicitud_id");
CREATE INDEX IF NOT EXISTS "idx_solicitudes_activacion_estatus" ON "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"("estatus");

-- Habilitar RLS
ALTER TABLE "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION" ENABLE ROW LEVEL SECURITY;

-- Politicas RLS (ajustar segun necesidades)
CREATE POLICY "allow_all_solicitudes_activacion" ON "EFINANCIANET_DB"."J_SOLICITUDES_ACTIVACION"
  FOR ALL USING (true) WITH CHECK (true);
