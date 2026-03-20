Módulo: Cotizaciones
Subcategoría: Captación
Tabla real: EFINANCIANET_DB."J_COTIZACIONES"
Cuando el usuario haga clic en la Liga de Editar dentro de:

Cotizaciones → Captación → Lista

debes ejecutar la siguiente lógica institucional para cargar el registro en Modo Editar.

1. Obtención del ID (llave primaria)
Tomar el valor del campo oculto:

Código
id (UUID)
Este ID corresponde a la PK de la tabla:

Código
EFINANCIANET_DB."J_COTIZACIONES"
2. Consulta institucional del registro
Ejecutar:

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
WHERE id = <ID>;
3. Procesamiento del JSON
El campo:

Código
data (jsonb)
contiene toda la información dinámica de la cotización.

Debes extraer:

data.lineaProducto

data.cliente.*

data.institucionGobierno

data.producto.*

data.montoCotizado

data.tasaMinima

data.interesGeneradoPeriodo

data.plazoCumplirMontoMinimo

data.fechaPrimeraAportacion

data.calendarioAportaciones[]

4. Mapeo obligatorio al formulario (Modo Editar)
4.1 Campos físicos (fuera del JSON)
Campo UI	Origen BD
ID-COTIZACION	no_cotiza
Descripción	descripcion
Fecha Cotización	fecha_cotiza
Estatus	estatus_cotiza
Producto (FK)	producto_id
Cliente (FK)	cliente_id
4.2 Campos del JSON (nodo padre)
Campo UI	Origen JSON
Línea de Producto	data.lineaProducto
Clave Cliente	data.cliente.claveCliente
Nombre Completo	data.cliente.nombreCompleto
Institución Gobierno	data.institucionGobierno
Clave Producto	data.producto.claveProducto
Tipo Producto	data.producto.tipoProducto
Monto Cotizado	data.montoCotizado
Tasa Mínima	data.tasaMinima
Interés Generado Periodo	data.interesGeneradoPeriodo
Periodo Cumplir Monto Mínimo	data.producto.periodoCumplirMontoMinimo
Plazo Cumplir Monto Mínimo	data.plazoCumplirMontoMinimo
Fecha Primera Aportación	data.fechaPrimeraAportacion
4.3 Subtab: Calendario de Aportaciones
Debes cargar:

Código
data.calendarioAportaciones[]
Cada fila contiene:

noAportacion

fechaAportacion

montoAportacion

moneda

5. Reglas institucionales del Modo Editar
No eliminar campos del JSON.

No eliminar subtabs aunque estén vacíos.

No reconstruir el JSON desde cero.

No modificar la llave primaria id.

No modificar no_cotiza.

No modificar data.lineaProducto.

No mezclar lógica con Crédito o Línea Crédito.

Mantener la estructura padre + subtabs.

⭐ PROMPT 3.1 — GUARDAR / EDITAR COTIZACIÓN (UPDATE + MERGE JSON)
Botón: Guardar – Modo Editar
Tabla real: EFINANCIANET_DB."J_COTIZACIONES"
Cuando el usuario presione el Botón Guardar – Modo Editar, debes ejecutar la siguiente lógica institucional.

1. Obtención del ID
Tomar el valor del campo oculto:

Código
id (UUID)
2. Leer el JSON actual desde la BD
Antes de actualizar, debes obtener el JSON actual:

sql
SELECT data
FROM EFINANCIANET_DB."J_COTIZACIONES"
WHERE id = <ID>;
3. Construcción del JSON parcial (solo campos editados)
Debes construir un JSON parcial con:

Campos del nodo padre editados

Campos del producto editados

Campos del cliente editados

Campos de cálculo editados

Subtab calendario (si se regeneró)

Ejemplo conceptual:

json
{
  "cliente": {
    "claveCliente": "<nuevo>",
    "nombreCompleto": "<nuevo>"
  },
  "institucionGobierno": "<nuevo>",
  "producto": {
    "claveProducto": "<nuevo>",
    "tipoProducto": "<nuevo>",
    "montoMinimo": 1000,
    "periodoCumplirMontoMinimo": 7,
    "plazoCumplirMontoMinimo": 16
  },
  "montoCotizado": 36000,
  "tasaMinima": 5.5,
  "interesGeneradoPeriodo": 3125,
  "fechaPrimeraAportacion": "2026-03-14",
  "calendarioAportaciones": [
    {
      "noAportacion": 1,
      "fechaAportacion": "2026-03-14",
      "montoAportacion": 3125,
      "moneda": "MXN"
    }
  ]
}
4. MERGE JSON institucional
El merge debe ser:

sql
UPDATE EFINANCIANET_DB."J_COTIZACIONES"
SET 
  data = data || '<JSON_PARCIAL>'::jsonb,
  producto_id = '<producto_id>',
  cliente_id = '<cliente_id>',
  descripcion = '<descripcion>'
WHERE id = '<ID>';
Reglas del merge:

data SIEMPRE va a la izquierda.

El JSON parcial va a la derecha.

Solo se actualizan los campos enviados.

Los campos no enviados se conservan.

No se borra nada del JSON existente.

5. Regeneración del Calendario (si aplica)
Si el usuario modificó:

montoCotizado

plazoCumplirMontoMinimo

fechaPrimeraAportacion

periodoCumplirMontoMinimo

entonces debes regenerar el calendario completo antes del MERGE.

6. Reglas institucionales del Guardado
No eliminar campos del JSON.

No eliminar subtabs.

No reconstruir el JSON desde cero.

No modificar id.

No modificar no_cotiza.

No mezclar lógica con otras subcategorías.

Validar todos los mínimos y máximos.

Respetar llaves foráneas.