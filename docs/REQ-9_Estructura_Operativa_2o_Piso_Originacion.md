# HU — REQ-9: Subtab "Estructura Operativa de 2o Piso" en Solicitud / Originación

> **Origen:** continuación del BPM del producto *Garantía Financiera 2o Piso* —
> **Etapa 1, Actividad 4: "Admisión y Captura del Ecosistema"**, capturado el 27/08/2026.
> Es la continuación natural de [REQ-8](REQ-8_Garantia_Financiera_2o_Piso.md), que cubrió
> la **parametrización del producto**. Esta HU cubre la **captura operativa en el LOS**:
> un acordeón nuevo dentro del formulario de Solicitud / Originación.
> Traducido a alcance técnico contra el código real de
> **`src/app/components/solicitudes/SolicitudCreditoForm.tsx`**.

---

## Requerimiento original (transcripción, para trazabilidad)

**Objetivo de la actividad:** recibir la inyección de datos del CRM, validar la
consistencia financiera de la oferta comercial y dar de alta formalmente el expediente
técnico-operativo de la GPO.

**Descripción de negocio:** el analista de riesgos en el LOS recibe una notificación en su
bandeja. Abre la solicitud y procede a "vestir" el proyecto comercial con los componentes
obligatorios de Segundo Piso: el **Fiduciario** (banco del fideicomiso) y el
**Representante Común** de los tenedores de bonos.

### Bloque A — Datos heredados del CRM (solo lectura)

| Campo | Ejemplo |
|---|---|
| Folio Solicitud LOS | `LOS-GPO-2026-0045` (autogenerado) |
| Folio de Origen CRM | `CRM-GPO-2026-089` |
| Acreditado Final / Emisor | Red de Carreteras de Occidente S.A.B. de C.V. |
| Monto de Emisión Proyectado | $2,000,000,000.00 MXN |
| Porcentaje de Cobertura GPO | 20.00% |
| Monto Máximo Contingente (Exposición) | $400,000,000.00 MXN — *Emisión × Cobertura* |

### Bloque B — Estructura Operativa de 2o Piso (acordeón NUEVO, captura obligatoria)

| Campo | Control | Regla |
|---|---|---|
| Institución Fiduciaria | Modal buscador de clientes | Tipo de relación **"Fiduciario"**. Se jala de *Partes Relacionadas* del cliente **Emisor** |
| Número de Fideicomiso de Fuente de Pago | Input de texto | Ej. `F/482910` |
| Representante Común de Tenedores | Modal buscador de clientes | Tipo de relación **"Beneficiario Legal"**. Se jala de *Partes Relacionadas* del Emisor |
| Notas | Textarea | Campo libre |

**Botón de avance:** *[Validar Ecosistema y Crear Expediente de Riesgo]* — **ya existe**,
es el "Enviar de Fase" actual.

---

## Contexto técnico (verificado en código, NO re-investigar)

### Cómo se pintan los acordeones

Los subtabs de la Solicitud son un array declarativo en
[SolicitudCreditoForm.tsx:2754-2774](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L2754-L2774):

```ts
const sections = [
  { id: 'default',            label: 'Default' },
  { id: 'terminos',           label: 'Términos y Condiciones' },
  { id: 'simulacion',         label: isLineaCreditoForm ? 'Cotización' : 'Simulación' },
  { id: 'expediente',         label: 'Expediente Electrónico' },
  { id: 'partesRelacionadas', label: 'Partes Relacionadas' },
  ...
];
```

Se renderizan con `sections.map(...)` y el contenido de cada uno cuelga de
`{activeSection === sec.id && ( ... {sec.id === 'xxx' && <Componente/>} ... )}`.

> **Consecuencia crítica:** **solo un acordeón existe en el DOM a la vez.** Abrir otro
> **desmonta** el actual. Todo estado del subtab nuevo debe persistirse fuera de React o
> se pierde al cambiar de acordeón.

El array admite entradas condicionales — ya se usa el patrón:

```ts
...(esArrendamientoPuro ? [{ id: 'facturas', label: 'Facturas' }] : []),
```

### Persistencia — la regla de los dos extremos

Un subtab solo sobrevive si se mapea en **escritura y lectura**:

1. **Sesión (WIP):** `saveToSession(storageId, '<clave>', data)` desde
   [solicitudCreditoStore.ts](../src/app/components/solicitudes/solicitudCreditoStore.ts).
