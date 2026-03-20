import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import * as store from './pldStore';

interface Props { mode?: 'ver' | 'editar' | 'nuevo'; onBack?: () => void; }

type KYCView = 'list' | 'detail';
type KYCMode = 'ver' | 'editar';

const ESTATUS_COLORS: Record<string, string> = {
  'Completo': 'bg-green-100 text-green-700 border-green-300',
  'En Proceso': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  'Pendiente': 'bg-orange-100 text-orange-700 border-orange-300',
  'Vencido': 'bg-red-100 text-red-700 border-red-300',
};

const RIESGO_COLORS: Record<string, string> = {
  'Bajo': 'bg-green-100 text-green-700 border-green-300',
  'Medio': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  'Alto': 'bg-red-100 text-red-700 border-red-300',
};

export function PLDKYCInfo({ onBack }: Props) {
  const [view, setView] = useState<KYCView>('list');
  const [detailMode, setDetailMode] = useState<KYCMode>('ver');
  const [kycClientes, setKycClientes] = useState<store.KYCData[]>(store.getKYCClientes);
  const [selectedKYC, setSelectedKYC] = useState<store.KYCData | null>(null);
  const [editData, setEditData] = useState<store.KYCData | null>(null);

  // Filtros lista
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('');
  const [filterRiesgo, setFilterRiesgo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    let result = kycClientes;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(k =>
        (k.clienteNombre || '').toLowerCase().includes(q) ||
        (k.clienteRFC || '').toLowerCase().includes(q) ||
        (k.noCalculado || '').toLowerCase().includes(q)
      );
    }
    if (filterEstatus) result = result.filter(k => k.estatusKYC === filterEstatus);
    if (filterRiesgo) result = result.filter(k => k.nivelRiesgo === filterRiesgo);
    return result;
  }, [kycClientes, searchTerm, filterEstatus, filterRiesgo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleView = (kyc: store.KYCData) => {
    setSelectedKYC(kyc);
    setEditData({ ...kyc });
    setDetailMode('ver');
    setView('detail');
  };

  const handleEdit = (kyc: store.KYCData) => {
    setSelectedKYC(kyc);
    setEditData({ ...kyc });
    setDetailMode('editar');
    setView('detail');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedKYC(null);
    setEditData(null);
    setKycClientes(store.getKYCClientes());
  };

  const update = (field: keyof store.KYCData, value: any) => {
    if (detailMode === 'ver' || !editData) return;
    setEditData(d => d ? { ...d, [field]: value } : d);
  };

  const handleSave = () => {
    if (!editData) return;
    const now = new Date();
    const fechaHoy = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    const updated: store.KYCData = {
      ...editData,
      estatusKYC: editData.aprobadoOficial ? 'Completo' : (editData.actividadEconomica || editData.ingresoMensual) ? 'En Proceso' : 'Pendiente',
      fechaUltimaRevision: fechaHoy,
    };
    store.saveKYCCliente(updated);
    setKycClientes(store.getKYCClientes());
    toast.success('KYC guardado', { description: `Información de "${updated.clienteNombre}" actualizada correctamente.` });
    handleBackToList();
  };

  const calcularRiesgo = () => {
    if (!editData) return;
    // Simulación de cálculo de riesgo ponderado
    let score = 20; // base
    if (editData.esPEP) score += 25;
    if (editData.funcionariosPublicos) score += 15;
    if (editData.resultadoCoincidencias) score += 20;
    if (editData.conyugeFamiliarPEP) score += 10;
    if (editData.ingresoMensual === 'Más de $100,000') score += 10;
    const nivel = score <= 35 ? 'Bajo' : score <= 60 ? 'Medio' : 'Alto';
    setEditData(d => d ? { ...d, calificacionPonderada: `${score}.0 puntos`, nivelRiesgo: nivel } : d);
    toast.info('Riesgo calculado', { description: `Calificacion: ${score}.0 — Nivel: ${nivel}` });
  };

  const isView = detailMode === 'ver';
  const data = editData;

  const labelCls = 'text-xs w-40 flex-shrink-0 text-gray-700';
  const inputCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded';
  const disabledCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600';

  // ══════════════════════════════════════════
  // VISTA LISTA
  // ══════════════════════════════════════════
  if (view === 'list') {
    return (
      <div className="flex-1 flex flex-col bg-white min-h-full">
        {/* Header */}
        <div className="bg-white px-4 py-3 border-b border-gray-300 flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#4A6FA5" strokeWidth="1.5"><circle cx="10" cy="8" r="4"/><path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>
          <h2 className="text-sm text-gray-800" style={{ fontWeight: 700 }}>KYC - Conozca a su Cliente</h2>
          <span className="text-xs text-gray-500 ml-2">({filtered.length} registros)</span>
        </div>

        {/* Barra de filtros */}
        <div className="px-4 py-2 bg-white border-b border-gray-300 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Buscar:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nombre, RFC, No. KYC..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="px-2 py-1 text-xs border border-gray-300 rounded w-56"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                  x
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Estatus:</label>
            <select value={filterEstatus} onChange={e => { setFilterEstatus(e.target.value); setCurrentPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded">
              <option value="">Todos</option>
              <option value="Completo">Completo</option>
              <option value="En Proceso">En Proceso</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Vencido">Vencido</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Riesgo:</label>
            <select value={filterRiesgo} onChange={e => { setFilterRiesgo(e.target.value); setCurrentPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded">
              <option value="">Todos</option>
              <option value="Bajo">Bajo</option>
              <option value="Medio">Medio</option>
              <option value="Alto">Alto</option>
            </select>
          </div>
          {(searchTerm || filterEstatus || filterRiesgo) && (
            <button
              onClick={() => { setSearchTerm(''); setFilterEstatus(''); setFilterRiesgo(''); setCurrentPage(1); }}
              className="px-2 py-1 text-xs text-[#4A6FA5] hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Barra exportación */}
        <div className="px-4 py-1.5 bg-white border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-gray-100 rounded" title="Exportar Excel">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="1.2"><rect x="1" y="1" width="12" height="12" rx="1"/><path d="M4 5l3 4 3-4"/></svg>
            </button>
            <button className="p-1 hover:bg-gray-100 rounded" title="Exportar PDF">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="1.2"><rect x="2" y="1" width="10" height="12" rx="1"/><path d="M5 5h4M5 7h4M5 9h2"/></svg>
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 px-4 py-3 bg-[#F5F5F5] overflow-auto">
          <div className="bg-white border border-gray-300">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D0D0D0]">
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>No. KYC</th>
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>Cliente</th>
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>RFC</th>
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>Personalidad</th>
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>Sucursal</th>
                  <th className="px-3 py-2 text-center" style={{ fontWeight: 600 }}>Estatus KYC</th>
                  <th className="px-3 py-2 text-center" style={{ fontWeight: 600 }}>Nivel Riesgo</th>
                  <th className="px-3 py-2 text-left" style={{ fontWeight: 600 }}>Ult. Revision</th>
                  <th className="px-3 py-2 text-center" style={{ fontWeight: 600 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-gray-500">No se encontraron registros KYC</td>
                  </tr>
                ) : paged.map((kyc, idx) => (
                  <tr key={kyc.clienteId || idx} className={idx % 2 === 1 ? 'bg-[#EEEEEE]' : 'bg-white'}>
                    <td className="px-3 py-2 text-[#4A6FA5]" style={{ fontWeight: 500 }}>{kyc.noCalculado}</td>
                    <td className="px-3 py-2" style={{ fontWeight: 500 }}>{kyc.clienteNombre}</td>
                    <td className="px-3 py-2 font-mono">{kyc.clienteRFC}</td>
                    <td className="px-3 py-2">{kyc.clientePersonalidad}</td>
                    <td className="px-3 py-2">{kyc.clienteSucursal}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${ESTATUS_COLORS[kyc.estatusKYC || 'Pendiente']}`} style={{ fontWeight: 500 }}>
                        {kyc.estatusKYC || 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${RIESGO_COLORS[kyc.nivelRiesgo || 'Bajo']}`} style={{ fontWeight: 500 }}>
                        {kyc.nivelRiesgo || 'Sin evaluar'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{kyc.fechaUltimaRevision || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => handleEdit(kyc)} className="text-[#0099CC] hover:underline text-xs mr-2">Editar</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => handleView(kyc)} className="text-[#4A6FA5] hover:underline text-xs ml-2">Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginacion */}
          {filtered.length > pageSize && (
            <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
              <span>Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">Anterior</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`px-2 py-1 border rounded ${currentPage === p ? 'bg-[#4A6FA5] text-white border-[#4A6FA5]' : 'border-gray-300 hover:bg-gray-100'}`}
                  >
                    {p}
                  </button>
                ))}
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // VISTA DETALLE (VER/EDITAR)
  // ══════════════════════════════════════════
  if (!data) return null;

  return (
    <div className="flex-1 flex flex-col bg-white min-h-full">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300 flex items-center gap-3">
        <button onClick={handleBackToList} className="text-[#4A6FA5] hover:text-[#3a5a8a] mr-1" title="Volver a la lista">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4L6 9l5 5"/></svg>
        </button>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#4A6FA5" strokeWidth="1.5"><circle cx="10" cy="8" r="4"/><path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>
        <h2 className="text-sm text-gray-800" style={{ fontWeight: 700 }}>
          KYC — {data.clienteNombre}
        </h2>
        <span className={`ml-2 inline-block px-2 py-0.5 rounded text-[10px] border ${ESTATUS_COLORS[data.estatusKYC || 'Pendiente']}`} style={{ fontWeight: 500 }}>
          {data.estatusKYC || 'Pendiente'}
        </span>
        {isView && (
          <button
            onClick={() => setDetailMode('editar')}
            className="ml-auto px-4 py-1.5 bg-[#4A6FA5] text-white rounded text-xs hover:bg-[#3a5a8a]"
            style={{ fontWeight: 500 }}
          >
            Editar KYC
          </button>
        )}
      </div>

      {/* Botones */}
      <div className="px-4 py-2 bg-white border-b border-gray-300 flex items-center gap-3">
        {!isView && (
          <button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB]" style={{ fontWeight: 500 }}>Guardar</button>
        )}
        <button onClick={handleBackToList} className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700">
          {isView ? 'Volver' : 'Cancelar'}
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 px-4 py-4 bg-[#F5F5F5] overflow-auto">
        <div className="bg-white border border-gray-300 p-4">

          {/* Seccion: Datos del Cliente */}
          <div className="mb-4">
            <div className="bg-[#D9E2F3] px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-[#4A6FA5]" style={{ fontWeight: 500 }}>
              Datos del Cliente
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-1.5">
              <div className="flex items-center gap-2">
                <label className={labelCls}>No. KYC</label>
                <div className={disabledCls}>{data.noCalculado}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>NOMBRE / RAZON SOCIAL</label>
                <div className={disabledCls} style={{ fontWeight: 500 }}>{data.clienteNombre}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>PERSONALIDAD</label>
                <div className={disabledCls}>{data.clientePersonalidad}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>RFC</label>
                <div className={`${disabledCls} font-mono`}>{data.clienteRFC || '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>CURP</label>
                <div className={`${disabledCls} font-mono`}>{data.clienteCURP || '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>SUCURSAL</label>
                <div className={disabledCls}>{data.clienteSucursal}</div>
              </div>
            </div>
          </div>

          {/* Seccion: Informacion KYC */}
          <div className="mb-4">
            <div className="bg-[#D9E2F3] px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-[#4A6FA5]" style={{ fontWeight: 500 }}>
              Informacion KYC
            </div>
            <div className="grid grid-cols-2 gap-x-6">
              {/* Columna 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className={labelCls}>ES PEP O HA SIDO PEP <span className="text-red-600">*</span></label>
                  <input type="checkbox" checked={data.esPEP} onChange={e => update('esPEP', e.target.checked)} disabled={isView} className="w-3.5 h-3.5 accent-[#4A6FA5]" />
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>No. SALARIOS / MES <span className="text-red-600">*</span></label>
                  <input type="text" value={data.numeroSalarios} onChange={e => update('numeroSalarios', e.target.value.replace(/\D/g, ''))} readOnly={isView} className={isView ? disabledCls : inputCls} />
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>CONYUGE/FAMILIAR PEP <span className="text-red-600">*</span></label>
                  <input type="checkbox" checked={data.conyugeFamiliarPEP} onChange={e => update('conyugeFamiliarPEP', e.target.checked)} disabled={isView} className="w-3.5 h-3.5 accent-[#4A6FA5]" />
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>LISTAS NEGRAS <span className="text-red-600">*</span></label>
                  <input type="text" value={data.listasNegras} onChange={e => update('listasNegras', e.target.value)} readOnly={isView} className={isView ? disabledCls : inputCls} placeholder="Sin coincidencias" />
                </div>
                <div className="flex items-start gap-2">
                  <label className={`${labelCls} pt-1`}>ACTIVIDAD INGRESOS</label>
                  {isView ? (
                    <div className={disabledCls}>{data.actividadIngresos || '—'}</div>
                  ) : (
                    <textarea value={data.actividadIngresos} onChange={e => update('actividadIngresos', e.target.value)} className={`${inputCls} h-14 resize-none`} placeholder="Describa la actividad..." />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>RESULTADO COINCIDENCIAS</label>
                  <input type="checkbox" checked={data.resultadoCoincidencias} disabled className="w-3.5 h-3.5 opacity-60" />
                  <span className="text-[10px] text-gray-400">(solo lectura)</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>FECHA CALIFICACION</label>
                  {isView ? (
                    <div className={disabledCls}>{data.fechaCalificacion || '—'}</div>
                  ) : (
                    <DatePicker value={data.fechaCalificacion} onChange={v => update('fechaCalificacion', v)} />
                  )}
                </div>
              </div>

              {/* Columna 2 */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className={labelCls}>INGRESO MENSUAL <span className="text-red-600">*</span></label>
                  {isView ? (
                    <div className={disabledCls}>{data.ingresoMensual || '—'}</div>
                  ) : (
                    <select value={data.ingresoMensual} onChange={e => update('ingresoMensual', e.target.value)} className={inputCls}>
                      <option value="">-- Seleccionar --</option>
                      <option>Menos de $5,000</option><option>$5,000 - $10,000</option>
                      <option>$10,001 - $20,000</option><option>$20,001 - $50,000</option>
                      <option>$50,001 - $100,000</option><option>Mas de $100,000</option>
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>ACTIVIDAD ECONOMICA <span className="text-red-600">*</span></label>
                  {isView ? (
                    <div className={disabledCls}>{data.actividadEconomica || '—'}</div>
                  ) : (
                    <select value={data.actividadEconomica} onChange={e => update('actividadEconomica', e.target.value)} className={inputCls}>
                      <option value="">-- Seleccionar --</option>
                      <option>Comercio al por menor</option><option>Servicios profesionales</option>
                      <option>Manufactura</option><option>Construccion</option>
                      <option>Transporte</option><option>Servicios financieros</option>
                      <option>Tecnologia</option><option>Agricultura</option>
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>FUNCIONARIOS PUBLICOS</label>
                  <input type="checkbox" checked={data.funcionariosPublicos} onChange={e => update('funcionariosPublicos', e.target.checked)} disabled={isView} className="w-3.5 h-3.5 accent-[#4A6FA5]" />
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>PERCIBE OTROS INGRESOS</label>
                  <input type="checkbox" checked={data.percibeOtrosIngresos} onChange={e => update('percibeOtrosIngresos', e.target.checked)} disabled={isView} className="w-3.5 h-3.5 accent-[#4A6FA5]" />
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>APROBADO POR OFICIAL</label>
                  <input type="checkbox" checked={data.aprobadoOficial} disabled className="w-3.5 h-3.5 opacity-60" />
                  <span className="text-[10px] text-gray-400">(solo lectura)</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>ULT. REVISION</label>
                  <div className={disabledCls}>{data.fechaUltimaRevision || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Seccion: Calificacion de Riesgo */}
          <div className="mb-4">
            <div className="bg-[#D9E2F3] px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-[#4A6FA5]" style={{ fontWeight: 500 }}>
              Calificacion de Riesgo
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 border border-gray-200 p-3 rounded">
                <div className="text-[10px] text-gray-600 mb-1">Actividad Economica: 25%</div>
                <div className="text-[10px] text-gray-600">Residencia: 15%</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-3 rounded">
                <div className="text-[10px] text-gray-600 mb-1">Nacionalidad: 15%</div>
                <div className="text-[10px] text-gray-600">Tipo de Persona: 20%</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-3 rounded">
                <div className="text-[10px] text-gray-600">PEP / Listas Negras: 25%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6">
              <div className="flex items-center gap-2">
                <label className={labelCls}>CALIFICACION PONDERADA</label>
                <div className={disabledCls}>{data.calificacionPonderada}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>NIVEL DE RIESGO</label>
                <div className={`${disabledCls} ${RIESGO_COLORS[data.nivelRiesgo || 'Bajo']}`} style={{ fontWeight: 500 }}>
                  {data.nivelRiesgo || 'Sin evaluar'}
                </div>
              </div>
            </div>

            {!isView && (
              <div className="mt-4">
                <button onClick={calcularRiesgo} className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs rounded hover:bg-[#3a5a8a]">Calcular Riesgo</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
