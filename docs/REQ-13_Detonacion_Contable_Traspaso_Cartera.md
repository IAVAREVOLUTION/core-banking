# HU — REQ-13: Detonación Contable y Traspaso a Cartera (Fin del BPM)

> **Origen:** BPM del producto *Garantía Financiera 2o Piso* — Etapa 7 (Formalización y
> Cierre), **Actividad 7.2: "Detonación Contable y Traspaso a Cartera (Fin del BPM)"**,
> Fase 5, capturado el 28/08/2026. **Última actividad del BPM completo** — no hay
> continuación después de esta HU.
> Traducido a alcance técnico contra el código real de
> **`src/app/components/solicitudes/`** y **`src/app/hooks/`**.

---

## Requerimiento original (transcripción, para trazabilidad)

**Objetivo:** desactivar la solicitud en el LOS, pasar el estatus de la operación a
"En Administración" (Cartera Activa) y realizar el asiento contable de apertura en el
libro mayor.

**Descripción de negocio:** esta actividad es ejecutada automáticamente por el Core de
forma interna al presionar el botón de la Actividad 7.1. Transforma el "expediente de
papel" de la originación en una obligación contingente viva dentro del catálogo del
banco, lista para cobrar comisiones mensuales.

### Pantalla de Éxito del Sistema

- **Mensaje:** "¡Solicitud Formalizada con Éxito!"
- **Campos generados por el Core:**
  - `ID_Garantia_Cartera`: ej. `GPO-2026-0045` (identificador oficial de cartera).
  - `Póliza_Contable_Apertura`: ej. `POL-CONT-88392` (vínculo al asiento de cuentas de
    orden).
- **Botón:** *[Ir a Monitoreo de Cartera GPO]*.

---

## Contexto técnico (verificado en código, NO re-investigar)

### La "Actividad 7.1" no existe como HU ni pantalla separada

Búsqueda en `docs/REQ-*.md`: no hay ninguna HU numerada como "7.1". El requerimiento la
da por hecha ("al presionar el botón de la Actividad 7.1") pero nunca se documentó ni
se construyó como paso propio.

Lo más cercano que existe **hoy en código** es el botón final de fase — "Enviar de
Fase" / flujo de activación — al completar la **última fase configurada del producto**
(fase 5, "Activación de Línea 2o Piso"). Ese botón ya dispara una secuencia real en
[SolicitudCreditoForm.tsx](../src/app/components/solicitudes/SolicitudCreditoForm.tsx)
(~línea 2670-2712):

```ts
const actResult = await activarCuentaDB(actDbId, {
  estatus_sol: 'Aprobado', estatus_cuen: 'Activa',
  estatus_disp: 'Pagado',  estatus_cart: 'Activa',
}, formData.lineaProducto);
// ...
const cuentaResult = await crearCuentaDesdeSolicitudDB({ solicitudId: actDbId, ... });
```

**Decisión de esta HU:** tratar ESE mismo punto (fin de la fase 5) como el disparador
real de la Actividad 7.2 — no crear un botón nuevo "7.1" separado. Ver §Decisiones
pendientes #1 si el negocio prefiere separarlos.

### GPO ya pasa por un flujo de "activación" — pero genera lo que NO es

