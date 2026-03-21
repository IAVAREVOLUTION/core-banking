/**
 * SolicitudCreditoForm.tsx — Spec: financial-account-request-spec.md
 *
 * Header siempre visible + 7 acordeones:
 *  1. Términos y Condiciones
 *  2. Simulación
 *  3. Expediente Electrónico
 *  4. Garantías
 *  5. Comisiones
 *  6. Autorizaciones
 *  7. Notas
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import {
  SolicitudFormData, EMPTY_FORM, MOCK_FORMS,
  saveToSession, loadFromSession, loadFromSavedStore, saveToSavedStore, commitAndClearSession, clearSession,
  formatCurrency, parseCurrency, generateNoSol, consumeNoSol, getFechaSolicitudNow,
  CAT_LINEA_PRODUCTO, CAT_TIPO_PRODUCTO, CAT_TIPO_PERSONA, CAT_PRODUCTOS,
  CAT_FASES, CAT_SUCURSAL, CAT_ESTATUS_SOLICITUD,
} from './solicitudCreditoStore';
import { TerminosCondicionesTab } from './TerminosCondicionesTab';
import { SimulacionTab } from './SimulacionTab';
import { ExpedienteElectronicoTab } from './ExpedienteElectronicoTab';
import { GarantiasTab } from './GarantiasTab';
import { ComisionesTab } from './ComisionesTab';
import { AutorizacionTab } from './AutorizacionTab';
import { NotasTab } from './NotasTab';
import { FasesSolicitudTab } from './tabs/FasesSolicitudTab';
import { PartesRelacionadasTab } from './tabs/PartesRelacionadasTab';
import { useProductosCatalogoDB, type ProductoCatalogo } from '../../hooks/useProductosCatalogoDB';
import { fetchNextNoSol } from '../../hooks/useSolicitudesDB';
import { addOriginacionItem } from '../originacion/originacionStore';

type FormMode = 'nuevo' | 'editar' | 'ver';

interface SolicitudCreditoFormProps {
  mode: FormMode;
  solicitudId?: number | string;
  onCancel: () => void;
  onSave?: (data: any) => void;
  /** Datos pre-cargados desde cotización */
  cotizacionData?: Partial<SolicitudFormData>;
}

