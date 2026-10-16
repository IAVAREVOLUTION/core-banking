# HU — REQ-26: Prewrite de Movimientos TDC — Cargos Permitidos, Promociones y Afectación de la Línea

> **Origen:** especificación funcional capturada el 14/09/2026 sobre el producto
> *Tarjeta de Crédito* de Línea de Crédito. Encadena tres subtabs ya construidos
> del Taller de Producto — **Cargos Permitidos**, **Prom Comis e Impue** y
> **Afectación de la línea** — con la creación de un Movimiento de la Línea.
> Contexto técnico verificado contra el código y contra el catálogo real en
> Supabase; los vacíos están marcados como tales, no supuestos.

---

## Requerimiento original (transcripción, para trazabilidad)

### ESPECIFICACIÓN 1 — validación en el prewrite

> Cada vez que se vaya a crear un registro en la entidad de Movimiento de la Línea
> de Crédito con el producto **"010 Tarjeta de Crédito"**, en el evento *prewrite*
> de dicha entidad:
>
> 1. Validar que la clave de movimiento exista en la subpestaña **"Cargos
>    Permitidos"**, buscando en el módulo *Taller de Producto* con la llave
>    "Clave del producto".
>    - **1.1** Si existe → ejecutar ESPECIFICACIÓN 2, de forma **asíncrona y
>      transaccional**: si falla alguna operación se hace *rollback* de toda la
>      transacción.
>    - **1.2** Si no existe → cancelar la creación del registro y devolver el
>      error *"La Clave del Movimiento XXX no está configurada en el Producto
>      «010 Tarjeta de Crédito», en la sección de Cargos Permitidos"*. La clave
>      de producto se obtiene de la Línea de Crédito en ejecución.

### ESPECIFICACIÓN 2 — promociones, comisiones, impuestos y afectación

> **Objetivo:** identificar si el cargo evaluado tiene configuración en
> *Promociones Comisiones e Impuestos* y después ejecutar *Afectación de Línea*.
>
> **1.** Buscar en **"Prom Comis e Impue"** la clave del cargo que se evalúa.
>
> **1.1** Si se encuentra, ejecutar el bloque pasando *Clave*, *Descripción*,
> *Monto* y *Fecha Movimiento*:
>
> - **1.1.1 Determinación de Comisiones** — evaluar *Comisión Fija*, *%Com* y
>   *%IVAC* parseando antes del carácter `|` (ej. `250.00|021  5%|021  16%|022`).
>   Si *Comisión Fija* o *%Com* > 0:
>   `monto de comisión = Max(Comisión Fija, Monto Movimiento × %Com)`;
>   la clave del concepto es lo que viene después del `|`;
>   `Monto IVA Comisión = monto de comisión × %IVAC`, con su propia clave.
>   Ejecutar el punto 2 con ambas claves, ambos montos y la fecha del movimiento
>   original.
> - **1.1.2 Determinación de Cash Back** — evaluar *%CBack* (ej. `10%|900`).
>   Si *%CBack* > 0: `Monto Cash Back = Monto Movimiento × %CBack`, con la clave
>   tras el `|`. Ejecutar el punto 2 y, además, **crear un movimiento en la
>   Cuenta Eje del cliente** (obtenida del *Id del Cliente* de la Línea de
>   Crédito), que afecta el saldo según la naturaleza: *Abono* aumenta,
>   *Cargo* disminuye.
> - **1.1.3 Determinación de MCI / MSI** — evaluar *Plazo*, *%IntAnl*, *%IvaInt*.
>   Si *Plazo* > 0: si *%IntAnl* o *%IvaInt* > 0 → **MCI**, si no → **MSI**.
>   Con *Monto Movimiento*, *Plazo*, *%IntAnl* y *%IvaInt* determinar el
>   calendario de pagos y armar un arreglo de objetos con
>   (clave de *Plazo*, Monto Capital, Fecha), (clave de *%IntAnl*, Monto Interés,
>   Fecha) y (clave de *%IvaInt*, Monto IVA Interés, Fecha). En MSI sólo el
>   renglón de capital. Con ese arreglo ejecutar el punto 2.
>
> Al terminar el bloque, ejecutar el punto 2 con *clave*, *monto de movimiento* y
> *fecha movimiento*.
>
> **1.2** Si no se encuentra la clave, ejecutar directamente el punto 2 con
> *clave movimiento*, *monto de movimiento* y *fecha movimiento*.
>
> **2.** Recibe (*Clave*, *monto*, *fecha*). Busca la clave en **"Afectación de la
> línea"**. Si la encuentra, obtiene *Clave*, *Nombre*, *bFactura*, *Naturaleza* y
> *Consume línea disponible*, y ejecuta el punto 3. Si no, manda mensaje de que
> el cargo XX no está configurado.
>
> **3.** Recibe (*Clave*, *Nombre*, *monto*, *fecha*, *bFactura*, *bCargo*,
> *Naturaleza*, *Consume línea disponible*).
> Si *Consume línea disponible* == `S`/`Y` →
> `Saldo Disponible = Saldo Disponible − monto`.
> Si *bCargo* == `S`/`Y` → registrar en la subpestaña **"Cargos"** de la Línea de
> Crédito un registro con *Clave*, *Nombre*, *Naturaleza*, *monto*, *fecha* y
> *bFactura*. Es importante determinar el Id de la Línea de Crédito, ya sea que
> el movimiento venga de la interfaz gráfica o de un API del Core.
>
> **NOTA:** la ejecución debe ser transaccional; ante cualquier fallo se hace
> rollback dejando la información consistente.

