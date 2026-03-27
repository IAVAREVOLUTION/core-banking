import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Nota, saveToSession, loadFromSession, loadFromSavedStore, generateId, MOCK_NOTAS,
} from './solicitudCreditoStore';

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  /**
   * Cuando true, permite agregar notas aunque mode='ver'.
   * Usado en Originación: el analista siempre puede agregar notas para justificar Regresar.
   */
  allowAddNotes?: boolean;
}

export function NotasTab({ mode, solicitudId, allowAddNotes = false }: Props) {
  const getInit = (): Nota[] => {
    const s = loadFromSession<Nota[]>(solicitudId, 'notas');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<Nota[]>(solicitudId, 'notas');
    if (saved) return saved;
    // NO cargar MOCK: si la BD no tiene datos, el array queda vacío
    return [];
  };

  const [notas, setNotas] = useState<Nota[]>(getInit);
  const [showForm, setShowForm] = useState(false);
  const [newNota, setNewNota] = useState('');
  const [newArchivo, setNewArchivo] = useState('');
  // En modo originacion con allowAddNotes=true, siempre editable
  const isRO = mode === 'ver' && !allowAddNotes;

  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, 'notas', notas);
  }, [notas, solicitudId, isRO]);

  const handleAdd = () => {
    if (!newNota.trim()) {
      toast.error('Escriba una nota antes de guardar.');
      return;
    }

    const now = new Date();
    const fecha = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const nota: Nota = {
      id: generateId(),
      fecha,
      fechaCreacion: now.toISOString(),
      // TODO: reemplazar con usuario real de sesión cuando se implemente auth
      usuario: '(sesión pendiente)',
      puesto: '(puesto pendiente)',
      nota: newNota.trim(),
      archivoAdjunto: newArchivo,
    };

    setNotas(prev => [nota, ...prev]);
    setNewNota('');
    setNewArchivo('');
    setShowForm(false);
    toast.success('Nota agregada');
  };

  const handleDelete = (id: number) => {
    setNotas(prev => prev.filter(n => n.id !== id));
    toast.success('Nota eliminada');
  };

  const handleFileSelect = () => {
    const files = ['nota_adjunto.pdf', 'evidencia.png', 'reporte_credito.xlsx', 'contrato_firmado.pdf'];
    setNewArchivo(files[Math.floor(Math.random() * files.length)]);
  };

  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-800">Notas de la Solicitud</h4>
        {!isRO && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1 btn-secondary-theme rounded text-xs flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 1v10M1 6h10" />
            </svg>
            Nueva Nota
          </button>
        )}
      </div>

      {/* Formulario nueva nota */}
      {showForm && !isRO && (
        <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
          <div className="mb-3">
            <label className="block text-xs text-gray-700 mb-1">Nota <span className="text-red-500">*</span></label>
            <textarea
              value={newNota}
              onChange={e => setNewNota(e.target.value)}
              rows={3}
              maxLength={1024}
              placeholder="Escriba su nota aquí..."
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5] focus:outline-none resize-none"
            />
            <div className="text-right text-[10px] text-gray-400 mt-0.5">{newNota.length}/1024</div>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700">Archivo adjunto (opcional):</label>
              <input
                type="text" value={newArchivo} readOnly
                placeholder="Sin archivo"
                className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 w-48"
              />
              <button onClick={handleFileSelect} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">Examinar</button>
              {newArchivo && (
                <button onClick={() => setNewArchivo('')} className="text-red-500 text-xs hover:underline">Quitar</button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAdd} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Guardar Nota</button>
            <button onClick={() => { setShowForm(false); setNewNota(''); setNewArchivo(''); }} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista de notas */}
      {notas.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-xs">
          No hay notas registradas. Presione "Nueva Nota" para agregar.
        </div>
      ) : (
        <div className="space-y-3">
          {notas.map(nota => (
            <div key={nota.id} className="border border-gray-200 rounded p-3 bg-white hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{nota.fecha}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-700 font-medium">{nota.usuario}</span>
                  <span className="text-gray-400">|</span>
                  <span>{nota.puesto}</span>
                </div>
                {!isRO && (
                  <button onClick={() => handleDelete(nota.id)} className="text-red-500 hover:text-red-700 text-xs">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 4h10M5 4V2h4v2M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-800 leading-relaxed">{nota.nota}</p>
              {nota.archivoAdjunto && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 1v8M3 6l3 3 3-3" />
                    <path d="M1 10h10" />
                  </svg>
                  <span className="hover:underline cursor-pointer">{nota.archivoAdjunto}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}