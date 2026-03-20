import { useState } from 'react';
import { toast } from 'sonner';

export function TabuladorProductos() {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showConsulta, setShowConsulta] = useState(false);
  const [filters, setFilters] = useState({
    noCredito: '',
    descripcion: '',
    tasa: '',
    plazo: '',
  });

  // Datos exactos según especificación
  const datosTabla = [
    { id: 1, noCredito: 'C001', descripcion: 'Crédito Personal', tasa: 3.8, plazo: 12 },
    { id: 2, noCredito: 'C002', descripcion: 'Crédito Personal', tasa: 3.8, plazo: 12 },
    { id: 3, noCredito: 'C003', descripcion: 'Crédito Personal', tasa: 3.8, plazo: 12 },
    { id: 4, noCredito: 'C004', descripcion: 'Crédito Personal', tasa: 3.8, plazo: 12 },
    { id: 5, noCredito: 'C005', descripcion: 'Crédito Personal', tasa: 3.8, plazo: 12 },
    { id: 6, noCredito: 'C006', descripcion: 'Crédito Personal', tasa: 3.8, plazo: 12 },
    { id: 7, noCredito: 'C007', descripcion: 'Crédito Personal', tasa: 3.8, plazo: 12 },
    { id: 8, noCredito: 'C008', descripcion: 'Crédito Personal', tasa: 3.8, plazo: 12 },
    { id: 9, noCredito: 'C009', descripcion: 'Crédito Personal', tasa: 3.8, plazo: 12 },
    { id: 10, noCredito: 'C010', descripcion: 'Crédito Personal', tasa: 3.8, plazo: 12 },
  ];

  const formatPercent = (value: number) => {
    return `${value}%`;
  };

  const handleCalcular = () => {
    toast.success('Cálculo realizado');
  };

  const handleConsulta = () => {
    setShowConsulta(!showConsulta);
  };

  // Aplicar filtros
  let filteredData = datosTabla.filter(item => {
    const matchesNoCredito = filters.noCredito === '' || item.noCredito.includes(filters.noCredito);
    const matchesDescripcion = filters.descripcion === '' || item.descripcion.includes(filters.descripcion);
    const matchesTasa = filters.tasa === '' || item.tasa.toString().includes(filters.tasa);
    const matchesPlazo = filters.plazo === '' || item.plazo.toString().includes(filters.plazo);
    return matchesNoCredito && matchesDescripcion && matchesTasa && matchesPlazo;
  });

  return (
    <div className="bg-white">
      <div className="p-4">
        {/* Header con título y botones */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-800">TABULADOR DE PRODUCTOS</span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="px-4 py-1.5 btn-accent-theme text-xs rounded hover:bg-accent-hover-theme flex items-center gap-1.5"
              >
                Menú
                <svg width="10" height="6" viewBox="0 0 10 6" fill="white">
                  <path d="M0 0l5 6 5-6z"/>
                </svg>
              </button>
              {showMenu && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 shadow-lg z-10 min-w-[140px]">
                  <button onClick={() => { toast.success('Exportando a Excel'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a Excel</button>
                  <button onClick={() => { toast.success('Exportando a CSV'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a CSV</button>
                  <button onClick={() => { toast.success('Exportando a PDF'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a PDF</button>
                  <button onClick={() => { toast.success('Imprimiendo'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100">Imprimir</button>
                </div>
              )}
            </div>
            <button onClick={handleCalcular} className="px-4 py-1.5 btn-accent-theme text-xs rounded hover:bg-accent-hover-theme">Calcular</button>
            <button onClick={handleConsulta} className="px-4 py-1.5 btn-accent-theme text-xs rounded hover:bg-accent-hover-theme">Consulta</button>
          </div>
        </div>

        {/* Panel de filtros */}
        {showConsulta && (
          <div className="mb-3 p-3 bg-[#F5F5F5] border border-gray-300 rounded">
            <div className="grid grid-cols-5 gap-3 mb-2">
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">No. Crédito</label>
                <input 
                  type="text"
                  value={filters.noCredito}
                  onChange={(e) => setFilters({...filters, noCredito: e.target.value})}
                  placeholder="Buscar crédito..."
                  className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Descripción</label>
                <input 
                  type="text"
                  value={filters.descripcion}
                  onChange={(e) => setFilters({...filters, descripcion: e.target.value})}
                  placeholder="Buscar descripción..."
                  className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Tasa</label>
                <input 
                  type="text"
                  value={filters.tasa}
                  onChange={(e) => setFilters({...filters, tasa: e.target.value})}
                  placeholder="Buscar tasa..."
                  className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Plazo</label>
                <input 
                  type="text"
                  value={filters.plazo}
                  onChange={(e) => setFilters({...filters, plazo: e.target.value})}
                  placeholder="Buscar plazo..."
                  className="w-full px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-accent-theme"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilters({ noCredito: '', descripcion: '', tasa: '', plazo: '' })}
                className="px-4 py-1.5 btn-accent-theme text-xs rounded hover:bg-accent-hover-theme"
              >
                Limpiar
              </button>
              <button 
                onClick={() => setShowConsulta(false)}
                className="px-4 py-1.5 btn-accent-theme text-xs rounded hover:bg-accent-hover-theme"
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
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">No. Crédito</th>
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Descripción</th>
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Tasa de interés</th>
                <th className="px-3 py-2.5 text-left font-medium text-xs text-gray-800">Plazo</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
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
                    <td className="px-3 py-2.5 text-xs text-gray-700 text-center">{row.noCredito}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 text-left">{row.descripcion}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 text-center">{formatPercent(row.tasa)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 text-center">{row.plazo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Contador de registros */}
        <div className="mt-2 text-xs text-gray-600">
          <span className="font-medium">Total de registros: {filteredData.length}</span>
        </div>
      </div>
    </div>
  );
}