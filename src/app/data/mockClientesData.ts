export interface Cliente {
  id: number;
  personalidad: 'Persona Física' | 'Persona Física c/Actividad empresarial' | 'Persona Moral';
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  nombreEmpresa?: string;
  sucursal: string;
  estatusSIC: 'Aprobado' | 'Pendiente' | 'Rechazado';
  estatusListaNegra: 'Limpio' | 'Pendiente' | 'Bloqueado';
  cuentaEje: string;
  saldo: number;
  fechaActivacion: string;
  estatusCliente: 'Activo' | 'Prospecto' | 'Inactivo';
  calificacionCliente: 'Oro' | 'Plata' | 'Bronce';
  
  // Datos adicionales
  rfc?: string;
  curp?: string;
  fechaNacimiento?: string;
  edad?: number;
  estadoCivil?: string;
  sexo?: 'Masculino' | 'Femenino';
  entidadNacimiento?: string;
  nivelEstudios?: string;
  lenguaje?: string;
  moneda?: string;
  
  // Contacto
  telefonoDomicilio?: string;
  telefonoOficina?: string;
  celular?: string;
  correoElectronico?: string;
  direccionPrincipal?: string;
  
  // Laborales
  tipoEmpleado?: string;
  nombreEmpresaTrabajo?: string;
  puestoDesempena?: string;
  ingresosMensuales?: number;
  otrosIngresos?: number;
  totalIngresos?: number;
  
  // Clasificación
  sector?: string;
  tipoGiro?: string;
  tipoIndustria?: string;
  giroEmpresa?: string;
  actividadEconomica?: string;
  sectorCNBV?: string;
  tamanoEmpresa?: string;
  numeroEmpleados?: number;
  numeroSucursales?: number;
  
  // Sistema
  usuarioRegistro: string;
  puestoTrabajo: string;
  fechaRegistro: string;
}

