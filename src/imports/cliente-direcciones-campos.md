Módulo Clientes → Subtab “Direcciones”

No se están cargando todos los campos que sí existen en la base de datos al momento de visualizar o editar el registro.

Campos que no se están mostrando correctamente:

Número exterior

Número interior

Piso

(Validar si hay más campos afectados)

Solicito:

Verificar que el SELECT esté trayendo todos los campos de la tabla.

Revisar que el mapeo entre backend y frontend sea correcto.

Confirmar que los nombres de los campos coincidan exactamente con los de la base de datos.

Validar que el estado del formulario esté recibiendo y asignando correctamente los valores al abrir el registro.

2️⃣ Módulos afectados

El mismo problema ocurre en los siguientes módulos:

SIC

Expedientes Electrónicos

Listas Negras

En estos módulos no se están cargando todos los datos del registro, aun cuando los valores sí existen en la base de datos.

Solicito:

Revisar las consultas a la base de datos.

Validar que no se estén omitiendo campos en el backend.

Confirmar que el frontend esté renderizando todos los campos disponibles.

Revisar si hay problemas en los modelos, DTOs o serializers (si aplica).

🎯 Objetivo

Asegurar que:

Todos los campos almacenados en la base de datos se reflejen correctamente en la interfaz.

No haya discrepancias entre la estructura de la base de datos y los formularios.

Los registros se carguen completos en todos los módulos mencionados.