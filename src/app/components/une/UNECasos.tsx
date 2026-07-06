import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  CasoUNE, TipoCaso, Canal, Prioridad, EstatusCaso,
  CAT_TIPO_CASO, CAT_CANAL, CAT_PRIORIDAD, CAT_ESTATUS,
  CAT_PRODUCTOS, CAT_MOTIVOS, CAT_AREAS,
  generarFolio, calcularFechaLimite, diasRestantes,
} from './uneStore';

interface Props {
  casos: CasoUNE[];
  onSave: (casos: CasoUNE[]) => void;
  onVerCaso: (id: string) => void;
}

const CLIENTES_MOCK = [
  { id: 'CLI-001', nombre: 'Juan Perez Perez' },
  { id: 'CLI-002', nombre: 'ROTOR AS, S.A DE C.V' },
  { id: 'CLI-003', nombre: 'Dulce Fernandez Solis' },
  { id: 'CLI-004', nombre: 'HELVER, S.A. DE C.V.' },
  { id: 'CLI-005', nombre: 'Sofia Reyes Lopez' },
  { id: 'CLI-006', nombre: 'Carlos Perez Leon' },
  { id: 'CLI-007', nombre: 'Juan Mendoza Anaya' },
  { id: 'CLI-008', nombre: 'INHEM DE MEXICO S.A. DE C.V.' },
];

const OPERADORES = ['Ana Martínez', 'Carlos Soto', 'Laura Vega', 'Pedro Ruiz', 'Mónica Díaz'];

function hoyStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

const estatusBadge = (e: EstatusCaso) =>
  e === 'Recibido'      ? 'bg-gray-100 text-gray-600 border-gray-300' :
  e === 'En revisión'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
  e === 'En resolución' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-green-50 text-green-700 border-green-200';

const tipoBadge = (t: TipoCaso) =>
  t === 'Consulta'    ? 'bg-sky-50 text-sky-700 border-sky-200' :
  t === 'Queja'       ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200';

const prioridadDot = (p: Prioridad) =>
  p === 'Alta' ? 'bg-red-500' : p === 'Media' ? 'bg-amber-400' : 'bg-green-500';

const EMPTY_FORM = {
  clienteId: '', tipo: '' as TipoCaso | '', canal: '' as Canal | '',
  prioridad: 'Media' as Prioridad, productoAfectado: '',
  motivoCategoria: '', descripcion: '', areaResponsable: '', operadorAsignado: '',
};

