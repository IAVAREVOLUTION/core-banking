/**
 * Panel "Verificación PLD / Listas de Negocio" reutilizable (Personas).
 * Revisa contra todas las listas (lib/pldSimulado), muestra coincidencias y
 * permite al analista descartarlas o confirmarlas con justificación.
 */
import { useState } from 'react';
import { toast } from '@/app/lib/notificaciones';
import { getUsuarioSesion } from '@/app/lib/sesion';
import { LISTAS_PLD, validarDatosPLD, verificarListasPLDConLatencia, estatusGeneralPLD } from '@/app/lib/pldSimulado';
import type { RegistroPLD, ResolucionPLD, DatosPLD, EstatusPLD } from '@/app/lib/pldSimulado';

interface Props {
  registros: RegistroPLD[];
  onChange: (registros: RegistroPLD[]) => void;
  datos: DatosPLD;
  isView?: boolean;
  /** Estatus general tras cada verificación o resolución (estatus de listas de la persona). */
  onEstatus?: (estatus: EstatusPLD) => void;
  titulo?: string;
}

function Cerrar({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label="Cerrar" title="Cerrar" onClick={onClick} disabled={disabled} className="text-white hover:text-gray-200 disabled:opacity-50">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z" />
      </svg>
    </button>
  );
}

