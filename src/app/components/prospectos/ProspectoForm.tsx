import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Prospecto } from './ProspectosList';
import { FileText, Zap, Download, Copy, FileCode } from 'lucide-react';
import { ExpedientesElectronicos, uploadPendingExpedientes } from './ExpedientesElectronicos';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { syncToJClientes } from '../../hooks/useSyncJClientes';
import { useActivacionProspecto, formatNoCuenta } from '../../hooks/useCoreActivacionProspecto';
import type { ProspectoDataCompleto } from '../../hooks/useCoreActivacionProspecto';
import { CampoInstitucionGobierno } from '../ui/CatalogoInstitucionGobierno';
import type { InstitucionGobiernoSeleccion } from '../ui/CatalogoInstitucionGobierno';
import { useCatalogoClasificaciones } from '../../hooks/useCatalogoClasificaciones';
import { currentUser } from '../../data/mockData';

// ═══════════════════════════════════════════════════════════════════
// Utilidad FRONTEND: Limpiar dataJson ANTES de enviarlo al servidor
// ── REGLA INSTITUCIONAL ──
// Solo enviar campos con valor REAL. Campos vacíos ("", null, undefined)
// NO se envían → el servidor los ignora → los valores en BD se CONSERVAN.
// Esto protege campos como contrasena, telefono, curp, etc. que existen
// en la BD pero NO en el formulario del CORE.
// ═══════════════════════════════════════════════════════════════════
function stripEmptyFieldsForSync(obj: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Arrays siempre se envían (subtabs: direcciones, sic, etc.)
    if (Array.isArray(value)) {
      cleaned[key] = value;
      continue;
    }
    // Sub-objetos: limpiar recursivamente (ej: nodo "default")
    if (value !== null && value !== undefined && typeof value === 'object') {
      const sub = stripEmptyFieldsForSync(value);
      if (Object.keys(sub).length > 0) {
        cleaned[key] = sub;
      }
      continue;
    }
    // Saltar valores vacíos → el servidor conserva el valor existente en BD
    if (value === null || value === undefined || value === '') {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

interface ProspectoFormProps {
  mode?: 'create' | 'edit' | 'view';
  prospecto?: Prospecto;
  onSave: (prospectoData: any) => void;
  onBack: () => void;
  /** ID consecutivo legible: "PROS-001", "PROS-002", etc. */
  nextId?: string;
}

interface ConsultaSIC {
  id: number;
  fechaHora: string;
  usuario: string;
  tipoConsulta: string;
  estatus: string;
  xmlResultado: string;
}

export function ProspectoForm({ mode = 'create', prospecto, onSave, onBack, nextId }: ProspectoFormProps) {
  const isView = mode === 'view';
  const isCreate = mode === 'create';

  // ── Hook CORE para activacion de Prospecto ──
  const { activar: activarProspecto, loading: activandoProspecto, resultado: resultadoActivacion, clearResultado } = useActivacionProspecto();
  const [showActivacionModal, setShowActivacionModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Catálogo de clasificaciones de cliente desde DB ──
  const { clasificaciones: catalogoClasificaciones } = useCatalogoClasificaciones();
  
  // ═══════════════════════════════════════════════════════════════
  // PERSISTENCIA — Claves por prospecto para evitar contaminación
  // En modo crear usamos 'nuevo', en edit/view usamos el dbUuid o id
  // ═══════════════════════════════════════════════════════════════
  const storageId = isCreate ? 'nuevo' : (prospecto?.dbUuid || prospecto?.id || 'unknown');

  // ── Limpiar claves legacy (globales sin sufijo) al montar ──
  // Esto elimina restos de la versión anterior que usaba claves compartidas
  useEffect(() => {
    const legacyKeys = [
      'prospecto_formData', 'prospecto_direcciones', 'prospecto_cotizaciones',
      'prospecto_cotizacionSeleccionada', 'prospecto_tablaAmortizacion',
      'prospecto_consultas', 'prospecto_listasNegras', 'prospecto_expedientes',
      'prospecto_activeTab',
    ];
    legacyKeys.forEach(k => sessionStorage.removeItem(k));
  }, []); // solo al montar

  const loadPersistedData = (baseKey: string, defaultValue: any) => {
    try {
      const saved = sessionStorage.getItem(`${baseKey}_${storageId}`);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error('Error loading persisted data:', error);
      return defaultValue;
    }
  };

  const [activeTab, setActiveTab] = useState(() => loadPersistedData('prospecto_activeTab', 'general'));
  const [showDireccionModal, setShowDireccionModal] = useState(false);
  const [showCotizacionModal, setShowCotizacionModal] = useState(false);
  
  // Cargar direcciones SOLO desde el prospecto prop (BD) o vacío
  const [direcciones, setDirecciones] = useState<any[]>(() => {
    if (!isCreate && prospecto?.direcciones) {
      return prospecto.direcciones;
    }
    if (isCreate) return loadPersistedData('prospecto_direcciones', []);
    return [];
  });
  
  const [selectedDireccion, setSelectedDireccion] = useState<any>(null);
  const [direccionFormMode, setDireccionFormMode] = useState<'create' | 'edit'>('create');
  const [selectedDireccionesIds, setSelectedDireccionesIds] = useState<number[]>([]);

  // Estado SIC — SOLO desde prospecto prop (BD) o vacío; sin datos de prueba
  const [consultas, setConsultas] = useState<ConsultaSIC[]>(() => {
    if (!isCreate && prospecto?.consultas) {
      return prospecto.consultas;
    }
    if (isCreate) return loadPersistedData('prospecto_consultas', []);
    return [];
  });

  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [nuevoTipoConsulta, setNuevoTipoConsulta] = useState('');
  const [nuevoEstatus, setNuevoEstatus] = useState('');
  const [showPdfSicModal, setShowPdfSicModal] = useState(false);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState<any>(null);
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [xmlSeleccionado, setXmlSeleccionado] = useState('');
  const [copiedXml, setCopiedXml] = useState(false);

  // Estado para Listas Negras — SOLO desde prospecto prop (BD) o vacío; sin datos de prueba
  const [listasNegras, setListasNegras] = useState(() => {
    if (!isCreate && prospecto?.listasNegras) {
      return prospecto.listasNegras;
    }
    if (isCreate) return loadPersistedData('prospecto_listasNegras', []);
    return [];
  });
  const [showListaNegraModal, setShowListaNegraModal] = useState(false);
  const [nuevoNombreLista, setNuevoNombreLista] = useState('');
  const [nuevoTipoLista, setNuevoTipoLista] = useState('');
  const [nuevoEstatusListaNegra, setNuevoEstatusListaNegra] = useState('');

  // Estado para Expedientes Electrónicos — SOLO desde prospecto (nodo hijo de J_CLIENTES) o vacío
  const [expedientesElectronicos, setExpedientesElectronicos] = useState<any[]>(() => {
    if (!isCreate && prospecto?.expedientesElectronicos) {
      return prospecto.expedientesElectronicos;
    }
    if (isCreate) return loadPersistedData('prospecto_expedientes', []);
    return [];
  });

  // Estado para Cotizaciones — SOLO desde prospecto prop (BD) o vacío
  const [cotizaciones, setCotizaciones] = useState<any[]>(() => {
    if (!isCreate && prospecto?.cotizaciones) {
      return prospecto.cotizaciones;
    }
    if (isCreate) return loadPersistedData('prospecto_cotizaciones', []);
    return [];
  });
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState<any>(() => {
    if (isCreate) return loadPersistedData('prospecto_cotizacionSeleccionada', null);
    return null;
  });
  const [tablaAmortizacion, setTablaAmortizacion] = useState<any[]>(() => {
    if (!isCreate && prospecto?.tablaAmortizacion) {
      return prospecto.tablaAmortizacion;
    }
    if (isCreate) return loadPersistedData('prospecto_tablaAmortizacion', []);
    return [];
  });
  const [nuevaCotizacion, setNuevaCotizacion] = useState({
    producto: '',
    montoSolicitado: '',
    plazoMeses: '',
    tasaInteres: '',
    tipoAmortizacion: '',
    fechaPrimerPago: ''
  });

  // Estado del formulario con persistencia
  const [formData, setFormData] = useState(() => {
    if (isCreate) {
      // Modo crear: Intentar cargar datos persistidos primero
      const persistedData = loadPersistedData('prospecto_formData', null);
      if (persistedData) {
        return persistedData;
      }
      // Si no hay datos persistidos, crear nuevo con ID autogenerado (formato PROS-XXX)
      return {
        idProspecto: nextId || '',
        tipo: '',
        nombre: '',
        apellidoPaterno: '',
        apellidoMaterno: '',
        denominacionRazonSocial: '',
        telefono: '',
        fechaNacimiento: '',
        entidadFederativa: 'CDMX',
        sexo: 'Masculino',
        curp: '',
        rfc: '',
        correoElectronico: '',
        cotizacion: '',
        estatusSIC: 'Pendiente',
        estatusListaNegra: 'Pendiente',
        estatusProspecto: 'Contacto',
        estatus: 'Pendiente',
        direccion: '',
        institucionGobierno: '',
        institucionGobiernoId: '',
        clasificacionCliente: 'Persona',
        // Persona Moral
        fechaConstitucion: '',
        giroEmpresa: '',
        representanteLegalNombre: '',
        representanteLegalCurp: '',
        representanteLegalRfc: '',
        representanteLegalIdentificacion: '',
      };
    }

    // Modo editar/ver: cargar datos del prospecto desde J_CLIENTES
    // Usar campos individuales del JSONB (nombrePila, apellidoPaterno, etc.)
    // en vez de dividir el nombre completo por espacios
    const fallbackNombres = prospecto?.nombre?.split(' ') || [];
    return {
      idProspecto: prospecto?.idProspecto || `PROS-${String(prospecto?.id || 0).padStart(3, '0')}`,
      tipo: prospecto?.subtipo || prospecto?.tipo || '',
      nombre: prospecto?.nombrePila || fallbackNombres[0] || '',
      apellidoPaterno: prospecto?.apellidoPaterno || fallbackNombres[1] || '',
      apellidoMaterno: prospecto?.apellidoMaterno || fallbackNombres[2] || '',
      denominacionRazonSocial: prospecto?.denominacionRazonSocial || '',
      telefono: prospecto?.telefono || '',
      fechaNacimiento: prospecto?.fechaNacimiento || prospecto?.fechaOriginacion || '',
      entidadFederativa: prospecto?.entidadFederativa || prospecto?.sucursal || 'CDMX',
      sexo: prospecto?.sexo || 'Masculino',
      curp: prospecto?.curp || '',
      rfc: prospecto?.rfc || '',
      correoElectronico: prospecto?.correoElectronico || '',
      cotizacion: prospecto?.cotizacion || '',
      estatusSIC: prospecto?.estatusSIC || 'Pendiente',
      estatusListaNegra: prospecto?.estatusListaNegra || 'Pendiente',
      estatusProspecto: prospecto?.categoria || 'Contacto',
      estatus: prospecto?.estatus || 'Pendiente',
      direccion: prospecto?.direccion || '',
      institucionGobierno: (prospecto as any)?.institucionGobierno || '',
      institucionGobiernoId: (prospecto as any)?.institucionGobiernoId || '',
      clasificacionCliente: (prospecto as any)?.clasificacionCliente || 'Persona',
      // Persona Moral
      fechaConstitucion: (prospecto as any)?.fechaConstitucion || '',
      giroEmpresa: (prospecto as any)?.giroEmpresa || '',
      representanteLegalNombre: (prospecto as any)?.representanteLegalNombre || '',
      representanteLegalCurp: (prospecto as any)?.representanteLegalCurp || '',
      representanteLegalRfc: (prospecto as any)?.representanteLegalRfc || '',
      representanteLegalIdentificacion: (prospecto as any)?.representanteLegalIdentificacion || '',
    };
  });

  // Actualizar formData cuando cambia el prospecto en modo edit/view
  // Solo se ejecuta una vez al montar el componente
  useEffect(() => {
    if (prospecto && !isCreate) {
      const fallbackNombres = prospecto.nombre?.split(' ') || [];
      setFormData(prev => {
        // Solo actualizar si el ID es diferente (evita sobrescribir ediciones del usuario)
        const expectedId = prospecto.idProspecto || `PROS-${String(prospecto.id).padStart(3, '0')}`;
        if (prev.idProspecto !== expectedId) {
          return {
            idProspecto: expectedId,
            tipo: prospecto?.subtipo || prospecto?.tipo || '',
            nombre: prospecto?.nombrePila || fallbackNombres[0] || '',
            apellidoPaterno: prospecto?.apellidoPaterno || fallbackNombres[1] || '',
            apellidoMaterno: prospecto?.apellidoMaterno || fallbackNombres[2] || '',
            denominacionRazonSocial: prospecto.denominacionRazonSocial || '',
            telefono: prospecto.telefono || '',
            fechaNacimiento: prospecto?.fechaNacimiento || prospecto.fechaOriginacion || '',
            entidadFederativa: prospecto?.entidadFederativa || prospecto.sucursal || 'CDMX',
            sexo: prospecto?.sexo || 'Masculino',
            curp: prospecto.curp || '',
            rfc: prospecto.rfc || '',
            correoElectronico: prospecto.correoElectronico || '',
            cotizacion: prospecto.cotizacion || '',
            estatusSIC: prospecto.estatusSIC || 'Pendiente',
            estatusListaNegra: prospecto.estatusListaNegra || 'Pendiente',
            estatusProspecto: prospecto.categoria || 'Contacto',
            estatus: prospecto?.estatus || 'Pendiente',
            direccion: prospecto.direccion || '',
            institucionGobierno: (prospecto as any)?.institucionGobierno || '',
            institucionGobiernoId: (prospecto as any)?.institucionGobiernoId || '',
            clasificacionCliente: (prospecto as any)?.clasificacionCliente || 'Persona',
            fechaConstitucion: (prospecto as any)?.fechaConstitucion || '',
            giroEmpresa: (prospecto as any)?.giroEmpresa || '',
            representanteLegalNombre: (prospecto as any)?.representanteLegalNombre || '',
            representanteLegalCurp: (prospecto as any)?.representanteLegalCurp || '',
            representanteLegalRfc: (prospecto as any)?.representanteLegalRfc || '',
            representanteLegalIdentificacion: (prospecto as any)?.representanteLegalIdentificacion || '',
          };
        }
        return prev;
      });
    }
  }, [prospecto, isCreate]);

  // ── Sincronizar arrays de subtabs cuando prospecto cambia (async fetch) ──
  // Los useState initializers solo se ejecutan una vez al montar. Si el prospecto
  // se carga asincrónicamente DESPUÉS del mount, los arrays quedan vacíos.
  // Este useEffect los actualiza cuando llega el prospecto con datos reales.
  useEffect(() => {
    if (!prospecto || isCreate) return;

    // Direcciones
    if (Array.isArray(prospecto.direcciones) && prospecto.direcciones.length > 0) {
      setDirecciones(prev => {
        if (prev.length === 0 || (prev.length > 0 && prev[0]?.id !== prospecto.direcciones![0]?.id)) {
          return prospecto.direcciones!;
        }
        return prev;
      });
    }

    // Consultas SIC
    if (Array.isArray(prospecto.consultas) && prospecto.consultas.length > 0) {
      setConsultas(prev => {
        if (prev.length === 0 || (prev.length > 0 && prev[0]?.id !== prospecto.consultas![0]?.id)) {
          return prospecto.consultas!;
        }
        return prev;
      });
    }

    // Listas Negras
    if (Array.isArray(prospecto.listasNegras) && prospecto.listasNegras.length > 0) {
      setListasNegras(prev => {
        if (prev.length === 0 || (prev.length > 0 && prev[0]?.id !== prospecto.listasNegras![0]?.id)) {
          return prospecto.listasNegras!;
        }
        return prev;
      });
    }

    // Expedientes Electrónicos
    if (Array.isArray(prospecto.expedientesElectronicos) && prospecto.expedientesElectronicos.length > 0) {
      setExpedientesElectronicos(prev => {
        if (prev.length === 0 || (prev.length > 0 && prev[0]?.id !== prospecto.expedientesElectronicos![0]?.id)) {
          return prospecto.expedientesElectronicos!;
        }
        return prev;
      });
    }

    // Cotizaciones
    if (Array.isArray(prospecto.cotizaciones) && prospecto.cotizaciones.length > 0) {
      setCotizaciones(prev => {
        if (prev.length === 0 || (prev.length > 0 && prev[0]?.id !== prospecto.cotizaciones![0]?.id)) {
          return prospecto.cotizaciones!;
        }
        return prev;
      });
    }

    // Tabla de amortización
    if (Array.isArray(prospecto.tablaAmortizacion) && prospecto.tablaAmortizacion.length > 0) {
      setTablaAmortizacion(prev => {
        if (prev.length === 0) return prospecto.tablaAmortizacion!;
        return prev;
      });
    }
  }, [prospecto, isCreate]);

  // ===== PERSISTENCIA DE DATOS EN SESSIONSTORAGE (claves por prospecto) =====
  // Guardar formData
  useEffect(() => {
    sessionStorage.setItem(`prospecto_formData_${storageId}`, JSON.stringify(formData));
  }, [formData, storageId]);

  // Guardar direcciones
  useEffect(() => {
    sessionStorage.setItem(`prospecto_direcciones_${storageId}`, JSON.stringify(direcciones));
  }, [direcciones, storageId]);

  // Guardar consultas SIC
  useEffect(() => {
    sessionStorage.setItem(`prospecto_consultas_${storageId}`, JSON.stringify(consultas));
  }, [consultas, storageId]);

  // Guardar listas negras
  useEffect(() => {
    sessionStorage.setItem(`prospecto_listasNegras_${storageId}`, JSON.stringify(listasNegras));
  }, [listasNegras, storageId]);

  // Guardar expedientes electrónicos
  useEffect(() => {
    // Serializar sin campos internos (_pendingFile no es serializable)
    const serializable = expedientesElectronicos.map((e: any) => {
      const { _pendingFile, ...rest } = e;
      return rest;
    });
    sessionStorage.setItem(`prospecto_expedientes_${storageId}`, JSON.stringify(serializable));
  }, [expedientesElectronicos, storageId]);

  // Guardar cotizaciones
  useEffect(() => {
    sessionStorage.setItem(`prospecto_cotizaciones_${storageId}`, JSON.stringify(cotizaciones));
  }, [cotizaciones, storageId]);

  // Guardar cotización seleccionada
  useEffect(() => {
    sessionStorage.setItem(`prospecto_cotizacionSeleccionada_${storageId}`, JSON.stringify(cotizacionSeleccionada));
  }, [cotizacionSeleccionada, storageId]);

  // Guardar tabla de amortización
  useEffect(() => {
    sessionStorage.setItem(`prospecto_tablaAmortizacion_${storageId}`, JSON.stringify(tablaAmortizacion));
  }, [tablaAmortizacion, storageId]);

  // Guardar tab activo
  useEffect(() => {
    sessionStorage.setItem(`prospecto_activeTab_${storageId}`, JSON.stringify(activeTab));
  }, [activeTab, storageId]);
  // ===== FIN PERSISTENCIA =====

  const handleChange = (field: string, value: string) => {
    if (!isView) {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  // Helper para limpiar todas las claves de sessionStorage de este prospecto
  const clearProspectoStorage = () => {
    const keys = [
      'prospecto_formData', 'prospecto_direcciones', 'prospecto_cotizaciones',
      'prospecto_cotizacionSeleccionada', 'prospecto_tablaAmortizacion',
      'prospecto_consultas', 'prospecto_listasNegras', 'prospecto_expedientes',
      'prospecto_activeTab',
    ];
    keys.forEach(k => sessionStorage.removeItem(`${k}_${storageId}`));
    // También limpiar claves legacy (globales sin sufijo) para migración limpia
    keys.forEach(k => sessionStorage.removeItem(k));
  };

  const handleBack = () => {
    // Limpiar datos persistidos al salir del formulario
    clearProspectoStorage();
    onBack();
  };

  const handleSubmit = async () => {
    if (saving) return; // Prevenir doble clic
    if (!isView) {
      const isMoralVal = formData.tipo === 'Persona Moral';
      const isFisicaVal = !isMoralVal;
      if (isFisicaVal) {
        if (!formData.nombre.trim()) { toast.error('Nombre es obligatorio'); return; }
        if (!formData.apellidoPaterno.trim()) { toast.error('Apellido Paterno es obligatorio'); return; }
        if (!formData.fechaNacimiento.trim()) { toast.error('Fecha de Nacimiento es obligatoria'); return; }
        if (!formData.curp.trim()) { toast.error('CURP es obligatorio'); return; }
        if (!formData.rfc.trim()) { toast.error('RFC es obligatorio'); return; }
      } else {
        if (!(formData as any).denominacionRazonSocial?.trim()) { toast.error('Razón Social es obligatoria'); return; }
        if (!formData.rfc.trim()) { toast.error('RFC es obligatorio'); return; }
        if (!(formData as any).representanteLegalNombre?.trim()) { toast.error('Nombre del Representante Legal es obligatorio'); return; }
      }
      setSaving(true);
      try {
      // Limpiar datos persistidos después de guardar exitosamente
      clearProspectoStorage();
      
      // ═══════════════════════════════════════════════════════════════
      // REGLA INSTITUCIONAL (cliente-prospecto-db-rules.md):
      //
      // §1: data.nombre = nombre de pila (campo "Nombre" del formulario)
      //     Nombre completo en listado = data.nombre + ' ' + data.apellidoPaterno + ' ' + data.apellidoMaterno
      //
      // §5: Construir JSON PARCIAL solo con campos modificados.
      //     Hacer MERGE: UPDATE SET data = data || '<JSON_PARCIAL>'::jsonb
      //     NO se reconstruye el JSON completo desde cero.
      //     NO existe nodo "default" — todo va plano en data.
      // ═══════════════════════════════════════════════════════════════
      
      // Nombre completo para payload local (UI)
      const nombreCompleto = `${formData.nombre} ${formData.apellidoPaterno} ${formData.apellidoMaterno}`.trim();

      const prospectoPayload = {
        ...formData,
        nombre: nombreCompleto,
        sucursal: formData.entidadFederativa,
        categoria: formData.estatusProspecto,
        // Incluir datos relacionales
        direcciones: direcciones,
        cotizaciones: cotizaciones,
        consultas: consultas,
        listasNegras: listasNegras,
        tablaAmortizacion: tablaAmortizacion,
      };

      // ═══════════════════════════════════════════════════════════════
      // Sincronizar con EFINANCIANET_DB.J_CLIENTES (Supabase)
      // id (uuid PK) lo genera la BD con gen_random_uuid().
      //
      // Reglas de negocio — Botón Guardar:
      //   type    = "Prospecto" en Alta; en Edit se conserva
      //   subtipo = capturado del formulario (Persona Física / Moral / PFAE)
      //   estatus = capturado del formulario
      //   data    = JSON PLANO (SIN nodo default): campos generales + subtabs
      // ═══════════════════════════════════════════════════════════════
      {
        // ── JSON parcial: campos del formulario + SubTabs (SIN nodo default) ──
        const dataJson: Record<string, any> = {
          idProspecto: formData.idProspecto,
          tipo: formData.tipo,
          nombre: formData.nombre,
          apellidoPaterno: formData.apellidoPaterno,
          apellidoMaterno: formData.apellidoMaterno,
          denominacionRazonSocial: formData.denominacionRazonSocial,
          telefono: formData.telefono,
          fechaNacimiento: formData.fechaNacimiento,
          entidadFederativa: formData.entidadFederativa,
          sucursal: formData.entidadFederativa,
          sexo: formData.sexo,
          curp: formData.curp,
          rfc: formData.rfc,
          correoElectronico: formData.correoElectronico,
          direccion: formData.direccion,
          cotizacion: formData.cotizacion,
          estatusSIC: formData.estatusSIC,
          estatusListaNegra: formData.estatusListaNegra,
          estatusCliente: formData.estatusProspecto,
          estatusProspecto: formData.estatusProspecto,
          estatus: formData.estatus,
          institucionGobierno: formData.institucionGobierno,
          institucionGobiernoId: formData.institucionGobiernoId,
          clasificacionCliente: formData.clasificacionCliente,
          fechaOriginacion: isCreate
            ? new Date().toISOString().split('T')[0]
            : (prospecto?.fechaOriginacion || new Date().toISOString().split('T')[0]),
          // ── SubTabs (nodos hijos) — SIN nodo "default" ──
          direcciones: direcciones,
          cotizaciones: cotizaciones,
          // Serializar expedientes: eliminar campos internos (_pendingFile, _bucket, _fromData)
          expedientesElectronicos: expedientesElectronicos
            .filter((e: any) => !e._fromData) // excluir virtuales de JSONB
            .map((e: any) => {
              const { _pendingFile, _bucket, _fromData, ...rest } = e;
              return rest;
            }),
          sic: consultas,
          listasNegras: listasNegras,
        };

        // ── REGLA INSTITUCIONAL (§5): Solo enviar campos con valor REAL ──
        // Campos vacíos NO se envían → el servidor los ignora → BD conserva valores existentes.
        const cleanedDataJson = stripEmptyFieldsForSync(dataJson);
        console.log(`[ProspectoForm] dataJson keys: ${Object.keys(dataJson).length} → cleanedDataJson keys: ${Object.keys(cleanedDataJson).length}`);

        const existingDbUuid = prospecto?.dbUuid || null;

        // type: en Alta siempre "Prospecto"; en Edit se conserva el type actual
        const typeValue = isCreate ? 'Prospecto' : (prospecto?.categoria || formData.estatusProspecto || 'Prospecto');

        // ── Detectar archivos pendientes de subir a Storage ──
        const hasPendingFiles = expedientesElectronicos.some(
          (e: any) => e._pendingFile instanceof File,
        );

        if (isCreate && hasPendingFiles) {
          // ── Flujo Create con archivos pendientes ──
          // Paso 1: INSERT para obtener UUID
          const newUuid = await syncToJClientes({
            type: typeValue,
            tipoFormulario: formData.tipo,
            estatus: formData.estatus,
            data: cleanedDataJson,
            label: 'Prospecto',
            existingId: null,
          });

          if (newUuid) {
            // Paso 2: Subir archivos pendientes con el UUID obtenido
            const finalExpedientes = await uploadPendingExpedientes(
              expedientesElectronicos,
              newUuid,
            );

            // Paso 3: PUT para actualizar el JSONB con las URLs de Storage
            cleanedDataJson.expedientesElectronicos = finalExpedientes;
            await syncToJClientes({
              type: typeValue,
              tipoFormulario: formData.tipo,
              estatus: formData.estatus,
              data: cleanedDataJson,
              label: 'Prospecto (expedientes)',
              existingId: newUuid,
            });
          }
        } else {
          // ── Flujo normal: INSERT o UPDATE sin archivos pendientes ──
          // AWAIT obligatorio: sin await, onSave() dispara refetch ANTES de que el
          // PUT termine, y el GET trae la versión ANTERIOR (sin merge),
          // causando que parezca que se pierden campos como contrasena.
          await syncToJClientes({
            type: typeValue,
            tipoFormulario: formData.tipo,
            estatus: formData.estatus,
            data: cleanedDataJson,
            label: 'Prospecto',
            existingId: existingDbUuid,
          });
        }
      }

      onSave(prospectoPayload);
      } catch (err) {
        console.error('[ProspectoForm] Error inesperado al guardar:', err);
        toast.error('Error inesperado al guardar prospecto', { description: String(err) });
      } finally {
        setSaving(false);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // CORE — Activacion de Prospecto
  // Ejecuta todas las validaciones institucionales y persiste
  // ═══════════════════════════════════════════════════════════════
  const handleActivarProspecto = async () => {
    const dbUuid = prospecto?.dbUuid;
    if (!dbUuid) {
      toast.error('No se puede activar', {
        description: 'El prospecto no tiene un ID valido en J_CLIENTES. Guarde primero.',
        duration: 5000,
      });
      return;
    }

    // ── Helper: toma el valor de formData; si esta vacio, usa fallbacks del prospecto ──
    const f = (formField: string, ...fallbacks: (string | undefined)[]) => {
      const val = (formData as any)[formField];
      if (val && typeof val === 'string' && val.trim() !== '') return val;
      for (const fb of fallbacks) {
        if (fb && typeof fb === 'string' && fb.trim() !== '') return fb;
      }
      return val || '';
    };

    // Construir campos con fallbacks robustos desde prospecto original (DB)
    const nombre     = f('nombre', prospecto?.nombrePila, prospecto?.nombre?.split(' ')[0]);
    const apPat      = f('apellidoPaterno', prospecto?.apellidoPaterno, prospecto?.nombre?.split(' ')[1]);
    const apMat      = f('apellidoMaterno', prospecto?.apellidoMaterno, prospecto?.nombre?.split(' ')[2]);
    const nombreCompleto = prospecto?.nombre || `${nombre} ${apPat} ${apMat}`.trim();

    const tipo       = f('tipo', prospecto?.tipo);
    const telefono   = f('telefono', prospecto?.telefono);
    const fechaNac   = f('fechaNacimiento', prospecto?.fechaNacimiento, prospecto?.fechaOriginacion);
    const entFed     = f('entidadFederativa', prospecto?.entidadFederativa, prospecto?.sucursal);
    const sexo       = f('sexo', prospecto?.sexo);
    const curp       = f('curp', prospecto?.curp);
    const rfc        = f('rfc', prospecto?.rfc);
    const correo     = f('correoElectronico', prospecto?.correoElectronico);
    const denRazSoc  = f('denominacionRazonSocial', prospecto?.denominacionRazonSocial);
    const estSIC     = f('estatusSIC', prospecto?.estatusSIC);
    const estLN      = f('estatusListaNegra', prospecto?.estatusListaNegra);
    const estPros    = f('estatusProspecto', prospecto?.categoria);
    const estatus    = f('estatus', prospecto?.estatus);
    const idPros     = f('idProspecto', prospecto?.idProspecto);
    const direccion  = f('direccion', prospecto?.direccion);

    // ═══════════════════════════════════════════════════════════════
    // REGLA INSTITUCIONAL (§1): JSON PLANO — SIN nodo "default"
    // data.nombre = nombre de pila (campo "Nombre" del formulario)
    // ═══════════════════════════════════════════════════════════════
    const datosCompletos: ProspectoDataCompleto = {
      idProspecto: idPros,
      tipo,
      nombre,
      apellidoPaterno: apPat,
      apellidoMaterno: apMat,
      denominacionRazonSocial: denRazSoc,
      telefono,
      fechaNacimiento: fechaNac,
      entidadFederativa: entFed,
      sucursal: entFed,
      sexo,
      curp,
      rfc,
      correoElectronico: correo,
      direccion,
      estatusSIC: estSIC,
      estatusListaNegra: estLN,
      estatusCliente: estPros,
      estatusProspecto: estPros,
      estatus,
      fechaOriginacion: prospecto?.fechaOriginacion || new Date().toISOString().split('T')[0],
      direcciones: direcciones.length > 0 ? direcciones : (prospecto?.direcciones || []),
      expedientesElectronicos: expedientesElectronicos.length > 0 ? expedientesElectronicos : (prospecto?.expedientesElectronicos || []),
      sic: consultas.length > 0 ? consultas : (prospecto?.consultas || []),
      listasNegras: listasNegras.length > 0 ? listasNegras : (prospecto?.listasNegras || []),
    };

    console.log('[handleActivarProspecto] Payload construido:', {
      uuid: dbUuid,
      nombre: datosCompletos.nombre,
      estatusSIC: datosCompletos.estatusSIC,
      estatusListaNegra: datosCompletos.estatusListaNegra,
      direcciones: datosCompletos.direcciones?.length,
      expedientes: datosCompletos.expedientesElectronicos?.length,
      sic: datosCompletos.sic?.length,
      listasNegras: datosCompletos.listasNegras?.length,
    });

    const response = await activarProspecto({
      idProspecto: dbUuid,
      datosProspecto: datosCompletos,
    });

    // Mostrar modal con resultado
    setShowActivacionModal(true);
    
    // Si la activación fue exitosa, notificar al padre para refetch
    if (response.estatusOperacion === 'OK') {
      console.log('[handleActivarProspecto] Activación EXITOSA — notificando al padre para refetch en 2s...');
      setTimeout(() => {
        onSave({
          ...prospecto,
          estatusCliente: 'Cliente',
          estatus: 'Activo',
          categoria: 'Cliente',
        });
      }, 2000);
    }
  };

  const tabs = [
    { id: 'general', label: 'Default' },
    { id: 'direcciones', label: 'Direcciones' },
    { id: 'expedientes', label: 'Expedientes Electrónicos' },
    { id: 'sic', label: 'SIC' },
    { id: 'listas-negras', label: 'Listas Negras' },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  // Funciones para manejar direcciones
  const handleNuevaDireccion = () => {
    setDireccionFormMode('create');
    setSelectedDireccion(null);
    setShowDireccionModal(true);
  };

  const handleEditDireccion = (direccion: any) => {
    setDireccionFormMode('edit');
    setSelectedDireccion(direccion);
    setShowDireccionModal(true);
  };

  const handleEliminarDireccion = () => {
    if (selectedDireccionesIds.length === 0) {
      alert('Por favor seleccione al menos una dirección para eliminar');
      return;
    }
    if (confirm(`¿Está seguro de eliminar ${selectedDireccionesIds.length} dirección(es)?`)) {
      setDirecciones(prev => prev.filter(dir => !selectedDireccionesIds.includes(dir.id)));
      setSelectedDireccionesIds([]);
    }
  };

  const handleToggleDireccionSelection = (direccionId: number) => {
    setSelectedDireccionesIds(prev => 
      prev.includes(direccionId) 
        ? prev.filter(id => id !== direccionId)
        : [...prev, direccionId]
    );
  };

  const handleToggleAllDirecciones = () => {
    if (selectedDireccionesIds.length === direcciones.length) {
      setSelectedDireccionesIds([]);
    } else {
      setSelectedDireccionesIds(direcciones.map(dir => dir.id));
    }
  };

  const handleTogglePrincipal = (direccionId: number) => {
    setDirecciones(prev => 
      prev.map(dir => ({
        ...dir,
        principal: dir.id === direccionId
      }))
    );
  };

  const handleSaveDireccion = (direccionData: any) => {
    if (direccionFormMode === 'create') {
      const newDireccion = { 
        ...direccionData, 
        id: Date.now(), // ID único basado en timestamp
        principal: direcciones.length === 0 
      };
      setDirecciones(prev => [...prev, newDireccion]);
    } else {
      setDirecciones(prev => 
        prev.map(dir => 
          dir.id === selectedDireccion?.id ? { ...direccionData, id: dir.id, principal: dir.principal } : dir
        )
      );
    }
    setShowDireccionModal(false);
  };

  // Funciones para manejar SIC
  const handleNuevo = () => {
    setShowNuevoModal(true);
    setNuevoTipoConsulta('');
    setNuevoEstatus('');
  };

  const handleGuardarNuevo = () => {
    if (!nuevoTipoConsulta || !nuevoEstatus) {
      alert('Tipo de Consulta y Estatus son obligatorios');
      return;
    }

    // Generar XML SIC automáticamente
    const xmlGenerado = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultaSIC>
  <Encabezado>
    <FechaConsulta>${new Date().toISOString()}</FechaConsulta>
    <TipoConsulta>${nuevoTipoConsulta}</TipoConsulta>
    <Folio>SIC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}</Folio>
    <Version>2.0</Version>
  </Encabezado>
  <DatosConsultado>
    <Nombre>${formData.nombres} ${formData.apellidoPaterno} ${formData.apellidoMaterno}</Nombre>
    <RFC>${formData.rfc || 'N/A'}</RFC>
    <CURP>${formData.curp || 'N/A'}</CURP>
    <FechaNacimiento>${formData.fechaNacimiento || 'N/A'}</FechaNacimiento>
  </DatosConsultado>
  <Resultado>
    <Score>720</Score>
    <Clasificacion>Bueno</Clasificacion>
    <CuentasActivas>5</CuentasActivas>
    <SaldoTotal>284500.00</SaldoTotal>
    <CreditosCerrados>8</CreditosCerrados>
    <Estatus>${nuevoEstatus}</Estatus>
  </Resultado>
  <Creditos>
    <Credito>
      <Acreedor>BANCO SANTANDER</Acreedor>
      <Tipo>Tarjeta de Crédito</Tipo>
      <Saldo>45200.00</Saldo>
      <Estatus>AL CORRIENTE</Estatus>
      <MOP>01</MOP>
    </Credito>
    <Credito>
      <Acreedor>BBVA BANCOMER</Acreedor>
      <Tipo>Crédito Automotriz</Tipo>
      <Saldo>185300.00</Saldo>
      <Estatus>AL CORRIENTE</Estatus>
      <MOP>01</MOP>
    </Credito>
    <Credito>
      <Acreedor>LIVERPOOL</Acreedor>
      <Tipo>Tarjeta de Crédito</Tipo>
      <Saldo>12500.00</Saldo>
      <Estatus>AL CORRIENTE</Estatus>
      <MOP>01</MOP>
    </Credito>
  </Creditos>
  <Consultas>
    <TotalConsultas>8</TotalConsultas>
    <UltimaConsulta>
      <Fecha>${new Date().toLocaleDateString('es-MX')}</Fecha>
      <Otorgante>BANCO AZTECA</Otorgante>
      <TipoCredito>Tarjeta de Crédito</TipoCredito>
    </UltimaConsulta>
  </Consultas>
</ConsultaSIC>`;

    const nuevaConsulta: ConsultaSIC = {
      id: Date.now(), // ID único basado en timestamp (evita colisiones)
      fechaHora: new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      usuario: currentUser.name || 'Usuario Actual',
      tipoConsulta: nuevoTipoConsulta,
      estatus: nuevoEstatus,
      xmlResultado: xmlGenerado
    };

    const allConsultas = [...consultas, nuevaConsulta];
    setConsultas(allConsultas);
    setShowNuevoModal(false);

    // ── Auto-sync: derivar estatusSIC del estatus de la ultima consulta ──
    // Regla CORE: si la consulta mas reciente es "NEGATIVO", el prospecto es apto para activacion.
    const ultimaConsulta = allConsultas[allConsultas.length - 1];
    const estatusSICDerivado = ultimaConsulta.estatus.toUpperCase().includes('NEGATIVO')
      ? 'NEGATIVO'
      : ultimaConsulta.estatus.toUpperCase().includes('POSITIVO')
        ? 'POSITIVO'
        : ultimaConsulta.estatus;
    setFormData(prev => ({ ...prev, estatusSIC: estatusSICDerivado }));
  };

  const handleConsultar = (id: number) => {
    const updatedConsultas = consultas.map(c => 
      c.id === id 
        ? { ...c, estatus: 'NEGATIVO', xmlResultado: '+7XMLRESULTADOSC...' } 
        : c
    );
    setConsultas(updatedConsultas);

    // Auto-sync: derivar estatusSIC de la consulta procesada
    const consultaProcesada = updatedConsultas.find(c => c.id === id);
    if (consultaProcesada) {
      const estatusSICDerivado = consultaProcesada.estatus.toUpperCase().includes('NEGATIVO')
        ? 'NEGATIVO'
        : consultaProcesada.estatus.toUpperCase().includes('POSITIVO')
          ? 'POSITIVO'
          : consultaProcesada.estatus;
      setFormData(prev => ({ ...prev, estatusSIC: estatusSICDerivado }));
    }
  };

  const handleVerPdfSic = (consulta: any) => {
    // ── Validar campos obligatorios antes de generar el PDF ──
    const errores: string[] = [];
    const nombreCompleto = `${formData.nombre || ''} ${formData.apellidoPaterno || ''} ${formData.apellidoMaterno || ''}`.trim();
    if (!nombreCompleto) errores.push('Nombre completo del prospecto');
    if (!formData.rfc || formData.rfc.trim() === '') errores.push('RFC');
    if (!formData.curp || formData.curp.trim() === '') errores.push('CURP');
    if (!formData.fechaNacimiento || formData.fechaNacimiento.trim() === '') errores.push('Fecha de nacimiento');
    const idProspecto = formData.idProspecto || prospecto?.idProspecto || '';
    if (!idProspecto) errores.push('Número de solicitud (ID Prospecto)');

    if (errores.length > 0) {
      toast.error('Datos incompletos para generar el reporte', {
        description: `Los siguientes campos obligatorios están vacíos: ${errores.join(', ')}. Complete los datos del prospecto antes de generar el reporte SIC.`,
        duration: 8000,
      });
      return;
    }

    setConsultaSeleccionada(consulta);
    setShowPdfSicModal(true);
  };

  const handleVerXml = (xml: string) => {
    setXmlSeleccionado(xml);
    setShowXmlModal(true);
    setCopiedXml(false);
  };

  const handleCopyXml = () => {
    navigator.clipboard.writeText(xmlSeleccionado);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
  };

  const handleDownloadXml = () => {
    const blob = new Blob([xmlSeleccionado], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consulta-sic-${Date.now()}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Funciones para manejar Listas Negras
  const handleNuevoListaNegra = () => {
    setShowListaNegraModal(true);
    setNuevoNombreLista('');
    setNuevoTipoLista('');
    setNuevoEstatusListaNegra('');
  };

  const handleGuardarListaNegra = () => {
    if (!nuevoNombreLista || !nuevoTipoLista || !nuevoEstatusListaNegra) {
      alert('Nombre lista, Tipo lista y Estatus son obligatorios');
      return;
    }

    const nuevaListaNegra = {
      id: Date.now(), // ID único basado en timestamp (evita colisiones)
      fechaHora: new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      usuario: currentUser.name || 'Usuario Actual',
      nombreLista: nuevoNombreLista,
      tipoLista: nuevoTipoLista,
      estatus: nuevoEstatusListaNegra
    };

    const allListas = [...listasNegras, nuevaListaNegra];
    setListasNegras(allListas);
    setShowListaNegraModal(false);

    // ── Auto-sync: derivar estatusListaNegra del estatus del ultimo registro ──
    // Regla CORE: si el registro mas reciente es "NEGATIVO", el prospecto es apto.
    const ultimaLista = allListas[allListas.length - 1];
    const estatusLNDerivado = ultimaLista.estatus.toUpperCase().includes('NEGATIVO')
      ? 'NEGATIVO'
      : ultimaLista.estatus.toUpperCase().includes('POSITIVO')
        ? 'POSITIVO'
        : ultimaLista.estatus;
    setFormData(prev => ({ ...prev, estatusListaNegra: estatusLNDerivado }));
  };

  const handleCambiarEstatusListaNegra = (id: number, nuevoEstatus: string) => {
    const updatedListas = listasNegras.map(lista => 
      lista.id === id ? { ...lista, estatus: nuevoEstatus } : lista
    );
    setListasNegras(updatedListas);

    // Auto-sync: recalcular estatusListaNegra basado en el ultimo registro modificado
    const ultimaLista = updatedListas[updatedListas.length - 1];
    if (ultimaLista) {
      const estatusLNDerivado = ultimaLista.estatus.toUpperCase().includes('NEGATIVO')
        ? 'NEGATIVO'
        : ultimaLista.estatus.toUpperCase().includes('POSITIVO')
          ? 'POSITIVO'
          : ultimaLista.estatus;
      setFormData(prev => ({ ...prev, estatusListaNegra: estatusLNDerivado }));
    }
  };

  // Consultar Lista Negra — simula consulta y asigna resultado NEGATIVO
  const handleConsultarListaNegra = (id: number) => {
    const updatedListas = listasNegras.map((lista: any) =>
      lista.id === id ? { ...lista, estatus: 'NEGATIVO' } : lista
    );
    setListasNegras(updatedListas);
    setFormData(prev => ({ ...prev, estatusListaNegra: 'NEGATIVO' }));
    toast.success(`Lista Negra #${id} consultada — Resultado: NEGATIVO`);
  };

  // Función para calcular tabla de amortización
  const calcularAmortizacion = (cotizacion: any) => {
    const monto = parseFloat(cotizacion.montoSolicitado.replace(/[^0-9.-]+/g, '')) || 0;
    const plazo = parseInt(cotizacion.plazoMeses) || 0;
    const tasaAnual = parseFloat(cotizacion.tasaInteres) || 0;
    const tasaMensual = tasaAnual / 12 / 100;
    
    if (monto <= 0 || plazo <= 0 || tasaAnual <= 0) return [];

    const tabla: any[] = [];
    let saldoCapital = monto;
    
    // Obtener fecha de primer pago o usar fecha actual
    let fechaBase = cotizacion.fechaPrimerPago ? new Date(cotizacion.fechaPrimerPago) : new Date();

    if (cotizacion.tipoAmortizacion === 'Francés') {
      // Sistema Francés: Pago constante
      const pagoMensual = monto * (tasaMensual * Math.pow(1 + tasaMensual, plazo)) / (Math.pow(1 + tasaMensual, plazo) - 1);
      
      for (let i = 1; i <= plazo; i++) {
        const interes = saldoCapital * tasaMensual;
        const amortizacion = pagoMensual - interes;
        saldoCapital = Math.max(0, saldoCapital - amortizacion);
        
        const fechaPago = new Date(fechaBase);
        fechaPago.setMonth(fechaPago.getMonth() + i - 1);
        
        tabla.push({
          noPago: i,
          saldoCapital: saldoCapital.toFixed(2),
          interes: interes.toFixed(2),
          amortizacion: amortizacion.toFixed(2),
          pagoMensual: pagoMensual.toFixed(2),
          fechaPago: fechaPago.toLocaleDateString('es-MX')
        });
      }
    } else if (cotizacion.tipoAmortizacion === 'Alemán') {
      // Sistema Alemán: Amortización constante
      const amortizacionConstante = monto / plazo;
      
      for (let i = 1; i <= plazo; i++) {
        const interes = saldoCapital * tasaMensual;
        const pagoMensual = amortizacionConstante + interes;
        saldoCapital = Math.max(0, saldoCapital - amortizacionConstante);
        
        const fechaPago = new Date(fechaBase);
        fechaPago.setMonth(fechaPago.getMonth() + i - 1);
        
        tabla.push({
          noPago: i,
          saldoCapital: saldoCapital.toFixed(2),
          interes: interes.toFixed(2),
          amortizacion: amortizacionConstante.toFixed(2),
          pagoMensual: pagoMensual.toFixed(2),
          fechaPago: fechaPago.toLocaleDateString('es-MX')
        });
      }
    } else if (cotizacion.tipoAmortizacion === 'Americano') {
      // Sistema Americano: Solo intereses, capital al final
      for (let i = 1; i <= plazo; i++) {
        const interes = monto * tasaMensual;
        const amortizacion = i === plazo ? monto : 0;
        const pagoMensual = interes + amortizacion;
        const saldo = i === plazo ? 0 : monto;
        
        const fechaPago = new Date(fechaBase);
        fechaPago.setMonth(fechaPago.getMonth() + i - 1);
        
        tabla.push({
          noPago: i,
          saldoCapital: saldo.toFixed(2),
          interes: interes.toFixed(2),
          amortizacion: amortizacion.toFixed(2),
          pagoMensual: pagoMensual.toFixed(2),
          fechaPago: fechaPago.toLocaleDateString('es-MX')
        });
      }
    }
    
    return tabla;
  };

  // Función para seleccionar cotización
  const handleSeleccionarCotizacion = (cotizacion: any) => {
    setCotizacionSeleccionada(cotizacion);
    const tabla = calcularAmortizacion(cotizacion);
    setTablaAmortizacion(tabla);
    console.log('Cotización seleccionada:', cotizacion);
    console.log('Tabla de amortización calculada:', tabla);
  };

  // Funciones para manejar Cotizaciones
  const handleChangeCotizacion = (field: string, value: string) => {
    console.log(`Cambiando ${field} a:`, value);
    setNuevaCotizacion(prev => {
      const updated = { ...prev, [field]: value };
      console.log('Estado actualizado:', updated);
      return updated;
    });
  };

  const handleGuardarCotizacion = () => {
    console.log('Intentando guardar cotización:', nuevaCotizacion);
    
    // Validar campos requeridos
    if (!nuevaCotizacion.producto || !nuevaCotizacion.montoSolicitado || 
        !nuevaCotizacion.plazoMeses || !nuevaCotizacion.tasaInteres || 
        !nuevaCotizacion.tipoAmortizacion) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }

    const cotizacion = {
      id: Date.now(), // ID único basado en timestamp
      fechaHora: new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      usuario: currentUser.name || 'Usuario Actual',
      ...nuevaCotizacion
    };

    console.log('Cotización a guardar:', cotizacion);
    console.log('Cotizaciones actuales:', cotizaciones);
    
    const nuevasCotizaciones = [...cotizaciones, cotizacion];
    console.log('Nuevas cotizaciones:', nuevasCotizaciones);
    
    setCotizaciones(nuevasCotizaciones);
    
    // Limpiar formulario y cerrar modal
    setNuevaCotizacion({
      producto: '',
      montoSolicitado: '',
      plazoMeses: '',
      tasaInteres: '',
      tipoAmortizacion: '',
      fechaPrimerPago: ''
    });
    setShowCotizacionModal(false);
    
    console.log('Modal cerrado, cotizaciones guardadas');
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header Section con ícono y título */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">
              {isCreate ? 'Alta Prospecto' : isView ? 'Ver Prospecto' : 'Editar Prospecto'}
            </h2>
            <button className="p-1 ml-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="8" cy="8" r="6"/>
                <path d="M13 13l3 3"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {!isView && (
            <button 
              onClick={handleSubmit}
              disabled={saving}
              className={`px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium flex items-center gap-1.5 ${saving ? 'opacity-60 cursor-wait' : ''}`}
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                  </svg>
                  Guardando...
                </>
              ) : 'Guardar'}
            </button>
          )}
          {/* Boton CORE: Activar Prospecto — Solo en modo Edit con UUID existente */}
          {!isCreate && prospecto?.dbUuid && (
            <button
              onClick={handleActivarProspecto}
              disabled={activandoProspecto || saving}
              className="px-5 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {activandoProspecto ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                  </svg>
                  Activando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Activar Prospecto
                </>
              )}
            </button>
          )}
          <button 
            onClick={handleBack} 
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700"
          >
            {isView ? 'Volver' : 'Cancelar'}
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-4 py-4 bg-[#F5F5F5]">
        <div className="bg-white border border-gray-300 p-4">
          {/* Información Principal Section - SIEMPRE VISIBLE */}
          <div className="mb-4">
            <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
              Información Principal
            </div>
            {(() => {
              const isMoral = formData.tipo === 'Persona Moral';
              const isFisica = !isMoral;
              return (
            <div className="grid grid-cols-3 gap-x-4">
              {/* Columna 1 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-28 flex-shrink-0 text-gray-700">ID PROSPECTO <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    value={formData.idProspecto}
                    disabled
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-28 flex-shrink-0 text-gray-700">TIPO <span className="text-red-600">*</span></label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.tipo || '—'}</div>
                  ) : (
                    <div className="relative flex-1">
                      <select
                        value={formData.tipo}
                        onChange={(e) => handleChange('tipo', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white appearance-none pr-7"
                      >
                        <option value="">-- Seleccione --</option>
                        <option value="Persona Fisica">Persona Fisica</option>
                        <option value="Persona Moral">Persona Moral</option>
                        <option value="Persona Fisica con Actividad Empresarial">Persona Fisica con Actividad Empresarial</option>
                      </select>
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666"><path d="M5 7l-3-3h6z"/></svg>
                    </div>
                  )}
                </div>
                {/* Física: nombre y apellidos */}
                {isFisica && (<>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">NOMBRE <span className="text-red-600">*</span></label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.nombre}</div> : (
                      <input type="text" value={formData.nombre} onChange={(e) => handleChange('nombre', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">APELLIDO PATERNO <span className="text-red-600">*</span></label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.apellidoPaterno}</div> : (
                      <input type="text" value={formData.apellidoPaterno} onChange={(e) => handleChange('apellidoPaterno', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">APELLIDO MATERNO</label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.apellidoMaterno}</div> : (
                      <input type="text" value={formData.apellidoMaterno} onChange={(e) => handleChange('apellidoMaterno', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                    )}
                  </div>
                </>)}
                {/* Moral: razón social, fecha constitución, giro */}
                {isMoral && (<>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">RAZÓN SOCIAL <span className="text-red-600">*</span></label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.denominacionRazonSocial}</div> : (
                      <input type="text" value={formData.denominacionRazonSocial} onChange={(e) => handleChange('denominacionRazonSocial', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">FECHA CONSTITUCIÓN</label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{(formData as any).fechaConstitucion}</div> : (
                      <DatePicker value={(formData as any).fechaConstitucion} onChange={(date) => handleChange('fechaConstitucion' as any, date)} />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">GIRO EMPRESA</label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{(formData as any).giroEmpresa}</div> : (
                      <input type="text" value={(formData as any).giroEmpresa} onChange={(e) => handleChange('giroEmpresa' as any, e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                    )}
                  </div>
                </>)}
                <div className="flex items-center gap-2">
                  <label className="text-xs w-28 flex-shrink-0 text-gray-700">TELÉFONO <span className="text-red-600">*</span></label>
                  {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.telefono}</div> : (
                    <input type="text" value={formData.telefono} onChange={(e) => handleChange('telefono', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  )}
                </div>
                <CampoInstitucionGobierno
                  value={formData.institucionGobierno || ''}
                  onChange={(value, institucion) => {
                    handleChange('institucionGobierno', value);
                    handleChange('institucionGobiernoId', institucion ? institucion.id : '');
                  }}
                  disabled={isView}
                  variant="prospectos"
                />
              </div>

              {/* Columna 2 */}
              <div className="space-y-1">
                {/* Física: fecha nacimiento, entidad, sexo, curp */}
                {isFisica && (<>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">FECHA NACIMIENTO <span className="text-red-600">*</span></label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.fechaNacimiento}</div> : (
                      <DatePicker value={formData.fechaNacimiento} onChange={(date) => handleChange('fechaNacimiento', date)} />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">ENTIDAD FEDERATIVA <span className="text-red-600">*</span></label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.entidadFederativa}</div> : (
                      <select value={formData.entidadFederativa} onChange={(e) => handleChange('entidadFederativa', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                        <option>CDMX</option><option>Querétaro</option><option>Puebla</option><option>México</option><option>Toluca</option>
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">SEXO <span className="text-red-600">*</span></label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.sexo}</div> : (
                      <select value={formData.sexo} onChange={(e) => handleChange('sexo', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                        <option>Masculino</option><option>Femenino</option>
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">CURP <span className="text-red-600">*</span></label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.curp}</div> : (
                      <input type="text" value={formData.curp} onChange={(e) => handleChange('curp', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                    )}
                  </div>
                </>)}
                {/* Moral: rep. legal */}
                {isMoral && (<>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">REP. LEGAL <span className="text-red-600">*</span></label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{(formData as any).representanteLegalNombre}</div> : (
                      <input type="text" value={(formData as any).representanteLegalNombre} onChange={(e) => handleChange('representanteLegalNombre' as any, e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" placeholder="Nombre completo" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">CURP REP. LEGAL</label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{(formData as any).representanteLegalCurp}</div> : (
                      <input type="text" value={(formData as any).representanteLegalCurp} onChange={(e) => handleChange('representanteLegalCurp' as any, e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">RFC REP. LEGAL</label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{(formData as any).representanteLegalRfc}</div> : (
                      <input type="text" value={(formData as any).representanteLegalRfc} onChange={(e) => handleChange('representanteLegalRfc' as any, e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-28 flex-shrink-0 text-gray-700">ID REP. LEGAL</label>
                    {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{(formData as any).representanteLegalIdentificacion}</div> : (
                      <input type="text" value={(formData as any).representanteLegalIdentificacion} onChange={(e) => handleChange('representanteLegalIdentificacion' as any, e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" placeholder="No. de identificación" />
                    )}
                  </div>
                </>)}
                {/* Ambos tipos: RFC y correo */}
                <div className="flex items-center gap-2">
                  <label className="text-xs w-28 flex-shrink-0 text-gray-700">RFC <span className="text-red-600">*</span></label>
                  {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.rfc}</div> : (
                    <input type="text" value={formData.rfc} onChange={(e) => handleChange('rfc', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-28 flex-shrink-0 text-gray-700">CORREO ELECTRÓNICO <span className="text-red-600">*</span></label>
                  {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{formData.correoElectronico}</div> : (
                    <input type="email" value={formData.correoElectronico} onChange={(e) => handleChange('correoElectronico', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  )}
                </div>
              </div>

              {/* Columna 3 - 5 campos */}
              <div className="space-y-1">

                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS SIC</label>
                  <input 
                    type="text" 
                    value={formData.estatusSIC} 
                    disabled 
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS LISTA NEGRA</label>
                  <input 
                    type="text" 
                    value={formData.estatusListaNegra} 
                    disabled 
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS PROSPECTO</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.estatusProspecto}</div>
                  ) : (
                    <div className="relative flex-1">
                      <select
                        value={formData.estatusProspecto}
                        onChange={(e) => handleChange('estatusProspecto', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white appearance-none pr-7"
                      >
                        <option value="Contacto">Contacto</option>
                        <option value="Prospecto">Prospecto</option>
                        <option value="Cliente">Cliente</option>
                      </select>
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666">
                        <path d="M5 7l-3-3h6z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.estatus}</div>
                  ) : (
                    <div className="relative flex-1">
                      <select
                        value={formData.estatus}
                        onChange={(e) => handleChange('estatus', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white appearance-none pr-7"
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En proceso">En proceso</option>
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                      </select>
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666">
                        <path d="M5 7l-3-3h6z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <label className="text-xs w-32 flex-shrink-0 text-gray-700 pt-1">DIRECCIÓN</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-1 text-xs text-gray-700 h-20">{formData.direccion}</div>
                  ) : (
                    <textarea 
                      value={formData.direccion}
                      onChange={(e) => handleChange('direccion', e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded h-20 resize-none"
                    />
                  )}
                </div>
              </div>
            </div>
            );
            })()}
          </div>

          {/* Tabs Navigation */}
          <div className="bg-primary-theme text-white border-y border-gray-400 -mx-4 mb-4">
            <div className="px-4 flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`px-4 py-2.5 text-xs whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-secondary-theme text-white font-medium'
                      : 'text-white/90'
                  }`}
                  style={activeTab !== tab.id ? { transition: 'background-color 0.2s' } : {}}
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

          {/* CONTENIDO DE TABS - CAMBIA SEGÚN LA TAB ACTIVA */}
          
          {/* Tab General - DEFAULT */}
          {activeTab === 'general' && (
            <>
              {/* DEFAULT Section - Replica de Información Principal */}
              <div className="mb-4">
                <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
                  DEFAULT
                </div>
                {(() => {
                  const isMoral = formData.tipo === 'Persona Moral';
                  const isFisica = !isMoral;
                  return (
                <div className="grid grid-cols-3 gap-x-4">
                  {/* Columna 1 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-28 flex-shrink-0 text-gray-700">ID PROSPECTO <span className="text-red-600">*</span></label>
                      <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.idProspecto}</div>
                    </div>
                    {isFisica && (<>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">NOMBRE <span className="text-red-600">*</span></label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.nombre}</div> : (
                          <input type="text" value={formData.nombre} onChange={(e) => handleChange('nombre', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">APELLIDO PATERNO <span className="text-red-600">*</span></label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.apellidoPaterno}</div> : (
                          <input type="text" value={formData.apellidoPaterno} onChange={(e) => handleChange('apellidoPaterno', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">APELLIDO MATERNO</label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.apellidoMaterno}</div> : (
                          <input type="text" value={formData.apellidoMaterno} onChange={(e) => handleChange('apellidoMaterno', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                        )}
                      </div>
                    </>)}
                    {isMoral && (<>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">RAZÓN SOCIAL <span className="text-red-600">*</span></label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.denominacionRazonSocial}</div> : (
                          <input type="text" value={formData.denominacionRazonSocial} onChange={(e) => handleChange('denominacionRazonSocial', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">FECHA CONSTITUCIÓN</label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{(formData as any).fechaConstitucion}</div> : (
                          <DatePicker value={(formData as any).fechaConstitucion} onChange={(date) => handleChange('fechaConstitucion' as any, date)} />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">GIRO EMPRESA</label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{(formData as any).giroEmpresa}</div> : (
                          <input type="text" value={(formData as any).giroEmpresa} onChange={(e) => handleChange('giroEmpresa' as any, e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                        )}
                      </div>
                    </>)}
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-28 flex-shrink-0 text-gray-700">TELÉFONO <span className="text-red-600">*</span></label>
                      {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.telefono}</div> : (
                        <input type="text" value={formData.telefono} onChange={(e) => handleChange('telefono', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                      )}
                    </div>
                    <CampoInstitucionGobierno
                      value={formData.institucionGobierno || ''}
                      onChange={(value, institucion) => {
                        handleChange('institucionGobierno', value);
                        handleChange('institucionGobiernoId', institucion ? institucion.id : '');
                      }}
                      disabled={isView}
                      variant="prospectos"
                    />
                  </div>

                  {/* Columna 2 */}
                  <div className="space-y-1">
                    {isFisica && (<>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">FECHA NACIMIENTO <span className="text-red-600">*</span></label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.fechaNacimiento}</div> : (
                          <DatePicker value={formData.fechaNacimiento} onChange={(date) => handleChange('fechaNacimiento', date)} />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">ENTIDAD FEDERATIVA <span className="text-red-600">*</span></label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.entidadFederativa}</div> : (
                          <select value={formData.entidadFederativa} onChange={(e) => handleChange('entidadFederativa', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                            <option value="CDMX">CDMX</option><option value="Estado de México">Estado de México</option>
                            <option value="Jalisco">Jalisco</option><option value="Nuevo León">Nuevo León</option>
                            <option value="Puebla">Puebla</option><option value="Guanajuato">Guanajuato</option>
                            <option value="Veracruz">Veracruz</option><option value="Yucatán">Yucatán</option>
                          </select>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">SEXO <span className="text-red-600">*</span></label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.sexo}</div> : (
                          <select value={formData.sexo} onChange={(e) => handleChange('sexo', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                            <option value="Masculino">Masculino</option><option value="Femenino">Femenino</option>
                          </select>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">CURP <span className="text-red-600">*</span></label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.curp}</div> : (
                          <input type="text" value={formData.curp} onChange={(e) => handleChange('curp', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" maxLength={18} />
                        )}
                      </div>
                    </>)}
                    {isMoral && (<>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">REP. LEGAL <span className="text-red-600">*</span></label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{(formData as any).representanteLegalNombre}</div> : (
                          <input type="text" value={(formData as any).representanteLegalNombre} onChange={(e) => handleChange('representanteLegalNombre' as any, e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" placeholder="Nombre completo" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">CURP REP. LEGAL</label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{(formData as any).representanteLegalCurp}</div> : (
                          <input type="text" value={(formData as any).representanteLegalCurp} onChange={(e) => handleChange('representanteLegalCurp' as any, e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">RFC REP. LEGAL</label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{(formData as any).representanteLegalRfc}</div> : (
                          <input type="text" value={(formData as any).representanteLegalRfc} onChange={(e) => handleChange('representanteLegalRfc' as any, e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs w-28 flex-shrink-0 text-gray-700">ID REP. LEGAL</label>
                        {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{(formData as any).representanteLegalIdentificacion}</div> : (
                          <input type="text" value={(formData as any).representanteLegalIdentificacion} onChange={(e) => handleChange('representanteLegalIdentificacion' as any, e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" placeholder="No. de identificación" />
                        )}
                      </div>
                    </>)}
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-28 flex-shrink-0 text-gray-700">RFC <span className="text-red-600">*</span></label>
                      {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.rfc}</div> : (
                        <input type="text" value={formData.rfc} onChange={(e) => handleChange('rfc', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" maxLength={13} />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-28 flex-shrink-0 text-gray-700">CORREO ELECTRÓNICO <span className="text-red-600">*</span></label>
                      {isView ? <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.correoElectronico}</div> : (
                        <input type="email" value={formData.correoElectronico} onChange={(e) => handleChange('correoElectronico', e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                      )}
                    </div>
                  </div>

                  {/* Columna 3 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS SIC</label>
                      <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.estatusSIC}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS LISTA NEGRA</label>
                      <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.estatusListaNegra}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS PROSPECTO</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.estatusProspecto}</div>
                      ) : (
                        <div className="relative flex-1">
                          <select
                            value={formData.estatusProspecto}
                            onChange={(e) => handleChange('estatusProspecto', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white appearance-none pr-7"
                          >
                            <option value="Contacto">Contacto</option>
                            <option value="Prospecto">Prospecto</option>
                            <option value="Cliente">Cliente</option>
                          </select>
                          <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666">
                            <path d="M5 7l-3-3h6z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS</label>
                      {isView ? (
                        <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{formData.estatus}</div>
                      ) : (
                        <div className="relative flex-1">
                          <select
                            value={formData.estatus}
                            onChange={(e) => handleChange('estatus', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white appearance-none pr-7"
                          >
                            <option value="Pendiente">Pendiente</option>
                            <option value="En proceso">En proceso</option>
                            <option value="Activo">Activo</option>
                            <option value="Inactivo">Inactivo</option>
                          </select>
                          <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666">
                            <path d="M5 7l-3-3h6z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                );
                })()}
              </div>
            </>
          )}

          {/* Tab Direcciones - Tabla con botones Nuevo/Eliminar */}
          {activeTab === 'direcciones' && (
            <div>
              {/* Título y botones en la misma línea */}
              <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">DIRECCIONES</span>
                {!isView && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleNuevaDireccion}
                      className="px-4 py-1 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB]"
                    >
                      Nuevo
                    </button>
                    <button
                      onClick={handleEliminarDireccion}
                      className="px-4 py-1 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>

              {/* Tabla de direcciones */}
              <div className="border border-gray-300">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      {!isView && (
                        <th className="px-2 py-2 text-center font-medium text-gray-700 border-r border-gray-300 w-12">
                          <input
                            type="checkbox"
                            checked={direcciones.length > 0 && selectedDireccionesIds.length === direcciones.length}
                            onChange={handleToggleAllDirecciones}
                            className="w-4 h-4"
                          />
                        </th>
                      )}
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Calle</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">No. Exterior</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Piso</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">No. Interior</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Colonia</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Código Postal</th>
                      <th className="px-2 py-2 text-center font-medium text-gray-700 border-r border-gray-300 w-20">Principal</th>
                      {!isView && (
                        <th className="px-2 py-2 text-center font-medium text-gray-700 w-16">Editar</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {direcciones.length === 0 ? (
                      <tr>
                        <td colSpan={isView ? 8 : 9} className="px-2 py-8 text-center text-gray-400">
                          No hay direcciones registradas
                        </td>
                      </tr>
                    ) : (
                      direcciones.map((dir, index) => (
                        <tr key={dir.id || index} className="border-b border-gray-200 hover:bg-gray-50">
                          {!isView && (
                            <td className="px-2 py-2 text-center border-r border-gray-200">
                              <input
                                type="checkbox"
                                checked={selectedDireccionesIds.includes(dir.id)}
                                onChange={() => handleToggleDireccionSelection(dir.id)}
                                className="w-4 h-4"
                              />
                            </td>
                          )}
                          <td className="px-2 py-2 border-r border-gray-200">{dir.calle}</td>
                          <td className="px-2 py-2 border-r border-gray-200">{dir.numeroExterior}</td>
                          <td className="px-2 py-2 border-r border-gray-200">{dir.piso || ''}</td>
                          <td className="px-2 py-2 border-r border-gray-200">{dir.numeroInterior || ''}</td>
                          <td className="px-2 py-2 border-r border-gray-200">{dir.colonia}</td>
                          <td className="px-2 py-2 border-r border-gray-200">{dir.codigoPostal}</td>
                          <td className="px-2 py-2 text-center border-r border-gray-200">
                            <input
                              type="checkbox"
                              checked={dir.principal || false}
                              onChange={() => handleTogglePrincipal(dir.id)}
                              disabled={isView}
                              className="w-4 h-4"
                            />
                          </td>
                          {!isView && (
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => handleEditDireccion(dir)}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                  <path d="M11.5 1.5l3 3-8 8H4v-2.5l7.5-8.5z"/>
                                  <path d="M13 4.5l-1.5 1.5-3-3L10 1.5l3 3z"/>
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Cotizaciones */}
          {activeTab === 'cotizaciones' && (
            <div>
              {/* Encabezado con título estilo institucional */}
              <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3">
                <span className="text-sm font-medium text-gray-800">COTIZACIONES GUARDADAS</span>
              </div>

              {/* Tabla de cotizaciones guardadas */}
              <div className="border border-gray-300 mb-4 bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Fecha/Hora</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Usuario</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Producto</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Monto</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Plazo</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 border-r border-gray-300">Tasa %</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700">Tipo Amort.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cotizaciones.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-8 text-center text-gray-400">
                          No hay cotizaciones guardadas. Haga clic en "Nuevo" para agregar una.
                        </td>
                      </tr>
                    ) : (
                      cotizaciones.map((cot) => (
                        <tr 
                          key={cot.id} 
                          onClick={isView ? undefined : () => handleSeleccionarCotizacion(cot)}
                          className={`border-b border-gray-200 ${isView ? '' : 'cursor-pointer'} transition-colors ${
                            cotizacionSeleccionada?.id === cot.id 
                              ? 'bg-blue-100 hover:bg-blue-100' 
                              : isView ? '' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-2 py-2 border-r border-gray-200">{cot.fechaHora}</td>
                          <td className="px-2 py-2 border-r border-gray-200">{cot.usuario}</td>
                          <td className="px-2 py-2 border-r border-gray-200">{cot.producto}</td>
                          <td className="px-2 py-2 border-r border-gray-200">{cot.montoSolicitado}</td>
                          <td className="px-2 py-2 border-r border-gray-200">{cot.plazoMeses} meses</td>
                          <td className="px-2 py-2 border-r border-gray-200">{cot.tasaInteres}%</td>
                          <td className="px-2 py-2">{cot.tipoAmortizacion}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Sección AMORTIZACIÓN con botón Nuevo */}
              <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">AMORTIZACIÓN</span>
                {!isView && (
                  <button 
                    onClick={() => setShowCotizacionModal(true)}
                    className="px-4 py-1 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium"
                  >
                    Nuevo
                  </button>
                )}
              </div>

              {/* Indicador de cotización seleccionada */}
              {cotizacionSeleccionada && (
                <div className="mb-2 text-xs text-gray-600 bg-blue-50 px-3 py-2 rounded border border-blue-200">
                  <span className="font-medium">Cotización seleccionada:</span> {cotizacionSeleccionada.producto} - {cotizacionSeleccionada.montoSolicitado} - {cotizacionSeleccionada.plazoMeses} meses - {cotizacionSeleccionada.tasaInteres}% - {cotizacionSeleccionada.tipoAmortizacion}
                </div>
              )}

              {/* Tabla de amortización */}
              <div className="border border-gray-300 overflow-x-auto bg-white">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#5B7DA4] text-white">
                      <th className="px-4 py-2.5 text-center font-medium border-r border-white">No. PAGO</th>
                      <th className="px-4 py-2.5 text-center font-medium border-r border-white">SALDO CAPITAL</th>
                      <th className="px-4 py-2.5 text-center font-medium border-r border-white">INTERÉS</th>
                      <th className="px-4 py-2.5 text-center font-medium border-r border-white">IVA</th>
                      <th className="px-4 py-2.5 text-center font-medium border-r border-white">AMORTIZACIÓN</th>
                      <th className="px-4 py-2.5 text-center font-medium border-r border-white">PAGO MENSUAL</th>
                      <th className="px-4 py-2.5 text-center font-medium">FECHA PAGO</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {tablaAmortizacion.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                          Seleccione una cotización para ver la tabla de amortización
                        </td>
                      </tr>
                    ) : (
                      tablaAmortizacion.map((fila) => {
                        const iva = parseFloat(fila.interes) * 0.16;
                        const pagoMinimo = parseFloat(fila.pagoMensual) + iva;
                        return (
                          <tr key={fila.noPago} className="border-b border-gray-200">
                            <td className="px-4 py-2 text-center text-[#333333] border-r border-gray-200">{fila.noPago}</td>
                            <td className="px-4 py-2 text-right text-[#333333] border-r border-gray-200">${parseFloat(fila.saldoCapital).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-2 text-right text-[#333333] border-r border-gray-200">${parseFloat(fila.interes).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-2 text-right text-[#333333] border-r border-gray-200">${iva.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-2 text-right text-[#333333] border-r border-gray-200">${parseFloat(fila.amortizacion).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-2 text-right text-[#333333] border-r border-gray-200">${pagoMinimo.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-2 text-center text-[#333333]">{fila.fechaPago}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Expedientes Electrónicos */}
          {activeTab === 'expedientes' && (
            <ExpedientesElectronicos
              isView={isView}
              prospectoDbUuid={prospecto?.dbUuid}
              initialData={expedientesElectronicos}
              onDataChange={setExpedientesElectronicos}
              prospectoData={prospecto?._rawData}
            />
          )}

          {/* Tab SIC */}
          {activeTab === 'sic' && (
            <div>
              {/* Título con estilo institucional y botones */}
              <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">CONSULTA SIC</span>
                {!isView && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleNuevo}
                      className="px-4 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium"
                    >
                      Nuevo
                    </button>
                    <button className="px-4 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium">
                      Eliminar
                    </button>
                  </div>
                )}
              </div>

              {/* Tabla de consultas SIC */}
              <div className="border border-gray-300">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#E7E6E6] border-b border-gray-400">
                      <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha y hora del registro</th>
                      <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Usuario que registró</th>
                      <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tipo de Consulta *</th>
                      <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus *</th>
                      <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300 w-20">Consultar</th>
                      <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300 w-20">PDF SIC</th>
                      <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 w-20">XML SIC</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {consultas.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-xs">
                          No hay consultas SIC registradas para este prospecto
                        </td>
                      </tr>
                    )}
                    {consultas.map((consulta) => (
                      <tr key={consulta.id} className="border-b border-gray-300">
                        <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{consulta.fechaHora}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{consulta.usuario}</td>
                        <td className="px-3 py-2 border-r border-gray-300">
                          <input 
                            type="text" 
                            value={consulta.tipoConsulta}
                            readOnly
                            className="w-full px-1 py-0.5 text-xs border-0 bg-transparent"
                          />
                        </td>
                        <td className="px-3 py-2 border-r border-gray-300">
                          <input 
                            type="text" 
                            value={consulta.estatus}
                            readOnly
                            className="w-full px-1 py-0.5 text-xs border-0 bg-transparent"
                          />
                        </td>
                        <td className="px-3 py-2 border-r border-gray-300 text-center">
                          <button 
                            onClick={() => handleConsultar(consulta.id)}
                            className="inline-flex items-center justify-center p-1 hover:bg-gray-100 rounded"
                            title="Consultar"
                            disabled={isView}
                          >
                            <Zap className={`w-4 h-4 ${isView ? 'text-gray-400' : 'text-yellow-600'}`} />
                          </button>
                        </td>
                        <td className="px-3 py-2 border-r border-gray-300 text-center">
                          <button 
                            onClick={() => handleVerPdfSic(consulta)}
                            className="inline-flex items-center justify-center p-1 hover:bg-gray-100 rounded"
                            title="Ver PDF SIC"
                          >
                            <FileText className="w-4 h-4 text-red-600" />
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button 
                            onClick={() => handleVerXml(consulta.xmlResultado)}
                            className="inline-flex items-center justify-center p-1 hover:bg-gray-100 rounded"
                            title="Ver XML SIC"
                            disabled={!consulta.xmlResultado}
                          >
                            <FileCode className={`w-4 h-4 ${consulta.xmlResultado ? 'text-green-600' : 'text-gray-400'}`} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Listas Negras */}
          {activeTab === 'listas-negras' && (
            <div>
              {/* Título con estilo institucional y botones */}
              <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">LISTAS NEGRAS</span>
                {!isView && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleNuevoListaNegra}
                      className="px-4 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium"
                    >
                      Nuevo
                    </button>
                    <button className="px-4 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium">
                      Eliminar
                    </button>
                  </div>
                )}
              </div>

              {/* Tabla de listas negras — estilo SIC */}
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
                    {listasNegras.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-gray-400 text-xs">
                          No hay registros de Listas Negras para este prospecto
                        </td>
                      </tr>
                    )}
                    {listasNegras.map((lista) => (
                      <tr key={lista.id} className="border-b border-gray-300">
                        <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{lista.fechaHora}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{lista.usuario}</td>
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
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Otros tabs - Placeholder */}
          {!['general', 'direcciones', 'cotizaciones', 'expedientes', 'sic', 'listas-negras'].includes(activeTab) && (
            <div className="text-center py-12 text-gray-500 text-sm">
              Contenido de {tabs.find(t => t.id === activeTab)?.label}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Dirección */}
      {showDireccionModal && (
        <DireccionModal
          mode={direccionFormMode}
          direccion={selectedDireccion}
          onSave={handleSaveDireccion}
          onCancel={() => setShowDireccionModal(false)}
        />
      )}

      {/* Modal de Nueva Consulta SIC */}
      {showNuevoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                Nueva Consulta SIC
              </h3>
              <button
                onClick={() => setShowNuevoModal(false)}
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
                <h4 className="text-sm font-semibold text-gray-800">INFORMACIÓN DE CONSULTA SIC</h4>
              </div>

              {/* Formulario */}
              <div className="space-y-4">
                {/* TIPO DE CONSULTA y ESTATUS en la misma fila */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tipo de Consulta <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={nuevoTipoConsulta}
                      onChange={(e) => setNuevoTipoConsulta(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                    >
                      <option value="">Seleccionar...</option>
                      <option>BURO</option>
                      <option>OTRO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Estatus <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={nuevoEstatus}
                      onChange={(e) => setNuevoEstatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="NEGATIVO">NEGATIVO (Sin registros negativos)</option>
                      <option value="POSITIVO">POSITIVO (Con registros negativos)</option>
                      <option value="Pendiente">Pendiente</option>
                      <option value="En revision">En revision</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNuevoModal(false)}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarNuevo}
                className="px-5 py-2 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para visualizar XML SIC */}
      {showXmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCode className="w-5 h-5 text-white" />
                <h3 className="text-base font-medium text-white">
                  Visualizador de XML SIC
                </h3>
              </div>
              <button
                onClick={() => setShowXmlModal(false)}
                className="text-white hover:text-gray-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            {/* Contenido del XML */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {/* Toolbar con botones de acción */}
              <div className="flex items-center justify-between mb-4 bg-white border border-gray-300 rounded px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Archivo XML de Consulta SIC</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyXml}
                    className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 font-medium flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedXml ? 'Copiado!' : 'Copiar'}
                  </button>
                  <button
                    onClick={handleDownloadXml}
                    className="px-4 py-1.5 btn-primary-theme rounded text-sm hover:bg-primary-hover-theme font-medium flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Descargar XML
                  </button>
                </div>
              </div>

              {/* Visualizador de XML con formato */}
              <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-700">
                <div className="bg-[#2d2d2d] px-4 py-2 border-b border-gray-700">
                  <span className="text-xs text-gray-400 font-mono">consulta-sic.xml</span>
                </div>
                <pre className="p-6 overflow-x-auto text-xs leading-relaxed">
                  <code className="font-mono text-gray-300">{xmlSeleccionado}</code>
                </pre>
              </div>

              {/* Información adicional */}
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded px-4 py-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Información del XML SIC</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Este archivo XML contiene la información completa de la consulta realizada a la Sociedad de Información Crediticia (SIC). 
                      Puede descargarlo para su archivo o integrarlo con sistemas externos.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowXmlModal(false)}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nueva Lista Negra */}
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
                      value={nuevoNombreLista}
                      onChange={(e) => setNuevoNombreLista(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                      placeholder="Seleccionar..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tipo Lista <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={nuevoTipoLista}
                      onChange={(e) => setNuevoTipoLista(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                    >
                      <option value="">Seleccionar...</option>
                      <option>Externa</option>
                      <option>Interna</option>
                    </select>
                  </div>
                </div>

                {/* ESTATUS */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Estatus <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={nuevoEstatusListaNegra}
                    onChange={(e) => setNuevoEstatusListaNegra(e.target.value)}
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

      {/* Modal de Nueva Cotizaci ón/Amortización */}
      {showCotizacionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header institucional */}
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-medium text-white">
                Nueva Cotización
              </h3>
              <button
                onClick={() => setShowCotizacionModal(false)}
                className="text-white hover:text-gray-200"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
                </svg>
              </button>
            </div>

            {/* Contenido del formulario */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Sección con título institucional */}
              <div className="bg-blue-50 border-l-4 border-primary-theme px-4 py-2.5 mb-4">
                <h4 className="text-sm font-medium text-gray-800">INFORMACIÓN DE COTIZACIÓN</h4>
              </div>

              {/* Formulario */}
              <div className="space-y-4">
                {/* PRODUCTO */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Producto <span className="text-red-600">*</span>
                  </label>
                  <select 
                    value={nuevaCotizacion.producto}
                    onChange={(e) => handleChangeCotizacion('producto', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                  >
                    <option value="">Seleccione...</option>
                    <option>Crédito Personal</option>
                    <option>Crédito Automotriz</option>
                    <option>Crédito Hipotecario</option>
                  </select>
                </div>

                {/* MONTO SOLICITADO */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Monto Solicitado <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={nuevaCotizacion.montoSolicitado}
                    onChange={(e) => handleChangeCotizacion('montoSolicitado', e.target.value)}
                    placeholder="$0.00"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                  />
                </div>

                {/* PLAZO (MESES) */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Plazo (Meses) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={nuevaCotizacion.plazoMeses}
                    onChange={(e) => handleChangeCotizacion('plazoMeses', e.target.value)}
                    placeholder="12"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                  />
                </div>

                {/* TASA DE INTERÉS */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Tasa de Interés (%) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={nuevaCotizacion.tasaInteres}
                    onChange={(e) => handleChangeCotizacion('tasaInteres', e.target.value)}
                    placeholder="12.50"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                  />
                </div>

                {/* TIPO DE AMORTIZACIÓN */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Tipo de Amortización <span className="text-red-600">*</span>
                  </label>
                  <select 
                    value={nuevaCotizacion.tipoAmortizacion}
                    onChange={(e) => handleChangeCotizacion('tipoAmortizacion', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-theme"
                  >
                    <option value="">Seleccione...</option>
                    <option>Francés</option>
                    <option>Alemán</option>
                    <option>Americano</option>
                  </select>
                </div>

                {/* FECHA PRIMER PAGO */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Fecha Primer Pago
                  </label>
                  <DatePicker
                    value={nuevaCotizacion.fechaPrimerPago}
                    onChange={(date) => handleChangeCotizacion('fechaPrimerPago', date)}
                    className="!px-3 !py-2"
                  />
                </div>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCotizacionModal(false)}
                className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarCotizacion}
                className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90 font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de PDF SIC */}
      {showPdfSicModal && consultaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded shadow-lg w-[90vw] h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300">
              <div>
                <h3 className="text-base font-medium text-gray-800">REPORTE SIC - BURÓ DE CRÉDITO</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Consulta del {consultaSeleccionada.fechaHora} - {consultaSeleccionada.tipoConsulta}
                </p>
              </div>
              <button
                onClick={() => setShowPdfSicModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* PDF Viewer - Reporte SIC con datos del prospecto */}
            <div className="flex-1 overflow-auto p-6 bg-white">
              <div className="max-w-4xl mx-auto bg-white border border-gray-300 shadow-lg p-8">
                {/* Header del Reporte */}
                <div className="border-b-2 border-gray-800 pb-4 mb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">BURÓ DE CRÉDITO</h1>
                      <p className="text-sm text-gray-700 mt-1">Reporte de Crédito Especial</p>
                      <p className="text-xs text-gray-600 mt-1">Sociedad de Información Crediticia</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-600">
                        <p>Folio de Consulta: <span className="font-semibold">BC-{new Date().getFullYear()}-{String(consultaSeleccionada.id).padStart(6, '0')}</span></p>
                        <p>Fecha: {consultaSeleccionada.fechaHora}</p>
                        <p>Usuario: {consultaSeleccionada.usuario}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Datos del Prospecto — desde formData y prospecto prop */}
                {(() => {
                  const nombreCompleto = `${formData.nombre || ''} ${formData.apellidoPaterno || ''} ${formData.apellidoMaterno || ''}`.trim().toUpperCase();
                  const rfc = formData.rfc || prospecto?.rfc || 'N/A';
                  const curp = formData.curp || prospecto?.curp || 'N/A';
                  const fechaNacimiento = formData.fechaNacimiento || prospecto?.fechaNacimiento || prospecto?.fechaOriginacion || 'N/A';
                  const direccion = formData.direccion || prospecto?.direccion || 'N/A';
                  const entidad = formData.entidadFederativa || prospecto?.entidadFederativa || prospecto?.sucursal || 'N/A';
                  const idProspecto = formData.idProspecto || prospecto?.idProspecto || 'N/A';
                  const fechaCaptura = prospecto?.fechaOriginacion || formData.fechaNacimiento || 'N/A';
                  // Datos de cotización/solicitud
                  const cotizacion = cotizaciones.length > 0 ? cotizaciones[0] : null;
                  const productoSolicitado = cotizacion?.producto || 'N/A';
                  const montoSolicitado = cotizacion?.montoSolicitado || 'N/A';

                  return (
                    <>
                      {/* Datos de la Solicitud */}
                      <div className="mb-6">
                        <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">DATOS DE LA SOLICITUD</h2>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-gray-600">No. Solicitud:</p>
                            <p className="font-semibold">{idProspecto}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Fecha de Captura:</p>
                            <p className="font-semibold">{fechaCaptura}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Producto Solicitado:</p>
                            <p className="font-semibold">{productoSolicitado}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Monto Solicitado:</p>
                            <p className="font-semibold">{montoSolicitado}</p>
                          </div>
                        </div>
                      </div>

                      {/* Datos del Consultado */}
                      <div className="mb-6">
                        <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">DATOS DEL CONSULTADO</h2>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-gray-600">Nombre:</p>
                            <p className="font-semibold">{nombreCompleto || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">RFC:</p>
                            <p className="font-semibold">{rfc}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">CURP:</p>
                            <p className="font-semibold">{curp}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Fecha de Nacimiento:</p>
                            <p className="font-semibold">{fechaNacimiento}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-gray-600">Dirección:</p>
                            <p className="font-semibold">{direccion}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Estado:</p>
                            <p className="font-semibold">{entidad}</p>
                          </div>
                        </div>
                      </div>

                      {/* Score Crediticio */}
                      <div className="mb-6">
                        <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">SCORE CREDITICIO</h2>
                        <div className="flex items-center gap-8">
                          <div className="text-center">
                            <div className="text-4xl font-bold text-green-600">720</div>
                            <p className="text-xs text-gray-600 mt-1">Puntuación</p>
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-200 h-4 rounded-full overflow-hidden">
                              <div className="bg-green-500 h-full" style={{ width: '72%' }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600 mt-1">
                              <span>300</span>
                              <span>Bueno</span>
                              <span>850</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Resumen de Créditos */}
                      <div className="mb-6">
                        <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">RESUMEN DE CRÉDITOS</h2>
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div className="border border-gray-300 p-3 text-center">
                            <p className="text-gray-600 mb-1">Cuentas Activas</p>
                            <p className="text-2xl font-bold text-blue-600">5</p>
                          </div>
                          <div className="border border-gray-300 p-3 text-center">
                            <p className="text-gray-600 mb-1">Saldo Total</p>
                            <p className="text-2xl font-bold text-orange-600">$284,500</p>
                          </div>
                          <div className="border border-gray-300 p-3 text-center">
                            <p className="text-gray-600 mb-1">Créditos Cerrados</p>
                            <p className="text-2xl font-bold text-gray-600">8</p>
                          </div>
                        </div>
                      </div>

                      {/* Detalle de Créditos */}
                      <div className="mb-6">
                        <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">DETALLE DE CRÉDITOS VIGENTES</h2>
                        <table className="w-full text-xs border border-gray-300">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="border border-gray-300 px-2 py-1 text-left">Acreedor</th>
                              <th className="border border-gray-300 px-2 py-1 text-left">Tipo</th>
                              <th className="border border-gray-300 px-2 py-1 text-right">Saldo Actual</th>
                              <th className="border border-gray-300 px-2 py-1 text-center">Estatus</th>
                              <th className="border border-gray-300 px-2 py-1 text-center">MOP</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-gray-300 px-2 py-1">BANCO SANTANDER</td>
                              <td className="border border-gray-300 px-2 py-1">Tarjeta de Crédito</td>
                              <td className="border border-gray-300 px-2 py-1 text-right">$45,200</td>
                              <td className="border border-gray-300 px-2 py-1 text-center"><span className="text-green-600 font-semibold">AL CORRIENTE</span></td>
                              <td className="border border-gray-300 px-2 py-1 text-center">01</td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 px-2 py-1">BBVA BANCOMER</td>
                              <td className="border border-gray-300 px-2 py-1">Crédito Automotriz</td>
                              <td className="border border-gray-300 px-2 py-1 text-right">$185,300</td>
                              <td className="border border-gray-300 px-2 py-1 text-center"><span className="text-green-600 font-semibold">AL CORRIENTE</span></td>
                              <td className="border border-gray-300 px-2 py-1 text-center">01</td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 px-2 py-1">LIVERPOOL</td>
                              <td className="border border-gray-300 px-2 py-1">Tarjeta de Crédito</td>
                              <td className="border border-gray-300 px-2 py-1 text-right">$12,500</td>
                              <td className="border border-gray-300 px-2 py-1 text-center"><span className="text-green-600 font-semibold">AL CORRIENTE</span></td>
                              <td className="border border-gray-300 px-2 py-1 text-center">01</td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 px-2 py-1">SCOTIABANK</td>
                              <td className="border border-gray-300 px-2 py-1">Crédito Personal</td>
                              <td className="border border-gray-300 px-2 py-1 text-right">$35,000</td>
                              <td className="border border-gray-300 px-2 py-1 text-center"><span className="text-green-600 font-semibold">AL CORRIENTE</span></td>
                              <td className="border border-gray-300 px-2 py-1 text-center">01</td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 px-2 py-1">BANORTE</td>
                              <td className="border border-gray-300 px-2 py-1">Tarjeta de Crédito</td>
                              <td className="border border-gray-300 px-2 py-1 text-right">$6,500</td>
                              <td className="border border-gray-300 px-2 py-1 text-center"><span className="text-green-600 font-semibold">AL CORRIENTE</span></td>
                              <td className="border border-gray-300 px-2 py-1 text-center">01</td>
                            </tr>
                          </tbody>
                        </table>
                        <p className="text-xs text-gray-500 mt-2">
                          <strong>MOP:</strong> Manera de Pago (01 = Al día, 02 = 1-29 días vencido, 03 = 30-59 días vencido, etc.)
                        </p>
                      </div>

                      {/* Consultas Recientes */}
                      <div className="mb-6">
                        <h2 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 mb-3">CONSULTAS RECIENTES (ÚLTIMOS 24 MESES)</h2>
                        <div className="text-xs">
                          <p className="mb-2"><span className="font-semibold">Total de consultas:</span> 8</p>
                          <div className="border border-gray-300">
                            <div className="bg-gray-100 border-b border-gray-300 px-2 py-1 flex">
                              <span className="w-1/3 font-semibold">Fecha</span>
                              <span className="w-1/3 font-semibold">Otorgante</span>
                              <span className="w-1/3 font-semibold">Tipo</span>
                            </div>
                            <div className="px-2 py-1 border-b border-gray-200 flex">
                              <span className="w-1/3">30/01/2026</span>
                              <span className="w-1/3">BANCO AZTECA</span>
                              <span className="w-1/3">Tarjeta de Crédito</span>
                            </div>
                            <div className="px-2 py-1 border-b border-gray-200 flex">
                              <span className="w-1/3">15/12/2025</span>
                              <span className="w-1/3">HSBC</span>
                              <span className="w-1/3">Crédito Personal</span>
                            </div>
                            <div className="px-2 py-1 flex">
                              <span className="w-1/3">08/10/2025</span>
                              <span className="w-1/3">COPPEL</span>
                              <span className="w-1/3">Crédito de Nómina</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="border-t-2 border-gray-800 pt-4 mt-8">
                        <p className="text-xs text-gray-500 text-center">
                          Este reporte es confidencial y fue generado exclusivamente para {nombreCompleto}<br />
                          Buró de Crédito - Sociedad de Información Crediticia, S.A. de C.V.<br />
                          Fecha de generación: {new Date().toLocaleString('es-MX')}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Footer con botones */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-300 bg-gray-50">
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 btn-accent-theme rounded text-sm hover:bg-accent-hover-theme"
              >
                Imprimir / Descargar PDF
              </button>
              <button
                onClick={() => setShowPdfSicModal(false)}
                className="px-4 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Modal — Resultado de Activacion CORE
          ═══════════════════════════════════════════════════════════════ */}
      {showActivacionModal && resultadoActivacion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-[560px] max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className={`px-5 py-3 flex items-center gap-3 ${
              resultadoActivacion.estatusOperacion === 'OK'
                ? 'bg-green-600'
                : 'bg-red-600'
            }`}>
              {resultadoActivacion.estatusOperacion === 'OK' ? (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
              <h3 className="text-white font-medium text-sm">
                {resultadoActivacion.estatusOperacion === 'OK'
                  ? 'ACTIVACION EXITOSA — CORE'
                  : 'ACTIVACION RECHAZADA — CORE'}
              </h3>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Mensaje principal con icono */}
              <div className={`flex items-start gap-3 p-4 rounded-lg border ${
                resultadoActivacion.estatusOperacion === 'OK'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${
                  resultadoActivacion.estatusOperacion === 'OK' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {resultadoActivacion.estatusOperacion === 'OK' ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`text-sm ${
                    resultadoActivacion.estatusOperacion === 'OK' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {resultadoActivacion.mensaje}
                  </p>
                </div>
              </div>

              {/* Estatus operacion — cards mejoradas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <span className="text-[10px] tracking-wider text-gray-400 uppercase block mb-1">Estatus Operacion</span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      resultadoActivacion.estatusOperacion === 'OK' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className={`text-sm ${
                      resultadoActivacion.estatusOperacion === 'OK' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {resultadoActivacion.estatusOperacion}
                    </span>
                  </div>
                </div>
                {(resultadoActivacion.numeroCuenta || resultadoActivacion.cuentaEjeId) && (
                  <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-[10px] tracking-wider text-gray-400 uppercase block mb-1">Cuenta Eje Generada</span>
                    <span className="font-mono text-gray-800 bg-gray-50 px-3 py-1.5 rounded inline-block tracking-widest">
                      {resultadoActivacion.numeroCuenta
                        ? formatNoCuenta(resultadoActivacion.numeroCuenta)
                        : resultadoActivacion.cuentaEjeId!.substring(0, 8) + '...'}
                    </span>
                  </div>
                )}
              </div>

              {/* Errores detallados — categorizados con diseno mejorado */}
              {resultadoActivacion.errores && resultadoActivacion.errores.length > 0 && (() => {
                const errDatosGen = resultadoActivacion.errores.filter(e => e.includes('Datos Generales'));
                const errDefault = resultadoActivacion.errores.filter(e => e.includes('en Default'));
                const errSubTabs = resultadoActivacion.errores.filter(e => e.includes('SubTab'));
                const errSIC = resultadoActivacion.errores.filter(e => e.includes('SIC') && !e.includes('SubTab') && !e.includes('Default') && !e.includes('Datos Generales'));
                const errLN = resultadoActivacion.errores.filter(e => e.includes('Listas Negras') && !e.includes('SubTab') && !e.includes('Default') && !e.includes('Datos Generales'));
                const usedErrors = [...errDatosGen, ...errDefault, ...errSubTabs, ...errSIC, ...errLN];
                const errOtros = resultadoActivacion.errores.filter(e => !usedErrors.includes(e));

                const categorias = [
                  { titulo: 'Campos Generales vacios', items: errDatosGen, icon: '\u{1F4CB}', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', titleColor: 'text-orange-800', dotColor: 'bg-orange-400', textColor: 'text-orange-700', hint: 'Complete estos campos en la pestana Default del formulario y presione Guardar.' },
                  { titulo: 'Campos Default vacios', items: errDefault, icon: '\u{1F4DD}', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', titleColor: 'text-orange-800', dotColor: 'bg-orange-400', textColor: 'text-orange-700', hint: 'Verifique la pestana Default \u2014 campo TIPO es obligatorio.' },
                  { titulo: 'SubTabs incompletas', items: errSubTabs, icon: '\u{1F4D1}', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', titleColor: 'text-amber-800', dotColor: 'bg-amber-400', textColor: 'text-amber-700', hint: 'Agregue al menos un registro en cada SubTab requerida (Direcciones, Expedientes, SIC, Listas Negras).' },
                  { titulo: 'Validacion SIC', items: errSIC, icon: '\u{1F512}', bgColor: 'bg-red-50', borderColor: 'border-red-200', titleColor: 'text-red-800', dotColor: 'bg-red-400', textColor: 'text-red-700', hint: 'Cambie el estatus SIC a "NEGATIVO" en la pestana SIC y Guarde antes de activar.' },
                  { titulo: 'Validacion Listas Negras', items: errLN, icon: '\u{1F6AB}', bgColor: 'bg-red-50', borderColor: 'border-red-200', titleColor: 'text-red-800', dotColor: 'bg-red-400', textColor: 'text-red-700', hint: 'Cambie el estatus Listas Negras a "NEGATIVO" en la pestana Listas Negras y Guarde antes de activar.' },
                  { titulo: 'Otros errores', items: errOtros, icon: '\u{26A0}\u{FE0F}', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', titleColor: 'text-gray-800', dotColor: 'bg-gray-400', textColor: 'text-red-700', hint: '' },
                ].filter(c => c.items.length > 0);

                return (
                  <div className="space-y-4">
                    {/* Banner resumen */}
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-amber-900 mb-0.5">
                          Requisitos para Activacion — <span className="font-mono bg-amber-200/60 px-1.5 py-0.5 rounded text-[11px]">{resultadoActivacion.errores.length} pendientes</span>
                        </p>
                        <p className="text-[11px] text-amber-700">
                          Corrija los siguientes puntos, presione <strong>Guardar</strong> y vuelva a intentar la activacion.
                        </p>
                      </div>
                    </div>

                    {/* Categorias con diseno mejorado */}
                    {categorias.map((cat, ci) => (
                      <div key={ci} className={`${cat.bgColor} border ${cat.borderColor} rounded-lg overflow-hidden`}>
                        <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${cat.borderColor}`}>
                          <span className="text-sm">{cat.icon}</span>
                          <p className={`text-xs ${cat.titleColor}`}>
                            {cat.titulo}
                          </p>
                          <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${cat.bgColor} border ${cat.borderColor} ${cat.titleColor}`}>
                            {cat.items.length}
                          </span>
                        </div>
                        <div className="px-4 py-2.5 space-y-1">
                          {cat.hint && (
                            <p className="text-[10px] text-gray-500 mb-2 italic leading-relaxed">{cat.hint}</p>
                          )}
                          <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                            {cat.items.map((error, idx) => (
                              <div key={idx} className={`flex items-start gap-2 text-xs ${cat.textColor}`}>
                                <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${cat.dotColor}`} />
                                <span className="leading-relaxed">{error}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => { setShowActivacionModal(false); clearResultado(); }}
                className="px-5 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente Modal de Dirección
interface DireccionModalProps {
  mode: 'create' | 'edit';
  direccion: any;
  onSave: (direccionData: any) => void;
  onCancel: () => void;
}

function DireccionModal({ mode, direccion, onSave, onCancel }: DireccionModalProps) {
  // En modo editar, cargar datos existentes; en modo crear, TODO en blanco
  const isEditMode = mode === 'edit' && direccion;
  const [formData, setFormData] = useState({
    pais: isEditMode ? (direccion.pais || '') : '',
    atencion: isEditMode ? (direccion.atencion || '') : '',
    destinatario: isEditMode ? (direccion.destinatario || '') : '',
    tipoCalle: isEditMode ? (direccion.tipoCalle || '') : '',
    calle: isEditMode ? (direccion.calle || '') : '',
    numeroExterior: isEditMode ? (direccion.numeroExterior || '') : '',
    piso: isEditMode ? (direccion.piso || '') : '',
    numeroInterior: isEditMode ? (direccion.numeroInterior || '') : '',
    colonia: isEditMode ? (direccion.colonia || '') : '',
    municipio: isEditMode ? (direccion.municipio || '') : '',
    codigoPostal: isEditMode ? (direccion.codigoPostal || '') : '',
    ciudad: isEditMode ? (direccion.ciudad || '') : '',
    estado: isEditMode ? (direccion.estado || '') : '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    // Validar campos requeridos
    const required = [
      { field: 'pais', label: 'País' },
      { field: 'calle', label: 'Calle' },
      { field: 'numeroExterior', label: 'Número Exterior' },
      { field: 'codigoPostal', label: 'Código Postal' },
      { field: 'colonia', label: 'Colonia' },
    ];
    const missing = required.filter(r => !formData[r.field as keyof typeof formData]);
    if (missing.length > 0) {
      toast.error('Campos requeridos faltantes', {
        description: `Complete: ${missing.map(m => m.label).join(', ')}`,
      });
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded shadow-xl w-[900px] max-h-[90vh] overflow-auto">
        {/* Header institucional */}
        <div className="bg-primary-theme px-6 py-3 flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold">
            {mode === 'create' ? 'Nueva Dirección' : 'Editar Dirección'}
          </h2>
          <button 
            onClick={onCancel}
            className="text-white hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Sección con borde institucional */}
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
                  value={formData.pais}
                  onChange={(e) => handleChange('pais', e.target.value)}
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
                  value={formData.atencion}
                  onChange={(e) => handleChange('atencion', e.target.value)}
                  placeholder="Atención..."
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
                  value={formData.destinatario}
                  onChange={(e) => handleChange('destinatario', e.target.value)}
                  placeholder="Destinatario..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block">Tipo de Calle</label>
                <select
                  value={formData.tipoCalle}
                  onChange={(e) => handleChange('tipoCalle', e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                >
                  <option value="">Seleccionar...</option>
                  <option value="AV">AV</option>
                  <option value="CALLE">CALLE</option>
                  <option value="BLVD">BLVD</option>
                  <option value="PRIV">PRIV</option>
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
                  value={formData.calle}
                  onChange={(e) => handleChange('calle', e.target.value)}
                  placeholder="Calle..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block">
                  Número Exterior <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.numeroExterior}
                  onChange={(e) => handleChange('numeroExterior', e.target.value)}
                  placeholder="Número exterior..."
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
                  value={formData.piso}
                  onChange={(e) => handleChange('piso', e.target.value)}
                  placeholder="Piso..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block">Número Interior</label>
                <input
                  type="text"
                  value={formData.numeroInterior}
                  onChange={(e) => handleChange('numeroInterior', e.target.value)}
                  placeholder="Número interior..."
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
                  value={formData.codigoPostal}
                  onChange={(e) => handleChange('codigoPostal', e.target.value)}
                  placeholder="Código postal..."
                  maxLength={5}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block">
                  Colonia <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.colonia}
                  onChange={(e) => handleChange('colonia', e.target.value)}
                  placeholder="Colonia..."
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
                  value={formData.municipio}
                  onChange={(e) => handleChange('municipio', e.target.value)}
                  placeholder="Municipio/Alcaldía..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="text-xs text-gray-700 mb-1 block">Ciudad</label>
                <input
                  type="text"
                  value={formData.ciudad}
                  onChange={(e) => handleChange('ciudad', e.target.value)}
                  placeholder="Ciudad..."
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
                  value={formData.estado}
                  onChange={(e) => handleChange('estado', e.target.value)}
                  placeholder="Estado..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-2 mt-6">
            <button 
              onClick={onCancel}
              className="px-6 py-2 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit}
              className="px-6 py-2 btn-primary-theme rounded text-xs hover:bg-primary-hover-theme"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}