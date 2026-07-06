import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import * as store from './pldStore';
import type { PerfilTransaccional } from './pldStore';
import { usePLDClientes } from './usePLDClientes';

interface Props { mode?: 'ver' | 'editar' | 'nuevo'; onBack?: () => void; }

const PRODUCTOS_CATALOGO = [
  { clave: 'PRO-001', nombre: 'Cuenta de Ahorro', tasa: '5%', moneda: 'MXN', estatus: 'Activo' },
  { clave: 'PRO-002', nombre: 'Inversión', tasa: '5%', moneda: 'MXN', estatus: 'Activo' },
  { clave: 'PRO-003', nombre: 'Solicitud de crédito', tasa: '10%', moneda: 'MXN', estatus: 'Activo' },
  { clave: 'PRO-004', nombre: 'Cuenta Corriente', tasa: '15%', moneda: 'MXN', estatus: 'Activo' },
  { clave: 'PRO-005', nombre: 'Préstamo automóviles', tasa: '10%', moneda: 'MXN', estatus: 'Activo' },
  { clave: 'PRO-006', nombre: 'Préstamo hipotecario', tasa: '20%', moneda: 'MXN', estatus: 'Activo' },
];

const EMPTY_FORM = {
  clienteId: 0,
  clienteNombre: '',
  clienteRFC: '',
  sublinea: '',
  producto: '',
  numTransRetiro: '',
  numTransDeposito: '',
  montoMaxRetiros: '',
  montoMaxDepositos: '',
  periodo: 'Mensual',
};

