# HU — REQ-12: Autorización del Comité Interno de Crédito (CIC)

> **Origen:** BPM del producto *Garantía Financiera 2o Piso* — Etapa 6 (Dictaminación de
> Comités), **Actividad 6.2: "Autorización del Comité Interno de Crédito (CIC)"**,
> capturado el 28/08/2026.
> Continúa a [REQ-11](REQ-11_Votacion_Comite_Prepago_Credito.md) (Actividad 6.1:
> Votación del CPC), de donde esta HU consume directamente su resultado.
> Traducido a alcance técnico contra el código real de
> **`src/app/components/solicitudes/`**.

---

## Requerimiento original (transcripción, para trazabilidad)

**Objetivo:** sancionar la operación a nivel institucional superior y detonar el
pre-apartado de cupos en los límites de crédito globales.

**Descripción de negocio:** el CIC revisa el expediente con el visto bueno del CPC. Al
emitir su voto favorable, el sistema genera el **oficio formal de autorización** e
**instruye al Core realizar un bloqueo preventivo de líneas**, impidiendo que el banco
comprometa esa misma capacidad en otros proyectos mientras este se formaliza.

### Pantalla de Resolución Final CIC

**Resumen Ejecutivo** — un GRID con el resultado de la votación del paso anterior
(CPC): Votante 1, 2, 3…, Aprobado/Rechazado, descripción, **una cadena de firma
electrónica**. Historial y bitácora con los votos y comentarios emitidos en el CPC.

**Campos de Registro Legal Obligatorios:**

| Campo | Control |
|---|---|
| `Número_Acta_CIC` | Input de texto, ej. `ACTA-CIC-2026-042` |
| `Fecha_Sesión_CIC` | Date picker, ej. `10/08/2026` |

**Estatus de la Solicitud:** dropdown — *Aprobada por CIC* / *Rechazada Definitivamente*.

**Botón principal:** *[Emitir Oficio de Autorización y Bloquear Cupo]*.

---

## Contexto técnico (verificado en código, NO re-investigar)

### El Resumen Ejecutivo ya tiene de dónde salir — sin inventar nada

Todo lo que pide el grid **ya existe**, generado por REQ-11
([VotacionCPCTab.tsx](../src/app/components/solicitudes/VotacionCPCTab.tsx)):

