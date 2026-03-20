Problema: Al editar un registro NO carga la información
Tabla real: EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES"
1. Problema real detectado
En el módulo Cuentas de Ahorro, al abrir un registro en modo Editar, ocurre lo siguiente:

El formulario aparece vacío.

No carga datos básicos como:

No. de cuenta

No. de solicitud

Fechas

Línea de producto

Tipo de producto

Estatus

Montos

Datos del cliente

Datos del producto

Campos del JSON (data)

No carga subtabs dependientes.

Esto significa que el módulo NO está leyendo correctamente la tabla J_CUENTAS_CORP_CLIENTES, o está mapeando mal los campos.

2. Estructura real de la tabla (obligatoria para el desarrollador)
sql
create table EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES" (
  id uuid not null default gen_random_uuid (),
  type character varying(30) not null,
  no_sol character varying(30) not null,
  no_cuenta character varying(30) not null,
  no_referenc1 character varying(30) null,
  fecha_sol date not null,
  fecha_autori date null,
  fecha_disper date null,
  fecha_cancel date null,
  fecha_inicio date null,
  fecha_fin_cu date null,
  descripcion character varying(512) null,
  linea_produc character varying(30) not null,
  tipo_produc character varying(30) not null,
  producto_id uuid null,
  producto_eje uuid null,
  cliente_id uuid not null,
  saldo_actual money null default 0,
  monto_sol money null,
  monto_aut money null,
  monto_disp money null,
  estatus_disp character varying(30) null,
  estatus_sol character varying(30) null,
  estatus_cart character varying(30) null,
  estatus_cuen character varying(30) null,
  cta_eje_chec boolean null default false,
  fases character varying(50) null,
  data jsonb null,
  constraint j_cuentas_corp_clientes_pkey primary key (id),
  constraint fk_cliente foreign key (cliente_id) references "EFINANCIANET_DB"."J_CLIENTES" (id),
  constraint fk_producto foreign key (producto_id) references "EFINANCIANET_DB"."J_PRODUCTOS" (id)
);
3. Regla institucional para cargar un registro en modo Editar
Cuando el usuario abra:

Cuentas de Ahorro → Editar

el sistema debe ejecutar:

sql
SELECT *
FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
WHERE id = '<ID_CUENTA>';
Reglas:
TODOS los campos físicos deben mapearse al formulario.

El JSON data también debe mapearse campo por campo.

No debe omitirse ningún campo.

No debe reconstruirse el JSON.

4. Campos físicos que DEBEN cargarse en el formulario
El desarrollador debe mapear:

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

Si el formulario no carga estos campos → el mapeo está mal implementado.
5. Campos JSON que DEBEN cargarse
El módulo debe leer:

Código
data.*
Ejemplos típicos:

data.sucursal

data.tipoCuenta

data.condiciones

data.requisitos

data.documentos

data.movimientos

data.configuracion

data.expedientesElectronicos[]

data.personasRelacionadas[]

data.perfilTransaccional[]

Si el JSON no se carga → el módulo está ignorando data.
6. Causas típicas del fallo (todas deben corregirse)
❌ 1. El módulo está usando una consulta incompleta
Ejemplo incorrecto:

sql
SELECT id, no_cuenta, cliente_id FROM J_CUENTAS_CORP_CLIENTES
Debe usar:

sql
SELECT * FROM J_CUENTAS_CORP_CLIENTES
❌ 2. El módulo está leyendo desde otra tabla
Algunos desarrolladores confunden:

J_CUENTAS_CORP_CLIENTES

J_CLIENTES

J_PRODUCTOS

El módulo solo debe leer desde J_CUENTAS_CORP_CLIENTES.

❌ 3. El módulo no está mapeando el JSON data
Si el formulario no carga subtabs → no está leyendo data.

❌ 4. El módulo está esperando campos que NO existen
Ejemplo:

estatus (no existe)

tipoProducto (está en tipo_produc)

lineaProducto (está en linea_produc)

❌ 5. El módulo está usando nombres distintos a los de la BD
Ejemplo:

fechaSolicitud en vez de fecha_sol

saldo en vez de saldo_actual

7. Regla institucional para GUARDAR
Cuando el usuario presione Guardar, el sistema debe:

7.1 Actualizar campos físicos
sql
UPDATE J_CUENTAS_CORP_CLIENTES
SET
  no_sol = ...,
  no_cuenta = ...,
  fecha_sol = ...,
  linea_produc = ...,
  tipo_produc = ...,
  producto_id = ...,
  cliente_id = ...,
  saldo_actual = ...,
  monto_sol = ...,
  monto_aut = ...,
  monto_disp = ...,
  estatus_cuen = ...,
  data = data || '<JSON_PARCIAL>'::jsonb
WHERE id = '<ID_CUENTA>';
Reglas:
data SIEMPRE va a la izquierda

JSON parcial va a la derecha

No borrar nodos existentes

No reconstruir el JSON completo

8. Resultado esperado
Después de aplicar este prompt:

El formulario de Editar Cuenta de Ahorro cargará TODOS los campos.

Los campos físicos se mostrarán correctamente.

El JSON data se cargará completo.

Los subtabs funcionarán correctamente.

El módulo dejará de mostrar formularios vacíos.

La edición será estable y funcional.