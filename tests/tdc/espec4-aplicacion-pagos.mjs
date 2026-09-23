// Pruebas de la ESPECIFICACIÓN 4 — Aplicación de Pagos.
// Cubre los 20 casos que exige §58.18 más las verificaciones de §58.19/§58.20.
import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const dir = mkdtempSync(join(tmpdir(), 'e4-'));
await build({
  entryPoints: ['src/app/lib/motorAplicacionPagosTDC.ts'],
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
const det = (id, orden, monto, pagoTotal = 0) => ({
  id, ordenPrelacion: orden, monto, pagoTotal,
  claveConcepto: `C${orden}`, nombreConcepto: `Concepto ${orden}`,
});
const cxc = (id, venc, total, detalle, extra = {}) => ({
  id, folio: `CXC-${id}`, idContrato: extra.contrato || 'LIN-001',
  fechaVencimiento: venc, fechaDocumento: extra.fechaDoc || venc,
  montoTotalPagar: total, pagoTotal: extra.pagoTotal || 0,
  estatus: extra.estatus, detalle,
});
const run = (montoPago, documentos, extra = {}) => M.aplicarPago({
  montoPago, saldoEjeAnterior: 0, documentos,
  idCuentaEje: 'EJE-1', idCliente: 'CLI-1', idPagoReferenciado: 'PR-1', ...extra,
});

console.log('\n── §3 Sin Cuenta EJE válida: falla completo ──');
const rSin = run(1000, [], { idCuentaEje: null });
eq('no procede', rSin.ok, false);
eq('mensaje literal de §3', rSin.error,
   'No se encontró una Cuenta EJE válida para el Cliente "CLI-1" asociado al Pago Referenciado "PR-1".');
eq('no deja aplicaciones', rSin.aplicacionesDetalle.length, 0);
eq('saldo EJE intacto', rSin.saldoEjePosterior, rSin.saldoEjeAnterior);

console.log('\n── §47 Monto <= 0 ──');
eq('monto cero se rechaza', run(0, []).ok, false);
eq('monto negativo se rechaza', run(-5, []).ok, false);

console.log('\n── §26 Ejemplo completo: 3,000 sobre dos CxC ──');
const r26 = run(3000, [
  cxc('002', '2026-09-10', 2500, [det('d1', 1, 2500)]),
  cxc('001', '2026-08-10', 2000, [det('d2', 1, 2000)]),
]);
eq('CxC-001 primero (vence antes)', r26.aplicacionesCxC[0].idCxC, '001');
eq('CxC-001 recibe 2,000', r26.aplicacionesCxC[0].montoAplicado, 2000);
eq('CxC-001 queda Pagado', r26.aplicacionesCxC[0].estatusNuevo, 'Pagado');
eq('CxC-002 recibe 1,000', r26.aplicacionesCxC[1].montoAplicado, 1000);
eq('CxC-002 queda Parcial', r26.aplicacionesCxC[1].estatusNuevo, 'Parcial');
eq('total aplicado 3,000', r26.montoTotalAplicado, 3000);
eq('remanente 0', r26.saldoRemanenteEje, 0);

console.log('\n── §27 Prelación dentro de la CxC: 1,000 sobre IVA/Interés/Capital ──');
const r27 = run(1000, [
  cxc('002', '2026-09-10', 2500, [
    det('cap', 3, 1500), det('iva', 1, 300), det('int', 2, 700),
  ]),
]);
eq('orden de aplicación por prelación', r27.aplicacionesDetalle.map(a => a.idDetalle), ['iva', 'int']);
eq('IVA = 300', r27.aplicacionesDetalle[0].montoAplicado, 300);
eq('Interés = 700', r27.aplicacionesDetalle[1].montoAplicado, 700);
eq('IVA Pagado', r27.aplicacionesDetalle[0].estatusPagoNuevo, 'Pagado');
eq('Interés Pagado', r27.aplicacionesDetalle[1].estatusPagoNuevo, 'Pagado');
ok_('Capital no recibe nada', !r27.aplicacionesDetalle.some(a => a.idDetalle === 'cap'));
eq('la CxC queda Parcial', r27.aplicacionesCxC[0].estatusNuevo, 'Parcial');

console.log('\n── §13 Pago parcial de un Detail ──');
const r13 = run(600, [cxc('A', '2026-09-10', 1000, [det('L', 1, 1000)])]);
eq('aplica 600', r13.aplicacionesDetalle[0].montoAplicado, 600);
eq('saldo posterior 400', r13.aplicacionesDetalle[0].saldoPosterior, 400);
eq('estatus Parcial', r13.aplicacionesDetalle[0].estatusPagoNuevo, 'Parcial');

console.log('\n── §14/§28 Segundo pago sobre un Detail Parcial ──');
const r14 = run(500, [cxc('A', '2026-09-10', 1000, [det('L', 1, 1000, 600)], { pagoTotal: 600 })]);
eq('aplica MIN(500,400) = 400', r14.aplicacionesDetalle[0].montoAplicado, 400);
eq('PagoTotal acumulado = 1,000', r14.aplicacionesDetalle[0].pagoTotalNuevo, 1000);
eq('queda Pagado', r14.aplicacionesDetalle[0].estatusPagoNuevo, 'Pagado');
eq('sobran 100 en la EJE', r14.saldoRemanenteEje, 100);
eq('la CxC queda Pagada', r14.aplicacionesCxC[0].estatusNuevo, 'Pagado');

console.log('\n── §28 Una línea Parcial sigue siendo elegible ──');
const r28 = run(900, [cxc('A', '2026-09-10', 1500, [det('cap', 3, 1500, 600)], { pagoTotal: 600 })]);
eq('la línea Parcial recibe pago', r28.aplicacionesDetalle.length, 1);
eq('se liquida', r28.aplicacionesDetalle[0].saldoPosterior, 0);

console.log('\n── §12 Nunca se aplica más que el saldo de la línea ──');
const r12 = run(99999, [cxc('A', '2026-09-10', 1000, [det('L', 1, 1000)])]);
eq('aplica sólo 1,000', r12.montoTotalAplicado, 1000);
eq('PagoTotal no rebasa el Monto', r12.aplicacionesDetalle[0].pagoTotalNuevo, 1000);
eq('el resto queda en la EJE', r12.saldoRemanenteEje, 98999);

console.log('\n── §7.1 Dos CxC con la misma FechaVencimiento ──');
const rEmp = run(100, [
  cxc('B', '2026-09-10', 500, [det('b', 1, 500)], { fechaDoc: '2026-08-25' }),
  cxc('A', '2026-09-10', 500, [det('a', 1, 500)], { fechaDoc: '2026-08-20' }),
]);
eq('desempata por FechaDocumento ASC', rEmp.aplicacionesCxC[0].idCxC, 'A');

const rEmp2 = run(100, [
  cxc('Z', '2026-09-10', 500, [det('z', 1, 500)], { fechaDoc: '2026-08-20' }),
  cxc('A', '2026-09-10', 500, [det('a', 1, 500)], { fechaDoc: '2026-08-20' }),
]);
eq('desempata por IdCxC ASC', rEmp2.aplicacionesCxC[0].idCxC, 'A');

console.log('\n── §57 Desempate de detalle por IdDetalle ──');
const rDet = run(100, [cxc('A', '2026-09-10', 400, [det('zz', 1, 200), det('aa', 1, 200)])]);
eq('mismo orden → IdDetalle ASC', rDet.aplicacionesDetalle[0].idDetalle, 'aa');

console.log('\n── §25 Aplicar hasta donde alcance ──');
const r25 = run(50, [cxc('A', '2026-09-10', 5000, [det('L', 1, 5000)])]);
eq('aplica 50 sin exigir liquidar', r25.montoTotalAplicado, 50);
eq('la CxC queda Parcial', r25.aplicacionesCxC[0].estatusNuevo, 'Parcial');

console.log('\n── §30/§33 Remanente: pago 10,000 contra 8,500 ──');
const r30 = run(10000, [
  cxc('A', '2026-08-10', 6000, [det('a', 1, 6000)], { contrato: 'LIN-10001' }),
  cxc('B', '2026-09-10', 2500, [det('b', 1, 2500)], { contrato: 'CRE-20003' }),
]);
eq('aplicado 8,500', r30.montoTotalAplicado, 8500);
eq('remanente 1,500', r30.saldoRemanenteEje, 1500);
eq('el cargo a la EJE es lo aplicado, no el pago', r30.montoTotalAplicado === 8500 && r30.montoPagoRecibido === 10000, true);

console.log('\n── §36/§38/§39 Varios contratos ──');
eq('dos contratos afectados', r30.contratosAfectados, 2);
eq('distribución real por contrato', r30.abonosPorContrato,
   [{ idContrato: 'CRE-20003', monto: 2500, montoLibera: 2500 }, { idContrato: 'LIN-10001', monto: 6000, montoLibera: 6000 }]);
eq('la suma de abonos = total aplicado',
   r30.abonosPorContrato.reduce((a, x) => a + x.monto, 0), r30.montoTotalAplicado);

console.log('\n── §53 Cliente sin CxC pendientes ──');
const r53 = run(5000, []);
eq('procede sin error', r53.ok, true);
eq('no aplica nada', r53.montoTotalAplicado, 0);
eq('todo queda en la EJE', r53.saldoRemanenteEje, 5000);
eq('sin abonos a contrato', r53.abonosPorContrato.length, 0);
eq('sin CxC afectadas', r53.cxcAfectadas, 0);

console.log('\n── §6 Una CxC ya Pagada no se toca ──');
const r6 = run(1000, [
  cxc('P', '2026-08-01', 500, [det('p', 1, 500, 500)], { estatus: 'Pagado', pagoTotal: 500 }),
  cxc('Q', '2026-09-01', 800, [det('q', 1, 800)]),
]);
eq('sólo se afecta la pendiente', r6.aplicacionesCxC.map(a => a.idCxC), ['Q']);

console.log('\n── §43/§44 El remanente previo vuelve a participar ──');
const rRem = M.aplicarPago({
  montoPago: 500, saldoEjeAnterior: 1500,
  documentos: [cxc('A', '2026-09-10', 2000, [det('a', 1, 2000)])],
  idCuentaEje: 'EJE-1', idCliente: 'CLI-1', idPagoReferenciado: 'PR-2',
});
eq('disponible = saldo previo + pago', rRem.montoDisponibleInicial, 2000);
eq('liquida usando el remanente anterior', rRem.montoTotalAplicado, 2000);
eq('la CxC queda Pagada', rRem.aplicacionesCxC[0].estatusNuevo, 'Pagado');

console.log('\n── §42 Estatus del Pago Referenciado ──');
eq('aplicado totalmente', run(1000, [cxc('A', '2026-09-10', 1000, [det('a', 1, 1000)])]).estatusPagoReferenciado, 'Aplicado');
eq('aplicado parcialmente', run(1000, [cxc('A', '2026-09-10', 400, [det('a', 1, 400)])]).estatusPagoReferenciado, 'Aplicado Parcialmente');
eq('sin aplicar', run(1000, []).estatusPagoReferenciado, 'Pendiente de Aplicación');
// El remanente de un pago anterior no vuelve "total" a este pago
const rParcialRem = M.aplicarPago({
  montoPago: 1000, saldoEjeAnterior: 5000,
  documentos: [cxc('A', '2026-09-10', 300, [det('a', 1, 300)])],
  idCuentaEje: 'EJE-1',
});
eq('se mide contra el pago recibido, no contra el disponible',
   rParcialRem.estatusPagoReferenciado, 'Aplicado Parcialmente');

console.log('\n── §48 Header = SUM(Detalle) ──');
const r48 = run(2000, [cxc('A', '2026-09-10', 3000, [det('a', 1, 500), det('b', 2, 900), det('c', 3, 1600)])]);
const sumaDet48 = r48.aplicacionesDetalle.reduce((a, x) => a + x.montoAplicado, 0);
eq('el header cuadra con su detalle', r48.aplicacionesCxC[0].montoAplicado, sumaDet48);
eq('sin descuadres', r48.descuadres, []);

console.log('\n── §49/§58.20 Todas las igualdades cuadran ──');
for (const [nombre, r] of [['ejemplo §26', r26], ['multi-contrato §30', r30], ['parcial §48', r48]]) {
  const sd = r.aplicacionesDetalle.reduce((a, x) => a + x.montoAplicado, 0);
  const sc = r.aplicacionesCxC.reduce((a, x) => a + x.montoAplicado, 0);
  const sk = r.abonosPorContrato.reduce((a, x) => a + x.monto, 0);
  eq(`${nombre}: SUM(detalle) = total`, M.money(sd), r.montoTotalAplicado);
  eq(`${nombre}: SUM(CxC) = total`, M.money(sc), r.montoTotalAplicado);
  eq(`${nombre}: SUM(contratos) = total`, M.money(sk), r.montoTotalAplicado);
  eq(`${nombre}: sin descuadres`, r.descuadres, []);
}

console.log('\n── §29 Nunca se aplica más de lo disponible ──');
for (const [n, r] of [['§26', r26], ['§30', r30], ['§12', r12], ['§53', r53]]) {
  ok_(`${n}: aplicado <= disponible`, r.montoTotalAplicado <= r.montoDisponibleInicial);
}

console.log('\n── §32 El saldo de la EJE baja exactamente por lo aplicado ──');
eq('saldo posterior = disponible - aplicado', r30.saldoEjePosterior,
   M.money(r30.montoDisponibleInicial - r30.montoTotalAplicado));

console.log('\n── Centavos: no queda saldo fantasma ──');
const rCent = run(0.3, [cxc('A', '2026-09-10', 0.3, [det('a', 1, 0.1), det('b', 2, 0.2)])]);
eq('liquida los 0.30 exactos', rCent.montoTotalAplicado, 0.3);
eq('la CxC queda Pagada', rCent.aplicacionesCxC[0].estatusNuevo, 'Pagado');
eq('sin remanente fantasma', rCent.saldoRemanenteEje, 0);


console.log('');
console.log('-- 40 LIBERA LINEA CUANDO SE PAGA (Afectacion de la Linea) --');

// Producto: C1 libera linea; C2 no.
const AFECT = [
  { clave: 'C1', liberaLineaAlPagar: 'S', consumeLineaDisponible: 'S' },
  { clave: 'C2', liberaLineaAlPagar: 'N', consumeLineaDisponible: 'N' },
];
const docMixto = () => cxc('MX', '2026-09-10', 3000, [det('d1', 1, 2000), det('d2', 2, 1000)]);

const rSinCfg = run(3000, [docMixto()]);
eq('sin configuracion, todo libera (comportamiento previo)', rSinCfg.montoTotalLiberaLinea, 3000);
eq('y el abono lo refleja', rSinCfg.abonosPorContrato[0].montoLibera, 3000);

const rConCfg = run(3000, [docMixto()], { afectacionLinea: AFECT });
eq('se aplican los 3,000 completos', rConCfg.montoTotalAplicado, 3000);
eq('pero solo C1 libera linea', rConCfg.montoTotalLiberaLinea, 2000);
eq('el abono separa la parte liberadora', rConCfg.abonosPorContrato[0].montoLibera, 2000);
eq('el abono total no cambia', rConCfg.abonosPorContrato[0].monto, 3000);
eq('C1 marcado como liberador', rConCfg.aplicacionesDetalle.find(a => a.claveConcepto === 'C1').liberaLinea, true);
eq('C2 marcado como NO liberador', rConCfg.aplicacionesDetalle.find(a => a.claveConcepto === 'C2').liberaLinea, false);
eq('sin descuadres', rConCfg.descuadres, []);

console.log('');
console.log('-- 40 Pago parcial: libera solo lo aplicado del concepto liberador --');
const rParcial = run(1200, [docMixto()], { afectacionLinea: AFECT });
eq('se aplican 1,200 a C1 (prelacion)', rParcial.montoTotalAplicado, 1200);
eq('los 1,200 liberan, porque C1 libera', rParcial.montoTotalLiberaLinea, 1200);

console.log('');
console.log('-- 40 Si solo alcanza para el concepto que NO libera --');
const rNoLibera = run(500, [cxc('NL', '2026-09-10', 500, [det('d9', 1, 500)])], {
  afectacionLinea: [{ clave: 'C1', liberaLineaAlPagar: 'N' }],
});
eq('se aplica todo', rNoLibera.montoTotalAplicado, 500);
eq('pero no libera nada', rNoLibera.montoTotalLiberaLinea, 0);
eq('el abono liberador es cero', rNoLibera.abonosPorContrato[0].montoLibera, 0);

console.log('');
console.log('-- 40 Concepto ausente de la configuracion: no libera y se reporta --');
const rAusente = run(3000, [docMixto()], {
  afectacionLinea: [{ clave: 'C1', liberaLineaAlPagar: 'S' }],
});
eq('C1 si libera', rAusente.montoTotalLiberaLinea, 2000);
eq('C2 se reporta como no configurado', rAusente.conceptosSinAfectacion, ['C2']);

console.log('');
console.log('-- 40 La clave se compara sin distinguir mayusculas ni espacios --');
const rCase = run(3000, [docMixto()], {
  afectacionLinea: [{ clave: ' c1 ', liberaLineaAlPagar: 'S' }, { clave: 'C2', liberaLineaAlPagar: 'N' }],
});
eq('reconoce " c1 " como C1', rCase.montoTotalLiberaLinea, 2000);
eq('y no reporta faltantes', rCase.conceptosSinAfectacion, []);

console.log('');
console.log('-- 40 Lo que libera nunca excede lo aplicado --');
for (const [n, r] of [['mixto', rConCfg], ['parcial', rParcial], ['sin config', rSinCfg]]) {
  ok_(n + ': libera <= aplicado', r.montoTotalLiberaLinea <= r.montoTotalAplicado);
}

console.log(`\n${pass} aserciones OK, ${fail} fallas`);
process.exit(fail > 0 ? 1 : 0);
