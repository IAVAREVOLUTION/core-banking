# HU — REQ-29: Aplicación de Pagos (ESPECIFICACIÓN 4)

> **Estado: aplicado.** `npm run build` compila sin errores nuevos.
> El motor pasa **79 aserciones**, 0 fallas (`npm run test:tdc`, suite 4 de 4).
>
> **Pendiente de operación:** ejecutar en Supabase, en orden,
> `create_rpc_movimiento_tdc.sql` → `create_rpc_cierre_corte_tdc.sql` →
> **`create_rpc_aplicacion_pagos_tdc.sql`**. Hasta entonces la pantalla avisa
> que las funciones no existen en vez de fingir que aplicó.

---

## La decisión de arquitectura

Misma que en las tres especificaciones anteriores: **motor puro + RPC transaccional**.

El motor decide *cuánto* va a cada línea; el RPC decide *cómo* se escribe. §52
prohíbe que `RegistrarAbonoCuentaEje`, `AplicarPagoCxC`, `AplicarPagoDetail` y
`RegistrarAbonoContrato` hagan commits independientes — una sola llamada, una
sola transacción, un solo rollback. Las reglas de reparto **no se reimplementan
en SQL**: el cliente manda el plan resuelto y la función lo persiste
*verificando que cuadre*. Duplicar las reglas garantizaría que las dos copias se
separaran con el tiempo.

---

## Historias de usuario

### HU-29.1 — El pago se reparte por la prelación de dos niveles

| # | Criterio de aceptación |
|---|---|
| CA-01 | Las CxC se ordenan por `FechaVencimiento ASC` (§7). |
| CA-02 | Empate de vencimiento → `FechaDocumento ASC` → `IdCxC ASC` (§7.1). |
| CA-03 | Dentro de cada CxC, el detalle se ordena por `OrdenPrelacion ASC`, desempatando por `IdDetalle` (§9, §57). |
| CA-04 | No se toca una CxC posterior mientras la anterior tenga saldo pagable (§57). |
| CA-05 | El `OrdenPrelacion` sale del **detalle**, nunca del Taller de Producto vigente (§10, §58.11). |

### HU-29.2 — Se aplica hasta donde alcance, sin sobrepagar

| # | Criterio de aceptación |
|---|---|
| CA-06 | `MontoAplicado = MIN(MontoDisponible, SaldoPendienteLinea)` (§13). |
| CA-07 | `PagoTotal` nunca rebasa el `Monto` de la línea (§12). |
| CA-08 | No se exige liquidar: un pago menor deja la CxC en `Parcial` (§25). |
| CA-09 | Una línea `Parcial` sigue siendo elegible en pagos posteriores (§28). |
| CA-10 | `PagoTotal` es acumulativo, tanto en el detalle como en el header (§14, §18, §20). |

### HU-29.3 — El remanente se queda en la Cuenta EJE

| # | Criterio de aceptación |
|---|---|
| CA-11 | El cargo a la EJE es el **MontoTotalAplicado**, no el pago recibido (§31, §33). |
| CA-12 | `Pago 10,000` contra `8,500` de CxC deja `1,500` disponibles (§30). |
| CA-13 | Sin CxC pendientes no se genera cargo ni abono; todo queda como saldo (§53). |
| CA-14 | El remanente de una aplicación anterior vuelve a participar sin tratamiento especial (§43, §44). |
| CA-15 | El estatus del Pago Referenciado se mide contra el **pago recibido**, no contra el disponible (§42). |

### HU-29.4 — Todo queda trazado

| # | Criterio de aceptación |
|---|---|
| CA-16 | Cada aplicación sobre una línea deja su propio renglón: relación 1:N (§15, §58.8). |
| CA-17 | `PagoTotal` no sobrescribe el histórico; es un acumulado operativo (§16). |
| CA-18 | `FechaUltimoPago` se mueve sólo cuando hubo monto aplicado (§17, §21, §58.15). |
| CA-19 | La distribución real por contrato se conserva; no se abona todo a uno solo (§36, §39). |
| CA-20 | El proceso registra saldos anteriores y posteriores en cada nivel (§54). |

