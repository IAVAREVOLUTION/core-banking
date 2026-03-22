/**
 * PersonasRelacionadas.tsx — v2.2
 *
 * ═══════════════════════════════════════════════════════════════════
 * Subtab: Personas Relacionadas — Módulo Clientes
 *
 * ESTRUCTURA INSTITUCIONAL (spec: related-persons-refactor.md + related-person-logic.md + related-person-bug.md):
 *   - Relación física → par_cliente_id (FK auto-referencial en J_CLIENTES)
 *   - Relación lógica → data.personasRelacionadas[] (array en JSONB)
 *
 * v2.2 CAMBIOS (spec: related-person-bug.md):
 *   - Fix: mapRowsToClientes ahora hace JSON.parse safety si row.data viene como string
 *   - Fix: fetchClienteByUuid ahora tiene fallback a sessionStorage (INTENTO 3)
 *   - Fix: INTENTO 3 de fetchClientesDisponibles ahora también escanea jclientes_cache
 *   - Fix: Mejor extracción de campos con aliases múltiples (denominacionRazonSocial, etc.)
 *   - Fix: Validación robusta de que ClienteDisponible tiene datos antes de agregar
 *
 * v2.1 CAMBIOS (spec: related-person-logic.md):
 *   - Agrega campos curp, nombreCompleto, estatusCliente al JSON guardado (§4)
 *   - Valida nombre, RFC y personalidad antes de agregar (§7)
 *   - No permite guardar objetos vacíos ni incompletos (§7)
 *   - FK persona (par_cliente_id) también incluye curp/nombreCompleto/estatusCliente
 *
 * v2.0 CAMBIOS:
 *   - Resuelve par_cliente_id al abrir el subtab: busca el cliente
 *     relacionado y lo muestra como fila con badge "FK Principal"
 *   - Permite marcar UNA relación como principal (estrella)
 *   - Propaga cambios de par_cliente_id al parent vía callback
 *   - Eliminados estados sin uso (editingId, editForm)
 *
 * FLUJO DE DATOS:
 *   personasRelacionadas[] ← parent (AltaClienteDefault) ← _rawData
 *   par_cliente_id         ← parent ← columna física J_CLIENTES
 *   Al guardar, parent incluye ambos en syncToJClientes
 *
 * ═══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Search, UserPlus, Trash2, X, Users, AlertCircle, Loader2, Star } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════

export interface PersonaRelacionada {
  id: number;
  clienteUuid?: string;       // UUID real en J_CLIENTES (para par_cliente_id)
  claveCliente: string;
  rfc: string;
  nombre: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombreCliente?: string;     // compat legacy
  nombreCompleto?: string;    // spec §4: nombre concatenado
  curp?: string;              // spec §4: CURP del cliente relacionado
  personalidad: string;
  fechaNacimiento: string;
  estatus: string;
  estatusCliente?: string;    // spec §4: alias de estatus
  tipoRelacion: string;
  esPrincipal?: boolean;      // true = relación física (par_cliente_id)
  fechaRegistro?: string;
  seleccionada: boolean;
}

interface ClienteDisponible {
  dbUuid: string;
  idCliente: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  rfc: string;
  curp: string;
  personalidad: string;
  fechaNacimiento: string;
  estatus: string;
}

interface PersonasRelacionadasProps {
  clienteId: string;
  clienteUuid?: string;       // UUID real del cliente actual (para validar auto-referencia)
  isView: boolean;
  mode: 'nuevo' | 'editar' | 'ver';
  personasRelacionadas: PersonaRelacionada[];
  setPersonasRelacionadas: (items: PersonaRelacionada[] | ((prev: PersonaRelacionada[]) => PersonaRelacionada[])) => void;
  parClienteId?: string | null;
  /** Callback para propagar cambio de par_cliente_id al parent */
  onParClienteIdChange?: (newParClienteId: string | null) => void;
  /** Callback para notificar cambios (para persistencia DB) */
  onChange?: (items: PersonaRelacionada[]) => void;
}

