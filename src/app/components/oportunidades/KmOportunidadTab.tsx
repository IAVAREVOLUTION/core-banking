/**
 * KM Digital de la Oportunidad — misma interfaz que el KM de la Solicitud
 * (ExpedienteElectronicoTab): versión vigente con su historial desplegable,
 * "Nueva Versión", "Agregar Documento" y "Quitar". Nunca se sobrescribe un
 * archivo: cada carga es un registro nuevo.
 *
 * No incluye lo propio de la Solicitud (fases, requisitos del producto,
 * validación IA): la Oportunidad no tiene ese flujo.
 */
import { useMemo, useRef, useState } from 'react';
import { toast } from '@/app/lib/notificaciones';
import type { ArchivoAdjuntoOportunidad } from '../cotizaciones/cotizacionCreditoTypes';
import { documentosConVersiones, agregarVersion, normalizarVersiones } from '@/app/lib/versionesKmOportunidad';
import { subirArchivoOportunidad, esPDFValido } from './cartaOfertaPDF';

interface Props {
  archivos: ArchivoAdjuntoOportunidad[];
  oportunidadId: string;
  usuario: string;
  soloLectura: boolean;
  /** Tipos que ya no admiten nueva versión ni quitar (p. ej. tras el Cierre Comercial). */
  tiposBloqueados?: string[];
  /** Registro que no se puede quitar (evidencia del Cierre Comercial). */
  idProtegido?: string;
  onVer: (a: ArchivoAdjuntoOportunidad) => void;
  /** Lista completa actualizada — el padre la persiste. */
  onCambiar: (lista: ArchivoAdjuntoOportunidad[]) => void;
}

/** Tipos sugeridos al agregar un documento (se puede escribir otro). */
const TIPOS_SUGERIDOS = [
  'Carta Oferta Firmada', 'Estados Financieros', 'Identificación Oficial', 'Acta Constitutiva',
  'Poderes', 'Comprobante de Domicilio', 'Estudio de Factibilidad', 'Documento de Soporte', 'Otro',
];

const fmtFecha = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('es-MX');
};
const formato = (nombre: string) => (nombre.split('.').pop() || '').toUpperCase() || '—';

