// Pruebas de la ESPECIFICACIÓN 5 — Eventos contables y pólizas.
// Cubre §87 (activación), §88 (corte), §89 (pagos), §90 (reclasificación)
// y §91, el ciclo completo end-to-end.
import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const dir = mkdtempSync(join(tmpdir(), 'e5-'));
await build({
  entryPoints: ['src/app/lib/motorContableTDC.ts'],
  outfile: join(dir, 'm.mjs'), format: 'esm', bundle: true, logLevel: 'error',
});
const M = await import(pathToFileURL(join(dir, 'm.mjs')).href);

let pass = 0, fail = 0;
const eq = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`  FALLA ${n}\n    esperado: ${JSON.stringify(want)}\n    obtenido: ${JSON.stringify(got)}`); }
};
const ok_ = (n, g) => { if (g) pass++; else { fail++; console.log(`  FALLA ${n}`); } };

// ── Guía Contabilizadora de prueba ──
// Las cuentas son inventadas A PROPÓSITO y viven sólo aquí: el motor no debe
// conocer ninguna. Si el motor tuviera una cuenta hardcodeada, estas pruebas
// seguirían pasando pero el §3 estaría roto — por eso también se prueba que
// cambiar la guía cambie las cuentas del asiento.
const cta = (id, gl, nombre) => ({ id, cuenta_gl: gl, nombre });
const fila = (evCodigo, evNombre, compCodigo, compNombre, glD, glH, extra = {}) => ({
  id: `G-${evCodigo}-${compCodigo}`,
  evento: { id: `E-${evCodigo}`, codigo: evCodigo, evento: evNombre },
  componente: { id: `C-${compCodigo}`, codigo: compCodigo, nombre: compNombre },
  debito: cta(`D-${glD}`, glD, `Cuenta ${glD}`),
  credito: cta(`H-${glH}`, glH, `Cuenta ${glH}`),
  ...extra,
});

const GUIA = [
  // ACTIVACIÓN_LINEA — cuentas de orden (§13)
  fila('ACTIVACION_LINEA', 'Activación de Línea', 'LINEA_AUTORIZADA', 'Línea autorizada', '7101-001', '7102-001'),
  // CORTE_PERIODO — un renglón por componente (§21, §22)
  fila('CORTE_PERIODO', 'Corte de Periodo', 'CAPITAL', 'Capital', '1101-001', '1301-001'),
  fila('CORTE_PERIODO', 'Corte de Periodo', 'INTERES_ORDINARIO', 'Interés ordinario', '1101-002', '4101-001'),
  fila('CORTE_PERIODO', 'Corte de Periodo', 'IVA_INTERES', 'IVA interés', '1101-003', '2101-001'),
  fila('CORTE_PERIODO', 'Corte de Periodo', 'COMISION', 'Comisión', '1101-004', '4102-001'),
  fila('CORTE_PERIODO', 'Corte de Periodo', 'IVA_COMISION', 'IVA comisión', '1101-005', '2101-002'),
  // §46 — SALDO_ANTERIOR descarga la cuenta puente, no reconoce ingreso nuevo
  fila('CORTE_PERIODO', 'Corte de Periodo', 'SALDO_ANTERIOR', 'Saldo anterior', '1101-006', '1999-001'),
  // APLICACIÓN_PAGOS
  fila('APLICACION_PAGOS', 'Aplicación de Pagos', 'CAPITAL', 'Capital', '1102-001', '1101-001'),
  fila('APLICACION_PAGOS', 'Aplicación de Pagos', 'INTERES_ORDINARIO', 'Interés ordinario', '1102-001', '1101-002'),
  fila('APLICACION_PAGOS', 'Aplicación de Pagos', 'IVA_INTERES', 'IVA interés', '1102-001', '1101-003'),
  // RECLASIFICACIÓN_SALDO — todo va a la cuenta puente (§45)
  fila('RECLASIFICACION_SALDO', 'Reclasificación de Saldo', 'CAPITAL', 'Capital', '1999-001', '1101-001'),
  fila('RECLASIFICACION_SALDO', 'Reclasificación de Saldo', 'INTERES_ORDINARIO', 'Interés ordinario', '1999-001', '1101-002'),
  fila('RECLASIFICACION_SALDO', 'Reclasificación de Saldo', 'IVA_INTERES', 'IVA interés', '1999-001', '1101-003'),
];

