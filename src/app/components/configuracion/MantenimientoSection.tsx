// ═══════════════════════════════════════════════════════════════════
// MantenimientoSection.tsx — Panel de Mantenimiento de BD v2.0
//
// Ejecuta tareas pendientes contra la Edge Function:
//   1. Verificar despliegue de Edge Function v19.0
//   2. Limpiar clasificacionCliente: "Gobierno Magisterio"
//   3. Reparar prospectos legacy corrompidos por compactación v3.5
//   4. Detectar y limpiar expedientes con blob URLs inválidas
//   5. Verificar y sincronizar par_cliente_id
//   6. Diagnóstico crudo de J_CLIENTES
//
// Logging: [Mantenimiento]
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Wrench, Trash2, RefreshCw, Shield, CheckCircle, AlertTriangle,
  Database, Link2, FileWarning, Loader2, Copy, Terminal, ChevronDown,
  ChevronRight, Clock, Zap, Activity, Server
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { resetCuentaEjeValidationCache } from '../../hooks/useValidacionCuentaEje';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

interface TaskResult {
  status: 'idle' | 'running' | 'success' | 'error';
  message: string;
  details?: any;
  timestamp?: string;
  durationMs?: number;
}

const INITIAL_TASKS: Record<string, TaskResult> = {
  verifyDeploy: { status: 'idle', message: '' },
  cleanClasificacion: { status: 'idle', message: '' },
  repairProspectos: { status: 'idle', message: '' },
  detectInvalidUrls: { status: 'idle', message: '' },
  cleanInvalidUrls: { status: 'idle', message: '' },
  verifyParClienteId: { status: 'idle', message: '' },
  syncParClienteId: { status: 'idle', message: '' },
  diagnosticoDB: { status: 'idle', message: '' },
  resetValidationCache: { status: 'idle', message: '' },
};

const SESSION_KEY = 'mantenimiento_last_run';

