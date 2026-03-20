import React, { useState, useCallback } from 'react';
import { Settings, Save, XCircle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface ParametrosGeneralesData {
  // Datos de la empresa
  nombreCortoEmpresa: string;
  nombreEmpresa: string;
  // Valores predeterminados del distribuidor
  idDistribuidor: string;
  idRegistro: string;
  pais: string;
  nacionalidad: string;
  banco: string;
  edadMinima: string;
  periodoValidezCheque: string;
  // Fechas y montos
  fechaBaja: string;
  fechaAlta: string;
  montoMaximo: string;
  unidadesMaximas: string;
  montoRedondeo: string;
  porcentajeIVA: string;
  nivelPredeterminado: string;
  verificarDuplicadosUH: string;
  periodoModificacion: string;
  contadorMaximo: string;
  idOrigen: string;
  // Configuración fiscal
  codigoPais: string;
  codigoCliente: string;
  fpamInstalado: string;
  usuarioFPAM: string;
  inicioAnioFiscal: string;
  finAnioFiscal: string;
  opcionesEUSD: string;
  nivelLiquidacion: string;
  fechaPagoImpProv: string;
  frecuenciaImpProv: string;
  logicaGeneracionFundID: string;
  // Valores predeterminados de sucursal
  titulo: string;
  estadoCivil: string;
  sexo: string;
  tipoInversionista: string;
  estadoResidencia: string;
  modoPago: string;
  // Auditoría
  capturadoPor: string;
  fechaHoraCaptura: string;
  autorizadoPor: string;
  numeroModificacion: string;
  estado: string;
}

const INITIAL_DATA: ParametrosGeneralesData = {
  nombreCortoEmpresa: 'MFM SAPI',
  nombreEmpresa: 'MASTER FINANCIAL MANAGEMENT SAPI DE CV SOFOM ENR',
  idDistribuidor: 'DIST-001',
  idRegistro: 'REG-2024-00158',
  pais: 'México',
  nacionalidad: 'Mexicana',
  banco: 'BANORTE',
  edadMinima: '18',
  periodoValidezCheque: '180',
  fechaBaja: '',
  fechaAlta: '2020-01-15',
  montoMaximo: '50,000,000.00',
  unidadesMaximas: '999,999',
  montoRedondeo: '0.01',
  porcentajeIVA: '16.00',
  nivelPredeterminado: '1',
  verificarDuplicadosUH: 'Sí',
  periodoModificacion: '90',
  contadorMaximo: '999',
  idOrigen: 'SYS-CORE-001',
  codigoPais: 'MX',
  codigoCliente: 'CLI-DEFAULT',
  fpamInstalado: 'No',
  usuarioFPAM: '',
  inicioAnioFiscal: '2026-01-01',
  finAnioFiscal: '2026-12-31',
  opcionesEUSD: 'No aplica',
  nivelLiquidacion: '2',
  fechaPagoImpProv: '2026-03-17',
  frecuenciaImpProv: '1',
  logicaGeneracionFundID: 'Secuencial automático',
  titulo: 'Sr.',
  estadoCivil: 'Soltero',
  sexo: 'Masculino',
  tipoInversionista: 'Persona Física',
  estadoResidencia: 'Querétaro',
  modoPago: 'Transferencia',
  capturadoPor: 'ADMIN',
  fechaHoraCaptura: '2026-02-10 09:35:22',
  autorizadoPor: 'SUPERVISOR_01',
  numeroModificacion: '14',
  estado: 'Autorizado',
};

// ═══════════════════════════════════════════════════════════════════
// OPCIONES PARA COMBOS
// ═══════════════════════════════════════════════════════════════════
const PAIS_OPTIONS = ['México', 'Estados Unidos', 'Canadá', 'Guatemala', 'Colombia'];
const NACIONALIDAD_OPTIONS = ['Mexicana', 'Estadounidense', 'Canadiense', 'Guatemalteca', 'Colombiana'];
const BANCO_OPTIONS = ['BANORTE', 'BBVA', 'SANTANDER', 'HSBC', 'BANAMEX', 'SCOTIABANK', 'BANREGIO'];
const SI_NO_OPTIONS = ['Sí', 'No'];
const TITULO_OPTIONS = ['Sr.', 'Sra.', 'Lic.', 'Ing.', 'Dr.', 'C.P.', 'Mtro.'];
const ESTADO_CIVIL_OPTIONS = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre'];
const SEXO_OPTIONS = ['Masculino', 'Femenino', 'No especificado'];
const TIPO_INVERSIONISTA_OPTIONS = ['Persona Física', 'Persona Moral', 'Fideicomiso', 'Gobierno'];
const ESTADO_RESIDENCIA_OPTIONS = ['Querétaro', 'Ciudad de México', 'Nuevo León', 'Jalisco', 'Puebla', 'Yucatán', 'Estado de México'];
const MODO_PAGO_OPTIONS = ['Transferencia', 'Cheque', 'Efectivo', 'SPEI', 'Domiciliación'];
const ESTADO_REGISTRO_OPTIONS = ['Abierto', 'Autorizado'];
const EUSD_OPTIONS = ['No aplica', 'Opción A', 'Opción B', 'Opción C'];
const LOGICA_FUNDID_OPTIONS = ['Secuencial automático', 'Basado en fecha', 'UUID', 'Personalizado'];
const FRECUENCIA_OPTIONS = ['1', '2', '3', '6', '12'];

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE: CAMPO DE FORMULARIO (extraído fuera del render)
// ═══════════════════════════════════════════════════════════════════
const FormFieldPG = React.memo(function FormFieldPG({
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
  type?: 'text' | 'select' | 'date' | 'number';
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
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function ParametrosGeneralesSection() {
  const [formData, setFormData] = useState<ParametrosGeneralesData>(INITIAL_DATA);

  const handleChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleCancel = useCallback(() => {
    setFormData(INITIAL_DATA);
  }, []);

  const handleSave = useCallback(() => {
    // Validar campos obligatorios
    const required: { key: keyof ParametrosGeneralesData; label: string }[] = [
      { key: 'edadMinima', label: 'Edad mínima' },
      { key: 'montoMaximo', label: 'Monto máximo' },
      { key: 'unidadesMaximas', label: 'Unidades máximas' },
      { key: 'montoRedondeo', label: 'Monto de redondeo' },
      { key: 'nivelPredeterminado', label: 'Nivel predeterminado' },
    ];
    const missing = required.filter((r) => !formData[r.key].trim());
    if (missing.length > 0) {
      alert(
        `Los siguientes campos son obligatorios:\n${missing.map((m) => `• ${m.label}`).join('\n')}`
      );
      return;
    }
    alert('Parámetros generales guardados correctamente.');
  }, [formData]);

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] bg-gray-100">
      {/* ── ENCABEZADO ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-theme/10 flex items-center justify-center">
            <Settings size={16} className="text-primary-theme" />
          </div>
          <h2
            className="text-sm text-gray-800 tracking-wide"
            style={{ fontWeight: 700 }}
          >
            Mantenimiento de Valores Predeterminados
          </h2>
        </div>
      </div>

      {/* ── FORMULARIO CON SCROLL ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="bg-white rounded border border-gray-200 shadow-sm">
            <div className="px-3 py-2 space-y-1">
              {/* ═════════════ SECCIÓN: DATOS DE LA EMPRESA ═════════════ */}
              <SectionHeader title="Datos de la empresa" />
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 pb-4">
                <FormFieldPG
                  label="Nombre corto de la empresa"
                  name="nombreCortoEmpresa"
                  value={formData.nombreCortoEmpresa}
                  onChange={handleChange}
                />
                <div className="col-span-2">
                  <FormFieldPG
                    label="Nombre de la empresa"
                    name="nombreEmpresa"
                    value={formData.nombreEmpresa}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* ═════════════ SECCIÓN: VALORES PREDETERMINADOS DEL DISTRIBUIDOR ═════════════ */}
              <SectionHeader title="Valores predeterminados del distribuidor" />
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 pb-4">
                <FormFieldPG
                  label="ID del distribuidor"
                  name="idDistribuidor"
                  value={formData.idDistribuidor}
                  onChange={handleChange}
                />
                <FormFieldPG
                  label="ID de registro"
                  name="idRegistro"
                  value={formData.idRegistro}
                  onChange={handleChange}
                />
                <FormFieldPG
                  label="País"
                  name="pais"
                  value={formData.pais}
                  onChange={handleChange}
                  type="select"
                  options={PAIS_OPTIONS}
                />
                <FormFieldPG
                  label="Nacionalidad"
                  name="nacionalidad"
                  value={formData.nacionalidad}
                  onChange={handleChange}
                  type="select"
                  options={NACIONALIDAD_OPTIONS}
                />
                <FormFieldPG
                  label="Banco"
                  name="banco"
                  value={formData.banco}
                  onChange={handleChange}
                  type="select"
                  options={BANCO_OPTIONS}
                />
                <FormFieldPG
                  label="Edad mínima"
                  name="edadMinima"
                  value={formData.edadMinima}
                  onChange={handleChange}
                  required
                />
                <FormFieldPG
                  label="Período de validez del cheque"
                  name="periodoValidezCheque"
                  value={formData.periodoValidezCheque}
                  onChange={handleChange}
                />
              </div>

              {/* ═════════════ SECCIÓN: FECHAS Y MONTOS ═════════════ */}
              <SectionHeader title="Fechas y montos" />
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 pb-4">
                <FormFieldPG
                  label="Fecha baja"
                  name="fechaBaja"
                  value={formData.fechaBaja}
                  onChange={handleChange}
                  type="date"
                />
                <FormFieldPG
                  label="Fecha alta"
                  name="fechaAlta"
                  value={formData.fechaAlta}
                  onChange={handleChange}
                  type="date"
                />
                <FormFieldPG
                  label="Monto máximo"
                  name="montoMaximo"
                  value={formData.montoMaximo}
                  onChange={handleChange}
                  required
                />
                <FormFieldPG
                  label="Unidades máximas"
                  name="unidadesMaximas"
                  value={formData.unidadesMaximas}
                  onChange={handleChange}
                  required
                />
                <FormFieldPG
                  label="Monto de redondeo"
                  name="montoRedondeo"
                  value={formData.montoRedondeo}
                  onChange={handleChange}
                  required
                />
                <FormFieldPG
                  label="Porcentaje de IVA"
                  name="porcentajeIVA"
                  value={formData.porcentajeIVA}
                  onChange={handleChange}
                />
                <FormFieldPG
                  label="Nivel predeterminado"
                  name="nivelPredeterminado"
                  value={formData.nivelPredeterminado}
                  onChange={handleChange}
                  required
                />
                <FormFieldPG
                  label="Verificar duplicados UH"
                  name="verificarDuplicadosUH"
                  value={formData.verificarDuplicadosUH}
                  onChange={handleChange}
                  type="select"
                  options={SI_NO_OPTIONS}
                />
                <FormFieldPG
                  label="Período de modificación"
                  name="periodoModificacion"
                  value={formData.periodoModificacion}
                  onChange={handleChange}
                />
                <FormFieldPG
                  label="Contador máximo"
                  name="contadorMaximo"
                  value={formData.contadorMaximo}
                  onChange={handleChange}
                />
                <FormFieldPG
                  label="ID de origen"
                  name="idOrigen"
                  value={formData.idOrigen}
                  onChange={handleChange}
                />
              </div>

              {/* ═════════════ SECCIÓN: CONFIGURACIÓN FISCAL ═════════════ */}
              <SectionHeader title="Configuración fiscal" />
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 pb-4">
                <FormFieldPG
                  label="Código de país"
                  name="codigoPais"
                  value={formData.codigoPais}
                  onChange={handleChange}
                />
                <FormFieldPG
                  label="Código de cliente"
                  name="codigoCliente"
                  value={formData.codigoCliente}
                  onChange={handleChange}
                />
                <FormFieldPG
                  label="FPAM instalado"
                  name="fpamInstalado"
                  value={formData.fpamInstalado}
                  onChange={handleChange}
                  type="select"
                  options={SI_NO_OPTIONS}
                />
                <FormFieldPG
                  label="Usuario FPAM"
                  name="usuarioFPAM"
                  value={formData.usuarioFPAM}
                  onChange={handleChange}
                />
                <FormFieldPG
                  label="Inicio del año fiscal"
                  name="inicioAnioFiscal"
                  value={formData.inicioAnioFiscal}
                  onChange={handleChange}
                  type="date"
                />
                <FormFieldPG
                  label="Fin del año fiscal"
                  name="finAnioFiscal"
                  value={formData.finAnioFiscal}
                  onChange={handleChange}
                  type="date"
                />
                <FormFieldPG
                  label="Opciones EUSD"
                  name="opcionesEUSD"
                  value={formData.opcionesEUSD}
                  onChange={handleChange}
                  type="select"
                  options={EUSD_OPTIONS}
                />
                <FormFieldPG
                  label="Nivel de liquidación"
                  name="nivelLiquidacion"
                  value={formData.nivelLiquidacion}
                  onChange={handleChange}
                />
                <FormFieldPG
                  label="Fecha pago imp. provisional"
                  name="fechaPagoImpProv"
                  value={formData.fechaPagoImpProv}
                  onChange={handleChange}
                  type="date"
                />
                <FormFieldPG
                  label="Frecuencia imp. prov. (meses)"
                  name="frecuenciaImpProv"
                  value={formData.frecuenciaImpProv}
                  onChange={handleChange}
                  type="select"
                  options={FRECUENCIA_OPTIONS}
                />
                <FormFieldPG
                  label="Lógica generación FundID"
                  name="logicaGeneracionFundID"
                  value={formData.logicaGeneracionFundID}
                  onChange={handleChange}
                  type="select"
                  options={LOGICA_FUNDID_OPTIONS}
                />
              </div>

              {/* ═════════════ SECCIÓN: VALORES PREDETERMINADOS DE SUCURSAL ═════════════ */}
              <SectionHeader title="Valores predeterminados de sucursal" />
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 pb-4">
                <FormFieldPG
                  label="Título"
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleChange}
                  type="select"
                  options={TITULO_OPTIONS}
                />
                <FormFieldPG
                  label="Estado civil"
                  name="estadoCivil"
                  value={formData.estadoCivil}
                  onChange={handleChange}
                  type="select"
                  options={ESTADO_CIVIL_OPTIONS}
                />
                <FormFieldPG
                  label="Sexo"
                  name="sexo"
                  value={formData.sexo}
                  onChange={handleChange}
                  type="select"
                  options={SEXO_OPTIONS}
                />
                <FormFieldPG
                  label="Tipo de inversionista"
                  name="tipoInversionista"
                  value={formData.tipoInversionista}
                  onChange={handleChange}
                  type="select"
                  options={TIPO_INVERSIONISTA_OPTIONS}
                />
                <FormFieldPG
                  label="Estado de residencia"
                  name="estadoResidencia"
                  value={formData.estadoResidencia}
                  onChange={handleChange}
                  type="select"
                  options={ESTADO_RESIDENCIA_OPTIONS}
                />
                <FormFieldPG
                  label="Modo de pago"
                  name="modoPago"
                  value={formData.modoPago}
                  onChange={handleChange}
                  type="select"
                  options={MODO_PAGO_OPTIONS}
                />
              </div>

              {/* ═════════════ SECCIÓN: AUDITORÍA ═════════════ */}
              <SectionHeader title="Auditoría" />
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-4 pb-4">
                <FormFieldPG
                  label="Capturado por"
                  name="capturadoPor"
                  value={formData.capturadoPor}
                  onChange={handleChange}
                  readOnly
                />
                <FormFieldPG
                  label="Fecha y hora"
                  name="fechaHoraCaptura"
                  value={formData.fechaHoraCaptura}
                  onChange={handleChange}
                  readOnly
                />
                <FormFieldPG
                  label="Autorizado por"
                  name="autorizadoPor"
                  value={formData.autorizadoPor}
                  onChange={handleChange}
                  readOnly
                />
                <FormFieldPG
                  label="Número de modificación"
                  name="numeroModificacion"
                  value={formData.numeroModificacion}
                  onChange={handleChange}
                  readOnly
                />
                <FormFieldPG
                  label="Estado"
                  name="estado"
                  value={formData.estado}
                  onChange={handleChange}
                  type="select"
                  options={ESTADO_REGISTRO_OPTIONS}
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