/**
 * VotacionCPCTab.tsx — REQ-11
 *
 * Acordeón "Votación CPC" de la Solicitud / Originación. Actividad 6.1 del BPM:
 * Evaluación y Dictamen del Comité de Prepago y Crédito.
 *
 * DECISIÓN #1 (27/08/2026, revisada 28/08/2026): identidad del votante por
 * navegador, no por login — y ANÓNIMA, no por nombre real. Los miembros del CPC
 * entran desde sus propias computadoras al mismo hosting; `localStorage` está
 * aislado por navegador+origen, así que cada máquina recibe una etiqueta
 * secuencial ("Anónimo 1", "Anónimo 2"...) la primera vez que vota EN ESTA
 * Solicitud, y la reutiliza en adelante — nunca se captura ni se muestra un
 * nombre real. Esto resuelve también la decisión #3 (anonimato vs. firma): se
 * optó por anonimato. La etiqueta se calcula como "cantidad de votos ya
 * registrados en esta Solicitud + 1"; es autoasignada, no autenticación real —
 * nada impide borrar el localStorage y recibir una etiqueta nueva.
 *
 * DECISIÓN #2 (27/08/2026, parcial): la firma NO se captura a mano — se genera un
 * folio aleatorio automáticamente al registrar el voto (generarFirmaAleatoria). Sigue
 * siendo SIMBÓLICA: es un folio de recibo, no una firma criptográfica — nadie la
 * valida ni impide falsificarla, sólo identifica cada voto de forma única para el
 * acta. No pedirle al usuario que teclee un PIN que de todos modos no se valida es
 * más honesto que simular una seguridad que no existe.
 *
 * DECISIONES #3, #4 y #5 de REQ-11 SIGUEN SIN RESOLVER — por eso este subtab:
 *   - Al capturar un nombre real por voto, el resultado es TRAZABLE, no anónimo — es
 *     una consecuencia de la decisión #1, no una resolución de la #3.
 *   - Sólo cuenta los votos (matemática objetiva); NO calcula un veredicto final ni
 *     bloquea el avance de fase, porque la regla de mayoría/quórum (decisión #4) no
 *     está definida. Inventarla sería una regla de negocio no autorizada.
 *   - NO genera ni toca el Acta de Sesión — REQ-9 ya genera una versión sistémica de
 *     ese documento y la decisión #5 (si esta la sustituye) sigue abierta.
 */
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { loadFromSession, loadFromSavedStore, saveToSession } from './solicitudCreditoStore';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export const SUBTAB_VOTACION_CPC = 'votacionCPC';

