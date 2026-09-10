# HU — REQ-23: Pagaré de Crédito Simple 2° Piso, validación IA de sus datos y acotamiento por fase

> **Origen:** requerimiento capturado el 01/09/2026 sobre *Crédito Simple 2° Piso*
> (sublínea Créditos Personales), el producto de disposición de la línea GPO
> (REQ-20).
> Diagnosticado contra el código real y contra la configuración **real** del
> producto en Supabase (`19710b2d-a2f8-49b1-9959-085e853797a8`).

---

## Requerimiento original (transcripción, para trazabilidad)

> **Solicitud/Originación**
>
> 1. Generar el PDF del pagaré en el Producto: **Crédito Simple 2° Piso** de tipo
>    Créditos Personales. Ya existe la plantilla en el producto.
> 2. La IA debe de validar en el **PAGARÉ** el nombre del acreditado, el monto, y
>    la firma.
> 3. Revisar porque valida documentos del **arrendamiento financiero** con el
>    crédito simple. Se supone que se debe acotar únicamente a las fases, al
>    prompt IA que tiene cada producto en sus fases.

---

## Estado de implementación (01/09/2026)

**Aplicado — build limpio.** 24 aserciones ejecutadas, 0 fallas.

| Entregable | Dónde | CA |
|---|---|---|
| `importeALetra()` — cantidad en letra para títulos de crédito | [generarDocumentosFase4.ts](../src/app/hooks/generarDocumentosFase4.ts) | CA-05, RN-03 |
| `{{monto_letra}}` deja de imprimir dígitos | mismo | CA-05 |
| `acreedor_nombre`, `empresa_*`, `institucion_*` → razón social real | mismo | CA-04 |
| `jurisdiccion`, `lugar_pago`, `ciudad*` → plaza de la sucursal | mismo | CA-06 |
| `aval_nombre` → vacío en vez de `N/A` sobre la línea de firma | mismo | CA-07 |
| `validarContratosYPagares` exige sólo lo declarado por el producto | [useOriginacionValidaciones.ts](../src/app/hooks/useOriginacionValidaciones.ts) | CA-18, CA-19, CA-22 |
| Los dos llamadores pasan los requisitos de la fase en curso | [SolicitudCreditoForm.tsx](../src/app/components/solicitudes/SolicitudCreditoForm.tsx) | CA-17 |
| Respaldo de elementos obligatorios del pagaré (acreditado, monto, firma) | [ExpedienteElectronicoTab.tsx](../src/app/components/solicitudes/ExpedienteElectronicoTab.tsx) | CA-11…CA-15 |

**Verificado ejecutando el código real:**

- **Acotamiento por fase (7/7):** con la declaración real de *Crédito Simple 2° Piso* (sólo pagaré) la validación **pasa y ya no pide contrato**; un producto que sí declara contrato lo sigue exigiendo (CA-22); sin lista declarada se conserva el comportamiento previo; y lo que ya fallaba sigue fallando (pagaré rechazado o ausente).
- **Importe en letra (17/17):** `400,000,000 → CUATROCIENTOS MILLONES DE PESOS 00/100 M.N.`; con remanente no lleva “DE”; apócope correcto (`VEINTIÚN`, `TREINTA Y UN`); centavos, cero y `CIEN` exactos; USD/EUR soportados.

**Dos defectos gramaticales corregidos durante la verificación:** la primera
versión producía *“UN MILLÓN PESOS”* y *“VEINTIUNO PESOS”*. En un pagaré la
redacción de la cantidad forma parte del instrumento, no es un detalle de estilo.

### Generación del PDF — completada (01/09/2026)

`generarPagareDesdePlantilla()`
([generarDocumentosFase4.ts](../src/app/hooks/generarDocumentosFase4.ts)) genera
**sólo** el pagaré desde la plantilla del producto, y el botón **Generar Pagaré**
aparece en el Expediente cuando la fase en curso declara un requisito de pagaré y
el producto tiene su plantilla Activa
([ExpedienteElectronicoTab.tsx](../src/app/components/solicitudes/ExpedienteElectronicoTab.tsx)).

