PROMPT INSTITUCIONAL — SUB‑CATEGORÍA “CRÉDITO” (MÓDULO COTIZACIONES)
1. Vista de Lista (Listado de Cotizaciones de Crédito)
La tabla debe mostrar:

Id Cotiza (no_cotiza)

Fecha y Hora (fecha_cotiza)

Usuario (data.usuario)

Producto (data.producto.nombreProducto)

Monto Cotizado (data.montoSolicitado)

Tasa Interés (data.tasaCotizada)

Plazo (data.plazo)

Periodo (data.periodo)

Interés a Pagar (data.interesAPagar)

Pago por Periodo (data.pagoPeriodo)

Estatus (estatus_cotiza)

2. Botón “Nuevo” — Formulario Principal + Subvista “Default”
2.1 Campos obligatorios
ID Cotización

Automático → llenar no_cotiza

Línea de Producto

Valor fijo: "Crédito"

Solo lectura

Guardar en linea_cotizacion

Prospecto/Cliente

Modal con TODOS los registros de J_CLIENTES

Pick‑map obligatorio:

cliente_id (campo físico)

data.claveCliente

data.nombreCompleto

En el portal no se muestra, pero al enviar se guarda el ID del cliente firmado.

Institución Gobierno

Search specification:

clasificacionCliente = "Gobierno Magisterio"

Guardar en data.institucionGobierno

3. Campo “Producto” (Crédito)
El campo Producto debe listar productos desde J_PRODUCTOS que cumplan:

Coinciden con la Institución Gobierno seleccionada

Existen en la subvista Convenios

lineaProducto = "Crédito"

Al seleccionar un producto:
Llenar producto_id (campo físico)

Pick‑map completo a data.producto.*

Moneda del producto → data.moneda

4. Campo “Plazos y Montos” (Matriz Tasa Fija)
Debe listar TODOS los registros de la subvista Matriz Tasa Fija del producto seleccionado.

Al seleccionar un registro de la matriz:
Pick‑map obligatorio:

Periodo → data.periodo (lectura)

Plazo Mínimo → data.plazoMinimo (lectura)

Plazo Máximo → data.plazoMaximo (lectura)

Plazo Default → data.plazo (editable)

Monto Mínimo → data.montoMinimo (lectura)

Monto Máximo → data.montoMaximo (lectura)

Monto Default → data.montoSolicitado (editable)

Moneda → data.moneda (lectura)

Tasa Mínima → data.tasaMinima (lectura)

Tasa Máxima → data.tasaMaxima (lectura)

Tasa Default → data.tasaCotizada (editable)

5. Campo “Garantía”
Debe listar las garantías del producto seleccionado (catálogo de valores).

Al seleccionar una garantía:
Pick‑map obligatorio:

Tipo Garantía → data.tipoGarantia

Subtipo Garantía → data.subtipoGarantia

% Aforo → data.aforo

Monto Garantía →

montoSolicitado
⋅
aforo
Guardar en data.montoGarantia

6. Campo “Cálculo de Amortización”
Lista de valores con los tipos de cálculo disponibles:

Francés

Alemán

Americano

Simple

Otros que existan en tu catálogo

Guardar en:

data.tipoCalculoAmortizacion

7. Campo “Seguro Financiado”
Si el usuario activa el check:
Mostrar campo Seguro

Lista de valores desde la subvista Paquetes del producto

Filtrar por tipo = "Seguro"

Al seleccionar un seguro:

Filtrar la subvista Matriz Tasa Fija del seguro usando constraint:

Código
plazoSeleccionado >= plazoMinimoSeguro
AND plazoSeleccionado <= plazoMaximoSeguro
AND montoSolicitado >= montoMinimoSeguro
AND montoSolicitado <= montoMaximoSeguro
Al seleccionar un registro filtrado:

Pick‑map obligatorio:

Monto Seguro → data.montoSeguro (lectura)

Tasa Seguro → data.tasaSeguro (lectura)

Total Seguro →

montoSeguro
⋅
(
1
+
tasaSeguro
⋅
plazo
)
Guardar en data.totalSeguro

8. Campo “Fecha de Primer Pago”
Guardar en:

data.fechaPrimerPago

Esta fecha se usa para generar la tabla de amortización.

9. Validaciones institucionales
Plazo

plazo
≥
plazoMinimo
y
plazo
≤
plazoMaximo
Monto Solicitado

montoSolicitado
≥
montoMinimo
y
montoSolicitado
≤
montoMaximo
Tasa Cotizada

tasaCotizada
≥
tasaMinima
y
tasaCotizada
≤
tasaMaxima
10. Botón “COTIZAR” — Generación de la Tabla de Amortización
Cuando el usuario presione COTIZAR, el sistema debe generar la tabla de amortización con base en:

Tipo de cálculo seleccionado

Plazo

Periodo

Monto solicitado

Tasa cotizada

Seguro financiado (si aplica)

Fecha de primer pago

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

La tabla debe guardarse en:
Código
data.tablaAmortizacion[]
11. Persistencia en BD (J_COTIZACIONES)
Campos físicos:
no_cotiza

producto_id

cliente_id

fecha_cotiza

estatus_cotiza

linea_cotizacion = "Crédito"

Campos dinámicos:
Todo lo demás debe guardarse en:

Código
data (jsonb)
12. Resultado esperado
La subcategoría Crédito funcionará igual que Captación.

El formulario será completo, dinámico y validado.

Los pick‑maps funcionarán sin errores.

La tabla de amortización se generará correctamente.

La persistencia será consistente con J_COTIZACIONES.

El módulo quedará listo para usarse en Portal y Backoffice.