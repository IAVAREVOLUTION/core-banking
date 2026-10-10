# HU — REQ-27: Cierre de Corte de la Línea de Crédito — CxC, Factura y Aviso de Vencimiento

> **Origen:** ESPECIFICACIÓN 3, capturada el 15/09/2026. Continúa la cadena de
> [REQ-26](REQ-26_Movimientos_TDC_Prewrite_Cargos_Permitidos.md): aquella genera
> los Cargos de la Línea; ésta los agrupa por periodo de corte, los ordena por
> Prelación y los convierte en una Cuenta por Cobrar exigible.
> Contexto técnico verificado contra el código; los vacíos y las ambigüedades
> están marcados como tales, no resueltos por cuenta propia.

---

## Requerimiento original (resumen, para trazabilidad)

> Implementar un submódulo **Cierre de Corte** dentro de la operación de la
> Línea de Crédito, que genere la **Cuenta por Cobrar**, la **Factura** y el
> **Aviso de Vencimiento** de los Cargos pendientes del periodo:
>
> 1. Determinar el periodo de corte · 2. Obtener los Cargos pendientes ·
> 3. Ordenarlos por la Prelación del Taller de Producto · 4. Generar la CxC en
> Cobranza · 5. Generar su detalle · 6. Monto Total a Pagar · 7. Monto Mínimo a
> Pagar · 8. Fecha Límite de Pago · 9. Cambiar los Cargos de *Pendiente* a
> *Procesado* · 10. Todo de forma transaccional.
>
> El periodo se propone desde el **DiaCorte**: con `DiaCorte = 20`, el corte de
> septiembre 2026 va del **21/08/2026 al 20/09/2026**. Los movimientos del
> 21/09 en adelante son del siguiente periodo. La ejecución física ocurre
> después del cierre operativo del día 20.
>
> Se procesan sólo los Cargos con `bCargo ∈ (S, Y)` y `Estatus = Pendiente`
> dentro del periodo, usando la **fecha financiera** (contable/valor), nunca
> `CreatedDate`. `FechaDocumento = FechaInicio`; `FechaVencimiento` se calcula
> con el parámetro de Fecha Límite de Pago sobre `FechaFin`. Ningún valor se
> hardcodea: DiaCorte, producto, reglas de pago, prelación y días límite salen
> de la configuración.
>
> El **OrdenPrelacion** debe conservarse en el detalle de la CxC porque la
> ESPECIFICACIÓN 4 lo usará para aplicar los pagos. Si un concepto no tiene
> Prelación configurada, se cancela el proceso con rollback y mensaje
> controlado. Ningún Cargo puede quedar en *Procesado* si la CxC o su detalle
> no se crearon correctamente.

*(La especificación completa, con sus 44 apartados, es la fuente normativa; este
documento la traduce a historias verificables contra el sistema real.)*

---

## Contexto técnico verificado (15/09/2026) — no re-investigar

### El mecanismo de CxC + Factura + Aviso YA existe — hay que reutilizarlo

La especificación §15 pide no construir un mecanismo paralelo. No hace falta:

| Pieza | Dónde | Lo que se verificó |
|---|---|---|
| Alta de CxC / Factura / Aviso | `POST /cartera/facturas` vía [crearFacturaArrendamientoCobranza()](../src/app/hooks/useCarteraDB.ts) | Recibe `solicitud_id`, `cliente`, `conceptos[]`, `total`, `fecha_compromiso`, `referencia`, `moneda` y `tipo: 'Por Cobrar'`. El backend crea el encabezado en `J_FACTURAS` y **una línea de `J_FACTURAS_DETALLE` por concepto**. |
| Vehículo de los conceptos | `Amortizacion.conceptos[]` — `{ cve, desc, monto }` | Es el camino que ya usan Arrendamiento (REQ-6) y el Aviso GPO (REQ-21) para emitir documentos con conceptos propios **sin tocar el backend**. Es exactamente lo que necesita el detalle de la CxC. |
| Estatus del documento | `Amortizacion.estatus` | Ciclo ya existente: `Pendiente` → `Facturada` → `Pagada`. |
| Avisos de Vencimiento | [AvisosVencimientoTab.tsx](../src/app/components/cartera/AvisosVencimientoTab.tsx) + panel de [CobranzaModule.tsx](../src/app/components/cartera/CobranzaModule.tsx) | El Aviso se alimenta del mismo documento; no es una entidad aparte. |

