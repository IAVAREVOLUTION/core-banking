/**
 * GeneracionContableTab.tsx
 * Catálogo real desde J_CATALOGO_EVENTOS_CONTABLES →
 * pick-map código/evento/prompt_ia/estatus → guarda en J_GL_JOURNAL_ENCABEZADO →
 * "Crear Póliza" lee motor contable del producto e inserta J_GL_JOURNAL_DETALLE
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoSrc from '../../../assets/7b6cb23c00b7817818c638af3eae0a416e1e9f57.png';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

const PRIMARY: [number, number, number] = [30, 64, 120];
const LIGHT:   [number, number, number] = [245, 247, 250];
const BORDER:  [number, number, number] = [200, 208, 220];
const PURPLE:  [number, number, number] = [109, 40, 217];

// ── Tipos ────────────────────────────────────────────────────────────────────

interface CatalogoEvento {
  id: string;
  codigo: string;
  evento: string;
  prompt_ia: string | null;
}

interface EventoContable {
  id: string;           // PK en J_GL_JOURNAL_ENCABEZADO
  codigo: string;
  evento: string;
  prompt_ia: string;
  estatus: 'Creado' | 'Procesado' | 'Error';
  poliza?: string;
  fecha: string;
  total_debit?: number;
  total_credit?: number;
}

interface Props {
  readonly solicitudId: string;
  readonly credito: { noSol: string; cliente: string; montoAut: number; tasa?: string; plazo?: string };
}

// ── PDF ──────────────────────────────────────────────────────────────────────

function generarPolizaPDFUrl(ev: EventoContable, credito: Props['credito']): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 42;

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 30, 'F');
  doc.setFillColor(...PURPLE);
  doc.rect(0, 30, W, 5, 'F');

  const LOGO_W = 28; const LOGO_H = 18;
  const LOGO_Y = (30 - LOGO_H) / 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(13, LOGO_Y - 1, LOGO_W + 2, LOGO_H + 2, 2, 2, 'F');
  doc.addImage(logoSrc, 'PNG', 14, LOGO_Y, LOGO_W, LOGO_H);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('PÓLIZA CONTABLE', 14 + LOGO_W + 6, 13);
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text(`Código: ${ev.codigo}`, 14 + LOGO_W + 6, 20);
  doc.text(`Generada: ${new Date().toLocaleString('es-MX')}`, W - 14, 9, { align: 'right' });
  doc.text(`Estatus: ${ev.estatus}`, W - 14, 15, { align: 'right' });
  doc.text(`Fecha: ${new Date(ev.fecha).toLocaleDateString('es-MX')}`, W - 14, 21, { align: 'right' });

  // Datos del evento
  doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...PRIMARY); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL EVENTO CONTABLE', 17, y + 5);
  y += 10;
  autoTable(doc, {
    startY: y, margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 } },
    head: [['Campo', 'Valor']],
    body: [
      ['Código',  ev.codigo],
      ['Evento',  ev.evento],
      ['Estatus', ev.estatus],
      ['Fecha',   new Date(ev.fecha).toLocaleDateString('es-MX')],
      ['Débito Total',  ev.total_debit  ? `$${Number(ev.total_debit).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'],
      ['Crédito Total', ev.total_credit ? `$${Number(ev.total_credit).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Crédito
  doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER);
  doc.rect(14, y, W - 28, 7, 'FD');
  doc.setTextColor(...PRIMARY); doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL CRÉDITO', 17, y + 5);
  y += 10;
  autoTable(doc, {
    startY: y, margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 } },
    head: [['Campo', 'Valor']],
    body: [
      ['No. Solicitud', credito.noSol || '—'],
      ['Cliente', credito.cliente || '—'],
      ['Monto Autorizado', credito.montoAut > 0 ? `$${credito.montoAut.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'],
      ['Tasa',  credito.tasa  || '—'],
      ['Plazo', credito.plazo ? `${credito.plazo} meses` : '—'],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Póliza generada
  if (ev.poliza) {
    const pageH = doc.internal.pageSize.getHeight();
    if (y > pageH - 70) { doc.addPage(); y = 20; }
    doc.setFillColor(...PURPLE);
    doc.rect(14, y, W - 28, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('PÓLIZA CONTABLE GENERADA', 17, y + 5);
    y += 10;
    const polizaLines = doc.splitTextToSize(ev.poliza, W - 36);
    const boxH = polizaLines.length * 4 + 8;
    doc.setFillColor(20, 20, 30);
    doc.roundedRect(14, y, W - 28, boxH, 2, 2, 'F');
    doc.setTextColor(100, 220, 130); doc.setFont('courier', 'normal'); doc.setFontSize(7);
    doc.text(polizaLines, 18, y + 5);
  }

  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...BORDER);
  doc.line(14, pageH - 12, W - 14, pageH - 12);
  doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.text('Documento generado automáticamente — Sistema Core Banking', 14, pageH - 7);
  doc.text(new Date().toLocaleString('es-MX'), W - 14, pageH - 7, { align: 'right' });

  return doc.output('bloburl');
}

// ── Helpers sessionStorage (fallback cuando solicitudId no es UUID de J_CUENTAS) ──
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ssKey  = (id: string) => `contable_eventos_${id}`;
const ssLoad = (id: string): EventoContable[] => { try { return JSON.parse(sessionStorage.getItem(ssKey(id)) || '[]'); } catch { return []; } };
const ssSave = (id: string, ev: EventoContable[]) => { try { sessionStorage.setItem(ssKey(id), JSON.stringify(ev)); } catch { /* noop */ } };