/**
 * BUG FIX (28/08/2026): la numeración "Anónimo N" y el conteo de votos dependen
 * de que cada miembro VEA los votos de los demás. Antes, "Registrar Voto en
 * Plataforma" sólo guardaba en sessionStorage del propio navegador — el voto no
 * llegaba a BD hasta que alguien guardara el formulario completo. Si el segundo
 * miembro abría la Solicitud en su propia máquina ANTES de ese guardado general,
 * no veía el voto del primero y ambos recibían "Anónimo 1" (colisión real,
 * reproducida en pruebas). El botón además dice "en Plataforma" — el usuario
 * espera que quede guardado de inmediato, no que dependa de otro paso posterior.
 *
 * Por eso cada voto se persiste a BD apenas se registra, con el mismo patrón que
 * ya usan los documentos auto-generados (persistirDocumentosEnBD en
 * generarDocumentosFase4.ts): un PUT parcial sólo con este campo — el backend
 * hace merge contra el resto del JSONB, no lo sobrescribe.
 */
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function persistirVotosCPCEnBD(
  solicitudId: string | number,
  votos: VotoCPC[],
): Promise<{ ok: boolean; error?: string }> {
  const id = String(solicitudId);
  if (!UUID_RE.test(id)) {
    return { ok: false, error: 'La Solicitud aún no tiene ID de BD (guárdela primero).' };
  }
  const votosDB = votos.map(v => ({
    id: v.id,
    votante: v.votante,
    decision: v.decision,
    comentarios: v.comentarios,
    firma_token: v.firmaToken,
    fecha: v.fecha,
  }));
  try {
    const res = await fetch(`${API_BASE}/solicitudes-credito/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: { solicitud: { votacion_cpc: { votos: votosDB } } },
      }),
    });
    if (res.ok) return { ok: true };
    const json = await res.json().catch(() => ({} as any));
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Clave de localStorage — aislada por navegador+origen Y por Solicitud, para que
 * la numeración "Anónimo N" empiece de nuevo en cada Comité distinto.
 */
function claveVotante(solicitudId: string | number): string {
  return `cpc_votante_${solicitudId}`;
}

export type DecisionVoto = 'Aprobar' | 'Rechazar' | 'Devolver';

export const CAT_DECISION_VOTO: { value: DecisionVoto; label: string }[] = [
  { value: 'Aprobar', label: 'Aprobar Operación' },
  { value: 'Rechazar', label: 'Rechazar Operación' },
  { value: 'Devolver', label: 'Devolver a Riesgos para Ajustes' },
];

export const COMENTARIOS_MIN_CARACTERES = 100;

/**
 * Folio de firma aleatorio — NO es una firma criptográfica, es un identificador único
 * de recibo para el voto. Se genera al registrar, sin intervención del usuario.
 */
export function generarFirmaAleatoria(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusión visual
  let folio = '';
  for (let i = 0; i < 10; i++) folio += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return 'FIRMA-' + folio.slice(0, 5) + '-' + folio.slice(5);
}

export interface VotoCPC {
  id: string;
  votante: string;
  decision: DecisionVoto;
  comentarios: string;
  /** Simbólico — ver nota de cabecera. No es una firma criptográfica real. */
  firmaToken: string;
  fecha: string;
}

export interface VotacionCPCData {
  votos: VotoCPC[];
}

export const EMPTY_VOTACION_CPC: VotacionCPCData = { votos: [] };

export function leerVotacionCPC(solicitudId: string | number): VotacionCPCData {
  const g =
    loadFromSession<Partial<VotacionCPCData>>(solicitudId, SUBTAB_VOTACION_CPC) ??
    loadFromSavedStore<Partial<VotacionCPCData>>(solicitudId, SUBTAB_VOTACION_CPC);
  return { votos: Array.isArray(g?.votos) ? g!.votos! : [] };
}

/** Conteo por decisión. Matemática objetiva — no implica ningún veredicto. */
export function conteoVotosCPC(votos: VotoCPC[]) {
  return {
    Aprobar: votos.filter(v => v.decision === 'Aprobar').length,
    Rechazar: votos.filter(v => v.decision === 'Rechazar').length,
    Devolver: votos.filter(v => v.decision === 'Devolver').length,
  };
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  onChange?: (datos: VotacionCPCData) => void;
}

export function VotacionCPCTab({ mode, solicitudId, onChange }: Props) {
  const isRO = mode === 'ver';
  const [datos, setDatos] = useState<VotacionCPCData>(() => leerVotacionCPC(solicitudId));

  /**
   * Etiqueta anónima de este navegador para ESTA Solicitud. Se asigna una sola vez:
   * si ya hay una guardada, se reutiliza; si no, se calcula la siguiente disponible
   * a partir de los votos que ya existan y se guarda de inmediato para que un
   * refresh de página no genere una etiqueta distinta.
   */
  const [votante] = useState(() => {
    try {
      const clave = claveVotante(solicitudId);
      const guardada = localStorage.getItem(clave);
      if (guardada) return guardada;
      const previos = leerVotacionCPC(solicitudId).votos.length;
      const etiqueta = `Anónimo ${previos + 1}`;
      localStorage.setItem(clave, etiqueta);
      return etiqueta;
    } catch {
      return 'Anónimo';
    }
  });
  const [decision, setDecision] = useState<DecisionVoto | ''>('');
  const [comentarios, setComentarios] = useState('');

  /** Guarda contra el vaciado inicial — mismo patrón que REQ-9/REQ-10. */
  const huboVotosRef = useRef(false);
  if (datos.votos.length > 0) huboVotosRef.current = true;

  useEffect(() => {
    if (isRO) return;
    if (!huboVotosRef.current) return;
    saveToSession(solicitudId, SUBTAB_VOTACION_CPC, datos);
    onChange?.(datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, solicitudId, isRO]);

  const yaVoto = !!votante.trim() && datos.votos.some(
    v => v.votante.trim().toLowerCase() === votante.trim().toLowerCase(),
  );

  const [registrando, setRegistrando] = useState(false);

  const registrarVoto = async () => {
    const nombre = votante.trim();
    if (!decision) {
      toast.error('Seleccione una decisión');
      return;
    }
    if (comentarios.trim().length < COMENTARIOS_MIN_CARACTERES) {
      toast.error('Comentario insuficiente', {
        description: `Mínimo ${COMENTARIOS_MIN_CARACTERES} caracteres — lleva ${comentarios.trim().length}.`,
      });
      return;
    }
    if (yaVoto) {
      toast.error('Este votante ya registró su voto en esta Solicitud', {
        description: 'Un mismo nombre no puede votar dos veces (CA-05).',
      });
      return;
    }

    const folio = generarFirmaAleatoria();
    const nuevo: VotoCPC = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      votante: nombre,
      decision,
      comentarios: comentarios.trim(),
      firmaToken: folio,
      fecha: new Date().toLocaleString('es-MX'),
    };
    const votosActualizados = [...datos.votos, nuevo];
    setDatos({ votos: votosActualizados });
    setDecision('');
    setComentarios('');

    setRegistrando(true);
    const persist = await persistirVotosCPCEnBD(solicitudId, votosActualizados);
    setRegistrando(false);

    if (persist.ok) {
      toast.success('Voto registrado', {
        description: `${nombre} · ${CAT_DECISION_VOTO.find(d => d.value === decision)?.label} · Folio ${folio}`,
        duration: 7000,
      });
    } else {
      toast.warning('Voto registrado localmente, sin sincronizar aún', {
        description: persist.error + ' — otros miembros no lo verán hasta que la Solicitud se guarde.',
        duration: 10000,
      });
    }
  };

  const inputClass = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]';
  const conteo = conteoVotosCPC(datos.votos);
  const dLen = comentarios.trim().length;

  const colorDecision: Record<DecisionVoto, string> = {
    Aprobar: 'bg-green-100 text-green-800 border-green-300',
    Rechazar: 'bg-red-100 text-red-800 border-red-300',
    Devolver: 'bg-amber-100 text-amber-800 border-amber-300',
  };

  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="bg-teal-50 border border-teal-200 rounded px-3 py-2 mb-4">
        <p className="text-xs text-teal-800">
          <strong>Evaluación y Dictamen del CPC</strong> — cada miembro registra su voto
          desde su propia computadora. La identidad se guarda en este navegador; no
          requiere iniciar sesión aparte.
        </p>
      </div>

      {/* ═══ Bloque A — panel de votación ═══ */}
      {!isRO && (
        <>
          <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
            PANEL DE VOTACIÓN COLEGIADA
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 mb-4">
            <div>
              <label className="block text-xs text-gray-700 mb-1">Identidad (anónima)</label>
              <div className="px-2 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-700 font-medium">
                {votante}
              </div>
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                Asignada a este navegador para esta Solicitud — no se captura su nombre real.
              </span>
              {yaVoto && (
                <span className="text-[10px] text-amber-600 mt-0.5 block">
                  Este navegador ya registró un voto en esta Solicitud.
                </span>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1">Folio de Firma</label>
              <div className="px-2 py-1.5 text-xs bg-gray-50 border border-dashed border-gray-300 rounded text-gray-400 italic">
                Se genera automáticamente al registrar el voto
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-700 mb-1">
              Decisión <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-4">
              {CAT_DECISION_VOTO.map(d => (
                <label key={d.value} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="decisionCPC"
                    checked={decision === d.value}
                    onChange={() => setDecision(d.value)}
                    className="w-3.5 h-3.5 accent-[#4A6FA5]"
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-700 mb-1">
              Comentarios <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={comentarios}
              onChange={e => setComentarios(e.target.value)}
              placeholder="Fundamente su decisión..."
              className={`${inputClass} resize-y`}
            />
            <div className={`text-[10px] mt-0.5 text-right ${dLen < COMENTARIOS_MIN_CARACTERES ? 'text-amber-600' : 'text-green-600'}`}>
              {dLen} / {COMENTARIOS_MIN_CARACTERES} caracteres mínimos
            </div>
          </div>

          <div className="flex justify-end mb-5">
            <button
              onClick={registrarVoto}
              disabled={registrando}
              className="px-5 py-1.5 rounded text-xs font-medium bg-[#0F766E] text-white hover:bg-[#0D5F58] disabled:opacity-60"
            >
              {registrando ? 'Registrando…' : 'Registrar Voto en Plataforma'}
            </button>
          </div>
        </>
      )}

      {/* ═══ Votos registrados ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        VOTOS REGISTRADOS
      </div>
      {datos.votos.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-gray-400 border border-gray-200 mb-5">
          Aún no hay votos registrados.
        </div>
      ) : (
        <div className="border border-gray-300 overflow-x-auto mb-5">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2 text-left font-normal text-gray-700">VOTANTE</th>
                <th className="px-3 py-2 text-center font-normal text-gray-700">DECISIÓN</th>
                <th className="px-3 py-2 text-left font-normal text-gray-700">COMENTARIOS</th>
                <th className="px-3 py-2 text-left font-normal text-gray-700">FECHA</th>
                <th className="px-3 py-2 text-left font-normal text-gray-700">FOLIO</th>
              </tr>
            </thead>
            <tbody>
              {datos.votos.map((v, i) => (
                <tr key={v.id} className="border-b border-gray-200" style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFFFFF' }}>
                  <td className="px-3 py-1.5 text-gray-700 font-medium">{v.votante}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${colorDecision[v.decision]}`}>
                      {CAT_DECISION_VOTO.find(d => d.value === v.decision)?.label}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-gray-600">{v.comentarios.slice(0, 80)}{v.comentarios.length > 80 ? '…' : ''}</td>
                  <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{v.fecha}</td>
                  <td className="px-3 py-1.5 text-gray-400 font-mono whitespace-nowrap">{v.firmaToken || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Conteo — informativo, sin veredicto ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        CONTEO DE VOTOS
      </div>
      <div className="grid grid-cols-3 gap-3 mb-2">
        {CAT_DECISION_VOTO.map(d => (
          <div key={d.value} className={`px-3 py-2 rounded border text-center ${colorDecision[d.value]}`}>
            <div className="text-lg font-semibold">{conteo[d.value]}</div>
            <div className="text-[10px]">{d.label}</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400">
        Este conteo es informativo. El criterio para determinar el resultado colegiado
        (mayoría, quórum, desempate) aún no está definido — no bloquea el avance de fase
        ni sustituye la decisión del Comité.
      </p>
    </div>
  );
}
