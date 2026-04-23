import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useClienteSubtabList } from '@/app/hooks/useClientePersistence';
import { registrarMovimientoCuentaEje } from '@/app/hooks/useCuentasAhorroDB';

interface MovimientosProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
  /** Saldo actual de la Cuenta Eje (desde formData del cliente) */
  saldoCuentaEje?: string;
  /** Callback para actualizar el saldo de la Cuenta Eje en el padre */
  onSaldoChange?: (nuevoSaldo: string) => void;
}

interface MovimientoData {
  id: number;
  fechaHora: string;
  saldoInicial: string;
  tipoMovimiento: string;
  concepto: string;
  referencia: string;
  montoMovimiento: string;
  saldoFinal: string;
}

export function Movimientos({ onBack, mode, clienteId, saldoCuentaEje, onSaldoChange }: MovimientosProps) {
  const isView = mode === 'ver';
  const storageKey = `cliente_${clienteId || 'temp'}_movimientos`;
  
  const getCurrentDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const seconds = String(today.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const parseMoney = (val: string): number => {
    if (!val) return 0;
    return parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  };

  const formatMoney = (val: number): string => {
    return `$ ${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Estado con persistencia vinculada al clienteId
  const [movimientos, setMovimientos] = useState<MovimientoData[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [selectedMovimientos, setSelectedMovimientos] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  
  // Catálogos
  const tiposMovimiento = ['Cargo', 'Abono'];
  
  // Concepto fijo según spec
  const CONCEPTO_FIJO = 'Cargo abierto';

  const [formularioMovimiento, setFormularioMovimiento] = useState<MovimientoData>({
    id: movimientos.length + 1,
    fechaHora: getCurrentDate(),
    saldoInicial: '',
    tipoMovimiento: '',
    concepto: CONCEPTO_FIJO,
    referencia: '',
    montoMovimiento: '',
    saldoFinal: ''
  });

  // Persistir movimientos en sessionStorage
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(movimientos));
  }, [movimientos, storageKey]);

  // Calcular saldo final automáticamente
  useEffect(() => {
    const saldoInicial = parseMoney(formularioMovimiento.saldoInicial);
    const monto = parseMoney(formularioMovimiento.montoMovimiento);
    
    if (formularioMovimiento.tipoMovimiento && monto > 0) {
      let saldoFinal = saldoInicial;
      
      if (formularioMovimiento.tipoMovimiento === 'Cargo') {
        saldoFinal = saldoInicial - monto;
      } else if (formularioMovimiento.tipoMovimiento === 'Abono') {
        saldoFinal = saldoInicial + monto;
      }
      
      setFormularioMovimiento(prev => ({
        ...prev,
        saldoFinal: formatMoney(saldoFinal)
      }));
    }
  }, [formularioMovimiento.saldoInicial, formularioMovimiento.montoMovimiento, formularioMovimiento.tipoMovimiento]);

  const handleFormFieldChange = (field: keyof MovimientoData, value: any) => {
    setFormularioMovimiento(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNuevo = () => {
    // Saldo inicial: último saldoFinal de movimientos, o saldoCuentaEje del cliente, o $ 0.00
    let ultimoSaldo = '$ 0.00';
    if (movimientos.length > 0) {
      ultimoSaldo = movimientos[movimientos.length - 1].saldoFinal;
    } else if (saldoCuentaEje && parseMoney(saldoCuentaEje) > 0) {
      ultimoSaldo = formatMoney(parseMoney(saldoCuentaEje));
    }
    
    setFormularioMovimiento({
      id: movimientos.length + 1,
      fechaHora: getCurrentDate(),
      saldoInicial: ultimoSaldo,
      tipoMovimiento: '',
      concepto: CONCEPTO_FIJO,
      referencia: '',
      montoMovimiento: '',
      saldoFinal: ''
    });
    setShowModal(true);
  };

  const handleEliminar = () => {
    if (selectedMovimientos.length === 0) {
      toast.error('Por favor seleccione al menos un movimiento para eliminar');
      return;
    }

    setMovimientos(prev => prev.filter(m => !selectedMovimientos.includes(m.id)));
    const count = selectedMovimientos.length;
    setSelectedMovimientos([]);
    toast.success(`${count} movimiento${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  const handleGuardar = () => {
    // Validaciones
    if (!formularioMovimiento.tipoMovimiento) {
      toast.error('El Tipo de Movimiento es obligatorio');
      return;
    }

    if (!formularioMovimiento.referencia || formularioMovimiento.referencia.trim() === '') {
      toast.error('La Referencia es obligatoria');
      return;
    }

    if (!formularioMovimiento.montoMovimiento) {
      toast.error('El Monto del Movimiento es obligatorio');
      return;
    }

    const monto = parseMoney(formularioMovimiento.montoMovimiento);
    if (isNaN(monto) || monto <= 0) {
      toast.error('El Monto del Movimiento debe ser un número mayor a 0');
      return;
    }

    const saldoInicial = parseMoney(formularioMovimiento.saldoInicial);
    const saldoFinal = formularioMovimiento.tipoMovimiento === 'Cargo'
      ? saldoInicial - monto
      : saldoInicial + monto;

    // Validar que el saldo final no sea negativo
    if (saldoFinal < 0) {
      toast.error('Saldo insuficiente', {
        description: `El saldo final sería negativo (${formatMoney(saldoFinal)}). No se puede realizar este cargo.`
      });
      return;
    }

    // Construir el movimiento final con saldoFinal recalculado
    const nuevoMovimiento: MovimientoData = {
      ...formularioMovimiento,
      concepto: CONCEPTO_FIJO,
      saldoFinal: formatMoney(saldoFinal)
    };

    // Agregar el movimiento
    const nuevosMovimientos = [...movimientos, nuevoMovimiento];
    setMovimientos(nuevosMovimientos);

    // Actualizar el saldo de la Cuenta Eje en el padre
    if (onSaldoChange) {
      onSaldoChange(formatMoney(saldoFinal));
    }

    setShowModal(false);
    toast.success('Movimiento agregado exitosamente');

    // Persistir en J_CUENTAS_CORP_CLIENTES (fire-and-forget con feedback)
    if (clienteId) {
      registrarMovimientoCuentaEje(
        String(clienteId),
        {
          id: nuevoMovimiento.id,
          fechaHora: nuevoMovimiento.fechaHora,
          tipo: nuevoMovimiento.tipoMovimiento,
          concepto: nuevoMovimiento.concepto,
          referencia: nuevoMovimiento.referencia,
          monto: parseMoney(nuevoMovimiento.montoMovimiento),
          saldoInicial: parseMoney(nuevoMovimiento.saldoInicial),
          saldoFinal,
        },
        saldoFinal,
      ).then(result => {
        if (!result.ok) {
          toast.warning('Movimiento guardado localmente. No se pudo sincronizar con la base de datos.', {
            description: result.error,
          });
        }
      });
    }
  };

  const handleCancelar = () => {
    setShowModal(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMovimientos(movimientos.map(m => m.id));
    } else {
      setSelectedMovimientos([]);
    }
  };

  const handleSelectMovimiento = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedMovimientos(prev => [...prev, id]);
    } else {
      setSelectedMovimientos(prev => prev.filter(mid => mid !== id));
    }
  };

  return (
    <div className="bg-white">
      {/* Encabezado institucional */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">MOVIMIENTOS</span>
        {!isView && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleNuevo}
              className="px-3 py-1 bg-primary-theme text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91]"
            >
              Nuevo
            </button>
            <button
              onClick={handleEliminar}
              disabled={selectedMovimientos.length === 0}
              className="px-3 py-1 bg-white border border-gray-400 text-gray-700 text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Tabla de Movimientos */}
      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
              <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={movimientos.length > 0 && selectedMovimientos.length === movimientos.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                  disabled={isView}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha y Hora</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Saldo Inicial</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tipo de Movimiento</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Concepto</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Referencia</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Monto del Movimiento</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800">Saldo Final</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-gray-500">
                  No hay movimientos registrados. Haga clic en "Nuevo" para agregar uno.
                </td>
              </tr>
            ) : (
              movimientos.map((movimiento) => (
                <tr 
                  key={movimiento.id} 
                  className={`border-b border-gray-300 hover:bg-gray-50 ${selectedMovimientos.includes(movimiento.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-3 py-2 text-center border-r border-gray-300">
                    <input
                      type="checkbox"
                      checked={selectedMovimientos.includes(movimiento.id)}
                      onChange={(e) => handleSelectMovimiento(movimiento.id, e.target.checked)}
                      className="w-4 h-4"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isView}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{movimiento.fechaHora}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{movimiento.saldoInicial}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{movimiento.tipoMovimiento}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{movimiento.concepto}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{movimiento.referencia}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{movimiento.montoMovimiento}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{movimiento.saldoFinal}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal institucional para agregar nuevo movimiento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header azul institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">Nuevo Movimiento</h3>
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
              <div className="py-4">
                <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
                  <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DEL MOVIMIENTO</h3>
                </div>

                <div className="space-y-4">
                  {/* Fila 1: Fecha y Hora, Saldo Inicial */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Fecha y Hora
                      </label>
                      <input
                        type="text"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                        value={formularioMovimiento.fechaHora}
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Saldo Inicial
                      </label>
                      <input
                        type="text"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                        value={formularioMovimiento.saldoInicial}
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Fila 2: Tipo de Movimiento, Concepto */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Tipo de Movimiento <span className="text-red-600">*</span>
                      </label>
                      <select
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                        value={formularioMovimiento.tipoMovimiento}
                        onChange={(e) => handleFormFieldChange('tipoMovimiento', e.target.value)}
                      >
                        <option value="">Seleccione...</option>
                        {tiposMovimiento.map(tipo => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Concepto
                      </label>
                      <input
                        type="text"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                        value={CONCEPTO_FIJO}
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Fila 3: Referencia, Monto del Movimiento */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Referencia <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                        value={formularioMovimiento.referencia}
                        onChange={(e) => handleFormFieldChange('referencia', e.target.value)}
                        placeholder="Ej: REF-001, Transferencia..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">
                        Monto del Movimiento <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                        value={formularioMovimiento.montoMovimiento}
                        onChange={(e) => handleFormFieldChange('montoMovimiento', e.target.value)}
                        placeholder="$ 0.00"
                      />
                    </div>
                  </div>

                  {/* Fila 4: Saldo Final (calculado) */}
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">
                      Saldo Final (Calculado automáticamente)
                    </label>
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                      value={formularioMovimiento.saldoFinal || '—'}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={handleCancelar}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90 font-medium"
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
