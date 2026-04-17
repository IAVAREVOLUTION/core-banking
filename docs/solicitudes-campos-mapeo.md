# Mapeo de Campos — Módulo de Solicitudes

Documento de referencia para el formulario `SolicitudCreditoForm` y su ciclo de vida completo:
creación → guardado en BD → lista → reapertura.

Última actualización: 2026-04-10

---

## 1. Tabla principal: `J_CUENTAS_CORP_CLIENTES`

Columnas dedicadas (lectura/escritura directa):

| Columna BD | Tipo PG | Campo frontend | Notas |
|---|---|---|---|
| `id` | `uuid` | `form.id` / `_dbId` | PK, auto-generado |
| `type` | `text` | — | Siempre `'Solicitud'` |
| `no_sol` | `text` | `form.noSol` | `BAN-DIGITAL-AAAAMMDD-999999` |
| `no_cuenta` | `text` | — | Vacío en solicitudes |
| `no_referenc1` | `text` | `form.cotizacionId` | FK cotización origen |
| `fecha_sol` | `date` | `form.fechaSolicitud` | Convertido DD/MM/AAAA → YYYY-MM-DD |
| `fecha_autori` | `date` | — | No mapeado aún |
| `fecha_disper` | `date` | — | No mapeado aún |
| `fecha_cancel` | `date` | — | No mapeado aún |
| `fecha_inicio` | `date` | `form.fechaInicio` | Para Captación: primera fecha del calendario de aportaciones (DD/MM/YYYY) |
| `fecha_fin_cu` | `date` | `form.fechaFin` | Para Captación: última fecha del calendario de aportaciones (DD/MM/YYYY) |
| `descripcion` | `text` | `form.descripcion` | Texto libre |
| `linea_produc` | `text` | `form.lineaProducto` | `Crédito` / `Captación` / `Línea de Crédito` |
| `tipo_produc` | `text` | `form.tipoProducto` | Crédito Simple, Revolvente, Ahorro, **Aportación/Ahorro**… |
| `producto_id` | `uuid` | `form.productoId` | FK a J_PRODUCTOS — **debe ser UUID** |
| `producto_eje` | `uuid` | — | No usado en solicitudes |
| `cliente_id` | `uuid` | `form._clienteId` | FK a J_CLIENTES |
| `monto_sol` | `numeric` | `form.montoSolicitado` | Parseado a número |
| `monto_aut` | `numeric` | `form.montoAutorizado` | Parseado a número |
| `monto_disp` | `numeric` | — | No mapeado |
| `estatus_sol` | `text` | `form.estatusSolicitud` | `Pendiente` / `Aprobada`… |
| `estatus_disp` | `text` | — | No mapeado |
| `estatus_cart` | `text` | — | No mapeado |
| `estatus_cuen` | `text` | — | No mapeado |
| `fases` | `text` | `form.faseId` | ID de la fase actual |
| `data` | `jsonb` | (ver sección 3) | Toda la información extendida |

---

## 2. Campos JOIN leídos (solo lectura, no se escriben)

La Edge Function hace JOIN al cargar la lista. Nunca se persisten de regreso.

### De `J_CLIENTES`

| Columna BD | Campo `_` en frontend | Uso |
|---|---|---|
| `nombre` | `_clienteNombre` | Reconstruir `nombrePersona` si JSONB falla |
| `ap_paterno` | `_clienteApPaterno` | Reconstruir `apellidoPaternoPersona` |
| `ap_materno` | `_clienteApMaterno` | Reconstruir `apellidoMaternoPersona` |
| `rfc` | `_clienteRfc` | `form._rfc` |
| `curp` | `_clienteCurp` | `form._curp` |
| `tipo` | `_clienteTipo` | Fallback para `tipoPersona` |
| `subtipo` | — | No usado en form |

> **Nota:** Al seleccionar cliente desde el modal (`SeleccionarClienteModal`), se enriquece el form con `_rfc`, `_curp`, `_domicilio`, `_telefono`, `_email`, `_fechaNacimiento` tomados directamente de `J_CLIENTES.data.direcciones[0]`. El campo `estado` en el JSON del cliente mapea a domicilio (no `entidadFederativa`). El UUID correcto es `row.id`, no `idCliente` (código legible).

