/**
 * Accesos del Inicio agrupados por área en un acordeón.
 * Los grupos arrancan cerrados; lo que el usuario abre se recuerda (localStorage).
 */
import { useMemo, useState } from 'react';
import { GRUPOS_MODULOS } from '@/app/lib/modulosVisibles';

interface Modulo { id: string; label: string }

const GRUPOS = GRUPOS_MODULOS;

const CLAVE = 'inicio-accesos:abiertos';

function leerAbiertos(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || '[]');
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}

function IconoModulo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function AccesosModulos({ modulos, onNavigate }: { modulos: Modulo[]; onNavigate: (id: string) => void }) {
  const [abiertos, setAbiertosEstado] = useState<Set<string>>(leerAbiertos);
  const setAbiertos = (s: Set<string>) => {
    setAbiertosEstado(s);
    try { localStorage.setItem(CLAVE, JSON.stringify([...s])); } catch { /* sin almacenamiento */ }
  };

  // Sólo los módulos visibles para la sesión; lo no clasificado cae en "Otros".
  const grupos = useMemo(() => {
    const porId = new Map(modulos.map(m => [m.id, m]));
    const usados = new Set<string>();
    const lista = GRUPOS.map(g => {
      const items = g.modulos.map(id => porId.get(id)).filter((m): m is Modulo => !!m);
      items.forEach(m => usados.add(m.id));
      return { ...g, items };
    }).filter(g => g.items.length > 0);
    const otros = modulos.filter(m => !usados.has(m.id));
    if (otros.length) lista.push({ id: 'otros', titulo: 'Otros', descripcion: 'Otros módulos', modulos: [], items: otros });
    return lista;
  }, [modulos]);

  const alternar = (id: string) => {
    const s = new Set(abiertos);
    if (s.has(id)) s.delete(id); else s.add(id);
    setAbiertos(s);
  };

  return (
    <div className="mb-6">
      <div className="bg-primary-light-theme border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-800">ACCESOS</span>
          <span className="text-[11px] text-gray-500 ml-2">{modulos.length} módulo(s) disponibles</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setAbiertos(new Set(grupos.map(g => g.id)))} className="text-[11px] text-gray-500 hover:text-[color:var(--theme-primary)] hover:underline">
            Expandir todo
          </button>
          <button type="button" onClick={() => setAbiertos(new Set())} className="text-[11px] text-gray-500 hover:text-[color:var(--theme-primary)] hover:underline">
            Colapsar todo
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {grupos.map(g => {
          const abierto = abiertos.has(g.id);
          return (
            <section key={g.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => alternar(g.id)}
                aria-expanded={abierto}
                aria-controls={`accesos-${g.id}`}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"
                  className={`shrink-0 text-gray-500 transition-transform ${abierto ? '' : '-rotate-90'}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
                <span className="text-sm font-semibold text-gray-800">{g.titulo}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{g.items.length}</span>
                <span className="hidden md:block text-[11px] text-gray-500 truncate">
                  {abierto ? g.descripcion : g.items.map(m => m.label).join(' · ')}
                </span>
              </button>
              {abierto && (
                <div id={`accesos-${g.id}`} className="px-4 pb-4 pt-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {g.items.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onNavigate(m.id)}
                      className="group flex items-center gap-2.5 px-3 py-3 bg-white border border-gray-200 rounded-lg text-left hover:border-primary-theme hover:shadow-md transition-all"
                    >
                      <span className="shrink-0 w-8 h-8 rounded-lg bg-primary-light-theme flex items-center justify-center text-primary-theme group-hover:bg-primary-theme group-hover:text-white transition-colors">
                        <IconoModulo />
                      </span>
                      <span className="text-xs font-medium text-gray-700 leading-tight">{m.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