### HU-29.5 — Nada queda a medias

| # | Criterio de aceptación |
|---|---|
| CA-21 | Sin Cuenta EJE válida se aborta con el mensaje literal de §3. |
| CA-22 | `PagoTotalHeader = SUM(PagoTotal de sus Details)` se verifica **en la base**, ya escritos (§48). |
| CA-23 | `MontoTotalAplicado = SUM(detalle) = SUM(CxC) = SUM(contratos)` (§49, §58.20). |
| CA-24 | Un plan que no cuadre aborta antes de escribir nada. |
| CA-25 | Un mismo `IdPagoReferenciado` no aplica dos veces (§45). |
| CA-26 | Si otro proceso movió una línea entre el cálculo y la escritura, aborta todo (§46). |

---

## Entregables (§58.22)

### Archivos creados

| Archivo | Qué es |
|---|---|
| [motorAplicacionPagosTDC.ts](../src/app/lib/motorAplicacionPagosTDC.ts) | Motor puro. Sin E/S, sin estado: sólo decide el reparto. |
| [aplicarPagoReferenciado.ts](../src/app/lib/aplicarPagoReferenciado.ts) | Capa transaccional: resuelve Cuenta EJE y CxC, corre el motor, llama al RPC. |
| [AplicacionPagosTab.tsx](../src/app/components/creditos/AplicacionPagosTab.tsx) | Pantalla: captura, vista previa (§55) y resultado. |
| [create_rpc_aplicacion_pagos_tdc.sql](../supabase/migrations/create_rpc_aplicacion_pagos_tdc.sql) | Tablas, RPC transaccional y lector. |
| [espec4-aplicacion-pagos.mjs](../tests/tdc/espec4-aplicacion-pagos.mjs) | 79 aserciones. |

### Métodos creados

`money()` · `ordenarDocumentos()` (§7, §7.1, §57) · `ordenarDetalle()` (§9, §57) ·
`aplicarPago()` (§24, el algoritmo completo) · `cargarCxCPagables()` ·
`saldoCuentaEje()` · `aplicarPagoReferenciado()` · `traducirErrorPago()`

**En SQL:** `public.aplicar_pago_referenciado()` · `public.obtener_cxc_pagables()`

### Archivos modificados

| Archivo | Cambio |
|---|---|
| [CarteraTDCForm.tsx](../src/app/components/cartera-tdc/CarteraTDCForm.tsx) | Subtab **Aplicación de Pagos**. |
| [run.mjs](../tests/tdc/run.mjs) | Cuarta suite en el runner. |

### Entidades utilizadas

**Reutilizadas sin modificar:** `J_CUENTAS_CORP_CLIENTES` (Cuenta EJE: `saldo_actual`,
`data.movimientos`, `cta_eje_chec`) · `J_MOVIMIENTOS_LINEA` · `J_SALDOS_LINEA`.

**Extendidas:** `J_CXC_LINEA` y `J_CXC_LINEA_DETALLE` ganan `pago_total`,
`saldo_pendiente`, `fecha_ultimo_pago` y `estatus_pago` — los campos que §11 y
§19 exigen y que §58.6 pide verificar antes de crear nuevos. No existían.

**Nuevas:** `J_PROCESOS_APLICACION_PAGO` (la unidad de idempotencia de §45) ·
`J_APLICACIONES_PAGO_CXC` (§22) · `J_APLICACIONES_PAGO_DETALLE` (la relación 1:N
de §15) · `J_ABONOS_CONTRATO` (§36).

### Servicios reutilizados — no se creó nada paralelo

- **`buscarCuentaEje()`** — el único resolver Cliente → Cuenta EJE del sistema, ya extraído en la especificación 2. §3 usa ese, no una consulta propia.
- **La cadena `referencia` → cuenta → `cliente_id`** que ya emplea `PagosReferenciadosModule`. §58.2 pide no inventar un campo nuevo; no se inventó.
- **`J_MOVIMIENTOS_LINEA`** para el abono al contrato (§40): es la tabla que la especificación 2 ya usa para los movimientos de la línea.
- **`data.movimientos` de la Cuenta EJE**, con la misma forma de registro que escribe el edge function, para que el abono y el cargo aparezcan en el subtab Movimientos de Personas sin trabajo extra.
- **El patrón `public.` + `SECURITY DEFINER` + `GRANT`** de `public.reservar_cupo_gpo`.

