# HU — REQ-17: Módulo "Banca 2º Piso"

> **Origen:** requerimiento funcional capturado el 28/08/2026.
> Se apoya en [REQ-15](REQ-15_Cargos_Automaticos_GPO_Componentes_Contables.md) y
> [REQ-16](REQ-16_Poliza_Apertura_Linea_Fase5_Cargos_Solicitud.md), que dejan la cuenta
> de Línea de Crédito ya activada y contabilizada — este módulo es la vista de
> administración posterior.
> Traducido a alcance técnico contra el código real de `src/app/components/cartera/`,
> `src/app/components/solicitudes/` y el registro de módulos de `App.tsx`.

---

## Requerimiento original (transcripción, para trazabilidad)

> Crear un módulo nuevo llamado **"Banca 2º Piso"** que siga el estándar, que muestre
> únicamente **Línea de Producto = Línea de Crédito** que estén **activas**.
> Las subpestañas del módulo serán: **Default, Términos y Condiciones, Expediente
> Electrónico, Solicitudes Extraordinarias y Disposiciones**.

---

## Estado de implementación (28/08/2026)

**Código — hecho** (`tsc --noEmit`: 0 errores):

| Entregable | Dónde |
|---|---|
| Shell del módulo con sub-navegación **Inicio / Lista** (mismo patrón que Solicitudes) | [Banca2oPisoModule.tsx](../src/app/components/banca-2o-piso/Banca2oPisoModule.tsx) |
| **Inicio** — 4 KPIs, líneas recientes, distribución por estatus, evolución mensual, monto por institución y por producto | [Banca2oPisoDashboard.tsx](../src/app/components/banca-2o-piso/Banca2oPisoDashboard.tsx) |
| **Lista** institucional — barra de vista + refrescar, filtro por estatus, búsqueda, exportación, tabla y paginación | [Banca2oPisoList.tsx](../src/app/components/banca-2o-piso/Banca2oPisoList.tsx) |
| **Detalle** con las 5 subpestañas | [Banca2oPisoDetalle.tsx](../src/app/components/banca-2o-piso/Banca2oPisoDetalle.tsx) |
| Filtro, tipos y hook de datos (aparte, para que CarteraList no cargue las gráficas) | [banca2oPisoStore.ts](../src/app/components/banca-2o-piso/banca2oPisoStore.ts) |
| Registro en el shell (unión, menú, render) | [App.tsx:73](../src/app/App.tsx#L73), [:718](../src/app/App.tsx#L718), [:1474](../src/app/App.tsx#L1474) |
| Exclusión de las mismas filas en Cartera Crédito | [CarteraList.tsx:42](../src/app/components/cartera/CarteraList.tsx#L42) |

**Decisiones aplicadas** (se tomaron las recomendadas de esta HU al pedirse "aplícalo"):

| # | Aplicado |
|---|---|
| 1 | **Disposiciones**: pestaña visible con el estado "pendiente de definición funcional" y qué falta decidir. No se simuló funcionalidad ni se inventó modelo de datos. |
| 2 | **Se excluyen de Cartera Crédito** las Líneas de Crédito *ya activas*, con el helper compartido `esLineaCredito2oPisoRow`. Las que aún no están activas siguen en Cartera: así ninguna cuenta se administra en dos módulos ni desaparece de ambos. |
| 3 | **Activa** = `Activa`, `Autorizada`, `En Administración`. Nunca `Finiquitado`, `Cancelada` ni `Pendiente`. |
| 4 | **Términos y Condiciones**: vista de sólo lectura sobre `terminos_condiciones._raw`, con un bloque extra de Garantía Financiera 2o Piso que sólo aparece si la Solicitud trae esos campos, y otro de Formalización con el folio de garantía y la póliza de REQ-13/REQ-16. |
| 5 | Filtra por **Línea de Producto = Línea de Crédito**, tal como pide el requerimiento — no sólo el producto *Garantía Financiera 2o Piso*. |

**Reuso, sin duplicar componentes:** `DefaultTab` y `SolicitudesExtTab` de cartera, y
`ExpedienteElectronicoTab` de solicitudes en `mode='ver'`.

**Verificado sin levantar la app** ( completo, sin errores): el filtro real, extraído y ejecutado, acierta en los
10 casos probados — reconoce `Linea de Credito` / `Línea de Crédito` / `LÍNEA DE CRÉDITO`
con los tres estatus activos, y descarta Crédito, Arrendamiento, Captación, `Pendiente`,
`Finiquitado`, `Cancelada` y valores vacíos.

**Falta:** probar el módulo en la app con datos reales (CA-01 a CA-08) y resolver la
§Decisión #1 para habilitar Disposiciones.

---

## Contexto técnico (verificado en código, NO re-investigar)

### El "estándar" existe y tiene un molde exacto

El módulo más cercano es **Cartera Crédito**: [CarteraList.tsx](../src/app/components/cartera/CarteraList.tsx)
(hook de fetch + `ViewState` `inicio | lista | sol-ext | detalle` + gráficas) y
[CarteraForm.tsx:41-48](../src/app/components/cartera/CarteraForm.tsx#L41-L48) (detalle con
`TABS`). Ese form **ya tiene** la pestaña *Solicitudes Extraordinarias* que pide esta HU.

El alta de un módulo en el shell son tres puntos de [App.tsx](../src/app/App.tsx):

| Punto | Dónde |
|---|---|
| Unión de módulos | [App.tsx:72](../src/app/App.tsx#L72) — `type Module = … \| 'banca-2o-piso'` |
| Entrada de menú | [App.tsx:717](../src/app/App.tsx#L717) — junto a las carteras |
| Rama de render | [App.tsx:1472](../src/app/App.tsx#L1472) — `currentModule === '…' ? <Módulo /> : …` |

Sin router: la navegación es por estado, como el resto de la app.

### La fuente de datos ya está y trae los dos campos del filtro

`useCreditos()` dentro de `CarteraList` pega a `/solicitudes-credito` y mapea, entre otros,
`linea_produc` → `lineaProducto`, `estatus_sol` → `estatus`, `no_cuenta`, `monto_aut` y los
términos de `data.solicitud.terminos_condiciones._raw`
([CarteraList.tsx:40-72](../src/app/components/cartera/CarteraList.tsx#L40-L72)).

**El filtro de esta HU es sobre datos que ya vienen en esa respuesta.** No hace falta
endpoint nuevo.

### Ya hay precedente de "una cartera por línea de producto"

Cartera Arrendamiento se separó de Cartera Crédito con `esArrendamientoPuroRow`, y
`CarteraList` **excluye** esas filas para no mostrarlas dos veces
([CarteraList.tsx:41-47](../src/app/components/cartera/CarteraList.tsx#L41-L47)).

> **Consecuencia directa:** si Banca 2º Piso muestra las Líneas de Crédito activas, esas
> mismas cuentas **seguirán apareciendo en Cartera Crédito** salvo que se las excluya ahí,
> igual que se hizo con Arrendamiento. Hay que decidirlo explícitamente
> (§Decisiones pendientes #2), no dejarlo pasar.

### Tres de las cinco subpestañas son reutilizables casi tal cual

| Subpestaña | Componente | Veredicto |
|---|---|---|
| Default | [cartera/DefaultTab.tsx](../src/app/components/cartera/DefaultTab.tsx) — props `{ credito: CarteraCredito }` | **Reusable tal cual** |
| Solicitudes Extraordinarias | [cartera/SolicitudesExtTab.tsx](../src/app/components/cartera/SolicitudesExtTab.tsx) — props `{ solicitudId, usuario }` | **Reusable tal cual** |
| Expediente Electrónico | [solicitudes/ExpedienteElectronicoTab.tsx:543](../src/app/components/solicitudes/ExpedienteElectronicoTab.tsx#L543) — `{ mode, solicitudId, faseIdActual, productoId, … }` | Montable en `mode='ver'`; hay que alimentarle `faseIdActual` y `productoId` |
| Términos y Condiciones | [solicitudes/TerminosCondicionesTab.tsx:289](../src/app/components/solicitudes/TerminosCondicionesTab.tsx#L289) | **Con reservas** — ver abajo |
| Disposiciones | — | **NO EXISTE** — ver bloqueante |

`TerminosCondicionesTab` recibe **más de 20 props** y está construido para *capturar*
dentro del formulario de Solicitud: sincroniza con el header, recalcula contra el producto
y la cotización, y emite callbacks de validación. Montarlo aquí en `mode='ver'` funciona,
pero arrastra `productoSeleccionado` y el resto del contexto de captura. La alternativa es
una vista de sólo lectura que pinte `terminos_condiciones._raw` —que la fila ya trae— sin
lógica de recálculo.

### BLOQUEANTE — "Disposiciones" no existe en ningún lado

Búsqueda exhaustiva de `disposicion` / `disposiciones` en `src/` y `supabase/`: lo único
que hay es **configuración a nivel producto** —"Condiciones de Disposición" y "Productos
Disposición" en [ProductoLineaCreditoForm.tsx:742](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx#L742)—
y menciones en texto. **No hay tabla, ni endpoint, ni componente, ni tipo** que represente
una disposición ejercida sobre una línea.

Es decir: las otras cuatro pestañas son ensamblaje; ésta es funcionalidad nueva completa
—modelo de datos, persistencia y UI— y no puede estimarse hasta definir qué es una
disposición en este sistema. Ver §Decisiones pendientes #1.

---

## Objetivo

Que la administración de las Líneas de Crédito activas tenga su propia entrada, con el
mismo estándar visual y de navegación del resto de carteras, sin mezclarlas con el resto
de la cartera de crédito y sin duplicar los componentes que ya existen.

---

## Alcance

### 1. Módulo `banca-2o-piso` — NUEVO

Archivos nuevos en `src/app/components/banca-2o-piso/`, con la misma separación que el
módulo Solicitudes (dashboard aparte del listado):

- `Banca2oPisoModule.tsx` — shell con `ViewState` `inicio | lista | detalle` y la
  sub-navegación **Inicio / Lista de Líneas**.
- `Banca2oPisoDashboard.tsx` — vista Inicio: 4 KPIs, líneas recientes, distribución por
  estatus, evolución de los últimos 6 meses, monto por institución y por producto. Todas
  las series salen de datos reales, no de constantes de ejemplo.
- `Banca2oPisoList.tsx` — listado institucional **calcado de `SolicitudCreditoList`**:
  header con Lista/Buscar, barra Ver + Refrescar, barra de Filtros, iconos de exportación
  con Orden y Total, tabla de cabecera gris con encabezados en mayúsculas y zebra
  #EEEEEE/#FFFFFF, y paginación de cuatro botones. Sin botón Nuevo (las líneas nacen de
  una Solicitud activada) y con "Ver" como enlace en la primera columna, sin Editar.
- `Banca2oPisoDetalle.tsx` — detalle con el formato de `CarteraForm`: cabecera con
  flecha de regreso, estatus y marca de sólo lectura, barra de chips con los datos clave,
  sub-tabs sobre `bg-primary-theme` (activo en `bg-secondary-theme`) y contenido sobre
  lienzo gris con cada pestaña en su caja blanca.
- `banca2oPisoStore.ts` — tipos, filtro compartido y hook de datos.

Registro en `App.tsx` en los tres puntos de la tabla de arriba, con la entrada de menú
**"Banca 2º Piso"** junto a las carteras.

### 2. Filtro del listado

```
lineaProducto ⊃ "línea de crédito"   (normalizado, sin acentos)
Y estatus ∈ <conjunto de estatus activos>   (§Decisión #3)
```

Ambos campos vienen ya mapeados. El filtro es del listado, no del endpoint.

### 3. Subpestañas

| # | Pestaña | Implementación |
|---|---|---|
| 1 | Default | Montar `DefaultTab` con la fila seleccionada |
| 2 | Términos y Condiciones | Según §Decisión #4: `TerminosCondicionesTab` en `ver`, o vista de sólo lectura sobre `terminos_condiciones._raw` |
| 3 | Expediente Electrónico | `ExpedienteElectronicoTab` en `mode='ver'`, con `solicitudId`, `productoId` y `faseIdActual` de la fila |
| 4 | Solicitudes Extraordinarias | Montar `SolicitudesExtTab` con `solicitudId` |
| 5 | Disposiciones | **Bloqueada** por §Decisión #1 |

---

## Criterios de aceptación

1. **CA-01** — "Banca 2º Piso" aparece en el menú lateral y abre su listado.
2. **CA-02** — El listado muestra **sólo** cuentas con Línea de Producto = Línea de
   Crédito; ninguna de Crédito simple, Arrendamiento, Captación o Inversión.
3. **CA-03** — El listado muestra **sólo** las activas, según el conjunto de estatus que
   se resuelva en la §Decisión #3.
4. **CA-04** — Con cero resultados, el listado lo dice explícitamente (no una tabla vacía
   sin explicación).
5. **CA-05** — Al abrir una cuenta se ven las cinco pestañas, y las cuatro implementadas
   cargan datos reales de esa cuenta.
6. **CA-06** — La pestaña Expediente Electrónico es de sólo lectura: no permite cargar ni
   validar documentos desde aquí.
7. **CA-07** — Crear una Solicitud Extraordinaria desde este módulo la deja visible
   también en la gestión global (`SolicitudesExtGestion`), sin duplicarla.
8. **CA-08** — Ninguna cuenta aparece a la vez en este módulo y en Cartera Crédito
   (condicionado a la §Decisión #2).

---

## Decisiones — aplicadas al implementar

> Se resolvieron con las opciones recomendadas de esta sección. La #1 sigue abierta
> como definición funcional: la pestaña existe pero declara que está pendiente.

**1. Qué es una "Disposición".** Es la única pestaña sin nada detrás. Falta definir, como
mínimo: qué campos tiene (fecha, monto, plazo, tasa, destino, estatus), si consume saldo
disponible de la línea, si genera su propia tabla de amortización, si detona póliza
contable (encajaría con el motor contable de REQ-16) y si se captura aquí o llega de otro
proceso. Sin eso, la pestaña puede entregarse **visible y vacía con un aviso de "en
construcción"**, o quedar fuera de esta entrega.

**2. ¿Se excluyen de Cartera Crédito?** Si no, la misma cuenta se administra desde dos
módulos. El precedente de Arrendamiento dice que sí se excluyen. Recomendada: excluirlas,
con el mismo mecanismo (`esLineaCreditoRow`) para no duplicar criterio.

**3. Qué cuenta como "activa".** El catálogo real que aparece en las filas incluye
`Activa`, `Autorizada`, `En Administración` (la que fija REQ-13 al formalizar la garantía),
`Finiquitado`, `Cancelada`. Hace falta la lista exacta. Recomendada: `Activa`,
`Autorizada` y `En Administración`; nunca `Finiquitado` ni `Cancelada`.

**4. Términos y Condiciones: ¿componente compartido o vista propia?**
- (a) Reusar `TerminosCondicionesTab` en `mode='ver'` — cero duplicación, pero arrastra el
  contexto de captura y cualquier cambio futuro en la Solicitud impacta aquí.
- (b) **Recomendada** — vista de sólo lectura sobre `terminos_condiciones._raw`, que la
  fila ya trae: es la mitad del código y no acopla la administración a la captura.

**5. ¿Sólo GPO o toda Línea de Crédito?** El nombre dice "2º Piso" pero el filtro pedido
dice "Línea de Producto = Línea de Crédito", que incluye productos que no son de segundo
piso (hoy existen `Línea de Crédito Agropecuario` y otros `Simple`). Se implementa **lo
que dice el filtro**; si la intención era sólo el producto *Garantía Financiera 2o Piso*,
hay que decirlo, porque cambia el listado.

---

## Fuera de alcance (y por qué)

| Tema | Motivo |
|---|---|
| Edición de la cuenta desde este módulo | El requerimiento describe consulta/administración, no captura |
| Amortizaciones, Movimientos, Generación Contable | No están entre las cinco pestañas pedidas, aunque existan en Cartera |
| Dashboard con gráficas propias | El estándar las tiene, pero el requerimiento pide el listado; se puede sumar después |
| Alta de disposiciones | Bloqueada por la §Decisión #1 |
| Permisos por rol | No hay sistema de usuarios/roles (mismo bloqueante de REQ-11/REQ-12) |

---

## Advertencias

- **No duplicar componentes.** Cuatro de las cinco pestañas ya existen; el trabajo es
  ensamblarlas, no reescribirlas. Copiar `DefaultTab` o `SolicitudesExtTab` a la carpeta
  nueva crearía dos versiones que se desincronizan.
- **`ExpedienteElectronicoTab` monta lógica pesada** (validación IA, generación de
  documentos de fase). En `mode='ver'` no debe poder disparar nada de eso: revisar que los
  botones de acción queden ocultos con ese modo.
- **El endpoint devuelve toda la cartera**: el filtro es en cliente. Con volumen alto habrá
  que mover el filtro al servidor, pero hoy es el mismo camino que ya usan las otras
  carteras.
- **`no_cuenta` puede venir vacío** en cuentas que no pasaron por activación: el listado no
  debe romperse ni mostrar "undefined".

---

## Orden de ejecución

1. ~~Resolver las decisiones #3 y #5~~ — aplicadas.
2. ~~Crear el módulo y registrarlo en los tres puntos de `App.tsx`~~ — hecho.
3. ~~Ensamblar Default y Solicitudes Extraordinarias~~ — hecho, por reuso.
4. ~~Expediente Electrónico en `mode='ver'`~~ — hecho.
5. ~~Términos y Condiciones~~ — hecho, vista de sólo lectura.
6. **Pendiente:** resolver la §Decisión #1 para habilitar Disposiciones.
7. ~~Aplicar la §Decisión #2 en `CarteraList`~~ — hecho.
8. **Pendiente:** probar en la app con datos reales (CA-01 a CA-08).