export function VerificacionPLDPanel({ registros, onChange, datos, isView = false, onEstatus, titulo = 'VERIFICACIÓN PLD / LISTAS DE NEGOCIO' }: Props) {
  const [modal, setModal] = useState(false);
  const [paso, setPaso] = useState<string | null>(null);
  const [aResolver, setAResolver] = useState<RegistroPLD | null>(null);
  const [decision, setDecision] = useState<ResolucionPLD['decision']>('Descartada (homonimia)');
  const [justificacion, setJustificacion] = useState('');

  const faltan = validarDatosPLD(datos);
  const listas = LISTAS_PLD.filter(l => !(l.soloPF && datos.tipoPersona === 'PM'));
  const verificando = !!paso;

  const aplicar = (todos: RegistroPLD[]) => {
    onChange(todos);
    const general = estatusGeneralPLD(todos);
    if (general) onEstatus?.(general);
    return general;
  };

  const verificar = async () => {
    if (paso) return;
    if (faltan.length) {
      toast.error('Datos incompletos para la verificación PLD', { description: `Complete: ${faltan.join(', ')}.` });
      return;
    }
    const nuevos = await verificarListasPLDConLatencia(datos, getUsuarioSesion(), setPaso);
    const general = aplicar([...registros, ...nuevos]);
    setModal(false);
    setPaso(null);
    const hallazgos = nuevos.filter(r => r.estatus !== 'NEGATIVO').map(h => h.nombreLista).join(', ');
    if (general === 'NEGATIVO') toast.success('Verificación PLD sin coincidencias', { description: `Folio ${nuevos[0]?.folio} · ${nuevos.length} listas revisadas.` });
    else if (general === 'EN REVISIÓN') toast.warning('Coincidencia parcial en listas', { description: `${hallazgos}. Un analista debe resolverla.`, duration: 8000 });
    else toast.error('Coincidencia confirmada en listas', { description: `${hallazgos}. No se puede activar.`, duration: 10000 });
  };

  const abrirResolucion = (r: RegistroPLD) => {
    setAResolver(r);
    setDecision('Descartada (homonimia)');
    setJustificacion('');
  };

  const resolver = () => {
    if (!aResolver) return;
    if (justificacion.trim().length < 20) {
      toast.error('Justificación insuficiente', { description: 'Describa en al menos 20 caracteres por qué se descarta o confirma la coincidencia.' });
      return;
    }
    const resolucion: ResolucionPLD = {
      decision,
      justificacion: justificacion.trim(),
      usuario: getUsuarioSesion(),
      fecha: new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    const general = aplicar(registros.map(r => (r.id === aResolver.id
      ? { ...r, estatus: decision === 'Confirmada' ? 'POSITIVO' : 'NEGATIVO', resolucion }
      : r)));
    setAResolver(null);
    toast.success(`Coincidencia ${decision === 'Confirmada' ? 'confirmada' : 'descartada'}`, { description: `Estatus de listas: ${general}.` });
  };

  return (
    <div>
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">{titulo}</span>
        {!isView && (
          <button type="button" onClick={() => { setPaso(null); setModal(true); }} className="px-4 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium">
            Nuevo
          </button>
        )}
      </div>

      <div className="border border-gray-300 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#E7E6E6] border-b border-gray-400">
              {['Fecha y hora', 'Usuario', 'Folio', 'Lista', 'Tipo', 'Coincidencia', 'Estatus'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">{h}</th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 w-24">Acción</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {registros.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400 text-xs">No hay verificaciones PLD registradas.</td></tr>
            )}
            {[...registros].reverse().map((r, i, arr) => {
              const nuevoFolio = i === 0 || arr[i - 1].folio !== r.folio;
              const est = (r.estatus || '').toUpperCase();
              const color = est === 'NEGATIVO' ? 'text-green-700' : est === 'POSITIVO' ? 'text-red-600' : 'text-amber-600';
              return (
                <tr key={r.id} className={`border-b border-gray-200 ${nuevoFolio && i > 0 ? 'border-t-2 border-t-gray-300' : ''} ${est === 'COINCIDENCIA' ? 'bg-amber-50/60' : est === 'POSITIVO' ? 'bg-red-50/60' : ''}`}>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-200 whitespace-nowrap">{nuevoFolio ? (r.fechaHora || (r as any).fecha || '') : ''}</td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-200">{nuevoFolio ? r.usuario : ''}</td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-200 font-mono whitespace-nowrap">{nuevoFolio ? (r.folio || '—') : ''}</td>
                  <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                    {r.nombreLista}
                    {r.severidad && <span className="block text-[10px] text-gray-500">Si coincide: {r.severidad}</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-200">{r.tipoLista}</td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-200">
                    {r.coincidencia ? (
                      <>
                        <span className="font-medium">{r.coincidencia.nombreEnLista}</span>
                        <span className="block text-[10px] text-gray-500">Similitud {r.coincidencia.similitud}% · {r.coincidencia.motivo}</span>
                      </>
                    ) : <span className="text-gray-400">Sin coincidencias</span>}
                  </td>
                  <td className={`px-3 py-2 font-semibold border-r border-gray-200 ${color}`}>
                    {r.estatus}
                    {r.resolucion && <span className="block text-[10px] font-normal text-gray-500" title={r.resolucion.justificacion}>{r.resolucion.decision} · {r.resolucion.usuario}</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {est === 'COINCIDENCIA' && !isView ? (
                      <button type="button" onClick={() => abrirResolucion(r)} className="px-2 py-1 text-[11px] font-medium rounded border border-amber-400 text-amber-700 hover:bg-amber-50">Resolver</button>
                    ) : r.coincidencia ? (
                      <button type="button" onClick={() => abrirResolucion(r)} className="enlace-accion text-[color:var(--theme-link)] hover:underline text-[11px]">Detalle</button>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal — nueva verificación */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">Verificación PLD / Listas de Negocio</h3>
              <Cerrar onClick={() => setModal(false)} disabled={verificando} />
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <div className="bg-gray-100 border-l-4 border-primary-theme px-4 py-2 mb-3"><h4 className="text-sm font-semibold text-gray-800">DATOS A VERIFICAR</h4></div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div><span className="text-gray-500">{datos.tipoPersona === 'PM' ? 'Razón social' : 'Nombre'}:</span> <span className="font-medium">{datos.nombre || '—'}</span></div>
                  <div><span className="text-gray-500">RFC:</span> <span className="font-medium font-mono">{datos.rfc || '—'}</span></div>
                </div>
                {faltan.length > 0 && (
                  <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    Para verificar complete en el formulario: <strong>{faltan.join(', ')}</strong>.
                  </div>
                )}
              </div>
              <div>
                <div className="bg-gray-100 border-l-4 border-primary-theme px-4 py-2 mb-3"><h4 className="text-sm font-semibold text-gray-800">LISTAS QUE SE REVISARÁN ({listas.length})</h4></div>
                <table className="w-full text-xs border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>{['Lista', 'Fuente', 'Tipo', 'Si coincide'].map(h => <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-700">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {listas.map(l => (
                      <tr key={l.clave} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 text-gray-800">{l.nombre}</td>
                        <td className="px-2 py-1.5 text-gray-600">{l.fuente}</td>
                        <td className="px-2 py-1.5 text-gray-600">{l.tipo}</td>
                        <td className={`px-2 py-1.5 ${l.severidad === 'Bloqueo' ? 'text-red-600' : 'text-amber-600'}`}>{l.severidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {datos.tipoPersona === 'PM' && (
                  <p className="mt-2 text-[11px] text-gray-500">La lista PEP aplica a personas físicas; para personas morales se revisan accionistas y representantes en su propio registro.</p>
                )}
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between gap-2">
              <span className="text-xs text-gray-600 flex items-center gap-2 min-h-[1rem]">
                {verificando && <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-[color:var(--theme-primary)] rounded-full animate-spin" />}
                {paso}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setModal(false)} disabled={verificando}
                  className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={verificar} disabled={verificando || faltan.length > 0}
                  className="px-5 py-2 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {verificando ? 'Verificando…' : 'Verificar listas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal — detalle / resolución */}
      {aResolver?.coincidencia && (() => {
        const r = aResolver;
        const c = r.coincidencia!;
        const pendiente = (r.estatus || '').toUpperCase() === 'COINCIDENCIA' && !isView;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
                <h3 className="text-base font-medium text-white">{pendiente ? 'Resolver coincidencia' : 'Detalle de coincidencia'}</h3>
                <Cerrar onClick={() => setAResolver(null)} />
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded p-3">
                    <p className="text-[10px] uppercase text-gray-500 mb-1">Nombre Interlocutor</p>
                    <p className="font-semibold text-gray-800">{datos.nombre.toUpperCase()}</p>
                    <p className="font-mono text-gray-600">{datos.rfc}</p>
                  </div>
                  <div className="border border-amber-300 bg-amber-50 rounded p-3">
                    <p className="text-[10px] uppercase text-amber-700 mb-1">Registro en lista · similitud {c.similitud}%</p>
                    <p className="font-semibold text-gray-800">{c.nombreEnLista}</p>
                    <p className="text-gray-600">Ref. {c.referencia}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <div><span className="text-gray-500">Lista:</span> {r.nombreLista}</div>
                  <div><span className="text-gray-500">Si se confirma:</span> <span className={r.severidad === 'Bloqueo' ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>{r.severidad}</span></div>
                  <div><span className="text-gray-500">Motivo:</span> {c.motivo}</div>
                  <div><span className="text-gray-500">Publicación:</span> {c.fechaPublicacion.split('-').reverse().join('/')}</div>
                  <div><span className="text-gray-500">Folio:</span> <span className="font-mono">{r.folio}</span></div>
                  <div><span className="text-gray-500">Estatus:</span> <strong>{r.estatus}</strong></div>
                </div>
                {r.resolucion && (
                  <div className="border-l-4 border-gray-400 bg-gray-50 px-3 py-2">
                    <p className="font-semibold">{r.resolucion.decision} — {r.resolucion.usuario}, {r.resolucion.fecha}</p>
                    <p className="text-gray-600 mt-0.5">{r.resolucion.justificacion}</p>
                  </div>
                )}
                {pendiente && (
                  <div className="space-y-3 pt-1">
                    <div className="flex gap-6">
                      {(['Descartada (homonimia)', 'Confirmada'] as const).map(d => (
                        <label key={d} className="flex items-center gap-1.5 text-gray-700">
                          <input type="radio" name="decision-pld-panel" checked={decision === d} onChange={() => setDecision(d)} />
                          {d === 'Confirmada' ? 'Confirmar coincidencia' : 'Descartar (homonimia)'}
                        </label>
                      ))}
                    </div>
                    <label className="block">
                      <span className="block font-medium text-gray-700 mb-1">Justificación <span className="text-red-600">*</span></span>
                      <textarea value={justificacion} onChange={e => setJustificacion(e.target.value)} rows={3}
                        placeholder="Ej. La fecha de nacimiento y el RFC del registro en lista no corresponden a la persona."
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme" />
                      <span className="text-[10px] text-gray-500">{justificacion.trim().length}/20 caracteres mínimo</span>
                    </label>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex justify-end gap-2">
                <button type="button" onClick={() => setAResolver(null)} className="px-4 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">{pendiente ? 'Cancelar' : 'Cerrar'}</button>
                {pendiente && (
                  <button type="button" onClick={resolver} disabled={justificacion.trim().length < 20}
                    className="px-4 py-1.5 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme disabled:opacity-50">Guardar resolución</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