export function KmOportunidadTab({ archivos, oportunidadId, usuario, soloLectura, tiposBloqueados = [], idProtegido, onVer, onCambiar }: Props) {
  const grupos = useMemo(() => documentosConVersiones(archivos), [archivos]);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const toggle = (raiz: string) => setAbiertos(prev => {
    const n = new Set(prev); if (n.has(raiz)) n.delete(raiz); else n.add(raiz); return n;
  });

  // Modal: nuevo documento (origen undefined) o nueva versión (origen = vigente).
  const [modal, setModal] = useState<{ origen?: ArchivoAdjuntoOportunidad } | null>(null);
  const [tipo, setTipo] = useState('');
  const [nota, setNota] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const abrir = (origen?: ArchivoAdjuntoOportunidad) => {
    setModal({ origen }); setTipo(origen?.tipo || ''); setNota(''); setArchivo(null);
  };
  const cerrar = () => { if (!subiendo) setModal(null); };

  const guardar = async () => {
    if (!modal) return;
    const tipoFinal = (modal.origen?.tipo || tipo).trim();
    if (!tipoFinal) { toast.error('Indique el Tipo de Documento'); return; }
    if (!archivo) { toast.error('Adjunte el archivo'); return; }
    if (tipoFinal === 'Carta Oferta Firmada' && !esPDFValido(archivo)) {
      toast.error('Archivo inválido', { description: 'La Carta Oferta firmada debe ser PDF.' });
      return;
    }
    setSubiendo(true);
    try {
      const subida = await subirArchivoOportunidad(archivo, oportunidadId);
      const ahora = new Date().toISOString();
      const nuevo: ArchivoAdjuntoOportunidad = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nombre: archivo.name,
        tipo: tipoFinal,
        url: subida.url,
        storagePath: subida.storagePath,
        tamanoKB: subida.tamanoKB,
        fecha: ahora,
        fechaActualizacion: ahora,
        usuario,
        enStorage: subida.enStorage,
        ...(nota.trim() ? { nota: nota.trim() } : {}),
      };
      const lista = agregarVersion(archivos, nuevo, modal.origen);
      onCambiar(lista);
      const reg = lista[lista.length - 1];
      if (subida.enStorage) {
        toast.success(modal.origen ? `Versión ${reg.version} cargada` : 'Documento agregado', { description: `${tipoFinal} · ${archivo.name}` });
      } else {
        toast.warning('Documento cargado, pero no se subió a Storage', { description: 'Queda disponible en esta sesión. Revise permisos del bucket.' });
      }
      setModal(null);
    } catch (err) {
      toast.error('No se pudo cargar el documento', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSubiendo(false);
    }
  };

  const quitar = (a: ArchivoAdjuntoOportunidad) => {
    if (a.id === idProtegido) {
      toast.error('No se puede quitar', { description: 'Es la Carta Oferta firmada vigente: es la evidencia del Cierre Comercial. Cargue una nueva versión si necesita reemplazarla.' });
      return;
    }
    if (!window.confirm(`¿Quitar "${a.nombre}" (v${a.version || '1.0'}) del KM Digital?`)) return;
    onCambiar(normalizarVersiones(archivos).filter(x => x.id !== a.id));
    toast.success('Documento quitado');
  };

  const th = 'px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-gray-500">
          {grupos.length} documento{grupos.length !== 1 ? 's' : ''}
          {archivos.length > grupos.length && ` · ${archivos.length - grupos.length} versión(es) anterior(es)`}
        </span>
        {!soloLectura && (
          <button type="button" onClick={() => abrir()}
            className="px-3 py-1.5 text-xs font-medium text-white rounded bg-[color:var(--theme-action)] hover:bg-[color:var(--theme-action-hover)]">
            + Agregar Documento
          </button>
        )}
      </div>

      {grupos.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <p className="text-sm text-gray-500 font-medium mb-1">Sin documentos</p>
          <p className="text-xs text-gray-400">Genere la Carta Oferta o presione "Agregar Documento".</p>
        </div>
      ) : (
        <div className="border border-gray-200 overflow-hidden rounded-xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                  <th className={`${th} text-center`}>Versión</th>
                  <th className={th}>Fecha Creación</th>
                  <th className={th}>Fecha Actualización</th>
                  <th className={th}>Usuario</th>
                  <th className={th}>Tipo Documento</th>
                  <th className={th}>Archivo</th>
                  <th className={th}>Formato</th>
                  <th className={`${th} text-right`}>Tamaño</th>
                  <th className={th}>Plantilla / Nota</th>
                  <th className={`${th} text-center`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grupos.flatMap(grupo => {
                  const vigente = grupo[0];
                  const raiz = vigente.versionRaiz || vigente.id;
                  const total = grupo.length;
                  const abierto = abiertos.has(raiz);
                  const filas = [{ a: vigente, anterior: false, ultima: false }]
                    .concat(abierto ? grupo.slice(1).map((a, i) => ({ a, anterior: true, ultima: i === total - 2 })) : []);
                  const creacion = grupo[grupo.length - 1].fecha;
                  const bloqueado = tiposBloqueados.includes(vigente.tipo);
                  return filas.map(({ a, anterior, ultima }) => (
                    <tr key={a.id}
                      className={`transition-colors ${anterior ? 'opacity-70 hover:opacity-100 hover:bg-slate-100/70' : 'hover:bg-blue-50/40'}`}
                      style={{ backgroundColor: anterior ? '#F8FAFC' : '#FFFFFF' }}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {!anterior ? (
                          <div className="flex items-center gap-1.5">
                            {total > 1 ? (
                              <button type="button" onClick={() => toggle(raiz)} aria-expanded={abierto}
                                title={abierto ? 'Ocultar versiones anteriores' : 'Ver versiones anteriores'}
                                className="w-4 h-4 flex items-center justify-center rounded text-gray-500 hover:text-[color:var(--theme-primary)] hover:bg-blue-50">
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                                  className={`transition-transform ${abierto ? '' : '-rotate-90'}`}><path d="M6 9l6 6 6-6" /></svg>
                              </button>
                            ) : <span className="w-4" />}
                            <div className="flex flex-col items-start leading-tight">
                              <span className="inline-flex px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold text-[color:var(--theme-secondary)] bg-blue-50 border border-blue-200">v{a.version || '1.0'}</span>
                              {total > 1 && (
                                <button type="button" onClick={() => toggle(raiz)} className="mt-0.5 text-[10px] text-gray-500 hover:text-[color:var(--theme-primary)] hover:underline">
                                  Vigente · {total} versiones
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 pl-2">
                            <span className="relative w-4 h-6 shrink-0">
                              <span className={`absolute left-1.5 top-0 border-l border-slate-300 ${ultima ? 'h-3' : 'h-full'}`} />
                              <span className="absolute left-1.5 top-3 w-2.5 border-t border-slate-300" />
                            </span>
                            <div className="flex flex-col items-start leading-tight">
                              <span className="inline-flex px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-500 bg-slate-100 border border-slate-200">v{a.version || '1.0'}</span>
                              <span className="mt-0.5 text-[10px] text-slate-400">Anterior</span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono text-[11px]">{fmtFecha(anterior ? a.fecha : creacion)}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono text-[11px]">{fmtFecha(a.fechaActualizacion || a.fecha)}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {a.usuario}
                        {!a.enStorage && <span className="ml-1 text-[9px] text-amber-600" title="No se subió a Storage; se pierde al recargar">⚠ local</span>}
                      </td>
                      <td className="px-3 py-2"><span className="font-medium text-gray-800">{a.tipo}</span></td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => onVer(a)}
                          className="inline-flex items-center gap-1 text-[color:var(--theme-primary)] hover:text-[color:var(--theme-primary-hover)] font-medium text-left group" title={a.nombre}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 opacity-60 group-hover:opacity-100">
                            <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" /><circle cx="6" cy="6" r="1.5" />
                          </svg>
                          <span className="truncate max-w-[200px] hover:underline">{a.nombre}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/60">{formato(a.nombre)}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 font-mono whitespace-nowrap">{a.tamanoKB} KB</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate" title={a.plantilla || a.nota || ''}>
                        {a.plantilla || a.nota || <span className="text-gray-300 italic">--</span>}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => onVer(a)}
                            className="px-2 py-1 rounded-md text-[10px] font-medium text-[color:var(--theme-primary)] bg-blue-50 hover:bg-blue-100 border border-blue-200/60">Ver</button>
                          {!soloLectura && !anterior && !bloqueado && (
                            <button type="button" onClick={() => abrir(a)}
                              title="Cargar el archivo actualizado como nueva versión (la actual queda en el historial)"
                              className="px-1 py-1 text-[10px] text-gray-400 hover:text-[color:var(--theme-primary)] hover:underline">Nueva Versión</button>
                          )}
                          {!soloLectura && !bloqueado && (
                            <button type="button" onClick={() => quitar(a)} title="Quitar documento del KM Digital"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200">
                              <svg width="10" height="10" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1.5 3h8M4 3V1.5h3V3M3 3v6.5a1 1 0 001 1h3a1 1 0 001-1V3" /></svg>
                              Quitar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-gray-50/80 border-t border-gray-100 text-[10px] text-gray-400">
            {archivos.length} archivo{archivos.length !== 1 ? 's' : ''} en total (incluye versiones anteriores)
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={cerrar}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">
                {modal.origen ? `Nueva Versión — ${modal.origen.tipo}` : 'Agregar Documento'}
              </h3>
              {modal.origen && (
                <p className="text-[11px] text-gray-500 mt-0.5">
                  La versión {modal.origen.version || '1.0'} ({modal.origen.nombre}) queda en el historial.
                </p>
              )}
            </div>
            <div className="px-5 py-4 space-y-3 text-xs">
              {!modal.origen && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Tipo de Documento <span className="text-red-600">*</span></label>
                  <input list="km-oportunidad-tipos" value={tipo} onChange={e => setTipo(e.target.value)} placeholder="Seleccione o escriba…"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
                  <datalist id="km-oportunidad-tipos">{TIPOS_SUGERIDOS.map(t => <option key={t} value={t} />)}</datalist>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Archivo <span className="text-red-600">*</span></label>
                <input ref={fileRef} type="file" className="hidden" onChange={e => { setArchivo(e.target.files?.[0] || null); e.target.value = ''; }} />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Seleccionar archivo</button>
                  <span className="truncate text-gray-600">{archivo?.name || 'Ningún archivo seleccionado'}</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Nota</label>
                <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} maxLength={500}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)]" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button type="button" onClick={cerrar} disabled={subiendo} className="px-4 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={guardar} disabled={subiendo}
                className="px-4 py-1.5 text-xs text-white rounded bg-[color:var(--theme-action)] hover:bg-[color:var(--theme-action-hover)] disabled:opacity-50">
                {subiendo ? 'Subiendo…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
