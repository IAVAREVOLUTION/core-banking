// Pruebas de la ESPECIFICACIÓN 6 — Generación de Estado de Cuenta.
// Cubre los criterios de aceptación de REQ-31: elección de periodo (§7),
// filtrado de pagos y movimientos (§9, §10), snapshot (§14, §15), duplicados
// (§16) y las cuatro validaciones de fecha (§17).
import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const dir = mkdtempSync(join(tmpdir(), 'e6-'));
await build({
  entryPoints: ['src/app/lib/motorEstadoCuentaTDC.ts'],
  outfile: join(dir, 'm.mjs'), format: 'esm', bundle: true, logLevel: 'error',
});
const M = await import(pathToFileURL(join(dir, 'm.mjs')).href);

let pass = 0, fail = 0;
const eq = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`  FALLA ${n}\n    esperado: ${JSON.stringify(want)}\n    obtenido: ${JSON.stringify(got)}`); }
};
const ok_ = (n, g) => { if (g) pass++; else { fail++; console.log(`  FALLA ${n}`); } };

// ── Constructores ──
const concepto = (id, orden, monto, pagoTotal = 0) => ({
  id, claveConcepto: `C${orden}`, nombreConcepto: `Concepto ${orden}`,
  monto, pagoTotal, saldoPendiente: monto - pagoTotal, ordenPrelacion: orden,
});

const aviso = (id, ini, fin, venc, total, detalle, extra = {}) => ({
  id, folio: `CXC-${id}`,
  fechaInicio: ini, fechaFin: fin, fechaDocumento: extra.fechaDoc || fin,
  fechaVencimiento: venc,
  montoTotalPagar: total,
  montoMinimoPagar: extra.minimo != null ? extra.minimo : Math.round(total * 0.05 * 100) / 100,
  pagoTotal: extra.pagoTotal || 0,
  saldoPendiente: extra.saldoPendiente != null ? extra.saldoPendiente : total - (extra.pagoTotal || 0),
  moneda: 'MXN', estatus: extra.estatus || 'Pendiente',
  detalle,
});

const mov = (id, fecha, monto, naturaleza = 'Cargo') => ({
  id, clave: `MOV${id}`, nombre: `Movimiento ${id}`, naturaleza, monto, fecha,
});

const pago = (id, fechaPago, monto, extra = {}) => ({
  id, idCxC: extra.idCxC, referencia: `REF-${id}`,
  montoAplicado: monto, fechaPago, estatus: extra.estatus,
});

const LINEA = {
  idLinea: 'LIN-001', idCliente: 'CLI-1', numeroLinea: '4000-0001',
  limiteAutorizado: 100000, saldoDisponible: 70000, moneda: 'MXN',
};

const run = (extra = {}) => M.generarEstadoCuenta({
  linea: LINEA,
  fechaEstado: '2026-10-05',
  fechaActual: '2026-10-18',
  avisos: [], movimientos: [], pagos: [], estadosPrevios: [],
  ...extra,
});

// El escenario del documento: periodo 16/08–15/09, corte 15/09, límite 05/10.
const AVISO_SEP = aviso('A2', '2026-08-16', '2026-09-15', '2026-10-05', 30000, [
  concepto('d1', 1, 10000), concepto('d2', 2, 20000),
]);
const AVISO_AGO = aviso('A1', '2026-07-16', '2026-08-15', '2026-09-05', 12000, [
  concepto('d0', 1, 12000, 12000),
], { pagoTotal: 12000, saldoPendiente: 0 });

console.log('\n── §17.1 Fecha Estado obligatoria ──');
const rVacia = run({ fechaEstado: '' });
eq('no procede', rVacia.ok, false);
eq('código', rVacia.codigoError, 'FECHA_REQUERIDA');
eq('mensaje literal de §17.1', rVacia.error, 'Debe capturar la Fecha Estado.');
eq('no elige periodo', rVacia.periodo, null);

