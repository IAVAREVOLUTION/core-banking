// Pruebas del motor de Cierre de Corte — los 19 casos del §44.9.
import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const dir = mkdtempSync(join(tmpdir(), 'cierre-'));
await build({
  entryPoints: ['src/app/lib/motorCierreCorteTDC.ts'],
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

const linea = {
  idLineaCredito: 'LC-001', idCliente: 'CLI-001', idSolicitud: 'SOL-001',
  idProducto: 'PROD-TDC', claveProducto: '010', moneda: 'MXN',
};

// Prelación real del producto: IVA, Interés Moratorio, Interés Ordinario, Comisión, Capital
const prelacion = [
  { orden: 1, clave: '12', concepto: 'IVA' },
  { orden: 2, clave: '011', concepto: 'Interés Moratorio' },
  { orden: 3, clave: '012', concepto: 'Interés Ordinario' },
  { orden: 4, clave: '010', concepto: 'Comisiones' },
  { orden: 5, clave: '01', concepto: 'CAPITAL' },
];

const config = {
  diaCorte: 20, diasParaPago: 20, ajusteDiaInhabil: 'No ajustar',
  pagoMinimoMetodo: '% + mínimo fijo', pagoMinimoPorcentaje: 10, pagoMinimoMonto: 500,
  pagoMinimoAgregarSaldoVencido: false,
};

const cargo = (o) => ({
  id: o.id, clave: o.clave, nombre: o.nombre, naturaleza: o.nat || 'Cargo',
  monto: o.monto, fecha: o.fecha, bFactura: 'N', bCargo: o.b ?? 'S',
  estatus: o.est || 'Pendiente', cxcId: o.cxc ?? null,
});

console.log('\n── Periodo de corte (RN-01) ──');
eq('DiaCorte 20, sep-2026', M.calcularPeriodoCorte(20, new Date(2026, 8, 25)),
   { fechaInicio: '2026-08-21', fechaFin: '2026-09-20' });
eq('DiaCorte 20, ene-2027 cruza año', M.calcularPeriodoCorte(20, new Date(2027, 0, 5)),
   { fechaInicio: '2026-12-21', fechaFin: '2027-01-20' });
eq('DiaCorte 31 en febrero se acota (CA-11)', M.calcularPeriodoCorte(31, new Date(2026, 1, 10)),
   { fechaInicio: '2026-02-01', fechaFin: '2026-02-28' });

console.log('\n── Fecha límite de pago (CA-28) ──');
eq('20/09 + 20 días naturales', M.calcularFechaLimitePago('2026-09-20', config), '2026-10-10');
eq('no hardcodea: 15 días', M.calcularFechaLimitePago('2026-09-20', { ...config, diasParaPago: 15 }), '2026-10-05');
// 10/10/2026 es sábado
eq('ajuste siguiente día hábil', M.calcularFechaLimitePago('2026-09-20', { ...config, ajusteDiaInhabil: 'Siguiente día hábil' }), '2026-10-12');
eq('ajuste día hábil anterior', M.calcularFechaLimitePago('2026-09-20', { ...config, ajusteDiaInhabil: 'Día hábil anterior' }), '2026-10-09');

console.log('\n── Normalización de bCargo (CA-16) ──');
['S', 's', ' S ', 'Y', 'y'].forEach(v => ok_(`bCargo "${v}" factura`, M.cargoFacturable(v)));
['N', 'n', '', null, undefined, 'X'].forEach(v => ok_(`bCargo "${v}" NO factura`, !M.cargoFacturable(v)));

console.log('\n── Selección del periodo (CA-13…CA-18) ──');
const cargos = [
  cargo({ id: 'C1', clave: '01', nombre: 'CAPITAL', monto: 8000, fecha: '2026-09-01' }),
  cargo({ id: 'C2', clave: '012', nombre: 'Interés Ordinario', monto: 500, fecha: '2026-09-05' }),
  cargo({ id: 'C3', clave: '12', nombre: 'IVA', monto: 80, fecha: '2026-09-05' }),
  cargo({ id: 'C4', clave: '010', nombre: 'Comisiones', monto: 250, fecha: '2026-08-25' }),
  cargo({ id: 'C5', clave: '12', nombre: 'IVA', monto: 40, fecha: '2026-08-25' }),
  cargo({ id: 'F1', clave: '01', nombre: 'CAPITAL', monto: 999, fecha: '2026-09-21' }),          // fuera (CA-17)
  cargo({ id: 'F2', clave: '01', nombre: 'CAPITAL', monto: 999, fecha: '2026-08-20' }),          // fuera, corte anterior
  cargo({ id: 'P1', clave: '01', nombre: 'CAPITAL', monto: 500, fecha: '2026-09-02', est: 'Procesado' }), // CA-18
  cargo({ id: 'B1', clave: '01', nombre: 'CAPITAL', monto: 700, fecha: '2026-09-03', b: 'N' }),  // CA-15
  cargo({ id: 'X1', clave: '01', nombre: 'CAPITAL', monto: 300, fecha: '2026-09-04', cxc: 'CXC-9' }), // CA-42
];
const sel = M.seleccionarCargosDelPeriodo(cargos, '2026-08-21', '2026-09-20');
eq('5 cargos elegibles', sel.map(c => c.id).sort(), ['C1', 'C2', 'C3', 'C4', 'C5']);

console.log('\n── Cierre completo ──');
const r = M.ejecutarCierreCorte({ linea, config, cargos, prelacion, fechaInicio: '2026-08-21', fechaFin: '2026-09-20' });
eq('ok', r.ok, true);
eq('5 cargos procesados', r.cantidadCargos, 5);
eq('total = 8000+500+80+250+40', r.montoTotalPagar, 8870);
// §17 + §44.8 + §44.12 — regla obligatoria, verificada explícitamente
eq('FechaDocumento = FechaFin (§17)', r.fechaDocumento, '2026-09-20');
eq('FechaDocumento NO es FechaInicio', r.fechaDocumento === '2026-08-21', false);
eq('FechaDocumento coincide con el fin del periodo', r.fechaDocumento, r.periodo.fechaFin);
eq('vencimiento = FechaFin + 20', r.fechaVencimiento, '2026-10-10');
eq('mínimo = Max(10% de 8870, 500)', r.montoMinimoPagar, 887);
eq('orden por prelación', r.detalle.map(d => d.ordenPrelacion), [1, 1, 3, 4, 5]);
eq('desempate por fecha en el orden 1', r.detalle.slice(0, 2).map(d => d.idCargo), ['C5', 'C3']);
eq('conceptos en orden', r.detalle.map(d => d.nombreConcepto),
   ['IVA', 'IVA', 'Interés Ordinario', 'Comisiones', 'CAPITAL']);
ok_('cada renglón lleva ordenPrelacion (CA-24)', r.detalle.every(d => typeof d.ordenPrelacion === 'number'));
eq('cargosProcesados en el mismo orden', r.cargosProcesados, r.detalle.map(d => d.idCargo));

console.log('\n── Pago mínimo por método (CA-27) ──');
const det = r.detalle;
eq('monto fijo', M.calcularPagoMinimo({ ...config, pagoMinimoMetodo: 'Monto fijo' }, det, 8870), 500);
eq('% del saldo al corte', M.calcularPagoMinimo({ ...config, pagoMinimoMetodo: '% del saldo al corte' }, det, 8870), 887);
eq('el mayor entre % y fijo (% gana)', M.calcularPagoMinimo({ ...config, pagoMinimoMetodo: 'El mayor entre % y monto fijo' }, det, 8870), 887);
eq('el mayor, fijo gana con total chico', M.calcularPagoMinimo({ ...config, pagoMinimoMetodo: 'El mayor entre % y monto fijo' }, det, 2000), 500);
eq('sin método: exige el total', M.calcularPagoMinimo({ ...config, pagoMinimoMetodo: '' }, det, 8870), 8870);
eq('nunca excede el total', M.calcularPagoMinimo({ ...config, pagoMinimoMetodo: 'Monto fijo', pagoMinimoMonto: 99999 }, det, 8870), 8870);
eq('agrega saldo vencido', M.calcularPagoMinimo({ ...config, pagoMinimoAgregarSaldoVencido: true }, det, 8870, 1000), 1887);
eq('conceptos acotados: sólo IVA (80+40)', M.calcularPagoMinimo(
  { ...config, pagoMinimoMetodo: '% del saldo al corte', pagoMinimoConceptos: ['IVA'] }, det, 8870), 12);

console.log('\n── Concepto sin prelación aborta (RN-04, CA-22) ──');
const sinPrel = M.ejecutarCierreCorte({
  linea, config, prelacion: prelacion.filter(p => p.clave !== '010'),
  cargos, fechaInicio: '2026-08-21', fechaFin: '2026-09-20',
});
eq('falla', sinPrel.ok, false);
eq('no deja detalle', sinPrel.detalle.length, 0);
eq('no marca cargos', sinPrel.cargosProcesados.length, 0);
ok_('el mensaje nombra concepto y producto', sinPrel.error.includes('Comisiones') && sinPrel.error.includes('PROD-TDC'));
console.log('  ', sinPrel.error);

console.log('\n── Sin cargos pendientes (CA-19) ──');
const vacio = M.ejecutarCierreCorte({ linea, config, prelacion, cargos: [], fechaInicio: '2026-08-21', fechaFin: '2026-09-20' });
eq('no genera CxC', vacio.ok, false);
eq('sin detalle', vacio.detalle.length, 0);
ok_('mensaje con periodo y línea', vacio.error.includes('2026-08-21') && vacio.error.includes('LC-001'));
console.log('  ', vacio.error);

console.log('\n── Abonos fuera del documento (§Decisión 8) ──');
const conAbono = M.ejecutarCierreCorte({
  linea, config, prelacion,
  cargos: [...cargos, cargo({ id: 'A1', clave: '900', nombre: 'Cash Back', monto: 30, fecha: '2026-09-10', nat: 'Abono' })],
  fechaInicio: '2026-08-21', fechaFin: '2026-09-20',
});
eq('sigue con 5 renglones', conAbono.cantidadCargos, 5);
eq('total sin el abono', conAbono.montoTotalPagar, 8870);
ok_('lo advierte', conAbono.advertencias.some(a => a.includes('Abono')));

console.log('\n── Validaciones previas (CA-50) ──');
eq('inicio > fin', M.ejecutarCierreCorte({ linea, config, prelacion, cargos, fechaInicio: '2026-09-21', fechaFin: '2026-09-20' }).ok, false);
eq('sin producto', M.ejecutarCierreCorte({ linea: { ...linea, idProducto: '' }, config, prelacion, cargos, fechaInicio: '2026-08-21', fechaFin: '2026-09-20' }).ok, false);
eq('sin prelación configurada', M.ejecutarCierreCorte({ linea, config, prelacion: [], cargos, fechaInicio: '2026-08-21', fechaFin: '2026-09-20' }).ok, false);

console.log('\n── Doble ejecución (CA-41/CA-42) ──');
// Tras el primer cierre, los cargos quedan Procesados y ligados a la CxC.
const trasCierre = cargos.map(c =>
  r.cargosProcesados.includes(c.id) ? { ...c, estatus: 'Procesado', cxcId: 'CXC-001' } : c);
const segunda = M.ejecutarCierreCorte({ linea, config, prelacion, cargos: trasCierre, fechaInicio: '2026-08-21', fechaFin: '2026-09-20' });
eq('la segunda corrida no genera CxC', segunda.ok, false);
ok_('porque ya no hay pendientes', segunda.error.includes('No existen cargos pendientes'));

console.log(`\n${pass} aserciones OK, ${fail} fallas\n`);
process.exit(fail === 0 ? 0 : 1);
