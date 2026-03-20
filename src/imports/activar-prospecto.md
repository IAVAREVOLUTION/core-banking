Tablas involucradas:
"EFINANCIANET_DB"."J_CLIENTES"

"EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"

1. Evento que dispara el proceso
Cuando el usuario presione el botón:

“Activar Prospecto”

sobre un registro de "J_CLIENTES", el sistema debe ejecutar dos acciones obligatorias:

Actualizar el registro del prospecto en J_CLIENTES

Crear automáticamente una Cuenta de Ahorro Eje Principal en J_CUENTAS_CORP_CLIENTES

2. Actualización institucional en J_CLIENTES
El sistema debe actualizar dos campos distintos:

2.1 Cambiar el tipo del registro
Código
type = 'Clientes'
2.2 Cambiar el estatus del cliente
Código
estatus = 'Activo'
2.3 SQL institucional
sql
UPDATE "EFINANCIANET_DB"."J_CLIENTES"
SET 
    type = 'Clientes',
    estatus = 'Activo'
WHERE id = <ID_CLIENTE>;
El trigger j_clientes_estatus_notif_trg seguirá funcionando sin cambios.

3. Validación institucional antes de crear la cuenta eje
Antes de crear la cuenta, el sistema debe verificar si el cliente YA tiene una cuenta eje:

sql
SELECT COUNT(*)
FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
WHERE cliente_id = <ID_CLIENTE>
  AND cta_eje_chec = TRUE;
Si el resultado es ≥ 1, NO debe crear otra cuenta eje.

4. Datos que deben obtenerse del cliente
Desde "J_CLIENTES":

id

data.nombreCompleto

data.claveCliente

data.rfc (si existe)

data.telefono (si existe)

5. Datos del producto institucional de ahorro eje
El sistema debe identificar el producto institucional:

sql
SELECT id, nombre_producto, clave_producto, tasa, monto_minimo
FROM "EFINANCIANET_DB"."J_PRODUCTOS"
WHERE linea_producto = 'CAPTACION'
  AND tipo_producto = 'Ahorro'
  AND es_producto_eje = TRUE;
Si no existe, debe marcar error institucional.

6. Reglas institucionales de la cuenta generada automáticamente
Campo	Valor
type	'CAPTACION'
linea_produc	'CAPTACION'
tipo_produc	'Ahorro'
cta_eje_chec	TRUE
saldo_actual	0
estatus_sol	'Autorizado'
estatus_disp	'No Aplica'
estatus_cart	'Activa'
estatus_cuen	'Activa'
fecha_sol	CURRENT_DATE
fecha_inicio	CURRENT_DATE
descripcion	'Cuenta eje generada automáticamente al activar prospecto'
7. Generación automática de claves
7.1 Número de Solicitud (no_sol)
Código
no_sol = 'AUTO-' || substring(gen_random_uuid()::text, 1, 8)
7.2 Número de Cuenta (no_cuenta)
Código
no_cuenta = 'AHO-' || <ID_CLIENTE> || '-' || to_char(NOW(), 'YYYYMMDD')
8. JSON institucional que debe generarse
json
{
  "cliente": {
    "id": "<ID_CLIENTE>",
    "nombreCompleto": "<NOMBRE_COMPLETO>",
    "claveCliente": "<CLAVE_CLIENTE>"
  },
  "producto": {
    "id": "<ID_PRODUCTO>",
    "nombreProducto": "<NOMBRE_PRODUCTO>",
    "claveProducto": "<CLAVE_PRODUCTO>",
    "tasa": <TASA>,
    "montoMinimo": <MONTO_MINIMO>
  },
  "cuenta": {
    "esCuentaEje": true,
    "generadaAutomaticamente": true
  },
  "metadatos": {
    "creadoPor": "Sistema",
    "fechaCreacion": "<FECHA>",
    "motivo": "Activación automática de prospecto"
  }
}
9. INSERT institucional en J_CUENTAS_CORP_CLIENTES
sql
INSERT INTO "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
(
  id,
  type,
  no_sol,
  no_cuenta,
  no_referenc1,
  fecha_sol,
  fecha_autori,
  fecha_disper,
  fecha_cancel,
  fecha_inicio,
  fecha_fin_cu,
  descripcion,
  linea_produc,
  tipo_produc,
  producto_id,
  producto_eje,
  cliente_id,
  saldo_actual,
  monto_sol,
  monto_aut,
  monto_disp,
  estatus_disp,
  estatus_sol,
  estatus_cart,
  estatus_cuen,
  cta_eje_chec,
  fases,
  data
)
VALUES (
  gen_random_uuid(),
  'CAPTACION',
  '<NO_SOL_GENERADO>',
  '<NO_CUENTA_GENERADO>',
  NULL,
  CURRENT_DATE,
  CURRENT_DATE,
  NULL,
  NULL,
  CURRENT_DATE,
  NULL,
  'Cuenta eje generada automáticamente al activar prospecto',
  'CAPTACION',
  'Ahorro',
  '<ID_PRODUCTO_EJE>',
  NULL,
  '<ID_CLIENTE>',
  0,
  NULL,
  NULL,
  NULL,
  'No Aplica',
  'Autorizado',
  'Activa',
  'Activa',
  TRUE,
  'Inicial',
  '<JSON_COMPLETO>'::jsonb
);
10. Resultado esperado
Después de activar un prospecto:

En J_CLIENTES:

type = 'Clientes'

estatus = 'Activo'

En J_CUENTAS_CORP_CLIENTES:

Se crea automáticamente la Cuenta de Ahorro Eje Principal

Se guarda correctamente

Se marca como cta_eje_chec = TRUE

En los módulos:

Aparece en Clientes → Subtab Cuentas

Aparece en Cuentas de Ahorro → Lista