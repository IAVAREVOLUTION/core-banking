import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  CreditoExpediente,
  saveToSession, loadFromSession, loadFromSavedStore, generateId,
  CAT_TIPO_DOCUMENTO, CAT_ESTATUS_EXPEDIENTE,
} from './creditoStore';

interface Props { sid: number | 'new'; mode: string; isRO: boolean; }

export function ExpedientesCreditoSection({ sid, mode, isRO }: Props) {
  const [items, setItems] = useState<CreditoExpediente[]>(() =>
    loadFromSession<CreditoExpediente[]>(sid, 'expedientes')
    || (mode !== 'nuevo' ? loadFromSavedStore<CreditoExpediente[]>(sid, 'expedientes') : null)
    || []
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [showOpts, setShowOpts] = useState(false);
  const [showWebModal, setShowWebModal] = useState(false);
  const [webUrl, setWebUrl] = useState('');
  const [showViewer, setShowViewer] = useState(false);
  const [currentFile, setCurrentFile] = useState<CreditoExpediente | null>(null);

  useEffect(() => { if (!isRO) saveToSession(sid, 'expedientes', items); }, [items, sid, isRO]);

  const nowStr = () => {
    const n = new Date();
    return `${n.getDate().toString().padStart(2, '0')}/${(n.getMonth() + 1).toString().padStart(2, '0')}/${n.getFullYear()} ${n.getHours().toString().padStart(2, '0')}:${n.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleFileUpload = (file: File) => {
    const fileUrl = URL.createObjectURL(file);
    setItems(p => [...p, {
      id: generateId(), fechaHora: nowStr(), usuario: 'Usuario Actual',
      tipoDocumento: '', archivo: file.name, descripcion: '',
      estatus: 'Pendiente', observaciones: '', fileData: fileUrl,
    }]);
    setShowOpts(false);
    toast.success('Archivo adjuntado exitosamente');
  };

  const handleWebDocument = () => {
    if (!webUrl.trim()) return;
    setItems(p => [...p, {
      id: generateId(), fechaHora: nowStr(), usuario: 'Usuario Actual',
      tipoDocumento: 'Documento web', archivo: webUrl, descripcion: '',
      estatus: 'Pendiente', observaciones: '', fileData: webUrl,
    }]);
    setShowWebModal(false);
    setWebUrl('');
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
    toast.success(count + ' expediente(s) eliminado(s) exitosamente');
  };

  const update = (id: number, f: keyof CreditoExpediente, v: string) => {
    setItems(p => p.map(e => e.id === id ? { ...e, [f]: v } : e));
  };

  const toggleSelect = (id: number) => {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? items.map(e => e.id) : []);
  };

  const handleVisualizar = (exp: CreditoExpediente) => {
    if (!exp.fileData && !exp.archivo) {
      toast.error('No hay archivo disponible para visualizar');
      return;
    }
    setCurrentFile(exp);
    setShowViewer(true);
  };

  return (
    <>
      {/* Header con titulo y botones */}
      <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-xs text-gray-800">EXPEDIENTE ELECTR&Oacute;NICO</span>
        {!isRO && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowOpts(!showOpts)} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Nuevo</button>
            <button onClick={handleEliminar} className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50">Eliminar</button>
          </div>
        )}
      </div>

      {/* Opciones de adjuntar */}
      {showOpts && !isRO && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-700">Adjuntar desde:</span>
          <label className="px-3 py-1.5 border border-gray-300 text-xs rounded bg-gray-200 cursor-pointer hover:bg-gray-300">
            Equipo
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.doc,.docx,.xls,.xlsx"
              onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); e.target.value = ''; }} />
          </label>
          <button onClick={() => { setShowWebModal(true); setShowOpts(false); }}
            className="px-3 py-1.5 border border-gray-300 text-xs rounded bg-gray-200 text-gray-600 hover:bg-gray-300">Web</button>
        </div>
      )}

      {/* Tabla */}
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
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripci&oacute;n</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 w-[100px]">Estatus</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Observaciones</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-center w-[80px]">Visualizar</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isRO ? 8 : 9} className="px-3 py-6 text-center text-xs text-gray-400">
                  {mode === 'nuevo' ? 'Agregue expedientes con el bot\u00f3n Nuevo' : 'Sin expedientes registrados'}
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
                <td className="px-2 py-1.5 text-xs text-gray-700 border-r border-gray-200 truncate max-w-[140px]" title={e.archivo}>{e.archivo || '\u2014'}</td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <select value={e.tipoDocumento} onChange={ev => update(e.id, 'tipoDocumento', ev.target.value)} disabled={isRO}
                    className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}>
                    <option value="">Seleccione...</option>
                    {CAT_TIPO_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <input type="text" value={e.descripcion} onChange={ev => update(e.id, 'descripcion', ev.target.value)} disabled={isRO}
                    className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} placeholder="Descripci&oacute;n..." />
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <select value={e.estatus} onChange={ev => update(e.id, 'estatus', ev.target.value)} disabled={isRO}
                    className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}>
                    {CAT_ESTATUS_EXPEDIENTE.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 border-r border-gray-200">
                  <input type="text" value={e.observaciones} onChange={ev => update(e.id, 'observaciones', ev.target.value)} disabled={isRO}
                    className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} placeholder="Observaciones..." />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => handleVisualizar(e)}
                    className="inline-flex items-center justify-center px-2 py-1 btn-accent-theme text-white text-xs rounded hover:bg-accent-hover-theme" title="Visualizar archivo">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length < 3 && <div className="h-12 bg-white" />}
      </div>

      {/* Modal: Web URL */}
      {showWebModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base text-white">Agregar Documento desde Web</h3>
              <button onClick={() => { setShowWebModal(false); setWebUrl(''); }} className="text-white hover:text-gray-200">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <label className="block text-xs text-gray-700 mb-1.5">URL del Documento <span className="text-red-600">*</span></label>
                <input type="text" value={webUrl} onChange={e => setWebUrl(e.target.value)} placeholder="https://ejemplo.com/documento.pdf"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                  onKeyDown={e => { if (e.key === 'Enter' && webUrl.trim()) handleWebDocument(); }} />
                <p className="text-xs text-gray-500 mt-1">Ingrese la URL completa del documento que desea agregar</p>
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button onClick={() => { setShowWebModal(false); setWebUrl(''); }} className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">Cancelar</button>
              <button onClick={handleWebDocument} className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90" disabled={!webUrl.trim()}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Visor */}
      {showViewer && currentFile && (() => {
        const ext = currentFile.archivo.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
        const isPDF = ext === 'pdf';
        const canPreview = isImage || isPDF;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="stroke-accent-theme" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <h3 className="text-sm text-gray-800">Visualizador de Documento</h3>
                </div>
                <button onClick={() => { setShowViewer(false); setCurrentFile(null); }} className="text-gray-500 hover:text-gray-700">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/></svg>
                </button>
              </div>
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div><span className="text-gray-700">Archivo:</span><span className="ml-2 text-gray-600">{currentFile.archivo}</span></div>
                  <div><span className="text-gray-700">Tipo:</span><span className="ml-2 text-gray-600">{currentFile.tipoDocumento || 'Sin tipo'}</span></div>
                  <div><span className="text-gray-700">Fecha:</span><span className="ml-2 text-gray-600">{currentFile.fechaHora}</span></div>
                  <div><span className="text-gray-700">Usuario:</span><span className="ml-2 text-gray-600">{currentFile.usuario}</span></div>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 bg-gray-100">
                {canPreview ? (
                  <div className="bg-white rounded border border-gray-300 h-full flex items-center justify-center min-h-[300px]">
                    {isImage && currentFile.fileData && <img src={currentFile.fileData} alt={currentFile.archivo} className="max-w-full max-h-full object-contain" />}
                    {isPDF && currentFile.fileData && <iframe src={currentFile.fileData} className="w-full h-full min-h-[500px]" title={currentFile.archivo} />}
                    {!currentFile.fileData && <p className="text-xs text-gray-500">Archivo mock sin datos de vista previa</p>}
                  </div>
                ) : (
                  <div className="bg-white rounded border border-gray-300 h-full flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-gray-700 mb-2">Vista previa no disponible</p>
                    <p className="text-xs text-gray-500 mb-4">Este tipo de archivo no se puede visualizar en el navegador</p>
                    {currentFile.fileData && (
                      <a href={currentFile.fileData} download={currentFile.archivo} className="px-4 py-2 text-xs btn-accent-theme text-white rounded hover:bg-accent-hover-theme">Descargar Archivo</a>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-600">
                  {currentFile.descripcion && <span><span className="text-gray-700">Descripci&oacute;n:</span> {currentFile.descripcion}</span>}
                </div>
                <div className="flex gap-2">
                  {currentFile.fileData && (
                    <a href={currentFile.fileData} download={currentFile.archivo} className="px-4 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Descargar</a>
                  )}
                  <button onClick={() => { setShowViewer(false); setCurrentFile(null); }} className="px-4 py-2 text-xs btn-accent-theme text-white rounded hover:bg-accent-hover-theme">Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}