**Consecuencia de diseño:** el Cierre de Corte no inventa una CxC. Arma el
arreglo de `conceptos[]` en orden de Prelación y llama al servicio existente.

### Dónde viven realmente DiaCorte, Regla de Pago Mínimo y Fecha Límite (§44.3)

La especificación dice "configurado en la Línea de Crédito". En este sistema
existen **dos niveles**, y eso cambia de dónde hay que leerlos:

| Dato | Nivel producto — `J_PRODUCTOS.data.reglasPagoCorteTDC` | Nivel instancia — subtab *Condiciones de la Tarjeta* de la Solicitud |
|---|---|---|
| Día de corte | `diaCorte` | `diaCorte` |
| Días para fecha límite | `diasFechaLimitePago` | `diasParaPago` |
| Ajuste por día inhábil | `ajusteDiaInhabil` | — |
| Método de pago mínimo | `pagoMinimoMetodo` | `pagoMinimoMetodo` |
| % base del pago mínimo | `pagoMinimoPorcentajeBase` | `pagoMinimoPorcentaje` |
| Monto mínimo absoluto | `pagoMinimoMontoAbsoluto` | `pagoMinimoMonto` |
| Agregar saldo vencido | `pagoMinimoAgregarSaldoVencido` | — |
| Conceptos del pago mínimo | `pagoMinimoConceptos[]` | — |

Ambos se construyeron en [ReglasPagoCorteTDCTab.tsx](../src/app/components/productos-linea-credito/ReglasPagoCorteTDCTab.tsx)
y [CondicionesTarjetaTab.tsx](../src/app/components/solicitudes/tabs/CondicionesTarjetaTab.tsx).
El de instancia **hereda del producto** al seleccionarlo, y es el que refleja lo
pactado con el cliente (§Decisión 2).

### Hay DOS configuraciones de Prelación — hay que elegir (§10, §11)

| Configuración | Dónde | Forma |
|---|---|---|
| **Prelación de cargos** | subtab del producto, [PrelacionTab.tsx](../src/app/components/productos/tabs/PrelacionTab.tsx) → `data.prelacionCargos` | `{ ordenAplicacion, productosCargos }` — el concepto se guarda por **nombre** |
| **Orden de aplicación de pagos** | dentro de *Reglas de Pago y Corte TDC* → `reglasPagoCorteTDC.ordenAplicacionPagos` | `{ seq, concepto }` — específico de TDC |

La especificación describe la primera ("Taller de Producto → Prelación", buscada
por `IdProducto`). La segunda es más específica del producto tarjeta. Decidir
cuál gobierna es la **Decisión 3**; ambas existen y ninguna es obviamente la
correcta sin negocio.

### Lo que NO existe todavía — precondiciones

| Vacío | Impacto |
|---|---|
| **`J_CARGOS_LINEA` no tiene `estatus` ni `cxc_id`** <span>🔴</span> | La tabla creada en [create_rpc_movimiento_tdc.sql](../supabase/migrations/create_rpc_movimiento_tdc.sql) guarda `clave, nombre, naturaleza, monto, fecha, b_factura`. Sin `estatus` no hay *Pendiente → Procesado* (§30) y sin `cxc_id` no hay relación Cargo→CxC (§29) ni la verificación de idempotencia de §33. Es **HU-27.0**. |
| **`bCargo` no se persiste en el Cargo** <span>🟠</span> | En REQ-26 el renglón sólo se crea cuando `bCargo = 'S'`, así que el filtro de §8.1 es hoy implícito. Para poder auditarlo y normalizarlo (§8.2) conviene guardar el valor. |
| **No hay `fecha_contable` / `fecha_valor`** <span>🟠</span> | El Cargo guarda una sola `fecha` (la del movimiento). §6 exige explícitamente **no** usar la fecha de creación. Hay que decidir si esa `fecha` es la financiera o se agrega una (§Decisión 4). |
| **La migración de REQ-26 no está aplicada** <span>🔴</span> | Las tres tablas (`J_MOVIMIENTOS_LINEA`, `J_SALDOS_LINEA`, `J_CARGOS_LINEA`) existen sólo como SQL en el repo. Sin correrla, no hay Cargos que cortar. |
| **No existe entidad de bitácora de cierre** <span>🟠</span> | §40 pide `IdCierreCorte` y 15 campos de trazabilidad. Hay que crear `J_CIERRES_CORTE`. |

