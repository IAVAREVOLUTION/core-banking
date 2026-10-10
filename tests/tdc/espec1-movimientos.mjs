// Pruebas del motor contra los datos de la especificación.
// Se compila el TS a JS con esbuild (ya está en node_modules vía vite).
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const out = join(mkdtempSync(join(tmpdir(), 'motor-')), 'motor.mjs');
await build({
  entryPoints: ['src/app/lib/motorMovimientosTDC.ts'],
  outfile: out,
  format: 'esm',
  bundle: false,
  logLevel: 'error',
});
const M = await import('file://' + out.replace(/\\/g, '/'));

let pass = 0, fail = 0;
const eq = (nombre, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; } else { fail++; console.log(`  FALLA ${nombre}\n    esperado: ${JSON.stringify(want)}\n    obtenido: ${JSON.stringify(got)}`); }
};
const truthy = (nombre, got) => { if (got) pass++; else { fail++; console.log(`  FALLA ${nombre}: esperaba verdadero`); } };

// ── Catálogo (subconjunto real + los del ejemplo) ──
const catalogo = [
  { codigo: '001', nombre: 'Compra_Normal' },
  { codigo: '002', nombre: 'Disposición Efectivo' },
  { codigo: '021', nombre: 'Comisión' },
  { codigo: '022', nombre: 'IVA Comisión' },
  { codigo: '030', nombre: 'Interés' },
  { codigo: '031', nombre: 'IVA Interés' },
  { codigo: '101', nombre: 'Capital MSI6' },
  { codigo: '120', nombre: 'MCI_3' },
  { codigo: '121', nombre: 'Capital MCI3' },
  { codigo: '900', nombre: 'Cash Back' },
  { codigo: '100', nombre: 'MSI_6' },
];

const vc = (valor, clave = '') => ({ valor: String(valor), clave });

// ── Producto: Cargos Permitidos + Prom Comis e Impue + Afectación ──
const producto = {
  claveProducto: '010',
  nombreProducto: 'Tarjeta de Crédito',
  cargosPermitidos: [
    { tipoCargo: 'Compra_Normal' },
    { tipoCargo: 'Disposición Efectivo' },
    { tipoCargo: 'MSI_6' },
    { tipoCargo: 'MCI_3' },
  ],
  promComisImpuestos: [
    { clave: '001', concepto: 'Compra_Normal', comisionFija: vc('0.00'), porcentajeComision: vc('0'), porcentajeIvaComision: vc('0'), porcentajeCashback: vc('10', '900'), plazo: vc('0'), porcentajeInteresAnual: vc('0'), porcentajeIvaInteres: vc('0') },
    { clave: '002', concepto: 'Disposición Efectivo', comisionFija: vc('250.00', '021'), porcentajeComision: vc('5', '021'), porcentajeIvaComision: vc('16', '022'), porcentajeCashback: vc('3', '900'), plazo: vc('0'), porcentajeInteresAnual: vc('0'), porcentajeIvaInteres: vc('0') },
    { clave: '100', concepto: 'MSI_6', comisionFija: vc('0.00'), porcentajeComision: vc('0'), porcentajeIvaComision: vc('0'), porcentajeCashback: vc('10', '900'), plazo: vc('6', '101'), porcentajeInteresAnual: vc('0'), porcentajeIvaInteres: vc('0') },
    { clave: '120', concepto: 'MCI_3', comisionFija: vc('0.00'), porcentajeComision: vc('0'), porcentajeIvaComision: vc('0'), porcentajeCashback: vc('10', '900'), plazo: vc('6', '121'), porcentajeInteresAnual: vc('45', '030'), porcentajeIvaInteres: vc('16', '031') },
  ],
  afectacionLinea: [
    { clave: '001', concepto: 'Compra_Normal', naturaleza: 'Cargo', consumeLineaDisponible: 'S', bFactura: 'N', bCargo: 'S', liberaLineaAlPagar: 'S' },
    { clave: '002', concepto: 'Disposición Efectivo', naturaleza: 'Cargo', consumeLineaDisponible: 'S', bFactura: 'S', bCargo: 'S', liberaLineaAlPagar: 'S' },
    { clave: '021', concepto: 'Comisión', naturaleza: 'Cargo', consumeLineaDisponible: 'S', bFactura: 'S', bCargo: 'S', liberaLineaAlPagar: 'S' },
    { clave: '022', concepto: 'IVA Comisión', naturaleza: 'Cargo', consumeLineaDisponible: 'S', bFactura: 'N', bCargo: 'S', liberaLineaAlPagar: 'S' },
    { clave: '030', concepto: 'Interés', naturaleza: 'Cargo', consumeLineaDisponible: 'N', bFactura: 'N', bCargo: 'S', liberaLineaAlPagar: 'N' },
    { clave: '031', concepto: 'IVA Interés', naturaleza: 'Cargo', consumeLineaDisponible: 'N', bFactura: 'N', bCargo: 'S', liberaLineaAlPagar: 'N' },
    { clave: '100', concepto: 'MSI_6', naturaleza: 'Cargo', consumeLineaDisponible: 'S', bFactura: 'N', bCargo: 'S', liberaLineaAlPagar: 'S' },
    { clave: '101', concepto: 'Capital MSI6', naturaleza: 'Cargo', consumeLineaDisponible: 'N', bFactura: 'N', bCargo: 'N', liberaLineaAlPagar: 'N' },
    { clave: '120', concepto: 'MCI_3', naturaleza: 'Cargo', consumeLineaDisponible: 'S', bFactura: 'N', bCargo: 'S', liberaLineaAlPagar: 'S' },
    { clave: '121', concepto: 'Capital MCI3', naturaleza: 'Cargo', consumeLineaDisponible: 'N', bFactura: 'N', bCargo: 'N', liberaLineaAlPagar: 'N' },
    { clave: '900', concepto: 'Cash Back', naturaleza: 'Abono', consumeLineaDisponible: 'N', bFactura: 'N', bCargo: 'N', liberaLineaAlPagar: 'N' },
  ],
};

