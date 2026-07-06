import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

// ── Tipos ──────────────────────────────────────────────────────────
interface AlertaRiesgo {
  id: string;
  tipo: 'Concentración' | 'Liquidez' | 'Mercado' | 'Operacional' | 'Crédito';
  nivel: 'Alto' | 'Medio' | 'Bajo';
  descripcion: string;
  fecha: string;
  estatus: 'Activa' | 'En revisión' | 'Cerrada';
}

interface IndiceRiesgo {
  nombre: string;
  valor: number;
  limite: number;
  unidad: string;
  tendencia: 'up' | 'down' | 'stable';
  color: string;
}

interface LogConexion {
  ts: string;
  tipo: 'info' | 'ok' | 'warn' | 'error';
  mensaje: string;
}

// ── Datos demo ────────────────────────────────────────────────────
const ALERTAS_DEMO: AlertaRiesgo[] = [
  { id: 'ALR-001', tipo: 'Concentración', nivel: 'Alto',   descripcion: 'Exposición al sector hipotecario supera el 35% de la cartera total (límite regulatorio: 30%)', fecha: '08/06/2026 09:14', estatus: 'Activa' },
  { id: 'ALR-002', tipo: 'Liquidez',      nivel: 'Medio',  descripcion: 'Índice de cobertura de liquidez (LCR) en 118% — proximidad al umbral mínimo de 100%', fecha: '07/06/2026 16:02', estatus: 'En revisión' },
  { id: 'ALR-003', tipo: 'Crédito',       nivel: 'Medio',  descripcion: '3 créditos con atraso > 90 días detectados en segmento PyME (CLI-042, CLI-078, CLI-103)', fecha: '06/06/2026 11:30', estatus: 'En revisión' },
  { id: 'ALR-004', tipo: 'Mercado',       nivel: 'Bajo',   descripcion: 'Variación en tasa TIIE +25 pbs impacta margen financiero estimado en -0.8%', fecha: '05/06/2026 08:45', estatus: 'Activa' },
  { id: 'ALR-005', tipo: 'Operacional',   nivel: 'Bajo',   descripcion: 'Tiempo de respuesta del core bancario > 3s en horario pico (09:00–10:30 hrs)', fecha: '04/06/2026 10:15', estatus: 'Cerrada' },
];

const INDICES_DEMO: IndiceRiesgo[] = [
  { nombre: 'Índice de Morosidad (IMOR)',       valor: 2.4,  limite: 5.0,  unidad: '%',  tendencia: 'stable', color: '#22C55E' },
  { nombre: 'Cobertura de Cartera Vencida',     valor: 142,  limite: 100,  unidad: '%',  tendencia: 'up',     color: '#22C55E' },
  { nombre: 'Índice de Capitalización (ICAP)',  valor: 15.8, limite: 10.5, unidad: '%',  tendencia: 'stable', color: '#22C55E' },
  { nombre: 'LCR — Cobertura de Liquidez',      valor: 118,  limite: 100,  unidad: '%',  tendencia: 'down',   color: '#EAB308' },
  { nombre: 'Concentración Hipotecaria',        valor: 35.2, limite: 30.0, unidad: '%',  tendencia: 'up',     color: '#EF4444' },
  { nombre: 'Razón de Apalancamiento',          valor: 6.1,  limite: 3.0,  unidad: 'x',  tendencia: 'stable', color: '#22C55E' },
];

const ENDPOINTS = [
  { id: 'riesgos',    label: 'GET /api/v1/riesgos/indicadores',   desc: 'Índices consolidados de riesgo' },
  { id: 'alertas',    label: 'GET /api/v1/riesgos/alertas',       desc: 'Alertas activas y en revisión' },
  { id: 'morosidad',  label: 'GET /api/v1/cartera/morosidad',     desc: 'Segmentación de cartera vencida' },
  { id: 'liquidez',   label: 'GET /api/v1/tesoreria/lcr',         desc: 'Índice de cobertura de liquidez' },
  { id: 'icap',       label: 'GET /api/v1/capital/icap',          desc: 'Índice de capitalización CNBV' },
];

// ── Helpers ────────────────────────────────────────────────────────
const fmt = (v: number, u: string) => `${v.toLocaleString('es-MX', { maximumFractionDigits: 1 })}${u}`;
const nivelColor = (n: AlertaRiesgo['nivel']) =>
  n === 'Alto' ? 'bg-red-100 text-red-700 border-red-200' :
  n === 'Medio' ? 'bg-amber-50 text-amber-700 border-amber-200' :
  'bg-blue-50 text-blue-700 border-blue-200';
