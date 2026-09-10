# HU — REQ-18: Banca 2º Piso — Calendario de Comisiones, Avisos de Vencimiento y Envío Prelación

> **Origen:** requerimiento funcional capturado el 31/08/2026.
> Extiende [REQ-17](REQ-17_Modulo_Banca_2o_Piso.md), que dejó el módulo **Banca 2º Piso**
> con sus 6 subpestañas actuales. Esta HU agrega las 3 que faltan para poder
> administrar el cobro de la garantía y disparar la cascada de pagos.
> Se apoya en [REQ-8](REQ-8_Garantia_Financiera_2o_Piso.md), que definió el subtab
> **Prelación 2º Piso** a nivel producto.
> Traducido a alcance técnico contra el código real de
> `src/app/components/banca-2o-piso/`, `src/app/components/cartera/` y
> `src/app/types/productoLineaCredito.ts`.

---

## Requerimiento original (transcripción, para trazabilidad)

> **I. AGREGAR SUB-PESTAÑAS**
> Agregar en Banca 2º Piso las subpestañas.
>
> - **Calendario de Comisiones**
> - **Avisos de Vencimiento**
>   *Nota: Igual que en las otras carteras selecciono una línea de comisión y genero el "Aviso de Vencimiento".*
> - **Envío Prelación** (En la sección de "Default" agregar un sub-status ("Operación Normal", "Botón Pánico") (Por Default ese campo debe de iniciar con operación normal)
>   - Al dar click "Generar Prelación" si el sub-status = "Operación Normal" genera los registros que están definidos en el producto en la subpestaña "Prelación 2º Piso" sub-sección "Operación Normal" con **"Pago de la Comisión por Garantía Financiera (Banobras / Segundo Piso)" = Suma de los Monto del Aviso Vencimiento con estatus "Pendiente"**.
>   - Al dar click "Generar Prelación" si el sub-status = "Botón de Pánico" genera los registros que están definidos en el producto en la subpestaña "Prelación 2º Piso" sub-sección "Botón de Pánico" con **"Pago de Intereses y Capital del Crédito de Recuperación (Banobras)" = Suma del Campo "Saldo" de los Crédito Simples que están en la subpestaña "Disposiciones" y el Estatus crédito "Activo"**. *Nota: este punto queda pendiente.*

---

## Contexto técnico (verificado en código, NO re-investigar)

### Dónde viven las subpestañas hoy

[Banca2oPisoDetalle.tsx:19-26](../src/app/components/banca-2o-piso/Banca2oPisoDetalle.tsx#L19-L26)
declara el arreglo `TABS`. Hoy son 6:

```
default · terminos · expediente · cargos · solicitudes-ext · disposiciones
```

Agregar una subpestaña son dos puntos en ese archivo: una entrada en `TABS` y un
bloque `{activeTab === '<id>' && (...)}` en el render.

### El molde de "Aviso de Vencimiento" ya existe y es reutilizable

La cartera de Crédito ya hace exactamente lo que pide el requerimiento
("selecciono una línea y genero el aviso"):

| Pieza | Dónde |
|---|---|
| UI: selección múltiple con checkbox + modal + totales | [AmortizacionesTab.tsx](../src/app/components/cartera/AmortizacionesTab.tsx) |
| Disparo | [AmortizacionesTab.tsx:105](../src/app/components/cartera/AmortizacionesTab.tsx#L105) `handleAvisoVencimiento` |
| Backend | [useCarteraDB.ts:252](../src/app/hooks/useCarteraDB.ts#L252) `crearAvisoVencimiento()` → `POST /cartera/facturas` |
| Bandeja donde caen | [AvisosVencimientoModule.tsx](../src/app/components/avisos-vencimiento/AvisosVencimientoModule.tsx) |

Firma real de `crearAvisoVencimiento`:

```ts
crearAvisoVencimiento(payload: {
  solicitud_id: string;
  amortizaciones: Amortizacion[];   // ← los renglones seleccionados
  sub_tipo?: string;                // ← 'Amortizacion' en Crédito
  cliente: string;
  forma_pago?: string;
  fecha_compromiso?: string;
  moneda?: string;
  institucion_financiera?: string;
  cuenta_bancaria?: string;
  referencia?: string;
}): Promise<{ ok: boolean; error?: string; factura_id?: string }>
```

**Consecuencia de diseño:** no hay que inventar backend para Avisos. Se reusa el
mismo endpoint con un `sub_tipo` propio (p. ej. `'ComisionGPO'`), mapeando el
renglón de comisión al shape que la función ya espera.

### La configuración de Prelación 2º Piso ya está en el producto (REQ-8)

[productoLineaCredito.ts:93-106](../src/app/types/productoLineaCredito.ts#L93-L106):

```ts
export type EscenarioPrelacion2oPiso = 'OPERACION_NORMAL' | 'BOTON_PANICO';

export interface PrelacionSegundoPiso {
  id: number;
  escenario: EscenarioPrelacion2oPiso;  // discriminante de la sub-sección
  seq: number | string;                 // orden de la cascada
  concepto: string;                     // texto del renglón
  valor: string;
}
```

Se guarda en `ProductoLineaCredito.prelacion2oPiso` como **un solo array** con
discriminante `escenario` — no dos arrays. El motor de cascada filtra por
`escenario` y ordena por `seq`. Los dos valores del enum corresponden 1-a-1 con
los dos sub-status que pide esta HU.

### El origen de las comisiones ya se calcula (REQ-8 / Cierre Comercial)

El flujo de comisiones GPO se genera en el Cierre Comercial de la Oportunidad
(`construirSimulacionComisionGPO` en `OportunidadForm.tsx`) y viaja a la
Solicitud en `data.solicitud.simulacion.resultado_simulacion`, con este shape por
renglón: `no_pago`, `fecha_pago`, `pago_interes` (la comisión), `iva_interes`,
`pago_total`, `saldo_insoluto` (el Monto Garantizado, que no se amortiza).

**Ojo — límite conocido:** ese cálculo genera **un solo año** de comisiones
(Anual→1, Semestral→2, Trimestral→4, Mensual→12 renglones), porque nació como
*cotización*. El Calendario de Comisiones de una línea viva necesita **todo el
plazo** (p. ej. 20 años × periodicidad). Ver §Decisión 1.

### Datos disponibles en la fila de la línea

[banca2oPisoStore.ts:54](../src/app/components/banca-2o-piso/banca2oPisoStore.ts#L54)
— `LineaCreditoRow extends CarteraCredito` y expone, ya leídos de BD (no de
sessionStorage): `terminosRaw` (`terminos_condiciones._raw`, que trae
`montoGarantizadoGpo`, `tasaComisionAnualPactada`, `periodicidadCobroGpo`,
`porcentajeCoberturaGpo`, `sectorInfraestructura`), `cargos`, `productoId`.

### Bloqueo real para "Botón de Pánico"

La subpestaña **Disposiciones** es hoy un placeholder
([Banca2oPisoDetalle.tsx:156](../src/app/components/banca-2o-piso/Banca2oPisoDetalle.tsx#L156)
→ `<DisposicionesPendiente />`). El propio componente lo dice: *"El sistema no
tiene todavía un modelo de datos para las disposiciones ejercidas sobre una
línea"*. Como el escenario Botón de Pánico se calcula sumando el `Saldo` de los
Créditos Simples **de esa subpestaña**, no hay de dónde leer.

Esto coincide con la nota del propio requerimiento (*"este punto queda
pendiente"*) y se refleja en el alcance: **CA-14 queda fuera de esta entrega.**

---

## Historias de usuario

### HU-18.1 — Calendario de Comisiones

> **Como** administrador de Banca 2º Piso
> **quiero** ver el calendario de comisiones de la línea
> **para** saber qué se le va a cobrar al emisor y cuándo.

| CA | Criterio de aceptación |
|---|---|
| CA-01 | Existe la subpestaña **Calendario de Comisiones** en el detalle de la línea. |
| CA-02 | Muestra una tabla con: **N.º**, **Fecha**, **Comisión del Periodo**, **IVA del Periodo**, **Total** y **Estatus**. |
| CA-03 | El pie muestra los totales de Comisión, IVA y Total, y el número de renglones. |
| CA-04 | El número de renglones lo determina la **Periodicidad de Cobro** y el **Plazo** de la línea (ver §Decisión 1). |
| CA-05 | Es de **solo lectura**: el calendario no se edita a mano desde aquí. |
| CA-06 | Si la línea no tiene datos de comisión (Monto Garantizado, Tasa o Periodicidad), se muestra un vacío explicativo diciendo **cuál** falta, no una tabla en blanco. |

### HU-18.2 — Avisos de Vencimiento

> **Como** administrador de Banca 2º Piso
> **quiero** seleccionar renglones de comisión y generar su Aviso de Vencimiento
> **para** iniciar el cobro igual que en las demás carteras.

| CA | Criterio de aceptación |
|---|---|
| CA-07 | Existe la subpestaña **Avisos de Vencimiento**. |
| CA-08 | Permite **seleccionar uno o varios renglones** de comisión con checkbox, con "seleccionar todos los pendientes", igual que [AmortizacionesTab](../src/app/components/cartera/AmortizacionesTab.tsx). |
| CA-09 | El botón **Generar Aviso de Vencimiento** abre el modal con: cliente, forma de pago, fecha compromiso, moneda, institución financiera, cuenta bancaria y referencia — mismos campos que la cartera de Crédito. |
| CA-10 | Al confirmar, se llama a `crearAvisoVencimiento()` con `sub_tipo: 'ComisionGPO'` y el aviso queda visible en el módulo **Avisos de Vencimiento**. |
| CA-11 | Sin selección, el botón avisa `"Seleccione al menos una comisión"` y no llama al backend. |
| CA-12 | Los renglones ya avisados quedan marcados y no se pueden volver a seleccionar (evita doble cobro). |
| CA-13 | El listado muestra el **estatus** de cada aviso (`Pendiente`, `Pagado`, `Cancelado`), porque HU-18.3 depende de él. |

### HU-18.3 — Envío Prelación

> **Como** administrador de Banca 2º Piso
> **quiero** generar la cascada de pagos según el modo de operación de la línea
> **para** instruir la prelación con los montos correctos.

| CA | Criterio de aceptación |
|---|---|
| CA-14 | En **Default** hay un campo **Sub-Status** con dos opciones: `Operación Normal` y `Botón de Pánico`. |
| CA-15 | Al alta, el Sub-Status **inicia siempre en `Operación Normal`**. |
| CA-16 | El Sub-Status **se persiste** en la línea y sobrevive a recargar (ver §Decisión 2). |
| CA-17 | Existe la subpestaña **Envío Prelación** con el botón **Generar Prelación**. |
| CA-18 | Con Sub-Status = `Operación Normal`, se generan los renglones del producto en `prelacion2oPiso` filtrando `escenario === 'OPERACION_NORMAL'`, **ordenados por `seq`**. |
| CA-19 | En esa cascada, el renglón **"Pago de la Comisión por Garantía Financiera (Banobras / Segundo Piso)"** toma como valor la **suma de los Montos de los Avisos de Vencimiento con estatus `Pendiente`** de esa línea. |
| CA-20 | Los demás renglones conservan el `valor` configurado en el producto. |
| CA-21 | La prelación generada se muestra en pantalla como cascada ordenada (secuencia, concepto, valor) y **se persiste** (ver §Decisión 3). |
| CA-22 | Si el producto no tiene renglones configurados para el escenario, se avisa `"El producto no tiene Prelación 2º Piso configurada para <escenario>"` y **no** se genera nada. |
| CA-23 | Si no hay Avisos con estatus `Pendiente`, el renglón de comisión se genera en **0.00** y se advierte al usuario, en vez de fallar en silencio. |
| CA-24 | *(Fuera de alcance en esta entrega — ver §Bloqueo)* Con Sub-Status = `Botón de Pánico`, se generan los renglones con `escenario === 'BOTON_PANICO'`, y **"Pago de Intereses y Capital del Crédito de Recuperación (Banobras)"** = suma del campo **Saldo** de los Créditos Simples de la subpestaña **Disposiciones** con Estatus crédito `Activo`. |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | La comisión GPO **no amortiza capital**: el Monto Garantizado permanece constante en todos los periodos. La única salida de dinero por periodo es comisión + IVA. |
| RN-02 | Comisión del periodo = `Monto Garantizado × (Tasa Comisión Anual ÷ 100) ÷ periodos_por_año`, con `periodos_por_año` = Mensual 12, Trimestral 4, Semestral 2, Anual 1. |
| RN-03 | El IVA se toma del subtab **IVA %** del producto; si no está capturado, 16%. |
| RN-04 | La prelación es una **cascada ordenada**: `seq` define la prioridad de pago y no se altera al generar. |
| RN-05 | Sólo los Avisos en estatus `Pendiente` alimentan el renglón de comisión de la prelación. Un aviso `Pagado` o `Cancelado` ya no se debe.  |
| RN-06 | El Sub-Status es un atributo **de la línea**, no del producto: dos líneas del mismo producto pueden estar en modos distintos. |
| RN-07 | Cambiar el Sub-Status **no** regenera prelaciones anteriores; sólo afecta la siguiente que se genere. Las ya emitidas quedan como histórico. |

---

## Decisiones pendientes (requieren respuesta antes de implementar)

### Decisión 1 — Alcance del Calendario de Comisiones

El cálculo que existe hoy produce **un solo año**. Para una línea viva a 20 años
hacen falta las 3 opciones siguientes:

| Opción | Implicación |
|---|---|
| **(a) Generar todo el plazo** (recomendada) | 20 años × periodicidad. Mensual = 240 renglones. Requiere paginar la tabla. Es lo que de verdad se cobra. |
| (b) Reflejar sólo 1 año | Reusa tal cual lo que ya viaja en la Solicitud, pero el calendario queda incompleto y no sirve para cobrar el año 2 en adelante. |
| (c) Generar por año, bajo demanda | Menos renglones en pantalla, pero agrega un selector de año y complica los Avisos. |

**Recomendación:** (a). Es la única que permite que Avisos y Prelación operen
durante toda la vida de la línea. La primera generación se puede disparar con un
botón **Generar Calendario** (mismo patrón que "Cotizar").

### Decisión 2 — Dónde vive el Sub-Status

`DefaultTab` está **compartido** con Cartera Crédito
([Banca2oPisoDetalle.tsx:14](../src/app/components/banca-2o-piso/Banca2oPisoDetalle.tsx#L14)
lo importa de `../cartera/DefaultTab`). Meter el campo ahí lo filtraría a
carteras donde no aplica.

| Opción | Implicación |
|---|---|
| **(a) Envolver `DefaultTab` en Banca 2º Piso** (recomendada) | Se renderiza el `DefaultTab` compartido y **debajo** un bloque propio "Operación de la Línea" con el Sub-Status. Cero impacto en Cartera Crédito. |
| (b) Agregar el campo a `DefaultTab` con una prop `mostrarSubStatus` | Un condicional más en un componente ya compartido por 3 módulos. |

**Persistencia recomendada:** `data.solicitud.banca2oPiso.subEstatus` dentro del
JSONB de `J_CUENTAS_CORP_CLIENTES` — no requiere migración de columnas y sigue el
patrón de `terminos_condiciones._raw`. **Cuidado:** aplicar la guarda por valor
*truthy* al escribirlo, no `!== undefined`, para no repetir el borrado silencioso
documentado en `useSolicitudesDB.ts:399`.

### Decisión 3 — Dónde se persiste la prelación generada

| Opción | Implicación |
|---|---|
| **(a) En el JSONB de la línea** (recomendada) | `data.solicitud.prelacionGenerada[]` con fecha, usuario, escenario y renglones. Sin migración. Suficiente si la prelación es un documento de instrucción. |
| (b) Tabla nueva `J_PRELACION` | Correcto si la prelación necesita consultarse de forma transversal (todas las líneas) o alimentar contabilidad. Requiere migración + RPCs. |

**Recomendación:** (a) para esta entrega; migrar a (b) si más adelante se pide un
módulo de consulta de prelaciones.

### Decisión 4 — ¿La prelación se puede regenerar?

¿Un segundo "Generar Prelación" **reemplaza** la anterior o **agrega** una nueva
versión al histórico? Recomendación: **agregar** (histórico inmutable, igual que
la Bitácora de Estatus de Oportunidades), porque los montos cambian conforme se
pagan avisos.

---

## Bloqueo declarado

> **Actualización 31/08/2026 —
> [REQ-20](REQ-20_Disposiciones_2o_Piso_Saldo_Garantia.md) levantó parte de este
> bloqueo, pero NO todo.** Disposiciones ya tiene modelo de datos (una
> disposición es una Solicitud colgada de la línea) y ya se pueden dar de alta y
> listar. Lo que **sigue faltando** para CA-24 es el campo **`Saldo`** por
> disposición y su **`Estatus crédito`**: hoy una disposición tiene monto
> solicitado, monto autorizado y estatus *de solicitud*, que no es lo mismo que
> el saldo insoluto de un Crédito Simple activo. Ese dato nace con la
> amortización/revolvencia, que REQ-20 dejó explícitamente fuera (§Decisión 3).
> **CA-24 sigue sin poder implementarse**, pero por una razón más chica que antes.

**CA-24 (Botón de Pánico) no se puede implementar en esta entrega.** Depende de la
subpestaña **Disposiciones**, que hoy es un placeholder sin modelo de datos: no
existen los Créditos Simples, ni su campo `Saldo`, ni su `Estatus crédito`. El
requerimiento ya lo anticipa (*"este punto queda pendiente"*).

Lo que **sí** se deja listo en esta entrega para que el día que exista Disposiciones
sea un cambio pequeño:

- El selector de Sub-Status con las dos opciones (CA-14).
- El filtrado por `escenario` ya soporta `'BOTON_PANICO'` — el tipo existe desde REQ-8.
- Al elegir `Botón de Pánico` y presionar Generar Prelación, se muestra un mensaje
  explícito de "pendiente de Disposiciones" en vez de generar una cascada con 0.00
  que se confundiría con un dato real.

---

## Alcance

**Dentro:**
- 3 subpestañas nuevas en `Banca2oPisoDetalle.tsx`.
- Campo Sub-Status en Default (envuelto, sin tocar el `DefaultTab` compartido).
- Generación y persistencia del Calendario de Comisiones.
- Generación de Avisos reusando `crearAvisoVencimiento()`.
- Generación de Prelación para el escenario **Operación Normal**.

**Fuera:**
- Escenario **Botón de Pánico** (bloqueado, ver §Bloqueo).
- Modelo de datos de Disposiciones (es una HU propia).
- Contabilización de la prelación (correspondería a un REQ de motor contable, como REQ-13/REQ-15).
- Cambios en el módulo Avisos de Vencimiento: los avisos GPO caen ahí con el
  backend que ya existe; sólo se distinguen por `sub_tipo`.

---

## Plan de implementación sugerido

| # | Paso | Archivo |
|---|---|---|
| 1 | Resolver Decisiones 1–4 | — |
| 2 | Agregar los 3 ids a `TABS` | [Banca2oPisoDetalle.tsx:19](../src/app/components/banca-2o-piso/Banca2oPisoDetalle.tsx#L19) |
| 3 | `CalendarioComisionesTab.tsx` — cálculo (RN-02/RN-03) + tabla + totales | `banca-2o-piso/` |
| 4 | Envolver Default con el bloque de Sub-Status + persistencia | `banca-2o-piso/` |
| 5 | `AvisosComisionTab.tsx` — selección múltiple + modal, calcado de `AmortizacionesTab` | `banca-2o-piso/` |
| 6 | `EnvioPrelacionTab.tsx` — lee `prelacion2oPiso` del producto, filtra escenario, sustituye el renglón de comisión con la suma de avisos `Pendiente` | `banca-2o-piso/` |
| 7 | Verificar contra datos reales de Supabase (no sólo `tsc`) | — |

---

## Trazabilidad

| Requerimiento | HU / CA |
|---|---|
| Subpestaña Calendario de Comisiones | HU-18.1 · CA-01…CA-06 |
| Subpestaña Avisos de Vencimiento | HU-18.2 · CA-07…CA-13 |
| "Igual que en las otras carteras selecciono una línea y genero el Aviso" | CA-08, CA-09, CA-10 |
| Sub-status en Default, default Operación Normal | CA-14, CA-15, CA-16 |
| Generar Prelación — Operación Normal | CA-17…CA-23 |
| Comisión = suma de Avisos `Pendiente` | CA-19 |
| Generar Prelación — Botón de Pánico | CA-24 (bloqueado) |
| "este punto queda pendiente" | §Bloqueo |