---

## Historias de usuario

### HU-27.0 — El Cargo puede tener estatus y quedar ligado a su CxC

> **Como** Core Bancario, **quiero** que cada Cargo registre su estatus y la CxC que lo procesó, **para** poder cortarlo una sola vez y saber en qué documento quedó.

| # | Criterio de aceptación |
|---|---|
| CA-01 | `J_CARGOS_LINEA` tiene `estatus` (`Pendiente` \| `Procesado` \| `Cancelado`), con default `Pendiente`. |
| CA-02 | Tiene `cxc_id` nullable, con índice, que referencia el documento generado. |
| CA-03 | Tiene `b_cargo` con el valor original del producto, para poder auditar el filtro de §8.1. |
| CA-04 | Existe una restricción que impide que un mismo Cargo quede ligado a dos CxC distintas. |
| CA-05 | Los Cargos creados por REQ-26 nacen en `Pendiente`. |

### HU-27.1 — El submódulo propone el periodo de corte

> **Como** operador, **quiero** abrir el Cierre de Corte de una Línea y que el periodo venga propuesto, **para** no calcularlo a mano ni equivocarme de rango.

| # | Criterio de aceptación |
|---|---|
| CA-06 | Existe el submódulo **Cierre de Corte** dentro de la Línea de Crédito, con `IdLineaCredito` como contexto. |
| CA-07 | La pantalla captura al menos `IdLineaCredito`, `FechaInicio` y `FechaFin`. |
| CA-08 | `FechaFin` se propone como el **DiaCorte del mes en proceso** (RN-01). |
| CA-09 | `FechaInicio` se propone como el **día siguiente al corte del mes anterior**: con `DiaCorte = 20`, el corte de sep-2026 propone `21/08/2026 – 20/09/2026`. |
| CA-10 | El `DiaCorte` se lee de la configuración; **no** se hardcodea el 20 ni ningún otro valor. |
| CA-11 | Si el mes no tiene el día configurado (p. ej. 31 en febrero), se usa el último día del mes. |
| CA-12 | El usuario puede ajustar ambas fechas antes de ejecutar. |

### HU-27.2 — Sólo entran los cargos del periodo

> **Como** responsable de cartera, **quiero** que el corte tome exactamente los cargos del periodo, **para** que ninguno se cobre dos veces ni se quede fuera.

| # | Criterio de aceptación |
|---|---|
| CA-13 | Se seleccionan los Cargos de la Línea con `FechaInicio <= fecha <= FechaFin`. |
| CA-14 | La fecha usada es la **financiera** (contable/valor), nunca la de creación del registro. |
| CA-15 | Sólo se procesan los que tienen `bCargo ∈ (S, Y)` y `Estatus = Pendiente`. |
| CA-16 | `bCargo` se normaliza con *trim* y mayúsculas antes de evaluarse: `s`, `" S"`, `y` se interpretan igual. |
| CA-17 | Un Cargo posterior a `FechaFin` **no** entra y permanece `Pendiente` para el siguiente corte. |
| CA-18 | Un Cargo ya `Procesado` no se vuelve a incluir. |
| CA-19 | Si no hay Cargos que cumplan, **no se genera una CxC vacía**: se devuelve el mensaje controlado con periodo y línea. |

### HU-27.3 — La Prelación del producto ordena el documento