const corre = (claveEvento, componentes, extra = {}) => M.contabilizarEvento({
  guia: GUIA, claveEvento, componentes, fechaContable: '2026-09-20',
  claveProducto: '010', nombreProducto: 'Tarjeta de Crédito', ...extra,
});

// ═══════════════════════ §87 — ACTIVACIÓN ═══════════════════════
console.log('\n── §87 ACTIVACIÓN_LINEA ──');
const act = corre(M.EVENTOS.ACTIVACION_LINEA, M.componentesDeActivacion(100000));
eq('activación normal procede', act.ok, true);
eq('dos renglones (§13 partida y contrapartida)', act.partidas.length, 2);
eq('cuenta de orden deudora al DEBE', act.partidas[0].cuentaContableGl, '7101-001');
eq('contracuenta de orden al HABER', act.partidas[1].cuentaContableGl, '7102-001');
eq('monto = límite autorizado (§12)', act.partidas[0].debe, 100000);
eq('cuadrada', act.cuadrada, true);
eq('Debe = Haber', [act.totalDebe, act.totalHaber], [100000, 100000]);

console.log('\n── §87 Monto aprobado cero ──');
const act0 = corre(M.EVENTOS.ACTIVACION_LINEA, M.componentesDeActivacion(0));
eq('no procede', act0.ok, false);
eq('no deja partidas', act0.partidas.length, 0);

console.log('\n-- 5.1 Idempotencia: Evento + IdLineaCredito + IdOperacionOrigen --');
// La misma linea produce SIEMPRE la misma clave: reintentar no crea una segunda
// poliza. El candado real es el indice unico del RPC sobre esta clave.
const k1 = M.claveIdempotencia(M.EVENTOS.ACTIVACION_LINEA, 'LC-0001');
const k2 = M.claveIdempotencia(M.EVENTOS.ACTIVACION_LINEA, 'LC-0001');
eq('clave estable entre ejecuciones', k1, k2);
eq('clave esperada', k1, 'ACTIVACION_LINEA|LC-0001|');
ok_('dos lineas distintas dan claves distintas',
    M.claveIdempotencia(M.EVENTOS.ACTIVACION_LINEA, 'LC-0002') !== k1);
ok_('el mismo id bajo otro evento no colisiona',
    M.claveIdempotencia(M.EVENTOS.CORTE_PERIODO, 'LC-0001') !== k1);

console.log('\n-- 5.1 El monto es el APROBADO, no el dispuesto --');
// MONTO CONTABLE: no usar saldo dispuesto / utilizado / disponible.
const aprob = corre(M.EVENTOS.ACTIVACION_LINEA, M.componentesDeActivacion(100000));
eq('ambas partidas por el monto aprobado integro',
   [aprob.partidas[0].debe, aprob.partidas[1].haber], [100000, 100000]);
eq('el contingente reconocido es el total', aprob.montoContabilizado, 100000);

console.log('\n-- 5.1 El componente de activacion es configurable --');
// El requerimiento dice "podra utilizar un componente SIMILAR a
// LINEA_AUTORIZADA": el nombre no se impone desde el codigo.
const guiaOtroComp = [fila('ACTIVACION_LINEA', 'Activacion de Linea', 'CONTINGENTE_TDC', 'Contingente', '7201-001', '7202-001')];
const otroComp = M.contabilizarEvento({
  guia: guiaOtroComp, claveEvento: M.EVENTOS.ACTIVACION_LINEA,
  componentes: M.componentesDeActivacion(50000, 'CONTINGENTE_TDC'),
  fechaContable: '2026-09-20',
});
eq('procede con otro componente configurado', otroComp.ok, true);
eq('usa las cuentas de ESE componente',
   otroComp.partidas.map(p => p.cuentaContableGl), ['7201-001', '7202-001']);

