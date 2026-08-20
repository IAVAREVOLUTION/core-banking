# HU — REQ-7: Producto "Arrendamiento Financiero" + Simulación de 3 vías

> **Origen:** mensajes de Jorge Ríos del 18/08/2026 (11:26–11:35), más el contenido de la
> referencia de la tabla, aportado por Jorge ese mismo día.
> Traducido a alcance técnico contra el código real y contra el estado del producto en BD.
> Los puntos marcados **[CONFIRMAR]** son los huecos que siguen abiertos; la especificación
> de la tabla y el criterio de IVA **ya están cerrados** (§3).

## Requerimiento original (literal, para trazabilidad)

1. Crear un producto tipo **Arrendamiento Financiero**, igual que el de Arrendamiento Puro.
   Los dos únicos cambios: **Valor Residual = 1% y 3%**, y en los **Templates** cambiar los
   encabezados a "Arrendamiento Financiero".
   > **Estado real (verificado en BD el 18/08/2026):** el **producto ya se creó**
   > (`81e46a5c-c227-4185-9159-4be922759a63`, PR-003) y el Valor Residual 1%/3% está bien.
   > Los **Templates NO**: `data.plantillas` está **vacío**. Ver §1 y §2 del Alcance.
2. En el subtab **Simulación** de la solicitud, el botón **Simular** debe ramificar en tres:
   - **Arrendamiento Puro** → el calendario que ya se genera hoy.
   - **Crédito Simple** → la tabla de amortización que ya se genera hoy.
   - **Arrendamiento Financiero** → **tabla nueva** (referencia enviada por Jorge:
     `https://share.google/aimode/Z1px4IJdT7HqHkTtL` — ejemplo de tabla de amortización
     de Arrendamiento vs Crédito Simple).
3. Flujo completo **End to End** para Arrendamiento Financiero.
4. Prueba integral con el check de **Seguro** activado, para comparar cómo se ven las
   tablas de Arrendamiento Puro vs Arrendamiento Financiero, y con eso configurar
   fases, lógica y subtabs de la solicitud.

---

## Contexto técnico (ya verificado en el código, NO re-investigar)

### Stack y persistencia
- React + TypeScript + Vite + Supabase (Postgres + Edge Functions + Storage).
- Las fases **no están en código**: viven en `J_PRODUCTOS.data.fases` de cada producto.
  El producto de referencia es **"Arrendamiento Puro-Maquinaria"**
  (`8b9fa0f2-f500-4cfc-ae7d-04acceb69018`), con 6 fases:
  4 = *Recaudación Inicial y Compra*, 5 = *Recepción del Activo y Cierre*,
  6 = *Liberación y Dispersión*.
- Persistencia: `PUT .../make-server-7e2d13d9/solicitudes-credito/:id`, con **deep merge
  server-side** (se puede enviar solo la rama a cambiar).
- Camino de **escritura y lectura separados** (`formToDBPayload` vs
  `buildFormDataFromListItem` / `preloadSubtabsFromDBData`): un campo nuevo se mapea en
  **ambos** o se pierde al recargar.

### Estado del producto en BD — verificado el 18/08/2026

`GET .../make-server-7e2d13d9/productos-credito` devuelve 3 productos. Comparativa
`Arrendamiento Puro-Maquinaria` (PR-002, `8b9fa0f2-…`) vs
**`Arrendamiento Financiero` (PR-003, `81e46a5c-c227-4185-9159-4be922759a63`)**:

| Rama de `data` | Puro (PR-002) | Financiero (PR-003) | Veredicto |
|---|---|---|---|
| `sublinea` | `Arrendamiento Puro` | `Arrendamiento Financiero` | OK |
| `estatus` | Activo | Activo | OK |
| `valorResidualOpciones` | 50%, 30% | **1%, 3%** | **OK — es lo que pidió Jorge** |
| `enganches` | 10%, 20% | 10%, 20% | OK (idéntico) |
| `fases` | 6 | 6, mismos nombres y áreas | OK |
| `expedientesElectronicos` | 13 | 13, **claves y nombres idénticos** | OK |
| `matrizTasaFija` | 3 filas | 3 filas | OK |
| `cargo` | sublinea "Arrendamiento Puro" | sublinea "Arrendamiento Financiero" | OK |
| `rentasAnticipadas` | 3, 1 | **1, 2, 3, 4, 5** | **[CONFIRMAR]** difiere del Puro |
| `plantillas` | contrato + solicitud + pagare, los 3 Activos con archivo | **`[]` vacío** | **BLOQUEANTE** |
| `fases[].promptIA` | textos de Arrendamiento Puro | **copiados literal: dicen "Arrendamiento Puro"** | **DEFECTO** |

Dos hallazgos que **no** estaban en el requerimiento original:

1. **`plantillas: []`** — sin plantilla `contrato` ni `pagare` activa con archivo base,
   `validarPlantillasRequeridas()` **bloquea la Fase 4** y el flujo E2E no arranca.
   Es el bloqueante inmediato del punto 3 del requerimiento.
2. **Los `promptIA` de las fases 1, 2, 3 y 4 se copiaron literal del producto Puro** y se
   identifican como validadores "para operaciones de **Arrendamiento Puro**". El de la
   fase 3 llega a decir que genera el *"Contrato Marco de Arrendamiento Puro"*.
   Es exactamente el mismo problema que "cambiar los encabezados", pero en la lógica de
   validación con IA en vez de en el template.

### "Arrendamiento Financiero" ya existe parcialmente — inventario del código