2. **Cosecha al guardar:** la clave debe estar en el array `subtabKeys` — que aparece
   **DOS veces**: [L1402](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1402)
   y [L2688](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L2688).
   **Si se agrega en una sola, se pierde en el otro camino.**
3. **Escritura a BD:** en `formToDBPayload` de
   [useSolicitudesDB.ts](../src/app/hooks/useSolicitudesDB.ts) — nodo
   `data.solicitud.*`, con *deep merge* contra `_originalData`.
4. **Rehidratación:** en `preloadSubtabsFromDBData` de
   [SolicitudCreditoList.tsx](../src/app/components/solicitudes/SolicitudCreditoList.tsx)
   — que también aparece **en dos bloques** (≈L154 y ≈L688).

### Dónde ya viven los datos del Bloque A

Los campos GPO se heredan de la Oportunidad y **ya se persisten** en
`terminos_condiciones._raw` (ver REQ-8 y `formToDBPayload`):

| Campo del requerimiento | Origen en código | ¿Existe? |
|---|---|---|
| Monto de Emisión Proyectado | `terminos.montoEmisionProyectado` | **Sí** |
| Porcentaje de Cobertura GPO | `terminos.porcentajeCoberturaGpo` | **Sí** |
| Monto Máximo Contingente | `terminos.montoGarantizadoGpo` | **Sí** — ya calculado en la Oportunidad |
| Acreditado Final / Emisor | `formData.nombrePersona` / `denominacionRazonSocial` | **Sí** |
| Folio Solicitud LOS | `formData.noSol` | **Sí** — autogenerado (`fetchNextNoSol`) |
| Folio de Origen CRM | `no_referenc1` → `formData.cotizacionId` | **Sí** — es el folio de la Oportunidad |

> **El Bloque A no requiere campos nuevos ni cálculos nuevos.** Es una vista de solo
> lectura sobre datos que ya existen. El "Monto Máximo Contingente" **no debe
> recalcularse aquí**: la Oportunidad ya lo fija con el tope de 50 % (RN-01 de REQ-8).

### Componentes reutilizables ya disponibles

