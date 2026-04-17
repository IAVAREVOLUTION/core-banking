import { useState } from 'react';
import { toast } from 'sonner';
import { DatePicker } from './DatePicker';
import { PercentageInput } from './PercentageInput';
import { useProductosCatalogoDB } from '../../hooks/useProductosCatalogoDB';
import { useSolicitudesDB } from '../../hooks/useSolicitudesDB';
import { consumeNoSol, getFechaSolicitudNow, EMPTY_FORM } from '../solicitudes/solicitudCreditoStore';
import type { SolicitudFormData } from '../solicitudes/solicitudCreditoStore';
import type { Cliente } from './ClientesList';

interface SolicitudesCreditoProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string;
  cliente?: Cliente;
  onVerSolicitudCompleta?: (solicitudId: string, noSol: string) => void;
}

function mapPersonalidad(personalidad?: string): string {
  if (!personalidad) return '';
  return personalidad.toLowerCase().includes('moral') ? 'Moral' : 'Física';
}

function isoToDisplay(val?: string | null): string {
  if (!val) return '';
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return val;
}

function getCurrentDate() {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
}

const emptyModalForm = () => ({
  fechaSolicitud: getCurrentDate(),
  lineaProducto: '',
  tipoProducto: '',
  productoId: '',
  producto: '',
  montoSolicitado: '',
  montoAutorizado: '',
  plazo: '',
  periodicidad: '',
  tasa: '',
  fechaInicio: '',
  fechaFin: '',
  estatusSolicitud: 'Pendiente',
});

