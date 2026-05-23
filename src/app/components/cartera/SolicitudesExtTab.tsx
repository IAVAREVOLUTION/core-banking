import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  useSolicitudesExt, fetchTiposSolicitudesExt, crearSolicitudExt,
  fmtDate, type TipoSolicitudExt, type SolicitudExt,
} from '../../hooks/useCarteraDB';

const ESTATUS_COLOR: Record<string, string> = {
  Pendiente:  'bg-amber-50 text-amber-700 border-amber-200',
  Autorizada: 'bg-green-50 text-green-700 border-green-200',
  Rechazada:  'bg-red-50 text-red-700 border-red-200',
  Procesada:  'bg-blue-50 text-blue-700 border-blue-200',
};

interface Props {
  solicitudId: string;
  usuario?: string;
}

export function SolicitudesExtTab({ solicitudId, usuario = 'Sistema' }: Props) {
  const { rows, loading, error, refetch } = useSolicitudesExt(solicitudId);
  const [tipos, setTipos] = useState<TipoSolicitudExt[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tipoId, setTipoId] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { refetch(); }, [refetch]);
  useEffect(() => {
    fetchTiposSolicitudesExt().then(data => {
      setTipos(data.filter(t => t.estatus === 'Activo'));
    });
  }, []);

  const tipoSeleccionado = tipos.find(t => t.id === tipoId);

  const handleCrear = async () => {
    if (!tipoId) { toast.error('Seleccione un tipo de solicitud'); return; }
    setEnviando(true);
    const result = await crearSolicitudExt({ solicitud_id: solicitudId, tipo_id: tipoId, usuario, notas });
    setEnviando(false);
    if (result.ok) {
      toast.success('Solicitud extraordinaria creada', { description: `ID: ${result.id?.substring(0, 8)}...` });
      setShowForm(false);
      setTipoId('');
      setNotas('');
      refetch();
    } else {
      toast.error('Error', { description: result.error });
    }
  };

  const TIPO_ICONS: Record<string, React.ReactNode> = {
    'CANCELACION': <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="6"/><path d="M4 4l6 6M10 4l-6 6"/></svg>,
    'RENOVACION':  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7A5 5 0 1 0 4 3"/><path d="M2 3v4h4"/></svg>,
    'FINIQUITO':   <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7h10M7 2l5 5-5 5"/></svg>,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{rows.length} solicitud{rows.length !== 1 ? 'es' : ''} extraordinaria{rows.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-3 py-1.5 text-xs font-medium rounded border border-[#4A6FA5] bg-[#4A6FA5] text-white hover:bg-[#3A5A8A] flex items-center gap-1.5 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5.5 1v9M1 5.5h9"/></svg>
          Nueva Solicitud
        </button>
      </div>

      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}

      {/* Form */}
      {showForm && (
        <div className="border border-[#4A6FA5]/30 rounded-xl bg-blue-50/40 p-4 space-y-4">
          <p className="text-xs font-semibold text-[#4A6FA5] uppercase tracking-wide">Nueva Solicitud Extraordinaria</p>

          {/* Tipo cards */}
          <div className="grid grid-cols-3 gap-3">
            {tipos.map(t => (
              <button
                key={t.id}
                onClick={() => setTipoId(t.id)}
                className={`p-3 rounded-lg border text-left transition-all ${tipoId === t.id
                  ? 'border-[#4A6FA5] bg-[#4A6FA5] text-white shadow-sm'
                  : 'border-gray-200 bg-white hover:border-[#4A6FA5]/50 hover:bg-blue-50/50 text-gray-700'
                }`}
              >
                <div className={`mb-1.5 ${tipoId === t.id ? 'text-white' : 'text-[#4A6FA5]'}`}>
                  {TIPO_ICONS[t.clave] || <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="10" height="10" rx="1.5"/><path d="M5 7h4M7 5v4"/></svg>}
                </div>
                <p className="text-[11px] font-bold leading-tight">{t.nombre}</p>
                {t.area && <p className={`text-[10px] mt-0.5 ${tipoId === t.id ? 'text-blue-100' : 'text-gray-400'}`}>{t.area}</p>}
              </button>
            ))}
            {tipos.length === 0 && (
              <div className="col-span-3 py-6 text-center text-xs text-gray-400">Sin tipos de solicitud configurados</div>
            )}
          </div>

          {/* Descripción del tipo */}
          {tipoSeleccionado && (
            <div className="bg-white border border-blue-100 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p className="font-semibold text-[#4A6FA5]">{tipoSeleccionado.nombre}</p>
              {tipoSeleccionado.puesto && <p><span className="text-gray-400">Puesto responsable:</span> {tipoSeleccionado.puesto}</p>}
              {tipoSeleccionado.prompt_ia && <p className="text-gray-500 italic">{tipoSeleccionado.prompt_ia.substring(0, 120)}...</p>}
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Notas / Justificación</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Describa el motivo de la solicitud..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setTipoId(''); setNotas(''); }} className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100">
              Cancelar
            </button>
            <button onClick={handleCrear} disabled={enviando || !tipoId} className="px-5 py-2 text-xs bg-[#4A6FA5] text-white rounded-lg hover:bg-[#3A5A8A] disabled:opacity-50 font-medium">
              {enviando ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#2E5C91] text-white">
              <th className="px-2 py-2 text-left font-medium">Tipo</th>
              <th className="px-2 py-2 text-left font-medium">Clave</th>
              <th className="px-2 py-2 text-left font-medium">Fecha</th>
              <th className="px-2 py-2 text-left font-medium">Usuario</th>
              <th className="px-2 py-2 text-left font-medium">Notas</th>
              <th className="px-2 py-2 text-left font-medium">Autoriza</th>
              <th className="px-2 py-2 text-center font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  <p className="text-xs">Sin solicitudes extraordinarias</p>
                </td>
              </tr>
            ) : rows.map((r, idx) => (
              <tr key={r.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-2 py-2 font-medium text-gray-800">{r.tipo_nombre || '—'}</td>
                <td className="px-2 py-2 font-mono text-gray-500 text-[10px]">{r.tipo_clave || '—'}</td>
                <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{fmtDate(r.fecha)}</td>
                <td className="px-2 py-2 text-gray-600">{r.usuario}</td>
                <td className="px-2 py-2 text-gray-500 max-w-[160px] truncate" title={r.notas || ''}>{r.notas || '—'}</td>
                <td className="px-2 py-2 text-gray-500 text-[10px]">
                  {r.usuario_autoriza ? <span>{r.usuario_autoriza}<br/><span className="text-gray-400">{fmtDate(r.fecha_autoriza)}</span></span> : '—'}
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTATUS_COLOR[r.estatus] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {r.estatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
