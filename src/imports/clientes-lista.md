Módulo Clientes → Lista de Clientes
Tabla: J_CLIENTES
Cuando el usuario ingrese al:

Módulo Clientes → Submódulo Lista de Clientes

debes ejecutar la misma lógica institucional que usa el módulo Prospectos, con las mismas reglas de:

consulta

mapeo

lectura del JSON

estructura padre + subtabs

preservación de campos

manejo de ID

comportamiento de Editar / Ver

pero filtrando únicamente registros cuyo type = "Cliente".

1. Tabla a consultar
Debes consultar la tabla:

Código
J_CLIENTES
Columnas mínimas:

id (UUID)

type

subtipo

estatus

data (jsonb)

2. Filtro obligatorio del submódulo
El submódulo Lista de Clientes debe mostrar solo clientes reales, por lo que debes aplicar:

Código
type = "Cliente"
No se deben mostrar:

Prospectos (type = "Prospecto")

Contactos (type = "Contacto")

Ningún otro tipo

Consulta institucional:

sql
SELECT *
FROM J_CLIENTES
WHERE type = 'Cliente';
3. Campo JSON a procesar
Debes leer el contenido del campo:

Código
data (jsonb)
y extraer el nodo padre del JSON para mapearlo al listado, igual que en Prospectos.

4. Mapeo obligatorio al applet de lista (MISMA LÓGICA QUE PROSPECTOS)
Debes mapear los siguientes campos al:

Formulario de Lista Principal → Campos de Lista

La estructura es idéntica a Prospectos, solo cambiando el filtro.

Campo en UI	Origen
Editar	Acción (liga)
Ver	Acción (liga)
NOMBRE COMPLETO	data.nombre + data.apellidoPaterno + data.apellidoMaterno
CURP	data.curp
RFC	data.rfc
TELÉFONO	data.telefono
CORREO	data.correoElectronico
ESTATUS	columna estatus
SUBTIPO	columna subtipo
FECHA ORIGINACIÓN	data.fechaOriginacion
ID CLIENTE	data.idCliente (si existe) o data.idProspecto (si migró)
Regla institucional:  
Si el JSON contiene campos adicionales (ej. SIC, listas negras, direcciones, etc.), no se eliminan y no se muestran en la lista, pero sí se conservan para Editar / Ver.

5. Mapeo obligatorio de la llave primaria
El campo:

Código
id (UUID)
debe mapearse obligatoriamente a un Campo de Lista, aunque sea oculto, porque será la llave primaria para:

Liga de Edit

Liga de View

Carga del registro en formularios

Persistencia en modo Editar

6. Reglas institucionales (MISMAS QUE PROSPECTOS)
Consultar únicamente la tabla J_CLIENTES.

Filtrar por type = 'Cliente'.

Leer el nodo padre del JSONB.

Mapear los campos del grid exactamente como se definieron.

Mapear obligatoriamente la llave primaria id.

No duplicar lógica si ya existe implementación previa.

No eliminar campos del JSON.

No reconstruir el JSON desde cero.

No modificar otros módulos.

Respetar el trigger j_clientes_estatus_notif_trg (no interferir con él).

Mantener la misma arquitectura que Prospectos:

misma forma de leer JSON

misma forma de mapear

misma forma de cargar Editar / Ver

misma forma de preservar campos

7. Nomenclatura obligatoria
Interfaz Gráfica
Tab del Módulo: Clientes

SubTab: Lista de Clientes

Formulario de Lista Principal

Campo de Lista

Liga de Edit

Liga de View

Base de Datos
Tabla: J_CLIENTES

Columna id (UUID)

Columna data (jsonb)

Columna estatus

Columna subtipo

8. Objetivo del Prompt
Este prompt garantiza:

Que Clientes funcione exactamente igual que Prospectos, con la misma arquitectura y comportamiento.

Que solo se muestren registros con type = "Cliente".

Que se respete la estructura JSON institucional.

Que no se pierda información.

Que el módulo Clientes sea consistente con Prospectos, pero sin mezclar tipos.