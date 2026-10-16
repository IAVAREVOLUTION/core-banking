// Pruebas de la ESPECIFICACIÓN 1/2 refinada — casos del §12.11.
import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const dir = mkdtempSync(join(tmpdir(), 'e1-'));
await build({ entryPoints: ['src/app/lib/motorMovimientosTDC.ts'], outfile: join(dir, 'm.mjs'), format: 'esm', bundle: true, logLevel: 'error' });
const M = await import(pathToFileURL(join(dir, 'm.mjs')).href);

let pass = 0, fail = 0;
const eq = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`  FALLA ${n}\n    esperado: ${JSON.stringify(want)}\n    obtenido: ${JSON.stringify(got)}`); }
};
const ok_ = (n, g) => { if (g) pass++; else { fail++; console.log(`  FALLA ${n}`); } };

const catalogo = [
  { codigo: '001', nombre: 'Compra_Normal' }, { codigo: '002', nombre: 'Disposición Efectivo' },
  { codigo: '021', nombre: 'Comisión' }, { codigo: '022', nombre: 'IVA Comisión' },
  { codigo: '030', nombre: 'Interés' }, { codigo: '031', nombre: 'IVA Interés' },
  { codigo: '100', nombre: 'MSI_6' }, { codigo: '121', nombre: 'Capital MCI' },
  { codigo: '120', nombre: 'MCI_3' }, { codigo: '900', nombre: 'Cash Back' },
];
const vc = (valor, clave = '') => ({ valor: String(valor), clave });

const afect = (clave, concepto, o = {}) => ({
  clave, concepto, naturaleza: o.nat || 'Cargo',
  consumeLineaDisponible: o.consume ?? 'S', bFactura: o.bf ?? 'N', bCargo: o.bc ?? 'S',
});

const producto = {
  claveProducto: '010', nombreProducto: 'Tarjeta de Crédito',
  cargosPermitidos: [{ tipoCargo: 'Disposición Efectivo' }, { tipoCargo: 'MSI_6' }, { tipoCargo: 'MCI_3' }, { tipoCargo: 'Compra_Normal' }],
  promComisImpuestos: [
    { clave: '002', comisionFija: vc('250.00', '021'), porcentajeComision: vc('5', '021'), porcentajeIvaComision: vc('16', '022'), porcentajeCashback: vc('0'), plazo: vc('0'), porcentajeInteresAnual: vc('0'), porcentajeIvaInteres: vc('0') },
    { clave: '001', comisionFija: vc('0'), porcentajeComision: vc('0'), porcentajeIvaComision: vc('0'), porcentajeCashback: vc('10', '900'), plazo: vc('0'), porcentajeInteresAnual: vc('0'), porcentajeIvaInteres: vc('0') },
    { clave: '100', comisionFija: vc('0'), porcentajeComision: vc('0'), porcentajeIvaComision: vc('0'), porcentajeCashback: vc('0'), plazo: vc('3', '121'), porcentajeInteresAnual: vc('0'), porcentajeIvaInteres: vc('0') },
    { clave: '120', comisionFija: vc('0'), porcentajeComision: vc('0'), porcentajeIvaComision: vc('0'), porcentajeCashback: vc('0'), plazo: vc('6', '121'), porcentajeInteresAnual: vc('45', '030'), porcentajeIvaInteres: vc('16', '031') },
  ],
  afectacionLinea: [
    afect('001', 'Compra_Normal'), afect('002', 'Disposición Efectivo'),
    afect('021', 'Comisión'), afect('022', 'IVA Comisión'),
    afect('030', 'Interés', { consume: 'N' }), afect('031', 'IVA Interés', { consume: 'N' }),
    // §Ejemplo MSI — el movimiento consume; las parcialidades sólo generan Cargo
    afect('100', 'MSI_6', { consume: 'S', bc: 'N' }),
    afect('120', 'MCI_3', { consume: 'S', bc: 'N' }),
    afect('121', 'Capital MCI', { consume: 'N', bc: 'S', bf: 'S' }),
    afect('900', 'Cash Back', { nat: 'Abono', consume: 'N', bc: 'S' }),
  ],
};

const run = (clave, monto, extra = {}) => M.ejecutarMovimientoTDC({
  movimiento: { clave, descripcion: 'x', monto, fecha: '2026-09-15' },
  producto, catalogo, saldoDisponible: 100000, idCliente: 'CLI-1', idCuentaEje: 'EJE-1', ...extra,
});