const run = (clave, monto, extra = {}) => M.ejecutarMovimientoTDC({
  movimiento: { clave, descripcion: 'prueba', monto, fecha: '2026-09-14' },
  producto, catalogo, saldoDisponible: 50000, idCliente: 'CLI-1', idCuentaEje: 'EJE-1', ...extra,
});

console.log('\n── ESPEC 1: clave no permitida ──');
const r0 = run('999', 1000);
eq('rechaza', r0.ok, false);
truthy('mensaje nombra clave y producto', r0.error.includes('"999"') && r0.error.includes('010 Tarjeta de Crédito') && r0.error.includes('Cargos Permitidos'));
eq('no deja efectos', r0.efectosLinea.length, 0);
console.log('  ', r0.error);

console.log('\n── 002 Disposición Efectivo $1,000: Max(250, 5%) ──');
const r1 = run('002', 1000);
eq('ok', r1.ok, true);
const com = r1.efectosLinea.find(e => e.origen === 'comision');
eq('comisión = Max(250, 50) = 250 (RN-02, no la suma)', com.monto, 250);
eq('clave de comisión = 021 (la de comisión fija)', com.clave, '021');
const iva = r1.efectosLinea.find(e => e.origen === 'iva-comision');
eq('IVA = 250 * 16% = 40 (RN-03, sobre la comisión)', iva.monto, 40);
eq('clave IVA = 022', iva.clave, '022');
const cb = r1.efectosLinea.find(e => e.origen === 'cash-back');
eq('cash back = 1000 * 3% = 30', cb.monto, 30);
eq('cash back es Abono', cb.naturaleza, 'Abono');
eq('cuenta eje: 1 movimiento', r1.efectosCuentaEje.length, 1);
eq('cuenta eje suma (RN-04)', r1.efectosCuentaEje[0].efectoEnSaldo, 30);
eq('consumido = 1000 + 250 + 40 (cash back no consume)', r1.totalConsumido, 1290);
eq('saldo final', r1.saldoDisponibleFinal, 48710);

console.log('\n── 002 con monto alto: gana el porcentaje ──');
const r2 = run('002', 20000);
const com2 = r2.efectosLinea.find(e => e.origen === 'comision');
eq('comisión = Max(250, 1000) = 1000', com2.monto, 1000);
eq('clave = 021 (la del %Com)', com2.clave, '021');

console.log('\n── 001 Compra_Normal: sin comisión, sólo cash back ──');
const r3 = run('001', 5000);
eq('sin comisión', r3.efectosLinea.filter(e => e.origen === 'comision').length, 0);
eq('sin renglones en cero (CA-16)', r3.efectosLinea.filter(e => e.monto === 0).length, 0);
eq('cash back = 500', r3.efectosLinea.find(e => e.origen === 'cash-back').monto, 500);
eq('consumido = 5000', r3.totalConsumido, 5000);

console.log('\n── 100 MSI_6 $6,000 a 6 meses ──');
const r4 = run('100', 6000);
eq('es MSI', r4.esMSI, true);
eq('no es MCI', r4.esMCI, false);
eq('6 renglones, sólo capital (CA-25)', r4.calendario.length, 6);
eq('capital por periodo = 1000', r4.calendario[0].monto, 1000);
eq('clave del capital = 101 (la de Plazo)', r4.calendario[0].clave, '101');
eq('primer vencimiento a un mes', r4.calendario[0].fecha, '2026-10-14');
eq('último vencimiento a seis meses', r4.calendario[5].fecha, '2027-03-14');
eq('consume el total, no el capital por periodo (Decisión 6)', r4.totalConsumido, 6000);

