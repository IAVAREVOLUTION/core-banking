# HU — REQ-6: Facturación del ciclo de Arrendamiento Puro (Fases 4, 5 y 6) + Cartera de Arrendamiento

## Contexto técnico (ya verificado en el sistema, no re-investigar)

### Base
- Stack: React + TypeScript + Vite + Supabase (Postgres + Edge Functions + Storage).
- Las fases NO están en código: viven en `J_PRODUCTOS.data.fases`. El producto
  `8b9fa0f2-f500-4cfc-ae7d-04acceb69018` ("Arrendamiento Puro-Maquinaria") tiene 6 fases:
  4 = **Recaudación Inicial y Compra**, 5 = **Recepción del Activo y Cierre**,
  6 = **Liberación y Dispersión**.
- Persistencia: PUT a `.../make-server-7e2d13d9/solicitudes-credito/:id` con **deep merge
  server-side** (se puede enviar solo la rama a cambiar).
- Solicitud de prueba: `ea984b49-dae0-4cd6-927c-1edae5b9a4d8` (`BAN-DIGITAL-20260810-000001`).

### Lo que YA está implementado en el working tree (verificar, NO reimplementar)
1. **Rentas anticipadas → estatus del calendario.**
   `generarTablaArrendamiento()` (`src/app/components/cotizaciones/cotizacionArrendamientoTypes.ts`,
   ~línea 106) conserva TODAS las rentas con su numeración original y marca las primeras N
   como `'Pagado'`. `SimulacionTab.tsx` (~línea 333, `arrRowsView`) reaplica el parámetro
   `terminos.rentasAnticipadas` sobre el calendario ya generado sin obligar a re-simular, y el
   badge se etiqueta "Pagada" (~línea 613). El calendario se persiste en
   `data.solicitud.simulacion.calendario_arrendamiento` (`useSolicitudesDB.ts`, ~línea 445).
2. **Etiqueta "Garantías" → "Bienes"** ya aplicada en: `App.tsx` (nav, ~línea 678),
   `SolicitudCreditoForm.tsx` (tab, ~línea 2256), `CreditosModule.tsx` (~306, 517, 527),
   `solicitudes/GarantiasSection.tsx`, `creditos/TabGarantias.tsx`, `garantias/GarantiaForm.tsx`,
   `garantias/GarantiasList.tsx`, `productos/tabs/GarantiaTab.tsx`.
3. **Botones de factura por fase**: `shared/FaseActionsComponent.tsx` ya expone
   `onGenerarFacturaInicial` / `onGenerarFacturaProveedor`, `esArrendamientoPuro`,
   `facturaInicialGenerada` / `facturaProveedorGenerada` (props ~54-65), detecta la fase **por
   nombre** (`faseContiene('recaudacion') && faseContiene('compra')`, ~línea 146) y pinta los
   dos botones (~línea 346).
4. **Modelo de factura**: `solicitudCreditoStore.ts` (~línea 454) define
   `FacturaArrendamiento`, `generarFacturaDesembolsoInicial()`, `generarXMLProveedor()`
   (CFDI 4.0 simulado) y `leerXMLProveedor()` (DOMParser). Los handlers están en
   `SolicitudCreditoForm.tsx` (~1142 y ~1197). Se persisten en `data.solicitud.facturas`
   (`useSolicitudesDB.ts` ~línea 522) y se releen a la sesión en `SolicitudCreditoList.tsx` (~221).
5. **Cierre de Fase 6**: `handleEnviarFase` ya sustituyó el `toast.info('Esta es la última
   fase')` por un cierre real (`SolicitudCreditoForm.tsx` ~línea 937): valida la factura del
   proveedor, llama `actualizarDispersionDB()` (`estatus_cart = 'Vigente'`) y
   `actualizarEstatusSolicitudDB(…, 'Autorizada')`. El botón dice "Cerrar proceso".
6. **Cartera de Arrendamiento**: `cartera/CarteraArrendamientoList.tsx` (Inicio/KPIs, Lista,
   Detalle con tabs Datos / Calendario de Rentas / Facturas), registrada en `App.tsx`
   (`Module`, nav ~694, render ~1435). `CarteraList.tsx` (~línea 38) ya excluye Arrendamiento
   Puro con `esArrendamientoPuroRow()` para que un contrato no caiga en las dos carteras.

### Cobranza real (lo que hoy NO usan las facturas de arrendamiento)
- `cartera/CobranzaModule.tsx` tiene dos paneles: **"Avisos de Vencimiento — Créditos"**
  (`subTipoFijo="Amortizacion"`) y "Avisos de Aportación — Captación" (~línea 864).
