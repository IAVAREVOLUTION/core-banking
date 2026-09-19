# HU — REQ-28: Refinamiento del Prewrite de Movimientos TDC

> **Origen:** ESPECIFICACIÓN 1 y 2 en su versión detallada, capturada el 15/09/2026.
> No es un requerimiento nuevo: **refina** lo construido en
> [REQ-26](REQ-26_Movimientos_TDC_Prewrite_Cargos_Permitidos.md), precisando el
> parseo de parámetros, la regla de desempate de la comisión, el redondeo del
> calendario MSI/MCI, la normalización de indicadores y el tratamiento de la
> configuración incompleta.
>
> **Estado: aplicado.** `npm run build` compila sin errores nuevos; el motor
> pasa **109 aserciones** (54 de REQ-26 + 55 de esta especificación), 0 fallas.
>
> **Pendiente de operación:** la transaccionalidad de §4/§5/§7/§8 está escrita y
> cableada, pero no opera hasta correr en Supabase
> `supabase/migrations/create_rpc_movimiento_tdc.sql` y después
> `create_rpc_cierre_corte_tdc.sql`, **en ese orden**.

---

## Qué ya estaba y qué cambió

REQ-26 implementó el flujo completo: validación contra Cargos Permitidos,
comisión, IVA, cash back, MSI/MCI, afectación de línea y consumo de saldo. Esta
especificación no lo contradice; lo aprieta en nueve puntos. Cinco eran defectos
reales.

| # | Punto de la especificación | Antes | Ahora |
|---|---|---|---|
| 1 | **§1.1.1 — clave de la comisión en empate** | Con `fija == porcentual` se tomaba la clave del **porcentaje**. | En empate manda la clave de la **comisión fija**, como pide la regla explícita. |
| 2 | **Regla de redondeo MSI/MCI** | El capital se dividía en partes iguales: $100 a 3 meses daba 33.33 × 3 = **99.99**. | La diferencia de centavos se ajusta en la **última parcialidad**: 33.33 + 33.33 + **33.34** = 100.00 exacto. |
| 3 | **§10 — valor sin clave** | `16%\|` (importe > 0 sin clave) generaba una **advertencia** y el importe se perdía en silencio. | Es **configuración inválida**: aborta con rollback y nombra el campo y el producto. |
| 4 | **§11 — normalización de indicadores** | `bCargo`, `bFactura` y `ConsumeLineaDisponible` se comparaban con `=== 'S'`: `"s"` o `" S "` se leían como **N**. | Se normalizan con *trim* + mayúsculas; `S`, `s`, `" S "`, `Y`, `y` valen igual. `NULL` **no** se convierte a `S`. |
| 5 | **§10 — validaciones de entrada** | No se validaba el monto. | `Monto > 0` y clave presente, antes de tocar nada. |
| 6 | **§1.1.3 — datos de la parcialidad** | El calendario traía periodo, fecha, clave, concepto y monto. | Agrega **`saldoCapital`** por parcialidad (capital pendiente tras cada pago). |
| 7 | **Mensajes literales** | Redacción propia. | Texto exacto del requerimiento, en ambos rechazos. |
| 8 | **§1.1.2 — Cuenta EJE independiente de `bCargo`** | Ya era así. | Verificado con prueba: con `bCargo = N` no se crea el Cargo pero **sí** el movimiento de Cuenta EJE. |
| 9 | **Porcentajes** | Ya se dividía entre 100. | Verificado: `5%` sobre 10,000 da **500**, nunca 50,000. |
| 10 | **§1.1.2 — resolución de la Cuenta EJE** | El motor recibía `clienteTieneCuentaEje: boolean` y la pantalla pasaba `!!clienteId`: en los hechos **asumía `IdCliente == IdCuentaEje`**, justo lo que la especificación prohíbe. | La cuenta se **resuelve por la relación del modelo** antes de correr el motor (`buscarCuentaEje`), y viaja en el efecto (`idCuentaEje`, `idCliente`, `nombre`). Sin cuenta válida, error literal de §1.1.2 y rollback. |
| 11 | **§4/§5 — transaccionalidad operando** | El subtab Movimientos escribía en `sessionStorage`: no había transacción, ni rollback, ni protección de concurrencia. | Nueva capa [aplicarMovimientoTDC.ts](../src/app/lib/aplicarMovimientoTDC.ts): corre el motor y persiste **todo en una sola llamada** a `aplicar_movimiento_tdc`. La pantalla espera el resultado (§6) y avisa si no se persistió. |
| 12 | **§10 — Plazo y Naturaleza** | No se validaban. | `Plazo` debe ser **entero positivo**; `Naturaleza` debe ser exactamente *Cargo* o *Abono*. Un valor capturado a mano ya no decide en silencio el signo del saldo. |

---

## Historias de usuario

### HU-28.1 — La comisión se imputa al concepto que la generó