console.log('\n── 120 MCI_3 $6,000 a 6 meses, 45% anual ──');
const r5 = run('120', 6000);
eq('es MCI', r5.esMCI, true);
eq('18 renglones: capital + interés + IVA por periodo (CA-24)', r5.calendario.length, 18);
const cap = r5.calendario.filter(r => r.concepto === 'Capital');
const int = r5.calendario.filter(r => r.concepto === 'Interés');
const ivaInt = r5.calendario.filter(r => r.concepto === 'IVA Interés');
eq('capital por periodo', cap[0].monto, 1000);
eq('interés total 6000*45%*(6/12)=1350 → 225/periodo', int[0].monto, 225);
eq('IVA interés = 225*16% = 36', ivaInt[0].monto, 36);
eq('clave interés = 030', int[0].clave, '030');
eq('clave IVA interés = 031', ivaInt[0].clave, '031');

console.log('\n── CA-29: concepto sin configurar en Afectación aborta todo ──');
const prodSinAfect = { ...producto, afectacionLinea: producto.afectacionLinea.filter(a => a.clave !== '022') };
const r6 = M.ejecutarMovimientoTDC({ movimiento: { clave: '002', descripcion: 'x', monto: 1000, fecha: '2026-09-14' }, producto: prodSinAfect, catalogo, saldoDisponible: 50000, idCliente: 'CLI-1', idCuentaEje: 'EJE-1' });
eq('falla', r6.ok, false);
eq('no deja efectos parciales', r6.efectosLinea.length, 0);
eq('saldo intacto (CA-37)', r6.saldoDisponibleFinal, 50000);
truthy('nombra el cargo', r6.error.includes('022'));
console.log('  ', r6.error, '|', r6.pasoFallido);

console.log('\n── CA-21: sin Cuenta Eje falla completo ──');
const r7 = M.ejecutarMovimientoTDC({
  movimiento: { clave: '001', descripcion: 'x', monto: 5000, fecha: '2026-09-14' },
  producto: { ...producto, idLineaCredito: 'LC-000003' }, catalogo, saldoDisponible: 50000,
  idCliente: 'CLI-1', idCuentaEje: null,
});
eq('falla', r7.ok, false);
eq('saldo intacto', r7.saldoDisponibleFinal, 50000);
// §1.1.2 — mensaje literal, con Cliente y Línea de Crédito nombrados
eq('mensaje literal de §1.1.2', r7.error,
   'No se encontró una Cuenta EJE válida para el Cliente "CLI-1" asociado a la Línea de Crédito "LC-000003".');
eq('paso fallido', r7.pasoFallido, 'ESPEC 2 §1.1.2 — Cuenta EJE');
eq('no deja efectos en la Cuenta EJE', r7.efectosCuentaEje.length, 0);
// §1.1.2 — no asumir IdCliente == IdCuentaEje: el efecto viaja con la cuenta resuelta
const r7b = run('001', 5000, { idCliente: 'CLI-1', idCuentaEje: 'EJE-9' });
eq('la Cuenta EJE del efecto es la resuelta, no el cliente', r7b.efectosCuentaEje[0].idCuentaEje, 'EJE-9');
eq('el efecto conserva el cliente', r7b.efectosCuentaEje[0].idCliente, 'CLI-1');
eq('el nombre sale de Afectación de la Línea', r7b.efectosCuentaEje[0].nombre, 'Cash Back');
console.log('  ', r7.error);

console.log('\n── CA-11: clave permitida sin promoción pasa directo al punto 2 ──');
const prodSinProm = { ...producto, promComisImpuestos: [] };
const r8 = M.ejecutarMovimientoTDC({ movimiento: { clave: '001', descripcion: 'x', monto: 5000, fecha: '2026-09-14' }, producto: prodSinProm, catalogo, saldoDisponible: 50000, idCliente: 'CLI-1', idCuentaEje: 'EJE-1' });
eq('ok, no es error', r8.ok, true);
eq('sólo el efecto del movimiento', r8.efectosLinea.length, 1);
eq('consumido = 5000', r8.totalConsumido, 5000);

console.log('\n── leerVC acepta el string plano con pipe ──');
eq('"250.00|021"', M.leerVC('250.00|021'), { num: 250, clave: '021', crudo: '250.00' });
eq('"10%|900"', M.leerVC('10%|900'), { num: 10, clave: '900', crudo: '10%' });
eq('"0%|" sin clave', M.leerVC('0%|'), { num: 0, clave: '', crudo: '0%' });
eq('objeto', M.leerVC({ valor: '6', clave: '101' }), { num: 6, clave: '101', crudo: '6' });

console.log(`\n${pass} aserciones OK, ${fail} fallas\n`);
process.exit(fail === 0 ? 0 : 1);
