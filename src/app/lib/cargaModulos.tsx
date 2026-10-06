/**
 * Carga de módulos bajo demanda.
 *
 * Antes, App importaba los ~45 módulos de forma estática y todo viajaba en un
 * solo archivo JS de 6 MB (1.4 MB comprimido) aunque el usuario sólo abriera
 * uno. Con perezoso() cada módulo se descarga al entrar a él por primera vez.
 *
 *   const SolicitudCreditoList = perezoso(() => import('./…/SolicitudCreditoList'), 'SolicitudCreditoList');
 *   SolicitudCreditoList.precargar();   // p. ej. al pasar el mouse por su pestaña
 */
import { Component, lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';

type ConPrecarga<C extends ComponentType<any>> = LazyExoticComponent<C> & { precargar: () => void };

/** Componente diferido a partir de un export con nombre; conserva el tipo de sus props. */
export function perezoso<M extends Record<K, ComponentType<any>>, K extends keyof M>(
  cargar: () => Promise<M>,
  nombre: K,
): ConPrecarga<M[K]> {
  let promesa: Promise<M> | null = null;
  const obtener = () => {
    // Si la descarga falla, se permite reintentar (no se cachea el error).
    promesa ??= cargar().catch(err => { promesa = null; throw err; });
    return promesa;
  };
  const comp = lazy(() => obtener().then(m => ({ default: m[nombre] }))) as ConPrecarga<M[K]>;
  comp.precargar = () => { obtener().catch(() => { /* se reintenta al abrir el módulo */ }); };
  return comp;
}

/** Indicador mientras se descarga un módulo. */
export function CargandoModulo() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin" width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="20" stroke="#E0E0E0" strokeWidth="4" />
          <path d="M24 4a20 20 0 0115.5 32.4" stroke="var(--theme-primary)" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-gray-600">Cargando módulo…</p>
      </div>
    </div>
  );
}

/**
 * Si un módulo no se pudo descargar (sin red, o se publicó una versión nueva y
 * el archivo anterior ya no existe), muestra un aviso con opción de reintentar
 * en lugar de dejar la pantalla en blanco.
 */
export class LimiteCargaModulo extends Component<{ children: ReactNode; clave?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { clave?: string }) {
    // Al cambiar de módulo se limpia el error para intentar de nuevo.
    if (prev.clave !== this.props.clave && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const esDescarga = /dynamically imported module|Failed to fetch|Loading chunk|Importing a module script failed/i
      .test(this.state.error.message || '');
    return (
      <div className="flex items-center justify-center py-24 px-4">
        <div className="max-w-md text-center bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <p className="text-base font-medium text-gray-800">
            {esDescarga ? 'No se pudo cargar el módulo' : 'Ocurrió un error al mostrar esta pantalla'}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {esDescarga
              ? 'Puede deberse a la conexión o a que se publicó una versión nueva del sistema.'
              : 'Intente de nuevo; si el problema persiste, contacte a soporte.'}
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-sm rounded text-white"
              style={{ background: 'var(--theme-primary)' }}
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
