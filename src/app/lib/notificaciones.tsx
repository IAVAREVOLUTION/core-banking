/**
 * Sistema de notificaciones del CORE, sobre react-toastify.
 *
 * Mantiene la misma forma de uso que tenía la app con sonner, así que las
 * ~1,300 llamadas existentes no cambian, sólo su import:
 *
 *   toast.success('Producto guardado', { description: 'PR-001', duration: 4000 });
 *   const id = toast.loading('Validando…');  …  toast.success('Listo', { id });
 *   toast.dismiss(id);
 *
 * Todos los textos pasan por limpiarMensaje(): nunca se muestran nombres de
 * tablas, UUID ni errores crudos del servidor.
 */
import type { CSSProperties, ReactNode } from 'react';
import {
  ToastContainer, Slide, toast as rt,
  type Id, type ToastOptions, type ToastPosition, type TypeOptions,
} from 'react-toastify';
import { limpiarMensaje } from './toastNegocio';

type Tipo = 'success' | 'error' | 'warning' | 'info' | 'default' | 'loading';

export interface OpcionesToast {
  description?: ReactNode;
  /** ms; Infinity = no se cierra solo */
  duration?: number;
  /** Reemplaza el aviso con ese id si sigue visible (p. ej. un "cargando…"). */
  id?: Id;
  icon?: ReactNode;
  style?: CSSProperties;
  className?: string;
  position?: ToastPosition;
  action?: { label: ReactNode; onClick: (e: any) => void };
  cancel?: { label: ReactNode; onClick?: (e: any) => void };
  [extra: string]: unknown;
}

const DURACION: Record<Tipo, number | false> = {
  success: 4000, info: 4500, default: 4000, warning: 6000, error: 7000, loading: false,
};

const limpiar = (v: ReactNode): ReactNode => (typeof v === 'string' ? limpiarMensaje(v) : v);

function Contenido({ titulo, op }: { titulo: ReactNode; op: OpcionesToast }) {
  const descripcion = limpiar(op.description);
  return (
    <div className="core-toast">
      <p className="core-toast-titulo">{limpiar(titulo)}</p>
      {descripcion ? <p className="core-toast-desc">{descripcion}</p> : null}
      {(op.action || op.cancel) && (
        <div className="core-toast-acciones">
          {op.cancel && (
            <button type="button" className="core-toast-btn core-toast-btn-sec" onClick={e => { op.cancel!.onClick?.(e); }}>
              {op.cancel.label}
            </button>
          )}
          {op.action && (
            <button type="button" className="core-toast-btn" onClick={e => { op.action!.onClick(e); }}>
              {op.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Avisos "cargando…" abiertos. Red de seguridad: si el código nunca los cierra
 * (una excepción no controlada, una promesa que no termina), se cierran solos.
 */
const cargandoAbiertos = new Set<Id>();
const MAX_CARGANDO_MS = 90_000;
function vigilarCargando(id: Id) {
  cargandoAbiertos.add(id);
  setTimeout(() => {
    if (cargandoAbiertos.delete(id)) rt.dismiss(id);
  }, MAX_CARGANDO_MS);
}

function mostrar(tipo: Tipo, titulo: ReactNode, op: OpcionesToast = {}): Id {
  const autoClose = op.duration === Infinity ? false : (op.duration ?? DURACION[tipo]);
  const contenido = <Contenido titulo={titulo} op={op} />;
  const opciones: ToastOptions = {
    type: (tipo === 'loading' ? 'default' : tipo) as TypeOptions,
    autoClose,
    icon: op.icon as ToastOptions['icon'],
    style: op.style,
    className: op.className,
    position: op.position,
    closeButton: tipo !== 'loading',
  };
  if (op.id != null && rt.isActive(op.id)) {
    rt.update(op.id, { ...opciones, render: contenido, isLoading: tipo === 'loading' });
    if (tipo !== 'loading') cargandoAbiertos.delete(op.id);
    return op.id;
  }
  if (tipo === 'loading') {
    const id = rt.loading(contenido, { ...opciones, toastId: op.id });
    vigilarCargando(id);
    return id;
  }
  if (op.id != null) cargandoAbiertos.delete(op.id);
  return rt(contenido, { ...opciones, toastId: op.id });
}

type Fn = (titulo: ReactNode, opciones?: OpcionesToast) => Id;

export const toast: Fn & {
  success: Fn; error: Fn; warning: Fn; info: Fn; message: Fn; loading: Fn;
  dismiss: (id?: Id) => void;
} = Object.assign((titulo: ReactNode, op?: OpcionesToast) => mostrar('default', titulo, op), {
  success: (t: ReactNode, op?: OpcionesToast) => mostrar('success', t, op),
  error: (t: ReactNode, op?: OpcionesToast) => mostrar('error', t, op),
  warning: (t: ReactNode, op?: OpcionesToast) => mostrar('warning', t, op),
  info: (t: ReactNode, op?: OpcionesToast) => mostrar('info', t, op),
  message: (t: ReactNode, op?: OpcionesToast) => mostrar('default', t, op),
  loading: (t: ReactNode, op?: OpcionesToast) => mostrar('loading', t, op),
  dismiss: (id?: Id) => {
    if (id == null) cargandoAbiertos.clear(); else cargandoAbiertos.delete(id);
    rt.dismiss(id);
  },
});

const ESTILOS = `
.Toastify__toast-container{width:380px;max-width:calc(100vw - 32px);}
.Toastify__toast{border-radius:8px;font-family:inherit;padding:12px 14px;min-height:56px;
  box-shadow:0 10px 25px -8px rgba(15,23,42,.25);border-left:4px solid var(--toastify-color-progress-light,#2E5C91);}
.Toastify__toast--success{border-left-color:var(--toastify-color-success);}
.Toastify__toast--error{border-left-color:var(--toastify-color-error);}
.Toastify__toast--warning{border-left-color:var(--toastify-color-warning);}
.Toastify__toast--info{border-left-color:var(--toastify-color-info);}
.core-toast{display:flex;flex-direction:column;gap:2px;}
.core-toast-titulo{margin:0;font-size:13px;font-weight:600;color:#1F2937;line-height:1.35;}
.core-toast-desc{margin:0;font-size:12px;color:#4B5563;line-height:1.4;}
.core-toast-acciones{display:flex;gap:6px;justify-content:flex-end;margin-top:6px;}
.core-toast-btn{font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;background:#2E5C91;color:#fff;border:0;cursor:pointer;}
.core-toast-btn-sec{background:#F3F4F6;color:#374151;}
:root{--toastify-color-info:#2E5C91;--toastify-color-success:#15803D;--toastify-color-warning:#D97706;--toastify-color-error:#B91C1C;}
`;

/**
 * Contenedor de notificaciones: se monta una vez en App.
 * Sin `limit` a propósito: con límite, react-toastify encola los avisos que
 * exceden el máximo y toast.dismiss() no alcanza a los encolados, así que un
 * "cargando…" ya cerrado aparecía después y se quedaba fijo.
 */
export function Toaster(_props: { position?: ToastPosition } = {}) {
  return (
    <>
      <style>{ESTILOS}</style>
      <ToastContainer
        position={_props.position ?? 'top-right'}
        newestOnTop
        closeOnClick={false}
        pauseOnHover
        pauseOnFocusLoss
        draggable
        theme="light"
        transition={Slide}
      />
    </>
  );
}
