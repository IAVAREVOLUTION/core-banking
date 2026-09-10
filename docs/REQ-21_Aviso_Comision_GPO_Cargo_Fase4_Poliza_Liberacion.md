# HU — REQ-21: Conceptos del Aviso GPO, cargo de Fase 4 y póliza al liberar la línea

> **Origen:** requerimiento funcional capturado el 01/09/2026 sobre el producto
> *Garantía Financiera 2o Piso*.
> Ajusta tres piezas ya construidas: el aviso de comisión de
> [REQ-18](REQ-18_Banca_2o_Piso_Comisiones_Avisos_Prelacion.md), la copia
> automática de cargos de
> [REQ-15](REQ-15_Cargos_Automaticos_GPO_Componentes_Contables.md) y la póliza de
> formalización de [REQ-19](REQ-19_Avisos_2o_Piso_Bandeja_Global_y_Evento_GPO-FORMAL-001.md).
> Verificado contra la configuración **real** del producto en Supabase
> (`14ce6b66-5e77-4296-ba86-3b6cd0c11f6f`), no contra el diseño.

---

## Requerimiento original (transcripción, para trazabilidad)

> Cuando genero el **aviso de vencimiento** solamente se tiene que generar con los
> siguientes campos *(imagen 1: los cargos «Comisión GPO — Comisión de Garantía de
> Pago Oportuno» e «IVA Comisión GPO — IVA de la Comisión»)*.
>
> Cuando se **autoriza la fase 4**, se genera este cargo *(imagen 2: «Provisionamiento
> de Garantía — Provisión de Garantía de Pago Oportuno»)*.
>
> Cuando se **libera la línea**, hay que generar una póliza contable.

---

## Estado de implementación (01/09/2026)

**Código — hecho.** `npm run build` (vite): compila sin errores nuevos.

| Entregable | Dónde | CA |
|---|---|---|
| Módulo que separa los momentos del catálogo de Cargos | [lib/cargosProductoGPO.ts](../src/app/lib/cargosProductoGPO.ts) | CA-04, CA-13 |
| `conceptos` propios en el Aviso (backend intacto) | [CalendarioComisionesTab.tsx](../src/app/components/banca-2o-piso/CalendarioComisionesTab.tsx) | CA-01…CA-09 |
| Campo `conceptos` en el tipo `Amortizacion` | [useCarteraDB.ts](../src/app/hooks/useCarteraDB.ts) | CA-01 |
| Fase 4 copia **sólo** los cargos de su momento | [SolicitudCreditoForm.tsx](../src/app/components/solicitudes/SolicitudCreditoForm.tsx) | CA-10…CA-16 |
| Campo **Momento** en el catálogo de Cargos del producto | [CargoTab.tsx](../src/app/components/productos/tabs/CargoTab.tsx) | CA-13 |

**Decisiones aplicadas:** 1(a) campo `momento` **con respaldo (b)** por Motor
Contable · 2 sin inventar nombres: si no se resuelven, no se emite el aviso ·
3(a) la póliza de liberación es `GPO-FORMAL-001`, ya implementada · 4 sin
migración · 5 devengo/cobro automáticos fuera de alcance.

### HU-21.3 no requirió desarrollo — se verificó

Confirmada la Decisión 3(a): la fase 5 (*ACTIVACIÓN DE LÍNEA 2o PISO*, área
LIBERACIÓN) ya dispara `formalizarGarantiaSiEsGPO` → `GPO-FORMAL-001` desde
REQ-19. Ejecutado el módulo real contra el Motor Contable **real** del producto y
un cargo de Provisionamiento por el Monto Garantizado:

```
guía GPO-FORMAL-001 encontrada: 1 fila
partidas: 2 | débito: 400,000,000 | crédito: 400,000,000
  8101-01-001 | D: 400,000,000.00 | Provisionamiento de Garantía
  8101-02-001 | C: 400,000,000.00 | Provisionamiento de Garantía
```

Cumple CA-18 a CA-23 sin tocar código. Las pólizas viejas salieron con
`APERTURA_GARANTIA_GPO` y 0 partidas porque se autorizaron antes de REQ-19 y de
la captura de la guía.

