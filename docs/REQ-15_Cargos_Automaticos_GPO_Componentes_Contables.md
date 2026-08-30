# HU — REQ-15: Cargos automáticos de la Solicitud GPO y Componentes Contables en "Tipo de Cargo"

> **Origen:** requerimiento funcional capturado el 28/08/2026 sobre el producto
> *Garantía Financiera 2o Piso*, Fase 4 **"Validación de Cláusulas Fiduciarias"**.
> Comparte disparador con [REQ-14](REQ-14_Contrato_GPO_Propuesta_Formalizacion_Legal.md)
> (el botón *Ejecutar Formalización Legal y Cierre de Solicitud*).
> Traducido a alcance técnico contra el código real de
> **`src/app/components/productos/tabs/CargoTab.tsx`**,
> **`src/app/components/solicitudes/`** y el catálogo de Componentes Contables.

---

## Requerimiento original (transcripción, para trazabilidad)

> En la fase VALIDACIÓN DE CLÁUSULAS FIDUCIARIAS, en la pestaña Cargos, vamos a crear un
> concepto llamado […].
>
> Cuando se autorice esa fase, que vaya a la pestaña Cargos del producto en uso y me copie
> los cargos que se configuren en el subtab "Cargos" del producto. Solamente me voy a
> llevar el concepto, pero el monto de la solicitud es el monto de la garantía: **Monto
> Garantizado GPO** será el monto que vamos a meter en cargos de la solicitud. El cargo se
> creará en automático con base en el cargo que existe en el producto.
>
> El "Tipo de Cargo" debería cargar sus elementos del **catálogo de Componentes
> Contables**.

---

## Estado de implementación (28/08/2026)

**Código — hecho** (`tsc --noEmit`: 0 errores):

