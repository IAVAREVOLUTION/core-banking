import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

interface KYCTabProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
  isView: boolean;
  mode: 'create' | 'edit' | 'view';
  clienteId?: string | number;
}

const ACTIVIDADES_ECONOMICAS = [
  'Agricultura, ganadería, silvicultura y pesca',
  'Industrias extractivas',
  'Industria manufacturera',
  'Suministro de energía eléctrica, gas, vapor y aire acondicionado',
  'Suministro de agua; evacuación de aguas residuales',
  'Construcción',
  'Comercio al por mayor y al por menor',
  'Transporte y almacenamiento',
  'Hostelería',
  'Información y comunicaciones',
  'Actividades financieras y de seguros',
  'Actividades inmobiliarias',
  'Actividades profesionales, científicas y técnicas',
  'Actividades administrativas y servicios auxiliares',
  'Administración Pública y defensa',
  'Educación',
  'Actividades sanitarias y de servicios sociales',
  'Actividades artísticas, recreativas y de entretenimiento',
  'Otros servicios',
  'Actividades de los hogares',
  'Actividades de organizaciones y organismos extraterritoriales'
];

interface RegistroKYC {
  id: number;
  fechaRegistro: string;
  usuario: string;
  isPep: boolean;
  ingresoMensual: string;
  numeroSalarios: string;
  actividadEconomica: string;
  familyPep: boolean;
  funcionariosPublicos: boolean;
  listasNegras: boolean;
  otrosIngresos: boolean;
  fuenteIngresosAdicionales: string;
  resultadoCoincidencias: boolean;
  aprobadoCumplimiento: boolean;
  fechaCalificacion: string;
  calificacionPonderada: number;
  nivelRiesgo: string;
}

