import { useState, useMemo } from 'react';
import { Product, FormMode } from './types/product';
import { creditProducts, mockProducts, organizations, currentUser } from './data/mockData';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { PLDHome } from './components/pld/PLDHome';
import { PLDKYCInfo } from './components/pld/PLDKYCInfo';
import { PLDPerfilTransaccional } from './components/pld/PLDPerfilTransaccional';
import { PLDCalificacionRiesgo } from './components/pld/PLDCalificacionRiesgo';
import { PLDAlertasPLD } from './components/pld/PLDAlertasPLD';
import { PLDAlertasInternas } from './components/pld/PLDAlertasInternas';
import { PLDParametros } from './components/pld/PLDParametros';
import { PLDCatalogos } from './components/pld/PLDCatalogos';
import { PLDReportesCNBV } from './components/pld/PLDReportesCNBV';
import { ProductosList } from './components/productos/ProductosList';
import { ProductoCaptacionForm } from './components/productos/ProductoCaptacionForm';
import { ProductoForm } from './components/productos/ProductoForm';
import { ProductosLineaCreditoModule } from './components/productos-linea-credito/ProductosLineaCreditoModule';
import { Garantias } from './components/garantias/Garantias';
import { Cliente, mockClientes } from './data/mockClientesData';
import { ClientesList } from './components/clientes/ClientesList';
import { ClientesDashboard } from './components/clientes/ClientesDashboard';
import { AltaClienteDefault } from './components/clientes/AltaClienteDefault';
import { ClienteDireccionForm } from './components/clientes/ClienteDireccionForm';
import { Prospecto } from './components/prospectos/ProspectosList';
import { ProspectosList } from './components/prospectos/ProspectosList';
import { ProspectosDashboard } from './components/prospectos/ProspectosDashboard';
import { ProspectoForm } from './components/prospectos/ProspectoForm';
import { useProspectosDB } from './hooks/useProspectosDB';
import { useClientesDB } from './hooks/useClientesDB';
import { SolicitudCredito } from '@/types/solicitudCredito';
import { solicitudesCredito } from '@/data/solicitudesData';
import { SolicitudesDashboard } from './components/solicitudes/SolicitudesDashboard';
import { SolicitudCreditoList } from './components/solicitudes/SolicitudCreditoList';
import { SOLICITUDES_LISTA } from './components/solicitudes/solicitudCreditoStore';
// SolicitudCreditoForm is managed internally by SolicitudCreditoList
import { Credito } from '@/types/credito';
import { creditos as creditosData } from '@/data/creditosData';
import { CreditosModule } from './components/creditos/CreditosModule';
import { Inversion, inversionesData } from './components/inversiones/InversionesModule';
import { InversionesModule } from './components/inversiones/InversionesModule';
import { CuentasAhorroModule } from './components/cuentas-ahorro/CuentasAhorroModule';
import { Dashboard } from './components/Dashboard';
import { SplashScreen } from './components/SplashScreen';
import { LoginScreen } from './components/LoginScreen';
import { OriginacionModule } from './components/originacion/OriginacionModule';
import { SolicitudActivacionDashboard } from './components/solicitudes-activacion/SolicitudActivacionDashboard';
import { SolicitudActivacionList } from './components/solicitudes-activacion/SolicitudActivacionList';
import { useSolicitudesActivacionDB } from './hooks/useSolicitudesActivacionDB';
import { AvisosVencimientoModule } from './components/avisos-vencimiento/AvisosVencimientoModule';
import { ConfiguracionModule } from './components/configuracion/ConfiguracionModule';
import { EjecReportesModule } from './components/reportes-regulatorios/EjecReportesModule';
import { PagosReferenciadosModule } from './components/pagos-referenciados/PagosReferenciadosModule';
import { CasosCobranzaModule } from './components/casos-cobranza/CasosCobranzaModule';
import { CarteraList } from './components/cartera/CarteraList';
import { AportacionesModule } from './components/cartera/AportacionesModule';
import { CobranzaModule } from './components/cartera/CobranzaModule';
import { CotizacionesModule } from './components/cotizaciones/CotizacionesModule';
import { PolizasContablesModule } from './components/polizas-contables/PolizasContablesModule';
import { GestionRiesgosModule } from './components/gestion-riesgos/GestionRiesgosModule';
import { UNEHome } from './components/une/UNEHome';
import efinanciaLogo from '@/assets/7b6cb23c00b7817818c638af3eae0a416e1e9f57.png';
import { ThemeProvider } from './contexts/ThemeContext';
import { useProductosCredito } from './hooks/useProductosCredito';
import { useProductosSeguros } from './hooks/useProductosSeguros';
import { useProductosCaptacionDB } from './hooks/useProductosCaptacionDB';
import { projectId, publicAnonKey } from '/utils/supabase/info';

type View = 'list' | 'form' | 'direccion';
type Module = 'dashboard' | 'configuracion' | 'productos' | 'garantias' | 'prospectos' | 'clientes' | 'cotizaciones' | 'cuentas-ahorro' | 'solicitudes-creditos' | 'solicitudes-activacion' | 'originacion' | 'creditos' | 'inversiones' | 'cartera-credito' | 'cartera-inversion' | 'cartera-ahorro' | 'avisos-vencimiento' | 'pld' | 'pagos-referenciados' | 'casos-cobranza' | 'cobranza' | 'ejec-reportes' | 'polizas-contables' | 'gestion-riesgos' | 'une';
type ClienteView = 'dashboard' | 'list' | 'form' | 'direccion';
type ProspectoView = 'dashboard' | 'list' | 'form';
type SolicitudView = 'dashboard' | 'list' | 'form';
type CreditoView = 'dashboard' | 'list' | 'form';
type InversionView = 'list' | 'form';
type ProductoTab = 'captacion' | 'credito' | 'producto-credito' | 'seguros';
type PLDView = 'home' | 'kyc' | 'perfil-transaccional' | 'calificacion-riesgo' | 'alertas-pld' | 'alertas-internas' | 'parametros' | 'catalogos' | 'reportes-cnbv';
type LineaCreditoView = 'list' | 'form';

function CarteraModule() {
  return <CarteraList />;
}

