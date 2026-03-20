import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface CobranzaNormal {
  id: number;
  cuenta: string;
  usuario: string;
  observaciones: string;
  fechaGenerar: string;
  fechaEnvio: string;
  fechaProgramacion: string;
  seleccionado: boolean;
}

interface CobranzaNormalProps {
  clienteId?: string;
  mode?: 'nuevo' | 'editar' | 'ver';
  isView?: boolean;
}

export function CobranzaNormal({ clienteId, mode, isView }: CobranzaNormalProps = {}) {
  const storageKey = `cliente_${clienteId || 'temp'}_cobranza_normal`;
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

  const [datos, setDatos] = useState<CobranzaNormal[]>(() =>
    loadPersistedData(storageKey, [])
  );

  // Guardar en sessionStorage cuando cambien los datos
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(datos));
  }, [datos, storageKey]);

  const [showMenu, setShowMenu] = useState(false);
  const [showConsulta, setShowConsulta] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    cuenta: '',
    usuario: 'GTE-ADC',
    observaciones: '',
    fechaGenerar: '',
    fechaEnvio: '',
    fechaProgramacion: ''
  });
  const [filters, setFilters] = useState({
    cuenta: '',
    usuario: '',
    observaciones: '',
    fechaGenerar: '',
    fechaEnvio: '',
    fechaProgramacion: '',
    dep: '',
    rfc: '',
    noCobranza: '',
    nombreCompleto: '',
    periodoPagos: ''
  });

  const handleToggleSeleccion = (id: number) => {
    setDatos(datos.map(item => 
      item.id === id ? { ...item, seleccionado: !item.seleccionado } : item
    ));
  };

  const handleSeleccionarTodos = (checked: boolean) => {
    setDatos(datos.map(item => ({ ...item, seleccionado: checked })));
  };

  const handleNuevo = () => {
    // Obtener fecha actual en formato DD/MM/YYYY
    const fechaActual = new Date().toLocaleDateString('es-MX');
    const fechaHoraActual = `${fechaActual} ${new Date().toLocaleTimeString('es-MX')}`;
    
    setFormData({
      cuenta: '',
      usuario: 'GTE-ADC',
      observaciones: '',
      fechaGenerar: fechaHoraActual,
      fechaEnvio: fechaActual,
      fechaProgramacion: ''
    });
    setShowModal(true);
  };

  const handleGuardarRegistro = () => {
    if (!formData.cuenta.trim()) {
      toast.error('La cuenta es obligatoria');
      return;
    }
    if (!formData.observaciones.trim()) {
      toast.error('Las observaciones son obligatorias');
      return;
    }

    const nuevoRegistro: CobranzaNormal = {
      id: Math.max(...datos.map(c => c.id), 0) + 1,
      ...formData,
      seleccionado: false
    };
    setDatos([...datos, nuevoRegistro]);
    toast.success('Registro de cobranza creado correctamente');
    setShowModal(false);
    setFormData({
      cuenta: '',
      usuario: 'GTE-ADC',
      observaciones: '',
      fechaGenerar: '',
      fechaEnvio: '',
      fechaProgramacion: ''
    });
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

  const handleGenerarCobranza = () => {
    const seleccionados = datos.filter(item => item.seleccionado);
    if (seleccionados.length === 0) {
      toast.error('No hay registros seleccionados para generar cobranza');
      return;
    }
    toast.success(`Generando cobranza para ${seleccionados.length} registro(s)`);
  };

  const handleAutorizar = () => {
    const seleccionados = datos.filter(item => item.seleccionado);
    if (seleccionados.length === 0) {
      toast.error('No hay registros seleccionados para autorizar');
      return;
    }
    toast.success(`Autorizando cobranza para ${seleccionados.length} registro(s)`);
  };

  const handleConsulta = () => {
    setShowConsulta(!showConsulta);
  };

  const exportarExcel = () => {
    const datosExportar = filteredData.map(({ cuenta, usuario, observaciones, fechaGenerar, fechaEnvio, fechaProgramacion }) => ({
      Cuenta: cuenta,
      Usuario: usuario,
      Observaciones: observaciones,
      'Fecha de generar': fechaGenerar,
      'Fecha de envío': fechaEnvio,
      'Fecha de programación': fechaProgramacion
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cobranza Normal');
    
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Cobranza_Normal_${fecha}.xlsx`);
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
    const matchesCuenta = filters.cuenta === '' || item.cuenta.toLowerCase().includes(filters.cuenta.toLowerCase());
    const matchesUsuario = filters.usuario === '' || item.usuario.toLowerCase().includes(filters.usuario.toLowerCase());
    const matchesObservaciones = filters.observaciones === '' || item.observaciones.toLowerCase().includes(filters.observaciones.toLowerCase());
    const matchesFechaGenerar = filters.fechaGenerar === '' || item.fechaGenerar.includes(filters.fechaGenerar);
    const matchesFechaEnvio = filters.fechaEnvio === '' || item.fechaEnvio.includes(filters.fechaEnvio);
    const matchesFechaProgramacion = filters.fechaProgramacion === '' || item.fechaProgramacion.includes(filters.fechaProgramacion);
    const matchesDep = filters.dep === '' || item.cuenta.toLowerCase().includes(filters.dep.toLowerCase());
    const matchesRFC = filters.rfc === '' || item.cuenta.toLowerCase().includes(filters.rfc.toLowerCase());
    const matchesNoCobranza = filters.noCobranza === '' || item.cuenta.toLowerCase().includes(filters.noCobranza.toLowerCase());
    const matchesNombreCompleto = filters.nombreCompleto === '' || item.cuenta.toLowerCase().includes(filters.nombreCompleto.toLowerCase());
    const matchesPeriodoPagos = filters.periodoPagos === '' || item.cuenta.toLowerCase().includes(filters.periodoPagos.toLowerCase());
    return matchesCuenta && matchesUsuario && matchesObservaciones && matchesFechaGenerar && matchesFechaEnvio && matchesFechaProgramacion && matchesDep && matchesRFC && matchesNoCobranza && matchesNombreCompleto && matchesPeriodoPagos;
  });

  return (
    <div className="bg-white">
      {/* Encabezado institucional con botones - Diseño institucional */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">COBRANZA NORMAL</span>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={handleGenerarCobranza}
                className="px-4 py-1.5 btn-accent-theme text-xs font-medium rounded hover:bg-accent-hover-theme"
              >
                Generar Cobranza Normal
              </button>
              <button
                onClick={handleAutorizar}
                className="px-4 py-1.5 btn-accent-theme text-xs font-medium rounded hover:bg-accent-hover-theme"
              >
                Autorizar Cobranza Normal
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
              <label className="block text-xs text-gray-700 mb-1 font-medium">Cuenta</label>
              <input 
                type="text"
                value={filters.cuenta}
                onChange={(e) => setFilters({...filters, cuenta: e.target.value})}
                placeholder="Buscar cuenta..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">Usuario</label>
              <input 
                type="text"
                value={filters.usuario}
                onChange={(e) => setFilters({...filters, usuario: e.target.value})}
                placeholder="Buscar usuario..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">Observaciones</label>
              <input 
                type="text"
                value={filters.observaciones}
                onChange={(e) => setFilters({...filters, observaciones: e.target.value})}
                placeholder="Buscar observaciones..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de generar</label>
              <input 
                type="text"
                value={filters.fechaGenerar}
                onChange={(e) => setFilters({...filters, fechaGenerar: e.target.value})}
                placeholder="Buscar fecha..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de envío</label>
              <input 
                type="text"
                value={filters.fechaEnvio}
                onChange={(e) => setFilters({...filters, fechaEnvio: e.target.value})}
                placeholder="Buscar fecha..."
                className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de programación</label>
              <input 
                type="text"
                value={filters.fechaProgramacion}
                onChange={(e) => setFilters({...filters, fechaProgramacion: e.target.value})}
                placeholder="Buscar fecha..."
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
              onClick={() => setFilters({ cuenta: '', usuario: '', observaciones: '', fechaGenerar: '', fechaEnvio: '', fechaProgramacion: '', dep: '', rfc: '', noCobranza: '', nombreCompleto: '', periodoPagos: '' })}
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
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Cuenta</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Usuario</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Observaciones</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Fecha de generar</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Fecha de envío</th>
              <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Fecha de programación</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
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
                    <input
                      type="checkbox"
                      checked={row.seleccionado}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleSeleccion(row.id);
                      }}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.cuenta}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.usuario}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.observaciones}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.fechaGenerar}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.fechaEnvio}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.fechaProgramacion}</td>
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

      {/* Modal para nuevo registro */}
      {showModal && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 bg-[#D9D9D9]">
              <h3 className="text-sm font-medium text-gray-800">Nuevo Registro de Cobranza Normal</h3>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setFormData({
                    cuenta: '',
                    usuario: 'GTE-ADC',
                    observaciones: '',
                    fechaGenerar: '',
                    fechaEnvio: '',
                    fechaProgramacion: ''
                  });
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Cuenta <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text"
                    value={formData.cuenta}
                    onChange={(e) => setFormData({...formData, cuenta: e.target.value})}
                    placeholder="Ej: NEZAHUALCOYOTL"
                    className="w-full px-3 py-2 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Usuario</label>
                  <input 
                    type="text"
                    value={formData.usuario}
                    onChange={(e) => setFormData({...formData, usuario: e.target.value})}
                    placeholder="Ej: GTE-ADC"
                    className="w-full px-3 py-2 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">
                  Observaciones <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                  placeholder="Ej: Se genera la QNA 08 del 2010"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de generar</label>
                  <input 
                    type="text"
                    value={formData.fechaGenerar}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 text-xs rounded bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de envío</label>
                  <input 
                    type="text"
                    value={formData.fechaEnvio}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 text-xs rounded bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha de programación</label>
                  <input 
                    type="text"
                    value={formData.fechaProgramacion}
                    onChange={(e) => setFormData({...formData, fechaProgramacion: e.target.value})}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-300 bg-gray-50">
              <button 
                onClick={() => {
                  setShowModal(false);
                  setFormData({
                    cuenta: '',
                    usuario: 'GTE-ADC',
                    observaciones: '',
                    fechaGenerar: '',
                    fechaEnvio: '',
                    fechaProgramacion: ''
                  });
                }}
                className="px-4 py-1.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button 
                onClick={handleGuardarRegistro}
                className="px-4 py-1.5 btn-accent-theme text-xs rounded hover:bg-accent-hover-theme"
              >
                Guardar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}