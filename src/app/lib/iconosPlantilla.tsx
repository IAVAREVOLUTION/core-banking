/**
 * iconosPlantilla — los iconos del catálogo de Tipos de Plantilla.
 *
 * El catálogo guarda el NOMBRE del icono (`FileSignature`), no el glifo. Se
 * resuelve contra este mapa curado en vez de contra todo `lucide-react`:
 * importar la librería completa de forma dinámica metería cientos de iconos
 * al bundle y permitiría guardar un nombre que no existe.
 *
 * ── Compatibilidad hacia atrás ───────────────────────────────────────────
 * Las primeras filas del catálogo se sembraron con emojis. `iconoDeTipo()`
 * traduce esos emojis al icono equivalente, así que una fila vieja se ve bien
 * aunque nadie haya corrido la migración de conversión.
 */
import {
  ClipboardList, FileSignature, Banknote, FileText, Mail, ShieldCheck, Receipt,
  FileCheck, FileClock, FilePlus, FileWarning, ScrollText, NotebookPen,
  BookOpen, Landmark, CreditCard, Wallet, Coins, PiggyBank, Handshake,
  Stamp, Gavel, Briefcase, Building2, UserCheck, Calculator, Percent, Scale,
  type LucideIcon,
} from 'lucide-react';

/** Los iconos que el catálogo puede usar. Agregar uno aquí lo habilita. */
export const ICONOS_PLANTILLA: Record<string, LucideIcon> = {
  ClipboardList, FileSignature, Banknote, FileText, Mail, ShieldCheck, Receipt,
  FileCheck, FileClock, FilePlus, FileWarning, ScrollText, NotebookPen,
  BookOpen, Landmark, CreditCard, Wallet, Coins, PiggyBank, Handshake,
  Stamp, Gavel, Briefcase, Building2, UserCheck, Calculator, Percent, Scale,
};

export const NOMBRES_ICONOS = Object.keys(ICONOS_PLANTILLA);

export const ICONO_POR_DEFECTO = 'FileText';

/**
 * Equivalencias para las filas sembradas con emoji antes de este cambio.
 * Se conserva indefinidamente: es barato y evita que un catálogo que nadie
 * migró se vea con iconos genéricos.
 */
const EMOJI_A_ICONO: Record<string, string> = {
  '📋': 'ClipboardList',
  '📄': 'FileSignature',
  '📝': 'Banknote',
  '📑': 'FileText',
  '📨': 'Mail',
  '🛡️': 'ShieldCheck',
  '🛡': 'ShieldCheck',
  '🧾': 'Receipt',
};

/** Resuelve el nombre guardado —o el emoji heredado— a un componente. */
export function iconoDeTipo(valor: string | undefined | null): LucideIcon {
  const v = String(valor || '').trim();
  if (ICONOS_PLANTILLA[v]) return ICONOS_PLANTILLA[v];
  const porEmoji = EMOJI_A_ICONO[v];
  if (porEmoji && ICONOS_PLANTILLA[porEmoji]) return ICONOS_PLANTILLA[porEmoji];
  return ICONOS_PLANTILLA[ICONO_POR_DEFECTO];
}

/** El nombre canónico, para normalizar al guardar una fila vieja. */
export function nombreIconoDeTipo(valor: string | undefined | null): string {
  const v = String(valor || '').trim();
  if (ICONOS_PLANTILLA[v]) return v;
  return EMOJI_A_ICONO[v] || ICONO_POR_DEFECTO;
}

interface Props {
  nombre: string | undefined | null;
  size?: number;
  color?: string;
  className?: string;
}

/** Pinta el icono de un tipo de plantilla. */
export function IconoTipoPlantilla({ nombre, size = 14, color, className }: Props) {
  const Icono = iconoDeTipo(nombre);
  return <Icono size={size} color={color} className={className} />;
}
