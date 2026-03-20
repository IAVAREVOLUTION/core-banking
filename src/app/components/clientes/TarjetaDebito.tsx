import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  useClientePersistence,
} from '@/app/hooks/useClientePersistence';

// ========================================
// INTERFACES
// ========================================
export interface TarjetaDebitoData {
  tarjetaActiva: boolean;
  numeroTarjeta: string;
  nombreTarjeta: string;
  fechaExpiracion: string;
  cvv: string;
  tipoRed: string;
  estatusTarjeta: string;
  nip: string;
  clabe: string;
}

const emptyTarjeta = (): TarjetaDebitoData => ({
  tarjetaActiva: false,
  numeroTarjeta: '',
  nombreTarjeta: '',
  fechaExpiracion: '',
  cvv: '',
  tipoRed: 'Visa',
  estatusTarjeta: 'Pendiente',
  nip: '',
  clabe: '',
});

// ========================================
// AUTO-GENERATION HELPERS
// ========================================
const randomDigits = (n: number): string =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

const generateCardNumber = (): string => {
  // Genera un numero de 16 digitos que inicia con 4 (Visa) o 5 (Mastercard)
  const prefix = Math.random() > 0.5 ? '4' : '5';
  return prefix + randomDigits(15);
};

const generateExpiration = (): string => {
  // Fecha futura entre 3 y 5 anos
  const now = new Date();
  const yearsAhead = 3 + Math.floor(Math.random() * 3);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const year = String((now.getFullYear() + yearsAhead) % 100).padStart(2, '0');
  return `${month}/${year}`;
};

const generateClabe = (): string => {
  // CLABE interbancaria de 18 digitos
  return randomDigits(18);
};

const generateTarjeta = (titularNombre: string): TarjetaDebitoData => {
  const cardNum = generateCardNumber();
  const isVisa = cardNum.startsWith('4');
  return {
    tarjetaActiva: true,
    numeroTarjeta: cardNum,
    nombreTarjeta: titularNombre.toUpperCase(),
    fechaExpiracion: generateExpiration(),
    cvv: randomDigits(3),
    tipoRed: isVisa ? 'Visa' : 'Mastercard',
    estatusTarjeta: 'Activa',
    nip: randomDigits(4),
    clabe: generateClabe(),
  };
};

interface TarjetaDebitoProps {
  clienteId?: string | number;
  mode: 'nuevo' | 'editar' | 'ver';
  isView: boolean;
  titularNombre?: string;
  numeroCuenta?: string;
  /** Synced activation state from parent (formData.activacionTarjetaDebito) */
  isActive?: boolean;
  /** Callback when activation changes — parent updates formData */
  onActivate?: (active: boolean, numeroTarjeta: string) => void;
}

// ========================================
// SVG LOGOS
// ========================================
const VisaLogo = () => (
  <svg viewBox="0 0 780 500" className="h-8" fill="white">
    <path d="M293.2 348.73l33.36-195.76h53.35l-33.38 195.76H293.2zm246.11-191.54c-10.57-3.97-27.14-8.21-47.84-8.21-52.73 0-89.88 26.57-90.18 64.63-.3 28.14 26.51 43.83 46.75 53.19 20.77 9.58 27.75 15.71 27.66 24.27-.14 13.11-16.59 19.1-31.93 19.1-21.35 0-32.69-2.96-50.22-10.27l-6.87-3.11-7.49 43.87c12.46 5.47 35.54 10.21 59.49 10.46 56.06 0 92.47-26.24 92.87-66.92.21-22.3-14.01-39.27-44.78-53.27-18.64-9.07-30.07-15.12-29.95-24.3 0-8.14 9.66-16.84 30.54-16.84 17.43-.28 30.07 3.53 39.91 7.49l4.78 2.26 7.25-42.35zm137.31-4.22h-41.23c-12.77 0-22.33 3.49-27.94 16.24l-79.28 179.52h56.06s9.16-24.13 11.23-29.43c6.12 0 60.48.08 68.24.08 1.59 6.87 6.49 29.35 6.49 29.35h49.54l-43.11-195.76zm-65.28 126.4c4.4-11.26 21.23-54.68 21.23-54.68-.31.52 4.37-11.31 7.06-18.64l3.6 16.84s10.2 46.7 12.33 56.48h-44.22zM285.69 152.97L233.38 285.5l-5.58-27.15c-9.7-31.23-39.93-65.09-73.77-82.04l47.78 171.28 56.42-.06 83.94-195.56h-56.48z"/>
    <path d="M146.92 152.96H60.88l-.68 3.97c66.94 16.21 111.21 55.39 129.56 102.43L171.35 169.4c-3.23-12.4-12.61-16.1-24.43-16.44z" fill="#F0B73E"/>
  </svg>
);