> **Como** área de crédito, **quiero** que el detalle salga en el orden de prelación configurado, **para** que la aplicación de pagos liquide los conceptos en el orden correcto.

| # | Criterio de aceptación |
|---|---|
| CA-20 | La Prelación se lee de la configuración del producto usando el `IdProducto` de la Línea; **no** hay orden fijo en código. |
| CA-21 | Cada Cargo resuelve su `OrdenPrelacion` por su clave de concepto. |
| CA-22 | Si un Cargo a procesar **no** tiene Prelación configurada, se cancela todo con rollback y el mensaje nombra la clave y el producto. |
| CA-23 | Los Cargos se ordenan por `OrdenPrelacion ASC`, desempatando por `FechaCargo ASC` y luego `IdCargo ASC`, para que el orden sea determinístico. |
| CA-24 | El `OrdenPrelacion` **se guarda en cada renglón del detalle**, no sólo se usa para ordenar (lo consume la ESPECIFICACIÓN 4). |

### HU-27.4 — Montos y fecha límite salen de la configuración

> **Como** cliente tarjetahabiente, **quiero** que mi estado de cuenta traiga el total, el pago mínimo y la fecha límite correctos, **para** saber cuánto y cuándo pagar.

| # | Criterio de aceptación |
|---|---|
| CA-25 | `MontoTotalPagar = SUM(MontoCargo)` de los cargos facturados en el periodo. |
| CA-26 | `MontoMinimoPagar` se calcula con la regla configurada; **no** hay fórmula fija en el código del cierre. |
| CA-27 | El cálculo del mínimo respeta el método configurado (% + mínimo fijo, % del saldo, monto fijo, el mayor entre % y fijo) y sus conceptos incluidos. |
| CA-28 | `FechaVencimiento` se calcula sobre `FechaFin` con el parámetro de días configurado; no se hardcodean 10, 15 ni 20 días. |
| CA-29 | Si existe configuración de días hábiles / ajuste por día inhábil, se respeta. |
| CA-30 | `FechaDocumento = FechaInicio` (regla explícita de §17, distinta de `FechaFin` y de la fecha de proceso). |

### HU-27.5 — Se genera la CxC con su detalle

> **Como** Cobranza, **quiero** recibir la CxC con su desglose, **para** poder emitir la factura y el aviso sin recapturar nada.

| # | Criterio de aceptación |
|---|---|
| CA-31 | La CxC se crea con el mecanismo existente de Cobranza; **no** se construye una entidad paralela. |
| CA-32 | El encabezado lleva al menos `IdLineaCredito`, `IdCliente`, `IdSolicitud`, `IdProducto`, `FechaDocumento`, `FechaVencimiento`, `MontoTotalPagar` y `MontoMinimoPagar`. |
| CA-33 | `IdCliente`, `IdSolicitud` e `IdProducto` se toman de la Línea; no se piden al usuario ni se hardcodean. |
| CA-34 | Se genera **un renglón de detalle por Cargo**, con clave, nombre, monto, fecha, naturaleza y `OrdenPrelacion`. |
| CA-35 | El detalle se inserta y se muestra en orden de `OrdenPrelacion ASC`. |
| CA-36 | Cuando existan, se conservan `IdMovimientoOrigen`, `IdOperacion`, `CorrelationId` y `NumeroParcialidad` para trazabilidad. |
| CA-37 | El documento queda disponible como **Factura** y **Aviso de Vencimiento** por el mismo camino que ya usan Arrendamiento y GPO. |

### HU-27.6 — Un cargo se corta una sola vez

> **Como** responsable de integridad, **quiero** que una doble ejecución no duplique el cobro, **para** no facturar dos veces al cliente.

| # | Criterio de aceptación |
|---|---|
| CA-38 | Cada Cargo procesado queda ligado a la CxC generada. |
| CA-39 | Al terminar, los Cargos incluidos pasan de `Pendiente` a `Procesado`. |
| CA-40 | El cambio de estatus ocurre **después** de que la CxC y su detalle se crearon, dentro de la misma transacción. |
| CA-41 | Ejecutar dos veces el mismo corte **no** genera una segunda CxC para los mismos Cargos. |
| CA-42 | La idempotencia se verifica por la relación Cargo→CxC, no sólo por el estatus. |
| CA-43 | Dos usuarios ejecutando el corte al mismo tiempo no pueden procesar el mismo Cargo dos veces (bloqueo/constraint). |

