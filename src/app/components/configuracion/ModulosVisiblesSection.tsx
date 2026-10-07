/**
 * Configuración → Módulos visibles.
 * Por usuario, qué módulos aparecen en el menú y en los Accesos del Inicio.
 * Ocultar no quita permisos: sólo despeja la pantalla.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/app/lib/notificaciones';
import {
  CATALOGO_MODULOS, GRUPOS_MODULOS, USUARIOS_SISTEMA, MODULOS_SIEMPRE_VISIBLES,
  leerModulosOcultos, guardarModulosOcultos,
} from '@/app/lib/modulosVisibles';

export function ModulosVisiblesSection() {
  const [usuario, setUsuario] = useState(USUARIOS_SISTEMA[0].usuario);
  const [ocultos, setOcultos] = useState<Set<string>>(() => new Set(leerModulosOcultos(USUARIOS_SISTEMA[0].usuario)));
  const [cambios, setCambios] = useState(false);

  useEffect(() => {
    setOcultos(new Set(leerModulosOcultos(usuario)));
    setCambios(false);
  }, [usuario]);

  const perfil = USUARIOS_SISTEMA.find(u => u.usuario === usuario)!;
  const permitido = (id: string) => !perfil.permitidos || perfil.permitidos.includes(id);
  const etiqueta = useMemo(() => new Map(CATALOGO_MODULOS.map(m => [m.id, m.label])), []);
  const grupos = useMemo(() => {
    const usados = new Set(GRUPOS_MODULOS.flatMap(g => g.modulos));
    const otros = CATALOGO_MODULOS.filter(m => !usados.has(m.id)).map(m => m.id);
    return otros.length ? [...GRUPOS_MODULOS, { id: 'otros', titulo: 'Otros', descripcion: '', modulos: otros }] : GRUPOS_MODULOS;
  }, []);

  const permitidos = CATALOGO_MODULOS.filter(m => permitido(m.id));
  const visibles = permitidos.filter(m => !ocultos.has(m.id)).length;

  const cambiar = (ids: string[], visible: boolean) => {
    const s = new Set(ocultos);
    for (const id of ids) {
      if (MODULOS_SIEMPRE_VISIBLES.includes(id) || !permitido(id)) continue;
      if (visible) s.delete(id); else s.add(id);
    }
    setOcultos(s);
    setCambios(true);
  };

  const guardar = () => {
    guardarModulosOcultos(usuario, [...ocultos]);
    setCambios(false);
    toast.success('Módulos visibles guardados', { description: `${perfil.nombre}: ${visibles} de ${permitidos.length} módulos visibles.` });
  };

  return (
    <div className="p-5 space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Módulos visibles por usuario</h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
            Elige qué módulos aparecen en el menú y en los Accesos del Inicio. Ocultar un módulo no quita el
            permiso: sólo lo saca de la vista. Configuración siempre está visible.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <label className="block">
            <span className="block text-[11px] font-medium text-gray-600 mb-1">Usuario</span>
            <select value={usuario} onChange={e => {
              if (cambios && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
              setUsuario(e.target.value);
            }} className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white min-w-[200px]">
              {USUARIOS_SISTEMA.map(u => <option key={u.usuario} value={u.usuario}>{u.nombre} ({u.usuario})</option>)}
            </select>
          </label>
          <button type="button" onClick={() => cambiar(permitidos.map(m => m.id), true)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">Mostrar todos</button>
          <button type="button" onClick={() => cambiar(permitidos.map(m => m.id), false)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">Ocultar todos</button>
          <button type="button" onClick={guardar} disabled={!cambios}
            className="px-4 py-1.5 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme disabled:opacity-50 disabled:cursor-not-allowed">
            Guardar
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-600">
        <strong>{visibles}</strong> de <strong>{permitidos.length}</strong> módulos permitidos visibles para {perfil.nombre}.
        {perfil.permitidos && ' Los módulos sin permiso aparecen deshabilitados.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {grupos.map(g => {
          const ids = g.modulos.filter(id => etiqueta.has(id));
          const editables = ids.filter(id => permitido(id) && !MODULOS_SIEMPRE_VISIBLES.includes(id));
          const todosVisibles = editables.length > 0 && editables.every(id => !ocultos.has(id));
          return (
            <section key={g.id} className="bg-white border border-gray-200 rounded-lg">
              <header className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{g.titulo}</span>
                {editables.length > 0 && (
                  <button type="button" onClick={() => cambiar(editables, !todosVisibles)}
                    className="text-[11px] text-[color:var(--theme-link)] hover:underline">
                    {todosVisibles ? 'Ocultar grupo' : 'Mostrar grupo'}
                  </button>
                )}
              </header>
              <ul className="p-2 space-y-0.5">
                {ids.map(id => {
                  const fijo = MODULOS_SIEMPRE_VISIBLES.includes(id);
                  const conPermiso = permitido(id);
                  const visible = conPermiso && (fijo || !ocultos.has(id));
                  return (
                    <li key={id}>
                      <label className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${conPermiso && !fijo ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed text-gray-400'}`}>
                        <input type="checkbox" checked={visible} disabled={!conPermiso || fijo}
                          onChange={e => cambiar([id], e.target.checked)} className="w-4 h-4" />
                        <span className={conPermiso ? 'text-gray-700' : ''}>{etiqueta.get(id)}</span>
                        {fijo && <span className="ml-auto text-[10px] text-gray-400">siempre visible</span>}
                        {!conPermiso && <span className="ml-auto text-[10px] text-gray-400">sin permiso</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-500">
        La preferencia se guarda en este navegador. Los cambios se aplican al guardar, sin recargar la página.
      </p>
    </div>
  );
}
