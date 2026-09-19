# HU — REQ-30: Eventos Contables y Pólizas (ESPECIFICACIÓN 5)

> **Estado: aplicado.** `npm run build` compila sin errores nuevos.
> El motor pasa **104 aserciones**, 0 fallas — incluido el ciclo completo de §91.
> Total del proyecto: **347 aserciones** en cinco suites (`npm run test:tdc`).
>
> **Pendiente de operación:** ejecutar en Supabase, en orden:
> `create_rpc_movimiento_tdc.sql` → `create_rpc_cierre_corte_tdc.sql` →
> `create_rpc_aplicacion_pagos_tdc.sql` → **`create_rpc_contabilidad_tdc.sql`**.

---

## La regla que gobierna todo el diseño

**Ninguna cuenta contable aparece en el código** (§3). Ni en el motor, ni en el
RPC, ni en la UI. Las cuentas llegan de la Guía Contabilizadora del producto —
`data.motorContable`, las filas `{ evento, componente, debito, credito }` que se
capturan en Taller de Producto → Motor Contable.

Las pruebas lo verifican de forma activa: usan cuentas inventadas (`7101-001`,
`1999-001`) que existen **sólo en el archivo de prueba**, y una aserción cambia
la guía y comprueba que el asiento cambie con ella. Si alguien metiera una
cuenta al código, esa prueba fallaría.

Corolario de §61/§62: **configuración faltante es motivo de rollback**, no de
omitir el renglón. Es la diferencia de fondo con `construirDetallePoliza` de la
formalización GPO, que sí omite y reporta — correcto allá, prohibido aquí.

---

## Eventos implementados (§4)

| Evento | Monto | Componentes | Idempotencia (§53) |
|---|---|---|---|
| `ACTIVACION_LINEA` | Límite autorizado (§12) | `LINEA_AUTORIZADA`, cuentas de orden (§13) | `IdLineaCredito` |
| `CORTE_PERIODO` | Total de la CxC | El **Detalle de la CxC** (§20), nunca recalculado de movimientos | `IdCxC` |
| `APLICACION_PAGOS` | **Sólo lo aplicado** (§28) | `AplicacionesPagoDetail` (§29) | `IdProcesoAplicacion` + cada `IdAplicacionPagoDetail` |
| `RECLASIFICACION_SALDO` | Saldo pendiente | Composición concepto por concepto (§40) | `IdCxC` |

---

## Historias de usuario

### HU-30.1 — Un solo motor para los cuatro eventos (§8)

| # | Criterio |
|---|---|
| CA-01 | `contabilizarEvento()` es común a los cuatro. No hay cuatro motores. |
| CA-02 | Lo único específico de cada evento es de dónde salen los componentes. |
| CA-03 | Un componente puede producir **N renglones**, no necesariamente dos (§7). |
| CA-04 | Se usa la guía vigente a la **fecha contable**, no a la fecha del proceso (§63). |
| CA-05 | Cada partida guarda qué regla la generó (§64). |

### HU-30.2 — Ninguna póliza descuadrada llega a la base

| # | Criterio |
|---|---|
| CA-06 | `SUM(Debe) = SUM(Haber)` se valida en el motor **y otra vez en el RPC**, sobre lo que se va a escribir (§10, §60). |
| CA-07 | Un descuadre aborta con el mensaje literal de §10 y no marca nada como contabilizado. |
| CA-08 | Los totales enviados deben coincidir con la suma de las partidas, o aborta. |
| CA-09 | Componente sin guía → rollback con el mensaje de §61. |
| CA-10 | Componente con guía pero sin cuenta → rollback (§62). |

### HU-30.3 — Sólo se contabiliza lo realmente aplicado

| # | Criterio |
|---|---|
| CA-11 | En `APLICACION_PAGOS` el monto es `SUM(MontoAplicado)`, nunca el Pago Referenciado (§28, §93.12). |
| CA-12 | Un concepto que no recibió pago **no aparece** en la póliza (§30). |
| CA-13 | Tres pagos parciales de 300/400/300 generan tres pólizas de 300, 400 y 300 — nunca se recontabiliza lo anterior (§31). |
| CA-14 | Cada `AplicacionPagoDetail` se contabiliza una sola vez (§32). |
| CA-15 | Una ejecución del proceso produce una póliza, aunque toque varias CxC (§33). |

