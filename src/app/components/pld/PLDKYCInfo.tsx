import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import * as store from './pldStore';

interface Props { mode?: 'ver' | 'editar' | 'nuevo'; onBack?: () => void; }
type KYCView = 'list' | 'detail';
type KYCMode = 'ver' | 'editar';

const ESTATUS_BADGE: Record<string, string> = {
  'Completo':   'bg-green-50 text-green-700 border border-green-200',
  'En Proceso': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Pendiente':  'bg-yellow-50 text-yellow-700 border border-yellow-200',
  'Vencido':    'bg-red-50 text-red-700 border border-red-200',
};
const RIESGO_BADGE: Record<string, string> = {
  'Bajo':  'bg-green-50 text-green-700 border border-green-200',
  'Medio': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  'Alto':  'bg-red-50 text-red-700 border border-red-200',
};

export function PLDKYCInfo({ onBack }: Props) {
  const [view, setView] = useState<KYCView>('list');
  const [detailMode, setDetailMode] = useState<KYCMode>('ver');
  const [kycClientes, setKycClientes] = useState<store.KYCData[]>(store.getKYCClientes);
  const [editData, setEditData] = useState<store.KYCData | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('');
  const [filterRiesgo, setFilterRiesgo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    let r = kycClientes;
    if (searchTerm) { const q = searchTerm.toLowerCase(); r = r.filter(k => (k.clienteNombre||'').toLowerCase().includes(q) || (k.clienteRFC||'').toLowerCase().includes(q) || (k.noCalculado||'').toLowerCase().includes(q)); }
    if (filterEstatus) r = r.filter(k => k.estatusKYC === filterEstatus);
    if (filterRiesgo)  r = r.filter(k => k.nivelRiesgo === filterRiesgo);
    return r;
  }, [kycClientes, searchTerm, filterEstatus, filterRiesgo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openDetail = (kyc: store.KYCData, mode: KYCMode) => {
    setEditData({ ...kyc });
    setDetailMode(mode);
    setView('detail');
  };

  const handleBackToList = () => {
    setView('list');
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
    const fechaHoy = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;
    const updated: store.KYCData = {
      ...editData,
      estatusKYC: editData.aprobadoOficial ? 'Completo' : (editData.actividadEconomica || editData.ingresoMensual) ? 'En Proceso' : 'Pendiente',
      fechaUltimaRevision: fechaHoy,
    };
    store.saveKYCCliente(updated);
    setKycClientes(store.getKYCClientes());
    toast.success('KYC guardado', { description: `"${updated.clienteNombre}" actualizado.` });
    handleBackToList();
  };

  const calcularRiesgo = () => {
    if (!editData) return;
    let score = 20;
    if (editData.esPEP) score += 25;
    if (editData.funcionariosPublicos) score += 15;
    if (editData.resultadoCoincidencias) score += 20;
    if (editData.conyugeFamiliarPEP) score += 10;
    if (editData.ingresoMensual === 'Más de $100,000') score += 10;
    const nivel = score <= 35 ? 'Bajo' : score <= 60 ? 'Medio' : 'Alto';
    setEditData(d => d ? { ...d, calificacionPonderada: `${score}.0 puntos`, nivelRiesgo: nivel } : d);
    toast.info('Riesgo calculado', { description: `Calificación: ${score}.0 — Nivel: ${nivel}` });
  };

  const isView = detailMode === 'ver';
  const labelCls = 'text-xs w-44 flex-shrink-0 text-gray-700';
  const inputCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white';
  const disabledCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600';

  // ── LISTA ──
  if (view === 'list') {
    return (
      <div className="bg-white min-h-full">

        {/* Header */}
        <div className="bg-white px-4 py-3 border-b border-gray-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              <h2 className="text-lg text-gray-800">KYC — Conozca a su Cliente</h2>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-700">
              <span>Lista</span>
              <span>Buscar</span>
            </div>
          </div>
        </div>

        {/* Ver bar */}
        <div className="px-4 py-2 bg-white border-b border-gray-300">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Ver</span>
            <div className="relative">
              <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[260px]">
                <option>Vista general de KYC</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 font-medium">Filtros</span>
              <select value={filterEstatus} onChange={e => { setFilterEstatus(e.target.value); setCurrentPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                <option value="">Estatus: Todos</option>
                <option>Completo</option><option>En Proceso</option><option>Pendiente</option><option>Vencido</option>
              </select>
              <select value={filterRiesgo} onChange={e => { setFilterRiesgo(e.target.value); setCurrentPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                <option value="">Riesgo: Todos</option>
                <option>Bajo</option><option>Medio</option><option>Alto</option>
              </select>
              {(filterEstatus || filterRiesgo || searchTerm) && (
                <button onClick={() => { setFilterEstatus(''); setFilterRiesgo(''); setSearchTerm(''); setCurrentPage(1); }} className="text-xs text-[#0066CC] hover:underline">Limpiar</button>
              )}
            </div>
            <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="Buscar por nombre, RFC, No. KYC..." className="px-3 py-1 border border-gray-400 rounded text-sm w-72 transition-all" />
          </div>
        </div>

        {/* Export bar */}
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {['CSV','XLS','PDF'].map((t, i) => {
                const fills = ['#6B7280','#1D9F5B','#D32F2F'];
                return (
                  <button key={t} className={`p-1.5 rounded transition-colors hover:scale-110 transform ${i===1?'hover:bg-green-100':i===2?'hover:bg-red-100':'hover:bg-gray-200'}`} title={t}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill={fills[i]}/><text x="10" y="13.5" fontSize="6" fontWeight="bold" textAnchor="middle" fill="white">{t}</text></svg>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-700">
              <span className="font-medium">Total: {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1} className="p-0.5 text-[#0066CC] disabled:opacity-40">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
                </button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="p-0.5 text-[#0066CC] disabled:opacity-40">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="px-4 py-4">
          <div className="border border-gray-300 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Editar | Ver</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">No. KYC</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Cliente</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">RFC</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Personalidad</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Sucursal</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Estatus KYC</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Nivel Riesgo</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-700">Ult. Revisión</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">No se encontraron registros KYC</td></tr>
                ) : paged.map((kyc, idx) => (
                  <tr key={kyc.clienteId || idx} className="border-b border-gray-200 transition-colors duration-150"
                    style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      <span className="text-[#0066CC] cursor-pointer hover:underline" onClick={() => openDetail(kyc,'editar')}>Editar</span>
                      <span className="text-gray-400 mx-1">|</span>
                      <span className="text-[#0066CC] cursor-pointer hover:underline" onClick={() => openDetail(kyc,'ver')}>Ver</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#0066CC]" style={{ fontWeight: 500 }}>{kyc.noCalculado}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ fontWeight: 500 }}>{kyc.clienteNombre}</td>
                    <td className="px-3 py-2.5 text-xs font-mono">{kyc.clienteRFC}</td>
                    <td className="px-3 py-2.5 text-xs">{kyc.clientePersonalidad}</td>
                    <td className="px-3 py-2.5 text-xs">{kyc.clienteSucursal}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${ESTATUS_BADGE[kyc.estatusKYC||'Pendiente']}`} style={{ fontWeight: 500 }}>{kyc.estatusKYC||'Pendiente'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${RIESGO_BADGE[kyc.nivelRiesgo||'Bajo']}`} style={{ fontWeight: 500 }}>{kyc.nivelRiesgo||'Sin evaluar'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{kyc.fechaUltimaRevision||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > pageSize && (
            <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
              <span>Mostrando {(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize, filtered.length)} de {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button disabled={currentPage===1} onClick={() => setCurrentPage(p=>p-1)} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">Anterior</button>
                <button disabled={currentPage===totalPages} onClick={() => setCurrentPage(p=>p+1)} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── DETALLE ──
  if (!editData) return null;

  return (
    <div className="bg-white min-h-full">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleBackToList} className="text-gray-500 hover:text-gray-700">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4L6 9l5 5"/></svg>
            </button>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            <h2 className="text-lg text-gray-800">KYC — {editData.clienteNombre}</h2>
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${ESTATUS_BADGE[editData.estatusKYC||'Pendiente']}`} style={{ fontWeight: 500 }}>{editData.estatusKYC||'Pendiente'}</span>
          </div>
          <div className="flex items-center gap-2">
            {isView
              ? <button onClick={() => setDetailMode('editar')} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">Editar KYC</button>
              : <>
                  <button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB]" style={{ fontWeight: 500 }}>Guardar</button>
                  <button onClick={handleBackToList} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">Cancelar</button>
                </>}
            {isView && <button onClick={handleBackToList} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">Volver</button>}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Datos del Cliente */}
        <div className="border border-gray-300">
          <div style={{ backgroundColor: '#D0D0D0' }} className="px-3 py-2 border-b border-gray-300">
            <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>DATOS DEL CLIENTE</span>
          </div>
          <div className="p-4 grid grid-cols-3 gap-x-6 gap-y-2">
            <div className="flex items-center gap-2"><label className={labelCls}>No. KYC</label><div className={disabledCls}>{editData.noCalculado}</div></div>
            <div className="flex items-center gap-2"><label className={labelCls}>NOMBRE / RAZÓN SOCIAL</label><div className={disabledCls} style={{ fontWeight: 500 }}>{editData.clienteNombre}</div></div>
            <div className="flex items-center gap-2"><label className={labelCls}>PERSONALIDAD</label><div className={disabledCls}>{editData.clientePersonalidad}</div></div>
            <div className="flex items-center gap-2"><label className={labelCls}>RFC</label><div className={`${disabledCls} font-mono`}>{editData.clienteRFC||'—'}</div></div>
            <div className="flex items-center gap-2"><label className={labelCls}>CURP</label><div className={`${disabledCls} font-mono`}>{editData.clienteCURP||'—'}</div></div>
            <div className="flex items-center gap-2"><label className={labelCls}>SUCURSAL</label><div className={disabledCls}>{editData.clienteSucursal}</div></div>
          </div>
        </div>

        {/* Información KYC */}
        <div className="border border-gray-300">
          <div style={{ backgroundColor: '#D0D0D0' }} className="px-3 py-2 border-b border-gray-300">
            <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>INFORMACIÓN KYC</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-x-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2"><label className={labelCls}>ES PEP O HA SIDO PEP <span className="text-red-600">*</span></label><input type="checkbox" checked={editData.esPEP} onChange={e => update('esPEP', e.target.checked)} disabled={isView} className="w-3.5 h-3.5 accent-[#4A6FA5]" /></div>
              <div className="flex items-center gap-2"><label className={labelCls}>No. SALARIOS / MES <span className="text-red-600">*</span></label><input type="text" value={editData.numeroSalarios} onChange={e => update('numeroSalarios', e.target.value.replace(/\D/g,''))} readOnly={isView} className={isView ? disabledCls : inputCls} /></div>
              <div className="flex items-center gap-2"><label className={labelCls}>CONYUGE/FAMILIAR PEP <span className="text-red-600">*</span></label><input type="checkbox" checked={editData.conyugeFamiliarPEP} onChange={e => update('conyugeFamiliarPEP', e.target.checked)} disabled={isView} className="w-3.5 h-3.5 accent-[#4A6FA5]" /></div>
              <div className="flex items-center gap-2"><label className={labelCls}>LISTAS NEGRAS <span className="text-red-600">*</span></label><input type="text" value={editData.listasNegras} onChange={e => update('listasNegras', e.target.value)} readOnly={isView} className={isView ? disabledCls : inputCls} placeholder="Sin coincidencias" /></div>
              <div className="flex items-start gap-2"><label className={`${labelCls} pt-1`}>ACTIVIDAD INGRESOS</label>{isView ? <div className={disabledCls}>{editData.actividadIngresos||'—'}</div> : <textarea value={editData.actividadIngresos} onChange={e => update('actividadIngresos', e.target.value)} className={`${inputCls} h-14 resize-none`} placeholder="Describa la actividad..." />}</div>
              <div className="flex items-center gap-2"><label className={labelCls}>FECHA CALIFICACIÓN</label>{isView ? <div className={disabledCls}>{editData.fechaCalificacion||'—'}</div> : <DatePicker value={editData.fechaCalificacion} onChange={v => update('fechaCalificacion', v)} />}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><label className={labelCls}>INGRESO MENSUAL <span className="text-red-600">*</span></label>{isView ? <div className={disabledCls}>{editData.ingresoMensual||'—'}</div> : <select value={editData.ingresoMensual} onChange={e => update('ingresoMensual', e.target.value)} className={inputCls}><option value="">-- Seleccionar --</option><option>Menos de $5,000</option><option>$5,000 - $10,000</option><option>$10,001 - $20,000</option><option>$20,001 - $50,000</option><option>$50,001 - $100,000</option><option>Mas de $100,000</option></select>}</div>
              <div className="flex items-center gap-2"><label className={labelCls}>ACTIVIDAD ECONÓMICA <span className="text-red-600">*</span></label>{isView ? <div className={disabledCls}>{editData.actividadEconomica||'—'}</div> : <select value={editData.actividadEconomica} onChange={e => update('actividadEconomica', e.target.value)} className={inputCls}><option value="">-- Seleccionar --</option><option>Comercio al por menor</option><option>Servicios profesionales</option><option>Manufactura</option><option>Construccion</option><option>Transporte</option><option>Servicios financieros</option><option>Tecnologia</option><option>Agricultura</option></select>}</div>
              <div className="flex items-center gap-2"><label className={labelCls}>FUNCIONARIOS PÚBLICOS</label><input type="checkbox" checked={editData.funcionariosPublicos} onChange={e => update('funcionariosPublicos', e.target.checked)} disabled={isView} className="w-3.5 h-3.5 accent-[#4A6FA5]" /></div>
              <div className="flex items-center gap-2"><label className={labelCls}>PERCIBE OTROS INGRESOS</label><input type="checkbox" checked={editData.percibeOtrosIngresos} onChange={e => update('percibeOtrosIngresos', e.target.checked)} disabled={isView} className="w-3.5 h-3.5 accent-[#4A6FA5]" /></div>
              <div className="flex items-center gap-2"><label className={labelCls}>APROBADO POR OFICIAL</label><input type="checkbox" checked={editData.aprobadoOficial} disabled className="w-3.5 h-3.5 opacity-60" /><span className="text-[10px] text-gray-400">(solo lectura)</span></div>
              <div className="flex items-center gap-2"><label className={labelCls}>ULT. REVISIÓN</label><div className={disabledCls}>{editData.fechaUltimaRevision||'—'}</div></div>
            </div>
          </div>
        </div>

        {/* Calificación de Riesgo */}
        <div className="border border-gray-300">
          <div style={{ backgroundColor: '#D0D0D0' }} className="px-3 py-2 border-b border-gray-300">
            <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>CALIFICACIÓN DE RIESGO</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3 mb-4 text-[10px] text-gray-600">
              <div className="border border-gray-200 bg-gray-50 px-3 py-2"><div className="mb-0.5">Actividad Económica: 25%</div><div>Residencia: 15%</div></div>
              <div className="border border-gray-200 bg-gray-50 px-3 py-2"><div className="mb-0.5">Nacionalidad: 15%</div><div>Tipo de Persona: 20%</div></div>
              <div className="border border-gray-200 bg-gray-50 px-3 py-2">PEP / Listas Negras: 25%</div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
              <div className="flex items-center gap-2"><label className={labelCls}>CALIFICACIÓN PONDERADA</label><div className={disabledCls}>{editData.calificacionPonderada}</div></div>
              <div className="flex items-center gap-2"><label className={labelCls}>NIVEL DE RIESGO</label><div className={`${disabledCls} ${RIESGO_BADGE[editData.nivelRiesgo||'Bajo']}`} style={{ fontWeight: 500 }}>{editData.nivelRiesgo||'Sin evaluar'}</div></div>
            </div>
            {!isView && (
              <button onClick={calcularRiesgo} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-sm rounded hover:bg-gray-50">Calcular Riesgo</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
