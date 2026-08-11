-- =====================================================================
-- Catálogo CategoriaBien — HU Módulo Garantías: campo "Categoría"
--
-- J_CATALOGOS sigue el patrón real (id uuid, type varchar, data jsonb),
-- igual que 'Documento', 'Sucursal', 'PuestoTrabajo', 'TasaReferencia'.
-- Cada categoría es una fila con type = 'CategoriaBien'.
--
-- Extensible: agregar una categoría nueva es solo un INSERT más.
-- =====================================================================

INSERT INTO "EFINANCIANET_DB"."J_CATALOGOS" (type, data)
SELECT 'CategoriaBien', v.data
FROM (VALUES
  ('{"clave": "GARANTIA", "nombre": "Garantía", "activo": true}'::jsonb),
  ('{"clave": "ACTIVO_FIJO", "nombre": "Activo Fijo", "activo": true}'::jsonb)
) AS v(data)
WHERE NOT EXISTS (
  SELECT 1 FROM "EFINANCIANET_DB"."J_CATALOGOS"
  WHERE type = 'CategoriaBien' AND data->>'clave' = v.data->>'clave'
);

-- =====================================================================
-- Policy de lectura — J_CATALOGOS tiene RLS activo sin ninguna policy,
-- por lo que hoy ningún catálogo (Documento/Sucursal/PuestoTrabajo/
-- TasaReferencia/CategoriaBien) es legible vía anon/authenticated.
-- Es información de catálogo, no datos sensibles de cliente: se abre
-- SELECT para ambos roles.
-- =====================================================================
DROP POLICY IF EXISTS "lectura publica catalogos" ON "EFINANCIANET_DB"."J_CATALOGOS";
CREATE POLICY "lectura publica catalogos"
  ON "EFINANCIANET_DB"."J_CATALOGOS"
  FOR SELECT
  TO anon, authenticated
  USING (true);