---

## Contexto técnico verificado (14/09/2026) — no re-investigar

### Lo que YA existe y esta HU consume

| Pieza | Dónde | Notas verificadas |
|---|---|---|
| Subtab **Cargos Permitidos** | [CargoTab.tsx](../src/app/components/productos/tabs/CargoTab.tsx) vía [ProductoLineaCreditoForm.tsx](../src/app/components/productos-linea-credito/ProductoLineaCreditoForm.tsx) | Campos por renglón: `tipoCargo`, `descripcion`, `moneda`, `momento`. `tipoCargo` sale del Catálogo de Componentes. Se guarda en `J_PRODUCTOS.data.cargo`. |
| Subtab **Prom Comis e Impue** | [PromComisImpuestosTab.tsx](../src/app/components/productos-linea-credito/PromComisImpuestosTab.tsx) | Nodo `data.promComisImpuestos`. |
| Subtab **Afectación de la línea** | [AfectacionLineaTab.tsx](../src/app/components/productos-linea-credito/AfectacionLineaTab.tsx) | Nodo `data.afectacionLinea`. Campos: `naturaleza`, `consumeLineaDisponible`, `bFactura`, `bCargo`, `liberaLineaAlPagar`. |
| **Catálogo de Componentes** | `EFINANCIANET_DB.J_CATALOGO_COMPONENTES` vía endpoint `componentes-contables`; hook [useComponentesContablesCatalogo.ts](../src/app/hooks/useComponentesContablesCatalogo.ts) | 28 filas hoy. Los **códigos son únicos**; los nombres **no** (002 y 013 son ambos "Disposición de efectivo"). Por eso la identidad de un renglón es el **código**, nunca el nombre. |
| **Cuenta Eje** del cliente | [useCuentaEjeGenerator.ts](../src/app/hooks/useCuentaEjeGenerator.ts) + [Movimientos.tsx](../src/app/components/clientes/Movimientos.tsx) | El componente ya recibe `saldoCuentaEje` y notifica `onSaldoChange`; los movimientos se leen y escriben contra el edge function. Es el destino del Cash Back de §1.1.2. |
| **Cargos** de la Línea/Crédito | [CreditosModule.tsx](../src/app/components/creditos/CreditosModule.tsx) (`{ id: 'cargos', label: 'Cargos' }`) | Es la subpestaña destino del punto 3. |
| Precedente de **operación atómica** en BD | [create_rpc_bloqueo_cupo_gpo.sql](../supabase/migrations/create_rpc_bloqueo_cupo_gpo.sql) | RPC de Postgres que resta y valida saldo en una sola sentencia, con bloqueo de fila. Es el patrón a replicar para la transaccionalidad de esta HU. |

