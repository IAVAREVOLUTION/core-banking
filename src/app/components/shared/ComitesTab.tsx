/**
 * ComitesTab.tsx — Componente compartido Solicitudes + Originación
 *
 * Gestión de Comités de Autorización.
 * readOnly = true  → solo visualización (Originación)
 * readOnly = false → CRUD completo (Solicitudes)
 *
 * Persiste en sol_credito_{id}_comites (mismo namespace que el resto
 * de subtabs de Solicitudes, garantizando sincronización entre módulos).
 */
import { useState, useEffect } from 'react';
import {
  saveToSession,
  loadFromSession,
  loadFromSavedStore,
  generateId,
} from '../solicitudes/solicitudCreditoStore';

// ── Tipos ──────────────────────────────────────────────────────────
export interface Comite {
  id: number;
  autoridad: string;
  estatus: 'Pendiente' | 'Autorizado' | 'Rechazado';
  fecha: string;
  observaciones: string;
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  /** override de sólo-lectura (Originación pasa true) */
  readOnly?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────
const CAT_ESTATUS: Comite['estatus'][] = ['Pendiente', 'Autorizado', 'Rechazado'];

const badge = (estatus: string) => {
  if (estatus === 'Autorizado') return 'bg-green-100 text-green-700 border-green-200';
  if (estatus === 'Rechazado') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-yellow-100 text-yellow-700 border-yellow-200';
};

function nowStr() {
  const n = new Date();
  return `${n.getDate().toString().padStart(2, '0')}/${(n.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${n.getFullYear()} ${n.getHours().toString().padStart(2, '0')}:${n
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

// ── Componente ────────────────────────────────────────────────────
export function ComitesTab({ mode, solicitudId, readOnly }: Props) {
  const isRO = readOnly !== undefined ? readOnly : mode === 'ver';

  const getInit = (): Comite[] => {
    const s = loadFromSession<Comite[]>(solicitudId, 'comites');
    if (s) return s;
    if (mode === 'nuevo') return [];
    return loadFromSavedStore<Comite[]>(solicitudId, 'comites') || [];
  };

  const [items, setItems] = useState<Comite[]>(getInit);

  // Persistir en sessionStorage compartido (sol_credito_)
  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, 'comites', items);
  }, [items, solicitudId, isRO]);

  const handleAgregar = () => {
    setItems(p => [
      ...p,
      {
        id: generateId(),
        autoridad: '',
        estatus: 'Pendiente',
        fecha: nowStr(),
        observaciones: '',
      },
    ]);
  };

  const handleEliminar = (id: number) =>
    setItems(p => p.filter(c => c.id !== id));

  const update = <K extends keyof Comite>(id: number, field: K, value: Comite[K]) =>
    setItems(p => p.map(c => (c.id === id ? { ...c, [field]: value } : c)));

  const ic = 'w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-[#4A6FA5] bg-white text-gray-800';
  const icRO = 'w-full px-2 py-1 border border-gray-200 rounded text-xs bg-gray-50 text-gray-700';

  return (
    <div className="bg-white border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-800 flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4A6FA5" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
          Comités de Autorización
        </h4>
        {!isRO && (
          <button
            onClick={handleAgregar}
            className="px-3 py-1 bg-[#4A6FA5] text-white rounded text-xs hover:bg-[#3d5d8a] flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 1v10M1 6h10" />
            </svg>
            Agregar Comité
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
          <p className="text-xs">Sin comités registrados</p>
          {!isRO && (
            <p className="text-[10px] mt-1 text-gray-400">Haga clic en "Agregar Comité" para registrar un comité de autorización</p>
          )}
        </div>
      ) : (
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600 font-medium w-1/4">Autoridad / Comité</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium w-28">Estatus</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium w-36">Fecha</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Observaciones</th>
                {!isRO && <th className="px-3 py-2 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((c, idx) => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  {/* Autoridad */}
                  <td className="px-3 py-2">
                    {isRO ? (
                      <span className="text-gray-800">{c.autoridad || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        value={c.autoridad}
                        onChange={e => update(c.id, 'autoridad', e.target.value)}
                        className={ic}
                        placeholder="Comité de Crédito..."
                      />
                    )}
                  </td>

                  {/* Estatus */}
                  <td className="px-3 py-2">
                    {isRO ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${badge(c.estatus)}`}>
                        {c.estatus}
                      </span>
                    ) : (
                      <select
                        value={c.estatus}
                        onChange={e => update(c.id, 'estatus', e.target.value as Comite['estatus'])}
                        className={ic}
                      >
                        {CAT_ESTATUS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Fecha */}
                  <td className="px-3 py-2">
                    <span className={isRO ? 'text-gray-600' : icRO.replace('w-full ', '')}>{c.fecha || '—'}</span>
                  </td>

                  {/* Observaciones */}
                  <td className="px-3 py-2">
                    {isRO ? (
                      <span className="text-gray-700">{c.observaciones || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        value={c.observaciones}
                        onChange={e => update(c.id, 'observaciones', e.target.value)}
                        className={ic}
                        placeholder="Resultado, condiciones..."
                      />
                    )}
                  </td>

                  {/* Acciones */}
                  {!isRO && (
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleEliminar(c.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Eliminar comité"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 3.5h10M5.5 3.5V2.5h3v1M3.5 3.5l.5 8h6l.5-8" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Resumen */}
          <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 flex items-center gap-4 text-[10px] text-gray-500">
            <span>Total: <strong>{items.length}</strong></span>
            <span className="text-green-600">
              Autorizados: <strong>{items.filter(c => c.estatus === 'Autorizado').length}</strong>
            </span>
            <span className="text-yellow-600">
              Pendientes: <strong>{items.filter(c => c.estatus === 'Pendiente').length}</strong>
            </span>
            <span className="text-red-600">
              Rechazados: <strong>{items.filter(c => c.estatus === 'Rechazado').length}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
