# Mapeo de Campos — Módulo de Solicitudes

Documento de referencia para el formulario `SolicitudCreditoForm` y su ciclo de vida completo:
creación → guardado en BD → lista → reapertura.

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
| `fecha_inicio` | `date` | `form.fechaInicio` | Vigencia inicio crédito |
| `fecha_fin_cu` | `date` | `form.fechaFin` | Vigencia fin crédito |
| `descripcion` | `text` | `form.descripcion` | Texto libre |
| `linea_produc` | `text` | `form.lineaProducto` | `Crédito` / `Captación` / `Línea de Crédito` |
| `tipo_produc` | `text` | `form.tipoProducto` | Crédito Simple, Revolvente… |
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

| Clave JSONB `_raw` | Campo frontend (`TerminosCondiciones`) |
|---|---|
| `montoSolicitado` | `terminos.montoSolicitado` |
| `plazo` | `terminos.plazo` |
| `tasa` | `terminos.tasa` |
| `frecuencia` | `terminos.frecuencia` |
| `tipoTasa` | `terminos.tipoTasa` |
| `tipoCalculo` | `terminos.tipoCalculo` |
| `moneda` | `terminos.moneda` |
| `montoGarantia` | `terminos.montoGarantia` |
| `seguroFinanciado` | `terminos.seguroFinanciado` |
| `montoSeguro` | `terminos.montoSeguro` |
| `fechaPrimerPago` | `terminos.fechaPrimerPago` |
| `fechaPrimeraAportacion` | `terminos.fechaPrimeraAportacion` |
| `fechaInicio` | `terminos.fechaInicio` |
| `fechaFin` | `terminos.fechaFin` |

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

### `data.solicitud.expediente_electronico.documentos[]`

| Clave JSONB | Campo en subtab Expediente |
|---|---|
| `id` | `doc.id` |
| `fecha_creacion` | `doc.fecha` |
| `usuario` | `doc.usuario` |
| `tipo_documento` | `doc.tipoDocumento` |
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

## 4. Flujo completo de un campo (ejemplo: `tipoPersona`)

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

---

## 5. Reconstrucción al reabrir — cadena de fallbacks completa

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

---

## 6. Diferencias Crédito vs Captación en `rawData` del producto

Al seleccionar un producto, el form lee `rawData` de `J_PRODUCTOS`.

| Campo | Crédito | Captación |
|---|---|---|
| Fases | `rawData.fases` (array) | `rawData.fasesRegistros` (array) — `rawData.fases` es `{}` vacío |
| Expediente | `rawData.expedientesElectronicos` | `rawData.expedientesRegistros` |
| ID del producto | `c.producto_id` (UUID) | `c.producto_id` (UUID) — **nunca** `claveProducto` |

> **Regla crítica:** Usar siempre `Array.isArray(x) && x.length > 0 ? x : null` antes de `??`
> — el campo `fases: {}` en Captación es truthy y bloquea el fallback con `??` simple.