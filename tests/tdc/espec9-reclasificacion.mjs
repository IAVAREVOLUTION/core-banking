// Pruebas de la ESPECIFICACIÓN 9 — Reclasificación al cerrar el Estado de Cuenta.
// Cubre §1 (Saldo Anterior), §1.1 (condición saldo > 0), §1.1.1 (Interés
// Ordinario por interés simple e IVA del interés) y la resolución de la tasa
// de IVA contra la configuración del producto.
import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const dir = mkdtempSync(join(tmpdir(), 'e9-'));
await build({
  entryPoints: ['src/app/lib/motorReclasificacionTDC.ts'],
  outfile: join(dir, 'm.mjs'), format: 'esm', bundle: true, logLevel: 'error',
});
const M = await import(pathToFileURL(join(dir, 'm.mjs')).href);

let pass = 0, fail = 0;
const eq = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`  FALLA ${n}\n    esperado: ${JSON.stringify(want)}\n    obtenido: ${JSON.stringify(got)}`); }
};
const ok_ = (n, g) => { if (g) pass++; else { fail++; console.log(`  FALLA ${n}`); } };

const plan = (extra = {}) => M.planReclasificacion({
  saldoAlCorte: 10000,
  fechaMovimiento: '2026-10-06',
  fechaInicioPeriodo: '2026-08-16',
  fechaLimitePago: '2026-10-05',
  tasaAnual: 40,
  tasaIva: 16,
  ...extra,
});

console.log('');
console.log('-- Dias entre fechas --');
eq('16/08 a 05/10 son 50 dias', M.diasEntre('2026-08-16', '2026-10-05'), 50);
eq('mismo dia son 0', M.diasEntre('2026-09-15', '2026-09-15'), 0);
eq('orden invertido no da negativo', M.diasEntre('2026-10-05', '2026-08-16'), 0);
eq('cruza anio', M.diasEntre('2026-12-16', '2027-01-15'), 30);
eq('fecha vacia da 0', M.diasEntre('', '2026-10-05'), 0);
eq('acepta dd/mm/aaaa', M.diasEntre('16/08/2026', '05/10/2026'), 50);

console.log('');
console.log('-- Interes simple: Capital x Tasa/100 x Dias/Base --');
// 10,000 x 40% x 50/360 = 555.5555... -> 555.56
eq('caso base 360', M.calcularInteresSimple({ capital: 10000, tasaAnual: 40, dias: 50, baseCalculo: 360 }), 555.56);
// 10,000 x 40% x 50/365 = 547.945... -> 547.95
eq('base 365', M.calcularInteresSimple({ capital: 10000, tasaAnual: 40, dias: 50, baseCalculo: 365 }), 547.95);
eq('sin base usa 360', M.calcularInteresSimple({ capital: 10000, tasaAnual: 40, dias: 50 }), 555.56);
eq('un anio completo da la tasa', M.calcularInteresSimple({ capital: 1000, tasaAnual: 10, dias: 360, baseCalculo: 360 }), 100);
eq('capital cero', M.calcularInteresSimple({ capital: 0, tasaAnual: 40, dias: 50 }), 0);
eq('tasa cero', M.calcularInteresSimple({ capital: 10000, tasaAnual: 0, dias: 50 }), 0);
eq('dias cero', M.calcularInteresSimple({ capital: 10000, tasaAnual: 40, dias: 0 }), 0);
eq('capital negativo', M.calcularInteresSimple({ capital: -500, tasaAnual: 40, dias: 50 }), 0);

console.log('');
console.log('-- 1 y 1.1.1 El plan completo --');
const p = plan();
ok_('procede', p.ok);
eq('tres movimientos', p.movimientos.length, 3);
eq('claves 023 / 012 / 03', p.movimientos.map(m => m.clave), ['023', '012', '03']);
eq('el primero es el saldo al corte', p.movimientos[0].monto, 10000);
eq('interes = 555.56', p.interesOrdinario, 555.56);
eq('iva = 555.56 x 16%', p.ivaInteres, 88.89);
eq('el iva va en el tercer movimiento', p.movimientos[2].monto, 88.89);
eq('todos con la fecha del dia', [...new Set(p.movimientos.map(m => m.fecha))], ['2026-10-06']);
eq('sin advertencias', p.advertencias, []);

console.log('');
console.log('-- 1.1 Con saldo al corte <= 0 no se reclasifica nada --');
for (const saldo of [0, -500]) {
  const r = plan({ saldoAlCorte: saldo });
  eq(`saldo ${saldo}: no procede`, r.ok, false);
  eq(`saldo ${saldo}: sin movimientos`, r.movimientos.length, 0);
  ok_(`saldo ${saldo}: lo explica`, /no es mayor a cero/.test(r.motivo || ''));
}

console.log('');
console.log('-- Sin tasa: se registra el Saldo Anterior y se avisa --');
const sinTasa = plan({ tasaAnual: 0 });
ok_('procede igual', sinTasa.ok);
eq('solo el saldo anterior', sinTasa.movimientos.map(m => m.clave), ['023']);
eq('interes cero', sinTasa.interesOrdinario, 0);
ok_('advierte de la tasa', sinTasa.advertencias.some(a => /Tasa \(%\)/.test(a)));

console.log('');
console.log('-- Sin IVA: hay interes pero no su IVA, y se avisa --');
const sinIva = plan({ tasaIva: 0 });
eq('dos movimientos', sinIva.movimientos.map(m => m.clave), ['023', '012']);
eq('iva cero', sinIva.ivaInteres, 0);
ok_('advierte del IVA en cero', sinIva.advertencias.some(a => /IVA/.test(a)));

