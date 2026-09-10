# HU — REQ-19: Bandeja global de Avisos de Vencimiento 2º Piso + cambio de guía contabilizadora a "GPO-FORMAL-001"

> **Origen:** requerimiento funcional capturado el 31/08/2026.
> Son **dos cambios independientes** que caben en una sola entrega porque tocan
> el mismo producto (*Garantía Financiera 2º Piso*) y ninguno de los dos exige
> modelo de datos nuevo:
>
> 1. Los Avisos de Vencimiento del módulo **Banca 2º Piso** no tienen dónde
>    consultarse de forma transversal, como sí lo tienen los de Crédito.
> 2. La guía contabilizadora de la póliza de formalización deja de ser
>    `APERTURA_LINEA` y pasa a ser **`GPO-FORMAL-001`**.
>
> Continúa a [REQ-18](REQ-18_Banca_2o_Piso_Comisiones_Avisos_Prelacion.md) (que
> creó los avisos GPO) y **modifica** a
> [REQ-16](REQ-16_Poliza_Apertura_Linea_Fase5_Cargos_Solicitud.md) (que definió
> la guía `APERTURA_LINEA`).
> Traducido a alcance técnico contra el código real, no contra el diseño.

---

## Requerimiento original (transcripción, para trazabilidad)

> **1.** Avisos de vencimiento para los registros del módulo de 2º Piso. Así como
> funciona ya, por ejemplo, lo de **Avisos de Vencimiento Créditos**, que ya está
> para ver todo ahí.
>
> **2.** En Solicitud ya se implementó esto, pero hay que cambiarlo:
> *"Generar una póliza contable con base a la guía contabilizadora
> **APERTURA_LINEA**"* — eso era antes. Ahora será este:
> **código: `GPO-FORMAL-001`**, **Evento: "Formalización / Alta de Garantía de
> Pago Oportuno"**, que está definido en la subpestaña *Motor Contable* del
> producto en cuestión o del producto de la solicitud.

---

## Estado de implementación (31/08/2026)

**Código — hecho.** `npm run build` (vite): compila sin errores nuevos.

