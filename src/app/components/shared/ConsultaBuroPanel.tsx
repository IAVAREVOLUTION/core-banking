/**
 * Panel "Consulta Buró de Crédito" reutilizable (Personas).
 * Tabla de consultas + modal de consulta con autorización + reporte (PDF) + XML.
 * La consulta y el reporte vienen de lib/buroSimulado.
 */
import { useState } from 'react';
import { FileText, FileCode, Download, Copy } from 'lucide-react';
import { toast } from '@/app/lib/notificaciones';
import { getUsuarioSesion } from '@/app/lib/sesion';
import { consultarBuroSimulado, validarDatosConsulta, reporteBuroAXml } from '@/app/lib/buroSimulado';
import type { ReporteBuro, AutorizacionBuro, DatosConsultaBuro, ResultadoBuro } from '@/app/lib/buroSimulado';
import { ReporteBuroVista } from './ReporteBuroVista';
import { DatePicker } from '@/app/components/ui/DatePicker';

export interface ConsultaBuroRegistro {
  id: number;
  fechaHora: string;
  usuario: string;
  tipoConsulta: string;
  estatus: string;
  xmlResultado: string;
  folio?: string;
  score?: number | null;
  reporte?: ReporteBuro;
}

interface Props {
  consultas: ConsultaBuroRegistro[];
  onChange: (consultas: ConsultaBuroRegistro[]) => void;
  datos: DatosConsultaBuro;
  isView?: boolean;
  /** Se llama con el resultado de cada consulta nueva (estatus SIC de la persona). */
  onResultado?: (resultado: ResultadoBuro) => void;
  titulo?: string;
}

const hoy = () => new Date().toISOString().slice(0, 10);
const fechaHoraMx = (d: Date) => d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function Cerrar({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label="Cerrar" title="Cerrar" onClick={onClick} disabled={disabled} className="text-white hover:text-gray-200 disabled:opacity-50">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z" />
      </svg>
    </button>
  );
}

function Seccion({ titulo }: { titulo: string }) {
  return (
    <div className="bg-gray-100 border-l-4 border-primary-theme px-4 py-2 mb-3">
      <h4 className="text-sm font-semibold text-gray-800">{titulo}</h4>
    </div>
  );
}

