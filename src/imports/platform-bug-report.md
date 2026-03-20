Se requiere revisar y corregir los siguientes errores en la plataforma:

Subtab “Direcciones”

Hay campos que no se están guardando correctamente en la base de datos.

Ejemplo: el campo “Piso” no persiste la información.

Validar que todos los campos del formulario estén correctamente mapeados al modelo y que se estén enviando en el payload al backend.

Verificar también que se carguen correctamente al editar el registro.

Expedientes Electrónicos

Se muestra un registro de la base de datos que no está relacionado con el usuario autenticado.

Revisar el filtro por user_id o la relación correspondiente.

Validar que la consulta solo retorne registros asociados al usuario logueado.

SIC

Ocurre el mismo problema: aparecen registros que no pertenecen al usuario.

Verificar relaciones, joins y filtros por usuario/cliente.

Confirmar que no falte alguna condición en el WHERE.

Fecha y Hora

No se está guardando correctamente la fecha y hora del registro.

Tampoco se está guardando o mostrando el usuario que realizó el registro.

Validar:

Si el backend está generando el timestamp automáticamente.

Si el campo existe en la base de datos.

Si el frontend lo está enviando o mostrando correctamente.

Listas Negras

No se está guardando o cargando el usuario que registró la información.

Revisar consistencia con el manejo de auditoría (created_at, created_by, updated_at, updated_by).

Objetivo:
Asegurar que:

Todos los campos del frontend estén correctamente persistidos en la base de datos.

Todos los módulos filtren estrictamente por el usuario autenticado.

Se implemente correctamente la auditoría de registros (fecha, hora y usuario).