### Diferencia importante con la especificación: el `|` ya viene parseado

La especificación pide *"parsear antes del carácter `|`"* en todos los campos de
*Prom Comis e Impue*. En esta implementación **ese parseo no hace falta**: el
subtab guarda cada valor como un objeto `{ valor, clave }`
(tipo `ValorConClave` en [productoLineaCredito.ts](../src/app/types/productoLineaCredito.ts)),
donde `clave` es el código del Catálogo de Componentes. El `250.00|021` es sólo
la representación de lectura.

El motor **debe aceptar ambas formas** — objeto y string con pipe — porque los
datos cargados antes de este subtab, o los que entren por API, pueden venir
planos. El helper `leerVC()` del subtab ya implementa esa tolerancia y debe
moverse a un módulo compartido.

### Lo que NO existe todavía — precondiciones de esta HU

| Vacío | Impacto |
|---|---|
| **La entidad "Movimientos de la Línea de Crédito" no existe.** Hay `Movimientos` de la Cuenta Eje del cliente y `PagosTab`/`AportacionesModule` en Cartera, pero ninguna subpestaña de movimientos colgada de una Línea de Crédito. | Sin ella no hay *prewrite* que interceptar. Es **HU-26.0**: sin esa entidad, el resto no es implementable. |
| **No hay evento `prewrite`** en la arquitectura actual. Las escrituras van del cliente al edge function `make-server-7e2d13d9`, con deep merge por registro. | El "prewrite" debe materializarse como validación **del lado servidor**, en el endpoint que crea el movimiento — no en el componente React, o el API del Core se saltaría la validación. |
| **No hay transacción multi-entidad.** Hoy cada entidad se escribe con su propio PUT/POST; un fallo a mitad deja datos parciales. | La ESPECIFICACIÓN 2 escribe hasta en 4 lugares (movimiento, saldo de la línea, cargos de la línea, cuenta eje). Cumplir el rollback exige **un RPC de Postgres** que haga todo en una transacción, como el precedente de `reservar_cupo_gpo`. |
| **La clave de producto "010"** no corresponde a las claves actuales. El producto real es `LC-000003 — TDC Clásica`, con *Tipo de Producto* = "Tarjeta de Crédito". | Hay que definir de dónde sale el "010": ¿`claveProducto`, un catálogo nuevo de tipos de producto, o el `subTipo`? Ver §Decisión 2. |
| **Los conceptos del ejemplo no están en el catálogo.** Existen `001 Compra` y `002 Disposición de efectivo`; faltan `100 MSI_6`, `110 MSI_9`, `120 MCI_3` y las claves contables `021, 022, 030, 031, 101, 111, 121, 900`. | Sin darlos de alta en *Configuración → Componentes Contables*, la configuración del ejemplo no se puede capturar. |

---

## Historias de usuario

### HU-26.0 — Entidad Movimientos de la Línea de Crédito

> **Como** operador del Core,
> **quiero** registrar movimientos sobre una Línea de Crédito,
> **para** que compras, disposiciones y promociones queden asentadas contra la línea.

| # | Criterio de aceptación |
|---|---|
| CA-01 | La Línea de Crédito tiene una subpestaña **Movimientos** con alta de registro. |
| CA-02 | Un movimiento captura al menos: **clave de movimiento**, descripción, **monto**, **fecha de movimiento** y naturaleza. |
| CA-03 | El alta puede dispararse desde la interfaz gráfica **o** desde un API expuesto por el Core; ambas rutas pasan por la misma validación del servidor. |
| CA-04 | El movimiento guarda el **Id de la Línea de Crédito** a la que pertenece, resuelto por la ruta que lo originó. |

### HU-26.1 — El prewrite rechaza claves no configuradas (ESPEC 1)

