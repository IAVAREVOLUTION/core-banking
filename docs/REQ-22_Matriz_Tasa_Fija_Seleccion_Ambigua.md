# HU — REQ-22: La Matriz de Tasa Fija marca dos filas como seleccionadas

> **Origen:** defecto reportado el 01/09/2026 en Solicitud / Originación, sobre el
> producto *Crédito Simple 2° Piso*.
> **Síntoma:** con dos filas de matriz que comparten el plazo, ambas aparecen con
> la palomita y el botón **“Seleccionada”**.
> Diagnosticado contra el código real y contra la configuración real del producto
> en Supabase.

---

## Requerimiento original (transcripción, para trazabilidad)

> **Solicitud/Originación** — Revisar porque se selecciona las dos matrices
> cuando el plazo en ambas es el mismo.

---

## Estado de implementación (01/09/2026)

**Código — hecho.** `npm run build` (vite): compila sin errores nuevos. Un solo
archivo, [SolicitudCreditoForm.tsx](../src/app/components/solicitudes/SolicitudCreditoForm.tsx),
que cubre Solicitudes **y** Originación.

| Entregable | CA |
|---|---|
| `id` en el tipo `FilaMatriz` | CA-03 |
| `mismaFilaMatriz()` — identidad por `id`, o por el conjunto que distingue | CA-03, CA-05 |
| `esSeleccionada` usa la identidad real | CA-01, CA-02, CA-04 |
| Desempate en cascada (monto → frecuencia → tasa) en la derivación automática | CA-06…CA-08 |
| Aviso con el detalle del empate en vez de elegir por posición | CA-09, CA-10 |
| Banda informativa en el modal cuando hay filas con el mismo plazo | CA-12…CA-14 |

**Verificado contra la matriz real del producto** (14 aserciones, 0 fallas):

- el síntoma queda cerrado: con Trimestral elegida, **una sola** fila queda marcada (antes, 2);
- sin frecuencia ni tasa, la derivación **no elige**: avisa y deja decidir (CA-09);
- con frecuencia capturada resuelve al instante, en cualquiera de las dos direcciones;
- una tasa de 7.0% ó 7.5% resuelve a Trimestral, porque sólo cabe en su rango;
- una tasa de **8.5% sigue siendo ambigua** —cae en Mensual 8–9 *y* en Trimestral 7–9— y el sistema lo reporta en vez de inventar un ganador;
- se conservan los respaldos previos: monto fuera de rango cae al criterio de sólo plazo, y un plazo inexistente no selecciona nada;
- la identidad sin `id` distingue correctamente por frecuencia y tasa (productos anteriores).

**Sin verificar contra Supabase:** el comportamiento en pantalla con una Solicitud
real de *Crédito Simple 2° Piso*.

---

## Diagnóstico

### La configuración es legítima, no un error de captura

*Crédito Simple 2° Piso* tiene dos filas que **sólo** se distinguen por la
frecuencia y la tasa (verificado en `J_PRODUCTOS.data.matrizTasaFija`):

| id | Plazo | Frecuencia | Monto mín – máx | Tasa mín | Tasa máx | Tasa default |
|---|---|---|---|---|---|---|
| 1 | 1 – 1 | **Mensual** | $1,000,000 – $400,000,000 | **8.00%** | 9.00% | 8.00% |
| 2 | 1 – 1 | **Trimestral** | $1,000,000 – $400,000,000 | **7.00%** | 9.00% | 8.00% |

Mismo plazo y mismo rango de monto con distinta periodicidad de pago y distinta
tasa es un armado normal de producto. **El sistema es el que no sabe distinguirlas.**

### Causa raíz — la fila se identifica sólo por el plazo

[SolicitudCreditoForm.tsx:4558-4560](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L4558-L4560):

```ts
const esSeleccionada = !!filaMatrizSeleccionada
  && filaMatrizSeleccionada.plazoMinimo === f.plazoMinimo
  && filaMatrizSeleccionada.plazoMaximo === f.plazoMaximo;
```

El predicado ignora la frecuencia, el monto y la tasa. Con dos filas `1 – 1`,
**las dos** lo cumplen, así que las dos se pintan como seleccionadas.

