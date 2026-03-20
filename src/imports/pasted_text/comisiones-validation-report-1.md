Quiero que analices cómo se está guardando el subtab Comisiones en los cuatro módulos de productos:

Producto Crédito

Producto Captación

Producto Línea de Crédito

Producto Seguro (si aplica)

y determines por qué cada uno está guardando el JSON con nombres diferentes, cuando TODOS deben guardarse en data.solicitud.comisiones.

1. Validación de nombres usados actualmente
Detecta y compara los nombres reales que el sistema está usando para guardar comisiones:

En Captación → "comisionesRegistros"

En Crédito → "comisiones"

En Línea de Crédito → "comisonestab"

En otros módulos → cualquier variante adicional

Evalúa si:

Los nombres son inconsistentes.

Los nombres no coinciden con el estándar requerido.

Los nombres rompen la estructura JSON esperada.

Los nombres generan rutas distintas dentro de data.

2. Nombre correcto obligatorio
TODOS los módulos deben guardar el subtab Comisiones EXCLUSIVAMENTE como:

Código
"comisiones": [
  {
    "tipo_comision": ...,
    "descripcion": ...,
    "monto": ...,
    "porcentaje": ...,
    "periodicidad": ...
  }
]
Evalúa si:

Algún módulo NO usa "comisiones".

Algún módulo usa nombres alternos o incorrectos.

Algún módulo guarda arrays o estructuras distintas.

Algún módulo guarda objetos en rutas equivocadas.

3. Validación de la ruta JSON
El subtab Comisiones debe guardarse en:

Código
data.solicitud.comisiones
Detecta si algún módulo lo guarda en rutas incorrectas como:

data.comisiones

data.solicitud.comisionesRegistros

data.solicitud.comisonestab

data.solicitud.producto.comisiones

data.solicitud.condiciones.comisiones

data.solicitud.lista_comisiones

Cualquier variación debe marcarse como error de homologación.

4. Validación de estructura interna
Evalúa si los campos dentro de cada comisión son consistentes:

Los campos correctos son:

tipo_comision

descripcion

monto

porcentaje

periodicidad

Detecta si algún módulo usa variantes como:

tipoComision

tipo-comision

tipo

descripcion_comision

monto_comision

pct

periodo

frecuencia

Cualquier diferencia debe marcarse como error de estructura.

5. Validación de contenido
Evalúa si:

Los valores capturados en el formulario se guardan correctamente.

No se guardan valores vacíos cuando el usuario sí capturó datos.

No se guardan valores inventados.

No se guardan valores por defecto no autorizados.

No se mezclan comisiones de otros productos.

No se duplican comisiones.

No se pierde información al guardar.

6. Resultado esperado
Quiero un diagnóstico técnico, puntual y verificable, que indique:

Qué módulos están guardando mal el subtab Comisiones.

Qué nombres incorrectos están usando.

Qué rutas JSON están incorrectas.

Qué campos están mal nombrados.

Qué estructura está rota.

Qué corrección técnica se requiere para homologar los 4 módulos.