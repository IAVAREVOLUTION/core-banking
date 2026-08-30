import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/app/components/ui/DatePicker';
import {
  CargoSolicitud, TerminosCondiciones, EMPTY_TERMINOS, SimulacionRow,
  saveToSession, loadFromSession, loadFromSavedStore, generateId, MOCK_CARGOS, CAT_TIPO_CARGO, CAT_ESTATUS_CARGO, formatCurrency,
  calcularCargosArrendamiento,
  esArrendamiento,
} from './solicitudCreditoStore';
import type { SimulacionArrendamiento } from '../cotizaciones/cotizacionArrendamientoTypes';
import { useComponentesContablesCatalogo } from '@/app/hooks/useComponentesContablesCatalogo';

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  lineaProducto?: string;
  tipoProducto?: string;
}

export function SolicitudCargosTab({ mode, solicitudId, lineaProducto, tipoProducto }: Props) {
  // REQ-15 — el Tipo de Cargo sale del catálogo de Componentes Contables;
  // CAT_TIPO_CARGO queda como respaldo si el catálogo no responde.
  const { opcionesTipoCargo, desdeCatalogo } = useComponentesContablesCatalogo();
  const opcionesTipo = desdeCatalogo ? opcionesTipoCargo : CAT_TIPO_CARGO.map(t => ({ value: t.value, label: t.label }));
  // Puro y Financiero comparten los mismos conceptos de desembolso inicial
  // (Enganche, Comisión, Renta Anticipada) — difiere solo la FUENTE de la
  // renta anticipada: Puro usa el Calendario de rentas fijas, Financiero usa
  // la Tabla de Amortización (capital+interés de la primera fila).
  const isArrendamiento = useMemo(() => {
    const t = (tipoProducto || lineaProducto || '').toLowerCase();
    return t.includes('arrendamiento');
  }, [lineaProducto, tipoProducto]);
  // Puro y Financiero comparten el desembolso inicial (enganche + comisión de
  // apertura + rentas anticipadas), así que ambos entran aquí.
  const isArrendamientoPuro = useMemo(
    () => esArrendamiento(lineaProducto, tipoProducto),
    [lineaProducto, tipoProducto]
  );

  // ── Desglose de desembolso inicial (vista previa — no persiste hasta enviar a originación) ──
  const cargosArrendamiento = useMemo(() => {
    if (!isArrendamiento) return [];
    const terminos = loadFromSession<TerminosCondiciones>(solicitudId, 'terminos')
      || loadFromSavedStore<TerminosCondiciones>(solicitudId, 'terminos')
      || EMPTY_TERMINOS;

    const montoSolicitado = parseFloat((terminos.montoSolicitado || '0').replace(/[^0-9.-]/g, '')) || 0;
    const montoAutorizado = parseFloat(terminos.montoAutorizado || '0') || 0;
    const porcentajeEnganche = parseFloat(terminos.porcentajeEnganche || '0') || 0;
    const porcentajeComisionApertura = parseFloat(terminos.comisionApertura || '0') || 0;
    const montoEnganche = terminos.montoEnganche || 0;

    // N rentas anticipadas — una línea de Cargos por cada mes (1, 2, 3...)
    const rentasAnticipadas: { rentaSinIva: number; seguro: number }[] = [];

    if (isArrendamientoPuro) {
      const arr = loadFromSession<SimulacionArrendamiento>(solicitudId, 'simulacion_arrendamiento')
        || loadFromSavedStore<SimulacionArrendamiento>(solicitudId, 'simulacion_arrendamiento');
      for (const r of arr?.rentasAnticipadasDescontadas || []) {
        rentasAnticipadas.push({ rentaSinIva: r.rentaSinIva || 0, seguro: r.seguro || 0 });
      }
    } else {
      // Arrendamiento Financiero: Renta Anticipada de cada mes = capital +
      // interés de las primeras N filas de la Tabla de Amortización (sin el
      // IVA de esa fila) — N = número de rentas anticipadas seleccionado.
      const numAnticipadas = parseInt(String(terminos.rentasAnticipadas || '0'), 10) || 0;
      const rows = loadFromSession<SimulacionRow[]>(solicitudId, 'simulacion')
        || loadFromSavedStore<SimulacionRow[]>(solicitudId, 'simulacion');
      for (let i = 0; i < numAnticipadas; i++) {
        const pago = rows?.[i];
        if (!pago) break;
        rentasAnticipadas.push({ rentaSinIva: pago.pagoCapital + pago.pagoInteres, seguro: pago.pagoSeguro || 0 });
      }
    }

    if (montoSolicitado <= 0 && montoAutorizado <= 0) return [];

    return calcularCargosArrendamiento({
      montoSolicitado,
      montoAutorizado,
      porcentajeEnganche,
      porcentajeComisionApertura,
      montoEnganche,
      rentasAnticipadas,
    });
  }, [isArrendamiento, isArrendamientoPuro, solicitudId]);
  const getInit = (): CargoSolicitud[] => {
    const s = loadFromSession<CargoSolicitud[]>(solicitudId, 'cargos');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<CargoSolicitud[]>(solicitudId, 'cargos');
    if (saved) return saved;
    return MOCK_CARGOS[solicitudId as number] || [];
  };

  const [items, setItems] = useState<CargoSolicitud[]>(getInit);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const isRO = mode === 'ver';

  useEffect(() => { if (mode !== 'ver') saveToSession(solicitudId, 'cargos', items); }, [items, solicitudId, mode]);

  // ── Sincronizar el desglose calculado de Arrendamiento hacia 'cargos' ──
  // avanzarFase (envío a originación) lee sessionStorage['cargos'] para
  // persistir a BD — sin esto, el desglose que se ve en pantalla nunca
  // llegaría a BD, solo lo que el usuario agregara a mano con "+ Nuevo".
  // Si se re-simula, reemplaza las líneas calculadas anteriores (por
  // tipoCargo con prefijo institucional) preservando cargos manuales.
  useEffect(() => {
    if (mode === 'ver' || !isArrendamiento) return;
    setItems(prev => {
      const manuales = prev.filter(c => !c.tipoCargo.startsWith('ARR_'));
      if (cargosArrendamiento.length === 0) return manuales.length !== prev.length ? manuales : prev;
      const calculados: CargoSolicitud[] = cargosArrendamiento.map((c, idx) => ({
        id: -1000 - idx, // rango negativo reservado para no colisionar con generateId()
        tipoCargo: `ARR_${c.concepto}`,
        descripcion: c.descripcion,
        monto: c.monto,
        fechaCargo: new Date().toISOString().split('T')[0],
        estatus: 'Pendiente',
        notas: '',
      }));
      return [...calculados, ...manuales];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargosArrendamiento, isArrendamiento, mode]);

  const handleNuevo = () => {
    const newId = generateId();
    setItems(p => [...p, { id: newId, tipoCargo: '', descripcion: '', monto: 0, fechaCargo: '', estatus: 'Pendiente', notas: '' }]);
    setSelectedId(newId);
    toast.success('Cargo agregado');
  };

  const handleEliminar = () => {
    if (selectedId === null) { toast.error('Seleccione un cargo'); return; }
    setItems(p => p.filter(c => c.id !== selectedId));
    setSelectedId(null);
    toast.success('Cargo eliminado');
  };

  // Opera por id (no por índice posicional): itemsManuales es un subconjunto
  // filtrado de items, así que un índice de .map() sobre el subconjunto no
  // corresponde a la posición real en items — id evita ese desalineamiento.
  const update = (id: number, f: keyof CargoSolicitud, v: any) => {
    setItems(p => p.map(c => c.id === id ? { ...c, [f]: v } : c));
  };

  // El CRUD manual de abajo solo muestra cargos capturados a mano — los
  // calculados de Arrendamiento (prefijo ARR_) ya se ven en la tabla de
  // Desembolso Inicial de arriba; evita duplicar la misma info dos veces.
  const itemsManuales = items.filter(c => !c.tipoCargo.startsWith('ARR_'));
  const totalMonto = itemsManuales.reduce((sum, c) => sum + (c.monto || 0), 0);

  return (
    <div className="p-5">
      {/* ── Desembolso Inicial — Arrendamiento Puro (vista previa, no persiste hasta enviar a originación) ── */}
      {isArrendamiento && (
        <div className="mb-6 border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-blue-50 border-l-4 border-primary-theme px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">DESEMBOLSO INICIAL — VISTA PREVIA</span>
            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              No persiste hasta enviar a originación
            </span>
          </div>
          {cargosArrendamiento.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500">
              Complete Términos y Condiciones y presione "Simular" en el subtab Simulación para ver el desglose.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Concepto</th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cargosArrendamiento.map(c => (
                  <tr key={c.concepto} className={c.concepto === 'TOTAL_PAGO_INICIAL' ? 'bg-gray-100 font-semibold' : ''}>
                    <td className="px-4 py-2 text-gray-700">{c.descripcion}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-800">{formatCurrency(c.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4A6FA5] to-[#607698] flex items-center justify-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M8 2v12M4 6l4-4 4 4M4 10l4 4 4-4" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Cargos de la Solicitud</h4>
              <p className="text-[10px] text-gray-400 leading-tight">
                {solicitudId === 'new' ? 'Nueva Solicitud' : `Sol. ${solicitudId}`}
              </p>
            </div>
          </div>
          {itemsManuales.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-[#4A6FA5] text-white shadow-sm">
              {itemsManuales.length}
            </span>
          )}
        </div>
        {!isRO && (
          <div className="flex items-center gap-2">
            <button onClick={handleNuevo} className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 shadow-sm bg-[#4A6FA5] text-white hover:bg-[#3A5A8A]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 1v10M1 6h10" />
              </svg>
              Nuevo
            </button>
            <button onClick={handleEliminar} className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 3h8M5 3V2h2v1M4 3v7a1 1 0 001 1h2a1 1 0 001-1V3" />
              </svg>
              Eliminar
            </button>
          </div>
        )}
      </div>

      {itemsManuales.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gradient-to-b from-gray-50/50 to-white">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C4C9D4" strokeWidth="1.5">
              <path d="M14 6v16M8 10l6-4 6 4M8 18l6 4 6-4" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Sin cargos</p>
          <p className="text-xs text-gray-400">
            {!isRO ? 'Presione "Nuevo" para agregar un cargo.' : 'No se han registrado cargos para esta solicitud.'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tipo Cargo</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha Cargo</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Estatus</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itemsManuales.map((c) => (
                  <tr key={c.id} className={`cursor-pointer ${selectedId === c.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => !isRO && setSelectedId(c.id)}>
                    <td className="px-3 py-2">
                      <select value={c.tipoCargo} onChange={e => { e.stopPropagation(); update(c.id, 'tipoCargo', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]">
                        <option value="">Seleccione...</option>
                        {opcionesTipo.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        {c.tipoCargo && !opcionesTipo.some(t => t.value === c.tipoCargo) && (
                          <option value={c.tipoCargo}>{c.tipoCargo}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={c.descripcion} onChange={e => { e.stopPropagation(); update(c.id, 'descripcion', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]" placeholder="Descripción..." />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={c.monto} onChange={e => { e.stopPropagation(); update(c.id, 'monto', parseFloat(e.target.value) || 0); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-right focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]" />
                    </td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <DatePicker value={c.fechaCargo} onChange={v => update(c.id, 'fechaCargo', v)} disabled={isRO} placeholder="dd/mm/aaaa" className="px-2 py-1.5" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={c.estatus} onChange={e => { e.stopPropagation(); update(c.id, 'estatus', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]">
                        {CAT_ESTATUS_CARGO.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={c.notas} onChange={e => { e.stopPropagation(); update(c.id, 'notas', e.target.value); }} disabled={isRO} onClick={e => e.stopPropagation()} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]" placeholder="Notas..." />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 flex justify-between items-center">
            <span className="text-[10px] text-gray-400">{itemsManuales.length} cargo{itemsManuales.length !== 1 ? 's' : ''} registrado{itemsManuales.length !== 1 ? 's' : ''}</span>
            <span className="text-xs font-semibold text-gray-700">Total: {formatCurrency(totalMonto)}</span>
          </div>
        </div>
      )}
    </div>
  );
}