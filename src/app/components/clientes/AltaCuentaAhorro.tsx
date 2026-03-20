import { useState, useMemo, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { toast } from 'sonner';
import { DatePicker } from './DatePicker';
import { PercentageInput } from './PercentageInput';
import {
  useClientePersistence,
} from '@/app/hooks/useClientePersistence';
import { validateCuentaEjeUnique } from '@/app/hooks/useValidacionCuentaEje';

// ========================================
// INTERFACES
// ========================================
export interface CuentaAhorroRecord {
  id: number;
  fechaApertura: string;
  lineaProducto: string;
  sublinea: string;
  producto: string;
  saldoActual: string;
  numeroCuenta: string;
  cuentaEje: boolean;
  estatus: string;
  fechaRegistro: string;
  usuario: string;
  // Extended form data
  moneda: string;
  tipoPersona: string;
  sucursal: string;
  tasaInteres: string;
  plazo: string;
  fechaVencimiento: string;
  observaciones: string;
  titular: string;
  rfc: string;
  curp: string;
  tipoCobranza: string;
  porcentajeDescuento: string;
  minimoLiquidez: string;
  claveDependencia: string;
}

interface CuentaFormData {
  fechaApertura: string;
  lineaProducto: string;
  sublinea: string;
  producto: string;
  saldoActual: string;
  numeroCuenta: string;
  cuentaEje: boolean;
  estatus: string;
  moneda: string;
  tipoPersona: string;
  sucursal: string;
  tasaInteres: string;
  plazo: string;
  fechaVencimiento: string;
  observaciones: string;
  titular: string;
  rfc: string;
  curp: string;
  tipoCobranza: string;
  porcentajeDescuento: string;
  minimoLiquidez: string;
  claveDependencia: string;
}

export interface AltaCuentaAhorroHandle {
  save: () => void;
  cancel: () => void;
}

interface AltaCuentaAhorroProps {
  cuenta?: CuentaAhorroRecord | null;
  mode: 'nuevo' | 'editar' | 'ver';
  onSave: (data: any) => void;
  onCancel: () => void;
  parentClienteId: string;
}

// ========================================
// CATALOGOS
// ========================================
const LINEAS_PRODUCTO = ['Cuenta de ahorro', 'Cuenta corriente', 'Inversion'];
const SUBLINEAS = [
  'Cuenta de ahorro para emprendedores',
  'Cuenta de ahorro para estudiantes',
  'Cuenta de ahorro para asalariados',
  'Cuenta de ahorro para negocio',
  'Cuenta de ahorro premium',
];
const PRODUCTOS = [
  'Cuenta de ahorro para negocio',
  'Cuenta de ahorro para escuela',
  'Cuenta de ahorro basica',
  'Cuenta de ahorro premium',
  'Cuenta de ahorro estandar',
];
const STATUS_OPTIONS = ['Activo', 'Pendiente', 'Cancelado', 'Bloqueado', 'Inactivo'];
const MONEDAS = ['MXN - Peso Mexicano', 'USD - Dolar Americano', 'EUR - Euro'];
const TIPO_PERSONA = ['Fisica', 'Moral'];
const SUCURSALES = ['Matriz', 'Sucursal Norte', 'Sucursal Sur', 'Sucursal Centro', 'Sucursal Oriente'];
const TIPO_COBRANZA = ['Normal', 'Acumulativa'];

/**
 * AltaCuentaAhorro - Formulario de detalle para una Cuenta de Ahorro (modal body)
 *
 * Renderiza el cuerpo del formulario con 4 secciones:
 * - Datos Generales de la Cuenta de Ahorro
 * - Datos del Titular
 * - Configuracion de Intereses
 * - Configuracion Adicional (Observaciones)
 *
 * El componente padre (CuentaAhorro) lo envuelve en un modal institucional.
 * Expone un ref handle con `save()` y `cancel()`.
 *
 * Persistencia:
 * - Form data: sessionStorage bajo `cliente_cta_${parentClienteId}_${cuentaId}`
 * - On save (new): data is migrated from tempId to real ID by parent
 */
export const AltaCuentaAhorro = forwardRef<AltaCuentaAhorroHandle, AltaCuentaAhorroProps>(
  function AltaCuentaAhorro({ cuenta, mode, onSave, onCancel, parentClienteId }, ref) {
    const isView = mode === 'ver';

    // ========================================
    // ID ESTABLE PARA PERSISTENCIA
    // ========================================
    const [tempId] = useState(() => `temp_${Date.now()}`);
    const cuentaId = cuenta?.id?.toString() || tempId;
    const entityId = `cta_${parentClienteId}_${cuentaId}`;
    const storageKey = `cliente_${entityId}`;

    // ========================================
    // DATOS INICIALES DEL FORMULARIO
    // ========================================
    const initialFormData: CuentaFormData = useMemo(() => {
      if (mode === 'nuevo') {
        return {
          fechaApertura: '', lineaProducto: '', sublinea: '', producto: '',
          saldoActual: '', numeroCuenta: '', cuentaEje: false, estatus: 'Pendiente',
          moneda: 'MXN - Peso Mexicano', tipoPersona: '', sucursal: '',
          tasaInteres: '', plazo: '', fechaVencimiento: '', observaciones: '',
          titular: '', rfc: '', curp: '', tipoCobranza: 'Normal',
          porcentajeDescuento: '', minimoLiquidez: '', claveDependencia: '',
        };
      }
      return {
        fechaApertura: cuenta?.fechaApertura || '',
        lineaProducto: cuenta?.lineaProducto || '',
        sublinea: cuenta?.sublinea || '',
        producto: cuenta?.producto || '',
        saldoActual: cuenta?.saldoActual || '',
        numeroCuenta: cuenta?.numeroCuenta || '',
        cuentaEje: cuenta?.cuentaEje || false,
        estatus: cuenta?.estatus || 'Pendiente',
        moneda: cuenta?.moneda || 'MXN - Peso Mexicano',
        tipoPersona: cuenta?.tipoPersona || '',
        sucursal: cuenta?.sucursal || '',
        tasaInteres: cuenta?.tasaInteres || '',
        plazo: cuenta?.plazo || '',
        fechaVencimiento: cuenta?.fechaVencimiento || '',
        observaciones: cuenta?.observaciones || '',
        titular: cuenta?.titular || '',
        rfc: cuenta?.rfc || '',
        curp: cuenta?.curp || '',
        tipoCobranza: cuenta?.tipoCobranza || 'Normal',
        porcentajeDescuento: cuenta?.porcentajeDescuento || '',
        minimoLiquidez: cuenta?.minimoLiquidez || '',
        claveDependencia: cuenta?.claveDependencia || '',
      };
    }, [mode, cuenta]);

    // ========================================
    // PERSISTENCIA PRINCIPAL (form data)
    // ========================================
    const {
      data: formData,
      updateField: updateFormField,
      clearPersistedData: clearFormData,
    } = useClientePersistence<CuentaFormData>(storageKey, initialFormData);

    // ========================================
    // CLEAR ALL on mode=nuevo mount
    // ========================================
    useEffect(() => {
      if (mode === 'nuevo') {
        clearFormData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    // ========================================
    // HANDLERS
    // ========================================
    const handleChange = useCallback((field: string, value: any) => {
      updateFormField(field as keyof CuentaFormData, value);
    }, [updateFormField]);

    const handleSave = useCallback(async () => {
      const warnings: string[] = [];
      if (!formData.fechaApertura) warnings.push('Fecha de apertura');
      if (!formData.lineaProducto) warnings.push('Linea de producto');
      if (!formData.producto) warnings.push('Producto');
      if (!formData.numeroCuenta) warnings.push('Numero de cuenta');

      if (warnings.length > 0) {
        toast.warning(`Campos vacios: ${warnings.join(', ')}. Puede completarlos posteriormente.`);
      }

      // ════════════════════════════════════════════════════════════════
      // REGLA INSTITUCIONAL: Validación de unicidad de Cuenta Eje
      // Solo se ejecuta aquí (módulo Cuentas de Ahorro), nunca en el módulo Cliente.
      // Si el checkbox "Cuenta Eje" está marcado Y hay número de cuenta,
      // verificar que no exista otra cuenta con el mismo número como cuenta eje.
      // ════════════════════════════════════════════════════════════════
      if (formData.cuentaEje && formData.numeroCuenta) {
        try {
          const excludeId = cuenta?.id ? parentClienteId : undefined;
          const result = await validateCuentaEjeUnique(formData.numeroCuenta, excludeId);
          if (!result.isUnique) {
            toast.error('Cuenta Eje duplicada', {
              description: `La cuenta "${formData.numeroCuenta}" ya está registrada como Cuenta Eje${result.existingNombre ? ` para el cliente "${result.existingNombre}"` : ''}.`,
              duration: 8000,
            });
            return;
          }
        } catch (err) {
          console.warn('[AltaCuentaAhorro] Error en validación de Cuenta Eje (no bloqueante):', err);
          // No bloquear guardado si la validación falla
        }
      }

      const cuentaData: Partial<CuentaAhorroRecord> = {
        ...formData,
        id: cuenta?.id,
        fechaRegistro: cuenta?.fechaRegistro || new Date().toLocaleString('es-MX', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        }),
        usuario: cuenta?.usuario || 'Usuario Actual',
        // Pass temp entityId for migration
        _tempEntityId: mode === 'nuevo' ? entityId : undefined,
      } as any;

      onSave(cuentaData);
      clearFormData();
    }, [formData, cuenta, mode, onSave, clearFormData, entityId, parentClienteId]);

    const handleCancel = useCallback(() => {
      if (mode === 'nuevo') {
        clearFormData();
      }
      onCancel();
    }, [mode, clearFormData, onCancel]);

    // ========================================
    // IMPERATIVE HANDLE
    // ========================================
    useImperativeHandle(ref, () => ({
      save: handleSave,
      cancel: handleCancel,
    }), [handleSave, handleCancel]);

    const camposEditables = mode !== 'ver';

    // ========================================
    // RENDER
    // ========================================
    return (
      <div className="p-6">
        {/* Seccion: Informacion General de la Cuenta */}
        <div className="bg-white border border-gray-300 mb-4">
          <div className="bg-primary-tint-theme px-3 py-2 border-l-4 border-primary-theme">
            <span className="text-sm font-medium text-gray-800">DATOS GENERALES DE LA CUENTA DE AHORRO</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-x-6 gap-y-3">
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">FECHA DE APERTURA <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.fechaApertura}</div>
                ) : (
                  <DatePicker value={formData.fechaApertura} onChange={(date) => handleChange('fechaApertura', date)}
                    placeholder="DD/MM/YYYY" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">LINEA DE PRODUCTO <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.lineaProducto}</div>
                ) : (
                  <select value={formData.lineaProducto} onChange={(e) => handleChange('lineaProducto', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded">
                    <option value="">Seleccione...</option>
                    {LINEAS_PRODUCTO.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">SUBLINEA <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.sublinea}</div>
                ) : (
                  <select value={formData.sublinea} onChange={(e) => handleChange('sublinea', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded">
                    <option value="">Seleccione...</option>
                    {SUBLINEAS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">PRODUCTO <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.producto}</div>
                ) : (
                  <select value={formData.producto} onChange={(e) => handleChange('producto', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded">
                    <option value="">Seleccione...</option>
                    {PRODUCTOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">NUMERO DE CUENTA <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.numeroCuenta}</div>
                ) : (
                  <input type="text" value={formData.numeroCuenta} onChange={(e) => handleChange('numeroCuenta', e.target.value)}
                    placeholder="000000000000" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">SALDO ACTUAL <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.saldoActual}</div>
                ) : (
                  <input type="text" value={formData.saldoActual} onChange={(e) => handleChange('saldoActual', e.target.value)}
                    placeholder="$ 0.00" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.estatus}</div>
                ) : (
                  <select value={formData.estatus} onChange={(e) => handleChange('estatus', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">MONEDA</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.moneda}</div>
                ) : (
                  <select value={formData.moneda} onChange={(e) => handleChange('moneda', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded">
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Seccion: Datos del Titular */}
        <div className="bg-white border border-gray-300 mb-4">
          <div className="bg-primary-tint-theme px-3 py-2 border-l-4 border-primary-theme">
            <h3 className="text-xs font-medium text-gray-800 uppercase">Datos del Titular</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-x-6 gap-y-3">
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">TITULAR</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.titular}</div>
                ) : (
                  <input type="text" value={formData.titular} onChange={(e) => handleChange('titular', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">RFC</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.rfc}</div>
                ) : (
                  <input type="text" value={formData.rfc} onChange={(e) => handleChange('rfc', e.target.value.toUpperCase())}
                    maxLength={13} className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">CURP</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.curp}</div>
                ) : (
                  <input type="text" value={formData.curp} onChange={(e) => handleChange('curp', e.target.value.toUpperCase())}
                    maxLength={18} className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">TIPO DE PERSONA</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.tipoPersona}</div>
                ) : (
                  <select value={formData.tipoPersona} onChange={(e) => handleChange('tipoPersona', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded">
                    <option value="">Seleccione...</option>
                    {TIPO_PERSONA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Seccion: Condiciones de la Cuenta */}
        <div className="bg-white border border-gray-300 mb-4">
          <div className="bg-primary-tint-theme px-3 py-2 border-l-4 border-primary-theme">
            <span className="text-sm font-medium text-gray-800">CONFIGURACION DE INTERESES</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-x-6 gap-y-3">
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">SUCURSAL</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.sucursal}</div>
                ) : (
                  <select value={formData.sucursal} onChange={(e) => handleChange('sucursal', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded">
                    <option value="">Seleccione...</option>
                    {SUCURSALES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">TASA DE INTERES</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.tasaInteres ? `${formData.tasaInteres}` : ''}</div>
                ) : (
                  <PercentageInput value={formData.tasaInteres} onChange={(value) => handleChange('tasaInteres', value)}
                    placeholder="0.00%" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">PLAZO (MESES)</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.plazo}</div>
                ) : (
                  <input type="number" value={formData.plazo} onChange={(e) => handleChange('plazo', e.target.value)}
                    min="0" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">FECHA DE VENCIMIENTO</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.fechaVencimiento}</div>
                ) : (
                  <DatePicker value={formData.fechaVencimiento} onChange={(date) => handleChange('fechaVencimiento', date)}
                    placeholder="DD/MM/YYYY" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">% DESCUENTO</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.porcentajeDescuento}</div>
                ) : (
                  <PercentageInput value={formData.porcentajeDescuento} onChange={(value) => handleChange('porcentajeDescuento', value)}
                    placeholder="0.00%" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">MINIMO DE LIQUIDEZ</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.minimoLiquidez}</div>
                ) : (
                  <input type="number" value={formData.minimoLiquidez} onChange={(e) => handleChange('minimoLiquidez', e.target.value)}
                    min="0" step="0.01" className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">TIPO DE COBRANZA</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.tipoCobranza}</div>
                ) : (
                  <select value={formData.tipoCobranza} onChange={(e) => handleChange('tipoCobranza', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded">
                    {TIPO_COBRANZA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">CLAVE DEPENDENCIA</label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">{formData.claveDependencia}</div>
                ) : (
                  <input type="text" value={formData.claveDependencia} onChange={(e) => handleChange('claveDependencia', e.target.value)}
                    maxLength={20} className="px-2 py-1 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-[10px] text-gray-600 font-medium cursor-pointer">
                  <input type="checkbox" checked={formData.cuentaEje} onChange={(e) => handleChange('cuentaEje', e.target.checked)}
                    disabled={!camposEditables} className="w-4 h-4" />
                  CUENTA EJE
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Seccion: Observaciones */}
        <div className="bg-white border border-gray-300">
          <div className="bg-primary-tint-theme px-3 py-2 border-l-4 border-primary-theme">
            <span className="text-sm font-medium text-gray-800">CONFIGURACION ADICIONAL</span>
          </div>
          <div className="p-4">
            {!camposEditables ? (
              <div className="px-2 py-1 text-xs text-gray-700 min-h-[60px]">{formData.observaciones || 'Sin observaciones'}</div>
            ) : (
              <textarea value={formData.observaciones} onChange={(e) => handleChange('observaciones', e.target.value)}
                rows={3} className="w-full px-2 py-1 text-xs border border-gray-300 rounded resize-none"
                placeholder="Observaciones sobre la cuenta..." />
            )}
          </div>
        </div>
      </div>
    );
  }
);