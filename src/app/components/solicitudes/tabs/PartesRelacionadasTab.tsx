import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { usePersonasRelacionadasDB } from '../../../hooks/usePersonasRelacionadasDB';
import { saveToSession, loadFromSession } from '../solicitudCreditoStore';

interface ParteRelacionada {
  id: number;
  tipoRelacion: string;
  nombreCompleto: string;
  participacion: string;
  telefono?: string;
  email?: string;
  curp?: string;
  rfc?: string;
  rolAsignado?: string;
  nombreEjecutivo?: string;
}

interface PartesRelacionadasTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  montoSolicitado: string;
  clienteNombre?: string;
  clienteId?: string;
}

const TIPOS_RELACION = [
  { value: 'Beneficiario', label: 'Beneficiario' },
  { value: 'Aval', label: 'Aval' },
  { value: 'ObligadoSolidario', label: 'Obligado Solidario' },
  { value: 'RepresentanteLegal', label: 'Representante Legal' },
  { value: 'RelacionLegal', label: 'Relación Legal (genérico)' },
];

const ROLES_POR_MONTO = [
  { min: 0, max: 50000, rol: 'Ejecutivo Junior', nombre: 'Ejecutivo de Cuenta Jr.' },
  { min: 50001, max: 200000, rol: 'Ejecutivo Senior', nombre: 'Ejecutivo de Cuenta Sr.' },
  { min: 200001, max: Infinity, rol: 'Gerente de Cuenta', nombre: 'Gerente de Crédito' },
];

function getRolPorMonto(monto: number): { rol: string; nombre: string } {
  const config = ROLES_POR_MONTO.find(r => monto >= r.min && monto <= r.max);
  return config || ROLES_POR_MONTO[0];
}

interface PersonaRelacionadaDropdown {
  id: string;
  nombreCompleto: string;
  tipoPersona: string;
  telefono?: string;
  email?: string;
  curp?: string;
  rfc?: string;
}

