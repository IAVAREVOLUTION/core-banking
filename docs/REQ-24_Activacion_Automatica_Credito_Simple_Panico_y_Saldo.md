# HU — REQ-24: Solicitud de Activación automática del Crédito Simple, Botón de Pánico y descuento del saldo de garantía

> **Origen:** requerimiento capturado el 01/09/2026 sobre el producto
> *Crédito Simple 2° Piso*, la disposición que cuelga de la línea GPO.
>
> **Cierra dos pendientes que quedaron declarados por escrito:**
> - [REQ-20](REQ-20_Disposiciones_2o_Piso_Saldo_Garantia.md) §Decisión 3 dejó
>   fuera el descuento del saldo al disponer, con la nota *“es una HU propia
>   (control de revolvencia)”*. **Ésta es esa HU.**
> - [REQ-18](REQ-18_Banca_2o_Piso_Comisiones_Avisos_Prelacion.md) CA-24 dejó el
>   escenario *Botón de Pánico* bloqueado por falta de Disposiciones. Aquí se
>   define **quién** enciende ese sub-status.
>
> Se apoya en [REQ-23](REQ-23_Pagare_Credito_Simple_2o_Piso_Validacion_IA_Por_Fase.md)
> (liberación del crédito simple) y en la subpestaña *Cuenta(s) Beneficiaria(s)*.

---

## Requerimiento original (transcripción, para trazabilidad)

> En módulo de **Sol. Activación**, cuando se cree de forma automática, cuando se
> libera el flujo del crédito simple. Generar una solicitud de activación, esos
> datos los debes tomar de **cuentas beneficiarias**.
>
> Cuando se **active** el producto de crédito simple, tengo que cambiar el
> sub-estatus a **botón de pánico** y **restar el monto** de ese crédito simple
> **al saldo de la garantía** de la línea de crédito.
>
> El flujo es similar al de **crédito simple OK**.

---

## Estado de implementación (01/09/2026)

**Aplicado — build limpio.** 11 aserciones sobre la lógica central, 0 fallas.

| Entregable | Dónde | CA |
|---|---|---|
| `crearActivacionDispersion()` — alta programática desde una Cuenta Beneficiaria | [useSolicitudesActivacionDB.ts](../src/app/hooks/useSolicitudesActivacionDB.ts) | CA-02…CA-05 |
| Alta automática al liberar, una por cuenta, idempotente y bloqueante si falla | [SolicitudCreditoForm.tsx](../src/app/components/solicitudes/SolicitudCreditoForm.tsx) (rama de cierre) | CA-01, CA-06…CA-10 |
| `aplicarDisposicionALinea()` — pánico + descuento en un solo PUT, idempotente | [banca2oPisoStore.ts](../src/app/components/banca-2o-piso/banca2oPisoStore.ts) | CA-11…CA-21 |
| `aplicarActivacionDisposicion()` — entrada desde Sol. Activación | mismo | CA-11, CA-18 |
| Enganche en `handleActivar` (estatus `Pagado`, §Decisión 5) | [SolicitudActivacionForm.tsx](../src/app/components/solicitudes-activacion/SolicitudActivacionForm.tsx) | CA-11, CA-17 |
| Rastro del pánico (`panicoDesde`, `panicoPorDisposicion`) | `banca2oPisoStore.ts` | CA-16 |
| Escenario **Botón de Pánico** desbloqueado en Envío Prelación | [EnvioPrelacionTab.tsx](../src/app/components/banca-2o-piso/EnvioPrelacionTab.tsx) | §Decisión 3(a) · REQ-18 CA-24 |

**Decisiones aplicadas:** 1(a) una activación por cuenta · 2 rastro en el nodo
`banca2oPiso` · **3(a)** se desbloqueó el escenario de pánico · 4 se descuenta el
**Monto Autorizado** de la disposición · 5 el disparador es el estatus `Pagado`.

### Desviación deliberada en CA-22 (mejor que lo especificado)

La HU mandaba **eliminar** el respaldo de REQ-20 y sembrar a mano el saldo de las
4 líneas vivas. Eliminarlo a secas las habría dejado en `$0.00` —o sea, *garantía
agotada*— hasta que alguien corriera esa siembra: un intervalo en el que la línea
rechazaría disposiciones legítimas.

