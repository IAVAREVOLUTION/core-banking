/**
 * CuentasBancariasTab.tsx — Subtab de Cuentas Bancarias dentro del módulo Personas
 *
 * Gestiona cuentas bancarias de cualquier persona (cliente, y en el futuro
 * proveedor/aval) para dispersión de fondos o domiciliación de pagos.
 *
 * Reusa EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES" con tipo_produc='otros_bancos'
 * (fijo, el usuario no lo ve ni lo edita). CRUD completo vía RPCs dedicadas
 * insert_cuenta_bancaria / update_cuenta_bancaria / delete_cuenta_bancaria.
 *
 * La CLABE se valida a 18 dígitos numéricos solo si País = México (MX);
 * para cualquier otro país la validación se relaja (se usa Número de
 * Cuenta / SWIFT, típico en operaciones internacionales).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { useCuentasBancariasDB } from '@/app/hooks/useCuentasBancariasDB';
import type { CuentaBancaria, CuentaBancariaData } from '@/app/hooks/useCuentasBancariasDB';
import { useCatalogoBancario } from '@/app/hooks/useCatalogoBancario';

interface CuentasBancariasTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
}

const EMPTY_FORM: CuentaBancariaData = {
  pais: 'MX',
  banco: '',
  cuentaClabe: '',
  numeroCuenta: '',
  moneda: 'MXN',
  cuentaSwift: '',
};

const ESTATUS_OPTIONS = ['Activo', 'Inactivo'];

export function CuentasBancariasTab({ mode, clienteId }: CuentasBancariasTabProps) {
  const isView = mode === 'ver';
  const cid = clienteId != null ? String(clienteId) : undefined;

  const { cuentas, loading, saving, backendStatus, saveCuenta, deleteCuenta } = useCuentasBancariasDB(cid);
  const { items: paises } = useCatalogoBancario('Pais');
  const { items: bancos } = useCatalogoBancario('Banco');
  const { items: monedas } = useCatalogoBancario('Moneda');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CuentaBancariaData & { estatus: string }>({ ...EMPTY_FORM, estatus: 'Activo' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const nombreCatalogo = (items: { clave: string; nombre: string }[], clave: string) =>
    items.find(i => i.clave === clave)?.nombre || clave || '—';

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, estatus: 'Activo' });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (cuenta: CuentaBancaria) => {
    setEditingId(cuenta.id);
    setForm({
      pais: cuenta.pais,
      banco: cuenta.banco,
      cuentaClabe: cuenta.cuentaClabe,
      numeroCuenta: cuenta.numeroCuenta,
      moneda: cuenta.moneda,
      cuentaSwift: cuenta.cuentaSwift,
      estatus: cuenta.estatus,
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.pais) e.pais = 'Campo obligatorio';
    if (!form.banco) e.banco = 'Campo obligatorio';
    if (!form.numeroCuenta.trim()) e.numeroCuenta = 'Campo obligatorio';
    if (!form.moneda) e.moneda = 'Campo obligatorio';

    // CLABE: obligatoria y 18 dígitos exactos solo si país = México; se relaja para otros países
    if (form.pais === 'MX') {
      if (!form.cuentaClabe.trim()) {
        e.cuentaClabe = 'Obligatoria para cuentas en México';
      } else if (!/^\d{18}$/.test(form.cuentaClabe.trim())) {
        e.cuentaClabe = 'Debe tener exactamente 18 dígitos numéricos';
      }
    } else if (form.cuentaClabe.trim() && !/^\d+$/.test(form.cuentaClabe.trim())) {
      e.cuentaClabe = 'Solo dígitos numéricos';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const result = await saveCuenta({ ...form, id: editingId || undefined });
    if (result.ok) {
      toast.success(editingId ? 'Cuenta bancaria actualizada' : 'Cuenta bancaria agregada');
      setShowModal(false);
    } else {
      toast.error('Error al guardar la cuenta bancaria', { description: result.error });
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCuenta(id);
    if (result.ok) {
      toast.success('Cuenta bancaria eliminada');
    } else {
      toast.error('Error al eliminar', { description: result.error });
    }
    setConfirmDeleteId(null);
  };

  return (
    <div className="bg-white">
      {/* Encabezado institucional */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-800">CUENTAS BANCARIAS</span>
          {backendStatus === 'connected' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-green-50 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> DB
            </span>
          )}
          {backendStatus === 'pending-deploy' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
              Local
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {loading ? 'Cargando...' : `${cuentas.length} cuenta(s)`}
          </span>
          {!isView && cid && (
            <button
              onClick={openNew}
              className="px-3 py-1 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB]"
            >
              + Agregar Cuenta
            </button>
          )}
        </div>
      </div>

      {!cid && (
        <div className="px-3 py-8 text-center text-xs text-gray-500 border border-gray-200 bg-gray-50">
          Las cuentas bancarias se pueden asociar después de guardar el registro.
        </div>
      )}

      {cid && loading && (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-6 w-6 text-[#4A6FA5] mr-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-gray-500">Consultando J_CUENTAS_CORP_CLIENTES...</span>
        </div>
      )}

      {cid && !loading && (
        <div className="border border-gray-300 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                <th className="px-3 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">PAÍS</th>
                <th className="px-3 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">BANCO</th>
                <th className="px-3 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">CLABE</th>
                <th className="px-3 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">NÚMERO DE CUENTA</th>
                <th className="px-3 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">MONEDA</th>
                <th className="px-3 py-2 text-left font-semibold text-[10px] text-gray-700 border-r border-gray-300">SWIFT</th>
                <th className="px-3 py-2 text-center font-semibold text-[10px] text-gray-700 border-r border-gray-300">ESTATUS</th>
                {!isView && <th className="px-3 py-2 text-center font-semibold text-[10px] text-gray-700">ACCIÓN</th>}
              </tr>
            </thead>
            <tbody>
              {cuentas.length === 0 ? (
                <tr>
                  <td colSpan={isView ? 7 : 8} className="px-3 py-8 text-center text-xs text-gray-500">
                    No hay cuentas bancarias registradas para esta persona.
                  </td>
                </tr>
              ) : (
                cuentas.map((c, idx) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-200"
                    style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#EEEEEE' }}
                  >
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-700">{nombreCatalogo(paises, c.pais)}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-700">{nombreCatalogo(bancos, c.banco)}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-700 font-mono">{c.cuentaClabe || '—'}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-700 font-mono">{c.numeroCuenta || '—'}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-700">{c.moneda}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-700 font-mono">{c.cuentaSwift || '—'}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-center">
                      <span className={`px-1.5 py-0.5 text-[9px] border rounded ${
                        c.estatus === 'Activo' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>{c.estatus}</span>
                    </td>
                    {!isView && (
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => openEdit(c)} className="text-[#0066CC] hover:underline text-[10px] mr-2">Editar</button>
                        <button onClick={() => setConfirmDeleteId(c.id)} className="text-red-500 hover:underline text-[10px]">Eliminar</button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ MODAL — Alta / Edición ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="relative bg-white shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#4A6FA5] px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{editingId ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}</span>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 2l12 12M14 2L2 14" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">País <span className="text-red-500">*</span></label>
                  <select
                    value={form.pais}
                    onChange={(e) => handleChange('pais', e.target.value)}
                    className={`w-full px-2 py-1.5 text-xs border rounded ${errors.pais ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">Seleccione...</option>
                    {paises.map(p => <option key={p.clave} value={p.clave}>{p.nombre}</option>)}
                  </select>
                  {errors.pais && <span className="text-[10px] text-red-500">{errors.pais}</span>}
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Banco <span className="text-red-500">*</span></label>
                  <select
                    value={form.banco}
                    onChange={(e) => handleChange('banco', e.target.value)}
                    className={`w-full px-2 py-1.5 text-xs border rounded ${errors.banco ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">Seleccione...</option>
                    {bancos.map(b => <option key={b.clave} value={b.clave}>{b.nombre}</option>)}
                  </select>
                  {errors.banco && <span className="text-[10px] text-red-500">{errors.banco}</span>}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">
                  Cuenta CLABE {form.pais === 'MX' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={form.cuentaClabe}
                  onChange={(e) => handleChange('cuentaClabe', e.target.value.replace(/\D/g, '').slice(0, 18))}
                  maxLength={18}
                  placeholder={form.pais === 'MX' ? '18 dígitos' : 'Opcional fuera de México'}
                  className={`w-full px-2 py-1.5 text-xs border rounded font-mono ${errors.cuentaClabe ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.cuentaClabe && <span className="text-[10px] text-red-500">{errors.cuentaClabe}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Número de Cuenta <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.numeroCuenta}
                    onChange={(e) => handleChange('numeroCuenta', e.target.value)}
                    className={`w-full px-2 py-1.5 text-xs border rounded ${errors.numeroCuenta ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.numeroCuenta && <span className="text-[10px] text-red-500">{errors.numeroCuenta}</span>}
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Moneda <span className="text-red-500">*</span></label>
                  <select
                    value={form.moneda}
                    onChange={(e) => handleChange('moneda', e.target.value)}
                    className={`w-full px-2 py-1.5 text-xs border rounded ${errors.moneda ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">Seleccione...</option>
                    {monedas.map(m => <option key={m.clave} value={m.clave}>{m.clave} — {m.nombre}</option>)}
                  </select>
                  {errors.moneda && <span className="text-[10px] text-red-500">{errors.moneda}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Cuenta SWIFT <span className="text-gray-400">(opcional)</span></label>
                  <input
                    type="text"
                    value={form.cuentaSwift}
                    onChange={(e) => handleChange('cuentaSwift', e.target.value.toUpperCase())}
                    placeholder="Para transferencias internacionales"
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Estatus</label>
                  <select
                    value={form.estatus}
                    onChange={(e) => handleChange('estatus', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                  >
                    {ESTATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB] disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Confirmación de eliminación ═══ */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setConfirmDeleteId(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white shadow-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-gray-700 mb-4">¿Eliminar esta cuenta bancaria? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="px-4 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