export function SolicitudCreditoForm({ mode, solicitudId, onCancel, onSave, cotizacionData }: SolicitudCreditoFormProps) {
  const storageId: number | string | 'new' = mode === 'nuevo' ? 'new' : (solicitudId ?? 1);
  const initialRender = useRef(true);
  /** Tracks the formData snapshot at mount time — used to detect user-driven changes */
  const loadedProductoId = useRef<string>('');
  const loadedTipoProducto = useRef<string>('');

  const getInitial = useCallback((): SolicitudFormData => {
    console.log('[SolicForm] getInitial → mode:', mode, '| solicitudId:', solicitudId, '| storageId:', storageId);
    const session = loadFromSession<SolicitudFormData>(storageId, 'form');
    console.log('[SolicForm] getInitial → loadFromSession result:', session ? `OK (noSol: ${session.noSol}, nombre: ${(session as any).nombrePersona}, tipoProducto: ${(session as any).tipoProducto}, productoId: ${(session as any).productoId})` : 'NULL');
    if (session) return { ...EMPTY_FORM, ...session };
    if (mode === 'nuevo') {
      const base = {
        ...EMPTY_FORM,
        noSol: generateNoSol(),
        fechaSolicitud: getFechaSolicitudNow(),
        ...(cotizacionData || {}),
      };
      return base;
    }
    const saved = loadFromSavedStore<SolicitudFormData>(storageId, 'form');
    if (saved) return { ...EMPTY_FORM, ...saved };
    const mock = MOCK_FORMS[solicitudId ?? 1];
    return mock ? { ...EMPTY_FORM, ...mock } : { ...EMPTY_FORM };
  }, [mode, solicitudId, storageId, cotizacionData]);

  const [formData, setFormData] = useState<SolicitudFormData>(() => {
    const initial = getInitial();
    // Snapshot loaded values so cascade resets can distinguish DB-loaded vs user-changed
    loadedProductoId.current = initial.productoId;
    loadedTipoProducto.current = initial.tipoProducto;
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<string>('fases');

  const isRO = mode === 'ver';

  // ── Safety re-init: if solicitudId changed but React reused the instance ──
  useEffect(() => {
    const fresh = getInitial();
    loadedProductoId.current = fresh.productoId;
    loadedTipoProducto.current = fresh.tipoProducto;
    setFormData(fresh);
    initialRender.current = true;
    console.log('[SolicForm] Safety re-init fired → solicitudId:', solicitudId, '| storageId:', storageId);
  }, [solicitudId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Productos DB: catálogo real de J_PRODUCTOS ──
  const { productos: productosDB, loading: loadingProductos } = useProductosCatalogoDB(true);

  // ── Tipos de producto filtrados por línea seleccionada ──
  const tiposProductoFiltrados = useMemo(() => {
    if (!formData.lineaProducto) return [];
    const fromDB = productosDB
      .filter(p => p.lineaProducto === formData.lineaProducto && p.sublineaProducto)
      .map(p => p.sublineaProducto);
    // Deduplicate, preserving DB values first; fallback to static catalog
    const unique = [...new Set(fromDB)];
    if (unique.length > 0) return unique.sort();
    // Fallback: static catalog (all types if no DB products for this line)
    return CAT_TIPO_PRODUCTO.map(c => c.value);
  }, [formData.lineaProducto, productosDB]);

  // ── Productos filtrados por línea seleccionada ──
  const productosFiltrados = useMemo(() => {
    if (!formData.lineaProducto) return productosDB;
    return productosDB.filter(p => p.lineaProducto === formData.lineaProducto);
  }, [formData.lineaProducto, productosDB]);

  // ── Auto-resolve tipoProducto from selected product when catalog loads ──
  useEffect(() => {
    if (!formData.productoId || productosDB.length === 0) return;
    const dbProd = productosDB.find(p => p.id === formData.productoId);
    if (dbProd?.sublineaProducto && dbProd.sublineaProducto !== formData.tipoProducto) {
      console.log('[SolicForm] Auto-resolve tipoProducto from product:', dbProd.sublineaProducto);
      setFormData(prev => ({ ...prev, tipoProducto: dbProd.sublineaProducto }));
    }
  }, [formData.productoId, productosDB]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cascade reset productoId: skip on initial render to preserve loaded data ──
  useEffect(() => {
    if (initialRender.current) return;
    if (isRO) return;
    // If productoId is the one we loaded from DB/session, don't clear it
    if (formData.productoId === loadedProductoId.current) return;
    if (formData.productoId && productosFiltrados.length > 0) {
      const stillValid = productosFiltrados.some(p => p.id === formData.productoId);
      if (!stillValid) {
        console.log('[SolicForm] CASCADE RESET productoId:', formData.productoId, '→ cleared (not in filtrados)');
        setFormData(prev => ({ ...prev, productoId: '', nombreProducto: '' }));
      }
    }
  }, [formData.tipoProducto, productosFiltrados]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark initial render complete ONLY after productosDB has finished loading
  useEffect(() => {
    if (!loadingProductos) {
      // Wait one animation frame so the render with loaded products has settled
      const raf = requestAnimationFrame(() => {
        initialRender.current = false;
        console.log('[SolicForm] initialRender → false (productos loaded, settling complete)');
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [loadingProductos]);

  const set = (field: keyof SolicitudFormData, value: string) => {
    if (isRO) return;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleEnviarSolicitud = useCallback(() => {
    setFormData(prev => ({ ...prev, estatusSolicitud: 'En proceso' }));
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    addOriginacionItem({
      noSolicitud: formData.noSol || `SC-${storageId}`,
      noCliente: '',
      cliente: `${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''} ${formData.apellidoMaternoPersona || ''}`.trim() || 'Sin nombre',
      fechaSolicitud: `${dd}/${mm}/${yy}`,
      montoSolicitado: parseFloat(parseCurrency(formData.montoSolicitado || '0')) || 0,
      montoAutorizado: 0,
      sublinea: formData.lineaProducto || '',
      producto: formData.tipoProducto || '',
      sucursal: formData.sucursal || '',
      estatus: 'En Proceso',
      subEstatus: 'Integración del Expediente',
      responsable: '',
    });
    toast.success('Solicitud enviada', { description: 'Estatus actualizado a "En proceso". La solicitud aparece en Originación.' });
  }, [formData, storageId]);

  const handleNumeric = (field: keyof SolicitudFormData, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    // Limit to 2 decimals
    if (parts.length === 2 && parts[1].length > 2) return;
    set(field, formatted);
  };

  const handleCurrencyBlur = (field: keyof SolicitudFormData) => {
    const raw = parseCurrency(formData[field] as string);
    const num = parseFloat(raw);
    if (!isNaN(num) && num >= 0) set(field, num.toFixed(2));
  };

  // ── Producto seleccionado (rawData para auto-llenar Términos y Condiciones) ──
  const productoSeleccionado = useMemo(() => {
    if (!formData.productoId) return undefined;
    return productosDB.find(p => p.id === formData.productoId);
  }, [formData.productoId, productosDB]);

  // ── Fases del producto seleccionado (fallback a catálogo estático) ──
  const fasesDelProducto = useMemo(() => {
    const rd = productoSeleccionado?.rawData;
    // Buscar fases en múltiples keys posibles
    const raw = rd?.fases ?? rd?.fasesRegistros ?? rd?.fase;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((f: any) => ({
        faseId: String(f.phaseId ?? f.faseId ?? f.id ?? ''),
        descripcion: f.phaseName ?? f.descripcion ?? f.nombre ?? '',
        promptIA: f.promptIA || '',
      }));
    }
    return CAT_FASES;
  }, [productoSeleccionado]);

  // When producto changes, fill nombreProducto (busca en DB primero, fallback catálogo estático)
  const handleProductoChange = (productoId: string) => {
    const dbProd = productosDB.find(p => p.id === productoId);
    const staticProd = CAT_PRODUCTOS.find(p => p.value === productoId);
    setFormData(prev => ({
      ...prev,
      productoId,
      nombreProducto: dbProd?.nombreProducto || staticProd?.nombre || '',
      tipoProducto: dbProd?.sublineaProducto || prev.tipoProducto || '',
    }));
  };

  // When fase changes, fill descripcionFase and promptIA
  const handleFaseChange = (faseId: string) => {
    const fase = fasesDelProducto.find(f => f.faseId === faseId);
    setFormData(prev => ({
      ...prev,
      faseId,
      descripcionFase: fase?.descripcion || '',
    }));
  };

  // Get promptIA for current phase
  const fasePromptIA = useMemo(() => {
    const fase = fasesDelProducto.find(f => f.faseId === formData.faseId);
    return fase?.promptIA || '';
  }, [fasesDelProducto, formData.faseId]);

  // Validation
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.lineaProducto) e.lineaProducto = 'Obligatorio';
    if (!formData.tipoProducto) e.tipoProducto = 'Obligatorio';
    if (!formData.tipoPersona) e.tipoPersona = 'Obligatorio';
    if (!formData.nombrePersona) e.nombrePersona = 'Obligatorio';
    if (!formData.apellidoPaternoPersona) e.apellidoPaternoPersona = 'Obligatorio';
    if (!formData.productoId) e.productoId = 'Obligatorio';
    if (!formData.sucursal) e.sucursal = 'Obligatorio';
    const ms = parseFloat(parseCurrency(formData.montoSolicitado || '0'));
    if (!formData.montoSolicitado || isNaN(ms) || ms <= 0) e.montoSolicitado = 'Monto > 0';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error('Campos obligatorios incompletos', { description: `${Object.keys(e).length} campo(s) requieren corrección`, duration: 4000 });
      return false;
    }
    return true;
  };

  const [savingNoSol, setSavingNoSol] = useState(false);
  const [savingToDB, setSavingToDB] = useState(false);

  const handleSave = async () => {
    if (!validate()) return;
    const d = { ...formData };

    // Para solicitudes nuevas: obtener el NO_SOL atómico del backend (consulta BD)
    if (mode === 'nuevo') {
      setSavingNoSol(true);
      try {
        const nextNoSol = await fetchNextNoSol();
        d.noSol = nextNoSol;
        console.log('[SolicForm] handleSave → NO_SOL from backend:', nextNoSol);
      } catch (err) {
        console.warn('[SolicForm] handleSave → fetchNextNoSol falló, usando consumeNoSol:', err);
        d.noSol = consumeNoSol();
      } finally {
        setSavingNoSol(false);
      }
    }

    // ── Recopilar datos de TODAS las subtabs ANTES de commitAndClearSession ──
    const allSubtabs: Record<string, any> = {};
    const subtabKeys = ['terminos', 'simulacion', 'documentos', 'garantias', 'comisiones', 'autorizaciones', 'notas'];
    for (const key of subtabKeys) {
      const data = loadFromSession(storageId, key);
      if (data) allSubtabs[key] = data;
    }

    console.log('[SolicForm] handleSave → formData fields:',
      Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${k}=${String(v).substring(0, 30)}`).join(' | '));
    console.log('[SolicForm] handleSave → subtabs collected:', Object.keys(allSubtabs).join(', ') || '(none)');
    if (allSubtabs.comisiones) {
      console.log('[SolicForm] handleSave → comisiones count:', Array.isArray(allSubtabs.comisiones) ? allSubtabs.comisiones.length : 'NOT-ARRAY', '| data:', JSON.stringify(allSubtabs.comisiones).substring(0, 300));
    } else {
      console.log('[SolicForm] handleSave → SIN comisiones en session para storageId:', storageId);
    }

    // ── Guardar en BD (await — blocking) ──
    setSavingToDB(true);
    try {
      await onSave?.({ ...d, _allSubtabs: allSubtabs });
      // Solo limpiar session DESPUÉS de que la BD confirmó
      saveToSavedStore(storageId, 'form', d);
      commitAndClearSession(storageId);
      saveToSavedStore(storageId, 'form', d);
    } catch (err) {
      console.error('[SolicForm] handleSave → onSave error:', err);
    } finally {
      setSavingToDB(false);
    }
  };

  const handleCancel = () => {
    clearSession(storageId);
    onCancel();
  };

  // Input helpers
  const ic = (hasError = false, disabled = false) => {
    const base = 'w-full px-2 py-1.5 text-xs border rounded focus:outline-none';
    const bdr = hasError ? 'border-red-400' : 'border-gray-300';
    const focus = !disabled && !isRO ? 'focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5]' : '';
    const bg = disabled || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800';
    return `${base} ${bdr} ${focus} ${bg}`;
  };

  const sc = (hasError = false) => {
    const base = 'w-full px-2 py-1.5 text-xs border rounded focus:outline-none';
    const bdr = hasError ? 'border-red-400' : 'border-gray-300';
    const focus = !isRO ? 'focus:ring-2 focus:ring-[#4A6FA5]' : '';
    const bg = isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800';
    return `${base} ${bdr} ${focus} ${bg}`;
  };

  const Lbl = ({ children, req, error }: { children: string; req?: boolean; error?: string }) => (
    <label className={`block text-xs mb-1 ${error ? 'text-red-600' : 'text-gray-700'}`}>
      {children}{req && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  );

  const sections = [
    { id: 'fases', label: 'Fases' },
    { id: 'partesRelacionadas', label: 'Partes Relacionadas' },
    { id: 'terminos', label: 'Términos y Condiciones' },
    { id: 'simulacion', label: 'Simulación' },
    { id: 'expediente', label: 'Expediente Electrónico' },
    { id: 'garantias', label: 'Garantías' },
    { id: 'comisiones', label: 'Comisiones' },
    { id: 'autorizaciones', label: 'Autorizaciones' },
    { id: 'notas', label: 'Notas' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white overflow-auto">
      {/* ═══ HEADER BAR ═══ */}
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
              <path d="M5 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" />
              <path d="M12 1v3h3" /><path d="M5 9h7M5 12h4" />
            </svg>
            <span className="text-sm text-gray-700">
              {mode === 'nuevo' ? 'Alta de Solicitud'
                : mode === 'editar' ? `Edición Solicitud — ${formData.noSol}`
                : `Detalle Solicitud — ${formData.noSol}`}
            </span>
          </div>
          <button onClick={handleCancel} className="text-secondary-theme text-sm hover:underline">Lista</button>
        </div>
      </div>

      {/* ═══ ACTION BAR ═══ */}
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {!isRO && (
            <>
              <button onClick={handleSave} disabled={savingToDB || savingNoSol} className="px-5 py-1.5 btn-secondary-theme rounded text-sm disabled:opacity-60 flex items-center gap-2">
                {(savingToDB || savingNoSol) && (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10" />
                  </svg>
                )}
                {savingNoSol ? 'Generando N° Sol...' : savingToDB ? 'Guardando en BD...' : 'Guardar'}
              </button>
              <button onClick={handleCancel} disabled={savingToDB} className="px-5 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
            </>
          )}
          {isRO && <button onClick={handleCancel} className="px-5 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">Cerrar</button>}
        </div>
      </div>

      <div className="px-6 py-6">
        {/* ═══ DIAGNÓSTICO TEMPORAL — eliminar después de verificar ═══ */}
        <details className="mb-4 border border-orange-300 rounded bg-orange-50 text-xs">
          <summary className="px-3 py-1.5 cursor-pointer text-orange-800 font-medium">
            🔍 Debug formData  {Object.values(formData).filter(v => v && v !== '' && v !== '0.00').length}/{Object.keys(formData).length} campos con datos | storageId={String(storageId)} | mode={mode}
          </summary>
          <div className="px-3 py-2 space-y-1 text-[10px] font-mono text-gray-700 max-h-48 overflow-auto">
            {Object.entries(formData).map(([k, v]) => (
              <div key={k} className={`flex gap-2 ${!v || v === '' || v === '0.00' ? 'text-red-500' : 'text-green-700'}`}>
                <span className="w-44 shrink-0 font-semibold">{k}:</span>
                <span className="truncate">{String(v) || '(vacío)'}</span>
              </div>
            ))}
          </div>
        </details>

        {/* ═══════════════════════════════════════════════════════════════
            HEADER — Siempre visible (Spec §3)
            ══════════════════════════════════════════════════════════════ */}

        {/* Banner origen cotización — spec §4 */}
        {formData.cotizacionId && (
          <div className="bg-green-50 border border-green-200 rounded px-4 py-2.5 mb-4 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#0E7B1F" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z" />
              <path d="M4 6H2a2 2 0 00-2 2v4a2 2 0 002 2h2" /><path d="M8 7l2 2 3-3" />
            </svg>
            <span className="text-xs text-green-800">
              <strong>Solicitud generada desde Cotización</strong> — N° {formData.cotizacionId}
              {' '}| Los datos del header y términos fueron pre-llenados automáticamente.
            </span>
          </div>
        )}

        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-4 py-2 mb-5">
          <h3 className="text-sm text-gray-800 uppercase">Información de la Solicitud</h3>
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-8">
          {/* ── Col 1 ── */}
          <div className="space-y-3">
            <div>
              <Lbl>ID</Lbl>
              <input type="text" value={formData.id || 'Automático'} disabled className={ic(false, true)} />
            </div>
            <div>
              <Lbl>N° Solicitud</Lbl>
              <input type="text" value={formData.noSol || 'Automático'} disabled className={ic(false, true)} />
            </div>
            <div>
              <Lbl>Cotización ID</Lbl>
              <input type="text" value={formData.cotizacionId || '(creación directa)'} disabled className={ic(false, true)} />
            </div>
            <div>
              <Lbl req error={errors.lineaProducto}>Línea de Producto</Lbl>
              <select value={formData.lineaProducto} onChange={e => set('lineaProducto', e.target.value)} disabled={isRO} className={sc(!!errors.lineaProducto)}>
                {CAT_LINEA_PRODUCTO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {errors.lineaProducto && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.lineaProducto}</span>}
            </div>
            <div>
              <Lbl req error={errors.tipoProducto}>Tipo de Producto</Lbl>
              <input
                type="text"
                value={formData.tipoProducto}
                disabled
                placeholder="(se llena al seleccionar producto)"
                className={ic(!!errors.tipoProducto, true)}
              />
              {errors.tipoProducto && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.tipoProducto}</span>}
            </div>
            <div>
              <Lbl req error={errors.sucursal}>Sucursal</Lbl>
              <select value={formData.sucursal} onChange={e => set('sucursal', e.target.value)} disabled={isRO} className={sc(!!errors.sucursal)}>
                <option value="">Seleccionar...</option>
                {CAT_SUCURSAL.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {errors.sucursal && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.sucursal}</span>}
            </div>
          </div>

          {/* ── Col 2 ── */}
          <div className="space-y-3">
            <div>
              <Lbl req error={errors.tipoPersona}>Tipo de Persona</Lbl>
              <select value={formData.tipoPersona} onChange={e => set('tipoPersona', e.target.value)} disabled={isRO} className={sc(!!errors.tipoPersona)}>
                <option value="">Seleccionar...</option>
                {CAT_TIPO_PERSONA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {errors.tipoPersona && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.tipoPersona}</span>}
            </div>
            <div>
              <Lbl req error={errors.nombrePersona}>Nombre(s)</Lbl>
              <input type="text" value={formData.nombrePersona} onChange={e => set('nombrePersona', e.target.value)} disabled={isRO} placeholder="Nombre(s)" className={ic(!!errors.nombrePersona)} />
              {errors.nombrePersona && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.nombrePersona}</span>}
            </div>
            <div>
              <Lbl req error={errors.apellidoPaternoPersona}>Apellido Paterno</Lbl>
              <input type="text" value={formData.apellidoPaternoPersona} onChange={e => set('apellidoPaternoPersona', e.target.value)} disabled={isRO} placeholder="Apellido Paterno" className={ic(!!errors.apellidoPaternoPersona)} />
              {errors.apellidoPaternoPersona && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.apellidoPaternoPersona}</span>}
            </div>
            <div>
              <Lbl>Apellido Materno</Lbl>
              <input type="text" value={formData.apellidoMaternoPersona} onChange={e => set('apellidoMaternoPersona', e.target.value)} disabled={isRO} placeholder="Apellido Materno" className={ic()} />
            </div>
            <div>
              <Lbl req error={errors.productoId}>Producto</Lbl>
              <select value={formData.productoId} onChange={e => handleProductoChange(e.target.value)} disabled={isRO} className={sc(!!errors.productoId)}>
                <option value="">{ loadingProductos ? 'Cargando productos...' : 'Seleccionar...' }</option>
                {/* Fallback: si el productoId actual no está en productosFiltrados, mostrarlo como opción para no perder la selección */}
                {formData.productoId && !productosFiltrados.some(p => p.id === formData.productoId) && (
                  <option key={formData.productoId} value={formData.productoId}>
                    {formData.nombreProducto || formData.productoId}
                  </option>
                )}
                {productosFiltrados.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.claveProducto ? `${p.claveProducto} — ${p.nombreProducto}` : p.nombreProducto}
                  </option>
                ))}
              </select>
              {errors.productoId && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.productoId}</span>}
              {/* ═══ DIAGNÓSTICO: conteo de productos ═══ */}
              <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800 space-y-0.5">
                <div className="font-semibold">Diag Productos:</div>
                <div>DB total: <b>{productosDB.length}</b> | Filtrados: <b>{productosFiltrados.length}</b> | Loading: {loadingProductos ? 'Sí' : 'No'}</div>
                <div>Filtro línea: <b>"{formData.lineaProducto || '(ninguna)'}"</b> | Filtro tipo: <b>"{formData.tipoProducto || '(ninguno)'}"</b></div>
                {productosDB.length > 0 && (
                  <details className="cursor-pointer">
                    <summary className="text-amber-700 hover:underline">Ver {productosDB.length} productos de DB</summary>
                    <div className="mt-1 max-h-32 overflow-auto bg-white/70 rounded p-1 text-[9px] font-mono">
                      {productosDB.map((p, i) => (
                        <div key={p.id ?? `prod-${i}`} className={i % 2 === 0 ? 'bg-amber-50/50' : ''}>
                          {i+1}. [{p.type ?? '?'}] linea="{p.lineaProducto ?? ''}" tipo="{p.tipoProducto ?? ''}" → <b>{p.nombreProducto ?? '(sin nombre)'}</b> (id: {(p.id ?? '').slice(0,8)}...)
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {(() => {
                  try {
                    console.log(`[DIAG Producto] DB total=${productosDB.length} | filtrados=${productosFiltrados.length} | línea="${formData.lineaProducto}" | tipo="${formData.tipoProducto}"`);
                    if (productosDB.length > 0) console.log('[DIAG Producto] Todos los productos DB:', productosDB.map(p => ({ id: (p.id ?? '').slice(0,8), nombre: p.nombreProducto, linea: p.lineaProducto, tipo: p.tipoProducto, type: p.type, source: p.source })));
                  } catch (e) { console.warn('[DIAG Producto] error logging:', e); }
                  return null;
                })()}
              </div>
            </div>
            <div>
              <Lbl>Nombre Producto</Lbl>
              <input type="text" value={formData.nombreProducto} disabled className={ic(false, true)} />
            </div>
          </div>

          {/* ── Col 3 ── */}
          <div className="space-y-3">
            <div>
              <Lbl>Fecha Solicitud</Lbl>
              <input type="text" value={formData.fechaSolicitud} disabled className={ic(false, true)} />
            </div>
            <div>
              <Lbl>Estatus Solicitud</Lbl>
              <select value={formData.estatusSolicitud} onChange={e => set('estatusSolicitud', e.target.value)} disabled={isRO} className={sc()}>
                {CAT_ESTATUS_SOLICITUD.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Lbl req error={errors.montoSolicitado}>Monto Solicitado</Lbl>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  type="text" inputMode="decimal"
                  value={formData.montoSolicitado}
                  onChange={e => handleNumeric('montoSolicitado', e.target.value)}
                  onBlur={() => handleCurrencyBlur('montoSolicitado')}
                  disabled={isRO} placeholder="0.00"
                  className={`${ic(!!errors.montoSolicitado)} pl-5`}
                />
              </div>
              {errors.montoSolicitado && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.montoSolicitado}</span>}
            </div>
            <div>
              <Lbl>Monto Autorizado</Lbl>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  type="text" inputMode="decimal"
                  value={formData.montoAutorizado}
                  onChange={e => handleNumeric('montoAutorizado', e.target.value)}
                  onBlur={() => handleCurrencyBlur('montoAutorizado')}
                  disabled={isRO} placeholder="0.00"
                  className={`${ic()} pl-5`}
                />
              </div>
            </div>
            <div>
              <Lbl>Fase</Lbl>
              <select value={formData.faseId} onChange={e => handleFaseChange(e.target.value)} disabled={isRO || !formData.productoId} className={sc()}>
                {!formData.productoId ? (
                  <option value="">— Seleccione un producto primero —</option>
                ) : (
                  fasesDelProducto.map(f => <option key={f.faseId} value={f.faseId}>{f.descripcion}</option>)
                )}
              </select>
            </div>
            <div>
              <Lbl>Descripción Fase</Lbl>
              <input type="text" value={formData.descripcionFase} disabled className={ic(false, true)} />
            </div>
          </div>
        </div>

        {/* Descripción (textarea 1024) */}
        <div className="mb-8">
          <Lbl>Descripción</Lbl>
          <textarea
            value={formData.descripcion}
            onChange={e => { if (e.target.value.length <= 1024) set('descripcion', e.target.value); }}
            disabled={isRO}
            rows={3}
            placeholder="Descripción de la solicitud (máximo 1024 caracteres)..."
            className={`w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none resize-none ${
              isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800 focus:ring-2 focus:ring-[#4A6FA5]'
            }`}
          />
          <div className="text-right text-[10px] text-gray-400 mt-0.5">{(formData.descripcion || '').length}/1024</div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            ACORDEONES (Spec §4–§10)
            ═══════════════════════════════════════════════════════════════ */}
        {sections.map(sec => (
          <div key={sec.id} className="mb-2">
            <button
              onClick={() => setActiveSection(prev => prev === sec.id ? '' : sec.id)}
              className="w-full bg-primary-theme text-white px-3 py-2 text-sm flex items-center justify-between transition-colors hover:bg-[var(--theme-primary-hover)]"
            >
              <div className="flex items-center gap-2">
                <input type="checkbox" className="w-3.5 h-3.5 pointer-events-none" checked={activeSection === sec.id} readOnly />
                <span>{sec.label}</span>
              </div>
              <svg className={`transition-transform ${activeSection === sec.id ? 'rotate-180' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="white">
                <path d="M8 10l-4-4h8z" />
              </svg>
            </button>

            {activeSection === sec.id && (
              <>
                {sec.id === 'fases' && (
                  <FasesSolicitudTab 
                    mode={mode}
                    productoId={formData.productoId}
                    faseIdActual={formData.faseId}
                  />
                )}
                {sec.id === 'partesRelacionadas' && (
                  <PartesRelacionadasTab
                    mode={mode}
                    solicitudId={storageId}
                    montoSolicitado={formData.montoSolicitado}
                    clienteNombre={`${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''} ${formData.apellidoMaternoPersona || ''}`.trim()}
                  />
                )}
                {sec.id === 'terminos' && (
                  <TerminosCondicionesTab mode={mode} solicitudId={storageId} lineaProducto={formData.lineaProducto} productoSeleccionado={productoSeleccionado} montoSolicitadoHeader={formData.montoSolicitado} />
                )}
                {sec.id === 'simulacion' && (
                  <SimulacionTab mode={mode} solicitudId={storageId} lineaProducto={formData.lineaProducto} />
                )}
                {sec.id === 'expediente' && (
                  <ExpedienteElectronicoTab
                    mode={mode}
                    solicitudId={storageId}
                    faseIdActual={parseInt(formData.faseId) || 1}
                    productoId={formData.productoId}
                    nombreSolicitante={`${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''} ${formData.apellidoMaternoPersona || ''}`.trim()}
                    fasePromptIA={fasePromptIA}
                    onEnviarSolicitud={handleEnviarSolicitud}
                  />
                )}
                {sec.id === 'garantias' && (
                  <GarantiasTab mode={mode} solicitudId={storageId} montoSolicitado={formData.montoSolicitado} productoId={formData.productoId} faseIdActual={parseInt(formData.faseId) || 1} />
                )}
                {sec.id === 'comisiones' && (
                  <ComisionesTab mode={mode} solicitudId={storageId} montoSolicitado={formData.montoSolicitado} productoId={formData.productoId} />
                )}
                {sec.id === 'autorizaciones' && (
                  <AutorizacionTab mode={mode} solicitudId={storageId} montoSolicitado={formData.montoSolicitado} productoId={formData.productoId} />
                )}
                {sec.id === 'notas' && (
                  <NotasTab mode={mode} solicitudId={storageId} />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}