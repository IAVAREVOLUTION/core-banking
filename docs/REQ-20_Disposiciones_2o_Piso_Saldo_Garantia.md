# HU — REQ-20: Módulo 2º Piso — Saldo Monto Garantía y subtab Disposiciones

> **Origen:** requerimiento funcional capturado el 31/08/2026.
> **Desbloquea el pendiente declarado en
> [REQ-18](REQ-18_Banca_2o_Piso_Comisiones_Avisos_Prelacion.md) §Bloqueo:** aquel
> dejó CA-24 (escenario *Botón de Pánico*) fuera de alcance precisamente porque
> "Disposiciones es hoy un placeholder sin modelo de datos". Esta HU crea ese
> modelo.
> Se apoya en [REQ-17](REQ-17_Modulo_Banca_2o_Piso.md) (módulo y subpestañas) y en
> [REQ-8](REQ-8_Garantia_Financiera_2o_Piso.md) (producto GPO).
> Traducido a alcance técnico contra el código real.

---

## Requerimiento original (transcripción, para trazabilidad)

> **Módulo de 2º Piso**
>
> En **Términos y Condiciones** dentro del módulo de 2º Piso vamos a agregar un
> campo debajo de *Monto garantizado GPO* que se llame **saldo monto garantía**.
>
> **Subtab Disposiciones**
>
> - *Fecha de solicitud*, sería igual al día de hoy.
> - El *producto* se va a cargar del catálogo del subtab **"Producto disposición"**
>   que está en el módulo de producto, o que tenga configurado ese producto, en el
>   módulo de línea de crédito.
> - El *monto solicitado* lo debe de heredar del **saldo actual de la línea de
>   crédito padre**.
> - *Tipo de persona* lo debe de heredar del tipo de persona de la línea de crédito padre.
> - El *cliente* también lo debe de heredar del cliente de la línea de crédito padre.
> - Campo *descripción* debe permitir capturar una descripción de la solicitud.
> - En Disposiciones vamos a agregar un botón **"Nuevo"** que sea como el de
>   Clientes (Personas), como en el subtab "Solicitudes de crédito".
> - Al crear la disposición, se creará también una **solicitud**, pues sería la
>   misma: en Disposición aparecerá en una lista, y en Solicitud para continuar.
>
> **Solicitud / Originación**
>
> Cuando autorice la solicitud en el proceso de originación, vamos a setear el
> monto de la garantía en **`saldo_actual`** de la BD. Ése es el campo que se va a
> agregar en Términos y Condiciones (punto anterior).

---

## Estado de implementación (31/08/2026)

**Código — hecho.** `npm run build` (vite): compila sin errores nuevos.

| Entregable | Dónde | CA |
|---|---|---|
| `saldo_actual` → `LineaCreditoRow.saldoGarantia` | [banca2oPisoStore.ts](../src/app/components/banca-2o-piso/banca2oPisoStore.ts) | CA-02, CA-03 |
| Fila *Saldo Monto Garantía* bajo Monto garantizado GPO | [Banca2oPisoDetalle.tsx](../src/app/components/banca-2o-piso/Banca2oPisoDetalle.tsx) | CA-01, CA-04 |
| `productosDisposicionDe()` · `vincularDisposicion()` · `lineaPadreDe()` · `sembrarSaldoGarantia()` | `banca2oPisoStore.ts` | CA-09, CA-18, CA-21 |
| `DisposicionesTab.tsx` — lista + botón Nuevo + modal con herencias | [banca-2o-piso/DisposicionesTab.tsx](../src/app/components/banca-2o-piso/DisposicionesTab.tsx) | CA-05…CA-17, CA-19 |
| Placeholder `DisposicionesPendiente` **eliminado** | `Banca2oPisoDetalle.tsx` | CA-05 |
| Siembra del saldo al autorizar | `formalizarGarantiaSiEsGPO` en [SolicitudCreditoForm.tsx](../src/app/components/solicitudes/SolicitudCreditoForm.tsx) | CA-20…CA-26 |
| Activación deja de pisar `saldo_actual` en Línea de Crédito | [index.ts](../supabase/functions/make-server-7e2d13d9/index.ts) | §Conflicto |

