import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '../../lib/supabaseClient';
import {
  DocumentoCargado, RequisitoProducto,
  saveToSession, loadFromSession, generateId,
} from '../solicitudes/solicitudCreditoStore';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const LOG = '[AgregarDocModal]';

const BUCKET_EXPEDIENTES = 'make-7e2d13d9-expedientes-electronicos-prospectos';

async function uploadFileToStorage(file: File, solicitudId: string) {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `expedientes-electronicos/solicitudes/${solicitudId}/${timestamp}_${safeName}`;
  const extMimeMap: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const detectedMime = file.type || extMimeMap[ext] || 'application/octet-stream';

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: detectedMime });
    if (!error && data?.path) {
      let viewUrl = `https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET_EXPEDIENTES}/${data.path}`;
      try {
        const { data: signedData } = await supabase.storage.from(BUCKET_EXPEDIENTES).createSignedUrl(data.path, 3600);
        if (signedData?.signedUrl) viewUrl = signedData.signedUrl;
      } catch (_) { /* continue */ }
      return { nombre: file.name, url: viewUrl, storagePath: data.path, mime: detectedMime, tamanoKB: Math.round(file.size / 1024) };
    }
  } catch (err) { console.warn(`${LOG} Upload 1 failed:`, err); }

  try {
    const formPayload = new FormData();
    formPayload.append('file', file, file.name);
    formPayload.append('prospectoId', solicitudId);
    const res = await fetch(`${API_BASE}/storage/expedientes/upload`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${publicAnonKey}` }, body: formPayload,
    });
    if (res.ok) {
      const json = await res.json();
      return { nombre: json.nombre || file.name, url: json.url || URL.createObjectURL(file), storagePath: json.storagePath || storagePath, mime: json.mime || file.type, tamanoKB: json.tamanoKB || Math.round(file.size / 1024) };
    }
  } catch (err) { console.warn(`${LOG} Upload 2 failed:`, err); }

  return { nombre: file.name, url: URL.createObjectURL(file), storagePath: '', mime: detectedMime, tamanoKB: Math.round(file.size / 1024) };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitudId: string;
  faseIdActual: number;
  requisitos: RequisitoProducto[];
  onAdd: (doc: DocumentoCargado) => void;
}

export function AgregarDocumentoModal({ isOpen, onClose, solicitudId, faseIdActual, requisitos, onAdd }: Props) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [tipoCustom, setTipoCustom] = useState('');
  const [nota, setNota] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requisitosFaseActual = requisitos.filter(r => r.faseId <= faseIdActual);
  const tipoFinal = tipoDocumento === '__custom__' ? tipoCustom : tipoDocumento;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!tipoFinal || !selectedFile) {
      toast.error('Completa tipo de documento y archivo');
      return;
    }
    setUploading(true);
    try {
      const uploadResult = await uploadFileToStorage(selectedFile, String(solicitudId));
      const req = requisitos.find(r => r.tipoDocumento === tipoFinal);
      const now = new Date();
      const fechaStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      const horaStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const nuevo: DocumentoCargado = {
        id: generateId(),
        fecha: `${fechaStr} ${horaStr}`,
        usuario: '(sesión pendiente)',
        tipoDocumento: tipoFinal,
        archivo: uploadResult.nombre,
        tipoArchivo: uploadResult.mime.split('/')[1]?.toUpperCase() || 'FILE',
        nota,
        area: req?.area || 'General',
        fase: req?.fase || `Fase ${faseIdActual}`,
        faseId: req?.faseId ?? faseIdActual,
        estatus: 'Pendiente',
        validadoIA: false,
        url: uploadResult.url,
        storagePath: uploadResult.storagePath,
        mime: uploadResult.mime,
        tamanoKB: uploadResult.tamanoKB,
      };
      onAdd(nuevo);
      onClose();
      setTipoDocumento('');
      setTipoCustom('');
      setNota('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Documento cargado');
    } catch { toast.error('Error al cargar documento'); }
    finally { setUploading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden border border-gray-200/50" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-[#4A6FA5] to-[#607698]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M9 2v10M5 9l4 4 4-4" />
                <path d="M3 14v2a1 1 0 001 1h10a1 1 0 001-1v-2" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white">Agregar Documento</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1.5">
              Tipo de Documento <span className="text-red-400">*</span>
            </label>
            {requisitosFaseActual.length > 0 ? (
              <>
                <select value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]">
                  <option value="">Seleccionar tipo...</option>
                  {requisitosFaseActual.map(req => (
                    <option key={req.id} value={req.tipoDocumento}>{req.tipoDocumento}</option>
                  ))}
                  <option value="__custom__">Otro (especificar)...</option>
                </select>
                {tipoDocumento === '__custom__' && (
                  <input
                    type="text" value={tipoCustom} onChange={e => setTipoCustom(e.target.value)}
                    placeholder="Escribe el tipo de documento..."
                    className="mt-2 w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]"
                    autoFocus
                  />
                )}
              </>
            ) : (
              <input
                type="text" value={tipoCustom} onChange={e => setTipoCustom(e.target.value)}
                placeholder="Ej. INE, Comprobante de domicilio, CURP..."
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]"
              />
            )}
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1.5">
              Archivo <span className="text-red-400">*</span>
            </label>
            <div onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2.5 text-xs border border-dashed border-gray-300 rounded-lg bg-gray-50 cursor-pointer hover:border-[#4A6FA5] hover:bg-blue-50/30 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#9CA3AF" strokeWidth="1.5" className="shrink-0">
                <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1 10v2a1 1 0 001 1h10a1 1 0 001-1v-2" strokeLinecap="round" />
              </svg>
              <span className={selectedFile ? 'text-gray-700' : 'text-gray-400'}>
                {selectedFile?.name || 'Clic para seleccionar archivo...'}
              </span>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1.5">Nota <span className="text-gray-300">(opcional)</span></label>
            <input type="text" value={nota} onChange={e => setNota(e.target.value)} placeholder="Agregar observaciones..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={uploading}
            className="px-5 py-2 bg-[#4A6FA5] text-white rounded-lg text-xs font-medium flex items-center gap-2 disabled:opacity-60 shadow-sm hover:bg-[#3A5A8A] transition-colors">
            {uploading ? (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M7 1v8M4 6l3 3 3-3" /><path d="M1 10v2a1 1 0 001 1h10a1 1 0 001-1v-2" />
              </svg>
            )}
            {uploading ? 'Subiendo...' : 'Cargar Documento'}
          </button>
        </div>
      </div>
    </div>
  );
}