console.log('\n── §17.2 Fecha Estado futura ──');
const rFutura = run({ fechaEstado: '2026-12-01', fechaActual: '2026-10-18', avisos: [AVISO_SEP] });
eq('no procede', rFutura.ok, false);
eq('código', rFutura.codigoError, 'FECHA_FUTURA');
eq('mensaje literal de §17.2', rFutura.error, 'La Fecha Estado no puede ser mayor a la fecha actual.');
ok_('la fecha de hoy SÍ se permite', run({ fechaEstado: '2026-10-18', fechaActual: '2026-10-18', avisos: [AVISO_SEP] }).ok);

console.log('\n── §17.3 Sin periodo de corte ──');
const rSinPeriodo = run({ avisos: [] });
eq('no procede', rSinPeriodo.ok, false);
eq('código', rSinPeriodo.codigoError, 'SIN_PERIODO');
eq('mensaje literal de §17.3', rSinPeriodo.error,
   'No existe un periodo de corte disponible para la Fecha Estado seleccionada.');

console.log('\n── §17.3 Un corte POSTERIOR a la Fecha Estado no cuenta ──');
const rCortePosterior = run({
  fechaEstado: '2026-09-01',
  avisos: [AVISO_SEP],   // corta el 15/09, después de la Fecha Estado
});
eq('no hay periodo elegible', rCortePosterior.codigoError, 'SIN_PERIODO');

console.log('\n── §17.4 / H-1 Aviso cancelado ──');
const rCancelado = run({
  avisos: [aviso('AX', '2026-08-16', '2026-09-15', '2026-10-05', 5000, [concepto('x', 1, 5000)], { estatus: 'Cancelada' })],
});
eq('no procede', rCancelado.ok, false);
eq('código', rCancelado.codigoError, 'SIN_AVISO');
eq('mensaje literal de §17.4', rCancelado.error,
   'No existe un Aviso de Vencimiento asociado al periodo seleccionado.');

console.log('\n── §7 El ejemplo del documento: corte 15/09 para Fecha Estado 05/10 ──');
const r7 = run({ avisos: [AVISO_AGO, AVISO_SEP] });
ok_('procede', r7.ok);
eq('elige el corte del 15/09', r7.fechaCorte, '2026-09-15');
eq('periodo 16/08–15/09 (inicio)', r7.fechaInicioPeriodo, '2026-08-16');
eq('periodo 16/08–15/09 (fin)', r7.fechaFinPeriodo, '2026-09-15');
eq('fecha límite de pago 05/10', r7.fechaLimitePago, '2026-10-05');
eq('el Aviso elegido es la CxC de septiembre', r7.periodo.id, 'A2');

console.log('\n── §8 Las tres fechas son distintas y se conservan ──');
eq('FechaEstado se conserva', r7.fechaEstado, '2026-10-05');
ok_('FechaCorte != FechaEstado', r7.fechaCorte !== r7.fechaEstado);

console.log('\n── §7 Empate de fecha de corte: desempata por vencimiento y luego por id ──');
const rEmpate = run({
  avisos: [
    aviso('B', '2026-08-16', '2026-09-15', '2026-10-05', 1000, [concepto('b', 1, 1000)]),
    aviso('C', '2026-08-16', '2026-09-15', '2026-10-20', 2000, [concepto('c', 1, 2000)]),
  ],
  fechaEstado: '2026-10-25',
  fechaActual: '2026-11-01',
});
eq('gana el de vencimiento posterior', rEmpate.periodo.id, 'C');

console.log('\n── §10 Movimientos: sólo los del periodo ──');
const r10 = run({
  avisos: [AVISO_SEP],
  movimientos: [
    mov('m0', '2026-08-15', 500),    // un día antes del periodo
    mov('m1', '2026-08-16', 1000),   // primer día: entra
    mov('m2', '2026-09-01', 2000),
    mov('m3', '2026-09-15', 3000),   // último día: entra
    mov('m4', '2026-09-16', 900),    // un día después
  ],
});
eq('3 movimientos en el periodo', r10.movimientosPeriodo.length, 3);
eq('los bordes entran', r10.movimientosPeriodo.map(m => m.id), ['m1', 'm2', 'm3']);
eq('cargos del periodo', r10.snapshot.cargosPeriodo, 6000);