console.log('\n── §61 Configuración inexistente ──');
const sinGuia = M.contabilizarEvento({
  guia: [], claveEvento: M.EVENTOS.ACTIVACION_LINEA,
  componentes: M.componentesDeActivacion(1000), fechaContable: '2026-09-20',
  claveProducto: '010', nombreProducto: 'Tarjeta de Crédito',
});
eq('aborta', sinGuia.ok, false);
ok_('el mensaje nombra producto y evento', sinGuia.error.includes('010 Tarjeta de Crédito') && sinGuia.error.includes('ACTIVACION_LINEA'));
eq('paso fallido', sinGuia.pasoFallido, '§61 — configuración inexistente');

console.log('\n── §61 Componente sin configuración ──');
const compRaro = corre(M.EVENTOS.CORTE_PERIODO, [{ clave: 'ANUALIDAD', nombre: 'Anualidad', monto: 500 }]);
eq('aborta', compRaro.ok, false);
ok_('el mensaje nombra el componente', compRaro.error.includes('ANUALIDAD'));
eq('no deja partidas parciales', compRaro.partidas.length, 0);

console.log('\n── §62 Componente sin cuenta ──');
const guiaCoja = [{ ...fila('CORTE_PERIODO', 'Corte de Periodo', 'CAPITAL', 'Capital', '1101-001', '1301-001'), credito: {} }];
const sinCta = M.contabilizarEvento({
  guia: guiaCoja, claveEvento: M.EVENTOS.CORTE_PERIODO,
  componentes: [{ clave: 'CAPITAL', monto: 100 }], fechaContable: '2026-09-20',
});
eq('aborta', sinCta.ok, false);
eq('paso fallido', sinCta.pasoFallido, '§62 — componente sin cuenta');

// ═══════════════════════ §88 — CORTE ═══════════════════════
console.log('\n── §88/§23 CxC con varios Details ──');
const detalleCxC = [
  { id: 'd1', claveConcepto: 'CAPITAL', nombreConcepto: 'Capital', monto: 8000 },
  { id: 'd2', claveConcepto: 'INTERES_ORDINARIO', nombreConcepto: 'Interés', monto: 500 },
  { id: 'd3', claveConcepto: 'IVA_INTERES', nombreConcepto: 'IVA interés', monto: 80 },
  { id: 'd4', claveConcepto: 'COMISION', nombreConcepto: 'Comisión', monto: 250 },
  { id: 'd5', claveConcepto: 'IVA_COMISION', nombreConcepto: 'IVA comisión', monto: 40 },
];
const compCorte = M.componentesDeCorte(detalleCxC, 8870);
eq('sin error de consistencia', compCorte.error, undefined);
eq('cinco componentes (§23)', compCorte.componentes.length, 5);

const corte = corre(M.EVENTOS.CORTE_PERIODO, compCorte.componentes, { idDocumentoOrigen: 'CXC-1' });
eq('procede', corte.ok, true);
eq('10 renglones: 5 componentes × 2', corte.partidas.length, 10);
eq('total contabilizado = 8,870', corte.montoContabilizado, 8870);
eq('Debe = Haber = 8,870', [corte.totalDebe, corte.totalHaber], [8870, 8870]);
eq('cada componente a SU cuenta (§22)',
   corte.partidas.filter(p => p.debe > 0).map(p => p.cuentaContableGl),
   ['1101-001', '1101-002', '1101-003', '1101-004', '1101-005']);
ok_('cada partida conserva el detalle origen (§56)',
    corte.partidas.every(p => ['d1','d2','d3','d4','d5'].includes(p.idDetalleOrigen)));
ok_('cada partida guarda la regla que la generó (§64)', corte.partidas.every(p => !!p.idGuia));

console.log('\n── §88 CxC con un solo Detail ──');
const corte1 = corre(M.EVENTOS.CORTE_PERIODO,
  M.componentesDeCorte([{ id: 'x', claveConcepto: 'CAPITAL', monto: 1000 }], 1000).componentes);
eq('dos renglones', corte1.partidas.length, 2);
eq('cuadrada', corte1.cuadrada, true);

console.log('\n── §24 Total de Details distinto del Header ──');
const inconsistente = M.componentesDeCorte(detalleCxC, 9999);
ok_('se detecta', !!inconsistente.error);
eq('no entrega componentes', inconsistente.componentes.length, 0);