### De `J_PRODUCTOS`

| Columna BD | Campo `_` en frontend | Uso |
|---|---|---|
| `nombre_producto` | `_productoNombre` | Reconstruir `nombreProducto` |
| `clave_producto` | `_productoClave` | Referencia informativa — **no usar como `productoId`** |
| `sucursal` | `_productoSucursal` | Reconstruir `sucursal` |
| `linea_produc` | `_lineaProducto` | Fallback para `lineaProducto` |
| `tipo_produc` | `_tipoProducto` | Fallback para `tipoProducto` |

---

## 3. Campo `data` JSONB — estructura interna

Escrito por `formToDBPayload()` en `useSolicitudesDB.ts`.

### `data.solicitud.header`

| Clave JSONB | Campo frontend | Notas |
|---|---|---|
| `id` | `form.id` | UUID solicitud |
| `no_sol` | `form.noSol` | |
| `cotizacion_id` | `form.cotizacionId` | |
| `linea_producto` | `form.lineaProducto` | |
| `tipo_producto` | `form.tipoProducto` | |
| `tipo_persona` | `form.tipoPersona` | `Física` / `Moral` |
| `nombre_persona` | `form.nombrePersona` | |
| `apellido_paterno_persona` | `form.apellidoPaternoPersona` | |
| `apellido_materno_persona` | `form.apellidoMaternoPersona` | |
| `producto_id` | `form.productoId` | UUID — duplicado de columna dedicada |
| `nombre_producto` | `form.nombreProducto` | |
| `fecha_solicitud` | `form.fechaSolicitud` | En formato DD/MM/AAAA |
| `descripcion` | `form.descripcion` | |
| `fase_id` | `form.faseId` | |
| `descripcion_fase` | `form.descripcionFase` | |
| `estatus` | `form.estatusSolicitud` | |
| `curp` | `form._curp` | |
| `rfc` | `form._rfc` | |

### `data.solicitud.terminos_condiciones._raw`

Copia camelCase de los términos para roundtrip exacto:

| Clave JSONB `_raw` | Campo frontend (`TerminosCondiciones`) | Aplica a |
|---|---|---|
| `montoSolicitado` | `terminos.montoSolicitado` | Crédito + Captación |
| `plazo` | `terminos.plazo` | Crédito + Captación |
| `tasa` | `terminos.tasa` | Crédito + Captación |
| `frecuencia` | `terminos.frecuencia` | Crédito + Captación |
| `tipoTasa` | `terminos.tipoTasa` | Crédito |
| `tipoCalculo` | `terminos.tipoCalculo` | Crédito únicamente — oculto para Captación |
| `moneda` | `terminos.moneda` | Crédito + Captación |
| `montoGarantia` | `terminos.montoGarantia` | Crédito |
| `seguroFinanciado` | `terminos.seguroFinanciado` | Crédito |
| `montoSeguro` | `terminos.montoSeguro` | Crédito |
| `fechaPrimerPago` | `terminos.fechaPrimerPago` | Crédito |
| `fechaPrimeraAportacion` | `terminos.fechaPrimeraAportacion` | Captación |
| `fechaInicio` | `terminos.fechaInicio` / `form.fechaInicio` | Captación: primera fecha del calendario |
| `fechaFin` | `terminos.fechaFin` / `form.fechaFin` | Captación: última fecha del calendario |

### `data.solicitud.terminos_condiciones.parametros_simulacion`

Versión snake_case enviada al motor de simulación:

| Clave JSONB | Fuente |
|---|---|
| `monto_solicitado` | `terminos.montoSolicitado` |
| `plazo` | `terminos.plazo` |
| `tasa_interes` | `terminos.tasa` |
| `periodicidad` | `terminos.frecuencia` |
| `fecha_primer_pago` | `terminos.fechaPrimerPago` |
| `fecha_primera_aportacion` | `terminos.fechaPrimeraAportacion` |

### `data.solicitud.simulacion`

