/**
 * TarjetaCreditoTab — la tarjeta física/digital de una Línea TDC.
 *
 * Mismo lenguaje visual que "Tarjeta de Débito" en Personas: plástico en 3D
 * que se voltea, chip, contactless y logo de la red. Lo que cambia es lo que
 * una tarjeta de CRÉDITO tiene y una de débito no:
 *
 *   · Límite autorizado y saldo disponible, no el saldo de una cuenta.
 *   · Día de corte y fecha límite de pago, que salen de las Reglas de Pago y
 *     Corte del producto — no se capturan aquí.
 *   · Sin CLABE: una TDC no recibe transferencias a sí misma.
 *
 * No se reutilizó el componente de débito porque su estado, su llave de
 * almacenamiento (`cliente_*`) y la mitad de sus campos son de otra cosa;
 * generalizarlo habría llenado de condicionales un componente que hoy funciona.
 */
import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { saveToSession, loadFromSession, loadFromSavedStore } from '../creditos/creditoStore';

export interface TarjetaCreditoData {
  activa: boolean;
  numeroTarjeta: string;
  nombreTarjeta: string;
  fechaExpiracion: string;
  cvv: string;
  nip: string;
  tipoRed: string;
  estatusTarjeta: string;
  /** Fecha en que se emitió el plástico. */
  fechaEmision: string;
}

const vacia = (): TarjetaCreditoData => ({
  activa: false,
  numeroTarjeta: '',
  nombreTarjeta: '',
  fechaExpiracion: '',
  cvv: '',
  nip: '',
  tipoRed: 'Visa',
  estatusTarjeta: 'Pendiente',
  fechaEmision: '',
});

const digitos = (n: number): string =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

/** Visa empieza en 4, Mastercard en 5 — la red se deduce del número, no al revés. */
const generarNumero = (): string => (Math.random() > 0.5 ? '4' : '5') + digitos(15);

const generarExpiracion = (): string => {
  // Una TDC se emite a 3–5 años.
  const hoy = new Date();
  const anios = 3 + Math.floor(Math.random() * 3);
  const mes = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  return `${mes}/${String((hoy.getFullYear() + anios) % 100).padStart(2, '0')}`;
};

const generar = (titular: string): TarjetaCreditoData => {
  const num = generarNumero();
  return {
    activa: true,
    numeroTarjeta: num,
    nombreTarjeta: (titular || 'TITULAR').toUpperCase(),
    fechaExpiracion: generarExpiracion(),
    cvv: digitos(3),
    nip: digitos(4),
    tipoRed: num.startsWith('4') ? 'Visa' : 'Mastercard',
    estatusTarjeta: 'Activa',
    fechaEmision: new Date().toISOString().slice(0, 10),
  };
};

const enmascarar = (num: string): string => {
  const d = num.replace(/\D/g, '');
  return d.length < 4 ? '•••• •••• •••• ••••' : `•••• •••• •••• ${d.slice(-4)}`;
};

