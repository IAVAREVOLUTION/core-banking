import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DatePicker } from './DatePicker';

interface Evento {
  id: number;
  fecha: string;
  titulo: string;
  descripcion: string;
  tipo: 'Cita' | 'Recordatorio' | 'Pago' | 'Seguimiento' | 'Vencimiento';
  hora: string;
  completado: boolean;
  seleccionado: boolean;
}

interface CalendarioProps {
  clienteId?: string;
  mode?: 'nuevo' | 'editar' | 'ver';
  isView?: boolean;
}

export function Calendario({ clienteId, mode, isView }: CalendarioProps = {}) {
  const formMode = mode || 'nuevo';
  const storageKey = `cliente_${clienteId || 'temp'}_calendario`;
  const readOnly = isView || formMode === 'ver';
  
  // Función para cargar datos persistidos
  const loadPersistedData = (key: string, defaultValue: any) => {
    try {
      if (formMode === 'nuevo') return [];
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error('Error loading persisted data:', error);
      return defaultValue;
    }
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventos, setEventos] = useState<Evento[]>(() =>
    loadPersistedData(storageKey, [])
  );
  const [selectedEventos, setSelectedEventos] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [showCompletados, setShowCompletados] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Guardar en sessionStorage cuando cambien los datos
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(eventos));
  }, [eventos, storageKey]);

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const tiposEvento = [
    { value: 'Cita', label: 'Cita', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { value: 'Pago', label: 'Pago', color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'Recordatorio', label: 'Recordatorio', color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'Seguimiento', label: 'Seguimiento', color: 'bg-purple-100 text-purple-700 border-purple-300' },
    { value: 'Vencimiento', label: 'Vencimiento', color: 'bg-orange-100 text-orange-700 border-orange-300' }
  ];

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const weeks: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  };

  const getEventosForDay = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let eventosDelDia = eventos.filter(e => e.fecha === dateStr);
    
    if (filterTipo !== 'todos') {
      eventosDelDia = eventosDelDia.filter(e => e.tipo === filterTipo);
    }
    
    if (!showCompletados) {
      eventosDelDia = eventosDelDia.filter(e => !e.completado);
    }
    
    return eventosDelDia.sort((a, b) => a.hora.localeCompare(b.hora));
  };

  const hasEvents = (day: number | null) => {
    return getEventosForDay(day).length > 0;
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

  const handleDayClick = (day: number | null) => {
    if (day) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setSelectedDate(dateStr);
    }
  };

  const handleDayDoubleClick = (day: number | null) => {
    if (day && !readOnly) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const parts = dateStr.split('-');
      const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      
      setModalMode('create');
      setEditingEvento(null);
      setShowModal(true);
    }
  };

  const handleNuevo = () => {
    setModalMode('create');
    setEditingEvento(null);
    setShowModal(true);
  };

  const handleEliminar = () => {
    if (selectedEventos.length === 0) {
      toast.error('Por favor seleccione al menos un evento para eliminar');
      return;
    }

    setEventos(prev => prev.filter(e => !selectedEventos.includes(e.id)));
    const count = selectedEventos.length;
    setSelectedEventos([]);
    toast.success(`${count} evento${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente`);
  };

  const handleEdit = (evento: Evento) => {
    setModalMode('edit');
    setEditingEvento(evento);
    setShowModal(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEventos(eventos.map(e => e.id));
    } else {
      setSelectedEventos([]);
    }
  };

  const handleSelect = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedEventos(prev => [...prev, id]);
    } else {
      setSelectedEventos(prev => prev.filter(eid => eid !== id));
    }
  };

  const handleToggleCompletado = (eventoId: number) => {
    if (readOnly) return;
    setEventos(eventos.map(e => 
      e.id === eventoId 
        ? { ...e, completado: !e.completado }
        : e
    ));
    toast.success('Estado actualizado');
  };

  const exportarExcel = () => {
    const datosExportar = eventos.map(({ titulo, descripcion, fecha, hora, tipo, completado }) => ({
      'Título': titulo,
      'Descripción': descripcion,
      'Fecha': fecha,
      'Hora': hora,
      'Tipo': tipo,
      'Completado': completado ? 'Sí' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Calendario');
    
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Calendario_${fecha}.xlsx`);
    toast.success('Archivo Excel exportado correctamente');
  };

  const weeks = renderCalendar();

  const eventosDelMes = eventos.filter(e => {
    const eventoDate = new Date(e.fecha);
    return eventoDate.getMonth() === currentDate.getMonth() && 
           eventoDate.getFullYear() === currentDate.getFullYear();
  }).filter(e => {
    if (filterTipo !== 'todos' && e.tipo !== filterTipo) return false;
    if (!showCompletados && e.completado) return false;
    return true;
  }).sort((a, b) => {
    const dateCompare = a.fecha.localeCompare(b.fecha);
    if (dateCompare !== 0) return dateCompare;
    return a.hora.localeCompare(b.hora);
  });

  const getTipoColor = (tipo: string) => {
    const tipoObj = tiposEvento.find(t => t.value === tipo);
    return tipoObj?.color || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <div className="bg-white">
      {/* Encabezado institucional */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">CALENDARIO DE EVENTOS</span>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={handleNuevo}
                className="px-4 py-1.5 btn-accent-theme text-xs font-medium rounded hover:bg-accent-hover-theme"
              >
                Nuevo
              </button>
              <button
                onClick={handleEliminar}
                className="px-4 py-1.5 btn-accent-theme text-xs font-medium rounded hover:bg-accent-hover-theme"
              >
                Eliminar
              </button>
            </>
          )}
          <button
            onClick={exportarExcel}
            className="px-4 py-1.5 btn-accent-theme text-xs font-medium rounded hover:bg-accent-hover-theme"
          >
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-3 p-3 bg-[#F5F5F5] border border-gray-300 rounded">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo de evento</label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 text-xs rounded bg-white focus:outline-none focus:border-accent-theme"
            >
              <option value="todos">Todos los tipos</option>
              {tiposEvento.map(tipo => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              id="showCompletados"
              checked={showCompletados}
              onChange={(e) => setShowCompletados(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="showCompletados" className="text-xs text-gray-700">
              Mostrar eventos completados
            </label>
          </div>
        </div>
      </div>

      {/* Navegación del mes */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button 
            onClick={previousMonth}
            className="p-1.5 hover:bg-gray-100 rounded border border-gray-300"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-800 min-w-[150px] text-center">
            {meses[currentDate.getMonth()]} de {currentDate.getFullYear()}
          </span>
          <button 
            onClick={nextMonth}
            className="p-1.5 hover:bg-gray-100 rounded border border-gray-300"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={goToToday}
            className="ml-2 px-3 py-1 bg-gray-100 text-xs rounded hover:bg-gray-200 border border-gray-300"
          >
            Hoy
          </button>
        </div>
        <div className="text-xs text-gray-600 italic">
          Doble clic en un día para crear un evento rápido
        </div>
      </div>

      {/* Calendario */}
      <div className="border border-gray-300 rounded overflow-hidden mb-3">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: 'var(--theme-table-header)' }}>
              {diasSemana.map((dia, index) => (
                <th 
                  key={index} 
                  className="px-2 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300 last:border-r-0"
                >
                  {dia}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={weekIndex} className="border-b border-gray-200 last:border-b-0">
                {week.map((day, dayIndex) => (
                  <td 
                    key={dayIndex}
                    onClick={() => handleDayClick(day)}
                    onDoubleClick={() => handleDayDoubleClick(day)}
                    className={`
                      px-2 py-2 border-r border-gray-200 last:border-r-0 align-top cursor-pointer
                      ${day ? 'hover:bg-blue-50' : 'bg-gray-50'}
                      ${selectedDate === `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` ? 'bg-[#FFFF99]' : ''}
                      ${isToday(day) ? 'ring-2 ring-accent-theme ring-inset' : ''}
                    `}
                    style={{ height: '90px', minHeight: '90px', verticalAlign: 'top' }}
                  >
                    {day && (
                      <div className="h-full">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${isToday(day) ? 'text-accent-theme font-bold' : 'text-gray-700'}`}>
                            {day}
                          </span>
                          {hasEvents(day) && (
                            <span className="flex items-center justify-center w-4 h-4 bg-orange-500 text-white rounded-full text-[9px] font-bold">
                              {getEventosForDay(day).length}
                            </span>
                          )}
                        </div>
                        <div className="space-y-0.5 overflow-y-auto" style={{ maxHeight: '65px' }}>
                          {getEventosForDay(day).slice(0, 3).map((evento) => (
                            <div 
                              key={evento.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(evento);
                              }}
                              className={`
                                text-[9px] px-1 py-0.5 rounded cursor-pointer hover:opacity-80 border
                                ${getTipoColor(evento.tipo)}
                                ${evento.completado ? 'opacity-50 line-through' : ''}
                              `}
                              title={`${evento.hora} - ${evento.titulo}`}
                            >
                              <div className="truncate font-medium">{evento.hora} {evento.titulo}</div>
                            </div>
                          ))}
                          {getEventosForDay(day).length > 3 && (
                            <div className="text-[9px] text-gray-500 italic px-1">
                              +{getEventosForDay(day).length - 3} más
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="mb-3 flex items-center gap-4 text-xs text-gray-600 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
          <span>Día con eventos</span>
        </div>
        {tiposEvento.map(tipo => (
          <div key={tipo.value} className="flex items-center gap-2">
            <span className={`w-3 h-3 border rounded ${tipo.color}`}></span>
            <span>{tipo.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-accent-theme rounded"></span>
          <span>Día actual</span>
        </div>
      </div>

      {/* Lista de eventos del mes */}
      <div>
        <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3">
          <span className="text-sm font-medium text-gray-800">
            EVENTOS DEL MES ({eventosDelMes.length})
          </span>
        </div>
        
        {eventosDelMes.length === 0 ? (
          <div className="border border-gray-300 rounded p-4 text-center text-xs text-gray-500">
            No hay eventos para este mes
          </div>
        ) : (
          <div className="border border-gray-300">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-400" style={{ backgroundColor: 'var(--theme-table-header)' }}>
                  <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={eventosDelMes.length > 0 && selectedEventos.length === eventosDelMes.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-xs text-gray-800 border-r border-gray-300" style={{ width: '50px' }}>OK</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Título</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Descripción</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium text-xs text-gray-800">Hora</th>
                </tr>
              </thead>
              <tbody>
                {eventosDelMes.map((evento, index) => (
                  <tr
                    key={evento.id}
                    onDoubleClick={() => handleEdit(evento)}
                    className={`border-b border-gray-300 hover:bg-gray-50 cursor-pointer ${
                      selectedEventos.includes(evento.id) ? 'bg-blue-50' : ''
                    } ${evento.completado ? 'opacity-60' : ''}`}
                  >
                    <td className="px-3 py-2 text-center border-r border-gray-300">
                      <input
                        type="checkbox"
                        checked={selectedEventos.includes(evento.id)}
                        onChange={(e) => handleSelect(evento.id, e.target.checked)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-3 py-2 text-center border-r border-gray-300">
                      <input
                        type="checkbox"
                        checked={evento.completado}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleCompletado(evento.id);
                        }}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-gray-300">
                      <span className={`text-xs px-2 py-0.5 rounded border ${getTipoColor(evento.tipo)} ${evento.completado ? 'line-through' : ''}`}>
                        {evento.tipo}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-gray-700 border-r border-gray-300 ${evento.completado ? 'line-through' : ''}`}>
                      {evento.titulo}
                    </td>
                    <td className={`px-3 py-2 text-gray-700 border-r border-gray-300 ${evento.completado ? 'line-through' : ''}`}>
                      {evento.descripcion}
                    </td>
                    <td className={`px-3 py-2 text-gray-700 border-r border-gray-300 ${evento.completado ? 'line-through' : ''}`}>
                      {new Date(evento.fecha).toLocaleDateString('es-MX', { 
                        day: '2-digit', 
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className={`px-3 py-2 text-gray-700 ${evento.completado ? 'line-through' : ''}`}>
                      {evento.hora}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contador de eventos */}
      <div className="mt-2 text-xs text-gray-600">
        <span className="font-medium">Total de eventos: {eventos.length}</span>
        <span className="ml-3">Completados: {eventos.filter(e => e.completado).length}</span>
        <span className="ml-3">Pendientes: {eventos.filter(e => !e.completado).length}</span>
      </div>

      {/* MODAL INSTITUCIONAL */}
      {showModal && (
        <ModalEvento
          mode={modalMode}
          evento={editingEvento}
          onSave={(eventosData) => {
            if (modalMode === 'create') {
              const baseId = eventos.length > 0 ? Math.max(...eventos.map(e => e.id)) + 1 : 1;
              const newEventos: Evento[] = eventosData.map((data, i) => ({
                id: baseId + i,
                ...data,
                completado: false,
                seleccionado: false,
              }));
              setEventos([...eventos, ...newEventos]);
              toast.success(
                newEventos.length > 1
                  ? `${newEventos.length} eventos creados correctamente`
                  : 'Evento creado correctamente'
              );
            } else {
              setEventos(eventos.map(e =>
                e.id === editingEvento?.id ? { ...e, ...eventosData[0] } : e
              ));
              toast.success('Evento actualizado correctamente');
            }
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// MODAL INSTITUCIONAL
interface ModalEventoProps {
  mode: 'create' | 'edit' | 'view';
  evento: Evento | null;
  onSave: (data: any[]) => void;
  onClose: () => void;
}

type Repeticion = 'Ninguna' | 'Diaria' | 'Semanal' | 'Quincenal' | 'Mensual';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIA_SEMANA_INDEX: Record<string, number> = {
  Lunes: 1, Martes: 2, 'Miércoles': 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 0,
};

function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string {
  if (!display) return '';
  const [d, m, y] = display.split('/');
  return `${y}-${m}-${d}`;
}

function generarFechas(
  repeticion: Repeticion,
  fecha: string,
  fechaInicio: string,
  fechaFin: string,
  diaSemana: string,
  diaDelMes: number
): string[] {
  if (repeticion === 'Ninguna') return [fecha];

  const inicio = new Date(fechaInicio + 'T00:00:00');
  const fin = new Date(fechaFin + 'T00:00:00');
  const fechas: string[] = [];

  if (repeticion === 'Diaria') {
    let cur = new Date(inicio);
    while (cur <= fin) {
      fechas.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
  } else if (repeticion === 'Semanal') {
    const targetDay = DIA_SEMANA_INDEX[diaSemana] ?? 1;
    let cur = new Date(inicio);
    while (cur.getDay() !== targetDay) cur.setDate(cur.getDate() + 1);
    while (cur <= fin) {
      fechas.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 7);
    }
  } else if (repeticion === 'Quincenal') {
    let cur = new Date(inicio);
    while (cur <= fin) {
      fechas.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 15);
    }
  } else if (repeticion === 'Mensual') {
    let cur = new Date(inicio.getFullYear(), inicio.getMonth(), diaDelMes);
    if (cur < inicio) cur.setMonth(cur.getMonth() + 1);
    while (cur <= fin) {
      fechas.push(cur.toISOString().split('T')[0]);
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  return fechas;
}

function ModalEvento({ mode, evento, onSave, onClose }: ModalEventoProps) {
  const isEdit = mode === 'edit';

  const [formData, setFormData] = useState({
    titulo: evento?.titulo || '',
    descripcion: evento?.descripcion || '',
    hora: evento?.hora || '09:00',
    tipo: (evento?.tipo || 'Cita') as Evento['tipo'],
    repeticion: 'Ninguna' as Repeticion,
    fecha: evento?.fecha ? isoToDisplay(evento.fecha) : '',
    fechaInicio: '',
    fechaFin: '',
    diaSemana: 'Lunes',
    diaDelMes: '1',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const tiposEvento = ['Cita', 'Recordatorio', 'Pago', 'Seguimiento', 'Vencimiento'];

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.titulo.trim()) newErrors.titulo = 'El título es requerido';

    if (formData.repeticion === 'Ninguna') {
      if (!formData.fecha.trim()) newErrors.fecha = 'La fecha es requerida';
    } else {
      if (!formData.fechaInicio.trim()) newErrors.fechaInicio = 'La fecha de inicio es requerida';
      if (!formData.fechaFin.trim()) newErrors.fechaFin = 'La fecha de fin es requerida';
      if (formData.fechaInicio && formData.fechaFin) {
        const ini = new Date(displayToIso(formData.fechaInicio));
        const fin = new Date(displayToIso(formData.fechaFin));
        if (fin < ini) newErrors.fechaFin = 'La fecha fin debe ser mayor o igual a la fecha inicio';
      }
      if (formData.repeticion === 'Mensual') {
        const d = parseInt(formData.diaDelMes, 10);
        if (isNaN(d) || d < 1 || d > 31) newErrors.diaDelMes = 'Ingrese un día entre 1 y 31';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Formulario incompleto', { description: 'Por favor complete todos los campos requeridos' });
      return;
    }

    const fechas = generarFechas(
      formData.repeticion,
      displayToIso(formData.fecha),
      displayToIso(formData.fechaInicio),
      displayToIso(formData.fechaFin),
      formData.diaSemana,
      parseInt(formData.diaDelMes, 10)
    );

    const base = { titulo: formData.titulo, descripcion: formData.descripcion, hora: formData.hora, tipo: formData.tipo };
    onSave(fechas.map(f => ({ ...base, fecha: f })));
  };

  const horasOpciones = Array.from({ length: 48 }, (_, i) => {
    const h = String(Math.floor(i / 2)).padStart(2, '0');
    const m = i % 2 === 0 ? '00' : '30';
    return `${h}:${m}`;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
          <h3 className="text-base font-medium text-white">
            {mode === 'create' ? 'Nuevo Evento' : 'Editar Evento'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="py-4">
            <div className="bg-[#E8E8E8] px-3 py-2 mb-4">
              <h3 className="text-xs font-semibold text-gray-700">INFORMACIÓN DEL EVENTO</h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Fila 1: Título + Tipo */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Título <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      value={formData.titulo}
                      onChange={(e) => handleChange('titulo', e.target.value)}
                      placeholder="Ej: Reunión con cliente"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    />
                    {errors.titulo && <p className="text-red-600 text-[10px] mt-1">{errors.titulo}</p>}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo <span className="text-red-600">*</span></label>
                    <select
                      value={formData.tipo}
                      onChange={(e) => handleChange('tipo', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    >
                      {tiposEvento.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Fila 2: Hora + Repetición */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1 font-medium">Hora</label>
                    <select
                      value={formData.hora}
                      onChange={(e) => handleChange('hora', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                    >
                      {horasOpciones.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {!isEdit && (
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">Repetición</label>
                      <select
                        value={formData.repeticion}
                        onChange={(e) => handleChange('repeticion', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                      >
                        <option value="Ninguna">Ninguna (fecha específica)</option>
                        <option value="Diaria">Diaria</option>
                        <option value="Semanal">Semanal</option>
                        <option value="Quincenal">Quincenal (cada 15 días)</option>
                        <option value="Mensual">Mensual</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Campos de fecha según repetición */}
                {formData.repeticion === 'Ninguna' || isEdit ? (
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha <span className="text-red-600">*</span></label>
                      <DatePicker
                        value={formData.fecha}
                        onChange={(date) => handleChange('fecha', date)}
                        placeholder="DD/MM/YYYY"
                        className="w-full"
                      />
                      {errors.fecha && <p className="text-red-600 text-[10px] mt-1">{errors.fecha}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs text-blue-700 font-medium">
                      Configuración de repetición: <span className="font-bold">{formData.repeticion}</span>
                    </p>

                    {/* Día de semana (solo Semanal) */}
                    {formData.repeticion === 'Semanal' && (
                      <div>
                        <label className="block text-xs text-gray-700 mb-1 font-medium">Día de la semana <span className="text-red-600">*</span></label>
                        <select
                          value={formData.diaSemana}
                          onChange={(e) => handleChange('diaSemana', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                        >
                          {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Día del mes (solo Mensual) */}
                    {formData.repeticion === 'Mensual' && (
                      <div>
                        <label className="block text-xs text-gray-700 mb-1 font-medium">Día del mes <span className="text-red-600">*</span></label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={formData.diaDelMes}
                          onChange={(e) => handleChange('diaDelMes', e.target.value)}
                          className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                        />
                        {errors.diaDelMes && <p className="text-red-600 text-[10px] mt-1">{errors.diaDelMes}</p>}
                      </div>
                    )}

                    {/* Rango de fechas */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha inicio <span className="text-red-600">*</span></label>
                        <DatePicker
                          value={formData.fechaInicio}
                          onChange={(date) => handleChange('fechaInicio', date)}
                          placeholder="DD/MM/YYYY"
                          className="w-full"
                        />
                        {errors.fechaInicio && <p className="text-red-600 text-[10px] mt-1">{errors.fechaInicio}</p>}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha fin <span className="text-red-600">*</span></label>
                        <DatePicker
                          value={formData.fechaFin}
                          onChange={(date) => handleChange('fechaFin', date)}
                          placeholder="DD/MM/YYYY"
                          className="w-full"
                        />
                        {errors.fechaFin && <p className="text-red-600 text-[10px] mt-1">{errors.fechaFin}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Descripción */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => handleChange('descripcion', e.target.value)}
                    placeholder="Descripción del evento..."
                    rows={3}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 px-0 py-4 mt-6 bg-gray-50 -mx-6 px-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-primary-theme text-white rounded hover:opacity-90 font-medium"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}