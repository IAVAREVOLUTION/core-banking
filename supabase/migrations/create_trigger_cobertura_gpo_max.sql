-- =============================================================================
-- Trigger: validar_cobertura_gpo — HU-CRM-08 RN-03
--
-- El tope de 50% de cobertura GPO debe validarse en frontend Y backend.
-- El frontend ya lo bloquea (OportunidadForm), pero J_COTIZACIONES se escribe
-- por RPC genéricas (insert_jcotizacion / update_jcotizacion) que sirven a
-- TODAS las líneas de producto; meter ahí una regla específica de GPO las
-- contaminaría. Un trigger sobre la tabla aplica la política sin importar
-- por qué camino entre el dato.
--
-- Solo aplica a Oportunidades: data->>'lineaProducto' = 'Línea de Crédito'
-- con coberturaGPOPorcentaje presente. El resto de cotizaciones no se toca.
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

CREATE OR REPLACE FUNCTION "EFINANCIANET_DB".validar_cobertura_gpo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_pct numeric;
BEGIN
  -- Fuera del alcance: cotizaciones que no son Oportunidades de 2o Piso.
  IF NEW.data IS NULL
     OR NEW.data->>'lineaProducto' IS DISTINCT FROM 'Línea de Crédito'
     OR COALESCE(NEW.data->>'coberturaGPOPorcentaje', '') = ''
  THEN
    RETURN NEW;
  END IF;

  -- Un valor no numérico se deja pasar: la columna es jsonb libre y no
  -- corresponde a este trigger decidir sobre basura de captura.
  BEGIN
    v_pct := (NEW.data->>'coberturaGPOPorcentaje')::numeric;
  EXCEPTION WHEN others THEN
    RETURN NEW;
  END;

  IF v_pct > 50 THEN
    -- En RAISE, '%' es marcador y '%%' es un '%' literal. Pegar un literal
    -- justo despues de un marcador ('%%%') es ambiguo: plpgsql lo lee como
    -- literal + marcador e imprimiria '%60'. Se arma el texto por
    -- concatenacion, donde '%' no tiene significado especial.
    RAISE EXCEPTION 'Cobertura GPO fuera de politica: %',
      v_pct::text || '% excede el maximo de 50% permitido por la politica de riesgo comercial (HU-CRM-08 RN-03)'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_pct < 0 THEN
    RAISE EXCEPTION 'Cobertura GPO invalida: no puede ser negativa'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_validar_cobertura_gpo" ON "EFINANCIANET_DB"."J_COTIZACIONES";
CREATE TRIGGER "trg_validar_cobertura_gpo"
  BEFORE INSERT OR UPDATE ON "EFINANCIANET_DB"."J_COTIZACIONES"
  FOR EACH ROW EXECUTE FUNCTION "EFINANCIANET_DB".validar_cobertura_gpo();