- El panel lee `GET /cartera/cobranza?sub_tipo=&estatus=`; el form tiene tabs
  **Default / Detail / Generación Contable**; el tab **Detail** renderiza
  `CobranzaDetailTable` (~línea 151): encabezado del documento + tabla de líneas
  (`cve_subproducto`, `descripcion_subproducto`, `cantidad`, `monto`, `porcentaje_impuesto`,
  `moneda`, `subtotal`, `estatus`) y TOTAL GENERAL.
- Alta: `POST /cartera/facturas` vía `crearAvisoVencimiento()` (`hooks/useCarteraDB.ts` ~252).
  Detalle: `GET /cartera/facturas/:id/detalle`. Pago: `PATCH /cartera/facturas/:id/pagar`
  (deja `estatus = 'Pagado'`).
- **Hoy las facturas de arrendamiento sólo viven en `data.solicitud.facturas`; nunca llegan a
  estos endpoints, así que no aparecen en Cobranza y marcarlas Pagadas ahí no regresa a la
  solicitud. Ese es el hueco central de esta HU.**

### Desglose del desembolso inicial y proveedor del bien
- `calcularCargosArrendamiento()` (`solicitudCreditoStore.ts` ~409) produce los conceptos
  `ENGANCHE`, `COMISION_APERTURA`, `IVA_COMISION`, `RENTA_ANTICIPADA_MESn`, `SEGURO_MESn`,
  `IVA_RENTA_SEGURO_MESn` y `TOTAL_PAGO_INICIAL` (los de monto 0 se omiten).
- Ese mismo desglose se muestra en `SolicitudCargosTab.tsx` (~línea 148) bajo el encabezado
  **"DESEMBOLSO INICIAL — VISTA PREVIA"** con el chip "No persiste hasta enviar a originación".
- El **proveedor del bien** se captura en Bienes/Garantías: `garantias/GarantiaForm.tsx`
  (~263) selecciona una Persona con `type='Proveedor'` y guarda `proveedor_id` /
  `proveedorNombre` (`hooks/useGarantiasDB.ts` ~107 y ~139). Los bienes elegidos para la
  solicitud viven en el subtab `'garantias'`.

---

## Objetivo

Cerrar el ciclo de facturación del Arrendamiento Puro: que la Fase 4 emita la **factura del
pago inicial** y la Fase 5 la **factura del proveedor (cuenta por pagar)** como registros
**reales de Cobranza — Avisos de Vencimiento — Créditos**, y que la Fase 6 sólo valide que esa
última esté **Pagada** para cerrar el proceso y pasar el contrato a **Cartera de Arrendamiento**.

---

## Alcance

### 1. Rentas anticipadas — estatus en el calendario de simulación

- El parámetro **No. de Rentas Anticipadas** es la fuente de verdad del estatus: si es 1, la
  renta 1 queda **Pagada**; si es 3, las primeras tres. El resto queda Pendiente.
- Cambiar el parámetro en Términos y Condiciones debe reflejarse al volver al subtab
  Simulación **sin obligar a simular de nuevo**, y bajar el estatus a Pendiente si el número
  se reduce.
- Las rentas marcadas Pagadas son exactamente las que se cobran en el Desembolso Inicial
  (subtab Cargos) — mismos importes, sin recalcular por separado.
- **Estado**: implementado; esta HU sólo exige **verificarlo end-to-end y que sobreviva al
  reload** (el calendario se lee de `data.solicitud.simulacion.calendario_arrendamiento`, no
  de sessionStorage).

### 2. Etiqueta "Garantías" → "Bienes"

- En el flujo de Arrendamiento, todo lo que el usuario ve como "Garantía(s)" debe decir
  **"Bien(es)"**: tabs, encabezados de sección, títulos de modal, columnas y toasts.
- **Estado**: aplicado en los archivos listados arriba. Cerrar los remanentes que queden en
  pantalla (revisar `solicitudes/GarantiasTab.tsx`, `cartera/CarteraForm.tsx`,
  `clientes/Garantias.tsx` y los textos de `CarteraArrendamientoList.tsx`).
- **No renombrar claves internas** (`garantias` como subtab, `CAT_TIPO_GARANTIA`,
  `monto_cubrir_garantia`, `J_GARANTIAS`): sólo etiquetas visibles.

### 3. Fase 4 "Recaudación Inicial y Compra" — Factura de Pago Inicial

- El botón **"Generar Factura de Pago Inicial"** ya existe en la barra de acciones de la fase.
  Debe, además de crear la `FacturaArrendamiento` local:
  1. **Crear el registro en Cobranza** vía `POST /cartera/facturas`, de modo que aparezca en
     **Cobranza → Avisos de Vencimiento — Créditos** con `solicitud_id`, cliente, monto,
     fecha compromiso y estatus **Pendiente**.
  2. Guardar en la factura local el `factura_id` devuelto, para poder consultar después su
     estatus real.