> **Como** responsable del producto,
> **quiero** que sólo se registren movimientos cuya clave esté autorizada en el producto,
> **para** que no entre a la línea ningún concepto que el producto no contempla.

| # | Criterio de aceptación |
|---|---|
| CA-05 | Antes de persistir el movimiento, el sistema busca su clave en **Cargos Permitidos** del producto de la Línea de Crédito en ejecución. |
| CA-06 | La búsqueda usa la **clave del producto** tomada de la propia Línea, nunca un producto fijo en código. |
| CA-07 | Si la clave **existe**, continúa con ESPECIFICACIÓN 2 (HU-26.2 en adelante). |
| CA-08 | Si **no existe**, la creación se cancela — no queda registro parcial — y se devuelve: *"La Clave del Movimiento «XXX» no está configurada en el Producto «NNN Nombre», en la sección de Cargos Permitidos"*, con la clave real del movimiento y del producto. |
| CA-09 | La validación corre **en el servidor**, así que el API del Core recibe el mismo rechazo que la pantalla. |
| CA-10 | La validación sólo aplica a productos de tipo Tarjeta de Crédito (§Decisión 2); otros productos de Línea de Crédito conservan su comportamiento. |

### HU-26.2 — Comisiones e IVA de comisión (ESPEC 2 §1.1.1)

> **Como** área de ingresos,
> **quiero** que cada movimiento genere su comisión y su IVA según la promoción configurada,
> **para** cobrar lo pactado sin captura manual.

| # | Criterio de aceptación |
|---|---|
| CA-11 | Se busca la clave del movimiento en **Prom Comis e Impue**. Si no está, se salta al punto 2 con la clave, monto y fecha originales (§1.2) — **no** es un error. |
| CA-12 | Si *Comisión Fija* > 0 **o** *%Com* > 0, se calcula `comisión = Max(Comisión Fija, Monto × %Com)` (RN-02). |
| CA-13 | La comisión se imputa a la **clave contable** asociada a ese campo, no a la clave del movimiento. |
| CA-14 | `IVA Comisión = comisión × %IVAC`, imputado a la clave contable de *%IVAC*. |
| CA-15 | Comisión e IVA se envían al punto 2 (HU-26.5) como dos ejecuciones independientes, con la **fecha del movimiento original**. |
| CA-16 | Si ambos porcentajes y la comisión fija son 0, no se genera comisión ni IVA — no se crean renglones en cero. |

### HU-26.3 — Cash Back y movimiento en Cuenta Eje (§1.1.2)

> **Como** cliente tarjetahabiente,
> **quiero** que el cash back configurado se abone en mi cuenta eje,
> **para** recibir la bonificación del producto.

| # | Criterio de aceptación |
|---|---|
| CA-17 | Si *%CBack* > 0, `Cash Back = Monto Movimiento × %CBack`, imputado a la clave contable de *%CBack*. |
| CA-18 | El Cash Back ejecuta el punto 2 (afectación de la línea) **y además** crea un movimiento en la **Cuenta Eje** del cliente. |
| CA-19 | La Cuenta Eje se resuelve por el **Id del Cliente** de la Línea de Crédito en curso. |
| CA-20 | El movimiento en Cuenta Eje afecta el saldo por su naturaleza: **Abono aumenta**, **Cargo disminuye** (RN-04). |
| CA-21 | Si el cliente no tiene Cuenta Eje, la operación **falla completa** y se hace rollback (RN-08) — no se abona “a la nada”. |

### HU-26.4 — MSI / MCI y calendario de pagos (§1.1.3)

> **Como** área de producto,
> **quiero** que una compra a meses genere su calendario,
> **para** diferir capital, intereses e IVA según la promoción.