| # | Criterio de aceptación |
|---|---|
| CA-01 | `MontoComision = MAX(ComisionFija, Monto × %Com)`. |
| CA-02 | Si gana el porcentaje, la clave es la de `%Com`. |
| CA-03 | Si gana la fija, la clave es la de `ComisionFija`. |
| CA-04 | **En empate exacto manda la clave de la comisión fija.** |
| CA-05 | El IVA se calcula sobre la comisión determinada, con su propia clave. |

### HU-28.2 — El calendario cuadra al centavo

| # | Criterio de aceptación |
|---|---|
| CA-06 | La suma del capital de las parcialidades es **exactamente** el monto del movimiento. |
| CA-07 | La diferencia de redondeo se ajusta en la **última** parcialidad. |
| CA-08 | Cada parcialidad lleva número, fecha de vencimiento, monto y **saldo de capital**. |
| CA-09 | En MSI no se generan renglones de interés ni de IVA de interés. |
| CA-10 | En MCI cada parcialidad lleva capital, interés e IVA de interés con sus claves propias. |

### HU-28.3 — La configuración incompleta detiene la operación

| # | Criterio de aceptación |
|---|---|
| CA-11 | Un parámetro con valor financiero > 0 y **sin clave** es configuración inválida: se aborta. |
| CA-12 | El error nombra el campo, el concepto y el producto, e indica el formato esperado. |
| CA-13 | No queda ningún efecto ni afectación parcial tras el rechazo. |
| CA-14 | `Monto <= 0` y clave vacía se rechazan antes de cualquier lectura de configuración. |

### HU-28.4 — Los indicadores se interpretan igual sin importar cómo se capturaron

| # | Criterio de aceptación |
|---|---|
| CA-15 | `S`, `s`, `" S "`, `Y`, `y` se interpretan como afirmativo. |
| CA-16 | `N`, vacío, `NULL` y cualquier otro valor se interpretan como negativo. |
| CA-17 | `NULL` **no** se convierte a `S`: la ausencia de configuración no activa el indicador. |
| CA-18 | Aplica a `bCargo`, `bFactura` y `ConsumeLineaDisponible` por igual. |

### HU-28.5 — Los tres indicadores son independientes

| # | Criterio de aceptación |
|---|---|
| CA-19 | `Consume=S, bCargo=S` → consume línea y crea Cargo. |
| CA-20 | `Consume=S, bCargo=N` → consume línea y **no** crea Cargo. |
| CA-21 | `Consume=N, bCargo=S` → **no** consume línea y crea Cargo. |
| CA-22 | `Consume=N, bCargo=N` → ni consume ni crea Cargo; no es error. |
| CA-23 | `bFactura` se conserva en el Cargo para que el Cierre de Corte decida si factura. |

### HU-28.6 — El ejemplo MSI del requerimiento se cumple sin código especial

> El movimiento consume la línea una vez y no genera Cargo; cada parcialidad
> genera Cargo y no vuelve a consumir línea. **Todo desde la configuración**,
> sin una rama `if (esMSI)` en el código.

| # | Criterio de aceptación |
|---|---|
| CA-24 | Con el movimiento en `Consume=S, bCargo=N` y el capital en `Consume=N, bCargo=S, bFactura=S`: la línea se consume **una sola vez**. |
| CA-25 | El movimiento original no genera Cargo. |
| CA-26 | Cada parcialidad genera su Cargo con `bFactura=S`. |
| CA-27 | Las parcialidades **no** vuelven a consumir línea. |
| CA-28 | Nada de esto está hardcodeado para MSI: sale de Afectación de la Línea. |

### HU-28.7 — Cash Back afecta la Cuenta EJE aunque no genere Cargo

| # | Criterio de aceptación |
|---|---|
| CA-29 | La naturaleza sale de Afectación de la Línea; no se asume que la clave de cash back sea Abono. |
| CA-30 | *Abono* incrementa el saldo de la Cuenta EJE; *Cargo* lo disminuye. |
| CA-31 | Con `bCargo = N` no se crea el Cargo pero **sí** el movimiento de Cuenta EJE. |
| CA-32 | Sin Cuenta EJE válida, la operación completa se revierte con error controlado. |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | El formato de los parámetros es `Valor\|ClaveConcepto`; un valor > 0 sin clave es configuración inválida. |
| RN-02 | Un porcentaje se aplica como fracción: `5%` es `× 0.05`, jamás `× 5`. |
| RN-03 | La comisión es el **mayor** entre fija y porcentual; en empate manda la clave de la fija. |
| RN-04 | El IVA de comisión se calcula sobre la comisión ya determinada. |
| RN-05 | La suma del capital de las parcialidades es exactamente el monto del movimiento; el ajuste va en la última. |
| RN-06 | `ConsumeLineaDisponible`, `bCargo` y `bFactura` son independientes entre sí. |
| RN-07 | Los indicadores se normalizan (*trim* + mayúsculas) antes de compararse; `NULL` no equivale a `S`. |
| RN-08 | La naturaleza de cualquier concepto sale de Afectación de la Línea, nunca de la clave. |
| RN-09 | El movimiento en Cuenta EJE del cash back es independiente de `bCargo`. |
| RN-10 | La clave del producto se obtiene de la Línea de Crédito, no se escribe en código. |

