Basado en la tabla real:
sql
EFINANCIANET_DB."J_GARANTIAS" (
  uuid uuid PK,
  garantia varchar,
  tipo varchar,
  subtipo varchar,
  descripcion text,
  ubicacion varchar,
  valor_nominal numeric,
  fecha_registro date,
  cliente_id uuid,
  data jsonb
)
1. Objetivo institucional del Subtab Garantías en Clientes
El subtab Garantías dentro del módulo Clientes debe cumplir con:

Mostrar todas las garantías asociadas al cliente actual  
(filtradas por cliente_id = <ID_CLIENTE>)

Permitir asociar una garantía existente al cliente, mediante un modal de selección.

No crear garantías desde Clientes.
Las garantías solo se crean en el módulo Garantías.

Toda garantía creada en el módulo Garantías debe aparecer disponible en el modal del subtab Garantías dentro de Clientes.

La asociación se realiza actualizando el campo cliente_id en la tabla J_GARANTIAS.

2. Comportamiento al entrar al Subtab Garantías en Clientes
Cuando el usuario abra:

Clientes → Ver / Editar → Subtab Garantías

el sistema debe ejecutar:

2.1 Consulta institucional
sql
SELECT 
    uuid,
    garantia,
    tipo,
    subtipo,
    descripcion,
    ubicacion,
    valor_nominal,
    fecha_registro,
    cliente_id,
    data
FROM "EFINANCIANET_DB"."J_GARANTIAS"
WHERE cliente_id = <ID_CLIENTE>;
2.2 Mostrar en la tabla del subtab:
Garantía (garantia)

Tipo (tipo)

Subtipo (subtipo)

Valor nominal (valor_nominal)

Fecha registro (fecha_registro)

Ubicación (ubicacion)

Acciones (Ver / Editar)

3. Botón “Nuevo” dentro del Subtab Garantías (en Clientes)
Cuando el usuario presione Nuevo dentro del subtab Garantías:

3.1 NO se debe crear una garantía nueva aquí
El subtab NO crea garantías.

3.2 Debe abrirse un modal con el listado de TODAS las garantías existentes
Consulta:

sql
SELECT 
    uuid,
    garantia,
    tipo,
    subtipo,
    descripcion,
    ubicacion,
    valor_nominal,
    fecha_registro,
    cliente_id,
    data
FROM "EFINANCIANET_DB"."J_GARANTIAS";
3.3 El modal debe permitir:
Buscar

Filtrar por tipo / subtipo

Ver detalles básicos

Seleccionar una garantía

3.4 Al seleccionar una garantía, se debe asociar al cliente actual
Actualizar:

sql
UPDATE "EFINANCIANET_DB"."J_GARANTIAS"
SET cliente_id = <ID_CLIENTE>
WHERE uuid = <UUID_GARANTIA>;
3.5 La garantía debe aparecer inmediatamente en el subtab
4. Flujo institucional entre módulos
4.1 Módulo Garantías
El usuario crea nuevas garantías desde:

Garantías → Nuevo

Al guardar, se inserta en:

Código
"EFINANCIANET_DB"."J_GARANTIAS"
con:

uuid (PK)

garantia

tipo

subtipo

descripcion

ubicacion

valor_nominal

fecha_registro

cliente_id (puede ser NULL o default UUID)

data (JSON institucional)

4.2 Módulo Clientes → Subtab Garantías
Cuando el usuario presione Nuevo, el modal debe mostrar:

Todas las garantías existentes

Incluyendo las recién creadas

Incluso si cliente_id está vacío o tiene un UUID no asociado

El usuario selecciona una garantía → se asocia al cliente.

5. Reglas institucionales obligatorias
No crear garantías desde Clientes.

No eliminar campos del JSON data.

No reconstruir el JSON desde cero.

No mezclar lógica con otros módulos.

No duplicar garantías.

No permitir guardar sin cliente_id al asociar.

Mantener la relación:

J_GARANTIAS.cliente_id → J_CLIENTES.id

Mantener consistencia institucional en todos los subtabs.

6. JSON institucional recomendado para data
json
{
  "documentos": [],
  "avaluo": {
    "valorComercial": 0,
    "fechaAvaluo": ""
  },
  "observaciones": "",
  "metadata": {
    "creadoPor": "",
    "fechaCreacion": "",
    "ultimaActualizacion": ""
  }
}
(Puedes ampliarlo según tus reglas de negocio.)

7. Resultado final del comportamiento
✔ En Garantías → Nuevo
Creas una garantía nueva.

✔ En Clientes → Garantías → Nuevo
Aparece un modal con TODAS las garantías existentes.
Seleccionas una.
Se asocia al cliente.
Aparece en el subtab.

✔ En Clientes → Garantías
Siempre se muestran solo las garantías del cliente actual.