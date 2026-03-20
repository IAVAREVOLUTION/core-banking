Quiero que analices y verifiques que el subtab Comisiones se esté guardando únicamente dentro del registro correspondiente en la tabla:

Código
EFINANCIANET_DB.J_CUENTAS_CORP_CLIENTES
y que el contenido se almacene exclusivamente dentro del campo:

Código
data jsonb
en la ruta:

Código
data.solicitud.comisiones
Cada solicitud debe guardar solo sus propias comisiones, asociadas a su propio id del registro.

1. Validación de independencia por registro
Evalúa si:

El registro con id = X guarda solo las comisiones capturadas para ese registro.

Ningún registro copia comisiones de otro registro.

Ningún registro hereda comisiones de otro producto.

Ningún registro comparte comisiones con otros IDs.

Ningún registro sobrescribe comisiones de otro.

Cada solicitud debe tener su propio bloque:

Código
data.solicitud.comisiones
y debe ser único por ID.

2. Validación de estructura correcta del JSON
El subtab Comisiones debe guardarse EXACTAMENTE así:

Código
"comisiones": [
  {
    "tipo_comision": "...",
    "descripcion": "...",
    "monto": ...,
    "porcentaje": ...,
    "periodicidad": "..."
  }
]
Evalúa si:

La estructura es idéntica en todos los productos.

No existen variantes como:

comisionesRegistros

comisonestab

comision

lista_comisiones

No existen campos mal escritos o renombrados.

No existen objetos anidados incorrectos.

No existen arrays mezclados entre solicitudes.

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

Cualquier variación debe marcarse como error de homologación.

4. Validación de persistencia por ID
Evalúa si:

El registro con id = 6 guarda sus propias comisiones dentro de data.solicitud.comisiones.

El registro con id = 7 guarda sus propias comisiones dentro de data.solicitud.comisiones.

El registro con id = 8 guarda sus propias comisiones dentro de data.solicitud.comisiones.

Y así sucesivamente.

Cada registro debe tener su propio bloque independiente.

5. Validación de contenido
Evalúa si:

Los valores capturados en el formulario se guardan correctamente.

No se guardan valores vacíos cuando el usuario sí capturó datos.

No se guardan valores inventados.

No se guardan valores por defecto no autorizados.

No se mezclan comisiones entre solicitudes.

No se duplican comisiones.

No se pierden datos al guardar.

6. Validación de origen de datos
Determina si el error proviene de:

Frontend (estado global, store, cache, variables compartidas).

Backend (DTO, mapper, servicio, lógica de persistencia).

Un payload incorrecto.

Un modelo mal definido.

Un guardado automático que sobrescribe datos.

Un error en la lectura del producto.

7. Resultado esperado
Quiero un diagnóstico técnico, puntual y verificable, que indique:

Por qué las comisiones se están compartiendo entre registros.

Qué módulo está generando el error.

Qué nombre incorrecto se está usando.

Qué ruta JSON está mal.

Qué corrección técnica se requiere para que:

Cada solicitud guarde SOLO sus propias comisiones en:
Código
data.solicitud.comisiones
y queden asociadas únicamente al id del registro correspondiente.