| Necesidad | Componente existente |
|---|---|
| Modal buscador de clientes | [`SeleccionarClienteModal`](../src/app/components/solicitudes/SeleccionarClienteModal.tsx) — props `{ isOpen, onClose, onSelect(cliente) }` |
| Subtab de partes relacionadas | [`PartesRelacionadasTab`](../src/app/components/solicitudes/PartesRelacionadasTab.tsx) |
| Detección del producto GPO | Patrón `esGPO` de [TerminosCondicionesTab.tsx:1026](../src/app/components/solicitudes/TerminosCondicionesTab.tsx#L1026) |

### El catálogo de tipos de relación NO tiene los valores que pide el requerimiento

[PartesRelacionadasTab.tsx:40-46](../src/app/components/solicitudes/PartesRelacionadasTab.tsx#L40-L46):

```ts
const CAT_TIPOS_RELACION = [
  { value: 'Relación legal',      label: 'Relación legal' },
  { value: 'Beneficiario',        label: 'Beneficiario' },
  { value: 'Aval',                label: 'Aval' },
  { value: 'Obligado solidario',  label: 'Obligado solidario' },
  { value: 'Representante legal', label: 'Representante legal' },
];
```

**No existen "Fiduciario" ni "Beneficiario Legal".** Sin extender este catálogo, el
requerimiento de "jalar de Partes Relacionadas filtrando por tipo de relación" **no tiene
de dónde jalar**.

---

## Objetivo

Que el analista de riesgos complete, dentro de la Solicitud del LOS, la estructura
operativa de Segundo Piso — Fiduciario, número de fideicomiso y Representante Común —
sobre una vista que le muestre sin ambigüedad los datos financieros heredados del CRM, y
que esa captura quede persistida y disponible para las fases posteriores.

---

## Alcance

### 1. Catálogo de tipos de relación — EXTENDER

Agregar a `CAT_TIPOS_RELACION`:

- `Fiduciario`
- `Beneficiario Legal`

> Es **ampliación**, no restricción: no rompe partes ya capturadas.
> `PartesRelacionadasTab` es compartido — verificar que ningún otro módulo dependa del
> largo exacto del catálogo.

### 2. Subtab "Estructura Operativa de 2o Piso" — NUEVO

**Id de sección:** `estructura2oPiso` · **Label:** `Estructura Operativa de 2o Piso`

**Visibilidad condicional.** Solo cuando el producto sea Garantía Financiera 2o Piso.
Usar el patrón `esGPO` ya probado (nombre del producto **o** presencia de los datos GPO
heredados), **no** solo el nombre: la Solicitud que genera el Cierre Comercial guarda
`tipo_producto = "Simple"` y `linea_producto = "Línea de Crédito"` — ninguno contiene
"garantía".

**Posición sugerida:** inmediatamente después de `terminos`, antes de `simulacion` — el
analista lo llena antes de cotizar.

#### Bloque A — solo lectura

Seis campos deshabilitados leídos de `formData` y de `terminos` (tabla de contexto
técnico). Formato de moneda con separadores de miles.

#### Bloque B — captura

| Campo | Clave sugerida | Control | Obligatorio |
|---|---|---|---|
| Institución Fiduciaria | `institucionFiduciaria` (+ `institucionFiduciariaId`) | Modal buscador | Sí |
| Número de Fideicomiso | `numeroFideicomisoFuentePago` | Input texto | Sí |
| Representante Común | `representanteComun` (+ `representanteComunId`) | Modal buscador | Sí |
| Notas | `notasEstructura2oPiso` | Textarea | No |

**Comportamiento de los dos modales:**

1. Al abrir, **precargar** las partes relacionadas del cliente Emisor filtradas por tipo
   de relación (`Fiduciario` / `Beneficiario Legal`) — es el "jalar de Partes
   Relacionadas" del requerimiento.
2. Si no hay ninguna con ese tipo, permitir buscar en el catálogo general de clientes vía
   `SeleccionarClienteModal`.
3. Al seleccionar, guardar **id y nombre**. El id es lo que permite trazar; el nombre es
   para que la vista no dependa de una consulta.

### 3. Persistencia end-to-end

Clave de subtab: `estructura2oPiso`.

- `saveToSession(storageId, 'estructura2oPiso', datos)` en cada cambio.
- Agregar `'estructura2oPiso'` a `subtabKeys` **en las dos ocurrencias** (L1402 y L2688).
- Escribir en `formToDBPayload` bajo `data.solicitud.estructura_2o_piso`.
- Rehidratar en `preloadSubtabsFromDBData` **en sus dos bloques**.

> **Guarda obligatoria contra pérdida de datos.** No persistir un objeto vacío que el
> montaje actual no produjo. Es exactamente el fallo que borró documentos del expediente:
> el efecto de guardado corría en el primer render con el estado vacío inicial y
> sobrescribía la BD. Ver la guarda `persistenciaSegura` en
> [ExpedienteElectronicoTab.tsx](../src/app/components/solicitudes/ExpedienteElectronicoTab.tsx).

### 4. Validación al avanzar de fase

El botón *[Validar Ecosistema y Crear Expediente de Riesgo]* **es el "Enviar de Fase" que
ya existe** — no se crea un botón nuevo.

Agregar a la validación de avance, **solo cuando la fase destino sale de "Admisión y
Captura del Ecosistema"** y el producto es GPO: bloquear si falta Institución Fiduciaria,
Número de Fideicomiso o Representante Común.

El aviso debe **nombrar los campos faltantes**, siguiendo el patrón ya aplicado en
`validate()` y en el bloqueo por documentos: un mensaje con solo el conteo obliga al
usuario a adivinar.

---

## Criterios de aceptación

1. **CA-01** — Con producto GPO, el acordeón "Estructura Operativa de 2o Piso" aparece en
   la Solicitud. Con cualquier otro producto, **no** aparece.
2. **CA-02** — El Bloque A muestra los seis campos heredados, en solo lectura, con los
   valores que la Oportunidad fijó. El Monto Máximo Contingente coincide con
   `montoGarantizadoGpo` y **no se recalcula**.
3. **CA-03** — El modal de Institución Fiduciaria lista primero las partes relacionadas
   del Emisor con tipo `Fiduciario`.
4. **CA-04** — El modal de Representante Común lista primero las partes relacionadas del
   Emisor con tipo `Beneficiario Legal`.
5. **CA-05** — El catálogo de tipos de relación ofrece `Fiduciario` y `Beneficiario Legal`.
6. **CA-06** — Capturar los tres campos, cambiar a otro acordeón y volver: **los valores
   siguen ahí** (sobrevive al desmontaje).
7. **CA-07** — Guardar, recargar la app y reabrir la Solicitud: los valores **siguen en
   base de datos**.
8. **CA-08** — Abrir la Solicitud y cambiar de acordeón **sin capturar nada** no borra una
   estructura previamente guardada.
9. **CA-09** — Con algún campo obligatorio vacío, "Enviar de Fase" se bloquea y el aviso
   **nombra** los campos faltantes.
10. **CA-10** — Las Notas aceptan texto multilínea y persisten igual que el resto.

---

## Fuera de alcance (y por qué)

| Tema | Motivo |
|---|---|
| Crear el expediente de riesgo | El nombre del botón lo sugiere, pero el requerimiento no define qué estructura genera. Requiere HU propia |
| Alta de clientes desde el modal | El buscador **selecciona**; dar de alta es del módulo Clientes |
| Notificación en bandeja del analista | Mencionada en la descripción de negocio; no hay módulo de bandeja definido |
| Validar consistencia financiera de la oferta | La Oportunidad ya aplica el tope de cobertura (RN-01, REQ-8). Duplicarlo aquí crearía dos fuentes de verdad |
| Renombrar el botón a "Validar Ecosistema…" | `FaseActionsComponent` es **compartido** por todos los productos; renombrarlo afecta a Crédito y Arrendamiento |

---

## Advertencias

### BLOQUEANTE CONFIRMADO — Partes Relacionadas no persiste a BD

La dependencia central del Bloque B ("jalar de Partes Relacionadas del Emisor") **está
rota hoy**. Verificado en código, no es una sospecha:

`storageKey` construye la clave así
([solicitudCreditoStore.ts:296-298](../src/app/components/solicitudes/solicitudCreditoStore.ts#L296-L298)):

```ts
function storageKey(solId: SolId, subtab: string): string {
  return `sol_credito_${solId}_${subtab}`;
}
```

| Quién | Llamada | Clave resultante |
|---|---|---|
| `PartesRelacionadasTab` **escribe** | `saveToSession('partes_'+solicitudId, 'partes', …)` ([L64, L94](../src/app/components/solicitudes/PartesRelacionadasTab.tsx#L64)) | `sol_credito_partes_<id>_partes` |
| `SolicitudCreditoForm` **cosecha** | `loadFromSession(storageId, 'partesRelacionadas')` ([L1402](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1402)) | `sol_credito_<id>_partesRelacionadas` |

**Las dos claves nunca coinciden.** Además, el formulario **no** le pasa
`personasRelacionadasIniciales` al subtab, así que tampoco hay una vía alterna de
hidratación. Consecuencia: `_allSubtabs.partesRelacionadas` llega vacío y
`partes_relacionadas` — que `formToDBPayload` sí sabe escribir
([useSolicitudesDB.ts:316, 553](../src/app/hooks/useSolicitudesDB.ts#L316)) — nunca recibe
lo capturado en ese subtab.

> **Paso 0 obligatorio.** Corregir esta discrepancia **antes** de construir el Bloque B.
> Sin esto, los modales no tendrán de dónde precargar y la HU se entrega a medias.
> Es un defecto preexistente, independiente de esta HU; conviene levantarlo como ticket
> propio para no mezclar su corrección con el alcance de aquí.

### Otras

- **Un solo acordeón montado a la vez** — cualquier estado no persistido se pierde al
  cambiar de subtab.
- **`subtabKeys` está duplicado** en el archivo. Agregar la clave en ambas ocurrencias.
- **`preloadSubtabsFromDBData` tiene dos bloques** de rehidratación. Mismo cuidado.
- **`PartesRelacionadasTab` es compartido**: extender su catálogo afecta a todos los
  productos que lo usan.
- El campo `Notas` de este acordeón **no es** el subtab `notas` que ya existe en
  `sections`. Usar una clave distinta para no colisionar.

---

## Orden de ejecución

0. **Corregir** la discrepancia de claves de Partes Relacionadas (defecto confirmado,
   ver Advertencias) — el Bloque B depende de ella.
1. Extender `CAT_TIPOS_RELACION` con `Fiduciario` y `Beneficiario Legal`.
2. Crear el componente del subtab con Bloque A (solo lectura) y Bloque B (captura), con la
   guarda de persistencia segura.
3. Registrar la sección en `sections` con visibilidad condicional por GPO y cablear su
   rama de render.
4. Cerrar la persistencia: sesión → `subtabKeys` (×2) → `formToDBPayload` →
   `preloadSubtabsFromDBData` (×2).
5. Conectar los dos modales con precarga desde Partes Relacionadas del Emisor.
6. Agregar la validación de avance de fase con mensaje que nombre los campos.
7. Probar los CA-06 a CA-08 **corriendo la app**: son los que detectan pérdida de datos, y
   no se ven en un typecheck.
