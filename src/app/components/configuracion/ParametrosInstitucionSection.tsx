import React, { useState, useCallback } from 'react';
import { Building2, Save, XCircle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface ParametrosInstitucionData {
  // Datos del banco
  codigoBanco: string;
  nombreBanco: string;
  // Sucursal principal
  codigoSucursal: string;
  descripcionSucursal: string;
  // Preferencias financieras — Códigos de moneda
  monedaLocal: string;
  descMonedaLocal: string;
  monedaDescuento: string;
  descMonedaDescuento: string;
  monedaOficinaCentral: string;
  descMonedaOficinaCentral: string;
  monedaReporte: string;
  descMonedaReporte: string;
  // Preferencias financieras — Cuentas de control
  cuentaDifMoneda: string;
  cuentaDifFechaValor: string;
  codigoBancoCompensador: string;
  mascaraRuteo: string;
  // Preferencias generales
  idioma: string;
  zonaHoraria: string;
  formatoFecha: string;
  separadorDecimal: string;
  separadorMiles: string;
  longitudCuenta: string;
  // FATCA
  giin: string;
  paisJurisdiccion: string;
  categoriaEntidad: string;
  estatusFatca: string;
  fechaRegistroFatca: string;
  responsableFatca: string;
  // Sección inferior tabs
  // Preferencias
  nivelAutorizacion: string;
  tiempoSesion: string;
  intentosMaximos: string;
  // Máscara de cuenta
  mascaraCuenta: string;
  longitudMascara: string;
  prefijoDefecto: string;
  // Propiedades de campos
  campoObligatorio1: string;
  campoObligatorio2: string;
  validacionEspecial: string;
  // Auditoría
  creador: string;
  fechaHoraCreacion: string;
  verificador: string;
  fechaHoraVerificacion: string;
  numeroModificacion: string;
  estadoRegistro: string;
  estadoAutorizacion: string;
}

const INITIAL_DATA: ParametrosInstitucionData = {
  codigoBanco: 'BNK-001',
  nombreBanco: 'Banco Nacional de Crédito S.A. de C.V.',
  codigoSucursal: 'SUC-MAIN-001',
  descripcionSucursal: 'Casa Matriz - Ciudad de México',
  monedaLocal: 'MXN',
  descMonedaLocal: 'Peso Mexicano',
  monedaDescuento: 'USD',
  descMonedaDescuento: 'Dólar Estadounidense',
  monedaOficinaCentral: 'MXN',
  descMonedaOficinaCentral: 'Peso Mexicano',
  monedaReporte: 'USD',
  descMonedaReporte: 'Dólar Estadounidense',
  cuentaDifMoneda: '5100-001-0001',
  cuentaDifFechaValor: '5100-002-0001',
  codigoBancoCompensador: 'CECOBAN-040',
  mascaraRuteo: '###-###-####',
  idioma: 'Español',
  zonaHoraria: 'America/Mexico_City (UTC-6)',
  formatoFecha: 'DD/MM/YYYY',
  separadorDecimal: '.',
  separadorMiles: ',',
  longitudCuenta: '18',
  giin: 'A1B2C3.00000.SP.484',
  paisJurisdiccion: 'México',
  categoriaEntidad: 'Institución Financiera Reportante',
  estatusFatca: 'Registrado',
  fechaRegistroFatca: '2023-06-15',
  responsableFatca: 'Lic. Carlos Mendoza Rivera',
  nivelAutorizacion: '2',
  tiempoSesion: '30',
  intentosMaximos: '5',
  mascaraCuenta: '####-####-####-####-##',
  longitudMascara: '18',
  prefijoDefecto: '0001',
  campoObligatorio1: 'RFC',
  campoObligatorio2: 'CURP',
  validacionEspecial: 'Dígito verificador',
  creador: 'ADMIN',
  fechaHoraCreacion: '2026-01-20 10:15:33',
  verificador: 'SUPERVISOR_01',
  fechaHoraVerificacion: '2026-01-20 14:22:10',
  numeroModificacion: '8',
  estadoRegistro: 'Activo',
  estadoAutorizacion: 'Autorizado',
};

// ═══════════════════════════════════════════════════════════════════
// OPCIONES PARA COMBOS
// ═══════════════════════════════════════════════════════════════════
const MONEDA_OPTIONS = ['MXN', 'USD', 'EUR', 'GBP', 'CAD', 'JPY', 'CHF'];
const IDIOMA_OPTIONS = ['Español', 'Inglés', 'Portugués'];
const ZONA_OPTIONS = [
  'America/Mexico_City (UTC-6)',
  'America/Cancun (UTC-5)',
  'America/Tijuana (UTC-8)',
  'America/New_York (UTC-5)',
];
const FORMATO_FECHA_OPTIONS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const SEPARADOR_DEC_OPTIONS = ['.', ','];
const SEPARADOR_MILES_OPTIONS = [',', '.', ' '];
const CATEGORIA_FATCA_OPTIONS = [
  'Institución Financiera Reportante',
  'Institución Financiera No Reportante',
  'Entidad No Financiera Activa',
  'Entidad No Financiera Pasiva',
];
const ESTATUS_FATCA_OPTIONS = ['Registrado', 'Pendiente', 'Exento', 'No aplica'];
const ESTADO_REGISTRO_OPTIONS = ['Activo', 'Inactivo', 'Suspendido'];
const ESTADO_AUTORIZACION_OPTIONS = ['Autorizado', 'Pendiente', 'Rechazado'];
const VALIDACION_OPTIONS = ['Dígito verificador', 'Módulo 10', 'Módulo 11', 'Ninguna'];
const NIVEL_AUTORIZACION_OPTIONS = ['1', '2', '3', '4'];

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: CAMPO DE FORMULARIO (React.memo, fuera del render)
// ═══════════════════════════════════════════════════════════════════
const FormFieldPI = React.memo(function FormFieldPI({
  label,
  name,
  value,
  onChange,
  required,
  type = 'text',
  options,
  readOnly,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
  type?: 'text' | 'select' | 'date';
  options?: string[];
  readOnly?: boolean;
}) {
  const baseInputClasses =
    'flex-1 text-[11px] px-2 py-1.5 border border-gray-300 rounded bg-white text-gray-800 min-w-0 focus:outline-none focus:ring-1 focus:ring-primary-theme focus:border-primary-theme transition-colors';

  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-gray-600 w-[180px] flex-shrink-0 text-right">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {':'}
      </label>
      {type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          disabled={readOnly}
          className={`${baseInputClasses} disabled:bg-gray-50 disabled:text-gray-500`}
        >
          <option value="">-- Seleccionar --</option>
          {options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : type === 'date' ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          readOnly={readOnly}
          className={`${baseInputClasses} read-only:bg-gray-50`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          readOnly={readOnly}
          className={`${baseInputClasses} read-only:bg-gray-50`}
        />
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: ENCABEZADO DE SECCIÓN
// ═══════════════════════════════════════════════════════════════════
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-4 py-2 mb-4 mt-2">
      <h3
        className="text-xs text-primary-theme tracking-wide"
        style={{ fontWeight: 700 }}
      >
        {title}
      </h3>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: SUBSECCIÓN (título más sutil dentro de una pestaña)
// ═══════════════════════════════════════════════════════════════════
function SubSectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-gray-200 pb-1 mb-3 mt-1">
      <h4
        className="text-[11px] text-gray-700 tracking-wide"
        style={{ fontWeight: 600 }}
      >
        {title}
      </h4>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: TAB BUTTON
// ═══════════════════════════════════════════════════════════════════
function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-[11px] transition-colors border-b-2 ${
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
// TABS SUPERIORES
// ═══════════════════════════════════════════════════════════════════
type UpperTab = 'financieras' | 'generales' | 'fatca';
type LowerTab = 'preferencias' | 'mascara' | 'propiedades';

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function ParametrosInstitucionSection() {
  const [formData, setFormData] = useState<ParametrosInstitucionData>(INITIAL_DATA);
  const [upperTab, setUpperTab] = useState<UpperTab>('financieras');
  const [lowerTab, setLowerTab] = useState<LowerTab>('preferencias');

  const handleChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleCancel = useCallback(() => {
    setFormData(INITIAL_DATA);
  }, []);

  const handleSave = useCallback(() => {
    const required: { key: keyof ParametrosInstitucionData; label: string }[] = [
      { key: 'codigoBanco', label: 'Código del banco' },
      { key: 'codigoSucursal', label: 'Código de sucursal' },
      { key: 'monedaLocal', label: 'Moneda local' },
      { key: 'monedaDescuento', label: 'Moneda de descuento' },
      { key: 'monedaOficinaCentral', label: 'Moneda de oficina central' },
      { key: 'monedaReporte', label: 'Moneda de reporte' },
    ];
    const missing = required.filter((r) => !formData[r.key].trim());
    if (missing.length > 0) {
      alert(
        `Los siguientes campos son obligatorios:\n${missing.map((m) => `• ${m.label}`).join('\n')}`
      );
      return;
    }
    alert('Parámetros de la Institución guardados correctamente.');
  }, [formData]);

  // ── Render del contenido de la pestaña superior ──
  const renderUpperTabContent = () => {
    switch (upperTab) {
      case 'financieras':
        return (
          <div className="space-y-2">
            <SubSectionHeader title="Códigos de moneda por defecto del banco" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 pb-4">
              <FormFieldPI
                label="Moneda local"
                name="monedaLocal"
                value={formData.monedaLocal}
                onChange={handleChange}
                required
                type="select"
                options={MONEDA_OPTIONS}
              />
              <FormFieldPI
                label="Descripción de moneda"
                name="descMonedaLocal"
                value={formData.descMonedaLocal}
                onChange={handleChange}
              />
              <FormFieldPI
                label="Moneda de descuento"
                name="monedaDescuento"
                value={formData.monedaDescuento}
                onChange={handleChange}
                required
                type="select"
                options={MONEDA_OPTIONS}
              />
              <FormFieldPI
                label="Descripción de moneda"
                name="descMonedaDescuento"
                value={formData.descMonedaDescuento}
                onChange={handleChange}
              />
              <FormFieldPI
                label="Moneda de oficina central"
                name="monedaOficinaCentral"
                value={formData.monedaOficinaCentral}
                onChange={handleChange}
                required
                type="select"
                options={MONEDA_OPTIONS}
              />
              <FormFieldPI
                label="Descripción de moneda"
                name="descMonedaOficinaCentral"
                value={formData.descMonedaOficinaCentral}
                onChange={handleChange}
              />
              <FormFieldPI
                label="Moneda de reporte"
                name="monedaReporte"
                value={formData.monedaReporte}
                onChange={handleChange}
                required
                type="select"
                options={MONEDA_OPTIONS}
              />
              <FormFieldPI
                label="Descripción de moneda"
                name="descMonedaReporte"
                value={formData.descMonedaReporte}
                onChange={handleChange}
              />
            </div>

            <SubSectionHeader title="Cuentas de control para asientos reales" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 pb-4">
              <FormFieldPI
                label="Cta. diferencia de moneda"
                name="cuentaDifMoneda"
                value={formData.cuentaDifMoneda}
                onChange={handleChange}
              />
              <FormFieldPI
                label="Cta. diferencia fecha valor"
                name="cuentaDifFechaValor"
                value={formData.cuentaDifFechaValor}
                onChange={handleChange}
              />
              <FormFieldPI
                label="Código banco compensador"
                name="codigoBancoCompensador"
                value={formData.codigoBancoCompensador}
                onChange={handleChange}
              />
              <FormFieldPI
                label="Máscara de ruteo"
                name="mascaraRuteo"
                value={formData.mascaraRuteo}
                onChange={handleChange}
              />
            </div>
          </div>
        );

      case 'generales':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-4">
            <FormFieldPI
              label="Idioma"
              name="idioma"
              value={formData.idioma}
              onChange={handleChange}
              type="select"
              options={IDIOMA_OPTIONS}
            />
            <FormFieldPI
              label="Zona horaria"
              name="zonaHoraria"
              value={formData.zonaHoraria}
              onChange={handleChange}
              type="select"
              options={ZONA_OPTIONS}
            />
            <FormFieldPI
              label="Formato de fecha"
              name="formatoFecha"
              value={formData.formatoFecha}
              onChange={handleChange}
              type="select"
              options={FORMATO_FECHA_OPTIONS}
            />
            <FormFieldPI
              label="Separador decimal"
              name="separadorDecimal"
              value={formData.separadorDecimal}
              onChange={handleChange}
              type="select"
              options={SEPARADOR_DEC_OPTIONS}
            />
            <FormFieldPI
              label="Separador de miles"
              name="separadorMiles"
              value={formData.separadorMiles}
              onChange={handleChange}
              type="select"
              options={SEPARADOR_MILES_OPTIONS}
            />
            <FormFieldPI
              label="Longitud de cuenta"
              name="longitudCuenta"
              value={formData.longitudCuenta}
              onChange={handleChange}
            />
          </div>
        );

      case 'fatca':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-4">
            <FormFieldPI
              label="GIIN"
              name="giin"
              value={formData.giin}
              onChange={handleChange}
            />
            <FormFieldPI
              label="País de jurisdicción"
              name="paisJurisdiccion"
              value={formData.paisJurisdiccion}
              onChange={handleChange}
            />
            <FormFieldPI
              label="Categoría de entidad"
              name="categoriaEntidad"
              value={formData.categoriaEntidad}
              onChange={handleChange}
              type="select"
              options={CATEGORIA_FATCA_OPTIONS}
            />
            <FormFieldPI
              label="Estatus FATCA"
              name="estatusFatca"
              value={formData.estatusFatca}
              onChange={handleChange}
              type="select"
              options={ESTATUS_FATCA_OPTIONS}
            />
            <FormFieldPI
              label="Fecha de registro"
              name="fechaRegistroFatca"
              value={formData.fechaRegistroFatca}
              onChange={handleChange}
              type="date"
            />
            <FormFieldPI
              label="Responsable FATCA"
              name="responsableFatca"
              value={formData.responsableFatca}
              onChange={handleChange}
            />
          </div>
        );
    }
  };

  // ── Render del contenido de la pestaña inferior ──
  const renderLowerTabContent = () => {
    switch (lowerTab) {
      case 'preferencias':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-4">
            <FormFieldPI
              label="Nivel de autorización"
              name="nivelAutorizacion"
              value={formData.nivelAutorizacion}
              onChange={handleChange}
              type="select"
              options={NIVEL_AUTORIZACION_OPTIONS}
            />
            <FormFieldPI
              label="Tiempo de sesión (min)"
              name="tiempoSesion"
              value={formData.tiempoSesion}
              onChange={handleChange}
            />
            <FormFieldPI
              label="Intentos máximos"
              name="intentosMaximos"
              value={formData.intentosMaximos}
              onChange={handleChange}
            />
          </div>
        );

      case 'mascara':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-4">
            <FormFieldPI
              label="Máscara de cuenta"
              name="mascaraCuenta"
              value={formData.mascaraCuenta}
              onChange={handleChange}
            />
            <FormFieldPI
              label="Longitud de máscara"
              name="longitudMascara"
              value={formData.longitudMascara}
              onChange={handleChange}
            />
            <FormFieldPI
              label="Prefijo por defecto"
              name="prefijoDefecto"
              value={formData.prefijoDefecto}
              onChange={handleChange}
            />
          </div>
        );

      case 'propiedades':
        return (
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 py-4">
            <FormFieldPI
              label="Campo obligatorio 1"
              name="campoObligatorio1"
              value={formData.campoObligatorio1}
              onChange={handleChange}
            />
            <FormFieldPI
              label="Campo obligatorio 2"
              name="campoObligatorio2"
              value={formData.campoObligatorio2}
              onChange={handleChange}
            />
            <FormFieldPI
              label="Validación especial"
              name="validacionEspecial"
              value={formData.validacionEspecial}
              onChange={handleChange}
              type="select"
              options={VALIDACION_OPTIONS}
            />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] bg-gray-100">
      {/* ── ENCABEZADO ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-theme/10 flex items-center justify-center">
            <Building2 size={16} className="text-primary-theme" />
          </div>
          <h2
            className="text-sm text-gray-800 tracking-wide"
            style={{ fontWeight: 700 }}
          >
            Parámetros Generales del Banco
          </h2>
        </div>
      </div>

      {/* ── FORMULARIO CON SCROLL ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="bg-white rounded border border-gray-200 shadow-sm">
            <div className="px-3 py-2 space-y-1">

              {/* ═════════════ SECCIÓN: DATOS DEL BANCO ═════════════ */}
              <SectionHeader title="Datos del banco" />
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 pb-4">
                <FormFieldPI
                  label="Código del banco"
                  name="codigoBanco"
                  value={formData.codigoBanco}
                  onChange={handleChange}
                  required
                />
                <div className="col-span-2">
                  <FormFieldPI
                    label="Nombre del banco"
                    name="nombreBanco"
                    value={formData.nombreBanco}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* ═════════════ SECCIÓN: SUCURSAL PRINCIPAL ═════════════ */}
              <SectionHeader title="Sucursal principal" />
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 pb-4">
                <FormFieldPI
                  label="Código de sucursal"
                  name="codigoSucursal"
                  value={formData.codigoSucursal}
                  onChange={handleChange}
                  required
                />
                <div className="col-span-2">
                  <FormFieldPI
                    label="Descripción de la sucursal"
                    name="descripcionSucursal"
                    value={formData.descripcionSucursal}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* ═════════════ PESTAÑAS SUPERIORES ═════════════ */}
              <div className="mt-2">
                <div className="flex border-b border-gray-200 bg-gray-50">
                  <TabButton
                    label="Preferencias financieras"
                    active={upperTab === 'financieras'}
                    onClick={() => setUpperTab('financieras')}
                  />
                  <TabButton
                    label="Preferencias generales"
                    active={upperTab === 'generales'}
                    onClick={() => setUpperTab('generales')}
                  />
                  <TabButton
                    label="FATCA"
                    active={upperTab === 'fatca'}
                    onClick={() => setUpperTab('fatca')}
                  />
                </div>
                <div className="border border-t-0 border-gray-200 rounded-b bg-white">
                  {renderUpperTabContent()}
                </div>
              </div>

              {/* ═════════════ PESTAÑAS INFERIORES ═════════════ */}
              <div className="mt-2">
                <div className="flex border-b border-gray-200 bg-gray-50">
                  <TabButton
                    label="Preferencias"
                    active={lowerTab === 'preferencias'}
                    onClick={() => setLowerTab('preferencias')}
                  />
                  <TabButton
                    label="Máscara de cuenta"
                    active={lowerTab === 'mascara'}
                    onClick={() => setLowerTab('mascara')}
                  />
                  <TabButton
                    label="Propiedades de campos"
                    active={lowerTab === 'propiedades'}
                    onClick={() => setLowerTab('propiedades')}
                  />
                </div>
                <div className="border border-t-0 border-gray-200 rounded-b bg-white">
                  {renderLowerTabContent()}
                </div>
              </div>

              {/* ═════════════ SECCIÓN: AUDITORÍA ═════════════ */}
              <SectionHeader title="Auditoría" />
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 pb-4">
                <FormFieldPI
                  label="Creador"
                  name="creador"
                  value={formData.creador}
                  onChange={handleChange}
                  readOnly
                />
                <FormFieldPI
                  label="Fecha y hora"
                  name="fechaHoraCreacion"
                  value={formData.fechaHoraCreacion}
                  onChange={handleChange}
                  readOnly
                />
                <FormFieldPI
                  label="Verificador"
                  name="verificador"
                  value={formData.verificador}
                  onChange={handleChange}
                  readOnly
                />
                <FormFieldPI
                  label="Fecha y hora"
                  name="fechaHoraVerificacion"
                  value={formData.fechaHoraVerificacion}
                  onChange={handleChange}
                  readOnly
                />
                <FormFieldPI
                  label="Número de modificación"
                  name="numeroModificacion"
                  value={formData.numeroModificacion}
                  onChange={handleChange}
                  readOnly
                />
                <FormFieldPI
                  label="Estado del registro"
                  name="estadoRegistro"
                  value={formData.estadoRegistro}
                  onChange={handleChange}
                  type="select"
                  options={ESTADO_REGISTRO_OPTIONS}
                />
                <FormFieldPI
                  label="Estado de autorización"
                  name="estadoAutorizacion"
                  value={formData.estadoAutorizacion}
                  onChange={handleChange}
                  type="select"
                  options={ESTADO_AUTORIZACION_OPTIONS}
                />
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