### HU-30.4 — El saldo reclasificado no se reconoce dos veces

| # | Criterio |
|---|---|
| CA-16 | La CxC reclasificada queda en estado **`Reclasificada`**, nunca `Pagada` (§38). |
| CA-17 | El saldo se traslada con su **composición**: capital, interés, IVA por separado (§40, §47). |
| CA-18 | `MontoCargoSaldoAnterior = SUM(SaldoReclasificado) = SaldoPendienteCxC`, verificado en el motor y en el RPC (§72). |
| CA-19 | La reclasificación manda el saldo a la cuenta puente configurada (§45). |
| CA-20 | El siguiente corte contabiliza `SALDO_ANTERIOR` **contra la misma cuenta puente**: no toca cuentas de ingreso (§46). |
| CA-21 | Nunca existe una CxC `Reclasificada` sin Cargo Saldo Anterior con composición (§71). |
| CA-22 | La prueba de ciclo completo (§91) verifica que el ingreso total tras activación → corte → pago → reclasificación → nuevo corte siga siendo **el del corte original**. |

---

## Entregables (§93.26)

### Archivos creados

| Archivo | Qué es |
|---|---|
| [motorContableTDC.ts](../src/app/lib/motorContableTDC.ts) | Motor genérico. Sin cuentas, sin E/S. |
| [contabilizarEventoTDC.ts](../src/app/lib/contabilizarEventoTDC.ts) | Capa transaccional: los cuatro envoltorios de evento. |
| [create_rpc_contabilidad_tdc.sql](../supabase/migrations/create_rpc_contabilidad_tdc.sql) | Tablas contables, `contabilizar_evento_tdc`, `reclasificar_saldo_cxc`, `obtener_contabilizaciones`. |
| [espec5-contabilidad.mjs](../tests/tdc/espec5-contabilidad.mjs) | 104 aserciones. |

### Métodos creados

**Motor:** `contabilizarEvento()` (§8) · `filasVigentes()` (§63) ·
`componentesDeActivacion()` (§14) · `componentesDeCorte()` (§20, §24) ·
`componentesDeAplicacionPagos()` (§29) · `componentesDeReclasificacion()` (§39, §40) ·
`claveIdempotencia()` (§53)

**Capa transaccional:** `contabilizarActivacion()` · `contabilizarCorte()` ·
`contabilizarAplicacionPagos()` · `reclasificarSaldo()` · `obtenerContabilizaciones()`

**SQL:** `public.contabilizar_evento_tdc()` · `public.reclasificar_saldo_cxc()` ·
`public.obtener_contabilizaciones()`

### Archivos modificados

| Archivo | Cambio |
|---|---|
| [CierreCorteTab.tsx](../src/app/components/creditos/CierreCorteTab.tsx) | Tras generar la CxC, contabiliza `CORTE_PERIODO` (§66). |
| [AplicacionPagosTab.tsx](../src/app/components/creditos/AplicacionPagosTab.tsx) | Tras aplicar el pago, contabiliza `APLICACION_PAGOS` (§67). |
| [run.mjs](../tests/tdc/run.mjs) | Quinta suite. |

### Entidades utilizadas

**Reutilizadas sin modificar (§93.4):** `J_GL_JOURNAL_ENCABEZADO` y
`J_GL_JOURNAL_DETALLE` — las tablas que ya lee **Pólizas Contables**. No se creó
un segundo visor. `J_CARGOS_LINEA` recibe el Cargo Saldo Anterior con la misma
forma que cualquier otro cargo, para que la ESPECIFICACIÓN 3 lo tome sin cambios (§43).

**Extendidas:** `J_CXC_LINEA` y `J_CXC_LINEA_DETALLE` (estado contable + datos de
reclasificación de §49) · `J_APLICACIONES_PAGO_DETALLE` (§32) · `J_SALDOS_LINEA`
(activación contabilizada).

**Nuevas:** `J_CONTABILIZACIONES` (el histórico de §52) ·
`J_CARGO_SALDO_ANTERIOR_DETALLE` (la composición de §41).

### Servicios reutilizados

- **`leerGuiaContabilizadora()`** de `formalizacionCarteraGPO` — ya resuelve el evento por código o nombre normalizado, con igualdad y no `includes()`, que mezclaría guías con prefijo común.
- **El módulo Pólizas Contables** completo, incluida la forma de `data.Detalle` que su formulario espera.
- **El patrón `public.` + `SECURITY DEFINER` + `GRANT`** de `public.reservar_cupo_gpo`.

