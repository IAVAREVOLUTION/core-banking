/**
 * OportunidadesModule.tsx
 *
 * Módulo Oportunidades — HU-CRM-04.
 *   Home (dashboard)  → CA-02
 *   Lista (grid)      → CA-03/04/05
 *   Detalle           → CA-06
 *
 * Una Oportunidad es una Cotización de Línea de Crédito (decisión HU-CRM-03),
 * así que este módulo lee y escribe sobre J_COTIZACIONES filtrando
 * data.lineaProducto === 'Línea de Crédito'. No hay duplicación de datos:
 * es una vista dedicada del pipeline GPO sobre los mismos registros.
 *
 * También recibe el Lead recién calificado (HU-CRM-03 CA-05/CA-06) y abre
 * la Oportunidad prellenada.
 */
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { OportunidadesDashboard } from './OportunidadesDashboard';
import { OportunidadesList } from './OportunidadesList';
import { OportunidadForm } from './OportunidadForm';
import type { CotizacionCredito } from '../cotizaciones/cotizacionCreditoTypes';
import { generarNoCotizaCredito, crearCotizacionCreditoVacia, ESTATUS_OPORTUNIDAD_INICIAL } from '../cotizaciones/cotizacionCreditoTypes';
import { useCotizacionesCaptacionDB } from '../../hooks/useCotizacionesCaptacionDB';

type Vista = 'home' | 'list' | 'form';
type FormMode = 'create' | 'edit' | 'view';

interface Props {
  /** HU-CRM-03 CA-05/CA-06 — Lead calificado que debe abrirse como Oportunidad */
  leadParaOportunidad?: any;
  /** Callback para limpiar el Lead después de consumirlo */
  onLeadParaOportunidadConsumido?: () => void;
  /** Cierre Comercial — navega al módulo LOS abriendo la Solicitud generada. */
  onNavigateToSolicitud?: (
    solicitudId: string,
    noSol: string,
    fromClienteId?: string,
    opts?: { mode?: 'ver' | 'editar'; volverAOportunidadId?: string },
  ) => void;
  /** "+ Nueva Solicitud" del tab Solicitudes — mismo bridge que Cotización → Solicitud. */
  onCrearSolicitudDesdeOportunidad?: (data: any) => void;
  /**
   * Regreso desde el módulo de Solicitudes: id de la Oportunidad que hay que
   * volver a abrir. Este módulo se desmonta al cambiar de módulo, así que su
   * estado local (vista/selected) no sobrevive al viaje de ida y vuelta —
   * el id viaja por App y aquí se reconstruye la vista de detalle.
   */
  oportunidadDeepLinkId?: string | null;
  /** Limpia el deep link una vez reabierta la Oportunidad. */
  onOportunidadDeepLinkConsumido?: () => void;
}

/** sessionStorage: Oportunidades aún no persistidas en BD */
const SS_KEY = 'oportunidades_local';

