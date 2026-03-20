import React, { useState, useCallback } from 'react';
import { MapPin, Save, XCircle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface ParametrosSucursalesData {
  // Campos superiores
  codigoSucursal: string;
  nombreSucursal: string;
  codigoAlterno: string;
  estadoDisponibilidad: boolean;
  // Detalles Generales — columna izquierda
  sucursalPadre: string;
  oficinaRegional: string;
  codigoPais: string;
  identidadCliente: string;
  monedaLocal: string;
  grupoSucursal: string;
  claseContable: string;
  dsnReporte: string;
  // Detalles Generales — columna central (read-only descriptions)
  descPais: string;
  descCodigoPais: string;
  descMonedaLocal: string;
  // Detalles Generales — columna derecha
  desfaseHoras: string;
  desfaseMinutos: string;
  adelantado: boolean;
  nivelTiempo: string;
  sucursalFondos: boolean;
  permitirAccesoCorporativo: boolean;
  estadoEOC: string;
  valorExterno: string;
  // Zona horaria GMT
  gmtHoras: string;
  gmtMinutos: string;
  gmtAdelantado: boolean;
  // Detalles ATM
  sucursalATM: string;
  idInstitucion: string;
  // Hora de corte
  corteHoras: string;
  corteMinutos: string;
  // Pagos locales
  sucursalCompensacion: string;
  codigoTransaccionConsola: string;
  // Detalles Financieros de Cuenta
  cuentaGLPrincipal: string;
  cuentaGLSecundaria: string;
  monedaCuenta: string;
  tipoCuenta: string;
  categoriaContable: string;
  codigoCentroCosto: string;
  // Detalles de Verificación de Duplicados
  verificarNombreCliente: boolean;
  verificarDocIdentidad: boolean;
  verificarDireccion: boolean;
  verificarTelefono: boolean;
  nivelCoincidencia: string;
  accionDuplicado: string;
  // Detalles de IBAN
  longitudIBAN: string;
  prefijoIBAN: string;
  validarIBAN: boolean;
  formatoIBAN: string;
  // Pestañas inferiores — Preferencias
  idiomaSucursal: string;
  formatoFecha: string;
  formatoHora: string;
  // Dirección SWIFT
  codigoSWIFT: string;
  direccionSWIFT: string;
  ciudadSWIFT: string;
  // Máscara de cuenta
  mascaraCuenta: string;
  longitudMascara: string;
  // Rango CIF
  cifInicio: string;
  cifFin: string;
  cifActual: string;
  // Funciones Globales de Interdicción
  interdiccionHabilitada: boolean;
  proveedorInterdiccion: string;
  // Impuestos
  regimenFiscal: string;
  tasaImpuesto: string;
  // Moneda de Sucursal
  monedaPrincipal: string;
  monedasAdicionales: string;
  // Campos
  campoPersonalizado1: string;
  campoPersonalizado2: string;
  // Auditoría
  creador: string;
  verificador: string;
  fechaHora: string;
  numeroModificacion: string;
  estadoRegistro: string;
  estadoAutorizacion: string;
}

const INITIAL_DATA: ParametrosSucursalesData = {
  codigoSucursal: 'OSD',
  nombreSucursal: 'Bank Futura - Branch OSD',
  codigoAlterno: '000',
  estadoDisponibilidad: true,
  sucursalPadre: '000',
  oficinaRegional: '000',
  codigoPais: 'GB',
  identidadCliente: '',
  monedaLocal: 'GBP',
  grupoSucursal: '',
  claseContable: 'ALL',
  dsnReporte: 'BIP_DSN',
  descPais: 'FLEXCUBE UNIVERSAL BANK',
  descCodigoPais: 'GB',
  descMonedaLocal: 'GREAT BRITAIN POUND',
  desfaseHoras: '0',
  desfaseMinutos: '0',
  adelantado: false,
  nivelTiempo: '0',
  sucursalFondos: false,
  permitirAccesoCorporativo: false,
  estadoEOC: 'N',
  valorExterno: '',
  gmtHoras: '',
  gmtMinutos: '',
  gmtAdelantado: false,
  sucursalATM: '',
  idInstitucion: '',
  corteHoras: '0',
  corteMinutos: '0',
  sucursalCompensacion: '000',
  codigoTransaccionConsola: '',
  cuentaGLPrincipal: '1100-001-0001',
  cuentaGLSecundaria: '1100-002-0001',
  monedaCuenta: 'GBP',
  tipoCuenta: 'Corriente',
  categoriaContable: 'Activos',
  codigoCentroCosto: 'CC-OSD-01',
  verificarNombreCliente: true,
  verificarDocIdentidad: true,
  verificarDireccion: false,
  verificarTelefono: false,
  nivelCoincidencia: '85',
  accionDuplicado: 'Advertir',
  longitudIBAN: '22',
  prefijoIBAN: 'GB',
  validarIBAN: true,
  formatoIBAN: 'GB##-####-####-####-##',
  idiomaSucursal: 'Inglés',
  formatoFecha: 'DD/MM/YYYY',
  formatoHora: '24H',
  codigoSWIFT: 'BKFTGB2L',
  direccionSWIFT: '100 Bank Street',
  ciudadSWIFT: 'London',
  mascaraCuenta: '####-####-####-##',
  longitudMascara: '14',
  cifInicio: '100000',
  cifFin: '999999',
  cifActual: '100245',
  interdiccionHabilitada: true,
  proveedorInterdiccion: 'World-Check',
  regimenFiscal: 'Estándar',
  tasaImpuesto: '20',
  monedaPrincipal: 'GBP',
  monedasAdicionales: 'USD, EUR',
  campoPersonalizado1: '',
  campoPersonalizado2: '',
  creador: 'RAVI01',
  verificador: 'RAVI01',
  fechaHora: '2014-01-01 06:34:28',
  numeroModificacion: '1',
  estadoRegistro: 'Abierto',
  estadoAutorizacion: 'Autorizado',
};

// ═══════════════════════════════════════════════════════════════════
// OPCIONES
// ═══════════════════════════════════════════════════════════════════
const PAIS_OPTIONS = ['GB', 'US', 'MX', 'DE', 'FR', 'ES', 'JP', 'CA', 'BR', 'IN'];
const MONEDA_OPTIONS = ['GBP', 'USD', 'EUR', 'MXN', 'JPY', 'CHF', 'CAD'];
const CLASE_CONTABLE_OPTIONS = ['ALL', 'RETAIL', 'CORPORATE', 'TREASURY', 'TRADE'];
const EOC_OPTIONS = ['N', 'Y'];
const ACCION_DUP_OPTIONS = ['Advertir', 'Bloquear', 'Ignorar'];
const IDIOMA_OPTIONS = ['Inglés', 'Español', 'Portugués', 'Francés'];
const FORMATO_FECHA_OPTIONS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const FORMATO_HORA_OPTIONS = ['24H', '12H'];
const REGIMEN_OPTIONS = ['Estándar', 'Reducido', 'Exento'];
const TIPO_CUENTA_OPTIONS = ['Corriente', 'Ahorro', 'Mercado monetario', 'Fideicomiso'];
const CATEGORIA_OPTIONS = ['Activos', 'Pasivos', 'Capital', 'Ingresos', 'Gastos'];
const ESTADO_REG_OPTIONS = ['Abierto', 'Cerrado', 'Suspendido'];
const ESTADO_AUT_OPTIONS = ['Autorizado', 'Pendiente', 'Rechazado'];

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: CAMPO DE FORMULARIO (React.memo)
// ═══════════════════════════════════════════════════════════════════
const FormFieldPS = React.memo(function FormFieldPS({
  label,
  name,
  value,
  onChange,
  required,
  type = 'text',
  options,
  readOnly,
  className,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
  type?: 'text' | 'select';
  options?: string[];
  readOnly?: boolean;
  className?: string;
}) {
  const baseClasses =
    'flex-1 text-[11px] px-2 py-1 border border-gray-300 rounded bg-white text-gray-800 min-w-0 focus:outline-none focus:ring-1 focus:ring-primary-theme focus:border-primary-theme transition-colors';

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <label className="text-[11px] text-gray-600 w-[170px] flex-shrink-0 text-right whitespace-nowrap">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {':'}
      </label>
      {type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          disabled={readOnly}
          className={`${baseClasses} disabled:bg-gray-100 disabled:text-gray-500`}
        >
          <option value="">-- Seleccionar --</option>
          {options?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          readOnly={readOnly}
          className={`${baseClasses} ${readOnly ? 'bg-gray-100 text-gray-500' : ''}`}
        />
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: CHECKBOX
// ═══════════════════════════════════════════════════════════════════
const CheckFieldPS = React.memo(function CheckFieldPS({
  label,
  name,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (name: string, value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-gray-600 w-[170px] flex-shrink-0 text-right whitespace-nowrap">
        {label}{':'}
      </label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(name, e.target.checked)}
        className="accent-primary-theme w-3.5 h-3.5"
      />
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: ENCABEZADO DE SECCIÓN
// ═══════════════════════════════════════════════════════════════════
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-4 py-1.5">
      <h3 className="text-[11px] text-primary-theme tracking-wide" style={{ fontWeight: 700 }}>
        {title}
      </h3>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: TAB BUTTON
// ═══════════════════════════════════════════════════════════════════
function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[10px] whitespace-nowrap transition-colors border-b-2 ${
        active
          ? 'border-primary-theme text-primary-theme bg-white'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
      style={{ fontWeight: active ? 600 : 400 }}
    >
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TIPOS DE TABS
// ═══════════════════════════════════════════════════════════════════
type MainTab = 'generales' | 'financieros' | 'duplicados' | 'iban';
type LowerTab = 'preferencias' | 'swift' | 'mascara' | 'cif' | 'interdiccion' | 'impuestos' | 'moneda' | 'campos';

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function ParametrosSucursalesSection() {
  const [form, setForm] = useState<ParametrosSucursalesData>(INITIAL_DATA);
  const [mainTab, setMainTab] = useState<MainTab>('generales');
  const [lowerTab, setLowerTab] = useState<LowerTab>('preferencias');

  const handleChange = useCallback((name: string, value: string) => {
    setForm((p) => ({ ...p, [name]: value }));
  }, []);

  const handleCheck = useCallback((name: string, value: boolean) => {
    setForm((p) => ({ ...p, [name]: value }));
  }, []);

  const handleCancel = useCallback(() => setForm(INITIAL_DATA), []);

  const handleSave = useCallback(() => {
    const req: { key: keyof ParametrosSucursalesData; label: string }[] = [
      { key: 'codigoSucursal', label: 'Código de Sucursal' },
      { key: 'nombreSucursal', label: 'Nombre de la Sucursal' },
      { key: 'codigoPais', label: 'Código de País' },
      { key: 'claseContable', label: 'Clase Contable (GL Class)' },
      { key: 'sucursalCompensacion', label: 'Sucursal de Compensación' },
    ];
    const miss = req.filter((r) => !(form[r.key] as string).trim());
    if (miss.length) {
      alert(`Campos obligatorios:\n${miss.map((m) => `• ${m.label}`).join('\n')}`);
      return;
    }
    alert('Parámetros de Sucursal guardados correctamente.');
  }, [form]);

  // ── TAB PRINCIPAL: Detalles Generales ──
  const renderGenerales = () => (
    <div className="py-3 px-4 space-y-4">
      {/* Tres columnas */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
        {/* ── Columna izquierda ── */}
        <div className="space-y-2.5">
          <FormFieldPS label="Sucursal Padre" name="sucursalPadre" value={form.sucursalPadre} onChange={handleChange} />
          <FormFieldPS label="Oficina Regional" name="oficinaRegional" value={form.oficinaRegional} onChange={handleChange} />
          <FormFieldPS label="Código de País" name="codigoPais" value={form.codigoPais} onChange={handleChange} required type="select" options={PAIS_OPTIONS} />
          <FormFieldPS label="Identidad del Cliente" name="identidadCliente" value={form.identidadCliente} onChange={handleChange} />
          <FormFieldPS label="Moneda Local" name="monedaLocal" value={form.monedaLocal} onChange={handleChange} type="select" options={MONEDA_OPTIONS} />
          <FormFieldPS label="Grupo de Sucursal" name="grupoSucursal" value={form.grupoSucursal} onChange={handleChange} />
          <FormFieldPS label="Clase Contable (GL Class)" name="claseContable" value={form.claseContable} onChange={handleChange} required type="select" options={CLASE_CONTABLE_OPTIONS} />
          <FormFieldPS label="DSN de Reporte" name="dsnReporte" value={form.dsnReporte} onChange={handleChange} />
        </div>

        {/* ── Columna central (solo lectura: descripciones) ── */}
        <div className="space-y-2.5">
          <FormFieldPS label="Descripción" name="descPais" value={form.descPais} onChange={handleChange} readOnly />
          <FormFieldPS label="Descripción" name="descCodigoPais" value={form.descCodigoPais} onChange={handleChange} readOnly />
          <FormFieldPS label="Descripción" name="descMonedaLocal" value={form.descMonedaLocal} onChange={handleChange} readOnly />
        </div>

        {/* ── Columna derecha ── */}
        <div className="space-y-2.5">
          <div className="text-[10px] text-gray-500 mb-1 pl-[174px]" style={{ fontWeight: 600 }}>Desfase de Zona Horaria</div>
          <FormFieldPS label="Horas" name="desfaseHoras" value={form.desfaseHoras} onChange={handleChange} />
          <FormFieldPS label="Minutos" name="desfaseMinutos" value={form.desfaseMinutos} onChange={handleChange} />
          <CheckFieldPS label="Adelantado" name="adelantado" checked={form.adelantado} onChange={handleCheck} />
          <FormFieldPS label="Nivel de Tiempo" name="nivelTiempo" value={form.nivelTiempo} onChange={handleChange} />
          <CheckFieldPS label="Sucursal de Fondos" name="sucursalFondos" checked={form.sucursalFondos} onChange={handleCheck} />
          <CheckFieldPS label="Permitir Acceso Corp." name="permitirAccesoCorporativo" checked={form.permitirAccesoCorporativo} onChange={handleCheck} />
          <FormFieldPS label="Estado EOC" name="estadoEOC" value={form.estadoEOC} onChange={handleChange} type="select" options={EOC_OPTIONS} />
          <FormFieldPS label="Valor Externo" name="valorExterno" value={form.valorExterno} onChange={handleChange} />
        </div>
      </div>

      {/* Zona horaria GMT */}
      <SectionHeader title="Zona Horaria GMT" />
      <div className="grid grid-cols-3 gap-x-4 gap-y-2.5 px-4 pb-2">
        <FormFieldPS label="Horas" name="gmtHoras" value={form.gmtHoras} onChange={handleChange} />
        <FormFieldPS label="Minutos" name="gmtMinutos" value={form.gmtMinutos} onChange={handleChange} />
        <CheckFieldPS label="GMT Adelantado" name="gmtAdelantado" checked={form.gmtAdelantado} onChange={handleCheck} />
      </div>

      {/* Sección inferior: 3 bloques lado a lado */}
      <div className="grid grid-cols-3 gap-x-4">
        {/* ATM */}
        <div>
          <SectionHeader title="Detalles de ATM (Cajeros Automáticos)" />
          <div className="space-y-2.5 px-4 py-3">
            <FormFieldPS label="Sucursal ATM" name="sucursalATM" value={form.sucursalATM} onChange={handleChange} />
            <FormFieldPS label="ID de Institución" name="idInstitucion" value={form.idInstitucion} onChange={handleChange} />
          </div>
        </div>
        {/* Hora de corte */}
        <div>
          <SectionHeader title="Hora de Corte (desfase)" />
          <div className="space-y-2.5 px-4 py-3">
            <FormFieldPS label="Horas" name="corteHoras" value={form.corteHoras} onChange={handleChange} />
            <FormFieldPS label="Minutos" name="corteMinutos" value={form.corteMinutos} onChange={handleChange} />
          </div>
        </div>
        {/* Pagos locales */}
        <div>
          <SectionHeader title="Pagos Locales" />
          <div className="space-y-2.5 px-4 py-3">
            <FormFieldPS label="Sucursal de Compensación" name="sucursalCompensacion" value={form.sucursalCompensacion} onChange={handleChange} required />
            <FormFieldPS label="Cód. Trans. Consola" name="codigoTransaccionConsola" value={form.codigoTransaccionConsola} onChange={handleChange} />
          </div>
        </div>
      </div>
    </div>
  );

  // ── TAB PRINCIPAL: Detalles Financieros de Cuenta ──
  const renderFinancieros = () => (
    <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-4">
      <FormFieldPS label="Cuenta GL Principal" name="cuentaGLPrincipal" value={form.cuentaGLPrincipal} onChange={handleChange} />
      <FormFieldPS label="Cuenta GL Secundaria" name="cuentaGLSecundaria" value={form.cuentaGLSecundaria} onChange={handleChange} />
      <FormFieldPS label="Moneda de Cuenta" name="monedaCuenta" value={form.monedaCuenta} onChange={handleChange} type="select" options={MONEDA_OPTIONS} />
      <FormFieldPS label="Tipo de Cuenta" name="tipoCuenta" value={form.tipoCuenta} onChange={handleChange} type="select" options={TIPO_CUENTA_OPTIONS} />
      <FormFieldPS label="Categoría Contable" name="categoriaContable" value={form.categoriaContable} onChange={handleChange} type="select" options={CATEGORIA_OPTIONS} />
      <FormFieldPS label="Código Centro de Costo" name="codigoCentroCosto" value={form.codigoCentroCosto} onChange={handleChange} />
    </div>
  );

  // ── TAB PRINCIPAL: Detalles de Verificación de Duplicados ──
  const renderDuplicados = () => (
    <div className="px-4 py-4 space-y-3">
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        <CheckFieldPS label="Verificar Nombre" name="verificarNombreCliente" checked={form.verificarNombreCliente} onChange={handleCheck} />
        <CheckFieldPS label="Verificar Doc. Identidad" name="verificarDocIdentidad" checked={form.verificarDocIdentidad} onChange={handleCheck} />
        <CheckFieldPS label="Verificar Dirección" name="verificarDireccion" checked={form.verificarDireccion} onChange={handleCheck} />
        <CheckFieldPS label="Verificar Teléfono" name="verificarTelefono" checked={form.verificarTelefono} onChange={handleCheck} />
        <FormFieldPS label="Nivel de Coincidencia (%)" name="nivelCoincidencia" value={form.nivelCoincidencia} onChange={handleChange} />
        <FormFieldPS label="Acción ante Duplicado" name="accionDuplicado" value={form.accionDuplicado} onChange={handleChange} type="select" options={ACCION_DUP_OPTIONS} />
      </div>
    </div>
  );

  // ── TAB PRINCIPAL: Detalles de IBAN ──
  const renderIBAN = () => (
    <div className="px-4 py-4 space-y-3">
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        <FormFieldPS label="Longitud IBAN" name="longitudIBAN" value={form.longitudIBAN} onChange={handleChange} />
        <FormFieldPS label="Prefijo IBAN" name="prefijoIBAN" value={form.prefijoIBAN} onChange={handleChange} />
        <CheckFieldPS label="Validar IBAN" name="validarIBAN" checked={form.validarIBAN} onChange={handleCheck} />
        <div className="col-span-2">
          <FormFieldPS label="Formato IBAN" name="formatoIBAN" value={form.formatoIBAN} onChange={handleChange} />
        </div>
      </div>
    </div>
  );

  const renderMainTab = () => {
    switch (mainTab) {
      case 'generales': return renderGenerales();
      case 'financieros': return renderFinancieros();
      case 'duplicados': return renderDuplicados();
      case 'iban': return renderIBAN();
    }
  };

  // ── PESTAÑAS INFERIORES ──
  const renderLowerTab = () => {
    switch (lowerTab) {
      case 'preferencias':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-3">
            <FormFieldPS label="Idioma de Sucursal" name="idiomaSucursal" value={form.idiomaSucursal} onChange={handleChange} type="select" options={IDIOMA_OPTIONS} />
            <FormFieldPS label="Formato de Fecha" name="formatoFecha" value={form.formatoFecha} onChange={handleChange} type="select" options={FORMATO_FECHA_OPTIONS} />
            <FormFieldPS label="Formato de Hora" name="formatoHora" value={form.formatoHora} onChange={handleChange} type="select" options={FORMATO_HORA_OPTIONS} />
          </div>
        );
      case 'swift':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-3">
            <FormFieldPS label="Código SWIFT" name="codigoSWIFT" value={form.codigoSWIFT} onChange={handleChange} />
            <FormFieldPS label="Dirección SWIFT" name="direccionSWIFT" value={form.direccionSWIFT} onChange={handleChange} />
            <FormFieldPS label="Ciudad SWIFT" name="ciudadSWIFT" value={form.ciudadSWIFT} onChange={handleChange} />
          </div>
        );
      case 'mascara':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-3">
            <FormFieldPS label="Máscara de Cuenta" name="mascaraCuenta" value={form.mascaraCuenta} onChange={handleChange} />
            <FormFieldPS label="Longitud de Máscara" name="longitudMascara" value={form.longitudMascara} onChange={handleChange} />
          </div>
        );
      case 'cif':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-3">
            <FormFieldPS label="CIF Inicio" name="cifInicio" value={form.cifInicio} onChange={handleChange} />
            <FormFieldPS label="CIF Fin" name="cifFin" value={form.cifFin} onChange={handleChange} />
            <FormFieldPS label="CIF Actual" name="cifActual" value={form.cifActual} onChange={handleChange} readOnly />
          </div>
        );
      case 'interdiccion':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-3">
            <CheckFieldPS label="Interdicción Habilitada" name="interdiccionHabilitada" checked={form.interdiccionHabilitada} onChange={handleCheck} />
            <FormFieldPS label="Proveedor" name="proveedorInterdiccion" value={form.proveedorInterdiccion} onChange={handleChange} />
          </div>
        );
      case 'impuestos':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-3">
            <FormFieldPS label="Régimen Fiscal" name="regimenFiscal" value={form.regimenFiscal} onChange={handleChange} type="select" options={REGIMEN_OPTIONS} />
            <FormFieldPS label="Tasa de Impuesto (%)" name="tasaImpuesto" value={form.tasaImpuesto} onChange={handleChange} />
          </div>
        );
      case 'moneda':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-3">
            <FormFieldPS label="Moneda Principal" name="monedaPrincipal" value={form.monedaPrincipal} onChange={handleChange} type="select" options={MONEDA_OPTIONS} />
            <div className="col-span-2">
              <FormFieldPS label="Monedas Adicionales" name="monedasAdicionales" value={form.monedasAdicionales} onChange={handleChange} />
            </div>
          </div>
        );
      case 'campos':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-3">
            <FormFieldPS label="Campo Personalizado 1" name="campoPersonalizado1" value={form.campoPersonalizado1} onChange={handleChange} />
            <FormFieldPS label="Campo Personalizado 2" name="campoPersonalizado2" value={form.campoPersonalizado2} onChange={handleChange} />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] bg-gray-100">
      {/* ── ENCABEZADO ── */}
      <div className="flex items-center px-5 py-3 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-theme/10 flex items-center justify-center">
            <MapPin size={16} className="text-primary-theme" />
          </div>
          <h2 className="text-sm text-gray-800 tracking-wide" style={{ fontWeight: 700 }}>
            Parámetros de Sucursales
          </h2>
        </div>
      </div>

      {/* ── CONTENIDO CON SCROLL ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="bg-white rounded border border-gray-200 shadow-sm">
            <div className="px-3 py-2 space-y-1">

              {/* ═══ CAMPOS SUPERIORES ═══ */}
              <SectionHeader title="Datos de la Sucursal" />
              <div className="grid grid-cols-4 gap-x-4 gap-y-2.5 px-4 pb-3">
                <FormFieldPS label="Código de Sucursal" name="codigoSucursal" value={form.codigoSucursal} onChange={handleChange} required />
                <FormFieldPS label="Nombre de la Sucursal" name="nombreSucursal" value={form.nombreSucursal} onChange={handleChange} required />
                <FormFieldPS label="Código Alterno" name="codigoAlterno" value={form.codigoAlterno} onChange={handleChange} />
                <CheckFieldPS label="Estado Disponibilidad" name="estadoDisponibilidad" checked={form.estadoDisponibilidad} onChange={handleCheck} />
              </div>

              {/* ═══ PESTAÑAS PRINCIPALES ═══ */}
              <div>
                <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
                  <TabBtn label="Detalles Generales" active={mainTab === 'generales'} onClick={() => setMainTab('generales')} />
                  <TabBtn label="Detalles Financieros de Cuenta" active={mainTab === 'financieros'} onClick={() => setMainTab('financieros')} />
                  <TabBtn label="Detalles de Verificación de Duplicados" active={mainTab === 'duplicados'} onClick={() => setMainTab('duplicados')} />
                  <TabBtn label="Detalles de IBAN" active={mainTab === 'iban'} onClick={() => setMainTab('iban')} />
                </div>
                <div className="border border-t-0 border-gray-200 bg-white">
                  {renderMainTab()}
                </div>
              </div>

              {/* ═══ PESTAÑAS INFERIORES ═══ */}
              <div className="mt-1">
                <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
                  <TabBtn label="Preferencias" active={lowerTab === 'preferencias'} onClick={() => setLowerTab('preferencias')} />
                  <TabBtn label="Dirección SWIFT" active={lowerTab === 'swift'} onClick={() => setLowerTab('swift')} />
                  <TabBtn label="Máscara de Cuenta" active={lowerTab === 'mascara'} onClick={() => setLowerTab('mascara')} />
                  <TabBtn label="Rango CIF" active={lowerTab === 'cif'} onClick={() => setLowerTab('cif')} />
                  <TabBtn label="Func. Globales Interdicción" active={lowerTab === 'interdiccion'} onClick={() => setLowerTab('interdiccion')} />
                  <TabBtn label="Impuestos" active={lowerTab === 'impuestos'} onClick={() => setLowerTab('impuestos')} />
                  <TabBtn label="Moneda de Sucursal" active={lowerTab === 'moneda'} onClick={() => setLowerTab('moneda')} />
                  <TabBtn label="Campos" active={lowerTab === 'campos'} onClick={() => setLowerTab('campos')} />
                </div>
                <div className="border border-t-0 border-gray-200 bg-white">
                  {renderLowerTab()}
                </div>
              </div>

              {/* ═══ AUDITORÍA ═══ */}
              <SectionHeader title="Auditoría" />
              <div className="grid grid-cols-3 gap-x-6 gap-y-2.5 px-4 pb-3">
                <FormFieldPS label="Creador" name="creador" value={form.creador} onChange={handleChange} readOnly />
                <FormFieldPS label="Verificador" name="verificador" value={form.verificador} onChange={handleChange} readOnly />
                <FormFieldPS label="Fecha y Hora" name="fechaHora" value={form.fechaHora} onChange={handleChange} readOnly />
                <FormFieldPS label="Núm. de Modificación" name="numeroModificacion" value={form.numeroModificacion} onChange={handleChange} readOnly />
                <FormFieldPS label="Estado del Registro" name="estadoRegistro" value={form.estadoRegistro} onChange={handleChange} type="select" options={ESTADO_REG_OPTIONS} />
                <FormFieldPS label="Estado de Autorización" name="estadoAutorizacion" value={form.estadoAutorizacion} onChange={handleChange} type="select" options={ESTADO_AUT_OPTIONS} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTONES INFERIORES ── */}
      <div className="flex items-center justify-end gap-2 px-5 py-3 bg-white border-t border-gray-300">
        <button
          onClick={handleCancel}
          className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 transition-colors"
        >
          <XCircle size={12} />
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] border border-primary-theme rounded bg-primary-theme hover:bg-primary-hover-theme text-white transition-colors"
        >
          <Save size={12} />
          Guardar
        </button>
      </div>
    </div>
  );
}