const conEspacios = (num: string): string =>
  num.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const fmt = (n: number) =>
  (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const VisaLogo = () => (
  <svg viewBox="0 0 780 500" className="h-7" fill="white">
    <path d="M293.2 348.73l33.36-195.76h53.35l-33.38 195.76H293.2zm246.11-191.54c-10.57-3.97-27.14-8.21-47.84-8.21-52.73 0-89.88 26.57-90.18 64.63-.3 28.14 26.51 43.83 46.75 53.19 20.77 9.58 27.75 15.71 27.66 24.27-.14 13.11-16.59 19.1-31.93 19.1-21.35 0-32.69-2.96-50.22-10.27l-6.87-3.11-7.49 43.87c12.46 5.47 35.54 10.21 59.49 10.46 56.06 0 92.47-26.24 92.87-66.92.21-22.3-14.01-39.27-44.78-53.27-18.64-9.07-30.07-15.12-29.95-24.3 0-8.14 9.66-16.84 30.54-16.84 17.43-.28 30.07 3.53 39.91 7.49l4.78 2.26 7.25-42.35zm137.31-4.22h-41.23c-12.77 0-22.33 3.49-27.94 16.24l-79.28 179.52h56.06s9.16-24.13 11.23-29.43c6.12 0 60.48.08 68.24.08 1.59 6.87 6.49 29.35 6.49 29.35h49.54l-43.11-195.76zm-65.28 126.4c4.4-11.26 21.23-54.68 21.23-54.68-.31.52 4.37-11.31 7.06-18.64l3.6 16.84s10.2 46.7 12.33 56.48h-44.22zM285.69 152.97L233.38 285.5l-5.58-27.15c-9.7-31.23-39.93-65.09-73.77-82.04l47.78 171.28 56.42-.06 83.94-195.56h-56.48z"/>
    <path d="M146.92 152.96H60.88l-.68 3.97c66.94 16.21 111.21 55.39 129.56 102.43L171.35 169.4c-3.23-12.4-12.61-16.1-24.43-16.44z" fill="#F0B73E"/>
  </svg>
);

const MastercardLogo = () => (
  <svg viewBox="0 0 780 500" className="h-7">
    <circle cx="300" cy="250" r="140" fill="#EB001B" opacity="0.9"/>
    <circle cx="480" cy="250" r="140" fill="#F79E1B" opacity="0.9"/>
    <path d="M390 140.8c35.5 29.6 58.2 74 58.2 123.2s-22.7 93.6-58.2 123.2c-35.5-29.6-58.2-74-58.2-123.2s22.7-93.6 58.2-123.2z" fill="#FF5F00"/>
  </svg>
);

interface Props {
  /** Id de la Línea — también la llave de persistencia. */
  sid: string;
  isRO: boolean;
  titular?: string;
  /** Límite autorizado de la Línea. */
  limiteAutorizado?: number;
  /** Consumido por los movimientos; el disponible se deriva. */
  consumido?: number;
  /** Reglas de Pago y Corte del producto — día de corte y días para pagar. */
  reglaTDC?: Record<string, any>;
  productoNombre?: string;
}

export function TarjetaCreditoTab({
  sid, isRO, titular = '', limiteAutorizado = 0, consumido = 0, reglaTDC, productoNombre = '',
}: Props) {
  const [tarjeta, setTarjeta] = useState<TarjetaCreditoData>(
    () =>
      loadFromSession<TarjetaCreditoData>(sid, 'tarjetaCredito') ||
      loadFromSavedStore<TarjetaCreditoData>(sid, 'tarjetaCredito') ||
      vacia()
  );
  const [volteada, setVolteada] = useState(false);
  const [verCvv, setVerCvv] = useState(false);
  const [verNip, setVerNip] = useState(false);

  const guardar = useCallback((t: TarjetaCreditoData) => {
    setTarjeta(t);
    if (!isRO) saveToSession(sid, 'tarjetaCredito', t);
  }, [sid, isRO]);

  const campo = (k: keyof TarjetaCreditoData, v: any) =>
    guardar({ ...tarjeta, [k]: v });

  const activar = (on: boolean) => {
    if (on) {
      const nueva = generar(titular);
      guardar(nueva);
      toast.success('Tarjeta de crédito emitida', {
        description: `${nueva.tipoRed} •••• ${nueva.numeroTarjeta.slice(-4)} · vence ${nueva.fechaExpiracion}`,
      });
    } else {
      guardar(vacia());
      toast.info('Tarjeta desactivada');
    }
  };

  const disponible = useMemo(
    () => Math.max(0, (Number(limiteAutorizado) || 0) - (Number(consumido) || 0)),
    [limiteAutorizado, consumido],
  );

  // Día de corte y días para pagar salen del producto — aquí no se capturan.
  const diaCorte = String(reglaTDC?.diaCorte ?? '') || '—';
  const diasPago = String(reglaTDC?.diasFechaLimitePago ?? '') || '—';

  const esVisa = tarjeta.tipoRed === 'Visa';
  const inp = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-theme disabled:bg-gray-50 disabled:text-gray-500';
  const lbl = 'block text-[10px] text-gray-600 mb-0.5 uppercase tracking-wide';

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="stroke-primary-theme" strokeWidth="1.5">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <span className="text-sm font-medium text-gray-800">
            TARJETA DE CRÉDITO{productoNombre ? ` — ${productoNombre}` : ''}
          </span>
        </div>
        {!isRO && (
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
            <input type="checkbox" checked={tarjeta.activa}
              onChange={e => activar(e.target.checked)} className="w-4 h-4" />
            <span className="font-medium">EMITIR TARJETA</span>
          </label>
        )}
      </div>

      {!tarjeta.activa ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg className="w-20 h-20 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
            <line x1="6" y1="15" x2="10" y2="15" />
          </svg>
          <p className="text-sm text-gray-500">Esta Línea no tiene tarjeta emitida</p>
          <p className="text-xs text-gray-400 mt-1">
            {isRO
              ? 'No se ha emitido el plástico para esta Línea de Crédito'
              : 'Use la casilla de la esquina superior derecha para emitirla'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── El plástico ── */}
          <div className="flex justify-center">
            <div className="relative cursor-pointer select-none"
              style={{ perspective: '1000px', width: '420px', height: '260px' }}
              onClick={() => setVolteada(!volteada)}
              title="Clic para voltear la tarjeta">
              <div className="relative w-full h-full transition-transform duration-700"
                style={{ transformStyle: 'preserve-3d', transform: volteada ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>

                {/* FRENTE */}
                <div className="absolute inset-0 rounded-2xl shadow-2xl overflow-hidden"
                  style={{
                    backfaceVisibility: 'hidden',
                    // Verde profundo para distinguirla de un vistazo de la de débito.
                    background: esVisa
                      ? 'linear-gradient(135deg, #04312b 0%, #0a5c4a 45%, #0f8a6a 100%)'
                      : 'linear-gradient(135deg, #2b1a05 0%, #5c3a0a 45%, #8a5e0f 100%)',
                  }}>
                  <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.18) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 40%)' }} />

                  <div className="relative z-10 flex flex-col justify-between h-full p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-9 rounded-md overflow-hidden"
                          style={{ background: 'linear-gradient(135deg, #d4af37 0%, #f2d675 30%, #d4af37 50%, #c5a028 70%, #d4af37 100%)' }}>
                          <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-px p-px">
                            {[...Array(9)].map((_, i) => (
                              <div key={i} className="rounded-[1px]" style={{ background: 'rgba(180,150,50,0.5)' }} />
                            ))}
                          </div>
                        </div>
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8.5 16.5c-1.5-1.5-1.5-4 0-5.5" strokeLinecap="round" />
                          <path d="M12 19c-3-3-3-8 0-11" strokeLinecap="round" />
                          <path d="M15.5 21.5c-4.5-4.5-4.5-12 0-16.5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="mt-1">{esVisa ? <VisaLogo /> : <MastercardLogo />}</div>
                    </div>

                    <div className="mt-2">
                      <p className="text-white/50 text-[9px] tracking-wider mb-1">NÚMERO DE TARJETA</p>
                      <p className="text-white text-xl font-mono tracking-[0.15em]">
                        {conEspacios(tarjeta.numeroTarjeta) || '•••• •••• •••• ••••'}
                      </p>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-white/50 text-[9px] tracking-wider mb-0.5">TITULAR</p>
                        <p className="text-white text-sm tracking-wide">{tarjeta.nombreTarjeta || 'TITULAR'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/50 text-[9px] tracking-wider mb-0.5">VENCE</p>
                        <p className="text-white text-sm font-mono">{tarjeta.fechaExpiracion || 'MM/YY'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/50 text-[9px] tracking-wider mb-0.5">LÍNEA</p>
                        <p className="text-white text-sm font-mono">{fmt(limiteAutorizado)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* REVERSO */}
                <div className="absolute inset-0 rounded-2xl shadow-2xl overflow-hidden"
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: esVisa
                      ? 'linear-gradient(135deg, #04312b 0%, #0a5c4a 45%, #0f8a6a 100%)'
                      : 'linear-gradient(135deg, #2b1a05 0%, #5c3a0a 45%, #8a5e0f 100%)',
                  }}>
                  <div className="h-12 bg-black/80 mt-6" />
                  <div className="px-6 mt-5">
                    <div className="bg-white/90 rounded h-9 flex items-center justify-end px-3">
                      <span className="font-mono text-sm text-gray-900 tracking-widest">
                        {verCvv ? tarjeta.cvv : '•••'}
                      </span>
                    </div>
                    <p className="text-white/50 text-[9px] mt-1 text-right tracking-wider">CVV</p>
                  </div>
                  <div className="px-6 mt-4">
                    <p className="text-white/40 text-[9px] leading-relaxed">
                      El uso de esta tarjeta está sujeto a las condiciones del contrato
                      de Línea de Crédito. Documento no negociable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-gray-400">Clic en la tarjeta para voltearla</p>

          {/* ── Situación de la línea — derivada, no capturable ── */}
          <div className="border border-gray-200 rounded">
            <div className="section-header-theme px-3 py-2">
              <span className="text-xs text-gray-800">SITUACIÓN DE LA LÍNEA</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-3">
              {([
                ['Límite autorizado', fmt(limiteAutorizado)],
                ['Consumido', fmt(consumido)],
                ['Disponible', fmt(disponible)],
                ['Día de corte', diaCorte],
                ['Días para pagar', diasPago],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">{k}</div>
                  <div className="text-sm font-mono text-gray-800">{v}</div>
                </div>
              ))}
            </div>
            <div className="px-3 pb-3 text-[11px] text-gray-400">
              El límite viene de Términos y Condiciones; el día de corte y los días para
              pagar, de las Reglas de Pago y Corte del producto. Aquí no se capturan.
            </div>
          </div>

          {/* ── Datos del plástico ── */}
          <div className="border border-gray-200 rounded">
            <div className="section-header-theme px-3 py-2">
              <span className="text-xs text-gray-800">DATOS DE LA TARJETA</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
              <div>
                <label className={lbl}>Número</label>
                <input value={conEspacios(tarjeta.numeroTarjeta)} disabled
                  className={`${inp} font-mono`} />
              </div>
              <div>
                <label className={lbl}>Nombre en la tarjeta</label>
                <input value={tarjeta.nombreTarjeta} disabled={isRO}
                  onChange={e => campo('nombreTarjeta', e.target.value.toUpperCase())}
                  className={inp} />
              </div>
              <div>
                <label className={lbl}>Vencimiento</label>
                <input value={tarjeta.fechaExpiracion} disabled className={`${inp} font-mono`} />
              </div>

              <div>
                <label className={lbl}>CVV</label>
                <div className="flex gap-1">
                  <input value={verCvv ? tarjeta.cvv : '•••'} disabled className={`${inp} font-mono`} />
                  <button type="button" onClick={() => setVerCvv(v => !v)}
                    className="px-2 text-[11px] text-blue-600 hover:text-blue-800 whitespace-nowrap">
                    {verCvv ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
              <div>
                <label className={lbl}>NIP</label>
                <div className="flex gap-1">
                  <input value={verNip ? tarjeta.nip : '••••'} disabled className={`${inp} font-mono`} />
                  <button type="button" onClick={() => setVerNip(v => !v)}
                    className="px-2 text-[11px] text-blue-600 hover:text-blue-800 whitespace-nowrap">
                    {verNip ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
              <div>
                <label className={lbl}>Red</label>
                <input value={tarjeta.tipoRed} disabled className={inp} />
              </div>

              <div>
                <label className={lbl}>Estatus</label>
                <select value={tarjeta.estatusTarjeta} disabled={isRO}
                  onChange={e => campo('estatusTarjeta', e.target.value)} className={inp}>
                  {['Activa', 'Bloqueada', 'Cancelada', 'Pendiente'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Fecha de emisión</label>
                <input value={tarjeta.fechaEmision} disabled className={`${inp} font-mono`} />
              </div>
              <div>
                <label className={lbl}>Enmascarada</label>
                <input value={enmascarar(tarjeta.numeroTarjeta)} disabled className={`${inp} font-mono`} />
              </div>
            </div>
            <div className="px-3 pb-3 text-[11px] text-gray-400">
              El número, el vencimiento, el CVV y el NIP se generan al emitir y no se
              editan: cambiarlos a mano dejaría el plástico sin correspondencia con lo
              emitido.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
