/**
 * Corre las tres suites de TDC y resume el resultado.
 *
 *   npm run test:tdc
 *
 * Cada suite importa el motor real desde src/app/lib/ compilándolo con esbuild,
 * así que prueban el código que corre en la aplicación, no una copia.
 */
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const aqui = dirname(fileURLToPath(import.meta.url));

const suites = [
  ['ESPECIFICACIÓN 1 — Prewrite de movimientos',   'espec1-movimientos.mjs'],
  ['ESPECIFICACIÓN 2 — Refinamiento del prewrite', 'espec2-refinamiento.mjs'],
  ['ESPECIFICACIÓN 3 — Cierre de corte y CxC',     'espec3-cierre-corte.mjs'],
  ['ESPECIFICACIÓN 4 — Aplicación de pagos',       'espec4-aplicacion-pagos.mjs'],
  ['ESPECIFICACIÓN 5 — Eventos contables y pólizas','espec5-contabilidad.mjs'],
  ['ESPECIFICACIÓN 6 — Estado de Cuenta',           'espec6-estado-cuenta.mjs'],
  ['ESPECIFICACIÓN 9 — Reclasificación de saldo',   'espec9-reclasificacion.mjs'],
];

let totalOk = 0, totalFail = 0, suitesRotas = 0;

for (const [titulo, archivo] of suites) {
  const r = spawnSync(process.execPath, [join(aqui, archivo)], {
    encoding: 'utf8',
    cwd: join(aqui, '..', '..'),   // la raíz del proyecto: las suites leen src/app/lib
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const m = salida.match(/(\d+)\s+aserciones OK,\s+(\d+)\s+fallas/);

  if (!m) {
    suitesRotas++;
    console.log(`\n✗ ${titulo}\n  La suite no terminó. Salida:\n${salida.split('\n').slice(-15).join('\n')}`);
    continue;
  }

  const ok = Number(m[1]), fail = Number(m[2]);
  totalOk += ok; totalFail += fail;
  console.log(`${fail === 0 ? '✓' : '✗'} ${titulo}: ${ok} aserciones, ${fail} fallas`);
  if (fail > 0) {
    console.log(salida.split('\n').filter(l => l.includes('FALLA')).join('\n'));
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Total: ${totalOk} aserciones OK, ${totalFail} fallas` +
            (suitesRotas ? `, ${suitesRotas} suite(s) sin terminar` : ''));
console.log(
  'Estas pruebas cubren los MOTORES (decisión pura). No prueban la\n' +
  'persistencia: eso depende de los RPC y se verifica en la aplicación.',
);

process.exit(totalFail > 0 || suitesRotas > 0 ? 1 : 0);
