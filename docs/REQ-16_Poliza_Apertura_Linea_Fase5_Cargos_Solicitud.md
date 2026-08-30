# HU — REQ-16: Cargo Solicitud y Póliza Contable de Fase 5 desde la guía "APERTURA_LINEA"

> **Origen:** requerimiento funcional capturado el 28/08/2026 sobre el producto
> *Garantía Financiera 2o Piso*.
> Continúa a [REQ-15](REQ-15_Cargos_Automaticos_GPO_Componentes_Contables.md) (cargos de
> la Solicitud) y **colisiona con** [REQ-13](REQ-13_Detonacion_Contable_Traspaso_Cartera.md),
> que ya genera una póliza en Fase 5 — ver §Contexto técnico.
> Traducido a alcance técnico contra el código real del Motor Contable del producto y del
> módulo Pólizas Contables.

---

## Requerimiento original (transcripción, para trazabilidad)

> **Cargo Solicitud** — en "Tipo Cargo" mostrar el catálogo de Componentes Contables.
>
> **FASE 5** — generar una póliza contable con base en la guía contabilizadora
> **"APERTURA_LINEA"**, que está definida en la subpestaña *Motor Contable* del producto en
> cuestión, o del producto de la solicitud.

---

## Estado de implementación (28/08/2026)

**Código — hecho** (`tsc --noEmit`: 0 errores):

