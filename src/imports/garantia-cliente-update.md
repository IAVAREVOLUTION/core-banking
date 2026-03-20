Objetivo

Modificar el formulario de alta de Garantía del módulo Garantías para agregar la asociación con un Cliente y asegurar el correcto mapeo hacia la tabla J_GARANTIAS.

🧩 Nueva funcionalidad: Campo Cliente

Agregar un nuevo campo llamado “Cliente” en el formulario de alta de Garantía.

Este campo debe:

Abrir un pop-up/modal de selección al hacer clic.

Cargar dinámicamente el listado de clientes desde la tabla J_CLIENTES (fetch).

Mostrar al usuario una lista seleccionable de clientes (por nombre).

Permitir seleccionar un solo cliente.

Comportamiento:

En la UI se debe mostrar el nombre del cliente seleccionado.

En base de datos se debe guardar únicamente el uuid del cliente (cliente_id).

🗄️ Estructura de la tabla destino: J_GARANTIAS
uuid             - uuid (PK)
garantia         - varchar
tipo             - varchar
subtipo          - varchar
descripcion      - text
ubicacion        - varchar
valor_nominal    - numeric
fecha_registro   - date
cliente_id       - uuid (FK → J_CLIENTES.uuid)
data             - json
💾 Lógica de guardado (INSERT)

Al guardar el formulario:

Mapear los campos principales del formulario directamente a columnas de la tabla:

garantia       → garantia
tipo           → tipo
subtipo        → subtipo
descripcion    → descripcion
ubicacion      → ubicacion
valor_nominal  → valor_nominal
fecha_registro → fecha_registro
cliente (UI)   → cliente_id (uuid)

Todos los campos adicionales del formulario deben almacenarse dentro del campo data (JSON).