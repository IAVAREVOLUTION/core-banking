-- =============================================================================
-- Corrige filas huérfanas de Solicitudes de Crédito por un typo singular/plural.
--
-- HALLAZGO (2026-08-25): formToDBPayload() (useSolicitudesDB.ts) guardaba
-- cada Solicitud con type='Solicitudes' (plural). Tanto la RPC
-- get_solicitudes_credito() (WHERE t.type = 'Solicitud') como el edge
-- function GET /solicitudes-credito (.eq('type', 'Solicitud')) filtran por
-- el SINGULAR — así que el INSERT sí escribía la fila en
-- J_CUENTAS_CORP_CLIENTES (por eso se generaba un id real y la UI navegaba a
-- "ver" con ese id), pero ninguna ruta de lectura la volvía a encontrar
-- jamás: la pantalla de detalle se abría casi vacía porque no había fila que
-- cargar, no porque los datos no se hubieran guardado.
--
-- El código ya se corrigió para escribir 'Solicitud' (singular) de aquí en
-- adelante. Esta migración es solo para "rescatar" las Solicitudes ya
-- generadas con el typo (incluye, entre otras, las creadas por Cerrada-
-- Ganada de Oportunidades GPO durante las pruebas de esta sesión).
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
SET type = 'Solicitud'
WHERE type = 'Solicitudes';
