Módulo: Cuentas de Ahorro
Tabla real: "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
Cuando el usuario presione:

Cuentas de Ahorro → Nuevo

el sistema debe ejecutar TODA la siguiente lógica institucional.

1. Reglas institucionales del Modo Alta
Toda cuenta de ahorro debe cumplir:

linea_produc = 'CAPTACION'

tipo_produc = 'Ahorro'

type = 'CAPTACION'

saldo_actual = 0

cta_eje_chec = false (default)

Estatus iniciales:

estatus_sol = 'Pendiente'

estatus_disp = 'Pendiente'

estatus_cart = 'Activa'

estatus_cuen = 'Activa'

2. Campos del formulario (Modo Nuevo)
2.1 Número de Solicitud (no_sol)
Obligatorio

Capturado por el usuario

Persistencia: no_sol

2.2 Número de Cuenta (no_cuenta)
Obligatorio

Puede ser generado por el sistema

Persistencia: no_cuenta

2.3 Número de Referencia (no_referenc1)
Opcional

Persistencia: no_referenc1

2.4 Fecha de Solicitud (fecha_sol)
Obligatoria

Default: fecha actual

Persistencia: fecha_sol

2.5 Cliente (Pick Map)
Modal desde:

Código
EFINANCIANET_DB."J_CLIENTES"
Pick Map:

Código
cliente_id = J_CLIENTES.id
data.cliente.claveCliente = J_CLIENTES.data.idCliente
data.cliente.nombreCompleto = nombre + apellidos
2.6 Producto (Pick Map)
Modal desde:

Código
EFINANCIANET_DB."J_PRODUCTOS"
Filtrar:

Código
lineaProducto = 'CAPTACION'
tipoProducto = 'Ahorro'
Pick Map:

Código
producto_id = J_PRODUCTOS.id
data.producto.claveProducto = claveProducto
data.producto.nombreProducto = nombreProducto
data.producto.tasa = tasa
data.producto.montoMinimo = montoMinimo
2.7 Descripción (descripcion)
Opcional

Persistencia: descripcion

2.8 Cuenta Eje / Chequera (cta_eje_chec)
Booleano

Default: false

Persistencia: cta_eje_chec

2.9 Fases (fases)
Opcional

Persistencia: fases

3. Campos monetarios
3.1 Monto Solicitado (monto_sol)
Opcional

Persistencia: monto_sol

3.2 Monto Autorizado (monto_aut)
Opcional

Persistencia: monto_aut

3.3 Monto Dispersado (monto_disp)
Opcional

Persistencia: monto_disp

4. Fechas operativas
4.1 Fecha Autorización (fecha_autori)
Opcional

Persistencia: fecha_autori

4.2 Fecha Dispersión (fecha_disper)
Opcional

Persistencia: fecha_disper

4.3 Fecha Cancelación (fecha_cancel)
Opcional

Persistencia: fecha_cancel

4.4 Fecha Inicio (fecha_inicio)
Obligatoria si la cuenta se activa

Persistencia: fecha_inicio

4.5 Fecha Fin (fecha_fin_cu)
Opcional

Persistencia: fecha_fin_cu

5. Construcción del JSON institucional
El JSON debe generarse así:

json
{
  "cliente": {
    "claveCliente": "",
    "nombreCompleto": ""
  },
  "producto": {
    "claveProducto": "",
    "nombreProducto": "",
    "tasa": 0,
    "montoMinimo": 0
  },
  "metadatos": {
    "creadoPor": "",
    "fechaCreacion": "",
    "ultimaActualizacion": ""
  }
}
Reglas:

No eliminar nodos.

No cambiar estructura.

No mezclar con otros módulos.

6. INSERT institucional (Guardar – Modo Nuevo)
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
  '<no_sol>',
  '<no_cuenta>',
  '<no_referenc1>',
  '<fecha_sol>',
  '<fecha_autori>',
  '<fecha_disper>',
  '<fecha_cancel>',
  '<fecha_inicio>',
  '<fecha_fin_cu>',
  '<descripcion>',
  'CAPTACION',
  'Ahorro',
  '<producto_id>',
  '<producto_eje>',
  '<cliente_id>',
  0,
  '<monto_sol>',
  '<monto_aut>',
  '<monto_disp>',
  'Pendiente',
  'Pendiente',
  'Activa',
  'Activa',
  '<cta_eje_chec>',
  '<fases>',
  '<JSON_COMPLETO>'::jsonb
);
7. Validaciones obligatorias
no_sol no puede estar vacío.

no_cuenta no puede estar vacío.

cliente_id debe existir en "J_CLIENTES".

producto_id debe existir en "J_PRODUCTOS".

linea_produc debe ser CAPTACION.

tipo_produc debe ser Ahorro.

No permitir guardar sin JSON.

8. Resultado final
Al guardar, el sistema debe:

Crear la cuenta de ahorro

Guardar campos físicos

Guardar JSON institucional

Mantener integridad de cliente y producto

Mantener estatus iniciales

Mantener estructura institucional