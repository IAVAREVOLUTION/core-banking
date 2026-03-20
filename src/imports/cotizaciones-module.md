1. Crear el módulo “Cotizaciones”
El módulo debe colocarse después de Clientes y seguir exactamente el estándar institucional:

Vista de lista

Botón “Nuevo”

Formulario principal

Subvista “Default”

Subtabs

Persistencia en J_COTIZACIONES

Uso de data (jsonb) para toda la información dinámica

2. Estructura real de la tabla (obligatorio para el desarrollador)
sql
create table EFINANCIANET_DB."J_COTIZACIONES" (
  id uuid not null default gen_random_uuid (),
  no_cotiza character varying(30) not null,
  descripcion character varying(255) null,
  producto_id uuid null,
  cliente_id uuid null,
  fecha_cotiza timestamp without time zone null default now(),
  estatus_cotiza EFINANCIANET_DB.estatus_cotizacion not null default 'Pendiente',
  data jsonb null,
  linea_cotizacion character varying null,
  constraint j_cotizaciones_pkey primary key (id)
);
Reglas institucionales derivadas de tu tabla:
no_cotiza = número de cotización → debe generarse automáticamente (UUID corto, timestamp o secuencia).

producto_id → debe llenarse cuando el usuario seleccione un producto.

cliente_id → debe llenarse cuando el usuario seleccione un prospecto/cliente.

estatus_cotiza → default “Pendiente”.

data (jsonb) → aquí va TODA la información del formulario, pick‑maps, cálculos y calendario.

linea_cotizacion → debe llenarse con “Captación”, “Crédito” o “Línea Crédito”.

3. Subcategorías del módulo
El módulo debe incluir:

Captación

Crédito

Línea de Crédito

La primera a implementar es Captación.

4. Vista de Lista — Subcategoría “Captación”
Debe mostrar:

No. Cotización (no_cotiza)

Fecha y Hora (fecha_cotiza)

Usuario (desde data.usuario)

Producto (data.producto.nombreProducto)

Monto Cotizado (data.montoCotizado)

Tasa Min Interés (data.tasaInicial)

Interés Generado (data.interesesGenerados)

Periodo (data.periodo)

Plazo Cumplir Monto (data.plazo)

Estatus (estatus_cotiza)

5. Botón “Nuevo” — Formulario principal
5.1 Campos obligatorios
ID Cotización → no_cotiza (automático)

Línea de Producto → “Captación” (solo lectura)

Prospecto/Cliente

Modal con TODOS los registros de J_CLIENTES

Pick‑map:

cliente_id (campo físico)

data.claveCliente

data.nombreCompleto

En el portal no se muestra, pero al enviar se guarda el ID del cliente firmado.

Institución Gobierno

Search specification:

clasificacionCliente = "Gobierno Magisterio"

Se guarda en:

data.institucionGobierno

Producto

Debe listar productos desde J_PRODUCTOS

Search specification:

Coincidir con la Institución Gobierno seleccionada

Coincidir con la subvista “Convenios”

lineaProducto = "Captación"

Al seleccionar un producto, llenar:

producto_id (campo físico)

data.producto.* (pick‑map completo)

6. Pick‑map del Producto (Ahorro / Aportación)
Cuando el producto sea tipo Ahorro o Aportación, llenar:

data.claveProducto

data.tipoProducto

data.tasaInicial (solo lectura)

data.montoCotizado

Validación: >= montoMinimo

data.periodoCumplirMontoMinimo (solo lectura)

data.plazo

Validación:

plazo > 0

plazo <= plazoCumplirMontoMinimo

7. Cálculo automático de Intereses Generados
Intereses Generados
=
Monto Cotizado
⋅
(
Tasa Inicial
360
)
⋅
Frecuencia
Frecuencias:

Mensual = 30

Quincenal = 15

Catorcenal = 14

Semanal = 7

Diario = 1

Trimestral = 90

Guardar en:

data.interesesGenerados

8. Campo “Fecha Primera Aportación”
Guardar en:

data.fechaPrimeraAportacion

En el portal aparece antes del último paso.

9. Subtab “Default”
Debe mostrar:

Datos generales

Pick‑maps

Cálculos

Estatus

10. Subtab “Calendario de Aportaciones”
10.1 Condición
Generar calendario solo si:

plazo
>
0
10.2 Reglas
Número de aportaciones = plazo

Fecha inicial = fechaPrimeraAportacion

Periodo = según producto

Monto por aportación =

montoCotizado
plazo
10.3 Guardar en BD
El calendario debe guardarse en:

Código
data.calendarioAportaciones[]
Cada registro:

json
{
  "noAportacion": 1,
  "fecha": "2026-04-01",
  "monto": 6250,
  "moneda": "MXN"
}
11. Persistencia en BD (obligatorio)
11.1 Campos físicos
no_cotiza

producto_id

cliente_id

fecha_cotiza

estatus_cotiza

linea_cotizacion

11.2 JSONB
Todo lo demás debe ir en:

Código
data (jsonb)
Ejemplo institucional:

json
{
  "usuario": "admin",
  "institucionGobierno": "...",
  "producto": { ... },
  "montoCotizado": 36000,
  "tasaInicial": 0.12,
  "interesesGenerados": 450,
  "periodo": "Semanal",
  "plazo": 16,
  "fechaPrimeraAportacion": "2026-04-01",
  "calendarioAportaciones": [ ... ]
}
12. Resultado esperado
El módulo Cotizaciones funcionará igual que el resto del sistema.

Captación quedará completamente operativa.

El pick‑map de clientes y productos funcionará sin errores.

El calendario se generará automáticamente.

La persistencia será consistente con tu tabla real.

El módulo quedará listo para extenderse a Crédito y Línea de Crédito.