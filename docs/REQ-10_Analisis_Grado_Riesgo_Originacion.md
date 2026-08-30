# HU — REQ-10: Subtab "Modelo y Viabilidad Financiera" en Solicitud / Originación

> **Origen:** BPM del producto *Garantía Financiera 2o Piso* —
> **Etapa 1, Actividad 5: "Análisis de Grado de Riesgo"**, capturado el 27/08/2026.
> Continúa a [REQ-9](REQ-9_Estructura_Operativa_2o_Piso_Originacion.md), que cubrió la
> Actividad 4 (Admisión y Captura del Ecosistema).
> Traducido a alcance técnico contra el código real de
> **`src/app/components/solicitudes/`**.

---

## Requerimiento original (transcripción, para trazabilidad)

**Objetivo:** capturar las proyecciones de ingresos de la obra de infraestructura,
configurar el tamaño del Fondo de Reserva y calcular el indicador de cobertura para
dictaminar el nivel de riesgo técnico del proyecto.

**Descripción de negocio:** el analista de riesgos evalúa el flujo de efectivo que
generará el proyecto (ej. cobro de casetas de peaje). El sistema debe verificar
matemáticamente si el dinero recaudado por el fideicomiso alcanzará para cubrir los costos
de operación, llenar el Fondo de Reserva y pagar a los inversionistas de los bonos. **Si
los flujos son muy ajustados, el Core detendrá el proceso.**

### Bloque A — Parámetros del Amortiguador (obligatorios)

| Campo | Control |
|---|---|
| `Fuente_Primaria_Ingreso` | Dropdown: Peajes/Tarifas · Contraprestación Estatal · Flujos de Agua · Participaciones |
| `Monto_Fondo_Reserva_Fideicomiso` | Input numérico moneda (ej. $120,000,000.00) — monto retenido en el fideicomiso como primera defensa |

### Bloque B — Matriz de Proyecciones Financieras

Grid dinámico con tantas filas como el `Plazo_Bonos_Años` heredado (ej. 15 filas):

| Columna | Tipo |
|---|---|
| Año | Solo lectura (1 … N) |
| `EBITDA_Proyectado` | Input numérico moneda — flujo libre generado por la obra |
| `Servicio_Deuda_Bursátil` | Input numérico moneda — capital + intereses del año |
| `DSCR_Anual` | **Calculado, solo lectura:** EBITDA ÷ Servicio de Deuda |

### Bloque C — Indicadores de Riesgo Institucional (calculados, solo lectura)

- `DSCR_Promedio_Proyecto` — decimal (ej. 1.35)
- `Semáforo_Riesgo_Interno` — badge Verde / Amarillo / Rojo

### Bloque D — Conclusión Técnica

- `Dictamen_Riesgo_Texto` — textarea obligatorio, **mínimo 200 caracteres**

**Botón principal:** *[Procesar Grado de Riesgo y Generar Dictamen]*

> **Nota del requerimiento:** al cerrar esta actividad se avanza a la Etapa 6
> (Dictaminación de Comités): el expediente congelado viaja al Comité de Prepago y Crédito
> (CPC) y después al Comité Interno de Crédito (CIC).

---

## Contexto técnico (verificado en código, NO re-investigar)

### El acordeón — mismo patrón que REQ-9

`sections` en
[SolicitudCreditoForm.tsx:2754](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L2754),
con entrada condicional y **un solo acordeón montado a la vez** (abrir otro desmonta el
actual). La bandera `esGPOForm` **ya existe** en el formulario — se creó en REQ-9 y detecta
el producto por nombre **o** por presencia de los datos GPO heredados.

### Persistencia — los cuatro extremos

Idéntico a REQ-9: sesión → `subtabKeys` (**dos ocurrencias**, L1402 y L2688) →
`formToDBPayload` → `preloadSubtabsFromDBData`.

