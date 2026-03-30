import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { SolicitudActivacionForm } from './SolicitudActivacionForm';
import {
  type SolicitudActivacionListItem,
  type SolicitudActivacionFormData,
  EMPTY_FORM,
  clearSession,
  saveToSession,
} from './solicitudActivacionStore';
import {
  useSolicitudesActivacionDB,
  type BackendStatus,
  parseISOToDisplay,
  parseMoney,
  parsePct,
  lineaProdToTipo,
} from '../../hooks/useSolicitudesActivacionDB';

type ViewState =
  | { type: 'list' }
  | { type: 'form'; mode: 'nuevo' | 'editar' | 'ver'; solicitudId?: string | number; dbId?: string };

function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/');
  const y = parseInt(year);
  const fullYear = y < 100 ? 2000 + y : y;
  return new Date(fullYear, parseInt(month) - 1, parseInt(day));
}

interface SolicitudActivacionListProps {
  /** Si se provee, el módulo abre directamente en modo "nuevo" con estos datos pre-cargados */
  initialNewData?: Partial<SolicitudActivacionFormData>;
  /** Callback cuando se guarda desde modo originación (para notificar a Fase 6) */
  onSavedFromOriginacion?: (item: SolicitudActivacionListItem) => void;
  /** Callback cuando se cierra/cancela desde modo originación */
  onCancelFromOriginacion?: () => void;
}