| # | Criterio de aceptación |
|---|---|
| CA-22 | Si *Plazo* > 0 se arma calendario; si *Plazo* = 0 no se difiere nada. |
| CA-23 | Si *%IntAnl* > 0 **o** *%IvaInt* > 0 → **MCI**; si ambos son 0 → **MSI** (RN-05). |
| CA-24 | En **MCI** el arreglo lleva tres renglones por periodo: capital (clave de *Plazo*), interés (clave de *%IntAnl*) e IVA de interés (clave de *%IvaInt*). |
| CA-25 | En **MSI** el arreglo lleva sólo el renglón de capital, con la clave de *Plazo*. |
| CA-26 | Cada renglón conserva la **fecha del movimiento original** como referencia (§Decisión 5 sobre fechas por periodo). |
| CA-27 | El arreglo completo se manda a una sola ejecución del punto 2. |

### HU-26.5 — Afectación de la línea (§2 y §3)

> **Como** Core Bancario,
> **quiero** aplicar cada concepto sobre el saldo y los cargos de la línea,
> **para** que el disponible y la cartera reflejen el movimiento.

| # | Criterio de aceptación |
|---|---|
| CA-28 | El punto 2 busca la clave recibida en **Afectación de la línea** y toma *Clave*, *Nombre*, *Naturaleza*, *Consume línea disponible*, *bFactura* y *bCargo*. |
| CA-29 | Si la clave **no** está en Afectación de la línea, se emite *"No se encuentra configurado el Cargo XX"* y (RN-08) la transacción completa se revierte. |
| CA-30 | Si *Consume línea disponible* es `S`/`Y`: `Saldo Disponible = Saldo Disponible − monto`, sobre la línea del movimiento. |
| CA-31 | El descuento del disponible es **atómico**: dos movimientos concurrentes no pueden sobregirar la línea (patrón `reservar_cupo_gpo`). |
| CA-32 | Si *bCargo* es `S`/`Y`, se crea un registro en la subpestaña **Cargos** de la Línea con *Clave*, *Nombre*, *Naturaleza*, *monto*, *fecha* y *bFactura*. |
| CA-33 | Si *bCargo* es `N`, no se crea el cargo pero el resto del proceso continúa. |
| CA-34 | El Id de la Línea se resuelve igual venga de pantalla o de API (CA-04). |

### HU-26.6 — Transaccionalidad y rollback

> **Como** responsable de integridad,
> **quiero** que todo el encadenamiento sea una sola transacción,
> **para** que un fallo no deje saldos y cargos descuadrados.

| # | Criterio de aceptación |
|---|---|
| CA-35 | Movimiento, comisión, IVA, cash back, calendario, saldo disponible, cargos de la línea y movimiento de Cuenta Eje se aplican **todo o nada**. |
| CA-36 | Cualquier fallo revierte **todas** las escrituras previas de la misma ejecución. |
| CA-37 | Tras un rollback, el saldo disponible de la línea y el de la Cuenta Eje quedan con el valor que tenían antes de iniciar. |
| CA-38 | El error devuelto identifica **qué paso** falló, para que el operador sepa si es configuración o datos. |
| CA-39 | Reintentar un movimiento rechazado no duplica cargos ni movimientos de los pasos que sí habían alcanzado a escribirse. |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | Todo valor de *Prom Comis e Impue* es un par **valor + clave contable**. La clave identifica el componente que recibe la imputación; si viene vacía, el valor no se imputa a ningún componente (§Decisión 4). |
| RN-02 | La comisión es el **mayor** entre la comisión fija y el porcentaje aplicado al monto: `Max(ComisiónFija, Monto × %Com)` — no la suma. |
| RN-03 | El IVA de comisión se calcula sobre la **comisión ya determinada**, nunca sobre el monto del movimiento. |
| RN-04 | En la Cuenta Eje: **Abono aumenta** el saldo, **Cargo lo disminuye**. |
| RN-05 | **MCI** cuando hay interés o IVA de interés configurado; **MSI** cuando ambos son cero. El discriminante es la configuración, no el nombre del concepto. |
| RN-06 | El disponible de la línea sólo se afecta cuando *Consume línea disponible* es `S`/`Y`. |
| RN-07 | La identidad de un concepto es su **código** del Catálogo de Componentes, nunca su nombre: el catálogo admite nombres repetidos con códigos distintos. |
| RN-08 | Toda la ESPECIFICACIÓN 2 es una **unidad transaccional**. Un fallo en cualquier paso revierte la transacción completa. |
| RN-09 | La validación del prewrite vive en el **servidor**: pantalla y API deben comportarse igual. |