### Pruebas agregadas — los 20 casos de §58.18

Pago total de una CxC · pago parcial · pago parcial de un Detail · segundo pago
sobre Detail Parcial · segundo pago sobre CxC Parcial · varias CxC · prelación
por FechaVencimiento · prelación de Detail · dos CxC con misma FechaVencimiento
· pago menor al saldo · pago igual · pago mayor al saldo total · remanente en
Cuenta EJE · varios contratos · cargo en Cuenta EJE · abono por contrato ·
idempotencia · cliente sin CxC pendientes · el ejemplo completo de §26 · el de
§27 · las igualdades de §58.19 y §58.20 · centavos exactos.

---

## Supuestos técnicos

1. **§6.1 está cubierto parcialmente, y es deliberado.** La especificación pide
   buscar CxC en **todo** el módulo de Cobranza, no sólo en Líneas de Crédito.
   `obtener_cxc_pagables` lee hoy `J_CXC_LINEA`. Las facturas genéricas
   (`J_FACTURAS` / `J_FACTURAS_DETALLE`) **no** se incluyen porque su detalle
   carece de `orden_prelacion`, y §9 exige aplicar por esa prelación congelada.
   Incorporarlas requiere una decisión de negocio: qué prelación reciben las
   facturas emitidas antes de la especificación 3. **Es la brecha conocida.**

2. **El disponible incluye el saldo previo de la Cuenta EJE**, no sólo el pago
   recibido. §24 dice "obtener MontoDisponible desde el saldo disponible de la
   Cuenta EJE", y §43/§44 exigen que el remanente vuelva a participar. Así sale
   gratis, sin una rama especial de "re-aplicación".

3. **El estatus del Pago Referenciado se mide contra el pago recibido.** Si un
   pago de 1,000 aplica 300 porque sólo había esa deuda, queda *Aplicado
   Parcialmente* aunque se hayan usado 5,000 de remanente previo. Medirlo contra
   el disponible marcaría como total un pago que no lo fue.

4. **§40 — el abono a la Línea devuelve saldo disponible**, acotado con
   `LEAST(monto_autorizado, ...)`: un pago no puede dejar la línea con más
   disponible que su propio límite.

5. **La concurrencia de §46 es optimista, no bloqueo global.** Cada `UPDATE` de
   línea lleva `WHERE saldo_anterior = <el que vio el motor>`; si otro proceso
   la movió, no hay fila y la transacción completa aborta con un mensaje
   accionable. La Cuenta EJE sí se bloquea con `FOR UPDATE`, porque ahí el
   conflicto es sobre un único saldo.

6. **§31 — la clave del movimiento "Aplicación Cobranza" es parametrizable**
   (`p_clave_cargo_eje`). `'PAGO_CLIENTE'` es sólo el último recurso si no llega
   nada; no está hardcodeada la lógica.

7. **La verificación de §48 corre contra lo ya escrito**, no contra el plan: se
   consulta la suma real del detalle en la base y se compara con el header. Un
   descuadre aborta la transacción.

---

## Lo que esta HU deliberadamente no tocó

- **`J_FACTURAS` / `J_FACTURAS_DETALLE`** — ver supuesto 1.
- **El módulo Pagos Referenciados** — hoy la captura del pago vive en el subtab nuevo. Conectar el botón "Aplicar" de ese módulo a `aplicarPagoReferenciado()` es un cambio pequeño y aislado, pero requiere decidir si reemplaza su flujo actual.
- **ESPECIFICACIONES 1, 2 y 3** — §58.9 pide no modificarlas. Sólo se extendieron las dos tablas de CxC con los campos que §11/§19 exigen.
