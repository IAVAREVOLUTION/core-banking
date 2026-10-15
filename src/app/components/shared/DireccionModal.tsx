/**
 * DireccionModal — alta/edición de una dirección. Componente ÚNICO para
 * Personas y Tipo Interlocutor (antes cada módulo tenía su propia copia, con
 * campos y validaciones distintas).
 *
 * Valores por omisión en una dirección nueva:
 *   - País: México
 *   - Destinatario: el nombre / Razón Social de la persona (`nombrePorOmision`)
 *   - Tipo de Calle: Calle
 */
import { useState } from 'react';
import { toast } from '@/app/lib/notificaciones';

export interface DireccionDatos {
  pais: string;
  atencion: string;
  destinatario: string;
  tipoCalle: string;
  calle: string;
  numeroExterior: string;
  piso: string;
  numeroInterior: string;
  codigoPostal: string;
  colonia: string;
  municipio: string;
  ciudad: string;
  estado: string;
  tipoDireccion?: string;
}

interface Props {
  modo: 'create' | 'edit';
  /** Dirección a editar (modo edit). */
  inicial?: Partial<DireccionDatos> | null;
  /** Nombre o Razón Social de la persona: Destinatario por omisión. */
  nombrePorOmision?: string;
  /** Muestra "Tipo de Dirección" (Particular, Fiscal…). */
  conTipoDireccion?: boolean;
  onSave: (datos: DireccionDatos) => void;
  onCancel: () => void;
}

const TIPOS_CALLE = ['Av', 'Calle', 'Callejón', 'Privada', 'Boulevard'];
const TIPOS_DIRECCION = ['Particular', 'Comercial', 'Fiscal', 'Laboral', 'Otra'];
const PAISES = ['México', 'Estados Unidos', 'Canadá'];

const REQUERIDOS: { campo: keyof DireccionDatos; etiqueta: string }[] = [
  { campo: 'pais', etiqueta: 'País' },
  { campo: 'calle', etiqueta: 'Calle' },
  { campo: 'numeroExterior', etiqueta: 'Número Exterior' },
  { campo: 'codigoPostal', etiqueta: 'Código Postal' },
  { campo: 'colonia', etiqueta: 'Colonia' },
];

export function DireccionModal({ modo, inicial, nombrePorOmision = '', conTipoDireccion = false, onSave, onCancel }: Props) {
  const edit = modo === 'edit' && !!inicial;
  const v = (k: keyof DireccionDatos, porOmision = '') => (edit ? String(inicial?.[k] ?? '') : porOmision);
  const [d, setD] = useState<DireccionDatos>({
    pais: v('pais', 'México') || (edit ? '' : 'México'),
    atencion: v('atencion'),
    destinatario: v('destinatario', nombrePorOmision.trim()),
    tipoCalle: v('tipoCalle', 'Calle'),
    calle: v('calle'),
    numeroExterior: v('numeroExterior'),
    piso: v('piso'),
    numeroInterior: v('numeroInterior'),
    codigoPostal: v('codigoPostal'),
    colonia: v('colonia'),
    municipio: v('municipio'),
    ciudad: v('ciudad'),
    estado: v('estado'),
    tipoDireccion: v('tipoDireccion', 'Particular') || 'Particular',
  });
  const set = (k: keyof DireccionDatos, valor: string) => setD(prev => ({ ...prev, [k]: valor }));

  const guardar = () => {
    const faltan = REQUERIDOS.filter(r => !String(d[r.campo] ?? '').trim());
    if (faltan.length > 0) {
      toast.error('Campos requeridos faltantes', { description: `Complete: ${faltan.map(f => f.etiqueta).join(', ')}` });
      return;
    }
    onSave(conTipoDireccion ? d : (({ tipoDireccion: _t, ...resto }) => resto as DireccionDatos)(d));
  };

  const inp = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded';
  const lab = 'text-xs text-gray-700 mb-1 block';
  const req = <span className="text-red-600">*</span>;
  const texto = (k: keyof DireccionDatos, etiqueta: string, requerido = false, placeholder = etiqueta) => (
    <div>
      <label className={lab}>{etiqueta} {requerido && req}</label>
      <input type="text" value={String(d[k] ?? '')} onChange={e => set(k, e.target.value)} placeholder={`${placeholder}...`} className={inp} />
    </div>
  );
  const lista = (k: keyof DireccionDatos, etiqueta: string, opciones: string[], requerido = false, conVacio = true) => (
    <div>
      <label className={lab}>{etiqueta} {requerido && req}</label>
      <select value={String(d[k] ?? '')} onChange={e => set(k, e.target.value)} className={inp}>
        {conVacio && <option value="">Seleccionar...</option>}
        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
        {/* Valor guardado que ya no está en el catálogo: se conserva visible */}
        {d[k] && !opciones.includes(String(d[k])) && <option value={String(d[k])}>{String(d[k])}</option>}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded shadow-xl w-[900px] max-w-[95vw] max-h-[90vh] overflow-auto">
        <div className="bg-primary-theme px-6 py-3 flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold">{edit ? 'Editar Dirección' : 'Nueva Dirección'}</h2>
          <button type="button" aria-label="Cerrar" title="Cerrar" onClick={onCancel} className="text-white hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        <div className="p-6">
          <div className="bg-gray-100 border-l-4 border-primary-theme px-4 py-2 mb-4">
            <h4 className="text-xs font-semibold text-gray-800 uppercase">Información de Dirección</h4>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {lista('pais', 'País', PAISES, true)}
              {texto('atencion', 'Atención')}
              {texto('destinatario', 'Destinatario')}
              {lista('tipoCalle', 'Tipo de Calle', TIPOS_CALLE)}
              {texto('calle', 'Calle', true)}
              {texto('numeroExterior', 'Número Exterior', true, 'Número exterior')}
              {texto('piso', 'Piso')}
              {texto('numeroInterior', 'Número Interior', false, 'Número interior')}
              {texto('codigoPostal', 'Código Postal', true, 'Código postal')}
              {texto('colonia', 'Colonia', true)}
              {texto('municipio', 'Municipio/Alcaldía')}
              {texto('ciudad', 'Ciudad')}
              {texto('estado', 'Estado')}
              {conTipoDireccion && lista('tipoDireccion', 'Tipo de Dirección', TIPOS_DIRECCION, false, false)}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onCancel} className="px-6 py-2 bg-gray-500 text-white rounded text-xs hover:bg-gray-600">Cancelar</button>
            <button type="button" onClick={guardar} className="px-6 py-2 btn-primary-theme rounded text-xs hover:bg-primary-hover-theme">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
