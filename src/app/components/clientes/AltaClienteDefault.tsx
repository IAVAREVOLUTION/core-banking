import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';
import { Cliente } from './ClientesList';
import { ExpedientesElectronicos } from './ExpedientesElectronicos';
import { SIC } from './SIC';
import { KYCTab } from './tabs';
import { PerfilTransaccional } from './PerfilTransaccional';
import { ArchivosAdjuntos } from './ArchivosAdjuntos';
import { Garantias } from '@/app/components/clientes/Garantias';
import { CuentaAhorro } from './CuentaAhorro';
import { SolicitudesCredito } from './SolicitudesCredito';
import { Creditos } from './Creditos';
import { Inversiones } from './Inversiones';
import { Movimientos } from './Movimientos';
import { Avisos } from './Avisos';
import { Auditoria } from './Auditoria';
import { DatePicker } from './DatePicker';
import { PercentageInput } from './PercentageInput';
import { calcularEdad } from './temp_helpers';
import { TabuladorProductos } from './TabuladorProductos';
import { Convenios } from './Convenios';
import { CobranzaNormal } from './CobranzaNormal';
import { CobranzaAcumulativa } from './CobranzaAcumulativa';
import { EstadoCuenta } from './EstadoCuenta';
import { Calendario } from './Calendario';
import { TarjetaDebito } from './TarjetaDebito';
import { Cotizaciones } from './Cotizaciones';
import { PersonasRelacionadas } from './PersonasRelacionadas';
import { CampoInstitucionGobierno } from '../ui/CatalogoInstitucionGobierno';
import type { InstitucionGobiernoSeleccion } from '../ui/CatalogoInstitucionGobierno';
import { useCatalogoClasificaciones } from '../../hooks/useCatalogoClasificaciones';
import { syncToJClientes } from '../../hooks/useSyncJClientes';
// REGLA INSTITUCIONAL: El módulo Cliente NO valida cuentas.
// La validación de Cuenta Eje solo se ejecuta en el módulo Cuentas de Ahorro.
// Ver: /src/imports/cliente-cuenta-validacion-fix.md
import { 
  useClientePersistence, 
  useClienteTabs, 
  useClienteSubtabList,
  clearAllClienteData 
} from '@/app/hooks/useClientePersistence';

type FormMode = 'nuevo' | 'editar' | 'ver';

interface AltaClienteDefaultProps {
  onBack: () => void;
  onSave?: (clienteData: any) => void;
  mode: FormMode;
  cliente?: Cliente;
  onNavigateToCotizacion?: (cotizacionId: string, linea: string) => void;
}

/**
 * Normaliza el valor de subtipo de J_CLIENTES al formato del dropdown Personalidad.
 * "Persona Física" / "Persona Fisica" → "Física"
 * "Persona Moral"                     → "Moral"
 * "Persona Física con Actividad Empresarial" / "PFAE" → "PFAE"
 * Si ya viene como "Física"/"Moral"/"PFAE" lo deja igual.
 */
function normalizePersonalidad(raw: string | undefined | null): string {
  if (!raw) return '';
  const v = raw.trim();
  if (/^persona\s+f[ií]sica\s+con/i.test(v) || v === 'PFAE') return 'PFAE';
  if (/^persona\s+f[ií]sica/i.test(v) || v === 'Física' || v === 'Fisica') return 'Física';
  if (/^persona\s+moral/i.test(v) || v === 'Moral') return 'Moral';
  return v; // fallback: devolver tal cual
}

interface FormData {
  idCliente: string;
  personalidad: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  razonSocial: string;
  fechaNacimiento: string;
  rfc: string;
  curp: string;
  edad: string;
  
  sexo: string;
  estadoCivil: string;
  rfcAdicional: string;
  entidadFederativa: string;
  entidadFederativaNacimiento: string;
  entidadResidencia: string;
  nivelEstudios: string;
  nacionalidad: string;
  lenguaje: string;
  moneda: string;
  
  sucursal: string;
  fechaCuentaEje: string;
  fechaAlta: string;
  estatusSIC: string;
  estatusListaNegra: string;
  estatusCliente: string;
  calificacionCliente: string;
  
  // Campos financieros y tarjeta de débito
  cuentaEje: string;
  saldoCuentaEje: string;
  fechaActivacion: string;
  activacionTarjetaDebito: boolean;
  numeroTarjetaDebito: string;
  clasificacionCliente: string;
  
  telefonoDomicilio: string;
  telefonoOficina: string;
  telefonoCasa: string;
  direccion: string;
  direccionCalle: string;
  direccionNumeroExterior: string;
  direccionNumeroInterior: string;
  direccionColonia: string;
  direccionCodigoPostal: string;
  direccionCiudad: string;
  direccionEstado: string;
  correoElectronico: string;
  fax: string;
  datosContacto: string;
  
  tipoEmpleo: string;
  nombreEmpresa: string;
  dependienteEconomico: string;
  ingresoMensual: string;
  aniosLaborados: string;
  otrosIngresos: string;
  
  puestoNombre: string;
  nombreAval: string;
  direccionEmpresa: string;
  
  sector: string;
  actividadEconomica1: string;
  actividadEconomica2: string;
  datosAdicionales: string;
  
  // Nuevos campos
  claveDescuento: string;
  zonaPagadora: string;
  porcentajeDescuento: string;
  minimoLiquidez: string;
  tipoCobranza: string;
  claveDependencia: string;
  
  // Campo opcional: Institución Gobierno
  institucionGobierno: string;
  institucionGobiernoId: string;
}

/**
 * COMPONENTE PRINCIPAL: Alta de Clientes con Persistencia Completa
 * 
 * SISTEMA DE PERSISTENCIA:
 * - Todos los datos se persisten automáticamente en sessionStorage
 * - Cada cliente tiene datos únicos vinculados a su ID
 * - Los datos se mantienen al navegar entre tabs y módulos
 * - Se limpian automáticamente al guardar o cambiar de cliente
 * 
 * PARA AGREGAR PERSISTENCIA A UN NUEVO SUBTAB:
 * 1. Usar useClienteSubtabList o useClienteSubtabPersistence
 * 2. Pasar el clienteId y un nombre único para el subtab
 * 3. Los datos se persisten automáticamente
 * 
 * Ver: /src/app/hooks/useClientePersistence.ts
 * Documentación: /PERSISTENCIA_CLIENTES.md
 */
