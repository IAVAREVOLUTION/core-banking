/**
 * PartesRelacionadasTab.tsx — v1.0
 * 
 * Tab para mostrar y gestionar las personas relacionadas al cliente de la solicitud.
 * 
 * Funcionalidades:
 * - Mostrar lista de personas relacionadas existentes
 * - Agregar nueva parte relacionada (popup modal)
 * - Validaciones de duplicados
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { loadFromSession, saveToSession } from './solicitudCreditoStore';

// Tipos
interface PersonaRelacionada {
  id: string | number;
  clienteId?: string;
  tipoRelacion: string;
  nombre: string;
  parentesco?: string;
  telefono?: string;
  porcentajeParticipacion?: number;
  observaciones?: string;
  // Datos de la persona relacionada
  personaId?: string;
  rfc?: string;
  curp?: string;
}

interface NuevaParteForm {
  personaId: string;
  nombrePersona: string;
  tipoRelacion: string;
  porcentajeParticipacion: string;
  observaciones: string;
}

// Catálogo de tipos de relación legal
const CAT_TIPOS_RELACION = [
  { value: 'Relación legal', label: 'Relación legal' },
  { value: 'Beneficiario', label: 'Beneficiario' },
  { value: 'Aval', label: 'Aval' },
  { value: 'Obligado solidario', label: 'Obligado solidario' },
  { value: 'Representante legal', label: 'Representante legal' },
];

interface PartesRelacionadasTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  clienteId?: string;
  personasRelacionadasIniciales?: PersonaRelacionada[];
  onSave?: (partes: PersonaRelacionada[]) => void;
}

export function PartesRelacionadasTab({
  mode,
  solicitudId,
  clienteId,
  personasRelacionadasIniciales,
  onSave,
}: PartesRelacionadasTabProps) {
  const isRO = mode === 'ver';
  const storageKey = `partes_${solicitudId}`;

  // Estado de las partes relacionadas
  const [partes, setPartes] = useState<PersonaRelacionada[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Formulario para nueva parte
  const [nuevaParte, setNuevaParte] = useState<NuevaParteForm>({
    personaId: '',
    nombrePersona: '',
    tipoRelacion: '',
    porcentajeParticipacion: '',
    observaciones: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Cargar datos iniciales
  useEffect(() => {
    const stored = loadFromSession< PersonaRelacionada[]>(storageKey, 'partes');
    if (stored && stored.length > 0) {
      setPartes(stored);
    } else if (personasRelacionadasIniciales && personasRelacionadasIniciales.length > 0) {
      setPartes(personasRelacionadasIniciales);
    }
  }, [storageKey, personasRelacionadasIniciales]);

  // Guardar cuando cambian las partes
  useEffect(() => {
    if (partes.length > 0) {
      saveToSession(storageKey, 'partes', partes);
    }
  }, [partes, storageKey]);

  // Validar formulario
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!nuevaParte.personaId && !nuevaParte.nombrePersona) {
      errors.persona = 'Seleccione o ingrese una persona';
    }
    if (!nuevaParte.tipoRelacion) {
      errors.tipoRelacion = 'Seleccione el tipo de relación';
    }
    if (nuevaParte.porcentajeParticipacion) {
      const pct = parseFloat(nuevaParte.porcentajeParticipacion);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        errors.porcentaje = 'El porcentaje debe estar entre 0 y 100';
      }
    }

    // Validar duplicados
    const existe = partes.some(
      p => p.personaId === nuevaParte.personaId && p.tipoRelacion === nuevaParte.tipoRelacion
    );
    if (existe) {
      errors.duplicado = 'Ya existe esta persona con el mismo tipo de relación';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [nuevaParte, partes]);

  // Agregar nueva parte relacionada
  const handleAgregar = useCallback(() => {
    if (!validateForm()) {
      toast.error('Corrija los errores en el formulario');
      return;
    }

    const nueva: PersonaRelacionada = {
      id: Date.now(),
      clienteId: clienteId,
      personaId: nuevaParte.personaId || undefined,
      nombre: nuevaParte.nombrePersona || 'Persona seleccionada',
      tipoRelacion: nuevaParte.tipoRelacion,
      porcentajeParticipacion: nuevaParte.porcentajeParticipacion
        ? parseFloat(nuevaParte.porcentajeParticipacion)
        : undefined,
      observaciones: nuevaParte.observaciones || undefined,
    };

    setPartes(prev => [...prev, nueva]);
    toast.success('Parte relacionada agregada');
    
    // Limpiar formulario y cerrar modal
    setNuevaParte({
      personaId: '',
      nombrePersona: '',
      tipoRelacion: '',
      porcentajeParticipacion: '',
      observaciones: '',
    });
    setFormErrors({});
    setShowModal(false);

    // Notificar al componente padre
    onSave?.([...partes, nueva]);
  }, [validateForm, nuevaParte, clienteId, partes, onSave]);

  // Eliminar parte relacionada
  const handleEliminar = useCallback((id: string | number) => {
    setPartes(prev => prev.filter(p => p.id !== id));
    toast.success('Parte relacionada eliminada');
    onSave?.(partes.filter(p => p.id !== id));
  }, [partes, onSave]);

  // Abrir modal
  const handleNuevo = () => {
    setNuevaParte({
      personaId: '',
      nombrePersona: '',
      tipoRelacion: '',
      porcentajeParticipacion: '',
      observaciones: '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4A6FA5] to-[#607698] flex items-center justify-center shadow-sm">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.5">
              <circle cx="10" cy="6" r="3" />
              <path d="M3 18v-1a5 5 0 0110 0v1" />
              <path d="M15 8l2-2m0 0l2 2m-2-2v4" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Partes Relacionadas</h4>
            <p className="text-[10px] text-gray-400">{partes.length} parte(s) relacionada(s)</p>
          </div>
        </div>
        {!isRO && (
          <button
            onClick={handleNuevo}
            className="px-3 py-1.5 bg-[#4A6FA5] text-white rounded text-xs font-medium flex items-center gap-1.5 hover:bg-[#3d5c8a] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 1v10M1 6h10" />
            </svg>
            Nuevo
          </button>
        )}
      </div>

      {/* Lista de partes relacionadas */}
      {partes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="mx-auto mb-3 w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-sm">No hay partes relacionadas</p>
          {!isRO && (
            <button
              onClick={handleNuevo}
              className="mt-3 text-[#4A6FA5] text-xs hover:underline"
            >
              + Agregar primera parte relacionada
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {partes.map((parte) => (
            <div
              key={parte.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#4A6FA5]/10 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
                      <circle cx="9" cy="5" r="3" />
                      <path d="M3 17v-1a5 5 0 0110 0v1" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-gray-800">{parte.nombre}</h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                        {parte.tipoRelacion}
                      </span>
                      {parte.parentesco && (
                        <span className="text-[10px] text-gray-500">{parte.parentesco}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {parte.porcentajeParticipacion !== undefined && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-medium">
                      {parte.porcentajeParticipacion}%
                    </span>
                  )}
                  {!isRO && (
                    <button
                      onClick={() => handleEliminar(parte.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M1 3h12M5 3V2a1 1 0 011-1h2a1 1 0 011 1v1M11 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {(parte.telefono || parte.observaciones) && (
                <div className="mt-2 ml-13 text-xs text-gray-500 space-y-1">
                  {parte.telefono && <p>Tel: {parte.telefono}</p>}
                  {parte.observaciones && <p className="italic">{parte.observaciones}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal para agregar parte relacionada */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Agregar Parte Relacionada</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-5 space-y-4">
              {/* Persona */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Persona relacionada <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nuevaParte.nombrePersona}
                  onChange={e => setNuevaParte(p => ({ ...p, nombrePersona: e.target.value }))}
                  placeholder="Nombre completo de la persona"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5]"
                />
                {formErrors.persona && (
                  <p className="text-[10px] text-red-500 mt-1">{formErrors.persona}</p>
                )}
              </div>

              {/* Tipo de relación */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Relación legal <span className="text-red-500">*</span>
                </label>
                <select
                  value={nuevaParte.tipoRelacion}
                  onChange={e => setNuevaParte(p => ({ ...p, tipoRelacion: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5]"
                >
                  <option value="">-- Seleccione --</option>
                  {CAT_TIPOS_RELACION.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
                {formErrors.tipoRelacion && (
                  <p className="text-[10px] text-red-500 mt-1">{formErrors.tipoRelacion}</p>
                )}
              </div>

              {/* Porcentaje de participación */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Participación (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={nuevaParte.porcentajeParticipacion}
                  onChange={e => setNuevaParte(p => ({ ...p, porcentajeParticipacion: e.target.value }))}
                  placeholder="0-100"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5]"
                />
                {formErrors.porcentaje && (
                  <p className="text-[10px] text-red-500 mt-1">{formErrors.porcentaje}</p>
                )}
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={nuevaParte.observaciones}
                  onChange={e => setNuevaParte(p => ({ ...p, observaciones: e.target.value }))}
                  placeholder="Observaciones adicionales (opcional)"
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5] resize-none"
                />
              </div>

              {/* Error de duplicado */}
              {formErrors.duplicado && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {formErrors.duplicado}
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgregar}
                className="px-4 py-2 text-xs font-medium text-white bg-[#4A6FA5] rounded hover:bg-[#3d5c8a]"
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
