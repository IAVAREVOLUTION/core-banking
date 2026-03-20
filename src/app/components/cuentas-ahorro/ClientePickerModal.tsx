/**
 * ClientePickerModal.tsx — Pick Map de Clientes
 *
 * Modal que carga clientes reales desde J_CLIENTES (via RPC get_all_jclientes)
 * y permite seleccionar uno para vincularlo a la cuenta de ahorro.
 *
 * Pick Map (lo que retorna al seleccionar):
 *   cliente_id   = J_CLIENTES.id
 *   claveCliente = J_CLIENTES.data.idCliente
 *   nombreCompleto = nombre + apellidos | razonSocial
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabaseClient';

export interface ClientePickResult {
  clienteId: string;       // UUID de J_CLIENTES
  claveCliente: string;    // data.idCliente
  nombreCompleto: string;  // nombre + apellidos
}

interface ClienteRow {
  id: string;
  type: string;
  subtipo: string;
  estatus: string;
  data: Record<string, any>;
}

interface ClientePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (result: ClientePickResult) => void;
}

export function ClientePickerModal({ open, onClose, onSelect }: ClientePickerModalProps) {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<string>('');

  const fetchClientes = useCallback(async () => {
    setLoading(true);

    // Intento 1: RPC
    try {
      const { data, error } = await supabase.rpc('get_all_jclientes');
      if (!error && Array.isArray(data) && data.length > 0) {
        setClientes(data as ClienteRow[]);
        setSource('RPC');
        setLoading(false);
        return;
      }
    } catch { /* fallthrough */ }

    // Intento 2: Direct schema access
    try {
      const { data, error } = await (supabase as any).schema('EFINANCIANET_DB').from('J_CLIENTES').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        setClientes(data as ClienteRow[]);
        setSource('Schema directo');
        setLoading(false);
        return;
      }
    } catch { /* fallthrough */ }

    setSource('Sin datos');
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchClientes();
      setSearch('');
    }
  }, [open, fetchClientes]);

  if (!open) return null;

  const resolveNombre = (row: ClienteRow): string => {
    const d = row.data || {};
    const nombre = (d.nombre || '').trim();
    const ap = (d.apellidoPaterno || '').trim();
    const am = (d.apellidoMaterno || '').trim();
    const full = [nombre, ap, am].filter(Boolean).join(' ');
    return full || d.razonSocial || d.idCliente || row.id;
  };

  const resolveClave = (row: ClienteRow): string => {
    return row.data?.idCliente || row.id?.slice(0, 8) || '';
  };

  const filtered = clientes.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    const nombre = resolveNombre(c).toLowerCase();
    const clave = resolveClave(c).toLowerCase();
    const rfc = (c.data?.rfc || '').toLowerCase();
    return nombre.includes(s) || clave.includes(s) || rfc.includes(s);
  });

  const handleSelect = (row: ClienteRow) => {
    onSelect({
      clienteId: row.id,
      claveCliente: resolveClave(row),
      nombreCompleto: resolveNombre(row),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
              <circle cx="9" cy="6" r="3" />
              <path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            </svg>
            <h3 className="text-sm text-gray-800">Seleccionar Cliente — J_CLIENTES</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-gray-200">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, clave o RFC..."
            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5] focus:outline-none"
            autoFocus
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-400">{source ? `Fuente: ${source}` : ''}</span>
            <span className="text-[10px] text-gray-500">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-gray-500">
              <svg className="animate-spin h-5 w-5 mr-2 text-[#4A6FA5]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando clientes desde J_CLIENTES...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-500">
              {clientes.length === 0
                ? 'No se encontraron clientes en la base de datos'
                : 'Sin resultados para la búsqueda'}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 sticky top-0">
                  <th className="px-3 py-2 text-left text-gray-600">CLAVE</th>
                  <th className="px-3 py-2 text-left text-gray-600">NOMBRE</th>
                  <th className="px-3 py-2 text-left text-gray-600">RFC</th>
                  <th className="px-3 py-2 text-center text-gray-600">TIPO</th>
                  <th className="px-3 py-2 text-center text-gray-600">ESTATUS</th>
                  <th className="px-3 py-2 text-center text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      i % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                    } hover:bg-blue-50`}
                    onDoubleClick={() => handleSelect(c)}
                  >
                    <td className="px-3 py-2 text-gray-700">{resolveClave(c)}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate" title={resolveNombre(c)}>
                      {resolveNombre(c)}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{c.data?.rfc || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700">
                        {c.subtipo || c.type || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        c.estatus === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {c.estatus || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleSelect(c)}
                        className="px-3 py-1 btn-secondary-theme rounded text-[10px]"
                      >
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-100">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
