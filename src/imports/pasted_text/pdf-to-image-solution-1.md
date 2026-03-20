Quiero que analices y soluciones el siguiente problema al convertir PDFs a imágenes dentro del módulo de Expediente Electrónico:

Error actual:

Código
[ExpedienteTab] [PDF→IMG] Error renderizando PDF:
Error: Setting up fake worker failed:
"Failed to fetch dynamically imported module:
https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.5.207/pdf.worker.min.mjs"
Contexto:

Estoy usando pdf.js 5.x

El entorno es frontend moderno (Vite/React/Next)

pdf.js intenta cargar un fake worker porque no encuentra un worker válido

El CDN de pdf.js NO sirve archivos .mjs con CORS adecuado

Necesito convertir PDFs a imágenes para enviarlas a la IA

✔️ Lo que debe hacer la solución
Desactivar el fake worker  
pdf.js 5.x permite usar:

js
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
Usar un worker local compatible  
Debe incluir:

pdf.worker.min.js dentro de /public/

O importarlo desde pdfjs-dist/build/pdf.worker.min.js

Evitar import dinámico desde CDN  
El CDN falla porque:

No sirve .mjs con MIME correcto

No soporta import dinámico cross-origin

Edge Functions no permiten dynamic import remoto

Proveer una función PDF→IMG funcional  
Debe:

Cargar el PDF

Renderizar la página 1

Convertirla a PNG/JPEG

Retornar la imagen

Incluir alternativas según entorno

Vite

Next.js

Node/Edge Functions

✔️ Formato esperado de la solución
La IA debe entregar:

1. Configuración correcta del worker (local, no CDN)
Ejemplo:

js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
O:

js
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
2. Función completa PDF → imagen
Debe incluir:

getDocument()

getPage(1)

page.render()

canvas.toDataURL()

3. Alternativas para entornos sin DOM (Edge Functions)
Debe incluir:

Conversión PDF → PNG usando pdf-lib o pdfjs-dist/legacy/build/pdf.js

O usar pdf-poppler / pdf2pic / pdfjs-dist en modo Node

4. Validación final
Debe confirmar que:

El worker carga correctamente

No se usa fake worker

No se usa CDN

No hay import dinámico fallido

El PDF se renderiza sin errores

La imagen resultante es válida para IA

🎯 Objetivo final
Quiero una solución funcional, probada y lista para pegar, que elimine el error:

Código
Setting up fake worker failed
Failed to fetch dynamically imported module
y permita convertir cualquier PDF a imagen para enviarlo a la IA de validación documental.