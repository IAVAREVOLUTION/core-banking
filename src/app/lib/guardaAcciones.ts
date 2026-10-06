/**
 * Guarda global contra acciones repetidas (doble clic en Guardar, Enviar, …).
 *
 * El sistema tiene más de cien botones de guardado repartidos en módulos y
 * subtabs; muchos no bloquean un segundo clic y eso duplicaba registros o
 * mandaba dos veces el mismo PUT. En lugar de tocarlos uno por uno, aquí se
 * intercepta el clic en fase de captura (antes de que React lo reciba):
 *
 *   1. El primer clic en un botón de acción pasa y lo bloquea.
 *   2. Los clics siguientes en ESE botón se descartan mientras siga bloqueado.
 *   3. Se libera cuando terminan las peticiones al servidor que arrancaron
 *      durante la acción (se rastrea window.fetch, que también usa Supabase),
 *      con un mínimo de MIN_MS para acciones sólo locales y un tope de MAX_MS.
 *
 * Los botones que ya manejan su propio estado `saving`/`disabled` siguen
 * funcionando igual; esto sólo agrega la red de seguridad.
 *
 * Se importa en main.tsx ANTES que App para envolver fetch antes de que se
 * cree el cliente de Supabase.
 */

const MIN_MS = 800;        // bloqueo mínimo (acciones sin red)
const QUIETUD_MS = 300;    // sin peticiones en vuelo durante este tiempo = terminó
const MAX_MS = 60_000;     // nunca dejar un botón bloqueado indefinidamente
const ATTR = 'data-accion-en-curso';

/** Texto de botón que identifica una acción que no debe repetirse. */
const ACCION = /\b(guardar|enviar|activar|autorizar|rechazar|aprobar|aplicar|confirmar|generar|registrar|formalizar|ejecutar|crear|actualizar|agregar|calificar|liberar|dispersar|validar|cerrar oportunidad|reintentar)\b/i;

/**
 * Acciones que además bloquean TODA la pantalla mientras se guardan (modal
 * "Guardando información…"): el usuario no puede navegar ni pulsar otra cosa
 * hasta que el servidor responda.
 */
const ACCION_GUARDADO = /\b(guardar|enviar|activar|autorizar|rechazar|aprobar|aplicar|confirmar|registrar|formalizar|dispersar|liberar|cerrar oportunidad)\b/i;
const MOSTRAR_TRAS_MS = 250;   // sólo si la acción tarda: evita parpadeos
const MIN_VISIBLE_MS = 400;    // una vez visible, no desaparecer de golpe

interface Bloqueo { desde: number; pantalla: boolean; mensaje: string }

const bloqueos = new Map<Element, Bloqueo>();
let enVuelo = 0;
let ultimaRespuesta = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function textoDe(el: Element): string {
  return (el.textContent || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '')
    .replace(/\s+/g, ' ').trim().slice(0, 60);
}

function esBotonDeAccion(el: Element): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  return ACCION.test(textoDe(el));
}

// ── Modal que bloquea la pantalla (mismo diseño que "Actualizando datos...") ──
let overlay: HTMLDivElement | null = null;
let overlayDesde = 0;

function mostrarOverlay(mensaje: string) {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.className = 'guarda-overlay';
    overlay.innerHTML = `
      <div class="guarda-card">
        <svg class="guarda-spin" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="20" stroke="#E0E0E0" stroke-width="4"/>
          <path d="M24 4a20 20 0 0115.5 32.4" stroke="var(--theme-primary, #2E5C91)" stroke-width="4" stroke-linecap="round"/>
        </svg>
        <p class="guarda-titulo"></p>
        <p class="guarda-sub">No cierre ni cambie de pantalla.</p>
      </div>`;
  }
  overlay.querySelector('.guarda-titulo')!.textContent = mensaje;
  if (!overlay.isConnected) {
    document.body.appendChild(overlay);
    overlayDesde = Date.now();
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
}

function ocultarOverlay() {
  if (overlay?.isConnected && Date.now() - overlayDesde >= MIN_VISIBLE_MS) overlay.remove();
}