| Punto | Archivo | Estado hoy |
|---|---|---|
| Sublínea en el catálogo | [ProductoFormDefaultTab.tsx:109](src/app/components/productos/ProductoFormDefaultTab.tsx#L109) | Ya existe: `'Arrendamiento Puro', 'Arrendamiento Financiero'` son opciones |
| Subtabs Valor Residual / Rentas Anticipadas / % Enganche | [ProductoForm.tsx:531-563](src/app/components/productos/ProductoForm.tsx#L531-L563) | Ya se activan con `/arrendamiento/i` — cubren Financiero |
| Términos y Condiciones (Enganche, Residual, Rentas Anticipadas) | [TerminosCondicionesTab.tsx:340-347](src/app/components/solicitudes/TerminosCondicionesTab.tsx#L340-L347) | `isArrendamiento` usa solo `includes('arrendamiento')`; `isArrendamientoPuro` es alias retrocompatible — **ya aplica a Financiero** |
| Cálculo de Monto Residual | [TerminosCondicionesTab.tsx:441-469](src/app/components/solicitudes/TerminosCondicionesTab.tsx#L441-L469) | Ya calcula `montoResidual = montoAutorizado × %ValorResidualSel/100` |
| Motor de crédito con residual | [solicitudCreditoStore.ts:1249-1258](src/app/components/solicitudes/solicitudCreditoStore.ts#L1249-L1258) | `generarSimulacion(..., montoResidual)` ya existe y está documentado como "Arrendamiento Financiero" |
| Motor de arrendamiento puro | [cotizacionArrendamientoTypes.ts](src/app/components/cotizaciones/cotizacionArrendamientoTypes.ts) | `calcularRentaSinIva()` (anualidad con residual) + `generarTablaArrendamiento()` |

### Los 6 puntos que hoy hard-codean `'puro'` — aquí está el trabajo real

Cada uno debe decidirse explícitamente: ¿entra Financiero, o no?

| # | Sitio | Qué controla | Decisión |
|---|---|---|---|
| 1 | [SimulacionTab.tsx:174](src/app/components/solicitudes/SimulacionTab.tsx#L174) | `isArrendamiento` → rama de render y de `Simular` | **Debe cambiar**: hoy Financiero cae en la rama de Crédito |
| 2 | [SolicitudCreditoForm.tsx:1215](src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1215) | `esArrendamientoPuro` → subtab **Facturas** + botones de factura por fase | **[CONFIRMAR]** ¿Financiero factura igual? |
| 3 | [SolicitudCreditoForm.tsx:678](src/app/components/solicitudes/SolicitudCreditoForm.tsx#L678) | `esArrPuro` → omitir validación en la fase de Recaudación | **[CONFIRMAR]** ligado a la decisión de fases |
| 4 | [SolicitudCargosTab.tsx:29](src/app/components/solicitudes/SolicitudCargosTab.tsx#L29) | Desembolso Inicial (enganche + rentas anticipadas + comisión) | **Debe incluir Financiero** (tiene enganche y rentas anticipadas) |
| 5 | [GarantiasTab.tsx:29](src/app/components/solicitudes/GarantiasTab.tsx#L29) | Categoría default `ACTIVO_FIJO` del bien | **Debe incluir Financiero** |
| 6 | [CarteraArrendamientoList.tsx:33](src/app/components/cartera/CarteraArrendamientoList.tsx#L33) | Enruta el contrato a Cartera de Arrendamiento y lo **excluye** de [CarteraList.tsx:38](src/app/components/cartera/CarteraList.tsx#L38) | **[CONFIRMAR]** ¿Financiero va a Cartera de Arrendamiento o a Cartera de Crédito? |

> Regla: **no** basta con relajar el `includes('puro')` a `includes('arrendamiento')` en todos
> lados — eso mete Financiero al calendario de rentas de Puro, que es justo lo que NO se quiere.
> Introducir un helper compartido con **tres** estados y usarlo en todos los sitios:
> `tipoOperacion(lineaProducto, tipoProducto) → 'ARR_PURO' | 'ARR_FIN' | 'CREDITO' | 'CAPTACION'`.

---

## Objetivo

Que **Arrendamiento Financiero** sea un producto de primera clase, con su propia tabla de
amortización en Simulación, sin alterar el comportamiento actual de Arrendamiento Puro ni
de Crédito Simple, y con el flujo E2E (originación → fases → cartera) completo.

---

## Alcance

### 1. Producto "Arrendamiento Financiero" — HECHO, con 2 pendientes

El producto **ya existe y está bien configurado**: `81e46a5c-c227-4185-9159-4be922759a63`
(PR-003), Activo, sublínea `Arrendamiento Financiero`, Valor Residual **1% y 3%**, con las
mismas 6 fases, los mismos 13 requisitos, la misma matriz de tasa fija y los mismos enganches
que el producto Puro. **No hay que volver a crearlo.** Pendientes sobre él:

- **Corregir los `promptIA` de las fases 1, 2, 3 y 4**: dicen "Arrendamiento Puro".
  Sustituir por "Arrendamiento Financiero" y ajustar la fase 3, que menciona el
  *"Contrato Marco de Arrendamiento Puro"*. **No tocar los nombres de requisitos ni de
  documentos citados dentro del prompt** (ej. "Autorización Buró de Crédito"): la validación
  con IA compara por nombre exacto y renombrarlos rompe las fases 1-2.
- **Rentas Anticipadas [CONFIRMAR]**: Financiero tiene 1,2,3,4,5 y Puro tiene 3,1. El
  requerimiento dice "todo igual"; si la diferencia fue intencional, dejarla documentada
  aquí; si no, alinearla con el Puro.
- El producto vive **solo en la BD** (`J_PRODUCTOS`), no hay seed ni SQL en el repo:
  los cambios se hacen por UI (módulo Productos) o por PUT directo del `data`.

### 2. Templates — ARCHIVOS HECHOS, falta cargarlos al producto

Los 3 archivos ya existen en [docs/Producto_Arrendamiento/](docs/Producto_Arrendamiento/):

- [Contrato_Arrendamiento_Financiero.html](docs/Producto_Arrendamiento/Contrato_Arrendamiento_Financiero.html)
- [Pagare_Arrendamiento_Financiero.html](docs/Producto_Arrendamiento/Pagare_Arrendamiento_Financiero.html)
- [Solicitud_Arrendamiento_Financiero.html](docs/Producto_Arrendamiento/Solicitud_Arrendamiento_Financiero.html)

Se derivaron de los de Puro conservando **CSS y los mismos placeholders `{{…}}`**
(22 / 19 / 34, verificados idénticos uno a uno — el generador liga por nombre, así que
cualquier alta o baja rompería el binding). Además de encabezados y títulos, se ajustó el
fondo legal al arrendamiento financiero: adquisición del Bien por indicación del arrendatario,
plazo forzoso, **cláusula nueva de IVA sobre el monto total de la renta** (regla de §3),
opciones terminales del art. 410 LGTOC con la compra al Valor Residual, y transmisión de la
propiedad al ejercer la opción.

**Pendiente:** `data.plantillas` del producto PR-003 sigue **vacío**. Hasta que `contrato` y
`pagare` estén activos con archivo base, `validarPlantillasRequeridas()` bloquea la Fase 4 y
el flujo E2E no se puede ejecutar. **Éste es el bloqueante vivo.**

**[CONFIRMAR] — revisión legal.** El clausulado nuevo se alineó con los artículos que el
propio template ya citaba (408 y 410 LGTOC, que son los de arrendamiento financiero), pero
requiere validación del área jurídica antes de usarse en producción.
- Cargarlos en el subtab **Plantillas** del producto PR-003
  ([PlantillasTab.tsx](src/app/components/productos/tabs/PlantillasTab.tsx)), mapeando a los
  tipos de `TIPO_PLANTILLA_OPTIONS` ([product.ts:269](src/app/types/product.ts#L269)):
  `solicitud`, `contrato`, `pagare` — los tres con `estatus: 'Activo'`.
  `contrato` y `pagare` son **obligatorios**: sin ellos activos y con archivo base,
  `validarPlantillasRequeridas()` ([generarDocumentosFase4.ts:149](src/app/hooks/generarDocumentosFase4.ts#L149))
  bloquea la generación de documentos en Fase 4.
- **Solo cambian encabezados/títulos.** No reescribir cláusulas legales.
  El clausulado propio de arrendamiento financiero (opción de compra al valor residual,
  transmisión de propiedad) queda **[CONFIRMAR]** con Jorge — no inventarlo.

### 3. Simulación — ramificación de 3 vías (núcleo de la HU)

En [SimulacionTab.tsx](src/app/components/solicitudes/SimulacionTab.tsx) el botón **Simular**
debe resolver por tipo de operación:

| Tipo | Handler | Encabezado | Resultado |
|---|---|---|---|
| Arrendamiento Puro | `handleSimularArrendamiento` (L418) | `CALENDARIO DE PAGOS — ARRENDAMIENTO PURO` | **Sin cambios** |
| Crédito Simple / demás créditos | `handleSimularCredito` (L390) | Tabla de amortización actual | **Sin cambios** |
| Arrendamiento Financiero | **`handleSimularArrendamientoFinanciero` (nuevo)** | `TABLA DE AMORTIZACIÓN — ARRENDAMIENTO FINANCIERO` | **Tabla nueva** |

**Reglas de cálculo de la tabla nueva:**

- Renta periódica: misma anualidad con valor futuro que ya usa Puro
  (`calcularRentaSinIva(montoAutorizado, montoResidual, tasaAnual, plazo)`), **no** la
  anualidad a cero de Crédito Simple. Reutilizar la función, no duplicarla.
- La tabla desglosa **saldo insoluto decreciente** que **converge al Monto Residual**
  (opción de compra), **no a cero**. Ésa es la diferencia estructural contra Crédito Simple.
- El Monto Residual sale de Términos y Condiciones (`terminos.montoResidual`), ya calculado
  como `montoAutorizado × %ValorResidualSel / 100`.
- Fila final adicional: **Opción de Compra / Valor Residual** con su monto e IVA.
- Rentas anticipadas: mismo tratamiento que Puro — las primeras N quedan `Pagado` y se
  cobran en el subtab **Cargos** (ver `arrRowsView`, L333).

#### Columnas e IVA — CONFIRMADO (contenido del link, aportado por Jorge)

**La diferencia contra Crédito Simple es la base gravable del IVA, no la renta.**

| | Crédito Simple | Arrendamiento Financiero |
|---|---|---|
| Base del IVA | **Solo el interés** devengado | **La renta completa** (capital + interés) |
| Razón | El dinero no es un bien comercializable; el capital no grava IVA | La SOFOM arrienda un **bien tangible**; grava el pago total |
| Comportamiento del IVA | **Decrece** cada mes (el interés baja con el saldo) | **Fijo** todo el contrato (la renta subtotal está congelada por la anualidad) |
| CFDI mensual | Subtotal = interés; el pago a capital **no** genera factura de ingresos (es recuperación de activo financiero) | Subtotal = **renta completa**; impuesto = IVA completo |

**Columnas de la tabla nueva** (nombres tal cual la referencia):

`MES | SALDO INICIAL | CAPITAL IMPLÍCITO | INTERÉS IMPLÍCITO | RENTA (SUBTOTAL) | IVA RENTA (16%) | PAGO MENSUAL TOTAL | SALDO FINAL`

Más `FECHA` y `ESTATUS`, que ya usan las otras dos tablas del sistema, y `SEGURO` cuando el
check de Seguro Financiado está activo (ver §5).

**Caso de prueba de la referencia** — activo **$100,000 MXN**, **12 meses**, **24% anual
(2% mensual)**, **sin valor residual**:

| Mes | Saldo Inicial | Capital Implícito | Interés Implícito | Renta (Subtotal) | IVA Renta (16%) | Pago Mensual Total | Saldo Final |
|---|---|---|---|---|---|---|---|
| 1 | $100,000.00 | $7,455.96 | $2,000.00 | $9,455.96 | $1,512.95 | $10,968.91 | $92,544.04 |
| 2 | $92,544.04 | $7,605.08 | $1,850.88 | $9,455.96 | $1,512.95 | $10,968.91 | $84,938.96 |
| … | … | … | … | … | … | … | … |
| 12 | $9,251.22 | $9,251.22 | $185.02 | $9,455.96 | $1,512.95 | $10,968.91 | $0.00 |

Invariantes que debe cumplir el motor:

- `Renta (Subtotal)` es **constante** = `calcularRentaSinIva(100000, 0, 24, 12)` = **$9,455.96**.
- `IVA` es **constante** = `Renta × 0.16` = **$1,512.95**. No decrece.
- `Capital Implícito + Interés Implícito = Renta (Subtotal)` en **cada** renglón.
- `Interés Implícito = Saldo Inicial × 2%`; `Saldo Final = Saldo Inicial − Capital Implícito`.
- IVA total del contrato ≈ **$18,155** (16% de todo el valor del activo más sus intereses),
  contra ≈ **$2,155** del mismo caso como Crédito Simple (16% de la suma de intereses).
  El orden de magnitud —**~8× más IVA**— es la prueba de que la rama correcta se ejecutó.

> **Ojo con el residual.** El ejemplo de la referencia **no tiene valor residual**
> (`Saldo Final` del mes 12 = $0.00), así que sirve como caso de regresión exacto con
> residual = 0. Con el producto real (**1%** o **3%**) el `Saldo Final` del último mes debe
> quedar en el **Monto Residual**, no en cero, y la renta baja en consecuencia —
> `calcularRentaSinIva()` ya lo resuelve.

- **IVA del seguro**: cuando hay Seguro Financiado, el IVA grava `renta + seguro`, igual que
  ya lo hace Arrendamiento Puro (`iva = (rentaSinIva + seguro) × IVA_RATE`).
- **IVA del valor residual**: se cobra al ejercer la opción de compra, en la fila final.

### 4. Flujo End to End

- Recorrer las 6 fases con el producto nuevo, igual que Arrendamiento Puro:
  originación → autorizaciones → contratos/pagarés (Fase 4) → recepción del activo (Fase 5)
  → liberación y dispersión (Fase 6) → contrato **Vigente** en cartera.
- Los subtabs de la solicitud deben resolverse según la decisión tomada en los puntos
  **#2, #3 y #6** de la tabla de detección: subtab **Facturas**, botones de factura por fase
  ([FaseActionsComponent.tsx:146](src/app/components/shared/FaseActionsComponent.tsx#L146))
  y destino de cartera.
- El calendario/tabla debe **persistir y releerse** tras recargar
  (`data.solicitud.simulacion.*` en [useSolicitudesDB.ts:449](src/app/hooks/useSolicitudesDB.ts#L449))
  — escribir en la rama de lectura, no solo en la de escritura.

### 5. Prueba integral con Seguro

Una solicitud por cada producto, **mismos parámetros**, con el check **Seguro Financiado**
activo ([TerminosCondicionesTab.tsx:1309](src/app/components/solicitudes/TerminosCondicionesTab.tsx#L1309)),
para poder comparar las dos tablas lado a lado:

- Monto solicitado, plazo, tasa, frecuencia, % enganche y fecha de primer pago **idénticos**.
- Valor Residual: el configurado en Puro vs **1%** y **3%** en Financiero.
- Seguro: mismo producto de seguro y misma fila de matriz en ambas.
  Nota: el seguro se prorratea como `montoSeguro / plazo`
  ([SimulacionTab.tsx:404](src/app/components/solicitudes/SimulacionTab.tsx#L404)) —
  verificar que el prorrateo use el **número de periodos** cuando la frecuencia no es
  mensual (`calcularNumeroPeriodos`), no el plazo en meses.
- Entregable de la prueba: captura de ambas tablas + comparativo de totales
  (suma de rentas, IVA total, residual) para revisión de Jorge.

---

## Criterios de aceptación

1. ~~Existe el producto "Arrendamiento Financiero"~~ **YA CUMPLIDO** (PR-003). Verificar
   únicamente que **1%** y **3%** aparezcan seleccionables en Términos y Condiciones y que
   ningún `promptIA` del producto siga diciendo "Arrendamiento Puro".
2. Los 3 templates de Financiero están cargados y **activos con archivo base**; Fase 4 genera
   contrato y pagaré con encabezado **"Arrendamiento Financiero"**, sin bloqueo por
   `validarPlantillasRequeridas`.
3. En una solicitud de **Arrendamiento Puro**, "Simular" produce **exactamente** el mismo
   calendario que hoy (regresión: sin diferencias de importe ni de columnas).
4. En una solicitud de **Crédito Simple**, "Simular" produce **exactamente** la misma tabla
   que hoy.
5. En una solicitud de **Arrendamiento Financiero**, "Simular" produce la tabla nueva, con
   saldo insoluto que termina en el Monto Residual (1% o 3% del Monto Autorizado) y fila de
   opción de compra.
5b. **Regresión numérica contra la referencia**: con $100,000 / 12 meses / 24% anual y
   **residual 0**, la tabla reproduce exactamente el ejemplo de §3 — renta subtotal
   **$9,455.96** e IVA **$1,512.95 constantes** los 12 meses, pago total **$10,968.91**,
   saldo final **$0.00**, e IVA acumulado **~$18,155** (≈8× el del mismo caso como
   Crédito Simple).
6. Con Seguro Financiado activo, la columna Seguro aparece y cuadra en ambas tablas
   (Puro y Financiero), y el total de seguro del calendario = `montoSeguro`.
7. El flujo E2E de Arrendamiento Financiero llega hasta contrato **Vigente**.
8. Todo lo anterior persiste tras recargar la página.
9. `npx vite build` compila sin errores y `dist/` se restaura (`git checkout -- dist/`).

---

## Fuera de alcance

- **Motor contable / pólizas bajo NIF D-5.** Queda documentado para una HU posterior, con lo
  que aportó Jorge: en Arrendamiento Financiero la SOFOM **da de baja el activo físico al
  firmar** y da de alta una **Cuenta por Cobrar por Arrendamiento** (activo financiero por el
  valor neto de los pagos mínimos); el ingreso se reconoce conforme se **devengan los
  intereses implícitos**. En Crédito Simple, en cambio, se afecta **Cartera de Crédito** por
  el monto completo. Esta HU **solo** implementa la tabla y el IVA, no las pólizas.
- **Emisión real del CFDI mensual.** La referencia define su contenido (subtotal = renta
  completa, impuesto = IVA completo); timbrarlo no entra aquí.
- Tratamiento fiscal de la depreciación y deducibilidad (solo se refleja el IVA en la tabla).
- Reescritura del clausulado legal de los contratos.
- Cambios al comportamiento actual de Arrendamiento Puro y Crédito Simple.

---

## Advertencias

- **No relajar `includes('puro')` globalmente.** Meter Financiero al calendario de rentas de
  Puro rompe el requerimiento. Usar el helper de tres estados y decidir sitio por sitio.
- Hoy Arrendamiento Financiero **cae silenciosamente en la rama de Crédito**
  ([SimulacionTab.tsx:174](src/app/components/solicitudes/SimulacionTab.tsx#L174)) y ya
  aplica el residual ([L407-411](src/app/components/solicitudes/SimulacionTab.tsx#L407-L411)).
  Es decir: **no parte de cero, parte de una tabla parecida pero con las columnas y el IVA
  de Crédito Simple.** Ése es el delta a corregir.
- Camino de escritura ≠ camino de lectura: mapear el campo nuevo en ambos.
- No usar `catch {}` vacío: los fallos de guardado deben mostrar toast visible.
- No renombrar claves ni nombres de requisitos ya usados por las validaciones con IA
  (comparan por nombre exacto).

---

## Bloqueantes antes de codificar la tabla

1. ~~**Ejemplo de la tabla objetivo.**~~ **RESUELTO** — Jorge aportó el contenido del link
   el 18/08/2026; está transcrito completo en §3, con caso de prueba numérico.
2. ~~**Criterio de IVA.**~~ **RESUELTO** — IVA sobre la **renta completa** (capital +
   interés). Confirmado con la comparativa y los totales del ejemplo.
3. **Destino de cartera**: ¿Cartera de Arrendamiento o Cartera de Crédito?
   *Señal fuerte hacia Arrendamiento*: la referencia establece **CFDI mensual de ingresos por
   la renta completa**, que es el ciclo que ya opera Cartera de Arrendamiento. Falta la
   confirmación operativa.
4. **Ciclo de facturación**: ¿Financiero usa el subtab Facturas y los CFDI de Fases 4-5,
   igual que Puro? La referencia define el CFDI **mensual** (cobranza recurrente), no dice
   nada del pago inicial ni de la factura del proveedor de Fases 4-5 — eso sigue abierto.

> Lo que **no** depende de estas respuestas se puede arrancar ya: **templates** (bloqueante
> del E2E, es lo primero), **corrección de los `promptIA`**, **helper de detección**,
> sitios #4 y #5, y la preparación de la prueba con Seguro.

---

## Orden sugerido de ejecución

1. **Templates** → los 3 archivos HTML ya están hechos; falta **cargarlos al producto PR-003**
   y activarlos. Desbloquea Fase 4 y el E2E completo — sin esto nada más se puede probar.
2. **`promptIA`** de las fases 1-4 del PR-003 (cambio de texto, sin riesgo).
3. **Helper `tipoOperacion()`** + sitios #4 y #5 (decisión ya tomada).
4. **Tabla de Arrendamiento Financiero** — **desbloqueada**: especificación y caso de prueba
   numérico completos en §3. Se puede implementar en paralelo a los pasos 1-3.
5. **Sitios #2, #3, #6** — en cuanto se decidan facturación y cartera.
6. **Prueba integral con Seguro** y comparativo Puro vs Financiero para Jorge.
