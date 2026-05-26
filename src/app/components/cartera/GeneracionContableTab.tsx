/**
 * GeneracionContableTab.tsx
 *
 * Sub-pestaña "Generación Contable" — usada en Solicitudes de Activación,
 * Cartera y Cobranza.
 *
 * Flujo (Prompts 2-5):
 *  1. Lista de eventos guardados para esta entidad (J_GL_JOURNAL_ENCABEZADO).
 *  2. Botón "Nuevo" → modal con selector Evento Contable (catálogo real) + Fecha.
 *  3. Guardar → crea registro con estatus "Capturado".
 *  4. Columna Opciones → botón "Generar Póliza" (solo si estatus = "Capturado").
 *  5. Generar Póliza:
 *       a. Lee los componentes del Detail (pasados por prop o fallback al monto global).
 *       b. Llama a POST /contable/generar-poliza en el edge function.
 *       c. Si éxito → marca registro como "Procesado".
 *       d. Si error (ej. sin configuración en motor) → muestra error.
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface CatalogoEvento {
  id: string;
  codigo: string;
  evento: string;
}

interface EventoContable {
  id: string;
  evento_id: string;
  evento_codigo: string;
  evento_nombre: string;
  fecha: string;
  estatus: 'Capturado' | 'Procesado' | 'Error';
  journal_id?: string;
}

/** Componente contable para la generación (Sub Producto + Monto del Detail). */
export interface ComponenteContable {
  id_componente: string;
  monto: number;
}