const estatusColor = (e: AlertaRiesgo['estatus']) =>
  e === 'Activa' ? 'bg-red-50 text-red-700' :
  e === 'En revisión' ? 'bg-amber-50 text-amber-700' :
  'bg-green-50 text-green-700';
const tipoIcon = (t: AlertaRiesgo['tipo']) => ({
  Concentración: '⬡', Liquidez: '◈', Mercado: '◉', Operacional: '◧', Crédito: '◆',
}[t]);

// ─────────────────────────────────────────────────────────────────
export function GestionRiesgosModule() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alertas' | 'api'>('dashboard');
  const [alertas, setAlertas] = useState<AlertaRiesgo[]>(ALERTAS_DEMO);
  const [conectando, setConectando] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [log, setLog] = useState<LogConexion[]>([]);
  const [endpointSel, setEndpointSel] = useState(ENDPOINTS[0].id);
  const [respuesta, setRespuesta] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const addLog = (tipo: LogConexion['tipo'], mensaje: string) => {
    const ts = new Date().toLocaleTimeString('es-MX', { hour12: false });
    setLog(p => [...p, { ts, tipo, mensaje }]);
  };

  const handleConectar = () => {
    if (conectado) {
      setConectado(false);
      setLog([]);
      setRespuesta('');
      toast.info('Desconectado del sistema de riesgos');
      return;
    }
    setConectando(true);
    setLog([]);
    setRespuesta('');

    setTimeout(() => addLog('info', 'Iniciando handshake TLS 1.3 con risk-api.efinancia.mx:8443...'), 300);
    setTimeout(() => addLog('info', 'Verificando certificado SSL — CN=risk-api.efinancia.mx'), 700);
    setTimeout(() => addLog('ok',   'Certificado válido. Cadena de confianza verificada.'), 1100);
    setTimeout(() => addLog('info', 'Enviando credenciales OAuth2 — client_id: efinancia-core'), 1500);
    setTimeout(() => addLog('ok',   'Token JWT recibido. Expira en 3600s.'), 2000);
    setTimeout(() => addLog('info', 'Verificando permisos: riesgos:read, alertas:read, reportes:read'), 2400);
    setTimeout(() => addLog('ok',   'Permisos confirmados. Scopes activos: [riesgos:read, alertas:read]'), 2800);
    setTimeout(() => addLog('info', 'Probando endpoint: GET /api/v1/health'), 3200);
    setTimeout(() => addLog('ok',   'API operativa — status: 200 OK — latencia: 47ms'), 3700);
    setTimeout(() => {
      addLog('ok', 'Conexión establecida con Sistema de Gestión de Riesgos v2.4.1');
      setConectando(false);
      setConectado(true);
      toast.success('Conectado al Sistema de Gestión de Riesgos');
    }, 4200);
  };

  const handleConsultar = () => {
    if (!conectado) { toast.error('Primero establezca conexión con el API'); return; }
    const ep = ENDPOINTS.find(e => e.id === endpointSel)!;
    addLog('info', `Ejecutando ${ep.label}`);

    setTimeout(() => {
      addLog('ok', `Respuesta recibida — 200 OK — latencia: ${32 + Math.floor(Math.random() * 40)}ms`);
      const payloads: Record<string, object> = {
        riesgos:   { status: 'ok', timestamp: '2026-06-08T09:00:00Z', data: { imor: 2.4, icap: 15.8, lcr: 118, apalancamiento: 6.1 } },
        alertas:   { status: 'ok', total: 5, activas: 2, en_revision: 2, cerradas: 1, alertas: ALERTAS_DEMO.map(a => ({ id: a.id, tipo: a.tipo, nivel: a.nivel })) },
        morosidad: { status: 'ok', cartera_total: 285400000, cartera_vencida: 6849600, imor: 2.4, segmentos: [{ nombre: 'Hipotecario', imor: 1.8 }, { nombre: 'PyME', imor: 4.2 }, { nombre: 'Personal', imor: 2.1 }] },
        liquidez:  { status: 'ok', lcr: 118.4, hqla: 142000000, salidas_netas: 119960000, umbral_minimo: 100, semaforo: 'amarillo' },
        icap:      { status: 'ok', icap: 15.8, capital_basico: 48200000, activos_ponderados: 305000000, minimo_regulatorio: 10.5, excedente: 5.3 },
      };
      setRespuesta(JSON.stringify(payloads[endpointSel], null, 2));
    }, 600);
  };

  const handleCerrarAlerta = (id: string) => {
    setAlertas(p => p.map(a => a.id === id ? { ...a, estatus: 'Cerrada' } : a));
    toast.success('Alerta marcada como cerrada');
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard de Riesgos' },
    { id: 'alertas',   label: 'Alertas' },
    { id: 'api',       label: 'Integración API' },
  ] as const;

  return (
    <div className="bg-white min-h-screen">

      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300 flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#666" strokeWidth="1.5">
          <path d="M11 2L3 7v8l8 5 8-5V7z"/>
          <path d="M11 12a1 1 0 100-2 1 1 0 000 2zM11 8v2M11 12v2"/>
        </svg>
        <h2 className="text-lg text-gray-800">Gestión de Riesgos</h2>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${conectado ? 'bg-green-500' : 'bg-gray-300'}`}/>
          <span className="text-xs text-gray-500">{conectado ? 'API conectada' : 'API desconectada'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-stretch bg-[#2E5C91] border-b border-gray-300">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-5 py-2 text-xs border-r border-white/20 last:border-0 transition-colors ${activeTab === t.id ? 'bg-[#1d3f6b] text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-5 bg-[#F5F5F5] min-h-[calc(100vh-120px)]">

        {/* ═══ TAB: DASHBOARD ═══ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              {INDICES_DEMO.map((ind, i) => {
                const ok = ind.nombre === 'Concentración Hipotecaria'
                  ? ind.valor <= ind.limite
                  : ind.valor >= ind.limite;
                const pct = Math.min(100, Math.round((ind.valor / (ind.limite * 1.5)) * 100));
                return (
                  <div key={i} className="bg-white border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-[10px] text-gray-500 leading-tight flex-1 mr-2">{ind.nombre}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 border ${ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {ok ? 'OK' : 'ALERTA'}
                      </span>
                    </div>
                    <div className="flex items-end gap-1 mb-2">
                      <span className="text-2xl font-bold" style={{ color: ind.color }}>
                        {fmt(ind.valor, ind.unidad)}
                      </span>
                      <span className={`text-[10px] mb-0.5 ${ind.tendencia === 'up' ? 'text-red-500' : ind.tendencia === 'down' ? 'text-amber-500' : 'text-gray-400'}`}>
                        {ind.tendencia === 'up' ? '▲' : ind.tendencia === 'down' ? '▼' : '—'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: ind.color }}/>
                    </div>
                    <p className="text-[9px] text-gray-400 mt-1">Límite: {fmt(ind.limite, ind.unidad)}</p>
                  </div>
                );
              })}
            </div>

            {/* Resumen alertas */}
            <div className="bg-white border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Resumen de Alertas Activas</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {(['Alto', 'Medio', 'Bajo'] as const).map(nivel => {
                  const count = alertas.filter(a => a.nivel === nivel && a.estatus !== 'Cerrada').length;
                  return (
                    <div key={nivel} className={`px-4 py-3 border text-center ${nivelColor(nivel)}`}>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-[10px] mt-0.5">Riesgo {nivel}</p>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1.5">
                {alertas.filter(a => a.estatus !== 'Cerrada').slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-100 text-xs">
                    <span className="text-gray-400">{tipoIcon(a.tipo)}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 border ${nivelColor(a.nivel)}`}>{a.nivel}</span>
                    <span className="text-gray-700 flex-1 truncate">{a.descripcion}</span>
                    <span className="text-gray-400 text-[9px] flex-shrink-0">{a.fecha.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: ALERTAS ═══ */}
        {activeTab === 'alertas' && (
          <div className="bg-white border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Alertas de Riesgo</span>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Activa</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>En revisión</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Cerrada</span>
              </div>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-3 py-2 text-left text-[10px] text-gray-600 font-medium border-r border-gray-200">ID</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-600 font-medium border-r border-gray-200">Tipo</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-600 font-medium border-r border-gray-200">Nivel</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-600 font-medium border-r border-gray-200">Descripción</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-600 font-medium border-r border-gray-200">Fecha</th>
                  <th className="px-3 py-2 text-center text-[10px] text-gray-600 font-medium border-r border-gray-200">Estatus</th>
                  <th className="px-3 py-2 text-center text-[10px] text-gray-600 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((a, i) => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50"
                    style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td className="px-3 py-2 border-r border-gray-100 font-mono text-gray-500">{a.id}</td>
                    <td className="px-3 py-2 border-r border-gray-100">
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">{tipoIcon(a.tipo)}</span>
                        {a.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-100">
                      <span className={`px-2 py-0.5 text-[9px] border ${nivelColor(a.nivel)}`}>{a.nivel}</span>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-100 text-gray-700 max-w-xs">{a.descripcion}</td>
                    <td className="px-3 py-2 border-r border-gray-100 text-gray-500 whitespace-nowrap">{a.fecha}</td>
                    <td className="px-3 py-2 border-r border-gray-100 text-center">
                      <span className={`px-2 py-0.5 text-[9px] rounded-full ${estatusColor(a.estatus)}`}>{a.estatus}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {a.estatus !== 'Cerrada' ? (
                        <button onClick={() => handleCerrarAlerta(a.id)}
                          className="text-[10px] text-[#2E5C91] hover:underline">
                          Cerrar
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ TAB: API ═══ */}
        {activeTab === 'api' && (
          <div className="grid grid-cols-2 gap-4">

            {/* Panel izquierdo — configuración + log */}
            <div className="space-y-4">

              {/* Config conexión */}
              <div className="bg-white border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Configuración de Conexión</p>
                <div className="space-y-2 text-xs mb-4">
                  {[
                    { label: 'Host',        valor: 'risk-api.efinancia.mx' },
                    { label: 'Puerto',      valor: '8443' },
                    { label: 'Protocolo',   valor: 'HTTPS / TLS 1.3' },
                    { label: 'Auth',        valor: 'OAuth2 — client_credentials' },
                    { label: 'Versión API', valor: 'v2.4.1' },
                    { label: 'Timeout',     valor: '30 000 ms' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                      <span className="text-gray-500 w-24 flex-shrink-0">{r.label}</span>
                      <span className="font-mono text-gray-800 text-[11px]">{r.valor}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleConectar}
                  disabled={conectando}
                  className={`w-full py-1.5 text-xs font-medium border transition-colors ${
                    conectando ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-wait' :
                    conectado  ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100' :
                                 'bg-[#2E5C91] text-white border-[#2E5C91] hover:bg-[#1d3f6b]'
                  }`}>
                  {conectando ? 'Conectando...' : conectado ? 'Desconectar' : 'Conectar'}
                </button>
              </div>

              {/* Log de conexión */}
              <div className="bg-white border border-gray-200">
                <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Log de Conexión</span>
                  {log.length > 0 && (
                    <button onClick={() => setLog([])} className="text-[10px] text-gray-400 hover:text-gray-600">Limpiar</button>
                  )}
                </div>
                <div ref={logRef} className="h-52 overflow-y-auto font-mono text-[10px] p-3 bg-gray-950 space-y-0.5">
                  {log.length === 0
                    ? <span className="text-gray-600">Esperando conexión...</span>
                    : log.map((l, i) => (
                      <div key={i} className={`${
                        l.tipo === 'ok'    ? 'text-green-400' :
                        l.tipo === 'warn'  ? 'text-amber-400' :
                        l.tipo === 'error' ? 'text-red-400'   : 'text-gray-400'
                      }`}>
                        <span className="text-gray-600 mr-2">[{l.ts}]</span>
                        <span className="mr-2">{l.tipo === 'ok' ? '✓' : l.tipo === 'warn' ? '⚠' : l.tipo === 'error' ? '✗' : '›'}</span>
                        {l.mensaje}
                      </div>
                    ))
                  }
                  {conectando && (
                    <div className="text-gray-500 animate-pulse">█</div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel derecho — consulta endpoints */}
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Consultar Endpoint</p>
                <div className="space-y-1 mb-3">
                  {ENDPOINTS.map(ep => (
                    <label key={ep.id}
                      className={`flex items-start gap-2 px-3 py-2 border cursor-pointer text-xs transition-colors ${endpointSel === ep.id ? 'border-[#2E5C91] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="endpoint" value={ep.id} checked={endpointSel === ep.id}
                        onChange={() => setEndpointSel(ep.id)} className="mt-0.5 accent-[#2E5C91]"/>
                      <div>
                        <p className="font-mono text-[10px] text-[#2E5C91]">{ep.label}</p>
                        <p className="text-gray-500 text-[10px]">{ep.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <button onClick={handleConsultar}
                  disabled={!conectado}
                  className="w-full py-1.5 text-xs bg-[#2E5C91] text-white hover:bg-[#1d3f6b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Ejecutar consulta
                </button>
              </div>

              {/* Respuesta JSON */}
              <div className="bg-white border border-gray-200">
                <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Respuesta</span>
                  {respuesta && (
                    <button onClick={() => { navigator.clipboard.writeText(respuesta); toast.success('Copiado al portapapeles'); }}
                      className="text-[10px] text-gray-400 hover:text-gray-600">Copiar</button>
                  )}
                </div>
                <pre className="h-64 overflow-auto font-mono text-[10px] p-3 bg-gray-950 text-green-400 leading-relaxed">
                  {respuesta || <span className="text-gray-600">Sin respuesta — ejecute una consulta</span>}
                </pre>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
