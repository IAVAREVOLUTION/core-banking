Quiero que analices y soluciones el siguiente problema al convertir PDFs a imágenes dentro del módulo de Expediente Electrónico:

Error actual:

Código
Error: No "GlobalWorkerOptions.workerSrc" specified.
Contexto:

Estoy usando pdf.js para convertir PDFs a imágenes.

El proceso se ejecuta en el frontend (React/Next/Vue) o en una Edge Function.

El error aparece al intentar hacer pdfjsLib.getDocument(...).

Requerimiento:
Necesito que configures correctamente el worker de pdf.js para que el PDF pueda renderizarse sin errores.

✔️ Lo que debe hacer la solución
Configurar correctamente pdfjsLib.GlobalWorkerOptions.workerSrc  
Debe apuntar a un worker válido, por ejemplo:

CDN oficial

Worker local

Worker empaquetado en el proyecto

Garantizar compatibilidad con bundlers  
Debe funcionar con:

Vite

Webpack

Next.js

Edge Functions (si aplica)

Permitir convertir PDF → imagen  
Debe permitir:

Cargar el PDF

Renderizar la página 1

Convertirla a PNG o JPEG

Retornar la imagen para enviarla a la IA

Evitar errores comunes  
La solución NO debe:

Usar rutas incorrectas

Usar workers bloqueados por CORS

Usar workers que no existen

Usar imports incompatibles con Edge Functions

✔️ Formato esperado de la solución
La IA debe entregar:

1. Configuración correcta del worker
Ejemplo:

js
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
2. Función completa PDF → imagen
Debe incluir:

Carga del PDF

Render de la página

Conversión a imagen

Retorno del blob/base64

3. Alternativas según entorno
Debe incluir soluciones para:

Frontend

Node.js

Edge Functions

Bundlers modernos

4. Validación final
Debe confirmar que:

El PDF se renderiza sin errores

El worker está correctamente configurado

La imagen resultante es válida para enviarla a Llama 3 Vision

🎯 Objetivo final
Quiero una solución funcional, probada y lista para pegar, que elimine el error:

Código
No "GlobalWorkerOptions.workerSrc" specified
y permita convertir cualquier PDF a imagen para enviarlo a la IA de validación documental.