# Guía de Usuario — Creación de un Crédito

## ¿Qué es una solicitud de crédito?

Cuando un cliente solicita un crédito, el sistema registra una **solicitud** que contiene toda la información del trámite: datos del cliente, montos, plazos, documentos y autorizaciones. Esta solicitud avanza por etapas hasta convertirse en un crédito activo.

---

## Paso 1 — Acceder al módulo

1. En el menú principal, selecciona **Cartera de Crédito**.
2. Haz clic en **Nuevo** para iniciar una solicitud en blanco.

---

## Paso 2 — Datos generales

Esta es la primera pantalla que verás. Debes completar la información básica del crédito:

| Campo | Qué capturar |
|-------|-------------|
| **Cliente** | Busca y selecciona al cliente que solicita el crédito. |
| **Fecha de crédito** | La fecha en que se registra la solicitud. |
| **Empresa fondeadora** | Institución que fondea el crédito (si aplica). |
| **Sucursal** | Sucursal que atiende la solicitud. |
| **Monto solicitado** | Cantidad que el cliente solicita. |
| **Sublínea** | Categoría del crédito (ej. Personal, Hipotecario, Automotriz). |
| **Producto** | Producto específico conforme al catálogo. |
| **Periodo** | Frecuencia de pago (mensual, quincenal, etc.). |
| **Plazos** | Número de pagos acordados. |
| **Fecha inicio** | Cuándo comienza a correr el crédito. |
| **Destino del crédito** | Descripción del uso que el cliente dará al dinero. |

> Los campos marcados con asterisco rojo (\*) son obligatorios. El número de crédito se genera automáticamente.

---

## Paso 3 — Secciones del formulario

El formulario tiene varias pestañas. No es necesario completarlas todas en el primer guardado, pero sí antes de formalizar el crédito.

### Montos y Plazos
Aquí se definen los términos financieros: monto autorizado, plazo, periodo y la tabla de amortización que indica cuánto pagará el cliente en cada fecha.

### Tasas
Se captura la tasa de interés ordinaria, la tasa moratoria (aplica en caso de atraso) y el CAT (Costo Anual Total).

### Amortizaciones
Muestra el calendario de pagos generado automáticamente con base en los montos, plazos y tasas ingresados.

### Expedientes Electrónicos
Lista de documentos requeridos para el trámite (identificación, comprobante de ingresos, etc.). Aquí se registra cuáles ya fueron recibidos y cuáles están pendientes.

### Autorización
Registro de quién aprobó el crédito, en qué fecha y con qué comentarios. Puede haber uno o varios niveles de autorización según las políticas de la institución.

### Garantías
Si el crédito requiere garantía (bien inmueble, prenda, aval), se captura aquí el tipo de garantía, su valor y el porcentaje de aforo.

### Cargos
Comisiones y cargos adicionales que aplican al producto (comisión por apertura, seguro, etc.).

### Avisos
Alertas o notas relacionadas con el crédito o el cliente.

### Solicitudes Extraordinarias
Para registrar reestructuras, quitas, ampliaciones de plazo u otros trámites especiales una vez que el crédito ya está activo.

---

## Paso 4 — Guardar la solicitud

Una vez capturados los datos generales, haz clic en **Guardar**. El sistema registrará la solicitud en estatus **Pendiente** y le asignará un número de solicitud único (ej. `BAN-DIGITAL-20250601-143022`).

Puedes guardar en cualquier momento y regresar después para completar la información.

---

## Paso 5 — Proceso de aprobación (7 etapas)

Después de guardar, la solicitud entra a un proceso de revisión y aprobación que consta de **7 etapas**. Cada etapa debe completarse en orden.

```
Etapa 1   Recepción de Documentos
   │      El expediente físico o digital es recibido y registrado.
   ↓
Etapa 2   Análisis de Crédito
   │      El área de crédito revisa la capacidad de pago del cliente.
   ↓
Etapa 3   Comité de Crédito
   │      El comité vota y decide si aprueba, condiciona o rechaza.
   ↓
Etapa 4   Formalización
   │      Se firma el contrato de crédito con el cliente.
   │      A partir de aquí, los montos ya no pueden modificarse.
   ↓
Etapa 5   Desembolso
   │      Se entrega el dinero al cliente y se registra el monto dispuesto.
   ↓
Etapa 6   Registro Contable
   │      El sistema crea automáticamente la cuenta contable correspondiente
   │      (cuenta por cobrar o cuenta por pagar según el tipo de crédito).
   ↓
Etapa 7   Activación de Cuenta
           Se genera el número de cuenta definitivo y el crédito queda activo
           en cartera. El cliente puede comenzar a realizar sus pagos.
```

Para avanzar entre etapas, usa el botón **Avanzar Fase** que aparece en la parte superior del formulario. Si necesitas regresar, usa **Regresar Fase** (solo disponible antes de la formalización).

---

## Estatus posibles de una solicitud

| Estatus | Significado |
|---------|-------------|
| **Pendiente** | Recién creada, en espera de revisión. |
| **En análisis** | El área de crédito está evaluando la solicitud. |
| **Autorizada** | El comité aprobó el crédito. |
| **Formalizada** | El contrato fue firmado por el cliente. |
| **Rechazada** | La solicitud fue denegada. |
| **Activa** | El crédito fue desembolsado y está en cartera. |
| **Cancelada** | La solicitud fue cancelada antes de formalizarse. |

---

## Preguntas frecuentes

**¿Puedo guardar la solicitud sin tener todos los datos?**
Sí. Solo los campos marcados con asterisco son obligatorios para guardar. El resto puede completarse antes de avanzar a la siguiente etapa.

**¿Qué pasa si me equivoqué en el monto?**
Puedes corregirlo en cualquier momento antes de llegar a la **Etapa 4 — Formalización**. Una vez firmado el contrato, el monto queda bloqueado.

**¿Dónde veo el número de cuenta del cliente?**
El número de cuenta se genera automáticamente al completar la **Etapa 7 — Activación**. Antes de ese momento no existe aún.

**¿Puedo crear un crédito sin que el cliente exista en el sistema?**
No. El cliente debe estar registrado previamente en el módulo de **Clientes** o **Prospectos** antes de crear una solicitud de crédito.

**¿Qué es la cuenta eje?**
Es una cuenta de registro principal que el sistema crea automáticamente la primera vez que un cliente obtiene un crédito activo. Agrupa sus productos financieros en la institución.

**¿Quién puede autorizar un crédito?**
Depende de las políticas de tu institución. El sistema permite registrar uno o varios niveles de autorización, cada uno con su usuario, fecha y comentarios.
