(Basado en la tabla real EFINANCIANET_DB."J_COTIZACIONES")

Quiero que configures un nuevo Módulo Institucional llamado:

Módulo: Cotizaciones

Posición: Inmediatamente después del módulo Clientes

Dentro de este módulo, debes agregar tres subcategorías:

Captación

Crédito

Línea Crédito

En este prompt nos vamos a enfocar exclusivamente en la subcategoría:

Sub-Categoría: Captación  
Regla: Debe seguir la misma estructura institucional de todo el sistema (Lista, Alta, Editar, View, Subtabs, JSON, persistencia en tabla).

1. Tabla de base de datos a utilizar
Toda la subcategoría Captación debe persistir en la tabla:

sql
create table EFINANCIANET_DB."J_COTIZACIONES" (
  id uuid not null default gen_random_uuid (),
  no_cotiza character varying(30) not null,
  descripcion character varying(255) null,
  producto_id uuid not null,
  cliente_id uuid not null,
  fecha_cotiza timestamp without time zone null default now(),
  estatus_cotiza EFINANCIANET_DB.estatus_cotizacion not null default 'Pendiente'::"EFINANCIANET_DB".estatus_cotizacion,
  data jsonb null,
  constraint j_cotizaciones_pkey primary key (id),
  constraint fk_cliente foreign KEY (cliente_id) references "EFINANCIANET_DB"."J_CLIENTES" (id) on delete RESTRICT,
  constraint fk_producto foreign KEY (producto_id) references "EFINANCIANET_DB"."J_PRODUCTOS" (id) on delete RESTRICT
) TABLESPACE pg_default;
Reglas institucionales:

Llave primaria: id (UUID)

Número de cotización: no_cotiza

Relación con Cliente: cliente_id → J_CLIENTES(id)

Relación con Producto: producto_id → J_PRODUCTOS(id)

Fecha de cotización: fecha_cotiza (default now())

Estatus de cotización: estatus_cotiza (enum, default 'Pendiente')

JSON estructural: data (jsonb)

2. Subcategoría “Captación” — Lista
Configura la Lista de la subcategoría Captación con los siguientes campos visibles:

CAMPOS EN EL FORMULARIO DE LISTA:

Id Cotiza

Origen: columna no_cotiza

Fecha y Hora

Origen: columna fecha_cotiza

Usuario

Origen: data.usuario (dentro del JSON)

Producto

Origen: data.producto.nombreProducto (o equivalente dentro de data)

Monto Cotizado

Origen: data.montoCotizado

Tasa Min Interés

Origen: data.tasaMinInteres (o data.tasaMinima)

Interés Generado Periodo

Origen: data.interesGeneradoPeriodo

Plazo Cumplir Monto Cotizado

Origen: data.plazoCumplirMontoMinimo o data.plazoCumplirMontoCotizado (mantener nombre consistente en JSON)

Reglas:

La lista debe estar filtrada por Línea de Producto = "Captación" (desde el JSON data.lineaProducto), si aplica.

La lista debe permitir seleccionar un registro para Editar y Ver.

3. Formulario de Alta / Edición — Campos y Mapeos
En el formulario principal de la subcategoría Captación, agrega y mapea los siguientes campos:

3.1 Campo: ID-COTIZACION
Nombre lógico: ID-COTIZACION

Origen / Persistencia: columna no_cotiza

Generación:

Debe generarse automáticamente (ej. secuencia, UUID formateado, etc.)

Longitud máxima: 30 caracteres

Modo: Solo lectura en Alta y Editar (no editable por el usuario).

3.2 Campo: Línea de Producto
Nombre lógico: Línea de Producto

Valor default: "Captación"

Modo: Solo lectura

Persistencia:

Guardar en data.lineaProducto = "Captación"

3.3 Campo: Prospecto/Clientes
Nombre lógico: Prospecto/Clientes

Comportamiento:

Debe desplegar una ventana modal con el listado de todos los clientes (tabla J_CLIENTES).

El usuario selecciona un cliente.

Al seleccionar, se debe hacer un Pick Map de:

cliente_id = J_CLIENTES.id (FK directa en J_COTIZACIONES)

data.cliente.claveCliente = J_CLIENTES.data.idCliente (o campo equivalente)

data.cliente.nombreCompleto = concatenación de nombre + apellidoPaterno + apellidoMaterno desde J_CLIENTES.data

Regla:

No se debe permitir guardar la cotización sin un cliente_id válido.

3.4 Campo: INSTITUCION GOBIERNO
Nombre lógico: INSTITUCION GOBIERNO

Search Specification:

Debe filtrar clientes o instituciones donde la Clasificación de Cliente = "Gobierno Magisterio".

Persistencia:

Guardar en data.institucionGobierno (ej. nombre o clave de la institución).

3.5 Campo: Producto
Nombre lógico: Producto

Origen de datos: tabla J_PRODUCTOS + subvista Convenios.

Search Specification:

Debe listar únicamente los productos que:

Correspondan a la INSTITUCIÓN GOBIERNO seleccionada en el campo anterior.

Se encuentren en la subvista “Convenios”.

Tengan Línea de Producto = "Captación" (en la estructura de productos).

Pick Map al seleccionar un producto:

producto_id = J_PRODUCTOS.id (FK directa en J_COTIZACIONES)

data.producto.claveProducto = Producto.claveProducto

data.producto.tipoProducto = Producto.tipoProducto

data.producto.montoMinimo = Producto.montoMinimo

data.producto.periodoCumplirMontoMinimo = Producto.periodoCumplirMontoMinimo

data.producto.plazoCumplirMontoMinimo = Producto.plazoCumplirMontoMinimo

4. Reglas especiales para productos tipo “Ahorro” o “Aportación”
Si el producto seleccionado es de tipo:

"Ahorro"

"Aportación"

entonces el formulario debe aplicar las siguientes reglas y pick maps:

4.1 Campo: Clave de Producto
Origen: Producto → claveProducto

Persistencia: data.producto.claveProducto

4.2 Campo: Tipo de Producto
Origen: Producto → tipoProducto

Persistencia: data.producto.tipoProducto

4.3 Campo: Monto Cotizado
Origen inicial: Producto → montoMinimo

Persistencia: data.montoCotizado

Modo: Editable por el usuario, pero con validación:

Monto Cotizado >= Producto.montoMinimo

4.4 Campo: Periodo Cumplir Monto Mínimo
Origen: Producto → periodoCumplirMontoMinimo

Persistencia: data.periodoCumplirMontoMinimo

Modo: Solo lectura

4.5 Campo: Plazo Cumplir Monto Mínimo
Origen inicial: Producto → plazoCumplirMontoMinimo

Persistencia: data.plazoCumplirMontoMinimo

Modo: Editable, con validaciones:

Debe ser menor o igual al Plazo Cumplir Monto Mínimo del producto.

No puede ser menor que 0.

5. Campo calculado: Intereses Generados
Agregar un campo calculado automáticamente:

Nombre lógico: Intereses Generados

Persistencia: data.interesGeneradoPeriodo

Fórmula institucional:

InteresesGenerados
=
MontoCotizado
⋅
(
TasaInicial
360
)
⋅
FrecuenciaCapitalizaIntereses
Donde:

MontoCotizado = data.montoCotizado

TasaInicial = tasa del producto o tasa capturada (ej. data.tasaInicial o data.tasaMinInteres)

FrecuenciaCapitalizaIntereses = número de días según la frecuencia:

Mensual = 30

Quincenal = 15

Catorcenal = 14

Semanal = 7

Diario = 1

Trimestral = 90

6. Campo: Fecha primera Aportación
Nombre lógico: Fecha primera Aportación

Persistencia: data.fechaPrimeraAportacion

Regla:

Obligatorio si data.plazoCumplirMontoMinimo > 0.

7. Subtab: Calendario de Aportaciones
Debes agregar un Subtab llamado:

Calendario de Aportaciones

Este subtab debe generar una tabla de aportaciones solo si:

PlazoCumplirMontoMinimo
>
0
es decir, si data.plazoCumplirMontoMinimo > 0.

7.1 Parámetros para generar el calendario
Fecha base: data.fechaPrimeraAportacion

Periodo de aportaciones:

Diario → 1 día

Semanal → 7 días

Catorcenal → 14 días

Quincenal → 15 días

(Si se requiere, Mensual → 30 días)

Plazo: data.plazoCumplirMontoMinimo (número de aportaciones)

Monto Cotizado: data.montoCotizado

7.2 Reglas de generación de filas
Para cada aportación:

No Aportación

Va desde 1 hasta PlazoCumplirMontoMinimo

Incremento de 1 en 1

Fecha de aportación

Para la primera aportación:

FechaAportaci
o
ˊ
n
1
=
FechaPrimeraAportacion
Para las siguientes:

FechaAportaci
o
ˊ
n
𝑖
=
FechaAportaci
o
ˊ
n
𝑖
−
1
+
PeriodoEnD
ı
ˊ
as
Monto de Aportación

Fórmula:

MontoAportaci
o
ˊ
n
=
MontoCotizado
PlazoCumplirMontoMinimo
Moneda

Puede ser fija "MXN" o tomada de data.moneda si existe.

7.3 Formato de la tabla del subtab
La tabla del subtab Calendario de Aportaciones debe tener las columnas:

No Aportación

Fecha de Aportación

Monto de Aportación

Moneda

Ejemplo conceptual (no hardcodear, solo como referencia de formato):

No Aportación	Fecha de Aportación	Monto de Aportación	Moneda
1	14-mar-2026	$3,125.00	MXN
2	21-mar-2026	$3,125.00	MXN
…	…	…	…
16	27-jun-2026	$3,125.00	MXN
7.4 Persistencia del calendario en el JSON
El calendario debe guardarse dentro del campo data como un arreglo:

json
"calendarioAportaciones": [
  {
    "noAportacion": 1,
    "fechaAportacion": "2026-03-14",
    "montoAportacion": 3125.00,
    "moneda": "MXN"
  },
  {
    "noAportacion": 2,
    "fechaAportacion": "2026-03-21",
    "montoAportacion": 3125.00,
    "moneda": "MXN"
  }
  // ...
]
8. Persistencia en la tabla J_COTIZACIONES
8.1 Alta de Cotización (INSERT)
Cuando se guarde una nueva cotización de Captación:

sql
INSERT INTO EFINANCIANET_DB."J_COTIZACIONES"
(
  id,
  no_cotiza,
  descripcion,
  producto_id,
  cliente_id,
  fecha_cotiza,
  estatus_cotiza,
  data
)
VALUES (
  gen_random_uuid(),
  '<no_cotiza_generado>',
  '<descripcion>',
  '<producto_id>',
  '<cliente_id>',
  now(),
  'Pendiente',
  '<JSON_COMPLETO_CON_TODOS_LOS_CAMPOS_Y_CALENDARIO>'::jsonb
);
8.2 Edición de Cotización (UPDATE con MERGE JSON)
Para actualizar una cotización existente:

Identificar el registro por id.

Construir un JSON parcial con los campos modificados.

Hacer un merge sobre data:

sql
UPDATE EFINANCIANET_DB."J_COTIZACIONES"
SET 
  data = data || '<JSON_PARCIAL>'::jsonb,
  producto_id = '<producto_id>',
  cliente_id = '<cliente_id>'
WHERE id = '<ID_COTIZACION>';
Reglas:

data SIEMPRE va a la izquierda.

El JSON parcial va a la derecha.

No se debe borrar información previa del JSON.

9. Reglas institucionales generales
No eliminar campos del JSON data.

No reconstruir el JSON desde cero si ya existe.

No mezclar lógica de otras subcategorías (Crédito, Línea Crédito) en Captación.

Respetar las llaves foráneas cliente_id y producto_id.

Mantener la estructura padre + subtabs (calendarioAportaciones).

Validar todas las restricciones de negocio descritas (montos, plazos, mínimos, etc.).