| Clave JSONB | Fuente | Notas |
|---|---|---|
| `tipo_tabla` | `terminos.tipoCalculo` | `Francés` / `Alemán` / `Simple` |
| `resultado_simulacion[]` | `SimulacionRow[]` | Solo para Crédito/Línea de Crédito |
| `resultado_simulacion[].no_pago` | `r.noPago` | |
| `resultado_simulacion[].fecha_pago` | `r.fechaPago` | |
| `resultado_simulacion[].saldo_insoluto` | `r.saldoInsoluto` | |
| `resultado_simulacion[].pago_capital` | `r.pagoCapital` | |
| `resultado_simulacion[].pago_interes` | `r.pagoInteres` | |
| `resultado_simulacion[].iva_interes` | `r.ivaInteres` | |
| `resultado_simulacion[].pago_periodo` | `r.pagoPeriodo` | |
| `resultado_simulacion[].pago_seguro` | `r.pagoSeguro` | |
| `resultado_simulacion[].pago_total` | `r.pagoTotal` | |
| `calendario_aportaciones[]` | `form._calendarioAportaciones` | **Solo Captación/Aportación** — heredado de Cotización |
| `calendario_aportaciones[].noAportacion` | `r.noAportacion` | Número de aportación |
| `calendario_aportaciones[].fecha` | `r.fecha` | Formato `YYYY-MM-DD` en DB, `DD/MM/YYYY` en UI |
| `calendario_aportaciones[].monto` | `r.monto` | Monto por aportación |
| `calendario_aportaciones[].moneda` | `r.moneda` | `MXN` |

### `data.solicitud.expediente_electronico.documentos[]`

| Clave JSONB | Campo en subtab Expediente |
|---|---|
| `id` | `doc.id` |
| `fecha_creacion` | `doc.fecha` |
| `usuario` | `doc.usuario` |
| `tipo_documento` | `doc.tipoDocumento` — dinámico desde catálogo `J_CATALOGOS` tipo `'Documento'` |
| `archivo_adjunto` | `doc.archivo` |
| `tipo_archivo` | `doc.tipoArchivo` |
| `nota` | `doc.nota` |
| `area` | `doc.area` |
| `fase` | `doc.fase` |
| `fase_id` | `doc.faseId` |
| `validado_ia` | `doc.validadoIA` |
| `estatus` | `doc.estatus` |
| `url` | `doc.url` |
| `storage_path` | `doc.storagePath` |
| `storage_bucket` | `doc.storageBucket` |
| `mime` | `doc.mime` |
| `tamano_kb` | `doc.tamanoKB` |
| `ia_motivos` | `doc.iaMotivos` |
| `ia_extraido` | `doc.iaExtraido` |

### `data.solicitud.garantias[]`

| Clave JSONB | Campo en subtab Garantías |
|---|---|
| `tipo_garantia` | `g.tipo` |
| `subtipo` | `g.subtipo` |
| `descripcion` | `g.descripcion` |
| `valor_garantia` | `g.valorNominal` |
| `ubicacion` | `g.ubicacion` |
| `estatus` | `g.estatus` |
| `observaciones` | `g.nota` |
| `fase` | `g.fase` |
| `fase_id` | `g.faseId` |
| `area` | `g.area` |

### `data.solicitud.comisiones[]`

| Clave JSONB | Campo en subtab Comisiones |
|---|---|
| `tipo_comision` | `c.tipoComision` |
| `descripcion` | `c.descripcion` |
| `monto` | `c.montoCalculado` |
| `porcentaje` | `c.porcentaje` |
| `base` | `c.base` |
| `estatus` | `c.estatus` |

### `data.solicitud.autorizaciones[]`

| Clave JSONB | Campo en subtab Autorizaciones |
|---|---|
| `usuario` | `a.usuario` |
| `puesto` | `a.puesto` |
| `estado_autorizacion` | `a.estatus` |
| `fecha_autorizacion` | `a.fechaHora` |
| `comentario` | `a.observaciones` |
| `area` | `a.area` |
| `descripcion` | `a.descripcion` |

---

## 4. Campos internos del form (`form._*`)

Campos que viven en `SolicitudFormData` pero **no tienen columna dedicada** en BD — se persisten dentro del JSONB.

