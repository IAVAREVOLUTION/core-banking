# HU — REQ-11: Votación Colegiada del Comité de Prepago y Crédito (CPC)

> **Origen:** BPM del producto *Garantía Financiera 2o Piso* — Etapa 6 (Dictaminación de
> Comités), **Actividad 6.1: "Evaluación y Dictamen del Comité de Prepago y Crédito
> (CPC)"**, capturado el 27/08/2026.
> Continúa a [REQ-9](REQ-9_Estructura_Operativa_2o_Piso_Originacion.md) (Admisión y
> Captura del Ecosistema) y [REQ-10](REQ-10_Analisis_Grado_Riesgo_Originacion.md)
> (Análisis de Grado de Riesgo).
> Traducido a alcance técnico contra el código real de
> **`src/app/components/solicitudes/`**.

---

## Requerimiento original (transcripción, para trazabilidad)

**Objetivo:** revisar la viabilidad de la estructura bursátil, validar el esquema de
cobro de comisiones y emitir la **primera aprobación colegiada** de la GPO.

**Descripción de negocio:** los miembros del CPC acceden a un espacio de toma de
decisiones donde evalúan el rendimiento del proyecto contra el riesgo que asumirá el
banco. **El Core debe asegurar el anonimato o control de firmas digitales** y capturar
el **voto individual** de cada participante para generar el acta correspondiente.

### Bloque A — Panel de Votación Colegiada

| Campo | Control |
|---|---|
| Decisión | Radio buttons: **Aprobar Operación** / **Rechazar Operación** / **Devolver a Riesgos para Ajustes** |
| `Comentarios_CPC` | Textarea obligatorio, **mínimo 100 caracteres** |
| `Firma_Digital_Token` | Input tipo password/PIN de seguridad para firmar el voto |

**Botón:** *[Registrar Voto en Plataforma]*

---

## Contexto técnico (verificado en código, NO re-investigar)

### BLOQUEANTE — el sistema no tiene identidad de usuario

Verificado en dos puntos:

