# HU — REQ-8: Producto "Garantía Financiera 2o Piso" en Línea de Crédito

> **Origen:** requerimiento funcional del producto de Garantía de Pago Oportuno (GPO) de
> segundo piso, capturado el 21/08/2026.
> Traducido a alcance técnico contra el código real del módulo
> **Productos → Línea de Crédito**.
> El requerimiento original abarca 5 fases del ciclo completo (admisión → activación);
> **esta HU cubre exclusivamente la parametrización del producto** (subtabs y captura de
> prompts IA). La ejecución de las reglas vive en Originación/Solicitudes y se documenta
> aquí como §Fuera de alcance con su nota de continuidad.

---

## Requerimiento original (resumen, para trazabilidad)

Dar de alta en Línea de Crédito el producto **"Garantía Financiera 2o Piso"** con:

1. Periodos (Anual), Matriz Tasa Fija, Tasas de Referencia (TIIE/UDIS/CETES),
   Matriz Tasa Variable.
2. **Fases** — 5 fases con nombres largos + un **PROMPT AI** por fase.
   Nota literal del requerimiento: *"EXTENDER EL CAMPO A VARCHAR(100)"*.
3. **Requisitos** por fase (7 en Fase 1, 4 en Fase 2, 3 en Fase 3, 6 en Fase 4,
   más los automáticos).
4. **Prelación** — agregar la subpestaña, con dos escenarios de cascada de pagos:
   **Operación Normal** y **Botón de Pánico**, 8 conceptos cada uno.
5. **Comité de Crédito** — 3 rangos por monto (COMITE 1 / 2 / 3).
6. **Productos de Disposición** — "Crédito Simple 2o Piso".
7. **Plantillas** y **Motor Contable**.
8. Subpestaña nueva **"Cobertura y Comisiones 2o Piso"** con 8 campos.

---

## Contexto técnico (ya verificado en el código, NO re-investigar)

### Stack y persistencia
- React + TypeScript + Vite + Supabase. Sin router: navegación por estado
  (`ProductosLineaCreditoModule` alterna `list` / `form`).
- **Todo el producto vive en la columna `data` (jsonb) de `J_PRODUCTOS`**, filtrado por
  `type = 'ProductoLineaCredito'` — ver [useSyncJProducts.ts](../src/app/hooks/useSyncJProducts.ts).
  **No existe ninguna tabla relacional con columnas por subtab.**
- Camino de **escritura y lectura separados**: se escribe en el objeto
  `jLineaCreditoData` de [ProductoLineaCreditoForm.tsx](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx)
  (≈L376-406) y se lee en el mapper de
  [useProductosLineaCreditoDB.ts](../src/app/hooks/useProductosLineaCreditoDB.ts) (≈L180-211).
  **Un subtab nuevo se mapea en los DOS o se pierde al recargar.**
- Los subtabs con `forwardRef` exponen `getData()` y el form los cosecha al guardar.
  Los subtabs con estado plano viven en `formData`.
- WIP en `sessionStorage` vía `useProductoPersistence` / `useTabPersistence`,
  con key `producto_linea_credito_${productId}` y `linea_credito_<tab>_${productId}`.

### Consecuencia directa sobre el punto 2 del requerimiento