### HU-27.7 — Todo o nada

> **Como** responsable de integridad, **quiero** que un fallo deje el sistema como estaba, **para** no quedarme con cargos procesados sin documento.

| # | Criterio de aceptación |
|---|---|
| CA-44 | Todo el cierre corre en **una sola transacción**: línea, validaciones, CxC, detalle, relación y estatus. |
| CA-45 | Un error en el renglón N revierte la CxC, los N−1 detalles, las relaciones y todos los cambios de estatus. |
| CA-46 | Tras un rollback, **los Cargos siguen en `Pendiente`** y no existe una CxC parcial. |
| CA-47 | Ningún método interno (crear CxC, crear detalle, actualizar cargo, calcular pago mínimo) hace `COMMIT` por su cuenta. |
| CA-48 | **Ningún Cargo puede quedar en `Procesado` si su CxC o su detalle no se crearon correctamente** (§44.10 — verificación explícita). |

### HU-27.8 — El operador ve qué pasó, y queda registrado

| # | Criterio de aceptación |
|---|---|
| CA-49 | Al terminar se muestra: folio de CxC, periodo procesado, cantidad de cargos, Monto Total, Monto Mínimo y Fecha Límite de Pago. |
| CA-50 | Antes de procesar se validan línea, periodo (`FechaInicio <= FechaFin`), cliente, solicitud, producto y las tres configuraciones (Prelación, Pago Mínimo, Fecha Límite). |
| CA-51 | Cada ejecución — exitosa o fallida — deja bitácora con los campos de §40, incluidos usuario, fecha-hora, `CorrelationId` y resultado. |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | El periodo va del **día siguiente al corte anterior** hasta el **día de corte del mes en proceso**, ambos inclusive. |
| RN-02 | La pertenencia al periodo se decide por la **fecha financiera** del Cargo, nunca por su fecha de captura. |
| RN-03 | Sólo se cortan Cargos con `bCargo ∈ (S, Y)` y `Estatus = Pendiente`; `bCargo` se normaliza antes de evaluarse. |
| RN-04 | Un concepto sin Prelación configurada **detiene el cierre completo**: una CxC sin orden de aplicación definido no debe existir. |
| RN-05 | El orden del detalle es `OrdenPrelacion ASC`, luego `FechaCargo ASC`, luego `IdCargo ASC` — determinístico siempre. |
| RN-06 | `FechaDocumento = FechaInicio`; `FechaVencimiento` se calcula sobre `FechaFin`. Son fechas base distintas, a propósito. |
| RN-07 | Ni el día de corte, ni el producto, ni las reglas de pago, ni la prelación, ni los días límite se escriben en código: todo sale de configuración. |
| RN-08 | El cierre es una **unidad transaccional**: un fallo revierte todo y los Cargos vuelven a `Pendiente`. |
| RN-09 | Un Cargo transita `Pendiente → Procesado` **una sola vez**, garantizado por la relación Cargo→CxC. |
| RN-10 | La ejecución física del corte ocurre después del cierre operativo del día de corte, para alcanzar los movimientos del día completo. |

---

## Decisiones abiertas — requieren respuesta de negocio

