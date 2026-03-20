Módulo: Clientes → Submódulo: Lista de Clientes
Tabla: EFINANCIANET_DB."J_CLIENTES"
Cuando el usuario haga clic en la Liga de Editar dentro del submódulo Clientes → Lista de Clientes, debes ejecutar la siguiente lógica institucional.

1. Obtención del ID (llave primaria)
Tomar el valor del campo id del registro seleccionado en la lista.

Este ID corresponde a:

Código
id (UUID)
de la tabla:

Código
EFINANCIANET_DB."J_CLIENTES"
2. Consulta del registro
Ejecutar:

sql
SELECT id, type, subtipo, estatus, data
FROM EFINANCIANET_DB."J_CLIENTES"
WHERE id = <ID>;
3. Procesamiento del JSON
Tomar el contenido del campo data (jsonb).

Interpretarlo como JSON válido.

Mapearlo a la interfaz gráfica en Modo Editar.

Mantener la estructura padre + subtabs sin eliminar nodos.

4. Mapeo a la interfaz gráfica (Modo Editar)
4.1 Campos físicos (fuera del JSON)
Mostrar en modo lectura o edición según diseño:

type (siempre = "Cliente")

subtipo

estatus

4.2 Nodo padre del JSON (Datos Generales)
Mapear en modo edición:

nombre

apellidoPaterno

apellidoMaterno

curp

rfc

telefono

correoElectronico

fechaOriginacion

idCliente

cualquier otro campo del nodo padre

4.3 Nodos hijos (SubTabs institucionales)
Cada subtab debe recibir únicamente su nodo correspondiente:

personasRelacionadas

direcciones

expedientesElectronicos

sic

listasNegras

kyc

garantias

perfilTransaccional

cuentasAhorro

solicitudesCredito

creditos

inversiones

movimientos

avisos

auditoria

archivosAdjuntos

convenios

cobranzaNormal

cobranzaAcumulativa

estadoCuenta

calendario

tarjetaDebito

Cada subtab debe mostrar su información en modo edición, respetando la estructura existente.

5. Reglas institucionales del Modo Editar
No eliminar campos del JSON.

No eliminar subtabs aunque estén vacíos.

No reconstruir el JSON desde cero.

No modificar la llave primaria id.

No modificar el campo type.

No duplicar nodos.

No mezclar lógica con Prospectos.

No usar repositorios ni DTOs compartidos.

Mantener la estructura padre + subtabs.

6. Nomenclatura obligatoria
Interfaz Gráfica
Módulo: Clientes

Submódulo: Lista de Clientes

Formulario: Modo Editar

Liga: Editar

Base de Datos
Tabla: J_CLIENTES

Columnas: id, type, subtipo, estatus, data

7. Objetivo del Prompt
Este prompt garantiza:

Que el registro se cargue correctamente en modo edición.

Que se respete la estructura JSON institucional.

Que todos los subtabs se mapeen correctamente.

Que no se pierda información.

Que el módulo Clientes funcione de forma independiente y auditable.

⭐ PROMPT 3.1 — GUARDAR / EDITAR CLIENTE
Botón: Guardar – Modo Editar
Tabla: EFINANCIANET_DB."J_CLIENTES"
Cuando el usuario presione el Botón Guardar – Modo Editar, debes ejecutar la siguiente lógica institucional.

1. Obtención del ID
Tomar el valor del campo id del formulario.

Debe coincidir con:

Código
id (UUID)
de la tabla:

Código
EFINANCIANET_DB."J_CLIENTES"
2. Construcción del JSON actualizado (MERGE SEGURO)
2.1 Leer el JSON actual desde la base de datos
sql
SELECT data
FROM EFINANCIANET_DB."J_CLIENTES"
WHERE id = <ID>;
2.2 Construir un JSON parcial con los campos editados
Ejemplo conceptual:

json
{
  "nombre": "<nuevo>",
  "apellidoPaterno": "<nuevo>",
  "apellidoMaterno": "<nuevo>",
  "curp": "<nuevo>",
  "rfc": "<nuevo>",
  "telefono": "<nuevo>",
  "correoElectronico": "<nuevo>",
  "fechaOriginacion": "<nuevo>",
  "idCliente": "<nuevo>",

  "personasRelacionadas": [...],
  "direcciones": [...],
  "expedientesElectronicos": [...],
  "sic": [...],
  "listasNegras": [...],
  "kyc": [...],
  "garantias": [...],
  "perfilTransaccional": [...],
  "cuentasAhorro": [...],
  "solicitudesCredito": [...],
  "creditos": [...],
  "inversiones": [...],
  "movimientos": [...],
  "avisos": [...],
  "auditoria": [...],
  "archivosAdjuntos": [...],
  "convenios": [...],
  "cobranzaNormal": [...],
  "cobranzaAcumulativa": [...],
  "estadoCuenta": [...],
  "calendario": [...],
  "tarjetaDebito": [...]
}
2.3 Fusionar (MERGE) el JSON parcial con el JSON existente
El merge debe ser:

sql
UPDATE EFINANCIANET_DB."J_CLIENTES"
SET data = data || '<json_parcial>'::jsonb
WHERE id = <ID>;
Reglas del merge:

data SIEMPRE va a la izquierda.

<json_parcial> SIEMPRE va a la derecha.

Esto garantiza que:

Se actualizan solo los campos enviados.

Se conservan todos los demás.

No se borra nada.

2.4 Reglas de preservación
No eliminar campos existentes.

No eliminar subtabs no editados.

No eliminar campos sensibles.

No eliminar campos que no estén en el formulario.

No reemplazar el JSON completo.

No reconstruir el JSON desde cero.

3. Actualización del registro
Ejecutar:

sql
UPDATE EFINANCIANET_DB."J_CLIENTES"
SET 
  data = data || '<json_parcial>'::jsonb,
  subtipo = '<nuevo_subtipo>',
  estatus = '<nuevo_estatus>'
WHERE id = <ID>;
4. Reglas institucionales
TYPE debe permanecer como "Cliente".

No modificar la llave primaria.

No eliminar campos del JSON.

No duplicar nodos.

Mantener la estructura padre + subtabs.

No mezclar lógica con Prospectos.

5. Objetivo del Prompt
Este prompt garantiza:

Que la edición de Clientes sea segura y auditable.

Que el JSON se actualice sin perder información.

Que todos los subtabs se preserven.

Que el módulo Clientes funcione con la misma arquitectura institucional que el resto del sistema.