**Verificado ejecutando los módulos reales** contra la configuración real del
producto en Supabase — 27 aserciones en el módulo de cargos + 9 en el de póliza,
0 fallas:

- con los 3 cargos reales y **sin** `momento` capturado, Fase 4 devuelve **un solo cargo**: Provisionamiento (criterio `motor-contable`) — el defecto queda cerrado sin recapturar el catálogo;
- si se captura `momento`, la configuración explícita gana sobre el motor;
- un producto sin `momento` y sin motor conserva el comportamiento histórico de REQ-15, y el usuario recibe aviso de que no se pudo distinguir;
- los conceptos del Aviso salen **exactos**: `Comisión GPO` / *Comisión de Garantía de Pago Oportuno* e `IVA Comisión GPO` / *IVA de la Comisión*, y coinciden con los componentes del Motor Contable (RN-01);
- sin catálogo resoluble devuelve `null` y el aviso **no se emite** (§Decisión 2);
- el detalle trae exactamente 2 renglones, sin Capital/Seguro/IVA Seguro, y con IVA en 0 sale sólo la comisión (CA-08).

**Sin verificar contra Supabase:** emitir un aviso real y ver los renglones en
`J_FACTURAS_DETALLE`, y autorizar una línea nueva para ver la póliza
`GPO-FORMAL-001` emitida. Son los pasos 6 y 7 del plan.

**Pendiente operativo (§Decisión 4):** las Solicitudes que ya recibieron los tres
cargos **no se corrigieron**; hay que limpiarlas a mano antes de liberar esas
líneas.

---

## Contexto técnico (verificado en código y en datos reales, NO re-investigar)

### Lo que el producto GPO tiene capturado hoy

Consultado en Supabase el 01/09/2026:

**Cargos (`data.cargo`) — son 3, no 1 ni 2:**

| Tipo de Cargo | Descripción | Línea / Sublínea |
|---|---|---|
| Provisionamiento de Garantía | Provisión de Garantía de Pago Oportuno | Linea Credito / Simple |
| Comisión GPO | Comisión de Garantía de Pago Oportuno | Linea Credito / Simple |
| IVA Comisión GPO | IVA de la Comisión | Linea Credito / Simple |

**Fases — la 5 es la liberación:**

| Seq | Fase | Área |
|---|---|---|
| 4 | VALIDACIÓN DE CLÁUSULAS FIDUCIARIAS. | ANÁLISIS |
| 5 | ACTIVACIÓN DE LÍNEA 2o PISO. | **LIBERACIÓN** |

**Motor Contable — los 3 eventos ya están capturados:**

| Código | Evento | Componente | Débito | Crédito |
|---|---|---|---|---|
| `GPO-FORMAL-001` | Formalización / Alta de GPO | Provisionamiento de Garantía | 8101-01-001 | 8101-02-001 |
| `DEVENGO_COMISION_GPO` | Devengo de la comisión GPO | Comisión GPO | 1405-01-001 | 5105-01-001 |
| `DEVENGO_COMISION_GPO` | Devengo de la comisión GPO | IVA Comisión GPO | 1405-01-001 | 2105-01-001 |
| `COBRO_COMISION_GPO` | Cobro de la comisión de GPO | Comisión GPO | 1101-0001 | 1405-01-001 |
| `COBRO_COMISION_GPO` | Cobro de la comisión de GPO | IVA Comisión GPO | 1101-0001 / 2105-01-001 | 1405-01-001 / 2103-001 |

**Los tres cargos son exactamente los componentes contables de esos eventos.** Ése
es el puente por el que REQ-16 arma el detalle de la póliza: cruza cargo ×
componente. Los nombres del requerimiento no son etiquetas cosméticas — son la
llave del asiento.

### Punto 1 — hoy el aviso sale con los nombres equivocados