// ═══════════════════════════════════════════════════════════════════
// TIPOS DE RELACIÓN — Catálogo institucional
// ═══════════════════════════════════════════════════════════════════
const TIPOS_RELACION = [
  'Cónyuge',
  'Padre',
  'Madre',
  'Hijo/a',
  'Hermano/a',
  'Abuelo/a',
  'Nieto/a',
  'Tío/a',
  'Sobrino/a',
  'Primo/a',
  'Suegro/a',
  'Yerno/Nuera',
  'Cuñado/a',
  'Socio',
  'Representante Legal',
  'Apoderado',
  'Tutor',
  'Aval',
  'Beneficiario',
  'Referencia Personal',
  'Referencia Comercial',
  'Otro',
];

// ═══════════════════════════════════════════════════════════════════
// CARGA DE CLIENTES DISPONIBLES (multi-intento)
// ═══════════════════════════════════════════════════════════════════

async function fetchClientesDisponibles(): Promise<ClienteDisponible[]> {
  const TAG = '[PersonasRelacionadasDB]';

  // ── INTENTO 1: Supabase schema directo ──
  try {
    console.log(`${TAG} INTENTO 1: schema directo`);
    const { data, error } = await supabase
      .schema('EFINANCIANET_DB')
      .from('J_CLIENTES')
      .select('id, type, subtipo, estatus, data');

    if (!error && data && data.length > 0) {
      console.log(`${TAG} INTENTO 1 ÉXITO: ${data.length} registros`);
      return mapRowsToClientes(data);
    }
    if (error) console.debug(`${TAG} INTENTO 1 falló:`, error.message);
  } catch (err) {
    console.debug(`${TAG} INTENTO 1 excepción:`, err);
  }

  // ── INTENTO 2: Supabase RPC ──
  try {
    console.log(`${TAG} INTENTO 2: RPC get_all_jclientes`);
    const { data, error } = await supabase.rpc('get_all_jclientes');

    if (!error && data && data.length > 0) {
      console.log(`${TAG} INTENTO 2 ÉXITO: ${data.length} registros`);
      return mapRowsToClientes(data);
    }
    if (error) console.debug(`${TAG} INTENTO 2 falló:`, error.message);
  } catch (err) {
    console.debug(`${TAG} INTENTO 2 excepción:`, err);
  }

  // ── INTENTO 3: sessionStorage ──
  try {
    console.log(`${TAG} INTENTO 3: sessionStorage`);
    const keys = Object.keys(sessionStorage);
    const clientes: ClienteDisponible[] = [];

    // v2.2 FIX: También escanear jclientes_cache si existe (cache de sincronización)
    for (const key of keys) {
      // Scan jclientes_cache entries (array of full rows from J_CLIENTES)
      if (key.startsWith('jclientes_') || key === 'jclientes_cache') {
        try {
          const saved = sessionStorage.getItem(key);
          if (!saved) continue;
          const stored = JSON.parse(saved);
          const rows = Array.isArray(stored) ? stored : (stored.rows || stored.data || []);
          if (Array.isArray(rows) && rows.length > 0) {
            console.log(`${TAG} INTENTO 3: Encontrado ${key} con ${rows.length} rows`);
            const mapped = mapRowsToClientes(rows);
            if (mapped.length > 0) {
              console.log(`${TAG} INTENTO 3 ÉXITO desde ${key}: ${mapped.length} clientes`);
              return mapped;
            }
          }
        } catch {
          // skip corrupt cache
        }
      }
    }

    // Scan individual cliente_ keys (form data from useClientePersistence)
    for (const key of keys) {
      if (key.startsWith('cliente_') && !key.includes('_list') && !key.includes('_active_tab')
          && !key.includes('_kyc') && !key.includes('_garantias') && !key.includes('_perfil')
          && !key.includes('_solicitudes') && !key.includes('_creditos') && !key.includes('_inversiones')
          && !key.includes('_movimientos') && !key.includes('_avisos') && !key.includes('_auditoria')
          && !key.includes('_archivos') && !key.includes('_convenios') && !key.includes('_cobranza')
          && !key.includes('_estado_cuenta') && !key.includes('_calendario') && !key.includes('_cuentas')
          && !key.includes('_expedientes') && !key.includes('_sic') && !key.includes('_consultas')
          && !key.includes('_personas_relacionadas') && !key.includes('_listas_negras')
          && !key.includes('_direcciones') && !key.includes('_tarjeta')) {
        try {
          const saved = sessionStorage.getItem(key);
          if (!saved) continue;
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const nombre = parsed.nombre || parsed.denominacionRazonSocial || parsed.razonSocial || '';
            if (!nombre) continue;
            const apellidoPaterno = parsed.apellidoPaterno || '';
            const apellidoMaterno = parsed.apellidoMaterno || '';
            clientes.push({
              dbUuid: key.replace('cliente_', ''),
              idCliente: parsed.idCliente || '',
              nombre,
              apellidoPaterno,
              apellidoMaterno,
              nombreCompleto: [nombre, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ') || 'Sin nombre',
              rfc: parsed.rfc || '',
              curp: parsed.curp || '',
              personalidad: parsed.personalidad || '',
              fechaNacimiento: parsed.fechaNacimiento || '',
              estatus: parsed.estatusCliente || 'Activo',
            });
          }
        } catch {
          // skip corrupt entries
        }
      }
    }

    if (clientes.length > 0) {
      console.log(`${TAG} INTENTO 3 ÉXITO: ${clientes.length} registros desde sessionStorage`);
      return clientes;
    }
  } catch (err) {
    console.debug(`${TAG} INTENTO 3 excepción:`, err);
  }

  console.log(`${TAG} Todos los intentos fallaron — retornando []`);
  return [];
}

