/**
 * CuentasAhorroForm.tsx — v4.0 (SPEC ahorro-cuentas-logic.md + ahorro-editar-guardar.md)
 *
 * ═══════════════════════════════════════════════════════════════════
 * Formulario institucional de Cuentas de Ahorro
 * Tabla destino: EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES"
 *
 * Modo Nuevo  → INSERT via RPC insert_cuenta_ahorro
 * Modo Editar → GET BY ID via RPC get_cuenta_ahorro_by_id
 *               UPDATE via RPC update_cuenta_ahorro (JSON MERGE)
 * Modo Ver    → GET BY ID (solo lectura)
 *
 * REGLAS INSTITUCIONALES:
 *   - No eliminar campos del JSON
 *   - No reconstruir JSON desde cero en edición (MERGE parcial)
 *   - No modificar id, linea_produc, tipo_produc
 *   - Respetar llaves foráneas (cliente_id, producto_id)
 * ═══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { BeneficiariosTab } from './BeneficiariosTab';
import { CoTitularesTab } from './CoTitularesTab';
import { InteresesDiariosTab } from './InteresesDiariosTab';
import { RendimientoPeriodoTab } from './RendimientoPeriodoTab';
import { ImpuestosTab } from './ImpuestosTab';
import { MovimientosTab } from './MovimientosTab';
import { CargosTab } from './CargosTab';
import { BloqueosTab } from './BloqueosTab';
import { SolicitudExtraordinariaTab } from './SolicitudExtraordinariaTab';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { ClientePickerModal } from './ClientePickerModal';
import type { ClientePickResult } from './ClientePickerModal';
import { ProductoPickerModal } from './ProductoPickerModal';
import type { ProductoPickResult } from './ProductoPickerModal';
import { useCuentasAhorroDB, getCuentaAhorroById } from '@/app/hooks/useCuentasAhorroDB';
import type { InsertCuentaAhorroPayload, UpdateCuentaAhorroPayload, JCuentaAhorroRow } from '@/app/hooks/useCuentasAhorroDB';
import { fromISODate, toISODate } from './cuentasAhorroStore';

// ═══════════════════════════════════════════════════════════════════
// HELPER: Parsear valores MONEY de PostgreSQL
// PostgreSQL MONEY devuelve strings como "$1,400.00" o "($.50)"
// ══════════════════════════════════════════════════════════════════
function parseMoney(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

function formatMoneyStr(val: unknown): string {
  const num = parseMoney(val);
  if (num === null) return '';
  return num.toFixed(2);
}

// ═══════════════════════════════════════════════════════════════════
// FORM STATE — alineado a columnas de J_CUENTAS_CORP_CLIENTES
// ═══════════════════════════════════════════════════════════════════
interface CuentaAhorroDBForm {
  // PK
  id: string;
  // Type y línea/tipo producto (leídos de la fila real)
  type: string;
  linea_produc: string;
  tipo_produc: string;
  // Campos principales (spec sección 3)
  no_sol: string;
  no_cuenta: string;
  no_referenc1: string;
  fecha_sol: string;          // yyyy-MM-dd
  descripcion: string;
  cta_eje_chec: boolean;
  fases: string;
  // Pick Map: Cliente
  cliente_id: string;
  clienteClaveDisplay: string;
  clienteNombreDisplay: string;
  // Pick Map: Producto
  producto_id: string;
  producto_eje: string;
  productoClaveDisplay: string;
  productoNombreDisplay: string;
  productoTasa: number;
  productoMontoMinimo: number;
  // Campos monetarios (spec sección 4)
  saldo_actual: string;
  monto_sol: string;
  monto_aut: string;
  monto_disp: string;
  // Estatus (editables en modo edición)
  estatus_sol: string;
  estatus_disp: string;
  estatus_cart: string;
  estatus_cuen: string;
  // Fechas operativas (spec sección 5)
  fecha_autori: string;
  fecha_disper: string;
  fecha_cancel: string;
  fecha_inicio: string;
  fecha_fin_cu: string;
}

const EMPTY_DB_FORM: CuentaAhorroDBForm = {
  id: '',
  type: 'CAPTACION',
  linea_produc: 'CAPTACION',
  tipo_produc: 'Ahorro',
  no_sol: '',
  no_cuenta: '',
  no_referenc1: '',
  fecha_sol: new Date().toISOString().split('T')[0],
  descripcion: '',
  cta_eje_chec: false,
  fases: '',
  cliente_id: '',
  clienteClaveDisplay: '',
  clienteNombreDisplay: '',
  producto_id: '',
  producto_eje: '',
  productoClaveDisplay: '',
  productoNombreDisplay: '',
  productoTasa: 0,
  productoMontoMinimo: 0,
  saldo_actual: '0.00',
  monto_sol: '',
  monto_aut: '',
  monto_disp: '',
  estatus_sol: 'Pendiente',
  estatus_disp: 'Pendiente',
  estatus_cart: 'Activa',
  estatus_cuen: 'Activa',
  fecha_autori: '',
  fecha_disper: '',
  fecha_cancel: '',
  fecha_inicio: '',
  fecha_fin_cu: '',
};

// ── Helper: extraer fecha ISO de un posible timestamp ──
function extractDate(val: string | null): string {
  if (!val) return '';
  return val.split('T')[0];
}

// ── Helper: validar UUID ──
function isValidUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ── Helper: autogenerar No. Solicitud ──
function generateNoSol(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000); // 4 dígitos
  return `SOL-AH-${y}${m}${d}-${seq}`;
}

// ── Helper: autogenerar No. Cuenta ──
function generateNoCuenta(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  // 10 dígitos: prefijo 01 (ahorro) + AAMM + 6 dígitos random
  const rand = String(Math.floor(Math.random() * 900000) + 100000);
  return `01${y}${m}${rand}`;
}

// ── Helper: mapear JCuentaAhorroRow → CuentaAhorroDBForm ──
function rowToForm(row: JCuentaAhorroRow): CuentaAhorroDBForm {
  // data puede venir como string JSON desde Edge Function (postgres.js) o como objeto
  let d: Record<string, any> = {};
  if (row.data) {
    if (typeof row.data === 'string') {
      try { d = JSON.parse(row.data); } catch { d = {}; }
    } else {
      d = row.data as Record<string, any>;
    }
  }

  console.log('[CuentasAhorroForm] rowToForm — id:', row.id, 'data keys:', Object.keys(d), 'data.cliente:', d.cliente, 'data.producto:', d.producto);

  return {
    id: row.id,
    type: row.type || 'CAPTACION',
    linea_produc: row.linea_produc || 'CAPTACION',
    tipo_produc: row.tipo_produc || 'Ahorro',
    no_sol: row.no_sol || '',
    no_cuenta: row.no_cuenta || '',
    no_referenc1: row.no_referenc1 || '',
    fecha_sol: extractDate(row.fecha_sol),
    descripcion: row.descripcion || '',
    cta_eje_chec: row.cta_eje_chec === true || row.cta_eje_chec === 'true' || row.cta_eje_chec === '1' || row.cta_eje_chec === 't',
    fases: row.fases || '',
    cliente_id: row.cliente_id || '',
    clienteClaveDisplay: d.cliente?.claveCliente || row.cliente_id?.slice(0, 8) || '',
    clienteNombreDisplay: d.cliente?.nombreCompleto || (row as any).cliente_nombre || '',
    producto_id: row.producto_id || '',
    producto_eje: row.producto_eje || '',
    productoClaveDisplay: d.producto?.claveProducto || '',
    productoNombreDisplay: d.producto?.nombreProducto || (row as any).producto_nombre || row.producto_eje || '',
    productoTasa: d.producto?.tasa || 0,
    productoMontoMinimo: d.producto?.montoMinimo || 0,
    saldo_actual: formatMoneyStr(row.saldo_actual) || '0.00',
    monto_sol: formatMoneyStr(row.monto_sol),
    monto_aut: formatMoneyStr(row.monto_aut),
    monto_disp: formatMoneyStr(row.monto_disp),
    estatus_sol: row.estatus_sol || 'Pendiente',
    estatus_disp: row.estatus_disp || 'Pendiente',
    estatus_cart: row.estatus_cart || 'Activa',
    estatus_cuen: row.estatus_cuen || 'Activa',
    fecha_autori: extractDate(row.fecha_autori),
    fecha_disper: extractDate(row.fecha_disper),
    fecha_cancel: extractDate(row.fecha_cancel),
    fecha_inicio: extractDate(row.fecha_inicio),
    fecha_fin_cu: extractDate(row.fecha_fin_cu),
  };
}

type FormMode = 'nuevo' | 'editar' | 'ver';

interface CuentasAhorroFormProps {
  mode: FormMode;
  accountId?: number | string;
  onCancel: () => void;
  onSave?: (data: any) => void;
}

export function CuentasAhorroForm({ mode, accountId, onCancel, onSave }: CuentasAhorroFormProps) {
  const [activeTab, setActiveTab] = useState<string>('default');
  const { insertCuenta, updateCuenta, backendStatus } = useCuentasAhorroDB();
  const [saving, setSaving] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(mode !== 'nuevo');

  // ── Form state ──
  const [dbForm, setDbForm] = useState<CuentaAhorroDBForm>({ ...EMPTY_DB_FORM });
  const [originalRow, setOriginalRow] = useState<JCuentaAhorroRow | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clienteModalOpen, setClienteModalOpen] = useState(false);
  const [productoModalOpen, setProductoModalOpen] = useState(false);

  const isRO = mode === 'ver';
  const isNew = mode === 'nuevo';
  const isEdit = mode === 'editar';
  const storageId: number | 'new' = mode === 'nuevo' ? 'new' : (typeof accountId === 'number' ? accountId : 1);

  // ── Autogenerar no_sol y no_cuenta en modo nuevo ──
  useEffect(() => {
    if (isNew) {
      setDbForm(prev => ({
        ...prev,
        no_sol: prev.no_sol || generateNoSol(),
        no_cuenta: prev.no_cuenta || generateNoCuenta(),
        no_referenc1: prev.no_referenc1 || `REF-${Date.now().toString(36).toUpperCase()}`,
      }));
    }
  }, [isNew]);

  // ── Cargar registro existente (Edit / Ver) ──
  useEffect(() => {
    if (isNew || !accountId) return;

    const loadRecord = async () => {
      setLoadingRecord(true);
      const uuid = String(accountId);

      try {
        const result = await getCuentaAhorroById(uuid);

        if (result.ok && result.row) {
          const row = result.row;
          setOriginalRow(row);
          try {
            setDbForm(rowToForm(row));
            console.log('[CuentasAhorroForm] Registro cargado correctamente:', uuid);
          } catch (mapErr: any) {
            // rowToForm falló — mapear manualmente con protección
            console.error('[CuentasAhorroForm] Error en rowToForm, usando mapeo defensivo:', mapErr?.message || mapErr);
            const d = (row.data || {}) as Record<string, any>;
            setDbForm({
              ...EMPTY_DB_FORM,
              id: row.id,
              type: row.type || 'CAPTACION',
              linea_produc: row.linea_produc || 'CAPTACION',
              tipo_produc: row.tipo_produc || 'Ahorro',
              no_sol: row.no_sol || '',
              no_cuenta: row.no_cuenta || '',
              no_referenc1: row.no_referenc1 || '',
              fecha_sol: extractDate(row.fecha_sol),
              descripcion: row.descripcion || '',
              cta_eje_chec: row.cta_eje_chec === true || row.cta_eje_chec === 'true' || row.cta_eje_chec === 't',
              fases: row.fases || '',
              cliente_id: row.cliente_id || '',
              clienteClaveDisplay: d?.cliente?.claveCliente || row.cliente_id?.slice(0, 8) || '',
              clienteNombreDisplay: d?.cliente?.nombreCompleto || (row as any).cliente_nombre || '',
              producto_id: row.producto_id || '',
              producto_eje: row.producto_eje || '',
              productoClaveDisplay: d?.producto?.claveProducto || '',
              productoNombreDisplay: d?.producto?.nombreProducto || (row as any).producto_nombre || '',
              productoTasa: d?.producto?.tasa || 0,
              productoMontoMinimo: d?.producto?.montoMinimo || 0,
              saldo_actual: formatMoneyStr(row.saldo_actual) || '0.00',
              monto_sol: formatMoneyStr(row.monto_sol),
              monto_aut: formatMoneyStr(row.monto_aut),
              monto_disp: formatMoneyStr(row.monto_disp),
              estatus_sol: row.estatus_sol || 'Pendiente',
              estatus_disp: row.estatus_disp || 'Pendiente',
              estatus_cart: row.estatus_cart || 'Activa',
              estatus_cuen: row.estatus_cuen || 'Activa',
              fecha_autori: extractDate(row.fecha_autori),
              fecha_disper: extractDate(row.fecha_disper),
              fecha_cancel: extractDate(row.fecha_cancel),
              fecha_inicio: extractDate(row.fecha_inicio),
              fecha_fin_cu: extractDate(row.fecha_fin_cu),
            });
          }
        } else {
          // Intento 4: reconstruir desde CuentaAhorroListItem en sessionStorage
          const localList = JSON.parse(sessionStorage.getItem('cuentas_ahorro_local') || '[]') as any[];
          const localItem = localList.find((c: any) => c.id === uuid);
          if (localItem) {
            console.log('[CuentasAhorroForm] Reconstruyendo desde lista local:', uuid);
            setDbForm({
              ...EMPTY_DB_FORM,
              id: localItem.id || uuid,
              no_sol: localItem.noSol || '',
              no_cuenta: localItem.noCuenta || '',
              cliente_id: localItem.clienteId || '',
              clienteNombreDisplay: localItem.clienteNombre || '',
              clienteClaveDisplay: localItem.clienteId?.slice(0, 8) || '',
              producto_id: localItem.productoId || '',
              productoNombreDisplay: localItem.productoNombre || '',
              fecha_sol: extractDate(localItem.fechaSol),
              fecha_autori: extractDate(localItem.fechaAutori),
              saldo_actual: typeof localItem.saldoActual === 'number' ? localItem.saldoActual.toFixed(2) : '0.00',
              estatus_cuen: localItem.estatusCuen || 'Activa',
              estatus_cart: localItem.estatusCart || 'Activa',
              estatus_sol: localItem.estatusSol || 'Pendiente',
              estatus_disp: localItem.estatusDisp || 'Pendiente',
              cta_eje_chec: !!localItem.ctaEjeChec,
              linea_produc: localItem.lineaProduc || 'CAPTACION',
              tipo_produc: localItem.tipoProduc || 'Ahorro',
            });
            toast.info('Registro cargado desde caché local', {
              description: 'Algunos campos pueden estar incompletos. Conecte la BD para datos completos.',
            });
          } else {
            toast.error('No se pudo cargar el registro', {
              description: result.error || 'Verifica la conexión con Supabase',
            });
          }
        }
      } catch (err: any) {
        console.error('[CuentasAhorroForm] Error inesperado cargando registro:', err?.message || err);
        toast.error('Error inesperado al cargar', {
          description: err?.message || 'Error desconocido',
        });
      }

      setLoadingRecord(false);
    };

    loadRecord();
  }, [isNew, accountId]);

  // ── Form helpers ──
  const setDb = (field: keyof CuentaAhorroDBForm, value: any) => {
    if (isRO) return;
    setDbForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const setDbDate = (field: keyof CuentaAhorroDBForm, ddmmyyyy: string) => {
    setDb(field, toISODate(ddmmyyyy));
  };
  const getDbDateDisplay = (field: keyof CuentaAhorroDBForm): string => {
    return fromISODate(dbForm[field] as string);
  };

  const handleDbNumeric = (field: keyof CuentaAhorroDBForm, value: string) => {
    setDb(field, value.replace(/[^0-9.,-]/g, ''));
  };
  const handleDbCurrencyBlur = (field: keyof CuentaAhorroDBForm) => {
    const raw = (dbForm[field] as string || '').replace(/[^0-9.-]/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num) && num >= 0) setDb(field, num.toFixed(2));
  };

  // ── Pick Maps ──
  const handleClienteSelected = (result: ClientePickResult) => {
    setDb('cliente_id', result.clienteId);
    setDb('clienteClaveDisplay', result.claveCliente);
    setDb('clienteNombreDisplay', result.nombreCompleto);
    if (errors.cliente_id) setErrors(prev => { const n = { ...prev }; delete n.cliente_id; return n; });
  };

  const handleProductoSelected = (result: ProductoPickResult) => {
    setDb('producto_id', result.productoId);
    // producto_eje es UUID en la DB — solo asignarlo si productoId es UUID válido
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.productoId);
    setDb('producto_eje', isUUID ? result.productoId : '');
    setDb('productoClaveDisplay', result.claveProducto);
    setDb('productoNombreDisplay', result.nombreProducto);
    setDb('productoTasa', result.tasa);
    setDb('productoMontoMinimo', result.montoMinimo);
    if (errors.producto_id) setErrors(prev => { const n = { ...prev }; delete n.producto_id; return n; });
  };

  // ═══════════════════════════════════════════════════════════════════
  // VALIDACIÓN (spec sección 8 / editar sección 5)
  // ═══════════════════════════════════════════════════════════════════
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!dbForm.no_sol.trim()) e.no_sol = 'Obligatorio';
    if (!dbForm.no_cuenta.trim()) e.no_cuenta = 'Obligatorio';
    if (!dbForm.fecha_sol) e.fecha_sol = 'Obligatorio';
    if (!dbForm.cliente_id) {
      e.cliente_id = 'Seleccione un cliente';
    } else if (!isValidUUID(dbForm.cliente_id)) {
      e.cliente_id = 'UUID inválido — seleccione un cliente real de J_CLIENTES';
    }
    if (!dbForm.producto_id) {
      e.producto_id = 'Seleccione un producto';
    } else if (!isValidUUID(dbForm.producto_id)) {
      e.producto_id = 'UUID inválido — el producto viene del catálogo local. Se requiere J_PRODUCTOS en la BD';
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error('Campos obligatorios incompletos', {
        description: `${Object.keys(e).length} campo(s) requieren corrección`,
        duration: 4000,
      });
      return false;
    }
    return true;
  };

  // ═══════════════════════════════════════════════════════════════════
  // GUARDAR — Modo Nuevo (INSERT institucional)
  // ═══════════════════════════════════════════════════════════════════
  const handleSaveNew = async () => {
    if (!validate()) return;
    setSaving(true);

    const jsonData: Record<string, unknown> = {
      cliente: {
        claveCliente: dbForm.clienteClaveDisplay,
        nombreCompleto: dbForm.clienteNombreDisplay,
      },
      producto: {
        claveProducto: dbForm.productoClaveDisplay,
        nombreProducto: dbForm.productoNombreDisplay,
        tasa: dbForm.productoTasa,
        montoMinimo: dbForm.productoMontoMinimo,
      },
      metadatos: {
        creadoPor: 'usuario_actual',
        fechaCreacion: new Date().toISOString(),
        ultimaActualizacion: new Date().toISOString(),
      },
    };

    // After validate(), we know these are valid UUIDs
    const payload: InsertCuentaAhorroPayload = {
      p_no_sol: dbForm.no_sol.trim(),
      p_no_cuenta: dbForm.no_cuenta.trim(),
      p_no_referenc1: dbForm.no_referenc1.trim() || null,
      p_fecha_sol: dbForm.fecha_sol || new Date().toISOString(),
      p_fecha_autori: dbForm.fecha_autori || null,
      p_fecha_disper: dbForm.fecha_disper || null,
      p_fecha_cancel: dbForm.fecha_cancel || null,
      p_fecha_inicio: dbForm.fecha_inicio || null,
      p_fecha_fin_cu: dbForm.fecha_fin_cu || null,
      p_descripcion: dbForm.descripcion.trim() || null,
      p_producto_id: isValidUUID(dbForm.producto_id) ? dbForm.producto_id : null,
      p_producto_eje: isValidUUID(dbForm.producto_eje) ? dbForm.producto_eje : (isValidUUID(dbForm.producto_id) ? dbForm.producto_id : null),
      p_cliente_id: isValidUUID(dbForm.cliente_id) ? dbForm.cliente_id : null,
      p_monto_sol: dbForm.monto_sol ? parseFloat(dbForm.monto_sol.replace(/[^0-9.-]/g, '')) || null : null,
      p_monto_aut: dbForm.monto_aut ? parseFloat(dbForm.monto_aut.replace(/[^0-9.-]/g, '')) || null : null,
      p_monto_disp: dbForm.monto_disp ? parseFloat(dbForm.monto_disp.replace(/[^0-9.-]/g, '')) || null : null,
      p_cta_eje_chec: dbForm.cta_eje_chec,
      p_fases: dbForm.fases.trim() || null,
      p_data: jsonData,
    };

    const result = await insertCuenta(payload);
    setSaving(false);

    if (result.ok) {
      if (result.persisted) {
        toast.success('Cuenta de ahorro creada en J_CUENTAS_CORP_CLIENTES (BD)', {
          description: `No. Solicitud: ${dbForm.no_sol} — Cliente: ${dbForm.clienteNombreDisplay}`,
          duration: 4000,
        });
      } else {
        toast.warning('Cuenta guardada SOLO en memoria local (sessionStorage)', {
          description: `⚠️ NO se persistió en BD. La Edge Function v19.3 no está desplegada y el RPC insert_cuenta_ahorro tiene overloads ambiguos (PGRST106). Revisa la consola para más detalles.`,
          duration: 10000,
        });
      }
      onSave?.(result.data);
    } else {
      toast.error('Error al guardar', { description: result.error || 'Verifica la conexión', duration: 5000 });
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // GUARDAR — Modo Editar (UPDATE con JSON MERGE)
  // ═══════════════════════════════════════════════════════════════════
  const handleSaveEdit = async () => {
    if (!validate()) return;
    setSaving(true);

    // Construir JSON PARCIAL (solo los nodos que pudieron cambiar)
    // Spec: "No reconstruir el JSON completo. No eliminar nodos."
    // Usamos || merge: data = data || '<JSON_PARCIAL>'::jsonb
    const jsonPartial: Record<string, unknown> = {
      cliente: {
        claveCliente: dbForm.clienteClaveDisplay,
        nombreCompleto: dbForm.clienteNombreDisplay,
      },
      producto: {
        claveProducto: dbForm.productoClaveDisplay,
        nombreProducto: dbForm.productoNombreDisplay,
        tasa: dbForm.productoTasa,
        montoMinimo: dbForm.productoMontoMinimo,
      },
      metadatos: {
        ultimaActualizacion: new Date().toISOString(),
      },
    };

    const parseNum = (v: string): number | null => {
      const n = parseFloat((v || '').replace(/[^0-9.-]/g, ''));
      return isNaN(n) ? null : n;
    };

    // After validate(), we know these are valid UUIDs
    const payload: UpdateCuentaAhorroPayload = {
      p_id: dbForm.id,
      p_no_sol: dbForm.no_sol.trim(),
      p_no_cuenta: dbForm.no_cuenta.trim(),
      p_no_referenc1: dbForm.no_referenc1.trim() || null,
      p_fecha_sol: dbForm.fecha_sol || null,
      p_fecha_autori: dbForm.fecha_autori || null,
      p_fecha_disper: dbForm.fecha_disper || null,
      p_fecha_cancel: dbForm.fecha_cancel || null,
      p_fecha_inicio: dbForm.fecha_inicio || null,
      p_fecha_fin_cu: dbForm.fecha_fin_cu || null,
      p_descripcion: dbForm.descripcion.trim() || null,
      p_producto_id: dbForm.producto_id,
      p_producto_eje: isValidUUID(dbForm.producto_eje) ? dbForm.producto_eje : dbForm.producto_id,
      p_cliente_id: dbForm.cliente_id,
      p_saldo_actual: parseNum(dbForm.saldo_actual),
      p_monto_sol: parseNum(dbForm.monto_sol),
      p_monto_aut: parseNum(dbForm.monto_aut),
      p_monto_disp: parseNum(dbForm.monto_disp),
      p_estatus_disp: dbForm.estatus_disp || null,
      p_estatus_sol: dbForm.estatus_sol || null,
      p_estatus_cart: dbForm.estatus_cart || null,
      p_estatus_cuen: dbForm.estatus_cuen || null,
      p_cta_eje_chec: dbForm.cta_eje_chec,
      p_fases: dbForm.fases.trim() || null,
      p_data_partial: jsonPartial,
    };

    const result = await updateCuenta(payload);
    setSaving(false);

    if (result.ok) {
      toast.success('Cuenta actualizada en J_CUENTAS_CORP_CLIENTES', {
        description: `ID: ${dbForm.id.slice(0, 8)}... — JSON MERGE aplicado`,
        duration: 4000,
      });
      onSave?.(result.data);
    } else {
      toast.error('Error al actualizar', { description: result.error || 'Verifica la conexión', duration: 5000 });
    }
  };

  const handleSave = () => {
    if (isNew) handleSaveNew();
    else if (isEdit) handleSaveEdit();
  };

  // ── Clases de input ──
  const inputCls = (hasError = false, disabled = false) => {
    const base = 'w-full px-2 py-1 text-xs border rounded focus:outline-none';
    const border = hasError ? 'border-red-400' : 'border-gray-300';
    const focus = !disabled && !isRO ? 'focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5]' : '';
    const bg = disabled || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800';
    return `${base} ${border} ${focus} ${bg}`;
  };

  const selectCls = (hasError = false) => {
    const base = 'w-full px-2 py-1 text-xs border rounded focus:outline-none';
    const border = hasError ? 'border-red-400' : 'border-gray-300';
    const focus = !isRO ? 'focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5]' : '';
    const bg = isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800';
    return `${base} ${border} ${focus} ${bg}`;
  };

  const Lbl = ({ children, req, error }: { children: string; req?: boolean; error?: string }) => (
    <label className={`block text-xs mb-1 ${error ? 'text-red-600' : 'text-gray-700'}`}>
      {children}{req && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  );

  const tabs = [
    { id: 'default', label: 'Default' },
    { id: 'beneficiarios', label: 'Beneficiarios' },
    { id: 'cotitulares', label: 'Co-titulares' },
    { id: 'intereses', label: 'Intereses Diarios' },
    { id: 'rendimiento', label: 'Rendimiento por periodo' },
    { id: 'impuestos', label: 'Impuestos' },
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'cargos', label: 'Cargos' },
    { id: 'bloqueos', label: 'Bloqueos' },
    { id: 'solicitud', label: 'Solicitud extraordinaria' },
  ];

  // ═══════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════
  if (loadingRecord) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white">
        <svg className="animate-spin h-8 w-8 text-[#4A6FA5] mb-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs text-gray-500">
          Cargando registro desde J_CUENTAS_CORP_CLIENTES...
        </span>
        <span className="text-[10px] text-gray-400 mt-1">
          UUID: {String(accountId)}
        </span>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 flex flex-col bg-white overflow-auto">
      {/* ─── Header ─── */}
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
              <rect x="2" y="4" width="14" height="10" rx="1" /><path d="M2 7h14" />
            </svg>
            <span className="text-sm text-gray-700">
              {isNew
                ? 'Alta Cuenta de Ahorro — J_CUENTAS_CORP_CLIENTES'
                : isEdit
                  ? `Edición Cuenta de Ahorro — ${dbForm.no_cuenta || dbForm.id.slice(0, 8)}`
                  : `Detalle Cuenta de Ahorro — ${dbForm.no_cuenta || dbForm.id.slice(0, 8)}`}
            </span>
            {backendStatus === 'connected' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-green-50 text-green-700 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> DB conectada
              </span>
            )}
            {isEdit && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                JSON MERGE
              </span>
            )}
          </div>
          <button onClick={onCancel} className="text-secondary-theme text-sm hover:underline">Lista</button>
        </div>
      </div>

      {/* ─── Action bar ─── */}
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {!isRO && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-1.5 btn-secondary-theme rounded text-sm disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={onCancel} className="px-5 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">
                Cancelar
              </button>
            </>
          )}
          {isRO && (
            <button onClick={onCancel} className="px-5 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">Cerrar</button>
          )}
        </div>
      </div>

      {/* ─── Formulario ─── */}
      <div className="px-6 py-6">

        {/* ── ID (oculto para Edit/Ver, spec sección 1) ── */}
        {!isNew && dbForm.id && (
          <div className="mb-4 px-4 py-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500">
            <span className="text-gray-400">PK (id):</span> {dbForm.id}
          </div>
        )}

        {/* ── Sección: Información Principal ── */}
        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-4 py-2 mb-5">
          <h3 className="text-sm text-gray-800 uppercase">Información Principal</h3>
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-8">
          {/* ═══ Col 1 ═══ */}
          <div className="space-y-3">
            <div>
              <Lbl req error={errors.no_sol}>No. Solicitud (no_sol){isNew ? ' — Auto' : ''}</Lbl>
              <input
                type="text"
                value={dbForm.no_sol}
                readOnly
                disabled
                placeholder="SOL-AH-0001"
                className={inputCls(!!errors.no_sol, true)}
              />
              {isNew && dbForm.no_sol && (
                <span className="text-[10px] text-green-600 mt-0.5 block">Generado automaticamente</span>
              )}
              {errors.no_sol && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.no_sol}</span>}
            </div>

            <div>
              <Lbl req error={errors.no_cuenta}>No. Cuenta (no_cuenta){isNew ? ' — Auto' : ''}</Lbl>
              <input
                type="text"
                value={dbForm.no_cuenta}
                readOnly
                disabled
                placeholder="0126XXXXXX"
                className={inputCls(!!errors.no_cuenta, true)}
              />
              {isNew && dbForm.no_cuenta && (
                <span className="text-[10px] text-green-600 mt-0.5 block">Generado automaticamente</span>
              )}
              {errors.no_cuenta && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.no_cuenta}</span>}
            </div>

            <div>
              <Lbl>No. Referencia (no_referenc1){isNew ? ' — Auto' : ''}</Lbl>
              <input
                type="text"
                value={dbForm.no_referenc1}
                readOnly
                disabled
                placeholder="REF-XXXXXX"
                className={inputCls(false, true)}
              />
              {isNew && dbForm.no_referenc1 && (
                <span className="text-[10px] text-green-600 mt-0.5 block">Generado automaticamente</span>
              )}
            </div>

            <div>
              <Lbl req error={errors.fecha_sol}>Fecha Solicitud (fecha_sol)</Lbl>
              <DatePicker
                value={getDbDateDisplay('fecha_sol')}
                onChange={v => setDbDate('fecha_sol', v)}
                disabled={isRO}
                placeholder="dd/mm/aaaa"
                className={`px-2 py-1 ${errors.fecha_sol ? 'border-red-400' : ''}`}
              />
              {errors.fecha_sol && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.fecha_sol}</span>}
            </div>
          </div>

          {/* ═══ Col 2: Pick Maps ═══ */}
          <div className="space-y-3">
            <div>
              <Lbl req error={errors.cliente_id}>Cliente (Pick Map)</Lbl>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={dbForm.clienteNombreDisplay ? `${dbForm.clienteClaveDisplay} — ${dbForm.clienteNombreDisplay}` : ''}
                  readOnly
                  placeholder="Seleccione un cliente..."
                  className={`${inputCls(!!errors.cliente_id, true)} cursor-pointer`}
                  onClick={() => !isRO && setClienteModalOpen(true)}
                />
                {!isRO && (
                  <button
                    onClick={() => setClienteModalOpen(true)}
                    className="px-3 py-1 btn-secondary-theme rounded text-xs whitespace-nowrap"
                    title="Buscar cliente"
                  >
                    ...
                  </button>
                )}
              </div>
              {errors.cliente_id && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.cliente_id}</span>}
              {dbForm.cliente_id && (
                <span className="text-[10px] text-gray-400 mt-0.5 block">UUID: {dbForm.cliente_id}</span>
              )}
            </div>

            <div>
              <Lbl req error={errors.producto_id}>Producto (Pick Map)</Lbl>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={dbForm.productoNombreDisplay ? `${dbForm.productoClaveDisplay} — ${dbForm.productoNombreDisplay}` : ''}
                  readOnly
                  placeholder="Seleccione un producto..."
                  className={`${inputCls(!!errors.producto_id, true)} cursor-pointer`}
                  onClick={() => !isRO && setProductoModalOpen(true)}
                />
                {!isRO && (
                  <button
                    onClick={() => setProductoModalOpen(true)}
                    className="px-3 py-1 btn-secondary-theme rounded text-xs whitespace-nowrap"
                    title="Buscar producto"
                  >
                    ...
                  </button>
                )}
              </div>
              {errors.producto_id && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.producto_id}</span>}
              {dbForm.producto_id && (
                <div className="text-[10px] text-gray-400 mt-0.5">
                  Tasa: {dbForm.productoTasa.toFixed(2)}% | Min: ${dbForm.productoMontoMinimo.toLocaleString()}
                </div>
              )}
            </div>

            <div>
              <Lbl>Descripción</Lbl>
              <textarea
                value={dbForm.descripcion}
                onChange={e => setDb('descripcion', e.target.value)}
                disabled={isRO}
                placeholder="Descripción de la cuenta de ahorro"
                rows={2}
                className={inputCls(false, isRO) + ' resize-none'}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={dbForm.cta_eje_chec}
                onChange={e => setDb('cta_eje_chec', e.target.checked)}
                disabled={isRO}
                className="w-4 h-4 accent-[#4A6FA5]"
              />
              <label className="text-xs text-gray-700">Cuenta Eje / Chequera (cta_eje_chec)</label>
            </div>
          </div>

          {/* ═══ Col 3: Valores fijos + Fases ═══ */}
          <div className="space-y-3">
            <div>
              <Lbl>Línea Producto (linea_produc)</Lbl>
              <input type="text" value={dbForm.linea_produc || 'CAPTACION'} disabled className={inputCls(false, true)} />
            </div>
            <div>
              <Lbl>Tipo Producto (tipo_produc)</Lbl>
              <input type="text" value={dbForm.tipo_produc || 'Ahorro'} disabled className={inputCls(false, true)} />
            </div>
            <div>
              <Lbl>Type</Lbl>
              <input type="text" value={dbForm.type || 'CAPTACION'} disabled className={inputCls(false, true)} />
            </div>
            <div>
              <Lbl>Fases</Lbl>
              <select
                value={dbForm.fases}
                onChange={e => setDb('fases', e.target.value)}
                disabled={isRO}
                className={selectCls()}
              >
                <option value="">Sin fase</option>
                <option value="Solicitud">Solicitud</option>
                <option value="Autorización">Autorización</option>
                <option value="Dispersión">Dispersión</option>
                <option value="Operación">Operación</option>
                <option value="Cancelación">Cancelación</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Sección: Estatus ── */}
        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-4 py-2 mb-5">
          <h3 className="text-sm text-gray-800 uppercase">
            Estatus {isNew ? '(automáticos)' : ''}
          </h3>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div>
            <Lbl>Estatus Solicitud</Lbl>
            {isNew ? (
              <input type="text" value="Pendiente" disabled className={inputCls(false, true)} />
            ) : (
              <select value={dbForm.estatus_sol} onChange={e => setDb('estatus_sol', e.target.value)} disabled={isRO} className={selectCls()}>
                <option value="Pendiente">Pendiente</option>
                <option value="Autorizado">Autorizado</option>
                <option value="Rechazado">Rechazado</option>
              </select>
            )}
          </div>
          <div>
            <Lbl>Estatus Dispersión</Lbl>
            {isNew ? (
              <input type="text" value="Pendiente" disabled className={inputCls(false, true)} />
            ) : (
              <select value={dbForm.estatus_disp} onChange={e => setDb('estatus_disp', e.target.value)} disabled={isRO} className={selectCls()}>
                <option value="Pendiente">Pendiente</option>
                <option value="Dispersado">Dispersado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            )}
          </div>
          <div>
            <Lbl>Estatus Cartera</Lbl>
            {isNew ? (
              <input type="text" value="Activa" disabled className={inputCls(false, true)} />
            ) : (
              <select value={dbForm.estatus_cart} onChange={e => setDb('estatus_cart', e.target.value)} disabled={isRO} className={selectCls()}>
                <option value="Activa">Activa</option>
                <option value="Vigente">Vigente</option>
                <option value="Vencida">Vencida</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            )}
          </div>
          <div>
            <Lbl>Estatus Cuenta</Lbl>
            {isNew ? (
              <input type="text" value="Activa" disabled className={inputCls(false, true)} />
            ) : (
              <select value={dbForm.estatus_cuen} onChange={e => setDb('estatus_cuen', e.target.value)} disabled={isRO} className={selectCls()}>
                <option value="Activa">Activa</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
                <option value="Cancelado">Cancelado</option>
                <option value="Bloqueado">Bloqueado</option>
              </select>
            )}
          </div>
        </div>

        {/* ── Sección: Montos ── */}
        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-4 py-2 mb-5">
          <h3 className="text-sm text-gray-800 uppercase">Campos Monetarios</h3>
        </div>

        <div className="grid grid-cols-4 gap-x-6 gap-y-3 mb-8">
          <div>
            <Lbl>Saldo Actual (saldo_actual)</Lbl>
            {isNew ? (
              <input type="text" value="$0.00" disabled className={inputCls(false, true)} />
            ) : (
              <input
                type="text"
                value={dbForm.saldo_actual}
                onChange={e => handleDbNumeric('saldo_actual', e.target.value)}
                onBlur={() => handleDbCurrencyBlur('saldo_actual')}
                disabled={isRO}
                placeholder="0.00"
                className={inputCls(false, isRO)}
              />
            )}
          </div>
          <div>
            <Lbl>Monto Solicitado (monto_sol)</Lbl>
            <input
              type="text"
              value={dbForm.monto_sol}
              onChange={e => handleDbNumeric('monto_sol', e.target.value)}
              onBlur={() => handleDbCurrencyBlur('monto_sol')}
              disabled={isRO}
              placeholder="0.00"
              className={inputCls(false, isRO)}
            />
          </div>
          <div>
            <Lbl>Monto Autorizado (monto_aut)</Lbl>
            <input
              type="text"
              value={dbForm.monto_aut}
              onChange={e => handleDbNumeric('monto_aut', e.target.value)}
              onBlur={() => handleDbCurrencyBlur('monto_aut')}
              disabled={isRO}
              placeholder="0.00"
              className={inputCls(false, isRO)}
            />
          </div>
          <div>
            <Lbl>Monto Dispersado (monto_disp)</Lbl>
            <input
              type="text"
              value={dbForm.monto_disp}
              onChange={e => handleDbNumeric('monto_disp', e.target.value)}
              onBlur={() => handleDbCurrencyBlur('monto_disp')}
              disabled={isRO}
              placeholder="0.00"
              className={inputCls(false, isRO)}
            />
          </div>
        </div>

        {/* ── Sección: Fechas Operativas ── */}
        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-4 py-2 mb-5">
          <h3 className="text-sm text-gray-800 uppercase">Fechas Operativas</h3>
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-8">
          <div>
            <Lbl>Fecha Autorización</Lbl>
            <DatePicker
              value={getDbDateDisplay('fecha_autori')}
              onChange={v => setDbDate('fecha_autori', v)}
              disabled={isRO}
              placeholder="dd/mm/aaaa"
              className="px-2 py-1"
            />
          </div>
          <div>
            <Lbl>Fecha Dispersión</Lbl>
            <DatePicker
              value={getDbDateDisplay('fecha_disper')}
              onChange={v => setDbDate('fecha_disper', v)}
              disabled={isRO}
              placeholder="dd/mm/aaaa"
              className="px-2 py-1"
            />
          </div>
          <div>
            <Lbl>Fecha Cancelación</Lbl>
            <DatePicker
              value={getDbDateDisplay('fecha_cancel')}
              onChange={v => setDbDate('fecha_cancel', v)}
              disabled={isRO}
              placeholder="dd/mm/aaaa"
              className="px-2 py-1"
            />
          </div>
          <div>
            <Lbl>Fecha Inicio</Lbl>
            <DatePicker
              value={getDbDateDisplay('fecha_inicio')}
              onChange={v => setDbDate('fecha_inicio', v)}
              disabled={isRO}
              placeholder="dd/mm/aaaa"
              className="px-2 py-1"
            />
          </div>
          <div>
            <Lbl>Fecha Fin</Lbl>
            <DatePicker
              value={getDbDateDisplay('fecha_fin_cu')}
              onChange={v => setDbDate('fecha_fin_cu', v)}
              disabled={isRO}
              placeholder="dd/mm/aaaa"
              className="px-2 py-1"
            />
          </div>
        </div>

        {/* ── JSON Preview ── */}
        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-4 py-2 mb-5">
          <h3 className="text-sm text-gray-800 uppercase">
            {isEdit ? 'Vista previa del JSON parcial (MERGE)' : 'Vista previa del JSON institucional (data)'}
          </h3>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-6">
          <pre className="text-[10px] text-gray-600 whitespace-pre-wrap overflow-x-auto">
{JSON.stringify(
  isEdit
    ? {
        cliente: {
          claveCliente: dbForm.clienteClaveDisplay || '',
          nombreCompleto: dbForm.clienteNombreDisplay || '',
        },
        producto: {
          claveProducto: dbForm.productoClaveDisplay || '',
          nombreProducto: dbForm.productoNombreDisplay || '',
          tasa: dbForm.productoTasa,
          montoMinimo: dbForm.productoMontoMinimo,
        },
        metadatos: {
          ultimaActualizacion: new Date().toISOString(),
        },
        _mergeRule: 'data = data || <este_json>::jsonb',
      }
    : {
        cliente: {
          claveCliente: dbForm.clienteClaveDisplay || '',
          nombreCompleto: dbForm.clienteNombreDisplay || '',
        },
        producto: {
          claveProducto: dbForm.productoClaveDisplay || '',
          nombreProducto: dbForm.productoNombreDisplay || '',
          tasa: dbForm.productoTasa,
          montoMinimo: dbForm.productoMontoMinimo,
        },
        metadatos: {
          creadoPor: 'usuario_actual',
          fechaCreacion: new Date().toISOString(),
          ultimaActualizacion: new Date().toISOString(),
        },
      },
  null, 2
)}
          </pre>
        </div>

        {/* ─── Tabs ─── */}
        <div className="mb-6">
          <div className="flex items-center gap-0 bg-primary-theme">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-[10px] whitespace-nowrap border-r border-gray-500/30 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-secondary-theme text-white'
                    : 'text-white/90 hover:bg-[var(--theme-primary-hover)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Default tab ─── */}
        {activeTab === 'default' && (
          <div className="text-xs text-gray-500 italic px-4">
            {isNew
              ? 'Los montos y tasas referenciales se mostrarán una vez creada la cuenta.'
              : 'Los subtabs inferiores contienen información complementaria del registro.'}
          </div>
        )}

        {/* ─── Subtabs ─── */}
        {activeTab === 'beneficiarios' && <BeneficiariosTab mode={mode} accountId={storageId} />}
        {activeTab === 'cotitulares' && <CoTitularesTab mode={mode} accountId={storageId} />}
        {activeTab === 'intereses' && <InteresesDiariosTab mode={mode} accountId={storageId} />}
        {activeTab === 'rendimiento' && <RendimientoPeriodoTab mode={mode} accountId={storageId} />}
        {activeTab === 'impuestos' && <ImpuestosTab mode={mode} accountId={storageId} />}
        {activeTab === 'movimientos' && <MovimientosTab mode={mode} accountId={storageId} />}
        {activeTab === 'cargos' && <CargosTab mode={mode} accountId={storageId} />}
        {activeTab === 'bloqueos' && <BloqueosTab mode={mode} accountId={storageId} />}
        {activeTab === 'solicitud' && <SolicitudExtraordinariaTab mode={mode} accountId={storageId} />}
      </div>

      {/* ─── Modals ─── */}
      <ClientePickerModal
        open={clienteModalOpen}
        onClose={() => setClienteModalOpen(false)}
        onSelect={handleClienteSelected}
      />
      <ProductoPickerModal
        open={productoModalOpen}
        onClose={() => setProductoModalOpen(false)}
        onSelect={handleProductoSelected}
      />
    </div>
  );
}