| Entregable | Dónde |
|---|---|
| Hook de sólo lectura del catálogo de Componentes Contables | [useComponentesContablesCatalogo.ts](../src/app/hooks/useComponentesContablesCatalogo.ts) |
| "Tipo de Cargo" del **producto** desde el catálogo | [CargoTab.tsx:243](../src/app/components/productos/tabs/CargoTab.tsx#L243), [:342](../src/app/components/productos/tabs/CargoTab.tsx#L342) |
| "Tipo de Cargo" de la **Solicitud** desde el catálogo | [SolicitudCargosTab.tsx:23-24](../src/app/components/solicitudes/SolicitudCargosTab.tsx#L23-L24) |
| Copia automática de cargos al autorizar la Fase 4 | [SolicitudCreditoForm.tsx:1157](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1157) |
| Rehidratación de Cargos desde BD al reabrir la Solicitud | [SolicitudCreditoList.tsx:340](../src/app/components/solicitudes/SolicitudCreditoList.tsx#L340), [:862](../src/app/components/solicitudes/SolicitudCreditoList.tsx#L862) |

**Falta — captura, no código:** dar de alta en el subtab **Cargos** del producto GPO el o
los conceptos que deben copiarse (el requerimiento dejó el nombre en blanco). El catálogo
de Componentes Contables ya tiene un candidato natural: **13 · Provisionamiento de
Garantía**.

---

## Contexto técnico (verificado en código, NO re-investigar)

### El disparador es el mismo de REQ-14

"Autorizar la fase" = el botón *Ejecutar Formalización Legal y Cierre de Solicitud*, que
es el **Enviar de Fase** reetiquetado ([FaseActionsComponent.tsx:396](../src/app/components/shared/FaseActionsComponent.tsx#L396)).
La copia de cargos se engancha en el mismo bloque `saliendoDeClausulasFiduciarias` de
`handleEnviarFase`, justo después de la generación de la propuesta de contrato.

### "Sólo me llevo el concepto" no es una decisión: es lo único que hay

El cargo del producto **no tiene monto**. Su shape completo, en
[CargoTab.tsx:6-14](../src/app/components/productos/tabs/CargoTab.tsx#L6-L14):

```ts
interface Cargo { id; productId; lineaProducto; sublinea; tipoCargo; descripcion; moneda }
```

Se guarda en `data.cargo` del jsonb de `J_PRODUCTOS`
([ProductoLineaCreditoForm.tsx:389](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx#L389))
y se lee como `producto.cargos`
([useProductosLineaCreditoDB.ts:203](../src/app/hooks/useProductosLineaCreditoDB.ts#L203)).
El de la Solicitud sí lo tiene
([solicitudCreditoStore.ts:292-300](../src/app/components/solicitudes/solicitudCreditoStore.ts#L292-L300)):

```ts
interface CargoSolicitud { id; tipoCargo; descripcion; monto; fechaCargo; estatus; notas }
```

### LIMITACIÓN REAL (ya cerrada) — Cargos casi no persistía

`'cargos'` **no está** en `subtabKeys`
([SolicitudCreditoForm.tsx:1871](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L1871) y
[:3207](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L3207)), y
`preloadSubtabsFromDBData` tampoco lo rehidrataba. Sólo llega a BD cuando el formulario lo
mete a mano en `_allSubtabs`, al enviar a originación
([SolicitudCreditoForm.tsx:2878](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L2878)).
El mapeo a BD sí existe y está listo
([useSolicitudesDB.ts:369](../src/app/hooks/useSolicitudesDB.ts#L369) y
[:697](../src/app/hooks/useSolicitudesDB.ts#L697)).

En Fase 4 ese envío quedó muy atrás, así que un cargo creado ahí viviría **sólo en
sessionStorage**. Por eso la implementación persiste explícitamente en el momento de
generarlos, por el mismo camino (`onSave({ …, _allSubtabs: { cargos } })`).

> **Cerrado (28/08/2026):** `preloadSubtabsFromDBData` ya rehidrata `data.cargos` en sus
> dos caminos. Era seguro hacerlo: las líneas calculadas de Arrendamiento llevan el
> prefijo `ARR_` y el efecto de recálculo de `SolicitudCargosTab` las reemplaza en cada
> montaje, preservando las manuales — así que un `ARR_` que venga de BD no se duplica.

### Los dos "Tipo de Cargo" estaban hardcodeados, y con listas distintas

| Dónde | Qué tenía |
|---|---|
| Producto | `TIPO_CARGO_OPTIONS = ['IVA', 'CAPITAL', 'INTERÉS']` |
| Solicitud | `CAT_TIPO_CARGO` — Comisión por apertura, Seguro de vida, Gastos notariales, Avalúo… ([solicitudCreditoStore.ts:1083](../src/app/components/solicitudes/solicitudCreditoStore.ts#L1083)) |

Es decir: un cargo capturado en el producto **nunca** coincidía con las opciones de la
Solicitud. Copiar el concepto sin unificar el catálogo habría producido cargos con un
`tipoCargo` que el select de la Solicitud no sabe mostrar.

### El catálogo real y por qué se hizo un hook nuevo

Componentes Contables vive en `ComponentesContablesSection`, con endpoint
`componentes-contables` de `make-server-7e2d13d9`, cache en sessionStorage
(`config_componentes_contables_v1`) y shape `{ id, codigo, nombre }`. Su hook
`useComponentesContablesDB` es **CRUD y no está exportado**, y el módulo arrastra XLSX y
jsPDF. Se creó `useComponentesContablesCatalogo` — sólo lectura, mismo endpoint y mismo
cache — para no tocar esa pantalla ni arrastrar sus dependencias a los formularios.

---

## Objetivo

Que el "Tipo de Cargo" deje de ser una lista inventada en dos lugares distintos y salga
del catálogo contable, y que al cerrar la Fase 4 de una Solicitud GPO los cargos del
producto queden reflejados en la Solicitud con el monto que realmente corresponde: el
Monto Garantizado GPO.

---

## Alcance

### 1. Catálogo de Componentes Contables en "Tipo de Cargo" (producto y Solicitud)

`useComponentesContablesCatalogo()` devuelve `opcionesTipoCargo` con
`value = nombre` y `label = "13 · Provisionamiento de Garantía"`. Reglas:

- Si el catálogo responde (o hay cache), manda el catálogo.
- Si no hay nada, el select **no queda vacío**: el producto cae a
  `TIPO_CARGO_FALLBACK` (los tres valores previos) y la Solicitud a `CAT_TIPO_CARGO`.
- Un valor capturado antes (o de un componente ya borrado del catálogo) **se conserva**
  como opción extra, para que reabrir un cargo viejo no lo pierda en silencio.
- Debajo del select, la leyenda dice de dónde salieron las opciones.

### 2. Copia automática de cargos al ejecutar la Formalización Legal

En el bloque `saliendoDeClausulasFiduciarias`, después de generar la propuesta de contrato:

1. Lee los cargos del producto (`producto.cargos` → `rawData.cargo`).
2. Lee `terminos.montoGarantizadoGpo`.
3. Por **cada** cargo del producto crea un `CargoSolicitud` con:
   `tipoCargo` y `descripcion` del producto, `monto = Monto Garantizado GPO`,
   `fechaCargo` = hoy, `estatus = 'Pendiente'`, y una nota que dice de dónde salió.
4. **Idempotente:** no duplica; la clave es `tipoCargo|descripcion` normalizado.
5. Persiste en `sessionStorage` + `savedStore` y llama a
   `onSave({ …, _allSubtabs: { cargos } })`.
6. **No bloquea el avance de fase** (misma RN-03 de REQ-14). Avisa cuando:
   - el producto no tiene cargos configurados;
   - la Solicitud no tiene Monto Garantizado GPO;
   - los cargos ya estaban generados;
   - la persistencia en BD falló.

---

## Criterios de aceptación

1. **CA-01** — El select "Tipo de Cargo" del modal *Nuevo Cargo* del producto muestra los
   componentes del catálogo contable, con su código.
2. **CA-02** — El select "Tipo de Cargo" de la pestaña Cargos de la Solicitud muestra ese
   mismo catálogo.
3. **CA-03** — Sin conexión al catálogo, ninguno de los dos selects queda vacío.
4. **CA-04** — Un cargo guardado con un tipo que ya no está en el catálogo sigue
   mostrando su valor al reabrirlo.
5. **CA-05** — Al pulsar *Ejecutar Formalización Legal y Cierre de Solicitud* en una
   Solicitud GPO, la pestaña Cargos muestra un cargo por cada cargo configurado en el
   producto, con monto = Monto Garantizado GPO.
6. **CA-06** — Ejecutarlo dos veces no duplica los cargos.
7. **CA-07** — Sin cargos en el producto, o sin Monto Garantizado GPO, el avance de fase
   ocurre igual y el usuario recibe un aviso que dice cuál de las dos cosas faltó.
8. **CA-08** — Los cargos generados viajan a BD (`data.cargos` de la Solicitud).
9. **CA-09** — Cerrar la app, reabrir la Solicitud y entrar a Cargos: los cargos generados
   siguen ahí, leídos de BD.
10. **CA-10** — En una Solicitud de Arrendamiento, reabrir no duplica el desglose de
    Desembolso Inicial (las líneas `ARR_` de BD las reemplaza el recálculo).

---

## Decisiones tomadas

- **Qué se copia** → **todos** los cargos del producto, cada uno con el Monto Garantizado
  GPO completo. Es lo que dice el requerimiento literal.
- **Dónde aplica el catálogo** → en el producto **y** en la Solicitud, para que los
  conceptos copiados coincidan con las opciones del select de destino.
- **Cómo se persiste** → explícitamente al generarlos, por el mismo camino que ya usa el
  envío a originación, en vez de meter `'cargos'` en `subtabKeys`: eso habría hecho que
  los cargos de **Arrendamiento** —que hoy son una vista previa calculada— empezaran a
  persistir en cada cambio de fase, un efecto colateral fuera de este requerimiento.
  La lectura de vuelta sí es general: `preloadSubtabsFromDBData` rehidrata `data.cargos`
  para cualquier producto.

---

## Decisiones pendientes

**1. Qué concepto dar de alta en el producto.** El requerimiento dejó el nombre en blanco.
Hasta que exista al menos un cargo en el subtab Cargos del producto GPO, la copia
automática no tiene nada que copiar (CA-07 lo avisa).

**2. ¿El monto lleva IVA?** El catálogo tiene componentes de IVA (`03`, `06`, `09`, `12`).
Hoy todos los cargos copiados llevan el mismo importe bruto: el Monto Garantizado GPO. Si
un cargo de tipo IVA debiera calcularse sobre otro, hace falta la regla.

---

## Fuera de alcance (y por qué)

| Tema | Motivo |
|---|---|
| Contabilizar los cargos (póliza) | El motor contable es otro flujo; esta HU sólo deja el cargo registrado en la Solicitud |
| Recalcular los cargos si cambia el Monto Garantizado después | La copia es un acto puntual del cierre de fase; no hay watcher |
| Editar el catálogo de Componentes Contables desde el producto | El alta/edición sigue en Configuración → Catálogos Contables |
| Cargos por sublínea o por moneda | El requerimiento no distingue; se copia lo que haya configurado |

---

## Advertencias

- **`CargoTab` es compartido** por Producto Crédito, Captación y Línea de Crédito: el
  cambio de catálogo aplica a los tres. Es ampliación de opciones, no restricción.
- **El cache del catálogo se comparte** con la pantalla de Configuración
  (`config_componentes_contables_v1`): si el usuario da de alta un componente ahí, el
  select lo ve sin recargar la app.
- **Un solo acordeón montado a la vez**: la pestaña Cargos de la Solicitud lee
  sessionStorage al montarse, así que los cargos recién generados aparecen al abrirla
  después del cierre de fase.