**"Extender el campo FASE a VARCHAR(100)" NO es un cambio de base de datos.**
No hay DDL que tocar: las fases son elementos del array `data.fases` del jsonb.
El límite de 30 caracteres es exclusivamente de UI
([FasesTab.tsx:522](../src/app/components/productos/tabs/FasesTab.tsx#L522) `maxLength={30}`
más la leyenda de L529). El cambio es de 2 líneas.

> **Advertencia:** `FasesTab` es **compartido** con Producto Crédito
> ([ProductoForm.tsx](../src/app/components/productos/ProductoForm.tsx)). Ampliar a 100
> caracteres aplica a ambos módulos. Es ampliación de límite, no restricción — no rompe
> datos existentes.

### Inventario del módulo — qué ya existe y qué no

Tabs cableados hoy en [ProductoLineaCreditoForm.tsx:559-587](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx#L559-L587):

| Punto del requerimiento | Tab existente | Veredicto |
|---|---|---|
| Periodos | `periodos` (inline) | **Existe** — solo captura |
| Matriz Tasa Fija | `matriz-tasa-fija` → `MatrizTasaFijaTab` | **Existe** — solo captura |
| Tasas de Referencia | `tasa-referencia` → `TasaReferenciaTab` | **Existe** — solo captura |
| Matriz Tasa Variable | `matriz-tasa-variable` → `MatrizTasaVariableTab` | **Existe** — solo captura |
| Fases + Prompt IA | `fases` → `FasesTab` (ya tiene `promptIA`, 5000 chars) | **Existe** — falta ampliar nombre a 100 |
| Requisitos | `expedientes` (label "Requisitos OK") | **Existe** — depende del Catálogo de Documentos |
| Cargos | `cargo` → `CargoTab` | **Existe** — solo captura |
| Comisiones | `comisiones` → `ComisionesTab` | **Existe** — solo captura |
| Comité de Crédito | `comites` → `ComitesCreditoLineaCreditoTab` | **Existe** — se alimenta del catálogo de Puestos |
| Productos de Disposición | `productos-disposicion` → `PaquetesTab` | **Existe** — requiere alta previa del producto |
| Motor Contable | `motor-contable` → `MotorContableTab` | **Existe** — requiere cuentas 8001/8501 en catálogo |
| Plantillas | `plantillas` → `PlantillasTab` | **Existe** — solo captura |
| **Prelación** | — | **NO EXISTE en Línea de Crédito** |
| **Cobertura y Comisiones 2o Piso** | — | **NO EXISTE en ningún módulo** |

Dos precisiones sobre "existe":

1. **Prelación** sí existe como componente
   ([PrelacionTab.tsx](../src/app/components/productos/tabs/PrelacionTab.tsx)) pero **solo
   está cableado en Producto Crédito** ([ProductoForm.tsx:1020](../src/app/components/productos/ProductoForm.tsx#L1020))
   y su shape es `{ ordenAplicacion, productosCargos }` — **no sirve**: el requerimiento
   pide `SEQ / CONCEPTO / VALOR` en **dos escenarios**. Es un tab nuevo, no un cableado.
2. **Comité de Crédito** en Línea de Crédito NO es el mismo componente que en Producto
   Crédito. `ComitesCreditoLineaCreditoTab` lee de `usePuestosTrabajoDB()` y muestra
   `puesto / nombre / montoMinimo / montoMaximo`. Los 3 rangos COMITE 1/2/3 se dan de alta
   en el **catálogo de Puestos de Trabajo**, no en el producto.

### Visibilidad de los tabs nuevos — decisión cerrada

El form ya tiene un patrón de tabs condicionales (`isArrendamiento`, que muestra 4 tabs
solo cuando la sublínea es Arrendamiento). La primera implementación de esta HU siguió ese
patrón con un `isGarantia2oPiso` gateado por `subTipo`.

**Se revirtió por decisión del usuario (21/08/2026): los dos tabs son SIEMPRE visibles en
Línea de Crédito**, sin condición de Tipo.

Motivo del cambio: con el gate, los tabs no aparecían en ninguno de los 2 productos que hoy
existen en `J_PRODUCTOS` (`Linea de Credito Agropecuario` y uno sin nombre, ambos con
`subTipo = 'Simple'`), lo que los volvía inencontrables sin dar de alta primero el producto
nuevo.

La contrapartida que se había aceptado —que todo producto arrastrara una cascada por
defecto— **dejó de aplicar**: por decisión posterior del usuario el tab abre vacío
(ver §Alcance 1), así que un producto 'Simple' que nunca capture nada guarda
`prelacion2oPiso: []`. Si más adelante conviene volver a ocultar los tabs, reintroducir el
gate son tres puntos (array `tabs`, montaje del contenido y payload).

La opción **"Garantía Financiera 2o Piso"** sí se agregó al select **Tipo** de Datos
Producto: sigue siendo necesaria para dar de alta el producto con su nombre correcto,
aunque ya no controle la visibilidad de nada.

### Estado de la infraestructura de IA

| Pieza | Estado |
|---|---|
| Campo `promptIA` por fase | **Existe** — `FasesTab`, 5000 caracteres, con validación |
| Campo `promptIA` por documento | **Existe** — Catálogo de Documentos → `ExpedientesProductoTab` |
| Ejecución IA sobre documento | **Existe** — [validar-documento-ia](../supabase/functions/validar-documento-ia/index.ts), Gemini vision |
| Motor de reglas estructurales por fase | **Existe solo para el flujo estándar** — [useOriginacionValidaciones.ts](../src/app/hooks/useOriginacionValidaciones.ts), hardcodeado fases 1-7 |
| Reglas de 2o Piso (DSCR, RFC duplicado, quórum, cupo) | **NO EXISTE** |

El prompt más largo del requerimiento (Fase 2, reglas DSCR) ronda 1,500 caracteres:
**cabe sin cambios** en el campo actual.

---

## Objetivo

Dejar el módulo Productos → Línea de Crédito capaz de parametrizar íntegramente el producto
"Garantía Financiera 2o Piso": los 2 subtabs faltantes construidos, persistidos y
recuperables desde `J_PRODUCTOS`, y el campo Fase con capacidad para los nombres largos de
las 5 fases del ciclo GPO — sin alterar el comportamiento de los productos de Línea de
Crédito ya existentes.

---

## Alcance

### 1. Subtab "Prelación 2o Piso" — NUEVO

Archivo nuevo: `src/app/components/productos-linea-credito/Prelacion2oPisoTab.tsx`.

Componente `forwardRef` con `getData()`, persistencia
`linea_credito_prelacion_2o_piso_${productId}`, y **dos escenarios en un solo tab**
(selector de escenario arriba, una tabla por escenario): **Operación Normal** y
**Botón de Pánico**. Columnas `SEQ / CONCEPTO / VALOR`.

Reglas del tab:
- **La cascada es 100% manual: sin renglones precargados y sin catálogo cerrado de
  conceptos.** El tab abre vacío en ambos escenarios y el usuario captura lo que
  corresponda. Mismo criterio que ya aplica `PrelacionTab` de Producto Crédito
  (*"Prelación de Cargos es 100% manual. Sin defaults hardcodeados"*,
  [PrelacionTab.tsx:26-30](../src/app/components/productos/tabs/PrelacionTab.tsx#L26-L30)).
- **CONCEPTO** es texto libre, máximo 150 caracteres. **VALOR** es texto libre
  (admite tanto un importe como una expresión del tipo *Comisión por GPO* o
  *Total del Pagaré*).
- **SEQ único por escenario**: no se permiten dos renglones con el mismo SEQ dentro del
  mismo escenario (bloquea al guardar el renglón, con toast).
- Modo `view` = solo lectura, sin botones de acción.
- Se persiste como `data.prelacion2oPiso = [{ id, escenario, seq, concepto, valor }]`
  — **un solo array con discriminante `escenario`**, no dos arrays. Motivo: el motor de
  cascada consumirá el mismo shape filtrando por escenario.

> Las dos cascadas de 8 conceptos del requerimiento (Operación Normal y Botón de Pánico)
> quedan como **dato a capturar**, no como semilla en código. Están transcritas en
> §Configuración de datos.

### 2. Subtab "Cobertura y Comisiones 2o Piso" — NUEVO

Archivo nuevo: `src/app/components/productos-linea-credito/Cobertura2oPisoTab.tsx`.

**Es un listado, no un formulario suelto.** Replica el patrón de
[ComisionesTab](../src/app/components/productos/tabs/ComisionesTab.tsx): cabecera
`section-header-theme` con **+ Nuevo** / **Eliminar** (toggle de modo borrado con columna
de papelera), barra de acciones con menú de exportación, tabla temática con estado vacío
y contador, alta/edición por **modal**, y modal de confirmación de borrado. Al guardar el
renglón en el modal, aparece en el listado.

Cada renglón lleva los 8 campos del requerimiento, agrupados en la tabla bajo dos
cabeceras (`colspan`): **Cobertura** y **Comisión**.

| Campo | Tipo | Notas |
|---|---|---|
| % Mín. Cobertura | decimal | 0–100 |
| % Default Cobertura | decimal | obligatorio; entre mín y máx |
| % Máx. Cobertura | decimal | 0–100 |
| Sobre (Cobertura) | select | `Monto Emisión` / `Saldo Garantizado` |
| % Mín. Comisión | decimal | 0–100 |
| % Default Comisión | decimal | obligatorio; entre mín y máx |
| % Máx. Comisión | decimal | 0–100 |
| Sobre (Comisión) | select | `Monto Emisión` / `Saldo Garantizado` |

Validaciones en el modal, con banner rojo inline **y** bloqueo al guardar:
`mín ≤ default ≤ máx` por bloque, rango 0–100 en los seis porcentajes, y % Default
obligatorio. Sin datos predeterminados: el tab abre vacío.

Se persiste como `data.cobertura2oPiso` — **array** de renglones.

### 3. Visibilidad y catálogo de Tipo

Los dos tabs se insertan **sin condición** en el array `tabs` de
[ProductoLineaCreditoForm.tsx](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx),
entre *Motor Contable* y *Plantillas*, y su contenido se monta siempre (patrón
`display:none`, para que los `ref` estén vivos al guardar aunque no se haya visitado el tab).

En [ProductoLineaCreditoFormDatosProducto.tsx](../src/app/components/productos-linea-credito/ProductoLineaCreditoFormDatosProducto.tsx)
se agrega `Garantía Financiera 2o Piso` al select **Tipo**, que hoy tiene
Cuenta Corriente / Quirografario / Simple / Arrendamiento.

Adicional (no pedido, pero necesario): si el tab activo desaparece al cambiar la sublínea
—caso real de los tabs de Arrendamiento— el área de contenido quedaba en blanco. Se agregó
un reset a `default`.

### 4. Persistencia end-to-end

- **Escritura**: `prelacion2oPiso` y `cobertura2oPiso` en `jLineaCreditoData`,
  cosechados por `ref.getData()`.
- **Lectura**: mapeo en `mapDbToProducto()` de `useProductosLineaCreditoDB.ts`.
- **Tipos**: `PrelacionSegundoPiso` y `CoberturaComisiones2oPiso` en
  [productoLineaCredito.ts](../src/app/types/productoLineaCredito.ts), más los campos
  opcionales en `ProductoLineaCredito`.

### 5. Campo Fase 30 → 100 caracteres

`maxLength={30}` → `maxLength={100}` y la leyenda correspondiente en
[FasesTab.tsx](../src/app/components/productos/tabs/FasesTab.tsx).
Con esto entran los 5 nombres del requerimiento; el más largo es
`ADMISIÓN Y CAPTURA DEL ECOSISTEMA` (33 caracteres) — **hoy se truncaría**.

---

## Configuración de datos (post-implementación, sin código)

Estos puntos del requerimiento **no requieren desarrollo**; se capturan una vez que los
tabs estén arriba. Se listan porque sin ellos el producto queda incompleto:

1. **Periodos**: `Anual`.
2. **Matriz Tasa Fija**: Anual, plazos 15/30/20, montos $500M/$5,000M/$2,500M, tasas 6%/12%/9%.
3. **Tasas de Referencia**: TIIE, UDIS, CETES.
4. **Matriz Tasa Variable**: Anual, TIIE, plazos 15/30/20, mismos montos, tasas 6%/5%/6%.
5. **Fases**: las 5 del ciclo GPO, con su `promptIA` pegado del requerimiento.
5.1 **Prelación 2o Piso** — capturar las dos cascadas del requerimiento:

   *Operación Normal*

   | SEQ | CONCEPTO | VALOR |
   |---|---|---|
   | 1 | Gastos de Operación y Mantenimiento del Proyecto (O&M) | 0 |
   | 2 | Impuestos, Derechos y Gastos Fiduciarios Básicos | 0 |
   | 3 | Servicio de la Deuda Bursátil (Intereses y Capital Ordinario) | 0 |
   | 4 | Fondeo o Restitución del Fondo de Reserva (DSR - Debt Service Reserve) | 0 |
   | 5 | Pago de la Comisión por Garantía Financiera (Banobras / Segundo Piso) | Comisión por GPO |
   | 6 | Fondos de Reserva Adicionales o Menores | 0 |
   | 7 | Distribución de Remanentes (Utilidades del Desarrollador/Estado) | 0 |
   | 8 | Pago de Intereses y Capital del Crédito de Recuperación (Banobras) | 0 |

   *Botón de Pánico*

   | SEQ | CONCEPTO | VALOR |
   |---|---|---|
   | 1 | Gastos de Operación y Mantenimiento del Proyecto (O&M) | 0 |
   | 2 | Impuestos, Derechos y Gastos Fiduciarios Básicos | 0 |
   | 3 | Pago de Intereses y Capital del Crédito de Recuperación (Banobras) | Total del Pagaré |
   | 4 | Servicio de la Deuda Bursátil (Intereses y Capital Ordinario) | 0 |
   | 5 | Fondeo o Restitución del Fondo de Reserva (DSR - Debt Service Reserve) | 0 |
   | 6 | Pago de la Comisión por Garantía Financiera (Banobras / Segundo Piso) | 0 |
   | 7 | Fondos de Reserva Adicionales o Menores | 0 |
   | 8 | Distribución de Remanentes (Utilidades del Desarrollador/Estado) | 0 |

6. **Requisitos**: dar de alta en **Catálogo de Documentos** (Configuración) los
   7 de Fase 1 + 4 de Fase 2 + 3 de Fase 3 + 6 de Fase 4, cada uno con su `promptIA`,
   y luego asignarlos por fase en el tab Requisitos OK.
7. **Comité de Crédito**: 3 rangos en el **catálogo de Puestos de Trabajo**
   (500M–1,000M, 1,000M–2,500M, 2,500M–5,000M).
8. **Productos de Disposición**: dar de alta primero el producto de crédito
   **"Crédito Simple 2o Piso"**, luego referenciarlo.
9. **Motor Contable**: alta de las cuentas **8001** (Garantías Financieras Otorgadas) y
   **8501** (Responsabilidades por Garantías Financieras Otorgadas) en el catálogo contable.
10. **Plantillas**: los formatos de las etapas definidas.

---

## Criterios de aceptación

1. Todo producto de Línea de Crédito muestra los tabs **Prelación 2o Piso** y
   **Cobertura y Comisiones 2o Piso**, entre *Motor Contable* y *Plantillas*, sin importar
   el Tipo.
2. El select **Tipo** de Datos Producto ofrece la opción
   **"Garantía Financiera 2o Piso"** junto a las 4 que ya tenía.
3. Prelación 2o Piso abre **vacío** en los dos escenarios ("No se encontraron registros"),
   sin renglones precargados y sin catálogo cerrado de conceptos.
4. Cambiar de escenario en el selector conserva lo capturado en el otro.
5. Intentar guardar dos renglones con el mismo SEQ dentro del mismo escenario muestra error
   y no guarda el renglón.
6. Cobertura y Comisiones 2o Piso abre vacío. Con **+ Nuevo** se captura un renglón en
   el modal; al guardarlo **aparece en el listado**. Capturar `% Default > % Máx` marca el
   bloque en rojo y no deja guardar.
7. Guardar el producto → salir → volver a entrar en modo **Editar**: los dos tabs muestran
   exactamente lo capturado (round-trip contra `J_PRODUCTOS`, no solo sessionStorage).
8. Modo **Consulta** deja ambos tabs en solo lectura, sin botones de alta/baja.
9. El campo **Fase** acepta `ADMISIÓN Y CAPTURA DEL ECOSISTEMA` completo, sin truncar.
10. `npx tsc --noEmit` y `npm run build` pasan sin errores nuevos.

---

## Fuera de alcance (y por qué)

**La ejecución de las reglas IA de las 5 fases.** Los prompts se **capturan** en esta HU
(el campo ya existe y no requiere cambios), pero **nada los ejecuta a nivel producto** —
en el módulo de Producto un prompt es texto guardado. Las reglas del requerimiento son
validaciones estructurales sobre datos de la solicitud, no validación documental, así que
la función `validar-documento-ia` (Gemini vision sobre un archivo) no las cubre:

| Fase | Regla | Qué falta para ejecutarla |
|---|---|---|
| 1 | `RFC_Emisor == RFC_Fiduciario` → bloqueo | campo RFC Fiduciario en la solicitud + comparación |
| 1 | Cupo por sector/cliente → semáforo amarillo | consulta al módulo de límites |
| 2 | DSCR <1.20 rojo / 1.20–1.30 amarillo / >1.30 verde | campo DSCR + semáforo + bloqueo de envío |
| 2 | Fondo de Reserva ≥ 1 periodo de servicio de deuda | campos monto reserva y servicio de deuda |
| 3 | Quórum ≥ 3 votos favorables → "Aprobado por CPC" | contador de firmas + transición de estatus |
| 3 | Hard lock read-only del expediente en comité | bloqueo de escritura por estatus |
| 4/5 | Póliza automática 8001/8501 + arranque de cobro de comisiones | evento contable + scheduler batch |

Eso es una **HU siguiente (REQ-9)**, sobre `useOriginacionValidaciones.ts` y el módulo de
Solicitudes/Originación, más un módulo nuevo de **Cartera 2o Piso**. No cabe en la
parametrización del producto y mezclarlo aquí volvería la HU inentregable.

También fuera de alcance:
- **Cargos**: el requerimiento los marca *"PENDIENTE EN BASE AL FLUJO COMPLETO"*.
- **Motor Contable**: el requerimiento lo marca *"PENDIENTE DE DEFINIR"*. El tab ya existe;
  falta la definición funcional de eventos.
- Alta del producto **"Crédito Simple 2o Piso"** (es captura, y es prerrequisito de datos).
- Cualquier cambio en Producto Crédito, salvo el `maxLength` de Fase que es compartido.

---

## Advertencias

1. **`FasesTab` es compartido.** El cambio de 30→100 caracteres impacta Producto Crédito.
   Es ampliación de límite: no invalida datos existentes.
2. **No hay DDL.** Cualquier lectura del requerimiento que pida "VARCHAR(100)" en base
   está partiendo de un modelo relacional que este sistema no usa. Si en el futuro se
   normaliza `J_PRODUCTOS` a tablas, ahí sí habrá columna que dimensionar.
3. **Escritura y lectura son dos caminos.** Un campo nuevo mapeado solo en
   `jLineaCreditoData` se guarda pero **desaparece al recargar**. Es el error clásico de
   este módulo.
4. **Limpieza de storage en alta.** Ambos tabs limpian su key de storage una sola vez
   al montar, con guard por `useRef`. Sin ese guard —y está documentado en
   `ComisionesTab`— cada alta re-renderiza, vuelve a borrar lo que `useTabPersistence`
   acaba de escribir, y **el renglón agregado no aparece en el listado** hasta guardar el
   producto.
5. **Los tabs no están gateados**, pero tampoco siembran datos: un producto 'Simple' que
   se guarde sin capturar nada se lleva `prelacion2oPiso: []` y `cobertura2oPiso` con
   campos vacíos. Ruido mínimo en `data`, sin contenido inventado.

---

## Orden de ejecución

1. Tipos en `productoLineaCredito.ts`.
2. `Prelacion2oPisoTab.tsx`.
3. `Cobertura2oPisoTab.tsx`.
4. Cableado en `ProductoLineaCreditoForm.tsx` (import, refs, gate, tabs, contenido, payload).
5. Opción de Tipo en `ProductoLineaCreditoFormDatosProducto.tsx`.
6. Mapeo de lectura en `useProductosLineaCreditoDB.ts`.
7. `maxLength` en `FasesTab.tsx`.
8. `tsc --noEmit` + `npm run build`.
9. Prueba de round-trip: crear → guardar → reabrir en Editar.