console.log('');
console.log('-- Fechas que no delimitan dias --');
const sinDias = plan({ fechaInicioPeriodo: '2026-10-05', fechaLimitePago: '2026-08-16' });
eq('no hay interes', sinDias.interesOrdinario, 0);
eq('solo el saldo anterior', sinDias.movimientos.map(m => m.clave), ['023']);
ok_('lo advierte', sinDias.advertencias.some(a => /no delimitan dias|no delimitan días/.test(a)));

console.log('');
console.log('-- Las claves son parametrizables --');
const otras = plan({ claves: { saldoAnterior: 'SA', interesOrdinario: 'INT', ivaInteres: 'IVA' } });
eq('usa las claves dadas', otras.movimientos.map(m => m.clave), ['SA', 'INT', 'IVA']);

console.log('');
console.log('-- Resolucion de la tasa de IVA del interes --');
eq('1o: Prom Comis e Impue del concepto de interes',
   M.resolverTasaIvaInteres({
     promComisImpuestos: [{ clave: '012', porcentajeIvaInteres: '16' }],
     comisionesIva: [{ clave: '03', porcentajeIva: '8' }],
     ivaPorcentaje: [{ porcentaje: '11' }],
   }), 16);

eq('2o: Comisiones e IVA cuando no hay promocion',
   M.resolverTasaIvaInteres({
     comisionesIva: [{ clave: '03', porcentajeIva: '8' }],
     ivaPorcentaje: [{ porcentaje: '11' }],
   }), 8);

eq('3o: IVA del producto, no fronterizo',
   M.resolverTasaIvaInteres({
     ivaPorcentaje: [{ zonaFronteriza: true, porcentaje: '8' }, { zonaFronteriza: false, porcentaje: '16' }],
   }), 16);

eq('sin nada configurado cae al 16 por omision', M.resolverTasaIvaInteres({}), 16);
eq('tolera porcentajes con simbolo', M.resolverTasaIvaInteres({ ivaPorcentaje: [{ porcentaje: '16 %' }] }), 16);

console.log('');
console.log('-- Centavos --');
const cent = plan({ saldoAlCorte: 0.03, tasaAnual: 40, tasaIva: 16 });
ok_('el saldo anterior conserva los centavos', cent.movimientos[0].monto === 0.03);
ok_('nunca produce montos negativos', cent.movimientos.every(m => m.monto > 0));


console.log('');
console.log('-- IVA por omision: 16% cuando el producto no lo configura --');
eq('la constante es 16', M.IVA_POR_OMISION, 16);
eq('producto vacio cae al 16', M.resolverTasaIvaInteres({}), 16);
eq('arreglos vacios caen al 16',
   M.resolverTasaIvaInteres({ promComisImpuestos: [], comisionesIva: [], ivaPorcentaje: [] }), 16);
eq('porcentaje en cero cae al 16',
   M.resolverTasaIvaInteres({ ivaPorcentaje: [{ porcentaje: '0' }] }), 16);

console.log('');
console.log('-- Lo configurado SIEMPRE gana sobre el 16 --');
eq('promocion del concepto manda',
   M.resolverTasaIvaInteres({ promComisImpuestos: [{ clave: '012', porcentajeIvaInteres: '8' }] }), 8);
eq('comisiones e iva manda',
   M.resolverTasaIvaInteres({ comisionesIva: [{ clave: '03', porcentajeIva: '8' }] }), 8);
eq('iva del producto manda',
   M.resolverTasaIvaInteres({ ivaPorcentaje: [{ zonaFronteriza: false, porcentaje: '8' }] }), 8);

console.log('');
console.log('-- El plan ya genera los tres movimientos sin configurar IVA --');
const conOmision = M.planReclasificacion({
  saldoAlCorte: 10000,
  fechaMovimiento: '2026-10-06',
  fechaInicioPeriodo: '2026-08-16',
  fechaLimitePago: '2026-10-05',
  tasaAnual: 40,
  tasaIva: M.resolverTasaIvaInteres({}),
  baseCalculo: 360,
});
eq('tres movimientos', conOmision.movimientos.map(m => m.clave), ['023', '012', '03']);
eq('iva = 555.56 x 16%', conOmision.ivaInteres, 88.89);
eq('sin advertencias', conOmision.advertencias, []);

console.log('');
console.log('-- Los cargos caen en el periodo SIGUIENTE, no en el que se cerro --');
// Generado el mismo dia del corte: se recorre al dia siguiente.
eq('mismo dia del corte', M.fechaEfectivaCargos('2026-09-23', '2026-09-23'), '2026-09-24');
// Generado despues del corte: manda la fecha del dia.
eq('dias despues del corte', M.fechaEfectivaCargos('2026-10-06', '2026-09-23'), '2026-10-06');
// Generado antes (no deberia pasar, pero no debe caer dentro del periodo).
eq('antes del corte se recorre', M.fechaEfectivaCargos('2026-09-20', '2026-09-23'), '2026-09-24');
eq('sin corte respeta el dia', M.fechaEfectivaCargos('2026-09-23'), '2026-09-23');
eq('fecha invalida da vacio', M.fechaEfectivaCargos('', '2026-09-23'), '');

const conCorte = plan({ fechaMovimiento: '2026-09-23', fechaCorte: '2026-09-23' });
eq('los tres movimientos quedan fuera del periodo cerrado',
   [...new Set(conCorte.movimientos.map(m => m.fecha))], ['2026-09-24']);
console.log(`\n${pass} aserciones OK, ${fail} fallas`);
process.exit(fail > 0 ? 1 : 0);
