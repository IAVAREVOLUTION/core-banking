import { useState } from 'react';
import { toast } from 'sonner';
import {
  CasoUNE, EstatusCaso, Dictamen, CAT_ESTATUS, diasRestantes,
} from './uneStore';

interface Props {
  caso: CasoUNE;
  onBack: () => void;
  onUpdate: (caso: CasoUNE) => void;
}

const FASES_ORDEN: EstatusCaso[] = ['Recibido', 'En revisión', 'En resolución', 'Cerrado'];

const estatusBadge = (e: EstatusCaso) =>
  e === 'Recibido'      ? 'bg-gray-100 text-gray-600 border-gray-300' :
  e === 'En revisión'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
  e === 'En resolución' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-green-50 text-green-700 border-green-200';

const tipoBadge = (t: string) =>
  t === 'Consulta'    ? 'bg-sky-50 text-sky-700' :
  t === 'Queja'       ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700';

const DICTAMEN_OPTS: Dictamen[] = ['Procedente', 'Improcedente', 'Parcialmente procedente', 'Desistido'];

function hoyHoraStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export function UNEDetalleCaso({ caso, onBack, onUpdate }: Props) {
  const [notaAvance, setNotaAvance]   = useState('');
  const [nuevoEstatus, setNuevoEstatus] = useState<EstatusCaso | ''>('' );
  const [resolucion,   setResolucion]  = useState(caso.resolucion || '');
  const [dictamen,     setDictamen]    = useState<Dictamen | ''>(caso.dictamen || '');
  const [showCierre,   setShowCierre]  = useState(false);

  const dias = diasRestantes(caso.fechaLimite, caso.fechaCierre);
  const vencido = dias < 0 && caso.estatus !== 'Cerrado';
  const cerrado = caso.estatus === 'Cerrado';

  const idxActual = FASES_ORDEN.indexOf(caso.estatus);

  const handleAvanzar = () => {
    if (!nuevoEstatus) { toast.error('Seleccione el nuevo estatus'); return; }
    if (!notaAvance.trim()) { toast.error('Ingrese una nota de seguimiento'); return; }
    if (nuevoEstatus === 'Cerrado') { setShowCierre(true); return; }

    const actualizado: CasoUNE = {
      ...caso,
      estatus: nuevoEstatus,
      historial: [...caso.historial, {
        fase: nuevoEstatus,
        fecha: hoyHoraStr(),
        usuario: 'Operador (sesión)',
        nota: notaAvance,
      }],
    };
    onUpdate(actualizado);
    setNotaAvance('');
    setNuevoEstatus('');
    toast.success(`Caso avanzado a "${nuevoEstatus}"`);
  };

  const handleCerrar = () => {
    if (!resolucion.trim()) { toast.error('Ingrese la resolución del caso'); return; }
    if (!dictamen)           { toast.error('Seleccione el dictamen'); return; }

    const hoy = hoyHoraStr().split(' ')[0];
    const actualizado: CasoUNE = {
      ...caso,
      estatus: 'Cerrado',
      fechaCierre: hoy,
      resolucion,
      dictamen: dictamen as Dictamen,
      notificadoCliente: true,
      historial: [...caso.historial, {
        fase: 'Cerrado',
        fecha: hoyHoraStr(),
        usuario: 'Operador (sesión)',
        nota: notaAvance || 'Caso cerrado con resolución documentada.',
      }],
    };
    onUpdate(actualizado);
    setShowCierre(false);
    toast.success('Caso cerrado y cliente notificado', { description: `Dictamen: ${dictamen}` });
  };

  const handleNotificar = () => {
    onUpdate({ ...caso, notificadoCliente: true });
    toast.success('Cliente marcado como notificado');
  };

  const siguientesEstatus = CAT_ESTATUS.filter((_, i) => i > idxActual);

  return (
    <div className="space-y-4">

      {/* Breadcrumb + botón volver */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-[#2E5C91] hover:underline">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 2L3 6l4 4"/></svg>
          Volver a casos
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-xs text-gray-500">{caso.folio}</span>
      </div>

      {/* Header del caso */}
      <div className="bg-white border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-lg font-bold text-[#2E5C91]">{caso.folio}</span>
              <span className={`px-2 py-0.5 text-[10px] border ${estatusBadge(caso.estatus)}`}>{caso.estatus}</span>
              <span className={`px-2 py-0.5 text-[10px] rounded ${tipoBadge(caso.tipo)}`}>{caso.tipo}</span>
              <span className={`px-2 py-0.5 text-[10px] border border-gray-200 ${caso.prioridad === 'Alta' ? 'bg-red-50 text-red-700' : caso.prioridad === 'Media' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600'}`}>
                {caso.prioridad}
              </span>
            </div>
            <p className="text-xs text-gray-500">{caso.clienteNombre} — {caso.productoAfectado} — {caso.motivoCategoria}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-gray-500">Plazo CONDUSEF</p>
            <p className={`text-sm font-semibold ${vencido ? 'text-red-600' : dias <= 3 ? 'text-amber-600' : 'text-gray-700'}`}>
              {caso.fechaLimite}
            </p>
            {!cerrado && (
              <p className={`text-[10px] ${vencido ? 'text-red-500' : dias <= 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                {vencido ? `Vencido hace ${Math.abs(dias)} días` : `${dias} días restantes`}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* Columna izquierda: info + descripción */}
        <div className="col-span-2 space-y-4">

          {/* Datos generales */}
          <div className="bg-white border border-gray-200 p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-3">Información del caso</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              {[
                ['Cliente',           caso.clienteNombre],
                ['ID Cliente',        caso.clienteId],
                ['Canal',             caso.canal],
                ['Producto afectado', caso.productoAfectado],
                ['Área responsable',  caso.areaResponsable],
                ['Operador asignado', caso.operadorAsignado],
                ['Fecha recepción',   caso.fechaRecepcion],
                ['Fecha cierre',      caso.fechaCierre || '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex gap-2 py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-500 w-36 flex-shrink-0">{l}</span>
                  <span className="text-gray-800">{v}</span>
                </div>
              ))}
              <div className="col-span-2 flex gap-2 py-1 border-b border-gray-100">
                <span className="text-gray-500 w-36 flex-shrink-0">Notificado al cliente</span>
                <span className={caso.notificadoCliente ? 'text-green-700' : 'text-amber-600'}>
                  {caso.notificadoCliente ? '✓ Sí' : '✗ Pendiente'}
                </span>
                {!caso.notificadoCliente && !cerrado && (
                  <button onClick={handleNotificar} className="ml-2 text-[10px] text-[#2E5C91] hover:underline">
                    Marcar como notificado
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="bg-white border border-gray-200 p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-2">Descripción del caso</p>
            <p className="text-xs text-gray-700 leading-relaxed">{caso.descripcion}</p>
          </div>

          {/* Resolución (si existe o si está cerrando) */}
          {(caso.resolucion || caso.dictamen) && (
            <div className="bg-green-50 border border-green-200 p-4">
              <p className="text-[10px] text-green-700 uppercase tracking-wide font-semibold mb-2">Resolución</p>
              {caso.dictamen && (
                <p className="text-xs font-semibold text-green-800 mb-2">
                  Dictamen: <span className="font-bold">{caso.dictamen}</span>
                </p>
              )}
              <p className="text-xs text-green-900 leading-relaxed">{caso.resolucion}</p>
            </div>
          )}

          {/* Avanzar fase — solo si no está cerrado */}
          {!cerrado && (
            <div className="bg-white border border-gray-200 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-3">Actualizar seguimiento</p>
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[10px] text-gray-600 mb-1">Nuevo estatus</label>
                  <select value={nuevoEstatus} onChange={e => setNuevoEstatus(e.target.value as EstatusCaso)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#2E5C91]">
                    <option value="">Mantener estatus actual</option>
                    {siguientesEstatus.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-600 mb-1">Nota de seguimiento <span className="text-red-500">*</span></label>
                  <textarea value={notaAvance} onChange={e => setNotaAvance(e.target.value)}
                    rows={2} placeholder="Describa las acciones tomadas..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#2E5C91] resize-none"/>
                </div>
                <button onClick={handleAvanzar}
                  className="px-4 py-1.5 bg-[#2E5C91] text-white text-xs rounded hover:bg-[#1d3f6b]">
                  {nuevoEstatus === 'Cerrado' ? 'Proceder al cierre →' : 'Guardar avance'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha: línea de tiempo */}
        <div className="col-span-1 space-y-4">

          {/* Progreso de fases */}
          <div className="bg-white border border-gray-200 p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-3">Progreso del caso</p>
            <div className="space-y-0">
              {FASES_ORDEN.map((fase, i) => {
                const completado = i <= idxActual;
                const actual     = i === idxActual;
                return (
                  <div key={fase} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                        completado
                          ? actual ? 'bg-[#2E5C91] text-white' : 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-400'}`}>
                        {completado && !actual ? '✓' : i + 1}
                      </div>
                      {i < FASES_ORDEN.length - 1 && (
                        <div className={`w-0.5 h-8 ${completado && i < idxActual ? 'bg-green-400' : 'bg-gray-200'}`}/>
                      )}
                    </div>
                    <div className="pb-2 min-w-0">
                      <p className={`text-xs font-medium ${actual ? 'text-[#2E5C91]' : completado ? 'text-green-700' : 'text-gray-400'}`}>{fase}</p>
                      {caso.historial.find(h => h.fase === fase) && (
                        <p className="text-[9px] text-gray-400">
                          {caso.historial.find(h => h.fase === fase)?.fecha.split(' ')[0]}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historial */}
          <div className="bg-white border border-gray-200 p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-3">Historial de actividad</p>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {[...caso.historial].reverse().map((h, i) => (
                <div key={i} className="border-l-2 border-[#2E5C91]/30 pl-3">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-semibold text-gray-700">{h.fase}</span>
                    <span className="text-[9px] text-gray-400">{h.fecha}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 italic mb-0.5">{h.usuario}</p>
                  <p className="text-[11px] text-gray-700 leading-relaxed">{h.nota}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de cierre */}
      {showCierre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCierre(false)}>
          <div className="bg-white shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#2E5C91] px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-white">Cierre del caso — {caso.folio}</span>
              <button onClick={() => setShowCierre(false)} className="text-white/80 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1l12 12M13 1L1 13"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] text-gray-600 mb-1 font-medium">DICTAMEN <span className="text-red-500">*</span></label>
                <select value={dictamen} onChange={e => setDictamen(e.target.value as Dictamen)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#2E5C91]">
                  <option value="">Seleccionar...</option>
                  {DICTAMEN_OPTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 mb-1 font-medium">RESOLUCIÓN DOCUMENTADA <span className="text-red-500">*</span></label>
                <textarea value={resolucion} onChange={e => setResolucion(e.target.value)}
                  rows={4} placeholder="Documente detalladamente la resolución del caso y las acciones tomadas..."
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#2E5C91] resize-none"/>
              </div>
              <div className="bg-amber-50 border border-amber-200 px-3 py-2 text-[10px] text-amber-800">
                Al cerrar el caso, el cliente será marcado como notificado y el expediente quedará bloqueado para edición.
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
              <button onClick={() => setShowCierre(false)}
                className="px-4 py-1.5 border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={handleCerrar}
                className="px-4 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                Confirmar cierre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