interface Props {
  /** UUID de J_CUENTAS_CORP_CLIENTES (account_id) */
  readonly solicitudId: string;
  readonly credito: {
    noSol: string;
    cliente: string;
    montoAut: number;
    tasa?: string;
    plazo?: string;
  };
  /**
   * Componentes y montos del Detail de la entidad (CxC/CxP).
   * Si no se proveen, se usa [{id_componente: 'CAPITAL', monto: credito.montoAut}] como fallback.
   */
  readonly componentes?: ComponenteContable[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ssKey  = (id: string) => `gen_contable_eventos_${id}`;
const ssLoad = (id: string): EventoContable[] => {
  try { return JSON.parse(sessionStorage.getItem(ssKey(id)) || '[]'); } catch { return []; }
};
const ssSave = (id: string, data: EventoContable[]) => {
  try { sessionStorage.setItem(ssKey(id), JSON.stringify(data)); } catch { /* noop */ }
};

const fmt = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtFecha = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
};

const ESTATUS_CLS: Record<string, string> = {
  Capturado: 'bg-amber-50 text-amber-700 border-amber-200',
  Procesado: 'bg-green-50 text-green-700 border-green-200',
  Error:     'bg-red-50 text-red-700 border-red-200',
};

// ── Componente ─────────────────────────────────────────────────────────────────

export function GeneracionContableTab({ solicitudId, credito, componentes }: Props) {
  const isUUID = UUID_RE.test(solicitudId || '');

  // ── Catálogo de eventos ────────────────────────────────────────────
  const [catalogo, setCatalogo] = useState<CatalogoEvento[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  const cargarCatalogo = useCallback(async () => {
    setCatLoading(true);
    try {
      const res = await fetch(`${API_BASE}/eventos-contables`, { headers: HDR });
      const j   = await res.json();
      if (Array.isArray(j?.data)) setCatalogo(j.data);
    } catch { /* silencioso */ } finally { setCatLoading(false); }
  }, []);

  useEffect(() => { cargarCatalogo(); }, [cargarCatalogo]);

  // ── Lista de eventos guardados ────────────────────────────────────
  const [eventos, setEventos] = useState<EventoContable[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(false);

  const cargarEventos = useCallback(async () => {
    if (!isUUID) { setEventos(ssLoad(solicitudId)); return; }
    setLoadingEventos(true);
    try {
      const res = await fetch(`${API_BASE}/contable/eventos/${solicitudId}`, { headers: HDR });
      if (res.ok) {
        const j = await res.json();
        const rows: EventoContable[] = (j.data || []).map((r: any) => ({
          id:            r.id,
          evento_id:     r.data?.catalogo_id || r.data?.evento_id || '',
          evento_codigo: r.codigo  || '',
          evento_nombre: r.evento  || r.codigo || '',
          fecha:         r.fecha   || '',
          estatus:       mapEstatus(r.estatus),
          journal_id:    r.id,
        }));
        setEventos(rows);
        ssSave(solicitudId, rows);
      } else {
        setEventos(ssLoad(solicitudId));
      }
    } catch { setEventos(ssLoad(solicitudId)); } finally { setLoadingEventos(false); }
  }, [solicitudId, isUUID]);

  useEffect(() => { cargarEventos(); }, [cargarEventos]);

  // ── Modal Nuevo ────────────────────────────────────────────────────
  const [showModal, setShowModal]   = useState(false);
  const [selIdx,    setSelIdx]      = useState(0);
  const [fechaNuevo, setFechaNuevo] = useState(() => new Date().toISOString().slice(0, 16));
  const [guardando, setGuardando]   = useState(false);

  const handleGuardar = async () => {
    const cat = catalogo[selIdx];
    if (!cat) return;
    setGuardando(true);
    try {
      const nuevoLocal: EventoContable = {
        id:            crypto.randomUUID(),
        evento_id:     cat.id,
        evento_codigo: cat.codigo,
        evento_nombre: cat.evento,
        fecha:         new Date(fechaNuevo).toISOString(),
        estatus:       'Capturado',
      };

      if (isUUID) {
        // Usa /contable/eventos — resuelve producto_id y currency desde la cuenta financiera
        const res = await fetch(`${API_BASE}/contable/eventos`, {
          method: 'POST', headers: HDR,
          body: JSON.stringify({
            solicitud_id: solicitudId,
            catalogo_id:  cat.id,
            codigo:       cat.codigo,
            evento:       cat.evento,
            prompt_ia:    '',
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        nuevoLocal.id         = j.id || nuevoLocal.id;
        nuevoLocal.journal_id = j.id;
      } else {
        const ac = ssLoad(solicitudId);
        ac.push(nuevoLocal);
        ssSave(solicitudId, ac);
      }

      toast.success('Evento contable registrado', { description: cat.evento });
      setShowModal(false);
      cargarEventos();
    } catch (e: any) {
      toast.error('Error al guardar el evento', { description: e.message });
    } finally {
      setGuardando(false);
    }
  };

  // ── Generar Póliza ────────────────────────────────────────────────
  const [generando, setGenerando] = useState<string | null>(null);
  const [confirmEv, setConfirmEv] = useState<EventoContable | null>(null);

  const handleGenerarPoliza = async (ev: EventoContable) => {
    setGenerando(ev.id);
    try {
      // Construir lista de componentes
      const comps: ComponenteContable[] = componentes && componentes.length > 0
        ? componentes.filter(c => c.monto > 0)
        : [{ id_componente: 'CAPITAL', monto: credito.montoAut }];

      if (!isUUID) {
        // Modo local (sesión) — simular generación
        const updated = ssLoad(solicitudId).map(e =>
          e.id === ev.id ? { ...e, estatus: 'Procesado' as const } : e
        );
        ssSave(solicitudId, updated);
        setEventos(updated);
        toast.success('Póliza generada (modo local)', { description: ev.evento_nombre });
        return;
      }

      const res = await fetch(`${API_BASE}/contable/eventos/${ev.id}/ejecutar`, {
        method: 'POST', headers: HDR,
        body: JSON.stringify({
          solicitud_id: solicitudId,
          componentes:  comps,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);

      toast.success('Póliza contable generada', {
        description: `${j.lineas} líneas · ${fmt(j.total_debit ?? 0)}`,
      });
      cargarEventos();
    } catch (e: any) {
      toast.error('Error al generar póliza', { description: e.message });
    } finally {
      setGenerando(null);
      setConfirmEv(null);
    }
  };

  const catSel = catalogo[selIdx];

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {loadingEventos
            ? 'Cargando...'
            : `${eventos.length} evento${eventos.length !== 1 ? 's' : ''} contable${eventos.length !== 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={cargarEventos}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/>
            </svg>
            Actualizar
          </button>
          <button
            onClick={() => {
              if (catalogo.length === 0) cargarCatalogo();
              setSelIdx(0);
              setFechaNuevo(new Date().toISOString().slice(0, 16));
              setShowModal(true);
            }}
            className="px-3 py-1.5 text-xs font-medium rounded border border-[#4A6FA5] bg-[#4A6FA5] text-white hover:bg-[#3A5A8A] flex items-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5.5 1v9M1 5.5h9"/>
            </svg>
            Nuevo
          </button>
        </div>
      </div>

      {/* Tabla de eventos */}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#2E5C91] text-white">
              <th className="px-3 py-2.5 text-left font-medium">Evento Contable</th>
              <th className="px-3 py-2.5 text-left font-medium">Fecha</th>
              <th className="px-3 py-2.5 text-center font-medium w-28">Estatus</th>
              <th className="px-3 py-2.5 text-center font-medium w-36">Opciones</th>
            </tr>
          </thead>
          <tbody>
            {loadingEventos ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                  <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-[#4A6FA5]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/>
                  </svg>
                  Cargando eventos...
                </td>
              </tr>
            ) : eventos.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-gray-400">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-2">
                    <rect x="4" y="4" width="24" height="24" rx="2"/>
                    <path d="M10 16h12M16 10v12" strokeLinecap="round"/>
                  </svg>
                  <p>Sin eventos contables. Presione <strong>Nuevo</strong> para registrar uno.</p>
                </td>
              </tr>
            ) : eventos.map((ev, idx) => (
              <tr key={ev.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-3 py-2.5 text-gray-800 font-medium">
                  <span className="font-mono text-[10px] text-gray-400 mr-1.5">{ev.evento_codigo}</span>
                  {ev.evento_nombre}
                </td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                  {fmtFecha(ev.fecha)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTATUS_CLS[ev.estatus] || ''}`}>
                    {ev.estatus}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  {ev.estatus === 'Capturado' ? (
                    <button
                      onClick={() => setConfirmEv(ev)}
                      disabled={generando === ev.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-[#2E5C91] text-white hover:bg-[#24497A] disabled:opacity-50 mx-auto"
                    >
                      {generando === ev.id ? (
                        <svg className="animate-spin h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="1" y="1" width="7" height="7" rx="1"/>
                          <path d="M1 3.5h7M3.5 1v7M1 6h7" strokeLinecap="round"/>
                        </svg>
                      )}
                      Generar Póliza
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">
                      {ev.estatus === 'Procesado' ? '✓ Póliza generada' : ev.estatus}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Componentes que se contabilizarán */}
      {componentes && componentes.length > 0 && (
        <details className="border border-gray-200 rounded text-xs">
          <summary className="px-3 py-2 cursor-pointer text-gray-500 select-none hover:bg-gray-50">
            Componentes a contabilizar ({componentes.filter(c => c.monto > 0).length})
          </summary>
          <div className="px-3 pb-2 pt-1 space-y-0.5">
            {componentes.filter(c => c.monto > 0).map((c, i) => (
              <div key={i} className="flex justify-between text-gray-700">
                <span className="font-medium">{c.id_componente}</span>
                <span className="font-mono">{fmt(c.monto)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Modal Nuevo Evento ──────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !guardando && setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-[#2E5C91] rounded-t-xl shrink-0">
              <h4 className="text-sm font-bold text-white">Nuevo Evento Contable</h4>
              <button onClick={() => setShowModal(false)} disabled={guardando} className="text-white/70 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l8 8M11 3l-8 8"/>
                </svg>
              </button>
            </div>

            {/* Body modal */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Evento Contable */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Evento Contable <span className="text-red-500 normal-case font-normal">*</span>
                </label>
                {catLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/>
                    </svg>
                    Cargando catálogo...
                  </div>
                ) : catalogo.length === 0 ? (
                  <div className="text-xs text-gray-500 py-2">
                    No hay eventos en el catálogo.{' '}
                    <button onClick={cargarCatalogo} className="text-blue-600 hover:underline">Reintentar</button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {catalogo.map((cat, i) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelIdx(i)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                          selIdx === i
                            ? 'border-[#4A6FA5] bg-[#4A6FA5] text-white'
                            : 'border-gray-200 bg-white hover:border-[#4A6FA5]/40 text-gray-700'
                        }`}
                      >
                        <span className={`font-mono text-[10px] mr-2 ${selIdx === i ? 'text-blue-200' : 'text-gray-400'}`}>
                          {cat.codigo}
                        </span>
                        {cat.evento}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Fecha <span className="text-red-500 normal-case font-normal">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={fechaNuevo}
                  onChange={e => setFechaNuevo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-[#4A6FA5]"
                />
              </div>

              {/* Estatus (sólo lectura en el modal) */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Estatus
                </label>
                <div className="px-2.5 py-1.5 text-xs border border-gray-200 rounded bg-gray-50">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-50 text-amber-700 border-amber-200">
                    Capturado
                  </span>
                </div>
              </div>

              {/* Preview del evento seleccionado */}
              {catSel && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs space-y-1">
                  <p className="text-[10px] font-semibold text-blue-700 uppercase">Evento seleccionado</p>
                  <div className="flex gap-2">
                    <span className="text-blue-500 min-w-[60px]">Código:</span>
                    <span className="font-mono text-blue-900">{catSel.codigo}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-500 min-w-[60px]">Evento:</span>
                    <span className="text-blue-900">{catSel.evento}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowModal(false)}
                disabled={guardando}
                className="px-4 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando || catalogo.length === 0}
                className="px-5 py-1.5 text-xs bg-[#2E5C91] text-white rounded-lg hover:bg-[#245080] disabled:opacity-50 font-medium"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Generar Póliza ──────────────────────────── */}
      {confirmEv && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => generando === null && setConfirmEv(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-[#2E5C91] rounded-t-xl">
              <h4 className="text-sm font-bold text-white">Confirmar Generación de Póliza</h4>
              <button
                onClick={() => setConfirmEv(null)}
                disabled={!!generando}
                className="text-white/70 hover:text-white disabled:opacity-40"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l8 8M11 3l-8 8"/>
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 text-xs text-gray-700">
              <p>
                Se generará la <strong>Póliza Contable</strong> para el evento:
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2.5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Evento:</span>
                  <span className="font-medium">{confirmEv.evento_nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Código:</span>
                  <span className="font-mono">{confirmEv.evento_codigo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-medium">{credito.cliente || '—'}</span>
                </div>
              </div>

              {/* Componentes que se contabilizarán */}
              <div>
                <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Componentes a contabilizar
                </p>
                <div className="border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-2.5 py-1.5 text-left font-medium text-gray-600">Componente</th>
                        <th className="px-2.5 py-1.5 text-right font-medium text-gray-600">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(componentes && componentes.filter(c => c.monto > 0).length > 0
                        ? componentes.filter(c => c.monto > 0)
                        : [{ id_componente: 'CAPITAL', monto: credito.montoAut }]
                      ).map((c, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2.5 py-1.5 font-medium text-gray-800">{c.id_componente}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-gray-800">{fmt(c.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-gray-500 text-[11px]">
                El sistema consultará el Motor Contable del producto y creará los registros de
                Débito y Crédito correspondientes. La póliza quedará visible en{' '}
                <strong>Pólizas Contables</strong>.
              </p>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setConfirmEv(null)}
                disabled={!!generando}
                className="px-4 py-1.5 text-xs border border-gray-200 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleGenerarPoliza(confirmEv)}
                disabled={!!generando}
                className="flex items-center gap-1.5 px-5 py-1.5 text-xs bg-[#2E5C91] text-white rounded hover:bg-[#245080] disabled:opacity-50 font-medium"
              >
                {generando === confirmEv.id ? (
                  <>
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="6" cy="6" r="5" strokeDasharray="20" strokeDashoffset="10"/>
                    </svg>
                    Generando...
                  </>
                ) : 'Confirmar y Generar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Helpers internos ───────────────────────────────────────────────────────────

function mapEstatus(status: string): EventoContable['estatus'] {
  const s = (status || '').toLowerCase();
  if (s === 'procesado' || s === 'procesada') return 'Procesado';
  if (s === 'error')                           return 'Error';
  return 'Capturado';
}
