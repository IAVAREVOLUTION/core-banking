import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Eye } from 'lucide-react';
import {
  Expediente, saveToSession, loadFromSession, loadFromSavedStore, generateId,
  MOCK_EXPEDIENTES, CAT_TIPO_DOCUMENTO, CAT_ESTATUS_EXPEDIENTE,
} from './solicitudCreditoStore';

interface Props { mode: 'nuevo' | 'editar' | 'ver'; solicitudId: number | string | 'new'; }

export function ExpedientesTab({ mode, solicitudId }: Props) {
  const getInit = (): Expediente[] => {
    const s = loadFromSession<Expediente[]>(solicitudId, 'expedientes');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<Expediente[]>(solicitudId, 'expedientes');
    if (saved) return saved;
    return MOCK_EXPEDIENTES[solicitudId as number] || [];
  };

  const [items, setItems] = useState<Expediente[]>(getInit);
  const [selected, setSelected] = useState<number[]>([]);
  const [showAdjuntarOptions, setShowAdjuntarOptions] = useState(false);
  const [showWmdModal, setShowWmdModal] = useState(false);
  const [wmdUrl, setWmdUrl] = useState('');
  const [showViewer, setShowViewer] = useState(false);
  const [currentFile, setCurrentFile] = useState<Expediente | null>(null);
  const isRO = mode === 'ver';

  useEffect(() => { if (mode !== 'ver') saveToSession(solicitudId, 'expedientes', items); }, [items, solicitudId, mode]);

  const nowStr = () => {
    const now = new Date();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleFileUpload = (file: File) => {
    const fileUrl = URL.createObjectURL(file);
    const n: Expediente = {
      id: generateId(),
      fechaHora: nowStr(),
      usuario: 'Usuario Actual',
      tipoDocumento: '',
      archivo: file.name,
      descripcion: '',
      estatus: 'Pendiente',
      observaciones: '',
      fileData: fileUrl,
    };
    setItems(p => [...p, n]);
    setShowAdjuntarOptions(false);
    toast.success(`Archivo "${file.name}" adjuntado exitosamente`);
  };

  const handleWebDocument = () => {
    if (!wmdUrl.trim()) return;
    const n: Expediente = {
      id: generateId(),
      fechaHora: nowStr(),
      usuario: 'Usuario Actual',
      tipoDocumento: 'Documento web',
      archivo: wmdUrl,
      descripcion: '',
      estatus: 'Pendiente',
      observaciones: '',
      fileData: wmdUrl,
    };
    setItems(p => [...p, n]);
    setShowWmdModal(false);
    setWmdUrl('');
    toast.success('Documento agregado exitosamente');
  };

  const handleEliminar = () => {
    if (selected.length === 0) { toast.error('Seleccione al menos un registro para eliminar'); return; }
    const toDelete = items.filter(e => selected.includes(e.id));
    const nonPending = toDelete.filter(e => e.estatus !== 'Pendiente');
    if (nonPending.length > 0) { toast.error('Solo se pueden eliminar registros con estatus "Pendiente"'); return; }
    setItems(p => p.filter(e => !selected.includes(e.id)));
    const count = selected.length;
    setSelected([]);
    toast.success(`${count} expediente${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  const update = (id: number, f: keyof Expediente, v: string) => {
    setItems(p => p.map(e => e.id === id ? { ...e, [f]: v } : e));
  };

  const toggleSelect = (id: number) => {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? items.map(e => e.id) : []);
  };

  const handleVisualizar = (exp: Expediente) => {
    if (!exp.fileData && !exp.archivo) {
      toast.error('No hay archivo disponible para visualizar');
      return;
    }
    setCurrentFile(exp);
    setShowViewer(true);
  };

  return (
    <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50">
      {/* Header con título y botones */}
      <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-xs text-gray-800">EXPEDIENTE ELECTRÓNICO</span>
        {!isRO && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdjuntarOptions(!showAdjuntarOptions)} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Nuevo</button>
            <button onClick={handleEliminar} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50">Eliminar</button>
          </div>
        )}
      </div>

      {/* Opciones de adjuntar: Equipo / Web */}
      {showAdjuntarOptions && !isRO && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-700 font-medium">Adjuntar desde:</span>
          <label className="px-3 py-1.5 border border-gray-300 text-xs rounded bg-gray-200 text-gray-600 cursor-pointer hover:bg-gray-300">
            Equipo
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={() => { setShowWmdModal(true); setShowAdjuntarOptions(false); }}
            className="px-3 py-1.5 border border-gray-300 text-xs rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
          >
            Web
          </button>
        </div>
      )}

      {/* Tabla de expedientes */}
      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              {!isRO && (
                <th className="px-2 py-2 text-center w-[40px] border-r border-gray-300">
                  <input type="checkbox" checked={items.length > 0 && selected.length === items.length} onChange={e => toggleAll(e.target.checked)} className="cursor-pointer" />
                </th>
              )}
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[130px]">Fecha y hora</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[120px]">Usuario</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[140px]">Archivo</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[160px]">Tipo Documento</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripción</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[100px]">Estatus</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Observaciones</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-center w-[80px]">Visualizar</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isRO ? 8 : 9} className="px-3 py-6 text-center text-xs text-gray-400">
                  {mode === 'nuevo' ? 'Agregue expedientes con el botón Nuevo' : 'Sin expedientes registrados'}
                </td>
              </tr>
            ) : items.map(e => (
              <tr key={e.id} className={`border-b border-gray-200 ${selected.includes(e.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                {!isRO && (
                  <td className="px-2 py-1.5 text-center border-r border-gray-200">
                    <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggleSelect(e.id)} className="cursor-pointer" />
                  </td>
                )}
                <td className="px-2 py-1.5 text-xs text-gray-700 border-r border-gray-200">{e.fechaHora}</td>
                <td className="px-2 py-1.5 text-xs text-gray-700 border-r border-gray-200">{e.usuario}</td>
                <td className="px-2 py-1.5 text-xs text-gray-700 border-r border-gray-200 truncate max-w-[140px]" title={e.archivo}>{e.archivo || '—'}</td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <select value={e.tipoDocumento} onChange={ev => update(e.id, 'tipoDocumento', ev.target.value)} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}>
                    <option value="">Seleccione...</option>
                    {CAT_TIPO_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <input type="text" value={e.descripcion} onChange={ev => update(e.id, 'descripcion', ev.target.value)} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} placeholder="Descripción..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <select value={e.estatus} onChange={ev => update(e.id, 'estatus', ev.target.value)} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}>
                    {CAT_ESTATUS_EXPEDIENTE.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <input type="text" value={e.observaciones} onChange={ev => update(e.id, 'observaciones', ev.target.value)} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} placeholder="Observaciones..." />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => handleVisualizar(e)}
                    className="inline-flex items-center justify-center px-2 py-1 bg-[#5B9BD5] text-white text-xs rounded hover:bg-[#4A8BC2]"
                    title="Visualizar archivo"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length < 3 && <div className="h-12 bg-white" />}
      </div>

      {/* Modal: Agregar documento desde Web */}
      {showWmdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-[#4A6FA5] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">Agregar Documento desde Web</h3>
              <button onClick={() => { setShowWmdModal(false); setWmdUrl(''); }} className="text-white hover:text-gray-200">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  URL del Documento <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={wmdUrl}
                  onChange={(e) => setWmdUrl(e.target.value)}
                  placeholder="https://ejemplo.com/documento.pdf"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]"
                  onKeyDown={(e) => { if (e.key === 'Enter' && wmdUrl.trim()) handleWebDocument(); }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ingrese la URL completa del documento que desea agregar (PDF, DOC, imagen, etc.)
                </p>
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button onClick={() => { setShowWmdModal(false); setWmdUrl(''); }} className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium">Cancelar</button>
              <button onClick={handleWebDocument} className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90 font-medium" disabled={!wmdUrl.trim()}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Visor de archivo */}
      {showViewer && currentFile && (() => {
        const fileExtension = currentFile.archivo.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension);
        const isPDF = fileExtension === 'pdf';
        const canPreview = isImage || isPDF;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#5B9BD5]" />
                  <h3 className="text-sm font-semibold text-gray-800">Visualizador de Documento</h3>
                </div>
                <button onClick={() => { setShowViewer(false); setCurrentFile(null); }} className="text-gray-500 hover:text-gray-700">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                  </svg>
                </button>
              </div>

              {/* Info del archivo */}
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div><span className="font-medium text-gray-700">Archivo:</span><span className="ml-2 text-gray-600">{currentFile.archivo}</span></div>
                  <div><span className="font-medium text-gray-700">Tipo:</span><span className="ml-2 text-gray-600">{currentFile.tipoDocumento || 'Sin tipo'}</span></div>
                  <div><span className="font-medium text-gray-700">Fecha:</span><span className="ml-2 text-gray-600">{currentFile.fechaHora}</span></div>
                  <div><span className="font-medium text-gray-700">Usuario:</span><span className="ml-2 text-gray-600">{currentFile.usuario}</span></div>
                </div>
              </div>

              {/* Visor */}
              <div className="flex-1 overflow-auto p-6 bg-gray-100">
                {canPreview ? (
                  <div className="bg-white rounded border border-gray-300 h-full flex items-center justify-center min-h-[300px]">
                    {isImage && currentFile.fileData && (
                      <img src={currentFile.fileData} alt={currentFile.archivo} className="max-w-full max-h-full object-contain" />
                    )}
                    {isPDF && currentFile.fileData && (
                      <iframe src={currentFile.fileData} className="w-full h-full min-h-[500px]" title={currentFile.archivo} />
                    )}
                    {!currentFile.fileData && (
                      <p className="text-xs text-gray-500">Archivo mock sin datos de vista previa</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded border border-gray-300 h-full flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700 mb-2">Vista previa no disponible</p>
                    <p className="text-xs text-gray-500 mb-4">Este tipo de archivo no se puede visualizar en el navegador</p>
                    {currentFile.fileData && (
                      <a href={currentFile.fileData} download={currentFile.archivo} className="px-4 py-2 text-xs bg-[#5B9BD5] text-white rounded hover:bg-[#4A8BC2]">
                        Descargar Archivo
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-600">
                  {currentFile.descripcion && <span><span className="font-medium">Descripción:</span> {currentFile.descripcion}</span>}
                </div>
                <div className="flex gap-2">
                  {currentFile.fileData && (
                    <a href={currentFile.fileData} download={currentFile.archivo} className="px-4 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                      Descargar
                    </a>
                  )}
                  <button onClick={() => { setShowViewer(false); setCurrentFile(null); }} className="px-4 py-2 text-xs bg-[#5B9BD5] text-white rounded hover:bg-[#4A8BC2]">
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}