const MastercardLogo = () => (
  <svg viewBox="0 0 780 500" className="h-8">
    <circle cx="300" cy="250" r="140" fill="#EB001B" opacity="0.9"/>
    <circle cx="480" cy="250" r="140" fill="#F79E1B" opacity="0.9"/>
    <path d="M390 140.8c35.5 29.6 58.2 74 58.2 123.2s-22.7 93.6-58.2 123.2c-35.5-29.6-58.2-74-58.2-123.2s22.7-93.6 58.2-123.2z" fill="#FF5F00"/>
  </svg>
);

// ========================================
// HELPERS
// ========================================
const formatCardNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

const formatExpiration = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

const maskCardNumber = (num: string): string => {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 4) return '**** **** **** ****';
  return `**** **** **** ${digits.slice(-4)}`;
};

/**
 * TarjetaDebito - Tab principal del modulo de Clientes
 *
 * Permite activar/desactivar y configurar una tarjeta de debito digital
 * asociada al cliente. Incluye visualizacion 3D interactiva (frente/reverso),
 * formulario completo de datos, y persistencia en sessionStorage.
 */
export function TarjetaDebito({ clienteId, mode, isView, titularNombre, numeroCuenta, isActive, onActivate }: TarjetaDebitoProps) {
  const storageKey = `cliente_${clienteId || 'temp'}_tarjeta_debito`;

  const {
    data: tarjeta,
    setData: setTarjeta,
    clearPersistedData: clearTarjeta,
  } = useClientePersistence<TarjetaDebitoData>(storageKey, emptyTarjeta());

  const [showCvv, setShowCvv] = useState(false);
  const [showNip, setShowNip] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);

  // Clear on new mode
  useEffect(() => {
    if (mode === 'nuevo') {
      clearTarjeta();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Sync with parent's activation checkbox
  useEffect(() => {
    if (isActive === undefined) return;
    const currentActive = tarjeta?.tarjetaActiva || false;
    if (isActive && !currentActive) {
      // Parent activated — auto-generate card data
      const nombre = titularNombre || 'TITULAR';
      const generated = generateTarjeta(nombre);
      setTarjeta(generated);
      // Notify parent of generated card number
      if (onActivate) onActivate(true, generated.numeroTarjeta);
    } else if (!isActive && currentActive) {
      // Parent deactivated — clear card data
      setTarjeta(emptyTarjeta());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const handleField = useCallback((field: keyof TarjetaDebitoData, value: any) => {
    setTarjeta(prev => ({ ...prev, [field]: value }));
  }, [setTarjeta]);

  const handleActivar = useCallback((checked: boolean) => {
    if (checked) {
      // Auto-generar todos los datos de la tarjeta
      const nombre = titularNombre || 'TITULAR';
      const generated = generateTarjeta(nombre);
      setTarjeta(generated);
      toast.success('Tarjeta de debito generada exitosamente.');
      if (onActivate) onActivate(true, generated.numeroTarjeta);
    } else {
      // Desactivar: resetear a vacio
      setTarjeta(emptyTarjeta());
      toast.info('Tarjeta de debito desactivada.');
      if (onActivate) onActivate(false, '');
    }
  }, [setTarjeta, titularNombre, onActivate]);

  const data = tarjeta || emptyTarjeta();
  const displayName = data.nombreTarjeta || titularNombre || 'NOMBRE DEL TITULAR';
  const displayNumber = data.numeroTarjeta || '';
  const displayExp = data.fechaExpiracion || 'MM/YY';
  const isVisa = data.tipoRed === 'Visa';
  const camposEditables = !isView;

  return (
    <div className="bg-white">
      {/* Encabezado institucional */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="stroke-primary-theme" strokeWidth="1.5">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <span className="text-sm font-medium text-gray-800">TARJETA DE DEBITO DIGITAL</span>
        </div>
        {!isView && (
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive !== undefined ? isActive : data.tarjetaActiva}
              onChange={(e) => handleActivar(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-medium">ACTIVAR TARJETA</span>
          </label>
        )}
      </div>

      {/* Estado desactivado */}
      {!data.tarjetaActiva ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <svg className="w-20 h-20 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
            <line x1="6" y1="15" x2="10" y2="15" />
          </svg>
          <p className="text-sm text-gray-500">La tarjeta de debito no esta activada</p>
          <p className="text-xs text-gray-400 mt-1">
            {isView
              ? 'Este cliente no tiene una tarjeta de debito configurada'
              : 'Active la tarjeta usando el checkbox en la esquina superior derecha'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Tarjeta Digital Visual 3D ── */}
          <div className="flex justify-center">
            <div
              className="relative cursor-pointer select-none"
              style={{ perspective: '1000px', width: '420px', height: '260px' }}
              onClick={() => setCardFlipped(!cardFlipped)}
              title="Clic para voltear la tarjeta"
            >
              <div
                className="relative w-full h-full transition-transform duration-700"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* FRENTE */}
                <div
                  className="absolute inset-0 rounded-2xl shadow-2xl overflow-hidden"
                  style={{
                    backfaceVisibility: 'hidden',
                    background: isVisa
                      ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)'
                      : 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 40%, #0d0d0d 100%)',
                  }}
                >
                  {/* Pattern overlay */}
                  <div className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 40%)',
                    }} />

                  <div className="relative z-10 flex flex-col justify-between h-full p-6">
                    {/* Top row - chip + contactless + brand */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* Chip */}
                        <div className="w-12 h-9 rounded-md overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, #d4af37 0%, #f2d675 30%, #d4af37 50%, #c5a028 70%, #d4af37 100%)',
                          }}>
                          <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-px p-px">
                            {[...Array(9)].map((_, i) => (
                              <div key={i} className="rounded-[1px]" style={{ background: 'rgba(180,150,50,0.5)' }} />
                            ))}
                          </div>
                        </div>
                        {/* Contactless icon */}
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8.5 16.5c-1.5-1.5-1.5-4 0-5.5" strokeLinecap="round" />
                          <path d="M12 19c-3-3-3-8 0-11" strokeLinecap="round" />
                          <path d="M15.5 21.5c-4.5-4.5-4.5-12 0-16.5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="mt-1">
                        {isVisa ? <VisaLogo /> : <MastercardLogo />}
                      </div>
                    </div>

                    {/* Card Number */}
                    <div className="mt-2">
                      <p className="text-white/50 text-[9px] tracking-wider mb-1">NUMERO DE TARJETA</p>
                      <p className="text-white text-xl tracking-[0.2em] font-mono">
                        {displayNumber ? formatCardNumber(displayNumber) : '**** **** **** ****'}
                      </p>
                    </div>

                    {/* Bottom row - name + expiration */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-white/50 text-[9px] tracking-wider mb-0.5">TITULAR</p>
                        <p className="text-white text-xs tracking-wider uppercase">{displayName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/50 text-[9px] tracking-wider mb-0.5">VIGENCIA</p>
                        <p className="text-white text-sm font-mono tracking-wider">{displayExp}</p>
                      </div>
                    </div>
                  </div>

                  {/* Bank name watermark */}
                  <div className="absolute top-5 left-0 right-0 text-center">
                    <span className="text-white/20 text-[10px] tracking-[0.4em] uppercase">eFinanciaNet Banking</span>
                  </div>
                </div>

                {/* REVERSO */}
                <div
                  className="absolute inset-0 rounded-2xl shadow-2xl overflow-hidden"
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: isVisa
                      ? 'linear-gradient(135deg, #0f3460 0%, #16213e 50%, #1a1a2e 100%)'
                      : 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, #2d2d2d 100%)',
                  }}
                >
                  {/* Magnetic stripe */}
                  <div className="w-full h-12 bg-gray-900 mt-8" />

                  {/* CVV zone */}
                  <div className="mx-6 mt-4">
                    <div className="bg-white/90 rounded px-4 py-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 tracking-wider">CVV</span>
                      <span className="font-mono text-gray-800 tracking-[0.3em]">
                        {data.cvv || '***'}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="mx-6 mt-4 space-y-2">
                    <p className="text-white/40 text-[8px] leading-tight">
                      Esta tarjeta es propiedad de eFinanciaNet Banking. En caso de encontrarla favor de reportar al 800-123-4567.
                      Uso exclusivo del titular autorizado.
                    </p>
                    {numeroCuenta && (
                      <p className="text-white/30 text-[9px] font-mono">
                        CTA: {numeroCuenta}
                      </p>
                    )}
                  </div>

                  {/* Bottom bar */}
                  <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between">
                    <span className="text-white/20 text-[9px] tracking-[0.3em] uppercase">Tarjeta de Debito</span>
                    <div className="mt-1">
                      {isVisa ? <VisaLogo /> : <MastercardLogo />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-400 -mt-2">Haga clic en la tarjeta para ver el reverso</p>

          {/* ── Estatus badge ── */}
          <div className="flex justify-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              data.estatusTarjeta === 'Activa' ? 'bg-green-100 text-green-800' :
              data.estatusTarjeta === 'Bloqueada' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                data.estatusTarjeta === 'Activa' ? 'bg-green-500' :
                data.estatusTarjeta === 'Bloqueada' ? 'bg-red-500' :
                'bg-yellow-500'
              }`} />
              {data.estatusTarjeta || 'Pendiente'}
            </span>
            {data.clabe && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                CLABE: {data.clabe}
              </span>
            )}
          </div>

          {/* ── Formulario de datos de tarjeta (solo lectura - auto-generados) ── */}
          <div className="bg-white border border-gray-300">
            <div className="bg-primary-tint-theme px-3 py-2 border-l-4 border-primary-theme">
              <span className="text-sm font-medium text-gray-800">DATOS DE LA TARJETA DE DEBITO</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-4 gap-x-6 gap-y-3">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">NUMERO DE TARJETA</label>
                  <div className="px-2 py-1 text-xs text-gray-700 font-mono bg-gray-50 border border-gray-200 rounded">
                    {maskCardNumber(data.numeroTarjeta)}
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">NOMBRE EN TARJETA</label>
                  <div className="px-2 py-1 text-xs text-gray-700 uppercase bg-gray-50 border border-gray-200 rounded">
                    {data.nombreTarjeta || '-'}
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">FECHA EXPIRACION</label>
                  <div className="px-2 py-1 text-xs text-gray-700 font-mono bg-gray-50 border border-gray-200 rounded">
                    {data.fechaExpiracion || '-'}
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">RED</label>
                  <div className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded">
                    {data.tipoRed}
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">CVV</label>
                  <div className="px-2 py-1 text-xs text-gray-700 font-mono bg-gray-50 border border-gray-200 rounded flex items-center gap-2">
                    {showCvv ? data.cvv : '***'}
                    <button onClick={() => setShowCvv(!showCvv)} className="text-primary-theme hover:underline text-[10px]">
                      {showCvv ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">NIP (4 DIGITOS)</label>
                  <div className="px-2 py-1 text-xs text-gray-700 font-mono bg-gray-50 border border-gray-200 rounded flex items-center gap-2">
                    {showNip ? data.nip : '****'}
                    <button onClick={() => setShowNip(!showNip)} className="text-primary-theme hover:underline text-[10px]">
                      {showNip ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">CLABE INTERBANCARIA</label>
                  <div className="px-2 py-1 text-xs text-gray-700 font-mono bg-gray-50 border border-gray-200 rounded">
                    {data.clabe || '-'}
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS TARJETA</label>
                  {isView ? (
                    <div className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded">
                      {data.estatusTarjeta}
                    </div>
                  ) : (
                    <select
                      value={data.estatusTarjeta}
                      onChange={(e) => handleField('estatusTarjeta', e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Activa">Activa</option>
                      <option value="Bloqueada">Bloqueada</option>
                      <option value="Cancelada">Cancelada</option>
                      <option value="Vencida">Vencida</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}