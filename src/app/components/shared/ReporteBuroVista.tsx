/**
 * Vista imprimible del reporte de Buró de Crédito generado por
 * lib/buroSimulado. Se muestra dentro del modal "PDF SIC".
 */
import type { ReporteBuro } from '@/app/lib/buroSimulado';
import { MOP_DESCRIPCION } from '@/app/lib/buroSimulado';

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const fecha = (iso?: string) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : iso;
};

const COLOR_HIST: Record<string, string> = {
  '1': 'bg-green-500', '2': 'bg-yellow-400', '3': 'bg-orange-500', '4': 'bg-red-500',
  '5': 'bg-red-700', '6': 'bg-red-800', '7': 'bg-red-900', '-': 'bg-gray-200',
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">{titulo}</h2>
      {children}
    </div>
  );
}

function Dato({ etiqueta, valor, ancho }: { etiqueta: string; valor?: React.ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? 'col-span-2' : undefined}>
      <p className="text-gray-600">{etiqueta}</p>
      <p className="font-semibold">{valor || '—'}</p>
    </div>
  );
}

export function ReporteBuroVista({ reporte: r, usuario }: { reporte: ReporteBuro; usuario?: string }) {
  const pm = r.tipoPersona === 'PM';
  const [min, max] = r.score.rango;
  const pct = r.score.valor === null ? 0 : Math.round(((r.score.valor - min) / (max - min)) * 100);
  const colorScore = r.score.nivel === 'Excelente' ? 'text-green-600' : r.score.nivel === 'Bueno' ? 'text-green-500'
    : r.score.nivel === 'Regular' ? 'text-amber-500' : r.score.nivel === 'Bajo' ? 'text-red-600' : 'text-gray-500';
  const barra = r.score.nivel === 'Excelente' || r.score.nivel === 'Bueno' ? 'bg-green-500' : r.score.nivel === 'Regular' ? 'bg-amber-400' : 'bg-red-500';
  const negativo = r.resultado === 'NEGATIVO';
  const fechaConsulta = new Date(r.fechaConsulta).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });

  return (
    <div className="relative">

      {/* Encabezado */}
      <div className="border-b-2 border-gray-800 pb-4 mb-6 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">BURÓ DE CRÉDITO</h1>
          <p className="text-sm text-gray-700 mt-1">{r.producto}</p>
          <p className="text-xs text-gray-600 mt-1">{pm ? 'Persona Moral' : 'Persona Física'}</p>
        </div>
        <div className="text-right text-xs text-gray-600 space-y-0.5">
          <p>Folio de consulta: <span className="font-semibold font-mono">{r.folio}</span></p>
          <p>Fecha: {fechaConsulta}</p>
          {usuario && <p>Usuario: {usuario}</p>}
          <p>Autorización: {r.autorizacion.medio} · {fecha(r.autorizacion.fecha)}</p>
        </div>
      </div>

      {/* Resultado */}
      <div className={`mb-6 px-4 py-3 border-l-4 text-sm ${negativo ? 'border-green-600 bg-green-50 text-green-900' : 'border-red-600 bg-red-50 text-red-900'}`}>
        <p className="font-bold">Resultado: {r.resultado} {negativo ? '(sin registros negativos)' : '(con registros negativos)'}</p>
        <p className="text-xs mt-0.5">{r.motivoResultado}</p>
      </div>

      <Seccion titulo="DATOS DEL CONSULTADO">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <Dato etiqueta={pm ? 'Razón social:' : 'Nombre:'} valor={r.consultado.nombre} />
          <Dato etiqueta="RFC:" valor={r.consultado.rfc} />
          {!pm && <Dato etiqueta="CURP:" valor={r.consultado.curp} />}
          {!pm && <Dato etiqueta="Fecha de nacimiento:" valor={r.consultado.fechaNacimiento} />}
          <Dato etiqueta="Domicilio:" valor={r.consultado.direccion} ancho />
        </div>
      </Seccion>

      <Seccion titulo={r.score.nombre.toUpperCase()}>
        <div className="flex items-center gap-8">
          <div className="text-center w-28">
            <div className={`text-4xl font-bold ${colorScore}`}>{r.score.valor ?? 'N/D'}</div>
            <p className="text-xs text-gray-600 mt-1">{r.score.nivel}</p>
          </div>
          <div className="flex-1">
            <div className="bg-gray-200 h-4 rounded-full overflow-hidden">
              <div className={`${barra} h-full`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>{min}</span><span>{max}</span>
            </div>
            <ul className="mt-2 text-xs text-gray-700 list-disc pl-4 space-y-0.5">
              {r.score.razones.map(x => <li key={x}>{x}</li>)}
            </ul>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="RESUMEN">
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            ['Cuentas abiertas', String(r.resumen.cuentasAbiertas), 'text-blue-600'],
            ['Cuentas cerradas', String(r.resumen.cuentasCerradas), 'text-gray-600'],
            ['Límite total', dinero(r.resumen.limiteTotal), 'text-gray-800'],
            ['Saldo actual', dinero(r.resumen.saldoActual), 'text-orange-600'],
            ['Saldo vencido', dinero(r.resumen.saldoVencido), r.resumen.saldoVencido > 0 ? 'text-red-600' : 'text-green-600'],
            ['Peor MOP', r.resumen.peorMop, Number(r.resumen.peorMop) >= 3 ? 'text-red-600' : 'text-green-600'],
          ].map(([t, v, c]) => (
            <div key={t} className="border border-gray-300 p-3 text-center">
              <p className="text-gray-600 mb-1">{t}</p>
              <p className={`text-lg font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo={`DETALLE DE CUENTAS (${r.cuentas.length})`}>
        {r.cuentas.length === 0 ? (
          <p className="text-xs text-gray-500 px-1">El consultado no tiene cuentas reportadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-2 py-1 text-left">Otorgante</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Tipo de crédito</th>
                  <th className="border border-gray-300 px-2 py-1 text-center">Apertura</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Límite</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Saldo</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Vencido</th>
                  <th className="border border-gray-300 px-2 py-1 text-center">MOP</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Histórico 24 meses</th>
                </tr>
              </thead>
              <tbody>
                {r.cuentas.map((c, i) => (
                  <tr key={i} className={c.fechaCierre ? 'text-gray-500' : undefined}>
                    <td className="border border-gray-300 px-2 py-1">
                      {c.otorgante}
                      {c.fechaCierre && <span className="block text-[10px]">Cerrada {fecha(c.fechaCierre)}</span>}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">{c.tipoCredito}<span className="block text-[10px] text-gray-500">{c.tipoCuenta}</span></td>
                    <td className="border border-gray-300 px-2 py-1 text-center whitespace-nowrap">{fecha(c.fechaApertura)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right whitespace-nowrap">{c.limite ? dinero(c.limite) : '—'}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right whitespace-nowrap">{dinero(c.saldoActual)}</td>
                    <td className={`border border-gray-300 px-2 py-1 text-right whitespace-nowrap ${c.saldoVencido > 0 ? 'text-red-600 font-semibold' : ''}`}>{dinero(c.saldoVencido)}</td>
                    <td className={`border border-gray-300 px-2 py-1 text-center font-semibold ${Number(c.mop) >= 3 ? 'text-red-600' : Number(c.mop) === 2 ? 'text-amber-600' : 'text-green-700'}`} title={MOP_DESCRIPCION[c.mop]}>{c.mop}</td>
                    <td className="border border-gray-300 px-2 py-1">
                      <div className="flex gap-px" title="Más reciente a la izquierda">
                        {c.historico.split('').map((h, k) => (
                          <span key={k} className={`w-1.5 h-3 ${COLOR_HIST[h] || 'bg-gray-200'}`} title={h === '-' ? 'Sin información' : MOP_DESCRIPCION['0' + h]} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-gray-500 mt-2">
          <strong>MOP</strong> (manera de pago): 01 al corriente · 02 atraso de 1 a 29 días · 03 de 30 a 59 · 04 de 60 a 89 · 05 de 90 a 119 · 06 de 120 a 149 · 07 de 150 o más · 97 quebranto.
        </p>
      </Seccion>

      <Seccion titulo={`CONSULTAS DE OTROS OTORGANTES — ÚLTIMOS 24 MESES (${r.consultas.length})`}>
        {r.consultas.length === 0 ? (
          <p className="text-xs text-gray-500 px-1">Sin consultas registradas.</p>
        ) : (
          <table className="w-full text-xs border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-2 py-1 text-left">Fecha</th>
                <th className="border border-gray-300 px-2 py-1 text-left">Otorgante</th>
                <th className="border border-gray-300 px-2 py-1 text-left">Tipo de crédito</th>
                <th className="border border-gray-300 px-2 py-1 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {r.consultas.map((c, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 px-2 py-1">{fecha(c.fecha)}</td>
                  <td className="border border-gray-300 px-2 py-1">{c.otorgante}</td>
                  <td className="border border-gray-300 px-2 py-1">{c.tipoCredito}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{c.importe ? dinero(c.importe) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Seccion>

      {r.alertas.length > 0 && (
        <Seccion titulo="ALERTAS DE PREVENCIÓN">
          <ul className="text-xs text-red-700 list-disc pl-5 space-y-0.5">
            {r.alertas.map(a => <li key={a}>{a}</li>)}
          </ul>
        </Seccion>
      )}

      <div className="border-t-2 border-gray-800 pt-4 mt-8">
        <p className="text-xs text-gray-500 text-center">
          Reporte confidencial generado exclusivamente para {r.consultado.nombre}.<br />
          Consulta realizada con autorización expresa del consultado ({r.autorizacion.medio}).
        </p>
      </div>
    </div>
  );
}