async function apiCall(method: string, path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no-JSON (HTTP ${res.status}): ${text.substring(0, 200)}`);
  }
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('es-MX', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return ts; }
}

export function MantenimientoSection() {
  const [tasks, setTasks] = useState<Record<string, TaskResult>>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Re-set running tasks to idle (in case of page reload during execution)
        for (const key of Object.keys(parsed)) {
          if (parsed[key].status === 'running') parsed[key].status = 'idle';
        }
        return { ...INITIAL_TASKS, ...parsed };
      }
    } catch { /* ignore */ }
    return { ...INITIAL_TASKS };
  });
  const [showDeployGuide, setShowDeployGuide] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [edgeVersion, setEdgeVersion] = useState<string | null>(null);
  const [edgeDeploy, setEdgeDeploy] = useState<string | null>(null);

  // Persist results to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(tasks));
    } catch { /* ignore */ }
  }, [tasks]);

  const updateTask = (key: string, update: Partial<TaskResult>) => {
    setTasks(prev => ({
      ...prev,
      [key]: { ...prev[key], ...update, timestamp: new Date().toISOString() },
    }));
  };

  const runWithTiming = async (key: string, fn: () => Promise<void>) => {
    const start = Date.now();
    updateTask(key, { status: 'running', message: 'Ejecutando...', durationMs: undefined });
    try {
      await fn();
      setTasks(prev => ({
        ...prev,
        [key]: { ...prev[key], durationMs: Date.now() - start },
      }));
    } catch (err) {
      updateTask(key, { status: 'error', message: String(err), durationMs: Date.now() - start });
    }
  };

  // ── 1. Verificar despliegue de Edge Function ──
  // Returns true if Edge Function is reachable
  const handleVerifyDeploy = async (): Promise<boolean> => {
    let ok = false;
    await runWithTiming('verifyDeploy', async () => {
      const result = await apiCall('GET', '/health');
      const version = result.version || '(sin versión)';
      const deploy = result.deploy || '(sin timestamp)';
      setEdgeVersion(version);
      setEdgeDeploy(deploy);
      updateTask('verifyDeploy', {
        status: 'success',
        message: `${version} | Deploy: ${deploy}`,
        details: result,
      });
      console.log('[Mantenimiento] Health check:', result);
      ok = true;
    });
    return ok;
  };

  // ── 2. Limpiar clasificacionCliente: "Gobierno Magisterio" ──
  const handleCleanClasificacion = async () => {
    await runWithTiming('cleanClasificacion', async () => {
      const result = await apiCall('POST', '/mantenimiento/clean-clasificacion');
      if (result.success) {
        updateTask('cleanClasificacion', {
          status: 'success',
          message: `${result.cleaned} registro(s) limpiados`,
          details: result.records,
        });
        toast.success(`${result.cleaned} registros limpiados de clasificacionCliente "Gobierno Magisterio"`);
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    });
  };

  // ── 3. Reparar prospectos legacy ──
  const handleRepairProspectos = async () => {
    await runWithTiming('repairProspectos', async () => {
      const result = await apiCall('POST', '/mantenimiento/repair-legacy-prospectos');
      if (result.success) {
        updateTask('repairProspectos', {
          status: 'success',
          message: `${result.repaired} prospecto(s) reparados`,
          details: result.records,
        });
        toast.success(`${result.repaired} prospectos legacy reparados`);
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    });
  };

  // ── 4. Detectar expedientes con blob URLs ──
  const handleDetectInvalidUrls = async () => {
    await runWithTiming('detectInvalidUrls', async () => {
      const result = await apiCall('GET', '/mantenimiento/detect-invalid-urls');
      if (result.success) {
        updateTask('detectInvalidUrls', {
          status: result.invalidCount > 0 ? 'error' : 'success',
          message: result.invalidCount > 0
            ? `${result.invalidCount} expediente(s) con URLs inválidas encontrados`
            : 'No se encontraron URLs inválidas',
          details: result.records,
        });
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    });
  };

  // ── 5. Limpiar blob URLs inválidas ──
  const handleCleanInvalidUrls = async () => {
    await runWithTiming('cleanInvalidUrls', async () => {
      const result = await apiCall('POST', '/mantenimiento/reupload-invalid-expedientes');
      if (result.success) {
        updateTask('cleanInvalidUrls', {
          status: 'success',
          message: `${result.totalCleaned} URL(s) limpiadas en ${result.affectedRecords} registro(s)`,
          details: result.records,
        });
        toast.success(`${result.totalCleaned} blob URLs limpiadas`);
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    });
  };

  // ── 6. Verificar par_cliente_id ──
  const handleVerifyParClienteId = async () => {
    await runWithTiming('verifyParClienteId', async () => {
      const result = await apiCall('GET', '/mantenimiento/verify-par-cliente-id');
      if (result.success) {
        updateTask('verifyParClienteId', {
          status: result.discrepancies > 0 ? 'error' : 'success',
          message: `${result.total} registros con inst. gobierno, ${result.discrepancies} discrepancias`,
          details: result.records,
        });
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    });
  };

  // ── 7. Sincronizar par_cliente_id ──
  const handleSyncParClienteId = async () => {
    await runWithTiming('syncParClienteId', async () => {
      const result = await apiCall('POST', '/mantenimiento/sync-par-cliente-id');
      if (result.success) {
        updateTask('syncParClienteId', {
          status: 'success',
          message: `${result.synced} registro(s) sincronizados`,
          details: result.records,
        });
        toast.success(`${result.synced} registros par_cliente_id sincronizados`);
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    });
  };

  // ── 8. Diagnóstico crudo de J_CLIENTES ──
  const handleDiagnosticoDB = async () => {
    await runWithTiming('diagnosticoDB', async () => {
      const result = await apiCall('GET', '/verificar-db');
      if (result.success) {
        const tipos = (result.conteoPorType || []).map((t: any) => `${t.type}: ${t.cantidad}`).join(', ');
        updateTask('diagnosticoDB', {
          status: 'success',
          message: `${result.totalRegistros} registros totales | ${tipos}`,
          details: result,
        });
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    });
  };

  // ── 9. Reset cache de validación de Cuenta Eje ──
  const handleResetValidationCache = async () => {
    await runWithTiming('resetValidationCache', async () => {
      resetCuentaEjeValidationCache();
      updateTask('resetValidationCache', {
        status: 'success',
        message: 'Cache de disponibilidad RPC/Edge Function reseteado. Próxima validación re-intentará RPC y Edge Function.',
      });
      toast.success('Cache de validación de Cuenta Eje reseteado');
    });
  };

  // ── Ejecutar todas las tareas pendientes en secuencia ──
  const handleRunAll = async () => {
    setIsRunningAll(true);
    toast.info('Ejecutando todas las tareas de mantenimiento...');
    try {
      const deployOk = await handleVerifyDeploy();
      if (!deployOk) {
        toast.error('Edge Function no disponible. Despliega v19.0 antes de ejecutar mantenimiento.');
        return;
      }
      // Reset validation cache tras confirmar que Edge Function está disponible
      await handleResetValidationCache();
      await handleDiagnosticoDB();
      await handleCleanClasificacion();
      await handleRepairProspectos();
      await handleDetectInvalidUrls();
      await handleCleanInvalidUrls();
      await handleVerifyParClienteId();
      await handleSyncParClienteId();
      toast.success('Todas las tareas de mantenimiento completadas');
    } finally {
      setIsRunningAll(false);
    }
  };

  // ── Reset all ──
  const handleResetAll = () => {
    setTasks({ ...INITIAL_TASKS });
    setEdgeVersion(null);
    setEdgeDeploy(null);
    sessionStorage.removeItem(SESSION_KEY);
    toast.info('Resultados de mantenimiento limpiados');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copiado al portapapeles');
    }).catch(() => {
      toast.error('No se pudo copiar');
    });
  };

  const StatusIcon = ({ status }: { status: TaskResult['status'] }) => {
    switch (status) {
      case 'running': return <Loader2 size={14} className="animate-spin text-blue-500" />;
      case 'success': return <CheckCircle size={14} className="text-green-600" />;
      case 'error': return <AlertTriangle size={14} className="text-red-500" />;
      default: return <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />;
    }
  };

  const completedCount = Object.values(tasks).filter(t => t.status === 'success').length;
  const errorCount = Object.values(tasks).filter(t => t.status === 'error').length;
  const totalTasks = Object.keys(tasks).length;

  const DEPLOY_COMMAND = `cd supabase && supabase functions deploy make-server-7e2d13d9 --project-ref ${projectId}`;

  const taskDefs = [
    {
      key: 'verifyDeploy',
      label: 'Verificar Despliegue Edge Function',
      description: 'Confirma que la Edge Function v19.0 está desplegada correctamente',
      icon: <Server size={16} />,
      action: handleVerifyDeploy,
      buttonLabel: 'Verificar',
      category: 'pre-check',
    },
    {
      key: 'diagnosticoDB',
      label: 'Diagnóstico crudo de J_CLIENTES',
      description: 'Conteo directo por type, subtipo y estatus — sin filtros',
      icon: <Activity size={16} />,
      action: handleDiagnosticoDB,
      buttonLabel: 'Diagnosticar',
      category: 'pre-check',
    },
    {
      key: 'cleanClasificacion',
      label: 'Limpiar clasificacionCliente "Gobierno Magisterio"',
      description: 'Elimina el campo contaminado de registros donde no corresponde',
      icon: <Trash2 size={16} />,
      action: handleCleanClasificacion,
      buttonLabel: 'Limpiar',
      category: 'cleanup',
    },
    {
      key: 'repairProspectos',
      label: 'Reparar Prospectos Legacy (v3.5)',
      description: 'Restaura campos perdidos por compactación v3.5 desde nodo "default"',
      icon: <Database size={16} />,
      action: handleRepairProspectos,
      buttonLabel: 'Reparar',
      category: 'cleanup',
    },
    {
      key: 'detectInvalidUrls',
      label: 'Detectar Expedientes con blob URLs',
      description: 'Escanea expedientesElectronicos buscando blob:// o data:// URLs inválidas',
      icon: <FileWarning size={16} />,
      action: handleDetectInvalidUrls,
      buttonLabel: 'Detectar',
      category: 'storage',
    },
    {
      key: 'cleanInvalidUrls',
      label: 'Limpiar blob URLs inválidas',
      description: 'Elimina blob/data URLs y conserva storagePath para regenerar URLs firmadas',
      icon: <Link2 size={16} />,
      action: handleCleanInvalidUrls,
      buttonLabel: 'Limpiar URLs',
      category: 'storage',
    },
    {
      key: 'verifyParClienteId',
      label: 'Verificar par_cliente_id (columna física)',
      description: 'Verifica que par_cliente_id coincide con data.institucionGobiernoId',
      icon: <Shield size={16} />,
      action: handleVerifyParClienteId,
      buttonLabel: 'Verificar',
      category: 'sync',
    },
    {
      key: 'syncParClienteId',
      label: 'Sincronizar par_cliente_id',
      description: 'Escribe data.institucionGobiernoId en la columna física par_cliente_id',
      icon: <RefreshCw size={16} />,
      action: handleSyncParClienteId,
      buttonLabel: 'Sincronizar',
      category: 'sync',
    },
    {
      key: 'resetValidationCache',
      label: 'Reset Cache Validación Cuenta Eje',
      description: 'Re-habilita intentos RPC/Edge Function para validación de unicidad de cuentas (post-deploy)',
      icon: <Zap size={16} />,
      action: handleResetValidationCache,
      buttonLabel: 'Resetear',
      category: 'sync',
    },
  ];

  const categories = [
    { id: 'pre-check', label: 'Pre-Verificación', color: 'blue' },
    { id: 'cleanup', label: 'Limpieza de Datos', color: 'orange' },
    { id: 'storage', label: 'Storage / Expedientes', color: 'purple' },
    { id: 'sync', label: 'Sincronización', color: 'green' },
  ];

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wrench size={20} className="text-orange-600" />
          <h2 className="text-sm text-gray-800">Mantenimiento de Base de Datos</h2>
          {edgeVersion && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
              Edge: {edgeVersion}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Progress indicator */}
          <span className="text-xs text-gray-500">
            {completedCount}/{totalTasks} completadas
            {errorCount > 0 && <span className="text-red-500 ml-1">({errorCount} errores)</span>}
          </span>
          <button
            onClick={handleResetAll}
            className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300 flex items-center gap-1"
          >
            Limpiar
          </button>
          <button
            onClick={handleRunAll}
            disabled={isRunningAll}
            className={`px-4 py-1.5 rounded text-xs flex items-center gap-1.5 ${
              isRunningAll
                ? 'bg-gray-300 text-gray-500 cursor-wait'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            {isRunningAll ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {isRunningAll ? 'Ejecutando...' : 'Ejecutar Todo'}
          </button>
        </div>
      </div>

      {/* ── Deployment Guide ── */}
      <div className="mb-4">
        <button
          onClick={() => setShowDeployGuide(!showDeployGuide)}
          className="flex items-center gap-2 text-xs text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 rounded px-3 py-2 w-full text-left"
        >
          {showDeployGuide ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Terminal size={14} />
          <span>Guía de Despliegue — Edge Function v19.0</span>
          {!edgeVersion && (
            <span className="ml-auto bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded text-xs">
              Pendiente
            </span>
          )}
          {edgeVersion && edgeVersion.includes('v19') && (
            <span className="ml-auto bg-green-200 text-green-800 px-2 py-0.5 rounded text-xs">
              Desplegada
            </span>
          )}
        </button>
        {showDeployGuide && (
          <div className="border border-blue-200 border-t-0 rounded-b bg-white p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-700 mb-2">
                <strong>Paso 1:</strong> Ejecutar el comando de deploy desde la raíz del proyecto:
              </p>
              <div className="flex items-center gap-2 bg-gray-900 text-green-400 p-3 rounded font-mono text-xs">
                <code className="flex-1 break-all">{DEPLOY_COMMAND}</code>
                <button
                  onClick={() => copyToClipboard(DEPLOY_COMMAND)}
                  className="text-gray-400 hover:text-white shrink-0"
                  title="Copiar comando"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-700 mb-1">
                <strong>Paso 2:</strong> Verificar despliegue usando el botón "Verificar" arriba.
              </p>
              <p className="text-xs text-gray-700 mb-1">
                <strong>Paso 3:</strong> Ejecutar "Ejecutar Todo" para correr todas las tareas de mantenimiento.
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <p className="text-xs text-yellow-800">
                <strong>Bootstrap automático:</strong> Al desplegarse, la Edge Function crea/actualiza
                automáticamente las RPCs en <code>public</code>: <code>get_clientes()</code>,{' '}
                <code>get_all_jclientes()</code>, <code>update_par_cliente_id()</code>,{' '}
                <code>check_cuenta_eje_unique()</code>, <code>repair_legacy_prospectos()</code>,{' '}
                <code>clean_clasificacion_gobierno_magisterio()</code>, <code>detect_invalid_blob_urls()</code>.
                También crea las 4 políticas RLS para el bucket <code>expedientes-electronicos</code>.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              <strong>Nota:</strong> Todos los endpoints son idempotentes y seguros de re-ejecutar.
              Las tareas de mantenimiento se ejecutan en secuencia para evitar race conditions.
            </div>
          </div>
        )}
      </div>

      {/* ── Warning Banner ── */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
        <p className="text-xs text-yellow-800">
          Estas operaciones se ejecutan contra la Edge Function y la base de datos Supabase.
          Asegurar que la Edge Function v19.0 esté desplegada antes de ejecutar.
          Las operaciones son idempotentes y seguras de re-ejecutar.
        </p>
      </div>

      {/* ── Task Groups ── */}
      <div className="space-y-4">
        {categories.map(cat => {
          const catTasks = taskDefs.filter(t => t.category === cat.id);
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${
                  cat.color === 'blue' ? 'bg-blue-500' :
                  cat.color === 'orange' ? 'bg-orange-500' :
                  cat.color === 'purple' ? 'bg-purple-500' :
                  'bg-green-500'
                }`} />
                <span className="text-xs text-gray-500 uppercase tracking-wide">{cat.label}</span>
              </div>
              <div className="space-y-2">
                {catTasks.map((task) => {
                  const result = tasks[task.key];
                  return (
                    <div
                      key={task.key}
                      className={`border rounded p-3 transition-colors ${
                        result.status === 'success' ? 'border-green-200 bg-green-50' :
                        result.status === 'error' ? 'border-red-200 bg-red-50' :
                        result.status === 'running' ? 'border-blue-200 bg-blue-50' :
                        'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1">
                          <div className="mt-0.5 text-gray-500">{task.icon}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-800">{task.label}</span>
                              <StatusIcon status={result.status} />
                              {result.durationMs !== undefined && result.status !== 'running' && (
                                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                  <Clock size={10} />
                                  {result.durationMs < 1000
                                    ? `${result.durationMs}ms`
                                    : `${(result.durationMs / 1000).toFixed(1)}s`}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                            {result.message && (
                              <p className={`text-xs mt-1 ${
                                result.status === 'success' ? 'text-green-700' :
                                result.status === 'error' ? 'text-red-700' :
                                'text-blue-700'
                              }`}>
                                {result.message}
                              </p>
                            )}
                            {result.timestamp && result.status !== 'idle' && result.status !== 'running' && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {formatTimestamp(result.timestamp)}
                              </p>
                            )}
                            {result.details && (
                              <TaskDetails details={result.details} taskKey={task.key} />
                            )}
                          </div>
                        </div>
                        <button
                          onClick={task.action}
                          disabled={result.status === 'running' || isRunningAll}
                          className={`px-3 py-1 text-xs rounded border whitespace-nowrap ml-3 ${
                            result.status === 'running' || isRunningAll
                              ? 'bg-gray-100 text-gray-400 cursor-wait'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {result.status === 'running' ? 'Ejecutando...' : task.buttonLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-component for expandable details ──
function TaskDetails({ details, taskKey }: { details: any; taskKey: string }) {
  const [expanded, setExpanded] = useState(false);

  // For diagnosticoDB, always show summary
  if (taskKey === 'diagnosticoDB' && details) {
    return (
      <div className="mt-2">
        {details.conteoPorType && (
          <div className="flex flex-wrap gap-2 mb-1">
            {details.conteoPorType.map((t: any, i: number) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                {t.type || '(null)'}: <strong>{t.cantidad}</strong>
              </span>
            ))}
          </div>
        )}
        {details.conteoPorSubtipo && (
          <details className="mt-1">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
              Ver desglose completo
            </summary>
            <div className="mt-1 space-y-1">
              <div className="text-xs text-gray-600">
                <strong>Por subtipo:</strong>{' '}
                {details.conteoPorSubtipo.map((s: any) => `${s.subtipo || '(null)'}: ${s.cantidad}`).join(' | ')}
              </div>
              <div className="text-xs text-gray-600">
                <strong>Por estatus:</strong>{' '}
                {details.conteoPorEstatus?.map((e: any) => `${e.estatus || '(null)'}: ${e.cantidad}`).join(' | ')}
              </div>
              {details.muestra && details.muestra.length > 0 && (
                <details className="mt-1">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                    Muestra ({details.muestra.length} registros)
                  </summary>
                  <pre className="text-xs text-gray-600 mt-1 bg-gray-100 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                    {JSON.stringify(details.muestra, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </details>
        )}
      </div>
    );
  }

  // For array results
  if (Array.isArray(details) && details.length > 0) {
    return (
      <details className="mt-1" open={expanded} onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}>
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
          Ver detalles ({details.length} registros)
        </summary>
        <pre className="text-xs text-gray-600 mt-1 bg-gray-100 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
          {JSON.stringify(details, null, 2)}
        </pre>
      </details>
    );
  }

  // For object results (e.g., health check)
  if (typeof details === 'object' && details !== null && !Array.isArray(details)) {
    const keys = Object.keys(details);
    if (keys.length === 0) return null;
    return (
      <details className="mt-1">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
          Ver respuesta completa
        </summary>
        <pre className="text-xs text-gray-600 mt-1 bg-gray-100 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
          {JSON.stringify(details, null, 2)}
        </pre>
      </details>
    );
  }

  return null;
}