| Entregable | Dónde | CA |
|---|---|---|
| Cuarta pestaña *Avisos de Vencimiento — 2º Piso* | [CobranzaModule.tsx](../src/app/components/cartera/CobranzaModule.tsx) — tipo de `activeTab`, botón y panel | CA-01…CA-05, CA-08, CA-09 |
| `sub_tipo` importado de donde se escribe, sin duplicar el literal | [CobranzaModule.tsx:6](../src/app/components/cartera/CobranzaModule.tsx#L6) ← [banca2oPisoStore.ts:134](../src/app/components/banca-2o-piso/banca2oPisoStore.ts#L134) | CA-02 |
| Aviso de efecto sobre la prelación al aplicar pago | `handleAplicarPago` en `AvisoForm` | CA-07, RN-03 |
| `EVENT_CODE_FORMALIZACION_GPO` + nombre + lista de alias | [formalizacionCarteraGPO.ts:37-59](../src/app/hooks/formalizacionCarteraGPO.ts#L37-L59) | CA-13, CA-21 |
| `leerGuiaContabilizadora()` acepta `string \| string[]` | [formalizacionCarteraGPO.ts:110-133](../src/app/hooks/formalizacionCarteraGPO.ts#L110-L133) | CA-11, CA-12 |
| Mensajes, `event_code` y `data.evento` con la guía nueva | [formalizacionCarteraGPO.ts:270-325](../src/app/hooks/formalizacionCarteraGPO.ts#L270-L325) | CA-14, CA-15 |
| Comentario del llamador actualizado | [SolicitudCreditoForm.tsx:2767](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L2767) | — |
| Nota de supersesión | [REQ-16](REQ-16_Poliza_Apertura_Linea_Fase5_Cargos_Solicitud.md) | — |

**Decisiones aplicadas:** 1(a) corte limpio con lista de alias · 2 Generación
Contable del aviso de comisión fuera de alcance · 3 pago habilitado **con** la
advertencia de RN-03 · 4 pestaña llamada "Avisos de Vencimiento — 2º Piso".

**Verificado ejecutando el módulo real** (transpilado con esbuild y corrido en
Node contra guías de ejemplo — 22 aserciones, 0 fallas):

- encuentra la guía por **código** `GPO-FORMAL-001` sin pasar argumento, y descarta filas de otros eventos;
- hace match por **nombre del evento**, sin acentos y en mayúsculas ("FORMALIZACION / ALTA DE GARANTIA…");
- **`APERTURA_LINEA` ya no hace match** — el corte de la Decisión 1(a) es real;
- **RN-06:** un código que comparte prefijo (`GPO-FORMAL`, `GPO-FORMAL-0012`) **no** se cuela — la comparación es de igualdad, no substring;
- alias vacíos o `motorContable` nulo devuelven `[]` (no hacen match con todo);
- CA-16 intacto: dos partidas por fila (8001 débito / 8501 crédito), totales cuadrados, cruce con acentos normalizados y degradación cuando no hay Cargo.

**Falta — captura, no código:** ver §Trabajo de captura. Sin el alta del evento y
las filas del Motor Contable, la formalización sigue degradando a póliza sin
desglose y avisando por qué (CA-18).

**Sin verificar contra Supabase:** que la bandeja liste avisos GPO reales
(requiere una línea con comisiones avisadas) y que la columna Inst. Gobierno se
llene para GPO. Es el paso 9 del plan.

---

## Contexto técnico (verificado en código, NO re-investigar)

### Parte 1 — "Avisos de Vencimiento Créditos" es una pestaña de `CobranzaModule`

La bandeja transversal que el requerimiento toma como referencia **no** es
`AvisosVencimientoModule.tsx` (ese es un módulo con datos mock en memoria). Es
[CobranzaModule.tsx](../src/app/components/cartera/CobranzaModule.tsx), que hoy
tiene exactamente tres pestañas, todas instancias del **mismo** componente
parametrizado por `sub_tipo`:

| Pestaña | `subTipoFijo` | Línea |
|---|---|---|
| Avisos de Vencimiento — Créditos | `'Amortizacion'` | [CobranzaModule.tsx:958](../src/app/components/cartera/CobranzaModule.tsx#L958) |
| Facturación — Arrendamiento | `'Arrendamiento'` | [:961](../src/app/components/cartera/CobranzaModule.tsx#L961) |
| Avisos de Aportación — Captación | `'Aportacion'` | [:964](../src/app/components/cartera/CobranzaModule.tsx#L964) |

`AvisosVencimientoPanel`
([:557](../src/app/components/cartera/CobranzaModule.tsx#L557)) ya trae listado,
búsqueda, filtro por estatus, orden, paginación, exportación y el formulario de
detalle con aplicación de pago. **No hay que escribir un panel nuevo: hay que
instanciar el que existe con un cuarto `sub_tipo`.**

### El dato ya está en la base — sólo no tiene dónde verse

REQ-18 ya crea los avisos GPO contra el mismo backend de cartera, con su propio
sub-tipo:

- `SUB_TIPO_COMISION_GPO = 'ComisionGPO'` — [banca2oPisoStore.ts:134](../src/app/components/banca-2o-piso/banca2oPisoStore.ts#L134)
- se envía al crear el aviso — [CalendarioComisionesTab.tsx:169](../src/app/components/banca-2o-piso/CalendarioComisionesTab.tsx#L169)

Es decir: **las filas ya existen en `J_FACTURAS` con `sub_tipo = 'ComisionGPO'`.**

### El backend no necesita ni una línea

`GET /cartera/cobranza` filtra por `sub_tipo` de forma **genérica**, no con una
lista blanca — [index.ts:4468](../supabase/functions/make-server-7e2d13d9/index.ts#L4468):
si llega el parámetro se agrega el `AND f.sub_tipo = ...`, y si no llega no se
filtra. Cualquier sub-tipo nuevo funciona sin desplegar backend.

Y el camino ya está probado por REQ-18: la pestaña Envío Prelación consulta **esa
misma URL con ese mismo sub_tipo** para sumar los avisos pendientes —
[banca2oPisoStore.ts:150](../src/app/components/banca-2o-piso/banca2oPisoStore.ts#L150).

### Lo que ya funciona y NO hay que tocar

`GET /cartera/avisos/:solicitudId`
([index.ts:3905](../supabase/functions/make-server-7e2d13d9/index.ts#L3905)) **no
filtra por `sub_tipo`**, así que la subpestaña *Avisos de Vencimiento* del
detalle de la línea ya muestra los avisos GPO. Lo que falta es sólo la vista
**global**, de todas las líneas.

### Parte 2 — dónde vive hoy `APERTURA_LINEA`

Siete puntos en un solo archivo, más un comentario en el llamador:

| Qué | Dónde |
|---|---|
| La constante | [formalizacionCarteraGPO.ts:32](../src/app/hooks/formalizacionCarteraGPO.ts#L32) |
| Valor por defecto del buscador de guía | [:86](../src/app/hooks/formalizacionCarteraGPO.ts#L86) |
| Lectura de la guía al formalizar | [:228](../src/app/hooks/formalizacionCarteraGPO.ts#L228) |
| Mensaje "el producto no tiene la guía…" | [:239](../src/app/hooks/formalizacionCarteraGPO.ts#L239) |
| Mensaje "la guía existe, pero ningún componente…" | [:245](../src/app/hooks/formalizacionCarteraGPO.ts#L245) |
| `event_code` que se postea a `J_GL_JOURNAL_ENCABEZADO` | [:256](../src/app/hooks/formalizacionCarteraGPO.ts#L256) |
| Etiqueta legible `data.evento` de la póliza | [:286](../src/app/hooks/formalizacionCarteraGPO.ts#L286) |
| Comentario del llamador | [SolicitudCreditoForm.tsx:2767](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L2767) |

### Cómo se hace el match hoy (y por qué el código nuevo encaja)

`leerGuiaContabilizadora()` compara el texto buscado contra `evento.codigo`,
`evento.evento` y `evento.nombre`, **normalizado** (sin acentos, sin mayúsculas)
— [formalizacionCarteraGPO.ts:84-95](../src/app/hooks/formalizacionCarteraGPO.ts#L84-L95).

El catálogo `J_CATALOGO_EVENTOS_CONTABLES` guarda justamente `{ id, codigo,
evento, prompt_ia }` — [EventosContablesSection.tsx:16-21](../src/app/components/configuracion/EventosContablesSection.tsx#L16-L21) —
y el Motor Contable del producto guarda el objeto evento completo
([MotorContableTab.tsx:136](../src/app/components/productos/tabs/MotorContableTab.tsx#L136)).
Por eso `GPO-FORMAL-001` calza como **código** y "Formalización / Alta de
Garantía de Pago Oportuno" calza como **nombre del evento**: son los dos campos
que el matcher ya sabe leer. La normalización sin acentos hace que
"Formalizacion" y "Formalización" sean el mismo texto.

### Riesgo verificado en el backend: el match por substring

El generador contable del servidor NO usa igualdad estricta: además de comparar
código, nombre e id, acepta que uno **contenga** al otro en cualquiera de los dos
sentidos — [index.ts:4917-4924](../supabase/functions/make-server-7e2d13d9/index.ts#L4917-L4924).

Con códigos que comparten prefijo (`GPO-FORMAL` y `GPO-FORMAL-001`, o
`GPO-FORMAL-001` y `GPO-FORMAL-0012`) **una guía puede arrastrar líneas de la
otra**. Ver RN-06.

---

## Historias de usuario

### HU-19.1 — Bandeja global de Avisos de Vencimiento 2º Piso

> **Como** administrador de Banca 2º Piso
> **quiero** ver en un solo lugar todos los avisos de vencimiento de todas las
> líneas de 2º piso
> **para** darles seguimiento de cobro sin entrar línea por línea, igual que se
> hace con los de Crédito.

| CA | Criterio de aceptación |
|---|---|
| CA-01 | En el módulo de Cobranza existe una **cuarta pestaña**: *Avisos de Vencimiento — 2º Piso* (ver §Decisión 4 para el nombre final). |
| CA-02 | Lista **únicamente** los avisos con `sub_tipo = 'ComisionGPO'`; no mezcla Amortización, Arrendamiento ni Aportación. |
| CA-03 | Muestra las mismas columnas que la pestaña de Créditos: No. Docto, F. Compromiso, Tipo, Cliente, Inst. Gobierno, Forma Pago, Moneda, Monto, Estatus y acciones. |
| CA-04 | Conserva búsqueda (No. Docto / Cliente / Referencia), filtro por estatus, orden por fecha, paginación de 10 y exportación — sin reimplementarlas: son las del panel compartido. |
| CA-05 | Abrir un aviso muestra su detalle en modo **Ver** y **Editar** con los mismos subtabs (Default, Detail, Generación Contable). |
| CA-06 | El detalle muestra el desglose de comisiones que originaron el aviso (una línea por periodo de comisión), leído de `J_FACTURAS_DETALLE`. |
| CA-07 | Se puede **aplicar pago** sobre un aviso `Pendiente`, y al aplicarlo el estatus pasa a `Pagado` — mismo flujo y mismo endpoint que Créditos. |
| CA-08 | Si no hay avisos GPO, se muestra el vacío del panel compartido, no una tabla rota ni un error. |
| CA-09 | La pestaña **no altera** el comportamiento de las otras tres: cada panel sigue montándose con su propio `key` y su propio `sub_tipo`. |
| CA-10 | Los avisos GPO siguen viéndose también en la subpestaña *Avisos de Vencimiento* de la línea (comportamiento actual, no debe romperse). |

### HU-19.2 — La póliza de formalización usa la guía "GPO-FORMAL-001"

> **Como** área de Contabilidad
> **quiero** que la póliza que se genera al formalizar la garantía se arme con la
> guía **GPO-FORMAL-001 — Formalización / Alta de Garantía de Pago Oportuno**
> **para** que el asiento corresponda al evento contable que realmente ocurre y
> no a una "apertura de línea".

| CA | Criterio de aceptación |
|---|---|
| CA-11 | Al completar la fase de activación de una Solicitud GPO, el sistema busca en el *Motor Contable* del producto la guía cuyo evento tenga **código `GPO-FORMAL-001`**. |
| CA-12 | También se acepta el match por **nombre del evento**: "Formalización / Alta de Garantía de Pago Oportuno", con o sin acentos y sin distinguir mayúsculas. |
| CA-13 | La póliza se postea con `event_code = 'GPO-FORMAL-001'`. |
| CA-14 | La etiqueta legible de la póliza (`data.evento`) dice **"Formalización / Alta de Garantía de Pago Oportuno"**, no "Apertura de Línea — Garantía Financiera 2o Piso". |
| CA-15 | Los mensajes al usuario nombran la guía nueva: *"El producto no tiene la guía «GPO-FORMAL-001» en su subtab Motor Contable…"*. |
| CA-16 | Se conserva **intacto** todo lo demás de REQ-16: el cruce guía × Cargos por componente contable, la validación de cuadre débito = crédito antes de postear, la omisión de filas sin cargo, el marcado de cargos como `Aplicado` y la degradación a póliza sin desglose. |
| CA-17 | Sigue siendo **una sola** póliza: cambia su contenido, nunca se emiten dos. |
| CA-18 | Sin guía capturada, se mantiene la degradación actual (`event_code = 'APERTURA_GARANTIA_GPO'`, asiento global sin detalle) y se avisa por qué. |
| CA-19 | Las pólizas ya emitidas con `event_code = 'APERTURA_LINEA'` **no se migran ni se regeneran**: quedan como histórico y siguen visibles en el módulo Pólizas Contables. |
| CA-20 | La idempotencia se conserva: una Solicitud que ya tiene `idGarantiaCartera` no vuelve a generar póliza aunque cambie la guía. |
| CA-21 | El evento `GPO-FORMAL-001` está dado de alta en **Configuración → Catálogos Contables → Eventos Contables** con `codigo = 'GPO-FORMAL-001'` y `evento = 'Formalización / Alta de Garantía de Pago Oportuno'`. *(Captura, no código — ver §Trabajo de captura.)* |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | Un aviso GPO pertenece a **una línea** (`solicitud_id`), pero puede agrupar **varias comisiones** del calendario. La bandeja global lista el aviso, no las comisiones. |
| RN-02 | Los estatus válidos de un aviso son los que ya escribe el backend: `Pendiente`, `Pagado`, `Cancelada`. La bandeja no inventa estatus propios. |
| RN-03 | **Efecto cruzado con la prelación:** REQ-18 §RN-05 suma sólo los avisos en estatus `Pendiente`. Aplicar un pago desde esta bandeja **reduce** el monto que tomará la siguiente prelación de esa línea. Es el comportamiento correcto, pero debe ser explícito para el usuario. |
| RN-04 | La bandeja global es **de consulta y cobro**, no de alta: los avisos GPO se siguen originando únicamente desde el Calendario de Comisiones de la línea (REQ-18 CA-08…CA-13), donde vive el control de doble cobro. |
| RN-05 | La guía contabilizadora se busca **siempre** en el Motor Contable del producto de la Solicitud. No se hardcodean cuentas contables en el código. |
| RN-06 | Los códigos de evento contable **no deben ser prefijo unos de otros** (p. ej. `GPO-FORMAL` y `GPO-FORMAL-001`), porque el filtro del backend hace match por substring en ambos sentidos y mezclaría las guías. |
| RN-07 | El cambio de guía aplica **hacia adelante**. La contabilidad ya emitida es inmutable. |

---

## Decisiones pendientes (requieren respuesta antes de implementar)

### Decisión 1 — ¿`APERTURA_LINEA` se conserva como alias?

| Opción | Implicación |
|---|---|
| **(a) Corte limpio: sólo `GPO-FORMAL-001`** (recomendada) | Es lo que pide el requerimiento ("eso era antes"). REQ-16 dejó constancia de que `APERTURA_LINEA` **nunca llegó a capturarse** en ningún producto, así que no hay configuración viva que romper. |
| (b) Aceptar ambos durante una transición | Sólo tiene sentido si alguien ya capturó filas con `APERTURA_LINEA` en el Motor Contable de un producto GPO. **Verificar en Supabase antes de decidir.** |

**Recomendación técnica en cualquiera de los dos casos:** cambiar la constante
única por una **lista de alias** y que `leerGuiaContabilizadora()` acepte
`string | string[]`. Con eso, la opción (b) —hoy o dentro de seis meses— es
agregar un elemento al arreglo, no volver a tocar la lógica. Ese mismo arreglo
resuelve CA-11 y CA-12 de una vez: código y nombre del evento son dos alias del
mismo asiento.

### Decisión 2 — ¿La Generación Contable del aviso GPO entra aquí?

El detalle del aviso tiene un subtab **Generación Contable** que arma partidas
buscando en el Motor Contable por `event_code`. Para un aviso de comisión ese
evento **no es** `GPO-FORMAL-001` (formalizar la garantía ≠ cobrar la comisión).

**Recomendación:** dejarlo **fuera**. Es un evento contable propio (del tipo
`GPO-COM-001` — devengo/cobro de comisión) que Contabilidad todavía no ha
definido, y meterlo aquí obligaría a inventar el código. Se documenta como HU
siguiente.

### Decisión 3 — ¿Se puede aplicar pago desde la bandeja global?

Sale gratis (es el panel compartido), pero tiene el efecto de RN-03 sobre la
prelación.

**Recomendación:** sí, habilitarlo —es exactamente lo que se pide al decir "como
Créditos"— y **advertirlo en el toast de confirmación**: *"Este pago reduce el
monto de comisión de la próxima prelación de la línea."*

### Decisión 4 — Nombre visible de la pestaña

`Avisos de Vencimiento — 2º Piso` (consistente con las otras tres) vs
`Comisiones GPO` (más preciso sobre lo que contiene). **Recomendación:** la
primera, por consistencia con la barra de pestañas existente.

---

## Alcance

**Dentro:**
- Cuarta pestaña en `CobranzaModule` con `subTipoFijo = 'ComisionGPO'`.
- Cambio de la guía contabilizadora a `GPO-FORMAL-001` en el flujo de
  formalización de la Solicitud GPO, incluidos mensajes y etiqueta de la póliza.
- Constante convertida en lista de alias.
- Nota de supersesión en REQ-16.

**Fuera:**
- Backend: no se modifica (el filtro por `sub_tipo` ya es genérico).
- `AvisosVencimientoModule.tsx` (el de datos mock): no se toca.
- Generación Contable del aviso de comisión (Decisión 2).
- Migración de pólizas históricas (RN-07).
- Alta de avisos GPO desde la bandeja global (RN-04).

---

## Trabajo de captura (no es código)

Sin esto, el código nuevo compila y corre, pero degrada a póliza sin desglose:

1. **Configuración → Catálogos Contables → Eventos Contables:** alta de
   `GPO-FORMAL-001` / "Formalización / Alta de Garantía de Pago Oportuno".
2. **Producto GPO → subtab Motor Contable:** filas de la guía, una por componente
   contable, cada una con su cuenta de **débito** y su cuenta de **crédito**.
3. Verificar que los componentes de esas filas **coinciden** con los `tipoCargo`
   de los Cargos que REQ-15 genera en la Solicitud: ese es el puente por el que
   entra el importe de cada partida.

---

## Plan de implementación sugerido

| # | Paso | Archivo |
|---|---|---|
| 1 | Resolver Decisiones 1–4 (y confirmar en Supabase si algún producto ya tiene `APERTURA_LINEA` capturado) | — |
| 2 | Exportar `SUB_TIPO_COMISION_GPO` hacia `CobranzaModule` (o declarar la constante compartida) | [banca2oPisoStore.ts:134](../src/app/components/banca-2o-piso/banca2oPisoStore.ts#L134) |
| 3 | Agregar el botón de pestaña y el `<AvisosVencimientoPanel key="gpo" subTipoFijo="ComisionGPO" …/>` | [CobranzaModule.tsx:930-966](../src/app/components/cartera/CobranzaModule.tsx#L930-L966) |
| 4 | Verificar que la columna Inst. Gobierno se llena para GPO (viene del JOIN a `J_CLIENTES`) y que el detalle no cae en las ramas condicionadas a `'Arrendamiento'` | [CobranzaModule.tsx:570](../src/app/components/cartera/CobranzaModule.tsx#L570), [:98](../src/app/components/cartera/CobranzaModule.tsx#L98) |
| 5 | Cambiar la constante por lista de alias y ampliar la firma de `leerGuiaContabilizadora()` | [formalizacionCarteraGPO.ts:32](../src/app/hooks/formalizacionCarteraGPO.ts#L32), [:84](../src/app/hooks/formalizacionCarteraGPO.ts#L84) |
| 6 | Actualizar los usos restantes: lectura, dos mensajes, `event_code` y `data.evento` | [formalizacionCarteraGPO.ts:228-290](../src/app/hooks/formalizacionCarteraGPO.ts#L228-L290) |
| 7 | Actualizar el comentario del llamador | [SolicitudCreditoForm.tsx:2767](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L2767) |
| 8 | Marcar en REQ-16 que la guía fue sustituida por esta HU | [REQ-16](REQ-16_Poliza_Apertura_Linea_Fase5_Cargos_Solicitud.md) |
| 9 | `tsc --noEmit` + prueba contra datos reales: crear un aviso desde el Calendario de Comisiones y verlo aparecer en la bandeja global | — |

---

## Trazabilidad

| Requerimiento | HU / CA |
|---|---|
| "Avisos de vencimiento para los registros del módulo de 2º Piso" | HU-19.1 · CA-01…CA-10 |
| "Así como funciona ya lo de Avisos de Vencimiento Créditos" | CA-03, CA-04, CA-05, CA-07 |
| "ya está para ver todo ahí" (vista transversal, todas las líneas) | CA-01, CA-02 |
| "APERTURA_LINEA… eso era antes" | CA-13, CA-19, Decisión 1 |
| "código: GPO-FORMAL-001" | CA-11, CA-13, CA-21 |
| "Evento: Formalización / Alta de Garantía de Pago Oportuno" | CA-12, CA-14, CA-21 |
| "definido en la subpestaña Motor Contable del producto de la solicitud" | CA-11, RN-05, §Trabajo de captura |
