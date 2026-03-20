import { useState, useEffect } from 'react';
import { TabExpedientes } from './TabExpedientes';
import { TabAutorizacion } from './TabAutorizacion';
import { TabGarantias } from './TabGarantias';
import { TabCargos } from './TabCargos';
import { TabAvisos } from './TabAvisos';
import { TabSolicitudesExtraordinarias } from './TabSolicitudesExtraordinarias';

type FormMode = 'nuevo' | 'editar' | 'ver';

interface AltaCreditoDefaultProps {
  onBack: () => void;
  onSave?: (creditoData: any) => void;
  mode: FormMode;
  credito?: any;
}

interface FormData {
  // BLOQUE 1 - DATOS CLIENTE
  noCredito: string;
  cliente: string;
  fechaCredito: string;
  empresaFondeadora: string;
  sucursal: string;
  montoSolicitado: string;
  
  // BLOQUE 2 - DATOS PRODUCTO
  lineaProducto: string;
  sublinea: string;
  producto: string;
  periodo: string;
  plazos: string;
  destinoCredito: string;
  
  // BLOQUE 3 - DATOS ESTATUS
  estatusPago: string;
  estatusCartera: string;
  estatusCredito: string;
  plazoAutorizado: string;
  montoAutorizado: string;
  tasaAutorizada: string;
  fechaInicio: string;
  fechaFin: string;
  
  // BLOQUE 4 - DATOS DEL CLIENTE (READ ONLY)
  estatusSIC: string;
  estatusListaNegra: string;
  estatusCliente: string;
  moneda: string;
  direccionPrincipal: string;
  
  // BLOQUE 5 - FUNCIONALIDAD ENRIQUECIDA
  scoringCrediticio: string;
  capacidadPago: string;
  verificacionDocumental: boolean;
  nivelesAutorizacion: string;
  condicionesCredito: string;
  controlDesembolsos: boolean;
  indicadoresCalidad: string;
  controlExcepciones: string;
  
  // BLOQUE MONTOS Y PLAZOS
  plazoMinimo: string;
  plazoMaximo: string;
  montoMinimo: string;
  montoMaximo: string;
  alertaExcepcion: boolean;
  resultadoCapacidadPago: string;
  
  // BLOQUE TASAS
  tasaMinima: string;
  tasaMaxima: string;
  alertaRiesgo: boolean;
  perfilRiesgo: string;
}

