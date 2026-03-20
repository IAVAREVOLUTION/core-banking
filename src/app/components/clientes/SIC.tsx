import { useState } from 'react';
import { FileText, Zap, Download, Copy, FileCode } from 'lucide-react';
import { useClienteSubtabList } from '@/app/hooks/useClientePersistence';

interface ConsultaSIC {
  id: number;
  fechaHora: string;
  usuario: string;
  tipoConsulta: string;
  estatus: string;
  xmlResultado: string;
}

interface SICProps {
  isView?: boolean;
  clienteId?: string;
  mode?: 'nuevo' | 'editar' | 'ver';
  diagData?: { rawNode: any; loaded: number } | null;
  diagKeys?: string[];
  diagUuid?: string;
}

export function SIC({ isView = false, clienteId, mode = 'nuevo', diagData = null, diagKeys = [], diagUuid = '' }: SICProps) {
  // SIEMPRE inicia vacío. Datos se cargan solo desde sessionStorage.
  const { 
    items: consultas, 
    setItems: setConsultas 
  } = useClienteSubtabList<ConsultaSIC>(
    clienteId || 'temp', 
    'consultas_sic', 
    []
  );

  const [showDiag, setShowDiag] = useState(false);
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [nuevoTipoConsulta, setNuevoTipoConsulta] = useState('');
  const [nuevoEstatus, setNuevoEstatus] = useState('');
  const [showPdfSicModal, setShowPdfSicModal] = useState(false);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState<ConsultaSIC | null>(null);
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [xmlSeleccionado, setXmlSeleccionado] = useState('');
  const [copiedXml, setCopiedXml] = useState(false);

  const handleNuevo = () => {
    setShowNuevoModal(true);
    setNuevoTipoConsulta('');
    setNuevoEstatus('');
  };

  const handleGuardarNuevo = () => {
    if (!nuevoTipoConsulta || !nuevoEstatus) {
      alert('Tipo de Consulta y Estatus son obligatorios');
      return;
    }

    // Generar XML SIC automáticamente
    const xmlGenerado = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultaSIC>
  <Encabezado>
    <FechaConsulta>${new Date().toISOString()}</FechaConsulta>
    <TipoConsulta>${nuevoTipoConsulta}</TipoConsulta>
    <Folio>SIC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}</Folio>
    <Version>2.0</Version>
  </Encabezado>
  <DatosConsultado>
    <Nombre>JUAN CARLOS PÉREZ GARCÍA</Nombre>
    <RFC>PEGJ850315HDF</RFC>
    <CURP>PEGJ850315HDFRRS08</CURP>
    <FechaNacimiento>15/03/1985</FechaNacimiento>
  </DatosConsultado>
  <Resultado>
    <Score>720</Score>
    <Clasificacion>Bueno</Clasificacion>
    <CuentasActivas>5</CuentasActivas>
    <SaldoTotal>284500.00</SaldoTotal>
    <CreditosCerrados>8</CreditosCerrados>
    <Estatus>${nuevoEstatus}</Estatus>
  </Resultado>
  <Creditos>
    <Credito>
      <Acreedor>BANCO SANTANDER</Acreedor>
      <Tipo>Tarjeta de Crédito</Tipo>
      <Saldo>45200.00</Saldo>
      <Estatus>AL CORRIENTE</Estatus>
      <MOP>01</MOP>
    </Credito>
    <Credito>
      <Acreedor>BBVA BANCOMER</Acreedor>
      <Tipo>Crédito Automotriz</Tipo>
      <Saldo>185300.00</Saldo>
      <Estatus>AL CORRIENTE</Estatus>
      <MOP>01</MOP>
    </Credito>
    <Credito>
      <Acreedor>LIVERPOOL</Acreedor>
      <Tipo>Tarjeta de Crédito</Tipo>
      <Saldo>12500.00</Saldo>
      <Estatus>AL CORRIENTE</Estatus>
      <MOP>01</MOP>
    </Credito>
  </Creditos>
  <Consultas>
    <TotalConsultas>8</TotalConsultas>
    <UltimaConsulta>
      <Fecha>${new Date().toLocaleDateString('es-MX')}</Fecha>
      <Otorgante>BANCO AZTECA</Otorgante>
      <TipoCredito>Tarjeta de Crédito</TipoCredito>
    </UltimaConsulta>
  </Consultas>
</ConsultaSIC>`;

    const nuevaConsulta: ConsultaSIC = {
      id: consultas.length + 1,
      fechaHora: new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      usuario: 'EMP-001 Emilio Camarena',
      tipoConsulta: nuevoTipoConsulta,
      estatus: nuevoEstatus,
      xmlResultado: xmlGenerado
    };

    setConsultas([...consultas, nuevaConsulta]);
    setShowNuevoModal(false);
  };

  const handleEliminar = (id: number) => {
    if (confirm('¿Desea eliminar la consulta seleccionada?')) {
      setConsultas(consultas.filter(c => c.id !== id));
    }
  };

  const handleConsultar = (id: number) => {
    setConsultas(consultas.map(c => 
      c.id === id 
        ? { ...c, estatus: 'En revisión', xmlResultado: '+7XMLRESULTADOSC...' } 
        : c
    ));
  };

  const handleOpenPdfSicModal = (consulta: ConsultaSIC) => {
    setConsultaSeleccionada(consulta);
    setShowPdfSicModal(true);
  };

  const handleVerXml = (xml: string) => {
    setXmlSeleccionado(xml);
    setShowXmlModal(true);
    setCopiedXml(false);
  };

  const handleCopyXml = () => {
    navigator.clipboard.writeText(xmlSeleccionado);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
  };

  const handleDownloadXml = () => {
    const blob = new Blob([xmlSeleccionado], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consulta-sic-${Date.now()}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* ═══ PANEL DIAGNÓSTICO: Fuente de datos de SIC ═══ */}
      {(mode === 'editar' || mode === 'ver') && diagData && (
        <div className="mb-3 border border-amber-300 rounded bg-amber-50">
          <button
            onClick={() => setShowDiag(!showDiag)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <span className="font-semibold">DIAGNÓSTICO DB — SIC</span>
              <span className="font-normal">
                — Fuente: {diagData.rawNode ? `encontrado (${Array.isArray(diagData.rawNode) ? diagData.rawNode.length : 1} crudo)` : 'NO encontrado'}
                {` | Mostradas: ${consultas.length}`}
                {` | UUID: ${diagUuid}`}
              </span>
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showDiag ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {showDiag && (
            <div className="px-3 pb-3 space-y-2 border-t border-amber-200">
              <div className="mt-2">
                <span className="text-xs font-semibold text-amber-900">Keys en _rawData ({diagKeys.length}):</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {diagKeys.map(k => (
                    <span key={k} className={`px-1.5 py-0.5 text-[10px] rounded ${['sic','consultasSIC','consultas_sic','consultasSic','consultas'].includes(k) ? 'bg-green-200 text-green-800 font-bold' : 'bg-gray-200 text-gray-700'}`}>
                      {k}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-amber-900">JSON crudo de "sic" de J_CLIENTES.data:</span>
                <pre className="mt-1 p-2 bg-white border border-amber-200 rounded text-[10px] text-gray-800 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                  {diagData.rawNode
                    ? JSON.stringify(diagData.rawNode, null, 2)
                    : '(null — no existe nodo SIC en el JSONB)'}
                </pre>
              </div>
              {!diagData.rawNode && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  <strong>No se encontró nodo SIC en _rawData.</strong> Keys que SÍ existen: {diagKeys.join(', ') || '(ninguna)'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Encabezado institucional con título y botones */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">CONSULTA SIC</span>
        {!isView && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleNuevo}
              className="px-4 py-1.5 btn-secondary-theme rounded text-xs font-medium"
            >
              Nuevo
            </button>
            <button className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50 font-medium">
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Tabla de consultas SIC */}
      <div className="border border-gray-300">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#E7E6E6] border-b border-gray-400">
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha y hora del registro</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Usuario que registró</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tipo de Consulta *</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus *</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300 w-20">Consultar</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300 w-24">PDF SIC</th>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 w-20">XML SIC</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {consultas.map((consulta) => (
              <tr key={consulta.id} className="border-b border-gray-300">
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{consulta.fechaHora}</td>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{consulta.usuario}</td>
                <td className="px-3 py-2 border-r border-gray-300">
                  <input 
                    type="text" 
                    value={consulta.tipoConsulta}
                    readOnly
                    className="w-full px-1 py-0.5 text-xs border-0 bg-transparent"
                  />
                </td>
                <td className="px-3 py-2 border-r border-gray-300">
                  <input 
                    type="text" 
                    value={consulta.estatus}
                    readOnly
                    className="w-full px-1 py-0.5 text-xs border-0 bg-transparent"
                  />
                </td>
                <td className="px-3 py-2 border-r border-gray-300 text-center">
                  <button 
                    onClick={() => handleConsultar(consulta.id)}
                    className={`inline-flex items-center justify-center p-1 hover:bg-gray-100 rounded ${isView ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Consultar"
                    disabled={isView}
                  >
                    <Zap className="w-4 h-4 text-yellow-600" />
                  </button>
                </td>
                <td className="px-3 py-2 border-r border-gray-300 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button 
                      onClick={() => handleOpenPdfSicModal(consulta)}
                      className="inline-flex items-center justify-center p-1 hover:bg-gray-100 rounded"
                      title="Ver Reporte SIC"
                    >
                      <FileText className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <button 
                    onClick={() => handleVerXml(consulta.xmlResultado)}
                    className="inline-flex items-center justify-center p-1 hover:bg-gray-100 rounded"
                    title="Ver XML SIC"
                    disabled={!consulta.xmlResultado}
                  >
                    <FileCode className={`w-4 h-4 ${consulta.xmlResultado ? 'text-green-600' : 'text-gray-400'}`} />
                  </button>
                </td>
              </tr>
            ))}
            {consultas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500 italic">
                  No hay consultas SIC registradas.{!isView && ' Haga clic en "Nuevo" para agregar una consulta.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo */}
      {showNuevoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header azul institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                Nueva Consulta SIC
              </h3>
              <button
                onClick={() => setShowNuevoModal(false)}
                className="text-white hover:text-gray-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            {/* Contenido del formulario */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Título de sección con estilo institucional */}
              <div className="bg-gray-100 border-l-4 border-primary-theme px-4 py-2 mb-4">
                <h4 className="text-sm font-semibold text-gray-800">INFORMACIÓN DE CONSULTA SIC</h4>
              </div>

              {/* Formulario */}
              <div className="space-y-4">
                {/* TIPO DE CONSULTA y ESTATUS en la misma fila */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tipo de Consulta <span className="text-red-600">*</span>
                    </label>
                    <select 
                      value={nuevoTipoConsulta}
                      onChange={(e) => setNuevoTipoConsulta(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="BURO">BURO</option>
                      <option value="CIRCULO DE CREDITO">CIRCULO DE CREDITO</option>
                      <option value="TRANS UNION">TRANS UNION</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Estatus <span className="text-red-600">*</span>
                    </label>
                    <select 
                      value={nuevoEstatus}
                      onChange={(e) => setNuevoEstatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Pendiente">Pendiente</option>
                      <option value="En revisión">En revisión</option>
                      <option value="Completado">Completado</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button 
                onClick={() => setShowNuevoModal(false)}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleGuardarNuevo}
                className="px-5 py-2 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reporte SIC - Buró de Crédito */}
      {showPdfSicModal && consultaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded shadow-lg w-[90vw] h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300">
              <div>
                <h3 className="text-base font-medium text-gray-800">REPORTE SIC - BURÓ DE CRÉDITO</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Consulta del {consultaSeleccionada.fechaHora} - {consultaSeleccionada.tipoConsulta}
                </p>
              </div>
              <button
                onClick={() => setShowPdfSicModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* PDF Viewer - Simulación de Reporte SIC */}
            <div className="flex-1 overflow-auto p-6 bg-white">
              <div className="max-w-4xl mx-auto bg-white border border-gray-300 shadow-lg p-8">
                {/* Header del Reporte */}
                <div className="border-b-2 border-gray-800 pb-4 mb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">BURÓ DE CRÉDITO</h1>
                      <p className="text-sm text-gray-700 mt-1">Reporte de Crédito Especial</p>
                      <p className="text-xs text-gray-600 mt-1">Sociedad de Información Crediticia</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-600">
                        <p>Folio de Consulta: <span className="font-semibold">BC-2024-00{consultaSeleccionada.id}7892</span></p>
                        <p>Fecha: {consultaSeleccionada.fechaHora}</p>
                        <p>Usuario: {consultaSeleccionada.usuario}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Datos del Consultado */}
                <div className="mb-6">
                  <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">DATOS DEL CONSULTADO</h2>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-gray-600">Nombre:</p>
                      <p className="font-semibold">JUAN CARLOS PÉREZ GARCÍA</p>
                    </div>
                    <div>
                      <p className="text-gray-600">RFC:</p>
                      <p className="font-semibold">PEGJ850315HDF</p>
                    </div>
                    <div>
                      <p className="text-gray-600">CURP:</p>
                      <p className="font-semibold">PEGJ850315HDFRRS08</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Fecha de Nacimiento:</p>
                      <p className="font-semibold">15/03/1985</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Dirección:</p>
                      <p className="font-semibold">AV. INSURGENTES SUR 1234, COL. DEL VALLE</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Estado:</p>
                      <p className="font-semibold">CIUDAD DE MÉXICO</p>
                    </div>
                  </div>
                </div>

                {/* Score Crediticio */}
                <div className="mb-6">
                  <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">SCORE CREDITICIO</h2>
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-green-600">720</div>
                      <p className="text-xs text-gray-600 mt-1">Puntuación</p>
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-200 h-4 rounded-full overflow-hidden">
                        <div className="bg-green-500 h-full" style={{ width: '72%' }}></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600 mt-1">
                        <span>300</span>
                        <span>Bueno</span>
                        <span>850</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen de Créditos */}
                <div className="mb-6">
                  <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">RESUMEN DE CRÉDITOS</h2>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div className="border border-gray-300 p-3 text-center">
                      <p className="text-gray-600 mb-1">Cuentas Activas</p>
                      <p className="text-2xl font-bold text-blue-600">5</p>
                    </div>
                    <div className="border border-gray-300 p-3 text-center">
                      <p className="text-gray-600 mb-1">Saldo Total</p>
                      <p className="text-2xl font-bold text-orange-600">$284,500</p>
                    </div>
                    <div className="border border-gray-300 p-3 text-center">
                      <p className="text-gray-600 mb-1">Créditos Cerrados</p>
                      <p className="text-2xl font-bold text-gray-600">8</p>
                    </div>
                  </div>
                </div>

                {/* Detalle de Créditos */}
                <div className="mb-6">
                  <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">DETALLE DE CRÉDITOS VIGENTES</h2>
                  <table className="w-full text-xs border border-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 px-2 py-1 text-left">Acreedor</th>
                        <th className="border border-gray-300 px-2 py-1 text-left">Tipo</th>
                        <th className="border border-gray-300 px-2 py-1 text-right">Saldo Actual</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Estatus</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">MOP</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">BANCO SANTANDER</td>
                        <td className="border border-gray-300 px-2 py-1">Tarjeta de Crédito</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">$45,200</td>
                        <td className="border border-gray-300 px-2 py-1 text-center"><span className="text-green-600 font-semibold">AL CORRIENTE</span></td>
                        <td className="border border-gray-300 px-2 py-1 text-center">01</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">BBVA BANCOMER</td>
                        <td className="border border-gray-300 px-2 py-1">Crédito Automotriz</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">$185,300</td>
                        <td className="border border-gray-300 px-2 py-1 text-center"><span className="text-green-600 font-semibold">AL CORRIENTE</span></td>
                        <td className="border border-gray-300 px-2 py-1 text-center">01</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">LIVERPOOL</td>
                        <td className="border border-gray-300 px-2 py-1">Tarjeta de Crédito</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">$12,500</td>
                        <td className="border border-gray-300 px-2 py-1 text-center"><span className="text-green-600 font-semibold">AL CORRIENTE</span></td>
                        <td className="border border-gray-300 px-2 py-1 text-center">01</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">SCOTIABANK</td>
                        <td className="border border-gray-300 px-2 py-1">Crédito Personal</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">$35,000</td>
                        <td className="border border-gray-300 px-2 py-1 text-center"><span className="text-green-600 font-semibold">AL CORRIENTE</span></td>
                        <td className="border border-gray-300 px-2 py-1 text-center">01</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">BANORTE</td>
                        <td className="border border-gray-300 px-2 py-1">Tarjeta de Crédito</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">$6,500</td>
                        <td className="border border-gray-300 px-2 py-1 text-center"><span className="text-green-600 font-semibold">AL CORRIENTE</span></td>
                        <td className="border border-gray-300 px-2 py-1 text-center">01</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-500 mt-2">
                    <strong>MOP:</strong> Manera de Pago (01 = Al día, 02 = 1-29 días vencido, 03 = 30-59 días vencido, etc.)
                  </p>
                </div>

                {/* Consultas Recientes */}
                <div className="mb-6">
                  <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">CONSULTAS RECIENTES (ÚLTIMOS 24 MESES)</h2>
                  <div className="text-xs">
                    <p className="mb-2"><span className="font-semibold">Total de consultas:</span> 8</p>
                    <div className="border border-gray-300">
                      <div className="bg-gray-100 border-b border-gray-300 px-2 py-1 flex">
                        <span className="w-1/3 font-semibold">Fecha</span>
                        <span className="w-1/3 font-semibold">Otorgante</span>
                        <span className="w-1/3 font-semibold">Tipo</span>
                      </div>
                      <div className="px-2 py-1 border-b border-gray-200 flex">
                        <span className="w-1/3">30/01/2026</span>
                        <span className="w-1/3">BANCO AZTECA</span>
                        <span className="w-1/3">Tarjeta de Crédito</span>
                      </div>
                      <div className="px-2 py-1 border-b border-gray-200 flex">
                        <span className="w-1/3">15/12/2025</span>
                        <span className="w-1/3">HSBC</span>
                        <span className="w-1/3">Crédito Personal</span>
                      </div>
                      <div className="px-2 py-1 flex">
                        <span className="w-1/3">08/10/2025</span>
                        <span className="w-1/3">COPPEL</span>
                        <span className="w-1/3">Crédito de Nómina</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t-2 border-gray-800 pt-4 mt-8">
                  <p className="text-xs text-gray-500 text-center">
                    Este reporte es confidencial y fue generado exclusivamente para {consultaSeleccionada.usuario}<br />
                    Buró de Crédito - Sociedad de Información Crediticia, S.A. de C.V.<br />
                    Fecha de generación: {new Date().toLocaleString('es-MX')}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-300 bg-gray-50">
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 btn-accent-theme rounded text-sm hover:bg-accent-hover-theme"
              >
                Imprimir / Descargar PDF
              </button>
              <button
                onClick={() => setShowPdfSicModal(false)}
                className="px-4 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para visualizar XML SIC */}
      {showXmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header azul institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCode className="w-5 h-5 text-white" />
                <h3 className="text-base font-medium text-white">
                  Visualizador de XML SIC
                </h3>
              </div>
              <button
                onClick={() => setShowXmlModal(false)}
                className="text-white hover:text-gray-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            {/* Contenido del XML */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {/* Toolbar con botones de acción */}
              <div className="flex items-center justify-between mb-4 bg-white border border-gray-300 rounded px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Archivo XML de Consulta SIC</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyXml}
                    className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 font-medium flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedXml ? 'Copiado!' : 'Copiar'}
                  </button>
                  <button
                    onClick={handleDownloadXml}
                    className="px-4 py-1.5 bg-primary-theme text-white rounded text-sm hover:bg-primary-hover-theme font-medium flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Descargar XML
                  </button>
                </div>
              </div>

              {/* Visualizador de XML con formato */}
              <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-700">
                <div className="bg-[#2d2d2d] px-4 py-2 border-b border-gray-700">
                  <span className="text-xs text-gray-400 font-mono">consulta-sic.xml</span>
                </div>
                <pre className="p-6 overflow-x-auto text-xs leading-relaxed">
                  <code className="font-mono text-gray-300">{xmlSeleccionado}</code>
                </pre>
              </div>

              {/* Información adicional */}
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded px-4 py-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Información del XML SIC</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Este archivo XML contiene la información completa de la consulta realizada a la Sociedad de Información Crediticia (SIC). 
                      Puede descargarlo para su archivo o integrarlo con sistemas externos.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowXmlModal(false)}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}