console.log('\n── §11 Normalización de indicadores ──');
['S', 's', ' S ', 'Y', 'y'].forEach(v => eq(`indicador("${v}")`, M.indicador(v), 'S'));
['N', 'n', '', null, undefined, 'X'].forEach(v => eq(`indicador("${v}")`, M.indicador(v), 'N'));

console.log('\n── §1.1.1 Comisión: MAX y clave del ganador ──');
const r1 = run('002', 10000);  // 10,000 × 5% = 500 > 250
eq('comisión = 500', r1.efectosLinea.find(e => e.origen === 'comision').monto, 500);
eq('clave = 021 (%Com ganó)', r1.efectosLinea.find(e => e.origen === 'comision').clave, '021');
eq('IVA = 500 × 16% = 80', r1.efectosLinea.find(e => e.origen === 'iva-comision').monto, 80);
eq('clave IVA = 022', r1.efectosLinea.find(e => e.origen === 'iva-comision').clave, '022');

const r2 = run('002', 1000);   // 1,000 × 5% = 50 < 250 → gana la fija
eq('comisión = 250 (fija gana)', r2.efectosLinea.find(e => e.origen === 'comision').monto, 250);

// Empate exacto: 5,000 × 5% = 250 = comisión fija → manda la clave de la FIJA
const prodEmpate = {
  ...producto,
  promComisImpuestos: producto.promComisImpuestos.map(p =>
    p.clave === '002' ? { ...p, comisionFija: vc('250.00', 'FIJA'), porcentajeComision: vc('5', 'PCT') } : p),
  afectacionLinea: [...producto.afectacionLinea, afect('FIJA', 'Comisión fija'), afect('PCT', 'Comisión %')],
};
const rEmp = M.ejecutarMovimientoTDC({ movimiento: { clave: '002', descripcion: 'x', monto: 5000, fecha: '2026-09-15' }, producto: prodEmpate, catalogo, saldoDisponible: 100000, idCliente: 'CLI-1', idCuentaEje: 'EJE-1' });
eq('empate → clave de la comisión fija', rEmp.efectosLinea.find(e => e.origen === 'comision').clave, 'FIJA');

console.log('\n── Porcentajes: 5% es 0.05, nunca ×5 ──');
ok_('500 y no 50,000', r1.efectosLinea.find(e => e.origen === 'comision').monto === 500);

console.log('\n── §1.1.3 MSI: redondeo exacto en la última parcialidad ──');
const rMSI = run('100', 100);  // 100 / 3 = 33.33 → 33.33 + 33.33 + 33.34
eq('es MSI', rMSI.esMSI, true);
const caps = rMSI.calendario.filter(c => c.concepto === 'Capital');
eq('3 parcialidades', caps.length, 3);
eq('montos', caps.map(c => c.monto), [33.33, 33.33, 33.34]);
eq('la suma es exactamente el monto', M.money(caps.reduce((a, c) => a + c.monto, 0)), 100);
eq('saldo de capital decreciente', caps.map(c => c.saldoCapital), [66.67, 33.34, 0]);
eq('numeroParcialidad', caps.map(c => c.periodo), [1, 2, 3]);
eq('MSI no genera interés ni IVA', rMSI.calendario.filter(c => c.concepto !== 'Capital').length, 0);

console.log('\n── §Ejemplo MSI: la línea se consume UNA vez ──');
eq('consumido = 100 (el movimiento), no 200', rMSI.totalConsumido, 100);
eq('el movimiento no genera Cargo (bCargo=N)', rMSI.cargosACrear.filter(c => c.origen === 'movimiento').length, 0);
eq('cada parcialidad sí genera Cargo', rMSI.cargosACrear.filter(c => c.origen === 'msi-mci').length, 3);
ok_('los cargos de parcialidad llevan bFactura=S', rMSI.cargosACrear.filter(c => c.origen === 'msi-mci').every(c => c.bFactura === 'S'));

console.log('\n── §1.1.3 MCI ──');
const rMCI = run('120', 6000);
eq('es MCI', rMCI.esMCI, true);
const capsM = rMCI.calendario.filter(c => c.concepto === 'Capital');
eq('suma de capital exacta', M.money(capsM.reduce((a, c) => a + c.monto, 0)), 6000);
eq('interés por parcialidad', rMCI.calendario.find(c => c.concepto === 'Interés').monto, 225);
eq('IVA interés por parcialidad', rMCI.calendario.find(c => c.concepto === 'IVA Interés').monto, 36);