console.log('\n── §7 Un componente con N renglones ──');
const guiaDoble = [
  fila('CORTE_PERIODO', 'Corte de Periodo', 'CAPITAL', 'Capital', '1101-001', '1301-001'),
  { ...fila('CORTE_PERIODO', 'Corte de Periodo', 'CAPITAL', 'Capital', '8101-001', '8102-001'), id: 'G-2' },
];
const nRenglones = M.contabilizarEvento({
  guia: guiaDoble, claveEvento: M.EVENTOS.CORTE_PERIODO,
  componentes: [{ clave: 'CAPITAL', monto: 1000 }], fechaContable: '2026-09-20',
});
eq('4 renglones, no 2 (§7)', nRenglones.partidas.length, 4);
eq('sigue cuadrada', [nRenglones.totalDebe, nRenglones.totalHaber], [2000, 2000]);

console.log('\n── §3 Las cuentas salen de la guía, no del código ──');
const guiaOtra = [fila('CORTE_PERIODO', 'Corte de Periodo', 'CAPITAL', 'Capital', '9999-999', '8888-888')];
const otraCta = M.contabilizarEvento({
  guia: guiaOtra, claveEvento: M.EVENTOS.CORTE_PERIODO,
  componentes: [{ clave: 'CAPITAL', monto: 500 }], fechaContable: '2026-09-20',
});
eq('cambiar la guía cambia el asiento', otraCta.partidas.map(p => p.cuentaContableGl), ['9999-999', '8888-888']);

console.log('\n── §63 Vigencia de la guía ──');
const guiaVencida = [fila('CORTE_PERIODO', 'Corte de Periodo', 'CAPITAL', 'Capital', '1101-001', '1301-001',
  { fechaInicioVigencia: '2025-01-01', fechaFinVigencia: '2025-12-31' })];
const fueraVigencia = M.contabilizarEvento({
  guia: guiaVencida, claveEvento: M.EVENTOS.CORTE_PERIODO,
  componentes: [{ clave: 'CAPITAL', monto: 100 }], fechaContable: '2026-09-20',
});
eq('la guía vencida no aplica', fueraVigencia.ok, false);
const dentroVigencia = M.contabilizarEvento({
  guia: guiaVencida, claveEvento: M.EVENTOS.CORTE_PERIODO,
  componentes: [{ clave: 'CAPITAL', monto: 100 }], fechaContable: '2025-06-15',
});
eq('a una fecha dentro de vigencia sí aplica (§63)', dentroVigencia.ok, true);
eq('una fila inactiva se ignora',
   M.filasVigentes([{ activo: false }], '2026-09-20').length, 0);

// ═══════════════════════ §89 — PAGOS ═══════════════════════
console.log('\n── §30 Sólo se contabiliza lo REALMENTE aplicado ──');
// CxC: IVA 300, Interés 700, Capital 1500. Pago 1,000 → IVA 300 + Interés 700.
const aplic = M.componentesDeAplicacionPagos([
  { id: 'a1', idCxC: 'CXC-1', claveConcepto: 'IVA_INTERES', montoAplicado: 300 },
  { id: 'a2', idCxC: 'CXC-1', claveConcepto: 'INTERES_ORDINARIO', montoAplicado: 700 },
]);
const pago = corre(M.EVENTOS.APLICACION_PAGOS, aplic, { idDocumentoOrigen: 'PROC-1' });
eq('contabiliza 1,000', pago.montoContabilizado, 1000);
ok_('NO contabiliza el capital no pagado (§30)',
    !pago.partidas.some(p => p.claveComponente === 'CAPITAL'));
eq('cuadrada', [pago.totalDebe, pago.totalHaber], [1000, 1000]);

console.log('\n── §28/§93.12 El monto del pago referenciado no es el monto contable ──');
// Pago de 10,000 del que sólo se aplicaron 1,000: se contabilizan 1,000.
ok_('el motor sólo ve las aplicaciones, nunca el pago', pago.montoContabilizado === 1000);

