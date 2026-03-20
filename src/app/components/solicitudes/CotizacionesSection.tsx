import { useState } from 'react';
import { DatePicker } from '@/app/components/ui/DatePicker';

interface CotizacionesSectionProps {
  solicitudId?: number;
}

export function CotizacionesSection({ solicitudId }: CotizacionesSectionProps) {
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState<any>(null);
  const [tablaAmortizacion, setTablaAmortizacion] = useState<any[]>([]);
  const [showCotizacionModal, setShowCotizacionModal] = useState(false);
  const [nuevaCotizacion, setNuevaCotizacion] = useState({
    producto: '',
    montoSolicitado: '',
    plazoMeses: '',
    tasaInteres: '',
    tipoAmortizacion: '',
    fechaPrimerPago: ''
  });

  // Función para calcular tabla de amortización
  const calcularAmortizacion = (cotizacion: any) => {
    const monto = parseFloat(cotizacion.montoSolicitado.replace(/[^0-9.-]+/g, '')) || 0;
    const plazo = parseInt(cotizacion.plazoMeses) || 0;
    const tasaAnual = parseFloat(cotizacion.tasaInteres) || 0;
    const tasaMensual = tasaAnual / 12 / 100;
    
    if (monto <= 0 || plazo <= 0 || tasaAnual <= 0) return [];

    const tabla: any[] = [];
    let saldoCapital = monto;
    
    // Obtener fecha de primer pago o usar fecha actual
    let fechaBase = cotizacion.fechaPrimerPago ? new Date(cotizacion.fechaPrimerPago) : new Date();

    if (cotizacion.tipoAmortizacion === 'Francés') {
      // Sistema Francés: Pago constante
      const pagoMensual = monto * (tasaMensual * Math.pow(1 + tasaMensual, plazo)) / (Math.pow(1 + tasaMensual, plazo) - 1);
      
      for (let i = 1; i <= plazo; i++) {
        const interes = saldoCapital * tasaMensual;
        const amortizacion = pagoMensual - interes;
        saldoCapital = Math.max(0, saldoCapital - amortizacion);
        
        const fechaPago = new Date(fechaBase);
        fechaPago.setMonth(fechaPago.getMonth() + i - 1);
        
        tabla.push({
          noPago: i,
          saldoCapital: saldoCapital.toFixed(2),
          interes: interes.toFixed(2),
          amortizacion: amortizacion.toFixed(2),
          pagoMensual: pagoMensual.toFixed(2),
          fechaPago: fechaPago.toLocaleDateString('es-MX')
        });
      }
    } else if (cotizacion.tipoAmortizacion === 'Alemán') {
      // Sistema Alemán: Amortización constante
      const amortizacionConstante = monto / plazo;
      
      for (let i = 1; i <= plazo; i++) {
        const interes = saldoCapital * tasaMensual;
        const pagoMensual = amortizacionConstante + interes;
        saldoCapital = Math.max(0, saldoCapital - amortizacionConstante);
        
        const fechaPago = new Date(fechaBase);
        fechaPago.setMonth(fechaPago.getMonth() + i - 1);
        
        tabla.push({
          noPago: i,
          saldoCapital: saldoCapital.toFixed(2),
          interes: interes.toFixed(2),
          amortizacion: amortizacionConstante.toFixed(2),
          pagoMensual: pagoMensual.toFixed(2),
          fechaPago: fechaPago.toLocaleDateString('es-MX')
        });
      }
    } else if (cotizacion.tipoAmortizacion === 'Americano') {
      // Sistema Americano: Solo intereses, capital al final
      for (let i = 1; i <= plazo; i++) {
        const interes = monto * tasaMensual;
        const amortizacion = i === plazo ? monto : 0;
        const pagoMensual = interes + amortizacion;
        const saldo = i === plazo ? 0 : monto;
        
        const fechaPago = new Date(fechaBase);
        fechaPago.setMonth(fechaPago.getMonth() + i - 1);
        
        tabla.push({
          noPago: i,
          saldoCapital: saldo.toFixed(2),
          interes: interes.toFixed(2),
          amortizacion: amortizacion.toFixed(2),
          pagoMensual: pagoMensual.toFixed(2),
          fechaPago: fechaPago.toLocaleDateString('es-MX')
        });
      }
    }
    
    return tabla;
  };

  // Función para seleccionar cotización
  const handleSeleccionarCotizacion = (cotizacion: any) => {
    setCotizacionSeleccionada(cotizacion);
    const tabla = calcularAmortizacion(cotizacion);
    setTablaAmortizacion(tabla);
  };

  const handleChangeCotizacion = (field: string, value: string) => {
    setNuevaCotizacion(prev => {
      const updated = { ...prev, [field]: value };
      return updated;
    });
  };

  const handleGuardarCotizacion = () => {
    // Validar campos requeridos
    if (!nuevaCotizacion.producto || !nuevaCotizacion.montoSolicitado || 
        !nuevaCotizacion.plazoMeses || !nuevaCotizacion.tasaInteres || 
        !nuevaCotizacion.tipoAmortizacion) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }

    const cotizacion = {
      id: cotizaciones.length + 1,
      fechaHora: new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      usuario: 'EMP-001 Emilio Camarena',
      ...nuevaCotizacion
    };

    const nuevasCotizaciones = [...cotizaciones, cotizacion];
    setCotizaciones(nuevasCotizaciones);
    
    // Limpiar formulario y cerrar modal
    setNuevaCotizacion({
      producto: '',
      montoSolicitado: '',
      plazoMeses: '',
      tasaInteres: '',
      tipoAmortizacion: '',
      fechaPrimerPago: ''
    });
    setShowCotizacionModal(false);
  };

  return (
    <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50">
      {/* Encabezado con título */}
      <div className="mb-3">
        <span className="text-xs font-normal text-gray-800">COTIZACIONES GUARDADAS</span>
      </div>

      {/* Tabla de cotizaciones guardadas */}
      <div className="border border-gray-300 mb-4 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Fecha/Hora</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Usuario</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Producto</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Monto</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Plazo</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Tasa %</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700">Tipo Amort.</th>
            </tr>
          </thead>
          <tbody>
            {cotizaciones.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-8 text-center text-gray-400">
                  No hay cotizaciones guardadas. Haga clic en "Nuevo" para agregar una.
                </td>
              </tr>
            ) : (
              cotizaciones.map((cot) => (
                <tr 
                  key={cot.id} 
                  onClick={() => handleSeleccionarCotizacion(cot)}
                  className={`border-b border-gray-200 cursor-pointer transition-colors ${
                    cotizacionSeleccionada?.id === cot.id 
                      ? 'bg-blue-100 hover:bg-blue-100' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-2 py-2 border-r border-gray-200">{cot.fechaHora}</td>
                  <td className="px-2 py-2 border-r border-gray-200">{cot.usuario}</td>
                  <td className="px-2 py-2 border-r border-gray-200">{cot.producto}</td>
                  <td className="px-2 py-2 border-r border-gray-200">{cot.montoSolicitado}</td>
                  <td className="px-2 py-2 border-r border-gray-200">{cot.plazoMeses} meses</td>
                  <td className="px-2 py-2 border-r border-gray-200">{cot.tasaInteres}%</td>
                  <td className="px-2 py-2">{cot.tipoAmortizacion}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sección AMORTIZACIÓN con botón Nuevo */}
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs font-normal text-gray-800">AMORTIZACIÓN</span>
        <button 
          onClick={() => setShowCotizacionModal(true)}
          className="px-4 py-1 bg-[#5B9BD5] text-white rounded text-xs hover:bg-[#4A8BC5] font-medium"
        >
          Nuevo
        </button>
        {cotizacionSeleccionada && (
          <div className="ml-auto text-xs text-gray-600 bg-blue-50 px-3 py-1 rounded border border-blue-200">
            <span className="font-medium">Cotización seleccionada:</span> {cotizacionSeleccionada.producto} - {cotizacionSeleccionada.montoSolicitado} - {cotizacionSeleccionada.plazoMeses} meses - {cotizacionSeleccionada.tasaInteres}% - {cotizacionSeleccionada.tipoAmortizacion}
          </div>
        )}
      </div>

      {/* Tabla de amortización */}
      <div className="border border-gray-300 overflow-x-auto bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#5B7DA4] text-white">
              <th className="px-4 py-2.5 text-center font-medium border-r border-white">No. PAGO</th>
              <th className="px-4 py-2.5 text-center font-medium border-r border-white">SALDO CAPITAL</th>
              <th className="px-4 py-2.5 text-center font-medium border-r border-white">INTERÉS</th>
              <th className="px-4 py-2.5 text-center font-medium border-r border-white">IVA</th>
              <th className="px-4 py-2.5 text-center font-medium border-r border-white">AMORTIZACIÓN</th>
              <th className="px-4 py-2.5 text-center font-medium border-r border-white">PAGO MENSUAL</th>
              <th className="px-4 py-2.5 text-center font-medium">FECHA PAGO</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {tablaAmortizacion.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Seleccione una cotización para ver la tabla de amortización
                </td>
              </tr>
            ) : (
              tablaAmortizacion.map((fila) => {
                const iva = parseFloat(fila.interes) * 0.16;
                const pagoMinimo = parseFloat(fila.pagoMensual) + iva;
                return (
                  <tr key={fila.noPago} className="border-b border-gray-200">
                    <td className="px-4 py-2 text-center text-[#333333] border-r border-gray-200">{fila.noPago}</td>
                    <td className="px-4 py-2 text-right text-[#333333] border-r border-gray-200">${parseFloat(fila.saldoCapital).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-right text-[#333333] border-r border-gray-200">${parseFloat(fila.interes).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-right text-[#333333] border-r border-gray-200">${iva.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-right text-[#333333] border-r border-gray-200">${parseFloat(fila.amortizacion).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-right text-[#333333] border-r border-gray-200">${pagoMinimo.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-center text-[#333333]">{fila.fechaPago}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Nueva Cotización */}
      {showCotizacionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded shadow-lg w-[500px] max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-300 flex items-center justify-between">
              <h3 className="text-base font-medium text-gray-800">
                Nueva Cotización
              </h3>
            </div>

            {/* Botones arriba del formulario */}
            <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-2">
              <button
                onClick={handleGuardarCotizacion}
                className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium"
              >
                Guardar
              </button>
              <button
                onClick={() => setShowCotizacionModal(false)}
                className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700"
              >
                Cancelar
              </button>
            </div>

            {/* Formulario */}
            <div className="p-6 space-y-3">
              {/* PRODUCTO */}
              <div className="flex items-center gap-3">
                <label className="text-xs w-32 flex-shrink-0 text-gray-700 font-medium">
                  PRODUCTO <span className="text-red-600">*</span>
                </label>
                <select 
                  value={nuevaCotizacion.producto}
                  onChange={(e) => handleChangeCotizacion('producto', e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
                >
                  <option value="">Seleccione...</option>
                  <option>Crédito Personal</option>
                  <option>Crédito Automotriz</option>
                  <option>Crédito Hipotecario</option>
                  <option>Crédito de Nómina</option>
                  <option>Crédito PYME</option>
                </select>
              </div>

              {/* MONTO SOLICITADO */}
              <div className="flex items-center gap-3">
                <label className="text-xs w-32 flex-shrink-0 text-gray-700 font-medium">
                  MONTO SOLICITADO <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={nuevaCotizacion.montoSolicitado}
                  onChange={(e) => handleChangeCotizacion('montoSolicitado', e.target.value)}
                  placeholder="$0.00"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>

              {/* PLAZO (MESES) */}
              <div className="flex items-center gap-3">
                <label className="text-xs w-32 flex-shrink-0 text-gray-700 font-medium">
                  PLAZO (MESES) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={nuevaCotizacion.plazoMeses}
                  onChange={(e) => handleChangeCotizacion('plazoMeses', e.target.value)}
                  placeholder="12"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>

              {/* TASA DE INTERÉS */}
              <div className="flex items-center gap-3">
                <label className="text-xs w-32 flex-shrink-0 text-gray-700 font-medium">
                  TASA DE INTERÉS (%) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={nuevaCotizacion.tasaInteres}
                  onChange={(e) => handleChangeCotizacion('tasaInteres', e.target.value)}
                  placeholder="12.50"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>

              {/* TIPO DE AMORTIZACIÓN */}
              <div className="flex items-center gap-3">
                <label className="text-xs w-32 flex-shrink-0 text-gray-700 font-medium">
                  TIPO AMORTIZACIÓN <span className="text-red-600">*</span>
                </label>
                <select 
                  value={nuevaCotizacion.tipoAmortizacion}
                  onChange={(e) => handleChangeCotizacion('tipoAmortizacion', e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
                >
                  <option value="">Seleccione...</option>
                  <option>Francés</option>
                  <option>Alemán</option>
                  <option>Americano</option>
                </select>
              </div>

              {/* FECHA PRIMER PAGO */}
              <div className="flex items-center gap-3">
                <label className="text-xs w-32 flex-shrink-0 text-gray-700 font-medium">
                  FECHA PRIMER PAGO
                </label>
                <DatePicker
                  value={nuevaCotizacion.fechaPrimerPago}
                  onChange={(date) => handleChangeCotizacion('fechaPrimerPago', date)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