/** Busca un solo cliente por UUID — para resolver par_cliente_id */
async function fetchClienteByUuid(uuid: string): Promise<ClienteDisponible | null> {
  const TAG = '[PersonasRelacionadasDB]';

  // ── INTENTO 1: Supabase schema directo ──
  try {
    const { data, error } = await supabase
      .schema('EFINANCIANET_DB')
      .from('J_CLIENTES')
      .select('id, type, subtipo, estatus, data')
      .eq('id', uuid)
      .single();

    if (!error && data) {
      const mapped = mapRowsToClientes([data]);
      return mapped[0] || null;
    }
    if (error) console.debug(`${TAG} Resolve par_cliente_id falló (schema):`, error.message);
  } catch (err) {
    console.debug(`${TAG} Resolve par_cliente_id excepción (schema):`, err);
  }

  // ── INTENTO 2: RPC ──
  try {
    const { data, error } = await supabase.rpc('get_all_jclientes');
    if (!error && data) {
      const found = (data as any[]).find((r: any) => r.id === uuid);
      if (found) {
        const mapped = mapRowsToClientes([found]);
        return mapped[0] || null;
      }
    }
  } catch (err) {
    console.debug(`${TAG} Resolve par_cliente_id excepción (RPC):`, err);
  }

  // ── INTENTO 3: sessionStorage ──
  try {
    const key = `cliente_${uuid}`;
    const saved = sessionStorage.getItem(key);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.nombre) {
      const nombre = parsed.nombre || '';
      const apellidoPaterno = parsed.apellidoPaterno || '';
      const apellidoMaterno = parsed.apellidoMaterno || '';
      return {
        dbUuid: key.replace('cliente_', ''),
        idCliente: parsed.idCliente || '',
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        nombreCompleto: [nombre, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ') || 'Sin nombre',
        rfc: parsed.rfc || '',
        curp: parsed.curp || '',
        personalidad: parsed.personalidad || '',
        fechaNacimiento: parsed.fechaNacimiento || '',
        estatus: parsed.estatusCliente || 'Activo',
      };
    }
  } catch (err) {
    console.debug(`${TAG} Resolve par_cliente_id excepción (sessionStorage):`, err);
  }

  return null;
}