export function PartesRelacionadasTab({ mode, solicitudId, montoSolicitado, clienteNombre, clienteId }: PartesRelacionadasTabProps) {
  console.log('[PartesRelacionadasTab] Render - clienteId:', clienteId, '| clienteNombre:', clienteNombre);

  const [partes, setPartes] = useState<ParteRelacionada[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [personasDisponibles, setPersonasDisponibles] = useState<PersonaRelacionadaDropdown[]>([]);
  // Evita que el save effect escriba [] a session antes de que el load effect cargue los datos
  const loadedRef = useRef(false);

  // Cargar personas relacionadas del cliente desde DB
  const { personas: personasDB, loading: loadingPersonas } = usePersonasRelacionadasDB(clienteId);
  console.log('[PartesRelacionadasTab] personasDB:', personasDB.length, 'loading:', loadingPersonas);

  const isViewMode = mode === 'ver';

  const montoNum = useMemo(() => {
    const num = parseFloat(montoSolicitado.replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
  }, [montoSolicitado]);

  const rolAsignado = useMemo(() => getRolPorMonto(montoNum), [montoNum]);

  useEffect(() => {
    loadedRef.current = false;
    const stored = loadFromSession<ParteRelacionada[]>(solicitudId, 'partesRelacionadas');
    if (stored && stored.length > 0) {
      setPartes(stored);
    }
    loadedRef.current = true;
  }, [solicitudId]);

  useEffect(() => {
    // No persiste hasta que el efecto de carga haya corrido al menos una vez
    if (!loadedRef.current) return;
    saveToSession(solicitudId, 'partesRelacionadas', partes);
  }, [partes, solicitudId]);

  // Cuando cargan las personas del cliente: actualizar dropdown Y pre-poblar listado si está vacío
  useEffect(() => {
    console.log('[PartesRelacionadasTab] useEffect personasDB:', personasDB.length, personasDB);
    if (personasDB && personasDB.length > 0) {
      const mapped = personasDB.map(p => ({
        id: String(p.id),
        nombreCompleto: p.nombreCompleto || p.nombre || '',
        tipoPersona: p.personalidad || p.tipoRelacion || 'Persona Física',
        telefono: p.telefono || '',
        email: p.email || '',
        curp: p.curp || '',
        rfc: p.rfc || '',
      }));
      setPersonasDisponibles(mapped);
    } else {
      console.log('[PartesRelacionadasTab] personasDB is empty, clearing personasDisponibles');
      setPersonasDisponibles([]);
    }
  }, [personasDB]);

  const handleNuevaParte = () => {
    setEditIndex(null);
    setShowModal(true);
  };

  const handleEditarParte = (index: number) => {
    setEditIndex(index);
    setShowModal(true);
  };

  const handleEliminarParte = (index: number) => {
    setPartes(prev => prev.filter((_, i) => i !== index));
    toast.success('Parte relacionada eliminada');
  };

  const handleGuardarParte = (parte: ParteRelacionada) => {
    // Validar beneficiarios: si hay beneficiarios, la suma debe ser exactamente 100
    if (parte.tipoRelacion === 'Beneficiario') {
      const pct = parseFloat(parte.participacion);
      if (!parte.participacion || isNaN(pct) || pct <= 0) {
        toast.error('El porcentaje de participación es obligatorio y debe ser mayor a 0');
        return;
      }
      // Calcular suma con el nuevo/editado valor
      const otrasBeneficiarias = partes.filter(
        (p, i) => p.tipoRelacion === 'Beneficiario' && (editIndex === null || i !== editIndex)
      );
      const sumaOtras = otrasBeneficiarias.reduce((acc, p) => acc + (parseFloat(p.participacion) || 0), 0);
      const sumaTotal = sumaOtras + pct;
      if (sumaTotal > 100) {
        toast.error(`La suma de porcentajes de beneficiarios sería ${sumaTotal}%. No puede superar el 100%.`);
        return;
      }
    }

    if (editIndex !== null) {
      setPartes(prev => prev.map((p, i) => i === editIndex ? parte : p));
      toast.success('Parte relacionada actualizada');
    } else {
      setPartes(prev => [...prev, parte]);
      toast.success('Parte relacionada agregada');
    }
    setShowModal(false);
  };

  // Suma actual de porcentajes de beneficiarios
  const beneficiarios = partes.filter(p => p.tipoRelacion === 'Beneficiario');
  const sumaBeneficiarios = beneficiarios.reduce((acc, p) => acc + (parseFloat(p.participacion) || 0), 0);
  const beneficiariosOk = beneficiarios.length === 0 || sumaBeneficiarios === 100;

  const getTipoRelacionLabel = (value: string) => {
    return TIPOS_RELACION.find(t => t.value === value)?.label || value;
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-600">
            Personas relacionadas al cliente: <strong>{clienteNombre || 'No especificado'}</strong>
          </p>
          {montoNum > 0 && (
            <p className="text-[10px] text-gray-500 mt-1">
              Rol automático para este monto (${montoNum.toLocaleString('es-MX')}): 
              <span className="font-medium text-blue-600 ml-1">{rolAsignado.nombre}</span>
            </p>
          )}
        </div>
        {!isViewMode && (
          <button
            onClick={handleNuevaParte}
            className="px-3 py-1.5 bg-[#4A6FA5] text-white text-xs font-medium rounded hover:bg-[#3E5C91] transition-colors"
          >
            + Nueva Parte
          </button>
        )}
      </div>

      {/* Indicador de participación de beneficiarios */}
      {beneficiarios.length > 0 && (
        <div className={`mb-3 px-3 py-2 text-xs flex items-center gap-2 border ${
          beneficiariosOk
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {beneficiariosOk ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#C62828" strokeWidth="1.5"/><path d="M7 4v3.5M7 10h.01" stroke="#C62828" strokeWidth="1.5" strokeLinecap="round"/></svg>
          )}
          <span>
            Beneficiarios: {beneficiarios.length} registrado{beneficiarios.length !== 1 ? 's' : ''} —{' '}
            Suma de participación: <strong>{sumaBeneficiarios}%</strong>
            {!beneficiariosOk && ' — Debe ser exactamente 100%'}
          </span>
        </div>
      )}

      {/* Lista de partes */}
      {partes.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-xs">
          <div className="mb-2">
            <svg className="w-12 h-12 mx-auto text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p>No hay partes relacionadas registradas.</p>
          <p className="text-gray-400 mt-1">Haga clic en "Nueva Parte" para agregar una.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {partes.map((parte, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                      {getTipoRelacionLabel(parte.tipoRelacion)}
                    </span>
                    {parte.participacion && (
                      <span className="text-[10px] text-gray-500">
                        Participación: {parte.participacion}%
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-800 text-sm">{parte.nombreCompleto}</p>
                  {parte.rolAsignado && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Rol: <span className="font-medium">{parte.rolAsignado}</span>
                      {parte.nombreEjecutivo && <span> — {parte.nombreEjecutivo}</span>}
                    </p>
                  )}
                </div>
                {!isViewMode && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditarParte(index)}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                      title="Editar"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEliminarParte(index)}
                      className="text-red-600 hover:text-red-800 text-xs"
                      title="Eliminar"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ModalParteRelacionada
          parte={editIndex !== null ? partes[editIndex] : null}
          editIndex={editIndex}
          partesActuales={partes}
          personasDisponibles={personasDisponibles}
          loadingPersonas={loadingPersonas}
          rolAsignado={rolAsignado}
          onSave={handleGuardarParte}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

interface ModalProps {
  parte: ParteRelacionada | null;
  editIndex: number | null;
  partesActuales: ParteRelacionada[];
  personasDisponibles: PersonaRelacionadaDropdown[];
  loadingPersonas: boolean;
  rolAsignado: { rol: string; nombre: string };
  onSave: (parte: ParteRelacionada) => void;
  onClose: () => void;
}

function ModalParteRelacionada({ parte, editIndex, partesActuales, personasDisponibles, loadingPersonas, rolAsignado, onSave, onClose }: ModalProps) {
  const [formData, setFormData] = useState({
    tipoRelacion: parte?.tipoRelacion || TIPOS_RELACION[0].value,
    personaId: '',
    nombreCompleto: parte?.nombreCompleto || '',
    participacion: parte?.participacion || '',
    telefono: parte?.telefono || '',
    email: parte?.email || '',
    curp: parte?.curp || '',
    rfc: parte?.rfc || '',
  });

  const handlePersonaSelect = (personaId: string) => {
    console.log('[Modal] handlePersonaSelect - personaId:', personaId);
    console.log('[Modal] personasDisponibles:', personasDisponibles);
    
    const persona = personasDisponibles.find(p => String(p.id) === String(personaId));
    console.log('[Modal] persona found:', persona);
    
    if (persona) {
      setFormData(prev => ({
        ...prev,
        personaId,
        nombreCompleto: persona.nombreCompleto,
        telefono: persona.telefono || '',
        email: persona.email || '',
        curp: persona.curp || '',
        rfc: persona.rfc || '',
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombreCompleto.trim()) {
      toast.error('Seleccione una persona o ingrese el nombre');
      return;
    }

    // Validar participación de beneficiarios
    if (formData.tipoRelacion === 'Beneficiario') {
      const pct = Number.parseFloat(formData.participacion);
      if (!formData.participacion || Number.isNaN(pct) || pct <= 0) {
        toast.error('El porcentaje de participación es obligatorio y debe ser mayor a 0');
        return;
      }
      const sumaOtros = partesActuales
        .filter((p, i) => p.tipoRelacion === 'Beneficiario' && (editIndex === null || i !== editIndex))
        .reduce((acc, p) => acc + (Number.parseFloat(p.participacion) || 0), 0);
      const sumaTotal = sumaOtros + pct;
      if (sumaTotal > 100) {
        toast.error(`La suma de beneficiarios quedaría en ${sumaTotal}%. No puede superar el 100%.`);
        return;
      }
    }

    onSave({
      id: parte?.id || Date.now(),
      tipoRelacion: formData.tipoRelacion,
      nombreCompleto: formData.nombreCompleto,
      participacion: formData.participacion,
      telefono: formData.telefono,
      email: formData.email,
      curp: formData.curp,
      rfc: formData.rfc,
      rolAsignado: rolAsignado.rol,
      nombreEjecutivo: rolAsignado.nombre,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#4A6FA5] px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">
            {parte ? 'Editar Parte Relacionada' : 'Nueva Parte Relacionada'}
          </span>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5">
          <div className="space-y-4">
            {/* Tipo de relación */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Relación Legal <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.tipoRelacion}
                onChange={e => setFormData(prev => ({ ...prev, tipoRelacion: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]"
              >
                {TIPOS_RELACION.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Persona relacionada */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Persona Relacionada <span className="text-red-500">*</span>
              </label>
              {loadingPersonas ? (
                <div className="text-xs text-gray-500 py-2">Cargando personas...</div>
              ) : (
                <>
                  <select
                    value={formData.personaId}
                    onChange={e => handlePersonaSelect(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5] mb-2"
                  >
                    <option value="">-- Seleccionar persona --</option>
                    {personasDisponibles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombreCompleto} ({p.tipoPersona})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={formData.nombreCompleto}
                    onChange={e => setFormData(prev => ({ ...prev, nombreCompleto: e.target.value, personaId: '' }))}
                    placeholder="O ingrese nombre manualmente..."
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]"
                  />
                </>
              )}
            </div>

            {/* Participación */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Participación (%)
                {formData.tipoRelacion === 'Beneficiario' && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={formData.participacion}
                onChange={e => setFormData(prev => ({ ...prev, participacion: e.target.value }))}
                placeholder="Ej: 50"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]"
              />
              {formData.tipoRelacion === 'Beneficiario' && (
                <p className="text-[10px] text-gray-400 mt-1">La suma de todos los beneficiarios debe ser exactamente 100%.</p>
              )}
            </div>

            {/* Datos de contacto (solo lectura) */}
            {(formData.curp || formData.rfc || formData.telefono || formData.email) && (
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <div className="text-[10px] font-medium text-gray-600 mb-2">Datos de la Persona</div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {formData.curp && <div><span className="text-gray-500">CURP:</span> {formData.curp}</div>}
                  {formData.rfc && <div><span className="text-gray-500">RFC:</span> {formData.rfc}</div>}
                  {formData.telefono && <div><span className="text-gray-500">Tel:</span> {formData.telefono}</div>}
                  {formData.email && <div><span className="text-gray-500">Email:</span> {formData.email}</div>}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-[#4A6FA5] rounded hover:bg-[#3E5C91] transition-colors"
            >
              {parte ? 'Guardar Cambios' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