Va aparte de `autoCrearKitLegal` a propósito: aquél arma el kit del arrendamiento
(contrato + anexo de rentas + pagaré) y **aborta si no hay plantilla de
contrato** — la misma regla ajena que corrige HU-23.3, y la razón por la que este
producto nunca podía generar su documento.

Aplicada la §Decisión 3: botón explícito, no generación automática al entrar a la
fase, porque el pagaré necesita Monto y Plazo ya capturados.

**Verificado (9/9)** ejecutando la función real con dependencias de navegador
stubbeadas — se cubren todas las rutas que no renderizan PDF:

- CA-09: sin plantilla **no** cae a un PDF genérico; falla y dice qué falta;
- distingue “no hay plantilla” de “existe pero está **Inactiva**” de “Activa **sin archivo**”;
- con sólo plantilla de **contrato** disponible, no la usa: sigue pidiendo la de pagaré;
- CA-10: no duplica si el documento ya está en el expediente, y la comparación es normalizada (el requisito real del producto se llama `Pagaré Firmado` y su descripción trae espacios de más);
- un tipo de documento distinto no queda bloqueado por esa guarda.

### Segundo defecto del punto 3 — el cierre del proceso (01/09/2026)

Reportado al probar: en la última fase salía *“No se puede cerrar el proceso —
Falta la factura del proveedor. Genérela en la fase «Recepción del Activo y
Cierre»”*, una fase que **este producto no tiene**.

Misma causa raíz, otro punto del código: la rama de cierre exigía la factura de
compra del bien (`COMPRA_PROVEEDOR`), verificaba que estuviera pagada, dispersaba
y pasaba el contrato a *Cartera de Arrendamiento* — **para cualquier producto**
que llegara a su última fase. Crédito Simple 2° Piso no tiene bien ni proveedor,
así que quedaba atrapado sin salida.

**Resuelto igual que el resto (RN-01):** ese cierre se aplica sólo si el producto
**declara** la etapa de recepción del activo. Si no, se cierra de forma simple —
la solicitud pasa a `Autorizada` y el proceso termina.

**Verificado con las fases reales de los cuatro productos (4/4):**

| Producto | Última fase | Cierre |
|---|---|---|
| Crédito Simple 2° Piso | `Liberación` | **simple** — ya no se atora |
| Arrendamiento | `Liberación y Dispersión` | con factura de proveedor (**sin cambios**) |
| Crédito 7 fases | `Activación Cuenta Financiera` | sale antes por su propia rama (**no le afecta**) |
| Garantía Financiera 2º Piso | `ACTIVACIÓN DE LÍNEA 2o PISO` | simple |

### Pendiente de esta HU

- **CA-20/CA-21** (Buró por “ser la fase 2”, y prompt de fase) siguen atados al
  número de fase; se acotó la validación de contratos/pagarés, que es donde se
  manifestaba el defecto reportado.
- **Sin probar contra la app:** el render real del PDF (`htmlToPdfBlobUrl` usa
  html2canvas/jsPDF, que necesitan navegador), su subida a Storage y la
  validación IA del documento generado.

---

## Configuración real del producto (verificada, NO re-investigar)

| Elemento | Estado |
|---|---|
| **Fases** | 2 — `1 Formalización de Pagare` (INTEGRACIÓN) · `2 Liberación` (LIBERACIÓN) |
| **`promptIA` de las fases** | **vacío en ambas** (`""`) |
| **Requisitos** | 1 — `DOC-PAGARE-FIRMADO` (“Pagaré Firmado”), fase *Formalización de Pagare*, obligatorio |
| **`promptIA` del requisito** | Genérico: *“Analiza el documento… verifica que sea legible, que no presente signos de manipulación…”* — **no** pide acreditado, monto ni firma |
| **Plantilla** | `tipoPlantilla: 'pagare'`, “Pagaré firmado”, **Activo**, con `archivoData` (HTML completo) ✅ |

