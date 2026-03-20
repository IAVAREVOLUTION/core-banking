/**
 * CotizacionesModule.tsx
 *
 * Módulo principal de Cotizaciones
 * Subcategorías: Captación | Crédito | Línea de Crédito
 *
 * Cada subcategoría tiene: Dashboard → Lista → Formulario (Alta/Editar/Ver)
 * Persistencia futura en J_COTIZACIONES (esquema EFINANCIANET_DB)
 *
 * ══════════════════════════════════════════════════════════════════
 * Diseño:
 *   - Barra superior de subcategorías (Captación / Crédito / Línea de Crédito)
 *     estilo Productos: tab activo bg-primary-theme text-white, ícono hamburger
 *   - Lista institucional réplica de ClientesList
 *   - Formulario con blue-stripe tabs (réplica AltaClienteDefault)
 * ══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import { CotizacionCaptacionList } from './CotizacionCaptacionList';
import { CotizacionCaptacionForm } from './CotizacionCaptacionForm';
import type { CotizacionCaptacion } from './cotizacionCaptacionTypes';
import { useCotizacionesCaptacionDB } from '../../hooks/useCotizacionesCaptacionDB';
import { CotizacionCreditoList } from './CotizacionCreditoList';
import { CotizacionCreditoForm } from './CotizacionCreditoForm';
import type { CotizacionCredito } from './cotizacionCreditoTypes';
import { generarNoCotizaCredito, crearCotizacionCreditoVacia } from './cotizacionCreditoTypes';

// ════════════════════════════════════════════════════════════════
// MOCK DATA — Cotizaciones Crédito (demo mientras no hay DB)
// ════════════════════════════════════════════════════════════════
const MOCK_COTIZACIONES_CREDITO: CotizacionCredito[] = [
  {
    id: 'cre-001', no_cotiza: 'CRE-A1B2C3D4E5F6G7H8I9J0K1',
    descripcion: 'Crédito Personal empleado SEP', producto_id: 'PC-001', cliente_id: 'CL-001',
    fecha_cotiza: '2026-02-24T09:30:00', estatus_cotiza: 'Pendiente', linea_cotizacion: 'Crédito',
    data: {
      lineaProducto: 'Crédito', usuario: 'Juan Pérez',
      cliente: { claveCliente: 'CLI-10001', nombreCompleto: 'María García López' },
      institucionGobierno: 'Secretaría de Educación Pública (SEP)',
      producto: { claveProducto: 'PCRE-001', nombreProducto: 'Crédito Personal', tipoProducto: 'Crédito Individual', lineaProducto: 'Crédito' },
      moneda: 'MXN', periodo: 'Mensual',
      plazoMinimo: 6, plazoMaximo: 48, plazo: 36,
      montoMinimo: 5000, montoMaximo: 500000, montoSolicitado: 150000,
      tasaMinima: 12, tasaMaxima: 24, tasaCotizada: 18,
      tipoGarantia: 'Fiduciaria', subtipoGarantia: 'Obligado Solidario', aforo: 1.0, montoGarantia: 150000,
      tipoCalculoAmortizacion: 'Francés',
      seguroFinanciado: false, seguroNombre: '', montoSeguro: 0, tasaSeguro: 0, totalSeguro: 0,
      fechaPrimerPago: '2026-03-24',
      interesAPagar: 45275, pagoPeriodo: 5424, pagoSeguroPeriodo: 0, pagoTotal: 5424,
      pagoMensual: 5424, interesTotal: 45275, montoTotal: 195275, cat: 0,
      tipoTasa: 'Fija', frecuenciaPago: 'Mensual',
      tablaAmortizacion: [],
    },
  },
  {
    id: 'cre-002', no_cotiza: 'CRE-L2M3N4O5P6Q7R8S9T0U1V2',
    descripcion: 'Crédito Hipotecario vivienda', producto_id: 'PC-002', cliente_id: 'CL-002',
    fecha_cotiza: '2026-02-20T14:00:00', estatus_cotiza: 'Aprobada', linea_cotizacion: 'Crédito',
    data: {
      lineaProducto: 'Crédito', usuario: 'Ana López',
      cliente: { claveCliente: 'CLI-10002', nombreCompleto: 'Roberto Hernández Martínez' },
      institucionGobierno: 'Instituto de Seguridad y Servicios Sociales (ISSSTE)',
      producto: { claveProducto: 'PCRE-002', nombreProducto: 'Crédito Hipotecario', tipoProducto: 'Crédito Hipotecario', lineaProducto: 'Crédito' },
      moneda: 'MXN', periodo: 'Mensual',
      plazoMinimo: 12, plazoMaximo: 360, plazo: 240,
      montoMinimo: 100000, montoMaximo: 5000000, montoSolicitado: 1500000,
      tasaMinima: 8, tasaMaxima: 16, tasaCotizada: 12,
      tipoGarantia: 'Hipotecaria', subtipoGarantia: 'Inmueble Urbano', aforo: 1.5, montoGarantia: 2250000,
      tipoCalculoAmortizacion: 'Francés',
      seguroFinanciado: true, seguroNombre: 'Seguro de Vida Deudor', montoSeguro: 800, tasaSeguro: 0.0015, totalSeguro: 1088,
      fechaPrimerPago: '2026-03-20',
      interesAPagar: 2465222, pagoPeriodo: 16521, pagoSeguroPeriodo: 4.53, pagoTotal: 16526,
      pagoMensual: 16521, interesTotal: 2465222, montoTotal: 3965222, cat: 0,
      tipoTasa: 'Fija', frecuenciaPago: 'Mensual',
      tablaAmortizacion: [],
    },
  },
  {
    id: 'cre-003', no_cotiza: 'CRE-W3X4Y5Z6A7B8C9D0E1F2G3',
    descripcion: 'Crédito Automotriz', producto_id: 'PC-003', cliente_id: 'CL-004',
    fecha_cotiza: '2026-02-18T11:15:00', estatus_cotiza: 'Pendiente', linea_cotizacion: 'Crédito',
    data: {
      lineaProducto: 'Crédito', usuario: 'Carlos Mendoza',
      cliente: { claveCliente: 'CLI-10004', nombreCompleto: 'Laura Sánchez Ramírez' },
      institucionGobierno: 'Comisión Federal de Electricidad (CFE)',
      producto: { claveProducto: 'PCRE-003', nombreProducto: 'Crédito Automotriz', tipoProducto: 'Crédito Consumo', lineaProducto: 'Crédito' },
      moneda: 'MXN', periodo: 'Mensual',
      plazoMinimo: 12, plazoMaximo: 60, plazo: 48,
      montoMinimo: 50000, montoMaximo: 1000000, montoSolicitado: 350000,
      tasaMinima: 10, tasaMaxima: 20, tasaCotizada: 15.5,
      tipoGarantia: 'Prendaria', subtipoGarantia: 'Vehículo', aforo: 1.3, montoGarantia: 455000,
      tipoCalculoAmortizacion: 'Francés',
      seguroFinanciado: false, seguroNombre: '', montoSeguro: 0, tasaSeguro: 0, totalSeguro: 0,
      fechaPrimerPago: '2026-03-18',
      interesAPagar: 122085, pagoPeriodo: 9835, pagoSeguroPeriodo: 0, pagoTotal: 9835,
      pagoMensual: 9835, interesTotal: 122085, montoTotal: 472085, cat: 0,
      tipoTasa: 'Fija', frecuenciaPago: 'Mensual',
      tablaAmortizacion: [],
    },
  },
  {
    id: 'cre-004', no_cotiza: 'CRE-H4I5J6K7L8M9N0O1P2Q3R4',
    descripcion: 'Crédito Personal complementario', producto_id: 'PC-001', cliente_id: 'CL-007',
    fecha_cotiza: '2026-02-26T16:00:00', estatus_cotiza: 'Aprobada', linea_cotizacion: 'Crédito',
    data: {
      lineaProducto: 'Crédito', usuario: 'Juan Pérez',
      cliente: { claveCliente: 'CLI-10007', nombreCompleto: 'Patricia Ruiz Vega' },
      institucionGobierno: 'Secretaría de Hacienda (SHCP)',
      producto: { claveProducto: 'PCRE-001', nombreProducto: 'Crédito Personal', tipoProducto: 'Crédito Individual', lineaProducto: 'Crédito' },
      moneda: 'MXN', periodo: 'Quincenal',
      plazoMinimo: 6, plazoMaximo: 48, plazo: 24,
      montoMinimo: 5000, montoMaximo: 500000, montoSolicitado: 80000,
      tasaMinima: 12, tasaMaxima: 24, tasaCotizada: 18,
      tipoGarantia: 'Fiduciaria', subtipoGarantia: 'Obligado Solidario', aforo: 1.0, montoGarantia: 80000,
      tipoCalculoAmortizacion: 'Francés',
      seguroFinanciado: false, seguroNombre: '', montoSeguro: 0, tasaSeguro: 0, totalSeguro: 0,
      fechaPrimerPago: '2026-03-15',
      interesAPagar: 15866, pagoPeriodo: 3994, pagoSeguroPeriodo: 0, pagoTotal: 3994,
      pagoMensual: 3994, interesTotal: 15866, montoTotal: 95866, cat: 0,
      tipoTasa: 'Fija', frecuenciaPago: 'Quincenal',
      tablaAmortizacion: [],
    },
  },
];

// ════════════════════════════════════════════════════════════════
// MOCK DATA — Cotizaciones Línea de Crédito
// ════════════════════════════════════════════════════════════════
const MOCK_COTIZACIONES_LC: CotizacionCredito[] = [
  {
    id: 'ldc-001', no_cotiza: 'LDC-S5T6U7V8W9X0Y1Z2A3B4C5',
    descripcion: 'Línea Revolvente Empresarial', producto_id: 'PL-001', cliente_id: 'CL-008',
    fecha_cotiza: '2026-02-22T10:00:00', estatus_cotiza: 'Pendiente', linea_cotizacion: 'Línea Crédito',
    data: {
      lineaProducto: 'Línea de Crédito', usuario: 'Ana López',
      cliente: { claveCliente: 'CLI-10008', nombreCompleto: 'Grupo Industrial Norteño SA de CV' },
      institucionGobierno: '',
      producto: { claveProducto: 'PLDC-001', nombreProducto: 'Línea Revolvente Empresarial', tipoProducto: 'Línea Revolvente', lineaProducto: 'Línea de Crédito' },
      moneda: 'MXN', periodo: 'Mensual',
      plazoMinimo: 6, plazoMaximo: 24, plazo: 12,
      montoMinimo: 100000, montoMaximo: 2000000, montoSolicitado: 500000,
      tasaMinima: 10, tasaMaxima: 20, tasaCotizada: 16,
      tipoGarantia: '', subtipoGarantia: '', aforo: 0, montoGarantia: 0,
      tipoCalculoAmortizacion: 'Francés',
      seguroFinanciado: false, seguroNombre: '', montoSeguro: 0, tasaSeguro: 0, totalSeguro: 0,
      fechaPrimerPago: '2026-03-22',
      interesAPagar: 44496, pagoPeriodo: 45374, pagoSeguroPeriodo: 0, pagoTotal: 45374,
      pagoMensual: 45374, interesTotal: 44496, montoTotal: 544496, cat: 0,
      tipoTasa: 'Variable', frecuenciaPago: 'Mensual',
      tipoLinea: 'Revolvente',
      montoLineaAutorizada: 500000, disposicionesPermitidas: 5, montoDisposicionMinima: 50000, vigenciaLinea: 24,
      tablaAmortizacion: [],
    },
  },
  {
    id: 'ldc-002', no_cotiza: 'LDC-D6E7F8G9H0I1J2K3L4M5N6',
    descripcion: 'Línea Simple PyME producción', producto_id: 'PL-002', cliente_id: 'CL-005',
    fecha_cotiza: '2026-02-19T15:30:00', estatus_cotiza: 'Aprobada', linea_cotizacion: 'Línea Crédito',
    data: {
      lineaProducto: 'Línea de Crédito', usuario: 'Carlos Mendoza',
      cliente: { claveCliente: 'CLI-10005', nombreCompleto: 'Fernando Torres Ávila' },
      institucionGobierno: 'Secretaría de Gobernación (SEGOB)',
      producto: { claveProducto: 'PLDC-002', nombreProducto: 'Línea Simple PyME', tipoProducto: 'Línea Simple', lineaProducto: 'Línea de Crédito' },
      moneda: 'MXN', periodo: 'Mensual',
      plazoMinimo: 6, plazoMaximo: 36, plazo: 18,
      montoMinimo: 50000, montoMaximo: 1000000, montoSolicitado: 250000,
      tasaMinima: 9, tasaMaxima: 18, tasaCotizada: 14,
      tipoGarantia: '', subtipoGarantia: '', aforo: 0, montoGarantia: 0,
      tipoCalculoAmortizacion: 'Alemán',
      seguroFinanciado: false, seguroNombre: '', montoSeguro: 0, tasaSeguro: 0, totalSeguro: 0,
      fechaPrimerPago: '2026-03-19',
      interesAPagar: 46001, pagoPeriodo: 16455, pagoSeguroPeriodo: 0, pagoTotal: 16455,
      pagoMensual: 16455, interesTotal: 46001, montoTotal: 296001, cat: 0,
      tipoTasa: 'Fija', frecuenciaPago: 'Mensual',
      tipoLinea: 'Fija',
      montoLineaAutorizada: 300000, disposicionesPermitidas: 3, montoDisposicionMinima: 25000, vigenciaLinea: 36,
      tablaAmortizacion: [],
    },
  },
  {
    id: 'ldc-003', no_cotiza: 'LDC-O7P8Q9R0S1T2U3V4W5X6Y7',
    descripcion: 'Línea Revolvente para capital de trabajo', producto_id: 'PL-001', cliente_id: 'CL-001',
    fecha_cotiza: '2026-02-27T08:45:00', estatus_cotiza: 'Pendiente', linea_cotizacion: 'Línea Crédito',
    data: {
      lineaProducto: 'Línea de Crédito', usuario: 'Juan Pérez',
      cliente: { claveCliente: 'CLI-10001', nombreCompleto: 'María García López' },
      institucionGobierno: 'Secretaría de Educación Pública (SEP)',
      producto: { claveProducto: 'PLDC-001', nombreProducto: 'Línea Revolvente Empresarial', tipoProducto: 'Línea Revolvente', lineaProducto: 'Línea de Crédito' },
      moneda: 'MXN', periodo: 'Mensual',
      plazoMinimo: 3, plazoMaximo: 12, plazo: 6,
      montoMinimo: 50000, montoMaximo: 500000, montoSolicitado: 200000,
      tasaMinima: 10, tasaMaxima: 20, tasaCotizada: 16,
      tipoGarantia: '', subtipoGarantia: '', aforo: 0, montoGarantia: 0,
      tipoCalculoAmortizacion: 'Francés',
      seguroFinanciado: false, seguroNombre: '', montoSeguro: 0, tasaSeguro: 0, totalSeguro: 0,
      fechaPrimerPago: '2026-03-27',
      interesAPagar: 9315, pagoPeriodo: 34885, pagoSeguroPeriodo: 0, pagoTotal: 34885,
      pagoMensual: 34885, interesTotal: 9315, montoTotal: 209315, cat: 0,
      tipoTasa: 'Variable', frecuenciaPago: 'Mensual',
      tipoLinea: 'Revolvente',
      montoLineaAutorizada: 200000, disposicionesPermitidas: 2, montoDisposicionMinima: 100000, vigenciaLinea: 12,
      tablaAmortizacion: [],
    },
  },
];

type SubCategoria = 'captacion' | 'credito' | 'linea-credito';
type ViewMode = 'dashboard' | 'list' | 'form';
type FormMode = 'create' | 'edit' | 'view';

// ════════════════════════════════════════════════════════════════
// MOCK DATA — Cotizaciones Captación
// ════════════════════════════════════════════════════════════════
const MOCK_COTIZACIONES_CAPTACION: CotizacionCaptacion[] = [
  {
    id: 'a1b2c3d4', no_cotiza: 'COT-LX7Z8A9B1C2D3E4F5G6H',
    descripcion: 'Cotización Ahorro Voluntario', producto_id: 'P-001', cliente_id: 'CL-001',
    fecha_cotiza: '2026-02-20T10:30:00', estatus_cotiza: 'Pendiente', linea_cotizacion: 'Captación',
    data: {
      lineaProducto: 'Captación', usuario: 'Juan Pérez',
      cliente: { claveCliente: 'CLI-10001', nombreCompleto: 'María García López' },
      institucionGobierno: 'Secretaría de Educación Pública (SEP)',
      producto: { claveProducto: 'PCAP-001', nombreProducto: 'Ahorro Voluntario', tipoProducto: 'Ahorro', montoMinimo: 5000, periodoCumplirMontoMinimo: 'Mensual', plazoCumplirMontoMinimo: 12 },
      montoCotizado: 50000, tasaMinInteres: 4.5, frecuenciaCapitalizacion: 'Mensual',
      interesGeneradoPeriodo: 187.50, periodoCumplirMontoMinimo: 'Mensual', plazoCumplirMontoMinimo: 16, fechaPrimeraAportacion: '2026-03-14',
      calendarioAportaciones: [],
    },
  },
  {
    id: 'e5f6g7h8', no_cotiza: 'COT-MN8P9Q0R1S2T3U4V5W6',
    descripcion: 'Cotización Aportación Navideña', producto_id: 'P-002', cliente_id: 'CL-002',
    fecha_cotiza: '2026-02-18T14:15:00', estatus_cotiza: 'Aprobada', linea_cotizacion: 'Captación',
    data: {
      lineaProducto: 'Captación', usuario: 'Ana López',
      cliente: { claveCliente: 'CLI-10002', nombreCompleto: 'Roberto Hernández Martínez' },
      institucionGobierno: 'Instituto de Seguridad y Servicios Sociales (ISSSTE)',
      producto: { claveProducto: 'PCAP-002', nombreProducto: 'Aportación Navideña', tipoProducto: 'Aportación', montoMinimo: 10000, periodoCumplirMontoMinimo: 'Quincenal', plazoCumplirMontoMinimo: 24 },
      montoCotizado: 25000, tasaMinInteres: 5.2, frecuenciaCapitalizacion: 'Quincenal',
      interesGeneradoPeriodo: 54.17, periodoCumplirMontoMinimo: 'Quincenal', plazoCumplirMontoMinimo: 24, fechaPrimeraAportacion: '2026-03-01',
      calendarioAportaciones: [],
    },
  },
  {
    id: 'i9j0k1l2', no_cotiza: 'COT-XY6Z7A8B9C0D1E2F3G4',
    descripcion: 'Cotización Ahorro Infantil', producto_id: 'P-003', cliente_id: 'CL-004',
    fecha_cotiza: '2026-02-15T09:00:00', estatus_cotiza: 'Pendiente', linea_cotizacion: 'Captación',
    data: {
      lineaProducto: 'Captación', usuario: 'Carlos Mendoza',
      cliente: { claveCliente: 'CLI-10004', nombreCompleto: 'Laura Sánchez Ramírez' },
      institucionGobierno: 'Comisión Federal de Electricidad (CFE)',
      producto: { claveProducto: 'PCAP-003', nombreProducto: 'Ahorro Infantil', tipoProducto: 'Ahorro', montoMinimo: 1000, periodoCumplirMontoMinimo: 'Semanal', plazoCumplirMontoMinimo: 52 },
      montoCotizado: 15000, tasaMinInteres: 3.8, frecuenciaCapitalizacion: 'Semanal',
      interesGeneradoPeriodo: 11.08, periodoCumplirMontoMinimo: 'Semanal', plazoCumplirMontoMinimo: 52, fechaPrimeraAportacion: '2026-03-07',
      calendarioAportaciones: [],
    },
  },
  {
    id: 'm3n4o5p6', no_cotiza: 'COT-HI5J6K7L8M9N0O1P2Q3',
    descripcion: 'Cotización Aportación Escolar', producto_id: 'P-004', cliente_id: 'CL-005',
    fecha_cotiza: '2026-02-12T16:45:00', estatus_cotiza: 'Pendiente', linea_cotizacion: 'Captación',
    data: {
      lineaProducto: 'Captación', usuario: 'Juan Pérez',
      cliente: { claveCliente: 'CLI-10005', nombreCompleto: 'Fernando Torres Ávila' },
      institucionGobierno: 'Secretaría de Gobernación (SEGOB)',
      producto: { claveProducto: 'PCAP-004', nombreProducto: 'Aportación Escolar', tipoProducto: 'Aportación', montoMinimo: 25000, periodoCumplirMontoMinimo: 'Catorcenal', plazoCumplirMontoMinimo: 16 },
      montoCotizado: 40000, tasaMinInteres: 6.0, frecuenciaCapitalizacion: 'Catorcenal',
      interesGeneradoPeriodo: 93.33, periodoCumplirMontoMinimo: 'Catorcenal', plazoCumplirMontoMinimo: 16, fechaPrimeraAportacion: '2026-03-10',
      calendarioAportaciones: [],
    },
  },
  {
    id: 'q7r8s9t0', no_cotiza: 'COT-RS4T5U6V7W8X9Y0Z1A2',
    descripcion: 'Cotización Ahorro a Plazo Fijo', producto_id: 'P-005', cliente_id: 'CL-007',
    fecha_cotiza: '2026-02-25T11:20:00', estatus_cotiza: 'Aprobada', linea_cotizacion: 'Captación',
    data: {
      lineaProducto: 'Captación', usuario: 'Ana López',
      cliente: { claveCliente: 'CLI-10007', nombreCompleto: 'Patricia Ruiz Vega' },
      institucionGobierno: 'Secretaría de Hacienda (SHCP)',
      producto: { claveProducto: 'PCAP-005', nombreProducto: 'Ahorro a Plazo Fijo', tipoProducto: 'Ahorro', montoMinimo: 50000, periodoCumplirMontoMinimo: 'Mensual', plazoCumplirMontoMinimo: 6 },
      montoCotizado: 100000, tasaMinInteres: 8.5, frecuenciaCapitalizacion: 'Mensual',
      interesGeneradoPeriodo: 708.33, periodoCumplirMontoMinimo: 'Mensual', plazoCumplirMontoMinimo: 6, fechaPrimeraAportacion: '2026-03-01',
      calendarioAportaciones: [],
    },
  },
  {
    id: 'u1v2w3x4', no_cotiza: 'COT-BC3D4E5F6G7H8I9J0K1',
    descripcion: 'Cotización Ahorro Voluntario 2', producto_id: 'P-001', cliente_id: 'CL-008',
    fecha_cotiza: '2026-02-27T08:00:00', estatus_cotiza: 'Pendiente', linea_cotizacion: 'Captación',
    data: {
      lineaProducto: 'Captación', usuario: 'Carlos Mendoza',
      cliente: { claveCliente: 'CLI-10008', nombreCompleto: 'Grupo Industrial Norteño SA de CV' },
      institucionGobierno: 'Comisión Federal de Electricidad (CFE)',
      producto: { claveProducto: 'PCAP-001', nombreProducto: 'Ahorro Voluntario', tipoProducto: 'Ahorro', montoMinimo: 5000, periodoCumplirMontoMinimo: 'Mensual', plazoCumplirMontoMinimo: 12 },
      montoCotizado: 200000, tasaMinInteres: 4.5, frecuenciaCapitalizacion: 'Mensual',
      interesGeneradoPeriodo: 750.00, periodoCumplirMontoMinimo: 'Mensual', plazoCumplirMontoMinimo: 12, fechaPrimeraAportacion: '2026-04-01',
      calendarioAportaciones: [],
    },
  },
];

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'];
const formatMoney = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════
function CotizacionesDashboard({ cotizaciones, onNew, onViewList }: {
  cotizaciones: CotizacionCaptacion[];
  onNew: () => void;
  onViewList: () => void;
}) {
  const total = cotizaciones.length;
  const pendientes = cotizaciones.filter(c => c.estatus_cotiza === 'Pendiente').length;
  const aprobadas = cotizaciones.filter(c => c.estatus_cotiza === 'Aprobada').length;
  const montoTotal = cotizaciones.reduce((s, c) => s + (c.data.montoCotizado || 0), 0);

  const estatusData = Object.entries(
    cotizaciones.reduce((acc, c) => { acc[c.estatus_cotiza] = (acc[c.estatus_cotiza] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const productoData = Object.entries(
    cotizaciones.reduce((acc, c) => {
      const key = c.data.producto?.nombreProducto || 'Sin producto';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const montoByProducto = Object.entries(
    cotizaciones.reduce((acc, c) => {
      const key = c.data.producto?.nombreProducto || 'Otro';
      acc[key] = (acc[key] || 0) + (c.data.montoCotizado || 0);
      return acc;
    }, {} as Record<string, number>)
  ).map(([prod, monto]) => ({ prod, monto: monto / 1000 }));

  const renderEstatus = (est: string) => {
    let bg = 'bg-gray-100 text-gray-700';
    if (est === 'Pendiente') bg = 'bg-yellow-100 text-yellow-800';
    else if (est === 'Aprobada') bg = 'bg-green-100 text-green-800';
    return <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${bg}`}>{est}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-[10px] text-gray-500">Total Cotizaciones</p><p className="text-xl text-gray-900">{total}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center"><Clock className="w-5 h-5 text-yellow-600" /></div>
            <div><p className="text-[10px] text-gray-500">Pendientes</p><p className="text-xl text-yellow-600">{pendientes}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-[10px] text-gray-500">Aprobadas</p><p className="text-xl text-green-600">{aprobadas}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-[10px] text-gray-500">Monto Total</p><p className="text-lg text-emerald-600">{formatMoney(montoTotal)}</p></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-sm text-gray-700 mb-3">Por Estatus</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={estatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {estatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-sm text-gray-700 mb-3">Por Producto</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={productoData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {productoData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-sm text-gray-700 mb-3">Monto por Producto (miles)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={montoByProducto}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="prod" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString()} K`} />
              <Bar dataKey="monto" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla resumen */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-gray-700">Cotizaciones Captación Recientes</h3>
          <button onClick={onViewList} className="text-xs text-blue-600 hover:underline">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-2">ID Cotiza</th>
                <th className="text-left px-3 py-2">Cliente</th>
                <th className="text-left px-3 py-2">Producto</th>
                <th className="text-right px-3 py-2">Monto</th>
                <th className="text-center px-3 py-2">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.slice(0, 5).map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 text-blue-600">{c.no_cotiza}</td>
                  <td className="px-3 py-2">{c.data.cliente?.nombreCompleto || '—'}</td>
                  <td className="px-3 py-2">{c.data.producto?.nombreProducto || '—'}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(c.data.montoCotizado || 0)}</td>
                  <td className="px-3 py-2 text-center">{renderEstatus(c.estatus_cotiza)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL
// ════════════════════════════════════════════════════════════════
interface CotizacionesModuleProps {
  /** Deep-link: ID de cotización a abrir automáticamente en modo ver */
  deepLinkCotizacionId?: string | null;
  /** Deep-link: línea de producto ("Captación", "Crédito", "Línea de Crédito") */
  deepLinkLinea?: string | null;
  /** Callback para limpiar el deep-link después de consumirlo */
  onDeepLinkConsumed?: () => void;
  /** Callback para crear una Solicitud desde una Cotización — spec solicitudes-financieras §1 */
  onCrearSolicitudDesdeCotizacion?: (cotizacionData: any) => void;
}

export function CotizacionesModule({ deepLinkCotizacionId, deepLinkLinea, onDeepLinkConsumed, onCrearSolicitudDesdeCotizacion }: CotizacionesModuleProps = {}) {
  const [subCategoria, setSubCategoria] = useState<SubCategoria>('captacion');
  const [view, setView] = useState<ViewMode>('list');
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [selectedCap, setSelectedCap] = useState<CotizacionCaptacion | undefined>();

  // ── State para Crédito y Línea de Crédito (local, sessionStorage) ──
  const [cotizacionesCredito, setCotizacionesCredito] = useState<CotizacionCredito[]>(() => {
    try { const r = sessionStorage.getItem('cotizaciones_credito_local'); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [cotizacionesLC, setCotizacionesLC] = useState<CotizacionCredito[]>(() => {
    try { const r = sessionStorage.getItem('cotizaciones_lc_local'); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [selectedCredito, setSelectedCredito] = useState<CotizacionCredito | undefined>();

  // ── Ref para deep-link (debe declararse ANTES del hook que lo usa) ──
  const deepLinkProcessedRef = useRef(false);
  const isDeepLinkActive = !!deepLinkCotizacionId && !deepLinkProcessedRef.current;

  // ════════════════════════════════════════════════════════════
  // Hook real — J_COTIZACIONES con fallback a datos mock
  // Activo SIEMPRE para que Crédito y LC también lean de BD
  // ══════════════════════════════════════════════════════════════
  const {
    cotizaciones: cotizacionesDB,
    loading: loadingDB,
    saving: savingDB,
    error: errorDB,
    warning: warningDB,
    backendStatus,
    fetchMethod,
    saveCotizacion,
    refetch,
    seedTestRecord,
  } = useCotizacionesCaptacionDB(true);

  // ══════════════════════════════════════════════════════════════
  // DEEP-LINK — Abrir cotización automáticamente desde otro módulo
  //
  // BUG FIX: `loading` del hook inicia en false (no hay fetch aún),
  // así que el efecto anterior se disparaba con cotizacionesDB vacío
  // y consumía el deep-link sin encontrar nada.
  //
  // Solución: usar un ref para rastrear si ya se procesó, y depender
  // de cotizacionesDB para re-intentar cuando los datos lleguen.
  // También activar el hook de DB forzosamente durante el deep-link.
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    // Reset processed flag cuando cambia el deep-link ID
    if (deepLinkCotizacionId) {
      deepLinkProcessedRef.current = false;
    }
  }, [deepLinkCotizacionId]);

  useEffect(() => {
    if (!deepLinkCotizacionId || deepLinkProcessedRef.current) return;

    console.log(`[CotizModule] Deep-link evaluando: id=${deepLinkCotizacionId}, línea=${deepLinkLinea}, loadingDB=${loadingDB}, cotizacionesDB.length=${cotizacionesDB.length}`);

    // Esperar a que la carga termine Y los datos estén disponibles
    if (loadingDB) {
      console.log('[CotizModule] Deep-link: esperando fin de carga DB...');
      return;
    }

    // Determinar la subcategoría según la línea
    const linea = deepLinkLinea || 'Captación';
    let targetSub: SubCategoria = 'captacion';
    if (linea === 'Crédito') targetSub = 'credito';
    else if (linea === 'Línea de Crédito') targetSub = 'linea-credito';

    const targetId = deepLinkCotizacionId;

    // ── Función de búsqueda unificada: buscar en TODAS las fuentes ──
    const searchAllSources = (): { found: boolean; type: 'cap' | 'cre'; data?: any } => {
      // 1) Buscar en cotizacionesDB (J_COTIZACIONES — fuente de verdad)
      const foundInDB = cotizacionesDB.find(c => c.id === targetId);
      if (foundInDB) {
        return { found: true, type: foundInDB.data?.lineaProducto === 'Captación' ? 'cap' : 'cre', data: foundInDB };
      }

      // 2) Buscar en cotizaciones locales de Crédito (sessionStorage)
      const foundInCredito = cotizacionesCredito.find(c => c.id === targetId);
      if (foundInCredito) return { found: true, type: 'cre', data: foundInCredito };

      // 3) Buscar en cotizaciones locales de Línea de Crédito (sessionStorage)
      const foundInLC = cotizacionesLC.find(c => c.id === targetId);
      if (foundInLC) return { found: true, type: 'cre', data: foundInLC };

      // 4) Buscar en mock data
      const foundInMockCap = MOCK_COTIZACIONES_CAPTACION.find(c => c.id === targetId);
      if (foundInMockCap) return { found: true, type: 'cap', data: foundInMockCap };

      const foundInMockCre = MOCK_COTIZACIONES_CREDITO.find(c => c.id === targetId);
      if (foundInMockCre) return { found: true, type: 'cre', data: foundInMockCre };

      const foundInMockLC = MOCK_COTIZACIONES_LC.find(c => c.id === targetId);
      if (foundInMockLC) return { found: true, type: 'cre', data: foundInMockLC };

      return { found: false };
    };

    const result = searchAllSources();

    if (result.found && result.data) {
      console.log(`[CotizModule] Deep-link: Cotización encontrada (tipo=${result.type}) → abriendo en modo ver`);
      deepLinkProcessedRef.current = true;

      setSubCategoria(targetSub);

      if (result.type === 'cap') {
        setSelectedCap(result.data as CotizacionCaptacion);
      } else {
        // Adaptar a CotizacionCredito si viene de DB
        const adapted: CotizacionCredito = {
          id: result.data.id,
          no_cotiza: result.data.no_cotiza,
          descripcion: result.data.descripcion,
          producto_id: result.data.producto_id,
          cliente_id: result.data.cliente_id,
          fecha_cotiza: result.data.fecha_cotiza,
          estatus_cotiza: result.data.estatus_cotiza,
          linea_cotizacion: result.data.linea_cotizacion,
          data: result.data.data,
        };
        setSelectedCredito(adapted);
      }

      setFormMode('view');
      setView('form');
      onDeepLinkConsumed?.();
    } else if (cotizacionesDB.length > 0) {
      // Ya cargamos datos de DB pero no encontramos → no va a aparecer
      console.warn(`[CotizModule] Deep-link: Cotización id=${targetId} NO encontrada en ninguna fuente (DB: ${cotizacionesDB.length} registros). Mostrando lista.`);
      deepLinkProcessedRef.current = true;
      setSubCategoria(targetSub);
      setView('list');
      onDeepLinkConsumed?.();
    } else {
      // DB aún no ha cargado datos (loading fue false pero cotizacionesDB está vacío → el hook no ha hecho fetch aún)
      console.log(`[CotizModule] Deep-link: Datos DB aún no disponibles (${cotizacionesDB.length} registros), esperando...`);
    }
  }, [deepLinkCotizacionId, deepLinkLinea, loadingDB, cotizacionesDB, cotizacionesCredito, cotizacionesLC]);

  // ════════════════════════════════════════════════════════════
  // FILTRADO UI — spec captacion-cotizaciones-lista.ts §2
  // El hook trae TODOS los registros de J_COTIZACIONES.
  // Filtramos por data.lineaProducto para cada subcategoría.
  // DB es fuente de verdad; sessionStorage como complemento local.
  // ════════════════════════════════════════════════════════════
  const cotizacionesCapDB = cotizacionesDB.filter(
    c => c.data?.lineaProducto === 'Captación'
  );
  const cotizacionesCap = cotizacionesCapDB.length > 0 ? cotizacionesCapDB : MOCK_COTIZACIONES_CAPTACION;

  // ── Crédito: filtrar de BD + merge con sessionStorage local ──
  const cotizacionesCreDB: CotizacionCredito[] = cotizacionesDB
    .filter(c => c.data?.lineaProducto === 'Crédito')
    .map(c => ({
      id: c.id,
      no_cotiza: c.no_cotiza,
      descripcion: c.descripcion,
      producto_id: c.producto_id,
      cliente_id: c.cliente_id,
      fecha_cotiza: c.fecha_cotiza,
      estatus_cotiza: c.estatus_cotiza,
      linea_cotizacion: c.linea_cotizacion || 'Crédito',
      data: c.data as any,
    }));

  // ── Línea de Crédito: filtrar de BD + merge con sessionStorage local ──
  const cotizacionesLCDB: CotizacionCredito[] = cotizacionesDB
    .filter(c => c.data?.lineaProducto === 'Línea de Crédito')
    .map(c => ({
      id: c.id,
      no_cotiza: c.no_cotiza,
      descripcion: c.descripcion,
      producto_id: c.producto_id,
      cliente_id: c.cliente_id,
      fecha_cotiza: c.fecha_cotiza,
      estatus_cotiza: c.estatus_cotiza,
      linea_cotizacion: c.linea_cotizacion || 'Línea Crédito',
      data: c.data as any,
    }));

  // Merge: BD toma precedencia por id, luego agregar locales que no estén en BD
  const mergeDBAndLocal = (dbItems: CotizacionCredito[], localItems: CotizacionCredito[]): CotizacionCredito[] => {
    const dbIds = new Set(dbItems.map(c => c.id));
    const dbFolios = new Set(dbItems.map(c => c.no_cotiza));
    const localOnly = localItems.filter(c => !dbIds.has(c.id) && !dbFolios.has(c.no_cotiza));
    return [...dbItems, ...localOnly];
  };

  const cotizacionesCreDisplay = mergeDBAndLocal(cotizacionesCreDB, cotizacionesCredito);
  const cotizacionesLCDisplay = mergeDBAndLocal(cotizacionesLCDB, cotizacionesLC);

  // ── Captación handlers ──
  const handleNew = () => { setSelectedCap(undefined); setFormMode('create'); setView('form'); };
  const handleView = (c: CotizacionCaptacion) => { setSelectedCap(c); setFormMode('view'); setView('form'); };
  const handleEdit = (c: CotizacionCaptacion) => { setSelectedCap(c); setFormMode('edit'); setView('form'); };

  /** Crear Solicitud desde Cotización Captación — spec solicitudes-financieras §1–§4 */
  const handleCrearSolicitudCaptacion = (c: CotizacionCaptacion) => {
    if (c.estatus_cotiza === 'Aceptada') {
      toast.error('Cotización ya aceptada', { description: 'Esta cotización ya generó una solicitud.', duration: 3000 });
      return;
    }
    const nameParts = (c.data.cliente?.nombreCompleto || '').split(' ');
    const isMoral = (c.data.cliente?.nombreCompleto || '').includes('S.A.') || (c.data.cliente?.nombreCompleto || '').includes('SA de CV');
    const mappedData = {
      cotizacionId: c.no_cotiza,
      lineaProducto: 'Captación',
      tipoProducto: c.data.producto?.tipoProducto || '',
      tipoPersona: isMoral ? 'Moral' : 'Física',
      nombrePersona: nameParts[0] || '',
      apellidoPaternoPersona: nameParts[1] || '',
      apellidoMaternoPersona: nameParts.slice(2).join(' ') || '',
      productoId: c.data.producto?.claveProducto || c.producto_id || '',
      nombreProducto: c.data.producto?.nombreProducto || '',
      montoSolicitado: String(parseFloat(String(c.data.montoCotizado || '0').replace(/[^0-9.-]/g, '')) || 0),
      _terminosCondiciones: {
        montoSolicitado: String(parseFloat(String(c.data.montoCotizado || '0').replace(/[^0-9.-]/g, '')) || 0),
        fechaPrimeraAportacion: c.data.fechaPrimeraAportacion || '',
        plazo: String(c.data.plazoCumplirMontoMinimo || ''),
        frecuencia: c.data.frecuenciaCapitalizacion || c.data.periodoCumplirMontoMinimo || 'Mensual',
        tasa: String(c.data.tasaMinInteres || ''),
        tipoTasa: 'Fija',
        tipoCalculo: 'Simple',
        moneda: 'MXN',
        montoGarantia: '',
        seguroFinanciado: false,
        montoSeguro: '',
      },
    };
    onCrearSolicitudDesdeCotizacion?.(mappedData);
    toast.success('Creando Solicitud desde Cotización Captación', {
      description: `${c.no_cotiza} → Navegando al módulo Solicitudes.`,
      duration: 4000,
    });
  };

  const handleSave = async (c: CotizacionCaptacion) => {
    const result = await saveCotizacion(c);
    toast.success('Cotización guardada', {
      description: `Folio: ${c.no_cotiza}`,
    });
    setView('list');
  };

  // ── Crédito / Línea de Crédito handlers ──
  const handleNewCredito = () => { setSelectedCredito(undefined); setFormMode('create'); setView('form'); };
  const handleViewCredito = (c: CotizacionCredito) => { setSelectedCredito(c); setFormMode('view'); setView('form'); };
  const handleEditCredito = (c: CotizacionCredito) => { setSelectedCredito(c); setFormMode('edit'); setView('form'); };

  /** Crear Solicitud desde Cotización (Crédito / LC) — spec solicitudes-financieras §1–§4 */
  const handleCrearSolicitudCredito = (c: CotizacionCredito) => {
    if (c.estatus_cotiza === 'Aceptada') {
      toast.error('Cotización ya aceptada', { description: 'Esta cotización ya generó una solicitud.', duration: 3000 });
      return;
    }
    // Mapeo Cotización → Solicitud según spec §4
    const nameParts = (c.data.cliente?.nombreCompleto || '').split(' ');
    const mappedData = {
      cotizacionId: c.no_cotiza,
      lineaProducto: c.data.lineaProducto || 'Crédito',
      tipoProducto: c.data.producto?.tipoProducto || '',
      tipoPersona: (c.data.cliente?.nombreCompleto || '').includes('S.A.') || (c.data.cliente?.nombreCompleto || '').includes('SA de CV') ? 'Moral' : 'Física',
      nombrePersona: nameParts[0] || '',
      apellidoPaternoPersona: nameParts[1] || '',
      apellidoMaternoPersona: nameParts.slice(2).join(' ') || '',
      productoId: c.data.producto?.claveProducto || c.producto_id || '',
      nombreProducto: c.data.producto?.nombreProducto || '',
      montoSolicitado: Number(c.data.montoSolicitado || 0).toFixed(2),
      // Términos y condiciones para pre-llenar
      _terminosCondiciones: {
        montoSolicitado: Number(c.data.montoSolicitado || 0).toFixed(2),
        fechaPrimerPago: c.data.fechaPrimerPago || '',
        plazo: String(c.data.plazo || ''),
        frecuencia: c.data.periodo || c.data.frecuenciaPago || 'Mensual',
        tasa: String(c.data.tasaCotizada || ''),
        tipoTasa: c.data.tipoTasa || 'Fija',
        tipoCalculo: c.data.tipoCalculoAmortizacion || 'Francés',
        moneda: c.data.moneda || 'MXN',
        montoGarantia: Number(c.data.montoGarantia || 0).toFixed(2),
        seguroFinanciado: c.data.seguroFinanciado || false,
        montoSeguro: Number(c.data.montoSeguro || 0).toFixed(2),
        // Línea de Crédito — campos específicos (homologados §4)
        ...(c.data.lineaProducto === 'Línea de Crédito' ? {
          tipoLinea: c.data.tipoLinea || '',
          montoLineaAutorizada: Number((c.data as any).montoLineaAutorizada || 0).toFixed(2),
          disposicionesPermitidas: String((c.data as any).disposicionesPermitidas || ''),
          montoDisposicionMinima: Number((c.data as any).montoDisposicionMinima || 0).toFixed(2),
          vigenciaLinea: String((c.data as any).vigenciaLinea || ''),
        } : {}),
      },
    };
    // Marcar cotización como "Aceptada"
    const isCredito = subCategoria === 'credito';
    const ssKey = isCredito ? 'cotizaciones_credito_local' : 'cotizaciones_lc_local';
    const setter = isCredito ? setCotizacionesCredito : setCotizacionesLC;
    setter(prev => {
      const next = prev.map(x => x.id === c.id ? { ...x, estatus_cotiza: 'Aceptada' } : x);
      try { sessionStorage.setItem(ssKey, JSON.stringify(next)); } catch {}
      return next;
    });
    // Callback al módulo padre (App.tsx) para navegar a Solicitudes
    onCrearSolicitudDesdeCotizacion?.(mappedData);
    toast.success('Creando Solicitud desde Cotización', {
      description: `${c.no_cotiza} → El sistema navegará al módulo Solicitudes con los datos pre-llenados.`,
      duration: 4000,
    });
  };

  const handleSaveCredito = async (c: CotizacionCredito) => {
    const isCredito = subCategoria === 'credito';
    const ssKey = isCredito ? 'cotizaciones_credito_local' : 'cotizaciones_lc_local';
    const setter = isCredito ? setCotizacionesCredito : setCotizacionesLC;

    // ── Persistir en BD vía RPC (misma tabla J_COTIZACIONES) ──
    // El hook saveCotizacion acepta CotizacionCaptacion pero la estructura
    // raíz (id, no_cotiza, descripcion, etc.) es idéntica; data va como JSONB.
    const dbResult = await saveCotizacion(c as any);
    if (dbResult.ok) {
      console.log('[CotizModule] Cotización Crédito/LC guardada en BD OK');
    } else {
      console.warn('[CotizModule] Cotización Crédito/LC falló en BD, guardando localmente:', dbResult.error);
    }

    // ── También guardar en sessionStorage como cache local ──
    setter(prev => {
      const localId = c.id || `local-${Date.now()}`;
      const saved = { ...c, id: localId };
      const idx = prev.findIndex(x => x.id === saved.id || x.no_cotiza === c.no_cotiza);
      let next: CotizacionCredito[];
      if (idx >= 0) { next = [...prev]; next[idx] = saved; } else { next = [...prev, saved]; }
      try { sessionStorage.setItem(ssKey, JSON.stringify(next)); } catch {}
      return next;
    });

    toast.success('Cotización guardada', { description: `Folio: ${c.no_cotiza}` });
    setView('list');

    // Refetch para sincronizar la lista con BD
    if (dbResult.ok) {
      setTimeout(() => refetch(), 500);
    }
  };

  // ── Cambiar subcategoría resetea la vista ──
  const handleSubCategoriaChange = (sc: SubCategoria) => {
    setSubCategoria(sc);
    setView('list');
  };

  // ── Subcategoría config ──
  const subCats: { id: SubCategoria; label: string }[] = [
    { id: 'captacion', label: 'Cotizaciones Captación' },
    { id: 'credito', label: 'Cotizaciones Crédito' },
    { id: 'linea-credito', label: 'Cotizaciones Línea de Crédito' },
  ];

  return (
    <>
      {/* ═══ Barra de subcategorías — estilo Productos ═══ */}
      <div className="bg-white border-b border-gray-300 px-4 py-2.5">
        <div className="flex items-center gap-1">
          {subCats.map(sc => {
            const isActive = subCategoria === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => handleSubCategoriaChange(sc.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-theme text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {/* Hamburger icon */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3.5h10M2 7h10M2 10.5h10" />
                </svg>
                <span>{sc.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Contenido según subcategoría y vista ═══ */}
      {subCategoria === 'captacion' ? (
        <>
          {view === 'list' ? (
            <CotizacionCaptacionList
              cotizaciones={cotizacionesCap}
              onNew={handleNew}
              onView={handleView}
              onEdit={handleEdit}
              loading={loadingDB}
              warning={warningDB}
              backendStatus={backendStatus}
              fetchMethod={fetchMethod}
              onRefresh={refetch}
              onSeedTest={seedTestRecord}
              dbRowCount={cotizacionesDB.length}
              onCrearSolicitud={handleCrearSolicitudCaptacion}
            />
          ) : (
            <CotizacionCaptacionForm mode={formMode} cotizacion={selectedCap} onSave={handleSave} onBack={() => setView('list')} onCrearSolicitud={handleCrearSolicitudCaptacion} />
          )}
        </>
      ) : subCategoria === 'credito' ? (
        <>
          {view === 'list' ? (
            <CotizacionCreditoList
              cotizaciones={cotizacionesCreDisplay}
              lineaLabel="Crédito"
              onNew={handleNewCredito}
              onView={handleViewCredito}
              onEdit={handleEditCredito}
              loading={loadingDB}
              onRefresh={refetch}
              onCrearSolicitud={handleCrearSolicitudCredito}
            />
          ) : (
            <CotizacionCreditoForm
              mode={formMode}
              lineaProducto="Crédito"
              cotizacion={selectedCredito}
              onSave={handleSaveCredito}
              onBack={() => setView('list')}
              onCrearSolicitud={handleCrearSolicitudCredito}
            />
          )}
        </>
      ) : (
        <>
          {view === 'list' ? (
            <CotizacionCreditoList
              cotizaciones={cotizacionesLCDisplay}
              lineaLabel="Línea de Crédito"
              onNew={handleNewCredito}
              onView={handleViewCredito}
              onEdit={handleEditCredito}
              loading={loadingDB}
              onRefresh={refetch}
              onCrearSolicitud={handleCrearSolicitudCredito}
            />
          ) : (
            <CotizacionCreditoForm
              mode={formMode}
              lineaProducto="Línea de Crédito"
              cotizacion={selectedCredito}
              onSave={handleSaveCredito}
              onBack={() => setView('list')}
              onCrearSolicitud={handleCrearSolicitudCredito}
            />
          )}
        </>
      )}
    </>
  );
}