| Campo `form._*` | Origen | Dónde se guarda en JSONB |
|---|---|---|
| `_clienteId` | UUID de `J_CLIENTES.id` al seleccionar cliente | `data.solicitud.header` (implícito vía `cliente_id` columna) |
| `_curp` | `J_CLIENTES.data.curp` | `data.solicitud.header.curp` |
| `_rfc` | `J_CLIENTES.data.rfc` | `data.solicitud.header.rfc` |
| `_domicilio` | `J_CLIENTES.data.direcciones[0].estado` | Usado en generación de documentos — no persiste en JSONB |
| `_telefono` | `J_CLIENTES.data.telefono` | Usado en generación de documentos — no persiste en JSONB |
| `_email` | `J_CLIENTES.data.correoElectronico` | Usado en generación de documentos — no persiste en JSONB |
| `_fechaNacimiento` | `J_CLIENTES.data.fechaNacimiento` | Usado en generación de documentos — no persiste en JSONB |
| `_calendarioAportaciones` | `J_COTIZACIONES.data.calendarioAportaciones` | `data.solicitud.simulacion.calendario_aportaciones[]` |

---

## 5. Flujo completo de un campo (ejemplo: `tipoPersona`)

```
GUARDAR
  form.tipoPersona ("Física")
    → data.solicitud.header.tipo_persona = "Física"       [JSONB]
    → (no hay columna dedicada para tipo_persona)

LEER (Edge Function → mapRowToListItem)
  row.data.solicitud.header.tipo_persona  → _tipoPersona   [1ª prioridad]
  row.data.tipoPersona                    → _tipoPersona   [2ª]
  row.cliente_tipo  (JOIN J_CLIENTES)     → _tipoPersona   [3ª fallback]

REABRIR (buildFormDataFromListItem)
  extra._tipoPersona                      → rawTipoPersona  [1ª]
  hdr.tipo_persona                        → rawTipoPersona  [2ª]
  d.tipoPersona                           → rawTipoPersona  [3ª]
  joinTipoPersona (_clienteTipo)          → rawTipoPersona  [4ª]
    → normalizeTipoPersona(rawTipoPersona) → form.tipoPersona
```

## Flujo del calendario de aportaciones (Captación/Aportación)

```
COTIZACIÓN
  CotizacionCaptacionForm genera calendario via useMemo()
    → setData({ calendarioAportaciones: [...] })
    → saveCotizacion(form) → RPC update_jcotizacion
    → J_COTIZACIONES.data.calendarioAportaciones = [...]

CREAR SOLICITUD DESDE COTIZACIÓN
  handleCrearSolicitudCaptacion(c)
    → mappedData._calendarioAportaciones = c.data.calendarioAportaciones
    → mappedData.fechaInicio = isoToDMY(calendario[0].fecha)       // DD/MM/YYYY
    → mappedData.fechaFin    = isoToDMY(calendario[last].fecha)    // DD/MM/YYYY
    → onCrearSolicitudDesdeCotizacion(mappedData)
    → App.tsx setCotizacionParaSolicitud(mappedData)

SolicitudCreditoList useEffect()
    → const cp = cotizacionParaSolicitud  // captura local antes del consumed
    → formData._calendarioAportaciones = cp._calendarioAportaciones
    → formData.fechaInicio / fechaFin     // ya en DD/MM/YYYY
    → saveToSession('new', 'form', formData)
    → onCotizacionConsumed()  // App pone el prop en null
    → setView({ type: 'form', mode: 'nuevo' })

SolicitudCreditoForm getInitial()
    → loadFromSession('new', 'form')
    → formData._calendarioAportaciones disponible

SimulacionTab
    → prop calendarioAportaciones = formData._calendarioAportaciones
    → esCaptacion(lineaProducto, tipoProducto) === true
    → render tabla de solo lectura (sin botones, sin amortización)

GUARDAR SOLICITUD EN BD
  formToDBPayload(form)
    → data.solicitud.simulacion.calendario_aportaciones = form._calendarioAportaciones

REABRIR SOLICITUD
  buildFormDataFromListItem(s)
    → sol.simulacion.calendario_aportaciones → form._calendarioAportaciones
    → SimulacionTab vuelve a mostrar el calendario
```

---

## 6. Reconstrucción al reabrir — cadena de fallbacks completa

`SolicitudCreditoList.tsx → buildFormDataFromListItem()`