export function ConsultaBuroPanel({ consultas, onChange, datos, isView = false, onResultado, titulo = 'CONSULTA BURÓ DE CRÉDITO (SIC)' }: Props) {
  const [modal, setModal] = useState(false);
  const [autMedio, setAutMedio] = useState<AutorizacionBuro['medio']>('Firma autógrafa');
  const [autFecha, setAutFecha] = useState(hoy());
  const [autAceptada, setAutAceptada] = useState(false);
  const [paso, setPaso] = useState<string | null>(null);
  const [verReporte, setVerReporte] = useState<ConsultaBuroRegistro | null>(null);
  const [xml, setXml] = useState<string | null>(null);

  const pm = datos.tipoPersona === 'PM';
  const faltan = validarDatosConsulta(datos);
  const nombre = pm ? datos.razonSocial : [datos.nombre, datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ');

  const abrir = () => {
    setAutMedio('Firma autógrafa');
    setAutFecha(hoy());
    setAutAceptada(false);
    setPaso(null);
    setModal(true);
  };

  const consultar = async () => {
    if (paso) return;
    if (faltan.length) {
      toast.error('Datos incompletos para consultar Buró', { description: `Complete: ${faltan.join(', ')}.` });
      return;
    }
    if (!autAceptada || !autFecha || autFecha > hoy()) {
      toast.error('Falta la autorización del cliente', { description: 'La consulta requiere la autorización expresa y firmada del consultado, con fecha válida.' });
      return;
    }
    let reporte: ReporteBuro;
    try {
      reporte = await consultarBuroSimulado(datos, { medio: autMedio, fecha: autFecha }, setPaso);
    } catch (err) {
      console.error('[Buró] Error en la consulta:', err);
      toast.error('No se pudo completar la consulta a Buró', { description: 'Intente de nuevo en unos momentos.' });
      setPaso(null);
      return;
    }
    const registro: ConsultaBuroRegistro = {
      id: Date.now(),
      fechaHora: fechaHoraMx(new Date(reporte.fechaConsulta)),
      usuario: getUsuarioSesion(),
      tipoConsulta: 'BURO',
      estatus: reporte.resultado,
      xmlResultado: `[Reporte Buró · folio ${reporte.folio}]`,
      folio: reporte.folio,
      score: reporte.score.valor,
      reporte,
    };
    onChange([...consultas, registro]);
    onResultado?.(reporte.resultado);
    setModal(false);
    setPaso(null);
    const score = reporte.score.valor === null ? 'score no calculable' : `${reporte.score.nombre} ${reporte.score.valor}`;
    if (reporte.resultado === 'NEGATIVO') {
      toast.success('Consulta a Buró completada', { description: `Folio ${reporte.folio} · ${score} · Sin registros negativos.` });
    } else {
      toast.warning('Consulta a Buró con registros negativos', { description: `Folio ${reporte.folio} · ${score} · ${reporte.motivoResultado}.`, duration: 8000 });
    }
  };

  const descargarXml = () => {
    if (!xml) return;
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `consulta-buro-${Date.now()}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const consultando = !!paso;
  return (
    <div>
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">{titulo}</span>
        {!isView && (
          <button type="button" onClick={abrir} className="px-4 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium">
            Nuevo
          </button>
        )}
      </div>

      <div className="border border-gray-300 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#E7E6E6] border-b border-gray-400">
              {['Fecha y hora', 'Usuario', 'Tipo de Consulta', 'Folio'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">{h}</th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300">Score</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300 w-20">PDF SIC</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 w-20">XML SIC</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {consultas.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400 text-xs">No hay consultas a Buró registradas.</td></tr>
            )}
            {[...consultas].reverse().map(c => (
              <tr key={c.id} className="border-b border-gray-200">
                <td className="px-3 py-2 text-gray-700 border-r border-gray-200 whitespace-nowrap">{c.fechaHora}</td>
                <td className="px-3 py-2 text-gray-700 border-r border-gray-200">{c.usuario}</td>
                <td className="px-3 py-2 text-gray-700 border-r border-gray-200">
                  {c.reporte ? c.reporte.producto : (c.tipoConsulta || '').toUpperCase() === 'BURO' ? 'Buró de Crédito' : c.tipoConsulta}
                </td>
                <td className="px-3 py-2 text-gray-700 border-r border-gray-200 font-mono">{c.folio || '—'}</td>
                <td className="px-3 py-2 text-center border-r border-gray-200 font-semibold">{c.reporte ? (c.score ?? 'N/D') : '—'}</td>
                <td className="px-3 py-2 border-r border-gray-200" title={c.reporte?.motivoResultado}>
                  <span className={c.estatus === 'NEGATIVO' ? 'text-green-700 font-semibold' : c.estatus === 'POSITIVO' ? 'text-red-600 font-semibold' : 'text-gray-700'}>{c.estatus}</span>
                  {c.reporte && <span className="block text-[10px] text-gray-500">{c.estatus === 'NEGATIVO' ? 'Sin registros negativos' : 'Con registros negativos'}</span>}
                </td>
                <td className="px-3 py-2 text-center border-r border-gray-200">
                  <button type="button" onClick={() => setVerReporte(c)} disabled={!c.reporte} title={c.reporte ? 'Ver reporte' : 'Registro anterior sin reporte'}
                    className="inline-flex items-center justify-center p-1 hover:bg-gray-100 rounded disabled:hover:bg-transparent">
                    <FileText className={`w-4 h-4 ${c.reporte ? 'text-red-600' : 'text-gray-300'}`} />
                  </button>
                </td>
                <td className="px-3 py-2 text-center">
                  <button type="button" onClick={() => setXml(c.reporte ? reporteBuroAXml(c.reporte) : c.xmlResultado)} disabled={!c.reporte && !c.xmlResultado} title="Ver XML"
                    className="inline-flex items-center justify-center p-1 hover:bg-gray-100 rounded">
                    <FileCode className={`w-4 h-4 ${c.reporte || c.xmlResultado ? 'text-green-600' : 'text-gray-300'}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal — nueva consulta */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">Consulta a Buró de Crédito</h3>
              <Cerrar onClick={() => setModal(false)} disabled={consultando} />
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
              <div>
                <Seccion titulo="PRODUCTO" />
                <p className="text-gray-800">
                  {pm ? 'Reporte de Crédito Empresarial + Score PyME' : 'Reporte de Crédito Especial + BC Score'}
                  <span className="ml-2 text-xs text-gray-500">({pm ? 'Persona Moral' : 'Persona Física'}, según la personalidad jurídica)</span>
                </p>
              </div>
              <div>
                <Seccion titulo="DATOS DEL CONSULTADO" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div><span className="text-gray-500">{pm ? 'Razón social' : 'Nombre'}:</span> <span className="font-medium">{nombre || '—'}</span></div>
                  <div><span className="text-gray-500">RFC:</span> <span className="font-medium font-mono">{datos.rfc || '—'}</span></div>
                  {!pm && <div><span className="text-gray-500">Fecha de nacimiento:</span> <span className="font-medium">{datos.fechaNacimiento || '—'}</span></div>}
                  {!pm && <div><span className="text-gray-500">CURP:</span> <span className="font-medium font-mono">{datos.curp || '—'}</span></div>}
                  <div className="col-span-2"><span className="text-gray-500">Domicilio:</span> <span className="font-medium">{datos.direccion || '—'}</span></div>
                </div>
                {faltan.length > 0 && (
                  <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    Para consultar complete en el formulario: <strong>{faltan.join(', ')}</strong>.
                  </div>
                )}
              </div>
              <div>
                <Seccion titulo="AUTORIZACIÓN DEL CONSULTADO" />
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Medio de autorización <span className="text-red-600">*</span></span>
                    <select value={autMedio} onChange={e => setAutMedio(e.target.value as AutorizacionBuro['medio'])} disabled={consultando}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme">
                      <option>Firma autógrafa</option>
                      <option>Firma electrónica avanzada</option>
                      <option>NIP</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Fecha de firma <span className="text-red-600">*</span></span>
                    <DatePicker formato="iso" value={autFecha} onChange={(__v: string) => setAutFecha(__v)} disabled={consultando} max={hoy()} className="w-full text-sm" />
                  </label>
                </div>
                <label className="mt-3 flex items-start gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={autAceptada} onChange={e => setAutAceptada(e.target.checked)} disabled={consultando} className="mt-0.5 w-4 h-4" />
                  <span>Confirmo que el consultado autorizó expresamente esta consulta a la Sociedad de Información Crediticia y que la autorización firmada está integrada al expediente (KM Digital).</span>
                </label>
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between gap-2">
              <span className="text-xs text-gray-600 flex items-center gap-2 min-h-[1rem]">
                {consultando && <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-[color:var(--theme-primary)] rounded-full animate-spin" />}
                {paso}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setModal(false)} disabled={consultando}
                  className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={consultar} disabled={consultando || faltan.length > 0 || !autAceptada || !autFecha}
                  className="px-5 py-2 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {consultando ? 'Consultando…' : 'Consultar Buró'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal — reporte */}
      {verReporte?.reporte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded shadow-lg w-[90vw] h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300">
              <div>
                <h3 className="text-base font-medium text-gray-800">REPORTE SIC - BURÓ DE CRÉDITO</h3>
                <p className="text-xs text-gray-600 mt-1">Consulta del {verReporte.fechaHora} · Folio {verReporte.folio}</p>
              </div>
              <button type="button" aria-label="Cerrar" title="Cerrar" onClick={() => setVerReporte(null)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-4xl mx-auto bg-white border border-gray-300 shadow-lg p-8">
                <ReporteBuroVista reporte={verReporte.reporte} usuario={verReporte.usuario} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-300 bg-gray-50">
              <button type="button" onClick={() => window.print()} className="px-4 py-1.5 btn-accent-theme rounded text-sm hover:bg-accent-hover-theme">Imprimir / Descargar PDF</button>
              <button type="button" onClick={() => setVerReporte(null)} className="px-4 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — XML */}
      {xml !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">XML de la consulta</h3>
              <Cerrar onClick={() => setXml(null)} />
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono bg-gray-50 text-gray-800 whitespace-pre">{xml}</pre>
            <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex justify-end gap-2">
              <button type="button" onClick={() => { navigator.clipboard.writeText(xml); toast.success('XML copiado'); }}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100 inline-flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Copiar</button>
              <button type="button" onClick={descargarXml}
                className="px-4 py-1.5 text-sm btn-accent-theme rounded hover:bg-accent-hover-theme inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Descargar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
