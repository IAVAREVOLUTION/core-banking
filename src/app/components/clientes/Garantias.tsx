/**
 * Clientes → Subtab Garantías (Solo Consulta)
 *
 * ═══════════════════════════════════════════════════════════════════
 * REGLAS INSTITUCIONALES:
 *   - Módulo de SOLO LECTURA
 *   - Muestra las garantías asociadas al cliente desde J_GARANTIAS
 *   - WHERE cliente_id = <clienteId>
 *   - Sin botones de Asociar / Desasociar / Nuevo / Eliminar
 * ═══════════════════════════════════════════════════════════════════
 */
import { useMemo } from 'react';
import { useGarantiasDB } from '@/app/hooks/useGarantiasDB';

interface GarantiasProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
}

export function Garantias({ onBack: _onBack, mode: _mode, clienteId }: GarantiasProps) {
  const clienteIdStr = clienteId?.toString() || '';

  // ── Hook DB — trae TODAS las garantías de J_GARANTIAS ──
  const {
    garantias: todasGarantias,
    loading,
    backendStatus,
  } = useGarantiasDB(true);

  // ── Garantías del cliente actual ──
  const garantiasCliente = useMemo(() => {
    if (!clienteIdStr) return [];
    return todasGarantias.filter(g => g.cliente_id === clienteIdStr);
  }, [todasGarantias, clienteIdStr]);

  // ── Formateo ──
  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(value);
  };

  const truncateId = (id: string | number): string => {
    const s = String(id);
    return s.length > 12 ? s.substring(0, 8) + '...' : s;
  };

  return (
    <div className="flex-1">
      {/* Encabezado institucional */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">GARANTÍAS DEL CLIENTE</span>
      </div>

      {/* Info banner */}
      {backendStatus === 'pending-deploy' && (
        <div className="mx-0 mb-2 px-3 py-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
          RPCs no disponibles. Ejecutar <code className="bg-yellow-100 px-1 rounded">migration-jgarantias-rpcs.sql</code> en Supabase SQL Editor.
        </div>
      )}

      {/* Tabla de garantías del cliente */}
      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Garantía</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tipo</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Subtipo</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-gray-800 border-r border-gray-300">Valor Nominal</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Registro</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800">Ubicación</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-[#0099CC]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Cargando garantías desde J_GARANTIAS...
                  </div>
                </td>
              </tr>
            ) : garantiasCliente.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-500">
                  <div className="flex flex-col items-center gap-1">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M3 9h18M9 3v18"/>
                    </svg>
                    <span>Este cliente no tiene garantías asociadas.</span>
                  </div>
                </td>
              </tr>
            ) : (
              garantiasCliente.map(garantia => (
                <tr
                  key={garantia.id}
                  className="border-b border-gray-300 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                    <span title={String(garantia.id)}>{garantia.garantia || truncateId(garantia.id)}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{garantia.tipo || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{garantia.subtipo || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">
                    {garantia.valorNominal ? formatCurrency(garantia.valorNominal) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{formatDate(garantia.fechaRegistro)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{garantia.ubicacion || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="mt-2 text-right text-xs text-gray-500">
        {garantiasCliente.length} garantía{garantiasCliente.length !== 1 ? 's' : ''} asociada{garantiasCliente.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