export function SolicitudesCredito({ mode, clienteId, cliente, onVerSolicitudCompleta }: SolicitudesCreditoProps) {
  const isView = mode === 'ver';

  const { productos: productosDB } = useProductosCatalogoDB(true);
  const { solicitudes: solicitudesDB, saveSolicitud } = useSolicitudesDB(true);

  const solicitudes = clienteId
    ? solicitudesDB.filter(s => (s as any)._clienteId === clienteId)
    : solicitudesDB;

  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDbId, setEditingDbId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState(emptyModalForm());

  // Líneas/tipos/productos encadenados del catálogo real
  const lineasProducto = [...new Set(productosDB.map(p => p.lineaProducto).filter(Boolean))].sort();
  const tiposProducto = [...new Set(
    productosDB.filter(p => !formData.lineaProducto || p.lineaProducto === formData.lineaProducto)
      .map(p => p.sublineaProducto).filter(Boolean)
  )].sort();
  const productosFiltrados = productosDB.filter(p =>
    (!formData.lineaProducto || p.lineaProducto === formData.lineaProducto) &&
    (!formData.tipoProducto || p.sublineaProducto === formData.tipoProducto)
  );

  const periodicidades = ['Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral'];
  const estatusSolicitudes = ['Pendiente', 'Aprobado', 'En Análisis', 'Rechazado', 'Cancelado'];

  const handleNuevo = () => {
    setEditingDbId(null);
    setFormData(emptyModalForm());
    setShowModal(true);
  };

  const handleVerSolicitud = (s: any) => {
    const d = (s as any)._data || {};
    const tc = d.solicitud?.terminos_condiciones || {};
    const ps = tc.parametros_simulacion || {};
    const raw = tc._raw || {};
    // fechaInicio/fechaFin: primero JSONB (donde realmente se guardan), luego columna DB como fallback
    const fechaInicio = isoToDisplay(raw.fechaPrimerPago || raw.fechaInicio || ps.fecha_primer_pago || (s as any)._fechaInicio);
    const fechaFin    = isoToDisplay(raw.fechaFin || ps.fecha_fin || (s as any)._fechaFin);
    setEditingDbId((s as any)._dbId || null);
    setFormData({
      fechaSolicitud: s.fechaSolicitud || getCurrentDate(),
      lineaProducto: (s as any)._lineaProducto || '',
      tipoProducto: s.tipoProducto || '',
      productoId: (s as any)._productoId || '',
      producto: s.nombreProducto || '',
      montoSolicitado: s.montoSolicitado > 0 ? String(s.montoSolicitado) : '',
      montoAutorizado: s.montoAutorizado > 0 ? String(s.montoAutorizado) : '',
      plazo: ps.plazo || raw.plazo || '',
      periodicidad: ps.periodicidad || raw.frecuencia || '',
      tasa: ps.tasa_interes || raw.tasa || '',
      fechaInicio,
      fechaFin,
      estatusSolicitud: s.estatusSolicitud || 'Pendiente',
    });
    setShowModal(true);
  };

  const handleGuardarModal = async () => {
    if (formData.montoSolicitado) {
      const ms = parseFloat(formData.montoSolicitado.replace(/[^0-9.]/g, ''));
      if (ms <= 0) { toast.error('El Monto Solicitado debe ser mayor a 0'); return; }
      if (formData.montoAutorizado) {
        const ma = parseFloat(formData.montoAutorizado.replace(/[^0-9.]/g, ''));
        if (ma > ms) toast.warning('El Monto Autorizado es mayor al Solicitado.');
      }
    }
    if (formData.estatusSolicitud === 'Aprobado' && !formData.montoAutorizado) {
      toast.error('Si el Estatus es Aprobado, el Monto Autorizado es obligatorio'); return;
    }
    if (formData.fechaInicio && formData.fechaFin) {
      const fi = new Date(formData.fechaInicio.split('/').reverse().join('-'));
      const ff = new Date(formData.fechaFin.split('/').reverse().join('-'));
      if (ff < fi) { toast.error('La Fecha de Fin no puede ser menor a la Fecha de Inicio'); return; }
    }

    const form: SolicitudFormData & { _clienteId?: string } = {
      ...EMPTY_FORM,
      noSol: editingDbId ? '' : consumeNoSol(),
      fechaSolicitud: formData.fechaSolicitud || getFechaSolicitudNow(),
      lineaProducto: formData.lineaProducto,
      tipoProducto: formData.tipoProducto,
      productoId: formData.productoId,
      nombreProducto: formData.producto,
      montoSolicitado: formData.montoSolicitado,
      montoAutorizado: formData.montoAutorizado,
      tipoPersona: mapPersonalidad(cliente?.personalidad),
      nombrePersona: cliente?.nombre || '',
      apellidoPaternoPersona: cliente?.apellidoPaterno || '',
      apellidoMaternoPersona: cliente?.apellidoMaterno || '',
      estatusSolicitud: formData.estatusSolicitud,
      _clienteId: clienteId || '',
      _curp: cliente?.curp || '',
      _rfc: cliente?.rfc || '',
    };

    const terminos = {
      montoSolicitado: formData.montoSolicitado,
      plazo: formData.plazo,
      frecuencia: formData.periodicidad,
      tasa: formData.tasa,
      fechaPrimerPago: formData.fechaInicio,
      fechaInicio: formData.fechaInicio,
      fechaFin: formData.fechaFin,
    };

    setSaving(true);
    const result = await saveSolicitud(form as SolicitudFormData, editingDbId || undefined, { terminos });
    setSaving(false);

    if (result.ok) {
      toast.success(editingDbId ? 'Solicitud actualizada' : 'Solicitud creada exitosamente');
      setShowModal(false);
    } else {
      toast.error('Error al guardar', { description: result.error });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? solicitudes.map(s => (s as any)._dbId || s.id) : []);
  };
  const handleSelectItem = (id: string | number, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  };

  function getTerminos(s: any) {
    const d = (s as any)._data || {};
    const tc = d.solicitud?.terminos_condiciones || {};
    const ps = tc.parametros_simulacion || {};
    const raw = tc._raw || {};
    return {
      plazo: ps.plazo || raw.plazo || '',
      periodicidad: ps.periodicidad || raw.frecuencia || '',
      tasa: ps.tasa_interes || raw.tasa || '',
    };
  }

  return (
    <div className="bg-white">
      {/* Encabezado institucional con título y botones */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">SOLICITUDES DE CRÉDITO</span>
        {!isView && (
          <div className="flex items-center gap-2">
            <button onClick={handleNuevo} className="px-4 py-1.5 btn-secondary-theme rounded text-xs font-medium">
              Nuevo
            </button>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                <input type="checkbox" checked={solicitudes.length > 0 && selectedIds.length === solicitudes.length} onChange={e => handleSelectAll(e.target.checked)} className="w-4 h-4" disabled={isView} />
              </th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Solicitud</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">No. Solicitud</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Línea Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tipo Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Producto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Solicitado</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto Autorizado</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Plazo</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Periodicidad</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tasa</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {solicitudes.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-xs text-gray-500">
                  No hay solicitudes de crédito registradas. Haga clic en "Nuevo" para agregar una.
                </td>
              </tr>
            ) : (
              solicitudes.map(s => {
                const sid = (s as any)._dbId || s.id;
                const t = getTerminos(s);
                return (
                  <tr key={String(sid)} className={`border-b border-gray-300 hover:bg-gray-50 ${selectedIds.includes(sid) ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-2 text-center border-r border-gray-300">
                      <input type="checkbox" checked={selectedIds.includes(sid)} onChange={e => handleSelectItem(sid, e.target.checked)} className="w-4 h-4" onClick={e => e.stopPropagation()} disabled={isView} />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{s.fechaSolicitud}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{s.noSol}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{(s as any)._lineaProducto || ''}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{s.tipoProducto}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{s.nombreProducto}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{s.montoSolicitado > 0 ? `$${s.montoSolicitado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : ''}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{s.montoAutorizado > 0 ? `$${s.montoAutorizado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : ''}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{t.plazo}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{t.periodicidad}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{t.tasa}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                        s.estatusSolicitud === 'Aprobado' ? 'bg-green-100 text-green-800' :
                        s.estatusSolicitud === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                        s.estatusSolicitud === 'En Proceso' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>{s.estatusSolicitud}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button 
                        onClick={e => { 
                          e.stopPropagation(); 
                          const dbId = (s as any)._dbId;
                          if (onVerSolicitudCompleta && dbId) {
                            onVerSolicitudCompleta(dbId, s.noSol, clienteId);
                          } else {
                            handleVerSolicitud(s);
                          }
                        }} 
                        className="inline-flex items-center justify-center px-3 py-1 btn-secondary-theme text-xs rounded font-medium"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo / Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                {editingDbId ? 'Editar Solicitud de Crédito' : 'Nueva Solicitud de Crédito'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
                <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DE LA SOLICITUD</h3>
              </div>

              <div className="space-y-4">
                {/* Fila 1 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de Solicitud <span className="text-red-600">*</span></label>
                    <DatePicker value={formData.fechaSolicitud} onChange={date => setFormData(p => ({ ...p, fechaSolicitud: date }))} placeholder="DD/MM/YYYY" className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Línea de Producto <span className="text-red-600">*</span></label>
                    <select value={formData.lineaProducto} onChange={e => setFormData(p => ({ ...p, lineaProducto: e.target.value, tipoProducto: '', productoId: '', producto: '' }))} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white">
                      <option value="">Seleccione...</option>
                      {lineasProducto.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo de Producto <span className="text-red-600">*</span></label>
                    <select value={formData.tipoProducto} onChange={e => setFormData(p => ({ ...p, tipoProducto: e.target.value, productoId: '', producto: '' }))} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white">
                      <option value="">Seleccione...</option>
                      {tiposProducto.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Fila 2 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Producto <span className="text-red-600">*</span></label>
                    <select value={formData.productoId} onChange={e => { const p = productosFiltrados.find(x => x.id === e.target.value); setFormData(prev => ({ ...prev, productoId: e.target.value, producto: p?.nombreProducto || '' })); }} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white">
                      <option value="">Seleccione...</option>
                      {productosFiltrados.map(p => <option key={p.id} value={p.id}>{p.nombreProducto}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Monto Solicitado <span className="text-red-600">*</span></label>
                    <input type="text" value={formData.montoSolicitado} onChange={e => setFormData(p => ({ ...p, montoSolicitado: e.target.value }))} placeholder="$ 0.00" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Monto Autorizado</label>
                    <input type="text" value={formData.montoAutorizado} onChange={e => setFormData(p => ({ ...p, montoAutorizado: e.target.value }))} placeholder="$ 0.00" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white" />
                  </div>
                </div>

                {/* Fila 3 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Plazo <span className="text-red-600">*</span></label>
                    <input type="text" value={formData.plazo} onChange={e => setFormData(p => ({ ...p, plazo: e.target.value }))} placeholder="12" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Periodicidad <span className="text-red-600">*</span></label>
                    <select value={formData.periodicidad} onChange={e => setFormData(p => ({ ...p, periodicidad: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white">
                      <option value="">Seleccione...</option>
                      {periodicidades.map(per => <option key={per} value={per}>{per}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Tasa <span className="text-red-600">*</span></label>
                    <PercentageInput value={formData.tasa} onChange={value => setFormData(p => ({ ...p, tasa: value }))} placeholder="15%" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white" />
                  </div>
                </div>

                {/* Fila 4 */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de Inicio</label>
                    <DatePicker value={formData.fechaInicio} onChange={date => setFormData(p => ({ ...p, fechaInicio: date }))} placeholder="DD/MM/YYYY" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de Fin</label>
                    <DatePicker value={formData.fechaFin} onChange={date => setFormData(p => ({ ...p, fechaFin: date }))} placeholder="DD/MM/YYYY" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Estatus <span className="text-red-600">*</span></label>
                    <select value={formData.estatusSolicitud} onChange={e => setFormData(p => ({ ...p, estatusSolicitud: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white">
                      {estatusSolicitudes.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium">Cancelar</button>
              <button onClick={handleGuardarModal} disabled={saving} className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90 font-medium disabled:opacity-60">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
