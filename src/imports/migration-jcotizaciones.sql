-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: J_COTIZACIONES — RPC + Tabla + Enum
-- Ejecutar en Supabase SQL Editor
-- Después de ejecutar, cambiar DB_AVAILABLE = true en:
--   /src/app/hooks/useCotizacionesCaptacionDB.ts
-- ═══════════════════════════════════════════════════════════════════

-- 1. Crear el tipo enum si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'EFINANCIANET_DB' AND t.typname = 'estatus_cotizacion'
  ) THEN
    CREATE TYPE "EFINANCIANET_DB".estatus_cotizacion AS ENUM (
      'Pendiente', 'Aprobada', 'Rechazada', 'En revision', 'Cancelada'
    );
  END IF;
END$$;

-- 2. Crear la tabla si no existe
CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_COTIZACIONES" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  no_cotiza character varying(30) NOT NULL,
  descripcion character varying(255) NULL,
  producto_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  fecha_cotiza timestamp without time zone NULL DEFAULT now(),
  estatus_cotiza "EFINANCIANET_DB".estatus_cotizacion NOT NULL DEFAULT 'Pendiente'::"EFINANCIANET_DB".estatus_cotizacion,
  data jsonb NULL,
  CONSTRAINT j_cotizaciones_pkey PRIMARY KEY (id),
  CONSTRAINT fk_cliente FOREIGN KEY (cliente_id) REFERENCES "EFINANCIANET_DB"."J_CLIENTES" (id) ON DELETE RESTRICT,
  CONSTRAINT fk_producto FOREIGN KEY (producto_id) REFERENCES "EFINANCIANET_DB"."J_PRODUCTOS" (id) ON DELETE RESTRICT
) TABLESPACE pg_default;

-- 3. Habilitar RLS (Row Level Security) con política permisiva
ALTER TABLE "EFINANCIANET_DB"."J_COTIZACIONES" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon and authenticated" ON "EFINANCIANET_DB"."J_COTIZACIONES"
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Grants
GRANT ALL ON "EFINANCIANET_DB"."J_COTIZACIONES" TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 5. RPC: public.get_all_jcotizaciones()
--    Retorna TODOS los registros de J_COTIZACIONES sin filtros.
--    Usada por useCotizacionesCaptacionDB.ts (Intento 2).
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_all_jcotizaciones()
RETURNS SETOF "EFINANCIANET_DB"."J_COTIZACIONES"
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM "EFINANCIANET_DB"."J_COTIZACIONES";
$$;

-- Grant para que el cliente anon/authenticated pueda llamar la RPC
GRANT EXECUTE ON FUNCTION public.get_all_jcotizaciones() TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 6. (Opcional) Índices para performance
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_jcotizaciones_cliente ON "EFINANCIANET_DB"."J_COTIZACIONES" (cliente_id);
CREATE INDEX IF NOT EXISTS idx_jcotizaciones_producto ON "EFINANCIANET_DB"."J_COTIZACIONES" (producto_id);
CREATE INDEX IF NOT EXISTS idx_jcotizaciones_estatus ON "EFINANCIANET_DB"."J_COTIZACIONES" (estatus_cotiza);
CREATE INDEX IF NOT EXISTS idx_jcotizaciones_nocotiza ON "EFINANCIANET_DB"."J_COTIZACIONES" (no_cotiza);