- El **Detail** de ese registro nuevo debe mostrar el bloque **"DESEMBOLSO INICIAL — VISTA
  PREVIA"**, con una línea por concepto — el mismo desglose de
  `calcularCargosArrendamiento()`, en el mismo orden:

  | Concepto | Monto |
  |---|---|
  | Enganche | $120,000.00 |
  | Comisión por Apertura (Sin IVA) | $108,000.00 |
  | IVA de la Comisión (16%) | $17,280.00 |
  | Renta Anticipada (Mes 1 - Sin IVA) | $24,763.93 |
  | IVA de la Renta y Seguro Mes 1 (16%) | $3,962.23 |
  | **Total Pago Inicial Requerido** | **suma de las anteriores** |

  (importes de ejemplo — deben salir del cálculo, no estar escritos a mano).
- **Debe cuadrar**: el total del Detail en Cobranza tiene que ser idéntico al
  `TOTAL_PAGO_INICIAL` del subtab Cargos y al `total` de la factura. Si no cuadra, es bug.
- **No persiste hasta enviar a originación**: la vista previa en Cargos sigue siendo eso —
  el registro de Cobranza y la factura se materializan al generar la factura / enviar de fase,
  no antes.
- Al **enviar de fase desde la 4**, el sistema debe **validar que exista ese registro de
  Cobranza** (por `factura_id`/`no_docto`), **no** la existencia de un PDF en el Expediente
  Electrónico. Si falta, bloquear con un mensaje que diga exactamente qué falta y cómo
  generarlo — mismo estilo que las validaciones existentes de `seqActual === 4/5`.
- El botón no debe permitir duplicar la factura (ya hay `facturaInicialGenerada`); si se
  regenera, debe reemplazar el registro anterior, no dejar dos.

### 4. Fase 5 "Recepción del Activo y Cierre" — Factura del proveedor (cuenta por pagar)

- El botón **"Generar Factura del Proveedor"** debe:
  1. Tomar el **proveedor del bien configurado/seleccionado en la solicitud** (subtab
     Bienes → `proveedorNombre` / `proveedor_id` de `useGarantiasDB`), **no** de un documento
     del Expediente Electrónico. Hoy el handler lo busca en un doc "Datos del Proveedor"
     (`SolicitudCreditoForm.tsx` ~1199): **hay que cambiar esa fuente**. Si el bien no tiene
     proveedor, bloquear indicando que se capture en el subtab Bienes.
  2. **Generar el XML (CFDI)** con ese proveedor como Emisor y la institución como Receptor, y
     **leerlo de vuelta** para armar la cuenta por pagar — los datos del detalle deben salir
     del XML, no del formulario (ya lo hace `generarXMLProveedor` + `leerXMLProveedor`).
  3. Crear el registro en **Cobranza — Avisos de Vencimiento — Créditos** con
     **cliente = nombre del proveedor del bien** (es a quien se le va a pagar), marcado como
     **cuenta por pagar**, estatus **Pendiente**.
  4. En el **Detail** de ese registro mostrar **los datos del XML**: UUID del timbre, serie y
     folio, RFC y nombre del emisor, descripción del bien, subtotal, IVA trasladado y total.
- Debe poder **verse/descargarse el XML** desde el detalle (mismo patrón que el visualizador
  de XML SIC en `clientes/SIC.tsx` ~línea 637, que ya tiene modal + copiar + descargar).

### 5. Fase 6 "Liberación y Dispersión" — validar y cerrar

- La Fase 6 **no valida documentos**: valida que la factura del proveedor (la de la Fase 5)
  esté en estatus **Pagada**.
- El estatus debe leerse del **registro real de Cobranza** (`GET /cartera/cobranza` o
  `/cartera/facturas/:id`), no sólo de la copia en `data.solicitud.facturas`: el pago se
  aplica desde Cobranza con `PATCH /cartera/facturas/:id/pagar`, y ese cambio hoy no vuelve a
  la solicitud. Al validar, refrescar y sincronizar el estatus local.
- Si está pagada: **terminar el proceso de fases** — contrato a estatus **"Vigente"**
  (`actualizarDispersionDB`), solicitud a **completada/Autorizada**, y el contrato aparece en
  **Cartera de Arrendamiento**.
- Si no está pagada (o no existe), bloquear con un mensaje que diga el folio y el estatus
  actual, y dónde marcarlo como pagado.
