import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { SolicitudCreditoForm } from './SolicitudCreditoForm';
import {
  SolicitudListItem, SOLICITUDES_LISTA,
  clearSession, migrateSavedStore, saveToSavedStore, saveToSession, formatCurrency as fmtCur,
  EMPTY_FORM, EMPTY_TERMINOS, consumeNoSol, getFechaSolicitudNow,
} from './solicitudCreditoStore';
import { createCreditoFromSolicitud } from '../creditos/creditoStore';
import { useSolicitudesDB } from '../../hooks/useSolicitudesDB';

type ViewState = { type: 'list' } | { type: 'form'; mode: 'nuevo' | 'editar' | 'ver'; solicitudId?: number | string; dbId?: string };

interface SolicitudCreditoListProps {
  /** Datos mapeados desde Cotización para pre-llenar una nueva solicitud */
  cotizacionParaSolicitud?: any;
  /** Callback para limpiar el dato de cotización después de consumirlo */
  onCotizacionConsumed?: () => void;
}

function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/');
  const y = parseInt(year);
  const fullYear = y < 100 ? 2000 + y : y;
  return new Date(fullYear, parseInt(month) - 1, parseInt(day));
}

export function SolicitudCreditoList({ cotizacionParaSolicitud, onCotizacionConsumed }: SolicitudCreditoListProps = {}) {
  const [view, setView] = useState<ViewState>({ type: 'list' });
  const [solicitudes, setSolicitudes] = useState<SolicitudListItem[]>(() =>
    [...SOLICITUDES_LISTA].sort((a, b) => parseDate(b.fechaSolicitud).getTime() - parseDate(a.fechaSolicitud).getTime())
  );
  const [dbLoaded, setDbLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  // Modal generar crédito
  const [showGenerarModal, setShowGenerarModal] = useState(false);
  const [solicitudToGenerate, setSolicitudToGenerate] = useState<SolicitudListItem | null>(null);
  const [generatedCreditos, setGeneratedCreditos] = useState<Set<number>>(new Set());
  const [showDiag, setShowDiag] = useState(false);

  // ═══════════════════════════════════════════════════════════════
  // Hook DB — J_CUENTAS_CORP_CLIENTES
  // ═══════════════════════════════════════════════════════════════
  const {
    solicitudes: solicitudesDB,
    loading: loadingDB,
    saving: savingDB,
    warning: warningDB,
    backendStatus,
    fetchMethod,
    dbRowCount,
    refetch,
    saveSolicitud,
  } = useSolicitudesDB(true);

  // Merge: DB rows replace/supplement MOCK data
  const dbMerged = useRef(false);
  useEffect(() => {
    // Once DB responds (even if empty), it becomes source of truth
    if (backendStatus === 'ready' || backendStatus === 'empty') {
      if (!dbMerged.current) {
        dbMerged.current = true;
        setDbLoaded(true);
      }
      // Always sync list from DB when solicitudesDB changes (initial load + after save/refetch)
      if (solicitudesDB.length > 0) {
        const sorted = [...solicitudesDB].sort((a, b) => {
          try { return parseDate(b.fechaSolicitud).getTime() - parseDate(a.fechaSolicitud).getTime(); }
          catch { return 0; }
        });
        setSolicitudes(sorted);
        console.log(`[SolicList] Synced ${solicitudesDB.length} rows from DB`);
      } else {
        setSolicitudes([]);
        console.log('[SolicList] DB returned 0 rows');
      }
    }
  }, [solicitudesDB, backendStatus]);

  const formatCurrency = (value: number) => `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ─── Flujo "Crear desde Cotización" — spec solicitudes-financieras §1–§4 ───
  useEffect(() => {
    if (!cotizacionParaSolicitud) return;
    // Pre-llenar sessionStorage con los datos mapeados de la cotización
    clearSession('new');
    const noSol = consumeNoSol();
    const fechaSol = getFechaSolicitudNow();
    const formData = {
      ...EMPTY_FORM,
      noSol,
      fechaSolicitud: fechaSol,
      cotizacionId: cotizacionParaSolicitud.cotizacionId || '',
      lineaProducto: cotizacionParaSolicitud.lineaProducto || 'Crédito',
      tipoProducto: cotizacionParaSolicitud.tipoProducto || '',
      tipoPersona: cotizacionParaSolicitud.tipoPersona || '',
      nombrePersona: cotizacionParaSolicitud.nombrePersona || '',
      apellidoPaternoPersona: cotizacionParaSolicitud.apellidoPaternoPersona || '',
      apellidoMaternoPersona: cotizacionParaSolicitud.apellidoMaternoPersona || '',
      productoId: cotizacionParaSolicitud.productoId || '',
      nombreProducto: cotizacionParaSolicitud.nombreProducto || '',
      montoSolicitado: cotizacionParaSolicitud.montoSolicitado || '',
      descripcion: `Solicitud generada desde Cotización ${cotizacionParaSolicitud.cotizacionId || ''}`,
    };
    saveToSession('new', 'form', formData);
    // Pre-llenar términos y condiciones si vienen de la cotización
    if (cotizacionParaSolicitud._terminosCondiciones) {
      const tc = cotizacionParaSolicitud._terminosCondiciones;
      // Convertir fecha de YYYY-MM-DD a DD/MM/YYYY si es necesario
      let fechaPrimerPago = tc.fechaPrimerPago || '';
      if (fechaPrimerPago && /^\d{4}-\d{2}-\d{2}$/.test(fechaPrimerPago)) {
        const [y, m, d] = fechaPrimerPago.split('-');
        fechaPrimerPago = `${d}/${m}/${y}`;
      }
      // Captación usa fechaPrimeraAportacion en vez de fechaPrimerPago
      let fechaPrimeraAportacion = tc.fechaPrimeraAportacion || '';
      if (fechaPrimeraAportacion && /^\d{4}-\d{2}-\d{2}$/.test(fechaPrimeraAportacion)) {
        const [y, m, d] = fechaPrimeraAportacion.split('-');
        fechaPrimeraAportacion = `${d}/${m}/${y}`;
      }
      const terminos = {
        ...EMPTY_TERMINOS,
        montoSolicitado: tc.montoSolicitado || '',
        fechaPrimerPago,
        fechaPrimeraAportacion,
        plazo: tc.plazo || '',
        frecuencia: tc.frecuencia || 'Mensual',
        tasa: tc.tasa || '',
        tipoTasa: tc.tipoTasa || 'Fija',
        tipoCalculo: tc.tipoCalculo || 'Francés',
        moneda: tc.moneda || 'MXN',
        montoGarantia: tc.montoGarantia || '',
        seguroFinanciado: tc.seguroFinanciado || false,
        montoSeguro: tc.montoSeguro || '',
      };
      saveToSession('new', 'terminos', terminos);
    }
    // Abrir formulario en modo nuevo
    setView({ type: 'form', mode: 'nuevo' });
    onCotizacionConsumed?.();
  }, [cotizacionParaSolicitud]);

  const handleExportExcel = () => toast.success('Exportando a Excel', { description: 'El archivo se está descargando...', duration: 3000 });
  const handleExportCSV = () => toast.success('Exportando a CSV', { description: 'El archivo CSV se está descargando...', duration: 3000 });
  const handleExportPDF = () => toast.success('Exportando a PDF', { description: 'El archivo PDF se está descargando...', duration: 3000 });
  const handlePrint = () => toast.success('Imprimiendo', { description: 'Enviando documento a la impresora...', duration: 3000 });

  const handleListaClick = () => {
    if (tableRef.current) { tableRef.current.classList.add('animate-highlight'); setTimeout(() => tableRef.current?.classList.remove('animate-highlight'), 1000); }
  };
  const handleBuscarClick = () => {
    if (searchBarRef.current) { searchBarRef.current.focus(); searchBarRef.current.classList.add('animate-highlight-border'); setTimeout(() => searchBarRef.current?.classList.remove('animate-highlight-border'), 1000); }
  };

  const handleNuevaSolicitud = () => { clearSession('new'); setView({ type: 'form', mode: 'nuevo' }); };

  /** Resuelve el ID de storage para una solicitud: UUID string o number legacy */
  const resolveStorageId = (s: SolicitudListItem): number | string => {
    // Si viene de BD, usar el UUID string directamente (sin hash) para evitar colisiones
    const dbId = (s as any)._dbId;
    if (dbId && typeof dbId === 'string') return dbId;
    // Legacy mock: number directo
    if (typeof s.id === 'number') return s.id;
    return String(s.id);
  };

  /**
   * Reconstruye un SolicitudFormData completo a partir del list item + _data JSONB.
   * Soporta estructura anidada (banca móvil: data.solicitud.header) Y flat legacy.
   */
  const buildFormDataFromListItem = (s: SolicitudListItem): Record<string, any> => {
    const extra = s as any;
    const d = extra._data || {};
    // ── Nested structure (banca móvil) ──
    const sol = d.solicitud || {};
    const hdr = sol.header || {};

    // ── JOIN fields from mapRowToListItem (fallback when JSONB data is empty) ──
    const joinNombre = extra._clienteNombre || '';
    const joinApPaterno = extra._clienteApPaterno || '';
    const joinApMaterno = extra._clienteApMaterno || '';
    const joinTipoPersona = extra._clienteTipo || '';
    const joinProductoNombre = extra._productoNombre || '';
    const joinSucursal = extra._productoSucursal || '';
    const joinLineaProducto = extra._lineaProducto || '';
    const joinTipoProducto = extra._tipoProducto || '';
    const joinDescripcion = extra._descripcion || '';
    const joinFases = extra._fases || '';

    console.log('[buildFormData] sources → hdr:', JSON.stringify(hdr).substring(0, 200),
      '| flat d keys:', Object.keys(d).filter(k => k !== 'solicitud').join(','),
      '| JOIN nombre:', joinNombre, '| JOIN tipo:', joinTipoPersona);

    return {
      id: extra._dbId || String(s.id) || '',
      noSol: s.noSol || hdr.no_sol || d.noSol || '',
      cotizacionId: hdr.cotizacion_id || d.cotizacionId || '',
      lineaProducto: hdr.linea_producto || d.lineaProducto || joinLineaProducto || 'Crédito',
      tipoProducto: s.tipoProducto || hdr.tipo_producto || d.tipoProducto || joinTipoProducto || '',
      tipoPersona: hdr.tipo_persona || d.tipoPersona || joinTipoPersona || '',
      nombrePersona: hdr.nombre_persona || d.nombrePersona || joinNombre || '',
      apellidoPaternoPersona: hdr.apellido_paterno_persona || d.apellidoPaternoPersona || joinApPaterno || '',
      apellidoMaternoPersona: hdr.apellido_materno_persona || d.apellidoMaternoPersona || joinApMaterno || '',
      productoId: extra._productoId || hdr.producto_id || d.productoId || '',
      nombreProducto: s.nombreProducto || hdr.nombre_producto || d.nombreProducto || joinProductoNombre || '',
      fechaSolicitud: s.fechaSolicitud || hdr.fecha_solicitud || d.fechaSolicitud || '',
      descripcion: hdr.descripcion || d.descripcion || joinDescripcion || '',
      faseId: hdr.fase_id || d.faseId || joinFases || '1',
      descripcionFase: s.faseDescripcion || hdr.descripcion_fase || d.descripcionFase || '',
      estatusSolicitud: s.estatusSolicitud || hdr.estatus || d.estatusSolicitud || 'Pendiente',
      sucursal: s.sucursal || hdr.sucursal || d.sucursal || joinSucursal || '',
      montoSolicitado: hdr.monto_solicitado
        || (typeof s.montoSolicitado === 'number' && s.montoSolicitado > 0 ? s.montoSolicitado.toFixed(2) : null)
        || d.montoSolicitado || '0.00',
      montoAutorizado: hdr.monto_autorizado
        || (typeof s.montoAutorizado === 'number' && s.montoAutorizado > 0 ? s.montoAutorizado.toFixed(2) : null)
        || d.montoAutorizado || '0.00',
      _clienteId: extra._clienteId || hdr.cliente_id || d._clienteId || '',
    };
  };

  /**
   * Pre-carga las secciones de subtabs en sessionStorage desde la estructura anidada de BD.
   * Lee data.solicitud.terminos_condiciones, simulacion, garantias, etc.
   */
  const preloadSubtabsFromDBData = (storageId: number | string, d: Record<string, any>) => {
    const sol = d.solicitud || {};

    // ── Términos y Condiciones ──
    const tc = sol.terminos_condiciones || {};
    const ps = tc.parametros_simulacion || {};
    const rawTerminos = tc._raw || {};
    if (Object.keys(tc).length > 0) {
      saveToSession(storageId, 'terminos', {
        montoSolicitado: ps.monto_solicitado || rawTerminos.montoSolicitado || '',
        fechaPrimerPago: ps.fecha_primer_pago || rawTerminos.fechaPrimerPago || '',
        fechaPrimeraAportacion: ps.fecha_primera_aportacion || rawTerminos.fechaPrimeraAportacion || '',
        plazo: ps.plazo || rawTerminos.plazo || '',
        frecuencia: ps.periodicidad || rawTerminos.frecuencia || '',
        tasa: ps.tasa_interes || rawTerminos.tasa || '',
        tipoTasa: rawTerminos.tipoTasa || '',
        tipoCalculo: rawTerminos.tipoCalculo || '',
        moneda: rawTerminos.moneda || '',
        montoGarantia: rawTerminos.montoGarantia || '',
        seguroFinanciado: rawTerminos.seguroFinanciado ?? false,
        montoSeguro: rawTerminos.montoSeguro || '',
      });
    }

    // ── Simulación ──
    const sim = sol.simulacion || {};
    if (sim.resultado_simulacion?.length > 0) {
      saveToSession(storageId, 'simulacion', sim.resultado_simulacion.map((r: any) => ({
        noPago: r.no_pago, fechaPago: r.fecha_pago, saldoInsoluto: r.saldo_insoluto,
        pagoCapital: r.pago_capital, pagoInteres: r.pago_interes, ivaInteres: r.iva_interes,
        pagoPeriodo: r.pago_periodo, pagoSeguro: r.pago_seguro, pagoTotal: r.pago_total,
      })));
    }

    // ── Expediente Electrónico ──
    const exp = sol.expediente_electronico || {};
    if (exp.documentos?.length > 0) {
      saveToSession(storageId, 'documentos', exp.documentos.map((doc: any, i: number) => ({
        id: doc.id || (i + 1), fecha: doc.fecha_creacion || '', usuario: doc.usuario || '',
        tipoDocumento: doc.tipo_documento || '', archivo: doc.archivo_adjunto || '',
        tipoArchivo: doc.tipo_archivo || '', nota: doc.nota || '', area: doc.area || '',
        fase: doc.fase || '', faseId: doc.fase_id || 0, estatus: doc.estatus || 'Pendiente',
        validadoIA: doc.validado_ia ?? false,
        // ── Campos de referencia al archivo en Storage (críticos para recuperación) ──
        url: doc.url || '',
        storagePath: doc.storage_path || '',
        storageBucket: doc.storage_bucket || '',
        mime: doc.mime || '',
        tamanoKB: doc.tamano_kb || 0,
        // ── Resultados de validación IA ──
        iaMotivos: doc.ia_motivos || [],
        iaExtraido: doc.ia_extraido || {},
      })));
    }

    // ── Garantías ──
    if (sol.garantias?.length > 0) {
      saveToSession(storageId, 'garantias', sol.garantias.map((g: any, i: number) => ({
        id: i + 1, fecha: '', usuario: '', tipo: g.tipo_garantia || '', subtipo: g.subtipo || '',
        descripcion: g.descripcion || '', valorNominal: g.valor_garantia || 0,
        ubicacion: g.ubicacion || '', estatus: g.estatus || '', nota: g.observaciones || '',
        fase: g.fase || '', faseId: g.fase_id || 0, area: g.area || '',
      })));
    }

    // ── Comisiones ──
    if (sol.comisiones?.length > 0) {
      console.log(`[preloadSubtabs] storageId=${storageId} — comisiones de BD (${sol.comisiones.length}):`, JSON.stringify(sol.comisiones).substring(0, 300));
      saveToSession(storageId, 'comisiones', sol.comisiones.map((c: any, i: number) => ({
        id: i + 1, tipoComision: c.tipo_comision || '', descripcion: c.descripcion || '',
        base: c.base || '', porcentaje: c.porcentaje || 0, montoCalculado: c.monto || 0,
        estatus: c.estatus || 'Pendiente',
      })));
    } else {
      console.log(`[preloadSubtabs] storageId=${storageId} — SIN comisiones en BD (sol.comisiones es vacío o undefined)`);
    }

    // ── Autorizaciones ──
    if (sol.autorizaciones?.length > 0) {
      saveToSession(storageId, 'autorizaciones', sol.autorizaciones.map((a: any, i: number) => ({
        id: i + 1, fechaHora: a.fecha_autorizacion || '', usuario: a.usuario || '',
        puesto: a.puesto || '', area: a.area || '', descripcion: a.descripcion || '',
        observaciones: a.comentario || '', estatus: a.estado_autorizacion || '',
      })));
    }

    // ── Notas ──
    if (sol.notas?.length > 0) {
      saveToSession(storageId, 'notas', sol.notas.map((n: any, i: number) => ({
        id: i + 1, fecha: n.fecha || '', usuario: n.usuario || '',
        puesto: n.puesto || '', nota: n.nota || '', archivoAdjunto: n.archivo_adjunto || '',
      })));
    }
  };

  const handleEditar = (s: SolicitudListItem) => {
    const sid = resolveStorageId(s);
    clearSession(sid);
    const formData = buildFormDataFromListItem(s);
    console.log('[SolicList] handleEditar → storageId:', sid, '| noSol:', formData.noSol, '| nombre:', formData.nombrePersona);
    saveToSession(sid, 'form', formData);
    const dbData = (s as any)._data;
    if (dbData && typeof dbData === 'object') {
      preloadSubtabsFromDBData(sid, dbData);
    }
    setView({ type: 'form', mode: 'editar', solicitudId: sid, dbId: (s as any)._dbId || String(s.id) });
  };
  const handleVer = (s: SolicitudListItem) => {
    const sid = resolveStorageId(s);
    clearSession(sid);
    const formData = buildFormDataFromListItem(s);
    console.log('[SolicList] handleVer → storageId:', sid, '| noSol:', formData.noSol);
    saveToSession(sid, 'form', formData);
    const dbData = (s as any)._data;
    if (dbData && typeof dbData === 'object') {
      preloadSubtabsFromDBData(sid, dbData);
    }
    setView({ type: 'form', mode: 'ver', solicitudId: sid, dbId: (s as any)._dbId || String(s.id) });
  };
  const handleBack = () => setView({ type: 'list' });

  const handleSave = async (data: any) => {
    const montoSol = typeof data.montoSolicitado === 'string' ? parseFloat(data.montoSolicitado.replace(/[^0-9.-]/g, '')) || 0 : (data.montoSolicitado || 0);
    const montoAut = typeof data.montoAutorizado === 'string' ? parseFloat(data.montoAutorizado.replace(/[^0-9.-]/g, '')) || 0 : (data.montoAutorizado || 0);

    // Format date for list (keep DD/MM/YYYY part only)
    const formatDateForList = (d: string): string => {
      if (!d) return '';
      return d.split(' ')[0]; // remove time part
    };

    const isNew = view.type === 'form' && view.mode === 'nuevo';
    const isEdit = view.type === 'form' && view.mode === 'editar';
    const dbId = isEdit ? (view as any).dbId : undefined;
    const allSubtabs = data._allSubtabs || {};
    // Remove internal field before storing locally
    const cleanData = { ...data };
    delete cleanData._allSubtabs;

    // ── Persist to DB — AWAIT (blocking) para evitar race condition ──
    try {
      const result = await saveSolicitud(cleanData, dbId, allSubtabs);
      if (result.ok) {
        console.log('[SolicList] DB persist OK — id:', result.id);
        toast.success(isNew ? 'Solicitud creada exitosamente' : 'Solicitud actualizada exitosamente', {
          description: `N° ${data.noSol} — Sincronizado con BD (ID: ${result.id?.substring(0, 8)}...)`,
          duration: 3000,
        });
        // fetchSolicitudes() ya se ejecutó dentro de saveSolicitud,
        // y el useEffect ya sincronizó solicitudesDB → solicitudes locales.
        // NO agregar manualmente el item local — la BD es la fuente de verdad.
      } else {
        console.warn('[SolicList] DB persist FAILED:', result.error);
        toast.error('Error al guardar en BD', { description: result.error || 'Revise la consola', duration: 5000 });

        // ── Fallback: agregar localmente si la BD falló ──
        if (isNew) {
          const numericIds = solicitudes.map(s => typeof s.id === 'number' ? s.id : 0);
          const newId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
          migrateSavedStore('new', newId);
          saveToSavedStore(newId, 'form', { ...cleanData });

          const nueva: SolicitudListItem = {
            id: newId,
            noSol: data.noSol || '',
            nombreCompleto: `${data.nombrePersona || ''} ${data.apellidoPaternoPersona || ''} ${data.apellidoMaternoPersona || ''}`.trim(),
            tipoProducto: data.tipoProducto || '',
            nombreProducto: data.nombreProducto || '',
            fechaSolicitud: formatDateForList(data.fechaSolicitud),
            montoSolicitado: montoSol,
            montoAutorizado: montoAut,
            sucursal: data.sucursal || '',
            faseDescripcion: data.descripcionFase || '',
            estatusSolicitud: data.estatusSolicitud || 'Pendiente',
          };
          setSolicitudes(prev => [nueva, ...prev]);
          toast.info('Guardado localmente (sin BD)', { duration: 3000 });
        } else if (isEdit && view.type === 'form' && view.solicitudId) {
          setSolicitudes(prev => prev.map(s =>
            s.id === view.solicitudId ? {
              ...s,
              noSol: data.noSol || s.noSol,
              nombreCompleto: `${data.nombrePersona || ''} ${data.apellidoPaternoPersona || ''} ${data.apellidoMaternoPersona || ''}`.trim() || s.nombreCompleto,
              tipoProducto: data.tipoProducto || s.tipoProducto,
              nombreProducto: data.nombreProducto || s.nombreProducto,
              fechaSolicitud: formatDateForList(data.fechaSolicitud) || s.fechaSolicitud,
              montoSolicitado: montoSol || s.montoSolicitado,
              montoAutorizado: montoAut || s.montoAutorizado,
              sucursal: data.sucursal || s.sucursal,
              faseDescripcion: data.descripcionFase || s.faseDescripcion,
              estatusSolicitud: data.estatusSolicitud || s.estatusSolicitud,
            } : s
          ));
          toast.info('Actualizado localmente (sin BD)', { duration: 3000 });
        }
      }
    } catch (err: any) {
      console.error('[SolicList] DB persist EXCEPTION:', err);
      toast.error('Error inesperado al guardar', { description: err?.message || String(err), duration: 5000 });
    }

    setView({ type: 'list' });
  };

  // ─── FORM VIEW ───
  if (view.type === 'form') {
    return <SolicitudCreditoForm key={`${view.mode}-${view.solicitudId ?? 'new'}`} mode={view.mode} solicitudId={view.solicitudId} onCancel={handleBack} onSave={handleSave} />;
  }

  // ─── LIST VIEW ───
  const filteredSolicitudes = solicitudes
    .filter(s => {
      const q = searchTerm.toLowerCase();
      return s.noSol.toLowerCase().includes(q) || s.nombreCompleto.toLowerCase().includes(q) ||
        s.sucursal.toLowerCase().includes(q) || s.nombreProducto.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dateA = parseDate(a.fechaSolicitud).getTime();
      const dateB = parseDate(b.fechaSolicitud).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const totalPages = Math.ceil(filteredSolicitudes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentSolicitudes = filteredSolicitudes.slice(startIndex, startIndex + itemsPerPage);

  const handlePreviousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const handleFirstPage = () => setCurrentPage(1);
  const handleLastPage = () => setCurrentPage(totalPages);
  const handleSearchChange = (v: string) => { setSearchTerm(v); setCurrentPage(1); };
  const handleSortChange = (v: 'desc' | 'asc') => { setSortOrder(v); setCurrentPage(1); };

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M6 2h8l4 4v11a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
              <path d="M14 2v4h4" /><path d="M6 10h8M6 13h5" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Solicitudes</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={handleListaClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Lista</span>
            <span onClick={handleBuscarClick} className="cursor-pointer hover:text-secondary-theme transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[280px]">
              <option>Vista general de Solicitudes</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z" /></svg>
          </div>
          <button onClick={handleNuevaSolicitud} className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">Nuevo</button>
          <button onClick={() => { dbMerged.current = false; refetch(); }} disabled={loadingDB} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
            {loadingDB ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="2"><circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="1.5"><path d="M1 7a6 6 0 0111.196-3M13 7a6 6 0 01-11.196 3" /><path d="M1 1v3h3M13 13v-3h-3" /></svg>
            )}
            Refrescar
          </button>
          <button onClick={() => setShowDiag(!showDiag)} className={`px-3 py-1.5 rounded text-xs border ${showDiag ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-400 text-gray-600 hover:bg-gray-50'}`}>
            DB
          </button>
        </div>
      </div>

      {/* DB Status Bar */}
      {showDiag && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                backendStatus === 'ready' ? 'bg-green-500' :
                backendStatus === 'empty' ? 'bg-yellow-500' :
                backendStatus === 'error' ? 'bg-red-500' :
                backendStatus === 'pending-deploy' ? 'bg-orange-500' :
                'bg-gray-400'
              }`} />
              <span className="text-gray-600">Estado:</span>
              <span className="font-medium text-gray-800">{backendStatus}</span>
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">Método: <span className="font-medium text-gray-800">{fetchMethod || '(pendiente)'}</span></span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">Tabla: <span className="font-mono text-gray-800">J_CUENTAS_CORP_CLIENTES</span></span>
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

      {/* Search */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Filtros</span>
          <input ref={searchBarRef} type="text" value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Buscar solicitudes..." className="px-3 py-1 border border-gray-400 rounded text-sm w-64 transition-all" />
        </div>
      </div>

      {/* Action icons */}
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
              <select value={sortOrder} onChange={(e) => handleSortChange(e.target.value as any)} className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            <span className="font-medium">Total: {filteredSolicitudes.length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">Editar | Ver</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">N° SOLICITUD</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">SOLICITANTE</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">TIPO PRODUCTO</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">PRODUCTO</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">FECHA</th>
                <th className="px-2 py-2.5 text-right font-medium text-xs text-gray-700">MONTO SOL.</th>
                <th className="px-2 py-2.5 text-right font-medium text-xs text-gray-700">MONTO AUT.</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">SUCURSAL</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">FASE</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">ESTATUS</th>
              </tr>
            </thead>
            <tbody>
              {currentSolicitudes.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-500">No se encontraron solicitudes</td></tr>
              ) : (
                currentSolicitudes.map((s, idx) => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-200 transition-colors duration-150"
                    style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                  >
                    <td className="px-2 py-2.5 text-xs whitespace-nowrap">
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); handleEditar(s); }}>Editar</a>
                      <span className="text-gray-500"> | </span>
                      <a href="#" className="text-[#0066CC] hover:underline" onClick={(e) => { e.preventDefault(); handleVer(s); }}>Ver</a>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[180px] truncate" title={s.noSol}>{s.noSol}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[160px] truncate" title={s.nombreCompleto}>{s.nombreCompleto}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700">{s.tipoProducto}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[140px] truncate" title={s.nombreProducto}>{s.nombreProducto}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700">{s.fechaSolicitud}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 text-right">{formatCurrency(s.montoSolicitado)}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700 text-right">{formatCurrency(s.montoAutorizado)}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-700">{s.sucursal}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-600 max-w-[120px] truncate" title={s.faseDescripcion}>{s.faseDescripcion}</td>
                    <td className="px-2 py-2.5 text-xs">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${
                        s.estatusSolicitud === 'Aprobado' ? 'text-green-700 bg-green-50 border-green-200' :
                        s.estatusSolicitud === 'Rechazado' ? 'text-red-700 bg-red-50 border-red-200' :
                        s.estatusSolicitud === 'En Análisis' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                        s.estatusSolicitud === 'Cancelado' ? 'text-gray-700 bg-gray-50 border-gray-200' :
                        'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>{s.estatusSolicitud}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={handleFirstPage} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={handlePreviousPage} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z" /></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {currentPage} de {totalPages || 1}</div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={handleNextPage} disabled={currentPage === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={handleLastPage} disabled={currentPage === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z" /></svg>
          </button>
        </div>
      </div>

      {/* Modal Generar Crédito */}
      {showGenerarModal && solicitudToGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-[#4A6FA5] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base text-white">Confirmar Generación de Crédito</h3>
              <button onClick={() => { setShowGenerarModal(false); setSolicitudToGenerate(null); }} className="text-white hover:text-gray-200">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded px-4 py-3">
                <p className="text-sm text-gray-800">Se generará un <strong>Crédito nuevo</strong> a partir de la solicitud seleccionada.</p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center gap-2"><span className="text-gray-500 w-28">N° Solicitud:</span><span className="text-gray-800 font-medium">{solicitudToGenerate.noSol}</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-500 w-28">Estatus:</span><span className="text-green-700 font-medium">{solicitudToGenerate.estatusSolicitud}</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-500 w-28">Solicitante:</span><span className="text-gray-800 font-medium">{solicitudToGenerate.nombreCompleto}</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-500 w-28">Sucursal:</span><span className="text-gray-800">{solicitudToGenerate.sucursal}</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-500 w-28">Monto Sol.:</span><span className="text-gray-800">{formatCurrency(solicitudToGenerate.montoSolicitado)}</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-500 w-28">Monto Aut.:</span><span className="text-gray-800 font-medium">{formatCurrency(solicitudToGenerate.montoAutorizado)}</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-500 w-28">Producto:</span><span className="text-gray-800">{solicitudToGenerate.nombreProducto}</span></div>
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button onClick={() => { setShowGenerarModal(false); setSolicitudToGenerate(null); }} className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">Cancelar</button>
              <button
                onClick={() => {
                  try {
                    const result = createCreditoFromSolicitud(solicitudToGenerate.id, {
                      id: solicitudToGenerate.id,
                      noSolicitud: solicitudToGenerate.noSol,
                      cliente: solicitudToGenerate.nombreCompleto,
                      fechaSolicitud: solicitudToGenerate.fechaSolicitud,
                      montoSolicitado: solicitudToGenerate.montoSolicitado,
                      montoAutorizado: solicitudToGenerate.montoAutorizado,
                      sublinea: solicitudToGenerate.tipoProducto,
                      producto: solicitudToGenerate.nombreProducto,
                      sucursal: solicitudToGenerate.sucursal,
                      estatusSolicitud: solicitudToGenerate.estatusSolicitud,
                    });
                    setGeneratedCreditos(prev => new Set(prev).add(solicitudToGenerate.id));
                    setShowGenerarModal(false);
                    setSolicitudToGenerate(null);
                    toast.success(`Crédito ${result.noCredito} generado exitosamente`, {
                      description: `Origen: ${solicitudToGenerate.noSol}. Navegue al módulo Créditos para consultarlo.`,
                      duration: 6000,
                    });
                  } catch (err) {
                    toast.error('Error al generar el crédito', { description: String(err), duration: 5000 });
                  }
                }}
                className="px-5 py-2 text-sm bg-[#0E7B1F] text-white rounded hover:bg-[#0A6118] flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 3L6 10 3 7" /></svg>
                Generar Crédito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}