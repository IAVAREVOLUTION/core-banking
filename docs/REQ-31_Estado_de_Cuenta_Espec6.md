# HU — REQ-31: Generación de Estado de Cuenta (ESPECIFICACIÓN 6)

> **Estado: aplicado.** `npm run build` compila sin errores nuevos.
> El motor pasa **74 aserciones**, 0 fallas. Total del proyecto: **429
> aserciones** en seis suites (`npm run test:tdc`).
>
> Las tres decisiones de la sección 3 se implementaron con la **opción (a)** en
> las tres.
>
> **Pendiente de operación:** ejecutar en Supabase, en orden,
> `create_rpc_movimiento_tdc.sql` → `create_rpc_cierre_corte_tdc.sql` →
> `create_rpc_aplicacion_pagos_tdc.sql` → **`create_rpc_estado_cuenta_tdc.sql`**.
> Hasta entonces la pantalla avisa que las funciones no existen en vez de
> fingir que generó.
>
> A diferencia de REQ-26…REQ-30, la sección 1 de esta HU se escribió **antes**
> de programar, porque §24 lo exige y porque es la primera del ciclo TDC que
> toca UI nueva, documento persistido, plantilla y permisos.

---

## 1. Descubrimiento (§24) — qué existe ya

| Concepto de la ESPEC 6 | Qué hay hoy en el sistema | Dónde |
|---|---|---|
| Módulo **Cartera TDC** | `CarteraTDCModule` → `CarteraTDCForm`, con 10 subpestañas en una constante `TABS` | [CarteraTDCForm.tsx:104](../src/app/components/cartera-tdc/CarteraTDCForm.tsx#L104) |
| Agregar una subpestaña | Un `{id,label}` más en `TABS` y un bloque `activeTab === '…'` | [CarteraTDCForm.tsx:534](../src/app/components/cartera-tdc/CarteraTDCForm.tsx#L534) |
| `IdLineaCredito` | `cuenta.id` — el mismo valor que ya reciben `CierreCorteTab` y `AplicacionPagosTab` como prop `sid` | [CarteraTDCForm.tsx:536](../src/app/components/cartera-tdc/CarteraTDCForm.tsx#L536) |
| `IdCliente`, `Producto`, `LimiteAutorizado`, `Moneda`, `Estatus` | `cuenta.clienteId`, `cuenta.productoNombre`, `cuenta.montoAut`, `cuenta.moneda`, `cuenta.estatus` — ya pintados en el encabezado | [CarteraTDCForm.tsx:70](../src/app/components/cartera-tdc/CarteraTDCForm.tsx#L70) |
| **Periodo de corte** | **No existe entidad `Periodo`.** El periodo *es* la CxC: `fecha_inicio` / `fecha_fin` | `J_CXC_LINEA` |
| `FechaCorte` | `J_CXC_LINEA.fecha_documento` (= `fecha_fin`, por §17 de la ESPEC 3) | [create_rpc_cierre_corte_tdc.sql:89](../supabase/migrations/create_rpc_cierre_corte_tdc.sql#L89) |
| `FechaLimitePago` | `J_CXC_LINEA.fecha_vencimiento` | ídem |
| **Aviso de Vencimiento** | **Es la misma CxC.** `obtener_avisos_tdc(p_linea_id, p_cliente_id)` la devuelve con su detalle embebido | [create_rpc_avisos_tdc.sql:49](../supabase/migrations/create_rpc_avisos_tdc.sql#L49) |
| `MontoDocumento`, `SaldoDocumento`, `PagoMinimo`, `Detail` | `monto_total_pagar`, `saldo_pendiente`, `monto_minimo_pagar`, `detalle jsonb` — todos los devuelve ese mismo RPC | ídem |
| `PagoNoGeneraIntereses` | **No existe.** Ni columna, ni cálculo, ni configuración en el producto | — |
| Movimientos del periodo | `obtener_cargos_linea(p_linea_id, p_fecha_inicio, p_fecha_fin)` sobre `J_CARGOS_LINEA` | [create_rpc_cierre_corte_tdc.sql:314](../supabase/migrations/create_rpc_cierre_corte_tdc.sql#L314) |
| Pagos aplicados | `J_PROCESOS_APLICACION_PAGO` (`fecha_pago`, `resultado = 'OK'`) y `J_APLICACIONES_PAGO_CXC` (`fecha_aplicacion`, `cxc_id`) | [create_rpc_aplicacion_pagos_tdc.sql](../supabase/migrations/create_rpc_aplicacion_pagos_tdc.sql) |
| `CreditoDisponible` y consumo | `J_SALDOS_LINEA` — `monto_autorizado`, `saldo_disponible` | [create_rpc_movimiento_tdc.sql:150](../supabase/migrations/create_rpc_movimiento_tdc.sql#L150) |
| Plantillas del Taller de Producto | `PlantillasTab`, ya montado en el producto Línea de Crédito | [ProductoLineaCreditoForm.tsx:1184](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx#L1184) |
| Tipo de plantilla | `TIPO_PLANTILLA_CATALOGO` — **no tiene `estado-cuenta`** | [product.ts:279](../src/app/types/product.ts#L279) |
| Render plantilla → PDF | `decodificarArchivoData()` → sustitución de `{{CLAVE}}` → `htmlToPdfBlobUrl()`. Pipeline probado en Carta Oferta y en el kit legal de Fase 4 | [cartaOfertaPDF.ts:126](../src/app/components/oportunidades/cartaOfertaPDF.ts#L126) |
| Guardado del PDF | Bucket `make-7e2d13d9-expedientes-electronicos-prospectos`, con **degradación a blob URL local** si Storage falla | [cartaOfertaPDF.ts:165](../src/app/components/oportunidades/cartaOfertaPDF.ts#L165) |
| Usuario que ejecuta | `currentUser.name`; los RPC del ciclo TDC ya reciben `p_usuario` | [mockData.ts:1264](../src/app/data/mockData.ts#L1264) |
| Permisos | No hay perfiles por acción. Sólo `isRO`/`mode` por subtab y el acotamiento de módulos de REQ-25 | [CarteraTDCForm.tsx:131](../src/app/components/cartera-tdc/CarteraTDCForm.tsx#L131) |
| **Entidad histórica** | **No existe.** Hay que crear `J_ESTADOS_CUENTA` | — |

> [clientes/EstadoCuenta.tsx](../src/app/components/clientes/EstadoCuenta.tsx) existe
> pero **no sirve aquí**: es un subtab del Cliente con créditos y pagos de sesión
> y exportación a XLSX. Coincide el nombre, no el propósito. No se reutiliza ni
> se modifica.

---

## 2. Tres hallazgos que corrigen el texto de la especificación

**H-1. El Aviso de Vencimiento no es una entidad aparte del corte.**
§11 dibuja `LineaCredito → PeriodoCorte → AvisoVencimiento` como tres cosas. En
este sistema son **una**: el cierre de corte produce la CxC, y el Aviso *es* esa
CxC. En consecuencia la validación §17.4 —"existe el corte pero no su Aviso"— es
inalcanzable salvo que la CxC esté `Cancelada`. Se conserva el mensaje literal,
pero cubriendo ese caso real y no uno imposible.

**H-2. `PagoNoGeneraIntereses` no existe en ninguna parte.**
§11 y §14 lo piden. El cierre de corte no lo calcula, el producto no lo
configura y la CxC no lo guarda. No se puede "obtener del Aviso" algo que el
Aviso nunca tuvo. Ver decisión **D2**.

**H-3. El corte no arrastra saldo anterior.**
`montoTotalPagar = suma del detalle del periodo`
([motorCierreCorteTDC.ts:390](../src/app/lib/motorCierreCorteTDC.ts#L390)): sólo
los cargos de ese periodo. El parámetro `saldoVencido` existe en el motor pero
**hoy nadie lo alimenta** —siempre llega 0— y sólo afecta al pago mínimo. Por lo
tanto la identidad clásica de tarjeta

```text
SaldoAnterior + CargosPeriodo − PagosPeriodo = SaldoAlCorte
```

**no se cumple** contra `monto_total_pagar` — y eso quedó confirmado. Por eso
D3 terminó calculando el saldo con esa identidad en vez de tomarlo del Aviso:
el importe facturado y el saldo son dos cifras distintas, y el documento
necesita la segunda.

---

## 3. Decisiones (resueltas al implementar)

### D1 — Dónde vive el PDF · **resuelta: (a) Storage obligatorio**

§22 es tajante: *"Nunca deberá aparecer `Estatus = GENERADO` sin existir un PDF
válido asociado"*. El mecanismo actual degrada a `URL.createObjectURL(...)`, que
muere al recargar la página — eso sería exactamente un GENERADO sin PDF.

| Opción | Consecuencia |
|---|---|
| **(a) Storage obligatorio** ← **implementada** | Si el upload falla, **no se guarda el Estado de Cuenta**: se aborta con mensaje accionable. Cumple §22 al pie de la letra. |
| (b) Storage con respaldo base64 en la fila | Siempre hay PDF, pero mete documentos completos en la base y vuelve la tabla pesada e incómoda de consultar. |

### D2 — `PagoNoGeneraIntereses` · **resuelta por negocio (22/09/2026)**

La primera versión lo dejó en cero y rotulado "No configurado", porque H-2
constataba que el sistema no lo calculaba en ninguna parte. CACAO Banking
definió la fórmula:

```text
PagoNoGeneraIntereses = CargosPeriodo + SaldoAnterior
```

Es el total que se debe al corte. **No** se descuentan los pagos ya aplicados:
el importe describe lo que evita intereses, no el faltante a la Fecha Estado.
Por eso un cliente que ya pagó parte lo verá igual que antes de pagar, y el
faltante real se lee restándole `PagosPeriodo`.

La columna `pago_no_genera_intereses_configurado` se conserva: los Estados
emitidos antes de esta definición guardaron cero, y el historial no debe
presentar ese cero viejo como si fuera un importe calculado.

### D3 — `SaldoAlCorte` · **resuelta por negocio (22/09/2026)**

La primera versión lo tomaba del Aviso (`monto_total_pagar`) sin recalcular,
por coherencia con ESPEC 5 §20. CACAO Banking definió la identidad:

```text
SaldoAlCorte = SaldoAnterior + CargosPeriodo − PagosAplicados
```

No contradice a ESPEC 5: son dos cosas distintas. El Aviso conserva intacto su
importe **facturado**, que sigue siendo la base de la póliza de
`CORTE_PERIODO`; el Estado de Cuenta describe el **saldo**, que los pagos
reducen. Por eso el documento puede decir 580 mientras el Aviso sigue valiendo
10,580.

Dos consecuencias que quedaron cubiertas en el motor:

1. **El saldo puede salir negativo.** §9 considera los pagos de toda la Línea
   hasta la Fecha Estado, no sólo los aplicados a este periodo, así que un
   cliente que pagó de más queda con saldo a favor. Se emite igual: rechazarlo
   impediría generar el estado justo a quien está al corriente.
2. **El Pago Mínimo ya no se compara contra este saldo**, sino contra lo
   facturado más el saldo anterior. Si no, a un cliente que liquidó le saldría
   "el mínimo excede el saldo" y no podría emitir su documento.

Queda una relación útil para leer el documento:
`PagoNoGeneraIntereses = SaldoAlCorte + PagosAplicados`.

---

## 4. Historias de usuario

### HU-31.1 — La subpestaña opera dentro de la línea ya abierta (§6, §24.7–24.9)

| # | Criterio de aceptación |
|---|---|
| CA-01 | `Cartera TDC → Estado de Cuenta` existe como subpestaña, con el mismo patrón de `TABS` que las otras diez. |
| CA-02 | No se captura Cliente, Número de Línea ni Producto: salen de `cuenta.*` (§6). |
| CA-03 | El Producto se resuelve dinámicamente desde la línea con `useProductosLineaCreditoDB`, igual que `CierreCorteTab`. |
| CA-04 | El único campo capturable es **Fecha Estado** (§4.1), obligatorio, tipo fecha. |
| CA-05 | En modo sólo lectura (`isRO`) el botón **Generar Edo Cuenta** no se muestra; el historial y el PDF sí (§18). |

### HU-31.2 — La Fecha Estado elige el periodo (§7, §8)

| # | Criterio de aceptación |
|---|---|
| CA-06 | Se toma la CxC con `MAX(fecha_documento)` tal que `fecha_documento <= FechaEstado`, de esa línea (§7). |
| CA-07 | `FechaCorte`, `FechaEstado` y `FechaGeneracion` se almacenan **por separado** y pueden diferir (§8). |
| CA-08 | `FechaGeneracion` es la fecha y hora real del clic, no la Fecha Estado (§8). |
| CA-09 | El ejemplo de §7 se reproduce: corte 15/09/2026 y Fecha Estado 05/10/2026 → periodo 16/08–15/09. |

### HU-31.3 — El snapshot refleja sólo lo conocido a esa fecha (§9, §10, §15)

| # | Criterio de aceptación |
|---|---|
| CA-10 | Un pago con `fecha_pago <= FechaEstado` y proceso `resultado = 'OK'` entra (§9). |
| CA-11 | Un pago posterior a la Fecha Estado **no** entra — el ejemplo de §15 (20,000 sí, 5,000 no) es caso de prueba. |
| CA-12 | Los movimientos son los del periodo: `fecha >= fecha_inicio AND fecha <= fecha_fin`, con la misma fecha contable de la ESPEC 3 (§10). |
| CA-13 | La generación **no modifica** ningún movimiento, cargo ni CxC: sólo lee (§10). |
| CA-14 | `SaldoAlCorte` sale de la CxC, no de un recálculo (D3). |
| CA-15 | Regenerar mañana con la misma Fecha Estado daría el mismo snapshot: es histórico, no una vista viva (§24.15). |

### HU-31.4 — No se generan dos Estados para la misma fecha (§16, §21)

| # | Criterio de aceptación |
|---|---|
| CA-16 | `UNIQUE (linea_id, fecha_estado)` en la base — la protección de backend es obligatoria (§21.3). |
| CA-17 | Antes de generar se valida y se muestra el mensaje literal de §16. |
| CA-18 | Doble clic no produce dos documentos: el botón se deshabilita mientras procesa **y** el backend rechaza el segundo (§21.1, §21.2). |
| CA-19 | La regeneración **no** se implementa: §16 la deja como acción explícita y separada. |

### HU-31.5 — Nunca hay GENERADO sin PDF (§22)

| # | Criterio de aceptación |
|---|---|
| CA-20 | El Estado se marca `GENERADO` sólo después de que el PDF está guardado y referenciado (§22). |
| CA-21 | Si el PDF falla, no queda fila en `GENERADO`: se aborta, o queda `ERROR` con su mensaje (§19, §22). |
| CA-22 | Un blob URL local **no** cuenta como PDF válido (D1). |
| CA-23 | Prueba de humo: ninguna fila `GENERADO` con `id_documento_pdf` nulo. |

### HU-31.6 — El PDF sale de la plantilla del producto (§11, §12 pasos 11–12)

| # | Criterio de aceptación |
|---|---|
| CA-24 | La plantilla se busca por `tipoPlantilla = 'estado-cuenta'` y `estatus = 'Activo'` en el producto de la línea. |
| CA-25 | Sin plantilla configurada se falla con un mensaje accionable que dice dónde cargarla — como ya hace `generarCartaOferta`. |
| CA-26 | Se reutiliza el pipeline existente (`decodificarArchivoData` → sustitución → `htmlToPdfBlobUrl`); no se crea un segundo generador de PDF. |
| CA-27 | Ningún importe se calcula en la plantilla: llegan ya resueltos como placeholders. |

### HU-31.7 — Historial y auditoría (§13, §19, §20)

| # | Criterio de aceptación |
|---|---|
| CA-28 | Grid con las columnas de §13, ordenado por `FechaEstado DESC` (§20). |
| CA-29 | La columna Acción abre el PDF guardado. |
| CA-30 | Cada generación registra usuario, fecha-hora, línea, Fecha Estado, id del Estado y resultado (§19). |
| CA-31 | Un intento fallido también deja rastro, con código y mensaje de error (§19). |
| CA-32 | El grid se refresca solo al terminar (§12 paso 15). |

### HU-31.8 — Validaciones de fecha (§17)

| # | Criterio de aceptación |
|---|---|
| CA-33 | Fecha Estado vacía → *"Debe capturar la Fecha Estado."* |
| CA-34 | Fecha Estado futura → *"La Fecha Estado no puede ser mayor a la fecha actual."* |
| CA-35 | Sin corte disponible → *"No existe un periodo de corte disponible para la Fecha Estado seleccionada."* |
| CA-36 | CxC cancelada como único candidato → *"No existe un Aviso de Vencimiento asociado al periodo seleccionado."* (§17.4, reinterpretado por H-1). |
| CA-37 | En cualquiera de los cuatro casos **no** se genera PDF ni fila. |

---

## 5. Entregables

### Archivos creados

| Archivo | Qué es |
|---|---|
| [motorEstadoCuentaTDC.ts](../src/app/lib/motorEstadoCuentaTDC.ts) | Motor puro: elección de periodo (§7), filtrado de pagos y movimientos (§9, §10), snapshot (§14) y validación de consistencia (§12 paso 10). Sin E/S. |
| [generarEstadoCuentaTDC.ts](../src/app/lib/generarEstadoCuentaTDC.ts) | Orquestación: lee vía RPC, corre el motor, renderiza el PDF, lo sube a Storage y persiste. |
| [EstadoCuentaTDCTab.tsx](../src/app/components/cartera-tdc/EstadoCuentaTDCTab.tsx) | La subpestaña: captura, vista previa del snapshot, botón e historial (§4, §13, §20). |
| [create_rpc_estado_cuenta_tdc.sql](../supabase/migrations/create_rpc_estado_cuenta_tdc.sql) | Tablas, RPC transaccional y lectores. |
| [espec6-estado-cuenta.mjs](../tests/tdc/espec6-estado-cuenta.mjs) | 74 aserciones. |

### Métodos creados

`money()` · `aISO()` · `elegirPeriodo()` (§7) · `filtrarMovimientos()` (§10) ·
`filtrarPagos()` (§9) · `estadoCuentaAnterior()` (§12 paso 8) ·
`saldoAnteriorDeAvisos()` (D3) · `validarConsistencia()` (§12 paso 10) ·
`generarEstadoCuenta()` (§23 completo) · `construirDatosEstadoCuenta()` ·
`sustituirPlaceholders()` · `cargarContextoEstadoCuenta()` ·
`cargarHistorialEstadosCuenta()` · `buscarPlantillaEstadoCuenta()` ·
`generarYGuardarEstadoCuenta()` · `urlDocumento()` · `traducirError()`

**En SQL:** `public.generar_estado_cuenta_tdc()` ·
`public.registrar_error_estado_cuenta()` · `public.obtener_estados_cuenta()` ·
`public.obtener_pagos_aplicados_linea()` · `public.obtener_saldo_linea()`

### Archivos modificados

| Archivo | Cambio |
|---|---|
| [CarteraTDCForm.tsx](../src/app/components/cartera-tdc/CarteraTDCForm.tsx) | Subtab **Estado de Cuenta**. |
| [product.ts](../src/app/types/product.ts) | Tipo de plantilla `estado-cuenta` en el catálogo, la unión y `TIPO_PLANTILLA_OPTIONS`. |
| [generarDocumentosFase4.ts](../src/app/hooks/generarDocumentosFase4.ts) | `tiposValidos` acepta `estado-cuenta`. **No previsto en la propuesta:** esa lista valida que ninguna plantilla del producto tenga tipo desconocido, así que sin el cambio un producto con plantilla de Estado de Cuenta habría quedado sin poder generar su kit legal de Fase 4. |
| [run.mjs](../tests/tdc/run.mjs) | Sexta suite en el runner. |

### Entidades

**Reutilizadas sin modificar:** `J_CXC_LINEA` y su detalle · `J_CARGOS_LINEA` ·
`J_SALDOS_LINEA` · `J_PROCESOS_APLICACION_PAGO` · `J_APLICACIONES_PAGO_CXC`.

**Nuevas:** `J_ESTADOS_CUENTA` (§14, con el CHECK de §22) ·
`J_ESTADOS_CUENTA_DETALLE` (el snapshot congelado del §12 paso 13) ·
`J_AUDITORIA_ESTADO_CUENTA` (§19).

**RPC reutilizados sin modificar:** `obtener_avisos_tdc` · `obtener_cargos_linea`.
Los tres lectores que faltaban se agregaron **nuevos** en esta migración
—pagos por línea, saldo de la línea e historial—: no se tocó ninguno de los
existentes (§58.9 de la ESPEC 4 sigue vigente).

**Servicio documental reutilizado:** `decodificarArchivoData` +
`htmlToPdfBlobUrl` + el bucket de expedientes, exactamente el pipeline de la
Carta Oferta. No se creó un segundo generador de PDF.

---

## 5.1 Lo que hay que probar a mano

Las 74 aserciones cubren el **motor**. Estas tres cosas sólo se pueden verificar
con la migración corrida y un producto configurado:

1. Cargar una plantilla HTML tipo **Estado de Cuenta** en el producto y generar:
   que el PDF salga con los placeholders sustituidos.
2. Doble clic sobre **Generar Edo Cuenta**: debe producir un solo documento
   (el botón se deshabilita, y si dos llegan juntas el índice único rechaza la
   segunda con el mensaje de §16).
3. Las dos pruebas de humo SQL del pie de la migración: cero filas en ambas.

---

## 6. Lo que esta HU deliberadamente no hará

- **Ningún scheduler ni job nocturno** — §3 lo prohíbe expresamente.
- **Regeneración de un Estado ya emitido** — §16 la deja como acción separada.
- **Recalcular intereses o saldos** — ESPEC 5 §20: la CxC es la fuente.
- **Tocar `clientes/EstadoCuenta.tsx`** — homónimo, otro propósito.
- **Construir un esquema de perfiles por acción** — no existe hoy; §18 se cumple
  con el `isRO` que la pantalla ya propaga. Si CACAO Banking quiere el permiso
  granular `Cartera TDC → Estado de Cuenta → Generar`, es una HU aparte, porque
  afectaría a todos los módulos por igual.
- **Modificar las ESPECIFICACIONES 1 a 5.**
