import { useState, useEffect, useCallback } from 'react';
import { GL_BASE_URL, GL_HEADERS } from '../../hooks/usePolizasContablesDB';

const SOLICITUDES_URL = `${GL_BASE_URL}/solicitudes-credito`;

export interface CuentaPickResult {
  account_id: string;
  no_cuenta: string;
  producto_id: string;
  producto_display: string;
  cliente_id: string;
  cliente_nombre: string;
  moneda: string; // data.solicitud.terminos_condiciones._raw.moneda
}

interface CuentaRow {
  id: string;
  no_cuenta: string;
  no_sol: string;
  tipo_produc: string;
  linea_produc: string;
  producto_id: string;
  producto_nombre: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_ap_paterno: string;
  cliente_ap_materno: string;
  estatus_sol: string;
  estatus_cuen: string;
  data: Record<string, any>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (result: CuentaPickResult) => void;
}

export function CuentaFinancieraPickerModal({ open, onClose, onSelect }: Props) {
  const [rows, setRows] = useState<CuentaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchCuentas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(SOLICITUDES_URL, { headers: GL_HEADERS });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) setRows(json.data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) { fetchCuentas(); setSearch(''); }
  }, [open, fetchCuentas]);

  if (!open) return null;

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.id?.toLowerCase().includes(s) ||
      r.no_cuenta?.toLowerCase().includes(s) ||
      r.no_sol?.toLowerCase().includes(s) ||
      r.tipo_produc?.toLowerCase().includes(s) ||
      r.estatus_sol?.toLowerCase().includes(s) ||
      r.estatus_cuen?.toLowerCase().includes(s)
    );
  });

  const handleSelect = (row: CuentaRow) => {
    const parts = [row.cliente_nombre, row.cliente_ap_paterno, row.cliente_ap_materno].filter(Boolean);
    const moneda: string = row.data?.solicitud?.terminos_condiciones?._raw?.moneda || '';
    onSelect({
      account_id: row.id,
      no_cuenta: row.no_cuenta || '',
      producto_id: row.producto_id || '',
      producto_display: row.producto_nombre || row.tipo_produc || row.producto_id || '',
      cliente_id: row.cliente_id || '',
      cliente_nombre: parts.join(' ') || '',
      moneda,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[850px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
              <rect x="2" y="2" width="14" height="14" rx="2"/>
              <path d="M2 6h14M6 2v14"/>
            </svg>
            <h3 className="text-sm text-gray-800">Seleccionar Cuenta Financiera — J_CUENTAS_CORP_CLIENTES</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-gray-200">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por id, no. cuenta, no. sol, tipo producto, estatus..."
            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5] focus:outline-none"
            autoFocus
          />
          <div className="flex justify-end mt-1">
            <span className="text-[10px] text-gray-500">
              {filtered.length} cuenta{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-gray-500">
              <svg className="animate-spin h-4 w-4 mr-2 text-[#4A6FA5]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Cargando cuentas...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-500">
              {rows.length === 0 ? 'No se encontraron cuentas en J_CUENTAS_CORP_CLIENTES' : 'Sin resultados para la búsqueda'}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 sticky top-0">
                  <th className="px-3 py-2 text-left text-gray-600 font-semibold">ID</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-semibold">NO. CUENTA</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-semibold">NO. SOL</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-semibold">TIPO PRODUCTO</th>
                  <th className="px-3 py-2 text-center text-gray-600 font-semibold">ESTATUS SOL.</th>
                  <th className="px-3 py-2 text-center text-gray-600 font-semibold">ESTATUS CUEN.</th>
                  <th className="px-3 py-2 text-center text-gray-600 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50`}
                    onDoubleClick={() => handleSelect(r)}
                  >
                    <td className="px-3 py-2 font-mono text-gray-400 text-[10px]" title={r.id}>
                      {r.id?.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-800 font-medium">
                      {r.no_cuenta || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.no_sol || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {r.tipo_produc || r.linea_produc || '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        r.estatus_sol === 'Activa' || r.estatus_sol === 'Activo'
                          ? 'bg-green-100 text-green-700'
                          : r.estatus_sol
                            ? 'bg-gray-100 text-gray-600'
                            : 'text-gray-400'
                      }`}>
                        {r.estatus_sol || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        r.estatus_cuen === 'Activa' || r.estatus_cuen === 'Activo'
                          ? 'bg-green-100 text-green-700'
                          : r.estatus_cuen
                            ? 'bg-gray-100 text-gray-600'
                            : 'text-gray-400'
                      }`}>
                        {r.estatus_cuen || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleSelect(r)}
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
        <div className="px-5 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg flex items-center justify-between">
          <span className="text-[10px] text-gray-400">Doble clic o botón para seleccionar</span>
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