| Pide el requerimiento | Ya existe como |
|---|---|
| "Votante 1, 2, 3…" | `VotoCPC.votante` — etiqueta `"Anónimo N"` autoasignada (REQ-11 decisión #1) |
| "Aprobado/Rechazado" | `VotoCPC.decision` — en realidad tres valores: `Aprobar / Rechazar / Devolver` |
| "Descripción" | `VotoCPC.comentarios` |
| **"Cadena de firma electrónica"** | `VotoCPC.firmaToken` — el folio aleatorio de REQ-11 (`generarFirmaAleatoria()`, formato `FIRMA-XXXXX-XXXXX`) |

`leerVotacionCPC(solicitudId)` y `conteoVotosCPC(votos)` están exportados y listos para
reusarse tal cual. **Este subtab no captura nada del CPC — sólo lee y muestra.**

### BLOQUEANTE — no existe una fase "Comité Interno de Crédito"

Verificado (grep exhaustivo de "Comité Interno", "COMITÉ INTERNO", "CIC" en todo el
código y configuración de producto): **cero resultados** fuera de esta HU y las menciones
de "fuera de alcance" en REQ-10/REQ-11.

Las 5 fases reales configuradas en el producto GPO:

1. Admisión y Captura del Ecosistema
2. Análisis de Grado de Riesgo
3. Dictamen del Comité de Prepago y Crédito
4. Validación de Cláusulas Fiduciarias
5. Activación de Línea 2o Piso

**Ninguna corresponde a "Autorización del CIC".** REQ-9 y REQ-11 tuvieron una fase
natural donde anclarse (la 3, con "comité" en el nombre, detectable con
`esFaseComitePrepago`). Esta actividad no la tiene. Ver §Decisiones pendientes #1 — es
la que más condiciona el resto del alcance.

### BLOQUEANTE MAYOR — el "bloqueo preventivo de líneas" no tiene dónde vivir

Búsqueda exhaustiva de "cupo global", "límite consolidado", "exposición de portafolio",
"bloqueo preventivo" en todo el repo: **no existe ningún concepto de capacidad
compartida entre Solicitudes.** Todo lo que hoy se llama "cupo" es **por Solicitud
individual**:

- `Monto Máximo Contingente` (REQ-9) — lo fija la Oportunidad, tope de 50% (RN-01).
- `Fondo de Reserva` (REQ-10, Bloque A del Modelo de Viabilidad).
- `Certificado de Pre-Apartado de Cupo` (REQ-9) — es un **documento PDF**, no un
  registro que reste contra ningún total.

**Ninguno de los tres impide que OTRA Solicitud, en paralelo, comprometa la misma
capacidad institucional.** Implementar el bloqueo real que pide el requerimiento exige
construir, desde cero:

1. Una tabla de límites globales (por línea de producto, sector, o lo que el negocio
   defina).
2. Un mecanismo de **reserva atómica** — dos Solicitudes aprobándose casi al mismo
   tiempo no deben poder comprometer juntas más que el límite disponible (condición de
   carrera real en un sistema con más de un usuario).
3. Una forma de **liberar** la reserva si la operación se cae antes de formalizarse.

Esto es una pieza de infraestructura de crédito corporativo completa — no cabe como
"agregar un botón" a esta pantalla. Ver §Decisiones pendientes #2.

### El catálogo de estatus no tiene los dos valores que pide el requerimiento

[`CAT_ESTATUS_SOLICITUD`](../src/app/components/solicitudes/solicitudCreditoStore.ts#L892-L900):

```ts
export const CAT_ESTATUS_SOLICITUD = [
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'En proceso', label: 'En proceso' },
  { value: 'En Análisis', label: 'En Análisis' },
  { value: 'Aprobado', label: 'Aprobado' },
  { value: 'Autorizada', label: 'Autorizada' },
  { value: 'Rechazado', label: 'Rechazado' },
  { value: 'Cancelado', label: 'Cancelado' },
];
```

No hay `"Aprobada por CIC"` ni `"Rechazada Definitivamente"`. `Autorizada` y
`Rechazado` ya existen y podrían cubrir el mismo significado funcional — ver
§Decisiones pendientes #3.

### El patrón de generación de documentos ya está probado tres veces

`autoCrearReporteBuro` (REQ existente), `autoCrearDocumentosComitePrepago` (REQ-9) y
`autoCrearDictamenRiesgo` (REQ-10) — los tres en
[generarDocumentosFase4.ts](../src/app/hooks/generarDocumentosFase4.ts) — siguen el
mismo molde: PDF (`jsPDF` + `autoTable`) → Supabase Storage → Expediente Electrónico →
persistencia inmediata en BD, idempotente (no duplica si ya existe). El "Oficio de
Autorización" de esta HU sigue el mismo molde, con una `CLAVE_OFICIO_AUTORIZACION_CIC`
nueva.

### Identidad de quien registra la resolución

A diferencia de REQ-11 (N votos individuales, cada uno anónimo), aquí el requerimiento
describe **una sola resolución** (un número de acta, una fecha, un estatus) — es un
registro único, no una votación con varios participantes. No hereda automáticamente el
patrón "Anónimo N" de REQ-11; es una decisión menor aparte (§Decisiones pendientes #4).

---

## Objetivo

Que, una vez emitidos los votos del CPC, quede un lugar donde consultar ese historial
sin repetir captura, registrar la resolución formal del CIC (acta, fecha, estatus) y
generar el oficio de autorización correspondiente — dejando explícitamente fuera,
mientras no se resuelva la infraestructura que le falta, cualquier bloqueo real de
capacidad institucional.

---

## Alcance

> Los Bloques "Resumen Ejecutivo", Registro Legal y Estatus son implementables sin
> depender de ninguna decisión pendiente. **Dónde vive el subtab (fase) y qué significa
> literalmente "Bloquear Cupo" en el botón SÍ dependen** — ver orden de ejecución.

### 1. Subtab "Resolución Final CIC" — NUEVO

**Id:** `resolucionCIC` · **Label:** `Resolución Final CIC`
**Visibilidad:** condicional a `esGPOForm` (bandera existente de REQ-9).
**Fase de anclaje:** pendiente de la decisión #1.

#### Resumen Ejecutivo (solo lectura)

Grid con los votos de `leerVotacionCPC(solicitudId).votos`: Votante, Decisión,
Comentarios, Folio (cadena de firma). Mismo componente visual que la tabla "Votos
Registrados" de `VotacionCPCTab` — no reinventar el estilo, reusar el patrón.

Encima del grid, mostrar el conteo de `conteoVotosCPC` ya calculado (Aprobar/Rechazar/
Devolver) — es información, no un veredicto: el CIC lo interpreta, el sistema no decide
por él.

#### Registro Legal

| Campo | Clave | Obligatorio |
|---|---|---|
| Número de Acta CIC | `numeroActaCIC` | Sí |
| Fecha de Sesión CIC | `fechaSesionCIC` | Sí |
| Estatus de la Solicitud | `estatusResolucionCIC` (`'Aprobada' \| 'Rechazada'`) | Sí |

### 2. Botón [Emitir Oficio de Autorización y Bloquear Cupo]

Dividir explícitamente en lo que el sistema SÍ hace y lo que NO, para que el botón no
prometa algo que no ocurre:

- **Emitir Oficio de Autorización** — implementable ya: genera el PDF con el resumen
  ejecutivo del CPC, los datos de registro legal y el estatus, lo adjunta al Expediente
  Electrónico, idempotente. Mismo mecanismo de REQ-9/REQ-10.
- **"Bloquear Cupo"** — mientras la decisión #2 no se resuelva, el oficio **deja
  constancia por escrito** del monto que debería reservarse (tomado del Monto Máximo
  Contingente / Fondo de Reserva ya capturados), pero el sistema **no ejecuta ningún
  bloqueo real** contra otras Solicitudes. Esto debe quedar dicho explícitamente en la
  UI (no silenciarlo) para no dar una falsa sensación de control.

### 3. Persistencia end-to-end

Clave de subtab `resolucionCIC`. Mismos cuatro extremos que REQ-9/10/11; agregar la
clave a `subtabKeys` en sus **dos** ocurrencias.

### 4. Validación

El botón sólo se habilita con los tres campos de Registro Legal capturados. Si el
estatus es "Rechazada", el Oficio se genera igual (deja constancia del rechazo
definitivo) — no es una vía de éxito exclusiva.

---

## Criterios de aceptación

1. **CA-01** — El subtab aparece sólo con producto GPO.
2. **CA-02** — El Resumen Ejecutivo muestra exactamente los votos ya registrados en
   REQ-11, incluyendo el folio de firma, sin captura adicional.
3. **CA-03** — Con cero votos CPC registrados, el Resumen Ejecutivo lo indica con
   claridad (no una tabla vacía sin explicación).
4. **CA-04** — El botón permanece deshabilitado hasta que Número de Acta, Fecha de
   Sesión y Estatus estén capturados.
5. **CA-05** — Al emitir, se genera un PDF con el resumen de votos, los datos de
   registro legal y el estatus, y queda adjunto al Expediente Electrónico.
6. **CA-06** — Reemitir sobre la misma Solicitud no duplica el documento (idempotencia).
7. **CA-07** — El oficio (PDF o UI) declara explícitamente que el bloqueo de cupo es
   informativo, no un control real, mientras la decisión #2 no se resuelva.
8. **CA-08** — Capturar los campos, cambiar de acordeón y volver: los valores siguen
   ahí.
9. **CA-09** — Guardar, recargar la app y reabrir: los valores siguen en base de datos.
10. **CA-10** — Abrir el subtab y navegar sin capturar nada no borra una resolución ya
    guardada.

---

## Decisiones pendientes (bloquean parte del alcance)

**1. Dónde vive este subtab.** Sin una fase "CIC" en el producto, opciones:
   - (a) Compartir la fase 3 "Dictamen del Comité de Prepago y Crédito" junto con
     REQ-11 (mismo `esFaseComitePrepago`, otro subtab más en la misma fase).
   - (b) Anclarlo a la fase 4 "Validación de Cláusulas Fiduciarias" — no encaja
     semánticamente, pero es la siguiente fase en el flujo.
   - (c) Dar de alta una fase nueva en la configuración del producto (cambio de datos,
     no de código, pero renumera las fases 4 y 5 actuales — afecta cualquier lógica que
     dependa de su `faseId` u orden).
   **Recomiendo (a)**: mantiene junta toda la "Dictaminación de Comités" (Etapa 6 del
   BPM) en una sola fase del sistema, sin tocar la configuración del producto.

**2. Qué hace realmente "Bloquear Cupo".** Sin la infraestructura de límites globales:
   - (a) Sólo constancia documental en el Oficio (lo que describe el Alcance §2) — cero
     cambio de comportamiento del sistema.
   - (b) Construir la infraestructura completa (tabla de límites, reserva atómica,
     liberación) — HU aparte, de mayor tamaño que todo REQ-9/10/11/12 juntos.
   - (c) Un punto intermedio: un registro simple de "cupo comprometido" por Solicitud,
     sin reserva atómica real ni consolidación contra un límite — mejora la
     trazabilidad pero no evita colisiones entre Solicitudes concurrentes.

**3. Reusar `Autorizada`/`Rechazado` o agregar valores nuevos al catálogo de estatus.**
   Si se reusan, "Aprobada por CIC" pierde matiz frente a otras formas de llegar a
   "Autorizada" en el sistema (¿se necesita saber que la aprobación vino
   específicamente del CIC?). Si se agregan valores nuevos, hay que revisar en qué otros
   lugares del código se filtra por estos estatus (ver Advertencias).

**4. Identidad de quien emite la resolución.** ¿Aplica el mismo patrón "Anónimo N" de
   REQ-11 (un campo de identidad autoasignado por navegador), o al ser un registro único
   (no una votación) basta con la firma del Oficio como constancia, sin campo de
   identidad separado?

---

## Fuera de alcance (y por qué)

| Tema | Motivo |
|---|---|
| Bloqueo real de capacidad institucional entre Solicitudes | Requiere infraestructura de límites globales que no existe (decisión #2) |
| Liberación automática del cupo si la operación se cae | Depende de que el bloqueo real exista primero |
| Alta de la fase "CIC" en la configuración del producto | Es una decisión de producto (afecta numeración de fases existentes), no de esta HU |
| Notificación a los miembros del CIC | No hay módulo de notificaciones definido (mismo punto que REQ-11) |
| Firma digital real del Oficio | Mismo bloqueante de REQ-11 §Decisión #2 — no hay infraestructura criptográfica |

---

## Advertencias

- **Un solo acordeón montado a la vez** — todo estado debe persistirse fuera de React.
- **`subtabKeys` está duplicado** — agregar la clave en las dos ocurrencias.
- **No implementar un "bloqueo" simulado que parezca funcionar sin serlo** — si la
  decisión #2 se resuelve como (a) (solo constancia), el botón y el oficio deben
  decirlo con todas sus letras. Un bloqueo falso es peor que no tener bloqueo: alguien
  podría confiar en él.
- Si se agregan valores nuevos al catálogo de estatus (decisión #3), **revisar todo
  lugar del código que filtra por `estatusSolicitud`** (p. ej. Originación excluye
  `'Pendiente'` de sus listados — ver bug ya corregido en el historial de este
  proyecto) para no repetir el mismo tipo de filtro roto.

---

## Orden de ejecución

0. **Resolver la decisión #1** (dónde vive el subtab) — condiciona el resto.
1. Crear el subtab con el Resumen Ejecutivo (reusando `leerVotacionCPC`/
   `conteoVotosCPC` de REQ-11 sin modificarlos) y los campos de Registro Legal, con la
   guarda de persistencia segura ya usada en REQ-9/10/11.
2. Registrar la sección con visibilidad `esGPOForm` y la fase resuelta en el paso 0.
3. Cerrar la persistencia: sesión → `subtabKeys` (×2) → `formToDBPayload` →
   `preloadSubtabsFromDBData`.
4. Implementar la generación del Oficio de Autorización (PDF idempotente), dejando el
   texto de "bloqueo de cupo" según la decisión #2 (por defecto, opción (a) si no hay
   resolución explícita).
5. Resolver la decisión #3 (catálogo de estatus) y conectar el dropdown.
6. Probar corriendo la app CA-08, CA-09 y CA-10 — son los que detectan pérdida de datos
   y no se ven en un typecheck.