function mapRowsToClientes(rows: any[]): ClienteDisponible[] {
  return rows.map((row: any) => {
    // v2.2 FIX: JSON.parse safety — si row.data viene como string (posible en RPC), parsearlo
    let rawData = row.data;
    if (typeof rawData === 'string') {
      try {
        rawData = JSON.parse(rawData);
      } catch {
        console.debug('[PersonasRelacionadasDB] row.data es string no-parseable, saltando');
        rawData = {};
      }
    }
    const d = (rawData || {}) as Record<string, any>;
    const def = (d.default || {}) as Record<string, any>;
    // v2.2 FIX: gMulti — busca con aliases múltiples, igual que AltaClienteDefault
    const g = (...keys: string[]): string => {
      for (const key of keys) {
        if (d[key] != null && d[key] !== '') return String(d[key]);
        if (def[key] != null && def[key] !== '') return String(def[key]);
      }
      return '';
    };

    const nombre = g('nombre');
    const apellidoPaterno = g('apellidoPaterno');
    const apellidoMaterno = g('apellidoMaterno');
    // Para Persona Moral, el nombre puede estar en denominacionRazonSocial
    const razonSocial = g('denominacionRazonSocial', 'razonSocial');
    const displayNombre = nombre || razonSocial;

    return {
      dbUuid: row.id,
      idCliente: g('idCliente', 'idProspecto'),
      nombre: displayNombre,
      apellidoPaterno,
      apellidoMaterno,
      nombreCompleto: displayNombre
        ? [displayNombre, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ')
        : 'Sin nombre',
      rfc: g('rfc'),
      curp: g('curp'),
      personalidad: row.subtipo || g('personalidad', 'tipo', 'tipoPersona'),
      fechaNacimiento: g('fechaNacimiento', 'fechaConstitucion', 'fechaNac'),
      estatus: row.estatus || g('estatusCliente', 'estatus') || '',
    };
  });
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export function PersonasRelacionadas({
  clienteId,
  clienteUuid,
  isView,
  mode,
  personasRelacionadas,
  setPersonasRelacionadas,
  parClienteId,
  onParClienteIdChange,
  onChange,
}: PersonasRelacionadasProps) {
  console.log('[PersonasRelacionadas] Render - items:', personasRelacionadas?.length, '| clienteId:', clienteId, '| mode:', mode);
  // ── Modal state ──
  const [showModal, setShowModal] = useState(false);
  const [clientesDisponibles, setClientesDisponibles] = useState<ClienteDisponible[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('-Todos-');

  // ── par_cliente_id resolution ──
  const [resolvedParCliente, setResolvedParCliente] = useState<ClienteDisponible | null>(null);
  const resolvedRef = useRef<string | null>(null);

  // ── Derived state ──
  const items = Array.isArray(personasRelacionadas) ? personasRelacionadas : [];
  const todasSeleccionadas = items.length > 0 && items.every(i => i.seleccionada);
  const algunaSeleccionada = items.some(i => i.seleccionada);

  // ═══════════════════════════════════════════════════════════════════
  // RESOLVER par_cliente_id → cliente visible
  // Spec §3.1: "Si par_cliente_id existe → mostrarlo como relación principal"
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!parClienteId || parClienteId === resolvedRef.current) return;
    resolvedRef.current = parClienteId;
    console.log(`[PersonasRelacionadas] Resolviendo par_cliente_id: ${parClienteId}`);

    fetchClienteByUuid(parClienteId).then(cliente => {
      if (!cliente) return;
      setResolvedParCliente(cliente);
      console.log(`[PersonasRelacionadas] par_cliente_id resuelto → ${cliente.nombreCompleto}`);

      // Use updater form to avoid stale `items` reference
      setPersonasRelacionadas((prev: PersonaRelacionada[]) => {
        const currentItems = Array.isArray(prev) ? prev : [];
        // Already in list and marked principal? No-op
        if (currentItems.some(p => p.clienteUuid === parClienteId && p.esPrincipal)) {
          return prev;
        }
        // Already in list but not marked? Just mark it
        if (currentItems.some(p => p.clienteUuid === parClienteId)) {
          return currentItems.map(p =>
            p.clienteUuid === parClienteId ? { ...p, esPrincipal: true } : p
          );
        }
        // Not in list — inject as first entry
        const fkPersona: PersonaRelacionada = {
          id: currentItems.length > 0 ? Math.max(...currentItems.map(p => p.id)) + 1 : 1,
          clienteUuid: cliente.dbUuid,
          claveCliente: cliente.idCliente || cliente.dbUuid.substring(0, 8),
          rfc: cliente.rfc,
          curp: cliente.curp || '',
          nombre: cliente.nombre,
          apellidoPaterno: cliente.apellidoPaterno,
          apellidoMaterno: cliente.apellidoMaterno,
          nombreCliente: cliente.nombreCompleto,
          nombreCompleto: cliente.nombreCompleto,
          personalidad: cliente.personalidad,
          fechaNacimiento: cliente.fechaNacimiento,
          estatus: cliente.estatus || 'Activo',
          estatusCliente: cliente.estatus || 'Activo',
          tipoRelacion: '',
          esPrincipal: true,
          fechaRegistro: '',
          seleccionada: false,
        };
        return [fkPersona, ...currentItems];
      });
    });
  }, [parClienteId]); // intentionally minimal deps — uses updater form for current state

  // ═══════════════════════════════════════════════════════════════════
  // CARGAR CLIENTES DISPONIBLES al abrir modal
  // ═══════════════════════════════════════════════════════════════════
  const handleOpenModal = useCallback(async () => {
    setShowModal(true);
    setSearchTerm('');
    setFilterTipo('-Todos-');

    if (clientesDisponibles.length === 0) {
      setLoadingClientes(true);
      try {
        const clientes = await fetchClientesDisponibles();
        setClientesDisponibles(clientes);
      } catch (err) {
        console.error('[PersonasRelacionadas] Error al cargar clientes:', err);
        toast.error('Error al cargar lista de clientes');
      } finally {
        setLoadingClientes(false);
      }
    }
  }, [clientesDisponibles.length]);

  // ═══════════════════════════════════════════════════════════════════
  // FILTRADO de clientes en el modal
  // ═══════════════════════════════════════════════════════════════════
  const clientesFiltrados = useMemo(() => {
    let filtered = clientesDisponibles;

    // Excluir el cliente actual (no auto-referencia — spec §8)
    if (clienteUuid) {
      filtered = filtered.filter(c => c.dbUuid !== clienteUuid);
    }

    // Excluir clientes ya relacionados (no duplicados — spec §8)
    const uuidsRelacionados = new Set(items.map(p => p.clienteUuid).filter(Boolean));
    filtered = filtered.filter(c => !uuidsRelacionados.has(c.dbUuid));

    // Filtro por tipo/personalidad
    if (filterTipo !== '-Todos-') {
      filtered = filtered.filter(c => {
        const p = (c.personalidad || '').toLowerCase();
        if (filterTipo === 'Persona Física') return p.includes('física') || p.includes('fisica');
        if (filterTipo === 'Persona Moral') return p.includes('moral');
        return true;
      });
    }

    // Filtro por búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.nombreCompleto.toLowerCase().includes(term) ||
        c.rfc.toLowerCase().includes(term) ||
        c.curp.toLowerCase().includes(term) ||
        c.idCliente.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [clientesDisponibles, clienteUuid, items, filterTipo, searchTerm]);

  // ═══════════════════════════════════════════════════════════════════
  // AGREGAR persona relacionada — spec §5
  // ═══════════════════════════════════════════════════════════════════
  const handleAgregar = useCallback((cliente: ClienteDisponible) => {
    // Validación: no duplicados (spec §8)
    const yaExiste = items.some(p => p.clienteUuid === cliente.dbUuid);
    if (yaExiste) {
      toast.error('Este cliente ya está como persona relacionada');
      return;
    }

    // Validación: no auto-referencia (spec §8)
    if (clienteUuid && cliente.dbUuid === clienteUuid) {
      toast.error('No se puede relacionar un cliente consigo mismo');
      return;
    }

    // Validación spec §7: No permitir guardar sin nombre, RFC o personalidad
    if (!cliente.nombreCompleto || cliente.nombreCompleto === 'Sin nombre') {
      toast.error('No se puede agregar un cliente sin nombre');
      return;
    }
    if (!cliente.rfc) {
      toast.error('No se puede agregar un cliente sin RFC');
      return;
    }
    if (!cliente.personalidad) {
      toast.error('No se puede agregar un cliente sin personalidad');
      return;
    }

    const formatDate = () => {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const newId = items.length > 0 ? Math.max(...items.map(p => p.id)) + 1 : 1;
    // spec §4: Construir objeto JSON completo con TODOS los datos del cliente
    const nuevaPersona: PersonaRelacionada = {
      id: newId,
      clienteUuid: cliente.dbUuid,
      claveCliente: cliente.idCliente || cliente.dbUuid.substring(0, 8),
      rfc: cliente.rfc,
      curp: cliente.curp || '',
      nombre: cliente.nombre,
      apellidoPaterno: cliente.apellidoPaterno,
      apellidoMaterno: cliente.apellidoMaterno,
      nombreCliente: cliente.nombreCompleto,
      nombreCompleto: cliente.nombreCompleto,
      personalidad: cliente.personalidad,
      fechaNacimiento: cliente.fechaNacimiento,
      estatus: cliente.estatus || 'Activo',
      estatusCliente: cliente.estatus || 'Activo',
      tipoRelacion: '',
      esPrincipal: false,
      fechaRegistro: formatDate(),
      seleccionada: false,
    };

    setPersonasRelacionadas([...items, nuevaPersona]);
    setShowModal(false);
    toast.success(`${cliente.nombreCompleto} agregado como persona relacionada`);
    
    // Notificar al parent para persistencia DB
    if (onChange) {
      const updatedItems = [...items, nuevaPersona];
      console.log('[PersonasRelacionadas] Notificando onChange - total items:', updatedItems.length);
      onChange(updatedItems);
    }
  }, [items, clienteUuid, setPersonasRelacionadas, onChange]);

  // ═══════════════════════════════════════════════════════════════════
  // ELIMINAR personas seleccionadas — spec §7
  // ═══════════════════════════════════════════════════════════════════
  const handleEliminarSeleccionadas = useCallback(() => {
    const seleccionadas = items.filter(i => i.seleccionada);
    if (seleccionadas.length === 0) return;

    const confirmMsg = seleccionadas.length === 1
      ? `¿Eliminar la relación con "${seleccionadas[0].nombreCliente || seleccionadas[0].nombre}"?`
      : `¿Eliminar ${seleccionadas.length} relaciones seleccionadas?`;

    if (!confirm(confirmMsg)) return;

    // spec §7.2: Si eliminamos la relación principal → limpiar par_cliente_id
    const eliminaPrincipal = seleccionadas.some(s => s.esPrincipal);
    if (eliminaPrincipal && onParClienteIdChange) {
      onParClienteIdChange(null);
      console.log('[PersonasRelacionadas] Relación principal eliminada → par_cliente_id = NULL');
    }

    const updatedItems = items.filter(i => !i.seleccionada);
    setPersonasRelacionadas(updatedItems);
    toast.success(`${seleccionadas.length} relación(es) eliminada(s)`);
    
    if (onChange) {
      console.log('[PersonasRelacionadas] Notificando onChange - eliminar');
      onChange(updatedItems);
    }
  }, [items, setPersonasRelacionadas, onParClienteIdChange, onChange]);

  // ═══════════════════════════════════════════════════════════════════
  // MARCAR COMO PRINCIPAL — spec §5.1 (par_cliente_id)
  // Solo una persona puede ser principal a la vez
  // ═══════════════════════════════════════════════════════════════════
  const handleTogglePrincipal = useCallback((id: number) => {
    const persona = items.find(p => p.id === id);
    if (!persona) return;

    const newPrincipal = !persona.esPrincipal;

    // Si estamos marcando como principal, desmarcar la anterior
    const updated = items.map(p => ({
      ...p,
      esPrincipal: p.id === id ? newPrincipal : false,
    }));

    setPersonasRelacionadas(updated);

    // Propagar par_cliente_id al parent
    if (onParClienteIdChange) {
      const newParId = newPrincipal ? (persona.clienteUuid || null) : null;
      onParClienteIdChange(newParId);
      console.log(`[PersonasRelacionadas] par_cliente_id → ${newParId || 'NULL'}`);
    }

    toast.success(
      newPrincipal
        ? `${persona.nombreCliente || persona.nombre} marcado como relación principal (par_cliente_id)`
        : 'Relación principal desmarcada'
    );

    if (onChange) {
      console.log('[PersonasRelacionadas] Notificando onChange - toggle principal');
      onChange(updated);
    }
  }, [items, setPersonasRelacionadas, onParClienteIdChange, onChange]);

  // ═══════════════════════════════════════════════════════════════════
  // SELECCIÓN
  // ═══════════════════════════════════════════════════════════════════
  const handleToggleSeleccion = useCallback((id: number) => {
    setPersonasRelacionadas(items.map(i =>
      i.id === id ? { ...i, seleccionada: !i.seleccionada } : i
    ));
  }, [items, setPersonasRelacionadas]);

  const handleSeleccionarTodas = useCallback((checked: boolean) => {
    setPersonasRelacionadas(items.map(i => ({ ...i, seleccionada: checked })));
  }, [items, setPersonasRelacionadas]);

  // ═══════════════════════════════════════════════════════════════════
  // EDICIÓN INLINE — spec §6.2
  // ═══════════════════════════════════════════════════════════════════
  const handleUpdateField = useCallback((id: number, field: string, value: string) => {
    const updated = items.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    );
    setPersonasRelacionadas(updated);
    
    if (onChange) {
      console.log('[PersonasRelacionadas] Notificando onChange - update field:', field);
      onChange(updated);
    }
  }, [items, setPersonasRelacionadas, onChange]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════════
  const displayName = (p: PersonaRelacionada) => {
    if (p.nombreCliente) return p.nombreCliente;
    return [p.nombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ') || 'Sin nombre';
  };

  return (
    <div>
      {/* ══════════════ ENCABEZADO ══════════════ */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
          <Users className="w-4 h-4" />
          PERSONAS RELACIONADAS
          {items.length > 0 && (
            <span className="text-xs font-normal text-gray-500">({items.length})</span>
          )}
        </span>
        {!isView && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenModal}
              className="px-4 py-1.5 btn-secondary-theme rounded text-xs font-medium flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Nuevo
            </button>
            <button
              onClick={handleEliminarSeleccionadas}
              disabled={!algunaSeleccionada}
              className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-xs hover:bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed font-medium flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* ══════════════ INFO par_cliente_id ══════════════ */}
      {parClienteId && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Relación física (par_cliente_id):</strong>{' '}
            <span className="font-mono">{parClienteId.substring(0, 8)}...</span>
            {resolvedParCliente && (
              <> — <strong>{resolvedParCliente.nombreCompleto}</strong></>
            )}
            {' '}| FK directa en J_CLIENTES. Use la estrella
            <Star className="w-3 h-3 inline mx-0.5 text-amber-600 fill-amber-600" />
            para cambiar la relación principal.
          </span>
        </div>
      )}

      {/* ══════════════ TABLA PRINCIPAL ══════════════ */}
      <div className="border border-gray-300">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
              {!isView && (
                <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={todasSeleccionadas}
                    onChange={(e) => handleSeleccionarTodas(e.target.checked)}
                    className="w-4 h-4"
                    title="Seleccionar todas"
                  />
                </th>
              )}
              {!isView && (
                <th className="px-2 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '36px' }}
                  title="Relación Principal (par_cliente_id)">
                  <Star className="w-3.5 h-3.5 mx-auto text-gray-500" />
                </th>
              )}
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Clave Cliente</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">RFC</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Nombre</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Personalidad</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha Nac./Constitución</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Estatus</th>
              <th className="px-3 py-2 text-left font-medium text-xs text-gray-800">
                Tipo Relación <span className="text-red-600">*</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={isView ? 8 : 9} className="px-3 py-8 text-center text-gray-400 text-xs">
                  No hay personas relacionadas registradas.
                  {!isView && ' Presione "Nuevo" para agregar una relación.'}
                </td>
              </tr>
            ) : (
              items.map((persona) => (
                <tr
                  key={persona.id}
                  className={`border-b border-gray-300 ${persona.esPrincipal ? 'bg-blue-50/70' : ''}`}
                >
                  {!isView && (
                    <td className="px-3 py-2 text-center border-r border-gray-300" style={{ paddingTop: '10px' }}>
                      <input
                        type="checkbox"
                        checked={persona.seleccionada || false}
                        onChange={() => handleToggleSeleccion(persona.id)}
                        className="w-4 h-4"
                        title="Seleccionar"
                      />
                    </td>
                  )}
                  {!isView && (
                    <td className="px-2 py-2 text-center border-r border-gray-300">
                      <button
                        onClick={() => handleTogglePrincipal(persona.id)}
                        className="p-0.5 rounded hover:bg-amber-100 transition-colors"
                        title={persona.esPrincipal ? 'Desmarcar como relación principal' : 'Marcar como relación principal (par_cliente_id)'}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            persona.esPrincipal
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-gray-300 hover:text-amber-400'
                          }`}
                        />
                      </button>
                    </td>
                  )}
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                    {persona.claveCliente}
                    {persona.esPrincipal && (
                      <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">FK</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{persona.rfc || ''}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{displayName(persona)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{persona.personalidad || ''}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{persona.fechaNacimiento || ''}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      persona.estatus === 'Activo' ? 'bg-green-100 text-green-700' :
                      persona.estatus === 'Inactivo' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {persona.estatus || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-r border-gray-300">
                    <select
                      value={persona.tipoRelacion || ''}
                      onChange={(e) => handleUpdateField(persona.id, 'tipoRelacion', e.target.value)}
                      disabled={isView}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Seleccionar...</option>
                      {TIPOS_RELACION.map(tipo => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Fecha de registro info */}
      {items.length > 0 && (
        <div className="mt-2 text-[10px] text-gray-400 px-1 flex items-center justify-between">
          <span>
            {items.filter(p => p.fechaRegistro).length > 0 && (
              <>Última relación registrada: {items[items.length - 1]?.fechaRegistro}</>
            )}
          </span>
          <span>
            {items.some(p => p.esPrincipal) && (
              <span className="text-blue-600">
                <Star className="w-3 h-3 inline mr-0.5 fill-amber-500 text-amber-500" />
                Relación principal activa (par_cliente_id)
              </span>
            )}
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Buscar y Agregar Persona Relacionada
          ══════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl mx-4 overflow-hidden animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-[#4A6FA5] px-5 py-3 flex items-center justify-between">
              <h2 className="text-white text-sm font-semibold flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Agregar Persona Relacionada
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info Banner */}
            <div className="px-5 py-2 bg-blue-50 border-b border-blue-100">
              <p className="text-xs text-blue-700">
                Seleccione un cliente existente para relacionarlo con este cliente.
                La relación se guardará automáticamente.
              </p>
            </div>

            {/* Filtros */}
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]"
                >
                  <option>-Todos-</option>
                  <option>Persona Física</option>
                  <option>Persona Moral</option>
                </select>

                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre, RFC, CURP o clave..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]"
                    autoFocus
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  {loadingClientes
                    ? 'Consultando clientes...'
                    : `${clientesFiltrados.length} cliente(s) encontrado(s)`}
                </span>
                {clientesDisponibles.length > 0 && (
                  <span className="text-[10px] text-gray-400">
                    de {clientesDisponibles.length} clientes en base de datos
                  </span>
                )}
              </div>
            </div>

            {/* Tabla de resultados */}
            <div className="max-h-[400px] overflow-auto">
              {loadingClientes ? (
                <div className="flex items-center justify-center py-16 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mr-3 text-[#4A6FA5]" />
                  <span className="text-sm">Cargando clientes disponibles...</span>
                </div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    {clientesDisponibles.length === 0
                      ? 'No hay clientes en la base de datos'
                      : 'No se encontraron clientes'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {clientesDisponibles.length === 0
                      ? 'Verifique la conexión a la base de datos'
                      : 'Intente con otros términos de búsqueda'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">Clave</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">Nombre Completo</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">RFC</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">Tipo</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-600">Estatus</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-600">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clientesFiltrados.map((cliente) => {
                      const isAlreadyRelated = items.some(p => p.clienteUuid === cliente.dbUuid);
                      const isSelf = cliente.dbUuid === clienteUuid;
                      const isDisabled = isAlreadyRelated || isSelf;
                      
                      return (
                        <tr
                          key={cliente.dbUuid}
                          className={`hover:bg-blue-50/50 transition-colors ${isDisabled ? 'bg-gray-50/50' : ''}`}
                        >
                          <td className="px-4 py-2.5 font-medium text-gray-700">{cliente.idCliente}</td>
                          <td className="px-4 py-2.5 text-gray-800">{cliente.nombreCompleto}</td>
                          <td className="px-4 py-2.5 text-gray-600 font-mono">{cliente.rfc}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              cliente.personalidad?.toLowerCase().includes('física') || cliente.personalidad?.toLowerCase().includes('fisica')
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {cliente.personalidad || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              cliente.estatus === 'Activo' ? 'bg-green-100 text-green-700' :
                              cliente.estatus === 'Inactivo' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {cliente.estatus || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => handleAgregar(cliente)}
                              disabled={isDisabled}
                              className={`px-4 py-1.5 rounded text-xs font-medium transition-all ${
                                isDisabled
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-[#4A6FA5] text-white hover:bg-[#3E5C91] shadow-sm hover:shadow'
                              }`}
                            >
                              {isAlreadyRelated ? 'Ya agregado' : isSelf ? 'Auto-ref' : '+ Agregar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
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