En su lugar se usó el discriminador que antes no existía: **`disposicionesAplicadas`**.

- Línea **sin** disposiciones aplicadas y saldo 0 → nadie lo sembró; el respaldo sigue siendo la lectura correcta.
- Línea **con** disposiciones aplicadas y saldo 0 → **garantía agotada**, y se muestra como tal.

Se cumple el efecto que exigía CA-22 —nunca se muestra crédito disponible donde
ya se consumió— sin romper los datos vigentes y sin depender de una corrección
manual previa. **§Riesgo de datos queda mitigado, no pendiente.**

### Sobre el escenario de pánico (REQ-18 CA-24)

Ya se calcula: el renglón *Crédito de Recuperación* toma la suma de las
disposiciones aplicadas a la línea. **Con una salvedad anotada en el código:**
hoy el “Saldo” de una disposición **es** su monto dispuesto, porque todavía no
existe amortización sobre las disposiciones. Cuando se implementen sus pagos,
`sumarDisposicionesActivas()` debe leer el saldo insoluto real.

Si la línea está en pánico pero no tiene disposiciones aplicadas, **no se
genera**: el renglón saldría en $0.00 y se confundiría con un dato real.

**Verificado ejecutando el módulo real (11/11):** el respaldo sigue vigente para
una línea nunca sembrada y **desaparece** en cuanto hay consumo; un saldo parcial
manda sobre ambos; la suma del escenario de pánico es correcta y tolera nodos
vacíos; y las guardas rechazan disposición sin línea padre, sin id o con monto 0.

**Sin probar contra Supabase:** el ciclo completo liberar → activar → ver el
saldo bajar y la línea en pánico.

---

## Contexto técnico (verificado en código, NO re-investigar)

### El alta automática ya tiene precedente

Hoy la Solicitud de Activación se crea **a mano**: el usuario abre
`SolicitudActivacionModal` desde la Solicitud
([SolicitudCreditoForm.tsx:4539](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L4539))
y el modal se siembra con términos y simulación.

