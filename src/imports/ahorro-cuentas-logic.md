Módulo: Cuentas de Ahorro
Tabla real: EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES"
Cuando el usuario presione:

Cuentas de Ahorro → Nuevo

el sistema debe ejecutar TODA la siguiente lógica institucional.

1. Persistencia obligatoria
Toda cuenta de ahorro debe guardarse en:

Código
EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES"
Columnas físicas obligatorias:

id (UUID, generado automáticamente)

type

no_sol

no_cuenta

no_referenc1

fecha_sol

fecha_autori

fecha_disper

fecha_cancel

fecha_inicio

fecha_fin_cu

descripcion

linea_produc

tipo_produc

producto_id

producto_eje

cliente_id

saldo_actual

monto_sol

monto_aut

monto_disp

estatus_disp

estatus_sol

estatus_cart

estatus_cuen

cta_eje_chec

fases

data (jsonb)

2. Valores obligatorios por default
2.1 Línea de Producto
Código
linea_produc = 'CAPTACION'
2.2 Tipo de Producto
Código
tipo_produc = 'Ahorro'
2.3 Type
Código
type = 'CAPTACION'
2.4 Saldo inicial
Código
saldo_actual = 0
2.5 Estatus iniciales
Código
estatus_sol = 'Pendiente'
estatus_disp = 'Pendiente'
estatus_cart = 'Activa'
estatus_cuen = 'Activa'
3. Campos del formulario (Modo Alta)
3.1 Campo: Número de Solicitud (no_sol)
Obligatorio

Capturado por el usuario

Persistencia: no_sol

3.2 Campo: Número de Cuenta (no_cuenta)
Obligatorio

Puede ser generado automáticamente o capturado

Persistencia: no_cuenta

3.3 Campo: Número de Referencia (no_referenc1)
Opcional

Persistencia: no_referenc1

3.4 Campo: Fecha de Solicitud (fecha_sol)
Obligatorio

Default: fecha actual

Persistencia: fecha_sol

3.5 Campo: Cliente (Pick Map)
Debe abrir un modal con TODOS los clientes de:

Código
EFINANCIANET_DB."J_CLIENTES"
Pick Map:

Código
cliente_id = J_CLIENTES.id
data.cliente.claveCliente = J_CLIENTES.data.idCliente
data.cliente.nombreCompleto = nombre + apellidos
3.6 Campo: Producto (Pick Map)
Debe listar productos de:

Código
EFINANCIANET_DB."J_PRODUCTOS"
con Search Specification:

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
3.7 Campo: Descripción
Opcional

Persistencia: descripcion

3.8 Campo: Cuenta Eje / Chequera (cta_eje_chec)
Booleano

Default: false

Persistencia: cta_eje_chec

3.9 Campo: Fases (fases)
Opcional

Persistencia: fases

4. Campos monetarios
4.1 Monto Solicitado (monto_sol)
Opcional

Persistencia: monto_sol

4.2 Monto Autorizado (monto_aut)
Opcional

Persistencia: monto_aut

4.3 Monto Dispersado (monto_disp)
Opcional

Persistencia: monto_disp

5. Fechas operativas
5.1 Fecha Autorización (fecha_autori)
Opcional

Persistencia: fecha_autori

5.2 Fecha Dispersión (fecha_disper)
Opcional

Persistencia: fecha_disper

5.3 Fecha Cancelación (fecha_cancel)
Opcional

Persistencia: fecha_cancel

5.4 Fecha Inicio (fecha_inicio)
Obligatoria si la cuenta se activa

Persistencia: fecha_inicio

5.5 Fecha Fin (fecha_fin_cu)
Opcional

Persistencia: fecha_fin_cu

6. Construcción del JSON institucional
El JSON debe contener:

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

No eliminar campos.

No reconstruir el JSON si se edita.

Mantener estructura padre + nodos.

7. INSERT institucional (Guardar – Modo Nuevo)
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
  '<estatus_disp>',
  '<estatus_sol>',
  '<estatus_cart>',
  '<estatus_cuen>',
  '<cta_eje_chec>',
  '<fases>',
  '<JSON_COMPLETO>'::jsonb
);
8. Reglas institucionales del Modo Alta
No eliminar campos del JSON.

No reconstruir el JSON desde cero si se edita.

No permitir guardar sin cliente_id.

No permitir guardar sin producto_id.

No permitir guardar sin no_sol ni no_cuenta.

Mantener linea_produc = 'CAPTACION'.

Mantener tipo_produc = 'Ahorro'.

Respetar llaves foráneas.