Quiero que realices un diagnóstico completo del endpoint que alimenta el submódulo:

Clientes → Lista de Clientes

y verifiques lo siguiente:

1. Verificar la tabla REAL que se está consultando
Debes confirmar si el endpoint está consultando:

EFINANCIANET_DB."J_CLIENTES"  ✔ (correcto)
o

EFINANCIANET_DB."J_PROSPECTOS" ❌ (incorrecto)
o

una vista o repositorio compartido ❌
o

un servicio que mezcla ambos ❌

Debes mostrar la consulta SQL real que se está ejecutando.

2. Verificar si existe un filtro oculto por TYPE
Debes revisar si el endpoint está aplicando filtros como:

Código
WHERE type IN ('Prospecto', 'Contacto')
o

Código
WHERE type != 'Cliente'
o

Código
WHERE type IS NOT NULL
o

Código
WHERE subtipo = 'Prospecto'
o si está usando un filtro heredado del módulo Prospectos.

3. Verificar si el endpoint está usando el mismo repositorio que Prospectos
Debes revisar si:

Comparte el mismo servicio

Comparte el mismo método

Comparte el mismo repositorio

Comparte la misma consulta

Comparte el mismo DTO

Comparte el mismo mapeo

Si es así → está mal.

4. Verificar si el endpoint está usando un fallback automático
Debes revisar si existe lógica como:

Código
if no results → fallback to Prospectos
o

Código
if type = null → assume Prospecto
o

Código
if table empty → use Prospectos endpoint
Esto explicaría por qué te muestra solo Prospectos.

5. Verificar si el endpoint está usando un cache viejo
Debes revisar si:

El endpoint está cacheado

El repositorio está cacheado

El servicio está cacheado

El frontend está cacheado

Si el cache contiene solo Prospectos → eso es lo que verás.

6. Verificar si la consulta está mal construida
Debes revisar si la consulta real es algo como:

Código
SELECT * FROM J_CLIENTES WHERE type = 'Prospecto'
o

Código
SELECT * FROM J_CLIENTES WHERE type != 'Cliente'
o

Código
SELECT * FROM J_CLIENTES WHERE type IS NOT NULL
o incluso:

Código
SELECT * FROM J_PROSPECTOS
7. Verificar si el endpoint está leyendo la tabla correcta
Debes confirmar:

Nombre de tabla

Esquema

Conexión

Base de datos

Permisos

Usuario

Si el endpoint está apuntando a otra base o esquema → no verás los clientes reales.

8. Verificar si la tabla J_CLIENTES realmente tiene registros
Debes ejecutar:

sql
SELECT COUNT(*) FROM EFINANCIANET_DB."J_CLIENTES";
y mostrar el resultado.

Si el resultado es 8, pero el endpoint muestra 6, entonces:

Está filtrando

Está usando otra tabla

Está usando un repositorio compartido

Está usando un endpoint de Prospectos

9. Verificar si el endpoint está usando un DTO de Prospectos
Debes revisar si el DTO contiene campos como:

idProspecto

estatusProspecto

listasNegras

sic

Si sí → está usando el DTO equivocado.

10. Entregable
Debes entregarme:

La consulta SQL real que está ejecutando el endpoint.

El repositorio o servicio que está usando.

El DTO que está usando.

El filtro real aplicado.

La razón exacta por la cual solo muestra Prospectos y Contactos.

La corrección necesaria para que muestre todos los registros de J_CLIENTES.