console.log('\n── §10 Los abonos no suman a CargosPeriodo ──');
const r10b = run({
  avisos: [AVISO_SEP],
  movimientos: [mov('c1', '2026-09-01', 1000), mov('a1', '2026-09-02', 400, 'Abono')],
});
eq('sólo el cargo suma', r10b.snapshot.cargosPeriodo, 1000);
eq('pero ambos se conservan en el detalle', r10b.movimientosPeriodo.length, 2);

console.log('\n── §9 / §15 El ejemplo: 20,000 sí, 5,000 no ──');
const r15 = run({
  avisos: [AVISO_SEP],
  pagos: [pago('p1', '2026-10-03', 20000), pago('p2', '2026-10-07', 5000)],
});
eq('sólo un pago considerado', r15.pagosConsiderados.length, 1);
eq('es el del 03/10', r15.pagosConsiderados[0].id, 'p1');
eq('pagos del periodo', r15.snapshot.pagosPeriodo, 20000);

console.log('\n── §9 El pago del día exacto de la Fecha Estado entra ──');
eq('05/10 <= 05/10', run({ avisos: [AVISO_SEP], pagos: [pago('pX', '2026-10-05', 100)] }).pagosConsiderados.length, 1);

console.log('\n── §9 Estatus que no cuentan ──');
const r9e = run({
  avisos: [AVISO_SEP],
  pagos: [
    pago('ok', '2026-10-01', 100, { estatus: 'Aplicado' }),
    pago('can', '2026-10-01', 100, { estatus: 'Cancelado' }),
    pago('rev', '2026-10-01', 100, { estatus: 'Reversado' }),
    pago('rec', '2026-10-01', 100, { estatus: 'Rechazado' }),
    pago('pen', '2026-10-01', 100, { estatus: 'Pendiente' }),
  ],
});
eq('sólo el aplicado', r9e.pagosConsiderados.map(p => p.id), ['ok']);
eq('la suma refleja sólo ese', r9e.snapshot.pagosPeriodo, 100);

console.log('');
console.log('-- D3 SaldoAlCorte = SaldoAnterior + CargosPeriodo - PagosAplicados --');

// Sin saldo anterior ni pagos: el saldo son los cargos del periodo.
const rD3a = run({ avisos: [AVISO_SEP], movimientos: [mov('m1', '2026-09-01', 10580)] });
eq('0 + 10,580 - 0', rD3a.snapshot.saldoAlCorte, 10580);

// El caso del documento: 0 + 10,580 - 10,000 = 580.
const rD3b = run({
  avisos: [AVISO_SEP],
  movimientos: [mov('m1', '2026-09-01', 10580)],
  pagos: [pago('p1', '2026-10-01', 10000)],
});
eq('los pagos reducen el saldo', rD3b.snapshot.saldoAlCorte, 580);

// Con saldo anterior de un corte previo.
const rD3c = run({
  avisos: [
    aviso('V1', '2026-07-16', '2026-08-15', '2026-09-05', 12000,
          [concepto('v', 1, 12000, 2000)], { pagoTotal: 2000, saldoPendiente: 10000 }),
    AVISO_SEP,
  ],
  movimientos: [mov('m1', '2026-09-01', 1500)],
  pagos: [pago('p1', '2026-10-01', 500)],
});
eq('10,000 + 1,500 - 500', rD3c.snapshot.saldoAlCorte, 11000);

// Un abono del periodo no es un cargo: no sube el saldo.
const rD3d = run({
  avisos: [AVISO_SEP],
  movimientos: [mov('c1', '2026-09-01', 1000), mov('a1', '2026-09-02', 400, 'Abono')],
});
eq('solo los cargos suman', rD3d.snapshot.saldoAlCorte, 1000);

