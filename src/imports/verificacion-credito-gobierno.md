Verificar punto por punto que cada regla, comportamiento, pick‑map, validación, filtrado y cálculo esté implementado y funcionando exactamente como se especifica.

1. Verificación del campo “INSTITUCIÓN GOBIERNO”
Confirmar que:

El campo existe en el formulario.

Es un campo de búsqueda (search specification).

Filtra exclusivamente clientes cuya clasificación = “Gobierno Magisterio”.

Ejemplos como “Sindicato XXIII Trabajadores de Educación Ecuador” aparecen correctamente.

El valor seleccionado se guarda en data.institucionGobierno.

2. Verificación del campo “Producto” (Crédito)
Confirmar que:

El campo lista productos desde J_PRODUCTOS.

El filtrado cumple ambas condiciones:

Coincide con la Institución Gobierno seleccionada.

Existe en la subvista Convenios con lineaProducto = "Credito".

Al seleccionar un producto:

Se llena producto_id (campo físico).

Se llena data.producto.* (pick‑map completo).

Se carga la moneda del producto en data.moneda.

3. Verificación del campo “Plazos y Montos” (Matriz Tasa Fija)
Confirmar que:

El campo lista TODOS los registros de la subvista Matriz Tasa Fija del producto seleccionado.

Al seleccionar un registro, se mapean EXACTAMENTE estos campos:

data.periodo ← Periodo (lectura)

data.plazoMinimo ← Plazo Mínimo

data.plazoMaximo ← Plazo Máximo

data.plazo ← Plazo Default

data.montoMinimo ← Monto Mínimo

data.montoMaximo ← Monto Máximo

data.montoSolicitado ← Monto Default

data.moneda ← Moneda del producto

data.tasaMinima ← Tasa Mínima

data.tasaMaxima ← Tasa Máxima

data.tasaCotizada ← Tasa Default

4. Verificación del campo “Garantía”
Confirmar que:

El campo existe y es un catálogo de valores.

Lista únicamente las garantías del producto seleccionado.

Al seleccionar una garantía, se mapean:

data.tipoGarantia ← Garantías.TIPO

data.subtipoGarantia ← Garantías.SUBTIPO

data.aforo ← % Aforo

data.montoGarantia = montoSolicitado × aforo

Validar ejemplos:

Si monto = 100,000 y aforo = 10% → garantía = 10,000

Si monto = 100,000 y aforo = 200% → garantía = 200,000

5. Verificación del campo “Cálculo de Amortización”
Confirmar que:

El campo existe y es una lista de valores.

Lista todos los tipos de cálculo disponibles.

El valor seleccionado se guarda en data.tipoCalculoAmortizacion.

6. Verificación del campo “Seguro Financiado”
Confirmar que:

Existe un checkbox “Seguro Financiado”.

Si NO está seleccionado → no muestra campos adicionales.

Si SÍ está seleccionado:

Se habilita el campo “Seguro”.

El campo “Seguro” lista productos de la subvista Paquetes con tipo = "Seguro".

El campo “Plazos y Montos del Seguro” filtra la matriz del seguro usando:

plazoSeleccionado ≥ plazoMinimoSeguro

plazoSeleccionado ≤ plazoMaximoSeguro

montoSolicitado ≥ montoMinimoSeguro

montoSolicitado ≤ montoMaximoSeguro

Al seleccionar un registro filtrado, se mapean:

data.montoSeguro ← Monto Default

data.tasaSeguro ← Tasa Default

data.totalSeguro = montoSeguro × (1 + tasaSeguro × plazo)

7. Verificación del campo “Fecha de Primer Pago”
Confirmar que:

El campo existe.

Se guarda en data.fechaPrimerPago.

Se usa para generar la tabla de amortización.

8. Verificación de validaciones institucionales
Confirmar que:

Plazo cumple:

plazo ≥ plazoMinimo

plazo ≤ plazoMaximo

Monto Solicitado cumple:

monto ≥ montoMinimo

monto ≤ montoMaximo

Tasa Cotizada cumple:

tasa ≥ tasaMinima

tasa ≤ tasaMaxima

Si alguna validación falla → debe bloquear el guardado o mostrar error.

9. Verificación del botón “COTIZAR”
Confirmar que:

El botón existe.

Solo se habilita cuando todos los campos obligatorios están completos.

Al hacer clic:

Se toman los valores modificables (los marcados en verde).

Se genera la tabla de amortización según el tipo de cálculo seleccionado.

La tabla contiene EXACTAMENTE estas columnas:

No

Fecha de Pago

Saldo Insoluto

Capital

Interés

IVA del Interés

Pago Periodo

Pago Seguro

Pago Total (Pago Periodo + Pago Seguro)

La tabla se guarda en:

Código
data.tablaAmortizacion[]
10. Verificación de persistencia en BD
Confirmar que:

no_cotiza se genera automáticamente.

cliente_id se guarda correctamente.

producto_id se guarda correctamente.

linea_cotizacion = "Crédito"

data contiene:

producto

matriz seleccionada

garantía

seguro (si aplica)

cálculos

tabla de amortización

fechaPrimerPago

todos los pick‑maps

11. Resultado esperado
Si todo está implementado correctamente:

El formulario funciona igual que Captación.

Todos los pick‑maps funcionan.

Todos los filtros funcionan.

Todas las validaciones funcionan.

La tabla de amortización se genera correctamente.

La persistencia en BD es completa y consistente.