/**
 * CuentaAhorro.tsx — Subtab de Cuentas de Ahorro dentro del módulo Clientes
 *
 * Muestra las cuentas de ahorro reales de J_CUENTAS_CORP_CLIENTES
 * filtradas por cliente_id (UUID del cliente actual).
 *
 * Fuente de datos:
 *   1. useCuentasAhorroDB — RPC get_cuentas_ahorro → filtro cliente_id
 *   2. sessionStorage fallback (cuentas_ahorro_local)
 *
 * Funcionalidad "Cuenta Principal":
 *   - La cuenta creada automáticamente al activar un prospecto se marca
 *     como principal (cta_eje_chec = true).
 *   - En modo editar, el usuario puede cambiar cuál es la cuenta principal
 *     haciendo clic en el radio de otra cuenta. Solo una cuenta puede ser
 *     principal a la vez (la anterior se desmarca).
 *   - En modo ver, se muestra el indicador pero no se puede cambiar.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCuentasAhorroDB } from '@/app/hooks/useCuentasAhorroDB';
import type { CuentaAhorroListItem } from '@/app/hooks/useCuentasAhorroDB';
import { getCuentaAhorroById } from '@/app/hooks/useCuentasAhorroDB';

interface CuentaAhorroProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
  onCuentaEjeChange?: (saldo: string, numeroCuenta: string) => void;
}

const LOG = '[CuentaAhorro-Cliente]';

export function CuentaAhorro({ onBack, mode, clienteId, onCuentaEjeChange }: CuentaAhorroProps) {
  const isView = mode === 'ver';
  const isNuevo = mode === 'nuevo';
  const { cuentas: allCuentas, loading, backendStatus, updateCuenta } = useCuentasAhorroDB();

  const [selectedCuentas, setSelectedCuentas] = useState<string[]>([]);
  const [changingPrincipal, setChangingPrincipal] = useState<string | null>(null);

  const onCuentaEjeChangeRef = useRef(onCuentaEjeChange);
  useEffect(() => {
    onCuentaEjeChangeRef.current = onCuentaEjeChange;
  }, [onCuentaEjeChange]);

  const cid = String(clienteId || '');


  // ═══════════════════════════════════════════════════════════════════
  // FILTRAR CUENTAS POR CLIENTE_ID
  // ═══════════════════════════════════════════════════════════════════
  const cuentasCliente = useMemo(() => {
    if (!cid) return [];
    const result: CuentaAhorroListItem[] = [];
    for (const c of allCuentas) {
      if (c.clienteId !== cid) continue;
      result.push(c);
    }
    console.log(`${LOG} cuentasCliente: total=${allCuentas.length} del cliente=${result.length}`);
    return result;
  }, [allCuentas, cid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notificar cambios de cuenta eje
  useEffect(() => {
    const cuentaEje = cuentasCliente.find(c => c.ctaEjeChec);
    if (cuentaEje && onCuentaEjeChangeRef.current) {
      onCuentaEjeChangeRef.current(
        cuentaEje.saldoActual.toFixed(2),
        cuentaEje.noCuenta
      );
    }
  }, [cuentasCliente]);

  // ═══════════════════════════════════════════════════════════════════
  // CAMBIAR CUENTA PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════
  const handleSetPrincipal = useCallback(async (cuentaId: string) => {
    if (isView || isNuevo || changingPrincipal) return;

    const cuenta = cuentasCliente.find(c => c.id === cuentaId);
    if (!cuenta || cuenta.ctaEjeChec) return; // ya es la principal

    setChangingPrincipal(cuentaId);
    console.log(`${LOG} Cambiando cuenta principal → ${cuentaId}`);

    try {
      // 1) Desmarcar la cuenta principal actual
      const actualPrincipal = cuentasCliente.find(c => c.ctaEjeChec);
      if (actualPrincipal) {
        console.log(`${LOG} Desmarcando cuenta principal anterior: ${actualPrincipal.id}`);
        const oldResult = await getCuentaAhorroById(actualPrincipal.id);
        if (oldResult.ok && oldResult.row) {
          await updateCuenta({
            p_id: oldResult.row.id,
            p_no_sol: oldResult.row.no_sol || '',
            p_no_cuenta: oldResult.row.no_cuenta || '',
            p_cta_eje_chec: false,
          });
        }
      }

      // 2) Marcar la nueva cuenta como principal
      console.log(`${LOG} Marcando nueva cuenta principal: ${cuentaId}`);
      const newResult = await getCuentaAhorroById(cuentaId);
      if (newResult.ok && newResult.row) {
        await updateCuenta({
          p_id: newResult.row.id,
          p_no_sol: newResult.row.no_sol || '',
          p_no_cuenta: newResult.row.no_cuenta || '',
          p_cta_eje_chec: true,
        });
      }

      // allCuentas se actualizará vía fetchAll() llamado dentro de updateCuenta
      console.log(`${LOG} Cuenta principal cambiada exitosamente a ${cuentaId}`);
    } catch (err) {
      console.error(`${LOG} Error cambiando cuenta principal:`, err);
    } finally {
      setChangingPrincipal(null);
    }
  }, [isView, isNuevo, changingPrincipal, cuentasCliente, updateCuenta]);

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════
  const formatDate = (d: string) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return d; }
  };

  const formatMoney = (n: number) => {
    return `$ ${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const estatusBadge = (estatus: string) => {
    const cls =
      estatus === 'Activa' || estatus === 'Activo' ? 'bg-green-100 text-green-800' :
      estatus === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
      estatus === 'Cancelada' || estatus === 'Cancelado' ? 'bg-red-100 text-red-800' :
      'bg-gray-100 text-gray-800';
    return <span className={`inline-block px-2 py-0.5 rounded text-xs ${cls}`}>{estatus || '—'}</span>;
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="bg-white">
      {/* Encabezado institucional */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-800">CUENTAS DE AHORRO</span>
          {backendStatus === 'connected' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-green-50 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> DB
            </span>
          )}
          {backendStatus === 'local-only' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
              Local
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {loading ? 'Cargando...' : `${cuentasCliente.length} cuenta(s)`}
          </span>
        </div>
      </div>

      {/* Leyenda de cuenta principal */}
      {!loading && cuentasCliente.length > 0 && (
        <div className="mb-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </span>
          <span className="text-[11px] text-amber-800">
            <strong>Cuenta Principal</strong> — La cuenta marcada con{' '}
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-400 align-middle mx-0.5">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            </span>{' '}
            es la cuenta eje del cliente.
            {!isView && !isNuevo && ' Haz clic en otra cuenta para cambiarla.'}
          </span>
        </div>
      )}

      {/* Info de cliente */}
      {clienteId && (
        <div className="mb-3 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500">
          <span className="text-gray-400">Filtro cliente_id:</span> {String(clienteId)}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-6 w-6 text-[#4A6FA5] mr-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-gray-500">Consultando J_CUENTAS_CORP_CLIENTES...</span>
        </div>
      )}

      {/* Tabla */}
      {!loading && (
        <div className="border border-gray-300">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2 text-center text-xs text-gray-700 border-r border-gray-300 w-[70px]">Principal</th>
                <th className="px-3 py-2 text-left text-xs text-gray-700 border-r border-gray-300">No. Solicitud</th>
                <th className="px-3 py-2 text-left text-xs text-gray-700 border-r border-gray-300">No. Cuenta</th>
                <th className="px-3 py-2 text-left text-xs text-gray-700 border-r border-gray-300">Fecha Solicitud</th>
                <th className="px-3 py-2 text-left text-xs text-gray-700 border-r border-gray-300">Fecha Autorización</th>
                <th className="px-3 py-2 text-left text-xs text-gray-700 border-r border-gray-300">Producto</th>
                <th className="px-3 py-2 text-right text-xs text-gray-700 border-r border-gray-300">Saldo Actual</th>
                <th className="px-3 py-2 text-center text-xs text-gray-700 border-r border-gray-300">Est. Cuenta</th>
                <th className="px-3 py-2 text-center text-xs text-gray-700 border-r border-gray-300">Est. Solicitud</th>
                <th className="px-3 py-2 text-center text-xs text-gray-700">Est. Cartera</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {cuentasCliente.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-xs text-gray-500">
                    {isNuevo
                      ? 'Las cuentas de ahorro se pueden asociar después de guardar el cliente.'
                      : 'No hay cuentas de ahorro asociadas a este cliente en J_CUENTAS_CORP_CLIENTES.'}
                  </td>
                </tr>
              ) : (
                cuentasCliente.map(cuenta => {
                  const isPrincipal = cuenta.ctaEjeChec;
                  const isChanging = changingPrincipal === cuenta.id;
                  const canChange = !isView && !isNuevo && !changingPrincipal;

                  return (
                    <tr
                      key={cuenta.id}
                      className={`border-b border-gray-300 transition-colors ${
                        isPrincipal
                          ? 'bg-amber-50/60 hover:bg-amber-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* ── Columna PRINCIPAL ── */}
                      <td className="px-3 py-2 text-center border-r border-gray-300">
                        {isPrincipal ? (
                          /* Cuenta principal activa — estrella dorada + badge */
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 shadow-sm">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            </span>
                            <span className="text-[9px] text-amber-700 whitespace-nowrap">Cta. Eje</span>
                          </div>
                        ) : (
                          /* Cuenta no principal — botón radio para seleccionar */
                          <button
                            type="button"
                            disabled={!canChange}
                            onClick={() => handleSetPrincipal(cuenta.id)}
                            className={`group inline-flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all ${
                              canChange
                                ? 'border-gray-300 hover:border-amber-400 hover:bg-amber-50 cursor-pointer'
                                : 'border-gray-200 cursor-default opacity-50'
                            }`}
                            title={canChange ? 'Establecer como cuenta principal' : (isView ? 'Solo lectura' : '')}
                          >
                            {isChanging ? (
                              <svg className="animate-spin h-3 w-3 text-amber-500" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <span className={`w-2 h-2 rounded-full transition-colors ${
                                canChange ? 'bg-transparent group-hover:bg-amber-300' : ''
                              }`} />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                        {cuenta.noSol || cuenta.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                        <span className={isPrincipal ? 'text-amber-800' : ''}>
                          {cuenta.noCuenta || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                        {formatDate(cuenta.fechaSol)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                        {formatDate(cuenta.fechaAutori)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                        {cuenta.productoNombre || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">
                        {formatMoney(cuenta.saldoActual)}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-gray-300">
                        {estatusBadge(cuenta.estatusCuen)}
                      </td>
                      <td className="px-3 py-2 text-center border-r border-gray-300">
                        {estatusBadge(cuenta.estatusSol)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {estatusBadge(cuenta.estatusCart)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Nota informativa */}
      {!loading && cuentasCliente.length > 0 && (
        <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-700">
          Las cuentas de ahorro se administran desde el módulo <strong>Captación → Cuentas de Ahorro</strong>.
          {isView
            ? ' Aquí se muestran en modo consulta.'
            : ' Puede cambiar la cuenta principal haciendo clic en el radio de otra cuenta.'}
        </div>
      )}
    </div>
  );
}
