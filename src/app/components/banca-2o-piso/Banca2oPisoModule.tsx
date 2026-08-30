/**
 * Banca2oPisoModule.tsx — REQ-17.
 *
 * Módulo de administración de las cuentas de **Línea de Crédito activas**. Sigue el
 * estándar del módulo Solicitudes: sub-navegación **Inicio | Lista**, dashboard con
 * KPIs y gráficas, listado institucional y detalle por subpestañas.
 *
 * Reusa componentes existentes en lugar de duplicarlos: `DefaultTab` y
 * `SolicitudesExtTab` de cartera, y `ExpedienteElectronicoTab` de solicitudes en modo
 * sólo lectura. El filtro y el hook de datos viven en `banca2oPisoStore`, para que
 * `CarteraList` pueda importar el criterio sin arrastrar aquí sus gráficas.
 *
 * Decisiones aplicadas de la HU:
 *   #1 Disposiciones — sin modelo de datos: pestaña visible y declarada como pendiente.
 *   #2 Exclusión de Cartera Crédito vía `esLineaCredito2oPisoRow`.
 *   #3 "Activa" = Activa / Autorizada / En Administración.
 *   #4 Términos y Condiciones de sólo lectura sobre `terminos_condiciones._raw`.
 *   #5 Filtra por Línea de Producto = Línea de Crédito (no sólo el producto GPO).
 */
import { useState } from 'react';
import { Banca2oPisoDashboard } from './Banca2oPisoDashboard';
import { Banca2oPisoList } from './Banca2oPisoList';
import { Banca2oPisoDetalle } from './Banca2oPisoDetalle';
import { useLineasCreditoActivas, type LineaCreditoRow } from './banca2oPisoStore';

export { esLineaCredito2oPisoRow, ESTATUS_ACTIVOS_2O_PISO } from './banca2oPisoStore';
export type { LineaCreditoRow } from './banca2oPisoStore';

type ViewState =
  | { type: 'inicio' }
  | { type: 'lista' }
  | { type: 'detalle'; row: LineaCreditoRow };

export function Banca2oPisoModule() {
  const { rows, loading, error, refetch } = useLineasCreditoActivas();
  const [view, setView] = useState<ViewState>({ type: 'inicio' });

  return (
    <>
      {/* Sub-navegación institucional — mismo patrón que el módulo Solicitudes */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => setView({ type: 'inicio' })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              view.type === 'inicio' ? 'tab-active' : 'tab-inactive'
            }`}
            title="Dashboard de Banca 2º Piso"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z" />
              <path d="M6 14v-5h4v5" />
            </svg>
            <span>Inicio</span>
          </button>
          <button
            onClick={() => setView({ type: 'lista' })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              view.type === 'lista' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3h10M3 8h10M3 13h10" />
            </svg>
            <span>Lista de Líneas</span>
          </button>
          {view.type === 'detalle' && (
            <button className="flex items-center gap-2 px-3 py-1.5 rounded text-sm tab-active">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 13l8-8 2 2-8 8H3v-2z" />
              </svg>
              <span>{view.row.noCuenta || view.row.noSol}</span>
            </button>
          )}
        </div>
      </div>

      {view.type === 'inicio' ? (
        <Banca2oPisoDashboard
          rows={rows}
          loading={loading}
          error={error}
          onGoToList={() => setView({ type: 'lista' })}
        />
      ) : view.type === 'lista' ? (
        <Banca2oPisoList
          rows={rows}
          loading={loading}
          error={error}
          refetch={refetch}
          onVer={row => setView({ type: 'detalle', row })}
        />
      ) : (
        <Banca2oPisoDetalle row={view.row} onBack={() => setView({ type: 'lista' })} />
      )}
    </>
  );
}
