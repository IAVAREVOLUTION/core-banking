/**
 * EnvioPrelacionTab.tsx — REQ-18 HU-18.3 (CA-17…CA-24).
 *
 * Genera la cascada de pagos de la línea a partir de la configuración del
 * producto (subtab "Prelación 2º Piso", REQ-8) según el Sub-Status de la línea:
 *
 *   Operación Normal → escenario OPERACION_NORMAL, y el renglón de comisión
 *                      toma la suma de los Avisos de Vencimiento `Pendiente`.
 *   Botón de Pánico  → escenario BOTON_PANICO. BLOQUEADO en esta entrega: el
 *                      importe sale del Saldo de los Créditos Simples de la
 *                      subpestaña Disposiciones, que todavía no tiene modelo de
 *                      datos (ver §Bloqueo de la HU y el propio requerimiento,
 *                      "este punto queda pendiente").
 *
 * §Decisión 4: regenerar NO reemplaza — cada emisión se agrega al histórico,
 * porque el monto cambia conforme se pagan avisos y hay que poder auditar con
 * qué cifra se instruyó cada vez.
 */
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
import { currentUser } from '../../data/mockData';
import {
  fmtMoneyExacto, guardarBanca2oPiso, sumarAvisosPendientes, sumarDisposicionesActivas, sumarAvisosDisposiciones, norm,
  type LineaCreditoRow, type PrelacionGenerada, type RenglonPrelacionGenerada,
} from './banca2oPisoStore';

/**
 * CA-19 — cómo se reconoce el renglón cuyo importe se calcula en vez de
 * heredarse del producto. Se compara normalizado y por palabras clave para no
 * depender de que el texto capturado coincida carácter por carácter.
 */
function esRenglonComisionGarantia(concepto: string): boolean {
  const c = norm(concepto);
  return c.includes('comision') && c.includes('garantia');
}

/** CA-24 — el renglón del escenario de pánico (queda documentado, no operativo). */
function esRenglonCreditoRecuperacion(concepto: string): boolean {
  const c = norm(concepto);
  return c.includes('credito') && c.includes('recuperacion');
}

