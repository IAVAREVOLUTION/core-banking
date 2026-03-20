Módulo: Cotizaciones
Subcategoría: Captación
Tabla real: EFINANCIANET_DB."J_COTIZACIONES"
Cuando el usuario ingrese al submódulo:

Cotizaciones → Captación → Lista

debes ejecutar la siguiente lógica institucional para consultar, mapear y mostrar todas las cotizaciones registradas en la tabla J_COTIZACIONES cuya Línea de Producto = “Captación”.

1. Tabla a consultar
El origen de datos es exclusivamente:

Código
EFINANCIANET_DB."J_COTIZACIONES"
Columnas físicas:

id (UUID, PK)

no_cotiza (varchar(30))

descripcion (varchar(255))

producto_id (uuid, FK → J_PRODUCTOS.id)

cliente_id (uuid, FK → J_CLIENTES.id)

fecha_cotiza (timestamp, default now())

estatus_cotiza (enum estatus_cotizacion, default 'Pendiente')

data (jsonb)

2. Consulta institucional para la Lista
Debes traer todas las cotizaciones, pero solo mostrar en la Lista aquellas cuyo JSON contenga:

Código
data.lineaProducto = "Captación"
Consulta recomendada:

sql
SELECT 
    id,
    no_cotiza,
    descripcion,
    producto_id,
    cliente_id,
    fecha_cotiza,
    estatus_cotiza,
    data
FROM EFINANCIANET_DB."J_COTIZACIONES"
WHERE data->>'lineaProducto' = 'Captación';
Reglas:

No aplicar filtros adicionales.

No mezclar con subcategorías “Crédito” o “Línea Crédito”.

No reconstruir el JSON.

No eliminar campos del JSON.

3. Procesamiento del JSON
El campo:

Código
data (jsonb)
contiene toda la información dinámica de la cotización.

Debes leerlo y extraer los siguientes nodos:

data.usuario

data.producto.*

data.montoCotizado

data.tasaMinima

data.interesGeneradoPeriodo

data.plazoCumplirMontoMinimo

4. Mapeo obligatorio a la Lista
La Lista debe mostrar exactamente los siguientes campos:

Campo en UI	Origen
Id Cotiza	no_cotiza
Fecha y Hora	fecha_cotiza
Usuario	data.usuario
Producto	data.producto.nombreProducto o data.producto.claveProducto
Monto Cotizado	data.montoCotizado
Tasa Min Interés	data.tasaMinima
Interés Generado Periodo	data.interesGeneradoPeriodo
Plazo Cumplir Monto Cotizado	data.plazoCumplirMontoMinimo
5. Mapeo obligatorio de la llave primaria
El campo:

Código
id (UUID)
debe mapearse como Campo de Lista oculto, ya que es la llave primaria para:

Editar

Ver

Cargar el registro

Guardar cambios

6. Reglas institucionales de la Lista
Consultar únicamente la tabla J_COTIZACIONES.

Filtrar únicamente por data.lineaProducto = "Captación".

No mezclar lógica con Crédito o Línea Crédito.

No eliminar campos del JSON.

No reconstruir el JSON desde cero.

No modificar otros módulos.

Mantener la arquitectura institucional:

lectura del JSON

mapeo del nodo padre

preservación de campos

uso de ID como llave primaria

7. Nomenclatura obligatoria
Interfaz Gráfica
Módulo: Cotizaciones

Subcategoría: Captación

Formulario: Lista Principal

Campo de Lista

Liga de Editar

Liga de Ver

Base de Datos
Tabla: J_COTIZACIONES

Columnas: id, no_cotiza, producto_id, cliente_id, fecha_cotiza, estatus_cotiza, data

8. Objetivo del Prompt
Este prompt garantiza:

Que la Lista de Cotizaciones de Captación funcione con la estructura institucional.

Que se lean correctamente los datos desde J_COTIZACIONES.

Que se muestren solo las cotizaciones de la Línea “Captación”.

Que el JSON se interprete correctamente.

Que la lista esté lista para integrarse con Alta, Editar, View y Subtabs.