console.log('\n── §31 Pagos parciales: cada uno por su importe ──');
const p1 = corre(M.EVENTOS.APLICACION_PAGOS, M.componentesDeAplicacionPagos([{ id: 'x1', claveConcepto: 'CAPITAL', montoAplicado: 300 }]));
const p2 = corre(M.EVENTOS.APLICACION_PAGOS, M.componentesDeAplicacionPagos([{ id: 'x2', claveConcepto: 'CAPITAL', montoAplicado: 400 }]));
const p3 = corre(M.EVENTOS.APLICACION_PAGOS, M.componentesDeAplicacionPagos([{ id: 'x3', claveConcepto: 'CAPITAL', montoAplicado: 300 }]));
eq('evento 1 = 300', p1.montoContabilizado, 300);
eq('evento 2 = 400', p2.montoContabilizado, 400);
eq('evento 3 = 300', p3.montoContabilizado, 300);
eq('suma = el monto de la línea, sin repetir', p1.montoContabilizado + p2.montoContabilizado + p3.montoContabilizado, 1000);
eq('cada póliza lleva su propia aplicación origen (§32)',
   [p1, p2, p3].map(p => p.partidas[0].idDetalleOrigen), ['x1', 'x2', 'x3']);

console.log('\n── §89 Varias CxC en un mismo proceso (§33) ──');
const multi = corre(M.EVENTOS.APLICACION_PAGOS, M.componentesDeAplicacionPagos([
  { id: 'm1', idCxC: 'CXC-1', claveConcepto: 'CAPITAL', montoAplicado: 500 },
  { id: 'm2', idCxC: 'CXC-2', claveConcepto: 'INTERES_ORDINARIO', montoAplicado: 300 },
]), { idDocumentoOrigen: 'PROC-9' });
eq('una sola póliza con varias CxC', multi.partidas.length, 4);
eq('total 800', multi.montoContabilizado, 800);
eq('cada partida referencia su CxC (§34)',
   [...new Set(multi.partidas.map(p => p.referencia))].sort(), ['CXC-1', 'CXC-2']);

console.log('\n── §35 El total contabilizado = suma de aplicaciones ──');
eq('cuadra con las aplicaciones', multi.montoContabilizado, 500 + 300);

// ═══════════════════════ §90 — RECLASIFICACIÓN ═══════════════════════
console.log('\n── §36/§40 Composición del saldo reclasificado ──');
// CxC 10,000; pagado 7,500; saldo 2,500 con su composición.
const detalleParcial = [
  { id: 'r1', claveConcepto: 'CAPITAL', nombreConcepto: 'Capital', monto: 8000, pagoTotal: 6200 },
  { id: 'r2', claveConcepto: 'INTERES_ORDINARIO', nombreConcepto: 'Interés', monto: 1500, pagoTotal: 1100 },
  { id: 'r3', claveConcepto: 'IVA_INTERES', nombreConcepto: 'IVA interés', monto: 500, pagoTotal: 200 },
];
const rec = M.componentesDeReclasificacion(detalleParcial, 2500, { CAPITAL: 5, INTERES_ORDINARIO: 3, IVA_INTERES: 1 });
eq('sin error', rec.error, undefined);
eq('saldo total 2,500', rec.saldoTotal, 2500);
eq('composición de tres conceptos (§40)', rec.composicion.length, 3);
eq('saldo por concepto', rec.composicion.map(c => c.saldoReclasificado), [1800, 400, 300]);
eq('suma de la composición = el cargo (§72)',
   rec.composicion.reduce((a, c) => a + c.saldoReclasificado, 0), 2500);
eq('conserva el orden de prelación origen (§41)',
   rec.composicion.map(c => c.ordenPrelacionOrigen), [5, 3, 1]);
ok_('conserva monto original y pagado (§41)',
    rec.composicion[0].montoOriginal === 8000 && rec.composicion[0].montoPagado === 6200);

console.log('\n── §39/§72 El saldo calculado debe cuadrar con el del documento ──');
const recMal = M.componentesDeReclasificacion(detalleParcial, 9999);
ok_('se detecta el descuadre', !!recMal.error);
eq('no entrega composición', recMal.composicion.length, 0);

