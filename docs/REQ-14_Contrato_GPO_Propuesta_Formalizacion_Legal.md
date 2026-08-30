# HU — REQ-14: Propuesta de Contrato GPO al ejecutar la Formalización Legal

> **Origen:** requerimiento funcional capturado el 28/08/2026 sobre el producto
> *Garantía Financiera 2o Piso*, Fase 4 **"Validación de Cláusulas Fiduciarias"**.
> Continúa a [REQ-12](REQ-12_Autorizacion_Comite_Interno_Credito.md) (Fase 3, resolución
> del CIC) y precede a la Fase 5 *Activación de Línea 2o Piso*, ya cubierta por
> [REQ-13](REQ-13_Detonacion_Contable_Traspaso_Cartera.md).
> Traducido a alcance técnico contra el código real de
> **`src/app/components/solicitudes/`**, **`src/app/hooks/`** y
> **`src/app/components/productos*/`**.

---

## Requerimiento original (transcripción, para trazabilidad)

> Con la información más importante de la Solicitud, Términos y Condiciones, Estructura
> Operativa de 2o Piso y Validación de Cláusulas Fiduciarias, generar una **propuesta de
> Contrato GPO** (Contrato de Garantía de Pago Oportuno) en PDF y adjuntarla a los
> archivos adjuntos del requisito solicitado, **cuando se pulse el botón**:
>
> **[Ejecutar Formalización Legal y Cierre de Solicitud]**
> `← Anterior: DICTAMEN DEL COMITÉ DE PREPAGO Y CRÉDITO`
> `Siguiente →: ACTIVACIÓN DE LÍNEA 2o PISO`
>
> Para eso es la plantilla, y agregar en el listado del producto, en el subtab
> Plantillas, el tipo para dar de alta esta plantilla nueva (o nuevas).

---

## Estado de implementación (28/08/2026)

**Código — hecho** (`tsc --noEmit`: 0 errores):