La plantilla ya trae los marcadores que hacen falta: `{{deudor_nombre}}`,
`{{deudor_rfc}}`, `{{deudor_domicilio}}`, `{{acreedor_nombre}}`,
`{{monto_letra}}`, `{{monto_numero}}`, `{{moneda}}`, `{{fecha_vencimiento}}`,
`{{lugar_pago}}`, `{{tasa_interes}}`, `{{tasa_moratoria}}`, `{{jurisdiccion}}`,
`{{aval_nombre}}` y el bloque de firmas SUSCRIPTOR / AVAL.

---

## Diagnóstico

### Punto 1 — la maquinaria existe; falta que corra para este producto

`sustituirPlaceholders()` + `htmlToPdfBlobUrl()`
([generarDocumentosFase4.ts:1476](../src/app/hooks/generarDocumentosFase4.ts#L1476),
[:1693](../src/app/hooks/generarDocumentosFase4.ts#L1693)) ya renderizan una
plantilla del producto a PDF, y `autoCrearKitLegal` ya lo hace para contrato y
pagaré ([:1269](../src/app/hooks/generarDocumentosFase4.ts#L1269)).

**Dos obstáculos concretos:**

1. **El Kit Legal exige plantilla de contrato.** `validarPlantillasRequeridas`
   ([:154](../src/app/hooks/generarDocumentosFase4.ts#L154)) valida contrato **y**
   pagaré, y `autoCrearKitLegal` hace
   `plantillas.find(p => p.tipoPlantilla === 'contrato' …)!` con `!`
   ([:1258](../src/app/hooks/generarDocumentosFase4.ts#L1258)). Este producto
   **sólo tiene plantilla de pagaré**, así que el kit completo no aplica: pedirle
   un contrato es justamente el defecto del punto 3.

2. **Tres marcadores del pagaré se rellenan con `'N/A'`**
   ([:1635-1641](../src/app/hooks/generarDocumentosFase4.ts#L1635-L1641)):

   | Marcador | Hoy | Debe ser |
   |---|---|---|
   | `{{acreedor_nombre}}` | `'N/A'` | La institución acreedora |
   | `{{jurisdiccion}}` | `'N/A'` | Plaza de los tribunales |
   | `{{aval_nombre}}` | `'N/A'` | El aval, o vacío si no hay |
   | `{{monto_letra}}` | **el monto en dígitos** | El monto **en letra** |

   El último es el más delicado: la plantilla imprime
   `{{monto_letra}}` y debajo `({{monto_numero}} {{moneda}})`, así que hoy el
   pagaré saldría con **la cifra repetida dos veces** y sin cantidad en letra.
   En un título de crédito la cantidad en letra no es decorativa: es la que
   prevalece ante discrepancia (LGTOC art. 16).

### Punto 2 — el prompt actual no pide lo que se necesita validar

El backend **ya sabe** extraer una lista de verificación: busca la sección
`ELEMENTOS OBLIGATORIOS` dentro del prompt y la convierte en checklist
([index.ts:5517-5530](../supabase/functions/make-server-7e2d13d9/index.ts#L5517-L5530)).
El front ya la construye a partir de `elementosRequeridos` del catálogo
([ExpedienteElectronicoTab.tsx:1515](../src/app/components/solicitudes/ExpedienteElectronicoTab.tsx#L1515)).

El prompt capturado en el requisito de este producto **no tiene esa sección** y
sólo pide legibilidad y ausencia de manipulación. Por eso la IA no revisa
acreditado, monto ni firma: nadie se lo pidió.

Además el validador ya recibe `nombreSolicitante`, `rfcCliente` y `datosCredito`,
así que puede **contrastar** contra la solicitud en vez de sólo “ver” el dato.

### Punto 3 — las validaciones están atadas al NÚMERO de fase, no a lo que el producto declara

Ésta es la causa raíz de que “valide documentos de arrendamiento con el crédito
simple”:

| Disparador | Dónde | Problema |
|---|---|---|
| `if (seqActual === 4)` | [SolicitudCreditoForm.tsx:1657](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1657) | La fase 4 “es” Cláusulas Fiduciarias sólo en el producto GPO |
| `if (seqActual === 5 …) validarContratosYPagares(…)` | [:1743](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1743) | Exige **contrato y pagaré** aunque el producto no declare contrato |
| `if (String(sigFase.faseId) === '2') autoCrearReporteBuro(…)` | [:1863](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1863) | Genera un reporte de Buró al entrar a *cualquier* fase 2 — en este producto, “Liberación” |

`validarContratosYPagares`
([useOriginacionValidaciones.ts:311](../src/app/hooks/useOriginacionValidaciones.ts#L311))
**siempre** reclama un contrato:

```ts
if (contratos.length === 0) {
  errors.push('No se han cargado contratos. Cargue y valide el contrato antes de avanzar.');
}
```

*Crédito Simple 2° Piso* declara **un solo** requisito (el pagaré) y **ninguna**
plantilla de contrato. Reclamarle un contrato es importarle una regla del
arrendamiento/crédito tradicional, que es exactamente lo reportado.

**El principio correcto, y el que pide el requerimiento:** lo exigible en una fase
es lo que **ese producto declara** en esa fase, no lo que dicta un número de fase.

---

## Historias de usuario

### HU-23.1 — PDF del Pagaré desde la plantilla del producto

| CA | Criterio de aceptación |
|---|---|
| CA-01 | En la fase **Formalización de Pagaré**, un botón genera el PDF del pagaré a partir de la plantilla `pagare` **Activa** del producto. |
| CA-02 | El PDF no requiere plantilla de contrato: se genera con la de pagaré sola. |
| CA-03 | Se rellenan los datos del suscriptor desde la Solicitud: nombre, RFC y domicilio. |
| CA-04 | `{{acreedor_nombre}}` toma la **razón social de la institución**, no `N/A`. |
| CA-05 | `{{monto_letra}}` se imprime **en letra** (“CUATROCIENTOS MIL PESOS 00/100 M.N.”) y `{{monto_numero}}` en dígitos. |
| CA-06 | `{{jurisdiccion}}` y `{{lugar_pago}}` salen de la plaza/sucursal; si no hay dato, se deja explícito, nunca `N/A` silencioso. |
| CA-07 | `{{aval_nombre}}` queda vacío cuando no hay aval, sin imprimir `N/A` sobre la línea de firma. |
| CA-08 | El documento queda registrado en el Expediente Electrónico como el requisito `DOC-PAGARE-FIRMADO`, con su PDF adjunto. |
| CA-09 | Si el producto no tiene plantilla `pagare` Activa, se avisa qué falta y **no** se genera un PDF genérico. |
| CA-10 | Regenerar no duplica el documento en el expediente. |

### HU-23.2 — La IA valida acreditado, monto y firma

| CA | Criterio de aceptación |
|---|---|
| CA-11 | Al validar el pagaré, la IA verifica **el nombre del acreditado**, **el monto** y **la firma del suscriptor**. |
| CA-12 | Los tres viajan como **ELEMENTOS OBLIGATORIOS**, que es la sección que el backend ya convierte en checklist. |
| CA-13 | El nombre se **contrasta** contra el solicitante de la Solicitud, no sólo se comprueba que exista. |
| CA-14 | El monto se **contrasta** contra el monto de la Solicitud, tolerando formato (con/sin separadores, en letra o en dígitos). |
| CA-15 | Si falta cualquiera de los tres, el resultado es `valido: false` y el motivo dice **cuál** faltó. |
| CA-16 | Los criterios se toman del producto/catálogo; no se escriben en el código del formulario. |

### HU-23.3 — Cada producto valida lo que declara en sus fases

| CA | Criterio de aceptación |
|---|---|
| CA-17 | Al avanzar de fase, sólo se exigen los documentos que **ese producto** declara para **esa fase**. |
| CA-18 | A *Crédito Simple 2° Piso* **no** se le pide contrato: no lo declara. |
| CA-19 | `validarContratosYPagares` deja de exigir un contrato cuando el producto no lo declara en la fase. |
| CA-20 | El reporte de Buró deja de generarse por “ser la fase 2”: se genera sólo si el producto declara ese documento. |
| CA-21 | El prompt IA de la fase es el que el producto tiene configurado en **esa** fase; si está vacío, no se sustituye por el de otro producto. |
| CA-22 | Los productos que hoy funcionan (Arrendamiento, Crédito tradicional, GPO) **no cambian de comportamiento**: siguen exigiendo lo que declaran. |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | El número de fase **no** determina qué se valida. Lo determina lo que el producto declara en esa fase. |
| RN-02 | Un producto sin plantilla de contrato no emite contrato ni se le exige. |
| RN-03 | En un pagaré, la cantidad **en letra** es la que prevalece sobre la numérica ante discrepancia (LGTOC art. 16); no puede omitirse ni duplicar la cifra. |
| RN-04 | La IA valida contra los **datos de la Solicitud**, no sólo contra sí misma: un pagaré legible con otro nombre debe rechazarse. |
| RN-05 | Un marcador sin dato se resuelve de forma explícita; imprimir `N/A` en un título de crédito lo deja defectuoso. |

---

## Decisiones

### Decisión 1 — Dónde se capturan los tres elementos del pagaré

**Recomendación:** en `elementosRequeridos` del catálogo (`DOC-PAGARE-FIRMADO`),
que ya existe y el front ya convierte en `ELEMENTOS OBLIGATORIOS`. El código sólo
garantiza el respaldo: si el catálogo no los trae, se añaden los tres como mínimo
exigible para cualquier documento tipo pagaré.

### Decisión 2 — Alcance del arreglo del punto 3

Tocar los tres disparadores por número de fase es amplio y roza flujos que hoy
funcionan.

**Recomendación:** arreglar por **declaración**, no por producto: cada validación
pregunta “¿el producto declara este documento en esta fase?” antes de exigirlo.
Con eso Arrendamiento y Crédito siguen igual (sí lo declaran) y Crédito Simple 2°
Piso deja de recibir exigencias ajenas. Es el cambio de menor superficie que
resuelve la causa raíz.

### Decisión 3 — Quién dispara la generación del pagaré

**Recomendación:** un botón explícito en el Expediente de la fase, como el Kit
Legal, en vez de generarlo automáticamente al entrar a la fase: el pagaré necesita
que Monto y Plazo ya estén capturados, y generarlo antes produciría un título con
datos incompletos.

---

## Alcance

**Dentro:** generación del PDF del pagaré desde la plantilla; relleno correcto de
acreedor, monto en letra, jurisdicción y aval; elementos obligatorios de la
validación IA; acotamiento de las validaciones a lo declarado por el producto.

**Fuera:** firma electrónica del pagaré; timbrado; el flujo de arrendamiento y el
de crédito tradicional, que no cambian.

---

## Trazabilidad

| Requerimiento | HU / CA |
|---|---|
| "Generar el PDF del pagaré… ya existe la plantilla" | HU-23.1 · CA-01…CA-10 |
| "La IA debe validar el nombre del acreditado, el monto y la firma" | HU-23.2 · CA-11…CA-16 |
| "Valida documentos del arrendamiento con el crédito simple" | HU-23.3 · CA-17…CA-22 |
| "Se debe acotar únicamente a las fases / al prompt IA de cada producto" | CA-17, CA-21, RN-01 |
| Defecto encontrado al diagnosticar | §Punto 1 — `monto_letra` imprime dígitos (RN-03) |