| Campo form | 1º | 2º | 3º | 4º (último recurso) |
|---|---|---|---|---|
| `id` | `_dbId` | `s.id` | — | — |
| `noSol` | `s.noSol` | `hdr.no_sol` | `d.noSol` | — |
| `cotizacionId` | `hdr.cotizacion_id` | `d.cotizacionId` | — | — |
| `lineaProducto` | `hdr.linea_producto` | `d.lineaProducto` | `_lineaProducto` | `'Crédito'` |
| `tipoProducto` | `s.tipoProducto` | `hdr.tipo_producto` | `d.tipoProducto` | `_tipoProducto` |
| `tipoPersona` | `_tipoPersona` | `hdr.tipo_persona` | `d.tipoPersona` | `_clienteTipo` |
| `nombrePersona` | `hdr.nombre_persona` | `d.nombrePersona` | `_clienteNombre` | — |
| `apellidoPaternoPersona` | `hdr.apellido_paterno_persona` | `d.apellidoPaternoPersona` | `_clienteApPaterno` | — |
| `apellidoMaternoPersona` | `hdr.apellido_materno_persona` | `d.apellidoMaternoPersona` | `_clienteApMaterno` | — |
| `productoId` | `_productoId` | `hdr.producto_id` | `d.productoId` | — |
| `nombreProducto` | `s.nombreProducto` | `hdr.nombre_producto` | `d.nombreProducto` | `_productoNombre` |
| `fechaSolicitud` | `s.fechaSolicitud` | `hdr.fecha_solicitud` | `d.fechaSolicitud` | — |
| `descripcion` | `hdr.descripcion` | `d.descripcion` | `_descripcion` | — |
| `faseId` | `hdr.fase_id` | `d.faseId` | `_fases` | `'1'` |
| `descripcionFase` | `s.faseDescripcion` | `hdr.descripcion_fase` | `d.descripcionFase` | — |
| `estatusSolicitud` | `s.estatusSolicitud` | `hdr.estatus` | `d.estatusSolicitud` | `'Pendiente'` |
| `sucursal` | `s.sucursal` | `hdr.sucursal` | `d.sucursal` | `_productoSucursal` |
| `montoSolicitado` | `hdr.monto_solicitado` | `s.montoSolicitado` | `d.montoSolicitado` | `'0.00'` |
| `montoAutorizado` | `hdr.monto_autorizado` | `s.montoAutorizado` | `d.montoAutorizado` | `'0.00'` |
| `fechaInicio` | `rawTerminos.fechaInicio` | `rawTerminos.fechaPrimerPago` | `_fechaInicio` | — |
| `fechaFin` | `rawTerminos.fechaFin` | `_fechaFin` | — | — |
| `_clienteId` | `_clienteId` | `hdr.cliente_id` | `d._clienteId` | — |
| `_curp` | `_clienteCurp` | `hdr.curp` | `d._curp` | — |
| `_rfc` | `_clienteRfc` | `hdr.rfc` | `d._rfc` | — |
| `_calendarioAportaciones` | `sol.simulacion.calendario_aportaciones` | — | — | `undefined` |

---

## 7. Diferencias Crédito vs Captación/Aportación

### Comportamiento del subtab Simulación

| | Crédito / Línea de Crédito | Captación / Aportación/Ahorro |
|---|---|---|
| Tabla mostrada | Tabla de amortización (generada en Solicitud) | Calendario de aportaciones (generado en Cotización) |
| Botón "Generar" | Sí | No — solo lectura |
| Editable | Sí (nuevo/editar) | No — siempre readonly |
| Origen datos | `generarSimulacion()` desde Términos | `form._calendarioAportaciones` heredado de Cotización |
| Tipo Cálculo Amortización | Visible | **Oculto** |

### Comportamiento del subtab Términos y Condiciones

