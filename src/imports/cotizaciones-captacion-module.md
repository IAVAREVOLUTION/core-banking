Ubicación: Después del Módulo “Clientes”
Subcategorías:
Captación

Crédito

Línea de Crédito

1. Crear el Módulo “Cotizaciones”
Agregar un nuevo módulo principal:

Código
Módulo: Cotizaciones
Posición: Después del módulo Clientes
2. Crear Subcategorías del Módulo
Crear tres subcategorías:

Captación

Crédito

Línea de Crédito

Cada subcategoría debe tener:

Lista

Alta

Editar

View

Subtabs

Persistencia en J_COTIZACIONES

JSON estructurado

⭐ SUBCATEGORÍA: CAPTACIÓN
Esta es la primera subcategoría a implementar.
3. LISTA — CAMPOS OBLIGATORIOS
La Lista de Cotizaciones de Captación debe mostrar:

Campo en Lista	Origen
Id Cotiza	no_cotiza
Fecha y Hora	fecha_cotiza
Usuario	data.usuario
Producto	data.producto.nombreProducto
Monto Cotizado	data.montoCotizado
Tasa Min Interés	data.tasaMinima
Interés Generado Periodo	data.interesGeneradoPeriodo
Plazo Cumplir Monto Cotizado	data.plazoCumplirMonto
4. FORMULARIO — CAMPOS OBLIGATORIOS (Alta / Editar)
Todos los campos deben mapearse a la tabla J_COTIZACIONES y al JSON data.

4.1 Campo: ID-COTIZACION
Mapea a: no_cotiza

Generado automáticamente (string 30 chars)

Solo lectura

4.2 Campo: Línea de Producto
Valor default: "Captación"

Solo lectura

Mapea a: data.lineaProducto

4.3 Campo: Prospecto/Cliente
Modal que lista TODOS los clientes desde J_CLIENTES

Al seleccionar uno → Pick Map:

Código
cliente_id = id (FK)
data.cliente.claveCliente = idCliente
data.cliente.nombreCompleto = nombre + apellidos
4.4 Campo: Institución Gobierno
Search Specification:

Código
ClasificaciónCliente = "Gobierno Magisterio"
Mapea a:

Código
data.institucionGobierno
4.5 Campo: Producto
Debe listar productos desde J_PRODUCTOS que cumplan:

Coincidan con la Institución Gobierno seleccionada

Estén en la subvista Convenios

Tengan Línea de Producto = “Captación”

Pick Map:

Código
producto_id = id (FK)
data.producto.claveProducto
data.producto.tipoProducto
data.producto.montoMinimo
data.producto.periodoCumplirMontoMinimo
data.producto.plazoCumplirMontoMinimo
5. REGLAS PARA PRODUCTOS TIPO AHORRO / APORTACIÓN
Si el producto es tipo:

Ahorro

Aportación

Debe hacer Pick Map de:

Campo en Formulario	Origen
Clave de Producto	Producto → claveProducto
Tipo de Producto	Producto → tipoProducto
Monto Cotizado	Producto → montoMinimo (editable, pero ≥ montoMinimo)
Periodo Cumplir Monto Mínimo	Producto → periodoCumplirMontoMinimo (solo lectura)
Plazo Cumplir Monto Mínimo	Producto → plazoCumplirMontoMinimo (editable, pero ≤ valor del producto y ≥ 0)
6. CÁLCULO AUTOMÁTICO — INTERESES GENERADOS
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

Mensual = 30

Quincenal = 15

Catorcenal = 14

Semanal = 7

Diario = 1

Trimestral = 90

Mapea a:

Código
data.interesGeneradoPeriodo
7. Campo: Fecha Primera Aportación
Obligatorio si Plazo > 0

Mapea a: data.fechaPrimeraAportacion

⭐ 8. SUBTAB — CALENDARIO DE APORTACIONES
Generación automática del calendario
Este subtab se genera solo si:

Código
data.plazoCumplirMontoMinimo > 0
8.1 Reglas para generar la tabla
Número de aportaciones = PlazoCumplirMontoMinimo

Fecha inicial = FechaPrimeraAportacion

Periodo de aportación según selección:

Diario = 1 día

Semanal = 7 días

Catorcenal = 14 días

Quincenal = 15 días

Mensual = 30 días

8.2 Fórmulas institucionales
NoAportación:

Código
1 … PlazoCumplirMontoMinimo
Fecha de Aportación:

Código
FechaAportación[i] = FechaAportación[i-1] + PeriodoDias
Monto de Aportación:

Código
MontoAportación = MontoCotizado / PlazoCumplirMontoMinimo
8.3 Formato institucional de la tabla
No Aportación	Fecha de Aportación	Monto de Aportación	Moneda
1	14-mar-2026	$3,125.00	MXN
2	21-mar-2026	$3,125.00	MXN
3	28-mar-2026	$3,125.00	MXN
4	04-abr-2026	$3,125.00	MXN
5	11-abr-2026	$3,125.00	MXN
6	18-abr-2026	$3,125.00	MXN
7	25-abr-2026	$3,125.00	MXN
8	02-may-2026	$3,125.00	MXN
9	09-may-2026	$3,125.00	MXN
10	16-may-2026	$3,125.00	MXN
11	23-may-2026	$3,125.00	MXN
12	30-may-2026	$3,125.00	MXN
13	06-jun-2026	$3,125.00	MXN
14	13-jun-2026	$3,125.00	MXN
15	20-jun-2026	$3,125.00	MXN
16	27-jun-2026	$3,125.00	MXN
Total: $50,000.00 MXN

8.4 Persistencia en JSON
json
"calendarioAportaciones": [
  {
    "noAportacion": 1,
    "fechaAportacion": "2026-03-14",
    "montoAportacion": 3125.00,
    "moneda": "MXN"
  }
]
⭐ 9. PERSISTENCIA REAL EN LA TABLA J_COTIZACIONES
9.1 Alta
sql
INSERT INTO EFINANCIANET_DB."J_COTIZACIONES"
(id, no_cotiza, descripcion, producto_id, cliente_id, fecha_cotiza, estatus_cotiza, data)
VALUES (
  gen_random_uuid(),
  '<no_cotiza>',
  '<descripcion>',
  '<producto_id>',
  '<cliente_id>',
  now(),
  'Pendiente',
  '<JSON construido>'::jsonb
);
9.2 Editar (MERGE JSON)
sql
UPDATE EFINANCIANET_DB."J_COTIZACIONES"
SET 
  data = data || '<json_parcial>'::jsonb,
  producto_id = '<producto_id>',
  cliente_id = '<cliente_id>'
WHERE id = '<ID>';
⭐ 10. JSON INSTITUCIONAL COMPLETO
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
  "plazoCumplirMonto": 0,
  "fechaPrimeraAportacion": "",
  "calendarioAportaciones": []
}
⭐ 11. REGLAS INSTITUCIONALES
No eliminar campos del JSON.

No reconstruir JSON desde cero.

No mezclar lógica con otros módulos.

No duplicar nodos.

Mantener estructura padre + subtabs.

Validar restricciones de negocio.

Respetar llaves foráneas hacia J_CLIENTES y J_PRODUCTOS.