`crearCuentaDesdeSolicitudDB`
([useSolicitudesDB.ts:1302](../src/app/hooks/useSolicitudesDB.ts#L1302)) corre para
**cualquier producto de la línea "Línea de Crédito"** — y GPO tiene
`lineaProducto = 'Línea de Crédito'` (su `tipoProducto` es "Garantía Financiera 2o
Piso" dentro de esa línea), así que este código **ya se ejecuta hoy para GPO**. Genera:

- Un `noCuenta` vía `generateNoCuentaInterno()` — formato `01{AA}{MM}{6 dígitos
  aleatorios}` (p. ej. `0126083451920`).
- Un registro nuevo en `J_CUENTAS_CORP_CLIENTES`.

**Esto NO es lo que pide el requerimiento.** `J_CUENTAS_CORP_CLIENTES` modela una
*cuenta* (depósito/línea vigente) — GPO es una **garantía contingente fuera de
balance**, un concepto distinto. Reusar el mismo folio/tabla mezclaría dos naturalezas
de producto. `ID_Garantia_Cartera` necesita su propio folio — ver Alcance §2.

### SÍ existe infraestructura real de pólizas contables — a diferencia del cupo de REQ-12

A diferencia del bloqueo de cupo (REQ-12), que no tenía ninguna pieza construida, el
"asiento contable de apertura" **sí tiene un módulo funcional ya construido**:
[PolizasContablesModule.tsx](../src/app/components/polizas-contables/PolizasContablesModule.tsx),
respaldado por la tabla `J_GL_JOURNAL_ENCABEZADO`, con endpoint real:

```
POST {API_BASE}/gl-journal   → crea una póliza
PUT  {API_BASE}/gl-journal/{id} → edita una póliza
```

(implementado en
[PolizaContableForm.tsx:195](../src/app/components/polizas-contables/PolizaContableForm.tsx#L195),
usado hoy **solo desde el formulario manual** — nadie lo llama automáticamente todavía).

La interfaz `PolizaContable`
([PolizasContablesModule.tsx:6-27](../src/app/components/polizas-contables/PolizasContablesModule.tsx#L6-L27))
**ya anticipa** el vínculo con una Solicitud — el JSONB `data` declara
`solicitud_id?` y `evento?` como campos, aunque hoy nadie los llena:

```ts
data: { evento?: string; prompt_ia?: string; catalogo_id?: string; solicitud_id?: string; [key: string]: any };
```

Esto reduce el riesgo de esta HU frente a REQ-12: **el mecanismo de guardado existe y
funciona**, sólo falta llamarlo automáticamente con los datos correctos.

### BLOQUEANTE — qué cuentas contables debitar/acreditar no es una decisión técnica

`PolizaContable.account_id` y `event_code` son libres (`text`) — el código no valida
contra un catálogo de cuentas contables. **No hay forma de inferir del código qué
cuenta de "cuentas de orden" usa este banco para garantías contingentes GPO** — eso
vive en el catálogo contable institucional, que no está en este repositorio. Ver
§Decisiones pendientes #2 — es el bloqueante mayor de esta HU, análogo al bloqueante
de infraestructura de cupo en REQ-12.

### El estatus "En Administración" no existe

[`CAT_ESTATUS_SOLICITUD`](../src/app/components/solicitudes/solicitudCreditoStore.ts)
(extendido en REQ-12 con `'Aprobada por CIC'` / `'Rechazada Definitivamente'`) no tiene
`'En Administración'`. Mismo patrón de extensión que REQ-12 — ver Alcance §4.

### "Cartera GPO" no existe como módulo ni como destino de navegación

Búsqueda exhaustiva de "Cartera GPO", "Monitoreo de Cartera", "ID_Garantia",
"Póliza_Contable", "cuentas de orden": **cero resultados** fuera de este
requerimiento. Los módulos de cartera que sí existen en el menú (`Cartera crédito`,
`Cartera Arrendamiento`, `Cartera inversión`, `Cartera ahorro`) no tienen una vista
GPO-específica. El botón `[Ir a Monitoreo de Cartera GPO]` no tiene a dónde ir hoy —
ver §Decisiones pendientes #3.

### El monto a asentar ya está capturado — sin recalcular nada

`terminos.montoGarantizadoGpo` ("Monto Máximo Contingente", Emisión × % Cobertura) ya
lo calculó y mostró REQ-9
([EstructuraOperativa2oPisoTab.tsx:273](../src/app/components/solicitudes/EstructuraOperativa2oPisoTab.tsx#L273)).
Es el mismo campo que ya usa REQ-12 para el monto de la operación en el Oficio del
CIC. Se reutiliza tal cual — no hay que volver a capturarlo ni recalcularlo.

---

## Objetivo

Que, al completarse la última fase de una Solicitud GPO, el sistema genere
automáticamente un folio oficial de garantía en cartera y una póliza contable de
apertura (usando la infraestructura de Pólizas Contables ya existente), actualice el
estatus a "En Administración", y muestre una pantalla de éxito dedicada — dejando
explícitamente documentado, mientras no se resuelva qué cuentas contables corresponden,
que el asiento se genera con datos de encabezado reales pero cuentas contables
provisionales/configurables.

---

## Alcance

> El folio de garantía, el estatus nuevo y la pantalla de éxito son implementables sin
> depender de ninguna decisión pendiente. **La cuenta contable real del asiento y el
> destino del botón de monitoreo SÍ dependen** — ver Decisiones pendientes.

### 1. Disparador — mismo punto donde hoy corre la activación de GPO

Envolver la secuencia existente de fin-de-fase-5 en
`SolicitudCreditoForm.tsx` (~línea 2670) con una rama condicional a `esGPOForm`
(bandera ya existente de REQ-9), **sin modificar el comportamiento actual para
productos que no son GPO** (el `crearCuentaDesdeSolicitudDB` genérico sigue corriendo
igual para Línea de Crédito normal).

### 2. Generación de `ID_Garantia_Cartera` — folio nuevo, NO reusar `noCuenta`

Formato propuesto, siguiendo el ejemplo del requerimiento (`GPO-2026-0045`):
`GPO-{AAAA}-{secuencial de 4 dígitos}`. Al no existir una tabla de secuenciales
dedicada, la opción más simple sin infraestructura nueva es un componente
pseudo-aleatorio de 4 dígitos (mismo criterio ya usado para folios de oficio en
REQ-12) — un secuencial real por año requeriría una tabla/contador dedicado (ver
§Decisiones pendientes #4).

### 3. Póliza Contable de Apertura — usa el mecanismo REAL ya construido

`POST {API_BASE}/gl-journal` con:

| Campo | Valor |
|---|---|
| `journal_date` | Fecha de activación |
| `producto_id` | `formData.productoId` |
| `event_code` | `'APERTURA_GARANTIA_GPO'` (nuevo, propuesto) |
| `account_id` | **Decisión pendiente #2** — placeholder configurable mientras tanto |
| `currency` | `'MXN'` |
| `total_debit` / `total_credit` | `terminos.montoGarantizadoGpo` (mismo monto en ambos — asiento de cuentas de orden, partida y contrapartida por el mismo importe) |
| `status` | `'Creada'` |
| `data.evento` | `'Apertura de Garantía Financiera 2o Piso'` |
| `data.solicitud_id` | `storageId` |
| `data.no_sol` | `formData.noSol` |

El `id` que regresa el POST (o un folio derivado) es el `Póliza_Contable_Apertura`
mostrado en pantalla.

### 4. Estatus "En Administración"

Agregar a `CAT_ESTATUS_SOLICITUD` — mismo patrón que REQ-12:

```ts
{ value: 'En Administración', label: 'En Administración (Cartera Activa)' },
```

Se asigna en vez de (o junto con) el `'Aprobado'` actual, sólo para `esGPOForm`.

### 5. Pantalla de Éxito

Reemplaza (o se muestra encima) el toast genérico actual de "Cuenta creada
exitosamente". Contenido: mensaje "¡Solicitud Formalizada con Éxito!",
`ID_Garantia_Cartera`, `Póliza_Contable_Apertura`, botón `[Ir a Monitoreo de Cartera
GPO]`.

### 6. Botón [Ir a Monitoreo de Cartera GPO]

Sin un módulo "Cartera GPO" real (§Decisiones pendientes #3), el botón debe declarar
honestamente su destino real — no simular una navegación que no lleva a nada útil.

---

## Criterios de aceptación

1. **CA-01** — Al completar la última fase de una Solicitud GPO, se genera un
   `ID_Garantia_Cartera` con formato `GPO-{AAAA}-####` y se muestra en pantalla.
2. **CA-02** — Se crea una póliza contable real (fila nueva en `J_GL_JOURNAL_ENCABEZADO`
   vía `POST /gl-journal`) con `data.solicitud_id` apuntando a esta Solicitud.
3. **CA-03** — La póliza creada es visible en el módulo Pólizas Contables existente,
   sin necesitar ningún cambio en ese módulo.
4. **CA-04** — El monto de la póliza coincide exactamente con
   `terminos.montoGarantizadoGpo` de la Solicitud.
5. **CA-05** — El estatus de la Solicitud queda en `'En Administración'`, visible en la
   lista de Solicitudes y en el header del formulario.
6. **CA-06** — La pantalla de éxito muestra el mensaje, ambos folios, y el botón de
   monitoreo — sin bloquear si el usuario la cierra sin hacer clic en el botón.
7. **CA-07** — Repetir la activación sobre la misma Solicitud no crea una segunda
   póliza ni un segundo `ID_Garantia_Cartera` (idempotencia — mismo criterio que
   REQ-9/10/12).
8. **CA-08** — Para productos que NO son GPO, el flujo de activación existente
   (`crearCuentaDesdeSolicitudDB`) sigue funcionando exactamente igual que hoy.
9. **CA-09** — Guardar, recargar la app y reabrir la Solicitud: `ID_Garantia_Cartera`,
   `Póliza_Contable_Apertura` y el estatus `'En Administración'` persisten.

---

## Decisiones pendientes (bloquean parte del alcance)

**1. ¿La Actividad 7.1 es un paso separado o el mismo botón de "Enviar de Fase"
   final?** Esta HU asume que es el mismo botón (opción más simple, sin nueva UI). Si
   el negocio quiere un paso de "Formalización" explícito y distinto de la
   "Activación" actual, es una HU aparte antes de esta.

**2. Cuenta(s) contable(s) del asiento de apertura.** Bloqueante mayor — requiere el
   catálogo de cuentas de orden del banco para garantías contingentes GPO. Sin esto:
   - (a) Usar un `account_id`/`event_code` **placeholder configurable** (constante en
     código, fácil de cambiar cuando el negocio confirme el catálogo real) — la póliza
     se crea con datos reales de encabezado pero cuenta contable provisional.
   - (b) No generar la póliza automáticamente hasta tener el catálogo — sólo generar
     `ID_Garantia_Cartera` y dejar la póliza para captura manual en el módulo
     existente.
   **Recomiendo (a):** dejarlo explícito en la UI/nota de la póliza ("cuenta contable
   provisional — pendiente de confirmar con Contabilidad"), igual que REQ-12 declaró
   el cupo como "constancia, no bloqueo real" mientras no había infraestructura.

**3. Destino de [Ir a Monitoreo de Cartera GPO].** Sin módulo "Cartera GPO":
   - (a) Deshabilitar el botón con un tooltip ("Monitoreo de Cartera GPO — próximamente").
   - (b) Apuntarlo a un módulo de cartera existente (p. ej. `Cartera crédito`) como
     aproximación, aunque no filtre específicamente GPO.
   - (c) Construir el módulo "Monitoreo de Cartera GPO" — HU aparte, de tamaño
     comparable a un módulo de cartera nuevo completo.
   **Recomiendo (a):** es lo único que no promete algo que no existe.

**4. Formato exacto y unicidad de `ID_Garantia_Cartera`.** ¿Basta un componente
   aleatorio (como el resto de folios de este proyecto — Oficio CIC, firma CPC), o el
   negocio necesita un secuencial estrictamente correlativo por año (requeriría una
   tabla de contador dedicada, con el mismo riesgo de condición de carrera que el cupo
   de REQ-12 si dos activaciones ocurren casi al mismo tiempo)?

---

## Fuera de alcance (y por qué)

| Tema | Motivo |
|---|---|
| Módulo "Monitoreo de Cartera GPO" completo | No existe ningún módulo de cartera GPO-específico — es una HU de tamaño propio (decisión #3) |
| Cálculo/cobro real de comisiones mensuales sobre la garantía | El requerimiento solo menciona que la garantía queda "lista para cobrar" — no pide implementar el cobro en esta HU |
| Paso "Actividad 7.1" como pantalla separada | Se asume fusionado con el botón de activación existente (decisión #1) |
| Validación del `account_id` contra un catálogo contable real | No existe catálogo de cuentas en este repositorio (decisión #2) |
| "Desactivar la solicitud en el LOS" como acción distinta de cambiar su estatus | El estatus `'En Administración'` ya comunica que salió del flujo de originación activo — no hay un concepto separado de "solicitud desactivada" en el modelo de datos actual |

---

## Advertencias

- **No confundir `ID_Garantia_Cartera` con `noCuenta`** — son conceptos distintos
  (garantía contingente vs. cuenta). No reusar la tabla `J_CUENTAS_CORP_CLIENTES` para
  esto sin que el negocio lo confirme explícitamente.
- **No dejar que el `account_id` provisional se vea como un dato oficial** — si se
  implementa la opción (a) de la decisión #2, la UI y la nota de la póliza deben decir
  con todas sus letras que es provisional. Mismo principio que REQ-12: un dato
  contable falso que parece real es peor que no tenerlo.
- **Idempotencia** — sin ella, reintentar la activación (p. ej. tras un error de red)
  generaría pólizas y folios duplicados, cada uno con su propio asiento contable real
  contra la misma Solicitud.
- **No romper el flujo de activación de Línea de Crédito normal** — `esGPOForm` debe
  envolver SOLO el comportamiento nuevo; `crearCuentaDesdeSolicitudDB` sigue
  ejecutándose para todos los productos como hoy (CA-08).

---

## Orden de ejecución

1. Confirmar la decisión #1 (mismo botón vs. paso separado) — condiciona dónde se
   engancha el código.
2. Extender `CAT_ESTATUS_SOLICITUD` con `'En Administración'`.
3. Implementar la generación de `ID_Garantia_Cartera` (folio + guardado en la
   Solicitud).
4. Implementar la llamada a `POST /gl-journal` con los campos de la tabla del Alcance
   §3, usando el placeholder de la decisión #2 si no hay respuesta de negocio.
5. Construir la pantalla de éxito con ambos folios y el botón de monitoreo resuelto
   según la decisión #3.
6. Probar CA-07, CA-08 y CA-09 corriendo la app — idempotencia y no-regresión del
   flujo de Línea de Crédito normal son los que no se ven en un typecheck.