console.log('\n── §90 CxC totalmente pagada: nada que reclasificar ──');
const recPagada = M.componentesDeReclasificacion(
  [{ id: 'q', claveConcepto: 'CAPITAL', monto: 1000, pagoTotal: 1000 }], 0);
ok_('se rechaza', !!recPagada.error);

console.log('\n── §90 CxC sin pagos: se reclasifica completa ──');
const recSinPago = M.componentesDeReclasificacion(
  [{ id: 's', claveConcepto: 'CAPITAL', monto: 1000 }], 1000);
eq('saldo = monto completo', recSinPago.saldoTotal, 1000);

console.log('\n── §45 La póliza de reclasificación va a la cuenta puente ──');
const polizaRec = corre(M.EVENTOS.RECLASIFICACION_SALDO, rec.componentes, { idDocumentoOrigen: 'CXC-1' });
eq('procede', polizaRec.ok, true);
eq('contabiliza 2,500', polizaRec.montoContabilizado, 2500);
eq('cuadrada', [polizaRec.totalDebe, polizaRec.totalHaber], [2500, 2500]);
eq('todo el DEBE a la cuenta puente (§45)',
   [...new Set(polizaRec.partidas.filter(p => p.debe > 0).map(p => p.cuentaContableGl))], ['1999-001']);
eq('el HABER descarga las cuentas originales',
   polizaRec.partidas.filter(p => p.haber > 0).map(p => p.cuentaContableGl),
   ['1101-001', '1101-002', '1101-003']);

console.log('\n── §44/§46 El Saldo Anterior NO reconoce ingreso nuevo ──');
const corteSaldoAnt = corre(M.EVENTOS.CORTE_PERIODO,
  [{ clave: 'SALDO_ANTERIOR', nombre: 'Saldo anterior', monto: 2500 }], { idDocumentoOrigen: 'CXC-2' });
eq('procede', corteSaldoAnt.ok, true);
eq('su contrapartida es la cuenta puente, no una de ingreso (§46)',
   corteSaldoAnt.partidas.find(p => p.haber > 0).cuentaContableGl, '1999-001');
ok_('no toca cuentas de ingreso (4xxx)',
    !corteSaldoAnt.partidas.some(p => p.cuentaContableGl.startsWith('4')));

console.log('\n── §53 Clave lógica de idempotencia ──');
eq('CORTE_PERIODO por IdCxC', M.claveIdempotencia(M.EVENTOS.CORTE_PERIODO, 'CXC-1'), 'CORTE_PERIODO|CXC-1|');
eq('APLICACIÓN por IdAplicacionPagoDetail',
   M.claveIdempotencia(M.EVENTOS.APLICACION_PAGOS, 'PROC-1', 'a1'), 'APLICACION_PAGOS|PROC-1|a1');
ok_('dos detalles distintos dan claves distintas',
    M.claveIdempotencia(M.EVENTOS.APLICACION_PAGOS, 'PROC-1', 'a1') !==
    M.claveIdempotencia(M.EVENTOS.APLICACION_PAGOS, 'PROC-1', 'a2'));

// ═══════════════════════ §91 — CICLO COMPLETO ═══════════════════════
console.log('\n── §91 Ciclo completo: activación → corte → pago → reclasificación → nuevo corte ──');
// Cuentas de ingreso reconocidas en cada paso, para el invariante final.
const ingresoDe = (p) => p.partidas
  .filter(x => x.haber > 0 && x.cuentaContableGl.startsWith('4'))
  .reduce((a, x) => a + x.haber, 0);

// 1-2. Activar línea por 100,000
const c1 = corre(M.EVENTOS.ACTIVACION_LINEA, M.componentesDeActivacion(100000));
eq('1. activación cuadrada', c1.cuadrada, true);