export function SolicitudActivacionList({
  initialNewData,
  onSavedFromOriginacion,
  onCancelFromOriginacion,
}: SolicitudActivacionListProps = {}) {
  const [view,        setView]        = useState<ViewState>(
    initialNewData ? { type: 'form', mode: 'nuevo' } : { type: 'list' }
  );
  const [solicitudes, setSolicitudes] = useState<SolicitudActivacionListItem[]>([]);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [sortOrder,   setSortOrder]   = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDiag,    setShowDiag]    = useState(false);
  const [filterEstatus, setFilterEstatus] = useState<string>('');
  const itemsPerPage  = 8;
  const tableRef      = useRef<HTMLDivElement>(null);
  const searchBarRef  = useRef<HTMLInputElement>(null);

  // ─── DB Hook ─────────────────────────────────────────────────────
  const {
    solicitudesActivacion,
    loading: loadingDB,
    saving: savingDB,
    warning: warningDB,
    backendStatus,
    fetchMethod,
    dbRowCount,
    refetch,
    saveSolicitudActivacion,
  } = useSolicitudesActivacionDB(true);

  const dbMerged = useRef(false);
  useEffect(() => {
    if (backendStatus === 'ready' || backendStatus === 'empty' || backendStatus === 'local-only') {
      if (!dbMerged.current) {
        dbMerged.current = true;
      }
      if (solicitudesActivacion.length > 0) {
        const sorted = [...solicitudesActivacion].sort((a, b) => {
          try {
            return parseDate(b.fechaSolicitud).getTime() - parseDate(a.fechaSolicitud).getTime();
          } catch { return 0; }
        });
        setSolicitudes(sorted);
      } else {
        setSolicitudes([]);
      }
    }
  }, [solicitudesActivacion, backendStatus]);

  // ─── Handlers ────────────────────────────────────────────────────
  const handleExportCSV   = () => toast.success('Exportando a CSV',   { duration: 3000 });
  const handleExportExcel = () => toast.success('Exportando a Excel', { duration: 3000 });
  const handleExportPDF   = () => toast.success('Exportando a PDF',   { duration: 3000 });
  const handlePrint       = () => toast.success('Imprimiendo',        { duration: 3000 });

  const handleListaClick = () => {
    if (tableRef.current) {
      tableRef.current.classList.add('animate-highlight');
      setTimeout(() => tableRef.current?.classList.remove('animate-highlight'), 1000);
    }
  };

  const handleBuscarClick = () => {
    if (searchBarRef.current) {
      searchBarRef.current.focus();
    }
  };

  const handleNueva = () => {
    clearSession('new');
    setView({ type: 'form', mode: 'nuevo' });
  };

  /** Reconstruct SolicitudActivacionFormData from a list item + raw JOIN data */
  const buildFormDataFromListItem = (s: SolicitudActivacionListItem): SolicitudActivacionFormData => {
    const raw    = (s._raw || {}) as Record<string, unknown>;
    const d      = (raw.data || {}) as Record<string, unknown>;
    const header = (d.header || {}) as Record<string, unknown>;
    const detail = (d.detail || {}) as Record<string, unknown>;

    const montoTransaccion = String(header.montoTransaccion ?? parseMoney(raw.solicitud_monto) ?? '0.00');
    const moneda           = String(header.moneda || raw.solicitud_moneda || 'MXN');
    const detailMonto      = (detail.monto as number)       ?? parseMoney(raw.solicitud_monto);
    // % Impuesto: DB stores as whole number (e.g. 3 = 3%); divide by 100 for decimal form used internally
    const detailPctImpuesto = parsePct(raw.solicitud_tasa_interes) / 100;
    const detailCantidad   = (detail.cantidad as number)    ?? 1;

    // TIPO: always derived from linea_produc; never manually overridden
    const derivedTipo = lineaProdToTipo(String(raw.solicitud_linea_produc || ''))
      || s.tipo
      || String(raw.type || '');

    return {
      ...EMPTY_FORM,
      id:             String(s._dbId || s.id || ''),
      solicitudId:    s.solicitudId  || String(raw.solicitud_id  || ''),
      clienteId:      String(raw.cliente_id || ''),
      type:           derivedTipo,
      fechaSolicitud: s.fechaSolicitud || '',
      fechaCompromiso: raw.solicitud_fecha_primera_aportacion
        ? parseISOToDisplay(String(raw.solicitud_fecha_primera_aportacion))
        : raw.fecha_compromiso
          ? parseISOToDisplay(String(raw.fecha_compromiso))
          : String(header.fechaCompromiso || ''),
      estatus: s.estatus || 'Pendiente',
      // JOIN read-only
      numeroDocumento: s.numeroDocumento || String(raw.cliente_curp || header.numeroDocumento || ''),
      cliente:         s.cliente         || String(header.cliente   || ''),
      cuentaBancaria:  String(raw.solicitud_no_cuenta || header.cuentaBancaria || ''),
      // data.header
      formaDePago:           String(header.formaDePago           || 'Banca por internet'),
      institucionFinanciera: String(header.institucionFinanciera || ''),
      referencia:            String(s._dbId || s.id || ''),
      montoTransaccion,
      moneda,
      nota:        String(header.nota       || ''),
      usuarioNota: String(header.usuarioNota || ''),
      // data.detail
      detailClaveProducto: String(detail.claveProducto || raw.solicitud_producto_id || ''),
      detailCantidad,
      detailMonto,
      detailPctImpuesto,
      detailMoneda: String(detail.moneda || moneda),
      detailSubTotal: (detail.subTotal as number) ?? (detailCantidad * detailMonto * (1 + detailPctImpuesto)),
      detailEstatus: 'Pendiente',
    };
  };

  const resolveStorageId = (s: SolicitudActivacionListItem): string | number =>
    (s._dbId && typeof s._dbId === 'string') ? s._dbId : (typeof s.id === 'number' ? s.id : String(s.id));

  const handleEditar = (s: SolicitudActivacionListItem) => {
    const sid      = resolveStorageId(s);
    clearSession(sid);
    const formData = buildFormDataFromListItem(s);
    saveToSession(sid, 'form', formData);
    setView({ type: 'form', mode: 'editar', solicitudId: sid, dbId: s._dbId || String(s.id) });
  };

  const handleVer = (s: SolicitudActivacionListItem) => {
    const sid      = resolveStorageId(s);
    clearSession(sid);
    const formData = buildFormDataFromListItem(s);
    saveToSession(sid, 'form', formData);
    setView({ type: 'form', mode: 'ver', solicitudId: sid, dbId: s._dbId || String(s.id) });
  };

  const handleBack = () => {
    if (onCancelFromOriginacion) { onCancelFromOriginacion(); return; }
    setView({ type: 'list' });
  };

  const handleSave = async (data: SolicitudActivacionFormData) => {
    const isNew = view.type === 'form' && view.mode === 'nuevo';
    const dbId  = view.type === 'form' ? (view as { dbId?: string }).dbId : undefined;

    let savedItem: SolicitudActivacionListItem | null = null;

    try {
      const result = await saveSolicitudActivacion(data, isNew ? undefined : dbId);
      if (result.ok) {
        toast.success(isNew ? 'Solicitud creada exitosamente' : 'Solicitud actualizada exitosamente', {
          description: data.cliente ? `Cliente: ${data.cliente}` : undefined,
          duration: 3000,
        });
        savedItem = {
          id:              result.id || String(Date.now()),
          solicitudId:     data.solicitudId,
          cliente:         data.cliente,
          numeroDocumento: data.numeroDocumento,
          tipo:            data.type,
          fechaSolicitud:  data.fechaSolicitud.split(' ')[0],
          estatus:         data.estatus || 'Pendiente',
          montoTransaccion: data.montoTransaccion,
          moneda:          data.moneda,
          _dbId:           result.id,
          _fromDB:         true,
        };
      } else {
        toast.error('Error al guardar en BD', { description: result.error || 'Revise la consola', duration: 5000 });
        if (isNew) {
          savedItem = {
            id:              Date.now(),
            solicitudId:     data.solicitudId,
            cliente:         data.cliente,
            numeroDocumento: data.numeroDocumento,
            tipo:            data.type,
            fechaSolicitud:  data.fechaSolicitud.split(' ')[0],
            estatus:         data.estatus || 'Pendiente',
            montoTransaccion: data.montoTransaccion,
            moneda:          data.moneda,
            _fromDB:         false,
          };
          setSolicitudes(prev => [savedItem!, ...prev]);
          toast.info('Guardado localmente (sin BD)', { duration: 3000 });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Error inesperado al guardar', { description: msg, duration: 5000 });
    }

    // Notificar a Originación si aplica
    if (onSavedFromOriginacion && savedItem) {
      onSavedFromOriginacion(savedItem);
      return;
    }

    setView({ type: 'list' });
  };

  // ─── FORM VIEW ───────────────────────────────────────────────────
  if (view.type === 'form') {
    return (
      <SolicitudActivacionForm
        key={`${view.mode}-${view.solicitudId ?? 'new'}`}
        mode={view.mode}
        solicitudId={view.solicitudId}
        initialData={view.mode === 'nuevo' && initialNewData ? initialNewData : undefined}
        onCancel={handleBack}
        onSave={handleSave}
      />
    );
  }

  // ─── LIST VIEW ───────────────────────────────────────────────────
  const filteredSolicitudes = solicitudes
    .filter(s => {
      if (filterEstatus && s.estatus !== filterEstatus) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        s.solicitudId.toLowerCase().includes(q)      ||
        s.cliente.toLowerCase().includes(q)          ||
        s.numeroDocumento.toLowerCase().includes(q)  ||
        s.tipo.toLowerCase().includes(q)             ||
        s.estatus.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      try {
        const da = parseDate(a.fechaSolicitud).getTime();
        const db = parseDate(b.fechaSolicitud).getTime();
        return sortOrder === 'desc' ? db - da : da - db;
      } catch { return 0; }
    });

  const totalPages   = Math.ceil(filteredSolicitudes.length / itemsPerPage);
  const startIndex   = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredSolicitudes.slice(startIndex, startIndex + itemsPerPage);

  const handlePreviousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const handleNextPage     = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const handleFirstPage    = () => setCurrentPage(1);
  const handleLastPage     = () => setCurrentPage(totalPages);
  const handleSearchChange  = (v: string) => { setSearchTerm(v); setCurrentPage(1); };
  const handleSortChange    = (v: 'desc' | 'asc') => { setSortOrder(v); setCurrentPage(1); };
  const handleEstatusChange = (v: string) => { setFilterEstatus(v); setCurrentPage(1); };

  const statusClass = (estatus: string) => {
    if (estatus === 'Activada')    return 'text-green-700 bg-green-50 border-green-200';
    if (estatus === 'Rechazada')   return 'text-red-700 bg-red-50 border-red-200';
    if (estatus === 'En Revisión') return 'text-blue-700 bg-blue-50 border-blue-200';
    if (estatus === 'Aprobada')    return 'text-purple-700 bg-purple-50 border-purple-200';
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  const statusDot = (status: BackendStatus) => ({
    ready:        'bg-green-500',
    empty:        'bg-yellow-500',
    error:        'bg-red-500',
    loading:      'bg-blue-500 animate-pulse',
    'local-only': 'bg-orange-400',
    idle:         'bg-gray-400',
  }[status] ?? 'bg-gray-400');

  return (
    <div className="bg-white min-h-screen">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
              <path d="M9 9l2 2 4-4" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Solicitudes de Activación</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={handleListaClick}  className="cursor-pointer hover:text-secondary-theme transition-colors">Lista</span>
            <span onClick={handleBuscarClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[280px]">
              <option>Vista general de Solicitudes de Activación</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666">
              <path d="M6 8l-4-4h8z" />
            </svg>
          </div>
          {/* Nuevo button hidden — solicitudes are not created manually */}
          {/* <button onClick={handleNueva} className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">Nuevo</button> */}
          <button
            onClick={() => { dbMerged.current = false; refetch(); }}
            disabled={loadingDB}
            className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
          >
            {loadingDB ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="2">
                <circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="1.5">
                <path d="M1 7a6 6 0 0111.196-3M13 7a6 6 0 01-11.196 3" />
                <path d="M1 1v3h3M13 13v-3h-3" />
              </svg>
            )}
            Refrescar
          </button>
          <button
            onClick={() => setShowDiag(!showDiag)}
            className={`px-3 py-1.5 rounded text-xs border ${showDiag ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-400 text-gray-600 hover:bg-gray-50'}`}
          >
            DB
          </button>
        </div>
      </div>

      {/* ── DB Status bar ── */}
      {showDiag && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${statusDot(backendStatus)}`} />
              <span className="text-gray-600">Estado:</span>
              <span className="font-medium text-gray-800">{backendStatus}</span>
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">Método: <span className="font-medium text-gray-800">{fetchMethod || '(pendiente)'}</span></span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">Tabla: <span className="font-mono text-gray-800">J_SOLICITUDES_ACTIVACION</span></span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">Filas DB: <span className="font-medium text-gray-800">{dbRowCount}</span></span>
            {warningDB && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-orange-600 max-w-[300px] truncate" title={warningDB}>{warningDB}</span>
              </>
            )}
            {savingDB && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-blue-600 animate-pulse">Guardando...</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Search / Filters ── */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">Estatus</span>
            <div className="relative">
              <select
                value={filterEstatus}
                onChange={e => handleEstatusChange(e.target.value)}
                className="px-3 py-1 border border-gray-400 rounded text-sm bg-white appearance-none pr-7"
              >
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En Revisión">En Revisión</option>
                <option value="Aprobada">Aprobada</option>
                <option value="Activada">Activada</option>
                <option value="Rechazada">Rechazada</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 12 12" fill="#666">
                <path d="M6 8l-4-4h8z" />
              </svg>
            </div>
          </div>
          <input
            ref={searchBarRef}
            type="text"
            value={searchTerm}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar por ID, cliente, documento, tipo..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-80 transition-all"
          />
        </div>
      </div>

      {/* ── Export / Sort bar ── */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="CSV" onClick={handleExportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280" /><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors" title="Excel" onClick={handleExportExcel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B" /><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors" title="PDF" onClick={handleExportPDF}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F" /><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none" /><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors" title="Imprimir" onClick={handlePrint}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2" /><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none" /><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2" /><circle cx="5" cy="8" r="0.8" fill="#1976D2" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden</span>
              <select
                value={sortOrder}
                onChange={e => handleSortChange(e.target.value as 'desc' | 'asc')}
                className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none"
              >
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            <span className="font-medium">Total: {filteredSolicitudes.length}</span>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">Editar | Ver</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">ID SOLICITUD</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">CLIENTE</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">N° DOCUMENTO</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">TIPO</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">FECHA SOLICITUD</th>
                <th className="px-2 py-2.5 text-right font-medium text-xs text-gray-700">MONTO TRANSACCIÓN</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">MONEDA</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">ESTATUS</th>
              </tr>
            </thead>
            <tbody>
              {loadingDB && solicitudes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="2">
                        <circle cx="8" cy="8" r="6" strokeDasharray="24" strokeDashoffset="12" />
                      </svg>
                      Cargando solicitudes...
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    No se encontraron solicitudes de activación
                  </td>
                </tr>
              ) : (
                currentItems.map((s, idx) => (
                  <tr
                    key={String(s.id)}
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E8F4F8')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF')}
                  >
                    <td className="px-2 py-2.5 text-xs whitespace-nowrap">
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); handleEditar(s); }}>Editar</a>
                      <span className="text-gray-500"> | </span>
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); handleVer(s); }}>Ver</a>
                    </td>
                    <td className="px-2 py-2.5 text-xs font-mono text-gray-600 max-w-[150px] truncate" title={s.solicitudId}>{s.solicitudId || '—'}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[160px] truncate" title={s.cliente}>{s.cliente}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[130px] truncate" title={s.numeroDocumento}>{s.numeroDocumento || '—'}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700">{s.tipo || '—'}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700">{s.fechaSolicitud}</td>
                    <td className="px-2 py-2.5 text-xs text-right text-gray-700 font-mono">
                      {s.montoTransaccion ? `$${s.montoTransaccion}` : '—'}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-700">{s.moneda || '—'}</td>
                    <td className="px-2 py-2.5 text-xs">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${statusClass(s.estatus)}`}>
                        {s.estatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={handleFirstPage} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={handlePreviousPage} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z" /></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">
            Página {currentPage} de {totalPages || 1}
          </div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={handleNextPage} disabled={currentPage === totalPages || totalPages === 0}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={handleLastPage} disabled={currentPage === totalPages || totalPages === 0}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
