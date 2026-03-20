COTIZACIÓN DE LÍNEA CRÉDITO — PROMPT MEJORADO
1. Vista de Lista (Listado de Cotizaciones de Línea Crédito)
El listado debe mostrar los siguientes campos:

Id Cotiza

Fecha y Hora

Usuario

Producto

Monto Cotizado

Tasa Interés

Plazo

Periodo

Interés a Pagar

Pago Periodo

Estatus

2. Botón “Nuevo” — Formulario Principal + Subvista “Default”
Campos obligatorios del formulario:
ID‑COTIZACIÓN

Generado automáticamente.

Línea de Producto

Valor default: “Línea Crédito”

Solo lectura.

Prospecto / Clientes

Abrir modal con todos los registros de J_CLIENTES.

Pick‑map obligatorio:

Clave Cliente

Nombre Completo

En el portal NO se muestra en el wizard, pero al enviar la cotización se guarda el ID del cliente firmado.

Institución Gobierno

Search specification: clasificacionCliente = "Gobierno Magisterio"

Ejemplo: “Sindicato XXIII Trabajadores de Educación Ecuador”.

Tipo de Línea

Lista de valores: “Fija”, “Revolvente”

Nota: Este es el único campo adicional respecto a la cotización de Crédito. Es informativo.

Producto

Debe listar productos que cumplan:

Coinciden con la Institución Gobierno seleccionada.

Existen en la subvista Convenios.

lineaProducto = "Crédito".

3. Campo “Plazos y Montos” (Matriz Tasa Fija)
Debe listar todos los registros de la subpestaña Matriz Tasa Fija del producto seleccionado.

Al seleccionar un registro, mapear:
Periodo ← MatrizTasaFija.Periodo

Plazo Mínimo ← MatrizTasaFija.PlazoMinimo

Plazo Máximo ← MatrizTasaFija.PlazoMaximo

Plazo (1) ← MatrizTasaFija.PlazoDefault

Monto Mínimo ← MatrizTasaFija.MontoMinimo

Monto Máximo ← MatrizTasaFija.MontoMaximo

Monto Solicitado (2) ← MatrizTasaFija.MontoDefault

Moneda ← Producto.Moneda

Tasa Mínima ← MatrizTasaFija.TasaMinima

Tasa Máxima ← MatrizTasaFija.TasaMaxima

Tasa Cotizada ← MatrizTasaFija.TasaDefault

4. Campo “Garantía”
Debe ser un catálogo (lista de valores) con las garantías del producto seleccionado.

Al seleccionar una garantía, mapear:
Tipo Garantía ← Garantías.TIPO

Subtipo Garantía ← Garantías.SUBTIPO

Monto Garantía = MontoSolicitado × %Aforo

Ejemplos:

100,000 × 10% = 10,000

100,000 × 200% = 200,000

5. Campo “Cálculo de Amortización”
Lista de valores con los tipos de cálculo disponibles.
El usuario debe seleccionar uno.

6. Requerimiento de Cotización de Seguro
Checkbox “Seguro Financiado”
Si NO está seleccionado → no mostrar nada adicional.
Si SÍ está seleccionado → habilitar:

(4) Campo “Seguro”
Lista de valores desde la subvista Paquetes del producto de crédito seleccionado.

Filtrar únicamente productos cuya Línea de Producto = “Seguro”.

(5) Campo “Plazos y Montos Cobertura”
Debe aplicar un filtro tipo constraint sobre la subpestaña Montos y Coberturas del producto de seguro seleccionado.

Criterio del filtro:
Debe traer todos los registros donde:

Plazo(1) seleccionado ≥ Plazo Mínimo del seguro

Plazo(1) seleccionado ≤ Plazo Máximo del seguro

Monto Solicitado(2) ≥ Monto Mínimo del seguro

Monto Solicitado(2) ≤ Monto Máximo del seguro

Al seleccionar un registro del seguro, mapear:
Monto Seguro ← ProductoSeguro.MontoDefault

Tasa Seguro ← ProductoSeguro.TasaDefault

Total Seguro = MontoSeguro × (1 + TasaSeguro × Plazo)

7. Campo “Fecha de Primer Pago”
Debe existir y usarse para generar las fechas de pago según:

Periodo seleccionado

Plazo seleccionado

8. Campos modificables por el usuario (los “verdes”)
Plazo

Monto Solicitado

Tasa Cotizada

Seguro Financiado

Tipo de Cálculo de Amortización

9. Validaciones obligatorias
Plazo ≥ Plazo Mínimo y ≤ Plazo Máximo

Monto Solicitado ≥ Monto Mínimo y ≤ Monto Máximo

Tasa Cotizada ≥ Tasa Mínima y ≤ Tasa Máxima

10. Botón “COTIZAR”
Al hacer clic:

Tomar los valores modificables.

Generar la Tabla de Amortización según el tipo de cálculo.

La tabla debe incluir:

No

Fecha de Pago

Saldo Insoluto

Capital

Interés

IVA del Interés

Pago Periodo

Pago Seguro

Pago Total (Pago Periodo + Pago Seguro)

Guardar la tabla dentro de la cotización.