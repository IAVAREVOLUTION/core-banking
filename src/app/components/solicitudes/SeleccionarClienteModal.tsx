import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

/** Estructura cruda de J_CLIENTES.data */
interface JClienteRow {
  id: string;
  type: string;
  subtipo: string;
  estatus: string;
  data: Record<string, any>;
  par_cliente_id: string | null;
}

/** Cliente procesado para mostrar en el modal */
interface ClienteItem {
  dbUuid: string;       // row.id (UUID real en J_CLIENTES)
  idCliente: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  rfc: string;
  curp: string;
  personalidad: string;
  domicilio: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
}

/** Mapea fila cruda de J_CLIENTES → ClienteItem */
function mapRow(row: JClienteRow): ClienteItem {
  const d = row.data || {};
  const def = d.default || {};
  const g = (key: string) => d[key] || def[key] || '';

  const nombre = g('nombre');
  const apellidoPaterno = g('apellidoPaterno');
  const apellidoMaterno = g('apellidoMaterno');

  // Normalizar personalidad: puede venir de subtipo o de data.personalidad
  const rawPersonalidad = (row.subtipo || g('personalidad') || g('tipoPersona') || '').trim();
  const normalizarPersonalidad = (val: string): string => {
    const lower = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower === 'fisica' || lower === 'persona fisica' || lower === 'pf') return 'Física';
    if (lower === 'moral' || lower === 'persona moral' || lower === 'pm') return 'Moral';
    return val || '';
  };

  // Construir domicilio desde múltiples posibles estructuras del JSONB
  const dirs = d.direcciones || def.direcciones || [];
  const dir0 = Array.isArray(dirs) && dirs.length > 0 ? dirs[0] : {};
  const domicilioParts = [
    dir0.calle || d.calle || def.calle || '',
    dir0.numeroExterior || d.numeroExterior || '',
    dir0.colonia || d.colonia || def.colonia || '',
    dir0.municipio || d.municipio || def.municipio || '',
    dir0.estado || dir0.entidadFederativa || d.entidadFederativa || def.entidadFederativa || '',
    dir0.codigoPostal ? `C.P. ${dir0.codigoPostal}` : (d.codigoPostal ? `C.P. ${d.codigoPostal}` : ''),
  ].filter(Boolean);
  const domicilio = domicilioParts.length > 0
    ? domicilioParts.join(', ')
    : (d.domicilio || def.domicilio || '');

  return {
    dbUuid: row.id || '',
    idCliente: g('idCliente') || g('idProspecto') || '',
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    nombreCompleto: [nombre, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ') || 'Sin nombre',
    rfc: g('rfc'),
    curp: g('curp'),
    personalidad: normalizarPersonalidad(rawPersonalidad),
    domicilio,
    telefono: g('telefono') || g('celular') || g('telefonoCelular') || '',
    email: g('correoElectronico') || g('email') || g('correo') || '',
    fechaNacimiento: g('fechaNacimiento') || g('fechaNac') || '',
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (cliente: ClienteItem) => void;
}

export function SeleccionarClienteModal({ isOpen, onClose, onSelect }: Props) {
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSearch('');
    setSelectedIdx(null);

    fetch(`${API_BASE}/clientes-lista-todos`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    })
      .then(res => {
        console.log(`[SeleccionarCliente] HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(json => {
        const rows: JClienteRow[] = json.data || [];
        console.log(`[SeleccionarCliente] ${rows.length} registros crudos`);
        const mapped = rows.map(mapRow).filter(c => c.nombre);
        console.log(`[SeleccionarCliente] ${mapped.length} clientes mapeados con nombre`);
        if (mapped.length > 0) {
          console.log('[SeleccionarCliente] Ejemplo:', { id: mapped[0].idCliente, nombre: mapped[0].nombreCompleto, personalidad: mapped[0].personalidad });
        }
        setClientes(mapped);
      })
      .catch(err => {
        toast.error('Error al cargar clientes');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filtered = clientes.filter(c => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      c.nombreCompleto.toLowerCase().includes(term) ||
      c.idCliente.toLowerCase().includes(term) ||
      c.rfc.toLowerCase().includes(term) ||
      c.curp.toLowerCase().includes(term)
    );
  });

  const handleConfirm = () => {
    if (selectedIdx === null) { toast.error('Seleccione un cliente'); return; }
    onSelect(filtered[selectedIdx]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-gray-200/50 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-[#4A6FA5] to-[#607698]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="9" cy="6" r="3" />
                <path d="M3 16c0-3 2.7-5 6-5s6 2 6 5" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Seleccionar Cliente</h3>
              <p className="text-[10px] text-white/70">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedIdx(null); }}
              placeholder="Buscar por nombre, ID, RFC o CURP..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-[#4A6FA5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
              <span className="ml-2 text-sm text-gray-500">Cargando clientes...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">{search ? 'No se encontraron clientes' : 'No hay clientes registrados'}</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">RFC</th>
                  <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c, idx) => (
                  <tr
                    key={c.idCliente || idx}
                    onClick={() => setSelectedIdx(idx)}
                    onDoubleClick={handleConfirm}
                    className={`cursor-pointer transition-colors ${
                      selectedIdx === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-700">{c.idCliente || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-800">{c.nombreCompleto}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 font-mono">{c.rfc || '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        c.personalidad === 'Moral' 
                          ? 'bg-purple-100 text-purple-700' 
                          : c.personalidad === 'Física' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.personalidad || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <span className="text-[10px] text-gray-400">
            {selectedIdx !== null ? `Seleccionado: ${filtered[selectedIdx]?.nombreCompleto}` : 'Seleccione un cliente'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={selectedIdx === null}
              className="px-5 py-2 bg-[#4A6FA5] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 hover:bg-[#3A5A8A] transition-colors shadow-sm">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2.5 6l2.5 2.5 4.5-4.5" />
              </svg>
              Seleccionar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