export function PLDPerfilTransaccional({ mode = 'editar', onBack }: Props) {
  const isView = mode === 'ver';
  const [perfiles, setPerfiles] = useState(store.getPerfiles);
  const { clientes: clientesDB, loading: loadingClientes } = usePLDClientes();

  // Modal Nuevo / Editar
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [modalForm, setModalForm] = useState({ ...EMPTY_FORM });
  const [modalEditId, setModalEditId] = useState<number | null>(null);
  const [modalStep, setModalStep] = useState<'cliente' | 'perfil'>('cliente');

  // Sub-modal catálogo de productos
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [selectedProductRow, setSelectedProductRow] = useState<number | null>(null);

  // Modal Ver detalle
  const [viewPerfil, setViewPerfil] = useState<PerfilTransaccional | null>(null);

  // Eliminar
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Buscador cliente en modal
  const [clienteSearch, setClienteSearch] = useState('');

  useEffect(() => { store.savePerfiles(perfiles); }, [perfiles]);

  const filteredClientes = useMemo(() => {
    const base = clientesDB.length > 0 ? clientesDB : [];
    if (!clienteSearch) return base;
    const q = clienteSearch.toLowerCase();
    return base.filter(c =>
      c.nombre.toLowerCase().includes(q) || c.rfc.toLowerCase().includes(q)
    );
  }, [clienteSearch, clientesDB]);

  // ── Abrir modal nuevo ──
  const handleOpenNuevo = () => {
    setModalForm({ ...EMPTY_FORM });
    setModalEditId(null);
    setModalStep('cliente');
    setClienteSearch('');
    setShowNuevoModal(true);
  };

  // ── Abrir modal editar ──
  const handleOpenEdit = (p: PerfilTransaccional) => {
    setModalForm({
      clienteId: p.clienteId || 0,
      clienteNombre: p.clienteNombre || '',
      clienteRFC: p.clienteRFC || '',
      sublinea: p.sublinea,
      producto: p.producto,
      numTransRetiro: p.numTransRetiro,
      numTransDeposito: p.numTransDeposito,
      montoMaxRetiros: p.montoMaxRetiros,
      montoMaxDepositos: p.montoMaxDepositos,
      periodo: p.periodo,
    });
    setModalEditId(p.id);
    setModalStep('perfil');
    setShowNuevoModal(true);
    setConfirmDelete(null);
  };

  // ── Seleccionar cliente ──
  const handleSelectCliente = (c: typeof clientesDB[0]) => {
    setModalForm(f => ({
      ...f,
      clienteId: c.id,
      clienteNombre: c.nombre,
      clienteRFC: c.rfc,
    }));
    setModalStep('perfil');
  };

  // ── Seleccionar producto del catálogo ──
  const handleSelectProducto = (prod: typeof PRODUCTOS_CATALOGO[0], idx: number) => {
    setSelectedProductRow(idx);
    setModalForm(f => ({ ...f, producto: prod.nombre }));
    setShowProductoModal(false);
  };

  // ── Guardar perfil ──
  const handleSavePerfil = () => {
    if (!modalForm.clienteId) { toast.error('Seleccione un cliente'); return; }
    if (!modalForm.sublinea) { toast.error('Seleccione una sublínea'); return; }
    if (!modalForm.producto) { toast.error('Seleccione un producto'); return; }
    if (!modalForm.numTransRetiro || !modalForm.numTransDeposito) { toast.error('Complete las transacciones'); return; }
    if (!modalForm.montoMaxRetiros || !modalForm.montoMaxDepositos) { toast.error('Complete los montos máximos'); return; }

    const now = new Date();
    const fechaHoy = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

    if (modalEditId !== null) {
      setPerfiles(p => p.map(pf => pf.id === modalEditId ? {
        ...pf,
        clienteId: modalForm.clienteId,
        clienteNombre: modalForm.clienteNombre,
        clienteRFC: modalForm.clienteRFC,
        sublinea: modalForm.sublinea,
        producto: modalForm.producto,
        numTransRetiro: modalForm.numTransRetiro,
        numTransDeposito: modalForm.numTransDeposito,
        montoMaxRetiros: modalForm.montoMaxRetiros,
        montoMaxDepositos: modalForm.montoMaxDepositos,
        periodo: modalForm.periodo,
      } : pf));
      toast.success('Perfil actualizado', { description: `Perfil de "${modalForm.clienteNombre}" actualizado.` });
    } else {
      const id = perfiles.length > 0 ? Math.max(...perfiles.map(p => p.id)) + 1 : 1;
      const nuevo: PerfilTransaccional = {
        id,
        clienteId: modalForm.clienteId,
        clienteNombre: modalForm.clienteNombre,
        clienteRFC: modalForm.clienteRFC,
        sublinea: modalForm.sublinea,
        producto: modalForm.producto,
        numTransRetiro: modalForm.numTransRetiro,
        numTransDeposito: modalForm.numTransDeposito,
        montoMaxRetiros: modalForm.montoMaxRetiros,
        montoMaxDepositos: modalForm.montoMaxDepositos,
        periodo: modalForm.periodo,
        fechaRegistro: fechaHoy,
        estatus: 'Activo',
      };
      setPerfiles(p => [...p, nuevo]);
      toast.success('Perfil creado', { description: `Perfil transaccional para "${modalForm.clienteNombre}" registrado.` });
    }

    setShowNuevoModal(false);
    setModalForm({ ...EMPTY_FORM });
    setModalEditId(null);
  };

  const handleDelete = (id: number) => {
    setPerfiles(p => p.filter(pf => pf.id !== id));
    toast.success('Perfil eliminado');
    setConfirmDelete(null);
  };

  const labelCls = 'text-xs w-28 flex-shrink-0 text-gray-700';
  const viewFieldCls = 'flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600';

  return (
    <div className="bg-white min-h-full">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#666" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 8h14M8 3v14"/></svg>
            <h2 className="text-lg text-gray-800">Perfil Transaccional</h2>
            <span className="text-xs text-gray-500">({perfiles.length} registros)</span>
          </div>
          <div className="flex items-center gap-2">
            {!isView && (
              <button onClick={() => { store.savePerfiles(perfiles); toast.success('Perfiles guardados'); onBack?.(); }} className="px-5 py-1.5 bg-[#0099CC] text-white text-sm rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}>Guardar</button>
            )}
            <button onClick={onBack} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-sm rounded hover:bg-gray-50">{isView ? 'Volver' : 'Cancelar'}</button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="border border-gray-300">
          {/* Section Header + Actions */}
          <div style={{ backgroundColor: '#D0D0D0' }} className="px-3 py-2 border-b border-gray-300 flex items-center justify-between">
            <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>PERFILES TRANSACCIONALES</span>
            {!isView && (
              <button onClick={handleOpenNuevo} className="px-3 py-1 bg-[#0099CC] text-white text-[10px] rounded hover:bg-[#0088BB]">+ Nuevo Perfil</button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#D0D0D0]">
                  {['Cliente', 'RFC', 'Sublínea', 'Producto', 'Trans. Retiro', 'Trans. Depósito', 'Máx. Retiros', 'Máx. Depósitos', 'Periodo', 'Acciones'].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-[10px] border-r border-gray-300 last:border-r-0" style={{ fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perfiles.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Sin perfiles. Clic en "+ Nuevo Perfil" para agregar.</td></tr>
                ) : perfiles.map((p, i) => (
                  <tr key={p.id} style={{ backgroundColor: i % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}>
                    <td className="px-2 py-1.5 border-r border-gray-200" style={{ fontWeight: 500 }}>{p.clienteNombre || '—'}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200 font-mono text-[10px]">{p.clienteRFC || '—'}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200">{p.sublinea}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200" style={{ fontWeight: 500 }}>{p.producto}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200 text-center">{p.numTransRetiro}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200 text-center">{p.numTransDeposito}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200 text-red-600" style={{ fontWeight: 500 }}>{p.montoMaxRetiros}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200 text-green-600" style={{ fontWeight: 500 }}>{p.montoMaxDepositos}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200">{p.periodo}</td>
                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                      {isView ? (
                        <span className="text-[#0066CC] cursor-pointer hover:underline text-[10px]" onClick={() => setViewPerfil(p)}>Ver</span>
                      ) : confirmDelete === p.id ? (
                        <>
                          <span className="text-[9px] text-red-600 mr-1">Eliminar?</span>
                          <span className="text-red-600 cursor-pointer hover:underline text-[10px]" onClick={() => handleDelete(p.id)}>Sí</span>
                          <span className="text-gray-400 mx-0.5">|</span>
                          <span className="text-gray-600 cursor-pointer hover:underline text-[10px]" onClick={() => setConfirmDelete(null)}>No</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[#0066CC] cursor-pointer hover:underline text-[10px]" onClick={() => handleOpenEdit(p)}>Editar</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-[#0066CC] cursor-pointer hover:underline text-[10px]" onClick={() => setViewPerfil(p)}>Ver</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-red-600 cursor-pointer hover:underline text-[10px]" onClick={() => setConfirmDelete(p.id)}>Eliminar</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL NUEVO / EDITAR PERFIL TRANSACCIONAL                    */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showNuevoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowNuevoModal(false)}>
          <div className="bg-white rounded shadow-xl w-[780px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header modal */}
            <div className="bg-[#4A6FA5] px-5 py-3 rounded-t flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 8h14M8 3v14"/></svg>
                <h3 className="text-sm text-white" style={{ fontWeight: 600 }}>
                  {modalEditId ? 'Editar Perfil Transaccional' : 'Nuevo Perfil Transaccional'}
                </h3>
              </div>
              <button onClick={() => setShowNuevoModal(false)} className="text-white/80 hover:text-white text-lg leading-none">&times;</button>
            </div>

            {/* Steps indicator */}
            <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-4 flex-shrink-0">
              <div className={`flex items-center gap-2 text-xs ${modalStep === 'cliente' ? 'text-[#4A6FA5]' : 'text-gray-500'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  modalStep === 'cliente' ? 'bg-[#4A6FA5] text-white' : modalForm.clienteId ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'
                }`} style={{ fontWeight: 600 }}>
                  {modalForm.clienteId && modalStep !== 'cliente' ? '✓' : '1'}
                </span>
                <span style={{ fontWeight: modalStep === 'cliente' ? 600 : 400 }}>Seleccionar Cliente</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><path d="M6 4l4 4-4 4"/></svg>
              <div className={`flex items-center gap-2 text-xs ${modalStep === 'perfil' ? 'text-[#4A6FA5]' : 'text-gray-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  modalStep === 'perfil' ? 'bg-[#4A6FA5] text-white' : 'bg-gray-300 text-white'
                }`} style={{ fontWeight: 600 }}>2</span>
                <span style={{ fontWeight: modalStep === 'perfil' ? 600 : 400 }}>Configurar Perfil</span>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="flex-1 overflow-auto p-5">

              {/* ── PASO 1: Seleccionar Cliente ── */}
              {modalStep === 'cliente' && (
                <div>
                  <div className="bg-gray-50 border border-gray-200 px-3 py-2 mb-3 text-xs text-gray-700" style={{ fontWeight: 600 }}>
                    SELECCIONE EL CLIENTE
                  </div>
                  <div className="mb-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar por nombre o RFC..."
                        value={clienteSearch}
                        onChange={e => setClienteSearch(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded pr-8"
                        autoFocus
                      />
                      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><circle cx="6" cy="6" r="4"/><path d="M9.5 9.5l3 3"/></svg>
                    </div>
                  </div>
                  <div className="border border-gray-300 max-h-[320px] overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0">
                        <tr className="bg-[#D0D0D0]">
                          <th className="px-3 py-2 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Nombre / Razón Social</th>
                          <th className="px-3 py-2 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>RFC</th>
                          <th className="px-3 py-2 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Personalidad</th>
                          <th className="px-3 py-2 text-left text-[10px]" style={{ fontWeight: 600 }}>Sucursal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingClientes ? (
                          <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                            <svg className="animate-spin h-4 w-4 mx-auto mb-1 text-[#4A6FA5]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/></svg>
                            Cargando clientes...
                          </td></tr>
                        ) : filteredClientes.length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No se encontraron clientes</td></tr>
                        ) : filteredClientes.map((c, idx) => (
                          <tr
                            key={c.id}
                            onClick={() => handleSelectCliente(c)}
                            className="cursor-pointer border-b border-gray-100 transition-colors"
                            style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}
                          >
                            <td className="px-3 py-2 border-r border-gray-200" style={{ fontWeight: 500 }}>
                              <div className="flex items-center gap-2">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#4A6FA5" strokeWidth="1.2"><circle cx="7" cy="5.5" r="2.5"/><path d="M3 12.5c0-2.2 1.8-4 4-4s4 1.8 4 4"/></svg>
                                {c.nombre}
                              </div>
                            </td>
                            <td className="px-3 py-2 border-r border-gray-200 font-mono">{c.rfc}</td>
                            <td className="px-3 py-2 border-r border-gray-200">{c.personalidad}</td>
                            <td className="px-3 py-2">{c.sucursal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Haga clic en un cliente para continuar al paso 2.</p>
                </div>
              )}

              {/* ── PASO 2: Configurar Perfil ── */}
              {modalStep === 'perfil' && (
                <div>
                  {/* Info cliente seleccionado */}
                  <div className="bg-gray-50 border border-gray-200 px-3 py-2 mb-3 text-xs text-gray-700 flex items-center justify-between" style={{ fontWeight: 600 }}>
                    <span>CLIENTE SELECCIONADO</span>
                    {!modalEditId && (
                      <button onClick={() => setModalStep('cliente')} className="text-[10px] text-[#4A6FA5] hover:underline" style={{ fontWeight: 400 }}>Cambiar cliente</button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1 mb-4 px-1">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-gray-500 w-16 flex-shrink-0">CLIENTE</label>
                      <span className="text-xs text-gray-800" style={{ fontWeight: 500 }}>{modalForm.clienteNombre}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-gray-500 w-10 flex-shrink-0">RFC</label>
                      <span className="text-xs text-gray-800 font-mono">{modalForm.clienteRFC}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-gray-500 w-10 flex-shrink-0">ID</label>
                      <span className="text-xs text-gray-800">{modalForm.clienteId}</span>
                    </div>
                  </div>

                  {/* Datos del perfil */}
                  <div className="bg-gray-50 border border-gray-200 px-3 py-2 mb-3 text-xs text-gray-700" style={{ fontWeight: 600 }}>
                    DATOS DEL PERFIL TRANSACCIONAL
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-24 flex-shrink-0 text-gray-700">SUBLÍNEA <span className="text-red-600">*</span></label>
                        <select
                          value={modalForm.sublinea}
                          onChange={e => setModalForm(f => ({ ...f, sublinea: e.target.value }))}
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded"
                        >
                          <option value="">-- Seleccione --</option>
                          <option>Cuenta de ahorro para importadores</option>
                          <option>Cuenta de ahorro estándar</option>
                          <option>Cuenta de ahorro premium</option>
                          <option>Cuenta de inversión</option>
                          <option>Línea de crédito revolvente</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-24 flex-shrink-0 text-gray-700">PRODUCTO <span className="text-red-600">*</span></label>
                        <div className="flex-1 flex items-center gap-1">
                          <div className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-50 min-h-[30px] flex items-center">
                            {modalForm.producto || <span className="text-gray-400">Seleccione un producto...</span>}
                          </div>
                          <button
                            onClick={() => { setShowProductoModal(true); setSelectedProductRow(null); }}
                            className="px-2 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 flex items-center gap-1"
                            title="Buscar en catálogo"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="5" r="3.5"/><path d="M8 8l2 2"/></svg>
                            Buscar
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-24 flex-shrink-0 text-gray-700">TRANS. RETIRO <span className="text-red-600">*</span></label>
                        <input
                          type="text"
                          value={modalForm.numTransRetiro}
                          onChange={e => setModalForm(f => ({ ...f, numTransRetiro: e.target.value.replace(/\D/g, '') }))}
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded"
                          placeholder="Ej. 500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-24 flex-shrink-0 text-gray-700">TRANS. DEPÓSITO <span className="text-red-600">*</span></label>
                        <input
                          type="text"
                          value={modalForm.numTransDeposito}
                          onChange={e => setModalForm(f => ({ ...f, numTransDeposito: e.target.value.replace(/\D/g, '') }))}
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded"
                          placeholder="Ej. 500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-24 flex-shrink-0 text-gray-700">MÁX. RETIROS <span className="text-red-600">*</span></label>
                        <input
                          type="text"
                          value={modalForm.montoMaxRetiros}
                          onChange={e => setModalForm(f => ({ ...f, montoMaxRetiros: e.target.value }))}
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded"
                          placeholder="Ej. $10,000"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-24 flex-shrink-0 text-gray-700">MÁX. DEPÓSITOS <span className="text-red-600">*</span></label>
                        <input
                          type="text"
                          value={modalForm.montoMaxDepositos}
                          onChange={e => setModalForm(f => ({ ...f, montoMaxDepositos: e.target.value }))}
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded"
                          placeholder="Ej. $10,000"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-24 flex-shrink-0 text-gray-700">PERIODO</label>
                        <select
                          value={modalForm.periodo}
                          onChange={e => setModalForm(f => ({ ...f, periodo: e.target.value }))}
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded"
                        >
                          <option>Mensual</option>
                          <option>Semanal</option>
                          <option>Quincenal</option>
                          <option>Anual</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50 rounded-b">
              <div>
                {modalStep === 'perfil' && !modalEditId && (
                  <button
                    onClick={() => setModalStep('cliente')}
                    className="px-3 py-1.5 text-xs text-[#4A6FA5] hover:underline flex items-center gap-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 3L4 6l3 3"/></svg>
                    Paso anterior
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowNuevoModal(false)} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Cancelar</button>
                {modalStep === 'perfil' && (
                  <button onClick={handleSavePerfil} className="px-5 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB]" style={{ fontWeight: 500 }}>
                    {modalEditId ? 'Guardar Cambios' : 'Crear Perfil'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ SUB-MODAL Catálogo Productos ══════ */}
      {showProductoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowProductoModal(false)}>
          <div className="bg-white rounded shadow-lg w-[680px]" onClick={e => e.stopPropagation()}>
            <div className="bg-[#4A6FA5] px-4 py-2.5 rounded-t flex items-center justify-between">
              <h3 className="text-sm text-white" style={{ fontWeight: 600 }}>Catálogo de Productos</h3>
              <button onClick={() => setShowProductoModal(false)} className="text-white/80 hover:text-white text-lg">&times;</button>
            </div>
            <div className="p-4">
              <p className="text-[10px] text-gray-500 mb-3">Seleccione un producto haciendo clic en la fila:</p>
              <div className="border border-gray-300">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#D0D0D0]">
                      {['Clave', 'Nombre', 'Tasa', 'Moneda', 'Estatus'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] border-r border-gray-300 last:border-r-0" style={{ fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PRODUCTOS_CATALOGO.map((p, i) => (
                      <tr
                        key={p.clave}
                        onClick={() => handleSelectProducto(p, i)}
                        className="cursor-pointer border-b border-gray-200"
                        style={{ backgroundColor: selectedProductRow === i ? '#4A6FA5' : i % 2 === 1 ? '#EEEEEE' : '#FFFFFF', color: selectedProductRow === i ? 'white' : 'inherit' }}
                        onMouseEnter={e => { if (selectedProductRow !== i) e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                        onMouseLeave={e => { if (selectedProductRow !== i) e.currentTarget.style.backgroundColor = i % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}
                      >
                        <td className="px-3 py-2 border-r border-gray-200">{p.clave}</td>
                        <td className="px-3 py-2 border-r border-gray-200">{p.nombre}</td>
                        <td className="px-3 py-2 border-r border-gray-200">{p.tasa}</td>
                        <td className="px-3 py-2 border-r border-gray-200">{p.moneda}</td>
                        <td className="px-3 py-2">{p.estatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowProductoModal(false)} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL Ver Detalle de Perfil ══════ */}
      {viewPerfil && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setViewPerfil(null)}>
          <div className="bg-white rounded shadow-lg w-[650px]" onClick={e => e.stopPropagation()}>
            <div className="bg-[#4A6FA5] px-4 py-2.5 rounded-t flex items-center justify-between">
              <h3 className="text-sm text-white" style={{ fontWeight: 600 }}>Detalle del Perfil Transaccional</h3>
              <button onClick={() => setViewPerfil(null)} className="text-white/80 hover:text-white text-lg">&times;</button>
            </div>
            <div className="p-5">
              {/* Info del cliente */}
              <div className="bg-gray-50 border border-gray-200 px-3 py-2 mb-3 text-xs text-gray-700" style={{ fontWeight: 600 }}>
                DATOS DEL CLIENTE
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <label className={labelCls}>CLIENTE</label>
                  <div className={viewFieldCls} style={{ fontWeight: 500 }}>{viewPerfil.clienteNombre || '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>RFC</label>
                  <div className={`${viewFieldCls} font-mono`}>{viewPerfil.clienteRFC || '—'}</div>
                </div>
              </div>

              {/* Info del perfil */}
              <div className="bg-gray-50 border border-gray-200 px-3 py-2 mb-3 text-xs text-gray-700" style={{ fontWeight: 600 }}>
                INFORMACIÓN DEL PERFIL
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <label className={labelCls}>SUBLÍNEA</label>
                  <div className={viewFieldCls}>{viewPerfil.sublinea}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>PRODUCTO</label>
                  <div className={viewFieldCls}>{viewPerfil.producto}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>TRANS. RETIRO</label>
                  <div className={viewFieldCls}>{viewPerfil.numTransRetiro}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>TRANS. DEPÓSITO</label>
                  <div className={viewFieldCls}>{viewPerfil.numTransDeposito}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>MÁX. RETIROS</label>
                  <div className={`${viewFieldCls} text-red-600`} style={{ fontWeight: 500 }}>{viewPerfil.montoMaxRetiros}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>MÁX. DEPÓSITOS</label>
                  <div className={`${viewFieldCls} text-green-600`} style={{ fontWeight: 500 }}>{viewPerfil.montoMaxDepositos}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>PERIODO</label>
                  <div className={viewFieldCls}>{viewPerfil.periodo}</div>
                </div>
                {viewPerfil.fechaRegistro && (
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>REGISTRO</label>
                    <div className={viewFieldCls}>{viewPerfil.fechaRegistro}</div>
                  </div>
                )}
              </div>

              {/* Resumen visual */}
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="text-[10px] text-gray-600 mb-2" style={{ fontWeight: 600 }}>RESUMEN DEL PERFIL</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-gray-200 rounded p-2">
                    <div className="text-[9px] text-gray-500 mb-1">Límite Retiros</div>
                    <div className="text-xs text-red-600" style={{ fontWeight: 600 }}>{viewPerfil.montoMaxRetiros} / {viewPerfil.periodo}</div>
                    <div className="text-[9px] text-gray-500 mt-0.5">{viewPerfil.numTransRetiro} transacciones permitidas</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded p-2">
                    <div className="text-[9px] text-gray-500 mb-1">Límite Depósitos</div>
                    <div className="text-xs text-green-600" style={{ fontWeight: 600 }}>{viewPerfil.montoMaxDepositos} / {viewPerfil.periodo}</div>
                    <div className="text-[9px] text-gray-500 mt-0.5">{viewPerfil.numTransDeposito} transacciones permitidas</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
              <button onClick={() => setViewPerfil(null)} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
