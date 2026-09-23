/**
 * TiposPlantillaSection — Configuración → Tipos de Plantilla.
 *
 * Administra el catálogo que alimenta el picklist "Tipo de plantilla" del
 * subtab Plantillas de todos los productos. Mismo patrón que Componentes
 * Contables: hook con cache, CRUD contra la Edge Function.
 *
 * ── La regla que gobierna la pantalla ────────────────────────────────────
 * Un tipo marcado como DEL SISTEMA tiene un proceso que lo genera y busca su
 * clave literal en el código. Su clave no se edita y no se puede eliminar:
 * sólo desactivar. Lo demás —nombre, descripción, ícono, color, orden— es
 * libre, porque nada del código depende de ello.
 */
import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, X, Save, Eye, Lock, Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  useTiposPlantillaDB,
  type TipoPlantillaCatalogo,
} from '../../hooks/useTiposPlantillaDB';
import {
  IconoTipoPlantilla,
  NOMBRES_ICONOS,
  ICONO_POR_DEFECTO,
  nombreIconoDeTipo,
} from '../../lib/iconosPlantilla';

type FormMode = 'list' | 'create' | 'edit' | 'view';

const VACIO: TipoPlantillaCatalogo = {
  id: '', clave: '', nombre: '', descripcion: '', icono: ICONO_POR_DEFECTO,
  color: '#0B5C8C', activo: true, esSistema: false, orden: 100,
};

/** Sugiere la clave a partir del nombre: "Carta de Bienvenida" → carta-de-bienvenida */
const claveDesdeNombre = (nombre: string): string =>
  nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const inp = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-primary-theme';
const th = 'px-3 py-2 text-left text-[11px] font-medium';
const td = 'px-3 py-2 text-xs text-gray-700';

