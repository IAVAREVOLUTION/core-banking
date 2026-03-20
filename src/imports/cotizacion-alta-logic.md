Módulo: Cotizaciones
Subcategoría: Captación
Tabla real: EFINANCIANET_DB."J_COTIZACIONES"
Cuando el usuario se encuentre en:

Cotizaciones → Captación → Modo Alta (Nuevo)

y presione el Botón Guardar – Modo Nuevo, debes ejecutar TODA la siguiente lógica institucional.

1. Tabla destino (persistencia obligatoria)
Toda cotización debe guardarse exclusivamente en:

Código
EFINANCIANET_DB."J_COTIZACIONES"
Columnas físicas obligatorias:

id (UUID, generado automáticamente)

no_cotiza (varchar(30), obligatorio)

descripcion (varchar(255), opcional)

producto_id (uuid, FK → J_PRODUCTOS.id)

cliente_id (uuid, FK → J_CLIENTES.id)

fecha_cotiza (timestamp, default now())

estatus_cotiza (enum estatus_cotizacion, default 'Pendiente')

data (jsonb, estructura institucional)

2. Generación del ID-COTIZACION
El sistema debe generar automáticamente:

Código
no_cotiza = <cadena única de hasta 30 caracteres>
Reglas:

No editable por el usuario.

Debe mostrarse en el formulario en modo lectura.

Debe persistirse en la columna no_cotiza.

3. Campo: Línea de Producto
Valor default: "Captación"

Solo lectura

Persistencia:

Código
data.lineaProducto = "Captación"
4. Campo: Prospecto/Cliente (Pick Map)
El campo debe abrir una ventana modal con TODOS los clientes de:

Código
EFINANCIANET_DB."J_CLIENTES"
Al seleccionar un cliente, hacer Pick Map:

Código
cliente_id = J_CLIENTES.id
data.cliente.claveCliente = J_CLIENTES.data.idCliente
data.cliente.nombreCompleto = nombre + apellidoPaterno + apellidoMaterno
Reglas:

No se puede guardar sin cliente_id.

No se puede editar manualmente.

5. Campo: INSTITUCIÓN GOBIERNO
Search Specification:

Código
ClasificaciónCliente = "Gobierno Magisterio"
Persistencia:

Código
data.institucionGobierno = <valor seleccionado>
6. Campo: Producto (Search Specification + Pick Map)
El campo Producto debe listar únicamente productos de J_PRODUCTOS que cumplan:

Coincidan con la Institución Gobierno seleccionada.

Estén en la subvista Convenios.

Tengan Línea de Producto = "Captación".

Pick Map al seleccionar:

Código
producto_id = J_PRODUCTOS.id
data.producto.claveProducto = claveProducto
data.producto.tipoProducto = tipoProducto
data.producto.montoMinimo = montoMinimo
data.producto.periodoCumplirMontoMinimo = periodoCumplirMontoMinimo
data.producto.plazoCumplirMontoMinimo = plazoCumplirMontoMinimo
7. Reglas especiales para productos tipo “Ahorro” o “Aportación”
Si data.producto.tipoProducto es:

"Ahorro"

"Aportación"

entonces:

7.1 Monto Cotizado
Valor inicial: Producto.montoMinimo

Editable

Validación:

𝑀
𝑜
𝑛
𝑡
𝑜
𝐶
𝑜
𝑡
𝑖
𝑧
𝑎
𝑑
𝑜
≥
𝑃
𝑟
𝑜
𝑑
𝑢
𝑐
𝑡
𝑜
.
𝑚
𝑜
𝑛
𝑡
𝑜
𝑀
𝑖
𝑛
𝑖
𝑚
𝑜
Persistencia:

Código
data.montoCotizado
7.2 Periodo Cumplir Monto Mínimo
Solo lectura

Persistencia:

Código
data.periodoCumplirMontoMinimo
7.3 Plazo Cumplir Monto Mínimo
Editable

Validaciones:

0
≤
𝑃
𝑙
𝑎
𝑧
𝑜
𝑈
𝑠
𝑢
𝑎
𝑟
𝑖
𝑜
≤
𝑃
𝑟
𝑜
𝑑
𝑢
𝑐
𝑡
𝑜
.
𝑝
𝑙
𝑎
𝑧
𝑜
𝐶
𝑢
𝑚
𝑝
𝑙
𝑖
𝑟
𝑀
𝑜
𝑛
𝑡
𝑜
𝑀
𝑖
𝑛
𝑖
𝑚
𝑜
Persistencia:

Código
data.plazoCumplirMontoMinimo
8. Campo calculado: Intereses Generados
Cálculo automático:

𝐼
𝑛
𝑡
𝑒
𝑟
𝑒
𝑠
𝑒
𝑠
𝐺
𝑒
𝑛
𝑒
𝑟
𝑎
𝑑
𝑜
𝑠
=
𝑀
𝑜
𝑛
𝑡
𝑜
𝐶
𝑜
𝑡
𝑖
𝑧
𝑎
𝑑
𝑜
⋅
(
𝑇
𝑎
𝑠
𝑎
𝐼
𝑛
𝑖
𝑐
𝑖
𝑎
𝑙
360
)
⋅
𝐹
𝑟
𝑒
𝑐
𝑢
𝑒
𝑛
𝑐
𝑖
𝑎
𝐶
𝑎
𝑝
𝑖
𝑡
𝑎
𝑙
𝑖
𝑧
𝑎
𝐼
𝑛
𝑡
𝑒
𝑟
𝑒
𝑠
𝑒
𝑠
Frecuencia en días:

Diario = 1

Semanal = 7

Catorcenal = 14

Quincenal = 15

Mensual = 30

Trimestral = 90

Persistencia:

Código
data.interesGeneradoPeriodo
9. Campo: Fecha Primera Aportación
Obligatorio si data.plazoCumplirMontoMinimo > 0

Persistencia:

Código
data.fechaPrimeraAportacion
10. Subtab: Calendario de Aportaciones (Generación automática)
El subtab solo se genera si:

𝑑
𝑎
𝑡
𝑎
.
𝑝
𝑙
𝑎
𝑧
𝑜
𝐶
𝑢
𝑚
𝑝
𝑙
𝑖
𝑟
𝑀
𝑜
𝑛
𝑡
𝑜
𝑀
𝑖
𝑛
𝑖
𝑚
𝑜
>
0
10.1 Parámetros
Fecha base: data.fechaPrimeraAportacion

Periodo en días: según selección

Plazo: data.plazoCumplirMontoMinimo

Monto Cotizado: data.montoCotizado

10.2 Fórmulas
No Aportación:  
1 … plazo

Fecha de aportación:

𝐹
𝑒
𝑐
ℎ
𝑎
𝑖
=
𝐹
𝑒
𝑐
ℎ
𝑎
𝑖
−
1
+
𝑃
𝑒
𝑟
𝑖
𝑜
𝑑
𝑜
𝐷
𝑖
𝑎
𝑠
Monto de aportación:

𝑀
𝑜
𝑛
𝑡
𝑜
𝐴
𝑝
𝑜
𝑟
𝑡
𝑎
𝑐
𝑖
𝑜
𝑛
=
𝑀
𝑜
𝑛
𝑡
𝑜
𝐶
𝑜
𝑡
𝑖
𝑧
𝑎
𝑑
𝑜
𝑃
𝑙
𝑎
𝑧
𝑜
10.3 Persistencia en JSON
Código
data.calendarioAportaciones = [
  {
    "noAportacion": 1,
    "fechaAportacion": "YYYY-MM-DD",
    "montoAportacion": <valor>,
    "moneda": "MXN"
  },
  ...
]
11. Construcción del JSON final (Modo Alta)
El JSON debe contener:

json
{
  "lineaProducto": "Captación",
  "cliente": {
    "claveCliente": "",
    "nombreCompleto": ""
  },
  "institucionGobierno": "",
  "producto": {
    "claveProducto": "",
    "tipoProducto": "",
    "montoMinimo": 0,
    "periodoCumplirMontoMinimo": 0,
    "plazoCumplirMontoMinimo": 0
  },
  "montoCotizado": 0,
  "tasaMinima": 0,
  "interesGeneradoPeriodo": 0,
  "plazoCumplirMontoMinimo": 0,
  "fechaPrimeraAportacion": "",
  "calendarioAportaciones": []
}
12. INSERT institucional (Guardar – Modo Nuevo)
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
  '<no_cotiza>',
  '<descripcion>',
  '<producto_id>',
  '<cliente_id>',
  now(),
  'Pendiente',
  '<JSON_COMPLETO>'::jsonb
);
13. Reglas institucionales del Modo Alta
No eliminar campos del JSON.

No reconstruir el JSON desde cero si ya existe lógica previa.

No mezclar lógica con Crédito o Línea Crédito.

No permitir guardar sin cliente_id ni producto_id.

Validar todos los mínimos, máximos y restricciones.

Generar el calendario automáticamente si aplica.

Respetar llaves foráneas.