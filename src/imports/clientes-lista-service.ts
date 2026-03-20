Módulo Clientes → Submódulo Lista de Clientes
Tabla: EFINANCIANET_DB."J_CLIENTES"
Endpoint completamente nuevo, independiente del de Prospectos
Quiero que generes un nuevo endpoint exclusivo para el submódulo:

Clientes → Lista de Clientes

Este endpoint debe ser totalmente independiente del endpoint existente que usa Prospectos, y debe cumplir las siguientes reglas institucionales:

1. Tabla a consultar
El endpoint debe consultar únicamente:

Código
EFINANCIANET_DB."J_CLIENTES"
Columnas mínimas requeridas:

id

type

subtipo

estatus

data

2. Regla institucional: traer TODOS los registros (sin filtros)
El endpoint debe traer todos los registros existentes en la tabla, sin importar:

type

subtipo

estatus

contenido del JSON

Consulta institucional:

sql
SELECT id, type, subtipo, estatus, data
FROM EFINANCIANET_DB."J_CLIENTES";
Regla institucional:  
No debe existir ningún filtro.
No debe excluir Prospectos ni Contactos por ahora.
No debe aplicar lógica heredada del módulo Prospectos.
No debe usar repositorios compartidos.
No debe usar DTOs compartidos.

3. Prohibiciones explícitas
El endpoint NO debe:

Usar el endpoint existente de Prospectos

Usar el repositorio de Prospectos

Usar el DTO de Prospectos

Usar la consulta de Prospectos

Usar filtros heredados de Prospectos

Usar lógica que mezcle tipos

Usar fallback automático a Prospectos

Usar caché del endpoint de Prospectos

4. Procesamiento del JSON
El endpoint debe:

Leer el campo data (jsonb)

Interpretarlo como JSON válido

Extraer el nodo padre

Mapear los campos de la lista

5. Mapeo obligatorio al applet de lista
Campo en UI	Origen
Editar	Acción
Ver	Acción
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
6. Mapeo obligatorio de la llave primaria
El campo:

Código
id (UUID)
debe mapearse obligatoriamente como llave primaria para:

Editar

Ver

Cargar el registro

Guardar cambios

7. Reglas institucionales
Consultar únicamente la tabla J_CLIENTES.

No aplicar filtros por ahora.

No mezclar lógica con Prospectos.

No usar repositorios compartidos.

No usar DTOs compartidos.

No modificar otros módulos.

Respetar el trigger j_clientes_estatus_notif_trg.

Mantener la arquitectura institucional:

lectura del JSON

mapeo del nodo padre

preservación de campos

uso de ID como llave primaria

8. Objetivo del Prompt
Este prompt garantiza:

Un endpoint nuevo, limpio y aislado

Que traiga todos los registros de J_CLIENTES

Que no herede lógica del módulo Prospectos

Que respete la estructura JSON institucional

Que la lista funcione correctamente