export const mockClientes: Cliente[] = [
  {
    id: 1,
    personalidad: 'Persona Física',
    nombre: 'Juan Carlos',
    apellidoPaterno: 'García',
    apellidoMaterno: 'López',
    nombreCompleto: 'Juan Carlos García López',
    sucursal: 'Matriz Centro',
    estatusSIC: 'Aprobado',
    estatusListaNegra: 'Limpio',
    cuentaEje: '0001-2345-6789-01',
    saldo: 250000.00,
    fechaActivacion: '2024-01-15T10:30:00',
    estatusCliente: 'Activo',
    calificacionCliente: 'Oro',
    rfc: 'GALJ850315HDF',
    curp: 'GALJ850315HDFPPR03',
    fechaNacimiento: '1985-03-15',
    edad: 38,
    estadoCivil: 'Casado',
    sexo: 'Masculino',
    entidadNacimiento: 'Ciudad de México',
    nivelEstudios: 'Licenciatura',
    lenguaje: 'Español',
    moneda: 'MXN',
    telefonoDomicilio: '5555-1234',
    celular: '5512345678',
    correoElectronico: 'juan.garcia@email.com',
    direccionPrincipal: 'Av. Reforma 123, Col. Centro, Ciudad de México',
    tipoEmpleado: 'Empleado',
    nombreEmpresaTrabajo: 'Tech Solutions SA',
    puestoDesempena: 'Gerente de Sistemas',
    ingresosMensuales: 45000,
    otrosIngresos: 5000,
    totalIngresos: 50000,
    usuarioRegistro: 'Usuario Actual',
    puestoTrabajo: 'Ejecutivo de Cuenta',
    fechaRegistro: '2024-01-10T09:00:00',
  },
  {
    id: 2,
    personalidad: 'Persona Moral',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    nombreCompleto: 'Comercializadora Del Norte SA de CV',
    nombreEmpresa: 'Comercializadora Del Norte SA de CV',
    sucursal: 'Sucursal Norte',
    estatusSIC: 'Aprobado',
    estatusListaNegra: 'Limpio',
    cuentaEje: '0002-3456-7890-12',
    saldo: 1500000.00,
    fechaActivacion: '2023-11-20T14:00:00',
    estatusCliente: 'Activo',
    calificacionCliente: 'Oro',
    rfc: 'CDN2011234567',
    moneda: 'MXN',
    telefonoOficina: '8181-5678',
    correoElectronico: 'contacto@comercializadoranorte.com',
    direccionPrincipal: 'Blvd. Constitución 456, Monterrey, N.L.',
    sector: 'Comercio',
    tipoGiro: 'Comercio al por mayor',
    actividadEconomica: 'Comercialización de productos',
    tamanoEmpresa: 'Grande',
    numeroEmpleados: 150,
    numeroSucursales: 5,
    usuarioRegistro: 'Usuario Actual',
    puestoTrabajo: 'Ejecutivo de Cuenta',
    fechaRegistro: '2023-11-15T10:30:00',
  },
  {
    id: 3,
    personalidad: 'Persona Física c/Actividad empresarial',
    nombre: 'María Elena',
    apellidoPaterno: 'Rodríguez',
    apellidoMaterno: 'Sánchez',
    nombreCompleto: 'María Elena Rodríguez Sánchez',
    sucursal: 'Sucursal Sur',
    estatusSIC: 'Aprobado',
    estatusListaNegra: 'Limpio',
    cuentaEje: '0003-4567-8901-23',
    saldo: 680000.00,
    fechaActivacion: '2024-02-01T11:15:00',
    estatusCliente: 'Activo',
    calificacionCliente: 'Plata',
    rfc: 'ROSM900512MDF',
    curp: 'ROSM900512MDFRDN08',
    fechaNacimiento: '1990-05-12',
    edad: 33,
    estadoCivil: 'Soltera',
    sexo: 'Femenino',
    entidadNacimiento: 'Guadalajara',
    nivelEstudios: 'Maestría',
    lenguaje: 'Español',
    moneda: 'MXN',
    celular: '3312345678',
    correoElectronico: 'maria.rodriguez@email.com',
    direccionPrincipal: 'Av. Chapultepec 789, Guadalajara, Jal.',
    tipoEmpleado: 'Independiente',
    nombreEmpresaTrabajo: 'Consultora MRS',
    puestoDesempena: 'Propietaria',
    ingresosMensuales: 60000,
    otrosIngresos: 10000,
    totalIngresos: 70000,
    sector: 'Servicios',
    tipoGiro: 'Consultoría',
    actividadEconomica: 'Consultoría empresarial',
    tamanoEmpresa: 'Pequeña',
    numeroEmpleados: 8,
    numeroSucursales: 1,
    usuarioRegistro: 'Usuario Actual',
    puestoTrabajo: 'Ejecutivo de Cuenta',
    fechaRegistro: '2024-01-25T13:45:00',
  },
  {
    id: 4,
    personalidad: 'Persona Física',
    nombre: 'Roberto',
    apellidoPaterno: 'Martínez',
    apellidoMaterno: 'Torres',
    nombreCompleto: 'Roberto Martínez Torres',
    sucursal: 'Matriz Centro',
    estatusSIC: 'Pendiente',
    estatusListaNegra: 'Pendiente',
    cuentaEje: '0004-5678-9012-34',
    saldo: 0,
    fechaActivacion: '2026-01-07T09:30:00',
    estatusCliente: 'Prospecto',
    calificacionCliente: 'Bronce',
    rfc: 'MATR920820HDF',
    curp: 'MATR920820HDFRRT05',
    fechaNacimiento: '1992-08-20',
    edad: 33,
    estadoCivil: 'Casado',
    sexo: 'Masculino',
    entidadNacimiento: 'Puebla',
    nivelEstudios: 'Licenciatura',
    lenguaje: 'Español',
    moneda: 'MXN',
    celular: '2221234567',
    correoElectronico: 'roberto.martinez@email.com',
    direccionPrincipal: 'Calle 5 de Mayo 234, Puebla, Pue.',
    tipoEmpleado: 'Empleado',
    nombreEmpresaTrabajo: 'Industrias Mexicanas SA',
    puestoDesempena: 'Supervisor de Producción',
    ingresosMensuales: 25000,
    otrosIngresos: 0,
    totalIngresos: 25000,
    usuarioRegistro: 'Usuario Actual',
    puestoTrabajo: 'Ejecutivo de Cuenta',
    fechaRegistro: '2026-01-07T09:00:00',
  },
  {
    id: 5,
    personalidad: 'Persona Física',
    nombre: 'Ana Patricia',
    apellidoPaterno: 'Hernández',
    apellidoMaterno: 'Vega',
    nombreCompleto: 'Ana Patricia Hernández Vega',
    sucursal: 'Sucursal Oriente',
    estatusSIC: 'Aprobado',
    estatusListaNegra: 'Limpio',
    cuentaEje: '0005-6789-0123-45',
    saldo: 125000.00,
    fechaActivacion: '2023-08-10T15:20:00',
    estatusCliente: 'Activo',
    calificacionCliente: 'Plata',
    rfc: 'HEVA880225MDF',
    curp: 'HEVA880225MDFRGG04',
    fechaNacimiento: '1988-02-25',
    edad: 37,
    estadoCivil: 'Divorciada',
    sexo: 'Femenino',
    entidadNacimiento: 'Veracruz',
    nivelEstudios: 'Licenciatura',
    lenguaje: 'Español',
    moneda: 'MXN',
    celular: '2291234567',
    correoElectronico: 'ana.hernandez@email.com',
    direccionPrincipal: 'Av. Independencia 567, Veracruz, Ver.',
    tipoEmpleado: 'Empleado',
    nombreEmpresaTrabajo: 'Gobierno del Estado',
    puestoDesempena: 'Coordinadora Administrativa',
    ingresosMensuales: 32000,
    otrosIngresos: 3000,
    totalIngresos: 35000,
    usuarioRegistro: 'Usuario Actual',
    puestoTrabajo: 'Ejecutivo de Cuenta',
    fechaRegistro: '2023-08-05T11:00:00',
  },
  {
    id: 6,
    personalidad: 'Persona Física c/Actividad empresarial',
    nombre: 'Alejandra',
    apellidoPaterno: 'Moreno',
    apellidoMaterno: 'Castillo',
    nombreCompleto: 'Alejandra Moreno Castillo',
    sucursal: 'Guadalajara Centro',
    estatusSIC: 'Aprobado',
    estatusListaNegra: 'Limpio',
    cuentaEje: '0006-7890-1234-56',
    saldo: 485000.00,
    fechaActivacion: '2024-03-15T09:45:00',
    estatusCliente: 'Activo',
    calificacionCliente: 'Oro',
    rfc: 'MOCA891015QR7',
    curp: 'MOCA891015MJCRLS07',
    fechaNacimiento: '1989-10-15',
    edad: 36,
    estadoCivil: 'Casada',
    sexo: 'Femenino',
    entidadNacimiento: 'Jalisco',
    nivelEstudios: 'Licenciatura',
    lenguaje: 'Español',
    moneda: 'MXN',
    telefonoDomicilio: '3338-4521',
    telefonoOficina: '3338-9012',
    celular: '3319876543',
    correoElectronico: 'alejandra.moreno@amcarquitectos.com.mx',
    direccionPrincipal: 'Av. Américas 1254, Col. Country Club, Guadalajara, Jal. CP 44610',
    tipoEmpleado: 'Independiente',
    nombreEmpresaTrabajo: 'AMC Arquitectos y Asociados',
    puestoDesempena: 'Directora General',
    ingresosMensuales: 92000,
    otrosIngresos: 18000,
    totalIngresos: 110000,
    sector: 'Servicios profesionales',
    tipoGiro: 'Arquitectura y diseño',
    tipoIndustria: 'Construcción',
    giroEmpresa: 'Servicios de arquitectura',
    actividadEconomica: 'Actividades profesionales, científicas y técnicas',
    sectorCNBV: 'Servicios',
    tamanoEmpresa: 'Pequeña',
    numeroEmpleados: 12,
    numeroSucursales: 1,
    usuarioRegistro: 'Carlos Medina',
    puestoTrabajo: 'Ejecutivo de Cuenta',
    fechaRegistro: '2024-03-10T09:00:00',
    
    // Campos adicionales del formulario Default
    entidadFederativa: 'Jalisco',
    entidadResidencia: 'Jalisco',
    nacionalidad: 'Mexicana',
    direccionCalle: 'Av. Américas',
    direccionNumeroExterior: '1254',
    direccionNumeroInterior: 'PH-2',
    direccionColonia: 'Country Club',
    direccionCodigoPostal: '44610',
    direccionCiudad: 'Guadalajara',
    direccionEstado: 'Jalisco',
    tipoEmpleo: 'Independiente',
    dependienteEconomico: '1',
    ingresoMensual: '$92,000.00',
    aniosLaborados: '8',
    puestoNombre: 'Directora General',
    nombreAval: 'Ricardo Fuentes Delgado',
    direccionEmpresa: 'Av. Chapultepec Sur 480, Piso 3, Col. Americana, Guadalajara, Jal.',
    actividadEconomica1: 'Actividades profesionales, científicas y técnicas',
    actividadEconomica2: 'Servicios de arquitectura e ingeniería',
    datosAdicionales: 'Cliente preferente con perfil PFAE. Despacho de arquitectura con 12 colaboradores. Flujo estable por contratos de obra y renta de local comercial.',
    claveDescuento: 'DESC-GDL-0012',
    zonaPagadora: 'Zona Metropolitana GDL',
    porcentajeDescuento: '',
    minimoLiquidez: '10000',
    tipoCobranza: 'Normal',
    claveDependencia: '',
    activacionTarjetaDebito: true,
    numeroTarjetaDebito: '4815 1620 0006 7890',
    fechaCuentaEje: '2024-03-15T09:45:00',
    fechaAlta: '2024-03-10T09:00:00',

    // ========================================
    // DATOS RELACIONALES EMBEBIDOS (cargados por AltaClienteDefault)
    // ========================================
    direcciones: [
      {
        id: 1,
        clienteId: 6,
        tipoDireccion: 'Domicilio Particular',
        calle: 'Av. Américas',
        numeroExterior: '1254',
        numeroInterior: 'PH-2',
        colonia: 'Country Club',
        ciudad: 'Guadalajara',
        estado: 'Jalisco',
        codigoPostal: '44610',
        pais: 'México',
        esPrincipal: true,
      },
      {
        id: 2,
        clienteId: 6,
        tipoDireccion: 'Oficina / Negocio',
        calle: 'Av. Chapultepec Sur',
        numeroExterior: '480',
        numeroInterior: 'Piso 3',
        colonia: 'Americana',
        ciudad: 'Guadalajara',
        estado: 'Jalisco',
        codigoPostal: '44160',
        pais: 'México',
        esPrincipal: false,
      },
    ],
    personasRelacionadas: [
      {
        id: 1,
        clienteId: 6,
        tipoRelacion: 'Beneficiario',
        nombre: 'Ricardo Fuentes Delgado',
        parentesco: 'Esposo',
        telefono: '3319876544',
        porcentajeParticipacion: 70,
      },
      {
        id: 2,
        clienteId: 6,
        tipoRelacion: 'Beneficiario',
        nombre: 'Patricia Castillo Ramírez',
        parentesco: 'Madre',
        telefono: '3312345098',
        porcentajeParticipacion: 30,
      },
      {
        id: 3,
        clienteId: 6,
        tipoRelacion: 'Referencia Personal',
        nombre: 'Ing. Laura Gómez Villaseñor',
        parentesco: 'Socia comercial',
        telefono: '3318765432',
      },
    ],
    listasNegras: [
      {
        id: 1,
        nombreLista: 'OFAC - SDN List',
        tipoLista: 'Internacional',
        estatus: 'Sin Coincidencia',
        fechaConsulta: '15/03/2024',
        usuario: 'Carlos Medina',
      },
      {
        id: 2,
        nombreLista: 'PLD - Lista Nacional de Personas Bloqueadas',
        tipoLista: 'Nacional',
        estatus: 'Sin Coincidencia',
        fechaConsulta: '15/03/2024',
        usuario: 'Carlos Medina',
      },
    ],

    // ========================================
    // DATOS SEED PARA SUBTABS INDEPENDIENTES
    // (Se cargan a sessionStorage al abrir el cliente por primera vez)
    // ========================================
    _seedExpedientes: [
      {
        id: 1,
        fechaHora: '15/03/2024 09:30:00',
        usuario: 'Carlos Medina',
        archivo: 'INE_AlejandraMoreno.pdf',
        tipoDocumento: 'INE / Identificación Oficial',
        descripcion: 'Credencial INE vigente - anverso y reverso',
        estatus: 'Aprobado',
        observaciones: 'Documento vigente hasta 2029',
      },
      {
        id: 2,
        fechaHora: '15/03/2024 09:35:00',
        usuario: 'Carlos Medina',
        archivo: 'ComprobanteDomicilio_CFE.pdf',
        tipoDocumento: 'Comprobante de Domicilio',
        descripcion: 'Recibo CFE - Av. Américas 1254, Col. Country Club',
        estatus: 'Aprobado',
        observaciones: 'Recibo del mes de febrero 2024',
      },
      {
        id: 3,
        fechaHora: '15/03/2024 09:40:00',
        usuario: 'Carlos Medina',
        archivo: 'ConstanciaFiscal_RFC.pdf',
        tipoDocumento: 'Constancia de Situación Fiscal',
        descripcion: 'CSF emitida por SAT con régimen PFAE',
        estatus: 'Aprobado',
        observaciones: 'Vigente, régimen 612 - Persona Física con Actividad Empresarial',
      },
      {
        id: 4,
        fechaHora: '15/03/2024 09:45:00',
        usuario: 'Carlos Medina',
        archivo: 'EstadosCuenta_Bancarios.pdf',
        tipoDocumento: 'Estados de Cuenta Bancarios',
        descripcion: 'Últimos 3 meses de estados de cuenta bancarios',
        estatus: 'Aprobado',
        observaciones: 'Promedio mensual de ingresos consistente con declarado',
      },
    ],
    _seedConsultasSic: [
      {
        id: 1,
        fechaHora: '15/03/2024 10:00:00',
        usuario: 'Carlos Medina',
        tipoConsulta: 'Consulta de Crédito PF',
        estatus: 'Aprobado',
        xmlResultado: '<?xml version="1.0" encoding="UTF-8"?>\n<ConsultaSIC>\n  <Encabezado>\n    <FechaConsulta>2024-03-15T10:00:00</FechaConsulta>\n    <TipoConsulta>Consulta de Crédito PF</TipoConsulta>\n    <Folio>SIC-20240315-AMC001</Folio>\n  </Encabezado>\n  <DatosPersonales>\n    <Nombre>ALEJANDRA MORENO CASTILLO</Nombre>\n    <RFC>MOCA891015QR7</RFC>\n    <CURP>MOCA891015MJCRLS07</CURP>\n  </DatosPersonales>\n  <Resumen>\n    <ScoreBC>725</ScoreBC>\n    <CuentasActivas>3</CuentasActivas>\n    <CuentasCerradas>1</CuentasCerradas>\n    <ClavesPrevencion>0</ClavesPrevencion>\n    <SaldoVigente>485000.00</SaldoVigente>\n    <LimiteCredito>800000.00</LimiteCredito>\n  </Resumen>\n  <Resultado>POSITIVO - Sin alertas</Resultado>\n</ConsultaSIC>',
      },
    ],
    _seedKyc: [
      {
        id: 1,
        fechaRegistro: '15/03/2024 10:15:00',
        usuario: 'Carlos Medina',
        isPep: false,
        ingresoMensual: '$92,000.00',
        numeroSalarios: '8',
        actividadEconomica: 'Actividades profesionales, científicas y técnicas',
        familyPep: false,
        funcionariosPublicos: false,
        listasNegras: false,
        otrosIngresos: true,
        fuenteIngresosAdicionales: 'Renta de local comercial en Plaza del Sol',
        resultadoCoincidencias: false,
        aprobadoCumplimiento: true,
        fechaCalificacion: '15/03/2024',
        calificacionPonderada: 18,
        nivelRiesgo: 'Bajo',
      },
    ],
    _seedGarantias: [
      {
        id: 1,
        tipo: 'Inmueble',
        subtipo: 'Departamento',
        nombre: 'Departamento PH-2 Av. Américas 1254',
        valorNominal: '$3,200,000.00',
        descripcion: 'Penthouse de 180m² en torre residencial, 3 recámaras, 2 estacionamientos',
        ubicacion: 'Av. Américas 1254, Col. Country Club, Guadalajara, Jal.',
        fechaRegistro: '15/03/2024 10:30:00',
        usuario: 'Carlos Medina',
      },
      {
        id: 2,
        tipo: 'Mueble',
        subtipo: 'Automóvil',
        nombre: 'BMW X3 2023',
        valorNominal: '$850,000.00',
        descripcion: 'BMW X3 sDrive20i 2023, color blanco, 18,000 km',
        ubicacion: 'En posesión del titular',
        fechaRegistro: '15/03/2024 10:35:00',
        usuario: 'Carlos Medina',
      },
    ],
    _seedPerfilTransaccional: [
      {
        id: 1,
        sublinea: 'Captación',
        producto: 'Cuenta de Ahorro',
        numTransaccionesRetiro: '12',
        numTransaccionesDeposito: '8',
        montoMaxRetiros: '$150,000.00',
        montoMaxDepositos: '$200,000.00',
        periodo: 'Mensual',
        fechaRegistro: '15/03/2024 10:45:00',
        usuario: 'Carlos Medina',
      },
      {
        id: 2,
        sublinea: 'Crédito',
        producto: 'Préstamo hipotecario',
        numTransaccionesRetiro: '1',
        numTransaccionesDeposito: '1',
        montoMaxRetiros: '$0.00',
        montoMaxDepositos: '$28,500.00',
        periodo: 'Mensual',
        fechaRegistro: '15/03/2024 10:50:00',
        usuario: 'Carlos Medina',
      },
    ],
    _seedCuentasAhorro: [
      {
        id: 1,
        fechaApertura: '15/03/2024',
        lineaProducto: 'Captación',
        sublinea: 'Ahorro',
        producto: 'Cuenta Ahorro Preferente',
        saldoActual: '$485,000.00',
        numeroCuenta: '0006-7890-1234-56',
        cuentaEje: true,
        estatus: 'Activa',
        fechaRegistro: '15/03/2024 09:45:00',
        usuario: 'Carlos Medina',
        moneda: 'MXN',
        tipoPersona: 'Persona Física c/Actividad empresarial',
        sucursal: 'Guadalajara Centro',
        tasaInteres: '7.50',
        plazo: '365',
        fechaVencimiento: '15/03/2025',
        observaciones: 'Cuenta eje principal del cliente',
        titular: 'Alejandra Moreno Castillo',
        rfc: 'MOCA891015QR7',
        curp: 'MOCA891015MJCRLS07',
        tipoCobranza: 'Normal',
        porcentajeDescuento: '',
        minimoLiquidez: '10000',
        claveDependencia: '',
        beneficiarios: [
          { id: 1, nombre: 'Ricardo Fuentes Delgado', parentesco: 'Esposo', porcentaje: '70', telefono: '3319876544', fechaRegistro: '15/03/2024', usuario: 'Carlos Medina' },
          { id: 2, nombre: 'Patricia Castillo Ramírez', parentesco: 'Madre', porcentaje: '30', telefono: '3312345098', fechaRegistro: '15/03/2024', usuario: 'Carlos Medina' },
        ],
        cotitulares: [],
        interesesDiarios: [
          { id: 1, fecha: '13/02/2026', tasaDiaria: '0.0205', saldoBase: '$485,000.00', interesGenerado: '$99.43', interesAcumulado: '$2,982.80', usuario: 'Sistema' },
        ],
        rendimientos: [
          { id: 1, periodo: 'Enero 2026', fechaInicio: '01/01/2026', fechaFin: '31/01/2026', saldoPromedio: '$478,500.00', tasaPromedio: '7.50%', rendimientoBruto: '$2,989.06', isrRetenido: '$47.83', rendimientoNeto: '$2,941.23', usuario: 'Sistema' },
        ],
        impuestos: [
          { id: 1, periodo: 'Enero 2026', tipoImpuesto: 'ISR', baseCalculo: '$2,989.06', tasa: '1.60%', montoRetenido: '$47.83', fechaRetencion: '31/01/2026', usuario: 'Sistema' },
        ],
        movimientos: [
          { id: 1, fecha: '10/02/2026', tipo: 'Depósito', concepto: 'Depósito SPEI - Honorarios profesionales', referencia: 'SPEI-20260210-001', monto: '$92,000.00', saldoAnterior: '$395,500.00', saldoFinal: '$487,500.00', usuario: 'Sistema' },
          { id: 2, fecha: '05/02/2026', tipo: 'Retiro', concepto: 'Pago crédito hipotecario - Mensualidad', referencia: 'PAG-HIP-20260205', monto: '$28,500.00', saldoAnterior: '$424,000.00', saldoFinal: '$395,500.00', usuario: 'Sistema' },
          { id: 3, fecha: '01/02/2026', tipo: 'Depósito', concepto: 'Renta local comercial Plaza del Sol', referencia: 'SPEI-20260201-003', monto: '$18,000.00', saldoAnterior: '$406,000.00', saldoFinal: '$424,000.00', usuario: 'Sistema' },
        ],
        cargos: [],
        bloqueos: [],
        solicitudesExtraordinarias: [],
      },
    ],
    _seedSolicitudes: [
      {
        id: 1,
        fechaSolicitud: '20/03/2024',
        lineaProducto: 'Crédito',
        sublinea: 'Hipotecario',
        producto: 'Préstamo hipotecario',
        montoSolicitado: '$2,500,000.00',
        montoAutorizado: '$2,200,000.00',
        plazo: '240',
        periodicidad: 'Mensual',
        tasa: '12.50',
        fechaInicio: '01/04/2024',
        fechaFin: '01/04/2044',
        estatusSolicitud: 'Aprobada',
        fechaRegistro: '20/03/2024 11:00:00',
        usuario: 'Carlos Medina',
      },
    ],
    _seedCreditos: [
      {
        id: 1,
        sublinea: 'Hipotecario',
        producto: 'Préstamo hipotecario',
        montoSolicitado: '$2,500,000.00',
        montoAutorizado: '$2,200,000.00',
        montoEntregado: '$2,200,000.00',
        plazo: '240',
        periodicidad: 'Mensual',
        tasa: '12.50',
        fechaInicio: '01/04/2024',
        fechaFin: '01/04/2044',
        estatusPago: 'Al Corriente',
        estatusCartera: 'Vigente',
        estatusCredito: 'Activo',
        fechaRegistro: '01/04/2024 09:00:00',
        usuario: 'Carlos Medina',
      },
    ],
    _seedInversiones: [
      {
        id: 1,
        lineaProducto: 'Inversión',
        sublinea: 'Plazo Fijo',
        producto: 'Pagaré con Rendimiento Liquidable al Vencimiento',
        plazo: '182',
        periodicidad: 'Al vencimiento',
        fechaInicio: '15/01/2026',
        fechaVencimiento: '15/07/2026',
        montoPagare: '$200,000.00',
        montoIntereses: '$9,800.00',
        tasaInteres: '9.80',
        estatus: 'Vigente',
        cuentaPago: '0006-7890-1234-56',
        fechaRegistro: '15/01/2026 10:00:00',
        usuario: 'Carlos Medina',
      },
    ],
    _seedMovimientos: [
      {
        id: 1,
        fechaHora: '10/02/2026 14:30:22',
        saldoInicial: '$395,500.00',
        tipoMovimiento: 'Depósito',
        concepto: 'SPEI Recibido - Honorarios profesionales AMC Arquitectos',
        montoMovimiento: '$92,000.00',
        saldoFinal: '$487,500.00',
      },
      {
        id: 2,
        fechaHora: '05/02/2026 09:15:00',
        saldoInicial: '$424,000.00',
        tipoMovimiento: 'Retiro',
        concepto: 'Pago mensual crédito hipotecario - Folio PAG-HIP-202602',
        montoMovimiento: '$28,500.00',
        saldoFinal: '$395,500.00',
      },
      {
        id: 3,
        fechaHora: '01/02/2026 08:00:05',
        saldoInicial: '$406,000.00',
        tipoMovimiento: 'Depósito',
        concepto: 'SPEI Recibido - Renta local comercial Plaza del Sol',
        montoMovimiento: '$18,000.00',
        saldoFinal: '$424,000.00',
      },
      {
        id: 4,
        fechaHora: '28/01/2026 16:42:10',
        saldoInicial: '$415,200.00',
        tipoMovimiento: 'Retiro',
        concepto: 'Transferencia SPEI - Pago proveedores materiales',
        montoMovimiento: '$9,200.00',
        saldoFinal: '$406,000.00',
      },
      {
        id: 5,
        fechaHora: '15/01/2026 10:05:00',
        saldoInicial: '$615,200.00',
        tipoMovimiento: 'Retiro',
        concepto: 'Inversión Pagaré 182 días - Folio INV-001',
        montoMovimiento: '$200,000.00',
        saldoFinal: '$415,200.00',
      },
    ],
    _seedAvisos: [
      {
        id: 1,
        fechaEmision: '01/02/2026',
        numeroReferencia: 'AV-2026-0601',
        tipo: 'Pagar',
        montoTotal: '$28,500.00',
        pagoTotal: '$28,500.00',
        saldo: '$0.00',
        estatus: 'Pagado',
        condicionPago: 'Domiciliado',
        observaciones: 'Pago mensualidad febrero 2026 crédito hipotecario',
        fechaVencimiento: '05/02/2026',
      },
      {
        id: 2,
        fechaEmision: '01/03/2026',
        numeroReferencia: 'AV-2026-0602',
        tipo: 'Pagar',
        montoTotal: '$28,500.00',
        pagoTotal: '$0.00',
        saldo: '$28,500.00',
        estatus: 'Pendiente',
        condicionPago: 'Domiciliado',
        observaciones: 'Pago mensualidad marzo 2026 crédito hipotecario',
        fechaVencimiento: '05/03/2026',
      },
    ],
    _seedAuditoria: {
      fechaRegistro: '15/03/2024 09:00:00',
      usuarioRegistro: 'Carlos Medina',
      puestoTrabajo: 'Ejecutivo de Cuenta',
      sucursal: 'Guadalajara Centro',
      autorizante: 'Lic. Fernando Ruiz Gallegos',
      codigoCompania: 'GDL-001',
      codigoDepartamento: 'BANCA-PREF',
      observaciones: 'Alta de cliente preferente con perfil PFAE. Documentación completa y verificada. Aprobado por Comité de Crédito para línea hipotecaria.',
      fechaModificacion: '10/02/2026 14:35:00',
      usuarioModificacion: 'Carlos Medina',
    },
    _seedArchivos: [
      {
        id: 1,
        fileName: 'INE_AlejandraMorenoCastillo.pdf',
        documentType: 'INE',
        description: 'Credencial para votar vigente - anverso y reverso',
        uploadDate: '15/03/2024 09:30:00',
        uploadedBy: 'Carlos Medina',
        status: 'Aprobado',
      },
      {
        id: 2,
        fileName: 'CURP_AlejandraMoreno.pdf',
        documentType: 'CURP',
        description: 'Cédula CURP actualizada',
        uploadDate: '15/03/2024 09:32:00',
        uploadedBy: 'Carlos Medina',
        status: 'Aprobado',
      },
      {
        id: 3,
        fileName: 'CSF_MOCA891015QR7.pdf',
        documentType: 'Constancia Fiscal',
        description: 'Constancia de Situación Fiscal emitida por SAT',
        uploadDate: '15/03/2024 09:34:00',
        uploadedBy: 'Carlos Medina',
        status: 'Aprobado',
      },
    ],
    _seedConvenios: [
      {
        id: 1,
        producto: 'PRO-001',
        tipoProducto: 'Captación',
        descripcion: 'Cuenta Ahorro Preferente con tasa preferencial',
        socio: 'AMC Arquitectos y Asociados',
        comisionesIngreso: true,
        seleccionado: false,
      },
    ],
    _seedCobranzaNormal: [
      {
        id: 1,
        cuenta: '0006-7890-1234-56',
        usuario: 'Sistema',
        observaciones: 'Cobro domiciliado mensualidad crédito hipotecario',
        fechaGenerar: '01/03/2026',
        fechaEnvio: '03/03/2026',
        fechaProgramacion: '05/03/2026',
        seleccionado: false,
      },
    ],
    _seedEstadoCuentaCreditos: [
      {
        id: 1,
        folio: 'CRED-2024-0601',
        producto: 'Préstamo hipotecario',
        montoSolicitado: 2200000,
        plazos: 240,
        periodoPagos: 'Mensual',
        pagoPeriodo: 28500,
        estatus: 'Al Corriente',
        estatusCredito: 'Activo',
        montoTotal: 6840000,
        totalPagado: 627000,
        numeroPagos: 22,
        fechaUltimoPago: '05/02/2026',
        seleccionado: false,
      },
    ],
    _seedEstadoCuentaPagos: [
      {
        id: 1,
        secuencia: 22,
        referencia: 'PAG-HIP-202602',
        fechaPago: '05/02/2026',
        pago: 28500,
        metodoPago: 'Domiciliación',
        socio: 'Alejandra Moreno Castillo',
        cuenta: '0006-7890-1234-56',
        propCapital: 15200,
        propInteres: 11300,
        propIVA: 1808,
        propSeguro: 150,
        propIVASeguro: 42,
        seleccionado: false,
      },
      {
        id: 2,
        secuencia: 21,
        referencia: 'PAG-HIP-202601',
        fechaPago: '05/01/2026',
        pago: 28500,
        metodoPago: 'Domiciliación',
        socio: 'Alejandra Moreno Castillo',
        cuenta: '0006-7890-1234-56',
        propCapital: 15050,
        propInteres: 11450,
        propIVA: 1832,
        propSeguro: 150,
        propIVASeguro: 18,
        seleccionado: false,
      },
    ],
    _seedCalendario: [
      {
        id: 1,
        fecha: '05/03/2026',
        titulo: 'Pago mensualidad crédito hipotecario',
        descripcion: 'Cargo domiciliado por $28,500.00 a cuenta eje',
        tipo: 'Pago',
        hora: '09:00',
        completado: false,
        seleccionado: false,
      },
      {
        id: 2,
        fecha: '15/03/2026',
        titulo: 'Aniversario 2 años como cliente',
        descripcion: 'Segundo aniversario - Evaluar upgrade de productos y beneficios',
        tipo: 'Seguimiento',
        hora: '10:00',
        completado: false,
        seleccionado: false,
      },
      {
        id: 3,
        fecha: '15/07/2026',
        titulo: 'Vencimiento inversión pagaré',
        descripcion: 'Vence pagaré de $200,000 + rendimientos $9,800. Contactar para reinversión.',
        tipo: 'Vencimiento',
        hora: '10:00',
        completado: false,
        seleccionado: false,
      },
    ],
  } as any,
];

