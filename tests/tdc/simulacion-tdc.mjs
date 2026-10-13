// Pruebas del simulador de pagos TDC (Solicitudes → Simulación).
import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const dir = mkdtempSync(join(tmpdir(), 'simtdc-'));
await build({
  entryPoints: ['src/app/lib/simuladorTDC.ts'],
  outfile: join(dir, 'm.mjs'),
  format: 'esm',
  bundle: true,
  logLevel: 'error',
});
const M = await import(pathToFileURL(join(dir, 'm.mjs')).href);

let pass = 0, fail = 0;
const eq = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`  FALLA ${n}\n    esperado: ${JSON.stringify(want)}\n    obtenido: ${JSON.stringify(got)}`); }
};
const ok_ = (n, got) => { if (got) pass++; else { fail++; console.log(`  FALLA ${n}`); } };

const config = {
  pagoMinimoMetodo: '% + mínimo fijo', pagoMinimoPorcentaje: 10, pagoMinimoMonto: 500,
  pagoMinimoAgregarSaldoVencido: true,
  pagoMinimoConceptos: ['Capital', 'Interés ordinario', 'Interés moratorio', 'Comisiones', 'IVA'],
};
const base = {
  montoDisposicion: 10000, tasaOrdinariaAnual: 48, tasaMoratoriaAnual: 72,
  ivaPct: 16, configPagoMinimo: config, fechaInicio: '2026-10-05', diaCorte: 20, diasParaPago: 20,
};

// Pago mínimo inicial: 10% de 10,000 = 1,000 (> 500)
eq('mínimo inicial', M.pagoMinimoInicialTDC(10000, config), 1000);

// ── Escenario 1 ──
const e1 = M.simularTDC({ ...base, pagoPeriodo: 10000 });
eq('E1 escenario', e1.escenario, 1);
eq('E1 un periodo', e1.renglones.length, 1);
eq('E1 sin intereses', e1.totales.interesOrdinario + e1.totales.interesMoratorio + e1.totales.iva, 0);
eq('E1 PNGI = disposición', e1.pagoNoGenerarIntereses, 10000);
ok_('E1 liquida', e1.liquida);
eq('E1 primer corte', e1.renglones[0].fechaCorte, '2026-10-20');
eq('E1 fecha límite', e1.renglones[0].fechaLimitePago, '2026-11-09');

// ── Escenario 2 ──
const e2 = M.simularTDC({ ...base, pagoPeriodo: 2000 });
eq('E2 escenario', e2.escenario, 2);
ok_('E2 liquida', e2.liquida);
ok_('E2 varios periodos', e2.renglones.length > 1);
ok_('E2 genera ordinario', e2.totales.interesOrdinario > 0);
eq('E2 sin moratorio', e2.totales.interesMoratorio, 0);
eq('E2 capital pagado = disposición', e2.totales.capital, 10000);
// Periodo 2: capital 8,000 × 4% = 320 ordinario, IVA 51.20
eq('E2 p2 ordinario', e2.renglones[1].interesOrdinario, 320);
eq('E2 p2 iva', e2.renglones[1].iva, 51.2);
eq('E2 saldo final 0', e2.renglones.at(-1).saldoFinal, 0);
const cuadra2 = Math.abs(e2.totales.pagado - (e2.totales.capital + e2.totales.interesOrdinario + e2.totales.iva)) < 0.02;
ok_('E2 pagado = capital + intereses + IVA', cuadra2);

// ── Escenario 3 ──
const e3 = M.simularTDC({ ...base, pagoPeriodo: 800 });
eq('E3 escenario', e3.escenario, 3);
ok_('E3 genera moratorio', e3.totales.interesMoratorio > 0 && e3.generoMoratorio);
eq('E3 vencido p1 = 200', e3.renglones[0].saldoVencido, 200);
// Periodo 2: moratorio 200 × 6% = 12
eq('E3 p2 moratorio', e3.renglones[1].interesMoratorio, 12);
ok_('E3 liquida', e3.liquida);
eq('E3 saldo final 0', e3.renglones.at(-1).saldoFinal, 0);
const t3 = e3.totales;
ok_('E3 pagado cuadra', Math.abs(t3.pagado - (t3.capital + t3.interesOrdinario + t3.interesMoratorio + t3.iva)) < 0.02);

// ── Pago que no amortiza ──
const nx = M.simularTDC({ ...base, pagoPeriodo: 100 });
ok_('No amortiza: no liquida', !nx.liquida);
eq('No amortiza: muestra 12 periodos', nx.renglones.length, 12);
const pml = nx.pagoMinimoParaLiquidar;
ok_('No amortiza: calcula pago para liquidar', pml > 100 && pml <= 10000);
const conPml = M.simularTDC({ ...base, pagoPeriodo: pml });
ok_('Con ese pago sí liquida', conPml.liquida && conPml.renglones.length === nx.periodosParaLiquidar);
ok_('Un centavo menos ya no liquida', !M.simularTDC({ ...base, pagoPeriodo: pml - 0.01 }).liquida);

// Caso reportado: moratoria 2,800% (factor 70 × 40%), pago 5,000
const rep = M.simularTDC({ ...base, montoDisposicion: 100000, tasaOrdinariaAnual: 40, tasaMoratoriaAnual: 2800,
  pagoPeriodo: 5000, fechaInicio: '2026-10-12', diaCorte: 15 });
ok_('Reportado: nunca se paga', !rep.liquida);
eq('Reportado: 12 periodos', rep.renglones.length, 12);
console.log(`  [caso reportado] pago para liquidar ${rep.pagoMinimoParaLiquidar} en ${rep.periodosParaLiquidar} periodos`);

// Validaciones
ok_('Disposición 0 → error', !M.simularTDC({ ...base, montoDisposicion: 0, pagoPeriodo: 100 }).ok);

console.log(`${pass} aserciones OK, ${fail} fallas`);
process.exit(fail ? 1 : 0);
