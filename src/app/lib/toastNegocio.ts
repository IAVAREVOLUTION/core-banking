/**
 * Red de seguridad: las notificaciones nunca muestran detalles internos de la
 * base de datos (nombres de tablas J_*, esquema, UUID, "Type:", JSONB) ni
 * errores crudos del servidor. Los mensajes se redactan en lenguaje de negocio
 * en cada módulo; esto sólo limpia lo que se escape. Lo usa notificaciones.tsx.
 */

const TABLA = /(?:"?EFINANCIANET_DB"?\.)?"?\bJ_[A-Z0-9_]+\b"?/;

/** Errores crudos de Postgres/HTTP que no le dicen nada al usuario. */
const ERROR_TECNICO = /permission denied|violates|duplicate key|syntax error|does not exist|invalid input syntax|null value in column|relation "|^HTTP \d{3}|Failed to fetch|NetworkError|TypeError:/i;

export function limpiarMensaje(entrada: string): string {
  // Los avisos son cortos; acotar el largo mantiene las expresiones baratas.
  const texto = entrada.length > 500 ? entrada.slice(0, 500) + '…' : entrada;
  if (ERROR_TECNICO.test(texto)) return 'Ocurrió un error en el servidor. Intente de nuevo; si persiste, contacte a soporte.';
  // Sin mencionar el modelo de IA usado (dato técnico).
  return quitarModeloIA(texto)
    // "… guardado en J_CLIENTES" → "… guardado"
    .replace(new RegExp(String.raw`\s*\b(?:en|de|desde|a|al|con|hacia)\s+(?:la\s+tabla\s+)?` + TABLA.source, 'g'), '')
    .replace(new RegExp(TABLA.source, 'g'), 'el sistema')
    // " — Type: Credito | Subtipo: X"
    .replace(/\s*[—–-]?\s*\bType:\s*[^|—\n]*(?:\|\s*Subtipo:\s*[^—\n]*)?/gi, '')
    // "ID: 19710b2d..." y UUID sueltos
    .replace(/\bID:\s*[0-9a-f]{6,}[0-9a-f-]*(?:\.\.\.|…)?/gi, '')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/\bUUID\b/g, 'identificador')
    .replace(/\bJSONB\b/g, 'registro')
    .replace(/\s*[—–|]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

/**
 * Quita del texto la mención al modelo de IA usado ("· claude:claude-haiku-4-5…",
 * "🤖 gpt-4o", "openai/gpt-4o-mini"…). Es un dato técnico que no se muestra.
 */
const PATRON_MODELO_IA = /\s*(?:[·|•-]\s*)?(?:🤖\s*)?\b(?:anthropic|openai|openrouter|groq|google|meta-llama|mistralai)?\/?(?:claude|gpt|gemini|llama|mistral|mixtral|deepseek|qwen)[\w.:\/-]*(?::[\w.\/-]+)?/gi;
export function quitarModeloIA(texto: string): string {
  return String(texto ?? '').replace(PATRON_MODELO_IA, '').replace(/\s*·\s*$/, '').trim();
}
