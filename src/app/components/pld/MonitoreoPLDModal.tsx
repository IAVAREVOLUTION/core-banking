/**
 * Monitoreo PLD: corre las reglas sobre los movimientos reales y propone
 * alertas. El oficial elige cuáles generar (nada se crea automáticamente).
 */
import { useEffect, useMemo, useState } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from '@/app/lib/notificaciones';
import { getUsuarioSesion } from '@/app/lib/sesion';
import {
  extraerMovimientos, monitorear, parametrosDesde, personasConCoincidencias, marcaClave,
  NOMBRE_REGLA, type AlertaPropuesta,
} from '@/app/lib/pldMonitoreo';
import { getParametros, type AlertaPLD } from './pldStore';
import { formatearFecha } from '@/app/lib/fechas';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

function colorTipo(t: string) {
  if (t === 'Relevante') return 'bg-red-50 text-red-700 border-red-200';
  if (t === 'Preocupante') return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

interface Props {
  alertasExistentes: AlertaPLD[];
  onGenerar: (a: AlertaPLD) => Promise<void>;
  onClose: () => void;
}

export function MonitoreoPLDModal({ alertasExistentes, onGenerar, onClose }: Props) {
  const [cargando, setCargando] = useState(true);
  const [propuestas, setPropuestas] = useState<AlertaPropuesta[]>([]);
  const [movsRevisados, setMovsRevisados] = useState(0);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [generando, setGenerando] = useState(false);
  const [filtroRegla, setFiltroRegla] = useState<string>('');

  // Detecciones ya convertidas en alerta (se marcan en la descripción).
  const yaGeneradas = useMemo(() => {
    const s = new Set<string>();
    for (const a of alertasExistentes) {
      const m = String(a.descripcion || '').match(/\[ref:([^\]]+)\]/);
      if (m) s.add(m[1]);
    }
    return s;
  }, [alertasExistentes]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [rCuentas, rClientes] = await Promise.all([
          fetch(`${API_BASE}/solicitudes-credito`, { headers: HDR }).then(r => (r.ok ? r.json() : { data: [] })),
          fetch(`${API_BASE}/clientes-lista-todos`, { headers: HDR }).then(r => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
        ]);
        const filas = Array.isArray(rCuentas?.data) ? rCuentas.data : [];
        const clientes = Array.isArray(rClientes) ? rClientes : (rClientes?.data || []);
        const movs = extraerMovimientos(filas);
        const props = monitorear(movs, parametrosDesde(getParametros() as any), personasConCoincidencias(clientes));
        if (!vivo) return;
        setMovsRevisados(movs.length);
        setPropuestas(props);
        setSeleccion(new Set(props.filter(p => !yaGeneradas.has(p.clave)).map(p => p.clave)));
      } catch (e) {
        console.error('[PLD] Monitoreo falló:', e);
        toast.error('No se pudo ejecutar el monitoreo', { description: 'Intente de nuevo en unos momentos.' });
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibles = propuestas.filter(p => !filtroRegla || p.regla === filtroRegla);
  const nuevas = propuestas.filter(p => !yaGeneradas.has(p.clave));
  const conteo = (r: string) => propuestas.filter(p => p.regla === r).length;

  const siguienteFolio = (() => {
    const anio = new Date().getFullYear();
    let max = 0;
    for (const a of alertasExistentes) {
      const m = String(a.noAlerta || '').match(new RegExp(`ALR-${anio}-(\\d+)`));
      if (m) max = Math.max(max, Number(m[1]));
    }
    return () => `ALR-${anio}-${String(++max).padStart(3, '0')}`;
  })();

  const generar = async () => {
    const elegidas = propuestas.filter(p => seleccion.has(p.clave) && !yaGeneradas.has(p.clave));
    if (!elegidas.length) return;
    setGenerando(true);
    let ok = 0;
    try {
      for (const p of elegidas) {
        await onGenerar({
          id: 0,
          noAlerta: siguienteFolio(),
          fechaCreacion: p.fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          cliente: p.cliente,
          tipoAlerta: p.tipoAlerta,
          estatus: 'Pendiente',
          usuarioAsignado: getUsuarioSesion(),
          resultado: 'Pendiente análisis',
          enviadoCNBV: 'No',
          monto: p.monto ? dinero(p.monto) : '',
          descripcion: `${p.nombreRegla}. ${p.descripcion}${p.rfc ? ` RFC ${p.rfc}.` : ''} ${marcaClave(p.clave)}`,
        });
        ok++;
      }
      toast.success(`${ok} alerta(s) generada(s)`, { description: 'Quedan en estatus Pendiente para su análisis.' });
      onClose();
    } catch (e: any) {
      toast.error('No se generaron todas las alertas', { description: `${ok} de ${elegidas.length}. ${e?.message || ''}` });
    } finally {
      setGenerando(false);
    }
  };

  const alternar = (clave: string) => setSeleccion(prev => {
    const n = new Set(prev);
    if (n.has(clave)) n.delete(clave); else n.add(clave);
    return n;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-[color:var(--theme-primary)] px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base text-white font-medium">Monitoreo de operaciones</h3>
            <p className="text-[11px] text-white/80 mt-0.5">Reglas aplicadas sobre los movimientos reales de las cuentas y las verificaciones de listas.</p>
          </div>
          <button type="button" aria-label="Cerrar" title="Cerrar" onClick={onClose} disabled={generando} className="text-white/80 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {cargando ? (
          <div className="p-10 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-[color:var(--theme-primary)] rounded-full animate-spin" />
            Analizando movimientos…
          </div>
        ) : (
          <>
            {/* Resumen por regla */}
            <div className="px-6 py-3 border-b border-gray-200 bg-[color:var(--theme-tint-soft)] flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-700 mr-2"><strong>{movsRevisados}</strong> movimientos revisados · <strong>{propuestas.length}</strong> detecciones · <strong>{nuevas.length}</strong> nuevas</span>
              <button type="button" onClick={() => setFiltroRegla('')}
                className={`px-2 py-1 rounded border ${!filtroRegla ? 'bg-[color:var(--theme-primary)] text-white border-transparent' : 'bg-white text-gray-700 border-gray-300'}`}>Todas</button>
              {(Object.keys(NOMBRE_REGLA) as AlertaPropuesta['regla'][]).map(r => (
                <button key={r} type="button" onClick={() => setFiltroRegla(r)} disabled={!conteo(r)}
                  className={`px-2 py-1 rounded border disabled:opacity-40 ${filtroRegla === r ? 'bg-[color:var(--theme-primary)] text-white border-transparent' : 'bg-white text-gray-700 border-gray-300'}`}>
                  {NOMBRE_REGLA[r]} ({conteo(r)})
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto">
              {visibles.length === 0 ? (
                <p className="p-10 text-center text-sm text-gray-500">Sin detecciones con los parámetros actuales.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-100 border-b border-gray-300">
                    <tr>
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Regla</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Nombre Interlocutor</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Tipo</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Monto</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Fecha</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map(p => {
                      const generada = yaGeneradas.has(p.clave);
                      return (
                        <tr key={p.clave} className={`border-b border-gray-100 ${generada ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={!generada && seleccion.has(p.clave)} disabled={generada}
                              onChange={() => alternar(p.clave)} aria-label={`Seleccionar ${p.cliente}`} />
                          </td>
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{p.nombreRegla}</td>
                          <td className="px-3 py-2 text-gray-800">{p.cliente}<span className="block text-[10px] text-gray-500 font-mono">{p.rfc}</span></td>
                          <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${colorTipo(p.tipoAlerta)}`}>{p.tipoAlerta}</span></td>
                          <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{p.monto ? dinero(p.monto) : '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatearFecha(p.fecha)}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {p.descripcion}
                            {generada && <span className="block text-[10px] text-green-700 font-medium">Alerta ya generada</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-600">{[...seleccion].filter(c => !yaGeneradas.has(c)).length} seleccionada(s)</span>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} disabled={generando}
                  className="px-4 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={generar} disabled={generando || ![...seleccion].some(c => !yaGeneradas.has(c))}
                  className="px-4 py-1.5 text-sm rounded text-white bg-[color:var(--theme-action)] hover:bg-[color:var(--theme-action-hover)] disabled:opacity-50">
                  {generando ? 'Generando…' : 'Generar alertas seleccionadas'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
