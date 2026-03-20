import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface CobranzaAcumulativa {
  id: number;
  expediente: string;
  dep: string;
  pag: string;
  rfc: string;
  noCobranza: string;
  nombreCompleto: string;
  claveDescuento: string;
  importeDescontar: number;
  periodoPagos: string;
  montoTotal: number;
  seleccionado: boolean;
  expandido: boolean;
}

interface CobranzaAcumulativaProps {
  clienteId?: string;
  mode?: 'nuevo' | 'editar' | 'ver';
  isView?: boolean;
}

export function CobranzaAcumulativa({ clienteId, mode, isView }: CobranzaAcumulativaProps = {}) {
  const storageKey = `cliente_${clienteId || 'temp'}_cobranza_acumulativa`;
  const readOnly = isView || mode === 'ver';
  
  // Función para cargar datos persistidos
  const loadPersistedData = (key: string, defaultValue: any) => {
    try {
      if (mode === 'nuevo') return [];
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error('Error loading persisted data:', error);
      return defaultValue;
    }
  };

  const [datos, setDatos] = useState<CobranzaAcumulativa[]>(() =>
    loadPersistedData(storageKey, [])
  );

  // Guardar en sessionStorage cuando cambien los datos
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(datos));
  }, [datos, storageKey]);

  const [showMenu, setShowMenu] = useState(false);
  const [showConsulta, setShowConsulta] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    expediente: '',
    dep: '',
    pag: '',
    rfc: '',
    noCobranza: '',
    nombreCompleto: '',
    claveDescuento: '',
    importeDescontar: '',
    periodoPagos: '',
    montoTotal: '',
  });

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
  };

  const handleToggleSeleccion = (id: number) => {
    setDatos(datos.map(item => 
      item.id === id ? { ...item, seleccionado: !item.seleccionado } : item
    ));
  };

  const handleToggleExpansion = (id: number) => {
    setDatos(datos.map(item => 
      item.id === id ? { ...item, expandido: !item.expandido } : item
    ));
  };

  const handleSeleccionarTodos = (checked: boolean) => {
    setDatos(datos.map(item => ({ ...item, seleccionado: checked })));
  };

  const handleConsulta = () => {
    setShowConsulta(!showConsulta);
  };

  const handleEliminarSeleccionados = () => {
    const seleccionados = datos.filter(item => item.seleccionado);
    if (seleccionados.length === 0) {
      toast.error('No hay registros seleccionados para eliminar');
      return;
    }
    if (window.confirm(`¿Está seguro de eliminar ${seleccionados.length} registro(s)?`)) {
      setDatos(datos.filter(item => !item.seleccionado));
      toast.success('Registros eliminados correctamente');
    }
  };

  const handleGenerarCobranzaAcumulativa = () => {
    const seleccionados = datos.filter(item => item.seleccionado);
    if (seleccionados.length === 0) {
      toast.error('No hay registros seleccionados para generar cobranza acumulativa');
      return;
    }
    toast.success(`Generando cobranza acumulativa para ${seleccionados.length} registro(s)`);
  };

  const exportarExcel = () => {
    const datosExportar = filteredData.map(({ expediente, dep, pag, rfc, noCobranza, nombreCompleto, claveDescuento, importeDescontar, periodoPagos, montoTotal }) => ({
      Expediente: expediente,
      Dep: dep,
      Pag: pag,
      RFC: rfc,
      'No. de cobranza': noCobranza,
      'Nombre completo': nombreCompleto,
      'Cve. desc.': claveDescuento,
      'Imp. a descontar': importeDescontar,
      'Periodo de pagos': periodoPagos,
      'Monto t': montoTotal
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cobranza Acumulativa');
    
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Cobranza_Acumulativa_${fecha}.xlsx`);
    toast.success('Archivo Excel exportado correctamente');
  };

  const exportarCSV = () => {
    toast.success('Exportando a CSV...');
  };

  const exportarPDF = () => {
    toast.success('Exportando a PDF...');
  };

  const imprimir = () => {
    window.print();
    toast.success('Imprimiendo...');
  };

  const todosSeleccionados = datos.length > 0 && datos.every(item => item.seleccionado);
  const algunoSeleccionado = datos.some(item => item.seleccionado);

  // Aplicar filtros
  let filteredData = datos.filter(item => {
    const matchesExpediente = filters.expediente === '' || item.expediente.toLowerCase().includes(filters.expediente.toLowerCase());
    const matchesDep = filters.dep === '' || item.dep.toLowerCase().includes(filters.dep.toLowerCase());
    const matchesPag = filters.pag === '' || item.pag.toLowerCase().includes(filters.pag.toLowerCase());
    const matchesRfc = filters.rfc === '' || item.rfc.toLowerCase().includes(filters.rfc.toLowerCase());
    const matchesNoCobranza = filters.noCobranza === '' || item.noCobranza.toLowerCase().includes(filters.noCobranza.toLowerCase());
    const matchesNombreCompleto = filters.nombreCompleto === '' || item.nombreCompleto.toLowerCase().includes(filters.nombreCompleto.toLowerCase());
    const matchesClaveDescuento = filters.claveDescuento === '' || item.claveDescuento.toLowerCase().includes(filters.claveDescuento.toLowerCase());
    const matchesPeriodoPagos = filters.periodoPagos === '' || item.periodoPagos.toLowerCase().includes(filters.periodoPagos.toLowerCase());
    const matchesImporteDescontar = filters.importeDescontar === '' || item.importeDescontar.toString().includes(filters.importeDescontar);
    const matchesMontoTotal = filters.montoTotal === '' || item.montoTotal.toString().includes(filters.montoTotal);
    
    return matchesExpediente && matchesDep && matchesPag && matchesRfc && matchesNoCobranza && 
           matchesNombreCompleto && matchesClaveDescuento && matchesPeriodoPagos && 
           matchesImporteDescontar && matchesMontoTotal;
  });

  return (
    <div className="bg-white">
      {/* Encabezado institucional con botones - Diseño institucional */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">COBRANZA ACUMULATIVA</span>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={handleGenerarCobranzaAcumulativa}
                className="px-4 py-1.5 btn-accent-theme text-xs font-medium rounded hover:bg-accent-hover-theme"
              >
                Generar Cobranza Acumulativa
              </button>
            </>
          )}
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="px-4 py-1.5 btn-accent-theme text-xs font-medium rounded hover:bg-accent-hover-theme flex items-center gap-1.5"
            >
              Menú
              <svg width="10" height="6" viewBox="0 0 10 6" fill="white">
                <path d="M0 0l5 6 5-6z"/>
              </svg>
            </button>
            {showMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 shadow-lg z-10 min-w-[160px]">
                <button 
                  onClick={() => { handleConsulta(); setShowMenu(false); }} 
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                >
                  Consulta
                </button>
                <button 
                  onClick={() => { exportarExcel(); setShowMenu(false); }} 
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                >
                  Exportar a Excel
                </button>
                <button 
                  onClick={() => { exportarCSV(); setShowMenu(false); }} 
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                >
                  Exportar a CSV
                </button>
                <button 
                  onClick={() => { exportarPDF(); setShowMenu(false); }} 
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                >
                  Exportar a PDF
                </button>
                <button 
                  onClick={() => { imprimir(); setShowMenu(false); }} 
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                >
                  Imprimir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel de filtros */}
      {showConsulta && (
        <div className="mb-3 p-3 bg-[#F5F5F5] border border-gray-300 rounded">
          <div className="grid grid-cols-3 gap-3 mb-2">
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">Expediente</label>
              <input 
                type="text"
                value={filters.expediente}
                onChange={(e) => setFilters({...filters, expediente: e.target.value})}
                placeholder="Buscar expediente..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">Dep</label>
              <input 
                type="text"
                value={filters.dep}
                onChange={(e) => setFilters({...filters, dep: e.target.value})}
                placeholder="Buscar dependencia..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">RFC</label>
              <input 
                type="text"
                value={filters.rfc}
                onChange={(e) => setFilters({...filters, rfc: e.target.value})}
                placeholder="Buscar RFC..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">No. de cobranza</label>
              <input 
                type="text"
                value={filters.noCobranza}
                onChange={(e) => setFilters({...filters, noCobranza: e.target.value})}
                placeholder="Buscar número..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">Nombre completo</label>
              <input 
                type="text"
                value={filters.nombreCompleto}
                onChange={(e) => setFilters({...filters, nombreCompleto: e.target.value})}
                placeholder="Buscar nombre..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">Periodo de pagos</label>
              <input 
                type="text"
                value={filters.periodoPagos}
                onChange={(e) => setFilters({...filters, periodoPagos: e.target.value})}
                placeholder="Buscar periodo..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setFilters({ expediente: '', dep: '', pag: '', rfc: '', noCobranza: '', nombreCompleto: '', claveDescuento: '', importeDescontar: '', periodoPagos: '', montoTotal: '' })}
              className="px-4 py-1.5 btn-accent-theme text-xs rounded hover:bg-accent-hover-theme"
            >
              Limpiar Filtros
            </button>
            <button 
              onClick={() => setShowConsulta(false)}
              className="px-4 py-1.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="border border-gray-300 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#D9D9D9]">
              <th className="px-3 py-2.5 text-center font-medium text-xs text-gray-800" style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={(e) => handleSeleccionarTodos(e.target.checked)}
                  className="w-4 h-4"
                />
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Expediente</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Dep</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Pag</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">RFC</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">No. de cobranza</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Nombre completo</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Cve. desc.</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Imp. a descontar</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Periodo de pagos</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Monto t</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr 
                  key={row.id}
                  onClick={() => setSelectedRow(row.id)}
                  className={`border-b border-gray-200 cursor-pointer transition-colors ${
                    selectedRow === row.id 
                      ? 'bg-[#FFFF99]' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpansion(row.id);
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {row.expandido ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                      <input
                        type="checkbox"
                        checked={row.seleccionado}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSeleccion(row.id);
                        }}
                        className="w-4 h-4"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.expediente}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.dep}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.pag}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.rfc}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.noCobranza}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.nombreCompleto}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.claveDescuento}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{formatMoney(row.importeDescontar)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.periodoPagos}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">${row.montoTotal}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Contador de registros */}
      <div className="mt-2 text-xs text-gray-600">
        <span className="font-medium">Total de registros: {filteredData.length}</span>
        {algunoSeleccionado && (
          <span className="ml-3 font-medium">
            Seleccionados: {datos.filter(c => c.seleccionado).length}
          </span>
        )}
      </div>
    </div>
  );
}