export interface PersonaRelacionada {
  id: number;
  clienteId: number;
  tipoRelacion: string;
  nombre: string;
  parentesco: string;
  telefono: string;
  porcentajeParticipacion?: number;
}

export interface Direccion {
  id: number;
  clienteId: number;
  tipoDireccion: string;
  calle: string;
  numeroExterior: string;
  numeroInterior?: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigoPostal: string;
  pais: string;
  esPrincipal: boolean;
}

export interface ExpedienteElectronico {
  id: number;
  clienteId: number;
  tipoDocumento: string;
  nombreArchivo: string;
  fechaCarga: string;
  tamano: string;
  estatus: string;
  fileData?: string; // URL o base64 del archivo
}

export const mockPersonasRelacionadas: PersonaRelacionada[] = [
  {
    id: 1,
    clienteId: 1,
    tipoRelacion: 'Beneficiario',
    nombre: 'María García Ruiz',
    parentesco: 'Esposa',
    telefono: '5512345679',
    porcentajeParticipacion: 100,
  },
];

export const mockDirecciones: Direccion[] = [
  {
    id: 1,
    clienteId: 1,
    tipoDireccion: 'Domicilio Particular',
    calle: 'Av. Reforma',
    numeroExterior: '123',
    numeroInterior: 'Depto 4',
    colonia: 'Centro',
    ciudad: 'Ciudad de México',
    estado: 'CDMX',
    codigoPostal: '06000',
    pais: 'México',
    esPrincipal: true,
  },
];

export const mockExpedientes: ExpedienteElectronico[] = [
  {
    id: 1,
    clienteId: 1,
    tipoDocumento: 'INE',
    nombreArchivo: 'INE_JuanGarcia.pdf',
    fechaCarga: '2024-01-10T10:00:00',
    tamano: '2.3 MB',
    estatus: 'Aprobado',
    fileData: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  },
  {
    id: 2,
    clienteId: 1,
    tipoDocumento: 'Comprobante de Domicilio',
    nombreArchivo: 'ComprobanteDomicilio.pdf',
    fechaCarga: '2024-01-10T10:05:00',
    tamano: '1.8 MB',
    estatus: 'Aprobado',
  },
];