Pero **ya existe una ruta programática**: `crearFacturaProveedorActivacion()`
([useSolicitudesActivacionDB.ts:90](../src/app/hooks/useSolicitudesActivacionDB.ts#L90)),
que es como Arrendamiento da de alta su cuenta por pagar sin intervención
manual. Ése es el molde a reusar — no hay que inventar backend.

### Qué campos necesita y de dónde salen ahora

`SolicitudActivacionFormData`
([solicitudActivacionStore.ts:12-50](../src/app/components/solicitudes-activacion/solicitudActivacionStore.ts#L12-L50))
pide, entre otros: `cliente`, `cuentaBancaria`, `montoTransaccion`, `moneda`,
`formaDePago`, `institucionFinanciera`, `referencia`.

La subpestaña **Cuenta(s) Beneficiaria(s)** ya guarda exactamente eso, por cuenta:

```ts
{ clienteId, beneficiario, banco, cuentaClabe, numeroCuenta, moneda,
  cuentaSwift, pais, montoDispersion }
```

**Consecuencia:** el mapeo es directo. `montoTransaccion` sale de
`montoDispersion` —que a su vez se sembró con el Monto Autorizado— y la cuenta
destino de `cuentaClabe` / `numeroCuenta`.

### El vínculo con la línea padre ya existe

REQ-20 §Decisión 2(a) sella la disposición con
`data.solicitud.disposicionDe = <id de la línea>`, y `lineaPadreDe()`
([banca2oPisoStore.ts](../src/app/components/banca-2o-piso/banca2oPisoStore.ts))
lo lee. **Sin ese vínculo no habría a qué línea restarle el saldo**; con él, el
descuento es una lectura y un `PUT`.

### El saldo y el sub-status ya tienen dónde vivir

| Dato | Dónde | Escritura |
|---|---|---|
| Saldo de la garantía | columna `saldo_actual` | `sembrarSaldoGarantia()` (REQ-20) — `PUT /solicitudes-credito/:id` |
| Sub-Status de la línea | `data.solicitud.banca2oPiso.subEstatus` | `guardarBanca2oPiso()` (REQ-18) |

`SubEstatus2oPiso = 'Operación Normal' | 'Botón de Pánico'`
([banca2oPisoStore.ts:61](../src/app/components/banca-2o-piso/banca2oPisoStore.ts#L61)).
No hay que crear el campo ni el enum: hay que **encenderlo desde un evento**.

---

## ⚠️ Dos consecuencias que el requerimiento no plantea

### 1. El respaldo del saldo de REQ-20 **caduca con esta HU**

REQ-20 dejó `resolverSaldoGarantia()` deduciendo el saldo del *Monto Garantizado*
cuando `saldo_actual` viene en 0, y anotó la condición de caducidad:

> *“⚠️ El respaldo es válido **sólo** mientras nada consuma el saldo. Cuando se
> implemente el descuento por disposición hay que quitarlo, porque entonces 0
> querrá decir «garantía agotada» y el respaldo la resucitaría.”*

**Esta HU es ese momento.** Si se implementa el descuento sin quitar el respaldo,
una línea que se consuma por completo volverá a mostrar su Monto Garantizado
íntegro — es decir, **mostrará crédito disponible donde ya no lo hay**. Es el
riesgo más grave de la entrega y no es visible en pantalla.

### 2. Encender *Botón de Pánico* **apaga** el Envío Prelación

`EnvioPrelacionTab` bloquea ese escenario a propósito
([EnvioPrelacionTab.tsx:74](../src/app/components/banca-2o-piso/EnvioPrelacionTab.tsx#L74)):
con Sub-Status en pánico, *Generar Prelación* responde *“Botón de Pánico
pendiente”* y no genera, para no producir importes falsos (REQ-18 CA-24).

Entonces: **activar un crédito simple dejaría a la línea sin poder generar
prelación**. Ver §Decisión 3.

---

## Historias de usuario

### HU-24.1 — Solicitud de Activación automática al liberar el crédito simple

> **Como** área de operación
> **quiero** que al liberar el crédito simple se cree su Solicitud de Activación
> **para** no recapturar a mano datos que ya están en el expediente.

| CA | Criterio de aceptación |
|---|---|
| CA-01 | Al liberar el flujo del crédito simple (última fase, *Liberación*), se crea automáticamente una **Solicitud de Activación**. |
| CA-02 | Sus datos se toman de la subpestaña **Cuenta(s) Beneficiaria(s)** de esa solicitud. |
| CA-03 | `montoTransaccion` = **Monto Dispersión** de la cuenta beneficiaria. |
| CA-04 | La cuenta destino (CLABE / número de cuenta), el banco y la moneda salen de esa misma cuenta. |
| CA-05 | El beneficiario registrado en la cuenta viaja como titular de la activación, no el titular de la solicitud (pueden diferir — REQ del drop list de Beneficiario). |
| CA-06 | Si hay **varias** cuentas beneficiarias, se genera una activación **por cuenta**, cada una por su Monto Dispersión (§Decisión 1). |
| CA-07 | Si **no** hay cuentas beneficiarias capturadas, **no se libera**: se avisa que faltan, en vez de crear una activación sin destino. |
| CA-08 | Es **idempotente**: liberar dos veces no crea activaciones duplicadas. |
| CA-09 | La activación nace en estatus `Pendiente`, igual que una capturada a mano, y aparece en el módulo **Sol. Activación** para continuarse. |
| CA-10 | Si la creación falla, la liberación **no** se reporta como exitosa en silencio: se dice qué pasó. |

### HU-24.2 — Al activar, la línea pasa a Botón de Pánico

> **Como** administrador de Banca 2º Piso
> **quiero** que activar un crédito simple ponga la línea en Botón de Pánico
> **para** que la cascada de pagos refleje que la garantía se está ejerciendo.

| CA | Criterio de aceptación |
|---|---|
| CA-11 | Al **activarse** el crédito simple (estatus de la activación → `Pagado`/activada), el Sub-Status de la **línea padre** cambia a **`Botón de Pánico`**. |
| CA-12 | La línea padre se localiza por `data.solicitud.disposicionDe` de la disposición. |
| CA-13 | El cambio se **persiste** en `data.solicitud.banca2oPiso.subEstatus` y sobrevive a recargar. |
| CA-14 | Si la disposición no tiene línea padre, **no** se cambia nada y se reporta: cambiar el modo de operación de una línea equivocada es peor que no cambiarlo. |
| CA-15 | El cambio es idempotente: una línea ya en pánico se queda en pánico, sin registrar dos veces. |
| CA-16 | Queda registro de **qué disposición** encendió el pánico y cuándo (§Decisión 2). |

### HU-24.3 — El monto dispuesto se resta del saldo de la garantía

> **Como** administrador de Banca 2º Piso
> **quiero** que lo dispuesto se descuente del saldo de la garantía
> **para** saber cuánto queda realmente disponible en la línea.

| CA | Criterio de aceptación |
|---|---|
| CA-17 | Al activarse el crédito simple, el **monto de esa disposición** se resta del `saldo_actual` de la línea padre. |
| CA-18 | El monto que se resta es el **Monto Autorizado** de la disposición (§Decisión 4). |
| CA-19 | El saldo resultante se muestra en *Términos y Condiciones* → **Saldo Monto Garantía** (REQ-20 CA-01) sin pasos manuales. |
| CA-20 | El descuento es **idempotente**: reactivar o reintentar no vuelve a restar. |
| CA-21 | El saldo **no baja de cero**: si lo dispuesto excede lo disponible, se detiene y se reporta, en vez de dejar un saldo negativo. |
| CA-22 | **Se elimina el respaldo de REQ-20** (`resolverSaldoGarantia` deduciendo del Monto Garantizado): a partir de aquí un 0 significa garantía agotada y debe mostrarse como tal. |
| CA-23 | Las líneas cuyo `saldo_actual` nunca se sembró se identifican y corrigen **antes** de activar (§Riesgo de datos). |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | El saldo de la garantía **sólo** se consume al **activarse** la disposición, no al crearla ni al autorizarla. Antes de eso no hay dinero ejercido. |
| RN-02 | Una disposición se descuenta **una sola vez**. La idempotencia no es un detalle técnico: un doble descuento reduce el crédito disponible del cliente. |
| RN-03 | No se dispersa a una cuenta que el expediente del cliente no conoce: la activación se arma con Cuentas Beneficiarias, que a su vez salen de Cuentas Bancarias. |
| RN-04 | El beneficiario puede **no** ser el titular de la línea (por eso existe el drop list de Beneficiario alimentado de Personas Relacionadas). |
| RN-05 | *Botón de Pánico* es un atributo de la **línea**, no de la disposición (REQ-18 RN-06): una sola disposición activada cambia el modo de toda la línea. |
| RN-06 | Un saldo en 0 significa **garantía agotada**, no “sin capturar”. Esta regla entra en vigor con esta HU y deroga el respaldo de REQ-20. |

---

## Decisiones pendientes (requieren respuesta antes de implementar)

### Decisión 1 — Varias cuentas beneficiarias

| Opción | Implicación |
|---|---|
| **(a) Una activación por cuenta** (recomendada) | Cada cuenta tiene su propio destino y monto; es lo que ya modela la subpestaña. Tesorería paga cada una por separado. |
| (b) Una sola activación por el total | Más simple, pero pierde el destino: no se sabría a qué cuenta va cada parte. |

### Decisión 2 — Dónde queda el rastro del pánico

**Recomendación:** en el mismo nodo `banca2oPiso`, junto al sub-status:
`{ subEstatus, panicoDesde: <fecha>, panicoPorDisposicion: <id> }`. Sin
migración, y responde “¿por qué esta línea está en pánico?”, que es la primera
pregunta que hará cualquiera al verla.

### Decisión 3 — ¿Qué pasa con el Envío Prelación tras el pánico?

Encender el pánico deja la prelación bloqueada (§Consecuencia 2).

| Opción | Implicación |
|---|---|
| **(a) Implementar CA-24 de REQ-18 en esta entrega** (recomendada) | Ahora **sí** hay modelo de datos: las disposiciones existen y tienen monto. Faltaría definir su `Saldo` insoluto y `Estatus crédito` para sumar “los Créditos Simples activos”. Sin esto, la línea queda en un modo que no puede operar. |
| (b) Encender el pánico y dejar la prelación bloqueada | Cumple el requerimiento literal, pero deja la línea sin poder instruir pagos justo cuando más se necesita. |

**Hay que decidirlo antes de implementar HU-24.2**: es la diferencia entre un
sub-status informativo y uno operativo.

### Decisión 4 — Qué monto se resta

Monto Autorizado de la disposición, Monto Dispersión de la cuenta beneficiaria, o
la suma de sus cuentas. Normalmente coinciden, pero el usuario puede editar el
Monto Dispersión.

**Recomendación:** el **Monto Autorizado** de la disposición (CA-18), porque es lo
que la institución se obligó a prestar. Y **validar** que la suma de las cuentas
beneficiarias cuadre antes de liberar — la subpestaña ya muestra la diferencia,
aquí se vuelve bloqueante.

### Decisión 5 — Qué evento cuenta como “activado”

¿La activación pasa a `Pagado` en el módulo Sol. Activación, o la cuenta del
crédito simple queda `Activa`? **Recomendación:** el estatus `Pagado` de la
Solicitud de Activación, que es el momento en que el dinero salió — coherente con
RN-01 y con el patrón que ya usa Arrendamiento para cerrar su flujo.

---

## ⚠️ Riesgo de datos — líneas sin saldo sembrado

Las 4 líneas GPO vivas tienen `saldo_actual = $0.00` con Monto Garantizado de
$400,000,000 (verificado en REQ-20). Hoy se ven bien **gracias al respaldo** que
CA-22 manda quitar.

Si se quita el respaldo sin sembrar el saldo, esas líneas pasarán a mostrar
**$0.00 = garantía agotada** y no admitirán disposiciones. **Hay que sembrarles
el saldo antes de desplegar esta HU.** Es una escritura puntual sobre 4
registros, no una migración.

---

## Alcance

**Dentro:** alta automática de la Solicitud de Activación desde Cuentas
Beneficiarias; cambio de Sub-Status a Botón de Pánico al activar; descuento del
saldo de la garantía; retiro del respaldo de REQ-20.

**Fuera:**
- Reposición del saldo (pagos, cancelaciones, prepagos): esta HU sólo **resta**.
  Cómo se devuelve el saldo es otra HU.
- El escenario Botón de Pánico del Envío Prelación, salvo que se acepte la
  Decisión 3(a).
- Dispersión real del dinero: sigue siendo Tesorería en el módulo Sol. Activación.

---

## Plan de implementación sugerido

| # | Paso | Archivo |
|---|---|---|
| 1 | Resolver Decisiones 1–5 (la 3 es la que más cambia el alcance) | — |
| 2 | Sembrar `saldo_actual` en las líneas vivas (§Riesgo de datos) | — |
| 3 | Alta automática de Sol. Activación desde Cuentas Beneficiarias, al liberar | [SolicitudCreditoForm.tsx](../src/app/components/solicitudes/SolicitudCreditoForm.tsx) (rama de cierre) + [useSolicitudesActivacionDB.ts](../src/app/hooks/useSolicitudesActivacionDB.ts) |
| 4 | Helper `aplicarDisposicionALinea(disposicionId)`: pánico + descuento, idempotente | `banca2oPisoStore.ts` |
| 5 | Enganchar ese helper al evento de activación (Decisión 5) | módulo Sol. Activación |
| 6 | Quitar el respaldo de `resolverSaldoGarantia` (CA-22) | `banca2oPisoStore.ts` |
| 7 | Verificar contra datos reales: liberar, activar, ver el saldo bajar y la línea en pánico | — |

---

## Trazabilidad

| Requerimiento | HU / CA |
|---|---|
| "Cuando se libera el flujo del crédito simple, generar una solicitud de activación" | HU-24.1 · CA-01, CA-09 |
| "Esos datos los debes tomar de cuentas beneficiarias" | CA-02…CA-05 |
| "Cambiar el subestatus a botón de pánico" | HU-24.2 · CA-11…CA-16 |
| "Restar el monto al saldo de la garantía de la línea de crédito" | HU-24.3 · CA-17…CA-21 |
| "El flujo es similar al de crédito simple OK" | §Contexto — se reusa el molde de `crearFacturaProveedorActivacion` |
| REQ-20 §Decisión 3 (descuento diferido) | HU-24.3 |
| REQ-20 §Respaldo — condición de caducidad | CA-22, RN-06, §Riesgo de datos |
| REQ-18 CA-24 (escenario pánico bloqueado) | §Consecuencia 2, Decisión 3 |