| # | Pregunta | Por qué importa |
|---|---|---|
| 01 | **¿Se aplica la migración de REQ-26?** Las tablas de Movimientos, Saldos y Cargos existen sólo como SQL en el repo. | Sin Cargos en base no hay nada que cortar: bloquea todo REQ-27. |
| 02 | **¿De qué nivel se leen DiaCorte, pago mínimo y días límite?** Existen en el producto (*Reglas de Pago y Corte TDC*) y en la instancia (*Condiciones de la Tarjeta*). | Lo pactado con el cliente vive en la instancia; el producto es el default. Propuesta: instancia con respaldo en producto. |
| 03 | **¿Cuál Prelación gobierna?** *Prelación de cargos* del producto, u *Orden de aplicación de pagos* de las Reglas TDC. | Determina el orden de liquidación y, por tanto, el resultado de la ESPECIFICACIÓN 4. |
| 04 | **¿Cuál es la fecha financiera del Cargo?** Hoy sólo se guarda la fecha del movimiento. | §6 prohíbe usar la de creación. Definir si esa fecha es la financiera o hay que agregar `fecha_contable`/`fecha_valor`. |
| 05 | **¿El corte es manual, automático o ambos?** §5 habla de proceso nocturno; el submódulo sugiere pantalla. | Cambia si hace falta además un job programado y su ventana de ejecución. |
| 06 | **¿Qué hace el pago mínimo con el saldo vencido?** La configuración tiene *Agregar saldo vencido*, pero el saldo vencido viene de CxC anteriores. | Sin CxC previas no hay de dónde tomarlo en el primer corte. |
| 07 | **¿Días naturales o hábiles para la fecha límite?** El producto tiene *Ajuste por día inhábil*, la instancia no. | Cambia la fecha de vencimiento que ve el cliente. |
| 08 | **¿Qué pasa con los Cargos de naturaleza *Abono*** (cash back, bonificaciones) dentro del periodo? | Restan del total a pagar o se excluyen del documento; la especificación no lo dice. |
| 09 | **¿Un cierre se puede cancelar o reversar** una vez generado? | Define si `Cancelado` es un estatus alcanzable del Cargo y si la CxC admite reverso. |
| 10 | **¿El folio del cierre es propio (`IdCierreCorte`) o basta el de la CxC?** | §40 lo pide; hay que crear `J_CIERRES_CORTE` o reutilizar el folio del documento. |

---

## Orden de implementación sugerido

1. **HU-27.0 y migración de REQ-26** — aplicar el SQL y agregar `estatus`, `cxc_id` y `b_cargo` a `J_CARGOS_LINEA`. Sin esto nada es probable.
2. **Motor puro de cierre** — un módulo que reciba la Línea, su configuración y los Cargos del periodo, y devuelva el conjunto resultante: cargos ordenados, conceptos del detalle, total, mínimo y fecha de vencimiento. Testeable sin base de datos, igual que [motorMovimientosTDC.ts](../src/app/lib/motorMovimientosTDC.ts) de REQ-26.
3. **Servicios de cálculo** — `CalcularFechaLimitePago()` y `CalcularPagoMinimo()`, leyendo configuración, sin fórmulas fijas.
4. **RPC transaccional** que aplique el conjunto: CxC + detalle + relaciones + estatus, con el patrón de `reservar_cupo_gpo` y `aplicar_movimiento_tdc`.
5. **Submódulo Cierre de Corte** con el periodo propuesto y la pantalla de resultado.
6. **Pruebas** de los 19 casos de §44.9, con foco en rollback, doble ejecución y concurrencia.

La separación motor / transacción es la misma que ya probó REQ-26: el motor
decide **qué** se factura y en qué orden, la transacción decide **cómo** se
escribe. Es lo que permite cumplir RN-08 y, a la vez, probar las reglas de
negocio sin base de datos.

---

## Relación con las demás especificaciones

```text
ESPECIFICACIÓN 2 (REQ-26)          ESPECIFICACIÓN 3 (REQ-27)         ESPECIFICACIÓN 4
─────────────────────────          ─────────────────────────         ────────────────
Movimiento                         Cierre de Corte
    ↓                                  ↓
Afectación de Línea                Cargos del periodo
    ↓                                  ↓
bCargo = S/Y                       Prelación del producto
    ↓                                  ↓
Cargo = Pendiente        ────────► CxC + Detail  ──── OrdenPrelacion ────►  Aplicación de Pago
                                       ↓
                                   Cargo = Procesado
```

REQ-27 únicamente **obtiene, ordena y conserva** la Prelación. La lógica de
distribución del pago pertenece a la ESPECIFICACIÓN 4 y no debe adelantarse aquí.