const overlayVisible = () => !!overlay?.isConnected;

/** Con el modal visible: nada de teclado (Tab/Enter dispararían otros botones). */
function onTeclaCaptura(e: KeyboardEvent) {
  if (!overlayVisible()) return;
  e.preventDefault();
  e.stopImmediatePropagation();
}

/** Con el modal visible: avisar antes de cerrar o recargar la pestaña. */
function onAntesDeSalir(e: BeforeUnloadEvent) {
  if (!overlayVisible()) return;
  e.preventDefault();
  e.returnValue = '';
}

function liberar(el: Element) {
  bloqueos.delete(el);
  el.removeAttribute(ATTR);
  el.removeAttribute('aria-busy');
}

function revisar() {
  const ahora = Date.now();
  for (const [el, b] of bloqueos) {
    const transcurrido = ahora - b.desde;
    const terminoRed = enVuelo === 0 && ahora - ultimaRespuesta >= QUIETUD_MS;
    // Un botón que React desmonta (p. ej. el formulario se cerró al guardar) no
    // libera el bloqueo de pantalla mientras su petición siga en vuelo.
    const desmontado = !el.isConnected && enVuelo === 0;
    if (desmontado || transcurrido >= MAX_MS || (transcurrido >= MIN_MS && terminoRed)) liberar(el);
  }
  // Modal: sólo si una acción de guardado lleva un rato y espera al servidor.
  const guardando = [...bloqueos.values()].find(b => b.pantalla && ahora - b.desde >= MOSTRAR_TRAS_MS && (enVuelo > 0 || overlayVisible()));
  if (guardando) mostrarOverlay(guardando.mensaje);
  else if (![...bloqueos.values()].some(b => b.pantalla)) ocultarOverlay();
  if (bloqueos.size === 0 && !overlayVisible() && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function onClickCaptura(e: MouseEvent) {
  const el = (e.target as Element | null)?.closest?.('button, input[type="submit"], input[type="button"], [role="button"]');
  if (!el) return;
  if (bloqueos.has(el)) {
    // Acción ya en curso: el clic no llega al handler de React.
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (!esBotonDeAccion(el)) return;
  const texto = textoDe(el);
  const pantalla = ACCION_GUARDADO.test(texto);
  const mensaje = /guardar/i.test(texto) ? 'Guardando información…' : 'Procesando…';
  bloqueos.set(el, { desde: Date.now(), pantalla, mensaje });
  el.setAttribute(ATTR, '');
  el.setAttribute('aria-busy', 'true');
  if (!timer) timer = setInterval(revisar, 100);
}

function envolverFetch() {
  const original = window.fetch.bind(window);
  window.fetch = (...args: Parameters<typeof fetch>) => {
    // Sólo cuentan las peticiones iniciadas mientras hay una acción en curso.
    if (bloqueos.size === 0) return original(...args);
    enVuelo++;
    return original(...args).finally(() => {
      enVuelo = Math.max(0, enVuelo - 1);
      ultimaRespuesta = Date.now();
    });
  };
}

function estilos() {
  const style = document.createElement('style');
  style.textContent = `[${ATTR}]{opacity:.6;cursor:progress!important;}
.guarda-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);cursor:progress;}
.guarda-card{background:#fff;border-radius:.5rem;padding:1.5rem 2rem;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1);display:flex;flex-direction:column;align-items:center;gap:.75rem;min-width:240px;}
.guarda-spin{animation:guarda-giro 1s linear infinite;}
.guarda-titulo{margin:0;color:#374151;font-weight:500;font-size:.95rem;}
.guarda-sub{margin:0;color:#6B7280;font-size:.75rem;}
@keyframes guarda-giro{to{transform:rotate(360deg)}}`;
  document.head.appendChild(style);
}

if (typeof window !== 'undefined' && !(window as any).__guardaAcciones) {
  (window as any).__guardaAcciones = true;
  envolverFetch();
  estilos();
  document.addEventListener('click', onClickCaptura, true);
  document.addEventListener('keydown', onTeclaCaptura, true);
  window.addEventListener('beforeunload', onAntesDeSalir);
}

export {};