// Saldo A FAVOR: pagar de mas deja el saldo negativo y DEBE poder emitirse.
const rD3e = run({
  avisos: [AVISO_SEP],
  movimientos: [mov('m1', '2026-09-01', 1000)],
  pagos: [pago('p1', '2026-10-01', 1500)],
});
eq('saldo a favor', rD3e.snapshot.saldoAlCorte, -500);
ok_('y el estado se puede emitir', rD3e.ok);

// El importe FACTURADO del Aviso no se toca: es la base de la poliza (ESPEC 5).
eq('el Aviso conserva su monto', rD3b.periodo.montoTotalPagar, 30000);

// La identidad se sostiene en todos los casos.
for (const [n, r] of [['a', rD3a], ['b', rD3b], ['c', rD3c], ['d', rD3d], ['e', rD3e]]) {
  eq('D3-' + n + ': anterior + cargos - pagos', r.snapshot.saldoAlCorte,
     M.money(r.snapshot.saldoAnterior + r.snapshot.cargosPeriodo - r.snapshot.pagosPeriodo));
}

// Relacion con D2: lo que no genera intereses es el saldo antes de los pagos.
for (const [n, r] of [['a', rD3a], ['b', rD3b], ['c', rD3c]]) {
  eq('D2/D3-' + n + ': PNG = saldo + pagos', r.snapshot.pagoNoGeneraIntereses,
     M.money(r.snapshot.saldoAlCorte + r.snapshot.pagosPeriodo));
}

console.log('\n── §14 / D3 SaldoAnterior: sin estado previo, de las CxC anteriores ──');
const rSA = run({
  avisos: [
    aviso('V1', '2026-07-16', '2026-08-15', '2026-09-05', 12000, [concepto('v', 1, 12000, 2000)], { pagoTotal: 2000, saldoPendiente: 10000 }),
    AVISO_SEP,
  ],
});
eq('arrastra el pendiente del corte anterior', rSA.snapshot.saldoAnterior, 10000);

console.log('\n── §14 La CxC anterior ya pagada no aporta saldo anterior ──');
eq('saldo anterior cero', run({ avisos: [AVISO_AGO, AVISO_SEP] }).snapshot.saldoAnterior, 0);

console.log('\n── §12 paso 8 Con Estado anterior, manda su SaldoAlCorte ──');
const rPrev = run({
  avisos: [AVISO_AGO, AVISO_SEP],
  estadosPrevios: [{ id: 'E1', fechaEstado: '2026-09-05', fechaCorte: '2026-08-15', saldoAlCorte: 7777, estatus: 'GENERADO' }],
});
eq('encadena con el estado previo', rPrev.snapshot.saldoAnterior, 7777);
eq('y lo reporta', rPrev.estadoAnterior.id, 'E1');

console.log('\n── §12 paso 8 Un Estado con ERROR no encadena ──');
const rPrevErr = run({
  avisos: [AVISO_AGO, AVISO_SEP],
  estadosPrevios: [{ id: 'E9', fechaEstado: '2026-09-05', fechaCorte: '2026-08-15', saldoAlCorte: 7777, estatus: 'ERROR' }],
});
eq('no se toma como anterior', rPrevErr.estadoAnterior, null);

console.log('\n── §16 Control de duplicados ──');
const rDup = run({
  avisos: [AVISO_SEP],
  estadosPrevios: [{ id: 'E1', fechaEstado: '2026-10-05', fechaCorte: '2026-09-15', saldoAlCorte: 30000, estatus: 'GENERADO' }],
});
eq('no procede', rDup.ok, false);
eq('código', rDup.codigoError, 'DUPLICADO');
eq('mensaje de §16', rDup.error, 'Ya existe un Estado de Cuenta generado para la fecha 2026-10-05.');

console.log('\n── §16 Un intento con ERROR no bloquea el reintento ──');
const rReintento = run({
  avisos: [AVISO_SEP],
  estadosPrevios: [{ id: 'E2', fechaEstado: '2026-10-05', fechaCorte: '2026-09-15', saldoAlCorte: 0, estatus: 'ERROR' }],
});
ok_('se puede reintentar', rReintento.ok);

