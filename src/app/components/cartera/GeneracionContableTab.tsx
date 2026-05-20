/**
 * GeneracionContableTab.tsx — Generación de Eventos Contables por crédito
 * Catálogo → crear evento (estatus=Creado) → Crear Póliza via IA
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

// Catálogo estático de eventos contables (ampliable desde BD)
const CATALOGO_EVENTOS = [
  { codigo: 'EVT-001', evento: 'Dispersión de Crédito',         prompt: 'Genera la póliza contable para la dispersión del crédito con los montos de capital e intereses.' },
  { codigo: 'EVT-002', evento: 'Cobro de Interés Ordinario',    prompt: 'Genera la póliza contable para el cobro del interés ordinario mensual del crédito.' },
  { codigo: 'EVT-003', evento: 'Pago de Capital',               prompt: 'Genera la póliza contable para el abono a capital del crédito.' },
  { codigo: 'EVT-004', evento: 'Provisión de Interés',          prompt: 'Genera la póliza contable para la provisión mensual de interés devengado.' },
  { codigo: 'EVT-005', evento: 'Cancelación de Crédito',        prompt: 'Genera la póliza contable para la cancelación total del crédito, incluyendo castigo de saldo.' },
  { codigo: 'EVT-006', evento: 'Reestructura de Crédito',       prompt: 'Genera la póliza contable para la reestructura del crédito con nuevas condiciones.' },
  { codigo: 'EVT-007', evento: 'Cargo por Mora',                prompt: 'Genera la póliza contable para el cargo de interés moratorio por pago tardío.' },
];

interface EventoContable {
  id: string;
  codigo: string;
  evento: string;
  prompt: string;
  estatus: 'Creado' | 'Procesado' | 'Error';
  poliza?: string;
  fecha: string;
}

interface Props {
  solicitudId: string;
  credito: { noSol: string; cliente: string; montoAut: number; tasa?: string; plazo?: string };
}

export function GeneracionContableTab({ solicitudId, credito }: Props) {
  const [eventos, setEventos] = useState<EventoContable[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [eventoSelIdx, setEventoSelIdx] = useState(0);
  const [creando, setCreando] = useState(false);
  const [ejecutando, setEjecutando] = useState<string | null>(null);
  const [verPoliza, setVerPoliza] = useState<EventoContable | null>(null);

  // Cargar eventos guardados (almacenados en edge function via JSONB)
  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/cartera/contable/${solicitudId}`, { headers: HDR });
      if (res.ok) {
        const json = await res.json();
        setEventos(json.data || []);
      }
    } catch { /* sin eventos previos */ }
  }, [solicitudId]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleCrearEvento = async () => {
    const cat = CATALOGO_EVENTOS[eventoSelIdx];
    setCreando(true);
    try {
      const res = await fetch(`${API_BASE}/cartera/contable`, {
        method: 'POST',
        headers: HDR,
        body: JSON.stringify({
          solicitud_id: solicitudId,
          codigo: cat.codigo,
          evento: cat.evento,
          prompt: cat.prompt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success('Evento contable creado', { description: cat.evento });
      setShowModal(false);
      cargar();
    } catch (e: any) {
      toast.error('Error al crear evento', { description: e.message });
    } finally {
      setCreando(false);
    }
  };

  const handleCrearPoliza = async (ev: EventoContable) => {
    setEjecutando(ev.id);
    try {
      const contexto = `Crédito No. ${credito.noSol} · Cliente: ${credito.cliente} · Monto: $${credito.montoAut.toLocaleString('es-MX')} · Tasa: ${credito.tasa || 'N/A'}% · Plazo: ${credito.plazo || 'N/A'} meses`;
      const res = await fetch(`${API_BASE}/cartera/contable/${ev.id}/ejecutar`, {
        method: 'POST',
        headers: HDR,
        body: JSON.stringify({ solicitud_id: solicitudId, contexto, prompt: ev.prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success('Póliza generada', { description: ev.evento });
      cargar();
    } catch (e: any) {
      toast.error('Error al generar póliza', { description: e.message });
    } finally {
      setEjecutando(null);
    }
  };

  const ESTATUS_COLOR: Record<string, string> = {
    Creado:    'bg-amber-50 text-amber-700 border-amber-200',
    Procesado: 'bg-green-50 text-green-700 border-green-200',
    Error:     'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{eventos.length} evento{eventos.length !== 1 ? 's' : ''} contable{eventos.length !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-2">
          <button onClick={cargar} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/></svg>
            Actualizar
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 text-xs font-medium rounded border border-[#4A6FA5] bg-[#4A6FA5] text-white hover:bg-[#3A5A8A] flex items-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5.5 1v9M1 5.5h9"/></svg>
            Nuevo Evento Contable
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#2E5C91] text-white">
              <th className="px-3 py-2.5 text-left font-medium">Código</th>
              <th className="px-3 py-2.5 text-left font-medium">Evento</th>
              <th className="px-3 py-2.5 text-left font-medium">Fecha</th>
              <th className="px-3 py-2.5 text-center font-medium">Estatus</th>
              <th className="px-3 py-2.5 text-center font-medium w-40">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {eventos.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-2">
                  <rect x="4" y="4" width="24" height="24" rx="2"/><path d="M10 16h12M16 10v12" strokeLinecap="round"/>
                </svg>
                <p className="text-xs">Sin eventos contables. Cree uno con el catálogo.</p>
              </td></tr>
            ) : eventos.map((ev, idx) => (
              <tr key={ev.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-3 py-2.5 font-mono text-gray-600">{ev.codigo}</td>
                <td className="px-3 py-2.5 text-gray-800 font-medium">{ev.evento}</td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                  {new Date(ev.fecha).toLocaleDateString('es-MX')}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTATUS_COLOR[ev.estatus] || ''}`}>
                    {ev.estatus}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {ev.estatus === 'Creado' && (
                      <button
                        onClick={() => handleCrearPoliza(ev)}
                        disabled={ejecutando === ev.id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {ejecutando === ev.id
                          ? <svg className="animate-spin h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/></svg>
                          : <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4.5h7M5 1l3 3.5-3 3.5" strokeLinecap="round"/></svg>
                        }
                        Crear Póliza
                      </button>
                    )}
                    {ev.poliza && (
                      <button
                        onClick={() => setVerPoliza(ev)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                      >
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4.5s1.5-3 3.5-3 3.5 3 3.5 3-1.5 3-3.5 3-3.5-3-3.5-3z"/><circle cx="4.5" cy="4.5" r="1.2"/></svg>
                        Ver Póliza
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Evento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-[#2E5C91] rounded-t-xl">
              <h4 className="text-sm font-bold text-white">Nuevo Evento Contable</h4>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Evento Contable</label>
                <div className="space-y-2">
                  {CATALOGO_EVENTOS.map((cat, i) => (
                    <button
                      key={cat.codigo}
                      onClick={() => setEventoSelIdx(i)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${
                        eventoSelIdx === i
                          ? 'border-[#4A6FA5] bg-[#4A6FA5] text-white'
                          : 'border-gray-200 bg-white hover:border-[#4A6FA5]/40 text-gray-700'
                      }`}
                    >
                      <span className={`font-mono text-[10px] mr-2 ${eventoSelIdx === i ? 'text-blue-200' : 'text-gray-400'}`}>{cat.codigo}</span>
                      {cat.evento}
                    </button>
                  ))}
                </div>
              </div>
              {eventoSelIdx >= 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] text-gray-500">
                  <span className="font-medium text-gray-700 block mb-1">Prompt IA:</span>
                  {CATALOGO_EVENTOS[eventoSelIdx].prompt}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={handleCrearEvento} disabled={creando} className="px-5 py-1.5 text-xs bg-[#2E5C91] text-white rounded-lg hover:bg-[#245080] disabled:opacity-50 font-medium">
                {creando ? 'Creando...' : 'Crear Evento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Póliza */}
      {verPoliza && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setVerPoliza(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-purple-700 rounded-t-xl">
              <div>
                <h4 className="text-sm font-bold text-white">{verPoliza.evento}</h4>
                <p className="text-[11px] text-purple-200 mt-0.5">{verPoliza.codigo} · {new Date(verPoliza.fecha).toLocaleDateString('es-MX')}</p>
              </div>
              <button onClick={() => setVerPoliza(null)} className="text-white/70 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
              </button>
            </div>
            <div className="p-5 overflow-auto">
              <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-4 whitespace-pre-wrap font-mono leading-relaxed">
                {verPoliza.poliza}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
