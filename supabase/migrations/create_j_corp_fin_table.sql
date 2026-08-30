-- =============================================================================
-- Table: J_CORP_FIN
-- Solicitudes de financiamiento corporativo ligadas a una Oportunidad.
-- Respalda la pestaña "Solicitudes" de la vista de Oportunidad (HU-CRM-05 CA-02).
--
-- ⚠️ PROPUESTA — el modelo de datos de j_corp_fin no venía especificado en la HU.
--    Las columnas siguen la convención de J_SOLICITUDES_ACTIVACION: llaves uuid,
--    columnas físicas para lo que se filtra/lista, y `data` jsonb para el resto.
--    Ajustar antes de aplicar en producción.
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS "EFINANCIANET_DB";

CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CORP_FIN" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Oportunidad de origen. Una Oportunidad es una Cotización de Línea de
  -- Crédito, así que apunta a J_COTIZACIONES.
  "cotizacion_id"    uuid,
  -- Cliente Emisor heredado del Lead.
  "cliente_id"       uuid,
  -- Folio legible de la solicitud corporativa (ej. CF-000001).
  "folio"            text,
  -- Tipo de solicitud corporativa.
  "type"             text,
  "estatus"          text NOT NULL DEFAULT 'Pendiente',
  "monto"            numeric(18,2) DEFAULT 0,
  "moneda"           text DEFAULT 'MXN',
  "fecha_solicitud"  date DEFAULT CURRENT_DATE,
  "created_at"       timestamp with time zone DEFAULT now(),
  "updated_at"       timestamp with time zone DEFAULT now(),
  "data"             jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE  "EFINANCIANET_DB"."J_CORP_FIN" IS 'Solicitudes de financiamiento corporativo asociadas a una Oportunidad';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_CORP_FIN"."id"              IS 'ID unico de la solicitud corporativa';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_CORP_FIN"."cotizacion_id"   IS 'FK a la Oportunidad (J_COTIZACIONES)';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_CORP_FIN"."cliente_id"      IS 'FK al Cliente Emisor (J_CLIENTES)';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_CORP_FIN"."folio"           IS 'Folio legible de la solicitud';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_CORP_FIN"."type"            IS 'Tipo de solicitud corporativa';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_CORP_FIN"."estatus"         IS 'Estatus: Pendiente, En Analisis, Aprobada, Rechazada, Cancelada';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_CORP_FIN"."monto"           IS 'Monto solicitado';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_CORP_FIN"."moneda"          IS 'Divisa del monto (MXN, USD, EUR)';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_CORP_FIN"."fecha_solicitud" IS 'Fecha de captura de la solicitud';
COMMENT ON COLUMN "EFINANCIANET_DB"."J_CORP_FIN"."data"            IS 'Datos adicionales en formato JSONB';

-- Indices para los accesos previstos: por Oportunidad, por Cliente y por estatus.
CREATE INDEX IF NOT EXISTS "idx_corp_fin_cotizacion_id" ON "EFINANCIANET_DB"."J_CORP_FIN"("cotizacion_id");
CREATE INDEX IF NOT EXISTS "idx_corp_fin_cliente_id"    ON "EFINANCIANET_DB"."J_CORP_FIN"("cliente_id");
CREATE INDEX IF NOT EXISTS "idx_corp_fin_estatus"       ON "EFINANCIANET_DB"."J_CORP_FIN"("estatus");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_corp_fin_folio"  ON "EFINANCIANET_DB"."J_CORP_FIN"("folio") WHERE "folio" IS NOT NULL;

-- Mantener updated_at al dia.
CREATE OR REPLACE FUNCTION "EFINANCIANET_DB".set_corp_fin_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_corp_fin_updated_at" ON "EFINANCIANET_DB"."J_CORP_FIN";
CREATE TRIGGER "trg_corp_fin_updated_at"
  BEFORE UPDATE ON "EFINANCIANET_DB"."J_CORP_FIN"
  FOR EACH ROW EXECUTE FUNCTION "EFINANCIANET_DB".set_corp_fin_updated_at();

-- RLS — misma politica permisiva que el resto de tablas del Core.
-- Endurecer cuando se definan roles.
ALTER TABLE "EFINANCIANET_DB"."J_CORP_FIN" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_corp_fin" ON "EFINANCIANET_DB"."J_CORP_FIN";
CREATE POLICY "allow_all_corp_fin" ON "EFINANCIANET_DB"."J_CORP_FIN"
  FOR ALL USING (true) WITH CHECK (true);