console.log('\n── §1.1.2 Cash Back: Cuenta EJE independiente de bCargo ──');
const rCB = run('001', 10000);
eq('cash back = 1,000', rCB.efectosLinea.find(e => e.origen === 'cash-back').monto, 1000);
eq('naturaleza de Afectación, no hardcodeada', rCB.efectosCuentaEje[0].naturaleza, 'Abono');
eq('Abono incrementa la Cuenta EJE', rCB.efectosCuentaEje[0].efectoEnSaldo, 1000);
eq('no consume línea', rCB.totalConsumido, 10000);
// bCargo=N para 900: sigue generando movimiento en Cuenta EJE
const prodCBsinCargo = { ...producto, afectacionLinea: producto.afectacionLinea.map(a => a.clave === '900' ? { ...a, bCargo: 'N' } : a) };
const rCB2 = M.ejecutarMovimientoTDC({ movimiento: { clave: '001', descripcion: 'x', monto: 10000, fecha: '2026-09-15' }, producto: prodCBsinCargo, catalogo, saldoDisponible: 100000, idCliente: 'CLI-1', idCuentaEje: 'EJE-1' });
eq('bCargo=N no genera Cargo de cash back', rCB2.cargosACrear.filter(c => c.origen === 'cash-back').length, 0);
eq('pero SÍ genera movimiento de Cuenta EJE', rCB2.efectosCuentaEje.length, 1);

console.log('\n── §10 Validaciones ──');
eq('monto 0 se rechaza', run('002', 0).ok, false);
eq('monto negativo se rechaza', run('002', -5).ok, false);
const rSinClave = M.ejecutarMovimientoTDC({
  movimiento: { clave: '002', descripcion: 'x', monto: 1000, fecha: '2026-09-15' },
  producto: { ...producto, promComisImpuestos: producto.promComisImpuestos.map(p => p.clave === '002' ? { ...p, porcentajeIvaComision: vc('16', '') } : p) },
  catalogo, saldoDisponible: 100000,
});
eq('valor > 0 sin clave = configuración inválida', rSinClave.ok, false);
eq('y no deja efectos', rSinClave.efectosLinea.length, 0);
console.log('  ', rSinClave.error);

console.log('\n── §2.2 / ESPEC 1 §2.2: mensajes literales ──');
const rNoPerm = run('999', 100);
eq('mensaje de Cargos Permitidos',
   rNoPerm.error,
   'La Clave de Movimiento "999" no está configurada en el Producto "010 Tarjeta de Crédito", en la sección "Cargos Permitidos".');
const rNoAfect = M.ejecutarMovimientoTDC({
  movimiento: { clave: '002', descripcion: 'x', monto: 1000, fecha: '2026-09-15' },
  producto: { ...producto, afectacionLinea: producto.afectacionLinea.filter(a => a.clave !== '021') },
  catalogo, saldoDisponible: 100000,
});
eq('mensaje de Afectación de la Línea',
   rNoAfect.error,
   'El Cargo "021" no se encuentra configurado en la sección "Afectación de la Línea" del Producto "010".');
eq('y no deja afectación parcial', rNoAfect.efectosLinea.length, 0);
eq('saldo intacto', rNoAfect.saldoDisponibleFinal, 100000);

console.log('\n── §3.4 Independencia de los tres indicadores ──');
const combos = [
  { consume: 'S', bc: 'S', cargo: 1, consumido: 500 },
  { consume: 'S', bc: 'N', cargo: 0, consumido: 500 },
  { consume: 'N', bc: 'S', cargo: 1, consumido: 0 },
  { consume: 'N', bc: 'N', cargo: 0, consumido: 0 },
];
for (const c of combos) {
  const prod = { ...producto, promComisImpuestos: [], afectacionLinea: [afect('001', 'Compra_Normal', { consume: c.consume, bc: c.bc })] };
  const rr = M.ejecutarMovimientoTDC({ movimiento: { clave: '001', descripcion: 'x', monto: 500, fecha: '2026-09-15' }, producto: prod, catalogo, saldoDisponible: 100000, idCliente: 'CLI-1', idCuentaEje: 'EJE-1' });
  eq(`consume=${c.consume} bCargo=${c.bc} → cargos`, rr.cargosACrear.length, c.cargo);
  eq(`consume=${c.consume} bCargo=${c.bc} → consumido`, rr.totalConsumido, c.consumido);
}

console.log(`\n${pass} aserciones OK, ${fail} fallas\n`);
process.exit(fail === 0 ? 0 : 1);