- **`currentUser`** en
  [mockData.ts:1263-1267](../src/app/data/mockData.ts#L1263-L1267) es un objeto
  **fijo**: `{ name: 'Usuario Actual', organization: 'Querétaro', workPosition: 'Gerente
  de Productos' }`. No hay lista de usuarios, ni de miembros de comité, ni de roles.
- **`handleLogin`** en [App.tsx:201](../src/app/App.tsx#L201) es un **toggle booleano**
  — el login (admin/admin, ver captura de la sesión) no captura ninguna identidad. El
  sistema no sabe "quién" está usando la sesión.

> **Consecuencia directa:** *"capturar el voto individual de cada participante"* choca
> de frente con esto. Hoy no hay forma de saber quién es cada participante, ni de
> impedir que la misma persona vote dos veces, ni de mostrar un roster de miembros del
> CPC. Ver §Decisiones pendientes — es la pregunta que más condiciona el alcance.

### BLOQUEANTE — no existe infraestructura de firma digital ni PIN

Búsqueda exhaustiva en el repo (`PIN`, `firma digital`, `Firma_Digital`, `digitalToken`,
`token` de firma): **cero resultados** fuera de este requerimiento. No hay
criptografía, no hay validación de PIN contra nada, no hay concepto de firma en el
sistema.

### El requerimiento pide "anonimato **o** control de firmas" — son opuestos

Un voto anónimo (nadie sabe quién votó qué) y un voto firmado (queda trazado a la
persona) son mecanismos contrarios. El texto los presenta como alternativas
intercambiables, pero no lo son. **Hay que elegir uno**, no ambos — ver §Decisiones
pendientes.

### Ya existe un Comité "genérico" — no es esto

[`ComitesTab.tsx`](../src/app/components/shared/ComitesTab.tsx) (compartido
Solicitudes/Originación) gestiona un **registro por comité**: `autoridad`, `estatus`
(Pendiente/Autorizado/Rechazado), `fecha`, `observaciones`. Es una bitácora de
autorización de UNA sola decisión, no una votación con varios participantes. Este
requerimiento es un mecanismo **distinto y más granular**: N votos individuales que se
agregan en un resultado colegiado.

### COLISIÓN — el Acta ya se genera, pero sin votos reales

REQ-9 implementó `autoCrearDocumentosComitePrepago`
([generarDocumentosFase4.ts:2297](../src/app/hooks/generarDocumentosFase4.ts#L2297)),
que genera automáticamente, al **entrar** a la fase "Dictamen del Comité de Prepago y
Crédito", un documento llamado exactamente:

```
CLAVE_ACTA_COMITE = 'Acta de Sesión del Comité de Prepago y Crédito'
```

Ese documento es **sistémico**: no refleja ningún voto, solo resume los datos de la
Solicitud. Esta HU pide generar un acta que sí refleje decisiones reales de N
participantes. **Ambas comparten nombre.** Hay que decidir si la nueva sustituye a la
generada por REQ-9, si conviven con nombres distintos, o si la de REQ-9 se retira. Ver
§Decisiones pendientes.

### La fase ya existe — mismo patrón de REQ-9/REQ-10

Fase 3 del producto GPO: **"DICTAMEN DEL COMITÉ DE PREPAGO Y CRÉDITO"**, área JURÍDICO.
Detectable con la bandera `esGPOForm` que ya existe en
[SolicitudCreditoForm.tsx](../src/app/components/solicitudes/SolicitudCreditoForm.tsx)
(creada en REQ-9). Persistencia con los mismos cuatro extremos: sesión → `subtabKeys`
(dos ocurrencias) → `formToDBPayload` → `preloadSubtabsFromDBData`.

### "Bandeja" no es un patrón que exista en el sistema

El requerimiento llama a la pantalla "Bandeja / Votación de Miembro del CPC" — sugiere
que cada miembro entra a **su propia** bandeja y ve sólo lo pendiente de su voto. El
sistema no tiene bandejas por usuario: todo vive como acordeones dentro del formulario
de la Solicitud, visible para quien la abra. Sin sistema de usuarios (bloqueante de
arriba), tampoco hay forma de filtrar "lo que me toca votar a mí".

---

## Objetivo

Que el analista capture, dentro del mismo formulario de Solicitud, los votos que emite
cada miembro del CPC (decisión, comentario justificativo, y una marca de identidad
mínima), que el sistema calcule el resultado colegiado, y que ese resultado quede
reflejado en el Acta de Sesión — evitando que el proceso avance a la siguiente etapa sin
una decisión colegiada válida.

---

## Alcance

> El alcance de captura (Bloque A, lista de votos, resultado) es implementable sin
> depender de las decisiones pendientes. **El botón [Registrar Voto en Plataforma], la
> generación del Acta con votos reales, y el bloqueo de avance de fase SÍ dependen** de
> cómo se resuelvan — ver orden de ejecución.

### 1. Subtab "Votación del Comité de Prepago y Crédito" — NUEVO

**Id:** `votacionCPC` · **Label:** `Votación CPC`
**Visibilidad:** condicional a `esGPOForm` (bandera existente).
**Posición sugerida:** después de `modeloViabilidad` — sigue el orden del BPM.

#### Bloque A — panel de votación

| Campo | Clave | Obligatorio |
|---|---|---|
| Decisión | `decision` (`'Aprobar' \| 'Rechazar' \| 'Devolver'`) | Sí |
| Comentarios CPC | `comentarios` | Sí, mínimo 100 caracteres, con contador visible |
| Identificación del votante | `votante` — ver §Decisiones pendientes #1 | Sí |
| Firma/PIN | `firmaToken` — ver §Decisiones pendientes #2 | Según lo que se decida |

#### Lista de votos registrados

Tabla con cada voto ya emitido: votante, decisión, fecha/hora, extracto del comentario.
Un votante no puede registrar dos votos sobre la misma Solicitud (validar por el campo
de identidad que se elija).

#### Resultado colegiado (calculado, solo lectura)

- Conteo por decisión (N Aprobar / N Rechazar / N Devolver).
- Veredicto agregado — regla de mayoría a definir, ver §Decisiones pendientes #4.

### 2. Botón [Registrar Voto en Plataforma]

Agrega el voto a la lista, valida los obligatorios, y limpia el panel para el siguiente
votante.

### 3. Generación del Acta con votos reales

Al alcanzar la condición de cierre (ver §Decisiones pendientes #4), generar/actualizar
el documento del Acta con el detalle de los votos — mismo mecanismo PDF → Storage →
Expediente → BD ya usado en `autoCrearDictamenRiesgo` (REQ-10) y
`autoCrearDocumentosComitePrepago` (REQ-9).

### 4. Persistencia end-to-end

Clave de subtab `votacionCPC`. Mismos cuatro extremos que REQ-9/REQ-10; agregar la clave
a `subtabKeys` en sus **dos** ocurrencias.

### 5. Bloqueo de avance de fase

Al salir de la fase "Dictamen del Comité de Prepago y Crédito", bloquear si no hay
resultado colegiado válido — mismo patrón de aviso nombrando lo que falta.

---

## Criterios de aceptación

1. **CA-01** — El subtab aparece sólo con producto GPO.
2. **CA-02** — El panel de votación muestra las tres opciones de decisión, comentarios y
   el campo de identidad/firma que se decida.
3. **CA-03** — Comentarios con menos de 100 caracteres bloquea el registro del voto; el
   contador lo indica.
4. **CA-04** — [Registrar Voto] agrega el voto a la lista con fecha/hora.
5. **CA-05** — Un mismo votante no puede registrar dos votos sobre la misma Solicitud.
6. **CA-06** — El resultado colegiado se recalcula al agregar cada voto.
7. **CA-07** — Capturar un voto, cambiar de acordeón y volver: la lista de votos sigue
   ahí.
8. **CA-08** — Guardar, recargar la app y reabrir: los votos siguen en base de datos.
9. **CA-09** — Abrir el subtab y navegar sin votar no borra los votos ya registrados.
10. **CA-10** — Con resultado colegiado incompleto, el avance de fase se bloquea
    nombrando qué falta.
11. **CA-11** — El Acta generada refleja los votos reales capturados (no el placeholder
    genérico de REQ-9).

---

## Decisiones pendientes (bloquean parte del alcance)

**1. Identidad del votante.** Sin sistema de usuarios, ¿cómo se identifica a cada
miembro? Opciones, de menor a mayor esfuerzo:
   - (a) Campo de texto libre "Nombre del votante" capturado en cada voto — sin
     autenticación, cualquiera puede escribir cualquier nombre.
   - (b) Un catálogo simple y configurable de "Miembros del CPC" (nombre + cargo), sin
     login — el usuario elige de una lista en vez de escribir libremente.
   - (c) Esperar a que exista un sistema real de usuarios/roles — HU aparte, de mayor
     alcance que todo lo demás junto.
   **Recomiendo (b)** como punto intermedio: no requiere autenticación nueva, pero evita
   nombres inconsistentes o inventados.

**2. Qué hace el campo `Firma_Digital_Token`.** Sin infraestructura criptográfica:
   - (a) Campo simbólico: se captura como texto y se guarda junto al voto, sin validar
     nada. Es un candado de intención, no de seguridad.
   - (b) Se valida contra un PIN fijo definido por miembro (en el catálogo de la opción
     1b) — funcional pero no es seguridad real; un PIN en texto plano en el JSONB.
   - (c) Diferir el campo hasta tener autenticación real.
   **Esta decisión depende de la 1** — sin identidad de miembro, "firmar" no tiene a
   quién atribuirse.

**3. Anonimato vs. firma — cuál de los dos.** El requerimiento los da como
alternativas. Si es anonimato, el campo de identidad (decisión 1) no debería
mostrarse en el Acta aunque se capture internamente. Si es firma, el Acta debe listar
quién votó qué. **Son excluyentes: no se puede tener ambos sobre el mismo voto.**

**4. Regla de decisión del CPC.** No está en el requerimiento. ¿Mayoría simple, unanimidad,
un número mínimo de votos (quórum)? ¿Cómo se resuelve un empate? Sin esto no se puede
calcular el "resultado colegiado" ni saber cuándo el Acta puede cerrarse ni cuándo se
bloquea el avance de fase (CA-10).

**5. Relación con el Acta que ya genera REQ-9.** ¿La nueva Acta (con votos reales)
reemplaza al documento `CLAVE_ACTA_COMITE` que se genera automáticamente al entrar a la
fase, conviven como dos documentos con nombres distintos, o se retira la generación
automática de REQ-9 y sólo queda esta?

---

## Fuera de alcance (y por qué)

| Tema | Motivo |
|---|---|
| Autenticación real de usuarios | El sistema entero no la tiene; es una HU de infraestructura, no de este flujo |
| Firma digital criptográfica | No hay PKI ni validación real posible sin la anterior |
| Anonimato técnicamente garantizado | Requiere separar "quién votó" de "qué votó" a nivel de almacenamiento; no es sólo ocultar un campo en la UI |
| Bandeja por usuario logueado | Depende de autenticación real (arriba) |
| Comité Interno de Crédito (CIC) | El requerimiento lo menciona como el siguiente paso de la Etapa 6, pero no lo especifica — HU aparte cuando llegue su propio detalle |
| Notificaciones a los miembros del CPC | No hay módulo de notificaciones definido |

---

## Advertencias

- **Un solo acordeón montado a la vez** — todo estado debe persistirse fuera de React
  (mismo patrón que REQ-9/REQ-10).
- **`subtabKeys` está duplicado** — agregar la clave en las dos ocurrencias.
- **No inventar la regla de mayoría ni el mecanismo de identidad** sin antes resolver
  las decisiones pendientes: son la diferencia entre un panel de captura y un
  formulario que dice validar algo que en realidad no valida.
- Si se opta por 1(b) (catálogo de miembros), **no crear otro catálogo más**: revisar
  primero si conviene extender `TIPOS_RELACION` o el módulo de Personas, siguiendo el
  mismo criterio que ya se usó para Fiduciario/Beneficiario Legal (REQ-9).

---

## Orden de ejecución

0. **Resolver las decisiones pendientes 1 a 5** con el área de negocio/Riesgos — son
   las que determinan si esto es un panel de captura simple o algo con controles reales.
1. Crear el subtab con el Bloque A, la lista de votos y el resultado colegiado
   (implementable con cualquier resultado de la decisión 1, usando texto libre como
   piso mínimo).
2. Registrar la sección con visibilidad `esGPOForm` y su rama de render.
3. Cerrar la persistencia: sesión → `subtabKeys` (×2) → `formToDBPayload` →
   `preloadSubtabsFromDBData`.
4. Una vez resuelta la decisión 4 (regla de decisión), implementar el cálculo del
   resultado colegiado y el bloqueo de avance de fase.
5. Una vez resuelta la decisión 5, ajustar la generación del Acta (reemplazar, agregar,
   o retirar la de REQ-9).
6. Probar corriendo la app CA-07, CA-08 y CA-09 — son los que detectan pérdida de datos
   y no se ven en un typecheck.