console.log('\n── §14 Resto del snapshot ──');
eq('límite autorizado', r7.snapshot.limiteAutorizado, 100000);
eq('crédito disponible', r7.snapshot.creditoDisponible, 70000);
eq('consume línea = límite - disponible', r7.snapshot.saldoConsumeLinea, 30000);
eq('pago mínimo del Aviso', r7.snapshot.pagoMinimo, 1500);

console.log('');
console.log('-- D2 PagoNoGeneraIntereses = CargosPeriodo + SaldoAnterior --');
eq('sin cargos ni saldo anterior es cero', r7.snapshot.pagoNoGeneraIntereses, 0);
eq('y queda marcado como calculado', r7.snapshot.pagoNoGeneraInteresesConfigurado, true);

// Con cargos del periodo y sin saldo anterior.
const rPNG1 = run({ avisos: [AVISO_AGO, AVISO_SEP], movimientos: [mov('c1', '2026-09-01', 10580)] });
eq('cargos 10,580 + anterior 0', rPNG1.snapshot.pagoNoGeneraIntereses, 10580);
eq('el saldo anterior es cero', rPNG1.snapshot.saldoAnterior, 0);

// Con saldo anterior pendiente de un corte previo.
const rPNG2 = run({
  avisos: [
    aviso('V1', '2026-07-16', '2026-08-15', '2026-09-05', 12000,
          [concepto('v', 1, 12000, 2000)], { pagoTotal: 2000, saldoPendiente: 10000 }),
    AVISO_SEP,
  ],
  movimientos: [mov('c1', '2026-09-01', 1500)],
});
eq('cargos 1,500 + anterior 10,000', rPNG2.snapshot.pagoNoGeneraIntereses, 11500);

// Los pagos ya aplicados NO se descuentan: el importe describe el total que
// evita intereses, no el faltante a la Fecha Estado.
const rPNG3 = run({
  avisos: [AVISO_AGO, AVISO_SEP],
  movimientos: [mov('c1', '2026-09-01', 10580)],
  pagos: [pago('p1', '2026-10-01', 10000)],
});
eq('no se descuentan los 10,000 pagados', rPNG3.snapshot.pagoNoGeneraIntereses, 10580);
eq('pero los pagos si se reportan aparte', rPNG3.snapshot.pagosPeriodo, 10000);

// Solo los cargos entran: un abono del periodo no sube el importe.
const rPNG4 = run({
  avisos: [AVISO_AGO, AVISO_SEP],
  movimientos: [mov('c1', '2026-09-01', 1000), mov('a1', '2026-09-02', 400, 'Abono')],
});
eq('el abono no suma', rPNG4.snapshot.pagoNoGeneraIntereses, 1000);

// La identidad se sostiene en todos los casos.
for (const [n, r] of [['PNG1', rPNG1], ['PNG2', rPNG2], ['PNG3', rPNG3], ['PNG4', rPNG4]]) {
  eq(n + ': = cargos + anterior', r.snapshot.pagoNoGeneraIntereses,
     M.money(r.snapshot.cargosPeriodo + r.snapshot.saldoAnterior));
}

console.log('\n── §12 paso 10 Validación de consistencia ──');
const rDescuadre = run({
  avisos: [aviso('BAD', '2026-08-16', '2026-09-15', '2026-10-05', 30000, [concepto('d1', 1, 10000)])],
});
eq('no procede', rDescuadre.ok, false);
eq('código', rDescuadre.codigoError, 'INCONSISTENTE');
ok_('explica el descuadre', /detalle suma/.test(rDescuadre.descuadres[0]));
ok_('pero devuelve el snapshot para poder mostrarlo', rDescuadre.snapshot !== null);