### El defecto de fondo es peor que el síntoma visual

El mismo criterio incompleto está en la **auto-derivación** de la fila
([:533-535](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L533-L535)):

```ts
const fila =
  matrizTasaFijaProducto.find(f => porPlazo(f) && enRango(montoNum, f.montoMinimo, f.montoMaximo))
  ?? matrizTasaFijaProducto.find(porPlazo);
```

Cuando dos filas empatan en plazo **y** en rango de monto —que es exactamente
este caso—, `.find()` devuelve **siempre la primera** del arreglo, en silencio.

Consecuencia real: una Solicitud de este producto queda amarrada a la fila
**Mensual al 8%** por el orden del arreglo, y la opción **Trimestral al 7%** es
inalcanzable por esa vía. No es un problema de pintado: es la tasa y la
periodicidad con las que se cotiza y se contrata.

### Alcance del defecto

`FilaMatriz`
([:479-484](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L479-L484))
no incluye `id`, aunque **las filas reales sí lo traen** (`id: 1`, `id: 2`). La
identidad estaba disponible y no se usaba.

Afecta a **Solicitudes y a Originación con un solo origen**: Originación monta
`SolicitudBaseForm` ([OriginacionModule.tsx:51](../src/app/components/originacion/OriginacionModule.tsx#L51)),
que delega en el mismo `SolicitudCreditoForm`. Un arreglo cubre los dos módulos.

Productos afectados hoy: cualquiera con filas que empaten en plazo. Además del
2º Piso, *Crédito Personal* tiene dos filas `Mensual` con rangos de monto
distintos — ahí el filtro por monto alcanza a desempatar, así que el síntoma no
se ve, pero el criterio sigue siendo incompleto.

---

## Historias de usuario

### HU-22.1 — Sólo la fila elegida aparece como seleccionada

> **Como** analista de crédito
> **quiero** ver marcada únicamente la fila de matriz que elegí
> **para** saber con qué tasa y frecuencia va la solicitud.

| CA | Criterio de aceptación |
|---|---|
| CA-01 | Al seleccionar una fila, **exactamente una** queda con la palomita y el botón “Seleccionada”. |
| CA-02 | Las demás conservan su botón “Seleccionar”, aunque compartan el plazo. |
| CA-03 | La identidad de la fila usa su `id` cuando existe; si no, el conjunto completo de atributos que la distinguen (plazo, frecuencia, rango de monto y tasa). |
| CA-04 | Cambiar de fila mueve la marca: nunca quedan dos marcadas ni cero. |
| CA-05 | Al reabrir la Solicitud, la fila marcada sigue siendo la misma que se eligió. |

### HU-22.2 — La derivación automática no elige por orden de arreglo

> **Como** analista de crédito
> **quiero** que el sistema no amarre una tasa por su posición en la lista
> **para** no contratar al 8% cuando correspondía el 7%.

| CA | Criterio de aceptación |
|---|---|
| CA-06 | Si hay una sola fila que corresponde al plazo y al monto, se aplica automáticamente (comportamiento actual). |
| CA-07 | Si hay varias, se desempata con la **frecuencia** ya capturada en la Solicitud. |
| CA-08 | Si sigue habiendo varias, se desempata con la **tasa** ya capturada — es el caso de una Solicitud que se reabre y cuya tasa ya está guardada. |
| CA-09 | Si aun así el empate persiste, **no se elige en silencio**: se avisa al usuario que hay varias filas aplicables y que debe confirmar cuál. |
| CA-10 | El aviso dice **cuántas** filas empatan y en qué se diferencian (frecuencia y tasa), no un mensaje genérico. |
| CA-11 | La selección manual del usuario **siempre** gana sobre la derivación automática (comportamiento actual: una vez elegida, no se reasigna sola). |

### HU-22.3 — El modal advierte cuando hay filas equivalentes

| CA | Criterio de aceptación |
|---|---|
| CA-12 | Cuando dos o más filas comparten plazo, el modal lo indica y señala que la diferencia está en la frecuencia y la tasa. |
| CA-13 | La columna **FRECUENCIA** permite distinguirlas a simple vista (ya existe). |
| CA-14 | El aviso no bloquea: es informativo y desaparece si el producto no tiene ambigüedad. |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | Una fila de la Matriz se identifica por **plazo + frecuencia + rango de monto + tasa**, no sólo por el plazo. Dos filas con el mismo plazo y distinta frecuencia son ofertas distintas. |
| RN-02 | El orden del arreglo **no** es un criterio de negocio. Nada debe depender de qué fila se capturó primero. |
| RN-03 | Ante un empate que el sistema no puede resolver, decide el usuario. Elegir en silencio es peor que preguntar, porque el error queda en la tasa contratada. |
| RN-04 | La elección manual no se revierte automáticamente (se conserva el comportamiento actual de REQ previos). |

---

## Solución

### 1. Identidad real de la fila

Función de comparación única, usada por el pintado y por la derivación:

- Si ambas filas traen `id`, se comparan por `id`.
- Si no, se comparan `plazoMinimo`, `plazoMaximo`, `periodo`, `montoMinimo`,
  `montoMaximo` y `tasaMinima`.

Se agrega `id` al tipo `FilaMatriz`, que ya viajaba en los datos y sólo estaba
ausente en la declaración.

### 2. Desempate en cascada de la derivación automática

1. Filas que cumplen plazo **y** rango de monto.
2. De ésas, las que coinciden con la **frecuencia** capturada.
3. De ésas, las que coinciden con la **tasa** capturada.
4. Si queda exactamente una → se aplica.
5. Si quedan varias → **no se aplica ninguna** y se avisa al usuario, indicando
   cuántas son y en qué difieren.

El respaldo actual (buscar sólo por plazo cuando ninguna cuadra con el monto) se
conserva, para no dejar sin matriz a una Solicitud cuyo monto se salió de rango.

### 3. Aviso en el modal

Banda informativa cuando el producto tiene filas que comparten plazo, para que el
usuario sepa que la columna FRECUENCIA es la que decide.

---

## Alcance

**Dentro:** identidad de la fila, desempate de la derivación, avisos en el modal.
Cubre Solicitudes y Originación por venir del mismo componente.

**Fuera:**
- Impedir en el **producto** que se capturen filas ambiguas: aquí son legítimas
  (misma oferta con distinta periodicidad), así que validarlo sería incorrecto.
- Recalcular Solicitudes ya contratadas que hayan quedado amarradas a la primera
  fila. Ver §Riesgo.

---

## ⚠️ Riesgo — solicitudes ya capturadas

Cualquier Solicitud de un producto con filas empatadas que se haya apoyado en la
derivación automática quedó con la **primera** fila del arreglo. Para *Crédito
Simple 2° Piso* eso significa **Mensual al 8%**, aunque correspondiera Trimestral
al 7%.

El arreglo corrige de aquí en adelante; **no** reescribe lo ya capturado. Conviene
revisar las Solicitudes vivas de ese producto antes de formalizarlas. No se
propone corrección automática: cuál era la intención real de cada una es una
decisión de negocio, no algo deducible del dato.

---

## Plan de implementación

| # | Paso | Archivo |
|---|---|---|
| 1 | `id` en el tipo `FilaMatriz` | [SolicitudCreditoForm.tsx:479](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L479) |
| 2 | Helper de identidad + detección de empates | mismo |
| 3 | `esSeleccionada` usa el helper | [:4558](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L4558) |
| 4 | Desempate en cascada en la derivación automática | [:519](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L519) |
| 5 | Aviso en el modal cuando hay filas equivalentes | [:4620](../src/app/components/solicitudes/SolicitudCreditoForm.tsx#L4620) |
| 6 | Verificar con la matriz real del producto | — |

---

## Trazabilidad

| Requerimiento | HU / CA |
|---|---|
| "Se selecciona las dos matrices cuando el plazo es el mismo" | HU-22.1 · CA-01…CA-05 |
| Causa raíz encontrada al diagnosticar | HU-22.2 · CA-06…CA-11 |
| Riesgo no planteado en el reporte | §Riesgo (tasa amarrada por orden de arreglo) |
