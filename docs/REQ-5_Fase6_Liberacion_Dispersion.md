# HU — REQ-5: Fase 6 "Liberación y Dispersión" (Tesorería) — Arrendamiento Puro

## Contexto técnico (ya verificado en el sistema, no re-investigar)

- Stack: React + TypeScript + Vite + Supabase (Postgres + Edge Functions + Storage).
- Las fases NO están en código: viven en `J_PRODUCTOS.data.fases` del producto.
  El producto `8b9fa0f2-f500-4cfc-ae7d-04acceb69018` ("Arrendamiento Puro-Maquinaria")
  tiene 6 fases. La fase 6 es **"Liberación y Dispersión"** y hoy tiene
  `area: "ADMINISTRACIÓN"`, no Tesorería.
- La fase 6 **no tiene ningún requisito** en `data.expedientesElectronicos`
  (los 13 requisitos existentes están en las fases 1 a 5). No hay documento
  esperado al cierre.
- El avance de fase real ocurre en `handleEnviarFase`
  (`src/app/components/solicitudes/SolicitudCreditoForm.tsx`, ~línea 546).
  En el punto 4 hace:
  ```ts
  const sigFase = fasesDelProducto.find(f => f.seq === seqActual + 1);
  if (!sigFase) {
    toast.info('Esta es la última fase del flujo', {...});
    return;   // ← el flujo muere aquí: no hay cierre
  }
  ```
  **Este es el motivo por el que la última fase no se puede terminar.**
  No existe ninguna acción de finalización del proceso.
- Ya existe el patrón de generación automática de documentos al ENTRAR a una fase,
  en el mismo `handleEnviarFase`: `if (String(sigFase.faseId) === '2') { await autoCrearReporteBuro(...) }`.
- Ya existen validaciones bloqueantes específicas por fase en `handleEnviarFase`
  (`seqActual === 4` y `seqActual === 5` con `validarContratosYPagares`).
- `src/app/hooks/generarDocumentosFase4.ts` ya contiene toda la maquinaria de
  documentos: `generarReporteBuroPDF()` (jsPDF + autoTable + logo institucional),
  `persistirDocumentosEnBD()`, `autoCrearKitLegal()`, `htmlToPdfBlobUrl(html, salida)`
  y las constantes `CLAVE_*` de requisitos.
- `src/app/components/creditos/creditoStore.ts:132` define
  `CAT_ESTATUS_CARTERA = ['Vigente', 'Vencida', 'Castigada', 'Reestructurada']`.
- El módulo `src/app/components/solicitudes-activacion/` (Dashboard + List + Form +
  DetailTab + store + PDF) es el patrón más cercano a una bandeja de autorización.
- Las cuentas bancarias del cliente/proveedor ya existen:
  `src/app/hooks/useCuentasBancariasDB.ts`, `useCatalogoBancario.ts`,
  `src/app/components/clientes/CuentasBancariasTab.tsx`.
- Persistencia: PUT a `https://pvzrjmsynzgfsowntywf.supabase.co/functions/v1/make-server-7e2d13d9/solicitudes-credito/:id`,
  que hace **deep merge del lado del servidor** (se puede enviar solo el campo a cambiar).
- Solicitud de prueba: `ea984b49-dae0-4cd6-927c-1edae5b9a4d8` (`BAN-DIGITAL-20260810-000001`).

## Objetivo

Implementar el cierre del flujo de Arrendamiento Puro: la fase 6 "Liberación y
Dispersión" debe poder **completarse**, ejecutando la dispersión al proveedor por
Tesorería y dejando el contrato **Vigente** para iniciar facturación.

---

## Alcance

### 1. Fila de Pagos — bandeja de autorizaciones de Tesorería

- Toda solicitud que **entre a la fase 6** debe aparecer automáticamente en una
  bandeja de Tesorería ("Fila de Pagos"), sin captura manual.
- La bandeja muestra como mínimo: No. Solicitud, Cliente, Producto, Proveedor,
  Monto a dispersar, Fecha de solicitud, Estatus de pago
  (`Pendiente` | `Autorizado` | `Dispersado` | `Rechazado`).
- Debe poder abrirse el detalle y ver el **contrato** (documento del Expediente
  Electrónico de la fase 3) desde la propia bandeja, sin salir del módulo.
- Acciones de Tesorería: **Autorizar pago** y **Rechazar pago** (con motivo obligatorio).
- Reutilizar el patrón del módulo `solicitudes-activacion`. Registrar el nuevo
  módulo en `navigationTabs` de `src/app/App.tsx` (~línea 674) y en el `type Module`
  (~línea 70).