console.log('\n── §12 paso 10 Disponible mayor que el límite se detecta ──');
const rLim = M.generarEstadoCuenta({
  linea: { ...LINEA, limiteAutorizado: 1000, saldoDisponible: 5000 },
  fechaEstado: '2026-10-05', fechaActual: '2026-10-18',
  avisos: [AVISO_SEP], movimientos: [], pagos: [], estadosPrevios: [],
});
eq('no procede', rLim.ok, false);
ok_('lo dice', rLim.descuadres.some(d => /Crédito Disponible excede/.test(d)));

console.log('\n── CA-15 El snapshot es reproducible ──');
const a1 = run({ avisos: [AVISO_AGO, AVISO_SEP], movimientos: [mov('m', '2026-09-02', 1000)], pagos: [pago('p', '2026-10-01', 500)] });
const a2 = run({ avisos: [AVISO_AGO, AVISO_SEP], movimientos: [mov('m', '2026-09-02', 1000)], pagos: [pago('p', '2026-10-01', 500)] });
eq('dos corridas iguales dan lo mismo', JSON.stringify(a1.snapshot), JSON.stringify(a2.snapshot));

console.log('\n── CA-13 El motor no muta sus entradas ──');
const avisosEntrada = [AVISO_AGO, AVISO_SEP];
const movsEntrada = [mov('m1', '2026-09-01', 1000), mov('m0', '2026-08-01', 50)];
const copiaAvisos = JSON.stringify(avisosEntrada);
const copiaMovs = JSON.stringify(movsEntrada);
run({ avisos: avisosEntrada, movimientos: movsEntrada });
eq('avisos intactos', JSON.stringify(avisosEntrada), copiaAvisos);
eq('movimientos intactos', JSON.stringify(movsEntrada), copiaMovs);

console.log('\n── Fechas en DD/MM/YYYY también se entienden ──');
const rDMY = run({ fechaEstado: '05/10/2026', avisos: [AVISO_SEP] });
ok_('procede', rDMY.ok);
eq('normaliza a ISO', rDMY.fechaEstado, '2026-10-05');

console.log('\n── Desglose de cargos por concepto ──');
const rDesglose = run({
  avisos: [AVISO_SEP],
  movimientos: [
    mov('m1', '2026-09-01', 1000), mov('m2', '2026-09-05', 500),
    mov('m3', '2026-09-08', 250, 'Abono'),
    { id: 'm4', clave: 'MOVm1', nombre: 'Movimiento m1', naturaleza: 'Cargo', monto: 300, fecha: '2026-09-10' },
  ],
});
const grupos = M.agruparCargosPorConcepto(rDesglose.movimientosPeriodo);
eq('agrupa por clave', grupos.length, 2);
eq('el grupo mayor primero', grupos[0].clave, 'MOVm1');
eq('suma las dos ocurrencias de MOVm1', grupos[0].total, 1300);
eq('y cuenta dos', grupos[0].cantidad, 2);
eq('el abono no entra al desglose', grupos.some(g => g.clave === 'MOVm3'), false);
eq('el total del desglose iguala CargosPeriodo',
   M.money(grupos.reduce((a, g) => a + g.total, 0)), rDesglose.snapshot.cargosPeriodo);

console.log('\n── Placeholders de la plantilla (CA-27) ──');
const datos = M.construirDatosEstadoCuenta(
  r7, { ...LINEA, estatus: 'Activa' },
  { cliente: 'ACME SA', producto: 'TDC Empresarial', usuario: 'Tester' });
eq('estatus de la línea', datos.ESTATUS_LINEA, 'Activa');
eq('id del cliente', datos.CLIENTE_ID, 'CLI-1');
ok_('sin movimientos, el desglose lo dice', /Sin cargos en el periodo/.test(datos.TABLA_DESGLOSE));

// Con movimientos reales: las columnas de la tabla y el total del desglose.
const datosMov = M.construirDatosEstadoCuenta(rDesglose, LINEA, { cliente: 'ACME SA' });
ok_('la tabla de movimientos separa Cargo y Abono',
    /<th[^>]*>Cargo<\/th>/.test(datosMov.TABLA_MOVIMIENTOS) && /<th[^>]*>Abono<\/th>/.test(datosMov.TABLA_MOVIMIENTOS));