| Campo | Crédito | Captación |
|---|---|---|
| Monto Solicitado | Sí | Sí |
| Fecha Primer Pago | Sí | No |
| Fecha Primera Aportación | No | Sí — **siempre igual a Fecha Inicio, solo lectura** |
| Plazo | Sí | Sí (igual al plazo del producto) |
| Frecuencia | Sí | Sí |
| Tasa | Sí | Sí |
| Tipo de Tasa | Sí | Sí |
| **Tipo Cálculo Amortización** | Sí | **No** |
| Moneda | Sí | Sí |
| Monto Garantía | Sí | No |
| Seguro Financiado | Sí | No |
| **Perfil del Inversionista** | No | **Sí** — Conservador / Moderado / Agresivo |
| **Riesgo** | No | **Sí** — Bajo / Medio / Alto |
| **Horizonte de Inversión** | No | **Sí** — Corto / Mediano / Largo plazo |
| **Experiencia** | No | **Sí** — Ninguna / Básica / Intermedia / Avanzada |

> **Regla Fecha Primera Aportación:** se sincroniza automáticamente con `form.fechaInicio` y es campo de solo lectura. Los campos Perfil, Riesgo, Horizonte y Experiencia se persisten en `terminos_condiciones._raw` y se usan para sustituir variables `{{perfil}}`, `{{riesgo}}`, `{{horizonte}}`, `{{experiencia}}` en las plantillas de inversión.

### Tipos de producto por línea

| `lineaProducto` | `tipoProducto` válidos | Lógica `esCaptacion()` |
|---|---|---|
| `Captación` | `Ahorro`, `Inversión`, `Aportación/Ahorro`, `Cuenta Corriente` | `true` |
| `Crédito` | Crédito Simple, Revolvente, etc. | `false` |
| `Línea de Crédito` | Revolvente, etc. | `false` |

> **Detección de captación** (`SimulacionTab → esCaptacion()`): normaliza tildes y busca `captac`, `ahorro`, `aportac`, `invers` tanto en `lineaProducto` como en `tipoProducto` — cualquiera de los dos que coincida activa el modo calendario.

---

## 8. Generación de documentos desde plantillas (`generarDocumentosFase4.ts`)

Las plantillas HTML se guardan en `J_PRODUCTOS.data.plantillas[]` como base64.

### Variables disponibles en plantillas `{{ }}`

| Variable plantilla | Fuente en `DatosSolicitud` |
|---|---|
| `{{folio}}` | `datos.noSol` |
| `{{fecha}}` | Fecha actual `toLocaleDateString('es-MX')` |
| `{{cliente_nombre}}` | `datos.cliente` |
| `{{cliente_rfc}}` | `datos.rfc` (de `J_CLIENTES.data.rfc`) |
| `{{cliente_curp}}` | `datos.curp` |
| `{{fecha_nacimiento}}` | `datos.fechaNacimiento` |
| `{{telefono}}` | `datos.telefono` |
| `{{email}}` | `datos.email` |
| `{{domicilio}}` / `{{cliente_domicilio}}` | `datos.domicilio` (de `J_CLIENTES.data.direcciones[0].estado`) |
| `{{producto}}` | `datos.productoNombre` |
| `{{monto}}` / `{{monto_solicitado}}` | `terminos.montoSolicitado` |
| `{{plazo}}` | `terminos.plazo` (solo número — la plantilla puede agregar " meses") |
| `{{tasa}}` | `terminos.tasa` |
| `{{cat}}` | `terminos.cat` |
| `{{finalidad}}` | `datos.finalidad` |
| `{{sucursal}}` | `datos.sucursal` |
| `{{ejecutivo}}` | `'N/A'` (no implementado) |
| `{{empresa_nombre}}` / `{{empresa_razon_social}}` | `'N/A'` |
| `{{rfc}}` | `datos.rfc` — alias corto de `{{cliente_rfc}}` |
| `{{curp}}` | `datos.curp` — alias corto de `{{cliente_curp}}` |
| `{{nombre}}` | `datos.cliente` — alias corto de `{{cliente_nombre}}` |
| `{{perfil}}` | `terminos.perfilInversionista` — **solo Captación** |
| `{{riesgo}}` | `terminos.riesgoInversionista` — **solo Captación** |
| `{{horizonte}}` | `terminos.horizonteInversion` — **solo Captación** |
| `{{experiencia}}` | `terminos.experienciaInversion` — **solo Captación** |
| `{{rendimiento}}` | `terminos.tasa` — alias usado en plantillas de inversión |

### Pipeline de generación

