/**
 * Repara en memoria el `data` de una solicitud (J_CUENTAS_CORP_CLIENTES) que
 * quedó corrupto en la BD.
 *
 * Qué pasa en la BD: algunos guardados escriben `data` como TEXTO JSON (jsonb
 * escalar) en vez de objeto, a veces codificado más de una vez. Al combinarlo
 * después con un cambio parcial, el contenido original queda atrapado como
 * texto en la llave "0" (anidado varias veces) y los cambios nuevos se acumulan
 * aparte ("1", "solicitud"…). Quien lee `data.solicitud` sólo ve la parte
 * nueva: p. ej. documentos del KM Digital sin fecha, tipo ni nombre de archivo.
 *
 * Esta función:
 *  1. Decodifica el texto JSON las veces que haga falta.
 *  2. Desenvuelve las llaves numéricas ("0", "1", …) en orden y las fusiona con
 *     el resto (lo más reciente gana).
 *  3. Al fusionar, un valor vacío (null / '' / undefined) NUNCA borra uno con
 *     dato, y los arreglos de objetos con `id` se fusionan por id.
 *
 * No escribe nada en la BD.
 */
type Obj = Record<string, any>;

const esObjeto = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const vacio = (v: unknown) => v === null || v === undefined || v === '';

function decodificar(v: unknown): unknown {
  let x = v;
  for (let i = 0; i < 10 && typeof x === 'string'; i++) {
    const t = x.trim();
    if (!(t.startsWith('{') || t.startsWith('[') || t.startsWith('"'))) break;
    try { x = JSON.parse(t); } catch { break; }
  }
  return x;
}

function fusionarArreglos(a: any[], b: any[]): any[] {
  const conId = (xs: any[]) => xs.length > 0 && xs.every(x => esObjeto(x) && x.id != null);
  if (!conId(a) || !conId(b)) return b.length > 0 ? b : a;
  const porId = new Map<string, Obj>(a.map(x => [String(x.id), x]));
  const vistos = new Set<string>();
  const resultado = b.map(x => {
    const k = String(x.id);
    vistos.add(k);
    return porId.has(k) ? fusionar(porId.get(k)!, x) : x;
  });
  // Elementos que sólo existían en la versión anterior se conservan.
  for (const x of a) if (!vistos.has(String(x.id))) resultado.push(x);
  return resultado;
}

/** Fusión profunda: `b` gana, salvo cuando su valor está vacío. */
export function fusionar(a: unknown, b: unknown): any {
  if (vacio(b)) return vacio(a) ? b : a;
  if (esObjeto(a) && esObjeto(b)) {
    const r: Obj = { ...a };
    for (const [k, v] of Object.entries(b)) r[k] = k in a ? fusionar(a[k], v) : v;
    return r;
  }
  if (Array.isArray(a) && Array.isArray(b)) return fusionarArreglos(a, b);
  return b;
}

export function repararDataSolicitud(raw: unknown): Obj {
  const d = decodificar(raw);
  if (Array.isArray(d)) {
    return d.reduce<Obj>((acc, x) => fusionar(acc, repararDataSolicitud(x)), {});
  }
  if (!esObjeto(d)) return {};
  const numericas = Object.keys(d).filter(k => /^\d+$/.test(k)).sort((x, y) => Number(x) - Number(y));
  if (numericas.length === 0) return d;
  let base: Obj = {};
  for (const k of numericas) base = fusionar(base, repararDataSolicitud(d[k]));
  const resto: Obj = {};
  for (const [k, v] of Object.entries(d)) if (!/^\d+$/.test(k)) resto[k] = v;
  return fusionar(base, resto);
}