ok_('el desglose trae su renglón de TOTAL', /<strong>TOTAL<\/strong>/.test(datosMov.TABLA_DESGLOSE));
ok_('y el total sale con formato', /1,800\.00/.test(datosMov.TABLA_DESGLOSE));
eq('periodo formateado', datos.PERIODO, '16/08/2026 al 15/09/2026');
eq('fecha de corte', datos.FECHA_CORTE, '15/09/2026');
eq('fecha estado', datos.FECHA_ESTADO, '05/10/2026');
ok_('saldo al corte con formato', /\$0\.00/.test(datos.SALDO_AL_CORTE));
ok_('D2 sale con formato de importe', /\$/.test(datos.PAGO_NO_GENERA_INTERESES));
ok_('la tabla de conceptos trae los dos', /Concepto 1/.test(datos.TABLA_CONCEPTOS) && /Concepto 2/.test(datos.TABLA_CONCEPTOS));

console.log('\n── Sustitución de placeholders ──');
const html = M.sustituirPlaceholders(
  '<p>{{CLIENTE}} debe {SALDO_AL_CORTE} el {{FECHA_LIMITE_PAGO}}. {{NO_EXISTE}}</p>', datos);
ok_('sustituye {{ }}', /ACME SA/.test(html));
ok_('sustituye { }', /\$0\.00/.test(html));
ok_('deja intacto lo desconocido', /\{\{NO_EXISTE\}\}/.test(html));

console.log('\n── money(): centavos sin fantasmas ──');
eq('redondea a dos', M.money(0.1 + 0.2), 0.3);
eq('cero seguro', M.money(undefined), 0);


console.log('');
console.log('-- Fecha Estado sugerida = Fecha Limite de Pago + 1 dia --');

eq('suma un dia', M.sumarDias('2026-10-05', 1), '2026-10-06');
eq('cruza fin de mes', M.sumarDias('2026-09-30', 1), '2026-10-01');
eq('cruza fin de anio', M.sumarDias('2026-12-31', 1), '2027-01-01');
eq('anio bisiesto', M.sumarDias('2028-02-28', 1), '2028-02-29');
eq('fecha invalida devuelve vacio', M.sumarDias('', 1), '');

// AVISO_AGO vence 05/09 -> sugiere 06/09. AVISO_SEP vence 05/10 -> 06/10.
eq('toma el limite del corte ya vencido',
   M.fechaEstadoSugerida([AVISO_AGO, AVISO_SEP], '2026-10-18'), '2026-10-06');

// Si el plazo del ultimo corte sigue abierto, manda el periodo anterior.
eq('plazo abierto: usa el corte previo',
   M.fechaEstadoSugerida([AVISO_AGO, AVISO_SEP], '2026-09-20'), '2026-09-06');

// El mismo dia del limite todavia esta en plazo: no se sugiere ese corte.
eq('el dia del limite aun no vence',
   M.fechaEstadoSugerida([AVISO_SEP], '2026-10-05'), '2026-10-05');
eq('al dia siguiente si',
   M.fechaEstadoSugerida([AVISO_SEP], '2026-10-06'), '2026-10-06');

// Sin cortes vencidos se devuelve hoy, para que la pantalla siga usable.
eq('sin avisos devuelve hoy', M.fechaEstadoSugerida([], '2026-10-18'), '2026-10-18');
eq('avisos futuros devuelven hoy',
   M.fechaEstadoSugerida([AVISO_SEP], '2026-09-01'), '2026-09-01');

// Un aviso cancelado no propone fecha.
eq('cancelado se ignora',
   M.fechaEstadoSugerida(
     [aviso('AX', '2026-08-16', '2026-09-15', '2026-10-05', 5000,
            [concepto('x', 1, 5000)], { estatus: 'Cancelada' })],
     '2026-10-18'),
   '2026-10-18');