```
plantilla.archivoData (base64 data URL)
  → atob() + TextDecoder → HTML plano
  → sustituir() → HTML con datos reales
  → iframe oculto (794px, opacity:0)
  → html2canvas (scale:2) → canvas
  → jsPDF.addImage() → PDF A4
  → PDF Blob URL → download Solicitud_XXX.pdf
```

---

## 9. Diferencias en rawData del producto (`J_PRODUCTOS`)

Al seleccionar un producto, el form lee `rawData`:

| Campo | Crédito | Captación |
|---|---|---|
| Fases | `rawData.fases` (array) | `rawData.fasesRegistros` (array) — `rawData.fases` es `{}` vacío |
| Expediente | `rawData.expedientesElectronicos` | `rawData.expedientesRegistros` |
| Plantillas | `rawData.plantillas[]` | `rawData.plantillas[]` |
| ID del producto | `c.producto_id` (UUID) | `c.producto_id` (UUID) — **nunca** `claveProducto` |

> **Regla crítica:** Usar siempre `Array.isArray(x) && x.length > 0 ? x : null` antes de `??`
> — el campo `fases: {}` en Captación es truthy y bloquea el fallback con `??` simple.

### Tipos de producto Captación disponibles (`ProductoCaptacionForm`)

- `Ahorro`
- `Inversión`
- `Aportación/Ahorro` ← nuevo
- `Cuenta Corriente`

---

## 10. Motor de Fases — detección por nombre (`FaseActionsComponent`)

Los botones de acción de fase se detectan **exclusivamente por el nombre de la fase** (normalizado NFD, minúsculas). No se usa el número de secuencia como fuente de verdad.

### Lógica de detección

| Condición en nombre de fase | Botón mostrado | Notas |
|---|---|---|
| Contiene `"solicitud"` + `"activac"` (no `"activar cuenta"`) | **Solicitud de Activación** | Crea o edita el registro en `J_SOLICITUDES_ACTIVACION` |
| Contiene `"activac"` pero NO `"solicitud"` ni `"activar cuenta"` | **Ver Solicitud de Activación** | Solo lectura — fase posterior a la creación |
| Contiene `"activar cuenta"` o `"activar_cuenta"` | **Activar Cuenta** | Ejecuta activación final |
| Contiene `"formaliz"` o `"contrato"` | **Formalizar Contrato** | Genera PDFs de contrato y pagaré |
| `seq === 1` | **Imprimir Solicitud** | Primera fase del producto |
| Hay fase siguiente y no aplica ninguno de los anteriores | **Enviar de Fase** | Avance estándar |

> **Regla clave:** El número de secuencia (`seq`) ya no es fallback para detección de tipo de fase. Un producto puede tener la fase "Solicitud de Activación Cuenta" en cualquier posición y el botón aparece correctamente.

### Botón "Solicitud de Activación" — label dinámico

- Si `existingActivacion` existe (ya hay registro en BD) → label: `"Ver Solicitud de Activación"`
- Si no existe → label: `"Solicitud de Activación"`

---

## 11. Tabla `J_SOLICITUDES_ACTIVACION` — Módulo de Activación

### Columnas principales

| Columna BD | Tipo | Campo frontend | Notas |
|---|---|---|---|
| `id` | `uuid` | `_dbId` / `id` | PK auto-generado |
| `cliente_id` | `uuid` | `clienteId` | FK a `J_CLIENTES` — se toma de `form._clienteId` |
| `solicitud_id` | `uuid` | `solicitudId` | FK a `J_CUENTAS_CORP_CLIENTES` — se toma del `storageId` de la originación |
| `type` | `text` | `type` | `"Por Cobrar"` (Captación) / `"Por Pagar"` (Crédito) |
| `created_at` | `timestamp` | `fechaSolicitud` | Auto-generado por BD |
| `fecha_compromiso` | `date` | `fechaCompromiso` | DD/MM/YYYY → YYYY-MM-DD al guardar |
| `estatus` | `text` | `estatus` | `Pendiente` / `Enviada` / `Pagado` / `Activo` / `Rechazada` |
| `data` | `jsonb` | (ver abajo) | Toda la info extendida |

### Estructura `data` JSONB

