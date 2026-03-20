Módulo Clientes → Submódulo Lista de Clientes
Tabla: EFINANCIANET_DB."J_CLIENTES"
Cuando el usuario ingrese al:

Módulo Clientes → Submódulo Lista de Clientes

debes ejecutar la siguiente lógica institucional para consultar y mostrar todos los registros existentes en la tabla J_CLIENTES, sin aplicar filtros por tipo, subtipo o estatus.

1. Tabla a consultar
Debes consultar exclusivamente:

Código
EFINANCIANET_DB."J_CLIENTES"
Columnas mínimas requeridas:

id (UUID)

type

subtipo

estatus

data (jsonb NOT NULL)

2. Consulta institucional (SIN FILTROS)
Debes traer todos los registros, sin importar si son:

Cliente

Prospecto

Contacto

Cualquier otro tipo

Consulta:

sql
SELECT id, type, subtipo, estatus, data
FROM EFINANCIANET_DB."J_CLIENTES";
Regla institucional:  
Esta consulta NO debe aplicar filtros por ahora.
El objetivo es validar que el endpoint realmente lee la tabla y devuelve todos los registros existentes.

3. Procesamiento del JSON
Debes leer el contenido del campo:

Código
data (jsonb)
y extraer el nodo padre del JSON para mapearlo al listado.

4. Mapeo obligatorio al applet de lista
Debes mapear los siguientes campos al:

Formulario de Lista Principal → Campos de Lista

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
TIPO	columna type
FECHA ORIGINACIÓN	data.fechaOriginacion
ID CLIENTE / PROSPECTO	data.idCliente o data.idProspecto
Regla institucional:  
No eliminar campos del JSON aunque no se muestren en la lista.

5. Mapeo obligatorio de la llave primaria
El campo:

Código
id (UUID)
debe mapearse obligatoriamente a un Campo de Lista, aunque sea oculto, porque será la llave primaria para:

Editar

Ver

Cargar el registro en formularios

Guardar cambios

6. Reglas institucionales
Consultar únicamente la tabla J_CLIENTES.

No aplicar filtros por ahora.

No mezclar lógica con Prospectos.

No eliminar campos del JSON.

No reconstruir el JSON desde cero.

No modificar otros módulos.

Respetar el trigger j_clientes_estatus_notif_trg.

Mantener la arquitectura institucional:

lectura del JSON

mapeo del nodo padre

preservación de campos

uso de ID como llave primaria

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

Columna type

8. Objetivo del Prompt
Este prompt garantiza:

Que el endpoint traiga todos los registros de J_CLIENTES.

Que se valide que la tabla realmente contiene datos.

Que no se mezcle lógica con Prospectos.

Que la lista funcione igual que en otros módulos (Productos, Prospectos).

Que se mantenga la arquitectura institucional de lectura y mapeo JSON.