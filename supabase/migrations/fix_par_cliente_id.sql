-- Ver registros con par_cliente_id duplicados
SELECT id, type, par_cliente_id 
FROM "EFINANCIANET_DB"."J_CLIENTES" 
WHERE par_cliente_id IS NOT NULL 
ORDER BY par_cliente_id;