**Decisiones aplicadas:** §Conflicto (a) · 1(a) manda `selectBoolean`, con fallback
a todos si nadie marcó · 2(a) `data.solicitud.disposicionDe` · 3 sin descuento de
saldo (fuera de alcance) · 4 monto editable que **advierte** sin bloquear ·
5 estatus inicial `Pendiente`.

**Corrección al plan original:** el paso 8 apuntaba a
`OriginacionModule.tsx:883` (`handleActualizarEstatus`). Al implementar resultó
que **`OriginacionForm` está definido pero nunca se renderiza** — es código
muerto; el módulo monta `SolicitudBaseForm`. La siembra se colocó en
`formalizarGarantiaSiEsGPO`, que es el único punto por el que pasan las **dos**
rutas de activación, ya está acotado a GPO (CA-24), ya calcula el Monto
Garantizado (CA-22) y corre **después** de `crearCuentaDesdeSolicitudDB`. Ese
orden es lo que hace que el valor correcto gane incluso antes de desplegar el
arreglo del backend.

**Verificado ejecutando el módulo real** (esbuild + Node, 21 aserciones, 0 fallas):

- el catálogo respeta `selectBoolean` y cae a "todos" sólo si nadie marcó;
- descarta renglones sin nombre; `undefined`/`null`/`[]` dan lista vacía (CA-10);
- el vínculo al padre se lee del JSONB como objeto, como string y en sus dos rutas, y una solicitud normal devuelve `''` — no se cuela en la lista de otra línea;
- CA-26: monto 0, negativo o `NaN` **no** escriben saldo, y sin id devuelve error explícito.

**Sin verificar contra Supabase:** el alta real de una disposición y la siembra
del saldo end-to-end. Es el paso 10 del plan.

**Falta desplegar:** el cambio en `index.ts` es una Edge Function. Hasta que se
despliegue, el conflicto sigue mitigado sólo por el orden de llamadas.

---

## Contexto técnico (verificado en código, NO re-investigar)

### `saldo_actual` NO es un campo nuevo: ya es columna real

Esto cambia el tamaño del punto 1 y del punto 4. `saldo_actual` existe hoy en
`J_CUENTAS_CORP_CLIENTES` (numeric) y ya se lee y escribe:

| Pieza | Estado | Dónde |
|---|---|---|
| La columna existe en la tabla | ✅ | [index.ts:7254](../supabase/functions/make-server-7e2d13d9/index.ts#L7254) |
| `GET /solicitudes-credito` la devuelve (`SELECT s.*`) | ✅ | [index.ts:3023-3041](../supabase/functions/make-server-7e2d13d9/index.ts#L3023-L3041) |
| `PUT /solicitudes-credito/:id` la acepta y la escribe con `COALESCE` | ✅ | [index.ts:2735](../supabase/functions/make-server-7e2d13d9/index.ts#L2735), [:2763](../supabase/functions/make-server-7e2d13d9/index.ts#L2763) |
| El front la mapea a la fila de la línea | ❌ **falta** | [banca2oPisoStore.ts:400-420](../src/app/components/banca-2o-piso/banca2oPisoStore.ts#L400-L420) |

**Consecuencia:** no hay migración ni endpoint nuevo. Escribir el saldo al
autorizar es un `PUT` que ya existe, y mostrarlo es mapear una columna que ya
viaja en la respuesta.

### ⚠️ Ya hay alguien más escribiendo `saldo_actual`

La activación de cuenta lo pisa **incondicionalmente**:

```
saldo_actual = ${saldoFinal}   // saldoFinal = esCaptacion ? 0 : montoTransaccion
```

[index.ts:3614](../supabase/functions/make-server-7e2d13d9/index.ts#L3614),
escrito en el `UPDATE` de [index.ts:3649](../supabase/functions/make-server-7e2d13d9/index.ts#L3649).

Una línea GPO **no** es captación, así que hoy termina con
`saldo_actual = montoTransaccion`. Si además se escribe el monto garantizado al
autorizar, **el último en correr gana** y el saldo mostrado dependerá del orden
de dos escrituras que nadie coordina. Ver §Conflicto declarado.

### Términos y Condiciones del módulo 2º Piso es de SÓLO LECTURA

[Banca2oPisoDetalle.tsx:415-431](../src/app/components/banca-2o-piso/Banca2oPisoDetalle.tsx#L415-L431)
arma bloques de pares `[etiqueta, valor]` y cierra con el texto *"Vista de sólo
lectura. Los términos se capturan en la Solicitud de origen."*

El bloque **Garantía Financiera 2o Piso** termina hoy así:

```
['Monto garantizado GPO', money(t.montoGarantizadoGpo)],
['Tasa de comisión anual', …],
['Periodicidad de cobro', …],
```

"Agregar un campo debajo de Monto garantizado GPO" es **una fila más en ese
arreglo**, no un input. El valor no se captura: lo escribe la autorización
(HU-20.3) y se lee de la columna.

### El catálogo de "Productos Disposición" ya existe en el producto

El subtab **Productos Disposición** de Línea de Crédito
([ProductoLineaCreditoForm.tsx:591](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx#L591))
se renderiza con `PaquetesTab` y guarda en **`producto.paquetes`**
([:962-964](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx#L962-L964)).

Shape real de cada renglón
([PaquetesTab.tsx:7-16](../src/app/components/productos/tabs/PaquetesTab.tsx#L7-L16)):

```ts
interface Paquete {
  id: number;
  productId: number;              // el producto padre (la línea)
  selectBoolean: boolean;         // la casilla "Sel" de la tabla
  paqueteProductoId: number;      // ← el producto de disposición
  paqueteProductoNombre: string;  // ← lo que va en el combo
  lineaProducto: string;
  sublineaProducto: string;
  tipo: string;                   // 'Seguro' | 'Crédito' | 'Captación' | 'Otro'
}
```

**El combo de Producto de la disposición se llena de aquí.** Ver §Decisión 1 para
el criterio de filtrado.

### El botón "Nuevo" que pide el requerimiento ya está escrito

[clientes/SolicitudesCredito.tsx](../src/app/components/clientes/SolicitudesCredito.tsx)
(401 líneas) es exactamente el modal *"Nueva Solicitud de Crédito"* de Personas:

| Pieza | Dónde |
|---|---|
| Modal y título | [SolicitudesCredito.tsx:295](../src/app/components/clientes/SolicitudesCredito.tsx#L295) |
| Campos del formulario | [:36-50](../src/app/components/clientes/SolicitudesCredito.tsx#L36-L50) — `fechaSolicitud`, `lineaProducto`, `tipoProducto`, `productoId`, `montoSolicitado`, `montoAutorizado`, `plazo`, `periodicidad`, `tasa`, `fechaInicio`, `fechaFin`, `estatusSolicitud` |
| Fecha de hoy por defecto | [:31-34](../src/app/components/clientes/SolicitudesCredito.tsx#L31-L34) `getCurrentDate()` |
| Alta real | `saveSolicitud` de `useSolicitudesDB` — [:56](../src/app/components/clientes/SolicitudesCredito.tsx#L56) |
| Folio | `consumeNoSol()` de `solicitudCreditoStore` — [:7](../src/app/components/clientes/SolicitudesCredito.tsx#L7) |

### Por qué "la disposición y la solicitud son la misma" sale casi gratis

Una Solicitud **es** una fila de `J_CUENTAS_CORP_CLIENTES`. Si la disposición se
da de alta con `saveSolicitud`, aparece en el módulo de Solicitudes **sin
escribir nada más**: la lista de Solicitudes lee esa misma tabla. La subpestaña
Disposiciones no necesita almacenamiento propio — necesita **un filtro** que
recupere las solicitudes hijas de esta línea (§Decisión 2).

### Lo que la fila de la línea ya expone (y lo que no)

`LineaCreditoRow`
([banca2oPisoStore.ts:111-131](../src/app/components/banca-2o-piso/banca2oPisoStore.ts#L111-L131))
ya trae lo necesario para heredar:

| Dato a heredar | ¿Disponible? |
|---|---|
| Cliente | ✅ `cliente`, `clienteId` |
| Tipo de persona | ✅ `tipoPersona` |
| Producto de la línea (para leer sus paquetes) | ✅ `productoId` |
| **Saldo actual** | ❌ **no se mapea** — hay que agregarlo |

### Disposiciones hoy

[Banca2oPisoDetalle.tsx:188](../src/app/components/banca-2o-piso/Banca2oPisoDetalle.tsx#L188)
→ `<DisposicionesPendiente />`, un placeholder que dice literalmente que no hay
modelo de datos. Se sustituye por el nuevo componente.

---

## Historias de usuario

### HU-20.1 — Saldo Monto Garantía en Términos y Condiciones

> **Como** administrador de Banca 2º Piso
> **quiero** ver el saldo vigente de la garantía junto al monto garantizado
> **para** saber cuánto queda disponible sin salir de la línea.

| CA | Criterio de aceptación |
|---|---|
| CA-01 | En el subtab **Términos y Condiciones** del módulo 2º Piso, dentro del bloque *Garantía Financiera 2o Piso*, aparece **Saldo Monto Garantía** inmediatamente **debajo** de *Monto garantizado GPO*. |
| CA-02 | Su valor se lee de la columna **`saldo_actual`** de la línea, con el mismo formato de moneda que las demás filas del bloque. |
| CA-03 | Si la línea todavía no tiene saldo (no ha pasado por autorización), se muestra `—`, no `$0.00`: cero es un saldo agotado y ausente es otra cosa. |
| CA-04 | El campo es **de sólo lectura**, como todo el subtab. No se captura a mano. |

### HU-20.2 — Subtab Disposiciones

> **Como** administrador de Banca 2º Piso
> **quiero** dar de alta disposiciones sobre la línea y verlas listadas
> **para** ejercer la línea sin capturar la solicitud dos veces.

| CA | Criterio de aceptación |
|---|---|
| CA-05 | La subpestaña **Disposiciones** deja de ser un placeholder y muestra la **lista** de disposiciones de esa línea. |
| CA-06 | La lista muestra al menos: No. Solicitud, Fecha, Producto, Cliente, Monto Solicitado, Monto Autorizado, Descripción y Estatus. |
| CA-07 | Hay un botón **Nuevo** que abre un modal, con el mismo formato que el de *Solicitudes de Crédito* en Personas. |
| CA-08 | **Fecha de solicitud** se inicializa con la **fecha de hoy**. |
| CA-09 | El combo **Producto** se llena del catálogo **Productos Disposición** configurado en el producto de la línea (`producto.paquetes`), no del catálogo general de productos. |
| CA-10 | Si el producto de la línea no tiene Productos Disposición configurados, se avisa explícitamente (*"El producto de la línea no tiene Productos Disposición configurados"*) y **no** se deja crear la disposición con un producto arbitrario. |
| CA-11 | **Monto solicitado** se precarga con el **saldo actual de la línea padre** (el mismo valor de CA-02). |
| CA-12 | **Tipo de persona** se hereda de la línea padre y se muestra sin permitir edición. |
| CA-13 | **Cliente** se hereda de la línea padre y se muestra sin permitir edición. |
| CA-14 | Existe un campo **Descripción**, capturable, de texto libre. |
| CA-15 | Al guardar, se crea **una Solicitud real** (misma tabla, mismo alta que el modal de Personas), con su folio consumido del contador. |
| CA-16 | Esa Solicitud aparece **en el módulo de Solicitudes**, en estatus inicial, lista para continuar su flujo. |
| CA-17 | La misma Solicitud aparece **en la lista de Disposiciones** de la línea de la que nació, y no en la de otras líneas. |
| CA-18 | La disposición queda **vinculada a su línea padre** de forma persistente (§Decisión 2). |
| CA-19 | Desde la lista se puede abrir la disposición para continuarla, igual que se abre una Solicitud. |

### HU-20.3 — Al autorizar, sembrar el saldo de la garantía

> **Como** área de Originación
> **quiero** que al autorizar la solicitud quede registrado el monto de la
> garantía como saldo de la línea
> **para** que las disposiciones se calculen contra un saldo real.

| CA | Criterio de aceptación |
|---|---|
| CA-20 | Cuando la solicitud se **autoriza** en el proceso de Originación, se escribe el **monto de la garantía** en la columna `saldo_actual` de esa línea. |
| CA-21 | La escritura usa el `PUT /solicitudes-credito/:id` existente; **no** se agrega endpoint ni columna. |
| CA-22 | El valor escrito es el **Monto Garantizado GPO** de los términos de la solicitud (el mismo que ya lee la formalización). |
| CA-23 | Tras autorizar, el subtab Términos y Condiciones muestra ese valor en *Saldo Monto Garantía* (CA-01) sin pasos manuales. |
| CA-24 | Aplica **sólo a líneas de Garantía Financiera 2º Piso**: ningún otro producto cambia de comportamiento. |
| CA-25 | La operación es **idempotente**: autorizar dos veces no duplica ni acumula el saldo. |
| CA-26 | Si la solicitud no tiene Monto Garantizado GPO capturado, **no se escribe cero**: se deja el saldo como está y se avisa. |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | `saldo_actual` de una línea GPO significa **saldo vigente de la garantía**, no deuda dispuesta. Es el semántico que introduce esta HU y difiere del que usa la activación para crédito simple (§Conflicto). |
| RN-02 | Una disposición **es** una Solicitud. No hay dos entidades ni dos altas: hay una fila y dos vistas de ella. |
| RN-03 | Una disposición nace **siempre** colgada de una línea padre. Una solicitud sin línea padre no es una disposición y no debe aparecer en el subtab. |
| RN-04 | El producto de una disposición **debe** salir del catálogo Productos Disposición del producto de la línea. Es el control que impide disponer con un producto no autorizado para esa línea. |
| RN-05 | Cliente y tipo de persona **no se eligen**: se heredan. Una disposición a nombre de otro cliente no es una disposición de esa línea. |
| RN-06 | El monto solicitado se **precarga** con el saldo, pero el saldo es el techo conceptual de lo que se puede disponer (§Decisión 4 define si además se valida). |
| RN-08 | Mientras la línea no tenga `saldo_actual` sembrado, el Saldo Monto Garantía se **deduce** del Monto Garantizado GPO de sus términos, y la pantalla dice que es una deducción. Ver §Respaldo. |
| RN-07 | El saldo se siembra al **autorizar**, no al crear la solicitud: antes de la autorización no hay garantía que respaldar. |

---

## Respaldo del saldo para las líneas ya autorizadas (RN-08)

**Encontrado al probar contra Supabase (01/09/2026).** Las 4 líneas GPO vivas
tienen `saldo_actual = $0.00` pero `montoGarantizadoGpo = 400,000,000.00`. La
razón es que HU-20.3 siembra el saldo **al autorizar**, y esas líneas se
autorizaron antes de que la siembra existiera. Nada rellena hacia atrás.

Sin respaldo, el efecto visible es que el Saldo Monto Garantía sale en `$0.00` y
el Monto Solicitado de una disposición nueva se precarga en cero — que es
exactamente lo que se reportó.

**Resuelto así:** `resolverSaldoGarantia()` toma la columna cuando está sembrada
y, si no, **deduce** el saldo del Monto Garantizado GPO de los términos de la
propia línea. La UI distingue las dos procedencias en vez de presentarlas igual:

- Términos → *"$400,000,000.00 (según Monto Garantizado — sin registrar en la línea)"*
- Modal de disposición → *"Saldo de la garantía: $400,000,000.00 (Monto Garantizado de la línea)"*

**⚠️ Este respaldo caduca.** Es válido *sólo* mientras nada consuma el saldo: hoy
un 0 únicamente puede significar "nunca se sembró", porque §Decisión 3 dejó la
revolvencia fuera. **Cuando se implemente el descuento por disposición hay que
quitarlo**, porque entonces 0 querrá decir "garantía agotada" y el respaldo la
resucitaría. Está anotado en el código, en el tipo y en la función.

**Alternativa no aplicada:** rellenar `saldo_actual` de esas 4 líneas con un
`UPDATE`. Es una escritura a datos de producción y no se hizo sin autorización
explícita; el respaldo deja la pantalla correcta sin tocar la BD.

---

## ⚠️ Conflicto declarado — dos escrituras sobre `saldo_actual`

Es el riesgo principal de esta HU y **debe resolverse antes de implementar
HU-20.3**.

Hoy, al activar la cuenta, el backend escribe sin condición
([index.ts:3614](../supabase/functions/make-server-7e2d13d9/index.ts#L3614) y
[:3649](../supabase/functions/make-server-7e2d13d9/index.ts#L3649)):

- **Captación** → `saldo_actual = 0`
- **Todo lo demás, incluida una línea GPO** → `saldo_actual = montoTransaccion`

Si HU-20.3 escribe el monto garantizado al autorizar y después corre la
activación, **la activación lo pisa**. El síntoma sería un *Saldo Monto Garantía*
que aparece correcto y se corrompe solo minutos después, que es la peor clase de
bug: intermitente y dependiente del orden.

| Opción | Implicación |
|---|---|
| **(a) Excluir GPO del `saldoFinal` de la activación** (recomendada) | Una condición en el backend: si la línea es Garantía Financiera 2º Piso, no tocar `saldo_actual` (o usar el monto garantizado). Deja un solo dueño del campo por producto. Requiere desplegar la Edge Function. |
| (b) Escribir el saldo GPO **después** de la activación | No toca backend, pero deja la corrección amarrada al orden de dos llamadas del front. Frágil. |
| (c) Guardar el saldo de garantía en el JSONB, no en la columna | Elimina el conflicto por completo, pero **contradice el requerimiento**, que pide explícitamente `saldo_actual`. |

**Recomendación:** (a). Es la única que deja el campo con un dueño único y
sobrevive a que alguien reordene las llamadas del front.

---

## Decisiones pendientes (requieren respuesta antes de implementar)

### Decisión 1 — Qué renglones de `producto.paquetes` alimentan el combo

El shape trae `selectBoolean` (la casilla "Sel") y `tipo`
(`Seguro | Crédito | Captación | Otro`). Hay tres lecturas posibles:

| Opción | Criterio |
|---|---|
| **(a) Sólo los que tienen `selectBoolean = true`** (recomendada) | La casilla existe justamente para marcar cuáles aplican. Si ninguno está marcado, se cae a "todos" en vez de dejar el combo vacío. |
| (b) Todos los renglones del subtab | Ignora la casilla, que entonces no tendría propósito. |
| (c) Filtrar además por `tipo = 'Crédito'` | Correcto si una disposición siempre es un crédito; hay que confirmarlo con negocio. |

### Decisión 2 — Dónde vive el vínculo disposición → línea padre

| Opción | Implicación |
|---|---|
| **(a) En el JSONB de la disposición** (recomendada) | `data.solicitud.disposicionDe = <id de la línea>`. Sin migración; la lista filtra por ese campo. Sigue el patrón de `banca2oPiso` (REQ-18) y de `terminos_condiciones._raw`. |
| (b) Usar `no_referenc1` de la tabla | Es una columna real, pero ya la usa la activación para otra cosa ([index.ts:3255](../supabase/functions/make-server-7e2d13d9/index.ts#L3255)): reutilizarla mezcla dos significados. |
| (c) Tabla `J_DISPOSICIONES` | Correcto si una disposición llegara a ser algo distinto de una Solicitud. Hoy el propio requerimiento dice que "es la misma", así que sobra. |

**Cuidado al implementar (a):** aplicar la guarda por valor *truthy* al escribir
el JSONB, no `!== undefined`, para no repetir el borrado silencioso documentado
en `useSolicitudesDB.ts:399` (mismo tropiezo que advirtió REQ-18 §Decisión 2).

### Decisión 3 — ¿La disposición descuenta el saldo de la línea?

El requerimiento **no lo dice**, y es la pregunta que sigue naturalmente: si el
monto solicitado se hereda del saldo, ¿autorizar una disposición de 30 M sobre
una línea de 100 M deja el saldo en 70 M?

**Recomendación:** sí, pero **fuera de esta entrega**. Es una HU propia (control
de revolvencia) con sus propias reglas: qué pasa con pagos, con cancelaciones y
con disposiciones rechazadas. Meterlo aquí sin definir esas tres cosas produce un
saldo que se desvía en silencio.

### Decisión 4 — ¿El monto solicitado se valida contra el saldo?

¿El saldo heredado es sólo un valor por defecto editable, o además un tope que se
valida al guardar?

**Recomendación:** por defecto **editable**, y **advertir** —no bloquear— si
excede el saldo, hasta que la Decisión 3 defina la mecánica de revolvencia.
Bloquear con un saldo que todavía no se descuenta produciría falsos rechazos.

### Decisión 5 — Estatus inicial de la disposición

`SolicitudesCredito` arranca en `'Pendiente'`
([:47](../src/app/components/clientes/SolicitudesCredito.tsx#L47)).
**Recomendación:** el mismo, para que caiga en la bandeja de Originación como
cualquier otra solicitud y siga el flujo normal (CA-16).

---

## Alcance

**Dentro:**
- Fila *Saldo Monto Garantía* en Términos y Condiciones + mapeo de `saldo_actual` a `LineaCreditoRow`.
- Subtab Disposiciones: lista, botón Nuevo, modal con herencias y descripción.
- Alta que crea la Solicitud real y la vincula a la línea padre.
- Escritura de `saldo_actual` al autorizar en Originación.
- Resolución del conflicto de escritura (§Conflicto, opción recomendada).

**Fuera:**
- Descuento del saldo al disponer / revolvencia (Decisión 3).
- Validación bloqueante de monto contra saldo (Decisión 4).
- Amortizaciones, pagos o contabilidad de la disposición.
- CA-24 de REQ-18 (*Botón de Pánico*): esta HU crea el modelo que le faltaba,
  pero conectarlo es trabajo de aquella — ver §Trazabilidad.

---

## Plan de implementación sugerido

| # | Paso | Archivo |
|---|---|---|
| 1 | Resolver §Conflicto y Decisiones 1–5 | — |
| 2 | Mapear `saldo_actual` → `LineaCreditoRow.saldoGarantia` | [banca2oPisoStore.ts:400](../src/app/components/banca-2o-piso/banca2oPisoStore.ts#L400) |
| 3 | Agregar la fila al bloque GPO de Términos, debajo de Monto garantizado | [Banca2oPisoDetalle.tsx:419](../src/app/components/banca-2o-piso/Banca2oPisoDetalle.tsx#L419) |
| 4 | Leer `producto.paquetes` del producto de la línea para el combo | nuevo helper en `banca2oPisoStore.ts` |
| 5 | `DisposicionesTab.tsx` — lista + botón Nuevo + modal, calcado de `SolicitudesCredito` | `banca-2o-piso/` |
| 6 | Alta con `saveSolicitud` + sello del vínculo al padre (Decisión 2) | mismo |
| 7 | Sustituir `<DisposicionesPendiente />` | [Banca2oPisoDetalle.tsx:188](../src/app/components/banca-2o-piso/Banca2oPisoDetalle.tsx#L188) |
| 8 | Escribir `saldo_actual` al autorizar, sólo para GPO | [OriginacionModule.tsx:883](../src/app/components/originacion/OriginacionModule.tsx#L883) `handleActualizarEstatus` |
| 9 | Aplicar la opción (a) del §Conflicto en la activación | [index.ts:3614](../supabase/functions/make-server-7e2d13d9/index.ts#L3614) — **requiere desplegar la Edge Function** |
| 10 | Verificar contra datos reales: autorizar una línea, ver el saldo, crear una disposición y encontrarla en Solicitudes | — |

---

## Trazabilidad

| Requerimiento | HU / CA |
|---|---|
| "Campo saldo monto garantía debajo de Monto garantizado GPO" | HU-20.1 · CA-01…CA-04 |
| "Fecha de solicitud igual al día de hoy" | CA-08 |
| "Producto del catálogo del subtab Producto disposición" | CA-09, CA-10, RN-04, Decisión 1 |
| "Monto solicitado heredado del saldo actual de la línea padre" | CA-11, RN-06 |
| "Tipo de persona heredado" | CA-12, RN-05 |
| "Cliente heredado" | CA-13, RN-05 |
| "Campo descripción" | CA-14 |
| "Botón Nuevo como el de Clientes / Solicitudes de crédito" | CA-07 |
| "Al crear la disposición se creará también una solicitud, es la misma" | CA-15, CA-16, CA-17, RN-02 |
| "En disposición aparecerá en una lista y en solicitud para continuar" | CA-16, CA-19 |
| "Al autorizar, setear el monto de la garantía en saldo_actual" | HU-20.3 · CA-20…CA-26 |
| Riesgo no planteado en el requerimiento | §Conflicto declarado |
| REQ-18 CA-24 quedó bloqueado por falta de Disposiciones | Esta HU crea el modelo; conectarlo sigue siendo de REQ-18 |