export function EnvioPrelacionTab({
  row,
  onCambio,
}: {
  row: LineaCreditoRow;
  onCambio?: () => void;
}) {
  const {
    productos,
    loading: cargandoProductos,
    error: errorProductos,
  } = useProductosLineaCreditoDB(true);
  const [historico, setHistorico] = useState<PrelacionGenerada[]>(row.banca2oPiso.prelacionGenerada || []);
  const [generando, setGenerando] = useState(false);

  const subEstatus = row.banca2oPiso.subEstatus || 'Operación Normal';
  const esPanico = subEstatus === 'Botón de Pánico';

  // Se compara contra `dbUuid` y también contra `id`, porque el hook mapea `id`
  // desde `data.localId` cuando existe (mismo criterio que DisposicionesTab).
  const producto = useMemo(() => {
    const buscado = String(row.productoId || '').trim();
    if (!buscado) return undefined;
    return productos.find(p =>
      String(p.dbUuid || '') === buscado || String(p.id ?? '') === buscado,
    );
  }, [productos, row.productoId]);

  /**
   * Por qué NO se puede generar todavía, o `null` si sí se puede.
   *
   * Sin esto, "cargando", "falló la carga", "no se encontró el producto" y "el
   * producto no tiene la cascada capturada" producían **el mismo** mensaje, que
   * mandaba al usuario a capturar una prelación que ya estaba capturada. El
   * catálogo de productos se carga al montar la pestaña, así que basta con
   * abrirla y pulsar Generar de inmediato para leer un diagnóstico falso.
   */
  const impedimento: { titulo: string; detalle: string } | null =
    cargandoProductos
      ? { titulo: 'Cargando la configuración del producto…', detalle: 'Intente de nuevo en un momento.' }
      : errorProductos
        ? { titulo: 'No se pudo cargar el producto de la línea', detalle: String(errorProductos) }
        : !row.productoId
          ? { titulo: 'La línea no tiene producto asociado', detalle: 'Sin producto no hay cascada que leer.' }
          : !producto
            ? {
                titulo: 'No se encontró el producto de la línea',
                detalle: `producto_id ${row.productoId} no aparece entre los productos de Línea de Crédito.`,
              }
            : renglonesProductoVacio()
              ? {
                  titulo: `El producto no tiene Prelación 2º Piso configurada para ${esPanico ? 'Botón de Pánico' : 'Operación Normal'}`,
                  detalle: 'Captúrela en Productos → Línea de Crédito → subpestaña Prelación 2º Piso.',
                }
              : null;

  function renglonesProductoVacio() {
    const todos = Array.isArray(producto?.prelacion2oPiso) ? producto!.prelacion2oPiso! : [];
    return todos.filter(r => r.escenario === (esPanico ? 'BOTON_PANICO' : 'OPERACION_NORMAL')).length === 0;
  }

  /** Renglones configurados en el producto para el escenario vigente (CA-18). */
  const renglonesProducto = useMemo(() => {
    const todos = Array.isArray(producto?.prelacion2oPiso) ? producto!.prelacion2oPiso! : [];
    const escenario = esPanico ? 'BOTON_PANICO' : 'OPERACION_NORMAL';
    return todos
      .filter(r => r.escenario === escenario)
      .sort((a, b) => Number(a.seq) - Number(b.seq)); // RN-04
  }, [producto, esPanico]);

  const handleGenerar = async () => {
    // CA-22 — sin configuración no se inventa nada. El mensaje distingue el
    // motivo real en vez de culpar siempre a la captura del producto.
    if (impedimento) {
      toast.error(impedimento.titulo, { description: impedimento.detalle, duration: 9000 });
      return;
    }

    // REQ-18 CA-24, desbloqueado por REQ-24 §Decisión 3(a): las disposiciones ya
    // tienen modelo de datos, así que el escenario de pánico ya puede calcularse
    // en vez de rechazarse. El importe sale de los Créditos Simples aplicados a
    // esta línea (ver la nota de `sumarDisposicionesActivas` sobre por qué hoy
    // el saldo de una disposición es su monto dispuesto).
    if (esPanico && sumarDisposicionesActivas(row.banca2oPiso).cuantas === 0) {
      toast.error('La línea está en Botón de Pánico pero no tiene disposiciones aplicadas', {
        description: 'El renglón del Crédito de Recuperación quedaría en $0.00. Verifique las Disposiciones antes de instruir.',
        duration: 10000,
      });
      return;
    }

    setGenerando(true);
    const avisos = await sumarAvisosPendientes(row.id);
    if (!avisos.ok) {
      setGenerando(false);
      toast.error('No se pudieron leer los Avisos de Vencimiento', { description: avisos.error, duration: 8000 });
      return;
    }

    // CA-23 — si no hay avisos pendientes se genera en 0.00, pero avisando.
    if (avisos.cuantos === 0) {
      toast.warning('No hay Avisos de Vencimiento pendientes', {
        description: 'El renglón de comisión se generará en $0.00.',
        duration: 7000,
      });
    }

    // CA-24 — el Credito de Recuperacion cubre lo que EXIGEN los avisos de
    // vencimiento de los creditos simples (capital + intereses), no el monto
    // dispuesto original.
    const avisosDisp = await sumarAvisosDisposiciones(row.banca2oPiso);
    if (esPanico && !avisosDisp.ok) {
      setGenerando(false);
      toast.error('No se pudieron leer los Avisos de las disposiciones', {
        description: avisosDisp.error, duration: 9000,
      });
      return;
    }
    if (esPanico && avisosDisp.cuantos === 0) {
      setGenerando(false);
      toast.error('Las disposiciones no tienen Avisos de Vencimiento pendientes', {
        description: 'Genere el aviso del crédito simple antes de instruir la prelación: el renglón saldría en $0.00.',
        duration: 11000,
      });
      return;
    }

    const renglones: RenglonPrelacionGenerada[] = renglonesProducto.map(r => {
      if (esRenglonComisionGarantia(r.concepto)) {
        // CA-19 — este importe se calcula, no se hereda del producto.
        return { seq: r.seq, concepto: r.concepto, valor: fmtMoneyExacto(avisos.monto), calculado: true };
      }
      // CA-24 — en el escenario de pánico, el Crédito de Recuperación toma la
      // suma de los Créditos Simples dispuestos sobre la línea.
      if (esPanico && esRenglonCreditoRecuperacion(r.concepto)) {
        return { seq: r.seq, concepto: r.concepto, valor: fmtMoneyExacto(avisosDisp.monto), calculado: true };
      }
      // CA-20 — el resto conserva lo configurado.
      return { seq: r.seq, concepto: r.concepto, valor: r.valor };
    });

    const emision: PrelacionGenerada = {
      id: `PRE-${Date.now().toString(36).toUpperCase()}`,
      fecha: new Date().toISOString(),
      usuario: currentUser.name,
      escenario: subEstatus,
      // El monto base del escenario es el que alimentó su renglón calculado.
      montoBase: esPanico ? avisosDisp.monto : avisos.monto,
      renglones,
    };

    // §Decisión 4 — histórico acumulativo, la más reciente primero al mostrar.
    const nuevoHistorico = [...historico, emision];
    const guardado = await guardarBanca2oPiso(row.id, { prelacionGenerada: nuevoHistorico });
    setGenerando(false);

    if (!guardado.ok) {
      toast.error('No se pudo guardar la prelación', { description: guardado.error, duration: 8000 });
      return;
    }
    setHistorico(nuevoHistorico);
    onCambio?.();
    toast.success('Prelación generada', {
      description: `${renglones.length} renglón(es) · Comisión ${fmtMoneyExacto(avisos.monto)} de ${avisos.cuantos} aviso(s)`,
      duration: 5000,
    });
  };

  const ultima = historico.length > 0 ? historico[historico.length - 1] : null;

  /**
   * Exporta la cascada a CSV, con el mismo formato que el resto del sistema
   * (BOM UTF-8 + CRLF, para que Excel en español no rompa acentos ni columnas).
   *
   * Exporta la **última prelación generada** cuando existe, porque es el
   * documento de instrucción con los importes reales; si todavía no se ha
   * generado ninguna, exporta la cascada configurada en el producto. El archivo
   * dice cuál de las dos es, para que no se confunda una propuesta con una
   * instrucción emitida.
   */
  const exportarCSV = () => {
    const esGenerada = Boolean(ultima);
    const renglones = esGenerada
      ? ultima!.renglones.map(r => ({ seq: r.seq, concepto: r.concepto, valor: r.valor, calculado: r.calculado }))
      : renglonesProducto.map(r => ({ seq: r.seq, concepto: r.concepto, valor: r.valor, calculado: false }));

    if (renglones.length === 0) {
      toast.error('No hay nada que exportar', {
        description: 'El producto no tiene cascada configurada y no se ha generado ninguna prelación.',
      });
      return;
    }

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    // Encabezado de contexto: un CSV de prelación sin línea, folio ni escenario
    // no es auditable, y este archivo se manda fuera del sistema.
    const meta: string[][] = [
      ['Línea', row.noCuenta || row.noSol || String(row.id)],
      ['Cliente', row.cliente],
      ['Producto', producto?.nombre || ''],
      ['Escenario', esGenerada ? ultima!.escenario : subEstatus],
      ['Origen', esGenerada ? 'Prelación generada' : 'Cascada configurada en el producto (sin generar)'],
      ...(esGenerada
        ? [
            ['Folio', ultima!.id],
            ['Fecha', new Date(ultima!.fecha).toLocaleString('es-MX')],
            ['Usuario', ultima!.usuario],
            ['Monto base (avisos pendientes)', fmtMoneyExacto(ultima!.montoBase)],
          ]
        : []),
    ];

    const filas = [
      ...meta.map(([k, v]) => [esc(k), esc(v)].join(',')),
      '',
      ['Sec.', 'Concepto', 'Valor', 'Origen del importe'].map(esc).join(','),
      ...renglones.map(r => [
        esc(r.seq),
        esc(r.concepto),
        esc(r.valor || ''),
        esc(r.calculado ? 'Calculado (suma de Avisos pendientes)' : 'Configurado en el producto'),
      ].join(',')),
    ];

    const csv = '﻿' + filas.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prelacion_${esGenerada ? ultima!.id : 'configurada'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('CSV generado', {
      description: esGenerada
        ? `${ultima!.id} · ${renglones.length} renglón(es)`
        : `Cascada configurada · ${renglones.length} renglón(es) — todavía sin generar`,
      duration: 5000,
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h4 className="text-sm font-medium text-gray-800">Envío Prelación</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Sub-Status de la línea: <strong className={esPanico ? 'text-red-700' : 'text-green-700'}>{subEstatus}</strong>
            {' '}· Se cambia en la pestaña <strong>Default</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportarCSV}
            title={ultima
              ? `Exportar a CSV la prelación ${ultima.id}`
              : 'Exportar a CSV la cascada configurada en el producto'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280" />
              <text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text>
            </svg>
            Generar CSV
          </button>
          <button
            onClick={handleGenerar}
            disabled={generando || cargandoProductos}
            title={impedimento ? `${impedimento.titulo} — ${impedimento.detalle}` : 'Generar la cascada de pagos de la línea'}
            className={`px-4 py-1.5 rounded text-xs ${generando ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'btn-secondary-theme'}`}
          >
            {generando ? 'Generando…' : cargandoProductos ? 'Cargando…' : 'Generar Prelación'}
          </button>
        </div>
      </div>

      {/* CA-24 — bloqueo explícito y honesto */}
      {esPanico && (
        <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded text-[11px] text-red-800">
          <strong>Botón de Pánico — pendiente.</strong> La cascada de este escenario necesita el
          Saldo de los Créditos Simples activos de la subpestaña <strong>Disposiciones</strong>, que
          todavía no tiene modelo de datos en el sistema. Se dejó preparado el escenario en el
          producto y el selector aquí, pero no se genera para no producir importes falsos.
        </div>
      )}

      {/* Configuración vigente del producto */}
      <div className="border border-gray-300 mb-4">
        <div className="bg-gray-100 border-b border-gray-300 px-3 py-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-gray-700 uppercase">
            Cascada configurada en el producto — {esPanico ? 'Botón de Pánico' : 'Operación Normal'}
          </span>
          <span className="text-[10px] text-gray-500">{producto?.nombre || (cargandoProductos ? 'Cargando producto…' : 'Producto no encontrado')}</span>
        </div>
        {renglonesProducto.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-gray-500">
            El producto no tiene renglones configurados para este escenario.
            <br />Captúrelos en <strong>Productos → Línea de Crédito → Prelación 2º Piso</strong>.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-1.5 text-left font-normal text-gray-600 w-16">Sec.</th>
                <th className="px-3 py-1.5 text-left font-normal text-gray-600">Concepto</th>
                <th className="px-3 py-1.5 text-right font-normal text-gray-600 w-52">Valor</th>
              </tr>
            </thead>
            <tbody>
              {renglonesProducto.map((r, i) => {
                const calculado = !esPanico && esRenglonComisionGarantia(r.concepto);
                const panicoCalc = esPanico && esRenglonCreditoRecuperacion(r.concepto);
                return (
                  <tr key={r.id ?? i} className="border-b border-gray-100" style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFF' }}>
                    <td className="px-3 py-1.5 text-gray-700">{r.seq}</td>
                    <td className="px-3 py-1.5 text-gray-700">
                      {r.concepto}
                      {calculado && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">se calcula de Avisos pendientes</span>}
                      {panicoCalc && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">requiere Disposiciones</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-600 font-mono">{r.valor || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Última prelación generada */}
      {ultima && (
        <div className="border border-green-200 mb-4">
          <div className="bg-green-50 border-b border-green-200 px-3 py-2">
            <span className="text-[11px] font-medium text-green-800 uppercase">
              Última prelación generada — {ultima.id}
            </span>
            <span className="text-[10px] text-green-700 ml-2">
              {new Date(ultima.fecha).toLocaleString('es-MX')} · {ultima.usuario} · {ultima.escenario}
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-1.5 text-left font-normal text-gray-600 w-16">Sec.</th>
                <th className="px-3 py-1.5 text-left font-normal text-gray-600">Concepto</th>
                <th className="px-3 py-1.5 text-right font-normal text-gray-600 w-52">Valor</th>
              </tr>
            </thead>
            <tbody>
              {ultima.renglones.map((r, i) => (
                <tr key={i} className="border-b border-gray-100" style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFF' }}>
                  <td className="px-3 py-1.5 text-gray-700">{r.seq}</td>
                  <td className="px-3 py-1.5 text-gray-700">{r.concepto}</td>
                  <td className={`px-3 py-1.5 text-right font-mono ${r.calculado ? 'font-bold text-[#2E5C91]' : 'text-gray-600'}`}>
                    {r.valor || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Histórico (§Decisión 4) */}
      {historico.length > 1 && (
        <div className="border border-gray-300">
          <div className="bg-gray-100 border-b border-gray-300 px-3 py-2">
            <span className="text-[11px] font-medium text-gray-700 uppercase">Histórico de prelaciones ({historico.length})</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-1.5 text-left font-normal text-gray-600">Folio</th>
                <th className="px-3 py-1.5 text-left font-normal text-gray-600">Fecha</th>
                <th className="px-3 py-1.5 text-left font-normal text-gray-600">Usuario</th>
                <th className="px-3 py-1.5 text-left font-normal text-gray-600">Escenario</th>
                <th className="px-3 py-1.5 text-right font-normal text-gray-600">Monto base</th>
              </tr>
            </thead>
            <tbody>
              {[...historico].reverse().map((h, i) => (
                <tr key={h.id} className="border-b border-gray-100" style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFF' }}>
                  <td className="px-3 py-1.5 text-gray-700 font-mono text-[10px]">{h.id}</td>
                  <td className="px-3 py-1.5 text-gray-700">{new Date(h.fecha).toLocaleString('es-MX')}</td>
                  <td className="px-3 py-1.5 text-gray-700">{h.usuario}</td>
                  <td className="px-3 py-1.5 text-gray-700">{h.escenario}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700 font-mono">{fmtMoneyExacto(h.montoBase)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
