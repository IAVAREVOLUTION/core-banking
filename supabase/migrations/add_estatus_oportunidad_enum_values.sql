-- =============================================================================
-- Agrega al enum EFINANCIANET_DB.estatus_cotizacion los valores del pipeline
-- de Oportunidades (HU-CRM-09 / Cierre Comercial).
--
-- HALLAZGO (2026-08-25): la columna J_COTIZACIONES.estatus_cotiza es un ENUM
-- de Postgres. Desde que se implementó el pipeline de Oportunidades, NINGUNO
-- de sus estatus ('En Cotización', 'Propuesta Entregada', 'Negociación',
-- 'Carta Oferta', 'Ganada Comercial', 'Perdida') existía como valor válido del
-- enum. Cada INSERT/UPDATE de una Oportunidad fallaba en la base de datos con:
--   ERROR 22P02: invalid input value for enum
--   "EFINANCIANET_DB".estatus_cotizacion: "En Cotización"
--
-- El síntoma quedó oculto porque el frontend (useCotizacionesCaptacionDB.ts,
-- función saveCotizacion) atrapa el error del RPC y cae a "modo local"
-- devolviendo { ok: true } de todas formas — el usuario veía el toast
-- "Oportunidad guardada" aunque NUNCA se escribiera en J_COTIZACIONES. Ese
-- bug se corrige aparte en el código (ok ya no se falsea); esta migración
-- corrige la causa de fondo para que el INSERT/UPDATE deje de fallar.
--
-- Probado en vivo antes de escribir esta migración (y limpiado después):
--   'Pendiente' / 'Rechazada' / 'Aceptada' → válidos (ya existían)
--   'En Análisis' → sigue sin ser válido, no se usa en Oportunidades, no se agrega aquí
--   Los 6 de abajo → todos fallaban con 22P02, confirmado uno por uno
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- NOTA: cada ALTER TYPE ... ADD VALUE debe ejecutarse en su propia
-- transacción (Postgres no permite usar el valor nuevo en la misma
-- transacción en la que se agrega) — por eso van en sentencias separadas,
-- no dentro de un BEGIN...COMMIT explícito.
-- =============================================================================

ALTER TYPE "EFINANCIANET_DB".estatus_cotizacion ADD VALUE IF NOT EXISTS 'En Cotización';
ALTER TYPE "EFINANCIANET_DB".estatus_cotizacion ADD VALUE IF NOT EXISTS 'Propuesta Entregada';
ALTER TYPE "EFINANCIANET_DB".estatus_cotizacion ADD VALUE IF NOT EXISTS 'Negociación';
ALTER TYPE "EFINANCIANET_DB".estatus_cotizacion ADD VALUE IF NOT EXISTS 'Carta Oferta';
ALTER TYPE "EFINANCIANET_DB".estatus_cotizacion ADD VALUE IF NOT EXISTS 'Ganada Comercial';
ALTER TYPE "EFINANCIANET_DB".estatus_cotizacion ADD VALUE IF NOT EXISTS 'Perdida';