| Entregable | Dónde |
|---|---|
| `EVENT_CODE_APERTURA_LINEA` + `leerGuiaContabilizadora()` | [formalizacionCarteraGPO.ts:32](../src/app/hooks/formalizacionCarteraGPO.ts#L32), [:84](../src/app/hooks/formalizacionCarteraGPO.ts#L84) |
| `construirDetallePoliza()` — cruce guía × cargos por componente | [formalizacionCarteraGPO.ts:112](../src/app/hooks/formalizacionCarteraGPO.ts#L112) |
| Póliza con evento, detalle y totales de la guía (o degradación) | [formalizacionCarteraGPO.ts:200](../src/app/hooks/formalizacionCarteraGPO.ts#L200) |
| Validación de cuadre antes de postear | misma función |
| El llamador pasa Motor Contable + Cargos y avisa del resultado | [SolicitudCreditoForm.tsx:2762](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L2762) |

**Decisión #1 aplicada:** opción (a) — el importe de cada partida sale de los **Cargos de
la Solicitud** (REQ-15), cruzando `cargo.tipoCargo` con `fila.componente`. Sub-decisión:
una fila de la guía **sin Cargo que la respalde se omite** del detalle (una partida en cero
no aporta al asiento) y se reporta en el toast.

**Verificado sin levantar la app** — funciones reales extraídas, transpiladas y ejecutadas
contra una guía de ejemplo:

- filtra por evento y descarta filas de otros eventos; hace match por `codigo` y por nombre;
- cada fila con importe genera dos partidas (8001 débito / 8501 crédito) y los totales cuadran;
- suma varios cargos del mismo componente;
- normaliza acentos y mayúsculas al cruzar (`provisionamiento de garantia` = `Provisionamiento de Garantía`);
- un cargo en 0, o sin cargos, no genera partidas vacías: degrada a póliza sin desglose.

**Falta — captura, no código:** el evento `APERTURA_LINEA` en Catálogos Contables, las
cuentas de la guía (8001 / 8501) y las filas del Motor Contable del producto GPO. Sin eso,
la activación sigue generando la póliza de REQ-13 y avisa que no hay guía.

---

## Contexto técnico (verificado en código, NO re-investigar)

### El punto 1 ya está hecho

"Tipo Cargo desde el catálogo de Componentes Contables" se implementó en
[REQ-15](REQ-15_Cargos_Automaticos_GPO_Componentes_Contables.md), en los dos lados:
[SolicitudCargosTab.tsx:23-24](../src/app/components/solicitudes/SolicitudCargosTab.tsx#L23-L24)
y [CargoTab.tsx:243](../src/app/components/productos/tabs/CargoTab.tsx#L243). Se deja
aquí sólo por trazabilidad: **no hay trabajo nuevo en ese punto**.

### COLISIÓN — la Fase 5 YA genera una póliza

`formalizarGarantiaGPO` ([formalizacionCarteraGPO.ts](../src/app/hooks/formalizacionCarteraGPO.ts))
hace hoy un POST real a `/gl-journal` al entrar a Fase 5, disparado por
`formalizarGarantiaSiEsGPO`
([SolicitudCreditoForm.tsx:2759](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L2759),
invocado desde cuatro puntos del cierre). Esa póliza:

| | Hoy (REQ-13) | Lo que pide REQ-16 |
|---|---|---|
| `event_code` | `'APERTURA_GARANTIA_GPO'` **hardcodeado** | el evento de la guía, `APERTURA_LINEA` |
| Líneas de detalle | **ninguna** — `data` sólo lleva folios y una nota | `data.Detalle` armado desde la guía |
| Importes | `total_debit = total_credit = montoGarantizado`, sin desglose | por componente |
| Cuentas contables | ninguna | las de débito/crédito de cada fila de la guía |

**Ésta HU no crea una póliza nueva: reemplaza el contenido de la que ya se genera.** Dos
pólizas por la misma activación sería un error contable, no una mejora.

### "APERTURA_LINEA" no existe todavía en ningún lado

`grep -r "APERTURA_LINEA"` sobre `src/` y `docs/`: **cero resultados**. No es un valor que
el código deba reconocer por nombre: es un **evento contable** que hay que dar de alta en
Configuración → Catálogos Contables → *Eventos Contables*, y luego referenciar en las
filas del Motor Contable del producto. El código sólo debe **filtrar por él**.

### El Motor Contable guarda cuentas, no importes

[MotorContableTab.tsx:8-13](../src/app/components/productos/tabs/MotorContableTab.tsx#L8-L13):

```ts
interface MotorContableRow { evento; componente; debito; credito }
```

Los cuatro son **objetos de catálogo**, no números: `evento` de `/eventos-contables`,
`componente` de `/componentes-contables`, y `debito`/`credito` de `/catalogos-contables`
(cuentas GL). Se persiste en `data.motorContable` del producto
([ProductoLineaCreditoForm.tsx:411](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx#L411),
[useProductosLineaCreditoDB.ts:212](../src/app/hooks/useProductosLineaCreditoDB.ts#L212)).

La póliza, en cambio, guarda **importes por cuenta**
([PolizaContableForm.tsx:36-45](../src/app/components/polizas-contables/PolizaContableForm.tsx#L36-L45)):

```ts
interface DetalleRow {
  cuenta_contable_id; cuenta_contable_gl; cuenta_contable_nombre;
  debito; credito;                       // ← importes
  componente_id; componente_codigo; componente_nombre;
}
```

**Traducción:** cada fila de la guía produce **dos líneas de detalle** — una con importe
en `debito` sobre la cuenta de débito, otra con importe en `credito` sobre la de crédito.
Lo que la guía no dice es **cuánto**; eso lo aporta la Solicitud.

### De dónde salen los importes — aquí conectan REQ-15 y REQ-16

REQ-15 dejó los cargos de la Solicitud con un `tipoCargo` que sale **del mismo catálogo
de Componentes Contables** que usa el Motor Contable. Ése es el puente natural: cruzar
`cargo.tipoCargo` con `filaGuía.componente.nombre` da el importe de cada partida. La
alternativa —un solo importe (el Monto Garantizado GPO) repetido en todas las filas— es
lo que hace hoy REQ-13 y es justo lo que el requerimiento quiere superar.
Es el camino que se implementó — ver §Decisión tomada.

### El payload de póliza ya está definido y es reutilizable

[PolizaContableForm.tsx:181-192](../src/app/components/polizas-contables/PolizaContableForm.tsx#L181-L192):

```ts
{ journal_date, event_code, account_id, producto_id, currency, status,
  total_debit, total_credit, data: { Detalle: DetalleRow[] } }
```

`formalizarGarantiaGPO` ya postea con esa forma (sin `Detalle`). Agregar el detalle es
completar el mismo objeto, no montar una integración nueva.

### Pendiente heredado que esta HU NO resuelve

`account_id` es UUID con **llave foránea** a `J_CUENTAS_CORP_CLIENTES`: no admite un
código de cuenta contable. REQ-13 §Decisión #2 lo dejó apuntando provisionalmente a la
cuenta de la Solicitud, con la aclaración viajando en `data.nota`. Las cuentas GL reales
de la guía viven en el **detalle**, así que esta HU convive con ese pendiente sin
agravarlo — pero tampoco lo cierra.

---

## Objetivo

Que la póliza de activación de una Solicitud GPO deje de ser un asiento global sin
desglose y pase a construirse con la guía contabilizadora que Contabilidad configuró en
el producto: mismo evento, mismas cuentas y un renglón por componente.

---

## Alcance

### 1. Lectura de la guía

Función nueva `leerGuiaContabilizadora(producto, evento)` que devuelve las filas de
`producto.motorContable` (o `rawData.motorContable`) cuyo `evento` coincide con el código
buscado — comparación por `codigo` y por `evento` (nombre), normalizada sin acentos, ya
que el catálogo expone `{ id, codigo, evento }`.

Constante `EVENT_CODE_APERTURA_LINEA = 'APERTURA_LINEA'`.

### 2. Construcción del Detalle

Por cada fila de la guía, con el importe que le corresponda (§Decisión #1):

```
línea A: cuenta = fila.debito,  debito = importe,  credito = ''
línea B: cuenta = fila.credito, debito = '',       credito = importe
```

ambas con `componente_id/codigo/nombre` de la fila, para que la póliza sea legible en el
módulo Pólizas Contables sin cambios ahí.

`total_debit` y `total_credit` se recalculan sumando el detalle — no se copian del monto
global.

### 3. Sustitución del contenido de la póliza de Fase 5

`formalizarGarantiaGPO` pasa a recibir el producto (o directamente la guía) y:

- **Con guía configurada:** `event_code = 'APERTURA_LINEA'`, `data.Detalle` armado, y
  totales cuadrados desde el detalle.
- **Sin guía configurada:** conserva **exactamente** el comportamiento actual
  (`APERTURA_GARANTIA_GPO`, sin detalle) y avisa al usuario de que el producto no tiene
  la guía dada de alta. La activación **no se bloquea** por esto.

### 4. Validación de cuadre

Si `total_debit ≠ total_credit`, no se postea: se avisa con el descuadre y la póliza no
se crea a medias. Un asiento descuadrado en producción es peor que uno ausente.

---

## Criterios de aceptación

1. **CA-01** — Con el evento `APERTURA_LINEA` dado de alta y filas en el Motor Contable
   del producto, activar la Solicitud GPO genera **una** póliza con ese `event_code`.
2. **CA-02** — Esa póliza abre en el módulo Pólizas Contables mostrando el tab Detalle con
   una línea por partida, con su cuenta GL y su componente.
3. **CA-03** — `total_debit` = `total_credit` = suma del detalle.
4. **CA-04** — Sin guía configurada, la activación ocurre igual, se genera la póliza como
   hoy y el usuario recibe un aviso explícito.
5. **CA-05** — No se generan dos pólizas por la misma activación.
6. **CA-06** — Si el detalle no cuadra, no se crea la póliza y el mensaje dice de cuánto
   es el descuadre.
7. **CA-07** — Los folios (`id_garantia_cartera`, `folio_display`) y el
   `polizaContableApertura` que muestra la pantalla de éxito siguen funcionando igual.

---

## Decisiones pendientes (bloquean parte del alcance)

**1. Qué pasa con el evento actual `APERTURA_GARANTIA_GPO`.** ¿`APERTURA_LINEA` lo
sustituye por completo, o son dos eventos distintos (apertura de línea vs. apertura de la
garantía) que deberían generar dos pólizas? El requerimiento nombra sólo el primero.

**2. Alta de catálogo.** `APERTURA_LINEA` como evento contable, y las cuentas de la guía
—REQ-8 mencionaba **8001** (Garantías Financieras Otorgadas) y **8501** (Responsabilidades
por Garantías Financieras Otorgadas)— deben existir en el catálogo contable antes de que
esto haga algo visible.

---

## Fuera de alcance (y por qué)

| Tema | Motivo |
|---|---|
| Resolver el `account_id` provisional | Pendiente heredado de REQ-13 §Decisión #2; requiere definición de Contabilidad |
| Póliza de otros eventos (pago de comisión, ejecución de la garantía) | El requerimiento nombra sólo la apertura |
| Cambios en el módulo Pólizas Contables | La póliza generada usa el shape que ese módulo ya lee |
| Reversa/cancelación de la póliza | No hay mecanismo de reversa definido en el sistema |
| Motor Contable con fórmulas o porcentajes | Sólo si se elige la opción (c) de la decisión #1 |

---

## Advertencias

- **No generar dos pólizas.** La de REQ-13 se emite hoy en el mismo punto del flujo; esta
  HU cambia su contenido, no agrega otra.
- **`MotorContableTab` es compartido** con Producto Crédito: leer su contenido es
  inofensivo, pero cualquier cambio de shape afecta a los dos módulos.
- **Los objetos de la guía se guardaron completos** (`evento`, `componente`, `debito`,
  `credito` son objetos del catálogo tal como estaban al capturarse). Si una cuenta se
  renombra después en el catálogo, la guía conserva el nombre viejo: leer siempre el `id`
  para resolver, y el nombre sólo para mostrar.

---

## Decisión tomada

**De dónde sale el importe de cada partida** → de los **Cargos de la Solicitud** (REQ-15),
cruzados con la guía por componente contable. Las alternativas descartadas eran repetir el
Monto Garantizado GPO en cada fila (sólo cuadra con guías de una sola fila) y agregar
importes o fórmulas al Motor Contable (cambia el shape del subtab y su captura).

---

## Orden de ejecución

1. Alta de catálogo (decisión #2): evento `APERTURA_LINEA` y cuentas 8001/8501.
2. Capturar la guía en el subtab Motor Contable del producto GPO.
3. ~~Implementar `leerGuiaContabilizadora` + `Detalle` + validación de cuadre~~ — hecho.
4. ~~Cambiar `formalizarGarantiaGPO` para usar la guía~~ — hecho, con degradación.
5. Probar en la app: activar una Solicitud GPO y abrir la póliza resultante en Pólizas
   Contables (CA-01 a CA-06).