---

## Entregables

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| [motorMovimientosTDC.ts](../src/app/lib/motorMovimientosTDC.ts) | Los doce puntos de la tabla superior. Nuevo export `indicador()`; `RenglonCalendario` gana `saldoCapital`; `EfectoCuentaEje` gana `idCuentaEje`, `idCliente` y `nombre`; el parámetro `clienteTieneCuentaEje` se sustituye por `idCuentaEje`. |
| [aplicarMovimientoTDC.ts](../src/app/lib/aplicarMovimientoTDC.ts) | **Nuevo.** Capa transaccional única: resuelve la Cuenta EJE, corre el motor y llama al RPC. Traduce un `42883`/`PGRST202` a “ejecute la migración” en lugar de un error de Postgres crudo. |
| [useCuentaEjeGenerator.ts](../src/app/hooks/useCuentaEjeGenerator.ts) | Se extrajo `buscarCuentaEje()` — devuelve la fila, no un booleano. `clienteTieneCuentaEje()` ahora delega en él: un solo lugar sabe qué cuenta es la eje. |
| [MovimientosLineaTab.tsx](../src/app/components/creditos/MovimientosLineaTab.tsx) | Confirmar es asíncrono y espera la transacción; estado `aplicando`; avisa cuando el movimiento no se persistió. |

**Servicios y patrones reutilizados** — no se creó nada paralelo:

- `leerVC()` ya resolvía el formato `valor|clave` en sus dos formas (objeto y string con pipe).
- `resolverAfectacion()` sigue siendo el único punto que consulta Afectación de la Línea.
- La transacción sigue viviendo en `aplicar_movimiento_tdc` (REQ-26); el motor no escribe.
- El subtab Movimientos de la Línea y el Cierre de Corte consumen el mismo motor sin cambios.

**Pruebas agregadas** — 55 aserciones nuevas sobre los casos del §12.11:

normalización de indicadores · comisión fija · comisión porcentual · empate ·
IVA de comisión · porcentaje como fracción · MSI con redondeo exacto · saldo de
capital · MCI con interés e IVA · cash back con Cuenta EJE · cash back con
`bCargo=N` · `Monto <= 0` · valor sin clave · las dos leyendas de rechazo
literales · las cuatro combinaciones de `Consume` × `bCargo` · el ejemplo MSI
completo del requerimiento.

**Supuestos técnicos**

1. **Interés MCI simple, prorrateado al plazo**: `Monto × %IntAnl × (n/12)`, repartido en partes iguales. La especificación no define el sistema de amortización; si debe ser francés o saldos insolutos, cambia sólo el cálculo del interés, no la estructura.
2. **El ajuste de redondeo va completo en la última parcialidad**, tal como pide la regla, en lugar de repartirse centavo a centavo entre las primeras.
3. **`NULL` en un indicador significa `N`.** La especificación prohíbe convertirlo a `S` salvo convención explícita del sistema; no existe tal convención en el código.
4. **Idempotencia y concurrencia** (§7, §8) se resuelven en la capa transaccional, no en el motor: el `UPDATE ... WHERE saldo_disponible >= monto` de `aplicar_movimiento_tdc` y los índices únicos. El motor es puro y no tiene estado que duplicar.
5. **La auditoría de §9** se cubre con los campos que ya persiste el RPC (`efectos`, `calendario`, `total_consumido`) más la bitácora de cierres; no se agregó una tabla de auditoría nueva.

---

## Lo que esta HU deliberadamente no tocó

- **§6 Asincronía** — el motor es síncrono y puro; no hay *fire-and-forget* que eliminar.
- **§7 Concurrencia y §8 Idempotencia** — resueltas por el RPC de REQ-26 (`UPDATE ... WHERE saldo_disponible >= total` e índices únicos). **No operan hasta correr la migración.**
- **El Cierre de Corte aún no llama a su RPC** — `CierreCorteTab` sigue escribiendo en `sessionStorage`; el cableado a `aplicar_cierre_corte_tdc` pertenece a [REQ-27](REQ-27_Cierre_de_Corte_TDC_CxC_Prelacion.md) y queda pendiente.
- La lógica de ESPECIFICACIÓN 3 (Cierre de Corte, [REQ-27](REQ-27_Cierre_de_Corte_TDC_CxC_Prelacion.md)) no se modificó: consume el motor por su interfaz pública, que no cambió salvo el campo nuevo del calendario.
