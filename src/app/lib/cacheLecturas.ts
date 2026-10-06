/**
 * Caché compartida de lecturas pesadas del Edge Function.
 *
 * Varios módulos descargan el MISMO listado completo una y otra vez:
 * GET /solicitudes-credito (~5.8 MB, ~2 s de servidor) lo piden Solicitudes,
 * Banca 2º Piso (en cinco funciones distintas, sólo para encontrar una fila),
 * Cartera, Cobranza, Aportaciones y Pólizas. Aquí:
 *
 *   - Peticiones GET idénticas en vuelo se comparten (una sola descarga).
 *   - La respuesta se reutiliza durante TTL_MS.
 *   - Cualquier escritura (PUT/POST/PATCH/DELETE) hacia Supabase vacía la caché,
 *     de modo que después de guardar la siguiente lectura siempre es fresca.
 *     Las RPC de sólo lectura (`/rest/v1/rpc/get_*`) no la vacían.
 *
 * Sólo se cachean los listados de la lista blanca; el resto pasa directo.
 * Se importa en main.tsx antes que App.
 */

const TTL_MS = 20_000;

/** Rutas (relativas al Edge Function, con su query) que se pueden cachear. */
const CACHEABLES = [
  /^\/solicitudes-credito(\?vista=lista)?$/,
  /^\/solicitudes-credito\/[0-9a-f-]{36}$/i,
  /^\/productos$/,
  /^\/productos\/[0-9a-f-]{36}$/i,
  /^\/catalogos\/documentos$/,
  /^\/clientes-prospectos$/,
];

interface Entrada {
  expira: number;
  respuesta: Promise<{ status: number; statusText: string; headers: [string, string][]; cuerpo: ArrayBuffer }>;
}

const cache = new Map<string, Entrada>();

function rutaEdge(url: URL): string | null {
  const m = url.pathname.match(/\/functions\/v1\/make-server-[^/]+(\/.*)$/);
  return m ? m[1] : null;
}

function esSupabase(url: URL): boolean {
  return url.hostname.endsWith('.supabase.co');
}

/** Vacía la caché (también la usan los módulos que quieran forzar recarga). */
export function invalidarLecturas(): void {
  cache.clear();
}

function envolverFetch() {
  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL;
    try {
      url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    } catch {
      return original(input as any, init);
    }
    const metodo = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    if (metodo !== 'GET' && metodo !== 'HEAD') {
      const lecturaRpc = metodo === 'POST' && /\/rest\/v1\/rpc\/get_/.test(url.pathname);
      if (esSupabase(url) && !lecturaRpc) invalidarLecturas();
      return original(input as any, init);
    }

    const ruta = rutaEdge(url);
    const cacheable = ruta !== null && CACHEABLES.some(r => r.test(ruta + url.search))
      && init?.cache !== 'no-store' && init?.cache !== 'reload';
    if (!cacheable) return original(input as any, init);

    const clave = url.href;
    const ahora = Date.now();
    let entrada = cache.get(clave);
    if (!entrada || entrada.expira < ahora) {
      const respuesta = original(input as any, init).then(async r => ({
        status: r.status,
        statusText: r.statusText,
        // El cuerpo ya viene descomprimido: no copiar encoding/longitud originales.
        headers: [...r.headers.entries()].filter(([k]) => !/^content-(encoding|length)$/i.test(k)),
        cuerpo: await r.arrayBuffer(),
      }));
      const nueva: Entrada = { expira: ahora + TTL_MS, respuesta };
      entrada = nueva;
      cache.set(clave, nueva);
      // Errores y respuestas no-OK no se reutilizan.
      const descartar = () => { if (cache.get(clave) === nueva) cache.delete(clave); };
      respuesta.then(r => { if (r.status >= 400) descartar(); }, descartar);
    }
    // Cada consumidor recibe su propio Response (el cuerpo sólo se puede leer una vez).
    return entrada.respuesta.then(r => new Response(r.cuerpo.slice(0), {
      status: r.status, statusText: r.statusText, headers: r.headers,
    }));
  };
}

/** Botones de recarga explícita ("Actualizar", "Recargar", "Refrescar") siempre leen fresco. */
const RECARGA = /\b(actualizar|recargar|refrescar)\b/i;
function onClickRecarga(e: MouseEvent) {
  const el = (e.target as Element | null)?.closest?.('button, [role="button"]');
  if (el && RECARGA.test((el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '').slice(0, 60))) {
    invalidarLecturas();
  }
}

if (typeof window !== 'undefined' && !(window as any).__cacheLecturas) {
  (window as any).__cacheLecturas = true;
  envolverFetch();
  document.addEventListener('click', onClickRecarga, true);
}
