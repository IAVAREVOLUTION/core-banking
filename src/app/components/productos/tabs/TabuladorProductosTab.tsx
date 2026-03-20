import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FormMode } from '../../../types/product';

interface TabuladorItem {
  id: number;
  plazo: number;
  tasaInteres: number;
  montoSolicitado: number;
  montoTotalPagar: number;
  pagoQuincenal: number;
  seleccionado: boolean;
}

interface TabuladorProductosTabProps {
  mode: FormMode;
  productId: number | string;
  initialData?: TabuladorItem[];
  persistToStorage?: boolean;
}

const defaultTabuladorData: TabuladorItem[] = [];

export const TabuladorProductosTab = forwardRef<{ getData: () => TabuladorItem[] }, TabuladorProductosTabProps>(
  ({ mode, productId, initialData, persistToStorage }, ref) => {
    const storageKey = persistToStorage && productId ? `credito_tabulador_${productId}` : '';

    const getInitialData = (): TabuladorItem[] => {
      if (storageKey) {
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) return JSON.parse(stored);
        } catch (e) { /* ignore */ }
      }
      if (initialData && initialData.length > 0) return initialData;
      return [...defaultTabuladorData];
    };

    const [datos, setDatos] = useState<TabuladorItem[]>(getInitialData);

    useImperativeHandle(ref, () => ({ getData: () => datos }));

    useEffect(() => {
      if (storageKey) {
        try { sessionStorage.setItem(storageKey, JSON.stringify(datos)); } catch (e) { /* ignore */ }
      }
    }, [datos, storageKey]);

    const isView = mode === 'view';
    
    const [showNuevoForm, setShowNuevoForm] = useState(false);
    const [nuevoItem, setNuevoItem] = useState({
      plazo: 0,
      tasaInteres: 0,
      montoSolicitado: 0,
      montoTotalPagar: 0,
      pagoQuincenal: 0
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
      const newItem: TabuladorItem = {
        id: Math.max(...datos.map(d => d.id), 0) + 1,
        ...nuevoItem,
        seleccionado: false
      };
      setDatos([...datos, newItem]);
      setShowNuevoForm(false);
      // Resetear formulario
      setNuevoItem({
        plazo: 0,
        tasaInteres: 0,
        montoSolicitado: 0,
        montoTotalPagar: 0,
        pagoQuincenal: 0
      });
    };

    const handleEliminarSeleccionados = () => {
      const seleccionados = datos.filter(item => item.seleccionado);
      if (seleccionados.length === 0) return;
      setDatos(datos.filter(item => !item.seleccionado));
    };

    const todosSeleccionados = datos.length > 0 && datos.every(item => item.seleccionado);
    const algunoSeleccionado = datos.some(item => item.seleccionado);

    // Formatear números como moneda
    const formatCurrency = (value: number | undefined | null) => {
      if (value == null || isNaN(value)) return '0.00';
      return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    };

    // Formatear porcentaje
    const formatPercent = (value: number | undefined | null) => {
      if (value == null || isNaN(value)) return '0.0';
      return value.toFixed(1);
    };

    return (
      <div>
        {/* Header con botones */}
        <div className="bg-[#E8E8E8] px-3 py-1.5 mb-3 text-xs font-medium text-gray-700 flex items-center gap-2">
          <span>TABULADOR DE PRODUCTOS</span>
          {!isView && (
            <>
              <button
                onClick={() => setShowNuevoForm(!showNuevoForm)}
                className={`px-4 py-1 rounded text-xs font-medium ${
                  showNuevoForm
                    ? 'bg-[#0099CC] text-white'
                    : 'bg-white border border-gray-400 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Nuevo
              </button>
              <button
                onClick={handleEliminarSeleccionados}
                disabled={!algunoSeleccionado}
                className="px-4 py-1 rounded text-xs font-medium bg-white border border-gray-400 text-gray-700 hover:bg-gray-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Eliminar
              </button>
            </>
          )}
        </div>

        {/* Formulario Nuevo */}
        {showNuevoForm && !isView && (
          <div className="mb-4 bg-blue-50 p-3 border border-blue-200 rounded">
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-x-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Plazo <span className="text-red-600">*</span></label>
                  <input 
                    type="number"
                    value={nuevoItem.plazo || ''}
                    onChange={(e) => setNuevoItem({ ...nuevoItem, plazo: parseFloat(e.target.value) || 0 })}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Tasa de interés <span className="text-red-600">*</span></label>
                  <input 
                    type="number"
                    step="0.1"
                    value={nuevoItem.tasaInteres || ''}
                    onChange={(e) => setNuevoItem({ ...nuevoItem, tasaInteres: parseFloat(e.target.value) || 0 })}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="0.0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Monto solicitado <span className="text-red-600">*</span></label>
                  <input 
                    type="number"
                    step="0.01"
                    value={nuevoItem.montoSolicitado || ''}
                    onChange={(e) => setNuevoItem({ ...nuevoItem, montoSolicitado: parseFloat(e.target.value) || 0 })}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-x-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Monto total a pagar <span className="text-red-600">*</span></label>
                  <input 
                    type="number"
                    step="0.01"
                    value={nuevoItem.montoTotalPagar || ''}
                    onChange={(e) => setNuevoItem({ ...nuevoItem, montoTotalPagar: parseFloat(e.target.value) || 0 })}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">Pago quincenal <span className="text-red-600">*</span></label>
                  <input 
                    type="number"
                    step="0.01"
                    value={nuevoItem.pagoQuincenal || ''}
                    onChange={(e) => setNuevoItem({ ...nuevoItem, pagoQuincenal: parseFloat(e.target.value) || 0 })}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleNuevo}
              disabled={!nuevoItem.plazo || !nuevoItem.tasaInteres || !nuevoItem.montoSolicitado}
              className="mt-3 px-4 py-1 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB] font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Agregar
            </button>
          </div>
        )}

        {/* Tabla */}
        <div className="border border-gray-300">
          <table className="w-full text-xs">
            <thead className="bg-[#E8E8E8]">
              <tr>
                {!isView && (
                  <th className="text-center px-2 py-1 font-medium text-gray-700 border-b border-gray-300 border-r border-gray-300 w-12">
                    <input
                      type="checkbox"
                      checked={todosSeleccionados}
                      onChange={(e) => handleSeleccionarTodos(e.target.checked)}
                      className="w-4 h-4"
                    />
                  </th>
                )}
                <th className="text-center px-2 py-1 font-medium text-gray-700 border-b border-gray-300 border-r border-gray-300">Plazo</th>
                <th className="text-center px-2 py-1 font-medium text-gray-700 border-b border-gray-300 border-r border-gray-300">Tasa de interés</th>
                <th className="text-right px-2 py-1 font-medium text-gray-700 border-b border-gray-300 border-r border-gray-300">Monto solicitado</th>
                <th className="text-right px-2 py-1 font-medium text-gray-700 border-b border-gray-300 border-r border-gray-300">Monto total a pagar</th>
                <th className="text-right px-2 py-1 font-medium text-gray-700 border-b border-gray-300">Pago quincenal</th>
              </tr>
            </thead>
            <tbody>
              {datos.length === 0 ? (
                <tr>
                  <td colSpan={isView ? 5 : 6} className="px-2 py-3 text-center text-gray-500 text-xs">
                    No hay registros
                  </td>
                </tr>
              ) : (
                datos.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {!isView && (
                      <td className="text-center px-2 py-1 border-b border-gray-200 border-r border-gray-300">
                        <input
                          type="checkbox"
                          checked={item.seleccionado}
                          onChange={() => handleToggleSeleccion(item.id)}
                          className="w-4 h-4"
                        />
                      </td>
                    )}
                    <td className="text-center px-2 py-1 border-b border-gray-200 border-r border-gray-300 text-gray-900">{item.plazo}</td>
                    <td className="text-center px-2 py-1 border-b border-gray-200 border-r border-gray-300 text-gray-900">{formatPercent(item.tasaInteres)}</td>
                    <td className="text-right px-2 py-1 border-b border-gray-200 border-r border-gray-300 text-gray-900">{formatCurrency(item.montoSolicitado)}</td>
                    <td className="text-right px-2 py-1 border-b border-gray-200 border-r border-gray-300 text-gray-900">{formatCurrency(item.montoTotalPagar)}</td>
                    <td className="text-right px-2 py-1 border-b border-gray-200 text-gray-900">{formatCurrency(item.pagoQuincenal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

TabuladorProductosTab.displayName = 'TabuladorProductosTab';