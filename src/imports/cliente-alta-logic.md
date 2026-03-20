Módulo: Clientes → Submódulo: Lista de Clientes
Tabla: EFINANCIANET_DB."J_CLIENTES"
Cuando el usuario se encuentre en:

Clientes → Lista de Clientes → Pantalla Modo Alta

y presione el Botón Guardar – Modo Nuevo, debes ejecutar la siguiente lógica institucional.

1. Tabla destino
El registro debe insertarse exclusivamente en:

Código
EFINANCIANET_DB."J_CLIENTES"
Columnas mínimas requeridas:

id (UUID, generado automáticamente)

type (varchar)

subtipo (varchar)

estatus (varchar)

data (jsonb NOT NULL)

2. Reglas institucionales para Alta
2.1 TYPE
Debe asignarse explícitamente:

Código
type = "Cliente"
2.2 SUBTIPO
Debe asignarse según el formulario:

Código
subtipo = "<valor del formulario>"
2.3 ESTATUS
Debe asignarse según el formulario o default institucional:

Código
estatus = "<valor>"
3. Construcción del JSON (campo DATA)
El JSON debe contener todos los campos del formulario de Alta, más todos los subtabs institucionales, incluso si están vacíos.

3.1 Nodo padre (Datos Generales)
Ejemplo conceptual:

json
{
  "nombre": "<valor>",
  "apellidoPaterno": "<valor>",
  "apellidoMaterno": "<valor>",
  "curp": "<valor>",
  "rfc": "<valor>",
  "telefono": "<valor>",
  "correoElectronico": "<valor>",
  "fechaOriginacion": "<valor>",
  "idCliente": "<valor>"
}
3.2 Nodos hijos (SubTabs institucionales)
Debes incluir todos los subtabs EXACTOS que me diste, como nodos JSON independientes:

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

Ejemplo conceptual:

json
{
  "nombre": "...",
  "apellidoPaterno": "...",
  "apellidoMaterno": "...",

  "personasRelacionadas": [],
  "direcciones": [],
  "expedientesElectronicos": [],
  "sic": [],
  "listasNegras": [],
  "kyc": [],
  "garantias": [],
  "perfilTransaccional": [],
  "cuentasAhorro": [],
  "solicitudesCredito": [],
  "creditos": [],
  "inversiones": [],
  "movimientos": [],
  "avisos": [],
  "auditoria": [],
  "archivosAdjuntos": [],
  "convenios": [],
  "cobranzaNormal": [],
  "cobranzaAcumulativa": [],
  "estadoCuenta": [],
  "calendario": [],
  "tarjetaDebito": []
}
Regla institucional:  
Todos los subtabs deben existir en el JSON desde el alta, aunque estén vacíos.

4. Inserción del registro
Cuando el usuario presione Guardar – Modo Nuevo, debes ejecutar:

sql
INSERT INTO EFINANCIANET_DB."J_CLIENTES" (id, type, subtipo, estatus, data)
VALUES (
  gen_random_uuid(),
  'Cliente',
  '<subtipo>',
  '<estatus>',
  '<JSON construido>'::jsonb
);
5. Reglas institucionales
Insertar siempre en J_CLIENTES.

TYPE debe ser "Cliente".

DATA debe ser JSONB válido y completo.

Todos los subtabs deben existir desde el alta.

No eliminar campos del JSON.

No reconstruir el JSON desde cero si ya existe lógica previa.

No duplicar lógica de Prospectos.

No modificar otros módulos.

Respetar el trigger j_clientes_estatus_notif_trg.

6. Nomenclatura obligatoria
Interfaz Gráfica
Módulo: Clientes

Submódulo: Lista de Clientes

Formulario: Modo Alta

Botón: Guardar – Modo Nuevo

Base de Datos
Tabla: J_CLIENTES

Columnas: id, type, subtipo, estatus, data

7. Objetivo del Prompt
Este prompt garantiza:

Que el alta de Clientes sea institucional y consistente.

Que los registros se inserten correctamente en J_CLIENTES.

Que el JSON incluya todos los subtabs oficiales.

Que no se mezcle lógica con Prospectos.

Que el módulo Clientes funcione de forma independiente y auditable.