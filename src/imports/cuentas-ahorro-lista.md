Tabla real: "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
1. Objetivo institucional
El módulo Cuentas de Ahorro debe mostrar únicamente las cuentas cuyo:

Código
linea_produc = 'CAPTACION'
tipo_produc = 'Ahorro'
La lista debe cargar, mapear y mostrar todas las cuentas de ahorro registradas en la tabla.

2. Consulta institucional para la Lista
Al entrar a:

Cuentas de Ahorro → Lista

ejecutar:

sql
SELECT
    id,
    no_cuenta,
    cliente_id,
    producto_id,
    fecha_sol,
    fecha_autori,
    saldo_actual,
    estatus_cuen,
    estatus_cart,
    estatus_sol,
    estatus_disp,
    cta_eje_chec,
    data
FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
WHERE linea_produc = 'CAPTACION'
  AND tipo_produc = 'Ahorro';
3. Mapeo obligatorio a la Lista (UI)
La lista debe mostrar exactamente los siguientes campos:

Campo UI	Origen BD	Notas
Editar	id	Liga a PROMPT 3
Ver	id	Liga a PROMPT 4
No. Cuenta	no_cuenta	Texto
Cliente	cliente_id	Resolver nombre desde J_CLIENTES
Producto	producto_id	Resolver nombre desde J_PRODUCTOS
Fecha Solicitud	fecha_sol	Formato dd/mm/yyyy
Fecha Autorización	fecha_autori	Puede ser NULL
Saldo Actual	saldo_actual	Money
Est. Cuenta	estatus_cuen	Texto
Est. Cartera	estatus_cart	Texto
Est. Solicitud	estatus_sol	Texto
Est. Dispersión	estatus_disp	Texto
Cta Eje / Chequera	cta_eje_chec	Booleano
4. Resolución de llaves foráneas
4.1 Cliente
Consultar "J_CLIENTES":

sql
SELECT nombre, apellido_paterno, apellido_materno
FROM "EFINANCIANET_DB"."J_CLIENTES"
WHERE id = cliente_id;
Mostrar:

Código
nombre + " " + apellido_paterno + " " + apellido_materno
4.2 Producto
Consultar "J_PRODUCTOS":

sql
SELECT nombre_producto
FROM "EFINANCIANET_DB"."J_PRODUCTOS"
WHERE id = producto_id;
Mostrar:

Código
nombre_producto
5. Campos ocultos obligatorios
La lista debe incluir como campos ocultos:

id (PK)

cliente_id

producto_id

linea_produc

tipo_produc

data (JSON completo)

6. Reglas institucionales de la Lista
Mostrar solo cuentas de ahorro.

No mezclar con créditos ni líneas de crédito.

No eliminar campos del JSON.

No reconstruir el JSON.

No modificar datos al cargar la lista.

Mantener integridad institucional.

Ordenar por fecha_sol DESC.

7. Comportamiento esperado
Al entrar al módulo:

Cuentas de Ahorro → Lista

el usuario debe ver:

Todas las cuentas de ahorro existentes

Con cliente y producto resueltos

Con estatus claros

Con acceso inmediato a Editar y Ver

Con datos provenientes de la tabla real

Con JSON preservado