| Entregable | Dónde |
|---|---|
| Tipo de plantilla `contrato-gpo` (unión + OPTIONS + catálogo) | [product.ts:254](../src/app/types/product.ts#L254), [:269](../src/app/types/product.ts#L269), [:316](../src/app/types/product.ts#L316) |
| `tiposValidos` acepta `carta-oferta` y `contrato-gpo` (bug preexistente) | [generarDocumentosFase4.ts:176](../src/app/hooks/generarDocumentosFase4.ts#L176) |
| `CLAVE_CONTRATO_GPO_PROPUESTA`, `construirDatosContratoGPO`, `sustituirClavesContratoGPO`, `autoCrearPropuestaContratoGPO` | `generarDocumentosFase4.ts` (bloque REQ-14, al final) |
| Enganche en el avance de Fase 4 | [SolicitudCreditoForm.tsx:1077](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1077) |
| Plantilla con las 4 fuentes (incl. fideicomiso y cláusulas 4.1/7.2) | [Contrato_GPO.html](Producto_Garantia_Financiera_2o_Piso/Contrato_GPO.html) |

**Decisiones tomadas:** #1 → opción (a): se genera al pulsar el botón y el documento se
llama *Propuesta de Contrato…*. #2 → opción (a): diccionario propio
(`construirDatosContratoGPO`) aplicado **antes** de `sustituirPlaceholders`, porque su
catch-all borraría las claves GPO. #3 → una plantilla activa por producto; se toma la
primera.

**Verificado sin levantar la app:** los 31 placeholders de la plantilla resuelven (15 del
diccionario GPO, 16 de la cadena compartida); las funciones puras, ejecutadas con datos de
ejemplo, formatean importes a es-MX, la fecha a dd/mm/aaaa y los booleanos a
*Confirmada / No confirmada*.

**Falta — captura, no código:**

1. Subir `Contrato_GPO.html` al subtab **Plantillas** del producto GPO, tipo *Contrato de
   Garantía de Pago Oportuno*, estatus **Activo**.
2. Alta en el **Catálogo de Documentos** de un requisito de **Fase 4** llamado exactamente
   `Propuesta de Contrato de Garantía de Pago Oportuno`, **no obligatorio** (si se marca
   obligatorio, la fase se bloquea a sí misma: la validación corre antes de generar).
3. Prueba end-to-end sobre una Solicitud GPO en Fase 4 (CA-02 a CA-07 y CA-10).

---

## Contexto técnico (verificado en código, NO re-investigar)

### RESUELTO — el archivo destino estuvo vacío y fue restaurado

`src/app/hooks/generarDocumentosFase4.ts` quedó en 0 bytes el 28/08/2026 por un comando
mal escrito durante la creación de la plantilla. **Restaurado el mismo día**: versión de
git HEAD (2142 líneas) + los tres bloques no commiteados recuperados del scratchpad de la
sesión previa (`autoCrearDocumentosComitePrepago`, `autoCrearDictamenRiesgo`,
`autoCrearOficioCIC`) + las seis ediciones registradas en los transcripts del 27 y 28/08.
`tsc --noEmit`: 0 errores en todo el proyecto.

### El botón NO es un botón nuevo

Es el botón **"Enviar de Fase"** con la etiqueta reescrita. En
[FaseActionsComponent.tsx:124](../src/app/components/shared/FaseActionsComponent.tsx#L124):

```ts
const esValidacionClausulasFiduciarias = faseContiene('clausulas fiduciarias', 'clausula fiduciaria');
```

y en [FaseActionsComponent.tsx:396](../src/app/components/shared/FaseActionsComponent.tsx#L396)
esa bandera cambia el texto a `'Ejecutar Formalización Legal y Cierre de Solicitud'`.
El `onClick` sigue siendo `onEnviarFase` →
[`handleEnviarFase`](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L878).

**Consecuencia:** el enganche no es un handler nuevo, es un paso dentro del avance de
fase. Y ese avance **ya tiene su bloque GPO de Fase 4**, en
[SolicitudCreditoForm.tsx:1063-1077](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1063-L1077):

```ts
const saliendoDeClausulasFiduciarias = nf4.includes('clausulas fiduciarias') || …;
if (saliendoDeClausulasFiduciarias) {
  const vc = validacionClausulasRef.current || leerValidacionClausulas(storageId);
  const faltanVc = faltantesValidacionClausulas(vc);
  if (faltanVc.length > 0) { toast.error(…); return; }
}
```

### TENSIÓN DE DISEÑO — la fase ya exige el contrato FIRMADO antes de avanzar

[`faltantesValidacionClausulas`](../src/app/components/solicitudes/ValidacionClausulasFiduciariasTab.tsx#L53-L63)
bloquea el avance si no hay `contratoArchivo` (*"Contrato GPO Firmado (PDF)"*). Es decir:
al momento de pulsar el botón, **el contrato firmado ya está cargado**. La propuesta que
pide esta HU se generaría *después* de que el documento definitivo existe.

Los dos documentos son distintos y ambos tienen sentido —la propuesta es la constancia
sistémica de lo que el Core sancionó, el firmado es el instrumento legal— pero **el orden
importa** y no puede quedar implícito. Ver §Decisiones pendientes #1.

### Las cuatro fuentes de datos existen y están localizadas

| Fuente | Dónde vive | Campos aprovechables |
|---|---|---|
| **Solicitud** | `formData` + [`obtenerDatosCliente()`](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L2128) | `noSol`, cliente, producto, `rfc`, `curp`, `domicilio`, `gobierno` (institución de gobierno del cliente) |
| **Términos y Condiciones** | [solicitudCreditoStore.ts:100-107](../src/app/components/solicitudes/solicitudCreditoStore.ts#L100-L107) | `sectorInfraestructura`, `montoEmisionProyectado`, `porcentajeCoberturaGpo`, `montoGarantizadoGpo`, `tasaComisionAnualPactada`, `periodicidadCobroGpo`, y `plazoBonosAnios` ([useSolicitudesDB.ts:474](../src/app/hooks/useSolicitudesDB.ts#L474)) |
| **Estructura Operativa 2o Piso** | [EstructuraOperativa2oPisoTab.tsx:36-50](../src/app/components/solicitudes/EstructuraOperativa2oPisoTab.tsx#L36-L50) | `institucionFiduciaria`, `numeroFideicomisoFuentePago`, `representanteComun` |
| **Validación de Cláusulas Fiduciarias** | [ValidacionClausulasFiduciariasTab.tsx:29-42](../src/app/components/solicitudes/ValidacionClausulasFiduciariasTab.tsx#L29-L42) | `cuentaClabeFideicomiso`, `fechaFirmaContratos`, `clausula41AgotamientoFondoReserva`, `clausula72CascadaPagosPreferencial` |

Los cuatro subtabs exponen su lector (`leerValidacionClausulas`, y el equivalente por
`loadFromSession`/`loadFromSavedStore` con la clave del subtab). **Esta HU no captura
nada nuevo: sólo lee.**

### La plantilla ya existe como archivo

[docs/Producto_Garantia_Financiera_2o_Piso/Contrato_GPO.html](Producto_Garantia_Financiera_2o_Piso/Contrato_GPO.html)
— una sola `.page` (es lo único que captura `htmlToPdfBlobUrl`), a dos columnas, con
declaraciones, datos del emisor, condiciones de la garantía, fideicomiso de fuente de
pago, las dos cascadas de prelación de [REQ-8](REQ-8_Garantia_Financiera_2o_Piso.md) y 15
cláusulas. **No está dada de alta en ningún producto todavía** — eso es captura, no
código (§Alcance 2).

### Agregar el tipo de plantilla es un cambio de 3 líneas, en un solo archivo

[product.ts:254](../src/app/types/product.ts#L254) (unión `TipoPlantilla`),
[:269](../src/app/types/product.ts#L269) (`TIPO_PLANTILLA_OPTIONS`) y el arreglo
`TIPO_PLANTILLA_CATALOGO` ([:279](../src/app/types/product.ts#L279)).
[PlantillasTab.tsx:396](../src/app/components/productos/tabs/PlantillasTab.tsx#L396)
**itera el catálogo**, así que no requiere ningún cambio: el tipo nuevo aparece solo en
el select, con su ícono y color.

> **Advertencia:** `PlantillasTab` es **compartido** por Producto Crédito
> ([ProductoForm.tsx:1097](../src/app/components/productos/ProductoForm.tsx#L1097)),
> Captación ([ProductoCaptacionForm.tsx:1954](../src/app/components/productos/ProductoCaptacionForm.tsx#L1954))
> y Línea de Crédito ([ProductoLineaCreditoForm.tsx:1105](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx#L1105)).
> El tipo nuevo será visible en los tres. Es lo mismo que ya pasó con `carta-oferta`.

### BUG PREEXISTENTE que esta HU vuelve a tocar

`validarPlantillasRequeridas` (en el archivo por restaurar) valida contra:

```ts
const tiposValidos = ['solicitud', 'contrato', 'pagare', 'minuta'];
```

`'carta-oferta'` **ya falta ahí** desde HU-CRM-10: una plantilla de ese tipo se reporta
como *"Tipo(s) de plantilla inválido(s)"*. El tipo nuevo caería en la misma trampa. Hay
que agregar ambos al arreglo, no sólo el nuevo.

### El catch-all de `sustituirPlaceholders` vacía lo que no reconoce

La última línea de la cadena es `.replace(/\{\{[^}]+\}\}/g, '')`. Un placeholder no
registrado **no se queda visible: desaparece**. Hoy no están registrados ninguno de los
14 que necesita el contrato GPO (8 económicos + 6 fiduciarios). Sin ese registro el PDF
sale con los campos en blanco y sin ningún error.

### Hay dos caminos ya probados para sustituir, y conviene elegir a conciencia

| Camino | Ejemplo vivo | Implica |
|---|---|---|
| Extender `sustituirPlaceholders` | Todas las plantillas de Fase 2/4 | Los placeholders quedan disponibles para *cualquier* plantilla; una sola cadena de `.replace` cada vez más larga |
| Mapa propio + `sustituirPlaceholdersCarta` | [cartaOfertaPDF.ts:38-85](../src/app/components/oportunidades/cartaOfertaPDF.ts#L38-L85) | Diccionario aislado por documento (`Record<string,string>`), acepta `{{X}}` y `{X}`, no toca el pipeline compartido |

Ver §Decisiones pendientes #2.

### El patrón de "generar PDF y adjuntarlo al Expediente" está probado cuatro veces

`autoCrearReporteBuro`, `autoCrearDocumentosComitePrepago` (REQ-9), `autoCrearDictamenRiesgo`
(REQ-10) y `autoCrearOficioCIC` (REQ-12) comparten molde: **PDF → Supabase Storage →
`DocumentoCargado` en el Expediente → persistencia inmediata en BD → idempotencia por
`tipoDocumento`**. Los llamadores hacen siempre lo mismo
([SolicitudCreditoForm.tsx:844-848](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L844-L848)):
espejar `res.documentosActualizados` en `documentosDelTabRef.current` y refrescar con
`setExpedienteKey(k => k + 1)`.

### "Adjuntar al requisito solicitado" = coincidencia por nombre normalizado

[useOriginacionValidaciones.ts:798-815](../src/app/hooks/useOriginacionValidaciones.ts#L798-L815):
un documento satisface un requisito cuando
`normalize(doc.tipoDocumento) === normalize(requisito.tipoDocumento)` (minúsculas, sin
acentos). **No hay id de relación.** Por eso la clave del documento generado debe ser
exactamente el nombre del requisito dado de alta en el Catálogo de Documentos —igual que
`CLAVE_ACTA_COMITE = 'Acta de Sesión del Comité de Prepago y Crédito'` en REQ-9.

---

## Objetivo

Que al ejecutar la Formalización Legal de una Solicitud GPO, el sistema arme por sí solo
la propuesta de Contrato de Garantía de Pago Oportuno con los datos que ya fueron
capturados y sancionados en las cuatro fuentes, la deje adjunta al requisito
correspondiente del Expediente Electrónico, y que el formato de ese contrato sea
**configurable por producto** —una plantilla más en el subtab Plantillas— y no texto
incrustado en el código.

---

## Alcance

### 1. Tipo de plantilla `contrato-gpo` — NUEVO

En [product.ts](../src/app/types/product.ts):

```ts
export type TipoPlantilla = 'solicitud' | 'contrato' | 'pagare' | 'minuta' | 'carta-oferta' | 'contrato-gpo';

export const TIPO_PLANTILLA_OPTIONS: TipoPlantilla[] = [..., 'contrato-gpo'];

// TIPO_PLANTILLA_CATALOGO
{
  value: 'contrato-gpo',
  label: 'Contrato de Garantía de Pago Oportuno',
  descripcion: 'Instrumento que documenta la garantía financiera de segundo piso sobre la emisión bursátil',
  icon: '🛡️',
  color: '#7C3AED',
},
```

Y en `validarPlantillasRequeridas`: `tiposValidos` pasa a incluir `'carta-oferta'` y
`'contrato-gpo'` (corrige de paso el bug preexistente).

**Sin cambios en `PlantillasTab`.** El alta de la plantilla en el producto GPO es
captura: subir `Contrato_GPO.html`, tipo *Contrato de Garantía de Pago Oportuno*,
estatus **Activo**.

### 2. Plantilla `Contrato_GPO.html` — YA CREADA, se registra en el producto

Placeholders que consume, agrupados por fuente:

| Fuente | Placeholder | Origen del dato |
|---|---|---|
| Solicitud | `{{numeroSolicitud}}`, `{{clienteNombreCompleto}}`, `{{clienteRFC}}`, `{{clienteDomicilio}}`, `{{clienteFechaNacimientoConstitucion}}`, `{{productoNombre}}`, `{{descripcion}}`, `{{moneda}}`, `{{fechaFirmaLarga}}`, `{{ciudadFirma}}`, `{{jurisdiccion}}`, `{{fecha}}`, `{{fecha_inicio}}`, `{{institucionNombre}}`, `{{empresa_razon_social}}` | **ya soportados** por `sustituirPlaceholders` |
| Solicitud (cliente) | `{{institucion_gobierno}}` | `datos.gobierno` — llega por el spread de `obtenerDatosCliente()`; **falta registrar** |
| Términos | `{{sector_infraestructura}}` | `terminos.sectorInfraestructura` |
| Términos | `{{monto_emision}}` | `terminos.montoEmisionProyectado` |
| Términos | `{{plazo_bonos}}` | `terminos.plazoBonosAnios` |
| Términos | `{{porcentaje_cobertura_gpo}}` | `terminos.porcentajeCoberturaGpo` |
| Términos | `{{monto_garantizado}}` | `terminos.montoGarantizadoGpo` |
| Términos | `{{tasa_comision_gpo}}` | `terminos.tasaComisionAnualPactada` |
| Términos | `{{periodicidad_cobro_gpo}}` | `terminos.periodicidadCobroGpo` |
| Estructura Operativa | `{{institucion_fiduciaria}}` | `Estructura2oPisoData.institucionFiduciaria` |
| Estructura Operativa | `{{numero_fideicomiso}}` | `numeroFideicomisoFuentePago` |
| Estructura Operativa | `{{representante_comun}}` | `representanteComun` |
| Cláusulas Fiduciarias | `{{clabe_fideicomiso}}` | `cuentaClabeFideicomiso` |
| Cláusulas Fiduciarias | `{{fecha_firma_contratos}}` | `fechaFirmaContratos` |
| Cláusulas Fiduciarias | `{{clausula_41}}`, `{{clausula_72}}` | booleanos → `'Confirmada'` / `'No confirmada'` |

Los importes se formatean a `es-MX` con dos decimales antes de sustituir; los booleanos
se traducen a texto. **Ningún placeholder debe quedar sin registrar**: el catch-all los
borra en silencio.

### 3. `autoCrearPropuestaContratoGPO` — función NUEVA

En `generarDocumentosFase4.ts` (una vez restaurado), mismo molde que `autoCrearOficioCIC`:

```ts
export const CLAVE_CONTRATO_GPO_PROPUESTA = 'Propuesta de Contrato de Garantía de Pago Oportuno';

export async function autoCrearPropuestaContratoGPO(opts: {
  storageId: string | number;
  datos: DatosSolicitud;             // + gobierno
  estructura: Estructura2oPisoData;
  clausulas: ValidacionClausulasData;
  plantillas: PlantillaInstitucional[];
  faseNombre: string;
  faseId: number;
  supabase?: SupabaseClient;
  projectId?: string;
}): Promise<AutoCrearResult>
```

Comportamiento:

1. Busca `plantillas.find(p => p.tipoPlantilla === 'contrato-gpo' && p.estatus === 'Activo')`.
   Sin plantilla activa → **no genera y no rompe el avance de fase**: devuelve
   `documentosCreados: []` con un motivo explícito (mismo criterio de degradación que
   `validarPlantillasRequeridas`, no un `throw`).
2. `decodificarArchivoData(archivoData)` → sustitución de placeholders →
   `htmlToPdfBlobUrl(html, 'datauri')`.
3. `uploadGeneratedPDF(...)` al bucket de expedientes; si falla, conserva el `fileData`
   local (degradación ya existente en el resto de `autoCrear*`).
4. Registra el `DocumentoCargado` con `tipoDocumento: CLAVE_CONTRATO_GPO_PROPUESTA`,
   `area: 'JURÍDICO'`, `fase`/`faseId` de la fase 4, `estatus: 'Pendiente'`,
   `usuario: 'Sistema'`.
5. **Idempotente**: si ya existe un documento con esa clave en la Solicitud, no genera
   duplicado (`documentosCreados: []`).

### 4. Enganche en `handleEnviarFase`

Dentro del bloque `saliendoDeClausulasFiduciarias` ya existente
([SolicitudCreditoForm.tsx:1063-1077](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1063-L1077)),
**después** de que `faltantesValidacionClausulas` haya pasado y **antes** del avance de
fase:

```ts
const est = leerEstructura2oPiso(storageId);
const res = await autoCrearPropuestaContratoGPO({ storageId, datos, estructura: est, clausulas: vc, plantillas: plantillasProducto, … });
if (res.documentosActualizados) documentosDelTabRef.current = res.documentosActualizados;
setExpedienteKey(k => k + 1);
```

Con toasts equivalentes a los de REQ-12: éxito, "generada pero no persistida en BD", y
"ya existía". **Un fallo de generación no aborta el avance de fase** (ver RN-03).

### 5. Requisito en el Catálogo de Documentos

Alta (captura, no código) de un requisito de **Fase 4** con `tipoDocumento` idéntico a
`CLAVE_CONTRATO_GPO_PROPUESTA`. Debe darse de alta **como no obligatorio**, o el avance
de fase se bloquea a sí mismo: `validarDocumentosPorFase` corre *antes* de que el
documento exista.

---

## Criterios de aceptación

1. **CA-01** — El subtab Plantillas de cualquier producto ofrece el tipo *Contrato de
   Garantía de Pago Oportuno* y permite guardar una plantilla con ese tipo sin que
   ninguna validación la reporte como tipo inválido.
2. **CA-02** — Con la plantilla activa en el producto GPO, pulsar **Ejecutar
   Formalización Legal y Cierre de Solicitud** genera un PDF y lo deja visible en el
   Expediente Electrónico sin recargar la pantalla.
3. **CA-03** — El PDF trae, con sus valores reales, los datos de las cuatro fuentes:
   emisor y RFC, monto de emisión, % de cobertura, monto máximo garantizado, tasa y
   periodicidad de comisión, institución fiduciaria, número de fideicomiso,
   representante común, CLABE, fecha de firma y el estado de las cláusulas 4.1 y 7.2.
4. **CA-04** — Ningún campo del PDF sale vacío por un placeholder no registrado; los que
   no tengan dato muestran `N/A`.
5. **CA-05** — El documento generado queda asociado al requisito de Fase 4 con ese
   nombre (aparece como cargado, no como documento suelto).
6. **CA-06** — Ejecutar dos veces no duplica el documento.
7. **CA-07** — Sin plantilla activa tipo `contrato-gpo`, el avance de fase **ocurre
   igual** y el usuario recibe un aviso claro de que no se generó la propuesta y por qué.
8. **CA-08** — Con la Validación de Cláusulas Fiduciarias incompleta, no se genera nada
   y el avance sigue bloqueado con el mensaje actual.
9. **CA-09** — El PDF se sube a Storage; si la subida falla, el documento sigue
   apareciendo en el Expediente con su archivo local y se avisa.
10. **CA-10** — Recargar la app y reabrir la Solicitud: el documento sigue en el
    Expediente (persistió en BD, no sólo en sesión).

---

## Reglas de negocio

- **RN-01** — Los valores se leen al momento de generar, nunca de un caché anterior
  (mismo criterio que HU-CRM-10 para la Carta Oferta).
- **RN-02** — La propuesta es un documento **de constancia sistémica**: no sustituye al
  *Contrato GPO Firmado* que el subtab exige, ni lo valida.
- **RN-03** — La generación **nunca bloquea** el cierre de la Solicitud. Si falla, se
  avisa y el proceso continúa: el cierre de fase es un acto de negocio ya validado por
  las reglas previas.
- **RN-04** — El formato del contrato vive en la plantilla del producto. Ningún texto
  legal se incrusta en el código.

---

## Decisiones pendientes

**1. ¿Antes o después del contrato firmado?** La fase ya exige el firmado para avanzar,
así que la propuesta se genera cuando el instrumento definitivo ya existe. Opciones:

- **(a) Recomendada** — dejarlo como pide el requerimiento (se genera al pulsar el
  botón) y nombrar el documento *"Propuesta de Contrato…"*, dejando explícito que es la
  constancia de lo sancionado por el sistema.
- (b) Agregar además un botón **[Generar Propuesta de Contrato GPO]** dentro del subtab
  Validación de Cláusulas Fiduciarias, para que el usuario pueda producir el borrador
  *antes* de mandarlo a firma. Es el flujo que hace útil a la propuesta, pero es alcance
  adicional (un botón y un handler más).
- (c) Cambiar la validación de la fase para que el firmado deje de ser obligatorio.
  **No recomendada**: debilita un control que hoy existe.

**2. ¿Diccionario propio o `sustituirPlaceholders` compartido?**

- **(a) Recomendada** — mapa propio estilo `cartaOfertaPDF.ts`: los 14 placeholders GPO
  quedan aislados en el módulo del contrato, sin alargar la cadena compartida ni
  arriesgar colisiones con las plantillas de Crédito/Arrendamiento.
- (b) Extenderlos en `sustituirPlaceholders`: quedan disponibles para cualquier
  plantilla de cualquier producto, a costa de una cadena de `.replace` aún más larga.

**3. ¿Una plantilla o varias?** El requerimiento dice *"esta plantilla nueva o nuevas"*.
Si más adelante hacen falta anexos (p. ej. Pagaré del Crédito de Recuperación), el tipo
`contrato-gpo` admite varias filas pero la función toma **la primera activa**. Si se
requiere más de un documento por ejecución, hay que decidir el criterio de selección
(por `nombre`, por orden, o un tipo por documento).

---

## Fuera de alcance (y por qué)

| Tema | Motivo |
|---|---|
| Firma electrónica del PDF generado | No hay infraestructura criptográfica (mismo bloqueante de REQ-11/REQ-12) |
| Validación IA del documento generado | Se crea como `Pendiente`; la validación sigue el flujo normal del Expediente |
| Numeración/folio propio del contrato | Se usa el `noSol` de la Solicitud; no hay consecutivo de contratos |
| Alta del requisito en el Catálogo de Documentos | Es captura de configuración (REQ-8 §6), no desarrollo |
| Envío del contrato al cliente | No hay módulo de notificaciones |

---

## Advertencias

- **`htmlToPdfBlobUrl` sólo captura el primer `.page`.** Cualquier plantilla nueva debe
  ser un único `.page`; lo que quede fuera de ese elemento no aparece en el PDF y no hay
  error que lo indique.
- **`PlantillasTab` es compartido**: el tipo nuevo aparecerá también en Producto Crédito
  y Captación. Es ampliación de catálogo, no restricción — no rompe datos existentes.
- **El requisito de Fase 4 no debe ser obligatorio** o el avance se bloquea antes de
  generar el documento que lo satisface.
- **`sustituirPlaceholders` borra lo que no conoce.** Al probar, revisar el PDF campo por
  campo: un placeholder mal escrito no falla, sólo deja el hueco.

---

## Orden de ejecución

0. **Restaurar `generarDocumentosFase4.ts`** — sin eso no hay dónde escribir la función.
1. Agregar el tipo `contrato-gpo` en `product.ts` (3 puntos) y corregir `tiposValidos`
   en `validarPlantillasRequeridas`.
2. Dar de alta la plantilla `Contrato_GPO.html` en el producto GPO (captura) y verificar
   que aparece Activa en el subtab.
3. Resolver la decisión #2 e implementar el mapa de placeholders con las 14 claves.
4. Implementar `autoCrearPropuestaContratoGPO` (idempotente, con degradación sin
   plantilla y sin Storage).
5. Enganchar en el bloque `saliendoDeClausulasFiduciarias` de `handleEnviarFase`, con
   los toasts y el refresco de `expedienteKey`.
6. Alta del requisito de Fase 4 en el Catálogo de Documentos (captura).
7. Probar corriendo la app CA-02 a CA-07 y CA-10 — son los que no se ven en un typecheck.
