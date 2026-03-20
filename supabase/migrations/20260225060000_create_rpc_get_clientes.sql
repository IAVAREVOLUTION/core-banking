-- =====================================================================
-- Migration: Create RPC functions for J_CLIENTES access via PostgREST
-- Date: 2026-02-25
-- 
-- Creates functions in the PUBLIC schema (exposed by PostgREST)
-- that query "EFINANCIANET_DB"."J_CLIENTES" using SECURITY DEFINER.
-- This bypasses the need to expose the EFINANCIANET_DB schema.
-- =====================================================================

-- RPC 1: get_clientes() - Returns ALL records (no filter)
CREATE OR REPLACE FUNCTION public.get_clientes()
RETURNS TABLE (
  id         uuid,
  type       text,
  subtipo    text,
  estatus    text,
  data       jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, type::text, subtipo::text, estatus::text, data
  FROM "EFINANCIANET_DB"."J_CLIENTES"
  ORDER BY data->>'fechaOriginacion' DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_clientes() TO anon;
GRANT EXECUTE ON FUNCTION public.get_clientes() TO authenticated;

-- RPC 2: get_all_jclientes() - Returns ALL records (no filter)
CREATE OR REPLACE FUNCTION public.get_all_jclientes()
RETURNS TABLE (
  id         uuid,
  type       text,
  subtipo    text,
  estatus    text,
  data       jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, type::text, subtipo::text, estatus::text, data
  FROM "EFINANCIANET_DB"."J_CLIENTES"
  ORDER BY data->>'fechaOriginacion' DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_jclientes() TO anon;
GRANT EXECUTE ON FUNCTION public.get_all_jclientes() TO authenticated;
