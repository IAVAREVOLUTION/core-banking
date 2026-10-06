import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const B = 'https://abc.supabase.co/functions/v1/make-server-7e2d13d9';
let llamadas = 0;
let falla = false;

beforeAll(async () => {
  // La caché envuelve window.fetch al importarse: se instala un fetch simulado antes.
  window.fetch = vi.fn(async () => {
    llamadas++;
    return falla ? new Response('{}', { status: 500 }) : new Response(JSON.stringify({ n: llamadas }), { status: 200 });
  }) as typeof fetch;
  await import('./cacheLecturas');
});

beforeEach(async () => {
  const { invalidarLecturas } = await import('./cacheLecturas');
  invalidarLecturas();
  llamadas = 0;
  falla = false;
});

describe('cacheLecturas', () => {
  it('peticiones simultáneas al mismo listado se descargan una vez y cada consumidor lee su copia', async () => {
    const [a, b] = await Promise.all([fetch(`${B}/solicitudes-credito`), fetch(`${B}/solicitudes-credito`)]);
    expect(llamadas).toBe(1);
    expect([(await a.json()).n, (await b.json()).n]).toEqual([1, 1]);
  });

  it('una escritura invalida la caché; las RPC de lectura no', async () => {
    await fetch(`${B}/solicitudes-credito`);
    await fetch('https://abc.supabase.co/rest/v1/rpc/get_all_jclientes', { method: 'POST' });
    await fetch(`${B}/solicitudes-credito`);
    expect(llamadas).toBe(2); // GET + RPC; el 2º GET sale de caché
    await fetch(`${B}/solicitudes-credito/123`, { method: 'PUT', body: '{}' });
    await fetch(`${B}/solicitudes-credito`);
    expect(llamadas).toBe(4);
  });

  it('no reutiliza errores y no cachea rutas fuera de la lista blanca', async () => {
    falla = true;
    await fetch(`${B}/productos`);
    await fetch(`${B}/productos`);
    expect(llamadas).toBe(2);
    falla = false;
    await fetch(`${B}/cartera/cobranza?estatus=x`);
    await fetch(`${B}/cartera/cobranza?estatus=x`);
    expect(llamadas).toBe(4);
  });

  it('la vista ligera y el detalle por id sí se cachean', async () => {
    await fetch(`${B}/solicitudes-credito?vista=lista`);
    await fetch(`${B}/solicitudes-credito?vista=lista`);
    await fetch(`${B}/solicitudes-credito/3fa85f64-5717-4562-b3fc-2c963f66afa6`);
    await fetch(`${B}/solicitudes-credito/3fa85f64-5717-4562-b3fc-2c963f66afa6`);
    expect(llamadas).toBe(2);
  });
});