export function UNECasos({ casos, onSave, onVerCaso }: Props) {
  const [filtroTipo,    setFiltroTipo]    = useState<string>('');
  const [filtroEstatus, setFiltroEstatus] = useState<string>('');
  const [filtroPrior,   setFiltroPrior]   = useState<string>('');
  const [busqueda,      setBusqueda]      = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState({ ...EMPTY_FORM });
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  const casosFiltrados = useMemo(() => {
    return casos.filter(c => {
      if (filtroTipo    && c.tipo     !== filtroTipo)    return false;
      if (filtroEstatus && c.estatus  !== filtroEstatus) return false;
      if (filtroPrior   && c.prioridad !== filtroPrior)  return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!c.folio.toLowerCase().includes(q) &&
            !c.clienteNombre.toLowerCase().includes(q) &&
            !c.descripcion.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [casos, filtroTipo, filtroEstatus, filtroPrior, busqueda]);

  const set = (f: keyof typeof EMPTY_FORM, v: string) => {
    setForm(p => ({ ...p, [f]: v }));
    if (f === 'tipo') setForm(p => ({ ...p, tipo: v as TipoCaso, motivoCategoria: '' }));
    if (errors[f]) setErrors(p => { const n = { ...p }; delete n[f]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.clienteId)        e.clienteId = 'Requerido';
    if (!form.tipo)              e.tipo = 'Requerido';
    if (!form.canal)             e.canal = 'Requerido';
    if (!form.productoAfectado)  e.productoAfectado = 'Requerido';
    if (!form.motivoCategoria)   e.motivoCategoria = 'Requerido';
    if (!form.descripcion.trim())e.descripcion = 'Requerido';
    if (!form.areaResponsable)   e.areaResponsable = 'Requerido';
    if (!form.operadorAsignado)  e.operadorAsignado = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = () => {
    if (!validate()) return;
    const folio = generarFolio();
    const hoy = hoyStr();
    const cliente = CLIENTES_MOCK.find(c => c.id === form.clienteId)!;
    const nuevo: CasoUNE = {
      id: String(Date.now()),
      folio,
      clienteId: form.clienteId,
      clienteNombre: cliente.nombre,
      tipo: form.tipo as TipoCaso,
      canal: form.canal as Canal,
      prioridad: form.prioridad,
      estatus: 'Recibido',
      productoAfectado: form.productoAfectado,
      motivoCategoria: form.motivoCategoria,
      descripcion: form.descripcion,
      fechaRecepcion: hoy,
      fechaLimite: calcularFechaLimite(hoy, form.tipo as TipoCaso),
      areaResponsable: form.areaResponsable,
      operadorAsignado: form.operadorAsignado,
      notificadoCliente: false,
      historial: [{
        fase: 'Recibido',
        fecha: `${hoy} ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
        usuario: 'Sistema',
        nota: `Caso registrado por operador. Canal: ${form.canal}.`,
      }],
    };
    onSave([nuevo, ...casos]);
    setShowModal(false);
    setForm({ ...EMPTY_FORM });
    setErrors({});
    toast.success(`Caso ${folio} registrado`, { description: `Plazo límite: ${nuevo.fechaLimite}` });
  };

  const ic = (err?: string) =>
    `w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-[#2E5C91] ${err ? 'border-red-400' : 'border-gray-300'}`;

  const motivos = form.tipo ? CAT_MOTIVOS[form.tipo as TipoCaso] : [];

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          type="text" placeholder="Buscar folio, cliente, descripción..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="flex-1 min-w-[180px] px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#2E5C91]"
        />
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none">
          <option value="">Todos los tipos</option>
          {CAT_TIPO_CASO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none">
          <option value="">Todos los estatus</option>
          {CAT_ESTATUS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filtroPrior} onChange={e => setFiltroPrior(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none">
          <option value="">Todas las prioridades</option>
          {CAT_PRIORIDAD.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-1.5 bg-[#2E5C91] text-white text-xs rounded hover:bg-[#1d3f6b] flex items-center gap-1.5 whitespace-nowrap">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 1v8M1 5h8"/>
          </svg>
          Nuevo caso
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full border-collapse text-xs min-w-[900px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              {['Folio','Cliente','Tipo','Producto afectado','Motivo','Prioridad','Recepción','Límite CONDUSEF','Estatus','Operador',''].map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-[10px] text-gray-600 font-medium border-r border-gray-200 last:border-0 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {casosFiltrados.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-xs text-gray-400">Sin casos que coincidan con los filtros</td></tr>
            ) : casosFiltrados.map((c, i) => {
              const dias = diasRestantes(c.fechaLimite, c.fechaCierre);
              const vencido = dias < 0 && c.estatus !== 'Cerrado';
              return (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors"
                  style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}
                  onClick={() => onVerCaso(c.id)}>
                  <td className="px-3 py-2 border-r border-gray-100 font-mono text-[#2E5C91] font-medium whitespace-nowrap">{c.folio}</td>
                  <td className="px-3 py-2 border-r border-gray-100 text-gray-700 whitespace-nowrap">{c.clienteNombre}</td>
                  <td className="px-3 py-2 border-r border-gray-100">
                    <span className={`px-1.5 py-0.5 text-[9px] border ${tipoBadge(c.tipo)}`}>{c.tipo}</span>
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100 text-gray-600">{c.productoAfectado}</td>
                  <td className="px-3 py-2 border-r border-gray-100 text-gray-600 max-w-[140px] truncate" title={c.motivoCategoria}>{c.motivoCategoria}</td>
                  <td className="px-3 py-2 border-r border-gray-100">
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${prioridadDot(c.prioridad)}`}/>
                      <span className="text-gray-700">{c.prioridad}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100 text-gray-500 whitespace-nowrap">{c.fechaRecepcion}</td>
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">
                    <span className={vencido ? 'text-red-600 font-semibold' : 'text-gray-600'}>{c.fechaLimite}</span>
                    {c.estatus !== 'Cerrado' && (
                      <span className={`ml-1 text-[9px] ${vencido ? 'text-red-500' : dias <= 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {vencido ? `(+${Math.abs(dias)}d)` : `(${dias}d)`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100">
                    <span className={`px-1.5 py-0.5 text-[9px] border ${estatusBadge(c.estatus)}`}>{c.estatus}</span>
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100 text-gray-600 whitespace-nowrap">{c.operadorAsignado}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={e => { e.stopPropagation(); onVerCaso(c.id); }}
                      className="text-[10px] text-[#2E5C91] hover:underline">Ver</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 mt-1">{casosFiltrados.length} caso(s) mostrado(s)</p>

      {/* Modal nuevo caso */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="bg-[#2E5C91] px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-white">Registrar nuevo caso UNE</span>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l12 12M14 2L2 14"/></svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1">

              {/* Sección: Datos del caso */}
              <div className="bg-gray-50 border-l-4 border-[#2E5C91] px-3 py-1.5 mb-3">
                <span className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Datos del caso</span>
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 mb-4">
                {/* Cliente */}
                <div className="col-span-2">
                  <label className="block text-[10px] text-gray-600 mb-1 font-medium">CLIENTE <span className="text-red-500">*</span></label>
                  <select value={form.clienteId} onChange={e => set('clienteId', e.target.value)} className={ic(errors.clienteId)}>
                    <option value="">Seleccionar...</option>
                    {CLIENTES_MOCK.map(c => <option key={c.id} value={c.id}>{c.id} — {c.nombre}</option>)}
                  </select>
                  {errors.clienteId && <p className="text-[10px] text-red-500 mt-0.5">{errors.clienteId}</p>}
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-[10px] text-gray-600 mb-1 font-medium">TIPO <span className="text-red-500">*</span></label>
                  <select value={form.tipo} onChange={e => { setForm(p => ({ ...p, tipo: e.target.value as TipoCaso, motivoCategoria: '' })); }} className={ic(errors.tipo)}>
                    <option value="">Seleccionar...</option>
                    {CAT_TIPO_CASO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.tipo && <p className="text-[10px] text-red-500 mt-0.5">{errors.tipo}</p>}
                </div>

                {/* Canal */}
                <div>
                  <label className="block text-[10px] text-gray-600 mb-1 font-medium">CANAL DE RECEPCIÓN <span className="text-red-500">*</span></label>
                  <select value={form.canal} onChange={e => set('canal', e.target.value)} className={ic(errors.canal)}>
                    <option value="">Seleccionar...</option>
                    {CAT_CANAL.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.canal && <p className="text-[10px] text-red-500 mt-0.5">{errors.canal}</p>}
                </div>

                {/* Producto */}
                <div>
                  <label className="block text-[10px] text-gray-600 mb-1 font-medium">PRODUCTO AFECTADO <span className="text-red-500">*</span></label>
                  <select value={form.productoAfectado} onChange={e => set('productoAfectado', e.target.value)} className={ic(errors.productoAfectado)}>
                    <option value="">Seleccionar...</option>
                    {CAT_PRODUCTOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {errors.productoAfectado && <p className="text-[10px] text-red-500 mt-0.5">{errors.productoAfectado}</p>}
                </div>

                {/* Motivo */}
                <div>
                  <label className="block text-[10px] text-gray-600 mb-1 font-medium">MOTIVO / CATEGORÍA <span className="text-red-500">*</span></label>
                  <select value={form.motivoCategoria} onChange={e => set('motivoCategoria', e.target.value)} disabled={!form.tipo} className={ic(errors.motivoCategoria)}>
                    <option value="">{form.tipo ? 'Seleccionar...' : 'Primero seleccione el tipo'}</option>
                    {motivos.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {errors.motivoCategoria && <p className="text-[10px] text-red-500 mt-0.5">{errors.motivoCategoria}</p>}
                </div>

                {/* Prioridad */}
                <div>
                  <label className="block text-[10px] text-gray-600 mb-1 font-medium">PRIORIDAD</label>
                  <select value={form.prioridad} onChange={e => set('prioridad', e.target.value as Prioridad)} className={ic()}>
                    {CAT_PRIORIDAD.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* Descripción */}
                <div className="col-span-2">
                  <label className="block text-[10px] text-gray-600 mb-1 font-medium">DESCRIPCIÓN DEL CASO <span className="text-red-500">*</span></label>
                  <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                    rows={3} placeholder="Describa detalladamente el motivo del caso..."
                    className={`${ic(errors.descripcion)} resize-none`}/>
                  {errors.descripcion && <p className="text-[10px] text-red-500 mt-0.5">{errors.descripcion}</p>}
                </div>
              </div>

              {/* Sección: Asignación */}
              <div className="bg-gray-50 border-l-4 border-[#2E5C91] px-3 py-1.5 mb-3">
                <span className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Asignación</span>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                <div>
                  <label className="block text-[10px] text-gray-600 mb-1 font-medium">ÁREA RESPONSABLE <span className="text-red-500">*</span></label>
                  <select value={form.areaResponsable} onChange={e => set('areaResponsable', e.target.value)} className={ic(errors.areaResponsable)}>
                    <option value="">Seleccionar...</option>
                    {CAT_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {errors.areaResponsable && <p className="text-[10px] text-red-500 mt-0.5">{errors.areaResponsable}</p>}
                </div>
                <div>
                  <label className="block text-[10px] text-gray-600 mb-1 font-medium">OPERADOR ASIGNADO <span className="text-red-500">*</span></label>
                  <select value={form.operadorAsignado} onChange={e => set('operadorAsignado', e.target.value)} className={ic(errors.operadorAsignado)}>
                    <option value="">Seleccionar...</option>
                    {OPERADORES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  {errors.operadorAsignado && <p className="text-[10px] text-red-500 mt-0.5">{errors.operadorAsignado}</p>}
                </div>
              </div>

              {/* Info plazo */}
              {form.tipo && (
                <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 text-[10px] text-blue-800">
                  Plazo legal CONDUSEF para <strong>{form.tipo}</strong>: <strong>{form.tipo === 'Consulta' ? '5' : form.tipo === 'Queja' ? '10' : '20'} días hábiles</strong> a partir de la recepción.
                  {' '}Fecha límite estimada: <strong>{calcularFechaLimite(hoyStr(), form.tipo as TipoCaso)}</strong>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
              <button onClick={() => { setShowModal(false); setForm({ ...EMPTY_FORM }); setErrors({}); }}
                className="px-4 py-1.5 border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={handleGuardar}
                className="px-4 py-1.5 bg-[#2E5C91] text-white text-xs rounded hover:bg-[#1d3f6b]">
                Registrar caso
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