// ── Componente ────────────────────────────────────────────────────────────────

export function GeneracionContableTab({ solicitudId, credito }: Props) {
  const [catalogo,       setCatalogo]      = useState<CatalogoEvento[]>([]);
  const [cargandoCat,    setCargandoCat]   = useState(false);
  const [eventos,        setEventos]       = useState<EventoContable[]>([]);
  const [showModal,      setShowModal]     = useState(false);
  const [selIdx,         setSelIdx]        = useState(0);
  const [creando,        setCreando]       = useState(false);
  const [ejecutando,     setEjecutando]    = useState<string | null>(null);
  const [polizaUrl,      setPolizaUrl]     = useState<string | null>(null);
  const [polizaEvento,   setPolizaEvento]  = useState<EventoContable | null>(null);

  const esUUID = UUID_RE.test(solicitudId || '');

  // ── Cargar catálogo real desde BD ──────────────────────────────────────────
  const cargarCatalogo = useCallback(async () => {
    setCargandoCat(true);
    try {
      const res = await fetch(`${API_BASE}/contable/catalogo`, { headers: HDR });
      const j = await res.json();
      if (Array.isArray(j?.data) && j.data.length > 0) {
        setCatalogo(j.data);
        setSelIdx(0);
      }
    } catch { /* silencioso */ } finally {
      setCargandoCat(false);
    }
  }, []);

  useEffect(() => { cargarCatalogo(); }, [cargarCatalogo]);

  // ── Cargar eventos guardados ───────────────────────────────────────────────
  const cargar = useCallback(async () => {
    if (!esUUID) { setEventos(ssLoad(solicitudId)); return; }
    try {
      const res = await fetch(`${API_BASE}/contable/eventos/${solicitudId}`, { headers: HDR });
      if (res.ok) {
        const j = await res.json();
        const data: EventoContable[] = j.data || [];
        setEventos(data);
        ssSave(solicitudId, data);
      } else {
        setEventos(ssLoad(solicitudId));
      }
    } catch { setEventos(ssLoad(solicitudId)); }
  }, [solicitudId, esUUID]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Crear evento (pick-map) ────────────────────────────────────────────────
  const handleCrear = async () => {
    const cat = catalogo[selIdx];
    if (!cat) return;
    setCreando(true);
    try {
      const nuevoEvento: EventoContable = {
        id:       crypto.randomUUID(),
        codigo:   cat.codigo,
        evento:   cat.evento,
        prompt_ia: cat.prompt_ia || '',
        estatus:  'Creado',
        fecha:    new Date().toISOString(),
      };

      if (esUUID) {
        const res = await fetch(`${API_BASE}/contable/eventos`, {
          method: 'POST', headers: HDR,
          body: JSON.stringify({
            solicitud_id: solicitudId,
            catalogo_id:  cat.id,
            codigo:       cat.codigo,
            evento:       cat.evento,
            prompt_ia:    cat.prompt_ia || '',
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      } else {
        const ac = ssLoad(solicitudId);
        ac.push(nuevoEvento);
        ssSave(solicitudId, ac);
      }

      toast.success('Evento contable creado', { description: cat.evento });
      setShowModal(false);
      cargar();
    } catch (e: any) {
      toast.error('Error al crear evento', { description: e.message });
    } finally {
      setCreando(false);
    }
  };

  // ── Crear Póliza ──────────────────────────────────────────────────────────
  const handleCrearPoliza = async (ev: EventoContable) => {
    setEjecutando(ev.id);
    try {
      const contexto = `Crédito No. ${credito.noSol} · Cliente: ${credito.cliente} · Monto: $${credito.montoAut.toLocaleString('es-MX')} · Tasa: ${credito.tasa || 'N/A'}% · Plazo: ${credito.plazo || 'N/A'} meses`;

      if (esUUID) {
        const res = await fetch(`${API_BASE}/contable/eventos/${ev.id}/ejecutar`, {
          method: 'POST', headers: HDR,
          body: JSON.stringify({ solicitud_id: solicitudId, contexto, prompt_ia: ev.prompt_ia }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      } else {
        const polizaLocal = `[Póliza local]\n\nEvento: ${ev.evento} (${ev.codigo})\nContexto: ${contexto}\nFecha: ${new Date().toLocaleString('es-MX')}`;
        const ac = ssLoad(solicitudId).map(e =>
          e.id === ev.id ? { ...e, estatus: 'Procesado' as const, poliza: polizaLocal } : e
        );
        ssSave(solicitudId, ac);
      }

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

  const catSel = catalogo[selIdx];

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {eventos.length} evento{eventos.length === 1 ? '' : 's'} contable{eventos.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={cargar} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/>
            </svg>
            Actualizar
          </button>
          <button
            onClick={() => { if (catalogo.length === 0) { cargarCatalogo(); } setSelIdx(0); setShowModal(true); }}
            className="px-3 py-1.5 text-xs font-medium rounded border border-[#4A6FA5] bg-[#4A6FA5] text-white hover:bg-[#3A5A8A] flex items-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5.5 1v9M1 5.5h9"/>
            </svg>
            NUEVO
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
              <th className="px-3 py-2.5 text-left font-medium">Prompt IA</th>
              <th className="px-3 py-2.5 text-center font-medium">Estatus</th>
              <th className="px-3 py-2.5 text-center font-medium w-40">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {eventos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-gray-400">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-2">
                    <rect x="4" y="4" width="24" height="24" rx="2"/>
                    <path d="M10 16h12M16 10v12" strokeLinecap="round"/>
                  </svg>
                  <p>Sin eventos contables. Presione NUEVO para agregar uno.</p>
                </td>
              </tr>
            ) : eventos.map((ev, idx) => (
              <tr key={ev.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-3 py-2.5 font-mono text-gray-600 whitespace-nowrap">{ev.codigo}</td>
                <td className="px-3 py-2.5 text-gray-800 font-medium">{ev.evento}</td>
                <td className="px-3 py-2.5 text-gray-500 max-w-[220px]">
                  <span className="line-clamp-2 leading-tight">{ev.prompt_ia || '—'}</span>
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
                        onClick={() => { setPolizaUrl(generarPolizaPDFUrl(ev, credito)); setPolizaEvento(ev); }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                      >
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M1 4.5s1.5-3 3.5-3 3.5 3 3.5 3-1.5 3-3.5 3-3.5-3-3.5-3z"/>
                          <circle cx="4.5" cy="4.5" r="1.2"/>
                        </svg>
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

      {/* Modal Ver Póliza PDF */}
      {polizaUrl && polizaEvento && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl h-[88vh] flex flex-col border border-gray-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-purple-700 rounded-t-xl shrink-0">
              <div>
                <h4 className="text-sm font-bold text-white">{polizaEvento.evento}</h4>
                <p className="text-[11px] text-purple-200 mt-0.5">{polizaEvento.codigo} · {new Date(polizaEvento.fecha).toLocaleDateString('es-MX')}</p>
              </div>
              <button onClick={() => { setPolizaUrl(null); setPolizaEvento(null); }} className="text-white/70 hover:text-white">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l10 10M13 3L3 13"/></svg>
              </button>
            </div>
            <iframe src={polizaUrl} className="w-full flex-1 rounded-b-xl" title="Póliza Contable PDF" />
          </div>
        </div>
      )}

      {/* Modal Nuevo Evento — catálogo real desde BD */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-[#2E5C91] rounded-t-xl shrink-0">
              <h4 className="text-sm font-bold text-white">Nuevo Evento Contable</h4>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {catalogo.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  {cargandoCat ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-[#4A6FA5]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/></svg>
                      <p className="text-xs text-gray-400">Cargando catálogo...</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">No se pudo cargar el catálogo.</p>
                      <button onClick={cargarCatalogo} className="text-xs text-blue-600 hover:underline">Reintentar</button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">Selecciona un Evento Contable</p>
                  <div className="space-y-2">
                    {catalogo.map((cat, i) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelIdx(i)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${
                          selIdx === i
                            ? 'border-[#4A6FA5] bg-[#4A6FA5] text-white'
                            : 'border-gray-200 bg-white hover:border-[#4A6FA5]/40 text-gray-700'
                        }`}
                      >
                        <span className={`font-mono text-[10px] mr-2 ${selIdx === i ? 'text-blue-200' : 'text-gray-400'}`}>{cat.codigo}</span>
                        {cat.evento}
                      </button>
                    ))}
                  </div>

                  {/* Pick-map preview: código, evento, prompt_ia, estatus */}
                  {catSel && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 text-xs">
                      <p className="text-[10px] font-medium text-gray-600 uppercase tracking-wide mb-1">Campos que se registrarán</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-gray-500">Código:</span>
                        <span className="font-mono text-gray-800">{catSel.codigo}</span>
                        <span className="text-gray-500">Evento:</span>
                        <span className="text-gray-800">{catSel.evento}</span>
                        <span className="text-gray-500">Estatus:</span>
                        <span className="text-amber-700 font-medium">Creado</span>
                      </div>
                      {catSel.prompt_ia && (
                        <div>
                          <p className="text-[10px] text-gray-500 font-medium mb-0.5">Prompt IA:</p>
                          <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-3">{catSel.prompt_ia}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-2 shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
              <button
                onClick={handleCrear}
                disabled={creando || catalogo.length === 0}
                className="px-5 py-1.5 text-xs bg-[#2E5C91] text-white rounded-lg hover:bg-[#245080] disabled:opacity-50 font-medium"
              >
                {creando ? 'Creando...' : 'Crear Evento'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