export function AltaClienteDefault({ onBack, onSave, mode, cliente, onNavigateToCotizacion }: AltaClienteDefaultProps) {
  const isView = mode === 'ver';

  // ── Catálogo de clasificaciones de cliente desde DB ──
  const { clasificaciones: catalogoClasificaciones } = useCatalogoClasificaciones();
  
  // ========================================
  // PERSISTENCIA: ID único del cliente
  // ========================================
  // Determinar el ID del cliente (usar el ID existente o generar uno temporal para nuevos registros)
  // IMPORTANTE: Usar useState para que el ID temporal sea estable durante la vida del componente
  const [tempId] = useState(() => `temp_${Date.now()}`);
  const clienteId = (cliente as any)?.dbUuid?.toString() || cliente?.id?.toString() || (cliente as any)?.idCliente?.toString() || tempId;
  const storageKey = `cliente_${clienteId}`;
  
  // Estados locales que no necesitan persistencia
  const [camposEditables, setCamposEditables] = useState(true);
  const [mostrarGuardar, setMostrarGuardar] = useState(true);
  const [showDireccionModal, setShowDireccionModal] = useState(false);
  const [showListaNegraModal, setShowListaNegraModal] = useState(false);
  // ID de dirección en edición (null = modo nuevo)
  const [editingDireccionId, setEditingDireccionId] = useState<number | null>(null);
  // Diagnóstico: rastrear fuente de datos de direcciones
  const [direccionesDiag, setDireccionesDiag] = useState<{
    source: string;
    count: number;
    rawKeys: string[];
    rawDirecciones: any;
    dbUuid: string;
  } | null>(null);
  const [showDireccionesDiag, setShowDireccionesDiag] = useState(false);
  // Diagnóstico: rastrear fuente de datos de Expedientes, SIC, Listas Negras
  const [subtabsDiag, setSubtabsDiag] = useState<{
    expedientes: { rawNode: any; loaded: number };
    sic: { rawNode: any; loaded: number };
    listasNegras: { rawNode: any; loaded: number };
    rawKeys: string[];
    dbUuid: string;
  } | null>(null);
  const [showSubtabDiag, setShowSubtabDiag] = useState<Record<string, boolean>>({});
  // Raw JSONB data del cliente — se pasa a ExpedientesElectronicos para detectar archivos como constanciaResidencia
  const [clienteRawData, setClienteRawData] = useState<Record<string, any>>({});
  const [listaNegraForm, setListaNegraForm] = useState({
    nombreLista: '',
    tipoLista: '',
    estatus: ''
  });
  
  // Estado para el formulario de nueva dirección
  const [nuevaDireccionForm, setNuevaDireccionForm] = useState({
    pais: 'México',
    atencion: '',
    destinatario: '',
    tipoCalle: '',
    calle: '',
    numeroExterior: '',
    piso: '',
    numeroInterior: '',
    codigoPostal: '',
    colonia: '',
    municipio: '',
    ciudad: '',
    estado: '',
    tipoDireccion: 'Particular',
  });

  // Función helper para formatear fechas a DD/MM/YYYY
  const formatDateToDDMMYYYY = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Función helper para formatear fechas con hora a DD/MM/YYYY HH:MM:SS
  const formatDateTimeToStandard = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  // Función helper para normalizar cualquier formato de fecha a DD/MM/YYYY
  const normalizeDateString = (dateStr: string): string => {
    if (!dateStr) {
      return formatDateToDDMMYYYY(new Date());
    }
    
    // Si ya está en formato DD/MM/YYYY, retornar tal cual
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Si está en formato ISO (YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS)
    if (dateStr.includes('-') || dateStr.includes('T')) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return formatDateToDDMMYYYY(date);
      }
    }
    
    // Si está en formato DD/MM/YY, convertir a DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      const fullYear = 2000 + parseInt(year);
      return `${day}/${month}/${fullYear}`;
    }
    
    // Por defecto, retornar la fecha actual
    return formatDateToDDMMYYYY(new Date());
  };

  // Función helper para normalizar fecha con hora a DD/MM/YYYY HH:MM:SS
  const normalizeDateTimeString = (dateTimeStr: string): string => {
    if (!dateTimeStr) {
      return formatDateTimeToStandard(new Date());
    }
    
    // Si ya está en formato DD/MM/YYYY HH:MM:SS, retornar tal cual
    if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(dateTimeStr)) {
      return dateTimeStr;
    }
    
    // Si contiene formato ISO en la parte de fecha
    if (dateTimeStr.includes('T') || dateTimeStr.includes('-')) {
      // Extraer solo la parte de fecha antes del espacio si existe
      const parts = dateTimeStr.split(' ');
      const datePart = parts[0];
      const timePart = parts[1] || '20:12:05';
      
      // Normalizar la fecha
      const normalizedDate = normalizeDateString(datePart);
      
      // Retornar fecha normalizada + hora
      return `${normalizedDate} ${timePart}`;
    }
    
    // Por defecto, retornar fecha/hora actual
    return formatDateTimeToStandard(new Date());
  };

  // ========================================
  // PERSISTENCIA: Datos principales del cliente
  // ========================================
  const getInitialFormData = (): FormData => {
    // Valores por defecto para MODO NUEVO
    const defaultNewClientData: FormData = {
      idCliente: String(Date.now() + Math.floor(Math.random() * 1000)),
      personalidad: 'Física',
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      razonSocial: '',
      fechaNacimiento: '',
      rfc: '',
      curp: '',
      edad: '',
      
      sexo: '',
      estadoCivil: '',
      rfcAdicional: '',
      entidadFederativa: '',
      entidadFederativaNacimiento: '',
      entidadResidencia: '',
      nivelEstudios: '',
      nacionalidad: '',
      lenguaje: '',
      moneda: '',
      
      sucursal: '',
      fechaCuentaEje: '',
      fechaAlta: '',
      estatusSIC: '',
      estatusListaNegra: '',
      estatusCliente: '',
      calificacionCliente: '',
      
      // Campos financieros y tarjeta de débito
      cuentaEje: '',
      saldoCuentaEje: '',
      fechaActivacion: '',
      activacionTarjetaDebito: false,
      numeroTarjetaDebito: '',
      clasificacionCliente: '',
      
      telefonoDomicilio: '',
      telefonoOficina: '',
      telefonoCasa: '',
      direccion: '',
      direccionCalle: '',
      direccionNumeroExterior: '',
      direccionNumeroInterior: '',
      direccionColonia: '',
      direccionCodigoPostal: '',
      direccionCiudad: '',
      direccionEstado: '',
      correoElectronico: '',
      fax: '',
      datosContacto: '',
      
      tipoEmpleo: '',
      nombreEmpresa: '',
      dependienteEconomico: '',
      ingresoMensual: '',
      aniosLaborados: '',
      otrosIngresos: '',
      
      puestoNombre: '',
      nombreAval: '',
      direccionEmpresa: '',
      
      sector: '',
      actividadEconomica1: '',
      actividadEconomica2: '',
      datosAdicionales: '',
      
      // Nuevos campos
      claveDescuento: '',
      zonaPagadora: '',
      porcentajeDescuento: '',
      minimoLiquidez: '',
      tipoCobranza: '',
      claveDependencia: '',
      
      institucionGobierno: '',
      institucionGobiernoId: '',
    };

    // MODO EDITAR o VER: Cargar datos del cliente existente, mergeando con defaults
    if ((mode === 'editar' || mode === 'ver') && cliente) {
      return {
        ...defaultNewClientData,
        ...(cliente as unknown as FormData),
        // En modo editar/ver NO usar defaults hardcodeados — solo lo que venga del cliente
        idCliente: (cliente as any).id?.toString() || (cliente as any).idCliente?.toString() || defaultNewClientData.idCliente,
        personalidad: normalizePersonalidad((cliente as any).personalidad || (cliente as any).subtipo),
        nombre: (cliente as any).nombre || '',
        apellidoPaterno: (cliente as any).apellidoPaterno || '',
        apellidoMaterno: (cliente as any).apellidoMaterno || '',
        razonSocial: (cliente as any).razonSocial || '',
        fechaNacimiento: (cliente as any).fechaNacimiento || '',
        rfc: (cliente as any).rfc || '',
        curp: (cliente as any).curp || '',
        edad: (cliente as any).edad || '',
        sexo: (cliente as any).sexo || '',
        estadoCivil: (cliente as any).estadoCivil || '',
        entidadFederativa: (cliente as any).entidadFederativa || '',
        entidadFederativaNacimiento: (cliente as any).entidadFederativaNacimiento || (cliente as any).entidadFederativa || '',
        entidadResidencia: (cliente as any).entidadResidencia || '',
        nivelEstudios: (cliente as any).nivelEstudios || '',
        nacionalidad: (cliente as any).nacionalidad || '',
        lenguaje: (cliente as any).lenguaje || '',
        moneda: (cliente as any).moneda || '',
        sucursal: (cliente as any).sucursal || '',
        estatusSIC: (cliente as any).estatusSIC || '',
        estatusListaNegra: (cliente as any).estatusListaNegra || '',
        direccion: (cliente as any).direccion || '',
        direccionCalle: (cliente as any).direccionCalle || '',
        direccionNumeroExterior: (cliente as any).direccionNumeroExterior || '',
        direccionNumeroInterior: (cliente as any).direccionNumeroInterior || '',
        direccionColonia: (cliente as any).direccionColonia || '',
        direccionCodigoPostal: (cliente as any).direccionCodigoPostal || '',
        direccionCiudad: (cliente as any).direccionCiudad || '',
        direccionEstado: (cliente as any).direccionEstado || '',
        activacionTarjetaDebito: (cliente as any).activacionTarjetaDebito || false,
        tipoCobranza: (cliente as any).tipoCobranza || defaultNewClientData.tipoCobranza,
      };
    }
    
    // MODO NUEVO: Retornar valores por defecto
    return defaultNewClientData;
  };

  // Memoizar los datos iniciales para evitar recreación en cada render
  const initialFormData = useMemo(() => getInitialFormData(), [mode, cliente?.id]);

  // Hook de persistencia para el formulario principal
  const { 
    data: formData, 
    setData: setFormData,
    updateField: updateFormField,
    updateFields: updateFormFields,
    clearPersistedData: clearFormData
  } = useClientePersistence<FormData>(storageKey, initialFormData);

  // Hook para el tab activo - persiste el tab seleccionado
  const [activeTab, setActiveTab] = useClienteTabs(storageKey, 'default');

  // ========================================
  // PERSISTENCIA: Listas y subtabs
  // ========================================
  // TODOS los subtabs inician VACÍOS siempre.
  // En modo editar/ver, los datos REALES del cliente se cargan en el useEffect.
  // Esto evita que datos mock genéricos aparezcan en clientes que NO tienen esos registros.
  const datosInicialesListasNegras = useMemo(() => [] as any[], []);
  const datosInicialesPersonasRelacionadas = useMemo(() => [] as any[], []);
  const datosInicialesDirecciones = useMemo(() => [] as any[], []);

  const { 
    items: listasNegras, 
    setItems: setListasNegras 
  } = useClienteSubtabList<any>(clienteId, 'listas_negras', datosInicialesListasNegras);

  const { 
    items: personasRelacionadas, 
    setItems: setPersonasRelacionadas 
  } = useClienteSubtabList<any>(clienteId, 'personas_relacionadas', datosInicialesPersonasRelacionadas);

  const { 
    items: direcciones, 
    setItems: setDirecciones 
  } = useClienteSubtabList<any>(clienteId, 'direcciones', datosInicialesDirecciones);

  // ── Ref guard: evitar re-carga infinita del mismo cliente ──
  const loadedClienteKeyRef = useRef<string | null>(null);
  const clienteRef = useRef(cliente);
  clienteRef.current = cliente;

  // ========================================
  // EFECTO: Limpiar datos en modo NUEVO
  // ========================================
  useEffect(() => {
    if (mode === 'nuevo') {
      // En modo NUEVO, asegurar que los subtabs empiecen completamente vacíos
      // Limpiar TODOS los datos de sessionStorage para este cliente temporal
      clearAllClienteData(clienteId);
      
      // Asegurar que los subtabs empiecen vacíos
      setDirecciones([]);
      setPersonasRelacionadas([]);
      setListasNegras([]);
    }
  }, [mode]); // Solo cuando cambie el modo, evitar clienteId para prevenir loops

  // ========================================
  // EFECTOS: Cargar datos del cliente existente
  // ========================================
  useEffect(() => {
    // ── Guard: usar clienteId estable (no referencia de objeto) para evitar loops ──
    const stableKey = `${clienteId}_${mode}`;
    if (loadedClienteKeyRef.current === stableKey) return;

    const currentCliente = clienteRef.current;
    if (currentCliente && (mode === 'editar' || mode === 'ver')) {
      loadedClienteKeyRef.current = stableKey;
      // ════════════════════════════════════════════════════════════════
      // LÓGICA INSTITUCIONAL: Carga en Modo Editar / Ver
      // Fuente: _rawData (JSONB crudo de J_CLIENTES.data)
      // Reglas:
      //   - Mapear nodo padre → campos del formulario
      //   - Mapear nodos hijos → subtabs institucionales
      //   - No eliminar campos, no reconstruir JSON
      //   - type/subtipo/estatus vienen de las columnas físicas
      // ════════════════════════════════════════════════════════════════
      const clienteCompleto = currentCliente as any;
      
      // _rawData contiene TODO el JSONB de J_CLIENTES.data
      const raw = clienteCompleto._rawData || {};
      const def = raw.default || {};
      // Guardar merge de default + raíz para ExpedientesElectronicos:
      // constanciaResidencia y otros archivos pueden estar en raw.default o en la raíz
      setClienteRawData({ ...def, ...raw });
      // Helper: buscar en raw → default → clienteCompleto (DTO aplanado)
      const g = (key: string): string => (raw[key] as string) || (def[key] as string) || (clienteCompleto[key] as string) || '';
      // Helper: buscar en múltiples keys (aliases de campo para compatibilidad Prospectos → Clientes)
      const gMulti = (...keys: string[]): string => {
        for (const k of keys) {
          const v = (raw[k] as string) || (def[k] as string) || (clienteCompleto[k] as string);
          if (v) return v;
        }
        return '';
      };
      
      // ── MAPEO: Nodo padre (Datos Generales) desde _rawData → formulario ──
      // g() busca primero en raw JSONB, luego en default, luego en DTO aplanado
      console.log(`[AltaClienteDefault] ════ CARGA MODO ${mode.toUpperCase()} ════`);
      console.log(`[AltaClienteDefault] dbUuid: ${clienteCompleto.dbUuid || '(sin UUID)'}`);
      console.log(`[AltaClienteDefault] _rawData keys: ${Object.keys(raw).length}`, Object.keys(raw).join(', '));
      
      setFormData({
        idCliente: gMulti('idCliente', 'idProspecto', 'numCliente') || clienteCompleto.dbUuid?.toString() || clienteCompleto.idCliente?.toString() || '',
        personalidad: normalizePersonalidad(gMulti('personalidad', 'tipo', 'tipoPersona') || clienteCompleto.personalidad || clienteCompleto.subtipo),
        nombre: g('nombre') || '',
        apellidoPaterno: g('apellidoPaterno') || '',
        apellidoMaterno: g('apellidoMaterno') || '',
        razonSocial: gMulti('razonSocial', 'denominacionRazonSocial', 'razon_social') || '',
        fechaNacimiento: gMulti('fechaNacimiento', 'fechaConstitucion', 'fecha_nacimiento') || '',
        rfc: g('rfc') || '',
        curp: g('curp') || '',
        edad: g('edad') || '',
        
        sexo: gMulti('sexo', 'genero') || '',
        estadoCivil: gMulti('estadoCivil', 'estado_civil') || '',
        rfcAdicional: g('rfcAdicional') || '',
        // REGLA INSTITUCIONAL: entidadFederativaNacimiento = ENTIDAD FEDERATIVA DE NACIMIENTO
        // entidadFederativa = ENTIDAD DONDE VIVE (spec: cliente-form-update.md §3.1)
        // Detección de formato: si existe la key 'entidadFederativaNacimiento' en raw → formato nuevo
        // Si no existe → formato legacy donde 'entidadFederativa' almacenaba nacimiento
        entidadFederativaNacimiento: (() => {
          const isNewFormat = raw.hasOwnProperty('entidadFederativaNacimiento') || def.hasOwnProperty('entidadFederativaNacimiento');
          if (isNewFormat) return gMulti('entidadFederativaNacimiento', 'entidadNacimiento') || '';
          return gMulti('entidadFederativa', 'entidadNacimiento', 'entidad_federativa') || '';
        })(),
        // REGLA INSTITUCIONAL (spec: cliente-form-update.md §3.1):
        // En formato NUEVO, entidadFederativa en DB almacena residencia (junto con entidadResidencia).
        // En formato LEGACY (sin key entidadFederativaNacimiento), entidadFederativa es NACIMIENTO
        // → NO cargarlo como residencia.
        entidadFederativa: (() => {
          const isNewFormat = raw.hasOwnProperty('entidadFederativaNacimiento') || def.hasOwnProperty('entidadFederativaNacimiento');
          if (isNewFormat) return gMulti('entidadResidencia', 'entidadFederativa', 'entidad_residencia') || '';
          // Legacy: entidadFederativa es nacimiento, NO residencia
          return gMulti('entidadResidencia', 'entidad_residencia') || '';
        })(),
        entidadResidencia: (() => {
          const isNewFormat = raw.hasOwnProperty('entidadFederativaNacimiento') || def.hasOwnProperty('entidadFederativaNacimiento');
          if (isNewFormat) return gMulti('entidadResidencia', 'entidadFederativa', 'entidad_residencia') || '';
          return gMulti('entidadResidencia', 'entidad_residencia') || '';
        })(),
        nivelEstudios: gMulti('nivelEstudios', 'nivel_estudios', 'escolaridad') || '',
        nacionalidad: g('nacionalidad') || '',
        lenguaje: g('lenguaje') || '',
        moneda: g('moneda') || '',
        
        sucursal: g('sucursal') || '',
        fechaCuentaEje: gMulti('fechaCuentaEje', 'fechaRegistro', 'fecha_cuenta_eje') || '',
        fechaAlta: gMulti('fechaAlta', 'fechaRegistro', 'fechaOriginacion', 'fecha_alta') || '',
        estatusSIC: gMulti('estatusSIC', 'estatus_sic') || '',
        estatusListaNegra: gMulti('estatusListaNegra', 'estatus_lista_negra') || '',
        estatusCliente: clienteCompleto.estatus || gMulti('estatusCliente', 'estatusProspecto', 'estatus_cliente') || '',
        calificacionCliente: gMulti('calificacionCliente', 'calificacion_cliente') || '',
        
        cuentaEje: gMulti('cuentaEje', 'cuenta_eje', 'numeroCuenta') || '',
        saldoCuentaEje: gMulti('saldoCuentaEje', 'saldo', 'saldo_cuenta_eje') || clienteCompleto.saldo?.toString() || '',
        fechaActivacion: gMulti('fechaActivacion', 'fecha_activacion') || '',
        activacionTarjetaDebito: raw.activacionTarjetaDebito || def.activacionTarjetaDebito || clienteCompleto.activacionTarjetaDebito || false,
        numeroTarjetaDebito: gMulti('numeroTarjetaDebito', 'numero_tarjeta_debito') || '',
        clasificacionCliente: gMulti('clasificacionCliente', 'clasificacion_cliente') || '',
        
        telefonoDomicilio: gMulti('telefonoDomicilio', 'telefono', 'telefonoCelular', 'celular') || '',
        telefonoOficina: gMulti('telefonoOficina', 'telefono_oficina') || '',
        telefonoCasa: gMulti('telefonoCasa', 'celular', 'telefonoCelular', 'telefono_casa') || '',
        direccion: gMulti('direccion', 'direccionPrincipal', 'direccion_principal') || '',
        direccionCalle: g('direccionCalle') || '',
        direccionNumeroExterior: g('direccionNumeroExterior') || '',
        direccionNumeroInterior: g('direccionNumeroInterior') || '',
        direccionColonia: g('direccionColonia') || '',
        direccionCodigoPostal: g('direccionCodigoPostal') || '',
        direccionCiudad: g('direccionCiudad') || '',
        direccionEstado: g('direccionEstado') || '',
        correoElectronico: g('correoElectronico') || '',
        fax: g('fax') || '',
        datosContacto: g('datosContacto') || '',
        
        tipoEmpleo: gMulti('tipoEmpleo', 'tipoEmpleado', 'tipo_empleo') || '',
        nombreEmpresa: gMulti('nombreEmpresa', 'nombreEmpresaTrabajo', 'empresa', 'nombre_empresa') || '',
        dependienteEconomico: g('dependienteEconomico') || '',
        ingresoMensual: g('ingresoMensual') || '',
        aniosLaborados: g('aniosLaborados') || '',
        otrosIngresos: g('otrosIngresos') || '',
        
        puestoNombre: gMulti('puestoNombre', 'puestoDesempena', 'puesto', 'cargo') || '',
        nombreAval: g('nombreAval') || '',
        direccionEmpresa: g('direccionEmpresa') || '',
        
        sector: gMulti('sector', 'sectorCNBV', 'sectorEconomico') || '',
        actividadEconomica1: gMulti('actividadEconomica1', 'actividadEconomica', 'actividad_economica') || '',
        actividadEconomica2: g('actividadEconomica2') || '',
        datosAdicionales: g('datosAdicionales') || '',
        
        claveDescuento: g('claveDescuento') || '',
        zonaPagadora: g('zonaPagadora') || '',
        porcentajeDescuento: g('porcentajeDescuento') || '',
        minimoLiquidez: g('minimoLiquidez') || '',
        tipoCobranza: g('tipoCobranza') || '',
        claveDependencia: g('claveDependencia') || '',
        
        institucionGobierno: g('institucionGobierno') || '',
        institucionGobiernoId: g('institucionGobiernoId') || clienteCompleto.par_cliente_id || '',
      });
      
      // ════════════════════════════════════════════════════════════════
      // MAPEO: Nodos hijos (SubTabs institucionales) desde _rawData
      // Cada subtab recibe ÚNICAMENTE su nodo correspondiente del JSONB.
      // Si el nodo no existe en el JSONB, queda como array vacío.
      // ════════════════════════════════════════════════════════════════
      const getArray = (key: string): any[] => {
        const val = raw[key] || def[key];
        return Array.isArray(val) ? val : [];
      };
      
      // ── CARGA ROBUSTA: Direcciones desde _rawData (JSONB) ──
      // Busca en múltiples ubicaciones y normaliza los campos
      const loadDirecciones = (): any[] => {
        const candidates = [
          raw['direcciones'],
          def['direcciones'],
          raw['addresses'],
          def['addresses'],
        ];
        for (const c of candidates) {
          if (Array.isArray(c) && c.length > 0) {
            console.log(`[AltaClienteDefault] ✅ direcciones encontradas (${c.length} registros)`);
            return c.map((d: any, idx: number) => ({
              id: d.id ?? idx + 1,
              calle: d.calle || d.street || d.direccionCalle || '',
              numeroExterior: d.numeroExterior || d.numExterior || d.noExterior || d.numero_exterior || '',
              numeroInterior: d.numeroInterior || d.numInterior || d.noInterior || d.numero_interior || '',
              colonia: d.colonia || d.colony || d.direccionColonia || '',
              codigoPostal: d.codigoPostal || d.cp || d.direccionCodigoPostal || d.codigo_postal || '',
              piso: d.piso || d.floor || d.nivel || '',
              principal: d.principal ?? d.isPrincipal ?? false,
              tipoDireccion: d.tipoDireccion || d.tipo || d.tipo_direccion || d.addressType || 'Particular',
              ciudad: d.ciudad || d.city || d.direccionCiudad || '',
              estado: d.estado || d.state || d.direccionEstado || '',
              pais: d.pais || d.country || d.direccionPais || 'México',
              atencion: d.atencion || d.attention || '',
              destinatario: d.destinatario || d.receptor || d.recipient || '',
              tipoCalle: d.tipoCalle || d.tipo_calle || d.streetType || d.tipoVia || '',
              municipio: d.municipio || d.delegacion || d.alcaldia || d.municipality || d.delegacionMunicipio || '',
              seleccionada: false,
            }));
          }
          if (c && typeof c === 'object' && !Array.isArray(c)) {
            console.log(`[AltaClienteDefault] ⚠️ direcciones: objeto suelto → envolviendo en array`);
            return [{
              id: 1,
              calle: c.calle || c.street || '',
              numeroExterior: c.numeroExterior || c.numExterior || c.noExterior || c.numero_exterior || '',
              numeroInterior: c.numeroInterior || c.numInterior || c.noInterior || c.numero_interior || '',
              colonia: c.colonia || '',
              codigoPostal: c.codigoPostal || c.cp || c.codigo_postal || '',
              piso: c.piso || c.floor || c.nivel || '',
              principal: c.principal ?? true,
              tipoDireccion: c.tipoDireccion || c.tipo || c.tipo_direccion || 'Particular',
              ciudad: c.ciudad || '',
              estado: c.estado || '',
              pais: c.pais || c.country || 'México',
              atencion: c.atencion || c.attention || '',
              destinatario: c.destinatario || c.receptor || '',
              tipoCalle: c.tipoCalle || c.tipo_calle || c.tipoVia || '',
              municipio: c.municipio || c.delegacion || c.alcaldia || c.delegacionMunicipio || '',
              seleccionada: false,
            }];
          }
        }
        console.log(`[AltaClienteDefault] ℹ️ direcciones: no encontradas en _rawData (keys disponibles: ${Object.keys(raw).join(', ')})`);
        return [];
      };
      
      // ── CARGA ROBUSTA: Expedientes Electrónicos desde _rawData (JSONB) ──
      const loadExpedientes = (): any[] => {
        const candidates = [
          raw['expedientesElectronicos'], def['expedientesElectronicos'],
          raw['expedientes_electronicos'], def['expedientes_electronicos'],
          raw['expedientes'], def['expedientes'],
          raw['documents'], def['documents'],
          raw['archivos'], def['archivos'],
        ];
        for (const c of candidates) {
          if (Array.isArray(c) && c.length > 0) {
            console.log(`[EXPEDIENTES-LOAD] ✅ encontrados (${c.length} registros)`);
            return c.map((d: any, idx: number) => ({
              id: d.id ?? idx + 1,
              nombre: d.nombre || d.archivo || d.file || d.fileName || d.nombre_archivo || d.nombreArchivo || '',
              url: d.url || d.fileData || d.file_data || d.fileUrl || d.file_url || d.archivoUrl || '',
              storagePath: d.storagePath || d.storage_path || '',
              // REGLA INSTITUCIONAL (expediente-electronico-fix.md §3):
              // Preservar storageBucket del JSON para construir URLs correctas
              storageBucket: d.storageBucket || '',
              mime: d.mime || d.mimeType || '',
              tamanoKB: d.tamanoKB || d.tamano_kb || d.size_kb || 0,
              fechaCarga: d.fechaCarga || d.fecha_carga || d.fechaHora || d.fecha_hora || d.fecha || d.createdAt || d.created_at || d.fechaRegistro || d.fecha_registro || '',
              usuarioCarga: d.usuarioCarga || d.usuario_carga || d.usuario || d.user || d.usuarioRegistro || d.usuario_registro || d.registradoPor || d.registrado_por || '',
              tipoDocumento: d.tipoDocumento || d.tipo_documento || d.tipo || d.documentType || d.tipoExpediente || d.tipo_expediente || '',
              descripcion: d.descripcion || d.description || d.desc || d.detalle || '',
              estatus: d.estatus || d.status || d.estado || 'Pendiente',
              observaciones: d.observaciones || d.observations || d.notas || d.comentarios || d.nota || '',
              _bucket: d._bucket || '',
            }));
          }
        }
        console.log(`[EXPEDIENTES-LOAD] ℹ️ no encontrados en _rawData (keys: ${Object.keys(raw).join(', ')})`);
        return [];
      };
      
      // ── CARGA ROBUSTA: Consultas SIC desde _rawData (JSONB) ──
      const loadSIC = (): any[] => {
        const candidates = [
          raw['sic'], def['sic'],
          raw['consultasSIC'], def['consultasSIC'],
          raw['consultas_sic'], def['consultas_sic'],
          raw['consultasSic'], def['consultasSic'],
          raw['consultas'], def['consultas'],
        ];
        for (const c of candidates) {
          if (Array.isArray(c) && c.length > 0) {
            console.log(`[SIC-LOAD] ✅ encontradas (${c.length} registros)`);
            return c.map((d: any, idx: number) => ({
              id: d.id ?? idx + 1,
              fechaHora: d.fechaHora || d.fecha_hora || d.fecha || d.createdAt || d.created_at || d.fechaRegistro || '',
              usuario: d.usuario || d.user || d.usuarioRegistro || d.usuario_registro || d.registradoPor || '',
              tipoConsulta: d.tipoConsulta || d.tipo_consulta || d.tipo || d.queryType || d.tipoReporte || '',
              estatus: d.estatus || d.status || d.estado || '',
              xmlResultado: d.xmlResultado || d.xml_resultado || d.xml || d.resultado || d.respuestaXml || d.respuesta_xml || '',
            }));
          }
        }
        console.log(`[SIC-LOAD] ℹ️ no encontradas en _rawData (keys: ${Object.keys(raw).join(', ')})`);
        return [];
      };
      
      // ── CARGA ROBUSTA: Listas Negras desde _rawData (JSONB) ──
      const loadListasNegras = (): any[] => {
        const candidates = [
          raw['listasNegras'], def['listasNegras'],
          raw['listas_negras'], def['listas_negras'],
          raw['listaNegra'], def['listaNegra'],
          raw['blacklists'], def['blacklists'],
          raw['pld'], def['pld'],
        ];
        for (const c of candidates) {
          if (Array.isArray(c) && c.length > 0) {
            console.log(`[LISTAS-NEGRAS-LOAD] ✅ encontradas (${c.length} registros)`);
            return c.map((d: any, idx: number) => ({
              id: d.id ?? idx + 1,
              fecha: d.fecha || d.fechaHora || d.fecha_hora || d.createdAt || d.created_at || d.fechaRegistro || '',
              usuario: d.usuario || d.user || d.usuarioRegistro || d.usuario_registro || d.registradoPor || '',
              nombreLista: d.nombreLista || d.nombre_lista || d.nombre || d.listName || d.lista || '',
              tipoLista: d.tipoLista || d.tipo_lista || d.tipo || d.listType || d.tipoListaNegra || '',
              estatus: d.estatus || d.status || d.estado || 'Pendiente',
              resultado: d.resultado || d.result || d.resultadoConsulta || d.resultado_consulta || '',
              observaciones: d.observaciones || d.observations || d.notas || d.comentarios || '',
              seleccionada: false,
            }));
          }
        }
        console.log(`[LISTAS-NEGRAS-LOAD] ℹ️ no encontradas en _rawData (keys: ${Object.keys(raw).join(', ')})`);
        return [];
      };
      
      // Subtabs gestionados localmente con useState
      const direccionesFromDB = loadDirecciones();
      setDirecciones(direccionesFromDB);
      
      const listasNegrasFromDB = loadListasNegras();
      setListasNegras(listasNegrasFromDB);
      
      // Expedientes y SIC se cargan vía sessionStorage seed → useClienteSubtabList
      const expedientesFromDB = loadExpedientes();
      const sicFromDB = loadSIC();
      
      // ── SEED sessionStorage para componentes que usan useClienteSubtabList ──
      // ExpedientesElectronicos y SIC leen desde sessionStorage, hay que sembrar los datos de DB
      if (expedientesFromDB.length > 0) {
        const expKey = `cliente_${clienteId}_expedientes_list`;
        const existingExp = sessionStorage.getItem(expKey);
        if (!existingExp || existingExp === '[]') {
          sessionStorage.setItem(expKey, JSON.stringify(expedientesFromDB));
          console.log(`[AltaClienteDefault] 🌱 Seeded sessionStorage expedientes (${expedientesFromDB.length}) → ${expKey}`);
        }
      }
      if (sicFromDB.length > 0) {
        const sicKey = `cliente_${clienteId}_sic_list`;
        const existingSic = sessionStorage.getItem(sicKey);
        if (!existingSic || existingSic === '[]') {
          sessionStorage.setItem(sicKey, JSON.stringify(sicFromDB));
          console.log(`[AltaClienteDefault] 🌱 Seeded sessionStorage SIC (${sicFromDB.length}) → ${sicKey}`);
        }
      }

      setPersonasRelacionadas(getArray('personasRelacionadas'));
      
      // ── DIAGNÓSTICO: Registrar fuente real de los datos ──
      const rawDir = raw['direcciones'] || def['direcciones'] || raw['addresses'] || def['addresses'];
      setDireccionesDiag({
        source: rawDir ? (Array.isArray(rawDir) ? `_rawData.direcciones (${rawDir.length} registros crudos)` : '_rawData.direcciones (objeto suelto)') : 'NO encontrado en _rawData',
        count: direccionesFromDB.length,
        rawKeys: Object.keys(raw),
        rawDirecciones: rawDir || null,
        dbUuid: clienteCompleto.dbUuid || '(sin UUID)',
      });
      
      // ── DIAGNÓSTICO: Expedientes, SIC, Listas Negras ──
      const rawExp = raw['expedientesElectronicos'] || def['expedientesElectronicos'] || raw['expedientes_electronicos'] || def['expedientes_electronicos'] || raw['expedientes'] || def['expedientes'] || raw['documents'] || def['documents'] || raw['archivos'] || def['archivos'];
      const rawSic = raw['sic'] || def['sic'] || raw['consultasSIC'] || def['consultasSIC'] || raw['consultas_sic'] || def['consultas_sic'] || raw['consultasSic'] || def['consultasSic'] || raw['consultas'] || def['consultas'];
      const rawLN = raw['listasNegras'] || def['listasNegras'] || raw['listas_negras'] || def['listas_negras'] || raw['listaNegra'] || def['listaNegra'] || raw['blacklists'] || def['blacklists'] || raw['pld'] || def['pld'];
      setSubtabsDiag({
        expedientes: { rawNode: rawExp || null, loaded: expedientesFromDB.length },
        sic: { rawNode: rawSic || null, loaded: sicFromDB.length },
        listasNegras: { rawNode: rawLN || null, loaded: listasNegrasFromDB.length },
        rawKeys: Object.keys(raw),
        dbUuid: clienteCompleto.dbUuid || '(sin UUID)',
      });
      
      console.log(`[AltaClienteDefault] Subtabs cargados desde _rawData:`);
      console.log(`  direcciones: ${direccionesFromDB.length} (de DB)`);
      console.log(`  expedientes: ${expedientesFromDB.length} (de DB)`);
      console.log(`  sic: ${sicFromDB.length} (de DB)`);
      console.log(`  listasNegras: ${listasNegrasFromDB.length} (de DB)`);
      console.log(`  personasRelacionadas: ${getArray('personasRelacionadas').length}`);
      console.log(`  _rawData keys: ${Object.keys(raw).join(', ')}`);
      
      // ════════════════════════════════════════════════════════════════
      // SEEDING FORZADO: Poblar sessionStorage para subtabs independientes
      // desde _rawData (JSONB). Se usa seed FORZADO para expedientes, SIC
      // y listas negras para garantizar que los datos de DB prevalezcan.
      // ════════════════════════════════════════════════════════════════
      const cId = clienteCompleto.dbUuid || clienteCompleto.id?.toString() || clienteCompleto.idCliente?.toString();
      if (cId) {
        const seedIfEmpty = (key: string, data: any) => {
          if (data && Array.isArray(data) && data.length > 0 && !sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, JSON.stringify(data));
            console.log(`[AltaClienteDefault] SEED ${key}: ${data.length} registros`);
          }
        };
        
        // Helper: seed forzado (sobrescribe siempre si hay data de DB)
        const seedForced = (key: string, data: any[]) => {
          if (data.length > 0) {
            sessionStorage.setItem(key, JSON.stringify(data));
            console.log(`[AltaClienteDefault] SEED FORZADO ${key}: ${data.length} registros`);
          }
        };
        
        // Subtabs con seed FORZADO (datos directos de DB, siempre prevalecen)
        seedForced(`cliente_${cId}_direcciones_list`, direccionesFromDB);
        seedForced(`cliente_${cId}_expedientes_list`, expedientesFromDB);
        seedForced(`cliente_${cId}_consultas_sic_list`, sicFromDB);
        seedForced(`cliente_${cId}_listas_negras_list`, listasNegrasFromDB);
        
        // Subtabs con seed condicional (si no existe en sessionStorage)
        seedIfEmpty(`cliente_${cId}_personas_relacionadas_list`, getArray('personasRelacionadas'));
        seedIfEmpty(`cliente_${cId}_garantias_list`, getArray('garantias'));
        seedIfEmpty(`cliente_${cId}_perfil_transaccional_list`, getArray('perfilTransaccional'));
        seedIfEmpty(`cliente_${cId}_solicitudes_list`, getArray('solicitudesCredito'));
        seedIfEmpty(`cliente_${cId}_creditos_list`, getArray('creditos'));
        seedIfEmpty(`cliente_${cId}_inversiones_list`, getArray('inversiones'));
        
        // Subtabs que usan gestión manual (clave: cliente_${id}_${name})
        seedIfEmpty(`cliente_${cId}_kyc`, getArray('kyc'));
        seedIfEmpty(`cliente_${cId}_cuentas_ahorro`, getArray('cuentasAhorro'));
        seedIfEmpty(`cliente_${cId}_movimientos`, getArray('movimientos'));
        seedIfEmpty(`cliente_${cId}_avisos`, getArray('avisos'));
        seedIfEmpty(`cliente_${cId}_auditoria`, getArray('auditoria'));
        seedIfEmpty(`cliente_${cId}_archivos`, getArray('archivosAdjuntos'));
        seedIfEmpty(`cliente_${cId}_convenios`, getArray('convenios'));
        seedIfEmpty(`cliente_${cId}_cobranza_normal`, getArray('cobranzaNormal'));
        seedIfEmpty(`cliente_${cId}_cobranza_acumulativa`, getArray('cobranzaAcumulativa'));
        seedIfEmpty(`cliente_${cId}_estado_cuenta_creditos`, getArray('estadoCuenta'));
        seedIfEmpty(`cliente_${cId}_estado_cuenta_pagos`, []); // No hay nodo separado para pagos
        seedIfEmpty(`cliente_${cId}_calendario`, getArray('calendario'));
        // tarjetaDebito se maneja como parte del formulario principal
      }
    }
  }, [clienteId, mode]); // Usar clienteId estable (string) en vez de referencia de objeto cliente

  // Limpiar datos cuando se cambia de cliente
  useEffect(() => {
    // Si cambia el cliente (ID diferente), limpiar datos del cliente anterior
    const currentStoredId = sessionStorage.getItem('current_cliente_id');
    if (currentStoredId && currentStoredId !== clienteId) {
      clearAllClienteData(currentStoredId);
    }
    sessionStorage.setItem('current_cliente_id', clienteId);
  }, [clienteId]);

  // Función para limpiar campos - memoizada para evitar recreación
  const limpiarCampos = useCallback(() => {
    // Limpiar todos los datos persistidos y resetear el formulario
    clearFormData();
    clearAllClienteData(clienteId);
    
    // Limpiar todos los subtabs
    setDirecciones([]);
    setPersonasRelacionadas([]);
    setListasNegras([]);
    
    // Establecer valores iniciales limpios con ID automático
    setFormData({
      idCliente: String(Date.now() + Math.floor(Math.random() * 1000)),
      personalidad: 'Física',
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      razonSocial: '',
      fechaNacimiento: '',
      rfc: '',
      curp: '',
      edad: '',
      
      sexo: '',
      estadoCivil: '',
      rfcAdicional: '',
      entidadFederativa: '',
      entidadFederativaNacimiento: '',
      entidadResidencia: '',
      nivelEstudios: '',
      nacionalidad: '',
      lenguaje: '',
      moneda: '',
      
      sucursal: '',
      fechaCuentaEje: '',
      fechaAlta: '',
      estatusSIC: '',
      estatusListaNegra: '',
      estatusCliente: '',
      calificacionCliente: '',
      
      telefonoDomicilio: '',
      telefonoOficina: '',
      telefonoCasa: '',
      direccion: '',
      direccionCalle: '',
      direccionNumeroExterior: '',
      direccionNumeroInterior: '',
      direccionColonia: '',
      direccionCodigoPostal: '',
      direccionCiudad: '',
      direccionEstado: '',
      correoElectronico: '',
      fax: '',
      datosContacto: '',
      
      tipoEmpleo: '',
      nombreEmpresa: '',
      dependienteEconomico: '',
      ingresoMensual: '',
      aniosLaborados: '',
      otrosIngresos: '',
      
      puestoNombre: '',
      nombreAval: '',
      direccionEmpresa: '',
      
      sector: '',
      actividadEconomica1: '',
      actividadEconomica2: '',
      datosAdicionales: '',
      
      claveDescuento: '',
      zonaPagadora: '',
      porcentajeDescuento: '',
      minimoLiquidez: '',
      tipoCobranza: '',
      claveDependencia: '',
      
      cuentaEje: '',
      saldoCuentaEje: '',
      fechaActivacion: '',
      activacionTarjetaDebito: false,
      numeroTarjetaDebito: '',
      clasificacionCliente: '',
      institucionGobierno: '',
      institucionGobiernoId: '',
    });
  }, [clienteId, clearFormData, setFormData, setDirecciones, setPersonasRelacionadas, setListasNegras]);

  // Función para configurar el modo del formulario - memoizada
  const configurarModoFormulario = useCallback((modo: FormMode) => {
    switch (modo) {
      case 'nuevo':
        limpiarCampos();
        setCamposEditables(true);
        setMostrarGuardar(true);
        break;
      case 'editar':
        // Los datos se cargan automáticamente en el useEffect
        setCamposEditables(true);
        setMostrarGuardar(true);
        break;
      case 'ver':
        // Los datos se cargan automáticamente en el useEffect
        setCamposEditables(false);
        setMostrarGuardar(false);
        break;
    }
  }, [limpiarCampos]);

  // Use ref to avoid infinite loop: configurarModoFormulario changes reference
  // because limpiarCampos depends on setter functions that can be unstable.
  const configurarModoRef = useRef(configurarModoFormulario);
  configurarModoRef.current = configurarModoFormulario;

  useEffect(() => {
    configurarModoRef.current(mode);
  }, [mode]); // Only re-run when mode actually changes

  // Generar números automáticos en modo editar/ver si no existen
  useEffect(() => {
    if (mode !== 'nuevo') {
      const updates: Partial<FormData> = {};
      
      // Generar Número de Cuenta Eje si no existe
      if (!formData.cuentaEje || formData.cuentaEje === '') {
        const longitudCuenta = 16; // 14-18 dígitos, usando 16 como estándar
        updates.cuentaEje = Array.from({ length: longitudCuenta }, () => 
          Math.floor(Math.random() * 10)
        ).join('');
      }
      
      // Generar Número de Tarjeta de Débito si no existe
      if (!formData.numeroTarjetaDebito || formData.numeroTarjetaDebito === '') {
        const longitudTarjeta = 16;
        updates.numeroTarjetaDebito = Array.from({ length: longitudTarjeta }, () => 
          Math.floor(Math.random() * 10)
        ).join('');
      }
      
      // Generar Fecha de Activación si no existe o normalizar si tiene formato incorrecto
      if (!formData.fechaActivacion || formData.fechaActivacion === '') {
        updates.fechaActivacion = formatDateToDDMMYYYY(new Date());
      } else if (formData.fechaActivacion.includes('T') || formData.fechaActivacion.includes('-')) {
        updates.fechaActivacion = normalizeDateString(formData.fechaActivacion);
      }
      
      // Normalizar Fecha de Alta si tiene formato incorrecto
      if (formData.fechaAlta && (formData.fechaAlta.includes('T') || formData.fechaAlta.includes('-'))) {
        updates.fechaAlta = normalizeDateString(formData.fechaAlta);
      }
      
      // Generar Fecha Cuenta Eje si no existe o normalizar si tiene formato incorrecto
      if (!formData.fechaCuentaEje || formData.fechaCuentaEje === '') {
        updates.fechaCuentaEje = formatDateTimeToStandard(new Date());
      } else if (formData.fechaCuentaEje.includes('T') || formData.fechaCuentaEje.includes('-')) {
        updates.fechaCuentaEje = normalizeDateTimeString(formData.fechaCuentaEje);
      }
      
      // Solo actualizar si hay cambios
      if (Object.keys(updates).length > 0) {
        updateFormFields(updates);
      }
    }
  }, [mode, cliente]); // Depender de cliente para ejecutar una sola vez al cargar

  // Calcular edad automáticamente cuando cambie la fecha de nacimiento
  useEffect(() => {
    if (formData.fechaNacimiento) {
      const edad = calcularEdad(formData.fechaNacimiento);
      if (edad !== null && edad.toString() !== formData.edad) {
        updateFormField('edad', edad.toString());
      }
    }
  }, [formData.fechaNacimiento]);

  // Funciones para Listas Negras
  const handleToggleSeleccionListaNegra = (id: number) => {
    if (!Array.isArray(listasNegras)) return;
    setListasNegras(listasNegras.map(item => 
      item.id === id ? { ...item, seleccionada: !item.seleccionada } : item
    ));
  };

  const handleSeleccionarTodasListasNegras = (checked: boolean) => {
    if (!Array.isArray(listasNegras)) return;
    setListasNegras(listasNegras.map(item => ({ ...item, seleccionada: checked })));
  };

  const handleEliminarListasNegrasSeleccionadas = () => {
    if (!Array.isArray(listasNegras)) return;
    const seleccionadas = listasNegras.filter(item => item.seleccionada);
    if (seleccionadas.length === 0) return;
    setListasNegras(listasNegras.filter(item => !item.seleccionada));
    toast.success(`${seleccionadas.length} registro(s) eliminado(s) exitosamente`);
  };

  const handleNuevaListaNegra = () => {
    setListaNegraForm({ nombreLista: '', tipoLista: '', estatus: '' });
    setShowListaNegraModal(true);
  };

  const handleGuardarListaNegra = () => {
    // Validaciones obligatorias — idéntico a Prospectos (§8)
    if (!listaNegraForm.nombreLista || !listaNegraForm.tipoLista || !listaNegraForm.estatus) {
      alert('Nombre lista, Tipo lista y Estatus son obligatorios');
      return;
    }
    const now = new Date();
    const fechaHora = now.toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    // ID basado en timestamp (spec §3 — evita colisiones, idéntico a Prospectos)
    const newId = Date.now();
    // Validar no duplicados (mismo ID)
    if (Array.isArray(listasNegras) && listasNegras.some(l => l.id === newId)) {
      alert('Error: ID duplicado. Intente nuevamente.');
      return;
    }
    // Objeto JSON COMPLETO — idéntico a Prospectos (§3)
    const nuevoItem = {
      id: newId,
      fechaHora: fechaHora,
      usuario: 'Usuario Actual',
      nombreLista: listaNegraForm.nombreLista,
      tipoLista: listaNegraForm.tipoLista,
      estatus: listaNegraForm.estatus,
      seleccionada: false
    };
    const allListas = [...(Array.isArray(listasNegras) ? listasNegras : []), nuevoItem];
    setListasNegras(allListas);
    setShowListaNegraModal(false);
    toast.success('Registro de Lista Negra creado correctamente');
  };

  // Consultar Lista Negra — simula consulta y asigna resultado NEGATIVO
  const handleConsultarListaNegra = (id: number) => {
    if (!Array.isArray(listasNegras)) return;
    const updatedListas = listasNegras.map((lista: any) =>
      lista.id === id ? { ...lista, resultado: 'NEGATIVO', estatus: 'NEGATIVO' } : lista
    );
    setListasNegras(updatedListas);
    toast.success(`Lista Negra #${id} consultada — Resultado: NEGATIVO`);
  };

  // Funciones para Personas Relacionadas — ahora delegadas al componente PersonasRelacionadas.tsx

  // Funciones para Direcciones
  const handleToggleSeleccionDireccion = (id: number) => {
    if (!Array.isArray(direcciones)) return;
    setDirecciones(direcciones.map(item => 
      item.id === id ? { ...item, seleccionada: !item.seleccionada } : item
    ));
  };

  const handleSeleccionarTodasDirecciones = (checked: boolean) => {
    if (!Array.isArray(direcciones)) return;
    setDirecciones(direcciones.map(item => ({ ...item, seleccionada: checked })));
  };

  const handleEliminarDireccionesSeleccionadas = () => {
    if (!Array.isArray(direcciones)) return;
    const seleccionadas = direcciones.filter(item => item.seleccionada);
    if (seleccionadas.length === 0) return;
    setDirecciones(direcciones.filter(item => !item.seleccionada));
  };

  // handleAgregarPersonaRelacionada — movido al componente PersonasRelacionadas.tsx

  // Función para agregar una dirección desde el modal
  const handleAgregarDireccion = (direccionData: any) => {
    if (!Array.isArray(direcciones)) return;
    const nuevaDireccion = {
      id: direcciones.length > 0 ? Math.max(...direcciones.map(d => d.id)) + 1 : 1,
      calle: direccionData.calle || '',
      numeroExterior: direccionData.numeroExterior || '',
      numeroInterior: direccionData.numeroInterior || '',
      colonia: direccionData.colonia || '',
      codigoPostal: direccionData.codigoPostal || '',
      piso: direccionData.piso || '',
      ciudad: direccionData.ciudad || '',
      estado: direccionData.estado || '',
      pais: direccionData.pais || 'México',
      principal: direccionData.principal ?? false,
      tipoDireccion: direccionData.tipoDireccion || 'Particular',
      atencion: direccionData.atencion || '',
      destinatario: direccionData.destinatario || '',
      tipoCalle: direccionData.tipoCalle || '',
      municipio: direccionData.municipio || '',
      seleccionada: false,
    };
    setDirecciones([...direcciones, nuevaDireccion]);
    setShowDireccionModal(false);
  };

  // Función para abrir el modal en modo edición cargando los datos de la dirección
  const handleEditarDireccion = (direccion: any) => {
    setEditingDireccionId(direccion.id);
    setNuevaDireccionForm({
      pais: direccion.pais || 'México',
      atencion: direccion.atencion || '',
      destinatario: direccion.destinatario || '',
      tipoCalle: direccion.tipoCalle || '',
      calle: direccion.calle || '',
      numeroExterior: direccion.numeroExterior || '',
      piso: direccion.piso || '',
      numeroInterior: direccion.numeroInterior || '',
      codigoPostal: direccion.codigoPostal || '',
      colonia: direccion.colonia || '',
      municipio: direccion.municipio || '',
      ciudad: direccion.ciudad || '',
      estado: direccion.estado || '',
      tipoDireccion: direccion.tipoDireccion || 'Particular',
    });
    setShowDireccionModal(true);
  };

  // Función para actualizar una dirección existente
  const handleActualizarDireccion = (id: number, direccionData: any) => {
    if (!Array.isArray(direcciones)) return;
    setDirecciones(direcciones.map((d) =>
      d.id === id
        ? {
            ...d,
            calle: direccionData.calle || '',
            numeroExterior: direccionData.numeroExterior || '',
            numeroInterior: direccionData.numeroInterior || '',
            colonia: direccionData.colonia || '',
            codigoPostal: direccionData.codigoPostal || '',
            piso: direccionData.piso || '',
            ciudad: direccionData.ciudad || '',
            estado: direccionData.estado || '',
            pais: direccionData.pais || 'México',
            tipoDireccion: direccionData.tipoDireccion || 'Particular',
            atencion: direccionData.atencion || '',
            destinatario: direccionData.destinatario || '',
            tipoCalle: direccionData.tipoCalle || '',
            municipio: direccionData.municipio || '',
          }
        : d
    ));
    setShowDireccionModal(false);
    setEditingDireccionId(null);
    toast.success('Dirección actualizada correctamente');
  };

  // Variables computadas con validación de arrays
  const todasListasNegrasSeleccionadas = Array.isArray(listasNegras) && listasNegras.length > 0 && listasNegras.every(item => item.seleccionada);
  const algunaListaNegraSeleccionada = Array.isArray(listasNegras) && listasNegras.some(item => item.seleccionada);

  // todasPersonasSeleccionadas / algunaPersonaSeleccionada — ahora en PersonasRelacionadas.tsx

  const todasDireccionesSeleccionadas = Array.isArray(direcciones) && direcciones.length > 0 && direcciones.every(item => item.seleccionada);
  const algunaDireccionSeleccionada = Array.isArray(direcciones) && direcciones.some(item => item.seleccionada);

  // Función eliminada: cargarDesdeMemoriaLocal() - Ahora se maneja en el useEffect de carga de datos
  // Las funciones configurarModoFormulario y limpiarCampos ahora están definidas arriba con useCallback

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    if (!camposEditables) return;
    updateFormField(field, value);
  };

  const updateFormData = (field: string, value: any) => {
    updateFormField(field as keyof FormData, value);
  };

  // ========================================
  // GUARDAR — Lógica Institucional de Alta/Edición de Clientes
  // Tabla: EFINANCIANET_DB."J_CLIENTES"
  // type = "Cliente" | subtipo/estatus del formulario
  // data = JSONB completo con 22 subtabs institucionales
  // ========================================
  const [saving, setSaving] = useState(false);

  /**
   * Recupera un array de subtab desde sessionStorage (si existe).
   * Si sessionStorage está vacío, intenta recuperar desde _rawData del cliente
   * para evitar pérdida de arrays existentes en la BD.
   */
  const recoverSubtab = (key: string, rawDataKey?: string): any[] => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    // ── FALLBACK: Recuperar desde _rawData si sessionStorage está vacío ──
    // Esto previene pérdida de arrays cuando sessionStorage no fue populado correctamente
    if (rawDataKey && cliente && (mode === 'editar' || mode === 'ver')) {
      const raw = (cliente as any)?._rawData || {};
      const def = raw.default || {};
      const val = raw[rawDataKey] || def[rawDataKey];
      if (Array.isArray(val) && val.length > 0) {
        console.log(`[recoverSubtab] FALLBACK _rawData.${rawDataKey}: ${val.length} registros`);
        return val;
      }
    }
    return [];
  };

  const handleSave = async () => {
    if (!onSave) return;
    if (saving) return; // Prevenir doble clic

    setSaving(true);

    try {
      // Construir el nombre completo del cliente
      // Para persona moral, el nombre completo es solo el nombre (denominación); para física incluye apellidos
      const isPersonaMoral = formData.personalidad === 'Moral';
      const nombreCompleto = isPersonaMoral
        ? formData.nombre.trim()
        : `${formData.nombre} ${formData.apellidoPaterno} ${formData.apellidoMaterno}`.trim();

      // ════════════════════════════════════════════════════════════════
      // REGLA INSTITUCIONAL: Construcción del JSON (campo DATA)
      // Nodo padre (Datos Generales) + 22 nodos hijos (subtabs)
      // Todos los subtabs DEBEN existir desde el alta, aunque estén vacíos.
      // ════════════════════════════════════════════════════════════════
      const dataJson: Record<string, any> = {
        // ── Nodo padre: Datos Generales ──
        nombre: formData.nombre || '',
        apellidoPaterno: formData.apellidoPaterno || '',
        apellidoMaterno: formData.apellidoMaterno || '',
        razonSocial: formData.razonSocial || '',
        denominacionRazonSocial: formData.razonSocial || '', // Alias para compatibilidad con Prospectos
        curp: formData.curp || '',
        rfc: formData.rfc || '',
        telefono: formData.telefonoDomicilio || '',
        correoElectronico: formData.correoElectronico || '',
        fechaOriginacion: formData.fechaAlta || formData.fechaCuentaEje || new Date().toISOString(),
        idCliente: formData.idCliente || '',

        // Campos adicionales de Datos Generales
        // REGLA INSTITUCIONAL: PERSONALIDAD → data.tipo (spec: cliente-form-update.md §3.1)
        tipo: formData.personalidad || 'Física',
        personalidad: formData.personalidad || 'Física',
        fechaNacimiento: formData.fechaNacimiento || '',
        edad: formData.edad || '',
        sexo: formData.sexo || '',
        estadoCivil: formData.estadoCivil || '',
        rfcAdicional: formData.rfcAdicional || '',
        // REGLA INSTITUCIONAL (spec: cliente-form-update.md §3.1):
        // ENTIDAD FEDERATIVA DE NACIMIENTO → data.entidadFederativaNacimiento
        // ENTIDAD DONDE VIVE → data.entidadFederativa
        entidadFederativaNacimiento: formData.entidadFederativaNacimiento || '',
        entidadFederativa: formData.entidadResidencia || formData.entidadFederativa || '',
        entidadResidencia: formData.entidadResidencia || formData.entidadFederativa || '',
        nivelEstudios: formData.nivelEstudios || '',
        nacionalidad: formData.nacionalidad || '',
        lenguaje: formData.lenguaje || '',
        moneda: formData.moneda || '',
        sucursal: formData.sucursal || '',
        fechaCuentaEje: formData.fechaCuentaEje || '',
        fechaAlta: formData.fechaAlta || '',
        estatusSIC: formData.estatusSIC || '',
        estatusListaNegra: formData.estatusListaNegra || '',
        estatusCliente: formData.estatusCliente || '',
        calificacionCliente: formData.calificacionCliente || '',
        cuentaEje: formData.cuentaEje || '',
        saldoCuentaEje: formData.saldoCuentaEje || '',
        fechaActivacion: formData.fechaActivacion || '',
        activacionTarjetaDebito: formData.activacionTarjetaDebito || false,
        numeroTarjetaDebito: formData.numeroTarjetaDebito || '',
        clasificacionCliente: formData.clasificacionCliente || '',
        telefonoDomicilio: formData.telefonoDomicilio || '',
        telefonoOficina: formData.telefonoOficina || '',
        telefonoCasa: formData.telefonoCasa || '',
        direccion: formData.direccion || '',
        direccionCalle: formData.direccionCalle || '',
        direccionNumeroExterior: formData.direccionNumeroExterior || '',
        direccionNumeroInterior: formData.direccionNumeroInterior || '',
        direccionColonia: formData.direccionColonia || '',
        direccionCodigoPostal: formData.direccionCodigoPostal || '',
        direccionCiudad: formData.direccionCiudad || '',
        direccionEstado: formData.direccionEstado || '',
        fax: formData.fax || '',
        datosContacto: formData.datosContacto || '',
        tipoEmpleo: formData.tipoEmpleo || '',
        nombreEmpresa: formData.nombreEmpresa || '',
        dependienteEconomico: formData.dependienteEconomico || '',
        ingresoMensual: formData.ingresoMensual || '',
        aniosLaborados: formData.aniosLaborados || '',
        otrosIngresos: formData.otrosIngresos || '',
        puestoNombre: formData.puestoNombre || '',
        nombreAval: formData.nombreAval || '',
        direccionEmpresa: formData.direccionEmpresa || '',
        sector: formData.sector || '',
        actividadEconomica1: formData.actividadEconomica1 || '',
        actividadEconomica2: formData.actividadEconomica2 || '',
        datosAdicionales: formData.datosAdicionales || '',
        claveDescuento: formData.claveDescuento || '',
        zonaPagadora: formData.zonaPagadora || '',
        porcentajeDescuento: formData.porcentajeDescuento || '',
        minimoLiquidez: formData.minimoLiquidez || '',
        tipoCobranza: formData.tipoCobranza || '',
        claveDependencia: formData.claveDependencia || '',
        institucionGobierno: formData.institucionGobierno || '',
        institucionGobiernoId: formData.institucionGobiernoId || '',

        // ── 22 Nodos hijos: SubTabs institucionales ──
        // Se agregan debajo según modo INSERT vs UPDATE
      };

      // ════════════════════════════════════════════════════════════════
      // REGLA INSTITUCIONAL: type = "Clientes" (plural, alineado con activación de prospectos)
      // subtipo y estatus se toman del formulario
      // ════════════════════════════════════════════════════════════════
      const typeValue = 'Clientes';
      const subtipoValue = formData.personalidad || 'Física';
      const estatusValue = formData.estatusCliente || 'Activo';

      // Determinar si es INSERT o UPDATE
      const existingUuid = (cliente as any)?.dbUuid || null;

      // ════════════════════════════════════════════════════════════════
      // SUBTABS: Recolectar datos de los 22 nodos hijos
      // ════════════════════════════════════════════════════════════════
      // Limpiar campos UI (seleccionada) de personasRelacionadas antes de persistir
      // spec §7: No guardar objetos vacíos, sin nombre, sin RFC o sin personalidad
      const personasLimpias = (personasRelacionadas || [])
        .filter((p: any) => {
          // spec §7: Filtrar registros vacíos o incompletos
          const nombre = p.nombreCliente || p.nombreCompleto || p.nombre || '';
          if (!nombre || nombre === 'Sin nombre') return false;
          return true;
        })
        .map(({ seleccionada, ...rest }: any) => ({
          ...rest,
          // spec §4: Asegurar que nombreCompleto siempre exista
          nombreCompleto: rest.nombreCompleto || rest.nombreCliente || [rest.nombre, rest.apellidoPaterno, rest.apellidoMaterno].filter(Boolean).join(' ') || '',
          estatusCliente: rest.estatusCliente || rest.estatus || '',
        }));

      const subtabData: Record<string, any[]> = {
        personasRelacionadas: personasLimpias,
        direcciones: direcciones || [],
        expedientesElectronicos: recoverSubtab(`cliente_${clienteId}_expedientes_list`, 'expedientesElectronicos'),
        sic: recoverSubtab(`cliente_${clienteId}_consultas_sic_list`, 'sic'),
        listasNegras: listasNegras || [],
        kyc: recoverSubtab(`cliente_${clienteId}_kyc`, 'kyc'),
        garantias: recoverSubtab(`cliente_${clienteId}_garantias_list`, 'garantias'),
        perfilTransaccional: recoverSubtab(`cliente_${clienteId}_perfil_transaccional_list`, 'perfilTransaccional'),
        cuentasAhorro: recoverSubtab(`cliente_${clienteId}_cuentas_ahorro`, 'cuentasAhorro'),
        solicitudesCredito: recoverSubtab(`cliente_${clienteId}_solicitudes_list`, 'solicitudesCredito'),
        creditos: recoverSubtab(`cliente_${clienteId}_creditos_list`, 'creditos'),
        inversiones: recoverSubtab(`cliente_${clienteId}_inversiones_list`, 'inversiones'),
        movimientos: recoverSubtab(`cliente_${clienteId}_movimientos`, 'movimientos'),
        avisos: recoverSubtab(`cliente_${clienteId}_avisos`, 'avisos'),
        auditoria: recoverSubtab(`cliente_${clienteId}_auditoria`, 'auditoria'),
        archivosAdjuntos: recoverSubtab(`cliente_${clienteId}_archivos`, 'archivosAdjuntos'),
        convenios: recoverSubtab(`cliente_${clienteId}_convenios`, 'convenios'),
        cobranzaNormal: recoverSubtab(`cliente_${clienteId}_cobranza_normal`, 'cobranzaNormal'),
        cobranzaAcumulativa: recoverSubtab(`cliente_${clienteId}_cobranza_acumulativa`, 'cobranzaAcumulativa'),
        estadoCuenta: recoverSubtab(`cliente_${clienteId}_estado_cuenta_creditos`, 'estadoCuenta'),
        calendario: recoverSubtab(`cliente_${clienteId}_calendario`, 'calendario'),
        tarjetaDebito: [],
      };

      if (existingUuid) {
        // ── UPDATE PARCIAL: Solo incluir subtabs CON datos ──
        // Evita "index row size exceeds btree maximum 2704" en J_CLIENTES_data_key.
        // El deep merge en syncToJClientes preserva subtabs existentes en BD
        // porque deepMergeData solo toca keys que están en el incoming.
        for (const [key, arr] of Object.entries(subtabData)) {
          if (Array.isArray(arr) && arr.length > 0) {
            dataJson[key] = arr;
          }
        }
        // ⚠️ v5.1: NO eliminar campos vacíos ('') del nodo padre en UPDATE.
        // Los campos con valor '' deben llegar al deepMergeData para que puedan
        // sobrescribir los valores existentes en la BD cuando el usuario los limpia
        // intencionalmente. La compactación en useSyncJClientes maneja el tamaño.
        // Solo eliminar null/undefined que no aportan información:
        for (const key of Object.keys(dataJson)) {
          const val = dataJson[key];
          if (val === null || val === undefined) {
            delete dataJson[key];
          }
        }
        console.log(`[AltaClienteDefault] UPDATE parcial — subtabs incluidos:`,
          Object.keys(subtabData).filter(k => subtabData[k].length > 0).join(', ') || '(ninguno con datos)');
        console.log(`[AltaClienteDefault] UPDATE parcial — payload keys: ${Object.keys(dataJson).length}`);
      } else {
        // ── INSERT COMPLETO: Incluir TODOS los subtabs (incluso vacíos) — regla institucional
        for (const [key, arr] of Object.entries(subtabData)) {
          dataJson[key] = arr;
        }
      }

      console.log(`[AltaClienteDefault] ════ GUARDAR CLIENTE ════`);
      console.log(`[AltaClienteDefault] Modo: ${mode} | type=${typeValue} | subtipo=${subtipoValue} | estatus=${estatusValue}`);
      console.log(`[AltaClienteDefault] existingUuid: ${existingUuid || '(nuevo — INSERT)'}`);
      console.log(`[AltaClienteDefault] data keys (${Object.keys(dataJson).length}):`, Object.keys(dataJson).join(', '));
      console.log(`[AltaClienteDefault] par_cliente_id (institución gobierno): ${formData.institucionGobiernoId || '(null — sin institución)'}`);

      // ════════════════════════════════════════════════════════════════
      // REGLA INSTITUCIONAL: El módulo Cliente NO valida cuentas.
      // La validación de unicidad de Cuenta Eje SOLO se ejecuta en
      // el módulo Cuentas de Ahorro, cuando:
      //   1. El usuario está en el módulo Cuentas de Ahorro
      //   2. El usuario presiona Guardar en una cuenta
      //   3. El campo no_cuenta fue modificado
      //   4. La cuenta pertenece a un cliente distinto
      // Ver: /src/imports/cliente-cuenta-validacion-fix.md
      // ════════════════════════════════════════════════════════════════

      // ── Sincronizar con J_CLIENTES (Supabase) ──
      const returnedId = await syncToJClientes({
        type: typeValue,
        tipoFormulario: subtipoValue,
        estatus: estatusValue,
        data: dataJson,
        label: 'Cliente',
        existingId: existingUuid,
        par_cliente_id: formData.institucionGobiernoId || null,
      });

      if (!returnedId) {
        toast.error('Error al guardar cliente en J_CLIENTES');
        setSaving(false);
        return;
      }

      console.log(`[AltaClienteDefault] ✅ J_CLIENTES ${existingUuid ? 'UPDATE' : 'INSERT'} exitoso — UUID: ${returnedId}`);

      // Notificar al padre con los datos completos
      const clienteData = {
        ...formData,
        nombre: nombreCompleto || 'Sin nombre',
        dbUuid: returnedId,
        direcciones,
        personasRelacionadas,
        listasNegras,
      };

      onSave(clienteData);

      // Si es un nuevo cliente, limpiar datos después de guardar exitosamente
      if (mode === 'nuevo') {
        clearFormData();
        clearAllClienteData(clienteId);
      }
    } catch (err) {
      console.error('[AltaClienteDefault] Error inesperado al guardar:', err);
      toast.error('Error inesperado al guardar cliente', { description: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Si es modo nuevo, limpiar todos los datos temporales antes de salir
    if (mode === 'nuevo') {
      clearFormData();
      clearAllClienteData(clienteId);
    }
    onBack();
  };

  const tabs = [
    { id: 'default', label: 'Default' },
    { id: 'personas-relacionadas', label: 'Personas Relacionadas' },
    { id: 'direcciones', label: 'Direcciones' },
    { id: 'expedientes', label: 'Expedientes Electrónicos' },
    { id: 'sic', label: 'SIC' },
    { id: 'listas-negras', label: 'Listas Negras' },
    { id: 'kyc', label: 'KYC' },
    { id: 'garantias', label: 'Garantías' },
    { id: 'perfil-transaccional', label: 'Perfil Transaccional' },
    { id: 'cotizaciones', label: 'Cotizaciones' },
    { id: 'cuentas-ahorro', label: 'Cuentas de Ahorro' },
    { id: 'solicitudes', label: 'Solicitudes de Crédito' },
    { id: 'creditos', label: 'Créditos' },
    { id: 'inversiones', label: 'Inversiones' },
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'avisos', label: 'Avisos' },
    { id: 'auditoria', label: 'Auditoría' },
    { id: 'archivos-adjuntos', label: 'Archivos Adjuntos' },
    { id: 'convenios', label: 'Convenios' },
    { id: 'cobranza-normal', label: 'Cobranza Normal' },
    { id: 'cobranza-acumulativa', label: 'Cobranza Acumulativa' },
    { id: 'estado-cuenta', label: 'Estado de Cuenta' },
    { id: 'calendario', label: 'Calendario' },
    { id: 'tarjeta-debito', label: 'Tarjeta de Debito' },
  ];

  return (
    <div className="bg-[#F5F5F5] min-h-screen">
      {/* Header con icono y título */}
      <div className="bg-white px-4 py-2.5 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="stroke-accent-theme" strokeWidth="1.5">
              <circle cx="10" cy="6" r="3"/>
              <path d="M3 18c0-3.5 3-6 7-6s7 2.5 7 6"/>
            </svg>
            <span className="text-sm text-gray-700 font-normal">Alta Cliente</span>
            <button className="ml-2 p-1">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="7" cy="7" r="5"/>
                <path d="M11 11l3 3"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button className="text-accent-theme hover:underline">Lista</button>
            <button className="text-accent-theme hover:underline">Buscar</button>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {mostrarGuardar && (
            <button 
              onClick={handleSave}
              disabled={saving || isView}
              className={`px-5 py-1.5 btn-secondary-theme rounded text-xs font-normal ${saving ? 'opacity-60 cursor-wait' : ''}`}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
          <button 
            onClick={handleCancel}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700"
          >
            {mode === 'ver' ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="px-4 py-3">
        <div className="bg-white border border-gray-300">
          {/* Información Principal */}
          <div className="border-l-4 border-primary-theme px-3 py-1.5">
            <span className="text-xs font-medium text-gray-800 uppercase">Información Principal</span>
          </div>

          {/* ═══ HELPERS DE PERSONALIDAD — controlan visibilidad de campos ═══ */}
          {(() => {
            const isMoral = formData.personalidad === 'Moral';
            const isFisicaOrPFAE = formData.personalidad === 'Física' || formData.personalidad === 'PFAE' || !formData.personalidad;
            const isPFAE = formData.personalidad === 'PFAE';
            return (
          <div className="p-3">
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {/* ════════════════════════════════════════════════════ */}
              {/* Columna 1 - Identificación y Datos Personales */}
              {/* ════════════════════════════════════════════════════ */}
              <div className="space-y-1.5">
                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">ID CLIENTE <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value={formData.idCliente || ''}
                    disabled
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                  />
                </div>

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">PERSONALIDAD <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.personalidad}</div>
                  ) : (
                    <select 
                      value={formData.personalidad || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Moral') {
                          updateFormFields({ 
                            personalidad: val, 
                            apellidoPaterno: '', 
                            apellidoMaterno: '',
                            sexo: '',
                            estadoCivil: '',
                            curp: '',
                            edad: '',
                            nivelEstudios: '',
                          });
                        } else if (val === 'Física') {
                          updateFormFields({
                            personalidad: val,
                            razonSocial: '',
                          });
                        } else {
                          handleChange('personalidad', val);
                        }
                      }}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Elige...</option>
                      <option value="Física">Física</option>
                      <option value="Moral">Moral</option>
                      <option value="PFAE">PFAE (Física con Actividad Empresarial)</option>
                    </select>
                  )}
                </div>

                {/* CLASIFICACIÓN DEL CLIENTE — catálogo dinámico desde DB */}
                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">CLASIFICACIÓN DEL CLIENTE <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.clasificacionCliente || '—'}</div>
                  ) : (
                    <select 
                      value={formData.clasificacionCliente || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleChange('clasificacionCliente', val);
                        // Si no es clasificación de gobierno/magisterio, limpiar institución
                        if (!val.toLowerCase().includes('gobierno') && !val.toLowerCase().includes('magisterio')) {
                          handleChange('institucionGobierno', '');
                          handleChange('institucionGobiernoId', '');
                        }
                      }}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Seleccione...</option>
                      {catalogoClasificaciones.map((clasif) => (
                        <option key={clasif} value={clasif}>{clasif}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* NOMBRE / DENOMINACIÓN — cambia label según personalidad */}
                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">
                    {isMoral ? 'DENOMINACIÓN / RAZÓN SOCIAL' : 'NOMBRE'} <span className="text-red-600">*</span>
                  </label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{isMoral ? (formData.razonSocial || formData.nombre) : formData.nombre}</div>
                  ) : (
                    <input 
                      type="text" 
                      value={isMoral ? (formData.razonSocial || formData.nombre || '') : (formData.nombre || '')}
                      onChange={(e) => {
                        if (isMoral) {
                          updateFormFields({ razonSocial: e.target.value, nombre: e.target.value });
                        } else {
                          handleChange('nombre', e.target.value);
                        }
                      }}
                      placeholder={isMoral ? 'Ej: ACME, S.A. DE C.V.' : ''}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  )}
                </div>

                {/* Apellidos — solo Persona Física / PFAE */}
                {isFisicaOrPFAE && (
                  <>
                    <div className="flex flex-col min-h-[52px]">
                      <label className="text-[10px] text-gray-600 mb-0.5">APELLIDO PATERNO <span className="text-red-600">*</span></label>
                      {!camposEditables ? (
                        <div className="px-2 py-1 text-xs text-gray-700">{formData.apellidoPaterno}</div>
                      ) : (
                        <input 
                          type="text" 
                          value={formData.apellidoPaterno || ''}
                          onChange={(e) => handleChange('apellidoPaterno', e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                      )}
                    </div>

                    <div className="flex flex-col min-h-[52px]">
                      <label className="text-[10px] text-gray-600 mb-0.5">APELLIDO MATERNO</label>
                      {!camposEditables ? (
                        <div className="px-2 py-1 text-xs text-gray-700">{formData.apellidoMaterno}</div>
                      ) : (
                        <input 
                          type="text" 
                          value={formData.apellidoMaterno || ''}
                          onChange={(e) => handleChange('apellidoMaterno', e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                      )}
                    </div>
                  </>
                )}

                {/* FECHA NACIMIENTO / CONSTITUCIÓN */}
                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">
                    {isMoral ? 'FECHA DE CONSTITUCIÓN' : 'FECHA DE NACIMIENTO'} <span className="text-red-600">*</span>
                  </label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.fechaNacimiento}</div>
                  ) : (
                    <DatePicker
                      value={formData.fechaNacimiento || ''}
                      onChange={(date) => handleChange('fechaNacimiento', date)}
                      placeholder="DD/MM/YYYY"
                    />
                  )}
                </div>

                {/* Edad — solo Persona Física / PFAE */}
                {isFisicaOrPFAE && (
                  <div className="flex flex-col min-h-[52px]">
                    <label className="text-[10px] text-gray-600 mb-0.5">EDAD</label>
                    <input 
                      type="text" 
                      value={formData.edad || ''}
                      disabled
                      className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                    />
                  </div>
                )}

                {/* Sexo — solo Persona Física / PFAE */}
                {isFisicaOrPFAE && (
                  <div className="flex flex-col min-h-[52px]">
                    <label className="text-[10px] text-gray-600 mb-0.5">SEXO</label>
                    {!camposEditables ? (
                      <div className="px-2 py-1 text-xs text-gray-700">{formData.sexo}</div>
                    ) : (
                      <select 
                        value={formData.sexo || ''}
                        onChange={(e) => handleChange('sexo', e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded"
                      >
                        <option value="">Elige...</option>
                        <option>Masculino</option>
                        <option>Femenino</option>
                      </select>
                    )}
                  </div>
                )}

                {/* Estado Civil — solo Persona Física / PFAE */}
                {isFisicaOrPFAE && (
                  <div className="flex flex-col min-h-[52px]">
                    <label className="text-[10px] text-gray-600 mb-0.5">ESTADO CIVIL</label>
                    {!camposEditables ? (
                      <div className="px-2 py-1 text-xs text-gray-700">{formData.estadoCivil}</div>
                    ) : (
                      <select 
                        value={formData.estadoCivil || ''}
                        onChange={(e) => handleChange('estadoCivil', e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded"
                      >
                        <option value="">Elige...</option>
                        <option>Soltero</option>
                        <option>Casado</option>
                        <option>Divorciado</option>
                        <option>Viudo</option>
                      </select>
                    )}
                  </div>
                )}

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">NACIONALIDAD</label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.nacionalidad}</div>
                  ) : (
                    <select 
                      value={formData.nacionalidad || ''}
                      onChange={(e) => handleChange('nacionalidad', e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Elige...</option>
                      <option>Mexicana</option>
                      <option>Guatemalteco</option>
                      <option>Estadounidense</option>
                      <option>Canadiense</option>
                      <option>Española</option>
                      <option>Colombiana</option>
                      <option>Argentina</option>
                      <option>Chilena</option>
                      <option>Venezolana</option>
                      <option>Cubana</option>
                      <option>Otra</option>
                    </select>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════════════════ */}
              {/* Columna 2 - Registro y Configuración */}
              {/* ════════════════════════════════════════════════════ */}
              <div className="space-y-1.5">
                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">RFC</label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.rfc}</div>
                  ) : (
                    <input 
                      type="text" 
                      value={formData.rfc || ''}
                      onChange={(e) => handleChange('rfc', e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  )}
                </div>

                {/* CURP — solo Persona Física / PFAE */}
                {isFisicaOrPFAE && (
                  <div className="flex flex-col min-h-[52px]">
                    <label className="text-[10px] text-gray-600 mb-0.5">CURP</label>
                    {!camposEditables ? (
                      <div className="px-2 py-1 text-xs text-gray-700">{formData.curp}</div>
                    ) : (
                      <input 
                        type="text" 
                        value={formData.curp || ''}
                        onChange={(e) => handleChange('curp', e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded"
                      />
                    )}
                  </div>
                )}

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">
                    {isMoral ? 'ENTIDAD FEDERATIVA DE REGISTRO' : 'ENTIDAD FEDERATIVA DE NACIMIENTO'} <span className="text-red-600">*</span>
                  </label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.entidadFederativaNacimiento}</div>
                  ) : (
                    <select 
                      value={formData.entidadFederativaNacimiento || ''}
                      onChange={(e) => handleChange('entidadFederativaNacimiento', e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Seleccione...</option>
                      <option>Aguascalientes</option>
                      <option>Baja California</option>
                      <option>Baja California Sur</option>
                      <option>Campeche</option>
                      <option>Chiapas</option>
                      <option>Chihuahua</option>
                      <option>Ciudad de México</option>
                      <option>Coahuila</option>
                      <option>Colima</option>
                      <option>Durango</option>
                      <option>Guanajuato</option>
                      <option>Guerrero</option>
                      <option>Hidalgo</option>
                      <option>Jalisco</option>
                      <option>México</option>
                      <option>Michoacán</option>
                      <option>Morelos</option>
                      <option>Nayarit</option>
                      <option>Nuevo León</option>
                      <option>Oaxaca</option>
                      <option>Puebla</option>
                      <option>Querétaro</option>
                      <option>Quintana Roo</option>
                      <option>San Luis Potosí</option>
                      <option>Sinaloa</option>
                      <option>Sonora</option>
                      <option>Tabasco</option>
                      <option>Tamaulipas</option>
                      <option>Tlaxcala</option>
                      <option>Veracruz</option>
                      <option>Yucatán</option>
                      <option>Zacatecas</option>
                    </select>
                  )}
                </div>

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">
                    {isMoral ? 'DOMICILIO FISCAL (ENTIDAD)' : 'ENTIDAD DONDE VIVE'} <span className="text-red-600">*</span>
                  </label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.entidadResidencia}</div>
                  ) : (
                    <select 
                      value={formData.entidadResidencia || ''}
                      onChange={(e) => handleChange('entidadResidencia', e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Seleccione...</option>
                      <option>Aguascalientes</option>
                      <option>Baja California</option>
                      <option>Baja California Sur</option>
                      <option>Campeche</option>
                      <option>Chiapas</option>
                      <option>Chihuahua</option>
                      <option>Ciudad de México</option>
                      <option>Coahuila</option>
                      <option>Colima</option>
                      <option>Durango</option>
                      <option>Guanajuato</option>
                      <option>Guerrero</option>
                      <option>Hidalgo</option>
                      <option>Jalisco</option>
                      <option>México</option>
                      <option>Michoacán</option>
                      <option>Morelos</option>
                      <option>Nayarit</option>
                      <option>Nuevo León</option>
                      <option>Oaxaca</option>
                      <option>Puebla</option>
                      <option>Querétaro</option>
                      <option>Quintana Roo</option>
                      <option>San Luis Potosí</option>
                      <option>Sinaloa</option>
                      <option>Sonora</option>
                      <option>Tabasco</option>
                      <option>Tamaulipas</option>
                      <option>Tlaxcala</option>
                      <option>Veracruz</option>
                      <option>Yucatán</option>
                      <option>Zacatecas</option>
                    </select>
                  )}
                </div>

                {/* Nivel de Estudios — solo Persona Física / PFAE */}
                {isFisicaOrPFAE && (
                  <div className="flex flex-col min-h-[52px]">
                    <label className="text-[10px] text-gray-600 mb-0.5">NIVEL DE ESTUDIOS</label>
                    {!camposEditables ? (
                      <div className="px-2 py-1 text-xs text-gray-700">{formData.nivelEstudios}</div>
                    ) : (
                      <select 
                        value={formData.nivelEstudios || ''}
                        onChange={(e) => handleChange('nivelEstudios', e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded"
                      >
                        <option value="">Elige...</option>
                        <option>Primaria</option>
                        <option>Secundaria</option>
                        <option>Preparatoria terminada</option>
                        <option>Licenciatura</option>
                        <option>Maestría</option>
                        <option>Doctorado</option>
                      </select>
                    )}
                  </div>
                )}

                {/* Sector y Actividad Económica — Persona Moral y PFAE */}
                {(isMoral || isPFAE) && (
                  <>
                    <div className="flex flex-col min-h-[52px]">
                      <label className="text-[10px] text-gray-600 mb-0.5">SECTOR ECONÓMICO</label>
                      {!camposEditables ? (
                        <div className="px-2 py-1 text-xs text-gray-700">{formData.sector}</div>
                      ) : (
                        <select 
                          value={formData.sector || ''}
                          onChange={(e) => handleChange('sector', e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded"
                        >
                          <option value="">Seleccione...</option>
                          <option>Primario (Agropecuario)</option>
                          <option>Secundario (Industrial)</option>
                          <option>Terciario (Servicios)</option>
                          <option>Gobierno</option>
                          <option>Educación</option>
                          <option>Salud</option>
                          <option>Otro</option>
                        </select>
                      )}
                    </div>
                    <div className="flex flex-col min-h-[52px]">
                      <label className="text-[10px] text-gray-600 mb-0.5">ACTIVIDAD ECONÓMICA</label>
                      {!camposEditables ? (
                        <div className="px-2 py-1 text-xs text-gray-700">{formData.actividadEconomica1}</div>
                      ) : (
                        <input 
                          type="text" 
                          value={formData.actividadEconomica1 || ''}
                          onChange={(e) => handleChange('actividadEconomica1', e.target.value)}
                          placeholder="Ej: Comercio al por mayor"
                          className="px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                      )}
                    </div>
                  </>
                )}

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">LENGUAJE</label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.lenguaje}</div>
                  ) : (
                    <select 
                      value={formData.lenguaje || ''}
                      onChange={(e) => handleChange('lenguaje', e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Elige...</option>
                      <option>Español</option>
                      <option>Inglés</option>
                    </select>
                  )}
                </div>

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">MONEDA</label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.moneda}</div>
                  ) : (
                    <select 
                      value={formData.moneda || ''}
                      onChange={(e) => handleChange('moneda', e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Elige...</option>
                      <option>MXN</option>
                      <option>USD</option>
                    </select>
                  )}
                </div>

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">SUCURSAL <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value={formData.sucursal || ''}
                    disabled
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                  />
                </div>

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">FECHA CUENTA EJE <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value={normalizeDateTimeString(formData.fechaCuentaEje)}
                    disabled
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                  />
                </div>

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">FECHA DE ALTA YYA</label>
                  <input 
                    type="text" 
                    value={normalizeDateString(formData.fechaAlta)}
                    disabled
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                  />
                </div>
              </div>

              {/* ════════════════════════════════════════════════════ */}
              {/* Columna 3 - Estatus y Financieros */}
              {/* ════════════════════════════════════════════════════ */}
              <div className="space-y-1.5">
                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS SIC <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value={formData.estatusSIC || ''}
                    disabled
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                  />
                </div>

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS LISTA NEGRA <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value={formData.estatusListaNegra || ''}
                    disabled
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                  />
                </div>

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">(ESTATUS DEL CLIENTE) <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.estatusCliente}</div>
                  ) : (
                    <select 
                      value={formData.estatusCliente || ''}
                      onChange={(e) => handleChange('estatusCliente', e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                      <option value="Suspendido">Suspendido</option>
                      <option value="Bloqueado">Bloqueado</option>
                      <option value="En proceso">En proceso</option>
                      <option value="Baja">Baja</option>
                    </select>
                  )}
                </div>

                <div className="flex flex-col min-h-[52px]">
                  <label className="text-[10px] text-gray-600 mb-0.5">CALIFICACIÓN DEL CLIENTE <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">{formData.calificacionCliente}</div>
                  ) : (
                    <select 
                      value={formData.calificacionCliente || ''}
                      onChange={(e) => handleChange('calificacionCliente', e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                    >
                      <option value="">Seleccione...</option>
                      <option value="A1">A1 - Riesgo mínimo</option>
                      <option value="A2">A2 - Riesgo bajo</option>
                      <option value="B1">B1 - Riesgo bajo-moderado</option>
                      <option value="B2">B2 - Riesgo moderado</option>
                      <option value="B3">B3 - Riesgo medio</option>
                      <option value="C1">C1 - Riesgo medio-alto</option>
                      <option value="C2">C2 - Riesgo alto</option>
                      <option value="D">D - Riesgo notable</option>
                      <option value="E">E - Irrecuperable</option>
                    </select>
                  )}
                </div>

                {/* Mostrar campos financieros solo en modo editar y ver */}
                {mode !== 'nuevo' && (
                  <>
                    <div className="flex flex-col min-h-[52px]">
                      <label className="text-[10px] text-gray-600 mb-0.5">NÚMERO DE CUENTA EJE</label>
                      {!camposEditables ? (
                        <div className="px-2 py-1 text-xs text-gray-700">{formData.cuentaEje || ''}</div>
                      ) : (
                        <input 
                          type="text" 
                          value={formData.cuentaEje || ''}
                          disabled
                          className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                        />
                      )}
                    </div>

                    <div className="flex flex-col min-h-[52px]">
                      <label className="text-[10px] text-gray-600 mb-0.5">SALDO CUENTA EJE</label>
                      {!camposEditables ? (
                        <div className="px-2 py-1 text-xs text-gray-700">{formData.saldoCuentaEje || ''}</div>
                      ) : (
                        <input 
                          type="text" 
                          value={formData.saldoCuentaEje || ''}
                          disabled
                          className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                        />
                      )}
                    </div>

                    <div className="flex flex-col min-h-[52px]">
                      <label className="text-[10px] text-gray-600 mb-0.5">FECHA DE ACTIVACIÓN</label>
                      {!camposEditables ? (
                        <div className="px-2 py-1 text-xs text-gray-700">{formData.fechaActivacion || ''}</div>
                      ) : (
                        <input 
                          type="text" 
                          value={formData.fechaActivacion || ''}
                          disabled
                          className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                        />
                      )}
                    </div>

                    {/* Checkbox Activación de Tarjeta Débito */}
                    <div className="flex items-center gap-2 pt-1 min-h-[52px]">
                      <input
                        type="checkbox"
                        id="activacionTarjetaDebito"
                        checked={formData.activacionTarjetaDebito || false}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          // Validar que exista cuenta eje
                          if (isChecked && !formData.cuentaEje) {
                            alert('Debe existir una Cuenta Eje para activar la tarjeta de débito');
                            return;
                          }
                          handleChange('activacionTarjetaDebito', isChecked);
                          // Si se desmarca, limpiar el número
                          if (!isChecked) {
                            handleChange('numeroTarjetaDebito', '');
                          }
                        }}
                        disabled={!camposEditables}
                        className="w-4 h-4"
                      />
                      <label htmlFor="activacionTarjetaDebito" className="text-[10px] text-gray-600">
                        ACTIVACIÓN DE TARJETA DÉBITO
                        {formData.activacionTarjetaDebito && formData.numeroTarjetaDebito && (
                          <span className="ml-1 text-green-600">✓</span>
                        )}
                      </label>
                    </div>

                    {/* Campo: Número de Tarjeta Débito - Siempre visible en modo editar/ver */}
                    <div className="flex flex-col min-h-[52px]">
                      <label className="text-[10px] text-gray-600 mb-0.5">
                        NÚMERO DE TARJETA DÉBITO
                      </label>
                      {!camposEditables ? (
                        <div className="px-2 py-1 text-xs text-gray-700">{formData.numeroTarjetaDebito || ''}</div>
                      ) : (
                        <input 
                          type="text" 
                          value={formData.numeroTarjetaDebito || ''}
                          disabled
                          className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                        />
                      )}
                    </div>

                  </>
                )}

                {/* INSTITUCIÓN GOBIERNO — siempre visible, catálogo filtrado por clasificacionCliente = "Gobierno Magisterio" */}
                <CampoInstitucionGobierno
                  value={formData.institucionGobierno || ''}
                  onChange={(value, institucion) => {
                    handleChange('institucionGobierno', value);
                    if (institucion) {
                      handleChange('institucionGobiernoId', institucion.id);
                    } else {
                      handleChange('institucionGobiernoId', '');
                    }
                  }}
                  disabled={!camposEditables}
                  variant="clientes"
                />
              </div>
            </div>
          </div>
            ); /* cierre del return del IIFE de personalidad */
          })()}

          {/* Tabs secundarios */}
          <div className="bg-primary-theme border-t border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {tabs.filter((tab) => tab.id !== 'archivos-adjuntos').map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-[10px] whitespace-nowrap border-r border-gray-500/30 ${
                    activeTab === tab.id
                      ? 'bg-secondary-theme text-white font-medium'
                      : 'text-white/90'
                  }`}
                  style={activeTab !== tab.id ? {
                    transition: 'background-color 0.2s'
                  } : {}}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = 'var(--theme-primary-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = '';
                    }
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contenido de tabs - Solo Default visible */}
          {activeTab === 'default' && (
            <>
              {/* Encabezado DEFAULT */}
              <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2 border-t border-gray-300">
                <span className="text-sm font-medium text-gray-800">DEFAULT</span>
              </div>

              {/* Correo Electrónico | Teléfono / Dirección */}
              <div className="border-t border-gray-300">
                <div className="border-l-4 border-primary-theme px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-800 uppercase">Correo Electrónico | Teléfono / Dirección</span>
                </div>
                
                <div className="p-3">
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                    {/* Columna 1 */}
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">TELÉFONO OFICINA</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.telefonoOficina}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.telefonoOficina}
                            onChange={(e) => handleChange('telefonoOficina', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">TELÉFONO DE CASA</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.telefonoCasa}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.telefonoCasa}
                            onChange={(e) => handleChange('telefonoCasa', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">CORREO ELECTRÓNICO <span className="text-red-600">*</span></label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.correoElectronico}</div>
                        ) : (
                          <input 
                            type="email" 
                            value={formData.correoElectronico}
                            onChange={(e) => handleChange('correoElectronico', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">CALLE</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.direccionCalle}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.direccionCalle}
                            onChange={(e) => handleChange('direccionCalle', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">NÚMERO EXTERIOR</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.direccionNumeroExterior}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.direccionNumeroExterior}
                            onChange={(e) => handleChange('direccionNumeroExterior', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">NÚMERO INTERIOR</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.direccionNumeroInterior}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.direccionNumeroInterior}
                            onChange={(e) => handleChange('direccionNumeroInterior', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>
                    </div>

                    {/* Columna 2 */}
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">COLONIA</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.direccionColonia}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.direccionColonia}
                            onChange={(e) => handleChange('direccionColonia', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">CÓDIGO POSTAL</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.direccionCodigoPostal}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.direccionCodigoPostal}
                            onChange={(e) => handleChange('direccionCodigoPostal', e.target.value)}
                            maxLength={5}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">CIUDAD / MUNICIPIO</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.direccionCiudad}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.direccionCiudad}
                            onChange={(e) => handleChange('direccionCiudad', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">ESTADO</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.direccionEstado}</div>
                        ) : (
                          <select 
                            value={formData.direccionEstado}
                            onChange={(e) => handleChange('direccionEstado', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="">Elige...</option>
                            <option>Aguascalientes</option>
                            <option>Baja California</option>
                            <option>Baja California Sur</option>
                            <option>Campeche</option>
                            <option>Coahuila</option>
                            <option>Colima</option>
                            <option>Chiapas</option>
                            <option>Chihuahua</option>
                            <option>Ciudad de México</option>
                            <option>Durango</option>
                            <option>Estado de México</option>
                            <option>Guanajuato</option>
                            <option>Guerrero</option>
                            <option>Hidalgo</option>
                            <option>Jalisco</option>
                            <option>Michoacán</option>
                            <option>Morelos</option>
                            <option>Nayarit</option>
                            <option>Nuevo León</option>
                            <option>Oaxaca</option>
                            <option>Puebla</option>
                            <option>Querétaro</option>
                            <option>Quintana Roo</option>
                            <option>San Luis Potosí</option>
                            <option>Sinaloa</option>
                            <option>Sonora</option>
                            <option>Tabasco</option>
                            <option>Tamaulipas</option>
                            <option>Tlaxcala</option>
                            <option>Veracruz</option>
                            <option>Yucatán</option>
                            <option>Zacatecas</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Columna 3 */}
                    <div>
                      <div className="flex flex-col h-full">
                        <label className="text-[10px] text-gray-600 mb-0.5">DATOS CONTACTO</label>
                        {!camposEditables ? (
                          <div className="flex-1 px-2 py-1 text-xs text-gray-700 whitespace-pre-wrap">{formData.datosContacto}</div>
                        ) : (
                          <textarea 
                            value={formData.datosContacto}
                            onChange={(e) => handleChange('datosContacto', e.target.value)}
                            placeholder="Poner nombre, Apellido Paterno Apellido Materno&#10;DOMICILIO CONOCIDO"
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded resize-none h-full min-h-[200px]"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Empleo */}
              <div className="border-t border-gray-300">
                <div className="bg-[#D9D9D9] px-3 py-1.5 border-b border-gray-300">
                  <span className="text-xs font-medium text-gray-700">Empleo</span>
                </div>
                
                <div className="p-3 bg-[#F5F5F5]">
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                    {/* Columna 1 */}
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">TIPO EMPLEO <span className="text-red-600">*</span></label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.tipoEmpleo}</div>
                        ) : (
                          <select 
                            value={formData.tipoEmpleo}
                            onChange={(e) => handleChange('tipoEmpleo', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="">Elige...</option>
                            <option>Ninguno Empleo</option>
                            <option>Empleado</option>
                            <option>Independiente</option>
                          </select>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">NOMBRE EMPRESA</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.nombreEmpresa}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.nombreEmpresa}
                            onChange={(e) => handleChange('nombreEmpresa', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">% DEPENDIENTE ECONÓMICO</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.dependienteEconomico}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.dependienteEconomico}
                            onChange={(e) => handleChange('dependienteEconomico', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">INGRESO INGRESO MENSUAL <span className="text-red-600">*</span></label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.ingresoMensual}</div>
                        ) : (
                          <select 
                            value={formData.ingresoMensual || ''}
                            onChange={(e) => handleChange('ingresoMensual', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="">Elige...</option>
                            <option>$10,000 - $20,000</option>
                            <option>$20,000 - $30,000</option>
                          </select>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">AÑOS LABORADOS <span className="text-red-600">*</span></label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.aniosLaborados}</div>
                        ) : (
                          <select 
                            value={formData.aniosLaborados}
                            onChange={(e) => handleChange('aniosLaborados', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option>2</option>
                            <option>3</option>
                            <option>5</option>
                            <option>10</option>
                          </select>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">OTROS INGRESOS</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.otrosIngresos}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.otrosIngresos}
                            onChange={(e) => handleChange('otrosIngresos', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>
                    </div>

                    {/* Columna 2 */}
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">PUESTO NOMBRE</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.puestoNombre}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.puestoNombre}
                            onChange={(e) => handleChange('puestoNombre', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">NOMBRE DEL AVAL MTO</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.nombreAval}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.nombreAval}
                            onChange={(e) => handleChange('nombreAval', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">DIRECCIÓN EMPRESA</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700 whitespace-pre-wrap">{formData.direccionEmpresa}</div>
                        ) : (
                          <textarea 
                            value={formData.direccionEmpresa}
                            onChange={(e) => handleChange('direccionEmpresa', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded resize-none"
                            rows={4}
                          />
                        )}
                      </div>
                    </div>

                    {/* Columna 3 */}
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">SECTOR</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.sector}</div>
                        ) : (
                          <select 
                            value={formData.sector}
                            onChange={(e) => handleChange('sector', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option>BANCA MÚLTIPLE CONTROLADORA</option>
                            <option>Servicios</option>
                          </select>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">ROBE BPOR ACTIVAR ECONOMÍA</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.actividadEconomica1}</div>
                        ) : (
                          <select 
                            value={formData.actividadEconomica1}
                            onChange={(e) => handleChange('actividadEconomica1', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option>Rec. otros activos real corp no cot. ret.</option>
                          </select>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">ACTIVIDAD ECONOMÍA</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.actividadEconomica2}</div>
                        ) : (
                          <select 
                            value={formData.actividadEconomica2}
                            onChange={(e) => handleChange('actividadEconomica2', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option>Efectos de gas, taxis, etc.</option>
                          </select>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">DATOS ADICIONALES</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700 whitespace-pre-wrap">{formData.datosAdicionales}</div>
                        ) : (
                          <textarea 
                            value={formData.datosAdicionales}
                            onChange={(e) => handleChange('datosAdicionales', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded resize-none"
                            rows={3}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Parámetros descuento de nómina */}
              <div className="border-t border-gray-300">
                <div className="bg-[#D9D9D9] px-3 py-1.5 border-b border-gray-300">
                  <span className="text-xs font-medium text-gray-700">Parámetros descuento de nómina</span>
                </div>
                
                <div className="p-3 bg-[#F5F5F5]">
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                    {/* Columna 1 */}
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">CLAVE DESCUENTO</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.claveDescuento}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.claveDescuento}
                            onChange={(e) => handleChange('claveDescuento', e.target.value)}
                            maxLength={20}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">ZONA PAGADORA</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.zonaPagadora}</div>
                        ) : (
                          <select 
                            value={formData.zonaPagadora}
                            onChange={(e) => handleChange('zonaPagadora', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="">Elige...</option>
                            <option>Aguascalientes</option>
                            <option>Baja California</option>
                            <option>Baja California Sur</option>
                            <option>Campeche</option>
                            <option>Coahuila</option>
                            <option>Colima</option>
                            <option>Chiapas</option>
                            <option>Chihuahua</option>
                            <option>Ciudad de México</option>
                            <option>Durango</option>
                            <option>Estado de México</option>
                            <option>Guanajuato</option>
                            <option>Guerrero</option>
                            <option>Hidalgo</option>
                            <option>Jalisco</option>
                            <option>Michoacán</option>
                            <option>Morelos</option>
                            <option>Nayarit</option>
                            <option>Nuevo León</option>
                            <option>Oaxaca</option>
                            <option>Puebla</option>
                            <option>Querétaro</option>
                            <option>Quintana Roo</option>
                            <option>San Luis Potosí</option>
                            <option>Sinaloa</option>
                            <option>Sonora</option>
                            <option>Tabasco</option>
                            <option>Tamaulipas</option>
                            <option>Tlaxcala</option>
                            <option>Veracruz</option>
                            <option>Yucatán</option>
                            <option>Zacatecas</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Columna 2 */}
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">% DESCUENTO</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.porcentajeDescuento}</div>
                        ) : (
                          <PercentageInput 
                            value={formData.porcentajeDescuento}
                            onChange={(value) => handleChange('porcentajeDescuento', value)}
                            placeholder="0.00%"
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">MÍNIMO DE LIQUIDEZ</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.minimoLiquidez}</div>
                        ) : (
                          <input 
                            type="number" 
                            value={formData.minimoLiquidez}
                            onChange={(e) => handleChange('minimoLiquidez', e.target.value)}
                            min="0"
                            step="0.01"
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>
                    </div>

                    {/* Columna 3 */}
                    <div className="space-y-1.5">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">TIPO DE COBRANZA</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.tipoCobranza}</div>
                        ) : (
                          <select 
                            value={formData.tipoCobranza}
                            onChange={(e) => handleChange('tipoCobranza', e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="">Elige...</option>
                            <option>Normal</option>
                            <option>Acumulativa</option>
                          </select>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-0.5">CLAVE DEPENDENCIA</label>
                        {!camposEditables ? (
                          <div className="px-2 py-1 text-xs text-gray-700">{formData.claveDependencia}</div>
                        ) : (
                          <input 
                            type="text" 
                            value={formData.claveDependencia}
                            onChange={(e) => handleChange('claveDependencia', e.target.value)}
                            maxLength={20}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Placeholder para otros tabs */}
          {activeTab !== 'default' && (
            <div className="p-4">
              {/* NOTA: Estos componentes tienen persistencia automática vinculada al clienteId */}
              {activeTab === 'expedientes' && (
                <ExpedientesElectronicos isView={isView} clienteId={clienteId} mode={mode} diagData={subtabsDiag?.expedientes || null} diagKeys={subtabsDiag?.rawKeys || []} diagUuid={subtabsDiag?.dbUuid || ''} clienteData={clienteRawData} />
              )}

              {activeTab === 'sic' && (
                <SIC isView={isView} clienteId={clienteId} mode={mode} diagData={subtabsDiag?.sic || null} diagKeys={subtabsDiag?.rawKeys || []} diagUuid={subtabsDiag?.dbUuid || ''} />
              )}

              {activeTab === 'listas-negras' && (
                <div>
                  {/* ═══ PANEL DIAGNÓSTICO: Fuente de datos de Listas Negras ═══ */}
                  {(mode === 'editar' || mode === 'ver') && subtabsDiag && (
                    <div className="mb-3 border border-amber-300 rounded bg-amber-50">
                      <button
                        onClick={() => setShowSubtabDiag(prev => ({ ...prev, listasNegras: !prev.listasNegras }))}
                        className="w-full px-3 py-2 flex items-center justify-between text-xs text-amber-800 hover:bg-amber-100 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                          <span className="font-semibold">DIAGNÓSTICO DB — LISTAS NEGRAS</span>
                          <span className="font-normal">
                            — Fuente: {subtabsDiag.listasNegras.rawNode ? `encontrado (${Array.isArray(subtabsDiag.listasNegras.rawNode) ? subtabsDiag.listasNegras.rawNode.length : 1} crudo)` : 'NO encontrado'} 
                            {` | Mostradas: ${subtabsDiag.listasNegras.loaded}`}
                            {` | UUID: ${subtabsDiag.dbUuid}`}
                          </span>
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showSubtabDiag.listasNegras ? 'rotate-180' : ''}`}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </button>
                      {showSubtabDiag.listasNegras && (
                        <div className="px-3 pb-3 space-y-2 border-t border-amber-200">
                          <div className="mt-2">
                            <span className="text-xs font-semibold text-amber-900">Keys en _rawData ({subtabsDiag.rawKeys.length}):</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {subtabsDiag.rawKeys.map(k => (
                                <span key={k} className={`px-1.5 py-0.5 text-[10px] rounded ${['listasNegras','listas_negras','listaNegra','blacklists','pld'].includes(k) ? 'bg-green-200 text-green-800 font-bold' : 'bg-gray-200 text-gray-700'}`}>
                                  {k}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-amber-900">JSON crudo de "listasNegras" de J_CLIENTES.data:</span>
                            <pre className="mt-1 p-2 bg-white border border-amber-200 rounded text-[10px] text-gray-800 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                              {subtabsDiag.listasNegras.rawNode 
                                ? JSON.stringify(subtabsDiag.listasNegras.rawNode, null, 2) 
                                : '(null — no existe nodo "listasNegras" en el JSONB)'}
                            </pre>
                          </div>
                          {!subtabsDiag.listasNegras.rawNode && (
                            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                              <strong>No se encontró nodo de listas negras en _rawData.</strong> Keys que SÍ existen: {subtabsDiag.rawKeys.join(', ') || '(ninguna)'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Título con estilo institucional y botones */}
                  <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">LISTAS NEGRAS</span>
                    {!isView && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleNuevaListaNegra}
                          className="px-4 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium"
                        >
                          Nuevo
                        </button>
                        <button 
                          onClick={handleEliminarListasNegrasSeleccionadas}
                          disabled={!algunaListaNegraSeleccionada}
                          className="px-4 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tabla de listas negras — estilo SIC (idéntico a Prospecto) */}
                  <div className="border border-gray-300">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#E7E6E6] border-b border-gray-400">
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha y hora del registro</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Usuario que registró</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Nombre lista *</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tipo lista *</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus *</th>
                          <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 w-20">Consultar</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {Array.isArray(listasNegras) && listasNegras.map((lista) => (
                          <tr key={lista.id} className="border-b border-gray-300">
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{lista.fechaHora || lista.fecha || ''}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{lista.usuario || ''}</td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <input 
                                type="text" 
                                value={lista.nombreLista}
                                readOnly
                                className="w-full px-1 py-0.5 text-xs border-0 bg-transparent"
                              />
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <input 
                                type="text" 
                                value={lista.tipoLista}
                                readOnly
                                className="w-full px-1 py-0.5 text-xs border-0 bg-transparent"
                              />
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <input 
                                type="text" 
                                value={lista.estatus}
                                readOnly
                                className="w-full px-1 py-0.5 text-xs border-0 bg-transparent"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button 
                                onClick={() => handleConsultarListaNegra(lista.id)}
                                className="inline-flex items-center justify-center p-1 hover:bg-gray-100 rounded"
                                title="Consultar — resultado NEGATIVO"
                                disabled={isView}
                              >
                                <Zap className={`w-4 h-4 ${isView ? 'text-gray-400' : 'text-yellow-600'}`} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!Array.isArray(listasNegras) || listasNegras.length === 0) && (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-500 italic">
                              No hay registros en listas negras.{!isView && ' Haga clic en "Nuevo" para agregar un registro.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Modal de Nueva Lista Negra (idéntico a Prospecto) */}
                  {showListaNegraModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                      <div className="bg-white rounded shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header institucional */}
                        <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
                          <h3 className="text-base font-medium text-white">
                            Nueva Lista Negra
                          </h3>
                          <button
                            onClick={() => setShowListaNegraModal(false)}
                            className="text-white hover:text-gray-200"
                          >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                            </svg>
                          </button>
                        </div>

                        {/* Contenido del formulario */}
                        <div className="flex-1 overflow-y-auto p-6">
                          {/* Título de sección con estilo institucional */}
                          <div className="bg-gray-100 border-l-4 border-primary-theme px-4 py-2 mb-4">
                            <h4 className="text-sm font-semibold text-gray-800">INFORMACIÓN DE LISTA NEGRA</h4>
                          </div>

                          {/* Formulario */}
                          <div className="space-y-4">
                            {/* NOMBRE LISTA y TIPO LISTA en la misma fila */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Nombre Lista <span className="text-red-600">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={listaNegraForm.nombreLista}
                                  onChange={(e) => setListaNegraForm(prev => ({ ...prev, nombreLista: e.target.value }))}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                                  placeholder="Seleccionar..."
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Tipo Lista <span className="text-red-600">*</span>
                                </label>
                                <select
                                  value={listaNegraForm.tipoLista}
                                  onChange={(e) => setListaNegraForm(prev => ({ ...prev, tipoLista: e.target.value }))}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                                >
                                  <option value="">Seleccionar...</option>
                                  <option>Externa</option>
                                  <option>Interna</option>
                                </select>
                              </div>
                            </div>

                            {/* ESTATUS — fila completa (idéntico a Prospectos) */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Estatus <span className="text-red-600">*</span>
                              </label>
                              <select
                                value={listaNegraForm.estatus}
                                onChange={(e) => setListaNegraForm(prev => ({ ...prev, estatus: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                              >
                                <option value="">Seleccionar...</option>
                                <option value="NEGATIVO">NEGATIVO (No aparece en listas)</option>
                                <option value="POSITIVO">POSITIVO (Aparece en listas)</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="En revision">En revision</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Footer con botones */}
                        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
                          <button
                            onClick={() => setShowListaNegraModal(false)}
                            className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleGuardarListaNegra}
                            className="px-5 py-2 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme font-medium"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'personas-relacionadas' && (
                <PersonasRelacionadas
                  clienteId={clienteId}
                  clienteUuid={(cliente as any)?.dbUuid || undefined}
                  isView={isView}
                  mode={mode}
                  personasRelacionadas={personasRelacionadas}
                  setPersonasRelacionadas={setPersonasRelacionadas}
                  parClienteId={(cliente as any)?.par_cliente_id || null}
                  onChange={(updatedItems) => {
                    console.log('[AltaCliente] Personas Relacionadas cambiaron - persistiendo...');
                    setPersonasRelacionadas(updatedItems);
                  }}
                />
              )}

              {/* ========================================
                  SUBTAB: DIRECCIONES
                  Persistencia: Automática via useClienteSubtabList
                  Storage Key: cliente_{clienteId}_direcciones_list
                  ======================================== */}
              {activeTab === 'direcciones' && (
                <div>
                  {/* ═══ PANEL DIAGNÓSTICO: Fuente de datos de Direcciones ═══ */}
                  {(mode === 'editar' || mode === 'ver') && (
                    <div className="mb-3 border border-amber-300 rounded bg-amber-50">
                      <button
                        onClick={() => setShowDireccionesDiag(!showDireccionesDiag)}
                        className="w-full px-3 py-2 flex items-center justify-between text-xs text-amber-800 hover:bg-amber-100 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                          <span className="font-semibold">DIAGNÓSTICO DB — DIRECCIONES</span>
                          <span className="font-normal">
                            — Fuente: {direccionesDiag?.source || 'Cargando...'}
                            {direccionesDiag && ` | Mostradas: ${direccionesDiag.count}`}
                            {direccionesDiag && ` | UUID: ${direccionesDiag.dbUuid}`}
                          </span>
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showDireccionesDiag ? 'rotate-180' : ''}`}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </button>
                      {showDireccionesDiag && direccionesDiag && (
                        <div className="px-3 pb-3 space-y-3 border-t border-amber-200">
                          {/* Keys en rawData */}
                          <div className="mt-2">
                            <span className="text-xs font-semibold text-amber-900">Keys en _rawData ({direccionesDiag.rawKeys.length}):</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {direccionesDiag.rawKeys.map(k => (
                                <span key={k} className={`px-1.5 py-0.5 text-[10px] rounded ${['direcciones','addresses','address'].includes(k) ? 'bg-green-200 text-green-800 font-bold' : 'bg-gray-200 text-gray-700'}`}>
                                  {k}
                                </span>
                              ))}
                            </div>
                          </div>
                          {/* JSON crudo */}
                          <div>
                            <span className="text-xs font-semibold text-amber-900">JSON crudo de "direcciones" en J_CLIENTES.data:</span>
                            <pre className="mt-1 p-2 bg-white border border-amber-200 rounded text-[10px] text-gray-800 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                              {direccionesDiag.rawDirecciones
                                ? JSON.stringify(direccionesDiag.rawDirecciones, null, 2)
                                : '(null — no existe el nodo "direcciones" en el JSONB)'}
                            </pre>
                          </div>
                          {/* Análisis campo a campo del primer registro crudo */}
                          {direccionesDiag.rawDirecciones && (() => {
                            const first = Array.isArray(direccionesDiag.rawDirecciones)
                              ? direccionesDiag.rawDirecciones[0]
                              : direccionesDiag.rawDirecciones;
                            if (!first) return null;
                            const rawKeys = Object.keys(first);
                            const fieldMap: Record<string, string[]> = {
                              'calle': ['calle','street','direccionCalle'],
                              'numeroExterior': ['numeroExterior','numExterior','noExterior','numero_exterior','num_ext','ext','numExt','no_ext','noExt','n_ext'],
                              'numeroInterior': ['numeroInterior','numInterior','noInterior','numero_interior','num_int','numInt','no_int','noInt','n_int'],
                              'piso': ['piso','floor','nivel','noPiso','no_piso','num_piso'],
                              'colonia': ['colonia','colony','direccionColonia'],
                              'municipio': ['municipio','delegacion','alcaldia','municipality','delegacionMunicipio','mun','deleg'],
                              'codigoPostal': ['codigoPostal','cp','direccionCodigoPostal','codigo_postal','postal','zip','c_p'],
                              'ciudad': ['ciudad','city','direccionCiudad'],
                              'estado': ['estado','state','direccionEstado'],
                              'pais': ['pais','country','direccionPais'],
                              'tipoDireccion': ['tipoDireccion','tipo','tipo_direccion','addressType','tipoDir'],
                              'atencion': ['atencion','attention','att','a_nombre'],
                              'destinatario': ['destinatario','receptor','recipient','destinatary'],
                              'tipoCalle': ['tipoCalle','tipo_calle','streetType','tipoVia','tipo_via'],
                              'principal': ['principal','isPrincipal','is_principal','default','esPrincipal'],
                            };
                            const foundCount = Object.entries(fieldMap).filter(([, aliases]) => aliases.some(a => rawKeys.includes(a))).length;
                            const missingCount = Object.keys(fieldMap).length - foundCount;
                            return (
                              <div>
                                <span className="text-xs font-semibold text-amber-900">Análisis de mapeo (1er registro):</span>
                                <div className="mt-1 mb-1 flex flex-wrap gap-3 text-[10px]">
                                  <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded font-semibold">{foundCount} campos encontrados en DB</span>
                                  <span className={`px-2 py-0.5 rounded font-semibold ${missingCount > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{missingCount} campos ausentes en DB</span>
                                  {missingCount > 0 && (
                                    <span className="text-amber-600 italic">Los campos ausentes nunca fueron guardados en este prospecto — no es error de mapeo. Re-editar y guardar la dirección los persistirá.</span>
                                  )}
                                </div>
                                <div className="mt-1 border border-amber-200 rounded overflow-hidden">
                                  <table className="w-full text-[10px]">
                                    <thead>
                                      <tr className="bg-amber-100">
                                        <th className="px-2 py-1 text-left text-amber-900 font-semibold">Campo esperado</th>
                                        <th className="px-2 py-1 text-left text-amber-900 font-semibold">Aliases buscados</th>
                                        <th className="px-2 py-1 text-left text-amber-900 font-semibold">Key en DB</th>
                                        <th className="px-2 py-1 text-left text-amber-900 font-semibold">Valor</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-amber-100">
                                      {Object.entries(fieldMap).map(([campo, aliases]) => {
                                        const foundKey = aliases.find(a => rawKeys.includes(a));
                                        const val = foundKey ? String(first[foundKey] ?? '') : '';
                                        const missing = !foundKey;
                                        const partialMatch = !foundKey
                                          ? rawKeys.find(k => aliases.some(a => k.toLowerCase().includes(a.toLowerCase().substring(0, 4))))
                                          : null;
                                        return (
                                          <tr key={campo} className={missing ? 'bg-red-50' : ''}>
                                            <td className={`px-2 py-1 font-mono font-semibold ${missing ? 'text-red-700' : 'text-green-700'}`}>{campo}</td>
                                            <td className="px-2 py-1 text-gray-500 font-mono text-[9px]">{aliases.slice(0,5).join(', ')}{aliases.length > 5 ? '…' : ''}</td>
                                            <td className="px-2 py-1">
                                              {foundKey
                                                ? <span className="bg-green-100 text-green-800 px-1 rounded font-mono font-bold">{foundKey} ✓</span>
                                                : partialMatch
                                                  ? <span className="bg-yellow-100 text-yellow-800 px-1 rounded font-mono">¿{partialMatch}?</span>
                                                  : <span className="text-red-500 italic">No encontrado ✗</span>
                                              }
                                            </td>
                                            <td className="px-2 py-1 font-mono text-gray-700 max-w-[100px] truncate" title={val}>
                                              {val || <span className="text-gray-400 italic">vacío</span>}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="mt-1.5 text-[10px] text-amber-700">
                                  <span className="font-semibold">Keys reales en tu DB:</span>{' '}
                                  {rawKeys.map(k => (
                                    <span key={k} className="inline-block bg-gray-100 text-gray-700 px-1 rounded mr-0.5 mb-0.5 font-mono">{k}</span>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                          {!direccionesDiag.rawDirecciones && (
                            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                              <strong>⚠ No se encontró el nodo "direcciones" en _rawData.</strong> Verifica en Supabase → tabla J_CLIENTES → columna "data" que UUID <code className="bg-red-100 px-1 rounded">{direccionesDiag.dbUuid}</code> tenga key "direcciones". Keys existentes: {direccionesDiag.rawKeys.join(', ') || '(ninguna)'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Encabezado institucional con título y botones */}
                  <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">DIRECCIONES</span>
                    {!isView && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingDireccionId(null);
                            setNuevaDireccionForm({
                              pais: 'México', atencion: '', destinatario: '',
                              tipoCalle: '', calle: '', numeroExterior: '',
                              piso: '', numeroInterior: '', codigoPostal: '',
                              colonia: '', municipio: '', ciudad: '', estado: '',
                              tipoDireccion: 'Particular',
                            });
                            setShowDireccionModal(true);
                          }}
                          className="px-4 py-1.5 btn-secondary-theme rounded text-xs font-medium"
                        >
                          Nuevo
                        </button>
                        <button 
                          onClick={handleEliminarDireccionesSeleccionadas}
                          disabled={!algunaDireccionSeleccionada}
                          className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed font-medium"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tabla de direcciones registradas */}
                  <div className="border border-gray-300 overflow-x-auto">
                    <table className="w-full text-xs" style={{ minWidth: '1100px' }}>
                      <thead>
                        <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
                          {!isView && (
                            <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                              <input
                                type="checkbox"
                                checked={todasDireccionesSeleccionadas}
                                onChange={(e) => handleSeleccionarTodasDirecciones(e.target.checked)}
                                className="w-4 h-4"
                                title="Seleccionar todas"
                              />
                            </th>
                          )}
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tipo Dir.</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Calle</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Núm. Ext.</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Núm. Int.</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Piso</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Colonia</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Municipio</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">C.P.</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Ciudad</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estado</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">País</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Principal</th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-gray-800">Editar</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {Array.isArray(direcciones) && direcciones.map((direccion) => {
                          // Detectar si la dirección tiene datos incompletos (guardada antes del formulario completo)
                          const camposOpcionales = [direccion.tipoDireccion, direccion.numeroExterior, direccion.ciudad, direccion.estado, direccion.municipio, direccion.pais];
                          const camposVacios = camposOpcionales.filter(v => !v).length;
                          const esIncompleta = camposVacios >= 4; // 4+ de 6 campos vacíos = probablemente datos legacy
                          return (
                          <tr key={direccion.id} className={`border-b border-gray-300 ${esIncompleta ? 'bg-yellow-50' : ''}`} title={esIncompleta ? 'Dirección con datos incompletos — edite para completar todos los campos' : ''}>
                            {!isView && (
                              <td className="px-3 py-2 text-center border-r border-gray-300" style={{ paddingTop: '10px' }}>
                                <input
                                  type="checkbox"
                                  checked={direccion.seleccionada}
                                  onChange={() => handleToggleSeleccionDireccion(direccion.id)}
                                  className="w-4 h-4"
                                  title="Seleccionar"
                                />
                              </td>
                            )}
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.tipoDireccion || ''}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.calle}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.numeroExterior}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.numeroInterior}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.piso}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.colonia}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.municipio || ''}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.codigoPostal}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.ciudad || ''}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.estado || ''}</td>
                            <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{direccion.pais || ''}</td>
                            <td className="px-3 py-2 text-center border-r border-gray-300">
                              <input 
                                type="checkbox" 
                                checked={direccion.principal} 
                                readOnly 
                                className="cursor-pointer" 
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button 
                                onClick={() => handleEditarDireccion(direccion)}
                                className="text-primary-theme hover:opacity-80"
                                title="Editar dirección"
                              >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                  <path d="M0 11v3h3l8-8-3-3-8 8zm12-7l-2 2-3-3 2-2c.4-.4 1-.4 1.4 0l1.6 1.6c.4.4.4 1 0 1.4z"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                        {(!Array.isArray(direcciones) || direcciones.length === 0) && (
                          <tr>
                            <td colSpan={!isView ? 15 : 14} className="px-4 py-6 text-center text-xs text-gray-500 italic">
                              No hay direcciones registradas.{!isView && ' Haga clic en "Nuevo" para agregar una dirección.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'kyc' && (
                <KYCTab
                  formData={formData}
                  updateFormData={updateFormData}
                  isView={isView}
                  mode={mode}
                  clienteId={clienteId}
                />
              )}

              {activeTab === 'garantias' && (
                <Garantias 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                />
              )}

              {activeTab === 'perfil-transaccional' && (
                <PerfilTransaccional 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                />
              )}

              {activeTab === 'cotizaciones' && (
                <Cotizaciones 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                  onNavigateToCotizacion={onNavigateToCotizacion}
                />
              )}

              {activeTab === 'cuentas-ahorro' && (
                <CuentaAhorro 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                  onCuentaEjeChange={(saldo, numeroCuenta) => {
                    updateFormFields({
                      saldoCuentaEje: saldo,
                      cuentaEje: numeroCuenta
                    });
                  }}
                />
              )}

              {activeTab === 'solicitudes' && (
                <SolicitudesCredito 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                />
              )}

              {activeTab === 'creditos' && (
                <Creditos 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                />
              )}

              {activeTab === 'inversiones' && (
                <Inversiones 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                />
              )}

              {activeTab === 'movimientos' && (
                <Movimientos 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                />
              )}

              {activeTab === 'avisos' && (
                <Avisos 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                />
              )}

              {activeTab === 'auditoria' && (
                <Auditoria 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                />
              )}

              {activeTab === 'archivos-adjuntos' && (
                <ArchivosAdjuntos 
                  onBack={() => setActiveTab('default')}
                  mode={mode}
                  clienteId={clienteId}
                />
              )}

              {activeTab === 'convenios' && (
                <Convenios clienteId={clienteId} mode={mode} isView={isView} />
              )}

              {activeTab === 'cobranza-normal' && (
                <CobranzaNormal clienteId={clienteId} mode={mode} isView={isView} />
              )}

              {activeTab === 'cobranza-acumulativa' && (
                <CobranzaAcumulativa clienteId={clienteId} mode={mode} isView={isView} />
              )}

              {activeTab === 'estado-cuenta' && (
                <EstadoCuenta clienteId={clienteId} mode={mode} isView={isView} />
              )}

              {activeTab === 'calendario' && (
                <Calendario clienteId={clienteId} mode={mode} isView={isView} />
              )}

              {activeTab === 'tarjeta-debito' && (
                <TarjetaDebito
                  clienteId={clienteId}
                  mode={mode}
                  isView={isView}
                  titularNombre={formData.nombre ? `${formData.nombre} ${formData.apellidoPaterno || ''} ${formData.apellidoMaterno || ''}`.trim() : ''}
                  numeroCuenta=""
                  isActive={formData.activacionTarjetaDebito || false}
                  onActivate={(active, numeroTarjeta) => {
                    handleChange('activacionTarjetaDebito', active);
                    handleChange('numeroTarjetaDebito', numeroTarjeta);
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Nueva Dirección */}
      {showDireccionModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl w-[900px] max-h-[90vh] overflow-auto">
            {/* Header institucional */}
            <div className="bg-primary-theme px-6 py-3 flex items-center justify-between">
              <h2 className="text-white text-sm font-semibold">
                {editingDireccionId !== null ? 'Editar Dirección' : 'Nueva Dirección'}
              </h2>
              <button 
                onClick={() => { setShowDireccionModal(false); setEditingDireccionId(null); }}
                className="text-white hover:text-gray-200 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {/* Sección con borde azul */}
              <div className="border-l-4 border-primary-theme bg-gray-100 px-4 py-2 mb-4">
                <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DE DIRECCIÓN</h3>
              </div>

              {/* Formulario de captura de dirección */}
              <div className="space-y-3">
                {/* Fila 1 */}
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">
                      País <span className="text-red-600">*</span>
                    </label>
                    <select 
                      value={nuevaDireccionForm.pais}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, pais: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="México">México</option>
                      <option value="Estados Unidos">Estados Unidos</option>
                      <option value="Canadá">Canadá</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">Atención</label>
                    <input 
                      type="text" 
                      placeholder="Atención..."
                      value={nuevaDireccionForm.atencion}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, atencion: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                </div>

                {/* Fila 2 */}
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">
                      Destinatario <span className="text-red-600">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Destinatario..."
                      value={nuevaDireccionForm.destinatario}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, destinatario: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">Tipo de Calle</label>
                    <select 
                      value={nuevaDireccionForm.tipoCalle}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, tipoCalle: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Av">Av</option>
                      <option value="Calle">Calle</option>
                      <option value="Callejón">Callejón</option>
                      <option value="Privada">Privada</option>
                      <option value="Boulevard">Boulevard</option>
                    </select>
                  </div>
                </div>

                {/* Fila 3 */}
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">
                      Calle <span className="text-red-600">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Calle..."
                      value={nuevaDireccionForm.calle}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, calle: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">
                      Número Exterior <span className="text-red-600">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Número exterior..."
                      value={nuevaDireccionForm.numeroExterior}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, numeroExterior: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                </div>

                {/* Fila 4 */}
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">Piso</label>
                    <input 
                      type="text" 
                      placeholder="Piso..."
                      value={nuevaDireccionForm.piso}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, piso: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">Número Interior</label>
                    <input 
                      type="text" 
                      placeholder="Número interior..."
                      value={nuevaDireccionForm.numeroInterior}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, numeroInterior: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                </div>

                {/* Fila 5 */}
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">
                      Código Postal <span className="text-red-600">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Código postal..."
                      value={nuevaDireccionForm.codigoPostal}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, codigoPostal: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">
                      Colonia <span className="text-red-600">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Colonia..."
                      value={nuevaDireccionForm.colonia}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, colonia: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                </div>

                {/* Fila 6 */}
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">Municipio/Alcaldía</label>
                    <input 
                      type="text" 
                      placeholder="Municipio/Alcaldía..."
                      value={nuevaDireccionForm.municipio}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, municipio: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">Ciudad</label>
                    <input 
                      type="text" 
                      placeholder="Ciudad..."
                      value={nuevaDireccionForm.ciudad}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, ciudad: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                </div>

                {/* Fila 7 */}
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">Estado</label>
                    <input 
                      type="text" 
                      placeholder="Estado..."
                      value={nuevaDireccionForm.estado}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, estado: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 mb-1 block">Tipo de Dirección</label>
                    <select 
                      value={nuevaDireccionForm.tipoDireccion}
                      onChange={(e) => setNuevaDireccionForm({...nuevaDireccionForm, tipoDireccion: e.target.value})}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                    >
                      <option value="Particular">Particular</option>
                      <option value="Comercial">Comercial</option>
                      <option value="Fiscal">Fiscal</option>
                      <option value="Laboral">Laboral</option>
                      <option value="Otra">Otra</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  onClick={() => {
                    setShowDireccionModal(false);
                    setEditingDireccionId(null);
                    setNuevaDireccionForm({
                      pais: 'México', atencion: '', destinatario: '',
                      tipoCalle: '', calle: '', numeroExterior: '',
                      piso: '', numeroInterior: '', codigoPostal: '',
                      colonia: '', municipio: '', ciudad: '', estado: '',
                      tipoDireccion: 'Particular',
                    });
                  }}
                  className="px-6 py-2 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (editingDireccionId !== null) {
                      // Modo edición: actualizar dirección existente
                      handleActualizarDireccion(editingDireccionId, nuevaDireccionForm);
                    } else {
                      // Modo nuevo: agregar dirección
                      handleAgregarDireccion(nuevaDireccionForm);
                    }
                    // Limpiar el formulario
                    setNuevaDireccionForm({
                      pais: 'México',
                      atencion: '',
                      destinatario: '',
                      tipoCalle: '',
                      calle: '',
                      numeroExterior: '',
                      piso: '',
                      numeroInterior: '',
                      codigoPostal: '',
                      colonia: '',
                      municipio: '',
                      ciudad: '',
                      estado: '',
                      tipoDireccion: 'Particular',
                    });
                    setEditingDireccionId(null);
                  }}
                  className="px-6 py-2 btn-primary-theme rounded text-xs hover:bg-primary-hover-theme"
                >
                  {editingDireccionId !== null ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}