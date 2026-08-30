-- =============================================================================
-- Hace visibles en Originación las Solicitudes creadas por Cierre Comercial.
--
-- HALLAZGO (2026-08-25): handleCerrarGanada (OportunidadForm.tsx) creaba la
-- Solicitud con estatus_sol = 'Pendiente'. La Lista de Originación
-- (OriginacionModule.tsx) construye su listado así:
--
--     solicitudesDB.filter(s => s.estatusSolicitud !== 'Pendiente')
--
-- ...es decir, filtra EXPLÍCITAMENTE las 'Pendiente'. Resultado: la Solicitud
-- que el Cierre Comercial acababa de crear nunca aparecía en Originación,
-- aunque estuviera correctamente guardada en J_CUENTAS_CORP_CLIENTES con
-- todos sus datos (verificado fila por fila contra la BD).
--
-- El código ya se corrigió para crearlas como 'En proceso' de aquí en
-- adelante — el mismo estatus que aplica "Enviar de Fase". Esta migración
-- solo rescata las que ya se generaron con el estatus viejo.
--
-- ALCANCE ACOTADO: únicamente las Solicitudes originadas por una Oportunidad
-- (no_referenc1 guarda el folio de la Oportunidad, con prefijo 'LDC-') y que
-- sigan en 'Pendiente'. NO toca borradores capturados a mano en el módulo
-- Solicitudes, que sí deben permanecer 'Pendiente'.
--
-- Para revisar QUÉ se va a actualizar antes de correrlo, ejecute primero:
--   SELECT id, no_sol, no_referenc1, estatus_sol
--   FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
--   WHERE type = 'Solicitud' AND estatus_sol = 'Pendiente'
--     AND no_referenc1 LIKE 'LDC-%';
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
SET estatus_sol = 'En proceso'
WHERE type = 'Solicitud'
  AND estatus_sol = 'Pendiente'
  AND no_referenc1 LIKE 'LDC-%';
