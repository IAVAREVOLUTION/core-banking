import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` };

interface MotorContableRow {
  evento: any;
  componente: any;
  debito: any;
  credito: any;
}

interface Props {
  value: MotorContableRow[];
  onChange: (rows: MotorContableRow[]) => void;
  readOnly?: boolean;
}

export function MotorContableTab({ value, onChange, readOnly = false }: Props) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<MotorContableRow>({ evento: null, componente: null, debito: null, credito: null });
  const [catEventos, setCatEventos] = useState<any[]>([]);
  const [catComponentes, setCatComponentes] = useState<any[]>([]);
  const [catCuentas, setCatCuentas] = useState<any[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCatLoading(true);
    Promise.all([
      fetch(`${BASE_URL}/eventos-contables`, { headers: HEADERS }).then(r => r.json()),
      fetch(`${BASE_URL}/componentes-contables`, { headers: HEADERS }).then(r => r.json()),
      fetch(`${BASE_URL}/catalogos-contables`, { headers: HEADERS }).then(r => r.json()),
    ]).then(([ev, co, cu]) => {
      if (cancelled) return;
      setCatEventos(ev.data ?? []);
      setCatComponentes(co.data ?? []);
      setCatCuentas(cu.data ?? []);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setCatLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const openModal = () => {
    setForm({ evento: null, componente: null, debito: null, credito: null });
    setModal(true);
  };

  const addRow = () => {
    onChange([...value, { ...form }]);
    setModal(false);
  };

  const removeRow = (i: number) => onChange(value.filter((_, j) => j !== i));

  const canAdd = Boolean(form.evento && form.componente && form.debito && form.credito);

  return (
    <div>
      {/* Header */}
      <div className="bg-[#E8E8E8] px-3 py-1.5 mb-3 text-xs font-medium text-gray-700 flex items-center justify-between">
        <span>MOTOR CONTABLE — Reglas contables del producto</span>
        {!readOnly && (
          <button
            onClick={openModal}
            className="flex items-center gap-1 px-3 py-1 bg-[#2E5C91] text-white text-[10px] hover:bg-[#24497A] rounded font-medium transition-colors"
          >
            <Plus size={11} /> Nuevo
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-300">
        <table className="w-full text-xs">
          <thead className="bg-[#E8E8E8]">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Evento</th>
              <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Componente</th>
              <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Débito</th>
              <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Crédito</th>
              {!readOnly && <th className="text-center px-2 py-1.5 font-medium text-gray-700 border-b border-gray-300 w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {value.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 4 : 5} className="px-3 py-6 text-center text-gray-500 text-xs">
                  No hay reglas contables configuradas.
                </td>
              </tr>
            ) : (
              value.map((row, i) => (
                <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                  <td className="px-3 py-1.5 border-b border-gray-200">{row.evento?.evento ?? row.evento?.codigo ?? '—'}</td>
                  <td className="px-3 py-1.5 border-b border-gray-200">{row.componente?.nombre ?? row.componente?.codigo ?? '—'}</td>
                  <td className="px-3 py-1.5 border-b border-gray-200 font-mono">{row.debito?.cuenta_gl ?? '—'}{row.debito?.nombre ? ` · ${row.debito.nombre}` : ''}</td>
                  <td className="px-3 py-1.5 border-b border-gray-200 font-mono">{row.credito?.cuenta_gl ?? '—'}{row.credito?.nombre ? ` · ${row.credito.nombre}` : ''}</td>
                  {!readOnly && (
                    <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                      <button onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-xl w-[480px] max-w-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-800">Nueva regla contable</span>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-4 py-4 space-y-3">
              {catLoading ? (
                <div className="text-xs text-gray-500 text-center py-4">Cargando catálogos…</div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Evento</label>
                    <select
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-[#2E5C91]"
                      value={form.evento?.id ?? ''}
                      onChange={e => setForm(f => ({ ...f, evento: catEventos.find(x => x.id === e.target.value) ?? null }))}
                    >
                      <option value="">— Seleccionar —</option>
                      {catEventos.map(x => <option key={x.id} value={x.id}>{x.codigo} · {x.evento}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Componente</label>
                    <select
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-[#2E5C91]"
                      value={form.componente?.id ?? ''}
                      onChange={e => setForm(f => ({ ...f, componente: catComponentes.find(x => x.id === e.target.value) ?? null }))}
                    >
                      <option value="">— Seleccionar —</option>
                      {catComponentes.map(x => <option key={x.id} value={x.id}>{x.codigo} · {x.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Débito</label>
                    <select
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-[#2E5C91]"
                      value={form.debito?.id ?? ''}
                      onChange={e => setForm(f => ({ ...f, debito: catCuentas.find(x => x.id === e.target.value) ?? null }))}
                    >
                      <option value="">— Seleccionar —</option>
                      {catCuentas.map(x => <option key={x.id} value={x.id}>{x.cuenta_gl} · {x.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Crédito</label>
                    <select
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-[#2E5C91]"
                      value={form.credito?.id ?? ''}
                      onChange={e => setForm(f => ({ ...f, credito: catCuentas.find(x => x.id === e.target.value) ?? null }))}
                    >
                      <option value="">— Seleccionar —</option>
                      {catCuentas.map(x => <option key={x.id} value={x.id}>{x.cuenta_gl} · {x.nombre}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
              <button onClick={() => setModal(false)} className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button
                disabled={!canAdd}
                onClick={addRow}
                className="px-3 py-1.5 text-xs bg-[#2E5C91] text-white rounded hover:bg-[#24497A] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
