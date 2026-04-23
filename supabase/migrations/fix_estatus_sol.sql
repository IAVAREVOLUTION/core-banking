-- Corregir estatus_sol NULL en cuentas eje
UPDATE "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
SET estatus_sol = 'Autorizada'
WHERE estatus_sol IS NULL AND cta_eje_chec = true;