---

## Decisiones abiertas — requieren respuesta de negocio

| # | Pregunta | Por qué bloquea |
|---|---|---|
| 1 | **¿Dónde vive la entidad Movimientos de la Línea?** ¿Subpestaña nueva en Créditos/Cartera, o tabla propia en Supabase? | Sin definirla no hay prewrite que interceptar (HU-26.0). |
| 2 | **¿Qué es el "010" de "010 Tarjeta de Crédito"?** Hoy el producto es `LC-000003 — TDC Clásica` con subtipo *Tarjeta de Crédito*. ¿Se agrega un catálogo de claves de tipo de producto, o el "010" es la `claveProducto`? | Determina cómo se detecta que aplica esta lógica (CA-06, CA-10). |
| 3 | **La ESPEC 2 punto 2 no pasa `bCargo` al punto 3, pero el punto 3 lo exige.** ¿Se lee también de Afectación de la línea? | Es una inconsistencia literal de la especificación; asumimos que sí (CA-28), confirmar. |
| 4 | **¿Qué pasa si un valor trae monto pero no clave contable?** ¿Se imputa a la clave del movimiento, se ignora, o es error de configuración? | Afecta RN-01 y el comportamiento del ejemplo `0%|` de MSI. |
| 5 | **¿El calendario MSI/MCI genera fechas por periodo o todos los renglones con la fecha del movimiento?** La especificación dice "determina el calendario de pagos" pero luego pasa "Fecha de Movimiento" en los tres renglones. | Define si el calendario es real o sólo un desglose (CA-26). |
| 6 | **¿El monto que consume línea en MSI/MCI es el total de la compra o sólo el capital del periodo?** | Cambia el disponible de la línea (CA-30). |
| 7 | **¿El Cash Back consume línea?** La ESPEC lo manda al punto 2 igual que los demás, pero es una bonificación a favor del cliente. | Con *Naturaleza = Abono* y las reglas de coherencia actuales no consume ni libera línea — confirmar que es lo esperado. |
| 8 | **Redondeo y moneda.** ¿A cuántos decimales y con qué criterio se redondean comisión, IVA y cash back? ¿Qué pasa si la línea es en USD? | Evita descuadres de centavos entre línea, cargos y contabilidad. |
| 9 | **Alta de los conceptos faltantes.** `100 MSI_6`, `110 MSI_9`, `120 MCI_3` y las claves `021, 022, 030, 031, 101, 111, 121, 900` no existen en el catálogo. ¿Se dan de alta con esos códigos exactos? | Sin ellos no se puede capturar la configuración del ejemplo. |
| 10 | **En el ejemplo, MSI_9 y MCI_3 traen Plazo = 6** (igual que MSI_6). ¿Es intencional o un error de captura? | Cambia los calendarios esperados en pruebas. |

---

## Orden de implementación sugerido

1. **HU-26.0** — entidad Movimientos + Id de Línea. Sin esto nada se puede probar.
2. **Motor puro, sin persistencia** — un módulo `lib/motorMovimientosTDC.ts` que reciba la configuración del producto y el movimiento, y devuelva el conjunto de efectos (comisiones, cash back, calendario, afectaciones). Testeable sin BD y sin UI.
3. **RPC transaccional** en Postgres que aplique ese conjunto de efectos en una sola transacción, siguiendo `reservar_cupo_gpo`.
4. **HU-26.1** — validación de prewrite en el endpoint de creación.
5. **HU-26.2 → HU-26.5** conectando el motor al RPC.
6. **HU-26.6** — pruebas de rollback: forzar fallo en cada paso y verificar que saldo de línea y Cuenta Eje quedan intactos.

Separar el motor (2) de la persistencia (3) es lo que permite cumplir RN-08 sin
volver el código inmanejable: el motor decide *qué* pasa, la transacción decide
*cómo* se escribe, y sólo esta última necesita BD para probarse.