export function TiposPlantillaSection() {
  const { data, loading, synced, fetchAll, create, update, remove } = useTiposPlantillaDB();

  const [mode, setMode] = useState<FormMode>('list');
  const [form, setForm] = useState<TipoPlantillaCatalogo>(VACIO);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [claveTocada, setClaveTocada] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return data;
    return data.filter(t =>
      t.clave.toLowerCase().includes(q) ||
      t.nombre.toLowerCase().includes(q) ||
      (t.descripcion || '').toLowerCase().includes(q));
  }, [data, busqueda]);

  const abrirNuevo = () => { setForm(VACIO); setClaveTocada(false); setMode('create'); };
  const abrirEditar = (t: TipoPlantillaCatalogo) => { setForm({ ...t }); setClaveTocada(true); setMode('edit'); };
  const abrirVer = (t: TipoPlantillaCatalogo) => { setForm({ ...t }); setMode('view'); };
  const cerrar = () => { setForm(VACIO); setMode('list'); };

  const set = (campo: keyof TipoPlantillaCatalogo, valor: any) =>
    setForm(prev => {
      const siguiente = { ...prev, [campo]: valor };
      // La clave se autocompleta mientras nadie la haya tocado a mano.
      if (campo === 'nombre' && !claveTocada && mode === 'create') {
        siguiente.clave = claveDesdeNombre(String(valor));
      }
      return siguiente;
    });

  const guardar = async () => {
    if (guardando) return;
    if (!form.nombre.trim()) { toast.error('Capture el nombre del tipo de plantilla'); return; }
    if (!form.clave.trim()) { toast.error('Capture la clave'); return; }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.clave)) {
      toast.error('Clave inválida', {
        description: 'Sólo minúsculas, números y guiones. Ejemplo: estado-cuenta',
      });
      return;
    }
    if (mode === 'create' && data.some(t => t.clave === form.clave)) {
      toast.error('Ya existe un tipo con esa clave');
      return;
    }

    setGuardando(true);
    const res = mode === 'create'
      ? await create({
          clave: form.clave, nombre: form.nombre, descripcion: form.descripcion,
          icono: form.icono, color: form.color, activo: form.activo, orden: form.orden,
        })
      : await update(form);
    setGuardando(false);

    if (!res.ok) {
      toast.error('No se guardó el tipo de plantilla', { description: res.error, duration: 10000 });
      return;
    }
    toast.success(mode === 'create' ? 'Tipo de plantilla creado' : 'Tipo de plantilla actualizado');
    cerrar();
  };

  const eliminar = async (t: TipoPlantillaCatalogo) => {
    if (t.esSistema) {
      toast.error('No se puede eliminar', {
        description: `"${t.clave}" lo genera un proceso del sistema. Puede desactivarlo para que no aparezca al capturar.`,
        duration: 10000,
      });
      return;
    }
    if (!confirm(`¿Eliminar el tipo "${t.nombre}"?\n\nLas plantillas ya guardadas con este tipo quedarán sin etiqueta.`)) return;

    const res = await remove(t.id);
    if (!res.ok) { toast.error('No se eliminó', { description: res.error }); return; }
    toast.success('Tipo de plantilla eliminado');
  };

  const esLectura = mode === 'view';
  const claveBloqueada = esLectura || (mode === 'edit' && form.esSistema);

  // ── Formulario ──
  if (mode !== 'list') {
    return (
      <div className="p-4 space-y-4">
        <div className="border border-gray-300">
          <div className="section-header-theme px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-800">
              {mode === 'create' ? 'NUEVO TIPO DE PLANTILLA'
                : mode === 'edit' ? 'EDITAR TIPO DE PLANTILLA' : 'TIPO DE PLANTILLA'}
            </span>
            <div className="flex items-center gap-2">
              {!esLectura && (
                <button onClick={guardar} disabled={guardando}
                  className="px-3 py-1 btn-secondary-theme rounded text-xs flex items-center gap-1 disabled:bg-gray-300">
                  {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              )}
              <button onClick={cerrar} className="px-3 py-1 border border-gray-400 rounded text-xs flex items-center gap-1">
                <X size={12} /> Cerrar
              </button>
            </div>
          </div>

          <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                disabled={esLectura} className={inp} placeholder="Estado de Cuenta" />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Clave * {form.esSistema && <Lock size={10} className="inline ml-1 text-amber-600" />}
              </label>
              <input
                value={form.clave}
                onChange={e => { setClaveTocada(true); set('clave', e.target.value); }}
                disabled={claveBloqueada}
                className={`${inp} font-mono ${claveBloqueada ? 'bg-gray-100 text-gray-500' : ''}`}
                placeholder="estado-cuenta"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                {form.esSistema
                  ? 'Tipo del sistema: la clave no se puede cambiar porque hay código que la busca.'
                  : 'Minúsculas, números y guiones. No se podrá cambiar sin afectar las plantillas ya guardadas.'}
              </p>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-gray-600 mb-1">Descripción</label>
              <input value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                disabled={esLectura} className={inp}
                placeholder="Para qué sirve este tipo de documento" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Ícono</label>
              {esLectura ? (
                <div className="flex items-center gap-2 px-2 py-1.5 border border-gray-200 bg-gray-50 rounded">
                  <IconoTipoPlantilla nombre={form.icono} size={16} color={form.color} />
                  <span className="text-xs text-gray-600">{nombreIconoDeTipo(form.icono)}</span>
                </div>
              ) : (
                <div className="border border-gray-300 rounded p-2 max-h-28 overflow-y-auto flex flex-wrap gap-1">
                  {NOMBRES_ICONOS.map(nom => {
                    const activo = nombreIconoDeTipo(form.icono) === nom;
                    return (
                      <button
                        key={nom}
                        type="button"
                        title={nom}
                        onClick={() => set('icono', nom)}
                        className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${
                          activo
                            ? 'border-primary-theme bg-blue-50'
                            : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        <IconoTipoPlantilla nombre={nom} size={15} color={activo ? form.color : '#666'} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
                  disabled={esLectura} className="h-8 w-12 border border-gray-300 rounded" />
                <input value={form.color} onChange={e => set('color', e.target.value)}
                  disabled={esLectura} className={`${inp} font-mono`} />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Orden</label>
              <input type="number" value={form.orden}
                onChange={e => set('orden', parseInt(e.target.value, 10) || 100)}
                disabled={esLectura} className={inp} />
            </div>

            <div className="md:col-span-3 flex items-center gap-2">
              <input id="activo" type="checkbox" checked={form.activo}
                onChange={e => set('activo', e.target.checked)} disabled={esLectura} />
              <label htmlFor="activo" className="text-xs text-gray-700">
                Activo — aparece en el picklist al capturar una plantilla
              </label>
            </div>

            {mode === 'create' && (
              <div className="md:col-span-3 bg-blue-50 border-l-4 border-primary-theme px-3 py-2 text-[11px] text-gray-700 leading-relaxed">
                Un tipo nuevo sirve para <strong>clasificar y archivar</strong> plantillas.
                Que un proceso lo <strong>genere automáticamente</strong> requiere programarlo,
                porque hay que definir qué datos lleva el documento. Los tipos marcados como
                “Sistema” son los que hoy tienen un generador.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Listado ──
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-800">Tipos de Plantilla</h3>
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded ${
            synced ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {synced ? <Cloud size={10} /> : <CloudOff size={10} />}
            {synced ? 'En base de datos' : 'Local / respaldo'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className={`${inp} pl-7 w-56`} placeholder="Buscar…" />
          </div>
          <button onClick={() => void fetchAll()} className="px-2 py-1.5 border border-gray-400 rounded text-xs flex items-center gap-1">
            <RefreshCw size={12} /> Recargar
          </button>
          <button onClick={abrirNuevo} className="px-3 py-1.5 btn-secondary-theme rounded text-xs flex items-center gap-1">
            <Plus size={12} /> Nuevo
          </button>
        </div>
      </div>

      {!synced && (
        <div className="bg-amber-50 border-l-4 border-amber-400 px-3 py-2 text-[11px] text-amber-800">
          No se pudo leer el catálogo de la base. Se está mostrando el respaldo local; los
          cambios no se guardarán. Ejecute <code>create_catalogo_tipos_plantilla.sql</code> y
          despliegue la Edge Function si aún no lo ha hecho.
        </div>
      )}

      <div className="border border-gray-300 overflow-x-auto">
        <table className="w-full bg-white">
          <thead className="table-header-theme">
            <tr>
              <th className={th}>Ícono</th>
              <th className={th}>Clave</th>
              <th className={th}>Nombre</th>
              <th className={th}>Descripción</th>
              <th className={th}>Origen</th>
              <th className={th}>Estatus</th>
              <th className={`${th} text-center`}>Orden</th>
              <th className={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-500">Cargando…</td></tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-500">
                {busqueda ? 'Ningún tipo coincide con la búsqueda.' : 'No hay tipos de plantilla.'}
              </td></tr>
            )}
            {filtrados.map(t => (
              <tr key={t.id} className="border-t border-gray-200">
                <td className={`${td} text-center`}>
                  <IconoTipoPlantilla nombre={t.icono} size={16} color={t.color} />
                </td>
                <td className={`${td} font-mono`}>
                  <span style={{ color: t.color }}>{t.clave}</span>
                </td>
                <td className={td}>{t.nombre}</td>
                <td className={`${td} text-gray-500`}>{t.descripcion || '—'}</td>
                <td className={td}>
                  {t.esSistema ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      <Lock size={9} /> Sistema
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">Personalizado</span>
                  )}
                </td>
                <td className={td}>
                  <span className={t.activo ? 'text-green-700' : 'text-gray-400'}>
                    {t.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className={`${td} text-center`}>{t.orden}</td>
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => abrirVer(t)} title="Ver" className="text-gray-500 hover:text-gray-800">
                      <Eye size={13} />
                    </button>
                    <button onClick={() => abrirEditar(t)} title="Editar" className="text-gray-500 hover:text-primary-theme">
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => void eliminar(t)}
                      title={t.esSistema ? 'Los tipos del sistema no se eliminan' : 'Eliminar'}
                      disabled={t.esSistema}
                      className="text-gray-500 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Los tipos marcados como <strong>Sistema</strong> tienen un proceso que los genera y
        buscan su clave en el código (<code>contrato</code> y <code>pagare</code> en el kit legal,
        <code>carta-oferta</code> en Oportunidades, <code>estado-cuenta</code> en Cartera TDC…).
        Su clave está bloqueada y no se pueden eliminar; sí se pueden desactivar.
      </p>
    </div>
  );
}