function App() {
  // rebuild-trigger-20260318
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentModule, setCurrentModule] = useState<Module>('dashboard');
  const [products, setProducts] = useState<Product[]>(creditProducts);

  const [currentView, setCurrentView] = useState<View>('list');
  const [formMode, setFormMode] = useState<FormMode>('view');
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [productoTab, setProductoTab] = useState<ProductoTab>('producto-credito');
  const [lineaCreditoView, setLineaCreditoView] = useState<LineaCreditoView>('list');
  const [lineaCreditoFormMode, setLineaCreditoFormMode] = useState<FormMode>('view');
  const [clienteView, setClienteView] = useState<ClienteView>('dashboard');
  const [clienteFormMode, setClienteFormMode] = useState<FormMode>('view');
  const [selectedCliente, setSelectedCliente] = useState<any>();
  const [clientes, setClientes] = useState<Cliente[]>(mockClientes);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [prospectoView, setProspectoView] = useState<ProspectoView>('dashboard');
  const [prospectoFormMode, setProspectoFormMode] = useState<FormMode>('view');
  const [selectedProspecto, setSelectedProspecto] = useState<Prospecto | undefined>();
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [solicitudView, setSolicitudView] = useState<SolicitudView>('dashboard');
  const [solicitudActivacionView, setSolicitudActivacionView] = useState<SolicitudView>('dashboard');
  const [solicitudes, setSolicitudes] = useState<SolicitudCredito[]>(solicitudesCredito);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCredito | undefined>();
  const [creditoView, setCreditoView] = useState<CreditoView>('dashboard');
  const [creditoFormMode, setCreditoFormMode] = useState<FormMode>('view');
  const [selectedCredito, setSelectedCredito] = useState<Credito | undefined>();
  const [creditos, setCreditos] = useState<Credito[]>(creditosData);
  const [inversiones, setInversiones] = useState<Inversion[]>(inversionesData);
  const [inversionView, setInversionView] = useState<InversionView>('list');
  const [inversionFormMode, setInversionFormMode] = useState<FormMode>('view');
  const [selectedInversion, setSelectedInversion] = useState<Inversion | undefined>();
  const [pldView, setPLDView] = useState<PLDView>('home');

  // ── Deep-link para navegar al módulo Cotizaciones con un ID específico ──
  const [cotizacionDeepLink, setCotizacionDeepLink] = useState<{ id: string; linea: string } | null>(null);
  const [solicitudDeepLink, setSolicitudDeepLink] = useState<{ dbId: string; noSol: string; fromClienteId?: string } | null>(null);

  // ── Datos de cotización para pre-llenar nueva solicitud (flujo Cotización → Solicitud) ──
  const [cotizacionParaSolicitud, setCotizacionParaSolicitud] = useState<any>(null);

  const handleNavigateToCotizacion = (cotizacionId: string, linea: string) => {
    console.log(`[App] Navegando a Cotizaciones → id=${cotizacionId}, línea=${linea}`);
    setCotizacionDeepLink({ id: cotizacionId, linea });
    setCurrentModule('cotizaciones');
  };

  const handleNavigateToSolicitud = (solicitudId: string, noSol: string, fromClienteId?: string) => {
    console.log(`[App] Navegando a Solicitudes → dbId=${solicitudId}, noSol=${noSol}, fromClienteId=${fromClienteId}`);
    setSolicitudDeepLink({ dbId: solicitudId, noSol, fromClienteId });
    setCurrentModule('solicitudes-creditos');
    setSolicitudView('list');
  };

  /** Flujo "Crear Solicitud desde Cotización" — spec solicitudes-financieras §1–§4 */
  const handleCrearSolicitudDesdeCotizacion = (cotizacionData: any) => {
    console.log('[App] Crear Solicitud desde Cotización:', cotizacionData);
    setCotizacionParaSolicitud(cotizacionData);
    setCurrentModule('solicitudes-creditos');
    setSolicitudView('list');
  };

  // Hook para consultar J_PRODUCTOS tipo=Credito cuando el subtab producto-credito está activo
  const isProductoCreditoTabActive = currentModule === 'productos' && productoTab === 'producto-credito' && currentView === 'list';
  const { productos: productosCreditoDB, loading: loadingProductosCredito, error: errorProductosCredito, refetch: refetchProductosCredito } = useProductosCredito(isProductoCreditoTabActive);

  // Hook para consultar J_PRODUCTOS type='Seguro' cuando el subtab seguros está activo
  const isSegurosTabActive = currentModule === 'productos' && productoTab === 'seguros' && currentView === 'list';
  const { productos: productosSegurosDB, loading: loadingSeguros, error: errorSeguros, refetch: refetchSeguros } = useProductosSeguros(isSegurosTabActive);

  // Hook para consultar J_PRODUCTOS type='Captación' cuando el subtab captacion está activo
  const isCaptacionTabActive = currentModule === 'productos' && productoTab === 'captacion' && currentView === 'list';
  const { productos: productosCaptacionDB, loading: loadingCaptacion, error: errorCaptacion, refetch: refetchCaptacion } = useProductosCaptacionDB(isCaptacionTabActive);

  // Hook para consultar J_CLIENTES tipo IN ('Contacto','Prospecto') cuando el módulo Prospectos está activo
  const isProspectosActive = currentModule === 'prospectos' && (prospectoView === 'list' || prospectoView === 'dashboard');
  const { prospectos: prospectosDB, loading: loadingProspectos, error: errorProspectos, refetch: refetchProspectos, queryMethod: prospectosQueryMethod } = useProspectosDB(isProspectosActive);

  // J_CLIENTES es la fuente de verdad para la Lista de Prospectos.
  // El hook trae TODOS los registros; el filtro por type se hace aquí en la UI.
  const prospectosFiltered = prospectosDB.filter(p => p.categoria === 'Prospecto' || p.categoria === 'Contacto');

  // Hook para consultar J_CLIENTES (TODOS los registros, SIN FILTRO) vía /clientes-lista-todos
  const isClientesListActive = currentModule === 'clientes' && (clienteView === 'list' || clienteView === 'dashboard');
  const { clientes: clientesDB, loading: loadingClientes, error: errorClientes, warning: warningClientes, backendStatus: backendStatusClientes, diagnostico: diagnosticoClientes, refetch: refetchClientes } = useClientesDB(isClientesListActive);

  // Hook para consultar J_SOLICITUDES_ACTIVACION cuando el módulo está activo en dashboard
  const isSolicActivacionActive = currentModule === 'solicitudes-activacion' && solicitudActivacionView === 'dashboard';
  const { solicitudesActivacion: solicitudesActivacionDB, loading: loadingSolicActivacion } = useSolicitudesActivacionDB(isSolicActivacionActive);

  const handleLogin = () => {
    setIsAuthenticated(true);
    toast.success('Bienvenido al sistema', {
      description: 'Sesión iniciada correctamente',
    });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setShowUserMenu(false);
    toast.success('Sesión cerrada', {
      description: 'Has cerrado sesión correctamente',
    });
  };

  const handleNewProduct = () => {
    setFormMode('create');
    // Crear un producto temporal con la línea de producto pre-seleccionada según el tab activo
    const lineaProducto = productoTab === 'captacion' ? 'Captación' : productoTab === 'seguros' ? 'Seguros' : 'Crédito';
    const selectedOrg = organizations.find((org) => org.name === currentUser.organization);
    
    // Calcular el siguiente valor de clave para productos de Crédito
    let nextClave = 14246; // Valor inicial
    if (lineaProducto === 'Crédito') {
      const creditProducts = products.filter(p => p.lineaProducto === 'Crédito' && p.clave);
      if (creditProducts.length > 0) {
        const maxClave = Math.max(...creditProducts.map(p => p.clave || 0));
        nextClave = maxClave + 1;
      }
    }
    
    // Calcular la siguiente clave PC-XXX para productos de Captación
    let nextClaveCaptacion = 'PC-003';
    if (productoTab === 'captacion') {
      const existing = productosCaptacionDB
        .map(p => {
          const m = String(p.clave || '').match(/^PC-(\d+)$/);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter(n => n > 0);
      const maxNum = existing.length > 0 ? Math.max(...existing) : 2;
      nextClaveCaptacion = `PC-${String(maxNum + 1).padStart(3, '0')}`;
    }
    
    const tempProduct: Product = {
      id: nextId,
      nombre: '',
      descripcion: '',
      lineaProducto: lineaProducto,
      sublineaProducto: '',
      sucursal: currentUser.organization,
      estatus: 'Pendiente',
      fechaRegistro: new Date().toISOString(),
      moneda: selectedOrg?.currency || 'MXN',
      usuarioRegistro: currentUser.name,
      puestoTrabajo: currentUser.workPosition,
      tipoTasa: 'Fija',
      baseCalculo: '360',
      aplicaInteresMoratorio: false,
      // Campos específicos de Captación (solo si es Captación)
      ...(productoTab === 'captacion' && {
        clave: nextClaveCaptacion,
      }),
      // Campos específicos de Línea de Crédito (solo si es Crédito)
      ...(lineaProducto === 'Crédito' && {
        clave: nextClave,
        claveEBS: `EBS-${nextClave}`,
        vddRowId: 'VDD-001',
        tipoProducto: 'Línea de Crédito',
        opcionCompra: 'Si',
        porcentajeOpcionCompra: 15,
        tasaBase: 8.5,
        subTipo: 'Cuenta Corriente',
        nombreEquipoAnalista: 'ANALISIS DE CREDITO',
        nombreEquipoAnalistaMesa: 'MESA DE CONTROL',
        tipoLinea: 'Revolvente',
        montoMinimo: 5000,
        montoMaximo: 150000000,
        permiteSobregiros: true,
        tipoSobregiro: 'Porcentaje',
        montoPorcentajeSobregiro: 0,
        numDisposicionesAbiertas: 3,
        intervaloCleanUp: 0,
        verificacionCleanUp: false,
        porcentajeComisionApertura: 0,
        plazoMinimoDisposicion: 4,
        plazoMaximoDisposicion: 45,
        diasGraciaDisposicion: 0,
        vigenciaLineaDias: 365,
        porcentajeInteresMoratorio: 0,
        diasParaRenovacion: 17,
      }),
    };
    
    setSelectedProduct(tempProduct);
    setCurrentView('form');
  };

  const handleEditProduct = (product: Product) => {
    setFormMode('edit');
    setSelectedProduct(product);
    setCurrentView('form');
  };

  const handleViewProduct = (product: Product) => {
    setFormMode('view');
    setSelectedProduct(product);
    setCurrentView('form');
  };

  const handleSaveProduct = (product: Product) => {
    setIsRefreshing(true);
    
    if (formMode === 'create') {
      // Captación se rehidrata desde Supabase (refetch), no se acumula en state local
      if (productoTab !== 'captacion') {
        setProducts((prev) => [...prev, product]);
      }
      toast.success('Producto creado exitosamente', {
        description: `El producto "${product.nombre}" ha sido registrado.`,
      });
    } else if (formMode === 'edit') {
      if (productoTab !== 'captacion') {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? product : p))
        );
      }
      toast.success('Producto actualizado', {
        description: `Los cambios en "${product.nombre}" han sido guardados.`,
      });
    }
    
    // Limpiar sessionStorage después de guardar exitosamente
    const storageKey = `producto_captacion_${product.id || 'nuevo'}`;
    try {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(`${storageKey}_active_tab`);
    } catch (error) {
      console.error('Error limpiando sessionStorage:', error);
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
      setCurrentView('list');
      // Refetch desde J_PRODUCTOS para reflejar los cambios en BD
      if (productoTab === 'producto-credito') {
        setTimeout(() => {
          refetchProductosCredito();
        }, 500);
      }
      if (productoTab === 'captacion') {
        setTimeout(() => {
          refetchCaptacion();
        }, 500);
      }
      if (productoTab === 'seguros') {
        setTimeout(() => {
          refetchSeguros();
        }, 500);
      }
    }, 1500);
  };

  const handleCancel = () => {
    setCurrentView('list');
    setSelectedProduct(undefined);
    setClienteView('list');
    setProspectoView('list');
    setSolicitudView('list');
  };

  const handleModuleChange = (module: Module) => {
    setCurrentModule(module);
    setCurrentView('list');
    setSelectedProduct(undefined);
    // Si cambiamos al módulo de clientes, mostrar el dashboard
    if (module === 'clientes') {
      setClienteView('dashboard');
    } else {
      setClienteView('list');
    }
    // Si cambiamos al módulo de prospectos, mostrar el dashboard
    if (module === 'prospectos') {
      setProspectoView('dashboard');
    } else {
      setProspectoView('list');
    }
    // Si cambiamos al módulo de solicitudes de crédito, mostrar el dashboard
    if (module === 'solicitudes-creditos') {
      setSolicitudView('dashboard');
    } else {
      setSolicitudView('list');
    }
    // Si cambiamos al módulo de solicitudes de activación, mostrar el dashboard
    if (module === 'solicitudes-activacion') {
      setSolicitudActivacionView('dashboard');
    } else {
      setSolicitudActivacionView('list');
    }
  };

  const handleNewCliente = () => {
    setClienteFormMode('create');
    setSelectedCliente(undefined);
    setClienteView('form');
  };

  const handleEditCliente = (cliente: any) => {
    setClienteFormMode('edit');
    setSelectedCliente(cliente);
    setClienteView('form');
  };

  const handleViewCliente = (cliente: any) => {
    setClienteFormMode('view');
    setSelectedCliente(cliente);
    setClienteView('form');
  };

  const handleDireccionCliente = () => {
    setClienteView('direccion');
  };

  const handleSaveCliente = (clienteData: any) => {
    setIsRefreshing(true);
    
    // ═══════════════════════════════════════════════════════════════
    // J_CLIENTES (Supabase) es la fuente de verdad.
    // AltaClienteDefault ya ejecutó syncToJClientes (INSERT/UPDATE).
    // NO actualizamos state local — refetch trae los datos reales.
    // ═══════════════════════════════════════════════════════════════
    if (clienteFormMode === 'create') {
      toast.success('Cliente creado exitosamente', {
        description: `El cliente "${clienteData.nombre || 'Nuevo Cliente'}" ha sido registrado en J_CLIENTES.`,
      });
    } else if (clienteFormMode === 'edit') {
      toast.success('Cliente actualizado', {
        description: `Los cambios en "${clienteData.nombre || ''}" han sido guardados en J_CLIENTES.`,
      });
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
      setClienteView('list');
      // Refetch desde J_CLIENTES para reflejar los cambios en BD
      setTimeout(() => {
        refetchClientes();
      }, 500);
    }, 1500);
  };

  const handleNewProspecto = () => {
    setProspectoFormMode('create');
    setSelectedProspecto(undefined);
    setProspectoView('form');
  };

  const handleEditProspecto = (prospecto: Prospecto) => {
    setProspectoFormMode('edit');
    setSelectedProspecto(prospecto);
    setProspectoView('form');
  };

  const handleViewProspecto = (prospecto: Prospecto) => {
    setProspectoFormMode('view');
    setSelectedProspecto(prospecto);
    setProspectoView('form');
  };

  const handleDeleteProspecto = async (prospecto: Prospecto) => {
    if (!prospecto.dbUuid) {
      toast.error('No se puede eliminar', { description: 'Este registro no tiene UUID de J_CLIENTES.' });
      return;
    }
    const confirmDelete = window.confirm(
      `¿Eliminar el prospecto "${prospecto.nombre}" (ID: ${prospecto.dbUuid.substring(0, 8)}...)?\n\nEsta acción eliminará el registro de J_CLIENTES y no se puede deshacer.`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9/clientes/${prospecto.dbUuid}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        }
      );
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success('Prospecto eliminado', {
          description: `"${prospecto.nombre}" ha sido eliminado de J_CLIENTES.`,
        });
        refetchProspectos();
      } else {
        toast.error('Error al eliminar', { description: result.error || `HTTP ${res.status}` });
      }
    } catch (err) {
      console.error('[handleDeleteProspecto] Error:', err);
      toast.error('Error de conexión al eliminar prospecto', { description: String(err) });
    }
  };

  const handleSaveProspecto = (prospectoData: any) => {
    setIsRefreshing(true);
    
    // ═══════════════════════════════════════════════════════════════════
    // J_CLIENTES (Supabase) es la fuente de verdad.
    // NO agregamos/actualizamos el state local `prospectos` porque:
    //   - CREATE: syncToJClientes ya hizo POST → refetch trae el registro con dbUuid
    //   - EDIT:   syncToJClientes ya hizo PUT  → refetch trae el registro actualizado
    // Duplicar en state local causaba que el merge (DB + local sin dbUuid) mostrara
    // el mismo registro dos veces con IDs diferentes.
    // ═══════════════════════════════════════════════════════════════════
    if (prospectoFormMode === 'create') {
      toast.success('Prospecto creado exitosamente', {
        description: `El prospecto "${prospectoData.nombre}" ha sido registrado en J_CLIENTES.`,
      });
    } else if (prospectoFormMode === 'edit') {
      toast.success('Prospecto actualizado', {
        description: `Los cambios en "${prospectoData.nombre}" han sido guardados en J_CLIENTES.`,
      });
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
      setProspectoView('list');
      // Refetch desde J_CLIENTES para reflejar los cambios en BD
      setTimeout(() => {
        refetchProspectos();
      }, 500);
    }, 1500);
  };

  const handleNewCredito = () => {
    setCreditoFormMode('create');
    setSelectedCredito(undefined);
    setCreditoView('form');
  };

  const handleEditCredito = (credito: Credito) => {
    setCreditoFormMode('edit');
    setSelectedCredito(credito);
    setCreditoView('form');
  };

  const handleViewCredito = (credito: Credito) => {
    setCreditoFormMode('view');
    setSelectedCredito(credito);
    setCreditoView('form');
  };

  const handleSaveCredito = (creditoData: any) => {
    setIsRefreshing(true);
    toast.success('Crédito guardado', {
      description: 'El crédito ha sido guardado exitosamente.',
    });
    
    setTimeout(() => {
      setIsRefreshing(false);
      setCreditoView('list');
    }, 1500);
  };

  const handleNewInversion = () => {
    setInversionFormMode('create');
    setSelectedInversion(undefined);
    setInversionView('form');
  };

  const handleEditInversion = (inversion: Inversion) => {
    setInversionFormMode('edit');
    setSelectedInversion(inversion);
    setInversionView('form');
  };

  const handleViewInversion = (inversion: Inversion) => {
    setInversionFormMode('view');
    setSelectedInversion(inversion);
    setInversionView('form');
  };

  const handleSaveInversion = (inversionData: any) => {
    setIsRefreshing(true);
    
    if (inversionFormMode === 'create') {
      const newInversion: Inversion = {
        id: inversiones.length > 0 ? Math.max(...inversiones.map(i => i.id)) + 1 : 1,
        noCuentaInversion: `INV-${String(inversiones.length + 1).padStart(6, '0')}`,
        cliente: inversionData.cliente || 'Nuevo Cliente',
        fechaInicio: inversionData.fechaInicio || new Date().toLocaleDateString('es-MX'),
        fechaFin: inversionData.fechaVencimiento || '',
        montoPagare: parseFloat(inversionData.montoInversion) || 0,
        montoIntereses: 0,
        producto: inversionData.producto || '',
        lineaProducto: inversionData.lineaProducto || '',
        sublinea: inversionData.sublinea || '',
        cuentaPago: inversionData.cuentaPago || '',
      };
      setInversiones(prev => [...prev, newInversion]);
      toast.success('Inversión creada exitosamente', {
        description: `La inversión "${newInversion.noCuentaInversion}" ha sido registrada.`,
      });
    } else if (inversionFormMode === 'edit') {
      setInversiones(prev =>
        prev.map(i =>
          i.id === selectedInversion?.id
            ? {
                ...i,
                cliente: inversionData.cliente || i.cliente,
                fechaInicio: inversionData.fechaInicio || i.fechaInicio,
                fechaFin: inversionData.fechaVencimiento || i.fechaFin,
                montoPagare: parseFloat(inversionData.montoInversion) || i.montoPagare,
                producto: inversionData.producto || i.producto,
                lineaProducto: inversionData.lineaProducto || i.lineaProducto,
                sublinea: inversionData.sublinea || i.sublinea,
                cuentaPago: inversionData.cuentaPago || i.cuentaPago,
              }
            : i
        )
      );
      toast.success('Inversión actualizada', {
        description: `Los cambios en la inversión han sido guardados.`,
      });
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
      setInversionView('list');
    }, 1500);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    toast.info('Actualizando datos...');
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Datos actualizados correctamente');
    }, 2000);
  };

  // CRÍTICO: Usar useMemo para evitar recálculos en cada render
  const nextId = useMemo(() => {
    return Math.max(...products.map((p) => p.id), 0) + 1;
  }, [products]);

  // ── Detectar si ya existe un producto de Captación con Cuenta Eje activada ──
  const cuentaEjeExistente = useMemo(() => {
    const prod = productosCaptacionDB.find(p => p.cuentaEje === true);
    if (!prod) return null;
    return {
      productoNombre: prod.producto || prod.nombre || '(sin nombre)',
      productoClave: prod.clave || '(sin clave)',
      productoDbUuid: prod.dbUuid || prod.identificacion || '',
    };
  }, [productosCaptacionDB]);

  const nextProspectoId = useMemo(() => {
    // Extraer el mayor consecutivo numérico de los idProspecto existentes (PROS-XXX)
    let maxNum = 0;
    for (const p of prospectosDB) {
      const id = p.idProspecto || '';
      const match = id.match(/^PROS-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `PROS-${String(maxNum + 1).padStart(3, '0')}`;
  }, [prospectosDB]);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} />
        <Toaster position="top-right" />
      </>
    );
  }

  const navigationTabs = [
    { id: 'configuracion', label: 'Configuración' },
    { id: 'productos', label: 'Productos' },
    { id: 'garantias', label: 'Garantías' },
    { id: 'prospectos', label: 'Prospectos' },
    { id: 'clientes', label: 'Clientes' },
    { id: 'cotizaciones', label: 'Cotizaciones' },
    { id: 'cuentas-ahorro', label: 'Cuentas ahorro' },
    { id: 'solicitudes-creditos', label: 'Solicitudes' },
    { id: 'solicitudes-activacion', label: 'Sol. Activación' },
    { id: 'originacion', label: 'Originación' },
    { id: 'creditos', label: 'Créditos' },
    { id: 'inversiones', label: 'Inversiones' },
    { id: 'pld', label: 'PLD' },
    { id: 'pagos-referenciados', label: 'Pagos Referenciados' },
    { id: 'casos-cobranza', label: 'Casos de Cobranza' },
    { id: 'cobranza', label: 'Cobranza' },
    { id: 'avisos-vencimiento', label: 'Avisos de Vencimiento' },
    { id: 'cartera-credito', label: 'Cartera crédito' },
    { id: 'cartera-inversion', label: 'Cartera inversión' },
    { id: 'cartera-ahorro', label: 'Cartera ahorro' },
    { id: 'ejec-reportes', label: 'Ejec. Reportes Regulatorios' },
    { id: 'polizas-contables', label: 'Pólizas Contables' },
    { id: 'gestion-riesgos', label: 'Gestión de Riesgos' },
    { id: 'une', label: 'UNE — Quejas y Reclamaciones' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Refresh Overlay con blur y spinner */}
      {isRefreshing && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-4">
            <div className="animate-spin">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="#E0E0E0" strokeWidth="4"/>
                <path d="M24 4a20 20 0 0115.5 32.4" stroke="var(--theme-primary)" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-gray-700 font-medium">Actualizando datos...</p>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-300">
        <div className="px-4 py-2 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <img src={efinanciaLogo} alt="eFinanciaN@t" className="h-12" />
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar"
                className="w-full px-3 py-1.5 border border-gray-400 rounded text-sm"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="2">
                  <circle cx="7" cy="7" r="5"/>
                  <path d="M11 11l3 3"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <button className="flex items-center gap-1.5 hover:text-gray-900">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6.5"/>
                <text x="8" y="11" fontSize="9" fontWeight="bold" textAnchor="middle" fill="currentColor">?</text>
              </svg>
              <span>Ayuda</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-gray-900">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="12" height="10" rx="1"/>
                <path d="M2 6h12"/>
                <path d="M5 3v3M11 3v3"/>
              </svg>
              <span>Comentarios</span>
            </button>
            <div className="relative">
              <button
                className="flex items-center gap-1.5 hover:text-gray-900"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="5" r="3"/>
                  <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5"/>
                </svg>
                <div className="flex flex-col items-start">
                  <span className="text-xs leading-tight">Administrador</span>
                  <span className="text-[10px] text-gray-500 leading-tight">admin</span>
                </div>
              </button>
              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-[160px]">
                    <button
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      onClick={handleLogout}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6"/>
                      </svg>
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div 
        className="text-white border-b"
        style={{
          backgroundColor: 'var(--theme-primary)',
          borderBottomColor: 'var(--theme-secondary)',
        }}
      >
        <div className="px-4 flex items-center gap-2">
          {/* Left Icons */}
          <div className="flex items-center gap-1.5 py-2">
            <button 
              onClick={handleRefresh}
              className="p-1 hover:bg-white/10 rounded transition-all" 
              title="Refrescar"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M15 9a6 6 0 11-6-6V1m0 2l2-2-2-2"/>
                <path d="M9 3a6 6 0 106 6"/>
              </svg>
            </button>
            <button className="p-1 hover:bg-white/10 rounded" title="Favoritos">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 2l2 5h5l-4 3.5 1.5 5.5-4.5-3-4.5 3 1.5-5.5-4-3.5h5z"/>
              </svg>
            </button>
            <button 
              onClick={() => handleModuleChange('dashboard')}
              className={`p-1 rounded transition-all ${
                currentModule === 'dashboard' ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
              title="Ir a Dashboard (Inicio)"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 9l7-6 7 6v7a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>
                <path d="M7 16v-6h4v6"/>
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center overflow-x-auto">
            {navigationTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleModuleChange(tab.id as Module)}
                className={`px-4 py-2.5 text-xs whitespace-nowrap transition-colors ${
                  currentModule === tab.id
                    ? 'bg-white font-medium'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
                style={currentModule === tab.id ? {
                  color: 'var(--theme-primary)',
                } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main>
        {currentModule === 'dashboard' ? (
          <Dashboard onNavigateToModule={(moduleId) => handleModuleChange(moduleId as Module)} />
        ) : currentModule === 'productos' ? (
          <>
            {/* Subnavegación interna del módulo Productos */}
            <div className="bg-gray-100 border-b border-gray-300">
              <div className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setProductoTab('producto-credito');
                      setCurrentView('list');
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      currentView === 'list' && productoTab === 'producto-credito'
                        ? 'tab-active'
                        : 'tab-inactive'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3h10M3 8h10M3 13h10"/>
                    </svg>
                    <span>Productos Crédito</span>
                  </button>
                  <button
                    onClick={() => {
                      setProductoTab('captacion');
                      setCurrentView('list');
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      currentView === 'list' && productoTab === 'captacion'
                        ? 'tab-active'
                        : 'tab-inactive'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3h10M3 8h10M3 13h10"/>
                    </svg>
                    <span>Productos Captación</span>
                  </button>
                  <button
                    onClick={() => {
                      setProductoTab('credito');
                      setCurrentView('list');
                      setLineaCreditoView('list');
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      lineaCreditoView === 'list' && productoTab === 'credito'
                        ? 'tab-active'
                        : 'tab-inactive'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3h10M3 8h10M3 13h10"/>
                    </svg>
                    <span>Productos Linea de Crédito</span>
                  </button>
                  <button
                    onClick={() => {
                      setProductoTab('seguros');
                      setCurrentView('list');
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      (currentView === 'list' || currentView === 'form') && productoTab === 'seguros'
                        ? 'tab-active'
                        : 'tab-inactive'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 1.5L2 4v4.5c0 3.5 2.5 5.5 6 7 3.5-1.5 6-3.5 6-7V4L8 1.5z"/>
                    </svg>
                    <span>Productos Seguros</span>
                  </button>
                  
                  {/* Tab dinámico que muestra el modo actual */}
                  {(currentView === 'form' || (productoTab === 'credito' && lineaCreditoView === 'form')) && (
                    <button
                      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-active"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        {(productoTab === 'credito' ? lineaCreditoFormMode : formMode) === 'create' ? (
                          <path d="M8 3v10M3 8h10"/>
                        ) : (productoTab === 'credito' ? lineaCreditoFormMode : formMode) === 'edit' ? (
                          <path d="M3 13l8-8 2 2-8 8H3v-2z"/>
                        ) : (
                          <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zM4 8h8M6 4v8"/>
                        )}
                      </svg>
                      <span>
                        {(productoTab === 'credito' ? lineaCreditoFormMode : formMode) === 'create' ? `Nuevo Producto ${productoTab === 'captacion' ? 'Captación' : productoTab === 'producto-credito' ? 'Crédito' : productoTab === 'seguros' ? 'Seguros' : 'Línea de Crédito'}` : 
                         (productoTab === 'credito' ? lineaCreditoFormMode : formMode) === 'edit' ? `Editar Producto ${productoTab === 'captacion' ? 'Captación' : productoTab === 'producto-credito' ? 'Crédito' : productoTab === 'seguros' ? 'Seguros' : 'Línea de Crédito'}` : 
                         `Ver Producto ${productoTab === 'captacion' ? 'Captación' : productoTab === 'producto-credito' ? 'Crédito' : productoTab === 'seguros' ? 'Seguros' : 'Línea de Crédito'}`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Contenido del módulo */}
            {productoTab === 'credito' ? (
              <ProductosLineaCreditoModule 
                onViewChange={setLineaCreditoView}
                onModeChange={setLineaCreditoFormMode}
              />
            ) : currentView === 'list' ? (
              productoTab === 'producto-credito' ? (
                <>
                  {/* Estado de carga y error para Productos Crédito desde J_PRODUCTOS */}
                  {loadingProductosCredito && (
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-700 text-sm flex items-center gap-2">
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="#3B82F6" strokeWidth="2" opacity="0.3"/>
                        <path d="M8 2a6 6 0 014.9 9.4" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Consultando J_PRODUCTOS tipo=Credito...
                    </div>
                  )}
                  {errorProductosCredito && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center justify-between">
                      <span>Error: {errorProductosCredito}</span>
                      <button onClick={refetchProductosCredito} className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-xs font-medium">Reintentar</button>
                    </div>
                  )}
                  <ProductosList
                    products={productosCreditoDB}
                    tipoProducto="producto-credito"
                    onNew={handleNewProduct}
                    onEdit={handleEditProduct}
                    onView={handleViewProduct}
                    loading={loadingProductosCredito}
                    error={errorProductosCredito}
                    onRefetch={refetchProductosCredito}
                  />
                </>
              ) : productoTab === 'captacion' ? (
                <>
                  {loadingCaptacion && (
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-700 text-sm flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      Cargando productos de captacion desde J_PRODUCTOS...
                    </div>
                  )}
                  {errorCaptacion && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center justify-between">
                      <span>Error: {errorCaptacion}</span>
                      <button onClick={() => refetchCaptacion()} className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-xs font-medium">Reintentar</button>
                    </div>
                  )}
                  <ProductosList
                    products={productosCaptacionDB}
                    tipoProducto="captacion"
                    onNew={handleNewProduct}
                    onEdit={handleEditProduct}
                    onView={handleViewProduct}
                    loading={loadingCaptacion}
                    error={errorCaptacion}
                    onRefetch={() => refetchCaptacion()}
                  />
                </>
              ) : productoTab === 'seguros' ? (
                <>
                  {errorSeguros && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center justify-between">
                      <span>Error: {errorSeguros}</span>
                      <button onClick={() => refetchSeguros()} className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-xs font-medium">Reintentar</button>
                    </div>
                  )}
                  <ProductosList
                    products={productosSegurosDB}
                    tipoProducto="seguros"
                    onNew={handleNewProduct}
                    onEdit={handleEditProduct}
                    onView={handleViewProduct}
                    loading={loadingSeguros}
                    error={errorSeguros}
                    onRefetch={() => refetchSeguros()}
                  />
                </>
              ) : (
                <ProductosList
                  products={products}
                  tipoProducto={productoTab}
                  onNew={handleNewProduct}
                  onEdit={handleEditProduct}
                  onView={handleViewProduct}
                />
              )
            ) : (
              productoTab === 'captacion' ? (
                <ProductoCaptacionForm
                  mode={formMode === 'create' ? 'nuevo' : formMode === 'edit' ? 'editar' : 'ver'}
                  productoId={selectedProduct?.id}
                  producto={selectedProduct}
                  onCancel={handleCancel}
                  onSave={handleSaveProduct}
                  cuentaEjeExistente={cuentaEjeExistente}
                />
              ) : (
                <ProductoForm
                  mode={formMode}
                  product={selectedProduct}
                  onSave={handleSaveProduct}
                  onCancel={handleCancel}
                  nextId={nextId}
                  linea={productoTab === 'seguros' ? 'Seguros' : undefined}
                />
              )
            )}
          </>
        ) : currentModule === 'garantias' ? (
          <Garantias />
        ) : currentModule === 'clientes' ? (
          <>
            {/* Subnavegación interna del módulo Clientes */}
            <div className="bg-gray-100 border-b border-gray-300">
              <div className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setClienteView('dashboard')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      clienteView === 'dashboard'
                        ? 'tab-active'
                        : 'tab-inactive'
                    }`}
                    title="Dashboard de Clientes"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>
                      <path d="M6 14v-5h4v5"/>
                    </svg>
                    <span>Inicio</span>
                  </button>
                  <button
                    onClick={() => setClienteView('list')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      clienteView === 'list'
                        ? 'tab-active'
                        : 'tab-inactive'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3h10M3 8h10M3 13h10"/>
                    </svg>
                    <span>Lista de Clientes</span>
                  </button>
                  
                  {/* Tab dinámico que muestra el modo actual */}
                  {clienteView === 'form' && (
                    <button
                      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-active"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        {clienteFormMode === 'create' ? (
                          <path d="M8 3v10M3 8h10"/>
                        ) : clienteFormMode === 'edit' ? (
                          <path d="M3 13l8-8 2 2-8 8H3v-2z"/>
                        ) : (
                          <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zM4 8h8M6 4v8"/>
                        )}
                      </svg>
                      <span>
                        {clienteFormMode === 'create' ? 'Nuevo Cliente' : 
                         clienteFormMode === 'edit' ? 'Editar Cliente' : 
                         'Ver Cliente'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Botón de acción solo visible en Dashboard y Lista */}
                {(clienteView === 'dashboard' || clienteView === 'list') && (
                  <></>
                )}
              </div>
            </div>

            {/* Contenido del módulo */}
            {clienteView === 'dashboard' ? (
              <ClientesDashboard
                clientes={clientesDB}
                onNew={handleNewCliente}
                onEdit={handleEditCliente}
                onView={handleViewCliente}
                onClientesChange={setClientes}
              />
            ) : clienteView === 'list' ? (
              <ClientesList
                clientes={clientesDB}
                loading={loadingClientes}
                error={errorClientes}
                warning={warningClientes}
                backendStatus={backendStatusClientes}
                diagnostico={diagnosticoClientes}
                onRefresh={refetchClientes}
                onNew={handleNewCliente}
                onEdit={handleEditCliente}
                onView={handleViewCliente}
              />
            ) : clienteView === 'form' ? (
              <AltaClienteDefault
                mode={clienteFormMode === 'create' ? 'nuevo' : clienteFormMode === 'edit' ? 'editar' : 'ver'}
                cliente={selectedCliente}
                onBack={handleCancel}
                onSave={handleSaveCliente}
                onNavigateToCotizacion={handleNavigateToCotizacion}
                onNavigateToSolicitud={handleNavigateToSolicitud}
              />
            ) : (
              <ClienteDireccionForm
                onBack={handleCancel}
              />
            )}
          </>
        ) : currentModule === 'prospectos' ? (
          <>
            {/* Subnavegación interna del módulo Prospectos */}
            <div className="bg-gray-100 border-b border-gray-300">
              <div className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setProspectoView('dashboard')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      prospectoView === 'dashboard'
                        ? 'tab-active'
                        : 'tab-inactive'
                    }`}
                    title="Dashboard de Prospectos"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>
                      <path d="M6 14v-5h4v5"/>
                    </svg>
                    <span>Inicio</span>
                  </button>
                  <button
                    onClick={() => setProspectoView('list')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      prospectoView === 'list'
                        ? 'tab-active'
                        : 'tab-inactive'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3h10M3 8h10M3 13h10"/>
                    </svg>
                    <span>Lista de Prospectos</span>
                  </button>
                  
                  {/* Tab dinámico que muestra el modo actual */}
                  {prospectoView === 'form' && (
                    <button
                      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-active"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        {prospectoFormMode === 'create' ? (
                          <path d="M8 3v10M3 8h10"/>
                        ) : prospectoFormMode === 'edit' ? (
                          <path d="M3 13l8-8 2 2-8 8H3v-2z"/>
                        ) : (
                          <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zM4 8h8M6 4v8"/>
                        )}
                      </svg>
                      <span>
                        {prospectoFormMode === 'create' ? 'Nuevo Prospecto' : 
                         prospectoFormMode === 'edit' ? 'Editar Prospecto' : 
                         'Ver Prospecto'}
                      </span>
                    </button>
                  )}
                </div>
                
                {/* Botón de acción solo visible en Dashboard y Lista */}
                {(prospectoView === 'dashboard' || prospectoView === 'list') && (
                  <></>
                )}
              </div>
            </div>

            {/* Contenido del módulo */}
            {prospectoView === 'dashboard' ? (
              <ProspectosDashboard
                prospectos={prospectosFiltered}
                onNew={handleNewProspecto}
                onEdit={handleEditProspecto}
                onView={handleViewProspecto}
                onProspectosChange={setProspectos}
              />
            ) : prospectoView === 'list' ? (
              <ProspectosList
                prospectos={prospectosFiltered}
                onNew={handleNewProspecto}
                onEdit={handleEditProspecto}
                onView={handleViewProspecto}
                onProspectosChange={setProspectos}
                loading={loadingProspectos}
                error={errorProspectos}
                onRefetch={refetchProspectos}
                queryMethod={prospectosQueryMethod}
              />
            ) : (
              <ProspectoForm
                mode={prospectoFormMode}
                prospecto={selectedProspecto}
                onSave={handleSaveProspecto}
                onBack={handleCancel}
                nextId={nextProspectoId}
              />
            )}
          </>
        ) : currentModule === 'cotizaciones' ? (
          <CotizacionesModule
            deepLinkCotizacionId={cotizacionDeepLink?.id}
            deepLinkLinea={cotizacionDeepLink?.linea}
            onDeepLinkConsumed={() => setCotizacionDeepLink(null)}
            onCrearSolicitudDesdeCotizacion={handleCrearSolicitudDesdeCotizacion}
          />
        ) : currentModule === 'solicitudes-creditos' ? (
          <>
            {/* Subnavegación interna del módulo Solicitudes */}
            <div className="bg-gray-100 border-b border-gray-300">
              <div className="px-6 py-3 flex items-center gap-4">
                <button
                  onClick={() => setSolicitudView('dashboard')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                    solicitudView === 'dashboard' ? 'tab-active' : 'tab-inactive'
                  }`}
                  title="Dashboard de Solicitudes"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>
                    <path d="M6 14v-5h4v5"/>
                  </svg>
                  <span>Inicio</span>
                </button>
                <button
                  onClick={() => setSolicitudView('list')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                    solicitudView === 'list' ? 'tab-active' : 'tab-inactive'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3h10M3 8h10M3 13h10"/>
                  </svg>
                  <span>Lista de Solicitudes</span>
                </button>
              </div>
            </div>

            {/* Contenido del módulo */}
            {solicitudView === 'dashboard' ? (
              <SolicitudesDashboard
                solicitudes={SOLICITUDES_LISTA}
                onGoToList={() => setSolicitudView('list')}
              />
            ) : (
              <SolicitudCreditoList
                cotizacionParaSolicitud={cotizacionParaSolicitud}
                onCotizacionConsumed={() => setCotizacionParaSolicitud(null)}
                solicitudDeepLink={solicitudDeepLink}
                onSolicitudDeepLinkConsumed={() => setSolicitudDeepLink(null)}
                onBackToCliente={() => {
                  setCurrentModule('clientes');
                  setSolicitudView('dashboard');
                }}
              />
            )}
          </>
        ) : currentModule === 'solicitudes-activacion' ? (
          <>
            {/* Subnavegación interna del módulo Solicitudes de Activación */}
            <div className="bg-gray-100 border-b border-gray-300">
              <div className="px-6 py-3 flex items-center gap-4">
                <button
                  onClick={() => setSolicitudActivacionView('dashboard')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                    solicitudActivacionView === 'dashboard' ? 'tab-active' : 'tab-inactive'
                  }`}
                  title="Dashboard de Solicitudes de Activación"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>
                    <path d="M6 14v-5h4v5"/>
                  </svg>
                  <span>Inicio</span>
                </button>
                <button
                  onClick={() => setSolicitudActivacionView('list')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                    solicitudActivacionView === 'list' ? 'tab-active' : 'tab-inactive'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3h10M3 8h10M3 13h10"/>
                  </svg>
                  <span>Lista de Solicitudes</span>
                </button>
              </div>
            </div>

            {/* Contenido del módulo */}
            {solicitudActivacionView === 'dashboard' ? (
              <SolicitudActivacionDashboard
                solicitudes={solicitudesActivacionDB}
                loading={loadingSolicActivacion}
                onGoToList={() => setSolicitudActivacionView('list')}
              />
            ) : (
              <SolicitudActivacionList />
            )}
          </>
        ) : currentModule === 'originacion' ? (
          <OriginacionModule />
        ) : currentModule === 'creditos' ? (
          <CreditosModule />
        ) : currentModule === 'inversiones' ? (
          <InversionesModule />
        ) : currentModule === 'cuentas-ahorro' ? (
          <CuentasAhorroModule />
        ) : currentModule === 'avisos-vencimiento' ? (
          <AvisosVencimientoModule />
        ) : currentModule === 'pld' ? (
          <>
            {pldView === 'home' ? (
              <PLDHome onNavigate={(screen) => {
                if (screen === 'KYC') {
                  setPLDView('kyc');
                } else if (screen === 'Perfil Transaccional') {
                  setPLDView('perfil-transaccional');
                } else if (screen === 'Calificación Riesgo') {
                  setPLDView('calificacion-riesgo');
                } else if (screen === 'Alertas PLD') {
                  setPLDView('alertas-pld');
                } else if (screen === 'Alertas Internas') {
                  setPLDView('alertas-internas');
                } else if (screen === 'Parámetros PLD') {
                  setPLDView('parametros');
                } else if (screen === 'Catálogos PLD') {
                  setPLDView('catalogos');
                } else if (screen === 'Reportes CNBV') {
                  setPLDView('reportes-cnbv');
                }
              }} />
            ) : pldView === 'kyc' ? (
              <PLDKYCInfo onBack={() => setPLDView('home')} />
            ) : pldView === 'perfil-transaccional' ? (
              <PLDPerfilTransaccional mode="editar" onBack={() => setPLDView('home')} />
            ) : pldView === 'calificacion-riesgo' ? (
              <PLDCalificacionRiesgo onBack={() => setPLDView('home')} />
            ) : pldView === 'alertas-pld' ? (
              <PLDAlertasPLD onBack={() => setPLDView('home')} />
            ) : pldView === 'alertas-internas' ? (
              <PLDAlertasInternas onBack={() => setPLDView('home')} />
            ) : pldView === 'parametros' ? (
              <PLDParametros onBack={() => setPLDView('home')} />
            ) : pldView === 'catalogos' ? (
              <PLDCatalogos onBack={() => setPLDView('home')} />
            ) : pldView === 'reportes-cnbv' ? (
              <PLDReportesCNBV onBack={() => setPLDView('home')} />
            ) : null}
          </>
        ) : currentModule === 'configuracion' ? (
          <ConfiguracionModule />
        ) : currentModule === 'pagos-referenciados' ? (
          <PagosReferenciadosModule />
        ) : currentModule === 'casos-cobranza' ? (
          <CasosCobranzaModule />
        ) : currentModule === 'cobranza' ? (
          <CobranzaModule />
        ) : currentModule === 'cartera-credito' ? (
          <CarteraModule />
        ) : currentModule === 'cartera-inversion' ? (
          <AportacionesModule />
        ) : currentModule === 'cartera-ahorro' ? (
          <AportacionesModule />
        ) : currentModule === 'ejec-reportes' ? (
          <EjecReportesModule />
        ) : currentModule === 'polizas-contables' ? (
          <PolizasContablesModule />
        ) : currentModule === 'gestion-riesgos' ? (
          <GestionRiesgosModule />
        ) : currentModule === 'une' ? (
          <UNEHome />
        ) : (
          <div className="p-8 text-center text-gray-500">
            Módulo en desarrollo
          </div>
        )}
      </main>

      <Toaster position="top-right" />
    </div>
  );
}

export default function AppWithTheme() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}