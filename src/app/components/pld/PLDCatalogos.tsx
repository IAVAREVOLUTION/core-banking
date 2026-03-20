import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as store from './pldStore';

type CatalogoTipo = 'actividadEconomica' | 'paises' | 'instrumentoMonetario' | 'tipoOperacion' | 'tipoAlerta';

interface Props { onBack?: () => void; }

const TITULOS: Record<CatalogoTipo, string> = {
  actividadEconomica: 'Actividad Económica',
  paises: 'Países',
  instrumentoMonetario: 'Instrumento Monetario',
  tipoOperacion: 'Tipo de Operación',
  tipoAlerta: 'Tipo de Alerta',
};

export function PLDCatalogos({ onBack }: Props) {
  const [catalogos, setCatalogos] = useState(store.getCatalogos);
  const [activo, setActivo] = useState<CatalogoTipo>('actividadEconomica');
  const [showNuevo, setShowNuevo] = useState(false);
  const [nuevoItem, setNuevoItem] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => { store.saveCatalogos(catalogos); }, [catalogos]);

  const items: string[] = catalogos[activo] || [];

  const handleAgregar = () => {
    if (!nuevoItem.trim()) { toast.error('Ingrese un valor'); return; }
    if (items.includes(nuevoItem.trim())) { toast.error('El elemento ya existe'); return; }
    setCatalogos((c: any) => ({ ...c, [activo]: [...(c[activo] || []), nuevoItem.trim()] }));
    setNuevoItem('');
    setShowNuevo(false);
    toast.success('Elemento agregado');
  };

  const startEdit = (idx: number) => {
    setEditIdx(idx);
    setEditValue(items[idx]);
    setConfirmDelete(null);
  };

  const handleEditSave = () => {
    if (editIdx === null) return;
    if (!editValue.trim()) { toast.error('El valor no puede estar vacío'); return; }
    setCatalogos((c: any) => ({
      ...c,
      [activo]: (c[activo] || []).map((item: string, i: number) => i === editIdx ? editValue.trim() : item)
    }));
    setEditIdx(null);
    setEditValue('');
    toast.success('Elemento actualizado');
  };

  const handleEliminar = (idx: number) => {
    setCatalogos((c: any) => ({ ...c, [activo]: (c[activo] || []).filter((_: any, i: number) => i !== idx) }));
    toast.success('Elemento eliminado');
    setConfirmDelete(null);
  };

  return (
    <div className="bg-[#F5F5F5] min-h-full">
      {/* Header */}
      <div className="bg-white px-6 py-3 border-b border-gray-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#4A6FA5" strokeWidth="1.5"><rect x="3" y="2" width="14" height="16" rx="1"/><path d="M7 2v4M13 2v4M3 6h14"/></svg>
          <h1 className="text-sm text-gray-800" style={{ fontWeight: 700 }}>Catálogos PLD</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowNuevo(true); setEditIdx(null); setConfirmDelete(null); }} className="px-4 py-1.5 bg-[#0099CC] text-white text-xs rounded hover:bg-[#0088BB]">+ Nuevo</button>
          <button onClick={onBack} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50">Volver</button>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          {/* Menu lateral */}
          <div className="bg-white border border-gray-300">
            <div className="bg-[#D9E2F3] px-3 py-2 border-l-4 border-[#4A6FA5]">
              <span className="text-xs text-[#4A6FA5]" style={{ fontWeight: 700 }}>CATÁLOGOS</span>
            </div>
            <div className="p-2 space-y-1">
              {(Object.keys(TITULOS) as CatalogoTipo[]).map(k => (
                <button
                  key={k}
                  onClick={() => { setActivo(k); setEditIdx(null); setShowNuevo(false); setConfirmDelete(null); }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors ${
                    activo === k ? 'bg-[#4A6FA5] text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {TITULOS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla */}
          <div className="col-span-3 bg-white border border-gray-300">
            <div className="bg-[#D9E2F3] px-3 py-2 border-l-4 border-[#4A6FA5] flex items-center justify-between">
              <span className="text-xs text-[#4A6FA5]" style={{ fontWeight: 700 }}>{TITULOS[activo].toUpperCase()}</span>
              <span className="text-[10px] text-gray-500">{items.length} elementos</span>
            </div>

            {/* Form nuevo inline */}
            {showNuevo && (
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
                <input
                  type="text"
                  value={nuevoItem}
                  onChange={e => setNuevoItem(e.target.value)}
                  placeholder={`Nuevo elemento de ${TITULOS[activo]}...`}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAgregar(); if (e.key === 'Escape') { setShowNuevo(false); setNuevoItem(''); } }}
                />
                <button onClick={handleAgregar} className="px-3 py-1 bg-[#0099CC] text-white text-[10px] rounded hover:bg-[#0088BB]">Agregar</button>
                <button onClick={() => { setShowNuevo(false); setNuevoItem(''); }} className="px-3 py-1 border border-gray-400 text-gray-700 text-[10px] rounded hover:bg-gray-50">Cancelar</button>
              </div>
            )}

            <div className="overflow-auto" style={{ maxHeight: '500px' }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-[#D0D0D0]">
                    <th className="px-3 py-2 text-left text-[10px] border-r border-gray-300 w-16" style={{ fontWeight: 600 }}>ID</th>
                    <th className="px-3 py-2 text-left text-[10px] border-r border-gray-300" style={{ fontWeight: 600 }}>Descripción</th>
                    <th className="px-3 py-2 text-center text-[10px] border-r border-gray-300 w-20" style={{ fontWeight: 600 }}>Estatus</th>
                    <th className="px-3 py-2 text-center text-[10px] w-36" style={{ fontWeight: 600 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Catálogo vacío. Clic en "+ Nuevo" para agregar.</td></tr>
                  ) : items.map((item, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}>
                      <td className="px-3 py-1.5 border-r border-gray-200 text-[#0066CC]" style={{ fontWeight: 500 }}>{idx + 1}</td>
                      <td className="px-3 py-1.5 border-r border-gray-200">
                        {editIdx === idx ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              className="flex-1 px-2 py-0.5 text-xs border border-blue-400 rounded focus:ring-1 focus:ring-blue-400"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') { setEditIdx(null); setEditValue(''); } }}
                            />
                            <button onClick={handleEditSave} className="px-2 py-0.5 bg-[#0099CC] text-white text-[9px] rounded hover:bg-[#0088BB]">OK</button>
                            <button onClick={() => { setEditIdx(null); setEditValue(''); }} className="px-2 py-0.5 border border-gray-300 text-gray-600 text-[9px] rounded hover:bg-gray-50">&#x2715;</button>
                          </div>
                        ) : item}
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-100 text-green-700">Activo</span>
                      </td>
                      <td className="px-3 py-1.5 text-center whitespace-nowrap">
                        {confirmDelete === idx ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[9px] text-red-600">Confirmar?</span>
                            <button onClick={() => handleEliminar(idx)} className="px-2 py-0.5 bg-red-600 text-white text-[9px] rounded">Sí</button>
                            <button onClick={() => setConfirmDelete(null)} className="px-2 py-0.5 border border-gray-300 text-gray-600 text-[9px] rounded">No</button>
                          </div>
                        ) : (
                          <>
                            <span className="text-[#0066CC] cursor-pointer hover:underline text-[10px]" onClick={() => startEdit(idx)}>Editar</span>
                            <span className="text-gray-400 mx-1">|</span>
                            <span className="text-red-600 cursor-pointer hover:underline text-[10px]" onClick={() => setConfirmDelete(idx)}>Eliminar</span>
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
      </div>
    </div>
  );
}