- El **monto a dispersar** es el Monto Autorizado de la solicitud (post-enganche),
  no el Monto Solicitado.

### 2. Transferencia Exitosa — comprobante SPEI

- Al autorizar y ejecutar la dispersión, generar automáticamente un
  **Comprobante de Transferencia SPEI** en PDF y adjuntarlo al Expediente
  Electrónico de la solicitud.
- Datos mínimos del comprobante: clave de rastreo, fecha y hora de operación,
  banco emisor, banco receptor, CLABE destino (enmascarada salvo últimos 4),
  beneficiario (proveedor), concepto, referencia numérica, monto e IVA,
  y leyenda de operación exitosa.
- La CLABE/beneficiario deben tomarse de las cuentas bancarias registradas
  (`useCuentasBancariasDB`), no capturarse a mano.
- Reutilizar `generarReporteBuroPDF()` como referencia de diseño y
  `persistirDocumentosEnBD()` para el guardado — mismo patrón que Buró y Kit Legal.
  El PDF debe ser vectorial (jsPDF + autoTable), no html2canvas, para que pese poco.
- Debe existir además un **botón manual** en el Expediente Electrónico para
  regenerar/descargar el comprobante, igual que "Generar Autorización Buró".
- **Requiere agregar el requisito al producto**: hoy la fase 6 no tiene ninguno.
  Crear en `data.expedientesElectronicos` el requisito
  `DOC-SPEI` = **"Comprobante de Transferencia SPEI"**, fase
  "Liberación y Dispersión", área Tesorería, obligatorio.
  El nombre debe coincidir **exactamente** con el que use el generador: la
  validación con IA compara por nombre y rechaza el documento si no coincide.

### 3. Activación del Contrato — estatus "Vigente"

- Una vez confirmada la dispersión, el contrato debe pasar **automáticamente** a
  estatus **"Vigente"** (valor ya existente en `CAT_ESTATUS_CARTERA`), sin acción
  manual adicional.
- A partir de ese momento el contrato queda habilitado para facturación y su
  calendario de rentas es el vigente para cobranza.
- La solicitud debe quedar marcada como **proceso completado / finalizado**, no
  como "en proceso".
- El cambio debe persistirse en BD y sobrevivir a un reload (verificar el camino
  de lectura, no solo el de escritura).

### 4. Desbloquear el cierre del flujo (causa raíz)

- En `handleEnviarFase`, la rama `if (!sigFase)` hoy solo muestra un `toast.info`
  y hace `return`. Sustituirla por un **cierre real del proceso**:
  validar que la dispersión esté confirmada y el comprobante SPEI exista en el
  expediente, y sólo entonces finalizar (activar contrato + marcar completado).
- Si la dispersión no está confirmada, bloquear con un mensaje claro que diga
  qué falta — mismo estilo que las validaciones de `seqActual === 4` y `=== 5`.
- El botón de la última fase no debe seguir diciendo "Enviar de Fase":
  debe indicar la acción de cierre.

---

## Criterios de aceptación

1. Una solicitud que entra a fase 6 aparece sola en la bandeja de Tesorería.
2. Desde la bandeja se puede abrir y ver el contrato de la solicitud.
3. Al autorizar la dispersión se genera el comprobante SPEI en PDF, se adjunta al
   Expediente Electrónico y se puede descargar.
4. Tras la dispersión, el contrato queda en estatus "Vigente" automáticamente.
5. La solicitud puede **terminarse**: la fase 6 se completa y el proceso queda
   cerrado, sin el mensaje "Esta es la última fase del flujo".
6. Intentar cerrar sin dispersión confirmada muestra un error explicando qué falta.
7. Todo lo anterior persiste tras recargar la página.
8. `npx vite build` compila sin errores y `dist/` se restaura (`git checkout -- dist/`).

## Fuera de alcance

- Integración real con SPEI/banco: la transferencia es **simulada**, igual que el
  Reporte de Buró.
- Motor de facturación: sólo se habilita el estatus que la dispara.
- No modificar el comportamiento de las fases 1 a 5.

## Advertencias

- En este código el **camino de escritura y el de lectura están separados**
  (`formToDBPayload` vs `buildFormDataFromListItem` / `preloadSubtabsFromDBData`).
  Un campo nuevo hay que mapearlo en **ambos** o se pierde al recargar.
- No usar `catch {}` vacío: los fallos de guardado deben mostrar un toast visible.
- No renombrar claves ni nombres de requisitos ya usados por las validaciones.
