/**
 * SolicitudPickerModal.tsx
 *
 * Modal selector for J_CUENTAS_CORP_CLIENTES.
 * Displays: no_sol, no_cuenta, linea_produc, data.solicitud.header.nombre_cliente
 * Returns the full row on selection.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabaseClient';

export interface JCuentasCorpRow {
  id: string;
  no_sol: string | null;
  no_cuenta: string | null;
  linea_produc: string | null;
  monto_sol: unknown;
  data: Record<string, unknown> | null;
  [key: string]: unknown;
}

interface SolicitudPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (row: JCuentasCorpRow) => void;
}

export function SolicitudPickerModal({ open, onClose, onSelect }: SolicitudPickerModalProps) {
  const [rows,    setRows]    = useState<JCuentasCorpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState('');

  const fetchRows = useCallback(async () => {
    setLoading(true);

    // Strategy 1: RPC
    try {
      const { data, error } = await supabase.rpc('get_cuentas_corp_clientes');
      if (!error && Array.isArray(data) && data.length > 0) {
        setRows(data as JCuentasCorpRow[]);
        setLoading(false);
        return;
      }
    } catch { /* fallthrough */ }

    // Strategy 2: Direct schema access
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('EFINANCIANET_DB')
        .from('J_CUENTAS_CORP_CLIENTES')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        setRows(data as JCuentasCorpRow[]);
      }
    } catch { /* ignore */ }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchRows();
      setSearch('');
    }
  }, [open, fetchRows]);

  if (!open) return null;

  const getNombreCliente = (row: JCuentasCorpRow): string => {
    const d = row.data || {};
    const sol = d.solicitud as Record<string, unknown> | undefined;
    const hdr = sol?.header as Record<string, unknown> | undefined;
    return String(hdr?.nombre_cliente || '—');
  };

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      String(r.id         || '').toLowerCase().includes(s) ||
      String(r.no_cuenta  || '').toLowerCase().includes(s) ||
      String(r.linea_produc || '').toLowerCase().includes(s) ||
      getNombreCliente(r).toLowerCase().includes(s)
    );
  });

  const handleSelect = (row: JCuentasCorpRow) => {
    onSelect(row);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[820px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
              <rect x="1" y="2" width="14" height="10" rx="1" />
              <path d="M4 8h8M4 5h5" />
            </svg>
            <h3 className="text-sm font-medium text-gray-800">
              Seleccionar Solicitud — J_CUENTAS_CORP_CLIENTES
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-gray-200">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID, Cuenta, Línea o Cliente..."
            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            autoFocus
          />
          <span className="text-[10px] text-gray-400 mt-1 block">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-gray-500">
              <svg className="animate-spin h-5 w-5 mr-2 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando solicitudes...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-500">
              {rows.length === 0
                ? 'No se encontraron registros en J_CUENTAS_CORP_CLIENTES'
                : 'Sin resultados para la búsqueda'}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 sticky top-0">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">NO. CUENTA</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">LÍNEA PRODUC</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">NOMBRE CLIENTE</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      i % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                    } hover:bg-blue-50`}
                    onDoubleClick={() => handleSelect(row)}
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-700 max-w-[180px] truncate" title={row.id}>
                      {row.id}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {row.no_cuenta || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {row.linea_produc || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate" title={getNombreCliente(row)}>
                      {getNombreCliente(row)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleSelect(row)}
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
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