`CalendarioComisionesTab` mapea la comisión a la forma `Amortizacion`
([CalendarioComisionesTab.tsx:151-164](../src/app/components/banca-2o-piso/CalendarioComisionesTab.tsx#L151-L164)):
`pago_interes` = comisión, `iva_interes` = IVA, todo lo demás en 0.

El backend, al no recibir conceptos propios, cae al desglose clásico de crédito
([index.ts:4146-4152](../supabase/functions/make-server-7e2d13d9/index.ts#L4146-L4152)):

```
CAPITAL · INTERES · IVA_INT · SEGURO · IVA_SEG   (filtrando monto > 0)
```

Resultado real: el aviso GPO nace con dos renglones llamados **“Interés”** e
**“IVA Interés”**. Son los importes correctos con los nombres de otro producto, y
—peor— **no coinciden con ningún componente contable**, así que no pueden cruzar
con `DEVENGO_COMISION_GPO` ni con `COBRO_COMISION_GPO`.

**El backend ya sabe hacer lo que se pide.** La misma función acepta conceptos
propios y los usa tal cual cuando la amortización trae `conceptos`
([index.ts:4138-4145](../supabase/functions/make-server-7e2d13d9/index.ts#L4138-L4145)) —
es el camino que ya usa Arrendamiento:

```ts
{ cve, desc, monto }   // se insertan uno a uno en J_FACTURAS_DETALLE
```

**Consecuencia: el punto 1 es un cambio de front, sin tocar backend.**

### Punto 2 — ya existe la copia, pero ahora copia de más

REQ-15 engancha en `saliendoDeClausulasFiduciarias`
([SolicitudCreditoForm.tsx:1073](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1073))
y copia **todos** los cargos del producto, cada uno con monto = Monto Garantizado
GPO ([:1163](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1163)).

Cuando REQ-15 se escribió, el producto no tenía cargos capturados (su propia nota
decía *“Falta — captura”*). **Hoy tiene tres.** Ver §Defecto activo.

### Punto 3 — la póliza al liberar ya está construida (probablemente)

"Liberar la línea" = la fase 5, **ACTIVACIÓN DE LÍNEA 2o PISO, área LIBERACIÓN**.
Es exactamente donde REQ-19 dispara `formalizarGarantiaSiEsGPO` →
`GPO-FORMAL-001`, y el producto **ya tiene esa guía capturada** con sus cuentas
8101-01-001 / 8101-02-001 sobre el componente *Provisionamiento de Garantía*.

**Evidencia de por qué todavía no se ha visto funcionar:** las 4 líneas GPO vivas
generaron pólizas con `event_code = APERTURA_GARANTIA_GPO` y **0 partidas** — es
decir, la degradación “sin guía” de REQ-16. Se autorizaron entre el 26 y el 31 de
agosto, **antes** de que existieran REQ-19 y la captura de la guía. Una
autorización nueva ya debería emitir `GPO-FORMAL-001` con desglose.

Ver §Decisión 3: hay que confirmar si la póliza que se pide es ésta o una distinta.

### Hallazgo colateral: la contabilidad de la comisión hoy es manual

Existe una póliza `COBRO_COMISION_GPO` del 01/09/2026 por **$1,740,000.00** —el
mismo importe del renglón de comisión de la última prelación—. Ni
`COBRO_COMISION_GPO` ni `DEVENGO_COMISION_GPO` aparecen en el código: esa póliza
se capturó **a mano** desde la subpestaña *Generación Contable* del aviso. Los
eventos están configurados y operan, pero nadie los dispara automáticamente.

### Dos formas distintas de guardar el mismo desglose

| Camino | Dónde queda el detalle |
|---|---|
| Automático (REQ-16/19, `formalizarGarantiaGPO`) | `data.Detalle` dentro del JSONB de la póliza |
| Manual (*Generación Contable*) | Filas en la tabla `J_GL_JOURNAL_DETALLE` ([index.ts:5087-5088](../supabase/functions/make-server-7e2d13d9/index.ts#L5087-L5088)) |

No es un problema para esta HU, pero cualquier reporte que sume partidas tiene que
mirar **los dos** lados. Se documenta para que no sorprenda.

---

## ⚠️ Defecto activo — Fase 4 va a generar tres cargos de $400,000,000

**Esto ya está roto en producción, con o sin esta HU**, y es lo más urgente del
requerimiento.

REQ-15 copia *todos* los cargos del producto y le pone a cada uno el Monto
Garantizado GPO. Con los tres cargos capturados, autorizar la Fase 4 hoy produce:

| Cargo creado en la Solicitud | Monto | ¿Correcto? |
|---|---|---|
| Provisionamiento de Garantía | $400,000,000 | ✅ es lo que pide el requerimiento |
| Comisión GPO | $400,000,000 | ❌ la comisión es ~$1.74 M por periodo, no el monto garantizado |
| IVA Comisión GPO | $400,000,000 | ❌ ídem |

Las consecuencias no se quedan en la pantalla de Cargos:

1. La póliza `GPO-FORMAL-001` cruza cargos por componente
   (`construirDetallePoliza`). Sólo tiene fila para *Provisionamiento*, así que
   los otros dos quedarían fuera del asiento — pero **visibles como cargos
   Pendientes por $400 M cada uno**.
2. Si algún día se captura una guía que sí tenga esos componentes, entrarían al
   asiento con un importe cuatrocientas veces mayor al real.
3. REQ-19 marca como `Aplicado` sólo lo que entró al asiento: los dos cargos
   erróneos quedan Pendientes para siempre, ensuciando el subtab.

**El requerimiento resuelve esto al decir “cuando se autoriza la fase 4, se genera
*este* cargo” (uno, no tres).** Ver Decisión 1 sobre cómo distinguirlos.

---

## Historias de usuario

### HU-21.1 — El Aviso de Vencimiento sale con los conceptos de la comisión GPO

> **Como** administrador de Banca 2º Piso
> **quiero** que el aviso se genere sólo con los conceptos de comisión GPO e IVA
> **para** que el documento diga lo que realmente se cobra y pueda contabilizarse.

| CA | Criterio de aceptación |
|---|---|
| CA-01 | Al generar el aviso desde el Calendario de Comisiones, su detalle tiene **exactamente dos renglones**: uno de comisión y uno de IVA. |
| CA-02 | El primero se llama **“Comisión GPO”**, con descripción **“Comisión de Garantía de Pago Oportuno”**. |
| CA-03 | El segundo se llama **“IVA Comisión GPO”**, con descripción **“IVA de la Comisión”**. |
| CA-04 | Los nombres se leen del subtab **Cargos del producto**, no se escriben fijos en el código (§Decisión 2). |
| CA-05 | No aparecen renglones de Capital, Seguro ni IVA de Seguro, ni siquiera en 0. |
| CA-06 | Los importes no cambian: comisión e IVA son los mismos que ya calcula el Calendario (REQ-18 RN-02/RN-03). |
| CA-07 | Al seleccionar varios periodos, cada aviso conserva sus dos renglones (no se mezclan periodos en un mismo renglón). |
| CA-08 | Si un periodo tiene IVA en 0 (producto exento), el aviso sale sólo con el renglón de comisión, sin un IVA en cero. |
| CA-09 | Los nombres coinciden **carácter por carácter** con los componentes contables del Motor Contable, para que crucen con `DEVENGO_COMISION_GPO` y `COBRO_COMISION_GPO`. |

### HU-21.2 — La Fase 4 genera sólo el cargo de Provisionamiento

> **Como** área de Análisis
> **quiero** que al autorizar la Fase 4 se cree únicamente el cargo de
> Provisionamiento de Garantía
> **para** que la Solicitud no arrastre cargos de comisión con el monto de la garantía.

| CA | Criterio de aceptación |
|---|---|
| CA-10 | Al autorizar la Fase 4 (*Validación de Cláusulas Fiduciarias*), se crea el cargo **“Provisionamiento de Garantía”** con descripción **“Provisión de Garantía de Pago Oportuno”**. |
| CA-11 | Su monto es el **Monto Garantizado GPO** de Términos y Condiciones (comportamiento actual de REQ-15). |
| CA-12 | **No** se crean cargos de “Comisión GPO” ni “IVA Comisión GPO” en Fase 4. |
| CA-13 | El criterio para saber qué cargo corresponde a Fase 4 es **configurable en el producto**, no una lista de nombres en el código (§Decisión 1). |
| CA-14 | Se conserva la idempotencia de REQ-15: reautorizar la fase no duplica el cargo. |
| CA-15 | Si el producto no tiene ningún cargo que aplique a Fase 4, se avisa y no se bloquea el avance de fase (comportamiento actual). |
| CA-16 | Las Solicitudes que ya recibieron los tres cargos **no se corrigen solas**; se documenta cómo limpiarlas (§Decisión 4). |

### HU-21.3 — Póliza contable al liberar la línea

> **Como** área de Contabilidad
> **quiero** que al liberar la línea se emita su póliza
> **para** registrar el alta de la garantía sin captura manual.

| CA | Criterio de aceptación |
|---|---|
| CA-17 | Al completar la fase **ACTIVACIÓN DE LÍNEA 2o PISO** (área LIBERACIÓN) se genera una póliza contable automáticamente. |
| CA-18 | La póliza se arma desde la guía del Motor Contable del producto, sin cuentas fijas en el código. |
| CA-19 | Con la guía `GPO-FORMAL-001` capturada, la póliza sale con **desglose por componente** (partidas > 0), no como asiento global. |
| CA-20 | El importe de la partida sale del cargo **Provisionamiento de Garantía** creado en Fase 4 (HU-21.2) — el puente cargo × componente de REQ-16. |
| CA-21 | Se emite **una sola** póliza por liberación: reliberar o reintentar no produce una segunda (idempotencia de REQ-19 CA-20). |
| CA-22 | Si la guía no está capturada, se conserva la degradación actual con aviso explícito, en vez de fallar en silencio. |
| CA-23 | El asiento **cuadra** antes de postear; si no, no se emite y se reporta (comportamiento de REQ-16). |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | Los nombres de los conceptos del aviso **no son cosméticos**: son la llave que cruza con el componente contable. Cambiarlos en el producto sin cambiarlos en el Motor Contable rompe la contabilización. |
| RN-02 | Un cargo del producto es una **plantilla de concepto**, no un importe: el producto no guarda montos (REQ-15). |
| RN-03 | No todos los cargos del producto son de Fase 4. El catálogo sirve a tres momentos distintos: provisión (Fase 4), comisión e IVA (aviso de cada periodo). |
| RN-04 | La comisión de un periodo **no** es el Monto Garantizado. Confundirlos es el defecto que documenta §Defecto activo. |
| RN-05 | El IVA en 0 no se factura: un renglón en cero no aporta al documento y ensucia el cobro (consistente con REQ-16, que omite partidas sin importe). |
| RN-06 | La póliza de liberación se emite **una vez por línea**. El histórico de pólizas es inmutable. |

---

## Decisiones pendientes (requieren respuesta antes de implementar)

### Decisión 1 — Cómo se distingue el cargo de Fase 4 de los del aviso

Es la decisión central: hoy el shape del cargo del producto es
`{ id, productId, lineaProducto, sublinea, tipoCargo, descripcion, moneda }` — **no
tiene ningún campo que diga en qué momento aplica**.

| Opción | Implicación |
|---|---|
| **(a) Agregar al cargo del producto un campo “Momento/Evento”** (recomendada) | Un select con `Fase 4 — Provisión`, `Aviso de comisión`, etc. Es configuración, sobrevive a que cambien los nombres y sirve para futuros momentos. Requiere tocar `CargoTab` y el shape. |
| (b) Deducirlo del Motor Contable | El cargo cuyo componente esté en la guía `GPO-FORMAL-001` es el de Fase 4; los que estén en `DEVENGO/COBRO_COMISION_GPO` son del aviso. **Cero captura nueva** y ya refleja la intención contable, pero acopla los cargos al motor y falla si el motor no está capturado. |
| (c) Lista de nombres en el código | Rápido y frágil: se rompe con un acento o un espacio de más. Contradice CA-13. |

**Recomendación: (a)**, con **(b) como respaldo** mientras nadie haya capturado el
campo nuevo — así el defecto activo se cierra sin esperar a la recaptura del
catálogo.

### Decisión 2 — De dónde toma el aviso los nombres de sus conceptos

CA-04 pide que salgan del producto. ¿Y si no están capturados?

**Recomendación:** buscar en el catálogo de Cargos del producto los dos conceptos
por su componente contable (Decisión 1(b)); si no aparecen, **no** inventar
nombres genéricos: avisar que faltan, igual que se hace con la guía contabilizadora
(REQ-19 CA-15). Un aviso con nombres inventados es peor que uno que no se emite,
porque se cobra y no se puede contabilizar.

### Decisión 3 — ¿La póliza de liberación es `GPO-FORMAL-001` o un evento nuevo?

Fase 5 es *ACTIVACIÓN DE LÍNEA 2o PISO / LIBERACIÓN*, y ahí REQ-19 ya emite
`GPO-FORMAL-001`. Dos lecturas:

| Opción | Implicación |
|---|---|
| **(a) Es la misma póliza** (recomendada) | El punto 3 ya está implementado; sólo faltaba que la guía estuviera capturada, y **ya lo está**. La verificación consiste en autorizar una línea nueva y comprobar que sale `GPO-FORMAL-001` con partidas, no `APERTURA_GARANTIA_GPO` con 0. |
| (b) Es un evento distinto | Entonces hace falta su código, su nombre y sus cuentas en el Motor Contable — hoy no existe ninguno más que los tres ya capturados. |

**Hay que confirmarlo con negocio antes de escribir código:** si es (a), HU-21.3
no requiere desarrollo, sólo prueba.

### Decisión 4 — Qué hacer con las Solicitudes que ya recibieron los 3 cargos

**Recomendación:** dejar que se limpien a mano desde el subtab Cargos (son pocas y
el borrado ya existe), y **no** escribir una migración: un borrado automático de
cargos sobre datos de producción es más riesgoso que el problema que resuelve.
Conviene revisarlas antes de liberar esas líneas.

### Decisión 5 — ¿El aviso debe además detonar el devengo contable?

El Motor Contable ya tiene `DEVENGO_COMISION_GPO` y `COBRO_COMISION_GPO`
capturados y operando **a mano**. El requerimiento no lo pide.

**Recomendación:** dejarlo **fuera** de esta HU, pero anotarlo: con HU-21.1 los
conceptos del aviso por fin cruzarán con esos componentes, que es el prerrequisito
para automatizarlo. Sería una HU corta y de valor inmediato.

---

## Alcance

**Dentro:**
- Conceptos propios en el aviso de comisión GPO (front; el backend ya los acepta).
- Filtrado del cargo que aplica a Fase 4, con el criterio de la Decisión 1.
- Verificación de la póliza de liberación (y desarrollo sólo si la Decisión 3 resulta ser (b)).

**Fuera:**
- Automatizar `DEVENGO_COMISION_GPO` y `COBRO_COMISION_GPO` (Decisión 5).
- Unificar `data.Detalle` con `J_GL_JOURNAL_DETALLE`.
- Limpieza automática de los cargos ya generados (Decisión 4).

---

## Plan de implementación sugerido

| # | Paso | Archivo |
|---|---|---|
| 1 | Resolver Decisiones 1–5 (la 3 es la que más ahorra trabajo) | — |
| 2 | Enviar `conceptos: [{cve, desc, monto}]` en la amortización del aviso | [CalendarioComisionesTab.tsx:151](../src/app/components/banca-2o-piso/CalendarioComisionesTab.tsx#L151) |
| 3 | Helper que resuelve los conceptos del aviso desde los Cargos del producto | `banca2oPisoStore.ts` |
| 4 | Filtrar los cargos que aplican a Fase 4 antes de copiarlos | [SolicitudCreditoForm.tsx:1163](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1163) |
| 5 | Si aplica Decisión 1(a): campo “Momento” en el cargo del producto | [CargoTab.tsx](../src/app/components/productos/tabs/CargoTab.tsx) |
| 6 | Probar la liberación de una línea nueva y verificar `GPO-FORMAL-001` con partidas | — |
| 7 | Revisar las Solicitudes con cargos de más antes de liberarlas | — |

---

## Trazabilidad

| Requerimiento | HU / CA |
|---|---|
| "El aviso sólo con estos campos" (imagen 1) | HU-21.1 · CA-01…CA-09 |
| "Comisión GPO / Comisión de Garantía de Pago Oportuno" | CA-02 |
| "IVA Comisión GPO / IVA de la Comisión" | CA-03 |
| "Al autorizar la fase 4 se genera este cargo" (imagen 2) | HU-21.2 · CA-10…CA-16 |
| "Provisionamiento de Garantía / Provisión de Garantía de Pago Oportuno" | CA-10 |
| "Cuando se libera la línea, generar una póliza contable" | HU-21.3 · CA-17…CA-23, Decisión 3 |
| Riesgo no planteado en el requerimiento | §Defecto activo (3 cargos de $400 M) |