- Todo debe **sobrevivir al reload** (columnas `estatus_disp`, `estatus_cart`, `monto_disp`,
  `fecha_disper` + `data.solicitud.tesoreria`).

### 6. Módulo Cartera de Arrendamiento

- Igual que Cartera de Crédito, pero para arrendamiento: listar **todos los contratos de tipo
  Arrendamiento Puro activos**, con Inicio (KPIs + gráficas), Lista (búsqueda, filtro por
  estatus, exportación) y Detalle.
- El Detalle muestra los parámetros propios del producto (enganche, valor residual, rentas
  anticipadas, renta del periodo), el **calendario de rentas** con su estatus y las
  **facturas** del contrato (pago inicial y compra del activo) con su estatus.
- Un contrato aparece aquí y **no** en Cartera de Crédito (ya garantizado por
  `esArrendamientoPuroRow`).
- **Estado**: implementado. Falta verificar que el filtro deje fuera los contratos que aún no
  cierran Fase 6 (o los muestre claramente como "En proceso" vs "Vigente") y que la pestaña
  Facturas refleje el estatus real de Cobranza.

---

## Criterios de aceptación

1. Con `Rentas Anticipadas = 3`, las rentas 1, 2 y 3 del calendario aparecen **Pagada** y las
   demás Pendiente; al bajar el parámetro a 1, sólo la primera queda Pagada — sin re-simular
   y tras recargar la página.
2. Toda la UI del flujo dice **Bienes**, no Garantías.
3. En la fase "Recaudación Inicial y Compra" el botón genera la factura y aparece un registro
   nuevo en **Cobranza → Avisos de Vencimiento — Créditos**.
4. El Detail de ese registro muestra **DESEMBOLSO INICIAL — VISTA PREVIA** con los conceptos
   del desembolso, y su total **cuadra** con el subtab Cargos.
5. Enviar de fase desde la 4 sin haber generado la factura se **bloquea** con un mensaje que
   explica qué falta; la validación es contra el **registro**, no contra un PDF.
6. En la fase "Recepción del Activo y Cierre" se genera un **XML CFDI** cuyo emisor es el
   **proveedor del bien seleccionado en la solicitud**, y se crea la **cuenta por pagar** en
   Cobranza con el proveedor como cliente y el detalle tomado del XML.
7. El XML se puede ver y descargar desde el detalle.
8. La Fase 6 **no deja cerrar** mientras esa factura no esté **Pagada**; una vez pagada en
   Cobranza y revalidada, el proceso se termina, el contrato queda **Vigente** y aparece en
   **Cartera de Arrendamiento**.
9. Cartera de Arrendamiento lista sólo Arrendamiento Puro, con calendario y facturas en el
   detalle; esos contratos no aparecen en Cartera de Crédito.
10. Todo lo anterior persiste tras recargar la página.
11. `npx vite build` compila sin errores y `dist/` se restaura (`git checkout -- dist/`).

---

## Fuera de alcance

- Timbrado real ante el SAT / PAC: el CFDI es **simulado**, igual que el Reporte de Buró y el
  comprobante SPEI.
- Integración bancaria real para el pago al proveedor.
- Motor de facturación recurrente de las rentas mensuales: aquí sólo se emiten la factura del
  pago inicial y la del proveedor.
- No modificar el comportamiento de las fases 1 a 3.

## Advertencias

- **Escritura y lectura están separadas** (`formToDBPayload` vs `buildFormDataFromListItem` /
  `preloadSubtabsFromDBData`). Un campo nuevo se mapea en **ambos** o se pierde al recargar.
- Las validaciones de `handleEnviarFase` para `seqActual === 4` y `=== 5` hoy son genéricas de
  crédito (`validarContratosYPagares`) y se aplican **por número de fase**, no por producto.
  Al agregar las validaciones de factura, **discriminar por producto/nombre de fase** —
  igual que hace `FaseActionsComponent` con `faseContiene(...)` — para no romper el flujo de
  crédito ni exigir pagarés en fases de arrendamiento.
- No duplicar el cálculo del desembolso inicial: la factura debe consumir
  `calcularCargosArrendamiento()`, que ya es la fuente de Cargos.
- No usar `catch {}` vacío: los fallos de alta en Cobranza deben mostrar un toast visible y
  **no** dejar la factura marcada como generada.
- No renombrar claves ni nombres de requisitos ya usados por las validaciones
  (`CLAVE_*` en `generarDocumentosFase4.ts`, `sub_tipo = 'Amortizacion'` en Cobranza).
- Reutilizar los componentes existentes de Cobranza (`CobranzaDetailTable`) en vez de crear
  una tabla de detalle nueva.