### Configuraciones utilizadas

`data.motorContable` del producto (evento + componente → cuenta débito/crédito) ·
`reglasPagoCorteTDC` y `prelacionCargos` para el orden del Saldo Anterior (§48) ·
la clave del concepto Saldo Anterior, **parametrizada** (§42: `'010'` es sólo el ejemplo).

### Pruebas agregadas

§87 activación (normal, ya contabilizada, monto cero, sin configuración, descuadre) ·
§88 corte (un detalle, varios, por componente, sin configuración, total distinto del header, N renglones) ·
§89 pagos (total, parcial, segundo parcial, varias CxC, sólo lo aplicado) ·
§90 reclasificación (sin pagos, parcial, pagada, composición, descuadre) ·
**§91 el ciclo completo de 17 pasos** · §92 invariantes sobre las cinco pólizas del ciclo.

---

## Supuestos técnicos

1. **§63 — vigencias.** El Motor Contable actual no captura fechas de vigencia.
   `filasVigentes()` las respeta si existen y considera vigente la fila que no
   las declara. Descartar por un campo inexistente dejaría todos los eventos sin
   configuración.

2. **§53 — la clave de `APLICACION_PAGOS` es el proceso, no cada aplicación.**
   §33 pide una póliza por proceso; §32 pide que cada aplicación se contabilice
   una vez. Ambas se cumplen: la póliza es por `IdProcesoAplicacion`, y cada
   `IdAplicacionPagoDetail` se marca dentro de la misma transacción — si alguno
   ya estaba contabilizado, todo se revierte.

3. **§45 — la reclasificación se contabiliza concepto por concepto**, no como un
   único importe global. El total es el mismo, pero el asiento conserva de qué
   estaba hecho el saldo y permite que la guía mande cada concepto a su propia
   cuenta puente.

4. **§13 — las cuentas de orden son configuración, no código.** El motor no sabe
   que la activación usa cuentas de orden; sólo resuelve `ACTIVACION_LINEA +
   LINEA_AUTORIZADA` contra la guía. Que sean de orden lo decide quien configura.

---

## Desviación conocida — §83 y §84

**Lo que pide la especificación:** que la contabilización forme parte de la
**misma transacción** que el proceso operativo, de modo que no pueda quedar «CxC
válida + Cargos Procesados + sin Póliza».

**Lo que hace la implementación:** el RPC operativo (`aplicar_cierre_corte_tdc`,
`aplicar_pago_referenciado`) y el contable (`contabilizar_evento_tdc`) son dos
transacciones consecutivas. Si la contable falla, el documento operativo queda
creado y **sin póliza**.

**Por qué, y qué lo mitiga:**

- La pantalla **lo dice explícitamente** — *«El corte se generó pero NO quedó contabilizado»* — en vez de reportar éxito.
- La contabilización es **idempotente por clave lógica**, así que reintentar es seguro y no duplica.
- Se puede detectar en cualquier momento con la consulta 2 de las verificaciones al pie de la migración.

**Para cerrarla** hay que pasar `p_partidas` al RPC operativo y que éste llame a
`contabilizar_evento_tdc` internamente — como ya hace `reclasificar_saldo_cxc`,
que **sí** cumple §85 porque póliza, cierre de CxC, Cargo y composición viven en
una sola función. Es un cambio acotado, pero modifica la firma de dos RPC ya
desplegados, así que conviene decidirlo antes que hacerlo.

---

## Lo que esta HU deliberadamente no tocó

- **§37 / §69 — el calendario de la reclasificación.** `reclasificarSaldo()` está lista y probada, pero nadie la dispara todavía: falta decidir cuándo corre (§37 la quiere parametrizable) y ponerle su botón o su proceso nocturno.
- **§54 — cancelación y reversa.** Los estados existen en `J_CONTABILIZACIONES` y el índice único los excluye para permitir recontabilizar, pero el proceso de reversa en sí no se implementó: §54 dice usar el que ya define CACAO Banking.
- **`ACTIVACION_LINEA` no tiene disparador automático.** La función existe y está probada; conectarla al cambio de estado de la línea (§11) requiere saber qué evento del sistema marca «Activa».