// La fecha sugerida siempre es valida para generar: nunca futura.
for (const hoyISO of ['2026-09-20', '2026-10-06', '2026-10-18']) {
  const sug = M.fechaEstadoSugerida([AVISO_AGO, AVISO_SEP], hoyISO);
  ok_('sugerida <= hoy (' + hoyISO + ')', sug <= hoyISO);
}

console.log('');
console.log('-- Un aviso RECLASIFICADO no vuelve a contar como Saldo Anterior --');
const avisoReclas = aviso('R1', '2026-07-16', '2026-08-15', '2026-09-05', 12000,
  [concepto('r', 1, 12000, 2000)], { pagoTotal: 2000, saldoPendiente: 10000, estatus: 'Pagado x Reclasificación' });

const rSinDoble = run({ avisos: [avisoReclas, AVISO_SEP] });
eq('no arrastra el saldo ya reinyectado', rSinDoble.snapshot.saldoAnterior, 0);

// El mismo aviso, todavia Parcial, si arrastra.
const avisoParcial = aviso('R2', '2026-07-16', '2026-08-15', '2026-09-05', 12000,
  [concepto('r', 1, 12000, 2000)], { pagoTotal: 2000, saldoPendiente: 10000, estatus: 'Parcial' });
eq('parcial si arrastra', run({ avisos: [avisoParcial, AVISO_SEP] }).snapshot.saldoAnterior, 10000);

// Y el saldo al corte cambia en consecuencia.
eq('saldo al corte sin el doble conteo', rSinDoble.snapshot.saldoAlCorte, 0);

console.log('');
console.log('-- Los pagos de un Aviso RECLASIFICADO no se vuelven a restar --');
// Aviso de 12,000 con 2,000 pagados -> se reclasifico por 10,000 (ya neto).
const avReclas = aviso('X1', '2026-07-16', '2026-08-15', '2026-09-05', 12000,
  [concepto('x', 1, 12000, 2000)], { pagoTotal: 2000, saldoPendiente: 10000, estatus: 'Pagado x Reclasificación' });

const rDoble = run({
  avisos: [avReclas, AVISO_SEP],
  movimientos: [mov('c1', '2026-09-01', 10000)],   // el cargo 023 reinyectado
  pagos: [
    pago('viejo', '2026-08-20', 2000, { idCxC: 'X1' }),   // ya descontado al reclasificar
    pago('nuevo', '2026-10-01', 500,  { idCxC: 'A2' }),   // del periodo vigente
  ],
});
eq('solo cuenta el pago del periodo vigente', rDoble.pagosConsiderados.map(p => p.id), ['nuevo']);
eq('pagos del periodo = 500', rDoble.snapshot.pagosPeriodo, 500);
// 0 (anterior, ya no arrastra) + 10,000 (cargo) - 500 = 9,500
eq('saldo al corte sin doble descuento', rDoble.snapshot.saldoAlCorte, 9500);

// Con el Aviso todavia Parcial, el pago SI cuenta: nada se ha reinyectado.
const avParcial = aviso('X1', '2026-07-16', '2026-08-15', '2026-09-05', 12000,
  [concepto('x', 1, 12000, 2000)], { pagoTotal: 2000, saldoPendiente: 10000, estatus: 'Parcial' });
const rNormal = run({
  avisos: [avParcial, AVISO_SEP],
  pagos: [pago('viejo', '2026-08-20', 2000, { idCxC: 'X1' })],
});
eq('parcial: el pago si cuenta', rNormal.snapshot.pagosPeriodo, 2000);

// Un pago sin idCxC no se puede atribuir: se conserva por prudencia.
const rSinCxC = run({
  avisos: [avReclas, AVISO_SEP],
  pagos: [pago('suelto', '2026-10-01', 300)],
});
eq('pago sin CxC se conserva', rSinCxC.pagosConsiderados.length, 1);
console.log(`\n${pass} aserciones OK, ${fail} fallas`);
process.exit(fail > 0 ? 1 : 0);
