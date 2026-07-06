/**
 * GarantiasTab.tsx — Flujo de Garantías en Solicitud de Crédito
 *
 * Sección 1: Garantías disponibles del cliente (J_GARANTIAS)
 *   - Tabla con checkbox para seleccionar
 *   - Filtra las ya seleccionadas (no duplica)
 *
 * Sección 2: Garantías seleccionadas para esta solicitud
 *   - Muestra las elegidas con su valor
 *   - Validación: suma(valores) >= monto × (aforo/100) si hay aforo, o >= monto si no hay
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Garantia,
  saveToSession, loadFromSession, loadFromSavedStore, generateId,
  formatCurrency,
} from './solicitudCreditoStore';
import { useGarantiasDB } from '../../hooks/useGarantiasDB';

const LOG = '[GarantiasTab]';
const CURRENT_USER = '(sesión pendiente)';

// Garantías de ejemplo por tipo de crédito
function buildGarantiasDemoForTipo(tipo: string): Garantia[] {
  const t = (tipo || '').toLowerCase();

  // ── Crédito Hipotecario ──
  if (t.includes('hipotecario')) {
    return [
      {
        id: -1001, garantiaDbId: undefined,
        fecha: '10/03/2025 09:15', usuario: 'Sistema',
        tipo: 'Inmueble', subtipo: 'Casa Habitación',
        descripcion: 'Casa habitacional de dos niveles, escritura pública inscrita en RPP, libre de gravamen',
        valorNominal: 2_500_000,
        ubicacion: 'Calle Roble #247, Col. Jardines del Pedregal, CDMX',
        estatus: 'Vigente',
        nota: 'Avalúo vigente emitido por perito certificado CNBV. Folio RPP: 2025-CDMX-04471. Seguro de daños con beneficiario endosado a la institución.',
        fase: 'Fase 1', faseId: 1, area: 'INTEGRACIÓN',
      },
      {
        id: -1002, garantiaDbId: undefined,
        fecha: '10/03/2025 09:30', usuario: 'Sistema',
        tipo: 'Inmueble', subtipo: 'Terreno',
        descripcion: 'Terreno urbano con uso de suelo habitacional mixto, escriturado',
        valorNominal: 850_000,
        ubicacion: 'Manzana 12, Lote 5, Fracc. Valle Verde, Querétaro, Qro.',
        estatus: 'Pendiente',
        nota: 'En proceso de inscripción RPP municipal. Certificado de libertad de gravamen adjunto al expediente.',
        fase: 'Fase 1', faseId: 1, area: 'INTEGRACIÓN',
      },
    ];
  }

  // ── Crédito Quirografario (sin garantía real — firmado solo) ──
  if (t.includes('quirografario') || t.includes('personal') || t.includes('simple')) {
    return [
      {
        id: -1001, garantiaDbId: undefined,
        fecha: '10/03/2025 09:15', usuario: 'Sistema',
        tipo: 'Personal', subtipo: 'Pagaré',
        descripcion: 'Pagaré quirografario firmado por el acreditado como garantía de pago',
        valorNominal: 150_000,
        ubicacion: 'Resguardo documental — Sucursal CDMX Norte',
        estatus: 'Vigente',
        nota: 'Documento original firmado ante dos testigos. Vence a la par con la última amortización.',
        fase: 'Fase 1', faseId: 1, area: 'INTEGRACIÓN',
      },
      {
        id: -1002, garantiaDbId: undefined,
        fecha: '10/03/2025 09:25', usuario: 'Sistema',
        tipo: 'Personal', subtipo: 'Aval',
        descripcion: 'Obligado solidario (aval) con comprobante de ingresos y buen historial crediticio',
        valorNominal: 150_000,
        ubicacion: 'Resguardo documental — Sucursal CDMX Norte',
        estatus: 'Vigente',
        nota: 'Aval con ingresos verificados $35,000/mes. Buró de crédito: Sin notas negativas.',
        fase: 'Fase 1', faseId: 1, area: 'INTEGRACIÓN',
      },
    ];
  }

  // ── Crédito Prendario / Automotriz ──
  if (t.includes('prendario') || t.includes('automotriz') || t.includes('vehiculo') || t.includes('vehículo')) {
    return [
      {
        id: -1001, garantiaDbId: undefined,
        fecha: '10/03/2025 09:15', usuario: 'Sistema',
        tipo: 'Mueble', subtipo: 'Automóvil',
        descripcion: 'Vehículo sedán 2023, 4 puertas, transmisión automática — prenda sin desplazamiento',
        valorNominal: 420_000,
        ubicacion: 'Estacionamiento Corporativo — Av. Insurgentes Sur 1235, CDMX',
        estatus: 'Vigente',
        nota: 'Factura original en resguardo. Endoso en garantía registrado ante REPUVE. Seguro todo riesgo vigente con beneficiario endosado.',
        fase: 'Fase 1', faseId: 1, area: 'INTEGRACIÓN',
      },
      {
        id: -1002, garantiaDbId: undefined,
        fecha: '10/03/2025 09:30', usuario: 'Sistema',
        tipo: 'Mueble', subtipo: 'Maquinaria',
        descripcion: 'Equipo industrial de respaldo — prenda accesoria sobre bienes del acreditado',
        valorNominal: 95_000,
        ubicacion: 'Bodega del acreditado — Km. 14 Carr. Toluca-Naucalpan, Edo. Méx.',
        estatus: 'Pendiente',
        nota: 'Inventario valorado por perito. Seguro de daños en trámite.',
        fase: 'Fase 1', faseId: 1, area: 'INTEGRACIÓN',
      },
    ];
  }

  // ── Scoring Crediticio (garantía moral / respaldo de historial) ──
  if (t.includes('scoring') || t.includes('revolvente') || t.includes('empresarial')) {
    return [
      {
        id: -1001, garantiaDbId: undefined,
        fecha: '10/03/2025 09:15', usuario: 'Sistema',
        tipo: 'Personal', subtipo: 'Aval Empresarial',
        descripcion: 'Obligado solidario (persona moral) con estados financieros dictaminados',
        valorNominal: 500_000,
        ubicacion: 'Resguardo documental — Área Jurídica CDMX',
        estatus: 'Vigente',
        nota: 'Score crediticio: 780/850. Historial limpio en Buró de Crédito. Estados financieros auditados al cierre del ejercicio anterior.',
        fase: 'Fase 1', faseId: 1, area: 'INTEGRACIÓN',
      },
      {
        id: -1002, garantiaDbId: undefined,
        fecha: '10/03/2025 09:40', usuario: 'Sistema',
        tipo: 'Inmueble', subtipo: 'Local Comercial',
        descripcion: 'Local comercial en planta baja de centro comercial, régimen de condominio',
        valorNominal: 1_200_000,
        ubicacion: 'Plaza Comercial Santa Fe, Local B-14, CDMX',
        estatus: 'Pendiente',
        nota: 'Avalúo en proceso. Escritura en trámite de inscripción. Certificado de no adeudo predial adjunto.',
        fase: 'Fase 1', faseId: 1, area: 'INTEGRACIÓN',
      },
    ];
  }

  // ── Default: garantías genéricas ──
  return [
    {
      id: -1001, garantiaDbId: undefined,
      fecha: '10/03/2025 09:15', usuario: 'Sistema',
      tipo: 'Inmueble', subtipo: 'Departamento',
      descripcion: 'Departamento habitacional en zona residencial, escritura pública inscrita en RPP',
      valorNominal: 1_850_000,
      ubicacion: 'Calle Roble #247, Col. Jardines del Pedregal, CDMX',
      estatus: 'Vigente',
      nota: 'Avalúo vigente emitido por perito certificado. Registro 2025-CDMX-04471.',
      fase: 'Fase 1', faseId: 1, area: 'INTEGRACIÓN',
    },
    {
      id: -1002, garantiaDbId: undefined,
      fecha: '10/03/2025 09:20', usuario: 'Sistema',
      tipo: 'Mueble', subtipo: 'Automóvil',
      descripcion: 'Vehículo sedán 2023, placas CDMX, endoso en garantía ante REPUVE',
      valorNominal: 420_000,
      ubicacion: 'Estacionamiento Corporativo — Av. Insurgentes Sur 1235, CDMX',
      estatus: 'Vigente',
      nota: 'Factura original en resguardo. Seguro vigente con beneficiario endosado.',
      fase: 'Fase 1', faseId: 1, area: 'INTEGRACIÓN',
    },
  ];
}

// IDs reservados para garantías demo (IDs negativos -1001 a -1099)
const DEMO_IDS = new Set([-1001, -1002, -1003, -1004, -1005]);

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  montoSolicitado?: string;
  clienteId?: string;
  faseIdActual?: number;
  porcentajeAforo?: number;
  tipoProducto?: string;
}

export function GarantiasTab({ mode, solicitudId, montoSolicitado, clienteId, faseIdActual = 1, porcentajeAforo: aforoProp, tipoProducto }: Props) {
  // Leer aforo desde Términos y Condiciones en sessionStorage si no viene por prop
  const porcentajeAforo = useMemo(() => {
    if (aforoProp != null) return aforoProp;
    try {
      const terminos = loadFromSession<any>(solicitudId, 'terminos');
      if (terminos?.porcentajeAforo != null) return Number(terminos.porcentajeAforo);
    } catch { /* ignore */ }
    return undefined;
  }, [aforoProp, solicitudId]);

  console.log(`${LOG} clienteId:`, clienteId, '| solicitudId:', solicitudId, '| aforo:', porcentajeAforo);

  const { garantias: garantiasCliente, loading: loadingCliente } = useGarantiasDB(clienteId);

  const getInitItems = useCallback((): Garantia[] => {
    const s = loadFromSession<Garantia[]>(solicitudId, 'garantias');
    if (s && s.length > 0) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<Garantia[]>(solicitudId, 'garantias');
    if (saved && saved.length > 0) return saved;
    // En modo editar sin datos guardados: mostrar ejemplos demo ilustrativos según tipo de crédito
    if (mode === 'editar') return buildGarantiasDemoForTipo(tipoProducto || '');
    return [];
  }, [solicitudId, mode, tipoProducto]);

  const [items, setItems] = useState<Garantia[]>(getInitItems);
  const [showModal, setShowModal] = useState(false);
  const [selectedDbIds, setSelectedDbIds] = useState<Set<string | number>>(new Set());
  const isRO = mode === 'ver';

  // Son todos demo si todos los IDs son negativos de la lista demo
  const allDemo = useMemo(() => items.length > 0 && items.every(g => DEMO_IDS.has(g.id)), [items]);

  useEffect(() => {
    // No persistir los datos demo — solo guardar cuando el usuario haya modificado
    if (!isRO && !allDemo) saveToSession(solicitudId, 'garantias', items);
  }, [items, solicitudId, isRO, allDemo]);

  const montoReq = useMemo(() => {
    return parseFloat((montoSolicitado || '0').replace(/[^0-9.-]/g, '')) || 0;
  }, [montoSolicitado]);

  // IDs ya agregados a la solicitud (para evitar duplicados)
  const idsAgregados = useMemo(() => new Set(items.map(i => i.garantiaDbId).filter(Boolean)), [items]);

  // Disponibles = las del cliente que no están ya agregadas
  const garantiasDisponibles = useMemo(() => {
    return garantiasCliente.filter(g => !idsAgregados.has(String(g.id)));
  }, [garantiasCliente, idsAgregados]);

  const totalSeleccionadas = useMemo(() => {
    return items.reduce((s, g) => s + (g.valorNominal || 0), 0);
  }, [items]);

  // Validación cobertura con aforo
  const montoACubrir = useMemo(() => {
    if (porcentajeAforo && porcentajeAforo > 0) {
      return montoReq * (porcentajeAforo / 100);
    }
    return montoReq;
  }, [montoReq, porcentajeAforo]);

  const coberturaSuficiente = montoReq <= 0 || totalSeleccionadas >= montoACubrir;
  const coberturaRatio = montoACubrir > 0 ? Math.min(100, Math.round((totalSeleccionadas / montoACubrir) * 100)) : 100;

  const toggleDbSelect = (id: string | number) => {
    setSelectedDbIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selectedDbIds.size === garantiasDisponibles.length) {
      setSelectedDbIds(new Set());
    } else {
      setSelectedDbIds(new Set(garantiasDisponibles.map(g => g.id)));
    }
  };

  const handleAgregarSeleccionadas = () => {
    if (selectedDbIds.size === 0) {
      toast.error('Seleccione al menos una garantía');
      return;
    }
    const now = new Date();
    const fecha = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const nuevas: Garantia[] = garantiasDisponibles
      .filter(g => selectedDbIds.has(g.id))
      .map(g => ({
        id: generateId(),
        garantiaDbId: String(g.id),
        fecha,
        usuario: CURRENT_USER,
        tipo: g.tipo || '',
        subtipo: g.subtipo || '',
        descripcion: g.descripcion || g.garantia || '',
        valorNominal: g.valorNominal || 0,
        ubicacion: g.ubicacion || '',
        estatus: 'Pendiente',
        nota: '',
        fase: `Fase ${faseIdActual}`,
        faseId: faseIdActual,
        area: 'INTEGRACIÓN',
      }));

    // Al agregar garantías reales, eliminar los ejemplos demo si aún están presentes
    setItems(prev => [...prev.filter(g => !DEMO_IDS.has(g.id)), ...nuevas]);
    setSelectedDbIds(new Set());
    setShowModal(false);
    toast.success(`${nuevas.length} garantía(s) agregada(s) a la solicitud`);
    console.log(`${LOG} Agregadas:`, nuevas.map(g => `${g.tipo} — ${formatCurrency(g.valorNominal)}`).join(', '));
  };

  const handleEliminar = (id: number) => {
    setItems(prev => prev.filter(g => g.id !== id));
    toast.success('Garantía eliminada de la solicitud');
  };

  return (
    <div className="bg-white">

      {/* ═══ SECCIÓN 1 — Garantías Seleccionadas para esta Solicitud ═══ */}
      <div className="px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Garantías de la Solicitud
            </span>
            <span className="ml-2 text-[10px] text-gray-400">
              {items.length} seleccionada(s)
            </span>
          </div>
          {!isRO && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A6FA5] text-white text-xs rounded hover:bg-[#3E5C91]"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 1v10M1 6h10"/>
              </svg>
              Seleccionar Garantía
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3">

        {/* Banner de datos de ejemplo */}
        {allDemo && (
          <div className="mb-3 px-3 py-2 text-xs border border-amber-300 bg-amber-50 text-amber-800 flex items-start gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
              <path d="M7 1L13 12H1L7 1Z" stroke="#B45309" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7 5v3M7 10h.01" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>
              <strong>Datos de ejemplo (DEMO)</strong> — Este registro no tiene garantías guardadas.
              Se muestran garantías ilustrativas para referencia. Al agregar o quitar una garantía real, estos ejemplos se reemplazarán.
            </span>
          </div>
        )}

        {/* Indicador de cobertura */}
        {montoReq > 0 && (
          <div className={`mb-3 px-3 py-2 text-xs border flex items-start gap-2 ${
            coberturaSuficiente
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {coberturaSuficiente ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0"><path d="M2.5 7l3 3 6-6" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0"><circle cx="7" cy="7" r="6" stroke="#C62828" strokeWidth="1.5"/><path d="M7 4v3.5M7 10h.01" stroke="#C62828" strokeWidth="1.5" strokeLinecap="round"/></svg>
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span>
                  Total garantías: <strong>{formatCurrency(totalSeleccionadas)}</strong>
                  {' '}/ Monto a cubrir: <strong>{formatCurrency(montoACubrir)}</strong>
                  {porcentajeAforo ? ` (${porcentajeAforo}% aforo sobre ${formatCurrency(montoReq)})` : ''}
                </span>
                <span className="font-medium">{coberturaRatio}%</span>
              </div>
              <div className="w-full bg-white/60 rounded-full h-1.5 border border-current/20">
                <div
                  className={`h-1.5 rounded-full transition-all ${coberturaSuficiente ? 'bg-green-500' : 'bg-red-400'}`}
                  style={{ width: `${coberturaRatio}%` }}
                />
              </div>
              {!coberturaSuficiente && (
                <p className="mt-1 text-[10px]">
                  Falta: <strong>{formatCurrency(montoACubrir - totalSeleccionadas)}</strong> para cumplir la cobertura requerida.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tabla garantías seleccionadas */}
        {items.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-xs border border-gray-200 bg-gray-50">
            <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
              <rect x="4" y="8" width="24" height="16" rx="2"/><path d="M4 14h24M12 8V5M20 8V5"/>
            </svg>
            <p>No hay garantías seleccionadas para esta solicitud.</p>
            {!isRO && <p className="mt-1 text-gray-300">Presione "Seleccionar Garantía" para agregar.</p>}
          </div>
        ) : (
          <div className="border border-gray-300 overflow-hidden overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                  <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">TIPO</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">SUBTIPO</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">DESCRIPCIÓN</th>
                  <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">VALOR NOMINAL</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">UBICACIÓN</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">FASE</th>
                  <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold border-r border-gray-300">ESTATUS</th>
                  {!isRO && <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold">ACCIÓN</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((g, idx) => (
                  <tr
                    key={g.id}
                    className="border-b border-gray-200"
                    style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#EEEEEE' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#FFFFFF' : '#EEEEEE'; }}
                  >
                    <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-700">
                      {g.tipo}
                      {DEMO_IDS.has(g.id) && (
                        <span className="ml-1.5 px-1 py-0.5 text-[8px] font-bold bg-amber-100 text-amber-700 border border-amber-300 rounded-sm align-middle">
                          DEMO
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-600">{g.subtipo || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-600 max-w-[180px] truncate" title={g.descripcion}>{g.descripcion}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-right font-mono font-medium text-gray-700">{formatCurrency(g.valorNominal)}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-600">{g.ubicacion || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 border-r border-gray-200">
                      <span className="px-1.5 py-0.5 text-[9px] bg-blue-50 text-blue-700 border border-blue-200">{g.fase}</span>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 text-center">
                      <span className={`px-1.5 py-0.5 text-[9px] border ${
                        g.estatus === 'Vigente'   ? 'bg-green-50 text-green-700 border-green-200' :
                        g.estatus === 'Pendiente' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                      }`}>{g.estatus}</span>
                    </td>
                    {!isRO && (
                      <td className="px-3 py-2 text-center">
                        {DEMO_IDS.has(g.id) ? (
                          <span className="text-[9px] text-amber-500 italic">ejemplo</span>
                        ) : (
                          <button
                            onClick={() => handleEliminar(g.id)}
                            className="text-red-500 hover:text-red-700 text-[10px] hover:underline"
                          >
                            Quitar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#D0D0D0' }} className="border-t border-gray-300">
                  <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-700">Total:</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{formatCurrency(totalSeleccionadas)}</td>
                  <td colSpan={isRO ? 3 : 4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ═══ SECCIÓN 2 — Garantías del Cliente disponibles (solo lectura referencial) ═══ */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Garantías Registradas del Cliente
          </span>
          <span className="text-[10px] text-gray-400">{garantiasCliente.length} disponible(s)</span>
        </div>

        {loadingCliente ? (
          <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-xs">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
            </svg>
            Cargando garantías del cliente...
          </div>
        ) : garantiasCliente.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-2">
            {clienteId ? 'El cliente no tiene garantías registradas en J_GARANTIAS.' : 'No hay cliente asociado.'}
          </p>
        ) : (
          <div className="border border-gray-300 overflow-hidden overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                  <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">TIPO</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">SUBTIPO</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">DESCRIPCIÓN</th>
                  <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">VALOR NOMINAL</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">UBICACIÓN</th>
                  <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold">ESTATUS</th>
                </tr>
              </thead>
              <tbody>
                {garantiasCliente.map((gc, idx) => {
                  const yaAgregada = idsAgregados.has(String(gc.id));
                  return (
                    <tr
                      key={`gc-${gc.id}-${idx}`}
                      className="border-b border-gray-200"
                      style={{ backgroundColor: yaAgregada ? '#F0FDF4' : idx % 2 === 0 ? '#FFFFFF' : '#EEEEEE', opacity: yaAgregada ? 0.7 : 1 }}
                    >
                      <td className="px-3 py-1.5 border-r border-gray-200 font-medium text-gray-700">
                        {gc.tipo}
                        {yaAgregada && <span className="ml-1 text-[9px] text-green-600">✓ agregada</span>}
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-200 text-gray-600">{gc.subtipo || '—'}</td>
                      <td className="px-3 py-1.5 border-r border-gray-200 text-gray-600">{gc.descripcion || gc.garantia || '—'}</td>
                      <td className="px-3 py-1.5 border-r border-gray-200 text-right font-mono text-gray-700">{gc.valorNominal ? formatCurrency(gc.valorNominal) : '—'}</td>
                      <td className="px-3 py-1.5 border-r border-gray-200 text-gray-600">{gc.ubicacion || '—'}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="px-1.5 py-0.5 text-[9px] bg-green-50 text-green-700 border border-green-200">{gc.estatus || 'Vigente'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ MODAL — Seleccionar Garantías ═══ */}
      {showModal && !isRO && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"/>
          <div className="relative bg-white shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="bg-[#4A6FA5] px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Seleccionar Garantía</span>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 2l12 12M14 2L2 14"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-4">
              {garantiasDisponibles.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  {garantiasCliente.length === 0
                    ? 'El cliente no tiene garantías registradas en J_GARANTIAS.'
                    : 'Todas las garantías del cliente ya fueron agregadas a esta solicitud.'}
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600 mb-3">
                    Seleccione las garantías del cliente que respaldarán esta solicitud.
                    {porcentajeAforo ? ` Aforo configurado: ${porcentajeAforo}% — monto a cubrir: ${formatCurrency(montoACubrir)}.` : ''}
                  </p>
                  <div className="border border-gray-300 overflow-hidden overflow-x-auto mb-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                          <th className="px-2 py-2 w-8 border-r border-gray-300">
                            <input
                              type="checkbox"
                              checked={selectedDbIds.size === garantiasDisponibles.length && garantiasDisponibles.length > 0}
                              onChange={toggleAll}
                              className="w-3 h-3 accent-[#4A6FA5]"
                            />
                          </th>
                          <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">TIPO</th>
                          <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold border-r border-gray-300">DESCRIPCIÓN</th>
                          <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold border-r border-gray-300">VALOR</th>
                          <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold">UBICACIÓN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {garantiasDisponibles.map((g, idx) => {
                          const sel = selectedDbIds.has(g.id);
                          return (
                            <tr
                              key={g.id}
                              className="border-b border-gray-200 cursor-pointer"
                              style={{ backgroundColor: sel ? '#E8F4F8' : idx % 2 === 0 ? '#FFFFFF' : '#EEEEEE' }}
                              onClick={() => toggleDbSelect(g.id)}
                            >
                              <td className="px-2 py-2 text-center border-r border-gray-200">
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={() => toggleDbSelect(g.id)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-3 h-3 accent-[#4A6FA5]"
                                />
                              </td>
                              <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-700">{g.tipo}{g.subtipo ? ` / ${g.subtipo}` : ''}</td>
                              <td className="px-3 py-2 border-r border-gray-200 text-gray-600">{g.descripcion || g.garantia || '—'}</td>
                              <td className="px-3 py-2 border-r border-gray-200 text-right font-mono text-gray-700">{g.valorNominal ? formatCurrency(g.valorNominal) : '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{g.ubicacion || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Resumen selección */}
                  {selectedDbIds.size > 0 && (
                    <div className="px-3 py-2 bg-blue-50 border border-blue-200 text-xs text-blue-800 mb-3">
                      {selectedDbIds.size} garantía(s) seleccionada(s) — Total:{' '}
                      <strong>
                        {formatCurrency(
                          garantiasDisponibles
                            .filter(g => selectedDbIds.has(g.id))
                            .reduce((s, g) => s + (g.valorNominal || 0), 0)
                        )}
                      </strong>
                      {montoACubrir > 0 && (() => {
                        const totalSel = garantiasDisponibles
                          .filter(g => selectedDbIds.has(g.id))
                          .reduce((s, g) => s + (g.valorNominal || 0), 0);
                        const totalConExist = totalSel + totalSeleccionadas;
                        const ok = totalConExist >= montoACubrir;
                        return (
                          <span className={`ml-2 ${ok ? 'text-green-700' : 'text-amber-700'}`}>
                            — Cobertura total: {formatCurrency(totalConExist)} / {formatCurrency(montoACubrir)} {ok ? '✓' : '(insuficiente)'}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowModal(false); setSelectedDbIds(new Set()); }}
                className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgregarSeleccionadas}
                disabled={selectedDbIds.size === 0}
                className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs rounded hover:bg-[#3E5C91] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Agregar {selectedDbIds.size > 0 ? `(${selectedDbIds.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