export function OportunidadesModule({
  leadParaOportunidad,
  onLeadParaOportunidadConsumido,
  onNavigateToSolicitud,
  onCrearSolicitudDesdeOportunidad,
  oportunidadDeepLinkId,
  onOportunidadDeepLinkConsumido,
}: Props = {}) {
  const [vista, setVista] = useState<Vista>('home');
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [selected, setSelected] = useState<CotizacionCredito | undefined>();
  const [savedId, setSavedId] = useState<string | null>(null);

  const [locales, setLocales] = useState<CotizacionCredito[]>(() => {
    try { const r = sessionStorage.getItem(SS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
  });

  const { cotizaciones: cotizacionesDB, loading, refetch, saveCotizacion } = useCotizacionesCaptacionDB(true);

  // ── Oportunidades = Cotizaciones Línea de Crédito ──
  const desdeDB: CotizacionCredito[] = cotizacionesDB
    .filter(c => c.data?.lineaProducto === 'Línea de Crédito')
    .map(c => ({
      id: c.id,
      no_cotiza: c.no_cotiza,
      descripcion: c.descripcion,
      producto_id: c.producto_id,
      cliente_id: c.cliente_id,
      fecha_cotiza: c.fecha_cotiza,
      estatus_cotiza: c.estatus_cotiza,
      linea_cotizacion: c.linea_cotizacion || 'Línea Crédito',
      data: c.data as any,
    }));

  // BD manda; los locales solo completan lo que aún no se guardó.
  const dbIds = new Set(desdeDB.map(c => c.id));
  const dbFolios = new Set(desdeDB.map(c => c.no_cotiza));
  const oportunidades = [
    ...desdeDB,
    ...locales.filter(c => !dbIds.has(c.id) && !dbFolios.has(c.no_cotiza)),
  ];

  // ══════════════════════════════════════════════════════════════
  // HU-CRM-03 CA-05/CA-06 — Oportunidad desde Lead calificado
  // Se abre NUEVA y sin guardar: el ejecutivo completa la estructura
  // bursátil y la cotización de comisiones antes de persistirla.
  // ══════════════════════════════════════════════════════════════
  const leadConsumidoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!leadParaOportunidad) return;
    if (leadConsumidoRef.current === leadParaOportunidad.leadOrigenId) return;
    leadConsumidoRef.current = leadParaOportunidad.leadOrigenId;

    const L = leadParaOportunidad;
    const nueva = crearCotizacionCreditoVacia(generarNoCotizaCredito('LDC'), 'Línea de Crédito');
    const montoNum = parseFloat(String(L.montoInversion ?? '').replace(/,/g, ''));

    const oportunidad: CotizacionCredito = {
      ...nueva,
      // CA-02 — toda Oportunidad nace "En Cotización"
      estatus_cotiza: ESTATUS_OPORTUNIDAD_INICIAL,
      cliente_id: L.clienteId || '',
      descripcion: L.descripcionObra || '',
      data: {
        ...nueva.data,
        cliente: {
          claveCliente: L.claveCliente || '',
          nombreCompleto: L.nombreCompleto || '',
        },
        institucionGobierno: L.institucionGobierno || '',
        moneda: L.monedaInversion || 'MXN',
        // El Monto Inversión del Lead es el punto de partida de la negociación.
        montoSolicitado: isNaN(montoNum) ? 0 : montoNum,
        // ── Perfil heredado del Lead ──
        sectorInfraestructura: L.sectorInfraestructura || '',
        montoInversion: L.montoInversion || '0.00',
        monedaInversion: L.monedaInversion || 'MXN',
        tipoFinanciamiento: L.tipoFinanciamiento || '',
        descripcionObra: L.descripcionObra || '',
        leadOrigenId: L.leadOrigenId || '',
      },
    };

    setSelected(oportunidad);
    setSavedId(null);
    setFormMode('create');
    setVista('form');

    toast.success('Oportunidad abierta', {
      description: `Folio ${oportunidad.no_cotiza} — complete la estructura bursátil y la cotización de comisiones.`,
    });

    onLeadParaOportunidadConsumido?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadParaOportunidad]);

  // ══════════════════════════════════════════════════════════════
  // Regreso desde Solicitudes — reabrir la Oportunidad en edición.
  // Espera a que la lista traiga el registro (la consulta a BD es async);
  // mientras tanto el deep link se conserva sin consumirse.
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!oportunidadDeepLinkId) return;
    const encontrada = oportunidades.find(o => String(o.id) === String(oportunidadDeepLinkId));
    if (!encontrada) {
      // Aún cargando: no consumir el deep link todavía. Si ya terminó de
      // cargar y aun así no existe, soltar el link para no quedar en bucle.
      if (!loading) onOportunidadDeepLinkConsumido?.();
      return;
    }
    setSelected(encontrada);
    setFormMode('edit');
    setVista('form');
    onOportunidadDeepLinkConsumido?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oportunidadDeepLinkId, cotizacionesDB, loading]);

  // ── Handlers ──
  // Alta manual: se arma una Oportunidad en blanco. Antes se pasaba
  // `undefined` y el formulario mostraba su estado vacío, así que no había
  // forma de dar de alta una Oportunidad fuera del flujo de Lead.
  const handleNew = () => {
    const nueva = crearCotizacionCreditoVacia(generarNoCotizaCredito('LDC'), 'Línea de Crédito');
    setSelected({ ...nueva, estatus_cotiza: ESTATUS_OPORTUNIDAD_INICIAL }); // CA-02
    setSavedId(null);
    setFormMode('create');
    setVista('form');
  };
  const handleView = (o: CotizacionCredito) => { setSelected(o); setFormMode('view'); setVista('form'); };
  const handleEdit = (o: CotizacionCredito) => { setSelected(o); setFormMode('edit'); setVista('form'); };

  const handleSave = async (o: CotizacionCredito) => {
    const dbResult = await saveCotizacion(o as any);
    const finalId = dbResult.id ?? o.id;

    const guardada: CotizacionCredito = { ...o, id: finalId };
    setLocales(prev => {
      const idx = prev.findIndex(x => x.id === o.id || x.no_cotiza === o.no_cotiza);
      const next = idx >= 0 ? prev.map((x, i) => (i === idx ? guardada : x)) : [...prev, guardada];
      try { sessionStorage.setItem(SS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

    setSelected(guardada);
    setFormMode('edit');

    // BUG FIX (2026-08-25): antes se marcaba savedId y se mostraba "guardada"
    // sin importar si saveCotizacion realmente escribió en la BD. Eso hacía
    // que el badge "Guardada en BD" (existeEnBD compara selected.id===savedId)
    // mintiera, y el usuario nunca se enteraba de que la Oportunidad se había
    // quedado solo en sessionStorage. Ver useCotizacionesCaptacionDB.ts.
    if (dbResult.ok) {
      setSavedId(finalId);
      toast.success('Oportunidad guardada', { description: `Folio: ${o.no_cotiza}` });
      setTimeout(() => refetch(), 500);
    } else {
      console.error('[OportunidadesModule] Falló el guardado en BD:', dbResult.error);
      toast.error('No se pudo guardar en la base de datos', {
        description: dbResult.error || 'La Oportunidad se conservó solo en este navegador. Vuelva a intentar Guardar.',
        duration: 8000,
      });
    }
  };

  const existeEnBD =
    (selected != null && selected.id === savedId) ||
    (selected ? desdeDB.some(c => c.id === selected.id) : false);

  return (
    <>
      {/* ═══ Subnavegación Home / Lista — estándar Core Banking ═══ */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => setVista('home')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${vista === 'home' ? 'tab-active' : 'tab-inactive'}`}
            title="Home de Oportunidades"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z" /><path d="M6 14v-5h4v5" />
            </svg>
            <span>Inicio</span>
          </button>
          <button
            onClick={() => setVista('list')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${vista === 'list' || vista === 'form' ? 'tab-active' : 'tab-inactive'}`}
            title="Lista de Oportunidades"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
            <span>Lista</span>
          </button>
        </div>
      </div>

      {vista === 'home' ? (
        <OportunidadesDashboard
          oportunidades={oportunidades}
          onNew={handleNew}
          onViewList={() => setVista('list')}
          onView={handleView}
        />
      ) : vista === 'list' ? (
        <OportunidadesList
          oportunidades={oportunidades}
          onNew={handleNew}
          onView={handleView}
          onEdit={handleEdit}
          loading={loading}
          onRefresh={() => refetch()}
        />
      ) : (
        <OportunidadForm
          mode={formMode}
          oportunidad={selected}
          onSave={handleSave}
          onBack={() => setVista('list')}
          existeEnBD={existeEnBD}
          onNavigateToSolicitud={onNavigateToSolicitud}
          onCrearSolicitudDesdeOportunidad={onCrearSolicitudDesdeOportunidad}
        />
      )}
    </>
  );
}
