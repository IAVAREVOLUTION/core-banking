Quiero que analices cómo se está guardando el subtab Comisiones dentro del campo:

Código
EFINANCIANET_DB.J_CUENTAS_CORP_CLIENTES.data
para los tres productos:

Producto Crédito

Producto Captación

Producto Línea de Crédito (Producto Seguro)

y determines si:

La estructura JSON es consistente entre los tres productos.

Los nombres de los campos son idénticos.

Las rutas dentro del JSON son idénticas.

Los valores se guardan en el lugar correcto.

No existen diferencias, errores o variaciones no autorizadas.

1. Estructura esperada del subtab “comisiones”
El JSON dentro de data debe contener EXACTAMENTE esta estructura:

Código
"comisiones": [
  {
    "tipo_comision": null,
    "descripcion": null,
    "monto": null,
    "porcentaje": null,
    "periodicidad": null
  }
]
Evalúa si:

Los tres productos guardan exactamente esta estructura.

No existen campos adicionales.

No existen campos faltantes.

No existen diferencias en mayúsculas/minúsculas.

No existen diferencias en snake_case, camelCase o kebab-case.

No existen rutas distintas (ej. comision, comisiones_producto, lista_comisiones, etc.).

No existen objetos anidados incorrectos.

No existen arrays mal formados.

2. Validación de nombres de campos
Evalúa si en los tres productos los campos se guardan con los mismos nombres:

tipo_comision

descripcion

monto

porcentaje

periodicidad

Detecta si alguno de los productos usa variantes como:

tipoComision

tipo-comision

tipo

descripcion_comision

monto_comision

pct

periodo

frecuencia

periodicidad_pago

Cualquier diferencia debe marcarse como error de homologación.

3. Validación de rutas dentro del JSON
Evalúa si el subtab Comisiones está guardado en la ruta correcta:

Código
data.solicitud.comisiones
Detecta si alguno de los productos lo guarda en rutas incorrectas como:

data.comisiones

data.solicitud.producto.comisiones

data.solicitud.condiciones.comisiones

data.solicitud.terminos.comisiones

data.solicitud.comision

data.solicitud.lista_comisiones

Cualquier variación debe marcarse como error de estructura.

4. Validación de contenido
Evalúa si:

Los valores capturados en el formulario se guardan correctamente.

No se guardan valores vacíos cuando el usuario sí capturó datos.

No se guardan valores inventados.

No se guardan valores por defecto no autorizados.

No se mezclan comisiones de otros productos.

No se duplican comisiones.

No se pierde información al guardar.

5. Validación de consistencia entre productos
Evalúa si:

Crédito, Captación y Línea de Crédito guardan comisiones con la misma estructura.

No existen diferencias entre productos.

No existen campos exclusivos de un producto que no existan en los otros.

No existen estructuras JSON distintas.

No existen rutas distintas.

No existen nombres de campos distintos.

6. Resultado esperado
Quiero un diagnóstico técnico, puntual y verificable, que indique:

Qué producto está guardando mal el subtab Comisiones.

Qué diferencias existen entre los tres productos.

Qué campos están mal nombrados.

Qué rutas JSON están incorrectas.

Qué valores no se están guardando correctamente.

Qué corrección técnica se requiere.