// 3-5. Corte: CxC por 10,000
const detCiclo = [
  { id: 'c-cap', claveConcepto: 'CAPITAL', monto: 8000 },
  { id: 'c-int', claveConcepto: 'INTERES_ORDINARIO', monto: 1500 },
  { id: 'c-iva', claveConcepto: 'IVA_INTERES', monto: 500 },
];
const c2 = corre(M.EVENTOS.CORTE_PERIODO, M.componentesDeCorte(detCiclo, 10000).componentes, { idDocumentoOrigen: 'CXC-A' });
eq('4-5. CxC por 10,000 contabilizada', c2.montoContabilizado, 10000);
const ingresoCorte = ingresoDe(c2);
eq('el corte reconoce 1,500 de ingreso (interés)', ingresoCorte, 1500);

// 6-9. Pago de 7,000 aplicado por prelación: IVA 500, Interés 1,500, Capital 5,000
const c3 = corre(M.EVENTOS.APLICACION_PAGOS, M.componentesDeAplicacionPagos([
  { id: 'ap1', idCxC: 'CXC-A', claveConcepto: 'IVA_INTERES', montoAplicado: 500 },
  { id: 'ap2', idCxC: 'CXC-A', claveConcepto: 'INTERES_ORDINARIO', montoAplicado: 1500 },
  { id: 'ap3', idCxC: 'CXC-A', claveConcepto: 'CAPITAL', montoAplicado: 5000 },
]), { idDocumentoOrigen: 'PROC-A' });
eq('8. se contabilizan sólo 7,000', c3.montoContabilizado, 7000);
eq('el pago no reconoce ingreso nuevo', ingresoDe(c3), 0);

// 10-13. Reclasificar el saldo de 3,000 con su composición
const detTrasPago = [
  { id: 'c-cap', claveConcepto: 'CAPITAL', monto: 8000, pagoTotal: 5000 },
  { id: 'c-int', claveConcepto: 'INTERES_ORDINARIO', monto: 1500, pagoTotal: 1500 },
  { id: 'c-iva', claveConcepto: 'IVA_INTERES', monto: 500, pagoTotal: 500 },
];
const recCiclo = M.componentesDeReclasificacion(detTrasPago, 3000);
eq('9. queda saldo de 3,000', recCiclo.saldoTotal, 3000);
eq('13. la composición se conserva', recCiclo.composicion.map(c => [c.claveConceptoOrigen, c.saldoReclasificado]),
   [['CAPITAL', 3000]]);
const c4 = corre(M.EVENTOS.RECLASIFICACION_SALDO, recCiclo.componentes, { idDocumentoOrigen: 'CXC-A' });
eq('10. póliza de reclasificación cuadrada', c4.cuadrada, true);
eq('la reclasificación no reconoce ingreso', ingresoDe(c4), 0);

// 14-16. Nuevo corte incluyendo Saldo Anterior
const c5 = corre(M.EVENTOS.CORTE_PERIODO,
  [{ clave: 'SALDO_ANTERIOR', nombre: 'Saldo anterior', monto: 3000 }], { idDocumentoOrigen: 'CXC-B' });
eq('15-16. nueva CxC contabilizada', c5.montoContabilizado, 3000);
eq('16. usa la cuenta puente', c5.partidas.find(p => p.haber > 0).cuentaContableGl, '1999-001');

// 17. El invariante central de §44/§92
eq('17. los 3,000 NO provocan doble reconocimiento de ingreso', ingresoDe(c5), 0);
eq('el ingreso total del ciclo sigue siendo el del corte original', ingresoCorte + ingresoDe(c3) + ingresoDe(c4) + ingresoDe(c5), 1500);

console.log('\n── §92 Invariantes: toda póliza generada cuadra ──');
for (const [n, p] of [['activación', c1], ['corte', c2], ['pago', c3], ['reclasificación', c4], ['nuevo corte', c5]]) {
  eq(`${n}: Debe = Haber`, p.totalDebe, p.totalHaber);
  ok_(`${n}: marcada como cuadrada`, p.cuadrada === true && p.ok === true);
  ok_(`${n}: ninguna partida sin cuenta`, p.partidas.every(x => !!x.cuentaContableGl));
  ok_(`${n}: ninguna partida con Debe y Haber a la vez`, p.partidas.every(x => !(x.debe > 0 && x.haber > 0)));
}

console.log(`\n${pass} aserciones OK, ${fail} fallas`);
process.exit(fail > 0 ? 1 : 0);