> **Guarda obligatoria contra pérdida de datos.** Nunca persistir un objeto vacío que el
> montaje actual no produjo. Ver `persistenciaSegura` en
> [EstructuraOperativa2oPisoTab.tsx](../src/app/components/solicitudes/EstructuraOperativa2oPisoTab.tsx)
> y el bug que borró documentos del expediente por no tenerla.

### BLOQUEANTE — `Plazo_Bonos_Años` no llega a la Solicitud

El número de filas del Bloque B depende de este campo. Hoy **vive sólo en la Oportunidad**:

- Se fija desde la fila de Matriz de Tasa Fija:
  [`plazoBonosAnios: String(m.plazoDefault)`](../src/app/components/oportunidades/OportunidadForm.tsx#L714)
  y es editable en Estructura Bursátil (L1219-1221).
- Es obligatorio para el Cierre Comercial (L869).
- **Pero no está en el payload `terminosLOS`** que crea la Solicitud
  ([OportunidadForm.tsx](../src/app/components/oportunidades/OportunidadForm.tsx#L573)).
  Fuera de `OportunidadForm`, sólo aparece en `cotizacionCreditoTypes.ts` (la interfaz) y
  en `cartaOfertaPDF.ts`.

> **Paso 0 obligatorio:** mapear `plazoBonosAnios` de la Oportunidad a la Solicitud, en los
> **dos** caminos de creación (Cierre Comercial y "+ Nueva Solicitud"), igual que se hizo
> con `periodicidadCobroGpo` y `plazosProducto`. Sin esto, el grid no sabe cuántas filas
> generar.

### Excel — la librería ya está en el proyecto

**`xlsx` ^0.18.5** es dependencia declarada y se usa en al menos cinco módulos:
[Calendario](../src/app/components/clientes/Calendario.tsx),
[CobranzaNormal](../src/app/components/clientes/CobranzaNormal.tsx),
[CobranzaAcumulativa](../src/app/components/clientes/CobranzaAcumulativa.tsx),
[EstadoCuenta](../src/app/components/clientes/EstadoCuenta.tsx) y
[CatalogoContableSection](../src/app/components/configuracion/CatalogoContableSection.tsx).

**No hay que agregar dependencias** para importar/exportar Excel. Conviene revisar cómo lo
hacen esos módulos y seguir el mismo patrón.

### Distinción importante: `Plazo` ≠ `Plazo_Bonos_Años`

REQ-9 dejó establecido que en GPO el campo `Plazo` de Términos y Condiciones se captura en
**años** y define la duración del financiamiento, mientras que la comisión se proyecta a
**1 año** con la Periodicidad Cobro Comisión. `Plazo_Bonos_Años` es un tercer concepto: el
plazo de la **emisión bursátil**, y es el que dimensiona esta matriz. **No reutilizar
ninguno de los otros dos.**

---

## Objetivo

Que el analista de riesgos capture las proyecciones anuales del proyecto y el Fondo de
Reserva, que el sistema calcule el DSCR por año y su promedio, clasifique el riesgo con un
semáforo, y que el expediente no pueda avanzar a Comités si la cobertura resulta
insuficiente o el dictamen técnico está incompleto.

---

## Alcance

### 0. Mapear `plazoBonosAnios` Oportunidad → Solicitud

En los dos payloads de `OportunidadForm` (Cierre Comercial y "+ Nueva Solicitud"), agregar
`plazoBonosAnios` a `terminosLOS` / `_terminosCondiciones`, y cerrar su persistencia en
`formToDBPayload` y `preloadSubtabsFromDBData` como se hizo con `plazosProducto`.

### 1. Subtab "Modelo y Viabilidad Financiera" — NUEVO

**Id:** `modeloViabilidad` · **Label:** `Modelo y Viabilidad Financiera`
**Visibilidad:** condicional a `esGPOForm` (bandera existente).
**Posición sugerida:** después de `estructura2oPiso` — sigue el orden del BPM.

#### Bloque A

| Campo | Clave | Obligatorio |
|---|---|---|
| Fuente Primaria de Ingreso | `fuentePrimariaIngreso` | Sí |
| Monto Fondo de Reserva | `montoFondoReservaFideicomiso` | Sí |

Catálogo de la fuente: `Peajes/Tarifas`, `Contraprestación Estatal`, `Flujos de Agua`,
`Participaciones`.

#### Bloque B — matriz

- `N` filas, con `N = plazoBonosAnios`. Si el plazo cambia, **conservar** los valores
  capturados en las filas que sobreviven; no regenerar la matriz desde cero.
- `DSCR_Anual = EBITDA ÷ Servicio de Deuda`. **División entre cero:** si el servicio de
  deuda es 0 o vacío, mostrar `—`, no `Infinity` ni `NaN`.
- Montos con separadores de miles, mismo tratamiento que el resto del formulario.

#### Bloque C — indicadores

- `DSCR_Promedio_Proyecto` = promedio de los DSCR anuales **calculables** (se excluyen las
  filas sin servicio de deuda; promediar sobre el total metería ceros que no existen).
- `Semáforo_Riesgo_Interno` — los umbrales **no vienen en el requerimiento**; ver
  §Decisiones pendientes.

#### Bloque D

- `dictamenRiesgoTexto` — textarea, **mínimo 200 caracteres**, con contador visible para
  que el usuario sepa cuánto le falta.

### 2. Botón [Procesar Grado de Riesgo y Generar Dictamen]

Dentro del subtab. Al presionarlo:

1. Valida Bloques A, B y D.
2. Recalcula DSCR promedio y semáforo.
3. Persiste el resultado.
4. Genera el documento de dictamen y lo adjunta al Expediente Electrónico — mismo
   mecanismo que `autoCrearDocumentosComitePrepago`
   ([generarDocumentosFase4.ts](../src/app/hooks/generarDocumentosFase4.ts)): PDF →
   Supabase Storage → expediente → persistencia inmediata en BD, e **idempotente** para no
   duplicar al reprocesar.

### 3. Bloqueo del avance de fase

*"Si los flujos son muy ajustados, el Core detendrá el proceso."*

Al salir de la fase de Análisis de Grado de Riesgo, bloquear si:

- falta cualquier obligatorio del Bloque A,
- hay filas de la matriz sin capturar,
- el dictamen no llega a 200 caracteres,
- **el semáforo es Rojo** (ver §Decisiones pendientes: ¿bloqueo duro o con autorización?).

El aviso debe **nombrar los campos o condiciones** que faltan, siguiendo el patrón ya
aplicado en `validate()` y en el bloqueo por documentos.

### 4. Importar / Exportar Excel

- **Exportar:** genera un archivo con la matriz del Bloque B más los parámetros del Bloque
  A y los indicadores del C.
- **Importar:** lee un archivo con la misma estructura y llena la matriz, validando que el
  número de filas coincida con `plazoBonosAnios` y que las columnas sean numéricas.
- Al importar, **no pisar en silencio** lo ya capturado: avisar cuántas filas se
  reemplazan.

> Ver §Decisiones pendientes — la plantilla es del usuario y aún no está en el repo.

---

## Criterios de aceptación

1. **CA-01** — Con producto GPO aparece el acordeón; con cualquier otro, no.
2. **CA-02** — La matriz genera exactamente `plazoBonosAnios` filas, numeradas 1…N.
3. **CA-03** — `DSCR_Anual` se recalcula al cambiar EBITDA o Servicio de Deuda.
4. **CA-04** — Con Servicio de Deuda 0 o vacío, el DSCR muestra `—` (no `Infinity`/`NaN`).
5. **CA-05** — `DSCR_Promedio_Proyecto` promedia sólo las filas calculables.
6. **CA-06** — El semáforo cambia de color según los umbrales acordados.
7. **CA-07** — El dictamen con menos de 200 caracteres no deja procesar, y el contador lo
   indica.
8. **CA-08** — Capturar, cambiar de acordeón y volver: los valores siguen ahí.
9. **CA-09** — Guardar, recargar la app y reabrir: los valores siguen en base de datos.
10. **CA-10** — Abrir el subtab y navegar **sin capturar** no borra lo ya guardado.
11. **CA-11** — [Procesar…] adjunta el dictamen al Expediente y no lo duplica al repetir.
12. **CA-12** — Con datos incompletos, el avance de fase se bloquea nombrando lo que falta.
13. **CA-13** — Exportar produce un archivo abrible; reimportarlo reproduce la misma matriz.
14. **CA-14** — Cambiar `plazoBonosAnios` conserva los valores de las filas que persisten.

---

## Decisiones pendientes (bloquean parte del alcance)

**1. Umbrales del semáforo.** El requerimiento pide Verde/Amarillo/Rojo pero no dice a
partir de qué DSCR. Un criterio común en project finance es Verde ≥ 1.25, Amarillo
1.10–1.24, Rojo < 1.10 — **hay que confirmarlo**, no inventarlo: define cuándo el Core
detiene la operación.

**2. Qué significa "el Core detendrá el proceso".** ¿Semáforo Rojo bloquea el avance de
forma dura, o permite continuar con autorización de un perfil superior? Cambia si es una
validación o un flujo de excepción.

**3. La plantilla de Excel.** Mencionas que ya la tienes; **no está en el repo**. Sin
verla no se puede fijar el mapeo de celdas. Se necesita el archivo o, como mínimo: hoja,
fila de encabezados, y en qué columna va cada campo.

**4. Alcance del Excel.** ¿Sólo exportar, o también importar? Importar exige validar
estructura y decidir qué hacer ante discrepancias de filas.

---

## Fuera de alcance (y por qué)

| Tema | Motivo |
|---|---|
| Etapa 6 — Comités CPC y CIC | La nota del requerimiento la anuncia pero no la especifica. HU aparte |
| Congelar el expediente técnico | Se menciona al pasar; no hay definición de qué se congela ni cómo se descongela |
| Recalcular el Servicio de Deuda | El requerimiento lo pide como **input**, no como cálculo. Derivarlo exigiría la estructura de amortización de los bonos |
| Modelar el llenado del Fondo de Reserva año por año | Sólo se pide el monto total como parámetro |

---

## Advertencias

- **Un solo acordeón montado a la vez** — todo estado debe persistirse fuera de React.
- **`subtabKeys` está duplicado** — agregar la clave en las dos ocurrencias.
- **No reutilizar `Plazo` ni `Periodicidad Cobro Comisión`** para dimensionar la matriz:
  son conceptos distintos de `Plazo_Bonos_Años` (ver contexto técnico).
- **La matriz puede ser grande** (15–30 filas × 3 campos). Con `saveToSession` en cada
  tecla se escribe mucho; conviene *debounce*. Recordar que `sessionStorage` tiene cuota y
  que su fallo era silencioso — hoy `saveToSession` ya reporta, pero conviene no abusar.
- **Persistir la matriz como arreglo de objetos**, no como celdas sueltas: simplifica el
  *deep merge* contra el JSONB original.

---

## Orden de ejecución

0. **Mapear `plazoBonosAnios`** Oportunidad → Solicitud y cerrar su persistencia.
1. Resolver las **decisiones pendientes** 1 y 2 (umbrales y bloqueo) — condicionan los
   Bloques C y el avance de fase.
2. Crear el subtab con Bloques A, B, C y D, con la guarda de persistencia segura.
3. Registrar la sección con visibilidad `esGPOForm` y su rama de render.
4. Cerrar la persistencia: sesión → `subtabKeys` (×2) → `formToDBPayload` →
   `preloadSubtabsFromDBData`.
5. Implementar [Procesar Grado de Riesgo y Generar Dictamen] con el generador de PDF
   idempotente.
6. Agregar el bloqueo de avance de fase con mensaje que nombre lo faltante.
7. Excel: exportar primero (no depende de la plantilla), importar después de recibirla.
8. Probar **corriendo la app** los CA-08, CA-09, CA-10 y CA-14 — son los que detectan
   pérdida de datos y no se ven en un typecheck.
