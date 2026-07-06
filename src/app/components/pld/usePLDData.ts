import { useState, useEffect, useCallback } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { AlertaPLD, AlertaInterna, ReporteCNBV, CalificacionData } from './pldStore';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

function mapAlerta(r: any): AlertaPLD {
  return {
    id: r.id,
    noAlerta: r.no_alerta,
    fechaCreacion: r.fecha,
    cliente: r.cliente,
    tipoAlerta: r.tipo_alerta,
    estatus: r.estatus,
    usuarioAsignado: r.usuario_asignado ?? '',
    resultado: r.resultado ?? '',
    enviadoCNBV: r.enviado_cnbv ?? 'No',
    monto: r.monto ?? '',
    descripcion: r.descripcion ?? '',
  };
}

function mapAlertaInterna(r: any): AlertaInterna {
  return {
    id: r.id,
    noAlerta: r.no_alerta,
    fecha: r.fecha,
    cliente: r.cliente,
    tipo: r.tipo,
    estatus: r.estatus,
    descripcion: r.descripcion ?? '',
    resultado: r.resultado ?? '',
  };
}

function mapReporte(r: any): ReporteCNBV {
  return {
    id: r.id,
    folio: r.folio,
    fecha: r.fecha,
    tipo: r.tipo,
    cliente: r.cliente,
    monto: r.monto ?? '',
    estatus: r.estatus,
    enviado: r.enviado ?? 'No',
  };
}

function mapCalificacion(r: any): CalificacionData {
  return {
    clienteId: r.cliente_id ? Number(r.cliente_id) : undefined,
    noCliente: r.no_cliente,
    nombreCliente: r.nombre_cliente,
    clienteRFC: r.cliente_rfc ?? '',
    clientePersonalidad: r.cliente_personalidad ?? '',
    clienteSucursal: r.cliente_sucursal ?? '',
    fechaCalificacion: r.fecha_calificacion ?? '',
    actividadEconomica: Number(r.actividad_economica ?? 0),
    residencia: Number(r.residencia ?? 0),
    nacionalidad: Number(r.nacionalidad ?? 0),
    tipoPersona: Number(r.tipo_persona ?? 0),
    pepListasNegras: Number(r.pep_listas_negras ?? 0),
    calificacionTotal: Number(r.calificacion_total ?? 0),
    nivelRiesgo: r.nivel_riesgo ?? 'Bajo',
  };
}

// ── Alertas PLD ──────────────────────────────────────────────────────
export function usePLDAlertas() {
  const [alertas, setAlertas] = useState<AlertaPLD[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/pld/alertas`, { headers: HDR })
      .then(r => r.json())
      .then(j => setAlertas((j.data || []).map(mapAlerta)))
      .catch(() => setAlertas([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const save = async (a: AlertaPLD) => {
    if (a.id && a.id > 0) {
      await fetch(`${API_BASE}/pld/alertas/${a.id}`, { method: 'PUT', headers: HDR, body: JSON.stringify(a) });
    } else {
      await fetch(`${API_BASE}/pld/alertas`, { method: 'POST', headers: HDR, body: JSON.stringify(a) });
    }
    fetch_();
  };

  const remove = async (id: number) => {
    await fetch(`${API_BASE}/pld/alertas/${id}`, { method: 'DELETE', headers: HDR });
    fetch_();
  };

  return { alertas, loading, save, remove, refresh: fetch_ };
}

// ── Alertas Internas ─────────────────────────────────────────────────
export function usePLDAlertasInternas() {
  const [alertas, setAlertas] = useState<AlertaInterna[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/pld/alertas-internas`, { headers: HDR })
      .then(r => r.json())
      .then(j => setAlertas((j.data || []).map(mapAlertaInterna)))
      .catch(() => setAlertas([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const save = async (a: AlertaInterna) => {
    if (a.id && a.id > 0) {
      await fetch(`${API_BASE}/pld/alertas-internas/${a.id}`, { method: 'PUT', headers: HDR, body: JSON.stringify(a) });
    } else {
      await fetch(`${API_BASE}/pld/alertas-internas`, { method: 'POST', headers: HDR, body: JSON.stringify(a) });
    }
    fetch_();
  };

  const remove = async (id: number) => {
    await fetch(`${API_BASE}/pld/alertas-internas/${id}`, { method: 'DELETE', headers: HDR });
    fetch_();
  };

  return { alertas, loading, save, remove, refresh: fetch_ };
}

// ── Reportes CNBV ────────────────────────────────────────────────────
export function usePLDReportes() {
  const [reportes, setReportes] = useState<ReporteCNBV[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/pld/reportes-cnbv`, { headers: HDR })
      .then(r => r.json())
      .then(j => setReportes((j.data || []).map(mapReporte)))
      .catch(() => setReportes([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const save = async (r: ReporteCNBV) => {
    if (r.id && r.id > 0) {
      await fetch(`${API_BASE}/pld/reportes-cnbv/${r.id}`, { method: 'PUT', headers: HDR, body: JSON.stringify(r) });
    } else {
      await fetch(`${API_BASE}/pld/reportes-cnbv`, { method: 'POST', headers: HDR, body: JSON.stringify(r) });
    }
    fetch_();
  };

  const remove = async (id: number) => {
    await fetch(`${API_BASE}/pld/reportes-cnbv/${id}`, { method: 'DELETE', headers: HDR });
    fetch_();
  };

  return { reportes, loading, save, remove, refresh: fetch_ };
}

// ── Calificaciones ───────────────────────────────────────────────────
export function usePLDCalificaciones() {
  const [calificaciones, setCalificaciones] = useState<CalificacionData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/pld/calificaciones`, { headers: HDR })
      .then(r => r.json())
      .then(j => setCalificaciones((j.data || []).map(mapCalificacion)))
      .catch(() => setCalificaciones([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const save = async (cal: CalificacionData) => {
    await fetch(`${API_BASE}/pld/calificaciones`, { method: 'POST', headers: HDR, body: JSON.stringify(cal) });
    fetch_();
  };

  const remove = async (id: number) => {
    await fetch(`${API_BASE}/pld/calificaciones/${id}`, { method: 'DELETE', headers: HDR });
    fetch_();
  };

  return { calificaciones, loading, save, remove, refresh: fetch_ };
}

// ── Dashboard stats (endpoint agregado, una sola query) ──────────────
export interface PLDDashboardStats {
  alertasActivas: number;
  alertasRelevantes: number;
  alertasInusuales: number;
  alertasPreoc: number;
  internasTotal: number;
  internasPendientes: number;
  reportesPendientes: number;
  calTotal: number;
  calBajo: number;
  calMedio: number;
  calAlto: number;
  recentAlertas: AlertaPLD[];
}

export function usePLDDashboard() {
  const [stats, setStats] = useState<PLDDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/pld/dashboard-stats`, { headers: HDR })
      .then(r => r.json())
      .then(j => {
        if (j.error) { setStats(null); return; }
        setStats({
          ...j,
          recentAlertas: (j.recentAlertas || []).map((r: any) => ({
            id: r.id,
            noAlerta: r.no_alerta,
            fechaCreacion: r.fecha_creacion,
            cliente: r.cliente,
            tipoAlerta: r.tipo_alerta,
            estatus: r.estatus,
            monto: r.monto ?? '',
            usuarioAsignado: '',
            resultado: '',
            enviadoCNBV: 'No',
            descripcion: '',
          })),
        });
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}