```
data.header:
  cliente, numeroDocumento, cuentaBancaria, formaDePago,
  institucionFinanciera, referencia, montoTransaccion,
  moneda, nota, usuarioNota

data.detail:
  claveProducto, cantidad, monto, pctImpuesto,
  moneda, subTotal, estatus
```

### RPCs de BD utilizadas

| RPC | Cuándo | Parámetros |
|---|---|---|
| `get_solicitudes_activacion()` | Lectura con JOINs | — |
| `insert_solicitud_activacion` | Crear nuevo registro | `p_payload` |
| `update_solicitud_activacion` | Actualizar existente | `p_id`, `p_payload` |

### Flujo de apertura del módulo

```
FaseActionsComponent → botón "Solicitud de Activación"
  → SolicitudCreditoForm.handleSolicitudActivacion()
    → detecta si es "solo ver" (nombre contiene "activac" sin "solicitud")
    → setActivacionModalRO(esSoloVer)
    → setShowActivacionModal(true)

SolicitudActivacionModal (fixed inset-0 z-50)
  isNew = !existingActivacion
  Si isNew:
    → busca cuenta bancaria del cliente via RPC get_cuentas_ahorro
    → prepara initialNewData con seed (cliente, clienteId, lineaProducto, monto, moneda, productoId)
    → SolicitudActivacionList abre en modo "nuevo"
  Si !isNew:
    → prepara sesión síncronamente (clearSession + saveToSession)
    → SolicitudActivacionList abre en modo "editar" o "ver" (según readOnly)

Al guardar (onSavedFromOriginacion):
  → handleActivacionSaved(savedItem)
  → Si estatus = "Enviada" o "Pagado":
    → avanzarFaseSolicitudDB(dbId, sigFase.faseId, ..., 'Aprobado')
    → setFormData({ faseId, descripcionFase, area, estatusSolicitud: 'Aprobado' })
  → refetchActivaciones()
```

### Regla canActivarCuenta

El botón "Activar Cuenta" (fase siguiente) está habilitado cuando:
- **Línea de Crédito**: siempre habilitado (no requiere pago)
- **Crédito / Captación**: requiere `activacionForThisSol.estatus` = `"Enviada"` O `"Pagado"`

> `useSolicitudesActivacionDB` se habilita cuando `mode !== 'nuevo' && storageId !== 'new'` — aplica a todos los modos (solicitudes, originacion, ver).

---

## 12. Persistencia del Calendario de Aportaciones (`SimulacionTab`)

El calendario de aportaciones se persiste en `sessionStorage` bajo la clave `simulacion_cal` para sobrevivir cambios de tab sin recalcularse.

### Prioridad de carga (`getInitCalRows`)

1. `sessionStorage → simulacion_cal` (persiste cambios del usuario)
2. `loadFromSavedStore(solicitudId, 'simulacion_cal')` (datos guardados en BD)
3. Prop `calendarioAportaciones` (heredado de Cotización)

### Regla de recálculo

El calendario **solo se regenera** cuando el usuario presiona "Simular Aportaciones" explícitamente. Cambiar de tab y volver **no** recalcula ni sobreescribe el calendario existente.

---

## 13. Componente `FlujoTrabajo` — prop `completada`

Cuando `completada={true}`, la fase actual se pinta en verde (igual que las fases anteriores), indicando que el proceso está terminado aunque no haya fase siguiente.

### Cuándo activar `completada`

```typescript
completada={['Aprobado', 'Autorizada', 'Activo', 'Activa'].includes(formData.estatusSolicitud || '')}
```

Esto aplica al `FlujoTrabajo` visible en el header de la solicitud y en el subtab "Flujo de Trabajo". Cuando la solicitud llega a estatus final, **todas las fases** (incluyendo la actual) se muestran en verde con ✓ y la conexión al nodo "Fin" también es verde.

---

## 14. Subtabs — Orden estándar

Orden unificado en `SolicitudCreditoForm` y `OriginacionModule`:

1. Default
2. Términos y Condiciones
3. Simulación
4. Expediente Electrónico
5. Partes Relacionadas
6. Garantías
7. Comités
8. Autorizaciones
9. Fases
10. Cargos
11. Comisiones
12. Notas
13. Flujo de Trabajo
