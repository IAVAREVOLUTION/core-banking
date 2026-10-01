/**
 * IntermediarioNafinSection.tsx — captura del Intermediario Financiero NAFIN
 * en el maestro Persona/Cliente (MD NAFIN 01 y 03). Una sola pantalla para
 * Prospecto (subtab Perfil) y Personas (Default), porque ambos escriben la
 * misma fila de J_CLIENTES.
 *
 * El No. Intermediario NAFIN no se captura: lo asigna el guardado
 * (`fetchSiguienteNoIntermediarioNafin`).
 */
import {
  CAT_TIPO_INTERMEDIARIO, CAT_ESTATUS_NAFIN, ESTATUS_NAFIN_VIGENTE, MSG_IF_NO_VIGENTE,
  faltantesIntermediario, type DatosIntermediarioNafin,
} from '../../lib/intermediarioNafin';

interface Props {
  datos: Partial<DatosIntermediarioNafin>;
  onChange: (campo: keyof DatosIntermediarioNafin, valor: string) => void;
  isView: boolean;
}

export function IntermediarioNafinSection({ datos, onChange, isView }: Props) {
  const roClass = 'w-full px-2 py-1 text-xs bg-gray-100 border border-gray-200 rounded text-gray-700';
  const inputClass = 'w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white';
  const faltan = faltantesIntermediario(datos);
  const noVigente = !!datos.estatusIntermediarioNafin && datos.estatusIntermediarioNafin !== ESTATUS_NAFIN_VIGENTE;

  const select = (campo: keyof DatosIntermediarioNafin, label: string, opciones: string[]) => (
    <div className="flex flex-col">
      <label className="text-[10px] text-gray-600 mb-0.5">{label} <span className="text-red-600">*</span></label>
      {isView ? (
        <div className={roClass}>{datos[campo] || '—'}</div>
      ) : (
        <select value={datos[campo] || ''} onChange={e => onChange(campo, e.target.value)} className={inputClass}>
          <option value="">-- Seleccione --</option>
          {opciones.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  );

  return (
    <div className="mb-4">
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        INTERMEDIARIO FINANCIERO NAFIN
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-3">
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-600 mb-0.5">No. INTERMEDIARIO NAFIN</label>
          <div className={roClass}>{datos.numeroIntermediarioNafin || 'Se asigna al guardar'}</div>
        </div>
        {select('tipoIntermediario', 'TIPO DE INTERMEDIARIO', CAT_TIPO_INTERMEDIARIO)}
        {select('estatusIntermediarioNafin', 'ESTATUS NAFIN', CAT_ESTATUS_NAFIN)}
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-600 mb-0.5">FECHA DE INCORPORACIÓN NAFIN</label>
          {isView ? (
            <div className={roClass}>{datos.fechaIncorporacionNafin || '—'}</div>
          ) : (
            <input type="date" value={datos.fechaIncorporacionNafin || ''}
              onChange={e => onChange('fechaIncorporacionNafin', e.target.value)} className={inputClass} />
          )}
        </div>
      </div>
      {!isView && faltan.length > 0 && (
        <p className="mt-2 text-[11px] text-amber-700">Falta capturar: {faltan.join(' · ')}</p>
      )}
      {/* MD 01 §Regla funcional — se anticipa aquí; el bloqueo real está en la
          Oportunidad (Cierre Comercial) y en la Fase 1 de la Solicitud. */}
      {noVigente && (
        <div className="mt-2 bg-red-50 border-l-4 border-red-400 px-3 py-2 text-[11px] text-red-700">
          {MSG_IF_NO_VIGENTE}
        </div>
      )}
    </div>
  );
}
