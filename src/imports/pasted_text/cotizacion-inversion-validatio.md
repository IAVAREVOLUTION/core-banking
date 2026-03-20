Quiero que verifiques y garantices el comportamiento correcto del módulo Cotización, específicamente cuando:

Tipo de Producto = Captación

Subtipo = Inversión

El sistema debe habilitar, mostrar y validar los campos y tablas correspondientes a productos de inversión.

1. Activación de campos especiales para Inversión
Cuando el subtipo sea Inversión, el sistema debe:

Habilitar el campo Plazo (lista de plazos disponibles).

Habilitar el campo Monto (monto a invertir).

Habilitar el campo Periodo de Aportación (si aplica).

Mostrar la tabla de Matriz de Tasa Fija correspondiente al producto seleccionado.

Ninguno de estos elementos debe mostrarse si el subtipo NO es inversión.

2. Despliegue obligatorio de la Matriz de Tasa Fija
Cuando el subtipo sea Inversión, el sistema debe:

Cargar la matriz de tasas desde el producto configurado.

Mostrarla en pantalla de forma dinámica.

Filtrar la matriz según:

Plazo seleccionado

Monto capturado

La matriz debe incluir:

Plazo

Monto mínimo

Monto máximo

Tasa fija aplicable

3. Validación del Monto Mínimo
El sistema debe validar:

Código
monto_capturado >= monto_minimo_configurado
Si el monto capturado es menor al monto mínimo:

Debe mostrar un mensaje de error.

No debe permitir continuar la cotización.

No debe permitir simular.

No debe permitir guardar.

La validación debe hacerse contra el monto mínimo del producto, no contra valores fijos o hardcodeados.

4. Validación del Plazo
El sistema debe validar que:

El plazo seleccionado exista en la matriz del producto.

El plazo corresponda a un rango válido para el monto capturado.

El plazo NO se pueda seleccionar si no existe en la matriz.

5. Validación del Periodo de Aportación
Si el producto lo requiere:

Debe mostrarse el campo Periodo de Aportación.

Debe validarse contra la configuración del producto.

No debe permitir valores fuera de catálogo.

6. Cálculo de la tasa
Una vez seleccionados:

Plazo

Monto

El sistema debe:

Buscar la fila correcta en la matriz.

Obtener la tasa fija correspondiente.

Asignarla automáticamente al campo Tasa (%).

No permitir modificar la tasa manualmente si el producto no lo permite.

7. Resultado esperado
Quiero que la IA valide y garantice:

Que solo cuando el subtipo sea Inversión se activen los campos especiales.

Que la matriz de tasa fija se despliegue correctamente.

Que la validación de monto mínimo funcione correctamente.

Que el plazo se valide contra la matriz.

Que el periodo de aportación se valide correctamente.

Que la tasa fija se calcule desde la matriz y no se invente.

Que no existan valores hardcodeados.

Que no existan validaciones incorrectas.

Que no existan datos mezclados entre productos.