export function KYCTab({ formData, updateFormData, isView, mode, clienteId }: KYCTabProps) {
  const storageKey = `cliente_${clienteId || 'temp'}_kyc`;
  
  // Gestión de registros con persistencia vinculada al clienteId
  const [registros, setRegistros] = useState<RegistroKYC[]>(() => {
    if (mode === 'create') return [];
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [selectedRegistros, setSelectedRegistros] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [kycData, setKycData] = useState({
    isPep: false,
    ingresoMensual: '',
    numeroSalarios: '',
    actividadEconomica: '',
    familyPep: false,
    funcionariosPublicos: false,
    listasNegras: false,
    otrosIngresos: false,
    fuenteIngresosAdicionales: '',
    resultadoCoincidencias: false,
    aprobadoCumplimiento: false,
    fechaCalificacion: '',
    calificacionPonderada: 0,
    nivelRiesgo: 'Bajo'
  });

  // Persistir registros en sessionStorage vinculado al clienteId
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(registros));
  }, [registros, storageKey]);

  const handleChange = (field: string, value: any) => {
    setKycData(prev => ({ ...prev, [field]: value }));
  };

  const calcularRiesgo = () => {
    // Validar que haya datos mínimos para calcular
    if (!kycData.actividadEconomica) {
      toast.error('Debe seleccionar una actividad económica para calcular el riesgo');
      return;
    }

    let puntaje = 0;

    // Actividad económica (25%)
    const actividadesAltoRiesgo = [
      'Actividades financieras y de seguros',
      'Comercio al por mayor y al por menor',
      'Actividades inmobiliarias'
    ];
    const actividadesMedioRiesgo = [
      'Construcción',
      'Transporte y almacenamiento',
      'Hostelería'
    ];
    
    if (actividadesAltoRiesgo.includes(kycData.actividadEconomica)) {
      puntaje += 25;
    } else if (actividadesMedioRiesgo.includes(kycData.actividadEconomica)) {
      puntaje += 15;
    } else if (kycData.actividadEconomica) {
      puntaje += 5;
    }

    // Residencia (15%) - Asumiendo México como bajo riesgo
    puntaje += 5;

    // Nacionalidad (15%) - Asumiendo mexicana como bajo riesgo
    puntaje += 5;

    // Tipo de persona (20%) - Asumiendo física como bajo riesgo
    puntaje += 7;

    // PEP / Listas negras (25%)
    if (kycData.listasNegras) {
      puntaje += 25;
    } else if (kycData.isPep || kycData.familyPep) {
      puntaje += 18;
    } else {
      puntaje += 5;
    }

    // Determinar nivel de riesgo
    let nivel = 'Bajo';
    let colorNivel = 'success';
    
    if (puntaje >= 70 || kycData.listasNegras) {
      nivel = 'Alto';
      colorNivel = 'danger';
    } else if (puntaje >= 40 || kycData.isPep || kycData.familyPep) {
      nivel = 'Medio';
      colorNivel = 'warning';
    }

    const fechaActual = new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    setKycData(prev => ({
      ...prev,
      calificacionPonderada: puntaje,
      nivelRiesgo: nivel,
      fechaCalificacion: fechaActual
    }));

    // Mensaje personalizado según el riesgo
    if (nivel === 'Alto') {
      toast.error(`⚠️ Riesgo calculado: ${nivel} (${puntaje} puntos) - Requiere atención especial`, {
        duration: 4000
      });
    } else if (nivel === 'Medio') {
      toast.warning(`⚠️ Riesgo calculado: ${nivel} (${puntaje} puntos) - Seguimiento recomendado`, {
        duration: 4000
      });
    } else {
      toast.success(`✓ Riesgo calculado: ${nivel} (${puntaje} puntos) - Cliente de bajo riesgo`, {
        duration: 4000
      });
    }
  };

  const handleNuevo = () => {
    setEditingId(null);
    setKycData({
      isPep: false,
      ingresoMensual: '',
      numeroSalarios: '',
      actividadEconomica: '',
      familyPep: false,
      funcionariosPublicos: false,
      listasNegras: false,
      otrosIngresos: false,
      fuenteIngresosAdicionales: '',
      resultadoCoincidencias: false,
      aprobadoCumplimiento: false,
      fechaCalificacion: '',
      calificacionPonderada: 0,
      nivelRiesgo: 'Bajo'
    });
    setShowModal(true);
  };

  const handleEliminar = () => {
    if (selectedRegistros.length === 0) {
      toast.error('Por favor seleccione al menos un registro para eliminar');
      return;
    }

    setRegistros(prev => prev.filter(r => !selectedRegistros.includes(r.id)));
    const count = selectedRegistros.length;
    setSelectedRegistros([]);
    toast.success(`${count} registro${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  const handleGuardarModal = () => {
    // Validaciones flexibles - solo advertencias
    const warnings = [];
    
    if (!kycData.ingresoMensual) warnings.push('Ingreso Mensual');
    if (!kycData.numeroSalarios) warnings.push('Número de Salarios');
    if (!kycData.actividadEconomica) warnings.push('Actividad Económica');
    
    if (warnings.length > 0) {
      toast.warning(`Campos vacíos: ${warnings.join(', ')}. Puede completarlos posteriormente.`);
    }

    const fechaActual = new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (editingId !== null) {
      // Editar registro existente
      setRegistros(prev => prev.map(r => 
        r.id === editingId 
          ? { ...kycData, id: editingId, fechaRegistro: r.fechaRegistro, usuario: r.usuario }
          : r
      ));
      toast.success('Registro KYC actualizado correctamente');
    } else {
      // Crear nuevo registro
      const nuevoRegistro: RegistroKYC = {
        id: registros.length > 0 ? Math.max(...registros.map(r => r.id)) + 1 : 1,
        fechaRegistro: fechaActual,
        usuario: 'Usuario Actual',
        ...kycData
      };
      setRegistros(prev => [...prev, nuevoRegistro]);
      toast.success('Registro KYC creado correctamente');
    }

    setShowModal(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRegistros(registros.map(r => r.id));
    } else {
      setSelectedRegistros([]);
    }
  };

  const handleSelectRegistro = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedRegistros(prev => [...prev, id]);
    } else {
      setSelectedRegistros(prev => prev.filter(rid => rid !== id));
    }
  };

  const handleVerRegistro = (registro: RegistroKYC) => {
    setEditingId(registro.id);
    setKycData({
      isPep: registro.isPep,
      ingresoMensual: registro.ingresoMensual,
      numeroSalarios: registro.numeroSalarios,
      actividadEconomica: registro.actividadEconomica,
      familyPep: registro.familyPep,
      funcionariosPublicos: registro.funcionariosPublicos,
      listasNegras: registro.listasNegras,
      otrosIngresos: registro.otrosIngresos,
      fuenteIngresosAdicionales: registro.fuenteIngresosAdicionales,
      resultadoCoincidencias: registro.resultadoCoincidencias,
      aprobadoCumplimiento: registro.aprobadoCumplimiento,
      fechaCalificacion: registro.fechaCalificacion,
      calificacionPonderada: registro.calificacionPonderada,
      nivelRiesgo: registro.nivelRiesgo
    });
    setShowModal(true);
  };

  return (
    <div className="flex-1">
      {/* Encabezado institucional con título y botones */}
      <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">KYC – CONOZCA A SU CLIENTE</span>
        {!isView && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleNuevo}
              className="px-4 py-1.5 bg-[#00B0F0] text-white text-xs font-medium rounded hover:bg-[#0095D9]"
            >
              Nuevo
            </button>
            <button
              onClick={handleEliminar}
              className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs font-medium rounded hover:bg-gray-50"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Tabla de Registros KYC */}
      <div className="overflow-hidden border border-gray-300 bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border-b border-gray-300 px-2 py-1.5 text-center w-10">
                <input
                  type="checkbox"
                  checked={registros.length > 0 && selectedRegistros.length === registros.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="cursor-pointer"
                />
              </th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Fecha Registro</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Usuario</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Ingreso Mensual</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Actividad Económica</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Calificación</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-left text-xs font-medium text-gray-700">Nivel de Riesgo</th>
              <th className="border-b border-gray-300 px-2 py-1.5 text-center text-xs font-medium text-gray-700 w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={8} className="border-b border-gray-200 px-2 py-8 text-center text-xs text-gray-500">
                  No hay registros KYC. Haga clic en "Nuevo" para agregar uno.
                </td>
              </tr>
            ) : (
              registros.map(registro => (
                <tr 
                  key={registro.id} 
                  className={`hover:bg-gray-50 ${selectedRegistros.includes(registro.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="border-b border-gray-200 px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRegistros.includes(registro.id)}
                      onChange={(e) => handleSelectRegistro(registro.id, e.target.checked)}
                      className="cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">{registro.fechaRegistro}</td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">{registro.usuario}</td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">{registro.ingresoMensual}</td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">{registro.actividadEconomica}</td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-xs text-gray-700">{registro.calificacionPonderada} puntos</td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    <span className={`text-xs font-semibold ${
                      registro.nivelRiesgo === 'Alto' ? 'text-red-600' :
                      registro.nivelRiesgo === 'Medio' ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {registro.nivelRiesgo}
                    </span>
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerRegistro(registro);
                      }}
                      className="inline-flex items-center justify-center px-2 py-1 btn-accent-theme text-xs rounded hover:bg-accent-hover-theme"
                      title="Ver/Editar"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Institucional para Nuevo/Editar KYC */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header azul institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                {editingId !== null ? 'Editar Registro KYC' : 'Nuevo Registro KYC'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-gray-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            {/* Contenido del formulario */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Sección: Información KYC */}
              <div className="mb-6">
                <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
                  <h3 className="text-xs font-semibold text-gray-700">Información KYC</h3>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={kycData.isPep}
                        onChange={(e) => handleChange('isPep', e.target.checked)}
                        className="w-4 h-4"
                        disabled={isView}
                      />
                      <label className="text-xs text-gray-700">¿Es PEP o ha sido PEP en el último año? *</label>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs w-40 text-gray-700">Ingreso Mensual *</label>
                      <input
                        type="text"
                        value={kycData.ingresoMensual}
                        onChange={(e) => handleChange('ingresoMensual', e.target.value)}
                        placeholder="$0.00"
                        className={`flex-1 px-2 py-1 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                        disabled={isView}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs w-40 text-gray-700">Número de salarios por mes *</label>
                      <input
                        type="number"
                        value={kycData.numeroSalarios}
                        onChange={(e) => handleChange('numeroSalarios', e.target.value)}
                        placeholder="0"
                        className={`flex-1 px-2 py-1 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                        disabled={isView}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs w-40 text-gray-700">Actividad económica *</label>
                      <select
                        value={kycData.actividadEconomica}
                        onChange={(e) => handleChange('actividadEconomica', e.target.value)}
                        className={`flex-1 px-2 py-1 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                        disabled={isView}
                      >
                        <option value="">Seleccione...</option>
                        {ACTIVIDADES_ECONOMICAS.map((actividad) => (
                          <option key={actividad} value={actividad}>{actividad}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={kycData.familyPep}
                        onChange={(e) => handleChange('familyPep', e.target.checked)}
                        className="w-4 h-4"
                        disabled={isView}
                      />
                      <label className="text-xs text-gray-700">¿El cónyuge o familiares hasta segundo grado son PEP? *</label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={kycData.funcionariosPublicos}
                        onChange={(e) => handleChange('funcionariosPublicos', e.target.checked)}
                        className="w-4 h-4"
                        disabled={isView}
                      />
                      <label className="text-xs text-gray-700">Funcionarios públicos relacionados</label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={kycData.listasNegras}
                        onChange={(e) => handleChange('listasNegras', e.target.checked)}
                        className="w-4 h-4"
                        disabled={isView}
                      />
                      <label className="text-xs text-gray-700">Listas negras *</label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={kycData.otrosIngresos}
                        onChange={(e) => handleChange('otrosIngresos', e.target.checked)}
                        className="w-4 h-4"
                        disabled={isView}
                      />
                      <label className="text-xs text-gray-700">Percibe otros ingresos</label>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <label className="text-xs w-64 text-gray-700 pt-1">
                      Actividad de donde provienen los ingresos adicionales
                      {kycData.otrosIngresos && <span className="text-red-600 ml-1">*</span>}
                    </label>
                    <textarea
                      value={kycData.fuenteIngresosAdicionales}
                      onChange={(e) => handleChange('fuenteIngresosAdicionales', e.target.value)}
                      placeholder="Describa la actividad..."
                      rows={3}
                      className={`flex-1 px-2 py-1 text-xs border border-gray-300 rounded ${isView ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                      disabled={isView}
                    />
                  </div>
                </div>
              </div>

              {/* Sección: Calificación de Riesgo */}
              <div className="mb-6">
                <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
                  <h3 className="text-xs font-semibold text-gray-700">Calificación de Riesgo</h3>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-3 rounded border border-gray-200">
                    <p className="font-medium text-gray-700 mb-2">Ponderadores:</p>
                    <p>• Actividad económica: 25%</p>
                    <p>• Residencia: 15%</p>
                    <p>• Nacionalidad: 15%</p>
                    <p>• Tipo de persona: 20%</p>
                    <p>• PEP / Listas negras: 25%</p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-40 text-gray-700">Calificación ponderada</label>
                      <div className="flex-1 px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded border border-gray-300">
                        {kycData.calificacionPonderada} puntos
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs w-40 text-gray-700">Nivel de riesgo</label>
                      <div className={`flex-1 px-2 py-1 text-xs font-semibold rounded border ${
                        kycData.nivelRiesgo === 'Alto' 
                          ? 'text-red-600 bg-red-50 border-red-300' :
                        kycData.nivelRiesgo === 'Medio' 
                          ? 'text-orange-600 bg-orange-50 border-orange-300' :
                          'text-green-600 bg-green-50 border-green-300'
                      }`}>
                        {kycData.nivelRiesgo}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    {!isView && (
                      <button
                        onClick={calcularRiesgo}
                        className="px-5 py-2 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium"
                      >
                        Calcular Riesgo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                {isView ? 'Cerrar' : 'Cancelar'}
              </button>
              {!isView && (
                <button
                  onClick={handleGuardarModal}
                  className="px-5 py-2 text-sm btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium"
                >
                  Guardar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}