export function AltaCreditoDefault({ onBack, onSave, mode }: AltaCreditoDefaultProps) {
  const [activeTab, setActiveTab] = useState('default');
  const [camposEditables, setCamposEditables] = useState(true);
  const [mostrarGuardar, setMostrarGuardar] = useState(true);
  const [tablaAmortizacion, setTablaAmortizacion] = useState<any[]>([]);
  const [mostrarModalSimulador, setMostrarModalSimulador] = useState(false);
  const [mostrarModalNuevoArchivo, setMostrarModalNuevoArchivo] = useState(false);
  const [archivosExpediente, setArchivosExpediente] = useState<any[]>([]);
  const [nuevoArchivo, setNuevoArchivo] = useState({
    tipoDocumento: '',
    archivo: '',
    descripcion: '',
    estatus: 'Pendiente',
    notas: ''
  });
  
  const [formData, setFormData] = useState<FormData>({
    // BLOQUE 1
    noCredito: 'CRE-000001',
    cliente: mode === 'nuevo' ? '' : 'CLI-001 Juan Pedro Pérez',
    fechaCredito: mode === 'nuevo' ? '' : '07/08/2023',
    empresaFondeadora: mode === 'nuevo' ? '' : 'Credito Mx',
    sucursal: mode === 'nuevo' ? '' : 'CDMX',
    montoSolicitado: mode === 'nuevo' ? '' : '$17,000.00',
    
    // BLOQUE 2
    lineaProducto: 'Crédito',
    sublinea: mode === 'nuevo' ? '' : 'Crédito minorista',
    producto: mode === 'nuevo' ? '' : 'Credito personal',
    periodo: mode === 'nuevo' ? '' : 'Mensual',
    plazos: mode === 'nuevo' ? '' : '12',
    destinoCredito: mode === 'nuevo' ? '' : 'El cliente solicita una ampliación para la ampliación de la casa de campo',
    
    // BLOQUE 3
    estatusPago: 'Pendiente',
    estatusCartera: 'Vigente',
    estatusCredito: 'Pendiente',
    plazoAutorizado: mode === 'nuevo' ? '' : '12',
    montoAutorizado: mode === 'nuevo' ? '' : '$12,000.00',
    tasaAutorizada: mode === 'nuevo' ? '' : '15.5%',
    fechaInicio: mode === 'nuevo' ? '' : '02/08/2023',
    fechaFin: mode === 'nuevo' ? '' : '02/07/2024',
    
    // BLOQUE 4
    estatusSIC: mode === 'nuevo' ? '' : 'Positivo',
    estatusListaNegra: mode === 'nuevo' ? '' : 'Negativo',
    estatusCliente: mode === 'nuevo' ? '' : 'Activo',
    moneda: mode === 'nuevo' ? '' : 'MXN',
    direccionPrincipal: mode === 'nuevo' ? '' : 'Calle Reforma 123, Col. Centro, CDMX',
    
    // BLOQUE 5
    scoringCrediticio: mode === 'nuevo' ? '' : '750',
    capacidadPago: mode === 'nuevo' ? '' : '$5,000.00',
    verificacionDocumental: mode === 'nuevo' ? false : true,
    nivelesAutorizacion: mode === 'nuevo' ? '' : 'Nivel 2 - Gerente',
    condicionesCredito: mode === 'nuevo' ? '' : 'Tasa fija, pagos mensuales, sin penalización por pago anticipado',
    controlDesembolsos: mode === 'nuevo' ? false : true,
    indicadoresCalidad: mode === 'nuevo' ? '' : '85%',
    controlExcepciones: '',
    
    // BLOQUE MONTOS Y PLAZOS
    plazoMinimo: mode === 'nuevo' ? '' : '6',
    plazoMaximo: mode === 'nuevo' ? '' : '36',
    montoMinimo: mode === 'nuevo' ? '' : '$5,000.00',
    montoMaximo: mode === 'nuevo' ? '' : '$20,000.00',
    alertaExcepcion: mode === 'nuevo' ? false : true,
    resultadoCapacidadPago: mode === 'nuevo' ? '' : 'Aprobado',
    
    // BLOQUE TASAS
    tasaMinima: mode === 'nuevo' ? '' : '10.0%',
    tasaMaxima: mode === 'nuevo' ? '' : '20.0%',
    alertaRiesgo: mode === 'nuevo' ? false : true,
    perfilRiesgo: mode === 'nuevo' ? '' : 'Medio',
  });

  // Datos del crédito para el tab de Autorización
  const datosCredito = {
    montoSolicitado: formData.montoSolicitado,
    montoAutorizado: formData.montoAutorizado,
    plazo: formData.plazoAutorizado,
    tasa: formData.tasaAutorizada,
    cliente: formData.cliente,
    producto: formData.producto
  };

  useEffect(() => {
    if (mode === 'ver') {
      setCamposEditables(false);
      setMostrarGuardar(false);
    } else {
      setCamposEditables(true);
      setMostrarGuardar(true);
    }
    
    // Cargar archivos de ejemplo en modo editar o ver
    if (mode !== 'nuevo') {
      setArchivosExpediente([
        {
          id: 1,
          fechaRegistro: '13/01/2025 11:15',
          usuario: 'Juan Pérez',
          tipoDocumento: 'Identificación oficial',
          archivo: 'INE_Cliente.pdf',
          descripcion: 'Identificación oficial del cliente',
          estatus: 'Aprobado',
          notas: 'Documento válido'
        },
        {
          id: 2,
          fechaRegistro: '13/01/2025 11:15',
          usuario: 'Maria Garcia',
          tipoDocumento: 'Comprobante de domicilio',
          archivo: 'CFE_Enero2025.pdf',
          descripcion: 'Comprobante de domicilio',
          estatus: 'Pendiente',
          notas: 'CFE del mes actual'
        }
      ]);
    }
  }, [mode]);

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    if (!camposEditables) return;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGuardar = () => {
    if (onSave) {
      onSave(formData);
    }
    alert('Crédito guardado exitosamente');
  };

  const handleGenerarContrato = () => {
    if (!formData.verificacionDocumental) {
      alert('No se puede generar el contrato. Expediente incompleto.');
      return;
    }
    alert('Generando contrato PDF...');
  };

  const simularAmortizacion = () => {
    // Extraer valores numéricos
    const montoStr = formData.montoAutorizado.replace(/[$,]/g, '');
    const monto = parseFloat(montoStr) || 12000;
    
    const tasaStr = formData.tasaAutorizada.replace(/%/g, '');
    const tasaAnual = parseFloat(tasaStr) || 15;
    
    const plazo = parseInt(formData.plazoAutorizado) || 4;
    
    // Calcular tasa mensual
    const tasaMensual = tasaAnual / 12 / 100; // i = 15/12/100 = 0.0125
    
    // Calcular cuota fija usando sistema francés
    // Cuota = C × (i / (1 - (1 + i)^-n))
    const factor = tasaMensual / (1 - Math.pow(1 + tasaMensual, -plazo));
    const cuotaSinIVA = monto * factor;
    
    // Generar tabla de amortización
    const tabla = [];
    let saldoActual = monto;
    const fechaInicio = new Date(2023, 8, 25); // 25/09/2023
    
    for (let i = 1; i <= plazo; i++) {
      // Calcular interés del periodo
      const interes = saldoActual * tasaMensual;
      
      // Calcular IVA sobre interés
      const iva = interes * 0.16;
      
      // Calcular capital amortizado
      const capital = cuotaSinIVA - interes;
      
      // Calcular pago mínimo (total)
      const pagoMinimo = interes + iva + capital;
      
      // Calcular fecha de vencimiento
      const fechaVencimiento = new Date(fechaInicio);
      fechaVencimiento.setMonth(fechaInicio.getMonth() + i);
      const dia = fechaVencimiento.getDate().toString().padStart(2, '0');
      const mes = (fechaVencimiento.getMonth() + 1).toString().padStart(2, '0');
      const anio = fechaVencimiento.getFullYear();
      const fechaFormateada = `${dia}/${mes}/${anio}`;
      
      // Agregar fila a la tabla
      tabla.push({
        noPago: i,
        saldoCapital: `$${saldoActual.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')}`,
        interes: `$${interes.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')}`,
        iva: `$${iva.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')}`,
        capital: `$${capital.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')}`,
        pagoMinimo: `$${pagoMinimo.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')}`,
        fechaVencimiento: fechaFormateada
      });
      
      // Actualizar saldo para siguiente periodo
      saldoActual = saldoActual - capital;
    }
    
    setTablaAmortizacion(tabla);
    setMostrarModalSimulador(true);
  };

  const tabs = [
    { id: 'default', label: 'Default' },
    { id: 'montos-plazos', label: 'Montos/Plazos' },
    { id: 'tasas', label: 'Tasas' },
    { id: 'amortizaciones', label: 'Amortizaciones' },
    { id: 'expedientes', label: 'Expedientes Electrónicos' },
    { id: 'autorizacion', label: 'Autorización' },
    { id: 'garantias', label: 'Garantías' },
    { id: 'cargos', label: 'Cargos' },
    { id: 'avisos', label: 'Avisos' },
    { id: 'solicitudes-extraordinarias', label: 'Solicitudes Extraordinarias' },
  ];

  const inputClass = mode === 'nuevo' 
    ? "w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white" 
    : "w-full px-2 py-1 text-xs border-b border-gray-300 bg-transparent focus:outline-none focus:border-[#2E5C91]";

  const disabledInputClass = "w-full px-2 py-1 text-xs bg-gray-100 text-gray-600 border border-gray-300 rounded";

  const readOnlyTextClass = "w-full px-2 py-1 text-xs text-gray-700 bg-transparent";

  return (
    <div className="bg-white min-h-screen">
      {/* Header con título */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="stroke-accent-theme" strokeWidth="1.5">
            <rect x="3" y="4" width="14" height="12" rx="1"/>
            <path d="M7 8h6M7 11h4"/>
          </svg>
          <span className="text-base font-medium text-gray-800">Créditos</span>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {mostrarGuardar && (
            <button 
              onClick={handleGuardar}
              className="px-6 py-1.5 btn-accent-theme text-white rounded text-xs hover:bg-accent-hover-theme font-normal"
            >
              Guardar
            </button>
          )}
          <button 
            onClick={onBack}
            className="px-6 py-1.5 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Contenido principal - 3 columnas */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-3 gap-4">
          {/* COLUMNA 1 - DATOS CLIENTE */}
          <div className="space-y-3">
            <div className="bg-[#E7E6E6] px-3 py-1.5">
              <h3 className="text-xs text-gray-700">Datos Cliente</h3>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">NO. DE CRÉDITO</label>
                <input 
                  type="text" 
                  value={formData.noCredito}
                  disabled
                  className={disabledInputClass}
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">CLIENTE <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.cliente || 'N/A'}</div>
                ) : (
                  <select
                    value={formData.cliente}
                    onChange={(e) => handleInputChange('cliente', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elige...</option>
                    <option value="CLI-001 Juan Pedro Pérez">CLI-001 Juan Pedro Pérez</option>
                    <option value="CLI-002 María González">CLI-002 María González</option>
                    <option value="CLI-003 Pedro Martínez">CLI-003 Pedro Martínez</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">FECHA DE CRÉDITO <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.fechaCredito || 'N/A'}</div>
                ) : (
                  <input
                    type="text"
                    value={formData.fechaCredito}
                    onChange={(e) => handleInputChange('fechaCredito', e.target.value)}
                    className={inputClass}
                    placeholder="dd/mm/aaaa"
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">EMPRESA FONDEADORA <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.empresaFondeadora || 'N/A'}</div>
                ) : (
                  <select
                    value={formData.empresaFondeadora}
                    onChange={(e) => handleInputChange('empresaFondeadora', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elige...</option>
                    <option value="Credito Mx">Credito Mx</option>
                    <option value="Fondeadora Principal">Fondeadora Principal</option>
                    <option value="Fondeadora Secundaria">Fondeadora Secundaria</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">SUCURSAL <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.sucursal || 'N/A'}</div>
                ) : (
                  <select
                    value={formData.sucursal}
                    onChange={(e) => handleInputChange('sucursal', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elige...</option>
                    <option value="CDMX">CDMX</option>
                    <option value="Guadalajara">Guadalajara</option>
                    <option value="Monterrey">Monterrey</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">MONTO SOLICITADO <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.montoSolicitado || 'N/A'}</div>
                ) : (
                  <input
                    type="text"
                    value={formData.montoSolicitado}
                    onChange={(e) => handleInputChange('montoSolicitado', e.target.value)}
                    className={inputClass}
                    placeholder="$0.00"
                  />
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA 2 - DATOS PRODUCTO */}
          <div className="space-y-3">
            <div className="bg-[#E7E6E6] px-3 py-1.5">
              <h3 className="text-xs text-gray-700">Datos Productos</h3>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">LÍNEA PRODUCTO <span className="text-red-600">*</span></label>
                <input 
                  type="text" 
                  value={formData.lineaProducto}
                  disabled
                  className={disabledInputClass}
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">SUBLÍNEA <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.sublinea || 'N/A'}</div>
                ) : (
                  <select
                    value={formData.sublinea}
                    onChange={(e) => handleInputChange('sublinea', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elige...</option>
                    <option value="Crédito minorista">Crédito minorista</option>
                    <option value="Crédito empresarial">Crédito empresarial</option>
                    <option value="Crédito corporativo">Crédito corporativo</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">PRODUCTO <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.producto || 'N/A'}</div>
                ) : (
                  <select
                    value={formData.producto}
                    onChange={(e) => handleInputChange('producto', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elige...</option>
                    <option value="Credito personal">Credito personal</option>
                    <option value="Crédito automotriz">Crédito automotriz</option>
                    <option value="Crédito hipotecario">Crédito hipotecario</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">PERIODO <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.periodo || 'N/A'}</div>
                ) : (
                  <select
                    value={formData.periodo}
                    onChange={(e) => handleInputChange('periodo', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elige...</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Quincenal">Quincenal</option>
                    <option value="Mensual">Mensual</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">PLAZOS <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.plazos || 'N/A'}</div>
                ) : (
                  <select
                    value={formData.plazos}
                    onChange={(e) => handleInputChange('plazos', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elige...</option>
                    <option value="6">6</option>
                    <option value="12">12</option>
                    <option value="18">18</option>
                    <option value="24">24</option>
                    <option value="36">36</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">DESTINO DEL CRÉDITO</label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.destinoCredito || 'N/A'}</div>
                ) : (
                  <textarea
                    value={formData.destinoCredito}
                    onChange={(e) => handleInputChange('destinoCredito', e.target.value)}
                    className={inputClass}
                    rows={3}
                    maxLength={255}
                    placeholder="Especifique el destino del crédito..."
                  />
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA 3 - DATOS ESTATUS */}
          <div className="space-y-3">
            <div className="bg-[#E7E6E6] px-3 py-1.5">
              <h3 className="text-xs text-gray-700">Datos Estatus</h3>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">ESTATUS DE PAGO <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.estatusPago}</div>
                ) : (
                  <select
                    value={formData.estatusPago}
                    onChange={(e) => handleInputChange('estatusPago', e.target.value)}
                    className={inputClass}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Al Corriente">Al Corriente</option>
                    <option value="Vencido">Vencido</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">ESTATUS DE CARTERA <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.estatusCartera}</div>
                ) : (
                  <select
                    value={formData.estatusCartera}
                    onChange={(e) => handleInputChange('estatusCartera', e.target.value)}
                    className={inputClass}
                  >
                    <option value="Vigente">Vigente</option>
                    <option value="Vencida">Vencida</option>
                    <option value="Castigada">Castigada</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">ESTATUS CRÉDITO <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.estatusCredito}</div>
                ) : (
                  <select
                    value={formData.estatusCredito}
                    onChange={(e) => handleInputChange('estatusCredito', e.target.value)}
                    className={inputClass}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Autorizado">Autorizado</option>
                    <option value="Rechazado">Rechazado</option>
                    <option value="Dispersado">Dispersado</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">PLAZO AUTORIZADO</label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.plazoAutorizado || 'N/A'}</div>
                ) : (
                  <input
                    type="text"
                    value={formData.plazoAutorizado}
                    onChange={(e) => handleInputChange('plazoAutorizado', e.target.value)}
                    className={inputClass}
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">MONTO AUTORIZADO</label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.montoAutorizado || 'N/A'}</div>
                ) : (
                  <input
                    type="text"
                    value={formData.montoAutorizado}
                    onChange={(e) => handleInputChange('montoAutorizado', e.target.value)}
                    className={inputClass}
                    placeholder="$0.00"
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">TASA AUTORIZADA</label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.tasaAutorizada || 'N/A'}</div>
                ) : (
                  <input
                    type="text"
                    value={formData.tasaAutorizada}
                    onChange={(e) => handleInputChange('tasaAutorizada', e.target.value)}
                    className={inputClass}
                    maxLength={5}
                    placeholder="0.00%"
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">FECHA INICIO</label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.fechaInicio || 'N/A'}</div>
                ) : (
                  <input
                    type="text"
                    value={formData.fechaInicio}
                    onChange={(e) => handleInputChange('fechaInicio', e.target.value)}
                    className={inputClass}
                    placeholder="dd/mm/aaaa"
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">FECHA FIN</label>
                {!camposEditables ? (
                  <div className={readOnlyTextClass}>{formData.fechaFin || 'N/A'}</div>
                ) : (
                  <input
                    type="text"
                    value={formData.fechaFin}
                    onChange={(e) => handleInputChange('fechaFin', e.target.value)}
                    className={inputClass}
                    placeholder="dd/mm/aaaa"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TABS INFERIORES */}
        <div className="mt-6">
          <div className="bg-primary-theme">
            <div className="flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-[11px] whitespace-nowrap text-white transition-colors ${
                    activeTab === tab.id
                      ? 'btn-primary-theme font-semibold'
                      : ''
                  }`}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = 'var(--theme-primary-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = '';
                    }
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contenido del tab activo */}
          <div className="bg-white border border-gray-300 border-t-0 min-h-[250px]">
            {activeTab === 'default' && (
              <div className="p-4">
                {/* BLOQUE 4 - DATOS DEL CLIENTE (READ ONLY) */}
                <div className="mb-4">
                  <div className="bg-primary-tint-theme px-3 py-1.5 border border-gray-300 mb-3">
                    <h3 className="text-xs font-semibold text-gray-800">Datos del Cliente</h3>
                  </div>

                  <div className="grid grid-cols-5 gap-4 text-xs">
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">ESTATUS SIC</label>
                      <div className={readOnlyTextClass}>{formData.estatusSIC || 'N/A'}</div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">ESTATUS LISTA NEGRA</label>
                      <div className={readOnlyTextClass}>{formData.estatusListaNegra || 'N/A'}</div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">ESTATUS DEL CLIENTE</label>
                      <div className={readOnlyTextClass}>{formData.estatusCliente || 'N/A'}</div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">MONEDA</label>
                      <select 
                        value={formData.moneda}
                        disabled
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option value="">Elige...</option>
                        <option value="MXN">MXN</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>

                    <div className="col-span-1">
                      <label className="block text-[10px] text-gray-600 mb-0.5">DIRECCIÓN PRINCIPAL</label>
                      <div className="w-full px-2 py-3 text-xs bg-gray-100 border border-gray-300 rounded min-h-[60px] text-gray-600">
                        {formData.direccionPrincipal || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BLOQUE 5 - FUNCIONALIDAD ENRIQUECIDA */}
                <div>
                  <div className="bg-primary-tint-theme px-3 py-1.5 border border-gray-300 mb-3">
                    <h3 className="text-xs font-semibold text-gray-800">Funcionalidad Enriquecida</h3>
                  </div>

                  <div className="space-y-3">
                    {/* Fila 1 */}
                    <div className="grid grid-cols-4 gap-4 text-xs">
                      <div>
                        <label className="block text-[10px] text-gray-600 mb-0.5">SCORING CREDITICIO</label>
                        <div className={readOnlyTextClass}>{formData.scoringCrediticio || 'N/A'}</div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-600 mb-0.5">CAPACIDAD DE PAGO</label>
                        <div className={readOnlyTextClass}>{formData.capacidadPago || 'N/A'}</div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-600 mb-0.5">INDICADORES DE CALIDAD</label>
                        <div className={readOnlyTextClass}>{formData.indicadoresCalidad || 'N/A'}</div>
                      </div>

                      <div className="flex items-center gap-2 pt-4">
                        <input
                          type="checkbox"
                          checked={formData.verificacionDocumental}
                          onChange={(e) => handleInputChange('verificacionDocumental', e.target.checked)}
                          className="w-4 h-4"
                          disabled={!camposEditables}
                        />
                        <label className="text-[10px] text-gray-600">VERIFICACIÓN DOCUMENTAL</label>
                      </div>
                    </div>

                    {/* Fila 2 */}
                    <div className="grid grid-cols-4 gap-4 text-xs">
                      <div>
                        <label className="block text-[10px] text-gray-600 mb-0.5">NIVELES DE AUTORIZACIÓN</label>
                        {!camposEditables ? (
                          <div className={readOnlyTextClass}>{formData.nivelesAutorizacion || 'N/A'}</div>
                        ) : (
                          <select
                            value={formData.nivelesAutorizacion}
                            onChange={(e) => handleInputChange('nivelesAutorizacion', e.target.value)}
                            className={inputClass}
                          >
                            <option value="">Elige...</option>
                            <option value="Nivel 1 - Ejecutivo">Nivel 1 - Ejecutivo</option>
                            <option value="Nivel 2 - Gerente">Nivel 2 - Gerente</option>
                            <option value="Nivel 3 - Director">Nivel 3 - Director</option>
                          </select>
                        )}
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-gray-600 mb-0.5">CONDICIONES DE CRÉDITO</label>
                        {!camposEditables ? (
                          <div className={readOnlyTextClass}>{formData.condicionesCredito || 'N/A'}</div>
                        ) : (
                          <textarea
                            value={formData.condicionesCredito}
                            onChange={(e) => handleInputChange('condicionesCredito', e.target.value)}
                            className={inputClass}
                            rows={2}
                            placeholder="Especifique las condiciones..."
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.controlDesembolsos}
                            onChange={(e) => handleInputChange('controlDesembolsos', e.target.checked)}
                            className="w-4 h-4"
                            disabled={!camposEditables}
                          />
                          <label className="text-[10px] text-gray-600">CONTROL DE DESEMBOLSOS</label>
                        </div>

                        <button
                          onClick={handleGenerarContrato}
                          className="w-full px-3 py-1.5 btn-accent-theme text-white rounded text-xs hover:bg-accent-hover-theme disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!camposEditables || !formData.verificacionDocumental}
                        >
                          GENERAR CONTRATO
                        </button>
                      </div>
                    </div>

                    {/* Fila 3 */}
                    <div className="grid grid-cols-1 gap-4 text-xs">
                      <div>
                        <label className="block text-[10px] text-gray-600 mb-0.5">CONTROL DE EXCEPCIONES</label>
                        {!camposEditables ? (
                          <div className={readOnlyTextClass}>{formData.controlExcepciones || 'N/A'}</div>
                        ) : (
                          <textarea
                            value={formData.controlExcepciones}
                            onChange={(e) => handleInputChange('controlExcepciones', e.target.value)}
                            className={inputClass}
                            rows={2}
                            placeholder="Justificación de condiciones especiales..."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Otros tabs */}
            {activeTab === 'montos-plazos' && (
              <div className="p-4">
                {/* TÍTULO DE SECCIÓN */}
                <div className="bg-[#E7E6E6] px-3 py-1.5 mb-4">
                  <h3 className="text-xs text-gray-700">Montos/Plazos</h3>
                </div>

                {/* CONTENIDO EN DOS COLUMNAS */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {/* COLUMNA IZQUIERDA - PLAZOS */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">PLAZO MÍNIMO</label>
                      <input 
                        type="text" 
                        value={formData.plazoMinimo}
                        disabled
                        className={disabledInputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">PLAZO AUTORIZADO <span className="text-red-600">*</span></label>
                      {!camposEditables ? (
                        <div className={readOnlyTextClass}>{formData.plazoAutorizado || 'N/A'}</div>
                      ) : (
                        <input
                          type="text"
                          value={formData.plazoAutorizado}
                          onChange={(e) => handleInputChange('plazoAutorizado', e.target.value)}
                          className={inputClass}
                          placeholder="0"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">PLAZO MÁXIMO</label>
                      <input 
                        type="text" 
                        value={formData.plazoMaximo}
                        disabled
                        className={disabledInputClass}
                      />
                    </div>
                  </div>

                  {/* COLUMNA DERECHA - MONTOS */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">MONTO MÍNIMO</label>
                      <input 
                        type="text" 
                        value={formData.montoMinimo}
                        disabled
                        className={disabledInputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">MONTO AUTORIZADO <span className="text-red-600">*</span></label>
                      {!camposEditables ? (
                        <div className={readOnlyTextClass}>{formData.montoAutorizado || 'N/A'}</div>
                      ) : (
                        <input
                          type="text"
                          value={formData.montoAutorizado}
                          onChange={(e) => handleInputChange('montoAutorizado', e.target.value)}
                          className={inputClass}
                          placeholder="$0.00"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">MONTO MÁXIMO</label>
                      <input 
                        type="text" 
                        value={formData.montoMaximo}
                        disabled
                        className={disabledInputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* FUNCIONALIDAD ENRIQUECIDA */}
                <div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    {/* SIMULADOR DE CUOTAS */}
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-1.5">SIMULADOR DE CUOTAS</label>
                      <button
                        onClick={simularAmortizacion}
                        className="w-full px-4 py-1.5 btn-accent-theme text-white rounded text-xs hover:bg-accent-hover-theme"
                        disabled={!camposEditables}
                      >
                        Simular
                      </button>
                    </div>

                    {/* VALIDACIÓN DE CAPACIDAD DE PAGO */}
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">VALIDACIÓN DE CAPACIDAD DE PAGO</label>
                      <div className={`${readOnlyTextClass} font-semibold ${
                        formData.resultadoCapacidadPago === 'Aprobado' ? 'text-green-600' : 
                        formData.resultadoCapacidadPago === 'Rechazado' ? 'text-red-600' : 
                        'text-yellow-600'
                      }`}>
                        {formData.resultadoCapacidadPago || 'N/A'}
                      </div>
                    </div>

                    {/* ALERTA DE EXCEPCIÓN */}
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        checked={formData.alertaExcepcion}
                        onChange={(e) => {
                          handleInputChange('alertaExcepcion', e.target.checked);
                          if (e.target.checked) {
                            alert('ALERTA: Monto o plazo autorizado excede el máximo permitido. Se requiere validación adicional por supervisor.');
                          }
                        }}
                        className="w-4 h-4"
                        disabled={!camposEditables}
                      />
                      <label className="text-[10px] text-gray-600">ALERTA DE EXCEPCIÓN</label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tasas' && (
              <div className="p-4">
                {/* TÍTULO DE SECCIÓN */}
                <div className="bg-[#E7E6E6] px-3 py-1.5 mb-4">
                  <h3 className="text-xs text-gray-700">Tasas</h3>
                </div>

                {/* CONTENIDO EN TRES CAMPOS VERTICALES */}
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">TASA MÍNIMA</label>
                    <input 
                      type="text" 
                      value={formData.tasaMinima}
                      disabled
                      className={disabledInputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">TASA AUTORIZADA <span className="text-red-600">*</span></label>
                    {!camposEditables ? (
                      <div className={readOnlyTextClass}>{formData.tasaAutorizada || 'N/A'}</div>
                    ) : (
                      <input
                        type="text"
                        value={formData.tasaAutorizada}
                        onChange={(e) => handleInputChange('tasaAutorizada', e.target.value)}
                        className={inputClass}
                        placeholder="0.00%"
                        maxLength={5}
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">TASA MÁXIMA</label>
                    <input 
                      type="text" 
                      value={formData.tasaMaxima}
                      disabled
                      className={disabledInputClass}
                    />
                  </div>
                </div>

                {/* CAMPOS ENRIQUECIDOS */}
                <div className="grid grid-cols-3 gap-4 text-xs">
                  {/* SIMULADOR DE INTERÉS */}
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-1.5">SIMULADOR DE INTERÉS</label>
                    <button
                      onClick={() => alert('Modal de simulación: Interés total, interés mensual, comparativo con tasa mínima y máxima')}
                      className="w-full px-4 py-1.5 btn-accent-theme text-white rounded text-xs hover:bg-accent-hover-theme"
                      disabled={!camposEditables}
                    >
                      Simular
                    </button>
                  </div>

                  {/* PERFIL DE RIESGO */}
                  <div>
                    <label className="block text-[10px] text-gray-600 mb-0.5">PERFIL DE RIESGO</label>
                    <div className={`${readOnlyTextClass} font-semibold ${
                      formData.perfilRiesgo === 'Bajo' ? 'text-green-600' : 
                      formData.perfilRiesgo === 'Alto' ? 'text-red-600' : 
                      'text-yellow-600'
                    }`}>
                      {formData.perfilRiesgo || 'N/A'}
                    </div>
                  </div>

                  {/* ALERTA DE RIESGO */}
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      checked={formData.alertaRiesgo}
                      onChange={(e) => {
                        handleInputChange('alertaRiesgo', e.target.checked);
                        if (e.target.checked) {
                          alert('ALERTA: Tasa autorizada fuera del rango permitido. Se requiere validación adicional por supervisor.');
                        }
                      }}
                      className="w-4 h-4"
                      disabled={!camposEditables}
                    />
                    <label className="text-[10px] text-gray-600">ALERTA DE RIESGO</label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'amortizaciones' && (
              <div className="p-4">
                {/* SUBTÍTULO CON BOTÓN */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-gray-800">AMORTIZACIÓN</h3>
                  <button
                    className="px-6 py-1.5 btn-accent-theme text-white rounded text-xs hover:bg-accent-hover-theme"
                    onClick={simularAmortizacion}
                  >
                    Simular
                  </button>
                </div>

                {/* TABLA DE AMORTIZACIONES */}
                <div className="overflow-hidden border border-gray-300 rounded">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-200 border-b border-gray-300">
                        <th className="px-3 py-2 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">No. Pago</th>
                        <th className="px-3 py-2 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">Saldo Capital</th>
                        <th className="px-3 py-2 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">Interés</th>
                        <th className="px-3 py-2 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">IVA</th>
                        <th className="px-3 py-2 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">Capital</th>
                        <th className="px-3 py-2 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">Pago Mínimo</th>
                        <th className="px-3 py-2 text-center font-semibold text-[11px] text-gray-700">Fecha de Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {tablaAmortizacion.map((row) => (
                        <tr key={row.noPago} className="border-b border-gray-300">
                          <td className="px-3 py-2.5 text-center text-gray-700 border-r border-gray-300">{row.noPago}</td>
                          <td className="px-3 py-2.5 text-center text-gray-700 border-r border-gray-300">{row.saldoCapital}</td>
                          <td className="px-3 py-2.5 text-center text-gray-700 border-r border-gray-300">{row.interes}</td>
                          <td className="px-3 py-2.5 text-center text-gray-700 border-r border-gray-300">{row.iva}</td>
                          <td className="px-3 py-2.5 text-center text-gray-700 border-r border-gray-300">{row.capital}</td>
                          <td className="px-3 py-2.5 text-center text-gray-700 border-r border-gray-300">{row.pagoMinimo}</td>
                          <td className="px-3 py-2.5 text-center text-gray-700">{row.fechaVencimiento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'expedientes' && (
              <TabExpedientes
                camposEditables={camposEditables}
                archivosExpediente={archivosExpediente}
                setArchivosExpediente={setArchivosExpediente}
                setMostrarModalNuevoArchivo={setMostrarModalNuevoArchivo}
              />
            )}

            {activeTab === 'autorizacion' && (
              <TabAutorizacion
                mode={mode}
                camposEditables={camposEditables}
                archivosExpediente={archivosExpediente}
                datosCredito={datosCredito}
              />
            )}

            {activeTab === 'garantias' && (
              <TabGarantias
                mode={mode}
                camposEditables={camposEditables}
              />
            )}

            {activeTab === 'cargos' && (
              <TabCargos
                mode={mode}
                camposEditables={camposEditables}
              />
            )}

            {activeTab === 'avisos' && (
              <TabAvisos
                mode={mode}
                creditoId={1}
              />
            )}

            {activeTab === 'solicitudes-extraordinarias' && (
              <TabSolicitudesExtraordinarias
                mode={mode}
                creditoId={1}
              />
            )}

            {activeTab !== 'default' && activeTab !== 'montos-plazos' && activeTab !== 'tasas' && activeTab !== 'amortizaciones' && activeTab !== 'expedientes' && activeTab !== 'autorizacion' && activeTab !== 'garantias' && activeTab !== 'cargos' && activeTab !== 'avisos' && activeTab !== 'solicitudes-extraordinarias' && (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">Contenido del tab "{tabs.find(t => t.id === activeTab)?.label}"</p>
                <p className="text-xs mt-2">Esta sección está en desarrollo</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de simulación de amortizaciones */}
      {mostrarModalSimulador && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]"
          onClick={() => setMostrarModalSimulador(false)}
        >
          <div 
            className="bg-white rounded-lg border-2 border-gray-400 shadow-2xl" 
            style={{ width: '950px', maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado del modal */}
            <div className="border-b-2 border-gray-300 px-6 py-4 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800">Simulación de Amortización</h2>
              <p className="text-xs text-gray-600 mt-1">Resultado calculado con base en los datos del crédito</p>
            </div>

            {/* Contenido del modal - Tabla */}
            <div className="p-6 bg-white">
              <div className="overflow-hidden border-2 border-gray-300 rounded">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-200 border-b-2 border-gray-300">
                      <th className="px-3 py-2.5 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">No. Pago</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">Saldo Capital</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">Interés</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">IVA</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">Capital</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-[11px] text-gray-700 border-r border-gray-300">Pago Mínimo</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-[11px] text-gray-700">Fecha de Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {tablaAmortizacion.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-xs">
                          Haz clic en "Simular" para generar la tabla de amortización
                        </td>
                      </tr>
                    ) : (
                      tablaAmortizacion.map((row) => (
                        <tr key={row.noPago} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-3 text-center text-gray-700 border-r border-gray-300">{row.noPago}</td>
                          <td className="px-3 py-3 text-center text-gray-700 border-r border-gray-300">{row.saldoCapital}</td>
                          <td className="px-3 py-3 text-center text-gray-700 border-r border-gray-300">{row.interes}</td>
                          <td className="px-3 py-3 text-center text-gray-700 border-r border-gray-300">{row.iva}</td>
                          <td className="px-3 py-3 text-center text-gray-700 border-r border-gray-300">{row.capital}</td>
                          <td className="px-3 py-3 text-center text-gray-700 border-r border-gray-300">{row.pagoMinimo}</td>
                          <td className="px-3 py-3 text-center text-gray-700">{row.fechaVencimiento}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pie del modal - Botones */}
            <div className="border-t-2 border-gray-300 px-6 py-4 flex justify-end gap-3 bg-gray-50">
              <button
                className="px-6 py-2 bg-white border border-gray-400 rounded text-xs hover:bg-gray-100 text-gray-700 font-medium"
                onClick={() => setMostrarModalSimulador(false)}
              >
                Cerrar
              </button>
              <button
                className="px-6 py-2 btn-accent-theme text-white rounded text-xs hover:bg-accent-hover-theme font-medium"
                onClick={() => alert('Exportando a PDF...')}
              >
                Exportar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar nuevo archivo */}
      {mostrarModalNuevoArchivo && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]"
          onClick={() => setMostrarModalNuevoArchivo(false)}
        >
          <div 
            className="bg-white rounded-lg border-2 border-gray-400 shadow-2xl" 
            style={{ width: '500px', maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado del modal */}
            <div className="border-b-2 border-gray-300 px-6 py-4 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800">Agregar Nuevo Archivo</h2>
              <p className="text-xs text-gray-600 mt-1">Sube un archivo para el expediente del crédito</p>
            </div>

            {/* Contenido del modal - Formulario */}
            <div className="p-6 bg-white">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">TIPO DE DOCUMENTO <span className="text-red-600">*</span></label>
                  <select
                    value={nuevoArchivo.tipoDocumento}
                    onChange={(e) => setNuevoArchivo(prev => ({ ...prev, tipoDocumento: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Elige...</option>
                    <option value="Identificación oficial">Identificación oficial</option>
                    <option value="Comprobante de domicilio">Comprobante de domicilio</option>
                    <option value="Estado de cuenta bancaria">Estado de cuenta bancaria</option>
                    <option value="Puntaje de Crédito">Puntaje de Crédito</option>
                    <option value="Carta de Autorización del Crédito">Carta de Autorización del Crédito</option>
                    <option value="Comprobante de ingresos">Comprobante de ingresos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">ARCHIVO <span className="text-red-600">*</span></label>
                  <input
                    type="file"
                    onChange={(e) => setNuevoArchivo(prev => ({ ...prev, archivo: e.target.files ? e.target.files[0] : '' }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">DESCRIPCIÓN <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    value={nuevoArchivo.descripcion}
                    onChange={(e) => setNuevoArchivo(prev => ({ ...prev, descripcion: e.target.value }))}
                    className={inputClass}
                    placeholder="Especifica la descripción del archivo..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-600 mb-0.5">NOTAS</label>
                  <textarea
                    value={nuevoArchivo.notas}
                    onChange={(e) => setNuevoArchivo(prev => ({ ...prev, notas: e.target.value }))}
                    className={inputClass}
                    rows={3}
                    placeholder="Añade notas adicionales si es necesario..."
                  />
                </div>
              </div>
            </div>

            {/* Pie del modal - Botones */}
            <div className="border-t-2 border-gray-300 px-6 py-4 flex justify-end gap-3 bg-gray-50">
              <button
                className="px-6 py-2 bg-white border border-gray-400 rounded text-xs hover:bg-gray-100 text-gray-700 font-medium"
                onClick={() => setMostrarModalNuevoArchivo(false)}
              >
                Cancelar
              </button>
              <button
                className="px-6 py-2 btn-accent-theme text-white rounded text-xs hover:bg-accent-hover-theme font-medium"
                onClick={() => {
                  // Obtener fecha y hora actual
                  const ahora = new Date();
                  const dia = ahora.getDate().toString().padStart(2, '0');
                  const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
                  const anio = ahora.getFullYear();
                  const horas = ahora.getHours().toString().padStart(2, '0');
                  const minutos = ahora.getMinutes().toString().padStart(2, '0');
                  const fechaHora = `${dia}/${mes}/${anio} ${horas}:${minutos}`;
                  
                  const nuevoId = archivosExpediente.length > 0 
                    ? Math.max(...archivosExpediente.map(a => a.id)) + 1 
                    : 1;
                  
                  const archivoCompleto = {
                    id: nuevoId,
                    fechaRegistro: fechaHora,
                    usuario: 'admin',
                    tipoDocumento: nuevoArchivo.tipoDocumento,
                    archivo: nuevoArchivo.archivo || 'archivo.pdf',
                    descripcion: nuevoArchivo.descripcion,
                    estatus: nuevoArchivo.estatus,
                    notas: nuevoArchivo.notas
                  };
                  
                  setArchivosExpediente(prev => [...prev, archivoCompleto]);
                  setMostrarModalNuevoArchivo(false);
                  setNuevoArchivo({
                    tipoDocumento: '',
                    archivo: '',
                    descripcion: '',
                    estatus: 'Pendiente',
                    notas: ''
                  });
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}