/**
 * incrustar-logo.mjs — mete el isotipo dentro de una plantilla HTML.
 *
 *   node docs/plantillas/incrustar-logo.mjs [archivo.html]
 *
 * Genera una copia con sufijo `_con_logo.html`. El original no se toca.
 *
 * ── Por qué hace falta ───────────────────────────────────────────────────
 * El PDF se arma con html2canvas sobre un contenedor aislado: no hay servidor
 * ni rutas relativas que resolver, así que un <img src="/src/assets/…"> sale
 * en blanco. La única forma de que el logo aparezca es que los bytes viajen
 * dentro del propio HTML, como data URI.
 *
 * ── El costo, dicho de frente ────────────────────────────────────────────
 * El isotipo pesa ~264 KB, que en base64 son ~352 KB. Ese peso queda dentro
 * de la plantilla, y la plantilla se guarda en el JSONB del producto. Por eso
 * la versión de texto es la predeterminada: úsese ésta sólo si el logo es
 * un requisito del documento.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..');

const LOGO = join(raiz, 'src', 'assets', 'cacao-isotipo.png');
const destinoArg = process.argv[2];
const PLANTILLA = destinoArg
  ? (existsSync(destinoArg) ? destinoArg : join(raiz, destinoArg))
  : join(aqui, 'Estado_Cuenta_TDC_CACAO.html');

if (!existsSync(LOGO)) {
  console.error(`No se encontró el logo en ${LOGO}`);
  process.exit(1);
}
if (!existsSync(PLANTILLA)) {
  console.error(`No se encontró la plantilla en ${PLANTILLA}`);
  process.exit(1);
}

const bytes = readFileSync(LOGO);
const dataUri = `data:image/png;base64,${bytes.toString('base64')}`;

const html = readFileSync(PLANTILLA, 'utf8');

// La plantilla trae el marcador <!--LOGO--> en el encabezado. Se busca ESE
// marcador y no un <img> de ejemplo: un <img> escrito dentro de un comentario
// se sustituiría igual y el logo quedaría comentado, que es justo el error que
// tuvo la primera versión de este script.
const MARCADOR = '<!--LOGO-->';
const imgYaPuesto = /<img\s+src="data:image\/png;base64,[^"]*"([^>]*)>/;

const apariciones = html.split(MARCADOR).length - 1;
if (apariciones > 1) {
  console.error(
    `El marcador aparece ${apariciones} veces. Debe estar UNA sola vez, en el ` +
    'encabezado: si se menciona en un comentario de documentación, el "-->" ' +
    'de esa mención cierra el comentario antes de tiempo.',
  );
  process.exit(1);
}

let salida;
if (apariciones === 1) {
  salida = html.replace(MARCADOR, `<img src="${dataUri}" alt="" />`);
} else if (imgYaPuesto.test(html)) {
  salida = html.replace(imgYaPuesto, `<img src="${dataUri}"$1>`);
} else {
  console.error(
    'No encontré dónde poner el logo: la plantilla debe traer el marcador ' +
    `${MARCADOR} en su encabezado.`,
  );
  process.exit(1);
}

if (/<!--[^>]*<img\s+src="data:image/.test(salida)) {
  console.error('El logo quedó dentro de un comentario HTML. Revise la plantilla.');
  process.exit(1);
}

const destino = PLANTILLA.replace(/\.html$/i, '_con_logo.html');
writeFileSync(destino, salida, 'utf8');

const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`Logo incrustado.`);
console.log(`  origen:  ${PLANTILLA}`);
console.log(`  destino: ${destino}`);
console.log(`  tamaño:  ${kb(html.length)} → ${kb(salida.length)}`);
console.log(`\nSuba el archivo *_con_logo.html en Productos → Línea de Crédito → Plantillas.`);
